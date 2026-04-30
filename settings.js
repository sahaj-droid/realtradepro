// ========================================
// SETTINGS MODULE — RealTradePro v3.0
// Handles: API URLs, Refresh/Cache settings, Notifications, Data Clear, Gemini/Tavily Keys, Google Sheets, FF2 URL
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
  // Load GAS URL toggle states
  [1,2,3,4,5].forEach(n => {
    const t = document.getElementById('gasToggle' + n);
    if (t) t.checked = localStorage.getItem('gasUrlEnabled_' + n) !== 'false';
  });
  if (refEl) refEl.value = parseInt(localStorage.getItem("refreshSec") || "10");
  if (cacheEl) cacheEl.value = parseInt(localStorage.getItem("cacheSec") || "8000");
  
  // Dup warn toggle
  const dupChk = document.getElementById('dupToggleChk');
  if (dupChk) dupChk.checked = AppState.dupWarnEnabled;
  
  // Font size
  const curFs = localStorage.getItem('fontSize') || 'medium';
  setFontSize(curFs);
  
  // Google Sheets UI
  const sheetDisplay = document.getElementById('sheet-id-display');
  const sheetCheck = document.getElementById('sheet-enabled');
  const DEFAULT_SHEET_ID = '1INjKSkOkXYF4y1DDorsCCFIYu0lBkEJTmLupJ6y9i8U';
  if (sheetDisplay) sheetDisplay.innerText = localStorage.getItem('sheetId') || DEFAULT_SHEET_ID;
  if (localStorage.getItem('sheetEnabled') === null) localStorage.setItem('sheetEnabled', 'true');
  if (sheetCheck) sheetCheck.checked = localStorage.getItem('sheetEnabled') === 'true';
  updateSheetStatus();
  
  // Alert engine toggle
  const aeChk = document.getElementById('alertEngineChk');
  if (aeChk) aeChk.checked = localStorage.getItem('alertEngineOn') !== 'false';
  
  // Notification toggle
  const ntChk = document.getElementById('notifToggleChk');
  const ntStat = document.getElementById('notifPermStatus');
  if (ntChk) ntChk.checked = localStorage.getItem('notifOn') !== 'false';
  if (ntStat) {
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    if (perm === 'granted') {
      ntStat.textContent = 'Permission: Granted ✓';
      ntStat.style.color = '#4ade80';
    } else if (perm === 'denied') {
      ntStat.textContent = 'Permission: Blocked ✗ (Enable in browser)';
      ntStat.style.color = '#f87171';
    } else {
      ntStat.textContent = 'Not yet requested';
      ntStat.style.color = '#64748b';
    }
  }
  
  // Avatar initial letter
  const avEl = document.getElementById('settingsAvatarLetter');
  if (avEl && AppState.currentUser) {
    const userObj = AppState.currentUser;
    const uname = typeof userObj === 'string' ? userObj : (userObj.name || '?');
    avEl.textContent = uname.charAt(0).toUpperCase();
  }
  
  // Nivi AI key status refresh
  if (typeof initGeminiKeyDisplay === 'function') initGeminiKeyDisplay();

  // FF2 URL display
  const ff2Display = document.getElementById('ff2-url-display');
  const ff2Sub = document.getElementById('ff2-url-sub');
  const ff2Saved = localStorage.getItem('ff2ApiUrl') || '';
  if (ff2Display) ff2Display.innerText = ff2Saved || 'Not configured';
  if (ff2Sub) {
    if (ff2Saved) {
      ff2Sub.textContent = '✓ FF2 URL set · Screener data active';
      ff2Sub.style.color = '#fb923c';
    } else {
      ff2Sub.textContent = 'Not set — tap to configure';
      ff2Sub.style.color = '#64748b';
    }
  }
}

// ======================================
// API URL EDITORS
// ======================================
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

// ======================================
// SAVE SETTINGS
// ======================================
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
// FONT SIZE CONTROL
// ======================================
function setFontSize(size) {
  document.documentElement.setAttribute('data-fsize', size);
  localStorage.setItem('fontSize', size);
  ['small', 'medium', 'large'].forEach(s => {
    const btn = document.getElementById('fs-' + s);
    if (btn) {
      btn.style.background = s === size ? '#1e3a5f' : '#0f172a';
      btn.style.color = s === size ? '#38bdf8' : '#4b6280';
      btn.style.borderColor = s === size ? '#2d5a8e' : '#1e2d3d';
    }
  });
}

// ======================================
// DUPLICATE WARNING TOGGLE
// ======================================
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

// ======================================
// ALERT ENGINE TOGGLE
// ======================================
function toggleAlertEngine() {
  const chk = document.getElementById('alertEngineChk');
  const next = chk ? chk.checked : true;
  localStorage.setItem('alertEngineOn', next ? 'true' : 'false');
  showPopup('Technical Alerts ' + (next ? 'ON ⚡' : 'OFF 🔕'));
}

// ======================================
// NOTIFICATIONS TOGGLE
// ======================================
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
        s.style.color = p === 'granted' ? '#4ade80' : '#f87171';
      }
    });
  }
  showPopup('Browser Notifications ' + (next ? 'ON 🔔' : 'OFF 🔕'));
}

// ======================================
// CLEAR DATA WITH CONFIRMATION
// ======================================
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
// GEMINI API KEY
// ======================================
function initGeminiKeyDisplay() {
  // Gemini
  const k = localStorage.getItem('geminiApiKey');
  const keys = k ? k.split(',').filter(x => x.trim()) : [];
  const el = document.getElementById('gemini-key-status');
  if (el) el.innerHTML = keys.length > 0
    ? '<span style="color:#34d399;">✓ ' + keys.length + ' Gemini key(s) — Active</span>'
    : '<span style="color:#4b6280;">No key saved</span>';

  // Groq
  const gk = localStorage.getItem('groqApiKey');
  const grEl = document.getElementById('groq-key-status');
  if (grEl) grEl.innerHTML = gk
    ? '<span style="color:#a78bfa;">✓ Groq Key saved — Active</span>'
    : '<span style="color:#4b6280;">No key saved</span>';

  // OpenRouter
  const ok = localStorage.getItem('openRouterApiKey');
  const orEl = document.getElementById('or-key-status');
  if (orEl) orEl.innerHTML = ok
    ? '<span style="color:#fb923c;">✓ OpenRouter Key saved — Active</span>'
    : '<span style="color:#4b6280;">No key saved</span>';

  // OpenRouter Models — populate fields
  const savedModels = (localStorage.getItem('openRouterModels') || '').split(',').filter(Boolean);
  const f1 = document.getElementById('or-model-1');
  const f2 = document.getElementById('or-model-2');
  const f3 = document.getElementById('or-model-3');
  if (f1) f1.value = savedModels[0] || '';
  if (f2) f2.value = savedModels[1] || '';
  if (f3) f3.value = savedModels[2] || '';

  // ✅ Universal AI Provider status
  _loadUniversalProviderUI();
}

function saveGeminiKey() {
  const val = document.getElementById('set-gemini-key').value.trim();
  if (!val) { showPopup('Enter Key'); return; }
  localStorage.setItem('geminiApiKey', val);
  if (AppState.currentUser) saveUserData('settings');
  document.getElementById('gemini-key-status').innerHTML = '<span style="color:#34d399;">✓ Gemini Key saved — Active</span>';
  document.getElementById('set-gemini-key').value = '';
  showPopup('Gemini key saved ✓');
}

function clearGeminiKey() {
  localStorage.removeItem('geminiApiKey');
  document.getElementById('set-gemini-key').value = '';
  document.getElementById('gemini-key-status').innerHTML = '<span style="color:#4b6280;">No key saved</span>';
  showPopup('Gemini key cleared');
}

// ======================================
// GROQ API KEY
// ======================================
function saveGroqKey() {
  const val = (document.getElementById('set-groq-key').value || '').trim();
  if (!val) { showPopup('Enter Groq'); return; }
  localStorage.setItem('groqApiKey', val);
  document.getElementById('set-groq-key').value = '';
  document.getElementById('groq-key-row').style.display = 'none';
  const el = document.getElementById('groq-key-status');
  if (el) el.innerHTML = '<span style="color:#a78bfa;">✓ Groq Key saved — Active</span>';
  showPopup('✅ Groq key saved! Fallback 1 ready.');
}

function clearGroqKey() {
  localStorage.removeItem('groqApiKey');
  const el = document.getElementById('groq-key-status');
  if (el) el.innerHTML = '<span style="color:#4b6280;">No key saved</span>';
  showPopup('Groq key cleared');
}

// ======================================
// OPENROUTER API KEY
// ======================================
function saveORKey() {
  const val = (document.getElementById('set-or-key').value || '').trim();
  if (!val) { showPopup('Enter OpenRouter key'); return; }
  localStorage.setItem('openRouterApiKey', val);
  document.getElementById('set-or-key').value = '';
  document.getElementById('or-key-row').style.display = 'none';
  const el = document.getElementById('or-key-status');
  if (el) el.innerHTML = '<span style="color:#fb923c;">✓ OpenRouter Key saved — Active</span>';
  showPopup('✅ OpenRouter key saved! Fallback 2 ready.');
}

function clearORKey() {
  localStorage.removeItem('openRouterApiKey');
  const el = document.getElementById('or-key-status');
  if (el) el.innerHTML = '<span style="color:#4b6280;">No key saved</span>';
  showPopup('OpenRouter key cleared');
}

// ======================================
// OPENROUTER MODELS
// ======================================
function saveORModels() {
  const m1 = (document.getElementById('or-model-1').value || '').trim();
  const m2 = (document.getElementById('or-model-2').value || '').trim();
  const m3 = (document.getElementById('or-model-3').value || '').trim();
  const models = [m1, m2, m3].filter(Boolean);
  if (models.length === 0) { showPopup('Enter one model!'); return; }
  localStorage.setItem('openRouterModels', models.join(','));
  const st = document.getElementById('or-models-status');
  if (st) { st.textContent = '✅ ' + models.length + ' model(s) saved'; setTimeout(() => st.textContent = '', 3000); }
  showPopup('✅ OpenRouter models saved: ' + models.length);
}

function clearORModels() {
  localStorage.removeItem('openRouterModels');
  ['or-model-1','or-model-2','or-model-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const st = document.getElementById('or-models-status');
  if (st) { st.textContent = '🗑 Models reset'; setTimeout(() => st.textContent = '', 2000); }
  showPopup('OpenRouter models reset');
}

// ======================================
// GOOGLE SHEETS INTEGRATION
// ======================================
const DEFAULT_SHEET_ID = '1INjKSkOkXYF4y1DDorsCCFIYu0lBkEJTmLupJ6y9i8U';

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
    ? '<span style="color:#34d399;">✅ Active — PE/EPS/MarketCap/BookValue/History via Sheets | Price+Volume = Yahoo ⚡</span>'
    : '<span style="color:#4b6280;">Disabled — using Yahoo Finance API</span>';
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

// ======================================
// FF2 URL CONFIGURATION
// ======================================
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

// ======================================
// SETTINGS COLLAPSIBLE TOGGLE
// ======================================
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

// ======================================
// 🌐 UNIVERSAL AI PROVIDER SETTINGS
// Primary + Fallback provider manage karo
// Supported: groq, openrouter, gemini, nvidia
// ======================================

function _loadUniversalProviderUI() {
  const config = typeof getAIProviderConfig === 'function' ? getAIProviderConfig() : null;

  // Primary status
  const primStatus = document.getElementById('uni-primary-status');
  if (primStatus) {
    if (config?.primary?.provider) {
      const p = config.primary;
      primStatus.innerHTML = `<span style="color:#34d399;">✓ ${p.provider.toUpperCase()} — ${p.model || 'default'}</span>`;
    } else {
      primStatus.innerHTML = '<span style="color:#4b6280;">Not set — existing chain use thase</span>';
    }
  }

  // Fallback status
  const fallStatus = document.getElementById('uni-fallback-status');
  if (fallStatus) {
    if (config?.fallback?.provider) {
      const f = config.fallback;
      fallStatus.innerHTML = `<span style="color:#fb923c;">✓ ${f.provider.toUpperCase()} — ${f.model || 'default'}</span>`;
    } else {
      fallStatus.innerHTML = '<span style="color:#4b6280;">Not set</span>';
    }
  }

  // Populate fields if config exists
  if (config?.primary) {
    const pp = document.getElementById('uni-primary-provider');
    const pm = document.getElementById('uni-primary-model');
    const pk = document.getElementById('uni-primary-key');
    if (pp) pp.value = config.primary.provider || 'groq';
    if (pm) pm.value = config.primary.model   || '';
    if (pk) pk.value = '';  // key kabhi show nahi karva — security
  }
  if (config?.fallback) {
    const fp = document.getElementById('uni-fallback-provider');
    const fm = document.getElementById('uni-fallback-model');
    const fk = document.getElementById('uni-fallback-key');
    if (fp) fp.value = config.fallback.provider || 'openrouter';
    if (fm) fm.value = config.fallback.model    || '';
    if (fk) fk.value = '';
  }
}

function saveUniversalProvider() {
  const pp = (document.getElementById('uni-primary-provider')?.value || '').trim().toLowerCase();
  const pm = (document.getElementById('uni-primary-model')?.value    || '').trim();
  const pk = (document.getElementById('uni-primary-key')?.value      || '').trim();

  const fp = (document.getElementById('uni-fallback-provider')?.value || '').trim().toLowerCase();
  const fm = (document.getElementById('uni-fallback-model')?.value    || '').trim();
  const fk = (document.getElementById('uni-fallback-key')?.value      || '').trim();

  if (!pp || !pk) { showPopup('Primary provider ane key joie!'); return; }

  const config = {};

  config.primary = { provider: pp, model: pm, apiKey: pk };

  // Existing keys reuse — jо key field blank hoy to existing key rakho
  const existing = typeof getAIProviderConfig === 'function' ? getAIProviderConfig() : null;
  if (!pk && existing?.primary?.apiKey) config.primary.apiKey = existing.primary.apiKey;

  if (fp && fk) {
    config.fallback = { provider: fp, model: fm, apiKey: fk };
  } else if (fp && existing?.fallback?.apiKey) {
    config.fallback = { provider: fp, model: fm, apiKey: existing.fallback.apiKey };
  }

  if (typeof setAIProviderConfig === 'function') setAIProviderConfig(config);

  // Clear key fields — security
  const pkEl = document.getElementById('uni-primary-key');
  const fkEl = document.getElementById('uni-fallback-key');
  if (pkEl) pkEl.value = '';
  if (fkEl) fkEl.value = '';

  _loadUniversalProviderUI();
  showPopup(`✅ Universal AI saved! Primary: ${pp.toUpperCase()}`);
}

function clearUniversalProvider() {
  localStorage.removeItem('aiProviderConfig');
  _loadUniversalProviderUI();
  showPopup('🗑 Universal AI config cleared — existing chain active');
}

// Model suggestions per provider
function onUniProviderChange(which) {
  const provEl  = document.getElementById(`uni-${which}-provider`);
  const modelEl = document.getElementById(`uni-${which}-model`);
  if (!provEl || !modelEl) return;

  const defaults = {
    groq:       'llama-3.1-8b-instant',
    openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
    gemini:     'gemini-2.0-flash-lite',
    nvidia:     'meta/llama-3.1-8b-instruct'
  };
  modelEl.placeholder = defaults[provEl.value] || 'model name';
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
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
window.saveGroqKey = saveGroqKey;
window.clearGroqKey = clearGroqKey;
window.saveORKey = saveORKey;
window.clearORKey = clearORKey;
window.saveORModels = saveORModels;
window.clearORModels = clearORModels;
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
window.saveUniversalProvider  = saveUniversalProvider;
window.clearUniversalProvider = clearUniversalProvider;
window.onUniProviderChange    = onUniProviderChange;

console.log('✅ settings.js loaded successfully');
