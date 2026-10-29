import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, dayTimeline, lastByRoutine, minutesOfDay, nextRun, relTime } from "./routines.js";

test("nextRun: weekday ranges, hour lists and a day of the month (UTC)", () => {
  const from = new Date(Date.UTC(2026, 9, 22, 6, 0)); // Thu 22 Oct 2026 06:00
  assert.equal(nextRun("23 5,8,11 * * 2-6", from).toISOString(), "2026-10-22T08:23:00.000Z");
  assert.equal(nextRun("40 23 * * 1-5", from).toISOString(), "2026-10-22T23:40:00.000Z");
  assert.equal(nextRun("0 13 * * 6", from).toISOString(), "2026-10-24T13:00:00.000Z");
  assert.equal(nextRun("0 13 1 * *", from).toISOString(), "2026-11-01T13:00:00.000Z");
  assert.equal(nextRun(null, from), null);
});

test("relTime: hours under a day, days after", () => {
  const now = new Date(Date.UTC(2026, 9, 22, 6, 0));
  assert.equal(relTime(new Date(Date.UTC(2026, 9, 22, 11, 0)), now), "in 5 h");
  assert.equal(relTime(new Date(Date.UTC(2026, 9, 25, 6, 0)), now), "in 3 d");
  assert.equal(relTime(null, now), "");
});

test("dayTimeline: one stop per fire time of the active daily routines, AI marked", () => {
  const stops = dayTimeline([
    { id: "a", status: "active", cadence: "daily", cron: "40 23 * * 1-5", uses_llm: false },
    { id: "b", status: "active", cadence: "daily", cron: "40 23 * * 1-5", uses_llm: false },
    { id: "c", status: "active", cadence: "daily", cron: "23 5,8 * * 2-6", uses_llm: true },
    { id: "d", status: "planned", cadence: "daily", cron: "0 12 * * 1-5", uses_llm: false },
    { id: "e", status: "active", cadence: "weekly", cron: "0 13 * * 6", uses_llm: false },
  ]);
  assert.deepEqual(stops.map((s) => [clock(s.mins), s.ids, s.ai]), [["05:23", ["c"], true], ["08:23", ["c"], true], ["23:40", ["a", "b"], false]]);
  assert.deepEqual(minutesOfDay("23 11,5 * * *"), [323, 683]);
});

test("lastByRoutine: the newest outcome per routine, skipped steps ignored", () => {
  const last = lastByRoutine([
    { finished_at: "2026-10-22T09:00:00Z", url: "u2", steps: [{ routine: "x", outcome: "skipped" }, { routine: "y", outcome: "failure" }] },
    { finished_at: "2026-10-21T09:00:00Z", url: "u1", steps: [{ routine: "x", outcome: "success" }, { routine: "y", outcome: "success" }] },
  ]);
  assert.deepEqual([last.x.outcome, last.x.at, last.y.outcome, last.y.url], ["success", "2026-10-21T09:00:00Z", "failure", "u2"]);
});
