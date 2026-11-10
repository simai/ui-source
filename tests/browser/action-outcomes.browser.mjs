#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Standard simai.smart-component §4.4: "The generated method returns the
// outcome; chaining is not part of the interface." The references of 14
// components said their actions returned the element (docs pre-review of
// guide/smart-components, 2026-11-10, GS-F7). On the built bytes, each action
// of those components is called once on a drawn element, and its answer
// (awaited when it is a promise) must be an outcome {outcome: <word>}, never
// the element.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const FOLDERS = ['alert', 'drawer', 'dropdown', 'file-upload', 'gallery', 'modal', 'pagination', 'slider', 'spinner', 'steps', 'tabs', 'toast', 'input-quantity', 'input-image'];
const camel = (name) => name.replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());
const cases = FOLDERS.map((folder) => {
  const manifest = JSON.parse(readFileSync(new URL(`../../src/smart/${folder}/component.json`, import.meta.url), 'utf8'));
  return {tag: manifest.tag, methods: Object.keys(manifest.actions || {}).map(camel)};
});

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => note({said: `page error: ${error.message}`}));
  if (process.env.TRACE) page.on('console', (message) => console.error(message.text()));
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body></body></html>'});
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'outcomes', pluginListVersion: 'outcomes', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
    <link rel="stylesheet" href="/distr/core/css/core.css">
    </head><body>${cases.map(({tag}) => `<${tag}></${tag}>`).join('')}<script src="/distr/core/js/core.js"></script></body></html>`);
  await page.waitForFunction((tags) => tags.every((tag) => customElements.get(tag)), cases.map((c) => c.tag), {timeout: 20000});
  const rows = await page.evaluate(async (list) => {
    const answers = [];
    for (const {tag, methods} of list) {
      const element = document.querySelector(tag);
      await Promise.race([element.whenRendered?.(), new Promise((done) => setTimeout(done, 2000))]);
      for (const method of methods) {
        console.log(`call ${tag}.${method}`);
        let answer;
        let threw = '';
        try {
          answer = element[method]();
          if (answer && typeof answer.then === 'function') answer = await Promise.race([answer, new Promise((done) => setTimeout(() => done({outcome: '(still waiting)'}), 1500))]);
        } catch (error) {
          threw = String(error?.message || error);
        }
        answers.push({tag, method, isElement: answer === element, outcome: answer && typeof answer === 'object' ? answer.outcome : typeof answer, threw});
      }
    }
    return answers;
  }, cases);
  for (const row of rows) {
    if (row.isElement || typeof row.outcome !== 'string' || ['undefined', 'boolean', 'number'].includes(row.outcome) || row.threw) note({case: 'an action answers an outcome, not the element', ...row});
  }
  console.log(JSON.stringify({actions: rows.length, outcomes: [...new Set(rows.map((row) => row.outcome))]}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('ACTION_OUTCOMES_OK');
