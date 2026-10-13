#!/usr/bin/env node
// Browser acceptance for the shared anchored-positioning contract (SF.Position):
// Dropdown (component and Smart) and Datepicker open below by default, flip
// above near the bottom, stay inside the viewport at the edges, align to the
// inline start in LTR and RTL, follow scrolling containers, survive transformed
// ancestors and modal dialogs, and cap their height on short viewports.
// Usage: PLAYWRIGHT_MODULE=… node position.browser.mjs <lab> <distr> <smart-root> <output-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, outputDir] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = [];
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

const widgets = {
  base: { open: '#base .sf-dropdown-field > button', field: '#base .sf-dropdown-field' },
  smart: { open: '#smart .sf-dropdown-field > button', field: '#smart .sf-dropdown-field' },
  date: { open: '#date input', field: '#date .sf-input-field' },
};

async function load({ width = 1280, height = 800, dir = 'ltr' } = {}) {
  await page.setViewportSize({ width, height });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}

// Places the widget according to the scenario, opens it and measures.
async function measure(id, scenario) {
  await page.evaluate(({ id, scenario }) => {
    const stage = document.getElementById('stage');
    const host = document.getElementById(id);
    stage.style.cssText = '';
    for (const other of stage.children) other.style.display = other !== host && other.id !== 'scroller' ? 'none' : '';
    if (scenario === 'bottom') stage.style.top = `${innerHeight - 80}px`;
    else stage.style.top = '8px';
    if (scenario === 'edge') stage.style.justifyContent = 'flex-end';
    if (scenario === 'transform') stage.style.transform = 'translateZ(0)';
    if (scenario === 'scroll') {
      const scroller = document.createElement('div'); scroller.id = 'scroller';
      const inner = document.createElement('div'); inner.id = 'scroller-inner';
      scroller.append(inner); stage.append(scroller); inner.append(host);
    }
    if (scenario === 'dialog') {
      const dialog = document.getElementById('dialog');
      document.getElementById('dialog-slot').append(host); dialog.showModal();
    }
  }, { id, scenario });
  await page.waitForTimeout(150);
  // A direct activation avoids pointer actionability heuristics inside nested fixed containers.
  await page.evaluate((selector) => document.querySelector(selector).click(), widgets[id].open);
  await page.waitForTimeout(250);
  const read = () => page.evaluate(({ id, fieldSelector }) => {
    const host = document.getElementById(id);
    const field = host.querySelector(fieldSelector.split(', ').map((part) => part.replace(`#${id} `, '')).join(', '));
    const panel = id === 'date'
      ? host.refs?.datePickerPanel?.value
      : [...document.querySelectorAll('.sf-list')].find((list) => !list.hidden && list.getClientRects().length && (host.contains(list) || list.matches(':popover-open')));
    if (!panel || !field) return { missing: true };
    const f = field.getBoundingClientRect(); const p = panel.getBoundingClientRect();
    const x = p.left + p.width / 2; const y = p.top + Math.min(p.height / 2, 20);
    const top = document.elementFromPoint(x, y);
    return {
      field: { left: f.left, right: f.right, top: f.top, bottom: f.bottom, width: f.width },
      panel: { left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width, height: p.height },
      viewport: { width: document.documentElement.clientWidth, height: innerHeight },
      visible: Boolean(top && panel.contains(top)),
      scrollable: panel.scrollHeight > panel.clientHeight + 1 || [...panel.querySelectorAll('*')].some((node) => node.scrollHeight > node.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY)),
      side: panel.dataset.sfSide || null,
    };
  }, { id, fieldSelector: widgets[id].field });
  return read;
}

function assertGeometry(label, m, { expectSide, dir, width }) {
  check(!m.missing, `${label}: panel found`, m);
  if (m.missing) return;
  observations.push({ label, ...m });
  const slack = 1;
  check(m.panel.left >= -slack && m.panel.right <= m.viewport.width + slack && m.panel.top >= -slack && m.panel.bottom <= m.viewport.height + slack, `${label}: panel stays inside the viewport`, m);
  if (expectSide === 'block-end') check(m.panel.top >= m.field.bottom - slack, `${label}: panel opens below the field`, m);
  if (expectSide === 'block-start') check(m.panel.bottom <= m.field.top + slack, `${label}: panel flips above the field`, m);
  check(m.visible, `${label}: panel is the topmost element at its centre`, m);
  // Alignment applies when both the field and the panel fit on screen; otherwise the panel is shifted.
  const aligned = dir === 'rtl' ? m.field.right - m.panel.width : m.field.left;
  const fits = m.field.left >= 0 && m.field.right <= m.viewport.width && aligned >= 8 - 1 && aligned + m.panel.width <= m.viewport.width - 8 + 1;
  if (fits && !label.includes('edge')) {
    if (dir === 'rtl') check(Math.abs(m.panel.right - m.field.right) <= 2, `${label}: panel aligns to the inline start (right) in RTL`, m);
    else check(Math.abs(m.panel.left - m.field.left) <= 2, `${label}: panel aligns to the inline start (left) in LTR`, m);
  }
}

const naturalWidth = {};
for (const width of [1280, 390]) {
  for (const dir of ['ltr', 'rtl']) {
    for (const id of Object.keys(widgets)) {
      for (const [scenario, expectSide] of [['top', 'block-end'], ['bottom', 'block-start'], ['edge', null], ['transform', 'block-end'], ['dialog', null]]) {
        await load({ width, dir });
        const read = await measure(id, scenario);
        const m = await read();
        assertGeometry(`${id} ${scenario} ${dir} ${width}`, m, { expectSide, dir, width });
        // Near the inline edge the panel is shifted, never squeezed.
        if (!m.missing && scenario === 'top') naturalWidth[`${id} ${dir} ${width}`] = m.panel.width;
        if (!m.missing && scenario === 'edge') check(Math.abs(m.panel.width - naturalWidth[`${id} ${dir} ${width}`]) <= 2, `${id} edge ${dir} ${width}: panel keeps its width at the viewport edge`, { m, natural: naturalWidth[`${id} ${dir} ${width}`] });
      }
      // Scrolling container: the panel follows its field.
      await load({ width, dir });
      const read = await measure(id, 'scroll');
      const before = await read();
      await page.evaluate(() => { document.getElementById('scroller').scrollTop = 30; });
      await page.waitForTimeout(250);
      const after = await read();
      if (!before.missing && !after.missing) {
        const gapBefore = before.panel.top - before.field.bottom; const gapAfter = after.panel.top - after.field.bottom;
        check(Math.abs(gapBefore - gapAfter) <= 2 && Math.abs(after.field.top - before.field.top) > 10, `${id} scroll ${dir} ${width}: panel follows the scrolled field`, { before, after });
      } else check(false, `${id} scroll ${dir} ${width}: panel found`, { before, after });
    }
  }
}

// Short viewport: the height is capped and the panel scrolls instead of overflowing.
for (const id of ['base', 'smart', 'date']) {
  await load({ width: 1280, height: 220 });
  const read = await measure(id, 'top');
  const m = await read();
  check(!m.missing && m.panel.bottom <= m.viewport.height + 1 && m.panel.top >= -1, `${id} short viewport: panel fits the viewport height`, m);
  if (id !== 'date') check(!m.missing && m.scrollable, `${id} short viewport: capped list scrolls`, m);
  await page.screenshot({ path: resolve(outputDir, `short-${id}.png`) });
}

// A stylesheet max-width stays the cap: the helper's inline max-width only tightens it.
for (const dir of ['ltr', 'rtl']) {
  await load({ width: 1280, dir });
  const capped = await page.evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = '#cap-panel{position:fixed;inline-size:100%;max-inline-size:240px;block-size:40px;background:Canvas}';
    document.head.append(style);
    const reference = document.createElement('button');
    reference.textContent = 'Cap';
    reference.style.cssText = 'position:fixed;top:40px;left:300px';
    const panel = document.createElement('div');
    panel.id = 'cap-panel';
    document.body.append(reference, panel);
    const controller = window.SF.Position.anchor(reference, panel, {autoUpdate: false});
    await controller.update();
    const width = panel.getBoundingClientRect().width;
    controller.stop();
    const restored = panel.style.maxWidth;
    reference.remove(); panel.remove(); style.remove();
    return {width, restored};
  });
  check(capped.width <= 241 && capped.width >= 239 && capped.restored === '', `stylesheet max-width cap kept (${dir})`, capped);
}

await load({ width: 1280, dir: 'rtl' });
await (await measure('date', 'bottom'))();
await page.screenshot({ path: resolve(outputDir, 'datepicker-rtl-flipped.png') });

await browser.close();
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, cases: observations.length };
writeFileSync(resolve(outputDir, 'position-browser.json'), `${JSON.stringify({ ...result, observations }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures: failures.slice(0, 8), failureCount: failures.length, errors: errors.slice(0, 5) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
