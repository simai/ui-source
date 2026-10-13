#!/usr/bin/env node
// Browser acceptance for docked sf-drawer: page space reservation on both
// sides, RTL, narrow fallback, keyboard, accessibility and remount.
// Usage: PLAYWRIGHT_MODULE=… node drawer-docked.browser.mjs <lab> <distr> <smart-root> <source> <output-dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, sourceUrl, outputDir] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = {};
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

async function open({ width = 1280, theme = 'light', dir = 'ltr', motion = 'no-preference' } = {}) {
  await page.emulateMedia({ reducedMotion: motion });
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, source: sourceUrl, theme, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}
const settle = () => page.waitForTimeout(450);
const measure = () => page.evaluate(() => {
  const host = getComputedStyle(document.getElementById('page'));
  const panel = (id) => {
    const element = document.querySelector(`[data-sf-drawer-id="${id}"] [data-sf-drawer-panel]`);
    const box = element.getBoundingClientRect();
    return { left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width), role: element.getAttribute('role'), label: element.getAttribute('aria-label'), modal: element.getAttribute('aria-modal'), inert: element.inert };
  };
  const text = document.getElementById('page-text').getBoundingClientRect();
  return {
    paddingStart: host.paddingInlineStart, paddingEnd: host.paddingInlineEnd,
    library: panel('library'), settings: panel('settings'),
    text: { left: Math.round(text.left), right: Math.round(text.right) },
    viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    overlays: [...document.querySelectorAll('[data-sf-drawer-overlay]')].filter((element) => getComputedStyle(element).display !== 'none').length,
    locked: getComputedStyle(document.documentElement).overflow === 'hidden',
    vars: [getComputedStyle(document.documentElement).getPropertyValue('--sf-drawer-dock-inline-start').trim(), getComputedStyle(document.documentElement).getPropertyValue('--sf-drawer-dock-inline-end').trim()],
  };
});

await open();
let m = await measure();
check(m.paddingStart === '0px' && m.paddingEnd === '0px', 'closed docked drawers reserve nothing', m);
await page.locator('#open-library').click();
await settle();
m = await measure();
observations.libraryOpen = m;
check(m.paddingStart === `${m.library.width}px` && m.paddingEnd === '0px', 'start panel reserves its width', m);
check(m.text.left >= m.library.right, 'page content starts after the start panel', m);
check(m.library.role === 'region' && m.library.label === 'Библиотека блоков' && m.library.modal === null, 'docked panel is a named modeless region', m.library);
check(m.overlays === 0 && !m.locked, 'no scrim and no scroll lock', m);
await page.locator('#open-settings').click();
await settle();
m = await measure();
observations.bothOpen = m;
check(m.paddingStart === `${m.library.width}px` && m.paddingEnd === `${m.settings.width}px`, 'both sides reserve their panel widths', m);
check(m.text.left >= m.library.right && m.text.right <= m.settings.left, 'page stays fully visible between both panels', m);
check(m.scrollWidth <= m.viewport, 'no horizontal overflow with both panels', m);
await page.screenshot({ path: resolve(outputDir, 'drawer-docked-both-light.png') });

// An editor that handles Escape keeps it; the docked panel stays open.
await page.locator('#editor-sim').focus();
await page.keyboard.press('Escape');
await settle();
check((await measure()).paddingEnd !== '0px', 'Escape handled by an editor does not close the docked panel', null);

// Keyboard: no focus trap; Escape closes the top panel only.
await page.locator('#settings-action').focus();
await page.keyboard.press('Tab');
const escaped = await page.evaluate(() => !document.querySelector('[data-sf-drawer-id="settings"] [data-sf-drawer-panel]').contains(document.activeElement));
check(escaped, 'Tab can leave a docked panel (no focus trap)', null);
await page.locator('#settings-action').focus();
await page.keyboard.press('Escape');
await settle();
m = await measure();
check(m.paddingEnd === '0px' && m.paddingStart === `${m.library.width}px`, 'Escape closes the top panel and releases only its side', m);

// Remount clears reserved space without leaks.
const remount = await page.evaluate(async () => {
  const drawer = document.getElementById('library');
  const parent = drawer.parentNode;
  for (let index = 0; index < 3; index += 1) { drawer.remove(); parent.append(drawer); }
  drawer.close();
  await new Promise((done) => setTimeout(done, 400));
  return { portals: document.querySelectorAll('[data-sf-drawer-portal="library"]').length, padding: getComputedStyle(document.getElementById('page')).paddingInlineStart, vars: getComputedStyle(document.documentElement).getPropertyValue('--sf-drawer-dock-inline-start').trim() };
});
observations.remount = remount;
check(remount.portals === 1 && remount.padding === '0px' && remount.vars === '', 'remount keeps one portal and closing releases space', remount);

// RTL: logical sides mirror.
await open({ dir: 'rtl', theme: 'dark' });
await page.locator('#open-library').click();
await page.locator('#open-settings').click();
await settle();
m = await measure();
observations.rtl = m;
check(m.library.left > m.settings.left && m.text.right <= m.library.left && m.text.left >= m.settings.right, 'RTL mirrors inline-start and inline-end and keeps page visible', m);
await page.screenshot({ path: resolve(outputDir, 'drawer-docked-both-dark-rtl.png') });

// Narrow: page keeps full width; panel overlays.
await open({ width: 390 });
await page.locator('#open-settings').click();
await settle();
m = await measure();
observations.narrow = m;
check(m.paddingEnd === '0px' && m.scrollWidth <= m.viewport, 'narrow screen does not squeeze the page', m);

// Reduced motion: no padding transition.
await open({ motion: 'reduce' });
const transition = await page.evaluate(() => getComputedStyle(document.getElementById('page')).transitionDuration);
observations.reducedMotionTransition = transition;
check(transition === '0s', 'reduced motion removes the shift animation', transition);

await browser.close();
const screenshots = Object.fromEntries(['drawer-docked-both-light.png', 'drawer-docked-both-dark-rtl.png'].map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'drawer-docked-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 8) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
