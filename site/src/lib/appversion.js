// Is a newer build of the site deployed than the one running? The page's own script is a hashed bundle
// (assets/index-<hash>.js); the deployed index.html names the current one. Different names mean a new version is out.

const BUNDLE = /assets\/index-[\w-]+\.js/;

export const bundleName = (text) => (typeof text === "string" ? (text.match(BUNDLE) || [null])[0] : null);

/** The bundle this page is running, or null in development (where the entry is not a hashed bundle). */
export function currentBundle(doc = globalThis.document) {
  if (!doc) return null;
  for (const s of doc.querySelectorAll("script[src]")) {
    const name = bundleName(s.getAttribute("src"));
    if (name) return name;
  }
  return null;
}

/** The deployed bundle's name when it differs from the running one, else null. Never throws. */
export async function newerBundle({ fetchFn = globalThis.fetch, doc = globalThis.document, url = "./index.html" } = {}) {
  try {
    const cur = currentBundle(doc);
    if (!cur || !fetchFn) return null;
    const res = await fetchFn(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const deployed = bundleName(await res.text());
    return deployed && deployed !== cur ? deployed : null;
  } catch {
    return null;
  }
}
