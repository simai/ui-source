#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Anchored badges (simai/ui-source#12), measured on the built bytes:
//   - for every anchor size (1/3, 1/2, 1, 2, 3) x shape (round, square,
//     rounded square) x kind (avatar, icon, icon button), at widths 1000 and
//     390 (both sides of the 60rem step): the badge's centre is on the anchor's
//     45-degree point -- on the circle, or on the corner's arc, or the corner --
//     within 1px; its size is the documented table's; it stands out of the
//     anchor by no more than half its own size; its ring is the surface's
//     colour, not the badge's, in the light theme and the dark one and on an
//     elevated surface; a count on 1/3 and 1/2 is a dot with the number in the
//     accessible name, read by the browser;
//   - 0 hides; 99+ caps by default and a cap is configurable; one character is
//     a circle, two and three grow sideways; figures are tabular; RTL puts the
//     badge at the start side;
//   - the runtime follows a count that changes, and gives an owner its own
//     name back when the badge hides;
//   - sf-avatar, sf-icon and sf-icon-button take badge-count, badge-dot,
//     badge-cap and badge-label, in Russian and English, plural forms right;
//   - a compact sf-menu and a compact admin menu put a row's counter on its
//     icon; the online indicator keeps the bottom end beside a count.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/avatars/css/avatars.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/badges/css/badges.css', 'component/component/menu/css/menu.css',
  'component/component/admin-menu/css/admin-menu.css', 'component/component/context-menu/css/context-menu.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'component/component/badges/js/badges.js',
  'smart/smart/icon/js/icon.js', 'smart/smart/avatar/js/avatar.js', 'smart/smart/icon-button/js/icon-button.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const SHAPES = ['round', 'square', 'rounded'];
const KINDS = ['avatar', 'icon', 'icon-button'];
// The documented size table, in px at 1rem = 16px: the count's height on 1, 2
// and 3, the dot's size on every step, the ring.
const TABLE = {
  '1/3': {count: null, dot: 6, ring: 1},
  '1/2': {count: null, dot: 8, ring: 2},
  1: {count: 16, dot: 10, ring: 2},
  2: {count: 20, dot: 12, ring: 2},
  3: {count: 24, dot: 14, ring: 2},
};
const ICON_SIZE = {'1/3': '1', '1/2': '2', 1: '3', 2: '5', 3: '6'};

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();

async function open({width = 1000, body = '', theme = 'light', lang = 'ru'} = {}) {
  const page = await browser.newPage({viewport: {width, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="${lang}" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px">${body}</body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => window.SF?.AnchoredBadge && customElements.get('sf-avatar') && customElements.get('sf-icon-button') && customElements.get('sf-icon'));
  await page.waitForTimeout(300);
  return page;
}

const anchorMarkup = (kind, size, shape, id, attrs = 'data-count="3"', extra = '') => {
  const badge = `<span class="sf-badge sf-badge--anchored" ${attrs}></span>`;
  if (kind === 'avatar') {
    const square = shape === 'round' ? '' : ' sf-avatar--square';
    const style = shape === 'square' ? ' style="--sf-avatar-radius: var(--sf-radius-square)"' : '';
    return `<span id="${id}" class="sf-avatar sf-avatar--size-${size} sf-avatar--text${square} inline-flex items-cross-center content-main-center"${style} role="img" aria-label="Анна Белова"><span class="sf-avatar-text" aria-hidden="true">АБ</span>${badge}${extra}</span>`;
  }
  if (kind === 'icon') {
    return `<span id="${id}" class="sf-badge-anchor sf-badge-anchor--size-${size} sf-badge-anchor--${shape}" role="img" aria-label="Почта"><i class="sf-icon sf-icon--size-${ICON_SIZE[size]}" aria-hidden="true">mail</i>${badge}</span>`;
  }
  const radius = shape === 'round' ? ' radius-rounded' : shape === 'square' ? ' radius-square' : '';
  return `<button id="${id}" type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-${size}${radius} flex items-cross-center" aria-label="Уведомления"><i class="sf-icon" aria-hidden="true">notifications</i>${badge}</button>`;
};

// What a badge is against its anchor: the expected 45-degree point from the
// radius the anchor draws (its own computed corner, or for the icon wrapper
// the shape it says), and the measured box.
const MEASURE = `(anchor) => {
  const badge = anchor.querySelector(':scope > .sf-badge');
  const a = anchor.getBoundingClientRect();
  const b = badge.getBoundingClientRect();
  const px = (value) => { const v = parseFloat(value); return /rem$/u.test(value.trim()) ? v * parseFloat(getComputedStyle(document.documentElement).fontSize) : v; };
  const rtl = getComputedStyle(anchor).direction === 'rtl';
  let radius;
  if (anchor.classList.contains('sf-badge-anchor')) {
    const shape = ['round', 'rounded', 'square'].find((name) => anchor.classList.contains('sf-badge-anchor--' + name));
    const probe = document.createElement('div');
    probe.style.borderRadius = shape === 'round' ? 'var(--sf-radius-circle)' : shape === 'rounded' ? 'var(--sf-radius--ui)' : 'var(--sf-radius-square)';
    document.body.append(probe);
    radius = px(getComputedStyle(probe).borderTopLeftRadius || '0');
    probe.remove();
  } else {
    const style = getComputedStyle(anchor);
    radius = px(rtl ? style.borderTopLeftRadius : style.borderTopRightRadius);
  }
  const r = Math.min(radius, a.width / 2, a.height / 2);
  const inset = r * (1 - Math.SQRT1_2);
  const point = {x: rtl ? a.left + inset : a.right - inset, y: a.top + inset};
  const centre = {x: b.left + b.width / 2, y: b.top + b.height / 2};
  const style = getComputedStyle(badge);
  const ring = style.boxShadow.match(/^(rgba?\\([^)]*\\)) 0px 0px 0px ([\\d.]+)px/u);
  return {
    anchor: {width: a.width, height: a.height}, radius, inset,
    dx: centre.x - point.x, dy: centre.y - point.y,
    width: b.width, height: b.height,
    over: {top: a.top - b.top, end: rtl ? a.left - b.left : b.right - a.right},
    ringColour: ring?.[1] ?? null, ringWidth: ring ? parseFloat(ring[2]) : 0,
    background: style.backgroundColor, text: badge.textContent, hidden: badge.hidden,
    title: badge.getAttribute('title'), numeric: style.fontVariantNumeric, fontSize: parseFloat(style.fontSize),
  };
}`;

const colourOf = (page, value) => page.evaluate((v) => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = v;
  document.body.append(probe);
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour;
}, value);

const nameOf = async (page, selector) => {
  const snapshot = await page.locator(selector).first().ariaSnapshot();
  return snapshot.match(/"([^"]*)"/u)?.[1] ?? snapshot;
};

try {
  // 1. The matrix: every size x shape x kind, both widths, both themes.
  for (const theme of ['light', 'dark']) {
    for (const width of [1000, 390]) {
      const rows = [];
      for (const kind of KINDS) {
        for (const shape of SHAPES) {
          rows.push(`<div style="display:flex;gap:24px;align-items:center;margin-block-end:16px">${SIZES.map((size) =>
            anchorMarkup(kind, size, shape, `m-${kind}-${shape}-${size.replace('/', '_')}`)).join('')}</div>`);
        }
      }
      // An elevated surface: the ring is that surface, not the page's.
      rows.push(`<div class="sf-context-menu"><div class="sf-context-menu-content" style="padding:16px">${anchorMarkup('avatar', '2', 'round', 'elevated')}</div></div>`);
      const page = await open({width, theme, body: rows.join('')});
      const surface = await colourOf(page, 'var(--sf-surface-0)');
      const elevated = await colourOf(page, 'var(--sf-elevation-3--surface)');
      const at = `${theme} at ${width}px`;
      const table = [];
      for (const kind of KINDS) {
        for (const shape of SHAPES) {
          for (const size of SIZES) {
            const id = `m-${kind}-${shape}-${size.replace('/', '_')}`;
            const m = await page.evaluate(({id, source}) => eval(source)(document.getElementById(id)), {id, source: MEASURE});
            const step = TABLE[size];
            const name = `${kind} ${shape} ${size} ${at}`;
            table.push({kind, shape, size, anchor: Math.round(m.anchor.width), badge: `${m.width}x${m.height}`, dx: +m.dx.toFixed(2), dy: +m.dy.toFixed(2), ring: m.ringWidth});
            check(`${name}: the centre is on the 45-degree point within 1px`, Math.hypot(m.dx, m.dy) <= 1, m);
            const expected = step.count ?? step.dot;
            check(`${name}: the badge is the table's size`, near(m.height, expected, 0.5) && near(m.width, expected, 0.5), {expected, m});
            check(`${name}: it overflows by at most half its size`, m.over.top <= m.height / 2 + 0.5 && m.over.end <= m.width / 2 + 0.5, m);
            check(`${name}: the ring is the surface, not the badge`, m.ringColour === surface && m.ringColour !== m.background && near(m.ringWidth, step.ring, 0.01), {surface, m});
            if (step.count === null) check(`${name}: a count is a dot, its figures not drawn`, m.width === step.dot && m.height === step.dot && m.fontSize === 0, m);
            check(`${name}: the tooltip says the count`, m.title === '3 непрочитанных', m);
          }
        }
      }
      evidence[`matrix ${at}`] = table;
      const e = await page.evaluate(({source}) => eval(source)(document.getElementById('elevated')), {source: MEASURE});
      check(`${at}: on an elevated surface the ring is that surface`, e.ringColour === elevated, {elevated, e});
      evidence[`surfaces ${at}`] = {page: surface, elevated, ringOnElevated: e.ringColour};
      // The accessible name, read by the browser, on every small anchor and one large.
      for (const kind of KINDS) {
        for (const size of ['1/3', '1/2', '2']) {
          const id = `#m-${kind}-round-${size.replace('/', '_')}`;
          const label = {avatar: 'Анна Белова', icon: 'Почта', 'icon-button': 'Уведомления'}[kind];
          const name = await nameOf(page, id);
          check(`${kind} ${size} ${at}: the count joins the accessible name`, name === `${label}, 3 непрочитанных`, {name});
        }
      }
      check(`no horizontal scroll ${at}`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      await page.close();
    }
  }

  // 2. Numbers: 0 hides, the cap, one character a circle, two and three wider, tabular.
  {
    const counts = [['zero', '0'], ['one', '7'], ['two', '42'], ['cap', '120'], ['custom', '12" data-cap="9'], ['wide', '1500" data-cap="999']];
    const page = await open({body: counts.map(([id, count]) => anchorMarkup('avatar', '3', 'round', id, `data-count="${count}"`)).join('')});
    const m = {};
    for (const [id] of counts) m[id] = await page.evaluate(({id, source}) => eval(source)(document.getElementById(id)), {id, source: MEASURE});
    evidence.numbers = Object.fromEntries(Object.entries(m).map(([id, v]) => [id, {text: v.text, size: `${v.width}x${v.height}`, hidden: v.hidden, title: v.title}]));
    check('0 hides the badge', m.zero.hidden && m.zero.width === 0, m.zero);
    check('0 leaves the name as it was', await nameOf(page, '#zero') === 'Анна Белова');
    check('one character is a circle', m.one.text === '7' && m.one.width === m.one.height, m.one);
    check('two characters grow sideways, the height kept', m.two.text === '42' && m.two.width > m.two.height && m.two.height === m.one.height, m.two);
    check('above 99 reads 99+', m.cap.text === '99+' && m.cap.width > m.two.width, m.cap);
    check('the name keeps the exact count', await nameOf(page, '#cap') === 'Анна Белова, 120 непрочитанных');
    check('a custom cap', m.custom.text === '9+' && m.wide.text === '999+', {custom: m.custom, wide: m.wide});
    check('figures are tabular', m.one.numeric.includes('tabular-nums'), m.one);
    // The runtime follows the count, and gives the name back when it hides.
    await page.evaluate(() => document.querySelector('#one .sf-badge').setAttribute('data-count', '0'));
    await page.waitForTimeout(50);
    const hiddenName = await nameOf(page, '#one');
    await page.evaluate(() => document.querySelector('#one .sf-badge').setAttribute('data-count', '21'));
    await page.waitForTimeout(50);
    const again = await nameOf(page, '#one');
    await page.evaluate(() => document.getElementById('one').setAttribute('aria-label', 'Иван Петров'));
    await page.waitForTimeout(50);
    const renamed = await nameOf(page, '#one');
    evidence.runtime = {hiddenName, again, renamed};
    check('a count set to 0 gives the owner its name back', hiddenName === 'Анна Белова', {hiddenName});
    check('a count set again joins it, in the right form (21 → one)', again === 'Анна Белова, 21 непрочитанное', {again});
    check('a label the owner rewrites is taken as its own', renamed === 'Иван Петров, 21 непрочитанное', {renamed});
    await page.close();
  }

  // 3. RTL: the end is the left; the point mirrors.
  {
    const page = await open({body: `<div dir="rtl">${KINDS.map((kind) => anchorMarkup(kind, '2', 'round', `rtl-${kind}`)).join('')}</div>`});
    for (const kind of KINDS) {
      const m = await page.evaluate(({id, source}) => eval(source)(document.getElementById(id)), {id: `rtl-${kind}`, source: MEASURE});
      const a = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); const b = document.querySelector(`#${id} > .sf-badge`).getBoundingClientRect(); return {anchorCentre: r.left + r.width / 2, badgeCentre: b.left + b.width / 2}; }, `rtl-${kind}`);
      evidence[`rtl ${kind}`] = {dx: m.dx, dy: m.dy, ...a};
      check(`RTL ${kind}: on the start side's 45-degree point`, Math.hypot(m.dx, m.dy) <= 1 && a.badgeCentre < a.anchorCentre, {m, a});
    }
    await page.close();
  }

  // 4. A dot, its text equivalent, and the online indicator beside a count.
  {
    const page = await open({body: `${anchorMarkup('avatar', '2', 'round', 'dot', 'data-dot')}
      ${anchorMarkup('avatar', '2', 'round', 'dot-label', 'data-dot data-label="новое сообщение"')}
      ${anchorMarkup('avatar', '2', 'round', 'both', 'data-count="5"', '<span class="sf-online-indicator sf-online-indicator--online sf-online-indicator--size-2 flex absolute bottom-0 inline-end-0" aria-hidden="true"></span>')}
      <a href="#x" id="link" class="inline-flex items-cross-center"><span class="sf-badge-anchor sf-badge-anchor--size-1"><i class="sf-icon" aria-hidden="true">mail</i><span class="sf-badge sf-badge--anchored" data-count="4"></span></span>Почта</a>`});
    const dot = await page.evaluate(({source}) => eval(source)(document.getElementById('dot')), {source: MEASURE});
    check('a dot is the step\'s dot size, on the point', dot.width === TABLE[2].dot && dot.height === TABLE[2].dot && Math.hypot(dot.dx, dot.dy) <= 1, dot);
    check('a dot\'s default text equivalent joins the name', await nameOf(page, '#dot') === 'Анна Белова, есть новое');
    check('a dot\'s own text equivalent', await nameOf(page, '#dot-label') === 'Анна Белова, новое сообщение');
    const both = await page.evaluate(() => {
      const a = document.getElementById('both').getBoundingClientRect();
      const badge = document.querySelector('#both > .sf-badge').getBoundingClientRect();
      const online = document.querySelector('#both > .sf-online-indicator').getBoundingClientRect();
      return {a: {top: a.top, bottom: a.bottom}, badge: {bottom: badge.bottom, top: badge.top}, online: {top: online.top, bottom: online.bottom}};
    });
    evidence.both = both;
    check('the count at the top end, the online indicator at the bottom end, apart', both.badge.top < both.a.top + 8 && both.online.bottom >= both.a.bottom - 1 && both.badge.bottom <= both.online.top, both);
    const link = await nameOf(page, '#link');
    evidence.linkName = link;
    check('a name read from content ends with the count, in hidden words', link.replace(/\s+,/gu, ',') === 'Почта, 4 непрочитанных', {link});
    await page.close();
  }

  // 5. Smart inputs, Russian and English.
  for (const lang of ['ru', 'en']) {
    const page = await open({lang, body: `
      <sf-avatar id="sa" size="2" text="АБ" aria-label="Анна Белова" badge-count="3"></sf-avatar>
      <sf-avatar id="sa-small" size="1/2" text="АБ" aria-label="Анна Белова" badge-count="5"></sf-avatar>
      <sf-avatar id="sa-online" size="3" text="АБ" aria-label="Анна Белова" status="online" badge-count="2"></sf-avatar>
      <sf-icon-button id="sib" icon="notifications" aria-label="Уведомления" badge-count="120"></sf-icon-button>
      <sf-icon-button id="sib-cap" icon="notifications" aria-label="Уведомления" badge-count="12" badge-cap="9" size="2"></sf-icon-button>
      <sf-icon-button id="sib-zero" icon="notifications" aria-label="Уведомления" badge-count="0"></sf-icon-button>
      <sf-icon id="si" icon="mail" label="Почта" badge-dot></sf-icon>
      <sf-icon id="si-count" icon="mail" label="Почта" size="5" badge-count="1"></sf-icon>
      <sf-icon id="si-label" icon="mail" label="Заявки" badge-count="3" badge-label="{count} заявка|{count} заявки|{count} заявок"></sf-icon>`});
    await page.waitForFunction(() => document.querySelector('#sa .sf-badge') && document.querySelector('#si .sf-badge'));
    const smart = await page.evaluate(({source}) => {
      const measure = eval(source);
      const anchorOf = (id) => document.querySelector(`#${id} .sf-badge`).parentElement;
      return Object.fromEntries(['sa', 'sa-small', 'sa-online', 'sib', 'sib-cap', 'si', 'si-count', 'si-label'].map((id) => [id, measure(anchorOf(id))]));
    }, {source: MEASURE});
    const names = {};
    for (const id of ['sa', 'sa-small', 'sib', 'sib-cap', 'sib-zero', 'si', 'si-count', 'si-label']) {
      names[id] = await nameOf(page, `#${id} :is(button, [role="img"])`);
    }
    evidence[`smart ${lang}`] = {names, sizes: Object.fromEntries(Object.entries(smart).map(([id, v]) => [id, `${v.width}x${v.height} ${v.text} d=${Math.hypot(v.dx, v.dy).toFixed(2)}`]))};
    const ru = lang === 'ru';
    const expect = ru ? {
      sa: 'Анна Белова, 3 непрочитанных', 'sa-small': 'Анна Белова, 5 непрочитанных', sib: 'Уведомления, 120 непрочитанных',
      'sib-cap': 'Уведомления, 12 непрочитанных', 'sib-zero': 'Уведомления', si: 'Почта, есть новое', 'si-count': 'Почта, 1 непрочитанное', 'si-label': 'Заявки, 3 заявки',
    } : {
      sa: 'Анна Белова, 3 unread', 'sa-small': 'Анна Белова, 5 unread', sib: 'Уведомления, 120 unread',
      'sib-cap': 'Уведомления, 12 unread', 'sib-zero': 'Уведомления', si: 'Почта, new', 'si-count': 'Почта, 1 unread', 'si-label': 'Заявки, 3 заявки',
    };
    for (const [id, name] of Object.entries(expect)) check(`Smart ${lang}: ${id} is named «${name}»`, names[id] === name, {got: names[id]});
    for (const [id, m] of Object.entries(smart)) check(`Smart ${lang}: ${id} is on its point`, Math.hypot(m.dx, m.dy) <= 1, m);
    check(`Smart ${lang}: avatar 2 draws a medium count`, smart.sa.text === '3' && smart.sa.height === TABLE[2].count, smart.sa);
    check(`Smart ${lang}: avatar 1/2 draws a dot`, smart['sa-small'].width === TABLE['1/2'].dot && smart['sa-small'].height === TABLE['1/2'].dot, smart['sa-small']);
    check(`Smart ${lang}: icon button caps at 99+`, smart.sib.text === '99+' && smart.sib.height === TABLE[1].count, smart.sib);
    check(`Smart ${lang}: badge-cap`, smart['sib-cap'].text === '9+' && smart['sib-cap'].height === TABLE[2].count, smart['sib-cap']);
    check(`Smart ${lang}: badge-count 0 draws nothing`, await page.locator('#sib-zero .sf-badge').count() === 0);
    check(`Smart ${lang}: an icon's dot`, smart.si.width === TABLE[1].dot, smart.si);
    check(`Smart ${lang}: icon size 5 carries a medium count`, smart['si-count'].height === TABLE[2].count, smart['si-count']);
    const online = await page.evaluate(() => {
      const a = document.querySelector('#sa-online button').getBoundingClientRect();
      const i = document.querySelector('#sa-online .sf-online-indicator').getBoundingClientRect();
      const b = document.querySelector('#sa-online .sf-badge').getBoundingClientRect();
      return {indicatorAtBottomEnd: near(i.bottom, a.bottom) && near(i.right, a.right), badgeAbove: b.bottom < i.top};
      function near(x, y) { return Math.abs(x - y) <= 1; }
    });
    check(`Smart ${lang}: the online indicator keeps the bottom end, the count the top`, online.indicatorAtBottomEnd && online.badgeAbove, online);
    // A count that changes is drawn again.
    await page.evaluate(() => document.getElementById('sa').setAttribute('badge-count', '0'));
    await page.waitForTimeout(100);
    check(`Smart ${lang}: badge-count set to 0 hides the badge and restores the name`, await page.locator('#sa .sf-badge').count() === 0 && await nameOf(page, '#sa button') === 'Анна Белова');
    await page.close();
  }

  // 6. Russian plural forms of the default phrase.
  {
    const page = await open({body: ''});
    const forms = await page.evaluate(() => Object.fromEntries([1, 2, 4, 5, 11, 21, 22, 25, 101, 111].map((n) => [n, window.SF.AnchoredBadge.state({count: n}, document.body).phrase])));
    evidence.plurals = forms;
    const want = {1: 'непрочитанное', 2: 'непрочитанных', 4: 'непрочитанных', 5: 'непрочитанных', 11: 'непрочитанных', 21: 'непрочитанное', 22: 'непрочитанных', 25: 'непрочитанных', 101: 'непрочитанное', 111: 'непрочитанных'};
    for (const [n, word] of Object.entries(want)) check(`ru ${n}: «${n} ${word}»`, forms[n] === `${n} ${word}`, {got: forms[n]});
    await page.close();
  }

  // 7. Compact menus: the counter moves onto the icon.
  for (const width of [1000, 390]) {
    const row = (id, icon, text, count) => `<li class="sf-menu-item"><a href="#${id}" id="${id}" class="sf-menu-element sf-menu-element--level-1"><span class="sf-menu-element-wrap"><i class="sf-icon sf-menu-element-icon" aria-hidden="true">${icon}</i><span class="sf-menu-element-text">${text}</span><span class="sf-badge" data-count="${count}"></span></span></a></li>`;
    const page = await open({width, body: `
      <nav aria-label="Разделы" style="inline-size:72px"><ul class="sf-menu sf-menu--compact" id="compact">${row('inbox', 'inbox', 'Входящие', 3)}${row('tasks', 'task', 'Задачи', 120)}${row('none', 'home', 'Главная', 0)}</ul></nav>
      <nav aria-label="Разделы полностью" style="inline-size:280px"><ul class="sf-menu" id="full">${row('inbox-full', 'inbox', 'Входящие', 3)}</ul></nav>
      <div class="sf-admin-menu-panel small" id="admin"><a href="#a" id="admin-item" class="sf-admin-menu-item flex items-cross-center"><span class="sf-admin-menu-item-container flex items-cross-center"><i class="sf-icon" aria-hidden="true">group</i><span>Пользователи</span><span class="sf-badge" data-count="8"></span></span></a></div>`});
    const compact = await page.evaluate(() => {
      const result = {};
      for (const id of ['inbox', 'tasks', 'none', 'admin-item']) {
        const icon = document.querySelector(`#${id} .sf-icon`).getBoundingClientRect();
        const badge = document.querySelector(`#${id} .sf-badge`);
        const b = badge.getBoundingClientRect();
        result[id] = {dx: b.left + b.width / 2 - icon.right, dy: b.top + b.height / 2 - icon.top, width: b.width, height: b.height, text: badge.textContent, hidden: badge.hidden};
      }
      const text = document.querySelector('#inbox .sf-menu-element-text').getBoundingClientRect();
      const full = document.querySelector('#inbox-full .sf-badge').getBoundingClientRect();
      const fullRow = document.querySelector('#inbox-full').getBoundingClientRect();
      result.textHidden = text.width <= 1 && text.height <= 1;
      result.fullAtEnd = fullRow.right - full.right < 24 && full.width > 0;
      return result;
    });
    evidence[`compact menu at ${width}px`] = compact;
    for (const id of ['inbox', 'tasks', 'admin-item']) {
      check(`compact ${id} at ${width}px: the counter is on the icon's top end corner`, Math.hypot(compact[id].dx, compact[id].dy) <= 1 && compact[id].height === TABLE[1].count, compact[id]);
    }
    check(`compact at ${width}px: 120 reads 99+`, compact.tasks.text === '99+', compact.tasks);
    check(`compact at ${width}px: 0 hides`, compact.none.hidden, compact.none);
    check(`compact at ${width}px: the words are out of sight`, compact.textHidden, compact);
    check(`expanded at ${width}px: the counter stands at the row's end`, compact.fullAtEnd, compact);
    // A name read from content: the words and the phrase are two flex items,
    // and the browser puts a space between boxes -- «Входящие , 3 …» -- which
    // is not heard; the order and the words are what is held.
    const inbox = (await nameOf(page, '#inbox')).replace(/\s+,/gu, ',');
    const admin = await nameOf(page, '#admin-item');
    evidence[`compact names at ${width}px`] = {inbox, admin};
    check(`compact at ${width}px: the row is named with its count`, inbox === 'Входящие, 3 непрочитанных', {inbox});
    check(`compact admin at ${width}px: the item is named with its count`, /8 непрочитанных/u.test(admin), {admin});
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('ANCHORED_BADGES_OK');
