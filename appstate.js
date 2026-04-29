// ========================================
// APP STATE — Single source of truth
// ========================================

const AppState = {

  // -- User --
  currentUser: null,
  currentPINEntry: '',

  // -- Watchlist & Cache --
  wl: ["SBIN","RELIANCE","TCS"],
  cache: {},
  lastUpdatedMap: {},
  CACHE_TIME: 300000,
  watchlists: [{name:"Watchlist 1",stocks:[]},{name:"Watchlist 2",stocks:[]},{name:"Watchlist 3",stocks:[]}],
  currentWL: 0,
  
  // -- Holdings & History --
  h: [],
  hist: [],
  histView: 'list',

  // -- Alerts --
  alerts: [],
  currentAlertSym: '',
  _alertDir: 'above',
  _dangerPendingType: null,

  // -- Trade --
  currentTrade: {},
  currentTradeType: 'CNC',

  // -- UI / Sort --
  isDark: true,
  azAsc: true,
  priceAsc: false,
  percentAsc: false,
  groups: {},
  currentGroup: 'ALL',
  _wlModalMode: 'add',
  _wlModalIdx: -1,
  errorShownThisSession: false,
  dupWarnEnabled: true,
  refreshInterval: null,

  // -- Search --
  _searchTimer: null,
  _lastSearchVal: '',

  // -- Targets --
  targets: {},

  // -- Indices --
indicesList: [
  { sym: '^NSEI', name: 'NIFTY 50' },
  { sym: '^BSESN', name: 'SENSEX' },
  { sym: 'NIFTY1!', name: 'GIFT NIFTY' },
  { sym: '^NSEBANK', name: 'BANK NIFTY' },
],

  // -- Movers --
  _moversTab: 'gainers',

  // -- Gift Nifty --
  _giftNiftyCache: null,
  _giftNiftyCacheTime: 0,

  // -- Calendar --
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelDay: null,

  // -- Settings --
  _settingsPINUnlocked: false,

  // -- BB Chart --
  _bbSym: '',
  _bbPeriod: '6M',
  _bbRange: 'daily',

  // -- Global Markets --
  _globalCache: {},
  _globalCacheTime: 0,

  // -- Tab --
  _curTab: 'watchlist',
  _txStart: 0,
  _tyStart: 0,
  _swipeLocked: false,

  // -- News --
  newsCache: null,
  newsCacheTime: 0,
  newsCacheDate: '',
  newsActiveFilter: 'ALL',
  newsActiveTab: 'all',
  _tabChatHistory: [],

  // -- Avg Calculator --
  _acSym: '',
  _acAvg: 0,
  _acQty: 0,
  _acCmp: 0,
  _acMode: 'buy',

  // -- Screener --
  screenerSource: 'watchlist',
  screenerFilters: new Set(),

  // -- Sync --
  _syncInProgress: false,
  _syncDebounceTimer: null,
  _lastSyncTime: 0,

  // -- Nivi AI --
  _niviCurrentSym: '',
  _niviChatHistory: [],
  _niviMicActive: false,
  _niviRecognition: null,
  _niviPersistTimer: null,

  // -- Firebase preload --
  _fbPreloadController: null,
  _sheetFund: null,

  // -- Learn Tab --
  _learnLang: localStorage.getItem('learnLang') || 'hi',
  _learnCache: {},
  _learnMainTab: 'financial',
  _learnActiveTab: 'fundamentals',
  _msCategory: null,
  _msTopic: null,

  // -- URL Rotation --
  _urlRotationIndex: 0,
};

// ========================================
// FONT SIZE TOGGLE
// ========================================
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

// Apply on load
applyFontSize();

// ========================================
// LOCAL STORAGE LOAD (Initial)
// ========================================
try{AppState.wl=JSON.parse(localStorage.getItem("wl"))||AppState.wl;}catch(e){}
try{AppState.h=JSON.parse(localStorage.getItem("h"))||[];}catch(e){}
try{AppState.hist=JSON.parse(localStorage.getItem("hist"))||[];}catch(e){}
try{AppState.alerts=JSON.parse(localStorage.getItem("alerts"))||[];}catch(e){}
AppState.isDark=true;
try{AppState.groups=JSON.parse(localStorage.getItem("groups"))||{};}catch(e){}
try{ AppState.dupWarnEnabled = localStorage.getItem("dupWarn") !== "false"; }catch(e){}
try{ AppState.targets=JSON.parse(localStorage.getItem("targets"))||{}; }catch(e){}

// MULTI-WATCHLIST: load from localStorage
(function(){
  try{
    const saved=JSON.parse(localStorage.getItem("watchlists"));
    if(saved&&Array.isArray(saved)&&saved.length>0){
      AppState.watchlists=saved;
    } else {
      AppState.watchlists=[
        {name:"Watchlist 1",stocks:[...AppState.wl]},
        {name:"Watchlist 2",stocks:[]},
        {name:"Watchlist 3",stocks:[]}
      ];
      saveWatchlists();
    }
  }catch(e){
    AppState.watchlists=[{name:"Watchlist 1",stocks:[...AppState.wl]},{name:"Watchlist 2",stocks:[]},{name:"Watchlist 3",stocks:[]}];
  }
  try{AppState.currentWL=parseInt(localStorage.getItem("currentWL"))||0;}catch(e){}
  if(AppState.currentWL>=AppState.watchlists.length) AppState.currentWL=0;
  AppState.wl=AppState.watchlists[AppState.currentWL].stocks;
})();

// ========================================
// CONSTANT DATA
// ========================================
const INDICES_DEFAULT=[{name:"NIFTY 50",sym:"^NSEI"},{name:"SENSEX",sym:"^BSESN"},{name:"GIFT NIFTY",sym:"__GIFT__"},{name:"BANK NIFTY",sym:"^NSEBANK"}];
const INDICES_VERSION="v2";

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

// ========================================
// INFO TOOLTIP DATA
// ========================================
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

// ========================================
// INDEX COMPOSITION DATA
// ========================================
const INDEX_COMPOSITION={
  '^NSEI':[{name:'Reliance',wt:'8.1%'},{name:'HDFC Bank',wt:'7.4%'},{name:'ICICI Bank',wt:'6.2%'},{name:'Infosys',wt:'5.1%'},{name:'TCS',wt:'4.3%'}],
  '^BSESN':[{name:'Reliance',wt:'9.2%'},{name:'HDFC Bank',wt:'8.8%'},{name:'ICICI Bank',wt:'7.0%'},{name:'Infosys',wt:'6.3%'},{name:'TCS',wt:'5.1%'}],
  '^NSEBANK':[{name:'HDFC Bank',wt:'28.4%'},{name:'ICICI Bank',wt:'22.1%'},{name:'Kotak Bank',wt:'12.3%'},{name:'Axis Bank',wt:'10.2%'},{name:'SBI',wt:'8.9%'}],
  '^CNXIT':[{name:'Infosys',wt:'29.1%'},{name:'TCS',wt:'26.4%'},{name:'HCL Tech',wt:'13.2%'},{name:'Wipro',wt:'7.8%'},{name:'Tech M',wt:'5.3%'}],
};

// ========================================
// MARKET SCHOOL DATA
// ========================================
const MARKET_SCHOOL = {
  technical: {
    icon: '⚡', color: '#38bdf8',
    label: { hi: 'Technical Analysis', gu: 'Technical Analysis', en: 'Technical Analysis' },
    topics: {
      rsi: {
        label: 'RSI (Relative Strength Index)',
        hi: { what: 'RSI एक momentum indicator है जो 0–100 के बीच होता है। यह बताता है कि stock overbought है या oversold।', formula: 'RSI = 100 − [100 ÷ (1 + RS)] जहाँ RS = Average Gain ÷ Average Loss (14 दिन)', levels: '< 30 = Oversold (खरीदने का मौका) | 30–70 = Normal | > 70 = Overbought (बेचने का मौका)', tip: '💡 जब RSI 30 से नीचे हो और कोई strong fundamental stock हो, तो यह एक अच्छा entry point हो सकता है।', example: 'RELIANCE का RSI 28 है — इसका मतलब stock oversold zone में है, reversal आ सकता है।' },
        gu: { what: 'RSI એ 0–100 ની વચ્ચે રહેતો momentum indicator છે. Stock overbought છે કે oversold — આ બતાવે.', formula: 'RSI = 100 − [100 ÷ (1 + RS)] જ્યાં RS = Avg Gain ÷ Avg Loss (14 દિવસ)', levels: '< 30 = Oversold (ખરીદીની તક) | 30–70 = Normal | > 70 = Overbought (સાવધ)', tip: '💡 RSI 30 ની નીચે હોય ને stock fundamentally strong હોય, તો entry લઈ શકાય.', example: 'RELIANCE નો RSI 28 છે — Stock oversold zone મા છે, reversal શક્ય છે.' },
        en: { what: 'RSI is a momentum indicator ranging 0–100. It tells if a stock is overbought or oversold.', formula: 'RSI = 100 − [100 ÷ (1 + RS)] where RS = Avg Gain ÷ Avg Loss (14 days)', levels: '< 30 = Oversold (buying opportunity) | 30–70 = Normal | > 70 = Overbought (caution)', tip: '💡 When RSI < 30 and stock has strong fundamentals, it can be a great entry point.', example: 'RELIANCE RSI is 28 — stock is in oversold zone, reversal likely.' }
      },
      macd: {
        label: 'MACD',
        hi: { what: 'MACD (Moving Average Convergence Divergence) दो EMAs का फर्क है। Trend और momentum दोनों दिखाता है।', formula: 'MACD Line = EMA(12) − EMA(26) | Signal Line = EMA(9) of MACD', levels: 'MACD > Signal = Bullish | MACD < Signal = Bearish | Histogram = दोनों का फर्क', tip: '💡 जब MACD Line, Signal Line को ऊपर से cross करे — यह Bullish Crossover है। खरीदने का संकेत।', example: 'MACD: 2.5, Signal: 1.8 → MACD > Signal → Bullish trend' },
        gu: { what: 'MACD બે EMAs નો ફરક છે. Trend અને momentum બંને બતાવે છે.', formula: 'MACD Line = EMA(12) − EMA(26) | Signal Line = EMA(9) of MACD', levels: 'MACD > Signal = Bullish | MACD < Signal = Bearish', tip: '💡 MACD Line, Signal Line ને ઉપરથી cross કરે — Bullish Crossover — ખરીદીનો સંકેત.', example: 'MACD: 2.5, Signal: 1.8 → MACD > Signal → Bullish trend' },
        en: { what: 'MACD is the difference between two EMAs. Shows both trend and momentum.', formula: 'MACD Line = EMA(12) − EMA(26) | Signal Line = EMA(9) of MACD', levels: 'MACD > Signal = Bullish | MACD < Signal = Bearish | Histogram = difference', tip: '💡 When MACD crosses above Signal Line — Bullish Crossover — buy signal.', example: 'MACD: 2.5, Signal: 1.8 → MACD > Signal → Bullish trend' }
      },
      ma: {
        label: 'MA / DMA (Moving Average)',
        hi: { what: 'Moving Average (MA) एक निश्चित दिनों के closing prices का औसत है। Trend की दिशा समझने के लिए।', formula: 'MA20 = Last 20 days close का average | MA50 = Last 50 days | MA200 = Last 200 days', levels: 'Price > MA200 = Long-term Bullish | Price < MA200 = Bearish | Golden Cross (MA50>MA200) = Strong Bull', tip: '💡 MA20 short-term trend, MA50 medium-term, MA200 long-term trend बताता है। Price अगर तीनों से ऊपर हो — very bullish।', example: 'Price: ₹500, MA20: ₹480, MA50: ₹460 → Price above all MAs → Bullish' },
        gu: { what: 'Moving Average (MA) ચોક્કસ દિવસોના closing prices નો સરેરાશ છે. Trend ની દિશા સમજવા.', formula: 'MA20 = છેલ્લા 20 દિવસ | MA50 = 50 દિવસ | MA200 = 200 દિવસ', levels: 'Price > MA200 = Long-term Bullish | Golden Cross (MA50>MA200) = Strong Bull', tip: '💡 MA20 short-term, MA50 medium-term, MA200 long-term trend. Price ત્રણેથી ઉપર = very bullish.', example: 'Price: ₹500, MA20: ₹480 → Price above MA → Bullish' },
        en: { what: 'Moving Average (MA) is the average of closing prices over N days. Used to identify trend direction.', formula: 'MA20 = Last 20 days avg | MA50 = 50 days | MA200 = 200 days', levels: 'Price > MA200 = Long-term Bullish | Golden Cross (MA50>MA200) = Strong Bull', tip: '💡 MA20=short-term, MA50=medium, MA200=long-term. Price above all three = very bullish.', example: 'Price: ₹500, MA20: ₹480 → Price above MA → Bullish' }
      },
      bollinger: {
        label: 'Bollinger Bands (BB)',
        hi: { what: 'Bollinger Bands 3 lines हैं — Middle (MA20), Upper Band, Lower Band। Volatility measure करने के लिए।', formula: 'Middle = MA20 | Upper = MA20 + 2×SD | Lower = MA20 − 2×SD', levels: 'Price touches Upper Band = Overbought | Price touches Lower Band = Oversold | Bands squeeze = Big move आने वाला', tip: '💡 जब Bands बहुत narrow हों (squeeze) — बड़ा move आने वाला है। Direction MACD/RSI से confirm करो।', example: 'Price Lower Band को touch कर रहा है + RSI < 30 → Strong buy signal' },
        gu: { what: 'Bollinger Bands 3 lines છે — Middle (MA20), Upper, Lower. Volatility measure કરવા.', formula: 'Middle = MA20 | Upper = MA20 + 2×SD | Lower = MA20 − 2×SD', levels: 'Upper touch = Overbought | Lower touch = Oversold | Squeeze = મોટો move આવવાનો', tip: '💡 Bands ખૂબ narrow (squeeze) — મોટો move આવવાનો. Direction MACD/RSI થી confirm કરો.', example: 'Price Lower Band touch + RSI < 30 → Strong buy signal' },
        en: { what: 'Bollinger Bands are 3 lines — Middle (MA20), Upper Band, Lower Band. Used to measure volatility.', formula: 'Middle = MA20 | Upper = MA20 + 2×SD | Lower = MA20 − 2×SD', levels: 'Upper touch = Overbought | Lower touch = Oversold | Squeeze = Big move incoming', tip: '💡 When Bands squeeze (narrow) — a big move is coming. Confirm direction with MACD/RSI.', example: 'Price touches Lower Band + RSI < 30 → Strong buy signal' }
      },
      volume: {
        label: 'Volume',
        hi: { what: 'Volume = एक दिन में कितने shares खरीदे-बेचे गए। Price move की ताकत बताता है।', formula: 'Volume Ratio = Today Volume ÷ Average Volume (30 days)', levels: 'Volume > 2x avg + Price Up = Strong Bullish | Volume high + Price Down = Strong Selling | Low volume move = weak signal', tip: '💡 बिना volume के price move पर भरोसा मत करो। High volume = conviction।', example: 'Avg volume: 1L shares, Today: 3L shares + Price +3% → Strong Bullish breakout' },
        gu: { what: 'Volume = એક દિવસમાં કેટલા shares ખરીદ-વેચ થયા. Price move ની તાકાત બતાવે.', formula: 'Volume Ratio = Today Volume ÷ Average Volume (30 days)', levels: 'Volume > 2x avg + Price Up = Strong Bullish | Volume high + Price Down = Strong Selling', tip: '💡 Volume વગર price move પર ભરોસો ન કરો. High volume = conviction.', example: 'Avg volume: 1L, Today: 3L + Price +3% → Strong Bullish breakout' },
        en: { what: 'Volume = number of shares traded in a day. Shows the strength behind a price move.', formula: 'Volume Ratio = Today Volume ÷ Average Volume (30 days)', levels: 'Volume > 2x avg + Price Up = Strong Bullish | High volume + Price Down = Strong Selling', tip: '💡 Never trust a price move without volume. High volume = conviction.', example: 'Avg vol: 1L, Today: 3L + Price +3% → Strong Bullish breakout' }
      }
    }
  },
  fundamental: {
    icon: '📊', color: '#fb923c',
    label: { hi: 'Fundamental Analysis', gu: 'Fundamental Analysis', en: 'Fundamental Analysis' },
    topics: {
      pe: {
        label: 'P/E Ratio',
        hi: { what: 'P/E Ratio बताता है कि ₹1 कमाने के लिए आप कितने रुपये दे रहे हैं।', formula: 'P/E = Share Price ÷ EPS (Earnings Per Share)', levels: '< 15 = Cheap | 15–30 = Fair | > 30 = Expensive (लेकिन growth stocks के लिए high P/E normal)', tip: '💡 अकेले P/E से निर्णय मत लो। Industry average से compare करो।', example: 'Price ₹300, EPS ₹15 → P/E = 20 → Fair valuation' },
        gu: { what: 'P/E Ratio બતાવે છે ₹1 કમાવા માટે કેટલા રૂપિયા ચૂકવો છો.', formula: 'P/E = Share Price ÷ EPS', levels: '< 15 = સસ્તો | 15–30 = ઠીક | > 30 = મોંઘો', tip: '💡 P/E એકલું ન જુઓ. Industry average સાથે compare કરો.', example: 'Price ₹300, EPS ₹15 → P/E = 20 → Fair valuation' },
        en: { what: 'P/E Ratio tells how much you pay for ₹1 of earnings.', formula: 'P/E = Share Price ÷ EPS', levels: '< 15 = Cheap | 15–30 = Fair | > 30 = Expensive', tip: '💡 Never use P/E alone. Compare with industry average.', example: 'Price ₹300, EPS ₹15 → P/E = 20 → Fair valuation' }
      },
      eps: {
        label: 'EPS (Earnings Per Share)',
        hi: { what: 'EPS = प्रत्येक Share पर कंपनी ने कितना मुनाफा कमाया। जितना बढ़ता EPS, उतनी healthy company।', formula: 'EPS = Net Profit ÷ Total Shares Outstanding', levels: '> 0 = Profitable | बढ़ता EPS = Healthy growth | गिरता EPS = Warning sign', tip: '💡 पिछले 5 साल का EPS growth देखो। Consistent growth = quality company।', example: 'Net Profit: ₹1000 Cr, Shares: 100 Cr → EPS = ₹10' },
        gu: { what: 'EPS = દરેક Share પર કેટલો નફો. વધતો EPS = healthy company.', formula: 'EPS = Net Profit ÷ Total Shares', levels: '> 0 = Profitable | વધતો = Healthy | ઘટતો = Warning', tip: '💡 છેલ્લા 5 વર્ષનો EPS growth જુઓ. Consistent growth = quality.', example: 'Net Profit ₹1000 Cr, Shares 100 Cr → EPS = ₹10' },
        en: { what: 'EPS = profit earned per share. Growing EPS = healthy company.', formula: 'EPS = Net Profit ÷ Total Shares Outstanding', levels: '> 0 = Profitable | Growing = Healthy | Declining = Warning', tip: '💡 Check 5-year EPS growth trend. Consistent growth = quality company.', example: 'Net Profit ₹1000 Cr, Shares 100 Cr → EPS = ₹10' }
      },
      roe: {
        label: 'ROE (Return on Equity)',
        hi: { what: 'ROE = कंपनी अपने shareholders के पैसे पर कितना return दे रही है।', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', levels: '≥ 15% = Good | 8–15% = Average | < 8% = Weak', tip: '💡 ROE > 15% वाली companies Warren Buffett को पसंद हैं।', example: 'Net Profit ₹500 Cr, Equity ₹2500 Cr → ROE = 20% → Excellent' },
        gu: { what: 'ROE = Shareholders ના પૈસા પર company કેટલો return આપે છે.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', levels: '≥ 15% = સારું | 8–15% = Average | < 8% = નબળું', tip: '💡 ROE > 15% ની companies Warren Buffett ને ગમે છે.', example: 'Net Profit ₹500 Cr, Equity ₹2500 Cr → ROE = 20% → Excellent' },
        en: { what: 'ROE = how much return the company generates on shareholders\' money.', formula: 'ROE = (Net Profit ÷ Total Equity) × 100', levels: '≥ 15% = Good | 8–15% = Fair | < 8% = Weak', tip: '💡 Warren Buffett loves companies with ROE > 15%.', example: 'Net Profit ₹500 Cr, Equity ₹2500 Cr → ROE = 20% → Excellent' }
      }
    }
  },
  candles: {
    icon: '🕯️', color: '#a78bfa',
    label: { hi: 'Candlestick Patterns', gu: 'Candlestick Patterns', en: 'Candlestick Patterns' },
    topics: {
      basics: {
        label: 'Candlestick Basics',
        hi: { what: 'Candlestick chart ek din का OHLC (Open, High, Low, Close) data show करता है। Body + Wick।', formula: 'Green/White candle = Close > Open (Bullish) | Red/Black candle = Close < Open (Bearish)', levels: 'Long body = Strong move | Short body = Indecision | Long wick = Rejection of price level', tip: '💡 हर candle एक कहानी बताती है — Open कहाँ था, High-Low range क्या था, Close कहाँ था।', example: 'Open ₹100, High ₹110, Low ₹95, Close ₹108 → Green candle, bullish day' },
        gu: { what: 'Candlestick chart એક દિવસ ની OHLC data show કરે. Body + Wick.', formula: 'Green candle = Close > Open (Bullish) | Red candle = Close < Open (Bearish)', levels: 'Long body = Strong move | Short body = Indecision | Long wick = Price rejection', tip: '💡 દરેક candle એક story છે — Open, High, Low, Close ની.', example: 'Open ₹100, High ₹110, Low ₹95, Close ₹108 → Green candle' },
        en: { what: 'Candlestick shows OHLC (Open, High, Low, Close) for one day. Has Body + Wick.', formula: 'Green candle = Close > Open (Bullish) | Red candle = Close < Open (Bearish)', levels: 'Long body = Strong move | Short body = Indecision | Long wick = Price rejection', tip: '💡 Every candle tells a story — where price opened, went, and closed.', example: 'Open ₹100, High ₹110, Low ₹95, Close ₹108 → Green bullish candle' }
      },
      doji: {
        label: 'Doji',
        hi: { what: 'Doji तब बनता है जब Open और Close लगभग बराबर हों। Indecision — buyers और sellers बराबर ताकत में।', formula: 'Open ≈ Close | Long upper + lower wicks', levels: 'Uptrend में Doji = Reversal का signal | Downtrend में Doji = Possible reversal up', tip: '💡 Doji को अकेले मत देखो — अगले candle की confirmation का इंतज़ार करो।', example: 'Stock लगातार बढ़ रहा था, फिर Doji बना → अगला दिन Red candle → Trend reversal' },
        gu: { what: 'Doji ત્યારે બને જ્યારે Open ≈ Close. Indecision — buyers-sellers સરખી ताकत.', formula: 'Open ≈ Close | Long upper + lower wicks', levels: 'Uptrend mā Doji = Reversal signal | Downtrend mā Doji = Possible bounce', tip: '💡 Doji ની confirmation next candle thī levo.', example: 'Stock વધી રહ્યો, Doji બન્યો → next day Red → Trend reversal' },
        en: { what: 'Doji forms when Open ≈ Close. Shows indecision between buyers and sellers.', formula: 'Open ≈ Close | Long upper + lower wicks', levels: 'Doji in Uptrend = Reversal signal | Doji in Downtrend = Possible bounce', tip: '💡 Never trade Doji alone — wait for next candle confirmation.', example: 'Stock was rising, Doji formed → next day Red candle → Trend reversal' }
      }
    }
  }
};

// ========================================
// LEARN INFO DATA
// ========================================
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
