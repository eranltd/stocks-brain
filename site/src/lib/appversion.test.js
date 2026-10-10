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
