#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--loads=3] [--json=<file>]
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// The defects the docs' missing Smart pages found (DEV letters msg-ee572eff
// and msg-4f3adb0f; contract tests/forms-feedback-docs-gap.contract.test.mjs),
// on the built bytes with the real Loader, driven by real clicks and keys at
// 1440 and 390, light and dark, each load three times, the console read:
//
// - TG-1 every cross of a closable row is named by its tag («Удалить Казань»);
//   close-label still wins;
// - TG-2 a cross pressed with the mouse, and Enter on a cross, remove the tag
//   and leave the focus on the neighbour (Delete always did), not the body;
// - TG-3 selected and selected-ids written as attributes choose the tags;
// - FF-1 selected-ids written after the row connected (attribute and property) chooses too;
// - TG-4 a bare sf-tag in a group without selection is a plain tag;
// - FO-1 apply instant: typing «abc» and leaving sends one sf-form-change;
// - FO-2 in a sandboxed frame without allow-forms, «Сохранить» sends
//   sf-form-invalid (empty) and sf-form-submit (filled), no blocked submission;
// - FO-4 a required field cleared, then a press straight on «Сохранить»
//   (down, 150 ms, up): the press lands (sf-form-invalid) and the button does
//   not move between down and up;
// - PR-1 the ring draws --sf-progress-ring-value, and the former
//   --sf-progress-ring--value written on the root still draws;
// - PS-1 sf-progress-scale whose value a script changed survives a resize
//   and a drawing by its template (no TypeError) and shows one text, the
//   new value.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const args = process.argv.slice(2);
if (!args[0]) throw new Error('Build output root is required');
const out = resolve(args[0]);
const LOADS = Number(args.find((one) => one.startsWith('--loads='))?.slice(8) ?? 3);
const JSON_OUT = args.find((one) => one.startsWith('--json='))?.slice(7) ?? '';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
const pages = new Map();
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  // The browser asks for a page icon on the first load; it is not the Framework's.
  if (path === '/favicon.ico') {
    response.writeHead(204);
    return response.end();
  }
  if (pages.has(path)) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages.get(path));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const head = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/lang/ru.js"></script>
<script src="/distr/core/js/core.js"></script></head>`;
const island = (data) => `<script type="application/json" data-sf-settings>${JSON.stringify(data)}</script>`;
const field = (key, label, extra = {}) => ({key, label, propertyType: 'string', ...extra});
const formOf = (id, settings) => `<sf-form id="${id}">${island(settings)}</sf-form>`;
// Events counted per form, by name.
const counting = `<script>window.seen={};for(const name of ['sf-form-change','sf-form-input','sf-form-submit','sf-form-invalid'])document.addEventListener(name,(event)=>{const id=event.target.id||'?';(window.seen[id]??={})[name]=((window.seen[id]??={})[name]||0)+1;(window.seen[id].last??={})[name]=event.detail;},true);
document.addEventListener('sf-tag-close',(event)=>{if(event.target.closest('[data-removes]'))event.target.remove();});</script>`;

const main = (theme) => `${head(theme)}<body style="margin:0;padding:16px;display:flex;flex-direction:column;gap:24px;background:var(--sf-surface-0);color:var(--sf-on-surface)">${counting}
<sf-tag-group id="tg-names" data-removes aria-label="Города"><sf-tag kind="default" closable text="Москва"></sf-tag><sf-tag kind="default" closable text="Казань"></sf-tag><sf-tag kind="default" closable text="Тверь"></sf-tag><sf-tag kind="default" closable text="Омск" close-label="Убрать город"></sf-tag></sf-tag-group>
<sf-tag-group id="tg-click" data-removes layout="wrap" aria-label="Мышь"><sf-tag kind="default" closable text="Один"></sf-tag><sf-tag kind="default" closable text="Два"></sf-tag><sf-tag kind="default" closable text="Три"></sf-tag></sf-tag-group>
<sf-tag-group id="tg-enter" data-removes layout="wrap" aria-label="Клавиши"><sf-tag kind="default" closable text="Альфа"></sf-tag><sf-tag kind="default" closable text="Бета"></sf-tag><sf-tag kind="default" closable text="Гамма"></sf-tag></sf-tag-group>
<sf-tag-group id="tg-many" selection="many" selected-ids='["b","c"]' aria-label="Многие"><sf-tag kind="checkbox" key="a" text="А"></sf-tag><sf-tag kind="checkbox" key="b" text="Б"></sf-tag><sf-tag kind="checkbox" key="c" text="В"></sf-tag></sf-tag-group>
<sf-tag-group id="tg-one" selection="one" selected="y" aria-label="Один"><sf-tag kind="checkbox" key="x" text="Икс"></sf-tag><sf-tag kind="checkbox" key="y" text="Игрек"></sf-tag></sf-tag-group>
<sf-tag-group id="tg-bare" aria-label="Простые"><sf-tag text="Без вида"></sf-tag><sf-tag text="Второй"></sf-tag></sf-tag-group>
${formOf('fo-instant', {label: 'Параметры', apply: 'instant', fields: [field('title', 'Заголовок'), {key: 'flag', label: 'Флаг', propertyType: 'boolean'}]})}
${formOf('fo-press', {label: 'Карточка', fields: [field('name', 'Название', {required: true}), field('note', 'Заметка')], value: {name: 'Склад', note: 'Север'}})}
<div id="ring-smart"><sf-progress-ring value="62" size="2" aria-label="Готово"></sf-progress-ring></div>
<div class="sf-progress-ring sf-progress-ring--size-2" id="ring-old" style="--sf-progress-ring--value: 40"><span class="sf-progress-ring-indicator"></span></div>
<div class="sf-progress-ring sf-progress-ring--size-2" id="ring-new" style="--sf-progress-ring-value: 25"><span class="sf-progress-ring-indicator"></span></div>
<div id="scale-box"><sf-progress-scale id="scale" value="30" label="Загрузка"></sf-progress-scale></div>
<iframe id="sandboxed" sandbox="allow-scripts allow-same-origin" src="/frame-${theme}" style="inline-size:100%;block-size:420px;border:0"></iframe>
</body></html>`;
const frame = (theme) => `${head(theme)}<body style="margin:0;padding:16px;background:var(--sf-surface-0)">${counting}
${formOf('fo-frame', {label: 'Заявка', fields: [field('who', 'Имя', {required: true})]})}</body></html>`;
for (const theme of ['light', 'dark']) {
  pages.set(`/probe-${theme}`, main(theme));
  pages.set(`/frame-${theme}`, frame(theme));
}

const rows = [];
const browser = await chromium.launch({headless: true, channel: process.env.PROBE_CHANNEL || undefined, ignoreDefaultArgs: ['--hide-scrollbars']});
const frames = () => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle)));
try {
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (let load = 1; load <= LOADS; load += 1) {
    const page = await browser.newPage({viewport: {width, height: 2200}});
    const problems = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' || /Blocked form submission/u.test(message.text())) problems.push(`console ${message.type()}: ${message.text()}`);
    });
    const row = {width, theme, load, checks: {}, numbers: {}};
    const check = (name, pass, detail) => {
      row.checks[name] = Boolean(pass);
      if (detail !== undefined) row.numbers[name] = detail;
    };
    try {
      await page.goto(`${base}/probe-${theme}`, {waitUntil: 'load'});
      await page.waitForFunction(() => ['sf-tag', 'sf-tag-group', 'sf-form', 'sf-progress-ring', 'sf-progress-scale'].every((tag) => customElements.get(tag))
        && document.querySelectorAll('#tg-names sf-tag sf-button-close button, #tg-names sf-tag .sf-icon-button').length >= 4
        && document.querySelector('#fo-press .sf-form-submit button') && document.querySelector('#scale .sf-progress-scale-text'), null, {timeout: 30000});
      await page.evaluate(frames);
      await page.waitForTimeout(300);

      // TG-1
      const names = await page.evaluate(() => [...document.querySelectorAll('#tg-names > sf-tag')].map((tag) => tag.querySelector('sf-button-close button, .sf-icon-button')?.getAttribute('aria-label') ?? ''));
      check('TG-1 crosses named by their tags', JSON.stringify(names) === JSON.stringify(['Удалить Москва', 'Удалить Казань', 'Удалить Тверь', 'Убрать город']), names);

      // TG-2: the mouse on «Два»'s cross, then Enter on «Бета»'s.
      const cross = page.locator('#tg-click > sf-tag[text="Два"] sf-button-close button, #tg-click > sf-tag[text="Два"] .sf-icon-button').first();
      await cross.click();
      await page.waitForTimeout(250);
      const afterClick = await page.evaluate(() => ({removed: !document.querySelector('#tg-click > sf-tag[text="Два"]'), focus: document.activeElement?.closest('sf-tag')?.getAttribute('text') ?? document.activeElement?.localName}));
      check('TG-2 mouse: tag removed, focus on the neighbour', afterClick.removed && afterClick.focus === 'Три', afterClick);
      await page.locator('#tg-enter > sf-tag[text="Бета"] sf-button-close button, #tg-enter > sf-tag[text="Бета"] .sf-icon-button').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const afterEnter = await page.evaluate(() => ({removed: !document.querySelector('#tg-enter > sf-tag[text="Бета"]'), focus: document.activeElement?.closest('sf-tag')?.getAttribute('text') ?? document.activeElement?.localName}));
      check('TG-2 Enter: tag removed, focus on the neighbour', afterEnter.removed && afterEnter.focus === 'Гамма', afterEnter);

      // TG-3, TG-4
      const chosen = await page.evaluate(() => ({
        many: [...document.querySelectorAll('#tg-many > sf-tag[active]')].map((tag) => tag.getAttribute('key')),
        manyProperty: document.querySelector('#tg-many').selectedIds,
        one: [...document.querySelectorAll('#tg-one > sf-tag[active]')].map((tag) => tag.getAttribute('key')),
        bare: [...document.querySelectorAll('#tg-bare > sf-tag')].map((tag) => ({kind: tag.kind, pressed: Boolean(tag.querySelector('[aria-pressed]'))})),
      }));
      check('TG-3 selected-ids attribute chooses', JSON.stringify(chosen.many) === '["b","c"]' && JSON.stringify(chosen.manyProperty) === '["b","c"]', chosen.many);
      check('TG-3 selected attribute chooses', JSON.stringify(chosen.one) === '["y"]', chosen.one);
      check('TG-4 bare tag is plain in a group without selection', chosen.bare.every((tag) => tag.kind === 'default' && !tag.pressed), chosen.bare);

      // FF-1: selected-ids written after the row connected, as an attribute, then as a property.
      const later = async (how) => {
        await page.evaluate((how) => {
          const group = document.querySelector('#tg-many');
          if (how === 'attribute') group.setAttribute('selected-ids', '["a"]');
          else group.selectedIds = ['a', 'c'];
        }, how);
        await page.waitForTimeout(150);
        return page.evaluate(() => ({active: [...document.querySelectorAll('#tg-many > sf-tag[active]')].map((tag) => tag.getAttribute('key')), ids: document.querySelector('#tg-many').selectedIds}));
      };
      const byAttribute = await later('attribute');
      check('FF-1 selected-ids attribute written after load chooses', JSON.stringify(byAttribute.active) === '["a"]' && JSON.stringify(byAttribute.ids) === '["a"]', byAttribute);
      const byProperty = await later('property');
      check('FF-1 selectedIds property written after load chooses', JSON.stringify(byProperty.active) === '["a","c"]' && JSON.stringify(byProperty.ids) === '["a","c"]', byProperty);

      // FO-1: type «abc» into «Заголовок», leave with Tab; then tick «Флаг».
      await page.locator('#fo-instant [data-key="title"] input').first().click();
      await page.keyboard.type('abc', {delay: 30});
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      const typed = await page.evaluate(() => ({changes: window.seen['fo-instant']?.['sf-form-change'] ?? 0, value: window.seen['fo-instant']?.last?.['sf-form-change']?.value, inputs: window.seen['fo-instant']?.['sf-form-input'] ?? 0}));
      check('FO-1 one change for a typed edit', typed.changes === 1 && typed.value === 'abc', typed);
      const flag = page.locator('#fo-instant [data-key="flag"] input, #fo-instant [data-key="flag"] button[role="switch"], #fo-instant [data-key="flag"] [role="switch"]').first();
      await flag.click();
      await page.waitForTimeout(200);
      const ticked = await page.evaluate(() => ({changes: window.seen['fo-instant']?.['sf-form-change'] ?? 0, value: window.seen['fo-instant']?.last?.['sf-form-change']?.value}));
      check('FO-1 one change for a switch', ticked.changes === 2 && ticked.value === true, ticked);

      // FO-4: clear «Название», press straight on «Сохранить».
      const name = page.locator('#fo-press [data-key="name"] input').first();
      await name.click();
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await page.keyboard.press('Backspace');
      const button = page.locator('#fo-press .sf-form-submit button').first();
      await button.scrollIntoViewIfNeeded();
      const before = await button.boundingBox();
      const x = before.x + before.width / 2;
      const y = before.y + before.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(150);
      const held = await button.boundingBox();
      await page.mouse.up();
      await page.waitForTimeout(300);
      const pressed = await page.evaluate(() => ({invalid: window.seen['fo-press']?.['sf-form-invalid'] ?? 0, submit: window.seen['fo-press']?.['sf-form-submit'] ?? 0, fields: window.seen['fo-press']?.last?.['sf-form-invalid']?.fields}));
      const moved = Math.round((held.y - before.y) * 100) / 100;
      check('FO-4 button holds under the press', Math.abs(moved) < 0.5, moved);
      check('FO-4 the press lands (invalid, name)', pressed.invalid === 1 && JSON.stringify(pressed.fields) === '["name"]', pressed);
      // and a press made straight from a filled field saves.
      await name.click();
      await page.keyboard.type('Склад 2');
      const again = await button.boundingBox();
      await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const saved = await page.evaluate(() => ({submit: window.seen['fo-press']?.['sf-form-submit'] ?? 0, name: window.seen['fo-press']?.last?.['sf-form-submit']?.value?.name}));
      check('FO-4 a press from the field saves', saved.submit === 1 && saved.name === 'Склад 2', saved);

      // FO-2: the sandboxed frame without allow-forms.
      const inner = page.frameLocator('#sandboxed');
      const frameButton = inner.locator('#fo-frame .sf-form-submit button').first();
      await frameButton.waitFor({timeout: 20000});
      await frameButton.click();
      await page.waitForTimeout(250);
      await inner.locator('#fo-frame [data-key="who"] input').first().fill('Анна');
      await frameButton.click();
      await page.waitForTimeout(250);
      const sandboxed = await page.evaluate(() => {
        const seen = document.querySelector('#sandboxed').contentWindow.seen['fo-frame'] ?? {};
        return {invalid: seen['sf-form-invalid'] ?? 0, submit: seen['sf-form-submit'] ?? 0, who: seen.last?.['sf-form-submit']?.value?.who};
      });
      check('FO-2 sandboxed frame: invalid then submit', sandboxed.invalid === 1 && sandboxed.submit === 1 && sandboxed.who === 'Анна', sandboxed);

      // PR-1
      const rings = await page.evaluate(() => {
        const read = (element) => getComputedStyle(element).getPropertyValue('--sf-progress-ring--value').trim();
        const smart = document.querySelector('#ring-smart .sf-progress-ring');
        return {smart: read(smart), smartStyle: smart.getAttribute('style'), old: read(document.querySelector('#ring-old')), fresh: read(document.querySelector('#ring-new'))};
      });
      check('PR-1 the element writes the public name', /--sf-progress-ring-value:\s*62/u.test(rings.smartStyle) && Number(rings.smart) === 62, rings.smartStyle);
      check('PR-1 the former name still draws', Number(rings.old) === 40, rings.old);
      check('PR-1 the public name draws', Number(rings.fresh) === 25, rings.fresh);

      // PS-1: a value from the script, then resizes; and a fresh element.
      const errorsBefore = problems.length;
      await page.evaluate(() => {
        document.querySelector('#scale').value = 70;
        const made = document.createElement('sf-progress-scale');
        made.id = 'scale-made';
        made.setAttribute('value', '10');
        document.querySelector('#scale-box').append(made);
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        document.querySelector('#scale-made').value = 55;
      });
      await page.waitForTimeout(200);
      // A docs tab hides the example and shows it again; the frame then has
      // another width (a step of the size ladder).
      await page.evaluate(() => { document.querySelector('#scale-box').hidden = true; });
      await page.waitForTimeout(150);
      await page.evaluate(() => { document.querySelector('#scale-box').hidden = false; });
      await page.waitForTimeout(150);
      for (const step of [width - 60, width === 390 ? 1024 : 390, 768, width]) {
        await page.setViewportSize({width: step, height: 2200});
        await page.waitForTimeout(250);
      }
      // A drawing by the template (a docs frame's resize draws it; here a
      // new size): the text the patch wrote must still be the template's.
      await page.evaluate(() => {
        for (const id of ['#scale', '#scale-made']) document.querySelector(id).setAttribute('size', '2');
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        document.querySelector('#scale').value = 80;
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        for (const id of ['#scale', '#scale-made']) document.querySelector(id).setAttribute('size', '1');
      });
      await page.waitForTimeout(300);
      const scales = await page.evaluate(() => ['#scale', '#scale-made'].map((id) => {
        const texts = [...document.querySelectorAll(`${id} .sf-progress-scale-text`)];
        return {texts: texts.length, text: texts.map((one) => one.textContent.replace(/\s+/gu, ' ').trim()).join('|'), lit: document.querySelectorAll(`${id} .sf-progress-scale-block`).length};
      }));
      const typeErrors = problems.slice(errorsBefore).filter((one) => /TypeError/u.test(one));
      check('PS-1 no TypeError on resize', typeErrors.length === 0, typeErrors.length);
      check('PS-1 one text, the new value', scales[0].texts === 1 && /^80/u.test(scales[0].text) && scales[1].texts === 1 && /^55/u.test(scales[1].text), scales);
    } catch (error) {
      check('probe ran', false, String(error.message).split('\n')[0]);
    }
    row.problems = problems;
    check('console clean', problems.length === 0, problems.length);
    rows.push(row);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const names = [...new Set(rows.flatMap((row) => Object.keys(row.checks)))];
let red = 0;
for (const name of names) {
  const runs = rows.filter((row) => name in row.checks);
  const pass = runs.filter((row) => row.checks[name]).length;
  if (pass !== runs.length) red += 1;
  const sample = runs.find((row) => !row.checks[name]) ?? runs[0];
  console.log(`${pass === runs.length ? 'ok  ' : 'RED '} ${name}: ${pass}/${runs.length}${sample && name in sample.numbers ? `  ${JSON.stringify(sample.numbers[name])}${pass === runs.length ? '' : ` (${sample.width} ${sample.theme} #${sample.load})`}` : ''}`);
}
const problems = [...new Set(rows.flatMap((row) => row.problems))];
for (const one of problems.slice(0, 12)) console.log(`  problem: ${one.slice(0, 220)}`);
const total = rows.reduce((sum, row) => sum + Object.keys(row.checks).length, 0);
const passed = rows.reduce((sum, row) => sum + Object.values(row.checks).filter(Boolean).length, 0);
console.log(`forms-feedback-docs-gap: ${passed}/${total} checks over ${rows.length} loads, ${red} red`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
process.exitCode = red ? 1 : 0;
