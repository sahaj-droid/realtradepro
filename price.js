// ========================================
// PRICES MODULE — RealTradePro v3.0
// ========================================

// ======================================
// ADD STOCK
// ======================================
async function addStock(sym) {
  sym = sym.toUpperCase().trim();
  if (!sym) return;
  showLoader("Adding " + sym + "...");
  let d = await fetchFull(sym);
  hideLoader();
  // ✅ FIX: New IPO stocks may not have price data on Yahoo immediately after listing.
  // We allow adding if any data is returned; live engine will populate price later.
  if (!d) {
    showPopup("❌ Not found: " + sym + " — Check symbol & try again");
    return;
  }
  if (!d.regularMarketPrice) {
    showPopup("⚠️ " + sym + " added! Price will load shortly (newly listed stock)");
  }
  AppState.cache[sym] = { data: d, time: Date.now() };
  const cur = AppState.watchlists[AppState.currentWL];
  if (cur.stocks.includes(sym)) {
    if (AppState.dupWarnEnabled) showPopup(sym + " already in " + cur.name);
    document.getElementById("searchBox").value = "";
    return;
  }
  cur.stocks.unshift(sym);
  AppState.wl = cur.stocks;
  saveWatchlists();
  document.getElementById("searchBox").value = "";
  hideSuggestions();
  if (typeof renderWL === "function") renderWL();
}

// ======================================
// REMOVE STOCK
// ======================================
function removeStock(sym) {
  const rmbox = document.getElementById("remove-modal-box");
  if (!rmbox) {
    if (confirm('Remove ' + sym + ' from watchlist?')) { doRemoveStock(sym); }
    return;
  }
  document.getElementById("remove-title").innerText = "Remove " + sym + " from " + AppState.watchlists[AppState.currentWL].name + "?";
  document.getElementById("remove-confirm-sym").value = sym;
  rmbox.style.display = "flex";
}

function doRemoveStock(sym) {
  const cur = AppState.watchlists[AppState.currentWL];
  cur.stocks = cur.stocks.filter(x => x !== sym);
  AppState.wl = cur.stocks;
  saveWatchlists();
  if (typeof renderWL === 'function') renderWL();
}

function closeRemoveModal() {
  document.getElementById("remove-modal-box").style.display = "none";
}

function confirmRemove() {
  const sym = document.getElementById("remove-confirm-sym").value;
  closeRemoveModal();
  doRemoveStock(sym);
}
// ======================================
// WATCHLIST CSV IMPORT
// ======================================
function triggerWatchlistCSVImport() {
  let inp = document.getElementById('wlCSVInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'wlCSVInput';
    inp.accept = '.csv,.txt';
    inp.style.display = 'none';
    inp.onchange = handleWatchlistCSV;
    document.body.appendChild(inp);
  }
  inp.value = '';
  inp.click();
}

async function handleWatchlistCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  let added = 0, skipped = 0, already = 0;
  const cur = AppState.watchlists[AppState.currentWL];
  for (let line of lines) {
    const sym = line.split(",")[0].replace(/\.NS$/i, "").toUpperCase().trim();
    if (!sym || sym.length < 1 || sym.length > 20) { skipped++; continue; }
    if (/^(SYMBOL|STOCK|NAME|SCRIP)/i.test(sym)) continue;
    if (cur.stocks.includes(sym)) { already++; continue; }
    cur.stocks.push(sym);
    added++;
  }
  saveWatchlists();
  renderWLTabs();
  await renderWL();
  showPopup(`CSV: ${added} added, ${already} already exist, ${skipped} skipped`);
}
// ======================================
// BUILD DAY BAR
// ======================================
function buildDayBar(d) {
  if (!d || !d.regularMarketDayHigh || !d.regularMarketDayLow) return '';
  const lo = d.regularMarketDayLow, hi = d.regularMarketDayHigh, cur = d.regularMarketPrice;
  const range = hi - lo;
  if (range <= 0) return '';
  const pct = Math.min(100, Math.max(0, ((cur - lo) / range) * 100)).toFixed(0);
  return '<div style="margin:0;">'
    + '<div style="display:flex;justify-content:space-between;font-size:9px;font-weight:700;margin-bottom:2px;">'
    + '<span style="color:var(--neg,#ef4444);">' + lo.toFixed(2) + '</span>'
    + '<span style="color:var(--text-label,#4b6280);font-size:8px;">DAY</span>'
    + '<span style="color:var(--pos,#22c55e);">' + hi.toFixed(2) + '</span></div>'
    + '<div style="background:var(--border,#1e2d3d);border-radius:2px;height:3px;position:relative;">'
    + '<div style="position:absolute;left:0;width:' + pct + '%;height:100%;background:linear-gradient(90deg,var(--neg,#ef4444),var(--pos,#22c55e));border-radius:2px;"></div>'
    + '<div style="position:absolute;left:calc(' + pct + '% - 2px);top:-1px;width:4px;height:4px;background:white;border-radius:50%;"></div>'
    + '</div></div>';
}

// ======================================
// BUILD 52W BAR
// ======================================
function build52WBar(d) {
  if (!d || !d.fiftyTwoWeekHigh || !d.fiftyTwoWeekLow) return '';
  const lo = d.fiftyTwoWeekLow, hi = d.fiftyTwoWeekHigh, cur = d.regularMarketPrice;
  const range = hi - lo;
  if (range <= 0) return '';
  const pct = Math.min(100, Math.max(0, ((cur - lo) / range) * 100)).toFixed(0);
  return '<div style="margin:0;margin-top:4px;">'
    + '<div style="display:flex;justify-content:space-between;font-size:9px;font-weight:700;margin-bottom:2px;">'
    + '<span style="color:var(--neg,#ef4444);">' + lo.toFixed(2) + '</span>'
    + '<span style="color:var(--text-label,#4b6280);font-size:8px;">52W</span>'
    + '<span style="color:var(--pos,#22c55e);">' + hi.toFixed(2) + '</span></div>'
    + '<div style="background:var(--border,#1e2d3d);border-radius:2px;height:3px;position:relative;">'
    + '<div style="position:absolute;left:0;width:' + pct + '%;height:100%;background:linear-gradient(90deg,var(--neg,#ef4444),var(--pos,#22c55e));border-radius:2px;"></div>'
    + '<div style="position:absolute;left:calc(' + pct + '% - 2px);top:-1px;width:4px;height:4px;background:var(--accent,#38bdf8);border-radius:50%;"></div>'
    + '</div></div>';
}

// ======================================
// GET 52W LABEL
// ======================================
function get52WLabel(d) {
  if (!d || !d.fiftyTwoWeekHigh || !d.fiftyTwoWeekLow) return '';
  const p = d.regularMarketPrice, hi = d.fiftyTwoWeekHigh, lo = d.fiftyTwoWeekLow;
  const fromHi = ((hi - p) / hi * 100).toFixed(1);
  if (p >= hi * 0.97) return '<span style="color:#22c55e;font-weight:700;font-size:9px;">🔥 Near 52W High</span>';
  if (p <= lo * 1.03) return '<span style="color:#ef4444;font-weight:700;font-size:9px;">⚠️ Near 52W Low</span>';
  return '<span style="color:#4b6280;font-size:10px;">▼' + fromHi + '% from H</span>';
}

// ======================================
// GET TARGET BADGE
// ======================================
function getTargetBadge(sym, price) {
  if (!AppState.targets[sym]) return '';
  const t = AppState.targets[sym];
  const pct = ((t - price) / price * 100).toFixed(1);
  return '<div style="font-size:9px;color:#f59e0b;font-weight:700;margin-top:1px;">🎯 ₹' + t + ' (' + (pct > 0 ? '+' : '') + pct + '%)</div>';
}

// ======================================
// CHECK TARGETS
// ======================================
function checkTargets(sym, currentPrice) {
  if (!AppState.targets[sym]) return;
  const target = AppState.targets[sym];
  if (currentPrice >= target) {
    showPopup(`🎯 TARGET HIT: ${sym} ₹${currentPrice.toFixed(2)} >= ₹${target}`, 6000);
    delete AppState.targets[sym];
    localStorage.setItem("targets", JSON.stringify(AppState.targets));
  }
}

// ======================================
// BUILD WATCHLIST CARD (With Action Panel)
// ======================================
// ======================================
// BUILD WATCHLIST CARD (v3.0 Modern Clean UI)
// ======================================
function _getCompanyDisplayName(s, d) {
  if (d && (d.shortName || d.longName || d.name || d.companyName)) {
    return d.shortName || d.longName || d.name || d.companyName;
  }
  const KNOWN_NAMES = {
    'RELIANCE': 'Reliance Industries Ltd.',
    'HDFCBANK': 'HDFC Bank Ltd.',
    'TATASTEEL': 'Tata Steel Ltd.',
    'TATAPOWER': 'Tata Power Company Ltd.',
    'SBIN': 'State Bank of India',
    'INFY': 'Infosys Limited',
    'TCS': 'Tata Consultancy Services',
    'ICICIBANK': 'ICICI Bank Ltd.',
    'JPL': 'Jupiter Life Line Hospitals',
    'TRAVELFOOD': 'Travel Food Services Ltd.',
    'DCI': 'DC Infotech & Communication',
    'SBIFUNDS': 'SBI Mutual Fund',
    'PARAS': 'Paras Defence & Space Tech',
    'WAAREE': 'Waaree Energies Ltd.',
    'NTPCGREEN': 'NTPC Green Energy Ltd.'
  };
  return KNOWN_NAMES[s.toUpperCase()] || (s + ' Equity');
}

function _getStockAvatarStyle(s) {
  const palettes = [
    { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' },
    { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', color: '#818cf8' },
    { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', color: '#c084fc' },
    { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' },
    { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' },
    { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', color: '#f472b6' }
  ];
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash << 5) - hash + s.charCodeAt(i);
  return palettes[Math.abs(hash) % palettes.length];
}

function _buildWLCard(s, d) {
  const _price = d.regularMarketPrice || d.ltp || 0;
  const _prev = d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || 0;
  const diff = d.regularMarketChange || ((_price && _prev) ? parseFloat((_price - _prev).toFixed(2)) : 0);
  const pct = d.regularMarketChangePercent || ((_prev > 0 && diff) ? parseFloat((diff / _prev * 100).toFixed(2)) : 0);
  
  const initials = s.length <= 4 ? s : s.substring(0, 3).toUpperCase();
  const compName = _getCompanyDisplayName(s, d);
  const av = _getStockAvatarStyle(s);
  const isUp = diff >= 0;

  return `
    <div class="wl-card-wrap" id="wrap-${s}" style="margin-bottom:6px;">
      <div class="card glass-card p-3 flex items-center justify-between cursor-pointer hover:scale-[1.01]" onclick="toggleActions('${s}')" style="position:relative;margin:0;">
        <button onclick="event.stopPropagation();removeStock('${s}')" style="position:absolute; top:2px; right:4px; color:#ef4444; font-size:10px; background:none; border:none; cursor:pointer; z-index:10; padding:2px 6px;">✕</button>
        <div class="flex items-center gap-3 cursor-pointer" onclick="event.stopPropagation();openDetail('${s}',false)">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0" style="background:${av.bg}; border:1px solid ${av.border}; color:${av.color};">
            ${initials}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-sm tracking-tight text-[var(--text-main)] hover:text-sky-400" style="font-family:'Rajdhani',sans-serif;">${s}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">NSE</span>
            </div>
            <div class="text-[11px] text-[var(--text-dim)] hover:text-sky-300" style="font-family:'Rajdhani',sans-serif;">${compName}</div>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div id="price-${s}" class="mono text-sm font-extrabold text-[var(--text-main)]" onclick="event.stopPropagation();openDetail('${s}',false)" style="cursor:pointer;">
            ${_price > 0 ? '₹' + _price.toFixed(2) : '--'}
          </div>
          <div id="change-${s}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isUp ? 'badge-pos' : 'badge-neg'}">
            ${isUp ? '▲ +' : '▼ '}${Math.abs(diff).toFixed(2)} (${(isUp ? '+' : '') + pct.toFixed(2)}%)
          </div>
        </div>
      </div>

      <!-- Action Panel -->
      <div class="wl-actions-panel" id="act-${s}" style="display:none; padding:8px; margin-top:4px; background:var(--bg-card); border:1px solid var(--border); border-radius:12px;">
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
          <button class="act-btn" onclick="openModal('BUY','${s}',${_price});toggleActions('${s}')" style="background:#166534; color:#86efac; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">BUY</button>
          <button class="act-btn" onclick="openModal('SELL','${s}',${_price});toggleActions('${s}')" style="background:#7f1d1d; color:#fca5a5; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">SELL</button>
          <button class="act-btn" onclick="openDetail('${s}',false);toggleActions('${s}')" style="background:#1e3a5f; color:#93c5fd; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">CHART</button>
          <button class="act-btn" onclick="openNews('${s}');toggleActions('${s}')" style="background:#4a1d96; color:#c4b5fd; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">NEWS</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:6px;">
          <button class="act-btn" onclick="setAlert('${s}');toggleActions('${s}')" style="background:#713f12; color:#fde68a; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">🔔 ALERT</button>
          <button class="act-btn" onclick="setTarget('${s}',${_price});toggleActions('${s}')" style="background:#1e2d3d; color:#cbd5e1; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">🎯 TARGET</button>
          <button class="act-btn" onclick="openNivi('${s}');toggleActions('${s}')" style="background:#065f46; color:#34d399; padding:7px 0; border-radius:8px; font-weight:700; font-size:11px; font-family:'Rajdhani',sans-serif;">💬 NIVI AI</button>
        </div>
      </div>
    </div>`;
}

// ======================================
// PATCH WL CARD (for live updates)
// ======================================
function _patchWLCard(s, d) {
  const _price = d.regularMarketPrice || d.ltp || 0;
  const _prev = d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || 0;
  const diff = d.regularMarketChange || ((_price && _prev) ? parseFloat((_price - _prev).toFixed(2)) : 0);
  const pct = d.regularMarketChangePercent || ((_prev > 0 && diff) ? parseFloat((diff / _prev * 100).toFixed(2)) : 0);
  
  const pe = document.getElementById('price-' + s);
  const ce = document.getElementById('change-' + s);
  
  if (pe) {
    pe.innerText = _price > 0 ? '₹' + _price.toFixed(2) : '--';
  }
  if (ce) {
    const isUp = diff >= 0;
    const sign = isUp ? '▲ +' : '▼ ';
    ce.innerText = _price > 0 ? `${sign}${Math.abs(diff).toFixed(2)} (${isUp ? '+' : ''}${pct.toFixed(2)}%)` : '--';
    ce.className = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isUp ? 'badge-pos' : 'badge-neg'}`;
  }
}

// ======================================
// PATCH VISIBLE WL PRICES
// ======================================
function _patchVisibleWLPrices() {
  let displayList = AppState.watchlists[AppState.currentWL] ? [...AppState.watchlists[AppState.currentWL].stocks] : [];
  if (AppState.currentGroup !== 'ALL' && AppState.groups[AppState.currentGroup]) {
    displayList = displayList.filter(s => AppState.groups[AppState.currentGroup].includes(s));
  }
  displayList.forEach(s => {
    const d = AppState.cache[s]?.data;
    if (d && document.getElementById('price-' + s)) {
      _patchWLCard(s, d);
    }
  });
}

// ======================================
// TAP ACTION PANEL
// ======================================
function toggleActions(sym) {
  var panel = document.getElementById('act-' + sym);
  if (!panel) return;
  document.querySelectorAll('.wl-actions-panel.open').forEach(function(el) {
    if (el.id !== 'act-' + sym) el.classList.remove('open');
  });
  panel.classList.toggle('open');
}

// Close panels on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('.wl-card-wrap')) {
    document.querySelectorAll('.wl-actions-panel.open').forEach(function(el) {
      el.classList.remove('open');
    });
  }
});

// ======================================
// UPDATE PRICES - MAIN FUNCTION (With GIFT NIFTY Fix)
// ======================================
async function updatePrices() {
  // 🛑 DEAD CODE REMOVED: Data fetching and targeted patching is now 
  // strictly managed by the centralized live-price.js engine.
  // This safe stub ensures no legacy calls throw 'undefined function' errors.
  console.debug("[Legacy] updatePrices intercepted - delegating to live-price.js");
}

// ======================================
// SORT FUNCTIONS
// ======================================
function sortAZ() {
  AppState.watchlists[AppState.currentWL].stocks.sort((a, b) => AppState.azAsc ? a.localeCompare(b) : b.localeCompare(a));
  AppState.azAsc = !AppState.azAsc;
  saveWatchlists();
  renderWL();
}

function sortPrice() {
  AppState.watchlists[AppState.currentWL].stocks.sort((a, b) => {
    let pa = AppState.cache[a]?.data?.regularMarketPrice || 0;
    let pb = AppState.cache[b]?.data?.regularMarketPrice || 0;
    return AppState.priceAsc ? pa - pb : pb - pa;
  });
  AppState.priceAsc = !AppState.priceAsc;
  saveWatchlists();
  renderWL();
}

function sortPercent() {
  AppState.watchlists[AppState.currentWL].stocks.sort((a, b) => {
    let da = AppState.cache[a]?.data, db = AppState.cache[b]?.data;
    let pa = da ? (da.regularMarketPrice - da.chartPreviousClose) / da.chartPreviousClose : 0;
    let pb = db ? (db.regularMarketPrice - db.chartPreviousClose) / db.chartPreviousClose : 0;
    return AppState.percentAsc ? pa - pb : pb - pa;
  });
  AppState.percentAsc = !AppState.percentAsc;
  saveWatchlists();
  renderWL();
}

// ======================================
// SEARCH SUGGESTIONS (Yahoo)
// ======================================
let _searchTimer = null;
let _lastSearchVal = '';

function showSuggestions(val) {
  val = val.trim();
  const box = document.getElementById("suggestionBox");
  if (!val || val.length < 1) { 
    if (box) box.style.display = "none"; 
    return; 
  }

  const valUpper = val.toUpperCase();
  const alreadyIn = new Set(AppState.wl);
  const localMatches = POPULAR_STOCKS
    .filter(s => s.startsWith(valUpper) && !alreadyIn.has(s))
    .slice(0, 4);

  if (localMatches.length > 0) {
    renderSuggestions(localMatches.map(s => ({symbol: s, name: '', exchange: ''})), box, true);
  }

  if (_searchTimer) clearTimeout(_searchTimer);
  _lastSearchVal = val;
  _searchTimer = setTimeout(() => {
    if (_lastSearchVal !== val) return;
    fetchYahooSuggestions(val, box);
  }, 300);
}

async function fetchYahooSuggestions(val, box) {
  try {
    const api = getActiveGASUrl();
    const r = await fetch(`${api}?type=search&q=${encodeURIComponent(val)}`);
    const j = await r.json();
    if (!j.ok || !j.results || j.results.length === 0) return;
    
    const alreadyIn = new Set(AppState.wl);
    const INDIAN_EXCHANGES = new Set(['NSI', 'BSE', 'NSE', 'NMS']);
    const results = j.results
      .filter(r => {
        const sym = r.symbol || '';
        const exch = (r.exchange || r.exchDisp || '').toUpperCase();
        // ✅ FIX: New IPOs may have blank exchange — allow if symbol looks Indian (.NS/.BO) OR no exchange info
        const isIndian = sym.endsWith('.NS') || sym.endsWith('.BO') || INDIAN_EXCHANGES.has(exch) || exch === '';
        const cleanSym = sym.replace('.NS', '').replace('.BO', '');
        const notInWL = !alreadyIn.has(cleanSym);
        return isIndian && notInWL;
      })
      .slice(0, 7);
    if (results.length > 0 && _lastSearchVal === val) {
      renderSuggestions(results, box, false);
    }
  } catch(e) { console.warn('Yahoo suggestions error:', e); }
}

function renderSuggestions(items, box, isLocal) {
  if (!items || items.length === 0) { 
    if (box) box.style.display = "none"; 
    return; 
  }
  box.innerHTML = items.map(item => {
    const sym = item.symbol || item;
    const rawSym = sym.replace('.NS', '').replace('.BO', '');
    const name = item.name || '';
    const exch = item.exchange ? `<span style="font-size:9px;color:#4b6280;margin-left:4px;">${item.exchange}</span>` : '';
    const nameHtml = name ? `<div style="font-size:10px;color:#94a3b8;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>` : '';
    return `<div class="suggestion-item" style="padding:7px 14px;" onclick="selectSuggestion('${rawSym}')">
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-weight:700;">${rawSym}</span>${exch}
      </div>
      ${nameHtml}
    </div>`;
  }).join('');
  box.style.display = "block";
}

function selectSuggestion(sym) {
  document.getElementById("searchBox").value = sym;
  hideSuggestions();
  addStock(sym);
}

function hideSuggestions() { 
  const box = document.getElementById("suggestionBox");
  if (box) box.style.display = "none"; 
}

// Close suggestions on outside click
document.addEventListener("click", e => { 
  if (!e.target.closest("#searchSection")) hideSuggestions(); 
});

// ======================================
// TARGET PRICE MODAL
// ======================================
function setTarget(sym, currentPrice) {
  AppState.currentAlertSym = sym;
  const tbox = document.getElementById("target-modal-box");
  if (!tbox) { showPopup("Target modal missing"); return; }
  document.getElementById("target-title").innerText = "Set Target - " + sym;
  document.getElementById("target-price").value = AppState.targets[sym] || "";
  document.getElementById("target-price").placeholder = "Current: ₹" + currentPrice.toFixed(2);
  tbox.style.display = "flex";
}

function closeTargetModal() {
  document.getElementById("target-modal-box").style.display = "none";
}

function confirmTarget() {
  const price = parseFloat(document.getElementById("target-price").value);
  if (!price || isNaN(price) || price <= 0) { showPopup("Invalid price"); return; }
  AppState.targets[AppState.currentAlertSym] = price;
  localStorage.setItem("targets", JSON.stringify(AppState.targets));
  closeTargetModal();
  showPopup("Target set: " + AppState.currentAlertSym + " @ ₹" + price);
  renderWL();
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.renderWL = renderWL;
window.updatePrices = updatePrices;
window.addStock = addStock;
window.removeStock = removeStock;
window.doRemoveStock = doRemoveStock;
window.closeRemoveModal = closeRemoveModal;
window.confirmRemove = confirmRemove;
window.toggleActions = toggleActions;
window.sortAZ = sortAZ;
window.sortPrice = sortPrice;
window.sortPercent = sortPercent;
window.setTarget = setTarget;
window.closeTargetModal = closeTargetModal;
window.confirmTarget = confirmTarget;
window.showSuggestions = showSuggestions;
window.selectSuggestion = selectSuggestion;
window.hideSuggestions = hideSuggestions;
window.buildDayBar = buildDayBar;
window.build52WBar = build52WBar;
window.get52WLabel = get52WLabel;
window.getTargetBadge = getTargetBadge;
window.checkTargets = checkTargets;
window._patchWLCard = _patchWLCard;
window._patchVisibleWLPrices = _patchVisibleWLPrices;

console.log('✅ price.js loaded successfully');
