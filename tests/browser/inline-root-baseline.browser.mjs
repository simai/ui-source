#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An inline-level root holds still while its icon loads. sf-tag and sf-pager's
// counter are inline-flex and take their baseline from their first item, an
// icon. An icon has three states: printed (font-size 0 until the runtime marks
// it loaded), marked with no face yet (the fallback's metrics) and drawn. On the
// printed markup alone, with no component code, the root and the text under it
// must stand in the same place in all three. They stood 1-2 px apart before
// the icon's layout was contained, which gate 24 saw once in some 800
// measurements (2026-10-30): its window usually closed before the step.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const source = resolve(new URL('../../src/smart', import.meta.url).pathname);
const CASES = [
  {component: 'tag', example: 'icon', root: '.sf-tag'},
  {component: 'pager', example: 'compact', root: '.sf-pager'},
];
const sheets = (item) => JSON.parse(readFileSync(join(source, item.component, 'static', 'sheets.json'), 'utf8')).examples[item.example];
const markup = (item) => readFileSync(join(source, item.component, 'static', 'default', `${item.example}.html`), 'utf8');

let current;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">${sheets(current).map((sheet) => `<link rel="stylesheet" href="/distr/${sheet}">`).join('')}</head><body style="margin:0"><div id="stage">${markup(current)}</div><div id="under">после</div></body></html>`);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((ready) => server.once('listening', ready));
const origin = `http://127.0.0.1:${server.address().port}/`;

const failures = [];
const browser = await chromium.launch();
const place = (page, root) => page.evaluate((root) => {
  const stage = document.querySelector('#stage').getBoundingClientRect().top;
  const top = (selector) => Math.round((document.querySelector(selector).getBoundingClientRect().top - stage) * 10) / 10;
  return {root: top(root), under: top('#under')};
}, root);
const mark = (page) => page.evaluate(() => document.querySelectorAll('.sf-icon').forEach((icon) => icon.classList.add('sf-icon-loaded')));
const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
for (const item of CASES) {
  current = item;
  // No face at all: the first two states, for as long as a measurement wants.
  const held = await browser.newContext({viewport: {width: 1280, height: 800}});
  const page = await held.newPage();
  await page.route(/\.woff2?(\?|$)/u, (route) => route.abort());
  await page.goto(origin, {waitUntil: 'load'});
  await frames(page);
  const printed = await place(page, item.root);
  await mark(page);
  await frames(page);
  const marked = await place(page, item.root);
  await held.close();
  // The faces in: the drawn state.
  const open = await browser.newContext({viewport: {width: 1280, height: 800}});
  const drawnPage = await open.newPage();
  await drawnPage.goto(origin, {waitUntil: 'load'});
  await mark(drawnPage);
  await drawnPage.evaluate(async () => {
    await Promise.all([...document.fonts].filter((face) => /symbol/iu.test(face.family)).map((face) => face.load().catch(() => null)));
  });
  await frames(drawnPage);
  const drawn = await place(drawnPage, item.root);
  const faces = await drawnPage.evaluate(() => [...document.fonts].filter((face) => face.status === 'loaded' && /symbol/iu.test(face.family)).length);
  await open.close();
  const line = `${item.component}/${item.example}: printed ${JSON.stringify(printed)}, marked ${JSON.stringify(marked)}, drawn ${JSON.stringify(drawn)}`;
  console.log(line);
  if (!faces) failures.push(`${item.component}/${item.example}: no icon face loaded, the drawn state was not measured`);
  if (JSON.stringify(printed) !== JSON.stringify(marked) || JSON.stringify(marked) !== JSON.stringify(drawn)) failures.push(line);
}
await browser.close();
server.close();
if (failures.length) {
  console.error(`inline-root-baseline: ${failures.length} failed\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('inline-root-baseline: the root and the text under it hold through the icon\'s three states');
