// ========================================
// LEARN MODULE — RealTradePro v3.0
// Handles: Learn tab, fundamentals, technicals, quarterly, shareholding, corporate actions, market school
// ========================================

// ======================================
// INIT LEARN TAB
// ======================================
function initLearnTab() {
  setLearnLang(AppState._learnLang);
  switchLearnMain('financial');
}

// ======================================
// LANGUAGE SELECTOR
// ======================================
function setLearnLang(lang) {
  AppState._learnLang = lang;
  localStorage.setItem('learnLang', lang);
  ['hi','gu','en'].forEach(l => {
    const btn = document.getElementById('ll-'+l);
    if (!btn) return;
    if (l === lang) {
      btn.style.background = 'rgba(251,146,60,0.2)';
      btn.style.color = '#fb923c';
      btn.style.borderColor = 'rgba(251,146,60,0.3)';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#64748b';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  });
  const sym = (document.getElementById('learnSearchInput')||{}).value;
  if (sym && AppState._learnCache[sym.toUpperCase().trim()]) {
    renderLearnReport(AppState._learnCache[sym.toUpperCase().trim()], sym.toUpperCase().trim());
  }
}

// ======================================
// MAIN TAB SWITCHER (Financial vs School)
// ======================================
function switchLearnMain(tab) {
  AppState._learnMainTab = tab;
  const isFinancial = tab === 'financial';

  const finPanel = document.getElementById('lpanel-financial');
  const schPanel = document.getElementById('lpanel-school');
  if (finPanel) finPanel.style.display = isFinancial ? 'flex' : 'none';
  if (schPanel) schPanel.style.display = isFinancial ? 'none' : 'block';

  const finBtn = document.getElementById('lmain-financial');
  const schBtn = document.getElementById('lmain-school');
  if (finBtn) {
    finBtn.style.borderBottomColor = isFinancial ? '#fb923c' : 'transparent';
    finBtn.style.background = isFinancial ? 'rgba(251,146,60,0.08)' : 'transparent';
    finBtn.style.color = isFinancial ? '#fb923c' : '#64748b';
  }
  if (schBtn) {
    schBtn.style.borderBottomColor = !isFinancial ? '#fb923c' : 'transparent';
    schBtn.style.background = !isFinancial ? 'rgba(251,146,60,0.08)' : 'transparent';
    schBtn.style.color = !isFinancial ? '#fb923c' : '#64748b';
  }

  if (!isFinancial) renderMarketSchool();
}

// ======================================
// SUB-TAB SWITCHER (Fundamentals, Technicals, Shareholding, Quarterly, Cashflow, Corporate)
// ======================================
function switchLearnTab(tabName) {
  AppState._learnActiveTab = tabName;
  const tabs = ['fundamentals','technicals','shareholding','quarterly','cashflow','corporate'];
  tabs.forEach(t => {
    const btn = document.getElementById('lst-' + t);
    if (!btn) return;
    if (t === tabName) {
      btn.style.background = 'rgba(251,146,60,0.15)';
      btn.style.color = '#fb923c';
      btn.style.borderColor = 'rgba(251,146,60,0.5)';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#64748b';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  });
  const sym = (document.getElementById('learnSearchInput')||{}).value?.trim().toUpperCase();
  if (sym && AppState._learnCache[sym]) {
    _renderLearnTab(tabName, AppState._learnCache[sym], sym);
  }
}

// ======================================
// SEARCH SUGGESTIONS
// ======================================
function learnSearchSuggest(val) {
  const box = document.getElementById('learnSuggBox');
  if (!box) return;
  const v = val.trim().toUpperCase();
  if (v.length < 1) { box.style.display = 'none'; return; }
  const allSyms = [...new Set([...(typeof AppState.wl !== 'undefined' ? AppState.wl : []), ...(typeof POPULAR_STOCKS !== 'undefined' ? POPULAR_STOCKS : [])])];
  const matches = allSyms.filter(s => s.toUpperCase().startsWith(v)).slice(0, 8);
  if (matches.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(s =>
    `<div onclick="document.getElementById('learnSearchInput').value='${s}';document.getElementById('learnSuggBox').style.display='none';fetchLearnStock();"
      style="padding:8px 14px;font-size:12px;font-weight:700;color:#e2e8f0;cursor:pointer;font-family:'Rajdhani',sans-serif;border-bottom:1px solid rgba(255,255,255,0.05);"
      onmouseover="this.style.background='rgba(251,146,60,0.1)'" onmouseout="this.style.background=''">${s}</div>`
  ).join('');
  box.style.display = 'block';
}

// ======================================
// FETCH LEARN STOCK (Firebase → FF2 → GAS)
// ======================================
async function fetchLearnStock() {
  const input = document.getElementById('learnSearchInput');
  const msg = document.getElementById('learnMsg');
  const res = document.getElementById('learnResults');
  if (!input) return;
  const sym = input.value.trim().toUpperCase();
  if (!sym) { if(msg) msg.textContent = 'Stock symbol daalo'; return; }
  document.getElementById('learnSuggBox').style.display = 'none';
  if (msg) { msg.textContent = '⏳ Loading data...'; msg.style.color = '#64748b'; }
  if (res) res.innerHTML = '';

  // 1. Firebase fundlearn
  try {
    const doc = await firebase.firestore().collection('fundlearn').doc(sym).get();
    if (doc.exists) {
      const d = doc.data();
      function fv(f) {
        if (f === null || f === undefined) return 0;
        if (typeof f === "number") return f;
        if (typeof f === "string") return Number(f) || 0;
        if (f.doubleValue !== undefined) return Number(f.doubleValue);
        if (f.integerValue !== undefined) return Number(f.integerValue);
        return 0;
      }
      const raw = {
        sym, source: 'firebase',
        netProfit: fv(d.netProfit),
        totalEquity: fv(d.totalEquity),
        totalShares: fv(d.totalShares),
        ebit: fv(d.ebit),
        capEmployed: fv(d.capEmployed),
        roce: fv(d.roce),
        ncf: fv(d.ncf),
        totalDebt: fv(d.totalDebt),
        dividend: fv(d.dividend),
        currAsset: fv(d.currAsset),
        currLiab: fv(d.currLiab),
        promoter: fv(d.promoter),
        fii: fv(d.fii),
        dii: fv(d.dii),
        pubHolding: fv(d.pubHolding),
        eps: fv(d.eps),
        opProfit: fv(d.opProfit),
        fcf: fv(d.fcf),
        deRatio: fv(d.deRatio),
        roa: fv(d.roa),
        ebitda: fv(d.ebitda),
        pe: fv(d.pe),
        bookValue: fv(d.bookValue),
        roe: fv(d.roe),
        quarterlyHeaders: Array.isArray(d.quarterly_headers) && d.quarterly_headers.length ? d.quarterly_headers : ['Q1','Q2','Q3','Q4','Q5'],
        salesQ1: fv(Array.isArray(d.sales_q) ? d.sales_q[0] : d.salesQ1),
        salesQ2: fv(Array.isArray(d.sales_q) ? d.sales_q[1] : d.salesQ2),
        salesQ3: fv(Array.isArray(d.sales_q) ? d.sales_q[2] : d.salesQ3),
        salesQ4: fv(Array.isArray(d.sales_q) ? d.sales_q[3] : d.salesQ4),
        salesQ5: fv(Array.isArray(d.sales_q) ? d.sales_q[4] : d.salesQ5),
        expQ1: fv(Array.isArray(d.expenses_q) ? d.expenses_q[0] : d.expQ1),
        expQ2: fv(Array.isArray(d.expenses_q) ? d.expenses_q[1] : d.expQ2),
        expQ3: fv(Array.isArray(d.expenses_q) ? d.expenses_q[2] : d.expQ3),
        expQ4: fv(Array.isArray(d.expenses_q) ? d.expenses_q[3] : d.expQ4),
        expQ5: fv(Array.isArray(d.expenses_q) ? d.expenses_q[4] : d.expQ5),
        opQ1: fv(Array.isArray(d.op_q) ? d.op_q[0] : d.opQ1),
        opQ2: fv(Array.isArray(d.op_q) ? d.op_q[1] : d.opQ2),
        opQ3: fv(Array.isArray(d.op_q) ? d.op_q[2] : d.opQ3),
        opQ4: fv(Array.isArray(d.op_q) ? d.op_q[3] : d.opQ4),
        opQ5: fv(Array.isArray(d.op_q) ? d.op_q[4] : d.opQ5),
        npQ1: fv(Array.isArray(d.np_q) ? d.np_q[0] : d.npQ1),
        npQ2: fv(Array.isArray(d.np_q) ? d.np_q[1] : d.npQ2),
        npQ3: fv(Array.isArray(d.np_q) ? d.np_q[2] : d.npQ3),
        npQ4: fv(Array.isArray(d.np_q) ? d.np_q[3] : d.npQ4),
        npQ5: fv(Array.isArray(d.np_q) ? d.np_q[4] : d.npQ5),
        pbtQ1: fv(Array.isArray(d.pbt_q) ? d.pbt_q[0] : d.pbtQ1),
        pbtQ2: fv(Array.isArray(d.pbt_q) ? d.pbt_q[1] : d.pbtQ2),
        pbtQ3: fv(Array.isArray(d.pbt_q) ? d.pbt_q[2] : d.pbtQ3),
        pbtQ4: fv(Array.isArray(d.pbt_q) ? d.pbt_q[3] : d.pbtQ4),
        pbtQ5: fv(Array.isArray(d.pbt_q) ? d.pbt_q[4] : d.pbtQ5),
        otherIncQ1: fv(Array.isArray(d.other_inc_q) ? d.other_inc_q[0] : d.otherIncQ1),
        otherIncQ2: fv(Array.isArray(d.other_inc_q) ? d.other_inc_q[1] : d.otherIncQ2),
        otherIncQ3: fv(Array.isArray(d.other_inc_q) ? d.other_inc_q[2] : d.otherIncQ3),
        otherIncQ4: fv(Array.isArray(d.other_inc_q) ? d.other_inc_q[3] : d.otherIncQ4),
        otherIncQ5: fv(Array.isArray(d.other_inc_q) ? d.other_inc_q[4] : d.otherIncQ5),
      };
      raw.sharePrice = _getLivePrice(sym);
      await _enrichWithTechnicals(raw, sym);
      AppState._learnCache[sym] = raw;
      if (msg) { msg.textContent = '✅ Firebase · ' + (d.updatedAt ? (d.updatedAt.stringValue || d.updatedAt).toString().substring(0,10) : ''); msg.style.color = '#34d399'; }
      renderLearnReport(raw, sym);
      return;
    }
  } catch(e) { console.warn('Firebase fundlearn fetch failed:', e.message); }

  // 2. FF2 GAS URL
  const ff2Url = localStorage.getItem('ff2ApiUrl') || '';
  if (ff2Url) {
    try {
      const url = `${ff2Url}?type=ff2_search&s=${sym}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.success && data.data) {
        const d = data.data;
        const raw = {
          sym, source: 'ff2',
          netProfit: Number(d.profit) || 0,
          totalEquity: Number(d.equity) || 0,
          totalShares: Number(d.shares) || 0,
          ebit: Number(d.ebit) || 0,
          capEmployed: Number(d.ce) || 0,
          totalDebt: Number(d.debt) || 0,
          dividend: Number(d.div) || 0,
          currAsset: Number(d.assets) || 0,
          currLiab: Number(d.liab) || 0,
          promoter: Number(d.prom) || 0,
          fii: Number(d.fii) || 0,
          dii: Number(d.dii) || 0,
          pubHolding: Number(d.pub) || 0,
          eps: Number(d.eps) || 0,
          opProfit: Number(d.opProfit) || 0,
          fcf: Number(d.fcf) || 0,
          deRatio: Number(d.de) || 0,
          roa: Number(d.roa) || 0,
          ebitda: Number(d.ebitda) || 0,
        };
        raw.sharePrice = _getLivePrice(sym);
        await _enrichWithTechnicals(raw, sym);
        AppState._learnCache[sym] = raw;
        if (msg) { msg.textContent = '✅ FF2 Screener data'; msg.style.color = '#fb923c'; }
        renderLearnReport(raw, sym);
        return;
      }
      await _addToWaitlist(sym, msg);
      return;
    } catch(e) {
      if (msg) { msg.textContent = '❌ FF2 fetch failed: ' + e.message; msg.style.color = '#f87171'; }
      await _addToWaitlist(sym, msg);
      return;
    }
  }

  // 3. RealTradePro GAS fallback
  try {
    const apiUrl = localStorage.getItem('customAPI') || API;
    const url = `${apiUrl}?type=fundlearn&s=${sym}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.ok) {
      data.sharePrice = _getLivePrice(sym);
      data.source = 'gas';
      await _enrichWithTechnicals(data, sym);
      AppState._learnCache[sym] = data;
      if (msg) { msg.textContent = '✅ GAS Sheet fetch'; msg.style.color = '#38bdf8'; }
      renderLearnReport(data, sym);
      return;
    }
    await _addToWaitlist(sym, msg);
  } catch(e) {
    await _addToWaitlist(sym, msg);
  }
}

// ======================================
// WAITLIST HELPER
// ======================================
async function _addToWaitlist(sym, msg) {
  if (msg) { msg.textContent = `⏳ "${sym}" DB ma nathi — Waitlist ma add thai rahu che...`; msg.style.color = '#f59e0b'; }
  try {
    await firebase.firestore().collection('new_requests').doc(sym).set({
      symbol: sym,
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
      requestedBy: (AppState.currentUser?.userId) ? AppState.currentUser.userId : 'anonymous'
    });
    if (msg) {
      msg.textContent = `✅ "${sym}" waitlist ma add thayo! Python run thase tyare automatically sheet + Firebase ma aavse.`;
      msg.style.color = '#34d399';
    }
  } catch(e) {
    if (msg) {
      msg.textContent = `❌ "${sym}" DB ma nathi. Waitlist error: ${e.message}`;
      msg.style.color = '#f87171';
    }
  }
}

// ======================================
// GET LIVE PRICE
// ======================================
function _getLivePrice(sym) {
  if (typeof AppState.cache !== 'undefined' && AppState.cache[sym]?.data?.regularMarketPrice) return AppState.cache[sym].data.regularMarketPrice;
  if (typeof AppState.cache !== 'undefined' && AppState.cache[sym+'NS']?.data?.regularMarketPrice) return AppState.cache[sym+'NS'].data.regularMarketPrice;
  if (window._firebaseFundCache?.[sym]?.sharePrice) return window._firebaseFundCache[sym].sharePrice;
  return 0;
}

// ======================================
// ENRICH WITH TECHNICALS
// ======================================
async function _enrichWithTechnicals(raw, sym) {
  raw['52wHigh'] = (raw.high52 && raw.high52 > 0) ? raw.high52 : null;
  raw['52wLow'] = (raw.low52 && raw.low52 > 0) ? raw.low52 : null;
  raw['beta'] = (raw.beta && raw.beta > 0) ? raw.beta : null;

  try {
    const proxyBase = localStorage.getItem('customAPI2') || localStorage.getItem('customAPI') || API;
    if (!proxyBase) { raw.rsi = null; return raw; }
    const r = await fetch(`${proxyBase}?type=history&s=${sym}.NS&range=3mo&interval=1d`);
    if (!r.ok) throw new Error('ohlcv fetch failed');
    const data = await r.json();
    const closes = (data.close || data.closes || data.c || []);
    raw.rsi = closes.length >= 15 ? calculateLearnRSI(closes) : null;
    raw.macd = closes.length >= 26 ? (() => { const m = calcMACD(closes); return m ? m.macd : null; })() : null;
    raw.ema20 = closes.length >= 20 ? calcEMA(closes, 20) : null;
    raw.ema50 = closes.length >= 50 ? calcEMA(closes, 50) : null;
  } catch(e) {
    raw.rsi = null; raw.macd = null; raw.ema20 = null; raw.ema50 = null;
  }
  return raw;
}

function calculateLearnRSI(c) {
  if (!c || c.length < 15) return null;
  let g = 0, l = 0;
  for (let i = 1; i < 15; i++) {
    let diff = c[i] - c[i-1];
    if (diff >= 0) g += diff; else l -= diff;
  }
  let rs = (g / 14) / (l / 14);
  return 100 - (100 / (1 + rs));
}

// ======================================
// CALCULATE LEARN RATIOS
// ======================================
function calcLearnRatios(d) {
  const safe = (v) => (v === null || v === undefined || isNaN(v) || !isFinite(v)) ? null : v;
  const safeRange = (v, min, max) => {
    const n = safe(v);
    return (n !== null && n >= min && n <= max) ? n : null;
  };

  const eps = safeRange(d.eps, 0.01, 50000);
  let pe = safeRange(d.pe, 0.1, 500);
  if (!pe && d.sharePrice > 0 && eps > 0) {
    const calc = d.sharePrice / eps;
    pe = safeRange(calc, 0.1, 500);
  }
  const roe = safeRange(d.roe, 0.01, 200);
  const roce = safeRange(d.roce, 0.01, 200) ?? safeRange(d.capEmployed, 0.01, 200);
  const bv = safeRange(d.bookValue, 0.01, 1000000);
  const de = safeRange(d.deRatio, 0, 20);
  const divY = (d.dividend > 0) ? safeRange(d.dividend, 0, 30) : null;
  const roa = safeRange(d.roa, 0.01, 100);
  const cr = (d.currLiab > 0 && d.currAsset > 0) ? safeRange(d.currAsset / d.currLiab, 0, 20) : null;
  const fii = safeRange(d.fii, 0, 100);
  const dii = safeRange(d.dii, 0, 100);

  return {
    pe: safe(pe),
    eps: safe(eps),
    roe: safe(roe),
    roce: safe(roce),
    bookVal: safe(bv),
    de: safe(de),
    cr: safe(cr),
    divYield: safe(divY),
    promoter: safeRange(d.promoter, 0, 100),
    fii: safe(fii),
    dii: safe(dii),
    roa: safe(roa),
    rsi: (d.rsi !== undefined && d.rsi !== null) ? d.rsi : null
  };
}

// ======================================
// DOT COLOR FOR METRICS
// ======================================
function _learnDot(metric, val) {
  if (val === null) return '#64748b';
  const rules = {
    pe: v => v < 15 ? 'green' : v < 30 ? 'yellow' : 'red',
    eps: v => v > 0 ? 'green' : 'red',
    roe: v => v >= 15 ? 'green' : v >= 8 ? 'yellow' : 'red',
    roce: v => v >= 15 ? 'green' : v >= 8 ? 'yellow' : 'red',
    bookVal: v => v > 0 ? 'green' : 'red',
    de: v => v <= 0.5 ? 'green' : v <= 1 ? 'yellow' : 'red',
    cr: v => v >= 1.5 ? 'green' : v >= 1 ? 'yellow' : 'red',
    divYield: v => v >= 1 ? 'green' : v > 0 ? 'yellow' : 'red',
    promoter: v => v >= 50 ? 'green' : v >= 35 ? 'yellow' : 'red',
    rsi: v => v < 40 ? 'green' : v < 70 ? 'yellow' : 'red',
    fii: v => v >= 10 ? 'green' : v >= 5 ? 'yellow' : 'red',
    dii: v => v >= 5 ? 'green' : v >= 2 ? 'yellow' : 'red',
    roa: v => v >= 10 ? 'green' : v >= 5 ? 'yellow' : 'red'
  };
  const r = rules[metric] ? rules[metric](val) : 'gray';
  return r === 'green' ? '#22c55e' : r === 'yellow' ? '#f59e0b' : r === 'red' ? '#ef4444' : '#64748b';
}

// ======================================
// SHOW LEARN INFO MODAL
// ======================================
function showLearnInfo(metric, val, symRaw) {
  val = (val === null || val === undefined || val === 'null' || isNaN(Number(val))) ? null : Number(val);
  const info = LEARN_INFO[metric];
  if (!info) return;
  const L = info[AppState._learnLang] || info['en'];
  document.getElementById('learnInfoTitle').textContent = L.title;
  document.getElementById('learnInfoBody').textContent = L.body;
  const fEl = document.getElementById('learnInfoFormula');
  fEl.innerHTML = '<b>Formula:</b> ' + L.formula + (L.good ? '<br><span style="color:#f59e0b;">'+L.good+'</span>' : '');
  if (val !== null) {
    fEl.innerHTML += '<br><span style="color:#38bdf8;">Your value: <b>' + (typeof val === 'number' ? val.toFixed(2) : val) + '</b></span>';
  }
  document.getElementById('learnInfoModal').style.display = 'flex';
}

function closeLearnInfo() {
  document.getElementById('learnInfoModal').style.display = 'none';
}

// ======================================
// RENDER LEARN REPORT (Main Dispatcher)
// ======================================
function renderLearnReport(d, sym) {
  const subTabsEl = document.getElementById('learnSubTabs');
  if (subTabsEl) subTabsEl.style.display = 'block';
  _renderLearnTab(AppState._learnActiveTab, d, sym);
}

function _renderLearnTab(tabName, d, sym) {
  const res = document.getElementById('learnResults');
  if (!res) return;
  res.innerHTML = '<div style="text-align:center;padding:20px 0;"><div class="spinner" style="margin:0 auto;"></div></div>';

  setTimeout(() => {
    if (tabName === 'fundamentals') res.innerHTML = _buildFundamentalsTab(d, sym);
    if (tabName === 'technicals') res.innerHTML = _buildTechnicalsTab(d, sym);
    if (tabName === 'shareholding') res.innerHTML = _buildShareholdingTab(d, sym);
    if (tabName === 'quarterly') _buildQuarterlyTab(res, sym);
    if (tabName === 'cashflow') _buildCashflowTab(res, sym);
    if (tabName === 'corporate') _buildCorporateActionsTab(res, sym);
  }, 80);
}

// ======================================
// STOCK HEADER (Common)
// ======================================
function _learnHeader(d, sym) {
  const sp = d.sharePrice > 0 ? '₹' + d.sharePrice.toFixed(2) : null;
  const srcColor = d.source === 'firebase' ? '#34d399' : '#38bdf8';
  const srcLabel = d.source === 'firebase' ? 'Firebase' : d.source === 'ff2' ? 'FF2 Sheet' : 'GAS';
  return `
    <div style="background:#0d1f35;border-radius:12px;padding:11px 14px;margin-bottom:10px;border:1px solid rgba(251,146,60,0.15);display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:17px;font-weight:700;color:#fb923c;font-family:'JetBrains Mono',monospace;line-height:1.1;">${sym}</div>
        ${sp ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">CMP: <span style="color:#e2e8f0;font-weight:700;">${sp}</span></div>` : '<div style="font-size:11px;color:#64748b;">Open stock to load price</div>'}
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:#64748b;margin-bottom:2px;">SOURCE</div>
        <div style="font-size:10px;font-weight:700;color:${srcColor};">${srcLabel}</div>
      </div>
    </div>`;
}

// ======================================
// BUILD FUNDAMENTALS TAB
// ======================================
function _buildFundamentalsTab(d, sym) {
  const R = calcLearnRatios(d);
  const lang = AppState._learnLang;

  let niviText = ({ hi:'इस स्टॉक के पैरामीटर अभी neutral हैं।', gu:'આ સ્ટોકના પેરામીટર્સ અત્યારે neutral છે.', en:'Parameters are currently neutral.' })[lang] || '';
  if (R.rsi !== null && R.rsi < 40 && R.roe !== null && R.roe > 15) {
    niviText = ({ hi:(r)=>`🔥 Strong Buy: ROE ${r}% + RSI Oversold — excellent entry zone.`, gu:(r)=>`🔥 Strong Buy: ROE ${r}% + RSI Oversold — ઉત્તમ entry zone.`, en:(r)=>`🔥 Strong Buy: ROE ${r}% + RSI Oversold — excellent entry zone.` })[lang](R.roe.toFixed(1));
  } else if (R.rsi !== null && R.rsi > 75) {
    niviText = ({ hi:'⚠️ Overbought: नई खरीदारी से पहले correction का इंतज़ार करें।', gu:'⚠️ Overbought: નવી ખરીદી પહેલા correction ની રાહ જુઓ.', en:'⚠️ Overbought: Wait for correction before fresh buying.' })[lang] || '';
  } else if (R.de !== null && R.de > 1.5) {
    niviText = ({ hi:'⚠️ High Debt: D/E ratio ज़्यादा है — कर्ज़ का बोझ देखें।', gu:'⚠️ High Debt: D/E ratio વધારે છે — debt burden ધ્યાનમાં રાખો.', en:'⚠️ High Debt: D/E ratio is elevated — monitor debt burden.' })[lang] || '';
  }

  const fmtV = (metric, val) => {
    if (val === null || val === undefined || isNaN(val)) return '--';
    if (metric === 'eps' || metric === 'bookVal') return '₹' + val.toFixed(2);
    if (['roe','roce','divYield','roa'].includes(metric)) return val.toFixed(2) + '%';
    return val.toFixed(2);
  };

  const metricGroups = [
    { label: { hi:'Valuation', gu:'Valuation', en:'Valuation' }, metrics: ['pe','eps','bookVal'] },
    { label: { hi:'Profitability', gu:'Profitability', en:'Profitability' }, metrics: ['roe','roce','roa'] },
    { label: { hi:'Financial Health', gu:'Financial Health', en:'Financial Health' }, metrics: ['de','cr','divYield'] }
  ];

  const labels = { pe:'P/E Ratio', eps:'EPS', roe:'ROE %', roce:'ROCE %', bookVal:'Book Value', de:'D/E Ratio', cr:'Current Ratio', divYield:'Div Yield %', roa:'ROA %' };

  let html = _learnHeader(d, sym);

  html += `<div style="background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);border-left:3px solid #fb923c;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
    <div style="font-size:9px;color:#fb923c;font-weight:700;letter-spacing:1px;margin-bottom:4px;">NIVI'S INSIGHT</div>
    <div style="font-size:12px;color:#e2e8f0;line-height:1.5;">${niviText}</div>
  </div>`;

  metricGroups.forEach(group => {
    html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
      <div style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
        <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">${group.label[lang]||group.label.en}</span>
      </div>`;
    group.metrics.forEach((m, idx) => {
      const val = R[m];
      const dot = _learnDot(m, val);
      const last = idx === group.metrics.length - 1;
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;${last?'':'border-bottom:1px solid rgba(255,255,255,0.04);'}">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
          <span style="font-size:12px;color:#cbd5e1;">${labels[m]||m}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:#e2e8f0;font-family:'JetBrains Mono',monospace;">${fmtV(m,val)}</span>
          <button onclick="showLearnInfo('${m}',${val!==null?val:'null'},'${sym}')"
            style="width:18px;height:18px;border-radius:50%;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);color:#38bdf8;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">ℹ</button>
        </div>
      </div>`;
    });
    html += '</div>';
  });

  return html;
}

// ======================================
// BUILD TECHNICALS TAB
// ======================================
function _buildTechnicalsTab(d, sym) {
  const R = calcLearnRatios(d);
  let html = _learnHeader(d, sym);

  const techItems = [
    { key: 'rsi', label: 'RSI (14D)', fmt: v => v.toFixed(1), bench: '< 30 Oversold · 30–70 Normal · > 70 Overbought' },
    { key: 'macd', label: 'MACD', fmt: v => v.toFixed(2), bench: '> 0 Bullish · < 0 Bearish' },
    { key: 'ema20', label: 'EMA 20', fmt: v => '₹' + v.toFixed(2), bench: 'Price > EMA = Bullish' },
    { key: 'ema50', label: 'EMA 50', fmt: v => '₹' + v.toFixed(2), bench: 'Price > EMA = Bullish' },
    { key: 'beta', label: 'Beta', fmt: v => v.toFixed(2), bench: '< 1 Low Risk · > 1 High Volatility' },
    { key: '52wHigh', label: '52W High', fmt: v => '₹' + v.toFixed(2), bench: 'Price near high = Momentum' },
    { key: '52wLow', label: '52W Low', fmt: v => '₹' + v.toFixed(2), bench: 'Price near low = Opportunity?' },
  ];

  html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
    <div style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">⚡ TECHNICAL INDICATORS</span>
    </div>`;

  techItems.forEach((item, idx) => {
    const val = (d[item.key] !== undefined && d[item.key] !== null) ? d[item.key] : (R[item.key] !== undefined && R[item.key] !== null) ? R[item.key] : null;
    const fv = val !== null && val !== undefined ? item.fmt(val) : '--';
    const dot = _learnDot(item.key, val);
    const last = idx === techItems.length - 1;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;${last?'':'border-bottom:1px solid rgba(255,255,255,0.04);'}">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#cbd5e1;">${item.label}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:#e2e8f0;font-family:'JetBrains Mono',monospace;">${fv}</span>
    </div>`;
  });

  html += '</div><div style="font-size:10px;color:#4b6280;padding:8px 2px;">Technical indicators based on available data.</div>';
  return html;
}

// ======================================
// BUILD SHAREHOLDING TAB
// ======================================
function _buildShareholdingTab(d, sym) {
  const R = calcLearnRatios(d);
  let html = _learnHeader(d, sym);

  const holders = [
    { label: 'Promoter', val: R.promoter, color: '#7c3aed' },
    { label: 'FII (Foreign)', val: R.fii, color: '#0284c7' },
    { label: 'DII (Domestic)', val: R.dii, color: '#059669' },
    { label: 'Public', val: d.pubHolding || null, color: '#d97706' },
  ];

  html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);padding:14px;">`;

  holders.forEach(h => {
    if (!h.val) return;
    const barW = Math.min(h.val, 100).toFixed(1);
    html += `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-bottom:4px;">
        <span><span style="color:${h.color};">&#9632;</span> ${h.label}</span>
        <b style="color:#e2e8f0;">${h.val.toFixed(1)}%</b>
      </div>
      <div style="background:rgba(255,255,255,0.06);border-radius:4px;height:6px;">
        <div style="width:${barW}%;background:${h.color};border-radius:4px;height:6px;"></div>
      </div>
    </div>`;
  });

  if (holders.every(h => !h.val)) {
    html += `<div style="text-align:center;padding:20px;font-size:12px;color:#64748b;">Shareholding data not available</div>`;
  }

  html += `</div><div style="font-size:10px;color:#4b6280;padding:8px 2px;">Source: Screener.in via Firebase</div>`;
  return html;
}

// ======================================
// BUILD QUARTERLY TAB
// ======================================
async function _buildQuarterlyTab(res, sym) {
  const d = AppState._learnCache[sym];
  if (!d || !d.salesQ1) { res.innerHTML = _learnNoData(sym, 'Quarterly data'); return; }

  const qs = ['Q1','Q2','Q3','Q4','Q5'];
  const qHeaders = (d.quarterlyHeaders && d.quarterlyHeaders.length === 5) ? d.quarterlyHeaders : qs;

  const rows = [
    { label: 'Sales', vals: qs.map(q => d['sales'+q]) },
    { label: 'Expenses', vals: qs.map(q => d['exp'+q]) },
    { label: 'Op Profit', vals: qs.map(q => d['op'+q]) },
    { label: 'Other Inc', vals: qs.map(q => d['otherInc'+q]) },
    { label: 'PBT', vals: qs.map(q => d['pbt'+q]) },
    { label: 'Net Profit', vals: qs.map(q => d['np'+q]) },
  ];

  const fmt = v => (v && v !== 0) ? '₹' + Number(v).toFixed(0) + ' Cr' : '--';
  const growthCell = (curr, prev) => {
    const c = Number(curr), p = Number(prev);
    if (Math.abs(p) < 1 || Math.abs(c) < 1) return `<td style="padding:6px 6px;text-align:right;color:#4b6280;font-size:10px;">--<\/td>`;
    const g = ((c - p) / Math.abs(p)) * 100;
    const color = g >= 5 ? '#22c55e' : g >= 0 ? '#86efac' : g >= -5 ? '#fbbf24' : '#ef4444';
    const sign = g >= 0 ? '+' : '';
    return `<td style="padding:6px 6px;text-align:right;color:${color};font-size:10px;font-weight:600;">${sign}${g.toFixed(1)}%<\/td>`;
  };

  let html = `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;">
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">📊 QUARTERLY RESULTS (Last 5 Quarters)</span>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr style="background:rgba(255,255,255,0.04);">
        <th style="padding:8px 10px;text-align:left;color:#64748b;min-width:90px;">Metric</th>
        ${qs.map((q,i)=>`<th style="padding:8px 8px;text-align:right;color:#94a3b8;font-size:10px;white-space:nowrap;">${qHeaders[i]}</th>`).join('')}
      </tr>`;

  rows.forEach((row, idx) => {
    html += `<tr style="${idx%2===0?'background:rgba(255,255,255,0.01);':''}">
      <td style="padding:8px 10px;color:#cbd5e1;font-weight:600;">${row.label}<\/td>
      ${row.vals.map(v=>`<td style="padding:8px 8px;text-align:right;color:#e2e8f0;font-family:'JetBrains Mono',monospace;">${fmt(v)}<\/td>`).join('')}
    </tr>`;
  });

  html += `<\/table><\/div><\/div>`;

  // QoQ Growth Table
  const qoqRows = rows;
  html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;">
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">📈 QoQ GROWTH — ${qHeaders[3]} vs ${qHeaders[4]}</span>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr style="background:rgba(255,255,255,0.04);">
        <th style="padding:7px 10px;text-align:left;color:#64748b;">Metric</th>
        <th style="padding:7px 8px;text-align:right;color:#94a3b8;font-size:10px;">${qHeaders[3]}</th>
        <th style="padding:7px 8px;text-align:right;color:#94a3b8;font-size:10px;">${qHeaders[4]}</th>
        <th style="padding:7px 8px;text-align:right;color:#94a3b8;font-size:10px;">QoQ %</th>
      </tr>`;

  qoqRows.forEach((row, idx) => {
    const prev = Number(row.vals[3]);
    const curr = Number(row.vals[4]);
    const prevStr = prev ? '₹'+prev.toFixed(0)+' Cr' : '--';
    const currStr = curr ? '₹'+curr.toFixed(0)+' Cr' : '--';
    html += `<tr style="${idx%2===0?'background:rgba(255,255,255,0.01);':''}">
      <td style="padding:7px 10px;color:#cbd5e1;font-weight:600;">${row.label}<\/td>
      <td style="padding:6px 8px;text-align:right;color:#94a3b8;font-family:monospace;font-size:11px;">${prevStr}<\/td>
      <td style="padding:6px 8px;text-align:right;color:#e2e8f0;font-family:monospace;font-size:11px;">${currStr}<\/td>
      ${growthCell(curr, prev)}
    </tr>`;
  });

html += `</table></div></div>`;

// ── YoY Growth Table (Q5 vs Q1 = same quarter last year) ──
html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;">
  <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
    <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">📅 YoY GROWTH — ${qHeaders[4]} vs ${qHeaders[0]}</span>
  </div>
  <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr style="background:rgba(255,255,255,0.04);">
      <th style="padding:7px 10px;text-align:left;color:#64748b;">Metric</th>
      <th style="padding:7px 8px;text-align:right;color:#94a3b8;font-size:10px;">${qHeaders[0]}</th>
      <th style="padding:7px 8px;text-align:right;color:#94a3b8;font-size:10px;">${qHeaders[4]}</th>
      <th style="padding:7px 8px;text-align:right;color:#94a3b8;font-size:10px;">YoY %</th>
    </tr>`;

rows.forEach((row, idx) => {
  const base = Number(row.vals[0]);
  const latest = Number(row.vals[4]);
  const baseStr = base ? '₹'+base.toFixed(0)+' Cr' : '--';
  const latestStr = latest ? '₹'+latest.toFixed(0)+' Cr' : '--';
  html += `<tr style="${idx%2===0?'background:rgba(255,255,255,0.01);':''}">
    <td style="padding:7px 10px;color:#cbd5e1;font-weight:600;">${row.label}<\/td>
    <td style="padding:6px 8px;text-align:right;color:#94a3b8;font-family:monospace;font-size:11px;">${baseStr}<\/td>
    <td style="padding:6px 8px;text-align:right;color:#e2e8f0;font-family:monospace;font-size:11px;">${latestStr}<\/td>
    ${growthCell(latest, base)}
  </tr>`;
});

html += `</table></div></div>
<div style="font-size:10px;color:#4b6280;padding:4px 2px;">Source: Screener.in via Firebase &nbsp;·&nbsp; QoQ = consecutive quarter &nbsp;·&nbsp; YoY = Q5 vs Q1</div>`;

res.innerHTML = html;
}

// ======================================
// BUILD CASHFLOW TAB
// ======================================
async function _buildCashflowTab(res, sym) {
  const d = AppState._learnCache[sym];
  if (!d) { res.innerHTML = _learnNoData(sym, 'Cash Flow data'); return; }

  const items = [
    { label: 'Free Cash Flow', val: d.fcf, positive: true, fmt: 'cr' },
    { label: 'Total Debt', val: d.totalDebt, positive: false, fmt: 'cr' },
    { label: 'Current Assets', val: d.currAsset, positive: true, fmt: 'cr' },
    { label: 'Current Liab', val: d.currLiab, positive: false, fmt: 'cr' },
    { label: 'Debt/Equity', val: d.deRatio, positive: null, fmt: 'ratio' },
    { label: 'ROA', val: d.roa, positive: true, fmt: 'pct' },
    { label: 'EBITDA', val: d.ebitda, positive: true, fmt: 'cr' },
  ].filter(i => i.val !== null && i.val !== undefined && i.val !== 0);

  if (items.length === 0) { res.innerHTML = _learnNoData(sym, 'Cash Flow data'); return; }

  const fmtVal = (item) => {
    if (item.fmt === 'ratio') return Number(item.val).toFixed(2) + 'x';
    if (item.fmt === 'pct') return Number(item.val).toFixed(2) + '%';
    return '₹' + Number(item.val).toFixed(0) + ' Cr';
  };

  let html = `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">CASH FLOW & LIQUIDITY</span>
    </div>`;

  items.forEach((item, idx) => {
    const numVal = Number(item.val);
    const dot = item.positive === true ? (numVal >= 0 ? '#22c55e' : '#ef4444') : item.positive === false ? '#f59e0b' : '#64748b';
    const valColor = item.positive === true ? (numVal >= 0 ? '#22c55e' : '#ef4444') : '#e2e8f0';
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;${idx<items.length-1?'border-bottom:1px solid rgba(255,255,255,0.04);':''}">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#cbd5e1;">${item.label}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:${valColor};font-family:'JetBrains Mono',monospace;">${fmtVal(item)}</span>
    </div>`;
  });

  html += '</div>';
  const fcf = d.fcf;
  if (fcf) {
    const fcfNote = fcf > 0
      ? `<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:8px 12px;font-size:11px;color:#86efac;margin-top:8px;">Free Cash Flow Positive (₹${Number(fcf).toFixed(0)} Cr) — company generating real cash</div>`
      : `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;font-size:11px;color:#f87171;margin-top:8px;">Negative Free Cash Flow — monitor capital allocation</div>`;
    html += fcfNote;
  }

  const cr = d.currAsset && d.currLiab && d.currLiab > 0 ? (d.currAsset / d.currLiab).toFixed(2) : null;
  if (cr) {
    const crColor = cr >= 1.5 ? '#22c55e' : cr >= 1 ? '#f59e0b' : '#ef4444';
    html += `<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:8px 12px;font-size:11px;color:${crColor};margin-top:8px;">Current Ratio: ${cr}x ${cr >= 1.5 ? '— Strong liquidity' : cr >= 1 ? '— Adequate' : '— Low liquidity risk'}</div>`;
  }

  html += `<div style="font-size:10px;color:#4b6280;padding:8px 2px;">Source: Screener.in via Firebase</div>`;
  res.innerHTML = html;
}

// ======================================
// BUILD CORPORATE ACTIONS TAB
// ======================================
async function _buildCorporateActionsTab(res, sym) {
  res.innerHTML = '<div style="text-align:center;padding:20px 0;"><div class="spinner" style="margin:0 auto;"></div><div style="font-size:11px;color:#64748b;margin-top:8px;">Loading corporate actions...</div></div>';

  let fbData = null;
  if (typeof firebase !== 'undefined') {
    try {
      const db = firebase.firestore();
      const doc = await db.collection('RealTradePro').doc('corporate_actions').get();
      if (doc.exists) {
        const all = doc.data();
        fbData = {};
        ['dividends','bonuses','splits','boardMeetings','bulkDeals','blockDeals','announcements'].forEach(k => {
          if (all[k]) fbData[k] = all[k].filter(x => (x.symbol || '').toUpperCase() === sym.toUpperCase());
        });
      }
    } catch(e) { console.warn('[Corporate] Firebase fetch failed:', e); }
  }

  let gasBulk = [];
  if (!fbData) {
    try {
      const apiUrl = getActiveGASUrl();
      const r = await fetchWithTimeout(`${apiUrl}?action=bulkDeals&symbol=${sym}.NS`, 8000);
      const j = await r.json();
      if (j && Array.isArray(j.data)) gasBulk = j.data;
    } catch(e) { /* silent */ }
  }

  const nseUrl = `https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=${sym}`;
  const sectionStyle = 'background:#0d1f35;border-radius:10px;padding:10px 12px;margin-bottom:10px;border:1px solid rgba(56,189,248,0.1);';
  const headStyle = 'font-size:12px;font-weight:700;color:#38bdf8;margin-bottom:6px;display:flex;align-items:center;gap:6px;';
  const rowStyle = 'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:11px;';
  const labelStyle = 'color:#94a3b8;';
  const valStyle = 'color:#e2e8f0;font-weight:600;text-align:right;max-width:55%;';
  const emptyStyle = 'color:#4b6280;font-size:10px;padding:4px 0;';

  function buildRows(items, fields) {
    if (!items || items.length === 0) return `<div style="${emptyStyle}">No recent data</div>`;
    return items.slice(0,6).map(item =>
      `<div style="${rowStyle}">${fields.map((f,i) =>
        `<span style="${i===0?labelStyle:valStyle}">${item[f.key]||'-'}</span>`
      ).join('')}</div>`
    ).join('');
  }

  const srcBadge = fbData ? `<span style="font-size:9px;background:rgba(52,211,153,0.15);color:#34d399;border-radius:4px;padding:2px 6px;">Firebase</span>` : `<span style="font-size:9px;background:rgba(56,189,248,0.15);color:#64748b;border-radius:4px;padding:2px 6px;">GAS / Live</span>`;
  const divRows = buildRows(fbData?.dividends, [{key:'exDate'},{key:'dividendAmount'}]);
  const bonusRows = buildRows(fbData?.bonuses, [{key:'exDate'},{key:'ratio'}]);
  const splitRows = buildRows(fbData?.splits, [{key:'exDate'},{key:'splitRatio'}]);
  const bmRows = buildRows(fbData?.boardMeetings, [{key:'date'},{key:'purpose'}]);
  const bulkItems = fbData?.bulkDeals?.length ? fbData.bulkDeals : gasBulk;
  const bulkRows = buildRows(bulkItems, [{key:'date'},{key:'clientName'},{key:'quantity'}]);
  const annItems = fbData?.announcements || [];
  const annRows = annItems.length ? annItems.slice(0,5).map(a=>`<div style="${rowStyle}"><span style="${labelStyle}">${a.date||''}</span><span style="${valStyle}">${a.subject||a.desc||'-'}</span></div>`).join('') : `<div style="${emptyStyle}">No announcements in Firebase — check NSE directly</div>`;

  res.innerHTML = `
    <div style="padding:2px 0 8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:15px;font-weight:700;color:#fb923c;font-family:'JetBrains Mono',monospace;">${sym} — Corporate Actions</div>
        ${srcBadge}
      </div>
      <div style="${sectionStyle}"><div style="${headStyle}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Dividends</div>${divRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> Bonus & Splits</div><div style="margin-bottom:4px;font-size:10px;color:#64748b;">Bonus</div>${bonusRows}<div style="margin-top:6px;margin-bottom:4px;font-size:10px;color:#64748b;">Splits</div>${splitRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Board Meetings</div>${bmRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Bulk / Block Deals</div>${bulkRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> NSE Announcements</div>${annRows}<div style="margin-top:8px;"><button onclick="window.open('${nseUrl}','_blank')" style="width:100%;background:rgba(56,189,248,0.1);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">View All on NSE</button></div></div>
    </div>`;
}

// ======================================
// NO DATA HELPER
// ======================================
function _learnNoData(sym, label) {
  return `<div style="text-align:center;padding:30px 14px;">
    <div style="font-size:28px;margin-bottom:8px;">📭</div>
    <div style="font-size:13px;color:#64748b;">${label} not available for ${sym}</div>
    <div style="font-size:11px;color:#4b6280;margin-top:4px;">Try checking Settings → API URL</div>
  </div>`;
}

// ======================================
// MARKET SCHOOL RENDER
// ======================================
function renderMarketSchool() {
  const el = document.getElementById('marketSchoolContent');
  if (!el) return;
  const lang = AppState._learnLang;

  if (!AppState._msCategory) {
    _renderMSHome(el, lang);
  } else if (!AppState._msTopic) {
    _renderMSCategory(el, lang);
  } else {
    _renderMSTopic(el, lang);
  }
}

function _renderMSHome(el, lang) {
  const cats = Object.keys(MARKET_SCHOOL);
  let html = `<div style="margin-bottom:12px;"><div style="font-size:11px;color:#64748b;font-weight:700;letter-spacing:1px;margin-bottom:8px;">SELECT CATEGORY</div>`;

  cats.forEach(catKey => {
    const cat = MARKET_SCHOOL[catKey];
    const count = Object.keys(cat.topics).length;
    html += `
    <div onclick="AppState._msCategory='${catKey}';AppState._msTopic=null;renderMarketSchool();"
      style="background:#0d1f35;border:1px solid rgba(255,255,255,0.07);border-left:3px solid ${cat.color};border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:all 0.15s;"
      onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='#0d1f35'">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:26px;">${cat.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;">${cat.label[lang]||cat.label.en}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">${count} topics</div>
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${cat.color}" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderMSCategory(el, lang) {
  const cat = MARKET_SCHOOL[AppState._msCategory];
  if (!cat) { AppState._msCategory = null; renderMarketSchool(); return; }

  let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
    <button onclick="AppState._msCategory=null;AppState._msTopic=null;renderMarketSchool();" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">← Back</button>
    <span style="font-size:14px;">${cat.icon}</span>
    <span style="font-size:13px;font-weight:700;color:${cat.color};">${cat.label[lang]||cat.label.en}</span>
  </div>`;

  Object.keys(cat.topics).forEach(topicKey => {
    const topic = cat.topics[topicKey];
    const content = topic[lang] || topic.en;
    html += `
    <div onclick="AppState._msTopic='${topicKey}';renderMarketSchool();"
      style="background:#0d1f35;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;"
      onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='#0d1f35'">
      <div><div style="font-size:12px;font-weight:700;color:#e2e8f0;">${topic.label}</div><div style="font-size:10px;color:#64748b;margin-top:2px;">${content.what.substring(0,60)}...</div></div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${cat.color}" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  });
  el.innerHTML = html;
}

function _renderMSTopic(el, lang) {
  const cat = MARKET_SCHOOL[AppState._msCategory];
  const topic = cat?.topics[AppState._msTopic];
  if (!topic) { AppState._msTopic = null; renderMarketSchool(); return; }
  const L = topic[lang] || topic.en;

  const html = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
    <button onclick="AppState._msTopic=null;renderMarketSchool();" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">← Back</button>
    <span style="font-size:13px;font-weight:700;color:${cat.color};">${topic.label}</span>
  </div>
  <div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;"><div style="background:rgba(255,255,255,0.03);padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">📖 WHAT IS IT?</span></div><div style="padding:12px 14px;font-size:13px;color:#cbd5e1;line-height:1.7;">${L.what}</div></div>
  <div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;"><div style="background:rgba(255,255,255,0.03);padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">🔢 FORMULA</span></div><div style="padding:12px 14px;font-size:12px;color:#34d399;font-family:'JetBrains Mono',monospace;line-height:1.8;background:rgba(52,211,153,0.04);">${L.formula}</div></div>
  <div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;"><div style="background:rgba(255,255,255,0.03);padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">📊 LEVELS</span></div><div style="padding:12px 14px;font-size:12px;color:#f59e0b;line-height:1.8;">${L.levels}</div></div>
  <div style="background:rgba(251,146,60,0.07);border:1px solid rgba(251,146,60,0.2);border-left:3px solid #fb923c;border-radius:10px;padding:12px 14px;margin-bottom:10px;"><div style="font-size:10px;font-weight:700;color:#fb923c;letter-spacing:1px;margin-bottom:6px;">💡 PRO TIP</div><div style="font-size:12px;color:#e2e8f0;line-height:1.6;">${L.tip}</div></div>
  <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:12px 14px;margin-bottom:10px;"><div style="font-size:10px;font-weight:700;color:#38bdf8;letter-spacing:1px;margin-bottom:6px;">📌 EXAMPLE</div><div style="font-size:12px;color:#cbd5e1;line-height:1.6;">${L.example}</div></div>`;
  el.innerHTML = html;
}

// ======================================
// DOWNLOAD LEARN PDF
// ======================================
async function downloadLearnPDF(sym) {
  let d = AppState._learnCache[sym];
  if (!d) {
    showPopup('⏳ Firebase se data fetch ho raha hai...');
    try {
      const doc = await firebase.firestore().collection('fundlearn').doc(sym).get();
      if (!doc.exists) { showPopup('❌ ' + sym + ' Firebase maa nathi'); return; }
      const fd = doc.data();
      const fv = f => { if(f===null||f===undefined) return 0; if(typeof f==='number') return f; if(typeof f==='string') return Number(f)||0; if(f.doubleValue!==undefined) return Number(f.doubleValue); if(f.integerValue!==undefined) return Number(f.integerValue); return 0; };
      d = { sym, source:'firebase',
        netProfit:fv(fd.netProfit), totalEquity:fv(fd.totalEquity), totalShares:fv(fd.totalShares),
        ebit:fv(fd.ebit), capEmployed:fv(fd.capEmployed), roce:fv(fd.roce), ncf:fv(fd.ncf),
        totalDebt:fv(fd.totalDebt), dividend:fv(fd.dividend), currAsset:fv(fd.currAsset),
        currLiab:fv(fd.currLiab), promoter:fv(fd.promoter), fii:fv(fd.fii), dii:fv(fd.dii),
        pubHolding:fv(fd.pubHolding), eps:fv(fd.eps), bookVal:fv(fd.bookVal), pe:fv(fd.pe),
        sharePrice:fv(fd.sharePrice), roe:fv(fd.roe), roa:fv(fd.roa), ebitda:fv(fd.ebitda),
        deRatio:fv(fd.de), fcf:fv(fd.fcf), opProfit:fv(fd.opProfit),
        salesQ1:fv(Array.isArray(fd.sales_q)?fd.sales_q[0]:fd.salesQ1),
        salesQ2:fv(Array.isArray(fd.sales_q)?fd.sales_q[1]:fd.salesQ2),
        salesQ3:fv(Array.isArray(fd.sales_q)?fd.sales_q[2]:fd.salesQ3),
        salesQ4:fv(Array.isArray(fd.sales_q)?fd.sales_q[3]:fd.salesQ4),
        salesQ5:fv(Array.isArray(fd.sales_q)?fd.sales_q[4]:fd.salesQ5),
        npQ1:fv(Array.isArray(fd.np_q)?fd.np_q[0]:fd.npQ1),
        npQ2:fv(Array.isArray(fd.np_q)?fd.np_q[1]:fd.npQ2),
        npQ3:fv(Array.isArray(fd.np_q)?fd.np_q[2]:fd.npQ3),
        npQ4:fv(Array.isArray(fd.np_q)?fd.np_q[3]:fd.npQ4),
        npQ5:fv(Array.isArray(fd.np_q)?fd.np_q[4]:fd.npQ5),
        quarterlyHeaders: fd.quarterlyHeaders || [],
        updatedAt: fd.updatedAt || ''
      };
      d.sharePrice = _getLivePrice(sym) || d.sharePrice;
      AppState._learnCache[sym] = d;
    } catch(e) { showPopup('❌ Firebase error: ' + e.message); return; }
  }

  const R = calcLearnRatios(d);
  const today = new Date();
  const dateStr = today.getDate()+'/'+(today.getMonth()+1)+'/'+today.getFullYear();
  const sp = d.sharePrice > 0 ? 'Rs.' + d.sharePrice.toFixed(2) : 'N/A';
  const ds = today.getDate()+'-'+(today.getMonth()+1)+'-'+today.getFullYear();

  const { jsPDF } = window.jspdf;
  if (!jsPDF) { showPopup('⚠️ jsPDF not loaded'); return; }

  showPopup('⏳ PDF banavi rahi che...');

  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const PW = 210, PH = 297, ML = 14, MR = 14, TW = PW - ML - MR;
  let y = 14;

  const fmtCr = v => { const n = Number(v); if(!n || isNaN(n)) return '--'; if(Math.abs(n)>=10000) return 'Rs.'+(n/100).toFixed(0)+' Cr'; return 'Rs.'+n.toFixed(0)+' Cr'; };
  const newPage = () => { doc.addPage(); y = 14; };
  const checkY = (need=20) => { if(y + need > PH - 14) newPage(); };

  // Header Box
  doc.setFillColor(255, 248, 240);
  doc.roundedRect(ML, y, TW, 28, 3, 3, 'F');
  doc.setDrawColor(251, 146, 60);
  doc.roundedRect(ML, y, TW, 28, 3, 3, 'S');
  doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(251,146,60);
  doc.text(sym, ML+4, y+9);
  doc.setFontSize(9); doc.setTextColor(100,116,139);
  doc.text('RealTradePro · Full Analysis Report', ML+4, y+15);
  doc.text('CMP: ' + sp.replace('₹','Rs.') + '   Date: ' + dateStr + '   Source: ' + (d.source||'Firebase'), ML+4, y+21);

  const scored = ['pe','eps','roe','roce','de','cr','roa','promoter','fii','dii'].map(k=>_learnDot(k,R[k]));
  const green = scored.filter(c=>c==='#22c55e').length;
  const grade = green>=7?'A':green>=5?'B':green>=3?'C':'D';
  const gc = grade==='A'?[22,163,74]:grade==='B'?[2,132,199]:grade==='C'?[180,83,9]:[185,28,28];
  doc.setFillColor(...gc); doc.circle(PW-MR-10, y+10, 8, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text(grade, PW-MR-10, y+13, {align:'center'});
  doc.setFontSize(7); doc.text('Grade', PW-MR-10, y+21, {align:'center'});
  y += 32;

  const sectionHeader = (title) => {
    checkY(12);
    doc.setFillColor(241,245,249);
    doc.roundedRect(ML, y, TW, 7, 1, 1, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(251,146,60);
    doc.text(title, ML+2, y+5);
    y += 9;
  };

  // Fundamentals Table
  sectionHeader('FUNDAMENTALS & VALUATION');
  checkY(60);
  doc.autoTable({
    startY: y, margin:{left:ML,right:MR},
    head:[['Metric','Value','Benchmark']],
    body:[
      ['P/E Ratio', R.pe ? R.pe.toFixed(2) : '--', '< 15 Cheap · 15-30 Fair · > 30 Expensive'],
      ['EPS', R.eps ? 'Rs.'+R.eps.toFixed(2): '--', 'Higher = Better'],
      ['Book Value', R.bookVal?'Rs.'+R.bookVal.toFixed(2):'--','Growing = Healthy'],
      ['ROE %', R.roe ? R.roe.toFixed(2)+'%':'--', '> 15% Good · 8-15% Fair · < 8% Weak'],
      ['ROCE %', R.roce ? R.roce.toFixed(2)+'%':'--', '> 15% Good · 8-15% Fair · < 8% Weak'],
      ['ROA %', R.roa ? R.roa.toFixed(2)+'%':'--', '> 5% Good · < 5% Weak'],
      ['D/E Ratio', R.de ? R.de.toFixed(2)+'x':'--', '< 0.5 Low · 0.5-1 Fair · > 1 High'],
      ['Current Ratio', R.cr ? R.cr.toFixed(2) :'--', '> 1.5 Safe · 1-1.5 Fair · < 1 Risk'],
      ['Div Yield %', R.divYield?R.divYield.toFixed(2)+'%':'--','> 0% Fair'],
      ['Free Cash Flow', fmtCr(d.fcf), '> 0 Healthy · 5-10% of Rev Fair'],
    ],
    headStyles:{fillColor:[251,146,60],textColor:255,fontSize:9,fontStyle:'bold'},
    bodyStyles:{fontSize:9,textColor:[30,30,30]},
    columnStyles:{0:{cellWidth:40},1:{cellWidth:28,halign:'right'},2:{cellWidth:TW-68,fontSize:8,textColor:[100,116,139]}},
    alternateRowStyles:{fillColor:[248,250,252]},
    styles:{lineColor:[226,232,240],lineWidth:0.2},
  });
  y = doc.lastAutoTable.finalY + 6;

  // Shareholding Table
  checkY(10);
  sectionHeader('SHAREHOLDING PATTERN');
  doc.autoTable({
    startY: y, margin:{left:ML,right:MR},
    head:[['Holder','%','Bar']],
    body:[
      ['Promoter', d.promoter ? d.promoter.toFixed(2)+'%':'--', d.promoter ? '[' + '|'.repeat(Math.round(d.promoter/5)) + ']  '+d.promoter.toFixed(1)+'%' : '--'],
      ['FII', d.fii ? d.fii.toFixed(2)+'%' :'--', d.fii ? '[' + '|'.repeat(Math.round(d.fii/5)) + ']  '+d.fii.toFixed(1)+'%' : '--'],
      ['DII', d.dii ? d.dii.toFixed(2)+'%' :'--', d.dii ? '[' + '|'.repeat(Math.round(d.dii/5)) + ']  '+d.dii.toFixed(1)+'%' : '--'],
      ['Public', d.pubHolding?d.pubHolding.toFixed(2)+'%':'--', d.pubHolding?'[' + '|'.repeat(Math.round(d.pubHolding/5)) + ']  '+d.pubHolding.toFixed(1)+'%' : '--'],
    ],
    headStyles:{fillColor:[56,189,248],textColor:255,fontSize:9,fontStyle:'bold'},
    bodyStyles:{fontSize:9,textColor:[30,30,30]},
    columnStyles:{0:{cellWidth:40},1:{cellWidth:28,halign:'right'},2:{cellWidth:TW-68,textColor:[22,163,74]}},
    alternateRowStyles:{fillColor:[248,250,252]},
    styles:{lineColor:[226,232,240],lineWidth:0.2},
  });
  y = doc.lastAutoTable.finalY + 6;

  // Quarterly Table
  const qs = ['Q1','Q2','Q3','Q4','Q5'];
  const qH = (d.quarterlyHeaders && d.quarterlyHeaders.length===5) ? d.quarterlyHeaders : qs;
  const hasQ = d.salesQ1 || d.salesQ2 || d.salesQ3;
  if (hasQ) {
    checkY(10);
    sectionHeader('QUARTERLY RESULTS (Last 5 Quarters)');
    const qBody = [
      ['Sales (Cr)', ...qs.map(q=>fmtCr(d['salesQ'+q.slice(1)]))],
      ['Net Profit', ...qs.map(q=>fmtCr(d['npQ'+q.slice(1)]))],
      ['Expenses', ...qs.map(q=>fmtCr(d['expQ'+q.slice(1)] || d['expensesQ'+q.slice(1)] || 0))],
    ];
    doc.autoTable({
      startY: y, margin:{left:ML,right:MR},
      head:[['Metric',...qH]],
      body: qBody,
      headStyles:{fillColor:[34,197,94],textColor:255,fontSize:8,fontStyle:'bold'},
      bodyStyles:{fontSize:8,textColor:[30,30,30],halign:'right'},
      columnStyles:{0:{halign:'left',cellWidth:32}},
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{lineColor:[226,232,240],lineWidth:0.2},
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Cash Flow
  checkY(10);
  sectionHeader('CASH FLOW & LIQUIDITY');
  doc.autoTable({
    startY: y, margin:{left:ML,right:MR},
    head:[['Parameter','Value']],
    body:[
      ['Free Cash Flow', fmtCr(d.fcf)],
      ['Total Debt', fmtCr(d.totalDebt)],
      ['Current Assets', fmtCr(d.currAsset)],
      ['Current Liab', fmtCr(d.currLiab)],
      ['Debt/Equity', d.deRatio ? Number(d.deRatio).toFixed(2)+'x':'--'],
      ['ROA %', d.roa ? Number(d.roa).toFixed(2)+'%' : '--'],
      ['EBITDA', fmtCr(d.ebitda)],
    ],
    headStyles:{fillColor:[168,85,247],textColor:255,fontSize:9,fontStyle:'bold'},
    bodyStyles:{fontSize:9,textColor:[30,30,30]},
    columnStyles:{0:{cellWidth:60},1:{halign:'right'}},
    alternateRowStyles:{fillColor:[248,250,252]},
    styles:{lineColor:[226,232,240],lineWidth:0.2},
  });
  y = doc.lastAutoTable.finalY + 6;

  // Score Summary
  checkY(20);
  sectionHeader('SCORE SUMMARY');
  const yellow = scored.filter(c=>c==='#f59e0b').length;
  const red = scored.filter(c=>c==='#ef4444').length;
  doc.setFontSize(10); doc.setTextColor(30,30,30); doc.setFont('helvetica','normal');
  doc.text(`Good: ${green}   Average: ${yellow}   Weak: ${red}   Out of 10   Overall Grade: ${grade}`, ML+2, y+4);
  y += 10;

  const pages = doc.internal.getNumberOfPages();
  for (let i=1; i<=pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text('RealTradePro · ' + sym + ' Full Analysis · ' + dateStr + ' · Not SEBI registered advice', PW/2, PH-8, {align:'center'});
    doc.text('Page '+i+' of '+pages, PW-MR, PH-8, {align:'right'});
  }

  doc.save(sym + '_RTP_Report_' + ds + '.pdf');
  showPopup('✅ ' + sym + '_RTP_Report.pdf downloaded!');
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.initLearnTab = initLearnTab;
window.setLearnLang = setLearnLang;
window.switchLearnMain = switchLearnMain;
window.switchLearnTab = switchLearnTab;
window.fetchLearnStock = fetchLearnStock;
window.learnSearchSuggest = learnSearchSuggest;
window.renderLearnReport = renderLearnReport;
window.showLearnInfo = showLearnInfo;
window.closeLearnInfo = closeLearnInfo;
window.renderMarketSchool = renderMarketSchool;
window.downloadLearnPDF = downloadLearnPDF;

console.log('✅ learn.js loaded successfully');
