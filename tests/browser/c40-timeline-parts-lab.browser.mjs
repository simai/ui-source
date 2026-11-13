#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> keeps a picture of every theme x viewport x density.
//        SF_RELOADS=<n> loads each page n times (3 by default).
//        SF_SHEET_DELAY=<ms> how long the first-paint pass holds the sheets back (1500).
//
// Owner decision C40 (2026-11-09; ui-control control/research/
// 2026-11-09-timeline-parts.md §5 and §6, prototypes/timeline-parts.html and
// list-timeline.html#r092 option 1): sf-time 1.0, sf-change 1.0, block list's
// group heading .sf-group-heading 1.0 and sf-list-timeline 1.1, drawn over the
// Loader from the built bytes on tests/fixtures/c40-timeline-parts-lab.html,
// at 1440 and 390, light and dark, normal and compact density (C22), each
// page loaded SF_RELOADS times; then, per theme and width, one load with the
// new parts' sheets held back, watched frame by frame.
//
//   - sf-time: auto says «28 минут назад», «09:12», «вчера, 19:40»,
//     «5 ноября», «30 дек. 2025 г.»; a time element with the exact moment;
//     tabular numerals; the tooltip with the full moment on keyboard focus,
//     Escape hides it;
//   - sf-change: the old value and the arrow on-surface-variant, the new
//     value on-surface medium, the arrow a picture, «на» for a screen reader,
//     no strikethrough; the arrow glued to the new value's first word, the
//     values wrapping inside the line; list a dl; an empty value «пусто»; a long value
//     folded behind «Показать изменения», revealed in place;
//   - .sf-group-heading: text 1, medium, on-surface, the date beside it text
//     1/2 on-surface-variant; --sf-space-3 above (none above the first),
//     --sf-space-1/2 below; sticky stays at the scroller's top; the divider a
//     separator between two hairlines; sf-list's day groups use it;
//   - sf-list-timeline 1.1: the marker a .sf-featured-icon of the rung below
//     (32/20, phone 28/16, compact 24/16), as wide as the rail, centred on
//     the first line; the connector on its axis; --sf-space-3 between
//     events, 0 inside; day headings the shared heading at the event's size;
//     the actor's avatar inside the line, the name medium; the meta line a
//     step down and quiet; a comment outlined, no fill; error toned; SMS
//     phone_iphone; «Ещё N изменений» revealed in place by Enter with the
//     focus on the first revealed event and sf-list-timeline-expand; steps
//     with aria-current=step; the root paints nothing;
//   - no horizontal scroll; console clean on every load;
//   - first paint: while a sheet is held back no part shows in another size
//     than its final one.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, '..', 'fixtures', 'c40-timeline-parts-lab.html'));
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const sheetDelay = Math.max(0, Number(process.env.SF_SHEET_DELAY || 1500));
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
// The new and changed parts' sheets: what the first-paint pass holds back.
const HELD = /^\/distr\/(?:smart\/(?:time|change|list-timeline|list|confirm-change)|component\/(?:group-heading|featured-icon))\/.*\.css$/u;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
let holdSheets = false;
const held = new Set();
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
  const send = () => {
    response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
    response.end(readFileSync(file));
  };
  if (holdSheets && HELD.test(path)) {
    held.add(path.replace(/^\/distr\//u, ''));
    return setTimeout(send, sheetDelay);
  }
  return send();
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const box = (element) => element.getBoundingClientRect();
  const probeHost = document.querySelector('main');
  const length = (value, host = probeHost) => {
    const probe = document.createElement('i');
    probe.style.cssText = `position:absolute;display:block;block-size:${value}`;
    host.append(probe);
    const height = box(probe).height;
    probe.remove();
    return round(height);
  };
  const colour = (value, host = probeHost) => {
    const probe = document.createElement('i');
    probe.style.cssText = `position:absolute;color:${value}`;
    host.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };
  // The words a person reads: the text outside tooltips (a time's full moment).
  const words = (element) => {
    if (!element) return '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {acceptNode: (node) => (node.parentElement.closest('.sf-tooltip') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)});
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.textContent;
    return text.replace(/\s+/gu, ' ').trim();
  };
  const style = (element) => (element ? getComputedStyle(element) : null);
  const t = {
    space3: length('var(--sf-space-3)'), space12: length('var(--sf-space-1\\/2)'), space1: length('var(--sf-space-1)'), space13: length('var(--sf-space-1\\/3)'),
    size1: length('var(--sf-text-size-1)'), size12: length('var(--sf-text-size-1\\/2)'),
    line1: length('var(--sf-text-height-1)'), line12: length('var(--sf-text-height-1\\/2)'),
    ui1: length('var(--sf-ui-1--control-height)'), ui12: length('var(--sf-ui-1\\/2--control-height)'), ui13: length('var(--sf-ui-1\\/3--control-height)'),
    a6: length('var(--sf-a6)'), a8: length('var(--sf-a8)'),
    icon12: length('var(--sf-icon-size-1\\/2, var(--sf-text-height-1\\/2))'),
    onSurface: colour('var(--sf-on-surface)'), variant: colour('var(--sf-on-surface-variant)'), link: colour('var(--sf-link)'),
    outlineVariant: colour('var(--sf-outline-variant)'),
  };

  // sf-time
  const time = (id) => document.querySelector(`#${id} time`);
  const times = Object.fromEntries(['t-rel', 't-today', 't-yday', 't-year', 't-old', 't-tip'].map((id) => [id, {text: words(time(id)), datetime: time(id)?.getAttribute('datetime') ?? null}]));
  const tip = time('t-tip');
  const timeLook = {numeric: style(tip)?.fontVariantNumeric, tabindex: tip?.getAttribute('tabindex'), whiteSpace: style(tip)?.whiteSpace, colour: style(tip)?.color,
    paragraph: style(tip?.closest('p'))?.color, height: tip ? round(box(tip).height) : 0};

  // sf-change
  const inline = document.querySelector('#c-inline .sf-change');
  const change = inline ? {
    before: words(inline.querySelector('.sf-change__before')), after: words(inline.querySelector('.sf-change__after')),
    beforeColour: style(inline.querySelector('.sf-change__before')).color, afterColour: style(inline.querySelector('.sf-change__after')).color,
    afterWeight: style(inline.querySelector('.sf-change__after')).fontWeight, arrowColour: style(inline.querySelector('.sf-change__arrow')).color,
    arrowHidden: inline.querySelector('.sf-change__arrow').getAttribute('aria-hidden'), sr: words(inline.querySelector('.sr-only')),
    strike: [...inline.querySelectorAll('*')].some((one) => style(one).textDecorationLine.includes('line-through')),
    badges: inline.querySelectorAll('sf-badge, .sf-badge').length,
    // The arrow is glued to the new value's first word; the values wrap inside the sentence.
    pairGlued: (() => { const arrow = inline.querySelector('.sf-change__arrow')?.getClientRects()[0]; const first = inline.querySelector('.sf-change__after')?.getClientRects()[0]; return Boolean(arrow && first) && Math.abs(arrow.top - first.top) < 2; })(),
    pairOverflow: (() => { const line = inline.closest('p'); const after = inline.querySelector('.sf-change__after'); return line && after ? round(Math.max(...[...after.getClientRects()].map((one) => one.right)) - box(line).right) : 99; })(),
    size: style(inline).fontSize, sentenceSize: style(document.getElementById('c-sentence')).fontSize,
  } : null;
  const labelled = words(document.querySelector('#c-label .sf-change'));
  const dl = document.querySelector('#c-list dl.sf-change--list');
  const list = dl ? {rows: dl.querySelectorAll('.sf-change__row').length, terms: [...dl.querySelectorAll('dt')].map(words), last: words(dl.querySelector('.sf-change__row:last-child dd')),
    emptyItalic: style(dl.querySelector('.sf-change__empty'))?.fontStyle, termLeft: [...dl.querySelectorAll('dd')].map((one) => round(box(one).left))} : null;
  const toggle = document.querySelector('#c-long .sf-change__toggle');
  const long = toggle ? {text: words(toggle.querySelector(':scope > span')), expanded: toggle.getAttribute('aria-expanded'), blocksHidden: document.getElementById(toggle.getAttribute('aria-controls'))?.hidden ?? null,
    icon: round(box(toggle.querySelector('sf-icon .sf-icon') ?? toggle.querySelector('sf-icon')).height), toggleHeight: round(box(toggle).height), colour: style(toggle).color} : null;

  // .sf-group-heading
  const heading = (id) => {
    const element = document.getElementById(id);
    if (!element) return null;
    const s = style(element);
    const date = element.querySelector('.sf-group-heading-date');
    return {text: words(element), size: parseFloat(s.fontSize), line: parseFloat(s.lineHeight), weight: s.fontWeight, colour: s.color,
      top: round(box(element).top), bottom: round(box(element).bottom), height: round(box(element).height), marginTop: parseFloat(s.marginTop), marginBottom: parseFloat(s.marginBottom),
      date: date ? {text: words(date), size: parseFloat(style(date).fontSize), colour: style(date).color, weight: style(date).fontWeight} : null,
      role: element.getAttribute('role'), position: s.position};
  };
  const divider = document.getElementById('hd-divider');
  const dividerLook = divider ? {role: divider.getAttribute('role'), label: divider.getAttribute('aria-label'), colour: style(divider).color, size: parseFloat(style(divider).fontSize),
    before: getComputedStyle(divider, '::before').height, after: getComputedStyle(divider, '::after').height, line: getComputedStyle(divider, '::before').backgroundColor} : null;
  const row1 = document.getElementById('hd-row-1');
  const row2 = document.getElementById('hd-row-2');
  const headings = {first: heading('hd-first'), second: heading('hd-second'), sticky: heading('hd-sticky'), divider: dividerLook,
    gapBelowFirst: row1 ? round(box(row1).top - box(document.getElementById('hd-first')).bottom) : null,
    gapAboveSecond: row1 ? round(box(document.getElementById('hd-second')).top - box(row1).bottom) : null,
    gapBelowSecond: row2 ? round(box(row2).top - box(document.getElementById('hd-second')).bottom) : null,
    sfList: [...document.querySelectorAll('#l-day .sf-group-heading')].map((one) => ({text: words(one), size: parseFloat(style(one).fontSize), weight: style(one).fontWeight, colour: style(one).color}))};

  // sf-list-timeline
  const timeline = (id) => {
    const host = document.getElementById(id);
    const root = host?.querySelector('.sf-list-timeline');
    if (!root) return null;
    const L = length('var(--sf-list-timeline--line)', root);
    const items = [...root.querySelectorAll('.sf-list-timeline-item')].map((item, index, all) => {
      const fold = item.classList.contains('sf-list-timeline-item--fold');
      const rail = item.querySelector('.sf-list-timeline-rail');
      const featured = item.querySelector('.sf-featured-icon');
      const glyph = item.querySelector('.sf-list-timeline-icon');
      const headEl = item.querySelector('.sf-list-timeline-head, .sf-list-timeline-run');
      const body = item.querySelector('.sf-list-timeline-body');
      const meta = item.querySelector('.sf-list-timeline-meta');
      const avatar = item.querySelector('sf-avatar');
      const avatarBox = avatar ? (avatar.querySelector('.sf-avatar') ?? avatar) : null;
      const comment = item.querySelector('.sf-list-timeline-comment');
      const actorEl = item.querySelector('.sf-list-timeline-actor');
      const connector = getComputedStyle(item, '::before');
      const markerBox = featured ?? item.querySelector('.sf-list-timeline-dot');
      const firstLineCentre = headEl ? box(headEl).top + L / 2 : null;
      const next = all[index + 1];
      return {
        id: item.dataset.id ?? `fold:${item.dataset.run}`, fold, status: item.dataset.status ?? null, kind: item.dataset.kind ?? null, state: item.dataset.state ?? null,
        current: item.getAttribute('aria-current'),
        top: round(box(item).top), bottom: round(box(item).bottom), padBottom: parseFloat(style(item).paddingBottom),
        bodyBottom: body ? round(box(body).bottom) : (headEl ? round(box(headEl).bottom) : null),
        nextTop: next && next.parentElement === item.parentElement ? round(box(next).top) : null,
        rail: rail ? {width: round(box(rail).width), centreX: round(box(rail).left + box(rail).width / 2)} : null,
        marker: markerBox ? {width: round(box(markerBox).width), height: round(box(markerBox).height), centreY: round(box(markerBox).top + box(markerBox).height / 2),
          classes: featured ? [...featured.classList].filter((one) => /--(error|warning|success|neutral|primary|solid|soft|size-)/u.test(one)).join(' ') : 'dot',
          background: style(markerBox).backgroundColor, ink: style(featured ?? markerBox).color, shadow: featured ? style(featured).boxShadow : ''} : null,
        glyph: glyph ? {text: glyph.textContent.trim(), size: round(box(glyph).height)} : null,
        lineCentre: firstLineCentre === null ? null : round(firstLineCentre),
        connector: connector.content !== 'none' && connector.content !== 'normal' ? {left: round(box(item).left + parseFloat(connector.left) + (parseFloat(connector.width) || parseFloat(connector.borderLeftWidth) || 0) / 2), width: connector.width, style: connector.borderLeftStyle} : null,
        headSize: headEl ? parseFloat(style(headEl).fontSize) : null, headBottom: headEl ? round(box(headEl).bottom) : null,
        metaTop: meta ? round(box(meta).top) : null, metaSize: meta ? parseFloat(style(meta).fontSize) : null, metaColour: meta ? style(meta).color : null, meta: words(meta),
        changesTop: item.querySelector('.sf-list-timeline-changes') ? round(box(item.querySelector('.sf-list-timeline-changes')).top) : null,
        avatar: avatarBox ? {height: round(box(avatarBox).height), top: round(box(avatarBox).top), centreY: round(box(avatarBox).top + box(avatarBox).height / 2)} : null,
        actorWeight: actorEl ? style(actorEl).fontWeight : null,
        change: words(item.querySelector('.sf-list-timeline-change')),
        comment: comment ? {border: style(comment).borderTopWidth, background: style(comment).backgroundColor, padTop: parseFloat(style(comment).paddingTop), padLeft: parseFloat(style(comment).paddingLeft)} : null,
        text: words(item.querySelector('.sf-list-timeline-run-text')),
        visible: box(item).height > 0,
      };
    });
    const days = [...root.querySelectorAll('.sf-list-timeline-day')].map((one) => ({text: words(one), size: parseFloat(style(one).fontSize), weight: style(one).fontWeight, colour: style(one).color,
      top: round(box(one).top), bottom: round(box(one).bottom), marginBottom: parseFloat(style(one).marginBottom), level: one.getAttribute('aria-level'),
      prevBottom: one.parentElement.previousElementSibling ? round(box(one.parentElement.previousElementSibling).bottom) : null,
      firstItemTop: one.nextElementSibling?.firstElementChild ? round(box(one.nextElementSibling.firstElementChild).top) : null}));
    const more = root.querySelector('.sf-list-timeline-more button');
    const quiet = root.querySelector('.sf-list-timeline-quiet');
    return {L, background: style(root).backgroundColor, hostBackground: style(host).backgroundColor, items, days,
      more: more ? round(box(more).height) : null, quiet: quiet ? {text: words(quiet), height: round(box(quiet).height)} : null};
  };
  const cc = document.querySelector('#cc sf-change[layout="list"]');
  return {t, times, timeLook, change, labelled, list, long, headings,
    timelines: {ref: timeline('tl-ref'), steps: timeline('tl-steps'), side: timeline('tl-side'), empty: timeline('tl-empty')},
    confirm: {change: Boolean(cc), rows: cc ? cc.querySelectorAll('.sf-change__row').length : 0, badges: document.querySelectorAll('#cc sf-badge, #cc .sf-badge').length},
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth};
};

// The first-paint watch: every animation frame, the parts' size while shown.
const WATCH = () => {
  const watched = ['t-rel', 't-tip', 'c-inline', 'c-list', 'c-long', 'hd-first', 'l-day', 'tl-ref', 'tl-steps', 'tl-side', 'tl-empty', 'cc'];
  window.__frames = [];
  const started = performance.now();
  const frame = () => {
    const at = Math.round(performance.now() - started);
    const record = {at};
    for (const id of watched) {
      const host = document.getElementById(id);
      if (!host) continue;
      // A Smart host is display: contents (no box): watch what it draws.
      const element = getComputedStyle(host).display === 'contents' ? host.firstElementChild : host;
      if (!element) { record[id] = {shown: false, w: 0, h: 0}; continue; }
      const rect = element.getBoundingClientRect();
      const shown = rect.height > 0 && (element.checkVisibility ? element.checkVisibility({visibilityProperty: true, opacityProperty: true}) : true)
        && ![...element.querySelectorAll('*')].concat(element).every((one) => getComputedStyle(one).visibility === 'hidden');
      record[id] = {shown, w: Math.round(rect.width * 10) / 10, h: Math.round(rect.height * 10) / 10};
    }
    window.__frames.push(record);
    if (at < 6000) requestAnimationFrame(frame);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(frame), {once: true});
  else requestAnimationFrame(frame);
};

const near = (a, b, tolerance = 0.5) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolerance;
const failures = [];
const seen = {};
const firstPaint = {};
const browser = await chromium.launch();

const open = async (viewport, theme, density, errors) => {
  const context = await browser.newContext({viewport, colorScheme: theme, reducedMotion: 'reduce', timezoneId: 'Europe/Moscow', locale: 'ru-RU'});
  const tab = await context.newPage();
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  tab.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  tab.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  return {context, tab};
};
const drawn = (tab, fail) => tab.waitForFunction(() => document.querySelectorAll('#tl-ref .sf-list-timeline-item').length > 5
  && document.querySelector('#tl-steps .sf-list-timeline-item[aria-current="step"]')
  && document.querySelector('#tl-empty .sf-list-timeline-quiet')
  && document.querySelectorAll('#tl-ref sf-time time').length > 5
  && document.querySelector('#c-list dl') && document.querySelector('#c-long .sf-change__toggle')
  && document.querySelector('#t-old time') && document.querySelector('#cc sf-change .sf-change__row')
  && document.querySelectorAll('#l-day .sf-group-heading').length > 1
  && [...document.querySelectorAll('[data-sf-style-pending]')].length === 0,
null, {timeout: 30000}).catch(() => fail('the page never drew every part'));

try {
  for (const theme of ['light', 'dark']) {
    for (const [device, viewport] of [['1440', {width: 1440, height: 1100}], ['390', {width: 390, height: 1800}]]) {
      for (const density of ['normal', 'compact']) {
        const name = `${theme}-${device}-${density}`;
        for (let load = 1; load <= reloads; load += 1) {
          const run = `${name} #${load}`;
          const fail = (detail) => failures.push(`${run}: ${detail}`);
          const errors = [];
          const {context, tab} = await open(viewport, theme, density, errors);
          await tab.goto(`http://127.0.0.1:${server.address().port}/lab?theme=${theme}&density=${density}`);
          await drawn(tab, fail);
          await tab.waitForFunction(() => Array.from(document.querySelectorAll('.sf-icon')).every((icon) => icon.classList.contains('sf-icon-loaded') || !icon.closest('sf-list-timeline, sf-change')), null, {timeout: 10000}).catch(() => {});
          await tab.evaluate(() => document.fonts.ready);
          await tab.mouse.move(0, 0);
          await tab.waitForTimeout(300);
          const m = await tab.evaluate(MEASURE);
          if (load === 1) seen[name] = m;
          if (evidence && load === 1) await tab.screenshot({path: join(evidence, `c40-${name}.png`), fullPage: true});
          const phone = device === '390';
          const compact = density === 'compact';
          const {t} = m;

          // sf-time.
          const timeTexts = ['t-rel', 't-today', 't-yday', 't-year'].map((id) => m.times[id].text).join('|');
          if (timeTexts !== '28 минут назад|09:12|вчера, 19:40|5 ноября' || !/^30 дек\.? 2025/u.test(m.times['t-old'].text)) fail(`sf-time auto ${timeTexts} ${m.times['t-old'].text}`);
          if (m.times['t-rel'].datetime !== '2026-11-09T11:32:00.000Z') fail(`sf-time datetime ${m.times['t-rel'].datetime}`);
          if (m.times['t-tip'].text !== '14:32' || m.timeLook.tabindex !== '0' || m.timeLook.numeric !== 'tabular-nums' || m.timeLook.whiteSpace !== 'nowrap') fail(`sf-time look ${JSON.stringify(m.timeLook)}`);
          if (m.timeLook.colour !== m.timeLook.paragraph) fail(`sf-time colour ${m.timeLook.colour}, its paragraph ${m.timeLook.paragraph}`);

          // sf-change.
          const c = m.change ?? {};
          if (c.before !== 'Собран' || c.after !== 'Передан в доставку') fail(`sf-change values ${c.before} / ${c.after}`);
          if (c.beforeColour !== t.variant || c.arrowColour !== t.variant || c.afterColour !== t.onSurface || c.afterWeight !== '500') fail(`sf-change look ${JSON.stringify(c)} vs ${t.variant} ${t.onSurface}`);
          if (c.arrowHidden !== 'true' || c.sr !== 'на' || c.strike || c.badges) fail(`sf-change a11y/look arrow ${c.arrowHidden} sr «${c.sr}» strike ${c.strike} badges ${c.badges}`);
          if (!c.pairGlued) fail('sf-change: the arrow is not on the new value\'s first line');
          if (c.pairOverflow > 0.5) fail(`sf-change: the new value passes its line by ${c.pairOverflow}px`);
          if (c.size !== c.sentenceSize) fail(`sf-change size ${c.size}, its sentence ${c.sentenceSize}`);
          if (m.labelled !== 'Получатель: пусто → на Ирина Котова') fail(`sf-change show-label «${m.labelled}»`);
          if (m.list?.rows !== 4 || m.list?.terms.join('|') !== 'Вес|Габариты|Склад|Комментарий' || !/^Позвонить → на пусто$/u.test(m.list?.last ?? '') || m.list?.emptyItalic !== 'italic') fail(`sf-change list ${JSON.stringify(m.list)}`);
          if (!phone && new Set(m.list?.termLeft).size !== 1) fail(`sf-change list values start at ${m.list?.termLeft}`);
          if (m.long?.text !== 'Показать изменения' || m.long?.expanded !== 'false' || m.long?.blocksHidden !== true) fail(`sf-change long ${JSON.stringify(m.long)}`);
          if (m.long && !near(m.long.icon, t.line12)) fail(`sf-change toggle icon ${m.long.icon}, rung 1/2 line ${t.line12}`);
          if (m.long && m.long.colour !== t.link) fail(`sf-change toggle colour ${m.long.colour}, link ${t.link}`);

          // .sf-group-heading.
          const h = m.headings;
          for (const one of [h.first, h.second, h.sticky]) {
            if (!one || !near(one.size, t.size1) || one.weight !== '500' || one.colour !== t.onSurface) fail(`heading ${one?.text}: ${one?.size}/${one?.weight}/${one?.colour}, expected ${t.size1}/500/${t.onSurface}`);
          }
          if (h.first?.text !== 'Сегодня 9 ноября' || h.second?.text !== 'Вчера 8 ноября') fail(`heading texts «${h.first?.text}» «${h.second?.text}»`);
          if (!near(h.first?.date?.size, t.size12) || h.first?.date?.colour !== t.variant || h.first?.date?.weight !== '400') fail(`heading date ${JSON.stringify(h.first?.date)}`);
          if (h.first?.marginTop !== 0 || !near(h.second?.marginTop, t.space3) || !near(h.first?.marginBottom, t.space12)) fail(`heading margins ${h.first?.marginTop}/${h.second?.marginTop}/${h.first?.marginBottom}, expected 0/${t.space3}/${t.space12}`);
          if (!near(h.gapBelowFirst, t.space12) || !near(h.gapBelowSecond, t.space12)) fail(`heading gap below ${h.gapBelowFirst}/${h.gapBelowSecond}, expected ${t.space12}`);
          if (h.gapAboveSecond < t.space3 - 0.5) fail(`heading gap above ${h.gapAboveSecond}, expected at least ${t.space3}`);
          if (h.sticky?.position !== 'sticky') fail(`sticky heading ${h.sticky?.position}`);
          if (h.divider?.role !== 'separator' || h.divider?.label !== 'Вчера' || h.divider?.colour !== t.variant || h.divider?.before !== '1px' || h.divider?.after !== '1px' || h.divider?.line !== t.outlineVariant) fail(`divider ${JSON.stringify(h.divider)}`);
          if (h.sfList.length < 2 || h.sfList.some((one) => !near(one.size, t.size1) || one.weight !== '500' || one.colour !== t.onSurface)) fail(`sf-list headings ${JSON.stringify(h.sfList)}`);

          // sf-list-timeline.
          // Research §4: 32/20, phone 28/16. Compact: C22 lowers the rung below
          // (ui-1/2 control height 28), not the research's 24 (--size-1/3): noted.
          const MARK = phone || compact ? 28 : 32;
          const GLYPH = phone || compact ? 16 : 20;
          const ref = m.timelines.ref;
          if (!ref) fail('reference timeline missing');
          else {
            if (ref.background !== 'rgba(0, 0, 0, 0)' || ref.hostBackground !== 'rgba(0, 0, 0, 0)') fail(`timeline paints ${ref.background}/${ref.hostBackground}`);
            const events = ref.items.filter((one) => !one.fold);
            for (const one of events) {
              if (one.marker?.classes !== 'dot') {
                if (!near(one.marker?.width, MARK) || !near(one.marker?.height, MARK)) fail(`${one.id}: marker ${one.marker?.width}x${one.marker?.height}, expected ${MARK}`);
                if (!near(one.glyph?.size, GLYPH)) fail(`${one.id}: glyph ${one.glyph?.size}, expected ${GLYPH}`);
                if (!near(one.rail?.width, MARK)) fail(`${one.id}: rail ${one.rail?.width}, marker ${MARK}`);
              }
              if (!near(one.marker?.centreY, one.lineCentre, 1)) fail(`${one.id}: marker centre ${one.marker?.centreY}, first line centre ${one.lineCentre}`);
              if (one.connector && !near(one.connector.left, one.rail?.centreX, 1)) fail(`${one.id}: connector x ${one.connector.left}, rail axis ${one.rail?.centreX}`);
              if (one.nextTop !== null) {
                if (!near(one.padBottom, t.space3) || !near(one.bottom - one.bodyBottom, t.space3, 1) || !near(one.nextTop, one.bottom, 1)) fail(`${one.id}: between events ${one.bottom - one.bodyBottom} (pad ${one.padBottom}), next at ${one.nextTop} vs ${one.bottom}; expected ${t.space3}`);
              }
              if (one.metaTop !== null && one.changesTop === null && !near(one.metaTop, one.headBottom, 0.5)) fail(`${one.id}: inside the event ${one.metaTop - one.headBottom}, expected 0`);
              if (one.metaTop !== null && (!near(one.metaSize, t.size12) || one.metaColour !== t.variant)) fail(`${one.id}: meta ${one.metaSize}/${one.metaColour}`);
              if (one.avatar && (one.avatar.height > ref.L + 0.5 || !near(one.avatar.centreY, one.lineCentre, 1))) fail(`${one.id}: avatar ${one.avatar.height} at ${one.avatar.centreY}, line ${ref.L} at ${one.lineCentre}`);
              if (one.actorWeight !== null && one.actorWeight !== '500') fail(`${one.id}: actor weight ${one.actorWeight}`);
            }
            const byId = Object.fromEntries(events.map((one) => [one.id, one]));
            if (!byId.comment?.comment || byId.comment.comment.border !== '1px' || byId.comment.comment.background !== 'rgba(0, 0, 0, 0)' || !near(byId.comment.comment.padTop, t.space12) || !near(byId.comment.comment.padLeft, t.space1)) fail(`comment ${JSON.stringify(byId.comment?.comment)}`);
            if (byId.sms?.glyph?.text !== 'phone_iphone') fail(`sms glyph ${byId.sms?.glyph?.text}`);
            if (!/--error/u.test(byId.charge?.marker?.classes ?? '') || byId.charge?.marker?.background === byId.status?.marker?.background) fail(`error marker ${byId.charge?.marker?.classes} ${byId.charge?.marker?.background} vs ${byId.status?.marker?.background}`);
            if (byId.status?.change !== 'Собран → на Передан в доставку') fail(`status change «${byId.status?.change}»`);
            if (!/^14:30$/u.test(byId.status?.meta ?? '')) fail(`status meta «${byId.status?.meta}»`);
            if (!/^09:12 · Карта/u.test(byId.charge?.meta ?? '')) fail(`charge meta «${byId.charge?.meta}»`);
            const folds = ref.items.filter((one) => one.fold);
            if (folds.length !== 1 || !/^Ещё \d+ изменени/u.test(folds[0].text)) fail(`fold ${JSON.stringify(folds.map((one) => one.text))}`);
            if (ref.days.length < 2 || ref.days.some((one) => !near(one.size, events[0].headSize) || one.weight !== '500' || one.colour !== t.onSurface || one.level !== '3')) fail(`day headings ${JSON.stringify(ref.days)}`);
            if (!/^Сегодня/u.test(ref.days[0]?.text ?? '') || !/^Вчера/u.test(ref.days[1]?.text ?? '')) fail(`day words ${ref.days.map((one) => one.text)}`);
            for (const day of ref.days.slice(1)) if (!near(day.top - day.prevBottom, t.space3, 1)) fail(`day «${day.text}» ${day.top - day.prevBottom} below the previous day, expected ${t.space3}`);
            for (const day of ref.days) if (!near(day.firstItemTop - day.bottom, t.space12, 1)) fail(`day «${day.text}» ${day.firstItemTop - day.bottom} above its first event, expected ${t.space12}`);
            const buttonH = compact ? t.ui12 : t.ui12;
            if (!near(ref.more, buttonH)) fail(`«Показать ещё» ${ref.more}, expected ${buttonH}`);
          }
          const steps = m.timelines.steps;
          const currentSteps = steps?.items.filter((one) => one.current === 'step') ?? [];
          if (currentSteps.length !== 1 || currentSteps[0].state !== 'current' || !/inset/u.test(currentSteps[0].marker?.shadow ?? '')) fail(`steps current ${JSON.stringify(currentSteps)}`);
          const dashed = steps?.items.filter((one) => one.connector && one.connector.style === 'dashed').map((one) => one.state) ?? [];
          if (dashed.join(',') !== 'current') fail(`steps dashed after ${dashed}`);
          const side = m.timelines.side;
          if (side && !(side.L <= (ref?.L ?? 0))) fail(`side panel line ${side.L} above ${ref?.L}`);
          // A status without an icon: the dot component's size of the rung (1/2: a6), no new value.
          for (const one of side?.items ?? []) if (one.marker?.classes === 'dot' && (!near(one.marker.width, t.a6) || !near(one.marker.height, t.a6))) fail(`side ${one.id}: dot ${one.marker.width}, expected a6 ${t.a6}`);
          if (!m.timelines.empty?.quiet || m.timelines.empty.quiet.text !== 'Событий пока нет' || !near(m.timelines.empty.quiet.height, t.ui1)) fail(`empty ${JSON.stringify(m.timelines.empty?.quiet)}, expected ${t.ui1}`);
          if (!m.confirm.change || m.confirm.rows !== 2 || m.confirm.badges) fail(`confirm-change ${JSON.stringify(m.confirm)}`);
          if (m.scroll > 0) fail(`horizontal scroll ${m.scroll}`);

          if (load === 1) {
            // sf-time tooltip by keyboard.
            await tab.evaluate(() => document.getElementById('t-before').focus());
            await tab.keyboard.press('Tab');
            await tab.waitForTimeout(200);
            const shownTip = await tab.evaluate(() => { const time = document.querySelector('#t-tip time'); const tip = document.querySelector('#t-tip .sf-tooltip');
              return {focus: document.activeElement === time, hidden: tip?.hidden, text: tip?.textContent.trim(), described: time?.getAttribute('aria-describedby') === tip?.id}; });
            if (!shownTip.focus || shownTip.hidden || !/9 ноября 2026/u.test(shownTip.text ?? '') || !/14:32/u.test(shownTip.text ?? '') || !shownTip.described) fail(`time tooltip ${JSON.stringify(shownTip)}`);
            await tab.keyboard.press('Escape');
            await tab.waitForTimeout(150);
            if (!(await tab.evaluate(() => document.querySelector('#t-tip .sf-tooltip').hidden))) fail('Escape left the time tooltip shown');

            // sf-change reveal by keyboard.
            await tab.evaluate(() => document.querySelector('#c-long .sf-change__toggle').focus());
            await tab.keyboard.press('Enter');
            await tab.waitForTimeout(200);
            const revealed = await tab.evaluate(() => { const toggle = document.querySelector('#c-long .sf-change__toggle'); const blocks = document.getElementById(toggle.getAttribute('aria-controls'));
              return {expanded: toggle.getAttribute('aria-expanded'), hidden: blocks.hidden, labels: [...blocks.querySelectorAll('.sf-change__block-label')].map((one) => one.textContent), text: toggle.querySelector(':scope > span').textContent.trim(), focus: document.activeElement === toggle}; });
            if (revealed.expanded !== 'true' || revealed.hidden || revealed.labels.join('|') !== 'Было|Стало' || revealed.text !== 'Скрыть изменения' || !revealed.focus) fail(`change reveal ${JSON.stringify(revealed)}`);

            // Sticky heading stays at the scroller's top.
            const sticky = await tab.evaluate(() => { const scroller = document.getElementById('hd-scroller'); scroller.scrollTop = 120;
              const top = scroller.getBoundingClientRect().top + parseFloat(getComputedStyle(scroller).borderTopWidth) + parseFloat(getComputedStyle(scroller).paddingTop); return Math.abs(document.getElementById('hd-sticky').getBoundingClientRect().top - top); });
            if (sticky > 1) fail(`sticky heading ${sticky}px off the scroller's top`);

            // «Ещё N» by keyboard: revealed in place, the focus on the first revealed event, the event told.
            const before = await tab.evaluate(() => ({ids: [...document.querySelectorAll('#tl-ref .sf-list-timeline-item')].map((one) => one.dataset.id ?? 'fold')}));
            await tab.evaluate(() => document.querySelector('#tl-ref .sf-list-timeline-run').focus());
            await tab.keyboard.press('Enter');
            await tab.waitForTimeout(400);
            const after = await tab.evaluate(() => ({
              ids: [...document.querySelectorAll('#tl-ref .sf-list-timeline-item')].map((one) => one.dataset.id ?? 'fold'),
              focus: document.activeElement?.closest?.('.sf-list-timeline-item')?.dataset.id ?? document.activeElement?.tagName,
              events: window.__events.filter((one) => one.name === 'sf-list-timeline-expand'),
            }));
            const foldAt = before.ids.indexOf('fold');
            const expand = after.events[0]?.detail ?? {};
            if (after.ids.includes('fold') || after.ids.length !== before.ids.length - 1 + (expand.count ?? -99)) fail(`expand ids ${before.ids} -> ${after.ids}`);
            if (after.focus !== after.ids[foldAt] || after.events.length !== 1 || !Array.isArray(expand.ids) || expand.ids[0] !== after.focus) fail(`expand focus ${after.focus} (fold at ${foldAt} → ${after.ids[foldAt]}), events ${JSON.stringify(after.events)}`);
            seen[name].keyboard = {tooltip: shownTip.text, reveal: revealed.labels, expand, focus: after.focus, sticky};
          }
          if (errors.length) fail(`console ${JSON.stringify(errors)}`);
          await context.close();
        }
      }
    }
  }

  // First paint, frame by frame, with the parts' sheets held back.
  holdSheets = true;
  for (const theme of ['light', 'dark']) {
    for (const [device, viewport] of [['1440', {width: 1440, height: 1100}], ['390', {width: 390, height: 1800}]]) {
      const name = `${theme}-${device}`;
      const fail = (detail) => failures.push(`first paint ${name}: ${detail}`);
      const errors = [];
      held.clear();
      const {context, tab} = await open(viewport, theme, 'normal', errors);
      await tab.addInitScript(WATCH);
      await tab.goto(`http://127.0.0.1:${server.address().port}/lab?theme=${theme}`);
      await drawn(tab, fail);
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(Math.max(1500, sheetDelay));
      const frames = await tab.evaluate(() => window.__frames);
      const last = frames[frames.length - 1];
      const wrong = {};
      const firstShown = {};
      for (const record of frames) {
        for (const [id, one] of Object.entries(record)) {
          if (id === 'at' || !one.shown) continue;
          if (firstShown[id] === undefined) firstShown[id] = record.at;
          const final = last[id];
          if (Math.abs(one.w - final.w) > 1 || Math.abs(one.h - final.h) > 1) (wrong[id] ??= []).push(`${record.at}ms ${one.w}x${one.h} (final ${final.w}x${final.h})`);
        }
      }
      // hd-first is the page's own class markup: no element holds it back, so
      // it shows unstyled until its sheet arrives (recorded, not failed).
      for (const [id, list] of Object.entries(wrong)) if (id !== 'hd-first') fail(`${id} shown in another size in ${list.length} frames, first ${list[0]}`);
      if (!held.size) fail('no sheet was held back: the pattern matched nothing');
      if (errors.length) fail(`console ${JSON.stringify(errors)}`);
      firstPaint[name] = {frames: frames.length, held: [...held].sort(), firstShown, wrongFrames: Object.fromEntries(Object.entries(wrong).map(([id, list]) => [id, list.length]))};
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const pick = (m) => {
  const ref = m.timelines.ref;
  const events = ref?.items.filter((one) => !one.fold) ?? [];
  const icon = events.find((one) => one.marker && one.marker.classes !== 'dot');
  const gaps = events.filter((one) => one.nextTop !== null).map((one) => Math.round((one.bottom - one.bodyBottom) * 100) / 100);
  return {
    tokens: {a6: m.t.a6, a8: m.t.a8, space3: m.t.space3, space12: m.t.space12, line1: m.t.line1, line12: m.t.line12, ui12: m.t.ui12, ui1: m.t.ui1},
    time: Object.values(m.times).map((one) => one.text).join(' | '),
    change: {inline: `${m.change?.before} → ${m.change?.after} (${m.change?.afterWeight})`, list: m.list?.rows, toggleIcon: m.long?.icon, toggle: m.long?.toggleHeight},
    heading: {size: m.headings.first?.size, line: m.headings.first?.line, height: m.headings.first?.height, above: m.headings.second?.marginTop, below: m.headings.gapBelowFirst, date: m.headings.first?.date?.size, divider: m.headings.divider?.before},
    timeline: {L: ref?.L, marker: icon ? `${icon.marker.width}x${icon.marker.height}` : null, glyph: icon?.glyph?.size, rail: icon?.rail?.width,
      markerOffset: Math.max(...events.map((one) => Math.abs((one.marker?.centreY ?? 0) - (one.lineCentre ?? 0)))),
      gaps: [...new Set(gaps)].join(','), inside: [...new Set(events.filter((one) => one.metaTop !== null && one.changesTop === null).map((one) => Math.round((one.metaTop - one.headBottom) * 100) / 100))].join(','),
      avatar: events.find((one) => one.avatar)?.avatar?.height, metaSize: events.find((one) => one.metaSize)?.metaSize,
      days: ref?.days.map((one) => `${one.text} ${one.size}/${one.weight} ↑${one.prevBottom === null ? '-' : Math.round((one.top - one.prevBottom) * 100) / 100} ↓${Math.round((one.firstItemTop - one.bottom) * 100) / 100}`),
      more: ref?.more, empty: m.timelines.empty?.quiet?.height, side: m.timelines.side?.L,
      sideMarker: (() => { const one = m.timelines.side?.items.find((item) => item.marker); return one ? `${one.marker.width}x${one.marker.height} ${one.marker.classes}` : null; })(),
      comment: events.find((one) => one.comment)?.comment},
    keyboard: m.keyboard,
  };
};
console.log(JSON.stringify({reloads, sheetDelay, seen: Object.fromEntries(Object.entries(seen).map(([name, m]) => [name, pick(m)])), firstPaint, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
