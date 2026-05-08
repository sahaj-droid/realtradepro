// ============================================================
// LIVE PRICE ENGINE — RealTradePro v1.1 FIXED
// ============================================================

(function() {
  'use strict';

  let _interval     = null;
  let _warmupTimer  = null;
  let _running      = false;
  let _started      = false;

  function _getRefreshMs() {
    const sec = parseInt(localStorage.getItem('refreshSec')) || 8;
    return Math.max(6, sec) * 1000;
  }

  // ── _flashCard FIX ─────────────────────────────────────────
  // REMOVED: applyFullTheme() — it was resetting ALL inline styles
  //          after every flash, killing 52W bar track color,
  //          live DOM colors, and causing visible flicker
  // REMOVED: data-notheme toggle — not needed, caused bar resets
  // theme.js MutationObserver handles theme on new nodes automatically
  window._flashCard = function(cardEl, isUp) {
    if (!cardEl) return;
    cardEl.classList.remove('flash-green', 'flash-red');
    void cardEl.offsetWidth; // reflow to restart CSS animation
    cardEl.classList.add(isUp ? 'flash-green' : 'flash-red');
    setTimeout(() => {
      cardEl.classList.remove('flash-green', 'flash-red');
    }, 1000);
  };

  // ── Patch single card ──────────────────────────────────────
  function _patchCard(sym, data) {
    const price = parseFloat(Number(
      data.regularMarketPrice || data.ltp || data.price || 0
    ).toFixed(2));
    const prev = parseFloat(Number(
      data.chartPreviousClose || data.regularMarketPreviousClose ||
      data.prevClose || data.prev_close || price
    ).toFixed(2));
    const diff = parseFloat((price - prev).toFixed(2));
    const pct  = prev > 0 ? parseFloat(((diff / prev) * 100).toFixed(2)) : 0;

    const pe = document.getElementById('price-' + sym);
    if (pe) {
      const oldPrice = parseFloat(pe.innerText.replace(/[₹,]/g, '')) || 0;
      if (oldPrice > 0 && price > 0 && price.toFixed(2) !== oldPrice.toFixed(2)) {
        if (typeof _flashCard === 'function') {
          _flashCard(pe.closest('.card') || pe.closest('.wl-card-wrap'), price > oldPrice);
        }
      }
      pe.innerHTML = price > 0
        ? '₹' + price.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        : '<span style="color:#4b6280;font-size:13px;">--</span>';
    }

    const ce = document.getElementById('change-' + sym);
    if (ce) {
      const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
      ce.innerHTML = price > 0
        ? sign + '₹' + Math.abs(diff).toFixed(2) +
          ' <span style="font-size:12px;">(' + sign + pct.toFixed(2) + '%)</span>'
        : '<span style="color:#4b6280;">--</span>';
      ce.style.color = diff > 0 ? 'var(--pos,#22c55e)'
                     : diff < 0 ? 'var(--neg,#ef4444)'
                     : '#64748b';
    }

    const db = document.getElementById('daybar-' + sym);
    if (db && typeof buildDayBar === 'function') db.innerHTML = buildDayBar(data);

    const b5 = document.getElementById('bar52-' + sym);
    if (b5 && typeof build52WBar === 'function') b5.innerHTML = build52WBar(data);

    const l5 = document.getElementById('label52-' + sym);
    if (l5 && typeof get52WLabel === 'function') {
      l5.innerHTML = get52WLabel(data) + (typeof getTargetBadge === 'function' ? getTargetBadge(sym, price) : '');
    }

    if (typeof checkAlerts      === 'function') checkAlerts(sym, price);
    if (typeof checkTargets     === 'function') checkTargets(sym, price);
    if (typeof checkVolumeSpike === 'function') checkVolumeSpike(sym, data);
    if (AppState.lastUpdatedMap) AppState.lastUpdatedMap[sym] = Date.now();
  }

  function _patchAllVisible() {
    const wl     = AppState.watchlists?.[AppState.currentWL]?.stocks || [];
    const group  = AppState.currentGroup;
    const groups = AppState.groups || {};
    const list   = (group !== 'ALL' && groups[group])
      ? wl.filter(s => groups[group].includes(s)) : wl;
    list.forEach(sym => {
      const data = AppState.cache[sym]?.data;
      if (data && document.getElementById('price-' + sym)) _patchCard(sym, data);
    });
  }

  function _saveToLocalStorage(symbols) {
    if (typeof saveToLocalCache !== 'function') return;
    const toSave = {};
    symbols.forEach(sym => {
      if (AppState.cache[sym]?.data) toSave[sym] = AppState.cache[sym].data;
    });
    if (Object.keys(toSave).length > 0) saveToLocalCache(toSave);
  }

  async function _tick() {
    if (_running) return;
    _running = true;
    try {
      const status = getMarketStatus();
      if (typeof updateGiftNifty === 'function') await updateGiftNifty().catch(() => {});

      if (status.open) {
        const wl = AppState.watchlists?.[AppState.currentWL]?.stocks || [];
        const nonGiftIndices = (AppState.indicesList || [])
          .filter(i => i.sym !== 'NIFTY1!').map(i => i.sym);
        try {
          await Promise.all([
            wl.length > 0 ? batchFetchStocks(wl) : Promise.resolve(),
            nonGiftIndices.length > 0 ? batchFetchStocks(nonGiftIndices, true) : Promise.resolve()
          ]);
        } catch(e) { console.warn('[LivePrice] GAS fetch failed:', e.message); }
        if (wl.length > 0) _saveToLocalStorage(wl);
      }

      _patchAllVisible();
      if (typeof updateHeaderIndices === 'function') updateHeaderIndices();
      if (typeof updatePriceTicker   === 'function') updatePriceTicker();

    } catch(e) {
      console.warn('[LivePrice] Tick error:', e.message);
    } finally {
      _running = false;
    }
  }

  function _startWarmup() {
    if (_warmupTimer) clearInterval(_warmupTimer);
    _warmupTimer = setInterval(() => {
      if (!getMarketStatus().open) return;
      const urls = typeof getEnabledGASUrls === 'function' ? getEnabledGASUrls() : [];
      if (urls.length > 0) fetch(urls[0] + '?type=ping', { signal: AbortSignal.timeout(3000) }).catch(() => {});
    }, 45000);
  }

  function startLivePriceEngine() {
    if (_started) stopLivePriceEngine();
    _started = true; _running = false;
    console.log('[LivePrice] 🚀 Engine started');
    _tick();
    _interval = setInterval(_tick, _getRefreshMs());
    _startWarmup();
  }

  function stopLivePriceEngine() {
    if (_interval)    { clearInterval(_interval);    _interval    = null; }
    if (_warmupTimer) { clearInterval(_warmupTimer); _warmupTimer = null; }
    _running = false; _started = false;
    console.log('[LivePrice] 🛑 Engine stopped');
  }

  function restartLivePriceEngine() { stopLivePriceEngine(); startLivePriceEngine(); }
  function patchVisiblePrices()     { _patchAllVisible(); }
  async function manualPriceFetch() {
    const wl = AppState.watchlists?.[AppState.currentWL]?.stocks || [];
    wl.forEach(sym => { if (AppState.cache[sym]) AppState.cache[sym].time = 0; });
    await _tick();
  }

  window.startLivePriceEngine   = startLivePriceEngine;
  window.stopLivePriceEngine    = stopLivePriceEngine;
  window.restartLivePriceEngine = restartLivePriceEngine;
  window.patchVisiblePrices     = patchVisiblePrices;
  window.manualPriceFetch       = manualPriceFetch;
  window.updatePrices           = _tick;
  window._patchVisibleWLPrices  = _patchAllVisible;
  window._patchWLCard           = _patchCard;

  console.log('✅ live-price.js v1.1 loaded | startLivePriceEngine() to begin');

})();
