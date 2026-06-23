// ========================================
// SETTINGS MODULE — RealTradePro v3.0
// Handles: API URLs, Refresh/Cache settings, Notifications, Data Clear, Gemini Keys, Google Sheets, FF2 URL
// ========================================

// ======================================
// GAS URL ON/OFF TOGGLES
// ======================================
function toggleGASUrl(num, enabled) {
  localStorage.setItem('gasUrlEnabled_' + num, enabled ? 'true' : 'false');
  const active = [1,2,3,4,5].filter(n => localStorage.getItem('gasUrlEnabled_' + n) !== 'false');
  showPopup(enabled
    ? `✅ API ${num} ON — ${active.length} URL${active.length > 1 ? 's' : ''} active`
    : `🔴 API ${num} OFF — ${active.length} URL${active.length > 1 ? 's' : ''} active`
  );
}

// ======================================
// LOAD SETTINGS UI
// ======================================
function loadSettingsUI() {
  const d1 = document.getElementById("set-api-display");
  const d2 = document.getElementById("set-api2-display");
  const d3 = document.getElementById("set-api3-display");
  const d4 = document.getElementById("set-api4-display");
  const d5 = document.getElementById("set-api5-display");
  const refEl = document.getElementById("set-refresh");
  const cacheEl = document.getElementById("set-cache");
  
  if (d1) d1.innerText = localStorage.getItem("customAPI") || API;
  if (d2) d2.innerText = localStorage.getItem("customAPI2") || API2;
  if (d3) d3.innerText = localStorage.getItem("customAPI3") || API3;
  if (d4) d4.innerText = localStorage.getItem("customAPI4") || 'Not set';
  if (d5) d5.innerText = localStorage.getItem("customAPI5") || 'Not set';
  
  [1,2,3,4,5].forEach(n => {
    const t = document.getElementById('gasToggle' + n);
    if (t) t.checked = localStorage.getItem('gasUrlEnabled_' + n) !== 'false';
  });
  if (refEl) refEl.value = parseInt(localStorage.getItem("refreshSec") || "10");
  if (cacheEl) cacheEl.value = parseInt(localStorage.getItem("cacheSec") || "8000");
  
  const dupChk = document.getElementById('dupToggleChk');
  if (dupChk) dupChk.checked = AppState.dupWarnEnabled;
  
  const curFs = localStorage.getItem('fontSize') || 'medium';
  setFontSize(curFs);
  
  const sheetDisplay = document.getElementById('sheet-id-display');
  const sheetCheck = document.getElementById('sheet-enabled');
  const DEFAULT_SHEET_ID = '1INjKSkOkXYF4y1DDorsCCFIYu0lBkEJTmLupJ6y9i8U';
  if (sheetDisplay) sheetDisplay.innerText = localStorage.getItem('sheetId') || DEFAULT_SHEET_ID;
  if (localStorage.getItem('sheetEnabled') === null) localStorage.setItem('sheetEnabled', 'true');
  if (sheetCheck) sheetCheck.checked = localStorage.getItem('sheetEnabled') === 'true';
  updateSheetStatus();
  
  const aeChk = document.getElementById('alertEngineChk');
  if (aeChk) aeChk.checked = localStorage.getItem('alertEngineOn') !== 'false';
  
  const ntChk = document.getElementById('notifToggleChk');
  const ntStat = document.getElementById('notifPermStatus');
  if (ntChk) ntChk.checked = localStorage.getItem('notifOn') !== 'false';
  if (ntStat) {
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    if (perm === 'granted') {
      ntStat.textContent = 'Permission: Granted ✓';
      ntStat.style.color = 'var(--pos, #4ade80)';
    } else if (perm === 'denied') {
      ntStat.textContent = 'Permission: Blocked ✗ (Enable in browser)';
      ntStat.style.color = 'var(--neg, #f87171)';
    } else {
      ntStat.textContent = 'Not yet requested';
      ntStat.style.color = 'var(--text-muted, #64748b)';
    }
  }
  
  const avEl = document.getElementById('settingsAvatarLetter');
  if (avEl && AppState.currentUser) {
    const userObj = AppState.currentUser;
    const uname = typeof userObj === 'string' ? userObj : (userObj.name || '?');
    avEl.textContent = uname.charAt(0).toUpperCase();
  }
  
  if (typeof initGeminiKeyDisplay === 'function') initGeminiKeyDisplay();

  const ff2Display = document.getElementById('ff2-url-display');
  const ff2Sub = document.getElementById('ff2-url-sub');
  const ff2Saved = localStorage.getItem('ff2ApiUrl') || '';
  if (ff2Display) ff2Display.innerText = ff2Saved || 'Not configured';
  if (ff2Sub) {
    if (ff2Saved) {
      ff2Sub.textContent = '✓ FF2 URL set · Screener data active';
      ff2Sub.style.color = 'var(--warn, #fb923c)';
    } else {
      ff2Sub.textContent = 'Not set — tap to configure';
      ff2Sub.style.color = 'var(--text-muted, #64748b)';
    }
  }
}

// ... Keep existing startAPIEdit, startAPI2Edit, etc functions here ...
function startAPIEdit() {
  const inp = document.getElementById("set-api-input");
  if (inp) inp.value = localStorage.getItem("customAPI") || API;
  document.getElementById("set-api-edit").style.display = "block";
  document.getElementById("changeURLBtn").style.display = "none";
}
function cancelAPIEdit() {
  document.getElementById("set-api-edit").style.display = "none";
  document.getElementById("changeURLBtn").style.display = "inline-block";
}
function startAPI2Edit() {
  const inp = document.getElementById("set-api2-input");
  if (inp) inp.value = localStorage.getItem("customAPI2") || "";
  document.getElementById("set-api2-edit").style.display = "block";
  document.getElementById("changeURL2Btn").style.display = "none";
}
function cancelAPI2Edit() {
  document.getElementById("set-api2-edit").style.display = "none";
  document.getElementById("changeURL2Btn").style.display = "inline-block";
}
function startAPI3Edit() {
  const inp = document.getElementById('set-api3-input');
  if (inp) inp.value = localStorage.getItem('customAPI3') || '';
  document.getElementById('set-api3-edit').style.display = 'block';
  document.getElementById('changeURL3Btn').style.display = 'none';
}
function cancelAPI3Edit() {
  document.getElementById('set-api3-edit').style.display = 'none';
  document.getElementById('changeURL3Btn').style.display = 'inline-block';
}
function startAPI4Edit() {
  const inp = document.getElementById('set-api4-input');
  if (inp) inp.value = localStorage.getItem('customAPI4') || '';
  document.getElementById('set-api4-edit').style.display = 'block';
  document.getElementById('changeURL4Btn').style.display = 'none';
}
function cancelAPI4Edit() {
  document.getElementById('set-api4-edit').style.display = 'none';
  document.getElementById('changeURL4Btn').style.display = 'inline-block';
}
function startAPI5Edit() {
  const inp = document.getElementById('set-api5-input');
  if (inp) inp.value = localStorage.getItem('customAPI5') || '';
  document.getElementById('set-api5-edit').style.display = 'block';
  document.getElementById('changeURL5Btn').style.display = 'none';
}
function cancelAPI5Edit() {
  document.getElementById('set-api5-edit').style.display = 'none';
  document.getElementById('changeURL5Btn').style.display = 'inline-block';
}

function saveSetting(type) {
  if (type === "api") {
    const val = document.getElementById("set-api-input").value.trim();
    if (!val) { showPopup("URL cannot be empty"); return; }
    localStorage.setItem("customAPI", val);
    if (AppState.currentUser) saveUserData('settings');
    cancelAPIEdit();
    loadSettingsUI();
    showPopup("Primary API saved! Refresh to apply.");
  }
  if (type === "api2") {
    const val = document.getElementById("set-api2-input").value.trim();
    localStorage.setItem("customAPI2", val);
    cancelAPI2Edit();
    loadSettingsUI();
    showPopup(val ? "Secondary API saved!" : "Secondary API cleared");
  }
  if (type === "api3") {
    const val = document.getElementById("set-api3-input").value.trim();
    localStorage.setItem("customAPI3", val);
    cancelAPI3Edit();
    loadSettingsUI();
    showPopup(val ? "Tertiary API saved!" : "Tertiary API cleared");
  }
  if (type === "api4") {
    const val = document.getElementById("set-api4-input").value.trim();
    localStorage.setItem("customAPI4", val);
    cancelAPI4Edit();
    loadSettingsUI();
    showPopup(val ? "API 4 saved! (Mummy account)" : "API 4 cleared");
  }
  if (type === "api5") {
    const val = document.getElementById("set-api5-input").value.trim();
    localStorage.setItem("customAPI5", val);
    cancelAPI5Edit();
    loadSettingsUI();
    showPopup(val ? "API 5 saved!" : "API 5 cleared");
  }
  if (type === "refresh") {
    const val = parseInt(document.getElementById("set-refresh").value);
    if (isNaN(val) || val < 10) {
      showPopup("Minimum 10 seconds required");
      return;
    }
    localStorage.setItem("refreshSec", val);
    if (AppState.refreshInterval) clearInterval(AppState.refreshInterval);
    AppState.refreshInterval = setInterval(() => {
      const m = getMarketStatus();
      if (m.open || window._pythonEngineActive) updatePrices();
    }, val * 1000);
    showPopup(`Auto-Refresh set to ${val}s`);
  }
  if (type === "cache") {
    const val = parseInt(document.getElementById("set-cache").value);
    if (isNaN(val) || val < 1000) {
      showPopup("Minimum 1000ms required");
      return;
    }
    AppState.CACHE_TIME = val;
    localStorage.setItem("cacheSec", val);
    showPopup(`Cache set to ${val}ms`);
  }
}

// ======================================
// FONT SIZE CONTROL (Fixed for light mode)
// ======================================
function setFontSize(size) {
  document.documentElement.setAttribute('data-fsize', size);
  localStorage.setItem('fontSize', size);
  ['small', 'medium', 'large'].forEach(s => {
    const btn = document.getElementById('fs-' + s);
    if (btn) {
      btn.style.background = s === size ? 'var(--accent-bg, #1e3a5f)' : 'var(--bg-input, #0f172a)';
      btn.style.color = s === size ? 'var(--accent, #38bdf8)' : 'var(--text-muted, #4b6280)';
      btn.style.borderColor = s === size ? 'var(--accent-border, #2d5a8e)' : 'var(--border, #1e2d3d)';
    }
  });
}

function toggleDupWarn() {
  AppState.dupWarnEnabled = !AppState.dupWarnEnabled;
  localStorage.setItem("dupWarn", AppState.dupWarnEnabled ? "true" : "false");
  const chk = document.getElementById("dupToggleChk");
  if (chk) chk.checked = AppState.dupWarnEnabled;
  showPopup(`Duplicate warning ${AppState.dupWarnEnabled ? "ON" : "OFF"}`);
}

function toggleDupWarnChk(val) {
  AppState.dupWarnEnabled = val;
  localStorage.setItem("dupWarn", val ? "true" : "false");
  showPopup(`Duplicate warning ${val ? "ON" : "OFF"}`);
}

function toggleAlertEngine() {
  const chk = document.getElementById('alertEngineChk');
  const next = chk ? chk.checked : true;
  localStorage.setItem('alertEngineOn', next ? 'true' : 'false');
  showPopup('Technical Alerts ' + (next ? 'ON ⚡' : 'OFF 🔕'));
}

function toggleNotifications() {
  const chk = document.getElementById('notifToggleChk');
  const next = chk ? chk.checked : true;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  
  if (perm === 'denied' && next) {
    showPopup('Notifications blocked in browser. Enable from site settings.', 5000);
    if (chk) chk.checked = false;
    return;
  }
  
  localStorage.setItem('notifOn', next ? 'true' : 'false');
  
  if (next && perm === 'default') {
    Notification.requestPermission().then(p => {
      const s = document.getElementById('notifPermStatus');
      if (s) {
        s.textContent = p === 'granted' ? 'Permission: Granted ✓' : 'Permission: Denied ✗';
        s.style.color = p === 'granted' ? 'var(--pos, #4ade80)' : 'var(--neg, #f87171)';
      }
    });
  }
  showPopup('Browser Notifications ' + (next ? 'ON 🔔' : 'OFF 🔕'));
}

function clearData(type) {
  const labels = { holdings: 'Holdings', history: 'Trade History', alerts: 'All Alerts' };
  const descs = {
    holdings: 'All your holding entries will be permanently deleted. P&L data will be lost.',
    history: 'All trade history entries will be permanently deleted.',
    alerts: 'All price alerts and technical alert logs will be cleared.'
  };
  
  AppState._dangerPendingType = type;
  const modal = document.getElementById('dangerModal');
  const titleEl = document.getElementById('dangerModalTitle');
  const descEl = document.getElementById('dangerModalDesc');
  const btnEl = document.getElementById('dangerConfirmBtn');
  
  if (!modal) {
    _executeClearData(type);
    return;
  }
  
  if (titleEl) titleEl.textContent = 'Clear ' + (labels[type] || type) + '?';
  if (descEl) descEl.textContent = descs[type] || 'This data will be permanently deleted.';
  if (btnEl) {
    btnEl.textContent = 'Clear ' + (labels[type] || type);
    btnEl.onclick = confirmDangerClear;
  }
  modal.style.display = 'flex';
}

function closeDangerModal() {
  const modal = document.getElementById('dangerModal');
  if (modal) modal.style.display = 'none';
  AppState._dangerPendingType = null;
}

function confirmDangerClear() {
  closeDangerModal();
  if (AppState._dangerPendingType) _executeClearData(AppState._dangerPendingType);
}

function _executeClearData(type) {
  if (type === 'holdings') {
    AppState.h = [];
    localStorage.setItem('h', JSON.stringify(AppState.h));
    if (AppState.currentUser) saveUserData('holdings');
    if (typeof renderHold === 'function') renderHold();
  }
  if (type === 'history') {
    AppState.hist = [];
    localStorage.setItem('hist', JSON.stringify(AppState.hist));
    if (AppState.currentUser) saveUserData('history');
    if (typeof renderHist === 'function') renderHist();
  }
  if (type === 'alerts') {
    AppState.alerts = [];
    localStorage.setItem('alerts', JSON.stringify(AppState.alerts));
    if (AppState.currentUser) saveUserData('alerts');
  }
  const labels = { holdings: 'Holdings', history: 'Trade History', alerts: 'All Alerts' };
  showPopup((labels[type] || type) + ' cleared!');
}

function clearAllData() {
  clearData('holdings');
  clearData('history');
  clearData('alerts');
}

// ======================================
// GEMINI / OPENROUTER UI (Light Mode Fixed)
// ======================================
function initGeminiKeyDisplay() {
  const k = localStorage.getItem('geminiApiKey');
  const keys = k ? k.split(',').filter(x => x.trim()) : [];
  const el = document.getElementById('gemini-key-status');
  if (el) el.innerHTML = keys.length > 0
    ? '<span style="color:var(--pos, #34d399);">✓ ' + keys.length + ' Gemini key(s) — Active</span>'
    : '<span style="color:var(--text-muted, #4b6280);">No key saved</span>';
}

function saveGeminiKey() {
  const val = document.getElementById('set-gemini-key').value.trim();
  if (!val) { showPopup('Enter Key'); return; }
  localStorage.setItem('geminiApiKey', val);
  if (AppState.currentUser) saveUserData('settings');
  document.getElementById('gemini-key-status').innerHTML = '<span style="color:var(--pos, #34d399);">✓ Gemini Key saved — Active</span>';
  document.getElementById('set-gemini-key').value = '';
  showPopup('Gemini key saved ✓');
}

function clearGeminiKey() {
  localStorage.removeItem('geminiApiKey');
  document.getElementById('set-gemini-key').value = '';
  document.getElementById('gemini-key-status').innerHTML = '<span style="color:var(--text-muted, #4b6280);">No key saved</span>';
  showPopup('Gemini key cleared');
}



function getSheetId() { return localStorage.getItem('sheetId') || DEFAULT_SHEET_ID; }
function isSheetEnabled() { return localStorage.getItem('sheetEnabled') === 'true'; }

function startSheetEdit() {
  const inp = document.getElementById('sheet-id-input');
  if (inp) inp.value = getSheetId();
  document.getElementById('sheet-id-edit').style.display = 'block';
  document.getElementById('changeSheetBtn').style.display = 'none';
}

function cancelSheetEdit() {
  document.getElementById('sheet-id-edit').style.display = 'none';
  document.getElementById('changeSheetBtn').style.display = 'inline-block';
}

function saveSheetId() {
  const val = document.getElementById('sheet-id-input').value.trim();
  if (!val) { showPopup('Sheet ID cannot be empty'); return; }
  localStorage.setItem('sheetId', val);
  if (AppState.currentUser) saveUserData('settings');
  document.getElementById('sheet-id-display').innerText = val;
  cancelSheetEdit();
  showPopup('Sheet ID saved!');
}

function toggleSheetIntegration(enabled) {
  localStorage.setItem('sheetEnabled', enabled ? 'true' : 'false');
  updateSheetStatus();
  showPopup(enabled ? '✅ Sheet Integration ON — Fundamentals & History use Google Sheets' : 'Sheet Integration OFF');
}

function updateSheetStatus() {
  const el = document.getElementById('sheet-status');
  if (!el) return;
  const on = isSheetEnabled();
  el.innerHTML = on
    ? '<span style="color:var(--pos, #34d399);">✅ Active — PE/EPS/MarketCap/BookValue/History via Sheets | Price+Volume = Yahoo ⚡</span>'
    : '<span style="color:var(--text-muted, #4b6280);">Disabled — using Yahoo Finance API</span>';
}

function clearFundCache() {
  let count = 0;
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('fundCache')) {
      localStorage.removeItem(k);
      count++;
    }
  });
  showPopup('🗑️ Fund cache cleared! (' + count + ' stocks) — Reload stock to refresh.');
}

function startFF2Edit() {
  const inp = document.getElementById('ff2-url-input');
  if (inp) inp.value = localStorage.getItem('ff2ApiUrl') || '';
  document.getElementById('ff2-url-edit').style.display = 'block';
  document.getElementById('changeFF2Btn').style.display = 'none';
}

function cancelFF2Edit() {
  document.getElementById('ff2-url-edit').style.display = 'none';
  document.getElementById('changeFF2Btn').style.display = 'inline-block';
}

function saveFF2Url() {
  const val = (document.getElementById('ff2-url-input').value || '').trim();
  if (val && !val.startsWith('https://script.google.com')) {
    showPopup('Invalid URL — GAS URL https://script.google.com/... hovu joiye');
    return;
  }
  localStorage.setItem('ff2ApiUrl', val);
  cancelFF2Edit();
  loadSettingsUI();
  showPopup(val ? '✅ FF2 URL saved! Learn tab ready.' : 'FF2 URL cleared');
}

function sToggle(bodyId, arrId) {
  event.preventDefault();
  event.stopPropagation();
  
  const b = document.getElementById(bodyId);
  const a = document.getElementById(arrId);
  if (!b || !a) return;

  const hidden = b.style.display === 'none' || b.style.display === '';
  b.style.display = hidden ? 'block' : 'none';
  a.textContent = hidden ? '▼' : '▶';
}



window.toggleGASUrl = toggleGASUrl;
window.loadSettingsUI = loadSettingsUI;
window.saveSetting = saveSetting;
window.startAPIEdit = startAPIEdit;
window.cancelAPIEdit = cancelAPIEdit;
window.startAPI2Edit = startAPI2Edit;
window.cancelAPI2Edit = cancelAPI2Edit;
window.startAPI3Edit = startAPI3Edit;
window.cancelAPI3Edit = cancelAPI3Edit;
window.startAPI4Edit = startAPI4Edit;
window.cancelAPI4Edit = cancelAPI4Edit;
window.startAPI5Edit = startAPI5Edit;
window.cancelAPI5Edit = cancelAPI5Edit;
window.setFontSize = setFontSize;
window.toggleDupWarn = toggleDupWarn;
window.toggleDupWarnChk = toggleDupWarnChk;
window.toggleAlertEngine = toggleAlertEngine;
window.toggleNotifications = toggleNotifications;
window.clearData = clearData;
window.closeDangerModal = closeDangerModal;
window.confirmDangerClear = confirmDangerClear;
window.clearAllData = clearAllData;
window.initGeminiKeyDisplay = initGeminiKeyDisplay;
window.saveGeminiKey = saveGeminiKey;
window.clearGeminiKey = clearGeminiKey;
window.startSheetEdit = startSheetEdit;
window.cancelSheetEdit = cancelSheetEdit;
window.saveSheetId = saveSheetId;
window.toggleSheetIntegration = toggleSheetIntegration;
window.clearFundCache = clearFundCache;
window.updateSheetStatus = updateSheetStatus;
window.startFF2Edit  = startFF2Edit;
window.cancelFF2Edit = cancelFF2Edit;
window.saveFF2Url    = saveFF2Url;
window.sToggle = sToggle;

console.log('✅ settings.js loaded successfully | Gemini Only');
