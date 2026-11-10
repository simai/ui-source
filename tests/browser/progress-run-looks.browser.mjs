#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--shots /absolute/dir]
// sf-progress-run 1.3 (owner decision C34) on the built bytes, over the
// docs-ready demo tests/browser/progress-run-looks.page.html, at 1440 and 390,
// light and dark, normal and compact density:
//   - states and colours: each state's badge (activity or status) and bar status;
//     partial is warning (never success), paused warning, cancelled neutral;
//   - the counts line: one line of text, zero counters left out, only the
//     error count coloured and it is a link;
//   - spacing: between groups --sf-space-1, bar to figures --sf-space-1/3,
//     result to counts --sf-space-1/4, a divider before the steps, the badge on
//     the first title line; the title at the run's text line (16/24 → 14/20);
//   - density reaches the inner buttons;
//   - keyboard: the error link (Enter) sends report and moves focus to the
//     list; Pause then Continue by two presses of Space, focus kept on the
//     button that replaced the pressed one; Minimize by Space and Expand by
//     Enter, focus on Expand and back on Minimize; a step's log by Enter;
//   - the one status region says the state change, never a percentage;
//   - live: pause, resume, minimize to notice, expand, cancel, retry;
//   - the console stays clean, over three loads of each configuration.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? resolve(process.argv[shotsAt + 1]) : '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const here = dirname(fileURLToPath(import.meta.url));
const demo = readFileSync(join(here, 'progress-run-looks.page.html'), 'utf8');

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(demo);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${/\.(js|mjs|css|json)$/u.test(file) ? '; charset=utf-8' : ''}`, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}/page`;

const failures = [];
const printed = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const settle = async (tab, label) => {
  await tab.waitForFunction(() => customElements.get('sf-progress-run') && customElements.get('sf-badge') && customElements.get('sf-progress-bar')
    && document.querySelector('#sum .sf-progress-run-counts') && document.querySelector('#row-done sf-badge .sf-icon, #row-done sf-badge sf-spinner'), null, {timeout: 30000})
    .catch(() => failures.push(`${label}: the runs never drew`));
  await tab.waitForFunction(() => !document.documentElement.hasAttribute('data-sf-icons'), null, {timeout: 15000})
    .catch(() => failures.push(`${label}: the icon font never settled`));
  // The runtime marks an icon drawn later on its own beat (as on the base pair):
  // wait for the run's icons, so a screenshot shows them.
  await tab.waitForFunction(() => !document.querySelector('.sf-progress-run .sf-icon:not(.sf-icon-loaded)'), null, {timeout: 15000})
    .catch(() => failures.push(`${label}: a run icon never marked loaded`));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
};

// Everything one configuration reads, in one pass over the page.
const read = () => {
  const px = (value) => Number.parseFloat(value) || 0;
  const token = (name) => {
    const probe = document.createElement('div');
    probe.style.blockSize = `var(${name})`;
    document.getElementById('sum').append(probe);
    const value = probe.getBoundingClientRect().height;
    probe.remove();
    return value;
  };
  const rect = (node) => node?.getBoundingClientRect();
  const gapBetween = (one, two) => (one && two ? Math.round((rect(two).top - rect(one).bottom) * 100) / 100 : null);
  const sum = document.querySelector('#sum .sf-progress-run');
  const groups = sum ? [...sum.children].filter((node) => !node.classList.contains('sr-only') && rect(node).height > 0) : [];
  const head = sum?.querySelector('.sf-progress-run-head');
  const title = head?.querySelector('.sf-progress-run-heading');
  const badge = head?.querySelector('sf-badge > .sf-badge'); // the host is display: contents
  const titleStyle = title ? getComputedStyle(title) : null;
  const bar = sum?.querySelector('.sf-progress-run-progress sf-progress-bar > .sf-progress-bar');
  const figures = sum?.querySelector('.sf-progress-run-figures');
  const resultLine = sum?.querySelector('.sf-progress-run-results .sf-progress-run-result');
  const countsLine = sum?.querySelector('.sf-progress-run-counts');
  const counts = countsLine ? [...countsLine.querySelectorAll('.sf-progress-run-count')] : [];
  const neutralInk = countsLine ? getComputedStyle(countsLine).color : '';
  const steps = document.querySelector('#fail .sf-progress-run-steps');
  const stateOf = (id) => {
    const host = document.getElementById(id);
    const root = host?.querySelector('.sf-progress-run');
    const badgeNode = host?.querySelector('sf-badge.sf-progress-run-badge');
    const barNode = host?.querySelector('sf-progress-bar.sf-progress-run-bar');
    const ringNode = host?.querySelector('sf-progress-ring');
    return {
      state: host?.getAttribute('data-state') || [...(root?.classList || [])].find((name) => /^sf-progress-run--(waiting|running|paused|done|partial|failed|cancelled)$/u.test(name))?.slice(17),
      activity: badgeNode?.getAttribute('activity') || null,
      status: badgeNode?.getAttribute('status') || null,
      bar: barNode?.getAttribute('status') || null,
      barIndeterminate: barNode ? barNode.hasAttribute('indeterminate') : null,
      barPaused: barNode ? barNode.hasAttribute('paused') : null,
      ring: ringNode?.getAttribute('status') || null,
      fill: barNode ? getComputedStyle(barNode.querySelector('.sf-progress-bar-indicator, [class*="progress-bar__"], .sf-progress-bar > *') || barNode).backgroundColor : null,
    };
  };
  const buttonHeight = (selector) => {
    const node = document.querySelector(selector);
    const inner = node?.querySelector('button') || node;
    return inner ? Math.round(rect(inner).height * 100) / 100 : null;
  };
  return {
    width: innerWidth,
    tokens: {space1: token('--sf-space-1'), space13: token('--sf-space-1\\/3'), space14: token('--sf-space-1\\/4')},
    groupGaps: groups.slice(1).map((node, index) => ({to: node.className.split(' ')[0], gap: gapBetween(groups[index], node)})),
    title: titleStyle ? {tag: title.tagName, size: px(titleStyle.fontSize), line: px(titleStyle.lineHeight), weight: titleStyle.fontWeight} : null,
    badgeOnFirstLine: title && badge ? (rect(badge).top >= rect(title).top - 1 && rect(badge).top < rect(title).top + px(titleStyle.lineHeight)) : null,
    barToFigures: gapBetween(bar, figures),
    resultToCounts: gapBetween(resultLine, countsLine),
    countsOneBlock: countsLine ? getComputedStyle(countsLine).display : null,
    countsTabular: countsLine ? getComputedStyle(countsLine).fontVariantNumeric : null,
    counts: counts.map((node) => ({
      text: node.textContent.replace(/\s+/gu, ' ').trim(),
      link: Boolean(node.querySelector('a')),
      coloured: getComputedStyle(node.querySelector('a') || node).color !== neutralInk,
    })),
    countsLineHeight: countsLine ? Math.round(rect(countsLine).height) : null,
    countsLineStep: countsLine ? px(getComputedStyle(countsLine).lineHeight) : null,
    divider: steps ? getComputedStyle(steps).borderBlockStartWidth : null,
    states: Object.fromEntries(['sum', 'done', 'cnl', 'fail', 'ind', 'row-run', 'row-paused', 'row-queued', 'row-done', 'row-partial', 'row-failed', 'row-cancelled', 'ntc-run', 'ntc-ind', 'ntc-partial'].map((id) => [id, stateOf(id)])),
    retryHeight: buttonHeight('#sum .sf-progress-run-retry'),
    iconActionHeight: buttonHeight('#row-failed .sf-progress-run-retry'),
    errorsShown: document.querySelectorAll('#sum .sf-progress-run-error').length,
    moreErrors: document.querySelector('#sum .sf-progress-run-more')?.textContent.replace(/\s+/gu, ' ').trim() || null,
    statusRegions: document.querySelectorAll('#sum [role="status"], #sum [aria-live="polite"], #sum [aria-live="assertive"]').length,
    liveFigures: document.querySelectorAll('.sf-progress-run-figures[aria-live], .sf-progress-run-figures [aria-live], .sf-progress-run-done[role="status"]').length,
    horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1,
    logInside: (() => {
      const log = document.querySelector('#fail .sf-progress-run-step-log');
      const card = document.querySelector('#fail .sf-progress-run');
      return log && card ? rect(log).right <= rect(card).right + 0.5 : null;
    })(),
    importTime: document.querySelector('#imp .sf-progress-run-eta')?.textContent.trim() || '',
  };
};

const EXPECTED_STATES = {
  sum: {state: 'partial', status: 'warning', bar: 'warning'},
  done: {state: 'done', activity: 'done', bar: 'success'},
  cnl: {state: 'cancelled', activity: 'stopped', bar: 'neutral'},
  fail: {state: 'failed', activity: 'failed'},
  ind: {state: 'running', activity: 'running', bar: 'neutral', barIndeterminate: true},
  'row-run': {state: 'running', bar: 'neutral', barIndeterminate: false},
  'row-paused': {state: 'paused', bar: 'warning', barPaused: true},
  'row-queued': {state: 'waiting', activity: 'queued'},
  'row-done': {state: 'done', activity: 'done'},
  'row-partial': {state: 'partial', status: 'warning'},
  'row-failed': {state: 'failed', activity: 'failed'},
  'row-cancelled': {state: 'cancelled', activity: 'stopped'},
  'ntc-run': {state: 'running', ring: 'neutral'},
  'ntc-ind': {state: 'running', ring: 'neutral'},
  'ntc-partial': {state: 'partial'},
};
const COUNTS = ['Добавлено 9 214', 'Обновлено 2 746', '40 ошибок'];

const browser = await chromium.launch();
const sizes = {desktop: {width: 1440, height: 1000}, phone: {width: 390, height: 844}};
const measured = {};
try {
  for (const [device, viewport] of Object.entries(sizes)) {
    for (const theme of ['light', 'dark']) {
      for (const density of ['normal', 'compact']) {
        const label = `${device} ${theme} ${density}`;
        for (let load = 1; load <= 3; load += 1) {
          const context = await browser.newContext({viewport, deviceScaleFactor: 1, locale: 'ru-RU', colorScheme: theme});
          const tab = await context.newPage();
          const console = [];
          tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) console.push(`${message.type()}: ${message.text()}`); });
          tab.on('pageerror', (error) => console.push(`pageerror: ${error.message}`));
          tab.on('response', (response) => { if (response.status() >= 400) console.push(`${response.status()} ${response.url()}`); });
          await tab.goto(`${base}?live=off&theme=${theme}&density=${density}`);
          await settle(tab, `${label} load ${load}`);
          const dark = await tab.evaluate(() => document.documentElement.classList.contains('theme-dark'));
          check(dark === (theme === 'dark'), `${label} load ${load}: the page is not in the ${theme} theme`);
          const facts = await tab.evaluate(read);
          check(console.length === 0, `${label} load ${load}: console ${console.join(' | ')}`);
          if (load === 1) measured[label] = facts;
          check(!facts.horizontalScroll, `${label}: the page scrolls sideways`);

          // states and colours
          for (const [id, want] of Object.entries(EXPECTED_STATES)) {
            const got = facts.states[id];
            for (const [key, value] of Object.entries(want)) check(got?.[key] === value, `${label} #${id}: ${key} ${got?.[key]}, wanted ${value}`);
          }
          check(facts.states.sum.status !== 'success' && facts.states.sum.activity !== 'done', `${label}: partial drew success`);

          // the counts line
          check(JSON.stringify(facts.counts.map((count) => count.text.replace(/[  ]/gu, ' '))) === JSON.stringify(COUNTS), `${label}: counts ${JSON.stringify(facts.counts.map((count) => count.text))}`);
          check(facts.counts.filter((count) => count.coloured).length === 1 && facts.counts.at(-1)?.coloured && facts.counts.at(-1)?.link, `${label}: only the error count is coloured and a link (${JSON.stringify(facts.counts)})`);
          check(/tabular-nums/u.test(facts.countsTabular || ''), `${label}: counts are not tabular (${facts.countsTabular})`);
          check(device === 'phone' || facts.countsLineHeight <= facts.countsLineStep + 1, `${label}: the counts take ${facts.countsLineHeight}px, more than one line of ${facts.countsLineStep}`);
          check(facts.errorsShown === 5, `${label}: ${facts.errorsShown} errors shown, wanted 5`);
          check(/35/u.test(facts.moreErrors || ''), `${label}: «more errors» says ${facts.moreErrors}`);

          // spacing
          const near = (value, want) => value !== null && Math.abs(value - want) <= 0.5;
          for (const {to, gap} of facts.groupGaps) check(near(gap, facts.tokens.space1), `${label}: gap before ${to} ${gap}, wanted --sf-space-1 ${facts.tokens.space1}`);
          check(near(facts.barToFigures, facts.tokens.space13), `${label}: bar to figures ${facts.barToFigures}, wanted --sf-space-1/3 ${facts.tokens.space13}`);
          check(near(facts.resultToCounts, facts.tokens.space14), `${label}: result to counts ${facts.resultToCounts}, wanted --sf-space-1/4 ${facts.tokens.space14}`);
          check(facts.divider !== '0px' && facts.divider !== null, `${label}: no divider before the steps (${facts.divider})`);
          check(facts.badgeOnFirstLine === true, `${label}: the badge is not on the first title line`);
          const small = device === 'phone' || density === 'compact';
          check(facts.title?.tag === 'H3' && facts.title.size === (small ? 14 : 16) && facts.title.line === (small ? 20 : 24) && Number(facts.title.weight) >= 600,
            `${label}: title ${JSON.stringify(facts.title)}, wanted H3 ${small ? '14/20' : '16/24'} semibold`);
          check(facts.logInside === true, `${label}: the failed step's log runs past the card`);
          check(!/меньше/u.test(facts.importTime), `${label}: a run at 0 with no rate yet says «${facts.importTime}», wanted the estimating words`);
          check(facts.statusRegions === 1, `${label}: ${facts.statusRegions} status regions in a run, wanted 1`);
          check(facts.liveFigures === 0, `${label}: the figures are live`);
          if (shots && load === 1) await tab.screenshot({path: join(shots, `${device}-${theme}-${density}.png`), fullPage: true});
          await context.close();
        }
      }
    }
  }

  // density reaches the inner buttons
  for (const device of Object.keys(sizes)) for (const theme of ['light']) {
    const normal = measured[`${device} ${theme} normal`];
    const compact = measured[`${device} ${theme} compact`];
    check(device === 'phone' || (compact.retryHeight < normal.retryHeight), `${device}: Retry ${normal.retryHeight} → ${compact.retryHeight}, density did not reach it`);
    check(device === 'phone' || (compact.iconActionHeight < normal.iconActionHeight), `${device}: compact row Retry ${normal.iconActionHeight} → ${compact.iconActionHeight}`);
  }

  // keyboard and live behaviour, desktop light, three loads
  for (let load = 1; load <= 3; load += 1) {
    const label = `live load ${load}`;
    const context = await browser.newContext({viewport: sizes.desktop, deviceScaleFactor: 1, locale: 'ru-RU'});
    const tab = await context.newPage();
    const console = [];
    tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) console.push(`${message.type()}: ${message.text()}`); });
    tab.on('pageerror', (error) => console.push(`pageerror: ${error.message}`));
    await tab.goto(`${base}?step=40`);
    await settle(tab, label);
    const log = () => tab.evaluate(() => [...document.querySelectorAll('#events li')].map((item) => item.textContent.replace(/^\S+ /u, '')).reverse());
    const state = (id) => tab.evaluate((target) => {
      const host = document.getElementById(target);
      return {
        state: host.getAttribute('data-state'),
        view: host.querySelector('.sf-progress-run')?.className.match(/sf-progress-run--view-(\w+)/u)?.[1],
        status: host.querySelector('[role="status"]')?.textContent.replace(/\s+/gu, ' ').trim(),
        activity: host.querySelector('sf-badge.sf-progress-run-badge')?.getAttribute('activity'),
        bar: host.querySelector('sf-progress-bar.sf-progress-run-bar')?.getAttribute('status'),
        value: host.value,
      };
    }, id);
    await tab.waitForFunction(() => document.getElementById('imp').value > 400, null, {timeout: 15000}).catch(() => failures.push(`${label}: the live run never moved`));
    const statusWhileRunning = (await state('imp')).status;
    check(!/%/u.test(statusWhileRunning || ''), `${label}: the status region says a percentage while running («${statusWhileRunning}»)`);

    // Pause by Space
    await tab.focus('#imp .sf-progress-run-pause button');
    await tab.keyboard.press('Space');
    await tab.waitForFunction(() => document.getElementById('imp').getAttribute('data-state') === 'paused', null, {timeout: 5000}).catch(() => {});
    const paused = await state('imp');
    check(paused.state === 'paused' && paused.activity === 'paused' && paused.bar === 'warning', `${label}: after Pause ${JSON.stringify(paused)}`);
    check(/пауз/iu.test(paused.status || '') && !/%/u.test(paused.status || ''), `${label}: paused status says «${paused.status}»`);
    const heldAt = paused.value;
    await tab.waitForTimeout(600);
    check((await state('imp')).value === heldAt, `${label}: the value moved while paused`);
    // The run swapped Pause for Continue: focus is on Continue (WCAG 2.4.3),
    // so the second Space goes on without the probe touching focus.
    const focusOn = () => tab.evaluate(() => {
      const host = document.activeElement?.closest('sf-button, sf-button-icon');
      return host ? [...host.classList].find((name) => name.startsWith('sf-progress-run-')) || host.localName : document.activeElement?.localName;
    });
    const afterPause = await focusOn();
    check(afterPause === 'sf-progress-run-resume', `${label}: after Pause by Space focus is on ${afterPause}, wanted Continue`);
    await tab.keyboard.press('Space');
    await tab.waitForFunction(() => document.getElementById('imp').getAttribute('data-state') === 'running', null, {timeout: 5000}).catch(() => failures.push(`${label}: the second Space did not resume`));
    await tab.waitForTimeout(150);
    const afterResume = await focusOn();
    check(afterResume === 'sf-progress-run-pause', `${label}: after Continue by Space focus is on ${afterResume}, wanted Pause`);

    // minimize by Space → notice, focus on Expand → Enter → full, focus on Minimize
    await tab.focus('#imp .sf-progress-run-minimize button');
    await tab.keyboard.press('Space');
    await tab.waitForFunction(() => document.querySelector('#imp .sf-progress-run--view-notice'), null, {timeout: 5000}).catch(() => failures.push(`${label}: minimize did not reach notice`));
    await tab.waitForTimeout(150);
    const afterMinimize = await focusOn();
    check(afterMinimize === 'sf-progress-run-expand', `${label}: after Minimize focus is on ${afterMinimize}, wanted Expand`);
    await tab.keyboard.press('Enter');
    await tab.waitForFunction(() => document.querySelector('#imp .sf-progress-run--view-full'), null, {timeout: 5000}).catch(() => failures.push(`${label}: Enter on Expand did not reach full`));
    await tab.waitForTimeout(150);
    const afterExpand = await focusOn();
    check(afterExpand === 'sf-progress-run-minimize', `${label}: after Expand focus is on ${afterExpand}, wanted Minimize`);

    // cancel → neutral, retry starts again
    await tab.click('#imp .sf-progress-run-cancel');
    await tab.waitForFunction(() => document.getElementById('imp').getAttribute('data-state') === 'cancelled', null, {timeout: 5000}).catch(() => failures.push(`${label}: cancel did not end the run`));
    const cancelled = await state('imp');
    check(cancelled.activity === 'stopped' && cancelled.bar === 'neutral', `${label}: cancelled ${JSON.stringify(cancelled)}`);
    await tab.click('#imp .sf-progress-run-retry');
    await tab.waitForFunction(() => document.getElementById('imp').getAttribute('data-state') === 'running', null, {timeout: 5000}).catch(() => failures.push(`${label}: retry did not restart`));

    // report by Enter on the error link, focus to the list
    await tab.focus('#sum .sf-progress-run-count-link');
    await tab.keyboard.press('Enter');
    await tab.waitForTimeout(200);
    const focused = await tab.evaluate(() => document.activeElement?.closest('#sum')?.matches?.('#sum') && document.activeElement.classList.contains('sf-progress-run-errors'));
    check(focused, `${label}: Enter on the error link did not move focus to the error list`);
    const retryDetail = await tab.evaluate(() => new Promise((done) => {
      document.getElementById('sum').addEventListener('sf-progress-run-retry', (event) => done(event.detail), {once: true});
      document.querySelector('#sum .sf-progress-run-retry button').click();
    }));
    check(retryDetail?.scope === 'failed', `${label}: partial retry ${JSON.stringify(retryDetail)}, wanted scope failed`);

    // a step's log by Enter
    const toggle = '#fail .sf-progress-run-step[data-id="db"] .sf-progress-run-step-toggle';
    const before = await tab.getAttribute(toggle, 'aria-expanded');
    await tab.focus(toggle);
    await tab.keyboard.press('Enter');
    await tab.waitForTimeout(150);
    const after = await tab.getAttribute(toggle, 'aria-expanded');
    const logShown = await tab.evaluate(() => Boolean(document.querySelector('#fail [id$="-db"].sf-progress-run-step-log')));
    check(before === 'false' && after === 'true' && logShown, `${label}: step log toggle ${before} → ${after}, log shown ${logShown}`);
    const failedOpen = await tab.getAttribute('#fail .sf-progress-run-step[data-id="upload"] .sf-progress-run-step-toggle', 'aria-expanded');
    check(failedOpen === 'true', `${label}: the failed step's log is not open by itself`);

    // auto state from the counters alone: an error counter above 0 makes the end partial
    const fromCounters = await tab.evaluate(async () => {
      const run = document.createElement('sf-progress-run');
      run.label = 'Probe';
      run.steps = [{id: 'a', title: 'A', state: 'done'}];
      run.counters = [{id: 'added', label: 'Добавлено', value: 5}, {id: 'errors', label: '{n} ошибка|{n} ошибки|{n} ошибок', value: 3, status: 'error'}];
      document.getElementById('s-unknown').append(run);
      await new Promise((done) => setTimeout(done, 300));
      const state = run.getAttribute('data-state');
      run.remove();
      return state;
    });
    check(fromCounters === 'partial', `${label}: an error counter of 3 with every step done drew ${fromCounters}, wanted partial`);

    const events = await log();
    for (const want of ['#imp pause', '#imp resume', '#imp minimize', '#imp expand', '#imp cancel', '#imp retry', '#sum report']) {
      check(events.some((line) => line.startsWith(want)), `${label}: the event log lacks «${want}» (${events.join(' | ')})`);
    }
    check(console.length === 0, `${label}: console ${console.join(' | ')}`);
    if (load === 1) printed.push(`live events: ${events.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

for (const [label, facts] of Object.entries(measured)) {
  printed.push(`${label}: title ${facts.title?.size}/${facts.title?.line} w${facts.title?.weight}; gaps ${facts.groupGaps.map((gap) => gap.gap).join('/')} (space-1 ${facts.tokens.space1}); bar→figures ${facts.barToFigures}; result→counts ${facts.resultToCounts}; Retry ${facts.retryHeight}; row icon ${facts.iconActionHeight}`);
}
console.log(printed.join('\n'));
if (failures.length) {
  console.error(`progress-run looks: ${failures.length} failure(s)\n${[...new Set(failures)].join('\n')}`);
  process.exit(1);
}
console.log('progress-run looks: every state, the counts, the spacing, density, keyboard and the live run hold over three loads at 1440 and 390, light and dark, normal and compact');
