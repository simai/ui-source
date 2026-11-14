#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_RELOADS=<n> loads each page n times (3 by default).
//
// The base property view (owner decision C180, 2026-11-14; ui-control
// control/research/2026-11-14-view-property-base.md, prototypes/
// view-property-base-study.html): no component of its own --
// sf-list-description in sf-drawer, drawn over the Loader from the built
// bytes (tests/fixtures/property-base-c180-lab.html), at 1440, 1440 compact
// and 390 under a finger, light and dark, each page loaded SF_RELOADS times.
//
//   (2) the head is one row: the title, one icon action (slot header-action)
//       and sf-button-close inside the panel, a button group's gap apart
//       (8, compact 4); more than one action goes to the pinned foot;
//   (3) the label beside its value from a list wider than 20rem: a 24rem
//       panel (a 21.5rem list) beside, a 20rem panel over; on a phone always
//       over; one label size in every layout;
//   (4) on a phone the panel is the whole screen, no corners;
//   (5) long values wrap whole -- a mono value by characters, every line
//       full -- and are cut only with overflow="truncate"; nothing leaves
//       the panel. Console clean on every load.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, '..', 'fixtures', 'property-base-c180-lab.html'));
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/lab') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(fixture);
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

const MEASURE = (id) => {
  const box = (element) => element.getBoundingClientRect();
  const length = (host, value) => {
    const probe = document.createElement('i');
    probe.style.cssText = `position:absolute;display:block;inline-size:${value}`;
    host.append(probe);
    const width = box(probe).width;
    probe.remove();
    return width;
  };
  const drawer = document.getElementById(id);
  const panel = drawer.querySelector('[data-sf-drawer-panel]') ?? document.querySelector(`[data-sf-drawer-id="${id}"] [data-sf-drawer-panel]`);
  const head = panel.querySelector('.sf-drawer-head');
  const close = head?.querySelector('sf-button-close button');
  const action = panel.querySelector('[slot="header-action"]');
  const actionButton = action?.querySelector('button');
  const foot = panel.querySelector('.sf-drawer-foot');
  const rtl = getComputedStyle(panel).direction === 'rtl';
  const lists = [...panel.querySelectorAll('sf-list-description')].map((host) => {
    const rows = [...host.querySelectorAll('.sf-list-description-row')].map((row) => {
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      const text = row.querySelector('.sf-list-description-text');
      let fill = null;
      if (text) {
        const range = document.createRange();
        range.selectNodeContents(text);
        const lines = [];
        for (const rect of range.getClientRects()) {
          const line = lines.find((one) => Math.abs(one.top - rect.top) < 3);
          if (line) line.width += rect.width; else lines.push({top: rect.top, width: rect.width});
        }
        fill = {lines: lines.length, least: lines.length > 1 ? Math.min(...lines.slice(0, -1).map((line) => line.width / box(text).width)) : 1};
      }
      return {
        id: row.dataset.id,
        beside: Math.abs(box(dt).top - box(dd).top) < 2 && (rtl ? box(dd).right <= box(dt).left + 0.5 : box(dd).left >= box(dt).right - 0.5),
        over: box(dd).top >= box(dt).bottom - 0.5,
        label: getComputedStyle(dt).fontSize,
        mono: Boolean(row.querySelector('.sf-list-description-text--mono')),
        wordBreak: text ? getComputedStyle(text).wordBreak : '',
        fill,
        oneLine: text ? box(text).height <= parseFloat(getComputedStyle(text).lineHeight) + 0.5 : true,
        cut: text ? text.scrollWidth > text.clientWidth + 0.5 : false,
        out: text ? box(text).right > box(dd).right + 0.5 || box(text).left < box(dd).left - 0.5 : false,
      };
    });
    return {id: host.id, width: box(host).width, rows};
  });
  return {
    vw: innerWidth,
    panel: {x: box(panel).left, width: box(panel).width, radius: getComputedStyle(panel).borderStartStartRadius, endRadius: getComputedStyle(panel).borderEndStartRadius, overflow: panel.scrollWidth - panel.clientWidth},
    head: head ? {height: box(head).height, close: Boolean(close), closeInside: close ? box(close).right <= box(panel).right + 0.5 && box(close).left >= box(panel).left - 0.5 : false} : null,
    action: actionButton && close ? {inHead: Boolean(action.closest('.sf-drawer-head')), gap: rtl ? box(actionButton).left - box(close).right : box(close).left - box(actionButton).right, group: length(head, 'var(--sf-space-1\\/3)')} : null,
    foot: foot && foot.children.length ? {pinned: Math.abs(box(panel).bottom - box(foot).bottom) < 1} : null,
    lists,
  };
};

const failures = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [device, viewport, density] of [['1440', {width: 1440, height: 900}, 'normal'], ['1440', {width: 1440, height: 900}, 'compact'], ['390', {width: 390, height: 844}, 'normal']]) {
      const phone = device === '390';
      for (let load = 1; load <= reloads; load += 1) {
        const run = `${theme}-${device}-${density} #${load}`;
        const fail = (detail) => failures.push(`${run}: ${detail}`);
        const context = await browser.newContext({viewport, colorScheme: theme, reducedMotion: 'reduce', isMobile: phone, hasTouch: phone});
        const tab = await context.newPage();
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
        tab.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
        tab.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/lab?theme=${theme}&density=${density}`);
        await tab.waitForFunction(() => customElements.get('sf-drawer') && customElements.get('sf-list-description')
          && document.querySelectorAll('.sf-list-description-row').length === 19, null, {timeout: 30000}).catch(() => fail('the page never drew its lists'));
        await tab.evaluate(() => document.fonts.ready);
        const m = {};
        for (const id of ['d-half', 'd-one', 'd-two', 'd-long']) {
          await tab.evaluate((id) => document.getElementById(id).open(), id);
          await tab.waitForTimeout(400);
          m[id] = await tab.evaluate(MEASURE, id);
          await tab.evaluate((id) => document.getElementById(id).close(), id);
          await tab.waitForTimeout(300);
        }

        // (3) beside from a list wider than 20rem; a phone always over.
        const layout = (id, beside) => {
          for (const list of m[id].lists) for (const row of list.rows) {
            if (beside && !row.beside) fail(`${id} ${list.id || ''} ${row.id}: over its value in a ${Math.round(list.width)} px list, expected beside`);
            if (!beside && !row.over) fail(`${id} ${list.id || ''} ${row.id}: beside its value in a ${Math.round(list.width)} px list, expected over`);
          }
        };
        layout('d-half', false);
        layout('d-one', !phone);
        layout('d-two', !phone);
        // One label size in every layout.
        const sizes = new Set(Object.values(m).flatMap((one) => one.lists.flatMap((list) => list.rows.map((row) => row.label))));
        if (sizes.size !== 1) fail(`label sizes ${[...sizes]}`);

        // (2) one head row: the action in the head, the close inside, a group's gap.
        const one = m['d-one'];
        if (!one.head?.close || !one.head.closeInside) fail(`head close ${JSON.stringify(one.head)}`);
        if (!one.action?.inHead) fail('the action is not in the head beside an sf-button-close');
        else if (Math.abs(one.action.gap - one.action.group) > 0.5) fail(`action to close ${one.action.gap}, expected ${one.action.group}`);
        if (!m['d-two'].foot?.pinned) fail('the foot is not pinned to the panel bottom');

        // (4) a phone: the whole screen, no corners.
        if (phone) for (const id of Object.keys(m)) {
          const panel = m[id].panel;
          if (Math.abs(panel.x) > 0.5 || Math.abs(panel.width - m[id].vw) > 0.5) fail(`${id}: panel ${panel.width} at ${panel.x} on a ${m[id].vw} phone`);
          if (panel.radius !== '0px' || panel.endRadius !== '0px') fail(`${id}: radius ${panel.radius} / ${panel.endRadius}`);
        }

        // (5) long values: whole, mono by characters; cut only with truncate.
        const [wrap, cut] = m['d-long'].lists;
        for (const row of wrap.rows) {
          if (row.out) fail(`wrap ${row.id}: the value leaves its cell`);
          if (row.mono && row.wordBreak !== 'break-all') fail(`wrap ${row.id}: word-break ${row.wordBreak}`);
          if (row.mono && row.fill.lines > 1 && row.fill.least < 0.9) fail(`wrap ${row.id}: a line ${Math.round(row.fill.least * 100)} % full`);
          if (row.cut) fail(`wrap ${row.id}: cut without overflow="truncate"`);
          if (row.fill && row.fill.lines < 2) fail(`wrap ${row.id}: one line, the value does not wrap`);
        }
        for (const row of cut.rows) if (!row.oneLine || !row.cut) fail(`truncate ${row.id}: one line ${row.oneLine}, cut ${row.cut}`);
        for (const id of Object.keys(m)) if (m[id].panel.overflow > 0) fail(`${id}: the panel scrolls sideways by ${m[id].panel.overflow}`);

        for (const error of errors) fail(`console: ${error}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('property-base-c180: OK');
