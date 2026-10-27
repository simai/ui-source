#!/usr/bin/env node
// Browser acceptance for sf-sortable and overlay drops: mouse, touch and
// keyboard, list moves, library copy to the canvas, canvas node moves,
// refused changes, auto-scroll, announcements, remount and themes.
// Usage: PLAYWRIGHT_MODULE=… node composition-sortable.browser.mjs <lab> <distr> <smart-root> <source> <output-dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, sourceUrl, outputDir] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = {};
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const context = await browser.newContext({ hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

async function open({ width = 1280, theme = 'light', dir = 'ltr' } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, source: sourceUrl, theme, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}
const lab = () => page.evaluate(() => JSON.parse(JSON.stringify(window.lab)));
const order = (list) => page.evaluate((list) => [...document.querySelectorAll(`#${list} [data-sf-sortable-item]`)].map((item) => item.dataset.sfSortableItem), list);
const center = async (selector) => { const box = await page.locator(selector).first().boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }; };
async function mouseDrag(fromSelector, to, { steps = 12, hold = 0 } = {}) {
  const from = await center(fromSelector);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps });
  if (hold) await page.waitForTimeout(hold);
  const indicator = await page.evaluate(() => { const line = document.querySelector('.sf-sortable-indicator, .sf-composition-overlay-drop:not([hidden])'); return line && !line.hidden ? line.getBoundingClientRect().height : 0; });
  await page.mouse.up();
  await page.waitForTimeout(80);
  return indicator;
}

await open();

// The editor surfaces are Smart components fetched from the Smart root on demand.
const editorBundles = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\/smart\/(sortable|composition-overlay|inline-editor)\//u.test(name)).map((name) => name.replace(/^.*\/smart\//u, '')).sort());
observations.editorBundles = editorBundles;
check(['composition-overlay/css/composition-overlay.css', 'composition-overlay/js/composition-overlay.js', 'sortable/css/sortable.css', 'sortable/js/sortable.js'].every((file) => editorBundles.includes(file)), 'sortable and overlay load their own Smart JS and CSS', editorBundles);
check(!editorBundles.some((file) => file.startsWith('inline-editor/')), 'the inline editor is not fetched on a page without sf-inline-editor', editorBundles);
check(await page.evaluate(() => getComputedStyle(document.querySelector('sf-sortable')).display === 'block'), 'Smart sortable styles apply');
check(await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = '@layer sf.utilities { .lab-flex-probe { display: flex; } }';
  document.head.append(style);
  const list = document.querySelector('#list-b');
  list.classList.add('lab-flex-probe');
  const display = getComputedStyle(list).display;
  list.classList.remove('lab-flex-probe'); style.remove();
  return display === 'flex';
}), 'layout utilities apply to the sortable list itself');
check(await page.evaluate(() => typeof window.SF.CompositionOverlay?.overlayNodes === 'function' && window.SF.Sortable?.SORTABLE_STATE_EVENT === 'sf-sortable-state' && Boolean(window.__sfSortableSharedV1)), 'Smart bundles expose their browser API and one shared drag record');

// Mouse: reorder inside one list, via the handle.
const a2 = await center('[data-sf-sortable-item="a2"]');
let indicator = await mouseDrag('[data-sf-sortable-item="a1"] [data-sf-sortable-handle]', { x: a2.x, y: a2.box.y + a2.box.height - 4 });
let state = await lab();
check(indicator > 0, 'a visible drop indicator is shown while dragging', indicator);
check(JSON.stringify(state.intents.at(-1)) === JSON.stringify({ item: 'a1', from: 'list-a', to: 'list-a', index: 1, mode: 'move' }), 'reorder intent reports item, from, to and final index', state.intents.at(-1));
check(JSON.stringify(await order('list-a')) === '["a2","a1","a3"]', 'host applied the reorder', await order('list-a'));

// Mouse: move between lists of one group.
const aTop = await center('[data-sf-sortable-item="a2"]');
await mouseDrag('[data-sf-sortable-item="b1"]', { x: aTop.x, y: aTop.box.y + 3 });
state = await lab();
check(JSON.stringify(state.intents.at(-1)) === JSON.stringify({ item: 'b1', from: 'list-b', to: 'list-a', index: 0, mode: 'move' }), 'move between lists', state.intents.at(-1));

// Refused move leaves the page unchanged.
const beforeRefusal = await order('list-a');
const bList = await center('#list-b');
await mouseDrag('[data-sf-sortable-item="a3"] [data-sf-sortable-handle]', { x: bList.x, y: bList.box.y + 4 });
state = await lab();
check(state.refused.at(-1)?.item === 'a3' && JSON.stringify(await order('list-a')) === JSON.stringify(beforeRefusal), 'a refused move leaves the lists unchanged', state.refused.at(-1));

// Library copy onto the canvas at the marked point.
const htmlBefore = (await lab()).canvasHtml;
const lead = await center('#canvas [data-sf-composition-id="main-lead"]');
await mouseDrag('[data-sf-sortable-item="content.heading"]', { x: lead.x, y: lead.box.y + lead.box.height - 3 });
state = await lab();
const insert = state.overlay.at(-1);
observations.libraryDrop = insert;
check(insert?.type === 'sf-composition-overlay-insert' && insert.detail.parent_id === 'shell-main' && insert.detail.slot === 'default' && insert.detail.index === 1 && insert.detail.item === 'content.heading' && insert.detail.mode === 'copy', 'library item drops at the marked canvas point', insert);
check(JSON.stringify(await order('library')) === '["content.heading","content.paragraph"]', 'the library keeps its source item', await order('library'));
check((await lab()).canvasHtml !== htmlBefore && await page.locator('#canvas h2', { hasText: 'Новый заголовок' }).count() === 1, 'the host inserted the block and re-rendered', null);

// Canvas node move by dragging the selected label.
await page.locator('#canvas [data-sf-composition-id="aside-text"]').click();
await page.waitForTimeout(80);
const handle = await center('.sf-composition-overlay-frame--selected .sf-composition-overlay-label');
const target = await center('#canvas [data-sf-composition-id="main-lead"]');
await page.mouse.move(handle.x, handle.y);
await page.mouse.down();
await page.mouse.move(target.x, target.box.y + 3, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(80);
state = await lab();
observations.canvasMove = state.overlay.at(-1);
check(state.overlay.at(-1)?.type === 'sf-composition-overlay-move' && JSON.stringify(state.overlay.at(-1).detail) === JSON.stringify({ node_id: 'aside-text', parent_id: 'shell-main', slot: 'default', index: 0, ids: ['aside-text'], id: 'aside-text', parent: 'shell-main', position: 0 }), 'dragging a node label reports a move intent', state.overlay.at(-1));

// Releasing a node over itself is not a move.
const beforeSelf = (await lab()).overlay.length;
await page.locator('#canvas [data-sf-composition-id="main-lead"]').click();
await page.waitForTimeout(80);
const selfHandle = await center('.sf-composition-overlay-frame--selected .sf-composition-overlay-label');
const selfNode = await center('#canvas [data-sf-composition-id="main-lead"]');
await page.mouse.move(selfHandle.x, selfHandle.y);
await page.mouse.down();
await page.mouse.move(selfNode.x, selfNode.y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(80);
check((await lab()).overlay.length === beforeSelf, 'dropping a node on itself emits nothing', null);

// A library block reaches an empty slot by pointer, like the keyboard path.
const footer = await center('#canvas [data-sf-composition-id="shell-footer"]');
await mouseDrag('[data-sf-sortable-item="content.paragraph"]', { x: footer.x, y: footer.y });
state = await lab();
check(state.overlay.at(-1)?.type === 'sf-composition-overlay-insert' && JSON.stringify({ parent: state.overlay.at(-1).detail.parent_id, slot: state.overlay.at(-1).detail.slot, index: state.overlay.at(-1).detail.index }) === JSON.stringify({ parent: 'shell-footer', slot: 'default', index: 0 }), 'pointer drops into an empty slot', state.overlay.at(-1));

// Auto-scroll of the scroll container.
const scroller = await center('#scroller');
const beforeScroll = await page.evaluate(() => document.getElementById('scroller').scrollTop);
await mouseDrag('[data-sf-sortable-item="c0"]', { x: scroller.x, y: scroller.box.y + scroller.box.height - 4 }, { hold: 600 });
const afterScroll = await page.evaluate(() => document.getElementById('scroller').scrollTop);
observations.autoScroll = { beforeScroll, afterScroll };
check(afterScroll > beforeScroll, 'dragging near the edge auto-scrolls the container', observations.autoScroll);

// Keyboard: pick up, move, drop, and cancel.
await page.locator('[data-sf-sortable-item="a2"]').focus();
await page.keyboard.press('Space');
const picked = await page.locator('#list-a .sf-sortable-live').first().textContent();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Space');
state = await lab();
observations.keyboard = { picked, intent: state.intents.at(-1) };
check(picked.startsWith('Взято: Секция A2'), 'keyboard pick-up is announced', picked);
const politeness = await page.locator('#list-a .sf-sortable-live').first().getAttribute('aria-live');
check(politeness === 'polite', 'routine drag steps are announced politely, not assertively', politeness);
check(state.intents.at(-1).item === 'a2' && state.intents.at(-1).to === 'list-a' && state.intents.at(-1).mode === 'move', 'keyboard drop emits one intent', state.intents.at(-1));
const beforeCancel = state.intents.length;
await page.locator('[data-sf-sortable-item="b2"]').focus();
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('Escape');
check((await lab()).intents.length === beforeCancel, 'Escape cancels without an intent', null);
await page.locator('[data-sf-sortable-item="b2"]').focus();
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('Enter');
state = await lab();
check(state.intents.at(-1).item === 'b2' && state.intents.at(-1).from === 'list-b' && state.intents.at(-1).to === 'list-a', 'ArrowLeft moves to the previous list of the group', state.intents.at(-1));

// An abandoned keyboard move is cancelled by clicking elsewhere.
await page.locator('[data-sf-sortable-item="b1"]').focus();
await page.keyboard.press('Space');
await page.locator('#before').click();
const abandoned = await page.evaluate(() => ({ active: document.documentElement.hasAttribute('data-sf-sortable-active'), indicator: document.querySelector('.sf-sortable-indicator')?.hidden }));
check(!abandoned.active && abandoned.indicator !== false, 'clicking away cancels a keyboard move', abandoned);

// Keyboard: library block to the canvas.
await page.locator('[data-sf-sortable-item="content.paragraph"]').focus();
await page.keyboard.press('Space');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
state = await lab();
check(state.overlay.at(-1)?.type === 'sf-composition-overlay-insert' && state.overlay.at(-1).detail.item === 'content.paragraph', 'keyboard copies a library block onto a canvas place', state.overlay.at(-1));

// Keyboard: move a canvas node through the overlay tree.
await page.locator('#canvas [data-sf-composition-id="navigation-text"]').click();
await page.locator('.sf-composition-overlay-tree').focus();
await page.keyboard.press('Space');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
state = await lab();
check(state.overlay.at(-1)?.type === 'sf-composition-overlay-move' && state.overlay.at(-1).detail.node_id === 'navigation-text', 'keyboard moves a canvas node', state.overlay.at(-1));

// Touch: drag a handle with a real touch sequence.
await open();
const touchFrom = await center('[data-sf-sortable-item="a1"] [data-sf-sortable-handle]');
const touchTo = await center('[data-sf-sortable-item="a3"]');
const touchPoint = (x, y) => [{ x, y, id: 1 }];
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoint(touchFrom.x, touchFrom.y) });
for (let step = 1; step <= 10; step += 1) {
  const y = touchFrom.y + ((touchTo.box.y + touchTo.box.height - 4) - touchFrom.y) * step / 10;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoint(touchFrom.x, y) });
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(100);
state = await lab();
observations.touch = state.intents.at(-1);
check(state.intents.at(-1)?.item === 'a1' && state.intents.at(-1).index === 2, 'touch drag through a handle reorders', state.intents.at(-1));

// Remount: one drop still produces one intent.
await page.evaluate(() => { const list = document.getElementById('list-b'); const parent = list.parentNode; for (let index = 0; index < 5; index += 1) { list.remove(); parent.append(list); } });
const beforeRemount = (await lab()).intents.length;
const bTop = await center('[data-sf-sortable-item="b1"]');
await mouseDrag('[data-sf-sortable-item="b2"]', { x: bTop.x, y: bTop.box.y + 3 });
check((await lab()).intents.length === beforeRemount + 1, 'remount keeps one subscription', null);
check(await page.locator('.sf-sortable-live').count() === 8, 'live regions are not duplicated by remount', await page.locator('.sf-sortable-live').count());
await page.screenshot({ path: resolve(outputDir, 'sortable-light.png'), fullPage: true });

// Dark, narrow, RTL: keyboard still works and nothing overflows.
await open({ theme: 'dark', width: 390, dir: 'rtl' });
await page.locator('[data-sf-sortable-item="a1"]').focus();
await page.keyboard.press('Space');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Space');
state = await lab();
const narrow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }));
check(state.intents.at(-1)?.item === 'a1' && narrow.scrollWidth <= narrow.viewport, 'dark narrow RTL keyboard reorder without overflow', { intent: state.intents.at(-1), narrow });
await page.screenshot({ path: resolve(outputDir, 'sortable-narrow-dark-rtl.png'), fullPage: true });

await browser.close();
const screenshots = Object.fromEntries(['sortable-light.png', 'sortable-narrow-dark-rtl.png'].map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'sortable-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 8) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
