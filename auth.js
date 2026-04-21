// ========================================
// AUTH MODULE — RealTradePro
// ========================================
// Depends on: AppState (app.js), db (firebase), startApp (app.js)

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
  AppState.currentPINEntry = '';
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('pinUserName').textContent = userName;
  document.getElementById('pinUserAvatar').textContent = userName.charAt(0).toUpperCase();
  document.getElementById('pinError').style.display = 'none';
  document.getElementById('pinScreen').dataset.userId = userId;
  updatePINDots();
}

// ---- PIN Input ----
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

// ---- Verify PIN ----
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

// ---- Forgot PIN ----
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

// ---- Load User Data from Firebase ----
async function loadUserData() {
  if (!AppState.currentUser) return;
  try {
    const doc = await db.collection('users').doc(AppState.currentUser.userId).get();
    if (!doc.exists) { await startApp(); return; }
    const data = doc.data();
    const localWL = JSON.parse(localStorage.getItem('watchlists') || '[]');
    const fbWL = data.watchlists || [];
    if (fbWL.length >= localWL.length) localStorage.setItem('watchlists', JSON.stringify(fbWL));
    if ((data.holdings || []).length > 0) localStorage.setItem('h', JSON.stringify(data.holdings));
    const localHist = JSON.parse(localStorage.getItem('hist') || '[]');
    if ((data.history || []).length >= localHist.length) localStorage.setItem('hist', JSON.stringify(data.history || []));
    if ((data.alerts || []).length > 0) localStorage.setItem('alerts', JSON.stringify(data.alerts));
    if (data.settings) {
      if (data.settings.apiUrl && !localStorage.getItem('customAPI')) localStorage.setItem('customAPI', data.settings.apiUrl);
      if (data.settings.sheetId && !localStorage.getItem('sheetId')) localStorage.setItem('sheetId', data.settings.sheetId);
      if (data.settings.geminiKey && !localStorage.getItem('geminiApiKey')) localStorage.setItem('geminiApiKey', data.settings.geminiKey);
    }
    const label = document.getElementById('currentUserLabel');
    if (label) label.textContent = AppState.currentUser.name;
  } catch (e) { console.error('loadUserData error:', e); }
  await startApp();
}

// ---- Save User Data to Firebase ----
async function saveUserData(field) {
  if (!AppState.currentUser) return;
  const now = Date.now();
  if (!field && saveUserData._lastSave && (now - saveUserData._lastSave) < 500) return;
  saveUserData._lastSave = now;
  try {
    let payload = {};
    if (!field || field === 'watchlists') payload.watchlists = JSON.parse(localStorage.getItem('watchlists') || '[]');
    if (!field || field === 'holdings') payload.holdings = JSON.parse(localStorage.getItem('h') || '[]');
    if (!field || field === 'history') payload.history = JSON.parse(localStorage.getItem('hist') || '[]');
    if (!field || field === 'alerts') payload.alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    if (!field || field === 'settings') {
      payload.settings = {
        apiUrl: localStorage.getItem('customAPI') || '',
        sheetId: localStorage.getItem('sheetId') || '',
        geminiKey: localStorage.getItem('geminiApiKey') || ''
      };
    }
    await db.collection('users').doc(AppState.currentUser.userId).update(payload);
  } catch (e) { console.error('saveUserData error:', e); }
}

// ---- Hide All Profile Screens ----
function hideAllScreens() {
  ['profileScreen','pinScreen','createProfileScreen','forgotPINScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function hideProfileScreens() { hideAllScreens(); }

// ---- Logout ----
function logoutUser() {
  localStorage.removeItem('rtp_current_user');
  AppState.currentUser = null;
  showProfileScreen();
}
