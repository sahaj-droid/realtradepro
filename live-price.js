// ============================================================
// LIVE PRICE ENGINE — RealTradePro
// Version: 1.0 FINAL
// ⚠️  DO NOT MODIFY THIS FILE
// This is the heart of RealTradePro — live price tracking
// Author: Built for Dost — sahaj-droid
// ============================================================
//
// WHAT THIS FILE DOES:
//   1. Fetches live prices from GAS every N seconds (no overlap)
//   2. Patches only price/change/bars in DOM — no full rebuild
//   3. Flash green/red on price change via CSS class
//   4. Updates indices (Nifty, Sensex, Bank Nifty) after every fetch
//   5. GAS warmup ping every 45s — prevents cold start delay
//   6. Auto-saves fetched data to localStorage for offline load
//   7. Market hours check — no GAS calls when market is closed
//   8. Survives tab switches, theme changes, watchlist changes
//
// DEPENDENCIES (must load before this file):
//   - appstate.js   → AppState
//   - api.js        → batchFetchStocks, getEnabledGASUrls, fetchFull
//   - marketdata.js → getMarketStatus, saveToLocalCache
//   - indices.js    → updateHeaderIndices
//   - price.js      → buildDayBar, build52WBar, get52WLabel, getTargetBadge
//
// HOW TO USE:
//   In index.html — load AFTER all above files:
//   <script src="live-price.js"></script>
//   Then call: startLivePriceEngine()  ← from core.js startApp()
//   To stop:   stopLivePriceEngine()
//
// ============================================================

(function() {
  'use strict';

  // ── Private state ──────────────────────────────────────────
  let _interval     = null;   // main price refresh interval
  let _warmupTimer  = null;   // GAS warmup ping interval
  let _running      = false;  // overlap prevention flag
  let _started      = false;  // engine started flag

  // ── Config (reads from localStorage — set via Settings UI) ──
  function _getRefreshMs() {
    const sec = parseInt(localStorage.getItem('refreshSec')) || 8;
    return Math.max(6, sec) * 1000; // minimum 6s
  }

  // ── Flash effect — CSS class based (theme-safe) ────────────
  // style.css must have .flash-green and .flash-red animations
  function _flashCard(cardEl, isUp) {
    if (!cardEl) return;
    cardEl.dataset.flashing = '1'; // tells theme.js to skip this element
    cardEl.classList.remove('flash-green', 'flash-red');
    void cardEl.offsetWidth; // force reflow — restarts animation
    cardEl.classList.add(isUp ? 'flash-green' : 'flash-red');
    setTimeout(() => {
      cardEl.classList.remove('flash-green', 'flash-red');
      delete cardEl.dataset.flashing;
    }, 500);
  }

  // ── Patch single stock card in DOM (no rebuild) ────────────
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

    // Price element
    const pe = document.getElementById('price-' + sym);
    if (pe) {
      const oldPrice = parseFloat(pe.innerText.replace(/[₹,]/g, '')) || 0;

      // Flash only if price actually changed
      if (oldPrice > 0 && price > 0 && price.toFixed(2) !== oldPrice.toFixed(2)) {
        _flashCard(pe.closest('.card'), price > oldPrice);
      }

      pe.innerHTML = price > 0
        ? '₹' + price.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        : '<span style="color:#4b6280;font-size:13px;">--</span>';
    }

    // Change element
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

    // Day bar
    const db = document.getElementById('daybar-' + sym);
    if (db && typeof buildDayBar === 'function') db.innerHTML = buildDayBar(data);

    // 52W bar
    const b5 = document.getElementById('bar52-' + sym);
    if (b5 && typeof build52WBar === 'function') b5.innerHTML = build52WBar(data);

    // 52W label + target badge
    const l5 = document.getElementById('label52-' + sym);
    if (l5 && typeof get52WLabel === 'function') {
      l5.innerHTML = get52WLabel(data) + (typeof getTargetBadge === 'function' ? getTargetBadge(sym, price) : '');
    }

    // Alerts & Targets
    if (typeof checkAlerts      === 'function') checkAlerts(sym, price);
    if (typeof checkTargets     === 'function') checkTargets(sym, price);
    if (typeof checkVolumeSpike === 'function') checkVolumeSpike(sym, data);

    // Update timestamp
    if (AppState.lastUpdatedMap) AppState.lastUpdatedMap[sym] = Date.now();
  }

  // ── Patch ALL visible stocks from cache ───────────────────
  function _patchAllVisible() {
    const wl = AppState.watchlists?.[AppState.currentWL]?.stocks || [];
    const group = AppState.currentGroup;
    const groups = AppState.groups || {};

    const displayList = (group !== 'ALL' && groups[group])
      ? wl.filter(s => groups[group].includes(s))
      : wl;

    displayList.forEach(sym => {
      const data = AppState.cache[sym]?.data;
      if (data && document.getElementById('price-' + sym)) {
        _patchCard(sym, data);
      }
    });
  }

  // ── Save fetched data to localStorage ─────────────────────
  function _saveToLocalStorage(symbols) {
    if (typeof saveToLocalCache !== 'function') return;
    const toSave = {};
    symbols.forEach(sym => {
      if (AppState.cache[sym]?.data) toSave[sym] = AppState.cache[sym].data;
    });
    if (Object.keys(toSave).length > 0) saveToLocalCache(toSave);
  }

  // ── Main fetch + update cycle ─────────────────────────────
  async function _tick() {
    if (_running) return; // prevent overlap — CRITICAL
    _running = true;

    try {
      const status = getMarketStatus();

      // GIFT NIFTY — always update (runs its own logic)
      if (typeof updateGiftNifty === 'function') {
        await updateGiftNifty().catch(() => {});
      }

      if (status.open) {
        // ── MARKET OPEN: fetch fresh prices from GAS ──────────
        const wl = AppState.watchlists?.[AppState.currentWL]?.stocks || [];
        if (wl.length > 0) {
try {
  await batchFetchStocks(wl);
} catch(e) {
  console.warn('[LivePrice] GAS fetch failed:', e.message);
  // fetch fail thay to pan patch continue karse!
}

          // Save to localStorage after successful fetch
          _saveToLocalStorage(wl);
        }
      }
      // MARKET CLOSED: just patch from existing cache — no GAS call

      // ── Patch DOM (works for both open & closed) ──────────
      _patchAllVisible();

      // ── Update indices header ─────────────────────────────
      if (typeof updateHeaderIndices === 'function') updateHeaderIndices();

      // ── Update price ticker strip ─────────────────────────
      if (typeof updatePriceTicker === 'function') updatePriceTicker();

    } catch (e) {
      console.warn('[LivePrice] Tick error:', e.message);
    } finally {
      _running = false; // always release lock
    }
  }

  // ── GAS Warmup Ping — prevents cold start ─────────────────
  function _startWarmup() {
    if (_warmupTimer) clearInterval(_warmupTimer);
    _warmupTimer = setInterval(() => {
      if (!getMarketStatus().open) return; // only during market hours
      const urls = typeof getEnabledGASUrls === 'function' ? getEnabledGASUrls() : [];
      if (urls.length > 0) {
        fetch(urls[0] + '?type=ping', {
          signal: AbortSignal.timeout(3000)
        }).catch(() => {}); // silent fail — just a warmup
      }
    }, 45000); // every 45s — enough to keep GAS VM alive
  }

  // ── PUBLIC: Start the engine ──────────────────────────────
  function startLivePriceEngine() {
    if (_started) {
      console.log('[LivePrice] Already running — restart');
      stopLivePriceEngine();
    }

    _started = true;
    _running = false;

    console.log('[LivePrice] 🚀 Engine started');

    // First tick immediately
    _tick();

    // Then repeat every N seconds
    _interval = setInterval(_tick, _getRefreshMs());

    // GAS warmup
    _startWarmup();
  }

  // ── PUBLIC: Stop the engine ───────────────────────────────
  function stopLivePriceEngine() {
    if (_interval)    { clearInterval(_interval);    _interval    = null; }
    if (_warmupTimer) { clearInterval(_warmupTimer); _warmupTimer = null; }
    _running = false;
    _started = false;
    console.log('[LivePrice] 🛑 Engine stopped');
  }

  // ── PUBLIC: Restart with new interval (after settings change) ─
  function restartLivePriceEngine() {
    stopLivePriceEngine();
    startLivePriceEngine();
  }

  // ── PUBLIC: Patch visible prices (for theme toggle etc.) ──
  function patchVisiblePrices() {
    _patchAllVisible();
  }

  // ── PUBLIC: Manual refresh (bust cache + fetch fresh) ─────
  async function manualPriceFetch() {
    const wl = AppState.watchlists?.[AppState.currentWL]?.stocks || [];
    // Bust cache so batchFetchStocks fetches fresh
    wl.forEach(sym => { if (AppState.cache[sym]) AppState.cache[sym].time = 0; });
    await _tick();
  }

  // ── Register to window ────────────────────────────────────
  window.startLivePriceEngine   = startLivePriceEngine;
  window.stopLivePriceEngine    = stopLivePriceEngine;
  window.restartLivePriceEngine = restartLivePriceEngine;
  window.patchVisiblePrices     = patchVisiblePrices;
  window.manualPriceFetch       = manualPriceFetch;

  // Backward compatibility — existing code jo aa functions call kare 6e
  window.updatePrices           = _tick;
  window._patchVisibleWLPrices  = _patchAllVisible;
  window._patchWLCard           = _patchCard;

  console.log('✅ live-price.js loaded | Call startLivePriceEngine() to begin');

})(); // IIFE — no global variable pollution
