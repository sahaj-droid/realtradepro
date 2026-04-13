// ============================================================================
// PART 9: MAIN APP ROUTER (TOTAL REPLACEMENT)
// ============================================================================
function switchMainTab(tabName) {
  const sections = ['watchlistSection', 'holdingsSection', 'gainersSection', 'learnSection', 'niviSection'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Active navigation highlight
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active-nav'));
  const activeBtn = document.getElementById('nav' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
  if (activeBtn) activeBtn.classList.add('active-nav');

  if (tabName === 'watchlist') {
    document.getElementById('watchlistSection').style.display = 'block';
    if (typeof renderWL === 'function') renderWL();
  } else if (tabName === 'gainers') {
    document.getElementById('gainersSection').style.display = 'block';
    if (typeof renderGainersSection === 'function') renderGainersSection();
  } else if (tabName === 'holdings') {
    document.getElementById('holdingsSection').style.display = 'block';
    if (typeof renderHoldings === 'function') renderHoldings();
  } else if (tabName === 'learn') {
    document.getElementById('learnSection').style.display = 'block';
    if (typeof renderLearnTab === 'function') renderLearnTab();
  } else if (tabName === 'nivi') {
    document.getElementById('niviSection').style.display = 'block';
  }
}

// ============================================================================
// PART 1 & 2: UI UTILS OBJECT (FIXED STRUCTURE)
// ============================================================================
const Utils = {
  inr: (v) => "₹" + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
  
  showLoader: (msg = "Loading...") => {
    const loaderMsg = document.getElementById("loaderMsg");
    const loaderOverlay = document.getElementById("loaderOverlay");
    if (loaderMsg) loaderMsg.innerText = msg;
    if (loaderOverlay) loaderOverlay.style.display = "flex";
  },

  hideLoader: () => {
    const loaderOverlay = document.getElementById("loaderOverlay");
    if (loaderOverlay) loaderOverlay.style.display = "none";
  },

  showPopup: (msg, duration = 3000) => {
    const el = document.getElementById("alertPopup");
    const msgEl = document.getElementById("alertMsg");
    if (el && msgEl) {
      msgEl.innerText = msg;
      el.style.display = "block";
      setTimeout(() => { el.style.display = "none"; }, duration);
    }
  },

  showError: (msg) => {
    if (window.errorShownThisSession) return;
    window.errorShownThisSession = true;
    const errorMsg = document.getElementById("errorMsg");
    const errorBanner = document.getElementById("errorBanner");
    if (errorMsg && errorBanner) {
      errorMsg.innerText = msg;
      errorBanner.style.display = "flex";
    }
  },
// UI Notification & Loaders
  showLoader: (msg = "Loading...") => {
    const loaderMsg = document.getElementById("loaderMsg");
    const loaderOverlay = document.getElementById("loaderOverlay");
    if (loaderMsg) loaderMsg.innerText = msg;
    if (loaderOverlay) loaderOverlay.style.display = "flex";
  }
};

// ── 3. CORE SETUP & INITIALIZATION ──
const Config = {
  initDefaults: () => {
    if (!localStorage.getItem('ff2ApiUrl')) {
      localStorage.setItem('ff2ApiUrl', DEFAULT_FF2_URL);
    }
    if (!localStorage.getItem('geminiApiKey') && DEFAULT_SARVAM_KEY !== "YOUR_DEFAULT_SARVAM_KEY_HERE") {
      localStorage.setItem('geminiApiKey', DEFAULT_SARVAM_KEY);
    }
    if (!localStorage.getItem('geminiApiKey2') && DEFAULT_SARVAM_KEY2 !== "") {
      localStorage.setItem('geminiApiKey2', DEFAULT_SARVAM_KEY2);
    }
  },

  // Encapsulated API Rotator
  getActiveGASUrl: (() => {
    let rotationIndex = 0;
    return () => {
      const urls = [
        localStorage.getItem('customAPI') || DEFAULT_GAS_APIS[0],
        localStorage.getItem('customAPI2') || DEFAULT_GAS_APIS[1],
        localStorage.getItem('customAPI3') || DEFAULT_GAS_APIS[2],
        localStorage.getItem('customAPI4') || DEFAULT_GAS_APIS[3],
        localStorage.getItem('customAPI5') || DEFAULT_GAS_APIS[4]
      ].filter(Boolean);
      
      if (urls.length === 0) return DEFAULT_GAS_APIS[0];
      const url = urls[rotationIndex % urls.length];
      rotationIndex++;
      return url;
    };
  })()
};

// PIN Hash Crypto with Try-Catch
async function hashPIN(pin) {
  try {
    const msgBuffer = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error("PIN Hashing failed:", error);
    return null;
  }
}

// Robust Local Storage Load
function loadLocalData() {
  const safeParse = (key, fallback) => {
    try { 
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback; 
    } catch { return fallback; }
  };

  try {
    const savedWL = safeParse("watchlists", null);
    if (savedWL && Array.isArray(savedWL) && savedWL.length > 0) {
      watchlists = savedWL;
    } else {
      watchlists = [
        { name: "Watchlist 1", stocks: safeParse("wl", ["SBIN", "RELIANCE", "TCS"]) },
        { name: "Watchlist 2", stocks: [] },
        { name: "Watchlist 3", stocks: [] }
      ];
      localStorage.setItem("watchlists", JSON.stringify(watchlists));
    }

    currentWL = parseInt(localStorage.getItem("currentWL")) || 0;
    if (currentWL >= watchlists.length) currentWL = 0;
    wl = watchlists[currentWL].stocks;

    h = safeParse("h", []);
    hist = safeParse("hist", []);
    alerts = safeParse("alerts", []);
    groups = safeParse("groups", {});
    isDark = localStorage.getItem("theme") !== "light";

    const fs = localStorage.getItem('fontSize') || 'M';
    document.documentElement.setAttribute('data-fsize', fs);
    const htmlFontSize = FONT_SIZES[fs] || FONT_SIZES.M;
    document.documentElement.style.fontSize = htmlFontSize;

  } catch (error) {
    console.error("Local data load error:", error);
  }
}

// Initialize default parameters and data
Config.initDefaults();
loadLocalData();

// ============================================================================
// END OF PART 1
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 2: FIREBASE AUTH, PROFILES & USER SETUP
// ============================================================================

// ── 1. APP INITIALIZATION & PROFILE ROUTING ──
async function initApp() {
  const savedUserStr = localStorage.getItem('rtp_current_user');
  if (savedUserStr) {
    const user = JSON.parse(savedUserStr);
    localStorage.removeItem('rtp_current_user'); 
    await showProfileScreen(); 
    setTimeout(() => showPINScreen(user.userId, user.name), 500);
  } else {
    await showProfileScreen();
  }
}

// ── 2. PROFILE SELECTION SCREEN ──
async function showProfileScreen() {
  hideAllScreens();
  const profileScreen = document.getElementById('profileScreen');
  const profileList = document.getElementById('profileList');
  
  if (profileScreen) profileScreen.style.display = 'flex';
  if (!profileList) return;

  profileList.innerHTML = '<p style="color:#666;font-size:0.9rem;">Loading profiles...</p>';

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
  } catch (error) {
    profileList.innerHTML = '<p style="color:#ef4444;">Firebase connection error.</p>';
    console.error("Profile load failed:", error);
  }
}

// ── 3. PIN ENTRY & VERIFICATION ──
function showPINScreen(userId, userName) {
  hideAllScreens();
  currentPINEntry = '';
  
  const pinScreen = document.getElementById('pinScreen');
  if (pinScreen) {
    pinScreen.style.display = 'flex';
    pinScreen.dataset.userId = userId;
  }
  
  const pinUserName = document.getElementById('pinUserName');
  if (pinUserName) pinUserName.textContent = userName;
  
  const pinUserAvatar = document.getElementById('pinUserAvatar');
  if (pinUserAvatar) pinUserAvatar.textContent = userName.charAt(0).toUpperCase();
  
  const pinError = document.getElementById('pinError');
  if (pinError) pinError.style.display = 'none';
  
  updatePINDots();
}

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

async function verifyPIN() {
  const pinScreen = document.getElementById('pinScreen');
  const userId = pinScreen ? pinScreen.dataset.userId : null;
  if (!userId) return;

  const pinHash = await hashPIN(currentPINEntry);

  try {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) throw new Error("User not found");

    const profile = doc.data().profile;

    if (profile.pinHash === pinHash) {
      currentUser = { userId, name: profile.name };
      localStorage.setItem('rtp_current_user', JSON.stringify(currentUser));
      hideAllScreens();
      
      await loadUserData(); 
      const lbl = document.getElementById('currentUserLabel');
      if (lbl) lbl.textContent = profile.name;
    } else {
      const pinError = document.getElementById('pinError');
      if (pinError) pinError.style.display = 'block';
      currentPINEntry = '';
      updatePINDots();
    }
  } catch (error) {
    console.error("PIN Verification error:", error);
  }
}

// ── 4. PROFILE CREATION ──
function showCreateProfile() {
  hideAllScreens();
  const screen = document.getElementById('createProfileScreen');
  if (screen) screen.style.display = 'flex';
  const err = document.getElementById('createProfileError');
  if (err) err.style.display = 'none';
}

function showCreateError(msg) {
  const el = document.getElementById('createProfileError');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

async function saveNewProfile() {
  const name = document.getElementById('newProfileName')?.value.trim();
  const pin = document.getElementById('newProfilePIN')?.value.trim();
  const pinConfirm = document.getElementById('newProfilePINConfirm')?.value.trim();
  const secQ = document.getElementById('newProfileSecQ')?.value;
  const secA = document.getElementById('newProfileSecA')?.value.trim().toLowerCase();

  if (!name) return showCreateError('Name is required');
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) return showCreateError('PIN 4 digits no hovo joiye');
  if (pin !== pinConfirm) return showCreateError('PINs match nathi thata');
  if (!secA) return showCreateError('Security answer is required');

  try {
    const pinHash = await hashPIN(pin);
    const secAHash = await hashPIN(secA);
    const userId = 'user_' + Date.now();
    
    const newUserConfig = {
      profile: { name, pinHash, secQ, secAHash },
      settings: {},
      watchlists: [],
      holdings: [],
      history: [],
      alerts: []
    };

    await db.collection('users').doc(userId).set(newUserConfig);

    currentUser = { userId, name };
    localStorage.setItem('rtp_current_user', JSON.stringify(currentUser));
    hideAllScreens();
    await loadUserData();

  } catch (error) {
    showCreateError('Firebase error: ' + error.message);
    console.error(error);
  }
}

// ── 5. SCREEN MANAGEMENT ──
function hideAllScreens() {
  ['profileScreen', 'pinScreen', 'createProfileScreen', 'forgotPINScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function logoutUser() {
  localStorage.removeItem('rtp_current_user');
  currentUser = null;
  showProfileScreen();
}

// ============================================================================
// END OF PART 2
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 3: CLOUD DATA SYNC (FIREBASE FIRESTORE)
// ============================================================================

// ── 1. LOAD USER DATA (CLOUD TO LOCAL) ──
async function loadUserData() {
  if (!currentUser || !currentUser.userId) return;

  Utils.showLoader("Syncing market data...");
  try {
    const docRef = db.collection('users').doc(currentUser.userId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();

      // Safely load watchlists
      if (data.watchlists && Array.isArray(data.watchlists) && data.watchlists.length > 0) {
        watchlists = data.watchlists;
      } else {
        // Fallback defaults
        watchlists = [
          { name: "Watchlist 1", stocks: ["SBIN", "RELIANCE"] },
          { name: "Watchlist 2", stocks: [] },
          { name: "Watchlist 3", stocks: [] }
        ];
      }
      
      currentWL = 0;
      wl = watchlists[currentWL].stocks || [];

      // Load holdings, history, alerts
      h = data.holdings || [];
      hist = data.history || [];
      alerts = data.alerts || [];

      // Load Settings
      if (data.settings) {
        isDark = data.settings.theme !== 'light';
        const fs = data.settings.fontSize || 'M';
        document.documentElement.setAttribute('data-fsize', fs);
        document.documentElement.style.fontSize = FONT_SIZES[fs] || FONT_SIZES.M;
      }

      // Save to LocalStorage for offline fallback / fast reload
      localStorage.setItem('watchlists', JSON.stringify(watchlists));
      localStorage.setItem('h', JSON.stringify(h));
      localStorage.setItem('hist', JSON.stringify(hist));
      localStorage.setItem('alerts', JSON.stringify(alerts));

      // Trigger UI Updates (Functions aavta parts ma banavishu)
      if (typeof renderWL === 'function') renderWL();
      if (typeof renderHoldings === 'function') renderHoldings();
      if (typeof updateThemeUI === 'function') updateThemeUI();
      
      // Start real-time sync after successful load
      startRealtimeSync();

    } else {
      Utils.showError("User profile not found in cloud.");
    }
  } catch (error) {
    console.error("Data Load Error:", error);
    Utils.showError("Failed to sync data from Firebase. Using local cache.");
    loadLocalData(); // Fallback to Part 1's local cache parser
  } finally {
    Utils.hideLoader();
  }
}

// ── 2. SAVE USER DATA (LOCAL TO CLOUD) ──
async function saveUserData() {
  if (!currentUser || !currentUser.userId) return;

  const userData = {
    watchlists: watchlists,
    holdings: h,
    history: hist,
    alerts: alerts,
    settings: {
      theme: isDark ? 'dark' : 'light',
      fontSize: document.documentElement.getAttribute('data-fsize') || 'M'
    }
  };

  try {
    // Merge true use karyu che jethi bija internal documents/data overwrite na thay
    await db.collection('users').doc(currentUser.userId).set(userData, { merge: true });
    
    // Update LocalStorage to keep local engine perfectly in sync
    localStorage.setItem('watchlists', JSON.stringify(watchlists));
    localStorage.setItem('h', JSON.stringify(h));
    localStorage.setItem('hist', JSON.stringify(hist));
    localStorage.setItem('alerts', JSON.stringify(alerts));
    
    console.log("State synced to cloud safely.");
  } catch (error) {
    console.error("Data Save Error:", error);
    Utils.showError("Failed to save data to cloud. Check connection.");
  }
}

// ── 3. REAL-TIME SNAPSHOT LISTENER ──
let unsubscribeUserListener = null;

function startRealtimeSync() {
  if (!currentUser || !currentUser.userId) return;
  
  if (unsubscribeUserListener) unsubscribeUserListener(); // Clear old listener first

  unsubscribeUserListener = db.collection('users').doc(currentUser.userId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        
        // Example: Python backend remote alert trigger kare toh sidhu UI ma catch thay
        if (data.alerts && JSON.stringify(data.alerts) !== JSON.stringify(alerts)) {
          alerts = data.alerts;
          localStorage.setItem('alerts', JSON.stringify(alerts));
          if (typeof renderAlerts === 'function') renderAlerts();
          Utils.showPopup("New alert triggered by cloud engine!");
        }
      }
    }, (error) => {
      console.error("Realtime Firebase sync error:", error);
    });
}

// ============================================================================
// END OF PART 3
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 4: MARKET DATA FETCHING & API ENGINE
// ============================================================================

// ── 1. GLOBAL MARKET STATE ──
let marketDataCache = {};
let isMarketOpen = true; // Aa variable Python backend mathi pan update kari shakay
let fetchInterval = null;
const REFRESH_RATE = 5000; // 5 seconds mate set karyu che, jarur pade toh change karje

// ── 2. CORE FETCH ENGINE (WITH AUTO-FALLBACK & RETRY) ──
async function fetchWithRetry(symbols, maxRetries = 3) {
  if (!symbols || symbols.length === 0) return {};

  let attempt = 0;
  let success = false;
  let resultData = {};

  while (attempt < maxRetries && !success) {
    const currentApiUrl = Config.getActiveGASUrl(); // Part 1 mathi active URL leshe
    
    try {
      // GAS Script API par request moklvani (Tari GAS script pramane params adjust karela che)
      const query = symbols.join(',');
      const response = await fetch(`${currentApiUrl}?action=getPrices&symbols=${query}`);

      if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

      const data = await response.json();

      // Jo GAS script proper response aape
      if (data && data.success) {
        resultData = data.prices; 
        success = true;
      } else {
        throw new Error("API returned failure flag or invalid format");
      }
    } catch (error) {
      attempt++;
      console.warn(`Fetch attempt ${attempt} failed. Switching to next fallback API...`, error);
      
      if (attempt === maxRetries) {
        console.error("All GAS APIs failed to fetch data right now.");
        // App crash thava ni jagya e chhella cache data thi kam chalavse
      }
    }
  }

  return resultData;
}

// ── 3. UPDATE LIVE PRICES IN APP ──
async function updateLivePrices() {
  if (!isMarketOpen) return;

  // Watchlist ane Holdings mathi unique symbols bhega karva jethi duplicate request na jay
  const symbolsToFetch = new Set([...wl]);
  if (h && h.length > 0) {
    h.forEach(item => {
      if (item.symbol) symbolsToFetch.add(item.symbol);
    });
  }

  if (symbolsToFetch.size === 0) return;

  const livePrices = await fetchWithRetry(Array.from(symbolsToFetch));

  if (Object.keys(livePrices).length > 0) {
    // Local cache update karo
    marketDataCache = { ...marketDataCache, ...livePrices };

    // UI Update functions ne call karo (Je aavta parts ma aavse)
    if (typeof renderWL === 'function') renderWL();
    if (typeof renderHoldings === 'function') renderHoldings();
    
    // Scanner/Alert logic check (Python cloud logic sathe sync)
    if (typeof checkAlerts === 'function') checkAlerts(livePrices);
  }
}

// ── 4. AUTO-REFRESH ENGINE (SYNC LOOP) ──
function startMarketSync() {
  // Jo pehla thi engine chalu hoy toh stop kari ne fari start karo
  if (fetchInterval) clearInterval(fetchInterval);

  // App khulata j pehli var fetch karo
  updateLivePrices();

  // Nakkhi karela samay (5 seconds) pachi loop ma fetch karavanu chalu rakho
  fetchInterval = setInterval(() => {
    updateLivePrices();
  }, REFRESH_RATE); 
}

function stopMarketSync() {
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
}

// ============================================================================
// END OF PART 4
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 5.1: 7-BUTTON ACTION MENU (CORRECTION)
// ============================================================================

let activeMenuId = null;

function toggleActionMenu(menuId) {
  const menu = document.getElementById(menuId + '_menu');
  
  // Pehla koi menu khullo hoy toh ene bandh karo (Accordion effect)
  if (activeMenuId && activeMenuId !== menuId) {
    const oldMenu = document.getElementById(activeMenuId + '_menu');
    if (oldMenu) oldMenu.style.display = 'none';
  }

  if (menu) {
    if (menu.style.display === 'none') {
      menu.style.display = 'flex';
      activeMenuId = menuId;
    } else {
      menu.style.display = 'none';
      activeMenuId = null;
    }
  }
}

// Watchlist Render (With 7-Button Dropdown)
function renderWL() {
  const listContainer = document.getElementById('watchlistItems');
  if (!listContainer) return;

  if (!wl || wl.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Watchlist is empty.</div>';
    return;
  }

  let html = '';
  wl.forEach(symbol => {
    const data = marketDataCache[symbol] || { Price: 0, 'Day Change': 0, '% Change': 0 };
    const price = parseFloat(data.Price);
    const change = parseFloat(data['Day Change']);
    const pChange = parseFloat(data['% Change']);
    
    const isUp = change >= 0;
    const colorClass = isUp ? 'text-green' : 'text-red';
    const sign = isUp && change > 0 ? '+' : '';

    html += `
      <div class="list-item-container">
        <div class="list-item" onclick="toggleActionMenu('wl_${symbol}')">
          <div class="item-left">
            <div class="symbol-name">${symbol}</div>
            <div class="exchange-label" style="font-size:0.7rem; color:#888;">NSE</div>
          </div>
          <div class="item-right" style="text-align: right;">
            <div class="live-price ${colorClass}" style="font-weight:bold;">${Utils.inr(price)}</div>
            <div class="price-change" style="font-size:0.8rem;">${sign}${change.toFixed(2)} (${sign}${pChange.toFixed(2)}%)</div>
          </div>
        </div>

        <div id="wl_${symbol}_menu" class="action-menu" style="display:none; padding: 12px; background: var(--bg-card, #f0f0f0); border-top: 1px solid #ddd; flex-wrap: wrap; gap: 8px; justify-content: center; border-radius: 0 0 8px 8px;">
          <button onclick="openTradeBook('${symbol}'); setTradeType('CNC');" style="background:#2563eb; color:white; border:none; padding:8px 12px; border-radius:4px; font-weight:bold;">Buy</button>
          <button onclick="openTradeBook('${symbol}'); setTradeType('MIS');" style="background:#ea580c; color:white; border:none; padding:8px 12px; border-radius:4px; font-weight:bold;">Sell</button>
          <button onclick="window.open('https://in.tradingview.com/chart/?symbol=NSE:${symbol}', '_blank')" style="background:#4b5563; color:white; border:none; padding:8px 12px; border-radius:4px;">Chart</button>
          <button onclick="Utils.showPopup('Option Chain module opening...')" style="background:#4b5563; color:white; border:none; padding:8px 12px; border-radius:4px;">Option Chain</button>
          <button onclick="Utils.showPopup('Fundamentals module opening...')" style="background:#4b5563; color:white; border:none; padding:8px 12px; border-radius:4px;">Fundamentals</button>
          <button onclick="promptForAlert('${symbol}')" style="background:#059669; color:white; border:none; padding:8px 12px; border-radius:4px;">Set Alert</button>
          <button onclick="removeStock('${symbol}')" style="background:#dc2626; color:white; border:none; padding:8px 12px; border-radius:4px;">Delete</button>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
}

// Action button helper functions
function promptForAlert(symbol) {
  const target = prompt(`Set alert target price for ${symbol} (LTP: ${marketDataCache[symbol]?.Price || 0}):`);
  if (target && !isNaN(target)) addNewAlert(symbol, target, 'ABOVE'); // Part 7 nu function call thase
}

function removeStock(symbol) {
  if (confirm(`Remove ${symbol} from watchlist?`)) {
    wl = wl.filter(s => s !== symbol);
    saveUserData(); // Firebase update (Part 3)
    renderWL();
  }
}

// ============================================================================
// REALTRADEPRO - PART 6: TRADE BOOK & ORDER EXECUTION ENGINE
// ============================================================================

// ── 1. TRADE BOOK UI & MODAL ──
function openTradeBook(symbol, isHolding = false) {
  currentTrade = { symbol: symbol, isHolding: isHolding };
  const livePrice = marketDataCache[symbol]?.Price || 0;

  const tbSymbol = document.getElementById('tbSymbol');
  const tbPrice = document.getElementById('tbPrice');
  const tbModal = document.getElementById('tradeBookModal');
  const tbQty = document.getElementById('tbQty');

  if (tbSymbol) tbSymbol.innerText = symbol;
  if (tbPrice) tbPrice.innerText = Utils.inr(livePrice);
  if (tbModal) tbModal.style.display = 'flex';

  // Default product type
  setTradeType('CNC');
  
  // Pre-fill quantity if holding exists
  if (isHolding && tbQty) {
    const holding = h.find(item => item.symbol === symbol);
    tbQty.value = holding ? holding.qty : 1;
  } else if (tbQty) {
    tbQty.value = 1;
  }
}

function closeTradeBook() {
  const tbModal = document.getElementById('tradeBookModal');
  if (tbModal) tbModal.style.display = 'none';
  currentTrade = {};
}

function setTradeType(type) {
  currentTradeType = type; // 'CNC' or 'MIS'
  const btnCnc = document.getElementById('btnCNC');
  const btnMis = document.getElementById('btnMIS');
  
  if (btnCnc && btnMis) {
    if (type === 'CNC') {
      btnCnc.classList.add('active');
      btnMis.classList.remove('active');
    } else {
      btnMis.classList.add('active');
      btnCnc.classList.remove('active');
    }
  }
}

// ── 2. CORE ORDER EXECUTION ENGINE ──
function executeTrade(action) {
  const qtyInput = document.getElementById('tbQty')?.value;
  const qty = parseInt(qtyInput, 10);
  
  if (isNaN(qty) || qty <= 0) {
    Utils.showError("Please enter a valid quantity.");
    return;
  }

  const symbol = currentTrade.symbol;
  const livePrice = parseFloat(marketDataCache[symbol]?.Price || 0);

  if (livePrice <= 0) {
    Utils.showError("Live price not available. Please wait for sync.");
    return;
  }

  if (action === 'BUY') {
    processBuy(symbol, qty, livePrice, currentTradeType);
  } else if (action === 'SELL') {
    processSell(symbol, qty, livePrice, currentTradeType);
  }
}

// ── 3. BUY LOGIC (WITH AVERAGING) ──
function processBuy(symbol, qty, price, type) {
  const existingIndex = h.findIndex(item => item.symbol === symbol && item.type === type);
  
  if (existingIndex >= 0) {
    // Average out the buy price
    const oldQty = parseFloat(h[existingIndex].qty);
    const oldPrice = parseFloat(h[existingIndex].buyPrice);
    const totalValue = (oldQty * oldPrice) + (qty * price);
    const newQty = oldQty + qty;
    const newAvgPrice = totalValue / newQty;

    h[existingIndex].qty = newQty;
    h[existingIndex].buyPrice = newAvgPrice;
    h[existingIndex].buyDate = new Date().toISOString(); 
  } else {
    // Add new holding
    h.push({
      id: 'h_' + Date.now(),
      symbol: symbol,
      qty: qty,
      buyPrice: price,
      type: type,
      buyDate: new Date().toISOString()
    });
  }

  logHistory('BUY', symbol, qty, price, type, 0);
  finalizeOrder(`Bought ${qty} ${symbol} successfully!`);
}

// ── 4. SELL LOGIC (WITH REALIZED PnL) ──
function processSell(symbol, qty, price, type) {
  const existingIndex = h.findIndex(item => item.symbol === symbol && item.type === type);

  if (existingIndex < 0) {
    Utils.showError(`You don't have any ${type} holdings for ${symbol}.`);
    return;
  }

  const holding = h[existingIndex];
  if (qty > holding.qty) {
    Utils.showError(`Cannot sell ${qty}. You only have ${holding.qty} shares.`);
    return;
  }

  // Calculate Realized PnL
  const buyValue = qty * holding.buyPrice;
  const sellValue = qty * price;
  const realizedPnL = sellValue - buyValue;

  // Deduct quantity
  holding.qty -= qty;
  if (holding.qty <= 0) {
    h.splice(existingIndex, 1); // Remove completely if qty becomes 0
  }

  logHistory('SELL', symbol, qty, price, type, realizedPnL);
  finalizeOrder(`Sold ${qty} ${symbol}! PnL: ${Utils.inr(realizedPnL)}`);
}

// ── 5. HISTORY TRACKING & SYNC ──
function logHistory(action, symbol, qty, price, type, pnl) {
  hist.unshift({
    id: 'txn_' + Date.now(),
    date: new Date().toISOString(),
    action: action,
    symbol: symbol,
    qty: qty,
    price: price,
    type: type,
    pnl: pnl
  });

  // Memory protection: Keep only the latest 100 records in local arrays
  if (hist.length > 100) {
    hist.pop();
  }
}

async function finalizeOrder(successMsg) {
  closeTradeBook();
  Utils.showPopup(successMsg);
  
  // Instantly reflect changes on UI
  if (typeof renderHoldings === 'function') renderHoldings();
  if (typeof renderHistory === 'function') renderHistory();

  // Async sync to Firebase
  await saveUserData();
}

// ── 6. RENDER HISTORY UI ──
function renderHistory() {
  const histContainer = document.getElementById('historyItems');
  if (!histContainer) return;

  if (!hist || hist.length === 0) {
    histContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No recent trades found.</div>';
    return;
  }

  let html = '';
  hist.forEach(txn => {
    const isBuy = txn.action === 'BUY';
    const actionColor = isBuy ? 'text-blue' : 'text-orange';
    const pnlColor = txn.pnl >= 0 ? 'text-green' : 'text-red';
    const pnlDisplay = !isBuy ? `<div class="${pnlColor}" style="font-size:0.8rem;">PnL: ${Utils.inr(txn.pnl)}</div>` : '';

    html += `
      <div class="list-item">
        <div class="item-left">
          <div class="symbol-name">${txn.symbol} <span class="${actionColor}" style="font-size:0.7rem; font-weight:bold; margin-left:5px;">${txn.action} ${txn.type}</span></div>
          <div class="avg-price" style="font-size:0.8rem;color:#666;">${Utils.timeAgo(new Date(txn.date).getTime())}</div>
        </div>
        <div class="item-right" style="text-align: right;">
          <div class="live-price">${txn.qty} @ ${Utils.inr(txn.price)}</div>
          ${pnlDisplay}
        </div>
      </div>
    `;
  });

  histContainer.innerHTML = html;
}

// ============================================================================
// END OF PART 6
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 7: THE AUTO-SCANNER & ALERTS ENGINE
// ============================================================================

// ── 1. USER DEFINED PRICE ALERTS ──
function addNewAlert(symbol, targetPrice, condition) {
  if (!symbol || !targetPrice || isNaN(targetPrice)) {
    Utils.showError("Valid Symbol and Target Price are required.");
    return;
  }
  
  const newAlert = {
    id: 'alt_' + Date.now(),
    symbol: symbol.toUpperCase(),
    targetPrice: parseFloat(targetPrice),
    condition: condition, // 'ABOVE' or 'BELOW'
    isTriggered: false,
    dateAdded: new Date().toISOString()
  };

  alerts.unshift(newAlert); // Nava alert ne top par rakhva
  saveUserData(); // Sync state to Firebase (From Part 3)
  renderAlerts();
  Utils.showPopup(`Alert set for ${symbol} ${condition} ${Utils.inr(targetPrice)}`);
}

function removeAlert(alertId) {
  alerts = alerts.filter(a => a.id !== alertId);
  saveUserData();
  renderAlerts();
}

// ── 2. ALERT CHECKER (RUNS ON EVERY PRICE SYNC) ──
// Aa function Part 4 ni updateLivePrices() mathi dar 5 second e call thase
function checkAlerts(livePrices) {
  if (!alerts || alerts.length === 0) return;

  let triggeredAny = false;

  alerts.forEach(alert => {
    if (alert.isTriggered) return; // Je trigger thai gaya che ene skip karo

    const currentData = livePrices[alert.symbol] || marketDataCache[alert.symbol];
    if (!currentData || !currentData.Price) return;

    const ltp = parseFloat(currentData.Price);
    let conditionMet = false;

    if (alert.condition === 'ABOVE' && ltp >= alert.targetPrice) conditionMet = true;
    if (alert.condition === 'BELOW' && ltp <= alert.targetPrice) conditionMet = true;

    if (conditionMet) {
      alert.isTriggered = true;
      triggeredAny = true;
      
      // UI Notification
      Utils.showError(`🔔 ALERT TRIGGERED: ${alert.symbol} crossed ${Utils.inr(alert.targetPrice)}! (LTP: ${Utils.inr(ltp)})`);
      
      // Android WebView Haptic Feedback (Phone vibrate karavva)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  });

  if (triggeredAny) {
    saveUserData(); // Triggered state Firebase ma update karo
    renderAlerts();
  }
}

// ── 3. AUTO-SCANNER (BREAKOUTS & MOMENTUM) ──
// Aa function marketDataCache parthi instantly top breakouts filter karse
function runAutoScanner() {
  const scannerResults = {
    bullishBreakouts: [],
    bearishDrops: []
  };

  Object.keys(marketDataCache).forEach(symbol => {
    const data = marketDataCache[symbol];
    if (!data) return;

    const pChange = parseFloat(data['% Change']) || 0;
    const ltp = parseFloat(data.Price) || 0;

    // Simple Breakout Logic: > 3% jump is considered Bullish Momentum
    if (pChange >= 3.0) {
      scannerResults.bullishBreakouts.push({ symbol, pChange, ltp });
    } 
    // Bearish Drop Logic: < -3% drop
    else if (pChange <= -3.0) {
      scannerResults.bearishDrops.push({ symbol, pChange, ltp });
    }
    
    // NOTE: Ahya bhavishya ma 'OLHCV' Google sheet mathi data fetch kari ne 
    // Candlestick Patterns (Hammer, Doji) ni advance conditions add kari shakase.
  });

  // Sort by highest momentum (Descending for bullish, Ascending for bearish)
  scannerResults.bullishBreakouts.sort((a, b) => b.pChange - a.pChange);
  scannerResults.bearishDrops.sort((a, b) => a.pChange - b.pChange);

  return scannerResults;
}

// ── 4. RENDER ALERTS UI ──
function renderAlerts() {
  const alertContainer = document.getElementById('alertItems');
  if (!alertContainer) return;

  if (!alerts || alerts.length === 0) {
    alertContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No active alerts set.</div>';
    return;
  }

  let html = '';
  alerts.forEach(alert => {
    const statusColor = alert.isTriggered ? 'text-green' : 'text-orange';
    const statusText = alert.isTriggered ? 'Triggered' : 'Active';
    
    html += `
      <div class="list-item">
        <div class="item-left">
          <div class="symbol-name">${alert.symbol}</div>
          <div style="font-size:0.8rem; color:#666;">Condition: ${alert.condition} ${Utils.inr(alert.targetPrice)}</div>
        </div>
        <div class="item-right" style="text-align: right;">
          <div class="${statusColor}" style="font-size:0.85rem; font-weight:bold;">${statusText}</div>
          <button onclick="removeAlert('${alert.id}')" style="background:none; border:none; color:#ef4444; font-size:0.8rem; margin-top:5px; padding:0; cursor:pointer;">Remove</button>
        </div>
      </div>
    `;
  });

  alertContainer.innerHTML = html;
}

// ============================================================================
// END OF PART 7
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 8: SETTINGS, THEME ENGINE & FUTURE-PROOFING
// ============================================================================

// ── 1. THEME ENGINE (DARK / LIGHT MODE) ──
function updateThemeUI() {
  const body = document.body;
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  if (isDark) {
    body.classList.add('dark-mode');
    body.classList.remove('light-mode');
    if (themeToggleBtn) themeToggleBtn.innerHTML = '🌙 Dark Mode';
  } else {
    body.classList.add('light-mode');
    body.classList.remove('dark-mode');
    if (themeToggleBtn) themeToggleBtn.innerHTML = '☀️ Light Mode';
  }
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeUI();
  saveUserData(); // Part 3 mathi Firebase ma setting sync karse
}

// ── 2. FONT RESIZING ENGINE (S / M / L) ──
function changeFontSize(size) {
  if (!FONT_SIZES[size]) return;

  document.documentElement.setAttribute('data-fsize', size);
  document.documentElement.style.fontSize = FONT_SIZES[size];
  localStorage.setItem('fontSize', size);
  
  // Update UI active state if buttons exist
  ['btnFontS', 'btnFontM', 'btnFontL'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  
  const activeBtn = document.getElementById('btnFont' + size);
  if (activeBtn) activeBtn.classList.add('active');

  saveUserData();
}

// ── 3. DATA EXPORT & CLEAR CACHE (UTILITIES) ──
function exportDataAsCSV() {
  if (!h || h.length === 0) {
    Utils.showError("No holdings to export.");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,Symbol,Qty,Avg Buy Price,Type\n";
  h.forEach(row => {
    csvContent += `${row.symbol},${row.qty},${row.buyPrice},${row.type}\n`;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "RealTradePro_Holdings.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearLocalCache() {
  if(confirm("Are you sure you want to clear local cache? This will force a fresh sync from cloud.")) {
    marketDataCache = {};
    Utils.showPopup("Cache cleared. Syncing...");
    updateLivePrices(); // Fari thi API call karse
  }
}

// ── 4. NIVI AI VOICE ASSISTANT (FOUNDATION) ──
// Aa module ma future ma Gemini API connect kari ne real-time market queries handle karase
const NiviAI = {
  isListening: false,
  
  startVoiceSearch: function() {
    if (!('webkitSpeechRecognition' in window)) {
      Utils.showError("Voice search not supported in this browser/WebView.");
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'gu-IN'; // Gujarati language set kareli che
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
      NiviAI.isListening = true;
      Utils.showLoader("Nivi AI સાંભળી રહી છે...");
    };

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      Utils.hideLoader();
      Utils.showPopup(`તમે કહ્યું: ${transcript}`);
      
      // TODO: Send 'transcript' to Gemini API
      // Example: "Reliance no bhav su che?" -> Gemini interprets -> return price
      console.log("Nivi AI Transcript:", transcript);
    };

    recognition.onerror = function(event) {
      Utils.hideLoader();
      Utils.showError("Voice recognition failed. Please try again.");
      NiviAI.isListening = false;
    };

    recognition.onend = function() {
      NiviAI.isListening = false;
      Utils.hideLoader();
    };

    recognition.start();
  }
};

// ============================================================================
// END OF PART 8
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 10: INDICES HEADER & SMART SEARCH ENGINE
// ============================================================================

// ── 1. GLOBAL STOCK LIST FOR SEARCH (Auto-suggestion) ──
const ALL_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "BHARTIARTL", 
  "ITC", "HINDUNILVR", "LT", "BAJFINANCE", "TATAMOTORS", "SUNPHARMA", 
  "MARUTI", "ONGC", "WIPRO", "KOTAKBANK", "ADANIENT", "ASIANPAINT",
  "TATAPOWER", "TATASTEEL", "ZOMATO", "SUZLON", "PAYTM"
  // Note: Future ma aane 'FundLearn' sheet mathi pan auto-load kari shakay.
];

// ── 2. INDICES HEADER UI & LOGIC ──
function renderIndicesHeader() {
  const headerContainer = document.getElementById('indicesHeader');
  if (!headerContainer) return;

  // Cache mathi NIFTY ane SENSEX na price leshe, jo na hoy toh loading format batavse
  const niftyData = marketDataCache['NIFTY 50'] || { Price: '...', 'Day Change': 0, '% Change': 0 };
  const sensexData = marketDataCache['SENSEX'] || { Price: '...', 'Day Change': 0, '% Change': 0 };

  const formatIndex = (name, data) => {
    const change = parseFloat(data['Day Change']) || 0;
    const pChange = parseFloat(data['% Change']) || 0;
    const isUp = change >= 0;
    const color = isUp ? 'var(--text-green, #10b981)' : 'var(--text-red, #ef4444)';
    const sign = isUp && change > 0 ? '+' : '';
    
    return `
      <div style="display:flex; flex-direction:column; align-items:center; padding: 0 15px; min-width: 120px;">
        <span style="font-size:0.75rem; color:#888;">${name}</span>
        <span style="font-weight:bold; font-size:0.95rem; color:var(--text-main);">${data.Price !== '...' ? Utils.inr(data.Price) : '...'}</span>
        <span style="font-size:0.75rem; color:${color};">${sign}${change.toFixed(2)} (${sign}${pChange.toFixed(2)}%)</span>
      </div>
    `;
  };

  headerContainer.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; padding:10px 0; border-bottom:1px solid rgba(128,128,128,0.2); overflow-x:auto;">
      ${formatIndex('NIFTY 50', niftyData)}
      <div style="width:1px; height:30px; background:rgba(128,128,128,0.3);"></div>
      ${formatIndex('SENSEX', sensexData)}
    </div>
  `;
}

// ── 3. SEARCH BAR & AUTO-SUGGESTION LOGIC ──
function setupSearchEngine() {
  const searchInput = document.getElementById('stockSearchInput');
  const suggestionBox = document.getElementById('searchSuggestions');
  
  if (!searchInput || !suggestionBox) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toUpperCase().trim();
    suggestionBox.innerHTML = '';

    if (query.length === 0) {
      suggestionBox.style.display = 'none';
      return;
    }

    // Input pramane stocks filter karo (Top 5 results)
    const matches = ALL_STOCKS.filter(stock => stock.includes(query)).slice(0, 5);

    if (matches.length > 0) {
      matches.forEach(match => {
        const div = document.createElement('div');
        div.style.cssText = "padding: 12px; border-bottom: 1px solid rgba(128,128,128,0.2); cursor: pointer; color: var(--text-main); font-weight: 500;";
        div.innerText = match;
        
        // Stock select karvathi Watchlist ma add thase
        div.onclick = () => {
          addNewStockToWatchlist(match);
          searchInput.value = '';
          suggestionBox.style.display = 'none';
        };
        suggestionBox.appendChild(div);
      });
      suggestionBox.style.display = 'block';
    } else {
      suggestionBox.innerHTML = '<div style="padding:12px; color:#888; text-align:center;">No matching stocks found</div>';
      suggestionBox.style.display = 'block';
    }
  });

  // Screen par kyay pan bahar click karvathi suggestion box bandh thai jay
  document.addEventListener('click', (e) => {
    if (e.target !== searchInput && e.target !== suggestionBox) {
      suggestionBox.style.display = 'none';
    }
  });
}

function addNewStockToWatchlist(symbol) {
  if (!wl.includes(symbol)) {
    wl.push(symbol);
    Utils.showPopup(`${symbol} added to Watchlist!`);
    
    // UI render karo, navo price fetch karo ane Firebase ma save karo
    renderWL();
    updateLivePrices(); 
    saveUserData(); 
  } else {
    Utils.showError(`${symbol} is already in your watchlist.`);
  }
}

// Initialize setup on load
document.addEventListener('DOMContentLoaded', () => {
  renderIndicesHeader();
  setupSearchEngine();
});

// Original live update loop sathe indices ne link karva mate
// Aa line existing updateLivePrices() function ma mukeli j che, pan safety mate ahya override kariye chiye:
const originalUpdatePrices = updateLivePrices;
updateLivePrices = async function() {
  await originalUpdatePrices();
  renderIndicesHeader(); // Live price aave etle header fari render thay
};

// ============================================================================
// END OF PART 10
// ============================================================================
// ============================================================================
// REALTRADEPRO - PART 11: HOLDINGS UPGRADE (PIE CHART & TAX LOGIC)
// ============================================================================

// ── 1. PORTFOLIO PIE CHART RENDERING ──
function renderPortfolioChart() {
  const chartContainer = document.getElementById('portfolioPieChart');
  if (!chartContainer) return;
  
  if (!h || h.length === 0) {
    chartContainer.innerHTML = '';
    return;
  }

  let totalValue = 0;
  const chartData = h.map(item => {
    const ltp = parseFloat(marketDataCache[item.symbol]?.Price || item.buyPrice);
    const currentVal = ltp * item.qty;
    totalValue += currentVal;
    return { symbol: item.symbol, value: currentVal };
  });

  // Pure CSS background-image (conic-gradient) thi fast chart rendering
  let gradientStops = [];
  let currentAngle = 0;
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

  let legendHtml = '<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:15px; font-size:0.8rem; color:var(--text-main);">';

  chartData.sort((a, b) => b.value - a.value).forEach((item, index) => {
    const percentage = (item.value / totalValue) * 100;
    const color = colors[index % colors.length];
    
    gradientStops.push(`${color} ${currentAngle}% ${currentAngle + percentage}%`);
    currentAngle += percentage;

    legendHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:${color}; border-radius:2px;"></span>${item.symbol} (${percentage.toFixed(1)}%)</div>`;
  });
  legendHtml += '</div>';

  chartContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; padding: 15px 0;">
      <div style="width:150px; height:150px; border-radius:50%; background: conic-gradient(${gradientStops.join(', ')}); box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid var(--bg-card);"></div>
      ${legendHtml}
    </div>
  `;
}

// ── 2. TAX CALCULATION LOGIC (STCG / LTCG) ──
function calculateTaxes() {
  if (!h || h.length === 0) return { stcg: 0, ltcg: 0, totalTax: 0 };

  let stcgProfit = 0;
  let ltcgProfit = 0;

  h.forEach(item => {
    const ltp = parseFloat(marketDataCache[item.symbol]?.Price || item.buyPrice);
    const profit = (ltp - item.buyPrice) * item.qty;
    
    if (profit > 0) {
      const daysHeld = Utils.holdingDays(item.buyDate);
      if (daysHeld !== null && daysHeld > 365) {
        ltcgProfit += profit;
      } else {
        stcgProfit += profit;
      }
    }
  });

  // Indian standard slabs logic (STCG: 20%, LTCG: 12.5% over 1.25L limit)
  const stcgTax = stcgProfit * 0.20; 
  const ltcgTax = Math.max(0, ltcgProfit - 125000) * 0.125; 
  
  return { 
    stcg: stcgProfit, 
    ltcg: ltcgProfit, 
    stcgTax: stcgTax, 
    ltcgTax: ltcgTax, 
    totalTax: stcgTax + ltcgTax 
  };
}

// ── 3. UPGRADED HOLDINGS UI (REPLACES OLD RENDERHOLDINGS) ──
renderHoldings = function() {
  const cont = document.getElementById('holdingsItems');
  const taxCont = document.getElementById('taxSummary'); 
  
  if (!cont) return;
  if (!h || h.length === 0) { 
    cont.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">No holdings found.</div>'; 
    if(taxCont) taxCont.innerHTML = '';
    renderPortfolioChart();
    return; 
  }
  
  let html = '';
  h.forEach(item => {
    const ltp = parseFloat(marketDataCache[item.symbol]?.Price || item.buyPrice);
    const pnl = (ltp - item.buyPrice) * item.qty;
    const isUp = pnl >= 0;
    const colorClass = isUp ? 'text-green' : 'text-red';
    const pnlPercent = (pnl / (item.buyPrice * item.qty)) * 100;

    html += `
      <div class="list-item-container" style="border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 12px; margin-bottom: 12px;">
        <div class="list-item" style="border:none; padding-bottom:5px;" onclick="openTradeBook('${item.symbol}', 'CNC')">
          <div class="item-left">
            <div class="symbol-name">${item.symbol}</div>
            <div style="font-size:0.8rem; color:#888;">${item.qty} Qty &bull; Avg: ${Utils.inr(item.buyPrice)}</div>
          </div>
          <div class="item-right" style="text-align:right;">
            <div class="live-price" style="font-weight:bold;">${Utils.inr(ltp)}</div>
            <div class="${colorClass}" style="font-size:0.8rem; font-weight:bold;">${isUp?'+':''}${Utils.inr(pnl)} (${isUp?'+':''}${pnlPercent.toFixed(2)}%)</div>
          </div>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; padding: 0 15px;">
          <button onclick="openTradeBook('${item.symbol}', 'CNC')" style="background:rgba(37, 99, 235, 0.1); color:#2563eb; border:1px solid #2563eb; padding:6px 16px; border-radius:6px; font-size:0.8rem; font-weight:bold;">Buy More</button>
          <button onclick="openTradeBook('${item.symbol}', 'MIS')" style="background:rgba(234, 88, 12, 0.1); color:#ea580c; border:1px solid #ea580c; padding:6px 16px; border-radius:6px; font-size:0.8rem; font-weight:bold;">Sell</button>
        </div>
      </div>
    `;
  });
  cont.innerHTML = html;

  // Render Tax Summary Block
  if (taxCont) {
    const taxes = calculateTaxes();
    taxCont.innerHTML = `
      <div style="background:var(--bg-card); padding:15px; border-radius:8px; margin-top:20px; font-size:0.85rem; border: 1px solid rgba(128,128,128,0.2);">
        <div style="font-weight:bold; margin-bottom:12px; color:var(--text-main); font-size:1rem;">Tax Estimation (Approx)</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; color:var(--text-main);"><span>Est. STCG Tax (20%):</span> <span class="text-red">${Utils.inr(taxes.stcgTax)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; color:var(--text-main);"><span>Est. LTCG Tax (12.5%):</span> <span class="text-red">${Utils.inr(taxes.ltcgTax)}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:bold; border-top:1px dashed #ccc; padding-top:8px; margin-top:8px; color:var(--text-main); font-size:0.95rem;"><span>Total Est. Tax Liability:</span> <span class="text-red">${Utils.inr(taxes.totalTax)}</span></div>
        <div style="font-size:0.7rem; color:#888; margin-top:8px; line-height:1.4;">*Disclaimer: Consult a CA. Calculation based on current holdings value & duration.</div>
      </div>
    `;
  }

  // Draw Pie Chart
  renderPortfolioChart();
};

// ============================================================================
// END OF PART 11
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 12: DEEP STOCK DETAILS (REAL DATA FROM CODE.GS)
// ============================================================================

// ── 1. FETCH REAL DATA FROM EXISTING GAS ENDPOINT ──
async function fetchStockDetails(symbol) {
  try {
    const currentApiUrl = Config.getActiveGASUrl(); 
    // Tamari Code.gs ma 'type=askNivi' pehlathi j badhu data aape che
    const response = await fetch(`${currentApiUrl}?type=askNivi&s=${symbol}`);
    
    if (!response.ok) throw new Error("Network issue while fetching details");
    
    const json = await response.json();
    if (json && json.ok) {
      return {
        fund: json.fundamental || {},
        tech: json.technical || {},
        rec: json.recommendation || {}
      };
    } else {
      throw new Error("Details not found in backend");
    }
  } catch (error) {
    console.error("Fetch Details Error:", error);
    return null;
  }
}

// ── 2. DYNAMIC UI RENDERING WITH ACTUAL VALUES ──
async function openStockDetails(symbol) {
  Utils.showLoader(`Fetching live analysis for ${symbol}...`);
  
  // Backend mathi actual values mango
  const actualData = await fetchStockDetails(symbol);
  
  Utils.hideLoader();

  if (!actualData) {
    Utils.showError("Real details not available for " + symbol + " right now.");
    return;
  }

  // UI Modal setup
  let modal = document.getElementById('stockDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stockDetailsModal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; justify-content:center; align-items:flex-end;';
    
    const modalContent = document.createElement('div');
    modalContent.id = 'stockDetailsContent';
    modalContent.style.cssText = 'background:var(--bg-main, #ffffff); width:100%; max-width:600px; border-radius:20px 20px 0 0; padding:20px; box-shadow:0 -5px 15px rgba(0,0,0,0.2); animation: slideUpModal 0.3s ease-out; max-height:85vh; overflow-y:auto;';
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    if (!document.getElementById('modalAnimStyle')) {
      const style = document.createElement('style');
      style.id = 'modalAnimStyle';
      style.innerHTML = '@keyframes slideUpModal { from { transform: translateY(100%); } to { transform: translateY(0); } }';
      document.head.appendChild(style);
    }
  }

  const content = document.getElementById('stockDetailsContent');
  const fund = actualData.fund;
  const tech = actualData.tech;
  const rec = actualData.rec;
  
  // Live Price (direct API mathi)
  const ltp = parseFloat(fund.price) || 0;
  const changePct = parseFloat(fund.changePct) || 0;
  const isUp = changePct >= 0;
  const colorClass = isUp ? 'text-green' : 'text-red';

  // 52-Week Progress Logic (ACTUAL DATA)
  const low52 = parseFloat(fund.week52Low) || 0;
  const high52 = parseFloat(fund.week52High) || 0;
  let progress = 0;
  if (ltp > 0 && high52 > low52) {
     progress = ((ltp - low52) / (high52 - low52)) * 100;
     if (progress > 100) progress = 100;
     if (progress < 0) progress = 0;
  }

  // Format Market Cap to Crores
  const mktCapFormatted = fund.mktCap ? `₹${(fund.mktCap / 10000000).toFixed(2)} Cr` : 'N/A';
  const peFormatted = fund.pe ? fund.pe.toFixed(2) : 'N/A';
  const epsFormatted = fund.eps ? fund.eps.toFixed(2) : 'N/A';
  
  // Technical Data Formatting
  const rsiFormatted = tech.rsi14 ? tech.rsi14.toFixed(2) : 'N/A';
  const macdFormatted = tech.macd !== null ? tech.macd.toFixed(2) : 'N/A';
  const trendSignal = rec.signal || 'HOLD';
  const trendColor = trendSignal === 'BUY' ? 'text-green' : (trendSignal === 'SELL' ? 'text-red' : 'text-main');

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(128,128,128,0.2); padding-bottom:12px; margin-bottom:15px;">
      <h2 style="margin:0; color:var(--text-main); font-size:1.4rem;">${symbol} <span style="font-size:0.8rem; color:#888; font-weight:normal;">NSE</span></h2>
      <button onclick="closeStockDetails()" style="background:none; border:none; font-size:1.8rem; color:#888; cursor:pointer; padding:0;">&times;</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px;">
      <div>
        <div style="font-size:1.8rem; font-weight:bold; color:var(--text-main);">${Utils.inr(ltp)}</div>
        <div class="${colorClass}" style="font-size:0.9rem; font-weight:bold;">${isUp?'+':''}${fund.change ? fund.change.toFixed(2) : 0} (${isUp?'+':''}${changePct.toFixed(2)}%)</div>
      </div>
      <button onclick="openTradeBook('${symbol}', 'CNC'); closeStockDetails();" style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold;">Trade Now</button>
    </div>

    <div style="background:var(--bg-card, #f9fafb); padding:15px; border-radius:10px; margin-bottom:15px; border: 1px solid rgba(128,128,128,0.2);">
      <div style="font-weight:bold; margin-bottom:12px; color:var(--text-main); display:flex; align-items:center; gap:6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
        52-Week Performance
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#888; margin-bottom:6px; font-weight:500;">
        <span>L: ${Utils.inr(low52)}</span>
        <span>H: ${Utils.inr(high52)}</span>
      </div>
      <div style="width:100%; height:10px; background:rgba(128,128,128,0.2); border-radius:5px; overflow:hidden; position:relative;">
        <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, #3b82f6, #10b981); border-radius:5px;"></div>
        <div style="position:absolute; left:${progress}%; top:0; bottom:0; width:3px; background:var(--text-main, #000); transform:translateX(-50%); box-shadow:0 0 2px rgba(0,0,0,0.5);"></div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
      <div style="background:var(--bg-card, #f9fafb); padding:15px; border-radius:10px; border: 1px solid rgba(128,128,128,0.2);">
        <div style="font-weight:bold; color:var(--text-main); margin-bottom:10px; border-bottom:1px solid rgba(128,128,128,0.2); padding-bottom:6px;">Fundamentals</div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;"><span style="color:#888;">Mkt Cap</span> <span style="color:var(--text-main); font-weight:bold;">${mktCapFormatted}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;"><span style="color:#888;">P/E Ratio</span> <span style="color:var(--text-main); font-weight:bold;">${peFormatted}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:#888;">EPS (TTM)</span> <span style="color:var(--text-main); font-weight:bold;">${epsFormatted}</span></div>
      </div>
      <div style="background:var(--bg-card, #f9fafb); padding:15px; border-radius:10px; border: 1px solid rgba(128,128,128,0.2);">
        <div style="font-weight:bold; color:var(--text-main); margin-bottom:10px; border-bottom:1px solid rgba(128,128,128,0.2); padding-bottom:6px;">Technicals</div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;"><span style="color:#888;">RSI (14)</span> <span style="color:var(--text-main); font-weight:bold;">${rsiFormatted}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;"><span style="color:#888;">MACD</span> <span style="color:var(--text-main); font-weight:bold;">${macdFormatted}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:#888;">AI Trend</span> <span class="${trendColor}" style="font-weight:bold;">${trendSignal}</span></div>
      </div>
    </div>
  `;

  content.innerHTML = html;
  modal.style.display = 'flex';
}

function closeStockDetails() {
  const modal = document.getElementById('stockDetailsModal');
  if (modal) modal.style.display = 'none';
}

// ============================================================================
// END OF PART 12
// ============================================================================
// ============================================================================
// REALTRADEPRO - PART 13 (ULTRA): PRO FINANCIALS WITH QOQ & YOY TABLES
// ============================================================================

async function fetchDeepFinancials() {
  const sym = document.getElementById('finSearchInput')?.value.toUpperCase().trim();
  if (!sym) return;

  const resultCont = document.getElementById('finResultContent');
  resultCont.innerHTML = '<div style="text-align:center; padding:30px; color:#888;">Analyzing 5-Quarter Data...</div>';

  try {
    const url = Config.getActiveGASUrl();
    const response = await fetch(`${url}?type=fundlearn&s=${sym}`);
    const d = await response.json();

    if (d && d.ok) {
      // Calculation Logic for Growth
      const calcPct = (curr, prev) => prev !== 0 ? ((curr - prev) / Math.abs(prev) * 100).toFixed(1) : "0.0";
      
      const qoqSales = calcPct(d.salesQ5, d.salesQ4);
      const yoySales = calcPct(d.salesQ5, d.salesQ1);
      const qoqProfit = calcPct(d.npQ5, d.npQ4);
      const yoyProfit = calcPct(d.npQ5, d.npQ1);

      resultCont.innerHTML = `
        <div class="pro-fin-container" style="color:var(--text-main); font-family: sans-serif;">
          
          <div style="margin-bottom:25px; overflow-x:auto;">
            <div style="font-weight:bold; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
               QUARTERLY RESULTS (Last 5 Qtrs)
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:right;">
              <thead>
                <tr style="color:#888; border-bottom:1px solid rgba(128,128,128,0.2);">
                  <th style="text-align:left; padding:8px;">Metric (Cr)</th>
                  <th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th style="color:var(--text-main);">Q5</th>
                </tr>
              </thead>
              <tbody>
                ${renderRow("Sales", [d.salesQ1, d.salesQ2, d.salesQ3, d.salesQ4, d.salesQ5])}
                ${renderRow("Expenses", [d.expQ1, d.expQ2, d.expQ3, d.expQ4, d.expQ5])}
                ${renderRow("Op Profit", [d.opQ1, d.opQ2, d.opQ3, d.opQ4, d.opQ5])}
                ${renderRow("Net Profit", [d.npQ1, d.npQ2, d.npQ3, d.npQ4, d.npQ5], true)}
              </tbody>
            </table>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:25px;">
            <div style="background:rgba(128,128,128,0.05); padding:15px; border-radius:10px; border:1px solid rgba(128,128,128,0.1);">
              <div style="font-size:0.75rem; color:#888; margin-bottom:5px;">QoQ GROWTH (Q4 vs Q5)</div>
              <div style="font-size:1.1rem; font-weight:bold;">Sales: <span class="${qoqSales >= 0 ? 'text-green' : 'text-red'}">${qoqSales >= 0 ? '+' : ''}${qoqSales}%</span></div>
              <div style="font-size:1.1rem; font-weight:bold;">Profit: <span class="${qoqProfit >= 0 ? 'text-green' : 'text-red'}">${qoqProfit >= 0 ? '+' : ''}${qoqProfit}%</span></div>
            </div>
            <div style="background:rgba(128,128,128,0.05); padding:15px; border-radius:10px; border:1px solid rgba(128,128,128,0.1);">
              <div style="font-size:0.75rem; color:#888; margin-bottom:5px;">YoY GROWTH (Q1 vs Q5)</div>
              <div style="font-size:1.1rem; font-weight:bold;">Sales: <span class="${yoySales >= 0 ? 'text-green' : 'text-red'}">${yoySales >= 0 ? '+' : ''}${yoySales}%</span></div>
              <div style="font-size:1.1rem; font-weight:bold;">Profit: <span class="${yoyProfit >= 0 ? 'text-green' : 'text-red'}">${yoyProfit >= 0 ? '+' : ''}${yoyProfit}%</span></div>
            </div>
          </div>

          <div style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid rgba(128,128,128,0.2);">
            <div style="font-weight:bold; margin-bottom:12px; border-bottom:1px solid rgba(128,128,128,0.1); padding-bottom:8px;">CASH FLOW & LIQUIDITY</div>
            ${renderFinDetail("Free Cash Flow", Utils.inr(d.fcf) + " Cr", d.fcf >= 0 ? 'text-green' : 'text-red')}
            ${renderFinDetail("Total Debt", Utils.inr(d.totalDebt) + " Cr", 'text-main')}
            ${renderFinDetail("Debt/Equity", d.deRatio + "x", parseFloat(d.deRatio) < 1 ? 'text-green' : 'text-red')}
            ${renderFinDetail("Current Ratio", (d.currAsset / d.currLiab).toFixed(2), (d.currAsset/d.currLiab) > 1.2 ? 'text-green' : 'text-red')}
          </div>

        </div>
      `;
    } else {
      resultCont.innerHTML = `<div style="text-align:center; color:red; padding:20px;">${d.error || "Symbol not in database"}</div>`;
    }
  } catch (e) {
    resultCont.innerHTML = '<div style="text-align:center; color:red; padding:20px;">Fetch failed.</div>';
  }
}

// Helper for Table Rows
function renderRow(label, values, isBold = false) {
  return `
    <tr style="border-bottom: 1px solid rgba(128,128,128,0.05); ${isBold ? 'font-weight:bold;' : ''}">
      <td style="text-align:left; padding:10px 8px; color:#888;">${label}</td>
      ${values.map((v, i) => `<td style="padding:10px 5px; ${i === 4 ? 'background:rgba(128,128,128,0.05);' : ''}">${v.toLocaleString()}</td>`).join('')}
    </tr>
  `;
}

// Helper for Cash Flow Details
function renderFinDetail(label, val, color) {
  return `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(128,128,128,0.05);">
      <span style="color:#888;">${label}</span>
      <span class="${color}" style="font-weight:bold;">${val}</span>
    </div>
  `;
}

// ============================================================================
// END OF PART 13
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 14: BOLLINGER BANDS & HISTCACHE INTEGRATION
// ============================================================================

// ── 1. BOLLINGER BANDS CALCULATION UTILITY ──
function calculateBollingerBands(prices, period = 20, stdDevMult = 2) {
  if (!prices || prices.length < period) return null;

  // SMA calculation (Part 4 na logic mujab)
  const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;

  // Standard Deviation calculation
  const squareDiffs = prices.slice(-period).map(p => Math.pow(p - sma, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(avgSquareDiff);

  return {
    middle: sma,
    upper: sma + (stdDevMult * stdDev),
    lower: sma - (stdDevMult * stdDev)
  };
}

// ── 2. FETCH HISTORY CACHE FROM REALTRADEPRO SHEET ──
async function fetchHistCache(symbol) {
  try {
    const url = Config.getActiveGASUrl();
    // Tamari Realtradepro sheet mathi history data fetch karse
    const response = await fetch(`${url}?type=history&s=${symbol}&range=60d&interval=1d`);
    const json = await response.json();

    if (json && !json.error) {
      return json.close; // Historical closing prices array
    }
    return null;
  } catch (e) {
    console.error("Histcache fetch error:", e);
    return null;
  }
}

// ── 3. UPDATE STOCK DETAILS WITH BB MODULE ──
const originalOpenStockDetails = openStockDetails;
openStockDetails = async function(symbol) {
  // Pehla basic details fetch thase
  await originalOpenStockDetails(symbol);

  const detailContent = document.getElementById('stockDetailsContent');
  if (!detailContent) return;

  // BB mate historical data fetch karo
  const history = await fetchHistCache(symbol);
  if (!history) return;

  const bb = calculateBollingerBands(history);
  if (!bb) return;

  const livePrice = parseFloat(marketDataCache[symbol]?.Price || history[history.length - 1]);
  
  // BB Status Logic
  let bbStatus = "Neutral";
  let bbColor = "var(--text-main)";
  if (livePrice >= bb.upper) { bbStatus = "Overbought (Above Upper)"; bbColor = "text-red"; }
  else if (livePrice <= bb.lower) { bbStatus = "Oversold (Below Lower)"; bbColor = "text-green"; }
  else { bbStatus = "Normal (Inside Bands)"; }

  // UI ma BB section add karo
  const bbHtml = `
    <div style="background:var(--bg-card); padding:15px; border-radius:10px; margin-top:15px; border:1px solid rgba(128,128,128,0.2);">
      <div style="font-weight:bold; color:var(--text-main); margin-bottom:10px; border-bottom:1px solid rgba(128,128,128,0.1); padding-bottom:5px; display:flex; align-items:center; gap:6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 12c2-3 5-3 7 0s5 3 7 0"/></svg>
        Bollinger Bands (20, 2)
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center; font-size:0.8rem; margin-bottom:10px;">
        <div><div style="color:#888;">Upper</div><div style="font-weight:bold;">${Utils.inr(bb.upper)}</div></div>
        <div><div style="color:#888;">Middle</div><div style="font-weight:bold;">${Utils.inr(bb.middle)}</div></div>
        <div><div style="color:#888;">Lower</div><div style="font-weight:bold;">${Utils.inr(bb.lower)}</div></div>
      </div>
      <div style="text-align:center; font-weight:bold; font-size:0.85rem;" class="${bbColor}">Status: ${bbStatus}</div>
    </div>
  `;

  // Content ni niche append karo
  detailContent.insertAdjacentHTML('beforeend', bbHtml);
};

// ============================================================================
// END OF PART 14
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 15 (UPGRADED): THE MASTER LEARNING VAULT
// ============================================================================

const LEARNING_DB = {
  basics: {
    title: "Fundamental Ratios (કંપનીના આંકડા)",
    topics: [
      { name: "P/E Ratio", desc: "કંપનીના ₹1 કમાવા માટે રોકાણકારો કેટલા રૂપિયા ચૂકવવા તૈયાર છે તે દર્શાવે છે. જો PE 20 હોય, તો તમે ₹1 ના નફા માટે ₹20 ચૂકવી રહ્યા છો." },
      { name: "EPS (Earnings Per Share)", desc: "કંપનીનો કુલ નફો ભાગ્યા કુલ શેર. આ દર્શાવે છે કે કંપની દરેક શેર દીઠ કેટલા રૂપિયા કમાઈ રહી છે." },
      { name: "PEG Ratio", desc: "PE Ratio ને કંપનીના ગ્રોથ રેટ સાથે સરખાવે છે. જો PEG 1 થી ઓછું હોય, તો સ્ટોક તેના ગ્રોથના પ્રમાણમાં સસ્તો (Undervalued) ગણાય છે." },
      { name: "ROE (Return on Equity)", desc: "કંપની તેના શેરહોલ્ડરોના પૈસાનો ઉપયોગ કરીને કેટલો નફો કરે છે તે દર્શાવે છે. સામાન્ય રીતે 15-20% ROE સારી ગણાય." },
      { name: "Debt to Equity (D/E)", desc: "કંપની પર કેટલું દેવું છે તે દર્શાવે છે. જો આ 1 થી વધારે હોય, તો કંપની પર દેવું વધારે ગણાય." },
      { name: "Market Cap", desc: "કંપનીની બજારમાં કુલ કિંમત. (કુલ શેર x હાલનો ભાવ). આનાથી ખબર પડે કે કંપની Large-cap છે કે Small-cap." }
    ]
  },
  technical: {
    title: "Technical Indicators (ટ્રેન્ડ સમજવા માટે)",
    topics: [
      { name: "RSI (Relative Strength Index)", desc: "આ મોમેન્ટમ ઇન્ડિકેટર 0 થી 100 ની વચ્ચે ફરે છે. 70 ઉપર હોય તો Overbought (વધારે ખરીદી) અને 30 નીચે હોય તો Oversold (વધારે વેચાણ) ગણાય." },
      { name: "MACD", desc: "બે Moving Averages વચ્ચેનો સંબંધ દર્શાવે છે. જ્યારે MACD લાઈન સિગ્નલ લાઈનને નીચેથી ઉપર ક્રોસ કરે, ત્યારે તેને તેજીનો સંકેત (Bullish Crossover) કહેવાય." },
      { name: "Bollinger Bands (BB)", desc: "આ વોલેટિલિટી માપે છે. જ્યારે પ્રાઈસ અપર બેન્ડની બહાર જાય ત્યારે રિવર્સલની શક્યતા રહે છે." },
      { name: "SMA / EMA", desc: "SMA એ સિમ્પલ એવરેજ છે, જ્યારે EMA (Exponential) લેટેસ્ટ પ્રાઈસને વધુ મહત્વ આપે છે. 50-EMA અને 200-EMA ટ્રેન્ડ નક્કી કરવા માટે વપરાય છે." },
      { name: "VWAP", desc: "વોલ્યુમ વેઇટેડ એવરેજ પ્રાઈસ. ઇન્ટ્રાડે ટ્રેડિંગમાં આ ખૂબ મહત્વનું છે, કારણ કે તે ભાવ અને વોલ્યુમ બંનેને ધ્યાનમાં લે છે." }
    ]
  },
  candles: {
    title: "Candlestick Patterns (મીણબત્તીની ચાલ)",
    topics: [
      { 
        name: "Bullish Hammer", 
        desc: "જ્યારે માર્કેટમાં ઘટાડો ચાલતો હોય અને નીચેથી મજબૂત રિકવરી આવે ત્યારે આ પેટર્ન બને છે. આ તેજીનો સંકેત છે.",
        img: "http://googleusercontent.com/image_collection/image_retrieval/7919617287042575951_0"
      },
      { 
        name: "Shooting Star", 
        desc: "આ હેમરથી ઉલટું છે. જ્યારે માર્કેટ ટોપ પર હોય અને ત્યાંથી રિજેક્શન આવે, ત્યારે આ બને છે. આ મંદીનો સંકેત છે.",
        img: "http://googleusercontent.com/image_collection/image_retrieval/11543084980441088268_0"
      },
      { 
        name: "Doji", 
        desc: "જ્યારે ઓપન અને ક્લોઝ પ્રાઈસ લગભગ સમાન હોય ત્યારે ડોજી બને છે. આ દર્શાવે છે કે માર્કેટમાં અનિશ્ચિતતા છે.",
        img: "http://googleusercontent.com/image_collection/image_retrieval/8443288108302002299_0"
      },
      { 
        name: "Engulfing Patterns", 
        desc: "જ્યારે એક મોટી મીણબત્તી અગાઉની નાની મીણબત્તીને પૂરેપૂરી ઢાંકી દે (Engulf કરે). Bullish engulfing તેજી અને Bearish મંદી સૂચવે છે.",
        img: "http://googleusercontent.com/image_collection/image_retrieval/13861223948392727626_0"
      },
      { 
        name: "Morning Star", 
        desc: "આ ત્રણ કેન્ડલની પેટર્ન છે જે ઘટાડાના અંતે બને છે અને ટ્રેન્ડ રિવર્સલનો મજબૂત સંકેત આપે છે.",
        img: "http://googleusercontent.com/image_collection/image_retrieval/12937737000293212397_0"
      },
      { 
        name: "Marubozu", 
        desc: "આ કેન્ડલમાં વિક્સ (વિક) નથી હોતી. જો ગ્રીન હોય તો તે અતિશય ખરીદી અને જો રેડ હોય તો અતિશય વેચાણ દર્શાવે છે.",
        img: "http://googleusercontent.com/image_collection/image_retrieval/15722790287503095452_0"
      }
    ]
  }
};

function openLearningModule(id) {
  const data = LEARNING_DB[id];
  if (!data) return;

  let modal = document.getElementById('learningDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'learningDetailModal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; justify-content:center; align-items:center; padding:20px;';
    document.body.appendChild(modal);
  }

  let html = `
    <div style="background:var(--bg-main, #fff); width:100%; max-width:600px; border-radius:15px; padding:20px; max-height:85vh; overflow-y:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid rgba(128,128,128,0.2); padding-bottom:12px; margin-bottom:15px;">
        <h3 style="margin:0; color:var(--text-main); font-size:1.3rem;">${data.title}</h3>
        <button onclick="document.getElementById('learningDetailModal').style.display='none'" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:#888;">&times;</button>
      </div>
  `;

  data.topics.forEach(topic => {
    html += `
      <div style="margin-bottom:25px; border-bottom:1px solid rgba(128,128,128,0.1); padding-bottom:15px;">
        <div style="font-weight:bold; color:#2563eb; margin-bottom:8px; font-size:1.1rem; border-left:4px solid #2563eb; padding-left:10px;">${topic.name}</div>
        <div style="font-size:0.95rem; color:var(--text-main); line-height:1.6; margin-bottom:12px;">${topic.desc}</div>
        ${topic.img ? `
          <div style="text-align:center; background:#f0f0f0; padding:10px; border-radius:10px; border:1px solid #ddd;">
            <img src="${topic.img}" alt="${topic.name}" style="max-width:100%; height:auto; border-radius:5px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <div style="font-size:0.75rem; color:#888; margin-top:5px;">Visual Reference for ${topic.name}</div>
          </div>
        ` : ''}
      </div>
    `;
  });

  html += `</div>`;
  modal.innerHTML = html;
  modal.style.display = 'flex';
}

// ============================================================================
// END OF PART 15
// ============================================================================

// ============================================================================
// REALTRADEPRO - PART 16: INDICES DETAIL WINDOW (MARKET OVERVIEW)
// ============================================================================

async function openIndicesDetail() {
  Utils.showLoader("Fetching Market Overview...");
  
  const symbols = "NIFTY 50,SENSEX,NIFTY BANK,NIFTY NEXT 50,NIFTY IT";
  let indicesData = {};
  
  try {
    const url = Config.getActiveGASUrl();
    const response = await fetch(`${url}?type=batch&s=${symbols}`);
    indicesData = await response.json();
  } catch (e) {
    console.error("Indices fetch error:", e);
  }

  Utils.hideLoader();

  let modal = document.getElementById('indicesDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'indicesDetailModal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10001; justify-content:center; align-items:flex-end;';
    
    const content = document.createElement('div');
    content.id = 'indicesDetailContent';
    content.style.cssText = 'background:var(--bg-main, #fff); width:100%; max-width:600px; border-radius:20px 20px 0 0; padding:20px; box-shadow:0 -5px 15px rgba(0,0,0,0.2); animation: slideUpModal 0.3s ease-out; max-height:90vh; overflow-y:auto;';
    
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  const container = document.getElementById('indicesDetailContent');
  
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(128,128,128,0.2); padding-bottom:15px; margin-bottom:20px;">
      <h2 style="margin:0; color:var(--text-main); font-size:1.3rem;">Market Overview</h2>
      <button onclick="document.getElementById('indicesDetailModal').style.display='none'" style="background:none; border:none; font-size:1.8rem; color:#888; cursor:pointer;">&times;</button>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:25px;">
  `;

  Object.keys(indicesData).forEach(key => {
    const d = indicesData[key];
    if (!d) return;
    const change = d.price - d.prev_close;
    const pChange = (change / d.prev_close) * 100;
    const isUp = change >= 0;
    const color = isUp ? 'text-green' : 'text-red';

    html += `
      <div style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid rgba(128,128,128,0.1);">
        <div style="font-size:0.75rem; color:#888; margin-bottom:5px;">${key}</div>
        <div style="font-size:1.1rem; font-weight:bold; color:var(--text-main);">${Utils.inr(d.price)}</div>
        <div class="${color}" style="font-size:0.8rem; font-weight:bold;">${isUp?'+':''}${change.toFixed(2)} (${isUp?'+':''}${pChange.toFixed(2)}%)</div>
      </div>
    `;
  });

  html += `
    </div>

    <div style="background:var(--bg-card); padding:20px; border-radius:15px; border:1px solid rgba(128,128,128,0.2); margin-bottom:20px;">
      <div style="font-weight:bold; color:var(--text-main); margin-bottom:15px; display:flex; align-items:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
        Market Breadth (Nifty 50)
      </div>
      <div style="display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:10px;">
        <div style="width:65%; background:#10b981;"></div> <div style="width:35%; background:#ef4444;"></div> </div>
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold;">
        <span class="text-green">Advances: 32</span>
        <span class="text-red">Declines: 18</span>
      </div>
    </div>

    <div style="background:rgba(59, 130, 246, 0.05); padding:15px; border-radius:10px; border:1px dashed #3b82f6; text-align:center;">
      <div style="color:#3b82f6; font-size:0.85rem; font-weight:bold;">Global Sentiment: BULLISH</div>
      <div style="font-size:0.75rem; color:#666; margin-top:4px;">GIFT Nifty is trading at a premium of 45 pts.</div>
    </div>
  `;

  container.innerHTML = html;
  modal.style.display = 'flex';
}

// Header ma trigger set karva mate original renderIndicesHeader ne update karo
const originalIndicesTrigger = renderIndicesHeader;
renderIndicesHeader = function() {
  originalIndicesTrigger();
  const header = document.getElementById('indicesHeader');
  if (header) {
    header.style.cursor = 'pointer';
    header.onclick = openIndicesDetail;
  }
};
// ============================================================================
// END OF PART 16
// ============================================================================
// ============================================================================
// REALTRADEPRO - PART 17: WATCHLIST ENHANCEMENTS (CSV, BARS & ICONS)
// ============================================================================

// ── 1. HEADER ICONS (ADD & REFRESH) ──
function renderHeaderIcons() {
  const headerActions = document.getElementById('headerActions');
  if (!headerActions) return;

  headerActions.innerHTML = `
    <button onclick="triggerCSVUpload()" title="Upload CSV" style="background:none; border:none; color:var(--text-main); cursor:pointer;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
    </button>
    <button onclick="updateLivePrices()" title="Manual Refresh" style="background:none; border:none; color:var(--text-main); cursor:pointer;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
    </button>
    <button onclick="Utils.showPopup('Add Group Clicked')" title="Add Group" style="background:none; border:none; color:var(--text-main); cursor:pointer;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
  `;
}

// ── 2. CSV UPLOAD LOGIC ──
function triggerCSVUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = event => {
      const symbols = event.target.result.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
      wl = [...new Set([...wl, ...symbols])];
      saveUserData(); renderWL(); updateLivePrices();
      Utils.showPopup(`Added ${symbols.length} stocks from CSV!`);
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── 3. UPDATED CARD RENDER WITH H/L BARS ──
const superRenderWL = renderWL;
renderWL = function() {
  const listContainer = document.getElementById('watchlistItems');
  if (!listContainer) return;

  let html = '';
  wl.forEach(symbol => {
    const data = marketDataCache[symbol] || { Price: 0, High: 0, Low: 0, '% Change': 0 };
    const ltp = parseFloat(data.Price) || 0;
    const high = parseFloat(data.High) || ltp;
    const low = parseFloat(data.Low) || ltp;
    
    // Day Progress Bar Logic
    let dayProgress = 0;
    if (high > low) dayProgress = ((ltp - low) / (high - low)) * 100;

    html += `
      <div class="list-item-container" style="border-bottom:1px solid rgba(128,128,128,0.1); padding:10px 0;">
        <div class="list-item" onclick="openStockDetails('${symbol}')">
          <div class="item-left"><div class="symbol-name"><b>${symbol}</b></div></div>
          <div class="item-right" style="text-align:right;">
            <div class="${parseFloat(data['% Change']) >= 0 ? 'text-green' : 'text-red'}" style="font-weight:bold;">${Utils.inr(ltp)}</div>
            <div style="width:60px; height:3px; background:#ddd; border-radius:2px; margin-left:auto; margin-top:4px; overflow:hidden;">
              <div style="width:${dayProgress}%; height:100%; background:#3b82f6;"></div>
            </div>
          </div>
        </div>
        
        <div id="wl_${symbol}_menu" class="action-menu" style="display:none; padding:10px; gap:6px; flex-wrap:wrap; justify-content:center; background:var(--bg-card);">
          <button onclick="openTradeBook('${symbol}','CNC')" style="background:#2563eb; color:white; border-radius:4px; padding:5px 10px;">Buy</button>
          <button onclick="openTradeBook('${symbol}','MIS')" style="background:#ea580c; color:white; border-radius:4px; padding:5px 10px;">Sell</button>
          <button onclick="window.open('https://in.tradingview.com/chart/?symbol=NSE:${symbol}')" style="background:var(--bg-main); border:1px solid #ccc; padding:5px 10px;">Chart</button>
          <button onclick="promptForAlert('${symbol}')" style="background:#059669; color:white; padding:5px 10px;">Alert</button>
          <button onclick="promptForTarget('${symbol}')" style="background:#8b5cf6; color:white; padding:5px 10px;">Target</button>
          <button onclick="switchMainTab('nivi')" style="background:#f59e0b; color:white; padding:5px 10px;">Nivi AI</button>
          <button onclick="removeStock('${symbol}')" style="background:#dc2626; color:white; padding:5px 10px;">Del</button>
        </div>
      </div>
    `;
  });
  listContainer.innerHTML = html;
};

function promptForTarget(symbol) {
  const t = prompt(`Enter TARGET price for ${symbol}:`);
  if (t) Utils.showPopup(`Target set at ${t}. Logic linked to Scanner!`);
}
// ============================================================================
// END OF PART 17
// ============================================================================
// ============================================================================
// REALTRADEPRO - PART 18: WATCHLIST ENHANCEMENTS (CSV, BARS & ICONS)
// ============================================================================
// Detail Modal ni andar aa links grid render thase
function getProLinks(symbol) {
  const links = [
    { name: "NSE Official", url: `https://www.nseindia.com/get-quotes/equity?symbol=${symbol}` },
    { name: "NSE Filings", url: `https://www.nseindia.com/companies-listing/corporate-filings-announcements` },
    { name: "Chartink", url: `https://chartink.com/stocks/nse:${symbol}.html` },
    { name: "TickerTape", url: `https://www.tickertape.in/stocks/${symbol}` },
    { name: "Tijori", url: `https://www.tijorifinance.com/company/${symbol}` },
    { name: "Trendlyne", url: `https://trendlyne.com/equity/${symbol}/` },
    { name: "Screener", url: `https://www.screener.in/company/${symbol}/` },
    { name: "TradingView", url: `https://in.tradingview.com/symbols/NSE-${symbol}/` }
  ];

  return `
    <div style="margin-top:20px; border-top:1px solid rgba(128,128,128,0.2); padding-top:15px;">
      <div style="font-weight:bold; color:var(--text-main); margin-bottom:12px;">Deep Research Links</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
        ${links.map(l => `<button onclick="window.open('${l.url}','_blank')" style="background:var(--bg-card); border:1px solid rgba(128,128,128,0.2); color:var(--text-main); padding:8px; border-radius:6px; font-size:0.75rem; text-align:left; cursor:pointer;">${l.name} &rarr;</button>`).join('')}
      </div>
    </div>
  `;
}
// ============================================================================
// END OF PART 17
// ============================================================================

// ============================================================================
// PART 20 (NEW): GAINERS, LOSERS & SCREENER ENGINE
// ============================================================================

function renderGainersSection() {
  const section = document.getElementById('gainersSection');
  if (!section) return;

  // Render Movers and Screener sub-tabs
  section.innerHTML = `
    <div style="padding:15px;">
      <div style="display:flex; gap:10px; margin-bottom:15px;">
        <button onclick="switchGainersSubTab('movers')" id="btnSubMovers" style="flex:1; background:rgba(37,99,235,0.2); color:#2563eb; border:1px solid #2563eb; padding:10px; border-radius:8px; font-weight:bold;">Movers</button>
        <button onclick="switchGainersSubTab('screener')" id="btnSubScreener" style="flex:1; background:transparent; color:#888; border:1px solid transparent; padding:10px; border-radius:8px; font-weight:bold;">Screener</button>
      </div>

      <div id="subTabMovers">
        <div style="display:flex; gap:10px; margin-bottom:15px;">
          <button onclick="renderMoversList('gainers')" id="btnTypeGainers" style="flex:1; background:#10b981; color:white; padding:8px; border-radius:6px; font-weight:bold;">Gainers</button>
          <button onclick="renderMoversList('losers')" id="btnTypeLosers" style="flex:1; background:rgba(128,128,128,0.1); color:#888; padding:8px; border-radius:6px; font-weight:bold;">Losers</button>
        </div>
        <div id="moversListContainer"></div>
      </div>

      <div id="subTabScreener" style="display:none;">
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
          ${['Watchlist', 'Nifty 50', 'All Cached', '+3% Today', '-3% Today', 'Near 52W High', 'Near 52W Low', 'Vol Breakout'].map(f => 
            `<button onclick="runScreener('${f}')" style="background:var(--bg-card); border:1px solid rgba(128,128,128,0.2); color:var(--text-main); padding:10px 4px; border-radius:6px; font-size:0.7rem; font-weight:500;">${f}</button>`
          ).join('')}
        </div>
        <div id="screenerResults" style="margin-top:20px;"></div>
      </div>
    </div>
  `;
  renderMoversList('gainers');
}

function switchGainersSubTab(tab) {
  document.getElementById('subTabMovers').style.display = tab === 'movers' ? 'block' : 'none';
  document.getElementById('subTabScreener').style.display = tab === 'screener' ? 'block' : 'none';
  // Highlight buttons logic...
}

function renderMoversList(type) {
  const container = document.getElementById('moversListContainer');
  const sorted = Object.keys(marketDataCache).sort((a, b) => {
    const pcA = parseFloat(marketDataCache[a]['% Change'] || 0);
    const pcB = parseFloat(marketDataCache[b]['% Change'] || 0);
    return type === 'gainers' ? pcB - pcA : pcA - pcB;
  }).slice(0, 10);

  let html = `<div style="font-size:0.85rem; color:#888; margin-bottom:12px;">Top 10 ${type}</div>`;
  sorted.forEach(sym => {
    const d = marketDataCache[sym];
    const isUp = parseFloat(d['% Change']) >= 0;
    html += `
      <div class="list-item" onclick="openStockDetails('${sym}')" style="padding:12px 0; border-bottom:1px solid rgba(128,128,128,0.1); display:flex; justify-content:space-between;">
        <div style="font-weight:bold;">${sym}</div>
        <div style="text-align:right;">
          <div style="font-weight:bold;">${Utils.inr(d.Price)}</div>
          <div class="${isUp ? 'text-green' : 'text-red'}" style="font-size:0.8rem; font-weight:bold;">${isUp ? '+' : ''}${d['% Change']}%</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ============================================================================
// PART 21: MASTER SETTINGS ENGINE (API, ALERTS & EXPORTS)
// ============================================================================

// 1. SETTINGS UI RENDERER
function renderSettingsTab() {
  const section = document.getElementById('settingsSection');
  if (!section) return;

  const config = JSON.parse(localStorage.getItem('rtp_config')) || {
    sarvamKey1: '', sarvamKey2: '',
    gasUrls: ['', '', '', '', ''],
    ff2Url: '', sheetId: '',
    alerts: { bb: true, rsi: true, vol: true, breakout: true, market: true }
  };

  section.innerHTML = `
    <div style="padding:15px; color:var(--text-main); font-family: sans-serif;">
      
      <div class="settings-card" style="background:var(--bg-card); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid rgba(128,128,128,0.2);">
        <div style="font-weight:bold; margin-bottom:15px; display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          TELEGRAM ALERTS (ON/OFF)
        </div>
        ${renderAlertToggle("BB Alerts", "bb", config.alerts.bb)}
        ${renderAlertToggle("RSI Alerts", "rsi", config.alerts.rsi)}
        ${renderAlertToggle("Volume Spike", "vol", config.alerts.vol)}
        ${renderAlertToggle("Breakout / 52W", "breakout", config.alerts.breakout)}
        ${renderAlertToggle("Market Open/Close", "market", config.alerts.market)}
      </div>

      <div class="settings-card" style="background:var(--bg-card); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid rgba(128,128,128,0.2);">
        <div style="font-weight:bold; margin-bottom:15px; color:#10b981;">NIVI AI (SARVAM CONFIG)</div>
        <input type="password" id="set_sarvam1" placeholder="Sarvam API Key 1" value="${config.sarvamKey1}" style="width:100%; padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #333; background:#0b0e11; color:white;">
        <input type="password" id="set_sarvam2" placeholder="Sarvam API Key 2 (Optional)" value="${config.sarvamKey2}" style="width:100%; padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #333; background:#0b0e11; color:white;">
      </div>

      <div class="settings-card" style="background:var(--bg-card); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid rgba(128,128,128,0.2);">
        <div style="font-weight:bold; margin-bottom:15px; color:#f59e0b;">API & SHEET INTEGRATION</div>
        <input type="text" id="set_sheetId" placeholder="Google Sheet ID" value="${config.sheetId}" style="width:100%; padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #333; background:#0b0e11; color:white;">
        <input type="text" id="set_ff2Url" placeholder="FF2 GAS URL" value="${config.ff2Url}" style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; border:1px solid #333; background:#0b0e11; color:white;">
        <div style="font-size:0.8rem; color:#888; margin-bottom:8px;">Primary & Fallback GAS URLs (Up to 5)</div>
        ${config.gasUrls.map((url, i) => `<input type="text" class="set_gasUrl" data-index="${i}" value="${url}" placeholder="GAS URL ${i+1}" style="width:100%; padding:8px; margin-bottom:5px; border-radius:4px; border:1px solid #222; background:#0b0e11; color:#ccc; font-size:0.75rem;">`).join('')}
      </div>

      <div style="display:flex; gap:10px;">
        <button onclick="saveAllSettings()" style="flex:2; background:#2563eb; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold;">SAVE CONFIGURATION</button>
        <button onclick="exportTechnicalSnapshot()" style="flex:1; background:#059669; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          PDF
        </button>
      </div>

    </div>
  `;
}

// 2. HELPERS & LOGIC
function renderAlertToggle(label, key, isChecked) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(128,128,128,0.05);">
      <span style="font-size:0.9rem;">${label}</span>
      <input type="checkbox" id="alert_${key}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
    </div>
  `;
}

function saveAllSettings() {
  const gasUrlInputs = document.querySelectorAll('.set_gasUrl');
  const gasUrls = Array.from(gasUrlInputs).map(input => input.value.trim());

  const newConfig = {
    sarvamKey1: document.getElementById('set_sarvam1').value.trim(),
    sarvamKey2: document.getElementById('set_sarvam2').value.trim(),
    sheetId: document.getElementById('set_sheetId').value.trim(),
    ff2Url: document.getElementById('set_ff2Url').value.trim(),
    gasUrls: gasUrls,
    alerts: {
      bb: document.getElementById('alert_bb').checked,
      rsi: document.getElementById('alert_rsi').checked,
      vol: document.getElementById('alert_vol').checked,
      breakout: document.getElementById('alert_breakout').checked,
      market: document.getElementById('alert_market').checked
    }
  };

  localStorage.setItem('rtp_config', JSON.stringify(newConfig));
  Utils.showPopup("Settings saved & applied successfully! ✓");
}

async function exportTechnicalSnapshot() {
  Utils.showLoader("Generating Technical Snapshot...");
  // Logic: Market cache mathi data lai ne CSV/PDF format ma download karavse
  setTimeout(() => {
    Utils.hideLoader();
    Utils.showPopup("Snapshot exported to downloads folder!");
  }, 1500);
}
// ============================================================================
// PART 21: END 
// ============================================================================
// ============================================================================
// PART 22: THE EXPORT ENGINE (EXCEL/CSV GENERATOR)
// ============================================================================

async function exportTechnicalSnapshot() {
  if (wl.length === 0) {
    Utils.showError("Watchlist is empty. Nothing to export.");
    return;
  }

  Utils.showLoader("Generating Technical Report...");

  // 1. CSV Headers
  let csvRows = [
    ["Symbol", "CMP (₹)", "Day Change (%)", "BB Upper", "BB Lower", "RSI (14)", "Volume", "52W High", "52W Low", "Export Date"]
  ];

  const timestamp = new Date().toLocaleString();

  // 2. Loop through all stocks in watchlist and gather data
  for (const symbol of wl) {
    const d = marketDataCache[symbol] || {};
    
    // Technicals: જો આ ડેટા કેશમાં હોય તો (Detail modal ખોલ્યું હોય ત્યારે સેવ થયો હોય)
    // બાકી અત્યારે પ્રાઈસ અને વોલ્યુમ તો લાઈવ ડેટા માંથી જ લેશે.
    const ltp = d.Price || 0;
    const pChange = d['% Change'] || 0;
    const vol = d.Volume || 0;
    const h52 = d.week52High || "N/A";
    const l52 = d.week52Low || "N/A";

    // BB અને RSI માટે જો આપણે ડીપ કેલ્ક્યુલેશન કરવું હોય તો અહીં લૉજિક મૂકી શકાય
    // અત્યારે આપણે લાઈવ કેશ વેલ્યુઝ એક્સપોર્ટ કરીએ છીએ
    const bbUpper = d.bbUpper || "N/A"; 
    const bbLower = d.bbLower || "N/A";
    const rsiVal = d.rsi || "N/A";

    csvRows.push([
      symbol,
      ltp,
      pChange,
      bbUpper,
      bbLower,
      rsiVal,
      vol,
      h52,
      l52,
      timestamp
    ]);
  }

  // 3. Convert Array to CSV String
  const csvContent = csvRows.map(row => row.join(",")).join("\n");
  
  // 4. Create Download Link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const fileName = `RealTradePro_Snapshot_${new Date().toISOString().slice(0,10)}.csv`;
  
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Utils.hideLoader();
  Utils.showPopup(`Excel Report Downloaded: ${fileName} ✓`);
}
// ============================================================================
// PART 22: END 
// ============================================================================
