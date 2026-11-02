// ========================================
// DETAIL MODAL MODULE — RealTradePro v3.0
// Handles: Full-page stock & index detail view, Interactive chart,
// Range sliders, Quick links, Index composition, Smart alerts
// ========================================

let _detailChartInstance = null;
let _currentDetailSym = null;
let _currentDetailPrice = 0;

// ======================================
// RENDER DETAIL CANDLESTICK CHART
// ======================================
function _renderDetailChart(sym, history) {
  const container = document.getElementById("d-chart");
  if (!container) return;
  container.innerHTML = "";

  const LC = window.LightweightCharts;
  if (!LC) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8b9bb2;font-size:11px;">Chart library loading...</div>';
    return;
  }

  if (_detailChartInstance) {
    try { _detailChartInstance.remove(); } catch(e) {}
    _detailChartInstance = null;
  }

  if (!history || !history.dates || !history.close || history.close.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8b9bb2;font-size:11px;">Candlestick data loading or unavailable</div>';
    return;
  }

  const w = container.clientWidth || 340;
  const h = container.clientHeight || 220;

  const chartOpts = {
    width: w,
    height: h,
    layout: {
      background: { type: 'solid', color: '#0c1523' },
      textColor: '#8b9bb2',
      fontFamily: "'JetBrains Mono', 'Rajdhani', monospace",
      fontSize: 10
    },
    grid: {
      vertLines: { color: 'rgba(38, 53, 75, 0.35)', style: 1 },
      horzLines: { color: 'rgba(38, 53, 75, 0.35)', style: 1 }
    },
    rightPriceScale: {
      borderColor: '#1e2d42',
      scaleMargins: { top: 0.12, bottom: 0.12 }
    },
    timeScale: {
      borderColor: '#1e2d42',
      timeVisible: true,
      secondsVisible: false
    },
    crosshair: {
      mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0
    }
  };

  try {
    const chart = LC.createChart(container, chartOpts);
    _detailChartInstance = chart;

    // Build unique sorted candle array
    const candleMap = {};
    const minLen = Math.min(history.dates.length, history.close.length);

    for (let i = 0; i < minLen; i++) {
      const c = history.close[i];
      if (c == null) continue;
      const ts = history.dates[i];
      let t = '';
      if (typeof ts === 'number') {
        t = new Date(ts > 1e11 ? ts : ts * 1000).toISOString().split('T')[0];
      } else if (typeof ts === 'string') {
        t = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
      }
      if (!t) continue;

      const o = (history.open && history.open[i] != null) ? history.open[i] : c;
      const hi = (history.high && history.high[i] != null) ? history.high[i] : Math.max(o, c);
      const lo = (history.low && history.low[i] != null) ? history.low[i] : Math.min(o, c);
      candleMap[t] = { time: t, open: o, high: hi, low: lo, close: c };
    }

    const candles = Object.values(candleMap).sort((a, b) => a.time.localeCompare(b.time));

    if (candles.length > 0) {
      const series = chart.addCandlestickSeries({
        upColor: '#24d6a0',
        downColor: '#ff7180',
        borderVisible: false,
        wickUpColor: '#24d6a0',
        wickDownColor: '#ff7180'
      });
      series.setData(candles);
      chart.timeScale().fitContent();
    } else {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8b9bb2;font-size:11px;">No candles available for this period</div>';
    }
  } catch (err) {
    console.warn('Error creating detail chart:', err);
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8b9bb2;font-size:11px;">Chart preview unavailable</div>';
  }
}

// Window resize handler for detail chart
window.addEventListener('resize', () => {
  if (_detailChartInstance) {
    const container = document.getElementById("d-chart");
    if (container && container.clientWidth) {
      _detailChartInstance.applyOptions({ width: container.clientWidth });
      _detailChartInstance.timeScale().fitContent();
    }
  }
});

// ======================================
// OPEN FULL-PAGE STOCK DETAIL
// ======================================
async function openDetail(sym, isIndex) {
  _currentDetailSym = sym;
  
  const detailModal = document.getElementById("detailModal");
  if (detailModal) {
    detailModal.classList.remove("hidden");
    detailModal.classList.add("open");
    detailModal.style.display = "flex";
  }
  document.body.style.overflow = 'hidden';

  const dTitle = document.getElementById("d-title");
  if (dTitle) dTitle.innerText = sym;

  const dCompName = document.getElementById("d-comp-name");
  let compName = sym;
  if (typeof _getCompanyDisplayName === 'function') {
    compName = _getCompanyDisplayName(sym, AppState.cache[sym]?.data);
  }
  if (dCompName) dCompName.innerText = compName;

  const dExchBadge = document.getElementById("d-exch-badge");
  if (dExchBadge) dExchBadge.innerText = isIndex ? 'INDEX' : 'NSE';

  // Reset tab to price
  switchDetailTab('price');

  // Reset loading states
  const dHdrPrice = document.getElementById("d-hdr-price");
  const dHdrChange = document.getElementById("d-hdr-change");
  const dBigPrice = document.getElementById("d-big-price");
  const dBigChange = document.getElementById("d-big-change");
  const dBody = document.getElementById("d-body");
  const chartDiv = document.getElementById("d-chart");
  const fs = document.getElementById("fundamentalsSection");
  const ts = document.getElementById("techSection");
  const smartAlertSection = document.getElementById("smartAlertSection");
  const bbSection = document.getElementById("bbSection");
  const quickLinksSection = document.getElementById("quickLinksSection");

  if (dHdrPrice) dHdrPrice.innerText = "--";
  if (dHdrChange) dHdrChange.innerHTML = `<span style="color:#8b9bb2;">--</span>`;
  if (dBigPrice) dBigPrice.innerText = "--";
  if (dBigChange) dBigChange.innerHTML = `<span style="font-size:11px;color:#8b9bb2;">Loading quote...</span>`;
  if (dBody) dBody.innerHTML = '<div style="font-size:11px;color:#8b9bb2;text-align:center;padding:16px;">Loading market metrics...</div>';
  if (chartDiv) chartDiv.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8b9bb2;font-size:11px;">Loading candlestick chart...</div>';
  if (fs) fs.innerHTML = '<div style="font-size:10px;color:#8b9bb2;text-align:center;padding:14px;">Loading fundamentals...</div>';
  if (ts) ts.innerHTML = '<div style="font-size:10px;color:#8b9bb2;text-align:center;padding:14px;">Loading technical data...</div>';
  if (smartAlertSection) smartAlertSection.innerHTML = '';
  if (bbSection) bbSection.innerHTML = '';
  if (quickLinksSection) quickLinksSection.innerHTML = '';

  AppState._bbSym = sym;

  // TradingView buttons
  const tvBtn = document.getElementById("d-tv-btn");
  if (tvBtn) tvBtn.onclick = () => chart(sym, isIndex ? true : false);
  const tvBtn2 = document.getElementById("d-tv-btn2");
  if (tvBtn2) tvBtn2.onclick = () => chart(sym, isIndex ? true : false);

  // Resolve cached or live data
  let d = AppState.cache[sym]?.data;
  if (!d && (sym === 'NIFTY1!' || sym === 'GIFT NIFTY')) {
    d = AppState.cache['__GIFT__']?.data || AppState.cache['NIFTY1!']?.data;
  }
  if (!d) {
    try {
      d = await fetchFull(sym, isIndex);
    } catch (e) {
      console.warn('fetchFull error for', sym, e);
    }
  }

  if (d) {
    const price = d.regularMarketPrice || d.ltp || 0;
    _currentDetailPrice = price;
    const prev = d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || 0;
    const diff = d.regularMarketChange || ((price && prev) ? parseFloat((price - prev).toFixed(2)) : 0);
    const pct = d.regularMarketChangePercent || ((prev > 0 && diff) ? parseFloat((diff / prev * 100).toFixed(2)) : 0);
    const isUp = diff >= 0;
    const sign = isUp ? '+' : '';
    const upDownColor = isUp ? '#24d6a0' : '#ff7180';
    const badgeBg = isUp ? '#153a31' : '#3b202b';

    // Update Company Name with fresh data
    if (dCompName && typeof _getCompanyDisplayName === 'function') {
      dCompName.innerText = _getCompanyDisplayName(sym, d);
    }

    // Header live prices
    if (dHdrPrice) dHdrPrice.innerText = price > 0 ? '₹' + price.toFixed(2) : '--';
    if (dHdrChange) {
      dHdrChange.innerHTML = `<span style="color:${upDownColor};">${isUp ? '▲' : '▼'} ${sign}${Math.abs(pct).toFixed(2)}%</span>`;
    }

    // Hero Card Prices
    if (dBigPrice) dBigPrice.innerText = price > 0 ? '₹' + price.toFixed(2) : '--';
    if (dBigChange) {
      dBigChange.innerHTML = `
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;background:${badgeBg};color:${upDownColor};display:inline-flex;align-items:center;gap:4px;">
          ${isUp ? '▲ +' : '▼ '}${Math.abs(diff).toFixed(2)} (${sign}${pct.toFixed(2)}%) Today
        </span>`;
    }

    // Sliders & Range Calculations
    const dayHigh = d.regularMarketDayHigh || price;
    const dayLow = d.regularMarketDayLow || price;
    let dayPct = 50;
    if (dayHigh > dayLow && price >= dayLow) {
      dayPct = Math.min(100, Math.max(0, ((price - dayLow) / (dayHigh - dayLow)) * 100));
    }

    const w52High = d.fiftyTwoWeekHigh || price;
    const w52Low = d.fiftyTwoWeekLow || price;
    let w52Pct = 50;
    if (w52High > w52Low && price >= w52Low) {
      w52Pct = Math.min(100, Math.max(0, ((price - w52Low) / (w52High - w52Low)) * 100));
    }

    const openPrice = (d.regularMarketOpen && d.regularMarketOpen > 1) ? d.regularMarketOpen : prev;

    if (dBody) {
      dBody.innerHTML = `
        <div style="background:linear-gradient(150deg,#142136,#101a29);border:1px solid #26354b;border-radius:16px;padding:14px;margin-bottom:12px;">
          <!-- Day Range Slider -->
          <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#8b9bb2;margin-bottom:4px;font-weight:600;">
              <span>Low</span>
              <span style="color:#f0f5ff;font-weight:700;">Day's Range</span>
              <span>High</span>
            </div>
            <div style="position:relative;height:5px;background:#0c1523;border-radius:6px;margin:8px 0;">
              <div style="position:absolute;left:0;width:${dayPct}%;height:100%;background:linear-gradient(90deg,#ff7180,#24d6a0);border-radius:6px;"></div>
              <div style="position:absolute;left:${dayPct}%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;background:#ffffff;border:2px solid #24d6a0;border-radius:50%;box-shadow:0 0 6px rgba(36,214,160,0.8);"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;">
              <span style="color:#ff7180;">₹${dayLow.toFixed(2)}</span>
              <span style="color:#f0f5ff;font-size:11px;">₹${price.toFixed(2)}</span>
              <span style="color:#24d6a0;">₹${dayHigh.toFixed(2)}</span>
            </div>
          </div>

          <!-- 52W Range Slider -->
          <div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#8b9bb2;margin-bottom:4px;font-weight:600;">
              <span>52W Low</span>
              <span style="color:#f0f5ff;font-weight:700;">52-Week Range</span>
              <span>52W High</span>
            </div>
            <div style="position:relative;height:5px;background:#0c1523;border-radius:6px;margin:8px 0;">
              <div style="position:absolute;left:0;width:${w52Pct}%;height:100%;background:linear-gradient(90deg,#ff7180,#24d6a0);border-radius:6px;"></div>
              <div style="position:absolute;left:${w52Pct}%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;background:#ffffff;border:2px solid #24d6a0;border-radius:50%;box-shadow:0 0 6px rgba(36,214,160,0.8);"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;">
              <span style="color:#ff7180;">₹${w52Low.toFixed(2)}</span>
              <span style="color:#f0f5ff;font-size:11px;">₹${price.toFixed(2)}</span>
              <span style="color:#24d6a0;">₹${w52High.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Open & Previous Close Stats Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:10px;color:#8b9bb2;font-weight:600;">OPEN</span>
            <span style="font-size:13px;font-weight:800;color:#f0f5ff;font-family:'JetBrains Mono',monospace;">₹${openPrice.toFixed(2)}</span>
          </div>
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:10px;color:#8b9bb2;font-weight:600;">PREV CLOSE</span>
            <span style="font-size:13px;font-weight:800;color:#f0f5ff;font-family:'JetBrains Mono',monospace;">₹${prev.toFixed(2)}</span>
          </div>
        </div>`;
    }

    // Bottom Action Bar Buttons
    const btnBuy = document.getElementById("d-btn-buy");
    const btnSell = document.getElementById("d-btn-sell");
    const btnAlert = document.getElementById("d-btn-alert");
    const btnTarget = document.getElementById("d-btn-target");
    const btnNivi = document.getElementById("d-btn-nivi");

    if (btnBuy) {
      btnBuy.style.display = isIndex ? 'none' : 'block';
      btnBuy.onclick = () => {
        closeDetail();
        if (typeof openModal === 'function') openModal('BUY', sym, price);
      };
    }
    if (btnSell) {
      btnSell.style.display = isIndex ? 'none' : 'block';
      btnSell.onclick = () => {
        closeDetail();
        if (typeof openModal === 'function') openModal('SELL', sym, price);
      };
    }
    if (btnAlert) {
      btnAlert.onclick = () => {
        if (typeof setAlert === 'function') setAlert(sym);
      };
    }
    if (btnTarget) {
      btnTarget.onclick = () => {
        if (typeof setTarget === 'function') setTarget(sym, price);
      };
    }
    if (btnNivi) {
      btnNivi.onclick = () => {
        if (typeof openNivi === 'function') openNivi(sym);
      };
    }

  } else {
    if (dBody) {
      dBody.innerHTML = '<div style="font-size:11px;color:#f59e0b;text-align:center;padding:16px;">Live quote temporarily unavailable for ' + sym + '</div>';
    }
  }

  // Fetch History for Chart & Technicals
  fetchHistory(sym, '60d', '1d').then(hist => {
    // Render Candlestick Chart
    _renderDetailChart(sym, hist);

    if (!isIndex) {
      // Technical Tab for Stocks
      const ts = document.getElementById("techSection");
      if (!ts) return;
      if (!hist || !hist.close || hist.close.length === 0) {
        ts.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:4px;">Technical data unavailable</div>';
        return;
      }

      const closes = hist.close.filter(v => v != null);
      const highs = hist.high ? hist.high.filter(v => v != null) : closes;
      const lows = hist.low ? hist.low.filter(v => v != null) : closes;
      const rsi = (typeof calcRSI === 'function') ? calcRSI(closes) : null;
      const macd = (typeof calcMACD === 'function') ? calcMACD(closes) : null;
      const insideBar = (typeof detectInsideBar === 'function') ? detectInsideBar(highs, lows) : false;
      const narrowRange = (typeof detectNarrowRange === 'function') ? detectNarrowRange(highs, lows) : false;
      const atr = (typeof calcATR === 'function') ? calcATR(highs, lows, closes) : null;
      const vols = (hist.volume || []).filter(v => v != null);
      const todayVol = vols[vols.length - 1] || 0;
      const avgVol10 = vols.length >= 10 ? vols.slice(-10).reduce((a, b) => a + b, 0) / 10 : null;
      const volRatio = avgVol10 && avgVol10 > 0 ? parseFloat((todayVol / avgVol10).toFixed(2)) : null;
      const volColor = volRatio ? volRatio >= 2 ? '#a78bfa' : volRatio >= 1.5 ? '#38bdf8' : volRatio >= 1 ? '#94a3b8' : '#4b6280' : '#4b6280';
      const volLabel = volRatio ? volRatio >= 2 ? 'Very High' : volRatio >= 1.5 ? 'High' : volRatio >= 1 ? 'Normal' : 'Low' : '--';

      const price = _currentDetailPrice || (AppState.cache[sym]?.data?.regularMarketPrice || 0);
      const atrPct = atr && price > 0 ? parseFloat((atr / price * 100).toFixed(2)) : null;
      const rsiColor = rsi ? rsi < 30 ? '#24d6a0' : rsi > 70 ? '#ff7180' : '#91aaff' : '#8b9bb2';
      const macdColor = macd ? (macd.trend === 'bullish' ? '#24d6a0' : '#ff7180') : '#8b9bb2';
      const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px;flex-shrink:0;"></span>`;
      const iBtn = (key) => (typeof window.iBtn === 'function') ? window.iBtn(key) : '';
      const dmaKey = (l) => l.includes('20') ? 'DMA20' : l.includes('50') ? 'DMA50' : 'DMA200';
      const maRow = (label, val) => val ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:11px;color:#94a3b8;display:flex;align-items:center;">${dot(price >= val ? '#22c55e' : '#ef4444')}${label}${iBtn(dmaKey(label))}</span>
        <span style="font-size:11px;font-weight:700;color:${price >= val ? '#22c55e' : '#ef4444'};">₹${val.toFixed(2)} ${price >= val ? '▲' : '▼'}</span>
      </div>` : '';

      const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
      const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;

      ts.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TECHNICAL INDICATORS (60D)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;display:flex;align-items:center;">${dot(rsiColor)}RSI (14)${iBtn('RSI')}</div><div style="font-size:13px;font-weight:700;color:${rsiColor};white-space:nowrap;">${rsi ? rsi.toFixed(1) : '--'} <span style="font-size:9px;">${rsi ? rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral' : ''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;display:flex;align-items:center;justify-content:flex-end;">${dot(macdColor)}MACD${iBtn('MACD')}</div><div style="font-size:13px;font-weight:700;color:${macdColor};white-space:nowrap;">${macd ? macd.macd : '--'} <span style="font-size:9px;">${macd ? macd.trend : ''}</span></div></div>
          </div>
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;">
            <div style="font-size:9px;color:#4b6280;margin-bottom:4px;">MOVING AVERAGES vs CMP ₹${price.toFixed(0)}</div>
            ${maRow('DMA 20', ma20)}
            ${maRow('DMA 50', ma50)}
            ${maRow('DMA 200', ma200)}
          </div>
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">ATR (14)</div><div style="font-size:13px;font-weight:700;color:#f59e0b;">${atr ? '₹' + atr : '--'} <span style="font-size:9px;color:#94a3b8;">${atrPct ? '(' + atrPct + '%)' : ''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">VOLUME</div><div style="font-size:13px;font-weight:700;color:${volColor};">${volLabel} <span style="font-size:9px;">${volRatio ? volRatio + 'x' : ''}</span></div></div>
          </div>
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">INSIDE BAR${iBtn('INSIDE')}</div><div style="font-size:12px;font-weight:700;color:${insideBar ? '#f59e0b' : '#4b6280'};">${insideBar ? 'Yes' : 'No'}</div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">NARROW RANGE${iBtn('NARROW')}</div><div style="font-size:12px;font-weight:700;color:${narrowRange ? '#f59e0b' : '#4b6280'};">${narrowRange ? 'Yes' : 'No'}</div></div>
          </div>
          ${(() => {
            if (typeof detectCandlePatterns !== 'function') return '';
            const _op = hist.open ? hist.open.filter(v => v != null) : closes;
            const _pats = detectCandlePatterns(_op, highs, lows, closes);
            if (!_pats.length) return '';
            return `<div style="background:#0a1628;border-radius:6px;padding:6px 10px;">
              <div style="font-size:9px;color:#4b6280;margin-bottom:5px;letter-spacing:0.5px;">CANDLESTICK PATTERNS</div>
              ${_pats.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                <span style="font-size:11px;font-weight:700;color:${p.color};">${p.signal === 'bullish' ? '▲' : p.signal === 'bearish' ? '▼' : '◆'} ${p.name}</span>
                <span style="font-size:9px;color:#94a3b8;text-align:right;max-width:55%;line-height:1.3;">${p.desc}</span>
              </div>`).join('')}
            </div>`;
          })()}
        </div>`;
    } else {
      // Technical Tab for Indices
      const ts = document.getElementById("techSection");
      if (!ts) return;
      if (!hist || !hist.close || hist.close.length === 0) {
        ts.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Technical data unavailable for this index.</div>';
        return;
      }
      const closes = hist.close.filter(v => v != null);
      const rsi = (typeof calcRSI === 'function') ? calcRSI(closes) : null;
      const macd = (typeof calcMACD === 'function') ? calcMACD(closes) : null;
      const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
      const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;
      const price = _currentDetailPrice || 0;
      const rsiColor = rsi ? rsi < 30 ? '#24d6a0' : rsi > 70 ? '#ff7180' : '#91aaff' : '#8b9bb2';
      const macdColor = macd ? (macd.trend === 'bullish' ? '#24d6a0' : '#ff7180') : '#8b9bb2';
      const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px;flex-shrink:0;"></span>`;
      const iBtn = (key) => (typeof window.iBtn === 'function') ? window.iBtn(key) : '';
      const dmaKey = (l) => l.includes('20') ? 'DMA20' : l.includes('50') ? 'DMA50' : 'DMA200';
      const maRow = (label, val) => val ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:11px;color:#94a3b8;display:flex;align-items:center;">${dot(price >= val ? '#22c55e' : '#ef4444')}${label}${iBtn(dmaKey(label))}</span>
        <span style="font-size:11px;font-weight:700;color:${price >= val ? '#22c55e' : '#ef4444'};">₹${val.toFixed(2)} ${price >= val ? '▲' : '▼'}</span>
      </div>` : '';

      ts.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">INDEX TECHNICALS (60D)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">RSI (14)${iBtn('RSI')}</div><div style="font-size:13px;font-weight:700;color:${rsiColor};white-space:nowrap;">${rsi || '--'} <span style="font-size:9px;">${rsi ? rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral' : ''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">MACD${iBtn('MACD')}</div><div style="font-size:13px;font-weight:700;color:${macdColor};white-space:nowrap;">${macd ? macd.macd : '--'} <span style="font-size:9px;">${macd ? macd.trend : ''}</span></div></div>
          </div>
          <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;">
            <div style="font-size:9px;color:#4b6280;margin-bottom:4px;">MOVING AVERAGES vs CMP ₹${price.toFixed(0)}</div>
            ${maRow('DMA 20', ma20)}
            ${maRow('DMA 50', ma50)}
            ${maRow('DMA 200', ma200)}
          </div>
        </div>`;
    }
  }).catch(e => {
    console.warn('fetchHistory error:', e);
  });

  if (!isIndex) {
    if (typeof renderSmartAlertSuggestions === 'function') {
      renderSmartAlertSuggestions(sym, d);
    }
    renderQuickLinks(sym, isIndex);

    // Fundamentals for Stocks
    const _cachedFund = (() => {
      try {
        const s = JSON.parse(localStorage.getItem('fundCache6_' + sym) || 'null');
        return s && s.data ? s.data : null;
      } catch (e) { return null; }
    })();

    if (_cachedFund && fs) {
      _renderFundamentalsHTML(fs, _cachedFund, true, sym);
    }

    if (typeof fetchFundamentals === 'function') {
      fetchFundamentals(sym).then(fund => {
        if (fs && fund) {
          _renderFundamentalsHTML(fs, fund, false, sym);
        } else if (fs && !_cachedFund) {
          fs.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Fundamentals unavailable — will retry on next open</div>';
        }
      }).catch(() => {});
    }
  } else {
    // Composition for Indices
    if (fs) renderIndexComposition(sym, fs);
    renderQuickLinks(sym, isIndex);
  }
}

// ======================================
// CLOSE DETAIL MODAL
// ======================================
function closeDetail() {
  const detailModal = document.getElementById("detailModal");
  if (detailModal) {
    detailModal.classList.add("hidden");
    detailModal.classList.remove("open");
    detailModal.style.display = "none";
  }
  document.body.style.overflow = '';
  if (_detailChartInstance) {
    try { _detailChartInstance.remove(); } catch(e) {}
    _detailChartInstance = null;
  }
}

// ======================================
// SWITCH DETAIL TAB (Price/Fund/Tech/BB/Links)
// ======================================
function switchDetailTab(tab) {
  const tabs = ['price', 'tech', 'fund', 'bb', 'links'];
  tabs.forEach(t => {
    const el = document.getElementById('dtab-' + t);
    const btn = document.getElementById('dtab-btn-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      if (t === tab) {
        btn.classList.add('active');
        btn.style.background = '#2a3d5e';
        btn.style.color = '#ffffff';
        btn.style.fontWeight = '700';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#8b9bb2';
        btn.style.fontWeight = '600';
      }
    }
  });

  if (tab === 'bb' && AppState._bbSym && typeof renderBollinger === 'function') {
    renderBollinger(AppState._bbSym);
  }

  if (tab === 'price' && _detailChartInstance) {
    setTimeout(() => {
      const c = document.getElementById("d-chart");
      if (c && c.clientWidth && _detailChartInstance) {
        _detailChartInstance.applyOptions({ width: c.clientWidth });
        _detailChartInstance.timeScale().fitContent();
      }
    }, 60);
  }
}

// ======================================
// RENDER FUNDAMENTALS HTML
// ======================================
function _renderFundamentalsHTML(fs, fund, isCached, sym) {
  if (!fs || !fund) return;
  const iBtn = (key) => (typeof window.iBtn === 'function') ? window.iBtn(key) : '';
  const fpe_v = fund.forwardPE || '--';
  const feps_v = fund.forwardEps || '--';
  const bv_v = fund.bookValue || '--';
  const dy_v = fund.divYield || '--';
  const ed_v = fund.earningsDate || '--';
  const exd_v = fund.exDivDate || '--';
  const cacheLabel = isCached ? '<span style="font-size:8px;color:#4b6280;font-weight:400;margin-left:4px;">(cached)</span>' : '';

  fs.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">FUNDAMENTALS${cacheLabel}</div>
    <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">
      <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">P/E (TTM)${iBtn('PE')}</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.pe || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">FORWARD P/E</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fpe_v}</div></div>
      </div>
      <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">EPS (TTM)${iBtn('EPS')}</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.eps || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">FORWARD EPS</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${feps_v}</div></div>
      </div>
      <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">MKT CAP</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.marketCap || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">BOOK VALUE</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${bv_v}</div></div>
      </div>
      <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">VOLUME</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.volume || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">DIV YIELD</div><div style="font-size:11px;font-weight:700;white-space:nowrap;color:${dy_v !== '--' ? '#22c55e' : '#e2e8f0'};">${dy_v}</div></div>
      </div>
    </div>
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">DIVIDENDS & EARNINGS</div>
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <div style="flex:1;background:#0a1628;border-radius:6px;padding:6px 8px;border:1px solid rgba(245,158,11,0.2);">
        <div style="font-size:9px;color:#4b6280;">NEXT EARNINGS</div>
        <div style="font-size:11px;font-weight:700;color:${ed_v !== '--' ? '#f59e0b' : '#e2e8f0'};">${ed_v}</div>
      </div>
      <div style="flex:1;background:#0a1628;border-radius:6px;padding:6px 8px;border:1px solid rgba(34,197,94,0.2);">
        <div style="font-size:9px;color:#4b6280;">EX-DIV DATE</div>
        <div style="font-size:11px;font-weight:700;color:${exd_v !== '--' ? '#22c55e' : '#e2e8f0'};">${exd_v}</div>
      </div>
    </div>
    ${(typeof _buildSRBlock === 'function') ? _buildSRBlock(sym) : ''}`;
}

// ======================================
// RENDER QUICK LINKS
// ======================================
function renderQuickLinks(sym, isIndex) {
  const el = document.getElementById('quickLinksSection');
  if (!el) return;

  if (isIndex) {
    const tvSym = sym === '^NSEI' ? 'NSE:NIFTY50' : sym === '^BSESN' ? 'BSE:SENSEX' : sym === '^NSEBANK' ? 'NSE:BANKNIFTY' : 'NSE:NIFTY50';
    el.innerHTML = `
      <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">QUICK LINKS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
        <button onclick="window.open('https://www.nseindia.com/market-data/live-market-indices','_blank')" style="background:#111d2d;color:#91aaff;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">NSE Indices</button>
        <button onclick="window.open('https://www.moneycontrol.com/markets/indian-indices/','_blank')" style="background:#111d2d;color:#fb923c;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">MC</button>
        <button onclick="window.open('https://www.tradingview.com/chart/?symbol=${tvSym}','_blank')" style="background:#111d2d;color:#24d6a0;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">TradingView</button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">QUICK LINKS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;">
      <button onclick="window.open('https://www.nseindia.com/get-quotes/equity?symbol=${sym}','_blank')" style="background:#111d2d;color:#91aaff;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">NSE</button>
      <button onclick="window.open('https://www.bseindia.com/stock-share-price/${sym}/','_blank')" style="background:#111d2d;color:#fcd34d;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">BSE</button>
      <button onclick="window.open('https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=${sym}','_blank')" style="background:#111d2d;color:#c4b5fd;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Filings</button>
      <button onclick="window.open('https://www.screener.in/company/${sym}/','_blank')" style="background:#111d2d;color:#24d6a0;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Screener</button>
      <button onclick="window.open('https://www.moneycontrol.com/india/stockpricequote/${sym}','_blank')" style="background:#111d2d;color:#fb923c;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">MC</button>
      <button onclick="window.open('https://www.tickertape.in/stocks/${sym}','_blank')" style="background:#111d2d;color:#ff7180;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Ticker</button>
      <button onclick="window.open('https://tijorifinance.com/company/${sym}','_blank')" style="background:#111d2d;color:#24d6a0;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Tijori</button>
      <button onclick="window.open('https://chartink.com/stocks/${sym}.html','_blank')" style="background:#111d2d;color:#fcd34d;border:1px solid #26354b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Chartink</button>
    </div>`;
}

// ======================================
// RENDER INDEX COMPOSITION
// ======================================
function renderIndexComposition(sym, el) {
  const comp = (typeof INDEX_COMPOSITION !== 'undefined') ? INDEX_COMPOSITION[sym] : null;
  if (!comp) {
    el.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:8px;">Composition data not available for this index.</div>';
    return;
  }

  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TOP CONSTITUENTS</div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      ${comp.map((c, i) => `
        <div style="background:#111d2d;border:1px solid #26354b;border-radius:12px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:10px;color:#4b6280;font-weight:700;width:14px;">${i + 1}</span>
            <span style="font-size:12px;font-weight:700;color:#e2e8f0;">${c.name}</span>
          </div>
          <span style="font-size:12px;font-weight:700;color:#34d399;">${c.wt}</span>
        </div>`).join('')}
      <div style="font-size:9px;color:#4b6280;text-align:center;padding:4px;">Approximate weightings — indicative only</div>
    </div>`;
}

// ======================================
// OPEN NEWS
// ======================================
function openNews(sym) {
  const query = encodeURIComponent(sym + ' stock NSE');
  window.open(`https://economictimes.indiatimes.com/searchresult.cms?query=${query}`);
}

// ======================================
// OPEN STOCK DETAIL ALIAS
// ======================================
function openStockDetail(sym) {
  openDetail(sym, false);
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.openDetail = openDetail;
window.closeDetail = closeDetail;
window.switchDetailTab = switchDetailTab;
window.renderQuickLinks = renderQuickLinks;
window.renderIndexComposition = renderIndexComposition;
window.openNews = openNews;
window.openStockDetail = openStockDetail;

console.log('✅ detail-modal.js loaded successfully (Full-Page View)');
