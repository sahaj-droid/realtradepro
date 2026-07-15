// ========================================
// AI CHART MODULE — v2
// TradingView Lightweight Charts + Gemini AI
// ========================================

let aiChartInstance = null;
let _aiChartSearchTimer = null;

// ======================================
// SEARCH SUGGESTIONS FOR AI CHART
// ======================================
function aiChartSuggest(val) {
  val = val.trim();
  const box = document.getElementById('aichart-sugbox');
  if (!val || val.length < 1) { if (box) box.style.display = 'none'; return; }

  const valUpper = val.toUpperCase();
  // Local quick matches from POPULAR_STOCKS
  const localMatches = (typeof POPULAR_STOCKS !== 'undefined' ? POPULAR_STOCKS : [])
    .filter(s => s.startsWith(valUpper))
    .slice(0, 5);

  if (localMatches.length > 0) {
    renderAIChartSuggestions(localMatches, box);
  }

  // Debounced remote search
  if (_aiChartSearchTimer) clearTimeout(_aiChartSearchTimer);
  _aiChartSearchTimer = setTimeout(async () => {
    try {
      const api = getActiveGASUrl();
      const r = await fetch(`${api}?type=search&q=${encodeURIComponent(val)}&_t=rtp_2026_sahaj`);
      const j = await r.json();
      if (!j.ok || !j.results || j.results.length === 0) return;
      const INDIAN_EX = new Set(['NSI','BSE','NSE','NMS']);
      const results = j.results
        .filter(r => {
          const sym = r.symbol || '';
          const exch = (r.exchange || r.exchDisp || '').toUpperCase();
          return sym.endsWith('.NS') || sym.endsWith('.BO') || INDIAN_EX.has(exch);
        })
        .map(r => r.symbol.replace('.NS','').replace('.BO',''))
        .slice(0, 7);
      if (results.length > 0) renderAIChartSuggestions(results, box);
    } catch(e) {}
  }, 300);
}

function renderAIChartSuggestions(syms, box) {
  if (!box) return;
  box.innerHTML = syms.map(s =>
    `<div onclick="selectAIChartSym('${s}')" style="padding:8px 14px;cursor:pointer;font-weight:700;font-size:13px;color:#e2e8f0;border-bottom:1px solid #1e3a5f;font-family:'JetBrains Mono',monospace;" onmouseover="this.style.background='#1e3a5f'" onmouseout="this.style.background=''">${s}</div>`
  ).join('');
  box.style.display = 'block';
}

function selectAIChartSym(sym) {
  document.getElementById('aichart-sym').value = sym;
  const box = document.getElementById('aichart-sugbox');
  if (box) box.style.display = 'none';
  loadAIChart();
}

document.addEventListener('click', e => {
  if (!e.target.closest('#aichart-search-wrap')) {
    const box = document.getElementById('aichart-sugbox');
    if (box) box.style.display = 'none';
  }
});

// ======================================
// LOAD & RENDER CHART
// ======================================
async function loadAIChart() {
  const symInput = document.getElementById('aichart-sym');
  const sym = symInput.value.trim().toUpperCase();
  if (!sym) { alert("Please enter a stock symbol."); return; }

  // Close suggestion box
  const sugbox = document.getElementById('aichart-sugbox');
  if (sugbox) sugbox.style.display = 'none';

  const container = document.getElementById('aichart-container');
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px;"><div class="spinner"></div><span style="color:#34d399;font-family:Rajdhani,sans-serif;">Fetching candles...</span></div>';
  document.getElementById('aichart-insights').style.display = 'none';
  document.getElementById('aichart-report').innerHTML = '';

  // Use 90d range for ~60 trading candles. fetchHistory caches by date so 2nd load is instant.
  let history = null;
  try {
    history = await window.fetchHistory(sym, '90d', '1d');
  } catch(err) {
    container.innerHTML = `<div style="color:#f87171;padding:10px;">❌ Error fetching data: ${err.message}</div>`;
    return;
  }

  if (!history || !history.dates || history.dates.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f87171;font-family:Rajdhani,sans-serif;">❌ Data not found for ' + sym + '. Check symbol and try again.</div>';
    return;
  }

  // Build candle + volume arrays
  const candleMap = {}, volMap = {};
  const minLen = Math.min(history.dates.length, history.close.length);

  for (let i = 0; i < minLen; i++) {
    const c  = history.close[i];
    if (c == null) continue; // Skip invalid prices

    const ts = history.dates[i];
    let t = '';
    if (typeof ts === 'number') {
      const d = new Date(ts * 1000);
      t = d.toISOString().split('T')[0];
    } else if (typeof ts === 'string') {
      if (ts.includes('-')) {
        t = ts.split('T')[0]; // Handle YYYY-MM-DD or ISO strings
      } else {
        const d = new Date(parseInt(ts) * 1000);
        t = d.toISOString().split('T')[0];
      }
    } else {
      continue; // Skip invalid dates
    }
    
    const o  = history.open[i]   || c;
    const h  = history.high[i]   || c;
    const l  = history.low[i]    || c;
    const v  = history.volume[i] || 0;
    candleMap[t] = { time: t, open: o, high: h, low: l, close: c, volume: v };
    volMap[t]    = { time: t, value: v, color: c >= o ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)' };
  }

  const candles = Object.values(candleMap).sort((a, b) => a.time.localeCompare(b.time));
  const vols    = Object.values(volMap).sort((a, b) => a.time.localeCompare(b.time));

  if (candles.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f87171;font-family:Rajdhani,sans-serif;">❌ No valid chart data found for ' + sym + '.</div>';
    return;
  }

  // Destroy old chart
  container.innerHTML = '';
  if (aiChartInstance) { aiChartInstance.remove(); aiChartInstance = null; }

  // Detect v4 vs v5 API
  const LC = window.LightweightCharts;
  if (!LC) {
    container.innerHTML = '<div style="color:#f87171;padding:16px;">❌ Chart library failed to load. Check internet connection.</div>';
    return;
  }

  const chartOpts = {
    layout:  { background: { color: '#0f1e33' }, textColor: '#94a3b8' },
    grid:    { vertLines: { color: 'rgba(30,58,95,0.5)' }, horzLines: { color: 'rgba(30,58,95,0.5)' } },
    timeScale: { timeVisible: true, borderColor: '#1e3a5f' },
    rightPriceScale: { borderColor: '#1e3a5f' },
    crosshair: { mode: 1 },
    width: container.clientWidth || 320,
    height: container.clientHeight || 320
  };

  let cs, vs;

  if (typeof LC.createChart === 'function') {
    // v4 API
    aiChartInstance = LC.createChart(container, chartOpts);
    cs = aiChartInstance.addCandlestickSeries({
      upColor:'#26a69a', downColor:'#ef5350', borderVisible:false,
      wickUpColor:'#26a69a', wickDownColor:'#ef5350'
    });
    cs.setData(candles);

    vs = aiChartInstance.addHistogramSeries({
      priceFormat: { type: 'volume' }, priceScaleId: ''
    });
    aiChartInstance.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vs.setData(vols);
    aiChartInstance.timeScale().fitContent();

  } else if (typeof LC.Chart === 'function') {
    // v5 API
    aiChartInstance = new LC.Chart(container, chartOpts);
    const pane = aiChartInstance.panes()[0];
    cs = pane.addCandlestickSeries({
      upColor:'#26a69a', downColor:'#ef5350', borderVisible:false,
      wickUpColor:'#26a69a', wickDownColor:'#ef5350'
    });
    cs.setData(candles);

    vs = pane.addHistogramSeries({
      priceFormat: { type: 'volume' }, priceScaleId: ''
    });
    aiChartInstance.timeScale().fitContent();

  } else {
    container.innerHTML = '<div style="color:#f87171;padding:16px;">❌ Chart library API not recognized.</div>';
    return;
  }

  // Responsive resize
  new ResizeObserver(entries => {
    if (!entries[0] || entries[0].target !== container) return;
    const r = entries[0].contentRect;
    aiChartInstance.applyOptions({ width: r.width, height: r.height });
  }).observe(container);


  // AI Analysis (non-blocking)
  generateAIInsights(sym, candles.slice(-60));
}

// ======================================
// GEMINI AI INSIGHTS
// ======================================
async function generateAIInsights(sym, recentData) {
  const insightsBox = document.getElementById('aichart-insights');
  const reportDiv   = document.getElementById('aichart-report');
  const loader      = document.getElementById('aichart-loading');

  insightsBox.style.display = 'block';
  loader.style.display = 'inline-block';
  reportDiv.innerHTML = '<span style="color:#64748b;font-family:Rajdhani,sans-serif;">⏳ Nivi is analyzing 60 candles + searching for latest news...</span>';

  const lastCandle  = recentData[recentData.length - 1] || {};
  const firstCandle = recentData[0] || {};
  const high60 = Math.max(...recentData.map(d => d.high)).toFixed(1);
  const low60  = Math.min(...recentData.map(d => d.low)).toFixed(1);

  // Volume stats
  const vols     = recentData.map(d => d.volume || 0).filter(v => v > 0);
  const avgVol20 = vols.length >= 20 ? Math.round(vols.slice(-20).reduce((a,b) => a+b,0)/20) : 0;
  const lastVol  = vols[vols.length-1] || 0;
  const volRatio = avgVol20 > 0 ? (lastVol/avgVol20).toFixed(2) : 'N/A';
  const volLabel = !isNaN(parseFloat(volRatio))
    ? parseFloat(volRatio) >= 2 ? '🔥 VERY HIGH' : parseFloat(volRatio) >= 1.5 ? '⬆️ HIGH' : parseFloat(volRatio) < 0.7 ? '⬇️ LOW' : '➡️ NORMAL'
    : '';

  // Last session high/low
  const lastDayHigh = lastCandle.high?.toFixed(2) || '--';
  const lastDayLow  = lastCandle.low?.toFixed(2)  || '--';

  // 30-day range
  const last30 = recentData.slice(-30);
  const h30    = Math.max(...last30.map(d => d.high)).toFixed(2);
  const l30    = Math.min(...last30.map(d => d.low)).toFixed(2);

  // Candle summary with VOLUME
  const candleLines = recentData.map(d =>
    `${d.time}|O:${d.open.toFixed(1)}|H:${d.high.toFixed(1)}|L:${d.low.toFixed(1)}|C:${d.close.toFixed(1)}|V:${Math.round((d.volume||0)/1000)}K`
  ).join('\n');

  const prompt = `You are NIVI — a sharp, experienced Indian stock market analyst (NSE/BSE specialist).

=== STOCK DATA: ${sym} ===
Period Analyzed: ${firstCandle.time} to ${lastCandle.time} (last 60 trading days)

KEY LEVELS:
- 60d High: ₹${high60} | 60d Low: ₹${low60}
- 30d High: ₹${h30} | 30d Low: ₹${l30}
- Last Session Close: ₹${lastCandle.close?.toFixed(2) || '--'}
- Last Day High: ₹${lastDayHigh} | Last Day Low: ₹${lastDayLow}

VOLUME ANALYSIS:
- Last Session Volume: ${(lastVol/1000).toFixed(1)}K shares
- 20-Day Avg Volume: ${(avgVol20/1000).toFixed(1)}K shares
- Volume Ratio (vs 20D avg): ${volRatio}x ${volLabel}

DAILY OHLCV DATA (last 60 sessions):
${candleLines}

=== YOUR TASKS ===

1. 📰 NEWS CHECK (Search Google NOW):
   - Search: "${sym} NSE stock news 2025"
   - What are the latest corporate events? (Earnings, merger, promoter activity, FII/DII buying)
   - Any upcoming results date or major announcements?

2. 📊 TECHNICAL ANALYSIS:
   - Key Support levels (2-3 levels with approximate price)
   - Key Resistance levels (2-3 levels with approximate price)
   - Moving Average: Is price above or below recent 20-day avg? Momentum direction?
   - Volume trend: Is the recent price move backed by volume or weak?
   - Any notable candle pattern in last 5 sessions? (Doji, Engulfing, etc.)

3. 📈 TREND ASSESSMENT:
   - Short-term trend (last 2 weeks): Bullish / Bearish / Sideways
   - Medium-term trend (last 60 days): Bullish / Bearish / Sideways
   - Momentum: Gaining / Losing / Neutral

4. 🎯 TRADE SETUP:
   - Action: ACCUMULATE / HOLD / AVOID / PARTIAL EXIT
   - Entry Zone: ₹___ to ₹___
   - Target 1: ₹___ | Target 2: ₹___
   - Stop Loss: ₹___
   - Risk:Reward ratio
   - Time Horizon: Short-term (days) / Medium-term (weeks)

=== FORMAT RULES ===
- Reply in clean Markdown
- Use Hinglish (Hindi + English mix preferred)
- Mobile-friendly: short lines, bullet points
- Bold key numbers and verdicts
- NO generic disclaimers, NO "consult a financial advisor"
- Be direct and confident like a real analyst`;

  try {
    // Check API key first
    const keys = window.getGeminiKeys ? window.getGeminiKeys() : [];
    if (keys.length === 0) {
      loader.style.display = 'none';
      reportDiv.innerHTML = `<div style="color:#fbbf24;font-size:13px;">
        ⚠️ Gemini API Key set karo.<br>
        <span style="color:#94a3b8;">Settings → Gemini API Key</span><br><br>
        <button onclick="tab('settings')" style="background:#1e3a5f;color:#38bdf8;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-family:Rajdhani,sans-serif;">⚙️ Settings Open Karo</button>
      </div>`;
      return;
    }

    const res = await directGeminiCall(prompt, true); // useSearch=true for Google grounding
    loader.style.display = 'none';

    if (res.ok && res.answer) {
      // Convert markdown to clean HTML
      const html = res.answer
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/^#{1,3}\s(.+)/gm, '<div style="color:#34d399;font-weight:700;margin:8px 0 4px;font-size:13px;">$1</div>')
        .replace(/^[-•]\s(.+)/gm, '<div style="margin:3px 0;padding-left:10px;">• $1</div>')
        .replace(/\n/g, '<br>');
      reportDiv.innerHTML = html;
    } else {
      // Try without search grounding as last resort
      loader.style.display = 'inline-block';
      reportDiv.innerHTML = '<span style="color:#64748b;">Search grounding failed, trying without news search...</span>';
      const res2 = await directGeminiCall(prompt, false);
      loader.style.display = 'none';
      if (res2.ok && res2.answer) {
        const html = res2.answer
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/\*(.*?)\*/g, '<i>$1</i>')
          .replace(/^#{1,3}\s(.+)/gm, '<div style="color:#34d399;font-weight:700;margin:8px 0 4px;font-size:13px;">$1</div>')
          .replace(/^[-•]\s(.+)/gm, '<div style="margin:3px 0;padding-left:10px;">• $1</div>')
          .replace(/\n/g, '<br>');
        reportDiv.innerHTML = '<div style="color:#fbbf24;font-size:11px;margin-bottom:6px;">ℹ️ News search unavailable — Technical analysis only</div>' + html;
      } else {
        reportDiv.innerHTML = '<span style="color:#f87171;">❌ All models failed. Check browser console (F12) for details.</span>';
      }
    }
  } catch (e) {
    loader.style.display = 'none';
    reportDiv.innerHTML = '<span style="color:#f87171;">❌ Error generating insights.</span>';
    console.error(e);
  }
}
