// ========================================
// CORE MODULE — RealTradePro v3.0
// ========================================
// ======================================
// DEPENDENCY CHECK
// ======================================
(function checkDependencies() {
  const required = [
    'renderWL',
    'updatePrices',
    'batchFetchStocks',
    'saveWatchlists',
    'renderWLTabs',
    'getMarketStatus'
  ];

  const missing = required.filter(fn => typeof window[fn] !== 'function');

  if (missing.length > 0) {
    console.error('❌ Missing functions:', missing);
    const banner = document.getElementById('errorBanner');
    const msg    = document.getElementById('errorMsg');
    if (banner && msg) {
      msg.innerText    = 'Loading error: ' + missing.join(', ') + ' - Please refresh';
      banner.style.display = 'block';
    }
  } else {
    console.log('✅ All dependencies loaded');
  }
})();

// ======================================
// START APP
// ======================================
async function startApp() {
  // Init AppState guards
  if (!AppState.lastUpdatedMap)   AppState.lastUpdatedMap  = {};
  if (!AppState._globalCache)     AppState._globalCache    = {};
  if (!AppState._globalCacheTime) AppState._globalCacheTime = 0;

  // 🔥 NEW CACHE LOGIC: App load thata j local storage mathi juna prices pacha lavi lo
  try {
    const savedCache = localStorage.getItem('rtp_price_cache');
    if (savedCache) {
      AppState.cache = JSON.parse(savedCache);
      console.log('✅ Loaded previous prices from LocalStorage');
    } else {
      if (!AppState.cache) AppState.cache = {};
    }
  } catch(e) { 
    if (!AppState.cache) AppState.cache = {}; 
  }

  updateMarketStatus();
  startClock();
  setInterval(updateMarketStatus, 60000);

  renderWLTabs();

  // ✅ MARKETDATA: Tier-1 LocalStorage instant load — user zero wait kare
  // Market closed hoy to Firebase thi data aave, GAS call nahi thay
  if (typeof initMarketData === 'function') {
    await initMarketData();
  }

  showLoader('Loading...');

  try {
    const startWl = AppState.watchlists[AppState.currentWL]?.stocks || AppState.wl;

    // ✅ MARKETDATA: GAS call sirf market open hoy tyare
    const _mktOpen = typeof isMarketOpen === 'function' ? isMarketOpen() : true;
    if (_mktOpen) {
      // 1. Watchlist prices — GAS thi fresh data
      await batchFetchStocks(startWl);
    }
    // Market closed hoy to initMarketData() already Firebase/LocalCache inject kari chuke — skip GAS

    renderWL();
    if (typeof updatePriceTicker === 'function') updatePriceTicker();

    // 2. Indices (skip GIFT NIFTY here — handled by startGiftNiftyUpdates)
    const nonGiftIndices = AppState.indicesList.filter(i => i.sym !== 'NIFTY1!');
    if (_mktOpen) {
      await Promise.all(nonGiftIndices.map(i => fetchFull(i.sym, true)));
    }

    // 3. GIFT NIFTY via its dedicated function (reads gift_nifty Firestore doc)
    if (typeof startGiftNiftyUpdates === 'function') startGiftNiftyUpdates();

    // 4. Render header
    if (typeof renderHeaderStrip  === 'function') renderHeaderStrip();
    if (typeof updateHeaderIndices === 'function') updateHeaderIndices();

  } catch(e) {
    console.error('[startApp] Initial fetch failed:', e);
  }

  // Technical alerts after prices loaded
  setTimeout(() => {
    if (typeof runAllTechnicalAlerts === 'function') runAllTechnicalAlerts();
  }, 3000);

  hideLoader();

  // ✅ MARKETDATA: Auto refresh sirf market open hoy tyare
  if (typeof isMarketOpen === 'function' && isMarketOpen()) {
    if (typeof startAutoRefresh === 'function') startAutoRefresh(60000);
  }

  startRefresh();
}
// ======================================
// AUTO REFRESH
// ======================================
function startRefresh() {
  if (AppState.refreshInterval) clearInterval(AppState.refreshInterval);

  // ✅ GAS Warmup — active URL warm રાખે, cold start avoid
  if (AppState._warmupInterval) clearInterval(AppState._warmupInterval);
AppState._warmupInterval = setInterval(() => {
    if (typeof isMarketOpen === 'function' && !isMarketOpen()) return;
    const urls = getEnabledGASUrls();
    if (urls.length > 0) {
      fetch(urls[0] + '?type=ping', { signal: AbortSignal.timeout(3000) }).catch(() => {});
    }
  }, 20000); // દર 20 sec — GAS VM alive રાખે (market open only)

  AppState.refreshInterval = setInterval(() => {
    if (getMarketStatus().open) {
      if (typeof updatePrices === 'function') updatePrices();
    }
  }, (parseInt(localStorage.getItem('refreshSec')) || 8) * 1000);
}

// ======================================
// MANUAL REFRESH
// ======================================
async function manualRefresh() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.style.opacity = '0.4'; btn.style.pointerEvents = 'none'; }

  showLoader('Refreshing...');

  // Bust cache
  for (let k in AppState.cache) AppState.cache[k].time = 0;

  const refreshWl = AppState.watchlists[AppState.currentWL]?.stocks || AppState.wl;
  const nonGiftIndices = AppState.indicesList.filter(i => i.sym !== 'NIFTY1!');

  await Promise.all([
    batchFetchStocks(refreshWl),
    Promise.all(nonGiftIndices.map(i => fetchFull(i.sym, true))),
    typeof updateGiftNifty === 'function' ? updateGiftNifty() : Promise.resolve()
  ]);

  if (typeof renderWL            === 'function') renderWL();
  if (typeof updatePriceTicker   === 'function') updatePriceTicker();
  if (typeof renderHeaderStrip   === 'function') renderHeaderStrip();
  if (typeof updateHeaderIndices === 'function') updateHeaderIndices();

  hideLoader();
  if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  showPopup('Refreshed!');
}

// ======================================
// TAB SWITCHING
// ======================================
function _switchTab(t) {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  const targetTab = document.getElementById(t);
  if (targetTab) targetTab.classList.add('active');

  document.querySelectorAll('.bot-nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + t);
  if (nb) nb.classList.add('active');

  const searchSec = document.getElementById('searchSection');
  if (searchSec) searchSec.style.display = (t === 'watchlist') ? 'block' : 'none';

  const filterBar = document.getElementById('filterBar');
  if (filterBar) filterBar.style.display = (t === 'watchlist') ? 'block' : 'none';

  AppState._curTab = t;

  if (t === 'holdings' && typeof renderHold      === 'function') renderHold();
  if (t === 'history'  && typeof renderHist      === 'function') renderHist();
  if (t === 'indices'  && typeof renderIndices   === 'function') renderIndices();
  if (t === 'alerts'   && typeof renderAlerts    === 'function') renderAlerts();
  if (t === 'learn'    && typeof initLearnTab    === 'function') initLearnTab();
  if (t === 'news'     && typeof renderNews      === 'function') renderNews();
  if (t === 'settings' && typeof loadSettingsUI  === 'function') loadSettingsUI();
}

window.tab       = function(t) { _switchTab(t); };
window.switchTab = function(t) { _switchTab(t); };
window._switchTab = _switchTab;

// ======================================
// BACK BUTTON HANDLER
// ======================================
history.pushState(null, '', window.location.href);
window.addEventListener('popstate', () => {
  const detailModal = document.getElementById('detailModal');
  const modal       = document.getElementById('modal');
  const exitModal   = document.getElementById('exitModal');

  if (detailModal && !detailModal.classList.contains('hidden')) {
    if (typeof closeDetail === 'function') closeDetail();
    history.pushState(null, '', window.location.href);
    return;
  }
  if (modal && !modal.classList.contains('hidden')) {
    if (typeof closeModal === 'function') closeModal();
    history.pushState(null, '', window.location.href);
    return;
  }
  if (exitModal) exitModal.classList.remove('hidden');
  history.pushState(null, '', window.location.href);
});
// ======================================
// PLACEHOLDER STUBS
// ======================================
function preloadAllFundamentalsFromFirebase() {}
function monitorSystemHealth() {}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.startApp              = startApp;
window.startRefresh          = startRefresh;
window.manualRefresh         = manualRefresh;

console.log('✅ core.js loaded successfully');
