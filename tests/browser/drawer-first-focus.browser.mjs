#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-drawer's first focus (study DR-12, C159 (9), dispatcher 2026-11-16), on
// the built bytes, opened from the keyboard at 1440 and on a 390 phone:
//   - a form opens with its first field;
//   - content with nothing to fill in -- a value and its copy button, a list
//     of links -- keeps the focus on the panel, which draws no ring; the
//     first content button took it before, and its ring and tooltip covered
//     the value beside it;
//   - the page's [autofocus] still wins.
// Three loads each, console clean.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/close/css/close.css', 'smart/smart/drawer/css/drawer.css'].map((p) => join(out, p));
const modules = ['core/core/js/smart-base.js', 'smart/smart/drawer/js/drawer.js', 'smart/smart/button-close/js/button-close.js',
  'smart/smart/button-icon/js/button-icon.js'].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const CASES = [
  {id: 'read-only record', expect: 'panel',
    body: '<p>Ключ доступа</p><p><code id="value">sk-live-1234</code> <button type="button" id="copy" aria-label="Скопировать">⧉</button></p>'},
  {id: 'links only', expect: 'panel', body: '<ul><li><a id="first-link" href="#a">Раздел</a></li><li><a href="#b">Другой</a></li></ul>'},
  {id: 'form', expect: 'name',
    body: '<form><button type="button" id="help">?</button><label>Имя <input id="name"></label><label>Почта <input id="mail" type="email"></label></form>'},
  {id: 'autofocus', expect: 'copy',
    body: '<p><code>sk-live-1234</code> <button type="button" id="copy" autofocus aria-label="Скопировать">⧉</button></p>'},
];

const html = (c) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">
<button type="button" id="opener" aria-controls="dr" data-drawer="toggle">Открыть</button>
<sf-drawer id="dr" placement="inline-end" heading="Запись">${c.body}</sf-drawer>
</body></html>`;

const failures = [];
let measured = 0;
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) for (const c of CASES) for (let load = 1; load <= 3; load++) {
    const phone = width < 600;
    const context = await browser.newContext({viewport: {width, height: 844}, isMobile: phone, hasTouch: phone});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setContent(html(c));
    for (const path of styles) await page.addStyleTag({path});
    for (const path of modules) await page.addScriptTag({path});
    await page.waitForFunction(() => customElements.get('sf-drawer') && document.querySelector('[data-sf-drawer-root]'));
    await page.focus('#opener');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const got = await page.evaluate(() => {
      const active = document.activeElement;
      const css = getComputedStyle(active);
      return {active: active.hasAttribute('data-sf-drawer-panel') ? 'panel' : active.id || active.tagName.toLowerCase(),
        named: active.hasAttribute('data-sf-drawer-panel') ? Boolean(document.getElementById(active.getAttribute('aria-labelledby') || '-')?.textContent.trim()) : null,
        ring: css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0};
    });
    measured += 1;
    const where = `${width} ${c.id} load ${load}`;
    if (got.active !== c.expect) failures.push({where, want: c.expect, got});
    if (c.expect === 'panel' && (got.ring || !got.named)) failures.push({where, case: 'the panel is named by its title and draws no ring', got});
    if (errors.length) failures.push({where, errors});
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({measured}));
if (failures.length) { console.error(JSON.stringify(failures, null, 1)); process.exit(1); }
console.log('DRAWER_FIRST_FOCUS_OK');
