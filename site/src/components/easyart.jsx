/*
 * Drawn assets for Simple mode (components/easy.jsx), in the site's own style: the orange brand line, the market
 * colours, hairline strokes. Every picture is decoration beside words that already say the same thing (aria-hidden).
 */

/** A traffic light with the lit lamp glowing: "green" (calm), "yellow" (nervous), "red" (scared). */
export function TrafficLight({ light }) {
  // Real signal colours in both themes (the text beside it carries the theme's own tone).
  const lamps = [["red", "#ff4d4f", 18], ["yellow", "#ffb020", 44], ["green", "#22d17a", 70]];
  return (
    <svg viewBox="0 0 44 88" className="easy-traffic" aria-hidden="true">
      <defs>
        {lamps.map(([id, c]) => (
          <radialGradient key={id} id={`lamp-${id}`} cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.35" stopColor={c} />
            <stop offset="1" stopColor={c} stopOpacity="0.75" />
          </radialGradient>
        ))}
        <filter id="lamp-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2" /></filter>
      </defs>
      <rect x="4" y="2" width="36" height="84" rx="12" fill="var(--surface-3)" stroke="var(--line-3)" strokeWidth="1.5" />
      {lamps.map(([id, c, y]) => {
        const on = id === light;
        return (
          <g key={id}>
            {on && <circle cx="22" cy={y} r="11" fill={c} opacity="0.75" filter="url(#lamp-glow)" />}
            <circle cx="22" cy={y} r="10" fill={on ? `url(#lamp-${id})` : "var(--surface-2)"} stroke={on ? c : "var(--line-2)"} strokeWidth="1.2" opacity={on ? 1 : 0.9} />
          </g>
        );
      })}
    </svg>
  );
}

/** The Simple choice: a calm card with one big answer and a lamp. */
export function SimpleArt() {
  return (
    <svg viewBox="0 0 96 72" className="easy-art" aria-hidden="true">
      <rect x="6" y="8" width="84" height="56" rx="10" fill="var(--surface-2)" stroke="var(--line-3)" strokeWidth="1.5" />
      <circle cx="26" cy="30" r="9" fill="var(--up)" />
      <circle cx="26" cy="30" r="13" fill="none" stroke="var(--up)" strokeOpacity="0.35" strokeWidth="3" />
      <rect x="42" y="23" width="36" height="6" rx="3" fill="var(--ink)" />
      <rect x="42" y="34" width="24" height="4" rx="2" fill="var(--ink-3)" />
      <rect x="18" y="48" width="60" height="6" rx="3" fill="var(--desk)" opacity="0.85" />
    </svg>
  );
}

/** The Full choice: a dense dashboard of charts and bars. */
export function FullArt() {
  return (
    <svg viewBox="0 0 96 72" className="easy-art" aria-hidden="true">
      <rect x="6" y="8" width="84" height="56" rx="10" fill="var(--surface-2)" stroke="var(--line-3)" strokeWidth="1.5" />
      <path d="M14 40 L24 33 L32 37 L42 24 L50 29 L58 19" fill="none" stroke="var(--desk)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 40 L24 33 L32 37 L42 24 L50 29 L58 19 L58 44 L14 44 Z" fill="var(--desk)" opacity="0.12" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={66 + i * 4.6} y={44 - [10, 18, 8, 22, 14][i]} width="3" height={[10, 18, 8, 22, 14][i]} rx="1" fill={i % 2 ? "var(--down)" : "var(--up)"} />)}
      {[0, 1, 2].map((i) => <rect key={i} x={14 + i * 26} y="50" width="22" height="7" rx="2" fill="var(--surface-3)" stroke="var(--line-2)" />)}
    </svg>
  );
}

/** A tiny line of the last months, coloured by today's direction. `points` are index values (first = 100). */
export function Spark({ points, tone = "flat", className = "easy-spark" }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const lo = Math.min(...points), hi = Math.max(...points), span = hi - lo || 1;
  const w = 72, h = 26;
  const d = points.map((v, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * w).toFixed(1)} ${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ");
  const c = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--ink-3)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-fill-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.28" /><stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#spark-fill-${tone})`} />
      <path d={d} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="400" />
    </svg>
  );
}

/** A calendar page with the weekly buy day on it. */
export function CalendarMark({ dow, date }) {
  return (
    <svg viewBox="0 0 56 60" className="easy-cal" aria-hidden="true">
      <rect x="3" y="7" width="50" height="50" rx="9" fill="var(--surface-2)" stroke="var(--line-3)" strokeWidth="1.5" />
      <path d="M3 16a9 9 0 0 1 9-9h32a9 9 0 0 1 9 9v6H3z" fill="var(--desk)" />
      <rect x="15" y="2" width="4" height="10" rx="2" fill="var(--ink-2)" />
      <rect x="37" y="2" width="4" height="10" rx="2" fill="var(--ink-2)" />
      <text x="28" y="19.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" letterSpacing="1">{dow}</text>
      <text x="28" y="47" textAnchor="middle" fontSize="21" fontWeight="800" fill="var(--ink)">{date}</text>
    </svg>
  );
}

/** Line icons in the site's stroke style. */
const Line = ({ children, className = "size-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconSun = (p) => <Line {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Line>;
export const IconMoon = (p) => <Line {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></Line>;
export const IconFull = (p) => <Line {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 15l3-3 2.5 2L17 9" /><path d="M3 8h18" /></Line>;
export const IconSimple = (p) => <Line {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 13.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2" /><path d="M9 9.5h.01M15 9.5h.01" /></Line>;
export const IconNews = (p) => <Line {...p}><rect x="3" y="5" width="15" height="15" rx="2" /><path d="M18 9h3v9a2 2 0 0 1-2 2" /><path d="M7 9h7M7 13h7M7 17h4" /></Line>;
export const IconList = (p) => <Line {...p}><path d="M4 18l5-6 4 3 7-9" /><path d="M15 6h5v5" /></Line>;
export const IconCheck = (p) => <Line {...p}><circle cx="12" cy="12" r="8.5" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></Line>;
