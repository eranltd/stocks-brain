import { createElement, Fragment } from "react";

/**
 * A text whose values may be React elements, as React nodes: rich(t, "lead", { name: <strong>AAA</strong> }), where t is
 * strings(table) from lib/text.js.
 */
export const rich = (t, key, vars) => createElement(Fragment, null, ...t.parts(key, vars));
