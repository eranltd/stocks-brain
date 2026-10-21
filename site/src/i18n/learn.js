// The Learn pages: How it works, Lessons (Insights), Library (KB), Learnings, People, Quiz, Routines, Runs, Admin; plus
// the sentences lib/people.js and lib/quiz.js write.
// Convention: `export default { en: {...}, he: {...} }` with identical keys (see shell.js and lib/i18n.js); financial
// words from glossary.js. i18n.test.js checks the file.
//
// Written as pairs, add(key, English, Hebrew), so each English text sits next to its Hebrew one.
// Voice: a research notebook anyone may read. No "we", "our" or "the household": "the site", "the plan", "a person".
// Hebrew: plain modern Hebrew, infinitives or impersonal forms rather than gendered commands ("אפשר ללחוץ"), tickers,
// names and file paths in Latin letters. Words used across these pages: guess ניחוש, a person's public call עמדה
// (פומבית), lesson לקח, principle עיקרון, claim (a dated guess from a video) טענה, timed job משימה (מתוזמנת), run ריצה,
// data pack חבילת הנתונים.

const en = {}, he = {};
/** One text in both languages. */
const add = (key, e, h) => { en[key] = e; he[key] = h; };

/* ============================================================ shared */

add("nothing.title", "Nothing matches", "אין התאמות");
add("edit", "Edit", "עריכה");
add("close", "Close", "סגירה");
add("source", "Source: {what}", "מקור: {what}");
add("version", "v{v}", "גרסה {v}");
add("dataFeeds.title.a", "Where the data", "מאיפה הנתונים");
add("dataFeeds.title.b", "comes from.", "מגיעים.");

/* ============================================================ Library (tabs/KB.jsx) */

add("kb.v.all", "All", "הכול");
add("kb.v.hit", "Right", "צדק");
add("kb.v.miss", "Wrong", "טעה");
add("kb.v.flat", "About even", "בערך תיקו");
add("kb.v.pending", "Waiting", "ממתין");
add("kb.eyebrow", "Library", "הספרייה");
add("kb.title.a", "Every guess,", "כל ניחוש");
add("kb.title.b", "kept.", "נשמר.");
add("kb.lede1",
  "In simple words: this is the brain's diary. Every stock guess it ever made is kept here, with the reason, what would prove it wrong, and how it turned out.",
  "במילים פשוטות: זה היומן של המוח. כל ניחוש על מניה שהמוח עשה אי פעם נשמר כאן, עם הנימוק, עם מה שהיה מוכיח שהוא טועה, ועם איך שזה נגמר.");
add("kb.lede2",
  "Like a school report, nothing gets erased, the bad marks too. About a month after each guess, code checks it: did the stock do better or worse than the whole market? Each morning the brain rereads its most recent pages before it guesses again. These guesses have no proven record yet, so they are for learning, not for real money.",
  "כמו בתעודה של בית ספר, שום דבר לא נמחק, גם לא הציונים הרעים. בערך חודש אחרי כל ניחוש, קוד בודק אותו: האם המניה הצליחה יותר או פחות מהשוק כולו? בכל בוקר המוח קורא שוב את הדפים האחרונים שלו לפני שהוא מנחש שוב. לניחושים האלה עוד אין היסטוריית תוצאות מוכחת, ולכן הם נועדו ללמידה, לא לכסף אמיתי.");
add("kb.search", "Search a stock code, a reason, or a guess number", "חיפוש לפי סימול מניה, נימוק או מספר ניחוש");
add("kb.searchLabel", "Search the library", "חיפוש בספרייה");
add("kb.direction", "Direction", "כיוון");
add("kb.directionLabel", "Filter by direction", "סינון לפי כיוון");
add("kb.dir.all", "All directions", "כל הכיוונים");
add("kb.dir.bullish", "Bullish (expects it to beat the market)", "נטייה לעלייה (צפי שהמניה תצליח יותר מהשוק)");
add("kb.dir.bearish", "Bearish (expects it to trail the market)", "נטייה לירידה (צפי שהמניה תפגר אחרי השוק)");
add("kb.dir.neutral", "Neutral (no strong view)", "בלי נטייה (אין עמדה חזקה)");
add("kb.result", "Result", "תוצאה");
add("kb.sort", "Sort", "מיון");
add("kb.sort.newest", "Newest", "החדשים ביותר");
add("kb.sort.excess", "Most ahead of market", "הכי הרבה מעל השוק");
add("kb.sort.hits", "Right first", "הנכונים קודם");
add("kb.count", "{n} of {total} guesses", "{n} מתוך {total} ניחושים");
add("kb.empty", 'Try a stock code or another word, or set the filters back to "All".', "אפשר לנסות סימול מניה או מילה אחרת, או להחזיר את המסננים ל״הכול״.");
add("kb.more", "Show more", "להציג עוד");
add("kb.lessons.eyebrow", "Lessons from videos", "שיעורים מסרטונים");
add("kb.lessons.body", "Lessons from videos and books, plus dated guesses from them, live on the Lessons page.", "שיעורים מסרטונים ומספרים, וגם ניחושים מתוארכים שעלו בהם, נמצאים בעמוד השיעורים.");
add("kb.lessons.open", "Open Lessons", "לעמוד השיעורים");
add("kb.chip.hit", "hit {pct}", "פגיעה {pct}");
add("kb.chip.miss", "miss {pct}", "החטאה {pct}");
add("kb.chip.flat", "flat {pct}", "בלי שינוי {pct}");
add("kb.chip.pending", "pending", "ממתין לבדיקה");

/* ============================================================ Learnings (tabs/Learnings.jsx) */

add("lrn.eyebrow", "Lessons learned · v{v}", "לקחים שנלמדו · גרסה {v}");
add("lrn.title.a", "What the scores", "מה הציונים");
add("lrn.title.b", "have shown.", "הראו.");
add("lrn.lede1",
  "In simple words: these are the lessons taken from the brain's checked guesses, so it does not make the same mistake twice.",
  "במילים פשוטות: אלה הלקחים מהניחושים של המוח שכבר נבדקו, כדי שלא יחזור על אותה טעות פעמיים.");
add("lrn.lede2",
  "A lesson only counts if the scores show it, not because the AI thinks so. Like a coach who watches the game tape, a person writes each lesson and points to the guesses that prove it. The brain rereads the lessons still in use every morning.",
  "לקח נחשב רק אם הציונים מראים אותו, לא כי הבינה המלאכותית חושבת כך. כמו מאמן שצופה בהקלטה של המשחק, אדם כותב כל לקח ומצביע על הניחושים שמוכיחים אותו. בכל בוקר המוח קורא שוב את הלקחים שעדיין בשימוש.");
add("lrn.s.lessons", "lessons", "לקחים");
add("lrn.s.updated", "Updated {date}.", "עודכן: {date}.");
add("lrn.s.inUse", "in use", "בשימוש");
add("lrn.s.inUseDesc", "Given to the brain every morning.", "נמסרים למוח בכל בוקר.");
add("lrn.s.retired", "retired", "הוצאו משימוש");
add("lrn.s.retiredDesc", "No longer true or useful. Kept for history; the brain does not read them.", "כבר לא נכונים או לא מועילים. נשמרים לתיעוד; המוח לא קורא אותם.");
add("lrn.s.people", "People", "אנשים");
add("lrn.s.write", "write them", "כותבים אותם");
add("lrn.s.writeDesc", "The AI does not add lessons here. People decide.", "הבינה המלאכותית לא מוסיפה כאן לקחים. אנשים מחליטים.");
add("lrn.empty.title", "No lessons yet", "עדיין אין לקחים");
add("lrn.empty.body", "A lesson gets added once enough guesses have been checked to show a pattern. One or two results could just be luck.", "לקח נוסף רק אחרי שנבדקו מספיק ניחושים כדי להראות דפוס. תוצאה אחת או שתיים יכולות להיות סתם מזל.");
add("lrn.status.active", "active", "בשימוש");
add("lrn.status.retired", "retired", "הוצא משימוש");
add("lrn.proof",
  { one: "Proof · {count} checked guess (tap to open)", other: "Proof · {count} checked guesses (tap to open)" },
  { one: "הוכחה · ניחוש אחד שנבדק (אפשר ללחוץ כדי לפתוח)", other: "הוכחה · {count} ניחושים שנבדקו (אפשר ללחוץ כדי לפתוח)" });
add("lrn.sample", " (sample lessons shown until live data exists)", " (מוצגים לקחים לדוגמה עד שיהיו נתונים אמיתיים)");

/* ============================================================ Runs (tabs/Runs.jsx) */

add("runs.eyebrow", "Runs · behind the scenes", "ריצות · מאחורי הקלעים");
add("runs.title.a", "Every morning,", "כל בוקר,");
add("runs.title.b", "on the record.", "מתועד.");
add("runs.lede1",
  "In simple words: this is the brain's time sheet. Each market morning it works once, and every run is written down here: what it cost and how long it took, so nothing runs up a bill unseen.",
  "במילים פשוטות: זה דף הנוכחות של המוח. בכל בוקר מסחר הוא עובד פעם אחת, וכל ריצה נרשמת כאן: כמה עלתה וכמה זמן לקחה, כדי ששום חשבון לא יגדל בלי שמישהו יראה.");
add("runs.lede2",
  "Each run also notes a fingerprint of the data pack it read and which rule versions it used. If the pack is too big for the AI to read (over the size cap), the run stops before the AI starts. Runs on the project's Claude subscription show $0.",
  "כל ריצה רושמת גם טביעת אצבע של חבילת הנתונים שקראה, ובאילו גרסאות של הכללים השתמשה. אם החבילה גדולה מדי בשביל הבינה המלאכותית (מעל תקרת הגודל), הריצה נעצרת עוד לפני שהבינה המלאכותית מתחילה. ריצות על מנוי ה-Claude של הפרויקט מופיעות בעלות של 0 דולר.");
add("runs.logged", "{n} mornings logged", "{n} בקרים נרשמו");
add("runs.s.avg", "average cost per morning", "עלות ממוצעת לבוקר");
add("runs.s.avgDesc", "The aim is to stay under {usd}.", "המטרה היא להישאר מתחת ל-{usd}.");
add("runs.s.total", "last {n} runs", "{n} הריצות האחרונות");
add("runs.s.over",
  { one: "{count} run cost more than the {usd} warning line.", other: "{count} runs cost more than the {usd} warning line." },
  { one: "ריצה אחת עלתה יותר מקו האזהרה של {usd}.", other: "{count} ריצות עלו יותר מקו האזהרה של {usd}." });
add("runs.s.mins", "average minutes", "דקות בממוצע");
add("runs.s.minsDesc", "Clock time from packing the data to saving the result.", "הזמן מאריזת הנתונים ועד שמירת התוצאה.");
add("runs.s.stopped", "stopped safely", "נעצרו בבטחה");
add("runs.s.stoppedDesc", "Stopped on purpose because a size limit or a form check failed, so nothing bad got saved.", "נעצרו בכוונה כי מגבלת גודל או בדיקת מבנה נכשלה, כך ששום דבר פגום לא נשמר.");
add("runs.chart.title", "What each morning cost", "כמה עלה כל בוקר");
add("runs.chart.under", "under the warning line", "מתחת לקו האזהרה");
add("runs.chart.over", "over the warning line", "מעל קו האזהרה");
add("runs.chart.stopped", "stopped", "נעצרה");
add("runs.th.morning", "Morning", "בוקר");
add("runs.th.result", "Result", "תוצאה");
add("runs.th.cost", "Cost", "עלות");
add("runs.th.minutes", "Minutes", "דקות");
add("runs.th.pack", "Pack size", "גודל החבילה");
add("runs.th.guesses", "Guesses", "ניחושים");
add("runs.th.versions", "Rule versions", "גרסאות הכללים");
add("runs.th.fingerprint", "Fingerprint", "טביעת אצבע");
add("runs.status.ok", "ok", "תקינה");
add("runs.status.failed", "failed", "נכשלה");
add("runs.retry", " · retry", " · ניסיון חוזר");

/* ============================================================ Quiz (tabs/Quiz.jsx, lib/quiz.js) */

add("quiz.title", "Guess the candle", "נחשו את הנר");
add("quiz.intro",
  "A real chart from one of the stocks on the list. Each candle is one day: green closed higher than it opened, red lower. One candle is marked. What kind is it, and what happened next?",
  "גרף אמיתי של אחת המניות ברשימה. כל נר הוא יום אחד: ירוק נסגר גבוה יותר ממה שנפתח, אדום נמוך יותר. נר אחד מסומן. איזה סוג נר זה, ומה קרה אחר כך?");
add("quiz.loading", "Finding a candle…", "מחפשים נר…");
add("quiz.none", "No candles to quiz on yet.", "עדיין אין נרות לשאלות.");
add("quiz.mystery", "A mystery stock", "מניה מסתורית");
add("quiz.marked", "the marked candle", "הנר המסומן");
add("quiz.q1", "1. What kind of candle is the marked one?", "1. איזה סוג נר הוא הנר המסומן?");
add("quiz.right", "Right!", "נכון!");
add("quiz.itWas", "It was a {kind}.", "זה היה: {kind}.");
add("quiz.q2", "2. A week later, was it higher or lower?", "2. שבוע אחר כך, המניה הייתה גבוהה יותר או נמוכה יותר?");
add("quiz.higher", "▲ Higher", "▲ גבוהה יותר");
add("quiz.lower", "▼ Lower", "▼ נמוכה יותר");
add("quiz.notThisTime", "Not this time.", "לא הפעם.");
add("quiz.reveal.higher", "It was {name}, on {date}. The week after ended higher; the chart now shows those days too.", "זו הייתה {name}, ב-{date}. השבוע שאחרי נגמר גבוה יותר; עכשיו הגרף מראה גם את הימים האלה.");
add("quiz.reveal.lower", "It was {name}, on {date}. The week after ended lower; the chart now shows those days too.", "זו הייתה {name}, ב-{date}. השבוע שאחרי נגמר נמוך יותר; עכשיו הגרף מראה גם את הימים האלה.");
add("quiz.lesson",
  "The honest lesson: in this site's own tests, candle shapes did not beat chance. Keep an eye on the score next to luck while playing.",
  "בכנות: בבדיקות של האתר עצמו, דפוסי נרות לא ניבאו טוב יותר ממזל. כדאי לשים לב לניקוד לצד המזל תוך כדי משחק.");
add("quiz.next", "Next candle →", "לנר הבא ←");
// lib/quiz.js scoreWords
add("quiz.score.none", "No guesses yet on this device.", "עדיין אין ניחושים במכשיר הזה.");
add("quiz.score.kind", "candle names {right} of {tried} (luck: about {luck})", "שמות נרות: {right} מתוך {tried} (מזל לבדו: בערך {luck})");
add("quiz.score.week", "next week {right} of {tried} (luck: about {luck})", "השבוע הבא: {right} מתוך {tried} (מזל לבדו: בערך {luck})");
add("quiz.score.line", "Your score: {parts}.", "הניקוד במכשיר הזה: {parts}.");

/* ============================================================ Lessons (tabs/Insights.jsx) */

add("ins.eyebrow", "Lessons · library v{v}", "שיעורים · ספרייה גרסה {v}");
add("ins.title.a", "What the videos", "מה הסרטונים");
add("ins.title.b", "have taught.", "לימדו.");
add("ins.lede1",
  "In simple words: this is a notebook of lessons from videos, rewritten in the site's own words, so the brain can reread them every morning.",
  "במילים פשוטות: זו מחברת של שיעורים מסרטונים, כתובים מחדש במילים של האתר, כדי שהמוח יוכל לקרוא אותם שוב בכל בוקר.");
add("ins.lede2",
  'There are two kinds of notes. A {principle} is a lasting lesson, like "do not put all your eggs in one basket". A {claim} is a guess about one moment, like a weather forecast: it has a date, it runs out, and nobody knows if it was right until code checks it against real prices later. The brain reads the principles that fit the day, and only the claims that have not run out.',
  "יש שני סוגים של רשומות. {principle} הוא שיעור שנשאר לאורך זמן, כמו ״לא לשים את כל הביצים בסל אחד״. {claim} היא ניחוש על רגע אחד, כמו תחזית מזג אוויר: יש לה תאריך, תוקפה פג, ואף אחד לא יודע אם צדקה עד שקוד בודק אותה מול מחירים אמיתיים בהמשך. המוח קורא את העקרונות שמתאימים ליום, ורק את הטענות שתוקפן עוד לא פג.");
add("ins.word.principle", "principle", "עיקרון");
add("ins.word.claim", "claim", "טענה");
add("ins.s.sources", "sources", "מקורות");
add("ins.s.sourcesDesc", "Videos so far. Books and talks would go here too.", "בינתיים סרטונים. גם ספרים והרצאות ייכנסו לכאן.");
add("ins.s.principles", "principles", "עקרונות");
add("ins.s.principlesDesc", "Lasting lessons in the site's own words, each a sentence or two (at most 280 characters).", "שיעורים לאורך זמן במילים של האתר, כל אחד משפט או שניים (עד 280 תווים).");
add("ins.s.live", "live claims", "טענות בתוקף");
add("ins.s.liveDesc", "Guesses still in date. {n} more have run out; they are kept to check later which videos guessed well.", "ניחושים שעוד בתוקף. עוד {n} כבר פגו; הם נשמרים כדי לבדוק בהמשך אילו סרטונים ניחשו טוב.");
add("ins.s.themes", "themes", "נושאים");
add("ins.s.themesDesc", "Topics the lessons are about. Most common: {list}.", "הנושאים שהשיעורים עוסקים בהם. הנפוצים ביותר: {list}.");
add("ins.search", "Search lessons, guesses, stock codes, topics", "חיפוש שיעורים, ניחושים, סימולים ונושאים");
add("ins.searchLabel", "Search lessons", "חיפוש שיעורים");
add("ins.view", "View", "תצוגה");
add("ins.view.sources", "By source", "לפי מקור");
add("ins.view.themes", "By theme", "לפי נושא");
add("ins.view.claims", "Dated guesses", "ניחושים מתוארכים");
add("ins.allThemes", "all themes", "כל הנושאים");
add("ins.empty", 'Try another word, or tap "all themes" to clear the topic.', "אפשר לנסות מילה אחרת, או ללחוץ על ״כל הנושאים״ כדי לנקות את הנושא.");
add("ins.source", "source", "מקור");
add("ins.kind.video", "video", "סרטון");
add("ins.kind.book", "book", "ספר");
add("ins.kind.talk", "talk", "הרצאה");
add("ins.kind.article", "article", "מאמר");
add("ins.watch", "Watch", "לצפייה");
add("ins.principlesHead", "Principles · {n}", "עקרונות · {n}");
add("ins.principlesOf", "Principles · {n} of {total}", "עקרונות · {n} מתוך {total}");
add("ins.noMatch", "No lessons from this video match the search.", "אין שיעורים מהסרטון הזה שמתאימים לחיפוש.");
add("ins.showAll", "Show all {n} principles", "להציג את כל {n} העקרונות");
add("ins.dated", "Dated guesses · {n}", "ניחושים מתוארכים · {n}");
add("ins.stillInDate", "({n} still in date)", "({n} עדיין בתוקף)");
add("ins.noClaims", "This video made no dated guesses.", "בסרטון הזה לא היו ניחושים מתוארכים.");
add("ins.expired", "expired", "פג תוקף");
add("ins.themeCount", { one: "{count} principle", other: "{count} principles" }, { one: "עיקרון אחד", other: "{count} עקרונות" });
add("ins.show", "Show", "הצגה");
add("ins.live", "Still in date", "בתוקף");
add("ins.all", "Include run out", "כולל אלה שפגו");
add("ins.notProven", "Not proven until code checks them against real prices", "לא מוכח עד שקוד בודק מול מחירים אמיתיים");
add("ins.noLive.title", "No guesses still in date", "אין ניחושים בתוקף");
add("ins.noLive.body", 'Tap "Include run out" to see the older ones.', "אפשר ללחוץ על ״כולל אלה שפגו״ כדי לראות את הישנים.");
add("ins.status.open", "open", "פתוחה");
add("ins.status.confirmed", "confirmed", "אושרה");
add("ins.status.contradicted", "contradicted", "הופרכה");
add("ins.status.unchecked", "unchecked", "לא נבדקה");

/* ============================================================ How it works (tabs/HowItWorks.jsx) */

add("how.kind.data", "Saved data", "נתונים שמורים");
add("how.kind.code", "Plain code", "קוד פשוט");
add("how.kind.ai", "AI", "בינה מלאכותית");
add("how.kind.people", "People", "אנשים");
// the map's stops: a short label for the map and a plain description
add("how.st.watchlist.label", "Watchlist", "רשימת מעקב");
add("how.st.watchlist.text",
  "The starting list: which companies to watch, plus the whole market to compare them with (the benchmark). The list lives in one file, and an automatic checker complains if any code sneaks in a company of its own.",
  "רשימת הבסיס: אילו חברות לעקוב אחריהן, ואת השוק כולו כדי להשוות אליו (מדד הייחוס). הרשימה נמצאת בקובץ אחד, ובודק אוטומטי מתלונן אם קוד כלשהו מכניס חברה משלו.");
add("how.st.fetch.label", "Fetch", "איסוף");
add("how.st.fetch.text",
  "After the market closes, a small program collects each day's prices and saves them. Like a plug adapter, the part that talks to the price company can be swapped for another one.",
  "אחרי סגירת המסחר, תוכנה קטנה אוספת את המחירים של כל יום ושומרת אותם. כמו מתאם לשקע, את החלק שמדבר עם חברת המחירים אפשר להחליף באחר.");
add("how.st.library.label", "Lessons", "שיעורים");
add("how.st.library.text",
  "Lessons from videos and books, in the site's own words, each saying where it came from. Only the lessons that fit the day go into the brain's lunchbox.",
  "שיעורים מסרטונים ומספרים, במילים של האתר, וכל אחד אומר מאיפה הגיע. רק השיעורים שמתאימים ליום נכנסים לקופסת האוכל של המוח.");
add("how.st.packer.label", "Packer", "אריזה");
add("how.st.packer.text",
  "Packs the brain's lunchbox: one file with the rules, how much each stock went up or down and how bumpy it was (no prices), recent mornings, matching lessons, the checked calls of famous investors, when each company reports next, and the chart checklist (background only, not proven). If the box is too big for the AI to read, the run stops before the AI is asked anything.",
  "אורזת את קופסת האוכל של המוח: קובץ אחד עם הכללים, בכמה כל מניה עלתה או ירדה וכמה היא קפצה (בלי מחירים), הבקרים האחרונים, שיעורים מתאימים, העמדות שנבדקו של משקיעים מפורסמים, מתי כל חברה מפרסמת דוחות בפעם הבאה, ורשימת הבדיקה של הגרף (רקע בלבד, לא מוכח). אם הקופסה גדולה מדי בשביל הבינה המלאכותית, הריצה נעצרת לפני שהיא נשאלת משהו.");
add("how.st.brain.label", "Brain · AI", "המוח · AI");
add("how.st.brain.short", "Brain", "המוח");
add("how.st.brain.text",
  "The only AI step. Every market morning it wakes up by itself (with a second try later that morning in case the data was late) and reads the lunchbox. Inside, it acts like a small team: three analysts, a doubter for each company, a builder and a reviewer. It writes down its guesses. They are guesses with no proven record yet, and they must follow a set form or nothing is saved.",
  "השלב היחיד של בינה מלאכותית. בכל בוקר מסחר המוח מתעורר לבד (עם ניסיון שני מאוחר יותר באותו בוקר, למקרה שהנתונים איחרו) וקורא את קופסת האוכל. בפנים הוא פועל כמו צוות קטן: שלושה אנליסטים, ספקן לכל חברה, בונה ובודק. הוא רושם את הניחושים שלו. אלה ניחושים בלי היסטוריית תוצאות מוכחת, והם חייבים לעמוד במבנה קבוע, אחרת שום דבר לא נשמר.");
add("how.st.checker.label", "Checker", "בדיקה");
add("how.st.checker.text",
  "Plain code, like a teacher with a checklist: every company must be on the watchlist, no numbers in the written reasons, no forbidden words, no file too big, no passwords. If something fails, the guess is not saved.",
  "קוד פשוט, כמו מורה עם רשימת בדיקה: כל חברה חייבת להיות ברשימת המעקב, בלי מספרים בנימוקים הכתובים, בלי מילים אסורות, בלי קובץ גדול מדי, בלי סיסמאות. אם משהו נכשל, הניחוש לא נשמר.");
add("how.st.runs.label", "Run record", "רישום ריצה");
add("how.st.runs.text",
  "A receipt for each morning: what it cost, how many minutes it took, a fingerprint of the lunchbox, which rule versions it read, and the guesses. Every change is kept in the project's history, so nothing can be quietly changed later.",
  "קבלה לכל בוקר: כמה עלה, כמה דקות לקח, טביעת אצבע של קופסת האוכל, אילו גרסאות של הכללים נקראו, והניחושים. כל שינוי נשמר בהיסטוריה של הפרויקט, כך ששום דבר לא יכול להשתנות בשקט אחר כך.");
add("how.st.dashboard.label", "This site", "האתר הזה");
add("how.st.dashboard.text",
  "The site you are reading. It is rebuilt and put online by itself every time the project changes.",
  "האתר שקוראים עכשיו. הוא נבנה מחדש ועולה לרשת לבד בכל פעם שהפרויקט משתנה.");
add("how.st.scorer.label", "Scorer", "ניקוד");
add("how.st.scorer.text",
  "About a month later, code keeps score: did each guess do better or worse than the whole market? It is plain arithmetic, like a referee reading the scoreboard, not anyone's opinion.",
  "בערך חודש אחר כך, קוד סופר נקודות: האם כל ניחוש הצליח יותר או פחות מהשוק כולו? זה חשבון פשוט, כמו שופט שקורא את לוח התוצאות, לא דעה של מישהו.");
add("how.st.kb.label", "Library", "הספרייה");
add("how.st.kb.text",
  "The brain's diary: every checked guess, kept forever, the bad ones too. The most recent pages go back into the lunchbox for the next morning.",
  "היומן של המוח: כל ניחוש שנבדק, שמור לתמיד, גם הרעים. הדפים האחרונים חוזרים לקופסת האוכל לבוקר הבא.");
add("how.st.you.label", "People", "אנשים");
add("how.st.you.text",
  "People read the scores and write lessons, each with proof, as a proposed change someone reviews (a pull request). The AI never changes its own rules, just as a player does not rewrite the rule book.",
  "אנשים קוראים את הציונים וכותבים לקחים, כל אחד עם הוכחה, כהצעת שינוי שמישהו בודק (pull request). הבינה המלאכותית אף פעם לא משנה את הכללים של עצמה, כמו ששחקן לא כותב מחדש את ספר החוקים.");
add("how.st.rulebook.label", "Rule book", "ספר הכללים");
add("how.st.rulebook.text",
  "The rules: the plan, the safety rails, how results are measured, and what has been learned. Each change gets a version number, and the next lunchbox includes them. The circle closes here and starts again tomorrow.",
  "הכללים: התוכנית, מעקות הבטיחות, איך מודדים תוצאות, ומה כבר נלמד. כל שינוי מקבל מספר גרסה, וקופסת האוכל הבאה כוללת אותם. כאן המעגל נסגר, ומחר הוא מתחיל שוב.");
// the five-step story
add("how.story.eyebrow", "How it works", "איך זה עובד");
add("how.story.title.a", "The whole thing,", "הכול,");
add("how.story.title.b", "in five steps.", "בחמישה צעדים.");
add("how.story.lede1",
  "In simple words: a computer guesses about stocks every morning, and plain code checks later whether it was right. This page shows how, step by step.",
  "במילים פשוטות: מחשב מנחש משהו על מניות בכל בוקר, וקוד פשוט בודק אחר כך אם הוא צדק. העמוד הזה מראה איך, צעד אחר צעד.");
add("how.story.lede2",
  "Think of a weather forecaster who writes tomorrow's forecast in a notebook, and a friend who checks it a month later. Until the notebook shows many good forecasts, nobody plans a picnic on it.",
  "כמו חזאי שכותב את תחזית מחר במחברת, וחבר שבודק אותה אחרי חודש. עד שהמחברת מראה הרבה תחזיות טובות, אף אחד לא מתכנן לפיה פיקניק.");
add("how.story.1.head", "Data comes in", "נתונים נכנסים");
add("how.story.1.body", "After the market closes each day, a small program collects the day's prices, like picking up the newspaper from the doorstep.", "אחרי סגירת המסחר בכל יום, תוכנה קטנה אוספת את מחירי היום, כמו להרים את העיתון מהמדרגות.");
add("how.story.2.head", "The brain reads it", "המוח קורא");
add("how.story.2.body", "Next morning, the brain, an AI, reads a tidy pack of that data plus its rules and old lessons, and makes a call: a guess about which stocks might do better or worse than the whole market.", "למחרת בבוקר המוח, שהוא בינה מלאכותית, קורא חבילה מסודרת של הנתונים האלה יחד עם הכללים והלקחים הישנים, ומנחש: אילו מניות אולי יצליחו יותר או פחות מהשוק כולו.");
add("how.story.3.head", "Code checks the call", "קוד בודק את הניחוש");
add("how.story.3.body", "Plain code checks that the guess follows the rules. Then, about a month later, it keeps score: did the guess beat the whole market or not? Plain arithmetic, no opinions.", "קוד פשוט בודק שהניחוש עומד בכללים. אחר כך, בערך חודש מאוחר יותר, הוא סופר נקודות: האם הניחוש הצליח יותר מהשוק כולו או לא? חשבון פשוט, בלי דעות.");
add("how.story.4.head", "The site shows it", "האתר מראה");
add("how.story.4.body", "This site shows every guess and every score, the misses too, so anyone can see how the brain is really doing.", "האתר הזה מראה כל ניחוש וכל ציון, גם את ההחטאות, כדי שכל אחד יוכל לראות איך המוח באמת מצליח.");
add("how.story.5.head", "People learn", "אנשים לומדים");
add("how.story.5.body", "People read the scores and write down lessons. The brain reads them next time. The AI never changes its own rules.", "אנשים קוראים את הציונים וכותבים לקחים. המוח קורא אותם בפעם הבאה. הבינה המלאכותית אף פעם לא משנה את הכללים של עצמה.");
add("how.money.head", "What about real money?", "ומה עם כסף אמיתי?");
add("how.money.body",
  "The brain's stock calls are guesses with no proven record yet, so real money in the plan does not follow them. The plan follows the honest action on the Brain's verdicts page, which is usually a low-cost fund that holds the whole market, bought a little at a time on a regular schedule. That stays the plan unless the scores ever show, over a long time, that something else does better.",
  "לניחושים של המוח על מניות עוד אין היסטוריית תוצאות מוכחת, ולכן הכסף האמיתי בתוכנית לא הולך אחריהם. התוכנית הולכת לפי הצעד המפוכח בעמוד ההכרעות של המוח, שהוא בדרך כלל קרן זולה על כל השוק, שנקנית קצת בכל פעם לפי לוח זמנים קבוע. זו נשארת התוכנית, אלא אם הציונים יראו פעם, לאורך זמן רב, שמשהו אחר עובד טוב יותר.");
// the map
add("how.map.title", "the whole map, step by step", "המפה כולה, צעד אחר צעד");
add("how.map.stops", "{n} stops", "{n} תחנות");
add("how.map.eyebrow", "How a guess gets made and checked", "איך ניחוש נוצר ונבדק");
add("how.map.head.a", "Every checked guess teaches", "כל ניחוש שנבדק מלמד");
add("how.map.head.b", "the next one.", "את הבא.");
add("how.map.body", "{a}, {b}, plain code checks it, {c}. {n} stops in one circle. Tap a stop, or press Replay to watch it go round.", "{a}, {b}, קוד פשוט בודק אותו, {c}. {n} תחנות במעגל אחד. אפשר ללחוץ על תחנה, או על ״להפעיל שוב״ כדי לראות את הסיבוב.");
add("how.map.a", "Data comes in", "נתונים נכנסים");
add("how.map.b", "the AI makes one guess", "הבינה המלאכותית מנחשת ניחוש אחד");
add("how.map.c", "people decide", "אנשים מחליטים");
add("how.map.replay", "Replay", "להפעיל שוב");
add("how.map.step", "Step through", "צעד אחר צעד");
add("how.map.aria", "Map of the daily circle, from the watchlist to the rule book and back", "מפת המעגל היומי, מרשימת המעקב אל ספר הכללים ובחזרה");
add("how.map.people", "people", "אנשים");
add("how.map.prev", "Previous stop", "התחנה הקודמת");
add("how.map.next", "Next stop", "התחנה הבאה");
add("how.map.goTo", "Go to {label}", "מעבר אל {label}");
// the roadmap
add("how.ms.M1.label", "Scaffold", "שלד");
add("how.ms.M1.desc", "The frame: rules, forms, the checker and this site, on made-up sample data.", "המסגרת: כללים, מבנים, הבודק והאתר הזה, על נתוני דוגמה מומצאים.");
add("how.ms.M2.label", "Prices", "מחירים");
add("how.ms.M2.desc", "Real daily prices, collected by themselves after each close.", "מחירים יומיים אמיתיים, שנאספים לבד אחרי כל סגירה.");
add("how.ms.M3.label", "Brain", "המוח");
add("how.ms.M3.desc", "Pack the lunchbox, let the AI guess, then code checks and saves it.", "לארוז את קופסת האוכל, לתת לבינה המלאכותית לנחש, ואז קוד בודק ושומר.");
add("how.ms.M4.label", "Scoring", "ניקוד");
add("how.ms.M4.desc", "About a month later, each guess is compared with the whole market.", "בערך חודש אחר כך, כל ניחוש מושווה לשוק כולו.");
add("how.ms.M5.label", "Routine", "משימות מתוזמנות");
add("how.ms.M5.desc", "Timers run the whole circle by themselves. The brain already runs by itself every market morning.", "שעונים מריצים את כל המעגל לבד. המוח כבר רץ לבד בכל בוקר מסחר.");
add("how.run.eyebrow", "For the builder", "למי שבונה");
add("how.run.title.a", "Run the next", "להריץ את");
add("how.run.title.b", "step.", "השלב הבא.");
add("how.run.lede",
  "This part is for whoever looks after the code. Everything runs from the project folder with a few plain commands. The AI does one step only; a person approves every change and makes every decision.",
  "החלק הזה מיועד למי שמתחזק את הקוד. הכול רץ מתיקיית הפרויקט בכמה פקודות פשוטות. הבינה המלאכותית עושה צעד אחד בלבד; אדם מאשר כל שינוי ומקבל כל החלטה.");
add("how.run.s.milestones", "milestones", "שלבי בנייה");
add("how.run.s.milestonesDesc", "Building steps, from the bare frame to a circle that runs by itself every day.", "שלבי הבנייה, מהמסגרת הריקה ועד מעגל שרץ לבד כל יום.");
add("how.run.s.done", "done", "הושלמו");
add("how.run.s.doneDesc", "This site, daily prices, the brain and the scorekeeping. Next: the other timed jobs.", "האתר הזה, המחירים היומיים, המוח וספירת הנקודות. הבא בתור: שאר המשימות המתוזמנות.");
add("how.run.s.people", "People", "אנשים");
add("how.run.s.choose", "choose the data companies", "בוחרים את חברות הנתונים");
add("how.run.s.chooseDesc", "No new data source or add-on without a person's yes.", "שום מקור נתונים או תוסף חדש בלי אישור של אדם.");
add("how.run.cmd.sample", "Make the made-up sample data again", "ליצור מחדש את נתוני הדוגמה המומצאים");
add("how.run.cmd.lint", "Run the checker: forms, rules, no passwords, no oversized files", "להריץ את הבודק: מבנים, כללים, בלי סיסמאות, בלי קבצים גדולים מדי");
add("how.run.cmd.build", "Copy the data over for this site", "להעתיק את הנתונים לאתר הזה");
add("how.run.cmd.dev", "Open this site on your own computer", "לפתוח את האתר הזה במחשב האישי");
add("how.run.repo", "Repo: {repo}", "מאגר הקוד: {repo}");
add("how.ring.title", "THE ROADMAP", "מפת הדרכים");
add("how.ring.aria", "Roadmap: {done} of {total} milestones shipped", "מפת הדרכים: {done} מתוך {total} שלבים הושלמו");

/* ============================================================ People (tabs/People.jsx, lib/people.js) */

add("ppl.kind.investor", "investor", "השקעות");
add("ppl.kind.educator", "educator", "חינוך פיננסי");
add("ppl.kind.writer", "writer", "כתיבה");
add("ppl.kind.teacher", "teacher", "הוראה");
add("ppl.group.investors", "Investors whose funds must show what they own", "משקיעים שהקרנות שלהם חייבות לחשוף מה הן מחזיקות");
add("ppl.group.investorsSub", "Their funds publish their list every three months, so how those moves did can be checked later.", "הקרנות שלהם מפרסמות את הרשימה כל שלושה חודשים, כך שאפשר לבדוק בהמשך איך המהלכים האלה הצליחו.");
add("ppl.group.teachers", "Teachers and writers", "מורים וכותבים");
add("ppl.group.teachersSub", "They teach how to think about price, risk and personal habits.", "הם מלמדים איך לחשוב על מחיר, על סיכון ועל הרגלים אישיים.");
add("ppl.group.principles", "Ideas only", "רעיונות בלבד");
add("ppl.group.principlesSub", "Their lessons are kept; there are no new calls to check.", "השיעורים שלהם נשמרים; אין עמדות חדשות לבדוק.");
add("ppl.src.13f", "13F filing (fund's holdings list)", "דיווח 13F (רשימת האחזקות של הקרן)");
add("ppl.src.letter", "letter", "מכתב");
add("ppl.src.memo", "memo", "מזכר");
add("ppl.src.interview", "interview", "ראיון");
add("ppl.src.post", "post", "פוסט");
add("ppl.cost.free", "Free", "חינם");
add("ppl.cost.official", "Free and official", "חינם ורשמי");
add("ppl.cost.paid", "Costs money", "עולה כסף");
add("ppl.conn.people",
  "Each call is typed in by hand from where it was made public, in the site's own words. Code then checks whether it did better or worse than the whole market (the S&P 500 fund).",
  "כל עמדה מוקלדת ידנית מהמקום שבו פורסמה, במילים של האתר. אחר כך קוד בודק אם היא הצליחה יותר או פחות מהשוק כולו (הקרן על מדד S&P 500).");
add("ppl.conn.holdings_13f",
  'The list of stocks a big fund must show the government every three months (a "13F"). It comes out about six weeks late. Off until the owner switches it on.',
  "רשימת המניות שקרן גדולה חייבת להגיש לרשויות בארה״ב כל שלושה חודשים (דיווח ״13F״). היא מתפרסמת באיחור של כשישה שבועות. כבוי עד שבעל האתר יפעיל אותו.");
add("ppl.conn.x_accounts",
  "Posts from the people on this page. Off. If it is ever on, only links are kept, never their words.",
  "פוסטים של האנשים בעמוד הזה. כבוי. אם יופעל אי פעם, יישמרו רק קישורים, אף פעם לא הטקסט שלהם.");
add("ppl.conn.news",
  "Short notes on why a company on the list moved, gathered after the market closes from a fixed list of trusted sources. They explain a move; they are never a reason to act.",
  "הסברים קצרים למה חברה ברשימה זזה, שנאספים אחרי סגירת המסחר מרשימה קבועה של מקורות מהימנים. הם מסבירים תנועה, ואף פעם אינם סיבה לפעול.");
// The four feeds' names and schedules in Hebrew (config/sources.json has them in English until PR 2).
add("ppl.conn.name.people", "People to learn from", "משקיעים שלומדים מהם");
add("ppl.conn.name.holdings_13f", "Fund holdings (SEC 13F filings)", "אחזקות של קרנות (דיווחי 13F לרשות ניירות ערך האמריקאית)");
add("ppl.conn.name.x_accounts", "Accounts to follow on X", "חשבונות לעקוב אחריהם ב-X");
add("ppl.conn.name.news", "Why it moved (web research)", "למה זה זז (חיפוש ברשת)");
add("ppl.conn.when.news", "after each market day", "אחרי כל יום מסחר");
add("ppl.sec.calls", "Their calls, checked", "העמדות שלהם, בבדיקה");
add("ppl.sec.who", "Who is followed", "אחרי מי עוקבים");
add("ppl.sec.use", "How they are used", "איך משתמשים בהם");
add("ppl.sec.research", "What studies found", "מה מחקרים מצאו");
add("ppl.sec.connected", "Where the data comes from", "מאיפה הנתונים מגיעים");
add("ppl.sec.add", "Add one", "להוסיף");
add("ppl.empty.title", "No people list yet", "עדיין אין רשימת אנשים");
add("ppl.empty.body", "The file config/people.json will list the people to learn from and the dated calls they made in public.", "הקובץ config/people.json יפרט את האנשים שלומדים מהם ואת העמדות המתוארכות שהציגו בפומבי.");
add("ppl.eyebrow", "People · v{v} · {date}", "אנשים · גרסה {v} · {date}");
add("ppl.scoredTo", " · scored to {date}", " · נוקד עד {date}");
add("ppl.samplePrices", "sample prices", "מחירים לדוגמה");
add("ppl.head.a", "People to", "אנשים");
add("ppl.head.b", "learn from.", "ללמוד מהם.");
add("ppl.intro1",
  "In simple words: this page is about famous investors and teachers. They are here to learn from, like a good cookbook, not to copy their trades.",
  "במילים פשוטות: העמוד הזה עוסק במשקיעים ומורים מפורסמים. הם כאן כדי ללמוד מהם, כמו מספר בישול טוב, לא כדי להעתיק את העסקאות שלהם.");
add("ppl.intro2",
  "Studies have not shown that copying famous investors works for the people who copy. So this page only writes down what they did and when, and later checks it against the whole market, the same way the brain's own guesses are checked. None of it changes where the plan's real money goes.",
  "מחקרים לא הראו שהעתקה של משקיעים מפורסמים עובדת בשביל מי שמעתיק. לכן העמוד הזה רק רושם מה הם עשו ומתי, ובהמשך בודק את זה מול השוק כולו, באותה דרך שבה נבדקים הניחושים של המוח. שום דבר מזה לא משנה לאן הולך הכסף האמיתי של התוכנית.");
add("ppl.onPage", "On this page", "בעמוד הזה");
add("ppl.s.following", "people followed", "אנשים במעקב");
add("ppl.s.followingDesc", "Plus {n} whose ideas are kept but not tracked.", "ועוד {n} שהרעיונות שלהם נשמרים אבל לא נמצאים במעקב.");
add("ppl.s.calls", "public calls written down", "עמדות פומביות שנרשמו");
add("ppl.s.callsDesc", "Each one has the day it became public and a link to where it was said.", "לכל אחת יש את היום שבו פורסמה וקישור למקום שבו נאמרה.");
add("ppl.s.matured", "calls half a year old", "עמדות בנות חצי שנה");
add("ppl.s.maturedDesc", "Each call gets {judge} weeks (about half a year) before it is judged.", "כל עמדה מקבלת {judge} שבועות (בערך חצי שנה) לפני שהיא נשפטת.");
add("ppl.s.needed", "needed to judge anyone", "נדרשות כדי לשפוט מישהו");
add("ppl.s.enough", "Some people have enough judged calls to start reading their record.", "לחלק מהאנשים יש מספיק עמדות שנשפטו כדי להתחיל לקרוא את התוצאות שלהם.");
add("ppl.s.notEnough", "Nobody has that many yet, so no one's record says anything yet. A few coin flips prove nothing.", "עדיין לאף אחד אין כל כך הרבה, ולכן התוצאות של אף אחד עוד לא אומרות כלום. כמה הטלות מטבע לא מוכיחות דבר.");
add("ppl.footer", "Source: config/people.json v{v}. Summaries are in the site's own words with a link to the source; their text is never copied.", "מקור: config/people.json גרסה {v}. הסיכומים כתובים במילים של האתר עם קישור למקור; הטקסט שלהם אף פעם לא מועתק.");
add("ppl.footerScores", "Source: config/people.json v{v}, data/people/scores.json (core {core}, percentages from daily closes, no prices). Summaries are in the site's own words with a link to the source; their text is never copied.", "מקור: config/people.json גרסה {v}, ‏data/people/scores.json (קרן הליבה {core}, אחוזים ממחירי הסגירה היומיים, בלי מחירים). הסיכומים כתובים במילים של האתר עם קישור למקור; הטקסט שלהם אף פעם לא מועתק.");
// a call's numbers
add("ppl.leg.inWeeks", "in {n} wk", "בעוד {n} שב׳");
add("ppl.leg.vsMarket", "vs the market", "לעומת השוק");
add("ppl.leg.whole", "whole market {pct}", "השוק כולו {pct}");
add("ppl.calls.eyebrow",
  { one: "The ledger · {count} public call", other: "The ledger · {count} public calls" },
  { one: "היומן · עמדה פומבית אחת", other: "היומן · {count} עמדות פומביות" });
add("ppl.calls.title.a", "Their calls,", "העמדות שלהם,");
add("ppl.calls.title.b", "checked.", "בבדיקה.");
add("ppl.calls.lede",
  'Counting starts on the first market day {after} a call became public, because that is the first day a copier could have acted. "Vs the market" means how much better or worse the stock did than simply owning the whole market (an S&P 500 fund). If they sold, the stock doing worse counts in their favour. Each call is judged at {judge} weeks, and a person needs {min} judged calls before their record means anything. Tap a call for the details.',
  "הספירה מתחילה ביום המסחר הראשון {after} שהעמדה פורסמה, כי זה היום הראשון שבו מי שמעתיק יכול היה לפעול. ״לעומת השוק״ פירושו בכמה המניה הצליחה יותר או פחות מאשר החזקה פשוטה של השוק כולו (קרן על מדד S&P 500). אם הם מכרו, ירידה של המניה נחשבת לטובתם. כל עמדה נשפטת אחרי {judge} שבועות, ונדרשות {min} עמדות שנשפטו לפני שהתוצאות של אדם אומרות משהו. אפשר ללחוץ על עמדה כדי לראות פרטים.");
add("ppl.calls.after", "after", "אחרי");
add("ppl.calls.empty.title", "No calls written down yet", "עדיין לא נרשמו עמדות");
add("ppl.calls.empty.body",
  "Add a call to config/people.json through a pull request (a proposed change someone reviews): the day it became public, the person and fund, the company, whether they were for it or against it, what they did in the site's own words, and a link to the source. The next daily run checks it.",
  "מוסיפים עמדה לקובץ config/people.json דרך pull request (הצעת שינוי שמישהו בודק): היום שבו פורסמה, האדם והקרן, החברה, אם הם היו בעד או נגד, מה הם עשו במילים של האתר, וקישור למקור. הריצה היומית הבאה בודקת אותה.");
add("ppl.calls.note",
  "Percent changes come from each day's closing price; prices are not published. A 13F call (from the list a big fund must show the government every three months) shows what the whole fund owns, not always the named person's own pick. Calls marked as the firm's count for the fund only.",
  "השינויים באחוזים מחושבים ממחיר הסגירה של כל יום; המחירים עצמם לא מתפרסמים. עמדה מדיווח 13F (הרשימה שקרן גדולה חייבת להגיש לרשויות כל שלושה חודשים) מראה מה הקרן כולה מחזיקה, ולא תמיד את הבחירה האישית של האדם שבשמו היא מופיעה. עמדות שמסומנות כשל הקרן נספרות רק לזכות הקרן.");
add("ppl.call.firm", " · the fund's call", " · עמדה של הקרן");
add("ppl.call.via", " via {fund}", " דרך {fund}");
add("ppl.call.filed", " · fund list filed {date}", " · רשימת הקרן הוגשה ב-{date}");
add("ppl.call.public", " · made public {date}", " · פורסמה ב-{date}");
add("ppl.call.notScored", "Not scored: {detail}.", "לא נוקדה: {detail}.");
add("ppl.call.atWeeks", "At {judge} weeks: {pct} vs the whole market", "אחרי {judge} שבועות: {pct} לעומת השוק כולו");
add("ppl.call.soFarTail", "; so far {pct}", "; עד עכשיו {pct}");
add("ppl.call.soFar", "So far {pct} vs the whole market · {since} of {judge} weeks", "עד עכשיו {pct} לעומת השוק כולו · {since} מתוך {judge} שבועות");
add("ppl.call.tooNew", "Too new to check yet.", "חדשה מדי לבדיקה.");
add("ppl.call.soFarHead", "So far · {n} wk", "עד עכשיו · {n} שב׳");
add("ppl.call.weeks", "{n} weeks", "{n} שבועות");
add("ppl.call.counted", "Counted from the closing price on {date}, the first market day after it became public; judged at {judge} weeks.", "הספירה מתחילה ממחיר הסגירה ב-{date}, יום המסחר הראשון אחרי שהעמדה פורסמה; העמדה נשפטת אחרי {judge} שבועות.");
// who
add("ppl.who.eyebrow", "Who is followed", "אחרי מי עוקבים");
add("ppl.who.title.a", "Why each one,", "למה כל אחד,");
add("ppl.who.title.b", "and the catch.", "וממה להיזהר.");
add("ppl.who.lede", "For each person: what they are good at teaching, and what to watch out for. Tap a card to read more and see their links.", "לכל אדם: מה אפשר ללמוד ממנו, וממה כדאי להיזהר. אפשר ללחוץ על כרטיס כדי לקרוא עוד ולראות קישורים.");
add("ppl.link.x", "@{handle} on X", "@{handle} ב-X");
add("ppl.link.13f", "Fund holdings lists (13F) · {filer}", "רשימות האחזקות של הקרן (13F) · {filer}");
add("ppl.links", { one: "{count} link", other: "{count} links" }, { one: "קישור אחד", other: "{count} קישורים" });
add("ppl.learn", "Learn", "ללמוד");
add("ppl.careful", "Careful", "זהירות");
// how they are used
add("ppl.use.eyebrow", "How they are used", "איך משתמשים בהם");
add("ppl.use.title.a", "Learn from them.", "ללמוד מהם.");
add("ppl.use.title.b", "Check them.", "לבדוק אותם.");
add("ppl.use.lede", "Think of them as teachers, not as a shopping list. Here is how their ideas are allowed to touch the work on this site.", "כדאי לחשוב עליהם כמורים, לא כרשימת קניות. כך מותר לרעיונות שלהם להשפיע על העבודה באתר.");
add("ppl.use.more", { one: "{count} more rule", other: "{count} more rules" }, { one: "עוד כלל אחד", other: "עוד {count} כללים" });
// research
add("ppl.res.eyebrow",
  { one: "What the research says · {count} finding", other: "What the research says · {count} findings" },
  { one: "מה המחקר אומר · ממצא אחד", other: "מה המחקר אומר · {count} ממצאים" });
add("ppl.res.title.a", "Copying famous investors", "העתקה של משקיעים מפורסמים");
add("ppl.res.title.b", "has not been shown to work.", "לא הוכחה כשיטה שעובדת.");
add("ppl.res.lede",
  "Researchers have studied people who follow stock tips in public and people who copy what big funds report owning. Most of it did not help the copiers. Tap a finding for a short summary in the site's words and its source.",
  "חוקרים בדקו אנשים שהולכים אחרי טיפים פומביים על מניות, ואנשים שמעתיקים את מה שקרנות גדולות מדווחות שהן מחזיקות. ברוב המקרים זה לא עזר למעתיקים. אפשר ללחוץ על ממצא כדי לראות סיכום קצר במילים של האתר ואת המקור.");
// connected
add("ppl.conn.eyebrow", "Data feeds · sources v{v}", "מקורות נתונים · גרסה {v}");
add("ppl.conn.lede", "Only the hand-typed list is on. Nothing that costs money, and no new data company, gets switched on until the owner decides.", "רק הרשימה שמוקלדת ידנית פועלת. שום דבר שעולה כסף, ואף חברת נתונים חדשה, לא מופעלים עד שבעל האתר מחליט.");
add("ppl.conn.byHand", "by hand", "ידנית");
add("ppl.conn.on", "on", "פועל");
add("ppl.conn.off", "off", "כבוי");
add("ppl.conn.counts", " · {people} people, {calls} calls", " · {people} אנשים, {calls} עמדות");
// add one
add("ppl.add.eyebrow", "How to", "איך עושים את זה");
add("ppl.add.title.a", "Add a person", "להוסיף אדם");
add("ppl.add.title.b", "or a call.", "או עמדה.");
add("ppl.add.lede",
  "It is all one file, config/people.json. Change it through a pull request (a proposed edit someone reviews). An automatic checker reads it for mistakes, and the next daily run checks any new call.",
  "הכול בקובץ אחד, config/people.json. משנים אותו דרך pull request (הצעת שינוי שמישהו בודק). בודק אוטומטי קורא אותו ומחפש טעויות, והריצה היומית הבאה בודקת כל עמדה חדשה.");
add("ppl.add.edit", "Edit people.json", "עריכת people.json");
add("ppl.add.person", "A person: what to include", "אדם: מה לכלול");
add("ppl.add.p1", "Why they are followed, what to learn from them, and a fair caution.", "למה עוקבים אחריהם, מה לומדים מהם, ואזהרה הוגנת.");
add("ppl.add.p2", "Links only to where they publish themselves or to official pages; an X handle only if it is confirmed.", "קישורים רק למקומות שבהם הם מפרסמים בעצמם או לדפים רשמיים; חשבון X רק אם הוא מאומת.");
add("ppl.add.p3", "If their fund files a 13F (its holdings list for the government), the fund's name and its government ID number (CIK).", "אם הקרן שלהם מגישה דיווח 13F (רשימת האחזקות לרשויות), את שם הקרן ואת מספר הזיהוי הממשלתי שלה (CIK).");
add("ppl.add.p4", "Facts about a real person only from primary or official sources, or a named reputable report.", "עובדות על אדם אמיתי רק ממקורות ראשוניים או רשמיים, או מכתבה מוכרת ששמה מצוין.");
add("ppl.add.call", "A call: the fields", "עמדה: השדות");
add("ppl.field.id", "the public date, the fund and the ticker, e.g. 2026-08-14-fund-ticker", "תאריך הפרסום, הקרן והסימול, למשל 2026-08-14-fund-ticker");
add("ppl.field.person", "the person's id from the people list", "המזהה של האדם מרשימת האנשים");
add("ppl.field.via", "the fund or firm the call came from, as named on the source", "הקרן או החברה שממנה הגיעה העמדה, בשם שמופיע במקור");
add("ppl.field.date", "the day it became public (for a 13F, its filing date)", "היום שבו פורסמה (בדיווח 13F, תאריך ההגשה)");
add("ppl.field.ticker", "the stock's short code; it must be a company on the list, other ones are kept but not checked", "הסימול של המניה; היא חייבת להיות חברה ברשימה, אחרות נשמרות אבל לא נבדקות");
add("ppl.field.stance", "bullish (for it: bought or added) or bearish (against it: sold out or argued against)", "bullish (בעד: קנו או הוסיפו) או bearish (נגד: מכרו הכול או טענו נגד)");
add("ppl.field.what", "one sentence in the site's own words, no prices", "משפט אחד במילים של האתר, בלי מחירים");
add("ppl.field.credit_person", "false when it is the firm's move, not the person's own; it then counts for the fund only", "false כשזה מהלך של החברה ולא של האדם עצמו; אז העמדה נספרת רק לזכות הקרן");
add("ppl.field.source", "13f (a fund's holdings list), letter, memo, interview or post, and the link", "13f (רשימת אחזקות של קרן), letter, memo, interview או post, והקישור");
add("ppl.own.head", "In the site's own words, always.", "תמיד במילים של האתר.");
add("ppl.own.body",
  "This project is public, so it keeps a short summary and a link, never their text or a price. A call is background for the brain, never a reason on its own to move money. The plan's real money follows the honest action on the verdicts page, usually a low-cost fund that holds the whole market. See {link} for the daily loop.",
  "הפרויקט הזה ציבורי, ולכן נשמרים בו סיכום קצר וקישור, אף פעם לא הטקסט שלהם או מחיר. עמדה היא רקע בשביל המוח, ואף פעם לא סיבה בפני עצמה להזיז כסף. הכסף האמיתי של התוכנית הולך לפי הצעד המפוכח בעמוד ההכרעות, בדרך כלל קרן זולה על כל השוק. על הלולאה היומית אפשר לקרוא בעמוד {link}.");
add("ppl.own.link", "How it works", "איך זה עובד");
// lib/people.js
add("rec.principlesOnly", "Principles only: no calls to score.", "רעיונות בלבד: אין עמדות לנקד.");
add("rec.firm",
  { one: "{count} {firm} call logged, scored as the firm's, not as personal picks.", other: "{count} {firm} calls logged, scored as the firm's, not as personal picks." },
  { one: "נרשמה עמדה אחת של {firm}, והיא מנוקדת כשל הקרן, לא כבחירה אישית.", other: "נרשמו {count} עמדות של {firm}, והן מנוקדות כשל הקרן, לא כבחירות אישיות." });
add("rec.none", "No calls logged yet.", "עדיין לא נרשמו עמדות.");
add("rec.head26",
  { one: "{count} call logged, {matured} half a year old", other: "{count} calls logged, {matured} half a year old" },
  { one: "נרשמה עמדה אחת, {matured} מהן בנות חצי שנה", other: "נרשמו {count} עמדות, {matured} מהן בנות חצי שנה" });
add("rec.headWeeks",
  { one: "{count} call logged, {matured} {weeks} weeks old", other: "{count} calls logged, {matured} {weeks} weeks old" },
  { one: "נרשמה עמדה אחת, {matured} מהן בנות {weeks} שבועות", other: "נרשמו {count} עמדות, {matured} מהן בנות {weeks} שבועות" });
add("rec.tooFew", ": too few to judge (needs {min}).", ": מעט מדי כדי לשפוט (צריך {min}).");
add("rec.enough", ": right {pct} of the time, typical call {med} vs the core.", ": צדקו ב-{pct} מהפעמים, עמדה טיפוסית {med} לעומת השוק כולו.");
add("status.unscored", "not scored", "לא נוקדה");
add("status.right", "right", "צדקה");
add("status.wrong", "wrong", "טעתה");
add("status.maturing", "maturing", "מבשילה");
add("status.weeksOf", "{since} of {judge} weeks", "{since} מתוך {judge} שבועות");
add("status.judgedRight", "judged right at {weeks} weeks, {pct} for the call vs the core", "נשפטה אחרי {weeks} שבועות: צדקה, {pct} לטובת העמדה לעומת השוק כולו");
add("status.judgedWrong", "judged wrong at {weeks} weeks, {pct} for the call vs the core", "נשפטה אחרי {weeks} שבועות: טעתה, {pct} לטובת העמדה לעומת השוק כולו");
add("status.maturingPhrase", "maturing, {detail}", "מבשילה, {detail}");
add("status.notScoredPhrase", "not scored: {detail}", "לא נוקדה: {detail}");
add("reason.notYet", "not scored yet", "עוד לא נוקדה");
add("reason.nextRun", "scored after the next daily run", "תנוקד אחרי הריצה היומית הבאה");

/* ============================================================ Routines (tabs/Routines.jsx) */

add("rt.cad.all", "All", "הכול");
add("rt.cad.daily", "Every trading day", "כל יום מסחר");
add("rt.cad.weekly", "Every week", "כל שבוע");
add("rt.cad.monthly", "Every month", "כל חודש");
add("rt.cad.on_demand", "Only when asked", "רק לפי בקשה");
["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d, i) => add(`rt.dow.${i}`, d, ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][i]));
add("rt.weekly", "{day}", "יום {day}");
add("rt.everyDay", "daily", "כל יום");
add("rt.monthly", "day {dom} of the month", "היום ה-{dom} בחודש");
add("rt.whenAsked", "when you ask", "לפי בקשה");
add("rt.utc", "{times} UTC", "{times} לפי UTC");
add("rt.utcLocal", "{times} UTC ({local} your time)", "{times} לפי UTC ({local} לפי השעון המקומי)");
add("rt.runner.github_actions", "GitHub Action", "פעולת GitHub");
add("rt.runner.github_actions.title", "Started by a schedule in a GitHub Actions workflow file", "מופעלת לפי לוח זמנים בקובץ workflow של GitHub Actions");
add("rt.runner.claude_routine", "Claude routine", "משימה של Claude");
add("rt.runner.claude_routine.title", "Started by a scheduled Claude Code session on the project's Claude subscription", "מופעלת על ידי סשן מתוזמן של Claude Code על מנוי ה-Claude של הפרויקט");
add("rt.note.close_run",
  "The brain runs by itself every market morning, then the brain workflow checks its picks and records them. If a check fails, nothing is recorded.",
  "המוח רץ לבד בכל בוקר מסחר, ואחר כך תהליך העבודה של המוח בודק את הבחירות שלו ורושם אותן. אם בדיקה נכשלת, שום דבר לא נרשם.");
add("rt.when.close_run", "Morning after each US trading day (Mon–Fri)", "הבוקר שאחרי כל יום מסחר בארה״ב (ב׳–ו׳)");
add("rt.inHours", { one: "in {count} h", other: "in {count} h" }, { one: "בעוד שעה", two: "בעוד שעתיים", other: "בעוד {count} שעות" });
add("rt.inDays", { one: "in {count} d", other: "in {count} d" }, { one: "בעוד יום", two: "בעוד יומיים", other: "בעוד {count} ימים" });
add("rt.llm.sub", { one: "One runs on the Claude subscription, $0 per run", other: "{count} run on the Claude subscription, $0 per run" }, { one: "אחת רצה על מנוי Claude, בעלות של 0 דולר לריצה", other: "{count} רצות על מנוי Claude, בעלות של 0 דולר לריצה" });
add("rt.llm.capOthers", "the others are capped at up to {usd} per run", "לשאר יש תקרה של עד {usd} לריצה");
add("rt.llm.capEach", "each is capped at up to {usd} per run", "לכל אחת יש תקרה של עד {usd} לריצה");
add("rt.eyebrow", "Routines · behind the scenes · v{v}", "משימות מתוזמנות · מאחורי הקלעים · גרסה {v}");
add("rt.title.a", "Every timed job,", "כל משימה מתוזמנת,");
add("rt.title.b", "in the open.", "בגלוי.");
add("rt.lede1",
  "In simple words: these are the jobs that run by themselves on a timer, like an alarm clock that also makes the coffee. This page shows each one, so nothing happens in secret.",
  "במילים פשוטות: אלה המשימות שרצות לבד לפי שעון, כמו שעון מעורר שגם מכין קפה. העמוד הזה מראה כל אחת מהן, כדי ששום דבר לא יקרה בסתר.");
add("rt.lede2",
  "For each job: what it does, when, who starts it, what it may spend and what it saves. Every run is logged below, failures too. A job that would change the rules or the watchlist never acts alone; it asks a person first with a proposed change (a pull request).",
  "לכל משימה: מה היא עושה, מתי, מי מפעיל אותה, כמה מותר לה להוציא ומה היא שומרת. כל ריצה נרשמת למטה, גם הכישלונות. משימה שהייתה משנה את הכללים או את רשימת המעקב אף פעם לא פועלת לבד; קודם היא שואלת אדם, עם הצעת שינוי (pull request).");
add("rt.actions", "Actions", "ריצות ב-GitHub");
add("rt.s.on", "switched on", "פועלות");
add("rt.s.onDesc", "The rest are planned and get switched on one building step at a time.", "השאר מתוכננות ויופעלו שלב בנייה אחד בכל פעם.");
add("rt.s.next", "next: {name}", "הבאה: {name}");
add("rt.s.nothing", "nothing scheduled", "שום דבר לא מתוזמן");
add("rt.s.lastRun", "last run", "הריצה האחרונה");
add("rt.s.noneYet", "none yet", "עדיין אין");
add("rt.s.firstRun", "The first timed run needs the price company's key (Tiingo) and main set as the default branch.", "הריצה המתוזמנת הראשונה צריכה את המפתח של חברת המחירים (Tiingo) ואת main כענף ברירת המחדל.");
add("rt.s.ai", "use the AI", "משתמשות בבינה מלאכותית");
add("rt.status.active", "active", "פועלת");
add("rt.status.planned", "planned", "מתוכננת");
add("rt.status.disabled", "disabled", "מושבתת");
add("rt.out.success", "success", "הצליחה");
add("rt.out.partial", "partial", "חלקית");
add("rt.out.failure", "failure", "נכשלה");
add("rt.out.failed", "failed", "נכשלה");
add("rt.out.skipped", "skipped", "דולגה");
add("rt.out.cancelled", "cancelled", "בוטלה");
add("rt.dl.step", "building step", "שלב בנייה");
add("rt.dl.reads", "reads", "קוראת");
add("rt.dl.ownOutputs", "its own outputs", "את התוצרים של עצמה");
add("rt.dl.saves", "saves", "שומרת");
add("rt.dl.next", "next", "הבאה");
add("rt.dl.last", "last", "אחרונה");
add("rt.dl.never", "never ran", "עוד לא רצה");
add("rt.pill.sub", "✦ AI · Claude subscription, $0 per run", "✦ AI · מנוי Claude, בעלות של 0 דולר לריצה");
add("rt.pill.cap", "✦ AI · cap {usd}", "✦ AI · תקרה {usd}");
add("rt.pill.code", "plain code · $0", "קוד פשוט · 0 דולר");
add("rt.pill.gate", "a person approves", "באישור אדם");
add("rt.hist.eyebrow", "Run history", "היסטוריית הריצות");
add("rt.hist.title.a", "What actually", "מה באמת");
add("rt.hist.title.b", "ran.", "רץ.");
add("rt.hist.lede",
  "One row each time a job ran. The job writes its own row (into data/ops/routine_runs.json). Failed steps stay visible, and data from a failed run is never saved.",
  "שורה אחת בכל פעם שמשימה רצה. המשימה כותבת את השורה שלה בעצמה (לקובץ data/ops/routine_runs.json). צעדים שנכשלו נשארים גלויים, ונתונים מריצה שנכשלה אף פעם לא נשמרים.");
add("rt.hist.logged", "{n} runs logged", "{n} ריצות נרשמו");
add("rt.hist.empty.title", "No runs yet", "עדיין אין ריצות");
add("rt.hist.empty.body", "The daily job starts once the price company's key (Tiingo) is added and main is the default branch. Each run will show up here.", "המשימה היומית תתחיל אחרי שיתווסף המפתח של חברת המחירים (Tiingo) ו-main יהיה ענף ברירת המחדל. כל ריצה תופיע כאן.");
add("rt.th.finished", "Finished", "הסתיימה");
add("rt.th.job", "Job", "משימה");
add("rt.th.by", "Started by", "הופעלה על ידי");
add("rt.th.result", "Result", "תוצאה");
add("rt.th.steps", "Steps", "צעדים");
add("rt.th.log", "Log", "יומן");

/* ============================================================ Admin (tabs/Admin.jsx) */

const DOCS = {
  household: ["Real money", "כסף אמיתי", "When and how much real money acts on anything here, under the plan.", "מתי ובאיזה היקף פועלים בכסף אמיתי לפי מה שמופיע כאן, לפי התוכנית."],
  shelf: ["Shelf", "מדף הספרים", "What a 119-book library supports, disputes and rejects.", "במה ספרייה של 119 ספרים תומכת, על מה היא חלוקה ומה היא דוחה."],
  strategy: ["Strategy", "אסטרטגיה", "What a guess is, and what the brain looks for.", "מהו ניחוש, ומה המוח מחפש."],
  guardrails: ["Guardrails", "מעקות בטיחות", "The safety rails: lines a guess may never cross.", "מעקות הבטיחות: קווים שניחוש לעולם לא חוצה."],
  methodology: ["Methodology", "שיטה", "How a morning run works and how guesses are scored.", "איך עובדת ריצת בוקר ואיך הניחושים מנוקדים."],
  learnings: ["Learnings", "לקחים", "What checked guesses have taught, with proof.", "מה לימדו הניחושים שנבדקו, עם הוכחות."],
  watchlist: ["Watchlist", "רשימת המעקב", "The companies the brain may talk about.", "החברות שהמוח רשאי לדבר עליהן."],
  settings: ["Settings", "הגדרות", "Limits, costs, how long before a guess is checked, and what counts as the whole market.", "מגבלות, עלויות, כמה זמן עובר עד שניחוש נבדק, ומה נחשב השוק כולו."],
  sources: ["Sources", "מקורות", "Where the data comes from.", "מאיפה הנתונים מגיעים."],
  people: ["People", "אנשים", "People to learn from, the research on following them, and their dated public calls.", "אנשים שלומדים מהם, המחקר על ההליכה בעקבותיהם, והעמדות הפומביות המתוארכות שלהם."],
  outlook: ["Outlook", "תחזיות", "What's next for each company: latest quarter, its own guidance, next results date. Linked and dated.", "מה הלאה לכל חברה: הרבעון האחרון, התחזית שלה עצמה, מועד הדוחות הבא. עם קישורים ותאריכים."],
  checklist: ["Checklist", "רשימת בדיקה", "The eight-step chart checklist from the video: how each step is worked out, the risk rule, how it is measured. Not proven.", "רשימת הבדיקה של הגרף בשמונה שלבים, מהסרטון: איך מחשבים כל שלב, כלל הסיכון, ואיך מודדים. לא מוכח."],
  routines: ["Routines", "משימות מתוזמנות", "The timetable: which job runs when, and what it may spend.", "לוח הזמנים: איזו משימה רצה מתי, וכמה מותר לה להוציא."],
  library: ["Library", "ספרייה", "Lessons from books and talks.", "שיעורים מספרים ומהרצאות."],
  decisions: ["Decisions", "החלטות", "Every decision and why, plus what is still open.", "כל החלטה והסיבה לה, וגם מה עוד פתוח."],
};
for (const [k, [ne, nh, ae, ah]] of Object.entries(DOCS)) { add(`adm.name.${k}`, ne, nh); add(`adm.about.${k}`, ae, ah); }
add("adm.stats.sections", "{sections} sections · {rules} rules", "{sections} פרקים · {rules} כללים");
add("adm.stats.decisions", "{open} open items · {entries} entries", "{open} פריטים פתוחים · {entries} רשומות");
add("adm.stats.guardrails", "max {max} picks · {phrases} banned phrases · {keys} forbidden keys", "עד {max} בחירות · {phrases} ביטויים אסורים · {keys} מפתחות אסורים");
add("adm.stats.learnings", "{n} lessons · {active} active", "{n} לקחים · {active} בשימוש");
add("adm.stats.watchlist", "{n} symbols · bench {bench}", "{n} סימולים · מדד ייחוס {bench}");
add("adm.stats.settings", "pack {cap} · target {usd} · {days}d horizon", "חבילה {cap} · יעד {usd} · טווח של {days} ימים");
add("adm.stats.sources", "{n} connectors · {active} active", "{n} מקורות · {active} פעילים");
add("adm.stats.people", "{people} people · {calls} calls · {findings} findings", "{people} אנשים · {calls} עמדות · {findings} ממצאים");
add("adm.stats.outlook", "{n} companies · {dates} results dates", "{n} חברות · {dates} מועדי דוחות");
add("adm.stats.checklist", "{steps} steps · reward-to-risk {min} to TP1 · {status}", "{steps} שלבים · יחס סיכוי-סיכון {min} עד TP1 · {status}");
add("adm.stats.routines", "{n} routines · {llm} use the model", "{n} משימות · {llm} משתמשות במודל");
add("adm.stats.library", "{n} sources · {p} principles", "{n} מקורות · {p} עקרונות");
add("adm.eyebrow", "Admin · behind the scenes", "ניהול · מאחורי הקלעים");
add("adm.title.a", "The rule", "ספר");
add("adm.title.b", "book.", "הכללים.");
add("adm.lede1",
  "In simple words: these are the rule papers the brain reads every morning. Anyone can read them here; changing one takes a person's approval.",
  "במילים פשוטות: אלה דפי הכללים שהמוח קורא בכל בוקר. כל אחד יכול לקרוא אותם כאן; כדי לשנות אחד מהם צריך אישור של אדם.");
add("adm.lede2",
  "Each file has a version number. Open one to read it, or edit it on GitHub. Every edit is a proposed change (a pull request): an automatic checker reads it, and the old version is kept, like the undo button, so any change can be taken back.",
  "לכל קובץ יש מספר גרסה. אפשר לפתוח קובץ כדי לקרוא אותו, או לערוך אותו ב-GitHub. כל עריכה היא הצעת שינוי (pull request): בודק אוטומטי קורא אותה, והגרסה הישנה נשמרת, כמו כפתור ״בטל״, כך שאפשר לבטל כל שינוי.");
add("adm.how.head", "How changes happen · pull requests", "איך שינויים קורים · pull requests");
add("adm.how.body", "This page is public and read-only. Changes go through {repo} on GitHub. No passwords, keys or details of anyone's real holdings are ever kept in the project.", "העמוד הזה ציבורי ולקריאה בלבד. שינויים עוברים דרך {repo} ב-GitHub. סיסמאות, מפתחות או פרטים על אחזקות אמיתיות של מישהו אף פעם לא נשמרים בפרויקט.");
add("adm.docs", "The docs", "המסמכים");
add("adm.docsSub", "What the brain reads each morning", "מה המוח קורא בכל בוקר");
add("adm.feeds.eyebrow", "Data feeds", "מקורות נתונים");
add("adm.feeds.lede",
  "Every data source is listed in config/sources.json. A feed that needs a password only names where to find it; the password itself is kept locked away in GitHub's secret store, never in this public project.",
  "כל מקור נתונים מופיע בקובץ config/sources.json. מקור שצריך סיסמה רק אומר איפה למצוא אותה; הסיסמה עצמה שמורה בכספת הסודות של GitHub, אף פעם לא בפרויקט הציבורי הזה.");
add("adm.feeds.edit", "Edit sources", "עריכת המקורות");
add("adm.status.active", "active", "פעיל");
add("adm.status.planned", "planned", "מתוכנן");
add("adm.status.disabled", "disabled", "מושבת");
add("adm.dl.company", "company", "חברה");
add("adm.dl.notChosen", "not chosen yet", "עוד לא נבחרה");
add("adm.dl.often", "how often", "באיזו תדירות");
add("adm.dl.feeds", "feeds", "מזין את");
add("adm.dl.secret", "password name", "שם הסיסמה");
add("adm.dl.none", "none", "אין");
add("adm.dl.following", "following", "במעקב");
add("adm.dl.nobody", "nobody yet", "עדיין אף אחד");
add("adm.view.formatted", "Formatted", "מעוצב");
add("adm.view.json", "JSON", "JSON גולמי");
add("adm.changeNote", "change note", "הערת שינוי");
add("adm.json.none", "none", "אין");
add("adm.json.notSet", "not set", "לא הוגדר");
add("adm.json.yes", "yes", "כן");
add("adm.json.no", "no", "לא");

export default { en, he };
