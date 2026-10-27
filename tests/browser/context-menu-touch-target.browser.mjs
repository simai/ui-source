#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-context-menu rows are touch targets under a coarse pointer
// (simai/ui-source#25, ui-chat): at size 1/2 a row was 24-32px under a finger.
// The standard menu (entries, opened through openFor()) of sizes 1/2 and 1, and
// a hand-written menu of .sf-button rows, measured on the built bytes:
//   - coarse pointer (a touch phone at 390px): every row -- action, check,
//     radio, a row with a value, a choice segment, a button row -- is at least
//     44px tall, and its label stands on the row's centre line;
//   - fine pointer: at 390px no row takes the touch floor, and at 1440px every
//     one-line row is exactly the control height of the menu's size, as before.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'component/component/context-menu/css/context-menu.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/buttons/js/buttons.js',
  'smart/smart/context-menu/js/context-menu.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const measure = async (browser, label, options) => {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: `${label}: page error`, said: error.message}); });
  await page.setContent(`<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:16px">
    <button id="t-half" type="button">Меню 1/2</button> <button id="t-one" type="button">Меню 1</button>
    <sf-context-menu id="half" popup aria-label="Действия"></sf-context-menu>
    <sf-context-menu id="one" popup size="1" aria-label="Действия"></sf-context-menu>
    <div class="sf-context-menu sf-context-menu--entries" id="plain" style="position:absolute;inset-block-start:400px;inset-inline-start:16px">
      <div class="relative"><div class="sf-context-menu-content flex flex-col">
        <button type="button" class="sf-button sf-button--link sf-button--on-surface sf-button--size-1/2"><span class="sf-button-text-container">Переименовать</span></button>
        <button type="button" class="sf-button sf-button--link sf-button--on-surface sf-button--size-1/2"><span class="sf-button-text-container">Удалить</span></button>
      </div></div>
    </div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({path});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-context-menu'));
  const rows = [];
  for (const [id, trigger, size] of [['half', 't-half', '1/2'], ['one', 't-one', '1']]) {
    await page.evaluate(({id, trigger}) => {
      const menu = document.getElementById(id);
      menu.entries = [
        {id: 'open', text: 'Открыть', icon: 'open_in_new'},
        {id: 'lang', text: 'Язык', icon: 'translate', value: 'Русский'},
        {id: 'pin', text: 'Закрепить', kind: 'check', checked: true},
        {type: 'choice', text: 'Тема', options: [{id: 'light', text: 'Светлая', checked: true}, {id: 'dark', text: 'Тёмная'}]},
        {type: 'separator'},
        {id: 'archive', text: 'В архив', icon: 'archive', danger: true},
      ];
      menu.openFor(document.getElementById(trigger));
    }, {id, trigger});
    await page.waitForTimeout(250);
    rows.push(...await page.evaluate(({id, size}) => {
      const surface = document.querySelector(`#${id} > .sf-context-menu`);
      const control = (() => {
        const probe = document.createElement('div');
        probe.style.blockSize = `var(--sf-ui-${size.replace('/', '\\/')}--control-height)`;
        document.body.append(probe);
        const height = probe.getBoundingClientRect().height;
        probe.remove();
        return height;
      })();
      return [...surface.querySelectorAll('.sf-context-menu-item')].map((row) => {
        const box = row.getBoundingClientRect();
        const label = row.querySelector('.sf-context-menu-item-label') || row;
        const text = label.getBoundingClientRect();
        return {menu: id, row: (row.querySelector('.sf-context-menu-item-label') || row).textContent.trim().slice(0, 16), height: box.height, control,
          middle: Math.abs((text.top + text.height / 2) - (box.top + box.height / 2))};
      });
    }, {id, size}));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  rows.push(...await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.blockSize = 'var(--sf-ui-1\\/2--control-height)';
    document.body.append(probe);
    const control = probe.getBoundingClientRect().height;
    probe.remove();
    return [...document.querySelectorAll('#plain .sf-button')].map((button) => {
      const box = button.getBoundingClientRect();
      const text = button.querySelector('.sf-button-text-container').getBoundingClientRect();
      return {menu: 'buttons', row: button.textContent.trim(), height: box.height, control,
        middle: Math.abs((text.top + text.height / 2) - (box.top + box.height / 2))};
    });
  }));
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await context.close();
  return {rows, coarse};
};

const browser = await chromium.launch();
try {
  const touch = await measure(browser, 'touch', {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const phone = await measure(browser, 'fine 390', {viewport: {width: 390, height: 844}});
  const desktop = await measure(browser, 'fine 1440', {viewport: {width: 1440, height: 900}});
  evidence.touch = touch.rows.map(({menu, row, height}) => `${menu}:${row}:${height}`);
  evidence.phone = phone.rows.map(({menu, row, height}) => `${menu}:${row}:${height}`);
  evidence.desktop = desktop.rows.map(({menu, row, height}) => `${menu}:${row}:${height}`);
  check('the touch run has a coarse pointer', touch.coarse === true);
  check('the fine runs do not', phone.coarse === false && desktop.coarse === false);
  check('every kind of row was measured', touch.rows.length >= 14, {count: touch.rows.length});
  for (const row of touch.rows) {
    check(`touch ${row.menu} «${row.row}»: at least 44px`, row.height >= 44, row);
    check(`touch ${row.menu} «${row.row}»: the label on the row's centre line`, row.middle <= 0.5, row);
  }
  // A mouse keeps the ladder's rows: below the target on a phone-wide window,
  // and the control height of the menu's size on the desktop.
  for (const row of phone.rows) {
    check(`fine 390px ${row.menu} «${row.row}»: no touch floor without a coarse pointer`, row.height < 44, row);
  }
  for (const row of desktop.rows) {
    check(`fine 1440px ${row.menu} «${row.row}»: the control height of the menu's size, unchanged`, near(row.height, row.control), row);
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('CONTEXT_MENU_TOUCH_TARGET_OK');
