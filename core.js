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

  updateMarketStatus();
  startClock();
  updateHeaderProfileUI();
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

    // ✅ MARKETDATA: Always fetch once on load since Python script is stopped
    const _mktOpen = typeof isMarketOpen === 'function' ? isMarketOpen() : true;
    
    // 1. Watchlist prices — GAS thi fresh data on load
    await batchFetchStocks(startWl);

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
  startRefresh();
}

// ======================================
// AUTO REFRESH
// ======================================
function startRefresh() {
  startLivePriceEngine();
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
// PROFILE & SETTINGS DRAWER
// ======================================
function openProfileDrawer() {
  const drawer = document.getElementById('profileDrawer');
  if (drawer) {
    drawer.classList.add('open');
    updateHeaderProfileUI();
    if (typeof loadSettingsUI === 'function') loadSettingsUI();
  }
}

function closeProfileDrawer() {
  const drawer = document.getElementById('profileDrawer');
  if (drawer) drawer.classList.remove('open');
}

function updateHeaderProfileUI() {
  const nameEl = document.getElementById('headerProfileName');
  const avatarEl = document.getElementById('headerAvatarLetter');
  const dNameEl = document.getElementById('drawerUserName');
  const dAvatarEl = document.getElementById('drawerAvatarLetter');
  
  const name = (AppState.currentUser && AppState.currentUser.name) ? AppState.currentUser.name : 'Sahaj';
  const initial = name.charAt(0).toUpperCase();

  if (nameEl) nameEl.textContent = name;
  if (avatarEl) avatarEl.textContent = initial;
  if (dNameEl) dNameEl.textContent = name;
  if (dAvatarEl) dAvatarEl.textContent = initial;
}

// ======================================
// MARKETS SUB-TABS (FII/DII/IPO, Indices, Financials)
// ======================================
function switchMarketsSubTab(sub) {
  ['fiidii', 'indices', 'financials'].forEach(id => {
    const btn = document.getElementById('msub-' + id);
    const panel = document.getElementById('markets-panel-' + id);
    if (id === sub) {
      if (btn) btn.classList.add('active');
      if (panel) panel.style.display = 'block';
    } else {
      if (btn) btn.classList.remove('active');
      if (panel) panel.style.display = 'none';
    }
  });

  if (sub === 'fiidii' && typeof initLearnTab === 'function') {
    initLearnTab();
    if (typeof switchLearnMain === 'function') switchLearnMain('marketflow');
  }
  if (sub === 'indices' && typeof renderIndices === 'function') {
    renderIndices();
  }
  if (sub === 'financials' && typeof initLearnTab === 'function') {
    initLearnTab();
    if (typeof switchLearnMain === 'function') switchLearnMain('financial');
  }
}

// ======================================
// PORTFOLIO SUB-TABS (Holdings, History)
// ======================================
function switchPortfolioSubTab(sub) {
  ['holdings', 'history'].forEach(id => {
    const btn = document.getElementById('psub-' + id);
    const panel = document.getElementById('portfolio-panel-' + id);
    if (id === sub) {
      if (btn) btn.classList.add('active');
      if (panel) panel.style.display = 'block';
    } else {
      if (btn) btn.classList.remove('active');
      if (panel) panel.style.display = 'none';
    }
  });

  if (sub === 'holdings' && typeof renderHold === 'function') renderHold();
  if (sub === 'history' && typeof renderHist === 'function') renderHist();
}

// ======================================
// NIVI AI SUB-TABS (Chart, Chat)
// ======================================
function switchNiviSubTab(sub) {
  ['chart', 'chat'].forEach(id => {
    const btn = document.getElementById('nsub-' + id);
    const panel = document.getElementById('nivi-panel-' + id);
    if (id === sub) {
      if (btn) btn.classList.add('active');
      if (panel) panel.style.display = 'block';
    } else {
      if (btn) btn.classList.remove('active');
      if (panel) panel.style.display = 'none';
    }
  });

  if (sub === 'chart' && typeof loadAIChart === 'function') {
    const symInput = document.getElementById('aichart-sym');
    if (symInput && symInput.value) loadAIChart();
  }
  if (sub === 'chat' && typeof renderNews === 'function') renderNews();
}

// ======================================
// TAB SWITCHING (Upgraded v3.0 with Aliases)
// ======================================
function _switchTab(t) {
  // Normalize aliases
  let targetTab = t;
  let subAction = null;

  if (t === 'settings') {
    openProfileDrawer();
    return;
  } else if (t === 'holdings') {
    targetTab = 'portfolio';
    subAction = () => switchPortfolioSubTab('holdings');
  } else if (t === 'history') {
    targetTab = 'portfolio';
    subAction = () => switchPortfolioSubTab('history');
  } else if (t === 'indices') {
    targetTab = 'markets';
    subAction = () => switchMarketsSubTab('indices');
  } else if (t === 'learn') {
    targetTab = 'markets';
    subAction = () => switchMarketsSubTab('fiidii');
  } else if (t === 'aichart') {
    targetTab = 'nivi';
    subAction = () => switchNiviSubTab('chart');
  } else if (t === 'news') {
    targetTab = 'nivi';
    subAction = () => switchNiviSubTab('chat');
  }

  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  const el = document.getElementById(targetTab);
  if (el) el.classList.add('active');

  document.querySelectorAll('.bot-nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + targetTab);
  if (nb) nb.classList.add('active');

  const searchSec = document.getElementById('searchSection');
  if (searchSec) searchSec.style.display = (targetTab === 'watchlist') ? 'block' : 'none';

  const filterBar = document.getElementById('filterBar');
  if (filterBar) filterBar.style.display = (targetTab === 'watchlist') ? 'block' : 'none';

  AppState._curTab = targetTab;

  if (subAction) {
    subAction();
  } else {
    if (targetTab === 'markets') switchMarketsSubTab('fiidii');
    if (targetTab === 'portfolio') switchPortfolioSubTab('holdings');
    if (targetTab === 'nivi') switchNiviSubTab('chart');
  }
}

window.tab       = function(t) { _switchTab(t); };
window.switchTab = function(t) { _switchTab(t); };
window._switchTab = _switchTab;

window.openProfileDrawer      = openProfileDrawer;
window.closeProfileDrawer     = closeProfileDrawer;
window.updateHeaderProfileUI  = updateHeaderProfileUI;
window.switchMarketsSubTab    = switchMarketsSubTab;
window.switchPortfolioSubTab  = switchPortfolioSubTab;
window.switchNiviSubTab       = switchNiviSubTab;


window.startApp              = startApp;
window.startRefresh          = startRefresh;
window.manualRefresh         = manualRefresh;

console.log('✅ core.js loaded successfully');
