# ==========================================
# FILE: livemarket.py
# Engine: Live Market Snapshot
# Run Time: 3:25 PM - 3:35 PM IST (Mon-Fri)
# Purpose: Last live prices Firebase par push karo
#          App after-market hours ma aa data show kare
# ==========================================

import gspread
from yahooquery import Ticker
import time
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# ── NAME MAPPER (olhcv.py thi same) ──────────────────────────
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

# ── INDICES LIST ─────────────────────────────────────────────
INDICES = [
    "^NSEI", "^BSESN", "^NSEBANK", "^CNXIT", "^CNXPHARMA", "^CNXAUTO",
    "^CNXFMCG", "^CNXMETAL", "^CNXREALTY", "^CNXINFRA"
]

# ── FIREBASE INIT ─────────────────────────────────────────────
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

# ── MAIN FUNCTION ─────────────────────────────────────────────
def update_livemarket():
    print("=" * 55)
    print("  LIVEMARKET ENGINE - Live Snapshot + Firebase Push")
    print("=" * 55)

    now_ist = datetime.utcnow()
    ts_str  = now_ist.strftime("%Y-%m-%d %H:%M:%S IST")
    date_str = now_ist.strftime("%Y-%m-%d")
    print(f"  Run Time: {ts_str}")
    print("=" * 55)

    # ── Step 1: Firebase Connect ──
    db = init_firebase()
    if not db:
        print("❌ Firebase unavailable. Exiting.")
        return

    # ── Step 2: Google Sheet → Symbol List ──
    try:
        gc     = gspread.service_account(filename='keys.json')
        sh     = gc.open_by_key("1XsDNtK2EPmuHepl3i0z4cP2qBg5iZccjXoCztKfVAhk")
        sheet  = sh.worksheet("OLHCV")
        print("✅ Google Sheet Connected!")
    except Exception as e:
        print(f"❌ Sheet Connection Fail: {e}")
        return

    symbols_raw  = sheet.col_values(1)[1:]  # A column, skip header
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

    # ── Step 3: Yahoo Finance Fetch (chunks of 40) ──
    all_prices = {}
    chunk_size  = 40
    total_chunks = (len(primary_list) + chunk_size - 1) // chunk_size

    for i in range(0, len(primary_list), chunk_size):
        chunk     = primary_list[i:i + chunk_size]
        chunk_num = (i // chunk_size) + 1
        print(f"  Fetching chunk {chunk_num}/{total_chunks}...", end=" ", flush=True)

        try:
            t      = Ticker(chunk, asynchronous=True)
            prices = t.price

            for tick in chunk:
                p = prices.get(tick, {}) if isinstance(prices, dict) else {}
                all_prices[tick] = p if isinstance(p, dict) else {}
            print("Done ✅")
        except Exception as e:
            print(f"Error ❌: {e}")

        time.sleep(1)

    # ── Step 4: Build Firebase Batch ──
    print("\n🔢 Processing data...")
    firebase_batch = {}
    zero_count     = 0

    for sym_raw, tick in zip(symbols_raw, primary_list):
        p = all_prices.get(tick, {})

        ltp       = p.get('regularMarketPrice')       or p.get('currentPrice')            or 0
        prev      = p.get('regularMarketPreviousClose') or 0
        open_p    = p.get('regularMarketOpen')         or 0
        high      = p.get('regularMarketDayHigh')      or 0
        low       = p.get('regularMarketDayLow')       or 0
        volume    = p.get('regularMarketVolume')        or 0
        change    = p.get('regularMarketChange')        or 0
        chg_pct   = p.get('regularMarketChangePercent') or 0

        # BSE fallback — jо NSE ma zero aave
        if ltp == 0 and ".NS" in tick:
            try:
                t_bse = Ticker(tick.replace(".NS", ".BO"))
                b     = t_bse.price.get(tick.replace(".NS", ".BO"), {})
                if isinstance(b, dict):
                    ltp     = b.get('regularMarketPrice')        or b.get('currentPrice') or 0
                    prev    = b.get('regularMarketPreviousClose') or 0
                    open_p  = b.get('regularMarketOpen')          or ltp
                    high    = b.get('regularMarketDayHigh')       or ltp
                    low     = b.get('regularMarketDayLow')        or ltp
                    volume  = b.get('regularMarketVolume')         or 0
                    change  = b.get('regularMarketChange')         or 0
                    chg_pct = b.get('regularMarketChangePercent')  or 0
            except:
                pass

        if ltp == 0:
            zero_count += 1

        # Cleanup
        if ltp != 0:
            if open_p == 0: open_p = ltp
            if high   == 0: high   = ltp
            if low    == 0: low    = ltp
        if prev != 0 and change == 0:
            change  = round(ltp - prev, 2)
        if prev != 0 and chg_pct == 0:
            chg_pct = round(((ltp - prev) / prev) * 100, 2)

        # ── Firebase document — tamara existing structure match kare ──
        firebase_batch[sym_raw] = {
            'ltp':       round(float(ltp),     2),
            'price':     round(float(ltp),     2),   # app compatibility
            'prevClose': round(float(prev),    2),
            'open':      round(float(open_p),  2),
            'high':      round(float(high),    2),
            'low':       round(float(low),     2),
            'volume':    int(volume),
            'change':    round(float(change),  2),
            'change_pct': round(float(chg_pct), 2),
            'ts':        ts_str,
            'date':      date_str,
            'ticker':    tick
        }
# ── Step 4b: Indices fetch + Gift Nifty ──
    print("\n📊 Fetching Indices...")
    try:
        t_idx = Ticker(INDICES, asynchronous=True)
        idx_prices = t_idx.price

        for sym in INDICES:
            p = idx_prices.get(sym, {}) if isinstance(idx_prices, dict) else {}
            if not isinstance(p, dict): continue

            ltp     = p.get('regularMarketPrice') or 0
            prev    = p.get('regularMarketPreviousClose') or 0
            high    = p.get('regularMarketDayHigh') or ltp
            low     = p.get('regularMarketDayLow') or ltp
            change  = p.get('regularMarketChange') or round(ltp - prev, 2)
            chg_pct = p.get('regularMarketChangePercent') or (
                round(((ltp - prev) / prev) * 100, 2) if prev else 0
            )

            firebase_batch[sym] = {
                'ltp':        round(float(ltp),     2),
                'price':      round(float(ltp),     2),
                'prevClose':  round(float(prev),    2),
                'high':       round(float(high),    2),
                'low':        round(float(low),     2),
                'change':     round(float(change),  2),
                'change_pct': round(float(chg_pct), 2),
                'volume':     0,
                'open':       ltp,
                'ts':         ts_str,
                'date':       date_str,
                'ticker':     sym,
                '_type':      'index'
            }
        print(f"  ✅ {len(INDICES)} indices fetched")
    except Exception as e:
        print(f"  ❌ Indices fetch failed: {e}")

    # ── Gift Nifty — TradingView ──
    print("🎁 Fetching Gift Nifty...")
    try:
        import urllib.request
        import json as _json
        url = "https://scanner.tradingview.com/symbol?symbol=NSEIX%3ANIFTY1%21&fields=close,change,change_abs,high,low,prev_close_price&no_404=1"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://www.tradingview.com',
            'Referer': 'https://www.tradingview.com/'
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            d = _json.loads(resp.read())
        gift_ltp = float(d.get('close') or 0)
        gift_prev = float(d.get('prev_close_price') or 0)
        firebase_batch['NIFTY1!'] = {
            'ltp':        gift_ltp,
            'price':      gift_ltp,
            'prevClose':  gift_prev,
            'high':       float(d.get('high') or gift_ltp),
            'low':        float(d.get('low') or gift_ltp),
            'change':     float(d.get('change_abs') or 0),
            'change_pct': float(d.get('change') or 0),
            'volume':     0,
            'open':       gift_ltp,
            'ts':         ts_str,
            'date':       date_str,
            'ticker':     'NIFTY1!',
            '_type':      'index'
        }
        print(f"  ✅ Gift Nifty: {gift_ltp}")
    except Exception as e:
        print(f"  ❌ Gift Nifty fetch failed: {e}")

    # ── Step 5: Firebase Push ──
    if db:
        print("🔥 Pushing to Firebase → livemarket collection...")
        try:
            items         = list(firebase_batch.items())
            fb_chunk_size = 400
            total_fb      = (len(items) + fb_chunk_size - 1) // fb_chunk_size

            for ci in range(0, len(items), fb_chunk_size):
                batch       = db.batch()
                chunk_items = items[ci:ci + fb_chunk_size]

                for sym, data in chunk_items:
                    ref = db.collection('livemarket').document(sym)
                    batch.set(ref, data)

                batch.commit()
                print(f"  Firebase chunk {(ci // fb_chunk_size)+1}/{total_fb} committed ✅")

            print(f"✅ Firebase Push Complete! ({len(firebase_batch)} symbols)")

        except Exception as e:
            print(f"❌ Firebase Push Fail: {e}")

    # ── Summary ──
    print("\n" + "=" * 55)
    print(f"  DONE! Total: {len(primary_list)} | Zero-price: {zero_count}")
    print(f"  Collection: livemarket | Date: {date_str}")
    print("=" * 55)

if __name__ == "__main__":
    update_livemarket()
