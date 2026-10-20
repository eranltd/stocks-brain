// The plan pages: Portfolio, Playbook, Track record, Verdicts, money and goal cards, trust.
// Convention: `export default { en: {...}, he: {...} }` with identical keys (see shell.js and lib/i18n.js); financial
// words from glossary.js. i18n.test.js checks the file.
//
// Written here as pairs, add(key, English, Hebrew), so each English text sits next to its Hebrew one (the same helper as
// home.js). Covers tabs/Verdicts.jsx, Portfolio.jsx, Playbook.jsx, TrackRecord.jsx, components/verdict.jsx, trust.jsx and
// the sentences lib/verdict.js and lib/bets.js write.
// Voice: a research notebook anyone may read. No "our household" or "the family"; "the plan", "this site's rules", "the
// list". Hebrew: plain modern Hebrew, infinitives or impersonal forms instead of gendered commands, tickers and names in
// Latin letters, and a percent passed as one value ("4.1%") so its sign stays with its number.
// Terms used here that the shared glossary does not have yet: core (fund) = קרן הליבה, side bet = הימור צדדי,
// paper record = רישום בכסף מדומה, the plain way = הדרך הפשוטה, rebalance = איזון מחדש, bp = נקודות בסיס.

const en = {}, he = {};
/** One text in both languages. */
const add = (key, e, h) => { en[key] = e; he[key] = h; };

/* ============================================================ lib/verdict.js: the brain's answer in simple words */

add("v.head.failed", "The brain did not finish this time, so it said nothing.", "המוח לא סיים הפעם, ולכן לא אמר כלום.");
add("v.head.none", "No single stock stands out. The plan stays the weekly buy of the whole market.",
  "אף מניה לא בולטת. התוכנית נשארת אותה תוכנית: הקנייה השבועית של כל השוק.");
add("v.head.likes",
  { one: "It likes {n} stock a little, with pretend money only.", other: "It likes {n} stocks a little, with pretend money only." },
  { one: "יש מניה אחת שהמוח אוהב קצת, רק בכסף מדומה.", two: "יש שתי מניות שהמוח אוהב קצת, רק בכסף מדומה.", other: "יש {n} מניות שהמוח אוהב קצת, רק בכסף מדומה." });
add("v.head.worried",
  { one: "It is worried about {n} stock.", other: "It is worried about {n} stocks." },
  { one: "המוח מודאג ממניה אחת.", two: "המוח מודאג משתי מניות.", other: "המוח מודאג מ-{n} מניות." });
add("v.head.mixed", "It likes some stocks and is worried about others.", "יש מניות שהמוח אוהב, ויש מניות שמדאיגות אותו.");

add("v.eli5.failed", "The brain started its homework but did not finish it, so there is no answer this time.",
  "המוח התחיל את שיעורי הבית אבל לא סיים, ולכן אין תשובה הפעם.");
add("v.eli5.none", "The brain looked at every stock on the list and none looked good enough. So the plan keeps buying the big fund that holds the whole market.",
  "המוח עבר על כל המניות ברשימה, ואף אחת לא נראתה טובה מספיק. לכן התוכנית ממשיכה לקנות את הקרן הגדולה שמחזיקה את כל השוק.");
add("v.eli5.cannotTell", "The brain looked closely at {names}. It cannot tell which of them will beat the others, like guessing which runner wins before the race. So the plan keeps buying the big fund that holds the whole market, which owns them all.",
  "המוח בדק מקרוב את {names}. הוא לא יכול לדעת מי מהן תצליח יותר מהאחרות, כמו לנחש מי ינצח במרוץ לפני שהוא מתחיל. לכן התוכנית ממשיכה לקנות את הקרן הגדולה שמחזיקה את כל השוק, וכך גם את כולן.");
add("v.eli5.guess", "The brain looked closely at {names} and has a guess about where some may go. It is only a guess with pretend money, so nothing real changes yet.",
  "המוח בדק מקרוב את {names}, ויש לו ניחוש לגבי הכיוון של חלקן. זה רק ניחוש בכסף מדומה, אז שום דבר אמיתי עוד לא משתנה.");
add("v.pick.up", "The brain thinks {name} might do a little better than the whole market. It is only a guess, so it plays with pretend money first.",
  "המוח חושב ש-{name} אולי תצליח קצת יותר מהשוק כולו. זה רק ניחוש, ולכן הוא בודק אותה קודם בכסף מדומה.");
add("v.pick.down", "The brain thinks {name} might do worse than the whole market, so it would rather stay away for now.",
  "המוח חושב ש-{name} אולי תצליח פחות מהשוק כולו, ולכן הוא מעדיף להתרחק ממנה בינתיים.");
add("v.pick.flat", "{name}: the brain cannot tell if it will beat the whole market. The whole-market fund already holds a little of it.",
  "{name}: המוח לא יכול לדעת אם היא תצליח יותר מהשוק כולו. הקרן על כל השוק כבר מחזיקה ממנה מעט.");

add("v.mood.up", "Thumbs up", "נטייה לעלייה");
add("v.mood.down", "Thumbs down", "נטייה לירידה");
add("v.mood.flat", "Can't tell", "קשה לדעת");
add("v.moodLower.up", "thumbs up", "נטייה לעלייה");
add("v.moodLower.down", "thumbs down", "נטייה לירידה");
add("v.moodLower.flat", "can't tell", "קשה לדעת");
add("v.sure.low", "not very sure", "ביטחון נמוך");
add("v.sure.medium", "fairly sure", "ביטחון בינוני");
add("v.sure.high", "very sure", "ביטחון גבוה");

add("v.chg.first", "This is the brain's first answer, so there is nothing to compare yet.", "זו התשובה הראשונה של המוח, אז עוד אין למה להשוות.");
add("v.chg.added", "It started watching {names}.", "המוח התחיל לעקוב אחרי {names}.");
add("v.chg.dropped", "It stopped talking about {names}.", "המוח הפסיק לדבר על {names}.");
add("v.chg.mind", "It changed its mind on {name}: from {from} to {to}.", "המוח שינה את דעתו על {name}: קודם {from}, עכשיו {to}.");
add("v.chg.sure", "It is now {now} about {name} (it was {was}).", "לגבי {name}: עכשיו {now} (קודם {was}).");
add("v.chg.same", "Nothing changed since last time. Same stocks, same answers.", "שום דבר לא השתנה מהפעם הקודמת. אותן מניות, אותן תשובות.");

add("v.score.sofar",
  { zero: "So far none of its {total} checked guesses was right.", one: "So far {right} of its {total} checked guesses was right.", other: "So far {right} of its {total} checked guesses were right." },
  { zero: "עד עכשיו אף אחד מ-{total} הניחושים שנבדקו לא היה נכון.", one: "עד עכשיו ניחוש אחד מתוך {total} שנבדקו היה נכון.", other: "עד עכשיו {right} מתוך {total} הניחושים שנבדקו היו נכונים." });
add("v.score.noGuess", "The brain has not made a guess yet.", "למוח עוד אין אף ניחוש.");
add("v.score.onDate", "on {date}", "ב-{date}");
add("v.score.early", "Too early to tell. Each guess is checked about a month after it is made, so the first ones are marked right or wrong {when}.",
  "מוקדם מדי לדעת. כל ניחוש נבדק בערך חודש אחרי שנעשה, ולכן הראשונים יסומנו כנכונים או כשגויים {when}.");

/* ============================================================ lib/bets.js: the weekly bet's record */

add("bets.first", "The first week is still running. Each bet is scored when the next week's bet is placed.",
  "השבוע הראשון עדיין רץ. כל הימור מקבל ציון כשההימור של השבוע הבא נקבע.");
add("bets.base",
  { one: "The brain won {won} of {n} week. Luck alone wins about half.", other: "The brain won {won} of {n} weeks. Luck alone wins about half." },
  { one: "המוח ניצח ב-{won} מתוך שבוע אחד. מזל לבדו מנצח בערך בחצי.", two: "המוח ניצח ב-{won} מתוך שבועיים. מזל לבדו מנצח בערך בחצי.", other: "המוח ניצח ב-{won} מתוך {n} שבועות. מזל לבדו מנצח בערך בחצי." });
add("bets.early", "Too early to tell: it needs about {min} weeks before the score means anything.",
  "מוקדם מדי לדעת: צריך בערך {min} שבועות עד שלציון תהיה משמעות.");
add("bets.skill", "A coin would do this well only {odds} times in 100: the first sign of real skill. Still pretend money until it lasts.",
  "מטבע היה מצליח כך רק {odds} פעמים מתוך 100: סימן ראשון ליכולת אמיתית. עדיין כסף מדומה, עד שזה יחזיק לאורך זמן.");
add("bets.luck", "A coin would do this well {odds} times in 100, so this is still within luck.",
  "מטבע היה מצליח כך {odds} פעמים מתוך 100, אז זה עדיין בגבולות המזל.");

/* ============================================================ components/trust.jsx: the trust ladder */

add("trust.stage.0.name", "Observe", "צפייה");
add("trust.stage.0.money", "No money moves", "שום כסף לא זז");
add("trust.stage.0.blurb", "Level one, like a new player: the stock rule has no record yet. Watch and learn.",
  "שלב ראשון, כמו שחקן חדש: לכלל המניות עוד אין היסטוריית תוצאות. רק צופים ולומדים.");
add("trust.stage.1.name", "Paper", "כסף מדומה");
add("trust.stage.1.money", "No money moves", "שום כסף לא זז");
add("trust.stage.1.blurb", "Level two: the stock rule plays with pretend money, written down every month and never changed afterwards.",
  "שלב שני: כלל המניות משחק בכסף מדומה. הבחירות נרשמות כל חודש, ואחר כך לא משתנות לעולם.");
add("trust.stage.2.name", "Small money", "סכום קטן");
add("trust.stage.2.money", "A small side bet", "הימור צדדי קטן");
add("trust.stage.2.blurb", "Level three, unlocked only by proof: the pretend record and years of history both beat the whole market. Then a small side bet, within this site's limits.",
  "שלב שלישי, שנפתח רק עם הוכחה: גם הרישום בכסף מדומה וגם שנים של היסטוריה הצליחו יותר מהשוק כולו. רק אז הימור צדדי קטן, בגבולות הכללים של האתר.");
add("trust.stage.3.name", "Trusted", "אמון");
add("trust.stage.3.money", "A small side bet, within limits", "הימור צדדי קטן, בגבולות שנקבעו");
add("trust.stage.3.blurb", "Level four: a full year of pretend record, still ahead of the whole market.",
  "שלב רביעי: שנה שלמה של רישום בכסף מדומה, ועדיין לפני השוק כולו.");

add("trust.need.paperDays", "Paper record: {days} of {need} days", "רישום בכסף מדומה: {days} מתוך {need} ימים");
add("trust.need.vsCoreNone", "Paper portfolio ahead of the core (not measured yet)", "תיק הכסף המדומה לפני קרן הליבה (עוד לא נמדד)");
add("trust.need.vsCore", "Paper portfolio vs the core since {since}: {pct} (need above 0)", "תיק הכסף המדומה מול קרן הליבה מאז {since}: {pct} (צריך מעל 0)");
add("trust.need.ruleNone", "Rule beats holding every name (history not computed yet)", "הכלל מצליח יותר מהחזקת כל המניות (ההיסטוריה עוד לא חושבה)");
add("trust.need.ruleBeat", "Over {years} years the rule beat holding every name by {pts} pts a year",
  "במשך {years} שנים הכלל הקדים את החזקת כל המניות ב-{pts} נקודות אחוז בשנה");
add("trust.need.ruleTrail", "Over {years} years the rule trailed holding every name by {pts} pts a year",
  "במשך {years} שנים הכלל פיגר אחרי החזקת כל המניות ב-{pts} נקודות אחוז בשנה");
add("trust.need.gate", "Names passing the gate beat {bench}: {mean} per 20 days, 90% range from {lo} (need above 0)",
  "מניות שעברו את מסנן הכניסה מול {bench}: {mean} לכל 20 ימים, טווח 90% שמתחיל ב-{lo} (צריך מעל 0)");
add("trust.need.gateNone", "Setup-gate base rates (not computed yet)", "שיעורי הבסיס של מסנן הכניסה (עוד לא חושבו)");
add("trust.need.ahead", "Still ahead of the core", "עדיין לפני קרן הליבה");
add("trust.need.start", "The paper portfolio starts with the next daily run", "תיק הכסף המדומה יתחיל בריצה היומית הבאה");

add("trust.eyebrow", "Can it be trusted yet?", "אפשר כבר לסמוך עליו?");
add("trust.title", "Stage {stage}: {name}", "שלב {stage}: {name}");
add("trust.tail", "Trust is earned by the record, never by the story, and the site steps back down if the numbers slip.",
  "אמון נבנה מהתוצאות, אף פעם לא מהסיפור, והאתר יורד שלב אחורה אם המספרים נחלשים.");
add("trust.toReach", "To reach {name}", "כדי להגיע לשלב {name}");
add("trust.rules", "Read this site's rules", "לכללים של האתר");
add("trust.here", "you are here", "השלב הנוכחי");

/* ============================================================ components/verdict.jsx and tabs/Verdicts.jsx */

add("vp.inBrainWords", "In the brain's words:", "במילים של המוח:");
add("vp.showReason", "Show the grown-up reason", "להציג את ההסבר המלא");
add("vp.hideReason", "Hide the grown-up reason", "להסתיר את ההסבר המלא");
add("vp.wrong", "What could go wrong", "מה יכול להשתבש");
add("vp.changesIf", "It changes its mind if:", "המוח ישנה את דעתו אם:");
add("vp.letterTitle", "The brain's weekly letter · {date}", "המכתב השבועי של המוח · {date}");
add("vp.letterNote", "Written by the brain in the spirit of a patient long-term owner's letter. It is not Warren Buffett and does not speak for him. An educational note, not investment advice.",
  "המוח כתב את המכתב ברוח המכתבים של משקיע סבלני לטווח ארוך. הוא לא Warren Buffett ולא מדבר בשמו. זה הסבר לימודי, לא ייעוץ השקעות.");
add("vp.latestTitle", "The brain's verdict · {when}", "ההכרעה של המוח · {when}");
add("vp.thisLetter", "This week's letter:", "המכתב של השבוע:");
add("vp.readLetter", "Read the brain's letter", "לקריאת המכתב של המוח");
add("vp.openFull", "Open the brain's full answer", "לתשובה המלאה של המוח");
add("vp.empty", "The brain's answers appear here once it has made its first real call.", "התשובות של המוח יופיעו כאן אחרי ההכרעה האמיתית הראשונה שלו.");
add("vp.newest", "The newest answer · {date}", "התשובה החדשה ביותר · {date}");
add("vp.newestWhen", "The newest answer · {date} ({when})", "התשובה החדשה ביותר · {date} ({when})");
add("vp.steady", { other: "{n} answers in a row have been the same." }, { two: "שתי תשובות ברצף היו זהות.", other: "{n} תשובות ברצף היו זהות." });
add("vp.topTitle", "The brain's top stocks for this year", "המניות המובילות של המוח לשנה הזו");
add("vp.topLede", "The brain's best ideas, strongest first. It tests them with pretend money before trusting them: none has beaten the whole market yet, so the plan keeps the main money in the answer above.",
  "הרעיונות הטובים ביותר של המוח, החזק ביותר קודם. המוח בודק אותם בכסף מדומה לפני שהוא סומך עליהם: אף אחד מהם עוד לא הצליח יותר מהשוק כולו, ולכן התוכנית משאירה את עיקר הכסף בתשובה שלמעלה.");
add("vp.changedTitle", "What changed since last time?", "מה השתנה מהפעם הקודמת?");
add("vp.rightTitle", "Has the brain been right?", "האם המוח צדק?");
add("vp.rightNote", "The brain is a careful machine, not a fortune teller. On past prices, its rules did not beat picking at random, so it never asks for real money on a single stock. Its weekly bet, above, is how the site finds out if its ranking has any skill.",
  "המוח הוא מכונה זהירה, לא מגדת עתידות. על מחירי העבר, הכללים שלו לא הצליחו יותר מבחירות אקראיות, ולכן הוא אף פעם לא מבקש כסף אמיתי על מניה אחת. ההימור השבועי שלו, למעלה, הוא הדרך של האתר לבדוק אם יש בדירוג שלו יכולת כלשהי.");
add("vp.everyGuess", "Every scored guess", "כל הניחושים שקיבלו ציון");
add("vp.summary", "The brain's grown-up summary", "הסיכום המלא של המוח");
add("vp.earlier", "Earlier answers", "תשובות קודמות");
add("vp.sameBefore", "Same as the answer before.", "כמו התשובה הקודמת.");
add("vp.somethingChanged", "Something changed: open to see.", "משהו השתנה: אפשר לפתוח ולראות.");
add("vp.foot", "A research notebook, not investment advice. The brain's stock guesses use pretend money.",
  "מחברת מחקר, לא ייעוץ השקעות. הניחושים של המוח על מניות הם בכסף מדומה.");

add("vt.title", "What the {brain} says", "מה {brain} אומר");
add("vt.brain", "brain", "המוח");
add("vt.lede", "Every morning a smart computer program reads the whole market and picks the stocks it rates highest for this year. Here is what it decided, told simply.",
  "כל בוקר תוכנת מחשב חכמה קוראת את השוק כולו ובוחרת את המניות שהיא מדרגת הכי גבוה לשנה הזו. הנה מה שהיא החליטה, בפשטות.");

/* ============================================================ tabs/TrackRecord.jsx */

add("tr.eyebrow", "Track record", "היסטוריית התוצאות");
add("tr.titleEmpty", "Marked by {accent}", "הציונים ניתנים {accent}");
add("tr.titleFull", "Every guess, marked by {accent}", "כל ניחוש מקבל ציון {accent}");
add("tr.computer", "the computer.", "על ידי המחשב.");
add("tr.ledeShort", "In simple words: every guess the brain makes is checked about a month later, like marking homework.",
  "במילים פשוטות: כל ניחוש של המוח נבדק בערך חודש אחר כך, כמו בדיקת שיעורי בית.");
add("tr.emptyTitle", "Nothing marked yet", "עוד אין ציונים");
add("tr.emptyBody", "Each guess is checked {days} market days after it was made. {pending} waiting to be checked.",
  "כל ניחוש נבדק {days} ימי מסחר אחרי שנעשה. {pending} ממתינים לבדיקה.");
add("tr.eyebrowFull", "Track record · compared with {bench}, the whole market", "היסטוריית התוצאות · בהשוואה ל-{bench}, השוק כולו");
add("tr.lede", "In simple words: every guess the brain makes is checked about a month later, like marking homework. Each stock it talked about is compared with {bench} (the whole market) over the next {days} market days. If the guess was right by more than {band}, it is a hit; wrong by more than that, a miss; anything closer is \"flat\", too small to count. A plain computer program does the marking, not the AI, so it cannot be talked into a better grade. These are guesses to learn from, not things anyone buys.",
  "במילים פשוטות: כל ניחוש של המוח נבדק בערך חודש אחר כך, כמו בדיקת שיעורי בית. כל מניה שהמוח דיבר עליה מושווית ל-{bench} (השוק כולו) במשך {days} ימי המסחר הבאים. אם הניחוש צדק ביותר מ-{band}, זו פגיעה; אם טעה ביותר מזה, זו החטאה; כל מה שקרוב יותר הוא \"בלי שינוי\", קטן מכדי להיחשב. את הציון נותנת תוכנת מחשב פשוטה, לא הבינה המלאכותית, כך שאי אפשר לשכנע אותה לתת ציון טוב יותר. אלה ניחושים ללמוד מהם, לא דברים שמישהו קונה.");
add("tr.samplePill", "sample", "דוגמה");
add("tr.sample", "The numbers below are made up, to show what the page will look like. They do not count.",
  "המספרים כאן מומצאים, רק כדי להראות איך העמוד ייראה. הם לא נספרים.");
add("tr.cell.marked", "guesses marked", "ניחושים שקיבלו ציון");
add("tr.cell.markedDesc", "{pending} more still waiting for their month to pass.", "עוד {pending} ממתינים שיעבור החודש שלהם.");
add("tr.cell.right", "right (hit rate)", "צדקו (שיעור פגיעה)");
add("tr.cell.rightDesc", "{hits} hits · {flats} flat · {misses} misses.", "{hits} פגיעות · {flats} בלי שינוי · {misses} החטאות.");
add("tr.cell.lead", "average lead over the market", "יתרון ממוצע על השוק");
add("tr.cell.leadDesc", "How far ahead of {bench} the guesses ended, on average. A right \"down\" guess counts as a plus.",
  "בכמה הניחושים הקדימו את {bench}, בממוצע. ניחוש \"ירידה\" שצדק נחשב פלוס.");
add("tr.cell.best", "best guess · {ticker}", "הניחוש הטוב ביותר · {ticker}");
add("tr.cell.worst", "Worst guess: {ticker} {pct}.", "הניחוש הגרוע ביותר: {ticker} {pct}.");
add("tr.chartTitle", "How far each guess beat or trailed the market", "בכמה כל ניחוש הקדים את השוק או פיגר אחריו");
add("tr.hit", "hit", "פגיעה");
add("tr.flat", "flat", "בלי שינוי");
add("tr.miss", "miss", "החטאה");
add("tr.splitTitle", "Hits, flats and misses", "פגיעות, בלי שינוי והחטאות");
add("tr.calib.title", "Does \"very sure\" mean anything?", "האם ל\"ביטחון גבוה\" יש משמעות?");
add("tr.calib.informative", "Guesses the brain was very sure about did better than the ones it was unsure about. Its confidence means something.",
  "ניחושים שהמוח היה בטוח בהם מאוד הצליחו יותר מאלה שלא היה בטוח בהם. לרמת הביטחון שלו יש משמעות.");
add("tr.calib.not_informative", "Guesses it was very sure about did not do better than unsure ones yet. Ignore how sure it says it is.",
  "ניחושים שהמוח היה בטוח בהם מאוד עוד לא הצליחו יותר מאלה שלא היה בטוח בהם. בינתיים אפשר להתעלם מרמת הביטחון שהוא מציין.");
add("tr.calib.insufficient_data", "Not enough marked guesses at each level of sureness yet (need {min} each) to tell.",
  "עוד אין מספיק ניחושים עם ציון בכל רמת ביטחון (צריך {min} בכל רמה) כדי לדעת.");
add("tr.byDir", "By direction (up, down, flat) and how sure", "לפי כיוון (עלייה, ירידה, בלי שינוי) ורמת ביטחון");
add("tr.th.day", "Day", "יום");
add("tr.th.stock", "Stock", "מניה");
add("tr.th.guess", "Guess", "ניחוש");
add("tr.th.sure", "How sure", "רמת ביטחון");
add("tr.th.stockMoved", "Stock moved", "תנועת המניה");
add("tr.th.marketMoved", "Market moved", "תנועת השוק");
add("tr.th.diff", "Difference", "הפרש");
add("tr.th.mark", "Mark", "ציון");
add("tr.fewer", "Show fewer", "להציג פחות");
add("tr.all", "Show all {n}", "להציג את כל {n}");

export default { en, he };
