// ========================================
// LEARN MODULE — RealTradePro v3.0
// Handles: Learn tab, fundamentals, technicals, quarterly, shareholding, corporate actions, market school
// ========================================

function initLearnTab() {
  setLearnLang(AppState._learnLang);
  switchLearnMain('financial');
}

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
      btn.style.color = 'var(--text-muted, #64748b)';
      btn.style.borderColor = 'var(--border, rgba(255,255,255,0.1))';
    }
  });
  const sym = (document.getElementById('learnSearchInput')||{}).value;
  if (sym && AppState._learnCache[sym.toUpperCase().trim()]) {
    renderLearnReport(AppState._learnCache[sym.toUpperCase().trim()], sym.toUpperCase().trim());
  }
}

function switchLearnMain(tab) {
  AppState._learnMainTab = tab;
  const isFinancial = tab === 'financial';

  const finPanel = document.getElementById('lpanel-financial');
  const flowPanel = document.getElementById('lpanel-marketflow');
  if (finPanel) finPanel.style.display = isFinancial ? 'flex' : 'none';
  if (flowPanel) flowPanel.style.display = isFinancial ? 'none' : 'block';

  const finBtn = document.getElementById('lmain-financial');
  const flowBtn = document.getElementById('lmain-marketflow');
  if (finBtn) {
    finBtn.style.borderBottomColor = isFinancial ? '#fb923c' : 'transparent';
    finBtn.style.background = isFinancial ? 'rgba(251,146,60,0.08)' : 'transparent';
    finBtn.style.color = isFinancial ? '#fb923c' : 'var(--text-muted, #64748b)';
  }
  if (flowBtn) {
    flowBtn.style.borderBottomColor = !isFinancial ? '#fb923c' : 'transparent';
    flowBtn.style.background = !isFinancial ? 'rgba(251,146,60,0.08)' : 'transparent';
    flowBtn.style.color = !isFinancial ? '#fb923c' : 'var(--text-muted, #64748b)';
  }

  if (!isFinancial && typeof renderMarketFlows === 'function') renderMarketFlows();
}

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
      btn.style.color = 'var(--text-muted, #64748b)';
      btn.style.borderColor = 'var(--border, rgba(255,255,255,0.1))';
    }
  });
  const sym = (document.getElementById('learnSearchInput')||{}).value?.trim().toUpperCase();
  if (sym && AppState._learnCache[sym]) {
    _renderLearnTab(tabName, AppState._learnCache[sym], sym);
  }
}

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
      style="padding:8px 14px;font-size:12px;font-weight:700;color:var(--text-primary, #e2e8f0);cursor:pointer;font-family:'Rajdhani',sans-serif;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));"
      onmouseover="this.style.background='rgba(251,146,60,0.1)'" onmouseout="this.style.background=''">${s}</div>`
  ).join('');
  box.style.display = 'block';
}

async function fetchLearnStock() {
  const input = document.getElementById('learnSearchInput');
  const msg = document.getElementById('learnMsg');
  const res = document.getElementById('learnResults');
  if (!input) return;
  const sym = input.value.trim().toUpperCase();
  if (!sym) { if(msg) msg.textContent = 'Stock symbol daalo'; return; }
  document.getElementById('learnSuggBox').style.display = 'none';
  if (msg) { msg.textContent = '⏳ Loading data...'; msg.style.color = 'var(--text-muted, #64748b)'; }
  if (res) res.innerHTML = '';

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
        netProfit: fv(d.netProfit), totalEquity: fv(d.totalEquity), totalShares: fv(d.totalShares),
        ebit: fv(d.ebit), capEmployed: fv(d.capEmployed), roce: fv(d.roce), ncf: fv(d.ncf),
        totalDebt: fv(d.totalDebt), dividend: fv(d.dividend), currAsset: fv(d.currAsset),
        currLiab: fv(d.currLiab), promoter: fv(d.promoter), fii: fv(d.fii), dii: fv(d.dii),
        pubHolding: fv(d.pubHolding), eps: fv(d.eps), opProfit: fv(d.opProfit), fcf: fv(d.fcf),
        deRatio: fv(d.deRatio), roa: fv(d.roa), ebitda: fv(d.ebitda), pe: fv(d.pe),
        bookValue: fv(d.bookValue), roe: fv(d.roe),
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
      if (msg) { msg.textContent = '✅ Firebase · ' + (d.updatedAt ? (d.updatedAt.stringValue || d.updatedAt).toString().substring(0,10) : ''); msg.style.color = 'var(--pos, #34d399)'; }
      renderLearnReport(raw, sym);
      return;
    }
  } catch(e) { console.warn('Firebase fundlearn fetch failed:', e.message); }

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
          netProfit: Number(d.profit) || 0, totalEquity: Number(d.equity) || 0,
          totalShares: Number(d.shares) || 0, ebit: Number(d.ebit) || 0,
          capEmployed: Number(d.ce) || 0, totalDebt: Number(d.debt) || 0,
          dividend: Number(d.div) || 0, currAsset: Number(d.assets) || 0,
          currLiab: Number(d.liab) || 0, promoter: Number(d.prom) || 0,
          fii: Number(d.fii) || 0, dii: Number(d.dii) || 0, pubHolding: Number(d.pub) || 0,
          eps: Number(d.eps) || 0, opProfit: Number(d.opProfit) || 0,
          fcf: Number(d.fcf) || 0, deRatio: Number(d.de) || 0,
          roa: Number(d.roa) || 0, ebitda: Number(d.ebitda) || 0,
        };
        raw.sharePrice = _getLivePrice(sym);
        await _enrichWithTechnicals(raw, sym);
        AppState._learnCache[sym] = raw;
        if (msg) { msg.textContent = '✅ FF2 Screener data'; msg.style.color = 'var(--warn, #fb923c)'; }
        renderLearnReport(raw, sym);
        return;
      }
      await _addToWaitlist(sym, msg);
      return;
    } catch(e) {
      if (msg) { msg.textContent = '❌ FF2 fetch failed: ' + e.message; msg.style.color = 'var(--neg, #f87171)'; }
      await _addToWaitlist(sym, msg);
      return;
    }
  }

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
      if (msg) { msg.textContent = '✅ GAS Sheet fetch'; msg.style.color = 'var(--accent, #38bdf8)'; }
      renderLearnReport(data, sym);
      return;
    }
    await _addToWaitlist(sym, msg);
  } catch(e) {
    await _addToWaitlist(sym, msg);
  }
}

async function _addToWaitlist(sym, msg) {
  if (msg) { msg.textContent = `⏳ "${sym}" DB ma nathi — Waitlist ma add thai rahu che...`; msg.style.color = 'var(--warn, #f59e0b)'; }
  try {
    await firebase.firestore().collection('new_requests').doc(sym).set({
      symbol: sym,
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
      requestedBy: (AppState.currentUser?.userId) ? AppState.currentUser.userId : 'anonymous'
    });
    if (msg) {
      msg.textContent = `✅ "${sym}" waitlist ma add thayo! Python run thase tyare automatically sheet + Firebase ma aavse.`;
      msg.style.color = 'var(--pos, #34d399)';
    }
  } catch(e) {
    if (msg) {
      msg.textContent = `❌ "${sym}" DB ma nathi. Waitlist error: ${e.message}`;
      msg.style.color = 'var(--neg, #f87171)';
    }
  }
}

function _getLivePrice(sym) {
  if (typeof AppState.cache !== 'undefined' && AppState.cache[sym]?.data?.regularMarketPrice) return AppState.cache[sym].data.regularMarketPrice;
  if (typeof AppState.cache !== 'undefined' && AppState.cache[sym+'NS']?.data?.regularMarketPrice) return AppState.cache[sym+'NS'].data.regularMarketPrice;
  if (window._firebaseFundCache?.[sym]?.sharePrice) return window._firebaseFundCache[sym].sharePrice;
  return 0;
}

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
    pe: safe(pe), eps: safe(eps), roe: safe(roe), roce: safe(roce),
    bookVal: safe(bv), de: safe(de), cr: safe(cr), divYield: safe(divY),
    promoter: safeRange(d.promoter, 0, 100), fii: safe(fii), dii: safe(dii),
    roa: safe(roa), rsi: (d.rsi !== undefined && d.rsi !== null) ? d.rsi : null
  };
}

function _learnDot(metric, val) {
  if (val === null) return 'var(--text-muted, #64748b)';
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
  return r === 'green' ? 'var(--pos, #22c55e)' : r === 'yellow' ? 'var(--warn, #f59e0b)' : r === 'red' ? 'var(--neg, #ef4444)' : 'var(--text-muted, #64748b)';
}

function showLearnInfo(metric, val, symRaw) {
  val = (val === null || val === undefined || val === 'null' || isNaN(Number(val))) ? null : Number(val);
  const info = LEARN_INFO[metric];
  if (!info) return;
  const L = info[AppState._learnLang] || info['en'];
  document.getElementById('learnInfoTitle').textContent = L.title;
  document.getElementById('learnInfoBody').textContent = L.body;
  const fEl = document.getElementById('learnInfoFormula');
  fEl.innerHTML = '<b>Formula:</b> ' + L.formula + (L.good ? '<br><span style="color:var(--warn, #f59e0b);">'+L.good+'</span>' : '');
  if (val !== null) {
    fEl.innerHTML += '<br><span style="color:var(--accent, #38bdf8);">Your value: <b>' + (typeof val === 'number' ? val.toFixed(2) : val) + '</b></span>';
  }
  document.getElementById('learnInfoModal').style.display = 'flex';
}

function closeLearnInfo() {
  document.getElementById('learnInfoModal').style.display = 'none';
}

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

function _learnHeader(d, sym) {
  const sp = d.sharePrice > 0 ? '₹' + d.sharePrice.toFixed(2) : null;
  const srcColor = d.source === 'firebase' ? 'var(--pos, #34d399)' : 'var(--accent, #38bdf8)';
  const srcLabel = d.source === 'firebase' ? 'Firebase' : d.source === 'ff2' ? 'FF2 Sheet' : 'GAS';
  return `
    <div style="background:var(--bg-card, #0d1f35);border-radius:12px;padding:11px 14px;margin-bottom:10px;border:1px solid rgba(251,146,60,0.15);display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:17px;font-weight:700;color:var(--warn, #fb923c);font-family:'JetBrains Mono',monospace;line-height:1.1;">${sym}</div>
        ${sp ? `<div style="font-size:12px;color:var(--text-sec, #94a3b8);margin-top:2px;">CMP: <span style="color:var(--text-primary, #e2e8f0);font-weight:700;">${sp}</span></div>` : '<div style="font-size:11px;color:var(--text-muted, #64748b);">Open stock to load price</div>'}
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:var(--text-muted, #64748b);margin-bottom:2px;">SOURCE</div>
        <div style="font-size:10px;font-weight:700;color:${srcColor};">${srcLabel}</div>
      </div>
    </div>`;
}

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

  html += `<div style="background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);border-left:3px solid var(--warn, #fb923c);border-radius:10px;padding:10px 12px;margin-bottom:10px;">
    <div style="font-size:9px;color:var(--warn, #fb923c);font-weight:700;letter-spacing:1px;margin-bottom:4px;">NIVI'S INSIGHT</div>
    <div style="font-size:12px;color:var(--text-primary, #e2e8f0);line-height:1.5;">${niviText}</div>
  </div>`;

  metricGroups.forEach(group => {
    html += `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));margin-bottom:8px;">
      <div style="padding:8px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));background:var(--bg-header, rgba(255,255,255,0.02));">
        <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">${group.label[lang]||group.label.en}</span>
      </div>`;
    group.metrics.forEach((m, idx) => {
      const val = R[m];
      const dot = _learnDot(m, val);
      const last = idx === group.metrics.length - 1;
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;${last?'':'border-bottom:1px solid var(--border, rgba(255,255,255,0.04));'}">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
          <span style="font-size:12px;color:var(--text-primary, #cbd5e1);">${labels[m]||m}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:var(--text-primary, #e2e8f0);font-family:'JetBrains Mono',monospace;">${fmtV(m,val)}</span>
          <button onclick="showLearnInfo('${m}',${val!==null?val:'null'},'${sym}')"
            style="width:18px;height:18px;border-radius:50%;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);color:var(--accent, #38bdf8);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">ℹ</button>
        </div>
      </div>`;
    });
    html += '</div>';
  });

  return html;
}

function _buildTechnicalsTab(d, sym) {
  const R = calcLearnRatios(d);
  let html = _learnHeader(d, sym);

  const techItems = [
    { key: 'rsi', label: 'RSI (14D)', fmt: v => v.toFixed(1) },
    { key: 'macd', label: 'MACD', fmt: v => v.toFixed(2) },
    { key: 'ema20', label: 'EMA 20', fmt: v => '₹' + v.toFixed(2) },
    { key: 'ema50', label: 'EMA 50', fmt: v => '₹' + v.toFixed(2) },
    { key: 'beta', label: 'Beta', fmt: v => v.toFixed(2) },
    { key: '52wHigh', label: '52W High', fmt: v => '₹' + v.toFixed(2) },
    { key: '52wLow', label: '52W Low', fmt: v => '₹' + v.toFixed(2) },
  ];

  html += `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));margin-bottom:8px;">
    <div style="padding:8px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));background:var(--bg-header, rgba(255,255,255,0.02));">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">⚡ TECHNICAL INDICATORS</span>
    </div>`;

  techItems.forEach((item, idx) => {
    const val = (d[item.key] !== undefined && d[item.key] !== null) ? d[item.key] : (R[item.key] !== undefined && R[item.key] !== null) ? R[item.key] : null;
    const fv = val !== null && val !== undefined ? item.fmt(val) : '--';
    const dot = _learnDot(item.key, val);
    const last = idx === techItems.length - 1;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;${last?'':'border-bottom:1px solid var(--border, rgba(255,255,255,0.04));'}">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;color:var(--text-primary, #cbd5e1);">${item.label}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:var(--text-primary, #e2e8f0);font-family:'JetBrains Mono',monospace;">${fv}</span>
    </div>`;
  });

  html += '</div><div style="font-size:10px;color:var(--text-muted, #4b6280);padding:8px 2px;">Technical indicators based on available data.</div>';
  return html;
}

function _buildShareholdingTab(d, sym) {
  const R = calcLearnRatios(d);
  let html = _learnHeader(d, sym);

  const holders = [
    { label: 'Promoter', val: R.promoter, color: 'var(--accent-purple, #7c3aed)' },
    { label: 'FII (Foreign)', val: R.fii, color: 'var(--accent, #0284c7)' },
    { label: 'DII (Domestic)', val: R.dii, color: 'var(--pos, #059669)' },
    { label: 'Public', val: d.pubHolding || null, color: 'var(--warn, #d97706)' },
  ];

  html += `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));padding:14px;">`;

  holders.forEach(h => {
    if (!h.val) return;
    const barW = Math.min(h.val, 100).toFixed(1);
    html += `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-sec, #94a3b8);margin-bottom:4px;">
        <span><span style="color:${h.color};">&#9632;</span> ${h.label}</span>
        <b style="color:var(--text-primary, #e2e8f0);">${h.val.toFixed(1)}%</b>
      </div>
      <div style="background:var(--border, rgba(255,255,255,0.06));border-radius:4px;height:6px;">
        <div style="width:${barW}%;background:${h.color};border-radius:4px;height:6px;"></div>
      </div>
    </div>`;
  });

  if (holders.every(h => !h.val)) {
    html += `<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted, #64748b);">Shareholding data not available</div>`;
  }

  html += `</div><div style="font-size:10px;color:var(--text-muted, #4b6280);padding:8px 2px;">Source: Screener.in via Firebase</div>`;
  return html;
}

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
    if (Math.abs(p) < 1 || Math.abs(c) < 1) return `<td style="padding:6px 6px;text-align:right;color:var(--text-muted, #4b6280);font-size:10px;">--<\/td>`;
    const g = ((c - p) / Math.abs(p)) * 100;
    const color = g >= 5 ? 'var(--pos, #22c55e)' : g >= 0 ? 'var(--pos, #86efac)' : g >= -5 ? 'var(--warn, #fbbf24)' : 'var(--neg, #ef4444)';
    const sign = g >= 0 ? '+' : '';
    return `<td style="padding:6px 6px;text-align:right;color:${color};font-size:10px;font-weight:600;">${sign}${g.toFixed(1)}%<\/td>`;
  };

  let html = `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));margin-bottom:10px;">
    <div style="padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));background:var(--bg-header, rgba(255,255,255,0.02));">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">📊 QUARTERLY RESULTS (Last 5 Quarters)</span>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr style="background:var(--bg-header, rgba(255,255,255,0.04));">
        <th style="padding:8px 10px;text-align:left;color:var(--text-muted, #64748b);min-width:90px;">Metric</th>
        ${qs.map((q,i)=>`<th style="padding:8px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;white-space:nowrap;">${qHeaders[i]}</th>`).join('')}
      </tr>`;

  rows.forEach((row, idx) => {
    html += `<tr style="${idx%2===0?'background:var(--bg-card2, rgba(255,255,255,0.01));':''}">
      <td style="padding:8px 10px;color:var(--text-primary, #cbd5e1);font-weight:600;">${row.label}<\/td>
      ${row.vals.map(v=>`<td style="padding:8px 8px;text-align:right;color:var(--text-primary, #e2e8f0);font-family:'JetBrains Mono',monospace;">${fmt(v)}<\/td>`).join('')}
    </tr>`;
  });

  html += `<\/table><\/div><\/div>`;

  const qoqRows = rows;
  html += `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));margin-bottom:10px;">
    <div style="padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));background:var(--bg-header, rgba(255,255,255,0.02));">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">📈 QoQ GROWTH — ${qHeaders[3]} vs ${qHeaders[4]}</span>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr style="background:var(--bg-header, rgba(255,255,255,0.04));">
        <th style="padding:7px 10px;text-align:left;color:var(--text-muted, #64748b);">Metric</th>
        <th style="padding:7px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;">${qHeaders[3]}</th>
        <th style="padding:7px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;">${qHeaders[4]}</th>
        <th style="padding:7px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;">QoQ %</th>
      </tr>`;

  qoqRows.forEach((row, idx) => {
    const prev = Number(row.vals[3]);
    const curr = Number(row.vals[4]);
    const prevStr = prev ? '₹'+prev.toFixed(0)+' Cr' : '--';
    const currStr = curr ? '₹'+curr.toFixed(0)+' Cr' : '--';
    html += `<tr style="${idx%2===0?'background:var(--bg-card2, rgba(255,255,255,0.01));':''}">
      <td style="padding:7px 10px;color:var(--text-primary, #cbd5e1);font-weight:600;">${row.label}<\/td>
      <td style="padding:6px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-family:monospace;font-size:11px;">${prevStr}<\/td>
      <td style="padding:6px 8px;text-align:right;color:var(--text-primary, #e2e8f0);font-family:monospace;font-size:11px;">${currStr}<\/td>
      ${growthCell(curr, prev)}
    </tr>`;
  });

html += `</table></div></div>`;

html += `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));margin-bottom:10px;">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));background:var(--bg-header, rgba(255,255,255,0.02));">
    <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">📅 YoY GROWTH — ${qHeaders[4]} vs ${qHeaders[0]}</span>
  </div>
  <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr style="background:var(--bg-header, rgba(255,255,255,0.04));">
      <th style="padding:7px 10px;text-align:left;color:var(--text-muted, #64748b);">Metric</th>
      <th style="padding:7px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;">${qHeaders[0]}</th>
      <th style="padding:7px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;">${qHeaders[4]}</th>
      <th style="padding:7px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-size:10px;">YoY %</th>
    </tr>`;

rows.forEach((row, idx) => {
  const base = Number(row.vals[0]);
  const latest = Number(row.vals[4]);
  const baseStr = base ? '₹'+base.toFixed(0)+' Cr' : '--';
  const latestStr = latest ? '₹'+latest.toFixed(0)+' Cr' : '--';
  html += `<tr style="${idx%2===0?'background:var(--bg-card2, rgba(255,255,255,0.01));':''}">
    <td style="padding:7px 10px;color:var(--text-primary, #cbd5e1);font-weight:600;">${row.label}<\/td>
    <td style="padding:6px 8px;text-align:right;color:var(--text-sec, #94a3b8);font-family:monospace;font-size:11px;">${baseStr}<\/td>
    <td style="padding:6px 8px;text-align:right;color:var(--text-primary, #e2e8f0);font-family:monospace;font-size:11px;">${latestStr}<\/td>
    ${growthCell(latest, base)}
  </tr>`;
});

html += `</table></div></div>
<div style="font-size:10px;color:var(--text-muted, #4b6280);padding:4px 2px;">Source: Screener.in via Firebase</div>`;

res.innerHTML = html;
}

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

  let html = `<div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.06));">
    <div style="padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));background:var(--bg-header, rgba(255,255,255,0.02));">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">CASH FLOW & LIQUIDITY</span>
    </div>`;

  items.forEach((item, idx) => {
    const numVal = Number(item.val);
    const dot = item.positive === true ? (numVal >= 0 ? 'var(--pos, #22c55e)' : 'var(--neg, #ef4444)') : item.positive === false ? 'var(--warn, #f59e0b)' : 'var(--text-muted, #64748b)';
    const valColor = item.positive === true ? (numVal >= 0 ? 'var(--pos, #22c55e)' : 'var(--neg, #ef4444)') : 'var(--text-primary, #e2e8f0)';
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;${idx<items.length-1?'border-bottom:1px solid var(--border, rgba(255,255,255,0.04));':''}">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;color:var(--text-primary, #cbd5e1);">${item.label}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:${valColor};font-family:'JetBrains Mono',monospace;">${fmtVal(item)}</span>
    </div>`;
  });

  html += '</div>';
  const fcf = d.fcf;
  if (fcf) {
    const fcfNote = fcf > 0
      ? `<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--pos, #86efac);margin-top:8px;">Free Cash Flow Positive (₹${Number(fcf).toFixed(0)} Cr) — company generating real cash</div>`
      : `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--neg, #f87171);margin-top:8px;">Negative Free Cash Flow — monitor capital allocation</div>`;
    html += fcfNote;
  }

  html += `<div style="font-size:10px;color:var(--text-muted, #4b6280);padding:8px 2px;">Source: Screener.in via Firebase</div>`;
  res.innerHTML = html;
}

async function _buildCorporateActionsTab(res, sym) {
  res.innerHTML = '<div style="text-align:center;padding:20px 0;"><div class="spinner" style="margin:0 auto;"></div><div style="font-size:11px;color:var(--text-muted, #64748b);margin-top:8px;">Loading corporate actions...</div></div>';

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
    } catch(e) { }
  }

  const nseUrl = `https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=${sym}`;
  const sectionStyle = 'background:var(--bg-card, #0d1f35);border-radius:10px;padding:10px 12px;margin-bottom:10px;border:1px solid rgba(56,189,248,0.1);';
  const headStyle = 'font-size:12px;font-weight:700;color:var(--accent, #38bdf8);margin-bottom:6px;display:flex;align-items:center;gap:6px;';
  const rowStyle = 'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));font-size:11px;';
  const labelStyle = 'color:var(--text-sec, #94a3b8);';
  const valStyle = 'color:var(--text-primary, #e2e8f0);font-weight:600;text-align:right;max-width:55%;';
  const emptyStyle = 'color:var(--text-muted, #4b6280);font-size:10px;padding:4px 0;';

  function buildRows(items, fields) {
    if (!items || items.length === 0) return `<div style="${emptyStyle}">No recent data</div>`;
    return items.slice(0,6).map(item =>
      `<div style="${rowStyle}">${fields.map((f,i) =>
        `<span style="${i===0?labelStyle:valStyle}">${item[f.key]||'-'}</span>`
      ).join('')}</div>`
    ).join('');
  }

  const srcBadge = fbData ? `<span style="font-size:9px;background:rgba(52,211,153,0.15);color:var(--pos, #34d399);border-radius:4px;padding:2px 6px;">Firebase</span>` : `<span style="font-size:9px;background:rgba(56,189,248,0.15);color:var(--text-muted, #64748b);border-radius:4px;padding:2px 6px;">GAS / Live</span>`;
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
        <div style="font-size:15px;font-weight:700;color:var(--warn, #fb923c);font-family:'JetBrains Mono',monospace;">${sym} — Corporate Actions</div>
        ${srcBadge}
      </div>
      <div style="${sectionStyle}"><div style="${headStyle}">Dividends</div>${divRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}">Bonus & Splits</div><div style="margin-bottom:4px;font-size:10px;color:var(--text-muted, #64748b);">Bonus</div>${bonusRows}<div style="margin-top:6px;margin-bottom:4px;font-size:10px;color:var(--text-muted, #64748b);">Splits</div>${splitRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}">Board Meetings</div>${bmRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}">Bulk / Block Deals</div>${bulkRows}</div>
      <div style="${sectionStyle}"><div style="${headStyle}">NSE Announcements</div>${annRows}</div>
    </div>`;
}

function _learnNoData(sym, label) {
  return `<div style="text-align:center;padding:30px 14px;">
    <div style="font-size:28px;margin-bottom:8px;">📭</div>
    <div style="font-size:13px;color:var(--text-muted, #64748b);">${label} not available for ${sym}</div>
    <div style="font-size:11px;color:var(--text-muted, #4b6280);margin-top:4px;">Try checking Settings → API URL</div>
  </div>`;
}
// ========================================
// LEARN INFO DATA
// ========================================
const LEARN_INFO = {
  pe: {
    hi: { title: 'P/E Ratio', body: 'यह बताता है कि ₹1 कमाने के लिए आप कितने रुपये दे रहे हैं। कम P/E मतलब सस्ता शेयर।', formula: 'P/E = Share Price ÷ EPS', good: '< 15 = सस्ता  |  15–30 = ठीक  |  > 30 = महँगा' },
    gu: { title: 'P/E રેશિઓ', body: '₹1 કમાવા માટે તમે કેટલા રૂપિયા ચૂકવો છો. ઓછો P/E = સસ્તો શેર.', formula: 'P/E = Share Price ÷ EPS', good: '< 15 = સસ્તો  |  15–30 = ઠીક  |  > 30 = મોંઘો' },
    en: { title: 'P/E Ratio', body: 'How much you pay for ₹1 of earnings. Lower P/E = cheaper stock.', formula: 'P/E = Share Price ÷ EPS', good: '< 15 = Cheap  |  15–30 = Fair  |  > 30 = Expensive' }
  },
  eps: {
    hi: { title: 'EPS (प्रति शेयर आय)', body: 'कंपनी ने प्रत्येक शेयर पर कितना मुनाफा कमाया। जितना ज्यादा, उतना अच्छा।', formula: 'EPS = Net Profit ÷ Total Shares', good: '> 0 = अच्छा  |  बढ़ता EPS = स्वस्थ कंपनी' },
    gu: { title: 'EPS (પ્રતિ શેર કમાણી)', body: 'દરેક શેર પર કંપનીએ કેટલો નફો કર્યો. વધારે EPS = વધારે સારું.', formula: 'EPS = Net Profit ÷ Total Shares', good: '> 0 = સારું  |  વધતો EPS = તંદુરસ્ત કંપની' },
    en: { title: 'EPS (Earnings Per Share)', body: 'Profit earned per share. Higher & growing EPS = healthier company.', formula: 'EPS = Net Profit ÷ Total Shares', good: '> 0 = Good  |  Growing EPS = Healthy' }
  },
  roe: {
    hi: { title: 'ROE % (इक्विटी पर रिटर्न)', body: 'कंपनी अपने शेयरहोल्डर्स के पैसे पर कितना मुनाफा कमा रही है।', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', good: '≥ 15% = अच्छा  |  8–15% = ठीक  |  < 8% = कमजोर' },
    gu: { title: 'ROE % (ઇક્વિટી પર રિટર્ન)', body: 'કંપની શેરહોલ્ડર્સના પૈસા પર કેટલો નફો કરે છે.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', good: '≥ 15% = સારું  |  8–15% = ઠીક  |  < 8% = નબળું' },
    en: { title: 'ROE % (Return on Equity)', body: 'How efficiently the company generates profit from shareholders\' money.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', good: '≥ 15% = Good  |  8–15% = Fair  |  < 8% = Weak' }
  },
  roce: {
    hi: { title: 'ROCE % (पूंजी पर रिटर्न)', body: 'कंपनी अपनी कुल लगाई गई पूंजी पर कितना मुनाफा बना रही है।', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', good: '≥ 15% = अच्छा  |  8–15% = ठीक  |  < 8% = कमजोर' },
    gu: { title: 'ROCE % (મૂડી પર રિટર્ન)', body: 'કંપની લગાવેલી કુલ મૂડી પર કેટલો નફો કરે છે.', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', good: '≥ 15% = સારું  |  8–15% = ઠીક  |  < 8% = નબળું' },
    en: { title: 'ROCE % (Return on Capital Employed)', body: 'How much profit the company generates from all capital deployed.', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', good: '≥ 15% = Good  |  8–15% = Fair  |  < 8% = Weak' }
  },
  bookVal: {
    hi: { title: 'Book Value (बुक वैल्यू)', body: 'अगर कंपनी आज बंद हो जाए तो प्रति शेयर कितना मिलेगा। Price < Book Value = सस्ता!', formula: 'Book Value = Total Equity ÷ Total Shares', good: 'Price < BV = अंडरवैल्यूड' },
    gu: { title: 'Book Value (બુક વેલ્યૂ)', body: 'કંપની બંધ થઈ જાય તો દરેક શેર પર કેટલું મળે. Price < BV = સસ્તો!', formula: 'Book Value = Total Equity ÷ Total Shares', good: 'Price < BV = Undervalued' },
    en: { title: 'Book Value', body: 'What each share would be worth if the company liquidated. Price < BV = Undervalued!', formula: 'Book Value = Total Equity ÷ Total Shares', good: 'Price < BV = Undervalued' }
  },
  de: {
    hi: { title: 'Debt-to-Equity (कर्ज अनुपात)', body: 'कंपनी ने अपनी इक्विटी के मुकाबले कितना कर्ज लिया है। कम = बेहतर।', formula: 'D/E = Total Debt ÷ Total Equity', good: '< 0.5 = कम कर्ज  |  0.5–1 = ठीक  |  > 1 = ज्यादा कर्ज' },
    gu: { title: 'Debt-to-Equity (દેવું ગુણોત્તર)', body: 'ઇક્વિટી સામે કેટલું દેવું છે. ઓછું = વધારે સારું.', formula: 'D/E = Total Debt ÷ Total Equity', good: '< 0.5 = ઓછું દેવું  |  0.5–1 = ઠીક  |  > 1 = વધારે દેવું' },
    en: { title: 'Debt-to-Equity Ratio', body: 'How much debt the company carries relative to equity. Lower is better.', formula: 'D/E = Total Debt ÷ Total Equity', good: '< 0.5 = Low debt  |  0.5–1 = Fair  |  > 1 = High debt' }
  },
  cr: {
    hi: { title: 'Current Ratio (चालू अनुपात)', body: 'क्या कंपनी अपने अल्पकालिक कर्ज चुका सकती है? 1 से ज्यादा होना जरूरी।', formula: 'Current Ratio = Current Assets ÷ Current Liabilities', good: '≥ 1.5 = सुरक्षित  |  1–1.5 = ठीक  |  < 1 = खतरा' },
    gu: { title: 'Current Ratio (ચાલુ ગુણોત્તર)', body: 'કંપની ટૂંકા ગાળાની જવાબદારી ચૂકવી શકે? 1 થી વધારે હોવું જોઈએ.', formula: 'Current Ratio = Current Assets ÷ Current Liabilities', good: '≥ 1.5 = સુરક્ષિત  |  1–1.5 = ઠીક  |  < 1 = જોખમ' },
    en: { title: 'Current Ratio', body: 'Can the company pay its short-term obligations? Must be above 1.', formula: 'Current Ratio = Current Assets ÷ Current Liabilities', good: '≥ 1.5 = Safe  |  1–1.5 = Fair  |  < 1 = Risk' }
  },
  divYield: {
    hi: { title: 'Dividend Yield %', body: 'शेयर की कीमत के मुकाबले कंपनी कितना लाभांश देती है।', formula: 'Div Yield = (Dividend ÷ Share Price) × 100', good: '≥ 1% = अच्छा  |  > 0% = ठीक  |  0% = कोई लाभांश नहीं' },
    gu: { title: 'Dividend Yield %', body: 'શેર ભાવ સામે કંપની કેટલું ડિવિડન્ડ આપે છે.', formula: 'Div Yield = (Dividend ÷ Share Price) × 100', good: '≥ 1% = સારું  |  > 0% = ઠીક  |  0% = ડિવિડન્ડ નથી' },
    en: { title: 'Dividend Yield %', body: 'How much dividend the company pays relative to share price.', formula: 'Div Yield = (Dividend ÷ Share Price) × 100', good: '≥ 1% = Good  |  > 0% = Fair  |  0% = No dividend' }
  },
  promoter: {
    hi: { title: 'Promoter Holding %', body: 'कंपनी के मालिकों (प्रमोटर्स) के पास कितने % शेयर हैं। ज्यादा = भरोसेमंद।', formula: 'Screener/BSE से सीधा डेटा', good: '≥ 50% = मजबूत  |  35–50% = ठीक  |  < 35% = कम' },
    gu: { title: 'Promoter Holding %', body: 'કંપનીના માલિકો (Promoters) પાસે કેટલા % શેર છે. વધારે = ભરોસાપાત્ર.', formula: 'Screener/BSE direct data', good: '≥ 50% = મજબૂત  |  35–50% = ઠીક  |  < 35% = ઓછું' },
    en: { title: 'Promoter Holding %', body: 'How much % of shares the founders/promoters hold. Higher = more confidence.', formula: 'Direct from Screener/BSE', good: '≥ 50% = Strong  |  35–50% = Fair  |  < 35% = Low' }
  },
  rsi: {
    hi: { title: 'RSI (Momentum)', body: 'बताता है कि शेयर ओवरसोल्ड (सस्ता) है या ओवरबॉट (महँगा)।', formula: 'Relative Strength Index', good: '< 40 = Oversold (Good) | > 70 = Overbought' },
    gu: { title: 'RSI (મોમેન્ટમ)', body: 'શેર ઓવરસોલ્ડ (ખરીદવાની તક) છે કે ઓવરબૉટ (વેચવાની તક) તે દર્શાવે છે.', formula: 'Relative Strength Index', good: '< 40 = Oversold (સસ્તો) | > 70 = Overbought (મોંઘો)' },
    en: { title: 'RSI (Momentum)', body: 'Indicates if a stock is oversold (buy) or overbought (sell).', formula: 'Relative Strength Index', good: '< 40 = Oversold (Good) | > 70 = Overbought' }
  },
  fii: {
    hi: { title: 'FII Holding %', body: 'विदेशी संस्थागत निवेशकों की हिस्सेदारी। ज़्यादा = विदेशी भरोसा।', formula: 'Direct from BSE/NSE', good: '≥ 10% = अच्छा  |  5–10% = ठीक  |  < 5% = कम' },
    gu: { title: 'FII Holding %', body: 'વિદેશી સંસ્થાકીય રોકાણકારોની હિસ્સેદારી. વધારે = વિદેશી વિશ્વાસ.', formula: 'Direct from BSE/NSE', good: '≥ 10% = સારું  |  5–10% = ઠીક  |  < 5% = ઓછું' },
    en: { title: 'FII Holding %', body: 'Foreign Institutional Investors stake. Higher = more foreign confidence.', formula: 'Direct from BSE/NSE', good: '≥ 10% = Good  |  5–10% = Fair  |  < 5% = Low' }
  },
  dii: {
    hi: { title: 'DII Holding %', body: 'घरेलू संस्थागत निवेशकों की हिस्सेदारी। MF, LIC जैसे संस्थान।', formula: 'Direct from BSE/NSE', good: '≥ 5% = अच्छा  |  2–5% = ठीक  |  < 2% = कम' },
    gu: { title: 'DII Holding %', body: 'સ્થાનિક સંસ્થાકીય રોકાણકારોની હિસ્સેદારી. MF, LIC જેવી સંસ્થાઓ.', formula: 'Direct from BSE/NSE', good: '≥ 5% = સારું  |  2–5% = ઠીક  |  < 2% = ઓછું' },
    en: { title: 'DII Holding %', body: 'Domestic Institutional Investors stake. MF, LIC type institutions.', formula: 'Direct from BSE/NSE', good: '≥ 5% = Good  |  2–5% = Fair  |  < 2% = Low' }
  },
  roa: {
    hi: { title: 'ROA % (संपत्ति पर रिटर्न)', body: 'कंपनी अपनी कुल संपत्ति पर कितना मुनाफा कमाती है।', formula: 'ROA = (Net Profit ÷ Total Assets) × 100', good: '≥ 10% = अच्छा  |  5–10% = ठीक  |  < 5% = कमजोर' },
    gu: { title: 'ROA % (સંપત્તિ પર રિટર્ન)', body: 'કંપની કુલ સંપત્તિ પર કેટલો નફો કરે છે.', formula: 'ROA = (Net Profit ÷ Total Assets) × 100', good: '≥ 10% = સારું  |  5–10% = ઠીક  |  < 5% = નબળું' },
    en: { title: 'ROA % (Return on Assets)', body: 'How much profit the company generates from total assets.', formula: 'ROA = (Net Profit ÷ Total Assets) × 100', good: '≥ 10% = Good  |  5–10% = Fair  |  < 5% = Weak' }
  },
};
// ======================================
// FII / DII & IPO TRACKER MODULE (PREMIUM ULTRA EDITION v4.0)
// ======================================
let _activeIPOSegment = 'mainboard'; // 'mainboard' or 'sme'
let _activeIPOTab = 'recent'; // 'recent' or 'active'
let _ipoSearchQuery = '';
let _cachedFlowData = null;

const DEFAULT_FLOW_DATA = {
  fiidii: {
    date: '30-Oct-2026',
    fii: { buy: 20564.02, sell: 16965.48, net: 3598.54 },
    dii: { buy: 16643.55, sell: 17461.06, net: -817.51 },
    sentiment: 'Bullish'
  },
  recentIpos: [
    // --- MAINBOARD RECENT LISTINGS ---
    {
      name: 'Waaree Energies Limited',
      symbol: 'WAAREEENER',
      nseSymbol: 'WAAREEENER',
      bseCode: '544277',
      offerPrice: 'Rs.1,503',
      listingPrice: 'Rs.2,500',
      gainPct: 66.33,
      premium: '+66.33% Gain',
      dates: '28-Oct-2026',
      subscription: '79.44x',
      issueSize: 'Rs.4,321 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Godavari Biorefineries Limited',
      symbol: 'GODAVARI',
      nseSymbol: 'GODAVARI',
      bseCode: '544279',
      offerPrice: 'Rs.352',
      listingPrice: 'Rs.310.55',
      gainPct: -11.78,
      premium: '-11.78% Discount',
      dates: '30-Oct-2026',
      subscription: '1.83x',
      issueSize: 'Rs.555 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Deepak Builders & Engineers',
      symbol: 'DEEPAK',
      nseSymbol: 'DEEPAK',
      bseCode: '544278',
      offerPrice: 'Rs.203',
      listingPrice: 'Rs.198.50',
      gainPct: -2.22,
      premium: '-2.22% Discount',
      dates: '28-Oct-2026',
      subscription: '41.54x',
      issueSize: 'Rs.260 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Hyundai Motor India Limited',
      symbol: 'HYUNDAI',
      nseSymbol: 'HYUNDAI',
      bseCode: '544274',
      offerPrice: 'Rs.1,960',
      listingPrice: 'Rs.1,934',
      gainPct: -1.33,
      premium: '-1.33% Discount',
      dates: '22-Oct-2026',
      subscription: '2.37x',
      issueSize: 'Rs.27,870 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Garuda Construction and Engg',
      symbol: 'GARUDA',
      nseSymbol: 'GARUDA',
      bseCode: '544272',
      offerPrice: 'Rs.95',
      listingPrice: 'Rs.105',
      gainPct: 10.53,
      premium: '+10.53% Gain',
      dates: '15-Oct-2026',
      subscription: '7.55x',
      issueSize: 'Rs.264 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Afcons Infrastructure Limited',
      symbol: 'AFCONS',
      nseSymbol: 'AFCONS',
      bseCode: '544280',
      offerPrice: 'Rs.463',
      listingPrice: 'Rs.426',
      gainPct: -8.00,
      premium: '-8.00% Discount',
      dates: '04-Nov-2026',
      subscription: '2.70x',
      issueSize: 'Rs.5,430 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Swiggy Limited',
      symbol: 'SWIGGY',
      nseSymbol: 'SWIGGY',
      bseCode: '544285',
      offerPrice: 'Rs.390',
      listingPrice: 'Rs.420',
      gainPct: 7.69,
      premium: '+7.69% Gain',
      dates: '13-Nov-2026',
      subscription: '3.59x',
      issueSize: 'Rs.11,327 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'KRN Heat Exchanger & Refrigeration',
      symbol: 'KRN',
      nseSymbol: 'KRN',
      bseCode: '544265',
      offerPrice: 'Rs.220',
      listingPrice: 'Rs.470',
      gainPct: 113.64,
      premium: '+113.64% Gain',
      dates: '03-Oct-2026',
      subscription: '214.4x',
      issueSize: 'Rs.342 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Northern Arc Capital Limited',
      symbol: 'NORTHARC',
      nseSymbol: 'NORTHARC',
      bseCode: '544258',
      offerPrice: 'Rs.263',
      listingPrice: 'Rs.351',
      gainPct: 33.46,
      premium: '+33.46% Gain',
      dates: '24-Sep-2026',
      subscription: '117.2x',
      issueSize: 'Rs.777 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Arkade Developers Limited',
      symbol: 'ARKADE',
      nseSymbol: 'ARKADE',
      bseCode: '544259',
      offerPrice: 'Rs.128',
      listingPrice: 'Rs.175.90',
      gainPct: 37.42,
      premium: '+37.42% Gain',
      dates: '24-Sep-2026',
      subscription: '113.5x',
      issueSize: 'Rs.410 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Western Carriers (India)',
      symbol: 'WESTERN',
      nseSymbol: 'WESTERN',
      bseCode: '544260',
      offerPrice: 'Rs.172',
      listingPrice: 'Rs.170',
      gainPct: -1.16,
      premium: '-1.16% Discount',
      dates: '24-Sep-2026',
      subscription: '30.57x',
      issueSize: 'Rs.493 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Bajaj Housing Finance Limited',
      symbol: 'BAJAJHFL',
      nseSymbol: 'BAJAJHFL',
      bseCode: '544252',
      offerPrice: 'Rs.70',
      listingPrice: 'Rs.150',
      gainPct: 114.29,
      premium: '+114.29% Gain',
      dates: '16-Sep-2026',
      subscription: '67.43x',
      issueSize: 'Rs.6,560 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Premier Energies Limited',
      symbol: 'PREMIERENE',
      nseSymbol: 'PREMIERENE',
      bseCode: '544238',
      offerPrice: 'Rs.450',
      listingPrice: 'Rs.991',
      gainPct: 120.22,
      premium: '+120.22% Gain',
      dates: '03-Sep-2026',
      subscription: '75.00x',
      issueSize: 'Rs.2,830 Cr',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    // --- SME RECENT LISTINGS ---
    {
      name: 'Danish Power Limited',
      symbol: 'DANISH',
      nseSymbol: 'DANISH',
      bseCode: '',
      offerPrice: 'Rs.380',
      listingPrice: 'Rs.980',
      gainPct: 157.89,
      premium: '+157.89% Gain',
      dates: '29-Oct-2026',
      subscription: '126.18x',
      issueSize: 'Rs.198 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'United Heat Transfer Limited',
      symbol: 'UNITEDHEAT',
      nseSymbol: 'UNITEDHEAT',
      bseCode: '',
      offerPrice: 'Rs.59',
      listingPrice: 'Rs.61',
      gainPct: 3.39,
      premium: '+3.39% Gain',
      dates: '29-Oct-2026',
      subscription: '83.70x',
      issueSize: 'Rs.30 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'OBSC Perfection Limited',
      symbol: 'OBSC',
      nseSymbol: 'OBSC',
      bseCode: '',
      offerPrice: 'Rs.100',
      listingPrice: 'Rs.155',
      gainPct: 55.00,
      premium: '+55.00% Gain',
      dates: '29-Oct-2026',
      subscription: '16.52x',
      issueSize: 'Rs.66 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Premium Plast Limited',
      symbol: 'PREMIUM',
      nseSymbol: 'PREMIUM',
      bseCode: '',
      offerPrice: 'Rs.49',
      listingPrice: 'Rs.65',
      gainPct: 32.65,
      premium: '+32.65% Gain',
      dates: '28-Oct-2026',
      subscription: '38.61x',
      issueSize: 'Rs.26 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Freshara Agro Exports Limited',
      symbol: 'FRESHARA',
      nseSymbol: 'FRESHARA',
      bseCode: '',
      offerPrice: 'Rs.116',
      listingPrice: 'Rs.145',
      gainPct: 25.00,
      premium: '+25.00% Gain',
      dates: '24-Oct-2026',
      subscription: '236.80x',
      issueSize: 'Rs.75 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Lakshya Powertech Limited',
      symbol: 'LAKSHYA',
      nseSymbol: 'LAKSHYA',
      bseCode: '',
      offerPrice: 'Rs.180',
      listingPrice: 'Rs.342',
      gainPct: 90.00,
      premium: '+90.00% Gain',
      dates: '23-Oct-2026',
      subscription: '573.77x',
      issueSize: 'Rs.50 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Pranik Logistics Limited',
      symbol: 'PRANIK',
      nseSymbol: 'PRANIK',
      bseCode: '',
      offerPrice: 'Rs.77',
      listingPrice: 'Rs.77',
      gainPct: 0.00,
      premium: '0.00% At Par',
      dates: '17-Oct-2026',
      subscription: '4.82x',
      issueSize: 'Rs.22 Cr',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Shiv Texchem Limited',
      symbol: 'SHIVTEX',
      nseSymbol: '',
      bseCode: '544268',
      offerPrice: 'Rs.166',
      listingPrice: 'Rs.225',
      gainPct: 35.54,
      premium: '+35.54% Gain',
      dates: '15-Oct-2026',
      subscription: '156.55x',
      issueSize: 'Rs.101 Cr',
      segment: 'SME',
      exchange: 'BSE SME'
    },
    {
      name: 'Khyati Global Ventures',
      symbol: 'KHYATI',
      nseSymbol: '',
      bseCode: '544267',
      offerPrice: 'Rs.99',
      listingPrice: 'Rs.100',
      gainPct: 1.01,
      premium: '+1.01% Gain',
      dates: '11-Oct-2026',
      subscription: '8.82x',
      issueSize: 'Rs.26 Cr',
      segment: 'SME',
      exchange: 'BSE SME'
    }
  ],
  activeIpos: [
    // --- MAINBOARD ACTIVE & UPCOMING ---
    {
      name: 'NTPC Green Energy Limited',
      symbol: 'NTPCGREEN',
      price: 'Rs.102 - 108',
      lot: '138 Shares',
      dates: 'Nov 19 - Nov 22, 2026',
      size: 'Rs.10,000 Cr',
      sub: '2.42x',
      status: 'Live',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Zinka Logistics (BlackBuck)',
      symbol: 'BLACKBUCK',
      price: 'Rs.259 - 273',
      lot: '54 Shares',
      dates: 'Nov 13 - Nov 18, 2026',
      size: 'Rs.1,115 Cr',
      sub: '1.86x',
      status: 'Allotment',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'ACME Solar Holdings Limited',
      symbol: 'ACMESOLAR',
      price: 'Rs.275 - 289',
      lot: '51 Shares',
      dates: 'Nov 06 - Nov 08, 2026',
      size: 'Rs.2,900 Cr',
      sub: '2.89x',
      status: 'Allotment',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    {
      name: 'Sagility India Limited',
      symbol: 'SAGILITY',
      price: 'Rs.28 - 30',
      lot: '500 Shares',
      dates: 'Nov 05 - Nov 07, 2026',
      size: 'Rs.2,106 Cr',
      sub: '3.20x',
      status: 'Allotment',
      segment: 'Mainboard',
      exchange: 'NSE / BSE'
    },
    // --- SME ACTIVE & UPCOMING ---
    {
      name: 'Usha Financial Services Limited',
      symbol: 'USHAFIN',
      price: 'Rs.160 - 168',
      lot: '800 Shares',
      dates: 'Oct 24 - Oct 28, 2026',
      size: 'Rs.98.45 Cr',
      sub: '19.42x',
      status: 'Allotment',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'C2C Advanced Systems Limited',
      symbol: 'C2CADV',
      price: 'Rs.214 - 226',
      lot: '600 Shares',
      dates: 'Nov 22 - Nov 26, 2026',
      size: 'Rs.99.07 Cr',
      sub: '125.40x',
      status: 'Upcoming',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Rajputana Biodiesel Limited',
      symbol: 'RAJPUTANA',
      price: 'Rs.123 - 130',
      lot: '1000 Shares',
      dates: 'Nov 26 - Nov 28, 2026',
      size: 'Rs.24.70 Cr',
      sub: '65.20x',
      status: 'Upcoming',
      segment: 'SME',
      exchange: 'NSE SME'
    },
    {
      name: 'Apex Ecotech Limited',
      symbol: 'APEXECO',
      price: 'Rs.71 - 73',
      lot: '1600 Shares',
      dates: 'Nov 27 - Nov 29, 2026',
      size: 'Rs.25.54 Cr',
      sub: '42.10x',
      status: 'Upcoming',
      segment: 'SME',
      exchange: 'NSE SME'
    }
  ]
};

async function renderMarketFlows() {
  const container = document.getElementById('marketFlowContent');
  if (!container) return;

  let data = _cachedFlowData || DEFAULT_FLOW_DATA;
  if (!_cachedFlowData && window.db) {
    try {
      const [snapFlow, snapIpo] = await Promise.all([
        window.db.collection('market_stats').doc('fiidii').get().catch(() => null),
        window.db.collection('market_stats').doc('ipos').get().catch(() => null)
      ]);
      const flowData = snapFlow && snapFlow.exists ? snapFlow.data() : {};
      const ipoData = snapIpo && snapIpo.exists ? snapIpo.data() : {};
      _cachedFlowData = Object.assign({}, DEFAULT_FLOW_DATA, flowData, ipoData);
      data = _cachedFlowData;
    } catch(e) {
      console.warn('Firebase flow fetch note:', e);
    }
  }

  // Calculate segment totals
  const allRecent = data.recentIpos || [];
  const allActive = data.activeIpos || [];
  
  const mainRecent = allRecent.filter(x => (x.segment || 'Mainboard').toLowerCase() === 'mainboard');
  const mainActive = allActive.filter(x => (x.segment || 'Mainboard').toLowerCase() === 'mainboard');
  const smeRecent = allRecent.filter(x => (x.segment || '').toLowerCase() === 'sme');
  const smeActive = allActive.filter(x => (x.segment || '').toLowerCase() === 'sme');

  const countMainboardTotal = mainRecent.length + mainActive.length;
  const countSMETotal = smeRecent.length + smeActive.length;

  const currentSegmentRecent = _activeIPOSegment === 'sme' ? smeRecent : mainRecent;
  const currentSegmentActive = _activeIPOSegment === 'sme' ? smeActive : mainActive;

  const isMainboard = _activeIPOSegment === 'mainboard';
  const themeColor = isMainboard ? '#38bdf8' : '#f59e0b';
  const themeRgb = isMainboard ? '56,189,248' : '245,158,11';

  const fii = (data.fiidii && data.fiidii.fii) || { buy: 0, sell: 0, net: 0 };
  const dii = (data.fiidii && data.fiidii.dii) || { buy: 0, sell: 0, net: 0 };
  const totalNet = (fii.net || 0) + (dii.net || 0);
  const netInflowColor = totalNet >= 0 ? '#22c55e' : '#ef4444';

  let html = `
    <!-- INSTITUTIONAL FLOW CARD (FII / DII) -->
    <div style="background:linear-gradient(145deg, rgba(13,31,53,0.95) 0%, rgba(8,20,36,0.98) 100%);border:1px solid rgba(56,189,248,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.4);border-radius:16px;padding:16px;margin-bottom:18px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, #38bdf8, #818cf8, #fb923c);"></div>

      <!-- Card Top Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(56,189,248,0.15);display:flex;align-items:center;justify-content:center;font-size:14px;">
            🏛️
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:#f8fafc;letter-spacing:0.8px;font-family:'Rajdhani',sans-serif;text-transform:uppercase;">Institutional Activity</div>
            <div style="font-size:9px;color:#64748b;font-family:'JetBrains Mono',monospace;">FII & DII Cash Flow • Live NSE</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(34,197,94,0.12);color:#22c55e;border:1px solid rgba(34,197,94,0.25);font-family:'JetBrains Mono',monospace;">
            ● ${_formatIPODate(data.fiidii && data.fiidii.date) || new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).replace(/ /g, '-')}
          </span>
        </div>
      </div>

      <!-- Dual FII vs DII Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <!-- FII Card -->
        <div style="background:rgba(15,23,42,0.65);border:1px solid rgba(56,189,248,0.15);border-radius:12px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#38bdf8;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;">FII / FPI</span>
            <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:${fii.net >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};color:${fii.net >= 0 ? '#22c55e' : '#ef4444'};">
              ${fii.net >= 0 ? 'BUYER' : 'SELLER'}
            </span>
          </div>
          <div style="font-size:18px;font-weight:800;color:${fii.net >= 0 ? '#22c55e' : '#ef4444'};font-family:'JetBrains Mono',monospace;">
            ${fii.net >= 0 ? '+' : ''}₹${Number(fii.net || 0).toLocaleString('en-IN', {maximumFractionDigits:2})} <span style="font-size:10px;font-weight:600;color:#94a3b8;">Cr</span>
          </div>
          <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:9px;color:#64748b;font-family:'JetBrains Mono',monospace;border-top:1px solid rgba(255,255,255,0.04);padding-top:4px;">
            <span>Buy: ₹${Number(fii.buy || 0).toLocaleString('en-IN', {maximumFractionDigits:0})} Cr</span>
            <span>Sell: ₹${Number(fii.sell || 0).toLocaleString('en-IN', {maximumFractionDigits:0})} Cr</span>
          </div>
        </div>

        <!-- DII Card -->
        <div style="background:rgba(15,23,42,0.65);border:1px solid rgba(251,146,60,0.15);border-radius:12px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#fb923c;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;">DII (DOMESTIC)</span>
            <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:${dii.net >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};color:${dii.net >= 0 ? '#22c55e' : '#ef4444'};">
              ${dii.net >= 0 ? 'BUYER' : 'SELLER'}
            </span>
          </div>
          <div style="font-size:18px;font-weight:800;color:${dii.net >= 0 ? '#22c55e' : '#ef4444'};font-family:'JetBrains Mono',monospace;">
            ${dii.net >= 0 ? '+' : ''}₹${Number(dii.net || 0).toLocaleString('en-IN', {maximumFractionDigits:2})} <span style="font-size:10px;font-weight:600;color:#94a3b8;">Cr</span>
          </div>
          <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:9px;color:#64748b;font-family:'JetBrains Mono',monospace;border-top:1px solid rgba(255,255,255,0.04);padding-top:4px;">
            <span>Buy: ₹${Number(dii.buy || 0).toLocaleString('en-IN', {maximumFractionDigits:0})} Cr</span>
            <span>Sell: ₹${Number(dii.sell || 0).toLocaleString('en-IN', {maximumFractionDigits:0})} Cr</span>
          </div>
        </div>
      </div>

      <!-- Net Sentiment Footer Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.3);border-radius:8px;padding:7px 12px;border:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:10px;color:#94a3b8;font-weight:600;">Combined Net Flow:</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;font-weight:800;color:${netInflowColor};font-family:'JetBrains Mono',monospace;">
            ${totalNet >= 0 ? '+' : ''}₹${Number(totalNet).toLocaleString('en-IN', {maximumFractionDigits:2})} Cr
          </span>
          <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:${netInflowColor}18;color:${netInflowColor};">
            ${totalNet >= 0 ? '🚀 Bullish Inflow' : '⚠️ Net Outflow'}
          </span>
        </div>
      </div>
    </div>

    <!-- IPO CENTRAL TRACKER CONTAINER (PREMIUM) -->
    <div style="background:linear-gradient(145deg, rgba(13,31,53,0.92) 0%, rgba(8,20,36,0.96) 100%);border:1px solid rgba(255,255,255,0.08);box-shadow:0 8px 32px rgba(0,0,0,0.35);border-radius:16px;padding:16px;margin-bottom:20px;">
      
      <!-- Top Title + Pulse -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(251,146,60,0.15);display:flex;align-items:center;justify-content:center;font-size:14px;">
            🚀
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#f8fafc;letter-spacing:0.8px;font-family:'Rajdhani',sans-serif;text-transform:uppercase;">IPO Central & Analytics</div>
            <div style="font-size:9px;color:#64748b;font-family:'JetBrains Mono',monospace;">Powered by IPO Ji Live Feeds</div>
          </div>
        </div>
        <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(56,189,248,0.12);color:#38bdf8;border:1px solid rgba(56,189,248,0.25);font-family:'JetBrains Mono',monospace;">
          ● LIVE TRACKER
        </span>
      </div>

      <!-- PRIMARY SEGMENT TABS (MAINBOARD vs SME SEPARATE TABS) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(0,0,0,0.4);padding:4px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);margin-bottom:14px;">
        <!-- MAINBOARD TAB BUTTON -->
        <button onclick="switchIPOSegment('mainboard')" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0;border-radius:9px;cursor:pointer;border:1px solid ${isMainboard ? 'rgba(56,189,248,0.5)' : 'transparent'};background:${isMainboard ? 'linear-gradient(135deg, rgba(56,189,248,0.25) 0%, rgba(14,165,233,0.12) 100%)' : 'transparent'};color:${isMainboard ? '#38bdf8' : '#64748b'};font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.5px;transition:all 0.2s;box-shadow:${isMainboard ? '0 2px 10px rgba(56,189,248,0.2)' : 'none'};">
          <span>🏛️ Mainboard IPO</span>
          <span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;background:${isMainboard ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.06)'};color:${isMainboard ? '#e0f2fe' : '#64748b'};font-family:'JetBrains Mono',monospace;">
            ${countMainboardTotal}
          </span>
        </button>

        <!-- SME TAB BUTTON -->
        <button onclick="switchIPOSegment('sme')" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0;border-radius:9px;cursor:pointer;border:1px solid ${!isMainboard ? 'rgba(245,158,11,0.5)' : 'transparent'};background:${!isMainboard ? 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.12) 100%)' : 'transparent'};color:${!isMainboard ? '#f59e0b' : '#64748b'};font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.5px;transition:all 0.2s;box-shadow:${!isMainboard ? '0 2px 10px rgba(245,158,11,0.2)' : 'none'};">
          <span>🏢 SME Platform</span>
          <span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;background:${!isMainboard ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'};color:${!isMainboard ? '#fef3c7' : '#64748b'};font-family:'JetBrains Mono',monospace;">
            ${countSMETotal}
          </span>
        </button>
      </div>

      <!-- SUB-FILTERS: Recently Listed vs Active & Upcoming -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="display:flex;gap:4px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);padding:3px;border-radius:9px;">
          <button onclick="switchIPOTab('recent')" style="font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;border:none;cursor:pointer;background:${_activeIPOTab === 'recent' ? `rgba(${themeRgb},0.2)` : 'transparent'};color:${_activeIPOTab === 'recent' ? themeColor : '#64748b'};font-family:'Rajdhani',sans-serif;transition:all 0.15s;">
            📈 Recently Listed (${currentSegmentRecent.length})
          </button>
          <button onclick="switchIPOTab('active')" style="font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;border:none;cursor:pointer;background:${_activeIPOTab === 'active' ? `rgba(${themeRgb},0.2)` : 'transparent'};color:${_activeIPOTab === 'active' ? themeColor : '#64748b'};font-family:'Rajdhani',sans-serif;transition:all 0.15s;">
            ⚡ Active & Upcoming (${currentSegmentActive.length})
          </button>
        </div>

        <!-- Quick Instant Search -->
        <div style="flex:1;min-width:140px;max-width:220px;position:relative;">
          <input type="text" id="ipoSearchInput" value="${_ipoSearchQuery}" oninput="filterIPOSearch(this.value)" placeholder="🔍 Search ${isMainboard ? 'Mainboard' : 'SME'}..." style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:6px 10px;font-size:10px;color:#f1f5f9;outline:none;font-family:'Rajdhani',sans-serif;">
        </div>
      </div>

      <!-- IPO Cards Content Area -->
      <div id="ipoContentArea">
        ${_getIPOListHTML(data)}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function switchIPOSegment(seg) {
  _activeIPOSegment = seg;
  _ipoSearchQuery = '';
  renderMarketFlows();
}

function switchIPOTab(tab) {
  _activeIPOTab = tab;
  renderMarketFlows();
}

function filterIPOSearch(query) {
  _ipoSearchQuery = (query || '').toLowerCase().trim();
  const area = document.getElementById('ipoContentArea');
  if (area) {
    area.innerHTML = _getIPOListHTML(_cachedFlowData || DEFAULT_FLOW_DATA);
  }
}


function _formatIPODate(dStr) {
  if (!dStr) return '';
  const currYear = new Date().getFullYear().toString();
  return dStr.replace(/202[0-5]/g, currYear);
}

function _getIPOListHTML(data) {
  const isMainboard = _activeIPOSegment === 'mainboard';
  const rawList = _activeIPOTab === 'active' ? (data.activeIpos || []) : (data.recentIpos || []);

  // 1. Filter by segment (Mainboard vs SME)
  let list = rawList.filter(item => {
    const s = (item.segment || 'Mainboard').toLowerCase();
    return isMainboard ? (s === 'mainboard') : (s === 'sme');
  });

  // 2. Filter by search query
  if (_ipoSearchQuery) {
    list = list.filter(item => {
      const q = _ipoSearchQuery;
      return (item.name || '').toLowerCase().includes(q) ||
             (item.symbol || '').toLowerCase().includes(q) ||
             (item.nseSymbol || '').toLowerCase().includes(q) ||
             (item.bseCode || '').toLowerCase().includes(q);
    });
  }

  if (list.length === 0) {
    return `
      <div style="text-align:center;padding:35px 20px;background:rgba(0,0,0,0.2);border-radius:12px;border:1px dashed rgba(255,255,255,0.08);margin-top:8px;">
        <div style="font-size:28px;margin-bottom:8px;">📂</div>
        <div style="font-size:12px;font-weight:700;color:#94a3b8;font-family:'Rajdhani',sans-serif;">No ${isMainboard ? 'Mainboard' : 'SME'} IPOs Found</div>
        <div style="font-size:10px;color:#64748b;margin-top:3px;">Try adjusting your search query or switch tabs</div>
      </div>
    `;
  }

  const borderAccent = isMainboard ? '#38bdf8' : '#f59e0b';
  const tagBg = isMainboard ? 'rgba(56,189,248,0.12)' : 'rgba(245,158,11,0.12)';
  const tagBorder = isMainboard ? 'rgba(56,189,248,0.25)' : 'rgba(245,158,11,0.25)';
  const tagText = isMainboard ? '#38bdf8' : '#f59e0b';

  // --- RENDER ACTIVE & UPCOMING ---
  if (_activeIPOTab === 'active') {
    return list.map(item => {
      const isLive = item.status === 'Live';
      const isAllotment = item.status === 'Allotment';
      const statusColor = isLive ? '#22c55e' : (isAllotment ? '#f59e0b' : '#38bdf8');
      const statusLabel = isLive ? '● Live Bidding' : (isAllotment ? '● Allotment' : '⏳ Upcoming');

      return `
        <div style="background:linear-gradient(145deg, rgba(15,23,42,0.75) 0%, rgba(24,37,63,0.85) 100%);border:1px solid rgba(255,255,255,0.08);border-left:3.5px solid ${borderAccent};box-shadow:0 4px 18px rgba(0,0,0,0.3);border-radius:12px;padding:12px 14px;margin-bottom:10px;transition:all 0.2s;">
          <!-- Top Row -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="flex:1;padding-right:8px;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:13px;font-weight:700;color:#f8fafc;font-family:'Rajdhani',sans-serif;letter-spacing:0.3px;">${item.name}</span>
                <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:${tagBg};color:${tagText};border:1px solid ${tagBorder};font-family:'JetBrains Mono',monospace;">
                  ${item.exchange || (isMainboard ? 'MAINBOARD' : 'SME')}
                </span>
              </div>
              <div style="font-size:9px;color:#94a3b8;margin-top:3px;font-family:'JetBrains Mono',monospace;">
                📅 Bidding: ${_formatIPODate(item.dates) || 'TBA'}
              </div>
            </div>
            <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40;white-space:nowrap;font-family:'JetBrains Mono',monospace;">
              ${statusLabel}
            </span>
          </div>

          <!-- Middle Bento Stats Grid -->
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;background:rgba(0,0,0,0.3);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
            <div>
              <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Price Band</div>
              <div style="font-size:11px;font-weight:700;color:#fb923c;margin-top:1px;">${item.price || '--'}</div>
            </div>
            <div>
              <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Lot Size</div>
              <div style="font-size:11px;font-weight:700;color:#e2e8f0;margin-top:1px;">${item.lot || '--'}</div>
            </div>
            <div>
              <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Subscription</div>
              <div style="font-size:11px;font-weight:700;color:#22c55e;margin-top:1px;">${item.sub ? '🔥 ' + item.sub : '--'}</div>
            </div>
            <div>
              <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Issue Size</div>
              <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:1px;">${item.size || '--'}</div>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#64748b;">
            <span>Category: <b style="color:#cbd5e1;">${isMainboard ? 'Mainboard' : 'SME Platform'}</b></span>
            <span style="color:#38bdf8;font-style:italic;">Apply via UPI Broker</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- RENDER RECENTLY LISTED ---
  return list.map(item => {
    const sym = item.symbol || item.nseSymbol || item.bseCode || '';
    const gain = item.gainPct !== undefined ? item.gainPct : (parseFloat((item.premium || '').replace(/[^0-9\.\-]/g, '')) || 0);
    const isGain = gain > 0;
    const isPar = gain === 0;
    const gainColor = isGain ? '#22c55e' : (isPar ? '#f59e0b' : '#ef4444');
    const gainIcon = isGain ? (gain >= 50 ? '🚀' : '▲') : (isPar ? '●' : '▼');
    const gainText = isGain ? `+${gain.toFixed(2)}%` : `${gain.toFixed(2)}%`;

    return `
      <div style="background:linear-gradient(145deg, rgba(15,23,42,0.75) 0%, rgba(24,37,63,0.85) 100%);border:1px solid rgba(255,255,255,0.08);border-left:3.5px solid ${borderAccent};box-shadow:0 4px 18px rgba(0,0,0,0.3);border-radius:12px;padding:12px 14px;margin-bottom:10px;transition:all 0.2s;">
        <!-- Top Row -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="flex:1;padding-right:8px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:12px;font-weight:800;color:${borderAccent};font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);">
                ${sym}
              </span>
              <span style="font-size:13px;font-weight:700;color:#f8fafc;font-family:'Rajdhani',sans-serif;letter-spacing:0.3px;">${item.name}</span>
              <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:${tagBg};color:${tagText};border:1px solid ${tagBorder};font-family:'JetBrains Mono',monospace;">
                ${item.exchange || (isMainboard ? 'MAINBOARD' : 'SME')}
              </span>
            </div>
            <div style="font-size:9px;color:#94a3b8;margin-top:3px;font-family:'JetBrains Mono',monospace;">
              📅 Listed on ${_formatIPODate(item.dates) || 'Recent'}
            </div>
          </div>
          <button onclick="addStock('${sym}');if(typeof showPopup==='function')showPopup('✅ ${sym} added to Watchlist!');" style="background:linear-gradient(135deg, rgba(56,189,248,0.2), rgba(14,165,233,0.35));border:1px solid rgba(56,189,248,0.45);color:#38bdf8;font-size:10px;font-weight:700;padding:4px 10px;border-radius:7px;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(56,189,248,0.25);transition:all 0.15s;">
            + Watchlist
          </button>
        </div>

        <!-- Middle Bento Stats Grid -->
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;background:rgba(0,0,0,0.3);border-radius:8px;padding:8px 10px;font-family:'JetBrains Mono',monospace;">
          <div>
            <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Offer Price</div>
            <div style="font-size:11px;font-weight:700;color:#e2e8f0;margin-top:1px;">${item.offerPrice || '--'}</div>
          </div>
          <div>
            <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Listing Price</div>
            <div style="font-size:11px;font-weight:700;color:${borderAccent};margin-top:1px;">${item.listingPrice || '--'}</div>
          </div>
          <div>
            <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Subscription</div>
            <div style="font-size:11px;font-weight:700;color:#e2e8f0;margin-top:1px;">${item.subscription ? '🔥 ' + item.subscription : '--'}</div>
          </div>
          <div>
            <div style="font-size:8px;color:#64748b;text-transform:uppercase;">Issue Size</div>
            <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:1px;">${item.issueSize || '--'}</div>
          </div>
        </div>

        <!-- Bottom Return Badge -->
        <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;background:${gainColor}12;border:1px solid ${gainColor}30;padding:4px 10px;border-radius:6px;">
          <span style="font-size:9px;color:#94a3b8;font-weight:600;">Listing Day Gain / Return:</span>
          <span style="font-size:11px;font-weight:800;color:${gainColor};font-family:'JetBrains Mono',monospace;">
            ${gainIcon} ${gainText} ${isGain ? 'GAIN' : (isPar ? 'PAR' : 'DISC')}
          </span>
        </div>
      </div>
    `;
  }).join('');
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
window.renderMarketFlows = renderMarketFlows;
window.switchIPOTab = switchIPOTab;
window.switchIPOSegment = switchIPOSegment;
window.filterIPOSearch = filterIPOSearch;
window.downloadLearnPDF = downloadLearnPDF;

console.log('✅ learn.js loaded successfully');
