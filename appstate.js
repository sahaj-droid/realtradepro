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
  CACHE_TIME: 60000,
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
