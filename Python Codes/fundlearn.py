# ==========================================
# FILE: fetch_data_FINAL.py — v8.0 (The Auto-Expanding Masterpiece)
# Includes: Auto-Search, Zero Fixes, Quarterly Headers, Firebase Sync, 
# AND Dynamic Database Expansion (Auto-Append New Stocks)
# ==========================================

import sys
import time
from datetime import datetime, timezone
import gspread
import requests
from bs4 import BeautifulSoup
from oauth2client.service_account import ServiceAccountCredentials
import firebase_admin
from firebase_admin import credentials, firestore as fstore

# ── CLI FLAGS ──────────────────────────────────────────────
FORCE_REFRESH = "--force"    in sys.argv
FIREBASE_ONLY = "--firebase" in sys.argv
SINGLE_SYM    = None
if "--sym" in sys.argv:
    idx = sys.argv.index("--sym")
    if idx + 1 < len(sys.argv):
        SINGLE_SYM = sys.argv[idx + 1].upper().strip()

# ── FIREBASE ───────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate("keys.json")
    firebase_admin.initialize_app(cred)
fdb = fstore.client()

# ── GOOGLE SHEETS ──────────────────────────────────────────
scope  = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
gcreds = ServiceAccountCredentials.from_json_keyfile_name("keys.json", scope)
gc     = gspread.authorize(gcreds)
sheet  = gc.open("FF2").get_worksheet(0)

# ── SYMBOL MAPPER ──────────────────────────────────────────
NAME_MAPPER = {
    "BAJAJHCARE": "539872", "GUJARATPOLY": "517288", "HIGHENE": "504068",
    "HONDAPOWER": "522064", "INTEGRAEN": "502623", "MULTIBASE": "526169",
    "PGFOILQ": "526747", "SWISSMLTRY": "522263", "TANAA": "522229", "WPIL": "505872",
    "NBCC": "NBCC/consolidated", "NHPC": "NHPC/consolidated", "ACE": "ACE/consolidated",
    "BHEL": "BHEL/consolidated", "ADANIENSOL": "ADANIENSOL/consolidated",
    "ADANIENT": "ADANIENT/consolidated", "ADANIGREEN": "ADANIGREEN/consolidated",
    "ADANIPORTS": "ADANIPORTS/consolidated", "ADANIPOWER": "ADANIPOWER/consolidated",
    "RELIANCE": "RELIANCE/consolidated", "TCS": "TCS/consolidated",
    "HDFCBANK": "HDFCBANK/consolidated", "ICICIBANK": "ICICIBANK/consolidated"
}

SKIP_KEYWORDS = ["BEES", "ETF", "SMALLCAP", "MOSMALL", "LIQUID", "NIFTY", "SENSEX"]

# મેમરી કેશ
MEMORY_CACHE = {}

# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

def to_num(v):
    try:
        s = str(v).replace(',', '').replace('%', '').strip()
        if s in ('', '-', 'N/A', 'None', 'nan', '--'): 
            return 0.0
        return float(s)
    except:
        return 0.0

def safe(v):
    return to_num(v)

def clean_label(cell):
    parts = [child.strip() for child in cell.children if not hasattr(child, 'name') and str(child).strip()]
    label = ' '.join(parts).strip() if parts else cell.get_text(strip=True)
    return label.replace('+', '').strip()

def read_section(soup, section_id):
    section = soup.find('section', {'id': section_id})
    if not section: return {}
    result = {}
    
    headers = []
    header_tr = section.find('tr')
    if header_tr:
        headers = [th.get_text(strip=True).upper() for th in header_tr.find_all('th')]
    
    for tr in section.find_all('tr'):
        cells = tr.find_all(['td', 'th'])
        if not cells or all(c.name == 'th' for c in cells): continue
        
        label = clean_label(cells[0])
        vals = [c.get_text(strip=True).replace(',', '').replace('%', '').strip() for c in cells[1:]]
        result[label] = {"values": vals, "headers": headers[1:] if len(headers) > 1 else []}
    return result

def get_val(table_dict, key, col=-1):
    key_l = key.lower().strip()
    for label, data in table_dict.items():
        clean_lbl = label.lower().strip()
        if key_l == clean_lbl or (key_l in clean_lbl and 'margin' not in clean_lbl):
            vals = [v for v in data['values'] if v not in ('', '-')]
            return vals[col] if vals else "0"
    return "0"

def get_quarterly_with_headers(table_dict, *keys):
    num = 5
    for key in keys:
        key_l = key.lower().strip()
        for label, data in table_dict.items():
            clean_lbl = label.lower().strip()
            if key_l == clean_lbl or (key_l in clean_lbl and 'margin' not in clean_lbl and 'opm' not in clean_lbl):
                vals = data['values']
                hdrs = [h.upper() for h in data['headers']]
                
                clean_vals = []
                clean_hdrs = []
                
                for i in range(len(vals)):
                    h_text = hdrs[i] if i < len(hdrs) else ""
                    if "TTM" not in h_text and "TRAILING" not in h_text:
                        clean_vals.append(to_num(vals[i]))
                        clean_hdrs.append(h_text)
                
                if clean_vals:
                    if len(clean_vals) >= num:
                        return clean_vals[-num:], clean_hdrs[-num:]
                    else:
                        pad_len = num - len(clean_vals)
                        return [0.0] * pad_len + clean_vals, ['N/A'] * pad_len + clean_hdrs
    return [0.0] * num, ['N/A'] * num

def get_ratio_widget(soup, *keywords):
    for li in soup.select("div.company-ratios ul li"):
        n = li.select_one("span.name")
        v = li.select_one("span.number")
        if n and v:
            nm = n.get_text(strip=True).lower()
            val = v.get_text(strip=True).replace(',', '').strip()
            for kw in keywords:
                if kw.lower() in nm: return val
    return "0"

# ═══════════════════════════════════════════════════════════
# FETCH ENGINE
# ═══════════════════════════════════════════════════════════

def fetch_one(symbol):
    slug = NAME_MAPPER.get(symbol, symbol)
    url = f"https://www.screener.in/company/{slug}/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        
        # 🛠️ AUTO-SEARCH LOGIC
        if resp.status_code == 404:
            search_url = f"https://www.screener.in/api/company/search/?q={symbol}"
            s_resp = requests.get(search_url, headers=headers, timeout=10)
            if s_resp.status_code == 200 and s_resp.json():
                found_slug = s_resp.json()[0]['url'] 
                url = f"https://www.screener.in{found_slug}"
                resp = requests.get(url, headers=headers, timeout=20)
            elif '/consolidated' not in slug:
                resp = requests.get(url + "consolidated/", headers=headers, timeout=20)
        
        if resp.status_code != 200: return None
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        q_tab  = read_section(soup, 'quarters')
        pl_tab = read_section(soup, 'profit-loss')
        bs_tab = read_section(soup, 'balance-sheet')
        cf_tab = read_section(soup, 'cash-flow')
        sh_tab = read_section(soup, 'shareholding')

        # 1. Market Data
        m_cap = to_num(get_ratio_widget(soup, "market cap"))
        price = to_num(get_ratio_widget(soup, "current price"))
        div_yield = to_num(get_ratio_widget(soup, "dividend yield"))
        
        # 2. Profit Figures
        net_profit_val = to_num(get_val(pl_tab, "Net Profit"))
        op_profit_val = to_num(get_val(pl_tab, "Operating Profit"))
        if op_profit_val == 0: op_profit_val = to_num(get_val(pl_tab, "Financing Profit"))

        # 3. Fixes (EBITDA, FCF, Debt, ROA)
        ebitda = get_ratio_widget(soup, "ebitda")
        if to_num(ebitda) == 0: ebitda = str(op_profit_val)
        
        fcf = get_ratio_widget(soup, "free cash flow")
        if to_num(fcf) == 0: fcf = get_val(cf_tab, "Free Cash Flow")

        equity_cap = to_num(get_val(bs_tab, "Equity Capital"))
        reserves = to_num(get_val(bs_tab, "Reserves"))
        total_equity = equity_cap + reserves
        debt_val = to_num(get_val(bs_tab, "Borrowings"))

        de_ratio = get_ratio_widget(soup, "debt to equity")
        if to_num(de_ratio) == 0 and total_equity > 0:
            de_ratio = str(round(debt_val / total_equity, 2))

        roa = get_ratio_widget(soup, "return on asset", "roa")
        if to_num(roa) == 0:
            other_liab = to_num(get_val(bs_tab, "Other Liabilities"))
            total_assets = total_equity + debt_val + other_liab
            if total_assets > 0: roa = str(round((net_profit_val / total_assets) * 100, 2))

        # 4. Quarterly Data WITH HEADERS
        s_q, headers_q = get_quarterly_with_headers(q_tab, "Sales", "Revenue", "Operating Revenue")
        e_q, _ = get_quarterly_with_headers(q_tab, "Expenses", "Total Operating Expenses")
        o_q, _ = get_quarterly_with_headers(q_tab, "Operating Profit", "Financing Profit")
        i_q, _ = get_quarterly_with_headers(q_tab, "Other Income")
        p_q, _ = get_quarterly_with_headers(q_tab, "Profit before tax", "PBT")
        n_q, _ = get_quarterly_with_headers(q_tab, "Net Profit", "Net Income")

        return {
            'net_profit': str(net_profit_val),
            'equity': str(round(total_equity, 2)),
            'shares': str(round(m_cap/price, 2)) if price > 0 else "0",
            'ebit': str(round(op_profit_val - to_num(get_val(pl_tab, "Depreciation")), 2)),
            'roce': get_ratio_widget(soup, "roce"),
            'debt': str(debt_val),
            'dividend': str(round((div_yield * price)/100, 2)) if price > 0 else "0",
            'curr_assets': get_val(bs_tab, "Other Assets") if get_val(bs_tab, "Other Assets") != "0" else get_val(bs_tab, "Current Assets"),
            'curr_liab': str(to_num(get_val(bs_tab, "Other Liabilities"))),
            'promoters': get_val(sh_tab, "Promoters"),
            'fii': get_val(sh_tab, "FIIs"),
            'dii': get_val(sh_tab, "DIIs"),
            'public': get_val(sh_tab, "Public"),
            'eps': get_val(pl_tab, "EPS in Rs"),
            'op_profit': str(op_profit_val),
            'fcf': fcf,
            'de_ratio': de_ratio,
            'roa': roa,
            'ebitda': ebitda,
            'pe': get_ratio_widget(soup, "stock p/e"),
            'book_value': get_ratio_widget(soup, "book value"),
            'roe': get_ratio_widget(soup, "return on equity", "roe"),
            'sales_q': s_q, 'expenses_q': e_q, 'op_q': o_q, 
            'other_inc_q': i_q, 'pbt_q': p_q, 'np_q': n_q,
            'headers_q': headers_q
        }
    except Exception as e:
        print(f"      ❌ Error: {e}")
        return None

# ═══════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("🚀 RealTradePro v8.0 (Auto-Expand & Sync Engine)")
    print("=" * 60 + "\n")

    if not FIREBASE_ONLY:
        # ---------------------------------------------------------
        # STEP 0 — AUTO-EXPAND DATABASE LOGIC
        # ---------------------------------------------------------
        print("📥 STEP 0: Checking for New Stock Requests from App...")
        try:
            # શીટમાં હાલના સ્ટોક્સનું લિસ્ટ
            all_data = sheet.get_all_values()
            existing_symbols = [row[0].strip().upper() for row in all_data if row and row[0].strip()]
            
            # Firebase માંથી 'new_requests' કલેક્શન ચેક કરો
            waitlist_ref = fdb.collection('new_requests').get()  # ← 'requests' rename karyу (Python requests lib sathe conflict)
            new_added = False
            
            for doc in waitlist_ref:
                req_sym = doc.id.strip().upper()
                
                # જો નવો સ્ટોક હોય, તો શીટમાં ખાલી નામ એડ કરો
                if req_sym not in existing_symbols:
                    print(f"   🆕 New Stock Detected: {req_sym}. Adding permanently to Sheet!")
                    sheet.append_row([req_sym])
                    new_added = True
                else:
                    print(f"   ℹ️ {req_sym} already in sheet. Skipping append.")
                
                # રિકવેસ્ટ પૂરી થાય એટલે ડિલીટ કરી દો
                fdb.collection('new_requests').document(doc.id).delete()
                
            # જો નવા સ્ટોક એડ થયા હોય, તો શીટનો ડેટા ફરીથી ફેચ કરો (જેથી નીચેની લૂપમાં એ સ્ટોક આવી જાય)
            if new_added:
                all_data = sheet.get_all_values()
                print("   ✅ Sheet refreshed with new additions.\n")
            else:
                print("   ℹ️ No new requests found.\n")
                
        except Exception as e:
            print(f"   ⚠️ Error in Auto-Expand (Step 0): {e}\n")

        # ---------------------------------------------------------
        # STEP 1 — SCREENER → SHEET
        # ---------------------------------------------------------
        print("🔍 STEP 1: Fetching Data from Screener...")
        done = 0
        for i in range(1, len(all_data)):
            row = all_data[i]
            if not row or not row[0].strip(): continue
            symbol = row[0].strip().upper()
            
            if any(k in symbol for k in SKIP_KEYWORDS): continue
            if SINGLE_SYM and symbol != SINGLE_SYM: continue

            col_b = row[1].strip() if len(row) > 1 else ""
            if not FORCE_REFRESH and not SINGLE_SYM:
                if col_b and col_b not in ("0", ""): continue

            done += 1
            print(f"   [{done}] Fetching: {symbol} ...")

            d = fetch_one(symbol)
            if not d: continue

            MEMORY_CACHE[symbol] = d

            data_row = [
                d['net_profit'], d['equity'], d['shares'], d['ebit'], d['roce'], d['debt'], 
                d['dividend'], d['curr_assets'], d['curr_liab'], d['promoters'], d['fii'], 
                d['dii'], d['public'], d['eps'], d['op_profit'], d['fcf'], d['de_ratio'], 
                d['roa'], d['ebitda'], d['pe'], d['book_value'], d['roe'],
                *d['sales_q'], *d['expenses_q'], *d['op_q'],
                *d['other_inc_q'], *d['pbt_q'], *d['np_q'],
                *d['headers_q']
            ]

            try:
                sheet.update(f'B{i+1}:BF{i+1}', [data_row])
            except Exception as e:
                print(f"      ❌ Sheet error: {e}")

            if not SINGLE_SYM: time.sleep(6)

        print(f"✅ Data Scraping & Sheet Update Completed!\n")

    # ---------------------------------------------------------
    # STEP 2 — SHEET + CACHE → FIREBASE
    # ---------------------------------------------------------
    print("🔥 STEP 2: Pushing Data to Firebase...")
    try:
        updated_data = sheet.get_all_values()
        fb_count = 0
        
        for row in updated_data[1:]:
            if not row or not row[0].strip(): continue
            symbol = row[0].strip().upper()
            
            if any(k in symbol for k in SKIP_KEYWORDS): continue
            if SINGLE_SYM and symbol != SINGLE_SYM: continue
            if len(row) < 2 or row[1].strip() == "": continue
            
            doc_data = {
                'symbol': symbol,
                'net_profit': safe(row[1]),
                'equity': safe(row[2]),
                'shares': safe(row[3]),
                'ebit': safe(row[4]),
                'roce': safe(row[5]),
                'debt': safe(row[6]),
                'pe': safe(row[19]),
                'book_value': safe(row[20]),
                'roe': safe(row[21]),
                'updated_at': fstore.SERVER_TIMESTAMP
            }
            
            if symbol in MEMORY_CACHE:
                cached = MEMORY_CACHE[symbol]
                sq = cached['sales_q']
                eq = cached['expenses_q']
                oq = cached['op_q']
                iq = cached['other_inc_q']
                pq = cached['pbt_q']
                nq = cached['np_q']
                hq = cached['headers_q']    # e.g. ["Sep 2024", "Dec 2024", ...]
            else:
                # --firebase flag: Sheet columns thi read karo
                # B(1)..BA(52) = data, BB(52)..BF(56) = headers_q (cols index 52-56)
                sq = [safe(row[i]) for i in range(22, 27)]   # salesQ1-Q5
                eq = [safe(row[i]) for i in range(27, 32)]
                oq = [safe(row[i]) for i in range(32, 37)]
                iq = [safe(row[i]) for i in range(37, 42)]
                pq = [safe(row[i]) for i in range(42, 47)]
                nq = [safe(row[i]) for i in range(47, 52)]
                hq = [row[i].strip() if i < len(row) else '' for i in range(53, 58)]
                hq = [h if h else f'Q{j+1}' for j, h in enumerate(hq)]

            doc_data['quarterly_headers'] = hq

            for i, sfx in enumerate(['Q1','Q2','Q3','Q4','Q5']):
                doc_data[f'salesQ{i+1}']    = sq[i] if i < len(sq) else 0
                doc_data[f'expQ{i+1}']      = eq[i] if i < len(eq) else 0
                doc_data[f'opQ{i+1}']       = oq[i] if i < len(oq) else 0
                doc_data[f'otherIncQ{i+1}'] = iq[i] if i < len(iq) else 0
                doc_data[f'pbtQ{i+1}']      = pq[i] if i < len(pq) else 0
                doc_data[f'npQ{i+1}']       = nq[i] if i < len(nq) else 0
            
            fdb.collection('fundlearn').document(symbol).set(doc_data, merge=True)
            fb_count += 1
            # print(f"   ⬆️ Uploaded to Firebase: {symbol}") # Output clear રાખવા કમેન્ટ કર્યું છે
            
        print(f"🎉 Successfully uploaded {fb_count} stocks to Firebase!\n")
        
    except Exception as e:
        print(f"❌ Firebase Upload Error: {e}\n")

    print("🏁 Market Pulse Backend Engine Completed!")