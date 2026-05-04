// ============================================================
// RTP THEME ENGINE v2.1 — Fixed for Live Prices & CSS Vars
// Watches ALL DOM changes — auto-applies light/dark theme
// ============================================================

// 🔥 NEW FIX: Global CSS Variables (આનાથી લાઈવ પ્રાઈઝમાં કલર જાતે બદલાશે)
const themeStyle = document.createElement('style');
themeStyle.innerHTML = `
  .light-mode {
    --bg-app: #f0f9ff !important;
    --bg-card: #ffffff !important;
    --bg-card2: #f8fafc !important;
    --bg-header: #f0f9ff !important;
    --border: #bae6fd !important;
    --text-primary: #0f172a !important;
    --text-sec: #475569 !important;
    --text-muted: #64748b !important;
    --accent: #0284c7 !important;
    --pos: #0284c7 !important;   /* લાઈટ મોડમાં + માટે ભૂરો કલર */
    --neg: #dc2626 !important;   /* લાઈટ મોડમાં - માટે લાલ કલર */
  }
`;
document.head.appendChild(themeStyle);

const RTP_DARK = {
  bg:      ['#071428','#0a0f1a','#060e1a','#060d1a','#080f1a','#0a1220','#080c18','#071221','#0f1e33','#0a0e1a'],
  card:    ['#0d1f35','#0d1425','#111827','#1a2332','#0d1a2e','#0f2a40','#0a1628','#0a1e14','#0a2218','#0f2a1a','#0a2218','#1e3a5f'],
  green:   ['#34d399','#22c55e','#86efac','#00d4aa','#065f46','#166534','#0f2a1a','#0a2218','#0a1e14'],
  textDark:['#e2e8f0','#cbd5e1'],
  textMid: ['#94a3b8'],
  textMuted:['#4b6280','#64748b'],
};

const RTP_LIGHT = {
  bg:      '#f0f9ff',
  card:    '#ffffff',
  cardAlt: '#f8fafc',
  border:  '#bae6fd',
  text:    '#0f172a',
  textSec: '#475569',
  textMuted:'#64748b',
  accent:  '#0284c7',
  pos:     '#0284c7',
};

// Color map: dark hex → light hex
const COLOR_MAP_LIGHT = {
  // Backgrounds
  '#071428': RTP_LIGHT.bg, '#0a0f1a': RTP_LIGHT.bg, '#060e1a': RTP_LIGHT.bg, '#060d1a': RTP_LIGHT.bg,
  '#080f1a': RTP_LIGHT.bg, '#0a1220': RTP_LIGHT.cardAlt, '#080c18': RTP_LIGHT.bg, '#071221': RTP_LIGHT.bg,
  '#0f1e33': RTP_LIGHT.bg, '#0a0e1a': RTP_LIGHT.bg,
  // Cards
  '#0d1f35': RTP_LIGHT.card, '#0d1425': RTP_LIGHT.card, '#111827': RTP_LIGHT.card, '#1a2332': RTP_LIGHT.card,
  '#0d1a2e': RTP_LIGHT.cardAlt, '#0f2a40': '#dbeafe', '#0a1628': RTP_LIGHT.cardAlt, '#0a1e14': RTP_LIGHT.card,
  '#0a2218': RTP_LIGHT.card, '#0f2a1a': '#dbeafe', '#1e3a5f': '#dbeafe',
  // Text
  '#e2e8f0': RTP_LIGHT.text, '#cbd5e1': RTP_LIGHT.textSec, '#94a3b8': RTP_LIGHT.textSec, 
  '#4b6280': RTP_LIGHT.textMuted, '#64748b': RTP_LIGHT.textMuted,
  // Green → Cyan
  '#34d399': RTP_LIGHT.accent, '#22c55e': RTP_LIGHT.accent, '#86efac': RTP_LIGHT.accent, 
  '#00d4aa': RTP_LIGHT.accent, '#065f46': '#dbeafe', '#166534': '#dbeafe', '#0f2a1a': '#dbeafe',
  // Borders
  '#1e3a5f': '#bae6fd', '#2d3f52': '#bae6fd', '#1e2d3d': '#bae6fd', '#2d5a8e': '#93c5fd',
  // Accents stay
  '#38bdf8': RTP_LIGHT.accent, '#fb923c': '#d97706',
};

// rgba patterns → light equivalents
const RGBA_MAP_LIGHT = [
  [/rgba\(52,211,153,[0-9.]+\)/g,   (m) => m.replace('52,211,153', '2,132,199')],
  [/rgba\(34,197,94,[0-9.]+\)/g,    (m) => m.replace('34,197,94',  '2,132,199')],
  [/rgba\(255,255,255,0\.0[0-9]+\)/g, () => 'rgba(0,0,0,0.04)'],
  [/rgba\(255,255,255,0\.1[0-9]*\)/g, () => 'rgba(0,0,0,0.06)'],
  [/rgba\(127,29,29,[0-9.]+\)/g,    (m) => m.replace('127,29,29', '220,38,38')],
  [/rgba\(6,95,70,[0-9.]+\)/g,      (m) => m.replace('6,95,70',   '2,132,199')],
];

let _rtpProcessing = false;

function _fixInlineStyle(el, isLight) {
  if (!el || !el.style) return;
  if (el.dataset && el.dataset.notheme) return;
  if (el.dataset && el.dataset.flashing) return;  // ← NEW
  if (el.closest && el.closest('[data-notheme]')) return;
  if (el.classList && el.classList.contains('act-btn')) return;
  if (el.closest && el.closest('#profileScreen,#pinScreen,#createProfileScreen,#forgotPINScreen')) return;
  if (isLight && el._rtpDone === 'light') return;
  if (!isLight && el._rtpDone === 'dark') return;

  if (isLight) {
    if (!el._rtpOrigCss) {
      el._rtpOrigCss = el.getAttribute('style') || '';
    }
    let css = el._rtpOrigCss;
    if (!css) return;

    for (const [dark, light] of Object.entries(COLOR_MAP_LIGHT)) {
      css = css.replace(new RegExp(dark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), light);
    }
    for (const [pattern, replacer] of RGBA_MAP_LIGHT) {
      css = css.replace(pattern, replacer);
    }
    css = css.replace(/linear-gradient\(145deg,#111827,#1a2332\)/gi, 'linear-gradient(145deg,#ffffff,#f0f9ff)');
    css = css.replace(/linear-gradient\(135deg,#0d2a45,#0a1f35\)/gi, 'linear-gradient(135deg,#dbeafe,#eff6ff)');
    css = css.replace(/linear-gradient\(135deg,#0a2218,#0f2a1a\)/gi, 'linear-gradient(135deg,#dbeafe,#eff6ff)');
    css = css.replace(/linear-gradient\(135deg,#0a1e14,#0f1e33\)/gi, 'linear-gradient(135deg,#dbeafe,#eff6ff)');
    css = css.replace(/linear-gradient\(90deg,#0a0f1a,#0f1e33\)/gi, 'linear-gradient(90deg,#e0f2fe,#f0f9ff)');

    _rtpProcessing = true;
    el.setAttribute('style', css);
    el._rtpDone = 'light';
    _rtpProcessing = false;

  } else {
    if (el._rtpOrigCss !== undefined) {
      _rtpProcessing = true;
      el.setAttribute('style', el._rtpOrigCss);
      el._rtpOrigCss = undefined;
      el._rtpDone = 'dark';
      _rtpProcessing = false;
    }
  }
}

function _applyThemeToEl(el, isLight) {
  if (!el || el.nodeType !== 1) return;
  if (el.closest && el.closest('#profileScreen,#pinScreen,#createProfileScreen,#forgotPINScreen')) return;
  _fixInlineStyle(el, isLight);
  el.querySelectorAll && el.querySelectorAll('[style]').forEach(child => _fixInlineStyle(child, isLight));
}

function applyFullTheme() {
  const isLight = document.body.classList.contains('light-mode');
  document.querySelectorAll('[style]').forEach(el => {
    if (el.dataset && el.dataset.notheme) return;
    if (el.closest && el.closest('[data-notheme]')) return;
    _fixInlineStyle(el, isLight);
  });
}

// MutationObserver
let _rtpObserver = null;
function startThemeObserver() {
  if (_rtpObserver) _rtpObserver.disconnect();

  _rtpObserver = new MutationObserver((mutations) => {
    if (_rtpProcessing) return; 
    const isLight = document.body.classList.contains('light-mode');
    if (!isLight) return;

    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.dataset && node.dataset.notheme) return;
        if (node.closest && node.closest('[data-notheme]')) return;
        if (node.getAttribute && node.getAttribute('style')) _fixInlineStyle(node, true);
        node.querySelectorAll && node.querySelectorAll('[style]').forEach(el => {
          if (el.closest && el.closest('[data-notheme]')) return;
          _fixInlineStyle(el, true);
        });
      });
      if (m.type === 'attributes' && m.attributeName === 'style') {
        const el = m.target;
        if (el.dataset && el.dataset.notheme) return;
        if (el.closest && el.closest('[data-notheme]')) return;
        
        // 🚨 ભૂલ સુધારી લીધી: અહીંથી પેલી 2 લાઈનો (el._rtpDone = null વાળી) કાઢી નાખી છે જે લૂપ બનાવતી હતી!
        _fixInlineStyle(el, true);
      }
    });
  });

  _rtpObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
}

// INIT THEME
(function initTheme() {
  const saved = localStorage.getItem('rtp_theme') || 'dark';
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = '☀️';
  }
})();

window.toggleAppTheme = function() {
  const isLight = document.body.classList.toggle('light-mode');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('rtp_theme', isLight ? 'light' : 'dark');

  if (typeof AppState !== 'undefined') AppState.isDark = !isLight;

  if (typeof _patchVisibleWLPrices === 'function') _patchVisibleWLPrices();

  setTimeout(applyFullTheme, 50);
  setTimeout(applyFullTheme, 300);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    startThemeObserver();
    if (localStorage.getItem('rtp_theme') === 'light') setTimeout(applyFullTheme, 500);
  });
} else {
  startThemeObserver();
  if (localStorage.getItem('rtp_theme') === 'light') setTimeout(applyFullTheme, 500);
}
window.applyFullTheme = applyFullTheme;
window.startThemeObserver = startThemeObserver;
