// ========================================
// PRICES MODULE — RealTradePro
// ========================================
// Depends on: AppState, fetchFull, batchFetchStocks (api.js), getMarketStatus (app.js)

function checkTargets(sym, currentPrice){
  if(!AppState.targets[sym]) return;
  const target=AppState.targets[sym];
  if(currentPrice>=target){
    showPopup(`TARGET HIT: ${sym} ₹${currentPrice.toFixed(2)} >= ₹${target}`, 6000);
    delete AppState.targets[sym];
    localStorage.setItem("AppState.targets",JSON.stringify(AppState.targets));
  }
}

function getTargetBadge(sym, price){
  if(!AppState.targets[sym]) return '';
  const t=AppState.targets[sym];
  const pct=((t-price)/price*100).toFixed(1);
  return '<div style="font-size:9px;color:#f59e0b;font-weight:700;margin-top:1px;">T: ₹'+t+' ('+( pct>0?'+':'')+pct+'%)</div>';
}

// ======================================
// ADD / REMOVE STOCK
// ======================================
async function addStock(sym){
  sym=sym.toUpperCase().trim();
  if(!sym) return;
  showLoader("Adding "+sym+"...");
  let d=await fetchFull(sym);
  hideLoader();
  if(!d||!d.regularMarketPrice){showPopup("Invalid Stock: "+sym);return;}
  AppState.cache[sym]={data:d,time:Date.now()};
  const cur=AppState.watchlists[AppState.currentWL];
  if(cur.stocks.includes(sym)){
    if(AppState.dupWarnEnabled) showPopup(sym+' already in '+cur.name);
    document.getElementById("searchBox").value="";
    return;
  }
  cur.stocks.unshift(sym);
  AppState.wl=cur.stocks;
  saveWatchlists();
  document.getElementById("searchBox").value="";
  hideSuggestions();
  renderWL();

  // Background: fetch fundamentals for new stock from Firestore (GAS fundSheet REMOVED)
  // fetchFundSheet() now reads Firestore directly — no GAS call needed
  if(!window._firebaseFundCache || !window._firebaseFundCache[sym]) {
    setTimeout(async ()=>{
      try {
        const fundData = await fetchFundSheet(sym); // reads Firestore
        if(fundData) {
          console.log('✅ Firestore fund loaded for new stock:', sym);
        }
      } catch(e) { console.warn('New stock Firestore fund fetch failed:', e.message); }
    }, 500);
  }
}

function removeStock(sym){
  const rmbox=document.getElementById("remove-modal-box");
  if(!rmbox){ if(confirm('Remove '+sym+' from watchlist?')){ doRemoveStock(sym); } return; }
  document.getElementById("remove-title").innerText="Remove "+sym+" from "+AppState.watchlists[AppState.currentWL].name+"?";
  document.getElementById("remove-confirm-sym").value=sym;
  rmbox.style.display="flex";
}
function doRemoveStock(sym){
  const cur=AppState.watchlists[AppState.currentWL];
  cur.stocks=cur.stocks.filter(x=>x!==sym);
  AppState.wl=cur.stocks;
  saveWatchlists();
  renderWL();
}
function closeRemoveModal(){
  document.getElementById("remove-modal-box").style.display="none";
}
function confirmRemove(){
  const sym=document.getElementById("remove-confirm-sym").value;
  closeRemoveModal();
  doRemoveStock(sym);
}

// ======================================
// RENDER WATCHLIST
// ======================================
// Helper: build one card's HTML from data object
function _buildWLCard(s, d){
  const _price = d.regularMarketPrice || d.ltp || 0;
  const _prev  = d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || 0;
  const diff   = d.regularMarketChange || ((_price && _prev) ? parseFloat((_price - _prev).toFixed(2)) : 0);
  const pct    = d.regularMarketChangePercent || ((_prev > 0 && diff) ? parseFloat((diff / _prev * 100).toFixed(2)) : 0);
  return `
    <div class="wl-card-wrap" id="wrap-${s}">
      <div class="card" onclick="toggleActions('${s}')" style="padding:10px; position:relative; cursor:pointer; margin-bottom:3px;">
        <button onclick="event.stopPropagation();removeStock('${s}')" style="position:absolute; top:1px; right:2px; color:#ef4444; font-size:6px; background:none; border:none; cursor:pointer; z-index:10; padding:4px;">&#x2715;</button>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
          <div style="width:75px; flex-shrink:0;">
            <span onclick="event.stopPropagation();openDetail('${s}',false)" style="font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:700; cursor:pointer; color:#38bdf8; text-decoration:underline; text-underline-offset:2px;">${s}</span>
          </div>
          <div style="flex:1; min-width:0; display:flex; justify-content:center;">
            <div id="daybar-${s}" style="width:100%; max-width:140px;">${buildDayBar(d)}</div>
          </div>
          <div style="width:105px; flex-shrink:0; text-align:right;">
            <div id="price-${s}" style="font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:700; color:#e2e8f0;">${_price > 0 ? '\u20B9'+_price.toFixed(2) : '<span style="color:#4b6280;font-size:13px;">--</span>'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div id="label52-${s}" style="width:75px; flex-shrink:0; font-size:9px; line-height:1.2; color:#94a3b8; font-weight:600;">
            ${get52WLabel(d)}${getTargetBadge(s, _price)}
          </div>
          <div style="flex:1; min-width:0; display:flex; justify-content:center;">
            <div id="bar52-${s}" style="width:100%; max-width:140px;">${build52WBar(d)}</div>
          </div>
          <div style="width:105px; flex-shrink:0; text-align:right;">
            <div id="change-${s}" style="font-size:13px; font-weight:700; color:${diff >= 0 ? '#22c55e' : '#ef4444'}; white-space:nowrap;">
              ${_price > 0 ? (diff >= 0 ? '+' : '') + '\u20B9' + Math.abs(diff).toFixed(2) + ' (' + (diff >= 0 ? '+' : '') + pct.toFixed(2) + '%)' : '<span style="color:#4b6280;">--</span>'}
            </div>
          </div>
        </div>
      </div>
      <div class="wl-actions-panel" id="act-${s}">
        <button class="act-btn" onclick="openModal('BUY','${s}',${_price});toggleActions('${s}')" style="background:#166534; color:#86efac; padding:8px 0;">BUY</button>
        <button class="act-btn" onclick="openModal('SELL','${s}',${_price});toggleActions('${s}')" style="background:#7f1d1d; color:#fca5a5; padding:8px 0;">SELL</button>
        <button class="act-btn" onclick="chart('${s}');toggleActions('${s}')" style="background:#0f2a40; color:#60a5fa; padding:8px 0;">CHART</button>
        <button class="act-btn" onclick="openNews('${s}');toggleActions('${s}')" style="background:#0f2a40; color:#a78bfa; padding:8px 0;">NEWS</button>
        <button class="act-btn" onclick="setAlert('${s}');toggleActions('${s}')" style="background:#713f12; color:#fde68a; padding:8px 0;">ALERT</button>
        <button class="act-btn" onclick="setTarget('${s}',${_price});toggleActions('${s}')" style="background:#4a1d96; color:#c4b5fd; padding:8px 0;">TARGET</button>
        <button class="act-btn" onclick="openNivi('${s}');toggleActions('${s}')" style="background:#0f2a1a; color:#34d399; border:1px solid #065f46; grid-column:span 2; display:flex; align-items:center; justify-content:center; gap:5px; padding:10px 0;">
          <svg viewBox="0 0 16 16" fill="none" width="13" height="13"><path d="M8 1C8 1 8.7 5.8 12.5 8C8.7 10.2 8 15 8 15C8 15 7.3 10.2 3.5 8C7.3 5.8 8 1 8 1Z" fill="#34d399"/><circle cx="8" cy="8" r="1.4" fill="white" opacity="0.9"/></svg>
          <span style="font-size:13px;">Ask Nivi</span>
        </button>
      </div>
    </div>`;
}

// Helper: patch a single card's price/change in DOM without full re-render
function _patchWLCard(s, d){
  const _price = d.regularMarketPrice || d.ltp || 0;
  const _prev  = d.chartPreviousClose || d.prev_close || d.regularMarketPreviousClose || 0;
  const diff   = d.regularMarketChange || ((_price && _prev) ? parseFloat((_price - _prev).toFixed(2)) : 0);
  const pct    = d.regularMarketChangePercent || ((_prev > 0 && diff) ? parseFloat((diff / _prev * 100).toFixed(2)) : 0);
  const pe = document.getElementById('price-'+s);
  const ce = document.getElementById('change-'+s);
  const db = document.getElementById('daybar-'+s);
  const b5 = document.getElementById('bar52-'+s);
  const l5 = document.getElementById('label52-'+s);
  if(pe) pe.innerHTML = _price > 0 ? '\u20B9'+_price.toFixed(2) : '<span style="color:#4b6280;font-size:13px;">--</span>';
  if(ce) {
    ce.innerHTML = _price > 0
      ? (diff >= 0 ? '+' : '') + '\u20B9' + Math.abs(diff).toFixed(2) + ' (' + (diff >= 0 ? '+' : '') + pct.toFixed(2) + '%)'
      : '<span style="color:#4b6280;">--</span>';
    ce.style.color = diff >= 0 ? '#22c55e' : '#ef4444';
  }
  if(db) db.innerHTML = buildDayBar(d);
  if(b5) b5.innerHTML = build52WBar(d);
  if(l5) l5.innerHTML = get52WLabel(d) + getTargetBadge(s, _price);
  // update action panel prices
  const actPanel = document.getElementById('act-'+s);
  if(actPanel && _price > 0){
    actPanel.querySelectorAll('.act-btn').forEach(btn => {
      const oc = btn.getAttribute('onclick') || '';
      if(oc.includes('openModal')){
        btn.setAttribute('onclick', oc.replace(/openModal\('[^']+','[^']+',[\d.]+\)/, `openModal('${oc.includes('BUY')?'BUY':'SELL'}','${s}',${_price})`));
      }
    });
  }
}

async function renderWL(){
  // ── Phase 1: Instant render from AppState.cache (no waiting) ──────────────────────
  let displayList = AppState.watchlists[AppState.currentWL] ? [...watchlists[AppState.currentWL].stocks] : [];
  // Apply group filter
  if(AppState.currentGroup !== 'ALL' && AppState.groups[AppState.currentGroup]){
    displayList = displayList.filter(s => AppState.groups[AppState.currentGroup].includes(s));
  }
  const watchlistDiv = document.getElementById("watchlist");
  if(!watchlistDiv) return;
  if(!displayList.length){
    watchlistDiv.innerHTML=
    `<div style="text-align:center;color:#4b6280;padding:30px;font-size:13px;">${AppState.watchlists[AppState.currentWL]&&AppState.watchlists[AppState.currentWL].stocks.length===0?'Search stock above to add to '+AppState.watchlists[AppState.currentWL].name:'Type stock name in search box (Press Enter)'}</div>`;
    return;
  }

  let html = "";
  const needFetch = [];

  for(let s of displayList){
    const d = AppState.cache[s]?.data;
    if(d){
      html += _buildWLCard(s, d);
    } else {
      // Placeholder card — instant skeleton, fetch baad ma
      needFetch.push(s);
      html += `
        <div class="wl-card-wrap" id="wrap-${s}">
          <div class="card" onclick="toggleActions('${s}')" style="padding:10px; position:relative; cursor:pointer; margin-bottom:3px;">
            <button onclick="event.stopPropagation();removeStock('${s}')" style="position:absolute; top:1px; right:2px; color:#ef4444; font-size:6px; background:none; border:none; cursor:pointer; z-index:10; padding:4px;">&#x2715;</button>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
              <div style="width:75px; flex-shrink:0;">
                <span onclick="event.stopPropagation();openDetail('${s}',false)" style="font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:700; cursor:pointer; color:#38bdf8; text-decoration:underline; text-underline-offset:2px;">${s}</span>
              </div>
              <div style="flex:1;"></div>
              <div style="width:105px; flex-shrink:0; text-align:right;">
                <div id="price-${s}" style="font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:700; color:#4b6280;">...</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <div id="label52-${s}" style="width:75px; flex-shrink:0;"></div>
              <div style="flex:1;"></div>
              <div style="width:105px; flex-shrink:0; text-align:right;">
                <div id="change-${s}" style="font-size:13px; font-weight:700; color:#4b6280;">--</div>
              </div>
            </div>
          </div>
          <div class="wl-actions-panel" id="act-${s}" style="display:none;"></div>
        </div>`;
    }
  }
  // DOM instant update — user immediately sees cards
  watchlistDiv.innerHTML = html;

  // ── Phase 2: Background fetch for cache-miss stocks, patch DOM individually ─
  if(needFetch.length > 0){
    needFetch.forEach(async s => {
      try{
        const d = await fetchFull(s);
        if(d){
          AppState.cache[s] = { data: d, time: Date.now() };
          // If card still in DOM (user hasn't switched), patch it
          if(document.getElementById('price-'+s)){
            // Rebuild full card to get action panel too
            const wrap = document.getElementById('wrap-'+s);
            if(wrap) wrap.outerHTML = _buildWLCard(s, d);
          }
        }
      }catch(e){ /* silent */ }
    });
  }
}

// ======================================
// RENDER GAINERS/LOSERS (Indices tab)
// ======================================
async function renderIndices(){
  const el=document.getElementById("indices");
  if(!document.getElementById('gmovers')){
    el.innerHTML=`
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button id="gsub-movers" onclick="gainersSubTab('movers')"
          style="flex:1;padding:5px 0;border-radius:8px;border:1px solid #2d5a8e;background:#1e3a5f;color:#38bdf8;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">
          Movers
        </button>
        <button id="gsub-screener" onclick="gainersSubTab('screener')"
          style="flex:1;padding:5px 0;border-radius:8px;border:1px solid #1e2d3d;background:#0f172a;color:#94a3b8;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">
          Screener
        </button>
      </div>
      <div id="gmovers">
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button id="gmov-gainers" onclick="moversSubTab('gainers')" style="flex:1;padding:4px 0;border-radius:6px;border:1px solid #166534;background:#14532d;color:#22c55e;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Gainers</button>
          <button id="gmov-losers" onclick="moversSubTab('losers')" style="flex:1;padding:4px 0;border-radius:6px;border:1px solid #1e2d3d;background:#0f172a;color:#94a3b8;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Losers</button>
        </div>
        <div id="gmov-gainers-list"></div>
        <div id="gmov-losers-list" style="display:none;"></div>
      </div>
      <div id="gscreener" style="display:none;"></div>`;
  }
  renderGainersFromCache();
}

async function refreshGainers(){
  const gm=document.getElementById('gmov-gainers-list');
  if(gm) gm.innerHTML=`<div style="text-align:center;color:#4b6280;padding:20px;font-size:13px;">Fetching fresh data...</div>`;
  const _rSrc=[...new Set([...(typeof AppState.wl!=='undefined'?AppState.wl:[]),...NIFTY50_STOCKS])];
  if(!window._pythonEngineActive){
    _rSrc.forEach(s=>{if(AppState.cache[s]) AppState.cache[s].time=0;});
  }
  await batchFetchStocks(_rSrc);
  renderGainersFromCache();
}

// ======================================
// RENDER GAINERS/LOSERS (Indices tab)
// ======================================

function moversSubTab(t) {
  AppState._moversTab = t;
  const gl = document.getElementById('gmov-gainers-list');
  const ll = document.getElementById('gmov-losers-list');
  const gb = document.getElementById('gmov-gainers');
  const lb = document.getElementById('gmov-losers');
  if(gl) gl.style.display = t==='gainers' ? 'block' : 'none';
  if(ll) ll.style.display = t==='losers' ? 'block' : 'none';
  if(gb){ gb.style.background=t==='gainers'?'#14532d':'#0f172a'; gb.style.color=t==='gainers'?'#22c55e':'#94a3b8'; gb.style.borderColor=t==='gainers'?'#166534':'#1e2d3d'; }
  if(lb){ lb.style.background=t==='losers'?'#7f1d1d':'#0f172a'; lb.style.color=t==='losers'?'#ef4444':'#94a3b8'; lb.style.borderColor=t==='losers'?'#991b1b':'#1e2d3d'; }
}

function renderGainersFromCache(){
  const _gainSrc=[...new Set([...(typeof AppState.wl!=='undefined'?AppState.wl:[]),...NIFTY50_STOCKS])];
  const allStocks=_gainSrc;
  const results=allStocks.map(s=>{
    const d=AppState.cache[s]?.data; if(!d||!d.chartPreviousClose) return null;
    const diff=d.regularMarketPrice-d.chartPreviousClose;
    const pct=(diff/d.chartPreviousClose*100)||0;
    return {sym:s,price:d.regularMarketPrice,diff,pct};
  }).filter(Boolean);

  const refreshBtn=`<button onclick="refreshGainers()" style="background:#1e3a5f;color:#38bdf8;border:1px solid #2d5a8e;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Refresh</button>`;

  const gEl = document.getElementById('gmov-gainers-list');
  const lEl = document.getElementById('gmov-losers-list');
  if(!gEl || !lEl) return;

  if(results.length===0){
    gEl.innerHTML=`<div style="text-align:center;padding:20px;"><div style="color:#4b6280;font-size:12px;margin-bottom:12px;">No cached data \u2014 Press Refresh to load</div>${refreshBtn}</div>`;
    lEl.innerHTML='';
    return;
  }

  const gainers=[...results].filter(x=>x.pct>0).sort((a,b)=>b.pct-a.pct);
  const losers=[...results].filter(x=>x.pct<0).sort((a,b)=>a.pct-b.pct);

  let gHtml=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span style="font-size:11px;font-weight:700;color:#22c55e;">${gainers.length} Gainers</span>${refreshBtn}
  </div><div style="background:#111827;border-radius:8px;overflow:hidden;">`;
  gainers.forEach((s,i)=>{
    const diff=Math.abs(s.price-(s.price/(1+s.pct/100))).toFixed(2);
    gHtml+=`<div onclick="openDetail('${s.sym}',false)" style="display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:6px 10px;gap:6px;border-bottom:${i<gainers.length-1?'1px solid rgba(255,255,255,0.04)':'none'};cursor:pointer;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${s.sym}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">\u20b9${s.price.toFixed(2)}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#22c55e;text-align:right;">+\u20b9${diff} (+${s.pct.toFixed(2)}%)</span>
    </div>`;
  });
  gHtml+=`</div>`;
  gEl.innerHTML=gHtml;

  let lHtml=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span style="font-size:11px;font-weight:700;color:#ef4444;">${losers.length} Losers</span>${refreshBtn}
  </div><div style="background:#111827;border-radius:8px;overflow:hidden;">`;
  losers.forEach((s,i)=>{
    const diff=Math.abs(s.price-(s.price/(1+s.pct/100))).toFixed(2);
    lHtml+=`<div onclick="openDetail('${s.sym}',false)" style="display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:6px 10px;gap:6px;border-bottom:${i<losers.length-1?'1px solid rgba(255,255,255,0.04)':'none'};cursor:pointer;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${s.sym}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">\u20b9${s.price.toFixed(2)}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#ef4444;text-align:right;">-\u20b9${diff} (${s.pct.toFixed(2)}%)</span>
    </div>`;
  });
  lHtml+=`</div>`;
  lEl.innerHTML=lHtml;

  moversSubTab(AppState._moversTab);
}
// ======================================
// UPDATE HEADER INDICES
// ======================================
async function updateHeaderIndices(){
  if(!document.getElementById('indicesStrip')?.children.length) renderHeaderStrip();
  for(let i of AppState.indicesList){
    let d=AppState.cache[i.sym]?.data||await fetchFull(i.sym,true);
    if(!d) continue;
    const diff=d.regularMarketPrice-d.chartPreviousClose;
    const pct=(diff/d.chartPreviousClose*100)||0;
    const key=i.sym.replace("^","");
    const pe=document.getElementById("hidx-"+key+"-p");
    const ce=document.getElementById("hidx-"+key+"-c");
if(pe){
      const p=d.regularMarketPrice;
      const oldVal=parseFloat(pe.innerText.replace(/[,]/g,''))||0;
      pe.innerText=p.toLocaleString('en-IN',{maximumFractionDigits:2});
      if(oldVal>0&&p!==oldVal){
        pe.classList.add(p>oldVal?'flash-green':'flash-red');
        setTimeout(()=>pe.classList.remove('flash-green','flash-red'),1200);
      }
    }
    if(ce){
      const adiff=Math.abs(diff);
      const diffStr='₹'+adiff.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
      ce.innerText=(diff>=0?'+':'-')+diffStr+' ('+(diff>=0?'+':'-')+Math.abs(pct).toFixed(2)+'%)';
      ce.style.color=diff>=0?"#22c55e":"#ef4444";
    }
  }
  await updateGiftNifty();
}
const GIFT_CACHE_MS=60000;

async function updateGiftNifty(){
    const pe=document.getElementById('hidx-__GIFT__-p');
    const ce=document.getElementById('hidx-__GIFT__-c');
    if(!pe||!ce) return;
    if(AppState._giftNiftyCache&&(Date.now()-AppState._giftNiftyCacheTime<GIFT_CACHE_MS)){
        _renderGiftNifty(AppState._giftNiftyCache,pe,ce); return;
    }
    try{
        const snap = await firebase.firestore()
            .collection('RealTradePro').doc('gift_nifty').get();
        const d = snap.data();
        if(!d||!d.price) return;
        const payload = {price: d.price, change: d.change_abs ?? d.change ?? 0, changePct: d.change_pct ?? d.change ?? 0};
        AppState._giftNiftyCache = payload;
        AppState._giftNiftyCacheTime = Date.now();
        _renderGiftNifty(payload, pe, ce);
    }catch(e){ if(ce) ce.innerText='N/A'; }
}
function _renderGiftNifty(d,pe,ce){
  const isUp=d.change>=0;
  const sign=isUp?'+':'';
  pe.innerText=d.price.toLocaleString('en-IN',{maximumFractionDigits:2});
  ce.innerText=`${sign}${d.change.toLocaleString('en-IN',{minimumFractionDigits:2})} (${sign}${Math.abs(d.changePct).toFixed(2)}%)`;
  ce.style.color=isUp?'#22c55e':'#ef4444';
}
// ======================================
// HEADER INDICES STRIP RENDERER
// ======================================
function renderHeaderStrip(){
  const strip=document.getElementById('indicesStrip');
  if(!strip) return;
  strip.innerHTML=indicesList.map((idx,i)=>{
    const key=idx.sym.replace('^','');
    const sep=i<indicesList.length-1?`<div style="width:1px;background:#1e3a5f;height:32px;flex-shrink:0;"></div>`:'';
    return `
      <div style="text-align:center;cursor:pointer;padding:2px 10px;scroll-snap-align:start;flex-shrink:0;position:relative;" onclick="openDetail('${idx.sym}',true)">
        <div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;white-space:nowrap;">${idx.name}</div>
        <div id="hidx-${key}-p" style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#e2e8f0;white-space:nowrap;">--</div>
        <div id="hidx-${key}-c" style="font-size:10px;font-weight:700;color:#94a3b8;line-height:1.3;white-space:nowrap;">--</div>
        ${i>=3?`<span onclick="event.stopPropagation();removeIndex(${i})" style="position:absolute;top:0;right:2px;font-size:9px;color:#4b6280;cursor:pointer;line-height:1;">✕</span>`:''}
      </div>${sep}`;
  }).join('');
}

function removeIndex(i){
  if(i<3){showPopup('Default indices cannot be removed.');return;}
  indicesList.splice(i,1);
  saveIndicesList();
  renderHeaderStrip();
  updateHeaderIndices();
}

// Add Index Modal
function openAddIndexModal(){
  document.getElementById('addIdxOverlay').style.display='flex';
  document.getElementById('addIdxInput').value='';
  document.getElementById('addIdxResults').innerHTML='';
  setTimeout(()=>document.getElementById('addIdxInput').focus(),100);
}
function closeAddIndexModal(){
  document.getElementById('addIdxOverlay').style.display='none';
}
async function searchIndexSuggestions(){
  const q=document.getElementById('addIdxInput').value.trim();
  if(q.length<1){document.getElementById('addIdxResults').innerHTML='';return;}
  const apiUrl=getActiveGASUrl();
  try{
    const r=await fetch(`${apiUrl}?type=search&q=${encodeURIComponent(q)}`);
    const j=await r.json();
    const res=(j.results||[]).filter(x=>x.type==='INDEX'||x.symbol?.startsWith('^'));
    document.getElementById('addIdxResults').innerHTML=res.length
      ?res.map(x=>`<div onclick="confirmAddIndex('${x.symbol}','${(x.name||x.symbol).replace(/'/g,"\\'")}') " style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #1e2d3d;font-size:13px;color:#e2e8f0;font-family:'Rajdhani',sans-serif;">
          <span style="font-weight:700;color:#38bdf8;">${x.symbol}</span>
          <span style="color:#94a3b8;font-size:11px;margin-left:6px;">${x.name||''}</span>
        </div>`).join('')
      :'<div style="padding:8px 12px;font-size:12px;color:#4b6280;">No indices found. Try: ^CNXIT, ^NSMIDCP, ^CNXAUTO</div>';
  }catch(e){document.getElementById('addIdxResults').innerHTML='<div style="padding:8px 12px;font-size:12px;color:#ef4444;">Search failed</div>';}
}
function confirmAddIndex(sym,name){
  if(indicesList.find(x=>x.sym===sym)){showPopup('Already added');closeAddIndexModal();return;}
  indicesList.push({sym,name});
  saveIndicesList();
  renderHeaderStrip();
  // Fetch and update the new index
  fetchFull(sym,true).then(()=>updateHeaderIndices());
  closeAddIndexModal();
  showPopup(name+' added');
}
// Patch visible WL cards from AppState.cache — no full re-render, no GAS call
function _patchVisibleWLPrices(){
  let displayList = AppState.watchlists[AppState.currentWL] ? [...watchlists[AppState.currentWL].stocks] : [];
  if(AppState.currentGroup !== 'ALL' && AppState.groups[AppState.currentGroup]){
    displayList = displayList.filter(s => AppState.groups[AppState.currentGroup].includes(s));
  }
  displayList.forEach(s => {
    const d = AppState.cache[s]?.data;
    if(d && document.getElementById('price-'+s)){
      _patchWLCard(s, d);
    }
  });
}

// ======================================
// UPDATE PRICES — THE FINAL ARCHITECT VERSION
// ======================================
async function updatePrices(){
  const activeWl = AppState.watchlists[AppState.currentWL]?.stocks
    ? [...watchlists[AppState.currentWL].stocks]
    : (window.currentWl || []);
  if(activeWl.length === 0) return;

  // ── GAS Fallback mode — Python engine stale ──
  if(window._useGASPrices){
    try{
      await batchFetchStocks(activeWl);
      _patchVisibleWLPrices();
      updateHeaderIndices();
      updatePriceTicker();
    }catch(e){}
    return;
  }

  // ── Task 3: If Python engine active, refresh AppState.cache from Firebase first ──
  if(window._pythonEngineActive){
    try{
      const db = firebase.firestore();
      const doc = await db.collection('RealTradePro').doc('live_prices').get();
      if(doc.exists){
        const prices = doc.data().prices || {};
        activeWl.forEach(s => {
          const p = prices[s + (s.includes('.') ? '' : '.NS')]; // 🟢 Smart Symbol Check
          if(p){ 
            const existing = AppState.cache[s]?.data || {};
            AppState.cache[s] = { data: Object.assign({}, existing, p), time: Date.now() }; 
            AppState.lastUpdatedMap[s] = Date.now(); 
          }
        });
      }
    }catch(e){ /* silent */ }
  }

  // 1. Market Status ane Batch Fetch
  const isMarketOpen = getMarketStatus().open;
  if (isMarketOpen && !window._pythonEngineActive) {
    try { await batchFetchStocks(activeWl); } catch(e) {}
  }

  // 2. Main Watchlist Loop
  for(let s of activeWl){
    if(!AppState.cache[s]?.data) continue;

    const fund = AppState.cache[s]?.fundamentals || {};
    let d = { ...AppState.cache[s].data }; 
    
    // 🔥 THE BRAHMASTRA FIX: Number Extraction
    const getRealVal = (val) => {
       if (val !== null && typeof val === 'object') {
           return Number(val.doubleValue || val.integerValue || val.stringValue || 0);
       }
       return Number(val || 0);
    };

    // Fundamentals Force Sync
    let fund_h52 = getRealVal(fund.h52 || fund.high52);
    let fund_l52 = getRealVal(fund.l52 || fund.low52);
    if (fund_h52 > 0) d.h52 = fund_h52;
    if (fund_l52 > 0) d.l52 = fund_l52;

    // --- ASALI CALCULATION START ---
    const mktOpen = getMarketStatus().open;
    let price = parseFloat(Number(
    mktOpen
    ? (d.ltp || d.regularMarketPrice || d.price || d.close || 0)
    : (d.regularMarketPrice || d.price || d.close || d.ltp || 0)
    ).toFixed(2));
    let prev = parseFloat(Number(d.prevClose || d.regularMarketPreviousClose || d.chartPreviousClose || d.prev || 0).toFixed(2));
    let diff = parseFloat((price - prev).toFixed(2));
    let pct = prev > 0 ? parseFloat(((diff / prev) * 100).toFixed(2)) : 0;    
    
    let pe = document.getElementById(`price-${s}`), ce = document.getElementById(`change-${s}`);
    
    if(pe){
      let op = parseFloat(pe.innerText.replace(/[₹,]/g,"")) || 0;
      pe.innerText = "₹" + price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); // 🟢 Localized Currency Format
      
      const wrap = pe.closest('.card') || pe.parentElement;
      if(price > op){ pe.classList.add("flash-green"); if(wrap) wrap.classList.add("flash-green"); }
      else if(price < op){ pe.classList.add("flash-red"); if(wrap) wrap.classList.add("flash-red"); }
      setTimeout(() => { pe.classList.remove("flash-green","flash-red"); if(wrap) wrap.classList.remove("flash-green","flash-red"); }, 1000);

      // Bars & Banners
      const bar52Elem = document.getElementById(`bar52-${s}`);
      if(bar52Elem) bar52Elem.innerHTML = build52WBar(d);
      
      const label52Elem = document.getElementById(`label52-${s}`);
      if(label52Elem) label52Elem.innerHTML = get52WLabel(d) + getTargetBadge(s, price);
      
      const dayBarElem = document.getElementById(`daybar-${s}`);
      if(dayBarElem) dayBarElem.innerHTML = buildDayBar(d);

      checkAlerts(s, price); checkTargets(s, price); checkVolumeSpike(s, d);
      AppState.lastUpdatedMap[s] = Date.now();
    }

    if(ce){
      const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
      ce.innerHTML = sign + '₹' + Math.abs(diff).toFixed(2) + ' <span style="font-size:12px;">(' + sign + pct.toFixed(2) + '%)</span>';
      ce.style.color = diff > 0 ? "#22c55e" : (diff < 0 ? "#ef4444" : "#64748b");
    }
  }

  // Indices & Gift Nifty logic emne em rehva do (E barabar che)
  updateHeaderIndices();
  await updateGiftNifty();
  updatePriceTicker();
}
// ======================================
// PIE CHART (Portfolio Diversity)
// ======================================
const PIE_COLORS=['#38bdf8','#22c55e','#f59e0b','#ef4444','#a78bfa','#fb7185','#34d399','#fbbf24','#60a5fa','#f472b6','#4ade80','#facc15'];

function drawPieChart(){
  const canvas=document.getElementById("pieChart");
  if(!canvas) return;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,260,260);

  if(h.length===0){
    ctx.fillStyle="#4b6280";ctx.font="13px Rajdhani";ctx.textAlign="center";
    ctx.fillText("No holdings",130,135);
    document.getElementById("pieLegend").innerHTML="";
    return;
  }

  let totalVal=h.reduce((s,x)=>s+(x.ltp?x.ltp*x.qty:x.price*x.qty),0);
  if(totalVal===0) return;

  let startAngle=-Math.PI/2;
  let legendHtml="";
  const cx=130,cy=130,r=110,inner=60;

  h.forEach((x,i)=>{
    let val=x.ltp?x.ltp*x.qty:x.price*x.qty;
    let pct=val/totalVal;
    let endAngle=startAngle+(pct*2*Math.PI);
    let color=PIE_COLORS[i%PIE_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,startAngle,endAngle);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
    ctx.strokeStyle="#0a0f1a";ctx.lineWidth=2;ctx.stroke();

    // percent label
    if(pct>0.04){
      let midAngle=startAngle+pct*Math.PI;
      let lx=cx+Math.cos(midAngle)*(r*0.7);
      let ly=cy+Math.sin(midAngle)*(r*0.7);
      ctx.fillStyle="white";ctx.font="bold 11px JetBrains Mono";ctx.textAlign="center";
      ctx.fillText((pct*100).toFixed(1)+"%",lx,ly+4);
    }

    legendHtml+=`<div style="display:flex;align-items:center;gap:4px;font-size:11px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;"></div>
      <span>${x.sym} (${(pct*100).toFixed(1)}%)</span>
    </div>`;

    startAngle=endAngle;
  });

  // donut hole
  ctx.beginPath();ctx.arc(cx,cy,inner,0,2*Math.PI);
  ctx.fillStyle="#0a0f1a";ctx.fill();

  // center text
  ctx.fillStyle="#38bdf8";ctx.font="bold 12px JetBrains Mono";ctx.textAlign="center";
  ctx.fillText(h.length+" stocks",cx,cy+4);

  document.getElementById("pieLegend").innerHTML=legendHtml;
}

// ======================================
// RENDER HOLDINGS
// ======================================
function buildDayBar(d){
  if(!d||!d.regularMarketDayHigh||!d.regularMarketDayLow) return '';
  const lo=d.regularMarketDayLow, hi=d.regularMarketDayHigh, cur=d.regularMarketPrice;
  const range=hi-lo; if(range<=0) return '';
  const pct=Math.min(100,Math.max(0,((cur-lo)/range)*100)).toFixed(0);
  return '<div style="margin:0;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;font-family:\'JetBrains Mono\',monospace;font-size:9px;font-weight:700;line-height:1;margin-bottom:2px;">'
    +'<span style="color:#ef4444;">'+lo.toFixed(2)+'</span>'
    +'<span style="color:#4b6280;font-size:8px;font-weight:600;">DAY</span>'
    +'<span style="color:#22c55e;">'+hi.toFixed(2)+'</span></div>'
    +'<div style="background:#1e2d3d;border-radius:2px;height:3px;position:relative;">'
    +'<div style="position:absolute;left:0;width:'+pct+'%;height:100%;background:linear-gradient(90deg,#ef4444,#22c55e);border-radius:2px;"></div>'
    +'<div style="position:absolute;left:calc('+pct+'% - 2px);top:-1px;width:4px;height:4px;background:white;border-radius:50%;box-shadow:0 0 2px rgba(255,255,255,0.6);"></div>'
    +'</div></div>';
}

// -- 52W BAR (inline visual) --
function build52WBar(d){
  if(!d||!d.fiftyTwoWeekHigh||!d.fiftyTwoWeekLow) return '';
  const lo=d.fiftyTwoWeekLow, hi=d.fiftyTwoWeekHigh, cur=d.regularMarketPrice;
  const range=hi-lo; if(range<=0) return '';
  const pct=Math.min(100,Math.max(0,((cur-lo)/range)*100)).toFixed(0);
  return '<div style="margin:0;margin-top:4px;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;font-family:\'JetBrains Mono\',monospace;font-size:9px;font-weight:700;line-height:1;margin-bottom:2px;">'
    +'<span style="color:#ef4444;">'+lo.toFixed(2)+'</span>'
    +'<span style="color:#4b6280;font-size:8px;font-weight:600;">52W</span>'
    +'<span style="color:#22c55e;">'+hi.toFixed(2)+'</span></div>'
    +'<div style="background:#1e2d3d;border-radius:2px;height:3px;position:relative;">'
    +'<div style="position:absolute;left:0;width:'+pct+'%;height:100%;background:linear-gradient(90deg,#ef4444,#22c55e);border-radius:2px;"></div>'
    +'<div style="position:absolute;left:calc('+pct+'% - 2px);top:-1px;width:4px;height:4px;background:#38bdf8;border-radius:50%;box-shadow:0 0 2px rgba(56,189,248,0.6);"></div>'
    +'</div></div>';
}

function get52WLabel(d){
  if(!d||!d.fiftyTwoWeekHigh||!d.fiftyTwoWeekLow) return '';
  const p=d.regularMarketPrice, hi=d.fiftyTwoWeekHigh, lo=d.fiftyTwoWeekLow;
  const fromHi=((hi-p)/hi*100).toFixed(1);
  if(p>=hi*0.97) return '<span style="color:#22c55e;font-weight:700;font-size:9px;">** Near 52W High</span>';
  if(p<=lo*1.03) return '<span style="color:#ef4444;font-weight:700;font-size:9px;">!! Near 52W Low</span>';
  return '<span style="color:#4b6280;font-size:10px;">'+String.fromCharCode(8595)+fromHi+'% from H</span>';
}

// ======================================
// FEATURE 2: STOCK NEWS
// ======================================
function openNews(sym) {
function checkAlerts(sym, currentPrice) {
  var updated = false;
  alerts.forEach(function(a) {
    if (a.sym !== sym || a.triggered) return;
    var hit = false;
    if (a.dir === 'above' && currentPrice >= parseFloat(a.price)) hit = true;
    if (a.dir === 'below' && currentPrice <= parseFloat(a.price)) hit = true;
    if (hit) {
      var msg = "🔔 " + sym + " " + (a.dir==='below'?'▼':'▲') + " ₹" + a.price + " — CMP ₹" + currentPrice.toFixed(2);
      showPopup(msg, 6000);
      playAlertSound();
      // Browser push notification
      if (Notification && Notification.permission === 'granted') {
        new Notification("RealTraderPro Alert", { body: msg, icon: '/favicon.ico' });
      }
      a.triggered    = true;
      a.triggeredAt  = new Date().toLocaleString("en-IN");
      a.triggeredPrice = currentPrice;
      updated = true;
    }
  });
  if (updated) localStorage.setItem("AppState.alerts", JSON.stringify(AppState.alerts));
}

// ======================================
// VOLUME SPIKE DETECTOR
// Triggered on every price refresh (market hours only)
// 1.5x avg volume = alert + tone. Once per stock per day.
// ======================================
let _volSpikeAlerted = {};

function checkVolumeSpike(sym, data) {
  if (!data) return;
  const vol    = data.regularMarketVolume || data.volume || 0;
  const avgVol = data.avgVolume || data.averageDailyVolume3Month || 0;
  if (!vol || !avgVol || avgVol === 0) return;

  const ratio = vol / avgVol;
  if (ratio < 1.5) return;

  // Din ma ek j vaar alert
  const today = new Date().toISOString().split('T')[0];
  if (_volSpikeAlerted[sym] === today) return;
  _volSpikeAlerted[sym] = today;

  const ratioStr = ratio.toFixed(1);
  const volStr   = vol >= 1e7 ? (vol/1e7).toFixed(1)+'Cr'
                 : vol >= 1e5 ? (vol/1e5).toFixed(1)+'L'
                 : vol >= 1e3 ? (vol/1e3).toFixed(1)+'K'
                 : vol.toString();

  playAlertSound();
  showPopup(`🔥 ${sym} Volume Spike! ${ratioStr}x avg (${volStr})`, 7000);

  // Browser notification — app open hoy tyare notification bar ma pan aavse
  if (Notification && Notification.permission === 'granted') {
    new Notification('🔥 Volume Spike — ' + sym, {
      body: ratioStr + 'x avg volume (' + volStr + ')',
      icon: '/favicon.ico'
    });
  }
}

function sortAZ(){
  AppState.watchlists[AppState.currentWL].stocks.sort((a,b)=>AppState.azAsc?a.localeCompare(b):b.localeCompare(a));
  AppState.azAsc=!AppState.azAsc; saveWatchlists(); renderWL();
}
function sortPrice(){
  AppState.watchlists[AppState.currentWL].stocks.sort((a,b)=>{let pa=AppState.cache[a]?.data?.regularMarketPrice||0,pb=AppState.cache[b]?.data?.regularMarketPrice||0;return AppState.priceAsc?pa-pb:pb-pa;});
  AppState.priceAsc=!AppState.priceAsc; saveWatchlists(); renderWL();
}
function sortPercent(){
  AppState.watchlists[AppState.currentWL].stocks.sort((a,b)=>{let da=AppState.cache[a]?.data,db=AppState.cache[b]?.data;let pa=da?(da.regularMarketPrice-da.chartPreviousClose)/da.chartPreviousClose:0;let pb=db?(db.regularMarketPrice-db.chartPreviousClose)/db.chartPreviousClose:0;return AppState.percentAsc?pa-pb:pb-pa;});
  AppState.percentAsc=!AppState.percentAsc; saveWatchlists(); renderWL();
}
