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
