#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> keeps a picture of every theme x viewport x density.
//        SF_RELOADS=<n> loads each page n times (3 by default).
//
// «Требует внимания» (owner decision C37, 2026-11-09; ui-control
// control/research/2026-11-09-list-attention.md, prototypes/
// list-attention.html scenes А and Б), drawn by sf-list-attention 1.2.0 over
// the Loader from the built bytes: tests/fixtures/list-attention-lab.html, at
// 1440 and 390, light and dark, normal and compact density (C22), each page
// loaded SF_RELOADS times.
//
//   - badges: the head's summary, one badge per severity in words;
//   - row fields: the filled icon of the status, its word for a screen
//     reader, the title, the meta line object · how long · source, the
//     object a link; the action outline on-surface;
//   - heights on the ladder: a row, the head and the empty line are the
//     rung 3 control height H (56, 48 compact, 52 phone); the icon the
//     ladder's icon 3 (24 / 20);
//   - alignment: the actions and the «⋯» end on one edge; in group mode the
//     affected counts and the actions stand in columns; in a narrow column
//     the action is under the text at its start, the «⋯» on the title's
//     line, and the stacked foot starts on the text edge;
//   - limit and more: five rows and «Все проблемы (8)»;
//   - the empty state «Всё в порядке · проверено 5 мин назад» with «Проверить
//     снова»; on a phone two lines and an icon recheck (owner decision C45);
//   - triage by keyboard: Enter on «⋯», the arrows, Enter on «Отложить на
//     неделю» asks snooze {id, until} (a week on), the row leaves, the focus
//     goes to the next row's «⋯», the notice holds «Вернуть»; Enter on it
//     asks undo, the row is back with the focus; «Не напоминать» only where
//     the person may;
//   - group mode: open groups, «Пройдено» closed, the longest-lasting first;
//   - console clean on every load.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, '..', 'fixtures', 'list-attention-lab.html'));
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
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

const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const box = (element) => element.getBoundingClientRect();
  const length = (host, value) => {
    const probe = document.createElement('i');
    probe.style.cssText = `position:absolute;display:block;block-size:${value}`;
    host.append(probe);
    const height = box(probe).height;
    probe.remove();
    return round(height);
  };
  // Where a text starts: the left of its first glyph.
  const textLeft = (element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {acceptNode: (node) => (node.textContent.trim() && !node.parentElement.closest('.sr-only') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)});
    const node = walker.nextNode();
    if (!node) return null;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()];
    return rects.length ? round(rects[0].left) : null;
  };
  // The words a person reads: text nodes outside icons and visually hidden
  // parts, and drawn (sf-list-attention 1.3.0, owner decision C45, keeps the
  // wide and the narrow form of the quiet card in the markup; the sheet shows
  // one of them).
  const shown = (element) => element.checkVisibility({visibilityProperty: true});
  const words = (element) => {
    if (!element) return '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {acceptNode: (node) => (node.parentElement.closest('.sf-icon, .sr-only') || !shown(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)});
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.textContent;
    return text.replace(/\s+/gu, ' ').trim();
  };
  const control = (row, selector) => {
    const element = row.querySelector(selector);
    if (!element) return null;
    const r = box(element);
    return {left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom), height: round(r.height), width: round(r.width), shown: r.width > 0 && getComputedStyle(element).display !== 'none'};
  };
  const list = (id) => {
    const host = document.getElementById(id);
    const root = host.querySelector('.sf-list-attention');
    const rows = [...host.querySelectorAll('.sf-list-attention-item')].map((row) => {
      const title = row.querySelector('.sf-list-attention-title');
      const meta = row.querySelector('.sf-list-attention-meta');
      const iconEl = row.querySelector('.sf-list-attention-icon');
      const action = row.querySelector('sf-button.sf-list-attention-action');
      return {
        id: row.dataset.id ?? null,
        group: row.closest('[data-group]')?.dataset.group ?? null,
        visible: box(row).height > 0,
        height: round(box(row).height),
        top: round(box(row).top),
        lines: Number(row.dataset.lines),
        word: row.querySelector('.sr-only')?.textContent ?? '',
        title: words(title),
        iconLeft: iconEl ? round(box(iconEl).left) : null,
        titleLeft: textLeft(title),
        titleTop: round(box(title).top),
        titleBottom: round(box(title).bottom),
        textBottom: round(box(row.querySelector('.sf-list-attention-text')).bottom),
        meta: words(meta),
        objectLink: row.querySelector('a.sf-list-attention-object')?.getAttribute('href') ?? null,
        icon: iconEl ? {text: iconEl.textContent, filled: iconEl.classList.contains('sf-icon--filled'), size: round(box(iconEl).height), color: getComputedStyle(iconEl).color,
          centre: round(box(iconEl).top + box(iconEl).height / 2), lineCentre: round(box(title).top + parseFloat(getComputedStyle(title).lineHeight) / 2)} : null,
        look: action ? `${action.getAttribute('appearance')}/${action.getAttribute('scheme')}/${action.getAttribute('size')}` : null,
        action: control(row, '.sf-list-attention-action :is(a, button)'),
        more: control(row, '.sf-list-attention-more button'),
        affected: control(row, 'sf-badge.sf-list-attention-affected > *'),
      };
    });
    const head = host.querySelector('.sf-list-attention-head');
    const foot = host.querySelector('.sf-list-attention-foot');
    const checkedEl = host.querySelector('.sf-list-attention-checked');
    const all = host.querySelector('.sf-list-attention-all :is(a, button)');
    const quiet = host.querySelector('.sf-list-attention-quiet');
    return {
      width: root ? round(box(root).width) : 0,
      row: root ? length(root, 'var(--sf-list-attention--row)') : 0,
      icon: root ? length(root, 'var(--sf-list-attention--icon)') : 0,
      frame: root ? [...root.classList].find((one) => one.startsWith('sf-list-attention--frame-')) : '',
      border: root ? getComputedStyle(root).borderTopWidth : '',
      head: head ? round(box(head).height) : 0,
      heading: host.querySelector('.sf-list-attention-heading')?.textContent.trim() ?? '',
      summary: [...host.querySelectorAll('.sf-list-attention-summary sf-badge')].map((badge) => badge.getAttribute('text')),
      rows,
      foot: foot ? {
        height: round(box(foot).height),
        direction: getComputedStyle(foot).flexDirection,
        checked: words(checkedEl),
        checkedLeft: checkedEl ? textLeft(checkedEl) : null,
        all: words(all),
        allLeft: all ? textLeft(all) : null,
        allRight: all ? round(box(all).right) : null,
      } : null,
      quiet: quiet ? {text: words(quiet), height: round(box(quiet).height), role: quiet.getAttribute('role'),
        lines: [...quiet.querySelectorAll('.sf-list-attention-quiet-text > *')].filter(shown).map(words),
        rechecks: [...quiet.querySelectorAll('sf-button > button, sf-button-icon > button')].filter(shown).map((button) => words(button) || button.getAttribute('aria-label') || '')} : null,
      groups: [...host.querySelectorAll('.sf-list-attention-group-toggle')].map((toggle) => ({
        key: toggle.closest('[data-group]').dataset.group,
        title: toggle.querySelector('.sf-list-attention-group-title').textContent,
        count: toggle.querySelector('.sf-list-attention-group-count').textContent,
        expanded: toggle.getAttribute('aria-expanded'),
        hidden: document.getElementById(toggle.getAttribute('aria-controls'))?.hidden ?? null,
        height: round(box(toggle).height),
      })),
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  };
  return {overview: list('overview'), side: list('side'), checks: list('checks'), empty: list('empty')};
};

const near = (a, b, tolerance = 0.5) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolerance;
const same = (values, tolerance = 0.5) => values.length < 2 || values.every((value) => near(value, values[0], tolerance));
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [device, viewport] of [['1440', {width: 1440, height: 1100}], ['390', {width: 390, height: 1800}]]) {
      for (const density of ['normal', 'compact']) {
        const name = `${theme}-${device}-${density}`;
        for (let load = 1; load <= reloads; load += 1) {
          const run = `${name} #${load}`;
          const fail = (detail) => failures.push(`${run}: ${detail}`);
          const context = await browser.newContext({viewport, colorScheme: theme, reducedMotion: 'reduce'});
          const tab = await context.newPage();
          const errors = [];
          tab.on('pageerror', (error) => errors.push(error.message));
          tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
          tab.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
          tab.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
          await tab.goto(`http://127.0.0.1:${server.address().port}/lab?theme=${theme}&density=${density}`);
          await tab.waitForFunction(() => document.querySelectorAll('#overview .sf-list-attention-item').length === 5
            && document.querySelectorAll('#checks .sf-list-attention-item').length === 14
            && document.querySelectorAll('.sf-list-attention-action :is(a, button)').length === 18
            && document.querySelectorAll('.sf-list-attention-more button').length === 18
            && document.querySelectorAll('.sf-list-attention-summary .sf-badge').length === 9
            && Boolean(document.querySelector('#empty .sf-list-attention-quiet')),
          null, {timeout: 30000}).catch(() => fail('the page never drew both scenes with their buttons and badges'));
          await tab.waitForFunction(() => Array.from(document.querySelectorAll('.sf-icon')).every((icon) => icon.classList.contains('sf-icon-loaded')), null, {timeout: 10000}).catch(() => {});
          await tab.evaluate(() => document.fonts.ready);
          await tab.mouse.move(0, 0);
          await tab.waitForTimeout(300);
          const m = await tab.evaluate(MEASURE);
          if (load === 1) seen[name] = m;
          if (evidence && load === 1) await tab.screenshot({path: join(evidence, `list-attention-${name}.png`), fullPage: true});
          const phone = device === '390';
          const H = phone ? 52 : (density === 'compact' ? 48 : 56);
          const ICON = phone ? m.overview.icon : (density === 'compact' ? 20 : 24);
          const {overview, side, checks, empty} = m;

          // Badges: the summary per severity, in words.
          for (const list of [overview, side, checks]) {
            if (list.summary.join('|') !== '2 ошибки|3 предупреждения|3 рекомендации') fail(`summary ${JSON.stringify(list.summary)}`);
          }
          if (overview.frame !== 'sf-list-attention--frame-card' || overview.border !== '1px') fail(`frame ${overview.frame} ${overview.border}`);

          // The ladder: the row, the head, the empty line.
          if (!near(overview.row, H)) fail(`row H ${overview.row}, expected ${H}`);
          if (!near(overview.icon, ICON)) fail(`icon ${overview.icon}, expected ${ICON}`);
          // The head is a bar of H; on a phone the summary may wrap under the heading.
          if (phone ? !(overview.head >= H - 0.5) : !near(overview.head, H)) fail(`head ${overview.head}, expected ${H}`);
          // One line of H on a desktop; on a phone the line may wrap under its recheck.
          if (!empty.quiet || (phone ? !(empty.quiet.height >= H - 0.5) : !near(empty.quiet.height, H))) fail(`empty line ${empty.quiet?.height}, expected ${H}`);
          const wide = phone ? [] : [overview, checks];
          for (const list of wide) for (const row of list.rows.filter((one) => one.visible && one.lines === 2)) {
            if (!near(row.height, H)) fail(`${list === overview ? 'overview' : 'checks'} ${row.id ?? row.title}: row ${row.height}, expected ${H}`);
          }

          // Row fields.
          const backup = overview.rows.find((row) => row.id === 'backup') ?? {};
          if (backup.word !== 'Ошибка: ' || backup.title !== 'Резервная копия не создана') fail(`backup word/title ${backup.word}/${backup.title}`);
          if (backup.meta !== 'shop.simai.ru · 2 дня · Резервные копии') fail(`backup meta «${backup.meta}»`);
          if (backup.objectLink !== '#site-shop') fail(`backup object link ${backup.objectLink}`);
          if (!backup.icon?.filled || backup.icon?.text !== 'error' || !near(backup.icon?.size, ICON)) fail(`backup icon ${JSON.stringify(backup.icon)}`);
          if (!near(backup.icon?.centre, backup.icon?.lineCentre, 1)) fail(`backup icon centre ${backup.icon?.centre}, title line centre ${backup.icon?.lineCentre}`);
          const down = overview.rows.find((row) => row.id === 'down') ?? {};
          if (down.meta !== 'zdorovie-clinic.ru · 12 мин · Мониторинг') fail(`down meta «${down.meta}»`);
          for (const row of overview.rows) if (row.look !== 'outline/on-surface/1/2') fail(`${row.id}: action ${row.look}`);

          // Order: severity, then the longest-lasting first, the host's order last.
          if (overview.rows.map((row) => row.id).join(',') !== 'backup,down,mail,exch,ssl') fail(`overview order ${overview.rows.map((row) => row.id)}`);

          // Limit and more.
          if (overview.rows.length !== 5 || overview.foot?.all !== 'Все проблемы (8)') fail(`limit ${overview.rows.length}, more «${overview.foot?.all}»`);
          if (!/^Проверено 5 мин назад$/u.test(overview.foot?.checked ?? '')) fail(`checked «${overview.foot?.checked}»`);

          // Empty.
          // C45 (q2): on a phone the quiet card is two lines, «Всё в порядке» over
          // «Проверено 5 мин назад», and the recheck an icon; wide, one line and
          // the worded recheck. One form at a time.
          const quietWant = phone ? {lines: ['Всё в порядке', 'Проверено 5 мин назад'], rechecks: ['Проверить снова']}
            : {lines: ['Всё в порядке · проверено 5 мин назад'], rechecks: ['Проверить снова']};
          if (JSON.stringify(empty.quiet?.lines) !== JSON.stringify(quietWant.lines) || JSON.stringify(empty.quiet?.rechecks) !== JSON.stringify(quietWant.rechecks) || empty.quiet?.role !== 'status') fail(`empty ${JSON.stringify(empty.quiet?.lines)} recheck ${JSON.stringify(empty.quiet?.rechecks)} ${empty.quiet?.role}, expected ${JSON.stringify(quietWant)}`);

          // Alignment: wide card -- actions and «⋯» end on one edge, titles on one.
          const narrowList = phone ? [overview, side] : [side];
          if (!phone) {
            if (!same(overview.rows.map((row) => row.more.right))) fail(`overview «⋯» right ${overview.rows.map((row) => row.more.right)}`);
            if (!same(overview.rows.map((row) => row.action.right))) fail(`overview action right ${overview.rows.map((row) => row.action.right)}`);
            for (const row of overview.rows) if (!near(row.action.top + row.action.height / 2, row.top + row.height / 2, 1)) fail(`${row.id}: action not centred on the row`);
            // Group mode at 1440: the affected counts end on one edge, the actions share a column.
            const issues = checks.rows.filter((row) => row.id && row.visible);
            if (!same(issues.map((row) => row.affected?.right ?? -1))) fail(`checks affected right ${issues.map((row) => row.affected?.right)}`);
            if (!same(issues.map((row) => row.action.left)) || !same(issues.map((row) => row.action.right))) fail(`checks action column ${issues.map((row) => `${row.action.left}-${row.action.right}`)}`);
            if (!issues.every((row) => row.affected?.shown)) fail('checks: an affected count is not shown at 1440');
          } else {
            const issues = checks.rows.filter((row) => row.id && row.visible);
            if (issues.some((row) => row.affected?.shown)) fail('checks: affected column still shown at 390');
            const backupPage = issues.find((row) => row.id === 'backup');
            if (!backupPage?.meta.endsWith('· затронуто: 1 сайт')) fail(`checks backup meta at 390 «${backupPage?.meta}»`);
          }
          for (const list of narrowList) {
            const label = list === side ? 'side' : 'overview';
            for (const row of list.rows) {
              if (!(row.action.top >= row.textBottom - 0.5) || !near(row.action.left, row.titleLeft, 1)) fail(`${label} ${row.id}: action ${row.action.left},${row.action.top} not under the text at ${row.titleLeft},${row.textBottom}`);
              if (!(row.more.top < row.titleBottom)) fail(`${label} ${row.id}: «⋯» left the title's line`);
            }
            if (!same(list.rows.map((row) => row.titleLeft))) fail(`${label}: titles start at ${list.rows.map((row) => row.titleLeft)}`);
            // The stacked foot starts on the card's text edge, where the icons stand.
            const edge = list.rows[0]?.iconLeft;
            if (list.foot?.direction !== 'column') fail(`${label}: foot ${list.foot?.direction}`);
            if (!near(list.foot?.checkedLeft, edge, 1) || !near(list.foot?.allLeft, edge, 1)) fail(`${label}: foot text at ${list.foot?.checkedLeft} / ${list.foot?.allLeft}, text edge ${edge}`);
          }
          if (m.overview.scroll > 0) fail(`horizontal scroll ${m.overview.scroll}`);

          // Group mode.
          const toggles = checks.groups.map((one) => `${one.title} ${one.count}:${one.expanded}${one.hidden ? ':hidden' : ''}`).join('|');
          if (toggles !== 'Ошибки 2:true|Предупреждения 3:true|Рекомендации 3:true|Пройдено 6:false:hidden') fail(`groups ${toggles}`);
          for (const one of checks.groups) if (!near(one.height, phone ? m.checks.groups[0].height : (density === 'compact' ? 32 : 40))) fail(`group head ${one.key} ${one.height}`);
          const warnings = checks.rows.filter((row) => row.group === 'warning').map((row) => row.id).join(',');
          if (warnings !== 'mail,exch,ssl') fail(`warnings order ${warnings}`);

          if (load === 1) {
            // Triage by keyboard on the overview: «⋯» of mail, Enter, ArrowDown, Enter.
            await tab.evaluate(() => document.querySelector('#overview [data-id=mail] .sf-list-attention-more button').focus());
            await tab.keyboard.press('Enter');
            await tab.waitForFunction(() => document.querySelector('#overview .sf-list-attention-menu')?.contains(document.activeElement)
              || document.activeElement?.closest?.('sf-menu-context'), null, {timeout: 5000}).catch(() => fail('Enter on «⋯» did not put the focus into the menu'));
            const entries = await tab.evaluate(() => (document.querySelector('#overview .sf-list-attention-menu').entries || []).map((one) => one.text || one.type));
            if (entries.join('|') !== 'Отложить на день|Отложить на неделю') fail(`mail menu ${entries} (no «Не напоминать» without permission)`);
            await tab.keyboard.press('ArrowDown');
            const focused = await tab.evaluate(() => document.activeElement?.textContent.trim());
            if (!/Отложить на неделю/u.test(focused ?? '')) fail(`ArrowDown is on «${focused}»`);
            const before = Date.now();
            await tab.keyboard.press('Enter');
            await tab.waitForTimeout(500);
            const after = await tab.evaluate(() => ({
              events: window.__events.filter((one) => one.name === 'snooze'),
              ids: [...document.querySelectorAll('#overview .sf-list-attention-item')].map((row) => row.dataset.id),
              focus: document.activeElement?.closest?.('.sf-list-attention-item')?.dataset.id ?? document.activeElement?.className ?? '',
              focusIsMore: Boolean(document.activeElement?.closest?.('.sf-list-attention-more')),
              notice: [...document.querySelectorAll('.sf-notifications .sf-toast')].map((one) => one.textContent.replace(/\s+/gu, ' ').trim()),
            }));
            const snooze = after.events[0];
            const until = Date.parse(snooze?.detail?.until ?? '');
            if (after.events.length !== 1 || snooze.detail.id !== 'mail' || !(until > before + 7 * 864e5 - 60000 && until < before + 7 * 864e5 + 60000)) fail(`snooze ${JSON.stringify(after.events)}`);
            if (after.ids.includes('mail') || after.ids.join(',') !== 'backup,down,exch,ssl,php') fail(`after snooze ${after.ids}`);
            if (after.focus !== 'exch' || !after.focusIsMore) fail(`after snooze the focus is on ${after.focus} (more ${after.focusIsMore})`);
            if (!after.notice.some((one) => one.includes('Отложено на неделю: Письма уходят с задержкой до 40 минут') && one.includes('Вернуть'))) fail(`notice ${JSON.stringify(after.notice)}`);
            // «Вернуть» by keyboard.
            await tab.evaluate(() => [...document.querySelectorAll('.sf-notifications .sf-toast button')].find((button) => button.textContent.trim() === 'Вернуть')?.focus());
            await tab.keyboard.press('Enter');
            await tab.waitForTimeout(400);
            const undone = await tab.evaluate(() => ({
              events: window.__events.filter((one) => one.name === 'undo'),
              ids: [...document.querySelectorAll('#overview .sf-list-attention-item')].map((row) => row.dataset.id),
              focus: document.activeElement?.closest?.('.sf-list-attention-item')?.dataset.id ?? '',
            }));
            if (undone.events.length !== 1 || undone.events[0].detail.id !== 'mail' || undone.events[0].detail.action !== 'snooze') fail(`undo ${JSON.stringify(undone.events)}`);
            if (undone.ids.join(',') !== 'backup,down,mail,exch,ssl') fail(`after undo ${undone.ids}`);
            if (undone.focus !== 'mail') fail(`after undo the focus is on ${undone.focus}`);

            // «Не напоминать» where allowed: the checks page is dismissible.
            await tab.click('#checks [data-id=core] .sf-list-attention-more button');
            await tab.waitForTimeout(300);
            const checksMenu = await tab.evaluate(() => (document.querySelector('#checks .sf-list-attention-menu').entries || []).map((one) => one.id));
            if (checksMenu.join(',') !== 'snooze-day,snooze-week,dismiss') fail(`checks menu ${checksMenu}`);
            // The third entry: two arrows down from the first, Enter.
            await tab.keyboard.press('ArrowDown');
            await tab.keyboard.press('ArrowDown');
            const onDismiss = await tab.evaluate(() => document.activeElement?.textContent.trim());
            if (!/Не напоминать/u.test(onDismiss ?? '')) fail(`the arrows reach «${onDismiss}», not «Не напоминать»`);
            await tab.keyboard.press('Enter');
            await tab.waitForTimeout(400);
            const dismissed = await tab.evaluate(() => ({
              events: window.__events.filter((one) => one.name === 'dismiss'),
              ids: [...document.querySelectorAll('#checks .sf-list-attention-item[data-id]')].map((row) => row.dataset.id),
            }));
            if (dismissed.events.length !== 1 || dismissed.events[0].detail.id !== 'core' || dismissed.ids.includes('core')) fail(`dismiss ${JSON.stringify(dismissed)}`);

            // Recheck and the group header.
            await tab.click('#overview .sf-list-attention-recheck button');
            await tab.click('#checks [data-group=passed] .sf-list-attention-group-toggle');
            await tab.waitForTimeout(200);
            const rest = await tab.evaluate(() => ({
              recheck: window.__events.filter((one) => one.name === 'recheck').map((one) => one.from),
              passed: document.querySelectorAll('#checks [data-group=passed] .sf-list-attention-item').length,
              open: !document.querySelector('#checks [data-group=passed] .sf-list-attention-list').hidden,
            }));
            if (rest.recheck.join() !== 'overview') fail(`recheck ${rest.recheck}`);
            if (!rest.open || rest.passed !== 6) fail(`passed ${JSON.stringify(rest)}`);
            seen[name].triage = {snooze: snooze?.detail, focusAfterSnooze: after.focus, undo: undone.events[0]?.detail, focusAfterUndo: undone.focus, checksMenu};
          }
          if (errors.length) fail(`console ${JSON.stringify(errors)}`);
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({
  reloads,
  seen: Object.fromEntries(Object.entries(seen).map(([name, m]) => [name, {
    row: m.overview.row, icon: m.overview.icon, head: m.overview.head, empty: m.empty.quiet?.height,
    overviewRows: m.overview.rows.map((one) => `${one.id} ${one.height}`).join(', '),
    checksRows: m.checks.rows.filter((one) => one.visible).map((one) => one.height).join(','),
    groupHeads: m.checks.groups.map((one) => one.height).join(','),
    actionRight: [...new Set(m.overview.rows.map((one) => one.action?.right))].join(','),
    moreRight: [...new Set(m.overview.rows.map((one) => one.more?.right))].join(','),
    affectedRight: [...new Set(m.checks.rows.filter((one) => one.id && one.visible).map((one) => one.affected?.shown ? one.affected.right : 'meta'))].join(','),
    actionColumn: [...new Set(m.checks.rows.filter((one) => one.id && one.visible).map((one) => `${one.action?.left}-${one.action?.right}`))].join(','),
    sideFoot: m.side.foot ? `${m.side.foot.direction} checked ${m.side.foot.checkedLeft} all ${m.side.foot.allLeft} edge ${m.side.rows[0]?.iconLeft}` : null,
    summary: m.overview.summary.join('|'),
    emptyText: m.empty.quiet?.text,
    triage: m.triage,
  }])),
  failures,
}, null, 1));
process.exitCode = failures.length ? 1 : 0;
