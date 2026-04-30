// ========================================
// DETAIL MODAL MODULE — RealTradePro v3.0
// Handles: Stock detail modal, Quick links, Index composition, Smart alerts
// ========================================

// ======================================
// OPEN STOCK DETAIL MODAL
// ======================================
async function openDetail(sym, isIndex) {
  // Show modal immediately with cached data
  let d = AppState.cache[sym]?.data || await fetchFull(sym, isIndex);
  if (!d) return;
  
  const dTitle = document.getElementById("d-title");
  if (dTitle) dTitle.innerText = sym;
  
  // Reset all tabs
  switchDetailTab('price');
  
  // Reset section contents
  const fundamentalsSection = document.getElementById("fundamentalsSection");
  const techSection = document.getElementById("techSection");
  const smartAlertSection = document.getElementById("smartAlertSection");
  const bbSection = document.getElementById("bbSection");
  const quickLinksSection = document.getElementById("quickLinksSection");
  
  if (fundamentalsSection) fundamentalsSection.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:12px;">Loading fundamentals...</div>';
  if (techSection) techSection.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:12px;">Loading technical data...</div>';
  if (smartAlertSection) smartAlertSection.innerHTML = '';
  if (bbSection) bbSection.innerHTML = '';
  if (quickLinksSection) quickLinksSection.innerHTML = '';
  
  AppState._bbSym = sym;
  
  // TradingView button
  const tvBtn = document.getElementById("d-tv-btn");
  if (tvBtn) tvBtn.onclick = () => chart(sym, isIndex ? true : false);
  const tvBtn2 = document.getElementById("d-tv-btn2");
  if (tvBtn2) tvBtn2.onclick = () => chart(sym, isIndex ? true : false);
  
  // Price tab content
  const dBody = document.getElementById("d-body");
  if (dBody) {
    dBody.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:3px;">
        <div style="background:#0a1628;border-radius:7px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">OPEN</div><div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">₹${(d.regularMarketOpen && d.regularMarketOpen > 1 ? d.regularMarketOpen : (d.chartPreviousClose || 0)).toFixed(2)}</div></div>
          <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">PREV CLOSE</div><div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">₹${(d.chartPreviousClose || 0).toFixed(2)}</div></div>
        </div>
        <div style="background:#0a1628;border-radius:7px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <div style="flex:1;min-width:0;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">DAY HIGH</div><div style="font-size:14px;font-weight:700;color:#22c55e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">₹${(d.regularMarketDayHigh || 0).toFixed(2)}</div></div>
          <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">DAY LOW</div><div style="font-size:14px;font-weight:700;color:#ef4444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">₹${(d.regularMarketDayLow || 0).toFixed(2)}</div></div>
        </div>
        <div style="background:#0a1628;border-radius:7px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <div style="flex:1;min-width:0;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">52W HIGH</div><div style="font-size:14px;font-weight:700;color:#22c55e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">₹${(d.fiftyTwoWeekHigh || 0).toFixed(2)}</div></div>
          <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">52W LOW</div><div style="font-size:14px;font-weight:700;color:#ef4444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">₹${(d.fiftyTwoWeekLow || 0).toFixed(2)}</div></div>
        </div>
      </div>`;
  }
  
  const chartDiv = document.getElementById("d-chart");
  if (chartDiv) chartDiv.innerHTML = '';
  
  const detailModal = document.getElementById("detailModal");
  if (detailModal) detailModal.classList.remove("hidden");
  
  document.body.style.overflow = 'hidden';
  
  if (!isIndex) {
    renderSmartAlertSuggestions(sym, d);
    renderQuickLinks(sym, isIndex);
    
    // Load fundamentals
    const _cachedFund = (() => {
      try {
        const s = JSON.parse(localStorage.getItem('fundCache6_' + sym) || 'null');
        return s && s.data ? s.data : null;
      } catch (e) { return null; }
    })();
    
    const fs = document.getElementById("fundamentalsSection");
    if (_cachedFund && fs) {
      _renderFundamentalsHTML(fs, _cachedFund, true, sym);
    }
    
    const fund = await fetchFundamentals(sym);
    if (fs && fund) {
      _renderFundamentalsHTML(fs, fund, false, sym);
    } else if (fs && !_cachedFund) {
      fs.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Fundamentals unavailable — will retry on next open</div>';
    }
    
    renderQuickLinks(sym, isIndex);
    
    // Load technical data
    const _techTimeout = setTimeout(() => {
      const ts = document.getElementById('techSection');
      if (ts && ts.innerText.includes('Loading')) ts.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:4px;">Technical data unavailable. <a onclick="fetchHistory(\'' + sym + '\').then(h=>{if(h)location.reload();})" style="color:#38bdf8;cursor:pointer;">Retry</a></div>';
    }, 12000);
    
    fetchHistory(sym, '60d', '1d').then(hist => {
      clearTimeout(_techTimeout);
      const ts = document.getElementById("techSection");
      if (!ts) return;
      if (!hist || !hist.close) {
        ts.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:4px;">Technical data unavailable</div>';
        return;
      }
      
      const closes = hist.close.filter(v => v != null);
      const highs = hist.high ? hist.high.filter(v => v != null) : closes;
      const lows = hist.low ? hist.low.filter(v => v != null) : closes;
      const rsi = calcRSI(closes);
      const macd = calcMACD(closes);
      const insideBar = detectInsideBar(highs, lows);
      const narrowRange = detectNarrowRange(highs, lows);
      const atr = calcATR(highs, lows, closes);
      const vols = (hist.volume || []).filter(v => v != null);
      const todayVol = vols[vols.length - 1] || 0;
      const avgVol10 = vols.length >= 10 ? vols.slice(-10).reduce((a, b) => a + b, 0) / 10 : null;
      const volRatio = avgVol10 && avgVol10 > 0 ? parseFloat((todayVol / avgVol10).toFixed(2)) : null;
      const volColor = volRatio ? volRatio >= 2 ? '#a78bfa' : volRatio >= 1.5 ? '#38bdf8' : volRatio >= 1 ? '#94a3b8' : '#4b6280' : '#4b6280';
      const volLabel = volRatio ? volRatio >= 2 ? 'Very High' : volRatio >= 1.5 ? 'High' : volRatio >= 1 ? 'Normal' : 'Low' : '--';
      const price = AppState.cache[sym]?.data?.regularMarketPrice || 0;
      const atrPct = atr && price > 0 ? parseFloat((atr / price * 100).toFixed(2)) : null;
      const rsiColor = rsi ? rsi < 30 ? '#22c55e' : rsi > 70 ? '#ef4444' : '#38bdf8' : '#94a3b8';
      const macdColor = macd ? (macd.trend === 'bullish' ? '#22c55e' : '#ef4444') : '#94a3b8';
      const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px;flex-shrink:0;"></span>`;
      const dmaKey = (l) => l.includes('20') ? 'DMA20' : l.includes('50') ? 'DMA50' : 'DMA200';
      const maRow = (label, val) => val ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:11px;color:#94a3b8;display:flex;align-items:center;">${dot(price >= val ? '#22c55e' : '#ef4444')}${label}${iBtn(dmaKey(label))}</span>
        <span style="font-size:11px;font-weight:700;color:${price >= val ? '#22c55e' : '#ef4444'};">₹${val.toFixed(2)} ${price >= val ? '▲' : '▼'}</span>
      </div>` : '';
      
      const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
      const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;
      
      ts.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TECHNICAL (30D)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;display:flex;align-items:center;">${dot(rsiColor)}RSI (14)${iBtn('RSI')}</div><div style="font-size:13px;font-weight:700;color:${rsiColor};white-space:nowrap;">${rsi ? rsi.toFixed(1) : '--'} <span style="font-size:9px;">${rsi ? rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral' : ''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;display:flex;align-items:center;justify-content:flex-end;">${dot(macdColor)}MACD${iBtn('MACD')}</div><div style="font-size:13px;font-weight:700;color:${macdColor};white-space:nowrap;">${macd ? macd.macd : '--'} <span style="font-size:9px;">${macd ? macd.trend : ''}</span></div></div>
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;">
            <div style="font-size:9px;color:#4b6280;margin-bottom:4px;">MOVING AVERAGES vs CMP ₹${price.toFixed(0)}</div>
            ${maRow('DMA 20', ma20)}
            ${maRow('DMA 50', ma50)}
            ${maRow('DMA 200', ma200)}
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">ATR (14)</div><div style="font-size:13px;font-weight:700;color:#f59e0b;">${atr ? '₹' + atr : '--'} <span style="font-size:9px;color:#94a3b8;">${atrPct ? '(' + atrPct + '%)' : ''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">VOLUME</div><div style="font-size:13px;font-weight:700;color:${volColor};">${volLabel} <span style="font-size:9px;">${volRatio ? volRatio + 'x' : ''}</span></div></div>
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">INSIDE BAR${iBtn('INSIDE')}</div><div style="font-size:12px;font-weight:700;color:${insideBar ? '#f59e0b' : '#4b6280'};">${insideBar ? 'Yes' : 'No'}</div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">NARROW RANGE${iBtn('NARROW')}</div><div style="font-size:12px;font-weight:700;color:${narrowRange ? '#f59e0b' : '#4b6280'};">${narrowRange ? 'Yes' : 'No'}</div></div>
          </div>
          ${(() => {
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
    });
  } else {
    // INDEX: Show composition instead of fundamentals
    const fs = document.getElementById("fundamentalsSection");
    if (fs) renderIndexComposition(sym, fs);
    
    const ts = document.getElementById("techSection");
    if (ts) ts.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:12px;">Loading index technicals...</div>';
    
    fetchHistory(sym + '', '30d', '1d').then(hist => {
      if (!ts) return;
      if (!hist || !hist.close) {
        ts.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Technical data unavailable for this index.</div>';
        return;
      }
      
      const closes = hist.close.filter(v => v != null);
      const highs = hist.high ? hist.high.filter(v => v != null) : closes;
      const lows = hist.low ? hist.low.filter(v => v != null) : closes;
      const rsi = calcRSI(closes);
      const macd = calcMACD(closes);
      const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
      const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;
      const price = d.regularMarketPrice || 0;
      const rsiColor = rsi ? rsi < 30 ? '#22c55e' : rsi > 70 ? '#ef4444' : '#38bdf8' : '#94a3b8';
      const macdColor = macd ? (macd.trend === 'bullish' ? '#22c55e' : '#ef4444') : '#94a3b8';
      const dmaKey = (l) => l.includes('20') ? 'DMA20' : l.includes('50') ? 'DMA50' : 'DMA200';
      const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px;flex-shrink:0;"></span>`;
      const maRow = (label, val) => val ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:11px;color:#94a3b8;display:flex;align-items:center;">${dot(price >= val ? '#22c55e' : '#ef4444')}${label}${iBtn(dmaKey(label))}</span>
        <span style="font-size:11px;font-weight:700;color:${price >= val ? '#22c55e' : '#ef4444'};">₹${val.toFixed(2)} ${price >= val ? '▲' : '▼'}</span>
      </div>` : '';
      
      ts.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TECHNICAL (30D)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">RSI (14)${iBtn('RSI')}</div><div style="font-size:13px;font-weight:700;color:${rsiColor};white-space:nowrap;">${rsi || '--'} <span style="font-size:9px;">${rsi ? rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral' : ''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">MACD${iBtn('MACD')}</div><div style="font-size:13px;font-weight:700;color:${macdColor};white-space:nowrap;">${macd ? macd.macd : '--'} <span style="font-size:9px;">${macd ? macd.trend : ''}</span></div></div>
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;">
            <div style="font-size:9px;color:#4b6280;margin-bottom:4px;">MOVING AVERAGES vs CMP ₹${price.toFixed(0)}</div>
            ${maRow('DMA 20', ma20)}
            ${maRow('DMA 50', ma50)}
            ${maRow('DMA 200', ma200)}
          </div>
        </div>`;
    });
  }
}

// ======================================
// CLOSE DETAIL MODAL
// ======================================
function closeDetail() {
  const detailModal = document.getElementById("detailModal");
  if (detailModal) detailModal.classList.add("hidden");
  document.body.style.overflow = '';
}

// ======================================
// SWITCH DETAIL TAB (Price/Fund/Tech/BB/Links)
// ======================================
function switchDetailTab(tab) {
  const tabs = ['price', 'fund', 'tech', 'bb', 'links'];
  tabs.forEach(t => {
    const el = document.getElementById('dtab-' + t);
    const btn = document.getElementById('dtab-btn-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      if (t === tab) {
        btn.style.background = '#065f46';
        btn.style.color = '#34d399';
        btn.style.borderColor = '#065f46';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#4b6280';
        btn.style.borderColor = '#1e3a5f';
      }
    }
  });
  if (tab === 'bb' && AppState._bbSym) renderBollinger(AppState._bbSym);
}

// ======================================
// RENDER FUNDAMENTALS HTML
// ======================================
function _renderFundamentalsHTML(fs, fund, isCached, sym) {
  if (!fs || !fund) return;
  
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
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">P/E (TTM)${iBtn('PE')}</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.pe || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">FORWARD P/E</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fpe_v}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">EPS (TTM)${iBtn('EPS')}</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.eps || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">FORWARD EPS</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${feps_v}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">MKT CAP</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.marketCap || '--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">BOOK VALUE</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${bv_v}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
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
    ${_buildSRBlock(sym)}`;
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
        <button onclick="window.open('https://www.nseindia.com/market-data/live-market-indices','_blank')" style="background:#0f2a40;color:#38bdf8;border:1px solid #1e3a5f;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">NSE Indices</button>
        <button onclick="window.open('https://www.moneycontrol.com/markets/indian-indices/','_blank')" style="background:#0f2a40;color:#f97316;border:1px solid #7c2d12;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">MC</button>
        <button onclick="window.open('https://www.tradingview.com/chart/?symbol=${tvSym}','_blank')" style="background:#0f2a40;color:#34d399;border:1px solid #064e3b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">TradingView</button>
      </div>`;
    return;
  }
  
  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">QUICK LINKS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;">
      <button onclick="window.open('https://www.nseindia.com/get-quotes/equity?symbol=${sym}','_blank')" style="background:#0f2a40;color:#38bdf8;border:1px solid #1e3a5f;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">NSE</button>
      <button onclick="window.open('https://www.bseindia.com/stock-share-price/${sym}/','_blank')" style="background:#0f2a40;color:#fbbf24;border:1px solid #713f12;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">BSE</button>
      <button onclick="window.open('https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=${sym}','_blank')" style="background:#0f2a40;color:#a78bfa;border:1px solid #2d1a5e;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Filings</button>
      <button onclick="window.open('https://www.screener.in/company/${sym}/','_blank')" style="background:#0f2a40;color:#34d399;border:1px solid #064e3b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Screener</button>
      <button onclick="window.open('https://www.moneycontrol.com/india/stockpricequote/${sym}','_blank')" style="background:#0f2a40;color:#f97316;border:1px solid #7c2d12;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">MC</button>
      <button onclick="window.open('https://www.tickertape.in/stocks/${sym}','_blank')" style="background:#0f2a40;color:#fb7185;border:1px solid #4c0519;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Ticker</button>
      <button onclick="window.open('https://tijorifinance.com/company/${sym}','_blank')" style="background:#0f2a40;color:#6ee7b7;border:1px solid #065f46;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Tijori</button>
      <button onclick="window.open('https://chartink.com/stocks/${sym}.html','_blank')" style="background:#0f2a40;color:#fde68a;border:1px solid #78350f;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Chartink</button>
    </div>`;
}

// ======================================
// RENDER INDEX COMPOSITION
// ======================================
function renderIndexComposition(sym, el) {
  const comp = INDEX_COMPOSITION[sym];
  if (!comp) {
    el.innerHTML = '<div style="font-size:10px;color:#4b6280;text-align:center;padding:8px;">Composition data not available for this index.</div>';
    return;
  }
  
  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TOP CONSTITUENTS</div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      ${comp.map((c, i) => `
        <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;">
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

console.log('✅ detail-modal.js loaded successfully');