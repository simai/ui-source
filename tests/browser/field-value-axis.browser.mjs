#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// One value axis for the fields (simai/ui-source#23, ui-mail visual audit):
// the value text of sf-input and of a one-row sf-textarea of the same size
// stands at the same place in its box, and where an sf-button's label stands.
// Measured on the rendered pixels, not on boxes: the boxes agreed while the
// glyphs did not. The input took the reset's height: 100% against its centred
// flex line, and with a height given the browser centred its text by the font's
// own line, a pixel below the line box -- at sizes 1/2 and 1 the input's value
// stood 1px under the textarea's and the button's.
// Here, at sizes 1/2, 1 and 2, bordered and filled, at device pixel ratio 1 and
// 2, light theme:
//   - the field boxes are the control height of the size (32, 40, 48);
//   - the first and last ink rows of the value are the same in sf-input and
//     sf-textarea, and the same as in an sf-button of the size;
//   - the first ink column of the value is the same in sf-input and
//     sf-textarea (the label axis the audit measured).
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/inputs/css/inputs.css', 'component/component/textarea/css/textarea.css',
  'component/component/buttons/css/buttons.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/buttons/js/buttons.js',
  'component/component/inputs/js/inputs.js', 'smart/smart/input/js/input.js',
  'component/component/textarea/js/textarea.js', 'smart/smart/textarea/js/textarea.js'];
const SIZES = {'1/2': 32, 1: 40, 2: 48};
const VALUE = 'ННН';

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();
try {
  for (const appearance of ['bordered', 'filled']) {
    for (const scale of [1, 2]) {
      const page = await browser.newPage({viewport: {width: 1100, height: 700}, deviceScaleFactor: scale});
      page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
      const body = Object.keys(SIZES).map((size) => `<div data-size="${size}" style="display:flex;gap:16px;align-items:flex-start;margin-block-end:16px">
        <sf-input size="${size}" appearance="${appearance}" value="${VALUE}" aria-label="Поле" style="inline-size:300px"></sf-input>
        <sf-textarea size="${size}" appearance="${appearance}" value="${VALUE}" rows="1" aria-label="Поле" style="inline-size:300px"></sf-textarea>
        <sf-button size="${size}" appearance="outline" scheme="on-surface" text="${VALUE}"></sf-button>
      </div>`).join('');
      // The caret would be ink too; it is hidden, nothing else is restyled.
      await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><style>* { caret-color: transparent !important; }</style></head><body style="margin:16px">${body}</body></html>`);
      for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
      for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
      await page.waitForFunction(() => document.querySelectorAll('sf-input input, sf-textarea textarea, sf-button button').length === 9);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      // The box that draws the field: the nearest element with a border or a fill.
      const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-size]')].flatMap((row) =>
        ['sf-input input', 'sf-textarea textarea', 'sf-button button'].map((selector) => {
          const field = row.querySelector(selector);
          let node = field;
          while (node) {
            const style = getComputedStyle(node);
            if (parseFloat(style.borderTopWidth) > 0 || style.backgroundColor !== 'rgba(0, 0, 0, 0)') break;
            node = node.parentElement;
          }
          const box = node.getBoundingClientRect();
          return {size: row.dataset.size, kind: selector.split(' ')[0], x: box.left, y: box.top, width: box.width, height: box.height};
        })));
      const rows = [];
      for (const box of boxes) {
        // Inside the edge, and the left four fifths: a textarea's resize grip is ink too.
        const shot = await page.screenshot({clip: {x: box.x + 2, y: box.y + 2, width: box.width - 4, height: box.height - 4}});
        const ink = await page.evaluate(async (data) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let left = Infinity; let top = Infinity; let bottom = -1;
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width * 0.8; x += 1) {
              const i = (y * canvas.width + x) * 4;
              if (pixels[i] < 128 && pixels[i + 1] < 128 && pixels[i + 2] < 128) {
                left = Math.min(left, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
              }
            }
          }
          return {left, top, bottom};
        }, shot.toString('base64'));
        rows.push({...box, left: ink.left / scale + 2, top: ink.top / scale + 2, bottom: (ink.bottom + 1) / scale + 2});
      }
      const key = `${appearance}@${scale}x`;
      evidence[key] = rows.map(({size, kind, height, left, top, bottom}) => ({size, kind, height, left, top, bottom}));
      for (const [size, height] of Object.entries(SIZES)) {
        const [input, textarea, button] = ['sf-input', 'sf-textarea', 'sf-button'].map((kind) => rows.find((row) => row.size === size && row.kind === kind));
        const at = (what) => `${key} size ${size}: ${what}`;
        check(at('the value has ink in every field'), [input, textarea, button].every((row) => Number.isFinite(row.top) && row.bottom > row.top), {input, textarea, button});
        check(at(`the field boxes are the control height (${height})`), input.height === height && textarea.height === height, {input, textarea});
        check(at('sf-input and sf-textarea values stand on the same rows'), input.top === textarea.top && input.bottom === textarea.bottom, {input, textarea});
        check(at('and on the rows of the sf-button label'), input.top === button.top && input.bottom === button.bottom, {input, button});
        check(at('sf-input and sf-textarea values start in the same column'), input.left === textarea.left, {input, textarea});
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIELD_VALUE_AXIS_OK');
