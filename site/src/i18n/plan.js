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
  "אף מניה לא בולטת. התוכנית לא משתנה: הקנייה השבועית בקרן על כל השוק.");
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
  "המוח בדק מקרוב את {names}. הוא לא יכול לדעת מי מהן תצליח יותר מהאחרות, כמו לנחש מי ינצח במרוץ לפני שהוא מתחיל. לכן התוכנית ממשיכה לקנות את הקרן הגדולה שמחזיקה את כל השוק, ובתוכה גם את כולן.");
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
  { zero: "עד עכשיו אף אחד מתוך {total} הניחושים שנבדקו לא היה נכון.", one: "עד עכשיו ניחוש אחד מתוך {total} שנבדקו היה נכון.", other: "עד עכשיו {right} מתוך {total} הניחושים שנבדקו היו נכונים." });
add("v.score.noGuess", "The brain has not made a guess yet.", "למוח עוד אין אף ניחוש.");
add("v.score.onDate", "on {date}", "ב-{date}");
add("v.score.early", "Too early to tell. Each guess is checked about a month after it is made, so the first ones are marked right or wrong {when}.",
  "מוקדם מדי לדעת. כל ניחוש נבדק בערך חודש אחרי שנעשה, ולכן הראשונים יסומנו כנכונים או כשגויים {when}.");

/* ============================================================ lib/bets.js: the weekly bet's record */

add("bets.first", "The first week is still running. Each bet is scored when the next week's bet is placed.",
  "השבוע הראשון עדיין רץ. כל הימור מקבל ציון כשההימור של השבוע הבא נקבע.");
add("bets.base",
  { one: "The brain won {won} of {n} week. Luck alone wins about half.", other: "The brain won {won} of {n} weeks. Luck alone wins about half." },
  { one: "שבוע אחד קיבל ציון עד עכשיו. ניצחונות של המוח: {won}. מזל לבדו מנצח בערך בחצי מהשבועות.", two: "שבועיים קיבלו ציון עד עכשיו. ניצחונות של המוח: {won}. מזל לבדו מנצח בערך בחצי מהשבועות.", other: "{n} שבועות קיבלו ציון עד עכשיו. ניצחונות של המוח: {won}. מזל לבדו מנצח בערך בחצי מהשבועות." });
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
  "שלב רביעי: שנה שלמה של רישום בכסף מדומה, ועדיין מקדים את השוק כולו.");

add("trust.need.paperDays", "Paper record: {days} of {need} days", "רישום בכסף מדומה: {days} מתוך {need} ימים");
add("trust.need.vsCoreNone", "Paper portfolio ahead of the core (not measured yet)", "תיק הכסף המדומה מקדים את קרן הליבה (עוד לא נמדד)");
add("trust.need.vsCore", "Paper portfolio vs the core since {since}: {pct} (need above 0)", "תיק הכסף המדומה מול קרן הליבה מאז {since}: {pct} (צריך מעל 0)");
add("trust.need.ruleNone", "Rule beats holding every name (history not computed yet)", "הכלל מצליח יותר מהחזקת כל המניות (ההיסטוריה עוד לא חושבה)");
add("trust.need.ruleBeat", "Over {years} years the rule beat holding every name by {pts} pts a year",
  "במשך {years} שנים הכלל הקדים את החזקת כל המניות ב-{pts} נקודות אחוז בשנה");
add("trust.need.ruleTrail", "Over {years} years the rule trailed holding every name by {pts} pts a year",
  "במשך {years} שנים הכלל פיגר אחרי החזקת כל המניות ב-{pts} נקודות אחוז בשנה");
add("trust.need.gate", "Names passing the gate beat {bench}: {mean} per 20 days, 90% range from {lo} (need above 0)",
  "מניות שעברו את מסנן הכניסה מול {bench}: {mean} לכל 20 ימים, טווח 90% שמתחיל ב-{lo} (צריך מעל 0)");
add("trust.need.gateNone", "Setup-gate base rates (not computed yet)", "שיעורי הבסיס של מסנן הכניסה (עוד לא חושבו)");
add("trust.need.ahead", "Still ahead of the core", "עדיין מקדים את קרן הליבה");
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
  "המוח הוא מכונה זהירה, לא מגדת עתידות. במבחן על מחירי עבר, הכללים שלו לא הצליחו יותר מבחירות אקראיות, ולכן הוא אף פעם לא מבקש כסף אמיתי על מניה אחת. ההימור השבועי שלו, למעלה, הוא הדרך של האתר לבדוק אם יש בדירוג שלו יכולת כלשהי.");
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
  "במילים פשוטות: כל ניחוש של המוח נבדק בערך חודש אחר כך, כמו בדיקת שיעורי בית. כל מניה שהמוח דיבר עליה מושווית ל-{bench} (השוק כולו) במשך {days} ימי המסחר הבאים. אם הניחוש צדק ביותר מ-{band}, זו פגיעה; אם טעה ביותר מזה, זו החטאה; כל מה שקרוב יותר הוא ״בלי שינוי״, קטן מכדי להיחשב. את הציון נותנת תוכנת מחשב פשוטה, לא הבינה המלאכותית, כך שאי אפשר לשכנע אותה לתת ציון טוב יותר. אלה ניחושים ללמוד מהם, לא דברים שמישהו קונה.");
add("tr.samplePill", "sample", "דוגמה");
add("tr.sample", "The numbers below are made up, to show what the page will look like. They do not count.",
  "המספרים כאן מומצאים, רק כדי להראות איך העמוד ייראה. הם לא נספרים.");
add("tr.cell.marked", "guesses marked", "ניחושים שקיבלו ציון");
add("tr.cell.markedDesc", "{pending} more still waiting for their month to pass.", "עוד {pending} ממתינים שיעבור החודש שלהם.");
add("tr.cell.right", "right (hit rate)", "צדקו (שיעור פגיעה)");
add("tr.cell.rightDesc", "{hits} hits · {flats} flat · {misses} misses.", "{hits} פגיעות · {flats} בלי שינוי · {misses} החטאות.");
add("tr.cell.lead", "average lead over the market", "יתרון ממוצע על השוק");
add("tr.cell.leadDesc", "How far ahead of {bench} the guesses ended, on average. A right \"down\" guess counts as a plus.",
  "בכמה הניחושים הקדימו את {bench}, בממוצע. ניחוש ״ירידה״ שצדק נחשב פלוס.");
add("tr.cell.best", "best guess · {ticker}", "הניחוש הטוב ביותר · {ticker}");
add("tr.cell.worst", "Worst guess: {ticker} {pct}.", "הניחוש הגרוע ביותר: {ticker} {pct}.");
add("tr.chartTitle", "How far each guess beat or trailed the market", "בכמה כל ניחוש הקדים את השוק או פיגר אחריו");
add("tr.hit", "hit", "פגיעה");
add("tr.flat", "flat", "בלי שינוי");
add("tr.miss", "miss", "החטאה");
add("tr.splitTitle", "Hits, flats and misses", "פגיעות, בלי שינוי והחטאות");
add("tr.calib.title", "Does \"very sure\" mean anything?", "האם ל״ביטחון גבוה״ יש משמעות?");
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

/* ============================================================ tabs/Portfolio.jsx: the pretend portfolio */

add("pf.next", "Shows up after the next daily run", "יופיע אחרי הריצה היומית הבאה");
add("pf.emptyBody", "This page needs years of past prices, and the daily computer run has not worked them out yet.",
  "העמוד הזה צריך שנים של מחירי עבר, והריצה היומית של המחשב עוד לא חישבה אותם.");
add("pf.eyebrow", "Pretend portfolio · {prices} · {date}", "תיק מדומה · {prices} · {date}");
add("pf.samplePrices", "sample prices", "מחירים לדוגמה");
add("pf.realYears", "{years} years of real past prices", "{years} שנים של מחירי עבר אמיתיים");
add("pf.headline", "A pretend portfolio, {accent}", "תיק השקעות מדומה, {accent}");
add("pf.headlineAccent", "to learn.", "כדי ללמוד.");
add("pf.simple", "In simple words:", "במילים פשוטות:");
add("pf.intro", "this is a pretend portfolio. A computer rule picks a few stocks once a month with pretend money, to see whether picking stocks beats just owning the whole market. No real money goes into it.",
  "זה תיק השקעות מדומה. כלל ממוחשב בוחר כמה מניות פעם בחודש, בכסף מדומה, כדי לבדוק אם בחירת מניות מצליחה יותר מהחזקה פשוטה של השוק כולו. שום כסף אמיתי לא נכנס אליו.");
add("pf.intro2", "In the plan, real money follows the honest action on the verdicts page, which is usually: keep buying a low-cost fund that holds the whole market (called the core here). Below, you can play too. Pick up to {slots} stocks and see how they would have done in the past: how much they grew, how bumpy the ride was, and how often they reached {goal} in a year, next to the rule and the core. Your picks stay in this browser only. Nothing is saved anywhere else.",
  "בתוכנית, הכסף האמיתי הולך לפי הצעד המפוכח שבעמוד ההכרעות, ובדרך כלל זה: להמשיך לקנות קרן זולה שמחזיקה את כל השוק (כאן קוראים לה קרן הליבה). למטה אפשר גם לשחק: לבחור עד {slots} מניות ולראות איך הן היו מצליחות בעבר, כמה הן צמחו, כמה הדרך הייתה מטלטלת וכמה פעמים הן הגיעו ל-{goal} בשנה, לצד הכלל וקרן הליבה. הבחירות נשמרות רק בדפדפן הזה, ולא בשום מקום אחר.");
add("pf.pickedOf", "{n} of {slots} picked", "נבחרו {n} מתוך {slots}");
add("pf.showRule", "Show the rule's picks", "להציג את הבחירות של הכלל");
add("pf.howMuch", "How much of each", "כמה מכל מניה");
add("pf.equal", "Equal shares", "חלקים שווים");
add("pf.calm", "More of the calm ones", "יותר מהרגועות");
add("pf.calmNote", "More of the calm ones: a stock whose price jumps around less gets a bigger slice, so each stock adds about the same amount of bumpiness (Roni's shelf: volatility-based sizing).",
  "יותר מהרגועות: מניה שהמחיר שלה קופץ פחות מקבלת נתח גדול יותר, כך שכל מניה מוסיפה בערך אותה כמות של טלטלה (מהמדף של Roni: חלוקה לפי תנודתיות).");
add("pf.warn.few",
  { one: "Only {n} stock: the experiment uses {range}.", other: "Only {n} stocks: the experiment uses {range}." },
  { one: "רק מניה אחת: בניסוי משתמשים ב-{range} מניות.", two: "רק שתי מניות: בניסוי משתמשים ב-{range} מניות.", other: "רק {n} מניות: בניסוי משתמשים ב-{range} מניות." });
add("pf.warn.sector", "{n} stocks from the same kind of business ({sector}): the rule allows {max}.", "{n} מניות מאותו ענף ({sector}): הכלל מרשה {max}.");
add("pf.warn.corr", "They move together a lot (score {score} out of 1): when one falls, the others likely fall too.",
  "הן זזות יחד הרבה (ציון {score} מתוך 1): כשאחת יורדת, סביר שגם האחרות ירדו.");
add("pf.warn.stretched", "{s} has run up far above its usual path: the rule would not pick it today.", "{s} עלתה הרבה מעל המסלול הרגיל שלה: הכלל לא היה בוחר בה היום.");
add("pf.warn.fails", "{s} passes only {passed} of the rule's 4 checks.", "{s} עוברת רק {passed} מתוך 4 הבדיקות של הכלל.");
add("pf.yourMix", "Your pretend mix", "התמהיל המדומה שלך");
add("pf.avgGrowth", "average growth a year", "צמיחה ממוצעת בשנה");
add("pf.row.hitGoal", "Years that hit {goal}", "שנים שהגיעו ל-{goal}");
add("pf.row.lost", "Years that lost money", "שנים עם הפסד");
add("pf.row.worstYear", "Worst year", "השנה הגרועה ביותר");
add("pf.row.drop", "Biggest drop", "הירידה הגדולה ביותר");
add("pf.last12", "Your pretend mix · last 12 months", "התמהיל המדומה שלך · 12 החודשים האחרונים");
add("pf.row.bumpy", "Bumpiness (yearly swing)", "טלטלה (תנודתיות שנתית)");
add("pf.row.badMonth", "A bad month (1 in 20)", "חודש רע (1 מתוך 20)");
add("pf.row.together", "Move together (0 to 1)", "תנועה משותפת (0 עד 1)");
add("pf.row.kinds", "Kinds of business", "ענפים");
add("pf.kindsOf", "{n} of {total}", "{n} מתוך {total}");
add("pf.mixNote", "Evened out about once a month. Careful: this list was made knowing these companies did well, like picking a race winner after the race.",
  "מאוזן מחדש בערך פעם בחודש. זהירות: הרשימה הזו נבנתה כשכבר היה ידוע שהחברות האלה הצליחו, כמו לבחור את המנצח במרוץ אחרי שהמרוץ נגמר.");
add("pf.chartAria", "How 100 would have grown: your pretend mix, the rule, the core and the goal path", "איך 100 היו צומחים: התמהיל המדומה שלך, הכלל, קרן הליבה ומסלול היעד");
add("pf.goalLine", "Goal {goal}/yr", "יעד {goal} בשנה");

add("pf.corr.eyebrow", "Move-together map · daily ups and downs, last 12 months", "מפת תנועה משותפת · עליות וירידות יומיות, 12 החודשים האחרונים");
add("pf.corr.title", "Do they move {accent}", "האם הן זזות {accent}");
add("pf.corr.accent", "together?", "יחד?");
add("pf.corr.lede", "Each square says how much two stocks move together. 1.00 means they go up and down at the same time, like two kids on one swing. Low numbers mean they often go different ways, so one bad day does not sink everything.",
  "כל משבצת מראה כמה שתי מניות זזות יחד. 1.00 פירושו שהן עולות ויורדות באותו זמן, כמו שני ילדים על אותה נדנדה. מספרים נמוכים פירושם שהן הולכות הרבה פעמים לכיוונים שונים, כך שיום רע אחד לא מפיל הכול.");
add("pf.corr.concentrated",
  { one: "This list covers only one kind of business, so expect high numbers.", other: "This list covers only {n} kinds of business, so expect high numbers." },
  { one: "הרשימה הזו מכסה ענף אחד בלבד, ולכן צפויים מספרים גבוהים.", two: "הרשימה הזו מכסה שני ענפים בלבד, ולכן צפויים מספרים גבוהים.", other: "הרשימה הזו מכסה רק {n} ענפים, ולכן צפויים מספרים גבוהים." });

add("pf.each.eyebrow", "Each stock · {from} to {to}", "כל מניה · {from} עד {to}");
add("pf.each.title", "The stocks, {accent}", "המניות, {accent}");
add("pf.each.accent", "one by one.", "אחת אחת.");
add("pf.each.lede", "How each stock did on its own in the past. A year = average yearly growth. Biggest drop = the worst fall from a high point. Bumpiness = how much the price jumps around in a year.",
  "איך כל מניה הצליחה לבדה בעבר. שנה = צמיחה שנתית ממוצעת. הירידה הגדולה ביותר = הנפילה הכי גרועה מנקודת שיא. טלטלה = כמה המחיר קופץ במהלך שנה.");
add("pf.th.stock", "Stock", "מניה");
add("pf.th.kind", "Kind of business", "ענף");
add("pf.th.year", "A year", "שנה");
add("pf.th.yearsGoal", "Years at {goal}", "שנים ב-{goal}");
add("pf.th.bumpy", "Bumpiness (1y)", "טלטלה (שנה)");
add("pf.th.held", "Time the rule held it", "הזמן שהכלל החזיק בה");
add("pf.th.today", "Rule today", "הכלל היום");

add("pf.held.eyebrow", "Rule {version} · {n} monthly picks · next {date}", "כלל {version} · {n} בחירות חודשיות · הבאה ב-{date}");
add("pf.held.title", "What the rule {accent}", "מה הכלל {accent}");
add("pf.held.accent", "held, on paper.", "החזיק, על הנייר.");
add("pf.held.lede", "A replay on past prices of what the rule would have picked each month, with pretend money. It held {avg} stocks on average and swapped about {turn} of the pot a year (how often it swaps stocks), paying a pretend fee of {bps} bp per trade (100 bp = 1%). This replay is redone every day on today's list; the paper record further down is never redone.",
  "שחזור על מחירי עבר של מה שהכלל היה בוחר בכל חודש, בכסף מדומה. בממוצע הוא החזיק {avg} מניות והחליף בערך {turn} מהקופה בשנה (כמה הוא מחליף מניות), ושילם עמלה מדומה של {bps} נקודות בסיס לכל עסקה (100 נקודות בסיס = 1%). השחזור הזה נעשה מחדש כל יום על הרשימה של היום; הרישום בכסף מדומה שלמטה אף פעם לא נעשה מחדש.");
add("pf.held.month", "Month", "חודש");
add("pf.held.stocks", "Stocks held", "מניות בתיק");
add("pf.held.core", "In the core fund", "בקרן הליבה");
add("pf.held.swapped", "Swapped", "הוחלף");
add("pf.held.none", "none (all in the core)", "אין (הכול בקרן הליבה)");
add("pf.nav.today", "Today", "היום");
add("pf.nav.rules", "This site's rules", "הכללים של האתר");
add("pf.foot", "Analysis only, not investment advice. Pretend money only: nothing on this page is bought. Lines start at 100 so growth can be compared; the site shows growth, not prices.",
  "ניתוח בלבד, לא ייעוץ השקעות. כסף מדומה בלבד: שום דבר בעמוד הזה לא נקנה. הקווים מתחילים ב-100 כדי שאפשר יהיה להשוות צמיחה; האתר מראה צמיחה, לא מחירים.");

add("pf.mm.eyebrow", "Mix and match · a game with the past", "לערבב ולהתאים · משחק עם העבר");
add("pf.mm.title", "Which stocks, together, {accent}", "אילו מניות, ביחד, {accent}");
add("pf.mm.accent", "grew the most?", "צמחו הכי הרבה?");
add("pf.mm.lede", "The computer tries every possible group of {range} of the {n} stocks on the list on the same past prices, and shows which would have grown the most, grown the most for the bumps, or fallen the least. This is looking back, like knowing the answers after the test. Read the reality check before believing any of it.",
  "המחשב מנסה כל קבוצה אפשרית של {range} מתוך {n} המניות ברשימה, על אותם מחירי עבר, ומראה אילו היו צומחות הכי הרבה, צומחות הכי הרבה ביחס לטלטלות, או יורדות הכי מעט. זה מבט לאחור, כמו לדעת את התשובות אחרי המבחן. לפני שמאמינים למשהו מזה, חשוב לקרוא את בדיקת המציאות.");
add("pf.mm.sortBy", "Sort groups by", "מיון הקבוצות לפי");
add("pf.mm.inGroup", "Stocks in the group", "מניות בקבוצה");
add("pf.mm.nStocks", "{n} stocks", "{n} מניות");
add("pf.mm.capOn", "At most {max} from one kind of business (this site's rule)", "לכל היותר {max} מאותו ענף (כלל של האתר)");
add("pf.mm.capOff", "Any group, even all one kind of business", "כל קבוצה, גם כולה מאותו ענף");
add("pf.mm.try", "Try every group", "לנסות כל קבוצה");
add("pf.mm.tryNote", "It takes a moment. It runs on your device and saves nothing.", "זה לוקח רגע. החישוב רץ על המכשיר הזה ולא שומר כלום.");
add("pf.mm.rankTitle", "How your pretend mix ranks · equal shares", "איפה התמהיל המדומה שלך מדורג · חלקים שווים");
add("pf.mm.grew", "{names} grew {cagr} a year on average, with a biggest drop of {dd}.", "{names} צמחו בממוצע {cagr} בשנה, והירידה הגדולה ביותר הייתה {dd}.");
add("pf.mm.beat", "By {measure} it beat {pct} of the {n} possible groups.", "לפי ״{measure}״, התמהיל הצליח יותר מ-{pct} מתוך {n} הקבוצות האפשריות.");
add("pf.mm.size", "It has {n} stocks; the groups below use {k}.", "יש בו {n} מניות; הקבוצות למטה הן של {k}.");
add("pf.mm.middle", "The middle group grew {mid} a year; the best grew {best}.", "הקבוצה האמצעית צמחה {mid} בשנה; הטובה ביותר צמחה {best}.");
add("pf.mm.topTitle", "The five best groups in the past, by {measure}", "חמש הקבוצות הטובות ביותר בעבר, לפי ״{measure}״");
add("pf.mm.tryGroup", "Try this group", "לנסות את הקבוצה הזו");
add("pf.mm.growth", "Growth a year", "צמיחה בשנה");
add("pf.mm.bumpy", "Bumpiness", "טלטלה");
add("pf.mm.without", "Without {name}", "בלי {name}");
add("pf.mm.bestAdd", "Best stock to add to your pretend mix · by {measure}", "המניה הטובה ביותר להוספה לתמהיל המדומה שלך · לפי ״{measure}״");
add("pf.mm.bestSwap", "Best single swaps for your pretend mix · by {measure}", "ההחלפות הבודדות הטובות ביותר לתמהיל המדומה שלך · לפי ״{measure}״");
add("pf.mm.change", "{cagr} a year ({delta} compared with now), biggest drop {dd}", "{cagr} בשנה ({delta} לעומת עכשיו), הירידה הגדולה ביותר {dd}");
add("pf.mm.tryIt", "Try it", "לנסות");
add("pf.mm.reality", "Reality check", "בדיקת מציאות");
add("pf.mm.r1b", "The best group always looks great afterwards.", "הקבוצה הטובה ביותר תמיד נראית מצוין בדיעבד.");
add("pf.mm.r1", "With {n} groups to choose from, one has to come out on top, like one lottery ticket always wins. That shows what happened, not what comes next.",
  "כשיש {n} קבוצות לבחור מהן, אחת חייבת לצאת ראשונה, כמו שכרטיס הגרלה אחד תמיד זוכה. זה מראה מה קרה, לא מה יקרה.");
add("pf.mm.r2b", "The list was made looking back.", "הרשימה נבנתה במבט לאחור.");
add("pf.mm.r2", "These {n} are companies that became big, so they look good partly because it is already known they won. When the best 20 groups were picked using only the first half of the past (to {date}), in the second half they landed around {pct} out of 100 (50 would be a coin flip; how much the two halves agree, from {lo} to {hi}: {corr}). That comes from a list of winners, not a promise.",
  "{n} המניות האלה הן של חברות שהפכו לגדולות, ולכן הן נראות טוב בין השאר כי כבר ידוע שהן ניצחו. כשנבחרו 20 הקבוצות הטובות ביותר רק לפי החצי הראשון של העבר (עד {date}), בחצי השני הן נחתו בערך במקום {pct} מתוך 100 (50 זה כמו הטלת מטבע; עד כמה שני החצאים מסכימים, בסולם שבין {lo} ל-{hi}: {corr}). זה בא מרשימה של מנצחות, לא הבטחה.");
add("pf.mm.r3b", "This site's own test, written down in advance, found picking by past strength did not work.", "המבחן של האתר עצמו, שנכתב מראש, מצא שבחירה לפי חוזק בעבר לא עבדה.");
add("pf.mm.r3", "The stock rules that picked whatever had risen most beat only {lo} to {hi} of groups picked at random from this list.",
  "כללי המניות שבחרו את מה שעלה הכי הרבה הצליחו יותר רק מ-{lo} עד {hi} מהקבוצות שנבחרו באקראי מהרשימה הזו.");
add("pf.mm.r3link", "See this site's rules", "לכללים של האתר");
add("pf.mm.r4b", "The top groups lean on a few wild stocks.", "הקבוצות המובילות נשענות על כמה מניות פרועות.");
add("pf.mm.r4", "They fell {dd} at their worst, and without its single best stock the first group would have grown {wo} a year instead of {cagr}.",
  "בנקודה הגרועה ביותר הן ירדו {dd}, ובלי המניה הטובה ביותר שלה, הקבוצה הראשונה הייתה צומחת {wo} בשנה במקום {cagr}.");
add("pf.mm.r5", "Equal shares, evened out about once a month, {years} years of past prices. Analysis only, not advice; nothing is bought and nothing here is saved.",
  "חלקים שווים, מאוזנים מחדש בערך פעם בחודש, {years} שנים של מחירי עבר. ניתוח בלבד, לא ייעוץ; שום דבר לא נקנה ושום דבר כאן לא נשמר.");

add("pf.paper.eyebrow", "Paper record · pretend money · written once a month, never edited", "רישום בכסף מדומה · נכתב פעם בחודש, אף פעם לא נערך");
add("pf.paper.title", "The honest {accent}", "המבחן {accent}");
add("pf.paper.accent", "test.", "ההוגן.");
add("pf.paper.lede", "A test on past prices can always be fiddled with afterwards, like changing a guess after seeing the answer. This record cannot: each month the rule's pretend picks are written down using only what was known that day, and never changed. It is the real check of whether picking stocks beats owning the whole market. No real money goes in.",
  "במבחן על מחירי עבר תמיד אפשר לשחק אחר כך, כמו לשנות ניחוש אחרי שרואים את התשובה. ברישום הזה אי אפשר: בכל חודש הבחירות המדומות של הכלל נרשמות רק לפי מה שהיה ידוע באותו יום, ולא משתנות לעולם. זו הבדיקה האמיתית אם בחירת מניות מצליחה יותר מהחזקת השוק כולו. שום כסף אמיתי לא נכנס.");
add("pf.paper.aria", "Pretend portfolio compared with the core fund and the whole market since it started", "תיק מדומה בהשוואה לקרן הליבה ולשוק כולו מאז שהתחיל");
add("pf.paper.core", "Core fund", "קרן הליבה");
add("pf.paper.rule", "Pretend portfolio", "תיק מדומה");
add("pf.paper.picks", { one: "{n} monthly pick", other: "{n} monthly picks" }, { one: "בחירה חודשית אחת", two: "שתי בחירות חודשיות", other: "{n} בחירות חודשיות" });
add("pf.paper.meta", "Since {date} · {picks} · pretend holdings now {holdings} · dashed line = the whole market", "מאז {date} · {picks} · ההחזקות המדומות עכשיו: {holdings} · קו מקווקו = השוק כולו");
add("pf.paper.none", "none (all in the core fund)", "אין (הכול בקרן הליבה)");
add("pf.paper.today", "Started today", "התחיל היום");
add("pf.paper.next", "Starts with the next daily run", "יתחיל בריצה היומית הבאה");
add("pf.paper.emptyBody", "The daily computer run writes down the first pretend picks. The line shows up from the second day.", "הריצה היומית של המחשב רושמת את הבחירות המדומות הראשונות. הקו יופיע מהיום השני.");

/* ============================================================ tabs/Playbook.jsx: this site's rules */

for (const [k, e, h, se, sh] of [
  ["savings", "Saving", "חיסכון", "How often money goes into the core (the big main fund)", "באיזו תדירות הכסף נכנס לקרן הליבה (הקרן הראשית הגדולה)"],
  ["entry", "Picking stocks (pretend)", "בחירת מניות (מדומה)", "What gets a stock into the side bet, on paper only", "מה מכניס מניה להימור הצדדי, על הנייר בלבד"],
  ["exit", "Letting go (pretend)", "שחרור (מדומה)", "What gets a stock out again", "מה מוציא מניה שוב"],
  ["sizing", "How much", "כמה", "How big a slice each one gets", "כמה גדול הנתח שכל אחת מקבלת"],
  ["risk", "Safety", "בטיחות", "What keeps a bad fall from hurting too much", "מה שומר שנפילה רעה לא תכאיב יותר מדי"],
  ["fundamental", "The business", "העסק", "How the company itself is doing, not its price chart", "מה מצב החברה עצמה, לא גרף המחיר שלה"],
  ["process", "Habits", "הרגלים", "How the plan is followed", "איך פועלים לפי התוכנית"],
]) { add(`pb.fam.${k}`, e, h); add(`pb.fam.${k}.sub`, se, sh); }

for (const [k, e, h] of [
  ["passes_history", "passed the past test", "עבר את מבחן העבר"], ["candidate", "still being checked", "עדיין בבדיקה"],
  ["inconclusive", "cannot tell yet", "עוד אי אפשר לדעת"], ["rejected", "rejected", "נדחה"], ["needs_data", "needs data", "צריך נתונים"],
  ["process_only", "habit", "הרגל"], ["testable_now", "can be tested", "אפשר לבדוק"], ["reference_baseline", "the plain way", "הדרך הפשוטה"],
  ["control", "for comparison", "להשוואה"], ["baseline", "the plain way", "הדרך הפשוטה"], ["no_clear_difference", "no clear difference", "אין הבדל ברור"],
  ["too_few_independent_windows", "too little history", "מעט מדי היסטוריה"], ["better", "better", "טוב יותר"], ["worse", "worse", "גרוע יותר"],
]) add(`pb.label.${k}`, e, h);

for (const [k, e, h] of [
  ["replicated", "replicated", "שוחזר"], ["mixed", "mixed", "מעורב"], ["weak", "weak", "חלש"], ["untested", "untested", "לא נבדק"], ["contradicted", "contradicted", "נסתר"],
]) add(`pb.ev.${k}`, e, h);

add("pb.years", { one: "{n} year", other: "{n} years" }, { one: "שנה", two: "שנתיים", other: "{n} שנים" });
add("pb.weeks", { one: "{n} week", other: "{n} weeks" }, { one: "שבוע", two: "שבועיים", other: "{n} שבועות" });
add("pb.tag.program", "program", "מחושב");
add("pb.tag.planned", "planned", "מתוכנן");
add("pb.adopt.inUse", "In use", "בשימוש");
add("pb.adopt.replaces", "Replaces the plain way if", "מחליף את הדרך הפשוטה אם");
add("pb.adopt.passes", "Passes the past test if", "עובר את מבחן העבר אם");
add("pb.adopt.moveUp", "Can move up if", "יכול לעלות שלב אם");
add("pb.adopt.usedAs", "Used as", "משמש בתור");
add("pb.adopt.followed", "Followed when", "פועלים לפיו כאשר");

add("pb.next", "Shows up after the next daily run", "יופיע אחרי הריצה היומית הבאה");
add("pb.empty.title", "No rules written down yet", "עוד לא נכתבו כללים");
add("pb.empty.body", "This site's rules live in config/rules.json.", "הכללים של האתר נמצאים בקובץ config/rules.json.");
add("pb.eyebrow", "This site's rules · version {v} · {date}", "הכללים של האתר · גרסה {v} · {date}");
add("pb.samplePrices", "sample prices", "מחירים לדוגמה");
add("pb.testedTo", "tested on real past prices up to {date}", "נבדקו על מחירי עבר אמיתיים עד {date}");
add("pb.headline", "This site's rules, {accent}", "הכללים של האתר, {accent}");
add("pb.headlineAccent", "written down first.", "נכתבו מראש.");
add("pb.simple", "In simple words:", "במילים פשוטות:");
add("pb.intro1", "these are this site's rules, written down before any results were seen, like writing a guess on paper before the coin is flipped. The stock-picking rules are experiments with pretend money, to learn whether picking stocks can beat just owning the whole market.",
  "אלה הכללים של האתר, שנכתבו לפני שנראו תוצאות כלשהן, כמו לכתוב ניחוש על דף לפני שמטילים את המטבע. כללי בחירת המניות הם ניסויים בכסף מדומה, כדי ללמוד אם בחירת מניות יכולה להצליח יותר מהחזקה פשוטה של השוק כולו.");
add("pb.introRejected", "So far, on past prices, none did: every one was rejected because it did no better than stocks picked at random.",
  "עד עכשיו, על מחירי עבר, אף אחד לא הצליח: כולם נדחו, כי לא הצליחו יותר ממניות שנבחרו באקראי.");
add("pb.intro2", "This page is not a list of what anyone will buy. In the plan, real money follows the honest action on the verdicts page, which is usually: keep buying a low-cost fund that holds the whole market.",
  "העמוד הזה הוא לא רשימה של מה שמישהו יקנה. בתוכנית, הכסף האמיתי הולך לפי הצעד המפוכח שבעמוד ההכרעות, ובדרך כלל זה: להמשיך לקנות קרן זולה שמחזיקה את כל השוק.");
add("pb.pill.rules", { one: "{n} rule", other: "{n} rules" }, { one: "כלל אחד", two: "שני כללים", other: "{n} כללים" });
add("pb.pill.tested", "{n} tested on past prices", "{n} נבדקו על מחירי עבר");
add("pb.pill.needs", "{n} need data", "{n} צריכים נתונים");
add("pb.pill.habits", { one: "{n} habit", other: "{n} habits" }, { one: "הרגל אחד", two: "שני הרגלים", other: "{n} הרגלים" });
add("pb.pill.tries", "{n} tries counted", "{n} ניסיונות נספרו");
add("pb.tryNote", "A \"try\" is any version of a rule that is tested or kept on the shelf. Roll a die enough times and a six comes up by luck, so the more tries are counted, the higher the bar a rule must clear to show it is not just luck.",
  "״ניסיון״ הוא כל גרסה של כלל שנבדקת או נשמרת על המדף. מי שמטיל קובייה מספיק פעמים יקבל שש במזל, ולכן ככל שנספרים יותר ניסיונות, עולה הרף שכלל צריך לעבור כדי להראות שזה לא רק מזל.");
add("pb.read.head", "How to read this page.", "איך לקרוא את העמוד הזה.");
add("pb.read.p1", "The tests on past prices use today's list of companies, and those are the ones that did well enough to still be here. That makes every result look better than it really was.",
  "המבחנים על מחירי עבר משתמשים ברשימת החברות של היום, ואלה החברות שהצליחו מספיק כדי להישאר בה. זה גורם לכל תוצאה להיראות טובה יותר ממה שהייתה באמת.");
add("pb.read.p2", "So a rule is judged only against {random}, never against the {goal} goal.", "לכן כלל נשפט רק מול {random}, אף פעם לא מול יעד ה-{goal}.");
add("pb.read.random", "stocks picked at random under the same conditions", "מניות שנבחרו באקראי באותם תנאים");
add("pb.read.p3", "Every rule that can be tested also gets a pretend-money record from its first run, written down as it goes, which nobody can fiddle with later. Passing the past test only makes a rule worth a closer look. Nothing here moves real money.",
  "כל כלל שאפשר לבדוק מקבל גם רישום בכסף מדומה מהריצה הראשונה שלו. הרישום נכתב תוך כדי, ואף אחד לא יכול לשנות אותו אחר כך. מעבר של מבחן העבר רק הופך כלל למשהו ששווה לבדוק מקרוב. שום דבר כאן לא מזיז כסף אמיתי.");
add("pb.read.sure", "How sure the experts are: {replicated} = other researchers checked it again and got the same answer; {mixed} = more than one source backs it, with buts and gaps; {weak} = one source says so, or it is a guess or just a habit of this site; {untested} = the sources here say nothing; {contradicted} = the sources here say it does not work.",
  "עד כמה המומחים בטוחים: {replicated} = חוקרים אחרים בדקו שוב וקיבלו אותה תשובה; {mixed} = יותר ממקור אחד תומך, עם הסתייגויות ופערים; {weak} = מקור אחד אומר את זה, או שזה ניחוש או סתם הרגל של האתר; {untested} = המקורות כאן לא אומרים כלום; {contradicted} = המקורות כאן אומרים שזה לא עובד.");
add("pb.foot", "Analysis only, not investment advice. The rules are fixed in advance. They change only at a planned review, with a note saying what changed, never right after a big drop.",
  "ניתוח בלבד, לא ייעוץ השקעות. הכללים נקבעים מראש. הם משתנים רק בבדיקה מתוכננת, עם הערה שמסבירה מה השתנה, ואף פעם לא מיד אחרי ירידה גדולה.");

add("pb.frozen.head", "Marked once, like a test grade.", "ציון שניתן פעם אחת, כמו ציון במבחן.");
add("pb.frozen.when", "The results of the past-price test were fixed on {date}, {which}.", "התוצאות של מבחן מחירי העבר נקבעו ב-{date}, {which}.");
add("pb.frozen.latest",
  { one: "the latest time these rules were re-marked ({n} earlier set is kept in the file)", other: "the latest time these rules were re-marked ({n} earlier sets are kept in the file)" },
  { one: "הפעם האחרונה שהכללים האלה קיבלו ציון מחדש (סט קודם אחד שמור בקובץ)", two: "הפעם האחרונה שהכללים האלה קיבלו ציון מחדש (שני סטים קודמים שמורים בקובץ)", other: "הפעם האחרונה שהכללים האלה קיבלו ציון מחדש ({n} סטים קודמים שמורים בקובץ)" });
add("pb.frozen.first", "the first run of these rules on real prices", "הריצה הראשונה של הכללים האלה על מחירים אמיתיים");
add("pb.frozen.body", "The numbers below keep updating each day, but the result does not. If it could flip on a lucky day, anyone could just wait for the day they like best. Newer prices count only through the pretend-money record.",
  "המספרים למטה ממשיכים להתעדכן כל יום, אבל התוצאה לא. אם היא הייתה יכולה להתהפך ביום של מזל, אפשר היה פשוט לחכות ליום הכי נוח. מחירים חדשים יותר נספרים רק דרך הרישום בכסף מדומה.");
add("pb.frozen.differs", "Today's numbers would read differently for {list}. That is shown for interest only; the fixed result stands.",
  "לפי המספרים של היום, התוצאה הייתה אחרת עבור {list}. זה מוצג רק לעניין; התוצאה שנקבעה נשארת.");
add("pb.frozen.item", "{name}: {now} instead of {frozen}", "{name}: {now} במקום {frozen}");
add("pb.frozen.itemH", "{name} ({h}): {now} instead of {frozen}", "{name} ({h}): {now} במקום {frozen}");

add("pb.sets.eyebrow", "The plans", "התוכניות");
add("pb.sets.title", "Rules that {accent}", "כללים {accent}");
add("pb.sets.accent", "fit together.", "שמתאימים זה לזה.");
add("pb.sets.lede", "A plan is a full way of behaving, like a recipe: where the savings go, and for the pretend experiments, how stocks are picked, how big each slice is, when they are let go, and what happens each month.",
  "תוכנית היא דרך פעולה שלמה, כמו מתכון: לאן הולך החיסכון, ובניסויים המדומים, איך בוחרים מניות, כמה גדול כל נתח, מתי משחררים אותן ומה עושים בכל חודש.");

add("pb.sav.eyebrow", "Saving", "חיסכון");
add("pb.sav.title", "How often should savings {accent}", "באיזו תדירות {accent}");
add("pb.sav.accent", "go in?", "החיסכון נכנס?");
add("pb.sav.emptyBody", "This study needs all the past prices, and the daily computer run has not worked it out yet.", "המחקר הזה צריך את כל מחירי העבר, והריצה היומית של המחשב עוד לא חישבה אותו.");
add("pb.sav.eyebrowFull", "Saving · {h} stretches · {windows} start dates, about {independent} truly separate", "חיסכון · תקופות של {h} · {windows} תאריכי התחלה, בערך {independent} נפרדים באמת");
add("pb.sav.lede", "In simple words: money comes in every week, and the test puts it into the core fund every week, every month, or less often. Many test stretches share the same years, like overlapping photos of one street, so there are really only a few separate ones.",
  "במילים פשוטות: כסף נכנס כל שבוע, והמבחן מכניס אותו לקרן הליבה כל שבוע, כל חודש או לעתים רחוקות יותר. הרבה תקופות מבחן חולקות את אותן שנים, כמו תמונות חופפות של אותו רחוב, ולכן יש בעצם רק מעט תקופות נפרדות.");
add("pb.sav.tooFew", "This length has too few separate stretches to tell the choices apart: {pick}", "באורך הזה יש מעט מדי תקופות נפרדות כדי להבדיל בין האפשרויות: {pick}");
add("pb.sav.noClear", "No choice was clearly better than another: {pick}", "אף אפשרות לא הייתה טובה בבירור מאחרת: {pick}");
add("pb.sav.pick", "pick what matches your pay day and what your broker charges per trade.", "לבחור את מה שמתאים ליום המשכורת ולעמלה שהברוקר גובה על כל עסקה.");
add("pb.sav.some", "Some differences are clear; read the rows.", "חלק מההבדלים ברורים; הפרטים בשורות.");
add("pb.sav.howLong", "How long", "לכמה זמן");
add("pb.th.rule", "Rule", "כלל");
add("pb.th.buys", "Buys a year", "קניות בשנה");
add("pb.th.typical", "Typical yearly growth", "צמיחה שנתית טיפוסית");
add("pb.th.typicalShort", "Typical growth", "צמיחה טיפוסית");
add("pb.th.vsPlain", "vs the plain way", "מול הדרך הפשוטה");
add("pb.th.vsAll", "vs all at once", "מול הכול בבת אחת");
add("pb.th.betterOften", "Better how often", "באיזו תדירות טוב יותר");
add("pb.th.worstDip", "Worst dip below money put in", "הצלילה הגרועה מתחת לכסף שהושקע");
add("pb.th.worstDipShort", "Worst dip", "הצלילה הגרועה");
add("pb.th.cash", "Cash waiting", "מזומן שמחכה");
add("pb.th.feeTie", "Fee where they tie", "העמלה שבה הן משתוות");
add("pb.bp", "{v} bp", "{v} נק׳ בסיס");
add("pb.feesTie", "fees tie at {v}", "העמלות משתוות ב-{v}");
add("pb.never", "never", "אף פעם");
add("pb.sav.note1", "\"Fee where they tie\": the fee per purchase, as a share of one week's savings, at which that row and the plain once-a-month way come out the same. Buying every week or every 2 weeks wins only when fees are below it; buying every 3 months wins only when fees are above it. The biggest difference between the choices here: {bps} bp a year (100 bp = 1%), which is small.",
  "״העמלה שבה הן משתוות״: העמלה לכל קנייה, כחלק מהחיסכון של שבוע אחד, שבה השורה הזו והדרך הפשוטה של פעם בחודש יוצאות שוות. קנייה כל שבוע או כל שבועיים מנצחת רק כשהעמלות נמוכות ממנה; קנייה כל 3 חודשים מנצחת רק כשהעמלות גבוהות ממנה. ההבדל הגדול ביותר בין האפשרויות כאן: {bps} נקודות בסיס בשנה (100 נקודות בסיס = 1%), וזה קטן.");
add("pb.sav.note2", "\"Worst dip\" is how far the account fell below the money put in, at a bad moment that happens about 1 time in 10.",
  "״הצלילה הגרועה״ היא כמה החשבון ירד מתחת לכסף שהושקע, ברגע רע שקורה בערך פעם אחת מתוך 10.");
add("pb.sav.bigTitle", "A big sum: all at once, or bit by bit?", "סכום גדול: הכול בבת אחת, או קצת בכל פעם?");
add("pb.sav.bigLede", "If a bonus or a gift arrives, is it better to put it all into the core fund right away, or a bit each week while the rest waits in safe short-term government savings (T-bills)?",
  "אם מגיע בונוס או מתנה, האם עדיף להכניס את כולו לקרן הליבה מיד, או קצת בכל שבוע, בזמן שהשאר מחכה בחיסכון ממשלתי בטוח לטווח קצר (T-bills)?");

add("pb.sat.eyebrow", "The side bet · pretend money", "ההימור הצדדי · כסף מדומה");
add("pb.sat.title", "Can a rule pick {accent}", "האם כלל יכול לבחור {accent}");
add("pb.sat.accent", "better stocks?", "מניות טובות יותר?");
add("pb.sat.emptyBody", "The stock-picking rules are tested on all the past prices against stocks picked at random.", "כללי בחירת המניות נבדקים על כל מחירי העבר מול מניות שנבחרו באקראי.");
add("pb.sat.eyebrowFull", "The side bet · pretend money · {from} to {to} · {years} years", "ההימור הצדדי · כסף מדומה · {from} עד {to} · {years} שנים");
add("pb.sat.lede", "In simple words: each stock-picking rule plays against {n} pretend players who pick stocks at random, like pulling names from a hat. The random players hold the {same} and pay the same fees. Only {which} stocks differs, so the race shows whether the rule has skill or just luck.",
  "במילים פשוטות: כל כלל לבחירת מניות משחק מול {n} שחקנים מדומים שבוחרים מניות באקראי, כמו לשלוף שמות מכובע. לשחקנים האקראיים יש {same}, והם משלמים אותן עמלות. רק {which} של המניות שונה, ולכן המרוץ מראה אם לכלל יש יכולת או רק מזל.");
add("pb.sat.same", "same number of stocks, swap them just as often", "אותו מספר מניות, והם מחליפים אותן באותה תדירות");
add("pb.sat.which", "which", "הבחירה");
add("pb.sat.allRejected", "So far every rule was rejected: none clearly beat the random pickers.", "עד עכשיו כל הכללים נדחו: אף אחד לא הצליח בבירור יותר מהבוחרים האקראיים.");
add("pb.sat.lg.random", "random pickers: the middle 90% of them", "בוחרים אקראיים: 90% האמצעיים שלהם");
add("pb.sat.lg.rule", "the rule (average yearly growth)", "הכלל (צמיחה שנתית ממוצעת)");
add("pb.sat.lg.core", "core fund (the whole market)", "קרן הליבה (השוק כולו)");
add("pb.sat.lg.ew", "every stock on the list, equal shares", "כל המניות ברשימה, בחלקים שווים");
add("pb.sat.aYearV", "{v} a year", "{v} בשנה");
add("pb.th.growth", "Growth a year", "צמיחה בשנה");
add("pb.th.vsCore", "vs core fund", "מול קרן הליבה");
add("pb.th.beatRandom", "Beat random pickers", "הקדים בוחרים אקראיים");
add("pb.th.beatRandomShort", "Beat random", "הקדים אקראיים");
add("pb.th.halves", "First / second half", "חצי ראשון / שני");
add("pb.th.halvesShort", "1st / 2nd half", "חצי 1 / 2");
add("pb.th.drop", "Biggest drop", "הירידה הגדולה ביותר");
add("pb.th.swaps", "Swaps a year", "החלפות בשנה");
add("pb.th.stocks", "Stocks", "מניות");
add("pb.th.result", "Result", "תוצאה");
add("pb.sat.luck", "luck chance {p}, after tries {adj}", "סיכוי למזל {p}; בהתחשב במספר הניסיונות: {adj}");
add("pb.sat.luckShort", "luck chance {p}", "סיכוי למזל {p}");
add("pb.sat.coreDrop", "core fund {v}", "קרן הליבה {v}");
add("pb.sat.aYear", "a year", "בשנה");
add("pb.sat.stops", { one: "{n} stop", other: "{n} stops" }, { one: "יציאה אחת בנקודת יציאה", two: "שתי יציאות בנקודת יציאה", other: "{n} יציאות בנקודת יציאה" });
add("pb.sat.nStocks", "{n} stocks", "{n} מניות");
add("pb.sat.note", "Core fund {core} a year; every stock on the list in equal shares {ew}. \"Beat random pickers\": out of 100 random pickers, how many the rule did better than. \"Swaps a year\": how much of the pot it changed in a year. \"Luck chance\": how likely a result this good is from luck alone (smaller is better). To pass, a rule must beat almost all of them, after counting {tries} tries, in both halves of the past.",
  "קרן הליבה {core} בשנה; כל המניות ברשימה בחלקים שווים {ew}. ״הקדים בוחרים אקראיים״: מתוך 100 בוחרים אקראיים, כמה מהם הכלל הקדים. ״החלפות בשנה״: כמה מהקופה הוא החליף בשנה. ״סיכוי למזל״: עד כמה סביר לקבל תוצאה טובה כזו ממזל בלבד (קטן יותר = טוב יותר). כדי לעבור, כלל צריך להקדים כמעט את כולם, אחרי ספירה של {tries} ניסיונות, בשני החצאים של העבר.");
add("pb.sat.aria", "How 100 would have grown: the chosen rules, the core fund and every stock in equal shares", "איך 100 היו צומחים: הכללים שנבחרו, קרן הליבה וכל המניות בחלקים שווים");
add("pb.core", "Core fund", "קרן הליבה");
add("pb.ew", "Every stock, equal shares", "כל המניות, בחלקים שווים");

add("pb.fwd.eyebrow", "Pretend-money record · written once a month, never edited", "רישום בכסף מדומה · נכתב פעם בחודש, אף פעם לא נערך");
add("pb.fwd.title", "The test {accent}", "המבחן {accent}");
add("pb.fwd.accent", "nobody can fiddle.", "שאף אחד לא יכול לשנות.");
add("pb.fwd.lede", "In simple words: each rule writes down its pretend picks at the start of each month (each quarter for the quarterly rule), using only what was known that day. It is like sealing a guess in an envelope before the game. After {min} days this record is one of the checks listed under How a rule is tested. It never puts real money in by itself.",
  "במילים פשוטות: כל כלל רושם את הבחירות המדומות שלו בתחילת כל חודש (בתחילת כל רבעון בכלל הרבעוני), רק לפי מה שהיה ידוע באותו יום. זה כמו לסגור ניחוש במעטפה לפני המשחק. אחרי {min} ימים, הרישום הזה הוא אחת הבדיקות שמופיעות תחת ״איך נבדק כלל״. הוא אף פעם לא מכניס כסף אמיתי בעצמו.");
add("pb.fwd.next", "Starts with the next daily run", "יתחיל בריצה היומית הבאה");
add("pb.fwd.emptyBody", "The daily computer run writes down the first pretend picks. Each rule's line shows up from the second day.", "הריצה היומית של המחשב רושמת את הבחירות המדומות הראשונות. הקו של כל כלל יופיע מהיום השני.");
add("pb.fwd.since", "Since", "מאז");
add("pb.fwd.days", "Days", "ימים");
add("pb.fwd.picks", "Monthly picks", "בחירות חודשיות");
add("pb.fwd.ruleGrew", "Rule grew", "הכלל צמח");
add("pb.fwd.coreGrew", "Core fund grew", "קרן הליבה צמחה");
add("pb.fwd.holdings", "Pretend holdings now", "החזקות מדומות עכשיו");
add("pb.fwd.early", "early, may change", "מוקדם, עשוי להשתנות");
add("pb.fwd.after6", "after 6 monthly picks", "אחרי 6 בחירות חודשיות");
add("pb.fwd.after126", "after 126 days of record", "אחרי 126 ימי רישום");
add("pb.fwd.stale", "prices missing: showing the last good day", "חסרים מחירים: מוצג היום התקין האחרון");
add("pb.fwd.allCore", "all in the core fund", "הכול בקרן הליבה");

add("pb.ck.eyebrow", "Chart checklist · from the video · version {v} · pretend money", "רשימת בדיקה לגרף · מהסרטון · גרסה {v} · כסף מדומה");
add("pb.ck.title", "Read the chart, {accent}", "לקרוא את הגרף, {accent}");
add("pb.ck.accent", "write the exit first.", "לכתוב קודם את היציאה.");
add("pb.ck.how", "How the computer works it out", "איך המחשב מחשב את זה");
add("pb.ck.notDir", "a plan, not an up-or-down guess", "תוכנית, לא ניחוש של עלייה או ירידה");
add("pb.ck.entry", "When a stock goes into the pretend record", "מתי מניה נכנסת לרישום המדומה");
add("pb.ck.tp", "The rule is marked on the first profit target (TP1), because the second one (TP2) would pass almost every time just by how it is set up.",
  "הכלל מקבל ציון לפי יעד הרווח הראשון (TP1), כי השני (TP2) היה עובר כמעט תמיד רק בגלל האופן שבו הוא נקבע.");
add("pb.ck.history", "What history says", "מה ההיסטוריה אומרת");
add("pb.ck.histMeta", "{from} to {to} · {n} names", "{from} עד {to} · {n} מניות");
add("pb.ck.histBody", "Every {step} market days, each stock's checklist was filled in using only what was known that day, then compared with the {bench} over the next {h} market days.",
  "כל {step} ימי מסחר, רשימת הבדיקה של כל מניה מולאה רק לפי מה שהיה ידוע באותו יום, ואז המניה הושוותה ל-{bench} ב-{h} ימי המסחר הבאים.");
add("pb.ck.fits", "Stocks whose safety plan fit the rule: {fits} on average ({fn} cases); the rest: {fails} ({xn} cases).",
  "מניות שתוכנית הבטיחות שלהן התאימה לכלל: {fits} בממוצע ({fn} מקרים); השאר: {fails} ({xn} מקרים).");
add("pb.ck.each", "Each step on its own: average result vs the {bench} when it pointed up or down", "כל שלב לבדו: התוצאה הממוצעת מול {bench} כשהוא הצביע לעלייה או לירידה");
add("pb.ck.step", "Step", "שלב");
add("pb.ck.up", "Said \"up\"", "אמר ״עלייה״");
add("pb.ck.down", "Said \"down\"", "אמר ״ירידה״");
add("pb.ck.ifWorked", "If a step worked, its \"up\" number would sit clearly above its \"down\" number. The small number after each figure is how many cases.",
  "אם שלב היה עובד, המספר של ״עלייה״ היה גבוה בבירור מהמספר של ״ירידה״. המספר הקטן אחרי כל נתון הוא מספר המקרים.");
add("pb.ck.later", "Shows up after the next daily run.", "יופיע אחרי הריצה היומית הבאה.");

add("pb.rules.eyebrow", "Every rule", "כל הכללים");
add("pb.rules.title", "Written down, {accent}", "נכתבו {accent}");
add("pb.rules.accent", "in advance.", "מראש.");
add("pb.rules.lede", "Each rule has one fixed set of numbers, written down before any result was seen. Some come from the books and studies on this site's shelf; many are just habits of this site, and each says which. Next to each: why it is here, how sure the experts are, and what would get it dropped. The stock-picking ones are pretend-money experiments, not a shopping list.",
  "לכל כלל יש סט קבוע אחד של מספרים, שנכתב לפני שנראתה תוצאה כלשהי. חלקם באים מהספרים והמחקרים שעל המדף של האתר; רבים הם סתם הרגלים של האתר, וכל כלל אומר מה הוא. ליד כל כלל: למה הוא כאן, עד כמה המומחים בטוחים, ומה יגרום להוריד אותו. כללי בחירת המניות הם ניסויים בכסף מדומה, לא רשימת קניות.");
add("pb.rc.sure", "how sure: {ev}", "רמת ודאות: {ev}");
add("pb.rc.open", "The exact rule, its numbers and tests", "הכלל המדויק, המספרים והמבחנים שלו");
add("pb.rc.hide", "Hide the details", "להסתיר את הפרטים");
add("pb.rc.exact", "Exactly how it works", "איך זה עובד בדיוק");
add("pb.rc.params", "Its numbers, fixed in advance", "המספרים שלו, שנקבעו מראש");
add("pb.rc.why", "Why it is on the list", "למה הוא ברשימה");
add("pb.rc.dropped", "Dropped if", "יורד מהרשימה אם");
add("pb.rc.source", "Where it comes from", "מאיפה זה בא");
add("pb.rc.needs", "Needs data not available yet: {what}. The owner must say yes to any new data source first.", "צריך נתונים שעוד אין: {what}. בעלי האתר צריכים לאשר קודם כל מקור נתונים חדש.");

add("pb.proc.eyebrow", "This month · {month}", "החודש · {month}");
add("pb.proc.title", "The monthly {accent}", "רשימת הבדיקה {accent}");
add("pb.proc.accent", "checklist.", "החודשית.");
add("pb.proc.lede", "In simple words: a short to-do list for each month. Check the money went into the whole-market fund; look at the pretend-money record; write down any fall of 10% or more; place no other orders. Buying the whole-market fund is the only real-money step; the stock rules stay pretend. Ticks stay on this device.",
  "במילים פשוטות: רשימת משימות קצרה לכל חודש. לבדוק שהכסף נכנס לקרן על כל השוק; להסתכל על הרישום בכסף מדומה; לרשום כל ירידה של 10% או יותר; לא לתת שום הוראה אחרת. קניית הקרן על כל השוק היא הצעד היחיד בכסף אמיתי; כללי המניות נשארים מדומים. הסימונים נשמרים רק במכשיר הזה.");
add("pb.proc.yearly", "Once a year", "פעם בשנה");
add("pb.proc.yearlyLede", "Look over the rules and the size of the pretend stock pot at the yearly review, never right after a fall.", "לעבור על הכללים ועל גודל קופת המניות המדומה בבדיקה השנתית, ואף פעם לא מיד אחרי ירידה.");

add("pb.test.eyebrow", "How a rule is tested", "איך נבדק כלל");
add("pb.test.title", "How a rule {accent}", "איך כלל {accent}");
add("pb.test.accent", "earns its place.", "מרוויח את מקומו.");
add("pb.test.lede", "In simple words: the marking scheme, written before any result was seen, like a teacher writing the answer key before the exam. {tries} versions are counted as tries, so the bar for \"not just luck\" rises with every rule added.",
  "במילים פשוטות: שיטת הציונים, שנכתבה לפני שנראתה תוצאה כלשהי, כמו מורה שכותב את התשובון לפני המבחן. {tries} גרסאות נספרות כניסיונות, ולכן הרף של ״לא רק מזל״ עולה עם כל כלל שנוסף.");
add("pb.test.programText", "the computer checks it on every daily run.", "המחשב בודק את זה בכל ריצה יומית.");
add("pb.test.plannedText", "written down but not built yet: people check it by hand. \"E04\" and the like name the experiments listed below.",
  "נכתב אבל עוד לא נבנה: אנשים בודקים את זה ביד. ״E04״ וכדומה הם שמות הניסויים שמופיעים למטה.");
add("pb.test.adopt", "Passes the past test (pretend record only, no money)", "עובר את מבחן העבר (רישום מדומה בלבד, בלי כסף)");
add("pb.test.candidate", "Still being checked", "עדיין בבדיקה");
add("pb.test.reject", "Dropped", "יורד מהרשימה");
add("pb.test.later", "Later checks, not built yet ({n})", "בדיקות בהמשך, עוד לא נבנו ({n})");
add("pb.test.numbers", "The numbers", "המספרים");
add("pb.test.body", "A rule must beat almost every random picker: out of {runs} baskets of stocks picked at random, at most {maxAbove} may match or beat it (it must beat about {pctBar} of them: the {pctMin} bar, made stricter for {tries} tries), and it must beat at least {halves} of them in each half of the past. Its biggest drop may be at most {dd} points deeper than the whole-market fund's. It may swap at most {turn} of the pretend stock pot a year ({turn} means changing the whole pot twice). Pretend trades happen the day after the rule says so. Then it needs at least {days} days of pretend-money record, and must pass every other check.",
  "כלל צריך להקדים כמעט כל בוחר אקראי: מתוך {runs} סלים של מניות שנבחרו באקראי, לכל היותר {maxAbove} יכולים להשתוות לו או להקדים אותו (הוא צריך להקדים בערך {pctBar} מהם: רף ה-{pctMin}, שהוחמר בגלל {tries} ניסיונות), והוא צריך להקדים לפחות {halves} מהם בכל חצי של העבר. הירידה הגדולה ביותר שלו יכולה להיות עמוקה לכל היותר ב-{dd} נקודות מזו של הקרן על כל השוק. הוא יכול להחליף לכל היותר {turn} מקופת המניות המדומה בשנה ({turn} פירושו להחליף את כל הקופה פעמיים). עסקאות מדומות מתבצעות ביום שאחרי שהכלל אומר. אחר כך הוא צריך לפחות {days} ימים של רישום בכסף מדומה, ולעבור כל בדיקה אחרת.");
add("pb.test.comparedWith", "Compared with:", "בהשוואה ל:");
add("pb.test.passesIf", "Passes if:", "עובר אם:");
add("pb.test.left", "Left out, and what is not built yet", "מה נשאר בחוץ, ומה עוד לא נבנה");

add("pb.dec.eyebrow", "Open", "פתוח");
add("pb.dec.title", "Questions for {accent}", "שאלות {accent}");
add("pb.dec.accent", "the site's owner.", "לבעלי האתר.");
add("pb.dec.lede", "Questions only the site's owner can answer. Where a number says 'decided for this version', it is already fixed and the only question is whether it is fine. Changing it later makes a new version and counts as another try.",
  "שאלות שרק בעלי האתר יכולים לענות עליהן. כשליד מספר כתוב ״decided for this version״, הוא כבר נקבע, והשאלה היא רק אם הוא מתאים. שינוי שלו בהמשך יוצר גרסה חדשה ונספר כניסיון נוסף.");
add("pb.dec.call", "owner's call", "החלטה של הבעלים");
add("pb.dec.tidy", "Tidy-up notes for the program's author, nothing to decide here ({n})", "הערות סידור לכותב התוכנה, אין כאן מה להחליט ({n})");
add("pb.dec.past", "List of past decisions", "רשימת ההחלטות הקודמות");

export default { en, he };
