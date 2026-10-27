#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-accordion on the control ladder (simai/ui-source#19, ui-mail F5: in a
// narrow property panel the section headers were taller than the 32px fields
// under them). Measured on the built bytes, at 1440px (desktop steps) and 390px
// (mobile steps), for sizes 1/3, 1/2, 1, 2 and 3, filled, outline and flush,
// against an sf-input and an sf-button of the same size:
//   - the header (the trigger) is exactly the control height of the size: the
//     sf-button's height, and the sf-input's where the field has the size;
//   - the title takes the size's text: the sf-button label's font size and
//     line height;
//   - the chevron box is a line tall, and stands in the middle of the header;
//   - the content's text starts under the title (same inline padding);
//   - a long title wraps and the header grows, never shrinks below the step;
//   - an accordion without a size keeps the default look, and a nested one
//     without a size does not inherit its parent's;
//   - the legacy markup (the accordion is its own trigger) takes the size's
//     padding and text too.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/inputs/css/inputs.css', 'component/component/buttons/css/buttons.css',
  'component/component/accordion/css/accordion.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'component/component/inputs/js/inputs.js', 'smart/smart/input/js/input.js', 'component/component/accordion/js/accordion.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
// sf-input draws 1/2, 1 and 2; sf-button every step.
const INPUT_SIZES = new Set(['1/2', '1', '2']);
const APPEARANCES = ['', 'sf-accordion--outline', 'sf-accordion--flush'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const item = (size, appearance, title, nested = '') => `
  <article class="sf-accordion ${size ? `sf-accordion--size-${size}` : ''} ${appearance}" data-size="${size}" data-appearance="${appearance || 'filled'}">
    <h3 class="sf-accordion-heading">
      <button class="sf-accordion-trigger" type="button" aria-expanded="true">
        <span class="sf-accordion-title">${title}</span>
        <i class="sf-icon" aria-hidden="true">chevron_right</i>
      </button>
    </h3>
    <div class="sf-accordion-content" role="region"><span class="probe-text">Содержимое раздела</span>${nested}</div>
  </article>`;

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: 1000}});
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
    const rows = SIZES.map((size) => `<div class="row" data-row="${size}" style="display:flex;gap:16px;align-items:flex-start;margin-block-end:16px">
      <div style="inline-size:260px;display:grid;gap:8px">${APPEARANCES.map((appearance) => item(size, appearance, 'Раздел')).join('')}
        ${item(size, '', 'Очень длинное название раздела, которое не помещается в одну строку узкой панели')}</div>
      ${INPUT_SIZES.has(size) ? `<sf-input size="${size}" value="Поле" aria-label="Поле" style="inline-size:120px"></sf-input>` : ''}
      <sf-button size="${size}" appearance="outline" scheme="on-surface" text="Кнопка"></sf-button>
    </div>`).join('');
    const extra = `<div style="inline-size:260px">
      ${item('', '', 'Обычный')}
      ${item('1/2', 'sf-accordion--flush', 'Снаружи', item('', '', 'Вложенный'))}
      <article class="sf-accordion sf-accordion--size-1/2" data-legacy aria-expanded="false">
        <span class="sf-accordion-title">Старая разметка</span><i class="sf-icon" aria-hidden="true">chevron_right</i>
        <div class="sf-accordion-content hidden">Текст</div>
      </article>
    </div>`;
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">${rows}${extra}</body></html>`);
    for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
    for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
    await page.waitForFunction(() => customElements.get('sf-button') && customElements.get('sf-input')
      && document.querySelectorAll('sf-button button').length === 5 && document.querySelectorAll('sf-input input').length === 3);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    const measured = await page.evaluate(() => {
      const px = (value) => parseFloat(value);
      const read = (article) => {
        const trigger = article.querySelector(':scope > .sf-accordion-heading > .sf-accordion-trigger') || article;
        const title = trigger.querySelector(':scope > .sf-accordion-title');
        const icon = trigger.querySelector(':scope > .sf-icon');
        const content = article.querySelector(':scope > .sf-accordion-content > .probe-text');
        const t = trigger.getBoundingClientRect();
        const i = icon.getBoundingClientRect();
        const titleStyle = getComputedStyle(title);
        return {height: t.height, titleFont: px(titleStyle.fontSize), titleLine: px(titleStyle.lineHeight),
          icon: {width: i.width, height: i.height, font: px(getComputedStyle(icon).fontSize), middle: i.top + i.height / 2 - t.top},
          titleLeft: title.getBoundingClientRect().left, contentLeft: content ? content.getBoundingClientRect().left : null,
          padding: px(getComputedStyle(trigger).paddingTop)};
      };
      const rows = [...document.querySelectorAll('[data-row]')].map((row) => {
        const button = row.querySelector('sf-button button');
        const label = button.querySelector('.sf-button-text-container');
        const field = row.querySelector('sf-input .sf-input-field');
        const articles = [...row.querySelectorAll(':scope > div > .sf-accordion')];
        return {size: row.dataset.row, button: button.getBoundingClientRect().height,
          label: {font: px(getComputedStyle(label).fontSize), line: px(getComputedStyle(label).lineHeight)},
          input: field ? field.getBoundingClientRect().height : null,
          items: articles.map((article) => ({appearance: article.dataset.appearance,
            long: /длинное/u.test(article.textContent), ...read(article)}))};
      });
      const plain = read(document.querySelector('[data-size=""]'));
      const outer = document.querySelector('.sf-accordion--flush.sf-accordion--size-1\\/2:has(.sf-accordion)');
      const nested = read(outer.querySelector('.sf-accordion-content > .sf-accordion'));
      const legacy = read(document.querySelector('[data-legacy]'));
      const controlHalf = (() => { const probe = document.createElement('div'); probe.style.blockSize = 'var(--sf-ui-1\\/2--control-height)';
        document.body.append(probe); const h = probe.getBoundingClientRect().height; probe.remove(); return h; })();
      return {rows, plain, nested, legacy, controlHalf};
    });

    evidence[width] = measured.rows.map((row) => ({size: row.size, button: row.button, input: row.input,
      header: row.items.filter((entry) => !entry.long).map((entry) => entry.height), long: row.items.find((entry) => entry.long).height,
      title: [row.items[0].titleFont, row.items[0].titleLine], icon: row.items[0].icon.width}));
    evidence[`${width}:default`] = {plain: measured.plain.height, nested: measured.nested.height, legacy: measured.legacy.height};

    for (const row of measured.rows) {
      for (const entry of row.items) {
        const at = (what) => `${width}px size ${row.size} ${entry.appearance}${entry.long ? ' (long title)' : ''}: ${what}`;
        if (entry.long) {
          check(at('a long title wraps and the header grows'), entry.height > row.button + 1, {height: entry.height, button: row.button});
          continue;
        }
        check(at('the header is the sf-button height of the size'), near(entry.height, row.button), {height: entry.height, button: row.button});
        if (row.input !== null) check(at('and the sf-input height of the size'), near(entry.height, row.input), {height: entry.height, input: row.input});
        check(at('the title takes the size\'s text'), entry.titleFont === row.label.font && entry.titleLine === row.label.line, {title: [entry.titleFont, entry.titleLine], label: row.label});
        check(at('the chevron is a line tall'), near(entry.icon.width, entry.titleLine) && near(entry.icon.height, entry.titleLine), entry.icon);
        check(at('the chevron stands in the middle of the header'), near(entry.icon.middle, entry.height / 2, 0.5), {middle: entry.icon.middle, height: entry.height});
        check(at('the content text starts under the title'), near(entry.contentLeft, entry.titleLeft, 0.5), {content: entry.contentLeft, title: entry.titleLeft});
      }
    }
    check(`${width}px: an accordion without a size keeps its roomy header`, measured.plain.height > measured.controlHalf + 8, measured.plain);
    check(`${width}px: a nested accordion without a size does not inherit its parent's`, near(measured.nested.height, measured.plain.height), {nested: measured.nested, plain: measured.plain});
    const half = measured.rows.find((row) => row.size === '1/2');
    check(`${width}px: the legacy markup takes the size's padding and text`, near(measured.legacy.padding, half.items[0].padding)
      && measured.legacy.titleFont === half.label.font && measured.legacy.titleLine === half.label.line, {legacy: measured.legacy, sized: half.items[0]});
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('ACCORDION_SIZES_OK');
