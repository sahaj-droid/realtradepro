// ========================================
// TECHNICAL MODULE — RealTradePro v3.0
// Handles: RSI, MACD, Bollinger Bands, ATR, Candlestick Patterns, Technical Indicators
// ========================================
// ======================================
// RSI (14-period)
// ======================================
function calcRSI(closes, period=14){
  if(!closes||closes.length<period+1) return null;
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){
    const diff=closes[i]-closes[i-1];
    if(diff>=0) gains+=diff; else losses+=Math.abs(diff);
  }
  let avgGain=gains/period, avgLoss=losses/period;
  for(let i=period+1;i<closes.length;i++){
    const diff=closes[i]-closes[i-1];
    const gain=diff>=0?diff:0;
    const loss=diff<0?Math.abs(diff):0;
    avgGain=(avgGain*(period-1)+gain)/period;
    avgLoss=(avgLoss*(period-1)+loss)/period;
  }
  if(avgLoss===0) return 100;
  const rs=avgGain/avgLoss;
  return parseFloat((100-(100/(1+rs))).toFixed(2));
}

// ======================================
// EMA (Exponential Moving Average)
// ======================================
function calcEMA(data, period){
  if(!data||data.length<period) return null;
  const k=2/(period+1);
  let ema=data.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<data.length;i++){
    ema=data[i]*k+ema*(1-k);
  }
  return parseFloat(ema.toFixed(2));
}

// ======================================
// MACD (12,26,9)
// ======================================
function calcMACD(closes){
  if(!closes||closes.length<35) return null;

  const macdSeries = [];
  for(let offset = 9; offset >= 0; offset--){
    const slice = closes.slice(0, closes.length - offset);
    if(slice.length < 26) continue;
    const e12 = calcEMA(slice, 12);
    const e26 = calcEMA(slice, 26);
    if(e12 && e26) macdSeries.push(e12 - e26);
  }
  if(macdSeries.length < 2) return null;

  const macdLine = parseFloat(macdSeries[macdSeries.length - 1].toFixed(2));
  const prevMacd = macdSeries[macdSeries.length - 2];
  const signalLine = parseFloat(calcEMA(macdSeries, Math.min(9, macdSeries.length)).toFixed(2));
  const histogram = parseFloat((macdLine - signalLine).toFixed(2));
  const aboveZero = macdLine > 0;
  const aboveSignal = macdLine > signalLine;
  const bullishCross = prevMacd < signalLine && macdLine > signalLine;
  const bearishCross = prevMacd > signalLine && macdLine < signalLine;

  let signal = '';
  if(bullishCross) signal = aboveZero ? 'strong buy' : 'buy';
  else if(bearishCross) signal = aboveZero ? 'sell' : 'strong sell';
  else if(aboveSignal) signal = aboveZero ? 'bullish' : 'weak bullish';
  else signal = aboveZero ? 'weak bearish' : 'bearish';

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
    trend: signal,
    bullishCross,
    bearishCross
  };
}

// ======================================
// ATR (14-period Average True Range)
// ======================================
function calcATR(highs, lows, closes, period=14) {
  if (!highs || highs.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hpc = Math.abs(highs[i] - closes[i-1]);
    const lpc = Math.abs(lows[i] - closes[i-1]);
    trs.push(Math.max(hl, hpc, lpc));
  }
  let atr = trs.slice(0, period).reduce((a,b) => a+b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return parseFloat(atr.toFixed(2));
}

// ======================================
// INSIDE BAR DETECTION
// ======================================
function detectInsideBar(highs, lows){
  if(!highs||highs.length<2) return false;
  const n=highs.length;
  return highs[n-1]<highs[n-2] && lows[n-1]>lows[n-2];
}

// ======================================
// NARROW RANGE DETECTION (NR7)
// ======================================
function detectNarrowRange(highs, lows, threshold=1.5){
  if(!highs||highs.length<1) return false;
  const n=highs.length;
  const range=((highs[n-1]-lows[n-1])/lows[n-1]*100);
  return range<threshold;
}

// ======================================
// CANDLESTICK PATTERN DETECTOR
// ======================================
function detectCandlePatterns(opens, highs, lows, closes) {
  if (!opens || opens.length < 3) return [];
  const patterns = [];
  const n = closes.length;
  const o = opens, h = highs, l = lows, c = closes;

  const bodySize = (i) => Math.abs(c[i] - o[i]);
  const range = (i) => h[i] - l[i];
  const isGreen = (i) => c[i] > o[i];
  const isRed = (i) => c[i] < o[i];
  const midpoint = (i) => (o[i] + c[i]) / 2;

  const i = n - 1;
  const p = n - 2;
  const p2 = n - 3;

  // 1. DOJI
  if (range(i) > 0 && bodySize(i) / range(i) < 0.1) {
    patterns.push({ name:'Doji', signal:'neutral', desc:'Indecision — possible reversal watch', color:'#f59e0b' });
  }

  // 2. HAMMER
  if (i >= 1) {
    const lowerWick = Math.min(o[i], c[i]) - l[i];
    const upperWick = h[i] - Math.max(o[i], c[i]);
    const body = bodySize(i);
    if (body > 0 && lowerWick >= 2 * body && upperWick <= 0.3 * body && c[p] < o[p]) {
      patterns.push({ name:'Hammer', signal:'bullish', desc:'Bullish reversal — buyers pushed back from lows', color:'#22c55e' });
    }
  }

  // 3. SHOOTING STAR
  if (i >= 1) {
    const upperWick = h[i] - Math.max(o[i], c[i]);
    const lowerWick = Math.min(o[i], c[i]) - l[i];
    const body = bodySize(i);
    if (body > 0 && upperWick >= 2 * body && lowerWick <= 0.3 * body && c[p] > o[p]) {
      patterns.push({ name:'Shooting Star', signal:'bearish', desc:'Bearish reversal — sellers rejected at highs', color:'#ef4444' });
    }
  }

  // 4. BULLISH ENGULFING
  if (i >= 1 && isGreen(i) && isRed(p) && o[i] <= c[p] && c[i] >= o[p]) {
    patterns.push({ name:'Bullish Engulfing', signal:'bullish', desc:'Strong bullish reversal — bulls took full control', color:'#22c55e' });
  }

  // 5. BEARISH ENGULFING
  if (i >= 1 && isRed(i) && isGreen(p) && o[i] >= c[p] && c[i] <= o[p]) {
    patterns.push({ name:'Bearish Engulfing', signal:'bearish', desc:'Strong bearish reversal — bears took full control', color:'#ef4444' });
  }

  // 6. MORNING STAR
  if (i >= 2 && isRed(p2) && bodySize(p) < bodySize(p2) * 0.3 && isGreen(i) && c[i] > midpoint(p2)) {
    patterns.push({ name:'Morning Star', signal:'bullish', desc:'3-candle bullish reversal after downtrend', color:'#22c55e' });
  }

  // 7. EVENING STAR
  if (i >= 2 && isGreen(p2) && bodySize(p) < bodySize(p2) * 0.3 && isRed(i) && c[i] < midpoint(p2)) {
    patterns.push({ name:'Evening Star', signal:'bearish', desc:'3-candle bearish reversal after uptrend', color:'#ef4444' });
  }

  return patterns;
}

// ======================================
// BOLLINGER BANDS SERIES (for chart)
// ======================================
function calcBollingerSeries(closes, period=20, mult=2){
  if(!closes||closes.length<period) return null;
  const result=[];
  for(let i=period-1;i<closes.length;i++){
    const slice=closes.slice(i-period+1,i+1);
    const ma=slice.reduce((a,b)=>a+b,0)/period;
    const variance=slice.reduce((a,b)=>a+Math.pow(b-ma,2),0)/period;
    const sd=Math.sqrt(variance);
    const upper=parseFloat((ma+mult*sd).toFixed(2));
    const lower=parseFloat((ma-mult*sd).toFixed(2));
    const width=parseFloat(((upper-lower)/ma*100).toFixed(2));
    const price=closes[i];
    const pctB=upper===lower?50:parseFloat(((price-lower)/(upper-lower)*100).toFixed(1));
    let signal='Neutral';
    if(pctB<10) signal='Oversold';
    else if(pctB>90) signal='Overbought';
    else if(width<3) signal='Squeeze';
    result.push({upper, ma:parseFloat(ma.toFixed(2)), lower, width, pctB, signal, price:parseFloat(price.toFixed(2))});
  }
  return result;
}

// ======================================
// BOLLINGER BANDS (single point - last candle)
// ======================================
function calcBollinger(closes, period=20, mult=2){
  if(!closes||closes.length<period) return null;
  const slice=closes.slice(-period);
  const ma=slice.reduce((a,b)=>a+b,0)/period;
  const variance=slice.reduce((a,b)=>a+Math.pow(b-ma,2),0)/period;
  const sd=Math.sqrt(variance);
  const upper=parseFloat((ma+mult*sd).toFixed(2));
  const lower=parseFloat((ma-mult*sd).toFixed(2));
  const width=parseFloat(((upper-lower)/ma*100).toFixed(2));
  const price=closes[closes.length-1];
  const pctB=parseFloat(((price-lower)/(upper-lower)*100).toFixed(1));
  let signal='Neutral';
  if(pctB<10) signal='Oversold';
  else if(pctB>90) signal='Overbought';
  else if(width<3) signal='Squeeze';
  return {
    upper, ma:parseFloat(ma.toFixed(2)), lower,
    width, pctB, signal, price:parseFloat(price.toFixed(2))
  };
}

// ======================================
// BOLLINGER BANDS MATRIX CONFIG
// ======================================
const BB_MATRIX={
  'daily':   {'1M':{range:'1mo',interval:'1d',bbPeriod:20}, '3M':{range:'3mo',interval:'1d',bbPeriod:20}, '6M':{range:'6mo',interval:'1d',bbPeriod:20}, '1Y':{range:'1y',interval:'1d',bbPeriod:20}, '2Y':{range:'2y',interval:'1d',bbPeriod:20}},
  'weekly':  {'1M':{range:'1mo',interval:'1wk',bbPeriod:20},'3M':{range:'3mo',interval:'1wk',bbPeriod:20},'6M':{range:'6mo',interval:'1wk',bbPeriod:20},'1Y':{range:'1y',interval:'1wk',bbPeriod:20},'2Y':{range:'2y',interval:'1wk',bbPeriod:20}},
  'monthly': {'1M':{range:'1mo',interval:'1mo',bbPeriod:5}, '3M':{range:'3mo',interval:'1mo',bbPeriod:5}, '6M':{range:'6mo',interval:'1mo',bbPeriod:5}, '1Y':{range:'1y',interval:'1mo',bbPeriod:12},'2Y':{range:'2y',interval:'1mo',bbPeriod:12}}
};

function getBBConfig(){
  return (BB_MATRIX[AppState._bbRange]||BB_MATRIX['daily'])[AppState._bbPeriod] || BB_MATRIX['daily']['6M'];
}

// ======================================
// RENDER BOLLINGER BANDS IN DETAIL MODAL
// ======================================
async function renderBollinger(sym){
  if(sym !== AppState._bbSym){ AppState._bbPeriod='6M'; AppState._bbRange='daily'; }
  AppState._bbSym=sym;
  const bs=document.getElementById('bbSection');
  if(!bs) return;
  
  const _existingButtons = bs.querySelector('[data-bb-controls]');
  if(!_existingButtons){
    bs.innerHTML=`<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Loading Bollinger Bands...</div>`;
  } else {
    const _loader = bs.querySelector('[data-bb-loader]');
    if(_loader) _loader.remove();
    const _loaderDiv = document.createElement('div');
    _loaderDiv.setAttribute('data-bb-loader','1');
    _loaderDiv.style.cssText='font-size:10px;color:#4b6280;text-align:center;padding:6px;';
    _loaderDiv.textContent='Loading Bollinger Bands...';
    bs.appendChild(_loaderDiv);
  }

  const cfg=getBBConfig();
  const hist=await fetchHistory(sym, cfg.range, cfg.interval);
  const minNeeded=AppState._bbPeriod==='1M'?15:cfg.bbPeriod+1;

  if(!hist||!hist.close||hist.close.length<minNeeded){
    const got=hist?.close?.length||0;
    bs.innerHTML=`<div style="font-size:10px;text-align:center;padding:10px;">
      <div style="color:#f59e0b;font-weight:700;margin-bottom:4px;">⚠️ BB Data Unavailable</div>
      <div style="color:#4b6280;font-size:9px;line-height:1.5;">${got===0?'History API failed. Check GAS API or network.':'Only '+got+' candles — need '+minNeeded+' for '+AppState._bbPeriod+' '+AppState._bbRange+'. Try Daily or shorter period.'}</div>
      <button onclick="renderBollinger('${sym}')" style="margin-top:8px;background:#1e3a5f;color:#38bdf8;border:1px solid #2d5a8e;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">⟳ Retry</button>
    </div>`;
    return;
  }

  const closes=hist.close.filter(v=>v!=null);
  const opens=hist.open?hist.open.filter(v=>v!=null):closes;
  const highs=hist.high?hist.high.filter(v=>v!=null):closes;
  const lows=hist.low?hist.low.filter(v=>v!=null):closes;
  const activeBP=cfg.bbPeriod;
  const bbFull=calcBollingerSeries(closes, activeBP, 2);
  const bb=bbFull ? bbFull[bbFull.length-1] : calcBollinger(closes, activeBP, 2);
  if(!bb){ bs.innerHTML=''; return; }

  const signalColor=bb.signal==='Oversold'?'#22c55e':bb.signal==='Overbought'?'#ef4444':bb.signal==='Squeeze'?'#f59e0b':'#94a3b8';
  const pctBColor=bb.pctB<10?'#22c55e':bb.pctB>90?'#ef4444':'#38bdf8';
  const barPct=Math.min(100,Math.max(0,bb.pctB));

  const bwArr=bbFull?bbFull.map(b=>b.width):[];
  const bwNow=bwArr.slice(-5).reduce((a,b)=>a+b,0)/5||bb.width;
  const bwPrev=bwArr.slice(-10,-5).reduce((a,b)=>a+b,0)/5||bb.width;
  const squeezeDir=bwNow<bwPrev?'Contracting':'Expanding';
  const squeezeColor=bwNow<bwPrev?'#f59e0b':'#a78bfa';
  const rangeLabel=AppState._bbRange==='daily'?'Daily':AppState._bbRange==='weekly'?'Weekly':'Monthly';

  bs.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">BOLLINGER BANDS (${activeBP},2) <span style="font-size:9px;color:${squeezeColor};font-weight:600;">● ${squeezeDir}</span></div>
    <div data-bb-controls="1" style="display:flex;gap:4px;margin-bottom:4px;">
      ${['1M','3M','6M','1Y','2Y'].map(p=>`
        <button onclick="setBBPeriod('${p}')"
          style="flex:1;padding:3px 0;border-radius:5px;border:1px solid ${p===AppState._bbPeriod?'#38bdf8':'#1e3a5f'};
          background:${p===AppState._bbPeriod?'rgba(56,189,248,0.15)':'#0a1628'};
          color:${p===AppState._bbPeriod?'#38bdf8':'#4b6280'};font-size:10px;font-weight:700;cursor:pointer;
          font-family:'Rajdhani',sans-serif;">${p}</button>
      `).join('')}
    </div>
    <div style="display:flex;gap:4px;margin-bottom:6px;">
      ${['daily','weekly','monthly'].map(r=>`
        <button onclick="setBBRange('${r}')"
          style="flex:1;padding:3px 0;border-radius:5px;border:1px solid ${r===AppState._bbRange?'#a78bfa':'#1e3a5f'};
          background:${r===AppState._bbRange?'rgba(167,139,250,0.15)':'#0a1628'};
          color:${r===AppState._bbRange?'#a78bfa':'#4b6280'};font-size:9px;font-weight:700;cursor:pointer;
          font-family:'Rajdhani',sans-serif;text-transform:capitalize;">${r.charAt(0).toUpperCase()+r.slice(1)}</button>
      `).join('')}
    </div>
    <canvas id="bb-chart" width="640" height="300" style="width:100%;height:200px;border-radius:6px;background:#0a1628;display:block;margin-bottom:6px;"></canvas>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px;">
      <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">UPPER BAND</div><div style="font-size:12px;font-weight:700;color:#ef4444;white-space:nowrap;">₹${bb.upper}</div></div>
        <div style="width:1px;height:24px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:center;"><div style="font-size:9px;color:#4b6280;">MA (${activeBP})</div><div style="font-size:12px;font-weight:700;color:#38bdf8;white-space:nowrap;">₹${bb.ma}</div></div>
        <div style="width:1px;height:24px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">LOWER BAND</div><div style="font-size:12px;font-weight:700;color:#22c55e;white-space:nowrap;">₹${bb.lower}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">%B VALUE</div><div style="font-size:13px;font-weight:700;white-space:nowrap;color:${pctBColor};">${bb.pctB}%</div></div>
        <div style="width:1px;height:24px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:center;"><div style="font-size:9px;color:#4b6280;">BAND WIDTH</div><div style="font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;">${bb.width}%</div></div>
        <div style="width:1px;height:24px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">SIGNAL</div><div style="font-size:13px;font-weight:700;white-space:nowrap;color:${signalColor};">${bb.signal}</div></div>
      </div>
    </div>
    <div style="background:#0a1628;border-radius:6px;padding:8px 10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
        <span style="font-size:9px;color:#22c55e;">Lower ₹${bb.lower}</span>
        <span style="font-size:9px;color:#94a3b8;font-weight:700;">Price Position (${bb.pctB.toFixed(0)}%B)</span>
        <span style="font-size:9px;color:#ef4444;">Upper ₹${bb.upper}</span>
      </div>
      <div style="background:#1e3a5f;border-radius:4px;height:10px;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;height:100%;width:20%;background:rgba(34,197,94,0.25);"></div>
        <div style="position:absolute;right:0;top:0;height:100%;width:20%;background:rgba(239,68,68,0.25);"></div>
        <div style="position:absolute;left:50%;top:0;height:100%;width:1px;background:rgba(56,189,248,0.3);"></div>
        <div style="position:absolute;top:50%;left:${barPct}%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:${pctBColor};box-shadow:0 0 5px ${pctBColor};"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-size:8px;color:#22c55e;">Buy Zone</span>
        <span style="font-size:8px;color:#94a3b8;">${AppState._bbPeriod} ${rangeLabel} | MA${activeBP}</span>
        <span style="font-size:8px;color:#ef4444;">Sell Zone</span>
      </div>
    </div>`;

  // Draw Candlestick + BB chart on canvas
  requestAnimationFrame(()=>{
    const canvas=document.getElementById('bb-chart');
    if(!canvas||!bbFull||bbFull.length<2) return;
    const ctx=canvas.getContext('2d');
    const W=canvas.width, H=canvas.height;
    const pad={t:10,b:10,l:6,r:6};
    const cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
    const N=Math.min(bbFull.length, AppState._bbPeriod==='2Y'?120:AppState._bbPeriod==='1Y'?(AppState._bbRange==='weekly'?52:(AppState._bbRange==='monthly'?12:100)):AppState._bbPeriod==='6M'?(AppState._bbRange==='weekly'?26:(AppState._bbRange==='monthly'?6:60)):AppState._bbPeriod==='3M'?(AppState._bbRange==='weekly'?13:40):22);
    const slice=bbFull.slice(-N);
    const oSlice=opens.slice(-N);
    const hSlice=highs.slice(-N);
    const lSlice=lows.slice(-N);
    const cSlice=closes.slice(-N);
    const allVals=slice.flatMap(b=>[b.upper,b.lower]).concat(hSlice,lSlice);
    const minV=Math.min(...allVals)*0.999, maxV=Math.max(...allVals)*1.001;
    const xScale=i=>pad.l+(i/(N-1))*cw;
    const yScale=v=>H-pad.b-((v-minV)/(maxV-minV))*ch;
    const candleW=Math.max(2, Math.floor(cw/N*0.6));
    
    ctx.clearRect(0,0,W,H);
    // Shaded BB band area
    ctx.beginPath();
    slice.forEach((b,i)=>{ if(i===0) ctx.moveTo(xScale(i),yScale(b.upper)); else ctx.lineTo(xScale(i),yScale(b.upper)); });
    slice.forEach((b,i)=>{ ctx.lineTo(xScale(N-1-i),yScale(slice[N-1-i].lower)); });
    ctx.closePath();
    ctx.fillStyle='rgba(56,189,248,0.07)';
    ctx.fill();
    // Upper band
    ctx.beginPath();
    slice.forEach((b,i)=>{ if(i===0) ctx.moveTo(xScale(i),yScale(b.upper)); else ctx.lineTo(xScale(i),yScale(b.upper)); });
    ctx.strokeStyle='rgba(239,68,68,0.6)'; ctx.lineWidth=1; ctx.stroke();
    // Lower band
    ctx.beginPath();
    slice.forEach((b,i)=>{ if(i===0) ctx.moveTo(xScale(i),yScale(b.lower)); else ctx.lineTo(xScale(i),yScale(b.lower)); });
    ctx.strokeStyle='rgba(34,197,94,0.6)'; ctx.lineWidth=1; ctx.stroke();
    // MA line dashed
    ctx.beginPath();
    slice.forEach((b,i)=>{ if(i===0) ctx.moveTo(xScale(i),yScale(b.ma)); else ctx.lineTo(xScale(i),yScale(b.ma)); });
    ctx.strokeStyle='rgba(56,189,248,0.7)'; ctx.lineWidth=1; ctx.setLineDash([3,2]); ctx.stroke(); ctx.setLineDash([]);
    // Candlesticks
    cSlice.forEach((c,i)=>{
      const o=oSlice[i]||c, h=hSlice[i]||c, l=lSlice[i]||c;
      const x=xScale(i);
      const isBull=c>=o;
      const color=isBull?'#22c55e':'#ef4444';
      ctx.beginPath();
      ctx.moveTo(x, yScale(h));
      ctx.lineTo(x, yScale(l));
      ctx.strokeStyle=color; ctx.lineWidth=1; ctx.stroke();
      const bodyTop=yScale(Math.max(o,c));
      const bodyBot=yScale(Math.min(o,c));
      const bodyH=Math.max(1, bodyBot-bodyTop);
      ctx.fillStyle=isBull?'rgba(34,197,94,0.85)':'rgba(239,68,68,0.85)';
      ctx.fillRect(x-candleW/2, bodyTop, candleW, bodyH);
    });
  });
}

// ======================================
// SET BOLLINGER PERIOD
// ======================================
function setBBPeriod(p){
  AppState._bbPeriod=p;
  renderBollinger(AppState._bbSym);
}

// ======================================
// SET BOLLINGER RANGE
// ======================================
function setBBRange(r){
  AppState._bbRange=r;
  renderBollinger(AppState._bbSym);
}

// ======================================
// BUILD SUPPORT & RESISTANCE BLOCK
// ======================================
function _buildSRBlock(sym) {
  if (!sym) return '';
  const d = AppState.cache[sym] && AppState.cache[sym].data;
  if (!d) return '';

  const cmp  = d.regularMarketPrice   || 0;
  const high = d.regularMarketDayHigh || cmp;
  const low  = d.regularMarketDayLow  || cmp;
  const prev = d.chartPreviousClose   || cmp;
  const h52  = d.fiftyTwoWeekHigh     || 0;
  const l52  = d.fiftyTwoWeekLow      || 0;

  if (!cmp || !high || !low || !prev) return '';

  const P  = (high + low + prev) / 3;
  const R1 = parseFloat((2 * P - low).toFixed(2));
  const R2 = parseFloat((P + (high - low)).toFixed(2));
  const S1 = parseFloat((2 * P - high).toFixed(2));
  const S2 = parseFloat((P - (high - low)).toFixed(2));

  const fmt = v => '₹' + v.toFixed(2);
  const pctFrom = (level, price) => {
    if (!level || !price) return '';
    const p = ((price - level) / level * 100);
    const sign = p >= 0 ? '+' : '';
    return sign + p.toFixed(1) + '%';
  };

  const barMin = Math.min(S2, l52 || S2);
  const barMax = Math.max(R2, h52 || R2);
  const barRange = barMax - barMin || 1;
  const cmpPct = Math.min(100, Math.max(0, ((cmp - barMin) / barRange) * 100));
  const s1Pct  = Math.min(100, Math.max(0, ((S1 - barMin) / barRange) * 100));
  const r1Pct  = Math.min(100, Math.max(0, ((R1 - barMin) / barRange) * 100));

  const nearS1 = cmp <= S1 * 1.015;
  const nearR1 = cmp >= R1 * 0.985;
  const aboveP = cmp > P;
  let signal = '', sigColor = '#94a3b8', sigBg = 'rgba(148,163,184,0.08)';
  if (nearS1)      { signal = 'Near Support — Watch for Bounce'; sigColor = '#22c55e'; sigBg = 'rgba(34,197,94,0.08)'; }
  else if (nearR1) { signal = 'Near Resistance — Watch for Reversal'; sigColor = '#ef4444'; sigBg = 'rgba(239,68,68,0.08)'; }
  else if (aboveP) { signal = 'Above Pivot — Bullish Bias'; sigColor = '#38bdf8'; sigBg = 'rgba(56,189,248,0.08)'; }
  else             { signal = 'Below Pivot — Bearish Bias'; sigColor = '#f59e0b'; sigBg = 'rgba(245,158,11,0.08)'; }

  const levelRow = (label, val, labelColor, pct, pctColor) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
      <div style="font-size:9px;color:${labelColor};font-weight:700;font-family:'Rajdhani',sans-serif;min-width:26px;">${label}</div>
      <div style="font-size:11px;font-weight:700;color:#e2e8f0;font-family:'Rajdhani',sans-serif;">${fmt(val)}</div>
      <div style="font-size:9px;color:${pctColor};font-family:'Rajdhani',sans-serif;text-align:right;min-width:46px;">${pct}</div>
    </div>`;

  return `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">SUPPORT &amp; RESISTANCE</div>
    <div style="background:#0a1628;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
      ${levelRow('R2', R2, '#ef4444', pctFrom(cmp, R2), '#ef4444')}
      ${levelRow('R1', R1, '#f87171', pctFrom(cmp, R1), '#f87171')}
      <div style="border-top:1px dashed #1e3a5f;margin:3px 0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
        <div style="font-size:9px;color:#94a3b8;font-weight:700;font-family:'Rajdhani',sans-serif;min-width:26px;">P</div>
        <div style="font-size:11px;font-weight:700;color:#94a3b8;font-family:'Rajdhani',sans-serif;">${fmt(P)}</div>
        <div style="font-size:9px;color:#94a3b8;font-family:'Rajdhani',sans-serif;min-width:46px;text-align:right;">Pivot</div>
      </div>
      <div style="border-top:1px dashed #1e3a5f;margin:3px 0;"></div>
      ${levelRow('S1', S1, '#4ade80', pctFrom(cmp, S1), '#4ade80')}
      ${levelRow('S2', S2, '#22c55e', pctFrom(cmp, S2), '#22c55e')}
      <div style="margin-top:8px;position:relative;height:6px;background:#1e2d3d;border-radius:3px;overflow:visible;">
        <div style="position:absolute;left:${s1Pct}%;top:-2px;width:2px;height:10px;background:#4ade80;border-radius:1px;transform:translateX(-50%);"></div>
        <div style="position:absolute;left:${r1Pct}%;top:-2px;width:2px;height:10px;background:#f87171;border-radius:1px;transform:translateX(-50%);"></div>
        <div style="position:absolute;left:${cmpPct}%;top:50%;width:10px;height:10px;background:#38bdf8;border-radius:50%;border:2px solid #0a0f1a;transform:translate(-50%,-50%);z-index:2;"></div>
        <div style="position:absolute;left:0;top:0;width:${cmpPct}%;height:100%;background:linear-gradient(90deg,rgba(34,197,94,0.3),rgba(56,189,248,0.3));border-radius:3px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;">
        <div style="font-size:8px;color:#22c55e;font-family:'Rajdhani',sans-serif;">${l52 ? fmt(l52) : fmt(S2)} 52W L</div>
        <div style="font-size:8px;color:#38bdf8;font-family:'Rajdhani',sans-serif;">CMP ${fmt(cmp)}</div>
        <div style="font-size:8px;color:#ef4444;font-family:'Rajdhani',sans-serif;">52W H ${h52 ? fmt(h52) : fmt(R2)}</div>
      </div>
    </div>
    <div style="background:${sigBg};border:1px solid ${sigColor}44;border-radius:6px;padding:5px 10px;text-align:center;margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:${sigColor};font-family:'Rajdhani',sans-serif;">${signal}</div>
    </div>`;
}

// ======================================
// REGISTER FUNCTIONS TO WINDOW
// ======================================
window.calcRSI = calcRSI;
window.calcEMA = calcEMA;
window.calcMACD = calcMACD;
window.calcATR = calcATR;
window.calcBollinger = calcBollinger;
window.calcBollingerSeries = calcBollingerSeries;
window.detectInsideBar = detectInsideBar;
window.detectNarrowRange = detectNarrowRange;
window.detectCandlePatterns = detectCandlePatterns;
window.renderBollinger = renderBollinger;
window.setBBPeriod = setBBPeriod;
window.setBBRange = setBBRange;
window._buildSRBlock = _buildSRBlock;

console.log('✅ technical.js loaded successfully');
