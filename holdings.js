// ========================================
// HOLDINGS MODULE — RealTradePro v3.0
// Handles: Holdings display, portfolio dashboard, averaging calculator, P&L, pie chart
// ========================================

// ======================================
// RENDER HOLDINGS
// ======================================
async function renderHold() {
  let html = "";
  for (let x of AppState.h) {
    let d = AppState.cache[x.sym]?.data || await fetchFull(x.sym);
    if (!d) continue;
    x.ltp = d.regularMarketPrice;
    let uPnl = (d.regularMarketPrice - x.price) * x.qty;
    let pnlPct = ((d.regularMarketPrice - x.price) / x.price * 100).toFixed(2);
    const days = holdingDays(x.buyDate);
    const daysStr = days !== null ? `<span style="font-size:9px;color:#4b6280;margin-left:4px;">${holdingDaysLabel(days)}</span>` : '';
    const typeTag = x.tradeType ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700;background:${x.tradeType === 'MIS' ? '#4a1d96' : '#1e3a5f'};color:${x.tradeType === 'MIS' ? '#c4b5fd' : '#93c5fd'};margin-left:4px;">${x.tradeType}</span>` : '';
    const updated = AppState.lastUpdatedMap[x.sym] ? `<span style="font-size:9px;color:#4b6280;">${timeAgo(AppState.lastUpdatedMap[x.sym])}</span>` : '';
    
    html += `
    <div class="card" style="font-size:13px;padding:8px 10px;">
      <!-- Row 1: Symbol+Badge | CMP | P&L -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;margin-bottom:5px;">
        <div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;">${x.sym}</span>
          ${typeTag}
        </div>
        <div style="text-align:center;">
          <div id="hcmp-${x.sym}" style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;">${inr(d.regularMarketPrice)}</div>
          <div style="font-size:9px;color:#4b6280;">CMP</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:700;color:${uPnl >= 0 ? '#22c55e' : '#ef4444'};">${uPnl >= 0 ? '+' : ''}${inr(uPnl)}</div>
          <div style="font-size:10px;color:${uPnl >= 0 ? '#22c55e' : '#ef4444'};">(${pnlPct}%)</div>
        </div>
      </div>
      <!-- Row 2: Qty | Avg Price | Holding Days -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;margin-bottom:6px;">
        <div>
          <div style="font-size:10px;color:#4b6280;">QTY</div>
          <div style="font-size:13px;font-weight:700;">${x.qty}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#4b6280;">AVG PRICE</div>
          <div style="font-size:13px;font-weight:700;">${inr(x.price)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#4b6280;">HELD</div>
          <div style="font-size:12px;font-weight:700;color:#94a3b8;">${days !== null ? holdingDaysLabel(days) : (x.buyDate ? holdingDaysLabel(0) : 'Add date')}</div>
        </div>
      </div>
      <!-- Row 3: CMP vs Avg Bar | AVGv | EDIT | SELL -->
      <div style="display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:5px;">
        <div>${getAvgVsCMPBar(x.price, d.regularMarketPrice)}</div>
        <button onclick="openAvgCalc('${x.sym}',${x.price},${x.qty},${d.regularMarketPrice})" style="background:#1e3a5f;color:#38bdf8;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;border:1px solid #2d5a8e;cursor:pointer;font-family:'Rajdhani',sans-serif;">AVGv</button>
        <button onclick="openEdit('${x.sym}')" style="background:#713f12;color:#fde68a;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;">EDIT</button>
        <button onclick="openModal('SELL','${x.sym}',${d.regularMarketPrice})" style="background:#7f1d1d;color:#fca5a5;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;">SELL</button>
      </div>
    </div>`;
  }
  
  const holdingsList = document.getElementById("holdingsList");
  if (holdingsList) {
    holdingsList.innerHTML = html || `<div style="text-align:center;color:#4b6280;padding:20px;font-size:13px;">No holdings</div>`;
  }
  
  updatePortfolioDashboard();
  drawPieChart();
}

// ======================================
// UPDATE PORTFOLIO DASHBOARD
// ======================================
function updatePortfolioDashboard() {
  let ti = 0, cv = 0;
  AppState.h.forEach(s => {
    ti += s.price * s.qty;
    cv += s.ltp ? s.ltp * s.qty : s.price * s.qty;
  });
  const uPL = cv - ti;
  const rp = ti ? ((uPL / ti) * 100).toFixed(2) : 0;
  const realPL = AppState.hist.filter(x => x.type !== 'BUY' && x.pnl != null).reduce((s, x) => s + x.pnl, 0);
  const totPL = uPL + realPL;
  
  const totalInvestment = document.getElementById("totalInvestment");
  const currentValue = document.getElementById("currentValue");
  const totalPLEl = document.getElementById("totalPL");
  const returnPercent = document.getElementById("returnPercent");
  const realizedPL = document.getElementById("realizedPL");
  const combinedPL = document.getElementById("combinedPL");
  
  if (totalInvestment) totalInvestment.innerText = inr(ti);
  if (currentValue) currentValue.innerText = inr(cv);
  if (totalPLEl) {
    totalPLEl.innerText = (uPL >= 0 ? "+" : "") + inr(uPL);
    totalPLEl.style.color = uPL >= 0 ? "#22c55e" : "#ef4444";
  }
  if (returnPercent) {
    returnPercent.innerText = rp + "%";
    returnPercent.style.color = uPL >= 0 ? "#22c55e" : "#ef4444";
  }
  if (realizedPL) {
    realizedPL.innerText = (realPL >= 0 ? "+" : "") + inr(realPL);
    realizedPL.style.color = realPL >= 0 ? "#22c55e" : "#ef4444";
  }
  if (combinedPL) {
    combinedPL.innerText = (totPL >= 0 ? "+" : "") + inr(totPL);
    combinedPL.style.color = totPL >= 0 ? "#22c55e" : "#ef4444";
  }
}

// ======================================
// DRAW PIE CHART (Portfolio Distribution)
// ======================================
function drawPieChart() {
  const canvas = document.getElementById("pieChart");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  
  if (AppState.h.length === 0) {
    ctx.fillStyle = "#4b6280";
    ctx.font = "10px 'Rajdhani', sans-serif";
    ctx.fillText("No holdings", w/2 - 30, h/2);
    return;
  }
  
  const total = AppState.h.reduce((sum, s) => sum + (s.price * s.qty), 0);
  if (total === 0) return;
  
  let startAngle = -Math.PI / 2;
  const colors = ["#22c55e", "#38bdf8", "#f59e0b", "#a78bfa", "#ef4444", "#34d399", "#f97316", "#c084fc", "#6ee7b7", "#fb923c"];
  
  AppState.h.forEach((s, idx) => {
    const value = s.price * s.qty;
    const angle = (value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    
    ctx.beginPath();
    ctx.fillStyle = colors[idx % colors.length];
    ctx.moveTo(w/2, h/2);
    ctx.arc(w/2, h/2, Math.min(w, h) / 2 - 10, startAngle, endAngle);
    ctx.fill();
    
    startAngle = endAngle;
  });
  
  // Draw center circle
  ctx.beginPath();
  ctx.fillStyle = "#0a0f1a";
  ctx.arc(w/2, h/2, Math.min(w, h) / 4, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 10px 'Rajdhani', sans-serif";
  ctx.fillText("Holdings", w/2 - 22, h/2 + 3);
}

// ======================================
// AVERAGING CALCULATOR MODAL
// ======================================
function openAvgCalc(sym, avgPrice, qty, cmp) {
  AppState._acSym = sym;
  AppState._acAvg = avgPrice;
  AppState._acQty = qty;
  AppState._acCmp = cmp;
  
  const acSymDisplay = document.getElementById('ac-sym-display');
  const acAvgDisplay = document.getElementById('ac-avg-display');
  const acQtyDisplay = document.getElementById('ac-qty-display');
  const acCmpDisplay = document.getElementById('ac-cmp-display');
  const acTargetBuyprice = document.getElementById('ac-target-buyprice');
  
  if (acSymDisplay) acSymDisplay.innerText = sym;
  if (acAvgDisplay) acAvgDisplay.innerText = '₹' + avgPrice.toFixed(2);
  if (acQtyDisplay) acQtyDisplay.innerText = qty;
  if (acCmpDisplay) acCmpDisplay.innerText = '₹' + cmp.toFixed(2);
  
  const acBuyPrice = document.getElementById('ac-buy-price');
  const acBuyQty = document.getElementById('ac-buy-qty');
  const acTargetAvg = document.getElementById('ac-target-avg');
  
  if (acBuyPrice) acBuyPrice.value = '';
  if (acBuyQty) acBuyQty.value = '';
  if (acTargetAvg) acTargetAvg.value = '';
  if (acTargetBuyprice) acTargetBuyprice.value = cmp.toFixed(2);
  
  const acResult = document.getElementById('ac-result');
  if (acResult) acResult.style.display = 'none';
  
  setAvgMode('buy');
  
  const avgCalcModal = document.getElementById('avgCalcModal');
  if (avgCalcModal) avgCalcModal.style.display = 'flex';
}

function closeAvgCalc() {
  const avgCalcModal = document.getElementById('avgCalcModal');
  if (avgCalcModal) avgCalcModal.style.display = 'none';
}

function setAvgMode(mode) {
  AppState._acMode = mode;
  const isBuy = mode === 'buy';
  
  const acPanelBuy = document.getElementById('ac-panel-buy');
  const acPanelTarget = document.getElementById('ac-panel-target');
  const acModeBuy = document.getElementById('ac-mode-buy');
  const acModeTarget = document.getElementById('ac-mode-target');
  const acResult = document.getElementById('ac-result');
  
  if (acPanelBuy) acPanelBuy.style.display = isBuy ? 'block' : 'none';
  if (acPanelTarget) acPanelTarget.style.display = isBuy ? 'none' : 'block';
  
  if (acModeBuy) {
    acModeBuy.style.background = isBuy ? '#1e3a5f' : '#1e2d3d';
    acModeBuy.style.color = isBuy ? '#38bdf8' : '#94a3b8';
    acModeBuy.style.borderColor = isBuy ? '#38bdf8' : '#2d3f52';
  }
  if (acModeTarget) {
    acModeTarget.style.background = !isBuy ? '#1e3a5f' : '#1e2d3d';
    acModeTarget.style.color = !isBuy ? '#38bdf8' : '#94a3b8';
    acModeTarget.style.borderColor = !isBuy ? '#38bdf8' : '#2d3f52';
  }
  if (acResult) acResult.style.display = 'none';
  
  if (isBuy) calcAvg(); else calcTargetQty();
}

function calcAvg() {
  const buyPrice = parseFloat(document.getElementById('ac-buy-price')?.value) || 0;
  const buyQty = parseInt(document.getElementById('ac-buy-qty')?.value) || 0;
  const res = document.getElementById('ac-result');
  
  if (!buyPrice || !buyQty) {
    if (res) res.style.display = 'none';
    return;
  }

  const newQty = AppState._acQty + buyQty;
  const newAvg = (AppState._acAvg * AppState._acQty + buyPrice * buyQty) / newQty;
  const extraInvest = buyPrice * buyQty;
  const oldRecovery = ((AppState._acAvg - AppState._acCmp) / AppState._acCmp * 100);
  const newRecovery = ((newAvg - AppState._acCmp) / AppState._acCmp * 100);
  const better = newRecovery < oldRecovery;
  const rColor = (v) => v > 0 ? '#ef4444' : '#22c55e';

  if (res) {
    res.style.display = 'block';
    res.innerHTML = `
      <div style="font-size:10px;font-weight:700;color:#4b6280;margin-bottom:8px;letter-spacing:0.5px;">RESULT</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">New Avg Price</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#38bdf8;">₹${newAvg.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">New Total Qty</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${newQty}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">Extra Investment</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#f59e0b;">${inr(extraInvest)}</span>
      </div>
      <div style="border-top:1px solid #1e3a5f;margin:6px 0;"></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">Recovery needed (old)</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${rColor(oldRecovery)};">${oldRecovery > 0 ? '+' : ''}${oldRecovery.toFixed(2)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:11px;color:#94a3b8;">Recovery needed (new)</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${rColor(newRecovery)};">${newRecovery > 0 ? '+' : ''}${newRecovery.toFixed(2)}%</span>
      </div>
      <div style="text-align:center;font-size:12px;font-weight:700;padding:6px;border-radius:6px;background:${better ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${better ? '#22c55e' : '#ef4444'};">
        ${better ? 'Averaging will help recovery!' : 'Buying above current avg'}
      </div>`;
  }
}

function calcTargetQty() {
  const targetAvg = parseFloat(document.getElementById('ac-target-avg')?.value) || 0;
  const buyAt = parseFloat(document.getElementById('ac-target-buyprice')?.value) || 0;
  const res = document.getElementById('ac-result');
  
  if (!targetAvg || !buyAt) {
    if (res) res.style.display = 'none';
    return;
  }

  const denom = targetAvg - buyAt;
  if (Math.abs(denom) < 0.01) {
    if (res) {
      res.style.display = 'block';
      res.innerHTML = `<div style="text-align:center;color:#f59e0b;font-size:12px;">Buy At price same as Target Avg — no change possible</div>`;
    }
    return;
  }
  if (targetAvg >= AppState._acAvg && denom > 0) {
    if (res) {
      res.style.display = 'block';
      res.innerHTML = `<div style="text-align:center;color:#f59e0b;font-size:12px;">Target avg must be less than current avg to average down</div>`;
    }
    return;
  }

  const neededQty = Math.ceil(AppState._acQty * (AppState._acAvg - targetAvg) / denom);
  if (neededQty <= 0) {
    if (res) {
      res.style.display = 'block';
      res.innerHTML = `<div style="text-align:center;color:#ef4444;font-size:12px;">Not possible at this buy price</div>`;
    }
    return;
  }

  const extraInvest = neededQty * buyAt;
  const newQty = AppState._acQty + neededQty;
  const actualNewAvg = (AppState._acAvg * AppState._acQty + buyAt * neededQty) / newQty;

  if (res) {
    res.style.display = 'block';
    res.innerHTML = `
      <div style="font-size:10px;font-weight:700;color:#4b6280;margin-bottom:8px;letter-spacing:0.5px;">RESULT</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">Qty to Buy</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#22c55e;">${neededQty}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">Total Qty after</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${newQty}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">Actual New Avg</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#38bdf8;">₹${actualNewAvg.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;color:#94a3b8;">Investment Needed</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#f59e0b;">${inr(extraInvest)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:11px;color:#94a3b8;">Total Investment</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">${inr(AppState._acAvg * AppState._acQty + extraInvest)}</span>
      </div>`;
  }
}

// ======================================
// HISTORY FUNCTIONS
// ======================================
function setHistView(v) {
  AppState.histView = v;
  ['list', 'calendar'].forEach(x => {
    const btn = document.getElementById('histView' + x.charAt(0).toUpperCase() + x.slice(1));
    if (!btn) return;
    const active = x === v;
    btn.style.background = active ? '#1e3a5f' : '#1e2d3d';
    btn.style.color = active ? '#38bdf8' : '#94a3b8';
    btn.style.borderColor = active ? '#38bdf8' : '#2d3f52';
  });
  
  const historyList = document.getElementById("historyList");
  const historyCalendar = document.getElementById("historyCalendar");
  if (historyList) historyList.style.display = v === 'list' ? 'block' : 'none';
  if (historyCalendar) historyCalendar.style.display = v === 'calendar' ? 'block' : 'none';
  if (v === 'calendar') renderCalendar();
}

function renderHist() {
  let html = "";
  AppState.hist.forEach((x, idx) => {
    const isBuy = x.type === 'BUY';
    const typeTag = x.tradeType ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700;background:${x.tradeType === 'MIS' ? '#4a1d96' : '#1e3a5f'};color:${x.tradeType === 'MIS' ? '#c4b5fd' : '#93c5fd'};margin-left:4px;">${x.tradeType}</span>` : '';
    let daysStr = '';
    if (!isBuy && x.buyDate && x.date) {
      const bd = new Date(x.buyDate), sd = new Date(x.date);
      const days = Math.floor((sd - bd) / (1000 * 60 * 60 * 24));
      if (days >= 0) daysStr = `<span style="font-size:9px;color:#4b6280;"> | ${holdingDaysLabel(days)} held</span>`;
    }
    html += `
    <div class="card" style="font-size:12px;margin-bottom:4px;padding:7px 10px;position:relative;">
      <button onclick="deleteHistEntry(${idx})"
        style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);color:#ef4444;border-radius:6px;width:22px;height:22px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;">×</button>
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;margin-bottom:3px;padding-right:28px;">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;">${x.sym}</span>
          <span style="font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;background:${isBuy ? '#166534' : '#7f1d1d'};color:${isBuy ? '#86efac' : '#fca5a5'};">${isBuy ? 'BUY' : 'SELL'}</span>
          ${typeTag}
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;text-align:center;">${inr(parseFloat(x.buy))}</span>
        <span style="font-size:12px;font-weight:700;color:${(!isBuy && x.pnl != null) ? (x.pnl >= 0 ? '#22c55e' : '#ef4444') : '#4b6280'};text-align:right;min-width:70px;">${(!isBuy && x.pnl != null) ? (x.pnl >= 0 ? '+' : '') + inr(x.pnl) : ''}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding-right:28px;">
        <span style="font-size:10px;color:#4b6280;">Qty: ${x.qty}${daysStr}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;text-align:center;">${!isBuy && x.sell ? inr(parseFloat(x.sell)) : ''}</span>
        <span style="font-size:10px;color:#4b6280;text-align:right;min-width:70px;">${x.date || ''}</span>
      </div>
    </div>`;
  });
  
  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.innerHTML = html || (AppState.hist.length === 0 ? `<div style="text-align:center;color:#4b6280;padding:30px;font-size:13px;">No history yet</div>` : "");
  }
}

function deleteHistEntry(idx) {
  if (idx < 0 || idx >= AppState.hist.length) return;
  const entry = AppState.hist[idx];
  const label = `${entry.sym} ${entry.type} × ${entry.qty} @ ₹${entry.buy}`;
  if (!confirm(`Delete this entry?\n${label}`)) return;
  AppState.hist.splice(idx, 1);
  localStorage.setItem('hist', JSON.stringify(AppState.hist));
  if (AppState.currentUser) saveUserData('history');
  renderHist();
  showPopup('Entry deleted');
}

// ======================================
// CALENDAR FUNCTIONS
// ======================================
function calNav(dir) {
  AppState.calMonth += dir;
  if (AppState.calMonth > 11) { AppState.calMonth = 0; AppState.calYear++; }
  if (AppState.calMonth < 0) { AppState.calMonth = 11; AppState.calYear--; }
  AppState.calSelDay = null;
  renderCalendar();
}

function calSelectDay(d) {
  AppState.calSelDay = (AppState.calSelDay === d) ? null : d;
  renderCalendar();
}

function renderCalendar() {
  const el = document.getElementById('historyCalendar');
  if (!el) return;
  const now = new Date();
  const yr = AppState.calYear, mo = AppState.calMonth;
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayData = {};
  AppState.hist.forEach(x => {
    if (!x.date) return;
    const xDate = new Date(x.date);
    if (isNaN(xDate)) return;
    if (xDate.getFullYear() !== yr || xDate.getMonth() !== mo) return;
    const dnum = xDate.getDate();
    if (!dayData[dnum]) dayData[dnum] = { pnl: 0, hasSell: false, trades: [] };
    if (x.type === 'SELL' && x.pnl != null) { dayData[dnum].pnl += x.pnl; dayData[dnum].hasSell = true; }
    dayData[dnum].trades.push(x);
  });

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <button onclick="calNav(-1)" style="background:#1e3a5f;color:#38bdf8;border:none;border-radius:6px;padding:4px 10px;font-size:14px;font-weight:700;cursor:pointer;">&lt;</button>
    <span style="font-size:13px;font-weight:700;color:#94a3b8;">${monthNames[mo]} ${yr}</span>
    <button onclick="calNav(1)" style="background:#1e3a5f;color:#38bdf8;border:none;border-radius:6px;padding:4px 10px;font-size:14px;font-weight:700;cursor:pointer;">&gt;</button>
  </div>`;

  html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">`;
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    html += `<div style="text-align:center;font-size:9px;color:#4b6280;font-weight:700;padding:2px;">${d}</div>`;
  });
  html += `</div>`;

  html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">`;
  for (let i = 0; i < firstDay; i++) html += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = dayData[d];
    const isToday = now.getDate() === d && now.getMonth() === mo && now.getFullYear() === yr;
    const isSel = AppState.calSelDay === d;
    let bg = '#1e2d3d', color = '#4b6280', fw = '400';
    if (dd) {
      if (dd.hasSell) { bg = dd.pnl >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'; color = dd.pnl >= 0 ? '#22c55e' : '#ef4444'; fw = '700'; }
      else { bg = 'rgba(56,189,248,0.15)'; color = '#38bdf8'; fw = '600'; }
    }
    const border = isSel ? '2px solid #f59e0b' : isToday ? '1px solid #38bdf8' : '1px solid transparent';
    const cursor = dd ? 'cursor:pointer' : 'cursor:default';
    html += `<div onclick="${dd ? `calSelectDay(${d})` : ''}" style="text-align:center;padding:5px 2px;border-radius:6px;background:${bg};border:${border};${cursor};transition:opacity 0.1s;">
      <div style="font-size:11px;font-weight:${fw};color:${color};">${d}</div>
      ${dd && dd.hasSell ? `<div style="font-size:8px;color:${color};">${dd.pnl >= 0 ? '+' : ''}${Math.abs(dd.pnl) >= 1000 ? (dd.pnl / 1000).toFixed(1) + 'k' : dd.pnl.toFixed(0)}</div>` : ''}
      ${dd && !dd.hasSell ? `<div style="font-size:8px;color:#38bdf8;">B</div>` : ''}
    </div>`;
  }
  html += `</div>`;

  html += `<div style="display:flex;gap:10px;margin-top:8px;justify-content:center;">
    <span style="font-size:9px;color:#22c55e;">+ Profit day</span>
    <span style="font-size:9px;color:#ef4444;">- Loss day</span>
    <span style="font-size:9px;color:#38bdf8;">Buy only</span>
  </div>`;

  if (AppState.calSelDay && dayData[AppState.calSelDay]) {
    const trades = dayData[AppState.calSelDay].trades;
    const dateStr = `${String(AppState.calSelDay).padStart(2, '0')}/${String(mo + 1).padStart(2, '0')}/${yr}`;
    html += `<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:6px;">Trades on ${dateStr} (${trades.length})</div>`;
    trades.forEach(x => {
      const isBuy = x.type === 'BUY';
      const pnlStr = (!isBuy && x.pnl != null) ? `<span style="font-weight:700;color:${x.pnl >= 0 ? '#22c55e' : '#ef4444'};">${x.pnl >= 0 ? '+' : ''}${inr(x.pnl)}</span>` : '';
      html += `<div style="background:#111827;border-radius:8px;padding:7px 10px;margin-bottom:4px;display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;">
        <div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;">${x.sym}</span>
          <span style="font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;background:${isBuy ? '#166534' : '#7f1d1d'};color:${isBuy ? '#86efac' : '#fca5a5'};margin-left:4px;">${x.type}</span>
          ${x.tradeType ? `<span style="font-size:9px;padding:1px 4px;border-radius:3px;font-weight:700;background:${x.tradeType === 'MIS' ? '#4a1d96' : '#1e3a5f'};color:${x.tradeType === 'MIS' ? '#c4b5fd' : '#93c5fd'};margin-left:3px;">${x.tradeType}</span>` : ''}
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">Qty:${x.qty} @ ${inr(parseFloat(isBuy ? x.buy : x.sell))}</span>
        ${pnlStr}
      </div>`;
    });
    html += `</div>`;
  } else if (AppState.calSelDay) {
    html += `<div style="margin-top:8px;text-align:center;color:#4b6280;font-size:11px;">No trades on this day</div>`;
  }

  el.innerHTML = html;
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.renderHold = renderHold;
window.updatePortfolioDashboard = updatePortfolioDashboard;
window.drawPieChart = drawPieChart;
window.openAvgCalc = openAvgCalc;
window.closeAvgCalc = closeAvgCalc;
window.setAvgMode = setAvgMode;
window.calcAvg = calcAvg;
window.calcTargetQty = calcTargetQty;
window.setHistView = setHistView;
window.renderHist = renderHist;
window.deleteHistEntry = deleteHistEntry;
window.calNav = calNav;
window.calSelectDay = calSelectDay;
window.renderCalendar = renderCalendar;

console.log('✅ holdings.js loaded successfully');