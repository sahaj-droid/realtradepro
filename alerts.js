// ========================================
// ALERTS MODULE — RealTradePro v3.0
// Handles: Price Alerts, Technical Alerts, Notification System, Alert History
// ========================================

// ======================================
// PRICE ALERT MODAL
// ======================================
function setAlert(sym) {
  AppState.currentAlertSym = sym;
  AppState._alertDir = "above";
  setAlertDir("above");
  
  const alertTitle = document.getElementById("alert-title");
  const alertPrice = document.getElementById("alert-price");
  const alertCurrentPrice = document.getElementById("alert-current-price");
  
  if (alertTitle) alertTitle.innerText = "🔔 Alert — " + sym;
  
  var d = AppState.cache[sym] && AppState.cache[sym].data;
  var price = d ? d.regularMarketPrice : 0;
  
  if (alertCurrentPrice) alertCurrentPrice.innerText = "CMP: ₹" + (price ? price.toFixed(2) : "--");
  if (alertPrice) {
    alertPrice.value = "";
    alertPrice.placeholder = "e.g. " + (price ? (price * 1.05).toFixed(0) : "500");
  }
  
  // Show existing alerts for this sym
  var existing = AppState.alerts.filter(a => a.sym === sym && !a.triggered);
  var listEl = document.getElementById("alert-existing-list");
  if (listEl) {
    if (existing.length > 0) {
      listEl.innerHTML = '<div style="font-size:9px;color:#4b6280;margin-bottom:4px;font-weight:700;">EXISTING ALERTS</div>' +
        existing.map((a, i) =>
          `<div style="display:flex;justify-content:space-between;align-items:center;background:#0a1628;border-radius:6px;padding:5px 8px;margin-bottom:3px;">
            <span style="font-size:11px;color:${a.dir === 'below' ? '#fca5a5' : '#86efac'};">${a.dir === 'below' ? '▼' : '▲'} ₹${a.price}</span>
            <button onclick="removeAlert('${sym}',${a.price})" style="background:transparent;border:none;color:#ef4444;font-size:11px;cursor:pointer;">✕</button>
          </div>`
        ).join('');
    } else {
      listEl.innerHTML = '';
    }
  }
  
  const alertModal = document.getElementById("alertModal");
  if (alertModal) alertModal.style.display = "flex";
}

function setAlertDir(dir) {
  AppState._alertDir = dir;
  
  const aboveBtn = document.getElementById('alert-above-btn');
  const belowBtn = document.getElementById('alert-below-btn');
  
  if (aboveBtn) {
    aboveBtn.style.background = dir === 'above' ? '#166534' : '#1e2d3d';
    aboveBtn.style.color = dir === 'above' ? '#86efac' : '#94a3b8';
    aboveBtn.style.borderColor = dir === 'above' ? '#166534' : '#2d3f52';
  }
  if (belowBtn) {
    belowBtn.style.background = dir === 'below' ? '#7f1d1d' : '#1e2d3d';
    belowBtn.style.color = dir === 'below' ? '#fca5a5' : '#94a3b8';
    belowBtn.style.borderColor = dir === 'below' ? '#7f1d1d' : '#2d3f52';
  }
}

function removeAlert(sym, price) {
  AppState.alerts = AppState.alerts.filter(a => !(a.sym === sym && a.price === price));
  localStorage.setItem("alerts", JSON.stringify(AppState.alerts));
  if (AppState.currentUser) saveUserData('alerts');
  setAlert(sym); // refresh modal
}

function closeAlertModal() {
  const alertModal = document.getElementById("alertModal");
  if (alertModal) alertModal.style.display = "none";
}

function confirmAlert() {
  var price = parseFloat(document.getElementById("alert-price").value);
  if (!price || isNaN(price)) { 
    showPopup("Valid price daakho"); 
    return; 
  }
  
  // Remove duplicate
  AppState.alerts = AppState.alerts.filter(a => !(a.sym === AppState.currentAlertSym && a.price === price));
  AppState.alerts.push({ 
    sym: AppState.currentAlertSym, 
    price: price, 
    dir: AppState._alertDir, 
    triggered: false 
  });
  
  localStorage.setItem("alerts", JSON.stringify(AppState.alerts));
  if (AppState.currentUser) saveUserData('alerts');
  
  closeAlertModal();
  showPopup("🔔 Alert set: " + AppState.currentAlertSym + " " + (AppState._alertDir === 'above' ? '▲' : '▼') + " ₹" + price);
  
  // Request browser notification permission
  if (Notification && Notification.permission === 'default') Notification.requestPermission();
}

// ======================================
// RENDER ALERTS TAB
// ======================================
function renderAlerts() {
  const el = document.getElementById('alerts');
  if (!el) return;

  // === SECTION 1: Price Alerts ===
  let priceHTML = '';
  if (AppState.alerts && AppState.alerts.length > 0) {
    priceHTML = AppState.alerts.map(a => {
      const col = a.triggered ? '#22c55e' : '#f59e0b';
      const status = a.triggered
        ? `✅ Triggered @ ₹${a.triggeredPrice?.toFixed(2) || ''} — ${a.triggeredAt || ''}`
        : `⏳ Waiting`;
      return `<div style="background:#0a1628;border-radius:8px;padding:8px 10px;margin-bottom:6px;border:1px solid ${col}33;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;color:#38bdf8;font-size:13px;">${a.sym}</span>
          <span style="font-size:11px;color:${col};">${a.dir === 'above' ? '▲' : '▼'} ₹${a.price}</span>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${status}</div>
      </div>`;
    }).join('');
  } else {
    priceHTML = `<div style="font-size:11px;color:#4b6280;text-align:center;padding:8px;">No price alerts set</div>`;
  }

  // === SECTION 2: Technical Alert Log ===
  const techLog = {};
  const alertTypes = {
    vol: '🔊 Volume Spike',
    rsiOS: '📉 RSI Oversold',
    rsiOB: '📈 RSI Overbought',
    macdBull: '🟢 MACD Bullish Cross',
    macdBear: '🔴 MACD Bearish Cross',
    bbUp: '⬆️ BB Upper Break',
    bbDn: '⬇️ BB Lower Break',
    insideBar: '📊 Inside Bar',
    narrowRange: '📏 Narrow Range'
  };

  Object.keys(localStorage).forEach(k => {
    if (!k.startsWith('techAlert2_')) return;
    const parts = k.replace('techAlert2_', '').split('_');
    const date = parts[parts.length - 1];
    const sym = parts.slice(0, -1).join('_');
    try {
      const fired = JSON.parse(localStorage.getItem(k) || '{}');
      const firedKeys = Object.keys(fired).filter(f => fired[f] === true);
      if (firedKeys.length === 0) return;
      if (!techLog[date]) techLog[date] = [];
      firedKeys.forEach(f => {
        techLog[date].push({ sym, type: alertTypes[f] || f });
      });
    } catch (e) {}
  });

  const sortedDates = Object.keys(techLog).sort((a, b) => b.localeCompare(a));

  let techHTML = '';
  if (sortedDates.length === 0) {
    techHTML = `<div style="font-size:11px;color:#4b6280;text-align:center;padding:8px;">No technical alerts fired yet</div>`;
  } else {
    techHTML = sortedDates.map(date => {
      const items = techLog[date];
      const rows = items.map(i =>
        `<div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #1e2d3d;">
          <span style="font-size:12px;font-weight:700;color:#38bdf8;">${i.sym}</span>
          <span style="font-size:11px;color:#cbd5e1;">${i.type}</span>
        </div>`
      ).join('');
      return `<div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;letter-spacing:0.5px;">📅 ${date}</div>
        <div style="background:#0a1628;border-radius:8px;overflow:hidden;border:1px solid #1e2d3d;">${rows}</div>
      </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <button onclick="tab('settings')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>Back</button>
      <span style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;">ALERTS</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;">🔔 PRICE ALERTS</div>
      <button onclick="tab('watchlist');setTimeout(()=>document.querySelector('.wl-card-wrap')?.click(),100);"
        style="font-size:10px;background:#1e3a5f;color:#38bdf8;border:1px solid #2d5a8e;border-radius:6px;padding:3px 10px;cursor:pointer;">+ New Alert</button>
    </div>
    ${priceHTML}
    <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;margin-top:12px;margin-bottom:8px;">⚡ TECHNICAL ALERT LOG</div>
    ${techHTML}
  `;
}

// ======================================
// OPEN ALERT HISTORY (Firebase)
// ======================================
async function openAlertHistory() {
  try {
    const snap = await firebase.firestore()
      .collection('RealTradePro').doc('alert_history').get();
    if (!snap.exists) { showPopup('No alert history yet'); return; }
    const data = snap.data();
    const alerts = data.alerts || [];
    if (!alerts.length) { showPopup('No alerts recorded yet'); return; }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);overflow-y:auto;padding:16px;';
    const sorted = alerts.slice().reverse().slice(0, 50);
    let html = `<div style="max-width:400px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:14px;font-weight:700;color:#e2e8f0;">Alert History</span>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:#1e3a5f;color:#38bdf8;border:none;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;">Close</button>
      </div>`;
    sorted.forEach(a => {
      const isUp = a.type && (a.type.includes('BULL') || a.type.includes('Oversold') || a.type.includes('Lower') || a.type.includes('Breakout') || a.type.includes('Golden') || a.type.includes('Gap Up') || a.type.includes('Surge') && !a.type.includes('Bearish'));
      const col = isUp ? '#22c55e' : '#ef4444';
      const ts = a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      html += `<div style="background:#0d1f35;border-radius:8px;padding:8px 12px;margin-bottom:6px;border-left:3px solid ${col};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;font-weight:700;color:#e2e8f0;">${a.sym || ''}</span>
          <span style="font-size:9px;color:#4b6280;">${ts}</span>
        </div>
        <div style="font-size:11px;color:${col};margin-top:2px;">${a.alert_type || ''}</div>
        <div style="font-size:10px;color:#64748b;">₹${a.price || ''}</div>
      </div>`;
    });
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
  } catch (e) {
    showPopup('Alert history load failed');
  }
}

// ======================================
// TECHNICAL ALERTS CHECK
// ======================================
function firePushAlert(title, body, tag) {
  if (localStorage.getItem('alertEngineOn') === 'false') return;
  showPopup(body, 7000);
  const notifUserOn = localStorage.getItem('notifOn') !== 'false';
  if (notifUserOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: '/realtradepro/icons/icon-192.png',
        tag: tag || title,
        requireInteraction: false
      });
    } catch (e) {}
  }
}

function checkVolumeBreakout(sym) {
  const d = AppState.cache[sym]?.data;
  if (!d) return null;
  const vol = d.regularMarketVolume;
  const avgVol = d.averageDailyVolume3Month || d.averageDailyVolume10Day;
  if (!vol || !avgVol) return null;
  const ratio = vol / avgVol;
  if (ratio >= 1.5) return { sym, vol, avgVol, ratio: parseFloat(ratio.toFixed(2)) };
  return null;
}

async function checkTechnicalAlerts(sym) {
  const today = new Date().toISOString().split('T')[0];
  const ALERT_KEY = 'techAlert2_' + sym + '_' + today;
  const alerted = JSON.parse(localStorage.getItem(ALERT_KEY) || '{}');

  // 1. Volume Breakout
  const vb = checkVolumeBreakout(sym);
  if (vb && !alerted.vol) {
    alerted.vol = true;
    firePushAlert(
      sym + ' — Volume Spike',
      sym + ': Volume ' + vb.ratio + 'x avg (' + Math.round(vb.vol / 1e5) / 10 + 'L vs avg ' + Math.round(vb.avgVol / 1e5) / 10 + 'L)',
      'vol_' + sym
    );
  }

  // 2. RSI + MACD + BB (requires history)
  const hist = await fetchHistory(sym);
  if (!hist || !hist.close) {
    localStorage.setItem(ALERT_KEY, JSON.stringify(alerted));
    return;
  }

  const closes = hist.close.filter(v => v != null);
  const highs = hist.high ? hist.high.filter(v => v != null) : closes;
  const lows = hist.low ? hist.low.filter(v => v != null) : closes;

  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const insideBar = detectInsideBar(highs, lows);
  const narrowRange = detectNarrowRange(highs, lows);

  const bb = calcBollinger(closes, 20, 2);
  const price = AppState.cache[sym]?.data?.regularMarketPrice || 0;

  if (rsi !== null) {
    if (rsi < 30 && !alerted.rsiOS) {
      alerted.rsiOS = true;
      firePushAlert(sym + ' — RSI Oversold', sym + ': RSI ' + rsi.toFixed(1) + ' (below 30) — Potential buy zone', 'rsiOS_' + sym);
    } else if (rsi > 70 && !alerted.rsiOB) {
      alerted.rsiOB = true;
      firePushAlert(sym + ' — RSI Overbought', sym + ': RSI ' + rsi.toFixed(1) + ' (above 70) — Caution zone', 'rsiOB_' + sym);
    }
  }

  if (macd) {
    if (macd.bullishCross && !alerted.macdBull) {
      alerted.macdBull = true;
      firePushAlert(sym + ' — MACD Bullish Cross', sym + ': MACD crossed above Signal — Bullish momentum', 'macdB_' + sym);
    } else if (macd.bearishCross && !alerted.macdBear) {
      alerted.macdBear = true;
      firePushAlert(sym + ' — MACD Bearish Cross', sym + ': MACD crossed below Signal — Bearish signal', 'macdS_' + sym);
    }
  }

  if (bb && price > 0) {
    if (price > bb.upper && !alerted.bbUp) {
      alerted.bbUp = true;
      firePushAlert(sym + ' — BB Upper Break', sym + ': Price ₹' + price.toFixed(2) + ' broke above BB Upper ₹' + bb.upper + ' — Overbought watch', 'bbUp_' + sym);
    } else if (price < bb.lower && !alerted.bbDn) {
      alerted.bbDn = true;
      firePushAlert(sym + ' — BB Lower Break', sym + ': Price ₹' + price.toFixed(2) + ' broke below BB Lower ₹' + bb.lower + ' — Oversold watch', 'bbDn_' + sym);
    }
  }

  if (insideBar && !alerted.insideBar) {
    alerted.insideBar = true;
    firePushAlert(sym + ' — Inside Bar', sym + ': Inside Bar pattern — Breakout watch', 'ib_' + sym);
  } else if (narrowRange && !alerted.narrowRange) {
    alerted.narrowRange = true;
    firePushAlert(sym + ' — Narrow Range', sym + ': Narrow Range — Volatility expansion likely', 'nr_' + sym);
  }

  localStorage.setItem(ALERT_KEY, JSON.stringify(alerted));
}

async function runAllTechnicalAlerts() {
  for (let s of AppState.wl) {
    await checkTechnicalAlerts(s);
  }
}

// ======================================
// SMART ALERT SUGGESTIONS (in Detail Modal)
// ======================================
function renderSmartAlertSuggestions(sym, d) {
  const el = document.getElementById('smartAlertSection');
  if (!el || !d) return;
  const price = d.regularMarketPrice;
  const hi52 = d.fiftyTwoWeekHigh || 0;
  const lo52 = d.fiftyTwoWeekLow || 0;
  const suggestions = [];

  // Near 52W High (within 3%)
  if (hi52 > 0 && (hi52 - price) / hi52 * 100 <= 3) {
    suggestions.push({ label: 'Breakout: ₹' + hi52.toFixed(2), price: hi52, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' });
  }
  // Near 52W Low (within 3%)
  if (lo52 > 0 && (price - lo52) / lo52 * 100 <= 3) {
    suggestions.push({ label: 'Support: ₹' + lo52.toFixed(2), price: lo52, color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' });
  }
  // Round number levels near current price
  const roundLevels = [50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 10000];
  roundLevels.forEach(r => {
    if (Math.abs(price - r) / price < 0.03 && r !== price) {
      suggestions.push({ label: 'Round: ₹' + r, price: r, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' });
    }
  });
  // Holdings stop-loss (avg - 8%)
  const holding = (Array.isArray(AppState.h) ? AppState.h : []).find(hh => hh.sym === sym);
  if (holding) {
    const sl = (holding.price * 0.92);
    suggestions.push({ label: 'Stop Loss: ₹' + sl.toFixed(2), price: parseFloat(sl.toFixed(2)), color: '#ef4444', bg: 'rgba(239,68,68,0.12)' });
    const tgt = (holding.price * 1.15);
    suggestions.push({ label: 'Target +15%: ₹' + tgt.toFixed(2), price: parseFloat(tgt.toFixed(2)), color: '#22c55e', bg: 'rgba(34,197,94,0.12)' });
  }

  if (suggestions.length === 0) {
    el.innerHTML = '';
    return;
  }

  // Filter already-set alerts
  const existingPrices = new Set(AppState.alerts.filter(a => a.sym === sym && !a.triggered).map(a => a.price));

  let html = '<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">SMART ALERT SUGGESTIONS</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px;">';
  suggestions.forEach(s => {
    const already = existingPrices.has(s.price);
    if (already) return;
    html += `<button onclick="setSmartAlert('${sym}',${s.price},this)" style="padding:5px 9px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid ${s.color}44;background:${s.bg};color:${s.color};">${s.label}</button>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function setSmartAlert(sym, price, btn) {
  AppState.alerts.push({ sym: sym, price: price, triggered: false });
  localStorage.setItem('alerts', JSON.stringify(AppState.alerts));
  if (AppState.currentUser) saveUserData('alerts');
  if (btn) {
    btn.style.opacity = '0.4';
    btn.innerText = '✓ ' + btn.innerText;
    btn.disabled = true;
  }
  showPopup('Alert set: ' + sym + ' @ ₹' + price);
}

// ======================================
// CHECK ALERTS DURING PRICE UPDATE
// ======================================
function checkAlerts(sym, currentPrice) {
  if (!AppState.alerts || !Array.isArray(AppState.alerts)) return;
  let updated = false;
  AppState.alerts.forEach(function(a) {
    if (a.sym !== sym || a.triggered) return;
    let hit = false;
    if (a.dir === 'above' && currentPrice >= parseFloat(a.price)) hit = true;
    if (a.dir === 'below' && currentPrice <= parseFloat(a.price)) hit = true;
    if (hit) {
      let msg = "🔔 " + sym + " " + (a.dir === 'below' ? '▼' : '▲') + " ₹" + a.price + " — CMP ₹" + currentPrice.toFixed(2);
      showPopup(msg, 6000);
      playAlertSound();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification("RealTradePro Alert", { body: msg, icon: '/favicon.ico' });
      }
      a.triggered = true;
      a.triggeredAt = new Date().toLocaleString("en-IN");
      a.triggeredPrice = currentPrice;
      updated = true;
    }
  });
  if (updated) localStorage.setItem("alerts", JSON.stringify(AppState.alerts));
}

// ======================================
// VOLUME SPIKE ALERT
// ======================================
function checkVolumeSpike(sym, data) {
  if (!data) return;
  const vol = data.regularMarketVolume || data.volume || 0;
  const avgVol = data.avgVolume || data.averageDailyVolume3Month || 0;
  if (!vol || !avgVol || avgVol === 0) return;
  const ratio = vol / avgVol;
  if (ratio < 1.5) return;
  const today = new Date().toISOString().split('T')[0];
  if (_volSpikeAlerted[sym] === today) return;
  _volSpikeAlerted[sym] = today;
  const ratioStr = ratio.toFixed(1);
  const volStr = vol >= 1e7 ? (vol / 1e7).toFixed(1) + 'Cr' : vol >= 1e5 ? (vol / 1e5).toFixed(1) + 'L' : vol >= 1e3 ? (vol / 1e3).toFixed(1) + 'K' : vol.toString();
  playAlertSound();
  showPopup(`🔥 ${sym} Volume Spike! ${ratioStr}x avg (${volStr})`, 7000);
  if (Notification && Notification.permission === 'granted') {
    new Notification('🔥 Volume Spike — ' + sym, { body: ratioStr + 'x avg volume (' + volStr + ')', icon: '/favicon.ico' });
  }
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.setAlert = setAlert;
window.setAlertDir = setAlertDir;
window.removeAlert = removeAlert;
window.closeAlertModal = closeAlertModal;
window.confirmAlert = confirmAlert;
window.renderAlerts = renderAlerts;
window.openAlertHistory = openAlertHistory;
window.checkTechnicalAlerts = checkTechnicalAlerts;
window.runAllTechnicalAlerts = runAllTechnicalAlerts;
window.renderSmartAlertSuggestions = renderSmartAlertSuggestions;
window.setSmartAlert = setSmartAlert;
window.checkAlerts = checkAlerts;
window.checkVolumeSpike = checkVolumeSpike;

console.log('✅ alerts.js loaded successfully');
