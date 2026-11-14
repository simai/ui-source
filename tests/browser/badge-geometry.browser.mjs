#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-badge's geometry on the built bytes (docs review R019, R020), in light and
// dark, on a narrow and a wide page (the size tokens step at 60rem), each loaded
// twice:
//   - one height per size whatever the look: main, tonal and outline badges of
//     each size (and of each line size) are equally high and wide, the height is
//     the size's (text line + 2 * block padding; the line's on a line size), and
//     the outline's border is inside it -- in sf-badge and in class markup;
//   - side room: by default the text sits --sf-space-1/2 (owner, 2026-11-07) from
//     the badge's edge, border included; tight takes --sf-space-1/3 at every
//     size and line (BG-9, component.badges 1.8.0; the button's text inset before);
//   - a single figure stays round (width = height) in both rooms, two figures do
//     not take the figure mark; icon-only stays square; an anchored count keeps its
//     own geometry (as wide as high, its own padding);
//   - the geometry in dark is the geometry in light, and the outline's border is
//     seen in both.
// With BADGE_GEOMETRY_SHOTS=<folder> each page is also written as a screenshot.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const shots = process.env.BADGE_GEOMETRY_SHOTS ? resolve(process.env.BADGE_GEOMETRY_SHOTS) : '';
if (shots) mkdirSync(shots, {recursive: true});

const APPEARANCES = ['main', 'tonal', 'outline'];
const SCHEMES = ['neutral', 'primary'];
const SIZES = ['1/3', '1/2', '1'];
const LINES = ['1/2', '1', '2'];
const key = (value) => value.replace('/', '-');
// The room each size and line takes, by default and tight (the tokens are read
// in the page, so the adaptive step at 60rem is the page's own).
const ROOM = {
  'size-1/3': {room: '--sf-space-1\\/2', tight: '--sf-space-1\\/3'},
  'size-1/2': {room: '--sf-space-1\\/2', tight: '--sf-space-1\\/3'},
  'size-1': {room: '--sf-space-1\\/2', tight: '--sf-space-1\\/3'},
  'line-1/2': {room: '--sf-space-1\\/2', tight: '--sf-space-1\\/3'},
  'line-1': {room: '--sf-space-1\\/2', tight: '--sf-space-1\\/3'},
  'line-2': {room: '--sf-space-1\\/2', tight: '--sf-space-1\\/3'},
};

const rows = [];
const groups = [];
for (const size of SIZES) {
  for (const tight of [false, true]) {
    const group = `size-${size}${tight ? '-tight' : ''}`;
    const ids = [];
    for (const appearance of APPEARANCES) {
      for (const scheme of SCHEMES) {
        const id = `s-${key(size)}-${appearance}-${scheme}${tight ? '-t' : ''}`;
        ids.push(id);
        rows.push(`<sf-badge id="${id}" size="${size}" appearance="${appearance}" scheme="${scheme}" text="Черновик"${tight ? ' tight' : ''}></sf-badge>`);
      }
      const statusId = `s-${key(size)}-${appearance}-error${tight ? '-t' : ''}`;
      ids.push(statusId);
      rows.push(`<sf-badge id="${statusId}" size="${size}" appearance="${appearance}" status="error" text="Черновик"${tight ? ' tight' : ''}></sf-badge>`);
      // Class markup, as a page writes it without the element.
      const classId = `c-${key(size)}-${appearance}${tight ? '-t' : ''}`;
      ids.push(classId);
      rows.push(`<span id="${classId}" class="sf-badge sf-badge--${appearance} sf-badge--neutral sf-badge--size-${size}${tight ? ' sf-badge--tight' : ''} inline-flex flex-row flex-nowrap justify-center items-center"><span class="sf-badge-text-container flex items-center"><span class="sf-badge-text">Черновик</span></span></span>`);
    }
    groups.push({group, room: `size-${size}`, tight, ids});
    for (const appearance of APPEARANCES) {
      rows.push(`<sf-badge id="f-${key(size)}-${appearance}${tight ? '-t' : ''}" size="${size}" appearance="${appearance}" scheme="primary" text="3"${tight ? ' tight' : ''}></sf-badge>`);
      rows.push(`<sf-badge id="ff-${key(size)}-${appearance}${tight ? '-t' : ''}" size="${size}" appearance="${appearance}" scheme="primary" text="12"${tight ? ' tight' : ''}></sf-badge>`);
    }
    rows.push(`<span id="cf-${key(size)}${tight ? '-t' : ''}" class="sf-badge sf-badge--outline sf-badge--primary sf-badge--size-${size} sf-badge--figure${tight ? ' sf-badge--tight' : ''} inline-flex flex-row flex-nowrap justify-center items-center"><span class="sf-badge-text-container flex items-center"><span class="sf-badge-text">7</span></span></span>`);
    rows.push(`<sf-badge id="k-${key(size)}${tight ? '-t' : ''}" size="${size}" appearance="outline" icon="check" text="Готово" icon-only${tight ? ' tight' : ''}></sf-badge>`);
  }
}
for (const line of LINES) {
  for (const tight of [false, true]) {
    const ids = [];
    for (const appearance of APPEARANCES) {
      const id = `l-${key(line)}-${appearance}${tight ? '-t' : ''}`;
      ids.push(id);
      rows.push(`<sf-badge id="${id}" line="${line}" appearance="${appearance}" status="success" text="Активен"${tight ? ' tight' : ''}></sf-badge>`);
    }
    groups.push({group: `line-${line}${tight ? '-tight' : ''}`, room: `line-${line}`, tight, ids, line});
  }
}
const anchored = ['1', '2', '3'].map((step) => `<span id="a-${step}" class="sf-badge-anchor sf-badge-anchor--size-${step}"><i class="sf-icon" aria-hidden="true">mail</i><span class="sf-badge sf-badge--anchored" aria-hidden="true">3</span></span>`);

const page = (theme) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{background:var(--sf-surface-0);margin:0}main{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;padding:16px}</style></head><body><main>
${rows.join('\n')}
${anchored.join('\n')}
<span id="dc-1" class="sf-badge sf-badge--main sf-badge--error sf-badge--size-1/3" data-count="4"></span>
<span id="dc-2" class="sf-badge sf-badge--main sf-badge--error sf-badge--size-1/3" data-count="12"></span>
</main></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
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
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const url = (theme) => `http://127.0.0.1:${server.address().port}/page?theme=${theme}`;

const settled = async (tab, failures, label) => {
  await tab.waitForFunction(() => customElements.get('sf-badge') && document.querySelector('#k-1 .sf-icon') && document.querySelector('#l-2-outline-t .sf-badge'), null, {timeout: 20000})
    .catch(() => failures.push(`${label}: the badges never drew`));
  await tab.waitForFunction(() => !document.documentElement.hasAttribute('data-sf-icons'), null, {timeout: 15000})
    .catch(() => failures.push(`${label}: the icon font never settled`));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(250);
};

// Every badge's box, its text's inset and border, and the tokens' lengths.
const measure = (room) => {
  const length = (name) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${name})`;
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  const tokens = {};
  for (const {room: name, tight} of Object.values(room)) {
    tokens[name] = length(name);
    tokens[tight] = length(tight);
  }
  // A figure's and a class counter's room (BG-9).
  tokens['--sf-space-1\\/4'] = length('--sf-space-1\\/4');
  const badges = {};
  for (const element of document.querySelectorAll('main > [id]')) {
    const badge = element.matches('.sf-badge') ? element : element.querySelector('.sf-badge');
    if (!badge) continue;
    const rect = badge.getBoundingClientRect();
    const style = getComputedStyle(badge);
    const text = badge.querySelector('.sf-badge-text-container:not(.sr-only)');
    badges[element.id] = {
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      inset: text ? Math.round((text.getBoundingClientRect().left - rect.left) * 100) / 100 : null,
      insetEnd: text ? Math.round((rect.right - text.getBoundingClientRect().right) * 100) / 100 : null,
      border: parseFloat(style.borderTopWidth),
      borderColor: style.borderTopColor,
      paddingInline: parseFloat(style.paddingLeft),
      minBlock: parseFloat(style.minBlockSize),
      lineHeight: parseFloat(style.lineHeight),
      classes: badge.className,
    };
  }
  return {tokens, badges};
};

const near = (one, two) => Math.abs(one - two) < 0.02;
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const [viewport, width] of [['narrow', 390], ['wide', 1280]]) {
    const geometry = {};
    for (const theme of ['theme-light', 'theme-dark']) {
      for (const load of [1, 2]) {
        const label = `${viewport} ${theme} load ${load}`;
        const tab = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        await tab.goto(url(theme));
        await settled(tab, failures, label);
        const {tokens, badges} = await tab.evaluate(measure, ROOM);
        if (errors.length) failures.push(`${label}: page errors ${JSON.stringify(errors)}`);
        if (shots && load === 1) await tab.screenshot({path: join(shots, `badge-geometry-${viewport}-${theme}.png`), fullPage: true});
        await tab.close();

        for (const {group, room, tight, ids, line} of groups) {
          const drawn = ids.map((id) => [id, badges[id]]).filter(([id, box]) => box || !failures.push(`${label}: ${id} not drawn`));
          const [firstId, first] = drawn[0];
          // The size: the text line and the block padding, the line alone on a
          // line size; the border inside it.
          const height = first.minBlock;
          for (const [id, box] of drawn) {
            if (!near(box.height, height)) failures.push(`${label} ${group}: ${id} is ${box.height}px high, the size is ${height}px (${firstId})`);
            if (!near(box.width, first.width)) failures.push(`${label} ${group}: ${id} is ${box.width}px wide, ${firstId} ${first.width}px`);
            if (!Number.isInteger(Math.round(box.height * 100) / 100)) failures.push(`${label} ${group}: ${id} height ${box.height}px is not a whole pixel`);
            const want = tokens[tight ? ROOM[room].tight : ROOM[room].room];
            if (!near(box.inset, want) || !near(box.insetEnd, want)) failures.push(`${label} ${group}: ${id} text sits ${box.inset}/${box.insetEnd}px from the edges, wants ${want}px`);
            if (box.classes.includes('sf-badge--outline')) {
              if (!(box.border > 0)) failures.push(`${label} ${group}: ${id} outline draws no border`);
              if (/rgba\(0, 0, 0, 0\)|transparent/u.test(box.borderColor)) failures.push(`${label} ${group}: ${id} outline border is transparent`);
            }
          }
          if (line) {
            // A line size is the line high: a borderless badge's text line is the
            // whole badge; the outline's text line gives up its border.
            const plain = drawn.find(([, box]) => !box.classes.includes('sf-badge--outline'))[1];
            if (!near(height, plain.lineHeight)) failures.push(`${label} ${group}: the badge is ${height}px high, its line ${plain.lineHeight}px`);
          }
        }
        for (const size of SIZES) {
          for (const suffix of ['', '-t']) {
            for (const appearance of APPEARANCES) {
              const figure = badges[`f-${key(size)}-${appearance}${suffix}`];
              const figures = badges[`ff-${key(size)}-${appearance}${suffix}`];
              const word = badges[`s-${key(size)}-${appearance}-primary${suffix}`];
              if (!figure || !figures || !word) { failures.push(`${label}: figures of ${size} ${appearance}${suffix} not drawn`); continue; }
              if (!near(figure.width, figure.height) || !near(figure.height, word.height)) failures.push(`${label}: a single figure ${size} ${appearance}${suffix} is ${figure.width}x${figure.height}, not round at ${word.height}`);
              if (!figure.classes.includes('sf-badge--figure')) failures.push(`${label}: a single figure ${size} ${appearance}${suffix} has no sf-badge--figure`);
              if (figures.classes.includes('sf-badge--figure')) failures.push(`${label}: two figures ${size} ${appearance}${suffix} took sf-badge--figure`);
              if (!near(figures.height, word.height)) failures.push(`${label}: two figures ${size} ${appearance}${suffix} are ${figures.height}px high, not ${word.height}`);
            }
            const classFigure = badges[`cf-${key(size)}${suffix}`];
            const word = badges[`s-${key(size)}-outline-primary${suffix}`];
            if (!classFigure || !near(classFigure.width, classFigure.height) || !near(classFigure.height, word.height)) failures.push(`${label}: class markup figure ${size}${suffix} is not round: ${JSON.stringify(classFigure)}`);
            const compact = badges[`k-${key(size)}${suffix}`];
            if (!compact || !near(compact.width, compact.height) || !near(compact.height, word.height)) failures.push(`${label}: compact ${size}${suffix} is not square at the size: ${JSON.stringify(compact)}`);
          }
        }
        // A class counter in a row (a menu's): the quarter step, so one figure is round.
        const counter = badges['dc-1'];
        const counters = badges['dc-2'];
        if (!counter || !near(counter.width, counter.height) || !counters || !near(counters.paddingInline, tokens['--sf-space-1\\/4'])) failures.push(`${label}: a class counter (data-count) does not keep the quarter step: ${JSON.stringify([counter, counters])}`);
        for (const step of ['1', '2', '3']) {
          const count = badges[`a-${step}`];
          if (!count || !near(count.width, count.height)) failures.push(`${label}: the anchored count on step ${step} is not round: ${JSON.stringify(count)}`);
        }
        // The text's own width can differ by a pixel between loads (when the
        // medium weight's face arrives), so loads and themes compare the box's
        // height, its text's inset and its border (a round figure's and a square
        // compact's width; two figures only by height, their text may be centred
        // in the size's minimum); other widths are compared within a load, across
        // the looks, above.
        const shape = Object.fromEntries(Object.entries(badges).map(([id, box]) => [id, id.startsWith('ff-') ? [box.height, box.border] : /sf-badge--(figure|icon-only)/u.test(box.classes) ? [box.height, box.width, box.border] : [box.height, box.inset, box.insetEnd, box.border]]));
        geometry[theme] ??= shape;
        if (JSON.stringify(geometry[theme]) !== JSON.stringify(shape)) failures.push(`${label}: the geometry differs from load 1: ${Object.keys(shape).filter((id) => JSON.stringify(shape[id]) !== JSON.stringify(geometry[theme][id])).slice(0, 4).map((id) => `${id} ${JSON.stringify(geometry[theme][id])} -> ${JSON.stringify(shape[id])}`).join('; ')}`);
        if (load === 1) {
          seen[`${viewport} ${theme}`] = {
            tokens,
            heights: Object.fromEntries(groups.map(({group, ids}) => [group, [...new Set(ids.map((id) => badges[id]?.height))]])),
            insets: Object.fromEntries(groups.map(({group, ids}) => [group, [...new Set(ids.map((id) => badges[id]?.inset))]])),
            figures: Object.fromEntries(SIZES.map((size) => [size, [badges[`f-${key(size)}-outline`]?.width, badges[`f-${key(size)}-outline-t`]?.width, badges[`ff-${key(size)}-outline`]?.width]])),
            anchored: ['1', '2', '3'].map((step) => [badges[`a-${step}`]?.width, badges[`a-${step}`]?.height, badges[`a-${step}`]?.paddingInline]),
          };
        }
      }
    }
    if (JSON.stringify(geometry['theme-light']) !== JSON.stringify(geometry['theme-dark'])) {
      const differ = Object.keys(geometry['theme-light']).filter((id) => JSON.stringify(geometry['theme-light'][id]) !== JSON.stringify(geometry['theme-dark'][id]));
      failures.push(`${viewport}: dark draws another geometry than light: ${differ.slice(0, 4).map((id) => `${id} ${JSON.stringify(geometry['theme-light'][id])} / ${JSON.stringify(geometry['theme-dark'][id])}`).join('; ')}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
