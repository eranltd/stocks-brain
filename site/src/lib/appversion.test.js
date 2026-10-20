import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleName, currentBundle, newerBundle } from "./appversion.js";

const docWith = (...srcs) => ({ querySelectorAll: () => srcs.map((s) => ({ getAttribute: () => s })) });
const html = (name) => `<!doctype html><script type="module" crossorigin src="./${name}"></script>`;
const fetchOf = (body, ok = true) => async (url, init) => { assert.equal(init.cache, "no-cache"); return { ok, text: async () => body }; };

test("bundleName finds the hashed entry", () => {
  assert.equal(bundleName(html("assets/index-AbC_12-x.js")), "assets/index-AbC_12-x.js");
  assert.equal(bundleName("no bundle here"), null);
  assert.equal(bundleName(undefined), null);
});

test("currentBundle reads the page's own script; null in development", () => {
  assert.equal(currentBundle(docWith("/src/main.jsx")), null);
  assert.equal(currentBundle(docWith("./assets/vendor.js", "./assets/index-old.js")), "assets/index-old.js");
});

test("newerBundle reports a different deployed bundle only", async () => {
  const doc = docWith("./assets/index-old.js");
  assert.equal(await newerBundle({ doc, fetchFn: fetchOf(html("assets/index-new.js")) }), "assets/index-new.js");
  assert.equal(await newerBundle({ doc, fetchFn: fetchOf(html("assets/index-old.js")) }), null);
  assert.equal(await newerBundle({ doc, fetchFn: fetchOf("", false) }), null);
  assert.equal(await newerBundle({ doc, fetchFn: async () => { throw new Error("offline"); } }), null);
  assert.equal(await newerBundle({ doc: docWith("/src/main.jsx"), fetchFn: fetchOf(html("assets/index-new.js")) }), null);
});

test("the footer's data line: unchanged in English, whole sentences in Hebrew with the time left to right", async () => {
  const { buildLine } = await import("./appversion.js");
  const { stripBidi } = await import("./i18n.js");
  const live = { price_source: "live", price_provider: "tiingo", source: "sample", built_at: "2026-10-18T05:39:51Z" };
  assert.equal(buildLine(live), "Prices live · tiingo · picks sample · built 2026-10-18 05:39:51 UTC");
  assert.equal(buildLine({ ...live, price_source: "sample", source: "live" }, "en"), "Prices sample · picks live · built 2026-10-18 05:39:51 UTC");
  const he = buildLine(live, "he");
  assert.equal(stripBidi(he), "מחירים מתעדכנים · tiingo · בחירות לדוגמה · נבנה ב-2026-10-18 05:39:51 UTC");
  assert.ok(he.includes("⁦2026-10-18 05:39:51 UTC⁩"));
  assert.equal(stripBidi(buildLine({ ...live, price_source: "sample", source: "live" }, "he")), "מחירים לדוגמה · בחירות אמיתיות · נבנה ב-2026-10-18 05:39:51 UTC");
  assert.equal(stripBidi(buildLine({ ...live, source: "other" }, "he")), "מחירים מתעדכנים · tiingo · בחירות other · נבנה ב-2026-10-18 05:39:51 UTC");
});
