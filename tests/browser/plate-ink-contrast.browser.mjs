#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, component/.
//
// The markup cases of the contrast matrix on their own (docs batch B,
// 2026-11-15, FW-B-1..6; owner decisions C178, C192): an on-colour on its
// strong plate, the ink of a nested theme class, a slider arrow over its
// slide, inline code on a coloured plate, the dim ink on the popup steps.
// The fixtures and the measurement are tests/browser/contrast-markup-cases.mjs,
// which the contrast matrix runs as well. Text needs 4.5:1, a glyph 3:1, in the
// light and the dark theme. Prints the cases and exits 1 on one below.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {measureMarkup} from './contrast-markup-cases.mjs';

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) throw new Error('Build output root is required');
const out = resolve(args[0]);
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const one of await measureMarkup(browser, out, theme)) results.push({theme, ...one});
} finally {
  await browser.close();
}
const below = results.filter((one) => one.ratio < one.need);
console.log(JSON.stringify({check: 'markup contrast (FW-B-1..6)', cases: results.length, below: below.map((one) => `${one.theme} ${one.case}: ${one.ratio}:1 < ${one.need}:1 (${one.ink} on ${one.ground})`)}, null, 1));
if (below.length || !results.length) process.exit(1);
