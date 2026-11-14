#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/,
// utility/ (a ui-builder output, or a pair's distr/).
//
// The contract of tools/first-paint/print.mjs (docs/developer/first-paint-print.md),
// over three components and a tag no build defines:
//
//   1. a Smart element with a printed snapshot (sf-badge, its example
//      «reference» as a page writes it): printed byte for byte as the
//      Framework's own snapshot, which it names, with the sheets that
//      snapshot lists;
//   2. a classic component (class markup, sf-kbd): no element to draw, its
//      markup is its own first paint; the page keeps it as written and lists
//      its component sheet;
//   3. attributes that change the box (sf-button size 1/2 and 2): each size
//      printed, and the printed markup with the printed sheets alone -- no
//      script -- has the box the drawn element has;
//   4. an unknown tag is reported, never printed, and stays in the page as
//      written; the page's own utilities (gap-2 on a wrapper) are in its sheets;
//   5. the output is the same on every run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureLocalPlaywright} from '../../scripts/playwright-local.mjs';
import {createPrinter} from '../../tools/first-paint/print.mjs';
import {describe, hostSpec, isDistribution, serveOutput, head, coreScript, PAGE_CONTEXT} from '../../scripts/first-paint-lib.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const smart = isDistribution(out) ? join(out, 'smart') : join(out, 'smart', 'smart');
ensureLocalPlaywright(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const {chromium} = await import('playwright');
const browser = await chromium.launch();
const printer = await createPrinter({distr: out, browser});
const failures = [];
const check = async (name, run) => {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').join('\n     ')}`);
  }
};

// The markup a page writes for an example: the host as hostSpec gives it.
const exampleMarkup = (component, example) => {
  const spec = hostSpec(component, example);
  const attributes = spec.attributes.map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)).join('');
  return `<${spec.tag}${attributes}>${spec.children}</${spec.tag}>`;
};

try {
  await check('1. a Smart element prints the Framework\'s own snapshot (sf-badge «reference»)', async () => {
    const badge = describe(smart, 'badge');
    const example = badge.examples.find((one) => one.name === 'reference');
    assert.ok(example, 'sf-badge has its example «reference»');
    const got = await printer.print(`<p>${exampleMarkup(badge, example)}</p>`, {id: 'badge', prefix: () => 'sf-badge-reference'});
    const [one] = got.elements;
    assert.equal(one.status, 'printed');
    const committed = readFileSync(join(smart, 'badge', 'static', 'default', 'reference.html'), 'utf8').replace(/^<!--[^\n]*-->\n/u, '').replace(/\n$/u, '');
    assert.equal(one.html, committed, 'byte for byte the committed snapshot');
    assert.equal(one.snapshot, 'smart/badge/static/default/reference.html');
    const listed = JSON.parse(readFileSync(join(smart, 'badge', 'static', 'sheets.json'), 'utf8')).examples.reference;
    // A utility sheet the Loader's idle scan asks for may come or not
    // (snapshot-first-paint.mjs sheetDrift); every other sheet is the same.
    const fixed = (list) => list.filter((sheet) => !sheet.startsWith('utility/'));
    assert.deepEqual(fixed(one.sheets), fixed(listed));
    assert.match(got.html, /^<p><sf-badge [^>]*>\n<span class="sf-badge [^"]*" data-sf-static>/u, 'the page holds the printed element in its place');
  });

  await check('2. a classic component is its own first paint, with its sheet (sf-kbd)', async () => {
    const markup = '<p>Нажмите <kbd class="sf-kbd">Ctrl</kbd> + <kbd class="sf-kbd">K</kbd></p>';
    const got = await printer.print(markup, {id: 'kbd'});
    assert.deepEqual(got.elements, [], 'no element to draw');
    assert.equal(got.html, markup, 'kept as written');
    assert.ok(got.sheets.includes('component/kbd/css/kbd.min.css'), got.sheets.join(', '));
    assert.ok(got.sheets.includes('core/css/core.css'));
  });

  await check('3. attributes that change the box: the printed box is the drawn box (sf-button size 1/2, 2)', async () => {
    const sizes = ['1/2', '2'];
    const markup = sizes.map((size) => `<sf-button size="${size}" text="Сохранить"></sf-button>`).join('\n');
    const got = await printer.print(markup, {id: 'button'});
    assert.equal(got.summary.printed, 2);
    got.elements.forEach((one, at) => assert.match(one.html, new RegExp(`class="sf-button sf-button--size-${sizes[at].replace('/', '\\/')} `, 'u')));
    // The printed page with its sheets and no script, against the drawn page.
    const printed = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">${got.sheets.map((sheet) => `<link rel="stylesheet" href="/distr/${sheet}">`).join('')}</head><body><main id="stage">${got.html}</main></body></html>`;
    const live = `${head({title: 'live'})}<body><main id="stage">${markup}</main>${coreScript}</body></html>`;
    const site = await serveOutput(out, {pages: new Map([['/printed', printed], ['/live', live]])});
    const boxes = async (path, drawn) => {
      const context = await browser.newContext(PAGE_CONTEXT);
      try {
        const page = await context.newPage();
        await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
        if (drawn) await page.waitForFunction(() => [...document.querySelectorAll('sf-button')].every((one) => one.isRendered === true), null, {timeout: 20000});
        await page.evaluate(() => document.fonts.ready);
        return await page.evaluate(() => [...document.querySelectorAll('sf-button > .sf-button')].map((one) => Math.round(one.getBoundingClientRect().height * 10) / 10));
      } finally {
        await context.close();
      }
    };
    try {
      const still = await boxes('/printed', false);
      const drawn = await boxes('/live', true);
      assert.equal(still.length, 2);
      assert.deepEqual(still, drawn, `printed ${still.join(', ')} px, drawn ${drawn.join(', ')} px`);
      assert.ok(still[0] < still[1], `size 1/2 is lower than size 2 (${still.join(' < ')})`);
    } finally {
      await site.close();
    }
  });

  await check('4. an unknown tag is reported and left as written; the page\'s own utilities are its sheets', async () => {
    const got = await printer.print('<div class="flex gap-2"><sf-no-such-element data-x="1">Текст</sf-no-such-element><sf-badge text="Один"></sf-badge></div>', {id: 'unknown'});
    assert.deepEqual(got.elements.map((one) => [one.tag, one.status]), [['sf-no-such-element', 'unknown'], ['sf-badge', 'printed']]);
    assert.match(got.elements[0].reason, /defines no <sf-no-such-element>/u);
    assert.equal(got.elements[0].html, undefined, 'nothing printed for it');
    assert.ok(got.html.includes('<sf-no-such-element data-x="1">Текст</sf-no-such-element>'), 'kept as the page wrote it');
    assert.ok(got.sheets.includes('utility/gap/default/css/default.min.css'), 'the wrapper\'s gap-2');
    assert.deepEqual(got.summary, {elements: 2, printed: 1, unknown: 1, failed: 0, nested: 0, snapshots: 0, textShownTwice: 0});
  });

  await check('5. the same output on every run', async () => {
    const page = '<div class="flex gap-2"><sf-badge text="Два" scheme="secondary"></sf-badge><sf-input-quantity value="1"></sf-input-quantity><sf-button size="1/2" text="Ок"></sf-button></div>';
    const first = JSON.stringify(await printer.print(page, {id: 'again'}));
    const second = JSON.stringify(await printer.print(page, {id: 'again'}));
    assert.equal(first, second);
  });
} finally {
  await printer.close();
  await browser.close();
}

if (failures.length) {
  console.error(`first-paint print: ${failures.length} failed`);
  process.exit(1);
}
console.log('first-paint print: 5 checks passed');
