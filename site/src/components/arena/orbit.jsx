import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { dayMove, sectorFlows } from "../../lib/arena.js";
import { signTone, fmtPct } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { FlowLines, OrbitSphere, useSize } from "../motion.jsx";
import { Panel } from "../ui.jsx";
import { useDayTick } from "./clock.jsx";

/*
 * The orbit: small cards, one per sector of the main list (its names' average change so far, and its line drawing in),
 * with curved lines flowing from each card into a turning ball of dots: one bright dot per name, pushed out on an up
 * day and pulled in on a down day, and an orange core sized by today's BUY (paper) calls from the desk. Everything
 * steps with the replay's clock; the ball keeps turning slowly while it is on screen.
 */

const t = strings(dict);
const TONE = { accent: "up", down: "down", flat: "flat" };
const sectorWord = (id) => (t.has(`arena.sector.${id}`) ? t(`arena.sector.${id}`) : id);

function Card({ card, n, refs, compact }) {
  const W = compact ? 92 : 132, H = compact ? 22 : 26;
  const d = useMemo(() => {
    const v = card.values;
    const lo = Math.min(0, ...v), hi = Math.max(0, ...v), span = hi - lo || 1;
    return v.map((x, i) => `${i ? "L" : "M"}${((i / Math.max(1, n - 1)) * (W - 2) + 1).toFixed(1)},${(2 + (1 - (x - lo) / span) * (H - 4)).toFixed(1)}`).join("");
  }, [card, n, W, H]);
  return (
    <li className="orbit-card" ref={refs.card} data-tone="flat">
      <span className="block truncate font-display text-[13px] font-bold tracking-[0.1em] text-ink uppercase">{sectorWord(card.id)}</span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-1 block max-w-full" aria-hidden="true">
        <defs><clipPath id={`oc-${card.id.replace(/\W/g, "")}`}><rect ref={refs.clip} x="0" y="0" width={W} height={H} transform="scale(0,1)" /></clipPath></defs>
        <path d={d} fill="none" stroke="var(--line-2)" strokeWidth="1.2" />
        <path d={d} fill="none" className="orbit-spark" strokeWidth="1.6" strokeLinejoin="round" clipPath={`url(#oc-${card.id.replace(/\W/g, "")})`} />
      </svg>
      <span className="mt-1 flex items-baseline justify-between gap-2">
        <span ref={refs.val} className="arena-tone font-num text-[12px] font-bold">0.0%</span>
        <span className="micro">{card.members.length}</span>
      </span>
    </li>
  );
}

export function OrbitPanel({ race, clock, sectors, core = 0 }) {
  const cards = useMemo(() => sectorFlows(race, sectors, 6), [race, sectors]);
  const names = useMemo(() => race.lines.map((l) => ({ symbol: l.symbol })), [race]);
  const box = useRef(null);
  const sphereBox = useRef(null);
  const { w } = useSize(box);
  const wide = w >= 680;
  const sphere = useRef(null);
  const flows = useRef(null);
  const cardRefs = useMemo(() => cards.map(() => ({ card: { current: null }, val: { current: null }, clip: { current: null } })), [cards]);
  const [anchors, setAnchors] = useState({ from: [], to: [], h: 0 });

  // Where the lines start (each card's edge) and end (on the ball's rim), in the box's pixels.
  useLayoutEffect(() => {
    const b = box.current, s = sphereBox.current;
    if (!b || !s || !w) return;
    const br = b.getBoundingClientRect(), sr = s.getBoundingClientRect();
    const cx = sr.left - br.left + sr.width / 2, cy = sr.top - br.top + sr.height / 2, R = sr.width * 0.33;
    const n = cards.length;
    const from = [], to = [];
    cardRefs.forEach((r, i) => {
      const c = r.card.current?.getBoundingClientRect();
      if (!c) return;
      const a = n > 1 ? -0.62 + (1.24 * i) / (n - 1) : 0;
      if (wide) {
        from.push([c.right - br.left, c.top - br.top + c.height / 2]);
        to.push([cx - R * Math.cos(a), cy + R * Math.sin(a)]);
      } else {
        from.push([c.left - br.left + c.width / 2, c.bottom - br.top]);
        to.push([cx + R * Math.sin(a), cy - R * Math.cos(a)]);
      }
    });
    setAnchors({ from, to, h: br.height });
  }, [w, wide, cards, cardRefs]);

  useDayTick(clock, (k) => {
    const moves = {};
    for (const l of race.lines) moves[l.symbol] = dayMove(l.values, k);
    sphere.current?.setMoves(moves);
    const tones = cards.map((c, i) => {
      const v = c.values[k] ?? 0;
      const r = cardRefs[i];
      if (r.val.current) { r.val.current.textContent = fmtPct(v, 1); r.val.current.dataset.tone = TONE[signTone(v, 1)]; }
      if (r.card.current) r.card.current.dataset.tone = TONE[signTone(v, 1)];
      r.clip.current?.setAttribute("transform", `scale(${(k / Math.max(1, race.n - 1)).toFixed(4)},1)`);
      return TONE[signTone(v, 1)];
    });
    flows.current?.setTones(tones);
  }, [race, cards, cardRefs, anchors]);

  return (
    <Panel title={t("arena.orbit.title")} info={t("arena.orbit.info")} className="mt-4"
      badge={<span className="chip border-desk/50 bg-desk/10 text-desk"><span aria-hidden="true" className="size-1.5 rounded-full bg-desk" />{t("arena.orbit.core", { count: core })}</span>}>
      <div ref={box} className={`relative ${wide ? "grid grid-cols-[150px_minmax(0,1fr)] items-center gap-6" : ""}`}>
        <ul className={wide ? "grid gap-2.5" : "grid grid-cols-3 gap-2"} aria-label={t("arena.orbit.flows")}>
          {cards.map((c, i) => <Card key={c.id} card={c} n={race.n} refs={cardRefs[i]} compact={!wide} />)}
        </ul>
        <div className={wide ? "flex justify-end" : "mt-14"}>
          <div ref={sphereBox} className={wide ? "w-full max-w-[460px]" : "mx-auto w-full max-w-[380px]"}>
            <OrbitSphere ref={sphere} names={names} core={core} />
          </div>
        </div>
        <FlowLines ref={flows} from={anchors.from} to={anchors.to} vertical={!wide} w={w} h={anchors.h} className="z-0" />
      </div>
    </Panel>
  );
}
