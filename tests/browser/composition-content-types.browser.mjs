#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The structured-content types on the built bytes (the content standard's
// step 3). The Document holding every type (tests/fixtures/composition/
// structured-content.json) is rendered by the built composition module -- the
// one a host imports from the distribution -- and drawn by the Loader with the
// built sheets, in the light and the dark theme, 1280 and 390 px wide:
//
// - nothing is wider than the window: no horizontal scroll of the page;
// - each display part is drawn: the alert's fill, the table's frame, the
//   divider's line, the card's edge, the figure's ratio, the procedure's
//   markers and line, the highlighted code, the tabs bound by their runtime;
// - the tabs switch panels; the details open on a click of the summary;
// - the content.html block ran nothing and kept no script;
// - the content.file row is sf-download-file's: framed, its icon, name and
//   size on one line, a link that downloads;
// - with no script at all, the details still open and close (native) and the
//   file is still a download link.
//
// PROBE_SHOTS=<folder> keeps a screenshot of each theme and width.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const shots = process.env.PROBE_SHOTS ? resolve(process.env.PROBE_SHOTS) : null;
if (shots) mkdirSync(shots, {recursive: true});

// The built module, as a host imports it: its own imports (the html@1 subset
// among them) resolve inside the distribution or this import fails.
const composition = await import(pathToFileURL(join(parts.core, 'js', 'composition', 'index.mjs')).href);
const fixture = JSON.parse(readFileSync(new URL('../fixtures/composition/structured-content.json', import.meta.url), 'utf8'));
const escape = (value) => String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
// Diagram and math draw through a renderer the host registers; this host
// shows the source, which is what a page without the engine would show.
const registry = composition.extendRegistry([], {
  'content.diagram': ({node}) => `<figure class="sf-figure" data-sf-composition-id="${escape(node.id)}"><pre class="m-0">${escape(node.data.source)}</pre><figcaption class="sf-figure-caption">${escape(node.props?.title ?? '')}</figcaption></figure>`,
  'content.math': ({node}) => `<p role="math" aria-label="${escape(node.props?.label ?? '')}" data-sf-composition-id="${escape(node.id)}"><code>${escape(node.data.source)}</code></p>`,
});
const rendered = await composition.render(fixture, {registry});
if (rendered.diagnostics.length) throw new Error(`render: ${JSON.stringify(rendered.diagnostics)}`);

const FIGURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#1e5aa8"/><circle cx="320" cy="180" r="120" fill="#ffffff"/></svg>';
const STYLE = '<style>body{margin:0}.flow{max-inline-size:960px;margin:0 auto;padding:16px;display:flow-root}.flow article>*+*{margin-block-start:var(--sf-content--space-block)}</style>';
const page = (theme, scripts) => `<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${scripts ? '<script>window.sfPath=\'/distr/\';window.sfSmartPath=\'/distr/\';</script>' : ''}
<link rel="stylesheet" href="/distr/core/css/core.css">
${scripts ? '<script src="/distr/core/js/core.js"></script>' : ''}${STYLE}</head><body><div class="flow">${rendered.html}</div></body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const pageMatch = path.match(/^\/(light|dark)(-static)?$/u);
  if (pageMatch) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(pageMatch[1], !pageMatch[2]));
  }
  if (path === '/figure.svg') {
    response.writeHead(200, {'content-type': 'image/svg+xml'});
    return response.end(FIGURE);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const seen = {};
const fail = (where, said, got) => failures.push({where, said, ...(got === undefined ? {} : {got})});
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const where = `${theme} ${width}`;
      // The page's own theme and the system's agree, so the theme runtime keeps it.
      const tab = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.goto(`${origin}/${theme}`);
      // Drawn: the Loader has fetched the sheets the markup names, the code is
      // highlighted, the tabs are bound and the figure's image has arrived.
      await tab.waitForFunction(() => {
        const ready = (selector, test) => { const node = document.querySelector(selector); return node && test(node); };
        return ready('.sf-highlight', (node) => node.classList.contains('init'))
          && ready('.sf-tabs-top', (node) => node.getAttribute('role') === 'tablist')
          && ready('.sf-card', (node) => getComputedStyle(node).borderTopWidth !== '0px')
          && ready('.sf-procedure-step', (node) => getComputedStyle(node, '::before').content.includes('counter'))
          && ready('.sf-alert', (node) => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(node).borderTopWidth !== '0px')
          && ready('.table-frame', (node) => getComputedStyle(node).borderTopWidth !== '0px')
          && ready('.sf-download-file', (node) => getComputedStyle(node).borderTopWidth !== '0px')
          && [...document.querySelectorAll('img')].every((image) => image.complete && image.naturalWidth > 0);
      }, null, {timeout: 15000}).catch(() => fail(where, 'the page did not finish drawing'));
      await tab.waitForTimeout(300);
      const state = await tab.evaluate(() => {
        const box = (selector) => { const node = document.querySelector(selector); if (!node) return null; const rect = node.getBoundingClientRect(); return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height}; };
        const style = (selector, pseudo = null) => { const node = document.querySelector(selector); return node ? getComputedStyle(node, pseudo) : null; };
        const viewport = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('.flow article *')].filter((node) => {
          if (node.closest('.sf-highlight__wrap, .table-frame, pre')) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.right > viewport + 0.5;
        }).map((node) => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`).slice(0, 5);
        const markers = [...document.querySelectorAll('.sf-procedure-step')].map((step) => {
          const before = getComputedStyle(step, '::before');
          const after = getComputedStyle(step, '::after');
          return {content: before.content, width: before.width, line: after.content !== 'none' && after.content !== 'normal' ? after.height : null};
        });
        const figureMedia = box('[data-sf-composition-id="figure"] .sf-figure-media');
        const mediaFigure = box('[data-sf-composition-id="media"] .sf-figure-media');
        const mediaText = box('[data-sf-composition-id="media"] > .min-w-0');
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewport,
          wide,
          alert: {background: style('.sf-alert').backgroundColor, border: style('.sf-alert').borderTopWidth},
          table: {border: style('.table-frame').borderTopWidth, radius: style('.table-frame').borderTopLeftRadius, head: style('.table-frame th').backgroundColor},
          divider: {height: box('.sf-divider').height, background: style('.sf-divider').backgroundColor},
          cards: [...document.querySelectorAll('.sf-card')].map((card) => ({border: getComputedStyle(card).borderTopWidth, padding: getComputedStyle(card).paddingTop, plain: card.classList.contains('sf-card--plain'), color: getComputedStyle(card).borderTopColor})),
          gridColumns: style('[data-sf-composition-id="grid"]').gridTemplateColumns.split(' ').length,
          figure: {ratio: figureMedia ? figureMedia.width / figureMedia.height : null, fit: style('[data-sf-composition-id="figure"] img').objectFit, caption: style('.sf-figure-caption').color},
          media: {side: mediaFigure && mediaText ? (mediaFigure.right <= mediaText.left + 1 ? 'left' : mediaFigure.bottom <= mediaText.top + 1 ? 'above' : 'other') : null, ratio: mediaFigure ? mediaFigure.width / mediaFigure.height : null},
          markers,
          current: document.querySelector('.sf-procedure-step--current')?.getAttribute('aria-current'),
          highlighted: document.querySelectorAll('.sf-highlight code span[class^="hljs"]').length,
          tabs: {role: document.querySelector('.sf-tabs-top')?.getAttribute('role'), hidden: [...document.querySelectorAll('.sf-tabs-main-tab')].map((panel) => panel.hidden)},
          details: document.querySelector('details').open,
          file: (() => {
            const link = document.querySelector('[data-sf-composition-id="file"]');
            const part = (selector) => link?.querySelector(selector);
            const row = (selector) => part(selector)?.getBoundingClientRect();
            const name = row('.sf-download-file__name');
            const size = row('.sf-download-file__size');
            return {
              tag: link?.tagName.toLowerCase(), download: link?.hasAttribute('download'), border: link ? getComputedStyle(link).borderTopWidth : null,
              icon: part('.sf-icon')?.textContent, name: part('.sf-download-file__name')?.textContent, size: part('.sf-download-file__size')?.textContent,
              oneLine: Boolean(name && size && Math.abs((name.top + name.bottom) / 2 - (size.top + size.bottom) / 2) < 2),
            };
          })(),
          html: {pwned: window.__pwned === true, scripts: document.querySelectorAll('[data-sf-composition-id="html"] script, [data-sf-composition-id="html"] img').length},
          theme: document.documentElement.className,
          bodyColor: getComputedStyle(document.body).color,
        };
      });
      seen[where] = state;
      if (errors.some((message) => !/publicPath/u.test(message))) fail(where, 'page errors', errors);
      seen.bodyColors = {...seen.bodyColors, [where]: state.bodyColor};
      if (state.scrollWidth > state.viewport) fail(where, 'the page scrolls sideways', {scrollWidth: state.scrollWidth, viewport: state.viewport});
      if (state.wide.length) fail(where, 'blocks wider than the window', state.wide);
      if (state.alert.background === 'rgba(0, 0, 0, 0)' && state.alert.border === '0px') fail(where, 'the alert is not drawn', state.alert);
      if (state.table.border !== '1px' || state.table.radius === '0px') fail(where, 'the table has no frame', state.table);
      if (Math.round(state.divider.height) !== 1 || state.divider.background === 'rgba(0, 0, 0, 0)') fail(where, 'the divider is not one line', state.divider);
      for (const card of state.cards) {
        const drawn = card.plain ? card.padding === '0px' : card.border === '1px' && card.padding !== '0px';
        if (!drawn) fail(where, 'a card is drawn as its variant says', card);
      }
      const columns = width >= 1280 ? 3 : 1;
      if (state.gridColumns !== columns) fail(where, `the grid has ${columns} columns`, state.gridColumns);
      if (!state.figure.ratio || Math.abs(state.figure.ratio - 16 / 9) > 0.02 || state.figure.fit !== 'contain') fail(where, 'the figure keeps 16/9 and contains its image', state.figure);
      if (!state.media.ratio || Math.abs(state.media.ratio - 4 / 3) > 0.02) fail(where, 'the media picture keeps 4/3', state.media);
      if (state.media.side !== (width >= 1280 ? 'left' : 'above')) fail(where, 'the media picture stands on the left, and above the text on a phone', state.media);
      if (state.markers.length !== 3 || state.markers.some((marker) => !marker.content.includes('counter'))) fail(where, 'the procedure numbers its three steps', state.markers);
      if (state.markers[0]?.line === null || state.markers[1]?.line === null || state.markers[2]?.line !== null) fail(where, 'a line runs from each marker to the next, none after the last', state.markers);
      if (state.current !== 'step') fail(where, 'the current step says so', state.current);
      if (state.highlighted === 0) fail(where, 'the code is highlighted');
      if (state.tabs.role !== 'tablist' || JSON.stringify(state.tabs.hidden) !== '[false,true]') fail(where, 'the tabs are bound with the first panel shown', state.tabs);
      if (state.details) fail(where, 'the details start closed');
      if (state.file.tag !== 'a' || !state.file.download || state.file.border !== '1px' || state.file.icon !== 'picture_as_pdf' || state.file.name !== 'Annual report.pdf' || state.file.size !== '1.4 MB' || !state.file.oneLine) fail(where, 'the file is a framed download row with its icon, name and size', state.file);
      if (state.html.pwned || state.html.scripts) fail(where, 'content.html ran or kept something', state.html);
      // Behaviour: the second tab, then the details.
      await tab.click('.sf-tabs-top button:nth-child(2)');
      const switched = await tab.evaluate(() => [...document.querySelectorAll('.sf-tabs-main-tab')].map((panel) => panel.hidden));
      if (JSON.stringify(switched) !== '[true,false]') fail(where, 'the second tab shows its panel', switched);
      await tab.click('details > summary');
      if (!(await tab.evaluate(() => document.querySelector('details').open))) fail(where, 'the summary opens the details');
      if (shots) await tab.screenshot({path: join(shots, `content-types-${theme}-${width}.png`), fullPage: true});
      await tab.close();
    }
  }
  // The dark theme is drawn: its text is not the light theme's.
  if (seen.bodyColors['light 1280'] === seen.bodyColors['dark 1280']) fail('dark', 'the dark theme draws its own text colour', seen.bodyColors);
  // No script at all: the details are the native element.
  const context = await browser.newContext({javaScriptEnabled: false, viewport: {width: 390, height: 900}});
  const tab = await context.newPage();
  await tab.goto(`${origin}/light-static`);
  const before = await tab.evaluate(() => document.querySelector('details').open).catch(() => null);
  await tab.click('details > summary');
  const opened = await tab.locator('details').evaluate((node) => node.open).catch(() => null);
  const shown = await tab.locator('details > div').isVisible();
  await tab.click('details > summary');
  const closed = await tab.locator('details').evaluate((node) => node.open).catch(() => null);
  const file = await tab.evaluate(() => { const link = document.querySelector('[data-sf-composition-id="file"]'); return {tag: link?.tagName.toLowerCase(), download: link?.hasAttribute('download'), href: link?.getAttribute('href')}; });
  seen.noScript = {before, opened, shown, closed, file};
  if (before !== false || opened !== true || !shown || closed !== false) fail('no script', 'the details open and close natively', seen.noScript);
  if (file.tag !== 'a' || !file.download || file.href !== './report.pdf') fail('no script', 'the file is a download link', file);
  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('COMPOSITION_CONTENT_TYPES_OK');
