#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// ?sf-debug over the npm package (simai/ui-source#8). The package ships Core in
// both forms and every component, utility and Smart file that has a minified
// twin in that form only (ui-builder pack-npm-distribution.cjs). Debug mode asks
// for the readable files; they are not there, and Smart tags stayed undefined.
// This serves the build output the way the package lays it out -- a readable
// .js or .css outside core/ whose .min twin exists answers 404, as if deleted --
// and opens it with ?sf-debug and with no window.sfPath (Core finds its distr
// from its own script URL). It asserts:
//   - Smart elements define and render, and component sheets arrive;
//   - every readable file that 404'd was followed by its .min twin, which loaded;
//   - nothing failed for good (no request for a file that neither form has);
//   - sfPath is the distr root Core came from, and no fallback warning was said;
//   - the same page without ?sf-debug asks for no readable file at all.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const PREFIX = '/npm/@simai-studio/ui@5.0.0/distr/';

const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<link rel="stylesheet" href="${PREFIX}core/css/core.css">
<script src="${PREFIX}core/js/core.js"></script></head><body>
<sf-button id="button" text="Кнопка"></sf-button>
<sf-button-group id="group" value="b" items="a::Первый|b::Второй|c::Третий"></sf-button-group>
<sf-breadcrumbs id="crumbs"><sf-breadcrumbs-item href="/">Главная</sf-breadcrumbs-item><sf-breadcrumbs-item current>Страница</sf-breadcrumbs-item></sf-breadcrumbs>
<p><kbd id="key">Ctrl</kbd></p>
<div class="p-4 d-flex" id="utility">x</div>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const fileFor = (path) => {
  const match = path.startsWith(PREFIX) && path.slice(PREFIX.length).match(/^([^/]+)\/(.+)$/u);
  return match && parts[match[1]] ? {area: match[1], file: join(parts[match[1]], match[2])} : null;
};
// The package's rule: Core whole; elsewhere a readable script or sheet with a
// minified twin is left out.
const shipped = ({area, file}) => {
  if (!existsSync(file) || statSync(file).isDirectory()) return false;
  if (area === 'core') return true;
  const twin = file.match(/^(.*)\.(js|css)$/u);
  if (!twin || twin[1].endsWith('.min')) return true;
  return !existsSync(`${twin[1]}.min.${twin[2]}`);
};

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
  }
  const target = fileFor(path);
  if (!target || !shipped(target)) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(target.file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(target.file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const evidence = {};
const browser = await chromium.launch();

async function visit(query) {
  const tab = await browser.newPage({viewport: {width: 1000, height: 800}});
  const answers = [];
  const warnings = [];
  tab.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith(PREFIX)) answers.push({path: path.slice(PREFIX.length), status: response.status()});
  });
  tab.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
  tab.on('pageerror', (error) => failures.push({name: `page error ${query}`, said: error.message}));
  await tab.goto(`${origin}/${query}`);
  const defined = await tab.waitForFunction(() => ['sf-button', 'sf-button-group', 'sf-breadcrumbs']
    .every((tag) => customElements.get(tag)), null, {timeout: 20000}).then(() => true, () => false);
  await tab.waitForTimeout(800);
  const state = await tab.evaluate(() => {
    const button = document.querySelector('#button button');
    const sheets = [...document.querySelectorAll('link[rel=stylesheet]')].map((link) => link.getAttribute('href'));
    return {
      sfPath: window.sfPath,
      tags: Object.fromEntries(['sf-button', 'sf-button-group', 'sf-breadcrumbs'].map((tag) => [tag, Boolean(customElements.get(tag))])),
      buttonDrawn: Boolean(button && button.getBoundingClientRect().height > 0),
      segments: document.querySelectorAll('#group button').length,
      kbdSheet: sheets.some((href) => /component\/kbd\//u.test(href)),
      utilityPadding: getComputedStyle(document.querySelector('#utility')).paddingTop,
    };
  });
  await tab.close();
  return {defined, state, answers, warnings};
}

try {
  const debug = await visit('?sf-debug');
  const missing = debug.answers.filter((answer) => answer.status === 404);
  const loadedForm = new Set(debug.answers.filter((answer) => answer.status === 200).map((answer) => answer.path));
  const unanswered = missing.filter(({path}) => !loadedForm.has(path.replace(/\.(js|css)$/u, '.min.$1')));
  evidence.debug = {state: debug.state, requests: debug.answers.length, readable404: missing.length,
    followedByMin: missing.length - unanswered.length, unanswered: unanswered.map(({path}) => path)};
  if (!debug.defined) failures.push({name: 'Smart elements define under ?sf-debug', state: debug.state});
  if (!debug.state.buttonDrawn || debug.state.segments !== 3) failures.push({name: 'Smart elements render under ?sf-debug', state: debug.state});
  if (!debug.state.kbdSheet) failures.push({name: 'a component sheet arrives under ?sf-debug'});
  if (debug.state.utilityPadding === '0px') failures.push({name: 'a utility class takes effect under ?sf-debug'});
  if (!missing.length) failures.push({name: 'debug asked for readable files (otherwise this probe proves nothing)'});
  if (unanswered.length) failures.push({name: 'every missing readable file is followed by its minified twin', unanswered: evidence.debug.unanswered});
  if (debug.state.sfPath !== `${origin}${PREFIX}`) failures.push({name: 'sfPath is the distr Core came from', sfPath: debug.state.sfPath});
  if (debug.warnings.some((text) => /sfPath is not set/u.test(text))) failures.push({name: 'no fallback warning when Core knows its distr'});

  const plain = await visit('');
  const readable = plain.answers.filter((answer) => !answer.path.startsWith('core/') && /(?<!\.min)\.(js|css)$/u.test(answer.path)
    && existsSync(join(parts[answer.path.split('/')[0]] ?? '/nonexistent', answer.path.split('/').slice(1).join('/').replace(/\.(js|css)$/u, '.min.$1'))));
  evidence.plain = {state: plain.state, requests: plain.answers.length, readableAsked: readable.map(({path}) => path), status404: plain.answers.filter((answer) => answer.status === 404).map(({path}) => path)};
  if (!plain.defined) failures.push({name: 'Smart elements define without debug', state: plain.state});
  if (readable.length) failures.push({name: 'without debug no readable twin is asked for', readable: evidence.plain.readableAsked});
  if (evidence.plain.status404.length) failures.push({name: 'without debug nothing 404s', paths: evidence.plain.status404});
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({evidence, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
