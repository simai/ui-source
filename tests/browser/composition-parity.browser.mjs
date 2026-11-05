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
//     every screen, the phone too, a gap between) and layout.spacer (the
//     height of space-6);
//   - the page never scrolls sideways;
//   - blocks in a section stand one rhythm apart: space-3, the prototype's
//     24 px at the desktop (16 px on the phone);
//   - a container inside a section has no second gutter: its text is exactly
//     as wide as the section's own (366 px at 390);
//   - sf-button 1.4.0 href: element.button with an address draws an <a> with
//     the look of the button beside it (no underline), reached by Tab and
//     followed by Enter; disabled, the link has no href, says aria-disabled
//     and is not reached; an unsafe scheme draws a button;
//   - the section's padding alone sets the inset: its first block (an h2)
//     starts at the padding, its last block ends at it (core.styles 1.2.0);
//   - a heading and a paragraph take alignment and visibility per screen
//     (content.heading 1.2.0, content.paragraph 1.3.0);
//   - G-39: a lead paragraph is the large body text (20 px at the desktop,
//     the prototype's 19, 16 on the phone) in the variant ink;
//   - a heading in a card is its title (16 px semibold) at every width, and
//     three titled cards on a phone keep every line inside and never meet;
//   - on the accent a primary button inverts and an outlined one takes the
//     on-primary edge: 3:1 off the fill, the words at 4.5:1.
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
      {id: 'lead', type: 'content.paragraph', presentation: {modifiers: ['lead']}, data: {content: text('Одна-две строки о главном.')}},
    ]}},
    {id: 'texts', type: 'layout.section', slots: {default: [
      {id: 'centred', type: 'content.heading', props: {align: {xs: 'center', lg: 'start'}}, data: {level: 2, content: text('По центру на телефоне')}},
      {id: 'wide-only', type: 'content.paragraph', props: {hidden: {xs: true, lg: false}}, data: {content: text('Только на широком экране.')}},
      {id: 'end', type: 'content.paragraph', props: {align: 'end'}, data: {content: text('Справа.')}},
    ]}},
    {id: 'own', type: 'layout.section', props: {width: 'full', padding_y: 0}, slots: {default: [paragraph('own-p', 'Своя ширина и свои отступы.')]}},
    {id: 'cards', type: 'layout.section', props: {background: 'container'}, slots: {default: [
      {id: 'grid', type: 'layout.grid', slots: {default: [1, 2, 3].map((n) => ({id: `card-${n}`, type: 'content.card', slots: {default: [paragraph(`card-${n}-p`, `Карточка ${n}`)]}}))}},
      // Cards as the prototype's features: a title and a line under it, three on a phone too.
      {id: 'titled', type: 'layout.grid', slots: {default: [['Быстро', 'Страница собирается за минуты.'], ['Понятно', 'Короткое описание преимущества.'], ['Надёжно', 'Автор не сломает макет.']].map(([title, line], index) => ({id: `titled-${index + 1}`, type: 'content.card', slots: {default: [
        {id: `titled-${index + 1}-h`, type: 'content.heading', data: {level: 3, content: text(title)}},
        paragraph(`titled-${index + 1}-p`, line),
      ]}}))}},
    ]}},
    // The accent variant with its buttons: they must not melt into the fill.
    {id: 'accent', type: 'layout.section', props: {background: 'accent'}, slots: {default: [
      {id: 'accent-h', type: 'content.heading', data: {level: 2, content: text('Готовы начать?')}},
      {id: 'accent-button', type: 'element.button', data: {text: 'Оставить заявку'}},
      {id: 'accent-outline', type: 'element.button', data: {text: 'Подробнее'}, props: {appearance: 'outline'}},
    ]}},
    {id: 'parts', type: 'layout.section', slots: {default: [
      {id: 'box', type: 'layout.container', slots: {default: [paragraph('box-p', long)]}},
      {id: 'button', type: 'element.button', data: {text: 'Подробнее'}, props: {icon: 'arrow_forward', icon_position: 'end'}},
      {id: 'link', type: 'element.button', data: {text: 'Подробнее', href: '#docs'}, props: {icon: 'arrow_forward', icon_position: 'end'}},
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
<style>body{margin:0;background:var(--sf-surface-0)}</style></head><body>${output.html}
<div id="raw"><sf-button id="raw-off" href="#off" disabled text="Выключено"></sf-button><sf-button id="raw-unsafe" href="javascript:alert(1)" text="Небезопасно"></sf-button></div></body></html>`;

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
      await tab.waitForFunction(() => ['sf-button', 'sf-button-icon', 'sf-badge', 'sf-icon'].every((name) => customElements.get(name)) && document.querySelector('[data-sf-composition-id="button"] button') && document.querySelector('#raw-unsafe .sf-button'), null, {timeout: 20000})
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
          space8: length('var(--sf-space-8)'), space6: length('var(--sf-space-6)'), space3: length('var(--sf-space-3)'),
          rhythm: {heading: node('first-h').getBoundingClientRect().bottom, text: node('first-p').getBoundingClientRect().top, box: node('box').getBoundingClientRect().bottom, button: node('button').getBoundingClientRect().top},
          lead: {size: parseFloat(style('lead').fontSize), line: parseFloat(style('lead').lineHeight), color: style('lead').color, body: parseFloat(style('first-p').fontSize), bodyColor: style('first-p').color},
          texts: {centred: style('centred').textAlign, wideOnly: style('wide-only').display, wideBox: box(node('wide-only')).height, end: style('end').textAlign, endText: (() => { const range = document.createRange(); range.selectNodeContents(node('end')); return {right: range.getBoundingClientRect().right, box: box(node('end')).right}; })()},
          firstTop: node('first-h').getBoundingClientRect().top - node('first').getBoundingClientRect().top,
          lastBottom: node('first').getBoundingClientRect().bottom - node('lead').getBoundingClientRect().bottom,
          gridTops: [1, 2, 3].map((n) => node(`card-${n}`).parentElement.getBoundingClientRect().top),
          // Every text line of a titled card stays inside its card; the titles never meet.
          titled: [1, 2, 3].map((n) => {
            const card = box(node(`titled-${n}`));
            const lines = [node(`titled-${n}-h`), node(`titled-${n}-p`)].map((element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              const rects = [...range.getClientRects()];
              return {left: Math.min(...rects.map((rect) => rect.left)), right: Math.max(...rects.map((rect) => rect.right)), scroll: element.scrollWidth - element.clientWidth};
            });
            const heading = getComputedStyle(node(`titled-${n}-h`));
            return {card, lines, title: {size: parseFloat(heading.fontSize), weight: Number(heading.fontWeight), line: parseFloat(heading.lineHeight), box: box(node(`titled-${n}-h`))}, text: parseFloat(getComputedStyle(node(`titled-${n}-p`)).fontSize)};
          }),
          accent: (() => {
            const section = getComputedStyle(node('accent')).backgroundColor;
            const fill = (id) => { const inner = node(id).querySelector('.sf-button'); const s = getComputedStyle(inner); return {background: s.backgroundColor, border: s.borderTopColor, borderWidth: parseFloat(s.borderTopWidth), ink: getComputedStyle(inner.querySelector('.sf-button-text-container')).color}; };
            return {section, button: fill('accent-button'), outline: fill('accent-outline')};
          })(),
          link: (() => {
            const anchor = node('link').querySelector('.sf-button');
            const button = node('button').querySelector('.sf-button');
            // The root's own font and colour are the browser's (a button's, a link's); the ink drawn is the label's.
            const look = (element) => { const s = getComputedStyle(element); const label = getComputedStyle(element.querySelector('.sf-button-text-container')); return {background: s.backgroundColor, color: s.color, height: s.height, width: s.width, padding: s.padding, radius: s.borderRadius, display: s.display, decoration: s.textDecorationLine, label: `${label.font} ${label.color} ${label.textDecorationLine}`}; };
            const off = document.querySelector('#raw-off .sf-button');
            const unsafe = document.querySelector('#raw-unsafe .sf-button');
            return {
              tag: anchor?.localName, href: anchor?.getAttribute('href'), look: anchor && look(anchor), buttonLook: button && look(button),
              off: {tag: off?.localName, href: off?.hasAttribute('href'), role: off?.getAttribute('role'), disabled: off?.getAttribute('aria-disabled')},
              unsafe: {tag: unsafe?.localName, href: unsafe?.hasAttribute('href')},
            };
          })(),
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
      // layout.grid 1.1.0: three columns on every screen, the phone too, as the
      // prototype draws features and cards at 380 (a phone rule is the author's).
      const [a, b, c] = m.cards;
      check(width >= 1024 ? 'the grid draws three columns' : 'the grid keeps three columns on the phone, as the prototype', near(a.top, b.top) && near(b.top, c.top) && a.right < b.left && b.right < c.left && near(a.width, c.width) && c.right <= m.grid.right + 1, {cards: m.cards, grid: m.grid});
      // A card's title is the prototype's (16 px, semibold, one body line) at every width, and in three
      // cards on a phone no line leaves its card and the titles never meet.
      check('a heading inside a card is its title: 16 px, semibold', m.titled.every((card) => near(card.title.size, 16) && card.title.weight >= 600 && card.title.weight < 700), {titles: m.titled.map((card) => card.title)});
      check('no line of a card leaves it', m.titled.every((card) => card.lines.every((line) => line.left >= card.card.left - 0.5 && line.right <= card.card.right + 0.5 && line.scroll <= 0)), {titled: m.titled.map((card) => ({card: card.card, lines: card.lines}))});
      check('a one-word card title stays on one line, three cards on a phone too', m.titled.every((card) => card.title.box.height <= card.title.line + 1), {titles: m.titled.map((card) => card.title)});
      check('the card titles do not overlap', m.titled.every((card, index) => index === 0 || card.title.box.left >= m.titled[index - 1].title.box.right), {titles: m.titled.map((card) => card.title.box)});
      // The accent's buttons stand off its fill: the plate (a fill) or the edge (an outline) at 3:1 or more.
      const rgb = (value) => (value.match(/[\d.]+/gu) ?? []).map(Number);
      const lum = ([r, g, b]) => [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (x, y) => { const [p, q] = [lum(rgb(x)), lum(rgb(y))].sort((u, v) => v - u); return Math.round(((p + 0.05) / (q + 0.05)) * 100) / 100; };
      const plate = ratio(m.accent.button.background, m.accent.section);
      const edge = ratio(m.accent.outline.border, m.accent.section);
      check('on the accent a primary button inverts: its plate stands at 3:1 or more off the fill, its words at 4.5:1 on the plate', plate >= 3 && ratio(m.accent.button.ink, m.accent.button.background) >= 4.5, {plate, ink: ratio(m.accent.button.ink, m.accent.button.background), accent: m.accent});
      check('on the accent an outlined button\'s edge and words read at 3:1 and 4.5:1', m.accent.outline.borderWidth > 0 && edge >= 3 && ratio(m.accent.outline.ink, m.accent.section) >= 4.5, {edge, ink: ratio(m.accent.outline.ink, m.accent.section), accent: m.accent});
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
      // The rhythm between blocks: space-3 (24 px at 1440, the prototype's value).
      check('a heading and the text after it stand space-3 apart', near(m.rhythm.text - m.rhythm.heading, m.space3), {gap: m.rhythm.text - m.rhythm.heading, space3: m.space3});
      check('a container and the block after it stand space-3 apart', near(m.rhythm.button - m.rhythm.box, m.space3), {gap: m.rhythm.button - m.rhythm.box, space3: m.space3});
      if (width === 1440) check('the rhythm is the prototype\'s 24 px at the desktop', near(m.space3, 24), {space3: m.space3});
      // The inset is the padding alone: no heading margin on top, no paragraph margin below.
      check('the first block (h2) starts at the section\'s padding', near(m.firstTop, m.first.padTop) && near(m.firstTop, m.space8), {firstTop: m.firstTop, padTop: m.first.padTop, space8: m.space8});
      check('the last block ends at the section\'s padding', near(m.lastBottom, m.first.padBottom), {lastBottom: m.lastBottom, padBottom: m.first.padBottom});
      // No second gutter: the container's text is exactly as wide as the section's own.
      check('a container in a section is as wide as the section\'s text on the phone', width >= 1024 || near(m.box.width, m.sectionText.width), {box: m.box.width, section: m.sectionText.width});
      if (width === 390) check('the phone measure is 366 px', near(m.box.width, 366), {box: m.box.width});
      // Alignment and visibility of the text blocks, per screen.
      check('a heading aligns per screen', m.texts.centred === (width >= 1024 ? 'start' : 'center'), {texts: m.texts});
      check('a paragraph shows only where it is not hidden', width >= 1024 ? m.texts.wideOnly === 'block' && m.texts.wideBox > 0 : m.texts.wideOnly === 'none', {texts: m.texts});
      check('a paragraph aligned to the end ends at its box', m.texts.end === 'end' && near(m.texts.endText.right, m.texts.endText.box), {texts: m.texts});
      // G-39: the lead paragraph.
      check('a lead paragraph is the large body text in the variant ink', near(m.lead.size, width >= 1024 ? 20 : 16) && m.lead.size > m.lead.body && m.lead.color !== m.lead.bodyColor, {lead: m.lead});
      // sf-button href.
      const same = m.link.look && m.link.buttonLook && ['background', 'color', 'height', 'width', 'padding', 'radius', 'display', 'label'].every((key) => m.link.look[key] === m.link.buttonLook[key]);
      check('a button keeps its own width, as the prototype\'s inline button', m.button && m.button.box.width < m.sectionText.width / 2, {button: m.button?.box.width, section: m.sectionText.width});
      check('a button with href draws a link', m.link.tag === 'a' && m.link.href === '#docs', {link: m.link});
      check('the link has the button\'s look, no underline', same && m.link.look.decoration === 'none', {look: m.link.look, buttonLook: m.link.buttonLook});
      check('disabled, the link has no href and says aria-disabled', m.link.off.tag === 'a' && !m.link.off.href && m.link.off.role === 'link' && m.link.off.disabled === 'true', {off: m.link.off});
      check('an unsafe scheme draws a button', m.link.unsafe.tag === 'button' && !m.link.unsafe.href, {unsafe: m.link.unsafe});
      // The keyboard: Tab reaches the link (never the disabled one), Enter follows it.
      await tab.evaluate(() => { document.querySelector('[data-sf-composition-id="button"] .sf-button').focus(); });
      const reached = [];
      for (let step = 0; step < 6; step += 1) {
        await tab.keyboard.press('Tab');
        reached.push(await tab.evaluate(() => document.activeElement?.closest('[data-sf-composition-id], #raw-off')?.getAttribute('data-sf-composition-id') || document.activeElement?.closest('#raw-off')?.id || document.activeElement?.localName));
        if (reached.at(-1) === 'link') break;
      }
      check('Tab reaches the link next', reached[0] === 'link', {reached});
      await tab.keyboard.press('Enter');
      await tab.waitForFunction(() => location.hash === '#docs', null, {timeout: 3000}).catch(() => {});
      check('Enter follows the link', await tab.evaluate(() => location.hash) === '#docs');
      const offReached = await tab.evaluate(() => { const off = document.querySelector('#raw-off .sf-button'); off.focus(); return document.activeElement === off; });
      check('the disabled link is not focusable', !offReached);
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
