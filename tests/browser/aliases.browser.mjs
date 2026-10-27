#!/usr/bin/env node
// Usage: node this-file [distribution-url]
//   PLAYWRIGHT_MODULE=/abs/playwright/index.mjs picks another Playwright;
//   the default distribution is the published pair below on jsDelivr.
//
// Dated aliases (standard simai.smart-component 1.3.8 §16.20, §8) on real
// components of a released pair, which still send the old colon names:
// src/core/js/aliases.js, served as it is in the source, is installed on an
// sf-accordion and an sf-menu that the pair's loader brought.
// - a click on an accordion header: the new sf-accordion-toggle first, then
//   the old sf-accordion:toggle, each listener once, one detail object;
// - a press on a menu link refused through the new name: the old listener
//   sees it refused, the component reads its own event as refused and the
//   browser does not go; refused through the old name, the same;
// - SF.deprecations: one record per old name with tag, since, remove_after,
//   beside the pair's own undated notes (sf-button type=);
// - a renamed setting and action on the accordion (attribute both ways,
//   property, method), the markup path through the MutationObserver;
// - after remove_after: still delivered, `expired`, warned once without an
//   opt-in; under <html data-sf-aliases="strict"> not delivered;
// - uninstall leaves the element as the pair made it.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const PAIR = '5.20261025.1053';
const DISTR = (process.argv[2] || `https://cdn.jsdelivr.net/npm/@simai-studio/ui@${PAIR}/distr/`).replace(/\/?$/u, '/');
const ORIGIN = 'http://aliases.test/';
const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const JS = 'text/javascript; charset=utf-8';
const files = {
  'js/aliases.js': [JS, source('../../src/core/js/aliases.js')],
  'js/alias-table.js': [JS, source('../../src/core/js/alias-table.js')],
  'js/deprecations.js': [JS, source('../../src/core/js/deprecations.js')],
  'page.html': ['text/html; charset=utf-8', `<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <script>window.sfPath=${JSON.stringify(DISTR)};window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
    <script src="${DISTR}core/js/core.min.js"></script></head><body>
    <sf-accordion id="acc" items='[{"id":"main","title":"Основное","content":"Текст"},{"id":"seo","title":"SEO","content":"Заголовок"}]'></sf-accordion>
    <sf-menu id="menu" label="Разделы" items='[{"id":"about","label":"О компании","href":"#about"},{"id":"docs","label":"Документы","href":"#docs"}]'></sf-menu>
    <sf-button type="outline" text="Кнопка"></sf-button>
    </body></html>`],
};

async function scenario() {
  const {setAliasClock} = await import('/js/aliases.js');
  const checks = [];
  const check = (id, got, want) => checks.push({id, pass: JSON.stringify(got) === JSON.stringify(want), got, want});
  const dates = {since: '2026-10-26', remove_after: '2026-12-01'};
  setAliasClock(() => Date.parse('2026-11-15T12:00:00Z'));
  const acc = document.getElementById('acc');
  const menu = document.getElementById('menu');
  const notes = () => SF.deprecations.list();
  const frame = () => new Promise((settle) => requestAnimationFrame(() => setTimeout(settle, 0)));

  // 1. sf-accordion: a real click, old and new once each.
  const accHandle = SF.aliases.install(acc, [
    {kind: 'event', from: 'sf-accordion:toggle', to: 'sf-accordion-toggle', ...dates},
    {kind: 'setting', from: 'one-at-a-time', to: 'single', ...dates},
    {kind: 'action', from: 'expand', to: 'open', ...dates},
  ]);
  check('accordion-installed', [accHandle.installed, accHandle.refused], [3, []]);
  const heard = [];
  document.addEventListener('sf-accordion-toggle', (event) => heard.push(['new', event.detail]));
  document.addEventListener('sf-accordion:toggle', (event) => heard.push(['old', event.detail]));
  acc.querySelector('button.sf-accordion-trigger').click();
  await frame();
  check('accordion-both-once-new-first', heard.map(([who, detail]) => `${who}:${detail.id}:${detail.open}`), ['new:main:true', 'old:main:true']);
  check('accordion-one-detail', heard[0]?.[1] === heard[1]?.[1], true);
  const accNote = notes().find((note) => note.from === 'sf-accordion:toggle');
  check('accordion-journal', accNote && {kind: accNote.kind, tag: accNote.tag, to: accNote.to, since: accNote.since, remove_after: accNote.remove_after, count: accNote.count},
    {kind: 'event', tag: 'sf-accordion', to: 'sf-accordion-toggle', ...dates, count: 1});

  // 2. A renamed setting and action on the same element.
  acc.setAttribute('one-at-a-time', '');
  await frame();
  check('setting-old-attribute-writes-new', [acc.hasAttribute('single'), acc.single], [true, true]);
  acc.removeAttribute('single');
  await frame();
  check('setting-new-removal-clears-old', [acc.hasAttribute('one-at-a-time'), acc.single], [false, false]);
  acc.oneAtATime = true;
  await frame();
  check('setting-old-property-writes-new', acc.single, true);
  Element.prototype.setAttribute.call(acc, 'one-at-a-time', 'false');
  Element.prototype.removeAttribute.call(acc, 'single');
  Element.prototype.removeAttribute.call(acc, 'one-at-a-time');
  Element.prototype.setAttribute.call(acc, 'one-at-a-time', '');
  await frame();
  check('setting-markup-path-observed', acc.hasAttribute('single'), true);
  heard.length = 0;
  acc.expand('seo');
  await frame();
  check('action-old-calls-new', [acc.openIds.includes('seo'), heard.map(([who]) => who)], [true, ['new', 'old', 'new', 'old']]);

  // 3. sf-menu: a cancelable request refused through either name.
  SF.aliases.install(menu, [{kind: 'event', from: 'sf-menu:navigate', to: 'sf-menu-navigate', ...dates}]);
  const before = location.hash;
  const seen = [];
  const refuseNew = (event) => { seen.push('new'); event.preventDefault(); };
  const watchOld = (event) => seen.push(`old:${event.defaultPrevented}`);
  document.addEventListener('sf-menu-navigate', refuseNew);
  document.addEventListener('sf-menu:navigate', watchOld);
  menu.querySelector('a[data-sf-menu-link]').click();
  await frame();
  check('menu-new-refuses-old-sees-it', [seen, location.hash], [['new', 'old:true'], before]);
  document.removeEventListener('sf-menu-navigate', refuseNew);
  document.removeEventListener('sf-menu:navigate', watchOld);
  seen.length = 0;
  const watchNew = (event) => seen.push(`new:${event.defaultPrevented}`);
  const refuseOld = (event) => { seen.push('old'); event.preventDefault(); };
  document.addEventListener('sf-menu-navigate', watchNew);
  document.addEventListener('sf-menu:navigate', refuseOld);
  menu.querySelector('a[data-sf-menu-link]').click();
  await frame();
  check('menu-old-refuses-the-press', [seen, location.hash], [['new:false', 'old'], before]);
  document.removeEventListener('sf-menu:navigate', refuseOld);
  seen.length = 0;
  menu.querySelector('a[data-sf-menu-link]').click();
  await frame();
  check('menu-nobody-refuses-it-goes', [seen, location.hash], [['new:false'], '#about']);
  document.removeEventListener('sf-menu-navigate', watchNew);

  // 4. The journal beside the pair's own notes.
  const all = notes();
  check('journal-shared-with-pair', [all.some((note) => note.kind === 'event' && note.from === 'sf-menu:navigate' && note.remove_after === '2026-12-01'),
    all.some((note) => note.component === 'sf-button' && note.from === 'type')], [true, true]);
  check('journal-one-record-per-name', all.filter((note) => note.from === 'sf-menu:navigate').length, 1);
  check('journal-setting-and-action', ['one-at-a-time', 'expand'].map((from) => all.find((note) => note.from === from)?.kind), ['setting', 'action']);

  // 5. After remove_after: delivered and expired; strict: not delivered.
  acc.removeAttribute('single');
  await frame();
  setAliasClock(() => Date.parse('2026-12-02T00:00:01Z'));
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  heard.length = 0;
  acc.toggle('main');
  acc.toggle('main');
  console.warn = warn;
  check('expired-still-delivered', heard.map(([who]) => who), ['new', 'old', 'new', 'old']);
  check('expired-noted-and-warned-once', [notes().find((note) => note.from === 'sf-accordion:toggle')?.expired,
    warnings.filter((text) => text.includes('sf-accordion:toggle') && text.includes('2026-12-01')).length], [true, 1]);
  document.documentElement.dataset.sfAliases = 'strict';
  heard.length = 0;
  acc.toggle('main');
  let threw = '';
  try { acc.expand('seo'); } catch (error) { threw = error.message; }
  check('strict-expired-not-delivered', [heard.map(([who]) => who), /expand\(\) was removed after 2026-12-01/u.test(threw)], [['new'], true]);
  delete document.documentElement.dataset.sfAliases;

  // 6. Uninstall leaves the pair's element as it was.
  accHandle.uninstall();
  heard.length = 0;
  acc.toggle('main');
  check('uninstall-restores', [heard.map(([who]) => who), Object.hasOwn(acc, 'dispatchEvent'), Object.hasOwn(acc, 'expand'), Object.hasOwn(acc, 'oneAtATime')], [['old'], false, false, false]);
  return checks;
}

const browser = await chromium.launch();
let failed = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.route(`${ORIGIN}**`, (route) => {
    const file = files[new URL(route.request().url()).pathname.slice(1)];
    return file ? route.fulfill({contentType: file[0], body: file[1]}) : route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${ORIGIN}page.html`);
  await page.waitForFunction(() => customElements.get('sf-accordion') && customElements.get('sf-menu') && customElements.get('sf-button')
    && document.querySelector('#acc button.sf-accordion-trigger') && document.querySelector('#menu a[data-sf-menu-link]')
    && typeof window.SF?.deprecations?.list === 'function', null, {timeout: 30000});
  await page.waitForTimeout(300);
  const checks = await page.evaluate(`(${scenario.toString()})()`);
  if (errors.length) checks.push({id: 'no-page-errors', pass: false, got: errors, want: []});
  for (const one of checks) {
    console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.id}${one.pass ? '' : `  got ${JSON.stringify(one.got)} want ${JSON.stringify(one.want)}`}`);
    if (!one.pass) failed += 1;
  }
  console.log(`${checks.length - failed}/${checks.length} on ${DISTR}`);
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
