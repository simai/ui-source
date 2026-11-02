#!/usr/bin/env node
// Browser acceptance for the inline editor's toolbar option (simai/ui-source#67):
// toolbar 'session' (the default) keeps the bar for the whole edit, over the
// element; 'selection' shows it only while text is selected and places it
// over the selection. Drives the inline editor lab
// (tests/fixtures/composition-inline-editor-lab.html).
// Usage: PLAYWRIGHT_MODULE=… node composition-inline-toolbar.browser.mjs <lab> <distr> <smart-root> <output-dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, outputDir] = process.argv.slice(2);
if (!labUrl || !assetsUrl || !smartUrl || !outputDir) throw new Error('The lab URL, the distr URL, the Smart URL and an output directory are required');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = {};
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

async function open({ width = 1280, theme = 'light', dir = 'ltr' } = {}) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, theme, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}

// Starts an edit on the body paragraph with the given toolbar option.
const start = (toolbar) => page.evaluate((mode) => {
  const element = document.querySelector('[data-sf-composition-id="body"]');
  const node = window.lab.model().root.slots.default.find((entry) => entry.id === 'body');
  window.lab.editor = window.SF.Composition.startInlineEdit(element, { content: node.data.content, nodeId: 'body', label: 'Абзац', ...(mode ? { toolbar: mode } : {}) });
}, toolbar);

// The bar, the edited element and the selected text, as the page lays them out.
// selectionchange is queued, not sent with the key press: two frames let the
// editor answer it before the page is measured.
const state = () => page.evaluate(async () => {
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const bar = document.querySelector('.sf-inline-editor-toolbar');
  if (!bar) return { bar: null };
  const rect = bar.getBoundingClientRect();
  const element = document.querySelector('[data-sf-composition-id="body"]').getBoundingClientRect();
  const selection = getSelection();
  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  const lines = range && !range.collapsed ? [...range.getClientRects()].filter((line) => line.width || line.height) : [];
  const selected = lines.length ? {
    top: Math.min(...lines.map((line) => line.top)), bottom: Math.max(...lines.map((line) => line.bottom)),
    left: Math.min(...lines.map((line) => line.left)), right: Math.max(...lines.map((line) => line.right)),
  } : null;
  return {
    bar: { mode: bar.dataset.sfToolbar, hidden: bar.hidden, display: getComputedStyle(bar).display, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width },
    element: { top: element.top, left: element.left, right: element.right },
    selected,
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    active: document.activeElement?.className || document.activeElement?.tagName,
    strong: document.querySelector('.sf-inline-editor-button--strong')?.getAttribute('aria-pressed'),
    linkOpen: document.querySelector('.sf-inline-editor-link') ? !document.querySelector('.sf-inline-editor-link').hidden : null,
  };
});
const visible = (value) => value.bar && !value.bar.hidden && value.bar.display !== 'none' && value.bar.width > 0;
const shiftLeft = async (count) => { for (let index = 0; index < count; index += 1) await page.keyboard.press('Shift+ArrowLeft'); };

await open();

// The default is unchanged: the bar for the whole edit, over the element.
await start(null);
let now = await state();
observations.session = now;
check(visible(now) && now.bar.mode === 'session', 'session (the default): the bar shows from the start of the edit', now);
check(now.bar.bottom <= now.element.top && Math.abs(now.bar.left - now.element.left) <= 1, 'session: the bar sits above the element at its inline start', now);
await page.keyboard.press('Escape');
check((await state()).bar === null, 'the bar leaves with the edit', null);

// selection: no bar while the caret only stands in the text.
await start('selection');
now = await state();
observations.selectionStart = now;
check(now.bar?.mode === 'selection' && !visible(now) && now.bar.display === 'none', 'selection: no bar while nothing is selected', now);
await page.keyboard.type(' и ещё');
now = await state();
check(!visible(now), 'selection: typing keeps the bar away', now);

// Selecting text shows the bar over the selection.
await shiftLeft(3);
now = await state();
observations.selected = now;
check(visible(now), 'selection: selecting text shows the bar', now);
if (visible(now) && now.selected) {
  const centre = (now.selected.left + now.selected.right) / 2;
  const barCentre = (now.bar.left + now.bar.right) / 2;
  check(now.bar.bottom <= now.selected.top && now.selected.top - now.bar.bottom <= 8, 'selection: the bar sits just above the selected text', now);
  check(Math.abs(barCentre - centre) <= 2 || now.bar.left === 0 || Math.abs(now.bar.right - now.viewport) <= 1, 'selection: the bar is centred on the selected text', { centre, barCentre });
  check(Math.abs(now.bar.left - now.element.left) > 4, 'selection: the bar follows the selection, not the element', now);
}

// The marks work from the bar and the keyboard while it shows.
await page.keyboard.press('ControlOrMeta+b');
now = await state();
check(visible(now) && now.strong === 'true', 'selection: a mark keeps the selection and the bar', now);
await page.locator('.sf-inline-editor-button--em').click();
let value = await page.evaluate(() => window.lab.editor.value());
check(JSON.stringify(value.at(-1)) === JSON.stringify({ type: 'text', value: 'ещё', marks: ['strong', 'em'] }), 'selection: a button of the bar applies its mark', value.at(-1));

// The link field keeps the bar while the selection sits in its input.
await page.keyboard.press('ControlOrMeta+k');
now = await state();
observations.link = now;
check(visible(now) && now.active === 'sf-inline-editor-url', 'selection: the link field opens in the bar and keeps it', now);
await page.keyboard.press('Escape');
now = await state();
check(visible(now) && now.active !== 'sf-inline-editor-url', 'selection: closing the link field returns to the selection, the bar stays', now);

// Collapsing the selection takes the bar away again.
await page.keyboard.press('ArrowRight');
now = await state();
check(!visible(now), 'selection: a collapsed selection hides the bar', now);
await page.keyboard.press('Enter');
check((await state()).bar === null, 'selection: the bar leaves with the edit', null);
const commit = await page.evaluate(() => window.lab.commits.at(-1));
check(commit?.id === 'body' && !(await page.evaluate(() => window.lab.refused || false)), 'selection: the edit commits and validates', commit);
await page.screenshot({ path: resolve(outputDir, 'inline-toolbar-wide-light.png') });

// An unknown mode is refused and leaves the element as it was.
const refused = await page.evaluate(() => {
  const element = document.querySelector('[data-sf-composition-id="body"]');
  const before = element.outerHTML;
  try {
    window.SF.Composition.startInlineEdit(element, { toolbar: 'always' });
    return { thrown: null };
  } catch (error) {
    return { thrown: error.message, same: element.outerHTML === before, bars: document.querySelectorAll('.sf-inline-editor-toolbar').length };
  }
});
check(refused.thrown === 'inline_toolbar_unknown: always' && refused.same && refused.bars === 0, 'an unknown toolbar mode is refused before anything is drawn', refused);

// Dark, narrow, RTL: the bar over a selection stays inside the viewport.
await open({ theme: 'dark', width: 390, dir: 'rtl' });
await start('selection');
await page.keyboard.press('ControlOrMeta+a');
now = await state();
observations.narrowDarkRtl = now;
check(visible(now) && now.bar.left >= 0 && now.bar.right <= now.viewport + 0.5 && now.scrollWidth <= now.viewport, 'selection: the bar fits a narrow viewport', now);
await page.screenshot({ path: resolve(outputDir, 'inline-toolbar-narrow-dark-rtl.png') });
await page.keyboard.press('Escape');

await browser.close();
const screenshots = Object.fromEntries(['inline-toolbar-wide-light.png', 'inline-toolbar-narrow-dark-rtl.png'].map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'inline-toolbar-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 8) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
