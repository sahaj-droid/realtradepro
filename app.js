// ========================================
// FIREBASE MULTI-USER SYSTEM
// ========================================

let currentUser = null; // { userId, name }
let currentPINEntry = '';

// ── Default FF2 URL pre-save (first time only) ──
(function setDefaultFF2Url() {
  const DEFAULT_FF2_URL = "https://script.google.com/macros/s/AKfycbxcIGFZp7IWBSMJVsMIgpPR5oVmiEJbapQyknKrJ8iVpn9ahM6z9hc_QfiDKhhSMGNgiw/exec";
  if (!localStorage.getItem('ff2ApiUrl')) {
    localStorage.setItem('ff2ApiUrl', DEFAULT_FF2_URL);
  }
})();

// ---- PIN Hash (simple SHA-256) ----
async function hashPIN(pin) {
  const msgBuffer = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- App Start: Profile Screen Check ----
async function initApp() {
  // દર વખતે PIN માંગો — savedUser થી સીધો login નહીં
  const savedUser = localStorage.getItem('rtp_current_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    // Profile select skip કરો, સીધા PIN screen પર જાઓ
    localStorage.removeItem('rtp_current_user');
    await showProfileScreen();
    // Auto-select last used user
    setTimeout(() => showPINScreen(user.userId, user.name), 500);
    return;
  }
  await showProfileScreen();
}

// ---- Show Profile Selection Screen ----
async function showProfileScreen() {
  hideAllScreens();
  document.getElementById('profileScreen').style.display = 'flex';

  const profileList = document.getElementById('profileList');
  profileList.innerHTML = '<p style="color:#666;font-size:0.9rem;">Loading...</p>';

  try {
    const snapshot = await db.collection('users').get();
    profileList.innerHTML = '';

    if (snapshot.empty) {
      profileList.innerHTML = '<p style="color:#666;font-size:0.9rem;">No profiles yet. Create one!</p>';
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const profile = data.profile;
      if (!profile) return;

      const card = document.createElement('div');
      card.className = 'profile-card';
      card.onclick = () => showPINScreen(doc.id, profile.name);
      card.innerHTML = `
        <div class="profile-card-avatar">${profile.name.charAt(0).toUpperCase()}</div>
        <div class="profile-card-name">${profile.name}</div>
      `;
      profileList.appendChild(card);
    });
  } catch (e) {
    profileList.innerHTML = '<p style="color:#ef4444;">Firebase error. Check config.</p>';
    console.error(e);
  }
}

// ---- Show PIN Screen ----
function showPINScreen(userId, userName) {
  hideAllScreens();
  currentPINEntry = '';
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('pinUserName').textContent = userName;
  document.getElementById('pinUserAvatar').textContent = userName.charAt(0).toUpperCase();
  document.getElementById('pinError').style.display = 'none';
  document.getElementById('pinScreen').dataset.userId = userId;
  updatePINDots();
}

// ---- PIN Input ----
function pinInput(num) {
  if (currentPINEntry.length >= 4) return;
  currentPINEntry += num;
  updatePINDots();
  if (currentPINEntry.length === 4) {
    setTimeout(verifyPIN, 150);
  }
}

function pinBackspace() {
  currentPINEntry = currentPINEntry.slice(0, -1);
  updatePINDots();
}

function pinClear() {
  currentPINEntry = '';
  updatePINDots();
}

function updatePINDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('dot' + i);
    if (dot) dot.classList.toggle('filled', i < currentPINEntry.length);
  }
}

// ---- Verify PIN ----
async function verifyPIN() {
  const userId = document.getElementById('pinScreen').dataset.userId;
  const pinHash = await hashPIN(currentPINEntry);

  try {
    const doc = await db.collection('users').doc(userId).get();
    const profile = doc.data().profile;

    if (profile.pinHash === pinHash) {
      currentUser = { userId, name: profile.name };
      localStorage.setItem('rtp_current_user', JSON.stringify(currentUser));
      hideProfileScreens();
      await loadUserData();
      // P5: backup label set (loadUserData also sets it, but ensure it's always updated)
      const lbl = document.getElementById('currentUserLabel');
      if (lbl) lbl.textContent = profile.name;
    } else {
      document.getElementById('pinError').style.display = 'block';
      currentPINEntry = '';
      updatePINDots();
    }
  } catch (e) {
    console.error(e);
  }
}

// ---- Show Create Profile Screen ----
function showCreateProfile() {
  hideAllScreens();
  document.getElementById('createProfileScreen').style.display = 'flex';
  document.getElementById('createProfileError').style.display = 'none';
}

// ---- Save New Profile ----
async function saveNewProfile() {
  const name = document.getElementById('newProfileName').value.trim();
  const pin = document.getElementById('newProfilePIN').value.trim();
  const pinConfirm = document.getElementById('newProfilePINConfirm').value.trim();
  const secQ = document.getElementById('newProfileSecQ').value;
  const secA = document.getElementById('newProfileSecA').value.trim().toLowerCase();
  const errEl = document.getElementById('createProfileError');

  // Validation
  if (!name) return showCreateError('Name લખો');
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return showCreateError('PIN 4 digits નો હોવો જોઈએ');
  if (pin !== pinConfirm) return showCreateError('PIN match નથી થતો');
  if (!secA) return showCreateError('Security answer લખો');

  try {
    const pinHash = await hashPIN(pin);
    const secAHash = await hashPIN(secA);
    const userId = 'user_' + Date.now();

    await db.collection('users').doc(userId).set({
      profile: { name, pinHash, secQ, secAHash },
      settings: {},
      watchlists: [],
      holdings: [],
      history: [],
      alerts: []
    });

    // Auto login
    currentUser = { userId, name };
    localStorage.setItem('rtp_current_user', JSON.stringify(currentUser));
    hideProfileScreens();
    await loadUserData();

  } catch (e) {
    showCreateError('Firebase error: ' + e.message);
    console.error(e);
  }
}

function showCreateError(msg) {
  const el = document.getElementById('createProfileError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ---- Forgot PIN ----
function showForgotPIN() {
  hideAllScreens();
  document.getElementById('forgotPINScreen').style.display = 'flex';
  const userId = document.getElementById('pinScreen').dataset.userId;
  document.getElementById('forgotPINScreen').dataset.userId = userId;

  // Show security question
  db.collection('users').doc(userId).get().then(doc => {
    const secQ = doc.data().profile.secQ;
    const questions = {
      dob: 'તમારી Date of Birth શું છે? (DD/MM/YYYY)',
      city: 'તમારું Hometown city કયું છે?',
      school: 'તમારી Primary school નું નામ શું છે?'
    };
    document.getElementById('forgotSecQuestion').textContent = questions[secQ] || secQ;
  });

  document.getElementById('newPINGroup').style.display = 'none';
  document.getElementById('newPINConfirmGroup').style.display = 'none';
  document.getElementById('forgotPINBtn').textContent = 'Verify Answer';
  document.getElementById('forgotPINBtn').onclick = verifySecurityAnswer;
  document.getElementById('forgotPINError').style.display = 'none';
  document.getElementById('forgotSecAnswer').value = '';
}

async function verifySecurityAnswer() {
  const userId = document.getElementById('forgotPINScreen').dataset.userId;
  const answer = document.getElementById('forgotSecAnswer').value.trim().toLowerCase();
  const answerHash = await hashPIN(answer);

  try {
    const doc = await db.collection('users').doc(userId).get();
    const profile = doc.data().profile;

    if (profile.secAHash === answerHash) {
      document.getElementById('newPINGroup').style.display = 'flex';
      document.getElementById('newPINConfirmGroup').style.display = 'flex';
      document.getElementById('forgotPINBtn').textContent = 'Reset PIN';
      document.getElementById('forgotPINBtn').onclick = resetPIN;
      document.getElementById('forgotPINError').style.display = 'none';
    } else {
      document.getElementById('forgotPINError').textContent = '❌ Answer ખોટો છે';
      document.getElementById('forgotPINError').style.display = 'block';
    }
  } catch (e) {
    console.error(e);
  }
}

async function resetPIN() {
  const userId = document.getElementById('forgotPINScreen').dataset.userId;
  const newPIN = document.getElementById('forgotNewPIN').value.trim();
  const confirmPIN = document.getElementById('forgotNewPINConfirm').value.trim();

  if (newPIN.length !== 4 || !/^\d{4}$/.test(newPIN)) {
    document.getElementById('forgotPINError').textContent = '❌ PIN 4 digits નો હોવો જોઈએ';
    document.getElementById('forgotPINError').style.display = 'block';
    return;
  }
  if (newPIN !== confirmPIN) {
    document.getElementById('forgotPINError').textContent = '❌ PIN match નથી થતો';
    document.getElementById('forgotPINError').style.display = 'block';
    return;
  }

  const pinHash = await hashPIN(newPIN);
  await db.collection('users').doc(userId).update({ 'profile.pinHash': pinHash });
  alert('✅ PIN reset થઈ ગયો! ફરી login કરો.');
  showProfileScreen();
}

// ---- Load User Data from Firebase ----
async function loadUserData() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('users').doc(currentUser.userId).get();
    if (!doc.exists) { await startApp(); return; }
    const data = doc.data();

    // ── Smart merge: Firebase wins if it has more/newer data ──
    // Watchlists: Firebase array length > local → use Firebase
    const localWL  = JSON.parse(localStorage.getItem('watchlists') || '[]');
    const fbWL     = data.watchlists || [];
    if (fbWL.length >= localWL.length) {
      localStorage.setItem('watchlists', JSON.stringify(fbWL));
    }

    // Holdings: Firebase wins (authoritative source)
    if ((data.holdings || []).length > 0) {
      localStorage.setItem('h', JSON.stringify(data.holdings));
    }
    // History: merge — Firebase has more entries → use it
    const localHist = JSON.parse(localStorage.getItem('hist') || '[]');
    if ((data.history || []).length >= localHist.length) {
      localStorage.setItem('hist', JSON.stringify(data.history || []));
    }
    // Alerts: Firebase is authoritative
    if ((data.alerts || []).length > 0) {
      localStorage.setItem('alerts', JSON.stringify(data.alerts));
    }
    // Settings: only set if not already configured locally
    if (data.settings) {
      if (data.settings.apiUrl    && !localStorage.getItem('customAPI'))
        localStorage.setItem('customAPI', data.settings.apiUrl);
      if (data.settings.sheetId   && !localStorage.getItem('sheetId'))
        localStorage.setItem('sheetId', data.settings.sheetId);
      if (data.settings.geminiKey && !localStorage.getItem('geminiApiKey'))
        localStorage.setItem('geminiApiKey', data.settings.geminiKey);
    }

    // Update UI label
    const label = document.getElementById('currentUserLabel');
    if (label) label.textContent = currentUser.name;
  } catch (e) {
    console.error('loadUserData error:', e);
  }
  await startApp();
}

// ---- Save User Data to Firebase ----
// ── FIREBASE OPTIMIZED SAVE ──
// field: optional string like 'watchlists'|'holdings'|'history'|'alerts'|'settings'
// Pass field to do targeted update (faster, cheaper). Omit for full save.
async function saveUserData(field) {
  if (!currentUser) return;
  // Rate-limit: skip if last save was < 500ms ago (unless explicit field)
  const now = Date.now();
  if (!field && saveUserData._lastSave && (now - saveUserData._lastSave) < 500) return;
  saveUserData._lastSave = now;
  try {
    let payload = {};
    if (!field || field === 'watchlists') {
      payload.watchlists = JSON.parse(localStorage.getItem('watchlists') || '[]');
    }
    if (!field || field === 'holdings') {
      payload.holdings = JSON.parse(localStorage.getItem('h') || '[]');
    }
    if (!field || field === 'history') {
      payload.history = JSON.parse(localStorage.getItem('hist') || '[]');
    }
    if (!field || field === 'alerts') {
      payload.alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    }
    if (!field || field === 'settings') {
      payload.settings = {
        apiUrl:    localStorage.getItem('customAPI')    || '',
        sheetId:   localStorage.getItem('sheetId')     || '',
        geminiKey: localStorage.getItem('geminiApiKey') || ''
      };
    }
    await db.collection('users').doc(currentUser.userId).update(payload);
  } catch (e) {
    console.error('saveUserData error:', e);
  }
}

// ---- Hide All Profile Screens ----
function hideAllScreens() {
  ['profileScreen','pinScreen','createProfileScreen','forgotPINScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function hideProfileScreens() {
  hideAllScreens();
}

// ---- Logout ----
function logoutUser() {
  localStorage.removeItem('rtp_current_user');
  currentUser = null;
  showProfileScreen();
}
(function(){
  const PASS = "2512";
  const key = "rtp_auth";
  const _saved = localStorage.getItem(key);
  const _ts = localStorage.getItem(key+'_ts');
  const _expired = !_ts || (Date.now() - parseInt(_ts)) > 86400000;
  if(_saved !== PASS || _expired){
    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#0f1e33;border:1px solid #1e3a5f;border-radius:16px;padding:24px 20px;width:min(300px,90vw);text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">🔐</div>
        <div style="font-size:16px;font-weight:700;color:#38bdf8;font-family:'Rajdhani',sans-serif;margin-bottom:4px;">RealTradePro</div>
        <div style="font-size:11px;color:#4b6280;font-family:'Rajdhani',sans-serif;margin-bottom:16px;">Password દાખલ કરો</div>
        <input id="auth-input" type="password" placeholder="••••••" maxlength="10"
          style="width:100%;background:#0a1628;border:1px solid #1e3a5f;color:#e2e8f0;border-radius:10px;padding:10px;font-size:20px;text-align:center;outline:none;letter-spacing:6px;box-sizing:border-box;font-family:'JetBrains Mono',monospace;"/>
        <div id="auth-error" style="font-size:11px;color:#ef4444;margin-top:8px;display:none;">❌ ખોટો Password</div>
        <button id="auth-btn" onclick="(function(){
          const v=document.getElementById('auth-input').value;
          const p='2512';
          if(v===p){localStorage.setItem('rtp_auth',p);localStorage.setItem('rtp_auth_ts',Date.now());document.getElementById('auth-overlay').remove();document.body.style.overflow='';}
          else{const e=document.getElementById('auth-error');e.style.display='block';document.getElementById('auth-input').value='';document.getElementById('auth-input').focus();}
        })()"
          style="background:#065f46;color:#34d399;border:none;border-radius:10px;padding:10px;width:100%;margin-top:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">
          Unlock 🔓
        </button>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(()=>{
      const inp=document.getElementById('auth-input');
      if(inp){inp.focus();inp.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('auth-btn').click();});}
    },100);
  }
})();
const API="https://script.google.com/macros/s/AKfycbxW8rj5alGlk3JckSK0_NRGjOpqFhGaC7ifEfa1VnLEtnBYvwO2jZ2nu_0BkH-X7wSF/exec";
const API2 = "https://script.google.com/macros/s/AKfycbwEltygGQ4C2LIfYSAJcKu_gFQF1iNciZkZytG020yDoyktpbz4aNKsEqSj1wKXm7kUAQ/exec";
const API3 = "https://script.google.com/macros/s/AKfycbycNOhJtgcjt4RTMSag5ruZvPhcNaKAlXwAdiQvoBDGfvmDIEKKHDQiMIAIpmJq2kwXTA/exec";
// ✨ Ask Nivi — merged GAS v2 URL
// API_NIVI → same main GAS URL (askNivi + askMarket both in Code.gs)
const API_NIVI = localStorage.getItem('customAPI') || "https://script.google.com/macros/s/AKfycbxW8rj5alGlk3JckSK0_NRGjOpqFhGaC7ifEfa1VnLEtnBYvwO2jZ2nu_0BkH-X7wSF/exec";
let wl=["SBIN","RELIANCE","TCS"],cache={},CACHE_TIME=4000,h=[],hist=[],alerts=[],currentTrade={},isDark=true;
let azAsc=true,priceAsc=false,percentAsc=false;
let groups={},currentGroup="ALL";
// MULTI-WATCHLIST SYSTEM
// watchlists: [{name:"My WL", stocks:["SBIN","TCS"]}, ...]
let watchlists=[{name:"Watchlist 1",stocks:[]},{name:"Watchlist 2",stocks:[]},{name:"Watchlist 3",stocks:[]}];
let currentWL=0; // index of active watchlist
let currentTradeType="CNC"; // CNC or MIS
// -- FONT SIZE TOGGLE --
const FONT_SIZES = {S:'100%', M:'112%', L:'125%'};
function cycleFontSize(){
  const current = localStorage.getItem('fontSize')||'M';
  const keys = Object.keys(FONT_SIZES);
  const next = keys[(keys.indexOf(current)+1)%keys.length];
  localStorage.setItem('fontSize', next);
  applyFontSize();
}
function applyFontSize(){
  const size = localStorage.getItem('fontSize')||'M';
  document.documentElement.style.fontSize = FONT_SIZES[size];
  const lbl = document.getElementById('fontSizeLabel');
  if(lbl) lbl.innerText = 'FONT: '+size;
}
applyFontSize();
// -- INDIAN NUMBER FORMAT --
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

// NSE Market Holidays 2025 + 2026
const MARKET_HOLIDAYS = [
  {date:"2025-01-26",name:"Republic Day"},
  {date:"2025-02-26",name:"Mahashivratri"},
  {date:"2025-03-14",name:"Holi"},
  {date:"2025-03-31",name:"Id-Ul-Fitr (Ramzan Eid)"},
  {date:"2025-04-10",name:"Shri Ram Navami"},
  {date:"2025-04-14",name:"Dr. Ambedkar Jayanti"},
  {date:"2025-04-18",name:"Good Friday"},
  {date:"2025-05-01",name:"Maharashtra Day"},
  {date:"2025-06-07",name:"Eid ul-Adha (Bakri Eid)"},
  {date:"2025-08-15",name:"Independence Day"},
  {date:"2025-08-27",name:"Ganesh Chaturthi"},
  {date:"2025-10-02",name:"Gandhi Jayanti / Dussehra"},
  {date:"2025-10-24",name:"Diwali (Laxmi Pujan)"},
  {date:"2025-11-05",name:"Diwali (Balipratipada)"},
  {date:"2025-11-15",name:"Gurunanak Jayanti"},
  {date:"2025-12-25",name:"Christmas"},
  {date:"2026-01-15",name:"Maharashtra Municipal Elections"},
  {date:"2026-01-26",name:"Republic Day"},
  {date:"2026-03-03",name:"Holi"},
  {date:"2026-03-26",name:"Shri Ram Navami"},
  {date:"2026-03-31",name:"Shri Mahavir Jayanti"},
  {date:"2026-04-03",name:"Good Friday"},
  {date:"2026-04-14",name:"Dr. Ambedkar Jayanti"},
  {date:"2026-05-01",name:"Maharashtra Day"},
  {date:"2026-05-28",name:"Bakri Id (Eid ul-Adha)"},
  {date:"2026-06-26",name:"Muharram"},
  {date:"2026-09-14",name:"Ganesh Chaturthi"},
  {date:"2026-10-02",name:"Mahatma Gandhi Jayanti"},
  {date:"2026-10-20",name:"Dussehra"},
  {date:"2026-11-10",name:"Diwali (Balipratipada)"},
  {date:"2026-11-24",name:"Prakash Gurpurb Sri Guru Nanak Dev"},
  {date:"2026-12-25",name:"Christmas"}
];

function isMarketHoliday(dateStr){ return MARKET_HOLIDAYS.some(h=>h.date===dateStr); }

function renderHolidays(){
  const el=document.getElementById("holidays");
  if(!el) return;
  const today=new Date().toISOString().split("T")[0];
  const upcoming=MARKET_HOLIDAYS.filter(h=>h.date>=today).slice(0,10);
  const past=MARKET_HOLIDAYS.filter(h=>h.date<today).slice(-5).reverse();
  const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmt=ds=>{const[y,m,d]=ds.split("-");return d+" "+months[parseInt(m)-1]+" "+y;};
  const dayName=ds=>days[new Date(ds).getDay()];
  let html=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
    <button onclick="tab('settings')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;display:flex;align-items:center;gap:4px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>Back
    </button>
    <span style="font-size:12px;font-weight:700;color:#22c55e;letter-spacing:0.5px;">NSE MARKET HOLIDAYS</span>
  </div>`;
  if(upcoming.length===0){html+=`<div style="color:#4b6280;font-size:12px;padding:10px;text-align:center;">No upcoming holidays</div>`;}
  upcoming.forEach(h=>{
    const isToday=h.date===today;
    html+=`<div class="card" style="margin-bottom:5px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${isToday?"#f59e0b":"#e2e8f0"};">${fmt(h.date)}</div>
          <div style="font-size:11px;font-weight:600;color:#38bdf8;margin-top:1px;">${h.name}</div>
          <div style="font-size:9px;color:#4b6280;">${dayName(h.date)}${isToday?"  -  Today!":""}</div>
        </div>
        <div style="font-size:10px;padding:4px 8px;border-radius:6px;background:#7f1d1d;color:#fca5a5;font-weight:700;text-align:center;flex-shrink:0;">Market<br>Closed</div>
      </div>
    </div>`;
  });
  html+=`<div style="font-size:11px;font-weight:700;color:#4b6280;margin:10px 0 6px;">PAST HOLIDAYS</div>`;
  past.forEach(h=>{
    html+=`<div class="card" style="margin-bottom:4px;opacity:0.6;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">${fmt(h.date)}</div>
        <div style="font-size:10px;color:#64748b;">${h.name}</div>
      </div>
      <div style="font-size:9px;color:#4b6280;">${dayName(h.date)}</div>
    </div>`;
  });
  el.innerHTML=html;
}

// -- TRADE TYPE --
function setTradeType(t){
  currentTradeType=t;
  ['CNC','MIS'].forEach(x=>{
    const btn=document.getElementById('type-'+x.toLowerCase());
    if(!btn) return;
    const active=x===t;
    btn.style.background=active?'#1e3a5f':'#1e2d3d';
    btn.style.color=active?'#38bdf8':'#94a3b8';
    btn.style.borderColor=active?'#38bdf8':'#2d3f52';
  });
  updateTaxCalc();
}

// -- TAX CALCULATOR --
function updateTaxCalc(){
  const p=parseFloat(document.getElementById("m-price")?.value)||0;
  const q=parseInt(document.getElementById("m-qty")?.value)||0;
  const box=document.getElementById("taxCalcBox");
  const type=currentTrade.type||'BUY';
  if(!box) return;
  if(!p||!q){ box.style.display="none"; return; }
  box.style.display="block";

  const val=p*q;
  const brok=Math.min(val*0.0015, 20); // 0.15%, max ₹20 per order
  const gst=brok*0.18;
  const exchange=val*0.0000345;

  // STT
  let stt=0;
  if(currentTradeType==="CNC"){
    stt=val*0.001; // 0.1% on buy+sell both
  } else {
    // MIS  -  only on sell side
    if(type==="SELL") stt=val*0.00025;
  }

  const total=brok+gst+exchange+stt;
  const breakeven = type==="BUY" ? p+(total/q) : p-(total/q);

  document.getElementById("tc-value").innerText=inr(val);
  document.getElementById("tc-brokerage").innerText=inr(brok);
  document.getElementById("tc-stt").innerText=inr(stt);
  document.getElementById("tc-exchange").innerText=inr(exchange);
  document.getElementById("tc-gst").innerText=inr(gst);
  document.getElementById("tc-total").innerText=inr(total);
  document.getElementById("tc-breakeven").innerText=inr(breakeven);
}

// -- HOLDING DAYS COUNTER --
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

// -- LAST UPDATED TIMESTAMP --
let lastUpdatedMap={};

function timeAgo(ts){
  if(!ts) return '';
  const diff=Math.floor((Date.now()-ts)/1000);
  if(diff<60) return `${diff}s ago`;
  if(diff<3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

// -- PRICE ALERT SOUND --
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

// -- LOCAL STORAGE LOAD --
try{wl=JSON.parse(localStorage.getItem("wl"))||wl;}catch(e){}
try{h=JSON.parse(localStorage.getItem("h"))||[];}catch(e){}
try{hist=JSON.parse(localStorage.getItem("hist"))||[];}catch(e){}
try{alerts=JSON.parse(localStorage.getItem("alerts"))||[];}catch(e){}
try{isDark=localStorage.getItem("theme")!=="light";}catch(e){}
// Font size init
(function(){ const fs=localStorage.getItem('fontSize')||'medium'; document.documentElement.setAttribute('data-fsize',fs); })();
try{groups=JSON.parse(localStorage.getItem("groups"))||{};}catch(e){}

// MULTI-WATCHLIST: load from localStorage, migrate old wl[] into WL1 if needed
(function(){
  try{
    const saved=JSON.parse(localStorage.getItem("watchlists"));
    if(saved&&Array.isArray(saved)&&saved.length>0){
      watchlists=saved;
    } else {
      // Migrate: put existing wl[] into Watchlist 1
      watchlists=[
        {name:"Watchlist 1",stocks:[...wl]},
        {name:"Watchlist 2",stocks:[]},
        {name:"Watchlist 3",stocks:[]}
      ];
      saveWatchlists();
    }
  }catch(e){
    watchlists=[{name:"Watchlist 1",stocks:[...wl]},{name:"Watchlist 2",stocks:[]},{name:"Watchlist 3",stocks:[]}];
  }
  try{currentWL=parseInt(localStorage.getItem("currentWL"))||0;}catch(e){}
  if(currentWL>=watchlists.length) currentWL=0;
  // keep global wl in sync with active watchlist for legacy code compatibility
  wl=watchlists[currentWL].stocks;
})();

if(!isDark){ document.body.classList.add("light"); }

const INDICES_DEFAULT=[{name:"NIFTY 50",sym:"^NSEI"},{name:"SENSEX",sym:"^BSESN"},{name:"BANK NIFTY",sym:"^NSEBANK"}];
let indicesList=(()=>{try{const s=JSON.parse(localStorage.getItem('indicesList')||'null');return Array.isArray(s)&&s.length?s:INDICES_DEFAULT;}catch(e){return INDICES_DEFAULT;}})();
function saveIndicesList(){try{localStorage.setItem('indicesList',JSON.stringify(indicesList));}catch(e){}}

  const NIFTY50_STOCKS=[
  'RELIANCE','TCS','HDFCBANK','BHARTIARTL','ICICIBANK',
  'INFOSYS','SBIN','HINDUNILVR','ITC','LT',
  'KOTAKBANK','AXISBANK','MARUTI','BAJFINANCE','ASIANPAINT',
  'HCLTECH','ADANIPORTS','TITAN','SUNPHARMA','ULTRACEMCO',
  'WIPRO','NTPC','POWERGRID','NESTLEIND','TECHM',
  'BAJAJFINSV','M&M','ONGC','TATAMOTORS','TATASTEEL',
  'JSWSTEEL','INDUSINDBK','CIPLA','DRREDDY','DIVISLAB',
  'ADANIENT','COALINDIA','BPCL','EICHERMOT','APOLLOHOSP',
  'HEROMOTOCO','GRASIM','BRITANNIA','HINDALCO','TATACONSUM',
  'SBILIFE','HDFCLIFE','BAJAJ-AUTO','SHRIRAMFIN','BEL',
];
  // Stocks from your watchlist CSV (334 stocks)
const POPULAR_STOCKS=[
  'RELTD','ICICIAMC','OLECTRA','KAYNES','BALUFORGE','SUBROS','PWL','GARUDA',
  'JWL','TENNIND','LEMONTREE','SHARDACROP','BSE','GROWW','TRANSRAILL','HBLENGINE',
  'TARIL','SHAKTIPUMP','WAAREEENER','REMSONSIND','SURYAROSNI','VIKRAN','ADANIENSOL','ADANIPOWER',
  'AMBUJACEM','TRIDENT','KPRMILL','ADANIENT','ADANIPORTS','KRN','LGEINDIA','VEDL',
  'CPPLUS','ETERNAL','STYLAMIND','SBIN','RELIANCE','TEXRAIL','WAAREERTL','YATHARTH',
  'JINDRILL','SANDHAR','PREMEXPLN','INTLCONV','DENTA','BHAGYANGR','CHENNPETRO','HFCL',
  'TBZ','NMDC','ELLEN','TDPOWERSYS','LLOYDSENGG','MAITHANALL','IEX','BANCOINDIA',
  'RECLTD','JSLL','SHILPAMED','TATACAP','ACE','MEESHO','GOLDBEES','GOLDETF',
  'ACI','NATCOPHARM','URBANCO','ACMESOLAR','LAURUSLABS','NSDL','ACC','SOUTHWEST',
  'IGIL','GMDCLTD','TMCV','ACGL','TMPV','UNIMECH','STOVEKRAFT','SYRMA',
  'STUDDS','CHEMCON','LENSKART','HEG','TAJGVK','INDOTECH','MOSMALL250','ASHOKLEY',
  'CHALET','MAHEPC','ELECON','HDBFS','VIKRAMSOLR','GREAVESCOT','HONDAPOWER','GLOBECIVIL',
  'ARVSMART','SCI','MOSCHIP','VELJAN','MICEL','SHAILY','IPL','MAZDA',
  'BODALCHEM','GENUSPOWER','SMALLCAP','EIEL','GUJARATPOLY','MKEXIM','ROHLTD','RATNAVEER',
  'OMAXAUTO','TATASTEEL','MEIL','ATULAUTO','BASILIC','INOXINDIA','BLUEJET','PATANJALI',
  'POWERMECH','MOTHERSON','HDFCAMC','JSWCEMENT','HDFCBANK','PAISALO','CUPID','IGARASHI',
  'SUPRIYA','KIRLOSBROS','BONDADA','NILE','VETO','ZENTEC','KPIGREEN','SIMMOND',
  'TECHNOE','ICICIBANK','IMAGICAA','BLUESTARCO','DATAPATTNS','SCHNEIDER','CASTROLIND','AVANTEL',
  'POLYPLEX','SAILIFE','SAIL','HYUNDAI','RTNINDIA','JBMA','ALEMBICLTD','UNIVASTU',
  'AEROENTER','MRPL','REFEX','INDOFARM','MULTIBASE','MADRASFERT','GREENPLY','HSCL',
  'BAJFINANCE','MIRCELECTR','BPL','SUZLON','ZENSARTECH','IRCON','SILVERBEES','VARROC',
  'INDUSINDBK','INTEGRAEN','JINDWORLD','OLAELEC','KECL','ELECTCAST','PAYTM','TITAN',
  'ANTHEM','TRANSWORLD','JKTYRE','INFY','MOIL','SUDARSCHEM','FORCEMOT','GODFRYPHLP',
  'ITC','EKC','TCS','DCMSRIND','ATGL','RATEGAIN','KEC','TANAA',
  'JIOFIN','EXHICON','SHREEOSFM','20MICRONS','MISHTANN','MHLXMIRU','GOODRICKE','STARDELTA',
  'JTLIND','PANCARBON','REXNORD','SOMICONVEY','PIXTRANS','GLOBOFFS','SWISSMLTRY','RDBRL',
  'CHAMBLFERT','MMFL','CEWATER','VMM','SCILAL','IRCTC','HERANBA','NBCC',
  'HEROMOTOCO','IDEA','IFCI','LICI','HINDZINC','HINDCOPPER','HINDALCO','HINDOILEXP',
  'NATIONALUM','SWSOLAR','EFCIL','IREDA','BAJAJ-AUTO','BAJAJHCARE','SYMPHONY','IOLCP',
  'SHILGRAVQ','TEJASNET','JKPAPER','UCOBANK','STALLION','STYRENIX','MCEL','LICHSGFIN',
  'PFC','ZAGGLE','KIRLPNU','ISGEC','GNA','DONEAR','BELRISE','TATAINVEST',
  'PGFOILQ','AEROFLEX','ADANIGREEN','SMLMAH','ELPROINTL','CNINFOTECH','GESHIP','RENUKA',
  'IRB','MOREPENLAB','NHPC','IDFCFIRSTB','IDBI','SHRIRAMPPS','SJVN','DOLATALGO',
  'NTPCGREEN','CANBK','BAJAJHFL','YESBANK','IRFC','ZEEL','IOC','GPPL',
  'MUFTI','VPRPL','INOXWIND','ARISINFRA','GAIL','EXICOM','LXCHEM','BALMLAWRIE',
  'IKIO','VIPULORG','ENGINERSIN','BANKBARODA','ONGC','BHEL','DCXINDIA','SANGHVIMOV',
  'UDS','JSWINFRA','ITI','NTPC','EXIDEIND','COALINDIA','RVNL','TATAPOWER',
  'BEL','PCBL','WPIL','DLINKINDIA','HPL','AKUMS','TRITURBINE','EMSLIMITED',
  'DHARMAJ','GENESYS','WONDERLA','TANLA','TATATECH','ASAHIINDIA','HIGHENE','JKLAKSHMI',
  'WELCORP','TITAGARH','LIQUIDBEES','PREMIERENE','VOLTAS','PARAS','MTARTECH',
  'CDSL','COCHINSHIP','ANUP','GRSE','MAZDOCK','SIEMENS','MAFATIND','LT',
  'DMART','ZUARI','HAL','ABB','APARINDS','VOLTAMP'
];
// ======================================
// LOADER
// ======================================
function showLoader(msg="Loading..."){
  document.getElementById("loaderMsg").innerText=msg;
  document.getElementById("loaderOverlay").style.display="flex";
}
function hideLoader(){
  document.getElementById("loaderOverlay").style.display="none";
}

// ======================================
// WATCHLIST GROUPS
// ======================================
function saveWatchlists(){
  localStorage.setItem("watchlists",JSON.stringify(watchlists));
  localStorage.setItem("currentWL",currentWL);
  wl = watchlists[currentWL].stocks;
  localStorage.setItem("wl",JSON.stringify(wl));
  if (currentUser) saveUserData('watchlists');
}

function renderWLTabs(){
  const bar=document.getElementById("wlTabsBar");
  if(!bar) return;
  let html="";
  watchlists.forEach((w,i)=>{
    const isActive=(i===currentWL);
    html+=`<button class="group-btn${isActive?' active':''}"
      onclick="switchWL(${i})"
      oncontextmenu="event.preventDefault();renameWL(${i})"
      ondblclick="renameWL(${i})"
      title="Long press / double-tap to rename"
      style="${isActive?'border-color:#38bdf8;color:#38bdf8;':''}"
      data-wlidx="${i}"
    >${w.name} ${isActive?'&#9660;':''}</button>`;
  });
  if(watchlists.length<6){
    html+=`<button onclick="addWL()" style="background:#0a1628;border:1px dashed #2d3f52;color:#4b6280;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;">+ Add</button>`;
  }
  bar.innerHTML=html;
}

function switchWL(idx){
  currentWL=idx;
  wl=watchlists[currentWL].stocks;
  localStorage.setItem("currentWL",currentWL);
  renderWLTabs();
  renderWL();
}

// WL Name Modal state
let _wlModalMode='add', _wlModalIdx=-1;

function addWL(){
  _wlModalMode='add';
  _wlModalIdx=-1;
  document.getElementById('wlNameModalTitle').innerText='+ New Watchlist';
  document.getElementById('wlNameInput').value='Watchlist '+(watchlists.length+1);
  const m=document.getElementById('wlNameModal');
  m.style.display='flex';
  setTimeout(()=>{ const inp=document.getElementById('wlNameInput'); inp.focus(); inp.select(); },100);
}

function renameWL(idx){
  _wlModalMode='rename';
  _wlModalIdx=idx;
  document.getElementById('wlNameModalTitle').innerText='Rename Watchlist';
  document.getElementById('wlNameInput').value=watchlists[idx].name;
  const m=document.getElementById('wlNameModal');
  m.style.display='flex';
  setTimeout(()=>{ const inp=document.getElementById('wlNameInput'); inp.focus(); inp.select(); },100);
}

function confirmWLName(){
  const val=document.getElementById('wlNameInput').value.trim();
  if(!val){ showPopup('Name required'); return; }
  closeWLNameModal();
  if(_wlModalMode==='add'){
    watchlists.push({name:val,stocks:[]});
    saveWatchlists();
    switchWL(watchlists.length-1);
    showPopup("'"+val+"' banayo!");
  } else {
    watchlists[_wlModalIdx].name=val;
    saveWatchlists();
    renderWLTabs();
    showPopup("Renamed to '"+val+"'");
  }
}

function closeWLNameModal(){
  document.getElementById('wlNameModal').style.display='none';
}

function renderGroupTabs(){ renderWLTabs(); }
function filterGroup(g){}
function showAddGroupModal(){ addWL(); }
function saveGroup(){}
function deleteGroup(g){}
function addToGroup(sym){}

function triggerWatchlistCSVImport(){
  let inp=document.getElementById("wlCSVInput");
  if(!inp){
    inp=document.createElement("input");
    inp.type="file"; inp.id="wlCSVInput"; inp.accept=".csv,.txt";
    inp.style.display="none";
    inp.onchange=handleWatchlistCSV;
    document.body.appendChild(inp);
  }
  inp.value=""; inp.click();
}

async function handleWatchlistCSV(event){
  const file=event.target.files[0];
  if(!file) return;
  const text=await file.text();
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l);
  let added=0,skipped=0,already=0;
  const cur=watchlists[currentWL];
  for(let line of lines){
    const sym=line.split(",")[0].replace(/\.NS$/i,"").toUpperCase().trim();
    if(!sym||sym.length<1||sym.length>20){ skipped++; continue; }
    if(/^(SYMBOL|STOCK|NAME|SCRIP)/i.test(sym)){ continue; }
    if(cur.stocks.includes(sym)){ already++; continue; }
    cur.stocks.push(sym);
    added++;
  }
  saveWatchlists();
  renderWLTabs();
  await renderWL();
  showPopup(`CSV: ${added} added, ${already} already exist, ${skipped} skipped`);
}

// ======================================
// THEME
// ======================================
function toggleTheme(){
  isDark=!isDark;
  document.body.classList.toggle("light",!isDark);
  const tb=document.getElementById("themeBtn");
  tb.innerHTML=isDark?'<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  localStorage.setItem("theme",isDark?"dark":"light");
}

// ======================================
// SEARCH SUGGESTIONS
// ======================================
// Search debounce timer
let _searchTimer = null;
let _lastSearchVal = "";

function showSuggestions(val) {
  val = val.trim();
  const box = document.getElementById("suggestionBox");
  if (!val || val.length < 1) { box.style.display = "none"; return; }

  // 1. Instant: local POPULAR_STOCKS match (prefix)
  const valUpper = val.toUpperCase();
  const alreadyIn = new Set(wl);
  const localMatches = POPULAR_STOCKS
    .filter(s => s.startsWith(valUpper) && !alreadyIn.has(s))
    .slice(0, 4);

  if (localMatches.length > 0) {
    renderSuggestions(localMatches.map(s => ({symbol: s, name: '', exchange: ''})), box, true);
  }

  // 2. Debounced Yahoo search (300ms)
  if (_searchTimer) clearTimeout(_searchTimer);
  _lastSearchVal = val;
  _searchTimer = setTimeout(() => {
    if (_lastSearchVal !== val) return;
    fetchYahooSuggestions(val, box);
  }, 300);
}

async function fetchYahooSuggestions(val, box) {
  try {
    const api = localStorage.getItem('customAPI') || API;
    const r = await fetch(`${api}?type=search&q=${encodeURIComponent(val)}`);
    const j = await r.json();
    if (!j.ok || !j.results || j.results.length === 0) return;
    // STRICT: Only Indian NSE/BSE stocks (.NS or .BO exchange)
    const alreadyIn = new Set(wl);
    const INDIAN_EXCHANGES = new Set(['NSI','BSE','NSE','NMS']);
    const results = j.results
      .filter(r => {
        const sym = r.symbol || '';
        const exch = (r.exchange || r.exchDisp || '').toUpperCase();
        // Must be .NS or .BO suffix, OR exchange is NSI/BSE
        const isIndian = sym.endsWith('.NS') || sym.endsWith('.BO') || INDIAN_EXCHANGES.has(exch);
        const cleanSym = sym.replace('.NS','').replace('.BO','');
        const notInWL = !alreadyIn.has(cleanSym);
        return isIndian && notInWL;
      })
      .slice(0, 7);
    if (results.length > 0 && _lastSearchVal === val) {
      renderSuggestions(results, box, false);
    }
  } catch(e) {}
}

function renderSuggestions(items, box, isLocal) {
  if (!items || items.length === 0) { box.style.display = "none"; return; }
  box.innerHTML = items.map(item => {
    // Normalize: local items have just symbol string, Yahoo has {symbol,name,exchange}
    const sym = item.symbol || item;
    const rawSym = sym.replace('.NS','').replace('.BO','');
    const name = item.name || '';
    const exch = item.exchange ? `<span style="font-size:9px;color:#4b6280;margin-left:4px;">${item.exchange}</span>` : '';
    const nameHtml = name ? `<div style="font-size:10px;color:#94a3b8;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>` : '';
    return `<div class="suggestion-item" style="padding:7px 14px;" onclick="selectSuggestion('${rawSym}')">
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-weight:700;">${rawSym}</span>${exch}
      </div>
      ${nameHtml}
    </div>`;
  }).join('');
  box.style.display = "block";
}

function selectSuggestion(sym) {
  document.getElementById("searchBox").value = sym;
  hideSuggestions();
  addStock(sym);
}
function hideSuggestions() { document.getElementById("suggestionBox").style.display = "none"; }
document.addEventListener("click", e => { if (!e.target.closest("#searchSection")) hideSuggestions(); });

// ======================================
// POPUP & ERROR (once per session)
// ======================================
let errorShownThisSession = false;

function showPopup(msg,duration=3000){
  const el=document.getElementById("alertPopup");
  document.getElementById("alertMsg").innerText=msg;
  el.style.display="block";
  setTimeout(()=>{el.style.display="none";},duration);
}
function showError(msg){
  if(errorShownThisSession) return; // only once per session
  errorShownThisSession=true;
  document.getElementById("errorMsg").innerText=msg;
  document.getElementById("errorBanner").style.display="block";
  setTimeout(()=>{document.getElementById("errorBanner").style.display="none";},8000);
}

// ======================================
// MARKET STATUS (Zero API  -  IST time based)
// ======================================
function getMarketStatus(){
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.getTime() + (5.5*60*60*1000));
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const mins = h*60+m;
  const open = 9*60+15;  // 9:15 AM
  const close = 15*60+30; // 3:30 PM
  if(day===0||day===6) return {open:false, label:'Market Closed (Weekend)', color:'#ef4444'};
  if(mins>=open && mins<=close) return {open:true, label:'Market Open', color:'#22c55e'};
  if(mins<open) return {open:false, label:`Opens at 9:15 AM`, color:'#f59e0b'};
  return {open:false, label:'Market Closed', color:'#ef4444'};
}

function updateMarketStatus(){
  const el=document.getElementById("marketStatus");
  if(!el) return;
  const s=getMarketStatus();
  el.innerHTML=`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${s.color};margin-right:4px;${s.open?'animation:blink 1s infinite':''}"></span>${s.label}`;
  el.style.color=s.color;
}

// ======================================
// TARGET PRICE PER STOCK
// ======================================
let targets = {};
try{ targets=JSON.parse(localStorage.getItem("targets"))||{}; }catch(e){}

function setTarget(sym, currentPrice){
  currentAlertSym=sym;
  const tbox=document.getElementById("target-modal-box");
  if(!tbox){ showPopup("Target modal missing"); return; }
  document.getElementById("target-title").innerText="Set Target  -  "+sym;
  document.getElementById("target-price").value=targets[sym]||"";
  document.getElementById("target-price").placeholder="Current: ₹"+currentPrice.toFixed(2);
  tbox.style.display="flex";
}
function closeTargetModal(){
  document.getElementById("target-modal-box").style.display="none";
}
function confirmTarget(){
  const price=parseFloat(document.getElementById("target-price").value);
  if(!price||isNaN(price)||price<=0){ showPopup("Invalid price"); return; }
  targets[currentAlertSym]=price;
  localStorage.setItem("targets",JSON.stringify(targets));
  closeTargetModal();
  showPopup("Target set: "+currentAlertSym+" @ ₹"+price);
  renderWL();
}

function checkTargets(sym, currentPrice){
  if(!targets[sym]) return;
  const target=targets[sym];
  if(currentPrice>=target){
    showPopup(`TARGET HIT: ${sym} ₹${currentPrice.toFixed(2)} >= ₹${target}`, 6000);
    delete targets[sym];
    localStorage.setItem("targets",JSON.stringify(targets));
  }
}

function getTargetBadge(sym, price){
  if(!targets[sym]) return '';
  const t=targets[sym];
  const pct=((t-price)/price*100).toFixed(1);
  return '<div style="font-size:9px;color:#f59e0b;font-weight:700;margin-top:1px;">T: ₹'+t+' ('+( pct>0?'+':'')+pct+'%)</div>';
}

// ======================================
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
  cache[sym]={data:d,time:Date.now()};
  const cur=watchlists[currentWL];
  if(cur.stocks.includes(sym)){
    if(dupWarnEnabled) showPopup(sym+' already in '+cur.name);
    document.getElementById("searchBox").value="";
    return;
  }
  cur.stocks.unshift(sym);
  wl=cur.stocks;
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
  document.getElementById("remove-title").innerText="Remove "+sym+" from "+watchlists[currentWL].name+"?";
  document.getElementById("remove-confirm-sym").value=sym;
  rmbox.style.display="flex";
}
function doRemoveStock(sym){
  const cur=watchlists[currentWL];
  cur.stocks=cur.stocks.filter(x=>x!==sym);
  wl=cur.stocks;
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
async function renderWL(){
  // Use active watchlist stocks
  let displayList = watchlists[currentWL] ? [...watchlists[currentWL].stocks] : [];
let html = "";
  // Apply sort if needed (sort displayList in place)
if(azAsc !== undefined) { /* sorting handled by sort functions on wl, mirror to active wl */ }

  for (let s of displayList) {
    let d = cache[s]?.data;
    if (!d) { d = await fetchFull(s); if (d) cache[s] = { data: d, time: Date.now() }; }
    if (!d) continue;

    let diff = d.regularMarketPrice - d.chartPreviousClose;
    let pct = (diff / d.chartPreviousClose * 100) || 0;

    html += `
    <div class="wl-card-wrap" id="wrap-${s}">
      <div class="card" onclick="toggleActions('${s}')" style="padding:10px; position:relative; cursor:pointer; margin-bottom:3px;">
        <button onclick="event.stopPropagation();removeStock('${s}')" style="position:absolute; top:1px; right:2px; color:#ef4444; font-size:6px; background:none; border:none; cursor:pointer; z-index:10; padding:4px;">&#x2715;</button>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
          <div style="width:75px; flex-shrink:0;">
            <span onclick="event.stopPropagation();openDetail('${s}',false)" style="font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:700; cursor:pointer; color:#38bdf8; text-decoration:underline; text-underline-offset:2px;">${s}</span>
          </div>
          <div style="flex:1; min-width:0; display:flex; justify-content:center;">
            <div style="width:100%; max-width:140px;">${buildDayBar(d)}</div>
          </div>
          <div style="width:105px; flex-shrink:0; text-align:right;">
            <div id="price-${s}" style="font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:700; color:#e2e8f0;">₹${d.regularMarketPrice.toFixed(2)}</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="width:75px; flex-shrink:0; font-size:9px; line-height:1.2; color:#94a3b8; font-weight:600;">
            ${get52WLabel(d)}${getTargetBadge(s, d.regularMarketPrice)}
          </div>
          <div style="flex:1; min-width:0; display:flex; justify-content:center;">
            <div style="width:100%; max-width:140px;">${build52WBar(d)}</div>
          </div>
          <div style="width:105px; flex-shrink:0; text-align:right;">
            <div id="change-${s}" style="font-size:13px; font-weight:700; color:${diff >= 0 ? '#22c55e' : '#ef4444'}; white-space:nowrap;">
              ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${diff >= 0 ? '+' : ''}${pct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      <div class="wl-actions-panel" id="act-${s}">
        <button class="act-btn" onclick="openModal('BUY','${s}',${d.regularMarketPrice});toggleActions('${s}')" style="background:#166534; color:#86efac; padding:8px 0;">BUY</button>
        <button class="act-btn" onclick="openModal('SELL','${s}',${d.regularMarketPrice});toggleActions('${s}')" style="background:#7f1d1d; color:#fca5a5; padding:8px 0;">SELL</button>
        <button class="act-btn" onclick="chart('${s}');toggleActions('${s}')" style="background:#0f2a40; color:#60a5fa; padding:8px 0;">CHART</button>
        <button class="act-btn" onclick="openNews('${s}');toggleActions('${s}')" style="background:#0f2a40; color:#a78bfa; padding:8px 0;">NEWS</button>
        <button class="act-btn" onclick="setAlert('${s}');toggleActions('${s}')" style="background:#713f12; color:#fde68a; padding:8px 0;">ALERT</button>
        <button class="act-btn" onclick="setTarget('${s}',${d.regularMarketPrice});toggleActions('${s}')" style="background:#4a1d96; color:#c4b5fd; padding:8px 0;">TARGET</button>
        <button class="act-btn" onclick="openNivi('${s}');toggleActions('${s}')" style="background:#0f2a1a; color:#34d399; border:1px solid #065f46; grid-column:span 2; display:flex; align-items:center; justify-content:center; gap:5px; padding:10px 0;">
          <svg viewBox="0 0 16 16" fill="none" width="13" height="13"><path d="M8 1C8 1 8.7 5.8 12.5 8C8.7 10.2 8 15 8 15C8 15 7.3 10.2 3.5 8C7.3 5.8 8 1 8 1Z" fill="#34d399"/><circle cx="8" cy="8" r="1.4" fill="white" opacity="0.9"/></svg>
          <span style="font-size:13px;">Ask Nivi</span>
        </button>
      </div>
    </div>`;
  }
  const watchlistDiv=document.getElementById("watchlist");
  if(html){
    watchlistDiv.innerHTML=html;
    // Sparklines are ON-DEMAND only - tap "7D TREND" label to load
    // Auto-load disabled to prevent quota exhaustion (20k/day limit)
  } else {
    watchlistDiv.innerHTML=`<div style="text-align:center;color:#4b6280;padding:30px;font-size:13px;">${watchlists[currentWL]&&watchlists[currentWL].stocks.length===0?'Search stock above to add to '+watchlists[currentWL].name:'Type stock name in search box (Press Enter)'}</div>`;
  }
}


// ======================================
// SPARKLINE: 7-day price line for watchlist
// ======================================
async function renderSparkline(sym) {
  const el = document.getElementById('spark-' + sym);
  if (!el) return;
  try {
    const hist = await fetchHistory(sym, '10d', '1d');
    if (!hist || !hist.close || hist.close.length < 2) return;
    const closes = hist.close.filter(v => v != null);
    if (closes.length < 2) return;
    const minV = Math.min(...closes);
    const maxV = Math.max(...closes);
    const range = maxV - minV || 1;
    const W = 100, H = 18, pad = 2;
    const pts = closes.map((v, i) => {
      const x = pad + (i / (closes.length - 1)) * (W - pad * 2);
      const y = H - pad - ((v - minV) / range) * (H - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    const isUp = closes[closes.length - 1] >= closes[0];
    const col = isUp ? '#22c55e' : '#ef4444';
    const fillPts = pts[0].split(',')[0] + ',' + H + ' ' + pts.join(' ') + ' ' + pts[pts.length-1].split(',')[0] + ',' + H;
    el.innerHTML = '<svg width="100%" height="18" viewBox="0 0 100 18" preserveAspectRatio="none">' +
      '<polygon points="' + fillPts + '" fill="' + col + '" opacity="0.12"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      '</svg>';
  } catch(e) {}
}

async function renderAllSparklines() {
  const showSpark = localStorage.getItem('showSparkline') !== 'false';
  if (!showSpark) return;
  let displayList = wl;
  if (currentGroup !== 'ALL' && groups[currentGroup]) {
    displayList = wl.filter(s => groups[currentGroup].includes(s));
  }
  for (const s of displayList) {
    renderSparkline(s);
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
  POPULAR_STOCKS.slice(0,80).forEach(s=>{if(cache[s]) cache[s].time=0;});
  await batchFetchStocks(POPULAR_STOCKS.slice(0,80));
  renderGainersFromCache();
}

// ======================================
// RENDER GAINERS/LOSERS (Indices tab)
// ======================================
let _moversTab = 'gainers';

function moversSubTab(t) {
  _moversTab = t;
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
  const allStocks=[...new Set([...POPULAR_STOCKS])];
  const results=allStocks.map(s=>{
    const d=cache[s]?.data; if(!d||!d.chartPreviousClose) return null;
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

  moversSubTab(_moversTab);
}
// ======================================
// UPDATE HEADER INDICES
// ======================================
async function updateHeaderIndices(){
  // Ensure strip is rendered before updating values
  if(!document.getElementById('indicesStrip')?.children.length) renderHeaderStrip();
  for(let i of indicesList){
    let d=cache[i.sym]?.data||await fetchFull(i.sym,true);
    if(!d) continue;
    const diff=d.regularMarketPrice-d.chartPreviousClose;
    const pct=(diff/d.chartPreviousClose*100)||0;
    const key=i.sym.replace("^","");
    const pe=document.getElementById("hidx-"+key+"-p");
    const ce=document.getElementById("hidx-"+key+"-c");
    if(pe){
      const p=d.regularMarketPrice;
      // Full number with Indian comma grouping
      pe.innerText=p.toLocaleString('en-IN',{maximumFractionDigits:2});
    }
    if(ce){
      const adiff=Math.abs(diff);
      // Indian rupee format with commas
      const diffStr='₹'+adiff.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
      ce.innerText=(diff>=0?'+':'-')+diffStr+' ('+(diff>=0?'+':'-')+Math.abs(pct).toFixed(2)+'%)';
      ce.style.color=diff>=0?"#22c55e":"#ef4444";
    }
  }
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
  const apiUrl=localStorage.getItem('customAPI')||API;
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

// ======================================
// UPDATE PRICES
// ======================================
async function updatePrices(){
  // Only runs during market hours (09:15–15:30) — caller (startRefresh) already checks market status
  // Indices: use same CACHE_TIME as stocks — no extra force-clear needed
  for(let s of wl){
    let d=await fetchFull(s);if(!d) continue;
    let price=d.regularMarketPrice,prev=d.chartPreviousClose,diff=price-prev,pct=(diff/prev*100)||0;
    let pe=document.getElementById(`price-${s}`),ce=document.getElementById(`change-${s}`);
    if(pe){
      let op=parseFloat(pe.innerText.replace(/[₹,]/g,""))||0;
      pe.innerText="₹"+price.toFixed(2);
      checkAlerts(s,price);checkTargets(s,price);lastUpdatedMap[s]=Date.now();
      const wrap=pe.closest('.card')||pe.parentElement;
      if(price>op){pe.classList.add("flash-green");if(wrap)wrap.classList.add("flash-green");}
      else if(price<op){pe.classList.add("flash-red");if(wrap)wrap.classList.add("flash-red");}
      setTimeout(()=>{pe.classList.remove("flash-green","flash-red");if(wrap)wrap.classList.remove("flash-green","flash-red");},1200);
    }
    if(ce){
      // Format: +₹diff (pct%) — matches card render format
      const sign=diff>=0?'+':'';
      ce.innerHTML=sign+'₹'+Math.abs(diff).toFixed(2)+' <span style="font-size:12px;">('+sign+pct.toFixed(2)+'%)</span>';
      ce.style.color=diff>=0?"#22c55e":"#ef4444";
    }
  }
  for(let i of indicesList){
    let d=await fetchFull(i.sym,true);if(!d) continue;
    let price=d.regularMarketPrice,prev=d.chartPreviousClose,diff=price-prev,pct=(diff/prev*100)||0;
    let pe=document.getElementById(`idx-price-${i.sym}`),ce=document.getElementById(`idx-change-${i.sym}`);
    if(pe){let op=parseFloat(pe.innerText.replace(/[₹,]/g,""))||0;pe.innerText="₹"+price.toFixed(2);if(price>op)pe.classList.add("flash-green");else if(price<op)pe.classList.add("flash-red");setTimeout(()=>{pe.classList.remove("flash-green","flash-red");},1200);}
    if(ce){ce.innerText=(diff>=0?'+':'-')+pct.toFixed(2)+'%';ce.style.color=diff>=0?"#22c55e":"#ef4444";}
  }
  updateHeaderIndices();
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
async function renderHold(){
  let html="";
  for(let x of h){
    let d=cache[x.sym]?.data||await fetchFull(x.sym);if(!d) continue;
    x.ltp=d.regularMarketPrice;
    let uPnl=(d.regularMarketPrice-x.price)*x.qty;
    let pnlPct=((d.regularMarketPrice-x.price)/x.price*100).toFixed(2);
    const days=holdingDays(x.buyDate);
    const daysStr=days!==null?`<span style="font-size:9px;color:#4b6280;margin-left:4px;">${holdingDaysLabel(days)}</span>`:'';
    const typeTag=x.tradeType?`<span style="font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700;background:${x.tradeType==='MIS'?'#4a1d96':'#1e3a5f'};color:${x.tradeType==='MIS'?'#c4b5fd':'#93c5fd'};margin-left:4px;">${x.tradeType}</span>`:'';
    const updated=lastUpdatedMap[x.sym]?`<span style="font-size:9px;color:#4b6280;">${timeAgo(lastUpdatedMap[x.sym])}</span>`:'';
    html+=`
    <div class="card" style="font-size:13px;padding:8px 10px;">
      <!-- Row 1: Symbol+Badge | CMP | P&L -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;margin-bottom:5px;">
        <div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;">${x.sym}</span>
          ${typeTag}
        </div>
        <div style="text-align:center;">
          <div id="hcmp-${x.sym}" style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;">${inr(d.regularMarketPrice)}</div>
          <div style="font-size:9px;color:#4b6280;">CMP</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:700;color:${uPnl>=0?'#22c55e':'#ef4444'};">${uPnl>=0?'+':''}${inr(uPnl)}</div>
          <div style="font-size:10px;color:${uPnl>=0?'#22c55e':'#ef4444'};">(${pnlPct}%)</div>
        </div>
      </div>
      <!-- Row 2: Qty | Avg Price | Holding Days -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;margin-bottom:6px;">
        <div>
          <div style="font-size:10px;color:#4b6280;">QTY</div>
          <div style="font-size:13px;font-weight:700;">${x.qty}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#4b6280;">AVG PRICE</div>
          <div style="font-size:13px;font-weight:700;">${inr(x.price)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#4b6280;">HELD</div>
          <div style="font-size:12px;font-weight:700;color:#94a3b8;">${days!==null?holdingDaysLabel(days):(x.buyDate?holdingDaysLabel(0):'Add date')}</div>
        </div>
      </div>
      <!-- Row 3: CMP vs Avg Bar | AVGv | EDIT | SELL -->
      <div style="display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:5px;">
        <div>${getAvgVsCMPBar(x.price, d.regularMarketPrice)}</div>
        <button onclick="openAvgCalc('${x.sym}',${x.price},${x.qty},${d.regularMarketPrice})" style="background:#1e3a5f;color:#38bdf8;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;border:1px solid #2d5a8e;cursor:pointer;font-family:'Rajdhani',sans-serif;">AVGv</button>
        <button onclick="openEdit('${x.sym}')" style="background:#713f12;color:#fde68a;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;">EDIT</button>
        <button onclick="openModal('SELL','${x.sym}',${d.regularMarketPrice})" style="background:#7f1d1d;color:#fca5a5;font-size:10px;font-weight:700;padding:4px 8px;border-radius:6px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;">SELL</button>
      </div>
    </div>`;
  }
  document.getElementById("holdingsList").innerHTML=html||`<div style="text-align:center;color:#4b6280;padding:20px;font-size:13px;">No holdings</div>`;
  updatePortfolioDashboard();
  drawPieChart();
}

// ======================================
// PORTFOLIO DASHBOARD
// ======================================
function updatePortfolioDashboard(){
  let ti=0,cv=0;
  h.forEach(s=>{ti+=s.price*s.qty;cv+=s.ltp?s.ltp*s.qty:s.price*s.qty;});
  const uPL=cv-ti,rp=ti?((uPL/ti)*100).toFixed(2):0;
  const realPL=hist.filter(x=>x.type!=='BUY'&&x.pnl!=null).reduce((s,x)=>s+x.pnl,0);
  const totPL=uPL+realPL;
  document.getElementById("totalInvestment").innerText=inr(ti);
  document.getElementById("currentValue").innerText=inr(cv);
  document.getElementById("totalPL").innerText=(uPL>=0?"+":"")+inr(uPL);
  document.getElementById("returnPercent").innerText=rp+"%";
  document.getElementById("totalPL").style.color=uPL>=0?"#22c55e":"#ef4444";
  document.getElementById("returnPercent").style.color=uPL>=0?"#22c55e":"#ef4444";
  document.getElementById("realizedPL").innerText=(realPL>=0?"+":"")+inr(realPL);
  document.getElementById("realizedPL").style.color=realPL>=0?"#22c55e":"#ef4444";
  document.getElementById("combinedPL").innerText=(totPL>=0?"+":"")+inr(totPL);
  document.getElementById("combinedPL").style.color=totPL>=0?"#22c55e":"#ef4444";
}

// ======================================
// LIVE CLOCK (IST)
// ======================================
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
  tick(); setInterval(tick,1000);
}

// ======================================
// HISTORY  -  LIST + CALENDAR
// ======================================
let histView='list';

function setHistView(v){
  histView=v;
  ['list','calendar'].forEach(x=>{
    const btn=document.getElementById('histView'+x.charAt(0).toUpperCase()+x.slice(1));
    if(!btn) return;
    const active=x===v;
    btn.style.background=active?'#1e3a5f':'#1e2d3d';
    btn.style.color=active?'#38bdf8':'#94a3b8';
    btn.style.borderColor=active?'#38bdf8':'#2d3f52';
  });
  const hl=document.getElementById("historyList");
  const hc=document.getElementById("historyCalendar");
  if(hl) hl.style.display=v==='list'?'block':'none';
  if(hc) hc.style.display=v==='calendar'?'block':'none';
  if(v==='calendar') renderCalendar();
}

function renderHist(){
  let html="";
  hist.forEach(x=>{
    const isBuy=x.type==='BUY';
    const pnlStr=(!isBuy&&x.pnl!=null)?`<div style="font-weight:700;color:${x.pnl>=0?'#22c55e':'#ef4444'};">${x.pnl>=0?'+':''}${inr(x.pnl)}</div>`:'';
    // holding days for SELL trades
    let daysStr='';
    if(!isBuy&&x.buyDate&&x.date){
      const bd=new Date(x.buyDate), sd=new Date(x.date);
      const days=Math.floor((sd-bd)/(1000*60*60*24));
      if(days>=0) daysStr=`<span style="font-size:9px;color:#4b6280;"> | ${holdingDaysLabel(days)} held</span>`;
    }
    const typeTag=x.tradeType?`<span style="font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700;background:${x.tradeType==='MIS'?'#4a1d96':'#1e3a5f'};color:${x.tradeType==='MIS'?'#c4b5fd':'#93c5fd'};margin-left:4px;">${x.tradeType}</span>`:'';
    html+=`
    <div class="card" style="font-size:12px;margin-bottom:4px;padding:7px 10px;">
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;margin-bottom:3px;">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;">${x.sym}</span>
          <span style="font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;background:${isBuy?'#166534':'#7f1d1d'};color:${isBuy?'#86efac':'#fca5a5'};">${isBuy?'BUY':'SELL'}</span>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;text-align:center;">${inr(parseFloat(x.buy))}</span>
        <span style="font-size:12px;font-weight:700;color:${(!isBuy&&x.pnl!=null)?(x.pnl>=0?'#22c55e':'#ef4444'):'#4b6280'};text-align:right;min-width:70px;">${(!isBuy&&x.pnl!=null)?(x.pnl>=0?'+':'')+inr(x.pnl):''}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;">
        <span style="font-size:10px;color:#4b6280;">Qty: ${x.qty}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;text-align:center;">${!isBuy&&x.sell?inr(parseFloat(x.sell)):''}</span>
        <span style="font-size:10px;color:#4b6280;text-align:right;min-width:70px;">${x.date||''}</span>
      </div>
    </div>`;
  });
  const el=document.getElementById("historyList");
  if(el) el.innerHTML=html||(hist.length===0?`<div style="text-align:center;color:#4b6280;padding:30px;font-size:13px;">No history yet</div>`:"");
}

// ======================================
// FUNDAMENTALS (day-cached, from Yahoo meta)
// ======================================
// ── Global in-memory caches (populated from Firebase at startup) ──
window._firebaseFundCache = window._firebaseFundCache || {};
window._firebaseHistCache = window._firebaseHistCache || {}; // histcache collection

// ── Firebase helper: silent set (never throws, ideal for best-effort writes) ──
function _fbSet(path, data) {
  if (!currentUser) return;
  try {
    // path: 'collection/docId' or 'collection/docId/sub/subId'
    const parts = path.split('/');
    let ref = db;
    for (let i = 0; i < parts.length; i++) {
      ref = (i % 2 === 0) ? ref.collection(parts[i]) : ref.doc(parts[i]);
    }
    ref.set(data, { merge: true }).catch(() => {});
  } catch(e) {}
}

// Load ALL fundamentals from Firebase once at startup — zero GAS calls
// Abort controller for preload — cancel if user navigates away
let _fbPreloadController = null;
async function preloadAllFundamentalsFromFirebase() {
  if (_fbPreloadController) _fbPreloadController.abort();
  _fbPreloadController = { aborted: false, abort() { this.aborted = true; } };
  const ctrl = _fbPreloadController;
  try {
    const snap = await db.collection('fundamentals').get();
    snap.forEach(doc => {
      const d = doc.data();
      const sym = doc.id;
      function fsVal(f) {
        if (!f) return null;
        if (f.doubleValue !== undefined) return f.doubleValue;
        if (f.integerValue !== undefined) return Number(f.integerValue);
        if (f.nullValue !== undefined) return null;
        return f.stringValue ?? null;
      }
      function safeNum(v){ return (v===null||v===undefined||isNaN(Number(v)))?null:Number(v); }
window._firebaseFundCache[sym] = {
  pe: safeNum(d.pe), eps: safeNum(d.eps),
  marketCap: safeNum(d.marketCap), bookValue: safeNum(d.bookValue),
  high52: safeNum(d.high52), low52: safeNum(d.low52),
  _source: 'firebase', _ts: Date.now()
};
    });
    console.log('✅ Firebase fundamentals preloaded:', Object.keys(window._firebaseFundCache).length, 'stocks');
  } catch(e) {
    console.warn('Firebase fundamentals preload failed:', e.message);
  }
}

// Build formatted fund data from Firebase raw values
function _buildFundDataFromFirebase(raw, sym) {
  function fmtCap(v){if(!v||isNaN(v))return '--';if(v>=1e12)return'₹'+(v/1e12).toFixed(2)+'T';if(v>=1e9)return'₹'+(v/1e9).toFixed(2)+'B';if(v>=1e7)return'₹'+(v/1e7).toFixed(2)+'Cr';return'₹'+v.toLocaleString('en-IN');}
  function fmtVol(v){if(!v||isNaN(v))return '--';if(v>=1e7)return(v/1e7).toFixed(2)+'Cr';if(v>=1e5)return(v/1e5).toFixed(2)+'L';return v.toLocaleString('en-IN');}
  const _cacheD = cache[sym]&&cache[sym].data;
  const vol_v = _cacheD&&(_cacheD.regularMarketVolume||_cacheD.volume);
  return {
    pe: raw.pe!=null&&!isNaN(raw.pe) ? parseFloat(raw.pe).toFixed(2) : '--',
    eps: raw.eps!=null&&!isNaN(raw.eps) ? '₹'+parseFloat(raw.eps).toFixed(2) : '--',
    mktCap: raw.marketCap!=null ? fmtCap(raw.marketCap) : '--',
    bookValue: raw.bookValue!=null&&!isNaN(raw.bookValue) ? '₹'+parseFloat(raw.bookValue).toFixed(2) : '--',
    volume: vol_v ? fmtVol(vol_v) : '--',
    divYield:'--', forwardPE:'--', forwardEps:'--',
    earningsDate:'--', exDivDate:'--',
    _source: 'firebase'
  };
}

async function fetchFundamentals(sym){
  // v7: Firebase-first strategy — zero GAS calls for fundamentals
  // Priority: 1) Firebase in-memory (instant) → 2) localStorage 7-day cache → 3) API (last resort)
  const FUND_KEY = 'fundCache6_' + sym;
  const cleanSym = sym.replace(/\.NS$/i,'').replace(/\.BO$/i,'').toUpperCase();

  // 1. Firebase in-memory — instant, populated at startup
  if (window._firebaseFundCache && window._firebaseFundCache[cleanSym]) {
    return _buildFundDataFromFirebase(window._firebaseFundCache[cleanSym], sym);
  }

  // 2. localStorage 7-day cache
  try {
    const stored = JSON.parse(localStorage.getItem(FUND_KEY)||'null');
    if (stored && stored.ts && stored.data) {
      const age = Date.now() - stored.ts;
      if (age < 7 * 86400000) return stored.data;   // fresh — return immediately
      // stale — return now, refresh async
      setTimeout(()=>_fetchFundamentalsFromAPI(sym, FUND_KEY), 200);
      return stored.data;
    }
  } catch(e) {}

  // 3. No cache — fetch from API (blocking, shows loading)
  return await _fetchFundamentalsFromAPI(sym, FUND_KEY);
}

// Background refresh — does NOT block UI
function _refreshFundamentalsBackground(sym, cacheKey){
  setTimeout(async ()=>{ await _fetchFundamentalsFromAPI(sym, cacheKey); }, 100);
}

async function _fetchFundamentalsFromAPI(sym, cacheKey){
  // Try Sheet first if enabled
let _sheetFund = null;
if(isSheetEnabled()){
  _sheetFund = await fetchFundSheet(sym);
}
  function fmtVol(v){if(!v||isNaN(v))return '--';if(v>=1e7)return(v/1e7).toFixed(2)+'Cr';if(v>=1e5)return(v/1e5).toFixed(2)+'L';return v.toLocaleString('en-IN');}
  function fmtCap(v){if(!v||isNaN(v))return '--';if(v>=1e12)return'₹'+(v/1e12).toFixed(2)+'T';if(v>=1e9)return'₹'+(v/1e9).toFixed(2)+'B';if(v>=1e7)return'₹'+(v/1e7).toFixed(2)+'Cr';return'₹'+v.toLocaleString('en-IN');}
  function fmtDate(ts){
    if(!ts||isNaN(ts)||ts<=0) return '--';
    const dt=new Date(ts*1000);
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return dt.getDate()+' '+months[dt.getMonth()]+' '+dt.getFullYear();
  }
  function safe(v){ return (v===undefined||v===null||v!==v)?null:v; }
  // Try quote endpoint — all 3 API URLs as fallback
  let d = null;
  const _quoteUrls = [
    localStorage.getItem('customAPI')||API,
    localStorage.getItem('customAPI2')||API2,
    localStorage.getItem('customAPI3')||API3
  ].filter(Boolean);
const _symNS = sym.endsWith('.NS') ? sym : sym + '.NS';
  for(let _qu of _quoteUrls){
    if(d) break;
    try {
      const controller = new AbortController();
      const tid = setTimeout(()=>controller.abort(), 15000);
      const r = await fetch(`${_qu}?type=quote&s=${encodeURIComponent(_symNS)}`, {signal: controller.signal});
      clearTimeout(tid);
      const j = await r.json();
      // GAS quoteFetch returns: {pe, eps, price, mktCap, bookValue, forwardPE, ...}
      if(j && !j.error && j.price) d = j;
    } catch(e){}
  }  // Last resort: cache for volume (batch data has volume but not pe/eps)
  const _cacheD = cache[sym]&&cache[sym].data;

  let pe='--',eps='--',mktCap='--',volume='--';
  let divYield='--',forwardPE='--',bookValue='--',forwardEps='--',earningsDate='--',exDivDate='--';
  // For volume: use cache if quote didn't have it
  if(!d && _cacheD) d = _cacheD;
  // GAS quoteFetch field names: pe, eps, mktCap, bookValue, dividendYield, forwardPE, epsForward, earningsTimestamp, exDividendDate
  // Yahoo v7/quote field names: trailingPE, epsTrailingTwelveMonths, marketCap, bookValue, dividendYield, forwardPE, epsForward
  if(d){
    var pe_v=safe(d.pe||d.trailingPE);
    if(pe_v!==null&&!isNaN(pe_v)&&pe_v>0) pe=parseFloat(pe_v).toFixed(2);
    var eps_v=safe(d.eps||d.epsTrailingTwelveMonths);
    if(eps_v!==null&&!isNaN(eps_v)) eps='₹'+parseFloat(eps_v).toFixed(2);
    var cap_v=safe(d.mktCap||d.marketCap);
    if(cap_v!==null&&!isNaN(cap_v)) mktCap=fmtCap(cap_v);
    // Volume: from cache (batch has volume, quote may also have it)
    var vol_v=safe(d.volume||d.regularMarketVolume||(_cacheD&&(_cacheD.regularMarketVolume||_cacheD.volume))||d.averageDailyVolume3Month);
    if(vol_v) volume=fmtVol(vol_v);
    var dy=safe(d.dividendYield||d.trailingAnnualDividendYield);
    if(dy!==null&&!isNaN(dy)&&dy>0){
      divYield=(dy>1?dy:(dy*100)).toFixed(2)+'%';
    }
    var fpe=safe(d.forwardPE||d.priceEpsCurrentYear);
    if(fpe!==null&&!isNaN(fpe)&&fpe>0&&fpe<1000) forwardPE=parseFloat(fpe).toFixed(2);
    var bv=safe(d.bookValue);
    if(bv!==null&&!isNaN(bv)&&bv>0) bookValue='₹'+parseFloat(bv).toFixed(2);
    var feps=safe(d.epsForward||d.epsCurrentYear);
    if(feps!==null&&!isNaN(feps)) forwardEps='₹'+parseFloat(feps).toFixed(2);
    var ets=safe(d.earningsTimestamp||d.earningsTimestampStart||d.earningsTimestampEnd);
    if(ets!==null&&ets>0) earningsDate=fmtDate(ets);
    var exd=safe(d.exDividendDate||d.dividendDate);
    if(exd!==null&&exd>0) exDivDate=fmtDate(exd);
  } else if(_cacheD){
    // Absolute fallback — batch cache has volume but usually no PE
    var vol_v2=safe(_cacheD.regularMarketVolume||_cacheD.volume);
    if(vol_v2) volume=fmtVol(vol_v2);
  }
  // Sheet override for pe/eps/marketCap/bookValue
if(_sheetFund){
  if(_sheetFund.pe!=null) pe=parseFloat(_sheetFund.pe).toFixed(2);
  if(_sheetFund.eps!=null) eps='₹'+parseFloat(_sheetFund.eps).toFixed(2);
  if(_sheetFund.marketCap!=null) mktCap=fmtCap(_sheetFund.marketCap);
  if(_sheetFund.bookValue!=null) bookValue='₹'+parseFloat(_sheetFund.bookValue).toFixed(2);
}
const data={pe,eps,mktCap,volume,divYield,forwardPE,bookValue,forwardEps,earningsDate,exDivDate,
    _source: _sheetFund ? 'sheet+yahoo' : 'yahoo_quote'};
  try{ localStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),data})); }catch(e){}
  return data;
}

// Reusable fundamentals renderer
function _renderFundamentalsHTML(fs, fund, isCached){
  if(!fs||!fund) return;
  const fpe_v=fund.forwardPE||'--';
  const feps_v=fund.forwardEps||'--';
  const bv_v=fund.bookValue||'--';
  const dy_v=fund.divYield||'--';
  const ed_v=fund.earningsDate||'--';
  const exd_v=fund.exDivDate||'--';
  const cacheLabel=isCached?'<span style="font-size:8px;color:#4b6280;font-weight:400;margin-left:4px;">(cached)</span>':'';
  fs.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">FUNDAMENTALS${cacheLabel}</div>
    <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">P/E (TTM)${iBtn('PE')}</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.pe||'--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">FORWARD P/E</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fpe_v}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">EPS (TTM)${iBtn('EPS')}</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.eps||'--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">FORWARD EPS</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${feps_v}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">MKT CAP</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.mktCap||'--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">BOOK VALUE</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${bv_v}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">VOLUME</div><div style="font-size:11px;font-weight:700;white-space:nowrap;">${fund.volume||'--'}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">DIV YIELD</div><div style="font-size:11px;font-weight:700;white-space:nowrap;color:${dy_v!=='--'?'#22c55e':'#e2e8f0'};">${dy_v}</div></div>
      </div>
    </div>
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">DIVIDENDS & EARNINGS</div>
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <div style="flex:1;background:#0a1628;border-radius:6px;padding:6px 8px;border:1px solid rgba(245,158,11,0.2);">
        <div style="font-size:9px;color:#4b6280;">NEXT EARNINGS</div>
        <div style="font-size:11px;font-weight:700;color:${ed_v!=='--'?'#f59e0b':'#e2e8f0'};">${ed_v}</div>
      </div>
      <div style="flex:1;background:#0a1628;border-radius:6px;padding:6px 8px;border:1px solid rgba(34,197,94,0.2);">
        <div style="font-size:9px;color:#4b6280;">EX-DIV DATE</div>
        <div style="font-size:11px;font-weight:700;color:${exd_v!=='--'?'#22c55e':'#e2e8f0'};">${exd_v}</div>
      </div>
    </div>`;
}

async function openDetail(sym,isIndex){
  // Show modal immediately with cached data
  let d=cache[sym]?.data||await fetchFull(sym,isIndex);if(!d)return;
  document.getElementById("d-title").innerText=sym;
  // Reset all tabs to default state
  switchDetailTab('price');
  // Reset section contents
  document.getElementById("fundamentalsSection").innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:12px;">Loading fundamentals...</div>';
  document.getElementById("techSection").innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:12px;">Loading technical data...</div>';
  document.getElementById("smartAlertSection").innerHTML='';
  _bbSym = sym;
  document.getElementById("bbSection").innerHTML='';
  document.getElementById("quickLinksSection").innerHTML='';
  // TradingView button
  const tvBtn = document.getElementById("d-tv-btn");
  if(tvBtn) tvBtn.onclick = ()=>chart(sym, isIndex?true:false); const tvBtn2=document.getElementById("d-tv-btn2"); if(tvBtn2) tvBtn2.onclick=()=>chart(sym, isIndex?true:false);
  // Price tab content
  document.getElementById("d-body").innerHTML=`
    <div style="display:flex;flex-direction:column;gap:3px;">
      <div style="background:#0a1628;border-radius:7px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
        <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">OPEN</div><div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u20b9${(d.regularMarketOpen&&d.regularMarketOpen>1?d.regularMarketOpen:(d.chartPreviousClose||0)).toFixed(2)}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;line-height:1.2;">PREV CLOSE</div><div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u20b9${(d.chartPreviousClose||0).toFixed(2)}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:7px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
        <div style="flex:1;min-width:0;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">DAY HIGH</div><div style="font-size:14px;font-weight:700;color:#22c55e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u20b9${(d.regularMarketDayHigh||0).toFixed(2)}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">DAY LOW</div><div style="font-size:14px;font-weight:700;color:#ef4444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u20b9${(d.regularMarketDayLow||0).toFixed(2)}</div></div>
      </div>
      <div style="background:#0a1628;border-radius:7px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
        <div style="flex:1;min-width:0;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">52W HIGH</div><div style="font-size:14px;font-weight:700;color:#22c55e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u20b9${(d.fiftyTwoWeekHigh||0).toFixed(2)}</div></div>
        <div style="width:1px;height:22px;background:#1e2d3d;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:11px;color:#4b6280;line-height:1.2;">52W LOW</div><div style="font-size:14px;font-weight:700;color:#ef4444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u20b9${(d.fiftyTwoWeekLow||0).toFixed(2)}</div></div>
      </div>
    </div>`;
  const chartDiv = document.getElementById("d-chart");
  if(chartDiv) chartDiv.innerHTML='';
  document.getElementById("detailModal").classList.remove("hidden");
  document.body.style.overflow='hidden';
  if(!isIndex) renderCircuit(sym, d);
  document.getElementById("bbSection").innerHTML='';
  if(!isIndex) renderSmartAlertSuggestions(sym, d);
  renderQuickLinks(sym, isIndex);
  if(!isIndex){
    // Show cached fundamentals immediately if available (no wait)
    const _cachedFund = (()=>{
      try{
        const s=JSON.parse(localStorage.getItem('fundCache6_'+sym)||'null');
        return s&&s.data?s.data:null;
      }catch(e){return null;}
    })();
    const fs=document.getElementById("fundamentalsSection");
    if(_cachedFund && fs){
      // Render cached immediately — API refresh happens in background
      _renderFundamentalsHTML(fs, _cachedFund, true);
    }
    const fund=await fetchFundamentals(sym);
    if(fs && !fund && !_cachedFund){
      // fetchFundamentals failed — use cached quote data if available
      const cd = cache[sym]&&cache[sym].data;
      if(cd){
        function _fc(v){ return (v===undefined||v===null||isNaN(v))?null:v; }
        function _fmtV(v){if(!v||isNaN(v))return '--';if(v>=1e7)return(v/1e7).toFixed(1)+'Cr';if(v>=1e5)return(v/1e5).toFixed(1)+'L';return v.toLocaleString('en-IN');}
        function _fmtC(v){if(!v||isNaN(v))return '--';if(v>=1e7)return'₹'+(v/1e7).toFixed(0)+'Cr';return '₹'+v.toLocaleString('en-IN');}
        const pe=_fc(cd.trailingPE)?parseFloat(cd.trailingPE).toFixed(2):'--';
        const eps=_fc(cd.epsTrailingTwelveMonths)?'₹'+parseFloat(cd.epsTrailingTwelveMonths).toFixed(2):'--';
        const mktCap=_fmtC(cd.marketCap);
        const vol=_fmtV(cd.regularMarketVolume||cd.averageDailyVolume3Month);
        fs.innerHTML=`<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">FUNDAMENTALS <span style="color:#4b6280;font-weight:400;">(cached)</span></div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;">
            <div><div style="font-size:9px;color:#4b6280;">P/E (TTM)</div><div style="font-size:11px;font-weight:700;">${pe}</div></div>
            <div style="text-align:right;"><div style="font-size:9px;color:#4b6280;">MKT CAP</div><div style="font-size:11px;font-weight:700;">${mktCap}</div></div>
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;">
            <div><div style="font-size:9px;color:#4b6280;">EPS (TTM)</div><div style="font-size:11px;font-weight:700;">${eps}</div></div>
            <div style="text-align:right;"><div style="font-size:9px;color:#4b6280;">VOLUME</div><div style="font-size:11px;font-weight:700;">${vol}</div></div>
          </div>
          <div style="font-size:9px;color:#4b6280;text-align:center;padding:3px;">Full data unavailable — tap stock again to retry</div>
        </div>`;
      } else {
        fs.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Fundamentals unavailable. Check API.</div>';
      }
    }
    if(fs&&fund){
      _renderFundamentalsHTML(fs, fund, false);
    } else if(fs && !_cachedFund){
      fs.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Fundamentals unavailable — will retry on next open</div>';
    }
    // Quick Links rendered via renderQuickLinks() into quickLinksSection div
    // Load technical data
    // Safety: clear loading after 10s if still stuck
    const _techTimeout = setTimeout(()=>{
      const ts=document.getElementById('techSection');
      if(ts&&ts.innerText.includes('Loading')) ts.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:4px;">Technical data unavailable. <a onclick="fetchHistory(\''+sym+'\').then(h=>{if(h)location.reload();})" style="color:#38bdf8;cursor:pointer;">Retry</a></div>';
    }, 12000);
    fetchHistory(sym).then(hist=>{
      clearTimeout(_techTimeout);
      const ts=document.getElementById("techSection");
      if(!ts) return;
      if(!hist||!hist.close){ ts.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:4px;">Technical data unavailable</div>'; return; }
      const closes=hist.close.filter(v=>v!=null);
      const highs=hist.high.filter(v=>v!=null);
      const lows=hist.low.filter(v=>v!=null);
      const rsi=calcRSI(closes);
      const macd=calcMACD(closes);
      const ib=detectInsideBar(highs,lows);
      const nr=detectNarrowRange(highs,lows);
      const rsiColor=rsi?rsi<30?'#22c55e':rsi>70?'#ef4444':'#38bdf8':'#94a3b8';
      const macdColor=macd?(macd.trend==='bullish'?'#22c55e':'#ef4444'):'#94a3b8';
const price=cache[sym]?.data?.regularMarketPrice||0;
      const dot=(c)=>`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px;flex-shrink:0;"></span>`;
      const dmaKey=(l)=>l.includes('20')?'DMA20':l.includes('50')?'DMA50':'DMA200';
      const maRow=(label,val)=>val?`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:11px;color:#94a3b8;display:flex;align-items:center;">${dot(price>=val?'#22c55e':'#ef4444')}${label}${iBtn(dmaKey(label))}</span>
        <span style="font-size:11px;font-weight:700;color:${price>=val?'#22c55e':'#ef4444'};">₹${val.toFixed(2)} ${price>=val?'▲':'▼'}</span>
      </div>`:'';
      const ma20=closes.length>=20?closes.slice(-20).reduce((a,b)=>a+b,0)/20:null;
      const ma50=closes.length>=50?closes.slice(-50).reduce((a,b)=>a+b,0)/50:null;
      const ma200=closes.length>=200?closes.slice(-200).reduce((a,b)=>a+b,0)/200:null;
      ts.innerHTML=`
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TECHNICAL (30D)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;display:flex;align-items:center;">${dot(rsiColor)}RSI (14)${iBtn('RSI')}</div><div style="font-size:13px;font-weight:700;color:${rsiColor};white-space:nowrap;">${rsi?rsi.toFixed(1):'--'} <span style="font-size:9px;">${rsi?rsi<30?'Oversold':rsi>70?'Overbought':'Neutral':''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;display:flex;align-items:center;justify-content:flex-end;">${dot(macdColor)}MACD${iBtn('MACD')}</div><div style="font-size:13px;font-weight:700;color:${macdColor};white-space:nowrap;">${macd?macd.macd:'--'} <span style="font-size:9px;">${macd?macd.trend:''}</span></div></div>
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;">
            <div style="font-size:9px;color:#4b6280;margin-bottom:4px;">MOVING AVERAGES vs CMP ₹${price.toFixed(0)}</div>
            ${maRow('DMA 20',ma20)}
            ${maRow('DMA 50',ma50)}
            ${maRow('DMA 200',ma200)}
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">INSIDE BAR${iBtn('INSIDE')}</div><div style="font-size:12px;font-weight:700;color:${ib?'#f59e0b':'#4b6280'};">${ib?'Yes':'No'}</div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">NARROW RANGE${iBtn('NARROW')}</div><div style="font-size:12px;font-weight:700;color:${nr?'#f59e0b':'#4b6280'};">${nr?'Yes':'No'}</div></div>
          </div>
          ${(()=>{
            const _op=hist.open?hist.open.filter(v=>v!=null):closes;
            const _pats=detectCandlePatterns(_op,highs,lows,closes);
            if(!_pats.length) return '';
            return `<div style="background:#0a1628;border-radius:6px;padding:6px 10px;">
              <div style="font-size:9px;color:#4b6280;margin-bottom:5px;letter-spacing:0.5px;">CANDLESTICK PATTERNS</div>
              ${_pats.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                <span style="font-size:11px;font-weight:700;color:${p.color};">${p.signal==='bullish'?'&#9650;':p.signal==='bearish'?'&#9660;':'&#9670;'} ${p.name}</span>
                <span style="font-size:9px;color:#94a3b8;text-align:right;max-width:55%;line-height:1.3;">${p.desc}</span>
              </div>`).join('')}
            </div>`;
          })()}
        </div>`;
    });
  } else {
    // INDEX: Show composition instead of fundamentals
    const fs=document.getElementById("fundamentalsSection");
    if(fs) renderIndexComposition(sym, fs);
    // INDEX: Load technical indicators (RSI/MACD/MA) from history
    const ts=document.getElementById("techSection");
    if(ts) ts.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:12px;">Loading index technicals...</div>';
    fetchHistory(sym+'', '30d','1d').then(hist=>{
      if(!ts) return;
      if(!hist||!hist.close){ ts.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Technical data unavailable for this index.</div>'; return; }
      const closes=hist.close.filter(v=>v!=null);
      const highs=hist.high?hist.high.filter(v=>v!=null):closes;
      const lows=hist.low?hist.low.filter(v=>v!=null):closes;
      const rsi=calcRSI(closes);
      const macd=calcMACD(closes);
      const ma20=closes.length>=20?closes.slice(-20).reduce((a,b)=>a+b,0)/20:null;
      const ma50=closes.length>=50?closes.slice(-50).reduce((a,b)=>a+b,0)/50:null;
      const ma200=closes.length>=200?closes.slice(-200).reduce((a,b)=>a+b,0)/200:null;
      const price=d.regularMarketPrice||0;
      const rsiColor=rsi?rsi<30?'#22c55e':rsi>70?'#ef4444':'#38bdf8':'#94a3b8';
      const macdColor=macd?(macd.trend==='bullish'?'#22c55e':'#ef4444'):'#94a3b8';
      const dmaKey=(l)=>l.includes('20')?'DMA20':l.includes('50')?'DMA50':'DMA200';
      const dot=(c)=>`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px;flex-shrink:0;"></span>`;
      const maRow=(label,val)=>val?`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:11px;color:#94a3b8;display:flex;align-items:center;">${dot(price>=val?'#22c55e':'#ef4444')}${label}${iBtn(dmaKey(label))}</span>
        <span style="font-size:11px;font-weight:700;color:${price>=val?'#22c55e':'#ef4444'};">₹${val.toFixed(2)} ${price>=val?'▲':'▼'}</span>
      </div>`:'';
      ts.innerHTML=`
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TECHNICAL (30D)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="flex:1;min-width:0;"><div style="font-size:9px;color:#4b6280;">RSI (14)${iBtn('RSI')}</div><div style="font-size:13px;font-weight:700;color:${rsiColor};white-space:nowrap;">${rsi||'--'} <span style="font-size:9px;">${rsi?rsi<30?'Oversold':rsi>70?'Overbought':'Neutral':''}</span></div></div>
            <div style="width:1px;height:28px;background:#1e2d3d;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;text-align:right;"><div style="font-size:9px;color:#4b6280;">MACD${iBtn('MACD')}</div><div style="font-size:13px;font-weight:700;color:${macdColor};white-space:nowrap;">${macd?macd.macd:'--'} <span style="font-size:9px;">${macd?macd.trend:''}</span></div></div>
          </div>
          <div style="background:#0a1628;border-radius:6px;padding:5px 10px;">
            <div style="font-size:9px;color:#4b6280;margin-bottom:4px;">MOVING AVERAGES vs CMP ₹${price.toFixed(0)}</div>
            ${maRow('DMA 20',ma20)}
            ${maRow('DMA 50',ma50)}
            ${maRow('DMA 200',ma200)}
          </div>
        </div>`;
    });
  }
}
  // ======================================
// ℹ INFO TOOLTIP SYSTEM
// ======================================
const INFO_TIPS = {
  'RSI':      'RSI (Relative Strength Index)\n• Below 30 = Oversold 🟢 (Potential Buy)\n• Above 70 = Overbought 🔴 (Caution)\n• 30–70 = Neutral Zone',
  'MACD':     'MACD (Moving Avg Convergence Divergence)\n• MACD > Signal = Bullish 🟢\n• MACD < Signal = Bearish 🔴\n• Crossover = Trend change signal',
  'DMA20':    'DMA 20 (20-Day Moving Average)\n• Price > DMA20 = Short-term Bullish 🟢\n• Price < DMA20 = Short-term Bearish 🔴',
  'DMA50':    'DMA 50 (50-Day Moving Average)\n• Price > DMA50 = Medium-term Bullish 🟢\n• Price < DMA50 = Medium-term Bearish 🔴',
  'DMA200':   'DMA 200 (200-Day Moving Average)\n• Price > DMA200 = Long-term Bull Market 🟢\n• Price < DMA200 = Long-term Bear Market 🔴',
  'PE':       'P/E Ratio (Price to Earnings)\n• Below 15 = Undervalued 🟢\n• 15–25 = Fairly Valued\n• Above 25 = Expensive 🔴\n⚠️ Compare within same sector',
  'EPS':      'EPS (Earnings Per Share)\n• Higher = More Profitable 🟢\n• Negative EPS = Company in Loss 🔴\n• Growing EPS = Healthy business',
  'BB':       'Bollinger Bands (20,2)\n• Price > Upper Band = Overbought 🔴\n• Price < Lower Band = Oversold 🟢\n• Squeeze = Breakout likely soon',
  'INSIDE':   'Inside Bar Pattern\n• Current candle within previous candle\n• Signals consolidation\n• Breakout expected soon ⚡',
  'NARROW':   'Narrow Range (NR7)\n• Tightest range in last 7 days\n• Signals low volatility\n• Sharp move likely soon ⚡'
};
function showInfoTip(key){
  const tip = INFO_TIPS[key];
  if(!tip) return;
  // Remove existing tooltip
  const old = document.getElementById('infoTipBox');
  if(old) old.remove();
  const box = document.createElement('div');
  box.id = 'infoTipBox';
  box.style.cssText = 'position:fixed;z-index:9999;background:#0f1e33;border:1px solid #38bdf8;border-radius:10px;padding:10px 14px;max-width:260px;font-size:11px;color:#cbd5e1;line-height:1.6;white-space:pre-line;box-shadow:0 4px 20px rgba(0,0,0,0.6);top:50%;left:50%;transform:translate(-50%,-50%);';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <span style="font-size:12px;font-weight:700;color:#38bdf8;">${key}</span>
    <span onclick="document.getElementById('infoTipBox').remove()" style="cursor:pointer;color:#94a3b8;font-size:16px;line-height:1;">✕</span>
  </div>${tip.replace(/\n/g,'<br>')}`;
  // Tap outside to close
  setTimeout(()=>{ document.addEventListener('click', function _cl(e){ if(!box.contains(e.target)){box.remove();document.removeEventListener('click',_cl);} }); }, 100);
  document.body.appendChild(box);
}
function iBtn(key){ return `<span onclick="event.stopPropagation();showInfoTip('${key}')" style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#1e3a5f;color:#38bdf8;font-size:8px;font-weight:700;cursor:pointer;margin-left:3px;flex-shrink:0;vertical-align:middle;">i</span>`; }
// ======================================
// QUICK LINKS — always shown, no fund dependency
// ======================================
function renderQuickLinks(sym, isIndex){
  const el=document.getElementById('quickLinksSection');
  if(!el) return;
  if(isIndex){
    const tvSym=sym==='^NSEI'?'NSE:NIFTY50':sym==='^BSESN'?'BSE:SENSEX':sym==='^NSEBANK'?'NSE:BANKNIFTY':sym==='^CNXIT'?'NSE:NIFTYIT':'NSE:NIFTY50';
    el.innerHTML=`
      <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">QUICK LINKS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
        <button onclick="window.open('https://www.nseindia.com/market-data/live-market-indices','_blank')" style="background:#0f2a40;color:#38bdf8;border:1px solid #1e3a5f;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">NSE Indices</button>
        <button onclick="window.open('https://www.moneycontrol.com/markets/indian-indices/','_blank')" style="background:#0f2a40;color:#f97316;border:1px solid #7c2d12;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">MC</button>
        <button onclick="window.open('https://www.tradingview.com/chart/?symbol=${tvSym}','_blank')" style="background:#0f2a40;color:#34d399;border:1px solid #064e3b;border-radius:8px;padding:7px 4px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">TradingView</button>
      </div>`;
    return;
  }
  el.innerHTML=`
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
// INDEX COMPOSITION (hardcoded top-5 heavyweights)
// ======================================
const INDEX_COMPOSITION={
  '^NSEI':[{name:'Reliance',wt:'8.1%'},{name:'HDFC Bank',wt:'7.4%'},{name:'ICICI Bank',wt:'6.2%'},{name:'Infosys',wt:'5.1%'},{name:'TCS',wt:'4.3%'}],
  '^BSESN':[{name:'Reliance',wt:'9.2%'},{name:'HDFC Bank',wt:'8.8%'},{name:'ICICI Bank',wt:'7.0%'},{name:'Infosys',wt:'6.3%'},{name:'TCS',wt:'5.1%'}],
  '^NSEBANK':[{name:'HDFC Bank',wt:'28.4%'},{name:'ICICI Bank',wt:'22.1%'},{name:'Kotak Bank',wt:'12.3%'},{name:'Axis Bank',wt:'10.2%'},{name:'SBI',wt:'8.9%'}],
  '^CNXIT':[{name:'Infosys',wt:'29.1%'},{name:'TCS',wt:'26.4%'},{name:'HCL Tech',wt:'13.2%'},{name:'Wipro',wt:'7.8%'},{name:'Tech M',wt:'5.3%'}],
};
function renderIndexComposition(sym, el){
  const comp=INDEX_COMPOSITION[sym];
  if(!comp){el.innerHTML='<div style="font-size:10px;color:#4b6280;text-align:center;padding:8px;">Composition data not available for this index.</div>';return;}
  el.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">TOP CONSTITUENTS</div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      ${comp.map((c,i)=>`
        <div style="background:#0a1628;border-radius:6px;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:10px;color:#4b6280;font-weight:700;width:14px;">${i+1}</span>
            <span style="font-size:12px;font-weight:700;color:#e2e8f0;">${c.name}</span>
          </div>
          <span style="font-size:12px;font-weight:700;color:#34d399;">${c.wt}</span>
        </div>`).join('')}
      <div style="font-size:9px;color:#4b6280;text-align:center;padding:4px;">Approximate weightings — indicative only</div>
    </div>`;
}

// ======================================
// CIRCUIT LIMIT (from Yahoo Finance meta)
// ======================================
function renderCircuit(sym, d) {
  return; // Removed by user request
  const cs = document.getElementById("circuitSection");
  if (!cs) return;
  const pc = d.chartPreviousClose || 0;
  if (!pc) { cs.innerHTML = ''; return; }
  const cmp = d.regularMarketPrice || pc;
  const pct = ((cmp - pc) / pc * 100);
  // NSE circuit bands: 2%, 5%, 10%, 20%
  // Default 20% for most NSE stocks. Narrower bands for specific categories.
  const absPct = Math.abs(pct);
  let band = 20;
  if(absPct >= 19) band = 20;
  else if(absPct >= 9) band = 10;
  else if(absPct >= 4.5) band = 5;
  else if(absPct >= 1.9) band = 2;
  else band = 20;
  const uch = parseFloat((pc * (1 + band/100)).toFixed(2));
  const lcl = parseFloat((pc * (1 - band/100)).toFixed(2));
  const nearUC = Math.abs((cmp - uch) / uch) < 0.01;
  const nearLC = Math.abs((cmp - lcl) / lcl) < 0.01;
  const ucColor = nearUC ? '#22c55e' : pct > 0 ? '#38bdf8' : '#4b6280';
  const lcColor = nearLC ? '#ef4444' : pct < 0 ? '#f97316' : '#4b6280';
  const ucBorder = nearUC ? 'border:1px solid rgba(34,197,94,0.4);' : '';
  const lcBorder = nearLC ? 'border:1px solid rgba(239,68,68,0.4);' : '';
  cs.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">CIRCUIT LIMITS (±${band}% of Prev Close ₹${pc.toFixed(2)})</div>
    <div style="display:flex;gap:4px;">
      <div style="flex:1;background:#0a1628;border-radius:6px;padding:6px 8px;${ucBorder}">
        <div style="font-size:9px;color:#4b6280;">UPPER CIRCUIT</div>
        <div style="font-size:12px;font-weight:700;color:${ucColor};">₹${uch}</div>
        ${nearUC ? '<div style="font-size:9px;color:#22c55e;font-weight:700;">!! Near UC</div>' : ''}
      </div>
      <div style="flex:1;background:#0a1628;border-radius:6px;padding:6px 8px;${lcBorder}">
        <div style="font-size:9px;color:#4b6280;">LOWER CIRCUIT</div>
        <div style="font-size:12px;font-weight:700;color:${lcColor};">₹${lcl}</div>
        ${nearLC ? '<div style="font-size:9px;color:#ef4444;font-weight:700;">!! Near LC</div>' : ''}
      </div>
    </div>`;
}

// ======================================
// BULK / BLOCK DEALS (NSE RSS)
// ======================================
let bulkCache = {};
let bulkCacheTime = {};
const BULK_CACHE_MS = 10 * 60 * 1000;

async function fetchBulkDeals(sym) {
  const cleanSym = sym.replace('.NS','').replace('.BO','');
  const now = Date.now();
  if (bulkCache[cleanSym] && (now - (bulkCacheTime[cleanSym]||0)) < BULK_CACHE_MS) {
    return bulkCache[cleanSym];
  }
  try {
    const apiUrl = localStorage.getItem("customAPI") || API;
    const r = await fetch(`${apiUrl}?type=bulk&s=${encodeURIComponent(cleanSym)}`);
    if (!r.ok) return [];
    const data = await r.json();
    const items = data.items || [];
    bulkCache[cleanSym] = items;
    bulkCacheTime[cleanSym] = now;
    return items;
  } catch(e) { return []; }
}

async function renderBulkDeals(sym) {
  const bs = document.getElementById("bulkSection");
  if (!bs) return;
  bs.innerHTML = `<div style="font-size:10px;color:#4b6280;text-align:center;padding:4px;">Loading bulk/block deals...</div>`;
  const items = await fetchBulkDeals(sym);
  if (!items || items.length === 0) {
    bs.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;letter-spacing:0.5px;">BULK / BLOCK DEALS</div><div style="font-size:10px;color:#4b6280;padding:4px;">No recent bulk/block deals found.</div>`;
    return;
  }
  const rows = items.map(function(it) {
    const typeColor = (it.type||'').toLowerCase().includes('buy') ? '#22c55e' : '#ef4444';
    return `<div style="background:#0a1628;border-radius:6px;padding:5px 8px;margin-bottom:3px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;font-weight:700;color:${typeColor};">${it.type||'--'}</span>
        <span style="font-size:9px;color:#4b6280;">${it.date||''}</span>
      </div>
      <div style="font-size:10px;color:#e2e8f0;">${it.client||'--'} &mdash; ${it.qty||'--'} @ \u20b9${it.price||'--'}</div>
    </div>`;
  }).join('');
  bs.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">BULK / BLOCK DEALS</div>
    ${rows}`;
}

function switchDetailTab(tab){
  const tabs=['price','fund','tech','bb','links'];
  tabs.forEach(t=>{
    const el=document.getElementById('dtab-'+t);
    const btn=document.getElementById('dtab-btn-'+t);
    if(el) el.style.display = t===tab ? 'block' : 'none';
    if(btn){
      if(t===tab){ btn.style.background='#065f46'; btn.style.color='#34d399'; btn.style.borderColor='#065f46'; }
      else{ btn.style.background='transparent'; btn.style.color='#4b6280'; btn.style.borderColor='#1e3a5f'; }
    }
  });
  // BB: always re-render when tab clicked
  if(tab==='bb' && _bbSym) renderBollinger(_bbSym);
}
function closeDetail(){document.getElementById("detailModal").classList.add("hidden");document.body.style.overflow='';}

function openModal(type,sym,price){
  currentTrade={type,sym};
  document.getElementById("m-title").innerText=type+"  -  "+sym;
  document.getElementById("confirmBtn").style.background=type==="BUY"?"#166534":"#7f1d1d";
  document.getElementById("m-price").value=price;
  document.getElementById("m-qty").value="";
  document.getElementById("m-date").value=new Date().toISOString().split('T')[0];
  // Show/hide trade type for BUY/SELL
  const typeRow=document.getElementById("m-type-row");
  if(typeRow) typeRow.style.display=(type==="EDIT")?"none":"flex";
  setTradeType(currentTradeType);
  document.getElementById("taxCalcBox").style.display="none";
  document.getElementById("modal").classList.remove("hidden");
}

function openEdit(sym){
  let stock=h.find(x=>x.sym===sym);if(!stock)return;
  currentTrade={type:"EDIT",sym};
  document.getElementById("m-title").innerText="EDIT  -  "+sym;
  document.getElementById("m-price").value=stock.price;
  document.getElementById("m-qty").value=stock.qty;
  // Show saved buy date or today
  document.getElementById("m-date").value=stock.buyDate||new Date().toISOString().split('T')[0];
  document.getElementById("confirmBtn").style.background="#713f12";
  const typeRow=document.getElementById("m-type-row");
  if(typeRow) typeRow.style.display="none";
  document.getElementById("taxCalcBox").style.display="none";
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal(){document.getElementById("modal").classList.add("hidden");}

function confirmTrade(){
  let p=parseFloat(document.getElementById("m-price").value);
  let q=parseInt(document.getElementById("m-qty").value);
  let d=document.getElementById("m-date").value;
  if(!p||!q)return;
  let ex=h.find(x=>x.sym===currentTrade.sym);

  if(currentTrade.type==="EDIT"){
    let s=h.find(x=>x.sym===currentTrade.sym);if(!s)return;
    s.price=p; s.qty=q; s.buyDate=d;
    localStorage.setItem("h",JSON.stringify(h));
    if (currentUser) saveUserData('holdings');
    triggerAutoSync('holdings');
    closeModal(); renderHold(); return;
  }

  if(currentTrade.type==="BUY"){
    if(ex){let tq=ex.qty+q;ex.price=((ex.price*ex.qty)+(p*q))/tq;ex.qty=tq;if(!ex.buyDate)ex.buyDate=d;}
    else{h.push({sym:currentTrade.sym,qty:q,price:p,buyDate:d,tradeType:currentTradeType});}
    hist.unshift({sym:currentTrade.sym,qty:q,buy:p,sell:null,date:d,pnl:null,type:'BUY',tradeType:currentTradeType});
    localStorage.setItem("h",JSON.stringify(h));
    localStorage.setItem("hist",JSON.stringify(hist));
    if (currentUser) { saveUserData('holdings'); saveUserData('history'); }
    triggerAutoSync('history');
    closeModal(); renderHold(); return;
  }

  if(currentTrade.type==="SELL"){
    if(!ex||q>ex.qty){showPopup("Invalid Quantity");return;}
    let pnl=(p-ex.price)*q;
    const buyDate=ex.buyDate;
    if(q===ex.qty){h=h.filter(x=>x.sym!==ex.sym);}else{ex.qty-=q;}
    hist.unshift({sym:ex.sym,qty:q,buy:ex.price,sell:p,date:d,pnl,type:'SELL',tradeType:currentTradeType,buyDate});
    localStorage.setItem("h",JSON.stringify(h));
    localStorage.setItem("hist",JSON.stringify(hist));
    if (currentUser) { saveUserData('holdings'); saveUserData('history'); }
    closeModal(); renderHold(); renderHist(); tab("history");
  }
}

// ======================================
// FEATURE 1: 52W HIGH/LOW INDICATOR
// ======================================

// -- DAY BAR (inline visual) --
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
// DUAL BAR — Day H/L top + 52W H/L bottom, perfectly aligned
// ======================================
function buildDualBar(d){
  if(!d) return '';
  let dayHtml='',w52Html='';
  if(d.regularMarketDayHigh&&d.regularMarketDayLow){
    const lo=d.regularMarketDayLow,hi=d.regularMarketDayHigh,cur=d.regularMarketPrice;
    const pct=hi>lo?Math.min(100,Math.max(0,((cur-lo)/(hi-lo))*100)).toFixed(0):50;
    dayHtml=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px;">'
      +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:700;color:#64748b;">L:<span style="color:#ef4444;">'+lo.toFixed(0)+'</span></span>'
      +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:700;color:#64748b;">H:<span style="color:#22c55e;">'+hi.toFixed(0)+'</span></span>'
      +'</div>'
      +'<div style="background:#1e2d3d;border-radius:2px;height:3px;position:relative;margin-bottom:5px;">'
      +'<div style="position:absolute;left:0;width:'+pct+'%;height:100%;background:linear-gradient(90deg,#ef4444,#22c55e);border-radius:2px;"></div>'
      +'<div style="position:absolute;left:calc('+pct+'% - 2px);top:-1px;width:5px;height:5px;background:#fff;border-radius:50%;box-shadow:0 0 3px rgba(255,255,255,0.6);"></div>'
      +'</div>';
  }
  if(d.fiftyTwoWeekHigh&&d.fiftyTwoWeekLow){
    const lo=d.fiftyTwoWeekLow,hi=d.fiftyTwoWeekHigh,cur=d.regularMarketPrice;
    const pct=hi>lo?Math.min(100,Math.max(0,((cur-lo)/(hi-lo))*100)).toFixed(0):50;
    w52Html=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px;">'
      +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:9px;font-weight:700;color:#64748b;">52L:<span style="color:#ef4444;">'+lo.toFixed(0)+'</span></span>'
      +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:9px;font-weight:700;color:#64748b;">52H:<span style="color:#22c55e;">'+hi.toFixed(0)+'</span></span>'
      +'</div>'
      +'<div style="background:#1e2d3d;border-radius:2px;height:3px;position:relative;">'
      +'<div style="position:absolute;left:0;width:'+pct+'%;height:100%;background:linear-gradient(90deg,#4b6280,#38bdf8);border-radius:2px;"></div>'
      +'<div style="position:absolute;left:calc('+pct+'% - 2px);top:-1px;width:5px;height:5px;background:#38bdf8;border-radius:50%;box-shadow:0 0 3px rgba(56,189,248,0.5);"></div>'
      +'</div>';
  }
  return '<div>'+dayHtml+w52Html+'</div>';
}

// ======================================
// FEATURE 2: STOCK NEWS
// ======================================
function openNews(sym){
  window.open(`https://news.google.com/search?q=${sym}+NSE+stock&hl=en-IN&gl=IN&ceid=IN:en`);
}

// ======================================
// FEATURE 3: TOP GAINERS / LOSERS
// ======================================
function renderTopMovers(){
  const stocks = wl.map(s=>{
    const d=cache[s]?.data; if(!d) return null;
    const diff=d.regularMarketPrice-d.chartPreviousClose;
    const pct=(diff/d.chartPreviousClose*100)||0;
    return {sym:s, pct, price:d.regularMarketPrice};
  }).filter(Boolean);

  if(stocks.length===0) return '<div style="color:#4b6280;text-align:center;padding:10px;font-size:12px;">Data not loaded</div>';

  const sorted=[...stocks].sort((a,b)=>b.pct-a.pct);
  const gainers=sorted.slice(0,3);
  const losers=[...stocks].sort((a,b)=>a.pct-b.pct).slice(0,3);

  let html=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">`;

  html+=`<div><div style="font-size:11px;font-weight:700;color:#22c55e;margin-bottom:4px;">TOP GAINERS</div>`;
  gainers.forEach(s=>{
    html+=`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">${s.sym}</span>
      <span style="color:#22c55e;font-weight:700;">+${s.pct.toFixed(2)}%</span>
    </div>`;
  });
  html+=`</div>`;

  html+=`<div><div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:4px;">TOP LOSERS</div>`;
  losers.forEach(s=>{
    html+=`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">${s.sym}</span>
      <span style="color:#ef4444;font-weight:700;">${s.pct.toFixed(2)}%</span>
    </div>`;
  });
  html+=`</div></div>`;
  return html;
}

// ======================================
// FEATURE 4: HOLDINGS CSV IMPORT
// ======================================
function triggerCSVImport(){
  document.getElementById("csvImportInput").click();
}

function handleCSVImport(event){
  const file=event.target.files[0];
  if(!file){ return; }
  const reader=new FileReader();
  reader.onload=function(e){
    const lines=e.target.result.split('\n').map(l=>l.trim()).filter(l=>l);
    let imported=0, skipped=0;

    // skip header row if exists
    const startIdx = lines[0].toUpperCase().includes('SYMBOL') ? 1 : 0;

    for(let i=startIdx;i<lines.length;i++){
      const cols=lines[i].split(',').map(c=>c.trim());
      if(cols.length<3) { skipped++; continue; }
      const sym=cols[0].toUpperCase();
      const qty=parseInt(cols[1]);
      const price=parseFloat(cols[2]);
      const date=cols[3]||new Date().toISOString().split('T')[0];
      if(!sym||isNaN(qty)||isNaN(price)||qty<=0||price<=0){ skipped++; continue; }
      const ex=h.find(x=>x.sym===sym);
      if(ex){
        const tq=ex.qty+qty;
        ex.price=((ex.price*ex.qty)+(price*qty))/tq;
        ex.qty=tq;
      } else {
        h.push({sym,qty,price});
      }
      imported++;
    }
    localStorage.setItem("h",JSON.stringify(h));
    if (currentUser) saveUserData('holdings');
    event.target.value="";
    showPopup(`Import: ${imported} stocks, ${skipped} skipped`);
    tab("holdings");
  };
  reader.readAsText(file);
}

// ======================================
// FEATURE 5: BACKUP & RESTORE (JSON)
// ======================================
function backupData(){
  const data={
    wl, h, hist, alerts, groups,
    exportedAt: new Date().toLocaleString('en-IN'),
    version:"1.3"
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`RealTraderPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showPopup("Backup downloaded!");
}

function triggerRestore(){
  // Remove old input if exists
  const old=document.getElementById("restoreInput");
  if(old) old.remove();
  // Create fresh file input each time (fixes Chrome security block)
  const inp=document.createElement("input");
  inp.type="file";
  inp.accept=".json";
  inp.id="restoreInput";
  inp.style.display="none";
  inp.onchange=handleRestore;
  document.body.appendChild(inp);
  inp.click();
}

function handleRestore(event){
  const file=event.target.files[0];
  if(!file){ event.target.remove(); return; }
  if(!confirm("This will replace existing data. Continue?")){ event.target.remove(); return; }
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=JSON.parse(e.target.result);
      if(data.wl)    { wl=data.wl;       localStorage.setItem("wl",JSON.stringify(wl)); }
      if(data.h)     { h=data.h;         localStorage.setItem("h",JSON.stringify(h)); }
      if(data.hist)  { hist=data.hist;   localStorage.setItem("hist",JSON.stringify(hist)); }
      if(data.alerts){ alerts=data.alerts; localStorage.setItem("alerts",JSON.stringify(alerts)); }
      if(data.groups){ groups=data.groups; localStorage.setItem("groups",JSON.stringify(groups)); }
      if(data.journal){ journal=data.journal; localStorage.setItem("journal",JSON.stringify(journal)); }
      if(data.targets){ targets=data.targets; localStorage.setItem("targets",JSON.stringify(targets)); }
      event.target.remove();
      showPopup("Data restored! Reloading...");
      setTimeout(()=>location.reload(),1500);
    }catch(err){
      showPopup("Invalid backup file");
      event.target.remove();
    }
  };
  reader.readAsText(file);
}

// ======================================
// FEATURE: PRICE RANGE BAR (Day High-Low)
// ======================================
function getPriceRangeBar(d){
  if(!d||!d.regularMarketDayHigh||!d.regularMarketDayLow) return '';
  const lo=d.regularMarketDayLow, hi=d.regularMarketDayHigh, cur=d.regularMarketPrice;
  const range=hi-lo;
  if(range<=0) return '';
  const pct=Math.min(100,Math.max(0,((cur-lo)/range)*100)).toFixed(0);
  return `<div style="margin-top:3px;">
    <div style="display:flex;justify-content:space-between;font-size:9px;color:#4b6280;">
      <span>L:₹${lo.toFixed(0)}</span><span>H:₹${hi.toFixed(0)}</span>
    </div>
    <div style="background:#1e2d3d;border-radius:4px;height:4px;position:relative;margin-top:2px;">
      <div style="position:absolute;left:0;width:${pct}%;height:100%;background:linear-gradient(90deg,#ef4444,#22c55e);border-radius:4px;"></div>
      <div style="position:absolute;left:calc(${pct}% - 3px);top:-2px;width:6px;height:8px;background:#fff;border-radius:2px;"></div>
    </div>
  </div>`;
}

// ======================================
// FEATURE: AVG vs CMP BAR (Holdings)
// ======================================
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

// ======================================
// FEATURE: SETTINGS
// ======================================
let dupWarnEnabled = true;
let refreshInterval = null;

try{ dupWarnEnabled = localStorage.getItem("dupWarn") !== "false"; }catch(e){}


// ======================================
// EXPORT CSV (History)
// ======================================
function exportCSV(){
  if(!hist||hist.length===0){ showPopup('No history to export'); return; }
  const rows=['Type,Symbol,TradeType,BuyPrice,SellPrice,Qty,PnL,Date,BuyDate'];
  hist.forEach(x=>{
    const row=[
      x.type||'',
      x.sym||'',
      x.tradeType||'',
      x.buy||'',
      x.sell||'',
      x.qty||'',
      x.pnl!=null?x.pnl.toFixed(2):'',
      x.date||'',
      x.buyDate||''
    ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
    rows.push(row);
  });
  const csv=rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='RealTraderPro_History_'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  showPopup('CSV exported!');
}

// ======================================
// P&L CALENDAR (History)
// ======================================
// Calendar state
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth(), calSelDay=null;

function calNav(dir){
  calMonth+=dir;
  if(calMonth>11){calMonth=0;calYear++;}
  if(calMonth<0){calMonth=11;calYear--;}
  calSelDay=null;
  renderCalendar();
}

function calSelectDay(d){
  calSelDay=(calSelDay===d)?null:d; // toggle
  renderCalendar();
}

function renderCalendar(){
  const el=document.getElementById('historyCalendar');
  if(!el) return;
  const now=new Date();
  const yr=calYear, mo=calMonth;
  const firstDay=new Date(yr,mo,1).getDay();
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build day->{pnl, trades[]} map for ALL trades (BUY+SELL)
  const dayData={};
  hist.forEach(x=>{
    if(!x.date) return;
    const xDate=new Date(x.date);
    if(isNaN(xDate)) return;
    if(xDate.getFullYear()!==yr||xDate.getMonth()!==mo) return;
    const dnum=xDate.getDate();
    if(!dayData[dnum]) dayData[dnum]={pnl:0,hasSell:false,trades:[]};
    if(x.type==='SELL'&&x.pnl!=null){ dayData[dnum].pnl+=x.pnl; dayData[dnum].hasSell=true; }
    dayData[dnum].trades.push(x);
  });

  // Header with month nav
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <button onclick="calNav(-1)" style="background:#1e3a5f;color:#38bdf8;border:none;border-radius:6px;padding:4px 10px;font-size:14px;font-weight:700;cursor:pointer;">&lt;</button>
    <span style="font-size:13px;font-weight:700;color:#94a3b8;">${monthNames[mo]} ${yr}</span>
    <button onclick="calNav(1)" style="background:#1e3a5f;color:#38bdf8;border:none;border-radius:6px;padding:4px 10px;font-size:14px;font-weight:700;cursor:pointer;">&gt;</button>
  </div>`;

  // Day headers
  html+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">`;
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>{
    html+=`<div style="text-align:center;font-size:9px;color:#4b6280;font-weight:700;padding:2px;">${d}</div>`;
  });
  html+=`</div>`;

  // Day cells
  html+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">`;
  for(let i=0;i<firstDay;i++) html+=`<div></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const dd=dayData[d];
    const isToday=now.getDate()===d&&now.getMonth()===mo&&now.getFullYear()===yr;
    const isSel=calSelDay===d;
    let bg='#1e2d3d', color='#4b6280', fw='400';
    if(dd){
      if(dd.hasSell){ bg=dd.pnl>=0?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'; color=dd.pnl>=0?'#22c55e':'#ef4444'; fw='700'; }
      else{ bg='rgba(56,189,248,0.15)'; color='#38bdf8'; fw='600'; } // BUY only day
    }
    const border=isSel?'2px solid #f59e0b':isToday?'1px solid #38bdf8':'1px solid transparent';
    const cursor=dd?'cursor:pointer':'cursor:default';
    html+=`<div onclick="${dd?`calSelectDay(${d})`:''}" style="text-align:center;padding:5px 2px;border-radius:6px;background:${bg};border:${border};${cursor};transition:opacity 0.1s;">
      <div style="font-size:11px;font-weight:${fw};color:${color};">${d}</div>
      ${dd&&dd.hasSell?`<div style="font-size:8px;color:${color};">${dd.pnl>=0?'+':''}${Math.abs(dd.pnl)>=1000?(dd.pnl/1000).toFixed(1)+'k':dd.pnl.toFixed(0)}</div>`:''}
      ${dd&&!dd.hasSell?`<div style="font-size:8px;color:#38bdf8;">B</div>`:''}
    </div>`;
  }
  html+=`</div>`;

  // Legend
  html+=`<div style="display:flex;gap:10px;margin-top:8px;justify-content:center;">
    <span style="font-size:9px;color:#22c55e;">+ Profit day</span>
    <span style="font-size:9px;color:#ef4444;">- Loss day</span>
    <span style="font-size:9px;color:#38bdf8;">Buy only</span>
  </div>`;

  // Selected day trades
  if(calSelDay&&dayData[calSelDay]){
    const trades=dayData[calSelDay].trades;
    const dateStr=`${String(calSelDay).padStart(2,'0')}/${String(mo+1).padStart(2,'0')}/${yr}`;
    html+=`<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:6px;">Trades on ${dateStr} (${trades.length})</div>`;
    trades.forEach(x=>{
      const isBuy=x.type==='BUY';
      const pnlStr=(!isBuy&&x.pnl!=null)?`<span style="font-weight:700;color:${x.pnl>=0?'#22c55e':'#ef4444'};">${x.pnl>=0?'+':''}${inr(x.pnl)}</span>`:'';
      html+=`<div style="background:#111827;border-radius:8px;padding:7px 10px;margin-bottom:4px;display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;">
        <div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;">${x.sym}</span>
          <span style="font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;background:${isBuy?'#166534':'#7f1d1d'};color:${isBuy?'#86efac':'#fca5a5'};margin-left:4px;">${x.type}</span>
          ${x.tradeType?`<span style="font-size:9px;padding:1px 4px;border-radius:3px;font-weight:700;background:${x.tradeType==='MIS'?'#4a1d96':'#1e3a5f'};color:${x.tradeType==='MIS'?'#c4b5fd':'#93c5fd'};margin-left:3px;">${x.tradeType}</span>`:''}
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">Qty:${x.qty} @ ${inr(parseFloat(isBuy?x.buy:x.sell))}</span>
        ${pnlStr}
      </div>`;
    });
    html+=`</div>`;
  } else if(calSelDay){
    html+=`<div style="margin-top:8px;text-align:center;color:#4b6280;font-size:11px;">No trades on this day</div>`;
  }

  el.innerHTML=html;
}

// ======================================
// TERTIARY API EDIT (Settings)
// ======================================
function startAPI3Edit(){
  const inp=document.getElementById('set-api3-input');
  if(inp) inp.value=localStorage.getItem('customAPI3')||'';
  document.getElementById('set-api3-edit').style.display='block';
  document.getElementById('changeURL3Btn').style.display='none';
}
function cancelAPI3Edit(){
  document.getElementById('set-api3-edit').style.display='none';
  document.getElementById('changeURL3Btn').style.display='inline-block';
}


// ======================================
// BATCH FETCH (parallel, single API call)
// ======================================
// Normalize GAS batch item -> app cache format
function normalizeBatchItem(gasData){
  // GAS returns: {price, prevClose, open, high, low, week52High, week52Low, volume, pe, eps, mktCap}
  // App expects: regularMarketPrice, chartPreviousClose, etc.
  if(!gasData||!gasData.price) return null;
  return {
    regularMarketPrice:       gasData.price,
    chartPreviousClose:       gasData.prevClose,
    regularMarketOpen:        (gasData.open != null ? gasData.open : gasData.price),
    regularMarketDayHigh:     gasData.high,
    regularMarketDayLow:      gasData.low,
    fiftyTwoWeekHigh:         gasData.week52High,
    fiftyTwoWeekLow:          gasData.week52Low,
    regularMarketVolume:      gasData.volume,
    trailingPE:               gasData.pe,
    epsTrailingTwelveMonths:  gasData.eps,
    marketCap:                gasData.mktCap
  };
}

async function batchFetchStocks(symbols, isIndex=false){
  if(!symbols||symbols.length===0) return;
  const syms=symbols.map(s=>isIndex?s:s+'.NS').join(',');
  const urls=[
    localStorage.getItem('customAPI')||API,
    localStorage.getItem('customAPI2')||API2,
    localStorage.getItem('customAPI3')||API3
  ].filter(Boolean);

  async function tryBatch(apiUrl){
    try{
      const r=await fetch(`${apiUrl}?type=batch&s=${syms}`);
      const j=await r.json();
      if(!j||j.error) return false;
      // GAS batch format: { "SBIN.NS": {price,prevClose,...}, "INFY.NS": {...} }
      let stored=0;
      Object.entries(j).forEach(([sym,gasData])=>{
        const normalized=normalizeBatchItem(gasData);
        if(!normalized) return;
        // Indices: keep "^NSEI" as-is. Stocks: strip ".NS"
        const cacheKey=isIndex?sym:sym.replace('.NS','');
        cache[cacheKey]={data:normalized,time:Date.now()};
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
  // All batch attempts failed  -  fallback to individual calls
  await Promise.all(symbols.map(s=>fetchFull(s,isIndex)));
}

// -- FETCH WITH 3-URL FALLBACK --
async function fetchFull(sym,isIndex=false){
  let key=sym, symbol=isIndex?sym:sym+".NS";
  let encodedSymbol=symbol.replace(/\^/g,"%5E");
  if(cache[key]&&(Date.now()-cache[key].time<CACHE_TIME)) return cache[key].data;

  const urls=[
    localStorage.getItem("customAPI")||API,
    localStorage.getItem('customAPI2')||API2,
    localStorage.getItem('customAPI3')||API3
  ].filter(Boolean);

  async function tryOne(apiUrl){
    try{
      let r=await fetch(`${apiUrl}?s=${encodedSymbol}`);
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
  showError("All APIs failed  -  Check quota or URLs in Settings");
  return null;
}
// =============================================
// NIVI VOICE SETTINGS
// =============================================
function _getNiviRate()  { return parseFloat(localStorage.getItem('niviRate')  || '0.88'); }
function _getNiviPitch() { return parseFloat(localStorage.getItem('niviPitch') || '1.15'); }
function _getNiviAutoSpeak() { return localStorage.getItem('niviAutoSpeak') !== 'off'; }

function toggleNiviAutoSpeak() {
  const on = _getNiviAutoSpeak();
  localStorage.setItem('niviAutoSpeak', on ? 'off' : 'on');
  _updateNiviSettingsUI();
  showPopup('Auto Speak ' + (on ? 'OFF' : 'ON'));
}

function updateNiviSpeed(val) {
  localStorage.setItem('niviRate', val);
  const labels = { 0.5:'Bahut Dheere', 0.6:'Dheere', 0.7:'Thoda Dheere', 0.8:'Normal se Kam',
    0.9:'Normal', 1.0:'Normal+', 1.1:'Thoda Tez', 1.2:'Tez', 1.3:'Bahut Tez', 1.4:'Fast', 1.5:'Very Fast' };
  const label = labels[parseFloat(val).toFixed(1)] || 'Custom';
  const el = document.getElementById('nivi-speed-label');
  if (el) el.innerText = label;
}

function updateNiviPitch(val) {
  localStorage.setItem('niviPitch', val);
  const v = parseFloat(val);
  const label = v < 0.95 ? 'Mota (Deep)' : v > 1.2 ? 'Patla (High)' : 'Normal';
  const el = document.getElementById('nivi-pitch-label');
  if (el) el.innerText = label;
}

function niviVoiceTest() {
  if (!window.speechSynthesis) { showPopup('TTS support nahi hai'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance('नमस्ते! मैं निवी हूँ। आपकी स्टॉक मार्केट सहायक।');
  u.lang  = 'hi-IN';
  u.rate  = _getNiviRate();
  u.pitch = _getNiviPitch();
  const voices  = speechSynthesis.getVoices();
  const female  =
    voices.find(v => v.lang==='hi-IN' && /neerja|female|woman|lekha|aditi|riya|priya/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN' && v.name.includes('Microsoft') && !/male/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN' && v.name.includes('Google')    && !/male/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN' && !/male/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN');
  if (female) { u.voice = female; showPopup('Voice: ' + female.name); }
  window.speechSynthesis.speak(u);
}

function _updateNiviSettingsUI() {
  const chk = document.getElementById('nivi-autospeak-chk');
  if (chk) { chk.checked = _getNiviAutoSpeak(); }
  const speedSlider = document.getElementById('nivi-speed-slider');
  if (speedSlider) { speedSlider.value = _getNiviRate(); updateNiviSpeed(_getNiviRate()); }
  const pitchSlider = document.getElementById('nivi-pitch-slider');
  if (pitchSlider) { pitchSlider.value = _getNiviPitch(); updateNiviPitch(_getNiviPitch()); }
}

function loadSettingsUI(){
  const d1=document.getElementById("set-api-display");
  const d2=document.getElementById("set-api2-display");
  const d3=document.getElementById("set-api3-display");
  const refEl=document.getElementById("set-refresh");
  const cacheEl=document.getElementById("set-cache");
  if(d1) d1.innerText=localStorage.getItem("customAPI")||API;
  if(d2) d2.innerText=localStorage.getItem("customAPI2")||API2;
  if(d3) d3.innerText=localStorage.getItem("customAPI3")||API3;
  if(refEl) refEl.value=parseInt(localStorage.getItem("refreshSec")||"10");
  if(cacheEl) cacheEl.value=parseInt(localStorage.getItem("cacheSec")||"8000");
  // Dup warn — iOS checkbox
  const dupChk = document.getElementById('dupToggleChk');
  if(dupChk) dupChk.checked = dupWarnEnabled;
  // Font size
  const curFs=localStorage.getItem('fontSize')||'medium';
  setFontSize(curFs);
  // Google Sheets UI
  const sheetDisplay = document.getElementById('sheet-id-display');
  const sheetCheck = document.getElementById('sheet-enabled');
  const DEFAULT_SHEET_ID = '1INjKSkOkXYF4y1DDorsCCFIYu0lBkEJTmLupJ6y9i8U';
  if(sheetDisplay) sheetDisplay.innerText = localStorage.getItem('sheetId') || DEFAULT_SHEET_ID;
  if(sheetCheck) sheetCheck.checked = localStorage.getItem('sheetEnabled') === 'true';
  updateSheetStatus();
  // Alert engine toggle
  const aeChk = document.getElementById('alertEngineChk');
  if(aeChk) aeChk.checked = localStorage.getItem('alertEngineOn') !== 'false';
  // Notification toggle
  const ntChk = document.getElementById('notifToggleChk');
  const ntStat = document.getElementById('notifPermStatus');
  if(ntChk) ntChk.checked = localStorage.getItem('notifOn') !== 'false';
  if(ntStat){
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    if(perm==='granted') { ntStat.textContent='Permission: Granted ✓'; ntStat.style.color='#4ade80'; }
    else if(perm==='denied') { ntStat.textContent='Permission: Blocked ✗ (Enable in browser)'; ntStat.style.color='#f87171'; }
    else { ntStat.textContent='Not yet requested'; ntStat.style.color='#64748b'; }
  }
  // Avatar initial letter from currentUser
  const avEl = document.getElementById('settingsAvatarLetter');
  if(avEl && currentUser) {
  const uname = typeof currentUser === 'string' ? currentUser : (currentUser.name || '?');
  avEl.textContent = uname.charAt(0).toUpperCase();
}
  // FF2 URL display
  const ff2Display = document.getElementById('ff2-url-display');
  const ff2Sub = document.getElementById('ff2-url-sub');
  const ff2Saved = localStorage.getItem('ff2ApiUrl') || '';
  if(ff2Display) ff2Display.innerText = ff2Saved || 'Not configured';
  if(ff2Sub) {
    if(ff2Saved) { ff2Sub.textContent = '✓ FF2 URL set · Screener data active'; ff2Sub.style.color='#fb923c'; }
    else { ff2Sub.textContent = 'Not set — tap to configure'; ff2Sub.style.color='#64748b'; }
  }
}

function startFF2Edit(){
  const inp = document.getElementById('ff2-url-input');
  if(inp) inp.value = localStorage.getItem('ff2ApiUrl') || '';
  document.getElementById('ff2-url-edit').style.display = 'block';
  document.getElementById('changeFF2Btn').style.display = 'none';
}
function cancelFF2Edit(){
  document.getElementById('ff2-url-edit').style.display = 'none';
  document.getElementById('changeFF2Btn').style.display = 'inline-block';
}
function saveFF2Url(){
  const val = (document.getElementById('ff2-url-input').value || '').trim();
  if(val && !val.startsWith('https://script.google.com')){
    showPopup('Invalid URL — GAS URL https://script.google.com/... hovu joiye');
    return;
  }
  localStorage.setItem('ff2ApiUrl', val);
  cancelFF2Edit();
  loadSettingsUI();
  showPopup(val ? '✅ FF2 URL saved! Learn tab ready.' : 'FF2 URL cleared');
}

// જે ફંક્શનનું નામ ગાયબ હતું, તે મેં અહી ઉમેરી દીધું છે 👇
function toggleSection(bodyId, arrId) {
  const b=document.getElementById(bodyId);
  const a=document.getElementById(arrId);
  if(!b||!a) return;
  const hidden=b.style.display==='none'||b.style.display==='';
  b.style.display=hidden?'block':'none';
  a.textContent=hidden?'▼':'▶';
}
function startAPIEdit(){
  const inp=document.getElementById("set-api-input");
  if(inp) inp.value=localStorage.getItem("customAPI")||API;
  document.getElementById("set-api-edit").style.display="block";
  document.getElementById("changeURLBtn").style.display="none";
}
function cancelAPIEdit(){
  document.getElementById("set-api-edit").style.display="none";
  document.getElementById("changeURLBtn").style.display="inline-block";
}
function startAPI2Edit(){
  const inp=document.getElementById("set-api2-input");
  if(inp) inp.value=localStorage.getItem("customAPI2")||"";
  document.getElementById("set-api2-edit").style.display="block";
  document.getElementById("changeURL2Btn").style.display="none";
}
function cancelAPI2Edit(){
  document.getElementById("set-api2-edit").style.display="none";
  document.getElementById("changeURL2Btn").style.display="inline-block";
}

function saveSetting(type){
  if(type==="api"){
    const val=document.getElementById("set-api-input").value.trim();
    if(!val){ showPopup("URL cannot be empty"); return; }
    localStorage.setItem("customAPI",val);
    if (currentUser) saveUserData('settings');
    cancelAPIEdit();
    loadSettingsUI();
    showPopup("Primary API saved! Refresh to apply.");
  }
  if(type==="api2"){
    const val=document.getElementById("set-api2-input").value.trim();
    localStorage.setItem("customAPI2",val);
    cancelAPI2Edit();
    loadSettingsUI();
    showPopup(val?"Secondary API saved!":"Secondary API cleared");
  }
  if(type==="api3"){
    const val=document.getElementById("set-api3-input").value.trim();
    localStorage.setItem("customAPI3",val);
    cancelAPI3Edit();
    loadSettingsUI();
    showPopup(val?"Tertiary API saved!":"Tertiary API cleared");
  }
  if(type==="refresh"){
    const val=parseInt(document.getElementById("set-refresh").value);
    if(val<10){ showPopup("Minimum 10 seconds"); return; }
    localStorage.setItem("refreshSec",val);
    if(refreshInterval) clearInterval(refreshInterval);
    refreshInterval=setInterval(()=>{updatePrices();},val*1000);
    showPopup(`Refresh set to ${val}s`);
  }
  if(type==="cache"){
    const val=parseInt(document.getElementById("set-cache").value);
    if(val<1000){ showPopup("Minimum 1000ms"); return; }
    CACHE_TIME=val;
    localStorage.setItem("cacheSec",val);
    showPopup(`Cache set to ${val}ms`);
  }
}

function toggleDupWarn(){
  dupWarnEnabled=!dupWarnEnabled;
  localStorage.setItem("dupWarn",dupWarnEnabled?"true":"false");
  const chk=document.getElementById("dupToggleChk");
  if(chk) chk.checked=dupWarnEnabled;
  showPopup(`Duplicate warning ${dupWarnEnabled?"ON":"OFF"}`);
}
function toggleDupWarnChk(val){
  dupWarnEnabled=val;
  localStorage.setItem("dupWarn",val?"true":"false");
  showPopup(`Duplicate warning ${val?"ON":"OFF"}`);
}
function toggleNiviAutoSpeakChk(val){
  localStorage.setItem('niviAutoSpeak', val ? 'on' : 'off');
  showPopup('Auto Speak ' + (val ? 'ON' : 'OFF'));
}
function toggleAlertEngine(){
  const chk=document.getElementById('alertEngineChk');
  const next=chk?chk.checked:true;
  localStorage.setItem('alertEngineOn', next?'true':'false');
  showPopup('Technical Alerts ' + (next?'ON ⚡':'OFF 🔕'));
}
function toggleNotifications(){
  const chk=document.getElementById('notifToggleChk');
  const next=chk?chk.checked:true;
  const perm=typeof Notification!=='undefined'?Notification.permission:'unsupported';
  if(perm==='denied' && next){
    showPopup('Notifications blocked in browser. Enable from site settings.',5000);
    if(chk) chk.checked=false;
    return;
  }
  localStorage.setItem('notifOn', next?'true':'false');
  if(next && perm==='default'){
    Notification.requestPermission().then(p=>{
      const s=document.getElementById('notifPermStatus');
      if(s){ s.textContent=p==='granted'?'Permission: Granted ✓':'Permission: Denied ✗'; s.style.color=p==='granted'?'#4ade80':'#f87171'; }
    });
  }
  showPopup('Browser Notifications ' + (next?'ON 🔔':'OFF 🔕'));
}

// Fix 4: Separate clear with confirmation
let _dangerPendingType = null;
function clearData(type){
  const labels={holdings:'Holdings',history:'Trade History',alerts:'All Alerts'};
  const descs={
    holdings:'All your holding entries will be permanently deleted. P&L data will be lost.',
    history:'All trade history entries will be permanently deleted.',
    alerts:'All price alerts and technical alert logs will be cleared.'
  };
  _dangerPendingType = type;
  const modal = document.getElementById('dangerModal');
  const titleEl = document.getElementById('dangerModalTitle');
  const descEl = document.getElementById('dangerModalDesc');
  const btnEl = document.getElementById('dangerConfirmBtn');
  if(!modal) { _executeClearData(type); return; }
  if(titleEl) titleEl.textContent = 'Clear ' + (labels[type]||type) + '?';
  if(descEl) descEl.textContent = descs[type]||'This data will be permanently deleted.';
  if(btnEl){ btnEl.textContent = 'Clear ' + (labels[type]||type); btnEl.onclick = confirmDangerClear; }
  modal.style.display = 'flex';
}
function closeDangerModal(){
  const modal = document.getElementById('dangerModal');
  if(modal) modal.style.display = 'none';
  _dangerPendingType = null;
}
function confirmDangerClear(){
  closeDangerModal();
  if(_dangerPendingType) _executeClearData(_dangerPendingType);
}
function _executeClearData(type){
  if(type==='holdings'){ h=[]; localStorage.setItem('h',JSON.stringify(h)); if(currentUser) saveUserData('holdings'); renderHold(); }
  if(type==='history'){ hist=[]; localStorage.setItem('hist',JSON.stringify(hist)); if(currentUser) saveUserData('history'); renderHist(); }
  if(type==='alerts'){ alerts=[]; localStorage.setItem('alerts',JSON.stringify(alerts)); if(currentUser) saveUserData('alerts'); }
  const labels={holdings:'Holdings',history:'Trade History',alerts:'All Alerts'};
  showPopup((labels[type]||type)+' cleared!');
}
function clearAllData(){
  clearData('holdings'); clearData('history'); clearData('alerts');
}


// ======================================
// TAP ACTION PANEL SYSTEM
// ======================================
function toggleActions(sym){
  var panel=document.getElementById('act-'+sym);
  if(!panel) return;
  // Close all others first
  document.querySelectorAll('.wl-actions-panel.open').forEach(function(el){
    if(el.id!=='act-'+sym) el.classList.remove('open');
  });
  panel.classList.toggle('open');
}

// Tap anywhere else closes action panels
document.addEventListener('click',function(e){
  if(!e.target.closest('.wl-card-wrap')){
    document.querySelectorAll('.wl-actions-panel.open').forEach(function(el){
      el.classList.remove('open');
    });
  }
});

// ======================================
// SORT
// ======================================
// -- CHART --
function getTVSymbol(sym){
  if(sym==="^NSEI") return "NIFTY";
  if(sym==="^BSESN") return "SENSEX";
  if(sym==="^NSEBANK") return "BANKNIFTY";
  return sym;
}
function chart(sym,isIndex){
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

// -- ALERT MODAL — Upgraded --
var currentAlertSym = "";
var _alertDir = "above"; // "above" | "below"

function setAlertDir(dir) {
  _alertDir = dir;
  document.getElementById('alert-above-btn').style.background = dir==='above' ? '#166534' : '#1e2d3d';
  document.getElementById('alert-above-btn').style.color      = dir==='above' ? '#86efac' : '#94a3b8';
  document.getElementById('alert-above-btn').style.borderColor= dir==='above' ? '#166534' : '#2d3f52';
  document.getElementById('alert-below-btn').style.background = dir==='below' ? '#7f1d1d' : '#1e2d3d';
  document.getElementById('alert-below-btn').style.color      = dir==='below' ? '#fca5a5' : '#94a3b8';
  document.getElementById('alert-below-btn').style.borderColor= dir==='below' ? '#7f1d1d' : '#2d3f52';
}

function setAlert(sym) {
  currentAlertSym = sym;
  _alertDir = "above";
  setAlertDir("above");
  document.getElementById("alert-title").innerText = "🔔 Alert — " + sym;
  document.getElementById("alert-price").value = "";
  var d = cache[sym] && cache[sym].data;
  var price = d ? d.regularMarketPrice : 0;
  document.getElementById("alert-current-price").innerText =
    "CMP: ₹" + (price ? price.toFixed(2) : "--");
  document.getElementById("alert-price").placeholder = "e.g. " + (price ? (price*1.05).toFixed(0) : "500");
  // Show existing alerts for this sym
  var existing = alerts.filter(a => a.sym===sym && !a.triggered);
  var listEl = document.getElementById("alert-existing-list");
  if (existing.length > 0) {
    listEl.innerHTML = '<div style="font-size:9px;color:#4b6280;margin-bottom:4px;font-weight:700;">EXISTING ALERTS</div>' +
      existing.map((a,i) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;background:#0a1628;border-radius:6px;padding:5px 8px;margin-bottom:3px;">
          <span style="font-size:11px;color:${a.dir==='below'?'#fca5a5':'#86efac'};">${a.dir==='below'?'▼':'▲'} ₹${a.price}</span>
          <button onclick="removeAlert('${sym}',${a.price})" style="background:transparent;border:none;color:#ef4444;font-size:11px;cursor:pointer;">✕</button>
        </div>`
      ).join('');
  } else {
    listEl.innerHTML = '';
  }
  document.getElementById("alertModal").style.display = "flex";
}

function removeAlert(sym, price) {
  alerts = alerts.filter(a => !(a.sym===sym && a.price===price));
  localStorage.setItem("alerts", JSON.stringify(alerts));
  setAlert(sym); // refresh modal
}

function closeAlertModal() {
  document.getElementById("alertModal").style.display = "none";
}

function confirmAlert() {
  var price = parseFloat(document.getElementById("alert-price").value);
  if (!price || isNaN(price)) { showPopup("Valid price daakho"); return; }
  // Remove duplicate
  alerts = alerts.filter(a => !(a.sym===currentAlertSym && a.price===price));
  alerts.push({ sym:currentAlertSym, price:price, dir:_alertDir, triggered:false });
  localStorage.setItem("alerts", JSON.stringify(alerts));
  closeAlertModal();
  showPopup("🔔 Alert set: " + currentAlertSym + " " + (_alertDir==='above'?'▲':'▼') + " ₹" + price);
  // Request browser notification permission
  if (Notification && Notification.permission === 'default') Notification.requestPermission();
}
// -- CHECK ALERTS — Upgraded --
function checkAlerts(sym, currentPrice) {
  var updated = false;
  alerts.forEach(function(a) {
    if (a.sym !== sym || a.triggered) return;
    var hit = false;
    if (a.dir === 'above' && currentPrice >= parseFloat(a.price)) hit = true;
    if (a.dir === 'below' && currentPrice <= parseFloat(a.price)) hit = true;
    if (!a.dir && Math.abs(currentPrice - parseFloat(a.price)) <= 1) hit = true; // legacy
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
  if (updated) localStorage.setItem("alerts", JSON.stringify(alerts));
}

function sortAZ(){
  watchlists[currentWL].stocks.sort((a,b)=>azAsc?a.localeCompare(b):b.localeCompare(a));
  azAsc=!azAsc; saveWatchlists(); renderWL();
}
function sortPrice(){
  watchlists[currentWL].stocks.sort((a,b)=>{let pa=cache[a]?.data?.regularMarketPrice||0,pb=cache[b]?.data?.regularMarketPrice||0;return priceAsc?pa-pb:pb-pa;});
  priceAsc=!priceAsc; saveWatchlists(); renderWL();
}
function sortPercent(){
  watchlists[currentWL].stocks.sort((a,b)=>{let da=cache[a]?.data,db=cache[b]?.data;let pa=da?(da.regularMarketPrice-da.chartPreviousClose)/da.chartPreviousClose:0;let pb=db?(db.regularMarketPrice-db.chartPreviousClose)/db.chartPreviousClose:0;return percentAsc?pa-pb:pb-pa;});
  percentAsc=!percentAsc; saveWatchlists(); renderWL();
}

// ======================================
// TAB
// ======================================
function tab(t){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove("active"));
  document.getElementById(t).classList.add("active");
  document.querySelectorAll('.bot-nav-btn').forEach(b=>b.classList.remove("active"));
  const nb=document.getElementById("nav-"+t);if(nb)nb.classList.add("active");
  document.getElementById("searchSection").style.display=(t==="watchlist")?"block":"none";
  document.getElementById("filterBar").style.display=(t==="watchlist")?"block":"none";
  if(t==="holdings")renderHold();
  if(t==="history")renderHist();
  if(t==="indices")renderIndices();
  if(t==="alerts")renderAlerts();
  function renderAlerts(){
  const el = document.getElementById('alerts');
  if(!el) return;

  // === SECTION 1: Price Alerts ===
  let priceHTML = '';
  if(alerts && alerts.length > 0){
    priceHTML = alerts.map(a => {
      const col = a.triggered ? '#22c55e' : '#f59e0b';
      const status = a.triggered
        ? `✅ Triggered @ ₹${a.triggeredPrice?.toFixed(2)||''} — ${a.triggeredAt||''}`
        : `⏳ Waiting`;
      return `<div style="background:#0a1628;border-radius:8px;padding:8px 10px;margin-bottom:6px;border:1px solid ${col}33;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;color:#38bdf8;font-size:13px;">${a.sym}</span>
          <span style="font-size:11px;color:${col};">${a.dir==='above'?'▲':'▼'} ₹${a.price}</span>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${status}</div>
      </div>`;
    }).join('');
  } else {
    priceHTML = `<div style="font-size:11px;color:#4b6280;text-align:center;padding:8px;">No price alerts set</div>`;
  }

  // === SECTION 2: Technical Alert Log (date-wise) ===
  const techLog = {};
  const alertTypes = {
    vol:'🔊 Volume Spike', rsiOS:'📉 RSI Oversold', rsiOB:'📈 RSI Overbought',
    macdBull:'🟢 MACD Bullish Cross', macdBear:'🔴 MACD Bearish Cross',
    bbUp:'⬆️ BB Upper Break', bbDn:'⬇️ BB Lower Break',
    insideBar:'📊 Inside Bar', narrowRange:'📏 Narrow Range'
  };

  // Collect all techAlert2_ keys from localStorage
  Object.keys(localStorage).forEach(k => {
    if(!k.startsWith('techAlert2_')) return;
    // Key format: techAlert2_SYM_YYYY-MM-DD
    const parts = k.replace('techAlert2_','').split('_');
    const date = parts[parts.length-1];
    const sym = parts.slice(0,-1).join('_');
    try{
      const fired = JSON.parse(localStorage.getItem(k)||'{}');
      const firedKeys = Object.keys(fired).filter(f=>fired[f]===true);
      if(firedKeys.length === 0) return;
      if(!techLog[date]) techLog[date] = [];
      firedKeys.forEach(f=>{
        techLog[date].push({sym, type: alertTypes[f]||f});
      });
    }catch(e){}
  });

  // Sort dates descending
  const sortedDates = Object.keys(techLog).sort((a,b)=>b.localeCompare(a));

  let techHTML = '';
  if(sortedDates.length === 0){
    techHTML = `<div style="font-size:11px;color:#4b6280;text-align:center;padding:8px;">No technical alerts fired yet</div>`;
  } else {
    techHTML = sortedDates.map(date => {
      const items = techLog[date];
      const rows = items.map(i=>
        `<div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #1e2d3d;">
          <span style="font-size:12px;font-weight:700;color:#38bdf8;">${i.sym}</span>
          <span style="font-size:11px;color:#cbd5e1;">${i.type}</span>
        </div>`
      ).join('');
      return `<div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;letter-spacing:0.5px;">📅 ${date}</div>
        <div style="background:#0a1628;border-radius:8px;overflow:hidden;border:1px solid #1e2d3d;">${rows}</div>
      </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <button onclick="tab('settings')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>Back</button>
      <span style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;">ALERTS</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;">🔔 PRICE ALERTS</div>
      <button onclick="tab('watchlist');setTimeout(()=>document.querySelector('.wl-card-wrap')?.click(),100);"
        style="font-size:10px;background:#1e3a5f;color:#38bdf8;border:1px solid #2d5a8e;border-radius:6px;padding:3px 10px;cursor:pointer;">+ New Alert</button>
    </div>
    ${priceHTML}
    <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;margin-top:12px;margin-bottom:8px;">⚡ TECHNICAL ALERT LOG</div>
    ${techHTML}
  `;
}
  if(t==="learn"){ initLearnTab(); }
  if(t==="settings"){loadSettingsUI();renderFeatureGuide();
    const lsd=document.getElementById('lastSyncDisplay');
    const lts=localStorage.getItem('lastCloudSync');
    if(lsd&&lts){ const dt=new Date(parseInt(lts)); lsd.innerText=dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+' '+dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}); }
  }
  if(t==="holidays")renderHolidays();
  if(t==="news")renderNews();
}


// ======================================
// GAS HISTORY FETCH (RSI/MACD/Inside Bar)
// ?type=history&s=SBIN.NS&range=30d&interval=1d
// Day-cached per stock
// ======================================
async function fetchHistory(sym, range='30d', interval='1d'){
  const DAY_KEY='histData_'+sym+'_'+range+'_'+interval;
  const today=new Date().toISOString().split('T')[0];
  try{
    const stored=JSON.parse(localStorage.getItem(DAY_KEY)||'null');
    if(stored&&stored.date===today&&stored.data) return stored.data;
  }catch(e){}
  // ✨ Google Sheets GOOGLEFINANCE history — only for 1mo/30d range, validate dates
  if(isSheetEnabled() && (range==='1mo'||range==='30d')){
    try{
      const sheetHist = await fetchHistSheet(sym);
      if(sheetHist && sheetHist.close && sheetHist.close.length >= 14){
        // Validate: last date must be within 5 days of today (not stale 2025 data)
        const lastDate=sheetHist.dates&&sheetHist.dates[sheetHist.dates.length-1];
        const lastMs=lastDate?new Date(lastDate).getTime():0;
        const nowMs=Date.now();
        const daysDiff=(nowMs-lastMs)/(1000*86400);
        if(daysDiff <= 7){ // within 1 week — data is fresh
          try{ localStorage.setItem(DAY_KEY, JSON.stringify({date:today, data:sheetHist})); }catch(e){}
          return sheetHist;
        }
        // else: stale sheet data — fall through to GAS Yahoo fetch
      }
    }catch(e){}
  }

  const urls=[
    localStorage.getItem('customAPI')||API,
    localStorage.getItem('customAPI2')||'',
    localStorage.getItem('customAPI3')||''
  ].filter(Boolean);

  for(let apiUrl of urls){
    try{
      const ctrl = new AbortController();
      const tid  = setTimeout(()=>ctrl.abort(), 10000); // 10s timeout
      const histSym=sym.startsWith('^')?sym:(sym.includes('.')?sym:sym+'.NS');
      const r=await fetch(`${apiUrl}?type=history&s=${histSym}&range=${range}&interval=${interval}`, {signal:ctrl.signal});
      clearTimeout(tid);
      const j=await r.json();
      if(j.error||!j.dates||!j.close) continue;
      // Validate data
      if(j.close.length<14) continue;
      const data={
        dates:j.dates, open:j.open||j.close, high:j.high||j.close,
        low:j.low||j.close, close:j.close, volume:j.volume||[]
      };
      try{ localStorage.setItem(DAY_KEY,JSON.stringify({date:today,data})); }catch(e){}
      return data;
    }catch(e){ continue; }
  }
  return null;
}

// ======================================
// TECHNICAL INDICATORS
// ======================================

// RSI (14-period)
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

// EMA
function calcEMA(data, period){
  if(!data||data.length<period) return null;
  const k=2/(period+1);
  let ema=data.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<data.length;i++){
    ema=data[i]*k+ema*(1-k);
  }
  return parseFloat(ema.toFixed(2));
}

// MACD (12,26,9)
function calcMACD(closes){
  if(!closes||closes.length<26) return null;
  const ema12=calcEMA(closes,12);
  const ema26=calcEMA(closes,26);
  if(!ema12||!ema26) return null;
  const macdLine=parseFloat((ema12-ema26).toFixed(2));
  // Signal line needs 9-period EMA of MACD - simplified: use last 9 MACD values
  // For single value output, return current MACD and trend
  const ema12prev=calcEMA(closes.slice(0,-1),12);
  const ema26prev=calcEMA(closes.slice(0,-1),26);
  const prevMacd=ema12prev&&ema26prev?ema12prev-ema26prev:null;
  return {
    macd: macdLine,
    trend: prevMacd!==null?(macdLine>prevMacd?'bullish':'bearish'):'neutral',
    bullishCross: prevMacd!==null&&prevMacd<0&&macdLine>0,
    bearishCross: prevMacd!==null&&prevMacd>0&&macdLine<0
  };
}

// Inside Bar / Narrow Range
// ======================================
// CANDLESTICK PATTERN DETECTOR
// ======================================
function detectCandlePatterns(opens, highs, lows, closes) {
  if (!opens || opens.length < 3) return [];
  const patterns = [];
  const n = closes.length;
  const o = opens, h = highs, l = lows, c = closes;

  const bodySize  = (i) => Math.abs(c[i] - o[i]);
  const range     = (i) => h[i] - l[i];
  const isGreen   = (i) => c[i] > o[i];
  const isRed     = (i) => c[i] < o[i];
  const midpoint  = (i) => (o[i] + c[i]) / 2;

  const i = n - 1;
  const p = n - 2;
  const p2= n - 3;

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

function detectInsideBar(highs, lows){
  if(!highs||highs.length<2) return false;
  const n=highs.length;
  return highs[n-1]<highs[n-2] && lows[n-1]>lows[n-2];
}

function detectNarrowRange(highs, lows, threshold=1.5){
  if(!highs||highs.length<1) return false;
  const n=highs.length;
  const range=((highs[n-1]-lows[n-1])/lows[n-1]*100);
  return range<threshold;
}

// Bollinger Bands full series (returns array of {upper,ma,lower,width,pctB,signal} per candle)
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

// Bollinger Bands (20, 2) — single point (last candle)
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

// Render Bollinger Band section in Stock Detail Modal
let _bbSym='', _bbPeriod='6M', _bbRange='daily';

// BB_CONFIG — Period x Range matrix (like Chartink)
// _bbPeriod = chart period (1M/3M/6M/1Y/2Y)
// _bbRange  = candle interval (daily/weekly/monthly)
const BB_MATRIX={
  'daily':   {'1M':{range:'1mo',interval:'1d',bbPeriod:20}, '3M':{range:'3mo',interval:'1d',bbPeriod:20}, '6M':{range:'6mo',interval:'1d',bbPeriod:20}, '1Y':{range:'1y',interval:'1d',bbPeriod:20}, '2Y':{range:'2y',interval:'1d',bbPeriod:20}},
  'weekly':  {'1M':{range:'1mo',interval:'1wk',bbPeriod:20},'3M':{range:'3mo',interval:'1wk',bbPeriod:20},'6M':{range:'6mo',interval:'1wk',bbPeriod:20},'1Y':{range:'1y',interval:'1wk',bbPeriod:20},'2Y':{range:'2y',interval:'1wk',bbPeriod:20}},
  'monthly': {'1M':{range:'1mo',interval:'1mo',bbPeriod:5}, '3M':{range:'3mo',interval:'1mo',bbPeriod:5}, '6M':{range:'6mo',interval:'1mo',bbPeriod:5}, '1Y':{range:'1y',interval:'1mo',bbPeriod:12},'2Y':{range:'2y',interval:'1mo',bbPeriod:12}}
};
function getBBConfig(){ return (BB_MATRIX[_bbRange]||BB_MATRIX['daily'])[_bbPeriod] || BB_MATRIX['daily']['6M']; }

async function renderBollinger(sym){
  // Reset only when new stock opened
  if(sym !== _bbSym){ _bbPeriod='6M'; _bbRange='daily'; }
  _bbSym=sym;
  const bs=document.getElementById('bbSection');
  if(!bs) return;
  // Keep existing buttons if already rendered, just show loader below
  const _existingButtons = bs.querySelector('[data-bb-controls]');
  if(!_existingButtons){
    bs.innerHTML=`<div style="font-size:10px;color:#4b6280;text-align:center;padding:6px;">Loading Bollinger Bands...</div>`;
  } else {
    // Remove only chart area, keep controls
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
  const minNeeded=_bbPeriod==='1M'?15:cfg.bbPeriod+1;

  if(!hist||!hist.close||hist.close.length<minNeeded){
    const got=hist?.close?.length||0;
    bs.innerHTML=`<div style="font-size:10px;text-align:center;padding:10px;">
      <div style="color:#f59e0b;font-weight:700;margin-bottom:4px;">&#9888; BB Data Unavailable</div>
      <div style="color:#4b6280;font-size:9px;line-height:1.5;">${got===0?'History API failed. Check GAS API or network.':'Only '+got+' candles — need '+minNeeded+' for '+_bbPeriod+' '+_bbRange+'. Try Daily or shorter period.'}</div>
      <button onclick="renderBollinger('${sym}')" style="margin-top:8px;background:#1e3a5f;color:#38bdf8;border:1px solid #2d5a8e;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">&#8635; Retry</button>
    </div>`;
    return;
  }

  const closes=hist.close.filter(v=>v!=null);
  const opens=hist.open?hist.open.filter(v=>v!=null):closes;
  const highs=hist.high?hist.high.filter(v=>v!=null):closes;
  const lows=hist.low?hist.low.filter(v=>v!=null):closes;
  const activeBP=cfg.bbPeriod;
  // Full BB series for mini chart
  const bbFull=calcBollingerSeries(closes, activeBP, 2);
  const bb=bbFull ? bbFull[bbFull.length-1] : calcBollinger(closes, activeBP, 2);
  if(!bb){ bs.innerHTML=''; return; }

  const signalColor=bb.signal==='Oversold'?'#22c55e':bb.signal==='Overbought'?'#ef4444':bb.signal==='Squeeze'?'#f59e0b':'#94a3b8';
  const pctBColor=bb.pctB<10?'#22c55e':bb.pctB>90?'#ef4444':'#38bdf8';
  const barPct=Math.min(100,Math.max(0,bb.pctB));

  // Squeeze direction detection
  const bwArr=bbFull?bbFull.map(b=>b.width):[];
  const bwNow=bwArr.slice(-5).reduce((a,b)=>a+b,0)/5||bb.width;
  const bwPrev=bwArr.slice(-10,-5).reduce((a,b)=>a+b,0)/5||bb.width;
  const squeezeDir=bwNow<bwPrev?'Contracting':'Expanding';
  const squeezeColor=bwNow<bwPrev?'#f59e0b':'#a78bfa';
  const rangeLabel=_bbRange==='daily'?'Daily':_bbRange==='weekly'?'Weekly':'Monthly';

  bs.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">BOLLINGER BANDS (${activeBP},2) <span style="font-size:9px;color:${squeezeColor};font-weight:600;">● ${squeezeDir}</span></div>
    <div data-bb-controls="1" style="display:flex;gap:4px;margin-bottom:4px;">
      ${['1M','3M','6M','1Y','2Y'].map(p=>`
        <button onclick="setBBPeriod('${p}')"
          style="flex:1;padding:3px 0;border-radius:5px;border:1px solid ${p===_bbPeriod?'#38bdf8':'#1e3a5f'};
          background:${p===_bbPeriod?'rgba(56,189,248,0.15)':'#0a1628'};
          color:${p===_bbPeriod?'#38bdf8':'#4b6280'};font-size:10px;font-weight:700;cursor:pointer;
          font-family:'Rajdhani',sans-serif;">${p}</button>
      `).join('')}
    </div>
    <div style="display:flex;gap:4px;margin-bottom:6px;">
      ${['daily','weekly','monthly'].map(r=>`
        <button onclick="setBBRange('${r}')"
          style="flex:1;padding:3px 0;border-radius:5px;border:1px solid ${r===_bbRange?'#a78bfa':'#1e3a5f'};
          background:${r===_bbRange?'rgba(167,139,250,0.15)':'#0a1628'};
          color:${r===_bbRange?'#a78bfa':'#4b6280'};font-size:9px;font-weight:700;cursor:pointer;
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
        <span style="font-size:8px;color:#94a3b8;">${_bbPeriod} ${rangeLabel} | MA${activeBP}</span>
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
    const N=Math.min(bbFull.length, _bbPeriod==='2Y'?120:_bbPeriod==='1Y'?(_bbRange==='weekly'?52:(_bbRange==='monthly'?12:100)):_bbPeriod==='6M'?(_bbRange==='weekly'?26:(_bbRange==='monthly'?6:60)):_bbPeriod==='3M'?(_bbRange==='weekly'?13:40):22);
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
      // Wick
      ctx.beginPath();
      ctx.moveTo(x, yScale(h));
      ctx.lineTo(x, yScale(l));
      ctx.strokeStyle=color; ctx.lineWidth=1; ctx.stroke();
      // Body
      const bodyTop=yScale(Math.max(o,c));
      const bodyBot=yScale(Math.min(o,c));
      const bodyH=Math.max(1, bodyBot-bodyTop);
      ctx.fillStyle=isBull?'rgba(34,197,94,0.85)':'rgba(239,68,68,0.85)';
      ctx.fillRect(x-candleW/2, bodyTop, candleW, bodyH);
    });
  });
}

function setBBPeriod(p){
  _bbPeriod=p;
  renderBollinger(_bbSym);
}
function setBBRange(r){
  _bbRange=r;
  renderBollinger(_bbSym);
}

// Volume Breakout (uses existing cache  -  0 API)
function checkVolumeBreakout(sym){
  const d=cache[sym]?.data;
  if(!d) return null;
  const vol=d.regularMarketVolume;
  const avgVol=d.averageDailyVolume3Month||d.averageDailyVolume10Day;
  if(!vol||!avgVol) return null;
  const ratio=vol/avgVol;
  if(ratio>=1.5) return {sym, vol, avgVol, ratio:parseFloat(ratio.toFixed(2))};
  return null;
}

// ======================================
// TECHNICAL ALERTS CHECK
// ======================================
// Central push notification dispatcher
function firePushAlert(title, body, tag){
  if(localStorage.getItem('alertEngineOn')==='false') return;
  showPopup(body, 7000);
  const notifUserOn = localStorage.getItem('notifOn') !== 'false';
  if(notifUserOn && typeof Notification!=='undefined' && Notification.permission==='granted'){
    try{
      new Notification(title,{
        body: body,
        icon: '/realtradepro/icons/icon-192.png',
        tag: tag||title,   // prevents duplicate stacking
        requireInteraction: false
      });
    }catch(e){}
  }
}

async function checkTechnicalAlerts(sym){
  const today=new Date().toISOString().split('T')[0];
  const ALERT_KEY='techAlert2_'+sym+'_'+today;
  const alerted=JSON.parse(localStorage.getItem(ALERT_KEY)||'{}');

  // 1. Volume Breakout (0 API — cache only)
  const vb=checkVolumeBreakout(sym);
  if(vb && !alerted.vol){
    alerted.vol=true;
    firePushAlert(
      sym+' — Volume Spike',
      sym+': Volume '+vb.ratio+'x avg ('+Math.round(vb.vol/1e5)/10+'L vs avg '+Math.round(vb.avgVol/1e5)/10+'L)',
      'vol_'+sym
    );
  }

  // 2. RSI + MACD + BB (requires history)
  const hist=await fetchHistory(sym);
  if(!hist||!hist.close){ localStorage.setItem(ALERT_KEY,JSON.stringify(alerted)); return; }

  const closes=hist.close.filter(v=>v!=null);
  const highs=hist.high?hist.high.filter(v=>v!=null):closes;
  const lows=hist.low?hist.low.filter(v=>v!=null):closes;

  const rsi=calcRSI(closes);
  const macd=calcMACD(closes);
  const insideBar=detectInsideBar(highs,lows);
  const narrowRange=detectNarrowRange(highs,lows);

  // BB for alert check
  const bb=calcBollinger(closes,20,2);
  const price=cache[sym]?.data?.regularMarketPrice||0;

  if(rsi!==null){
    if(rsi<30 && !alerted.rsiOS){
      alerted.rsiOS=true;
      firePushAlert(sym+' — RSI Oversold', sym+': RSI '+rsi.toFixed(1)+' (below 30) — Potential buy zone', 'rsiOS_'+sym);
    } else if(rsi>70 && !alerted.rsiOB){
      alerted.rsiOB=true;
      firePushAlert(sym+' — RSI Overbought', sym+': RSI '+rsi.toFixed(1)+' (above 70) — Caution zone', 'rsiOB_'+sym);
    }
  }

  if(macd){
    if(macd.bullishCross && !alerted.macdBull){
      alerted.macdBull=true;
      firePushAlert(sym+' — MACD Bullish Cross', sym+': MACD crossed above Signal — Bullish momentum', 'macdB_'+sym);
    } else if(macd.bearishCross && !alerted.macdBear){
      alerted.macdBear=true;
      firePushAlert(sym+' — MACD Bearish Cross', sym+': MACD crossed below Signal — Bearish signal', 'macdS_'+sym);
    }
  }

  if(bb && price>0){
    if(price>bb.upper && !alerted.bbUp){
      alerted.bbUp=true;
      firePushAlert(sym+' — BB Upper Break', sym+': Price \u20b9'+price.toFixed(2)+' broke above BB Upper \u20b9'+bb.upper+' — Overbought watch', 'bbUp_'+sym);
    } else if(price<bb.lower && !alerted.bbDn){
      alerted.bbDn=true;
      firePushAlert(sym+' — BB Lower Break', sym+': Price \u20b9'+price.toFixed(2)+' broke below BB Lower \u20b9'+bb.lower+' — Oversold watch', 'bbDn_'+sym);
    }
  }

  if(insideBar && !alerted.insideBar){
    alerted.insideBar=true;
    firePushAlert(sym+' — Inside Bar', sym+': Inside Bar pattern — Breakout watch', 'ib_'+sym);
  } else if(narrowRange && !alerted.narrowRange){
    alerted.narrowRange=true;
    firePushAlert(sym+' — Narrow Range', sym+': Narrow Range — Volatility expansion likely', 'nr_'+sym);
  }

  localStorage.setItem(ALERT_KEY,JSON.stringify(alerted));
}
// Run technical alerts for all watchlist stocks (after price fetch)
async function runAllTechnicalAlerts(){
  for(let s of wl){
    await checkTechnicalAlerts(s);
  }
}

// ======================================
// APP START (after PIN)
// ======================================

// ======================================
// FLASH PRICE TICKER (header scroll bar)
// ======================================
// ======================================
// GLOBAL MARKETS TICKER
// ======================================
const GLOBAL_SYMS = {
  'DOW':'^DJI', 'NASDAQ':'^IXIC', 'S&P500':'^GSPC',
  'CRUDE':'CL=F', 'GOLD':'GC=F', 'USD/INR':'INR=X', 'VIX':'^INDIAVIX'
};
let _globalCache = {}, _globalCacheTime = 0;
const GLOBAL_TTL = 15 * 60 * 1000;

async function fetchGlobalMarkets() {
  const now = Date.now();
  if (_globalCacheTime && (now - _globalCacheTime) < GLOBAL_TTL && Object.keys(_globalCache).length > 0) {
    return _globalCache;
  }
  try {
    const apiUrl = localStorage.getItem('customAPI') || API;
    const syms = Object.values(GLOBAL_SYMS).join(',');
    const r = await fetch(`${apiUrl}?type=batch&s=${encodeURIComponent(syms)}`);
    const data = await r.json();
    _globalCache = data;
    _globalCacheTime = now;
    return data;
  } catch(e) { return {}; }
}

async function updateGlobalTicker() {
  const track = document.getElementById('globalTickerTrack');
  if (!track) return;
  const data = await fetchGlobalMarkets();
  const items = [];
  Object.entries(GLOBAL_SYMS).forEach(([label, sym]) => {
    const d = data[sym] || _globalCache[sym];
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

function updatePriceTicker() {
  const bar = document.getElementById('priceTicker');
  const track = document.getElementById('tickerTrack');
  if(!bar || !track) return;

  // Collect all cached prices: indices + watchlist
  const items = [];

  // Indices first
  const idxMap = {'^NSEI':'NIFTY 50','^BSESN':'SENSEX','^NSEBANK':'BANKNIFTY'};
  Object.entries(idxMap).forEach(([sym,label]) => {
    const d = cache[sym]?.data;
    if(!d) return;
    const price = d.regularMarketPrice;
    const prev = d.chartPreviousClose || d.regularMarketPreviousClose;
    const chg = prev ? price - prev : 0;
    const pct = prev ? (chg/prev*100) : 0;
    items.push({sym:label, price, chg, pct});
  });

  // Watchlist stocks
  wl.forEach(sym => {
    const d = cache[sym]?.data;
    if(!d) return;
    const price = d.regularMarketPrice;
    const prev = d.chartPreviousClose || d.regularMarketPreviousClose;
    const chg = prev ? price - prev : 0;
    const pct = prev ? (chg/prev*100) : 0;
    items.push({sym, price, chg, pct});
  });

  if(items.length === 0) { bar.style.display='none'; return; }

  bar.style.display = 'flex';

  // Build ticker items (duplicated for seamless loop)
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
  // Duplicate for seamless infinite scroll
  track.innerHTML = html + html;

  // Adjust animation speed based on item count (more items = longer duration)
  const duration = Math.max(25, items.length * 4);
  track.style.animation = `tickerScroll ${duration}s linear infinite`;
}


// ======================================
// ======================================
// FEATURE DATA (single source of truth)
// To add/remove features: edit FEATURE_DATA only
// Accordion + PDF both auto-update
// ======================================
const FEATURE_DATA = [
  {cat:"HEADER", color:"#38bdf8", items:[
    {name:"NIFTY / SENSEX / BANKNIFTY", desc:"Live index prices + % change. Tap = detail modal. Indian format (24.5k). Auto-refresh."},
    {name:"Theme Button", desc:"Dark/Light mode toggle. Instantly applies across full app."},
    {name:"Refresh Button", desc:"Manual cache clear + fresh price fetch for all stocks."},
    {name:"Alert Button", desc:"Opens Alerts tab directly from header."},
    {name:"Holiday Button", desc:"NSE market holidays 2025 + 2026 list."},
    {name:"Flash Price Ticker", desc:"Scrolling bar: BANKNIFTY 53,427 - +155 (+0.12%) for all watchlist + indices. Hover = pause."}
  ]},
  {cat:"WATCHLIST", color:"#60a5fa", items:[
    {name:"Search Box", desc:"334 preloaded NSE stocks with suggestions. Enter = add to watchlist."},
    {name:"Sort: A-Z / Price / %", desc:"Toggle sort by name, price high-low, or % change."},
    {name:"Groups", desc:"Create custom groups (PSU, IT, Green). Filter tabs auto-appear."},
    {name:"ACT Button", desc:"Opens action panel: BUY / SELL / CHART / NEWS / ALERT / TARGET."},
    {name:"Day Bar", desc:"Visual Day High-Low range bar with CMP position marker."},
    {name:"52W Bar", desc:"52-week High-Low bar. Label: ** Near 52W High / !! Near 52W Low."},
    {name:"Sparkline (7D)", desc:"Mini SVG line chart showing 7-day price trend. Green = up, Red = down. Loaded after watchlist render."},
    {name:"CMP Flash", desc:"Live price with green/red flash animation on change."},
    {name:"Remove (X)", desc:"Remove stock from watchlist with confirmation."}
  ]},
  {cat:"HOLDINGS", color:"#4ade80", items:[
    {name:"Portfolio Summary", desc:"Investment, Current Value, Unrealized P&L, Return%, Realized P&L, Total P&L."},
    {name:"Pie Chart", desc:"Donut chart for portfolio diversity - % allocation per stock."},
    {name:"Card Layout", desc:"Row 1: Symbol + badge + CMP + P&L. Row 2: Qty + Avg + Holding days. Row 3: Avg bar + buttons."},
    {name:"AVG Down Calc", desc:"Two modes: Add Qty (new avg preview) + Target Avg (exact qty needed)."},
    {name:"Edit Holding", desc:"Change avg price, qty, buy date anytime."},
    {name:"Holding Days", desc:"Auto-calculated: 45d / 2mo 3d format."}
  ]},
  {cat:"HISTORY", color:"#a78bfa", items:[
    {name:"Trade List", desc:"BUY + SELL trades with symbol, type badge, prices, qty, date, P&L."},
    {name:"CNC / MIS Badge", desc:"Trade type shown on every history card."},
    {name:"Tax Calculator", desc:"Brokerage 0.15%, STT, Exchange charges, GST, break-even price."},
    {name:"P&L Calendar", desc:"Monthly calendar view. Green/red days. Tap date = filter trades."},
    {name:"Export CSV", desc:"Full trade history as CSV download."},
    {name:"Backup JSON", desc:"Complete app data (watchlist, holdings, history, alerts) as JSON."},
    {name:"Restore JSON", desc:"Restore from backup - works across devices via GitHub Pages."}
  ]},
  {cat:"LIVE PRICES", color:"#fb7185", items:[
    {name:"GAS Proxy", desc:"Google Apps Script proxies Yahoo Finance API - bypasses CORS."},
    {name:"NSE to BSE Fallback", desc:"If NSE (.NS) fails, auto-retry with BSE (.BO) symbol."},
    {name:"3 URL Fallback", desc:"Primary > Secondary > Tertiary GAS URLs - zero downtime."},
    {name:"Batch Fetch", desc:"All watchlist stocks in one GAS call (parallel processing)."},
    {name:"Cache System", desc:"8s default. Prevents unnecessary API calls. Configurable in Settings."},
    {name:"Auto Refresh", desc:"30s default interval. Configurable (min 10s)."},
    {name:"Pull to Refresh", desc:"Mobile: swipe down to force refresh."}
  ]},
  {cat:"TECHNICAL ALERTS", color:"#f59e0b", items:[
    {name:"RSI (14)", desc:"Oversold alert below 30. Overbought alert above 70. 30d OHLCV data."},
    {name:"MACD (12,26,9)", desc:"Bullish cross (signal line crossover) and Bearish cross detection."},
    {name:"Inside Bar", desc:"Current candle inside previous candle range - consolidation signal."},
    {name:"Narrow Range", desc:"Smallest range in last 7 bars - breakout watch signal."},
    {name:"Volume Breakout", desc:"Volume 1.5x above 20-day avg (cache-based, 0 extra API calls)."},
    {name:"Day H/L Alert", desc:"Price within 0.5% of day High or Low - auto chime + popup."},
    {name:"Auto Run", desc:"Runs for all watchlist stocks on app open + every manual refresh."}
  ]},
  {cat:"STOCK DETAIL", color:"#34d399", items:[
    {name:"Price Data", desc:"Open, Prev Close, Day High, Day Low, 52W High, 52W Low."},
    {name:"Fundamentals", desc:"P/E TTM, Forward P/E, EPS TTM, Forward EPS, Mkt Cap, Book Value, Volume, Div Yield."},
    {name:"Technicals (30d)", desc:"RSI(14), MACD(12,26,9), Inside Bar, Narrow Range - live calculated."},
    {name:"Bollinger Bands", desc:"BB(20/50/100,2) with period selector 1M/3M/6M/1Y. Upper, Lower, MA, %B, Band Width, Signal, Position bar."},
    {name:"Circuit Limits", desc:"Auto-detects NSE band (2/5/10/20%). Upper + Lower circuit levels from Prev Close."},
    {name:"Bulk/Block Deals", desc:"NSE RSS feed for bulk and block deals for the selected stock."},
    {name:"Smart Alert Suggestions", desc:"Auto-suggests Breakout, Support, Round, StopLoss, Target levels. One-tap set alert."},
    {name:"Earnings + Dividends", desc:"Next earnings date + Ex-dividend date (day-cached from Yahoo)."},
    {name:"Quick Links", desc:"NSE, BSE Filings, Screener, Chartink, Tijori, MC, Tickertape, Trendlyne, TradingView."}
  ]},
  {cat:"Ask Nivi", color:"#38bdf8", items:[
    {name:"Ask Nivi Brief", desc:"AI-powered daily market summary. Watchlist stocks pass karo, Gemini analyze kare. 30-min cache."},
    {name:"Stock Filter", desc:"Fetches top 5 watchlist stocks. 5 min cache to save GAS quota."},
    {name:"Tabs", desc:"All / Corporate / Market filter tabs."},
    {name:"Stock Chips", desc:"Filter by individual stock (watchlist-based chips)."},
    {name:"Sentiment Engine", desc:"Keyword-based: Positive / Negative / Neutral badge per news."},
    {name:"Smart Summary", desc:"Auto-generated one-line summary based on news keywords."},
    {name:"Read Link", desc:"Opens original article in new tab."}
  ]},
  {cat:"ALERTS + TARGETS", color:"#fbbf24", items:[
    {name:"Price Alerts", desc:"Set above/below trigger per stock. Chime sound when hit."},
    {name:"Triggered Log", desc:"List of already-triggered alerts with time."},
    {name:"Target Price", desc:"Set target per stock. Auto-removes from list when price reached."},
    {name:"Day H/L Alert", desc:"Auto alert when price within 0.5% of day high or low (session)."}
  ]},
  {cat:"GAINERS / LOSERS", color:"#c4b5fd", items:[
    {name:"Top Gainers", desc:"Top 10 gainers from 334 preloaded stocks. Symbol + Price + %."},
    {name:"Top Losers", desc:"Top 10 losers same list."},
    {name:"Screener", desc:"Filter tab: +3% Today, -3% Today, Near 52W High, Near 52W Low, Vol Breakout. Source: Watchlist / Popular / All Cached."},
    {name:"Background Preload", desc:"Silently fetches 80 stocks 1.5s after app open."},
    {name:"Manual Refresh", desc:"Force fresh batch fetch from Gainers tab."}
  ]},
  {cat:"CLOUD SYNC", color:"#f472b6", items:[
    {name:"Auto Sync", desc:"Every watchlist/holdings change auto-saves to Google Sheet (2s debounce)."},
    {name:"Upload to Cloud", desc:"Manual push — saves watchlist, holdings, history, groups in parallel."},
    {name:"Download from Cloud", desc:"Manual pull — cloud always wins. Restores all 4 data keys."},
    {name:"Sync on Start", desc:"pullFromCloud() runs on app open — latest data always loaded."},
    {name:"Sync Status", desc:"Shows: Syncing... / Synced / Sync Error with last sync time."},
    {name:"2-Device Sync", desc:"Same GitHub Pages URL = same localStorage. Cloud Sheet bridges laptop + mobile."}
  ]},
  {cat:"JOURNAL", color:"#94a3b8", items:[
    {name:"Entry Types", desc:"NOTE / BUY / SELL / WATCH - four trade diary entry types."},
    {name:"Stock Tag", desc:"Optional stock symbol linked to each journal entry."},
    {name:"Timestamp", desc:"Auto date+time on every entry."},
    {name:"History View", desc:"Chronological list of all past entries."}
  ]},
  {cat:"SETTINGS", color:"#60a5fa", items:[
    {name:"3 API URLs", desc:"Primary + Secondary + Tertiary GAS endpoints for fallback."},
    {name:"Auto Refresh", desc:"Configure interval in seconds (default 30s, min 10s)."},
    {name:"Cache Time", desc:"Configure in ms (default 8000ms = 8s)."},
    {name:"Duplicate Warning", desc:"Toggle warning when same stock added twice."},
    {name:"Danger Zone", desc:"Clear Holdings / History / Alerts individually with confirmation."},
    {name:"Import CSV", desc:"Bulk import holdings from CSV file."},
    {name:"Backup + Restore", desc:"JSON export/import for cross-device data sync."},
    {name:"Earnings Calendar", desc:"Header Calendar icon. Shows next earnings dates for all watchlist stocks. Week/Month view."}
  ]},
  {cat:"TECHNICAL DETAILS", color:"#4b6280", items:[
    {name:"No Frameworks", desc:"Pure HTML + Tailwind CSS + Vanilla JS. Zero dependencies."},
    {name:"Single File", desc:"Entire app in one RealTraderPro_Stable.html file."},
    {name:"localStorage", desc:"All data stored locally. No server, no account, no cost."},
    {name:"SVG Icons", desc:"All icons are inline SVG - no emoji, no fonts needed. Android Chrome safe."},
    {name:"Indian Number Format", desc:"Rs 1,23,456.78 format via inr() function."},
    {name:"charset=UTF-8", desc:"Meta tag ensures correct rendering on all devices."},
    {name:"Market Status", desc:"Open / Pre-open / Closed / Weekend via IST time - zero API."},
    {name:"Day-cached Data", desc:"Fundamentals + History cached daily in localStorage."}
  ]}
];

// ======================================
// FEATURE GUIDE ACCORDION + PDF
// ======================================
function renderFeatureGuide(){
  const el = document.getElementById("featureGuideList");
  if(!el) return;
  const totalFeatures = FEATURE_DATA.reduce((s,f)=>s+f.items.length,0);
  // PDF button outside collapsible body
  const pdfWrap = document.getElementById("feat-pdf-btn-wrap");
  if(pdfWrap) pdfWrap.innerHTML = '<button onclick="downloadFeaturePDF()" style="background:#1e3a5f;color:#38bdf8;border:1px solid #2d5a8e;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;">PDF</button>';
  let accordionHtml = "<div style=\"font-size:10px;color:#4b6280;margin-bottom:8px;\">" + FEATURE_DATA.length + " categories · " + totalFeatures + " features</div>";
  FEATURE_DATA.forEach((f,i) => {
    const id = "fg"+i;
    accordionHtml +=
      "<div style=\"border-bottom:1px solid #1e2d3d;margin-bottom:2px;\">" +
      "<div onclick=\"var c=document.getElementById('" + id + "');var isOpen=c.style.display!=='none';c.style.display=isOpen?'none':'block';this.querySelector('.fga').style.transform=isOpen?'rotate(0deg)':'rotate(90deg)'\"" +
      " style=\"display:flex;justify-content:space-between;align-items:center;padding:7px 0;cursor:pointer;\">" +
      "<span style=\"font-size:11px;font-weight:700;color:" + f.color + ";\">" + f.cat + "</span>" +
      "<svg class=\"fga\" viewBox=\"0 0 10 10\" width=\"8\" height=\"8\" fill=\"#4b6280\" style=\"transition:transform 0.2s;flex-shrink:0;\"><polygon points=\"3,2 7,5 3,8\"/></svg>" +
      "</div>" +
      "<div id=\"" + id + "\" style=\"display:none;padding:0 0 8px 8px;\">" +
      f.items.map(it =>
        "<div style=\"display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03)\">" +
        "<span style=\"font-size:10px;font-weight:700;color:" + f.color + ";min-width:100px;flex-shrink:0;\">" + it.name + "</span>" +
        "<span style=\"font-size:10px;color:#94a3b8;line-height:1.4;\">" + it.desc + "</span>" +
        "</div>"
      ).join("") +
      "</div></div>";
  });
  el.innerHTML = accordionHtml;
}

function downloadFeaturePDF(){
  const totalFeatures = FEATURE_DATA.reduce((s,f)=>s+f.items.length,0);
  const today = new Date();
  const dateStr = today.getDate()+"/"+(today.getMonth()+1)+"/"+today.getFullYear();

  let tableRows = "";
  FEATURE_DATA.forEach(f => {
    // Category header row
    tableRows += "<tr><td colspan=\"3\" style=\"background:#1e3a5f;color:#60a5fa;font-weight:700;font-size:12px;padding:6px 8px;letter-spacing:0.5px;\">" + f.cat + "</td></tr>";
    // Feature rows
    f.items.forEach((it,i) => {
      const bg = i%2===0 ? "#0f1e33" : "#111827";
      tableRows += "<tr style=\"background:" + bg + ";\">" +
        "<td style=\"width:8px;background:" + f.color + ";\"></td>" +
        "<td style=\"padding:5px 8px;color:#e2e8f0;font-weight:700;font-size:11px;white-space:nowrap;\">" + it.name + "</td>" +
        "<td style=\"padding:5px 8px;color:#94a3b8;font-size:11px;line-height:1.4;\">" + it.desc + "</td>" +
        "</tr>";
    });
  });

  const html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">" +
    "<title>Real Trader Pro - Feature Guide</title>" +
    "<style>" +
    "body{background:#0a0f1a;color:#e2e8f0;font-family:Arial,sans-serif;margin:0;padding:20px;}" +
    "table{width:100%;border-collapse:collapse;margin-top:12px;}" +
    "td{vertical-align:top;border-bottom:1px solid #1e2d3d;}" +
    ".header{background:linear-gradient(90deg,#0f1e33,#1e3a5f);padding:16px 20px;border-radius:10px;margin-bottom:16px;}" +
    ".header h1{margin:0;font-size:20px;color:#38bdf8;letter-spacing:1px;}" +
    ".header p{margin:4px 0 0;font-size:11px;color:#4b6280;}" +
    ".stats{display:flex;gap:16px;margin-top:8px;}" +
    ".stat{background:#0a1628;padding:6px 12px;border-radius:6px;font-size:11px;color:#60a5fa;font-weight:700;}" +
    "@media print{body{background:#fff;color:#000;} td{color:#000 !important;border-bottom:1px solid #ccc;} .header{background:#f0f4f8;} .header h1{color:#1e3a8a;} .header p{color:#475569;} .stat{background:#e2e8f0;color:#1e3a8a;} tr[style*=\"background:#0f1e33\"]{background:#f8fafc !important;} tr[style*=\"background:#111827\"]{background:#ffffff !important;} td[style*=\"color:#e2e8f0\"]{color:#1a202c !important;} td[style*=\"color:#94a3b8\"]{color:#475569 !important;} tr td:first-child{display:none;} td[style*=\"background:#1e3a5f\"]{background:#dbeafe !important;color:#1e3a8a !important;}}" +
    "</style></head><body>" +
    "<div class=\"header\">" +
    "<h1>REAL TRADER PRO - Feature Reference Guide</h1>" +
    "<p>Version 2.1  |  " + dateStr + "  |  Sahaj Personal Trading App</p>" +
    "<div class=\"stats\">" +
    "<span class=\"stat\">" + totalFeatures + "+ Features</span>" +
    "<span class=\"stat\">0 Frameworks</span>" +
    "<span class=\"stat\">1 HTML File</span>" +
    "<span class=\"stat\">0 Monthly Cost</span>" +
    "</div></div>" +
    "<table>" + tableRows + "</table>" +
    "<div style=\"text-align:center;font-size:10px;color:#4b6280;margin-top:16px;padding:10px;border-top:1px solid #1e2d3d;\">" +
    "Real Trader Pro  |  Pure HTML + Tailwind CSS + Vanilla JS  |  GAS + Yahoo Finance" +
    "</div></body></html>";

  const w = window.open("","_blank","width=900,height=700");
  if(!w){ showPopup("Popup blocked! Allow popups for this site."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 500);
}

async function startApp(){
  updateMarketStatus();
  startClock();
  setInterval(updateMarketStatus,60000);
  renderWLTabs();
  initGeminiKeyDisplay();
  showLoader("Loading...");
  // Preload ALL fundamentals from Firebase (non-blocking) — any stock opens instantly
  preloadAllFundamentalsFromFirebase();
  // Data already loaded from Firebase via loadUserData() before startApp()
  // Watchlist: batch fetch | Indices: individual (^ symbols)
// Show UI immediately — don't wait for all data
  hideLoader();
  renderWL();
  // Fetch in background — UI updates as data arrives
  batchFetchStocks(wl).then(()=>{
    renderWL();
    renderHeaderStrip();
    updateHeaderIndices();
    updatePriceTicker();
  });
  Promise.all(indicesList.map(i=>fetchFull(i.sym,true))).then(()=>{
    updateHeaderIndices();
  });
  renderHeaderStrip();
  updateHeaderIndices();
  updatePriceTicker();
  updateGlobalTicker();
  // Run technical alerts (volume breakout = immediate, RSI/MACD = after history fetch)
  setTimeout(()=>runAllTechnicalAlerts(),3000);
  // Auto alert engine — every 5 min during market hours
  setInterval(()=>{
    const m=getMarketStatus();
    if(m.open) runAllTechnicalAlerts();
  }, 5*60*1000);
// Firebase fundamentals already preloaded at startup via preloadAllFundamentalsFromFirebase()
  // No GAS fundBatch call needed — all stocks instantly available via window._firebaseFundCache
  // Background: preload POPULAR_STOCKS for Gainers tab — only missing stocks (no duplicate calls)
  setTimeout(()=>{
    const needFetch = POPULAR_STOCKS.slice(0,80).filter(s=>!cache[s]||!cache[s].data);
    if(needFetch.length > 0) {
      batchFetchStocks(needFetch).then(()=>{
        if(document.getElementById('indices')?.classList.contains('active')) renderGainersFromCache();
      });
    }
  },1500);
}

// ======================================
// AUTO REFRESH & MANUAL
// ======================================
  
function startRefresh(){
  if(refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(()=>{
    const m = getMarketStatus();
    if(m.open) updatePrices();
  }, 5000);
}

document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    if(refreshInterval) clearInterval(refreshInterval);
  } else {
    // Android WebView: short delay to let network reconnect after resume
    setTimeout(() => {
      updatePrices();
      startRefresh();
    }, 800);
  }
});

startRefresh();
    
async function manualRefresh(){
  let btn=document.getElementById("refreshBtn");
  if(btn) { btn.style.opacity="0.4"; btn.style.pointerEvents="none"; }
  
  showLoader("Refreshing...");
  
  // Only price cache clear karvo — fundamentals/history same rehva joiye
  // cache = price data only (wl + indices). Fundamentals localStorage/Firebase ma alag che.
  for(let k in cache) { cache[k].time = 0; }
  
  // Banne ne ek sathe fetch karo
  await Promise.all([
    batchFetchStocks(wl),
    Promise.all(indicesList.map(i=>fetchFull(i.sym,true)))
  ]);
  
  // Data avi gaya pachhi j render karo — renderWL already has fresh cache data
  await renderWL();
  updateHeaderIndices();
  updatePriceTicker();
  updateGlobalTicker();
  
  hideLoader();
  if(btn) { btn.style.opacity="1"; btn.style.pointerEvents="auto"; }
  // Request notification permission on first manual refresh
  if(typeof Notification!=='undefined' && Notification.permission==='default'){
    Notification.requestPermission();
  }
  // Run technical alerts on manual refresh
  setTimeout(()=>runAllTechnicalAlerts(), 800);
  showPopup("Refreshed!");
}

// ── TAB SWIPE NAVIGATION ─────────────────────────────────────
const TAB_ORDER = ['watchlist','indices','holdings','history','news'];
let _curTab = 'watchlist';
let _txStart = 0, _tyStart = 0, _swipeLocked = false;

// Patch tab() to track current tab
const _origTab = window.tab;
window.tab = function(t) {
  _origTab(t);
  if (TAB_ORDER.includes(t)) _curTab = t;
};

document.addEventListener('touchstart', e => {
  _txStart = e.touches[0].clientX;
  _tyStart = e.touches[0].clientY;
  _swipeLocked = false;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (_swipeLocked) return;
  const dx = Math.abs(e.touches[0].clientX - _txStart);
  const dy = Math.abs(e.touches[0].clientY - _tyStart);
  // If mostly vertical → lock out horizontal swipe for this gesture
  if (dy > dx) _swipeLocked = true;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (_swipeLocked) return;
  const dx = e.changedTouches[0].clientX - _txStart;
  const dy = e.changedTouches[0].clientY - _tyStart;
  // Need strong horizontal intent
  if (Math.abs(dx) < 55 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
  // Don't swipe when any modal is open
  const modals = ['detailModal','modal','exitModal','niviModal','target-modal-box','remove-modal-box'];
  if (modals.some(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden') && el.style.display !== 'none'; })) return;
  const idx = TAB_ORDER.indexOf(_curTab);
  if (dx < -55 && idx < TAB_ORDER.length - 1) window.tab(TAB_ORDER[idx + 1]); // left → next
  if (dx >  55 && idx > 0)                    window.tab(TAB_ORDER[idx - 1]); // right → prev
}, { passive: true });

// ── BACK BUTTON → Exit Confirmation ──────────────────────────
history.pushState(null, '', window.location.href);
window.addEventListener('popstate', () => {
  // If any modal open → close it instead of showing exit
  if (!document.getElementById('detailModal').classList.contains('hidden')) { closeDetail(); history.pushState(null,'',window.location.href); return; }
  if (!document.getElementById('modal').classList.contains('hidden')) { closeModal(); history.pushState(null,'',window.location.href); return; }
  document.getElementById('exitModal').classList.remove('hidden');
  history.pushState(null, '', window.location.href);
});



// ======================================
// SMART NEWS ENGINE
// ======================================
let newsCache = null;
let newsCacheTime = 0;
const NEWS_CACHE_MS = 5 * 60 * 1000; // 5 min cache
let newsCacheDate = '';

// Keyword sentiment engine
const NEWS_KEYWORDS = {
  positive: ['dividend','buyback','bonus','acquisition','profit','growth','order','deal','partnership','expansion','record','strong','beat','upgrade','target raised','buy','positive','surplus','win','award','allot'],
  negative: ['penalty','fine','fraud','loss','decline','default','sebi order','closure','suspend','downgrade','sell','negative','deficit','debt','restructur','probe','investigation','lawsuit','write-off'],
  corporate: ['board meeting','results','agm','egm','record date','rights issue','split','merger','demerger','insider','shareholding','disclosure','outcome','intimation','postal ballot']
};

function getNewsSentiment(text) {
  const t = text.toLowerCase();
  let pos = 0, neg = 0;
  NEWS_KEYWORDS.positive.forEach(k => { if(t.includes(k)) pos++; });
  NEWS_KEYWORDS.negative.forEach(k => { if(t.includes(k)) neg++; });
  if(neg > pos) return 'negative';
  if(pos > neg) return 'positive';
  return 'neutral';
}

function getNewsTag(text) {
  const t = text.toLowerCase();
  if(t.includes('dividend')) return {label:'Dividend', cls:'tag-dividend'};
  if(t.includes('buyback')) return {label:'Buyback', cls:'tag-buyback'};
  if(t.includes('result') || t.includes('profit') || t.includes('revenue')) return {label:'Results', cls:'tag-results'};
  if(t.includes('penalty') || t.includes('fine') || t.includes('sebi')) return {label:'Penalty', cls:'tag-penalty'};
  if(t.includes('board')) return {label:'Board Meeting', cls:'tag-board'};
  if(t.includes('merger') || t.includes('acqui') || t.includes('demerger')) return {label:'M&A', cls:'tag-merger'};
  if(t.includes('insider') || t.includes('disclosure')) return {label:'Insider', cls:'tag-insider'};
  if(t.includes('block deal') || t.includes('bulk deal')) return {label:'Block Deal', cls:'tag-block'};
  if(t.includes('order') || t.includes('contract') || t.includes('deal')) return {label:'Order Win', cls:'tag-results'};
  return null;
}

function smartSummaryTemplate(text, sym, sentiment) {
  const t = text.toLowerCase();
  if(t.includes('dividend')) return sym + ' declared dividend. Check record date & ex-date for eligibility.';
  if(t.includes('buyback')) return sym + ' buyback  -  potential upside for shareholders. Watch buyback price vs CMP.';
  if(t.includes('result') || t.includes('q3') || t.includes('q4') || t.includes('q1') || t.includes('q2')) return sym + ' quarterly results announced. Compare with estimates for direction.';
  if(t.includes('penalty') || t.includes('fine')) return sym + ' faces regulatory action. Monitor for management response & impact.';
  if(t.includes('board meeting')) return sym + ' board meeting scheduled. Watch for corporate action announcements.';
  if(t.includes('order') || t.includes('contract')) return sym + ' new order/contract win. Positive for revenue visibility.';
  if(t.includes('merger') || t.includes('acqui')) return sym + ' M&A activity. Assess synergies & valuation impact.';
  if(sentiment === 'positive') return sym + '  -  Positive development. Monitor price action for confirmation.';
  if(sentiment === 'negative') return sym + '  -  Negative development. Watch support levels closely.';
  return sym + '  -  Track this announcement for portfolio impact.';
}

// -- LIVE NEWS FETCH via GAS --
async function fetchLiveNews(sym) {
  const apiUrl = localStorage.getItem("customAPI") || API;
  const cleanSym = sym.replace(".NS","").replace(".BO","");
  try {
    const r = await fetch(`${apiUrl}?niviNewsSearch&s=${encodeURIComponent(cleanSym)}`);
    if(!r.ok) return [];
    const j = await r.json();
    if(j.news && j.news.length > 0) return j.news;
  } catch(e) {
    console.warn("News fetch failed for "+sym+":", e.message);
  }
  return [];
}

function timeAgoDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff/60000);
    if(mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins/60);
    if(hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs/24) + 'd ago';
  } catch(e) { return ''; }
}

async function loadAllNews() {
  // Use cache if fresh
  if(newsCache && (Date.now() - newsCacheTime < NEWS_CACHE_MS)) return newsCache;
  
  // Fetch for top watchlist stocks (max 5 to avoid GAS quota)
  const symsToFetch = wl.slice(0,5);
  if(symsToFetch.length === 0) { newsCache=[]; newsCacheTime=Date.now(); return []; }
  
  const results = await Promise.all(symsToFetch.map(s => fetchLiveNews(s)));
  const allItems = [];
  
  symsToFetch.forEach((sym, i) => {
    (results[i]||[]).forEach(item => {
      allItems.push({
        sym: sym,
        source: 'LIVE',
        type: detectNewsType(item.title),
        time: timeAgo(item.date),
        _rawDate: item.date,
        title: item.title,
        link: item.link
      });
    });
  });
  
  // Sort by date: most recent first
  allItems.sort((a, b) => {
    try {
      const da = new Date(a._rawDate || 0).getTime();
      const db = new Date(b._rawDate || 0).getTime();
      return db - da;
    } catch(e) { return 0; }
  });
  newsCache = allItems.length > 0 ? allItems : getFallbackNews();
  newsCacheTime = Date.now();
  return newsCache;
}

function detectNewsType(title) {
  const t = title.toLowerCase();
  if(t.includes('board')||t.includes('agm')||t.includes('result')||t.includes('dividend')||
     t.includes('buyback')||t.includes('record date')||t.includes('split')||
     t.includes('merger')||t.includes('disclosure')||t.includes('intimation')) return 'corporate';
  return 'market';
}

function getFallbackNews() {
  const isLocal = location.protocol === 'file:';
  const msg = isLocal
    ? 'Open via GitHub Pages to load live news. Local file cannot call GAS API.'
    : 'No news found. Check API connection or try refreshing.';
  return [
    {sym:'INFO', source:'APP', type:'market', time:'', title: msg, link:''},
  ];
}

let newsActiveFilter = 'ALL';
let newsActiveTab = 'all';

// =============================================
// ASK NIVI TAB — Chat UI v3
// Market Brief (top) + Chat + Mic + Chips
// =============================================
function _niviSubTab(tab) {
  const isChat = tab === 'chat';
  document.getElementById('nivi-section-chat').style.display = isChat ? 'flex' : 'none';
  document.getElementById('nivi-section-news').style.display = isChat ? 'none' : 'flex';
  const active   = 'flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;border:1px solid #065f46;background:#065f46;color:#34d399;';
  const inactive = 'flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;border:1px solid #1e3a5f;background:transparent;color:#4b6280;';
  document.getElementById('nivi-subtab-chat').style.cssText = isChat ? active : inactive;
  document.getElementById('nivi-subtab-news').style.cssText = isChat ? inactive : active;
}
let _tabChatHistory = [];
let _tabMicActive   = false;
let _tabRecognition = null;
let _tabSpeaking    = false;
let _tabUtterance   = null;

function buildMoverChips() {
  if (!wl || wl.length === 0) return '';
  const stocks = wl.map(s => {
    const d = cache[s]?.data;
    if (!d || !d.regularMarketPrice || !d.chartPreviousClose) return null;
    const diff = d.regularMarketPrice - d.chartPreviousClose;
    const pct = (diff / d.chartPreviousClose * 100) || 0;
    return { sym: s, pct, price: d.regularMarketPrice };
  }).filter(Boolean);
  if (stocks.length === 0) return '';
  const sorted = [...stocks].sort((a, b) => b.pct - a.pct);
  let html = '';
  sorted.forEach(s => {
    const isGainer = s.pct >= 0;
    const color = isGainer ? '#22c55e' : '#ef4444';
    const bg    = isGainer ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)';
    const border= isGainer ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
    const sign  = isGainer ? '+' : '';
    html += `<span onclick="openStockDetail('${s.sym}')" style="flex-shrink:0;cursor:pointer;background:${bg};border:1px solid ${border};border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:${color};font-family:'Rajdhani',sans-serif;white-space:nowrap;">${s.sym} ${sign}${s.pct.toFixed(2)}%</span>`;
  });
  return html;
}

async function renderNews() {
  const el = document.getElementById('news');
  if (!el) return;

  const _appHdr    = document.querySelector('.app-header');
  const _statusBar = document.getElementById('marketStatus')?.parentElement;
  const _ticker    = document.getElementById('priceTicker');
  const _botNav    = document.querySelector('.fixed.bottom-0');
  const _top = (_appHdr ? _appHdr.offsetHeight : 44)
             + (_statusBar ? _statusBar.offsetHeight : 22)
             + (_ticker && _ticker.style.display !== 'none' ? _ticker.offsetHeight : 0);
  const _bot = _botNav ? _botNav.offsetHeight : 56;

  el.innerHTML = `
  <div style="display:flex;flex-direction:column;position:fixed;left:50%;transform:translateX(-50%);width:100%;max-width:448px;top:${_top}px;bottom:${_bot}px;overflow:hidden;padding:8px 12px 0 12px;box-sizing:border-box;background:#0a0f1a;z-index:1;">

    <!-- Sub-tab buttons -->
    <div style="flex-shrink:0;padding-bottom:6px;">
      <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
        <button id="nivi-subtab-chat" onclick="_niviSubTab('chat')"
          style="flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid #065f46;background:#065f46;color:#34d399;">
          💬 Chat
        </button>
        <button id="nivi-subtab-news" onclick="_niviSubTab('news')"
          style="flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid #1e3a5f;background:transparent;color:#4b6280;">
          📰 News
</button>
        <button onclick="_tabClearHistory()" title="Chat clear karo"
          style="flex-shrink:0;background:transparent;color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:5px 9px;cursor:pointer;line-height:1;">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4H5z" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <!-- ===== CHAT SECTION ===== -->
<div id="nivi-section-chat" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">

<!-- Collapsible Market Brief -->
      <div style="flex-shrink:0;">
        <div id="tab-brief-card" style="display:none;background:linear-gradient(135deg,#0a1e14,#0f1e33);border:1px solid rgba(52,211,153,0.2);border-radius:10px;padding:8px 12px;margin-bottom:6px;">
          <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:6px;">
            ${buildMoverChips()}
          </div>
          <div id="tab-brief-body" style="font-size:12px;color:#e2e8f0;line-height:1.8;font-family:'Noto Sans Devanagari','Mangal',sans-serif;">
            <div style="text-align:center;padding:8px 0;">
              <div class="spinner" style="margin:0 auto 5px;"></div>
              <div style="font-size:11px;color:#34d399;font-family:'Rajdhani',sans-serif;">निवी सोच रही है...</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
            <div id="tab-brief-time" style="font-size:9px;color:#4b6280;"></div>
            <button onclick="_tabNewsSpeak()" style="background:#065f46;color:#34d399;border:none;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">🔊</button>
          </div>
        </div>
      </div>

      <!-- Chat bubbles -->
      <div id="tab-chat-area" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px 0 6px 0;-webkit-overflow-scrolling:touch;min-height:0;">
        <!-- messages render here -->
      </div>

      <!-- Bottom: chips + input -->
      <div style="flex-shrink:0;padding:6px 0 10px 0;border-top:1px solid rgba(6,95,70,0.3);background:#0a0f1a;position:sticky;bottom:0;z-index:2;">
        <div style="display:flex;gap:5px;overflow-x:auto;margin-bottom:6px;padding-bottom:2px;scrollbar-width:none;">
          <button id="tab-mood-toggle-btn" onclick="_tabToggleMood()" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;">📊 बाज़ार मूड</button>
          <<button onclick="_tabChip('आज कौन सा स्टॉक खरीदूं?')" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Noto Sans Devanagari','Mangal',sans-serif;white-space:nowrap;">🛒 क्या खरीदूं?</button>
          <button onclick="_tabChip('मेरी वॉचलिस्ट का विश्लेषण करो')" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Noto Sans Devanagari','Mangal',sans-serif;white-space:nowrap;">📊 Portfolio</button>
          <button onclick="_tabChip('आज का बाज़ार कैसा है?')" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Noto Sans Devanagari','Mangal',sans-serif;white-space:nowrap;">📈 Market?</button>
          <button onclick="_tabChip('मेरे सबसे ज़्यादा घाटे वाले स्टॉक कौन से हैं?')" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Noto Sans Devanagari','Mangal',sans-serif;white-space:nowrap;">📉 Losers</button>
          <button onclick="_tabChip('आज कौन से सेक्टर में तेज़ी है?')" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Noto Sans Devanagari','Mangal',sans-serif;white-space:nowrap;">🏭 Sector</button>
          <button onclick="_tabChip('अभी कौन से स्टॉक में सबसे ज़्यादा volume है?')" style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Noto Sans Devanagari','Mangal',sans-serif;white-space:nowrap;">🔥 Volume</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="tab-nivi-input" type="text" placeholder="Ask anything to Nivi..."
            onkeydown="if(event.key==='Enter')_tabSend()"
            style="flex:1;background:#0a1628;border:1px solid #1e3a5f;border-radius:10px;padding:9px 12px;font-size:12px;color:#e2e8f0;font-family:'Rajdhani',sans-serif;outline:none;min-width:0;"/>
          <button id="tab-mic-btn" onclick="_tabMicToggle()" title="Voice Input"
            style="background:#0f2a1a;border:1px solid #065f46;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:14px;flex-shrink:0;line-height:1;">🎙️</button>
          <button onclick="_tabSend()"
            style="background:#065f46;color:#34d399;border:none;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;flex-shrink:0;">भेजो</button>
        </div>
        <div id="tab-mic-status" style="font-size:9px;color:#f59e0b;margin-top:3px;display:none;font-family:'Rajdhani',sans-serif;">🔴 सुन रही है... दोबारा दबाएं रोकने के लिए</div>
      </div>

    </div><!-- end nivi-section-chat -->

    <!-- ===== NEWS SECTION ===== -->
    <div id="nivi-section-news" style="display:none;flex-direction:column;flex:1;overflow-y:auto;padding:0 4px 8px 4px;">

      <!-- Search Bar -->
      <div style="display:flex;gap:6px;margin-bottom:10px;width:100%;max-width:100%;align-items:center;">
        <input id="niviNewsInput" type="text" placeholder="Company naam daalo... RELIANCE, SBIN"
          onkeydown="if(event.key==='Enter')niviNewsSearch()"
            style="flex:1;background:#0a1628;border:1px solid #1e3a5f;border-radius:10px;padding:9px 12px;font-size:12px;color:#e2e8f0;font-family:'Rajdhani',sans-serif;outline:none;min-width:0;max-width:calc(100% - 50px);"/>
        <button onclick="niviNewsSearch()"
          style="background:#065f46;color:#34d399;border:none;border-radius:10px;padding:9px 14px;font-size:13px;cursor:pointer;flex-shrink:0;">🔍</button>
      </div>

      <!-- Loading -->
      <div id="niviNewsLoading" style="display:none;text-align:center;padding:20px 0;">
        <div style="font-size:22px;display:inline-block;animation:spin 1s linear infinite;">⚙️</div>
        <div style="font-size:11px;color:#4b6280;margin-top:6px;font-family:'Rajdhani',sans-serif;">News fetch ho rahi hai...</div>
      </div>

      <!-- Error -->
      <div id="niviNewsError" style="display:none;font-size:12px;color:#ef4444;background:rgba(239,68,68,0.08);padding:10px;border-radius:10px;font-family:'Rajdhani',sans-serif;margin-bottom:8px;"></div>

      <!-- Result Card -->
      <div id="niviNewsSummaryCard" style="display:none;background:#0d1f35;border:1px solid #1e3a5f;border-radius:14px;padding:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">📰</span>
          <div>
            <div id="niviNewsSymLabel" style="font-weight:700;font-size:13px;color:#34d399;font-family:'Rajdhani',sans-serif;"></div>
            <div id="niviNewsMetaLabel" style="font-size:10px;color:#4b6280;margin-top:1px;font-family:'Rajdhani',sans-serif;"></div>
          </div>
        </div>
        <div id="niviNewsBullets" style="font-size:12.5px;line-height:1.85;color:#cbd5e1;font-family:'Noto Sans Devanagari','Rajdhani',sans-serif;"></div>
        <div style="margin-top:10px;border-top:1px solid #1e3a5f;padding-top:8px;">
<div style="display:flex;justify-content:space-between;align-items:center;">
            <button onclick="(function(){var el=document.getElementById('niviRawHeadlines');el.style.display=el.style.display==='none'?'block':'none';})()"
              style="font-size:10px;color:#38bdf8;background:none;border:none;cursor:pointer;padding:0;font-family:'Rajdhani',sans-serif;">
              📋 Source headlines
            </button>
            <button id="niviNewsSpeak" onclick="niviNewsSpeak()"
              style="background:#065f46;color:#34d399;border:none;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">🔊 Sunao</button>
          </div>
          <div id="niviRawHeadlines" style="display:none;margin-top:8px;"></div>
        </div>
      </div>

    </div><!-- end nivi-section-news -->

  </div>`;

  // Load market brief
  _tabLoadBrief();
  _niviSubTab('chat');
  if (_tabChatHistory.length === 0) {
    try {
      const saved = JSON.parse(localStorage.getItem('niviTabChat'));
      if (saved && saved.length > 0) _tabChatHistory = saved;
    } catch(e) {}
  }
  _tabRenderChat();
}

// --- MARKET BRIEF LOADER ---
async function _tabLoadBrief() {
  const AI_NEWS_CACHE_KEY = 'aiNewsCache_v2';
  const AI_NEWS_CACHE_MS  = 30 * 60 * 1000;
  try {
    const cached = JSON.parse(localStorage.getItem(AI_NEWS_CACHE_KEY));
    if (cached && cached.syms === wl.slice(0,12).join(',') && (Date.now()-cached.ts) < AI_NEWS_CACHE_MS) {
      _tabSetBriefHtml(cached.html, cached.ts);
      return;
    }
  } catch(e) {}

const stockLines = wl.slice(0, 12).map(s => {
  const d = cache[s] && cache[s].data;
  if (!d) return null;

  const price = d.regularMarketPrice || 0;
  const prev  = d.chartPreviousClose || 0;
  const diff  = price - prev;

  const pct = prev ? ((diff / prev) * 100).toFixed(2) : '0.00';

  return `${s}: ₹${price.toFixed(2)} (${diff >= 0 ? '+' : ''}${pct}%)`;
}).filter(Boolean);


const today = new Date().toLocaleDateString('hi-IN', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});


const prompt = `
You are Nivi, an expert Indian stock market analyst. Reply ONLY in pure Hindi Devanagari script. No English, no Hinglish, no Roman script.

Aaj ki tarikh: ${today}
Watchlist: ${stockLines.join(', ') || "data nahi"}

Bilkul shuddh Hindi Devanagari mein jawab do:

**आज का बाज़ार मूड**
[1-2 sentences]

**वॉचलिस्ट की खास बातें**
[Top 3 movers — 1-1 line]

**सेक्टर नज़र**
[2 lines]

**निवी की सलाह**
[2 lines max]

Max 180 words. Sirf Hindi Devanagari.
`;
  try {
    const gemKey = localStorage.getItem('geminiApiKey');
    let rawText = null;
    if (gemKey) {
      const r = await directGeminiCall(prompt);
      if (r && r.ok) rawText = r.answer;
    }
    if (!rawText) {
      const _mUrl = API_NIVI;
      const r    = await fetch(`${_mUrl}?type=askMarket&prompt=${encodeURIComponent(prompt)}`);
      const data = await r.json();
      rawText = data.answer || data.text || data.summary || null;
      if (!rawText) throw new Error(data.error || 'No response');
    }
    const htmlOut = formatAINewsText(rawText);
    try { localStorage.setItem(AI_NEWS_CACHE_KEY, JSON.stringify({ts:Date.now(), syms:wl.slice(0,12).join(','), html:htmlOut})); } catch(e){}
    _tabSetBriefHtml(htmlOut, Date.now());
  } catch(err) {
    const briefBody = document.getElementById('tab-brief-body');
    if (briefBody) briefBody.innerHTML = `<div style="font-size:11px;color:#f59e0b;padding:4px 0;">⚠️ Market brief load nahi hua. Refresh karo.</div>`;
  }
}

function _tabSetBriefHtml(html, ts) {
  const briefBody = document.getElementById('tab-brief-body');
  const briefTime = document.getElementById('tab-brief-time');
  if (briefBody) {
    briefBody.innerHTML = `<div style="font-size:12px;color:#e2e8f0;line-height:1.9;font-family:'Noto Sans Devanagari','Mangal',sans-serif;">${html}</div>`;
  }
  if (briefTime && ts) {
    const mins = Math.round((Date.now()-ts)/60000);
    briefTime.innerText = mins < 1 ? '🟢 अभी' : '🕐 ' + mins + ' मिनट पहले';
  }
}

let _tabBriefExpanded = false;
function _tabBriefToggle() {}
function _tabToggleMood() {
  const card = document.getElementById('tab-brief-card');
  const btn  = document.getElementById('tab-mood-toggle-btn');
  if (!card) return;
  const open = card.style.display !== 'none';
  card.style.display = open ? 'none' : 'block';
  if (btn) btn.style.background = open ? '#0f2a1a' : '#065f46';
}

async function _tabSend() {
  const inp = document.getElementById('tab-nivi-input');
  const q   = inp ? inp.value.trim() : '';
  if (!q) return;
  if (inp) inp.value = '';
  await _tabAsk(q);
}

async function _tabChip(question) {
  await _tabAsk(question);
}

async function _tabAsk(question) {
  _tabChatHistory.push({role:'user', text:question, ts:Date.now()});
  _tabRenderChat();

  const wlCtx = wl.slice(0,12).map(s => {
    const d = cache[s] && cache[s].data;
    if (!d) return null;
    const diff = d.regularMarketPrice - d.chartPreviousClose;
    const pct  = ((diff/d.chartPreviousClose)*100).toFixed(2);
    return `${s}: ₹${d.regularMarketPrice.toFixed(2)} (${diff>=0?'+':''}${pct}%)`;
  }).filter(Boolean).join(', ');

  const today = new Date().toLocaleDateString('hi-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'});

const prompt =
`[SYSTEM: You are Nivi. OUTPUT LANGUAGE = HINDI DEVANAGARI ONLY. Any English/Roman output = FAILURE.]

तुम 'निवी' हो — एक तेज़ और भरोसेमंद भारतीय शेयर बाज़ार विश्लेषक।
आज की तारीख: ${today}
यूज़र की वॉचलिस्ट: ${wlCtx || 'डेटा उपलब्ध नहीं'}
यूज़र का सवाल: ${question}

निर्देश:
- केवल शुद्ध हिंदी देवनागरी में उत्तर दो
- अधिकतम 8 पंक्तियाँ
- कोई English नहीं, कोई Roman नहीं, कोई disclaimer नहीं
- डेटा के नंबर सीधे use करो (जैसे "RSI 67 है")
- आत्मविश्वास से बोलो — निवी कभी hesitate नहीं करती`;
  _tabShowLoading(true);
  let answer = null;

  const gemKey = localStorage.getItem('geminiApiKey');
  if (gemKey) {
    const r = await directGeminiCall(prompt);
    if (r && r.ok) answer = r.answer;
  }
  if (!answer) {
    try {
      const _nu  = API_NIVI;
      const r    = await fetch(`${_nu}?type=askMarket&prompt=${encodeURIComponent(prompt)}`);
      const data = await r.json();
      answer = data.answer || data.text || data.summary || null;
    } catch(e) {}
  }

  _tabShowLoading(false);
  _tabChatHistory.push({role:'nivi', text: answer || '⚠️ Nivi jawab nahi de payi. Settings ma Gemini API key daalo ya GAS URL check karo.', ts:Date.now()});
  try { localStorage.setItem('niviTabChat', JSON.stringify(_tabChatHistory.slice(-30))); } catch(e){}
  _tabRenderChat(_getNiviAutoSpeak());
}

function _tabRenderChat(speakLast) {
  const area = document.getElementById('tab-chat-area');
  if (!area) return;
  if (_tabChatHistory.length === 0) {
    area.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#1e3a2e;">
      <svg viewBox="0 0 28 28" width="32" height="32" fill="none"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z" fill="#1e3a2e"/></svg>
      <div style="font-size:12px;font-family:'Noto Sans Devanagari','Mangal',sans-serif;text-align:center;line-height:1.6;">Ask anything to Nivi ⬇️<br><span style="font-size:10px;color:#1a3020;">or tap on below chips</span></div>
    </div>`;
    return;
  }
  area.innerHTML = _tabChatHistory.map(msg => {
    if (msg.role === 'user') {
      return `<div style="display:flex;justify-content:flex-end;">
        <div style="background:#1e3a5f;color:#e2e8f0;border-radius:14px 14px 2px 14px;padding:9px 13px;max-width:82%;font-size:12px;line-height:1.7;font-family:'Noto Sans Devanagari','Mangal',sans-serif;word-break:normal;overflow-wrap:break-word;">${msg.text}</div>
      </div>`;
    } else {
      const formatted = msg.text.split('\n').filter(l=>l.trim()).map(l=>
        `<div style="margin-bottom:4px;">${l.replace(/^[•\-\*]\s*/,'• ')}</div>`
      ).join('');
      return `<div style="display:flex;gap:7px;align-items:flex-start;">
        <div style="width:22px;height:22px;border-radius:50%;border:1.5px solid #34d399;background:#0a1628;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
          <svg viewBox="0 0 28 28" width="13" height="13" fill="none"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z" fill="#34d399"/></svg>
        </div>
        <div style="background:linear-gradient(135deg,#0a2218,#0f2a1a);border:1px solid rgba(52,211,153,0.2);color:#e2e8f0;border-radius:2px 14px 14px 14px;padding:10px 12px;max-width:85%;font-size:13px;line-height:1.85;font-family:'Noto Sans Devanagari','Mangal',sans-serif;word-break:normal;overflow-wrap:break-word;">${formatted}</div>
      </div>`;
    }
  }).join('');
  area.scrollTop = area.scrollHeight;
  if (speakLast) {
    const last = [..._tabChatHistory].reverse().find(m => m.role === 'nivi');
    if (last) setTimeout(() => _tabSpeak(last.text), 400);
  }
}

function _tabShowLoading(show) {
  const area = document.getElementById('tab-chat-area');
  if (!area) return;
  const existing = document.getElementById('tab-loading-indicator');
  if (show) {
    if (!existing) {
      const el = document.createElement('div');
      el.id = 'tab-loading-indicator';
      el.style.cssText = 'text-align:center;padding:12px 0;';
      el.innerHTML = '<div class="spinner" style="margin:0 auto 5px;width:20px;height:20px;"></div><div style="font-size:10px;color:#4b6280;font-family:\'Rajdhani\',sans-serif;">Nivi सोच रही है...</div>';
      area.appendChild(el);
      area.scrollTop = area.scrollHeight;
    }
  } else {
    if (existing) existing.remove();
  }
}

function _tabMicToggle() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    showPopup('Voice input browser mein support nahi hai'); return;
  }
  if (_tabMicActive) {
    if (_tabRecognition) _tabRecognition.stop();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _tabRecognition = new SR();
  _tabRecognition.lang = 'hi-IN';
  _tabRecognition.interimResults = false;
  _tabRecognition.maxAlternatives = 1;
  _tabMicActive = true;
  const micBtn    = document.getElementById('tab-mic-btn');
  const micStatus = document.getElementById('tab-mic-status');
  if (micBtn)    { micBtn.style.background = '#7f1d1d'; micBtn.style.borderColor = '#ef4444'; }
  if (micStatus) micStatus.style.display = 'block';
  _tabRecognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const inp = document.getElementById('tab-nivi-input');
    if (inp) inp.value = transcript;
  };
  _tabRecognition.onend = () => {
    _tabMicActive = false;
    if (micBtn)    { micBtn.style.background = '#0f2a1a'; micBtn.style.borderColor = '#065f46'; }
    if (micStatus) micStatus.style.display = 'none';
    const inp = document.getElementById('tab-nivi-input');
    if (inp && inp.value.trim()) _tabSend();
  };
  _tabRecognition.onerror = () => {
    _tabMicActive = false;
    if (micBtn)    { micBtn.style.background = '#0f2a1a'; micBtn.style.borderColor = '#065f46'; }
    if (micStatus) micStatus.style.display = 'none';
  };
  _tabRecognition.start();
}

function _tabSpeak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[^\w\s.,!?%₹+\-।]/g,' ').substring(0, 500);
  _tabUtterance = new SpeechSynthesisUtterance(expandTickersForSpeech(clean));
  _tabUtterance.lang  = 'hi-IN';
  _tabUtterance.rate  = _getNiviRate();
  _tabUtterance.pitch = _getNiviPitch();
  const voices = speechSynthesis.getVoices();
  const female =
    voices.find(v => v.lang==='hi-IN' && /female|woman|lekha|aditi|riya|priya/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN' && v.name.includes('Google') && !/male/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN' && !/male/i.test(v.name)) ||
    voices.find(v => v.lang==='hi-IN');
  if (female) _tabUtterance.voice = female;
  speechSynthesis.speak(_tabUtterance);
}

function _tabNewsSpeak() {
  const briefBody = document.getElementById('tab-brief-body');
  if (!briefBody) return;
  _tabSpeak(briefBody.innerText);
}

function aiNewsCacheClear() {
  localStorage.removeItem('aiNewsCache_v2');
}

function _tabClearHistory() {
  _tabChatHistory = [];
  localStorage.removeItem('niviTabChat');
  _tabRenderChat();
  showPopup('Chat history clear!');
}

function formatAINewsText(raw) {
  if (!raw) return '<div style="color:#4b6280;font-size:12px;">No data received.</div>';
  return raw
    .replace(/\*\*(.+?)\*\*/g, '<div style="font-size:11px;font-weight:700;color:#34d399;letter-spacing:0.5px;margin-top:12px;margin-bottom:4px;font-family:\'Noto Sans Devanagari\',\'Mangal\',sans-serif;">$1</div>')
    .replace(/\n/g, '<br>');
}

function setNewsFilter(sym) {
  newsActiveFilter = sym;
  renderNews();
}

// ======================================
// NSE CORPORATE ANNOUNCEMENTS
// ======================================
let nseNewsCache = null;
let nseNewsCacheTime = 0;
const NSE_CACHE_MS = 5 * 60 * 1000; // 5 min cache

async function fetchNSEAnnouncements() {
  try {
    if (nseNewsCache && (Date.now() - nseNewsCacheTime) < NSE_CACHE_MS) {
      return nseNewsCache;
    }
    const apiUrl = localStorage.getItem("customAPI") || API;
    const r = await fetch(apiUrl + "?type=nse");
    if (!r.ok) return [];
    const data = await r.json();
    if (data.ok && data.items && data.items.length > 0) {
      nseNewsCache = data.items;
      nseNewsCacheTime = Date.now();
      return data.items;
    }
    return [];
  } catch(e) {
    return [];
  }
}

async function renderNSENews() {
  const el = document.getElementById("nseAnnouncementsBox");
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#4b6280;padding:12px;font-size:11px;">Loading NSE announcements...</div>';
  const items = await fetchNSEAnnouncements();
  if (!items || items.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:#4b6280;padding:12px;font-size:11px;">NSE feed not available.<br><span style="font-size:10px;">NSE may be blocking requests. Try Refresh.</span></div>';
    return;
  }
  // Sort: high priority first
  const sorted = [...items].sort(function(a, b) {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] || 2) - (p[b.priority] || 2);
  });
  el.innerHTML = sorted.map(function(item) {
    const timeStr = item.time ? item.time.replace(/ \+\d{4}/, "").trim() : "";
    const linkHtml = item.link
      ? '<a href="' + item.link + '" target="_blank" style="font-size:9px;color:#38bdf8;text-decoration:none;margin-left:auto;white-space:nowrap;">View &gt;&gt;</a>'
      : '';
    return '<div style="display:flex;align-items:stretch;gap:0;border-bottom:1px solid rgba(255,255,255,0.05);padding:8px 4px;">' +
      '<div style="width:3px;min-width:3px;border-radius:2px;background:' + (item.color || "#9e9e9e") + ';margin-right:10px;"></div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:600;color:#e2e8f0;line-height:1.4;">' + item.news + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">' +
          '<span style="font-size:10px;color:#4b6280;">' + timeStr + '</span>' +
          linkHtml +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");
}

// ======================================
// AVERAGING CALCULATOR
// ======================================
let _acSym='', _acAvg=0, _acQty=0, _acCmp=0, _acMode='buy';

function openAvgCalc(sym, avgPrice, qty, cmp){
  _acSym=sym; _acAvg=avgPrice; _acQty=qty; _acCmp=cmp;
  document.getElementById('ac-sym-display').innerText=sym;
  document.getElementById('ac-avg-display').innerText='₹'+avgPrice.toFixed(2);
  document.getElementById('ac-qty-display').innerText=qty;
  document.getElementById('ac-cmp-display').innerText='₹'+cmp.toFixed(2);
  document.getElementById('ac-buy-price').value='';
  document.getElementById('ac-buy-qty').value='';
  document.getElementById('ac-target-avg').value='';
  document.getElementById('ac-target-buyprice').value=cmp.toFixed(2);
  document.getElementById('ac-result').style.display='none';
  setAvgMode('buy');
  document.getElementById('avgCalcModal').style.display='flex';
}

function closeAvgCalc(){
  document.getElementById('avgCalcModal').style.display='none';
}

function setAvgMode(mode){
  _acMode=mode;
  const isBuy=mode==='buy';
  document.getElementById('ac-panel-buy').style.display=isBuy?'block':'none';
  document.getElementById('ac-panel-target').style.display=isBuy?'none':'block';
  document.getElementById('ac-mode-buy').style.background=isBuy?'#1e3a5f':'#1e2d3d';
  document.getElementById('ac-mode-buy').style.color=isBuy?'#38bdf8':'#94a3b8';
  document.getElementById('ac-mode-buy').style.borderColor=isBuy?'#38bdf8':'#2d3f52';
  document.getElementById('ac-mode-target').style.background=!isBuy?'#1e3a5f':'#1e2d3d';
  document.getElementById('ac-mode-target').style.color=!isBuy?'#38bdf8':'#94a3b8';
  document.getElementById('ac-mode-target').style.borderColor=!isBuy?'#38bdf8':'#2d3f52';
  document.getElementById('ac-result').style.display='none';
  if(isBuy) calcAvg(); else calcTargetQty();
}

function calcAvg(){
  const buyPrice=parseFloat(document.getElementById('ac-buy-price').value)||0;
  const buyQty=parseInt(document.getElementById('ac-buy-qty').value)||0;
  const res=document.getElementById('ac-result');
  if(!buyPrice||!buyQty){res.style.display='none';return;}

  const newQty=_acQty+buyQty;
  const newAvg=(_acAvg*_acQty+buyPrice*buyQty)/newQty;
  const extraInvest=buyPrice*buyQty;
  const oldRecovery=((_acAvg-_acCmp)/_acCmp*100);
  const newRecovery=((newAvg-_acCmp)/_acCmp*100);
  const better=newRecovery<oldRecovery;

  const rColor=(v)=>v>0?'#ef4444':'#22c55e';

  res.style.display='block';
  res.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:#4b6280;margin-bottom:8px;letter-spacing:0.5px;">RESULT</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">New Avg Price</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#38bdf8;">₹${newAvg.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">New Total Qty</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${newQty}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">Extra Investment</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#f59e0b;">${inr(extraInvest)}</span>
    </div>
    <div style="border-top:1px solid #1e3a5f;margin:6px 0;"></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">Recovery needed (old)</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${rColor(oldRecovery)};">${oldRecovery>0?'+':''}${oldRecovery.toFixed(2)}%</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:11px;color:#94a3b8;">Recovery needed (new)</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${rColor(newRecovery)};">${newRecovery>0?'+':''}${newRecovery.toFixed(2)}%</span>
    </div>
    <div style="text-align:center;font-size:12px;font-weight:700;padding:6px;border-radius:6px;background:${better?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)'};color:${better?'#22c55e':'#ef4444'};">
      ${better?'Averaging will help recovery!':'Buying above current avg'}
    </div>`;
}

function calcTargetQty(){
  const targetAvg=parseFloat(document.getElementById('ac-target-avg').value)||0;
  const buyAt=parseFloat(document.getElementById('ac-target-buyprice').value)||0;
  const res=document.getElementById('ac-result');
  if(!targetAvg||!buyAt){res.style.display='none';return;}

  // Formula: (curAvg*curQty + buyAt*X) / (curQty+X) = targetAvg
  // => X = curQty*(curAvg-targetAvg) / (targetAvg-buyAt)
  const denom=targetAvg-buyAt;
  if(Math.abs(denom)<0.01){
    res.style.display='block';
    res.innerHTML=`<div style="text-align:center;color:#f59e0b;font-size:12px;">Buy At price same as Target Avg  -  no change possible</div>`;
    return;
  }
  if(targetAvg>=_acAvg && denom>0){
    res.style.display='block';
    res.innerHTML=`<div style="text-align:center;color:#f59e0b;font-size:12px;">Target avg must be less than current avg to average down</div>`;
    return;
  }

  const neededQty=Math.ceil(_acQty*(_acAvg-targetAvg)/denom);
  if(neededQty<=0){
    res.style.display='block';
    res.innerHTML=`<div style="text-align:center;color:#ef4444;font-size:12px;">Not possible at this buy price</div>`;
    return;
  }

  const extraInvest=neededQty*buyAt;
  const newQty=_acQty+neededQty;
  const actualNewAvg=(_acAvg*_acQty+buyAt*neededQty)/newQty;

  res.style.display='block';
  res.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:#4b6280;margin-bottom:8px;letter-spacing:0.5px;">RESULT</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">Qty to Buy</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#22c55e;">${neededQty}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">Total Qty after</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${newQty}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">Actual New Avg</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#38bdf8;">₹${actualNewAvg.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:#94a3b8;">Investment Needed</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#f59e0b;">${inr(extraInvest)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#94a3b8;">Total Investment</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">${inr(_acAvg*_acQty+extraInvest)}</span>
    </div>`;
}


// ======================================
// STOCK SCREENER
// ======================================
let screenerSource = 'watchlist'; // 'watchlist' | 'popular' | 'cached'
let screenerFilters = new Set();

function gainersSubTab(tab) {
  document.getElementById('gmovers').style.display = tab === 'movers' ? 'block' : 'none';
  document.getElementById('gscreener').style.display = tab === 'screener' ? 'block' : 'none';
  const mb = document.getElementById('gsub-movers');
  const sb = document.getElementById('gsub-screener');
  if(mb){ mb.style.background = tab==='movers'?'#1e3a5f':'#0f172a'; mb.style.color = tab==='movers'?'#38bdf8':'#94a3b8'; mb.style.borderColor = tab==='movers'?'#2d5a8e':'#1e2d3d'; }
  if(sb){ sb.style.background = tab==='screener'?'#1e3a5f':'#0f172a'; sb.style.color = tab==='screener'?'#38bdf8':'#94a3b8'; sb.style.borderColor = tab==='screener'?'#2d5a8e':'#1e2d3d'; }
  if(tab === 'screener') renderScreener();
}

async function screenerSetSource(s) {
  screenerSource = s;
  if(s === 'popular') {
    const el = document.getElementById('gscreener');
    if(el) el.innerHTML=`<div style="text-align:center;color:#4b6280;padding:20px;font-size:12px;">Fetching Nifty 50 data...</div>`;
    NIFTY50_STOCKS.forEach(sym=>{if(cache[sym]) cache[sym].time=0;});
    await batchFetchStocks(NIFTY50_STOCKS);
    }
  renderScreener();
}
function screenerToggleFilter(id) {
  if (screenerFilters.has(id)) {
    screenerFilters.delete(id);
  } else {
    screenerFilters.add(id);
   }
  renderScreener();
}
function renderScreener() {
  const el = document.getElementById('gscreener');
  if (!el) return;

  // Source stocks
  let sourceStocks = [];
  if (screenerSource === 'watchlist') sourceStocks = [...wl];
  else if (screenerSource === 'popular') sourceStocks = [...NIFTY50_STOCKS];
  else sourceStocks = Object.keys(cache).filter(k => cache[k]&&cache[k].data);

  // Filter chips HTML
  const filters = [
    {id:'pct3up', label:'+3% Today', color:'#22c55e'},
    {id:'pct3dn', label:'-3% Today', color:'#ef4444'},
    {id:'near52h', label:'Near 52W High', color:'#f59e0b'},
    {id:'near52l', label:'Near 52W Low', color:'#38bdf8'},
    {id:'volbkout', label:'Vol Breakout', color:'#a78bfa'},
  ];

  let html = '';

  // Source selector
  const srcBtns = ['watchlist','popular','cached'].map(s => {
    const active = screenerSource === s;
    const labels = {watchlist:'Watchlist', popular:'Nifty 50', cached:'All Cached'};
    return `<button onclick="screenerSetSource('${s}')" style="flex:1;padding:4px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid ${active?'#2d5a8e':'#1e2d3d'};background:${active?'#1e3a5f':'#0f172a'};color:${active?'#38bdf8':'#4b6280'};">${labels[s]}</button>`;
  }).join('');
  html += `<div style="display:flex;gap:4px;margin-bottom:8px;">${srcBtns}</div>`;

  // Filter chips
  html += `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">`;
  filters.forEach(f => {
    const active = screenerFilters.has(f.id);
    html += `<button onclick="screenerToggleFilter('${f.id}')" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid ${active?f.color:'#1e2d3d'};background:${active?f.color+'22':'#0f172a'};color:${active?f.color:'#4b6280'};">${f.label}</button>`;
  });
  html += `</div>`;

  // Apply filters
  let results = sourceStocks.map(sym => {
    const d = cache[sym]&&cache[sym].data;
    if (!d || !d.chartPreviousClose || !d.regularMarketPrice) return null;
    const price = d.regularMarketPrice;
    const prev = d.chartPreviousClose;
    const pct = ((price - prev) / prev * 100) || 0;
    const hi52 = d.fiftyTwoWeekHigh || 0;
    const lo52 = d.fiftyTwoWeekLow || 0;
    const vol = d.regularMarketVolume || 0;
    const avgVol = d.averageDailyVolume3Month || d.averageDailyVolume10Day || 0;
    return {sym, price, pct, hi52, lo52, vol, avgVol};
  }).filter(Boolean);

  if (screenerFilters.size > 0) {
    results = results.filter(r => {
      let pass = true;
      if (screenerFilters.has('pct3up') && r.pct < 3) pass = false;
      if (screenerFilters.has('pct3dn') && r.pct > -3) pass = false;
      if (screenerFilters.has('near52h') && r.hi52 > 0 && (r.hi52 - r.price) / r.hi52 * 100 > 3) pass = false;
      if (screenerFilters.has('near52l') && r.lo52 > 0 && (r.price - r.lo52) / r.lo52 * 100 > 3) pass = false;
      if (screenerFilters.has('volbkout') && (!r.avgVol || r.vol < r.avgVol * 1.5)) pass = false;
      return pass;
    });
  }

  // Sort by abs pct change
  results.sort((a,b) => Math.abs(b.pct) - Math.abs(a.pct));

  const noFilter = screenerFilters.size === 0;
  if (results.length === 0 || (noFilter && results.length === 0)) {
    html += `<div style="text-align:center;color:#4b6280;font-size:12px;padding:20px;">`;
    html += noFilter ? 'Select filters above to screen stocks' : 'No stocks match selected filters';
    html += `</div>`;
  } else {
    const showList = noFilter ? [] : results.slice(0, 30);
    if (noFilter) {
      html += `<div style="text-align:center;color:#4b6280;font-size:12px;padding:20px;">Select filters above to screen stocks</div>`;
    } else {
      html += `<div style="font-size:10px;color:#94a3b8;margin-bottom:6px;font-weight:700;">${showList.length} stocks matched</div>`;
      html += `<div style="background:#111827;border-radius:8px;overflow:hidden;">`;
      showList.forEach((r, i) => {
        const pctCol = r.pct >= 0 ? '#22c55e' : '#ef4444';
        const pctStr = (r.pct >= 0 ? '+' : '') + r.pct.toFixed(2) + '%';
        const near52h = r.hi52 > 0 && (r.hi52 - r.price) / r.hi52 * 100 <= 3;
        const near52l = r.lo52 > 0 && (r.price - r.lo52) / r.lo52 * 100 <= 3;
        const volBk = r.avgVol > 0 && r.vol >= r.avgVol * 1.5;
        let badges = '';
        if (near52h) badges += `<span style="font-size:8px;background:rgba(245,158,11,0.2);color:#f59e0b;padding:1px 4px;border-radius:3px;margin-left:3px;">52H</span>`;
        if (near52l) badges += `<span style="font-size:8px;background:rgba(56,189,248,0.2);color:#38bdf8;padding:1px 4px;border-radius:3px;margin-left:3px;">52L</span>`;
        if (volBk) badges += `<span style="font-size:8px;background:rgba(167,139,250,0.2);color:#a78bfa;padding:1px 4px;border-radius:3px;margin-left:3px;">VOL</span>`;
        html += `<div onclick="openDetail('${r.sym}',false)" style="display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:7px 10px;gap:6px;border-bottom:${i<showList.length-1?'1px solid rgba(255,255,255,0.04)':'none'};cursor:pointer;">
          <div><span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#e2e8f0;">${r.sym}</span>${badges}</div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;">₹${r.price.toFixed(2)}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${pctCol};text-align:right;">${pctStr}</span>
        </div>`;
      });
      html += `</div>`;
    }
  }

  el.innerHTML = html;
}


// ======================================
// SMART ALERT SUGGESTIONS
// ======================================
function renderSmartAlertSuggestions(sym, d) {
  const el = document.getElementById('smartAlertSection');
  if (!el || !d) return;
  const price = d.regularMarketPrice;
  const hi52 = d.fiftyTwoWeekHigh || 0;
  const lo52 = d.fiftyTwoWeekLow || 0;
  const suggestions = [];

  // Near 52W High (within 3%)
  if (hi52 > 0 && (hi52 - price) / hi52 * 100 <= 3) {
    suggestions.push({label:'Breakout: ₹' + hi52.toFixed(2), price: hi52, color:'#f59e0b', bg:'rgba(245,158,11,0.15)'});
  }
  // Near 52W Low (within 3%)
  if (lo52 > 0 && (price - lo52) / lo52 * 100 <= 3) {
    suggestions.push({label:'Support: ₹' + lo52.toFixed(2), price: lo52, color:'#38bdf8', bg:'rgba(56,189,248,0.15)'});
  }
  // Round number levels near current price
  const roundLevels = [50,100,200,250,500,750,1000,1500,2000,2500,3000,4000,5000,10000];
  roundLevels.forEach(r => {
    if (Math.abs(price - r) / price < 0.03 && r !== price) {
      suggestions.push({label:'Round: ₹' + r, price: r, color:'#a78bfa', bg:'rgba(167,139,250,0.12)'});
    }
  });
  // Holdings stop-loss (avg - 8%)
  const holding = (Array.isArray(h) ? h : []).find(hh => hh.sym === sym);
  if (holding) {
    const sl = (holding.avg * 0.92);
    suggestions.push({label:'Stop Loss: ₹' + sl.toFixed(2), price: parseFloat(sl.toFixed(2)), color:'#ef4444', bg:'rgba(239,68,68,0.12)'});
    const tgt = (holding.avg * 1.15);
    suggestions.push({label:'Target +15%: ₹' + tgt.toFixed(2), price: parseFloat(tgt.toFixed(2)), color:'#22c55e', bg:'rgba(34,197,94,0.12)'});
  }

  if (suggestions.length === 0) { el.innerHTML = ''; return; }

  // Filter already-set alerts
  const existingPrices = new Set(alerts.filter(a => a.sym === sym && !a.triggered).map(a => a.price));

  let html = '<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:0.5px;">SMART ALERT SUGGESTIONS</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px;">';
  suggestions.forEach(s => {
    const already = existingPrices.has(s.price);
    if (already) return;
    html += `<button onclick="setSmartAlert('${sym}',${s.price},this)" style="padding:5px 9px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid ${s.color}44;background:${s.bg};color:${s.color};">${s.label}</button>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function setSmartAlert(sym, price, btn) {
  alerts.push({sym: sym, price: price, triggered: false});
  localStorage.setItem('alerts', JSON.stringify(alerts));
  if (currentUser) saveUserData('alerts');
  if (btn) { btn.style.opacity='0.4'; btn.innerText = '✓ ' + btn.innerText; btn.disabled = true; }
  showPopup('Alert set: ' + sym + ' @ ₹' + price);
}


// ======================================
// FIREBASE SYNC (replaces GAS cloud sync)
// All data saved to Firestore via saveUserData()
// ======================================
var _syncInProgress = false;
var _syncDebounceTimer = null;
var _lastSyncTime = 0;

// Debounced auto-save — waits 2s after last change, field-aware
function triggerAutoSync(field) {
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => saveUserData(field), 2000);
}

// Manual "Upload to Cloud" button → Firebase save
async function pushToCloud(showMsg = true) {
  if (_syncInProgress) return;
  _syncInProgress = true;
  const syncBtn = document.getElementById('syncStatusBtn');
  if (syncBtn) { syncBtn.innerText = 'Saving...'; syncBtn.style.color = '#f59e0b'; }
  try {
    await saveUserData();
    _lastSyncTime = Date.now();
    localStorage.setItem('lastCloudSync', _lastSyncTime.toString());
    const lsd = document.getElementById('lastSyncDisplay');
    if (lsd) { const dt=new Date(_lastSyncTime); lsd.innerText=dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+' '+dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}); }
    if (syncBtn) { syncBtn.innerText = 'Saved ✓'; syncBtn.style.color = '#22c55e'; }
    if (showMsg) showPopup('Firebase sync complete ✓');
    setTimeout(() => { if (syncBtn) { syncBtn.innerText = 'Sync Now'; syncBtn.style.color = '#38bdf8'; } }, 3000);
  } catch(e) {
    if (syncBtn) { syncBtn.innerText = 'Sync Failed'; syncBtn.style.color = '#ef4444'; }
    if (showMsg) showPopup('Firebase sync failed');
    console.error('pushToCloud error:', e);
  }
  _syncInProgress = false;
}

// Manual "Download from Cloud" button → Firebase load
async function pullFromCloud(showMsg = false) {
  if (!currentUser) { if (showMsg) showPopup('Login required'); return; }
  const syncBtn = document.getElementById('syncStatusBtn');
  if (syncBtn) { syncBtn.innerText = 'Loading...'; syncBtn.style.color = '#f59e0b'; }
  try {
    const doc = await db.collection('users').doc(currentUser.userId).get();
    const data = doc.data();
    if (!data) { if (showMsg) showPopup('No data in Firebase'); return; }

    let changed = false;

    if (data.watchlists?.length) {
      watchlists = data.watchlists;
      localStorage.setItem('watchlists', JSON.stringify(watchlists));
      wl = watchlists[currentWL]?.stocks || [];
      localStorage.setItem('wl', JSON.stringify(wl));
      changed = true;
    }
    if (data.holdings?.length) {
      h = data.holdings;
      localStorage.setItem('h', JSON.stringify(h));
      changed = true;
    }
    if (data.history?.length) {
      hist = data.history;
      localStorage.setItem('hist', JSON.stringify(hist));
      changed = true;
    }
    if (data.alerts?.length) {
      alerts = data.alerts;
      localStorage.setItem('alerts', JSON.stringify(alerts));
      changed = true;
    }

    _lastSyncTime = Date.now();
    localStorage.setItem('lastCloudSync', _lastSyncTime.toString());
    const lsd = document.getElementById('lastSyncDisplay');
    if (lsd) { const dt=new Date(_lastSyncTime); lsd.innerText=dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+' '+dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}); }
    if (syncBtn) { syncBtn.innerText = 'Loaded ✓'; syncBtn.style.color = '#22c55e'; }
    setTimeout(() => { if (syncBtn) { syncBtn.innerText = 'Sync Now'; syncBtn.style.color = '#38bdf8'; } }, 3000);

    if (changed) {
      renderWLTabs();
      renderWL();
      renderHold();
      renderHist();
      if (showMsg) showPopup('Data loaded from Firebase ✓');
    } else {
      if (showMsg) showPopup('Firebase: no new data');
    }
  } catch(e) {
    if (syncBtn) { syncBtn.innerText = 'Load Error'; syncBtn.style.color = '#ef4444'; }
    if (showMsg) showPopup('Firebase load error');
    console.error('pullFromCloud error:', e);
  }
}


// ======================================
// FONT SIZE CONTROL
// ======================================
function setFontSize(size) {
  document.documentElement.setAttribute('data-fsize', size);
  localStorage.setItem('fontSize', size);
  // Update button states
  ['small','medium','large'].forEach(s => {
    const btn = document.getElementById('fs-'+s);
    if(btn) {
      btn.style.background = s===size ? '#1e3a5f' : '#0f172a';
      btn.style.color = s===size ? '#38bdf8' : '#4b6280';
      btn.style.borderColor = s===size ? '#2d5a8e' : '#1e2d3d';
    }
  });
}

// ======================================
// INIT
// ======================================

// ======================================
// 🤖 Ask Nivi — Chat UI v3
// ======================================
let _niviCurrentSym = '';
let _niviSpeaking   = false;
let _niviUtterance  = null;
let _niviChatHistory = [];   // [{role:'user'|'nivi', text, ts}]
let _niviMicActive  = false;
let _niviRecognition = null;
const NIVI_CACHE_MS = 30 * 60 * 1000;

// --- BUILD WATCHLIST CONTEXT STRING ---
function _niviWatchlistCtx() {
  return wl.slice(0, 12).map(s => {
    const d = cache[s] && cache[s].data;
    if (!d) return null;
    const diff = d.regularMarketPrice - d.chartPreviousClose;
    const pct  = ((diff / d.chartPreviousClose) * 100).toFixed(2);
    return `${s}: ₹${d.regularMarketPrice.toFixed(2)} (${diff>=0?'+':''}${pct}%)`;
  }).filter(Boolean).join(', ');
}

// --- OPEN NIVI MODAL ---
async function openNivi(sym) {
  const modal = document.getElementById('niviModal');
  modal.style.display = 'flex';
  document.getElementById('nivi-sym-label').innerText = sym;
  document.getElementById('nivi-price-row').style.display = 'none';
  document.getElementById('nivi-tech-row').style.display  = 'none';
  niviStop();

  // If same stock already open with chat history — just re-render, don't refetch
  if (_niviCurrentSym === sym && _niviChatHistory.length > 0) {
    _niviRenderChat();
    return;
  }

  // New stock — clear previous chat, try restoring from Firebase first
  _niviCurrentSym = sym;
  _niviChatHistory = [];
  _niviRenderChat();

  // Try restoring persisted chat from Firebase (non-blocking)
  const restored = await _niviLoadPersistedChat(sym);
  if (restored) {
    // Add a subtle "restored" indicator then proceed to fresh analysis below
    // (Firebase chat loaded — still fetch fresh price analysis)
  }

  // ── Check Nivi analysis cache (Firebase-first, localStorage fallback) ──
  const cacheKey = 'niviCache_' + sym;
  const _serveCached = (cached) => {
    _niviShowLoading(false);
    if (cached.direct) {
      _niviAddBubble('nivi', _niviFormatBullets(cached.answer));
    } else {
      _niviApplyPriceAndTech(cached.data);
      const ans = cached.data?.niviAdvice?.answer || '';
      if (ans.trim()) _niviAddBubble('nivi', _niviFormatBullets(ans));
      else _niviAddBubble('nivi', '⚠️ Nivi ko is stock ka vishleshan nahi mila. Thodi der baad dobara koshish karein.');
    }
  };
  // 1. Firebase cache (cross-device, survives WebView clear)
  if (currentUser) {
    try {
      const fbDoc = await db.collection('niviCache').doc(sym).get();
      if (fbDoc.exists) {
        const fbCached = fbDoc.data();
        if (fbCached && (Date.now() - fbCached.ts) < NIVI_CACHE_MS) {
          _serveCached(fbCached); return;
        }
      }
    } catch(e) { /* fallthrough to localStorage */ }
  }
  // 2. localStorage fallback
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && (Date.now() - cached.ts) < NIVI_CACHE_MS) {
      _serveCached(cached); return;
    }
  } catch(e) {}

  _niviShowLoading(true);

  // ── PRIMARY: Direct Gemini (browser → Gemini, no GAS cold start) ──
  const gemKey = localStorage.getItem('geminiApiKey');
  if (gemKey) {
    const cd = cache[sym] && cache[sym].data;
    if (cd) {
      const diff = cd.regularMarketPrice - cd.chartPreviousClose;
      const pct  = ((diff / cd.chartPreviousClose) * 100).toFixed(2);
      const prompt =
`\u0906\u092a '\u0928\u093f\u0935\u0940' \u0939\u0948\u0902 \u2014 \u090f\u0915 \u0935\u093f\u0936\u0947\u0937\u091c\u094d\u091e \u092d\u093e\u0930\u0924\u0940\u092f \u0936\u0947\u092f\u0930 \u092c\u093e\u091c\u093c\u093e\u0930 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0915\u0964
\u0938\u094d\u091f\u0949\u0915: ${sym}
CMP: \u20b9${cd.regularMarketPrice?.toFixed(2)} (${diff>=0?'+':''}${pct}%)
\u0926\u093f\u0928 \u0915\u093e \u0909\u091a\u094d\u091a: \u20b9${cd.regularMarketDayHigh?.toFixed(2)} | \u0928\u093f\u092e\u094d\u0928: \u20b9${cd.regularMarketDayLow?.toFixed(2)}
52 \u0938\u092a\u094d\u0924\u093e\u0939 \u0909\u091a\u094d\u091a: \u20b9${cd.fiftyTwoWeekHigh?.toFixed(2)} | \u0928\u093f\u092e\u094d\u0928: \u20b9${cd.fiftyTwoWeekLow?.toFixed(2)}
Volume: ${cd.regularMarketVolume?.toLocaleString('en-IN') || 'N/A'}
\u0915\u0947\u0935\u0932 \u0936\u0941\u0926\u094d\u0927 \u0939\u093f\u0902\u0926\u0940 \u0926\u0947\u0935\u0928\u093e\u0917\u0930\u0940 \u092e\u0947\u0902 4 bullet points \u0926\u0940\u091c\u093f\u090f\u0964 Roman script \u092c\u093f\u0932\u0915\u0941\u0932 \u0928\u0939\u0940\u0902\u0964 Bullet format: \u2022 [\u0935\u093e\u0915\u094d\u092f]`;
      const resp = await directGeminiCall(prompt);
      _niviShowLoading(false);
      if (resp && resp.ok) {
        // Cache to localStorage + Firebase
        const _cacheObj = { ts: Date.now(), direct: true, answer: resp.answer };
        localStorage.setItem(cacheKey, JSON.stringify(_cacheObj));
        if (currentUser) db.collection('niviCache').doc(sym).set(_cacheObj).catch(()=>{});
        _niviAddBubble('nivi', _niviFormatBullets(resp.answer));
        return;
      }
    }
  }

  // ── FALLBACK: GAS route (backward compatible) ──
  let _niviData = null, _gasErr = null;
  const _niviUrls = [
    API_NIVI,
    localStorage.getItem('customAPI2') || API2,
    localStorage.getItem('customAPI3') || API3
  ].filter(Boolean);

  for (const _nu of _niviUrls) {
    if (_niviData) break;
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 25000);
      const r    = await fetch(`${_nu}?type=askNivi&s=${encodeURIComponent(sym)}.NS`, {signal: ctrl.signal});
      clearTimeout(tid);
      const data = await r.json();
      if (data.ok) _niviData = data;
      else _gasErr = new Error(data.error || 'GAS error');
    } catch(e) { _gasErr = e; }
  }

  _niviShowLoading(false);

  if (_niviData) {
    const _gasCacheObj = { ts: Date.now(), direct: false, data: _niviData };
    localStorage.setItem(cacheKey, JSON.stringify(_gasCacheObj));
    if (currentUser) db.collection('niviCache').doc(sym).set(_gasCacheObj).catch(()=>{});
    _niviApplyPriceAndTech(_niviData);
    _niviAddBubble('nivi', _niviFormatBullets(_niviData.niviAdvice?.answer || ''));
  } else {
    _niviAddBubble('nivi', '\u26a0\ufe0f ' + (_gasErr?.message || 'API failed') + (gemKey ? '' : '\nSettings \u2192 Gemini API Key add karo.'));
  }
}

// --- SEND USER MESSAGE (text input / chip) ---
async function niviSend() {
  const inp = document.getElementById('nivi-input');
  const q   = (inp ? inp.value.trim() : '');
  if (!q) return;
  if (inp) inp.value = '';
  await _niviAskQuestion(q);
}

async function niviChip(question) {
  await _niviAskQuestion(question);
}

async function _niviAskQuestion(question) {
  // Add user bubble immediately for instant feedback
  _niviAddBubble('user', question);

  // ── Build multi-turn context (last 6 messages = 3 exchanges) ──
  const historyWindow = _niviChatHistory.slice(-6);  // last 6 entries incl. current user msg
  const conversationCtx = historyWindow.slice(0, -1)  // exclude the message we just added
    .map(m => `${m.role === 'user' ? 'User' : 'Nivi'}: ${m.text}`)
    .join('\n');

  // Build stock context from live cache
  const wlCtx    = _niviWatchlistCtx();
  const today    = new Date().toLocaleDateString('hi-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  const stockCtx = _niviCurrentSym ? (() => {
    const d = cache[_niviCurrentSym] && cache[_niviCurrentSym].data;
    if (!d) return '';
    const diff = d.regularMarketPrice - d.chartPreviousClose;
    const pct  = ((diff / d.chartPreviousClose) * 100).toFixed(2);
    const f    = window._firebaseFundCache && window._firebaseFundCache[_niviCurrentSym];
    const pe   = f ? (f.pe || f.trailingPE || 'N/A') : 'N/A';
    const eps  = f ? (f.eps || f.epsTrailingTwelveMonths || 'N/A') : 'N/A';
    return `\nStock Context (${_niviCurrentSym}):` +
      `\n  CMP: ₹${d.regularMarketPrice?.toFixed(2)} (${diff >= 0 ? '+' : ''}${pct}%)` +
      `\n  Day H/L: ₹${d.regularMarketDayHigh?.toFixed(2)} / ₹${d.regularMarketDayLow?.toFixed(2)}` +
      `\n  52W H/L: ₹${d.fiftyTwoWeekHigh?.toFixed(2)} / ₹${d.fiftyTwoWeekLow?.toFixed(2)}` +
      `\n  P/E: ${pe} | EPS: ${eps}` +
      `\n  Volume: ${d.regularMarketVolume?.toLocaleString('en-IN') || 'N/A'}`;
  })() : '';

  // ── Compose multi-turn prompt ──
  const hasPriorTurns = conversationCtx.trim().length > 0;
  const prompt =
`Aap 'Nivi' hain — ek expert Indian stock market analyst.
Sirf shuddh Hindi Devanagari mein jawab dijiye. Koi English, Roman script, disclaimer ya emoji nahi.
Aaj: ${today}
User ki watchlist: ${wlCtx || 'N/A'}${stockCtx}
${hasPriorTurns ? `\nPichli baatcheet:\n${conversationCtx}` : ''}
User: ${question}

Max 4 lines. Data-backed. Seedha jawab.`;

  _niviShowLoading(true);

  let answer = null;

  // 1. Direct Gemini — multi-turn contents array
  const gemKey = localStorage.getItem('geminiApiKey');
  if (gemKey) {
    const resp = await directGeminiCallMultiTurn(historyWindow.slice(0, -1), prompt);
    if (resp && resp.ok) answer = resp.answer;
  }

  // 2. GAS fallback (single-turn)
  if (!answer) {
    const _nu = localStorage.getItem('customAPI') || API_NIVI;
    try {
      const r    = await fetch(`${_nu}?type=askMarket&prompt=${encodeURIComponent(prompt)}`);
      const data = await r.json();
      answer = data.answer || data.text || data.summary || null;
    } catch(e) {}
  }

  _niviShowLoading(false);

  const finalAnswer = answer || '⚠️ Nivi jawab nahi de payi. Settings → Gemini API key check karo.';
  _niviAddBubble('nivi', finalAnswer);

  // ── Persist chat to Firebase (debounced, non-blocking) ──
  _niviPersistChat();
}

// ── Multi-turn Gemini call — sends conversation history as contents array ──
async function directGeminiCallMultiTurn(priorHistory, currentPrompt) {
  const key1 = localStorage.getItem('geminiApiKey');
  const key2 = localStorage.getItem('geminiApiKey2');
  const keys  = [key1, key2].filter(Boolean);
  if (keys.length === 0) return { ok: false, error: 'No API key' };

  const models = ['gemini-2.0-flash'];

  // Build Gemini contents array from prior history + current prompt
  const contents = [];
  // System message as first user turn (Gemini doesn't support system role in v1beta)
  contents.push({
    role: 'user',
    parts: [{ text: 'Aap Nivi hain — Indian stock market expert. Sirf shuddh Hindi Devanagari mein jawab dijiye.' }]
  });
  contents.push({ role: 'model', parts: [{ text: 'समझ गई। मैं निवी हूँ। शुद्ध हिंदी में जवाब दूँगी।' }] });

  // Inject prior conversation turns
  for (const msg of priorHistory) {
    if (!msg.text || !msg.text.trim()) continue;
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  }

  // Current question as final user turn
  contents.push({ role: 'user', parts: [{ text: currentPrompt }] });

  for (const k of keys) {
    for (const model of models) {
      try {
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=`
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });
        const j = await r.json();
        if (j.candidates && j.candidates[0]) {
          return { ok: true, answer: j.candidates[0].content.parts[0].text, model };
        }
        if (j.error) {
          console.warn(`Gemini multi-turn error (${model}):`, j.error.message);
          if (j.error.code === 400 || j.error.code === 429) break;
        }
      } catch(e) { console.warn('Gemini multi-turn network error:', e.message); }
    }
  }
  return { ok: false, error: 'All Gemini models failed' };
}

// ── Persist Nivi chat history to Firebase (debounced 3s) ──
let _niviPersistTimer = null;
function _niviPersistChat() {
  if (!currentUser || !_niviCurrentSym) return;
  if (_niviPersistTimer) clearTimeout(_niviPersistTimer);
  _niviPersistTimer = setTimeout(async () => {
    try {
      // Keep last 20 messages to avoid large writes
      const toSave = _niviChatHistory.slice(-20).map(m => ({
        role: m.role, text: m.text, ts: m.ts
      }));
      await db.collection('users').doc(currentUser.userId)
        .collection('niviChats').doc(_niviCurrentSym)
        .set({ messages: toSave, updatedAt: Date.now() });
    } catch(e) { /* silent — chat persist is best-effort */ }
  }, 3000);
}

// ── Load persisted Nivi chat from Firebase ──
async function _niviLoadPersistedChat(sym) {
  if (!currentUser) return false;
  try {
    const doc = await db.collection('users').doc(currentUser.userId)
      .collection('niviChats').doc(sym).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.messages && data.messages.length > 0) {
        // Only restore if last message < 4 hours old
        const age = Date.now() - (data.updatedAt || 0);
        if (age < 4 * 60 * 60 * 1000) {
          _niviChatHistory = data.messages;
          _niviRenderChat();
          return true;
        }
      }
    }
  } catch(e) { /* silent */ }
  return false;
}

// --- MIC TOGGLE ---
function niviMicToggle() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    showPopup('Voice input not supported on this browser'); return;
  }
  if (_niviMicActive) {
    if (_niviRecognition) _niviRecognition.stop();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _niviRecognition = new SR();
  _niviRecognition.lang = 'hi-IN';
  _niviRecognition.interimResults = false;
  _niviRecognition.maxAlternatives = 1;

  _niviMicActive = true;
  document.getElementById('nivi-mic-btn').style.background    = '#7f1d1d';
  document.getElementById('nivi-mic-btn').style.borderColor   = '#ef4444';
  document.getElementById('nivi-mic-status').style.display    = 'block';

  _niviRecognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const inp = document.getElementById('nivi-input');
    if (inp) inp.value = transcript;
  };
  _niviRecognition.onend = () => {
    _niviMicActive = false;
    document.getElementById('nivi-mic-btn').style.background  = '#0f2a1a';
    document.getElementById('nivi-mic-btn').style.borderColor = '#065f46';
    document.getElementById('nivi-mic-status').style.display  = 'none';
    // Auto send after mic stops
    const inp = document.getElementById('nivi-input');
    if (inp && inp.value.trim()) niviSend();
  };
  _niviRecognition.onerror = () => {
    _niviMicActive = false;
    document.getElementById('nivi-mic-btn').style.background  = '#0f2a1a';
    document.getElementById('nivi-mic-status').style.display  = 'none';
  };
  _niviRecognition.start();
}

// --- CHAT HELPERS ---
function _niviAddBubble(role, text, ts) {
  if (!text) return;
  _niviChatHistory.push({ role, text, ts: ts || Date.now() });
  _niviRenderChat();
}

function _niviRenderChat() {
  const area = document.getElementById('nivi-chat-area');
  if (!area) return;

  let html = '';
  _niviChatHistory.forEach(msg => {
    if (msg.role === 'user') {
      html += `<div style="display:flex;justify-content:flex-end;">
        <div style="background:#1e3a5f;color:#e2e8f0;border-radius:14px 14px 2px 14px;padding:9px 13px;max-width:80%;font-size:12px;line-height:1.6;font-family:'Noto Sans Devanagari','Mangal',sans-serif;word-break:normal;overflow-wrap:break-word;">${msg.text}</div>
      </div>`;
    } else {
      html += `<div style="display:flex;justify-content:flex-start;gap:7px;align-items:flex-start;">
        <div style="width:24px;height:24px;border-radius:50%;border:1.5px solid #34d399;background:#0a1628;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
          <svg viewBox="0 0 28 28" width="14" height="14" fill="none"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z" fill="#34d399"/></svg>
        </div>
        <div style="background:linear-gradient(135deg,#0a2218,#0f2a1a);border:1px solid rgba(52,211,153,0.2);color:#e2e8f0;border-radius:2px 14px 14px 14px;padding:10px 13px;max-width:85%;font-size:13px;line-height:1.8;font-family:'Noto Sans Devanagari','Mangal',sans-serif;word-break:normal;overflow-wrap:break-word;">${msg.text}</div>
      </div>`;
    }
  });

  area.innerHTML = html + '<div id="nivi-loading" style="text-align:center;padding:16px 0;display:none;"><div class="spinner" style="margin:0 auto 6px;"></div><div style="font-size:11px;color:#4b6280;font-family:\'Rajdhani\',sans-serif;">Nivi सोच रही है...</div></div>';
  // Scroll to bottom
  area.scrollTop = area.scrollHeight;
}

function _niviShowLoading(show) {
  // Re-render chat first to ensure loading div exists
  _niviRenderChat();
  const el = document.getElementById('nivi-loading');
  if (el) el.style.display = show ? 'block' : 'none';
  if (show) {
    const area = document.getElementById('nivi-chat-area');
    if (area) area.scrollTop = area.scrollHeight;
  }
}

function _niviFormatBullets(text) {
  if (!text) return '';
  return text.split('\n').filter(l => l.trim()).map(line => {
    const clean = line.replace(/^[•\-\*]\s*/, '').trim();
    return clean ? '• ' + clean : '';
  }).filter(Boolean).join('\n');
}

function _niviApplyPriceAndTech(data) {
  const f = data.fundamental || {};
  if (f.price) {
    document.getElementById('nivi-price-row').style.display = 'block';
    document.getElementById('nivi-price').innerText = '₹' + f.price;
    const chg = f.changePct ? (f.changePct >= 0 ? '+' : '') + f.changePct.toFixed(2) + '%' : '--';
    const chgEl = document.getElementById('nivi-change');
    chgEl.innerText = chg + (f.change ? '  ₹' + Math.abs(f.change).toFixed(2) : '');
    chgEl.style.color = (f.changePct >= 0) ? '#22c55e' : '#ef4444';
  }
  const rec = data.recommendation || {};
  const badgeEl = document.getElementById('nivi-rec-badge');
  if (rec.signal) {
    const cfg = {BUY:{bg:'#166534',color:'#86efac',text:'🟢 BUY'},HOLD:{bg:'#713f12',color:'#fde68a',text:'🟡 HOLD'},SELL:{bg:'#7f1d1d',color:'#fca5a5',text:'🔴 SELL'}}[rec.signal] || {bg:'#713f12',color:'#fde68a',text:'🟡 HOLD'};
    badgeEl.style.background = cfg.bg; badgeEl.style.color = cfg.color; badgeEl.innerText = cfg.text; badgeEl.style.display = 'block';
  }
  const t = data.technical || {};
  const macdColor = (t.macd != null && t.signal != null) ? (t.macd > t.signal ? '#22c55e' : '#ef4444') : '#94a3b8';
  const indicators = [
    {label:'RSI',   val: t.rsi14 != null ? t.rsi14.toFixed(1) : '--', color: t.rsi14 < 35 ? '#22c55e' : t.rsi14 > 70 ? '#ef4444' : '#f59e0b'},
    {label:'MACD',  val: t.macd  != null ? (t.macd>0?'+':'')+t.macd.toFixed(2) : '--', color: macdColor},
    {label:'MA20',  val: t.ma20  ? '₹'+t.ma20 : '--', color: f.price > t.ma20 ? '#22c55e' : '#ef4444'},
    {label:'MA50',  val: t.ma50  ? '₹'+t.ma50 : '--', color: f.price > t.ma50 ? '#22c55e' : '#ef4444'},
    {label:'52W%',  val: t.week52Pos != null ? t.week52Pos+'%' : '--', color:'#94a3b8'},
    {label:'VOL',   val: t.volRatio ? t.volRatio+'x' : '--', color: t.volRatio > 1.5 ? '#22c55e' : '#94a3b8'}
  ];
  const techEl = document.getElementById('nivi-tech-row');
  techEl.style.display = 'flex';
  techEl.innerHTML = indicators.map(i =>
    `<div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:5px;padding:3px 6px;text-align:center;flex-shrink:0;">
      <div style="font-size:7px;color:#4b6280;font-weight:700;">${i.label}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:${i.color};">${i.val}</div>
    </div>`
  ).join('');
}

function niviClearChat() {
  _niviChatHistory = [];
  const area = document.getElementById('nivi-chat-area');
  if (area) area.innerHTML = '<div id="nivi-loading" style="text-align:center;padding:16px 0;display:none;"></div>';
  // Clear Firebase persisted chat too
  if (currentUser && _niviCurrentSym) {
    db.collection('users').doc(currentUser.userId)
      .collection('niviChats').doc(_niviCurrentSym)
      .delete().catch(() => {});
  }
}

// --- CLOSE ---
function closeNivi() {
  niviStop();
  if (_niviMicActive && _niviRecognition) _niviRecognition.stop();
  document.getElementById('niviModal').style.display = 'none';
}

// --- SPEAK (Text-to-Speech) ---
// ============================================================
// GEMINI KEY MANAGEMENT
// ============================================================
// ============================================================
// GOOGLE SHEETS INTEGRATION — Settings + fetchFundamentals/fetchHistory override
// ============================================================
const DEFAULT_SHEET_ID = '1INjKSkOkXYF4y1DDorsCCFIYu0lBkEJTmLupJ6y9i8U';

function getSheetId(){ return localStorage.getItem('sheetId') || DEFAULT_SHEET_ID; }
function isSheetEnabled(){ return localStorage.getItem('sheetEnabled') === 'true'; }

function startSheetEdit(){
  const inp = document.getElementById('sheet-id-input');
  if(inp) inp.value = getSheetId();
  document.getElementById('sheet-id-edit').style.display = 'block';
  document.getElementById('changeSheetBtn').style.display = 'none';
}
function cancelSheetEdit(){
  document.getElementById('sheet-id-edit').style.display = 'none';
  document.getElementById('changeSheetBtn').style.display = 'inline-block';
}
function saveSheetId(){
  const val = document.getElementById('sheet-id-input').value.trim();
  if(!val){ showPopup('Sheet ID cannot be empty'); return; }
  localStorage.setItem('sheetId', val);
  if (currentUser) saveUserData('settings');
  document.getElementById('sheet-id-display').innerText = val;
  cancelSheetEdit();
  showPopup('Sheet ID saved!');
}
function toggleSheetIntegration(enabled){
  localStorage.setItem('sheetEnabled', enabled ? 'true' : 'false');
  updateSheetStatus();
  showPopup(enabled ? '✅ Sheet Integration ON — Fundamentals & History use Google Sheets' : 'Sheet Integration OFF');
}
function clearFundCache(){
  let count = 0;
  Object.keys(localStorage).forEach(k => {
    if(k.startsWith('fundCache')) { localStorage.removeItem(k); count++; }
  });
  showPopup('🗑️ Fund cache cleared! (' + count + ' stocks) — Reload stock to refresh.');
}
function updateSheetStatus(){
  const el = document.getElementById('sheet-status');
  if(!el) return;
  const on = isSheetEnabled();
  el.innerHTML = on
    ? '<span style="color:#34d399;">✅ Active — PE/EPS/MarketCap/BookValue/History via Sheets | Price+Volume = Yahoo ⚡</span>'
    : '<span style="color:#4b6280;">Disabled — using Yahoo Finance API</span>';
}

// Fundamentals fetch — Firestore "fundamentals" collection (GAS fundSheet REMOVED)
// Priority: 1) in-memory cache (preloaded at startup) → 2) Firestore direct read
async function fetchFundSheet(sym){
  const cleanSym = sym.replace(/\.NS$/i,'').replace(/\.BO$/i,'').toUpperCase();
  // 1. In-memory cache (populated by preloadAllFundamentalsFromFirebase at startup)
  if(window._firebaseFundCache && window._firebaseFundCache[cleanSym]){
    const raw = window._firebaseFundCache[cleanSym];
    return { pe: raw.pe, eps: raw.eps, marketCap: raw.marketCap,
             bookValue: raw.bookValue, high52: raw.high52, low52: raw.low52 };
  }
  // 2. Firestore direct read (stock not in preload cache yet)
  try{
    const doc = await db.collection('fundamentals').doc(cleanSym).get();
    if(!doc.exists) return null;
    const d = doc.data();
function fsVal(f){
        if(f === null || f === undefined) return null;
        // Compat SDK returns plain values directly
        if(typeof f === 'number') return f;
        if(typeof f === 'string') return parseFloat(f) || null;
        // REST API format
        if(f.doubleValue !== undefined) return f.doubleValue;
        if(f.integerValue !== undefined) return Number(f.integerValue);
        if(f.nullValue !== undefined) return null;
        return f.stringValue ? parseFloat(f.stringValue) || null : null;
      }
    // Store in memory for next call
    window._firebaseFundCache = window._firebaseFundCache || {};
function safeNum(v){ return (v===null||v===undefined||isNaN(Number(v)))?null:Number(v); }
window._firebaseFundCache[cleanSym] = {
  pe: safeNum(d.pe), eps: safeNum(d.eps), marketCap: safeNum(d.marketCap),
  bookValue: safeNum(d.bookValue), high52: safeNum(d.high52), low52: safeNum(d.low52),
  _source: 'firestore_direct', _ts: Date.now()
};
    const raw = window._firebaseFundCache[cleanSym];
    return { pe: raw.pe, eps: raw.eps, marketCap: raw.marketCap,
             bookValue: raw.bookValue, high52: raw.high52, low52: raw.low52 };
  }catch(e){ return null; }
}

// History fetch — Firestore "histcache" collection (GAS histSheet REMOVED)
// Reads cached 200d history pushed daily by GAS 9AM trigger
async function fetchHistSheet(sym){
  const cleanSym = sym.replace(/\.NS$/i,'').replace(/\.BO$/i,'').toUpperCase();
  // 1. In-memory cache (avoid repeat Firestore reads in same session)
  if(window._firebaseHistCache && window._firebaseHistCache[cleanSym]){
    return window._firebaseHistCache[cleanSym];
  }
  // 2. Firestore direct read from histcache collection
  try{
    const doc = await db.collection('histcache').doc(cleanSym).get();
    if(!doc.exists) return null;
    const d = doc.data();
    function fsVal(f){
      if(!f) return null;
      if(f.doubleValue !== undefined) return f.doubleValue;
      if(f.integerValue !== undefined) return Number(f.integerValue);
      if(f.nullValue !== undefined) return null;
      return f.stringValue ?? null;
    }
    const dataStr = fsVal(d.data);
    if(!dataStr) return null;
    const parsed = JSON.parse(dataStr);
    if(!parsed.close || parsed.close.length < 14) return null;
    // Validate freshness — within 7 days
    const lastDate = parsed.dates && parsed.dates[parsed.dates.length - 1];
    const lastMs   = lastDate ? new Date(lastDate).getTime() : 0;
    if(lastMs && (Date.now() - lastMs) > 7 * 86400000) return null; // stale
    const result = {
      dates: parsed.dates, close: parsed.close,
      open: parsed.close, high: parsed.close, low: parsed.close, volume: []
    };
    // Store in memory for rest of session
    window._firebaseHistCache = window._firebaseHistCache || {};
    window._firebaseHistCache[cleanSym] = result;
    return result;
  }catch(e){ return null; }
}

function saveGeminiKey(){
  const val=document.getElementById('set-gemini-key').value.trim();
  if(!val||!val.startsWith('AIza')){ showPopup('Invalid key — must start with AIza'); return; }
  localStorage.setItem('geminiApiKey',val);
  if (currentUser) saveUserData('settings');
  document.getElementById('gemini-key-status').innerHTML='<span style="color:#34d399;">✓ Key saved — Direct Gemini active</span>';
  document.getElementById('set-gemini-key').value='';
  showPopup('Gemini key saved ✓');
}
function saveGeminiKey2(){
  const val=document.getElementById('set-gemini-key2').value.trim();
  if(!val||!val.startsWith('AIza')){ showPopup('Invalid key — must start with AIza'); return; }
  localStorage.setItem('geminiApiKey2',val);
  document.getElementById('gemini-key2-status').innerHTML='<span style="color:#34d399;">✓ Key 2 saved — Fallback active</span>';
  document.getElementById('set-gemini-key2').value='';
  showPopup('Gemini Key 2 saved ✓');
}
function clearGeminiKey2(){
  localStorage.removeItem('geminiApiKey2');
  document.getElementById('set-gemini-key2').value='';
  document.getElementById('gemini-key2-status').innerHTML='<span style="color:#4b6280;">Key 2 cleared</span>';
  showPopup('Gemini Key 2 cleared');
}
function initGeminiKeyDisplay(){
  const k=localStorage.getItem('geminiApiKey');
  const el=document.getElementById('gemini-key-status');
  if(el) el.innerHTML=k
    ?'<span style="color:#34d399;">✓ Key saved ('+k.slice(0,8)+'...) — Direct Gemini active</span>'
    :'<span style="color:#4b6280;">No key saved — using GAS API only</span>';
}

// Smart Direct Gemini API call (Browser → Gemini)
async function directGeminiCall(prompt) {
  const key1 = localStorage.getItem('geminiApiKey');
  const key2 = localStorage.getItem('geminiApiKey2');
  const keys = [key1, key2].filter(Boolean);

  if (keys.length === 0) return { ok: false, error: 'API Key જ નથી! Settings માં જઈને નાખો.' };

  // બિનજરૂરી મોડેલ્સ કાઢી નાખ્યા. આ બે સૌથી ફાસ્ટ અને સ્ટેબલ છે.
  const models = ['gemini-2.0-flash-lite', 'gemini-2.0-flash',];

  for (const k of keys) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${k}`;
        
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const j = await r.json();

        // 1. જો જવાબ મળી જાય તો સીધો Return (લૂપ ખતમ) 🎉
        if (j.candidates && j.candidates[0]) {
          return { ok: true, answer: j.candidates[0].content.parts[0].text, model: model };
        }

        // 2. Smart Error Handling (લાલ કન્સોલ અટકાવવા) 🛡️
        if (j.error) {
          console.warn(`Gemini API Error (${model} | Key ...${k.slice(-4)}):`, j.error.message);
          
          // જો કી જ ખોટી હોય (400) અથવા કોટા પૂરો થયો હોય (429), 
          // તો આ કી માટે બીજા મોડેલને હેરાન કરવાનો કોઈ મતલબ નથી! લૂપ તોડો (Break).
          if (j.error.code === 400) {
            break; // Wrong model for this key, try next key
          }
          if (j.error.code === 429) {
            continue; // This model quota done, try next model
          }
        }
      } catch (e) { 
        console.warn('Gemini Network Error:', e.message); 
      }
    } // end model loop
  } // end keys loop

  return { ok: false, error: 'બધા પ્રયત્નો નિષ્ફળ! કદાચ Quota પૂરો થયો છે અથવા API Key ખોટી છે.' };
}
function expandTickersForSpeech(text) {
  if (!text) return text;
  // Hindi pronunciation overrides (for TTS naturalness)
  const hindiPron = { 'RELIANCE':'रिलायंस', 'TCS':'टी सी एस', 'INFY':'इन्फोसिस',
    'SBIN':'एस बी आई', 'HDFCBANK':'एच डी एफ सी बैंक', 'ITC':'आई टी सी', 'BLISSGVS':'ब्लिस जी वी एस' };
  // NSE ticker → full English spoken name mapping
  const tickerNames = {
    'SBIN':'State Bank of India','RELIANCE':'Reliance Industries','TCS':'Tata Consultancy Services',
    'INFY':'Infosys','WIPRO':'Wipro','HDFCBANK':'HDFC Bank','ICICIBANK':'ICICI Bank',
    'AXISBANK':'Axis Bank','KOTAKBANK':'Kotak Mahindra Bank','BAJFINANCE':'Bajaj Finance',
    'BAJAJFINSV':'Bajaj Finserv','BHARTIARTL':'Bharti Airtel','ITC':'ITC Limited',
    'HINDUNILVR':'Hindustan Unilever','ASIANPAINT':'Asian Paints','MARUTI':'Maruti Suzuki',
    'TATAMOTORS':'Tata Motors','TATASTEEL':'Tata Steel','NTPC':'NTPC Limited',
    'POWERGRID':'Power Grid','SUNPHARMA':'Sun Pharma','DRREDDY':'Dr Reddys',
    'CIPLA':'Cipla','DIVISLAB':'Divis Labs','APOLLOHOSP':'Apollo Hospitals',
    'LT':'Larsen and Toubro','LTIM':'LTI Mindtree','TECHM':'Tech Mahindra',
    'HCLTECH':'HCL Technologies','ONGC':'ONGC','COALINDIA':'Coal India',
    'ADANIENT':'Adani Enterprises','ADANIPORTS':'Adani Ports','ADANIGREEN':'Adani Green',
    'JSWSTEEL':'JSW Steel','HINDALCO':'Hindalco','ULTRACEMCO':'Ultratech Cement',
    'GRASIM':'Grasim Industries','NESTLEIND':'Nestle India','BRITANNIA':'Britannia',
    'PIDILITIND':'Pidilite','HAVELLS':'Havells','TITAN':'Titan Company',
    'DMART':'DMart','ZOMATO':'Zomato','NYKAA':'Nykaa','PAYTM':'Paytm',
    'IRCTC':'IRCTC','HAL':'HAL','BEL':'Bharat Electronics','BPCL':'BPCL',
    'IOC':'Indian Oil','GAIL':'GAIL India','TATAPOWER':'Tata Power',
    'NHPC':'NHPC','SJVN':'SJVN','RECLTD':'REC Limited','PFC':'Power Finance',
    'BANKBARODA':'Bank of Baroda','PNB':'Punjab National Bank','CANBK':'Canara Bank',
    'INDUSINDBK':'IndusInd Bank','FEDERALBNK':'Federal Bank','IDFCFIRSTB':'IDFC First Bank',
    'MUTHOOTFIN':'Muthoot Finance','CHOLAFIN':'Chola Finance','HDFCLIFE':'HDFC Life',
    'SBILIFE':'SBI Life','ICICIlombard':'ICICI Lombard','POLICYBZR':'Policy Bazaar',
    'AUROPHARMA':'Aurobindo Pharma','TORNTPHARM':'Torrent Pharma','LUPIN':'Lupin',
    'ALKEM':'Alkem Labs','MANKIND':'Mankind Pharma','PERSISTENT':'Persistent Systems',
    'MPHASIS':'Mphasis','COFORGE':'Coforge','KPITTECH':'KPIT Technologies',
    'DIXON':'Dixon Technologies','AMBER':'Amber Enterprises','KAYNES':'Kaynes Technology',
    'TRENT':'Trent','ABFRL':'ABFRL','PAGEIND':'Page Industries',
    'MOTHERSON':'Motherson Sumi','BOSCHLTD':'Bosch','BALKRISIND':'Balkrishna Industries',
    'ETERNAL':'Eternal','CPPLUS':'CP Plus','JKTYRE':'JK Tyre','MOIL':'MOIL',
    'FORCEMOT':'Force Motors','YATHARTH':'Yatharth Hospital'
  };
  // Replace each ticker (whole word, case-insensitive) with spoken name
  // Priority: Hindi pron → English full name → Title-case fallback
  let result = text.replace(/\b([A-Z]{2,12})(\.NS|\.BO)?\b/g, function(match, ticker) {
    if (hindiPron[ticker]) return hindiPron[ticker];
    if (tickerNames[ticker]) return tickerNames[ticker];
    // ALL CAPS fallback: speak as title-case so TTS doesn't spell each letter
    return ticker.charAt(0) + ticker.slice(1).toLowerCase();
  });
  return result;
}
function niviSpeak() {
  if (!window.speechSynthesis) { showPopup('TTS not supported'); return; }
  niviStop();
  const area = document.getElementById('nivi-chat-area');
  const rawText = area ? area.innerText.replace(/Nivi सोच रही है\.\.\./g,'').trim() : '';
  if (!rawText) return;
  const text = expandTickersForSpeech(rawText);

  _niviUtterance = new SpeechSynthesisUtterance(text);
  _niviUtterance.lang  = 'hi-IN';
  _niviUtterance.rate  = 0.82;
  _niviUtterance.pitch = 1.0;

  // Try Google Hindi voice
  // Female Hindi voice — priority order
  const voices = speechSynthesis.getVoices();
  const hiVoice =
    voices.find(v => v.lang === 'hi-IN' && /female|woman|lekha|aditi|riya|priya/i.test(v.name)) ||
    voices.find(v => v.lang === 'hi-IN' && v.name.includes('Google') && !/male/i.test(v.name)) ||
    voices.find(v => v.lang === 'hi-IN' && !/male/i.test(v.name)) ||
    voices.find(v => v.lang === 'hi-IN');
  if (hiVoice) _niviUtterance.voice = hiVoice;
  _niviUtterance.pitch = _getNiviPitch();
  _niviUtterance.rate  = _getNiviRate();

  _niviUtterance.onstart = () => {
    _niviSpeaking = true;
    document.getElementById('nivi-speak-btn').style.display = 'none';
    document.getElementById('nivi-stop-btn').style.display  = 'flex';
    document.getElementById('nivi-avatar-ring').style.boxShadow = '0 0 12px #34d399';
  };
  _niviUtterance.onend = _niviUtterance.onerror = () => {
    _niviSpeaking = false;
    document.getElementById('nivi-speak-btn').style.display = 'flex';
    document.getElementById('nivi-stop-btn').style.display  = 'none';
    document.getElementById('nivi-avatar-ring').style.boxShadow = 'none';
  };

  speechSynthesis.speak(_niviUtterance);
}

function niviStop() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  _niviSpeaking = false;
  const sb = document.getElementById('nivi-speak-btn');
  const st = document.getElementById('nivi-stop-btn');
  if (sb) sb.style.display = 'flex';
  if (st) st.style.display = 'none';
  const ring = document.getElementById('nivi-avatar-ring');
  if (ring) ring.style.boxShadow = 'none';
}

function niviCopy() {
  const text = document.getElementById('nivi-bullets')?.innerText || '';
  navigator.clipboard.writeText(text).then(() => showPopup('Nivi response copied!')).catch(() => showPopup('Copy failed'));
}

function niviRefresh() {
  // Clear cache for this stock and re-fetch
  const cacheKey = 'niviCache_' + _niviCurrentSym;
  localStorage.removeItem(cacheKey);
  openNivi(_niviCurrentSym);
}

// Close modal on backdrop tap
document.getElementById('niviModal').addEventListener('click', function(e) {
  if (e.target === this) closeNivi();
});

// Firebase check → Profile screen OR direct start
if (typeof db !== 'undefined') {
  initApp();
} else {
  startApp();
}

// ============================================================
// ✅ MARKET PULSE — Smart Signal Engine
// 1 batch API call = all watchlist stocks, every 5 min
// Cache: same signal blocked 30 min
// Only runs during market hours
// ============================================================
const MP_INTERVAL  = 5 * 60 * 1000;
const MP_SIG_TTL   = 30 * 60 * 1000;
const MP_CACHE_KEY = 'mp_sig_v2';

function mpLoadCache(){ try{ return JSON.parse(localStorage.getItem(MP_CACHE_KEY)||'{}'); }catch(e){ return {}; } }
function mpSaveCache(c){ try{ localStorage.setItem(MP_CACHE_KEY, JSON.stringify(c)); }catch(e){} }

function mpMarketOpen(){
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5*60*60*1000));
  const day = ist.getUTCDay();
  if(day===0||day===6) return false;
  const ds = ist.toISOString().split('T')[0];
  if(typeof isMarketHoliday==='function' && isMarketHoliday(ds)) return false;
  const mins = ist.getUTCHours()*60 + ist.getUTCMinutes();
  return mins >= 555 && mins <= 930;
}

async function mpCheck(){
  if(!mpMarketOpen()) return;
  const syms = (typeof wl!=='undefined' && wl.length>0)
    ? wl.map(s => s.includes('.')?s:s+'.NS') : ['SBIN.NS','RELIANCE.NS','TCS.NS'];
  const sigCache = mpLoadCache();
  const now = Date.now();
  const apiUrl = localStorage.getItem('customAPI') || (typeof API!=='undefined' ? API : '');
  if(!apiUrl) return;
  let results = [];
  try {
    const res  = await fetch(`${apiUrl}?type=batch&s=${encodeURIComponent(syms.join(','))}`);
    const data = await res.json();
    results = Array.isArray(data) ? data : Object.values(data||{});
  } catch(e){ return; }

  results.forEach(q => {
    if(!q) return;
    const sym     = (q.symbol||'').replace('.NS','').replace('.BO','');
    const price   = q.price || q.regularMarketPrice || 0;
    const chgPct  = parseFloat(q.changePct || q.regularMarketChangePercent || 0);
    const vol     = q.volume  || q.regularMarketVolume  || 0;
    const avgVol  = q.avgVolume || q.averageDailyVolume3Month || 0;
    if(!price || !sym) return;
    const volSpike = avgVol>0 && vol>avgVol*1.8;
    let signal = null;
    if(Math.abs(chgPct)>2.5 && volSpike) signal='STRONG';
    else if(Math.abs(chgPct)>2.5)        signal='MEDIUM';
    else if(volSpike && Math.abs(chgPct)>1.5) signal='WATCH';
    if(!signal) return;
    const ck = sym+'_'+signal;
    if(sigCache[ck] && (now-sigCache[ck])<MP_SIG_TTL) return;
    sigCache[ck] = now;
    const emoji = signal==='STRONG'?'🔥':signal==='MEDIUM'?'⚡':'👁️';
    const dir   = chgPct>=0?'▲':'▼';
    const msg   = `${emoji} ${sym}: ${signal} | ${dir}${Math.abs(chgPct).toFixed(2)}% | ₹${price.toFixed(2)}`;
    if(window.Android && typeof Android.notifyWithTitle==='function')
      Android.notifyWithTitle('📈 RealTradePro Alert', msg);
    if(typeof showPopup==='function') showPopup(msg);
  });
  mpSaveCache(sigCache);
}

function mpClean(){
  const c=mpLoadCache(); const now=Date.now(); let ch=false;
  Object.keys(c).forEach(k=>{ if(now-c[k]>MP_SIG_TTL){ delete c[k]; ch=true; } });
  if(ch) mpSaveCache(c);
}

// Start 90 sec after load, then every 5 min
setTimeout(()=>{ mpClean(); mpCheck(); setInterval(mpCheck, MP_INTERVAL); }, 90000);

// ============================================================
// NIVI NEWS SEARCH
// ============================================================
// ============================================================
// NIVI NEWS SEARCH & VOICE (UPDATED)
// ============================================================

// 2. niviNewsSpeak — uses expandTickersForSpeech defined above
function niviNewsSpeak() {
  if (!window.speechSynthesis) { showPopup('TTS not supported'); return; }
  speechSynthesis.cancel();
  
  var bullets = document.getElementById('niviNewsBullets');
  if (!bullets) return;
  var text = bullets.innerText.replace(/•/g, '').trim();
  if (!text) { showPopup('Pehle news search karo'); return; }

  // અહીંયા આપણે પેલું જાદુઈ ટૂલ વાપર્યું (શબ્દો સુધારવા માટે)
  text = expandTickersForSpeech(text);

  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'hi-IN';
  u.rate = 0.9;  // 0.85 કરતા થોડું ફાસ્ટ, જે નેચરલ લાગે
  u.pitch = 1.1; // અવાજમાં થોડી મીઠાશ અને નેચરલ ફીલ લાવવા માટે

  // સૌથી પહેલા Google નો પ્રીમિયમ અવાજ ગોતશે
  var voices = speechSynthesis.getVoices();
  var hv = voices.find(function(v){ return v.lang==='hi-IN' && v.name.includes('Google') && !/male/i.test(v.name); })
        || voices.find(function(v){ return v.lang==='hi-IN' && /female|woman|swara|lekha/i.test(v.name); })
        || voices.find(function(v){ return v.lang==='hi-IN' && !/male/i.test(v.name); })
        || voices.find(function(v){ return v.lang==='hi-IN'; });
        
  if (hv) u.voice = hv;

  var btn = document.getElementById('niviNewsSpeak');
  u.onstart = function(){ if(btn){ btn.textContent='⏹ Stop'; btn.onclick=function(){ speechSynthesis.cancel(); }; } };
  u.onend = u.onerror = function(){ if(btn){ btn.textContent='🔊 Sunao'; btn.onclick=niviNewsSpeak; } };
  
  speechSynthesis.speak(u);
}

async function niviNewsSearch() {
  var sym = (document.getElementById('niviNewsInput').value || '').trim().toUpperCase();
  if (!sym) { showPopup('Symbol daalo pehle! e.g. RELIANCE'); return; }

  document.getElementById('niviNewsLoading').style.display    = 'block';
  document.getElementById('niviNewsSummaryCard').style.display = 'none';
  document.getElementById('niviNewsError').style.display      = 'none';

  // ── STEP 1: GAS → fetch headlines only (CORS-safe) ──
  var headlines = [];
  try {
    var gasUrl = API_NIVI + '?type=newsSearch&s=' + encodeURIComponent(sym);
    var gasResp = await fetch(gasUrl);
    var gasData = await gasResp.json();
    if (!gasData.ok) throw new Error(gasData.error || 'GAS news fetch failed');
    headlines = gasData.headlines || gasData.items || [];
    _niviNewsHeadlines = headlines;
  } catch(err) {
    document.getElementById('niviNewsLoading').style.display = 'none';
    document.getElementById('niviNewsError').textContent = '\u274c News fetch failed: ' + err.toString();
    document.getElementById('niviNewsError').style.display = 'block';
    return;
  }

  if (!headlines.length) {
    document.getElementById('niviNewsLoading').style.display = 'none';
    document.getElementById('niviNewsError').textContent = '\u274c ' + sym + ' ke liye koi news nahi mili.';
    document.getElementById('niviNewsError').style.display = 'block';
    return;
  }

  // Show raw headlines immediately
  var hHtml = headlines.map(function(h, i) {
    return '<div style="padding:5px 0;border-bottom:1px solid #1e3a5f;">'
      + '<div style="font-weight:600;color:#94a3b8;font-size:11px;">'
      + (i+1) + '. ' + (h.title || h) + '</div>'
      + (h.date ? '<div style="color:#4b6280;font-size:10px;margin-top:2px;">' + h.date + '</div>' : '')
      + '</div>';
  }).join('') || '<div style="color:#4b6280;font-size:11px;">No headlines.</div>';
  document.getElementById('niviRawHeadlines').innerHTML = hHtml;
  document.getElementById('niviRawHeadlines').style.display = 'none';

  // Header
  document.getElementById('niviNewsSymLabel').textContent = '\ud83d\udcc8 ' + sym + ' \u2014 News Summary';
  document.getElementById('niviNewsMetaLabel').textContent =
    headlines.length + ' headlines analysed \u2022 ' +
    new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});

  // ── STEP 2: Browser → Gemini for Hindi AI sentiment ──
  var summaryHtml = '';
  const gemKey = localStorage.getItem('geminiApiKey');
  if (gemKey) {
    var headlineText = headlines.slice(0, 8).map(function(h,i){
      return (i+1) + '. ' + (h.title || h);
    }).join('\n');
    var sentimentPrompt =
`\u0906\u092a '\u0928\u093f\u0935\u0940' \u0939\u0948\u0902 \u2014 \u092d\u093e\u0930\u0924\u0940\u092f \u0936\u0947\u092f\u0930 \u092c\u093e\u091c\u093c\u093e\u0930 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0915\u0964
\u0938\u094d\u091f\u0949\u0915: ${sym}
\u0928\u0940\u091a\u0947 \u0928\u094d\u092f\u0942\u091c \u0939\u0947\u0921\u0932\u093e\u0907\u0928 \u0939\u0948\u0902:
${headlineText}

\u0907\u0928 \u0916\u092c\u0930\u094b\u0902 \u0915\u0947 \u0906\u0927\u093e\u0930 \u092a\u0930 \u0936\u0941\u0926\u094d\u0927 \u0939\u093f\u0902\u0926\u0940 \u0926\u0947\u0935\u0928\u093e\u0917\u0930\u0940 \u092e\u0947\u0902 4 bullet points \u0926\u0940\u091c\u093f\u090f:
1. \u0938\u092e\u0917\u094d\u0930 \u092d\u093e\u0935\u0928\u093e (\u0924\u0947\u091c\u0940/\u092e\u0902\u0926\u0940/\u0928\u093f\u0930\u092a\u0947\u0915\u094d\u0937)
2. \u092e\u0941\u0916\u094d\u092f \u0915\u093e\u0930\u0923
3. \u0928\u093f\u0935\u0947\u0936\u0915 \u0915\u094b \u0938\u0932\u093e\u0939
4. \u091c\u094b\u0916\u093f\u092e \u092f\u093e \u0905\u0935\u0938\u0930
Roman script \u092c\u093f\u0932\u0915\u0941\u0932 \u0928\u0939\u0940\u0902\u0964 Bullet format: \u2022 [\u0935\u093e\u0915\u094d\u092f]`;

    var resp = await directGeminiCall(sentimentPrompt);
    if (resp && resp.ok) {
      var lines = resp.answer.split('\n').filter(function(l){ return l.trim(); });
      summaryHtml = lines.map(function(line) {
        var clean = line.replace(/^[\u2022\-\*]\s*/, '').trim();
        if (!clean) return '';
        return '<div style="display:flex;gap:8px;margin-bottom:8px;">'
          + '<span style="color:#34d399;font-size:14px;flex-shrink:0;margin-top:1px;">\u2022</span>'
          + '<span style="font-family:\'Noto Sans Devanagari\',\'Mangal\',sans-serif;">' + clean + '</span></div>';
      }).join('');
    }
  }

  // Fallback: no Gemini key or call failed
  if (!summaryHtml) {
    summaryHtml = '<div style="color:#4b6280;font-size:12px;">'
      + (gemKey ? '\u26a0\ufe0f Gemini summary failed.' : '\u26a0\ufe0f Gemini key nahi — Settings mein add karo AI summary ke liye.')
      + '</div>';
  }

  document.getElementById('niviNewsBullets').innerHTML = summaryHtml;
  document.getElementById('niviNewsLoading').style.display = 'none';
  document.getElementById('niviNewsSummaryCard').style.display = 'block';
}

// ============================================================
// SEARCH & LEARN TAB
// Firebase: fundlearn collection (pushed daily by GAS)
// Fallback: GAS type=fundlearn direct fetch
// ============================================================

let _learnLang = localStorage.getItem('learnLang') || 'hi';
let _learnCache = {}; // sym -> raw data

// ── Language selector ─────────────────────────────────────
function setLearnLang(lang) {
  _learnLang = lang;
  localStorage.setItem('learnLang', lang);
  ['hi','gu','en'].forEach(l => {
    const btn = document.getElementById('ll-'+l);
    if (!btn) return;
    if (l === lang) {
      btn.style.background = 'rgba(251,146,60,0.2)';
      btn.style.color = '#fb923c';
      btn.style.borderColor = 'rgba(251,146,60,0.3)';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#64748b';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  });
  // Existing setLearnLang() function mā last part replace karo:
  const sym = (document.getElementById('learnSearchInput')||{}).value;
  if (sym && _learnCache[sym.toUpperCase().trim()]) {
    renderLearnReport(_learnCache[sym.toUpperCase().trim()], sym.toUpperCase().trim());
  }
}

function initLearnTab() {
  setLearnLang(_learnLang);
}

// ── Search suggestions (from existing wl + POPULAR_STOCKS) ─
function learnSearchSuggest(val) {
  const box = document.getElementById('learnSuggBox');
  if (!box) return;
  const v = val.trim().toUpperCase();
  if (v.length < 1) { box.style.display = 'none'; return; }
  const allSyms = [...new Set([...(typeof wl!=='undefined'?wl:[]), ...(typeof POPULAR_STOCKS!=='undefined'?POPULAR_STOCKS:[])])];
  const matches = allSyms.filter(s => s.toUpperCase().startsWith(v)).slice(0, 8);
  if (matches.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(s =>
    `<div onclick="document.getElementById('learnSearchInput').value='${s}';document.getElementById('learnSuggBox').style.display='none';fetchLearnStock();"
      style="padding:8px 14px;font-size:12px;font-weight:700;color:#e2e8f0;cursor:pointer;font-family:'Rajdhani',sans-serif;border-bottom:1px solid rgba(255,255,255,0.05);"
      onmouseover="this.style.background='rgba(251,146,60,0.1)'" onmouseout="this.style.background=''">${s}</div>`
  ).join('');
  box.style.display = 'block';
}

// [PHASE 2 INJECTION] Helper to fetch Technical Data (RSI) quietly
async function _enrichWithTechnicals(raw, sym) {
  // Firebase Realtime DB nathi — cache thi price history thi RSI approximate kariye
  try {
    // Yahoo Finance proxy thi recent closes fetch kariye
    const proxyBase = localStorage.getItem('customAPI2') || localStorage.getItem('customAPI') || (typeof API !== 'undefined' ? API : '');
    if (!proxyBase) { raw.rsi = null; return raw; }
    const r = await fetch(`${proxyBase}?type=ohlcv&s=${sym}&range=1mo&interval=1d`);
    if (!r.ok) throw new Error('ohlcv fetch failed');
    const data = await r.json();
    const closes = (data.closes || data.c || []);
    raw.rsi = closes.length >= 15 ? calculateLearnRSI(closes) : null;
  } catch(e) { raw.rsi = null; }
  return raw;
}

function calculateLearnRSI(c) {
  if (!c || c.length < 15) return null;
  let g = 0, l = 0;
  for (let i = 1; i < 15; i++) {
    let diff = c[i] - c[i-1];
    if (diff >= 0) g += diff; else l -= diff;
  }
  let rs = (g / 14) / (l / 14);
  return 100 - (100 / (1 + rs));
}

// ── Fetch data: Firebase first, GAS fallback ──────────────
async function fetchLearnStock() {
  const input = document.getElementById('learnSearchInput');
  const msg   = document.getElementById('learnMsg');
  const res   = document.getElementById('learnResults');
  if (!input) return;
  const sym = input.value.trim().toUpperCase();
  if (!sym) { if(msg) msg.textContent = 'Stock symbol daalo'; return; }
  document.getElementById('learnSuggBox').style.display = 'none';
  if (msg) { msg.textContent = '⏳ Loading Phase 1 & 2 Data...'; msg.style.color = '#64748b'; }
  if (res) res.innerHTML = '';

  // 1. Firebase fundlearn
  try {
    const doc = await firebase.firestore().collection('fundlearn').doc(sym).get();
    if (doc.exists) {
      const d = doc.data();
      function fv(f) {
        if (f === null || f === undefined) return 0;
        if (typeof f === "number") return f;
        if (typeof f === "string") return Number(f) || 0;
        if (f.doubleValue !== undefined) return Number(f.doubleValue);
        if (f.integerValue !== undefined) return Number(f.integerValue);
        return 0;
      }
      const raw = {
  sym, source: 'firebase',
  netProfit:   fv(d.netProfit),
  totalEquity: fv(d.totalEquity),
  totalShares: fv(d.totalShares),
  ebit:        fv(d.ebit),
  capEmployed: fv(d.capEmployed),
  totalDebt:   fv(d.totalDebt),
  dividend:    fv(d.dividend),
  currAsset:   fv(d.currAsset),
  currLiab:    fv(d.currLiab),
  promoter:    fv(d.promoter),
  fii:         fv(d.fii),
  dii:         fv(d.dii),
  pubHolding:  fv(d.pubHolding),
  eps:         fv(d.eps),
  opProfit:    fv(d.opProfit),
  fcf:         fv(d.fcf),
  deRatio:     fv(d.deRatio),
  roa:         fv(d.roa),
  ebitda:      fv(d.ebitda),
  pe:          fv(d.pe),
  bookValue:   fv(d.bookValue),
  roe:         fv(d.roe),
  salesQ1: fv(d.salesQ1), salesQ2: fv(d.salesQ2), salesQ3: fv(d.salesQ3), salesQ4: fv(d.salesQ4), salesQ5: fv(d.salesQ5),
  expQ1:   fv(d.expQ1),   expQ2:   fv(d.expQ2),   expQ3:   fv(d.expQ3),   expQ4:   fv(d.expQ4),   expQ5:   fv(d.expQ5),
  opQ1:    fv(d.opQ1),    opQ2:    fv(d.opQ2),     opQ3:    fv(d.opQ3),    opQ4:    fv(d.opQ4),    opQ5:    fv(d.opQ5),
  npQ1:    fv(d.npQ1),    npQ2:    fv(d.npQ2),     npQ3:    fv(d.npQ3),    npQ4:    fv(d.npQ4),    npQ5:    fv(d.npQ5),
  pbtQ1:   fv(d.pbtQ1),   pbtQ2:   fv(d.pbtQ2),   pbtQ3:   fv(d.pbtQ3),   pbtQ4:   fv(d.pbtQ4),   pbtQ5:   fv(d.pbtQ5),
  otherIncQ1: fv(d.otherIncQ1), otherIncQ2: fv(d.otherIncQ2), otherIncQ3: fv(d.otherIncQ3), otherIncQ4: fv(d.otherIncQ4), otherIncQ5: fv(d.otherIncQ5),
  fcf: fv(d.fcf),
};
      raw.sharePrice = _getLivePrice(sym);
      await _enrichWithTechnicals(raw, sym); // Phase 2 Logic Added
      _learnCache[sym] = raw;
      if (msg) { msg.textContent = '✅ Firebase · ' + (d.updatedAt ? (d.updatedAt.stringValue||d.updatedAt).toString().substring(0,10) : ''); msg.style.color = '#34d399'; }
      renderLearnReport(raw, sym);
      return;
    }
  } catch(e) { console.warn('Firebase fundlearn fetch failed:', e.message); }

  // 2. FF2 GAS URL
  const ff2Url = localStorage.getItem('ff2ApiUrl') || '';
  if (ff2Url) {
    try {
      const url = `${ff2Url}?type=ff2_search&s=${sym}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.success && data.data) {
        const d = data.data;
// NEW — replace with:
const raw = {
  sym, source: 'ff2',
  netProfit:   Number(d.profit)    || 0,
  totalEquity: Number(d.equity)    || 0,
  totalShares: Number(d.shares)    || 0,
  ebit:        Number(d.ebit)      || 0,
  capEmployed: Number(d.ce)        || 0,
  totalDebt:   Number(d.debt)      || 0,
  dividend:    Number(d.div)       || 0,
  currAsset:   Number(d.assets)    || 0,
  currLiab:    Number(d.liab)      || 0,
  promoter:    Number(d.prom)      || 0,
  fii:         Number(d.fii)       || 0,
  dii:         Number(d.dii)       || 0,
  pubHolding:  Number(d.pub)       || 0,
  eps:         Number(d.eps)       || 0,
  opProfit:    Number(d.opProfit)  || 0,
  fcf:         Number(d.fcf)       || 0,
  deRatio:     Number(d.de)        || 0,
  roa:         Number(d.roa)       || 0,
  ebitda:      Number(d.ebitda)    || 0,
};
        raw.sharePrice = _getLivePrice(sym);
        await _enrichWithTechnicals(raw, sym); // Phase 2 Logic Added
        _learnCache[sym] = raw;
        if (msg) { msg.textContent = '✅ FF2 Screener data'; msg.style.color = '#fb923c'; }
        renderLearnReport(raw, sym);
        return;
      }
      if (msg) { msg.textContent = '❌ ' + (data.message || 'Not found in FF2 sheet'); msg.style.color = '#f87171'; }
      return;
    } catch(e) {
      if (msg) { msg.textContent = '❌ FF2 fetch failed: ' + e.message; msg.style.color = '#f87171'; }
      return;
    }
  }

  // 3. RealTradePro GAS fallback
  try {
    const apiUrl = localStorage.getItem('customAPI') || (typeof API !== 'undefined'?API:'');
    const url = `${apiUrl}?type=fundlearn&s=${sym}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.ok) {
      data.sharePrice = _getLivePrice(sym);
      data.source = 'gas';
      await _enrichWithTechnicals(data, sym); // Phase 2 Logic Added
      _learnCache[sym] = data;
      if (msg) { msg.textContent = '✅ GAS Sheet fetch'; msg.style.color = '#38bdf8'; }
      renderLearnReport(data, sym);
      return;
    }
    if (msg) { msg.textContent = '❌ ' + (data.error || 'Not found') + ' — FF2 URL Settings ma set karo'; msg.style.color = '#f87171'; }
  } catch(e) {
    if (msg) { msg.textContent = '❌ Fetch failed. Settings → Search & Learn → FF2 URL set karo'; msg.style.color = '#f87171'; }
  }
}

function _getLivePrice(sym) {
  if (typeof cache !== 'undefined' && cache[sym]?.data?.regularMarketPrice) return cache[sym].data.regularMarketPrice;
  if (typeof cache !== 'undefined' && cache[sym+'NS']?.data?.regularMarketPrice) return cache[sym+'NS'].data.regularMarketPrice;
  if (window._firebaseFundCache?.[sym]?.sharePrice) return window._firebaseFundCache[sym].sharePrice;
  return 0;
}

// REPLACE entire calcLearnRatios function:
function calcLearnRatios(d) {
  const safe = (v) => (v === null || v === undefined || isNaN(v) || !isFinite(v)) ? null : v;

  // Direct from Screener/Firebase — use if available, else calculate from raw fields
  // EPS: direct OR calculate from netProfit / totalShares
  const eps = (d.eps && d.eps > 0)
    ? d.eps
    : (d.netProfit > 0 && d.totalShares > 0 ? d.netProfit / d.totalShares : null);

  // PE: direct OR calculate from sharePrice / eps
  const _eps = eps;
  const pe = (d.pe && d.pe > 0)
    ? d.pe
    : (d.sharePrice > 0 && _eps > 0 ? d.sharePrice / _eps : null);

  // ROE: direct OR calculate from netProfit / totalEquity
  const roe = (d.roe && d.roe > 0)
    ? d.roe
    : (d.netProfit > 0 && d.totalEquity > 0 ? (d.netProfit / d.totalEquity) * 100 : null);

  // ROCE: capEmployed field now stores ROCE% directly from Screener
  // (Python script stores Screener's ROCE% in Col F / capEmployed field)
  const roce = (d.capEmployed && d.capEmployed > 0) ? d.capEmployed : null;

  // Book Value: direct OR calculate from totalEquity / totalShares
  const bv = (d.bookValue && d.bookValue > 0)
    ? d.bookValue
    : (d.totalEquity > 0 && d.totalShares > 0 ? d.totalEquity / d.totalShares : null);

  // DE Ratio: direct OR calculate from totalDebt / totalEquity
  const de = (d.deRatio && d.deRatio > 0)
    ? d.deRatio
    : (d.totalDebt >= 0 && d.totalEquity > 0 ? d.totalDebt / d.totalEquity : null);

  // Dividend Yield: (dividend / sharePrice) * 100
  const divY = (d.dividend > 0 && d.sharePrice > 0) ? (d.dividend / d.sharePrice) * 100 : null;

  // FII, DII, ROA — direct values
  const fii = (d.fii && d.fii > 0) ? d.fii : null;
  const dii = (d.dii && d.dii > 0) ? d.dii : null;
  const roa = (d.roa && d.roa > 0)
    ? d.roa
    : (d.netProfit > 0 && (d.currAsset + d.totalDebt) > 0 ? (d.netProfit / (d.currAsset + d.totalDebt)) * 100 : null);

  // Current Ratio — calculate from currAsset / currLiab
  const cr = d.currLiab > 0 ? d.currAsset / d.currLiab : null;

  return {
    pe:       safe(pe),
    eps:      safe(eps),
    roe:      safe(roe),
    roce:     safe(roce),
    bookVal:  safe(bv),
    de:       safe(de),
    cr:       safe(cr),
    divYield: safe(divY),
    promoter: (d.promoter && d.promoter > 0) ? d.promoter : null,
    fii:      safe(fii),
    dii:      safe(dii),
    roa:      safe(roa),
    rsi:      (d.rsi !== undefined && d.rsi !== null) ? d.rsi : null
  };
}
// ── Color dot logic ───────────────────────────────────────
function _learnDot(metric, val) {
  if (val === null) return '#64748b';
  const rules = {
    pe:       v => v < 15 ? 'green' : v < 30 ? 'yellow' : 'red',
    eps:      v => v > 0 ? 'green' : 'red',
    roe:      v => v >= 15 ? 'green' : v >= 8 ? 'yellow' : 'red',
    roce:     v => v >= 15 ? 'green' : v >= 8 ? 'yellow' : 'red',
    bookVal:  v => v > 0 ? 'green' : 'red',
    de:       v => v <= 0.5 ? 'green' : v <= 1 ? 'yellow' : 'red',
    cr:       v => v >= 1.5 ? 'green' : v >= 1 ? 'yellow' : 'red',
    divYield: v => v >= 1 ? 'green' : v > 0 ? 'yellow' : 'red',
    promoter: v => v >= 50 ? 'green' : v >= 35 ? 'yellow' : 'red',
    rsi:      v => v < 40 ? 'green' : v < 70 ? 'yellow' : 'red',
    fii:      v => v >= 10 ? 'green' : v >= 5 ? 'yellow' : 'red',
    dii:      v => v >= 5  ? 'green' : v >= 2 ? 'yellow' : 'red',
    roa:      v => v >= 10 ? 'green' : v >= 5 ? 'yellow' : 'red'
};
  const r = rules[metric] ? rules[metric](val) : 'gray';
  return r === 'green' ? '#22c55e' : r === 'yellow' ? '#f59e0b' : r === 'red' ? '#ef4444' : '#64748b';
}

// ── Explanation texts (3 languages) ──────────────────────
const LEARN_INFO = {
  pe: {
    hi: { title: 'P/E Ratio', body: 'यह बताता है कि ₹1 कमाने के लिए आप कितने रुपये दे रहे हैं। कम P/E मतलब सस्ता शेयर।', formula: 'P/E = Share Price ÷ EPS', good: '< 15 = सस्ता  |  15–30 = ठीक  |  > 30 = महँगा' },
    gu: { title: 'P/E રેશિઓ', body: '₹1 કમાવા માટે તમે કેટલા રૂપિયા ચૂકવો છો. ઓછો P/E = સસ્તો શેર.', formula: 'P/E = Share Price ÷ EPS', good: '< 15 = સસ્તો  |  15–30 = ઠીક  |  > 30 = મોંઘો' },
    en: { title: 'P/E Ratio', body: 'How much you pay for ₹1 of earnings. Lower P/E = cheaper stock.', formula: 'P/E = Share Price ÷ EPS', good: '< 15 = Cheap  |  15–30 = Fair  |  > 30 = Expensive' }
  },
  eps: {
    hi: { title: 'EPS (प्रति शेयर आय)', body: 'कंपनी ने प्रत्येक शेयर पर कितना मुनाफा कमाया। जितना ज्यादा, उतना अच्छा।', formula: 'EPS = Net Profit ÷ Total Shares', good: '> 0 = अच्छा  |  बढ़ता EPS = स्वस्थ कंपनी' },
    gu: { title: 'EPS (પ્રતિ શેર કમાણી)', body: 'દરેક શેર પર કંપનીએ કેટલો નફો કર્યો. વધારે EPS = વધારે સારું.', formula: 'EPS = Net Profit ÷ Total Shares', good: '> 0 = સારું  |  વધતો EPS = તંદુરસ્ત કંપની' },
    en: { title: 'EPS (Earnings Per Share)', body: 'Profit earned per share. Higher & growing EPS = healthier company.', formula: 'EPS = Net Profit ÷ Total Shares', good: '> 0 = Good  |  Growing EPS = Healthy' }
  },
  roe: {
    hi: { title: 'ROE % (इक्विटी पर रिटर्न)', body: 'कंपनी अपने शेयरहोल्डर्स के पैसे पर कितना मुनाफा कमा रही है।', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', good: '≥ 15% = अच्छा  |  8–15% = ठीक  |  < 8% = कमजोर' },
    gu: { title: 'ROE % (ઇક્વિટી પર રિટર્ન)', body: 'કંપની શેરહોલ્ડર્સના પૈસા પર કેટલો નફો કરે છે.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', good: '≥ 15% = સારું  |  8–15% = ઠીક  |  < 8% = નબળું' },
    en: { title: 'ROE % (Return on Equity)', body: 'How efficiently the company generates profit from shareholders\' money.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', good: '≥ 15% = Good  |  8–15% = Fair  |  < 8% = Weak' }
  },
  roce: {
    hi: { title: 'ROCE % (पूंजी पर रिटर्न)', body: 'कंपनी अपनी कुल लगाई गई पूंजी पर कितना मुनाफा बना रही है।', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', good: '≥ 15% = अच्छा  |  8–15% = ठीक  |  < 8% = कमजोर' },
    gu: { title: 'ROCE % (મૂડી પર રિટર્ન)', body: 'કંપની લગાવેલી કુલ મૂડી પર કેટલો નફો કરે છે.', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', good: '≥ 15% = સારું  |  8–15% = ઠીક  |  < 8% = નબળું' },
    en: { title: 'ROCE % (Return on Capital Employed)', body: 'How much profit the company generates from all capital deployed.', formula: 'ROCE = (EBIT ÷ Capital Employed) × 100', good: '≥ 15% = Good  |  8–15% = Fair  |  < 8% = Weak' }
  },
  bookVal: {
    hi: { title: 'Book Value (बुक वैल्यू)', body: 'अगर कंपनी आज बंद हो जाए तो प्रति शेयर कितना मिलेगा। Price < Book Value = सस्ता!', formula: 'Book Value = Total Equity ÷ Total Shares', good: 'Price < BV = अंडरवैल्यूड' },
    gu: { title: 'Book Value (બુક વેલ્યૂ)', body: 'કંપની બંધ થઈ જાય તો દરેક શેર પર કેટલું મળે. Price < BV = સસ્તો!', formula: 'Book Value = Total Equity ÷ Total Shares', good: 'Price < BV = Undervalued' },
    en: { title: 'Book Value', body: 'What each share would be worth if the company liquidated. Price < BV = Undervalued!', formula: 'Book Value = Total Equity ÷ Total Shares', good: 'Price < BV = Undervalued' }
  },
  de: {
    hi: { title: 'Debt-to-Equity (कर्ज अनुपात)', body: 'कंपनी ने अपनी इक्विटी के मुकाबले कितना कर्ज लिया है। कम = बेहतर।', formula: 'D/E = Total Debt ÷ Total Equity', good: '< 0.5 = कम कर्ज  |  0.5–1 = ठीक  |  > 1 = ज्यादा कर्ज' },
    gu: { title: 'Debt-to-Equity (દેવું ગુણોત્તર)', body: 'ઇક્વિટી સામે કેટલું દેવું છે. ઓછું = વધારે સારું.', formula: 'D/E = Total Debt ÷ Total Equity', good: '< 0.5 = ઓછું દેવું  |  0.5–1 = ઠીક  |  > 1 = વધારે દેવું' },
    en: { title: 'Debt-to-Equity Ratio', body: 'How much debt the company carries relative to equity. Lower is better.', formula: 'D/E = Total Debt ÷ Total Equity', good: '< 0.5 = Low debt  |  0.5–1 = Fair  |  > 1 = High debt' }
  },
  cr: {
    hi: { title: 'Current Ratio (चालू अनुपात)', body: 'क्या कंपनी अपने अल्पकालिक कर्ज चुका सकती है? 1 से ज्यादा होना जरूरी।', formula: 'Current Ratio = Current Assets ÷ Current Liabilities', good: '≥ 1.5 = सुरक्षित  |  1–1.5 = ठीक  |  < 1 = खतरा' },
    gu: { title: 'Current Ratio (ચાલુ ગુણોત્તર)', body: 'કંપની ટૂંકા ગાળાની જવાબદારી ચૂકવી શકે? 1 થી વધારે હોવું જોઈએ.', formula: 'Current Ratio = Current Assets ÷ Current Liabilities', good: '≥ 1.5 = સુરક્ષિત  |  1–1.5 = ઠીક  |  < 1 = જોખમ' },
    en: { title: 'Current Ratio', body: 'Can the company pay its short-term obligations? Must be above 1.', formula: 'Current Ratio = Current Assets ÷ Current Liabilities', good: '≥ 1.5 = Safe  |  1–1.5 = Fair  |  < 1 = Risk' }
  },
  divYield: {
    hi: { title: 'Dividend Yield %', body: 'शेयर की कीमत के मुकाबले कंपनी कितना लाभांश देती है।', formula: 'Div Yield = (Dividend ÷ Share Price) × 100', good: '≥ 1% = अच्छा  |  > 0% = ठीक  |  0% = कोई लाभांश नहीं' },
    gu: { title: 'Dividend Yield %', body: 'શેર ભાવ સામે કંપની કેટલું ડિવિડન્ડ આપે છે.', formula: 'Div Yield = (Dividend ÷ Share Price) × 100', good: '≥ 1% = સારું  |  > 0% = ઠીક  |  0% = ડિવિડન્ડ નથી' },
    en: { title: 'Dividend Yield %', body: 'How much dividend the company pays relative to share price.', formula: 'Div Yield = (Dividend ÷ Share Price) × 100', good: '≥ 1% = Good  |  > 0% = Fair  |  0% = No dividend' }
  },
  promoter: {
    hi: { title: 'Promoter Holding %', body: 'कंपनी के मालिकों (प्रमोटर्स) के पास कितने % शेयर हैं। ज्यादा = भरोसेमंद।', formula: 'Screener/BSE से सीधा डेटा', good: '≥ 50% = मजबूत  |  35–50% = ठीक  |  < 35% = कम' },
    gu: { title: 'Promoter Holding %', body: 'કંપનીના માલિકો (Promoters) પાસે કેટલા % શેર છે. વધારે = ભરોસાપાત્ર.', formula: 'Screener/BSE direct data', good: '≥ 50% = મજબૂત  |  35–50% = ઠીક  |  < 35% = ઓછું' },
    en: { title: 'Promoter Holding %', body: 'How much % of shares the founders/promoters hold. Higher = more confidence.', formula: 'Direct from Screener/BSE', good: '≥ 50% = Strong  |  35–50% = Fair  |  < 35% = Low' }
  },
  rsi: {
    hi: { title: 'RSI (Momentum)', body: 'बताता है कि शेयर ओवरसोल्ड (सस्ता) है या ओवरबॉट (महँगा)।', formula: 'Relative Strength Index', good: '< 40 = Oversold (Good) | > 70 = Overbought' },
    gu: { title: 'RSI (મોમેન્ટમ)', body: 'શેર ઓવરસોલ્ડ (ખરીદવાની તક) છે કે ઓવરબૉટ (વેચવાની તક) તે દર્શાવે છે.', formula: 'Relative Strength Index', good: '< 40 = Oversold (સસ્તો) | > 70 = Overbought (મોંઘો)' },
    en: { title: 'RSI (Momentum)', body: 'Indicates if a stock is oversold (buy) or overbought (sell).', formula: 'Relative Strength Index', good: '< 40 = Oversold (Good) | > 70 = Overbought' }
  },
  fii: {
  hi: { title: 'FII Holding %', body: 'विदेशी संस्थागत निवेशकों की हिस्सेदारी। ज़्यादा = विदेशी भरोसा।', formula: 'Direct from BSE/NSE', good: '≥ 10% = अच्छा  |  5–10% = ठीक  |  < 5% = कम' },
  gu: { title: 'FII Holding %', body: 'વિદેશી સંસ્થાકીય રોકાણકારોની હિસ્સેદારી. વધારે = વિદેશી વિશ્વાસ.', formula: 'Direct from BSE/NSE', good: '≥ 10% = સારું  |  5–10% = ઠીક  |  < 5% = ઓછું' },
  en: { title: 'FII Holding %', body: 'Foreign Institutional Investors stake. Higher = more foreign confidence.', formula: 'Direct from BSE/NSE', good: '≥ 10% = Good  |  5–10% = Fair  |  < 5% = Low' }
},
dii: {
  hi: { title: 'DII Holding %', body: 'घरेलू संस्थागत निवेशकों की हिस्सेदारी। MF, LIC जैसे संस्थान।', formula: 'Direct from BSE/NSE', good: '≥ 5% = अच्छा  |  2–5% = ठीक  |  < 2% = कम' },
  gu: { title: 'DII Holding %', body: 'સ્થાનિક સંસ્થાકીય રોકાણકારોની હિસ્સેદારી. MF, LIC જેવી સંસ્થાઓ.', formula: 'Direct from BSE/NSE', good: '≥ 5% = સારું  |  2–5% = ઠીક  |  < 2% = ઓછું' },
  en: { title: 'DII Holding %', body: 'Domestic Institutional Investors stake. MF, LIC type institutions.', formula: 'Direct from BSE/NSE', good: '≥ 5% = Good  |  2–5% = Fair  |  < 2% = Low' }
},
roa: {
  hi: { title: 'ROA % (संपत्ति पर रिटर्न)', body: 'कंपनी अपनी कुल संपत्ति पर कितना मुनाफा कमाती है।', formula: 'ROA = (Net Profit ÷ Total Assets) × 100', good: '≥ 10% = अच्छा  |  5–10% = ठीक  |  < 5% = कमजोर' },
  gu: { title: 'ROA % (સંપત્તિ પર રિટર્ન)', body: 'કંપની કુલ સંપત્તિ પર કેટલો નફો કરે છે.', formula: 'ROA = (Net Profit ÷ Total Assets) × 100', good: '≥ 10% = સારું  |  5–10% = ઠીક  |  < 5% = નબળું' },
  en: { title: 'ROA % (Return on Assets)', body: 'How much profit the company generates from total assets.', formula: 'ROA = (Net Profit ÷ Total Assets) × 100', good: '≥ 10% = Good  |  5–10% = Fair  |  < 5% = Weak' }
},
};

function showLearnInfo(metric, val, symRaw) {
  const info = LEARN_INFO[metric];
  if (!info) return;
  const L = info[_learnLang] || info['en'];
  document.getElementById('learnInfoTitle').textContent = L.title;
  document.getElementById('learnInfoBody').textContent  = L.body;
  const fEl = document.getElementById('learnInfoFormula');
  fEl.innerHTML = '<b>Formula:</b> ' + L.formula + (L.good ? '<br><span style="color:#f59e0b;">'+L.good+'</span>' : '');
  if (val !== null) {
    fEl.innerHTML += '<br><span style="color:#38bdf8;">Your value: <b>' + (typeof val === 'number' ? val.toFixed(2) : val) + '</b></span>';
  }
  document.getElementById('learnInfoModal').style.display = 'flex';
}

// ── Render report ─────────────────────────────────────────
// ── Active Learn Sub-Tab tracker ─────────────────────────────
let _learnActiveTab = 'fundamentals';

function switchLearnTab(tabName) {
  _learnActiveTab = tabName;
  const tabs = ['fundamentals','technicals','shareholding','quarterly','cashflow'];
  tabs.forEach(t => {
    const btn = document.getElementById('lst-' + t);
    if (!btn) return;
    if (t === tabName) {
      btn.style.background = 'rgba(251,146,60,0.15)';
      btn.style.color = '#fb923c';
      btn.style.borderColor = 'rgba(251,146,60,0.5)';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#64748b';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  });
  // Re-render current tab
  const sym = (document.getElementById('learnSearchInput')||{}).value?.trim().toUpperCase();
  if (sym && _learnCache[sym]) {
    _renderLearnTab(tabName, _learnCache[sym], sym);
  }
}

// ── Main render dispatcher ────────────────────────────────────
function renderLearnReport(d, sym) {
  // Show sub-tab pills
  const subTabsEl = document.getElementById('learnSubTabs');
  if (subTabsEl) subTabsEl.style.display = 'block';

  // Render whichever tab is active (default: fundamentals)
  _renderLearnTab(_learnActiveTab, d, sym);
}

function _renderLearnTab(tabName, d, sym) {
  const res = document.getElementById('learnResults');
  if (!res) return;
  res.innerHTML = '<div style="text-align:center;padding:20px 0;"><div class="spinner" style="margin:0 auto;"></div></div>';

  setTimeout(() => {
    if (tabName === 'fundamentals')  res.innerHTML = _buildFundamentalsTab(d, sym);
    if (tabName === 'technicals')    res.innerHTML = _buildTechnicalsTab(d, sym);
    if (tabName === 'shareholding')  res.innerHTML = _buildShareholdingTab(d, sym);
    if (tabName === 'quarterly')     _buildQuarterlyTab(res, sym);
    if (tabName === 'cashflow')      _buildCashflowTab(res, sym);
  }, 80);
}

// ── STOCK HEADER (common) ─────────────────────────────────────
function _learnHeader(d, sym) {
  const sp = d.sharePrice > 0 ? '₹' + d.sharePrice.toFixed(2) : null;
  const srcColor = d.source === 'firebase' ? '#34d399' : '#38bdf8';
  const srcLabel = d.source === 'firebase' ? 'Firebase' : d.source === 'ff2' ? 'FF2 Sheet' : 'GAS';
  return `
    <div style="background:#0d1f35;border-radius:12px;padding:11px 14px;margin-bottom:10px;border:1px solid rgba(251,146,60,0.15);display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:17px;font-weight:700;color:#fb923c;font-family:'JetBrains Mono',monospace;line-height:1.1;">${sym}</div>
        ${sp ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">CMP: <span style="color:#e2e8f0;font-weight:700;">${sp}</span></div>` : '<div style="font-size:11px;color:#64748b;">Open stock to load price</div>'}
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:#64748b;margin-bottom:2px;">SOURCE</div>
        <div style="font-size:10px;font-weight:700;color:${srcColor};">${srcLabel}</div>
        ${d.source === 'firebase' && d.updatedAt ? `<div style="font-size:9px;color:#4b6280;">${(d.updatedAt.stringValue||d.updatedAt).toString().substring(0,10)}</div>` : ''}
      </div>
    </div>`;
}

// ============================================================
// TAB 1 — FUNDAMENTALS
// ============================================================
function _buildFundamentalsTab(d, sym) {
  const R = calcLearnRatios(d);
  const lang = _learnLang;

  // Nivi insight
  let niviText = ({ hi:'इस स्टॉक के पैरामीटर अभी neutral हैं।', gu:'આ સ્ટોકના પેરામીટર્સ અત્યારે neutral છે.', en:'Parameters are currently neutral.' })[lang] || '';
  if (R.rsi !== null && R.rsi < 40 && R.roe !== null && R.roe > 15) {
    niviText = ({ hi:(r)=>`🔥 Strong Buy: ROE ${r}% + RSI Oversold — excellent entry zone.`, gu:(r)=>`🔥 Strong Buy: ROE ${r}% + RSI Oversold — ઉત્તમ entry zone.`, en:(r)=>`🔥 Strong Buy: ROE ${r}% + RSI Oversold — excellent entry zone.` })[lang](R.roe.toFixed(1));
  } else if (R.rsi !== null && R.rsi > 75) {
    niviText = ({ hi:'⚠️ Overbought: नई खरीदारी से पहले correction का इंतज़ार करें।', gu:'⚠️ Overbought: નવી ખરીદી પહેલા correction ની રાહ જુઓ.', en:'⚠️ Overbought: Wait for correction before fresh buying.' })[lang] || '';
  } else if (R.de !== null && R.de > 1.5) {
    niviText = ({ hi:'⚠️ High Debt: D/E ratio ज़्यादा है — कर्ज़ का बोझ देखें।', gu:'⚠️ High Debt: D/E ratio વધારે છે — debt burden ધ્યાનમાં રાખો.', en:'⚠️ High Debt: D/E ratio is elevated — monitor debt burden.' })[lang] || '';
  } else if (R.cr !== null && R.cr < 1) {
    niviText = ({ hi:'🚨 Liquidity Risk: Current Ratio 1 से कम — short-term debt चुकाने में दिक्कत।', gu:'🚨 Liquidity Risk: Current Ratio 1 કરતાં ઓછો — ટૂંકા ગાળાનું debt ચૂકવવામાં મુશ્કેલ.', en:'🚨 Liquidity Risk: Current Ratio < 1 — may struggle with short-term obligations.' })[lang] || '';
  }

  const fmtV = (metric, val) => {
    if (val === null || val === undefined || isNaN(val)) return '--';
    if (metric === 'eps' || metric === 'bookVal') return '₹' + val.toFixed(2);
    if (['roe','roce','divYield','roa'].includes(metric)) return val.toFixed(2) + '%';
    return val.toFixed(2);
  };

  const metricGroups = [
    { label: { hi:'Valuation', gu:'Valuation', en:'Valuation' }, metrics: ['pe','eps','bookVal'] },
    { label: { hi:'Profitability', gu:'Profitability', en:'Profitability' }, metrics: ['roe','roce','roa'] },
    { label: { hi:'Financial Health', gu:'Financial Health', en:'Financial Health' }, metrics: ['de','cr','divYield'] }
  ];

  const labels = { pe:'P/E Ratio', eps:'EPS', roe:'ROE %', roce:'ROCE %', bookVal:'Book Value', de:'D/E Ratio', cr:'Current Ratio', divYield:'Div Yield %', roa:'ROA %' };

  let html = _learnHeader(d, sym);

  // Nivi insight box
  html += `<div style="background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);border-left:3px solid #fb923c;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
    <div style="font-size:9px;color:#fb923c;font-weight:700;letter-spacing:1px;margin-bottom:4px;">NIVI'S INSIGHT</div>
    <div style="font-size:12px;color:#e2e8f0;line-height:1.5;">${niviText}</div>
  </div>`;

  // Grouped metric cards
  metricGroups.forEach(group => {
    html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
      <div style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
        <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">${group.label[lang]||group.label.en}</span>
      </div>`;
    group.metrics.forEach((m, idx) => {
      const val = R[m];
      const dot = _learnDot(m, val);
      const last = idx === group.metrics.length - 1;
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;${last?'':'border-bottom:1px solid rgba(255,255,255,0.04);'}">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
          <span style="font-size:12px;color:#cbd5e1;">${labels[m]||m}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:#e2e8f0;font-family:'JetBrains Mono',monospace;">${fmtV(m,val)}</span>
          <button onclick="showLearnInfo('${m}',${val!==null?val:'null'},'${sym}')"
            style="width:18px;height:18px;border-radius:50%;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);color:#38bdf8;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">ℹ</button>
        </div>
      </div>`;
    });
    html += '</div>';
  });

  return html;
}

// ============================================================
// TAB 2 — TECHNICALS
// ============================================================
function _buildTechnicalsTab(d, sym) {
  const R = calcLearnRatios(d);
  let html = _learnHeader(d, sym);

  const techItems = [
    { key: 'rsi',   label: 'RSI (14D)',        fmt: v => v.toFixed(1),       bench: '< 30 Oversold · 30–70 Normal · > 70 Overbought' },
    { key: 'macd',  label: 'MACD',             fmt: v => v.toFixed(2),       bench: '> 0 Bullish · < 0 Bearish' },
    { key: 'ema20', label: 'EMA 20',           fmt: v => '₹' + v.toFixed(2), bench: 'Price > EMA = Bullish' },
    { key: 'ema50', label: 'EMA 50',           fmt: v => '₹' + v.toFixed(2), bench: 'Price > EMA = Bullish' },
    { key: 'beta',  label: 'Beta',             fmt: v => v.toFixed(2),       bench: '< 1 Low Risk · > 1 High Volatility' },
    { key: '52wHigh', label: '52W High',       fmt: v => '₹' + v.toFixed(2), bench: 'Price near high = Momentum' },
    { key: '52wLow',  label: '52W Low',        fmt: v => '₹' + v.toFixed(2), bench: 'Price near low = Opportunity?' },
  ];

  html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
    <div style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">⚡ TECHNICAL INDICATORS</span>
    </div>`;

  techItems.forEach((item, idx) => {
    const val = R[item.key] !== undefined ? R[item.key] : (d[item.key] !== undefined ? d[item.key] : null);
    const fv = val !== null && val !== undefined ? item.fmt(val) : '--';
    const dot = _learnDot(item.key, val);
    const last = idx === techItems.length - 1;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;${last?'':'border-bottom:1px solid rgba(255,255,255,0.04);'}">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#cbd5e1;">${item.label}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:13px;font-weight:700;color:#e2e8f0;font-family:'JetBrains Mono',monospace;">${fv}</span>
      </div>
    </div>`;
  });

  html += '</div>';
  html += `<div style="font-size:10px;color:#4b6280;padding:8px 2px;">Technical indicators based on available data.</div>`;
  return html;
}

// ============================================================
// TAB 3 — SHAREHOLDING
// ============================================================
function _buildShareholdingTab(d, sym) {
  const R = calcLearnRatios(d);
  let html = _learnHeader(d, sym);

  const holders = [
    { label:'Promoter',       val: R.promoter,         color:'#7c3aed', info:'promoter' },
    { label:'FII (Foreign)',  val: R.fii,               color:'#0284c7', info:'fii' },
    { label:'DII (Domestic)', val: R.dii,               color:'#059669', info:'dii' },
    { label:'Public',         val: d.pubHolding||null,  color:'#d97706', info:null },
  ];

  const total = holders.reduce((s,h) => s + (h.val||0), 0);

  html += `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);padding:14px;">`;

// ── Full Report PDF Download (All 5 Tabs) ──────────────────
async function downloadLearnPDF(sym) {
  const d = _learnCache[sym];
  if (!d) { showPopup('Data not loaded yet'); return; }

  showPopup('⏳ Generating Full Report...');

  const R = calcLearnRatios(d);
  const today = new Date();
  const dateStr = today.getDate() + '/' + (today.getMonth()+1) + '/' + today.getFullYear();
  const sp = d.sharePrice > 0 ? '₹' + d.sharePrice.toFixed(2) : 'N/A';
  const srcLabel = d.source === 'firebase' ? 'Firebase' : d.source === 'ff2' ? 'FF2 Sheet' : 'GAS';

  // ── Helper: dot color for print ──
  const dotCol = (m, v) => {
    const c = _learnDot(m, v);
    return c === '#22c55e' ? '#16a34a' : c === '#f59e0b' ? '#b45309' : c === '#ef4444' ? '#b91c1c' : '#94a3b8';
  };

  // ── Nivi Insight ──
  let niviText = 'Parameters are currently neutral (Stable).';
  if (R.rsi !== null && R.rsi < 40 && R.roe !== null && R.roe > 15)
    niviText = `🔥 Strong Buy Zone: ROE ${R.roe.toFixed(1)}% strong + RSI Oversold (${R.rsi.toFixed(1)}) — potential excellent entry.`;
  else if (R.rsi !== null && R.rsi > 75)
    niviText = '⚠️ Overbought: Technically overbought per RSI. Wait for correction before fresh buying.';
  else if (R.de !== null && R.de > 1.5)
    niviText = `⚠️ High Debt: D/E ratio is ${R.de.toFixed(2)} — elevated debt burden. Monitor carefully.`;
  else if (R.cr !== null && R.cr < 1)
    niviText = `🚨 Liquidity Risk: Current Ratio ${R.cr.toFixed(2)} < 1 — may struggle with short-term obligations.`;

  // ── Section 1: Fundamentals rows ──
  const fundMetrics = [
    { key:'pe',       label:'P/E Ratio',         fmt: v => v.toFixed(2),        bench:'< 15 Good · 15–30 Fair · > 30 Expensive' },
    { key:'eps',      label:'EPS',                fmt: v => '₹'+v.toFixed(2),   bench:'> 0 Good · Growing = Healthy' },
    { key:'roe',      label:'ROE %',              fmt: v => v.toFixed(2)+'%',    bench:'≥ 15% Good · 8–15% Fair · < 8% Weak' },
    { key:'roce',     label:'ROCE %',             fmt: v => v.toFixed(2)+'%',    bench:'≥ 15% Good · 8–15% Fair · < 8% Weak' },
    { key:'bookVal',  label:'Book Value',         fmt: v => '₹'+v.toFixed(2),   bench:'Price < BV = Undervalued' },
    { key:'de',       label:'Debt-to-Equity',     fmt: v => v.toFixed(2),        bench:'< 0.5 Low · 0.5–1 Fair · > 1 High' },
    { key:'cr',       label:'Current Ratio',      fmt: v => v.toFixed(2),        bench:'≥ 1.5 Safe · 1–1.5 Fair · < 1 Risk' },
    { key:'divYield', label:'Dividend Yield %',   fmt: v => v.toFixed(2)+'%',    bench:'≥ 1% Good · > 0% Fair' },
    { key:'roa',      label:'ROA %',              fmt: v => v.toFixed(2)+'%',    bench:'≥ 10% Good · 5–10% Fair' },
    { key:'rsi',      label:'RSI (14D)',           fmt: v => v.toFixed(1),        bench:'< 30 Oversold · 30–70 Normal · > 70 Overbought' },
  ];

  const fundRows = fundMetrics.map(m => {
    const val = R[m.key];
    const fv = val === null ? '--' : m.fmt(val);
    const col = dotCol(m.key, val);
    return `<tr>
      <td class="td"><span class="dot" style="background:${col};"></span>${m.label}</td>
      <td class="td-val" style="color:${col};">${fv}</td>
      <td class="td-bench">${m.bench}</td>
    </tr>`;
  }).join('');

  // ── Section 2: Shareholding rows ──
  const holders = [
    { label:'Promoter',       val: R.promoter,      color:'#7c3aed', bench: '≥ 50% Strong · 35–50% OK · < 35% Low' },
    { label:'FII (Foreign)',  val: R.fii,            color:'#0284c7', bench: '≥ 10% High · 5–10% Moderate' },
    { label:'DII (Domestic)', val: R.dii,            color:'#059669', bench: '≥ 5% Good · 2–5% Moderate' },
    { label:'Public',         val: d.pubHolding||null, color:'#d97706', bench: '--' },
  ];
  const shareRows = holders.map(h => {
    const fv = h.val !== null ? h.val.toFixed(2)+'%' : '--';
    const barW = h.val !== null ? Math.min(100, h.val) : 0;
    return `<tr>
      <td class="td"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${h.color};margin-right:8px;vertical-align:middle;"></span>${h.label}</td>
      <td class="td-val" style="color:${h.color};">${fv}</td>
      <td class="td-bench">
        <div style="background:#e2e8f0;border-radius:4px;height:6px;width:120px;overflow:hidden;">
          <div style="height:100%;width:${barW}%;background:${h.color};border-radius:4px;"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Section 3: Raw data ──
  const rawRows = [
    ['Net Profit', d.netProfit ? '₹'+d.netProfit+' Cr' : '--'],
    ['Total Equity', d.totalEquity ? '₹'+d.totalEquity+' Cr' : '--'],
    ['Total Shares', d.totalShares ? d.totalShares+' Cr' : '--'],
    ['EBIT', d.ebit ? '₹'+d.ebit+' Cr' : '--'],
    ['Total Debt', d.totalDebt ? '₹'+d.totalDebt+' Cr' : '--'],
    ['Current Assets', d.currAsset ? '₹'+d.currAsset+' Cr' : '--'],
    ['Current Liabilities', d.currLiab ? '₹'+d.currLiab+' Cr' : '--'],
    ['Operating Profit', d.opProfit ? '₹'+d.opProfit+' Cr' : '--'],
    ['Free Cash Flow', d.fcf ? '₹'+d.fcf+' Cr' : '--'],
    ['EBITDA', d.ebitda ? '₹'+d.ebitda+' Cr' : '--'],
  ].map(([l,v]) => `<tr><td class="td">${l}</td><td class="td-val">${v}</td><td class="td-bench"></td></tr>`).join('');

// ── Section 4: Quarterly from Firebase cache ──
  const qs = ['Q1','Q2','Q3','Q4','Q5'];
  const qLabels = ['Sales','Expenses','Op Profit','Other Inc','PBT','Net Profit'];
  const qKeys   = ['sales','exp','op','otherInc','pbt','np'];
  const fmtCr = v => (v && v !== 0) ? '\u20B9'+Number(v).toFixed(0)+' Cr' : '--';

  let qRows = '';
  const hasQ = d.salesQ1 && d.salesQ1 !== 0;
  if (hasQ) {
    const hdrRow = `<tr><td class="td"><strong>Metric</strong></td>${qs.map(q=>`<td class="td-val" style="font-size:11px;">${q}</td>`).join('')}</tr>`;
    qRows = hdrRow + qLabels.map((label, li) => {
      const key = qKeys[li];
      return `<tr><td class="td">${label}</td>${qs.map(q=>`<td class="td-val">${fmtCr(d[key+q])}</td>`).join('')}</tr>`;
    }).join('');
  } else {
    qRows = `<tr><td colspan="6" style="padding:8px 10px;color:#94a3b8;font-size:11px;">Quarterly data not available</td></tr>`;
  }

  // ── Cash Flow from Firebase cache ──
  const cfItems = [
    ['Free Cash Flow', fmtCr(d.fcf)],
    ['Total Debt',     fmtCr(d.totalDebt)],
    ['Current Assets', fmtCr(d.currAsset)],
    ['Current Liab',   fmtCr(d.currLiab)],
    ['Debt/Equity',    d.deRatio ? Number(d.deRatio).toFixed(2)+'x' : '--'],
    ['ROA %',          d.roa    ? Number(d.roa).toFixed(2)+'%'    : '--'],
    ['EBITDA',         fmtCr(d.ebitda)],
  ];
  const cfRows = cfItems.map(([l,v]) => `<tr><td class="td">${l}</td><td class="td-val">${v}</td><td class="td-bench"></td></tr>`).join('');

  // ── Score summary ──
  const scored = ['pe','eps','roe','roce','de','cr','roa','promoter','fii','dii'].map(k => _learnDot(k, R[k]));
  const green  = scored.filter(c => c === '#22c55e').length;
  const yellow = scored.filter(c => c === '#f59e0b').length;
  const red    = scored.filter(c => c === '#ef4444').length;
  const grade  = green >= 7 ? 'A' : green >= 5 ? 'B' : green >= 3 ? 'C' : 'D';
  const gradeColor = grade === 'A' ? '#16a34a' : grade === 'B' ? '#0284c7' : grade === 'C' ? '#b45309' : '#b91c1c';

  // ── Build full HTML ──
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${sym} — Full Analysis Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #060e1a; color: #e2e8f0; font-family: Arial, Helvetica, sans-serif; padding: 24px; font-size: 13px; }
  h2 { font-size: 14px; font-weight: 700; color: #fb923c; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(251,146,60,0.25); }
  table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  .td      { padding: 7px 10px; border-bottom: 1px solid #1e2d3d; color: #cbd5e1; font-size: 12px; }
  .td-val  { padding: 7px 10px; border-bottom: 1px solid #1e2d3d; font-family: monospace; font-size: 13px; font-weight: bold; min-width: 80px; }
  .td-bench{ padding: 7px 10px; border-bottom: 1px solid #1e2d3d; font-size: 10px; color: #64748b; }
  .dot     { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  .section { background: #0d1f35; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.07); }
  .hdr-box { background: linear-gradient(135deg,#0d1f35,#1e3a5f); border-radius: 14px; padding: 20px 22px; margin-bottom: 20px; border: 1px solid rgba(251,146,60,0.25); }
  .badge   { display: inline-block; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 10px; font-size: 11px; color: #94a3b8; margin-right: 6px; margin-top: 6px; }
  .nivi-box { background: rgba(251,146,60,0.08); border: 1px solid rgba(251,146,60,0.25); border-left: 4px solid #fb923c; border-radius: 10px; padding: 12px 14px; margin-bottom: 20px; }
  .grade-box { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; font-size: 24px; font-weight: 700; border: 3px solid; }
  .score-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  .score-pill { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 6px 12px; font-size: 12px; }
  .footer { text-align: center; font-size: 10px; color: #4b6280; margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e2d3d; }

  @media print {
    body { background: #fff !important; color: #111 !important; padding: 16px; }
    .hdr-box { background: #f0f4f8 !important; border-color: #ddd !important; }
    .section { background: #f8fafc !important; border-color: #e2e8f0 !important; }
    .nivi-box { background: #fff8f0 !important; border-color: #f59e0b !important; }
    .td, .td-val, .td-bench { border-bottom-color: #e2e8f0 !important; color: #111 !important; }
    h2 { color: #c2410c !important; border-bottom-color: #fdba74 !important; }
    .badge { background: #f1f5f9 !important; color: #475569 !important; border-color: #cbd5e0 !important; }
    .score-pill { background: #f1f5f9 !important; }
    .footer { color: #94a3b8 !important; border-top-color: #e2e8f0 !important; }
    table { page-break-inside: avoid; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="hdr-box">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:26px;font-weight:700;color:#fb923c;font-family:monospace;">${sym}</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px;">RealTradePro · Full Analysis Report</div>
      <div style="margin-top:10px;">
        <span class="badge">📅 ${dateStr}</span>
        <span class="badge">💰 CMP: ${sp}</span>
        <span class="badge">🗄 Source: ${srcLabel}</span>
      </div>
    </div>
    <div style="text-align:center;">
      <div class="grade-box" style="color:${gradeColor};border-color:${gradeColor};">${grade}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">Overall Grade</div>
    </div>
  </div>
</div>

<!-- NIVI INSIGHT -->
<div class="nivi-box">
  <div style="font-size:10px;color:#fb923c;font-weight:700;letter-spacing:1px;margin-bottom:6px;">🤖 NIVI'S INSIGHT</div>
  <div style="font-size:13px;color:#e2e8f0;line-height:1.6;">${niviText}</div>
</div>

<!-- SCORE SUMMARY -->
<div class="section" style="margin-bottom:20px;">
  <h2>📊 SCORE SUMMARY</h2>
  <div class="score-row">
    <div class="score-pill"><span style="width:9px;height:9px;border-radius:50%;background:#16a34a;display:inline-block;"></span>Good: <strong>${green}</strong></div>
    <div class="score-pill"><span style="width:9px;height:9px;border-radius:50%;background:#b45309;display:inline-block;"></span>Average: <strong>${yellow}</strong></div>
    <div class="score-pill"><span style="width:9px;height:9px;border-radius:50%;background:#b91c1c;display:inline-block;"></span>Weak: <strong>${red}</strong></div>
    <div class="score-pill">Out of <strong>10</strong> metrics</div>
  </div>
</div>

<!-- SECTION 1: FUNDAMENTALS -->
<div class="section">
  <h2>📈 FUNDAMENTALS & VALUATION</h2>
  <table>
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(251,146,60,0.3);">Metric</th>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(251,146,60,0.3);">Value</th>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(251,146,60,0.3);">Benchmark</th>
    </tr></thead>
    <tbody>${fundRows}</tbody>
  </table>
</div>

<!-- SECTION 2: SHAREHOLDING -->
<div class="section">
  <h2>👥 SHAREHOLDING PATTERN</h2>
  <table>
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(56,189,248,0.3);">Holder</th>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(56,189,248,0.3);">%</th>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(56,189,248,0.3);">Visual</th>
    </tr></thead>
    <tbody>${shareRows}</tbody>
  </table>
</div>

<!-- SECTION 3: QUARTERLY FINANCIALS -->
<div class="section">
  <h2>QUARTERLY RESULTS (Last 5 Quarters)</h2>
  <table>
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(34,197,94,0.3);">Metric</th>
        <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(34,197,94,0.3);">Q1</th>
        <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(34,197,94,0.3);">Q2</th>
        <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(34,197,94,0.3);">Q3</th>
        <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(34,197,94,0.3);">Q4</th>
        <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(34,197,94,0.3);">Q5</th>
      </tr></thead>
    <tbody>${qRows}</tbody>
  </table>
</div>

<!-- SECTION 4: CASH FLOW -->
<div class="section">
  <h2>💰 CASH FLOW & LIQUIDITY</h2>
  <table>
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(168,85,247,0.3);">Parameter</th>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(168,85,247,0.3);">Value</th>
      <th style="padding:6px 10px;border-bottom:2px solid rgba(168,85,247,0.3);"></th>
    </tr></thead>
    <tbody>${cfRows}</tbody>
  </table>
</div>

<!-- SECTION 5: RAW DATA -->
<div class="section">
  <h2>🗃 RAW FINANCIAL DATA (FF2 Sheet)</h2>
  <table>
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(100,116,139,0.3);">Field</th>
      <th style="text-align:left;padding:6px 10px;font-size:10px;color:#64748b;border-bottom:2px solid rgba(100,116,139,0.3);">Value</th>
      <th style="padding:6px 10px;border-bottom:2px solid rgba(100,116,139,0.3);"></th>
    </tr></thead>
    <tbody>${rawRows}</tbody>
  </table>
</div>

<div class="footer">
  RealTradePro · ${sym} Full Analysis Report · ${dateStr} · For personal reference only · Not SEBI registered advice
</div>

</body>
</html>`;

  // ── Open & Print ──
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    showPopup('✅ Report ready — browser mā Print/Save as PDF karo!');
  } catch(e) {
    const w = window.open('', '_blank', 'width=900,height=750');
    if (!w) { showPopup('Popup blocked! Allow popups.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }
}

  // Stacked bar
  if (total > 0) {
    html += `<div style="display:flex;height:10px;border-radius:6px;overflow:hidden;margin-bottom:14px;gap:1px;">`;
    holders.forEach(h => {
      if (h.val > 0) html += `<div style="flex:${h.val};background:${h.color};" title="${h.label}: ${h.val.toFixed(1)}%"></div>`;
    });
    html += `</div>`;
  }

  // Individual rows
  holders.forEach(h => {
    const dot = h.info ? _learnDot(h.info, h.val) : '#f59e0b';
    const fv = h.val !== null ? h.val.toFixed(2) + '%' : '--';
    const barW = h.val !== null ? Math.min(100, h.val) : 0;
    html += `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:10px;height:10px;border-radius:3px;background:${h.color};flex-shrink:0;"></div>
          <span style="font-size:12px;color:#cbd5e1;">${h.label}</span>
          ${h.info ? `<button onclick="showLearnInfo('${h.info}',${h.val!==null?h.val:'null'},'${sym}')" style="width:16px;height:16px;border-radius:50%;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);color:#38bdf8;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;">ℹ</button>` : ''}
        </div>
        <span style="font-size:13px;font-weight:700;color:${h.color};font-family:'JetBrains Mono',monospace;">${fv}</span>
      </div>
      <div style="background:#0a1628;border-radius:4px;height:5px;overflow:hidden;">
        <div style="height:100%;width:${barW}%;background:${h.color};border-radius:4px;transition:width 0.5s;"></div>
      </div>
    </div>`;
  });

  // Promoter pledge warning
  const prom = R.promoter;
  if (prom !== null) {
    const promMsg = prom < 35
      ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;font-size:11px;color:#f87171;margin-top:8px;">⚠️ Promoter holding low (${prom.toFixed(1)}%) — low promoter confidence signal</div>`
      : prom >= 50
      ? `<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:8px 12px;font-size:11px;color:#86efac;margin-top:8px;">✅ Promoter holding strong (${prom.toFixed(1)}%) — positive confidence signal</div>`
      : '';
    html += promMsg;
  }

  html += '</div>';
  return html;
}

// ============================================================
// TAB 4 — QUARTERLY RESULTS
// ============================================================
async function _buildQuarterlyTab(res, sym) {
  const d = _learnCache[sym];
  if (!d || !d.salesQ1) { res.innerHTML = _learnNoData(sym, 'Quarterly data'); return; }
  const qs = ['Q1','Q2','Q3','Q4','Q5'];
  const rows = [
    { label: 'Sales',      vals: qs.map(q => d['sales'+q]) },
    { label: 'Expenses',   vals: qs.map(q => d['exp'+q]) },
    { label: 'Op Profit',  vals: qs.map(q => d['op'+q]) },
    { label: 'Other Inc',  vals: qs.map(q => d['otherInc'+q]) },
    { label: 'PBT',        vals: qs.map(q => d['pbt'+q]) },
    { label: 'Net Profit', vals: qs.map(q => d['np'+q]) },
  ];
  const fmt = v => (v && v !== 0) ? '\u20B9' + Number(v).toFixed(0) + ' Cr' : '--';
  let html = `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">QUARTERLY RESULTS (Last 5 Quarters)</span>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr style="background:rgba(255,255,255,0.03);">
        <th style="padding:8px 10px;text-align:left;color:#64748b;">Metric</th>
        ${qs.map(q=>`<th style="padding:8px 6px;text-align:right;color:#64748b;">${q}</th>`).join('')}
      </tr>`;
  rows.forEach((row, idx) => {
    html += `<tr style="${idx%2===0?'background:rgba(255,255,255,0.01);':''}">
      <td style="padding:8px 10px;color:#cbd5e1;font-weight:600;">${row.label}</td>
      ${row.vals.map(v=>`<td style="padding:8px 6px;text-align:right;color:#e2e8f0;font-family:'JetBrains Mono',monospace;">${fmt(v)}</td>`).join('')}
    </tr>`;
  });
  html += `</table></div></div>
  <div style="font-size:10px;color:#4b6280;padding:8px 2px;">Source: Screener.in via Firebase</div>`;
  res.innerHTML = html;
}
// ============================================================
// TAB 5 — CASH FLOW
// ============================================================
async function _buildCashflowTab(res, sym) {
  const d = _learnCache[sym];
  if (!d) { res.innerHTML = _learnNoData(sym, 'Cash Flow data'); return; }

  const items = [
    { label: 'Free Cash Flow',   val: d.fcf,       positive: true,  fmt: 'cr' },
    { label: 'Total Debt',       val: d.totalDebt,  positive: false, fmt: 'cr' },
    { label: 'Current Assets',   val: d.currAsset,  positive: true,  fmt: 'cr' },
    { label: 'Current Liab',     val: d.currLiab,   positive: false, fmt: 'cr' },
    { label: 'Debt/Equity',      val: d.deRatio,    positive: null,  fmt: 'ratio' },
    { label: 'ROA',              val: d.roa,        positive: true,  fmt: 'pct' },
    { label: 'EBITDA',           val: d.ebitda,     positive: true,  fmt: 'cr' },
  ].filter(i => i.val !== null && i.val !== undefined && i.val !== 0);

  if (items.length === 0) { res.innerHTML = _learnNoData(sym, 'Cash Flow data'); return; }

  const fmtVal = (item) => {
    if (item.fmt === 'ratio') return Number(item.val).toFixed(2) + 'x';
    if (item.fmt === 'pct')   return Number(item.val).toFixed(2) + '%';
    return '\u20B9' + Number(item.val).toFixed(0) + ' Cr';
  };

  let html = `<div style="background:#0d1f35;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;">CASH FLOW & LIQUIDITY</span>
    </div>`;

  items.forEach((item, idx) => {
    const numVal = Number(item.val);
    const dot = item.positive === true ? (numVal >= 0 ? '#22c55e' : '#ef4444')
              : item.positive === false ? '#f59e0b' : '#64748b';
    const valColor = item.positive === true ? (numVal >= 0 ? '#22c55e' : '#ef4444') : '#e2e8f0';
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;${idx<items.length-1?'border-bottom:1px solid rgba(255,255,255,0.04);':''}">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#cbd5e1;">${item.label}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:${valColor};font-family:'JetBrains Mono',monospace;">${fmtVal(item)}</span>
    </div>`;
  });

  html += '</div>';

  const fcf = d.fcf;
  if (fcf) {
    const fcfNote = fcf > 0
      ? `<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:8px 12px;font-size:11px;color:#86efac;margin-top:8px;">Free Cash Flow Positive (\u20B9${Number(fcf).toFixed(0)} Cr) — company generating real cash</div>`
      : `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;font-size:11px;color:#f87171;margin-top:8px;">Negative Free Cash Flow — monitor capital allocation</div>`;
    html += fcfNote;
  }

  const cr = d.currAsset && d.currLiab && d.currLiab > 0 ? (d.currAsset / d.currLiab).toFixed(2) : null;
  if (cr) {
    const crColor = cr >= 1.5 ? '#22c55e' : cr >= 1 ? '#f59e0b' : '#ef4444';
    html += `<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:8px 12px;font-size:11px;color:${crColor};margin-top:8px;">Current Ratio: ${cr}x ${cr >= 1.5 ? '— Strong liquidity' : cr >= 1 ? '— Adequate' : '— Low liquidity risk'}</div>`;
  }

  html += `<div style="font-size:10px;color:#4b6280;padding:8px 2px;">Source: Screener.in via Firebase</div>`;
  res.innerHTML = html;
}
function _learnNoData(sym, label) {
  return `<div style="text-align:center;padding:30px 14px;">
    <div style="font-size:28px;margin-bottom:8px;">📭</div>
    <div style="font-size:13px;color:#64748b;">${label} not available for ${sym}</div>
    <div style="font-size:11px;color:#4b6280;margin-top:4px;">Try checking Settings → API URL</div>
  </div>`;
}

// ── PDF Download ───────────────────────────────────────────
function downloadLearnPDF(sym) {
  const d = _learnCache[sym];
  if (!d) { showPopup('Data not loaded yet'); return; }
  const R = calcLearnRatios(d);
  const today = new Date();
  const dateStr = today.getDate()+'/'+(today.getMonth()+1)+'/'+today.getFullYear();

  const metrics = [
    {key:'pe',      label:'P/E Ratio',          unit:''},
    {key:'eps',     label:'EPS',                unit:'₹'},
    {key:'roe',     label:'ROE %',              unit:'%'},
    {key:'roce',    label:'ROCE %',             unit:'%'},
    {key:'bookVal', label:'Book Value',         unit:'₹'},
    {key:'de',      label:'Debt-to-Equity',     unit:''},
    {key:'cr',      label:'Current Ratio',      unit:''},
    {key:'divYield',label:'Dividend Yield %',   unit:'%'},
    {key:'promoter',label:'Promoter Holding %', unit:'%'},
    {key:'fii',     label:'FII Holding %',      unit:'%'},
    {key:'dii',     label:'DII Holding %',      unit:'%'},
    {key:'roa',     label:'ROA %',              unit:'%'},
    {key:'rsi',     label:'RSI (14D)',          unit:''}
  ];

  const dotColor = (m, v) => {
    const c = _learnDot(m, v);
    return c === '#22c55e' ? '#16a34a' : c === '#f59e0b' ? '#b45309' : c === '#ef4444' ? '#b91c1c' : '#94a3b8';
  };

  const rows = metrics.map(m => {
    const val = R[m.key];
    const fv = val === null ? '--' : (m.unit === '₹' ? '₹'+val.toFixed(2) : val.toFixed(2)+m.unit);
    const col = dotColor(m.key, val);
    const info = LEARN_INFO[m.key]?.en;
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #1e2d3d;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:8px;vertical-align:middle;"></span>
        <strong style="color:#e2e8f0;font-size:12px;">${m.label}</strong>
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #1e2d3d;font-family:monospace;font-size:13px;font-weight:bold;color:${col};">${fv}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #1e2d3d;font-size:10px;color:#64748b;">${info?.good||''}</td>
    </tr>`;
  }).join('');

  const sp = d.sharePrice > 0 ? '₹'+d.sharePrice.toFixed(2) : 'N/A';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${sym} — Fundamental Report</title>
  <style>body{background:#060e1a;color:#e2e8f0;font-family:Arial,sans-serif;margin:0;padding:20px;}
  table{width:100%;border-collapse:collapse;}
  .hdr{background:linear-gradient(90deg,#0d1f35,#1e3a5f);padding:18px 22px;border-radius:12px;margin-bottom:18px;border:1px solid rgba(251,146,60,0.2);}
  .hdr h1{margin:0;font-size:22px;color:#fb923c;} .hdr p{margin:4px 0 0;font-size:11px;color:#64748b;}
  .badge{display:inline-block;background:#0a1628;padding:5px 12px;border-radius:6px;font-size:11px;color:#38bdf8;font-weight:bold;margin-right:8px;margin-top:8px;}
  @media print{body{background:#fff;color:#000;} .hdr{background:#f0f4f8;border:1px solid #ddd;} .hdr h1{color:#c2410c;} .hdr p{color:#475569;} td{color:#000!important;border-bottom:1px solid #ddd!important;} strong{color:#1a202c!important;}}</style>
  </head><body>
  <div class="hdr">
    <h1>${sym} — Fundamental Analysis</h1>
    <p>RealTradePro · ${dateStr} · Search & Learn</p>
    <div style="margin-top:8px;">
      <span class="badge">Price: ${sp}</span>
      <span class="badge">Source: ${d.source==='firebase'?'Firebase':'GAS Sheet'}</span>
    </div>
  </div>
  <table><thead><tr style="background:#0d1f35;">
    <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;border-bottom:2px solid #1e3a5f;">Metric</th>
    <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;border-bottom:2px solid #1e3a5f;">Value</th>
    <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;border-bottom:2px solid #1e3a5f;">Benchmark</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div style="margin-top:18px;padding:12px;background:#0d1f35;border-radius:8px;font-size:10px;color:#4b6280;border:1px solid #1e2d3d;">
    Raw data: Net Profit ${d.netProfit}Cr · Total Equity ${d.totalEquity}Cr · Shares ${d.totalShares}Cr · EBIT ${d.ebit}Cr · ROCE ${d.capEmployed}% · Total Debt ${d.totalDebt}Cr · Promoter ${d.promoter}%
  </div>
  <div style="text-align:center;font-size:10px;color:#4b6280;margin-top:14px;">RealTradePro · Search & Learn · For personal reference only</div>
  </body></html>`;

  // Blob URL approach — works on mobile without popup blockers
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
        a.href = blobUrl;
        a.download = sym + '_FundamentalReport.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch(e) {
    // Fallback to window.open
    const w = window.open('', '_blank', 'width=820,height=680');
    if (!w) { showPopup('Popup blocked! Allow popups for PDF.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  }
}
// ============================================================
// END SEARCH & LEARN
// ============================================================

// Settings collapsible toggle (used by settings tab sections)
function sToggle(bodyId, arrId){
  const b = document.getElementById(bodyId);
  const a = document.getElementById(arrId);

  if (!b || !a) return;

  const hidden = b.style.display === 'none' || b.style.display === '';
  b.style.display = hidden ? 'block' : 'none';
  a.textContent = hidden ? '▼' : '▶';
}
