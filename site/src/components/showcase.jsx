import { mainListOf } from "../lib/buywindow.js";
import { strings } from "../lib/text.js";
import dict from "../text/home.js";
import { Container, SectionTitle } from "./ui.jsx";

/*
 * "Everything inside": under the Arena on Home, one tile per part of the app, so a first-time visitor sees the whole
 * trader agent at a glance and can open any part in one tap. Each tile carries a small moving accent so the page keeps
 * feeling alive; under reduced motion they stand still.
 */

const t = strings(dict);

const ICON = {
  floor: <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="10" y="3" width="5" height="5" rx="1" /><rect x="17" y="3" width="4" height="5" rx="1" /><rect x="3" y="10" width="5" height="5" rx="1" /><rect x="10" y="10" width="5" height="5" rx="1" /><rect x="17" y="10" width="4" height="5" rx="1" /><rect x="3" y="17" width="5" height="4" rx="1" /><rect x="10" y="17" width="5" height="4" rx="1" /></>,
  pairs: <><path d="M3 16c3-8 6-8 9 0s6 8 9 0" /><path d="M3 8c3 8 6 8 9 0s6-8 9 0" opacity=".55" /></>,
  desk: <><circle cx="5" cy="12" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><circle cx="19" cy="12" r="2.4" /><path d="M7 12h3M13.6 7.2 17.4 10.8M13.6 16.8l3.8-3.6M7 11l3.4-3.6M7 13l3.4 3.6" /></>,
  brain: <><path d="M12 4v16M8 6a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3M16 6a3 3 0 0 1 3 3 3 3 0 0 1 0 6 3 3 0 0 1-3 3" /></>,
  stock: <><path d="M6 4v3M6 15v5M12 6v3M12 17v3M18 3v4M18 13v4" /><rect x="4" y="7" width="4" height="8" rx="1" /><rect x="10" y="9" width="4" height="8" rx="1" /><rect x="16" y="7" width="4" height="6" rx="1" /></>,
  rules: <><path d="M5 12l4 4 10-10" /><path d="M5 20h14" opacity=".55" /></>,
  how: <><circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2.5" /><path d="M7 6c6 0 6 6 9.5 6M7 18c6 0 6-6 9.5-6" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.3" /><path d="M16 14.2c2.8.3 5 2.6 5 5.8" /></>,
  quiz: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17h.01" /></>,
};

export function Showcase({ data, go, openTo, onDesk }) {
  const first = mainListOf(data)?.[0];
  const tiles = [
    { id: "floor", to: () => go("watchlist") },
    { id: "pairs", to: () => openTo("watchlist#pairs") },
    { id: "desk", to: onDesk },
    { id: "brain", to: () => go("verdicts") },
    first ? { id: "stock", to: () => go(`stock/${first}`) } : null,
    { id: "rules", to: () => go("playbook") },
    { id: "how", to: () => go("how") },
    { id: "people", to: () => go("people") },
    { id: "quiz", to: () => go("quiz") },
  ].filter(Boolean);
  return (
    <Container className="pt-4 pb-10">
      <SectionTitle id="show-h" size="md" eyebrow={t("show.eyebrow")} title={<>{t("show.title1")} <span className="text-desk">{t("show.title2")}</span></>} />
      <ul className="show-grid mt-5" aria-labelledby="show-h">
        {tiles.map((x, i) => (
          <li key={x.id} style={{ "--i": i }}>
            <button type="button" onClick={x.to} className="show-tile">
              <span className="show-scan" aria-hidden="true" />
              <span className="show-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICON[x.id]}</svg>
              </span>
              <span className="show-title">{t(`show.${x.id}.title`)}</span>
              <span className="show-line">{t(`show.${x.id}.line`)}</span>
              <span className="show-go" aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
    </Container>
  );
}
