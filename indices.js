// ========================================
// INDICES MODULE — RealTradePro v3.0
// ========================================

// ======================================
// RENDER HEADER STRIP
// Builds chips fresh — called once on load / manual refresh
// ======================================
function renderHeaderStrip() {
  const strip = document.getElementById('headerStrip');
  if (!strip) return;

  const indices = AppState.indicesList || [
    { sym: '^NSEI',    name: 'NIFTY 50'   },
    { sym: '^BSESN',   name: 'SENSEX'     },
    { sym: 'NIFTY1!',  name: 'GIFT NIFTY' },
    { sym: '^NSEBANK', name: 'BANK NIFTY' }
  ];

  strip.innerHTML = '';

  for (let idx of indices) {
    const d    = _resolveIndexData(idx.sym);
    const chip = document.createElement('div');
    chip.className    = 'header-index-chip';
    chip.dataset.sym  = idx.sym; // store sym for targeted updates
    chip.style.cssText = 'background:var(--bg-card,#0d1f35);border:1px solid var(--border,#1e2d4a);border-radius:12px;padding:6px 10px;margin-right:8px;min-width:85px;text-align:center;cursor:pointer;scroll-snap-align:start;flex-shrink:0;transition:background 0.3s,border 0.3s;';
    chip.onclick = function() { openDetail(idx.sym, true); };

    if (d && d.regularMarketPrice) {
      const { priceStr, changeStr, changeColor } = _calcChipValues(d);
      chip.innerHTML = _chipHTML(idx.name, priceStr, changeStr, changeColor);
    } else {
      chip.innerHTML = _chipEmptyHTML(idx.name);
    }

    strip.appendChild(chip);
  }
}

// ======================================
// UPDATE HEADER INDICES (Live Updates)
// Called by onSnapshot / updatePrices — updates chips in-place
// FIX: read oldPrice BEFORE writing new price
// ======================================
function updateHeaderIndices() {
  const strip = document.getElementById('headerStrip');
  if (!strip) return;

  const indices = AppState.indicesList || [
    { sym: '^NSEI',    name: 'NIFTY 50'   },
    { sym: '^BSESN',   name: 'SENSEX'     },
    { sym: 'NIFTY1!',  name: 'GIFT NIFTY' },
    { sym: '^NSEBANK', name: 'BANK NIFTY' }
  ];

  // Rebuild strip if chips count doesn't match (e.g. user added/removed index)
  const chips = strip.querySelectorAll('.header-index-chip');
  if (chips.length !== indices.length) {
    renderHeaderStrip();
    return;
  }

  chips.forEach((chip, i) => {
    if (i >= indices.length) return;
    const idx = indices[i];
    const d   = _resolveIndexData(idx.sym);
    if (!d || !d.regularMarketPrice) return;

    const priceDiv  = chip.querySelector('div:nth-child(2)');
    const changeDiv = chip.querySelector('div:nth-child(3)');

    const { price, priceStr, changeStr, changeColor } = _calcChipValues(d);

    // ✅ FIX: read oldPrice BEFORE overwriting innerText
    const oldPrice = priceDiv ? (parseFloat(priceDiv.innerText.replace(/[,]/g, '')) || 0) : 0;

    if (priceDiv)  priceDiv.innerText  = priceStr;
    if (changeDiv) {
      changeDiv.innerText    = changeStr;
      changeDiv.style.color  = changeColor;
    }

    // Flash on price change
// Flash on price change
if (priceDiv && oldPrice > 0 && price !== oldPrice) {
  // મસ્ત વેરિએબલનો ઉપયોગ
  const flashColor = price > oldPrice ? 'var(--pos)' : 'var(--neg)';
  
  priceDiv.style.transition = "color 0.2s ease"; // સ્મૂથ કલર ચેન્જ માટે
  priceDiv.style.color = flashColor;

  setTimeout(() => { 
  priceDiv.style.color = 'var(--text-primary)'; 
  }, 1200);}
  });
}

// ======================================
// GIFT NIFTY — DIRECT GAS CALL (TRADINGVIEW)
// Interval: 60 Seconds | No Firestore
// ======================================
let _giftNiftyInterval = null;

async function updateGiftNifty() {
  const now = Date.now();
  
  // 60s cache check
  if (AppState._giftNiftyCache && (now - AppState._giftNiftyCacheTime) < 60000) {
    _applyGiftNiftyToChip(AppState._giftNiftyCache);
    return;
  }

  // Direct GAS fetch for TradingView data
  try {
    const apiUrl = getActiveGASUrl();
    const r = await fetchWithTimeout(_appendToken(apiUrl + '?type=giftNifty'), 6000);
    const data = await r.json();
    
    if (data && data.price && data.price > 0) {
      const price  = parseFloat(data.price);
      const prev   = parseFloat(data.prev_close || data.prevClose || price);
      const change = price - prev;
      const pct    = prev ? (change / prev * 100) : 0;

      const cached = {
        price:     price.toFixed(2),
        change:    change.toFixed(2),
        changePct: pct.toFixed(2)
      };

      AppState._giftNiftyCache     = cached;
      AppState._giftNiftyCacheTime = now;

      _pushGiftNiftyToCache({ 
        price: price, 
        prev_close: prev, 
        change_abs: change, 
        change_pct: pct 
      });
      
      _applyGiftNiftyToChip(cached);
    }
  } catch(e) {
    console.warn('[updateGiftNifty] GAS TradingView fetch failed:', e);
  }
}

function _pushGiftNiftyToCache(data) {
  const price     = parseFloat(data.price) || 0;
  const prev      = parseFloat(data.prev_close || price);
  const changeAbs = parseFloat(data.change_abs || (price - prev));
  const changePct = parseFloat(data.change_pct || (prev > 0 ? ((price - prev) / prev * 100) : 0));

  AppState.cache['NIFTY1!'] = {
    data: {
      regularMarketPrice:         price,
      chartPreviousClose:         prev,
      regularMarketChange:        parseFloat(changeAbs.toFixed(2)),
      regularMarketChangePercent: parseFloat(changePct.toFixed(2)),
      regularMarketDayHigh:       price,
      regularMarketDayLow:        price,
      _source: 'GAS_TradingView'
    },
    time: Date.now()
  };
}

function _applyGiftNiftyToChip(cached) {
  const strip = document.getElementById('headerStrip');
  if (!strip) return;

  const chip = strip.querySelector('.header-index-chip[data-sym="NIFTY1!"]');
  if (!chip) return;

  const priceDiv  = chip.querySelector('div:nth-child(2)');
  const changeDiv = chip.querySelector('div:nth-child(3)');

  const price     = parseFloat(cached.price);
  const change    = parseFloat(cached.change);
  const changePct = parseFloat(cached.changePct);
  const isUp      = change >= 0;
  const color     = isUp ? 'var(--pos,var(--pos))' : 'var(--neg)';
  const sign      = isUp ? '+' : '';

  if (priceDiv) {
    const oldPrice = parseFloat(priceDiv.innerText.replace(/,/g, '')) || 0;
    priceDiv.innerText = price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    // Flash effect
    if (oldPrice > 0 && price !== oldPrice) {
      priceDiv.style.color = price > oldPrice ? 'var(--pos,var(--pos))' : 'var(--neg)';
      setTimeout(() => { priceDiv.style.color = 'var(--text-primary,#e2e8f0)'; }, 1200);
    }
  }
  if (changeDiv) {
    changeDiv.innerText   = sign + change.toFixed(2) + ' (' + sign + changePct.toFixed(2) + '%)';
    changeDiv.style.color = color;
  }
}

function startGiftNiftyUpdates() {
  if (_giftNiftyInterval) clearInterval(_giftNiftyInterval);
  updateGiftNifty();
  // Set to 60 seconds as requested
  _giftNiftyInterval = setInterval(updateGiftNifty, 60000);
}


// ======================================
// RENDER INDICES TAB (Full Page)
// ======================================
async function renderIndices() {
  const el = document.getElementById('indices');
  if (!el) return;
  el.innerHTML = '<div style="padding:4px;"></div>';
  renderTerminal();
}

// ======================================
// TERMINAL STATE
// ======================================
let _terminalSort = { col: 'pct', dir: 'desc' };
let _terminalLoading = false;

// Column definitions — exact sequence as requested
const _T_COLS = [
  { id:'sym',   label:'SYMBOL',       w:'110px', align:'left'   },
  { id:'ltp',   label:'LTP',          w:'72px',  align:'center' },
  { id:'abs',   label:'PRICE CHG',    w:'72px',  align:'center' },
  { id:'pct',   label:'CHG%',         w:'58px',  align:'center' },
  { id:'rsi',   label:'RSI',          w:'40px',  align:'center' },
  { id:'macd',  label:'MACD',         w:'50px',  align:'center' },
  { id:'vol',   label:'VOLUME',       w:'55px',  align:'center' },
  { id:'sr',    label:'S&R',          w:'80px',  align:'center' },
  { id:'ub',    label:'UB',           w:'60px',  align:'center' },
  { id:'lb',    label:'LB',           w:'60px',  align:'center' },
  { id:'sig',   label:'SIGNAL',       w:'52px',  align:'center' },
];

// ======================================
// RENDER TERMINAL
// ======================================
async function renderTerminal() {
  const el = document.getElementById('indices');
  if (!el) return;

  // Always rebuild container for fresh theme
  const existing = document.getElementById('terminalContainer');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'terminalContainer';
  wrap.style.cssText = 'margin-top:0;';

  const colWidths = _T_COLS.map(c => c.w).join(' ');

  wrap.innerHTML = `
<style>
#terminalContainer { font-family:'Rajdhani',sans-serif; }
#terminalContainer .t-hdr {
  position:sticky;top:0;z-index:10;
  background:var(--bg-header,#0d1425);
  border-bottom:1px solid var(--border,#1e2d4a);
  padding:8px 10px 0 10px;
}
#terminalContainer .t-toprow {
  display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;
}
#terminalContainer .t-title {
  font-size:11px;font-weight:800;color:var(--accent,#38bdf8);letter-spacing:1px;
}
#terminalContainer .t-count {
  font-size:9px;color:var(--text-label,#4b6280);
  background:var(--bg-card,#111827);border:1px solid var(--border,#1e2d4a);
  border-radius:8px;padding:1px 8px;margin-left:6px;
}
#terminalContainer .t-rfbtn {
  background:var(--accent-bg,#1e3a5f);color:var(--accent,#38bdf8);
  border:1px solid var(--accent-border,#2d5a8e);
  padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;
}
#terminalContainer .t-cols {
  display:grid;grid-template-columns:${colWidths};
  gap:2px;padding:5px 6px;border-bottom:1px solid var(--border,#1e2d4a);
}
#terminalContainer .t-col-hdr {
  font-size:8px;font-weight:700;color:var(--text-label,#4b6280);
  letter-spacing:0.5px;cursor:pointer;padding:2px 3px;border-radius:3px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 0.15s;
}
#terminalContainer .t-col-hdr:hover { color:var(--accent,#38bdf8); }
#terminalContainer .t-col-hdr.active { color:var(--accent,#38bdf8); }
#terminalContainer .t-col-hdr.left { text-align:left; }
#terminalContainer .t-col-hdr.center { text-align:center; }
#terminalContainer .t-row {
  display:grid;grid-template-columns:${colWidths};
  gap:2px;align-items:center;padding:6px 6px;
  border-bottom:1px solid var(--border,#0f1829);
  cursor:pointer;transition:background 0.1s;
}
#terminalContainer .t-row:hover { background:var(--bg-card2,#0d1a2e) !important; }
#terminalContainer .t-sym {
  font-size:11px;font-weight:800;color:var(--accent,#38bdf8);letter-spacing:0.3px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
#terminalContainer .t-sec {
  font-size:8px;color:var(--text-label,#4b6280);margin-top:1px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
#terminalContainer .t-cell {
  text-align:center;font-size:10px;color:var(--text-primary,#e2e8f0);
  font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;
}
#terminalContainer .t-cell.left { text-align:left; }
#terminalContainer .t-muted { color:var(--text-label,#4b6280); }
#terminalContainer .t-pos { color:var(--pos,#38bdf8); font-weight:700; }
#terminalContainer .t-neg { color:#ef4444; font-weight:700; }
#terminalContainer .badge {
  display:inline-block;font-size:8px;padding:2px 6px;border-radius:4px;font-weight:700;
}
#terminalContainer .badge-buy  { background:var(--accent-bg,#1e3a5f);color:var(--accent,#38bdf8); }
#terminalContainer .badge-sell { background:rgba(239,68,68,0.12);color:#ef4444; }
#terminalContainer .badge-hold { background:rgba(245,158,11,0.12);color:#f59e0b; }
#terminalContainer .badge-watch{ background:rgba(167,139,250,0.12);color:#a78bfa; }
#terminalContainer .rsi-ob { color:#ef4444;font-weight:700; }
#terminalContainer .rsi-os { color:var(--accent,#38bdf8);font-weight:700; }
#terminalContainer .rsi-ok { color:var(--text-sec,#94a3b8);font-weight:700; }
#terminalContainer .bb-upper{ color:var(--accent,#38bdf8);font-weight:600; }
#terminalContainer .bb-lower{ color:#ef4444;font-weight:600; }
#terminalContainer .bb-mid  { color:#f59e0b;font-weight:600; }
#terminalContainer .t-sumbar {
  display:grid;grid-template-columns:repeat(4,1fr);gap:6px;
  padding:8px 10px;background:var(--bg-header,#0d1425);
  border-top:1px solid var(--border,#1e2d4a);
}
#terminalContainer .t-sum-card {
  background:var(--bg-card,#111827);border:1px solid var(--border,#1e2d4a);
  border-radius:8px;padding:5px 8px;text-align:center;
}
#terminalContainer .t-sum-lbl { font-size:8px;color:var(--text-label,#4b6280);text-transform:uppercase;letter-spacing:0.5px; }
#terminalContainer .t-sum-val { font-size:14px;font-weight:800;margin-top:1px; }
</style>

<div class="t-hdr">
  <div class="t-toprow">
    <div style="display:flex;align-items:center;">
      <span class="t-title">⬡ TERMINAL</span>
      <span class="t-count" id="terminalCount"></span>
    </div>
    <button class="t-rfbtn" onclick="refreshTerminal()" id="terminalRefreshBtn">↻ Refresh</button>
  </div>
  <div class="t-cols" id="terminalColHdrs"></div>
</div>

<div id="terminalRows" style="padding-bottom:8px;"></div>

<div class="t-sumbar">
  <div class="t-sum-card">
    <div class="t-sum-lbl">Bullish</div>
    <div class="t-sum-val" style="color:var(--accent,#38bdf8);" id="tSumBull">0</div>
  </div>
  <div class="t-sum-card">
    <div class="t-sum-lbl">Bearish</div>
    <div class="t-sum-val t-neg" id="tSumBear">0</div>
  </div>
  <div class="t-sum-card">
    <div class="t-sum-lbl">Neutral</div>
    <div class="t-sum-val" style="color:#f59e0b;" id="tSumNeu">0</div>
  </div>
  <div class="t-sum-card">
    <div class="t-sum-lbl">Avg RSI</div>
    <div class="t-sum-val" style="color:#a78bfa;" id="tSumRsi">--</div>
  </div>
</div>
  `;

  el.appendChild(wrap);

  // Render column headers
  _renderTerminalColHdrs();
  _renderTerminalRows();
}

// ======================================
// RENDER COLUMN HEADERS
// ======================================
function _renderTerminalColHdrs() {
  const hdrEl = document.getElementById('terminalColHdrs');
  if (!hdrEl) return;
  hdrEl.innerHTML = _T_COLS.map(c => `
    <span id="tch-${c.id}" onclick="terminalSort('${c.id}')"
      class="t-col-hdr ${c.align} ${_terminalSort.col === c.id ? 'active' : ''}">
      ${c.label}${_terminalSort.col === c.id ? (_terminalSort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
    </span>`).join('');
}

// ======================================
// RENDER TERMINAL ROWS
// ======================================
function _renderTerminalRows() {
  const rowsEl  = document.getElementById('terminalRows');
  const countEl = document.getElementById('terminalCount');
  if (!rowsEl) return;

  const wl = AppState.watchlists[AppState.currentWL]?.stocks || AppState.wl || [];

  const rows = wl.map(s => {
    const d = AppState.cache[s]?.data;
    if (!d || !d.regularMarketPrice) return null;

    const price   = d.regularMarketPrice || 0;
    const prev    = d.chartPreviousClose || price;
    const absChg  = price - prev;
    const pct     = prev > 0 ? ((absChg / prev) * 100) : 0;
    const vol     = d.regularMarketVolume || 0;
    const avgVol  = d.averageDailyVolume3Month || 0;
    const volSpike= avgVol > 0 && vol >= avgVol * 1.5;

    let rsi = null, macd = null, bb = null;
    const hist = AppState._histCache?.[s] || window._histCache?.[s];
    if (hist && hist.close && hist.close.length >= 30) {
      rsi  = calcRSI(hist.close);
      macd = calcMACD(hist.close);
      bb   = calcBollinger(hist.close);
    }

    // Signal logic
    let sig = 'WATCH';
    if (bb && rsi !== null && macd) {
      const pctB = bb.pctB || 50;
      if (rsi < 40 && pctB < 25 && macd.histogram < 0) sig = 'SELL';
      else if (rsi > 60 && pctB > 70 && macd.histogram > 0) sig = 'BUY';
      else if (macd.histogram > 0 && rsi < 70) sig = 'HOLD';
    }

    // S&R from BB
    const sr = bb ? `${bb.lower}/${bb.upper}` : '--';

    return { s, price, prev, absChg, pct, vol, avgVol, volSpike, rsi, macd, bb, sig, sr };
  }).filter(Boolean);

  // Sort
  const { col, dir } = _terminalSort;
  rows.sort((a, b) => {
    let av, bv;
    if (col === 'sym')  { return dir === 'asc' ? a.s.localeCompare(b.s) : b.s.localeCompare(a.s); }
    if (col === 'ltp')  { av = a.price;  bv = b.price; }
    else if (col === 'abs')  { av = a.absChg; bv = b.absChg; }
    else if (col === 'pct')  { av = a.pct;    bv = b.pct; }
    else if (col === 'rsi')  { av = a.rsi ?? -1; bv = b.rsi ?? -1; }
    else if (col === 'macd') { av = a.macd?.histogram ?? 0; bv = b.macd?.histogram ?? 0; }
    else if (col === 'vol')  { av = a.vol;   bv = b.vol; }
    else if (col === 'ub')   { av = a.bb?.upper ?? 0; bv = b.bb?.upper ?? 0; }
    else if (col === 'lb')   { av = a.bb?.lower ?? 0; bv = b.bb?.lower ?? 0; }
    else { av = 0; bv = 0; }
    return dir === 'asc' ? av - bv : bv - av;
  });

  if (countEl) countEl.textContent = rows.length + ' stocks';

  // Summary counts
  let bull = 0, bear = 0, neu = 0, rsiSum = 0, rsiCount = 0;

  if (rows.length === 0) {
    rowsEl.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-label,#4b6280);font-size:12px;">
      No data — go to Watchlist and refresh first
    </div>`;
    return;
  }

  rowsEl.innerHTML = rows.map((r, i) => {
    const isUp      = r.pct >= 0;
    const chgCls    = isUp ? 't-pos' : 't-neg';
    const chgPfx    = isUp ? '+' : '';
    const absPfx    = isUp ? '▲' : '▼';
    const bg        = i % 2 === 0 ? 'var(--bg-app,#0a0e1a)' : 'var(--bg-card,#111827)';

    // Price + change
    const ltpStr  = '₹' + (r.price >= 1000 ? r.price.toFixed(0) : r.price.toFixed(2));
    const absStr  = absPfx + ' ₹' + Math.abs(r.absChg).toFixed(2);
    const pctStr  = chgPfx + r.pct.toFixed(2) + '%';

    // RSI
    let rsiStr = '--', rsiCls = 't-muted';
    if (r.rsi !== null) {
      rsiStr = r.rsi.toFixed(0);
      rsiCls = r.rsi >= 70 ? 'rsi-ob' : r.rsi <= 30 ? 'rsi-os' : 'rsi-ok';
      rsiSum += r.rsi; rsiCount++;
    }

    // MACD
    let macdStr = '--', macdCls = 't-muted';
    if (r.macd) {
      if (r.macd.bullishCross)      { macdStr = '▲ Bull'; macdCls = 't-pos'; }
      else if (r.macd.bearishCross) { macdStr = '▼ Bear'; macdCls = 't-neg'; }
      else if (r.macd.histogram > 0){ macdStr = '↑ Bull'; macdCls = 't-pos'; }
      else                          { macdStr = '↓ Bear'; macdCls = 't-neg'; }
    }

    // Volume
    const volStr = r.vol >= 1e7 ? (r.vol/1e7).toFixed(1)+'Cr'
                 : r.vol >= 1e5 ? (r.vol/1e5).toFixed(1)+'L'
                 : r.vol > 0    ? (r.vol/1000).toFixed(0)+'K' : '--';
    const volStyle = r.volSpike ? 'color:#a78bfa;font-weight:700;' : '';

    // BB
    const ubStr = r.bb ? '₹'+r.bb.upper : '--';
    const lbStr = r.bb ? '₹'+r.bb.lower : '--';

    // Signal badge
    const sigMap = { BUY:'badge-buy', SELL:'badge-sell', HOLD:'badge-hold', WATCH:'badge-watch' };
    if (r.sig === 'BUY') bull++;
    else if (r.sig === 'SELL') bear++;
    else neu++;

    return `<div class="t-row" style="background:${bg};" onclick="openDetail('${r.s}',false)">
      <div class="t-cell left">
        <div class="t-sym">${r.s}${r.volSpike ? ' <span style="font-size:7px;background:rgba(167,139,250,0.2);color:#a78bfa;padding:1px 3px;border-radius:3px;">VOL</span>' : ''}</div>
      </div>
      <div class="t-cell"><span style="color:var(--text-primary,#e2e8f0);font-weight:600;">${ltpStr}</span></div>
      <div class="t-cell"><span class="${chgCls}">${absStr}</span></div>
      <div class="t-cell"><span class="${chgCls}">${pctStr}</span></div>
      <div class="t-cell"><span class="${rsiCls}">${rsiStr}</span></div>
      <div class="t-cell"><span class="${macdCls}" style="font-size:9px;">${macdStr}</span></div>
      <div class="t-cell"><span style="${volStyle}color:var(--text-sec,#94a3b8);">${volStr}</span></div>
      <div class="t-cell" style="font-size:9px;color:var(--text-label,#4b6280);">${r.sr}</div>
      <div class="t-cell" style="color:var(--accent,#38bdf8);font-weight:600;">${ubStr}</div>
      <div class="t-cell" style="color:#ef4444;font-weight:600;">${lbStr}</div>
      <div class="t-cell"><span class="badge ${sigMap[r.sig]}">${r.sig}</span></div>
    </div>`;
  }).join('');

  // Update summary bar
  const bull$ = document.getElementById('tSumBull');
  const bear$ = document.getElementById('tSumBear');
  const neu$  = document.getElementById('tSumNeu');
  const rsi$  = document.getElementById('tSumRsi');
  if (bull$) bull$.textContent = bull;
  if (bear$) bear$.textContent = bear;
  if (neu$)  neu$.textContent  = neu;
  if (rsi$)  rsi$.textContent  = rsiCount ? Math.round(rsiSum/rsiCount) : '--';
}

// ======================================
// SORT TERMINAL
// ======================================
function terminalSort(col) {
  if (_terminalSort.col === col) {
    _terminalSort.dir = _terminalSort.dir === 'desc' ? 'asc' : 'desc';
  } else {
    _terminalSort.col = col;
    _terminalSort.dir = 'desc';
  }
  _renderTerminalColHdrs();
  _renderTerminalRows();
}
 
// ======================================
// REFRESH TERMINAL — fetch histcache from Firebase
// ======================================
async function refreshTerminal() {
  const btn = document.getElementById('terminalRefreshBtn');
  const rowsEl = document.getElementById('terminalRows');
  if (btn) { btn.textContent = '...'; btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
  if (rowsEl) rowsEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-label,#4b6280);font-size:12px;">Loading technical data...</div>`;
 
try {
    const db = firebase.firestore();
    const histSnap = await db.collection('histcache').get();
    if (!window._histCache) window._histCache = {};
    for (const doc of histSnap.docs) {
      const sym = doc.id;
      const data = doc.data();
      let closes = [], volumes = [];
      try {
        const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
        closes = parsed.close || parsed.closes || parsed || [];
        volumes = parsed.volume || parsed.volumes || [];
      } catch(e) { closes = []; }
      if (closes.length >= 20) {
        window._histCache[sym] = { close: closes, volume: volumes };
      }
    }
    console.log('[Terminal] histcache loaded:', Object.keys(window._histCache).length, 'stocks');

    // Also refresh live prices
    if (typeof batchFetchStocks === 'function') {
      const wl = AppState.watchlists[AppState.currentWL]?.stocks || AppState.wl || [];
      await batchFetchStocks(wl);
    }
  } catch(e) {
    console.warn('[Terminal] refresh error:', e);
  }
 
  if (btn) { btn.textContent = '↻ Refresh'; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
  _renderTerminalRows();
}
 
// ======================================
// PATCH TERMINAL PRICES (called by live listener)
// ======================================
function _patchTerminalPrices() {
  if (AppState._curTab !== 'indices') return;
  if (!document.getElementById('terminalRows')) return;
  _renderTerminalRows();
}

// ======================================
// PRIVATE HELPERS
// ======================================

// Resolve index data — for GIFT NIFTY tries both 'NIFTY1!' and '__GIFT__' keys
function _resolveIndexData(sym) {
  if (sym === 'NIFTY1!') {
    return AppState.cache['NIFTY1!']?.data || AppState.cache['__GIFT__']?.data || null;
  }
  return AppState.cache[sym]?.data || null;
}

function _calcChipValues(d) {
  const price     = d.regularMarketPrice || 0;
  const prev      = d.chartPreviousClose || d.regularMarketPreviousClose || price;
  const change    = price - prev;
  const pct       = prev ? (change / prev * 100) : 0;
  const isUp      = change >= 0;
  const sign      = isUp ? '+' : '';
  const color     = isUp ? 'var(--pos,var(--pos))' : '#var(--neg)';
  return {
    price,
    priceStr:    price.toFixed(2),
    changeStr:   sign + change.toFixed(2) + ' (' + sign + pct.toFixed(2) + '%)',
    changeColor: color
  };
}

function _chipHTML(name, priceStr, changeStr, changeColor) {
  return `
    <div style="font-size:10px;font-weight:700;color:var(--text-sec,#94a3b8);margin-bottom:2px;">${name}</div>
    <div style="font-size:14px;font-weight:700;color:var(--text-primary,#e2e8f0);margin-bottom:2px;">${priceStr}</div>
    <div style="font-size:10px;font-weight:700;color:${changeColor};">${changeStr}</div>
  `;
}

function _chipEmptyHTML(name) {
  return `
    <div style="font-size:10px;font-weight:700;color:var(--text-sec,#94a3b8);margin-bottom:2px;">${name}</div>
    <div style="font-size:12px;font-weight:700;color:var(--text-label,#4b6280);">---</div>
    <div style="font-size:10px;color:var(--text-label,#4b6280);">--</div>
  `;
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.renderHeaderStrip    = renderHeaderStrip;
window.updateHeaderIndices  = updateHeaderIndices;
window.renderIndices        = renderIndices;
window.renderTerminal         = renderTerminal;
window.terminalSort           = terminalSort;
window.refreshTerminal        = refreshTerminal;
window._renderTerminalRows    = _renderTerminalRows;
window._renderTerminalColHdrs = _renderTerminalColHdrs;
window._patchTerminalPrices   = _patchTerminalPrices;
window.updateGiftNifty      = updateGiftNifty;
window.startGiftNiftyUpdates = startGiftNiftyUpdates;

console.log('✅ indices.js loaded successfully (Elite Proxy Fetch Active)');
