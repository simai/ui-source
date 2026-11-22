#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-drawer, owner decision C104 (4), on the built bytes: the close stands on
// the axis of the switch that opened the panel (a header's menu button naming
// the drawer in aria-controls), at 1440 and on a 390 touch phone, left to
// right and right to left; a switch on the other side keeps the close at the
// end; a panel that covers its switch offers a close (controlled, and
// show-close="false" unless the content has a close of its own); Escape and
// the close give the focus back to the switch, also when the press gave it
// none; a wide text opener (220 px) keeps the close at the end (DEV F1).
// Half a pixel of tolerance (sub-pixel rounding of the measured axis).
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

const failures = [];
let measured = 0;
const check = (name, pass, detail = {}) => { measured += 1; if (!pass) failures.push({name, ...detail}); };

// axis: the close's centre equals the switch's; 'end': the close stays at the
// head's end; 'drawn' / 'none': only whether a close is there.
const CASES = [
  {id: 'start switch, start panel', bar: 'start', placement: 'inline-start', expect: 'axis'},
  {id: 'end switch, end panel', bar: 'end', placement: 'inline-end', expect: 'axis'},
  // A panel as wide as the screen (390) stands over both sides: the close
  // goes to the switch's side.
  {id: 'start switch, end panel', bar: 'start', placement: 'inline-end', expect: 'end', phone: 'axis'},
  // Not the outermost control of its row: the close keeps its place.
  {id: 'second button of a toolbar', bar: 'start', placement: 'inline-start', expect: 'end', before: true},
  {id: 'press with no focus', bar: 'start', placement: 'inline-start', expect: 'axis', nofocus: true},
  {id: 'controlled over the bar', bar: 'start', placement: 'inline-start', attrs: 'controlled', expect: 'axis'},
  {id: 'controlled under the bar', bar: 'start', placement: 'inline-start', attrs: 'controlled block-start="56px"', expect: 'none'},
  {id: 'show-close false over the bar', bar: 'start', placement: 'inline-start', attrs: 'show-close="false"', expect: 'axis'},
  {id: 'show-close false with an own close', bar: 'start', placement: 'inline-start', attrs: 'show-close="false"', own: true, expect: 'none'},
  // DEV F1 (2026-11-22): a text opener wider than the head's close cell keeps
  // the close at the end of the head, in a phone-wide panel too.
  {id: 'wide text opener, start panel', bar: 'start', placement: 'inline-start', text: true, expect: 'end'},
  {id: 'wide text opener, end panel', bar: 'end', placement: 'inline-end', text: true, expect: 'end'},
  {id: 'wide text opener, phone-wide panel', bar: 'start', placement: 'inline-end', text: true, expect: 'end', phone: 'end'},
];

const html = (c, dir) => `<!doctype html><html lang="ru" dir="${dir}" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">
<header style="display:flex;align-items:center;gap:8px;block-size:56px;padding-inline:16px;box-sizing:border-box">${c.bar === 'end' ? '<span style="flex:1">Сайт</span>' : ''}${c.before ? '<button type="button">Структура</button>' : ''}${c.text ? '<span id="burger"><button type="button" aria-controls="dr" data-drawer="toggle" style="inline-size:220px">placement="inline-start"</button></span>' : '<sf-button-icon id="burger" icon="menu" aria-label="Разделы" aria-controls="dr" data-drawer="toggle"></sf-button-icon>'}${c.bar === 'start' ? '<span style="flex:1">Сайт</span>' : ''}</header>
<sf-drawer id="dr" placement="${c.placement}" heading="Разделы" ${c.attrs || ''}><p>Разделы</p>${c.own ? '<button type="button" data-drawer="close">Закрыть</button>' : ''}</sf-drawer>
</body></html>`;

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) for (const dir of ['ltr', 'rtl']) for (const c of CASES) {
    const phone = width < 600;
    const context = await browser.newContext({viewport: {width, height: 844}, isMobile: phone, hasTouch: phone});
    const page = await context.newPage();
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
    await page.setContent(html(c, dir));
    for (const path of styles) await page.addStyleTag({path});
    for (const path of modules) await page.addScriptTag({path});
    await page.waitForFunction(() => customElements.get('sf-drawer') && document.querySelector('#burger button') && document.querySelector('[data-sf-drawer-root]'));
    const where = `${width} ${dir} ${c.id}`;
    const expect = phone && c.phone ? c.phone : c.expect;
    const press = async () => {
      if (c.nofocus) await page.evaluate(() => document.querySelector('#burger button').click());
      else await page.click('#burger button');
      await page.waitForTimeout(500);
    };
    await press();
    const m = await page.evaluate(() => {
      const box = (e) => e?.getBoundingClientRect();
      const b = box(document.querySelector('#burger button'));
      const root = document.querySelector('[data-sf-drawer-id="dr"]');
      const close = root.querySelector('.sf-drawer-head .sf-drawer-close');
      const head = box(root.querySelector('.sf-drawer-head'));
      const panel = root.querySelector('.sf-drawer-panel');
      const x = box(close);
      const style = getComputedStyle(root.querySelector('.sf-drawer-head'));
      return {opener: b.left + b.width / 2, close: x && x.width ? x.left + x.width / 2 : null,
        headEnd: getComputedStyle(panel).direction === 'rtl' ? head.left + parseFloat(style.paddingLeft) : head.right - parseFloat(style.paddingRight),
        closeEnd: x && x.width ? (getComputedStyle(panel).direction === 'rtl' ? x.left : x.right) : null};
    });
    if (expect === 'none') check(`${where}: no close`, m.close === null, m);
    else check(`${where}: a close`, m.close !== null, m);
    if (expect === 'axis' && m.close !== null) check(`${where}: on the switch's axis`, Math.abs(m.close - m.opener) <= 0.5, m);
    if (expect === 'end' && m.close !== null) check(`${where}: at the head's end`, Math.abs(m.closeEnd - m.headEnd) <= 0.5, m);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const focus = () => page.evaluate(() => ({open: document.getElementById('dr').hasAttribute('open'),
      opener: document.activeElement === document.querySelector('#burger button')}));
    const esc = await focus();
    check(`${where}: Escape closes, focus on the switch`, !esc.open && esc.opener, esc);
    if (m.close !== null) {
      await press();
      await page.evaluate(() => document.querySelector('[data-sf-drawer-id="dr"] .sf-drawer-head .sf-drawer-close').click());
      await page.waitForTimeout(400);
      const after = await focus();
      check(`${where}: the close closes, focus on the switch`, !after.open && after.opener, after);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({measured, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
