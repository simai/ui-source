#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-wizard 1.4.6 on the built bytes (study WZ-6, owner decision C153 (3)):
// a step's fields say their errors in the Framework's words, never the
// browser's. At 1440 and 390, light and dark, Russian and English pages:
//   plain    an input with no Framework field around it: empty and required
//            says «required», over its max and against its pattern «invalid»,
//            in the page's language (its custom validity, which the browser's
//            bubble shows), aria-invalid set; the person's edit takes both off;
//            a custom error the page set itself stays as written;
//   field    sf-input with a pattern says its own words (C153 (3));
//   example  the reference example's address pattern compiles under the
//            browser's v flag (no console error) and is checked;
//   row      (WZ-2 guard, C101) in a window the step row has no chevrons and
//            only reached steps are buttons.
// No page errors, no console errors, no failed requests.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const WORDS = {
  ru: JSON.parse(readFileSync(new URL('../../src/smart/wizard/lang/ru.json', import.meta.url), 'utf8')).runtime,
  en: JSON.parse(readFileSync(new URL('../../src/smart/wizard/lang/en.json', import.meta.url), 'utf8')).runtime,
};
const example = JSON.parse(readFileSync(new URL('../../src/smart/wizard/examples.json', import.meta.url), 'utf8')).examples.find((one) => one.name === 'reference');

let theme = 'light';
let lang = 'ru';
const head = () => `<!doctype html><html lang="${lang}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface);color:var(--sf-on-surface)}</style></head><body>`;
const PLAIN = `<sf-wizard id="w" heading="Words">
<sf-wizard-step name="one" label="One" type="form"><form>
<label>Need <input name="need" required></label>
<label>Count <input name="count" type="number" min="1" max="5"></label>
<label>Code <input name="code" pattern="[0-9]+"></label>
<label>Own <input name="own"></label>
<sf-input name="domain" label="Domain" pattern="[a-z0-9.\\-]+"></sf-input>
</form></sf-wizard-step>
<sf-wizard-step name="two" label="Two"><p>Two.</p></sf-wizard-step>
<sf-wizard-step name="three" label="Three" type="result"><p>Done.</p></sf-wizard-step>
</sf-wizard>`;
const REFERENCE = `<sf-button id="open" text="Open"></sf-button><sf-wizard id="w" place="modal" for="open" heading="${example.settings.heading}">${example.children.join('')}</sf-wizard>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const page = {'/plain': PLAIN, '/reference': REFERENCE}[path];
  if (page) { response.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return response.end(`${head()}${page}</body></html>`); }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
const results = [];

async function open(path, width, scheme) {
  theme = scheme;
  const context = await browser.newContext({viewport: {width, height: 900}, locale: lang === 'ru' ? 'ru-RU' : 'en-US', colorScheme: scheme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}${path}`);
  await tab.waitForFunction(() => document.querySelector('#w .sf-wizard-primary button, .sf-wizard-primary button'), null, {timeout: 20000}).catch(() => null);
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.waitForTimeout(300);
  return {tab, context, errors};
}

try {
  for (const width of [1440, 390]) {
    for (const scheme of ['light', 'dark']) {
      for (const language of ['ru', 'en']) {
        lang = language;
        const words = WORDS[language];
        const tag = `plain-${width}-${scheme}-${language}`;
        const fail = [];
        const {tab, context, errors} = await open('/plain', width, scheme);
        await tab.evaluate(() => document.querySelector('[name=own]').setCustomValidity('Page says no'));
        await tab.fill('input[name=count]', '9');
        await tab.fill('input[name=code]', 'abc');
        await tab.fill('sf-input[name=domain] input', 'АБВ!');
        // sf-input says its error on leaving the field (C153), which moves the
        // footer: leave first, then press where the button now is.
        await tab.keyboard.press('Tab');
        await tab.waitForTimeout(300);
        await tab.click('#w .sf-wizard-primary button');
        await tab.waitForTimeout(400);
        const seen = await tab.evaluate(() => {
          const one = (name) => { const input = document.querySelector(`input[name=${name}]`); return {message: input.validationMessage, invalid: input.getAttribute('aria-invalid')}; };
          const domain = document.querySelector('sf-input[name=domain] input');
          const said = (domain.getAttribute('aria-describedby') || '').split(' ').map((id) => id && document.getElementById(id)?.textContent.trim()).filter(Boolean);
          return {need: one('need'), count: one('count'), code: one('code'), own: one('own'), domain: {invalid: domain.getAttribute('aria-invalid'), said, browser: domain.validationMessage}, position: document.querySelector('#w .sf-wizard-position')?.textContent.trim()};
        });
        if (seen.need.message !== words.required || seen.need.invalid !== 'true') fail.push(`required: ${JSON.stringify(seen.need)}`);
        if (seen.count.message !== words.invalid || seen.count.invalid !== 'true') fail.push(`max: ${JSON.stringify(seen.count)}`);
        if (seen.code.message !== words.invalid || seen.code.invalid !== 'true') fail.push(`pattern: ${JSON.stringify(seen.code)}`);
        if (seen.own.message !== 'Page says no') fail.push(`page's own error: ${JSON.stringify(seen.own)}`);
        if (seen.domain.invalid !== 'true' || !seen.domain.said.length || seen.domain.said.includes(seen.domain.browser)) fail.push(`sf-input words: ${JSON.stringify(seen.domain)}`);
        // The edit takes the wizard's words off; a correct value moves on.
        await tab.fill('input[name=count]', '3');
        const cleared = await tab.evaluate(() => { const input = document.querySelector('input[name=count]'); return {message: input.validationMessage, invalid: input.getAttribute('aria-invalid'), mark: input.hasAttribute('data-sf-wizard-words')}; });
        if (cleared.message || cleared.invalid || cleared.mark) fail.push(`edit leaves the words: ${JSON.stringify(cleared)}`);
        await tab.fill('input[name=need]', 'x');
        await tab.fill('input[name=code]', '12');
        await tab.fill('sf-input[name=domain] input', 'shop.ru');
        await tab.evaluate(() => document.querySelector('[name=own]').setCustomValidity(''));
        await tab.keyboard.press('Tab');
        await tab.waitForTimeout(300);
        await tab.click('#w .sf-wizard-primary button');
        await tab.waitForTimeout(400);
        const moved = await tab.evaluate(() => document.querySelector('#w .sf-wizard-title')?.textContent.trim());
        if (moved !== 'Two') fail.push(`does not move after the fix: ${moved}`);
        if (errors.length) fail.push(`errors: ${errors.join(' | ')}`);
        results.push({case: tag, pass: fail.length === 0, seen, fail});
        await context.close();
      }
      lang = 'ru';
      const tag = `reference-modal-${width}-${scheme}`;
      const fail = [];
      const {tab, context, errors} = await open('/reference', width, scheme);
      await tab.click('#open button');
      await tab.waitForTimeout(500);
      const scope = '.sf-modal:has(.sf-wizard-window)';
      const row = await tab.evaluate((scope) => {
        const root = document.querySelector(scope);
        const steps = root?.querySelector('.sf-wizard-steps');
        return {text: steps?.textContent ?? '', buttons: steps ? steps.querySelectorAll('button:not([disabled])').length : -1, title: Boolean(root?.querySelector('.sf-modal-title')), close: Boolean(root?.querySelector('.sf-modal-close-button'))};
      }, scope);
      if (/[>›»]/u.test(row.text)) fail.push(`chevrons in the step row: ${row.text.trim()}`);
      if (row.buttons !== 0) fail.push(`${row.buttons} step buttons on the first step of a linear wizard`);
      if (!row.title || !row.close) fail.push(`window header: ${JSON.stringify(row)}`);
      await tab.fill(`${scope} sf-input[name=title] input`, 'Магазин');
      await tab.fill(`${scope} sf-input[name=domain] input`, 'Магазин!');
      await tab.keyboard.press('Tab');
      await tab.waitForTimeout(300);
      await tab.click(`${scope} .sf-wizard-primary button`);
      await tab.waitForTimeout(400);
      const checked = await tab.evaluate((scope) => document.querySelector(`${scope} sf-input[name=domain] input`)?.getAttribute('aria-invalid'), scope);
      if (checked !== 'true') fail.push(`the address pattern is not checked (aria-invalid ${checked})`);
      if (errors.length) fail.push(`errors: ${errors.join(' | ')}`);
      results.push({case: tag, pass: fail.length === 0, seen: row, fail});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((row) => !row.pass);
console.log(JSON.stringify({ok: failed.length === 0, cases: results.length, failed: failed.length, results}, null, 2));
if (failed.length) process.exitCode = 1;
