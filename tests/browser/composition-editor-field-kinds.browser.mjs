#!/usr/bin/env node
// Browser acceptance for editor field kinds: server fallback form, keyboard,
// accessibility tree, validation feedback, save to preview, themes and widths.
// Usage: PLAYWRIGHT_MODULE=/abs/playwright/index.mjs node
//   composition-editor-field-kinds.browser.mjs <lab-url> <distr-url> <source-url> <output-dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, sourceUrl, outputDir] = process.argv.slice(2);
if (!labUrl || !assetsUrl || !sourceUrl || !outputDir) throw new Error('usage: lab distr source output');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });

const failures = [];
const errors = [];
const observations = {};
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

async function open({ width = 1280, theme = 'light', dir = 'ltr' } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, source: sourceUrl, theme, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}
const status = () => page.locator('#status').textContent();
const aside = () => page.evaluate(() => {
  const element = document.querySelector('#preview [data-sf-region="aside"]');
  return { placement: element.getAttribute('data-sf-region-placement'), sticky: element.hasAttribute('data-sf-region-sticky'), label: element.getAttribute('aria-label') };
});

await open({ width: 390 });
const snapshot = await page.locator('#editor').ariaSnapshot();
observations.ariaSnapshot = snapshot;
for (const expected of ['combobox "Расположение области"', 'textbox "Доступное название"', 'group']) {
  check(snapshot.includes(expected), `accessibility tree exposes ${expected}`, null);
}
const described = await page.evaluate(() => [...document.querySelectorAll('.sf-editor-field-control')].map((control) => ({
  name: control.name, describedBy: document.getElementById(control.getAttribute('aria-describedby'))?.textContent || null, label: control.labels?.[0]?.textContent || null,
})));
observations.controls = described;
check(described.length === 4 && described.every((entry) => entry.describedBy && entry.label), 'every control has a label and a localized description', described);
check(await page.locator('input[role="switch"]').count() === 1, 'toggle is a native switch', null);
check(await page.locator('details.sf-editor-field-disclosure').count() === 2, 'advanced fields are collapsed by default', null);
let overflow = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
check(overflow.scrollWidth <= overflow.viewport, 'narrow form has no horizontal overflow', overflow);
await page.screenshot({ path: resolve(outputDir, 'fields-narrow-light.png'), fullPage: true });

// Keyboard-only editing: text, disclosure, switch, then save.
await page.locator('#before').focus();
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.name === 'shell-aside.props.placement'), 'Tab reaches the first field', null);
await page.keyboard.press('Tab');
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.type('Похожие товары');
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.tagName === 'SUMMARY'), 'Tab reaches the collapsed landmark disclosure', null);
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.tagName === 'SUMMARY'), 'Tab reaches the collapsed sticky disclosure', null);
await page.keyboard.press('Enter');
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'switch'), 'Tab reaches the switch after opening', null);
const focusRing = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
observations.focusRing = focusRing;
check(focusRing !== 'none', 'focused switch shows a visible focus ring', focusRing);
await page.keyboard.press('Space');
check(await page.locator('input[role="switch"]').isChecked(), 'Space turns the switch on', null);
await page.locator('#save').focus();
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.getElementById('status').textContent.length > 0);
check(await status() === 'Сохранено', 'keyboard save succeeds', await status());
let preview = await aside();
observations.afterSave = preview;
check(preview.sticky && preview.label === 'Похожие товары' && preview.placement === 'end', 'preview reflects text and toggle fields', preview);
check(await page.evaluate(() => document.activeElement?.id === 'save'), 'focus stays on the save control', null);

// Owner validation refuses a placement that breaks the declared visual order.
await page.locator('select[name="shell-aside.props.placement"]').selectOption('start');
await page.locator('#save').click();
await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Ошибка'));
check((await status()).includes('region_order_invalid'), 'invalid placement is refused with the owner code', await status());
check(JSON.stringify(await aside()) === JSON.stringify(preview), 'refused edit does not change the preview', await aside());

// Field validation refuses a label longer than 120 code points.
await page.locator('select[name="shell-aside.props.placement"]').selectOption('end');
await page.evaluate(() => { document.querySelector('[name="shell-aside.props.label"]').value = 'я'.repeat(121); });
await page.locator('#save').click();
await page.waitForFunction(() => document.getElementById('status').textContent.includes('field_value_length'));
check(await page.locator('[name="shell-aside.props.label"]').getAttribute('aria-invalid') === 'true', 'invalid text is marked aria-invalid', null);

// Unset: clearing the switch removes the key and restores the earlier digest.
await page.evaluate(() => { document.querySelector('[name="shell-aside.props.label"]').value = 'Подсказки'; });
await page.locator('input[role="switch"]').uncheck();
await page.locator('#save').click();
await page.waitForFunction(() => document.getElementById('status').textContent === 'Сохранено' && window.labSaves === 2);
const digests = await page.evaluate(async () => {
  const composition = await import(`${new URLSearchParams(location.search).get('assets')}/core/js/composition/index.mjs`);
  const original = await fetch(`${new URLSearchParams(location.search).get('source')}/tests/fixtures/composition/regions.json`).then((response) => response.json());
  return { current: window.labDigest, original: (await composition.normalize(original)).digest };
});
observations.digests = digests;
check(digests.current === digests.original, 'unchecking the toggle returns to the never-set digest', digests);

// Dark and RTL: tokens change and nothing overflows.
await open({ width: 1280, theme: 'dark', dir: 'rtl' });
const themed = await page.evaluate(() => {
  const control = document.querySelector('.sf-editor-field-control[type="text"]');
  const style = getComputedStyle(control);
  return { background: style.backgroundColor, color: style.color, dir: control.getAttribute('dir'), scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth };
});
await open({ width: 1280 });
const light = await page.evaluate(() => {
  const style = getComputedStyle(document.querySelector('.sf-editor-field-control[type="text"]'));
  return { background: style.backgroundColor, color: style.color };
});
observations.themes = { dark: themed, light };
check(themed.background !== light.background && themed.color !== light.color, 'dark theme changes field colors through tokens', observations.themes);
check(themed.dir === 'auto' && themed.scrollWidth <= themed.viewport, 'RTL wide form keeps dir=auto and no overflow', themed);
await open({ width: 1280, theme: 'dark', dir: 'rtl' });
await page.screenshot({ path: resolve(outputDir, 'fields-wide-dark-rtl.png'), fullPage: true });

// Remount: re-rendering the fallback keeps one set of controls.
const remount = await page.evaluate(() => {
  const fields = document.getElementById('fields');
  const html = fields.innerHTML;
  for (let index = 0; index < 5; index += 1) { fields.replaceChildren(); fields.innerHTML = html; }
  return { same: fields.innerHTML === html, controls: fields.querySelectorAll('.sf-editor-field-control').length };
});
check(remount.same && remount.controls === 4, 'remounted fallback form is identical', remount);

await browser.close();
const screenshots = Object.fromEntries(['fields-narrow-light.png', 'fields-wide-dark-rtl.png']
  .map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'field-kinds-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 8) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
