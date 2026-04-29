// ========================================
// FORMAT AI NEWS TEXT
// ========================================
function formatAINewsText(raw) {
  if (!raw) return '<div style="color:#4b6280;font-size:12px;">No data received.</div>';
  return raw
    .replace(/\*\*(.+?)\*\*/g, '<div style="font-size:11px;font-weight:700;color:#34d399;letter-spacing:0.5px;margin-top:12px;margin-bottom:4px;font-family:\'Noto Sans Devanagari\',\'Mangal\',sans-serif;">$1</div>')
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
  GENERAL: "general"
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

function detectIntent(question, hasFile) {
  if (window.NIVI_FORCE_MODE) return window.NIVI_FORCE_MODE;

  const q = question.toLowerCase();

  if (hasFile) return NIVI_MODES.FILE;

  if (q.includes("stock") || q.includes("price") || q.includes("target") || q.includes("rsi"))  || q.includes("buy") || q.includes("sell") || q.includes("hold") || q.includes("trend") || q.includes("analysis")){
    return NIVI_MODES.STOCK;
  }

  if (q.includes("explain") || q.includes("shu") || q.includes("samjavo")) {
    return NIVI_MODES.BEGINNER;
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
    const color = isGainer ? '#22c55e' : '#ef4444';
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
    { label: '📊 Market mood',   q: 'आज बाज़ार कैसा है? निफ्टी का ट्रेंड क्या है?' },
    { label: '🔥 Watchlist best', q: 'मेरी watchlist में आज सबसे श्रेष्ठ opportunity कौन सी है?' },
    { label: '📉 Portfolio risk', q: 'मेरे Portfolio में कोई risk है? कोई स्टॉक exit करना चाहता है?' },
    { label: '💡 Sector trend',  q: 'अभी कौन से सेक्टर में मज़बूती है और क्यों?' },
    { label: '📅 Today plan',    q: 'आज के लिए शॉर्ट-टर्म ट्रेडिंग प्लान क्या होना चाहिए?' }
  );
  return chips.slice(0, 6);
}

// ======================================
// RENDER NEWS TAB (Main News + Nivi Chat)
// ======================================
async function renderNews() {
  const el = document.getElementById('news');
  if (!el) return;
  const _appHdr    = document.getElementById('fixedHeader');
  const _botNav    = document.querySelector('.fixed.bottom-0');
  const _top = _appHdr ? _appHdr.offsetHeight : 102;
  const _bot = _botNav ? _botNav.offsetHeight : 56;

  const smartChips = _buildSmartChips();
  const chipsHtml = smartChips.map(c =>
    `<button onclick="_tabChip('${c.q.replace(/'/g, "\\'")}')"
      style="flex-shrink:0;background:#0f2a1a;color:#34d399;border:1px solid rgba(52,211,153,0.3);border-radius:16px;padding:5px 11px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;letter-spacing:0.2px;">${c.label}</button>`
  ).join('');

  el.innerHTML = `
  <div style="display:flex;flex-direction:column;position:fixed;left:50%;transform:translateX(-50%);width:100%;max-width:448px;top:${_top}px;bottom:${_bot}px;overflow:hidden;padding:8px 12px 0 12px;box-sizing:border-box;background:#0a0f1a;z-index:1;">

    <div style="flex-shrink:0;padding-bottom:6px;">
      <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
        <button id="nivi-subtab-chat" onclick="_niviSubTab('chat')"
          style="flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid #065f46;background:#065f46;color:#34d399;">
          💬 Nivi Chat
        </button>
        <button id="nivi-subtab-news" onclick="_niviSubTab('news')"
          style="flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;border:1px solid #1e3a5f;background:transparent;color:#4b6280;">
          📰 AI Insights
        </button>
        <button onclick="_tabClearHistory()" title="Chat clear karo"
          style="flex-shrink:0;background:transparent;color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:5px 9px;cursor:pointer;line-height:1;">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none"><path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4H5z" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <div id="nivi-section-chat" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">

      <div style="flex-shrink:0;">
        <div id="tab-brief-card" style="display:none;background:linear-gradient(135deg,#0a1e14,#0f1e33);border:1px solid rgba(52,211,153,0.2);border-radius:10px;padding:8px 12px;margin-bottom:6px;">
          <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:6px;">
            ${buildMoverChips()}
          </div>
          <div id="tab-brief-body" style="font-size:12px;color:#e2e8f0;line-height:1.8;font-family:'Noto Sans Devanagari','Mangal',sans-serif;">
            <div style="text-align:center;padding:8px 0;">
              <div class="spinner" style="margin:0 auto 5px;"></div>
              <div style="font-size:11px;color:#34d399;font-family:'Rajdhani',sans-serif;">Nivi soch rahi hai...</div>
            </div>
          </div>
          <div id="tab-brief-time" style="font-size:9px;color:#4b6280;margin-top:4px;"></div>
        </div>
      </div>

      <div id="tab-chat-area" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px 0 6px 0;-webkit-overflow-scrolling:touch;min-height:0;">
      </div>

      <div style="flex-shrink:0;padding:8px 0 10px 0;border-top:1px solid rgba(52,211,153,0.15);background:#0a0f1a;">

        <div style="display:flex;gap:5px;overflow-x:auto;margin-bottom:8px;padding-bottom:2px;scrollbar-width:none;">
          <button onclick="_tabToggleMood()"
            style="flex-shrink:0;background:rgba(52,211,153,0.08);color:#34d399;border:1px solid rgba(52,211,153,0.25);border-radius:16px;padding:5px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;white-space:nowrap;">
            📊 Market Mood
          </button>
          ${chipsHtml}
        </div>

        <div id="tab-file-preview" style="display:none;align-items:center;gap:8px;margin-bottom:6px;background:#0a1e14;border:1px solid rgba(52,211,153,0.25);border-radius:10px;padding:6px 10px;">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><rect x="3" y="2" width="10" height="14" rx="2" stroke="#34d399" stroke-width="1.4"/><path d="M7 6h4M7 9h4M7 12h2" stroke="#34d399" stroke-width="1.2" stroke-linecap="round"/></svg>
          <span id="tab-file-name" style="font-size:11px;color:#34d399;font-family:'Rajdhani',sans-serif;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
          <button onclick="_tabClearFile()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;padding:0 2px;">✕</button>
        </div>

        <input type="file" id="tab-file-input"
          accept=".pdf,.js,.html,.htm,.css,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp"
          style="display:none;"
          onchange="_tabFileSelected(this)">

        <div style="display:flex;gap:8px;align-items:center;">
          <button onclick="document.getElementById('tab-file-input').click()"
            title="File attach karo (PDF, JS, HTML...)"
            style="flex-shrink:0;background:rgba(52,211,153,0.08);color:#34d399;border:1px solid rgba(52,211,153,0.2);border-radius:12px;padding:0;width:42px;height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer;align-self:flex-end;">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M4 10.5V6a4 4 0 018 0v7a2.5 2.5 0 01-5 0V7a1 1 0 012 0v6" stroke="#34d399" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <div style="flex:1;position:relative;">
            <textarea id="tab-nivi-input"
              placeholder="Ask anything to Nivi in Hindi, Gujarati, English 🙂"
              rows="1"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_tabSend();}"
              oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,90)+'px';"
              style="width:100%;background:#0a1628;border:1px solid #1e3a5f;border-radius:12px;padding:10px 14px;font-size:13px;color:#e2e8f0;font-family:'Rajdhani',sans-serif;outline:none;resize:none;line-height:1.5;box-sizing:border-box;min-height:42px;max-height:90px;overflow-y:auto;transition:border-color 0.2s;display:block;vertical-align:middle;"
              onfocus="this.style.borderColor='rgba(52,211,153,0.5)'"
              onblur="this.style.borderColor='#1e3a5f'">
            </textarea>
          </div>
          <button onclick="_tabSend()"
            style="background:#065f46;color:#34d399;border:none;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;flex-shrink:0;min-height:42px;height:42px;display:flex;align-items:center;gap:5px;align-self:flex-end;">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><path d="M2 10l16-8-6 8 6 8-16-8z" fill="#34d399"/></svg>
            Send
          </button>
        </div>
        <div style="font-size:9px;color:#2d4a3e;margin-top:5px;font-family:'Rajdhani',sans-serif;text-align:center;">
          ⚠️ Nivi = AI assistant · Not SEBI registered advisor· Research yourself
        </div>
      </div>

    </div><div id="nivi-section-news" style="display:none;flex-direction:column;flex:1;overflow-y:auto;padding:0 4px 8px 4px;">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;color:#38bdf8;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;">AI INSIGHTS</div>
        <button onclick="_loadAIInsights(true)" id="insights-refresh-btn"
          style="background:#0f2a1a;color:#34d399;border:1px solid #065f46;border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Rajdhani',sans-serif;">
          ⟳ Refresh
        </button>
      </div>

      <div id="insights-loading" style="display:none;text-align:center;padding:20px 0;">
        <div style="font-size:20px;display:inline-block;animation:spin 1s linear infinite;">⚙</div>
        <div style="font-size:11px;color:#4b6280;margin-top:6px;font-family:'Rajdhani',sans-serif;">Nivi is analyzing...</div>
      </div>

      <div id="insights-brief" style="background:#0d1f35;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#38bdf8;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;margin-bottom:8px;">📈 MARKET BRIEF</div>
        <div id="insights-brief-body" style="font-size:12px;color:#94a3b8;font-family:'Rajdhani',sans-serif;">Press Refresh...</div>
      </div>

      <div id="insights-digest" style="background:#0d1f35;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#fb923c;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;margin-bottom:8px;">📋 WATCHLIST DIGEST</div>
        <div id="insights-digest-body" style="font-size:12px;color:#94a3b8;font-family:'Rajdhani',sans-serif;">Press Refresh...</div>
      </div>

      <div id="insights-sentiment" style="background:#0d1f35;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#a78bfa;font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;margin-bottom:8px;">🎯 SENTIMENT SCANNER</div>
        <div id="insights-sentiment-body" style="font-size:12px;color:#94a3b8;font-family:'Rajdhani',sans-serif;">Press Refresh...</div>
      </div>

      <div id="insights-timestamp" style="font-size:9px;color:#4b6280;text-align:center;padding-bottom:8px;font-family:'Rajdhani',sans-serif;"></div>

    </div></div>`;

  _tabLoadBrief();
  _niviSubTab('chat');
  if (AppState._tabChatHistory.length === 0) {
    try {
      const saved = JSON.parse(localStorage.getItem('niviTabChat'));
      if (saved && saved.length > 0) AppState._tabChatHistory = saved;
    } catch(e) {}
  }
  _loadAIInsights(false);
  _tabRenderChat();
}

// ======================================
// NIVI SUB-TAB SWITCHER
// ======================================
function _niviSubTab(tab) {
  const isChat = tab === 'chat';
  const chatSection = document.getElementById('nivi-section-chat');
  const newsSection = document.getElementById('nivi-section-news');
  if (chatSection) chatSection.style.display = isChat ? 'flex' : 'none';
  if (newsSection) newsSection.style.display = isChat ? 'none' : 'flex';
  
  const active   = 'flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;border:1px solid #065f46;background:#065f46;color:#34d399;';
  const inactive = 'flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Rajdhani,sans-serif;border:1px solid #1e3a5f;background:transparent;color:#4b6280;';
  
  const chatBtn = document.getElementById('nivi-subtab-chat');
  const newsBtn = document.getElementById('nivi-subtab-news');
  if (chatBtn) chatBtn.style.cssText = isChat ? active : inactive;
  if (newsBtn) newsBtn.style.cssText = isChat ? inactive : active;
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
  if (briefBody) briefBody.innerHTML = `<div style="font-size:12px;color:#e2e8f0;line-height:1.9;font-family:'Noto Sans Devanagari','Mangal',sans-serif;">${html}</div>`;
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
  if (inp)     inp.placeholder = 'Ask anything to Nivi in Hindi, Gujarati, English 🙂';
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

async function _tabAsk(question) {
  AppState._tabChatHistory.push({ role:'user', text:question, ts:Date.now() });
  _tabRenderChat();

  const liveDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  _tabShowLoading(true);

  const hasGujarati = /[\u0A80-\u0AFF]/.test(question);
  const langInstruction = hasGujarati
    ? "User has asked in Gujarati. Reply in Gujarati with English technical terms."
    : "Reply in Hindi or English based on user query.";

  // ✅ FIX 2: Watchlist context inject karo
  const wlContext = AppState.wl.slice(0, 12).map(s => {
    const d = AppState.cache[s]?.data;
    if (!d || !d.regularMarketPrice) return null;
    const price = d.regularMarketPrice;
    const prev  = d.chartPreviousClose || price;
    const pct   = prev ? (((price - prev) / prev) * 100).toFixed(2) : '0.00';
    const sign  = pct >= 0 ? '+' : '';
    return `${s}: ₹${price.toFixed(2)} (${sign}${pct}%)`;
  }).filter(Boolean).join(', ');

  const intent = detectIntent(question, false);
  const modularPrompt = buildModularPrompt(question, intent);

  const systemPrompt = `[SYSTEM: ELITE FINANCIAL ANALYST — NIVI]
Mode: ${intent.toUpperCase()}
Today: ${liveDate}
User Watchlist: ${wlContext || 'No live data available'}
LANGUAGE: ${langInstruction}

${modularPrompt}
`;

  // ✅ FIX 1: Multi-turn — full history Gemini ne pass karo
  const geminiHistory = AppState._tabChatHistory.slice(0, -1).slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  let answer = null;
  const keys = getGeminiKeys();

  if (keys.length > 0) {
    const r = await directGeminiCallMultiTurn(
      [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'Understood. I am Nivi, your elite financial analyst. Ready to help.' }] }, ...geminiHistory],
      question
    );
    if (r && r.ok) answer = r.answer;
  }

  if (!answer) {
    try {
      const fallbackPrompt = `${systemPrompt}\nUser Query: "${question}"`;
      const gasUrl = getActiveGASUrl();
      const r = await fetch(`${gasUrl}?type=askMarket&prompt=${encodeURIComponent(fallbackPrompt)}`);
      const data = await r.json();
      answer = data.answer || data.text || null;
    } catch(e) { console.error("Nivi bypass failed"); }
  }

  _tabShowLoading(false);

  const fallback = "⚠️ Nivi Universal Brain is currently unresponsive. Please check your Gemini API keys.";
  AppState._tabChatHistory.push({ role:'nivi', text: answer || fallback, ts:Date.now() });

  localStorage.setItem('niviTabChat', JSON.stringify(AppState._tabChatHistory.slice(-30)));
  _tabRenderChat();
}

// ======================================
// FILE READING — _tabAskWithFile
// ======================================
async function _tabAskWithFile(question, file) {
  const fileName = file.name;
  const displayMsg = `📎 ${fileName}\n${question}`;
  AppState._tabChatHistory.push({ role: 'user', text: displayMsg, ts: Date.now() });
  _tabRenderChat();
  _tabShowLoading(true);

  let answer = null;

  try {
    const base64   = await readFileAsBase64(file);
    const mimeType = getFileMimeType(fileName);
    const liveDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const intent = detectIntent(question, true);
    const modularPrompt = buildModularPrompt(question, intent);

    const prompt = `[SYSTEM: NIVI FILE ANALYZER]
Mode: FILE
Today: ${liveDate}
File: ${fileName}
Task: User e file upload kari che. File ni content read karo ane user na question no jawab apo.
Reply in Gujarati/Hindi/English mix. Be concise and helpful.

${modularPrompt}
`;

    const r = await directGeminiCallWithFile(prompt, base64, mimeType);
    if (r && r.ok) answer = r.answer;
  } catch (e) {
    console.error('File read error:', e.message);
    answer = `⚠️ File read failed: ${e.message}`;
  }

  _tabShowLoading(false);
  AppState._tabChatHistory.push({ role: 'nivi', text: answer || '⚠️ File read failed. Gemini API key check karo.', ts: Date.now() });
  localStorage.setItem('niviTabChat', JSON.stringify(AppState._tabChatHistory.slice(-30)));
  _tabRenderChat();
}

// ======================================
// FORMAT NIVI RESPONSE — Beautify AI output
// Handles: **bold**, bullet points, numbered lists, newlines
// ======================================
function _formatNiviResponse(text) {
  if (!text) return '';
  return text
    // **bold** → styled heading
    .replace(/\*\*(.+?)\*\*/g, '<div style="font-size:11px;font-weight:700;color:#34d399;letter-spacing:0.4px;margin-top:10px;margin-bottom:3px;">$1</div>')
    // Numbered list: "1. " or "1) "
    .replace(/^(\d+)[.)]\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin-bottom:5px;"><span style="color:#38bdf8;font-weight:700;font-size:11px;flex-shrink:0;">$1.</span><span style="font-size:12px;color:#e2e8f0;line-height:1.6;">$2</span></div>')
    // Bullet: "- " or "* " or "• "
    .replace(/^[•\-\*]\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin-bottom:5px;"><span style="color:#34d399;flex-shrink:0;font-size:10px;margin-top:3px;">●</span><span style="font-size:12px;color:#e2e8f0;line-height:1.6;">$1</span></div>')
    // Blank line → spacing
    .replace(/\n\n/g, '<div style="margin-top:6px;"></div>')
    // Single newline → line break
    .replace(/\n/g, '<br>');
}

function _tabRenderChat() {
  const area = document.getElementById('tab-chat-area');
  if (!area) return;

  if (AppState._tabChatHistory.length === 0) {
area.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px 10px;text-align:center;">
        <svg viewBox="0 0 28 28" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="13" fill="#1e1b4b" stroke="#7c3aed" stroke-width="1.2"/>
          <circle cx="14" cy="14" r="11" fill="none" stroke="#4c1d95" stroke-width="0.6" opacity="0.5"/>
          <rect x="6.5" y="7.5" width="3.5" height="13" rx="1" fill="#a78bfa"/>
          <rect x="18" y="7.5" width="3.5" height="13" rx="1" fill="#a78bfa"/>
          <polygon points="10,7.5 13,7.5 22,20.5 19,20.5" fill="#c4b5fd"/>
          <line x1="14" y1="2" x2="14" y2="4.5" stroke="#c4b5fd" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        <div style="font-size:18px;font-weight:800;color:#c084fc;font-family:'Rajdhani',sans-serif;letter-spacing:2px;">NIVI</div>
        <div style="font-size:11px;color:#4b6280;">Stock analysis · Portfolio review</div>
      </div>`;
    return;
  }

  area.innerHTML = AppState._tabChatHistory.map(msg => {
    if (msg.role === 'user') {
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
        <div style="background:#1e3a5f;color:#e2e8f0;border-radius:14px 14px 2px 14px;padding:9px 13px;max-width:82%;font-size:13px;">${escapeHtml(msg.text)}</div>
      </div>`;
    } else {
      const formatted = _formatNiviResponse(msg.text);
      return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">
        <div style="width:24px;height:24px;border-radius:50%;border:1.5px solid #34d399;background:#0a1628;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg viewBox="0 0 28 28" width="12" height="12" fill="#34d399"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z"/></svg>
        </div>
        <div style="background:linear-gradient(135deg,#0a2218,#0f2a1a);border:1px solid rgba(52,211,153,0.2);color:#e2e8f0;border-radius:2px 14px 14px 14px;padding:10px 12px;max-width:85%;font-size:12px;line-height:1.7;font-family:'Noto Sans Devanagari','Rajdhani',sans-serif;">${formatted}</div>
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
    el.style.padding = '10px';
    el.innerHTML = '<span style="color:#34d399;font-size:12px;">Nivi is thinking...</span>';
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
    if (!text) return '<span style="color:#4b6280;font-size:11px;">No data.</span>';
    return text.split('\n').filter(l => l.trim()).map(l =>
      `<div style="margin-bottom:6px;font-size:12px;color:#e2e8f0;">${l.replace(/^[•\-\*]\s*/, '• ')}</div>`
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

  const systemPrompt = `[SYSTEM: ELITE FINANCIAL ANALYST — NIVI]
Today: ${liveDate}
Stock Context: ${stockCtx}
Task: Answer about ${sym}. Be concise and actionable. Mix Gujarati/Hindi/English.`;

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
        return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;"><div style="background:#1e3a5f;color:#e2e8f0;border-radius:14px 14px 2px 14px;padding:9px 13px;max-width:82%;font-size:13px;">${escapeHtml(msg.text)}</div></div>`;
      } else {
        const formatted = _formatNiviResponse(msg.text);
        return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;"><div style="width:24px;height:24px;border-radius:50%;border:1.5px solid #34d399;background:#0a1628;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 28 28" width="12" height="12" fill="#34d399"><path d="M14 2C14 2 15.2 10 22 14C15.2 18 14 26 14 26C14 26 12.8 18 6 14C12.8 10 14 2 14 2Z"/></svg></div><div style="background:linear-gradient(135deg,#0a2218,#0f2a1a);border:1px solid rgba(52,211,153,0.2);color:#e2e8f0;border-radius:2px 14px 14px 14px;padding:10px 12px;max-width:85%;font-size:12px;line-height:1.7;font-family:'Noto Sans Devanagari','Rajdhani',sans-serif;">${formatted}</div></div>`;
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

// AppState init — pendingFile
if (!AppState._pendingFile) AppState._pendingFile = null;

console.log('✅ nivi.js loaded | File Upload: ON | Fallback: Groq → OpenRouter');
