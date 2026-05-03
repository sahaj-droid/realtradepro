// ========================================
// API MODULE — RealTradePro v3.0
// ========================================

// Global Symbols
const GLOBAL_SYMS = {
  'DOW': '^DJI', 
  'NASDAQ': '^IXIC', 
  'S&P500': '^GSPC',
  'CRUDE': 'CL=F', 
  'GOLD': 'GC=F', 
  'USD/INR': 'INR=X', 
  'VIX': '^INDIAVIX'
};

// GAS API URLs
const API = "https://script.google.com/macros/s/AKfycbxW8rj5alGlk3JckSK0_NRGjOpqFhGaC7ifEfa1VnLEtnBYvwO2jZ2nu_0BkH-X7wSF/exec";
const API2 = "https://script.google.com/macros/s/AKfycbwEltygGQ4C2LIfYSAJcKu_gFQF1iNciZkZytG020yDoyktpbz4aNKsEqSj1wKXm7kUAQ/exec";
const API3 = "https://script.google.com/macros/s/AKfycbycNOhJtgcjt4RTMSag5ruZvPhcNaKAlXwAdiQvoBDGfvmDIEKKHDQiMIAIpmJq2kwXTA/exec";
const API4 = "https://script.google.com/macros/s/AKfycbwr9sKAbHjmVf48Ihp2PJq8xjNv-D6kglwFKqY8Uxwke99icv5JCNa6RiABdmm3G_lP/exec";
const API5 = "https://script.google.com/macros/s/AKfycbzc6tzmWVfGbpMa7ocVxg2bYlutvTRbPRbEZrqz2WtLib2MAqUCzsUz-Q9XACXDz34O/exec";

let _urlRotationIndex = 0;

// Returns only URLs that are toggled ON (default: ON)
function getEnabledGASUrls() {
  const all = [
    { url: localStorage.getItem('customAPI')  || API,  key: 'gasUrlEnabled_1' },
    { url: localStorage.getItem('customAPI2') || API2, key: 'gasUrlEnabled_2' },
    { url: localStorage.getItem('customAPI3') || API3, key: 'gasUrlEnabled_3' },
    { url: localStorage.getItem('customAPI4') || API4, key: 'gasUrlEnabled_4' },
    { url: localStorage.getItem('customAPI5') || API5, key: 'gasUrlEnabled_5' },
  ];
  const enabled = all.filter(e => e.url && localStorage.getItem(e.key) !== 'false').map(e => e.url);
  return enabled.length > 0 ? enabled : [API]; // fallback to primary always
}

function getActiveGASUrl() {
  const urls = getEnabledGASUrls();
  const url = urls[_urlRotationIndex % urls.length];
  _urlRotationIndex++;
  return url;
}

// ✅ Token append helper — every GAS call ma use karvo
function _appendToken(url) {
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + '_t=rtp_2026_sahaj';
}

// ======================================
// NORMALIZE API RESPONSE
// ======================================
function _N(d) {
  if (!d) return null;
  const price = d.regularMarketPrice || d.ltp || d.price || d.close || 0;
  if (!price) return null;
  const prevClose = d.chartPreviousClose || d.regularMarketPreviousClose || d.prevClose || d.prev_close || d.prev || price;
  const open = (d.regularMarketOpen != null && d.regularMarketOpen > 0) ? d.regularMarketOpen : (d.open != null && d.open > 0 ? d.open : price);
  const high = d.regularMarketDayHigh || d.high || price;
  const low = d.regularMarketDayLow || d.low || price;
  const h52 = d.fiftyTwoWeekHigh || d.week52High || d.high52 || d.h52 || high;
  const l52 = d.fiftyTwoWeekLow || d.week52Low || d.low52 || d.l52 || low;
  const volume = d.regularMarketVolume || d.today_volume || d.volume || 0;
  const avgVol = d.averageDailyVolume3Month || d.avg_vol_3m || 0;
  const change = d.regularMarketChange ?? d.change ?? (price - prevClose);
  const changePct = d.regularMarketChangePercent ?? d.change_pct ?? d.changePct ?? (prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0);

  return {
    regularMarketPrice: price,
    chartPreviousClose: prevClose,
    regularMarketOpen: open,
    regularMarketDayHigh: high,
    regularMarketDayLow: low,
    fiftyTwoWeekHigh: h52,
    fiftyTwoWeekLow: l52,
    regularMarketVolume: volume,
    averageDailyVolume3Month: avgVol,
    regularMarketChange: parseFloat(change.toFixed(2)),
    regularMarketChangePercent: parseFloat(changePct.toFixed(2)),
    ltp: price,
    price: price,
    prevClose: prevClose,
    high: high,
    low: low,
    volume: volume,
    _source: d._source || 'normalized'
  };
}

function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

// ======================================
// BATCH FETCH STOCKS
// ======================================
async function batchFetchStocks(symbols, isIndex = false) {
  if (!symbols || symbols.length === 0) return;
  const syms = symbols.map(s => isIndex ? s : s + '.NS').join(',');
  const urls = getEnabledGASUrls();
  for (let apiUrl of urls) {
    try {
      const r = await fetchWithTimeout(_appendToken(`${apiUrl}?type=batch&s=${syms}`), 6000);
      const j = await r.json();
      if (!j || j.error) continue;
      
      let stored = 0;
      Object.entries(j).forEach(([sym, gasData]) => {
        const normalized = _N(gasData);
        if (!normalized) return;
        const cacheKey = isIndex ? sym : sym.replace('.NS', '');
        AppState.cache[cacheKey] = { data: normalized, time: Date.now() };
        if (AppState.lastUpdatedMap) AppState.lastUpdatedMap[cacheKey] = Date.now();
        stored++;
      });
      
      if (stored > 0) {
        // 🔥 NEW CACHE LOGIC: Aakhi watchlist na data aavta j tene permanent save kari do
        try { localStorage.setItem('rtp_price_cache', JSON.stringify(AppState.cache)); } catch(e) {}
        return;
      }
    } catch (e) {}
  }
}

async function fetchFull(sym, isIndex = false) {
  const key = sym;
  const symbol = isIndex ? sym : sym + '.NS';
  const encodedSymbol = symbol.replace(/\^/g, '%5E');
  
  if (AppState.cache[key] && (Date.now() - AppState.cache[key].time < (AppState.CACHE_TIME || 60000))) {
    return AppState.cache[key].data;
  }
  
  const urls = getEnabledGASUrls();
  for (let apiUrl of urls) {
    try {
      const r = await fetchWithTimeout(_appendToken(`${apiUrl}?s=${encodedSymbol}`), 6000);
      const j = await r.json();
      if (j.error || !j.chart || !j.chart.result) continue;
      
      const data = j.chart.result[0].meta;
      AppState.cache[key] = { data, time: Date.now() };
      if (AppState.lastUpdatedMap) AppState.lastUpdatedMap[key] = Date.now();
      
      // 🔥 NEW CACHE LOGIC: Nava prices aavta j tene permanent save kari do
      try { 
        localStorage.setItem('rtp_price_cache', JSON.stringify(AppState.cache)); 
      } catch(e) { }
      
      return data;
    } catch (e) {}
  }
  return null;
}

// ======================================
// FETCH FUNDAMENTALS
// ======================================
async function fetchFundamentals(sym) {
  const cleanSym = sym.replace(/\.NS$/i, '').replace(/\.BO$/i, '').toUpperCase();

  // 1. Firebase fundlearn cache (cross-device)
  if (window._firebaseFundCache && window._firebaseFundCache[cleanSym]) {
    const raw = window._firebaseFundCache[cleanSym];
    return {
      pe: raw.pe != null ? parseFloat(raw.pe).toFixed(2) : '--',
      eps: raw.eps != null ? '₹' + parseFloat(raw.eps).toFixed(2) : '--',
      marketCap: raw.marketCap ? formatMarketCap(raw.marketCap) : '--',
      bookValue: raw.bookValue != null ? '₹' + parseFloat(raw.bookValue).toFixed(2) : '--',
      volume: '--',
      _source: 'firebase'
    };
  }

  // 2. localStorage cache (7 day TTL)
  const FUND_KEY = 'fundCache6_' + sym;
  try {
    const stored = JSON.parse(localStorage.getItem(FUND_KEY) || 'null');
    if (stored && stored.ts && stored.data && (Date.now() - stored.ts) < 7 * 86400000) {
      return stored.data;
    }
  } catch (e) {}

  // 3. Extract from price cache (Yahoo fields)
  const _cacheD = AppState.cache[sym] && AppState.cache[sym].data;
  let pe = '--', eps = '--', mktCap = '--', volume = '--';

  if (_cacheD) {
    if (_cacheD.trailingPE && _cacheD.trailingPE > 0) pe = parseFloat(_cacheD.trailingPE).toFixed(2);
    if (_cacheD.epsTrailingTwelveMonths) eps = '₹' + parseFloat(_cacheD.epsTrailingTwelveMonths).toFixed(2);
    if (_cacheD.marketCap) mktCap = formatMarketCap(_cacheD.marketCap);
    if (_cacheD.regularMarketVolume) volume = formatVolume(_cacheD.regularMarketVolume);
  }

  const data = { pe, eps, marketCap: mktCap, volume, _source: 'yahoo' };
  try {
    localStorage.setItem(FUND_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {}
  return data;
}

// ======================================
// FORMAT HELPERS
// ======================================
function formatMarketCap(v) {
  if (!v || isNaN(v)) return '--';
  if (v >= 1e12) return '₹' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9)  return '₹' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e7)  return '₹' + (v / 1e7).toFixed(2) + 'Cr';
  return '₹' + v.toLocaleString('en-IN');
}

function formatVolume(v) {
  if (!v || isNaN(v)) return '--';
  if (v >= 1e7) return (v / 1e7).toFixed(2) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(2) + 'L';
  return v.toLocaleString('en-IN');
}

// ======================================
// FETCH HISTORY
// ======================================
async function fetchHistory(sym, range = '30d', interval = '1d') {
  const DAY_KEY = 'histData_' + sym + '_' + range + '_' + interval;
  const today = new Date().toISOString().split('T')[0];

  try {
    const stored = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
    if (stored && stored.date === today && stored.data) return stored.data;
  } catch (e) {}

  const urls = getEnabledGASUrls().slice(0, 3);
  for (let apiUrl of urls) {
    try {
      const histSym = sym.startsWith('^') ? sym : sym + '.NS';
      const r = await fetchWithTimeout(_appendToken(`${apiUrl}?type=history&s=${histSym}&range=${range}&interval=${interval}`), 10000);
      const j = await r.json();
      if (j.error || !j.dates || !j.close) continue;
      if (j.close.length < 14) continue;
      const data = {
        dates: j.dates,
        open: j.open || j.close,
        high: j.high || j.close,
        low: j.low || j.close,
        close: j.close,
        volume: j.volume || []
      };
      try { localStorage.setItem(DAY_KEY, JSON.stringify({ date: today, data })); } catch (e) {}
      return data;
    } catch (e) {}
  }
  return null;
}

// ======================================
// FETCH GLOBAL MARKETS
// ======================================
async function fetchGlobalMarkets() {
  const now = Date.now();
  const TTL = 60000;
  if (AppState._globalCacheTime && (now - AppState._globalCacheTime) < TTL && Object.keys(AppState._globalCache || {}).length > 0) {
    return AppState._globalCache;
  }
  const syms = Object.values(GLOBAL_SYMS).join(',');
  const urls = getEnabledGASUrls();
  for (const apiUrl of urls) {
    try {
      const r = await fetchWithTimeout(_appendToken(`${apiUrl}?type=batch&s=${encodeURIComponent(syms)}`), 8000);
      const data = await r.json();
      if (data && !data.error && Object.keys(data).length > 0) {
        AppState._globalCache = data;
        AppState._globalCacheTime = now;
        return data;
      }
    } catch (e) {}
  }
  return {};
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.getEnabledGASUrls = getEnabledGASUrls;
window.batchFetchStocks = batchFetchStocks;
window.fetchFull = fetchFull;
window.fetchFundamentals = fetchFundamentals;
window.fetchHistory = fetchHistory;
window.fetchGlobalMarkets = fetchGlobalMarkets;
window.getActiveGASUrl = getActiveGASUrl;

console.log('✅ api.js loaded successfully');
