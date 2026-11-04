// ========================================
// FORMAT AI NEWS TEXT
// ========================================
function formatAINewsText(raw) {
  if (!raw) return '<div style="color:var(--text-label,#4b6280);font-size:12px;">No data received.</div>';
  return raw
    .replace(/\*\*(.+?)\*\*/g, '<div style="font-size:11px;font-weight:700;color:var(--accent,#38bdf8);letter-spacing:0.5px;margin-top:12px;margin-bottom:4px;font-family:\'Noto Sans Devanagari\',\'Mangal\',sans-serif;">$1</div>')
    .replace(/\n/g, '<br>');
}

// ======================================
// 🧠 NIVI MODULAR AI SYSTEM
// ======================================
window.NIVI_FORCE_MODE = null;

const NIVI_MODES = {
  STOCK: "stock",
  FILE: "file",
  BEGINNER: "beginner",
  GENERAL: "general",
  IMAGE: "image"
};

const STOCK_EXPERT_PROMPT = `
You are Nivi, an expert stock market analyst.
Give actionable insights:
- Trend
- Support/Resistance
- Buy/Sell/Hold
Keep it short.
`;

const FILE_ANALYZER_PROMPT = `
You are Nivi, a document analysis expert.
- Summarize key points
- Extract important data
- Explain clearly
`;

const BEGINNER_PROMPT = `
You are Nivi, a friendly teacher.
Explain in very simple language (like for a beginner).
Use examples.
`;

// ✅ IMAGE MODE PROMPT
const IMAGE_ANALYZER_PROMPT = `
You are Nivi, an expert visual analyst for Indian stock market.
When analyzing an image:
- If it is a stock chart: identify trend (uptrend/downtrend/sideways), key support/resistance levels, patterns (head & shoulders, breakout, etc.), and give a Buy/Sell/Hold suggestion.
- If it is a portfolio screenshot: summarize holdings, identify best/worst performers, suggest any action.
- If it is a news screenshot or any other image: extract key information and explain clearly.
Always be concise and actionable. Mix Gujarati/Hindi/English naturally.
`;

function detectIntent(question, hasFile) {
  if (window.NIVI_FORCE_MODE) return window.NIVI_FORCE_MODE;

  const q = question.toLowerCase();

  if (hasFile) return NIVI_MODES.FILE;

    if (q.includes("stock") || q.includes("price") || q.includes("target") || q.includes("rsi")  || q.includes("buy") || q.includes("sell") || q.includes("hold") || q.includes("trend") || q.includes("analysis")) {
    return NIVI_MODES.STOCK;
  }

  if (q.includes("explain") || q.includes("shu") || q.includes("samjavo")) {
    return NIVI_MODES.BEGINNER;
  }

  return NIVI_MODES.GENERAL;
}

async function detectIntentAI(question, hasFile, mimeType) {
  if (window.NIVI_FORCE_MODE) return window.NIVI_FORCE_MODE;

  // ✅ IMAGE: PNG/JPG/WEBP/GIF → IMAGE mode
  if (hasFile && mimeType && mimeType.startsWith('image/')) return NIVI_MODES.IMAGE;

  if (hasFile) return NIVI_MODES.FILE;

  const prompt = `
Classify user intent into ONE of these:
- stock
- beginner
- general

User query: "${question}"

Reply ONLY with one word: stock / beginner / general
`;

  try {
    const r = await directGeminiCall(prompt);
    if (r && r.ok) {
      const intent = r.answer.toLowerCase().trim();

      if (intent.includes("stock")) return NIVI_MODES.STOCK;
      if (intent.includes("beginner")) return NIVI_MODES.BEGINNER;
    }
  } catch (e) {
    console.warn("AI intent detection failed");
  }

  return NIVI_MODES.GENERAL;
}

function buildModularPrompt(question, intent) {
  let base = "";

  switch (intent) {
    case NIVI_MODES.STOCK:
      base = STOCK_EXPERT_PROMPT;
      break;
    case NIVI_MODES.FILE:
      base = FILE_ANALYZER_PROMPT;
      break;
    case NIVI_MODES.BEGINNER:
      base = BEGINNER_PROMPT;
      break;
    case NIVI_MODES.IMAGE:
      base = IMAGE_ANALYZER_PROMPT;
      break;
    default:
      base = "You are a helpful AI assistant.";
  }

  return base + "\n\nUser Query:\n" + question;
}

// ======================================
// BUILD MOVER CHIPS (for Market Brief)
// ======================================
function buildMoverChips() {
  if (!AppState.wl || AppState.wl.length === 0) return '';
  const stocks = AppState.wl.map(s => {
    const d = AppState.cache[s]?.data;
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
    const color = isGainer ? 'var(--pos,#38bdf8)' : '#ef4444';
    const bg    = isGainer ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)';
    const border = isGainer ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
    const sign   = isGainer ? '+' : '';
    
    html += `<span onclick="openDetail('${s.sym}', false)" style="flex-shrink:0;cursor:pointer;background:${bg};border:1px solid ${border};border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:${color};font-family:'Rajdhani',sans-serif;white-space:nowrap;">${s.sym} ${sign}${s.pct.toFixed(2)}%</span>`;
  });
  return html;
}

// ======================================
// BUILD SMART CHIPS
// ======================================
function _buildSmartChips() {
  const topStocks = AppState.wl.slice(0, 3).map(s => {
    const d = AppState.cache[s]?.data;
    if (!d) return null;
    return s;
  }).filter(Boolean);

  const chips = [];

  if (topStocks.length > 0) {
    chips.push({ label: `${topStocks[0]} analysis`,  q: `${topStocks[0]} stock nu full analysis karo — buy, sell ke hold?` });
    if (topStocks[1]) chips.push({ label: `${topStocks[1]} target`,  q: `${topStocks[1]} no price target shu che? RSI ane technical shun kahe che?` });
  }
  chips.push(
    { label: '🔥 Watchlist best', q: 'મારી watchlist માં આજે સૌથી શ્રેષ્ઠ opportunity કઈ છે?' },
    { label: '📉 Portfolio risk', q: 'मेरे Portfolio में कोई risk है? कोई स्टॉक exit करना चाहता है?' },
    { label: '💡 Sector trend',  q: 'अभी कौन से सेक्टर में मज़बूती है और क्यों?' },
    { label: '📅 Today plan',    q: 'आज के लिए शॉर्ट-टर्म ट्रेडिंग प्लान क्या होना चाहिए?' }
  );
  return chips.slice(0, 6);
}

// ======================================
// RENDER NEWS TAB (Main News + Nivi Chat)
// ======================================
function renderNews() {
  const el = document.getElementById('news');
  if (!el) return;

  const smartChips = _buildSmartChips();
  const chipsHtml = smartChips.map(c =>
    `<button onclick="_tabChip('${c.q.replace(/'/g, "\\'")}')"
      style="flex-shrink:0;background:rgba(56,189,248,0.08);color:var(--accent,#38bdf8);border:1px solid rgba(56,189,248,0.25);border-radius:14px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;transition:all 0.2s;">${c.label}</button>`
  ).join('');

  el.innerHTML = `
  <div style="display:flex;flex-direction:column;height:100%;max-width:100%;width:100%;margin:0 auto;padding:4px 8px 6px;box-sizing:border-box;position:relative;overflow:hidden;">

    <!-- Chat Header with Live pulse, Fullscreen & Clear buttons -->
    <div style="flex-shrink:0;padding:2px 2px 6px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;align-items:center;gap:7px;">
        <span class="nivi-pulse-dot"></span>
        <span style="font-size:14px;font-weight:800;color:#c084fc;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">NIVI COPILOT</span>
        <span style="font-size:8.5px;background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:1px 6px;border-radius:8px;font-weight:700;letter-spacing:0.5px;">LIVE</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="niviFullscreenBtn" onclick="_toggleNiviFullscreen()" title="Fullscreen reading mode"
          style="background:rgba(56,189,248,0.1);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:8px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:'Rajdhani',sans-serif;transition:all 0.2s;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          Expand
        </button>
        <button onclick="_tabClearHistory()" title="Chat clear karo"
          style="background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:'Rajdhani',sans-serif;transition:all 0.2s;">
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4H5z" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Clear
        </button>
      </div>
    </div>

    <div id="nivi-section-chat" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">

      <!-- Market Brief Toggle Card -->
      <div style="flex-shrink:0;">
        <div id="tab-brief-card" style="display:none;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin:6px 0;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:6px;">
            ${buildMoverChips()}
          </div>
          <div id="tab-brief-body" style="font-size:12px;color:var(--text-primary);line-height:1.8;font-family:'Noto Sans Devanagari','Mangal',sans-serif;">
            <div style="text-align:center;padding:8px 0;">
              <div class="spinner" style="margin:0 auto 5px;border-top-color:var(--accent);"></div>
              <div style="font-size:11px;color:var(--accent);font-family:'Rajdhani',sans-serif;">Nivi soch rahi hai...</div>
            </div>
          </div>
          <div id="tab-brief-time" style="font-size:9px;color:var(--text-label);margin-top:4px;"></div>
        </div>
      </div>

      <!-- Chat Messages Scroll Area -->
      <div id="tab-chat-area" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:8px 0 6px 0;-webkit-overflow-scrolling:touch;min-height:0;">
      </div>

      <!-- Pinned Bottom Bar -->
      <div style="flex-shrink:0;padding:4px 0 2px 0;border-top:1px solid rgba(255,255,255,0.08);background:var(--bg-app);">

        <!-- Collapsible Prompt Chips Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
          <button id="toggleChipsBtn" onclick="_toggleChatChips()"
            style="background:transparent;border:none;color:var(--text-sec,#94a3b8);font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px 4px;font-family:'Rajdhani',sans-serif;">
            <span>💡 Quick Prompts</span>
            <span id="chipsChevron" style="font-size:9px;">▼</span>
          </button>
          <span style="font-size:9px;color:rgba(148,163,184,0.5);font-family:'Rajdhani',sans-serif;">Gemini 3.8 Intelligence</span>
        </div>

        <div id="tab-chips-container" style="display:${AppState._tabChatHistory && AppState._tabChatHistory.length > 0 ? 'none' : 'flex'};gap:5px;overflow-x:auto;margin-bottom:6px;padding-bottom:3px;scrollbar-width:none;">
          <button onclick="_tabToggleMood()"
            style="flex-shrink:0;background:rgba(192,132,252,0.12);color:#c084fc;border:1px solid rgba(192,132,252,0.3);border-radius:14px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;">
            📊 Market Mood
          </button>
          ${chipsHtml}
        </div>

        <div id="tab-file-preview" style="display:none;align-items:center;gap:8px;margin-bottom:6px;background:var(--bg-card);border:1px solid var(--accent-border);border-radius:10px;padding:6px 10px;">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><rect x="3" y="2" width="10" height="14" rx="2" stroke="var(--accent)" stroke-width="1.4"/><path d="M7 6h4M7 9h4M7 12h2" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/></svg>
          <span id="tab-file-name" style="font-size:11px;color:var(--accent);font-family:'Rajdhani',sans-serif;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
          <button onclick="_tabClearFile()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;padding:0 2px;">✕</button>
        </div>

        <div style="display:flex;gap:6px;align-items:center;">
          <div style="position:relative;flex-shrink:0;width:38px;height:38px;">
            <div style="width:100%;height:100%;background:rgba(56,189,248,0.1);color:var(--accent,#38bdf8);border:1px solid rgba(56,189,248,0.25);border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M4 10.5V6a4 4 0 018 0v7a2.5 2.5 0 01-5 0V7a1 1 0 012 0v6" stroke="var(--accent,#38bdf8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <input type="file" id="tab-file-input"
              accept=".pdf,.js,.html,.htm,.css,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp"
              style="position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer; z-index:10;"
              onchange="_tabFileSelected(this)">
          </div>

          <div style="flex:1;position:relative;">
            <textarea id="tab-nivi-input"
              placeholder="Ask anything to Nivi (e.g. NBCC Target & Analysis)..."
              rows="1"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_tabSend();}"
              oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';"
              style="width:100%;background:rgba(15,23,42,0.7);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:9px 12px;font-size:13px;color:var(--text-primary,#f1f5f9);font-family:'Rajdhani',sans-serif;outline:none;resize:none;line-height:1.4;box-sizing:border-box;min-height:38px;max-height:80px;overflow-y:auto;transition:all 0.2s;display:block;"
              onfocus="this.style.borderColor='var(--accent,#38bdf8)';this.style.boxShadow='0 0 10px rgba(56,189,248,0.2)';"
              onblur="this.style.borderColor='rgba(56,189,248,0.25)';this.style.boxShadow='none';">
            </textarea>
          </div>
          <button onclick="_tabSend()"
            style="background:linear-gradient(135deg,#0284c7,#2563eb);color:#ffffff;border:none;border-radius:12px;padding:9px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;flex-shrink:0;min-height:38px;height:38px;display:flex;align-items:center;gap:4px;box-shadow:0 2px 10px rgba(2,132,199,0.3);transition:all 0.2s;">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><path d="M2 10l16-8-6 8 6 8-16-8z" fill="#ffffff"/></svg>
            Send
          </button>
        </div>
        <div style="font-size:8.5px;color:rgba(148,163,184,0.6);margin-top:3px;font-family:'Rajdhani',sans-serif;text-align:center;letter-spacing:0.3px;">
          ⚠️ Nivi AI is for research &amp; education · Not SEBI advice · Verify yourself
        </div>
      </div>

    </div>
  </div>`;

  _tabLoadBrief();
  if (AppState._tabChatHistory.length === 0) {
    try {
      const saved = JSON.parse(localStorage.getItem('niviTabChat'));
      if (saved && saved.length > 0) AppState._tabChatHistory = saved;
    } catch(e) {}
  }
  _tabRenderChat();
}

function renderNewsInsights() {
  if (typeof _loadAIInsights === 'function') _loadAIInsights(false);
}

// Backward compatibility for internal subtabs
function _niviSubTab(tab) {
  if (tab === 'chat') {
    if (typeof switchNiviSubTab === 'function') switchNiviSubTab('chat');
  } else if (tab === 'news' || tab === 'insights') {
    if (typeof switchNiviSubTab === 'function') switchNiviSubTab('insights');
  }
}


// ======================================
// MARKET BRIEF LOADER
// ======================================
async function _tabLoadBrief() {
  const AI_NEWS_CACHE_KEY = 'aiNewsCache_v2';
  const AI_NEWS_CACHE_MS  = 30 * 60 * 1000;
  
  try {
    const cached = JSON.parse(localStorage.getItem(AI_NEWS_CACHE_KEY));
    if (cached && cached.syms === AppState.wl.slice(0,12).join(',') && (Date.now()-cached.ts) < AI_NEWS_CACHE_MS) {
      _tabSetBriefHtml(cached.html, cached.ts);
      return;
    }
  } catch(e) {}

  const stockLines = AppState.wl.slice(0, 12).map(s => {
    const d = AppState.cache[s]?.data;
    if (!d) return null;
    const price = d.regularMarketPrice || 0;
    const prev  = d.chartPreviousClose || 0;
    const diff  = price - prev;
    const pct   = prev ? ((diff / prev) * 100).toFixed(2) : '0.00';
    return `${s}: ₹${price.toFixed(2)} (${diff >= 0 ? '+' : ''}${pct}%)`;
  }).filter(Boolean);

  const today = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // 🚀 પ્રોમ્પ્ટ સુધારો: 'Google Search' હટાવ્યું
  const prompt = `
[SYSTEM: NIVI MARKET ANALYST]
Today: ${today}
My Watchlist Stocks: ${stockLines.join(', ') || "No data"}

TASK:
1. આપેલા વોચલિસ્ટ સ્ટોક્સના આધારે અત્યારના માર્કેટ મૂડનું વિશ્લેષણ કરો.
2. નીચેના ફોર્મેટમાં જવાબ આપો:
   - **આજનું માર્કેટ**
   - **વોચલિસ્ટ અપડેટ્સ**
   - **સેક્ટર નજર**
   - **નીવિની સલાહ**

LANGUAGE: ગુજરાતી અને અંગ્રેજી મિક્સ (Technical terms in English). Keep it under 180 words.
`;

  try {
    const allKeys = getGeminiKeys();
    let rawText = null;

    if (allKeys.length > 0) {
      const r = await directGeminiCall(prompt);
      if (r && r.ok) rawText = r.answer;
    }

    if (!rawText) {
      const r    = await fetch(`${getActiveGASUrl()}?type=askMarket&prompt=${encodeURIComponent(prompt)}`);
      const data = await r.json();
      rawText = data.answer || data.text || data.summary || null;
      if (!rawText) throw new Error('No response');
    }

    const htmlOut = formatAINewsText(rawText);
    try { localStorage.setItem(AI_NEWS_CACHE_KEY, JSON.stringify({ ts:Date.now(), syms:AppState.wl.slice(0,12).join(','), html:htmlOut })); } catch(e) {}
    _tabSetBriefHtml(htmlOut, Date.now());
  } catch(err) {
    const briefBody = document.getElementById('tab-brief-body');
    if (briefBody) briefBody.innerHTML = `<div style="font-size:11px;color:#f59e0b;padding:4px 0;">⚠️ Market brief load nahi hua.</div>`;
  }
}

function _tabSetBriefHtml(html, ts) {
  const briefBody = document.getElementById('tab-brief-body');
  const briefTime = document.getElementById('tab-brief-time');
  if (briefBody) briefBody.innerHTML = `<div style="font-size:12px;color:var(--text-primary,#e2e8f0);line-height:1.9;font-family:'Noto Sans Devanagari','Mangal',sans-serif;">${html}</div>`;
  if (briefTime && ts) {
    const mins = Math.round((Date.now()-ts)/60000);
    briefTime.innerText = mins < 1 ? '🟢 અત્યારે' : '🕐 ' + mins + ' મિનિટ પહેલા';
  }
}

function _tabToggleMood() {
  const card = document.getElementById('tab-brief-card');
  if (!card) return;
  const open = card.style.display !== 'none';
  card.style.display = open ? 'none' : 'block';
}

// ======================================
// TAB CHAT FUNCTIONS
// ======================================
// ======================================
// FILE UPLOAD HELPERS
// ======================================
window._tabFileSelected = function(input) {
  const file = input.files[0];
  if (!file) return;
  AppState._pendingFile = file;
  const preview = document.getElementById('tab-file-preview');
  const nameEl  = document.getElementById('tab-file-name');
  if (preview) preview.style.display = 'flex';
  if (nameEl)  nameEl.textContent = `📎 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  const inp = document.getElementById('tab-nivi-input');
  if (inp) { inp.placeholder = 'File attached! Shu janavvu che? 🙂'; inp.focus(); }
};

window._tabClearFile = function() {
  AppState._pendingFile = null;
  const preview = document.getElementById('tab-file-preview');
  const finput  = document.getElementById('tab-file-input');
  const inp     = document.getElementById('tab-nivi-input');
  if (preview) preview.style.display = 'none';
  if (finput)  finput.value = '';
  if (inp)     inp.placeholder = 'Ask anything to Nivi 🙂';
};

async function _tabSend() {
  const inp  = document.getElementById('tab-nivi-input');
  const q    = inp ? inp.value.trim() : '';
  const file = AppState._pendingFile || null;

  if (!q && !file) return;
  if (inp) { inp.value = ''; inp.style.height = '42px'; }

  if (file) {
    _tabClearFile();
    await _tabAskWithFile(q || 'Is file ke baare mein detail mein batao.', file);
  } else {
    await _tabAsk(q);
  }
}

async function _tabChip(question) {
  const inp = document.getElementById('tab-nivi-input');
  if (inp) { inp.value = question; inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 90) + 'px'; }
  await new Promise(r => setTimeout(r, 120));
  if (inp) { inp.value = ''; inp.style.height = '42px'; }
  await _tabAsk(question);
}

// સ્માર્ટ સર્ચ ડિટેક્ટર: જો યુઝર સમાચાર, કારણ કે રિઝલ્ટ પૂછે તો જ લાઈવ સર્ચ થશે
function _needsLiveSearch(q) {
  // ✅ Always enable Google Search Grounding with gemini-2.5-flash-lite for live stock data & analysis
  return true;
}

async function _tabAsk(question) {
  // 1. યુઝરનો મેસેજ હિસ્ટ્રીમાં સેવ અને રેન્ડર કરો
  AppState._tabChatHistory.push({ role:'user', text:question, ts:Date.now() });
  _tabRenderChat();

  const area = document.getElementById('tab-chat-area');
  
  // 2. સ્ટ્રીમિંગ માટે એક ટેમ્પરરી બબલ બનાવો
  const streamingMsgId = 'nivi-stream-' + Date.now();
  const loadingHtml = `
    <div id="wrapper-${streamingMsgId}" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 10px rgba(139,92,246,0.3);margin-top:2px;">
        <svg viewBox="0 0 28 28" width="13" height="13" fill="#ffffff"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z"/></svg>
      </div>
      <div class="nivi-ai-card">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:5px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;font-weight:700;color:#c084fc;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;">NIVI AI</span>
            <span style="font-size:8.5px;background:rgba(192,132,252,0.12);color:#c084fc;border:1px solid rgba(192,132,252,0.25);padding:1px 5px;border-radius:6px;font-weight:700;">PRO</span>
          </div>
        </div>
        <div id="${streamingMsgId}" style="line-height:1.65;">
          <span style="color:var(--accent,#38bdf8);font-size:12px;animation: pulse 1.5s infinite;">વિચારી રહી છું... ⚡</span>
        </div>
      </div>
    </div>`;
  area.insertAdjacentHTML('beforeend', loadingHtml);
  area.scrollTop = area.scrollHeight;

  // પ્રોમ્પ્ટ અને કોન્ટેક્સ્ટની તૈયારી
  const liveDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hasGujarati = /[\u0A80-\u0AFF]/.test(question);
  const langInstruction = hasGujarati
    ? "User has asked in Gujarati. Reply in Gujarati with English technical terms."
    : "Reply in Gujarati or Hindi or English based on user query.";

  const wlContext = AppState.wl.slice(0, 12).map(s => {
    const d = AppState.cache[s]?.data;
    if (!d || !d.regularMarketPrice) return null;
    const price = d.regularMarketPrice;
    const prev  = d.chartPreviousClose || price;
    const pct   = prev ? (((price - prev) / prev) * 100).toFixed(2) : '0.00';
    const sign  = pct >= 0 ? '+' : '';
    return `${s}: ₹${price.toFixed(2)} (${sign}${pct}%)`;
  }).filter(Boolean).join(', ');

  const intent = await detectIntentAI(question, false);
  const modularPrompt = buildModularPrompt(question, intent);

  // 🔍 Extract stock symbol if mentioned in query & compute verified facts
  let querySym = null;
  if (AppState.wl && AppState.wl.length > 0) {
    for (const s of AppState.wl) {
      const clean = s.replace(/\.(NS|BO)$/i, '');
      const regex = new RegExp(`\\b${clean}\\b`, 'i');
      if (regex.test(question)) { querySym = clean; break; }
    }
  }
  if (!querySym && AppState.cache) {
    for (const s of Object.keys(AppState.cache)) {
      const clean = s.replace(/\.(NS|BO)$/i, '');
      const regex = new RegExp(`\\b${clean}\\b`, 'i');
      if (regex.test(question)) { querySym = clean; break; }
    }
  }

  let verifiedFactsBlock = '';
  if (querySym && typeof buildStockFacts === 'function') {
    try {
      const facts = await buildStockFacts(querySym);
      if (facts && facts.verdict && facts.verdict !== 'NO_DATA') {
        verifiedFactsBlock = '\n' + (typeof factsToPromptBlock === 'function' ? factsToPromptBlock(facts) : JSON.stringify(facts)) + '\n';
      }
    } catch (err) {
      console.warn('buildStockFacts error:', err);
    }
  }

const systemPrompt = `[SYSTEM: ELITE FINANCIAL ANALYST — NIVI]
Mode: ${intent.toUpperCase()}
Today: ${liveDate}
User Watchlist: ${wlContext || 'No live data available'}
LANGUAGE: ${langInstruction}
${verifiedFactsBlock}
🚨 CRITICAL RULES FOR NIVI:
1. STRICT NO HALLUCINATION: You are dealing with real money. DO NOT guess any data.
2. VERIFIED FACTS COMPLIANCE: If [VERIFIED DATA] is provided above for ${querySym || 'the stock'}, you MUST base your analysis, Target, Stoploss, RSI, EMA, and Verdict on these exact numbers. DO NOT invent alternate numbers or contradict the rule-based verdict.
3. FINANCIAL RESULTS: If the user asks for Q1/Q2/Q3/Q4 results, you MUST provide EXACT figures (Revenue in Crores, Net Profit in Crores, EPS). 
4. NO GENERIC BLUFFING: Do not say "Revenue increased" or "Good profit" without providing the exact numbers.
5. ACTIONABLE FINANCIAL ANALYSIS: Always provide an actionable analysis with key Levels, Support, Resistance, Target, Stoploss, and overall Buy/Sell/Hold view using live web search and market data. If any specific quarterly data is unavailable, state the available facts and estimates clearly instead of refusing to answer.

${modularPrompt}
`;

  const geminiHistory = AppState._tabChatHistory.slice(0, -1).slice(-10)
    .filter(msg => msg && msg.text && !msg.text.startsWith('⚠️'))
    .map(msg => ({
      role: (msg.role === 'nivi' || msg.role === 'model') ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

  // 🚀 લાઈવ સર્ચ કરવું છે કે નહિ તે ચેક કરો
  const useLiveSearch = _needsLiveSearch(question);
  
  let answer = null;
  let apiError = null;
  const keys = getGeminiKeys();

  // જો કી જ ના હોય તો સીધો સ્પષ્ટ ગાઇડન્સ મેસેજ આપો
  if (keys.length === 0) {
    const tempWrapper = document.getElementById(`wrapper-${streamingMsgId}`);
    if (tempWrapper) tempWrapper.remove();

    const isGithub = window.location.hostname.includes('github.io');
    const msg = isGithub
      ? "⚠️ આ બ્રાઉઝરમાં Gemini API Key નથી મળી!\n\n💡 **મહત્વની નોંધ:** તમે Localhost (`localhost:5500`) પર કી સેવ કરી હશે, પરંતુ **GitHub Pages (`sahaj-droid.github.io`)** નો બ્રાઉઝર સ્ટોરેજ અલગ હોય છે.\n\n👉 કૃપા કરીને ઉપર જમણી બાજુ **👤 Sahaj (પ્રોફાઇલ / Settings)** પર ક્લિક કરી તમારી **Gemini API Key** અહીં પણ પેસ્ટ કરીને Save કરો."
      : "⚠️ આ બ્રાઉઝરમાં Gemini API Key નથી મળી. કૃપા કરીને ઉપર જમણી બાજુ **👤 Sahaj (પ્રોફાઇલ / Settings)** પર ક્લિક કરી Gemini API Key સેવ કરો.";

    AppState._tabChatHistory.push({ role:'nivi', text: msg, ts: Date.now() });
    localStorage.setItem('niviTabChat', JSON.stringify(AppState._tabChatHistory.slice(-30)));
    _tabRenderChat();
    return;
  }

  // 3. નવો સ્ટ્રીમિંગ API કોલ
  if (keys.length > 0) {
    const r = await directGeminiCallStreamMultiTurn(
      [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'Understood. I am Nivi, your elite financial analyst. Ready to help.' }] }, ...geminiHistory],
      question,
      (currentText) => {
        // જેમ જેમ ડેટા આવે તેમ UI અપડેટ કરો
        const msgDiv = document.getElementById(streamingMsgId);
        if (msgDiv) {
          msgDiv.innerHTML = _formatNiviResponse(currentText);
          area.scrollTop = area.scrollHeight;
        }
      },
      useLiveSearch // સર્ચ પેરામીટર પાસ કર્યો
    );
    if (r && r.ok) {
      answer = r.answer;
    } else if (r && r.error) {
      apiError = r.error;
    }
  }

  // જો Gemini API ફેલ થાય તો જૂનો Fallback
  if (!answer) {
    try {
      const fallbackPrompt = `${systemPrompt}\nUser Query: "${question}"`;
      const r = await fetch(`${getActiveGASUrl()}?type=askMarket&prompt=${encodeURIComponent(fallbackPrompt)}`);
      const data = await r.json();
      answer = data.answer || data.text || null;
    } catch(e) { console.error("Nivi bypass failed"); }
  }

  // 4. સ્ટ્રીમિંગ પૂરું થાય એટલે ટેમ્પરરી બબલ હટાવીને ઓરિજિનલ હિસ્ટ્રીમાં સેવ કરી લો
  const tempWrapper = document.getElementById(`wrapper-${streamingMsgId}`);
  if (tempWrapper) tempWrapper.remove();

  const fallback = apiError 
    ? `⚠️ Gemini API Error: ${apiError}\n\nકૃપા કરીને Google AI Studio માં જઈને API Key અથવા Quota ચેક કરો, અથવા Settings માં નવી કી અપડેટ કરો.`
    : "⚠️ Nivi Universal Brain is currently unresponsive. Please check your Gemini API keys.";
  AppState._tabChatHistory.push({ role:'nivi', text: answer || fallback, ts:Date.now() });

  localStorage.setItem('niviTabChat', JSON.stringify(AppState._tabChatHistory.slice(-30)));
  _tabRenderChat();
}

// ======================================
// FILE READING — _tabAskWithFile
// ======================================
async function _tabAskWithFile(question, file) {
  const fileName = file.name;
  
  // ✅ FIX: Native file.type use karyu jethi mimeType nu function miss thay to error na aave
  const mimeType = file.type || (typeof getFileMimeType === 'function' ? getFileMimeType(fileName) : 'application/octet-stream');
  const isImage  = mimeType.startsWith('image/');

  const displayMsg = `📎 ${fileName}\n${question}`;
  AppState._tabChatHistory.push({ role: 'user', text: displayMsg, ts: Date.now() });
  _tabRenderChat();
  _tabShowLoading(true);

  let answer = null;

  try {
    const base64   = await readFileAsBase64(file);
    const liveDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // ✅ IMAGE MODE: mimeType pass karo detectIntentAI ma
    const intent = await detectIntentAI(question, true, mimeType);
    const modularPrompt = buildModularPrompt(question, intent);

    let prompt = '';

    if (isImage) {
      // ✅ IMAGE-SPECIFIC PROMPT
      const defaultQ = question || 'Aa image analyze karo — shun dikhay che? Stock chart hoy to trend, levels ane suggestion apo.';
      prompt = `[SYSTEM: NIVI IMAGE ANALYZER]
Mode: IMAGE
Today: ${liveDate}
File: ${fileName}
Task: User e image upload kari che. Image carefully analyze karo ane user na question no jawab apo.
Reply in Gujarati/Hindi/English mix. Be concise and actionable.

${IMAGE_ANALYZER_PROMPT}

User Question: ${defaultQ}
`;
    } else {
      // ✅ EXISTING FILE PROMPT — unchanged
      prompt = `[SYSTEM: NIVI FILE ANALYZER]
Mode: FILE
Today: ${liveDate}
File: ${fileName}
Task: User e file upload kari che. File ni content read karo ane user na question no jawab apo.
Reply in Gujarati/Hindi/English mix. Be concise and helpful.

${modularPrompt}
`;
    }

    const r = await directGeminiCallWithFile(prompt, base64, mimeType);
    if (r && r.ok) answer = r.answer;
  } catch (e) {
    console.error('File read error:', e.message);
    answer = `⚠️ File read failed: ${e.message}`;
  }

  _tabShowLoading(false);
  AppState._tabChatHistory.push({ role: 'nivi', text: answer || '⚠️ Image read failed. Gemini API key check karo.', ts: Date.now() });
  localStorage.setItem('niviTabChat', JSON.stringify(AppState._tabChatHistory.slice(-30)));
  _tabRenderChat();
}

// ======================================
// FORMAT NIVI RESPONSE — Beautify AI output with KPI badges & clean typography
// ======================================
function _formatNiviResponse(text) {
  if (!text) return '';
  
  let html = text;

  // ૧. ખાલી લાઈનમાં એકલો '*' કે '-' હટાવવો
  html = html.replace(/^\s*[\*\-]\s*$/gm, '');

  // ૨. KPI Badges & Trading Stat Tags
  html = html.replace(/\b(Target|ટાર્ગેટ|પ્રાઇસ ટાર્ગેટ|Price Target)[:：]\s*(₹?\s*[\d\.\,]+)/gi, '<span class="nivi-kpi-target">🎯 Target: $2</span>');
  html = html.replace(/\b(Stoploss|Stop Loss|સ્ટોપલોસ|SL)[:：]\s*(₹?\s*[\d\.\,]+)/gi, '<span class="nivi-kpi-stoploss">🛑 Stoploss: $2</span>');
  html = html.replace(/\b(RSI)[:：]\s*([\d\.]+)/gi, '<span class="nivi-kpi-rsi">📊 RSI: $2</span>');
  html = html.replace(/\b(Bullish|તેજી)\b/gi, '<span class="nivi-tag-bullish">▲ $1</span>');
  html = html.replace(/\b(Bearish|મંદી)\b/gi, '<span class="nivi-tag-bearish">▼ $1</span>');

  // ૩. Bold (**text**) ને Inline (span) બનાવવું
  html = html.replace(/\*\*(.+?)\*\*/g, '<span style="font-weight:700;color:var(--accent,#38bdf8);letter-spacing:0.3px;">$1</span>');

  // ૪. Numbered list: "1. " or "1) "
  html = html.replace(/^(\d+)[.)]\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0;"><span style="color:var(--accent,#38bdf8);font-weight:700;font-size:11px;flex-shrink:0;">$1.</span><span style="font-size:13px;color:var(--text-primary,#f1f5f9);line-height:1.5;">$2</span></div>');

  // ૫. Bullet points: "- " or "* " or "• " 
  html = html.replace(/^\s*[•\-\*]\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0;"><span style="color:var(--accent,#38bdf8);flex-shrink:0;font-size:10px;margin-top:4px;">●</span><span style="font-size:13px;color:var(--text-primary,#f1f5f9);line-height:1.5;">$1</span></div>');

  // ૬. વધારાની ખાલી જગ્યાઓ (Extra Newlines) ક્લિયર કરવી
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace(/\n\n/g, '<div style="margin-top:6px;"></div>');
  html = html.replace(/\n*(<div[^>]*>)/g, '$1');
  html = html.replace(/(<\/div>)\n*/g, '$1');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function _tabRenderChat() {
  const area = document.getElementById('tab-chat-area');
  if (!area) return;

  if (AppState._tabChatHistory.length === 0) {
    area.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:30px 10px;text-align:center;">
        <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.2));border:1px solid rgba(168,85,247,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(168,85,247,0.25);">
          <svg viewBox="0 0 28 28" width="28" height="28" fill="#c084fc"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z"/></svg>
        </div>
        <div style="font-size:20px;font-weight:800;color:#c084fc;font-family:'Rajdhani',sans-serif;letter-spacing:2px;">NIVI COPILOT</div>
        <div style="font-size:12px;color:var(--text-sec,#94a3b8);max-width:320px;">AI Financial Copilot · Powered by Gemini 3.8 &amp; Live Search</div>
      </div>`;
    const c = document.getElementById('tab-chips-container');
    if (c) c.style.display = 'flex';
    return;
  }

  area.innerHTML = AppState._tabChatHistory.map((msg, idx) => {
    if (msg.role === 'user') {
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
        <div class="nivi-user-bubble">${escapeHtml(msg.text)}</div>
      </div>`;
    } else {
      const formatted = _formatNiviResponse(msg.text);
      const msgId = `nivi-msg-${idx}`;
      const timeStr = msg.ts ? new Date(msg.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
      return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 10px rgba(139,92,246,0.3);margin-top:2px;">
          <svg viewBox="0 0 28 28" width="13" height="13" fill="#ffffff"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z"/></svg>
        </div>
        <div class="nivi-ai-card">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:5px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;font-weight:700;color:#c084fc;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;">NIVI AI</span>
              <span style="font-size:8.5px;background:rgba(192,132,252,0.12);color:#c084fc;border:1px solid rgba(192,132,252,0.25);padding:1px 5px;border-radius:6px;font-weight:700;">PRO</span>
            </div>
            <button onclick="_copyNiviMsg('${msgId}', this)" title="Copy text"
              style="background:transparent;border:1px solid rgba(148,163,184,0.25);color:var(--text-sec,#94a3b8);border-radius:6px;padding:2px 7px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:'Rajdhani',sans-serif;transition:all 0.2s;">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
          </div>
          <div id="${msgId}" style="line-height:1.65;">${formatted}</div>
          ${timeStr ? `<div style="margin-top:6px;font-size:9.5px;color:rgba(148,163,184,0.5);text-align:right;">${timeStr}</div>` : ''}
        </div>
      </div>`;
    }
  }).join('');
  area.scrollTop = area.scrollHeight;
}

function _tabShowLoading(show) {
  const area = document.getElementById('tab-chat-area');
  if (!area) return;
  const existing = document.getElementById('tab-loading-indicator');
  if (show && !existing) {
    const el = document.createElement('div');
    el.id = 'tab-loading-indicator';
    el.style.cssText = 'padding:10px;display:flex;align-items:center;gap:8px;';
    el.innerHTML = '<span class="nivi-pulse-dot"></span><span style="color:var(--accent,#38bdf8);font-size:12px;font-family:\'Rajdhani\',sans-serif;">Nivi is thinking...</span>';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
  } else if (!show && existing) {
    existing.remove();
  }
}

function _tabClearHistory() {
  AppState._tabChatHistory = [];
  localStorage.removeItem('niviTabChat');
  _tabRenderChat();
}

function _toggleNiviFullscreen() {
  const niviEl = document.getElementById('nivi');
  if (!niviEl) return;
  const isFull = niviEl.classList.toggle('nivi-fullscreen');
  const btn = document.getElementById('niviFullscreenBtn');
  if (btn) {
    btn.innerHTML = isFull
      ? `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg> Collapse`
      : `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Expand`;
    btn.title = isFull ? 'Normal View' : 'Fullscreen reading mode';
    btn.style.background = isFull ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.1)';
    btn.style.color = isFull ? '#ef4444' : '#38bdf8';
    btn.style.borderColor = isFull ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.3)';
  }
  setTimeout(() => {
    const area = document.getElementById('tab-chat-area');
    if (area) area.scrollTop = area.scrollHeight;
  }, 100);
}

function _toggleChatChips() {
  const c = document.getElementById('tab-chips-container');
  const ch = document.getElementById('chipsChevron');
  if (!c) return;
  const isHidden = c.style.display === 'none';
  c.style.display = isHidden ? 'flex' : 'none';
  if (ch) ch.textContent = isHidden ? '▲' : '▼';
}

function _copyNiviMsg(msgId, btn) {
  const target = document.getElementById(msgId);
  if (!target) return;
  const text = target.innerText || target.textContent;
  if (!navigator.clipboard) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    _showCopySuccess(btn);
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    _showCopySuccess(btn);
  }).catch(() => {
    _showCopySuccess(btn);
  });
}

function _showCopySuccess(btn) {
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '✓ Copied';
  btn.style.color = '#10b981';
  btn.style.borderColor = 'rgba(16,185,129,0.5)';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.color = '';
    btn.style.borderColor = '';
  }, 1800);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
}

// ======================================
// AI INSIGHTS LOADER
// ======================================
const _INSIGHTS_CACHE_KEY = 'aiInsights_v1';
const _INSIGHTS_CACHE_MS  = 15 * 60 * 1000;

async function _loadAIInsights(forceRefresh) {
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(_INSIGHTS_CACHE_KEY));
      if (cached && (Date.now() - cached.ts) < _INSIGHTS_CACHE_MS) {
        _renderAIInsights(cached.data);
        return;
      }
    } catch(e) {}
  }

  const loadEl = document.getElementById('insights-loading');
  const btn    = document.getElementById('insights-refresh-btn');
  if (loadEl) loadEl.style.display = 'block';
  if (btn)    btn.disabled = true;

  const wlCtx = AppState.wl.slice(0, 15).map(s => {
    const d = AppState.cache[s] && AppState.cache[s].data;
    if (!d) return null;
    const price = d.regularMarketPrice || 0;
    const prev  = d.chartPreviousClose || 0;
    const pct   = prev ? (((price - prev) / prev) * 100).toFixed(2) : '0.00';
    return `${s}: ₹${price.toFixed(2)} (${pct}%)`;
  }).filter(Boolean).join(', ');

  const prompt = `
[SYSTEM: EXPERT INDIAN MARKET ANALYST]
Watchlist: ${wlCtx || 'No data'}

TASK:
નીચેના ૩ સેક્શનમાં એક્ઝેક્ટ હેડિંગ્સ સાથે જવાબ આપો:

**MARKET BRIEF**
[સમરી]

**WATCHLIST DIGEST**
[એનાલિસિસ]

**SENTIMENT SCANNER**
[સેન્ટિમેન્ટ]

LANGUAGE: Gujarati and English mix.
`;

  let result = { brief: null, digest: null, sentiment: null };
  try {
    const allKeys = getGeminiKeys();
    let rawText = null;
    if (allKeys.length > 0) {
      const r = await directGeminiCall(prompt);
      if (r && r.ok) rawText = r.answer;
    }
    if (!rawText) {
      const r = await fetch(`${getActiveGASUrl()}?type=askMarket&prompt=${encodeURIComponent(prompt)}`);
      const data = await r.json();
      rawText = data.answer || data.text || null;
    }
    if (rawText) result = _parseInsights(rawText);
  } catch(e) { console.warn('AI Insights failed'); }

  if (loadEl) loadEl.style.display = 'none';
  if (btn)    btn.disabled = false;

  try { localStorage.setItem(_INSIGHTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch(e) {}
  _renderAIInsights(result);
}

function _parseInsights(raw) {
  const result = { brief: '', digest: '', sentiment: '' };
  const briefMatch     = raw.match(/\*\*MARKET BRIEF\*\*([\s\S]*?)(?=\*\*WATCHLIST DIGEST\*\*|$)/i);
  const digestMatch    = raw.match(/\*\*WATCHLIST DIGEST\*\*([\s\S]*?)(?=\*\*SENTIMENT SCANNER\*\*|$)/i);
  const sentimentMatch = raw.match(/\*\*SENTIMENT SCANNER\*\*([\s\S]*?)$/i);
  result.brief     = briefMatch ? briefMatch[1].trim() : raw;
  result.digest    = digestMatch ? digestMatch[1].trim() : '';
  result.sentiment = sentimentMatch ? sentimentMatch[1].trim() : '';
  return result;
}

function _renderAIInsights(data) {
  const fmt = (text) => {
    if (!text) return '<span style="color:var(--text-label,#4b6280);font-size:11px;">No data.</span>';
    return text.split('\n').filter(l => l.trim()).map(l =>
      `<div style="margin-bottom:6px;font-size:12px;color:var(--text-primary,#e2e8f0);">${l.replace(/^[•\-\*]\s*/, '• ')}</div>`
    ).join('');
  };
  const b = document.getElementById('insights-brief-body');
  const d = document.getElementById('insights-digest-body');
  const s = document.getElementById('insights-sentiment-body');
  const t = document.getElementById('insights-timestamp');
  if (b) b.innerHTML = fmt(data.brief);
  if (d) d.innerHTML = fmt(data.digest);
  if (s) s.innerHTML = fmt(data.sentiment);
  if (t) t.textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
}

// ======================================
// NIVI MODAL CONTROLS
// ======================================
function openNivi(sym) {
  const modal = document.getElementById('niviModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('nivi-sym-label').innerText = sym;
  // ✅ FIX 3: Alag modal history — tab chat history clear na thay
  AppState._niviModalHistory = [];
  _niviModalAsk(`Analyze ${sym} stock in detail — price, trend, RSI, support/resistance, short-term outlook.`);
}

function closeNivi() {
  const modal = document.getElementById('niviModal');
  if (modal) modal.style.display = 'none';
}

function niviSend() {
  const input = document.getElementById('nivi-input');
  const q = input?.value.trim();
  if (!q) return;
  input.value = '';
  _niviModalAsk(q);
}

// ✅ FIX 3: Modal-specific ask — uses _niviModalHistory, not _tabChatHistory
async function _niviModalAsk(question) {
  if (!AppState._niviModalHistory) AppState._niviModalHistory = [];

  const liveDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const sym = document.getElementById('nivi-sym-label')?.innerText || '';
  const d   = AppState.cache[sym]?.data;
  const stockCtx = d
    ? `${sym}: ₹${(d.regularMarketPrice||0).toFixed(2)}, Change: ${(d.regularMarketChangePercent||0).toFixed(2)}%, High: ${(d.regularMarketDayHigh||0).toFixed(2)}, Low: ${(d.regularMarketDayLow||0).toFixed(2)}`
    : `${sym}: No live data`;

  let verifiedFactsBlock = '';
  if (sym && typeof buildStockFacts === 'function') {
    try {
      const facts = await buildStockFacts(sym);
      if (facts && facts.verdict && facts.verdict !== 'NO_DATA') {
        verifiedFactsBlock = '\n' + (typeof factsToPromptBlock === 'function' ? factsToPromptBlock(facts) : JSON.stringify(facts)) + '\n';
      }
    } catch (e) {}
  }

  const systemPrompt = `[SYSTEM: ELITE FINANCIAL ANALYST — NIVI]
Today: ${liveDate}
Stock Context: ${stockCtx}
${verifiedFactsBlock}
Task: Answer about ${sym}. Be concise and actionable. Mix Gujarati/Hindi/English. Use verified facts and rule-based verdict if available.`;

  const geminiHistory = AppState._niviModalHistory.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  AppState._niviModalHistory.push({ role: 'user', text: question });

  let answer = null;
  const keys = getGeminiKeys();
  if (keys.length > 0) {
    const r = await directGeminiCallMultiTurn(
      [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'Understood. Ready to analyze.' }] }, ...geminiHistory],
      question
    );
    if (r && r.ok) answer = r.answer;
  }
  if (!answer) {
    try {
      const r = await fetch(`${getActiveGASUrl()}?type=askMarket&prompt=${encodeURIComponent(systemPrompt + '\nQuery: ' + question)}`);
      const data = await r.json();
      answer = data.answer || data.text || null;
    } catch(e) {}
  }

  AppState._niviModalHistory.push({ role: 'nivi', text: answer || '⚠️ Nivi unresponsive. Check API keys.' });

  // Modal chat area render karo (existing modal UI reuse)
  const chatArea = document.getElementById('nivi-chat-area');
  if (chatArea) {
    chatArea.innerHTML = AppState._niviModalHistory.map(msg => {
      if (msg.role === 'user') {
        return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;"><div style="background:var(--accent-bg,#1e3a5f);color:var(--text-primary,#e2e8f0);border-radius:14px 14px 2px 14px;padding:9px 13px;max-width:82%;font-size:13px;">${escapeHtml(msg.text)}</div></div>`;
      } else {
        const formatted = _formatNiviResponse(msg.text);
        return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;"><div style="width:24px;height:24px;border-radius:50%;border:1.5px solid var(--accent,#38bdf8);background:var(--bg-card,#0d1f35);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 28 28" width="12" height="12" fill="var(--accent,#38bdf8)"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z"/></svg></div><div style="background:var(--bg-card,#0d1f35);border:1px solid rgba(56,189,248,0.2);color:var(--text-primary,#e2e8f0);border-radius:2px 14px 14px 14px;padding:10px 12px;max-width:85%;font-size:12px;line-height:1.7;font-family:'Noto Sans Devanagari','Rajdhani',sans-serif;">${formatted}</div></div>`;
      }
    }).join('');
    chatArea.scrollTop = chatArea.scrollHeight;
  }
}

function niviChip(question) { _niviModalAsk(question); }
function niviClearChat() {
  AppState._niviModalHistory = [];
  const chatArea = document.getElementById('nivi-chat-area');
  if (chatArea) chatArea.innerHTML = '';
}

// ======================================
// REGISTER FUNCTIONS
// ======================================
window._niviSubTab = _niviSubTab;
window._tabLoadBrief = _tabLoadBrief;
window._tabToggleMood = _tabToggleMood;
window._tabSend = _tabSend;
window._tabChip = _tabChip;
window._tabClearHistory = _tabClearHistory;
window._loadAIInsights = _loadAIInsights;
window.openNivi = openNivi;
window.closeNivi = closeNivi;
window.niviSend = niviSend;
window.niviChip = niviChip;
window.niviClearChat = niviClearChat;
window._niviModalAsk = _niviModalAsk;
window._tabAskWithFile = _tabAskWithFile;
window._tabFileSelected = _tabFileSelected;
window._tabClearFile = _tabClearFile;
window._toggleNiviFullscreen = _toggleNiviFullscreen;
window._toggleChatChips = _toggleChatChips;
window._copyNiviMsg = _copyNiviMsg;

// AppState init — pendingFile
if (!AppState._pendingFile) AppState._pendingFile = null;

console.log('✅ nivi.js loaded | File Upload: ON | Gemini Only Mode');
