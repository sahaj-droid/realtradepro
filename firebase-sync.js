// ========================================
// FIREBASE SYNC MODULE — RealTradePro v3.0
// Handles: Save/Load user data to/from Firebase, Auto-sync debouncing
// ========================================

// ======================================
// SAVE USER DATA TO FIREBASE
// ======================================
async function saveUserData(field = null) {
  if (!AppState.currentUser) return;
  if (AppState._syncInProgress) return;
  
  AppState._syncInProgress = true;
  
  try {
    const userRef = db.collection('users').doc(AppState.currentUser.userId);
    const data = {};
    
    if (field === null || field === 'watchlists') {
      data.watchlists = AppState.watchlists;
    }
    if (field === null || field === 'holdings') {
      data.holdings = AppState.h;
    }
    if (field === null || field === 'history') {
      data.history = AppState.hist;
    }
    if (field === null || field === 'alerts') {
      data.alerts = AppState.alerts;
    }
    if (field === null || field === 'settings') {
      data.settings = {
        apiUrl: localStorage.getItem('customAPI') || '',
        sheetId: localStorage.getItem('sheetId') || '',
        geminiKey: localStorage.getItem('geminiApiKey') ? '***' : '',
        refreshSec: parseInt(localStorage.getItem('refreshSec')) || 10
      };
    }
    
    data.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
    
    await userRef.set(data, { merge: true });
    AppState._lastSyncTime = Date.now();
    localStorage.setItem('lastCloudSync', AppState._lastSyncTime.toString());
    
  } catch (e) {
    console.error('saveUserData error:', e);
  } finally {
    AppState._syncInProgress = false;
  }
}

// ======================================
// DEBOUNCED AUTO-SYNC
// ======================================
function triggerAutoSync(field) {
  if (AppState._syncDebounceTimer) clearTimeout(AppState._syncDebounceTimer);
  AppState._syncDebounceTimer = setTimeout(() => saveUserData(field), 2000);
}

// ======================================
// PUSH TO CLOUD (Manual)
// ======================================
async function pushToCloud(showMsg = true) {
  if (AppState._syncInProgress) return;
  AppState._syncInProgress = true;
  
  const syncBtn = document.getElementById('syncStatusBtn');
  if (syncBtn) {
    syncBtn.innerText = 'Saving...';
    syncBtn.style.color = '#f59e0b';
  }
  
  try {
    await saveUserData();
    AppState._lastSyncTime = Date.now();
    localStorage.setItem('lastCloudSync', AppState._lastSyncTime.toString());
    
    const lsd = document.getElementById('lastSyncDisplay');
    if (lsd) {
      const dt = new Date(AppState._lastSyncTime);
      lsd.innerText = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
    
    if (syncBtn) {
      syncBtn.innerText = 'Saved ✓';
      syncBtn.style.color = '#22c55e';
    }
    if (showMsg) showPopup('Firebase sync complete ✓');
    
    setTimeout(() => {
      if (syncBtn) {
        syncBtn.innerText = 'Sync Now';
        syncBtn.style.color = '#38bdf8';
      }
    }, 3000);
    
  } catch (e) {
    if (syncBtn) {
      syncBtn.innerText = 'Sync Failed';
      syncBtn.style.color = '#ef4444';
    }
    if (showMsg) showPopup('Firebase sync failed');
    console.error('pushToCloud error:', e);
  }
  
  AppState._syncInProgress = false;
}

// ======================================
// PULL FROM CLOUD (Manual)
// ======================================
async function pullFromCloud(showMsg = false) {
  if (!AppState.currentUser) {
    if (showMsg) showPopup('Login required');
    return;
  }
  
  const syncBtn = document.getElementById('syncStatusBtn');
  if (syncBtn) {
    syncBtn.innerText = 'Loading...';
    syncBtn.style.color = '#f59e0b';
  }
  
  try {
    const doc = await db.collection('users').doc(AppState.currentUser.userId).get();
    const data = doc.data();
    
    if (!data) {
      if (showMsg) showPopup('No data in Firebase');
      return;
    }
    
    let changed = false;
    
    if (data.watchlists?.length) {
      AppState.watchlists = data.watchlists;
      localStorage.setItem('watchlists', JSON.stringify(AppState.watchlists));
      AppState.wl = AppState.watchlists[AppState.currentWL]?.stocks || [];
      localStorage.setItem('wl', JSON.stringify(AppState.wl));
      changed = true;
    }
    
    if (data.holdings?.length) {
      AppState.h = data.holdings;
      localStorage.setItem('h', JSON.stringify(AppState.h));
      changed = true;
    }
    
    if (data.history?.length) {
      AppState.hist = data.history;
      localStorage.setItem('hist', JSON.stringify(AppState.hist));
      changed = true;
    }
    
    if (data.alerts?.length) {
      AppState.alerts = data.alerts;
      localStorage.setItem('alerts', JSON.stringify(AppState.alerts));
      changed = true;
    }
    
    // Load live prices from Firebase
    try {
      const lpDoc = await db.collection('RealTradePro').doc('live_prices').get();
      if (lpDoc.exists) {
        const prices = lpDoc.data().prices || {};
        let priceLoaded = 0;
        Object.keys(prices).forEach(key => {
          const p = prices[key];
          if (!p) return;
          const sym = key.replace(/\.(NS|BO)$/, '');
          if (p.ltp || p.regularMarketPrice || p.close || p.prev_close) {
            AppState.cache[sym] = {
              data: Object.assign({}, p, { _source: 'firebase_manual_pull' }),
              time: Date.now()
            };
            if (AppState.lastUpdatedMap) AppState.lastUpdatedMap[sym] = Date.now();
            priceLoaded++;
          }
        });
        if (priceLoaded > 0) changed = true;
      }
    } catch (lpErr) {
      console.warn('[Download] live_prices fetch failed:', lpErr);
    }
    
    AppState._lastSyncTime = Date.now();
    localStorage.setItem('lastCloudSync', AppState._lastSyncTime.toString());
    
    const lsd = document.getElementById('lastSyncDisplay');
    if (lsd) {
      const dt = new Date(AppState._lastSyncTime);
      lsd.innerText = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
    
    if (syncBtn) {
      syncBtn.innerText = 'Loaded ✓';
      syncBtn.style.color = '#22c55e';
    }
    
    setTimeout(() => {
      if (syncBtn) {
        syncBtn.innerText = 'Sync Now';
        syncBtn.style.color = '#38bdf8';
      }
    }, 3000);
    
    if (changed) {
      if (typeof renderWLTabs === 'function') renderWLTabs();
      if (typeof renderWL === 'function') renderWL();
      if (typeof renderHold === 'function') renderHold();
      if (typeof renderHist === 'function') renderHist();
      if (showMsg) showPopup('Data loaded from Firebase ✓');
    } else {
      if (showMsg) showPopup('Firebase: no new data');
    }
    
  } catch (e) {
    if (syncBtn) {
      syncBtn.innerText = 'Load Error';
      syncBtn.style.color = '#ef4444';
    }
    if (showMsg) showPopup('Firebase load error');
    console.error('pullFromCloud error:', e);
  }
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.saveUserData = saveUserData;
window.triggerAutoSync = triggerAutoSync;
window.pushToCloud = pushToCloud;
window.pullFromCloud = pullFromCloud;

console.log('✅ firebase-sync.js loaded successfully');