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
    chip.style.cssText = 'background:#0d1f35;border-radius:12px;padding:6px 10px;margin-right:8px;min-width:85px;text-align:center;cursor:pointer;scroll-snap-align:start;flex-shrink:0;';
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
    if (priceDiv && oldPrice > 0 && price !== oldPrice) {
      const flashColor = price > oldPrice ? '#22c55e' : '#ef4444';
      priceDiv.style.color = flashColor;
      setTimeout(() => { priceDiv.style.color = '#e2e8f0'; }, 600);
    }
  });
}

// ======================================
// GIFT NIFTY — update chip in headerStrip directly
// FIX: no separate #giftNifty element needed
// ======================================
let _giftNiftyInterval = null;

async function updateGiftNifty() {
  const now = Date.now();
  if (AppState._giftNiftyCache && (now - AppState._giftNiftyCacheTime) < 30000) {
    _applyGiftNiftyToChip(AppState._giftNiftyCache);
    return;
  }
  try {
    const apiUrl = getActiveGASUrl();
    const r      = await fetch(apiUrl + '?s=NIFTY1%21&t=' + now);
    const data   = await r.json();
    if (data && data.price && data.price > 0) {
      const price  = data.price;
      const prev   = data.prevClose || price;
      const change = price - prev;
      const pct    = prev ? (change / prev * 100) : 0;
      const cached = {
        price:     price.toFixed(2),
        change:    change.toFixed(2),
        changePct: pct.toFixed(2)
      };
      AppState._giftNiftyCache     = cached;
      AppState._giftNiftyCacheTime = now;
      _pushGiftNiftyToCache({ price, prev_close: prev, change_abs: change, change_pct: pct });
      _applyGiftNiftyToChip(cached);
    }
  } catch(e) {
    console.warn('[updateGiftNifty] GAS failed:', e);
  }
}

// Push Gift Nifty data into AppState.cache['NIFTY1!'] so header chip renders it
function _pushGiftNiftyToCache(data) {
  const price    = parseFloat(data.price)     || 0;
  const prev     = parseFloat(data.prev_close || data.prevClose || price);
  const changeAbs = parseFloat(data.change_abs || data.change || (price - prev));
  const changePct = parseFloat(data.change_pct || (prev > 0 ? ((price - prev) / prev * 100) : 0));

  if (!price) return;

  AppState.cache['NIFTY1!'] = {
    data: {
      regularMarketPrice:         price,
      chartPreviousClose:         prev,
      regularMarketChange:        parseFloat(changeAbs.toFixed(2)),
      regularMarketChangePercent: parseFloat(changePct.toFixed(2)),
      regularMarketDayHigh:       parseFloat(data.high || price),
      regularMarketDayLow:        parseFloat(data.low  || price),
      fiftyTwoWeekHigh:           parseFloat(data.high52 || price),
      fiftyTwoWeekLow:            parseFloat(data.low52  || price),
      _source: 'gift_nifty_doc'
    },
    time: Date.now()
  };
}

// Write Gift Nifty values directly into its headerStrip chip
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
  const sign      = isUp ? '+' : '';
  const color     = isUp ? '#22c55e' : '#ef4444';

  // Flash
  if (priceDiv) {
    const oldPrice = parseFloat(priceDiv.innerText.replace(/,/g, '')) || 0;
    priceDiv.innerText = price.toFixed(2);
    if (oldPrice > 0 && price !== oldPrice) {
      priceDiv.style.color = price > oldPrice ? '#22c55e' : '#ef4444';
      setTimeout(() => { priceDiv.style.color = '#e2e8f0'; }, 600);
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
  _giftNiftyInterval = setInterval(updateGiftNifty, 30000);
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
 
// ======================================
// RENDER TERMINAL
// ======================================
async function renderTerminal() {
  const el = document.getElementById('indices');
  if (!el) return;
 
  // Inject terminal container if not present
  if (!document.getElementById('terminalContainer')) {
    const wrap = document.createElement('div');
    wrap.id = 'terminalContainer';
    wrap.style.cssText = 'margin-top:0px;';
    wrap.innerHTML = `
<!-- Header bar -->
<div style="position:sticky;top:0;z-index:10;background:#060e1a;padding:8px 0 6px 0;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:10px;font-weight:800;color:#38bdf8;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">⬡ TERMINAL</span>
      <span id="terminalCount" style="font-size:9px;color:#4b6280;font-family:'Rajdhani',sans-serif;"></span>
    </div>
    <button onclick="refreshTerminal()" id="terminalRefreshBtn"
      style="background:#0f2a40;color:#38bdf8;border:1px solid #1e3a5f;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">
      ↻ Refresh
    </button>
  </div>
  <!-- Column headers -->
  <div style="display:grid;grid-template-columns:80px 1fr 72px 56px 44px 52px;gap:4px;padding:4px 8px;border-bottom:1px solid #1e2d3d;">
    <span onclick="terminalSort('sym')"  style="font-size:9px;font-weight:700;color:#4b6280;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;">SYMBOL <span id="ts-sym"></span></span>
    <span onclick="terminalSort('bb')"   style="font-size:9px;font-weight:700;color:#4b6280;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;text-align:center;display:block;">BB LB/UB <span id="ts-bb"></span></span>
    <span onclick="terminalSort('ltp')"  style="font-size:9px;font-weight:700;color:#4b6280;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;text-align:center;display:block;">LTP <span id="ts-ltp"></span></span>
    <span onclick="terminalSort('pct')"  style="font-size:9px;font-weight:700;color:#38bdf8;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;text-align:center;display:block;">CHG% <span id="ts-pct">▼</span></span>
    <span onclick="terminalSort('rsi')"  style="font-size:9px;font-weight:700;color:#4b6280;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;text-align:center;display:block;">RSI <span id="ts-rsi"></span></span>
    <span onclick="terminalSort('macd')" style="font-size:9px;font-weight:700;color:#4b6280;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;text-align:center;display:block;">MACD <span id="ts-macd"></span></span>
  </div>
</div>

<!-- Rows -->
<div id="terminalRows" style="display:flex;flex-direction:column;gap:1px;padding:0 0 8px 0;"></div>
    `;
    el.appendChild(wrap);
  }
 
  _renderTerminalRows();
}
 
// ======================================
// RENDER TERMINAL ROWS (from cache)
// ======================================
function _renderTerminalRows() {
  const rowsEl = document.getElementById('terminalRows');
  const countEl = document.getElementById('terminalCount');
  if (!rowsEl) return;
 
  const wl = AppState.watchlists[AppState.currentWL]?.stocks || AppState.wl || [];
  
  // Build data rows from cache + histcache
  const rows = wl.map(s => {
    const d = AppState.cache[s]?.data;
    if (!d || !d.regularMarketPrice) return null;
 
    const price = d.regularMarketPrice || 0;
    const prev  = d.chartPreviousClose || price;
    const pct   = prev > 0 ? ((price - prev) / prev * 100) : 0;
    const vol   = d.regularMarketVolume || 0;
    const avgVol = d.averageDailyVolume3Month || 0;
    const volSpike = avgVol > 0 && vol >= avgVol * 1.5;
 
    // RSI + MACD + BB from histcache if available
    let rsi = null, macd = null, bb = null;
    const hist = AppState._histCache?.[s] || window._histCache?.[s];
    if (hist && hist.close && hist.close.length >= 30) {
      rsi  = calcRSI(hist.close);
      macd = calcMACD(hist.close);
      bb   = calcBollinger(hist.close);
    }
 
    return { s, price, pct, vol, avgVol, volSpike, rsi, macd, bb };
  }).filter(Boolean);
 
  // Sort
  const { col, dir } = _terminalSort;
  rows.sort((a, b) => {
    let av, bv;
    if (col === 'sym')  { av = a.s; bv = b.s; return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }
    if (col === 'ltp')  { av = a.price; bv = b.price; }
    if (col === 'pct')  { av = a.pct;   bv = b.pct; }
    if (col === 'rsi')  { av = a.rsi ?? -1;  bv = b.rsi ?? -1; }
    if (col === 'macd') { av = a.macd?.histogram ?? 0; bv = b.macd?.histogram ?? 0; }
    if (col === 'bb')   { av = a.bb?.pctB ?? 50; bv = b.bb?.pctB ?? 50; }
    return dir === 'asc' ? av - bv : bv - av;
  });
 
  if (countEl) countEl.textContent = rows.length + ' stocks';
 
  if (rows.length === 0) {
    rowsEl.innerHTML = `<div style="text-align:center;padding:24px;color:#4b6280;font-size:12px;">
      No data — go to Watchlist and refresh first
    </div>`;
    return;
  }
 
  rowsEl.innerHTML = rows.map((r, i) => {
    const pctColor  = r.pct >= 0 ? '#22c55e' : '#ef4444';
    const pctStr    = (r.pct >= 0 ? '+' : '') + r.pct.toFixed(2) + '%';
 
    // RSI pill
    let rsiHtml = '<span style="color:#4b6280;font-size:10px;">--</span>';
    if (r.rsi !== null) {
      const rc = r.rsi >= 70 ? '#ef4444' : r.rsi <= 30 ? '#22c55e' : '#94a3b8';
      const rb = r.rsi >= 70 ? 'rgba(239,68,68,0.12)' : r.rsi <= 30 ? 'rgba(34,197,94,0.12)' : 'transparent';
      rsiHtml = `<span style="font-size:10px;font-weight:700;color:${rc};background:${rb};padding:1px 4px;border-radius:4px;">${r.rsi.toFixed(0)}</span>`;
    }
 
    // MACD signal
    let macdHtml = '<span style="color:#4b6280;font-size:10px;">--</span>';
    if (r.macd) {
      const mc = r.macd.bullishCross ? '#22c55e' : r.macd.bearishCross ? '#ef4444' :
                 r.macd.histogram > 0 ? '#86efac' : '#fca5a5';
      const arrow = r.macd.bullishCross ? '⬆' : r.macd.bearishCross ? '⬇' :
                    r.macd.histogram > 0 ? '↑' : '↓';
      macdHtml = `<span style="font-size:11px;color:${mc};font-weight:700;">${arrow}</span>`;
    }
 
    // BB position bar
    let bbHtml = '<div style="color:#4b6280;font-size:9px;text-align:left;">--</div>';
    if (r.bb) {
      const pctB = Math.max(0, Math.min(100, r.bb.pctB));
      const bbColor = pctB >= 90 ? '#22c55e' : pctB <= 10 ? '#ef4444' : '#38bdf8';
      bbHtml = `
        <div style="display:flex;flex-direction:column;gap:1px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:8px;color:#ef4444;font-family:'JetBrains Mono',monospace;font-weight:600;">▼${r.bb.lower}</span>
          <span style="font-size:8px;color:#22c55e;font-family:'JetBrains Mono',monospace;font-weight:600;">▲${r.bb.upper}</span>
            </div>
          <div style="height:3px;background:#1e2d3d;border-radius:2px;position:relative;">
            <div style="position:absolute;left:0;top:0;height:3px;width:${pctB}%;background:${bbColor};border-radius:2px;"></div>
            <div style="position:absolute;top:-2px;left:calc(${pctB}% - 3px);width:6px;height:6px;border-radius:50%;background:${bbColor};border:1px solid #0d1f35;"></div>
          </div>
        </div>`;
    }
    // Volume spike badge
    const volBadge = r.volSpike
      ? `<span style="font-size:8px;background:rgba(167,139,250,0.2);color:#a78bfa;padding:1px 4px;border-radius:3px;margin-left:3px;font-family:'Rajdhani',sans-serif;font-weight:700;">VOL</span>`
      : '';
 
    const bg = i % 2 === 0 ? '#080f1a' : '#0a1220';
 
    return `<div onclick="openDetail('${r.s}',false)"
      style="display:grid;grid-template-columns:80px 1fr 72px 56px 44px 52px;gap:4px;align-items:center;padding:7px 8px;background:${bg};cursor:pointer;border-radius:4px;">
      <div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#e2e8f0;">${r.s}</span>
        ${volBadge}
      </div>
      <div>${bbHtml}</div>
      <div style="text-align:center;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#94a3b8;">₹${r.price >= 1000 ? r.price.toFixed(0) : r.price.toFixed(2)}</span>
      </div>
      <div style="text-align:center;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:${pctColor};">${pctStr}</span>
      </div>
      <div style="text-align:center;">${rsiHtml}</div>
      <div style="text-align:center;">${macdHtml}</div>
    </div>`;
  }).join('');
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
  // Update header indicators
  ['sym','bb','ltp','pct','rsi','macd'].forEach(c => {
    const el = document.getElementById('ts-' + c);
    if (el) el.textContent = c === col ? (_terminalSort.dir === 'desc' ? '▼' : '▲') : '';
  });
  _renderTerminalRows();
}
 
// ======================================
// REFRESH TERMINAL — fetch histcache from Firebase
// ======================================
async function refreshTerminal() {
  const btn = document.getElementById('terminalRefreshBtn');
  const rowsEl = document.getElementById('terminalRows');
  if (btn) { btn.textContent = '...'; btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
  if (rowsEl) rowsEl.innerHTML = `<div style="text-align:center;padding:24px;color:#4b6280;font-size:12px;">Loading technical data...</div>`;
 
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
  const color     = isUp ? '#22c55e' : '#ef4444';
  return {
    price,
    priceStr:    price.toFixed(2),
    changeStr:   sign + change.toFixed(2) + ' (' + sign + pct.toFixed(2) + '%)',
    changeColor: color
  };
}

function _chipHTML(name, priceStr, changeStr, changeColor) {
  return `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:2px;">${name}</div>
    <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:2px;">${priceStr}</div>
    <div style="font-size:10px;font-weight:700;color:${changeColor};">${changeStr}</div>
  `;
}

function _chipEmptyHTML(name) {
  return `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:2px;">${name}</div>
    <div style="font-size:12px;font-weight:700;color:#4b6280;">---</div>
    <div style="font-size:10px;color:#4b6280;">--</div>
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
window._patchTerminalPrices   = _patchTerminalPrices;
window.updateGiftNifty      = updateGiftNifty;
window.startGiftNiftyUpdates = startGiftNiftyUpdates;

console.log('✅ indices.js loaded successfully');
