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
  const schPanel = document.getElementById('lpanel-school');
  if (finPanel) finPanel.style.display = isFinancial ? 'flex' : 'none';
  if (schPanel) schPanel.style.display = isFinancial ? 'none' : 'block';

  const finBtn = document.getElementById('lmain-financial');
  const schBtn = document.getElementById('lmain-school');
  if (finBtn) {
    finBtn.style.borderBottomColor = isFinancial ? '#fb923c' : 'transparent';
    finBtn.style.background = isFinancial ? 'rgba(251,146,60,0.08)' : 'transparent';
    finBtn.style.color = isFinancial ? '#fb923c' : 'var(--text-muted, #64748b)';
  }
  if (schBtn) {
    schBtn.style.borderBottomColor = !isFinancial ? '#fb923c' : 'transparent';
    schBtn.style.background = !isFinancial ? 'rgba(251,146,60,0.08)' : 'transparent';
    schBtn.style.color = !isFinancial ? '#fb923c' : 'var(--text-muted, #64748b)';
  }

  if (!isFinancial) renderMarketSchool();
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
// MARKET SCHOOL DATA
// ======================================
var CANDLE_SVG = {
  basics: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
    <!-- Green bullish candle -->
    <line x1="30" y1="10" x2="30" y2="25" stroke="#22c55e" stroke-width="2"/>
    <rect x="22" y="25" width="16" height="35" fill="#22c55e" rx="1"/>
    <line x1="30" y1="60" x2="30" y2="75" stroke="#22c55e" stroke-width="2"/>
    <text x="30" y="88" text-anchor="middle" fill="#64748b" font-size="8" font-family="Rajdhani">Bullish</text>
    <!-- Red bearish candle -->
    <line x1="90" y1="15" x2="90" y2="30" stroke="#ef4444" stroke-width="2"/>
    <rect x="82" y="30" width="16" height="35" fill="#ef4444" rx="1"/>
    <line x1="90" y1="65" x2="90" y2="80" stroke="#ef4444" stroke-width="2"/>
    <text x="90" y="92" text-anchor="middle" fill="#64748b" font-size="8" font-family="Rajdhani">Bearish</text>
    <!-- Labels -->
    <text x="6" y="28" fill="#94a3b8" font-size="7" font-family="Rajdhani">High</text>
    <text x="6" y="42" fill="#94a3b8" font-size="7" font-family="Rajdhani">Open</text>
    <text x="6" y="58" fill="#94a3b8" font-size="7" font-family="Rajdhani">Close</text>
    <text x="6" y="72" fill="#94a3b8" font-size="7" font-family="Rajdhani">Low</text>
  </svg>`,

  doji: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
    <!-- Standard Doji -->
    <line x1="30" y1="10" x2="30" y2="85" stroke="#f59e0b" stroke-width="2"/>
    <rect x="20" y="46" width="20" height="4" fill="#f59e0b" rx="1"/>
    <text x="30" y="96" text-anchor="middle" fill="#64748b" font-size="8" font-family="Rajdhani">Doji</text>
    <!-- Gravestone Doji -->
    <line x1="90" y1="10" x2="90" y2="50" stroke="#f59e0b" stroke-width="2"/>
    <rect x="80" y="48" width="20" height="4" fill="#f59e0b" rx="1"/>
    <line x1="90" y1="52" x2="90" y2="58" stroke="#f59e0b" stroke-width="2"/>
    <text x="90" y="70" text-anchor="middle" fill="#64748b" font-size="7" font-family="Rajdhani">Gravestone</text>
    <!-- Open=Close label -->
    <text x="30" y="38" text-anchor="middle" fill="#f59e0b" font-size="7" font-family="Rajdhani">Open≈Close</text>
  </svg>`,

  hammer: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" width="120" height="100">
    <!-- Hammer (green) -->
    <rect x="22" y="30" width="16" height="14" fill="#22c55e" rx="1"/>
    <line x1="30" y1="44" x2="30" y2="82" stroke="#22c55e" stroke-width="2"/>
    <line x1="30" y1="28" x2="30" y2="30" stroke="#22c55e" stroke-width="2"/>
    <text x="30" y="94" text-anchor="middle" fill="#64748b" font-size="8" font-family="Rajdhani">Hammer ✅</text>
    <!-- Hanging Man (red) -->
    <rect x="82" y="30" width="16" height="14" fill="#ef4444" rx="1"/>
    <line x1="90" y1="44" x2="90" y2="82" stroke="#ef4444" stroke-width="2"/>
    <line x1="90" y1="28" x2="90" y2="30" stroke="#ef4444" stroke-width="2"/>
    <text x="90" y="94" text-anchor="middle" fill="#64748b" font-size="7" font-family="Rajdhani">Hanging Man ❌</text>
    <!-- Arrow down for context -->
    <text x="18" y="22" fill="#94a3b8" font-size="8" font-family="Rajdhani">↓Downtrend</text>
    <text x="72" y="22" fill="#94a3b8" font-size="8" font-family="Rajdhani">↑Uptrend</text>
  </svg>`,

  engulfing: `<svg viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg" width="120" height="110">
    <!-- Bullish Engulfing -->
    <text x="30" y="10" text-anchor="middle" fill="#94a3b8" font-size="7" font-family="Rajdhani">Bullish</text>
    <rect x="24" y="30" width="12" height="20" fill="#ef4444" rx="1"/>
    <rect x="16" y="20" width="16" height="40" fill="none" stroke="#22c55e" stroke-width="1" stroke-dasharray="2" rx="1"/>
    <rect x="18" y="22" width="12" height="36" fill="#22c55e" rx="1"/>
    <text x="30" y="74" text-anchor="middle" fill="#22c55e" font-size="7" font-family="Rajdhani">Green covers Red</text>
    <!-- Bearish Engulfing -->
    <text x="90" y="10" text-anchor="middle" fill="#94a3b8" font-size="7" font-family="Rajdhani">Bearish</text>
    <rect x="84" y="30" width="12" height="20" fill="#22c55e" rx="1"/>
    <rect x="76" y="20" width="16" height="40" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="2" rx="1"/>
    <rect x="78" y="22" width="12" height="36" fill="#ef4444" rx="1"/>
    <text x="90" y="74" text-anchor="middle" fill="#ef4444" font-size="7" font-family="Rajdhani">Red covers Green</text>
  </svg>`
};

var MARKET_SCHOOL = {
  technical: {
    icon: '⚡', color: '#38bdf8',
    label: { hi: 'Technical Analysis', gu: 'Technical Analysis', en: 'Technical Analysis' },
    topics: {
      rsi: {
        label: 'RSI (Relative Strength Index)',
        hi: { what: 'RSI एक momentum indicator है जो 0–100 के बीच होता है। यह बताता है कि stock overbought है या oversold।', formula: 'RSI = 100 − [100 ÷ (1 + RS)] जहाँ RS = Average Gain ÷ Average Loss (14 दिन)', levels: '< 30 = Oversold (खरीदने का मौका) | 30–70 = Normal | > 70 = Overbought (बेचने का मौका)', tip: '💡 जब RSI 30 से नीचे हो और कोई strong fundamental stock हो, तो यह एक अच्छा entry point हो सकता है।', example: 'RELIANCE का RSI 28 है — इसका मतलब stock oversold zone में है, reversal आ सकता है।' },
        gu: { what: 'RSI એ 0–100 ની વચ્ચે રહેતો momentum indicator છે. Stock overbought છે કે oversold — આ બતાવે.', formula: 'RSI = 100 − [100 ÷ (1 + RS)] જ્યાં RS = Avg Gain ÷ Avg Loss (14 દિવસ)', levels: '< 30 = Oversold (ખરીદીની તક) | 30–70 = Normal | > 70 = Overbought (સાવધ)', tip: '💡 RSI 30 ની નીચે હોય ને stock fundamentally strong હોય, તો entry લઈ શકાય.', example: 'RELIANCE નો RSI 28 છે — Stock oversold zone મા છે, reversal શક્ય છે.' },
        en: { what: 'RSI is a momentum indicator ranging 0–100. It tells if a stock is overbought or oversold.', formula: 'RSI = 100 − [100 ÷ (1 + RS)] where RS = Avg Gain ÷ Avg Loss (14 days)', levels: '< 30 = Oversold (buying opportunity) | 30–70 = Normal | > 70 = Overbought (caution)', tip: '💡 When RSI < 30 and stock has strong fundamentals, it can be a great entry point.', example: 'RELIANCE RSI is 28 — stock is in oversold zone, reversal likely.' }
      },
      macd: {
        label: 'MACD',
        hi: { what: 'MACD (Moving Average Convergence Divergence) दो EMAs का फर्क है। Trend और momentum दोनों दिखाता है।', formula: 'MACD Line = EMA(12) − EMA(26) | Signal Line = EMA(9) of MACD', levels: 'MACD > Signal = Bullish | MACD < Signal = Bearish | Histogram = दोनों का फर्क', tip: '💡 जब MACD Line, Signal Line को ऊपर से cross करे — यह Bullish Crossover है। खरीदने का संकेत।', example: 'MACD: 2.5, Signal: 1.8 → MACD > Signal → Bullish trend' },
        gu: { what: 'MACD બે EMAs નો ફરક છે. Trend અને momentum બંને બતાવે છે.', formula: 'MACD Line = EMA(12) − EMA(26) | Signal Line = EMA(9) of MACD', levels: 'MACD > Signal = Bullish | MACD < Signal = Bearish', tip: '💡 MACD Line, Signal Line ને ઉપરથી cross કરે — Bullish Crossover — ખરીદીનો સંકેત.', example: 'MACD: 2.5, Signal: 1.8 → MACD > Signal → Bullish trend' },
        en: { what: 'MACD is the difference between two EMAs. Shows both trend and momentum.', formula: 'MACD Line = EMA(12) − EMA(26) | Signal Line = EMA(9) of MACD', levels: 'MACD > Signal = Bullish | MACD < Signal = Bearish | Histogram = difference', tip: '💡 When MACD crosses above Signal Line — Bullish Crossover — buy signal.', example: 'MACD: 2.5, Signal: 1.8 → MACD > Signal → Bullish trend' }
      },
      ma: {
        label: 'MA / DMA (Moving Average)',
        hi: { what: 'Moving Average (MA) एक निश्चित दिनों के closing prices का औसत है। Trend की दिशा समझने के लिए।', formula: 'MA20 = Last 20 days close का average | MA50 = Last 50 days | MA200 = Last 200 days', levels: 'Price > MA200 = Long-term Bullish | Price < MA200 = Bearish | Golden Cross (MA50>MA200) = Strong Bull', tip: '💡 MA20 short-term trend, MA50 medium-term, MA200 long-term trend बताता है। Price अगर तीनों से ऊपर हो — very bullish।', example: 'Price: ₹500, MA20: ₹480, MA50: ₹460 → Price above all MAs → Bullish' },
        gu: { what: 'Moving Average (MA) ચોક્કસ દિવસોના closing prices નો સરેરાશ છે. Trend ની દિશા સમજવા.', formula: 'MA20 = છેલ્લા 20 દિવસ | MA50 = 50 દિવસ | MA200 = 200 દિવસ', levels: 'Price > MA200 = Long-term Bullish | Golden Cross (MA50>MA200) = Strong Bull', tip: '💡 MA20 short-term, MA50 medium-term, MA200 long-term trend. Price ત્રણેથી ઉપર = very bullish.', example: 'Price: ₹500, MA20: ₹480 → Price above MA → Bullish' },
        en: { what: 'Moving Average (MA) is the average of closing prices over N days. Used to identify trend direction.', formula: 'MA20 = Last 20 days avg | MA50 = 50 days | MA200 = 200 days', levels: 'Price > MA200 = Long-term Bullish | Golden Cross (MA50>MA200) = Strong Bull', tip: '💡 MA20=short-term, MA50=medium, MA200=long-term. Price above all three = very bullish.', example: 'Price: ₹500, MA20: ₹480 → Price above MA → Bullish' }
      },
      bollinger: {
        label: 'Bollinger Bands (BB)',
        hi: { what: 'Bollinger Bands 3 lines हैं — Middle (MA20), Upper Band, Lower Band। Volatility measure करने के लिए।', formula: 'Middle = MA20 | Upper = MA20 + 2×SD | Lower = MA20 − 2×SD', levels: 'Price touches Upper Band = Overbought | Price touches Lower Band = Oversold | Bands squeeze = Big move आने वाला', tip: '💡 जब Bands बहुत narrow हों (squeeze) — बड़ा move आने वाला है। Direction MACD/RSI से confirm करो।', example: 'Price Lower Band को touch कर रहा है + RSI < 30 → Strong buy signal' },
        gu: { what: 'Bollinger Bands 3 lines છે — Middle (MA20), Upper, Lower. Volatility measure કરવા.', formula: 'Middle = MA20 | Upper = MA20 + 2×SD | Lower = MA20 − 2×SD', levels: 'Upper touch = Overbought | Lower touch = Oversold | Squeeze = મોટો move આવવાનો', tip: '💡 Bands ખૂબ narrow (squeeze) — મોટો move આવવાનો. Direction MACD/RSI થી confirm કરો.', example: 'Price Lower Band touch + RSI < 30 → Strong buy signal' },
        en: { what: 'Bollinger Bands are 3 lines — Middle (MA20), Upper Band, Lower Band. Used to measure volatility.', formula: 'Middle = MA20 | Upper = MA20 + 2×SD | Lower = MA20 − 2×SD', levels: 'Upper touch = Overbought | Lower touch = Oversold | Squeeze = Big move incoming', tip: '💡 When Bands squeeze (narrow) — a big move is coming. Confirm direction with MACD/RSI.', example: 'Price touches Lower Band + RSI < 30 → Strong buy signal' }
      },
      volume: {
        label: 'Volume',
        hi: { what: 'Volume = एक दिन में कितने shares खरीदे-बेचे गए। Price move की ताकत बताता है।', formula: 'Volume Ratio = Today Volume ÷ Average Volume (30 days)', levels: 'Volume > 2x avg + Price Up = Strong Bullish | Volume high + Price Down = Strong Selling | Low volume move = weak signal', tip: '💡 बिना volume के price move पर भरोसा मत करो। High volume = conviction।', example: 'Avg volume: 1L shares, Today: 3L shares + Price +3% → Strong Bullish breakout' },
        gu: { what: 'Volume = એક દિવસમાં કેટલા shares ખરીદ-વેચ થયા. Price move ની તાકાત બતાવે.', formula: 'Volume Ratio = Today Volume ÷ Average Volume (30 days)', levels: 'Volume > 2x avg + Price Up = Strong Bullish | Volume high + Price Down = Strong Selling', tip: '💡 Volume વગર price move પર ભરોસો ન કરો. High volume = conviction.', example: 'Avg volume: 1L, Today: 3L + Price +3% → Strong Bullish breakout' },
        en: { what: 'Volume = number of shares traded in a day. Shows the strength behind a price move.', formula: 'Volume Ratio = Today Volume ÷ Average Volume (30 days)', levels: 'Volume > 2x avg + Price Up = Strong Bullish | High volume + Price Down = Strong Selling', tip: '💡 Never trust a price move without volume. High volume = conviction.', example: 'Avg vol: 1L, Today: 3L + Price +3% → Strong Bullish breakout' }
      },
      supplydemand: {
        label: 'Supply & Demand',
        hi: { what: 'Supply = Sellers | Demand = Buyers। जब Demand > Supply → Price बढ़ता है। जब Supply > Demand → Price गिरता है।', formula: 'Support Zone = जहाँ Demand मजबूत हो (Price बार-बार bounce करे) | Resistance Zone = जहाँ Supply मजबूत हो', levels: 'Price Support तोड़े = Bearish breakout | Price Resistance तोड़े = Bullish breakout', tip: '💡 Support zone के पास Buy करो, Resistance zone के पास Sell करो। Volume से confirm करो।', example: '₹500 पर Stock 3 बार bounce हुआ → ₹500 = Strong Support Zone' },
        gu: { what: 'Supply = Sellers | Demand = Buyers. Demand > Supply → Price વધે. Supply > Demand → Price ઘટે.', formula: 'Support Zone = જ્યાં Demand strong (Price bar-bar bounce) | Resistance = જ્યાં Supply strong', levels: 'Price Support તોડે = Bearish | Price Resistance તોડે = Bullish breakout', tip: '💡 Support zone પાસે Buy, Resistance પાસે Sell. Volume થી confirm કરો.', example: '₹500 પર Stock 3 વાર bounce → ₹500 = Strong Support Zone' },
        en: { what: 'Supply = Sellers | Demand = Buyers. When Demand > Supply → Price rises. When Supply > Demand → Price falls.', formula: 'Support = where Demand is strong (price bounces repeatedly) | Resistance = where Supply is strong', levels: 'Price breaks Support = Bearish | Price breaks Resistance = Bullish breakout', tip: '💡 Buy near Support zones, Sell near Resistance. Always confirm with Volume.', example: 'Stock bounced 3 times at ₹500 → ₹500 = Strong Support Zone' }
      }
    }
  },
  fundamental: {
    icon: '📊', color: '#fb923c',
    label: { hi: 'Fundamental Analysis', gu: 'Fundamental Analysis', en: 'Fundamental Analysis' },
    topics: {
      pe: {
        label: 'P/E Ratio',
        hi: { what: 'P/E Ratio बताता है कि ₹1 कमाने के लिए आप कितने रुपये दे रहे हैं।', formula: 'P/E = Share Price ÷ EPS (Earnings Per Share)', levels: '< 15 = Cheap | 15–30 = Fair | > 30 = Expensive (लेकिन growth stocks के लिए high P/E normal)', tip: '💡 अकेले P/E से निर्णय मत लो। Industry average से compare करो।', example: 'Price ₹300, EPS ₹15 → P/E = 20 → Fair valuation' },
        gu: { what: 'P/E Ratio બતાવે છે ₹1 કમાવા માટે કેટલા રૂપિયા ચૂકવો છો.', formula: 'P/E = Share Price ÷ EPS', levels: '< 15 = સસ્તો | 15–30 = ઠીક | > 30 = મોંઘો', tip: '💡 P/E એકલું ન જુઓ. Industry average સાથે compare કરો.', example: 'Price ₹300, EPS ₹15 → P/E = 20 → Fair valuation' },
        en: { what: 'P/E Ratio tells how much you pay for ₹1 of earnings.', formula: 'P/E = Share Price ÷ EPS', levels: '< 15 = Cheap | 15–30 = Fair | > 30 = Expensive', tip: '💡 Never use P/E alone. Compare with industry average.', example: 'Price ₹300, EPS ₹15 → P/E = 20 → Fair valuation' }
      },
      eps: {
        label: 'EPS (Earnings Per Share)',
        hi: { what: 'EPS = प्रत्येक Share पर कंपनी ने कितना मुनाफा कमाया। जितना बढ़ता EPS, उतनी healthy company।', formula: 'EPS = Net Profit ÷ Total Shares Outstanding', levels: '> 0 = Profitable | बढ़ता EPS = Healthy growth | गिरता EPS = Warning sign', tip: '💡 पिछले 5 साल का EPS growth देखो। Consistent growth = quality company।', example: 'Net Profit: ₹1000 Cr, Shares: 100 Cr → EPS = ₹10' },
        gu: { what: 'EPS = દરેક Share પર કેટલો નફો. વધતો EPS = healthy company.', formula: 'EPS = Net Profit ÷ Total Shares', levels: '> 0 = Profitable | વધતો = Healthy | ઘટતો = Warning', tip: '💡 છેલ્લા 5 વર્ષનો EPS growth જુઓ. Consistent growth = quality.', example: 'Net Profit ₹1000 Cr, Shares 100 Cr → EPS = ₹10' },
        en: { what: 'EPS = profit earned per share. Growing EPS = healthy company.', formula: 'EPS = Net Profit ÷ Total Shares Outstanding', levels: '> 0 = Profitable | Growing = Healthy | Declining = Warning', tip: '💡 Check 5-year EPS growth trend. Consistent growth = quality company.', example: 'Net Profit ₹1000 Cr, Shares 100 Cr → EPS = ₹10' }
      },
      roe: {
        label: 'ROE (Return on Equity)',
        hi: { what: 'ROE = कंपनी अपने shareholders के पैसे पर कितना return दे रही है।', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', levels: '≥ 15% = Good | 8–15% = Average | < 8% = Weak', tip: '💡 ROE > 15% वाली companies Warren Buffett को पसंद हैं।', example: 'Net Profit ₹500 Cr, Equity ₹2500 Cr → ROE = 20% → Excellent' },
        gu: { what: 'ROE = Shareholders ના પૈસા પર company કેટલો return આપે છે.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', levels: '≥ 15% = સારું | 8–15% = Average | < 8% = નબળું', tip: '💡 ROE > 15% ની companies Warren Buffett ને ગમે છે.', example: 'Net Profit ₹500 Cr, Equity ₹2500 Cr → ROE = 20% → Excellent' },
        en: { what: 'ROE = how much return the company generates on shareholders\'s money.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', levels: '≥ 15% = Good | 8–15% = Average | < 8% = Weak', tip: '💡 Warren Buffett loves companies with ROE > 15%.', example: 'Net Profit ₹500 Cr, Equity ₹2500 Cr → ROE = 20% → Excellent' }
      },
      roce: {
        label: 'ROCE (Return on Capital Employed)',
        hi: { what: 'ROCE = कंपनी अपनी कुल deployed capital पर कितना return दे रही है। ROE से ज्यादा complete picture।', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', levels: '≥ 15% = Good | 8–15% = Average | < 8% = Weak', tip: '💡 ROCE > Cost of Capital होना जरूरी है। नहीं तो company value destroy कर रही है।', example: 'EBIT ₹300 Cr, Capital ₹1500 Cr → ROCE = 20%' },
        gu: { what: 'ROCE = company total capital પર કેટલો return. ROE કરતાં complete picture.', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', levels: '≥ 15% = સારું | 8–15% = Average | < 8% = નબળું', tip: '💡 ROCE > Cost of Capital હોવો જ જોઈએ.', example: 'EBIT ₹300 Cr, Capital ₹1500 Cr → ROCE = 20%' },
        en: { what: 'ROCE = return on total capital deployed. More complete picture than ROE.', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', levels: '≥ 15% = Good | 8–15% = Average | < 8% = Weak', tip: '💡 ROCE must be > Cost of Capital, otherwise company destroys value.', example: 'EBIT ₹300 Cr, Capital ₹1500 Cr → ROCE = 20%' }
      },
      debtequity: {
        label: 'Debt-to-Equity (D/E)',
        hi: { what: 'D/E Ratio = कंपनी ने अपनी Equity के मुकाबले कितना Debt लिया है।', formula: 'D/E = Total Debt ÷ Total Equity', levels: '< 0.5 = Low debt (safe) | 0.5–1 = Moderate | > 1 = High debt (risky)', tip: '💡 Capital intensive industries (infra, steel) में high D/E normal होता है। Sector-wise compare करो।', example: 'Debt ₹500 Cr, Equity ₹1000 Cr → D/E = 0.5 → Comfortable' },
        gu: { what: 'D/E = Company equity સામે કેટલું debt.', formula: 'D/E = Total Debt ÷ Total Equity', levels: '< 0.5 = Safe | 0.5–1 = Moderate | > 1 = High risk', tip: '💡 Capital intensive sectors (infra, steel) મા high D/E normal. Sector-wise compare.', example: 'Debt ₹500 Cr, Equity ₹1000 Cr → D/E = 0.5 → Comfortable' },
        en: { what: 'D/E Ratio = how much debt the company has vs its equity.', formula: 'D/E = Total Debt ÷ Total Equity', levels: '< 0.5 = Safe | 0.5–1 = Moderate | > 1 = High risk', tip: '💡 Capital intensive industries have higher D/E — always compare within sector.', example: 'Debt ₹500 Cr, Equity ₹1000 Cr → D/E = 0.5 → Comfortable' }
      }
    }
  },
  candles: {
    icon: '🕯️', color: '#a78bfa',
    label: { hi: 'Candlestick Patterns', gu: 'Candlestick Patterns', en: 'Candlestick Patterns' },
    topics: {
      basics: {
        label: 'Candlestick Basics', svg: 'basics',
        hi: { what: 'Candlestick chart ek din का OHLC (Open, High, Low, Close) data show करता है। Body + Wick।', formula: 'Green/White candle = Close > Open (Bullish) | Red/Black candle = Close < Open (Bearish)', levels: 'Long body = Strong move | Short body = Indecision | Long wick = Rejection of price level', tip: '💡 हर candle एक कहानी बताती है — Open कहाँ था, High-Low range क्या था, Close कहाँ था।', example: 'Open ₹100, High ₹110, Low ₹95, Close ₹108 → Green candle, bullish day' },
        gu: { what: 'Candlestick chart એક દિવસ ની OHLC data show કરે. Body + Wick.', formula: 'Green candle = Close > Open (Bullish) | Red candle = Close < Open (Bearish)', levels: 'Long body = Strong move | Short body = Indecision | Long wick = Price rejection', tip: '💡 દરેક candle એક story છે — Open, High, Low, Close ની.', example: 'Open ₹100, High ₹110, Low ₹95, Close ₹108 → Green candle' },
        en: { what: 'Candlestick shows OHLC (Open, High, Low, Close) for one day. Has Body + Wick.', formula: 'Green candle = Close > Open (Bullish) | Red candle = Close < Open (Bearish)', levels: 'Long body = Strong move | Short body = Indecision | Long wick = Price rejection', tip: '💡 Every candle tells a story — where price opened, went, and closed.', example: 'Open ₹100, High ₹110, Low ₹95, Close ₹108 → Green bullish candle' }
      },
      doji: {
        label: 'Doji', svg: 'doji',
        hi: { what: 'Doji तब बनता है जब Open और Close लगभग बराबर हों। Indecision — buyers और sellers बराबर ताकत में।', formula: 'Open ≈ Close | Long upper + lower wicks', levels: 'Uptrend में Doji = Reversal का signal | Downtrend में Doji = Possible reversal up', tip: '💡 Doji को अकेले मत देखो — अगले candle की confirmation का इंतज़ार करो।', example: 'Stock लगातार बढ़ रहा था, फिर Doji बना → अगला दिन Red candle → Trend reversal' },
        gu: { what: 'Doji ત્યારે બને જ્યારે Open ≈ Close. Indecision — buyers-sellers સરખી ताकत.', formula: 'Open ≈ Close | Long upper + lower wicks', levels: 'Uptrend mā Doji = Reversal signal | Downtrend mā Doji = Possible bounce', tip: '💡 Doji ની confirmation next candle thī levo.', example: 'Stock વધી રહ્યો, Doji બન્યો → next day Red → Trend reversal' },
        en: { what: 'Doji forms when Open ≈ Close. Shows indecision between buyers and sellers.', formula: 'Open ≈ Close | Long upper + lower wicks', levels: 'Doji in Uptrend = Reversal signal | Doji in Downtrend = Possible bounce', tip: '💡 Never trade Doji alone — wait for next candle confirmation.', example: 'Stock was rising, Doji formed → next day Red candle → Trend reversal' }
      },
      hammer: {
        label: 'Hammer & Hanging Man', svg: 'hammer',
        hi: { what: 'Hammer: Downtrend के बाद बनता है — छोटी body, लंबी lower wick। Bulls ने Bears को हराया। Bullish reversal।', formula: 'Lower wick ≥ 2× body | Little or no upper wick', levels: 'Downtrend में Hammer = Strong Bullish reversal | Uptrend में same shape = Hanging Man (Bearish)', tip: '💡 Hammer के बाद अगला दिन Green candle आए तो entry लो। Stop loss: Hammer का low।', example: 'Stock गिर रहा था → Hammer बना at ₹200 → अगला दिन ₹215 open → Entry!' },
        gu: { what: 'Hammer: Downtrend પછી — નાની body, લાંબી lower wick. Bulls એ Bears ને હરાવ્યા.', formula: 'Lower wick ≥ 2× body | Little/no upper wick', levels: 'Downtrend mā Hammer = Bullish reversal | Uptrend mā same = Hanging Man (Bearish)', tip: '💡 Hammer પછી next day Green candle → Entry. Stop loss: Hammer low.', example: 'Stock ઘટ્યો → Hammer ₹200 → next day ₹215 → Entry!' },
        en: { what: 'Hammer: forms after downtrend — small body, long lower wick. Bulls beat Bears. Bullish reversal.', formula: 'Lower wick ≥ 2× body | Little or no upper wick', levels: 'Hammer in Downtrend = Bullish reversal | Same in Uptrend = Hanging Man (Bearish)', tip: '💡 After Hammer, next green candle = entry. Stop loss at Hammer\'s low.', example: 'Stock fell → Hammer at ₹200 → next day opens ₹215 → Entry!' }
      },
      engulfing: {
        label: 'Engulfing Pattern', svg: 'engulfing',
        hi: { what: 'Bullish Engulfing: छोटी Red candle के बाद बड़ी Green candle जो उसे पूरा ढक ले। Strong reversal।', formula: 'Bullish: Green body > prev Red body | Bearish: Red body > prev Green body', levels: 'Support zone पर Bullish Engulfing = Very Strong Buy | Resistance पर Bearish Engulfing = Strong Sell', tip: '💡 Volume साथ में high हो तो signal और strong होता है।', example: 'Red candle: ₹100→₹95 | Green candle: ₹94→₹103 → Bullish Engulfing → Buy!' },
        gu: { what: 'Bullish Engulfing: નાની Red candle પછી મોટી Green candle જે તેને ઢઢ. Strong reversal.', formula: 'Bullish: Green body > prev Red | Bearish: Red body > prev Green', levels: 'Support zone + Engulfing = Very Strong Buy signal', tip: '💡 Volume high હોય તો signal stronger.', example: 'Red: ₹100→₹95 | Green: ₹94→₹103 → Bullish Engulfing → Buy!' },
        en: { what: 'Bullish Engulfing: large Green candle completely covers previous Red candle. Strong reversal.', formula: 'Bullish: Green body > prev Red body | Bearish: Red body > prev Green body', levels: 'Bullish Engulfing at support = Very Strong Buy signal', tip: '💡 High volume with engulfing = very strong signal.', example: 'Red: ₹100→₹95 | Green: ₹94→₹103 → Bullish Engulfing → Buy!' }
      }
    }
  },
  indices: {
    icon: '📈', color: '#34d399',
    label: { hi: 'Indices & Market', gu: 'Indices & Market', en: 'Indices & Market' },
    topics: {
      nifty: {
        label: 'Nifty 50 & Sensex',
        hi: { what: 'Nifty 50 = NSE के top 50 companies का index। Sensex = BSE के top 30। पूरे market की health बताते हैं।', formula: 'Index = Weighted average of market cap of constituent stocks', levels: 'Nifty > previous high = Market bullish | Nifty < 200 DMA = Market bearish zone', tip: '💡 Individual stocks देखने से पहले overall market (Nifty) का trend देखो।', example: 'Nifty 22000 से 23000 पर = 4.5% rally → Overall bullish market' },
        gu: { what: 'Nifty 50 = NSE ની top 50 companies. Sensex = BSE ની top 30. Market ની health.', formula: 'Index = Market cap weighted average', levels: 'Nifty > previous high = Bullish | Nifty < 200 DMA = Bearish zone', tip: '💡 Individual stocks પહેલા overall market (Nifty) trend જુઓ.', example: 'Nifty 22000 → 23000 = 4.5% rally → Bullish market' },
        en: { what: 'Nifty 50 = index of top 50 NSE companies. Sensex = top 30 BSE. Shows overall market health.', formula: 'Index = Weighted average of constituent market caps', levels: 'Nifty > prev high = Bullish | Nifty < 200 DMA = Bearish', tip: '💡 Always check Nifty trend before picking individual stocks.', example: 'Nifty 22000 → 23000 = 4.5% rally → Bullish market' }
      },
      sectors: {
        label: 'Sectors & Rotation',
        hi: { what: 'Stock market अलग-अलग sectors में बँटा है — IT, Banking, Pharma, Auto, FMCG आदि। हर cycle में अलग sector outperform करता है।', formula: 'Sector Rotation: Economy cycle के हिसाब से पैसा एक sector से दूसरे में जाता है।', levels: 'Recovery: Auto, Banking | Growth: IT, Capital Goods | Slowdown: FMCG, Pharma | Recession: Gold, Utilities', tip: '💡 जो sector अभी strong है उसमें जाओ — trend is your friend।', example: 'RBI rate cut → Banking sector rally → Bank Nifty outperform' },
        gu: { what: 'Market અલગ sectors મા — IT, Banking, Pharma, Auto, FMCG. દરેક cycle mā અલગ sector outperform.', formula: 'Sector Rotation: Economy cycle અનુસાર પૈસો sector change કરે.', levels: 'Recovery: Auto, Banking | Growth: IT | Slowdown: FMCG, Pharma', tip: '💡 Je sector strong che tyā jāv — trend is your friend.', example: 'RBI rate cut → Banking rally → Bank Nifty outperform' },
        en: { what: 'Market is divided into sectors — IT, Banking, Pharma, Auto, FMCG etc. Different sectors outperform in different economic cycles.', formula: 'Sector Rotation: money flows from one sector to another based on economy cycle.', levels: 'Recovery: Auto/Banking | Growth: IT | Slowdown: FMCG/Pharma | Recession: Gold', tip: '💡 Follow the strongest sector — trend is your friend.', example: 'RBI rate cut → Banking sector rallies → Bank Nifty outperforms' }
      },
      fii_dii: {
        label: 'FII & DII',
        hi: { what: 'FII (Foreign Institutional Investors) = विदेशी संस्थागत निवेशक। DII = घरेलू (MF, LIC)। इनकी buying-selling market move करती है।', formula: 'FII Buy > FII Sell = Net Inflow (bullish) | FII Sell > Buy = Net Outflow (bearish)', levels: 'FII strong buying = Market rally likely | FII selling + DII buying = Market may hold', tip: '💡 FII data daily NSE website पर आता है। DII counterbalance करते हैं।', example: 'FII ने ₹5000 Cr खरीदा → Market 1% ऊपर' },
        gu: { what: 'FII = Foreign Institutional Investors. DII = Domestic (MF, LIC). એમની buying-selling market move કરે.', formula: 'FII Buy > Sell = Net Inflow (bullish) | FII Sell > Buy = Outflow (bearish)', levels: 'FII buying = Rally likely | FII selling + DII buying = Market may hold', tip: '💡 FII data daily NSE website par malshe.', example: 'FII ₹5000 Cr kharidhyu → Market 1% upar' },
        en: { what: 'FII = Foreign Institutional Investors. DII = Domestic (MF, LIC). Their buying/selling moves the market.', formula: 'FII Buy > Sell = Net Inflow (bullish) | FII Sell > Buy = Outflow (bearish)', levels: 'Strong FII buying = Rally likely | FII selling + DII buying = Market may hold', tip: '💡 Check daily FII/DII data on NSE website.', example: 'FII bought ₹5000 Cr → Market up 1%' }
      }
    }
  }
};

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
  let html = `<div style="margin-bottom:12px;"><div style="font-size:11px;color:var(--text-muted, #64748b);font-weight:700;letter-spacing:1px;margin-bottom:8px;">SELECT CATEGORY</div>`;

  cats.forEach(catKey => {
    const cat = MARKET_SCHOOL[catKey];
    const count = Object.keys(cat.topics).length;
    html += `
    <div onclick="AppState._msCategory='${catKey}';AppState._msTopic=null;renderMarketSchool();"
      style="background:var(--bg-card, #0d1f35);border:1px solid var(--border, rgba(255,255,255,0.07));border-left:3px solid ${cat.color};border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:all 0.15s;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:26px;">${cat.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary, #e2e8f0);">${cat.label[lang]||cat.label.en}</div>
          <div style="font-size:10px;color:var(--text-muted, #64748b);margin-top:2px;">${count} topics</div>
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
    <button onclick="AppState._msCategory=null;AppState._msTopic=null;renderMarketSchool();" style="background:var(--border, rgba(255,255,255,0.06));border:1px solid var(--border, rgba(255,255,255,0.1));color:var(--text-sec, #94a3b8);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">← Back</button>
    <span style="font-size:14px;">${cat.icon}</span>
    <span style="font-size:13px;font-weight:700;color:${cat.color};">${cat.label[lang]||cat.label.en}</span>
  </div>`;

  Object.keys(cat.topics).forEach(topicKey => {
    const topic = cat.topics[topicKey];
    const content = topic[lang] || topic.en;
    html += `
    <div onclick="AppState._msTopic='${topicKey}';renderMarketSchool();"
      style="background:var(--bg-card, #0d1f35);border:1px solid var(--border, rgba(255,255,255,0.07));border-radius:10px;padding:12px 14px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
      <div><div style="font-size:12px;font-weight:700;color:var(--text-primary, #e2e8f0);">${topic.label}</div><div style="font-size:10px;color:var(--text-muted, #64748b);margin-top:2px;">${content.what.substring(0,60)}...</div></div>
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

  // 🔥 FIX: SVG Images ne load karvanu logic add karyu
  let svgHtml = '';
  if (topic.svg && typeof CANDLE_SVG !== 'undefined' && CANDLE_SVG[topic.svg]) {
    svgHtml = `<div style="text-align:center; margin-bottom: 12px;">${CANDLE_SVG[topic.svg]}</div>`;
  }

  const html = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
    <button onclick="AppState._msTopic=null;renderMarketSchool();" style="background:var(--border, rgba(255,255,255,0.06));border:1px solid var(--border, rgba(255,255,255,0.1));color:var(--text-sec, #94a3b8);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">← Back</button>
    <span style="font-size:13px;font-weight:700;color:${cat.color};">${topic.label}</span>
  </div>
  <div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.07));margin-bottom:10px;">
    <div style="background:var(--bg-header, rgba(255,255,255,0.03));padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">📖 WHAT IS IT?</span>
    </div>
    <div style="padding:12px 14px;font-size:13px;color:var(--text-primary, #cbd5e1);line-height:1.7;">
      ${svgHtml} ${L.what}
    </div>
  </div>
  <div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.07));margin-bottom:10px;"><div style="background:var(--bg-header, rgba(255,255,255,0.03));padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));"><span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">🔢 FORMULA</span></div><div style="padding:12px 14px;font-size:12px;color:var(--pos, #34d399);font-family:'JetBrains Mono',monospace;line-height:1.8;background:rgba(52,211,153,0.04);">${L.formula}</div></div>
  <div style="background:var(--bg-card, #0d1f35);border-radius:12px;overflow:hidden;border:1px solid var(--border, rgba(255,255,255,0.07));margin-bottom:10px;"><div style="background:var(--bg-header, rgba(255,255,255,0.03));padding:10px 14px;border-bottom:1px solid var(--border, rgba(255,255,255,0.05));"><span style="font-size:10px;font-weight:700;color:var(--text-muted, #64748b);letter-spacing:1px;">📊 LEVELS</span></div><div style="padding:12px 14px;font-size:12px;color:var(--warn, #f59e0b);line-height:1.8;">${L.levels}</div></div>`;
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
