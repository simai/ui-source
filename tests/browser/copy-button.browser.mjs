#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-copy-button (2026-10-14), measured on the built bytes: a value and a
// target's text reach the clipboard; the icon turns to a check and «Скопировано»
// is announced; the accessible name is the label; a refused clipboard selects
// the text and announces Ctrl+C; a missing target is an error and says so.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css', 'smart/smart/copy-button/css/copy-button.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js', 'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/copy-button/js/copy-button.js'];
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  const origin = 'http://localhost:4719';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><body style="margin:20px">
    <code id="token">sk_test_42</code>
    <sf-copy-button id="by-target" target="#token" label="Скопировать ключ" duration="5000"></sf-copy-button>
    <sf-copy-button id="by-value" value="npm i @simai/ui" text="Копировать" label="Скопировать команду"></sf-copy-button>
    <sf-copy-button id="missing" target="#nowhere"></sf-copy-button>
    <sf-copy-button id="refused" target="#token"></sf-copy-button>
    <sf-copy-button id="link" value="https://example.test/r/1" icon="link" success-icon="done_all" duration="5000" appearance="tonal" root-style="--sf-icon-button--box-shadow: 0 0 0 3px red"></sf-copy-button>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-copy-button'), null, {timeout: 8000});
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.events = [];
    document.addEventListener('sf-copy', (event) => window.events.push(['copy', event.target.id, event.detail.text]));
    document.addEventListener('sf-copy-error', (event) => window.events.push(['error', event.target.id, event.detail.code]));
  });
  const names = await page.evaluate(() => ['by-target', 'by-value', 'missing'].map((id) => document.querySelector(`#${id} button`)?.getAttribute('aria-label')));
  await page.click('#by-target button');
  await page.waitForTimeout(200);
  const afterTarget = await page.evaluate(async () => ({
    clipboard: await navigator.clipboard.readText(),
    icon: document.querySelector('#by-target .sf-icon')?.textContent.trim(),
    status: document.querySelector('#by-target .sf-copy-button-status')?.textContent.trim(),
  }));
  // Its own glyphs: a link at rest, its own success glyph after.
  const linkIdle = await page.evaluate(() => document.querySelector('#link .sf-icon')?.textContent.trim());
  // tonal, and the root style lands on the control.
  const linkControl = await page.evaluate(() => {
    const control = document.querySelector('#link .sf-icon-button');
    return {tonal: control?.className.includes('tonal'), shadow: control ? getComputedStyle(control).boxShadow.includes('255, 0, 0') : false};
  });
  if (!linkControl.tonal || !linkControl.shadow) note({case: 'tonal and root-style on the control', got: linkControl});
  await page.click('#link button');
  await page.waitForTimeout(200);
  const linkDone = await page.evaluate(() => document.querySelector('#link .sf-icon')?.textContent.trim());
  if (linkIdle !== 'link' || linkDone !== 'done_all') note({case: 'icon and success-icon', got: {linkIdle, linkDone}});
  await page.click('#by-value button');
  await page.waitForTimeout(200);
  const afterValue = await page.evaluate(async () => navigator.clipboard.readText());
  await page.click('#missing button');
  await page.waitForTimeout(200);
  const missing = await page.evaluate(() => document.querySelector('#missing .sf-copy-button-status')?.textContent.trim());
  // The browser refuses: no clipboard API, no execCommand.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError'))}, configurable: true});
    document.execCommand = () => false;
  });
  await page.click('#refused button');
  await page.waitForTimeout(200);
  const refused = await page.evaluate(() => ({
    selection: String(getSelection()),
    status: document.querySelector('#refused .sf-copy-button-status')?.textContent.trim(),
  }));
  const events = await page.evaluate(() => window.events);
  if (names.join() !== 'Скопировать ключ,Скопировать команду,Копировать') note({case: 'names', got: names});
  if (afterTarget.clipboard !== 'sk_test_42' || afterTarget.icon !== 'check' || afterTarget.status !== 'Скопировано') note({case: 'copy a target', got: afterTarget});
  if (afterValue !== 'npm i @simai/ui') note({case: 'copy a value', got: afterValue});
  if (missing !== 'Не удалось скопировать') note({case: 'a missing target', got: missing});
  if (refused.selection !== 'sk_test_42' || !/^Выделено — нажмите (Ctrl\+C|⌘C)$/u.test(refused.status ?? '')) note({case: 'a refused clipboard', got: refused});
  const said = events.map((entry) => entry.join(':')).join(',');
  if (said !== 'copy:by-target:sk_test_42,copy:link:https://example.test/r/1,copy:by-value:npm i @simai/ui,error:missing:missing_target,error:refused:denied') note({case: 'events', got: said});
  console.log(JSON.stringify({names, afterTarget, afterValue, missing, refused, events}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('COPY_BUTTON_OK');
