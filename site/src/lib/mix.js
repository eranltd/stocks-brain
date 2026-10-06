// Mix and match: try every combination of names on the published weekly history and score each one.
// Everything here is derived from the indexed weekly series (no prices). Equal shares, rebalanced every `every` weeks,
// exactly like basketSeries/weeklyStats in stats.js, so a mix scored here reads the same on the Portfolio page.
// This is hindsight by construction: the list was chosen knowing which companies became large.

const WEEKS = 52;

export function prepare(weekly, symbols) {
  const n = weekly.dates.length;
  const ratios = symbols.map((s) => {
    const v = weekly.members[s];
    const r = new Float64Array(n);
    r[0] = 1;
    for (let k = 1; k < n; k++) r[k] = v[k] / v[k - 1];
    return r;
  });
  return { symbols, n, ratios, mid: Math.floor((n - 1) / 2) };
}

/** Score one mix (indices into prep.symbols). Percentages. cagrA/cagrB are the first and second half of the history. */
export function scoreMix(prep, idx, every = 4) {
  const { n, ratios, mid } = prep;
  const m = idx.length;
  const pos = new Float64Array(m).fill(100 / m);
  let v = 100, peak = 100, dd = 0, sum = 0, sumsq = 0, vMid = 100;
  for (let k = 1; k < n; k++) {
    let nv = 0;
    for (let i = 0; i < m; i++) { pos[i] *= ratios[idx[i]][k]; nv += pos[i]; }
    const r = nv / v - 1;
    sum += r; sumsq += r * r; v = nv;
    if (v > peak) peak = v;
    const d = v / peak - 1;
    if (d < dd) dd = d;
    if (k === mid) vMid = v;
    if (k % every === 0) pos.fill(v / m);
  }
  const steps = n - 1;
  const mean = sum / steps;
  const vol = Math.sqrt(Math.max(0, sumsq / steps - mean * mean)) * Math.sqrt(WEEKS);
  return {
    cagr: ((v / 100) ** (WEEKS / steps) - 1) * 100,
    dd: dd * 100,
    vol: vol * 100,
    cagrA: ((vMid / 100) ** (WEEKS / mid) - 1) * 100,
    cagrB: ((v / vMid) ** (WEEKS / (steps - mid)) - 1) * 100,
  };
}

/** Every mix of k names with at most `cap` names per sector (cap null = no limit). */
export function searchMixes(prep, sectorOf, { k, cap = null, every = 4 }) {
  const N = prep.symbols.length;
  const sec = prep.symbols.map((s) => sectorOf[s] ?? "?");
  const out = [];
  const idx = [];
  const count = {};
  const rec = (start) => {
    if (idx.length === k) { out.push({ idx: idx.slice(), ...scoreMix(prep, idx, every) }); return; }
    for (let i = start; i <= N - (k - idx.length); i++) {
      const s = sec[i];
      if (cap != null && (count[s] ?? 0) >= cap) continue;
      count[s] = (count[s] ?? 0) + 1;
      idx.push(i);
      rec(i + 1);
      idx.pop();
      count[s] -= 1;
    }
  };
  rec(0);
  return out;
}

export const MEASURES = {
  profit: { label: "Most profit", pick: (m) => m.cagr },
  calm: { label: "Profit for the risk", pick: (m) => (m.vol > 0 ? m.cagr / m.vol : 0) },
  smooth: { label: "Smallest drop", pick: (m) => m.dd },
};

/** Share of all mixes (0-100) that scored strictly below `value` on `measure`. */
export function standing(all, measure, value) {
  const f = MEASURES[measure].pick;
  let below = 0;
  for (const m of all) if (f(m) < value) below++;
  return (below / all.length) * 100;
}

export function rank(all, measure) {
  const f = MEASURES[measure].pick;
  return [...all].sort((a, b) => f(b) - f(a));
}

function ranks(xs) {
  const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]);
  const r = new Float64Array(xs.length);
  order.forEach((i, pos) => { r[i] = pos; });
  return r;
}

/**
 * Does the best mix of one half stay good in the other? Picks the 20 best mixes by first-half growth and reports where they
 * ranked in the second half (50 = a coin flip), and the rank correlation between the halves over all mixes.
 */
export function halvesCheck(all) {
  const top = [...all].sort((a, b) => b.cagrA - a.cagrA).slice(0, 20);
  const secondB = all.map((m) => m.cagrB).sort((a, b) => a - b);
  const pctB = (v) => {
    let lo = 0, hi = secondB.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (secondB[mid] <= v) lo = mid + 1; else hi = mid; }
    return (lo / secondB.length) * 100;
  };
  const pcts = top.map((m) => pctB(m.cagrB)).sort((a, b) => a - b);
  const ra = ranks(all.map((m) => m.cagrA)), rb = ranks(all.map((m) => m.cagrB));
  const n = all.length, mean = (n - 1) / 2;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { cov += (ra[i] - mean) * (rb[i] - mean); va += (ra[i] - mean) ** 2; vb += (rb[i] - mean) ** 2; }
  return { medianPercentile: pcts[Math.floor(pcts.length / 2)], rankCorrelation: va && vb ? cov / Math.sqrt(va * vb) : 0, topFirstHalf: top[0]?.cagrA ?? null };
}

/** Best single changes to a mix: swap one chosen name for an unchosen one (or add one if the mix has room). */
export function bestChanges(prep, sectorOf, picked, { slots, cap = null, measure = "profit", every = 4, limit = 3 }) {
  const f = MEASURES[measure].pick;
  const pos = (s) => prep.symbols.indexOf(s);
  const base = picked.map(pos);
  const baseScore = base.length ? scoreMix(prep, base, every) : null;
  const sectorOk = (names) => {
    if (cap == null) return true;
    const c = {};
    for (const s of names) { c[sectorOf[s] ?? "?"] = (c[sectorOf[s] ?? "?"] ?? 0) + 1; if (c[sectorOf[s] ?? "?"] > cap) return false; }
    return true;
  };
  const options = [];
  const others = prep.symbols.filter((s) => !picked.includes(s));
  if (picked.length < slots) {
    for (const add of others) {
      const names = [...picked, add];
      if (!sectorOk(names)) continue;
      options.push({ kind: "add", add, names, score: scoreMix(prep, names.map(pos), every) });
    }
  } else {
    for (const drop of picked) for (const add of others) {
      const names = picked.map((s) => (s === drop ? add : s));
      if (!sectorOk(names)) continue;
      options.push({ kind: "swap", drop, add, names, score: scoreMix(prep, names.map(pos), every) });
    }
  }
  options.sort((a, b) => f(b.score) - f(a.score));
  return { base: baseScore, changes: options.slice(0, limit) };
}
