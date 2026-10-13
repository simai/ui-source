#!/usr/bin/env node
// Browser acceptance for declared Composition regions against built assets.
// Usage: PLAYWRIGHT_MODULE=/abs/playwright/index.mjs node composition-regions.browser.mjs \
//   <lab-url> <assets-url> <source-url> <output-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, sourceUrl, outputDir] = process.argv.slice(2);
if (!labUrl || !assetsUrl || !sourceUrl || !outputDir) throw new Error('usage: lab assets source output');
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

async function open({ width, theme = 'light', dir = 'ltr' }) {
  await page.setViewportSize({ width, height: 900 });
  const url = `${labUrl}?assets=${encodeURIComponent(assetsUrl)}&source=${encodeURIComponent(sourceUrl)}&theme=${theme}&dir=${dir}`;
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}

const boxes = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#host > .sf-composition-regions > .sf-composition-regions-grid > [data-sf-region]')]
  .map((element) => { const box = element.getBoundingClientRect(); return [element.getAttribute('data-sf-region'), { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), right: Math.round(box.right) }]; })));
const overflow = () => page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));

// Narrow, light, LTR: one column in DOM order.
await open({ width: 390 });
// A page that only renders a Document carries no editor code.
check(await page.evaluate(() => ['sf-sortable', 'sf-composition-overlay', 'sf-inline-editor'].every((tag) => !customElements.get(tag)) && !window.SF.Sortable && !window.SF.InlineEditor), 'Core alone defines no editor surfaces');
let b = await boxes();
observations.narrow = b;
const names = ['header', 'navigation', 'main', 'aside', 'footer'];
check(names.every((name) => b[name]), 'all declared regions are rendered', b);
check(names.every((name) => b[name].x === b.header.x && b[name].width === b.header.width), 'narrow container stacks every region in one column', b);
check(names.every((name, index) => index === 0 || b[name].y > b[names[index - 1]].y), 'narrow visual order equals DOM order', b);
let o = await overflow();
check(o.scrollWidth <= o.viewport, 'narrow layout has no horizontal overflow', o);
const grid = await page.evaluate(() => getComputedStyle(document.querySelector('#host .sf-composition-regions-grid')).gridTemplateColumns);
check(grid.split(' ').length === 1, 'narrow grid has one column', grid);
await page.screenshot({ path: resolve(outputDir, 'regions-narrow-light.png'), fullPage: true });

// Accessibility: landmarks and names come from semantic elements.
const landmarks = await page.evaluate(() => ({
  banner: document.querySelectorAll('header.sf-composition-region').length,
  navigation: [...document.querySelectorAll('nav.sf-composition-region')].map((element) => element.getAttribute('aria-label')),
  main: document.querySelectorAll('main').length,
  complementary: [...document.querySelectorAll('aside.sf-composition-region')].map((element) => element.getAttribute('aria-label')),
  region: [...document.querySelectorAll('section.sf-composition-region')].map((element) => element.getAttribute('aria-label')),
  contentinfo: document.querySelectorAll('footer.sf-composition-region').length,
}));
observations.landmarks = landmarks;
check(landmarks.banner === 1 && landmarks.main === 1 && landmarks.contentinfo === 1, 'one banner, main and contentinfo', landmarks);
check(new Set(landmarks.complementary).size === landmarks.complementary.length && landmarks.complementary.every(Boolean), 'repeated complementary regions have distinct names', landmarks);
check(landmarks.region.length === 1 && landmarks.region[0] === 'Сводка', 'named region landmark exposed', landmarks);
const snapshot = await page.locator('#host').ariaSnapshot();
observations.ariaSnapshot = snapshot;
for (const role of ['banner', 'navigation "Разделы"', 'main', 'complementary "Подсказки"', 'complementary "Факты"', 'region "Сводка"', 'contentinfo']) {
  check(snapshot.includes(`- ${role}`), `accessibility tree exposes ${role}`, null);
}

// Keyboard: Tab order follows declared region order.
await page.locator('#before').focus();
const order = [];
for (let index = 0; index < 5; index += 1) {
  await page.keyboard.press('Tab');
  order.push(await page.evaluate(() => document.activeElement?.closest('[data-sf-region]')?.getAttribute('data-sf-region') || null));
}
observations.tabOrder = order;
check(JSON.stringify(order) === JSON.stringify(['header', 'navigation', 'main', 'aside', 'footer']), 'Tab order follows declared regions', order);

// Wide, dark, LTR: start/center/end side by side, block rows span.
await open({ width: 1280, theme: 'dark' });
b = await boxes();
observations.wideDark = b;
check(b.navigation.y === b.main.y && b.main.y === b.aside.y, 'wide side-by-side regions share one row', b);
check(b.navigation.x < b.main.x && b.main.x < b.aside.x, 'wide LTR order is start, center, end', b);
check(b.header.width === b.footer.width && b.header.width > b.main.width + b.navigation.width, 'block regions span the full row', b);
check(b.footer.y > b.main.y, 'footer follows the side-by-side band', b);
o = await overflow();
check(o.scrollWidth <= o.viewport, 'wide dark layout has no horizontal overflow', o);
const colors = await page.evaluate(() => ({ html: document.documentElement.className, surface: getComputedStyle(document.querySelector('header.sf-composition-region')).backgroundColor, body: getComputedStyle(document.body).backgroundColor }));
observations.darkColors = colors;
check(colors.html === 'theme-dark', 'dark theme active', colors);
check(colors.surface === colors.body, 'sticky header uses the theme surface token', colors);
await page.screenshot({ path: resolve(outputDir, 'regions-wide-dark.png'), fullPage: false });
await page.setViewportSize({ width: 1280, height: 360 });
await page.mouse.move(640, 300);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(300);
const sticky = await page.evaluate(() => {
  const header = document.querySelector('header.sf-composition-region').getBoundingClientRect();
  const main = document.querySelector('main.sf-composition-region').getBoundingClientRect();
  const scroller = [document.scrollingElement, document.body].find((element) => element && element.scrollTop > 0);
  return { scrolled: Math.round(scroller?.scrollTop || 0), headerTop: Math.round(header.top), mainTop: Math.round(main.top) };
});
observations.stickyAfterScroll = sticky;
check(sticky.scrolled > 0 && sticky.mainTop < 0 && sticky.headerTop === 0, 'sticky header remains at the top while content scrolls under it', sticky);
await page.setViewportSize({ width: 1280, height: 900 });
await page.mouse.wheel(0, -5000);
const inner = await page.evaluate(() => {
  const summary = document.querySelector('[data-sf-region="summary"]').getBoundingClientRect();
  const facts = document.querySelector('[data-sf-region="facts"]').getBoundingClientRect();
  const container = document.querySelector('[data-sf-composition-id="main-inner"]').getBoundingClientRect();
  return { container: Math.round(container.width), sameRow: Math.round(summary.y) === Math.round(facts.y) };
});
observations.nestedLayout = inner;
check(inner.container < 768 ? !inner.sameRow : inner.sameRow, 'nested layout responds to its own container width, not the viewport', inner);

// Sparse packing: a later end region never moves above an earlier block.
const packing = await page.evaluate(async () => {
  const composition = await import(`${new URLSearchParams(location.search).get('assets')}/core/js/composition/index.mjs`);
  const region = (id, placement) => ({ id, type: 'layout.region', props: { name: id, landmark: 'none', placement }, slots: { default: [{ id: `${id}-t`, type: 'content.paragraph', data: { content: [{ type: 'text', value: id }] } }] } });
  const output = await composition.render({ schema: 'simai.composition.document.v1', id: 'packing', profile: 'ui-layout', root: { id: 'packing', type: 'layout.regions', slots: { regions: [region('s', 'start'), region('b', 'block'), region('e', 'end')] } } });
  const probe = document.createElement('div');
  probe.id = 'packing-probe';
  probe.innerHTML = output.html;
  document.getElementById('host').after(probe);
  const box = (name) => probe.querySelector(`[data-sf-region="${name}"]`).getBoundingClientRect();
  const result = { s: Math.round(box('s').top), b: Math.round(box('b').top), e: Math.round(box('e').top) };
  probe.remove();
  return result;
});
observations.packing = packing;
check(packing.s < packing.b && packing.b < packing.e, 'start, block, end keep DOM order vertically', packing);

// Wide, light, RTL: logical columns mirror.
await open({ width: 1280, dir: 'rtl' });
b = await boxes();
observations.wideRtl = b;
check(b.navigation.x > b.main.x && b.main.x > b.aside.x, 'RTL mirrors start and end columns', b);
check(b.navigation.y === b.main.y, 'RTL keeps the side-by-side band', b);
await page.screenshot({ path: resolve(outputDir, 'regions-wide-rtl.png'), fullPage: false });

// Remount: replacing the rendered HTML keeps a single, identical structure.
const remount = await page.evaluate(async () => {
  const host = document.getElementById('host');
  const html = host.innerHTML;
  for (let index = 0; index < 5; index += 1) { host.replaceChildren(); host.innerHTML = html; }
  return { same: host.innerHTML === html, layouts: host.querySelectorAll('.sf-composition-regions').length };
});
observations.remount = remount;
check(remount.same && remount.layouts === 2, 'remounted server HTML is identical and not duplicated', remount);

await browser.close();
const screenshots = Object.fromEntries(['regions-narrow-light.png', 'regions-wide-dark.png', 'regions-wide-rtl.png']
  .map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'regions-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 5) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
