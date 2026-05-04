// ========================================
// MARKETDATA MODULE — RealTradePro v1.0
// Smart Data Layer — 3 tier system:
//   Tier 1: LocalStorage (instant load)
//   Tier 2: GAS Call (market hours only)
//   Tier 3: Firebase livemarket (after hours)
// No touch to existing files
// ========================================

const MARKET_CACHE_KEY  = 'mktDataCache_v1';   // localStorage key
const MARKET_CACHE_META = 'mktDataMeta_v1';    // timestamp + source meta
const MARKET_CACHE_TTL  = 60 * 1000;           // 60 sec — market hours refresh
const FIREBASE_COLL     = 'livemarket';         // Firebase collection

// ======================================
// ⏰ MARKET HOURS CHECK
// NSE: 9:15 AM – 3:30 PM IST, Mon–Fri
// ======================================
function isMarketOpen() {
  const now = new Date();

  // IST = UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const day  = ist.getDay();   // 0=Sun, 6=Sat
  const hour = ist.getHours();
  const min  = ist.getMinutes();
  const mins = hour * 60 + min; // total minutes since midnight

  const open  = 9 * 60 + 15;   // 9:15 AM
  const close = 15 * 60 + 30;  // 3:30 PM

  if (day === 0 || day === 6) return false;  // Weekend
  return mins >= open && mins < close;
}

// ======================================
// 📊 MARKET STATUS — UI badge mate
// Returns: { open, label, color, bg }
// ======================================
function getMarketStatus() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const day  = ist.getDay();
  const hour = ist.getHours();
  const min  = ist.getMinutes();
  const mins = hour * 60 + min;

  const open  = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  const preOpen = 9 * 60 + 0;

  if (day === 0 || day === 6) {
    return { open: false, label: '🔴 Weekend', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  }
  if (mins >= open && mins < close) {
    return { open: true,  label: '🟢 Market Open',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
  }
  if (mins >= preOpen && mins < open) {
    return { open: false, label: '🟡 Pre-Open',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  }
  if (mins >= close) {
    return { open: false, label: '🔴 Market Closed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  }
  return   { open: false, label: '🔴 Market Closed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
}

// ======================================
// 💾 SAVE TO LOCALSTORAGE
// GAS data aave tyare call karo
// ======================================
function saveToLocalCache(cacheData) {
  try {
    const meta = {
      ts:     Date.now(),
      source: 'GAS',
      count:  Object.keys(cacheData).length
    };
    localStorage.setItem(MARKET_CACHE_KEY,  JSON.stringify(cacheData));
    localStorage.setItem(MARKET_CACHE_META, JSON.stringify(meta));
    console.log(`[MarketData] 💾 LocalStorage saved — ${meta.count} symbols`);
  } catch (e) {
    console.warn('[MarketData] LocalStorage save failed:', e.message);
  }
}

// ======================================
// ⚡ TIER 1 — LOAD FROM LOCALSTORAGE
// Instant — 0ms — previous session data
// ======================================
function loadFromLocalCache() {
  try {
    const raw  = localStorage.getItem(MARKET_CACHE_KEY);
    const meta = JSON.parse(localStorage.getItem(MARKET_CACHE_META) || 'null');
    if (!raw || !meta) return 0;

    const cacheData = JSON.parse(raw);
    let count = 0;

    Object.entries(cacheData).forEach(([sym, normalized]) => {
      if (!AppState.cache[sym] || !AppState.cache[sym].data) {
        AppState.cache[sym] = { data: normalized, time: meta.ts };
        count++;
      }
    });

    const ageMin = Math.round((Date.now() - meta.ts) / 60000);
    console.log(`[MarketData] ⚡ LocalCache loaded — ${count} symbols (${ageMin}m old, source: ${meta.source})`);
    return count;
  } catch (e) {
    console.warn('[MarketData] LocalCache read failed:', e.message);
    return 0;
  }
}

// ======================================
// 🔥 TIER 3 — LOAD FROM FIREBASE
// After market hours — livemarket collection
// ======================================
async function loadFromFirebase() {
  try {
    // Firebase SDK check
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      console.warn('[MarketData] Firebase SDK not available');
      return 0;
    }

    const db   = firebase.firestore();
    const snap = await db.collection(FIREBASE_COLL).get();

    if (snap.empty) {
      console.warn('[MarketData] Firebase livemarket collection empty');
      return 0;
    }

    let count = 0;
    const cacheToSave = {};

    snap.forEach(doc => {
      const sym  = doc.id;
      const data = doc.data();

      // _N() normalizer use karo — same as api.js
      const normalized = typeof _N === 'function' ? _N(data) : data;
      if (!normalized) return;

      // AppState.cache ma inject
      AppState.cache[sym] = { data: normalized, time: Date.now() };
      cacheToSave[sym]    = normalized;
      count++;
    });

    // Firebase data pun localStorage ma save — next load mate
    if (count > 0) {
      try {
        const meta = { ts: Date.now(), source: 'Firebase', count };
        localStorage.setItem(MARKET_CACHE_KEY,  JSON.stringify(cacheToSave));
        localStorage.setItem(MARKET_CACHE_META, JSON.stringify(meta));
      } catch (e) {}
    }

    console.log(`[MarketData] 🔥 Firebase loaded — ${count} symbols`);
    return count;

  } catch (e) {
    console.warn('[MarketData] Firebase load failed:', e.message);
    return 0;
  }
}

// ======================================
// 🚀 INIT — Entry Point
// core.js thi call karvo: initMarketData()
// ======================================
async function initMarketData() {
  console.log('[MarketData] 🚀 Init started...');

  const status = getMarketStatus();
  console.log(`[MarketData] Status: ${status.label}`);

  // ── TIER 1: LocalStorage — instant load ──
  const localCount = loadFromLocalCache();
  if (localCount > 0) {
    // Turant UI render karo — user zero wait kare
    if (typeof renderWL === 'function') renderWL();
    if (typeof renderHeaderStrip === 'function') renderHeaderStrip();
    console.log('[MarketData] ⚡ UI rendered from LocalCache instantly');
  }

  // ── TIER 2 or 3 depending on market status ──
  if (status.open) {
    // Market OPEN → background ma GAS call
    console.log('[MarketData] 📡 Market open — GAS fetch in background...');
    _backgroundGASFetch();
  } else {
    // Market CLOSED → Firebase thi fresh data
    console.log('[MarketData] 🔥 Market closed — loading from Firebase...');
    const fbCount = await loadFromFirebase();

    if (fbCount > 0) {
      // Firebase data aavyu — UI refresh
      if (typeof renderWL === 'function') renderWL();
      if (typeof updateHeaderIndices === 'function') updateHeaderIndices();
      console.log(`[MarketData] ✅ UI updated from Firebase — ${fbCount} symbols`);
    } else if (localCount === 0) {
      // Na local, na firebase — last resort GAS call
      console.log('[MarketData] ⚠️ No cache/Firebase — trying GAS as last resort...');
      _backgroundGASFetch();
    }
  }

  // Market status badge UI ma show karo
  _renderMarketStatusBadge(status);
}

// ======================================
// 📡 BACKGROUND GAS FETCH
// Market open hoy tyare — UI block na thay
// GAS data aave to LocalStorage update
// ======================================
async function _backgroundGASFetch() {
  try {
    const wl = AppState.watchlists?.[AppState.currentWL]?.stocks
            || AppState.wl
            || [];

    if (!wl.length) {
      console.warn('[MarketData] Watchlist empty — GAS fetch skipped');
      return;
    }

    // Existing batchFetchStocks use karo — api.js thi
    if (typeof batchFetchStocks !== 'function') {
      console.warn('[MarketData] batchFetchStocks not available');
      return;
    }

    await batchFetchStocks(wl, false);

    // GAS data aavyu — localStorage ma save karo
    const cacheToSave = {};
    wl.forEach(sym => {
      if (AppState.cache[sym]?.data) {
        cacheToSave[sym] = AppState.cache[sym].data;
      }
    });

    if (Object.keys(cacheToSave).length > 0) {
      saveToLocalCache(cacheToSave);
    }

    // UI silently update
    if (typeof renderWL === 'function') renderWL();
    if (typeof updateHeaderIndices === 'function') updateHeaderIndices();
    console.log('[MarketData] ✅ Background GAS fetch complete');

  } catch (e) {
    console.warn('[MarketData] Background GAS fetch failed:', e.message);
  }
}

// ======================================
// 🏷️ MARKET STATUS BADGE
// Header ma badge show karo
// Existing element hoy to update, nahi to skip
// ======================================
function _renderMarketStatusBadge(status) {
  // Jо existing badge element hoy to j update karo
  const badge = document.getElementById('marketStatusBadge');
  if (!badge) return;  // index.html ma element nathi to skip

  badge.textContent   = status.label;
  badge.style.color   = status.color;
  badge.style.background = status.bg;
}

// ======================================
// 🔄 AUTO REFRESH — Market Open hoy tyare
// Har 60 sec ma background refresh
// ======================================
let _autoRefreshInterval = null;

function startAutoRefresh(intervalMs = 60000) {
  if (_autoRefreshInterval) clearInterval(_autoRefreshInterval);
  if (!isMarketOpen()) {
    console.log('[MarketData] Market closed — auto refresh not started');
    return;
  }
  _autoRefreshInterval = setInterval(() => {
    if (!isMarketOpen()) {
      clearInterval(_autoRefreshInterval);
      console.log('[MarketData] Market closed — auto refresh stopped');
      return;
    }
    _backgroundGASFetch();
  }, intervalMs);
  console.log(`[MarketData] 🔄 Auto refresh started — every ${intervalMs / 1000}s`);
}

function stopAutoRefresh() {
  if (_autoRefreshInterval) {
    clearInterval(_autoRefreshInterval);
    _autoRefreshInterval = null;
  }
}

// ======================================
// REGISTER TO WINDOW
// ======================================
window.initMarketData      = initMarketData;
window.isMarketOpen        = isMarketOpen;
window.getMarketStatus     = getMarketStatus;
window.loadFromFirebase    = loadFromFirebase;
window.loadFromLocalCache  = loadFromLocalCache;
window.saveToLocalCache    = saveToLocalCache;
window.startAutoRefresh    = startAutoRefresh;
window.stopAutoRefresh     = stopAutoRefresh;

console.log('✅ marketdata.js loaded | Tier: LocalStorage → GAS → Firebase');
