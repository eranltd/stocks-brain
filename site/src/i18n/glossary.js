// The shared financial glossary: one Hebrew word for each English term, used by every area dictionary so the same thing
// is always called the same. `he` is the term as it appears in running text, `pl` its plural where one is used, and
// `note` a short hint for translators (English). Plain modern Hebrew a non-finance reader understands; tickers, company
// and fund names stay in Latin letters. Never phrase a term as advice: no "מומלץ לקנות", "כדאי לקנות" or "המלצה".
// i18n.test.js checks that every entry is filled in and that the required terms are here.

export const GLOSSARY = [
  // things you can own
  { en: "stock", he: "מניה", pl: "מניות", note: "A share in one company. Feminine: מניה עלתה." },
  { en: "company", he: "חברה", pl: "חברות", note: "The business behind a stock." },
  { en: "fund", he: "קרן", pl: "קרנות", note: "An exchange-traded fund (קרן סל) unless the text says otherwise." },
  { en: "index fund", he: "קרן מחקה", pl: "קרנות מחקות", note: "A fund that copies an index. Long form: קרן מחקת מדד." },
  { en: "whole-market fund", he: "קרן על כל השוק", note: "The fund that holds the whole market; the site's yardstick." },
  { en: "S&P 500", he: "מדד S&P 500", note: "Keep the name in Latin letters inside the Hebrew word מדד." },
  { en: "Nasdaq-100", he: "מדד Nasdaq-100", note: "Keep the name in Latin letters." },
  { en: "index", he: "מדד", pl: "מדדים", note: "A list of stocks whose average is tracked." },
  { en: "sector", he: "ענף", pl: "ענפים", note: "Technology, health care… Prefer ענף over סקטור." },
  { en: "benchmark", he: "מדד ייחוס", note: "What results are compared against. With the article: מדד הייחוס." },
  { en: "market", he: "שוק", note: "The stock market. The day's market: המסחר היום." },
  { en: "watchlist", he: "רשימת המעקב", note: "The list of stocks the site follows." },
  { en: "portfolio", he: "תיק השקעות", note: "Short form in running text: התיק." },

  // reading a chart
  { en: "candle", he: "נר", pl: "נרות", note: "One day (or week) on a candles chart: גרף נרות." },
  { en: "up day", he: "יום עלייה", pl: "ימי עלייה", note: "A day that closed higher." },
  { en: "down day", he: "יום ירידה", pl: "ימי ירידה", note: "A day that closed lower." },
  { en: "close", he: "סגירה", note: "The last price of the trading day: מחיר הסגירה." },
  { en: "trend", he: "מגמה", pl: "מגמות", note: "The general direction over weeks." },
  { en: "uptrend", he: "מגמת עלייה", note: "Opposite: מגמת ירידה." },
  { en: "downtrend", he: "מגמת ירידה", note: "Opposite: מגמת עלייה." },
  { en: "20-day average", he: "ממוצע 20 הימים", note: "The average close of the last 20 trading days (a moving average)." },
  { en: "50-day average", he: "ממוצע 50 הימים", note: "Called 'the usual level lately' in plain text: הרמה הרגילה לאחרונה." },
  { en: "200-day average", he: "ממוצע 200 הימים", note: "The long-run average." },
  { en: "support", he: "רמת תמיכה", note: "A level where falls stopped before. Short: תמיכה." },
  { en: "resistance", he: "רמת התנגדות", note: "A level where rises stopped before. Short: התנגדות." },
  { en: "gap", he: "פער", pl: "פערים", note: "A jump between one close and the next open: פער מחיר." },
  { en: "volume", he: "מחזור מסחר", note: "How many shares changed hands." },
  { en: "RSI", he: "מדד RSI", note: "A 0 to 100 gauge of how fast the price moved. Keep RSI in Latin letters." },
  { en: "stretched", he: "מתוחה", note: "Far above its usual level. Feminine for a stock (מניה מתוחה); not 'קנויה יתר'." },
  { en: "unusual move", he: "תנועה חריגה", pl: "תנועות חריגות", note: "A day move much bigger than the stock's usual." },
  { en: "why it moved", he: "למה המניה זזה", note: "The site's notes that explain a move. They are never a reason to trade." },
  { en: "volatility", he: "תנודתיות", note: "How much the price swings." },
  { en: "drawdown", he: "הירידה הגדולה ביותר", note: "Also 'biggest drop': the largest fall from a high. Long: ירידה מהשיא." },
  { en: "biggest drop", he: "הירידה הגדולה ביותר", note: "Same as drawdown." },

  // the plan and its words
  { en: "the plan", he: "התוכנית", note: "The site's written plan. Never 'התוכנית שלנו'." },
  { en: "rule", he: "כלל", pl: "כללים", note: "This site's rules: כללי האתר." },
  { en: "checklist", he: "רשימת בדיקה", pl: "רשימות בדיקה", note: "The site's step-by-step check of a stock." },
  { en: "reward-to-risk", he: "יחס סיכוי-סיכון", note: "How much could be gained for each unit that could be lost." },
  { en: "stop", he: "נקודת יציאה", pl: "נקודות יציאה", note: "The level where the plan says to get out." },
  { en: "target", he: "יעד", pl: "יעדים", note: "The level the plan aims for. Never a price target from analysts." },
  { en: "paper money", he: "כסף מדומה", note: "Also 'pretend money': practice with no real money." },
  { en: "pretend money", he: "כסף מדומה", note: "Same as paper money." },
  { en: "real money", he: "כסף אמיתי", note: "Opposite of כסף מדומה." },
  { en: "weekly buy", he: "הקנייה השבועית", note: "The plan's one small buy a week. Describe it, never urge it." },
  { en: "weekly game", he: "המשחק השבועי", note: "The pretend-money weekly bet." },
  { en: "history test", he: "מבחן היסטורי", pl: "מבחנים היסטוריים", note: "Trying a rule on past prices (a backtest)." },
  { en: "random picks", he: "בחירות אקראיות", note: "Stocks picked at random, to compare a rule with luck." },
  { en: "trust ladder", he: "סולם האמון", note: "The steps a rule climbs before it may use real money." },
  { en: "track record", he: "היסטוריית התוצאות", note: "Every past guess and how it turned out." },
  { en: "verdict", he: "הכרעה", pl: "הכרעות", note: "The brain's answer for the week." },
  { en: "conviction", he: "רמת ביטחון", note: "How sure the brain is: low, medium, high (נמוכה, בינונית, גבוהה)." },
  { en: "watch", he: "במעקב", note: "Also 'watching': kept in view, no action. Verb: לעקוב." },
  { en: "lean up", he: "נטייה לעלייה", note: "A mild guess that it rises. Opposite: נטייה לירידה." },
  { en: "lean down", he: "נטייה לירידה", note: "A mild guess that it falls." },
  { en: "the brain", he: "המוח", note: "The site's daily AI analysis. Masculine: המוח כתב." },

  // the company's own news
  { en: "filing", he: "דיווח רשמי", pl: "דיווחים רשמיים", note: "A report a company files with the regulator (SEC): דיווח ל-SEC." },
  { en: "earnings", he: "דוחות", note: "Also 'results': the quarterly report. Long: הדוחות הרבעוניים." },
  { en: "results", he: "תוצאות", note: "A company's reported results; the quarter: הדוחות הרבעוניים." },
  { en: "outlook", he: "תחזית", pl: "תחזיות", note: "What the company itself said about the coming months." },
  { en: "dividend", he: "דיבידנד", pl: "דיבידנדים", note: "Cash a company pays its shareholders." },

  // money and time
  { en: "savings", he: "חיסכון", note: "Money set aside." },
  { en: "lump sum", he: "סכום חד-פעמי", note: "All the money at once, as opposed to a little each week." },
  { en: "time horizon", he: "טווח זמן", note: "How long the money can stay invested. Also: אופק השקעה." },
  { en: "percent", he: "אחוז", pl: "אחוזים", note: "Write as digits with the sign: 4.1%." },
  { en: "percentage points", he: "נקודות אחוז", note: "A gap between two percents (ahead by 3 points): ב-3 נקודות אחוז. Never just נקודות." },
  { en: "basis points", he: "נקודות בסיס", note: "Hundredths of a percent (bp). Short in table cells: נק׳ בסיס." },
  { en: "management fee", he: "דמי ניהול", note: "A fund's yearly cost: דמי ניהול שנתיים." },

  // the site's own words (added by the Hebrew editor from the translators' lists)
  { en: "guess", he: "ניחוש", pl: "ניחושים", note: "The brain's pick. Masculine: הניחוש צדק." },
  { en: "public call", he: "עמדה פומבית", pl: "עמדות פומביות", note: "What a famous investor said or did in public. Short: עמדה. Never תחזית (that is outlook) and never המלצה." },
  { en: "lesson", he: "שיעור", pl: "שיעורים", note: "A lesson taught by a book or video (the Lessons page)." },
  { en: "lesson learned", he: "לקח", pl: "לקחים", note: "A lesson the site's own scores taught (the Lessons learned page). Keep apart from שיעור." },
  { en: "principle", he: "עיקרון", pl: "עקרונות", note: "A lasting lesson from a source." },
  { en: "claim", he: "טענה", pl: "טענות", note: "A dated guess someone made in a video; it expires (פג תוקף)." },
  { en: "run", he: "ריצה", pl: "ריצות", note: "One time the brain or a job ran. The nightly run: הריצה הלילית. Not הרצה." },
  { en: "routine", he: "משימה מתוזמנת", pl: "משימות מתוזמנות", note: "A job that runs by itself on a timer; also the Routines page name." },
  { en: "data pack", he: "חבילת הנתונים", note: "The one file the brain reads each morning." },
  { en: "core fund", he: "קרן הליבה", note: "The plan's main fund that holds the whole market (an S&P 500 fund)." },
  { en: "pretend portfolio", he: "התיק המדומה", note: "The practice portfolio. Long form once per page: תיק השקעות מדומה." },
  { en: "paper record", he: "רישום בכסף מדומה", note: "Picks written down once a month and never changed. Short: הרישום המדומה." },
  { en: "side bet", he: "הימור צדדי", note: "The small stock-picking part beside the core fund." },
  { en: "the plain way", he: "הדרך הפשוטה", note: "The baseline a rule must beat." },
  { en: "honest action", he: "הצעד המפוכח", note: "What the plan really does this week (usually the weekly buy of the core fund)." },
  { en: "rebalance", he: "איזון מחדש", note: "Evening the slices out again: מאוזן מחדש." },
  { en: "bumpiness", he: "טלטלה", note: "The everyday word for volatility; in a definition put תנודתיות beside it." },
  { en: "worst dip", he: "הצלילה הגרועה", note: "How far savings fell below the money put in." },
  { en: "hit", he: "פגיעה", pl: "פגיעות", note: "A checked guess that was right by more than the band." },
  { en: "miss", he: "החטאה", pl: "החטאות", note: "A checked guess that was wrong by more than the band." },
  { en: "flat", he: "בלי שינוי", note: "A checked guess too close to call; also a day that barely moved." },
  { en: "mixed", he: "תמונה מעורבת", note: "A checklist or verdict that leans neither way." },
  { en: "bullish", he: "נטייה לעלייה", note: "A stance; same words as lean up. Bearish: נטייה לירידה. Neutral: בלי נטייה." },
  { en: "luck chance", he: "סיכוי למזל", note: "How likely a result this good is from luck alone." },
  { en: "random pickers", he: "בוחרים אקראיים", note: "Pretend players who pick stocks at random." },
  { en: "stopped out", he: "יציאה בנקודת יציאה", pl: "יציאות בנקודת יציאה", note: "A pretend sale at the stop." },
  { en: "replicated", he: "שוחזר", note: "Evidence levels: replicated שוחזר, mixed מעורב, weak חלש, untested לא נבדק, contradicted נסתר." },
  { en: "results day", he: "יום תוצאות", pl: "ימי תוצאות", note: "The day a company reports its quarter." },
  { en: "market mood", he: "מצב הרוח של השוק", note: "Background signs only, never a reason to act." },
  { en: "seat", he: "מושב", pl: "מושבים", note: "A place in the pretend portfolio." },
  { en: "ticker", he: "סימול", pl: "סימולים", note: "A stock's short code, always in Latin letters (AAA)." },
  { en: "regulator", he: "רשות הפיקוח", note: "For US companies: רשות הפיקוח (SEC). The Israeli securities regulator is רשות ניירות ערך." },
  { en: "sample", he: "לדוגמה", note: "Made-up data: נתונים לדוגמה, מחירים לדוגמה." },
  { en: "live", he: "נתונים אמיתיים", note: "Real data that updates after each close (not real-time). Prices: מחירים מתעדכנים." },
  { en: "pull request", he: "pull request (הצעת שינוי)", note: "Keep the English name; explain it once as הצעת שינוי שמישהו בודק." },
];

/** The Hebrew term for an English one (exact match), or undefined. */
export const heTerm = (en) => GLOSSARY.find((g) => g.en === en)?.he;

/** Terms the owner asked the glossary to cover (i18n.test.js checks they are all here). */
export const REQUIRED_TERMS = [
  "stock", "fund", "index fund", "whole-market fund", "S&P 500", "Nasdaq-100", "sector", "benchmark", "candle", "up day",
  "down day", "trend", "uptrend", "20-day average", "50-day average", "200-day average", "support", "resistance", "gap",
  "volume", "RSI", "stretched", "reward-to-risk", "stop", "target", "checklist", "paper money", "pretend money",
  "real money", "weekly buy", "weekly game", "rule", "history test", "random picks", "trust ladder", "track record",
  "verdict", "conviction", "watch", "lean up", "lean down", "unusual move", "why it moved", "filing", "earnings", "results",
  "outlook", "dividend", "drawdown", "biggest drop", "volatility", "savings", "lump sum", "time horizon",
];

export default GLOSSARY;
