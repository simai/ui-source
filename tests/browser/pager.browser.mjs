#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-pager on the built bytes, at a desktop and a phone width:
// - every appearance draws (cards, row, steps, course, counter) and sits on
//   the ladder: the buttons are as tall as an sf-button / sf-icon-button of
//   the same size, a picture is the text line it stands on, the parts of a
//   row share one centre line, a missing card keeps its column;
// - Next and Back move (sf-pager-navigate, then sf-pager-change), a page that
//   cancels the request keeps the step, the last step says «Готово» and
//   finishes the walk, focus never falls to the page;
// - the counter's ArrowLeft / ArrowRight on the page (keys), never in a field;
// - the first paint of cards and row without the script: the printed markup
//   (as the snapshot tool prints it, data-sf-static) shows working links in
//   the same box as the live element, and the live element takes it over
//   without moving.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const STEPS = [{id: 'source', title: 'Источник'}, {id: 'fields', title: 'Поля'}, {id: 'check', title: 'Проверка'}, {id: 'import', title: 'Импорт'}];
const LESSONS = [
  {id: 'l1', title: 'Что такое смарт-компонент', meta: '5 минут'},
  {id: 'l2', title: 'Первая страница', meta: '8 минут'},
  {id: 'l3', title: 'Данные и порт', meta: '6 минут'},
  {id: 'l4', title: 'Свой вид', meta: '7 минут'},
  {id: 'l5', title: 'Публикация', meta: '4 минуты'},
];
const RECORDS = Array.from({length: 12}, (_, i) => ({id: String(1040 + i), title: `Заявка № ${1040 + i}`}));
const island = (items) => `<script type="application/json" data-sf-settings>${JSON.stringify({items})}</script>`;

const head = (script) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
${script ? '<script src="/distr/core/js/core.js"></script>' : ''}
<style>body{margin:0;padding:16px} .box{max-inline-size:720px;margin-block-end:24px}</style></head>`;

const live = () => `${head(true)}<body>
<div class="box"><sf-pager id="cards" prev-href="#install" prev-title="Подключение" next-href="#fields" next-title="Поля ввода"></sf-pager></div>
<div class="box"><sf-pager id="cards-first" next-href="#install" next-title="Подключение"></sf-pager></div>
<div class="box"><sf-pager id="row" appearance="row" prev-href="#a" prev-title="Что нового в версии 5.3: темы, поля, таблицы и ещё много всего" next-href="#b" next-title="Версия 5.5: листалка страниц, поиск по сайту и настройки чтения"></sf-pager></div>
<div class="box"><sf-pager id="steps" appearance="steps" current="1">${island(STEPS)}</sf-pager></div>
<div class="box"><sf-pager id="course" appearance="course" current="2">${island(LESSONS)}</sf-pager></div>
<div class="box"><sf-pager id="counter" appearance="counter" current="2" keys>${island(RECORDS)}</sf-pager></div>
<div class="box"><sf-pager id="half" appearance="counter" size="1/2">${island(RECORDS.slice(0, 5))}</sf-pager></div>
<div class="box"><sf-pager id="steps-half" appearance="steps" size="1/2" current="0">${island(STEPS)}</sf-pager></div>
<div class="box" id="refs"><sf-button id="ref-b1" size="1" text="Ref"></sf-button> <sf-icon-button id="ref-i1" size="1" icon="add" aria-label="ref"></sf-icon-button>
<sf-button id="ref-bh" size="1/2" text="Ref"></sf-button> <sf-icon-button id="ref-ih" size="1/2" icon="add" aria-label="ref"></sf-icon-button></div>
<input id="field" type="text" aria-label="Поле">
</body></html>`;

let printed = '';
const firstPaint = (script) => `${head(script)}
<link rel="stylesheet" href="/distr/smart/pager/css/pager.css"><link rel="stylesheet" href="/distr/component/icons/css/icons.css"><link rel="stylesheet" href="/distr/utility/sr-only/default/css/default.css">
<body>${printed}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const pages = {'/page': () => live(), '/static': () => firstPaint(false), '/static-live': () => firstPaint(true)};
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages[path]());
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
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const seen = {};
const fail = (message) => failures.push(message);

// Every geometry the page needs from one tab, measured on the painted boxes.
const measure = (tab) => tab.evaluate(() => {
  const box = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return {x: r.x, y: r.y, w: r.width, h: r.height, cy: r.y + r.height / 2, right: r.right};
  };
  const q = (s) => document.querySelector(s);
  const all = (s) => Array.from(document.querySelectorAll(s));
  const lineOf = (node) => (node ? parseFloat(getComputedStyle(node).lineHeight) : null);
  return {
    ref: {b1: box(q('#ref-b1 button')), i1: box(q('#ref-i1 button')), bh: box(q('#ref-bh button')), ih: box(q('#ref-ih button'))},
    cards: {
      nav: box(q('#cards > nav')), prev: box(q('#cards a[rel="prev"]')), next: box(q('#cards a[rel="next"]')),
      icon: box(q('#cards a[rel="prev"] .sf-pager-icon')), direction: lineOf(q('#cards a[rel="prev"] .sf-pager-direction')),
      title: lineOf(q('#cards a[rel="prev"] .sf-pager-title')),
      firstNav: box(q('#cards-first > nav')), firstNext: box(q('#cards-first a[rel="next"]')), firstPrev: Boolean(q('#cards-first [rel="prev"]')),
    },
    row: {
      nav: box(q('#row > nav')), prev: box(q('#row a[rel="prev"]')), next: box(q('#row a[rel="next"]')),
      icons: all('#row .sf-pager-icon').map(box), titles: all('#row .sf-pager-title').map(box), line: lineOf(q('#row .sf-pager-title')),
      truncated: all('#row .sf-pager-title').map((node) => node.scrollWidth > node.clientWidth),
    },
    steps: {
      back: box(q('#steps .sf-pager-back button')), forward: box(q('#steps .sf-pager-forward button')), middle: box(q('#steps .sf-pager-middle')),
      segments: all('#steps .sf-pager-segment').length, done: all('#steps .sf-pager-segment--done').length,
      place: q('#steps .sf-pager-place')?.textContent.trim(), backDisabled: q('#steps .sf-pager-back button')?.disabled,
      halfBack: box(q('#steps-half .sf-pager-back button')), halfForward: box(q('#steps-half .sf-pager-forward button')),
    },
    course: {
      dots: all('#course .sf-pager-dot').map((node) => node.className.replace('sf-pager-dot sf-pager-dot--', '')),
      dot: box(q('#course .sf-pager-dot')), place: q('#course .sf-pager-place')?.textContent.trim(),
      card: box(q('#course .sf-pager-lesson')), number: box(q('#course .sf-pager-lesson-number')), text: box(q('#course .sf-pager-lesson-text')),
      action: box(q('#course .sf-pager-lesson-action button')), line: lineOf(q('#course .sf-pager-lesson .sf-pager-title')),
      title: q('#course .sf-pager-lesson .sf-pager-title')?.textContent.trim(), meta: q('#course .sf-pager-lesson .sf-pager-meta')?.textContent.trim(),
    },
    counter: {
      back: box(q('#counter .sf-pager-back button')), forward: box(q('#counter .sf-pager-forward button')), place: box(q('#counter .sf-pager-place')),
      text: q('#counter .sf-pager-place')?.textContent.trim(), backLabel: q('#counter .sf-pager-back button')?.getAttribute('aria-label'),
      halfBack: box(q('#half .sf-pager-back button')), halfDisabled: q('#half .sf-pager-back button')?.disabled,
    },
    navs: all('sf-pager > nav').map((nav) => nav.getAttribute('aria-label')),
  };
});

const near = (a, b, tolerance = 0.5) => a !== null && b !== null && a !== undefined && b !== undefined && Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();
try {
  for (const width of [1280, 375]) {
    const tab = await browser.newPage({viewport: {width, height: 1400}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => customElements.get('sf-pager') && document.querySelectorAll('sf-pager > nav').length === 8
      && document.querySelector('#counter .sf-pager-back button') && document.querySelector('#ref-ih button')
      , null, {timeout: 30000})
      .catch(() => fail(`${width}: the pagers never drew`));
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(400);
    const m = await measure(tab);
    seen[width] = m;
    const at = (text) => fail(`${width}: ${text}`);

    if (errors.length) at(`console errors: ${errors.join(' | ')}`);
    if (m.navs.some((name) => name !== 'Соседние страницы')) at(`a nav is named ${JSON.stringify(m.navs)}`);
    // cards
    if (!m.cards.prev || !m.cards.next) at('cards: a link is missing');
    else {
      if (!near(m.cards.prev.h, m.cards.next.h)) at(`cards: the two cards are ${m.cards.prev.h} and ${m.cards.next.h} tall`);
      if (!near(m.cards.prev.y, m.cards.next.y)) at('cards: the two cards do not stand on one line');
      if (!near(m.cards.next.right, m.cards.nav.right)) at('cards: the next card does not end at the inline end');
      if (!near(m.cards.icon?.h, m.cards.direction)) at(`cards: the direction picture is ${m.cards.icon?.h}px on a ${m.cards.direction}px line`);
    }
    if (m.cards.firstPrev) at('cards: the first page draws a previous side');
    if (!near(m.cards.firstNext?.right, m.cards.firstNav?.right) || !near(m.cards.firstNext?.w, m.cards.next?.w)) at('cards: a missing side does not keep its place');
    // row
    if (!m.row.prev || !m.row.next) at('row: a link is missing');
    else {
      if (!near(m.row.prev.x, m.row.nav.x) || !near(m.row.next.right, m.row.nav.right)) at('row: the links do not hold the two ends');
      if (m.row.icons.some((icon) => !near(icon.h, m.row.line))) at(`row: a picture is not the ${m.row.line}px line: ${m.row.icons.map((icon) => icon.h)}`);
      if (!near(m.row.icons[0].cy, m.row.titles[0].cy) || !near(m.row.titles[0].cy, m.row.titles[1].cy)) at('row: pictures and titles are not on one centre line');
      if (m.row.prev.right > m.row.next.x) at('row: the links overlap');
    }
    if (width === 375 && !m.row.truncated.every(Boolean)) at('row: long titles are not cut with an ellipsis at 375');
    // steps
    if (!near(m.steps.back?.h, m.ref.b1?.h) || !near(m.steps.forward?.h, m.ref.b1?.h)) at(`steps: buttons ${m.steps.back?.h}/${m.steps.forward?.h}, an sf-button of size 1 is ${m.ref.b1?.h}`);
    if (!near(m.steps.back?.cy, m.steps.middle?.cy) || !near(m.steps.forward?.cy, m.steps.middle?.cy)) at('steps: Back, the place and Next are not on one centre line');
    if (!near(m.steps.halfBack?.h, m.ref.bh?.h)) at(`steps 1/2: Back is ${m.steps.halfBack?.h}, an sf-button of size 1/2 is ${m.ref.bh?.h}`);
    if (m.steps.place !== 'Шаг 2 из 4 · Поля' || m.steps.segments !== 4 || m.steps.done !== 2) at(`steps: ${m.steps.place}, ${m.steps.done}/${m.steps.segments}`);
    // course
    if (m.course.dots.join(',') !== 'done,done,current,ahead,ahead') at(`course: dots ${m.course.dots}`);
    if (m.course.place !== 'Урок 3 из 5') at(`course: place ${m.course.place}`);
    if (m.course.title !== 'Свой вид' || m.course.meta !== 'Следующий урок · 7 минут') at(`course: the card says ${m.course.meta} / ${m.course.title}`);
    if (!near(m.course.number?.h, m.course.line) || !near(m.course.number?.w, m.course.line)) at(`course: the number is ${m.course.number?.w}x${m.course.number?.h} on a ${m.course.line}px line`);
    if (!near(m.course.action?.h, m.ref.b1?.h)) at(`course: Начать is ${m.course.action?.h}, an sf-button is ${m.ref.b1?.h}`);
    if (!near(m.course.number?.cy, m.course.action?.cy) || !near(m.course.text?.cy, m.course.action?.cy)) at('course: number, text and button are not on one centre line');
    // counter
    if (!near(m.counter.back?.h, m.ref.i1?.h) || !near(m.counter.back?.w, m.ref.i1?.w)) at(`counter: icon button ${m.counter.back?.w}x${m.counter.back?.h}, sf-icon-button 1 is ${m.ref.i1?.w}x${m.ref.i1?.h}`);
    if (!near(m.counter.place?.cy, m.counter.back?.cy) || !near(m.counter.forward?.cy, m.counter.back?.cy)) at('counter: the place is not on the buttons\' centre line');
    if (m.counter.text !== '3 из 12' || m.counter.backLabel !== 'Предыдущая запись') at(`counter: ${m.counter.text}, ${m.counter.backLabel}`);
    if (!near(m.counter.halfBack?.h, m.ref.ih?.h)) at(`counter 1/2: ${m.counter.halfBack?.h}, sf-icon-button 1/2 is ${m.ref.ih?.h}`);
    if (m.counter.halfDisabled !== true) at('counter 1/2: Back is not disabled on the first record');

    if (width === 1280) {
      // Moves: Next on steps, the request, then the fact.
      await tab.evaluate(() => {
        window.heard = [];
        for (const name of ['sf-pager-navigate', 'sf-pager-change']) document.addEventListener(name, (event) => window.heard.push({name, detail: event.detail}));
      });
      const heard = () => tab.evaluate(() => window.heard.splice(0));
      await tab.locator('#steps .sf-pager-forward button').click();
      await tab.waitForTimeout(150);
      let events = await heard();
      seen.next = events;
      if (events.map((one) => one.name).join() !== 'sf-pager-navigate,sf-pager-change' || events[0].detail.direction !== 'next' || events[0].detail.index !== 2
        || events[1].detail.previous !== 1 || events[1].detail.current !== 2) fail(`steps Next: ${JSON.stringify(events)}`);
      if (await tab.evaluate(() => document.querySelector('#steps').current) !== 2) fail('steps Next: current is not 2');
      // A page that cancels the request keeps the step.
      await tab.evaluate(() => document.querySelector('#steps').addEventListener('sf-pager-navigate', (event) => event.preventDefault(), {once: true}));
      await tab.locator('#steps .sf-pager-forward button').click();
      await tab.waitForTimeout(150);
      events = await heard();
      if (events.map((one) => one.name).join() !== 'sf-pager-navigate' || await tab.evaluate(() => document.querySelector('#steps').current) !== 2) fail(`steps cancelled: ${JSON.stringify(events)}`);
      // Back.
      await tab.locator('#steps .sf-pager-back button').click();
      await tab.waitForTimeout(150);
      events = await heard();
      if (events.at(-1)?.detail?.current !== 1) fail(`steps Back: ${JSON.stringify(events)}`);
      // The last step says Готово and finishes the walk.
      await tab.evaluate(() => document.querySelector('#steps').goTo(3));
      await tab.waitForTimeout(150);
      await heard();
      const label = await tab.evaluate(() => document.querySelector('#steps .sf-pager-forward button').textContent.trim());
      seen.lastLabel = label;
      if (label !== 'Готово') fail(`steps: the last step's button says ${label}`);
      await tab.locator('#steps .sf-pager-forward button').click();
      await tab.waitForTimeout(200);
      events = await heard();
      const finished = await tab.evaluate(() => ({complete: document.querySelector('#steps').complete, state: document.querySelector('#steps').getAttribute('data-complete'),
        done: document.querySelectorAll('#steps .sf-pager-segment--done').length, focus: document.activeElement?.closest?.('sf-pager')?.id ?? document.activeElement?.localName}));
      seen.finished = {events, finished};
      if (events[0]?.detail?.direction !== 'finish' || events[1]?.detail?.complete !== true || !finished.complete || finished.state !== 'true' || finished.done !== 4) fail(`steps finish: ${JSON.stringify(seen.finished)}`);
      if (finished.focus !== 'steps') fail(`steps finish: focus fell to ${finished.focus}`);
      // Back to the first step hands focus to Next.
      await tab.evaluate(() => document.querySelector('#steps').goTo(1));
      await tab.waitForTimeout(150);
      await tab.locator('#steps .sf-pager-back button').click();
      await tab.waitForTimeout(250);
      const focus = await tab.evaluate(() => document.activeElement === document.querySelector('#steps .sf-pager-forward button'));
      if (!focus) fail('steps: focus did not move to Next when Back turned disabled');
      await heard();

      // Course: Начать, then the last lesson's Готово, then Сначала.
      await tab.locator('#course .sf-pager-lesson-action button').click();
      await tab.waitForTimeout(150);
      await tab.locator('#course .sf-pager-lesson-action button').click();
      await tab.waitForTimeout(150);
      const lastLesson = await tab.evaluate(() => [document.querySelector('#course').current, document.querySelector('#course .sf-pager-lesson-action button').textContent.trim()]);
      await tab.locator('#course .sf-pager-lesson-action button').click();
      await tab.waitForTimeout(200);
      const course = await tab.evaluate(() => ({complete: document.querySelector('#course').complete, text: document.querySelector('#course .sf-pager-lesson--finished')?.textContent.replace(/\s+/gu, ' ').trim()}));
      seen.course = {lastLesson, course};
      if (lastLesson[0] !== 4 || lastLesson[1] !== 'Готово' || !course.complete || !course.text?.includes('Курс пройден')) fail(`course: ${JSON.stringify(seen.course)}`);
      await tab.locator('#course .sf-pager-lesson-action button').click();
      await tab.waitForTimeout(150);
      if (await tab.evaluate(() => document.querySelector('#course').current) !== 0) fail('course: Сначала did not go back to the first lesson');
      await heard();

      // Counter keys: on the page, not in a field.
      await tab.evaluate(() => document.activeElement?.blur());
      await tab.keyboard.press('ArrowRight');
      await tab.waitForTimeout(150);
      const afterRight = await tab.evaluate(() => [document.querySelector('#counter').current, document.querySelector('#counter .sf-pager-place').textContent.trim()]);
      await tab.keyboard.press('ArrowLeft');
      await tab.keyboard.press('ArrowLeft');
      await tab.waitForTimeout(150);
      const afterLeft = await tab.evaluate(() => document.querySelector('#counter').current);
      await tab.locator('#field').focus();
      await tab.keyboard.press('ArrowRight');
      await tab.waitForTimeout(150);
      const inField = await tab.evaluate(() => document.querySelector('#counter').current);
      // The other pagers have no keys: only the counter moved.
      const others = await tab.evaluate(() => document.querySelector('#half').current);
      seen.keys = {afterRight, afterLeft, inField, others};
      if (afterRight[0] !== 3 || afterRight[1] !== '4 из 12' || afterLeft !== 1 || inField !== 1 || others !== 0) fail(`counter keys: ${JSON.stringify(seen.keys)}`);
      events = await heard();
      if (events.filter((one) => one.name === 'sf-pager-change').length !== 3) fail(`counter keys: ${events.length} events`);
      // The action is silent (§8): the request, no change.
      const action = await tab.evaluate(() => document.querySelector('#counter').next());
      events = await heard();
      if (action.outcome !== 'applied' || events.map((one) => one.name).join() !== 'sf-pager-navigate') fail(`counter next(): ${JSON.stringify({action, events})}`);

      // Take the printed markup of cards and row as the snapshot tool prints it.
      printed = await tab.evaluate(() => ['#cards', '#row'].map((selector) => {
        const host = document.querySelector(selector).cloneNode(true);
        host.removeAttribute('data-sf-started');
        host.removeAttribute('data-sf-style-ready');
        for (const child of host.children) child.setAttribute('data-sf-static', '');
        return `<div class="box">${host.outerHTML}</div>`;
      }).join('\n'));
      seen.printedBytes = printed.length;
      seen.liveBoxes = await tab.evaluate(() => ['#cards', '#row'].map((s) => {
        const r = document.querySelector(`${s} > nav`).getBoundingClientRect();
        return [r.width, r.height];
      }));
    }
    await tab.close();
  }

  // First paint with no script at all: links that work, in the live box.
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 900}, javaScriptEnabled: false});
    await tab.goto(`${base}/static`);
    await tab.waitForTimeout(300);
    const still = await tab.evaluate(() => ({
      links: Array.from(document.querySelectorAll('sf-pager a[href]')).map((a) => [a.getAttribute('rel'), a.getAttribute('href'), a.getClientRects().length > 0]),
      boxes: ['#cards', '#row'].map((s) => {
        const r = document.querySelector(`${s} > nav`).getBoundingClientRect();
        return [r.width, r.height];
      }),
      grid: getComputedStyle(document.querySelector('#cards > nav')).display,
    }));
    seen.noScript = still;
    if (still.links.length !== 4 || still.links.some(([, , shown]) => !shown)) fail(`no script: links ${JSON.stringify(still.links)}`);
    if (still.grid !== 'grid') fail('no script: the cards sheet did not apply');
    still.boxes.forEach((boxSize, index) => {
      const want = seen.liveBoxes?.[index];
      if (!want || !near(boxSize[0], want[0]) || !near(boxSize[1], want[1])) fail(`no script: ${['cards', 'row'][index]} box ${boxSize} differs from the live ${want}`);
    });
    // A link of the printed markup is followed without the script.
    await tab.click('#cards a[rel="next"]');
    await tab.waitForTimeout(200);
    if (!tab.url().endsWith('#fields')) fail(`no script: the next link did not navigate (${tab.url()})`);
    await tab.close();
  }

  // The live element takes the printed markup over without moving: the nav's
  // box, watched every frame from the first paint until the element drew.
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 900}});
    await tab.addInitScript(() => {
      window.__frames = [];
      const watch = () => {
        const navs = ['#cards', '#row'].map((s) => document.querySelector(`${s} > nav`));
        if (navs.every(Boolean)) {
          window.__frames.push(navs.map((nav) => {
            const r = nav.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height, nav.hasAttribute('data-sf-static')];
          }));
        }
        if (window.__frames.length < 600) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    });
    await tab.goto(`${base}/static-live`);
    await tab.waitForFunction(() => document.querySelector('#cards > nav:not([data-sf-static])') && document.querySelector('#row > nav:not([data-sf-static])'), null, {timeout: 30000})
      .catch(() => fail('static-live: the element never took over'));
    await tab.waitForTimeout(500);
    const frames = await tab.evaluate(() => window.__frames);
    const firstStyled = frames.findIndex((frame) => frame.every(([, , w, h]) => w > 0 && h > 0));
    const moved = frames.slice(firstStyled).filter((frame) => frame.some(([x, y, w, h], index) => {
      const [x0, y0, w0, h0] = frames[firstStyled][index];
      return !near(x, x0) || !near(y, y0) || !near(w, w0) || !near(h, h0);
    }));
    seen.takeOver = {frames: frames.length, staticFrames: frames.filter((frame) => frame[0][4]).length, moved: moved.length, first: frames[firstStyled], last: frames.at(-1)};
    if (moved.length) fail(`static-live: the box moved in ${moved.length} frames: ${JSON.stringify(seen.takeOver)}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
