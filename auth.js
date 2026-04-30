// ========================================
// AUTH MODULE — RealTradePro v3.0
// ========================================

// Default FF2 URL
(function setDefaultFF2Url() {
  const DEFAULT_FF2_URL = "https://script.google.com/macros/s/AKfycbxcIGFZp7IWBSMJVsMIgpPR5oVmiEJbapQyknKrJ8iVpn9ahM6z9hc_QfiDKhhSMGNgiw/exec";
  if (!localStorage.getItem('ff2ApiUrl')) {
    localStorage.setItem('ff2ApiUrl', DEFAULT_FF2_URL);
  }
})();

// PIN Hash (SHA-256)
async function hashPIN(pin) {
  const msgBuffer = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// App Start
async function initApp() {
  const savedUser = localStorage.getItem('rtp_current_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    localStorage.removeItem('rtp_current_user');
    await showProfileScreen();
    setTimeout(() => showPINScreen(user.userId, user.name), 500);
    return;
  }
  await showProfileScreen();
}

// Show Profile Selection Screen
async function showProfileScreen() {
  hideAllScreens();
  document.getElementById('profileScreen').style.display = 'flex';
  const profileList = document.getElementById('profileList');

  // ✅ FIX: Cached profiles instantly show કરો
  const cachedProfiles = localStorage.getItem('rtp_profiles_cache');
  if (cachedProfiles) {
    try {
      const profiles = JSON.parse(cachedProfiles);
      if (profiles.length > 0) {
        _renderProfileCards(profileList, profiles);
        // Background sync (UI block ન કરે)
        _syncProfilesFromFirebase(profileList);
        return;
      }
    } catch(e) {}
  }

  // First time — show loading, fetch from Firebase
  profileList.innerHTML = '<p style="color:#666;font-size:0.9rem;">Loading...</p>';
  await _syncProfilesFromFirebase(profileList);
}

// Profiles render helper
function _renderProfileCards(profileList, profiles) {
  profileList.innerHTML = '';
  if (profiles.length === 0) {
    profileList.innerHTML = '<p style="color:#666;font-size:0.9rem;">No profiles yet. Create one!</p>';
    return;
  }
  profiles.forEach(({ id, name }) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.onclick = () => showPINScreen(id, name);
    card.innerHTML = `
      <div class="profile-card-avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="profile-card-name">${name}</div>
    `;
    profileList.appendChild(card);
  });
}

// Firebase sync — background માં
async function _syncProfilesFromFirebase(profileList) {
  try {
    const snapshot = await db.collection('users').get();
    const profiles = [];
    snapshot.forEach(doc => {
      const profile = doc.data().profile;
      if (profile) profiles.push({ id: doc.id, name: profile.name });
    });
    // Cache save
    localStorage.setItem('rtp_profiles_cache', JSON.stringify(profiles));
    // UI update
    _renderProfileCards(profileList, profiles);
  } catch (e) {
    if (!localStorage.getItem('rtp_profiles_cache')) {
      profileList.innerHTML = '<p style="color:#ef4444;">Firebase error. Check config.</p>';
    }
    console.error(e);
  }
}

// Show PIN Screen
function showPINScreen(userId, userName) {
  hideAllScreens();
  AppState.currentPINEntry = '';
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('pinUserName').textContent = userName;
  document.getElementById('pinUserAvatar').textContent = userName.charAt(0).toUpperCase();
  document.getElementById('pinError').style.display = 'none';
  document.getElementById('pinScreen').dataset.userId = userId;
  updatePINDots();
}

// PIN Input
function pinInput(num) {
  if (AppState.currentPINEntry.length >= 4) return;
  AppState.currentPINEntry += num;
  updatePINDots();
  if (AppState.currentPINEntry.length === 4) setTimeout(verifyPIN, 150);
}

function pinBackspace() {
  AppState.currentPINEntry = AppState.currentPINEntry.slice(0, -1);
  updatePINDots();
}

function pinClear() {
  AppState.currentPINEntry = '';
  updatePINDots();
}

function updatePINDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('dot' + i);
    if (dot) dot.classList.toggle('filled', i < AppState.currentPINEntry.length);
  }
}

// Verify PIN
async function verifyPIN() {
  const userId = document.getElementById('pinScreen').dataset.userId;
  const pinHash = await hashPIN(AppState.currentPINEntry);
  try {
    const doc = await db.collection('users').doc(userId).get();
    const profile = doc.data().profile;
    if (profile.pinHash === pinHash) {
      AppState.currentUser = { userId, name: profile.name };
      localStorage.setItem('rtp_current_user', JSON.stringify(AppState.currentUser));
      hideProfileScreens();
      await loadUserData();
      const lbl = document.getElementById('currentUserLabel');
      if (lbl) lbl.textContent = profile.name;
    } else {
      document.getElementById('pinError').style.display = 'block';
      AppState.currentPINEntry = '';
      updatePINDots();
    }
  } catch (e) {
    console.error(e);
  }
}

// Show Create Profile Screen
function showCreateProfile() {
  hideAllScreens();
  document.getElementById('createProfileScreen').style.display = 'flex';
  document.getElementById('createProfileError').style.display = 'none';
}

// Save New Profile
async function saveNewProfile() {
  const name = document.getElementById('newProfileName').value.trim();
  const pin = document.getElementById('newProfilePIN').value.trim();
  const pinConfirm = document.getElementById('newProfilePINConfirm').value.trim();
  const secQ = document.getElementById('newProfileSecQ').value;
  const secA = document.getElementById('newProfileSecA').value.trim().toLowerCase();

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
      settings: {}, watchlists: [], holdings: [], history: [], alerts: []
    });
    AppState.currentUser = { userId, name };
    localStorage.setItem('rtp_current_user', JSON.stringify(AppState.currentUser));
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

// Forgot PIN
function showForgotPIN() {
  hideAllScreens();
  document.getElementById('forgotPINScreen').style.display = 'flex';
  const userId = document.getElementById('pinScreen').dataset.userId;
  document.getElementById('forgotPINScreen').dataset.userId = userId;
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
  } catch (e) { console.error(e); }
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

// Load User Data from Firebase
async function loadUserData() {
  if (!AppState.currentUser) return;
  
  try {
    const doc = await db.collection('users').doc(AppState.currentUser.userId).get();
    if (!doc.exists) {
      await safeStartApp();
      return;
    }
    
    const data = doc.data();
    
    // Sync watchlists
    const fbWL = data.watchlists || [];
    if (fbWL.length > 0) {
      localStorage.setItem('watchlists', JSON.stringify(fbWL));
      if (AppState) {
        AppState.watchlists = fbWL;
        if (AppState.watchlists[AppState.currentWL]) {
          AppState.wl = AppState.watchlists[AppState.currentWL].stocks;
        }
      }
    }
    
    // Sync holdings
    if (data.holdings && data.holdings.length > 0) {
      localStorage.setItem('h', JSON.stringify(data.holdings));
      if (AppState) AppState.h = data.holdings;
    }
    
    // Sync history
    if (data.history && data.history.length > 0) {
      localStorage.setItem('hist', JSON.stringify(data.history));
      if (AppState) AppState.hist = data.history;
    }
    
    // Sync alerts
    if (data.alerts && data.alerts.length > 0) {
      localStorage.setItem('alerts', JSON.stringify(data.alerts));
      if (AppState) AppState.alerts = data.alerts;
    }
    
    // Sync settings
    if (data.settings) {
      if (data.settings.apiUrl && !localStorage.getItem('customAPI')) {
        localStorage.setItem('customAPI', data.settings.apiUrl);
      }
      if (data.settings.sheetId && !localStorage.getItem('sheetId')) {
        localStorage.setItem('sheetId', data.settings.sheetId);
      }
      if (data.settings.geminiKey && !localStorage.getItem('geminiApiKey')) {
        localStorage.setItem('geminiApiKey', data.settings.geminiKey);
      }
    }
    
    // Update UI
    const label = document.getElementById('currentUserLabel');
    if (label && AppState.currentUser) {
      label.textContent = AppState.currentUser.name;
    }
    
    const avatarEl = document.getElementById('settingsAvatarLetter');
    if (avatarEl && AppState.currentUser) {
      avatarEl.textContent = AppState.currentUser.name.charAt(0).toUpperCase();
    }
    
  } catch (e) {
    console.error('loadUserData error:', e);
  }
  
  await safeStartApp();
}

// Safe startApp wrapper
async function safeStartApp(retryCount = 0) {
  const MAX_RETRIES = 20;
  const RETRY_DELAY = 300;
  
  if (typeof startApp === 'function') {
    try {
      await startApp();
      console.log('✅ App started successfully');
    } catch(e) {
      console.error('startApp error:', e);
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => safeStartApp(retryCount + 1), RETRY_DELAY);
      }
    }
  } else {
    if (retryCount < MAX_RETRIES) {
      console.log(`Waiting for startApp... (${retryCount + 1}/${MAX_RETRIES})`);
      setTimeout(() => safeStartApp(retryCount + 1), RETRY_DELAY);
    } else {
      console.error('startApp never became available');
    }
  }
}

// Hide screens
function hideAllScreens() {
  ['profileScreen', 'pinScreen', 'createProfileScreen', 'forgotPINScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function hideProfileScreens() { hideAllScreens(); }

// Logout
function logoutUser() {
  localStorage.removeItem('rtp_current_user');
  AppState.currentUser = null;
  showProfileScreen();
}

// Register functions
window.initApp = initApp;
window.showProfileScreen = showProfileScreen;
window.showPINScreen = showPINScreen;
window.pinInput = pinInput;
window.pinBackspace = pinBackspace;
window.pinClear = pinClear;
window.showCreateProfile = showCreateProfile;
window.saveNewProfile = saveNewProfile;
window.showForgotPIN = showForgotPIN;
window.logoutUser = logoutUser;

console.log('✅ auth.js loaded successfully');
