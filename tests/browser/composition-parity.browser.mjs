#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The visual parity pass of the one block editor (2026-11-04), on the built
// bytes, through the Loader, Russian, light and dark, at 1440 and 390 px:
//   - layout.section 1.2.0 unset: space above and below (p-y-8, the step
//     measured, not only "more than zero") and its text never at the sheet's
//     edge -- the page container's gutter on both sides, centred;
//   - a section that sets its own width (full) and space (0) keeps them;
//   - every built-in Element and Layout type renders: element.button (sf-button
//     with its words and icon), element.button-icon, element.badge (the Russian
//     word when unset), element.icon, content.divider, layout.container (a
//     narrower centred measure on the desktop), layout.grid (three columns on
//     the desktop, one on the phone, a gap between) and layout.spacer (the
//     height of space-6);
//   - the page never scrolls sideways.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const {render} = await import(pathToFileURL(resolve(import.meta.dirname, '../../src/core/js/composition/index.mjs')).href);

const text = (value) => [{type: 'text', value}];
const paragraph = (id, value) => ({id, type: 'content.paragraph', data: {content: text(value)}});
const long = 'Макет и текст — одно дерево блоков. Щелчок по тексту — печатаете, щелчок по краю — выбираете блок. '.repeat(3);
const document = {
  schema: 'simai.composition.document', schema_version: 1, id: 'parity', profile: 'ui-layout', locale: 'ru',
  root: {id: 'root', type: 'layout.page', slots: {default: [
    {id: 'first', type: 'layout.section', slots: {default: [
      {id: 'first-h', type: 'content.heading', data: {level: 2, content: text('Как здесь работать')}},
      paragraph('first-p', long),
    ]}},
    {id: 'own', type: 'layout.section', props: {width: 'full', padding_y: 0}, slots: {default: [paragraph('own-p', 'Своя ширина и свои отступы.')]}},
    {id: 'cards', type: 'layout.section', props: {background: 'container'}, slots: {default: [
      {id: 'grid', type: 'layout.grid', slots: {default: [1, 2, 3].map((n) => ({id: `card-${n}`, type: 'content.card', slots: {default: [paragraph(`card-${n}-p`, `Карточка ${n}`)]}}))}},
    ]}},
    {id: 'parts', type: 'layout.section', slots: {default: [
      {id: 'box', type: 'layout.container', slots: {default: [paragraph('box-p', long)]}},
      {id: 'button', type: 'element.button', data: {text: 'Подробнее'}, props: {icon: 'arrow_forward', icon_position: 'end'}},
      {id: 'icon-button', type: 'element.button-icon', data: {label: 'Нравится'}},
      {id: 'badge', type: 'element.badge'},
      {id: 'icon', type: 'element.icon', props: {size: '4'}},
      {id: 'line', type: 'content.divider'},
      {id: 'gap', type: 'layout.spacer'},
      paragraph('after', 'После пустого места.'),
    ]}},
  ]}},
};
const output = await render(document);
if (output.diagnostics.length) throw new Error(`render: ${JSON.stringify(output.diagnostics)}`);

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-0)}</style></head><body>${output.html}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const evidence = {};
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const label = `${theme} ${width}px`;
      const check = (name, pass, detail = {}) => { if (!pass) failures.push({name: `${label}: ${name}`, ...detail}); };
      const tab = await browser.newPage({viewport: {width, height: 900}});
      await tab.goto(`http://127.0.0.1:${server.address().port}/page?theme=${theme}`);
      // The section's own utilities, the smart elements and the icon font settle.
      await tab.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('[data-sf-composition-id="first"]')).paddingTop) > 0, null, {timeout: 20000})
        .catch(() => failures.push({name: `${label}: the section's utilities never arrived`}));
      await tab.waitForFunction(() => ['sf-button', 'sf-button-icon', 'sf-badge', 'sf-icon'].every((name) => customElements.get(name)) && document.querySelector('[data-sf-composition-id="button"] button'), null, {timeout: 20000})
        .catch(() => failures.push({name: `${label}: the smart elements never drew`}));
      await tab.waitForFunction(() => !document.documentElement.hasAttribute('data-sf-icons'), null, {timeout: 15000}).catch(() => {});
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const m = await tab.evaluate(() => {
        const node = (id) => document.querySelector(`[data-sf-composition-id="${id}"]`);
        const box = (element) => { const rect = element.getBoundingClientRect(); return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height}; };
        // A smart element's host may draw no box of its own (display: contents): what it draws is its widest descendant.
        const drawn = (element) => [element, ...element.querySelectorAll('*')].map(box).reduce((best, next) => (next.width * next.height > best.width * best.height ? next : best));
        const probe = document.createElement('div');
        document.body.append(probe);
        const length = (value) => { probe.style.cssText = `position:absolute;width:${value}`; return parseFloat(getComputedStyle(probe).width); };
        const style = (id) => getComputedStyle(node(id));
        const root = document.documentElement.getBoundingClientRect();
        const result = {
          root: {left: root.left, right: root.right},
          space8: length('var(--sf-space-8)'), space6: length('var(--sf-space-6)'),
          first: {box: box(node('first')), padTop: parseFloat(style('first').paddingTop), padBottom: parseFloat(style('first').paddingBottom), heading: box(node('first-h')), text: box(node('first-p'))},
          own: {box: box(node('own')), padTop: parseFloat(style('own').paddingTop), text: box(node('own-p')), frame: !!node('own').querySelector('[data-sf-composition-part]')},
          cards: [1, 2, 3].map((n) => box(node(`card-${n}`))),
          grid: box(node('grid')),
          box: box(node('box-p')), sectionText: box(node('first-p')),
          button: (() => { const inner = node('button').querySelector('button'); return inner ? {box: box(inner), words: inner.textContent.replace(/\s+/gu, ' ').trim()} : null; })(),
          iconButton: (() => { const inner = node('icon-button').querySelector('button'); return inner ? {box: box(inner), label: inner.getAttribute('aria-label') || node('icon-button').querySelector('[aria-label]')?.getAttribute('aria-label')} : null; })(),
          badge: {box: drawn(node('badge').firstElementChild), words: node('badge').textContent.replace(/\s+/gu, ' ').trim()},
          icon: drawn(node('icon').firstElementChild),
          line: {box: box(node('line')), border: parseFloat(getComputedStyle(node('line')).borderTopWidth) + parseFloat(getComputedStyle(node('line')).borderBottomWidth) + parseFloat(getComputedStyle(node('line')).height)},
          gap: box(node('gap')),
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
        probe.remove();
        return result;
      });
      evidence[label] = m;
      // layout.section unset: p-y-8, and text off the sheet's edge, centred.
      check('the section has space above and below', m.first.padTop > 0 && near(m.first.padTop, m.space8) && near(m.first.padBottom, m.space8), {padTop: m.first.padTop, padBottom: m.first.padBottom, space8: m.space8});
      const inset = Math.min(m.first.text.left - m.root.left, m.root.right - m.first.text.right);
      check('the text is not at the sheet\'s edge', inset >= 8 && m.first.heading.left - m.root.left >= 8, {inset, heading: m.first.heading.left});
      check('the section\'s text is centred', near(m.first.text.left - m.root.left, m.root.right - m.first.text.right), {text: m.first.text});
      // A Document's own values win.
      check('a section that sets width full and padding 0 keeps them', m.own.padTop === 0 && !m.own.frame && near(m.own.text.left, m.root.left) && near(m.own.text.width, m.root.right - m.root.left), {own: m.own});
      // layout.grid: three columns on the desktop, one on the phone.
      const [a, b, c] = m.cards;
      if (width >= 1024) check('the grid draws three columns', near(a.top, b.top) && near(b.top, c.top) && a.right < b.left && b.right < c.left && near(a.width, c.width), {cards: m.cards});
      else check('the grid draws one column on the phone', near(a.left, b.left) && a.bottom < b.top && b.bottom < c.top && near(a.width, m.grid.width), {cards: m.cards, grid: m.grid});
      // layout.container: a narrow, centred measure on the desktop.
      check('the container is centred', near(m.box.left - m.root.left, m.root.right - m.box.right, 2), {box: m.box});
      if (width >= 1024) check('the container is narrower than the section', m.box.width < m.sectionText.width - 40, {box: m.box.width, section: m.sectionText.width});
      // The elements.
      check('element.button draws sf-button with its words and the icon after them', m.button && m.button.box.width > 40 && m.button.box.height >= 24 && m.button.words.startsWith('Подробнее') && m.button.words.endsWith('arrow_forward'), {button: m.button});
      check('element.button-icon draws a labelled button', m.iconButton && m.iconButton.box.width >= 24 && near(m.iconButton.box.width, m.iconButton.box.height, 2) && m.iconButton.label === 'Нравится', {iconButton: m.iconButton});
      check('element.badge draws its Russian word unset', m.badge.box.width > 20 && m.badge.box.height > 10 && m.badge.words === 'Метка', {badge: m.badge});
      check('element.icon draws a glyph', m.icon.width >= 16 && m.icon.height >= 16, {icon: m.icon});
      check('content.divider draws a line', m.line.box.width > 100 && m.line.border >= 1, {line: m.line});
      check('layout.spacer is space-6 high', near(m.gap.height, m.space6), {gap: m.gap.height, space6: m.space6});
      check('the page does not scroll sideways', m.sideways <= 0, {sideways: m.sideways});
      if (process.env.PARITY_SHOTS) await tab.screenshot({path: join(process.env.PARITY_SHOTS, `composition-parity-${theme}-${width}.png`), fullPage: true});
      await tab.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({probe: 'composition-parity', passed: failures.length === 0, failures, measured: evidence}, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
