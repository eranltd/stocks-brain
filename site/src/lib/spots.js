// "Candles to notice" for the zoom view (components/zoom.jsx): the candles a chart reader would point at, each with a
// name and a plain reason. Pure functions, no React; tested in spots.test.js. Inputs are a candles window (lib/candles.js
// windowOf): every price-like value is percent from the last close, so nothing here turns them back into prices.
//
// These are descriptions of what happened, not signals: our prices are end of day only, and in our own tests candle
// readings did not beat chance. Every reason says so in its own words.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const okAt = (w, i) => [w.o[i], w.h[i], w.l[i], w.c[i]].every(isNum);

/** The kinds of candle we point at: a title, a tone, why people notice it, and the honest caveat. */
export const SPOT_KINDS = {
  big_green: { title: "Big green day", tone: "up", why: "It opened low and closed much higher: buyers were in charge all day." },
  big_red: { title: "Big red day", tone: "down", why: "It opened high and closed much lower: sellers were in charge all day." },
  gap_up: { title: "Gap up", tone: "up", why: "It opened above the whole day before, often after news. Gaps sometimes get filled later, sometimes not." },
  gap_down: { title: "Gap down", tone: "down", why: "It opened below the whole day before, often after news. Chart readers watch whether it climbs back." },
  hammer: { title: "Hammer", tone: "up", why: "After falling, sellers pushed it down during the day but buyers pushed it back up. Chart readers see a possible turn up." },
  shooting_star: { title: "Shooting star", tone: "down", why: "After rising, buyers pushed it up during the day but it fell back. Chart readers see a possible turn down." },
  engulf_up: { title: "Green swallows red", tone: "up", why: "A green day whose body covers the whole red day before it: buyers took over from sellers." },
  engulf_down: { title: "Red swallows green", tone: "down", why: "A red day whose body covers the whole green day before it: sellers took over from buyers." },
  busy: { title: "Very busy day", tone: "flat", why: "About twice the usual trading or more. Big moves on busy days get more attention than quiet ones." },
};

export const SPOT_CAVEAT = "A clue, not a promise: in our own tests, candle shapes did not beat chance.";

const median = (xs) => {
  const s = xs.filter(isNum).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

/** Was the trend into candle i down (or up) over the few closes before it? */
function trendInto(w, i, n = 4) {
  const a = w.c[i - n], b = w.c[i - 1];
  if (!isNum(a) || !isNum(b)) return 0;
  return b < a ? -1 : b > a ? 1 : 0;
}

/** Every notable candle in the window, as {i, kind, score}; one kind per candle (the strongest). */
export function findSpots(w) {
  if (!w?.dates?.length) return [];
  const bodies = w.dates.map((_, i) => (okAt(w, i) ? Math.abs(w.c[i] - w.o[i]) : null));
  const ranges = w.dates.map((_, i) => (okAt(w, i) ? w.h[i] - w.l[i] : null));
  const mb = median(bodies) || 0.01, mr = median(ranges) || 0.01;
  const out = [];
  for (let i = 0; i < w.dates.length; i++) {
    if (!okAt(w, i)) continue;
    const o = w.o[i], c = w.c[i], h = w.h[i], l = w.l[i];
    const body = Math.abs(c - o), up = c >= o;
    const upper = h - Math.max(o, c), lower = Math.min(o, c) - l;
    const prev = i > 0 && okAt(w, i - 1) ? { o: w.o[i - 1], c: w.c[i - 1], h: w.h[i - 1], l: w.l[i - 1] } : null;
    const cands = [];
    if (body >= 2.2 * mb) cands.push([up ? "big_green" : "big_red", body / mb]);
    if (prev && o > prev.h && l > prev.h) cands.push(["gap_up", 3 + (l - prev.h) / mr]);
    if (prev && o < prev.l && h < prev.l) cands.push(["gap_down", 3 + (prev.l - h) / mr]);
    const range = h - l;
    if (range >= mr && body <= range * 0.35) {
      if (lower >= 2 * Math.max(body, mb * 0.2) && upper <= body + range * 0.1 && trendInto(w, i) < 0) cands.push(["hammer", 2.5 + lower / mr]);
      if (upper >= 2 * Math.max(body, mb * 0.2) && lower <= body + range * 0.1 && trendInto(w, i) > 0) cands.push(["shooting_star", 2.5 + upper / mr]);
    }
    if (prev && body >= mb) {
      const pUp = prev.c >= prev.o, pLo = Math.min(prev.o, prev.c), pHi = Math.max(prev.o, prev.c);
      if (up && !pUp && o <= pLo && c >= pHi && pHi - pLo > 0) cands.push(["engulf_up", 2 + body / mb]);
      if (!up && pUp && o >= pHi && c <= pLo && pHi - pLo > 0) cands.push(["engulf_down", 2 + body / mb]);
    }
    if (isNum(w.vol_rel?.[i]) && w.vol_rel[i] >= 2) cands.push(["busy", 1.5 + w.vol_rel[i]]);
    if (!cands.length) continue;
    cands.sort((a, b) => b[1] - a[1]);
    out.push({ i, kind: cands[0][0], score: cands[0][1] });
  }
  return out;
}

/**
 * The candles worth pointing at in a window: at most `max`, the strongest, a little in favour of recent ones, shown in
 * date order and numbered. Each carries its date, title, tone and reason.
 */
export function topSpots(w, max = 5) {
  const all = findSpots(w);
  const n = w?.dates?.length ?? 0;
  const ranked = [...all].sort((a, b) => b.score * (1 + a.i / n / 2) - a.score * (1 + b.i / n / 2) || b.i - a.i);
  return ranked.slice(0, max).sort((a, b) => a.i - b.i).map((s, k) => ({
    ...s, n: k + 1, date: w.dates[s.i], ...SPOT_KINDS[s.kind],
  }));
}

/** The slice [from, to) to show when zooming in on candle i: `span` candles around it, kept inside the window. */
export function zoomAround(i, n, span = 15) {
  const half = Math.floor(span / 2);
  let from = Math.max(0, i - half);
  const to = Math.min(n, from + span);
  from = Math.max(0, to - span);
  return [from, to];
}
