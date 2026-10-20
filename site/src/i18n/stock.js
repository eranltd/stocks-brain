// A stock's page and the market lists: the Stock page (tabs/Stock.jsx), the Stocks list (tabs/Watchlist.jsx), the
// chart checklist card, the candles, the zoom view, the "When would the rules allow a buy?" card, the market brief and
// the small charts (components/brief.jsx, checklist.jsx, candles.jsx, charts.jsx, lines.jsx, zoom.jsx, buywindow.jsx);
// plus the sentences their pure libs write (lib/brief.js "br.*", checklist.js "cl.*", candles.js "cd.*",
// fundamentals.js "fu.*", outlook.js "ol.*", buywindow.js "bw.*").
// Convention: `export default { en: {...}, he: {...} }` with identical keys (see shell.js and lib/i18n.js); financial
// words from glossary.js. i18n.test.js checks the file.
//
// Written here as pairs, add(key, English, Hebrew), so each English text sits next to its Hebrew one; a key added twice
// throws, so a copy-paste slip fails the tests instead of silently replacing a text. Plural values are objects
// { one, two?, other } (lib/i18n.js), picked by vars.count.
// Voice: a research notebook anyone may read. No "our household"; "the plan", "this site's rules", "the weekly buy",
// "you" only when telling a reader what an action means; never advice. Hebrew: plain modern Hebrew, infinitives rather
// than gendered commands, tickers and names in Latin letters, a stock, a company and a fund are all feminine (מניה,
// חברה, קרן), and a percent sign never sits next to a placeholder (the value carries it: pass "4%").

const en = {}, he = {};
/** One text in both languages. */
const add = (key, e, h) => {
  if (key in en) throw new Error(`i18n/stock.js: "${key}" is added twice`);
  en[key] = e;
  he[key] = h;
};

/* ======================================================= the eight steps' names (config/checklist.json "name") */

add("step.candle", "Candle pattern", "תבנית הנר");
add("step.trend", "Trend", "מגמה");
add("step.volume", "Volume", "מחזור מסחר");
add("step.ma20", "Moving average 20", "ממוצע 20 הימים");
add("step.gaps", "Gaps", "פערים");
add("step.levels", "Support and resistance", "תמיכה והתנגדות");
add("step.rsi", "RSI", "מדד RSI");
add("step.risk_plan", "Risk management and exit", "ניהול סיכון ויציאה");

/* ============================================================== lib/brief.js: "<Company> in short" */

add("br.verdict.lean_up", "Going up", "נוטה לעלות");
add("br.verdict.mixed", "Mixed", "תמונה מעורבת");
add("br.verdict.lean_down", "Going down", "נוטה לרדת");
add("br.footer", "On paper only: no real money moves on this. These checks are still unproven, and the plan keeps most of the money in an S&P 500 index fund.",
  "על הנייר בלבד: שום כסף אמיתי לא זז בגלל זה. הבדיקות האלה עדיין לא הוכחו, והתוכנית שומרת את רוב הכסף בקרן מחקה של מדד S&P 500.");
add("br.noChecklist", "The checklist appears after the next daily run.", "רשימת הבדיקה תופיע אחרי ההרצה היומית הבאה.");
add("br.read.sample", "The checklist here comes from sample prices, so it cannot count; it updates after the next daily run.",
  "רשימת הבדיקה כאן מחושבת ממחירים לדוגמה, ולכן היא לא נחשבת. היא תתעדכן אחרי ההרצה היומית הבאה.");
add("br.read.noRow", "No checklist for this name yet: not enough price history.", "עדיין אין רשימת בדיקה למניה הזאת: אין מספיק היסטוריית מחירים.");
add("br.read.older", "The checklist is from an older close; it updates after the next daily run.",
  "רשימת הבדיקה היא מסגירה ישנה יותר. היא תתעדכן אחרי ההרצה היומית הבאה.");

// The checklist summary's phrases (scripts/market.py PHRASE), said whole in another language.
add("br.phrase.candle.up", "buyers winning the last candles", "הקונים מנצחים בנרות האחרונים");
add("br.phrase.candle.down", "sellers winning the last candles", "המוכרים מנצחים בנרות האחרונים");
add("br.phrase.trend.up", "an uptrend", "מגמת עלייה");
add("br.phrase.trend.down", "a downtrend", "מגמת ירידה");
add("br.phrase.volume.up", "volume backs the rise", "מחזור המסחר תומך בעלייה");
add("br.phrase.volume.down", "volume does not back the move", "מחזור המסחר לא תומך בתנועה");
add("br.phrase.ma20.up", "above a rising twenty-day average", "מעל ממוצע 20 הימים, והוא עולה");
add("br.phrase.ma20.down", "below a falling twenty-day average", "מתחת לממוצע 20 הימים, והוא יורד");
add("br.phrase.gaps.up", "an open gap above", "פער פתוח מעל");
add("br.phrase.gaps.down", "an open gap below", "פער פתוח מתחת");
add("br.phrase.levels.up", "room up to resistance", "יש מקום לעלות עד רמת ההתנגדות");
add("br.phrase.levels.down", "pressed under resistance", "לחוצה מתחת לרמת ההתנגדות");
add("br.phrase.rsi.up", "RSI says oversold", "מדד RSI מראה מכירת יתר");
add("br.phrase.rsi.down", "RSI says overheated", "מדד RSI מראה התחממות יתר");
add("br.sum.both", "For this reading: {pro}. Against it: {con}.", "בעד הקריאה: {pro}. נגדה: {con}.");
add("br.sum.pro", "For this reading: {pro}.", "בעד הקריאה: {pro}.");
add("br.sum.con", "Against this reading: {con}.", "נגד הקריאה: {con}.");
add("br.sum.rrFits", "The possible gain is big enough for the risk.", "הרווח האפשרי גדול מספיק ביחס לסיכון.");
add("br.sum.rrBelow", "The possible gain is too small for the risk.", "הרווח האפשרי קטן מדי ביחס לסיכון.");

// The eight checks, one line each
add("br.row.candle.disagree", "Last candles: the day and the week disagree", "הנרות האחרונים: היום והשבוע לא מסכימים");
add("br.row.candle.up", "Last candle: buyers won the day", "הנר האחרון: הקונים ניצחו ביום הזה");
add("br.row.candle.down", "Last candle: sellers won the day", "הנר האחרון: המוכרים ניצחו ביום הזה");
add("br.row.candle.none", "Last candle: no clear winner", "הנר האחרון: אין מנצח ברור");
add("br.row.trend.up", "Trend: going up", "מגמה: עולה");
add("br.row.trend.down", "Trend: going down", "מגמה: יורדת");
add("br.row.trend.side", "Trend: sideways, no clear direction", "מגמה: הצידה, בלי כיוון ברור");
add("br.row.volume.trap", "Volume: rising on falling volume, careful", "מחזור מסחר: עלייה כשהמחזור יורד, זהירות");
add("br.row.volume.backsFall", "Volume: backs the fall", "מחזור מסחר: תומך בירידה");
add("br.row.volume.backsMove", "Volume: supports the move", "מחזור מסחר: תומך בתנועה");
add("br.row.volume.sellingFades", "Volume: the selling is fading", "מחזור מסחר: לחץ המכירות נחלש");
add("br.row.volume.riseFades", "Volume: the rise is losing steam", "מחזור מסחר: העלייה מאבדת תנופה");
add("br.row.volume.flat", "Volume: price about flat, nothing to confirm", "מחזור מסחר: המחיר כמעט לא זז, אין מה לאשר");
add("br.row.volume.none", "Volume: no clear signal", "מחזור מסחר: אין סימן ברור");
add("br.row.ma20.none", "20-day average: not available", "ממוצע 20 הימים: לא זמין");
add("br.row.ma20.aboveRising", "Above its 20-day average, which is rising", "מעל ממוצע 20 הימים, והממוצע עולה");
add("br.row.ma20.aboveFalling", "Above its 20-day average, but the average is falling", "מעל ממוצע 20 הימים, אבל הממוצע יורד");
add("br.row.ma20.belowRising", "Below its 20-day average, but the average is rising", "מתחת לממוצע 20 הימים, אבל הממוצע עולה");
add("br.row.ma20.belowFalling", "Below its 20-day average, which is falling", "מתחת לממוצע 20 הימים, והממוצע יורד");
add("br.row.gaps.above", "Open gap above: may get filled", "פער פתוח מעל: ייתכן שייסגר");
add("br.row.gaps.below", "Open gap below: may get filled", "פער פתוח מתחת: ייתכן שייסגר");
add("br.row.gaps.far", "Open gaps far away: not in play", "פערים פתוחים רחוקים: לא משחקים תפקיד כרגע");
add("br.row.gaps.none", "No open gaps", "אין פערים פתוחים");
add("br.row.levels.room", "Room to rise before resistance", "יש מקום לעלות לפני רמת ההתנגדות");
add("br.row.levels.nothingOver", "Nothing overhead: above every level of the past year", "שום דבר מעל: מעל כל הרמות של השנה האחרונה");
add("br.row.levels.close", "Close to resistance: may stall", "קרובה לרמת התנגדות: עלולה להיעצר");
add("br.row.levels.nothingUnder", "Nothing below to catch a fall", "אין רמת תמיכה מתחת שתבלום ירידה");
add("br.row.levels.between", "Between support and resistance", "בין רמת התמיכה לרמת ההתנגדות");
add("br.row.rsi.hot", "RSI: overheated", "מדד RSI: התחממות יתר");
add("br.row.rsi.oversold", "RSI: oversold", "מדד RSI: מכירת יתר");
add("br.row.rsi.normal", "RSI: not overheated", "מדד RSI: אין התחממות יתר");
add("br.row.risk.none", "Risk plan: not available", "תוכנית הסיכון: לא זמינה");
add("br.row.risk.no", "Risk plan: not worth it", "תוכנית הסיכון: לא משתלם");
add("br.row.risk.noNote", "the first target is less than {min} times as far as the stop", "היעד הראשון רחוק פחות מפי {min} מנקודת היציאה");
add("br.row.risk.paper", "Risk plan: worth it, on paper", "תוכנית הסיכון: משתלם, על הנייר");
add("br.row.risk.paperNote", "nothing overhead, so the target is set from the risk: arithmetic, not upside",
  "אין התנגדות מעל, ולכן היעד נקבע לפי הסיכון: חשבון, לא סיכוי לעלייה");
add("br.row.risk.yes", "Risk plan: worth it", "תוכנית הסיכון: משתלם");
add("br.row.risk.yesNote", "the first target is at least {min} times as far as the stop", "היעד הראשון רחוק לפחות פי {min} מנקודת היציאה");

// Percent and times in words (the value carries its own % sign)
add("br.lessThan1", "less than 1%", "פחות מאחוז אחד");
add("br.aboutPct", "about {pct}", "בערך {pct}");
add("br.aboutTimes", "about {x}", "בערך {x}");

// "Would the rules allow a pretend buy?"
add("br.stopWhy.support", "just under support", "קצת מתחת לרמת התמיכה");
add("br.stopWhy.atr", "about two normal days' swings down", "בערך שתי תנודות של יום רגיל כלפי מטה");
add("br.stopWhy.minAtr", "one normal day's swing down, the closest allowed", "תנודה אחת של יום רגיל כלפי מטה, הכי קרוב שמותר");
add("br.stopWhy.entry", "below the entry", "מתחת למחיר הכניסה");
add("br.plan.stop", "Stop: sell if it falls {pct} ({why})", "נקודת יציאה: מכירה אם היא יורדת {pct} ({why})");
add("br.plan.tp1Res", "First target: take some profit {pct} higher (at resistance)", "יעד ראשון: מימוש חלק מהרווח {pct} גבוה יותר (ברמת ההתנגדות)");
add("br.plan.tp1Risk", "First target: take some profit {pct} higher (nothing overhead, so set at twice the risk)",
  "יעד ראשון: מימוש חלק מהרווח {pct} גבוה יותר (אין התנגדות מעל, ולכן הוא נקבע בפעמיים הסיכון)");
add("br.plan.tp2", "Second target: {pct} higher", "יעד שני: {pct} גבוה יותר");
add("br.plan.rr", "You risk one to make {x}", "על כל 1 בסיכון, רווח אפשרי של {x}");
add("br.head.ok", "Within this site's rules for a paper entry", "בתוך כללי האתר לכניסה על הנייר");
add("br.head.no", "Not within this site's rules today", "לא בתוך כללי האתר היום");
add("br.why.stretched", "it has run too far above its trend", "היא עלתה רחוק מדי מעל המגמה שלה");
add("br.why.fewChecks", "fewer than three of the four setup checks pass", "פחות משלוש מארבע הבדיקות המהירות עוברות");
add("br.why.noPlan", "there is no written risk plan for it", "אין לה תוכנית סיכון כתובה");
add("br.why.needsChecklist", "the risk plan needs today's checklist", "תוכנית הסיכון צריכה את רשימת הבדיקה של היום");
add("br.why.smallGain", "the possible gain is too small for the risk", "הרווח האפשרי קטן מדי ביחס לסיכון");
add("br.wait.cool", "wait until it cools down", "לחכות שהיא תירגע");
add("br.wait.trendUp", "wait for the trend to turn up", "לחכות שהמגמה תפנה למעלה");
add("br.wait.beatBench", "wait until it does better than {bench} again", "לחכות שהביצועים שלה יעקפו שוב את {bench}");
add("br.wait.nextRun", "wait for the next daily run", "לחכות להרצה היומית הבאה");
add("br.wait.pullback", "wait for a pullback toward support, or a clean break above resistance",
  "לחכות לירידה חזרה לכיוון רמת התמיכה, או לפריצה ברורה מעל רמת ההתנגדות");

/* ====================================================== lib/checklist.js: the chart checklist in numbers */

add("cl.verdict.lean_up", "Leans up", "נטייה לעלייה");
add("cl.verdict.mixed", "Mixed", "מעורב");
add("cl.verdict.lean_down", "Leans down", "נטייה לירידה");
add("cl.verdictShort.lean_up", "lean up", "נטייה לעלייה");
add("cl.verdictShort.mixed", "mixed", "מעורב");
add("cl.verdictShort.lean_down", "lean down", "נטייה לירידה");

// Candle patterns (scripts/market.py classify_candle)
add("cl.pattern.bullish_engulfing", "bullish engulfing", "בליעה עולה");
add("cl.pattern.bearish_engulfing", "bearish engulfing", "בליעה יורדת");
add("cl.pattern.doji", "doji", "דוג׳י");
add("cl.pattern.hammer", "hammer", "פטיש");
add("cl.pattern.hanging_man", "hanging man", "איש תלוי");
add("cl.pattern.shooting_star", "shooting star", "כוכב נופל");
add("cl.pattern.inverted_hammer", "inverted hammer", "פטיש הפוך");
add("cl.pattern.bullish_marubozu", "bullish marubozu", "מרובוזו עולה");
add("cl.pattern.bearish_marubozu", "bearish marubozu", "מרובוזו יורד");
add("cl.pattern.spinning_top", "spinning top", "סביבון");
add("cl.pattern.up_day", "up day", "יום עלייה");
add("cl.pattern.down_day", "down day", "יום ירידה");
add("cl.pattern.up_week", "up week", "שבוע עלייה");
add("cl.pattern.down_week", "down week", "שבוע ירידה");

add("cl.daily.high", "Daily: {pattern}, closing near the high ({pct} up the range).", "יומי: {pattern}, סגירה קרוב לשיא של היום ({pct} מהטווח).");
add("cl.daily.mid", "Daily: {pattern}, closing mid-range ({pct}).", "יומי: {pattern}, סגירה באמצע הטווח ({pct}).");
add("cl.daily.low", "Daily: {pattern}, closing near the low ({pct} up the range).", "יומי: {pattern}, סגירה קרוב לשפל של היום ({pct} מהטווח).");
add("cl.daily.none", "Daily: {pattern}.", "יומי: {pattern}.");
add("cl.week.partial", "Week so far: {pattern} (partial).", "השבוע עד עכשיו: {pattern} (חלקי).");
add("cl.week.last", "Last week: {pattern}.", "שבוע שעבר: {pattern}.");
add("cl.disagree", "They disagree, so neutral.", "הם לא מסכימים, ולכן ניטרלי.");

add("cl.dir.up", "Uptrend", "מגמת עלייה");
add("cl.dir.down", "Downtrend", "מגמת ירידה");
add("cl.dir.sideways", "Sideways", "דשדוש");
add("cl.structure.higher_highs_and_higher_lows", "higher highs and higher lows", "שיאים גבוהים יותר ושפלים גבוהים יותר");
add("cl.structure.lower_highs_and_lower_lows", "lower highs and lower lows", "שיאים נמוכים יותר ושפלים נמוכים יותר");
add("cl.structure.mixed", "mixed", "שיאים ושפלים מעורבים");
add("cl.trend.aboveRising", "{dir} ({points} of 4 points): {d50} vs its 50-day average, which is above the 200-day and rising ({slope} over {days} days); {structure}.",
  "{dir} ({points} מתוך 4 נקודות): {d50} ביחס לממוצע 50 הימים, שנמצא מעל ממוצע 200 הימים ועולה ({slope} ב-{days} ימים); {structure}.");
add("cl.trend.aboveFalling", "{dir} ({points} of 4 points): {d50} vs its 50-day average, which is above the 200-day and falling ({slope} over {days} days); {structure}.",
  "{dir} ({points} מתוך 4 נקודות): {d50} ביחס לממוצע 50 הימים, שנמצא מעל ממוצע 200 הימים ויורד ({slope} ב-{days} ימים); {structure}.");
add("cl.trend.belowRising", "{dir} ({points} of 4 points): {d50} vs its 50-day average, which is below the 200-day and rising ({slope} over {days} days); {structure}.",
  "{dir} ({points} מתוך 4 נקודות): {d50} ביחס לממוצע 50 הימים, שנמצא מתחת לממוצע 200 הימים ועולה ({slope} ב-{days} ימים); {structure}.");
add("cl.trend.belowFalling", "{dir} ({points} of 4 points): {d50} vs its 50-day average, which is below the 200-day and falling ({slope} over {days} days); {structure}.",
  "{dir} ({points} מתוך 4 נקודות): {d50} ביחס לממוצע 50 הימים, שנמצא מתחת לממוצע 200 הימים ויורד ({slope} ב-{days} ימים); {structure}.");

add("cl.vol.trap", "Price up {pct} in {days} days on falling volume: a possible bull trap.", "המחיר עלה {pct} ב-{days} ימים כשמחזור המסחר יורד: אולי מלכודת עליות.");
add("cl.vol.backsFall", "Volume backs the fall ({pct} in {days} days).", "מחזור המסחר תומך בירידה ({pct} ב-{days} ימים).");
add("cl.vol.backsRise", "Volume backs the rise ({pct} in {days} days).", "מחזור המסחר תומך בעלייה ({pct} ב-{days} ימים).");
add("cl.vol.fadingFall", "Falling on fading volume: weakening, but this site does not call bottoms ({pct} in {days} days).",
  "ירידה במחזור מסחר הולך וקטן: הירידה נחלשת, אבל האתר לא מנסה לנחש את התחתית ({pct} ב-{days} ימים).");
add("cl.vol.weakRise", "The rise is weakening: down-day volume leads ({pct} in {days} days).", "העלייה נחלשת: המחזור בימי הירידה גבוה יותר ({pct} ב-{days} ימים).");
add("cl.vol.flat", "Price about flat over {days} days ({pct}).", "המחיר כמעט לא זז ב-{days} ימים ({pct}).");
add("cl.vol.neither", "Volume neither backs nor fades the move ({pct} in {days} days).", "מחזור המסחר לא תומך בתנועה וגם לא מחליש אותה ({pct} ב-{days} ימים).");
add("cl.vol.ratio", "up-day volume {x}× down-day volume over {avg} days", "המחזור בימי עלייה פי {x} מהמחזור בימי ירידה, ב-{avg} ימים");
add("cl.vol.last", "last day {x}× its {avg}-day average", "ביום האחרון פי {x} מהממוצע של {avg} ימים");
add("cl.vol.trend", "{days}-day volume {pct} vs the {days} before", "המחזור ב-{days} הימים האחרונים {pct} לעומת {days} הימים שלפניהם");

add("cl.ma20.aboveRising", "{dist} above its 20-day average, which is rising ({slope} over {days} days).", "{dist} מעל ממוצע 20 הימים, והממוצע עולה ({slope} ב-{days} ימים).");
add("cl.ma20.aboveFalling", "{dist} above its 20-day average, which is falling ({slope} over {days} days).", "{dist} מעל ממוצע 20 הימים, והממוצע יורד ({slope} ב-{days} ימים).");
add("cl.ma20.belowRising", "{dist} below its 20-day average, which is rising ({slope} over {days} days).", "{dist} מתחת לממוצע 20 הימים, והממוצע עולה ({slope} ב-{days} ימים).");
add("cl.ma20.belowFalling", "{dist} below its 20-day average, which is falling ({slope} over {days} days).", "{dist} מתחת לממוצע 20 הימים, והממוצע יורד ({slope} ב-{days} ימים).");

add("cl.gaps.none", "No open gaps in the last {days} trading days.", "אין פערים פתוחים ב-{days} ימי המסחר האחרונים.");
add("cl.gaps.counts", "{above} open above, {below} below.", "פתוחים: {above} מעל, {below} מתחת.");
add("cl.gaps.nearAbove", { one: "Nearest: a {size} gap above, {dist} away, open {count} day", other: "Nearest: a {size} gap above, {dist} away, open {count} days" },
  { one: "הקרוב ביותר: פער של {size} מעל, במרחק {dist}, פתוח יום אחד", two: "הקרוב ביותר: פער של {size} מעל, במרחק {dist}, פתוח יומיים", other: "הקרוב ביותר: פער של {size} מעל, במרחק {dist}, פתוח {count} ימים" });
add("cl.gaps.nearBelow", { one: "Nearest: a {size} gap below, {dist} away, open {count} day", other: "Nearest: a {size} gap below, {dist} away, open {count} days" },
  { one: "הקרוב ביותר: פער של {size} מתחת, במרחק {dist}, פתוח יום אחד", two: "הקרוב ביותר: פער של {size} מתחת, במרחק {dist}, פתוח יומיים", other: "הקרוב ביותר: פער של {size} מתחת, במרחק {dist}, פתוח {count} ימים" });
add("cl.gaps.toward", "; price is moving toward it", "; המחיר נע לכיוונו");

add("cl.lvl.item", { one: "{dist} ({count} touch)", other: "{dist} ({count} touches)" }, { one: "{dist} (נגיעה אחת)", two: "{dist} (שתי נגיעות)", other: "{dist} ({count} נגיעות)" });
add("cl.lvl.support", "Support {list} below.", "תמיכה מתחת: {list}.");
add("cl.lvl.noSupport", "No support below in the past year.", "אין רמת תמיכה מתחת בשנה האחרונה.");
add("cl.lvl.resistance", "Resistance {list} above.", "התנגדות מעל: {list}.");
add("cl.lvl.noResistance", "No resistance overhead in the past year.", "אין רמת התנגדות מעל בשנה האחרונה.");

add("cl.rsi.overbought", "RSI {v}: overbought, which leans bearish (overbought at {ob} or more, oversold at {os} or less).",
  "מדד RSI {v}: קניית יתר, נטייה לירידה (קניית יתר מ-{ob} ומעלה, מכירת יתר מ-{os} ומטה).");
add("cl.rsi.oversold", "RSI {v}: oversold, which leans bullish (overbought at {ob} or more, oversold at {os} or less).",
  "מדד RSI {v}: מכירת יתר, נטייה לעלייה (קניית יתר מ-{ob} ומעלה, מכירת יתר מ-{os} ומטה).");
add("cl.rsi.neutral", "RSI {v}: neutral (overbought at {ob} or more, oversold at {os} or less).",
  "מדד RSI {v}: ניטרלי (קניית יתר מ-{ob} ומעלה, מכירת יתר מ-{os} ומטה).");

add("cl.stop.support", "just under the nearest support", "קצת מתחת לרמת התמיכה הקרובה");
add("cl.stop.atr", "two ATRs below the close", "שני ATR מתחת לסגירה");
add("cl.stop.minAtr", "one ATR, the closest allowed", "ATR אחד, הכי קרוב שמותר");
add("cl.tp1.risk", "at {mult}× the risk: no resistance overhead in the past year, so it fits the rule by construction",
  "בפי {mult} מהסיכון: אין רמת התנגדות מעל בשנה האחרונה, ולכן הוא עומד בכלל מעצם החישוב");
add("cl.tp1.riskShort", "at {mult}× the risk: nothing overhead", "בפי {mult} מהסיכון: אין התנגדות מעל");
add("cl.tp1.res", "at the nearest resistance", "ברמת ההתנגדות הקרובה");
add("cl.tp2.res", "at the next resistance", "ברמת ההתנגדות הבאה");
add("cl.tp2.risk", "set from the risk: no second resistance", "נקבע לפי הסיכון: אין רמת התנגדות שנייה");
add("cl.risk.text", "Stop {stop} below, TP1 {tp1} above, TP2 {tp2} above: reward-to-risk {rr} to TP1 (need {min} or more).",
  "נקודת יציאה {stop} מתחת, יעד 1 {tp1} מעל, יעד 2 {tp2} מעל: יחס סיכוי-סיכון {rr} עד יעד 1 (נדרש {min} או יותר).");

add("cl.br.range", ", 90% range {lo} to {hi}", ", טווח של 90%: {lo} עד {hi}");
add("cl.br.beat", {
  one: "When it read {v}, the name beat the {bench} by {pts} points on average over the next {days} trading days ({count} case{range}).",
  other: "When it read {v}, the name beat the {bench} by {pts} points on average over the next {days} trading days ({count} cases{range}).",
}, {
  one: "כשהקריאה הייתה {v}, המניה עקפה את {bench} ב-{pts} נקודות בממוצע ב-{days} ימי המסחר שאחריה (מקרה אחד{range}).",
  other: "כשהקריאה הייתה {v}, המניה עקפה את {bench} ב-{pts} נקודות בממוצע ב-{days} ימי המסחר שאחריה ({count} מקרים{range}).",
});
add("cl.br.trailed", {
  one: "When it read {v}, the name trailed the {bench} by {pts} points on average over the next {days} trading days ({count} case{range}).",
  other: "When it read {v}, the name trailed the {bench} by {pts} points on average over the next {days} trading days ({count} cases{range}).",
}, {
  one: "כשהקריאה הייתה {v}, המניה פיגרה אחרי {bench} ב-{pts} נקודות בממוצע ב-{days} ימי המסחר שאחריה (מקרה אחד{range}).",
  other: "כשהקריאה הייתה {v}, המניה פיגרה אחרי {bench} ב-{pts} נקודות בממוצע ב-{days} ימי המסחר שאחריה ({count} מקרים{range}).",
});
add("cl.edge.clear", "Lean-up readings did better than the average snapshot, even at the low end of their range. In-sample and on survivors, so still unproven.",
  "קריאות של נטייה לעלייה הצליחו יותר מתמונת המצב הממוצעת, גם בקצה הנמוך של הטווח. זה נמדד על אותם נתונים ועל מניות ששרדו, ולכן זה עדיין לא מוכח.");
add("cl.edge.noise", "Lean-up readings did a little better than the average snapshot ({pct}), but within the noise: not an edge to trust.",
  "קריאות של נטייה לעלייה הצליחו קצת יותר מתמונת המצב הממוצעת ({pct}), אבל בתוך הרעש: לא יתרון שאפשר לסמוך עליו.");
add("cl.edge.none", "Lean-up readings did no better than the average snapshot ({pct}).", "קריאות של נטייה לעלייה לא הצליחו יותר מתמונת המצב הממוצעת ({pct}).");
add("cl.fwd.none", "The forward record starts with the next daily run.", "התיעוד מכאן והלאה מתחיל בהרצה היומית הבאה.");
add("cl.fwd.head", { one: "Forward record since {since}: {count} snapshot written, {scored} scored.", other: "Forward record since {since}: {count} snapshots written, {scored} scored." },
  { one: "תיעוד מכאן והלאה מאז {since}: נכתבה תמונת מצב אחת, {scored} כבר נבדקו.", other: "תיעוד מכאן והלאה מאז {since}: נכתבו {count} תמונות מצב, {scored} כבר נבדקו." });
add("cl.fwd.first", "The first is scored {days} trading days after it was written.", "הראשונה נבדקת {days} ימי מסחר אחרי שנכתבה.");
add("cl.gate.noFile", "Risk plan: the technical checklist appears after the next daily run", "תוכנית הסיכון: רשימת הבדיקה הטכנית תופיע אחרי ההרצה היומית הבאה");
add("cl.gate.noRow", "Risk plan: no checklist for this name (not enough data)", "תוכנית הסיכון: אין רשימת בדיקה למניה הזאת (אין מספיק נתונים)");
add("cl.gate.sample", "Risk plan: computed from sample prices here, so it cannot count", "תוכנית הסיכון: חושבה כאן ממחירים לדוגמה, ולכן היא לא נחשבת");
add("cl.gate.older", "Risk plan: the checklist is from the {date} close, older than the last close; wait for it to update",
  "תוכנית הסיכון: רשימת הבדיקה היא מהסגירה של {date}, ישנה מהסגירה האחרונה. צריך לחכות לעדכון");
add("cl.gate.byConstruction", "Risk plan: no resistance in the past year, so TP1 sits at {rr}× the risk by construction (need {min} or more). It fits, but that is arithmetic, not upside",
  "תוכנית הסיכון: אין רמת התנגדות בשנה האחרונה, ולכן יעד 1 נקבע בפי {rr} מהסיכון מעצם החישוב (נדרש {min} או יותר). זה עומד בכלל, אבל זה חשבון, לא סיכוי לעלייה");
add("cl.gate.rr", "Risk plan: reward-to-risk to TP1 is {rr} (need {min} or more)", "תוכנית הסיכון: יחס הסיכוי-סיכון עד יעד 1 הוא {rr} (נדרש {min} או יותר)");

/* ========================================================== lib/candles.js: the candles chart's words */

add("cd.range.3m", "3M", "3 ח׳");
add("cd.range.6m", "6M", "6 ח׳");
add("cd.range.w", "Weekly", "שבועי");
add("cd.overlay.volume", "Volume vs average", "מחזור מול הממוצע");
add("cd.overlay.ma20", "20-day average", "ממוצע 20 הימים");
add("cd.overlay.gaps", "Open gaps", "פערים פתוחים");
add("cd.overlay.levels", "Support and resistance", "תמיכה והתנגדות");
add("cd.overlay.rsi", "RSI", "מדד RSI");
add("cd.overlay.risk", "Risk plan", "תוכנית סיכון");
add("cd.line.close", "Last close = entry", "סגירה אחרונה = כניסה");
add("cd.line.stop", "Stop", "נקודת יציאה");
add("cd.line.tp1", "TP1", "יעד 1");
add("cd.line.tp2", "TP2", "יעד 2");
add("cd.line.tp1Res", { one: "TP1 at resistance · {count} touch", other: "TP1 at resistance · {count} touches" },
  { one: "יעד 1 ברמת התנגדות · נגיעה אחת", two: "יעד 1 ברמת התנגדות · שתי נגיעות", other: "יעד 1 ברמת התנגדות · {count} נגיעות" });
add("cd.line.tp2Res", { one: "TP2 at resistance · {count} touch", other: "TP2 at resistance · {count} touches" },
  { one: "יעד 2 ברמת התנגדות · נגיעה אחת", two: "יעד 2 ברמת התנגדות · שתי נגיעות", other: "יעד 2 ברמת התנגדות · {count} נגיעות" });
add("cd.line.support", { one: "Support · {count} touch", other: "Support · {count} touches" },
  { one: "תמיכה · נגיעה אחת", two: "תמיכה · שתי נגיעות", other: "תמיכה · {count} נגיעות" });
add("cd.line.resistance", { one: "Resistance · {count} touch", other: "Resistance · {count} touches" },
  { one: "התנגדות · נגיעה אחת", two: "התנגדות · שתי נגיעות", other: "התנגדות · {count} נגיעות" });
add("cd.line.gapAbove", "Open gap above", "פער פתוח מעל");
add("cd.line.gapBelow", "Open gap below", "פער פתוח מתחת");
add("cd.month.jan", "Jan ’{yy}", "ינו׳ ’{yy}");
["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].forEach((m, i) =>
  add(`cd.month.${i + 1}`, m, ["פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"][i]));
add("cd.vol.day", "{x}× its 20-day average", "פי {x} מממוצע 20 הימים");
add("cd.vol.week", "{x}× its 20-week average", "פי {x} מממוצע 20 השבועות");
add("cd.tip.open", "Open", "פתיחה");
add("cd.tip.high", "High", "גבוה");
add("cd.tip.low", "Low", "נמוך");
add("cd.tip.close", "Close", "סגירה");
add("cd.tip.dayMove", "Day's move", "תנועת היום");
add("cd.tip.weekMove", "Week's move", "תנועת השבוע");
add("cd.tip.volDay", "Volume vs 20-day avg", "מחזור מול ממוצע 20 ימים");
add("cd.tip.volWeek", "Volume vs 20-week avg", "מחזור מול ממוצע 20 שבועות");
add("cd.summary.daily", "{symbol}: {n} daily candles as percent from the last close, from {from} to {to}. Range {lo} to {hi}. Use the left and right arrow keys to read each candle.",
  "{symbol}: {n} נרות יומיים, באחוזים מהסגירה האחרונה, מ-{from} עד {to}. טווח: {lo} עד {hi}. אפשר לקרוא כל נר בעזרת מקשי החצים ימינה ושמאלה.");
add("cd.summary.weekly", "{symbol}: {n} weekly candles as percent from the last close, from {from} to {to}. Range {lo} to {hi}. Use the left and right arrow keys to read each candle.",
  "{symbol}: {n} נרות שבועיים, באחוזים מהסגירה האחרונה, מ-{from} עד {to}. טווח: {lo} עד {hi}. אפשר לקרוא כל נר בעזרת מקשי החצים ימינה ושמאלה.");

/* ============================================================ lib/fundamentals.js: the company's own numbers */

["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].forEach((m, i) =>
  add(`fu.month.${i}`, m, ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"][i]));
add("fu.label.sales", "Sales", "מכירות");
add("fu.label.op", "Profit from the business", "רווח מהפעילות");
add("fu.label.net", "Bottom line", "השורה התחתונה");
add("fu.label.fcf", "Cash after investing", "מזומן אחרי השקעות");
add("fu.sales.grew", "Grew {pct} over {period}", "גדלו ב-{pct} במהלך {period}");
add("fu.sales.shrank", "Shrank {pct} over {period}", "קטנו ב-{pct} במהלך {period}");
add("fu.sales.year", "its latest year", "השנה האחרונה שדווחה");
add("fu.sales.ttm", "the last twelve months", "12 החודשים האחרונים");
add("fu.sales.qUp", "; the latest quarter was up {pct} on a year before.", "; ברבעון האחרון הן עלו ב-{pct} לעומת שנה קודם.");
add("fu.sales.qDown", "; the latest quarter was down {pct} on a year before.", "; ברבעון האחרון הן ירדו ב-{pct} לעומת שנה קודם.");
add("fu.op.pos", "Keeps {c} cents of operating profit from each dollar of sales.", "נשארים לה {c} סנט רווח תפעולי מכל דולר של מכירות.");
add("fu.op.neg", "Lost {c} cents on each dollar of sales from running the business.", "הפסידה {c} סנט על כל דולר של מכירות מהפעילות עצמה.");
add("fu.net.pos", "{c} cents of each dollar of sales was left as profit after everything.", "מכל דולר של מכירות נשארו {c} סנט רווח אחרי כל ההוצאות.");
add("fu.net.neg", "A loss of {c} cents on each dollar of sales after everything, often a one-off charge: check the filing.",
  "הפסד של {c} סנט על כל דולר של מכירות אחרי כל ההוצאות, לעיתים קרובות בגלל הוצאה חד-פעמית: הפרטים בדיווח הרשמי.");
add("fu.fcf.pos", "Brought in {c} cents of spare cash per dollar of sales after paying for new buildings and equipment.",
  "הכניסה {c} סנט מזומן פנוי על כל דולר של מכירות, אחרי תשלום על מבנים וציוד חדשים.");
add("fu.fcf.neg", "Spent {c} cents more per dollar of sales than it brought in, after paying for new buildings and equipment.",
  "הוציאה {c} סנט יותר ממה שהכניסה על כל דולר של מכירות, אחרי תשלום על מבנים וציוד חדשים.");
add("fu.period.annual", "Its latest full year, to {month}, from its yearly report to the SEC (filed {filed}). It reports yearly, so there are no quarterly numbers.",
  "השנה המלאה האחרונה, עד {month}, מהדוח השנתי שהחברה הגישה ל-SEC (הוגש ב-{filed}). החברה מדווחת פעם בשנה, ולכן אין מספרים רבעוניים.");
add("fu.period.ttm", "Twelve months to {month}, from the company's filings with the SEC (filed {filed}).",
  "12 חודשים עד {month}, מהדיווחים הרשמיים של החברה ל-SEC (הוגשו ב-{filed}).");

/* ================================================================ lib/outlook.js: dates and growth in words */

add("ol.today", "today", "היום");
add("ol.tomorrow", "tomorrow", "מחר");
add("ol.yesterday", "yesterday", "אתמול");
add("ol.in", { one: "in {count} day", other: "in {count} days" }, { one: "בעוד יום", two: "בעוד יומיים", other: "בעוד {count} ימים" });
add("ol.ago", { one: "{count} day ago", other: "{count} days ago" }, { one: "לפני יום", two: "לפני יומיים", other: "לפני {count} ימים" });
add("ol.growth.up", "up {pct} from a year earlier", "עלייה של {pct} לעומת שנה קודם");
add("ol.growth.down", "down {pct} from a year earlier", "ירידה של {pct} לעומת שנה קודם");
add("ol.kind.product", "Product", "מוצר");
add("ol.kind.finance", "Finance", "כספים");
add("ol.kind.regulatory", "Regulatory", "רגולציה");
add("ol.kind.deal", "Deal", "עסקה");
add("ol.kind.other", "Other", "אחר");

/* ===================================================== lib/buywindow.js: "When would the rules allow a buy?" */

add("bw.rule.five_leaders_weekly", "Five Leaders, weekly", "חמש המובילות, שבועי");
add("bw.rule.weekly_swing", "Weekly Swing", "התנופה השבועית");
add("bw.rule.five_leaders", "Five Leaders, monthly", "חמש המובילות, חודשי");
add("bw.rule.five_leaders_quarterly", "Five Leaders, every three months", "חמש המובילות, כל שלושה חודשים");
add("bw.under01", "under 0.1", "פחות מ-0.1");
add("bw.na", "Not available today", "לא זמין היום");
add("bw.note", "This is what this site's own rules say, not a forecast. Prices can change a lot before the next look.",
  "זה מה שהכללים של האתר אומרים, לא תחזית. המחירים יכולים להשתנות הרבה עד הבדיקה הבאה.");
add("bw.fundNote", "This is what the plan says, not a forecast. Prices can change a lot from one week to the next.",
  "זה מה שהתוכנית אומרת, לא תחזית. המחירים יכולים להשתנות הרבה משבוע לשבוע.");
// "it" is the stock, the company or the fund: all feminine in Hebrew; "it" of a 50- or 200-day line is the average (masculine)
add("bw.now.pctAbove", "{pct} above it", "{pct} מעליו");
add("bw.now.pctBelow", "{pct} below it", "{pct} מתחתיו");
add("bw.now.above", "Above it", "מעליו");
add("bw.now.below", "Below it", "מתחתיו");
add("bw.now.lineRising", "; the line is rising", "; הממוצע עולה");
add("bw.now.lineFalling", "; the line is falling", "; הממוצע יורד");
add("bw.stretch.label", "Not stretched: less than {limit} above its 50-day line", "לא מתוחה: פחות מ-{limit} מעל ממוצע 50 הימים");
add("bw.stretch.need", "Under {limit} above", "פחות מ-{limit} מעליו");
add("bw.rr.label", "Reward-to-risk to the first target is {min} or more (chart checklist)", "יחס סיכוי-סיכון של {min} או יותר עד היעד הראשון (רשימת הבדיקה של הגרף)");
add("bw.rr.now", "{x} to 1", "{x} ל-1");
add("bw.rr.need", "{min} to 1 or more", "{min} ל-1 או יותר");
add("bw.rr.waitCeiling", "The nearest ceiling is close. Reward-to-risk fits only after a dip toward support or a clean break above the ceiling.",
  "התקרה (רמת ההתנגדות) קרובה מאוד. יחס הסיכוי-סיכון יתאים רק אחרי ירידה לכיוון רמת התמיכה או פריצה ברורה מעל התקרה.");
add("bw.rr.wait", "Wait for a better reward-to-risk: {min} to 1 or more.", "לחכות ליחס סיכוי-סיכון טוב יותר: {min} ל-1 או יותר.");

// real money first
add("bw.rm.when", " The next weekly buy is {buy}.", " הקנייה השבועית הבאה: {buy}.");
add("bw.rm.core", "With real money: yes, for money not needed for 5 years or more. This is the kind of fund the weekly buy goes into: the same amount every week, whatever the news. This one follows the S&P 500, like the fund the plan describes.{when}",
  "בכסף אמיתי: כן, לכסף שלא יידרש 5 שנים או יותר. זה סוג הקרן שהקנייה השבועית נכנסת אליה: אותו סכום בכל שבוע, בלי קשר לחדשות. הקרן הזאת עוקבת אחרי מדד S&P 500, כמו הקרן שהתוכנית מתארת.{when}");
add("bw.rm.fund", "With real money: the weekly buy goes into one whole-market fund (an S&P 500 fund), not this one. This fund is here to read about and compare.{when}",
  "בכסף אמיתי: הקנייה השבועית נכנסת לקרן אחת על כל השוק (קרן של מדד S&P 500), לא לקרן הזאת. היא כאן כדי לקרוא עליה ולהשוות.{when}");
add("bw.rm.earned", "With real money: only within the plan's limits, only on the rule's review day, and only what that rule holds. Most of the money stays in the weekly buy of the whole-market fund.{when}",
  "בכסף אמיתי: רק בתוך המגבלות של התוכנית, רק ביום הבדיקה של הכלל, ורק מה שהכלל הזה מחזיק. רוב הכסף נשאר בקנייה השבועית של הקרן על כל השוק.{when}");
add("bw.rm.pieceYes", "The weekly buy of the whole-market fund (an S&P 500 fund) already buys a small piece of it.",
  "הקנייה השבועית של הקרן על כל השוק (קרן של מדד S&P 500) כבר קונה חלק קטן ממנה.");
add("bw.rm.pieceNo", "It is not in the S&P 500, so the weekly buy of the whole-market fund does not hold it. That weekly buy stays the plan.",
  "היא לא נמצאת במדד S&P 500, ולכן הקנייה השבועית של הקרן על כל השוק לא מחזיקה בה. הקנייה השבועית הזאת נשארת התוכנית.");
add("bw.rm.pieceMaybe", "If this company is in the S&P 500, the weekly buy of the whole-market fund (an S&P 500 fund) already buys a small piece of it.",
  "אם החברה הזאת נמצאת במדד S&P 500, הקנייה השבועית של הקרן על כל השוק (קרן של מדד S&P 500) כבר קונה חלק קטן ממנה.");
add("bw.rm.notSingleToday", "With real money: not as a single stock today. {piece}{when}", "בכסף אמיתי: לא כמניה בודדת, לא היום. {piece}{when}");
add("bw.rm.notSingle", "With real money: not as a single stock. {piece}{when}", "בכסף אמיתי: לא כמניה בודדת. {piece}{when}");

// one rule's look: rank, group and checks
add("bw.and", "{a} and {b}", "{a}, וגם {b}");
add("bw.rw.rs_12_1", "past-year rise", "העלייה בשנה האחרונה");
add("bw.rw.rs_1m", "past-month rise against the market", "העלייה בחודש האחרון ביחס לשוק");
add("bw.rw.other", "rise", "העלייה");
add("bw.rank.notEligible", "Not a full year of prices yet", "עדיין אין שנה מלאה של מחירים");
add("bw.rank.of", "Ranks {rank} of {of} by {rw}", "מקום {rank} מתוך {of} לפי {rw}");
add("bw.rank.none", "No rank today", "אין דירוג היום");
add("bw.lead.leadsButMisses", "; leads its group, but {name} gets the place while this one misses a check",
  "; מובילה את הקבוצה שלה, אבל {name} מקבלת את המקום כל עוד המניה הזאת לא עוברת בדיקה");
add("bw.lead.takerAlso", "; {name} also holds its group's place", "; גם {name} מחזיקה במקום של הקבוצה");
add("bw.lead.taker", "; {name} holds its group's place", "; {name} מחזיקה במקום של הקבוצה");
add("bw.lead.keeps", "; keeps its group's place", "; שומרת על המקום של הקבוצה שלה");
add("bw.lead.wins", "; wins its group's place", "; זוכה במקום של הקבוצה שלה");
add("bw.lead.slotsGone", "; all {slots} places go to stronger names", "; כל {slots} המקומות הולכים למניות חזקות יותר");
add("bw.lead.leads", "; leads its group", "; מובילה את הקבוצה שלה");
add("bw.lead.leaderMisses", "; {name} ranks higher in its group but misses a check, so the group's place is open",
  "; {name} מדורגת גבוה יותר בקבוצה אבל לא עוברת בדיקה, ולכן המקום של הקבוצה פנוי");
add("bw.lead.leader", "; {name} leads its group", "; {name} מובילה את הקבוצה");
add("bw.leader.labelKept", "Keeps its place: still in the top {keep} of the list by {rw}", "שומרת על המקום: עדיין בין {keep} הראשונות ברשימה לפי {rw}");
add("bw.leader.label", "Strongest {rw} in its group (one per group, {slots} places in all)", "החזקה ביותר בקבוצה שלה לפי {rw} (אחת מכל קבוצה, {slots} מקומות בסך הכול)");
add("bw.leader.needKept", "Stay in the top {keep}", "להישאר בין {keep} הראשונות");
add("bw.leader.need", "Lead its group and win one of the {slots} places", "להוביל את הקבוצה שלה ולזכות באחד מ-{slots} המקומות");
add("bw.check.trend200.label", "Above a rising 200-day line", "מעל ממוצע 200 הימים, והממוצע עולה");
add("bw.check.trend200.need", "Above it, and the line rising", "מעליו, והממוצע עולה");
add("bw.check.above200.label", "Above its 200-day line", "מעל ממוצע 200 הימים");
add("bw.check.above200.need", "Above it", "מעליו");
add("bw.check.above50.label", "Above its 50-day line", "מעל ממוצע 50 הימים");
add("bw.check.above50.need", "Above it", "מעליו");

// what to wait for, and why not (each "why" in two forms: alone, and as a clause joined to another reason)
add("bw.wait.notEligible", "It needs a full year of unbroken prices before the rules can rank it.", "היא צריכה שנה מלאה של מחירים רצופים לפני שהכללים יוכלו לדרג אותה.");
add("bw.why.notEligible", "under a year of prices", "פחות משנה של מחירים");
add("bw.why.notEligible.clause", "it has under a year of prices", "יש לה פחות משנה של מחירים");
add("bw.wait.takerKept", "{name} already holds its group's place on paper and keeps it while it stays in the top {keep}. The rules take one per group.",
  "{name} כבר מחזיקה במקום של הקבוצה על הנייר, ושומרת עליו כל עוד היא בין {keep} הראשונות. הכללים לוקחים אחת מכל קבוצה.");
add("bw.why.takerKept", "{name} keeps its group's place", "{name} שומרת על המקום של הקבוצה");
add("bw.wait.placeGone", "{name} holds its group's place, because it ranks higher by {rw} and passes the checks. The rules take one per group, so this one would need a bigger {rw} than {name}.",
  "{name} מחזיקה במקום של הקבוצה, כי היא מדורגת גבוה יותר לפי {rw} ועוברת את הבדיקות. הכללים לוקחים אחת מכל קבוצה, ולכן המניה הזאת הייתה צריכה לעקוף את {name} לפי {rw}.");
add("bw.why.placeGone", "{name} ranks higher in its group", "{name} מדורגת גבוה יותר בקבוצה");
add("bw.wait.leader", "{name} leads its group by {rw}. The rules take one per group, so this one would need a bigger {rw} than {name}.",
  "{name} מובילה את הקבוצה לפי {rw}. הכללים לוקחים אחת מכל קבוצה, ולכן המניה הזאת הייתה צריכה לעקוף את {name} לפי {rw}.");
add("bw.why.leader", "{name} leads its group", "{name} מובילה את הקבוצה");
add("bw.wait.another", "Another name in its group ranks higher. The rules take one per group.", "מניה אחרת בקבוצה מדורגת גבוה יותר. הכללים לוקחים אחת מכל קבוצה.");
add("bw.why.another", "another name leads its group", "מניה אחרת מובילה את הקבוצה");
add("bw.wait.rankLow", "Wait until its {rw} is back in the top {keep} of the list.", "לחכות שהיא תחזור להיות בין {keep} הראשונות ברשימה לפי {rw}.");
add("bw.why.rankLow", "out of the top {keep}", "מחוץ ל-{keep} הראשונות");
add("bw.why.rankLow.clause", "it is out of the top {keep}", "היא מחוץ ל-{keep} הראשונות");
add("bw.wait.noSlot", "All {slots} places go to names that rank higher by {rw} or that the rule already holds.",
  "כל {slots} המקומות הולכים למניות שמדורגות גבוה יותר לפי {rw}, או שהכלל כבר מחזיק בהן.");
add("bw.why.noSlot", "the places go to stronger names", "המקומות הולכים למניות חזקות יותר");
add("bw.wait.below200Falling", "Wait until it is back above its 200-day line and that line turns up again.", "לחכות שהיא תחזור מעל ממוצע 200 הימים, ושהממוצע יפנה שוב למעלה.");
add("bw.why.below200Falling", "below a falling 200-day line", "מתחת לממוצע 200 הימים, והוא יורד");
add("bw.why.below200Falling.clause", "it is below a falling 200-day line", "היא מתחת לממוצע 200 הימים, והוא יורד");
add("bw.wait.below200", "Wait until it is back above its 200-day line.", "לחכות שהיא תחזור מעל ממוצע 200 הימים.");
add("bw.why.below200", "below its 200-day line", "מתחת לממוצע 200 הימים");
add("bw.why.below200.clause", "it is below its 200-day line", "היא מתחת לממוצע 200 הימים");
add("bw.wait.falling200", "Wait until its 200-day line turns up again.", "לחכות שממוצע 200 הימים שלה יפנה שוב למעלה.");
add("bw.why.falling200", "its 200-day line is falling", "ממוצע 200 הימים שלה יורד");
add("bw.wait.below50", "Wait until it is back above its 50-day line.", "לחכות שהיא תחזור מעל ממוצע 50 הימים.");
add("bw.why.below50", "below its 50-day line", "מתחת לממוצע 50 הימים");
add("bw.why.below50.clause", "it is below its 50-day line", "היא מתחת לממוצע 50 הימים");
add("bw.wait.stretched", "Wait until it is less than {limit} above its 50-day line.", "לחכות שהיא תהיה פחות מ-{limit} מעל ממוצע 50 הימים.");
add("bw.why.stretched", "stretched above its 50-day line", "מתוחה מעל ממוצע 50 הימים");
add("bw.why.stretched.clause", "it is stretched above its 50-day line", "היא מתוחה מעל ממוצע 50 הימים");
// a rule's answer, said of the stock (feminine in Hebrew, whatever the rule's name)
add("bw.answer.keep", "would keep it", "הייתה נשארת");
add("bw.answer.pick", "would pick it", "הייתה נבחרת");
add("bw.answer.letGo", "would let it go", "הייתה יוצאת");
add("bw.answer.notPick", "would not pick it", "לא הייתה נבחרת");

// funds, and names the rules do not read
add("bw.core.headline", "This is the kind of fund the weekly buy goes into.", "זה סוג הקרן שהקנייה השבועית נכנסת אליה.");
add("bw.core.nextLook", "Every week: the same amount, on the first trading day, whatever the chart says.", "בכל שבוע: אותו סכום, ביום המסחר הראשון, בלי קשר למה שהגרף מראה.");
add("bw.core.wait", "Nothing to wait for: the plan does not try to time the market. Buying when the index is at a high is normal; highs come in clusters.",
  "אין למה לחכות: התוכנית לא מנסה לתזמן את השוק. קנייה כשהמדד בשיא היא דבר רגיל; שיאים מגיעים בקבוצות.");
add("bw.fund.headline", "Not part of the weekly plan.", "לא חלק מהתוכנית השבועית.");
add("bw.fund.nextLook", "No date: it is not part of the plan, and the site's stock rules never look at funds.", "אין תאריך: היא לא חלק מהתוכנית, וכללי המניות של האתר לא בודקים קרנות.");
add("bw.look.trendLabel", "Heading up: above its 50-day line, which is above its 200-day line", "בכיוון למעלה: מעל ממוצע 50 הימים, שנמצא מעל ממוצע 200 הימים");
add("bw.look.now50Above", "{pct} above its 50-day line", "{pct} מעל ממוצע 50 הימים");
add("bw.look.now50Below", "{pct} below its 50-day line", "{pct} מתחת לממוצע 50 הימים");
add("bw.look.now200Above", ", {pct} above its 200-day line", ", {pct} מעל ממוצע 200 הימים");
add("bw.look.now200Below", ", {pct} below its 200-day line", ", {pct} מתחת לממוצע 200 הימים");
add("bw.look.trendNeed", "Above both, the 50-day over the 200-day", "מעל שניהם, וממוצע 50 הימים מעל ממוצע 200 הימים");
add("bw.look.waitTrend", "Wait for the trend to turn up: back above its 50-day line, with that line above the 200-day.",
  "לחכות שהמגמה תפנה למעלה: חזרה מעל ממוצע 50 הימים, כשהוא מעל ממוצע 200 הימים.");
add("bw.look.learn", "It is here to read about and learn from, not to act on.", "היא כאן כדי לקרוא וללמוד, לא כדי לפעול לפיה.");
add("bw.look.headline", "Not part of the plan. The site's stock rules read the Nasdaq list only.", "לא חלק מהתוכנית. כללי המניות של האתר קוראים רק את רשימת Nasdaq.");
add("bw.look.nextLook", "No date: neither the weekly game nor the monthly rule looks at this list.", "אין תאריך: לא המשחק השבועי ולא הכלל החודשי בודקים את הרשימה הזאת.");

// a main-list name
add("bw.setup.label", "At least 3 of the 4 quick checks pass", "לפחות 3 מתוך 4 הבדיקות המהירות עוברות");
add("bw.setup.now", "{n} of 4 pass", "{n} מתוך 4 עוברות");
add("bw.setup.need", "3 or more", "3 או יותר");
add("bw.setup.wait", "Wait until at least 3 of the 4 quick checks pass.", "לחכות שלפחות 3 מתוך 4 הבדיקות המהירות יעברו.");
add("bw.main.notAvailable", "Wait. The rules' look is not available yet.", "לחכות. הבדיקה של הכללים עדיין לא זמינה.");
add("bw.main.nextLook", "The weekly game looks on the first trading day of each week (pretend money). Its look at this name appears after the next daily run.",
  "המשחק השבועי בודק ביום המסחר הראשון של כל שבוע (בכסף מדומה). הבדיקה שלו למניה הזאת תופיע אחרי ההרצה היומית הבאה.");
add("bw.main.nextLookBuy", "The weekly game looks on the first trading day of each week (pretend money); the next one is {buy}. Its look at this name appears after the next daily run.",
  "המשחק השבועי בודק ביום המסחר הראשון של כל שבוע (בכסף מדומה); הבדיקה הבאה: {buy}. הבדיקה שלו למניה הזאת תופיע אחרי ההרצה היומית הבאה.");
add("bw.main.waitStale", "The rules' look is from an older close than this page; wait for the next daily run.", "הבדיקה של הכללים היא מסגירה ישנה יותר מהדף הזה; לחכות להרצה היומית הבאה.");
add("bw.main.waitRun", "Wait for the next daily run, which writes the rules' look.", "לחכות להרצה היומית הבאה, שכותבת את הבדיקה של הכללים.");
add("bw.main.allowEarned", "The plan acts only on the rule's review day, never between review days, and only within its limits.",
  "התוכנית פועלת רק ביום הבדיקה של הכלל, אף פעם לא בין ימי בדיקה, ורק בתוך המגבלות שלה.");
add("bw.main.allowPaper", "Every check passes, but only on paper. Real money still waits until a stock rule passes its history test and earns trust; today none has.",
  "כל הבדיקות עוברות, אבל רק על הנייר. כסף אמיתי עדיין מחכה עד שכלל מניות יעבור מבחן היסטורי ויזכה באמון; היום אף כלל עוד לא עשה את זה.");
add("bw.main.nextWeekly", "Next weekly look: {date}, the first trading day of the week (pretend money).", "הבדיקה השבועית הבאה: {date}, יום המסחר הראשון של השבוע (בכסף מדומה).");
add("bw.main.nextWeekFallback", "the first trading day of next week", "יום המסחר הראשון של השבוע הבא");
add("bw.main.nextMonthly", "Next look: {date}, the rule's monthly date (pretend money).", "הבדיקה הבאה: {date}, התאריך החודשי של הכלל (בכסף מדומה).");
add("bw.main.nextQuarterly", "Next look: {date}, the rule's quarterly date (pretend money).", "הבדיקה הבאה: {date}, התאריך הרבעוני של הכלל (בכסף מדומה).");
// headlines: who decides is the weekly game or the monthly rule (both masculine in Hebrew)
add("bw.who.game", "The weekly game", "המשחק השבועי");
add("bw.who.monthly", "The monthly rule", "הכלל החודשי");
add("bw.head.holdsEarned", "{who} holds it, and would keep it.", "{who} מחזיק בה, והיה ממשיך להחזיק בה.");
add("bw.head.holds", "{who} holds it on paper, and would keep it. Real money still waits.", "{who} מחזיק בה על הנייר, והיה ממשיך להחזיק בה. הכסף האמיתי עדיין מחכה.");
add("bw.head.allowEarned", "The rules would allow a small amount on {date}, if nothing changes.", "הכללים היו מאפשרים סכום קטן ב{date}, אם שום דבר לא ישתנה.");
add("bw.head.pick", "{who} would pick it on {date} if nothing changes. Real money still waits.", "{who} היה בוחר בה ב{date}, אם שום דבר לא ישתנה. הכסף האמיתי עדיין מחכה.");
add("bw.head.pickButChecks", "{who} would pick it, but the site's checks say wait.", "{who} היה בוחר בה, אבל הבדיקות של האתר אומרות לחכות.");
add("bw.head.letGoWeek", "Not this week. {who} holds it on paper, but would let it go.", "לא השבוע. {who} מחזיק בה על הנייר, אבל היה מוותר עליה.");
add("bw.head.letGoMonth", "Not this month. {who} holds it on paper, but would let it go.", "לא החודש. {who} מחזיק בה על הנייר, אבל היה מוותר עליה.");
add("bw.head.notPickWeek", "Not this week. {who} would not pick it.", "לא השבוע. {who} לא היה בוחר בה.");
add("bw.head.notPickMonth", "Not this month. {who} would not pick it.", "לא החודש. {who} לא היה בוחר בה.");

// the one short line on the home's company cards (words only, no digits)
add("bw.line.core", "When to buy: every week, in the plan", "מתי קונים: בכל שבוע, לפי התוכנית");
add("bw.line.notPlan", "When to buy: not part of the plan (see why)", "מתי קונים: לא חלק מהתוכנית (ההסבר בפנים)");
add("bw.line.wait", "When to buy: wait (see why)", "מתי קונים: לחכות (ההסבר בפנים)");
add("bw.line.nextLook", "at its next look", "בבדיקה הבאה");
add("bw.line.earnedHeld", "The rule holds it, within the plan's limits (see why)", "הכלל מחזיק בה, בתוך המגבלות של התוכנית (ההסבר בפנים)");
add("bw.line.earned", "The rules would allow a small amount {when} if nothing changes", "הכללים היו מאפשרים סכום קטן {when}, אם שום דבר לא ישתנה");
add("bw.line.held", "{who} holds it on paper; real money waits (see why)", "{who} מחזיק בה על הנייר; הכסף האמיתי מחכה (ההסבר בפנים)");
add("bw.line.pick", "{who} would pick it {when} if nothing changes", "{who} היה בוחר בה {when}, אם שום דבר לא ישתנה");
add("bw.line.notWeek", "When to buy: not this week (see why)", "מתי קונים: לא השבוע (ההסבר בפנים)");
add("bw.line.notMonth", "When to buy: not this month (see why)", "מתי קונים: לא החודש (ההסבר בפנים)");

/* ======================================================== components/brief.jsx: lessons and claims for today */

add("mb.cond.narrow", "A few giants carry the index", "כמה ענקיות סוחבות את המדד");
add("mb.cond.high", "{symbol} is at a 1-year high", "{symbol} בשיא של שנה");
add("mb.cond.stretched", { one: "{list} stretched above trend", other: "{list} stretched above trend" }, { one: "{list} מתוחה מעל המגמה", other: "{list} מתוחות מעל המגמה" });
add("mb.cond.indexStretched", "The index is stretched above its trend", "המדד מתוח מעל המגמה שלו");
add("mb.cond.stressed", "Volatility is stressed", "התנודתיות גבוהה ולחוצה");
add("mb.cond.down", "The trend is down", "המגמה יורדת");
add("mb.cond.filterOff", "The core's slow trend filter is off", "מסנן המגמה האיטי של קרן הליבה כבוי");
add("mb.cond.goal", "The goal: a diverse 4–5 stock portfolio", "המטרה: תיק השקעות מגוון של 4–5 מניות");
add("mb.eyebrow", "From the site's library · picked by code, not made up", "מהספרייה של האתר · נבחר בקוד, לא הומצא");
add("mb.lessons.title", "Lessons that fit today", "שיעורים שמתאימים להיום");
add("mb.lessons.link", "Lessons", "שיעורים");
add("mb.lessons.lede", "In simple words: what the market looks like today, and a lesson from the site's books and videos that fits it.",
  "במילים פשוטות: איך השוק נראה היום, ושיעור שמתאים לזה מהספרים והסרטונים שהאתר לומד מהם.");
add("mb.lessons.none", "No condition stands out today.", "שום מצב לא בולט היום.");
add("mb.claims.title", "What others said about the list's companies", "מה אחרים אמרו על החברות ברשימה");
add("mb.claims.count", { one: "{count} unexpired", other: "{count} unexpired" }, { one: "אחת בתוקף", other: "{count} בתוקף" });
add("mb.claims.lede", "In simple words: things people said, like a weather forecast with a date. Nobody has checked them, so never act on one alone.",
  "במילים פשוטות: דברים שאנשים אמרו, כמו תחזית מזג אוויר עם תאריך. אף אחד לא בדק אותם, ולכן לא לפעול לפי אחד מהם לבד.");
add("mb.claims.none", "No unexpired claims about the list.", "אין טענות בתוקף על הרשימה.");

/* ===================================================== components/checklist.jsx: the chart checklist card */

add("ckc.pill.none", "Chart checklist: appears after the next daily update", "רשימת הבדיקה של הגרף: תופיע אחרי העדכון היומי הבא");
add("ckc.pill.title", "What the chart checklist says (unproven)", "מה רשימת הבדיקה של הגרף אומרת (לא מוכח)");
add("ckc.lean.up", "leans up", "נטייה לעלייה");
add("ckc.lean.down", "leans down", "נטייה לירידה");
add("ckc.lean.none", "no lean", "בלי נטייה");
add("ckc.br.all", "Every snapshot", "כל תמונות המצב");
add("ckc.br.caption", "Looking back: after each reading, how much better or worse than the whole market (the {bench}) the stock did over the next {days} trading days on average, how often it did better, and how many times it was seen. The past is a hint, not a promise.",
  "במבט לאחור: אחרי כל קריאה, בכמה המניה הצליחה יותר או פחות מכל השוק ({bench}) ב-{days} ימי המסחר שאחריה בממוצע, באיזו תדירות היא הצליחה יותר, וכמה פעמים זה נראה. העבר הוא רמז, לא הבטחה.");
add("ckc.br.reading", "Reading", "קריאה");
add("ckc.br.average", "Average", "ממוצע");
add("ckc.br.range", "Likely range", "טווח סביר");
add("ckc.br.better", "Did better", "הצליחה יותר");
add("ckc.br.times", "Times", "פעמים");
add("ckc.br.now", " · now", " · עכשיו");
add("ckc.br.rangeValue", "{lo} to {hi}", "{lo} עד {hi}");
add("ckc.risk.none", "No safety plan: not enough data.", "אין תוכנית ביטחון: אין מספיק נתונים.");
add("ckc.risk.stop", "Safety exit (stop-loss)", "יציאת ביטחון (נקודת יציאה)");
add("ckc.risk.rr", "Win vs lose (reward-to-risk)", "רווח מול הפסד (יחס סיכוי-סיכון)");
add("ckc.risk.rrSub", "to target 1 · to target 2", "עד יעד 1 · עד יעד 2");
add("ckc.risk.tp1", "Target 1 (TP1)", "יעד 1");
add("ckc.risk.tp2", "Target 2 (TP2)", "יעד 2");
add("ckc.risk.fits", "Fits this site's rule (you might win at least {min} times what you might lose, up to target 1): {answer}.",
  "עומדת בכלל של האתר (הרווח האפשרי גדול לפחות פי {min} מההפסד האפשרי, עד יעד 1): {answer}.");
add("ckc.yes", "yes", "כן");
add("ckc.no", "no", "לא");
add("ckc.risk.byConstruction", "There was no ceiling (resistance) above it in the past year, so target 1 was simply set at twice the possible loss. It fits by arithmetic, not because the stock is likely to get there.",
  "בשנה האחרונה לא הייתה מעליה תקרה (רמת התנגדות), ולכן יעד 1 נקבע פשוט בפעמיים ההפסד האפשרי. היא עומדת בכלל בגלל החשבון, לא כי סביר שהמניה תגיע לשם.");
add("ckc.risk.paper", "Pretend money only: a written plan for a make-believe purchase at the last closing price, made before any pretend entry. On a normal day it moves about {atr} (its ATR).",
  "כסף מדומה בלבד: תוכנית כתובה לקנייה דמיונית במחיר הסגירה האחרון, שנכתבת לפני כל כניסה מדומה. ביום רגיל המניה זזה בערך {atr} (ה-ATR שלה).");
add("ckc.title", "Chart checklist", "רשימת הבדיקה של הגרף");
add("ckc.samplePrices", "sample prices", "מחירים לדוגמה");
add("ckc.status.unproven", "unproven", "לא מוכח");
add("ckc.empty.later", "Appears after the next daily update.", "תופיע אחרי העדכון היומי הבא.");
add("ckc.empty.reason", "No checklist for {symbol}: {reason}.", "אין רשימת בדיקה ל-{symbol}: {reason}.");
add("ckc.empty.history", "No checklist for {symbol}: not enough price history.", "אין רשימת בדיקה ל-{symbol}: אין מספיק היסטוריית מחירים.");
add("ckc.empty.what", "In simple words: eight things a trading video says to look at on a stock's chart. A program reads them from each day's closing prices. It is unproven: the site uses it to learn, not to decide. The eight steps:",
  "במילים פשוטות: שמונה דברים שסרטון מסחר אומר לבדוק בגרף של מניה. תוכנה קוראת אותם ממחירי הסגירה של כל יום. זה לא מוכח: האתר משתמש בזה כדי ללמוד, לא כדי להחליט. שמונת השלבים:");
add("ckc.view.label", "Checklist view", "תצוגת רשימת הבדיקה");
add("ckc.view.candles", "Candles", "נרות");
add("ckc.view.checks", "Checks", "בדיקות");
add("ckc.candles.lede", "In simple words: the same eight steps, drawn on the chart up to {date}. Each candle is one day. It describes what happened, like a diary, not a forecast. Unproven: the site uses it to learn, not to decide.",
  "במילים פשוטות: אותם שמונה שלבים, מצוירים על הגרף עד {date}. כל נר הוא יום אחד. זה מתאר מה קרה, כמו יומן, לא תחזית. לא מוכח: האתר משתמש בזה כדי ללמוד, לא כדי להחליט.");
add("ckc.says", "What it says · seven steps", "מה זה אומר · שבעה שלבים");
add("ckc.score", "score {net} of 7", "ציון {net} מתוך 7");
add("ckc.counts", "{up} lean up · {down} lean down · {none} no lean", "{up} לעלייה · {down} לירידה · {none} בלי נטייה");
add("ckc.checks.lede", "In simple words: eight things a trading video says to look at on a stock's chart, read by a program from each day's closing prices up to {date}. Seven of them say \"up\", \"down\" or \"no lean\"; the eighth is a safety plan. It describes the chart, like a weather report of the past weeks, not a forecast. Unproven: the site uses it to learn, not to decide.",
  "במילים פשוטות: שמונה דברים שסרטון מסחר אומר לבדוק בגרף של מניה, שתוכנה קוראת ממחירי הסגירה של כל יום עד {date}. שבעה מהם אומרים \"למעלה\", \"למטה\" או \"בלי נטייה\"; השמיני הוא תוכנית ביטחון. זה מתאר את הגרף, כמו דוח מזג אוויר של השבועות האחרונים, לא תחזית. לא מוכח: האתר משתמש בזה כדי ללמוד, לא כדי להחליט.");
add("ckc.safetyPlan", "Safety plan (pretend money)", "תוכנית ביטחון (כסף מדומה)");
add("ckc.changes", "What changed since the day before", "מה השתנה מאז היום הקודם");
add("ckc.good.title", "Is it any good? Unproven.", "האם זה עובד? לא מוכח.");
add("ckc.good.lookBack", "Looking back at the site's history, {line}", "במבט לאחור על ההיסטוריה של האתר: {line}");
add("ckc.good.later", "Its history appears after the next daily update.", "ההיסטוריה שלה תופיע אחרי העדכון היומי הבא.");
add("ckc.good.realMoney", "The plan's real money follows the Brain's verdicts page, usually one fund that holds the whole market. This site's rules (Before acting, step 1) say no buying on a hunch, from a video or anywhere else. The site only watches and learns here: this checklist is read before a pretend entry, and is never a reason for one.",
  "הכסף האמיתי של התוכנית הולך לפי דף ההכרעות של המוח, בדרך כלל קרן אחת שמחזיקה את כל השוק. כללי האתר (לפני שפועלים, שלב 1) אומרים: לא קונים לפי תחושה, לא מסרטון ולא משום מקום אחר. כאן האתר רק צופה ולומד: רשימת הבדיקה הזאת נקראת לפני כניסה מדומה, ואף פעם לא משמשת סיבה לכניסה.");
add("ckc.good.daily", "The site has only one candle per day, not minute-by-minute. Distances are shown as percent from the last close, never as prices.",
  "לאתר יש רק נר אחד ליום, לא מדקה לדקה. המרחקים מוצגים באחוזים מהסגירה האחרונה, אף פעם לא כמחירים.");
add("ckc.good.how", "How each step works", "איך כל שלב עובד");

/* ================================================================ components/candles.jsx: the candles view */

add("cdv.loading", "Loading the candles…", "טוענים את הנרות…");
add("cdv.none", "The candles appear after the next daily run.", "הנרות יופיעו אחרי ההרצה היומית הבאה.");
add("cdv.noneWhy", "They are written by the same run as the checklist, from the same end-of-day bars. The Checks view has every number meanwhile.",
  "הם נכתבים באותה הרצה כמו רשימת הבדיקה, מאותם נתוני סוף יום. בינתיים כל המספרים נמצאים בתצוגת הבדיקות.");
add("cdv.error", "The candles did not load.", "הנרות לא נטענו.");
add("cdv.retry", "Try again", "לנסות שוב");
add("cdv.window", "Candles window", "טווח הנרות");
add("cdv.older", "These candles are from the {candles} close; the checklist is from {checklist}.", "הנרות האלה הם מהסגירה של {candles}; רשימת הבדיקה היא מ-{checklist}.");
add("cdv.noWindow", "No candles for this window.", "אין נרות לטווח הזה.");
add("cdv.spots.title", "Candles to notice, in simple words", "נרות ששווה לשים לב אליהם, במילים פשוטות");
add("cdv.spots.lede", "The numbers on the chart. Tap one to point at it.", "המספרים על הגרף. הקשה על אחד מהם מסמנת אותו.");
add("cdv.spots.none", "Nothing stands out in this stretch: calm, ordinary days.", "שום דבר לא בולט בתקופה הזאת: ימים רגועים ורגילים.");
add("cdv.chips", "Steps 1 and 2, the candle pattern and the trend, are the candles themselves. Tap a chip to show or hide a step:",
  "שלבים 1 ו-2, תבנית הנר והמגמה, הם הנרות עצמם. הקשה על כפתור מציגה או מסתירה שלב:");
add("cdv.footer", "Percent from the last close, not prices: the price licence lets the site publish only derived numbers. End-of-day data only, so no five-minute candles. The checklist itself is unproven.",
  "אחוזים מהסגירה האחרונה, לא מחירים: רישיון המחירים מתיר לאתר לפרסם רק מספרים נגזרים. רק נתוני סוף יום, ולכן אין נרות של חמש דקות. רשימת הבדיקה עצמה לא מוכחת.");
add("cdv.weekSoFar", "week so far", "השבוע עד עכשיו");
add("cdv.weekPattern", "week so far: {pattern}", "השבוע עד עכשיו: {pattern}");
add("cdv.rsiDays", "RSI 14 days", "מדד RSI, 14 ימים");
add("cdv.rsiWeeks", "RSI 14 weeks", "מדד RSI, 14 שבועות");
add("cdv.volDays", "Volume ÷ 20-day avg", "מחזור ÷ ממוצע 20 ימים");
add("cdv.volWeeks", "Volume ÷ 20-week avg", "מחזור ÷ ממוצע 20 שבועות");
add("cdv.tip.from", "from the last close", "מהסגירה האחרונה");
add("cdv.tip.volume", "Volume", "מחזור");
add("cdv.tip.avg", "{x} avg", "{x} מהממוצע");

/* =================================================================== components/zoom.jsx: candles up close */

add("zm.range.1m", "1 month", "חודש");
add("zm.range.3m", "3 months", "3 חודשים");
add("zm.range.6m", "6 months", "6 חודשים");
add("zm.close", "Close", "סגירה");
add("zm.dialog", "{name}: candles up close", "{name}: הנרות מקרוב");
add("zm.title", "Candles up close", "הנרות מקרוב");
add("zm.howMuch", "How much to show", "כמה להציג");
add("zm.showAll", "← Show all {range}", "→ חזרה לתצוגה המלאה ({range})");
add("zm.noCandles", "No candles for this one yet.", "עדיין אין נרות למניה הזאת.");
add("zm.green", "Green", "ירוק");
add("zm.red", "Red", "אדום");
add("zm.legend.up", "{word}: closed higher than it opened", "{word}: נסגר גבוה ממה שנפתח");
add("zm.legend.down", "{word}: closed lower", "{word}: נסגר נמוך יותר");
add("zm.legend.wicks", "Thin lines: the day's highest and lowest", "קווים דקים: הגבוה והנמוך של היום");
add("zm.spots", "Candles to notice", "נרות ששווה לשים לב אליהם");
add("zm.daily", "The site's prices arrive once a day after the close, so this cannot see moves inside a trading day.",
  "המחירים של האתר מגיעים פעם ביום אחרי הסגירה, ולכן אי אפשר לראות כאן תנועות בתוך יום המסחר.");
add("zm.full", "The full chart with numbers →", "הגרף המלא עם המספרים ←");
add("zm.spot.zoomed", "Zoomed in · tap to go back", "בתצוגה מקרוב · הקשה חוזרת אחורה");
add("zm.spot.zoom", "Tap to zoom in", "הקשה מתקרבת");
add("zm.spot.shown", "Shown on the chart · tap to clear", "מסומן על הגרף · הקשה מנקה");
add("zm.spot.show", "Tap to see it on the chart", "הקשה מראה אותו על הגרף");
add("zm.aria", { one: "{name}: {n} daily candles with {count} marked.", other: "{name}: {n} daily candles with {count} marked." },
  { one: "{name}: {n} נרות יומיים, אחד מהם מסומן.", other: "{name}: {n} נרות יומיים, {count} מהם מסומנים." });
add("zm.spotAria", "{n}: {title}. Zoom in.", "{n}: {title}. התקרבות.");

/* ============================================================== components/charts.jsx: the small charts */

add("ch.spark.indexed", "{n}-day performance indexed to 100, ending at {end}", "ביצועים של {n} ימים, מתחילים ב-100 ומסתיימים ב-{end}");
add("ch.spark.closes", "{n}-day closing prices, from {from} to {to}", "מחירי סגירה של {n} ימים, מ-{from} עד {to}");
add("ch.spark.index", "index", "מדד");
add("ch.excess.aria", "How far each marked guess beat or trailed the whole market, oldest first", "בכמה כל ניחוש שנבדק עקף את כל השוק או פיגר אחריו, מהישן לחדש");
add("ch.excess.dates", "{from} → {to}", "מ-{from} עד {to}");
add("ch.excess.diff", "difference {pct}", "הפרש {pct}");
add("ch.excess.both", "stock {stock} · market {market}", "מניה {stock} · שוק {market}");
add("ch.cost.target", "target {usd}", "יעד {usd}");
add("ch.cost.warn", "warn {usd}", "אזהרה {usd}");
add("ch.cost.aria", "What each run cost in US dollars, with the target line and the warning line", "כמה עלתה כל הרצה בדולרים, עם קו היעד וקו האזהרה");
add("ch.cost.usdMin", "{usd} · {min} min", "{usd} · {min} דק׳");
add("ch.cost.pack", "pack {tokens} / {cap} tokens", "חבילה {tokens} / {cap} טוקנים");
add("ch.cost.over", "over the warning line", "מעל קו האזהרה");

/* ====================================================== components/buywindow.jsx: the card's own words */

add("bwc.mark.met", "met", "מתקיים");
add("bwc.mark.notMet", "not met", "לא מתקיים");
add("bwc.mark.unknown", "not known today", "לא ידוע היום");
add("bwc.now", "Now:", "עכשיו:");
add("bwc.needs", "Needs:", "נדרש:");
add("bwc.nextLook", "Next look {date}", "הבדיקה הבאה: {date}");
add("bwc.title", "When would the rules allow a buy?", "מתי הכללים היו מאפשרים קנייה?");
add("bwc.realMoney", "Real money", "כסף אמיתי");
add("bwc.game", "Pretend money: the weekly game", "כסף מדומה: המשחק השבועי");
add("bwc.ifToday", "If that look were today:", "אם הבדיקה הייתה היום:");
add("bwc.monthly", "Monthly rule:", "הכלל החודשי:");
add("bwc.cond.main", "The site's checks", "הבדיקות של האתר");
add("bwc.cond.today", "The checks today", "הבדיקות היום");
add("bwc.cond.learn", "The checks today (for learning only)", "הבדיקות היום (ללמידה בלבד)");
add("bwc.keepInMind", "Still to keep in mind", "עוד דברים לזכור");
add("bwc.waitFor", "What to wait for", "למה לחכות");
add("bwc.rules", "This site's rules", "כללי האתר");

/* ===================================================================== tabs/Watchlist.jsx: the Stocks list */

add("wl.wait.eyebrow", "Stocks · {label}", "מניות · {label}");
add("wl.wait.loading", "Loading {label}…", "טוענים את {label}…");
add("wl.wait.error", "{label} could not load just now.", "לא הצלחנו לטעון את {label} כרגע.");
add("wl.noPrices", "no prices yet", "עדיין אין מחירים");
add("wl.live", "live · {provider}", "חי · {provider}");
add("wl.title.names", "{n} names,", "{n} מניות,");
add("wl.title.funds", "{n} funds,", "{n} קרנות,");
add("wl.title.accent", "one whole market to compare with.", "ושוק שלם אחד להשוואה.");
add("wl.lede", "In simple words: these are the companies this site keeps an eye on, and how each did lately. {note}{up} of {n} ended the day higher. Each small line shows the last {days} trading days, starting at 100 so they are easy to compare. The site only watches and learns here, with pretend money; this is not a shopping list. It shows how much things went up or down, not raw prices (the price provider's rule).",
  "במילים פשוטות: אלה החברות שהאתר עוקב אחריהן, ואיך כל אחת עשתה לאחרונה. {note}{up} מתוך {n} סיימו את היום בעלייה. כל קו קטן מראה את {days} ימי המסחר האחרונים, ומתחיל ב-100 כדי שיהיה קל להשוות. כאן האתר רק צופה ולומד, בכסף מדומה; זו לא רשימת קניות. הוא מראה בכמה דברים עלו או ירדו, לא מחירים (הכלל של ספק המחירים).");
add("wl.sort", "Sort", "מיון");
add("wl.sort.list", "List order", "סדר הרשימה");
add("wl.sort.gainers", "Gainers", "עולות");
add("wl.sort.losers", "Losers", "יורדות");
add("wl.sort.checks", "Quick checks", "בדיקות מהירות");
add("wl.sort.checklist", "Checklist", "רשימת בדיקה");
add("wl.sort.az", "A–Z", "לפי סימול");
add("wl.col.fund", "Fund · category", "קרן · קטגוריה");
add("wl.col.name", "Name · sector", "שם · ענף");
add("wl.col.days", "{days} days, indexed", "{days} ימים, מ-100");
add("wl.col.checks", "Quick checks · chart checklist · rule", "בדיקות מהירות · רשימת בדיקה · כלל");
add("wl.col.today", "Today", "היום");
add("wl.foot.live", "Quick checks: four yes-or-no questions, like a report card (out of 4). Chart checklist: eight steps from a trading video, read by a program. Unproven: it describes the chart, it does not predict. Rule: what the pretend-money practice rule does with it. Open a name to see more.",
  "בדיקות מהירות: ארבע שאלות של כן או לא, כמו תעודה (מתוך 4). רשימת הבדיקה של הגרף: שמונה שלבים מסרטון מסחר, שתוכנה קוראת. לא מוכח: זה מתאר את הגרף, לא חוזה. כלל: מה כלל התרגול בכסף מדומה עושה איתה. אפשר לפתוח שם כדי לראות עוד.");
add("wl.foot.sample", "Quick checks: four yes-or-no questions, like a report card (out of 4). Chart checklist: eight steps from a trading video, read by a program from sample prices. Unproven: it describes the chart, it does not predict. Rule: what the pretend-money practice rule does with it. Open a name to see more.",
  "בדיקות מהירות: ארבע שאלות של כן או לא, כמו תעודה (מתוך 4). רשימת הבדיקה של הגרף: שמונה שלבים מסרטון מסחר, שתוכנה קוראת ממחירים לדוגמה. לא מוכח: זה מתאר את הגרף, לא חוזה. כלל: מה כלל התרגול בכסף מדומה עושה איתה. אפשר לפתוח שם כדי לראות עוד.");
add("wl.foot.none", "Quick checks: four yes-or-no questions, like a report card (out of 4). Chart checklist leans (up, mixed, down) appear after the next daily update.",
  "בדיקות מהירות: ארבע שאלות של כן או לא, כמו תעודה (מתוך 4). הנטיות של רשימת הבדיקה (עלייה, מעורב, ירידה) יופיעו אחרי העדכון היומי הבא.");
add("wl.open", "Open {symbol}", "פתיחת {symbol}");
add("wl.wholeMarket", "whole market", "כל השוק");
add("wl.wholeMarketDot", "Whole market · ", "כל השוק · ");
add("wl.noData", "no data", "אין נתונים");
add("wl.checksTitle", "{n} of 4 quick checks pass", "{n} מתוך 4 הבדיקות המהירות עוברות");
add("wl.20days", "20 days", "20 ימים");
add("wl.ranUp", "ran up fast", "עלתה מהר");
add("wl.ranUpTitle", "It ran up too fast", "היא עלתה מהר מדי");
add("wl.mood.calm", "calm", "רגוע");
add("wl.mood.normal", "normal", "רגיל");
add("wl.mood.stressed", "stressed", "סוער");
add("wl.mood.label", "market mood · {bench}", "מצב הרוח בשוק · {bench}");
add("wl.mood.desc", "Like a weather report for the whole market ({bench}): calm, normal or stormy. As of {date}, worked out by a program from the whole market's closing values.",
  "כמו תחזית מזג אוויר לכל השוק ({bench}): רגוע, רגיל או סוער. נכון ל-{date}, חושב בתוכנה מערכי הסגירה של כל השוק.");
add("wl.dir.up", "up", "עולה");
add("wl.dir.sideways", "sideways", "הצידה");
add("wl.dir.down", "down", "יורד");
add("wl.dir.label", "direction · {days} days", "כיוון · {days} ימים");
add("wl.dir.descRising", "The whole market is {dist} from its usual level lately (its {days}-day average), and that level is rising {slope} over {slopeDays} days.",
  "כל השוק נמצא {dist} מהרמה הרגילה שלו לאחרונה (ממוצע {days} הימים), והרמה הזאת עולה {slope} ב-{slopeDays} ימים.");
add("wl.dir.descFalling", "The whole market is {dist} from its usual level lately (its {days}-day average), and that level is falling {slope} over {slopeDays} days.",
  "כל השוק נמצא {dist} מהרמה הרגילה שלו לאחרונה (ממוצע {days} הימים), והרמה הזאת יורדת {slope} ב-{slopeDays} ימים.");
add("wl.vol.label", "how much it jumps around", "כמה הוא קופץ");
add("wl.vol.desc", "How bumpy the whole market's daily moves were over the last {days} days, scaled to a year (its volatility). Higher means a bumpier ride.",
  "כמה היו קופצניות התנועות היומיות של כל השוק ב-{days} הימים האחרונים, בחישוב שנתי (התנודתיות שלו). גבוה יותר אומר נסיעה קופצנית יותר.");
add("wl.dd.label", "from its high", "מהשיא");
add("wl.dd.desc", "How far the whole market is below its highest close of the last {days} trading days.", "כמה כל השוק נמצא מתחת לסגירה הגבוהה ביותר שלו ב-{days} ימי המסחר האחרונים.");
add("wl.above.value", "{above} of {total}", "{above} מתוך {total}");
add("wl.above.label", "above their usual level", "מעל הרמה הרגילה שלהן");
add("wl.above.desc", "How many of the list's names sit above their usual level lately (their 50-day average). Only the list's names: the wider picture is on Today.",
  "כמה מהמניות ברשימה נמצאות מעל הרמה הרגילה שלהן לאחרונה (ממוצע 50 הימים). רק המניות ברשימה: התמונה הרחבה נמצאת בדף היום.");
// The practice portfolio rule's status (components/goal.jsx STATUS, English there)
add("st.status.kept", "Held", "מוחזקת");
add("st.status.added", "New this month", "חדשה החודש");
add("st.status.fails_checks", "Did not pass the checks", "לא עברה את הבדיקות");
add("st.status.stretched", "Rose too fast: wait", "עלתה מהר מדי: לחכות");
add("st.status.slots_full", "No free seat", "אין מקום פנוי");
add("st.status.sector_cap", "Its industry already has 2", "בענף שלה כבר יש 2");
add("st.status.too_correlated", "Moves like one already held", "זזה כמו מניה שכבר מוחזקת");
add("st.status.no_history", "Too new to judge", "חדשה מדי כדי לשפוט");

/* ======================================================================== tabs/Stock.jsx: one stock's page */

// "In plain words" (assembled by code from the numbers)
add("sp.pw.monthUp", "Over the last month {symbol} went up {pct}.", "בחודש האחרון {symbol} עלתה {pct}.");
add("sp.pw.monthDown", "Over the last month {symbol} went down {pct}.", "בחודש האחרון {symbol} ירדה {pct}.");
add("sp.pw.better", "That is {pts} points better than the whole market (the {bench}).", "זה טוב ב-{pts} נקודות מכל השוק ({bench}).");
add("sp.pw.worse", "That is {pts} points worse than the whole market (the {bench}).", "זה חלש ב-{pts} נקודות מכל השוק ({bench}).");
add("sp.pw.above", "It sits above its usual level lately (its average over the last 50 days), so the trend is up.",
  "היא נמצאת מעל הרמה הרגילה שלה לאחרונה (הממוצע של 50 הימים האחרונים), ולכן המגמה עולה.");
add("sp.pw.below", "It sits below its usual level lately (its average over the last 50 days), so the trend is weak.",
  "היא נמצאת מתחת לרמה הרגילה שלה לאחרונה (הממוצע של 50 הימים האחרונים), ולכן המגמה חלשה.");
add("sp.pw.stretched", "It ran up too fast: it is {pct} above that usual level. Like a ball thrown up high, a stock that sprints often slips back for a while, so getting in now often means getting in just before a dip.",
  "היא עלתה מהר מדי: היא נמצאת {pct} מעל הרמה הרגילה הזאת. כמו כדור שנזרק גבוה, מניה שדוהרת חוזרת לעיתים קרובות קצת אחורה, ולכן כניסה עכשיו היא לעיתים קרובות כניסה רגע לפני ירידה.");
add("sp.pw.nearHigh", "It is close to its highest point of the past year. That alone is not a reason to sell, or to buy.",
  "היא קרובה לנקודה הגבוהה ביותר שלה בשנה האחרונה. זו לבדה לא סיבה למכור, וגם לא לקנות.");
add("sp.pw.farBelow", "It sits {pct} below its highest point of the past year. A big fall alone is not a reason to buy: cheap things can get cheaper.",
  "היא נמצאת {pct} מתחת לנקודה הגבוהה ביותר שלה בשנה האחרונה. ירידה גדולה לבדה היא לא סיבה לקנות: דברים זולים יכולים להיות עוד יותר זולים.");
add("sp.pw.checks4", "All four quick checks pass. Think of a good report card: nice to see, but not a reason to buy on its own.",
  "כל ארבע הבדיקות המהירות עוברות. כמו תעודה טובה: נעים לראות, אבל זו לא סיבה לקנות בפני עצמה.");
add("sp.pw.checks3", "Three of the four quick checks pass.", "שלוש מתוך ארבע הבדיקות המהירות עוברות.");
add("sp.pw.checks2", "Only two of the four quick checks pass: a mixed picture.", "רק שתיים מתוך ארבע הבדיקות המהירות עוברות: תמונה מעורבת.");
add("sp.pw.checksFew", "Most quick checks fail: one to watch and learn from, nothing more.", "רוב הבדיקות המהירות לא עוברות: מניה לעקוב אחריה וללמוד ממנה, לא יותר.");
add("sp.pw.rateBetter", {
  one: "Looking back at {from}–{to}, stocks with {n} of 4 went on to do {pts} points better than the whole market over the next {days} days, on average ({count} case). The past is a hint, not a promise.",
  other: "Looking back at {from}–{to}, stocks with {n} of 4 went on to do {pts} points better than the whole market over the next {days} days, on average ({count} cases). The past is a hint, not a promise.",
}, {
  one: "במבט לאחור על {from}–{to}, מניות עם {n} מתוך 4 עשו אחר כך טוב מכל השוק ב-{pts} נקודות בממוצע ב-{days} הימים שאחרי (מקרה אחד). העבר הוא רמז, לא הבטחה.",
  other: "במבט לאחור על {from}–{to}, מניות עם {n} מתוך 4 עשו אחר כך טוב מכל השוק ב-{pts} נקודות בממוצע ב-{days} הימים שאחרי ({count} מקרים). העבר הוא רמז, לא הבטחה.",
});
add("sp.pw.rateWorse", {
  one: "Looking back at {from}–{to}, stocks with {n} of 4 went on to do {pts} points worse than the whole market over the next {days} days, on average ({count} case). The past is a hint, not a promise.",
  other: "Looking back at {from}–{to}, stocks with {n} of 4 went on to do {pts} points worse than the whole market over the next {days} days, on average ({count} cases). The past is a hint, not a promise.",
}, {
  one: "במבט לאחור על {from}–{to}, מניות עם {n} מתוך 4 עשו אחר כך פחות טוב מכל השוק ב-{pts} נקודות בממוצע ב-{days} הימים שאחרי (מקרה אחד). העבר הוא רמז, לא הבטחה.",
  other: "במבט לאחור על {from}–{to}, מניות עם {n} מתוך 4 עשו אחר כך פחות טוב מכל השוק ב-{pts} נקודות בממוצע ב-{days} הימים שאחרי ({count} מקרים). העבר הוא רמז, לא הבטחה.",
});
add("sp.pw.claims", { one: "{count} recent claim from the people the site learns from mentions it (not checked yet, see below).", other: "{count} recent claims from the people the site learns from mention it (not checked yet, see below)." },
  { one: "טענה אחת מהזמן האחרון, מהאנשים שהאתר לומד מהם, מזכירה אותה (עוד לא נבדקה, פירוט למטה).", other: "{count} טענות מהזמן האחרון, מהאנשים שהאתר לומד מהם, מזכירות אותה (עוד לא נבדקו, פירוט למטה)." });

// "Would the rules allow it?" (pretend money)
add("st.stage.0", "Observe", "צפייה");
add("st.stage.1", "Paper", "על הנייר");
add("st.stage.2", "Small money", "כסף קטן");
add("st.stage.3", "Trusted", "אמון מלא");
add("sp.gate.trusted", "Trust stage {stage} ({name}): the brain has earned some trust, but the site still only watches and learns here",
  "שלב אמון {stage} ({name}): המוח זכה לקצת אמון, אבל כאן האתר עדיין רק צופה ולומד");
add("sp.gate.untrusted", "Trust stage {stage} ({name}): the brain has not earned trust yet, so pretend money only",
  "שלב אמון {stage} ({name}): המוח עוד לא זכה באמון, ולכן רק כסף מדומה");
add("sp.gate.held", "The pretend-money portfolio rule holds it", "כלל התיק בכסף מדומה מחזיק בה");
add("sp.gate.left", "The pretend-money portfolio rule leaves it out: {status}", "כלל התיק בכסף מדומה משאיר אותה בחוץ: {status}");
add("sp.gate.noRule", "The pretend-money portfolio rule has not run yet", "כלל התיק בכסף מדומה עוד לא רץ");
add("sp.gate.stretched", "It ran up too fast: the rules say no new pretend buys", "היא עלתה מהר מדי: הכללים אומרים שאין קניות מדומות חדשות");
add("sp.gate.checks", "{passed} of 4 quick checks pass (the rules need 3)", "{passed} מתוך 4 הבדיקות המהירות עוברות (הכללים דורשים 3)");
add("sp.gate.title", "Would the rules allow it? (pretend money)", "האם הכללים היו מאפשרים? (כסף מדומה)");
add("sp.gate.titleOther", "Would the rules allow it?", "האם הכללים היו מאפשרים?");
add("sp.gate.yes", "On paper, yes.", "על הנייר, כן.");
add("sp.gate.no", "Not yet.", "עוד לא.");
add("sp.gate.lede", "The site only watches and learns with pretend money here. The plan's real money follows the Brain's verdicts page, usually one fund that holds the whole market.",
  "כאן האתר רק צופה ולומד, בכסף מדומה. הכסף האמיתי של התוכנית הולך לפי דף ההכרעות של המוח, בדרך כלל קרן אחת שמחזיקה את כל השוק.");
add("sp.notPlan", "Not part of the plan.", "לא חלק מהתוכנית.");
add("sp.nasdaqOnly", "This site's rules, its pretend-money practice portfolio and the daily brain only follow the Nasdaq list. So there is no pretend-money plan for this one. It is here to read about and learn from, not to act on.",
  "כללי האתר, תיק התרגול בכסף מדומה והמוח היומי עוקבים רק אחרי רשימת Nasdaq. לכן אין למניה הזאת תוכנית בכסף מדומה. היא כאן כדי לקרוא וללמוד, לא כדי לפעול לפיה.");

// the brain's guess in everyday words
add("sp.stance.bullish", "Leans up", "נטייה לעלייה");
add("sp.stance.bearish", "Leans down", "נטייה לירידה");
add("sp.stance.neutral", "No lean", "בלי נטייה");
add("sp.sure.low", "not very sure", "בלי הרבה ביטחון");
add("sp.sure.medium", "fairly sure", "בביטחון בינוני");
add("sp.sure.high", "quite sure", "בביטחון גבוה");
add("sp.range.21", "1M", "חודש");
add("sp.range.63", "3M", "3 ח׳");
add("sp.range.126", "6M", "6 ח׳");
add("sp.range.252", "1Y", "שנה");

// the four quick checks
add("sp.setup.trend", "Heading up (above its usual level lately)", "בכיוון למעלה (מעל הרמה הרגילה שלה לאחרונה)");
add("sp.setup.trendDetail", "{d50} vs its 50-day average, {dLong} vs its {days}-day average", "{d50} ביחס לממוצע 50 הימים, {dLong} ביחס לממוצע {days} הימים");
add("sp.setup.trendDetail50", "{d50} vs its 50-day average", "{d50} ביחס לממוצע 50 הימים");
add("sp.setup.rs3", "Doing better than the whole market ({bench}) · 3 months", "מצליחה יותר מכל השוק ({bench}) · 3 חודשים");
add("sp.setup.rs6", "Doing better than the whole market ({bench}) · 6 months", "מצליחה יותר מכל השוק ({bench}) · 6 חודשים");
add("sp.setup.rsDetail", "{pct} over {days} days", "{pct} ב-{days} ימים");
add("sp.setup.calm", "Has not run up too fast", "לא עלתה מהר מדי");
add("sp.setup.calmDetail", "{d50} above its 50-day average (limit {limit})", "{d50} מעל ממוצע 50 הימים (הגבול: {limit})");
add("sp.setup.calmDetailVeto", "{d50} above its 50-day average (limit {limit}). Failing this blocks new pretend buys", "{d50} מעל ממוצע 50 הימים (הגבול: {limit}). מי שלא עוברת את זה לא נכנסת לקניות מדומות חדשות");
add("sp.lesson.ranUp", "Ran up too fast", "עלתה מהר מדי");
add("sp.lesson.below", "Below its usual level lately", "מתחת לרמה הרגילה שלה לאחרונה");
add("sp.lesson.better6", "Doing better than the whole market over 6 months", "מצליחה יותר מכל השוק ב-6 חודשים");
add("sp.lesson.worse6", "Doing worse than the whole market over 6 months", "מצליחה פחות מכל השוק ב-6 חודשים");
add("sp.lesson.high", "At its highest point of the past year", "בנקודה הגבוהה ביותר שלה בשנה האחרונה");
add("sp.lesson.farBelow", "Far below its high point", "רחוק מתחת לשיא שלה");

// opening a page
add("sp.thisMarket", "this market", "השוק הזה");
add("sp.opening", "Opening {symbol}…", "פותחים את {symbol}…");
add("sp.loadError", "{label} could not load just now", "לא הצלחנו לטעון את {label} כרגע");
add("sp.nightly", "Its numbers appear after the next nightly run.", "המספרים שלה יופיעו אחרי ההרצה הלילית הבאה.");
add("sp.notListed.title", "{symbol} is not on any of the site's lists", "{symbol} לא נמצאת באף אחת מהרשימות של האתר");
add("sp.notListed.body", "The site only shows stocks on its lists. Once it is added to one, it shows up here the morning after.",
  "האתר מציג רק מניות שברשימות שלו. אחרי שהיא תתווסף לאחת מהן, היא תופיע כאן למחרת בבוקר.");
add("sp.notOnList.title", "{symbol} is not on the list", "{symbol} לא נמצאת ברשימה");
add("sp.notOnList.body", "The site only shows stocks on its list. Once it is added (in config/watchlist.json), it shows up here after the next daily update.",
  "האתר מציג רק מניות שברשימה שלו. אחרי שהיא תתווסף (בקובץ config/watchlist.json), היא תופיע כאן אחרי העדכון היומי הבא.");

// the page's header and cards
add("sp.back", "Stocks", "מניות");
add("sp.backList", "{label} list", "רשימת {label}");
add("sp.zoomLede", "Zoom in and see which days are worth noticing, and why.", "להתקרב ולראות אילו ימים שווה לשים לב אליהם, ולמה.");
add("sp.checklistPill", "Checklist", "רשימת בדיקה");
add("sp.inside", "What's inside", "מה יש בפנים");
add("sp.next.title", "What's next", "מה הלאה");
add("sp.passedTitle", "Quick checks passed", "בדיקות מהירות שעברו");
add("sp.reportCard", "a report card, not advice", "תעודה, לא ייעוץ");
add("sp.plain.title", "In plain words", "במילים פשוטות");
add("sp.plain.foot", "Written by a simple program from the numbers below, not by an AI. It describes; it does not predict.", "נכתב בתוכנה פשוטה מהמספרים שלמטה, לא בבינה מלאכותית. זה מתאר; זה לא חוזה.");
add("sp.strip.20d", "last 20 days", "20 הימים האחרונים");
add("sp.strip.vs", "vs the whole market ({bench})", "מול כל השוק ({bench})");
add("sp.strip.60d", "last 60 days", "60 הימים האחרונים");
add("sp.strip.drop", "its biggest drop, past year", "הירידה הגדולה ביותר, בשנה האחרונה");
add("sp.strip.fromHigh", "from its high of the past year", "מהשיא של השנה האחרונה");
add("sp.strip.vol", "how much it jumps around (a year)", "כמה היא קופצת (בשנה)");
add("sp.long.title", "Against the {goal} a year goal", "מול היעד של {goal} בשנה");
add("sp.long.span", "{from} to {to} · looking back is easy", "{from} עד {to} · קל להסתכל אחורה");
add("sp.long.lede", "In simple words: how this stock did in the past, year by year. Like old weather records, it tells you what has happened, not what will.",
  "במילים פשוטות: איך המניה הזאת עשתה בעבר, שנה אחרי שנה. כמו רישומי מזג אוויר ישנים, זה מספר מה קרה, לא מה יקרה.");
add("sp.long.cagr", "a year, on average", "בשנה, בממוצע");
add("sp.long.hit", "of 12-month stretches made {goal} or more", "מתקופות של 12 חודשים הרוויחו {goal} או יותר");
add("sp.long.loss", "of 12-month stretches lost money", "מתקופות של 12 חודשים הפסידו כסף");
add("sp.long.worst", "worst 12 months", "12 החודשים הגרועים ביותר");
add("sp.long.dd", "its biggest drop from a high point", "הירידה הגדולה ביותר שלה מנקודת שיא");
add("sp.long.held", "of months the pretend-money rule held it", "מהחודשים שבהם כלל הכסף המדומה החזיק בה");
add("sp.long.risk", "How much it jumps around: about {vol} a year over the last year. When the whole market ({bench}) moves 1%, this one has tended to move about {beta} (its beta). In a bad month, the kind that comes about 1 in 20 months, it could lose about {loss}. That is why the site only practises with pretend money.",
  "כמה היא קופצת: בערך {vol} בשנה, בשנה האחרונה. כשכל השוק ({bench}) זז ב-1%, המניה הזאת נטתה לזוז בערך {beta} (הבטא שלה). בחודש רע, מהסוג שמגיע בערך פעם ב-20 חודשים, היא יכולה להפסיד בערך {loss}. לכן האתר מתרגל רק בכסף מדומה.");
add("sp.checks.title", "Quick checks", "בדיקות מהירות");
add("sp.checks.count", "{passed} of 4 pass", "{passed} מתוך 4 עוברות");
add("sp.checks.lede", "Four simple yes-or-no questions, like a report card. They describe how the stock looks today; they do not tell you what to do.",
  "ארבע שאלות פשוטות של כן או לא, כמו תעודה. הן מתארות איך המניה נראית היום; הן לא אומרות מה לעשות.");
add("sp.checks.pass", "pass", "עוברת");
add("sp.checks.fail", "fail", "לא עוברת");
add("sp.lessons.title", "Lessons in play", "שיעורים שרלוונטיים עכשיו");
add("sp.lessons.lede", "Ideas from the books and people the site learns from that fit how this stock looks right now.", "רעיונות מהספרים ומהאנשים שהאתר לומד מהם, שמתאימים לאיך שהמניה נראית עכשיו.");
add("sp.lessons.none", "No lesson fits how this stock looks right now.", "אין שיעור שמתאים לאיך שהמניה נראית עכשיו.");
add("sp.guess.eyebrow", "The brain's guess", "הניחוש של המוח");
add("sp.guess.sampleA", "Guesses start with", "הניחושים מתחילים ב-");
add("sp.guess.noneA", "No guess", "אין ניחוש");
add("sp.guess.noneB", "yet.", "עדיין.");
add("sp.guess.conviction", "{level} conviction", "רמת ביטחון: {level}");
add("sp.guess.samplePill", "sample history below", "היסטוריה לדוגמה למטה");
add("sp.guess.sample", "The brain is not running yet. When it does, its latest guess on {symbol} goes here: which way it leans, why, what could go wrong, and what would prove it wrong. After {days} trading days a program marks it right or wrong, like a teacher marking homework. The history below is {made} so you can see what it will look like.",
  "המוח עוד לא רץ. כשהוא ירוץ, הניחוש האחרון שלו על {symbol} יופיע כאן: לאיזה כיוון הוא נוטה, למה, מה יכול להשתבש ומה יוכיח שהוא טועה. אחרי {days} ימי מסחר תוכנה מסמנת אותו כנכון או לא נכון, כמו מורה שבודקת שיעורי בית. ההיסטוריה שלמטה היא {made}, כדי שאפשר יהיה לראות איך זה ייראה.");
add("sp.guess.made", "made-up sample data", "נתונים לדוגמה שהומצאו");
add("sp.guess.wrongIf", "Proved wrong if", "יתברר כטעות אם");
add("sp.guess.emptyTitle", "No guesses on this one", "אין ניחושים על המניה הזאת");
add("sp.guess.emptyBody", "The brain has not said anything about it yet.", "המוח עוד לא אמר עליה כלום.");
add("sp.people.eyebrow", "From the people the site learns from", "מהאנשים שהאתר לומד מהם");
add("sp.people.titleA", "What was said", "מה נאמר");
add("sp.people.titleB", "about {symbol}.", "על {symbol}.");
add("sp.people.counts", "{live} recent · {old} too old to count", "{live} מהזמן האחרון · {old} ישנות מדי");
add("sp.people.tooOld", "too old", "ישנה מדי");
add("sp.claim.unverified", "unverified", "לא נבדקה");
add("sp.claim.confirmed", "confirmed", "אושרה");
add("sp.claim.contradicted", "contradicted", "הופרכה");
add("sp.people.emptyTitle", "Nothing yet", "עדיין כלום");
add("sp.people.emptyBody", "None of the people the site learns from has said something about {symbol} that could be checked later.",
  "אף אחד מהאנשים שהאתר לומד מהם עוד לא אמר על {symbol} משהו שאפשר לבדוק אחר כך.");
add("sp.foot", "The site only watches and learns here. Lines start at 100 so they are easy to compare; the site shows how much things went up or down, not raw prices.",
  "כאן האתר רק צופה ולומד. הקווים מתחילים ב-100 כדי שיהיה קל להשוות; האתר מראה בכמה דברים עלו או ירדו, לא מחירים.");

// "<Company> in short"
add("sp.neutral", "neutral", "ניטרלי");
add("sp.benchThe", "the {label}", "מדד {label}");
add("sp.brief.nextNone", "Next results: not announced yet.", "הדוחות הבאים: עוד לא הוכרזו.");
add("sp.brief.nextOut", "New results are out since this was written; the card is due a refresh.", "מאז שזה נכתב יצאו דוחות חדשים; הכרטיס צריך רענון.");
add("sp.brief.next", "Next results: {when}.", "הדוחות הבאים: {when}.");
add("sp.brief.nextExpected", "Next results: {when} (expected).", "הדוחות הבאים: {when} (צפוי).");
add("sp.brief.aria", "{name} in short", "{name} בקצרה");
add("sp.brief.eyebrow", "{symbol} · the eight-step chart checklist", "{symbol} · רשימת הבדיקה של הגרף, בשמונה שלבים");
add("sp.brief.inShort", "in short.", "בקצרה.");
add("sp.brief.upDown", "Going up or down?", "עולה או יורדת?");
add("sp.brief.notForecast", "This describes the chart so far, like saying it rained this week. It is not a forecast.", "זה מתאר את הגרף עד עכשיו, כמו להגיד שירד גשם השבוע. זו לא תחזית.");
add("sp.brief.seeCandles", "See it on the candles", "לראות את זה על הנרות");
add("sp.brief.eight", "The eight checks (unproven)", "שמונה הבדיקות (לא מוכחות)");
add("sp.brief.eightLooks", "The eight things it looks at:", "שמונת הדברים שהיא בודקת:");
add("sp.brief.pretendOnly", "Pretend money only", "כסף מדומה בלבד");
add("sp.brief.allow", "Would the rules allow a pretend buy?", "האם הכללים היו מאפשרים קנייה מדומה?");
add("sp.brief.whyNot", "Why not:", "למה לא:");
add("sp.brief.change", "What would change it:", "מה ישנה את זה:");
add("sp.brief.rule", "This site's rule: three of the four quick checks pass, the stock has not run up too fast, and what you might win is at least {min} times what you might lose (the first target is {min} times as far away as the safety exit). Pretend money only: the site only watches and learns. A monthly rule decides what the pretend practice portfolio holds; the plan's real money follows the Brain's verdicts page.",
  "הכלל של האתר: שלוש מתוך ארבע הבדיקות המהירות עוברות, המניה לא עלתה מהר מדי, והרווח האפשרי גדול לפחות פי {min} מההפסד האפשרי (היעד הראשון רחוק פי {min} מיציאת הביטחון). כסף מדומה בלבד: האתר רק צופה ולומד. כלל חודשי מחליט מה יש בתיק התרגול המדומה; הכסף האמיתי של התוכנית הולך לפי דף ההכרעות של המוח.");
add("sp.brief.fundLater", "Its short description appears with the next update.", "התיאור הקצר שלה יופיע בעדכון הבא.");
add("sp.brief.company", "What's happening at the company", "מה קורה בחברה");
add("sp.brief.noCard", "No company card yet. The site writes one after each round of company results (every three months).", "עדיין אין כרטיס חברה. האתר כותב אחד אחרי כל סבב דוחות (כל שלושה חודשים).");

// what's next, the fund card, the company's numbers, its news, why it moved
add("sp.source", "source", "מקור");
add("sp.stale.out", "New results are out since this was written; due for a refresh.", "מאז שזה נכתב יצאו דוחות חדשים; צריך רענון.");
add("sp.stale.passed", "Its expected results date ({date}) has passed; this card may be out of date.", "תאריך הדוחות הצפוי ({date}) כבר עבר; ייתכן שהכרטיס הזה לא מעודכן.");
add("sp.stale.probably", "Newer results are probably out; this card may be out of date.", "כנראה שיצאו כבר דוחות חדשים יותר; ייתכן שהכרטיס הזה לא מעודכן.");
add("sp.inside.checked", "checked {date}", "נבדק ב-{date}");
add("sp.inside.none", "No fund card for {symbol} yet. A fund is one basket holding many companies. Cards come from each fund's own page: what is in the basket, the list it copies and what it costs each year.",
  "עדיין אין כרטיס קרן ל-{symbol}. קרן היא סל אחד שמחזיק הרבה חברות. הכרטיסים נכתבים מהדף של כל קרן: מה יש בסל, איזו רשימה היא מעתיקה וכמה היא עולה בכל שנה.");
add("sp.inside.holds", "It holds", "מה היא מחזיקה");
add("sp.inside.index", "The list it copies (its index)", "הרשימה שהיא מעתיקה (המדד שלה)");
add("sp.inside.cost", "Yearly cost", "עלות שנתית");
add("sp.inside.notListed", "Not listed", "לא מפורסם");
add("sp.inside.costWhat", "The share of the money the fund keeps each year to run itself; lower is better.", "החלק מהכסף שהקרן לוקחת בכל שנה כדי לנהל את עצמה; נמוך יותר עדיף.");
add("sp.inside.from", "From the fund's own page", "מהדף של הקרן עצמה");
add("sp.inside.foot", "A fund card describes the fund, like the label on a food packet. It is not a forecast and not a reason to buy or sell.", "כרטיס קרן מתאר את הקרן, כמו התווית על אריזת מזון. הוא לא תחזית ולא סיבה לקנות או למכור.");
add("sp.numbers.title", "How the business is doing, by its own numbers", "איך העסק מתפקד, לפי המספרים שלו");
add("sp.numbers.stale", "These are old: no newer filing was found.", "המספרים האלה ישנים: לא נמצא דיווח רשמי חדש יותר.");
add("sp.numbers.foot", "This is about the business, not the stock. A great bakery can still be a bad deal if you pay far too much for it.", "זה על העסק, לא על המניה. גם מאפייה מצוינת יכולה להיות עסקה גרועה אם משלמים עליה הרבה יותר מדי.");
add("sp.news.title", "Official news from the company", "חדשות רשמיות מהחברה");
add("sp.news.lede", "What it told regulators lately (its SEC filings). Straight from the company, not rumours: tap one to read the filing itself.", "מה היא דיווחה לרגולטורים לאחרונה (הדיווחים הרשמיים שלה ל-SEC). ישר מהחברה, לא שמועות: הקשה על אחד פותחת את הדיווח עצמו.");
add("sp.news.form", "{day} · form {form} ↗", "{day} · טופס {form} ↗");
add("sp.news.foot", "News explains a move after it happens; it is not a reason to buy or sell on its own.", "חדשות מסבירות תנועה אחרי שהיא קורית; הן לא סיבה לקנות או למכור בפני עצמן.");
add("sp.why.title", "Why it moved", "למה המניה זזה");
add("sp.why.lede", "Its unusual days of the last month, and what trusted sources said caused them. The size of each move is from the site's own data.", "הימים החריגים שלה בחודש האחרון, ומה מקורות אמינים אמרו שגרם להם. הגודל של כל תנועה הוא מהנתונים של האתר עצמו.");
add("sp.next.noCard", "No card for {symbol} yet.", "עדיין אין כרטיס ל-{symbol}.");
add("sp.next.noCards", "No cards yet.", "עדיין אין כרטיסים.");
add("sp.next.how", "The site writes them after each round of company results (every three months), from what the company itself published: its last three months, what it expects next, when its next results come out and what is coming up, each with a link.",
  "האתר כותב אותם אחרי כל סבב דוחות (כל שלושה חודשים), ממה שהחברה עצמה פרסמה: שלושת החודשים האחרונים שלה, מה היא מצפה שיקרה, מתי יוצאים הדוחות הבאים ומה צפוי, כל דבר עם קישור.");
add("sp.next.reported", "reported {date}", "דווח ב-{date}");
add("sp.next.researched", "researched {date}", "נחקר ב-{date}");
add("sp.next.money", "Money · {period}", "כסף · {period}");
add("sp.next.sales", "Sales (revenue) {revenue}", "מכירות (הכנסות): {revenue}");
add("sp.next.outlook", "The company's own outlook", "התחזית של החברה עצמה");
add("sp.next.outlookPeriod", "The company's own outlook · {period}", "התחזית של החברה עצמה · {period}");
add("sp.next.resultsNews", "Next results and news", "הדוחות הבאים וחדשות");
add("sp.next.results", "Next results", "הדוחות הבאים");
add("sp.next.expected", "expected", "צפוי");
add("sp.next.notAnnounced", "Not announced yet", "עוד לא הוכרזו");
add("sp.next.ahead", "Ahead", "בהמשך");
add("sp.next.recently", "Recently", "לאחרונה");
add("sp.next.other", "Recent news and what's ahead", "חדשות אחרונות ומה צפוי");
add("sp.next.watch", "What could change the picture", "מה יכול לשנות את התמונה");
add("sp.next.noRisks", "No risks noted from the company's own reports yet.", "עדיין לא צוינו סיכונים מהדוחות של החברה עצמה.");
add("sp.next.foot", "What the company says about itself, in the site's words, with links. The site does not vouch for it and it is not a forecast. No prices, price targets or ratings. On a results day a stock can jump a lot either way, like weather on a stormy day; that is not a signal.",
  "מה שהחברה אומרת על עצמה, במילים של האתר, עם קישורים. האתר לא ערב לזה, וזו לא תחזית. בלי מחירים, בלי מחירי יעד ובלי דירוגים. ביום דוחות מניה יכולה לקפוץ הרבה לכל כיוון, כמו מזג אוויר ביום סוער; זה לא סימן לשום דבר.");

// the stock's line chart
add("sp.chart.lede", "In simple words: every line starts at 100 on the left, like runners on one start line. A line ending at 110 went up 10%.", "במילים פשוטות: כל קו מתחיל ב-100 בצד שמאל, כמו רצים על אותו קו זינוק. קו שמסתיים ב-110 עלה 10%.");
add("sp.chart.ledeBench", "The dashed line is the whole market, so you can see who is ahead.", "הקו המקווקו הוא כל השוק, כדי שאפשר יהיה לראות מי מקדים.");
add("sp.chart.whole", "whole market ({bench})", "כל השוק ({bench})");
add("sp.chart.usual", "usual level lately (50-day average)", "הרמה הרגילה לאחרונה (ממוצע 50 הימים)");
add("sp.chart.range", "Range", "טווח");
add("sp.chart.aria", "{symbol} over {n} trading days, indexed to 100", "{symbol} לאורך {n} ימי מסחר, מתחיל ב-100");
add("sp.chart.ariaBench", "{symbol} over {n} trading days, indexed to 100, against {bench}", "{symbol} לאורך {n} ימי מסחר, מתחיל ב-100, מול {bench}");
add("sp.chart.short", "Showing the last {n} days; the full year appears after the next daily update.", "מוצגים {n} הימים האחרונים; השנה המלאה תופיע אחרי העדכון היומי הבא.");

export default { en, he };
