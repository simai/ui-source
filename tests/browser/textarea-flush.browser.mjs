#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The flush surface of sf-textarea (ui-chat's composer), measured on the built
// bytes. The field sits inside a composite control whose own box draws the
// border, the fill, the shadow and the focus; beside it a button. Here, at
// sizes 1/2, 1 and 2, for the Smart element (appearance="flush") and the
// ordinary markup (sf-textarea--flush, data-auto-grow, data-max-rows):
//   - the field draws no border, no background, no box shadow and no outline,
//     has no inline padding and no margin, and cannot be resized by hand;
//   - focus-visible on the field (keyboard focus) makes the wrapper match
//     :has(:focus-visible), and the field still draws no outline;
//   - one row is the control height of the size (the sibling sf-button's
//     height), its text stands where the button's text stands, and each further
//     row adds the size's line height up to max-rows, then the field scrolls;
//     deleting the text shrinks it back;
//   - the same with CSS field-sizing taken away, where the script sizes it.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/textarea/css/textarea.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'component/component/textarea/js/textarea.js', 'smart/smart/textarea/js/textarea.js'];
const SIZES = ['1/2', '1', '2'];
const MAX = 8;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();

// The composite: a bordered, filled box with a focus ring drawn on
// :has(:focus-visible), the field and a send button, aligned at the end.
const STYLE = `
  .composer { display: flex; align-items: flex-end; gap: 8px; inline-size: min(100%, 480px);
    border: 1px solid #888; border-radius: 12px; background: #f4f4f4; padding: 8px; margin-block-end: 16px; }
  .composer:has(:focus-visible) { outline: 2px solid #0057d9; outline-offset: 2px; }
  .composer > :first-child { flex: 1; min-inline-size: 0; }
`;

async function open(body, fallback) {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><style>${STYLE}</style></head><body style="margin:16px">${body}</body></html>`);
  if (fallback) {
    await page.evaluate(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => (/field-sizing/u.test(String(args[0])) ? false : supports(...args));
    });
    await page.addStyleTag({content: 'textarea { field-sizing: fixed !important; }'});
  }
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-textarea') && customElements.get('sf-button'));
  await page.waitForFunction(() => [...document.querySelectorAll('sf-textarea')].every((node) => node.querySelector('textarea')));
  await page.waitForTimeout(400);
  return page;
}

const MEASURE = `async (kind) => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const text = (n) => Array.from({length: n}, (_, i) => 'Строка ' + (i + 1)).join('\\n');
  const out = [];
  for (const row of document.querySelectorAll('[data-size]')) {
    const box = row.querySelector('.composer[data-kind="' + kind + '"]');
    const field = box.querySelector('textarea');
    const host = box.querySelector('sf-textarea');
    const write = (value) => { if (host) host.value = value; else field.value = value; };
    const style = getComputedStyle(field);
    const button = box.querySelector('sf-button > button');
    const result = {size: row.dataset.size, kind,
      root: [...field.closest('.sf-textarea').classList].filter((name) => name.startsWith('sf-textarea')),
      border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat),
      background: style.backgroundColor, shadow: style.boxShadow, outline: style.outlineStyle,
      padding: {top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom),
        start: parseFloat(style.paddingInlineStart), end: parseFloat(style.paddingInlineEnd)},
      margin: [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].map(parseFloat),
      radius: style.borderTopLeftRadius, resize: style.resize,
      line: parseFloat(style.lineHeight), font: parseFloat(style.fontSize),
      button: button.getBoundingClientRect().height,
      reference: (() => { const style = getComputedStyle(row.querySelector('[data-reference] textarea'));
        return {font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight), family: style.fontFamily}; })(),
      family: style.fontFamily};
    result.empty = field.getBoundingClientRect().height;
    // The text's first line against the button's text: the same middle.
    write('Строка');
    await frame();
    const fieldBox = field.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    result.textMiddle = fieldBox.top + result.padding.top + result.line / 2;
    result.buttonMiddle = buttonBox.top + buttonBox.height / 2;
    result.rows = [];
    for (let n = 1; n <= ${MAX} + 2; n += 1) {
      write(text(n));
      await frame();
      result.rows.push(field.getBoundingClientRect().height);
    }
    result.scrolls = field.scrollHeight > field.clientHeight + 1;
    write('');
    await frame();
    result.deleted = field.getBoundingClientRect().height;
    out.push(result);
  }
  return out;
}`;

try {
  for (const mode of ['css', 'fallback']) {
    const fallback = mode === 'fallback';
    const tolerance = fallback ? 0.5 : 0.01;
    const body = SIZES.map((size) => `<div data-size="${size}">
      <div class="composer" data-kind="smart">
        <sf-textarea size="${size}" appearance="flush" auto-grow max-rows="${MAX}" placeholder="Сообщение" aria-label="Сообщение"></sf-textarea>
        <sf-button size="${size}" icon="send" text="Отправить"></sf-button>
      </div>
      <sf-textarea data-reference size="${size}" rows="1" aria-label="Образец"></sf-textarea>
      <div class="composer" data-kind="plain">
        <label class="sf-textarea sf-textarea--size-${size} sf-textarea--flush flex flex-col">
          <textarea data-auto-grow data-max-rows="${MAX}" placeholder="Сообщение" aria-label="Сообщение"></textarea>
        </label>
        <sf-button size="${size}" icon="send" text="Отправить"></sf-button>
      </div>
    </div>`).join('');
    const page = await open(body, fallback);

    for (const kind of ['smart', 'plain']) {
      const rows = await page.evaluate(async ({source, kind}) => eval(source)(kind), {source: MEASURE, kind});
      evidence[`${mode}:${kind}`] = rows.map((row) => ({size: row.size, line: row.line, font: row.font, button: row.button,
        empty: row.empty, padding: row.padding, rows: row.rows.map((value) => Number(value.toFixed(2)))}));
      for (const row of rows) {
        const at = (what) => `${mode} ${kind} size ${row.size}: ${what}`;
        check(at('the root carries sf-textarea--flush'), row.root.includes('sf-textarea--flush'), row);
        check(at('no border'), row.border.every((width) => width === 0), row);
        check(at('no background'), row.background === 'rgba(0, 0, 0, 0)' || row.background === 'transparent', row);
        check(at('no box shadow'), row.shadow === 'none', row);
        check(at('no outline'), row.outline === 'none', row);
        check(at('no inline padding, no margin, no radius'), row.padding.start === 0 && row.padding.end === 0
          && row.margin.every((value) => value === 0) && row.radius === '0px', row);
        check(at('not resizable by hand'), row.resize === 'none', row);
        check(at('the text is on the ladder: the bordered field\'s font, line height and family'), row.font === row.reference.font
          && row.line === row.reference.line && row.family === row.reference.family, row);
        check(at('one row is the control height of the size (the button\'s)'), near(row.empty, row.button, tolerance) && row.empty > 0, row);
        check(at('block padding is (control height - line height) / 2'), near(row.padding.top, (row.button - row.line) / 2, 0.01)
          && row.padding.top === row.padding.bottom, row);
        check(at('the text stands where the button\'s text stands'), near(row.textMiddle, row.buttonMiddle, 0.5), row);
        row.rows.forEach((height, index) => {
          const n = Math.min(index + 1, MAX);
          const expected = row.empty + (n - 1) * row.line;
          check(at(`${index + 1} rows are one row + ${n - 1} line heights`), near(height, expected, tolerance), {height, expected});
        });
        check(at('past max-rows the field scrolls inside'), row.scrolls, row);
        check(at('deleting the text shrinks it back'), near(row.deleted, row.empty, tolerance), row);
      }
    }

    // Keyboard focus: the wrapper shows it, the field does not.
    for (const kind of ['smart', 'plain']) {
      const selector = `[data-size="1"] .composer[data-kind="${kind}"] textarea`;
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('Escape');
      await page.focus(selector);
      const focus = await page.evaluate((selector) => {
        const field = document.querySelector(selector);
        const box = field.closest('.composer');
        const style = getComputedStyle(field);
        return {focusVisible: field.matches(':focus-visible'), wrapper: box.matches(':has(:focus-visible)'),
          wrapperOutline: getComputedStyle(box).outlineStyle, outline: style.outlineStyle, shadow: style.boxShadow,
          border: parseFloat(style.borderTopWidth), background: style.backgroundColor};
      }, selector);
      evidence[`${mode}:${kind}:focus`] = focus;
      const at = (what) => `${mode} ${kind} focus: ${what}`;
      check(at('the field is focus-visible from the keyboard'), focus.focusVisible, focus);
      check(at('the wrapper matches :has(:focus-visible) and draws its ring'), focus.wrapper && focus.wrapperOutline === 'solid', focus);
      check(at('the field draws no ring, border, shadow or fill of its own'), focus.outline === 'none' && focus.shadow === 'none'
        && focus.border === 0 && (focus.background === 'rgba(0, 0, 0, 0)' || focus.background === 'transparent'), focus);
      // Hover and press add nothing either.
      await page.hover(selector);
      await page.mouse.down();
      const pressed = await page.evaluate((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return {border: parseFloat(style.borderTopWidth), background: style.backgroundColor, outline: style.outlineStyle};
      }, selector);
      await page.mouse.up();
      check(at('hover and press draw nothing'), pressed.border === 0 && pressed.outline === 'none'
        && (pressed.background === 'rgba(0, 0, 0, 0)' || pressed.background === 'transparent'), pressed);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TEXTAREA_FLUSH_OK');
