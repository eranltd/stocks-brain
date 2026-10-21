// Home (the Today page) and its cards: the simple home, the live feed, top stocks, sector spotlights, the weekly game,
// why it moved, the money answer, and the Details page with its goal, portfolio and market-mood sections; plus the
// sentences the home's pure libs write (lib/simple.js, feed.js, why.js, spotlight.js, carousel.js, spots.js, weekly.js,
// money.js, secnews.js, mix.js, marketday.js).
// Convention: `export default { en: {...}, he: {...} }` with identical keys (see shell.js and lib/i18n.js); financial
// words from glossary.js. i18n.test.js checks the file.
//
// Written here as pairs, add(key, English, Hebrew), so each English text sits next to its Hebrew one. forms() adds a
// Hebrew text in its grammatical forms, for a sentence whose verb or adjective agrees with a subject the code picks:
// ".m" (the market, an index: השוק, המדד), ".f" (a company, a stock or a fund: חברה, מניה, קרן) and ".fp" (a group of
// companies). English reads the same in every form.
// Voice: the site is a research notebook anyone may read. No "our household"; "the plan", "this site's rules", "the
// list". Hebrew: plain modern Hebrew, infinitives rather than gendered commands, tickers and names in Latin letters, and
// never a percent sign next to a placeholder (pass "4.1%" as the value, so the sign stays with its number).

const en = {}, he = {};
/** One text in both languages. */
const add = (key, e, h) => { en[key] = e; he[key] = h; };
/** A text whose Hebrew changes with its subject's form: forms("k", "rose", { m: "עלה", f: "עלתה", fp: "עלו" }). */
const forms = (key, e, byForm) => { for (const [g, h] of Object.entries(byForm)) add(`${key}.${g}`, e, h); };

/* ============================================================ lib/simple.js: words, not numbers */

add("when.today", "today", "היום");
add("when.tomorrow", "tomorrow", "מחר");
add("when.yesterday", "yesterday", "אתמול");
add("when.thisWeek", "this {day}", "ביום {day} השבוע");
add("when.nextWeek", "next {day}", "ביום {day} בשבוע הבא");
add("when.pastWeek", "on {day}", "ביום {day} האחרון");
add("when.early", "in early {month}", "בתחילת {month}");
add("when.mid", "in mid {month}", "באמצע {month}");
add("when.late", "in late {month}", "בסוף {month}");
// weekday.0 is Sunday; the Hebrew is the day's name after the word יום ("ביום רביעי")
["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach((d, i) =>
  add(`weekday.${i}`, d, ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][i]));
["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].forEach((m, i) =>
  add(`month.${i}`, m, ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"][i]));

// the size of a day's move
forms("size.flat", "barely moved", { m: "כמעט לא זז", f: "כמעט לא זזה", fp: "כמעט לא זזו" });
forms("size.upSmall", "rose a little", { m: "עלה מעט", f: "עלתה מעט", fp: "עלו מעט" });
forms("size.up", "rose", { m: "עלה", f: "עלתה", fp: "עלו" });
forms("size.upBig", "jumped", { m: "זינק", f: "זינקה", fp: "זינקו" });
forms("size.downSmall", "slipped", { m: "ירד מעט", f: "ירדה מעט", fp: "ירדו מעט" });
forms("size.down", "fell", { m: "ירד", f: "ירדה", fp: "ירדו" });
forms("size.downBig", "fell sharply", { m: "ירד בחדות", f: "ירדה בחדות", fp: "ירדו בחדות" });

// the market sentence
add("mkt.none", "The market's last close appears after the next daily run.", "סגירת המסחר האחרונה תופיע אחרי הריצה היומית הבאה.");
add("mkt.who.market", "The market", "השוק");
add("mkt.who.whole", "The whole market", "השוק כולו");
add("mkt.lastClose", "{who}'s last close was {when}", "הסגירה האחרונה של {who} הייתה {when}");
add("mkt.mostRose.and", ", and most of the {noun} on this list rose", ", ורוב {noun} ברשימה עלו");
add("mkt.mostRose.but", ", but most of the {noun} on this list rose", ", אבל רוב {noun} ברשימה עלו");
add("mkt.mostFell.and", ", and most of the {noun} on this list fell", ", ורוב {noun} ברשימה ירדו");
add("mkt.mostFell.but", ", but most of the {noun} on this list fell", ", אבל רוב {noun} ברשימה ירדו");
add("mkt.split", ", and the {noun} on this list were split", ", ו{noun} ברשימה נחלקו בין עליות לירידות");
add("noun.companies", "companies", "החברות");
add("noun.funds", "funds", "הקרנות");
forms("high.close", "It is close to its high for the year", { m: "הוא קרוב לשיא שלו בשנה האחרונה", f: "היא קרובה לשיא שלה בשנה האחרונה", fp: "הן קרובות לשיא שלהן בשנה האחרונה" });
forms("high.little", "It is a little below its high for the year", { m: "הוא מעט מתחת לשיא שלו בשנה האחרונה", f: "היא מעט מתחת לשיא שלה בשנה האחרונה", fp: "הן מעט מתחת לשיא שלהן בשנה האחרונה" });
forms("high.well", "It is well below its high for the year", { m: "הוא הרבה מתחת לשיא שלו בשנה האחרונה", f: "היא הרבה מתחת לשיא שלה בשנה האחרונה", fp: "הן הרבה מתחת לשיא שלהן בשנה האחרונה" });
add("mood.calm", "the mood is calm", "האווירה רגועה");
add("mood.steady", "the mood is steady", "האווירה יציבה");
add("mood.nervous", "the mood is nervous: bigger swings than usual", "האווירה עצבנית: תנודות גדולות מהרגיל");
add("more.two", "{a}, and {b}.", "{a}, ו{b}.");

// "In the news"
add("news.reports", "{name} reports results {when}", "{name} מפרסמת תוצאות {when}");
add("news.expected", "{name} is expected to report results {when}", "{name} צפויה לפרסם תוצאות {when}");
add("news.more",
  { one: ", and one more company reports this coming week", other: ", and {n} more companies report this coming week" },
  { one: ", ועוד חברה אחת מפרסמת תוצאות בשבוע הקרוב", other: ", ועוד {n} חברות מפרסמות תוצאות בשבוע הקרוב" });
add("news.several", "several", "כמה");
add("news.filing", "Official news from {name} {when}: {title}.", "דיווח רשמי של {name} {when}: {title}.");
add("news.call.bullish", "{by} is upbeat on {name}.", "{by}: עמדה אופטימית לגבי {name}.");
add("news.call.bearish", "{by} is wary of {name}.", "{by}: עמדה זהירה לגבי {name}.");
add("news.call.neutral", "{by} is on the fence about {name}.", "{by}: עמדה ניטרלית לגבי {name}.");
add("news.call.other", "{by} spoke about {name}.", "{by}: התייחסות ל-{name}.");

// chips and tags on the top-stocks cards
add("chip.lean_up", "Going up", "נטייה לעלייה");
add("chip.mixed", "Mixed", "תמונה מעורבת");
add("chip.lean_down", "Going down", "נטייה לירידה");
add("tag.held", "in the pretend portfolio", "בתיק המדומה");
add("tag.picked", "the brain is watching", "המוח עוקב אחריה");
add("tag.riser", "one of the day's big risers", "מהעולות הבולטות של יום המסחר");
add("tag.faller", "one of the day's big fallers", "מהיורדות הבולטות של יום המסחר");
add("watch.hot", "overheated", "חמה מדי");
add("watch.falling", "falling", "בירידה");
add("watch.leaningDown", "leaning down", "נוטה לירידה");
add("watch.thin", "rising on thin buying", "עולה במחזור מסחר דל");

// the plan in three lines (planWords)
add("plan.core", "Keep most of the savings in the S&P 500 index fund.", "רוב החיסכון נשאר בקרן מחקה על מדד S&P 500.");
add("plan.small", "Small amounts only, within the plan's limits", "סכומים קטנים בלבד, בגבולות התוכנית");
add("plan.paper", "Practise on paper, no real money yet", "תרגול בכסף מדומה, עדיין בלי כסף אמיתי");
add("plan.none", "{money}: no single companies held right now.", "{money}: כרגע אין בתיק אף חברה בודדת.");
add("plan.justWatching", "the brain is just watching", "המוח רק עוקב");
add("plan.watching", "Watching, not buying: {names}.", "במעקב, בלי לקנות: {names}.");
add("plan.nothing", "Watching, not buying: nothing stands out today.", "במעקב, בלי לקנות: היום שום דבר לא בולט.");
add("plan.next", "Next check: {when}.", "הבדיקה הבאה: {when}.");
add("plan.honest", "This is a practice notebook, not advice. The checks are unproven, so nothing here says buy.",
  "זו מחברת תרגול, לא ייעוץ. הבדיקות לא הוכחו, ולכן שום דבר כאן לא אומר לקנות.");

/* ============================================================ lib/why.js: why it moved */

add("why.notATrade", "This explains a move; it is not a reason to trade.", "ההסבר מתאר תנועה שכבר קרתה; הוא לא סיבה לקנות או למכור.");
add("why.conf.clear", "Clear cause", "סיבה ברורה");
add("why.conf.likely", "Likely cause", "סיבה סבירה");
add("why.conf.unclear", "No clear cause found", "לא נמצאה סיבה ברורה");
add("why.lead.clear", "why: {headline}", "הסיבה: {headline}");
add("why.lead.likely", "likely why: {headline}", "הסיבה הסבירה: {headline}");
add("why.none", "no clear cause has been found yet", "עדיין לא נמצאה סיבה ברורה");
add("why.who.sector", "{sector} companies on the list", "חברות {sector} ברשימה");
add("why.who.group", "One group of companies on the list", "קבוצת חברות אחת ברשימה");
add("why.who.one", "One name on the list", "מניה אחת ברשימה");

/* ============================================================ lib/marketday.js: sectors (ענפים) */

for (const [s, h] of [
  ["Information Technology", "טכנולוגיה"], ["Communication Services", "תקשורת"], ["Consumer Discretionary", "צריכה מחזורית"],
  ["Consumer Staples", "צריכה בסיסית"], ["Health Care", "בריאות"], ["Financials", "פיננסים"], ["Industrials", "תעשייה"],
  ["Energy", "אנרגיה"], ["Utilities", "תשתיות"], ["Real Estate", "נדל״ן"], ["Materials", "חומרי גלם"], ["Other", "אחר"],
]) add(`sector.${s}`, s, h);

/* ============================================================ lib/secnews.js and lib/mix.js */

for (const [k, e, h] of [
  ["results", "Results", "תוצאות"], ["report", "Report", "דוח"], ["warning", "Heads-up", "התראה"], ["people", "People", "הנהלה"],
  ["deal", "Deal", "עסקה"], ["money", "Money", "כסף"], ["update", "Update", "עדכון"], ["other", "Other", "אחר"],
]) add(`sec.kind.${k}`, e, h);
// The fixed filing titles of scripts/sec_news.py (ITEMS, FORMS), by 8-K item code or form; English as Python writes them.
for (const [k, e, h] of [
  ["2.02", "Quarterly results", "תוצאות רבעוניות"],
  ["4.02", "Earlier results corrected: past numbers should not be relied on", "תיקון של תוצאות קודמות: אין להסתמך על המספרים הקודמים"],
  ["1.05", "A cybersecurity incident", "אירוע סייבר"],
  ["5.01", "A change in who controls the company", "שינוי בשליטה בחברה"],
  ["2.04", "A debt became due early", "חוב הועמד לפירעון מוקדם"],
  ["2.05", "Cost cuts or a restructuring", "קיצוצים או ארגון מחדש"],
  ["2.06", "Wrote down the value of some assets", "הורדת השווי של חלק מהנכסים"],
  ["3.01", "A notice about its stock exchange listing", "הודעה על הרישום של המניה בבורסה"],
  ["5.02", "A leadership change (an executive or board member)", "שינוי בהנהלה (מנהל בכיר או חבר דירקטוריון)"],
  ["1.01", "Signed a major agreement", "חתימה על הסכם מהותי"],
  ["2.01", "Bought or sold a business or major assets", "קנייה או מכירה של עסק או של נכסים מהותיים"],
  ["1.02", "Ended a major agreement", "סיום של הסכם מהותי"],
  ["2.03", "Took on new debt", "חוב חדש"],
  ["3.02", "Sold new shares", "הנפקה של מניות חדשות"],
  ["3.03", "Changed shareholders' rights", "שינוי בזכויות של בעלי המניות"],
  ["4.01", "Changed its auditor", "החלפת רואה החשבון המבקר"],
  ["5.03", "Changed its bylaws or fiscal year", "שינוי בתקנון או בשנת הכספים"],
  ["5.07", "Shareholder vote results", "תוצאות הצבעה של בעלי המניות"],
  ["5.08", "Set a shareholder meeting date", "נקבע מועד לאסיפת בעלי המניות"],
  ["7.01", "Shared an update with investors", "עדכון למשקיעים"],
  ["8.01", "Other company news", "חדשות אחרות של החברה"],
  ["none", "Company news", "חדשות החברה"],
]) add(`sec.item.${k}`, e, h);
add("sec.form.q", "Quarterly report", "דוח רבעוני");
add("sec.form.y", "Yearly report", "דוח שנתי");
add("sec.form.6k", "Company update (a foreign company's report)", "עדכון חברה (דיווח של חברה זרה)");
add("sec.amend", "Correction to an earlier filing: {title}", "תיקון לדיווח קודם: {title}");
add("mix.profit", "Most growth", "הכי הרבה צמיחה");
add("mix.calm", "Growth for the bumps", "צמיחה ביחס לטלטלות");
add("mix.smooth", "Smallest drop", "הירידה הקטנה ביותר");

/* ============================================================ lib/spotlight.js and lib/carousel.js */

add("spot.who.chips", "chip makers as a group", "יצרניות השבבים כקבוצה");
add("spot.who.tech", "the Nasdaq-100", "מדד Nasdaq-100");
add("spot.who.energy", "energy companies as a group", "חברות האנרגיה כקבוצה");
add("spot.who.other", "its group", "הקבוצה שלה");
add("spot.more", "Over the past year it rose more than {who}. A past rise does not promise the next one.",
  "בשנה האחרונה היא עלתה יותר מאשר {who}. עלייה בעבר אינה מבטיחה עלייה בעתיד.");
add("spot.worse", "Over the past year it did worse than {who}. A past rise does not promise the next one.",
  "בשנה האחרונה היא הצליחה פחות מאשר {who}. עלייה בעבר אינה מבטיחה עלייה בעתיד.");
["Biggest", "Second-biggest", "Third-biggest", "Fourth-biggest", "Fifth-biggest", "Sixth-biggest", "Seventh-biggest", "Eighth-biggest", "Ninth-biggest", "Tenth-biggest"]
  .forEach((w, i) => add(`spot.rank.${i}`, `${w} rise of the past year`,
    i === 0 ? "העלייה הגדולה ביותר בשנה האחרונה"
      : `העלייה ה${["", "שנייה", "שלישית", "רביעית", "חמישית", "שישית", "שביעית", "שמינית", "תשיעית", "עשירית"][i]} בגודלה בשנה האחרונה`));
add("spot.rank.other", "A rise of the past year", "עלייה בשנה האחרונה");
add("spot.lower", "lower than a year ago", "נמוכה יותר מלפני שנה");
add("spot.noYear", "no year of prices yet", "עדיין אין מחירים של שנה שלמה");

add("mini.none", "{name}: no chart yet.", "{name}: עדיין אין גרף.");
add("mini.summary", "{name}: the last month of daily candles, {mix}{dir}. A description of the chart, not a forecast.",
  "{name}: החודש האחרון בנרות יומיים, {mix}{dir}. זה תיאור של הגרף, לא תחזית.");
add("mini.mostlyUp", "mostly up days", "רוב הימים היו ימי עלייה");
add("mini.mostlyDown", "mostly down days", "רוב הימים היו ימי ירידה");
add("mini.even", "about as many up days as down days", "מספר דומה של ימי עלייה וימי ירידה");
add("mini.dir.up", "; it ended the month higher than it began", "; המחיר סיים את החודש גבוה יותר מאשר בתחילתו");
add("mini.dir.down", "; it ended the month lower than it began", "; המחיר סיים את החודש נמוך יותר מאשר בתחילתו");
add("mini.dir.flat", "; it ended the month about where it began", "; המחיר סיים את החודש בערך היכן שהתחיל");

/* ============================================================ lib/spots.js: candles to notice */

for (const [k, title, why, hTitle, hWhy] of [
  ["big_green", "Big green day", "It opened low and closed much higher: buyers were in charge all day.",
    "יום ירוק גדול", "המחיר נפתח נמוך ונסגר גבוה בהרבה: הקונים שלטו כל היום."],
  ["big_red", "Big red day", "It opened high and closed much lower: sellers were in charge all day.",
    "יום אדום גדול", "המחיר נפתח גבוה ונסגר נמוך בהרבה: המוכרים שלטו כל היום."],
  ["gap_up", "Gap up", "It opened above the whole day before, often after news. Gaps sometimes get filled later, sometimes not.",
    "פער כלפי מעלה", "המחיר נפתח מעל כל טווח היום הקודם, לרוב אחרי חדשות. לפעמים פערים נסגרים מאוחר יותר, ולפעמים לא."],
  ["gap_down", "Gap down", "It opened below the whole day before, often after news. Chart readers watch whether it climbs back.",
    "פער כלפי מטה", "המחיר נפתח מתחת לכל טווח היום הקודם, לרוב אחרי חדשות. קוראי גרפים בודקים אם הוא מטפס בחזרה."],
  ["hammer", "Hammer", "After falling, sellers pushed it down during the day but buyers pushed it back up. Chart readers see a possible turn up.",
    "פטיש", "אחרי ירידה, המוכרים דחפו את המחיר למטה במהלך היום, אבל הקונים החזירו אותו למעלה. קוראי גרפים רואים כאן אפשרות לפנייה למעלה."],
  ["shooting_star", "Shooting star", "After rising, buyers pushed it up during the day but it fell back. Chart readers see a possible turn down.",
    "כוכב נופל", "אחרי עלייה, הקונים דחפו את המחיר למעלה במהלך היום, אבל הוא חזר למטה. קוראי גרפים רואים כאן אפשרות לפנייה למטה."],
  ["engulf_up", "Green swallows red", "A green day whose body covers the whole red day before it: buyers took over from sellers.",
    "ירוק בולע אדום", "יום ירוק שהגוף שלו מכסה את כל היום האדום שלפניו: הקונים השתלטו על המוכרים."],
  ["engulf_down", "Red swallows green", "A red day whose body covers the whole green day before it: sellers took over from buyers.",
    "אדום בולע ירוק", "יום אדום שהגוף שלו מכסה את כל היום הירוק שלפניו: המוכרים השתלטו על הקונים."],
  ["busy", "Very busy day", "About twice the usual trading or more. Big moves on busy days get more attention than quiet ones.",
    "יום עמוס במיוחד", "בערך פי שניים ממחזור המסחר הרגיל, או יותר. תנועות גדולות בימים עמוסים מושכות יותר תשומת לב מאשר בימים שקטים."],
]) { add(`spots.${k}.title`, title, hTitle); add(`spots.${k}.why`, why, hWhy); }
add("spots.caveat", "A clue, not a promise: in this site's own tests, candle shapes did not beat chance.",
  "רמז, לא הבטחה: במבחנים של האתר עצמו, דפוסי נרות לא ניבאו טוב יותר ממזל.");

/* ============================================================ lib/weekly.js: the weekly game */

add("wk.rule.weekly_swing.name", "Weekly Swing", "התנופה השבועית");
add("wk.rule.weekly_swing.what", "Each week: the five names that beat the market most over the last month.",
  "בכל שבוע: חמש המניות שהקדימו את השוק בפער הגדול ביותר בחודש האחרון.");
add("wk.rule.five_leaders_weekly.name", "Five Leaders, weekly", "חמש המובילות, שבועי");
add("wk.rule.five_leaders_weekly.what", "Each week: the strongest steady climbers of the past year.",
  "בכל שבוע: המניות שטיפסו בצורה החזקה והיציבה ביותר בשנה האחרונה.");
add("wk.hist.none", "Not tested on past prices yet: the next nightly run does it.", "עדיין לא נבדק על מחירי עבר: הריצה הלילית הבאה תבדוק.");
add("wk.hist.passed", "On past prices it beat {p} out of 100 random picks: good enough to keep playing on paper.",
  "במבחן על מחירי עבר הכלל ניצח {p} מתוך 100 בחירות אקראיות: מספיק טוב כדי להמשיך לשחק בכסף מדומה.");
add("wk.hist.failed", "On past prices it beat only {p} out of 100 random picks; luck alone beats about half. Not good enough for real money.",
  "במבחן על מחירי עבר הכלל ניצח רק {p} מתוך 100 בחירות אקראיות; מזל לבדו מנצח בערך חצי. לא מספיק טוב לכסף אמיתי.");
add("wk.score.none", "Starts with the next weekly review.", "הציון יתחיל בסקירה השבועית הבאה.");
add("wk.score.early", "Week {weeks}: too early to score. It is checked again every week.", "שבוע {weeks}: מוקדם מדי לתת ציון. הבדיקה חוזרת כל שבוע.");
const LUCK_EN = "A few weeks prove nothing: luck swings this much.", LUCK_HE = "כמה שבועות לא מוכיחים כלום: מזל לבדו יכול להזיז את התוצאות בגודל כזה.";
add("wk.score.level",
  { other: `After {weeks} weeks it is about level with the whole market. ${LUCK_EN}` },
  { two: `אחרי שבועיים הכלל בערך שווה לשוק כולו. ${LUCK_HE}`, other: `אחרי {weeks} שבועות הכלל בערך שווה לשוק כולו. ${LUCK_HE}` });
add("wk.score.ahead",
  { other: `After {weeks} weeks it is {pts} points ahead of the whole market. ${LUCK_EN}` },
  { two: `אחרי שבועיים הכלל מקדים את השוק כולו ב-{pts} נקודות אחוז. ${LUCK_HE}`, other: `אחרי {weeks} שבועות הכלל מקדים את השוק כולו ב-{pts} נקודות אחוז. ${LUCK_HE}` });
add("wk.score.behind",
  { other: `After {weeks} weeks it is {pts} points behind the whole market. ${LUCK_EN}` },
  { two: `אחרי שבועיים הכלל מפגר אחרי השוק כולו ב-{pts} נקודות אחוז. ${LUCK_HE}`, other: `אחרי {weeks} שבועות הכלל מפגר אחרי השוק כולו ב-{pts} נקודות אחוז. ${LUCK_HE}` });

/* ============================================================ lib/feed.js: the live feed */

for (const [k, e, h] of [["all", "All", "הכול"], ["market", "Market", "שוק"], ["companies", "Companies", "חברות"], ["brain", "Brain", "המוח"], ["people", "People", "אנשים"], ["checklist", "Checklist", "רשימת בדיקה"]])
  add(`feed.kind.${k}`, e, h);
add("feed.close", "Market close", "סגירת המסחר");
add("feed.rose", "{rose} of {n} names rose, {fell} fell.", "{rose} מתוך {n} מניות עלו, {fell} ירדו.");
add("feed.biggest", "Biggest mover: {sym} {pct}.", "התנועה הגדולה ביותר: {sym} {pct}.");
add("feed.biggestNamed", "Biggest mover: {sym} {pct} ({name}).", "התנועה הגדולה ביותר: {sym} {pct} ({name}).");
add("feed.jumped", "{sym} jumped {pct} in a day", "{sym} זינקה {pct} ביום אחד");
add("feed.dropped", "{sym} dropped {pct} in a day", "{sym} צנחה {pct} ביום אחד");
add("feed.times", "About {times} times its usual daily swing ({sd} over the {n} days before).",
  "בערך פי {times} מהתנודה היומית הרגילה שלה ({sd} ב-{n} הימים שלפני כן).");
add("feed.timesNamed", "About {times} times its usual daily swing ({sd} over the {n} days before). {name}.",
  "בערך פי {times} מהתנודה היומית הרגילה שלה ({sd} ב-{n} הימים שלפני כן). {name}.");
add("feed.brain.failed", "The brain's run failed", "הריצה של המוח נכשלה");
add("feed.brain.failedBody", "Nothing was recorded; the next run starts fresh.", "שום דבר לא נרשם; הריצה הבאה מתחילה מחדש.");
add("feed.brain.none", "The brain ran: no names flagged", "המוח רץ: אף מניה לא סומנה");
add("feed.brain.same",
  { one: "The brain flagged {count} name, {stance}", other: "The brain flagged {count} names, all {stance}" },
  { one: "המוח סימן מניה אחת, {stance}", two: "המוח סימן שתי מניות, שתיהן {stance}", other: "המוח סימן {count} מניות, כולן {stance}" });
add("feed.brain.mixed",
  { one: "The brain flagged {count} name", other: "The brain flagged {count} names" },
  { one: "המוח סימן מניה אחת", two: "המוח סימן שתי מניות", other: "המוח סימן {count} מניות" });
add("feed.stance.bullish", "leaning up", "בנטייה לעלייה");
add("feed.stance.bearish", "leaning down", "בנטייה לירידה");
add("feed.stance.neutral", "just watching", "רק במעקב");
add("feed.growth.up", ", up {pct} from a year earlier", ", עלייה של {pct} לעומת שנה קודם לכן");
add("feed.growth.down", ", down {pct} from a year earlier", ", ירידה של {pct} לעומת שנה קודם לכן");
add("feed.reported", "{t} reported results: revenue {revenue}", "{t} פרסמה תוצאות: הכנסות של {revenue}");
add("feed.due", "{t}'s results were due", "מועד התוצאות של {t} כבר עבר");
add("feed.reports", "{t} reports results", "{t} מפרסמת תוצאות");
add("feed.refresh", "The outlook card is due for a refresh.", "כרטיס התחזית צריך עדכון.");
add("feed.confirmed", "{name}, date confirmed.", "{name}, התאריך אושר.");
add("feed.expected", "{name}, date expected (not confirmed yet).", "{name}, תאריך משוער (עוד לא אושר).");
add("feed.people.bullish", "bullish", "אופטימית");
add("feed.people.bearish", "bearish", "פסימית");
add("feed.people.neutral", "neutral", "ניטרלית");
add("feed.people.said", "{name} said: {stance} on {t}", "{name}: עמדה {stance} לגבי {t}");
add("feed.people.filed", "{name} 13F filed: {stance} on {t}", "{name}, דיווח 13F: עמדה {stance} לגבי {t}");
add("feed.people.right", "{name}'s {t} call judged right at {weeks} weeks", "העמדה של {name} לגבי {t} נבדקה אחרי {weeks} שבועות: צדקה");
add("feed.people.wrong", "{name}'s {t} call judged wrong at {weeks} weeks", "העמדה של {name} לגבי {t} נבדקה אחרי {weeks} שבועות: טעתה");
add("feed.people.vs", "{pct} for the call against the S&P 500 core.", "{pct} לעמדה, בהשוואה לקרן הליבה על מדד S&P 500.");
add("feed.right", "right", "צדקה");
add("feed.wrong", "wrong", "טעתה");
add("feed.verdict.lean_up", "lean up", "נטייה לעלייה");
add("feed.verdict.mixed", "mixed", "תמונה מעורבת");
add("feed.verdict.lean_down", "lean down", "נטייה לירידה");
add("feed.digest", "Checklist: {count} names changed", "רשימת הבדיקה: {count} מניות השתנו");
add("feed.digestMore", "{shown} and {more} more.", "{shown} ועוד {more}.");

add("ago.now", "just now", "ממש עכשיו");
add("ago.min", { one: "{count} minute ago", other: "{count} minutes ago" }, { one: "לפני דקה", two: "לפני שתי דקות", other: "לפני {count} דקות" });
add("ago.hour", { one: "{count} hour ago", other: "{count} hours ago" }, { one: "לפני שעה", two: "לפני שעתיים", other: "לפני {count} שעות" });
add("ago.yesterday", "yesterday", "אתמול");
add("ago.days", { other: "{count} days ago" }, { two: "לפני יומיים", other: "לפני {count} ימים" });

/* ============================================================ lib/money.js: what to do with real money */

add("money.h.long", "Not for 5 years or more", "לא בחמש השנים הקרובות");
add("money.h.long.short", "5+ years", "5+ שנים");
add("money.h.medium", "In 1 to 5 years", "בעוד שנה עד חמש שנים");
add("money.h.medium.short", "1-5 years", "1-5 שנים");
add("money.h.short", "Within a year", "בתוך שנה");
add("money.h.short.short", "Under a year", "פחות משנה");
add("money.fund", "a low-cost fund that holds the whole US market (an S&P 500 fund)", "קרן זולה שמחזיקה את כל השוק האמריקאי (קרן על מדד S&P 500)");
add("money.cash", "short-term government savings (T-bills)", "חיסכון ממשלתי לטווח קצר (אגרות חוב קצרות של ממשלת ארה״ב, T-bills)");
add("money.fundLike", "a low-cost fund that holds the whole US market, such as an S&P 500 fund (like {sym})",
  "קרן זולה שמחזיקה את כל השוק האמריקאי, למשל קרן על מדד S&P 500 (כמו {sym})");
add("money.cashLike", "short-term government savings (T-bills, like {sym})", "חיסכון ממשלתי לטווח קצר (T-bills, כמו {sym})");
add("money.cashPays", " They pay about {pct} a year right now.", " התשואה כרגע היא בערך {pct} בשנה.");
add("money.history", " Over the last {years} years it grew about {pct} a year on average; over many decades the average is closer to 10% a year.",
  " ב-{years} השנים האחרונות היא צמחה בממוצע בערך {pct} בשנה; לאורך עשרות שנים הממוצע קרוב יותר ל-10% בשנה.");
add("money.historyLong", " Over many decades it has grown about 10% a year on average.", " לאורך עשרות שנים היא צמחה בממוצע בערך 10% בשנה.");
add("money.scary", " In those years it once fell {pct} from its top before coming back.", " בשנים האלה היא ירדה פעם {pct} מהשיא שלה לפני שהתאוששה.");
add("money.short.title", "Keep it safe.", "לשמור את הכסף במקום בטוח.");
add("money.short.s1", "Keep this money in a savings account or in {cash}.{pays}", "לשמור את הכסף הזה בחשבון חיסכון או ב{cash}.{pays}");
add("money.short.s2", "Do not put money you need within a year into stocks.", "לא להשקיע במניות כסף שיהיה צורך בו בתוך שנה.");
add("money.short.why", "Stocks can drop a lot in a few months, like a sudden storm.{scary} If you need the money right then, you would have to sell at a bad time.",
  "מניות יכולות לרדת הרבה בתוך כמה חודשים, כמו סערה פתאומית.{scary} ואם הכסף נחוץ בדיוק אז, נאלצים למכור בזמן גרוע.");
add("money.short.risk", "Safe money grows slowly, but it is there when you need it.", "כסף בטוח צומח לאט, אבל הוא זמין כשצריך אותו.");
add("money.medium.title", "Split it: part safe, part whole market.", "לחלק: חלק בטוח, חלק בשוק כולו.");
add("money.medium.s1", "Put part in {cash}.{pays}", "לשים חלק ב{cash}.{pays}");
add("money.medium.s2", "Put the rest in {fund}, a little every week.", "את השאר להשקיע ב{fund}, קצת בכל שבוע.");
add("money.medium.s3", "The sooner you need the money, the bigger the safe part: about half and half at five years, mostly safe when it is a year or two away.",
  "ככל שהכסף נחוץ מוקדם יותר, החלק הבטוח גדל: בערך חצי-חצי כשנשארו חמש שנים, ורובו בטוח כשנשארו שנה או שנתיים.");
add("money.medium.why", "The safe part is there when you need it; the market part can grow.{history}", "החלק הבטוח זמין כשצריך אותו; החלק שבשוק יכול לצמוח.{history}");
add("money.medium.risk", "The market part can drop a lot along the way.", "החלק שבשוק יכול לרדת הרבה בדרך.");
add("money.medium.riskWorst", "The market part can drop a lot along the way: its worst twelve months in the site's data lost {pct}.",
  "החלק שבשוק יכול לרדת הרבה בדרך: ב-12 החודשים הגרועים ביותר בנתוני האתר הוא הפסיד {pct}.");
add("money.long.title", "Buy the whole market, a little every week, and leave it alone.", "לקנות את השוק כולו, קצת בכל שבוע, ולא לגעת.");
add("money.long.s1", "Put it in {fund}.", "להשקיע את הכסף ב{fund}.");
add("money.long.s2", "Add a little every week, the same amount, whatever the news says. In this site's test, weekly did a bit better than monthly if the broker's fee per order is tiny.",
  "להוסיף קצת בכל שבוע, אותו סכום, לא משנה מה אומרות החדשות. במבחן של האתר, קנייה שבועית הצליחה מעט יותר מקנייה חודשית, כל עוד העמלה של הברוקר לכל פקודה זעירה.");
add("money.long.s3", "Do not sell when it drops. Look at it rarely.", "לא למכור כשהשוק יורד. להציץ רק לעיתים רחוקות.");
add("money.long.why", "Owning the whole market is like planting an orchard instead of betting on one tree.{history} That has beaten almost everyone who tries to pick stocks.",
  "להחזיק את כל השוק זה כמו לשתול פרדס במקום להמר על עץ אחד.{history} הדרך הזו הצליחה יותר מכמעט כל מי שניסה לבחור מניות.");
add("money.long.risk", "It will have bad years.{scary} Money you need sooner does not belong here.", "יהיו שנים רעות.{scary} כסף שיהיה צורך בו מוקדם יותר לא שייך לכאן.");

add("lump.title", "Got a lump sum? Five steps.", "יש סכום חד-פעמי? חמישה צעדים.");
add("lump.fund", "the whole-market fund", "הקרן על כל השוק");
add("lump.s1", "First set aside 3 to 6 months of spending in safe savings. That is your emergency money; it never goes into stocks.",
  "קודם לשים בצד הוצאות של 3 עד 6 חודשים בחיסכון בטוח. זה כסף החירום; הוא אף פעם לא נכנס למניות.");
add("lump.s2", "Money you will need within 5 years (a car, a flat, a wedding) also stays out of stocks: see the answer above for your time frame.",
  "גם כסף שיהיה צורך בו בתוך 5 שנים (רכב, דירה, חתונה) נשאר מחוץ למניות: התשובה למעלה מתייחסת לכל טווח זמן.");
add("lump.s3", "The rest goes into {fund} in one purchase. {test}", "השאר נכנס בקנייה אחת אל {fund}. {test}");
add("lump.s4", "If a crash right after buying would make you sell, spreading it over 6 months is fine: it costs a little on average, but staying in is what matters most.",
  "אם נפילה מיד אחרי הקנייה עלולה לגרום למכור, אפשר לפזר את הקנייה על פני 6 חודשים: זה עולה קצת בממוצע, אבל הכי חשוב להישאר בפנים.");
add("lump.s5", "Then keep adding new savings every week, and do not sell when it drops.", "אחר כך להמשיך להוסיף חיסכון חדש בכל שבוע, ולא למכור כשהשוק יורד.");
add("lump.test", "In this site's test on {windows} start dates, putting it all in at once was ahead after a year {times} times in 100, against spreading it over half a year. Spreading only made the dips feel smaller",
  "במבחן של האתר על {windows} תאריכי התחלה, השקעה של הכול בבת אחת הובילה אחרי שנה {times} פעמים מתוך 100, לעומת פיזור על פני חצי שנה. הפיזור רק גרם לירידות להרגיש קטנות יותר");
add("lump.dips", " (the usual worst moment was {half} down instead of {lump})", " (בדרך כלל, הרגע הגרוע ביותר היה ירידה של {half} במקום {lump})");
add("lump.studies", "Studies of past prices found that putting it all in at once usually beat spreading it out, because markets rise more often than they fall.",
  "מחקרים על מחירי עבר מצאו שהשקעה של הכול בבת אחת בדרך כלל ניצחה פיזור, כי שווקים עולים יותר פעמים משהם יורדים.");
add("lump.b1", "Account type: a tax-advantaged account (in Israel, a keren hishtalmut or an investment kupat gemel) can beat a regular brokerage account.",
  "סוג החשבון: חשבון עם הטבות מס (בישראל, קרן השתלמות או קופת גמל להשקעה) עשוי להשתלם יותר מחשבון מסחר רגיל.");
add("lump.b2", "Where the fund is registered: for non-US investors, a US-registered fund can bring US estate tax and a higher tax on dividends; an Irish-registered fund on the same index often avoids both.",
  "איפה הקרן רשומה: למשקיעים שאינם אמריקאים, קרן הרשומה בארה״ב עלולה לגרור מס עיזבון אמריקאי ומס גבוה יותר על דיבידנדים; קרן הרשומה באירלנד על אותו מדד נמנעת לרוב משניהם.");
add("lump.b3", "Currency and fees: what the broker charges per order and per year, and whether you mind the fund moving with the dollar.",
  "מטבע ועמלות: כמה הברוקר גובה לכל פקודה ולכל שנה, והאם מפריע שהקרן זזה יחד עם הדולר.");
add("lump.adviser", "For big sums, an hour with a licensed, fee-only adviser (a fixed fee, no commission) on these three questions is worth more than any stock pick.",
  "בסכומים גדולים, שעה עם יועץ בעל רישיון שמקבל רק שכר קבוע (בלי עמלות) על שלוש השאלות האלה שווה יותר מכל בחירת מניה.");

/* ============================================================ components/why.jsx, spotlight.jsx, topstocks.jsx */

add("whyc.noSource", "No source on the site's list explained it yet.", "עדיין אף מקור מהרשימה של האתר לא הסביר את התנועה.");
add("whyc.lookedAt", "Looked at:", "נבדקו:");
add("whyc.sources", "Sources:", "מקורות:");
add("whyc.footer", "Notes are looked up after the close by a separate scheduled Claude session (not the stock-picking brain), only from official sources and news outlets on the site's list, and written in its own words with links.",
  "ההסברים נאספים אחרי סגירת המסחר בידי סשן Claude מתוזמן ונפרד (לא המוח שבוחר מניות), רק ממקורות רשמיים ומכלי תקשורת שברשימה של האתר, ונכתבים במילים שלו, עם קישורים.");

add("spotc.subtitle", "Ranked by how much they rose over the past year.", "מדורגות לפי כמה הן עלו בשנה האחרונה.");
add("spotc.fallback", "Its year in words appears after the next nightly run.", "תיאור השנה שלה במילים יופיע אחרי הריצה הלילית הבאה.");

add("top.title", "Top stocks", "מניות מובילות");
add("top.fallback", "Its short summary appears with the next company update.", "תקציר קצר יופיע בעדכון החברות הבא.");
add("top.hint.touch", "Swipe to see more", "להחליק כדי לראות עוד");
add("top.hint.wide", "Swipe or use the arrows to see more", "להחליק או להשתמש בחיצים כדי לראות עוד");
add("top.region", "{title}. Use the left and right arrow keys to move between them.", "{title}. אפשר לעבור ביניהם בעזרת מקשי החצים.");
add("top.prev.company", "Previous company", "החברה הקודמת");
add("top.prev.fund", "Previous fund", "הקרן הקודמת");
add("top.next.company", "Next company", "החברה הבאה");
add("top.next.fund", "Next fund", "הקרן הבאה");
add("top.choose.company", "Choose a company", "בחירת חברה");
add("top.choose.fund", "Choose a fund", "בחירת קרן");
add("top.one.company", "company", "חברה");
add("top.one.fund", "fund", "קרן");
add("top.show", "Show {name}", "להציג את {name}");
add("top.slide", "{name}, {i} of {n}", "{name}, {i} מתוך {n}");
add("top.zoom", "Zoom in: candles to notice", "הגדלה: הנרות הבולטים");
add("top.official", "Official news · {day}", "דיווח רשמי · {day}");
add("top.seeMore", "See more", "לפרטים נוספים");
add("top.loading", "{name}: the chart is loading.", "{name}: הגרף נטען.");
add("top.chartError", "The chart could not load just now.", "הגרף לא נטען כרגע.");
add("top.chartLater", "Chart after the next daily run", "הגרף יופיע אחרי הריצה היומית הבאה");
add("top.green", "Green day.", "יום ירוק.");
add("top.red", "Red day.", "יום אדום.");
add("top.closedHigher", "The last day closed higher than it opened.", "היום האחרון נסגר גבוה יותר מהמחיר שבו נפתח.");
add("top.closedLower", "The last day closed lower than it opened.", "היום האחרון נסגר נמוך יותר מהמחיר שבו נפתח.");

/* ============================================================ components/weekly.jsx and money.jsx */

add("wkc.title", "This week", "השבוע");
add("wkc.real", "Real money", "כסף אמיתי");
add("wkc.today", "Today", "היום");
add("wkc.buyDay", "{day}: the weekly buy.", "{day}: הקנייה השבועית.");
add("wkc.buyShort", "The same amount into the whole-market fund, whatever the news.", "אותו סכום לקרן על כל השוק, לא משנה מה החדשות.");
add("wkc.buyLong", "Put this week's amount into the whole-market fund, the same amount every week, whatever the news. Long-term money only. In this site's test on past prices, buying weekly did a little better than monthly, as long as the broker's fee per order is tiny.",
  "הסכום של השבוע נכנס לקרן על כל השוק, אותו סכום בכל שבוע, לא משנה מה החדשות. רק כסף לטווח ארוך. במבחן של האתר על מחירי עבר, קנייה שבועית הצליחה מעט יותר מקנייה חודשית, כל עוד העמלה של הברוקר לכל פקודה זעירה.");
add("wkc.pretend", "Pretend money: the weekly game", "כסף מדומה: המשחק השבועי");
add("wkc.pretendHow", "The brain's own weekly bet and two weekly trading rules play on paper. Every week they pick their names; every week the site checks whether they beat luck and the whole market. Real money joins only if one beats plain luck, first on past prices and then for months on paper.",
  "ההימור השבועי של המוח ושני כללי מסחר שבועיים משחקים בכסף מדומה. בכל שבוע הם בוחרים מניות, ובכל שבוע האתר בודק אם הם ניצחו את המזל ואת השוק כולו. כסף אמיתי מצטרף רק אם אחד מהם מנצח את המזל, קודם על מחירי עבר ואחר כך במשך חודשים בכסף מדומה.");
add("wkc.onlyCore", "This week it holds only the whole-market fund: nothing passed its checks.", "השבוע הכלל מחזיק רק את הקרן על כל השוק: אף מניה לא עברה את הבדיקות שלו.");
add("wkc.scoreboard", "The full scoreboard and how the game works", "לוח התוצאות המלא ואיך המשחק עובד");
add("wkc.howFills", "Prices arrive once a day after the close, so the game decides on the first trading day of each week and fills at the next close. General guidance from evidence, not personal financial advice.",
  "המחירים מגיעים פעם ביום אחרי הסגירה, ולכן המשחק מחליט ביום המסחר הראשון של כל שבוע וקונה במחיר הסגירה הבא. הכוונה כללית שמבוססת על נתונים, לא ייעוץ פיננסי אישי.");
add("wkc.bet", "The brain's bet", "ההימור של המוח");
add("wkc.betHow", "Each week the brain must take sides: the three names it expects to do best and the three it expects to do worst. It wins the week if its best three beat its worst three.",
  "בכל שבוע המוח חייב לבחור צד: שלוש המניות שלדעתו יצליחו הכי הרבה, ושלוש שלדעתו יצליחו הכי פחות. הוא מנצח בשבוע אם שלוש הטובות מקדימות את שלוש הגרועות.");
add("wkc.best", "Best three", "שלוש הטובות");
add("wkc.worst", "Worst three", "שלוש הגרועות");
add("wkc.soFar", "So far this week: best three {spread} points against the worst three.", "עד עכשיו השבוע: שלוש הטובות {spread} נקודות אחוז מול שלוש הגרועות.");
add("wkc.won", "Won", "ניצח");
add("wkc.lost", "Lost", "הפסיד");
add("wkc.weekOf", "the week of {day}: {spread} points", "בשבוע של {day}: {spread} נקודות אחוז");
add("wkc.firstBet", "The first bet comes with the brain's next run. Then it is scored every week.", "ההימור הראשון יגיע עם הריצה הבאה של המוח. אחר כך הוא יקבל ציון בכל שבוע.");

add("moneyc.title", "What should I do with my money?", "מה לעשות עם הכסף?");
add("moneyc.when", "When might you need this money?", "מתי ייתכן שיהיה צורך בכסף הזה?");
add("moneyc.pick", "Pick one. The answer depends on it, because money you need soon should be kept safe, and money you can leave alone for years can grow with the market.",
  "לבחור אחת מהאפשרויות. התשובה תלויה בזה: כסף שיהיה צורך בו בקרוב צריך להישאר בטוח, וכסף שאפשר לא לגעת בו שנים יכול לצמוח עם השוק.");
add("moneyc.why", "Why:", "למה:");
add("moneyc.risk", "What can go wrong:", "מה יכול להשתבש:");
add("moneyc.general", "General guidance from evidence, not personal financial advice.", "הכוונה כללית שמבוססת על נתונים, לא ייעוץ פיננסי אישי.");
add("moneyc.device", "Your answer is kept on this device only.", "הבחירה נשמרת רק במכשיר הזה.");
add("moneyc.lumpKinds", "Savings, a bonus, an inheritance", "חסכונות, בונוס, ירושה");
add("moneyc.before", "Before moving a big sum, settle these:", "לפני העברה של סכום גדול, יש לברר את אלה:");

/* ============================================================ tabs/Today.jsx */

add("today.howMuch", "How much to show", "כמה להציג");
add("today.simple", "Simple", "פשוט");
add("today.details", "Details", "פרטים");
add("today.marketDetails", "Market details", "פרטי השוק");
add("today.portfolio", "The portfolio", "תיק ההשקעות");
add("today.computed", "Every number here is computed by code from public market data.", "כל מספר כאן מחושב בקוד מנתוני שוק ציבוריים.");
add("today.lookedAt", "Looked at", "נבדקו:");
add("today.from", "From", "מקור:");
add("today.benchmark", "The benchmark", "מדד הייחוס");
add("today.oneIndustry", "One industry: {what}.", "ענף אחד: {what}.");
add("today.loading", "Loading {label}…", "{label} בטעינה…");
add("today.loadFailed", "{label} could not load just now.", "הטעינה של {label} נכשלה כרגע.");
add("today.retry", "Try again", "לנסות שוב");
add("today.status.old", "The data is old: the daily update may have failed.", "הנתונים ישנים: ייתכן שהעדכון היומי נכשל.");
add("today.status.sample", "Sample data, not the market.", "נתוני דוגמה, לא השוק האמיתי.");
add("today.status.live", "Live: updated after each US close.", "נתונים אמיתיים: מתעדכנים אחרי כל סגירת מסחר בארה״ב.");
add("today.hi", "Hi! It's {day}", "שלום! היום {day}");
add("today.showing", "Showing {label}:", "מוצגת רשימת {label}:");
add("today.staleAlert", "Please don't act on anything below until the daily update runs again.", "עדיף לא לפעול על סמך שום דבר שמופיע למטה עד שהעדכון היומי ירוץ שוב.");
add("today.topStocks", "Top stocks", "מניות מובילות");
add("today.topFunds", "Top funds", "קרנות מובילות");
add("today.fundFallback", "Its fund card appears with the next update.", "כרטיס הקרן יופיע בעדכון הבא.");
add("today.theMarket", "The market", "השוק");
add("today.whatMarketDid", "What the market did", "מה עשה השוק");
add("today.wholeList", "The whole {label} list", "כל רשימת {label}");
add("today.news", "In the news", "בחדשות");
add("today.noNews", "Nothing new about the {noun} on this list this week.", "השבוע אין חדש על {noun} ברשימה.");
add("today.showDetails", "Show the details", "להציג את הפרטים");
add("today.dataOld", { one: "Data is {count} day old", other: "Data is {count} days old" }, { one: "הנתונים בני יום", two: "הנתונים בני יומיים", other: "הנתונים בני {count} ימים" });
add("today.sampleData", "Sample data", "נתוני דוגמה");
add("today.live", "Live", "נתונים אמיתיים");
add("today.updated", "updated {when}", "עודכן {when}");
add("today.nextUpdate", "Next update after the US close", "העדכון הבא אחרי סגירת המסחר בארה״ב");
add("today.checking", "Checking…", "בבדיקה…");
add("today.checked", "Checked {when}", "נבדק {when}");
add("today.checkNow", "Check now", "לבדוק עכשיו");
add("today.fresh", "New data loaded", "נתונים חדשים נטענו");
add("today.reload", "New data is out · tap to refresh", "יש נתונים חדשים · להקיש כדי לרענן");
add("today.pinned", "pinned", "מוצמד");
add("today.today", "Today", "היום");
add("today.hiDate", "Hi! Today is {date}", "שלום! היום {date}");
add("today.lastClose", "Last market close in the data", "סגירת המסחר האחרונה בנתונים");
add("today.closeOld", { one: "{count} day old: the daily update may have failed", other: "{count} days old: the daily update may have failed" },
  { one: "לפני יום: ייתכן שהעדכון היומי נכשל", two: "לפני יומיים: ייתכן שהעדכון היומי נכשל", other: "לפני {count} ימים: ייתכן שהעדכון היומי נכשל" });
add("today.lastRun", "Last time the brain ran", "הריצה האחרונה של המוח");
add("today.notYet", "Not yet", "עדיין לא");
add("today.lookedClosely", "Stocks it looked at closely", "מניות שהמוח בדק מקרוב");
add("today.stocksN", { one: "{word} stock", other: "{word} stocks" }, { one: "מניה אחת", two: "שתי מניות", other: "{word} מניות" });
add("today.inFeed", "in the feed below", "בפיד למטה");
add("today.moneyQ", "What should I do with my money?", "מה לעשות עם הכסף?");
add("today.staleMoney", "The data is old. Please don't act on anything below until the daily update runs again.", "הנתונים ישנים. עדיף לא לפעול על סמך שום דבר שמופיע למטה עד שהעדכון היומי ירוץ שוב.");
add("today.moneyA", "The brain's page answers it in simple words, based on when you might need the money. Most of the time the answer is the same calm one: own the whole market and leave it alone.",
  "העמוד של המוח עונה על זה במילים פשוטות, לפי מתי ייתכן שיהיה צורך בכסף. רוב הזמן התשובה היא אותה תשובה רגועה: להחזיק את השוק כולו ולא לגעת.");
add("today.brainAnswer", "The brain's answer", "התשובה של המוח");
add("today.comingUp", "Coming up · next {n} days", "בקרוב · {n} הימים הבאים");
add("today.held", "held", "בתיק");
add("today.picked", "picked", "נבחרה");
add("today.results", "Results", "תוצאות");
add("today.event", "Company event", "אירוע של החברה");
add("today.expected", " · expected", " · משוער");
add("today.noResults", "No results days in the next {n} days.", "אין ימי תוצאות ב-{n} הימים הבאים.");
add("today.after", "After that: {t} reports {date} ({in}).", "אחר כך: {t} מפרסמת תוצאות, {date} ({in}).");
add("today.undated", "No date announced yet for {list}.", "עדיין לא הוכרז תאריך עבור {list}.");
add("today.reportCard", "A results day is like a report card: the stock can jump a lot either way. It is not a sign to buy or sell.",
  "יום תוצאות הוא כמו יום חלוקת תעודות: המניה יכולה לקפוץ הרבה לכל כיוון. זה לא סימן לקנות או למכור.");
add("today.learned", "What the tests showed", "מה הבדיקות הראו");
add("today.head.helped.a", "The site's checks", "הבדיקות של האתר");
add("today.head.helped.b", "helped.", "עזרו.");
add("today.head.hint.a", "A hint of help,", "רמז לעזרה,");
add("today.head.hint.b", "nothing proven.", "שום דבר לא הוכח.");
add("today.head.luck.a", "The site's checks haven't", "הבדיקות של האתר");
add("today.head.luck.b", "beaten luck.", "לא ניצחו את המזל.");
add("today.tested", "The site's stock-picking rule was tested on years of past prices. It beat only {n} baskets of stocks picked at random; plain luck would beat about half.",
  "כלל בחירת המניות של האתר נבדק על שנים של מחירי עבר. הוא ניצח רק {n} סלים של מניות שנבחרו באקראי; מזל לבדו היה מנצח בערך חצי.");
add("today.nOf100", "{n} out of every 100", "{n} מתוך כל 100");
add("today.br.edge", "Stocks that passed the site's checks did better than the whole market afterwards.", "מניות שעברו את הבדיקות של האתר הצליחו אחר כך יותר מהשוק כולו.");
add("today.br.better", "Stocks that passed the site's checks did a tiny bit better than the others, not enough to trust.", "מניות שעברו את הבדיקות של האתר הצליחו טיפה יותר מהאחרות, לא מספיק כדי לסמוך על זה.");
add("today.br.none", "Stocks that passed the site's checks did no better than the ones that failed.", "מניות שעברו את הבדיקות של האתר לא הצליחו יותר מאלה שנכשלו.");
add("today.lesson", "A lesson that fits today", "שיעור שמתאים להיום");
add("today.empty.checklist", "No checklist changes worth a line yet.", "עדיין אין שינויים ברשימת הבדיקה ששווים שורה.");
add("today.empty.checklistLater", "The technical checklist's day-to-day changes appear after the next daily run.", "השינויים היומיים ברשימת הבדיקה הטכנית יופיעו אחרי הריצה היומית הבאה.");
add("today.empty.brainSample", "Brain runs show here once its picks are real; this build uses sample picks.", "הריצות של המוח יופיעו כאן כשהבחירות שלו יהיו אמיתיות; הגרסה הזו משתמשת בבחירות לדוגמה.");
add("today.empty.brain", "No brain runs yet.", "עדיין אין ריצות של המוח.");
add("today.empty.people", "No logged public calls yet.", "עדיין לא נרשמו עמדות פומביות.");
add("today.empty.companies", "No dated company news yet.", "עדיין אין חדשות חברות עם תאריך.");
add("today.empty.market", "Market closes appear after the next daily run.", "סגירות המסחר יופיעו אחרי הריצה היומית הבאה.");
add("today.empty.all", "Nothing in the feed yet.", "הפיד עדיין ריק.");
add("today.feedLabel", "Feed", "פיד");
add("today.feed", "The feed", "הפיד");
add("today.newestFirst", "newest first", "החדש ביותר למעלה");
add("today.feedIntro", "Everything that happened, newest first, like a diary: how the market closed, big jumps, what the brain said, company news and what famous investors said. Tap one to open it.",
  "כל מה שקרה, מהחדש לישן, כמו יומן: איך נסגר המסחר, קפיצות גדולות, מה אמר המוח, חדשות של חברות ומה אמרו משקיעים מפורסמים. הקשה על פריט פותחת אותו.");
add("today.show", "Show", "הצגה");
add("today.sampleChecklist", "Checklist items here come from sample prices, not the market.", "פריטי רשימת הבדיקה כאן מבוססים על מחירי דוגמה, לא על השוק.");
add("today.ahead", "Ahead", "בהמשך");
add("today.showMore", "Show more", "להציג עוד");
add("today.older", "{n} older", "{n} פריטים ישנים יותר");
add("today.unusual", "Unusual move", "תנועה חריגה");
add("today.digest", "Checklist digest", "סיכום רשימת הבדיקה");
add("today.latestClose", " · latest close", " · הסגירה האחרונה");

/* ============================================================ tabs/Details.jsx: the market details page */

// the hero verdict (todayCall)
add("det.head.stale", "The numbers are old.", "המספרים ישנים.");
add("det.accent.stale", "Don't act on them.", "לא לפעול לפיהם.");
add("det.head.swap", "Monthly swap day.", "יום ההחלפה החודשי.");
add("det.accent.swap", "Only the rule's list changes.", "רק הרשימה של הכלל משתנה.");
add("det.head.calm", "Nothing to do today.", "היום אין מה לעשות.");
add("det.accent.leave", "Everything stays as it is.", "הכול נשאר כמו שהוא.");
add("det.accent.core", "The plan stays in the whole-market fund.", "התוכנית נשארת בקרן על כל השוק.");
add("det.v.jump", "What the market did at this close", "מה עשה השוק בסגירה הזו");
add("det.v.close", "Market close · {date}", "סגירת המסחר · {date}");
add("det.v.sample", "Sample prices · {date}", "מחירי דוגמה · {date}");
add("det.v.daysOld", { one: " · {count} day old", other: " · {count} days old" }, { one: " · לפני יום", two: " · לפני יומיים", other: " · לפני {count} ימים" });
add("det.v.stale", "The newest market close in the data is {date}. The daily job that fetches prices may have failed; the Routines page shows what ran, so check it before reading anything else.",
  "סגירת המסחר החדשה ביותר בנתונים היא מ-{date}. ייתכן שהמשימה היומית שמביאה מחירים נכשלה; עמוד המשימות המתוזמנות מראה מה רץ, ולכן יש לבדוק אותו לפני שקוראים כל דבר אחר.");
add("det.v.real", "In this plan, real money follows the brain's honest action: usually a fund that holds the whole market, bought a little at a time.",
  "בתוכנית הזו, הכסף האמיתי הולך לפי הצעד המפוכח של המוח: בדרך כלל קרן שמחזיקה את כל השוק, שנקנית קצת בכל פעם.");
add("det.v.game", "Separately, the rule plays a game with pretend money to learn if picking stocks works.",
  "בנפרד, הכלל משחק בכסף מדומה כדי ללמוד אם בחירת מניות עובדת.");
add("det.v.holds", "Its pretend portfolio holds {list}", "התיק המדומה שלו מחזיק {list}");
add("det.v.wouldHold", "It would hold {list}", "הוא היה מחזיק {list}");
add("det.v.noStocks", "no stocks", "אף מניה");
add("det.v.andCore", " and {pct} in the whole-market fund", " ו-{pct} בקרן על כל השוק");
add("det.v.looksAgain", "; it looks again on {date}.", "; הבדיקה הבאה ב-{date}.");
add("det.v.tested", "Tested on past prices, the result is {word}: it did better than {pct} of random picks from the same list.",
  "במבחן על מחירי עבר, התוצאה: {word}. הכלל הצליח יותר מ-{pct} מהבחירות האקראיות מאותה רשימה.");
add("det.v.word.passes_history", "passed the test on past prices", "הצלחה במבחן");
add("det.v.word.candidate", "promising, not proven", "מבטיחה, אבל לא מוכחת");
add("det.v.word.inconclusive", "unclear", "לא חד-משמעית");
add("det.v.word.rejected", "failed", "כישלון");
add("det.v.stage", "Trust stage {stage}: a small side bet, within this site's limits.", "שלב {stage} בסולם האמון: הימור צדדי קטן, בגבולות הכללים של האתר.");
add("det.v.notYet", "No real money follows the rule until trust stage 2: {met} conditions met.", "שום כסף אמיתי לא הולך לפי הכלל עד שלב 2 בסולם האמון: {met} תנאים התקיימו.");
add("det.v.metOf", "{met} of {n}", "{met} מתוך {n}");
add("det.v.routines", "Open routines", "לפתוח את המשימות המתוזמנות");
add("det.v.goal", "Is {goal} a year realistic?", "האם {goal} בשנה זה מציאותי?");
add("det.v.portfolio", "The pretend portfolio", "התיק המדומה");
add("det.v.marketLink", "What the market did at the close", "מה עשה השוק בסגירה");

// what the market did
add("det.md.eyebrowLive", "What the market did · {date}", "מה עשה השוק · {date}");
add("det.md.eyebrowSample", "Sample prices, not the market · {date}", "מחירי דוגמה, לא השוק · {date}");
add("det.md.who.market", "The market", "השוק");
add("det.md.who.ndx", "The Nasdaq-100", "מדד Nasdaq-100");
add("det.md.lastA", "The last", "הסגירה");
add("det.md.lastB", "close.", "האחרונה.");
// "and" sits inside the last part: Hebrew joins ו to its word ("ואחת ירדה", "ו-3 ירדו").
add("det.md.counted", "Of the {n} companies on this list, {up} {down}.", "מתוך {n} החברות ברשימה, {up} {down}.");
add("det.md.countedFlat", "Of the {n} companies on this list, {up}, {down} {flat}.", "מתוך {n} החברות ברשימה, {up}, {down} {flat}.");
add("det.md.up", { other: "{count} went up" }, { zero: "אף אחת לא עלתה", one: "אחת עלתה", other: "{count} עלו" });
add("det.md.down", { other: "{count} went down" }, { zero: "אף אחת לא ירדה", one: "אחת ירדה", other: "{count} ירדו" });
add("det.md.andDown", { other: "and {count} went down" }, { zero: "ואף אחת לא ירדה", one: "ואחת ירדה", other: "ו-{count} ירדו" });
add("det.md.andFlat", { other: "and {count} stayed the same" }, { one: "ואחת לא זזה", other: "ו-{count} לא זזו" });
add("det.md.notCounted", "How the companies on this list moved shows up after the next daily run.", "איך זזו החברות ברשימה יופיע אחרי הריצה היומית הבאה.");
add("det.md.ledeTail", "Each number is how much the price changed since the day before. Tap a company to see more.",
  "כל מספר הוא השינוי במחיר לעומת היום הקודם. הקשה על חברה פותחת עוד פרטים.");
add("det.md.spxLater", "Its move for the day shows up after the next daily run.", "התנועה היומית שלו תופיע אחרי הריצה היומית הבאה.");
add("det.md.spxDesc", "The whole US market: about 500 big companies in one number.", "כל השוק האמריקאי: בערך 500 חברות גדולות במספר אחד.");
add("det.md.benchDesc", "The benchmark this site compares against: the 100 biggest Nasdaq companies, mostly tech.",
  "מדד הייחוס שהאתר משווה אליו: 100 החברות הגדולות ב-Nasdaq, רובן טכנולוגיה.");
add("det.md.upDown", "companies up/down", "חברות שעלו/ירדו");
add("det.md.upDownDesc", "{counted} of the {n} companies on this list.", "{counted} מתוך {n} החברות ברשימה.");
add("det.md.breadth", "above their usual level", "מעל הרמה הרגילה שלהן");
add("det.md.breadthDesc", "How many of the companies on this list trade above their average price of the last 50 days. More means more companies are joining in.",
  "כמה מהחברות ברשימה נסחרות מעל ממוצע 50 הימים שלהן. יותר פירושו שיותר חברות מצטרפות.");
add("det.md.risers", "Went up the most", "עלו הכי הרבה");
add("det.md.fallers", "Went down the most", "ירדו הכי הרבה");
add("det.md.noneRose", "None rose.", "אף אחת לא עלתה.");
add("det.md.noneFell", "None fell.", "אף אחת לא ירדה.");
add("det.md.bySector", "By industry", "לפי ענף");
add("det.md.why", "Why it moved", "למה זה זז");
add("det.md.onList", "on the {list} list", "ברשימת {list}");
add("det.md.spxPending", "The {name}'s move for the day shows up after the next daily run.", "התנועה היומית של {name} תופיע אחרי הריצה היומית הבאה.");
add("det.md.atHigh", "The {name} is at its highest point of the past year.", "{name} נמצא בנקודה הגבוהה ביותר שלו בשנה האחרונה.");
add("det.md.belowHigh", "The {name} is {pct} below its highest point of the past year.", "{name} נמוך ב-{pct} מהנקודה הגבוהה ביותר שלו בשנה האחרונה.");
add("det.md.breadthLine", "{pct} of the companies on this list trade above their average price of the last 50 days.", "{pct} מהחברות ברשימה נסחרות מעל ממוצע 50 הימים שלהן.");
add("det.md.notesSay", "The notes above say why, in the site's own words with links; the numbers come from the site's data.",
  "ההסברים למעלה אומרים למה, במילים של האתר ועם קישורים; המספרים מגיעים מהנתונים של האתר.");
add("det.md.noWhy", "This shows what moved, not why: a note on why is added only when a move is unusual, and none has been written yet.",
  "כאן רואים מה זז, לא למה: הסבר מתווסף רק כשהתנועה חריגה, ועדיין לא נכתב אף הסבר.");
add("det.md.behind", "This shows what moved, not why: a note on why is added only when a move is unusual, a few hours after this day's numbers arrive.",
  "כאן רואים מה זז, לא למה: הסבר מתווסף רק כשהתנועה חריגה, כמה שעות אחרי שהמספרים של היום מגיעים.");
add("det.md.whatNotWhy", "This shows what moved, not why: a note on why is added only when a move is unusual.",
  "כאן רואים מה זז, לא למה: הסבר מתווסף רק כשהתנועה חריגה.");
add("det.md.closeTime", "The US market closes at 4 pm New York time (20:00 UTC; 21:00 in winter) and this site's data arrives after the nightly run, so this updates overnight.",
  "המסחר בארה״ב נסגר בארבע אחר הצהריים לפי שעון ניו יורק (בשעה 20:00 לפי שעון UTC, ובחורף בשעה 21:00), והנתונים של האתר מגיעים אחרי הריצה הלילית, כך שהעמוד מתעדכן במהלך הלילה.");

// results days coming up
add("det.cu.title", "Coming up · results days", "בקרוב · ימי תוצאות");
add("det.cu.next", "next {n} days", "{n} הימים הבאים");
add("det.cu.first", "In the pretend portfolio or picked by the brain", "בתיק המדומה או בבחירות של המוח");
add("det.cu.others", "Others on the list", "שאר החברות ברשימה");
add("det.cu.undated", "No date announced yet:", "עדיין לא הוכרז תאריך:");
add("det.cu.explain", "In simple words: a few times a year each company tells everyone how much it earned. On that day the price can jump or drop a lot, either way. It is a bumpy day, not a sign to do anything. \"Expected\" means the company has not confirmed the date yet.",
  "במילים פשוטות: כמה פעמים בשנה כל חברה מספרת לכולם כמה היא הרוויחה. ביום הזה המחיר יכול לקפוץ או לרדת הרבה, לכל כיוון. זה יום סוער, לא סימן לעשות משהו. ״משוער״ פירושו שהחברה עוד לא אישרה את התאריך.");

// people
add("det.people.title", "People this site learns from", "משקיעים שהאתר לומד מהם");
add("det.people.lead",
  { one: "A well-known investor said something public about companies in the pretend portfolio or picked by the brain:", other: "{count} public opinions from well-known investors are about companies in the pretend portfolio or picked by the brain:" },
  { one: "משקיע ידוע אמר משהו בפומבי על חברות בתיק המדומה או בבחירות של המוח:", two: "שתי עמדות פומביות של משקיעים ידועים עוסקות בחברות בתיק המדומה או בבחירות של המוח:", other: "{count} עמדות פומביות של משקיעים ידועים עוסקות בחברות בתיק המדומה או בבחירות של המוח:" });
add("det.people.item", "{t} {stance} by {via} ({kind} {date}): {status}", "{t}: עמדה {stance} של {via} ({kind}, {date}): {status}");
add("det.people.13f", "from a required holdings filing", "מתוך דיווח החזקות חובה");
add("det.people.public", "public", "פומבית");
add("det.people.tail", ". Just for background: each opinion is checked later against the whole-market fund.", ". רק לרקע: כל עמדה נבדקת מאוחר יותר מול הקרן על כל השוק.");
add("det.people.button", "Their calls", "העמדות שלהם");

// the brain's picks
add("det.picks.eyebrow", "The brain · {date}", "המוח · {date}");
add("det.picks.titleA", "What the brain", "מה המוח");
add("det.picks.titleB", "flagged.", "סימן.");
add("det.picks.lede", "The brain runs by itself every market day. Each pick is a guess (up or down), the reason for it, and what would prove it wrong. Later, code checks whether the guess came true. These are ideas to learn from, not things to buy.",
  "המוח רץ מעצמו בכל יום מסחר. כל בחירה היא ניחוש (עלייה או ירידה), הסיבה לו, ומה יוכיח שהוא שגוי. אחר כך קוד בודק אם הניחוש התממש. אלה רעיונות ללמוד מהם, לא דברים לקנות.");
add("det.pick.stance.bullish", "leaning up", "נטייה לעלייה");
add("det.pick.stance.bearish", "leaning down", "נטייה לירידה");
add("det.pick.stance.neutral", "just watching", "רק במעקב");
add("det.pick.checked", "checked in {n} market days", "הבדיקה: כעבור {n} ימי מסחר");
add("det.pick.risks", "What could go wrong", "מה יכול להשתבש");
add("det.pick.wrongIf", "Proven wrong if", "יתברר כשגוי אם");
add("det.pick.priceThen", "price then {price}", "המחיר אז {price}");
add("det.pick.fromClose", "from the close of", "ממחיר הסגירה של");
add("det.footer", "A research notebook, not investment advice. Every number on this page is computed by code from public market data.",
  "מחברת מחקר, לא ייעוץ השקעות. כל מספר בעמוד הזה מחושב בקוד מנתוני שוק ציבוריים.");

/* ============================================================ components/goal.jsx: the goal, the pretend portfolio, the mood, base rates */

for (const [k, e, h] of [
  ["kept", "Held", "בתיק"], ["added", "New this month", "חדשה החודש"], ["fails_checks", "Did not pass the checks", "לא עברה את הבדיקות"],
  ["stretched", "Rose too fast: wait", "עלתה מהר מדי: ממתינה"], ["slots_full", "No free seat", "אין מושב פנוי"],
  ["sector_cap", "Its industry already has 2", "בענף שלה כבר יש 2"], ["too_correlated", "Moves like one already held", "זזה כמו מניה שכבר בתיק"],
  ["no_history", "Too new to judge", "חדשה מדי כדי לשפוט"],
]) add(`goal.status.${k}`, e, h);
add("goal.label.rule", "The rule's pretend picks ({range})", "הבחירות המדומות של הכלל ({range})");
add("goal.label.equal", "All {n}, equal amounts", "כל {n} החברות, בסכומים שווים");
add("goal.label.core", "{core} (whole market)", "{core} (כל השוק)");
add("goal.pending.title", "Shows up after the next daily run", "יופיע אחרי הריצה היומית הבאה");
add("goal.pending.goal", "The goal check is worked out from all past prices by the daily job.", "בדיקת היעד מחושבת מכל מחירי העבר במשימה היומית.");
add("goal.pending.portfolio", "The pretend portfolio is worked out from all past prices by the daily job.", "התיק המדומה מחושב מכל מחירי העבר במשימה היומית.");

add("goal.eyebrow", "The goal", "היעד");
add("goal.eyebrowSample", "The goal · sample prices", "היעד · מחירי דוגמה");
add("goal.eyebrowYears", "The goal · {years} years of real prices", "היעד · {years} שנים של מחירים אמיתיים");
add("goal.titleA", "{goal} a year.", "{goal} בשנה.");
add("goal.titleB", "Is it realistic?", "האם זה מציאותי?");
add("goal.ledeShort", "In simple words: very hard. A fund that holds the whole market has made close to 10% a year on average over the long run.",
  "במילים פשוטות: קשה מאוד. קרן שמחזיקה את כל השוק הניבה לאורך זמן בממוצע קרוב ל-10% בשנה.");
add("goal.lede", "In simple words: very hard. A fund that holds the whole market has made close to {ten} on average over the long run, so {goal} means beating it by a lot, year after year. {goal} would double the money every {years} ({m5} in 5 years, {m10} in 10). Below: what really happened from {from} to {to}, worked out by code.",
  "במילים פשוטות: קשה מאוד. קרן שמחזיקה את כל השוק הניבה לאורך זמן בממוצע קרוב ל-{ten}, כך ש-{goal} פירושו לנצח אותה בפער גדול, שנה אחרי שנה. בקצב של {goal} הכסף היה מוכפל כל {years} ({m5} בתוך 5 שנים, {m10} בתוך 10). למטה: מה קרה באמת מ-{from} עד {to}, כפי שחושב בקוד.");
add("goal.tenPct", "10% a year", "10% בשנה");
add("goal.nYears", "{n} years", "{n} שנים");
add("goal.series", "Goal {goal}/yr", "יעד {goal} בשנה");
add("goal.perYearAvg", "a year, on average", "בשנה, בממוצע");
add("goal.row.hit", "Years with {goal} or more", "שנים עם {goal} או יותר");
add("goal.row.loss", "Years that lost money", "שנים עם הפסד");
add("goal.row.worst", "Worst year", "השנה הגרועה ביותר");
add("goal.row.dd", "Biggest drop", "הירידה הגדולה ביותר");
add("goal.yearNote", "A \"year\" here is any 12 months in a row, whatever week it starts ({n} of them in all), not just January to December. \"Biggest drop\" is the largest fall from a high point before it recovered.",
  "״שנה״ כאן היא כל 12 חודשים רצופים, בלי קשר לשבוע שבו הם מתחילים (בסך הכול {n} כאלה), לא רק ינואר עד דצמבר. ״הירידה הגדולה ביותר״ היא הנפילה הגדולה ביותר מנקודת שיא לפני שהמחיר התאושש.");
add("goal.chartLabel", "Growth of 100 since {from}: the rule's pretend picks, all companies in equal amounts, the whole-market fund and the benchmark, against the goal path",
  "צמיחה של 100 מאז {from}: הבחירות המדומות של הכלל, כל החברות בסכומים שווים, הקרן על כל השוק ומדד הייחוס, מול מסלול היעד");
add("goal.chartNote", "Each line starts at 100 and shows what it grew to. A steady {goal} a year is the straight dashed line. The chart is drawn so the same percentage move looks the same size, early or late. Trading costs ({bps} hundredths of a percent) are taken off the rule.",
  "כל קו מתחיל ב-100 ומראה לכמה הוא צמח. קצב קבוע של {goal} בשנה מסומן בקו המקווקו הישר. הגרף משורטט כך ששינוי זהה באחוזים נראה באותו גודל, בהתחלה או בסוף. עלויות מסחר ({bps} מאיות האחוז) מנוכות מהכלל.");
add("goal.means", "What this means", "מה זה אומר");
add("goal.perYear", "{pct} a year", "{pct} בשנה");
add("goal.coreMade", "The whole-market fund ({core}) made {cagr} and reached {goal} in {hit} of 12-month stretches.",
  "הקרן על כל השוק ({core}) הניבה {cagr} והגיעה ל-{goal} ב-{hit} מתקופות 12 החודשים.");
add("goal.coreBelow", "The goal is more than the whole market made.", "היעד גבוה ממה שהשוק כולו הניב.");
add("goal.coreStrong", "These were unusually strong years: over the long run the whole market averages closer to 10% a year.",
  "אלה היו שנים חזקות במיוחד: לאורך זמן השוק כולו מניב בממוצע קרוב יותר ל-10% בשנה.");
add("goal.ptsYear", "{pts} points a year", "{pts} נקודות אחוז בשנה");
add("goal.better", "The rule's picks did better than simply holding all {n} companies by {gap}, with a biggest drop of {a} vs {b}. That gap is what the picking itself added or cost.",
  "הבחירות של הכלל הצליחו יותר מהחזקה פשוטה של כל {n} החברות, ב-{gap}, עם ירידה גדולה ביותר של {a} לעומת {b}. הפער הזה הוא מה שהבחירה עצמה הוסיפה או עלתה.");
add("goal.worse", "The rule's picks did worse than simply holding all {n} companies by {gap}, with a biggest drop of {a} vs {b}. That gap is what the picking itself added or cost.",
  "הבחירות של הכלל הצליחו פחות מהחזקה פשוטה של כל {n} החברות, ב-{gap}, עם ירידה גדולה ביותר של {a} לעומת {b}. הפער הזה הוא מה שהבחירה עצמה הוסיפה או עלתה.");
add("goal.winners", "Every line that beat {goal} here also fell {dd} or more from a high point along the way. Like a roller coaster: the higher the ride, the deeper the dips.",
  "כל קו שעבר כאן את {goal} גם ירד ב-{dd} או יותר מנקודת שיא בדרך. כמו רכבת הרים: ככל שהנסיעה גבוהה יותר, הירידות עמוקות יותר.");
add("goal.noWinners", "Nothing here reached {goal} a year over the whole time, and the biggest drops ran from {a} to {b}.",
  "שום דבר כאן לא הגיע ל-{goal} בשנה לאורך כל התקופה, והירידות הגדולות ביותר נעו בין {a} ל-{b}.");
add("goal.caveats", "Read this before trusting the numbers", "לקרוא את זה לפני שסומכים על המספרים");
add("goal.hindsight.b", "Picked with hindsight.", "נבחר בדיעבד.");
add("goal.hindsight", "The list of companies was chosen today, already knowing they did well. It is like betting on a race after seeing who won: any test on it looks better than real life. Compare the lines with each other, not with the goal.",
  "רשימת החברות נבחרה היום, כשכבר ידוע שהן הצליחו. זה כמו להמר על מרוץ אחרי שרואים מי ניצח: כל מבחן עליה נראה טוב יותר מהחיים האמיתיים. את הקווים יש להשוות זה לזה, לא ליעד.");
add("goal.oneStretch.b", "Only one stretch of time.", "רק תקופה אחת.");
add("goal.oneStretch", "{years} years, mostly great years for big US tech companies. Another ten years can look very different.",
  "{years} שנים, רובן שנים מצוינות לחברות הטכנולוגיה הגדולות בארה״ב. עשר השנים הבאות יכולות להיראות אחרת לגמרי.");
add("goal.pretendOnly.b", "Pretend money only.", "רק כסף מדומה.");
add("goal.pretendOnly", "The rule's picks are an experiment with pretend money, not where the plan's real money goes. Only the pretend record kept from now on (below) counts as real evidence.",
  "הבחירות של הכלל הן ניסוי בכסף מדומה, לא המקום שאליו הולך הכסף האמיתי של התוכנית. רק הרישום המדומה שנשמר מעכשיו והלאה (למטה) נחשב לראיה אמיתית.");

add("goal.pf.eyebrowEmpty", "The pretend portfolio", "התיק המדומה");
add("goal.pf.seats", "{n} seats.", "{n} מושבים.");
add("goal.pf.pretend", "Pretend money.", "כסף מדומה.");
add("goal.pf.eyebrow", "Pretend portfolio · rule {v}", "תיק מדומה · כלל {v}");
add("goal.pf.record", " · pretend record", " · רישום מדומה");
add("goal.pf.since", " · since {date}", " · מאז {date}");
add("goal.pf.nextLook", " · next look {date}", " · הבדיקה הבאה {date}");
add("goal.pf.companies", { zero: "No companies", one: "{count} company", other: "{count} companies" }, { zero: "אין חברות", one: "חברה אחת", two: "שתי חברות", other: "{count} חברות" });
add("goal.pf.core", "{pct} whole market.", "{pct} בקרן על כל השוק.");
add("goal.pf.full", ", every seat taken.", ", כל המושבים תפוסים.");
add("goal.pf.lede", "In simple words: this is an experiment with pretend money, to learn whether picking a few stocks beats just owning the whole market. It is not where the plan's real money goes. The rule works like a table with {slots} seats: at most {max} from the same industry. A new company needs to pass {entry} of 4 checks and must not have risen too fast; a company already seated stays while it passes {keep}. Empty seats sit in the whole-market fund. It changes seats once a month.",
  "במילים פשוטות: זה ניסוי בכסף מדומה, כדי ללמוד אם בחירה של כמה מניות מנצחת פשוט החזקה של השוק כולו. זה לא המקום שאליו הולך הכסף האמיתי של התוכנית. הכלל עובד כמו שולחן עם {slots} מושבים: לכל היותר {max} מאותו ענף. חברה חדשה צריכה לעבור {entry} מתוך 4 בדיקות, ואסור שתעלה מהר מדי; חברה שכבר יושבת נשארת כל עוד היא עוברת {keep}. מושבים ריקים נשארים בקרן על כל השוק. ההחלפות קורות פעם בחודש.");
add("goal.pf.mix", "Try another mix", "לנסות תמהיל אחר");
add("goal.pf.seat", "Seat {i} · {pct}", "מושב {i} · {pct}");
add("goal.pf.passed", "passed {frac} checks", "עברה {frac} בדיקות");
add("goal.pf.coreSeat", "Whole-market fund until a company passes", "קרן על כל השוק עד שחברה תעבור את הבדיקות");
add("goal.pf.bumpy", "How bumpy this mix is · last 12 months", "עד כמה התמהיל הזה תנודתי · 12 החודשים האחרונים");
add("goal.pf.swing", "how much it typically swings in a year", "כמה הוא נע בדרך כלל בשנה");
add("goal.pf.badMonth", "a bad month (happens about 1 in 20)", "חודש רע (קורה בערך פעם ב-20)");
add("goal.pf.together", "how much they move together (0 to 1)", "כמה הן זזות יחד (0 עד 1)");
add("goal.pf.cos", { one: "{count} company", other: "{count} companies" }, { one: "חברה אחת", two: "שתי חברות", other: "{count} חברות" });
add("goal.pf.ind", { one: "industry among {cos}", other: "industries among {cos}" }, { one: "ענף בקרב {cos}", other: "ענפים בקרב {cos}" });
add("goal.pf.later", "Worked out by the next daily run.", "יחושב בריצה היומית הבאה.");
add("goal.pf.corrNote", "Near 1 means the companies rise and fall together, like eggs in one basket. Below 0.5 means they really are spread out, so one bad day hurts less.",
  "קרוב ל-1 פירושו שהחברות עולות ויורדות יחד, כמו ביצים בסל אחד. מתחת ל-0.5 פירושו שהן באמת מפוזרות, כך שיום רע אחד פוגע פחות.");
add("goal.pf.whyNot", "Why the other companies are not in", "למה שאר החברות לא בתיק");
add("goal.pf.ofChecks", "{n} of 4 checks", "{n} מתוך 4 בדיקות");
add("goal.pf.allIn", "Every company on the list is in.", "כל החברות ברשימה בתיק.");
add("goal.pf.pathOnly", "The test on past prices also holds {list}: there it keeps a company it already had while it passes {keep} checks. The pretend record started fresh on {date}, so a company needs {entry} checks to get in.",
  "המבחן על מחירי עבר מחזיק גם את {list}: שם הוא שומר חברה שכבר הייתה בתיק כל עוד היא עוברת {keep} בדיקות. הרישום המדומה התחיל מחדש ב-{date}, ולכן חברה צריכה {entry} בדיקות כדי להיכנס.");
add("goal.pf.changes",
  { one: "If the rule changed seats today it would make {count} change. It waits for the monthly date on purpose: fewer swaps, less reacting to noise.", other: "If the rule changed seats today it would make {count} changes. It waits for the monthly date on purpose: fewer swaps, less reacting to noise." },
  { one: "אם הכלל היה מחליף מושבים היום, הוא היה עושה שינוי אחד. הוא מחכה למועד החודשי בכוונה: פחות החלפות, פחות תגובה לרעש.", two: "אם הכלל היה מחליף מושבים היום, הוא היה עושה שני שינויים. הוא מחכה למועד החודשי בכוונה: פחות החלפות, פחות תגובה לרעש.", other: "אם הכלל היה מחליף מושבים היום, הוא היה עושה {count} שינויים. הוא מחכה למועד החודשי בכוונה: פחות החלפות, פחות תגובה לרעש." });
add("goal.pf.recordTitle", "Pretend record kept from now on · the only fair test", "רישום מדומה מעכשיו והלאה · המבחן ההוגן היחיד");
add("goal.pf.recordLine", "Since {date} ({decisions}, written down and never changed): rule's picks {a}, whole-market fund {b}, benchmark {sym} {c}.",
  "מאז {date} ({decisions}, שנרשמו ולא שונו מעולם): הבחירות של הכלל {a}, הקרן על כל השוק {b}, מדד הייחוס {sym} {c}.");
add("goal.pf.decisions", { one: "{count} monthly decision", other: "{count} monthly decisions" }, { one: "החלטה חודשית אחת", two: "שתי החלטות חודשיות", other: "{count} החלטות חודשיות" });
add("goal.pf.recordLater", "Starts with the next daily run. Each month the rule's picks are written down using only what was known that day, and never changed. Like sealing a guess in an envelope: nobody can tidy it up later.",
  "מתחיל בריצה היומית הבאה. בכל חודש הבחירות של הכלל נרשמות רק לפי מה שהיה ידוע באותו יום, ולא משתנות לעולם. כמו לסגור ניחוש במעטפה חתומה: אף אחד לא יכול לייפות אותו אחר כך.");
add("goal.pf.more", "More on the pretend portfolio", "עוד על התיק המדומה");

add("goal.div.title", "This list is not very spread out", "הרשימה הזו לא מפוזרת במיוחד");
add("goal.div.lead", "All {n} companies on this list are big US companies in only {ind}, {k} of them in {sector}", "כל {n} החברות ברשימה הן חברות אמריקאיות גדולות, והן מכסות רק {ind}; {k} מהן בענף {sector}");
add("goal.div.ind", { one: "{count} industry", other: "{count} industries" }, { one: "ענף אחד", two: "שני ענפים", other: "{count} ענפים" });
add("goal.div.together", ", and they move together by {avg} on a 0 to 1 scale", ", והן זזות יחד ברמה של {avg} בסולם של 0 עד 1");
add("goal.div.independent", "They look fairly independent this year, but when markets fall, companies in the same industry tend to fall together.",
  "השנה הן נראות די עצמאיות, אבל כשהשווקים נופלים, חברות מאותו ענף נוטות ליפול יחד.");
add("goal.div.oneBet", "A pretend portfolio of {range} stocks from this list moves mostly as one bet: eggs in one basket.",
  "תיק מדומה של {range} מניות מהרשימה הזו זז בעיקר כמו הימור אחד: ביצים בסל אחד.");
add("goal.div.spread", "Really spreading out would need companies from other industries (health care, banks, factories, energy, utilities). Adding them is a one-line change to the list.",
  "פיזור אמיתי היה דורש חברות מענפים אחרים (בריאות, בנקים, תעשייה, אנרגיה, תשתיות). הוספה שלהן היא שינוי של שורה אחת ברשימה.");
add("goal.div.see", "See which companies move together", "אילו חברות זזות יחד");

add("goal.ctx.eyebrow", "The market's mood · {date}", "מצב הרוח של השוק · {date}");
add("goal.ctx.titleA", "Is the market", "האם השוק");
add("goal.ctx.titleB", "helping?", "עוזר?");
add("goal.ctx.lede", "In simple words: four quick signs of the market's mood, like checking the weather before going out. They are background only, never a reason to act.",
  "במילים פשוטות: ארבעה סימנים מהירים למצב הרוח של השוק, כמו לבדוק את מזג האוויר לפני שיוצאים. הם רק רקע, אף פעם לא סיבה לפעול.");
add("goal.ctx.tf.k", "Whole-market direction", "הכיוון של השוק כולו");
add("goal.ctx.tf.up", "Up", "למעלה");
add("goal.ctx.tf.notUp", "Not up", "לא למעלה");
add("goal.ctx.tf.above", "The whole-market fund ({sym}) is above its average price of the last 10 months ({pct})", "הקרן על כל השוק ({sym}) נמצאת מעל המחיר הממוצע שלה ב-10 החודשים האחרונים ({pct})");
add("goal.ctx.tf.below", "The whole-market fund ({sym}) is below its average price of the last 10 months ({pct})", "הקרן על כל השוק ({sym}) נמצאת מתחת למחיר הממוצע שלה ב-10 החודשים האחרונים ({pct})");
add("goal.ctx.tf.made", " and made {r} in 12 months", " והניבה {r} ב-12 חודשים");
add("goal.ctx.tf.cash", ", vs {c} for cash", ", לעומת {c} במזומן");
add("goal.ctx.tf.tail", ". A slow signal, just for background: never a reason to sell or buy the fund.", ". סימן איטי, רק לרקע: אף פעם לא סיבה למכור או לקנות את הקרן.");
add("goal.ctx.cash.k", "Safe savings pay", "חיסכון בטוח מניב");
add("goal.ctx.cash.d", "A year, from short US government loans (very safe). Any stock idea has to beat this, because this needs no risk at all.",
  "בשנה, מהלוואות קצרות לממשלת ארה״ב (בטוח מאוד). כל רעיון של מניה צריך לנצח את זה, כי כאן אין שום סיכון.");
add("goal.ctx.p.k", "How many are joining in", "כמה חברות מצטרפות לעלייה");
add("goal.ctx.p.few", "Few", "מעטות");
add("goal.ctx.p.many", "Many", "רבות");
add("goal.ctx.p.some", "Some", "חלק");
add("goal.ctx.p.d", "A typical Nasdaq-100 company vs the index as a whole: {a} over 60 days", "חברה טיפוסית במדד Nasdaq-100 לעומת המדד כולו: {a} ב-60 ימים");
add("goal.ctx.p.spx", "; S&P 500: {b}", "; מדד S&P 500: {b}");
add("goal.ctx.p.tail", ". \"Few\" means a handful of giant companies are doing the lifting while most others lag.", ". ״מעטות״ פירושו שקומץ חברות ענק עושות את העבודה בזמן שרוב האחרות מפגרות.");
add("goal.ctx.credit.k", "Lenders' mood", "מצב הרוח של המלווים");
add("goal.ctx.credit.calm", "Calm", "רגוע");
add("goal.ctx.credit.nervous", "Nervous", "עצבני");
add("goal.ctx.credit.d", "Loans to riskier companies vs loans to the US government, over 60 days: {pct}. When lenders get nervous, it often shows here first.",
  "הלוואות לחברות מסוכנות יותר לעומת הלוואות לממשלת ארה״ב, ב-60 ימים: {pct}. כשהמלווים נהיים עצבניים, זה מופיע לרוב קודם כאן.");

add("goal.br.eyebrow", "Do this site's checks work? · {from} to {to} · {n} companies", "האם הבדיקות של האתר עובדות? · {from} עד {to} · {n} חברות");
add("goal.br.edgeA", "The checks", "הבדיקות");
add("goal.br.edgeB", "helped.", "עזרו.");
add("goal.br.betterA", "Slightly better.", "קצת יותר טוב.");
add("goal.br.betterB", "Not proven.", "לא הוכח.");
add("goal.br.noneA", "No advantage", "לא נמצא");
add("goal.br.noneB", "found.", "יתרון.");
add("goal.br.lede", "In simple words: what happened in the past when a company passed this site's checks, compared with when it did not. Every {step} market days in the past, each company got a grade from the 4 checks; {h} days later the code looked at whether it did better than the benchmark ({sym}). The list was picked with hindsight, so this only compares passing with not passing.",
  "במילים פשוטות: מה קרה בעבר כשחברה עברה את הבדיקות של האתר, לעומת כשלא עברה. כל {step} ימי מסחר בעבר, כל חברה קיבלה ציון מ-4 הבדיקות; {h} ימים אחר כך הקוד בדק אם היא הצליחה יותר ממדד הייחוס ({sym}). הרשימה נבחרה בדיעבד, ולכן זו רק השוואה בין מי שעברה למי שלא.");
add("goal.br.passed", "Passed the checks", "עברו את הבדיקות");
add("goal.br.failed", "Did not pass", "לא עברו");
add("goal.br.passNote", "on average per {h} days vs {sym} · beat it {hit} of the time · {n} cases", "בממוצע לכל {h} ימים מול {sym} · ניצחו אותו ב-{hit} מהפעמים · {n} מקרים");
add("goal.br.failNote", "beat it {hit} of the time · {n} cases", "ניצחו אותו ב-{hit} מהפעמים · {n} מקרים");
add("goal.br.range", "For companies that passed, the true result is very likely (90% sure) between {a} and {b}.", "לחברות שעברו, התוצאה האמיתית נמצאת, בביטחון של 90%, בין {a} ל-{b}.");
add("goal.br.aboveZero", "Even the low end is above zero.", "גם הקצה הנמוך מעל אפס.");
add("goal.br.luck", "That range includes zero, so it could just be luck.", "הטווח הזה כולל את האפס, כך שזה יכול להיות סתם מזל.");
add("goal.br.ladder", "To move up the trust ladder, the low end must be above zero.", "כדי לעלות בסולם האמון, הקצה הנמוך צריך להיות מעל אפס.");
add("goal.br.byScore", "By how many of the 4 checks passed (dot: average; bar: likely range)", "לפי כמה מתוך 4 הבדיקות עברו (נקודה: ממוצע; פס: הטווח הסביר)");
add("goal.br.of4", "{n} of 4", "{n} מתוך 4");
add("goal.br.tooFew", "too few cases", "מעט מדי מקרים");

export default { en, he };
