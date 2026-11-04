// ========================================
// NIVI FACTS — Verified stock facts + rule-based verdict
// Uses existing: fetchHistory, calcRSI, calcEMA, calcMACD, calcATR,
//                detectCandlePatterns, AppState.cache, window._firebaseFundCache
// Numbers & verdict are computed HERE (plain code). AI only explains them.
// Load AFTER technical.js and api.js in index.html.
// ========================================

const _nfR2 = v => (v === null || v === undefined || !isFinite(v)) ? null : Math.round(v * 100) / 100;

async function buildStockFacts(sym) {
  const cleanSym = String(sym || '').replace(/\.(NS|BO)$/i, '').trim().toUpperCase();
  const f = { sym: cleanSym, asOf: new Date().toISOString(), missing: [] };

  // 1) Live quote (already in app cache)
  const qObj = (window.AppState && AppState.cache && (AppState.cache[cleanSym] || AppState.cache[sym])) || null;
  const q = (qObj && qObj.data) ? qObj.data : null;
  const price = q && q.regularMarketPrice;
  if (!price) { f.missing.push('live price'); f.verdict = 'NO_DATA'; f.reasons = ['Live price not available']; return f; }
  f.price = _nfR2(price);
  const prev = q.chartPreviousClose || price;
  f.dayChangePct = _nfR2((price - prev) / prev * 100);
  if (q.fiftyTwoWeekHigh) f.high52 = _nfR2(q.fiftyTwoWeekHigh);
  if (q.fiftyTwoWeekLow)  f.low52  = _nfR2(q.fiftyTwoWeekLow);
  if (q.regularMarketVolume > 0 && q.averageDailyVolume3Month > 0) f.volVsAvg = _nfR2(q.regularMarketVolume / q.averageDailyVolume3Month);

  // 2) History (6mo daily) — keep OHLC aligned, drop null candles
  let hist = null;
  try { hist = await fetchHistory(cleanSym, '6mo', '1d'); } catch (e) { hist = null; }
  const C = [], H = [], L = [], O = [];
  if (hist && hist.close) {
    for (let i = 0; i < hist.close.length; i++) {
      const c = hist.close[i];
      if (c == null) continue;
      C.push(c);
      H.push(hist.high && hist.high[i] != null ? hist.high[i] : c);
      L.push(hist.low  && hist.low[i]  != null ? hist.low[i]  : c);
      O.push(hist.open && hist.open[i] != null ? hist.open[i] : c);
    }
  }
  f.candles = C.length;
  if (C.length < 50) {
    f.missing.push('price history (need 50+ daily candles, got ' + C.length + ')');
    f.verdict = 'NO_DATA';
    f.reasons = ['Not enough history for a reliable analysis'];
    return f;
  }

  // 3) Indicators (existing functions)
  const ema20 = calcEMA(C, 20), ema50 = calcEMA(C, 50);
  const rsi = calcRSI(C), atr = calcATR(H, L, C);
  const m = calcMACD(C);
  f.ema20 = ema20; f.ema50 = ema50; f.rsi = rsi; f.atr = atr;
  f.macd = m ? { trend: m.trend, histogram: m.histogram } : null;
  try { f.patterns = (detectCandlePatterns(O, H, L, C) || []).slice(0, 3); } catch (e) { f.patterns = []; }

  // 4) Trend + swing levels (last 20 sessions)
  f.trend = (price > ema20 && ema20 > ema50) ? 'UP' : (price < ema20 && ema20 < ema50) ? 'DOWN' : 'SIDEWAYS';
  f.support20 = _nfR2(Math.min(...L.slice(-20)));
  f.resistance20 = _nfR2(Math.max(...H.slice(-20)));

  // 5) Long-trade plan (ATR stop; target = recent resistance only if above price)
  if (atr) {
    f.stop = _nfR2(price - 1.5 * atr);
    if (f.resistance20 > price * 1.005) {
      f.target = f.resistance20;
      f.rr = _nfR2((f.target - price) / (price - f.stop));
    } else { f.target = null; f.rr = null; }
  }

  // 6) Fundamentals (only if present in cache)
  const fc = (window._firebaseFundCache && (window._firebaseFundCache[cleanSym] || window._firebaseFundCache[sym])) || null;
  if (fc) {
    f.fundamentals = {};
    ['pe', 'roe', 'roce', 'deRatio', 'eps', 'promoter', 'fii', 'dii'].forEach(k => {
      if (typeof fc[k] === 'number' && isFinite(fc[k]) && fc[k] !== 0) f.fundamentals[k] = _nfR2(fc[k]);
    });
  } else f.missing.push('fundamentals');

  // 7) Rule-based verdict (deterministic — AI must NOT change it)
  const why = [];
  let verdict = 'WAIT';
  if (f.trend === 'DOWN') { verdict = 'AVOID'; why.push('Downtrend (price < EMA20 < EMA50)'); }
  else if (f.rr === null || f.rr === undefined) { why.push('No clear target above price (no resistance room / breakout zone)'); }
  else if (f.rr < 1.5) { why.push('Risk:Reward ' + f.rr + ' is below 1.5'); }
  else if (rsi !== null && rsi > 75) { why.push('RSI ' + rsi + ' overbought'); }
  else if (f.trend === 'UP' && m && /bullish|buy/.test(m.trend) && !/weak/.test(m.trend)) {
    verdict = 'BUY_SETUP';
    why.push('Uptrend + MACD ' + m.trend + ' + R:R ' + f.rr);
  } else { why.push('Trend/momentum not aligned (trend ' + f.trend + ', MACD ' + (m ? m.trend : 'n/a') + ')'); }
  f.verdict = verdict;
  f.reasons = why;
  return f;
}

// Text block to paste into the AI prompt (used in Chunk 2)
function factsToPromptBlock(f) {
  return '[VERIFIED DATA — computed by the app, do not change or invent numbers]\n' +
         JSON.stringify(f) +
         '\nVerdict above is rule-based. Explain it; never override it. If a field is missing, say so.';
}

window.buildStockFacts = buildStockFacts;
window.factsToPromptBlock = factsToPromptBlock;
console.log('✅ Nivi Facts Module Loaded');
