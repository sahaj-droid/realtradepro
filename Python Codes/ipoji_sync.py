# ==========================================
# FILE: ipoji_sync.py
# Engine: Exact IPO Ji Live Scraper & Firebase Push (v5.0)
# ==========================================
import sys
import requests
from bs4 import BeautifulSoup
import re
import json
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def get_session():
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    })
    return s

def parse_listed(url, segment, session):
    try:
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')
        items = []
        for card in soup.find_all(class_='ipo-card'):
            text = ' | '.join(card.stripped_strings).replace('\u20b9', 'Rs.')
            title_el = card.find(['h2', 'h3', 'h4', 'span', 'a'])
            if not title_el:
                continue
            name = title_el.get_text(strip=True)
            
            nse_m = re.search(r'NSE\s*:\s*([A-Z0-9\-]+)', text)
            bse_m = re.search(r'BSE\s*:\s*([0-9]+)', text)
            nse_sym = nse_m.group(1) if nse_m else ''
            bse_code = bse_m.group(1) if bse_m else ''
            sym = nse_sym or (bse_code if bse_code else re.sub(r'[^A-Z0-9]', '', name.split()[0].upper())[:10])
            
            offer_m = re.search(r'Offer Price\s*\|\s*Rs\.?([0-9\-\.]+)', text)
            offer = offer_m.group(1) if offer_m else ''
            
            list_m = re.search(r'Listing Price\s*:?\s*Rs\.?([0-9\.]+)\s*(?:at\s*(?:a\s*)?([^\|]+))?', text)
            list_p = list_m.group(1) if list_m else ''
            prem = list_m.group(2).strip() if list_m and list_m.group(2) else ''
            
            gain_pct = 0.0
            try:
                o_num = float(offer.split('-')[-1]) if offer else 0
                l_num = float(list_p) if list_p else 0
                if o_num > 0 and l_num > 0:
                    gain_pct = round(((l_num - o_num) / o_num) * 100, 2)
            except Exception:
                pass
                
            date_m = re.search(r'([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})\s*\|\s*[^\s\|]+\s*\|\s*([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})', text)
            dates = f"{date_m.group(1)} - {date_m.group(2)}" if date_m else ''
            if not dates:
                d_single = re.search(r'([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})', text)
                dates = d_single.group(1) if d_single else 'Recent'
            
            sub_m = re.search(r'Subscription\s*\|\s*([0-9\.]+x)', text)
            sub = sub_m.group(1) if sub_m else ''
            
            size_m = re.search(r'Issue Size\s*\|\s*Rs\.?([0-9\.]+\s*Cr)', text)
            size = size_m.group(1) if size_m else ''
            
            if not prem:
                prem = 'At Par' if 'at Par' in text else (f"{gain_pct:+.2f}%" if gain_pct != 0 else 'At Par')
            
            items.append({
                'name': name,
                'symbol': sym,
                'nseSymbol': nse_sym,
                'bseCode': bse_code,
                'offerPrice': f"Rs.{offer}" if offer else '--',
                'listingPrice': f"Rs.{list_p}" if list_p else '--',
                'gainPct': gain_pct,
                'premium': prem,
                'dates': dates,
                'subscription': sub or '--',
                'issueSize': f"Rs.{size}" if size else '--',
                'segment': segment,
                'exchange': 'NSE / BSE' if segment == 'Mainboard' else ('NSE SME' if 'NSE' in text else 'BSE SME')
            })
        return items
    except Exception as e:
        print(f"Error parsing listed from {url}: {e}")
        return []

def parse_current(url, segment, session):
    try:
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')
        items = []
        for card in soup.find_all(class_='ipo-card'):
            text = ' | '.join(card.stripped_strings).replace('\u20b9', 'Rs.')
            title_el = card.find(['h2', 'h3', 'h4', 'span', 'a'])
            if not title_el:
                continue
            name = title_el.get_text(strip=True)
            
            offer_m = re.search(r'Offer Price\s*\|\s*Rs\.?([0-9\-\.]+)', text)
            offer = offer_m.group(1) if offer_m else ''
            
            lot_m = re.search(r'Lot Size\s*\|\s*([0-9]+)', text)
            lot = lot_m.group(1) if lot_m else ''
            
            date_m = re.search(r'([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})\s*\|\s*[^\s\|]+\s*\|\s*([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})', text)
            dates = f"{date_m.group(1)} - {date_m.group(2)}" if date_m else ''
            if not dates:
                d_single = re.search(r'([A-Za-z]{3}\s+[0-9]{1,2},\s+[0-9]{4})', text)
                dates = d_single.group(1) if d_single else 'TBA'
            
            sub_m = re.search(r'Subscription\s*\|\s*([0-9\.]+x)', text)
            sub = sub_m.group(1) if sub_m else ''
            
            size_m = re.search(r'Issue Size\s*\|\s*Rs\.?([0-9\.]+\s*Cr)', text)
            size = size_m.group(1) if size_m else ''
            
            status = 'Live' if 'Live' in text else ('Closed' if 'Closed' in text else ('Allotment Out' if 'Allotment Out' in text else ('Allotment Awaited' if 'Allotment' in text else 'Upcoming')))
            sym = re.sub(r'[^A-Z0-9]', '', name.split()[0].upper())[:10]
            
            items.append({
                'name': name,
                'symbol': sym,
                'price': f"Rs.{offer}" if offer else 'N/A',
                'lot': f"{lot} Shares" if lot else '--',
                'dates': dates,
                'size': f"Rs.{size}" if size else '--',
                'sub': sub or '--',
                'status': status,
                'segment': segment,
                'exchange': 'NSE / BSE' if segment == 'Mainboard' else ('NSE SME' if 'NSE' in text else 'BSE SME')
            })
        return items
    except Exception as e:
        print(f"Error parsing current from {url}: {e}")
        return []

def get_exact_ipoji_data():
    s = get_session()
    main_listed = parse_listed('https://ipoji.com/ipo/listed-ipo', 'Mainboard', s)
    sme_listed = parse_listed('https://ipoji.com/sme-ipo/listed-ipo', 'SME', s)
    main_current = parse_current('https://ipoji.com/ipo/current-ipo', 'Mainboard', s)
    sme_current = parse_current('https://ipoji.com/sme-ipo/current-ipo', 'SME', s)
    
    return {
        'recentIpos': main_listed + sme_listed,
        'activeIpos': main_current + sme_current,
        'source': 'ipoji_live',
        'updatedAt': time.strftime('%d-%b-%Y %H:%M IST')
    }

def sync_ipoji_to_firebase(db):
    try:
        data = get_exact_ipoji_data()
        if db:
            db.collection('market_stats').document('ipos').set(data, merge=True)
            print(f"Synced {len(data['recentIpos'])} listed and {len(data['activeIpos'])} active IPOs directly to Firebase!")
        return data
    except Exception as e:
        print(f"IPO Ji Sync error: {e}")
        return None

if __name__ == '__main__':
    data = get_exact_ipoji_data()
    print(f"Successfully scraped: {len(data['recentIpos'])} listed, {len(data['activeIpos'])} active IPOs")
