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
  if (!d || !d.regularMarketPrice) {
    showPopup("Invalid Stock: " + sym);
    return;
  }
  AppState.cache[sym] = { data: d, time: Date.now() };
  const cur = AppState.watchlists[AppState.currentWL];
  if (cur.stocks.includes(sym)) {
    if (AppState.dupWarnEnabled) showPopup(sym + ' already in ' + cur.name);
    document.getElementById("searchBox").value = "";
    return;
  }
  cur.stocks.unshift(sym);
  AppState.wl = cur.stocks;
  saveWatchlists();
  document.getElementById("searchBox").value = "";
  hideSuggestions();
  if (typeof renderWL === 'function') renderWL();
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
    + '<span style="color:#ef4444;">' + lo.toFixed(2) + '</span>'
    + '<span style="color:#4b6280;font-size:8px;">DAY</span>'
    + '<span style="color:#22c55e;">' + hi.toFixed(2) + '</span></div>'
    + '<div style="background:#1e2d3d;border-radius:2px;height:3px;position:relative;">'
    + '<div style="position:absolute;left:0;width:' + pct + '%;height:100%;background:linear-gradient(90deg,#ef4444,#22c55e);border-radius:2px;"></div>'
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
    + '<span style="color:#ef4444;">' + lo.toFixed(2) + '</span>'
    + '<span style="color:#4b6280;font-size:8px;">52W</span>'
    + '<span style="color:#22c55e;">' + hi.toFixed(2) + '</span></div>'
    + '<div style="background:#1e2d3d;border-radius:2px;height:3px;position:relative;">'
    + '<div style="position:absolute;left:0;width:' + pct + '%;height:100%;background:linear-gradient(90deg,#ef4444,#22c55e);border-radius:2px;"></div>'
    + '<div style="position:absolute;left:calc(' + pct + '% - 2px);top:-1px;width:4px;height:4px;background:#38bdf8;border-radius:50%;"></div>'
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
function _buildWLCard(s, d) {
  const _price = d.regularMarketPrice || d.ltp || 0;
  const _prev = d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || 0;
  const diff = d.regularMarketChange || ((_price && _prev) ? parseFloat((_price - _prev).toFixed(2)) : 0);
  const pct = d.regularMarketChangePercent || ((_prev > 0 && diff) ? parseFloat((diff / _prev * 100).toFixed(2)) : 0);
  
  return `
    <div class="wl-card-wrap" id="wrap-${s}">
      <div class="card" onclick="toggleActions('${s}')" style="padding:10px; position:relative; cursor:pointer; margin-bottom:3px;">
        <button onclick="event.stopPropagation();removeStock('${s}')" style="position:absolute; top:1px; right:2px; color:var(--neg, #ef4444); font-size:6px; background:none; border:none; cursor:pointer; z-index:10; padding:4px;">✕</button>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
          <div style="width:75px; flex-shrink:0;">
            <span onclick="event.stopPropagation();openDetail('${s}',false)" style="font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:700; cursor:pointer; color:var(--accent, #38bdf8); text-decoration:underline;">${s}</span>
          </div>
          <div style="flex:1; min-width:0; display:flex; justify-content:center;">
            <div id="daybar-${s}" style="width:100%; max-width:140px;">${buildDayBar(d)}</div>
          </div>
          <div style="width:105px; flex-shrink:0; text-align:right;">
            <div id="price-${s}" style="font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:700; color:var(--text-primary, #e2e8f0);">${_price > 0 ? '₹' + _price.toFixed(2) : '<span style="color:var(--text-muted, #4b6280);font-size:13px;">--</span>'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div id="label52-${s}" style="width:75px; flex-shrink:0; font-size:9px; line-height:1.2; color:var(--text-sec, #94a3b8); font-weight:600;">
            ${get52WLabel(d)}${getTargetBadge(s, _price)}
          </div>
          <div style="flex:1; min-width:0; display:flex; justify-content:center;">
            <div id="bar52-${s}" style="width:100%; max-width:140px;">${build52WBar(d)}</div>
          </div>
          <div style="width:105px; flex-shrink:0; text-align:right;">
            <div id="change-${s}" style="font-size:13px; font-weight:700; color:${diff >= 0 ? 'var(--pos, #22c55e)' : 'var(--neg, #ef4444)'}; white-space:nowrap;">
              ${_price > 0 ? (diff >= 0 ? '+' : '') + '₹' + Math.abs(diff).toFixed(2) + ' (' + (diff >= 0 ? '+' : '') + pct.toFixed(2) + '%)' : '<span style="color:var(--text-muted, #4b6280);">--</span>'}
            </div>
          </div>
        </div>
      </div>
      <div class="wl-actions-panel" id="act-${s}" style="display:none;">
        <div>
          <button class="act-btn" onclick="openModal('BUY','${s}',${_price});toggleActions('${s}')" style="background:#166534; color:#86efac; padding:8px 0;">BUY</button>
          <button class="act-btn" onclick="openModal('SELL','${s}',${_price});toggleActions('${s}')" style="background:#7f1d1d; color:#fca5a5; padding:8px 0;">SELL</button>
          <button class="act-btn" onclick="chart('${s}');toggleActions('${s}')" style="background:#0f2a40; color:#60a5fa; padding:8px 0;">CHART</button>
          <button class="act-btn" onclick="openNews('${s}');toggleActions('${s}')" style="background:#0f2a40; color:#a78bfa; padding:8px 0;">NEWS</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px;">
          <button class="act-btn" onclick="setAlert('${s}');toggleActions('${s}')" style="background:#713f12; color:#fde68a; padding:8px 0;">ALERT</button>
          <button class="act-btn" onclick="setTarget('${s}',${_price});toggleActions('${s}')" style="background:#4a1d96; color:#c4b5fd; padding:8px 0;">TARGET</button>
          <button class="act-btn" onclick="openNivi('${s}');toggleActions('${s}')" style="background:#065f46; color:#34d399; padding:8px 0;">💬 NIVI AI</button>
        </div>
      </div>
    </div>`;
}

// ======================================
// RENDER WATCHLIST
// ======================================
async function renderWL() {
  let displayList = AppState.watchlists[AppState.currentWL] ? [...AppState.watchlists[AppState.currentWL].stocks] : [];
  if (AppState.currentGroup !== 'ALL' && AppState.groups[AppState.currentGroup]) {
    displayList = displayList.filter(s => AppState.groups[AppState.currentGroup].includes(s));
  }
  
  const watchlistDiv = document.getElementById("watchlist");
  if (!watchlistDiv) return;
  
  if (!displayList.length) {
    watchlistDiv.innerHTML = '<div style="text-align:center;color:#4b6280;padding:30px;font-size:13px;">Search stock above to add to ' + AppState.watchlists[AppState.currentWL].name + '</div>';
    return;
  }

  let html = "";
  const needFetch = [];

  for (let s of displayList) {
    const d = AppState.cache[s]?.data;
    if (d) {
      html += _buildWLCard(s, d);
    } else {
      needFetch.push(s);
      html += `<div class="wl-card-wrap" id="wrap-${s}">
        <div class="card" style="padding:10px; position:relative; cursor:pointer; margin-bottom:3px;">
          <button onclick="event.stopPropagation();removeStock('${s}')" style="position:absolute; top:1px; right:2px; color:#ef4444; font-size:6px; background:none; border:none; cursor:pointer; padding:4px;">✕</button>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
            <div style="width:75px;"><span style="font-size:14px; font-weight:700; color:#38bdf8;">${s}</span></div>
            <div style="flex:1;"></div>
            <div style="width:105px; text-align:right;"><div style="font-size:17px; font-weight:700; color:#4b6280;">...</div></div>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="width:75px;"></div>
            <div style="flex:1;"></div>
            <div style="width:105px; text-align:right;"><div style="font-size:13px; color:#4b6280;">--</div></div>
          </div>
        </div>
        <div class="wl-actions-panel" id="act-${s}" style="display:none;"></div>
      </div>`;
    }
  }
  
  watchlistDiv.innerHTML = html;

  if (needFetch.length > 0) {
    for (let s of needFetch) {
      try {
        const d = await fetchFull(s);
        if (d && document.getElementById('price-' + s)) {
          const wrap = document.getElementById('wrap-' + s);
          if (wrap) wrap.outerHTML = _buildWLCard(s, d);
        }
      } catch(e) { /* silent */ }
    }
  }
}

// ======================================
// PATCH WL CARD (for live updates)
// ======================================
function _patchWLCard(s, d) {
  const _price = parseFloat(Number(d.regularMarketPrice || d.ltp || d.price || 0).toFixed(2));
  const _prev = parseFloat(Number(d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || _price).toFixed(2));
  const diff = parseFloat((_price - _prev).toFixed(2));
  const pct = _prev > 0 ? parseFloat((diff / _prev * 100).toFixed(2)) : 0;
  
  const pe = document.getElementById('price-' + s);
  const ce = document.getElementById('change-' + s);
  const db = document.getElementById('daybar-' + s);
  const b5 = document.getElementById('bar52-' + s);
  const l5 = document.getElementById('label52-' + s);
  
  if (pe) {
    const rawPrice = pe.innerText.replace(/[₹,]/g, '');
    let oldPrice = parseFloat(rawPrice);
    if (isNaN(oldPrice)) oldPrice = 0;

    // 🔥 NEW FIX: Inline Background Flash (Exact same as Indices)
    if (oldPrice > 0 && _price.toFixed(2) !== oldPrice.toFixed(2)) {
      const isUp = _price > oldPrice;
      const flashText = isUp ? '#22c55e' : '#ef4444'; // Exact Green / Red
      const flashBg = isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
      const card = pe.closest('.card');
      
      if (card) {
          card.style.transition = 'none';
          card.style.background = flashBg;
      }
      pe.style.color = flashText;

      setTimeout(() => { 
        if (card) {
            card.style.transition = 'background 0.5s ease';
            card.style.background = ''; // Reverts to CSS default gradient
        }
        pe.style.color = 'var(--text-primary, #e2e8f0)'; 
      }, 400);
    }
    
    pe.innerHTML = _price > 0 ? '₹' + _price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '<span style="color:var(--text-muted, #4b6280);font-size:13px;">--</span>';
  }
  
  if (ce) {
    const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
    ce.innerHTML = _price > 0 ? sign + '₹' + Math.abs(diff).toFixed(2) + ' <span style="font-size:12px;">(' + sign + pct.toFixed(2) + '%)</span>' : '<span style="color:var(--text-muted, #4b6280);">--</span>';
    ce.style.color = diff >= 0 ? 'var(--pos, #22c55e)' : 'var(--neg, #ef4444)';
  }
  if (db) db.innerHTML = buildDayBar(d);
  if (b5) b5.innerHTML = build52WBar(d);
  if (l5) l5.innerHTML = get52WLabel(d) + getTargetBadge(s, _price);
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
// UPDATE PRICES - MAIN FUNCTION (With Indices Fix)
// ======================================
async function updatePrices() {
  const activeWl = AppState.watchlists[AppState.currentWL]?.stocks ? [...AppState.watchlists[AppState.currentWL].stocks] : [];
  if (activeWl.length === 0) return;

  const isMarketOpen = getMarketStatus().open;
  
  // 🔥 GIFT NIFTY - Always fetch (આમાં 60 સેકન્ડનું લોજીક અંદર જ છે)
  if (typeof updateGiftNifty === 'function') {
    await updateGiftNifty();
  }
  
  // 🔥 Market Open → GAS fetch (Watchlist + Indices)
  if (isMarketOpen) {
    try { 
      // 1. વોચલિસ્ટના સ્ટોક્સ લાવો
      await batchFetchStocks(activeWl); 

      // 2. 🚀 NEW FIX: ઇન્ડાઈસીસ (Nifty, Sensex) ના ભાવ પણ અહીંયા જ લાવો!
      const indices = AppState.indicesList || [];
      const nonGift = indices.filter(i => i.sym !== 'NIFTY1!');
      await Promise.all(nonGift.map(async (idx) => {
         // દર વખતે નવો ભાવ લાવવા કેશ ટાઈમ 0 કરો
         if (AppState.cache[idx.sym]) AppState.cache[idx.sym].time = 0; 
         if (typeof fetchFull === 'function') await fetchFull(idx.sym, true);
      }));

      console.log("[updatePrices] GAS fetch (Market Open) - Stocks & Indices Updated");
    } catch(e) {
      console.warn("[updatePrices] GAS fetch failed:", e);
    }
  } else {
    console.log("[updatePrices] Market Closed — using cached data");
  }

// =============================================
  // ✅ UI UPDATE LOOP
  // =============================================

  for (let s of activeWl) {
    if (!AppState.cache[s]?.data) continue;
    let d = { ...AppState.cache[s].data };
    let price = parseFloat(Number(d.regularMarketPrice || d.ltp || d.price || 0).toFixed(2));
    let prev = parseFloat(Number(d.prevClose || d.regularMarketPreviousClose || d.chartPreviousClose || price).toFixed(2));
    let diff = parseFloat((price - prev).toFixed(2));
    let pct = prev > 0 ? parseFloat(((diff / prev) * 100).toFixed(2)) : 0;

    let pe = document.getElementById(`price-${s}`);
    if (pe) {
      const rawPrice = pe.innerText.replace(/[₹,]/g, '');
      let oldPrice = parseFloat(rawPrice);
      if (isNaN(oldPrice)) oldPrice = 0;

      // 🔥 NEW FIX: Flash Effect for Watchlist Cards
      if (oldPrice > 0 && price.toFixed(2) !== oldPrice.toFixed(2)) {
        const isUp = price > oldPrice;
        const flashText = isUp ? '#22c55e' : '#ef4444';
        const flashBg = isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
        const card = pe.closest('.card');
        
        if (card) {
            card.style.transition = 'none';
            card.style.background = flashBg;
        }
        pe.style.color = flashText;

        setTimeout(() => { 
          if (card) {
              card.style.transition = 'background 0.5s ease';
              card.style.background = ''; // Reverts to normal card theme
          }
          pe.style.color = 'var(--text-primary, #e2e8f0)'; 
        }, 400);
      }

      pe.innerText = price > 0 ? '₹' + price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '--';
    }

    const bar52Elem = document.getElementById(`bar52-${s}`);
    if (bar52Elem) bar52Elem.innerHTML = build52WBar(d);
    const label52Elem = document.getElementById(`label52-${s}`);
    if (label52Elem) label52Elem.innerHTML = get52WLabel(d) + getTargetBadge(s, price);
    const dayBarElem = document.getElementById(`daybar-${s}`);
    if (dayBarElem) dayBarElem.innerHTML = buildDayBar(d);
    if (typeof checkAlerts === 'function') checkAlerts(s, price);
    if (typeof checkTargets === 'function') checkTargets(s, price);
    if (typeof checkVolumeSpike === 'function') checkVolumeSpike(s, d);
    if (AppState.lastUpdatedMap) AppState.lastUpdatedMap[s] = Date.now();

    let ce = document.getElementById(`change-${s}`);
    if (ce) {
      const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
      ce.innerHTML = sign + '₹' + Math.abs(diff).toFixed(2) + ' <span style="font-size:12px;">(' + sign + pct.toFixed(2) + '%)</span>';
      // Strict CSS variable colors for + / - 
      ce.style.color = diff >= 0 ? "var(--pos, #22c55e)" : "var(--neg, #ef4444)";
    }
  }
  
  if (typeof updateHeaderIndices === 'function') updateHeaderIndices();
  if (typeof updatePriceTicker === 'function') updatePriceTicker();
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
    const INDIAN_EXCHANGES = new Set(['NSI', 'BSE', 'NSE']);
    const results = j.results
      .filter(r => {
        const sym = r.symbol || '';
        const exch = (r.exchange || r.exchDisp || '').toUpperCase();
        const isIndian = sym.endsWith('.NS') || sym.endsWith('.BO') || INDIAN_EXCHANGES.has(exch);
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
