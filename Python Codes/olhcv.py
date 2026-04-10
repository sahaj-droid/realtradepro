import gspread
from yahooquery import Ticker
import pandas as pd
import time
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# ── NAME MAPPER ──────────────────────────────────────────────────────────
NAME_MAPPER = {
    "BAJAJHCARE": "539872", "GUJARATPOLY": "517288",
    "HIGHENE": "HIGHENE",
    "HONDAPOWER": "HONDAPOWER",
    "INTEGRAEN": "INTEGRAEN",
    "MULTIBASE": "526169",
    "PGFOILQ": "526747",
    "SWISSMLTRY": "SWISSMLTRY",
    "TANAA": "522229", "WPIL": "505872",
    "NBCC": "NBCC/consolidated", "NHPC": "NHPC/consolidated", "ACE": "ACE/consolidated",
    "BHEL": "BHEL/consolidated", "ADANIENSOL": "ADANIENSOL/consolidated",
    "ADANIENT": "ADANIENT/consolidated", "ADANIGREEN": "ADANIGREEN/consolidated",
    "ADANIPORTS": "ADANIPORTS/consolidated", "ADANIPOWER": "ADANIPOWER/consolidated",
    "RELIANCE": "RELIANCE/consolidated", "TCS": "TCS/consolidated",
    "HDFCBANK": "HDFCBANK/consolidated", "ICICIBANK": "ICICIBANK/consolidated"
}

# ── FIREBASE INIT ─────────────────────────────────────────────────────────
def init_firebase():
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate('keys.json')
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Firebase Connected!")
        return db
    except Exception as e:
        print(f"❌ Firebase Init Fail: {e}")
        return None

# ── MAIN FUNCTION ─────────────────────────────────────────────────────────
def update_olhcv():
    print("=" * 55)
    print("  OLHCV ENGINE - Yahoo Fetch + Firebase Push")
    print("=" * 55)

    # ── Step 1: Google Sheet Connect ──
    try:
        gc = gspread.service_account(filename='keys.json')
        sh = gc.open_by_key("1XsDNtK2EPmuHepl3i0z4cP2qBg5iZccjXoCztKfVAhk")
        sheet = sh.worksheet("OLHCV")
        print("✅ Google Sheet Connected!")
    except Exception as e:
        print(f"❌ Sheet Connection Fail: {e}")
        return

    # ── Step 2: Firebase Connect ──
    db = init_firebase()
    if not db:
        print("⚠️  Firebase fail - Sheet update only thashe, Firebase skip.")

    # ── Step 3: Symbol List Prepare ──
    symbols_raw = sheet.col_values(1)[1:]
    primary_list = []
    for s in symbols_raw:
        mapped = NAME_MAPPER.get(s, s).split('/')[0].strip()
        if ".NS" in mapped or ".BO" in mapped:
            primary_list.append(mapped)
        elif mapped.isdigit():
            primary_list.append(f"{mapped}.BO")
        else:
            primary_list.append(f"{mapped}.NS")

    print(f"📦 Total Symbols: {len(primary_list)}")
    print(f"📦 Chunks: {(len(primary_list) // 40) + 1} x 40")

    # ── Step 4: Yahoo Finance Fetch ──
    all_data = {}
    chunk_size = 40
    total_chunks = (len(primary_list) + chunk_size - 1) // chunk_size

    for i in range(0, len(primary_list), chunk_size):
        chunk = primary_list[i:i + chunk_size]
        chunk_num = (i // chunk_size) + 1
        print(f"  Fetching chunk {chunk_num}/{total_chunks}...", end=" ")

        try:
            t = Ticker(chunk, asynchronous=True)
            prices = t.price
            histories = t.history(period='5d', interval='1d')

            for tick in chunk:
                p_data = prices.get(tick, {}) if isinstance(prices, dict) else {}
                h_df = None
                if isinstance(histories, pd.DataFrame):
                    try: h_df = histories.xs(tick)
                    except: pass
                elif isinstance(histories, dict):
                    h_df = histories.get(tick)

                all_data[tick] = {'price': p_data, 'history': h_df}
            print("Done")
        except Exception as e:
            print(f"Error: {e}")

        time.sleep(1)

    # ── Step 5: Extract + Validate ──
    print("\n🔢 Processing data...")
    sheet_updates = []
    firebase_batch = {}
    zero_count = 0
    today_str = datetime.now().strftime("%Y-%m-%d")

    for i, (sym_raw, tick) in enumerate(zip(symbols_raw, primary_list)):
        entry = all_data.get(tick, {})
        p = entry.get('price', {})
        if not isinstance(p, dict): p = {}
        h = entry.get('history')

        close = p.get('regularMarketPrice') or p.get('currentPrice') or 0
        prev  = p.get('regularMarketPreviousClose') or 0
        open_p = p.get('regularMarketOpen') or 0
        high  = p.get('regularMarketDayHigh') or 0
        low   = p.get('regularMarketDayLow') or 0

        # Fallback 1: History
        if (close == 0 or open_p == 0) and h is not None and isinstance(h, pd.DataFrame) and not h.empty:
            last_h = h.iloc[-1]
            close  = last_h.get('close') or close
            open_p = last_h.get('open') or close
            high   = last_h.get('high') or close
            low    = last_h.get('low') or close
            if len(h) > 1:
                prev = h.iloc[-2].get('close') or prev

        # Fallback 2: BSE
        if close == 0 and ".NS" in tick:
            try:
                t_bse = Ticker(tick.replace(".NS", ".BO"))
                b_p = t_bse.price.get(tick.replace(".NS", ".BO"), {})
                if isinstance(b_p, dict):
                    close  = b_p.get('regularMarketPrice') or b_p.get('currentPrice') or 0
                    open_p = b_p.get('regularMarketOpen') or close
                    high   = b_p.get('regularMarketDayHigh') or close
                    low    = b_p.get('regularMarketDayLow') or close
                    prev   = b_p.get('regularMarketPreviousClose') or 0
            except: pass

        # Final Cleanup
        if close != 0:
            if open_p == 0: open_p = close
            if high   == 0: high   = close
            if low    == 0: low    = close
        else:
            zero_count += 1

        # Sheet row
        sheet_updates.append({
            'range': f'B{i+2}:F{i+2}',
            'values': [[prev, open_p, high, low, close]]
        })

        # Firebase doc - key is original symbol (e.g. "RELIANCE")
        firebase_batch[sym_raw] = {
            'prev':  round(float(prev),  2),
            'open':  round(float(open_p), 2),
            'high':  round(float(high),  2),
            'low':   round(float(low),   2),
            'close': round(float(close), 2),
            'date':  today_str,
            'ticker': tick  # e.g. "RELIANCE.NS"
        }

    # ── Step 6: Google Sheet Update ──
    print("💾 Saving to Google Sheet...")
    try:
        sheet.batch_update(sheet_updates)
        print(f"✅ Sheet Updated! ({len(sheet_updates)} rows)")
    except Exception as e:
        print(f"❌ Sheet Update Fail: {e}")

    # ── Step 7: Firebase Push (batch in chunks of 400) ──
    if db:
        print("🔥 Pushing to Firebase...")
        try:
            items = list(firebase_batch.items())
            fb_chunk_size = 400  # Firestore batch limit is 500
            total_fb_chunks = (len(items) + fb_chunk_size - 1) // fb_chunk_size

            for ci in range(0, len(items), fb_chunk_size):
                batch = db.batch()
                chunk_items = items[ci:ci + fb_chunk_size]
                for sym, data in chunk_items:
                    ref = db.collection('olhcv').document(sym)
                    batch.set(ref, data)
                batch.commit()
                print(f"  Firebase chunk {(ci // fb_chunk_size)+1}/{total_fb_chunks} committed.")

            print(f"✅ Firebase Push Complete! ({len(firebase_batch)} symbols)")
        except Exception as e:
            print(f"❌ Firebase Push Fail: {e}")

    # ── Summary ──
    print("\n" + "=" * 55)
    print(f"  DONE! Total: {len(primary_list)} | Zero-price: {zero_count}")
    print(f"  Date: {today_str}")
    print("=" * 55)

if __name__ == "__main__":
    update_olhcv()
