#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A layer drawn in a portal carries a copy of its host's language (§19.1).
// When the page switches language with SF.language.use(), a word read inside
// that portal answered the language the page had just left: the copy was
// carried again only later, and nothing drew the element a second time
// (simai/ui-source#55, found by ui-mail, where a resizer in a docked drawer
// kept its Russian name). A portal whose copy came from the page now follows
// the page before the change is announced.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);

const page_html = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head><body style="margin:0">
<sf-drawer id="drawer" docked open edge="start" size="20rem">
  <div slot="panel"><sf-resizer id="resizer" target="#main"></sf-resizer><p id="inside">Панель</p></div>
  <main id="main">Страница</main>
</sf-drawer>
<sf-resizer id="loose" target="#main"></sf-resizer>
</body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page_html);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({locale: 'ru-RU', viewport: {width: 1100, height: 800}});
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`http://127.0.0.1:${server.address().port}/probe`);
  await page.waitForFunction(() => ['sf-drawer', 'sf-resizer'].every((tag) => customElements.get(tag)), null, {timeout: 25000});
  await page.waitForTimeout(600);
  const seen = await page.evaluate(async () => {
    const SF = globalThis.SF;
    SF.language.register('sf-resizer', 'ru', {label: 'Ширина панели'});
    SF.language.register('sf-resizer', 'en', {label: 'Panel width'});
    await new Promise((settle) => setTimeout(settle, 120));
    const inside = document.getElementById('resizer');
    const loose = document.getElementById('loose');
    const portal = inside.closest('[data-sf-drawer-portal]') || inside.closest('[data-sf-layer-lang]');
    const before = {inside: inside.sfWord('label'), loose: loose.sfWord('label'), portalLang: portal?.getAttribute('lang') ?? null, stamped: portal?.dataset?.sfLayerLang ?? null};
    const heard = {};
    const stop = SF.language.onChange(() => {
      heard.inside = inside.sfWord('label');
      heard.loose = loose.sfWord('label');
      heard.portalLang = portal?.getAttribute('lang') ?? null;
    });
    SF.language.use('en');
    stop();
    await new Promise((settle) => setTimeout(settle, 400));
    const after = {inside: inside.sfWord('label'), loose: loose.sfWord('label'), portalLang: portal?.getAttribute('lang') ?? null};
    SF.language.use(null);
    return {before, heard, after, hadPortal: Boolean(portal)};
  });
  if (!seen.hadPortal) failures.push({name: 'the drawer draws its panel in a portal', seen});
  if (seen.before.inside !== 'Ширина панели') failures.push({name: 'the word starts Russian inside the portal', seen});
  if (seen.heard.inside !== 'Panel width') failures.push({name: 'the word is English while the change is announced', seen});
  if (seen.heard.loose !== 'Panel width') failures.push({name: 'the word outside the portal is English too', seen});
  console.log(JSON.stringify(seen));
  await page.close();
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('PORTAL_LANGUAGE_OK');
