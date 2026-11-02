#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.4, the about menu, on the built Framework (core, component
// and smart outputs under the root): a right-click on an effect's own
// background opens a small English sf-context-menu -- the effect's name and
// version, "By <author>", a link to its page in SIMAI Effects for an effect
// of that catalogue (the homepage its manifest names for a foreign one), and
// "Pause motion" / "Resume motion", which pause the placement as its handle
// does. Checked:
// - sf-context-menu is not asked for before the first right-click that opens
//   the menu;
// - inline: the background opens it; a right-click on text, a link, a button
//   or a panel with its own background inside the area keeps the browser's
//   menu (no preventDefault); Shift+right-click keeps it;
//   data-sf-effect-about="false" on an area, and on a part of one, keeps it;
// - windows mode: an empty window card opens it; the gap between cards and a
//   card that is not a window keep the browser's menu;
// - a foreign effect in its sandbox frame: the right-click over the frame
//   opens the menu with the homepage link, and pause and resume reach the
//   frame;
// - pause and resume through the menu stop and restart the drawing, and the
//   row says which it will do; Escape closes the menu;
// - SF_BOOT_CONFIG.effects.about = false keeps the browser's menu everywhere
//   and loads nothing.
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'effect-sandbox');
const FOREIGN = 'https://foreign.test/effects/bands/effect.json';
const HOMEPAGE = 'https://foreign.test/bands/';
const serve = new Map([
  [FOREIGN, {type: 'application/json', body: JSON.stringify({...JSON.parse(readFileSync(join(fixtures, 'benign', 'effect.json'), 'utf8')), homepage: HOMEPAGE})}],
  [FOREIGN.replace('effect.json', 'index.js'), {type: 'text/javascript', body: readFileSync(join(fixtures, 'benign', 'index.js'), 'utf8')}],
]);

const body = `
<section id="inline" data-sf-effect="sample-bands" style="display:block;inline-size:480px;block-size:240px;padding:16px;box-sizing:border-box">
  <h2 id="heading" style="margin:0;font-size:20px;inline-size:max-content">Heading text</h2>
  <p id="line" style="margin:8px 0;block-size:24px"><a id="link" href="#nowhere">A link</a></p>
  <div id="panel" style="background:#ffffff;inline-size:120px;block-size:32px"></div>
  <button id="button" type="button" style="margin-block-start:8px">Button</button>
  <div id="quiet" data-sf-effect-about="false" style="inline-size:120px;block-size:30px;margin-block-start:8px"></div>
</section>
<section id="off" data-sf-effect="sample-bands" data-sf-effect-about="false" style="display:block;inline-size:480px;block-size:80px"></section>
<div id="win" data-sf-effect-windows="sample-bands" style="display:flex;gap:40px;padding:16px;inline-size:640px;block-size:140px;box-sizing:border-box">
  <article id="w1" data-sf-effect-window style="flex:1">Card text</article>
  <article id="w2" data-sf-effect-window style="flex:1"></article>
  <article id="plain" style="flex:1"></article>
</div>
<section id="foreign" data-sf-effect="${FOREIGN}" style="display:block;inline-size:480px;block-size:120px"></section>`;
// Every right-click as the window sees it last: whether anything prevented
// the browser's menu.
const head = `<script>window.__menus = []; addEventListener('contextmenu', (event) => window.__menus.push({target: event.target.id || event.target.localName, prevented: event.defaultPrevented}));</script>`;
const ids = ['inline', 'off', 'win', 'foreign'];

const settled = (page) => page.waitForFunction((list) => list
  .every((id) => document.getElementById(id).getAttribute('data-sf-effect-state') === 'running'), ids, {timeout: 20000});

// Points in the page: a free corner of an element, its centre, the middle of
// a text, the gap between two cards.
const point = (page, how, id) => page.evaluate(({how, id}) => {
  const element = document.getElementById(id);
  const box = element.getBoundingClientRect();
  if (how === 'corner') return {x: box.right - 12, y: box.bottom - 12};
  if (how === 'centre') return {x: box.left + box.width / 2, y: box.top + box.height / 2};
  if (how === 'end') return {x: box.right - 20, y: box.top + box.height / 2};
  if (how === 'text') {
    const range = document.createRange();
    range.selectNodeContents(element.firstChild);
    const rect = range.getBoundingClientRect();
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
  }
  if (how === 'gap') {
    const next = element.nextElementSibling.getBoundingClientRect();
    return {x: (box.right + next.left) / 2, y: box.top + box.height / 2};
  }
  throw new Error(how);
}, {how, id});

const menu = (page) => page.evaluate(() => {
  const element = document.querySelector('sf-context-menu[data-sf-effect-about]');
  if (!element?.isOpen) return {open: false};
  const text = (selector) => element.querySelector(selector)?.textContent.trim() ?? null;
  return {
    open: true,
    label: element.getAttribute('aria-label'),
    lang: element.getAttribute('lang'),
    heading: text('.sf-context-menu-heading'),
    note: text('.sf-context-menu-note'),
    items: [...element.querySelectorAll('.sf-context-menu-item')].map((item) => ({
      text: item.querySelector('.sf-context-menu-item-label')?.textContent.trim() ?? null,
      href: item.getAttribute('href'),
    })),
  };
});

// A right-click at a point; answers what the window saw and whether the menu opened.
const rightClick = async (page, at, {shift = false} = {}) => {
  await page.evaluate(() => { window.__menus = []; });
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(at.x, at.y, {button: 'right'});
  if (shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(150);
  const seen = await page.evaluate(() => window.__menus);
  return {prevented: seen.length === 1 ? seen[0].prevented : seen};
};
const waitOpen = (page) => page.waitForFunction(() => document.querySelector('sf-context-menu[data-sf-effect-about]')?.isOpen === true, null, {timeout: 10000})
  .then(() => true, () => false);
const closeMenu = async (page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
};
const choose = async (page, id) => {
  await page.locator(`sf-context-menu[data-sf-effect-about] [data-sf-entry]`).filter({hasText: id}).first().click();
  await page.waitForTimeout(300);
};

// Whether the inline canvas still changes: two pictures 300 ms apart.
const moving = (page, id) => page.evaluate(async (id) => {
  const canvas = document.querySelector(`#${id} [data-sf-effect-layer] canvas`);
  const first = canvas.toDataURL();
  await new Promise((done) => setTimeout(done, 300));
  return canvas.toDataURL() !== first;
}, id);

const frameIn = async (page, id) => {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const element = await frame.frameElement().catch(() => null);
    if (element && await element.evaluate((node, id) => node.closest(`#${id}`) !== null, id)) return frame;
  }
  return null;
};

const browser = await chromium.launch();
try {
  const {page, requests, errors} = await openPage(browser, out, {theme: 'theme-light', body, head, serve, distr: true});
  await settled(page);
  await page.waitForTimeout(300);
  const asked = () => requests.filter((url) => /context-menu/u.test(url));
  expect('nothing of sf-context-menu is loaded before a right-click', [await page.evaluate(() => Boolean(customElements.get('sf-context-menu'))), asked().length], [false, 0]);

  // Rule 1 first, before anything is loaded: content keeps the browser's menu.
  expect('text in the area keeps the browser menu', await rightClick(page, await point(page, 'text', 'heading')), {prevented: false});
  expect('a link in the area keeps the browser menu', await rightClick(page, await point(page, 'text', 'link')), {prevented: false});
  expect('a button in the area keeps the browser menu', await rightClick(page, await point(page, 'centre', 'button')), {prevented: false});
  expect('a panel with its own background keeps the browser menu', await rightClick(page, await point(page, 'centre', 'panel')), {prevented: false});
  // Rule 2: Shift.
  expect('Shift+right-click keeps the browser menu', await rightClick(page, await point(page, 'corner', 'inline'), {shift: true}), {prevented: false});
  // Rule 3, per area and per part.
  expect('data-sf-effect-about="false" on an area keeps the browser menu', await rightClick(page, await point(page, 'centre', 'off')), {prevented: false});
  expect('data-sf-effect-about="false" on a part keeps the browser menu', await rightClick(page, await point(page, 'centre', 'quiet')), {prevented: false});
  expect('still nothing loaded after right-clicks on content', [await page.evaluate(() => Boolean(customElements.get('sf-context-menu'))), asked().length], [false, 0]);

  // The background opens the menu.
  expect('the background prevents the browser menu', await rightClick(page, await point(page, 'corner', 'inline')), {prevented: true});
  expect('the menu opens', await waitOpen(page), true);
  expect('the menu of a catalogue effect', await menu(page), {
    open: true, label: 'About this background', lang: 'en', heading: 'sample-bands 1.0.0', note: 'By SIMAI Framework (kit fixture)',
    items: [{text: 'Open in SIMAI Effects', href: 'https://effects.simai.io/effect/sample-bands/'}, {text: 'Pause motion', href: null}],
  });
  expect('sf-context-menu was loaded by that right-click', asked().length > 0, true);
  // A transparent wrapper beside a link is background too.
  await closeMenu(page);
  expect('Escape closes the menu', (await menu(page)).open, false);
  expect('a transparent wrapper beside text is background', await rightClick(page, await point(page, 'end', 'line')), {prevented: true});
  expect('the menu opens over a transparent wrapper', await waitOpen(page), true);

  // Pause and resume through the menu, as the placement's pause.
  expect('the effect moves before', await moving(page, 'inline'), true);
  await page.evaluate(() => {
    window.__motion = [];
    document.querySelector('#inline').addEventListener('sf-effect-motion', (event) => window.__motion.push(event.detail.paused));
  });
  await choose(page, 'Pause motion');
  expect('the menu closes after a choice', (await menu(page)).open, false);
  expect('Pause motion stops the drawing', await moving(page, 'inline'), false);
  await rightClick(page, await point(page, 'corner', 'inline'));
  await waitOpen(page);
  expect('the row offers to resume', (await menu(page)).items.at(-1), {text: 'Resume motion', href: null});
  await choose(page, 'Resume motion');
  expect('Resume motion restarts the drawing', await moving(page, 'inline'), true);
  expect('the menu tells the site what it did', await page.evaluate(() => window.__motion), [true, false]);

  // Windows mode: an empty window card is background; the gap and a plain card are not.
  expect('a window card opens the menu', await rightClick(page, await point(page, 'centre', 'w2')), {prevented: true});
  expect('the menu opens over a window card', await waitOpen(page), true);
  expect('windows mode names the effect', (await menu(page)).heading, 'sample-bands 1.0.0');
  await closeMenu(page);
  expect('text in a window card keeps the browser menu', await rightClick(page, await point(page, 'text', 'w1')), {prevented: false});
  expect('the gap between window cards keeps the browser menu', await rightClick(page, await point(page, 'gap', 'w2')), {prevented: false});
  expect('a card that is not a window keeps the browser menu', await rightClick(page, await point(page, 'centre', 'plain')), {prevented: false});

  // The foreign effect in its sandbox frame.
  expect('the foreign effect runs sandboxed', await page.evaluate(() => document.querySelectorAll('#foreign iframe[sandbox="allow-scripts"]').length), 1);
  expect('a right-click over the sandbox frame opens the menu', await rightClick(page, await point(page, 'centre', 'foreign')), {prevented: true});
  expect('the menu opens over the frame', await waitOpen(page), true);
  expect('the menu of a foreign effect links its homepage', await menu(page), {
    open: true, label: 'About this background', lang: 'en', heading: 'Foreign bands 1.0.0', note: 'By SIMAI Framework (sandbox probe fixture)',
    items: [{text: 'Open homepage', href: HOMEPAGE}, {text: 'Pause motion', href: null}],
  });
  const frame = await frameIn(page, 'foreign');
  const paused = () => frame.evaluate(() => globalThis.__sandbox?.paused ?? null);
  await choose(page, 'Pause motion');
  expect('Pause motion reaches the frame', await paused(), true);
  await rightClick(page, await point(page, 'centre', 'foreign'));
  await waitOpen(page);
  await choose(page, 'Resume motion');
  expect('Resume motion reaches the frame', await paused(), false);

  // The link opens a new tab, never this one.
  const address = page.url();
  await rightClick(page, await point(page, 'corner', 'inline'));
  await waitOpen(page);
  const popup = page.context().waitForEvent('page', {timeout: 5000}).catch(() => null);
  await choose(page, 'Open in SIMAI Effects');
  const opened = await popup;
  expect('the link opens in a new tab', opened ? opened.url() : null, 'https://effects.simai.io/effect/sample-bands/');
  expect('the page stays where it was', page.url(), address);
  await opened?.close();

  if (errors.length) failures.push({case: 'no page errors', got: errors});
  await page.context().close();

  // Rule 3, for the page.
  const off = await openPage(browser, out, {theme: 'theme-light', body, head, serve, distr: true, effects: {about: false}});
  await settled(off.page);
  expect('with effects.about = false the background keeps the browser menu', await rightClick(off.page, await point(off.page, 'corner', 'inline')), {prevented: false});
  expect('with effects.about = false a window card keeps it', await rightClick(off.page, await point(off.page, 'centre', 'w2')), {prevented: false});
  expect('with effects.about = false nothing is loaded', [await off.page.evaluate(() => Boolean(customElements.get('sf-context-menu'))), off.requests.filter((url) => /context-menu/u.test(url)).length], [false, 0]);
  if (off.errors.length) failures.push({case: 'no page errors (about off)', got: off.errors});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_ABOUT_OK');
