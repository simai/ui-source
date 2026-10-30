#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-tag 1.1.6 on the built bytes, loaded by the real Loader: the remove
// button keeps to the label's line at every size. Measured before: the tag
// asked sf-icon-button for size 1/4 at 1/2 and 1/3 (a size it does not have,
// so it drew size 1), and the button kept the tag's insets as padding, so a
// removable tag stood 40px at 1/3 against 24 without the button, 38 at 1/2
// against 32, 50 at 2 against 48, and an inline one 20.39 on a 16px line.
// At every size, free-standing and inline:
// - the close box is no taller than the label's line;
// - a removable tag is as tall as the same tag without the button;
// - an inline tag is the line high;
// - the target (the button's ::after) is at least 24px square (WCAG 2.2, 2.5.8);
// - the button asks for a size sf-icon-button has;
// - beside a label that is a button (interactive, checkbox) the target stays off
//   it: a click on the end of the label reaches the label, not the remove.
// All of it at three viewport widths, because the text ladder moves with the
// width: a size's line at 1280 is not its line at 900.
// And in sf-lookup 1.0.1, without its old height cap: the chip is the field's
// line high and its close box no taller than that line.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const BUTTON_SIZES = JSON.parse(readFileSync(new URL('../../src/smart/icon-button/component.json', import.meta.url), 'utf8')).settings.size.values;
const island = (data) => `<script type="application/json" data-sf-settings>${JSON.stringify(data)}</script>`;
const row = (size) => `<div data-size="${size}" style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
  <sf-tag data-case="plain" kind="default" text="Billing" size="${size}"></sf-tag>
  <sf-tag data-case="removable" kind="default" text="Billing" size="${size}" closable></sf-tag>
  <sf-tag data-case="icon" kind="icon" icon="sell" text="Billing" size="${size}"></sf-tag>
  <sf-tag data-case="inline" kind="default" text="Billing" size="${size}" inline closable></sf-tag>
  <sf-tag data-case="interactive" kind="default" interactive text="Billing" size="${size}" closable></sf-tag>
  <sf-tag data-case="checkbox" kind="checkbox" text="Billing" size="${size}" closable></sf-tag>
  <sf-lookup data-case="lookup" size="${size}" multiple label="People" name="people-${size.replace('/', '-')}" value='["a"]'>${island({options: [{value: 'a', label: 'Anna Petrova'}]})}</sf-lookup>
</div>`;
current = `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;display:grid;gap:16px;background:var(--sf-surface-0)">
${SIZES.map(row).join('\n')}
</body></html>`;

const failures = [];
const check = (name, pass, detail = {}) => {
  if (!pass) failures.push({name, ...detail});
};
const EPS = 0.05;

const browser = await chromium.launch();
const evidence = [];
try {
  const page = await browser.newPage();
  await page.goto(`${base}/probe`, {waitUntil: 'load'});
  await page.waitForFunction((n) => customElements.get('sf-tag') && customElements.get('sf-lookup')
    && document.querySelectorAll('sf-tag sf-icon-button > .sf-icon-button').length >= n, SIZES.length * 5, {timeout: 20000});
  for (const width of [1280, 900, 375]) {
    await page.setViewportSize({width, height: 2400});
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-size]')].map((rowEl) => {
      const size = rowEl.dataset.size;
      const measure = (host) => {
        const tag = host.querySelector('.sf-tag');
        const label = tag.querySelector('.sf-tag-container');
        const iconButton = tag.querySelector(':scope > sf-icon-button');
        const button = iconButton?.querySelector(':scope > .sf-icon-button');
        const after = button ? getComputedStyle(button, '::after') : null;
        const box = button?.getBoundingClientRect();
        return {
          tag: tag.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(label).lineHeight),
          asks: iconButton?.getAttribute('size') ?? null,
          close: box ? {height: box.height, width: box.width} : null,
          // The target is the button's box, or its ::after where that reaches further.
          target: box ? {height: Math.max(box.height, after?.content !== 'none' && after?.position === 'absolute' ? parseFloat(after.height) : 0), width: Math.max(box.width, after?.content !== 'none' && after?.position === 'absolute' ? parseFloat(after.width) : 0)} : null,
        };
      };
      // What a click reaches at the last pixel of a label that is a button.
      const labelEnd = (host) => {
        const action = host.querySelector('.sf-tag-action').getBoundingClientRect();
        const button = host.querySelector('sf-icon-button > .sf-icon-button');
        const box = button.getBoundingClientRect();
        const reach = parseFloat(getComputedStyle(button, '::after').width);
        // Two pixels in: boxes snap to whole pixels when hit, so the pixel on
        // either side of the shared edge can go to the target with no overlap in
        // the layout (measured: 1px in is the close at some sizes, 1.25px the
        // label). overlap above holds the layout to the edge; this holds the click.
        const y = action.top + action.height / 2;
        const reaches = (x) => Boolean(document.elementFromPoint(x, y)?.closest('.sf-tag-action'));
        const text = document.createRange();
        text.selectNodeContents(host.querySelector('.sf-tag-container'));
        return {overlap: action.right - (box.left + box.width / 2 - reach / 2), reachesAction: reaches(action.right - 2) && reaches(text.getBoundingClientRect().right - 1)};
      };
      const at = (name) => rowEl.querySelector(`[data-case="${name}"]`);
      const lookup = at('lookup');
      const chip = lookup.querySelector('.sf-lookup-chip');
      return {
        size,
        plain: measure(at('plain')),
        removable: measure(at('removable')),
        icon: measure(at('icon')),
        inline: measure(at('inline')),
        interactive: {...measure(at('interactive')), ends: labelEnd(at('interactive'))},
        checkbox: {...measure(at('checkbox')), ends: labelEnd(at('checkbox'))},
        chip: chip ? {...measure(chip), field: parseFloat(getComputedStyle(lookup.querySelector('.sf-lookup')).getPropertyValue('--sf-lookup--line-height')) || null} : null,
      };
    }));
    for (const row of rows) {
      const where = `${width}px, size ${row.size}`;
      for (const name of ['removable', 'icon', 'inline', 'interactive', 'checkbox', 'chip']) {
        const got = row[name];
        if (!got) {
          check(`${name} at ${where} is drawn`, false);
          continue;
        }
        check(`${name} at ${where}: a close button`, Boolean(got.close), {got});
        if (!got.close) continue;
        check(`${name} at ${where}: asks for a size sf-icon-button has`, BUTTON_SIZES.includes(got.asks), {asks: got.asks});
        check(`${name} at ${where}: the close box is no taller than the line`, got.close.height <= got.line + EPS, {close: got.close, line: got.line});
        check(`${name} at ${where}: a target of at least 24px`, got.target && got.target.height >= 24 - EPS && got.target.width >= 24 - EPS, {target: got.target});
      }
      check(`removable at ${where}: as tall as the tag without the button`, Math.abs(row.removable.tag - row.plain.tag) <= EPS, {removable: row.removable.tag, plain: row.plain.tag});
      check(`inline at ${where}: the line high`, Math.abs(row.inline.tag - row.inline.line) <= EPS, {tag: row.inline.tag, line: row.inline.line});
      for (const name of ['interactive', 'checkbox']) {
        check(`${name} at ${where}: the target stays off the label`, row[name].ends.overlap <= EPS, {ends: row[name].ends});
        check(`${name} at ${where}: the label's end reaches the label`, row[name].ends.reachesAction, {ends: row[name].ends});
      }
      if (row.chip) check(`lookup chip at ${where}: the field's line high`, Math.abs(row.chip.tag - row.chip.line) <= EPS, {chip: row.chip});
    }
    evidence.push({width, rows});
  }
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('TAG_CLOSE_GEOMETRY_OK');
