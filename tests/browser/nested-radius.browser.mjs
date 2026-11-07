#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The nesting rule for radii (simai/ui-source#31 item 1), on the built
// core.css, in light and dark:
//   - .sf-nest draws --sf-nest-radius, pads by --sf-nest-inset and gives its
//     content --sf-radius--nested = max(--sf-radius--ui, radius - inset);
//   - a page's own --sf-nest-radius / --sf-nest-inset on the container win;
//   - a container inside a container takes the outer one's nested radius as
//     its own, four levels deep, and never comes out under --sf-radius--ui;
//   - outside any container --sf-radius--nested is the control radius;
//   - scripts/nested-radius-lint.mjs passes the derived chain and reports the
//     two defects it is for: an inner corner rounder than the outer one with a
//     smaller inset (ui-chat: a 24 px field 13 px inside a 16 px panel), and a
//     corner rounder than the derived one; a round control in a capsule of the
//     same height passes.
import {createServer} from 'node:http';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {lintNestedRadius} from '../../scripts/nested-radius-lint.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = join(out, 'core', 'core', 'css', 'core.css');
if (!existsSync(css)) throw new Error(`core.css not found under ${out}`);

const page = (theme) => `<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/core.css"><style>
  body { margin: 0; padding: 24px; background: var(--sf-surface-0); color: var(--sf-on-surface); font: 14px/1.4 sans-serif; }
  .panel { --sf-nest-radius: var(--sf-radius-4); --sf-nest-inset: var(--sf-space-1\\/2); background: var(--sf-surface-2); inline-size: 420px; }
  .box { --sf-nest-inset: var(--sf-space-1\\/2); background: var(--sf-surface-4); }
  .leaf { border-radius: var(--sf-radius--nested); background: var(--sf-primary); color: var(--sf-on-primary); padding: 6px 10px; }
  .bad-panel { border-radius: 16px; padding: 13px; background: var(--sf-surface-2); inline-size: 300px; }
  .bad-field { border-radius: 24px; block-size: 48px; background: var(--sf-surface-4); }
  .loose-panel { border-radius: 24px; padding: 4px; background: var(--sf-surface-2); inline-size: 300px; }
  .loose-item { border-radius: 24px; block-size: 60px; background: var(--sf-surface-4); }
  .capsule { border-radius: 1000px; padding: 8px; background: var(--sf-surface-2); inline-size: 300px; display: flex; justify-content: end; }
  .round { border-radius: 1000px; inline-size: 40px; block-size: 40px; background: var(--sf-primary); }
  .row { display: flex; gap: 24px; align-items: start; margin-block-end: 24px; }
</style></head><body>
<div class="row">
  <div id="l1" class="sf-nest panel">
    <div id="l2" class="sf-nest box">
      <div id="l3" class="sf-nest box">
        <div id="l4" class="sf-nest box"><div id="leaf4" class="leaf">level 4</div></div>
        <div id="leaf3" class="leaf">level 3</div>
      </div>
      <div id="leaf2" class="leaf">level 2</div>
    </div>
    <div id="leaf1" class="leaf">level 1</div>
  </div>
  <div id="plain" class="sf-nest" style="background: var(--sf-surface-2); inline-size: 200px"><div id="leaf-plain" class="leaf">defaults</div></div>
  <div id="outside" class="leaf">outside</div>
</div>
<div id="good">
  <div class="row"><div class="capsule"><div class="round"></div></div></div>
</div>
<div id="bad">
  <div class="row"><div class="bad-panel"><div id="bad-field" class="bad-field"></div></div>
  <div class="loose-panel"><div id="loose-item" class="loose-item"></div></div></div>
</div>
</body></html>`;

const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://probe').pathname;
  if (path === '/core.css') {
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8'});
    return response.end(readFileSync(css));
  }
  if (path === '/light' || path === '/dark') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
  }
  response.writeHead(404);
  return response.end();
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const evidence = process.env.SF_EVIDENCE || '';
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const tab = await browser.newPage({viewport: {width: 1100, height: 700}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
    const measured = await tab.evaluate(() => {
      const px = (node, property = 'borderTopLeftRadius') => Number.parseFloat(getComputedStyle(node)[property]);
      const token = (name) => {
        const ruler = document.createElement('div');
        ruler.style.cssText = `position:absolute;inline-size:var(${name})`;
        document.body.append(ruler);
        const width = ruler.getBoundingClientRect().width;
        ruler.remove();
        return width;
      };
      const at = (id) => document.getElementById(id);
      return {
        tokens: {ui: token('--sf-radius--ui'), surface: token('--sf-radius--surface'), r4: token('--sf-radius-4'), half: token('--sf-space-1\\/2')},
        radius: Object.fromEntries(['l1', 'l2', 'l3', 'l4', 'leaf1', 'leaf2', 'leaf3', 'leaf4', 'plain', 'leaf-plain', 'outside'].map((id) => [id, px(at(id))])),
        inset: {l1: px(at('l1'), 'paddingTop'), l2: px(at('l2'), 'paddingTop'), plain: px(at('plain'), 'paddingTop')},
      };
    });
    seen[theme] = measured;
    const {tokens, radius, inset} = measured;
    const step = (outer) => Math.max(tokens.ui, outer - tokens.half);
    const expected = {l1: tokens.r4};
    expected.leaf1 = step(expected.l1);
    expected.l2 = expected.leaf1;
    expected.leaf2 = step(expected.l2);
    expected.l3 = expected.leaf2;
    expected.leaf3 = step(expected.l3);
    expected.l4 = expected.leaf3;
    expected.leaf4 = step(expected.l4);
    expected.plain = tokens.surface;
    expected['leaf-plain'] = step(tokens.surface);
    expected.outside = tokens.ui;
    for (const [id, value] of Object.entries(expected)) {
      if (Math.abs(radius[id] - value) > 0.01) failures.push(`${theme}: ${id} radius ${radius[id]}, expected ${value}`);
    }
    if (inset.l1 !== tokens.half || inset.plain !== tokens.half) failures.push(`${theme}: inset ${JSON.stringify(inset)}`);
    const chain = await tab.evaluate(lintNestedRadius, {root: '.row'});
    const good = await tab.evaluate(lintNestedRadius, {root: '#good'});
    const bad = await tab.evaluate(lintNestedRadius, {root: '#bad'});
    seen[`${theme}Lint`] = {chain, good, bad};
    if (chain.findings.length || !chain.checked) failures.push(`${theme}: the derived chain fails the lint: ${JSON.stringify(chain)}`);
    if (good.findings.length || !good.checked) failures.push(`${theme}: a round control in a capsule of its height fails the lint: ${JSON.stringify(good)}`);
    const kinds = bad.findings.map((one) => `${one.element}:${one.kind}`);
    if (!kinds.includes('div#bad-field.bad-field:rounder')) failures.push(`${theme}: the lint missed the rounder field: ${kinds}`);
    if (!kinds.includes('div#loose-item.loose-item:not-parallel')) failures.push(`${theme}: the lint missed the corner rounder than derived: ${kinds}`);
    if (evidence) await tab.screenshot({path: join(evidence, `nested-radius-${theme}.png`), fullPage: true});
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('NESTED_RADIUS_OK');
