#!/usr/bin/env node
// Browser acceptance for sf-composition-overlay: pure overlay, frames,
// toolbar, insertion points, keyboard, accessibility, stacking, scroll,
// remount, themes, widths and reduced motion.
// Usage: PLAYWRIGHT_MODULE=… node composition-overlay.browser.mjs <lab> <distr> <smart-root> <source> <output-dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, sourceUrl, outputDir] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = {};
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

async function open({ width = 1280, theme = 'light', dir = 'ltr', motion = 'no-preference' } = {}) {
  await page.emulateMedia({ reducedMotion: motion });
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, source: sourceUrl, theme, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}
const frame = () => page.waitForTimeout(80);
const events = () => page.evaluate(() => window.lab.events.map((entry) => ({ ...entry })));
const boxes = (id) => page.evaluate((id) => {
  const round = (box) => ({ left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) });
  const element = document.querySelector(`#canvas [data-sf-composition-id="${id}"]`);
  const selected = document.querySelector('.sf-composition-overlay-frame--selected');
  const toolbar = document.querySelector('.sf-composition-overlay-toolbar');
  return { element: round(element.getBoundingClientRect()), selected: selected.hidden ? null : round(selected.getBoundingClientRect()), toolbar: toolbar.hidden ? null : round(toolbar.getBoundingClientRect()), viewport: { width: innerWidth, height: innerHeight } };
}, id);
const canvasHtml = () => page.evaluate(() => document.getElementById('canvas').innerHTML);

await open();
const initialHtml = await canvasHtml();
check(initialHtml === await page.evaluate(() => window.lab.renderedHtml), 'canvas holds exactly the rendered Document HTML', null);

// Hover and click selection.
await page.locator('#canvas [data-sf-composition-id="main-lead"]').hover();
await frame();
const hover = await page.evaluate(() => { const hoverFrame = document.querySelector('.sf-composition-overlay-frame--hover'); return { hidden: hoverFrame.hidden, label: hoverFrame.textContent }; });
observations.hover = hover;
check(!hover.hidden && hover.label === 'Абзац main-lead', 'hover frame shows the node label', hover);
const hashBefore = await page.evaluate(() => location.hash);
await page.locator('#canvas [data-sf-composition-id="link-main"] a').click();
await frame();
let box = await boxes('link-main');
observations.selected = box;
check(await page.evaluate(() => location.hash) === hashBefore, 'clicking a link in the canvas selects instead of navigating', null);
check(Math.abs(box.selected.left - box.element.left) <= 1 && Math.abs(box.selected.width - box.element.width) <= 1, 'selected frame matches the node box', box);
check(box.toolbar && (box.toolbar.bottom <= box.element.top || box.toolbar.top >= box.element.bottom), 'toolbar sits outside the node content', box);
let recorded = await events();
check(recorded.at(-1)?.type === 'sf-composition-overlay-select' && recorded.at(-1).detail.node_id === 'link-main', 'select event names the node', recorded.at(-1));

// Toolbar action and insertion points.
await page.locator('.sf-composition-overlay-action[data-action="move-up"]').click();
recorded = await events();
check(recorded.at(-1)?.type === 'sf-composition-overlay-action' && recorded.at(-1).detail.action_id === 'move-up' && recorded.at(-1).detail.node_id === 'link-main', 'action event reports intent only', recorded.at(-1));
const insertions = await page.locator('.sf-composition-overlay-insert').count();
// link-main has four siblings in shell-main.default: five insertion points.
check(insertions === 5, 'insertion points between siblings and at the slot end', insertions);
await page.locator('.sf-composition-overlay-insert[data-index="3"]').click();
recorded = await events();
check(recorded.at(-1)?.type === 'sf-composition-overlay-insert' && JSON.stringify(recorded.at(-1).detail) === JSON.stringify({ parent_id: 'shell-main', slot: 'default', index: 3 }), 'insert event carries parent, slot and index', recorded.at(-1));
check(await page.locator('.sf-composition-overlay-insert[aria-pressed="true"]').count() === 1, 'chosen insertion point is marked', null);

// Keyboard navigation through the accessible tree.
await page.locator('#before').focus();
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tree'), 'Tab reaches the overlay tree', null);
const focusOutline = await page.evaluate(() => getComputedStyle(document.querySelector('.sf-composition-overlay-frame--selected')).outlineStyle);
check(focusOutline === 'solid', 'focused tree shows a visible focus state on the selected frame', focusOutline);
await page.keyboard.press('Home');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowDown');
const keyboardSelected = await page.evaluate(() => document.getElementById('overlay').selectedId);
// Tree order is depth-first: ArrowDown from shell-header reaches its first child.
check(keyboardSelected === 'site-title', 'Home, ArrowRight and ArrowDown move through the structure', keyboardSelected);
await page.keyboard.press('ArrowLeft');
check(await page.evaluate(() => document.getElementById('overlay').selectedId) === 'shell-header', 'ArrowLeft moves to the parent', null);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
check(await page.evaluate(() => document.activeElement?.dataset.action === 'move-up'), 'Enter moves focus to the toolbar', null);
await page.keyboard.press('ArrowRight');
check(await page.evaluate(() => document.activeElement?.dataset.action === 'move-down'), 'Arrow keys move within the toolbar', null);
await page.keyboard.press('Escape');
check(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tree'), 'Escape returns to the tree', null);
const snapshot = await page.locator('#overlay').ariaSnapshot();
observations.ariaSnapshot = snapshot.split('\n').slice(0, 8).join('\n');
check(snapshot.includes('tree "Структура страницы"') && snapshot.includes('treeitem "Область shell-header (Общий)"'), 'tree and badges are exposed to assistive technology', observations.ariaSnapshot);
const live = await page.locator('.sf-composition-overlay-live').textContent();
check(live.startsWith('Выбрано: Заголовок site-title, 1 из 2'), 'selection is announced with its position', live);
await page.keyboard.press('Escape');
check(await page.evaluate(() => document.getElementById('overlay').selectedId) === null, 'Escape in the tree clears the selection', null);

// Scroll: frames follow the node.
await page.locator('#canvas [data-sf-composition-id="footer-text"]').click();
await page.mouse.wheel(0, 300);
await page.waitForTimeout(700);
box = await boxes('footer-text');
check(Math.abs(box.selected.top - box.element.top) <= 1, 'selected frame follows scrolling', box);

// Stacking: a modal drawer covers the overlay.
await page.evaluate(() => document.getElementById('modal-drawer').open());
await page.waitForTimeout(400);
const stacking = await page.evaluate(() => {
  const toolbar = document.querySelector('.sf-composition-overlay-toolbar').getBoundingClientRect();
  const top = document.elementFromPoint(toolbar.left + toolbar.width / 2, toolbar.top + toolbar.height / 2);
  return { covered: Boolean(top?.closest('[data-sf-drawer-root]')) };
});
observations.stacking = stacking;
check(stacking.covered, 'modal drawer stacks above the overlay', stacking);
await page.evaluate(() => document.getElementById('modal-drawer').close());
await page.waitForTimeout(300);

// Pure overlay and remount.
const remount = await page.evaluate(async () => {
  const overlay = document.getElementById('overlay');
  for (let index = 0; index < 5; index += 1) { const canvas = document.getElementById('canvas'); overlay.remove(); canvas.before(overlay); }
  window.lab.events.length = 0;
  document.querySelector('#canvas [data-sf-composition-id="aside-text"]').click();
  await new Promise((done) => requestAnimationFrame(done));
  return { selects: window.lab.events.filter((entry) => entry.type === 'sf-composition-overlay-select').length, state: overlay.getAttribute('data-sf-overlay') };
});
observations.remount = remount;
check(remount.selects === 1 && remount.state === 'connected', 'remount keeps one subscription', remount);
check(await canvasHtml() === initialHtml, 'canvas HTML is byte-identical after all editor interaction', null);
const detached = await page.evaluate(() => { const overlay = document.getElementById('overlay'); overlay.remove(); return document.getElementById('canvas').innerHTML; });
check(detached === initialHtml, 'canvas HTML is byte-identical with the overlay removed', null);
await page.screenshot({ path: resolve(outputDir, 'overlay-wide-light.png') });

// Dark, narrow, RTL and reduced motion.
await open({ theme: 'dark', width: 390, dir: 'rtl', motion: 'reduce' });
await page.locator('#canvas [data-sf-composition-id="navigation-text"]').click();
await frame();
box = await boxes('navigation-text');
const view = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, transition: getComputedStyle(document.querySelector('.sf-composition-overlay-frame')).transitionDuration, toolbarBackground: getComputedStyle(document.querySelector('.sf-composition-overlay-toolbar')).backgroundColor }));
observations.narrowDarkRtl = { box, view };
check(view.scrollWidth <= view.viewport, 'narrow layout has no overflow', view);
check(box.toolbar && box.toolbar.left >= 0 && box.toolbar.left + box.toolbar.width <= view.viewport, 'toolbar stays inside a narrow viewport', box);
check(Math.abs((box.toolbar.left + box.toolbar.width) - (box.element.left + box.element.width)) <= 1 || box.toolbar.left === 0, 'RTL toolbar aligns to the inline start edge', box);
const target = await page.evaluate(() => { const r = document.querySelector('.sf-composition-overlay-insert').getBoundingClientRect(); return { height: Math.round(r.height), background: getComputedStyle(document.querySelector('.sf-composition-overlay-insert')).backgroundColor }; });
check(target.height >= 24, 'insertion targets keep a 24px hit area', target);
// Only the round mark takes the pointer: a point on the line away from the mark
// reaches the canvas, so a neighbouring block stays selectable.
const lineHit = await page.evaluate(() => {
  const button = document.querySelector('.sf-composition-overlay-insert:not([hidden])');
  const line = button.getBoundingClientRect(); const mark = button.querySelector('.sf-composition-overlay-insert-mark').getBoundingClientRect();
  const x = line.left + 8 < mark.left ? line.left + 8 : line.right - 8;
  const onLine = document.elementFromPoint(x, line.top + line.height / 2);
  const onMark = document.elementFromPoint(mark.left + mark.width / 2, mark.top + mark.height / 2);
  return { line: button.contains(onLine), mark: button.contains(onMark), markSize: Math.round(mark.width) };
});
check(!lineHit.line && lineHit.mark && lineHit.markSize >= 24, 'only the 24px mark of an insertion point takes the pointer', lineHit);
check(view.transition.split(',').every((value) => value.trim() === '0s'), 'reduced motion disables frame animation', view.transition);
await page.screenshot({ path: resolve(outputDir, 'overlay-narrow-dark-rtl.png') });
await open();
const lightBackground = await page.evaluate(() => { document.querySelector('#canvas [data-sf-composition-id="main-lead"]').click(); return new Promise((done) => requestAnimationFrame(() => done(getComputedStyle(document.querySelector('.sf-composition-overlay-toolbar')).backgroundColor))); });
check(lightBackground !== view.toolbarBackground, 'toolbar colors follow the theme tokens', { light: lightBackground, dark: view.toolbarBackground });

// The host removes the selected node: the overlay deselects it, announces the
// change and hides the toolbar and insertion places instead of leaving them behind.
const removal = await page.evaluate(async () => {
  const overlay = document.querySelector('sf-composition-overlay');
  const element = document.querySelector('#canvas [data-sf-composition-id="main-lead"]');
  const before = window.lab.events.length;
  element.remove();
  overlay.setDocument({ schema: 'simai.composition.document.v1', id: 'after-removal', profile: 'ui-layout', root: { id: 'shell', type: 'layout.section', slots: { default: [] } } });
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return {
    toolbarHidden: document.querySelector('.sf-composition-overlay-toolbar').hidden,
    insertions: document.querySelectorAll('.sf-composition-overlay-insert:not([hidden])').length,
    events: window.lab.events.slice(before),
  };
});
check(removal.toolbarHidden && removal.insertions === 0 && removal.events.some((entry) => entry.type === 'sf-composition-overlay-select' && entry.detail.node_id === null), 'removing the selected node clears selection, toolbar and insertion places', removal);
// Keyboard users who removed the node from the toolbar land on the tree, with the
// parent (here the first node of the new Document) selected.
await open();
const keyboardRemoval = await page.evaluate(async () => {
  const overlay = document.querySelector('sf-composition-overlay');
  document.querySelector('#canvas [data-sf-composition-id="main-lead"]').click();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  document.querySelector('.sf-composition-overlay-toolbar button').focus();
  const focusedBefore = document.activeElement.classList.contains('sf-composition-overlay-action');
  const before = window.lab.events.length;
  document.querySelector('#canvas [data-sf-composition-id="main-lead"]').remove();
  overlay.setDocument({ schema: 'simai.composition.document.v1', id: 'after-removal', profile: 'ui-layout', root: { id: 'shell', type: 'layout.section', slots: { default: [] } } });
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return { focusedBefore, focusOnTree: document.activeElement === document.querySelector('.sf-composition-overlay-tree'), events: window.lab.events.slice(before).map((entry) => entry.detail.node_id) };
});
check(keyboardRemoval.focusedBefore && keyboardRemoval.focusOnTree && JSON.stringify(keyboardRemoval.events) === '["shell"]', 'keyboard focus moves from the removed toolbar to the tree with the fallback node selected', keyboardRemoval);

await browser.close();
const screenshots = Object.fromEntries(['overlay-wide-light.png', 'overlay-narrow-dark-rtl.png'].map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'overlay-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 8) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
