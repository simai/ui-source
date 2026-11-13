#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [json-out] [shots-dir]
//
// The danger question window (decision C39; ui-control
// control/research/2026-11-09-modal-look.md, round 2, option 1):
// sf-modal size="question" holding sf-confirm appearance="window", measured
// against the decision's values. Every expected length is the system token
// read in the window's own place (a probe element in the surface), so normal,
// compact and the phone ladder are each checked against their own steps:
//
//   width                 --sf-popup-question-width (28rem / compact 26rem),
//                         the screen's width on a phone (bottom sheet)
//   frame                 --sf-space-2 on every side from the outer edge, the
//                         window's edge inside it (C105 H6); the × on its corner
//   title                 the h4 step of the heading ladder, bold (C39, the
//                         question window's title; C21: 20 on a desktop, 16
//                         on a phone), on the h4 step's own line
//                         --sf-heading-4--height (24 / 18); density moves
//                         neither (C44): a compact title is the normal one
//   title -> plate        --sf-space-1
//   plate                 surface-container, --sf-radius--surface,
//                         --sf-space-1 inside; the decisive sentence medium
//   plate -> field/check  --sf-space-2; label -> field --sf-space-1/3
//   -> answers            --sf-space-3; answers step 1, gap --sf-space-1/2,
//                         the filled danger answer first, at the start
//   one start line        title, plate, label, field and the first answer
//
// 1440 and 390, normal and compact, light and dark, a delete with a name to
// type and a delete with a checkbox, 3 loads; opened from the keyboard: the
// focus on «Отмена», no ring around the panel. On the phone: a bottom sheet
// (bottom edge on the screen's, full width, top corners only, no bottom edge),
// the answers in two equal halves, stacked when a label does not fit.
import {readFileSync, existsSync, statSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const jsonOut = process.argv[3] ? resolve(process.argv[3]) : '';
const shots = process.argv[4] ? resolve(process.argv[4]) : '';
if (shots) mkdirSync(shots, {recursive: true});
const LOADS = Number(process.env.LOADS || 3);
const failures = [];
const note = (detail) => failures.push(detail);
// The normal window's title line per view, theme, kind and load (C44).
const normalTitleLine = new Map();
const types = {js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', woff2: 'font/woff2'};
const page404 = new Set();

async function open(browser, body, {viewport, theme, density}) {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/distr/core/css/core.css">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'probe', pluginListVersion: 'probe', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0" class="bg-surface">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = product === 'rule' ? join(out, 'core', 'rule', ...rest) : join(out, product, product, ...rest);
    if (existsSync(file) && statSync(file).isFile()) return route.fulfill({status: 200, contentType: types[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
    page404.add(url.pathname);
    return route.fulfill({status: 404, body: ''});
  });
  page.errors = errors;
  await page.goto('http://probe.test/');
  return page;
}
const defined = (page, tags) => page.waitForFunction((list) => list.every((tag) => customElements.get(tag)), tags, {timeout: 15000});

const KINDS = {
  site: {heading: 'Удалить сайт shop-example?', accept: 'Удалить сайт', consequence: 'Вернуть сайт будет нельзя.',
    description: 'Вместе с сайтом удалятся 1&nbsp;240 страниц, 3&nbsp;200 файлов и заказы, адрес shop.example.ru перестанет открываться.',
    extra: ' require="shop-example"', slots: ''},
  menu: {heading: 'Удалить меню «Главное»?', accept: 'Удалить меню', consequence: '30 дней меню лежит в корзине — оттуда его можно вернуть.',
    description: 'Меню пропадёт с трёх сайтов: shop, b2b и blog. Два представления, которые на него ссылаются, станут стандартными.',
    extra: '', slots: '<sf-checkbox slot="options" label="Удалить сразу, без корзины"></sf-checkbox>'},
};
const scene = (kind, accept = KINDS[kind].accept) => {
  const k = KINDS[kind];
  return `<main style="padding:16px"><button id="open" type="button" data-sf-modal-open="q">Открыть</button></main>
  <sf-modal modal-id="q" heading="${k.heading}" size="question">
    <sf-confirm slot="content" appearance="window" status="danger" question="${k.heading}" accept-text="${accept}" consequence="${k.consequence}"${k.extra}>
      <p slot="description">${k.description}</p>${k.slots}
    </sf-confirm>
  </sf-modal>`;
};

// Opens the window from the keyboard and measures it once its answers are drawn.
async function measure(page) {
  await page.focus('#open');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const actions = document.querySelectorAll('[data-sf-modal-portal] .sf-confirm__actions button');
    const modal = document.querySelector('.sf-modal');
    return actions.length === 2 && modal?.getAttribute('data-sf-modal-state') === 'open';
  }, null, {timeout: 15000});
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const portal = document.querySelector('[data-sf-modal-portal]');
    const surface = portal.querySelector('[data-sf-modal-surface]');
    const panel = portal.querySelector('[data-sf-modal-panel]');
    const rect = (node) => { const r = node.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height}; };
    // A token's length where the window stands: the portal carries the density.
    const token = (name, prop = 'inline-size') => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;${prop}:var(${name})`;
      surface.append(probe);
      const value = prop === 'inline-size' ? probe.getBoundingClientRect().width : parseFloat(getComputedStyle(probe)[prop]);
      probe.remove();
      return value;
    };
    const colour = (name) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;background-color:var(${name})`;
      surface.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };
    const title = portal.querySelector('.sf-modal-title');
    const header = portal.querySelector('.sf-modal-header');
    const close = portal.querySelector('.sf-modal-close-button');
    const plate = portal.querySelector('.sf-confirm__consequences');
    const sentence = portal.querySelector('.sf-confirm__consequence');
    const control = portal.querySelector('.sf-confirm__require, .sf-confirm__options');
    const label = portal.querySelector('.sf-confirm__require-label');
    const field = portal.querySelector('.sf-confirm__field');
    const fieldBox = field ? [...field.querySelectorAll('*')].map((node) => node.getBoundingClientRect()).filter((r) => r.height > 20).sort((a, b) => b.width - a.width)[0] : null;
    const checkbox = portal.querySelector('.sf-confirm__options sf-checkbox');
    const buttons = [...portal.querySelectorAll('.sf-confirm__actions button')];
    const sc = getComputedStyle(surface);
    const tc = getComputedStyle(title);
    const pc = getComputedStyle(plate);
    const active = document.activeElement;
    return {
      viewport: {width: innerWidth, height: innerHeight},
      position: document.querySelector('.sf-modal').getAttribute('data-sf-modal-position'),
      tokens: {
        width: token('--sf-popup-question-width'), space3: token('--sf-space-3'), space2: token('--sf-space-2'), space1: token('--sf-space-1'),
        space13: token('--sf-space-1\\/3'), space12: token('--sf-space-1\\/2'), radius: token('--sf-radius--surface'), control: token('--sf-ui-1--control-height'),
        heading4Size: token('--sf-heading-4--size'), heading4Height: token('--sf-heading-4--height'), container: colour('--sf-surface-container'),
      },
      surface: {...rect(surface), padding: [sc.paddingTop, sc.paddingRight, sc.paddingBottom, sc.paddingLeft].map(parseFloat),
        radius: [sc.borderTopLeftRadius, sc.borderTopRightRadius, sc.borderBottomRightRadius, sc.borderBottomLeftRadius].map(parseFloat),
        borderBottom: parseFloat(sc.borderBottomWidth), background: sc.backgroundColor},
      panel: rect(panel),
      title: {...rect(title), size: parseFloat(tc.fontSize), height: parseFloat(tc.lineHeight), weight: tc.fontWeight},
      header: rect(header),
      close: rect(close),
      plate: {...rect(plate), padding: [pc.paddingTop, pc.paddingRight, pc.paddingBottom, pc.paddingLeft].map(parseFloat), radius: parseFloat(pc.borderTopLeftRadius), background: pc.backgroundColor,
        textLeft: plate.firstElementChild.getBoundingClientRect().left},
      sentence: sentence ? {weight: getComputedStyle(sentence).fontWeight, ownLine: sentence.getBoundingClientRect().top >= sentence.previousElementSibling?.getBoundingClientRect().bottom - 0.5} : null,
      control: rect(control),
      label: label ? rect(label) : null,
      field: fieldBox ? {top: fieldBox.top, left: fieldBox.left, bottom: fieldBox.bottom, width: fieldBox.width} : null,
      checkbox: checkbox ? rect([...checkbox.querySelectorAll('*')].find((node) => node.getBoundingClientRect().height > 0) || checkbox) : null,
      buttons: buttons.map((button) => ({...rect(button), text: button.textContent.trim(), danger: button.classList.contains('sf-button--danger')})),
      name: label ? {userSelect: getComputedStyle(label.querySelector('code')).userSelect, family: getComputedStyle(label.querySelector('code')).fontFamily} : null,
      focus: active?.closest('[data-action]')?.dataset.action || active?.tagName.toLowerCase(),
      panelRing: getComputedStyle(panel).outlineStyle !== 'none' && panel.matches(':focus-visible'),
    };
  });
}

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
function check(m, ctx) {
  const t = m.tokens;
  const phone = m.viewport.width < 512;
  const want = (what, got, value, tol = 1) => { if (!near(got, value, tol)) note({...ctx, what, got: Math.round(got * 100) / 100, want: Math.round(value * 100) / 100}); };
  const table = {};
  // width and place
  if (phone) {
    if (m.position !== 'bottom') note({...ctx, what: 'a phone opens a bottom sheet', got: m.position});
    want('sheet width = screen', m.panel.width, m.viewport.width);
    want('sheet on the screen bottom', m.panel.bottom, m.viewport.height);
    if (!(m.surface.radius[0] > 0 && m.surface.radius[1] > 0 && m.surface.radius[2] === 0 && m.surface.radius[3] === 0)) note({...ctx, what: 'sheet: top corners only', got: m.surface.radius});
    if (m.surface.borderBottom !== 0) note({...ctx, what: 'sheet: no bottom edge', got: m.surface.borderBottom});
  } else {
    if (m.position !== 'center') note({...ctx, what: 'a centred window', got: m.position});
    want('width = --sf-popup-question-width', m.surface.width, t.width);
  }
  table.width = m.surface.width;
  // frame and the × on its corner
  // C105 H6: the window inset --sf-space-2 from the outer edge, edge included.
  const pad = t.space2;
  const inner = m.surface.left + pad;
  want('frame top', m.title.top - m.surface.top - Math.max(0, (m.header.height - m.title.height) / 2), pad);
  want('× on the corner: end', m.surface.right - m.close.right, pad);
  want('× on the corner: top', m.close.top - m.surface.top, pad);
  table.frame = m.close.top - m.surface.top;
  table.closeEnd = m.surface.right - m.close.right;
  // title
  // The question window's title is the heading ladder's h4 step (C39 with
  // C21), in a compact region too (C44): the size is the decision's number,
  // not a token density moves, and the line is the normal window's.
  want('title size = C21 h4 (20 desktop, 16 phone), density-independent (C44)', m.title.size, phone ? 16 : 20, 0.1);
  want('title size = --sf-heading-4--size', m.title.size, t.heading4Size, 0.1);
  want('title line = --sf-heading-4--height', m.title.height, t.heading4Height, 0.1);
  const lineKey = `${ctx.view}/${ctx.theme}/${ctx.kind}/${ctx.load}`;
  if (ctx.density === 'normal') normalTitleLine.set(lineKey, m.title.height);
  else if (normalTitleLine.has(lineKey)) want('title line in a compact region = the normal one (C44)', m.title.height, normalTitleLine.get(lineKey), 0.1);
  if (Number(m.title.weight) < 700) note({...ctx, what: 'title bold', got: m.title.weight});
  table.title = `${m.title.size}/${m.title.height} ${m.title.weight}`;
  // title -> plate
  table.titleToPlate = m.plate.top - m.header.bottom;
  want('title -> plate = --sf-space-1', table.titleToPlate, t.space1);
  // plate
  m.plate.padding.forEach((value, index) => want(`plate padding ${index} = --sf-space-1`, value, t.space1, 0.1));
  want('plate radius = --sf-radius--surface', m.plate.radius, t.radius, 0.1);
  if (m.plate.background !== t.container) note({...ctx, what: 'plate = surface-container', got: m.plate.background, want: t.container});
  if (!m.sentence || Number(m.sentence.weight) !== 500 || !m.sentence.ownLine) note({...ctx, what: 'decisive sentence: own line, medium', got: m.sentence});
  table.platePadding = m.plate.padding[0];
  table.plateRadius = m.plate.radius;
  // plate -> field or checkbox, label -> field
  table.plateToControl = m.control.top - m.plate.bottom;
  want('plate -> field/checkbox = --sf-space-2', table.plateToControl, t.space2);
  if (m.label && m.field) {
    table.labelToField = m.field.top - m.label.bottom;
    want('label -> field = --sf-space-1/3', table.labelToField, t.space13);
    if (m.name.userSelect !== 'all') note({...ctx, what: 'the name is taken whole (user-select: all)', got: m.name.userSelect});
    if (!/mono/iu.test(m.name.family)) note({...ctx, what: 'the name in the code face', got: m.name.family});
  }
  // -> answers
  table.controlToAnswers = m.buttons[0].top - m.control.bottom;
  want('field/checkbox -> answers = --sf-space-3', table.controlToAnswers, t.space3);
  want('answers -> frame bottom = --sf-space-2', m.surface.bottom - m.buttons[0].bottom - (phone ? 0 : 0), pad);
  table.answersToBottom = m.surface.bottom - m.buttons[0].bottom;
  m.buttons.forEach((button, index) => want(`answer ${index} height = step 1`, button.height, t.control, 0.5));
  table.answerHeight = m.buttons[0].height;
  if (!m.buttons[0].danger || !/Удалить/u.test(m.buttons[0].text) || m.buttons[1].text !== 'Отмена') note({...ctx, what: 'the filled danger answer first, then «Отмена»', got: m.buttons.map((b) => b.text)});
  if (phone) {
    want('phone: two equal halves', m.buttons[0].width, m.buttons[1].width);
    want('phone: one row', m.buttons[0].top, m.buttons[1].top);
    table.answersGap = m.buttons[1].left - m.buttons[0].right;
  } else {
    table.answersGap = m.buttons[1].left - m.buttons[0].right;
  }
  want('answers gap = --sf-space-1/2', table.answersGap, t.space12);
  // one start line
  const starts = {title: m.title.left, plate: m.plate.left, label: m.label?.left, field: m.field?.left, checkbox: m.checkbox?.left, answer: m.buttons[0].left};
  for (const [name, left] of Object.entries(starts)) if (left !== undefined) want(`start line: ${name}`, left, inner);
  table.startLine = Object.fromEntries(Object.entries(starts).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Math.round((v - m.surface.left) * 100) / 100]));
  // focus
  if (m.focus !== 'decline') note({...ctx, what: 'the focus on «Отмена»', got: m.focus});
  if (m.panelRing) note({...ctx, what: 'no ring around the panel'});
  table.tokens = t;
  return table;
}

const browser = await chromium.launch();
const rows = [];
try {
  for (const view of [{id: '1440', width: 1440, height: 900}, {id: '390', width: 390, height: 844}]) {
    for (const density of ['normal', 'compact']) {
      for (const theme of ['light', 'dark']) {
        for (const kind of ['site', 'menu']) {
          for (let load = 1; load <= LOADS; load++) {
            const ctx = {view: view.id, density, theme, kind, load};
            const page = await open(browser, scene(kind), {viewport: {width: view.width, height: view.height}, theme, density});
            await defined(page, ['sf-modal']);
            await page.waitForTimeout(300);
            const m = await measure(page);
            const table = check(m, ctx);
            if (page.errors.length) note({...ctx, what: 'console clean', errors: page.errors});
            rows.push({...ctx, table, measured: m});
            if (shots && load === 1) await page.screenshot({path: join(shots, `${kind}-${view.id}-${density}-${theme}.png`), scale: 'css'});
            console.log(JSON.stringify({...ctx, ...table, tokens: undefined}));
            await page.close();
          }
        }
      }
    }
  }
  // A label too long for its half stacks the answers on the phone.
  for (let load = 1; load <= LOADS; load++) {
    const page = await open(browser, scene('site', 'Удалить сайт и все его данные'), {viewport: {width: 390, height: 844}, theme: 'light', density: 'normal'});
    await defined(page, ['sf-modal']);
    const m = await measure(page);
    const stacked = m.buttons[1].top >= m.buttons[0].bottom - 0.5 && near(m.buttons[0].width, m.buttons[1].width) && near(m.buttons[0].width, m.plate.width);
    if (!stacked) note({load, what: 'phone: a long label stacks the answers, each full width', got: m.buttons});
    rows.push({view: '390', kind: 'site-long', load, buttons: m.buttons});
    console.log(JSON.stringify({load, case: 'long label stacks', buttons: m.buttons.map((b) => [Math.round(b.left), Math.round(b.top), Math.round(b.width)])}));
    if (shots && load === 1) await page.screenshot({path: join(shots, 'site-390-long-label.png'), scale: 'css'});
    await page.close();
  }
} finally {
  await browser.close();
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 60), count: failures.length, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('MODAL_QUESTION_WINDOW_OK');
