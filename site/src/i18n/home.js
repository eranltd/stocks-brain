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
add("news.call.neutral", "{by} is on the fence about {name}.", "{by}: עמדה מתלבטת לגבי {name}.");
add("news.call.other", "{by} spoke about {name}.", "{by}: התייחסות ל-{name}.");

// chips and tags on the top-stocks cards
add("chip.lean_up", "Going up", "נטייה לעלייה");
add("chip.mixed", "Mixed", "תמונה מעורבת");
add("chip.lean_down", "Going down", "נטייה לירידה");
add("tag.held", "in the pretend portfolio", "בתיק ההשקעות המדומה");
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
add("mix.profit", "Most growth", "הכי הרבה צמיחה");
add("mix.calm", "Growth for the bumps", "צמיחה ביחס לטלטלות");
add("mix.smooth", "Smallest drop", "הירידה הקטנה ביותר");

/* ============================================================ lib/spotlight.js and lib/carousel.js */

add("spot.who.chips", "chip makers as a group", "יצרניות השבבים כקבוצה");
add("spot.who.tech", "the Nasdaq-100", "מדד Nasdaq-100");
add("spot.who.energy", "energy companies as a group", "חברות האנרגיה כקבוצה");
add("spot.who.other", "its group", "הקבוצה שלה");
add("spot.more", "Over the past year it rose more than {who}. A past rise does not promise the next one.",
  "בשנה האחרונה היא עלתה יותר מאשר {who}. עלייה בעבר אינה מבטיחה עלייה נוספת.");
add("spot.worse", "Over the past year it did worse than {who}. A past rise does not promise the next one.",
  "בשנה האחרונה היא הצליחה פחות מאשר {who}. עלייה בעבר אינה מבטיחה עלייה נוספת.");
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
  "רמז, לא הבטחה: במבחנים של האתר עצמו, צורות של נרות לא הצליחו יותר ממזל.");

/* ============================================================ lib/weekly.js: the weekly game */

add("wk.rule.weekly_swing.name", "Weekly Swing", "התנופה השבועית");
add("wk.rule.weekly_swing.what", "Each week: the five names that beat the market most over the last month.",
  "בכל שבוע: חמש המניות שהקדימו את השוק בפער הגדול ביותר בחודש האחרון.");
add("wk.rule.five_leaders_weekly.name", "Five Leaders, weekly", "חמש המובילות, שבועי");
add("wk.rule.five_leaders_weekly.what", "Each week: the strongest steady climbers of the past year.",
  "בכל שבוע: המניות שטיפסו בצורה החזקה והיציבה ביותר בשנה האחרונה.");
add("wk.hist.none", "Not tested on past prices yet: the next nightly run does it.", "עדיין לא נבדק על מחירי עבר: הריצה הלילית הבאה תבדוק.");
add("wk.hist.passed", "On past prices it beat {p} out of 100 random picks: good enough to keep playing on paper.",
  "על מחירי עבר הכלל ניצח {p} מתוך 100 בחירות אקראיות: מספיק טוב כדי להמשיך לשחק בכסף מדומה.");
add("wk.hist.failed", "On past prices it beat only {p} out of 100 random picks; luck alone beats about half. Not good enough for real money.",
  "על מחירי עבר הכלל ניצח רק {p} מתוך 100 בחירות אקראיות; מזל לבדו מנצח בערך חצי. לא מספיק טוב לכסף אמיתי.");
add("wk.score.none", "Starts with the next weekly review.", "מתחיל בסקירה השבועית הבאה.");
add("wk.score.early", "Week {weeks}: too early to score. It is checked again every week.", "שבוע {weeks}: מוקדם מדי לתת ציון. הבדיקה חוזרת כל שבוע.");
const LUCK_EN = "A few weeks prove nothing: luck swings this much.", LUCK_HE = "כמה שבועות לא מוכיחים כלום: גם מזל לבדו מזיז את התוצאות כך.";
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
add("feed.growth.up", ", up {pct} from a year earlier", ", עלייה של {pct} לעומת שנה קודם");
add("feed.growth.down", ", down {pct} from a year earlier", ", ירידה של {pct} לעומת שנה קודם");
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
add("feed.people.right", "{name}'s {t} call judged right at {weeks} weeks", "התחזית של {name} על {t} נבדקה אחרי {weeks} שבועות: צדקה");
add("feed.people.wrong", "{name}'s {t} call judged wrong at {weeks} weeks", "התחזית של {name} על {t} נבדקה אחרי {weeks} שבועות: טעתה");
add("feed.people.vs", "{pct} for the call against the S&P 500 core.", "{pct} לתחזית, בהשוואה לקרן הליבה על מדד S&P 500.");
add("feed.right", "right", "צדקה");
add("feed.wrong", "wrong", "טעתה");
add("feed.verdict.lean_up", "lean up", "נטייה לעלייה");
add("feed.verdict.mixed", "mixed", "מעורב");
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
  "מניות יכולות לרדת הרבה בתוך כמה חודשים, כמו סערה פתאומית.{scary} אם הכסף נחוץ בדיוק אז, צריך למכור בזמן גרוע.");
add("money.short.risk", "Safe money grows slowly, but it is there when you need it.", "כסף בטוח צומח לאט, אבל הוא שם כשצריך אותו.");
add("money.medium.title", "Split it: part safe, part whole market.", "לחלק: חלק בטוח, חלק בשוק כולו.");
add("money.medium.s1", "Put part in {cash}.{pays}", "לשים חלק ב{cash}.{pays}");
add("money.medium.s2", "Put the rest in {fund}, a little every week.", "את השאר להשקיע ב{fund}, קצת בכל שבוע.");
add("money.medium.s3", "The sooner you need the money, the bigger the safe part: about half and half at five years, mostly safe when it is a year or two away.",
  "ככל שהכסף נחוץ מוקדם יותר, החלק הבטוח גדל: בערך חצי-חצי כשנשארו חמש שנים, ורובו בטוח כשנשארו שנה או שנתיים.");
add("money.medium.why", "The safe part is there when you need it; the market part can grow.{history}", "החלק הבטוח זמין כשצריך אותו; החלק שבשוק יכול לצמוח.{history}");
add("money.medium.risk", "The market part can drop a lot along the way.", "החלק שבשוק יכול לרדת הרבה בדרך.");
add("money.medium.riskWorst", "The market part can drop a lot along the way: its worst twelve months in the site's data lost {pct}.",
  "החלק שבשוק יכול לרדת הרבה בדרך: בשנים-עשר החודשים הגרועים ביותר בנתוני האתר הוא הפסיד {pct}.");
add("money.long.title", "Buy the whole market, a little every week, and leave it alone.", "לקנות את השוק כולו, קצת בכל שבוע, ולא לגעת.");
add("money.long.s1", "Put it in {fund}.", "להשקיע את הכסף ב{fund}.");
add("money.long.s2", "Add a little every week, the same amount, whatever the news says. In this site's test, weekly did a bit better than monthly if the broker's fee per order is tiny.",
  "להוסיף קצת בכל שבוע, אותו סכום, לא משנה מה אומרות החדשות. במבחן של האתר, קנייה שבועית הצליחה מעט יותר מקנייה חודשית, כל עוד העמלה של הברוקר לכל פקודה זעירה.");
add("money.long.s3", "Do not sell when it drops. Look at it rarely.", "לא למכור כשהשוק יורד. להציץ רק לעיתים רחוקות.");
add("money.long.why", "Owning the whole market is like planting an orchard instead of betting on one tree.{history} That has beaten almost everyone who tries to pick stocks.",
  "להחזיק את כל השוק זה כמו לשתול פרדס במקום להמר על עץ אחד.{history} הדרך הזו ניצחה כמעט את כל מי שמנסה לבחור מניות.");
add("money.long.risk", "It will have bad years.{scary} Money you need sooner does not belong here.", "יהיו שנים רעות.{scary} כסף שיהיה צורך בו מוקדם יותר לא שייך לכאן.");

add("lump.title", "Got a lump sum? Five steps.", "יש סכום חד-פעמי? חמישה צעדים.");
add("lump.fund", "the whole-market fund", "הקרן על כל השוק");
add("lump.s1", "First set aside 3 to 6 months of spending in safe savings. That is your emergency money; it never goes into stocks.",
  "קודם לשים בצד הוצאות של 3 עד 6 חודשים בחיסכון בטוח. זה כסף החירום; הוא אף פעם לא נכנס למניות.");
add("lump.s2", "Money you will need within 5 years (a car, a flat, a wedding) also stays out of stocks: see the answer above for your time frame.",
  "גם כסף שיהיה צורך בו בתוך 5 שנים (רכב, דירה, חתונה) נשאר מחוץ למניות: התשובה למעלה מתאימה לכל טווח זמן.");
add("lump.s3", "The rest goes into {fund} in one purchase. {test}", "השאר נכנס בקנייה אחת אל {fund}. {test}");
add("lump.s4", "If a crash right after buying would make you sell, spreading it over 6 months is fine: it costs a little on average, but staying in is what matters most.",
  "אם נפילה מיד אחרי הקנייה עלולה לגרום למכור, אפשר לפזר את הקנייה על פני 6 חודשים: זה עולה קצת בממוצע, אבל הכי חשוב להישאר בפנים.");
add("lump.s5", "Then keep adding new savings every week, and do not sell when it drops.", "אחר כך להמשיך להוסיף חיסכון חדש בכל שבוע, ולא למכור כשהשוק יורד.");
add("lump.test", "In this site's test on {windows} start dates, putting it all in at once was ahead after a year {times} times in 100, against spreading it over half a year. Spreading only made the dips feel smaller",
  "במבחן של האתר על {windows} תאריכי התחלה, השקעה של הכול בבת אחת הובילה אחרי שנה {times} פעמים מתוך 100, לעומת פיזור על פני חצי שנה. הפיזור רק גרם לירידות להרגיש קטנות יותר");
add("lump.dips", " (the usual worst moment was {half} down instead of {lump})", " (הרגע הגרוע הרגיל היה ירידה של {half} במקום {lump})");
add("lump.studies", "Studies of past prices found that putting it all in at once usually beat spreading it out, because markets rise more often than they fall.",
  "מחקרים על מחירי עבר מצאו שהשקעה של הכול בבת אחת בדרך כלל ניצחה פיזור, כי שווקים עולים יותר פעמים משהם יורדים.");
add("lump.b1", "Account type: a tax-advantaged account (in Israel, a keren hishtalmut or an investment kupat gemel) can beat a regular brokerage account.",
  "סוג החשבון: חשבון עם הטבות מס (בישראל, קרן השתלמות או קופת גמל להשקעה) יכול לנצח חשבון מסחר רגיל.");
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
add("today.status.live", "Live: updated after each US close.", "חי: מתעדכן אחרי כל סגירת מסחר בארה״ב.");
add("today.hi", "Hi! It's {day}", "שלום! היום {day}");
add("today.showing", "Showing {label}:", "מוצגת רשימת {label}:");
add("today.staleAlert", "Please don't act on anything below until the daily update runs again.", "לא לפעול על סמך שום דבר כאן עד שהעדכון היומי ירוץ שוב.");
add("today.topStocks", "Top stocks", "מניות מובילות");
add("today.topFunds", "Top funds", "קרנות מובילות");
add("today.fundFallback", "Its fund card appears with the next update.", "כרטיס הקרן יופיע בעדכון הבא.");
add("today.theMarket", "The market", "השוק");
add("today.whatMarketDid", "What the market did", "מה עשה השוק");
add("today.wholeList", "The whole {label} list", "כל הרשימה של {label}");
add("today.news", "In the news", "בחדשות");
add("today.noNews", "Nothing new about the {noun} on this list this week.", "השבוע אין חדש על {noun} ברשימה.");
add("today.showDetails", "Show the details", "להציג את הפרטים");
add("today.dataOld", { one: "Data is {count} day old", other: "Data is {count} days old" }, { one: "הנתונים בני יום", two: "הנתונים בני יומיים", other: "הנתונים בני {count} ימים" });
add("today.sampleData", "Sample data", "נתוני דוגמה");
add("today.live", "Live", "חי");
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
add("today.staleMoney", "The data is old. Please don't act on anything below until the daily update runs again.", "הנתונים ישנים. לא לפעול על סמך שום דבר כאן עד שהעדכון היומי ירוץ שוב.");
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
  "יום תוצאות הוא כמו תעודה: המניה יכולה לקפוץ הרבה לכל כיוון. זה לא סימן לקנות או למכור.");
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
add("today.empty.people", "No logged public calls yet.", "עדיין לא נרשמו הצהרות פומביות.");
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
add("today.older", "{n} older", "{n} ישנים יותר");
add("today.unusual", "Unusual move", "תנועה חריגה");
add("today.digest", "Checklist digest", "סיכום רשימת הבדיקה");
add("today.latestClose", " · latest close", " · הסגירה האחרונה");

/* @@COMPONENTS@@ */

export default { en, he };
