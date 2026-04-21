// ========================================
// API MODULE — RealTradePro
// ========================================
// Depends on: AppState, cache, getMarketStatus, showPopup, showError (app.js)

// ── GAS API URLs ──
const API="https://script.google.com/macros/s/AKfycbxW8rj5alGlk3JckSK0_NRGjOpqFhGaC7ifEfa1VnLEtnBYvwO2jZ2nu_0BkH-X7wSF/exec";
const API2="https://script.google.com/macros/s/AKfycbwEltygGQ4C2LIfYSAJcKu_gFQF1iNciZkZytG020yDoyktpbz4aNKsEqSj1wKXm7kUAQ/exec";
const API3="https://script.google.com/macros/s/AKfycbycNOhJtgcjt4RTMSag5ruZvPhcNaKAlXwAdiQvoBDGfvmDIEKKHDQiMIAIpmJq2kwXTA/exec";
const API4="https://script.google.com/macros/s/AKfycbwr9sKAbHjmVf48Ihp2PJq8xjNv-D6kglwFKqY8Uxwke99icv5JCNa6RiABdmm3G_lP/exec";
const API5="https://script.google.com/macros/s/AKfycbzc6tzmWVfGbpMa7ocVxg2bYlutvTRbPRbEZrqz2WtLib2MAqUCzsUz-Q9XACXDz34O/exec";
let _urlRotationIndex = 0;

function getActiveGASUrl() {
  const urls = [
    localStorage.getItem('customAPI')||API,
    localStorage.getItem('customAPI2')||API2,
    localStorage.getItem('customAPI3')||API3,
    localStorage.getItem('customAPI4')||API4,
    localStorage.getItem('customAPI5')||API5
  ].filter(Boolean);
  if(urls.length === 0) return API;
  const url = urls[_urlRotationIndex % urls.length];
  _urlRotationIndex++;
  return url;
}

const API_NIVI = getActiveGASUrl();

// ── GAS Fallback State ──
window._useGASPrices = false;

function monitorSystemHealth() {
  if(typeof firebase === 'undefined') return;
  try {
    firebase.firestore().collection('system').doc('health').onSnapshot(doc => {
      if(!doc.exists) return;
      const status = doc.data().python_engine;
      window._pythonEngineActive = (status === 'running');
    });
  } catch(e) { window._pythonEngineActive = false; }
}

function startEngineStaleCheck() {
  setInterval(async () => {
    try {
      if (window._useGASPrices) {
        const snap = await firebase.firestore().collection('RealTradePro').doc('live_prices').get();
        const updatedAt = snap.data()?.updated_at;
        if (!updatedAt) return;
        if (Date.now() - new Date(updatedAt).getTime() < 30000) {
          window._useGASPrices = false;
          hideGASFallbackBar();
          showPopup('✅ Python Engine recovered — live prices resumed', 3000);
        }
        return;
      }
      if (!window._pythonEngineActive) return;
      const snap = await firebase.firestore().collection('RealTradePro').doc('live_prices').get();
      const updatedAt = snap.data()?.updated_at;
      if (!updatedAt) return;
      if (Date.now() - new Date(updatedAt).getTime() > 120000) showGASFallbackBar();
    } catch(e) {}
  }, 30000);
}

function showGASFallbackBar() {
  if (document.getElementById('gas-fallback-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'gas-fallback-bar';
  bar.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:99999;background:#7c2d12;color:#fef2f2;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;border-bottom:2px solid #ef4444;box-shadow:0 2px 8px rgba(0,0,0,0.5);`;
  bar.innerHTML = `<span>⚠️ Python Engine stale — prices may be outdated</span><div style="display:flex;gap:8px;"><button onclick="userEnableGASPrices()" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Switch to GAS</button><button onclick="hideGASFallbackBar()" style="background:#374151;color:#d1d5db;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Dismiss</button></div>`;
  document.body.prepend(bar);
}

function hideGASFallbackBar() { document.getElementById('gas-fallback-bar')?.remove(); }

function userEnableGASPrices() {
  window._useGASPrices = true;
  const bar = document.getElementById('gas-fallback-bar');
  if (bar) {
    bar.style.background = '#14532d';
    bar.innerHTML = `<span>🔄 GAS prices active — auto-switching back when engine recovers</span><button onclick="hideGASFallbackBar();window._useGASPrices=false;" style="background:#22c55e;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">Dismiss</button>`;
  }
  updatePrices();
}

function fetchWithTimeout(url, ms=8000){
  const ctrl = new AbortController();
  const tid = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {signal: ctrl.signal}).finally(()=>clearTimeout(tid));
}

function _N(d){
  if(!d) return null;
  const price = d.regularMarketPrice||d.ltp||d.price||d.close||0;
  if(!price) return null;
  const prevClose = d.chartPreviousClose||d.regularMarketPreviousClose||d.prevClose||d.prev_close||d.prev||price;
  const open = (d.regularMarketOpen!=null&&d.regularMarketOpen>0)?d.regularMarketOpen:(d.open!=null&&d.open>0?d.open:price);
  const high = d.regularMarketDayHigh||d.high||price;
  const low  = d.regularMarketDayLow||d.low||price;
  const h52  = d.fiftyTwoWeekHigh||d.week52High||d.high52||d.h52||high;
  const l52  = d.fiftyTwoWeekLow||d.week52Low||d.low52||d.l52||low;
  const volume = d.regularMarketVolume||d.today_volume||d.volume||0;
  const avgVol = d.averageDailyVolume3Month||d.avg_vol_3m||0;
  const change    = d.regularMarketChange??d.change??(price-prevClose);
  const changePct = d.regularMarketChangePercent??d.change_pct??d.changePct??(prevClose>0?((price-prevClose)/prevClose*100):0);
  const pe=d.trailingPE??d.pe??null;
  const eps=d.epsTrailingTwelveMonths??d.eps??null;
  const mktCap=d.marketCap??d.mktCap??null;
  const bv=d.bookValue??null;
  const fwdPE=d.forwardPE??null;
  const divYld=d.dividendYield??null;
  return {
    regularMarketPrice:price, chartPreviousClose:prevClose, regularMarketOpen:open,
    regularMarketDayHigh:high, regularMarketDayLow:low, fiftyTwoWeekHigh:h52, fiftyTwoWeekLow:l52,
    regularMarketVolume:volume, averageDailyVolume3Month:avgVol,
    regularMarketChange:parseFloat(change.toFixed(2)), regularMarketChangePercent:parseFloat(changePct.toFixed(2)),
    trailingPE:pe, epsTrailingTwelveMonths:eps, marketCap:mktCap, bookValue:bv, forwardPE:fwdPE, dividendYield:divYld,
    ltp:price, price:price, prevClose:prevClose, prev_close:prevClose, open:open, high:high, low:low,
    h52:h52, l52:l52, high52:h52, low52:l52, week52High:h52, week52Low:l52,
    volume:volume, avg_vol_3m:avgVol, change:parseFloat(change.toFixed(2)),
    change_pct:parseFloat(changePct.toFixed(2)), changePct:parseFloat(changePct.toFixed(2)),
    pe:pe, eps:eps, mktCap:mktCap,
    _source:d._source||'normalized',
    ...(d.symbol?{symbol:d.symbol}:{}),
    ...(d.name?{name:d.name}:{}),
    ...(d.exchange?{exchange:d.exchange}:{}),
    ...(d.ts?{ts:d.ts}:{}),
    ...(d.updated_at?{updated_at:d.updated_at}:{}),
  };
}

function normalizeBatchItem(gasData){ return _N(gasData); }

async function batchFetchStocks(symbols, isIndex=false){
  if(!symbols||symbols.length===0) return;
  if(!isIndex && !getMarketStatus().open){
    try{
      const db = firebase.firestore();
      let stored = 0;
      try{
        const lpDoc = await db.collection('RealTradePro').doc('live_prices').get();
        if(lpDoc.exists){
          const prices = lpDoc.data().prices || {};
          symbols.forEach(s => {
            const p = prices[s+'.NS']||prices[s+'.BO']||prices[s];
            if(p&&(p.ltp||p.regularMarketPrice||p.close||p.prev_close)){
              const normalized = _N(Object.assign({},p,{_source:'firebase_lp_closed'}));
              if(!normalized) return;
              cache[s]={data:normalized,time:Date.now()};
              lastUpdatedMap[s]=Date.now();
              stored++;
            }
          });
        }
      }catch(e){}
      const remaining = symbols.filter(s=>!cache[s]?.data?._source?.startsWith('firebase'));
      if(remaining.length>0){
        await Promise.all(remaining.map(async s=>{
          try{
            const snap = await db.collection('olhcv').doc(s).get();
            if(snap.exists){
              const p = snap.data();
              if(p&&p.close&&p.close>0){
                const normalized=_N(Object.assign({},p,{_source:'firebase_olhcv_closed'}));
                if(!normalized) return;
                cache[s]={data:normalized,time:Date.now()};
                lastUpdatedMap[s]=Date.now();
                stored++;
              }
            }
          }catch(e){}
        }));
      }
      if(stored>0){ console.log('[Market Closed] Firebase loaded:',stored,'stocks — zero GAS calls'); return; }
    }catch(e){ console.warn('[Market Closed] Firebase batch load failed:',e.message); }
    return;
  }
  if(window._pythonEngineActive&&!isIndex){
    try{
      const db=firebase.firestore();
      const doc=await db.collection('RealTradePro').doc('live_prices').get();
      if(doc.exists){
        const prices=doc.data().prices||{};
        let stored=0;
        symbols.forEach(s=>{
          const p=prices[s+'.NS']||prices[s+'.BO']||prices[s];
          if(p){
            const normalized=_N(Object.assign({},p,{_source:'firebase_live'}));
            if(!normalized) return;
            cache[s]={data:normalized,time:Date.now()};
            lastUpdatedMap[s]=Date.now();
            stored++;
          }
        });
        if(stored>0){ console.log('[Firebase] Live prices loaded:',stored,'stocks'); return; }
      }
    }catch(fbErr){ console.warn('[Firebase] live_prices fetch failed:',fbErr); }
  }
  const syms=symbols.map(s=>isIndex?s:s+'.NS').join(',');
  const urls=[localStorage.getItem('customAPI')||API,localStorage.getItem('customAPI2')||API2,localStorage.getItem('customAPI3')||API3,localStorage.getItem('customAPI4')||API4,localStorage.getItem('customAPI5')||API5].filter(Boolean);
  async function tryBatch(apiUrl){
    try{
      const r=await fetchWithTimeout(`${apiUrl}?type=batch&s=${syms}`,8000);
      const j=await r.json();
      if(!j||j.error) return false;
      let stored=0;
      Object.entries(j).forEach(([sym,gasData])=>{
        const normalized=normalizeBatchItem(gasData);
        if(!normalized) return;
        const cacheKey=isIndex?sym:sym.replace('.NS','');
        const _existing=cache[cacheKey]?.data||{};
        const _clean=Object.fromEntries(Object.entries(normalized).filter(([,v])=>v!=null&&v!==undefined));
        cache[cacheKey]={data:Object.assign({},_existing,_clean),time:Date.now()};
        lastUpdatedMap[cacheKey]=Date.now();
        stored++;
      });
      return stored>0;
    }catch(e){ return false; }
  }
  for(let i=0;i<urls.length;i++){
    const ok=await tryBatch(urls[i]);
    if(ok){ if(i>0) showPopup('Using API fallback',2000); return; }
  }
  if(!window._pythonEngineActive||isIndex){ await Promise.all(symbols.map(s=>fetchFull(s,isIndex))); }
}

async function fetchFull(sym,isIndex=false){
  let key=sym, symbol=isIndex?sym:sym+".NS";
  let encodedSymbol=symbol.replace(/\^/g,"%5E");
  if(cache[key]&&(Date.now()-cache[key].time<CACHE_TIME)) return cache[key].data;
  if(!isIndex){
    try{
      let fbOhlcv=null;
      try{
        const snap=await firebase.firestore().collection('olhcv').doc(sym.replace(/\.(NS|BO)$/,'')).get();
        if(snap.exists){
          const p=snap.data();
          if(p&&p.close&&p.close>0){
            const mktStatus=getMarketStatus();
            if(!mktStatus.open){
              const closedData=_N(Object.assign({},p,{_source:'firebase_closed'}));
              if(!closedData) return null;
              cache[key]={data:closedData,time:Date.now()};
              lastUpdatedMap[key]=Date.now();
              return closedData;
            }
            fbOhlcv={chartPreviousClose:p.prev,regularMarketOpen:p.open};
          }
        }
      }catch(fbErr){}
      const gasUrl=localStorage.getItem('customAPI')||API;
      let gasLive=null;
      try{
        const r=await fetchWithTimeout(`${gasUrl}?s=${encodedSymbol}`,8000);
        const j=await r.json();
        if(!j.error&&j.chart&&j.chart.result){
          const m=j.chart.result[0].meta;
          gasLive={regularMarketPrice:m.regularMarketPrice,regularMarketDayHigh:m.regularMarketDayHigh,regularMarketDayLow:m.regularMarketDayLow,regularMarketVolume:m.regularMarketVolume,averageDailyVolume3Month:m.averageDailyVolume3Month,fiftyTwoWeekHigh:m.fiftyTwoWeekHigh,fiftyTwoWeekLow:m.fiftyTwoWeekLow,trailingPE:m.trailingPE,epsTrailingTwelveMonths:m.epsTrailingTwelveMonths,marketCap:m.marketCap};
        }
      }catch(gasErr){}
      if(fbOhlcv||gasLive){
        const merged=Object.assign({},fbOhlcv||{},gasLive||{});
        const ltp=merged.regularMarketPrice||0;
        const prev=merged.chartPreviousClose||0;
        if(ltp&&prev){ merged.regularMarketChange=parseFloat((ltp-prev).toFixed(2)); merged.regularMarketChangePercent=parseFloat(((ltp-prev)/prev*100).toFixed(2)); }
        cache[key]={data:merged,time:Date.now()};
        lastUpdatedMap[key]=Date.now();
        return merged;
      }
    }catch(e){}
  }
  const urls=[localStorage.getItem("customAPI")||API,localStorage.getItem('customAPI2')||API2,localStorage.getItem('customAPI3')||API3,localStorage.getItem('customAPI4')||API4,localStorage.getItem('customAPI5')||API5].filter(Boolean);
  async function tryOne(apiUrl){
    try{
      let r=await fetchWithTimeout(`${apiUrl}?s=${encodedSymbol}`,8000);
      let j=await r.json();
      if(j.error||!j.chart||!j.chart.result) return null;
      return j.chart.result[0].meta;
    }catch(e){ return null; }
  }
  for(let i=0;i<urls.length;i++){
    let data=await tryOne(urls[i]);
    if(data){
      if(i>0&&!sessionStorage.getItem('fallbackShown')){ showPopup('Using API fallback',2000); sessionStorage.setItem('fallbackShown','1'); }
      cache[key]={data,time:Date.now()};
      lastUpdatedMap[key]=Date.now();
      return data;
    }
  }
  if(!window._pythonEngineActive){
    const _ms=getMarketStatus();
    if(_ms.open){ showError("All APIs failed  -  Check quota or URLs in Settings"); }
    else { console.warn("[GAS] All APIs failed — market closed, suppressing banner"); }
  }
  return null;
}

// ── Firebase Fundamentals ──
let _fbPreloadController = null;
async function preloadAllFundamentalsFromFirebase() {
  if(_fbPreloadController) _fbPreloadController.abort();
  _fbPreloadController={aborted:false,abort(){this.aborted=true;}};
  const ctrl=_fbPreloadController;
  try{
    const snap=await db.collection('fundamentals').get();
    snap.forEach(doc=>{
      const d=doc.data();
      const sym=doc.id;
      function safeNum(v){return(v===null||v===undefined||isNaN(Number(v)))?null:Number(v);}
      window._firebaseFundCache[sym]={pe:safeNum(d.pe),eps:safeNum(d.eps),marketCap:safeNum(d.marketCap),bookValue:safeNum(d.bookValue),high52:safeNum(d.high52),low52:safeNum(d.low52),_source:'firebase',_ts:Date.now()};
    });
  }catch(e){console.warn('Firebase fundamentals preload failed:',e.message);}
}

function _buildFundDataFromFirebase(raw,sym){
  function fmtCap(v){if(!v||isNaN(v))return'--';if(v>=1e12)return'₹'+(v/1e12).toFixed(2)+'T';if(v>=1e9)return'₹'+(v/1e9).toFixed(2)+'B';if(v>=1e7)return'₹'+(v/1e7).toFixed(2)+'Cr';return'₹'+v.toLocaleString('en-IN');}
  function fmtVol(v){if(!v||isNaN(v))return'--';if(v>=1e7)return(v/1e7).toFixed(2)+'Cr';if(v>=1e5)return(v/1e5).toFixed(2)+'L';return v.toLocaleString('en-IN');}
  const _cacheD=cache[sym]&&cache[sym].data;
  const vol_v=_cacheD&&(_cacheD.regularMarketVolume||_cacheD.volume);
  return{pe:raw.pe!=null&&!isNaN(raw.pe)?parseFloat(raw.pe).toFixed(2):'--',eps:raw.eps!=null&&!isNaN(raw.eps)?'₹'+parseFloat(raw.eps).toFixed(2):'--',mktCap:raw.marketCap!=null?fmtCap(raw.marketCap):'--',bookValue:raw.bookValue!=null&&!isNaN(raw.bookValue)?'₹'+parseFloat(raw.bookValue).toFixed(2):'--',volume:vol_v?fmtVol(vol_v):'--',divYield:'--',forwardPE:'--',forwardEps:'--',earningsDate:'--',exDivDate:'--',_source:'firebase'};
}

async function fetchFundamentals(sym){
  const FUND_KEY='fundCache6_'+sym;
  const cleanSym=sym.replace(/\.NS$/i,'').replace(/\.BO$/i,'').toUpperCase();
  if(window._firebaseFundCache&&window._firebaseFundCache[cleanSym]) return _buildFundDataFromFirebase(window._firebaseFundCache[cleanSym],sym);
  try{
    const stored=JSON.parse(localStorage.getItem(FUND_KEY)||'null');
    if(stored&&stored.ts&&stored.data){
      const age=Date.now()-stored.ts;
      if(age<7*86400000) return stored.data;
      setTimeout(()=>_fetchFundamentalsFromAPI(sym,FUND_KEY),200);
      return stored.data;
    }
  }catch(e){}
  return await _fetchFundamentalsFromAPI(sym,FUND_KEY);
}

function _refreshFundamentalsBackground(sym,cacheKey){ setTimeout(async()=>{await _fetchFundamentalsFromAPI(sym,cacheKey);},100); }

async function _fetchFundamentalsFromAPI(sym,cacheKey){
  let _sheetFund=null;
  if(isSheetEnabled()) _sheetFund=await fetchFundSheet(sym);
  function fmtVol(v){if(!v||isNaN(v))return'--';if(v>=1e7)return(v/1e7).toFixed(2)+'Cr';if(v>=1e5)return(v/1e5).toFixed(2)+'L';return v.toLocaleString('en-IN');}
  function fmtCap(v){if(!v||isNaN(v))return'--';if(v>=1e12)return'₹'+(v/1e12).toFixed(2)+'T';if(v>=1e9)return'₹'+(v/1e9).toFixed(2)+'B';if(v>=1e7)return'₹'+(v/1e7).toFixed(2)+'Cr';return'₹'+v.toLocaleString('en-IN');}
  function fmtDate(ts){if(!ts||isNaN(ts)||ts<=0)return'--';const dt=new Date(ts*1000);const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return dt.getDate()+' '+months[dt.getMonth()]+' '+dt.getFullYear();}
  function safe(v){return(v===undefined||v===null||v!==v)?null:v;}
  let d=null;
  const _quoteUrls=[localStorage.getItem('customAPI')||API,localStorage.getItem('customAPI2')||API2,localStorage.getItem('customAPI3')||API3,localStorage.getItem('customAPI4')||API4,localStorage.getItem('customAPI5')||API5].filter(Boolean);
  const _symNS=sym.endsWith('.NS')?sym:sym+'.NS';
  for(let _qu of _quoteUrls){
    if(d) break;
    try{
      const controller=new AbortController();
      const tid=setTimeout(()=>controller.abort(),15000);
      const r=await fetch(`${_qu}?type=quote&s=${encodeURIComponent(_symNS)}`,{signal:controller.signal});
      clearTimeout(tid);
      const j=await r.json();
      if(j&&!j.error&&j.price) d=j;
    }catch(e){}
  }
  const _cacheD=cache[sym]&&cache[sym].data;
  let pe='--',eps='--',mktCap='--',volume='--',divYield='--',forwardPE='--',bookValue='--',forwardEps='--',earningsDate='--',exDivDate='--';
  if(!d&&_cacheD) d=_cacheD;
  if(d){
    var pe_v=safe(d.pe||d.trailingPE); if(pe_v!==null&&!isNaN(pe_v)&&pe_v>0) pe=parseFloat(pe_v).toFixed(2);
    var eps_v=safe(d.eps||d.epsTrailingTwelveMonths); if(eps_v!==null&&!isNaN(eps_v)) eps='₹'+parseFloat(eps_v).toFixed(2);
    var cap_v=safe(d.mktCap||d.marketCap); if(cap_v!==null&&!isNaN(cap_v)) mktCap=fmtCap(cap_v);
    var vol_v=safe(d.volume||d.regularMarketVolume||(_cacheD&&(_cacheD.regularMarketVolume||_cacheD.volume))||d.averageDailyVolume3Month); if(vol_v) volume=fmtVol(vol_v);
    var dy=safe(d.dividendYield||d.trailingAnnualDividendYield); if(dy!==null&&!isNaN(dy)&&dy>0) divYield=(dy>1?dy:(dy*100)).toFixed(2)+'%';
    var fpe=safe(d.forwardPE||d.priceEpsCurrentYear); if(fpe!==null&&!isNaN(fpe)&&fpe>0&&fpe<1000) forwardPE=parseFloat(fpe).toFixed(2);
    var bv=safe(d.bookValue); if(bv!==null&&!isNaN(bv)&&bv>0) bookValue='₹'+parseFloat(bv).toFixed(2);
    var feps=safe(d.epsForward||d.epsCurrentYear); if(feps!==null&&!isNaN(feps)) forwardEps='₹'+parseFloat(feps).toFixed(2);
    var ets=safe(d.earningsTimestamp||d.earningsTimestampStart||d.earningsTimestampEnd); if(ets!==null&&ets>0) earningsDate=fmtDate(ets);
    var exd=safe(d.exDividendDate||d.dividendDate); if(exd!==null&&exd>0) exDivDate=fmtDate(exd);
  }else if(_cacheD){
    var vol_v2=safe(_cacheD.regularMarketVolume||_cacheD.volume); if(vol_v2) volume=fmtVol(vol_v2);
  }
  if(_sheetFund){
    if(_sheetFund.pe!=null) pe=parseFloat(_sheetFund.pe).toFixed(2);
    if(_sheetFund.eps!=null) eps='₹'+parseFloat(_sheetFund.eps).toFixed(2);
    if(_sheetFund.marketCap!=null) mktCap=fmtCap(_sheetFund.marketCap);
    if(_sheetFund.bookValue!=null) bookValue='₹'+parseFloat(_sheetFund.bookValue).toFixed(2);
  }
  const data={pe,eps,mktCap,volume,divYield,forwardPE,bookValue,forwardEps,earningsDate,exDivDate,_source:_sheetFund?'sheet+yahoo':'yahoo_quote'};
  try{localStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),data}));}catch(e){}
  return data;
}

async function fetchHistory(sym,range='30d',interval='1d'){
  const DAY_KEY='histData_'+sym+'_'+range+'_'+interval;
  const today=new Date().toISOString().split('T')[0];
  try{const stored=JSON.parse(localStorage.getItem(DAY_KEY)||'null');if(stored&&stored.date===today&&stored.data) return stored.data;}catch(e){}
  if(isSheetEnabled()&&(range==='1mo'||range==='30d')){
    try{
      const sheetHist=await fetchHistSheet(sym);
      if(sheetHist&&sheetHist.close&&sheetHist.close.length>=14){
        const lastDate=sheetHist.dates&&sheetHist.dates[sheetHist.dates.length-1];
        const lastMs=lastDate?new Date(lastDate).getTime():0;
        if((Date.now()-lastMs)/(1000*86400)<=7){
          try{localStorage.setItem(DAY_KEY,JSON.stringify({date:today,data:sheetHist}));}catch(e){}
          return sheetHist;
        }
      }
    }catch(e){}
  }
  const urls=[localStorage.getItem('customAPI')||API,localStorage.getItem('customAPI2')||'',localStorage.getItem('customAPI3')||''].filter(Boolean);
  for(let apiUrl of urls){
    try{
      const ctrl=new AbortController();
      const tid=setTimeout(()=>ctrl.abort(),10000);
      const histSym=sym.startsWith('^')?sym:(sym.includes('.')?sym:sym+'.NS');
      const r=await fetch(`${apiUrl}?type=history&s=${histSym}&range=${range}&interval=${interval}`,{signal:ctrl.signal});
      clearTimeout(tid);
      const j=await r.json();
      if(j.error||!j.dates||!j.close) continue;
      if(j.close.length<14) continue;
      const data={dates:j.dates,open:j.open||j.close,high:j.high||j.close,low:j.low||j.close,close:j.close,volume:j.volume||[]};
      try{localStorage.setItem(DAY_KEY,JSON.stringify({date:today,data}));}catch(e){}
      return data;
    }catch(e){continue;}
  }
  return null;
}

async function fetchGlobalMarkets(){
  const now=Date.now();
  if(_globalCacheTime&&(now-_globalCacheTime)<GLOBAL_TTL&&Object.keys(_globalCache).length>0) return _globalCache;
  const syms=Object.values(GLOBAL_SYMS).join(',');
  const urls=[localStorage.getItem('customAPI')||API,localStorage.getItem('customAPI2')||API2,localStorage.getItem('customAPI3')||API3,localStorage.getItem('customAPI4')||API4,localStorage.getItem('customAPI5')||API5].filter(Boolean);
  for(const apiUrl of urls){
    try{
      const r=await fetchWithTimeout(`${apiUrl}?type=batch&s=${encodeURIComponent(syms)}`,8000);
      const data=await r.json();
      if(data&&!data.error&&Object.keys(data).length>0){_globalCache=data;_globalCacheTime=now;return data;}
    }catch(e){continue;}
  }
  return {};
}

async function fetchFundSheet(sym){
  const cleanSym=sym.replace(/\.NS$/i,'').replace(/\.BO$/i,'').toUpperCase();
  if(window._firebaseFundCache&&window._firebaseFundCache[cleanSym]){
    const raw=window._firebaseFundCache[cleanSym];
    return{pe:raw.pe,eps:raw.eps,marketCap:raw.marketCap,bookValue:raw.bookValue,high52:raw.high52,low52:raw.low52};
  }
  try{
    const doc=await db.collection('fundamentals').doc(cleanSym).get();
    if(!doc.exists) return null;
    const d=doc.data();
    function safeNum(v){return(v===null||v===undefined||isNaN(Number(v)))?null:Number(v);}
    window._firebaseFundCache=window._firebaseFundCache||{};
    window._firebaseFundCache[cleanSym]={pe:safeNum(d.pe),eps:safeNum(d.eps),marketCap:safeNum(d.marketCap),bookValue:safeNum(d.bookValue),high52:safeNum(d.high52),low52:safeNum(d.low52),_source:'firestore_direct',_ts:Date.now()};
    const raw=window._firebaseFundCache[cleanSym];
    return{pe:raw.pe,eps:raw.eps,marketCap:raw.marketCap,bookValue:raw.bookValue,high52:raw.high52,low52:raw.low52};
  }catch(e){return null;}
}

async function fetchHistSheet(sym){
  const cleanSym=sym.replace(/\.NS$/i,'').replace(/\.BO$/i,'').toUpperCase();
  if(window._firebaseHistCache&&window._firebaseHistCache[cleanSym]) return window._firebaseHistCache[cleanSym];
  try{
    const doc=await db.collection('histcache').doc(cleanSym).get();
    if(!doc.exists) return null;
    const d=doc.data();
    function fsVal(f){if(!f)return null;if(f.doubleValue!==undefined)return f.doubleValue;if(f.integerValue!==undefined)return Number(f.integerValue);if(f.nullValue!==undefined)return null;return f.stringValue??null;}
    const dataStr=fsVal(d.data);
    if(!dataStr) return null;
    const parsed=JSON.parse(dataStr);
    if(!parsed.close||parsed.close.length<14) return null;
    const lastDate=parsed.dates&&parsed.dates[parsed.dates.length-1];
    const lastMs=lastDate?new Date(lastDate).getTime():0;
    if(lastMs&&(Date.now()-lastMs)>7*86400000) return null;
    const result={dates:parsed.dates,close:parsed.close,open:parsed.close,high:parsed.close,low:parsed.close,volume:[]};
    window._firebaseHistCache=window._firebaseHistCache||{};
    window._firebaseHistCache[cleanSym]=result;
    return result;
  }catch(e){return null;}
}
