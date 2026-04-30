// ========================================
// UTILITIES - Helper Functions
// ========================================

// ========================================
// INDIAN NUMBER FORMAT (₹)
// ========================================
function inr(n){
  if(isNaN(n)) return '₹0';
  const abs=Math.abs(n);
  let s=abs.toFixed(2);
  let [intPart,dec]=s.split('.');
  if(intPart.length>3){
    let last3=intPart.slice(-3);
    let rest=intPart.slice(0,-3);
    rest=rest.replace(/\B(?=(\d{2})+(?!\d))/g,',');
    intPart=rest+','+last3;
  }
  return (n<0?'-':'')+'₹'+intPart+'.'+dec;
}

// ========================================
// TIME AGO (for last updated)
// ========================================
function timeAgo(ts){
  if(!ts) return '';
  const diff=Math.floor((Date.now()-ts)/1000);
  if(diff<60) return `${diff}s ago`;
  if(diff<3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

// ========================================
// HOLDING DAYS COUNTER
// ========================================
function holdingDays(buyDate){
  if(!buyDate) return null;
  const buy=new Date(buyDate);
  const now=new Date();
  const diff=Math.floor((now-buy)/(1000*60*60*24));
  return diff;
}

function holdingDaysLabel(days){
  if(days===null) return '';
  if(days===0) return 'Today';
  if(days<30) return `${days}d`;
  if(days<365) return `${Math.floor(days/30)}mo ${days%30}d`;
  return `${Math.floor(days/365)}yr ${Math.floor((days%365)/30)}mo`;
}

// ========================================
// POPUP & ERROR MESSAGES
// ========================================
function showPopup(msg, duration=3000){
  const el=document.getElementById("alertPopup");
  const msgEl=document.getElementById("alertMsg");
  if(!el || !msgEl) {
    // Fallback if DOM not ready
    alert(msg);
    return;
  }
  msgEl.innerText=msg;
  el.style.display="block";
  setTimeout(()=>{el.style.display="none";},duration);
}
// ======================================
// RENDER WATCHLIST TABS
// ======================================
function renderWLTabs() {
  const bar = document.getElementById("wlTabsBar");
  if (!bar) return;
  let html = "";
  AppState.watchlists.forEach((w, i) => {
    const isActive = (i === AppState.currentWL);
    html += `<button class="group-btn${isActive ? ' active' : ''}"
      onclick="switchWL(${i})"
      oncontextmenu="event.preventDefault();renameWL(${i})"
      ondblclick="renameWL(${i})"
      title="Long press / double-tap to rename"
      style="${isActive ? 'border-color:#38bdf8;color:#38bdf8;' : ''}"
      data-wlidx="${i}"
    >${w.name} ${isActive ? '▼' : ''}</button>`;
  });
  if (AppState.watchlists.length < 6) {
    html += `<button onclick="addWL()" style="background:#0a1628;border:1px dashed #2d3f52;color:#4b6280;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;">+ Add</button>`;
  }
  const gKeys = Object.keys(AppState.groups);
  if (gKeys.length > 0) {
    html += `<span style="color:#2d3f52;font-size:13px;padding:0 2px;line-height:1;align-self:center;">|</span>`;
    gKeys.forEach(g => {
      const isGrpActive = (AppState.currentGroup === g);
      html += `<button class="group-btn${isGrpActive ? ' active' : ''}"
        onclick="filterGroup('${g}')"
        data-group="${g}"
        style="${isGrpActive ? 'border-color:#f59e0b;color:#f59e0b;background:#291d05;' : ''}"
      >${g}</button>`;
    });
  }
  bar.innerHTML = html;
}

function switchWL(idx) {
  AppState.currentWL = idx;
  AppState.currentGroup = 'ALL';
  AppState.wl = AppState.watchlists[AppState.currentWL].stocks;
  localStorage.setItem("currentWL", AppState.currentWL);
  renderWLTabs();
  if (typeof renderWL === 'function') renderWL();
}

function addWL() {
  AppState._wlModalMode = 'add';
  AppState._wlModalIdx = -1;
  document.getElementById('wlNameModalTitle').innerText = '+ New Watchlist';
  document.getElementById('wlNameInput').value = 'Watchlist ' + (AppState.watchlists.length + 1);
  const m = document.getElementById('wlNameModal');
  m.style.display = 'flex';
  setTimeout(() => { const inp = document.getElementById('wlNameInput'); inp.focus(); inp.select(); }, 100);
}

function renameWL(idx) {
  AppState._wlModalMode = 'rename';
  AppState._wlModalIdx = idx;
  document.getElementById('wlNameModalTitle').innerText = 'Rename Watchlist';
  document.getElementById('wlNameInput').value = AppState.watchlists[idx].name;
  const m = document.getElementById('wlNameModal');
  m.style.display = 'flex';
  setTimeout(() => { const inp = document.getElementById('wlNameInput'); inp.focus(); inp.select(); }, 100);
}

function filterGroup(g) {
  AppState.currentGroup = (AppState.currentGroup === g) ? 'ALL' : g;
  renderWLTabs();
  if (typeof renderWL === 'function') renderWL();
}

function showError(msg){
  if(AppState.errorShownThisSession) return;
  AppState.errorShownThisSession=true;
  const errorMsg=document.getElementById("errorMsg");
  const errorBanner=document.getElementById("errorBanner");
  if(errorMsg) errorMsg.innerText=msg;
  if(errorBanner) errorBanner.style.display="block";
  setTimeout(()=>{
    if(errorBanner) errorBanner.style.display="none";
  },8000);
}
// ======================================
// WATCHLIST NAME MODAL
// ======================================
function confirmWLName() {
  const val = document.getElementById('wlNameInput')?.value.trim();
  if (!val) { showPopup('Name required'); return; }
  closeWLNameModal();
  if (AppState._wlModalMode === 'add') {
    AppState.watchlists.push({ name: val, stocks: [] });
    saveWatchlists();
    switchWL(AppState.watchlists.length - 1);
    showPopup(`'${val}' added`);
  } else {
    AppState.watchlists[AppState._wlModalIdx].name = val;
    saveWatchlists();
    renderWLTabs();
    showPopup(`Renamed to '${val}'`);
  }
}

function closeWLNameModal() {
  const modal = document.getElementById('wlNameModal');
  if (modal) modal.style.display = 'none';
}
// ========================================
// PRICE ALERT SOUND
// ========================================
function playAlertSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [523,659,784].forEach((freq,i)=>{
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value=freq;
      o.type='sine';
      g.gain.setValueAtTime(0,ctx.currentTime+i*0.15);
      g.gain.linearRampToValueAtTime(0.3,ctx.currentTime+i*0.15+0.05);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+i*0.15+0.2);
      o.start(ctx.currentTime+i*0.15);
      o.stop(ctx.currentTime+i*0.15+0.2);
    });
  }catch(e){}
}

// ========================================
// MARKET STATUS (IST time based)
// ========================================
function getMarketStatus(){
  const istStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
  const ist = new Date(istStr);
  const day = ist.getDay();
  const h = ist.getHours();
  const m = ist.getMinutes();
  const mins = h * 60 + m; 
  const openTime = 9 * 60 + 15;   // 9:15 AM
  const closeTime = 15 * 60 + 30; // 3:30 PM
  
  if(day === 0 || day === 6) {
    return {open: false, label: 'Market Closed (Weekend)', color: '#ef4444'};
  }
  if(mins >= openTime && mins <= closeTime) {
    return {open: true, label: 'Market Open', color: '#22c55e'};
  }
  if(mins < openTime) {
    return {open: false, label: `Opens at 9:15 AM`, color: '#f59e0b'};
  }
  return {open: false, label: 'Market Closed', color: '#ef4444'};
}

function updateMarketStatus(){
  const el = document.getElementById("marketStatus");
  if(!el) return;
  const s = getMarketStatus();
  el.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${s.color};margin-right:4px;${s.open ? 'animation:blink 1s infinite' : ''}"></span>${s.label}`;
  el.style.color = s.color;
}

// ========================================
// LIVE CLOCK (IST)
// ========================================
function startClock(){
  function tick(){
    const now=new Date();
    const ist=new Date(now.getTime()+(5.5*60*60*1000));
    const hh=String(ist.getUTCHours()).padStart(2,'0');
    const mm=String(ist.getUTCMinutes()).padStart(2,'0');
    const ss=String(ist.getUTCSeconds()).padStart(2,'0');
    const el=document.getElementById("liveClock");
    if(el) el.innerText=`${hh}:${mm}:${ss} IST`;
  }
  tick(); 
  setInterval(tick,1000);
}

// ========================================
// LOADER OVERLAY
// ========================================
function showLoader(msg="Loading..."){
  const lm = document.getElementById("loaderMsg");
  const lo = document.getElementById("loaderOverlay");
  if(lm) lm.innerText=msg;
  if(lo) lo.style.display="flex";
}

function hideLoader(){
  const lo = document.getElementById("loaderOverlay");
  if(lo) lo.style.display="none";
}

// ========================================
// INFO TOOLTIP SYSTEM
// ========================================
function showInfoTip(key){
  const tip = INFO_TIPS[key];
  if(!tip) return;
  const old = document.getElementById('infoTipBox');
  if(old) old.remove();
  const box = document.createElement('div');
  box.id = 'infoTipBox';
  box.style.cssText = 'position:fixed;z-index:9999;background:#0f1e33;border:1px solid #38bdf8;border-radius:10px;padding:10px 14px;max-width:260px;font-size:11px;color:#cbd5e1;line-height:1.6;white-space:pre-line;box-shadow:0 4px 20px rgba(0,0,0,0.6);top:50%;left:50%;transform:translate(-50%,-50%);';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <span style="font-size:12px;font-weight:700;color:#38bdf8;">${key}</span>
    <span onclick="document.getElementById('infoTipBox').remove()" style="cursor:pointer;color:#94a3b8;font-size:16px;line-height:1;">✕</span>
  </div>${tip.replace(/\n/g,'<br>')}`;
  setTimeout(()=>{ 
    document.addEventListener('click', function _cl(e){ 
      if(!box.contains(e.target)){box.remove();document.removeEventListener('click',_cl);} 
    }); 
  }, 100);
  document.body.appendChild(box);
}

function iBtn(key){ 
  return `<span onclick="event.stopPropagation();showInfoTip('${key}')" style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#1e3a5f;color:#38bdf8;font-size:8px;font-weight:700;cursor:pointer;margin-left:3px;flex-shrink:0;vertical-align:middle;">i</span>`; 
}

// ========================================
// SAVE WATCHLISTS (with Firebase sync)
// ========================================
function saveWatchlists(){
  localStorage.setItem("watchlists",JSON.stringify(AppState.watchlists));
  localStorage.setItem("currentWL",AppState.currentWL);
  AppState.wl = AppState.watchlists[AppState.currentWL].stocks;
  localStorage.setItem("wl",JSON.stringify(AppState.wl));
  if (AppState.currentUser) saveUserData('watchlists');
  _syncWatchlistToFirebase();
}

function _syncWatchlistToFirebase(){
  if(typeof firebase === 'undefined') return;
  try{
    const allSyms = [...new Set(AppState.watchlists.flatMap(w => w.stocks || []))];
    firebase.firestore()
      .collection('RealTradePro').doc('config')
      .set({ watchlist: allSyms, updated_at: new Date().toISOString() }, { merge: true })
      .then(()=>{})
      .catch(e => console.warn('[Watchlist] Firebase sync failed:', e));
  }catch(e){ console.warn('[Watchlist] sync error:', e); }
}

// ========================================
// GET TV SYMBOL FOR CHART
// ========================================
function getTVSymbol(sym){
  if(sym==="^NSEI") return "NIFTY";
  if(sym==="^BSESN") return "SENSEX";
  if(sym==="^NSEBANK") return "BANKNIFTY";
  return sym;
}

function chart(sym, isIndex){
  isIndex=(isIndex===true||isIndex==='true'||false);
  var finalSym=sym, exchange="NSE";
  var indexMap={
    "^NSEI":"NIFTY","^BSESN":"SENSEX","^NSEBANK":"BANKNIFTY",
    "NSEI":"NIFTY","BSESN":"SENSEX","NSEBANK":"BANKNIFTY",
    "NIFTY":"NIFTY","SENSEX":"SENSEX","BANKNIFTY":"BANKNIFTY"
  };
  if(indexMap[sym]){
    finalSym=indexMap[sym];
    exchange=finalSym==="SENSEX"?"BSE":"NSE";
  } else if(isIndex){
    finalSym=getTVSymbol(sym)||sym;
    exchange=finalSym==="SENSEX"?"BSE":"NSE";
  }
  window.open("https://www.tradingview.com/chart/?symbol="+exchange+":"+finalSym);
}

// ========================================
// AVG vs CMP BAR (Holdings)
// ========================================
function getAvgVsCMPBar(avg, cmp){
  const isAbove = cmp >= avg;
  const diff = Math.abs(cmp - avg);
  const pct = Math.min(100, (diff / avg * 100)).toFixed(1);
  const fillW = Math.min(95, parseFloat(pct) * 2);
  return `<div style="font-size:9px;color:#4b6280;margin-bottom:2px;">
    CMP vs Avg  -  ${isAbove ? '+' : '-'} ${pct}% ${isAbove ? 'above avg' : 'below avg'}
  </div>
  <div style="background:#1e2d3d;border-radius:4px;height:5px;position:relative;">
    <div style="position:absolute;left:${isAbove?50:Math.max(5,50-fillW)}%;width:${Math.min(fillW,45)}%;height:100%;background:${isAbove?'#22c55e':'#ef4444'};border-radius:4px;"></div>
    <div style="position:absolute;left:50%;top:-1px;width:2px;height:7px;background:#94a3b8;border-radius:1px;"></div>
  </div>`;
}

// ========================================
// SAVE INDICES LIST
// ========================================
function saveIndicesList(){
  try{
    localStorage.setItem('indicesList',JSON.stringify(AppState.indicesList));
  }catch(e){}
}

// ======================================
// GLOBAL MARKETS TICKER
// ======================================
async function updateGlobalTicker() {
  const track = document.getElementById('globalTickerTrack');
  if (!track) return;
  const data = await fetchGlobalMarkets();
  const items = [];
  
  Object.entries(GLOBAL_SYMS).forEach(([label, sym]) => {
    const d = data[sym] || data[sym.replace('^','')] || AppState._globalCache[sym] || AppState._globalCache[sym.replace('^','')];
    if (!d || !d.price) return;
    const price = d.price;
    const prev  = d.prevClose || price;
    const chg   = price - prev;
    const pct   = prev ? (chg / prev * 100) : 0;
    items.push({ label, price, chg, pct });
  });

  if (items.length === 0) {
    track.innerHTML = '<span style="display:inline-flex;align-items:center;gap:3px;padding:0 12px;"><span class="gticker-label" style="color:#4b6280;font-size:9px;">Global markets unavailable · Market closed or API limit</span></span>';
    track.style.animation = 'none';
    return;
  }

  const buildItem = (it) => {
    const up  = it.chg >= 0;
    const cls = up ? 'gticker-up' : 'gticker-dn';
    const sign = up ? '+' : '';
    const fmtP = it.label === 'USD/INR'
      ? it.price.toFixed(2)
      : it.price >= 1000
        ? it.price.toLocaleString('en-US', {maximumFractionDigits:0})
        : it.price.toFixed(2);
        
    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:0 10px;border-right:1px solid #1e2d3d;">` +
      `<span class="gticker-label">${it.label}</span>` +
      `<span class="gticker-val">${fmtP}</span>` +
      `<span class="${cls}">${sign}${it.pct.toFixed(2)}%</span>` +
      `</span>`;
  };

  const html = items.map(buildItem).join('');
  track.innerHTML = html + html;
  const duration = Math.max(40, items.length * 8);
  track.style.animation = `tickerScroll ${duration}s linear infinite`;
}

// ======================================
// UPDATE PRICE TICKER
// ======================================
function updatePriceTicker() {
  const bar = document.getElementById('priceTicker');
  const track = document.getElementById('tickerTrack');
  if(!bar || !track) return;

  const items = [];

  const idxMap = {'^NSEI':'NIFTY 50','^BSESN':'SENSEX','^NSEBANK':'BANKNIFTY'};
  Object.entries(idxMap).forEach(([sym,label]) => {
    const d = AppState.cache[sym]?.data;
    if(!d) return;
    const price = d.regularMarketPrice;
    const prev = d.chartPreviousClose || d.regularMarketPreviousClose;
    const chg = prev ? price - prev : 0;
    const pct = prev ? (chg/prev*100) : 0;
    items.push({sym:label, price, chg, pct});
  });

  AppState.wl.forEach(sym => {
    const d = AppState.cache[sym]?.data;
    if(!d) return;
    const price = d.regularMarketPrice;
    const prev = d.chartPreviousClose || d.regularMarketPreviousClose;
    const chg = prev ? price - prev : 0;
    const pct = prev ? (chg/prev*100) : 0;
    items.push({sym, price, chg, pct});
  });

  if(items.length === 0) { bar.style.display='none'; return; }

  bar.style.display = 'flex';

  const buildItem = (item) => {
    const up = item.chg >= 0;
    const arrowSvg = up
      ? '<svg viewBox="0 0 10 10" width="7" height="7" style="display:inline-block;vertical-align:middle;"><polygon points="5,1 9,9 1,9" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 10 10" width="7" height="7" style="display:inline-block;vertical-align:middle;"><polygon points="5,9 9,1 1,1" fill="currentColor"/></svg>';
    const cls = up ? 'ticker-up' : 'ticker-dn';
    const sign = up ? '+' : '';
    const chgStr = (up?'+':'')+inr(Math.abs(item.chg));
    return `<span class="ticker-item">
      <span class="ticker-sym">${item.sym}</span>
      <span class="ticker-price">${inr(item.price)}</span>
      <span class="${cls}">${arrowSvg}${chgStr} (${sign}${item.pct.toFixed(2)}%)</span>
    </span>`;
  };

  const html = items.map(buildItem).join('');
  track.innerHTML = html + html;
  const duration = Math.max(25, items.length * 4);
  track.style.animation = `tickerScroll ${duration}s linear infinite`;
}
// Auto-start tickers
document.addEventListener('DOMContentLoaded', () => {
  updateGlobalTicker();
  setInterval(updateGlobalTicker, 60000); // 1 min refresh
});

// Register critical utils for safety
window.updateGlobalTicker = updateGlobalTicker;
window.updatePriceTicker = updatePriceTicker;
window.renderWLTabs = renderWLTabs;
window.saveWatchlists = saveWatchlists;
window.switchWL = switchWL;
window.addWL = addWL;
window.renameWL = renameWL;

console.log('✅ utils.js loaded successfully');
window.filterGroup = filterGroup;
window.showPopup = showPopup;
window.getMarketStatus = getMarketStatus;
window.confirmWLName = confirmWLName;
window.closeWLNameModal = closeWLNameModal;
