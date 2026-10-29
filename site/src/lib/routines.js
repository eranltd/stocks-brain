// Timing helpers for the routines (config/routines.json) on the Routines and How it works pages. Pure functions, no
// React; tested in routines.test.js. Every time is UTC, as in the crons; words are text/learn.js "rt.*".

import { strings } from "./text.js";
import dict from "../text/learn.js";

const t = strings(dict);
const pad2 = (n) => String(n).padStart(2, "0");

/** The weekdays of a cron's day-of-week field ("1-5", "2", "*"); null for every day. */
function cronDays(dow) {
  if (dow === "*") return null;
  if (dow.includes("-")) {
    const [a, b] = dow.split("-").map(Number);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return dow.split(",").map(Number);
}

/** Next fire time for the simple cron shapes in use: "m h * * d-d|d|*" and "m h D * *"; h may be a list ("5,11"). */
export function nextRun(cron, from = new Date()) {
  if (!cron) return null;
  const [m, h, dom, , dow] = cron.split(" ");
  const hours = h.split(",").map(Number).sort((a, b) => a - b);
  const days = cronDays(dow);
  for (let i = 0; i < 400; i++) {
    for (const hh of hours) {
      const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i, hh, +m));
      if (d <= from) continue;
      if (dom !== "*" && d.getUTCDate() !== +dom) continue;
      if (days && !days.includes(d.getUTCDay())) continue;
      return d;
    }
  }
  return null;
}

/** "in 5 h", "in 3 d". */
export function relTime(d, now = new Date()) {
  if (!d) return "";
  const hrs = Math.round((d - now) / 36e5);
  return hrs < 24 ? t("rt.inHours", { count: hrs }) : t("rt.inDays", { count: Math.round(hrs / 24) });
}

/** The fire times of a cron within one day, in minutes after midnight UTC ("23 5,8,11 * * *" -> [323, 503, 683]). */
export function minutesOfDay(cron) {
  if (!cron) return [];
  const [m, h] = cron.split(" ");
  return h.split(",").map((x) => Number(x) * 60 + Number(m)).filter(Number.isFinite).sort((a, b) => a - b);
}

/** "05:23" for minutes after midnight. */
export const clock = (mins) => `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`;

/**
 * A weekday's timetable of the active daily routines: one stop per fire time, with the routines that fire then and
 * whether any of them uses the AI. Sorted by time.
 */
export function dayTimeline(routines) {
  const at = new Map();
  for (const r of routines ?? []) {
    if (r.status !== "active" || r.cadence !== "daily" || !r.cron) continue;
    for (const mins of minutesOfDay(r.cron)) {
      const stop = at.get(mins) ?? { mins, ids: [], ai: false };
      stop.ids.push(r.id);
      stop.ai ||= Boolean(r.uses_llm);
      at.set(mins, stop);
    }
  }
  return [...at.values()].sort((a, b) => a.mins - b.mins);
}

/** The latest outcome of each routine in the run log (newest run first), skipping steps that were skipped. */
export function lastByRoutine(runsNewestFirst) {
  const out = {};
  for (const run of runsNewestFirst ?? [])
    for (const s of run.steps ?? []) if (!out[s.routine] && s.outcome !== "skipped") out[s.routine] = { ...s, at: run.finished_at, url: run.url };
  return out;
}
