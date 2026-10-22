#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A filled button keeps an edge in forced colours (simai/ui-source#25,
// ui-chat). The system paints every button's fill the same ButtonFace, so a
// default button with no border read as bare text next to an outline one. On
// the built bytes, with forcedColors 'active' and without, for default, tonal
// and outline at every size, enabled and disabled:
//   - forced colours: default and tonal draw a solid border at least a pixel
//     wide on every side, in a colour that is not transparent; the outline
//     button keeps its own;
//   - forced colours: every button is exactly as tall and as wide as the same
//     button without forced colours: the border is inside the control height;
//   - without forced colours: default and tonal still have no border.
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const APPEARANCES = ['default', 'tonal', 'outline'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const buttons = [];
for (const appearance of APPEARANCES) for (const size of SIZES) for (const disabled of [false, true]) {
  buttons.push(`<button type="button" ${disabled ? 'disabled' : ''} data-key="${appearance}|${size}|${disabled ? 'disabled' : 'enabled'}"
    class="sf-button sf-button--${appearance} sf-button--primary sf-button--size-${size}"><span class="sf-button-text-container">Отправить</span></button>`);
}

const browser = await chromium.launch();
try {
  const read = async (forcedColors) => {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    await page.emulateMedia({forcedColors});
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">${buttons.join('')}</div></body></html>`);
    await page.addStyleTag({content: readFileSync(join(out, 'core/core/css/core.css'), 'utf8')});
    await page.addStyleTag({content: readFileSync(join(out, 'component/component/buttons/css/buttons.css'), 'utf8')});
    await page.evaluate(() => document.fonts.ready);
    const measured = await page.evaluate(() => ({
      forced: matchMedia('(forced-colors: active)').matches,
      buttons: Object.fromEntries([...document.querySelectorAll('[data-key]')].map((button) => {
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return [button.dataset.key, {height: box.height, width: box.width,
          widths: ['Top', 'Right', 'Bottom', 'Left'].map((side) => parseFloat(style[`border${side}Width`])),
          styles: ['Top', 'Right', 'Bottom', 'Left'].map((side) => style[`border${side}Style`]),
          color: style.borderTopColor}];
      })),
    }));
    await page.close();
    return measured;
  };
  const forced = await read('active');
  const plain = await read('none');
  check('forced colours are active in the forced run', forced.forced === true);
  check('forced colours are off in the plain run', plain.forced === false);
  evidence.forced = Object.fromEntries(Object.entries(forced.buttons).filter(([key]) => key.endsWith('|1|enabled') || key.endsWith('|1|disabled')));
  evidence.plain = Object.fromEntries(Object.entries(plain.buttons).filter(([key]) => key.endsWith('|1|enabled')));

  for (const [key, button] of Object.entries(forced.buttons)) {
    const [appearance] = key.split('|');
    const without = plain.buttons[key];
    check(`forced ${key}: a solid border on every side`, button.widths.every((width) => width >= 1) && button.styles.every((style) => style === 'solid'), button);
    check(`forced ${key}: the border has a colour`, !/rgba\(0, 0, 0, 0\)|transparent/u.test(button.color), button);
    check(`forced ${key}: as tall as without forced colours`, Math.abs(button.height - without.height) <= 0.01, {forced: button.height, plain: without.height});
    check(`forced ${key}: as wide as without forced colours`, Math.abs(button.width - without.width) <= 0.01, {forced: button.width, plain: without.width});
    if (appearance !== 'outline') {
      check(`plain ${key}: no border without forced colours`, without.widths.every((width) => width === 0), without);
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('BUTTON_FORCED_COLORS_EDGE_OK');
