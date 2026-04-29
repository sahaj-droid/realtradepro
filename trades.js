// ========================================
// TRADES MODULE — RealTradePro v3.0
// Handles: Trade Modal (BUY/SELL/EDIT), Trade Type (CNC/MIS), Tax Calculator, Backup/Restore, CSV Export
// ========================================
// ======================================
// TRADE TYPE SETTER
// ======================================
function setTradeType(t) {
  AppState.currentTradeType = t;
  ['CNC', 'MIS'].forEach(x => {
    const btn = document.getElementById('type-' + x.toLowerCase());
    if (!btn) return;
    const active = x === t;
    btn.style.background = active ? '#1e3a5f' : '#1e2d3d';
    btn.style.color = active ? '#38bdf8' : '#94a3b8';
    btn.style.borderColor = active ? '#38bdf8' : '#2d3f52';
  });
  updateTaxCalc();
}

// ======================================
// TAX CALCULATOR
// ======================================
function updateTaxCalc() {
  const p = parseFloat(document.getElementById("m-price")?.value) || 0;
  const q = parseInt(document.getElementById("m-qty")?.value) || 0;
  const box = document.getElementById("taxCalcBox");
  const type = AppState.currentTrade.type || 'BUY';
  
  if (!box) return;
  if (!p || !q) { 
    box.style.display = "none"; 
    return; 
  }
  box.style.display = "block";

  const val = p * q;
  const brok = Math.min(val * 0.0015, 20);
  const gst = brok * 0.18;
  const exchange = val * 0.0000345;

  let stt = 0;
  if (AppState.currentTradeType === "CNC") {
    stt = val * 0.001;
  } else {
    if (type === "SELL") stt = val * 0.00025;
  }

  const total = brok + gst + exchange + stt;
  const breakeven = type === "BUY" ? p + (total / q) : p - (total / q);

  const tcValue = document.getElementById("tc-value");
  const tcBrokerage = document.getElementById("tc-brokerage");
  const tcStt = document.getElementById("tc-stt");
  const tcExchange = document.getElementById("tc-exchange");
  const tcGst = document.getElementById("tc-gst");
  const tcTotal = document.getElementById("tc-total");
  const tcBreakeven = document.getElementById("tc-breakeven");

  if (tcValue) tcValue.innerText = inr(val);
  if (tcBrokerage) tcBrokerage.innerText = inr(brok);
  if (tcStt) tcStt.innerText = inr(stt);
  if (tcExchange) tcExchange.innerText = inr(exchange);
  if (tcGst) tcGst.innerText = inr(gst);
  if (tcTotal) tcTotal.innerText = inr(total);
  if (tcBreakeven) tcBreakeven.innerText = inr(breakeven);
}

// ======================================
// OPEN TRADE MODAL
// ======================================
function openModal(type, sym, price) {
  AppState.currentTrade = { type, sym };
  
  const mTitle = document.getElementById("m-title");
  const confirmBtn = document.getElementById("confirmBtn");
  const mPrice = document.getElementById("m-price");
  const mQty = document.getElementById("m-qty");
  const mDate = document.getElementById("m-date");
  const typeRow = document.getElementById("m-type-row");
  
  if (mTitle) mTitle.innerText = type + "  -  " + sym;
  if (confirmBtn) confirmBtn.style.background = type === "BUY" ? "#166534" : "#7f1d1d";
  if (mPrice) mPrice.value = price;
  if (mQty) mQty.value = "";
  if (mDate) mDate.value = new Date().toISOString().split('T')[0];
  
  if (typeRow) typeRow.style.display = (type === "EDIT") ? "none" : "flex";
  
  setTradeType(AppState.currentTradeType);
  
  const taxCalcBox = document.getElementById("taxCalcBox");
  if (taxCalcBox) taxCalcBox.style.display = "none";
  
  const modal = document.getElementById("modal");
  if (modal) modal.classList.remove("hidden");
}

function openEdit(sym) {
  let stock = AppState.h.find(x => x.sym === sym);
  if (!stock) return;
  
  AppState.currentTrade = { type: "EDIT", sym };
  
  const mTitle = document.getElementById("m-title");
  const mPrice = document.getElementById("m-price");
  const mQty = document.getElementById("m-qty");
  const mDate = document.getElementById("m-date");
  const confirmBtn = document.getElementById("confirmBtn");
  const typeRow = document.getElementById("m-type-row");
  
  if (mTitle) mTitle.innerText = "EDIT  -  " + sym;
  if (mPrice) mPrice.value = stock.price;
  if (mQty) mQty.value = stock.qty;
  if (mDate) mDate.value = stock.buyDate || new Date().toISOString().split('T')[0];
  if (confirmBtn) confirmBtn.style.background = "#713f12";
  if (typeRow) typeRow.style.display = "none";
  
  const taxCalcBox = document.getElementById("taxCalcBox");
  if (taxCalcBox) taxCalcBox.style.display = "none";
  
  const modal = document.getElementById("modal");
  if (modal) modal.classList.remove("hidden");
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.add("hidden");
}

// ======================================
// CONFIRM TRADE (BUY/SELL/EDIT)
// ======================================
function confirmTrade() {
  let p = parseFloat(document.getElementById("m-price").value);
  let q = parseInt(document.getElementById("m-qty").value);
  let d = document.getElementById("m-date").value;
  
  if (!p || !q) return;
  
  let ex = AppState.h.find(x => x.sym === AppState.currentTrade.sym);

  if (AppState.currentTrade.type === "EDIT") {
    let s = AppState.h.find(x => x.sym === AppState.currentTrade.sym);
    if (!s) return;
    s.price = p;
    s.qty = q;
    s.buyDate = d;
    localStorage.setItem("h", JSON.stringify(AppState.h));
    if (AppState.currentUser) saveUserData('holdings');
    triggerAutoSync('holdings');
    closeModal();
    if (typeof renderHold === 'function') renderHold();
    return;
  }

  if (AppState.currentTrade.type === "BUY") {
    if (ex) {
      let tq = ex.qty + q;
      ex.price = ((ex.price * ex.qty) + (p * q)) / tq;
      ex.qty = tq;
      if (!ex.buyDate) ex.buyDate = d;
    } else {
      AppState.h.push({
        sym: AppState.currentTrade.sym,
        qty: q,
        price: p,
        buyDate: d,
        tradeType: AppState.currentTradeType
      });
    }
    AppState.hist.unshift({
      sym: AppState.currentTrade.sym,
      qty: q,
      buy: p,
      sell: null,
      date: d,
      pnl: null,
      type: 'BUY',
      tradeType: AppState.currentTradeType
    });
    localStorage.setItem("h", JSON.stringify(AppState.h));
    localStorage.setItem("hist", JSON.stringify(AppState.hist));
    if (AppState.currentUser) {
      saveUserData('holdings');
      saveUserData('history');
    }
    triggerAutoSync('history');
    closeModal();
    if (typeof renderHold === 'function') renderHold();
    if (typeof renderHist === 'function') renderHist();
    return;
  }

  if (AppState.currentTrade.type === "SELL") {
    if (!ex || q > ex.qty) {
      showPopup("Invalid Quantity");
      return;
    }
    let pnl = (p - ex.price) * q;
    const buyDate = ex.buyDate;
    if (q === ex.qty) {
      AppState.h = AppState.h.filter(x => x.sym !== ex.sym);
    } else {
      ex.qty -= q;
    }
    AppState.hist.unshift({
      sym: ex.sym,
      qty: q,
      buy: ex.price,
      sell: p,
      date: d,
      pnl: pnl,
      type: 'SELL',
      tradeType: AppState.currentTradeType,
      buyDate: buyDate
    });
    localStorage.setItem("h", JSON.stringify(AppState.h));
    localStorage.setItem("hist", JSON.stringify(AppState.hist));
    if (AppState.currentUser) {
      saveUserData('holdings');
      saveUserData('history');
    }
    closeModal();
    if (typeof renderHold === 'function') renderHold();
    if (typeof renderHist === 'function') renderHist();
    if (typeof tab === 'function') tab("history");
  }
}

// ======================================
// BACKUP & RESTORE
// ======================================
function backupData() {
  const data = {
    wl: AppState.wl,
    h: AppState.h,
    hist: AppState.hist,
    alerts: AppState.alerts,
    groups: AppState.groups,
    targets: AppState.targets,
    exportedAt: new Date().toLocaleString('en-IN'),
    version: "1.3"
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RealTraderPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showPopup("Backup downloaded!");
}

function triggerRestore() {
  const old = document.getElementById("restoreInput");
  if (old) old.remove();
  
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json";
  inp.id = "restoreInput";
  inp.style.display = "none";
  inp.onchange = handleRestore;
  document.body.appendChild(inp);
  inp.click();
}

function handleRestore(event) {
  const file = event.target.files[0];
  if (!file) { 
    event.target.remove(); 
    return; 
  }
  if (!confirm("This will replace existing data. Continue?")) { 
    event.target.remove(); 
    return; 
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.wl) { 
        AppState.wl = data.wl;
        localStorage.setItem("wl", JSON.stringify(AppState.wl));
      }
      if (data.h) { 
        AppState.h = data.h;
        localStorage.setItem("h", JSON.stringify(AppState.h));
      }
      if (data.hist) { 
        AppState.hist = data.hist;
        localStorage.setItem("hist", JSON.stringify(AppState.hist));
      }
      if (data.alerts) { 
        AppState.alerts = data.alerts;
        localStorage.setItem("alerts", JSON.stringify(AppState.alerts));
      }
      if (data.groups) { 
        AppState.groups = data.groups;
        localStorage.setItem("groups", JSON.stringify(AppState.groups));
      }
      if (data.targets) { 
        AppState.targets = data.targets;
        localStorage.setItem("targets", JSON.stringify(AppState.targets));
      }
      event.target.remove();
      showPopup("Data restored! Reloading...");
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showPopup("Invalid backup file");
      event.target.remove();
    }
  };
  reader.readAsText(file);
}

// ======================================
// EXPORT CSV (History)
// ======================================
function exportCSV() {
  if (!AppState.hist || AppState.hist.length === 0) {
    showPopup('No history to export');
    return;
  }
  
  const rows = ['Type,Symbol,TradeType,BuyPrice,SellPrice,Qty,PnL,Date,BuyDate'];
  AppState.hist.forEach(x => {
    const row = [
      x.type || '',
      x.sym || '',
      x.tradeType || '',
      x.buy || '',
      x.sell || '',
      x.qty || '',
      x.pnl != null ? x.pnl.toFixed(2) : '',
      x.date || '',
      x.buyDate || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    rows.push(row);
  });
  
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'RealTraderPro_History_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showPopup('CSV exported!');
}

// ======================================
// EXPORT TECHNICAL SNAPSHOT (Excel) — Mobile Ready
// ======================================
async function exportTechnicalExcel() {
  const btn = document.getElementById('exportTechBtn');
  if (btn) {
    btn.textContent = 'Loading...';
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
  }

  try {
    // ✅ Mobile-friendly SheetJS loading (with CORS fallback)
    if (typeof XLSX === 'undefined') {
      await new Promise((resolve, reject) => {
        // Try primary CDN (fast, modern)
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = () => {
          // Fallback to cdnjs (backup)
          const fallbackScript = document.createElement('script');
          fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          fallbackScript.onload = resolve;
          fallbackScript.onerror = reject;
          document.head.appendChild(fallbackScript);
        };
        document.head.appendChild(script);
      });
    }

    showPopup('📊 Fetching technical data...', 2000);

    const db = firebase.firestore();
    const lpDoc = await db.collection('RealTradePro').doc('live_prices').get();
    const livePrices = lpDoc.exists ? (lpDoc.data().prices || {}) : {};

    const histSnap = await db.collection('histcache').get();
    const rows = [];

    for (const doc of histSnap.docs) {
      const sym = doc.id;
      const data = doc.data();
      let closes = [], volumes = [];
      try {
        const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
        closes = parsed.close || parsed.closes || parsed || [];
        volumes = parsed.volume || parsed.volumes || [];
      } catch(e) { closes = []; volumes = []; }
      if (!closes || closes.length < 20) continue;

      // Bollinger Bands
      const period = 20;
      const slice = closes.slice(-period);
      const sma = slice.reduce((a,b) => a+b,0) / period;
      const variance = slice.reduce((a,b) => a + (b-sma)**2, 0) / period;
      const std = Math.sqrt(variance);
      const bbUpper = +(sma + 2*std).toFixed(2);
      const bbLower = +(sma - 2*std).toFixed(2);

      // RSI
      let rsi = null;
      if (closes.length >= 15) {
        const rsiCloses = closes.slice(-15);
        let gains = 0, losses = 0;
        for (let i=1; i<rsiCloses.length; i++) {
          const diff = rsiCloses[i] - rsiCloses[i-1];
          if (diff > 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains/14, avgLoss = losses/14;
        rsi = avgLoss === 0 ? 100 : +(100 - (100/(1+(avgGain/avgLoss)))).toFixed(2);
      }

      // MACD
      const macdResult = calcMACD(closes);
      const macdVal = macdResult ? macdResult.macd : '-';
      const macdSignal = macdResult ? macdResult.signal : '-';
      const macdHist = macdResult ? macdResult.histogram : '-';
      const macdTrend = macdResult ? macdResult.trend : '-';

      // 3-month avg volume
      let avgVol3M = 0;
      if (volumes && volumes.length > 0) {
        const volSlice = volumes.slice(-63).filter(v => v > 0);
        if (volSlice.length > 0) {
          avgVol3M = Math.round(volSlice.reduce((a,b)=>a+b,0) / volSlice.length);
        }
      }

      // Current price and volume
      const lp = livePrices[sym+'.NS'] || livePrices[sym+'.BO'] || livePrices[sym] || {};
      const cd = AppState.cache[sym]?.data || {};
      const cmp = lp.ltp || lp.regularMarketPrice || cd.regularMarketPrice || closes[closes.length-1] || 0;
      const volume = lp.today_volume || lp.regularMarketVolume || cd.regularMarketVolume || lp.volume || 0;

      rows.push({
        Symbol: sym,
        CMP: +cmp.toFixed(2),
        'BB Upper': bbUpper,
        'BB Lower': bbLower,
        RSI: rsi || '-',
        MACD: macdVal,
        'Signal Line': macdSignal,
        Histogram: macdHist,
        'MACD Signal': macdTrend,
        'Today Vol': volume,
        'Avg Vol (3M)': avgVol3M
      });
    }

    if (rows.length === 0) {
      showPopup('No data found');
      return;
    }

    rows.sort((a,b) => a.Symbol.localeCompare(b.Symbol));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:14},{wch:10},{wch:12},{wch:12},{wch:8},{wch:10},{wch:11},{wch:11},{wch:14},{wch:14},{wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Technical Snapshot');

    const ist = new Date().toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}).replace(/[/:,\s]/g, '-');
    const fname = `RealTradePro_Technical_${ist}.xlsx`;

    // ✅ Mobile-friendly download (using Blob + URL + click)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    showPopup(`✅ Excel exported — ${rows.length} stocks`);
  } catch (e) {
    console.error('[ExportTech]', e);
    showPopup('Export failed: ' + e.message);
  } finally {
    if (btn) {
      btn.textContent = 'Export';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  }
}

// ======================================
// HOLDINGS CSV IMPORT
// ======================================
function triggerCSVImport() {
  document.getElementById("csvImportInput").click();
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.split('\n').map(l => l.trim()).filter(l => l);
    let imported = 0, skipped = 0;

    const startIdx = lines[0].toUpperCase().includes('SYMBOL') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) { skipped++; continue; }
      const sym = cols[0].toUpperCase();
      const qty = parseInt(cols[1]);
      const price = parseFloat(cols[2]);
      const date = cols[3] || new Date().toISOString().split('T')[0];
      if (!sym || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) { skipped++; continue; }
      const ex = AppState.h.find(x => x.sym === sym);
      if (ex) {
        const tq = ex.qty + qty;
        ex.price = ((ex.price * ex.qty) + (price * qty)) / tq;
        ex.qty = tq;
      } else {
        AppState.h.push({ sym, qty, price, buyDate: date });
      }
      imported++;
    }
    localStorage.setItem("h", JSON.stringify(AppState.h));
    if (AppState.currentUser) saveUserData('holdings');
    event.target.value = "";
    showPopup(`Import: ${imported} stocks, ${skipped} skipped`);
    if (typeof tab === 'function') tab("holdings");
    if (typeof renderHold === 'function') renderHold();
  };
  reader.readAsText(file);
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.setTradeType = setTradeType;
window.updateTaxCalc = updateTaxCalc;
window.openModal = openModal;
window.openEdit = openEdit;
window.closeModal = closeModal;
window.confirmTrade = confirmTrade;
window.backupData = backupData;
window.triggerRestore = triggerRestore;
window.handleRestore = handleRestore;
window.exportCSV = exportCSV;
window.exportTechnicalExcel = exportTechnicalExcel;
window.triggerCSVImport = triggerCSVImport;
window.handleCSVImport = handleCSVImport;

console.log('✅ trades.js loaded successfully');
