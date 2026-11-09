#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder] [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-input-choice 1.1.0, owner decision C28 (prototype input-choice-world.html
// in ui-control): the three layouts on the built bytes with the real Loader --
// list (delivery: one frame of rows, the radio at the start, price and term at
// the end of the name line), tile (plans: the radio at the end of the name
// line, name / description / price on one left edge, the price at the foot
// after a divider; modules: checkboxes, two columns) and picture (templates:
// the image to the edges, the caption under it, the radio at the end of the
// caption line; rows on a phone). At 1280 and 390 px, light and dark, normal
// and compact density, each `loads` fresh loads (3 by default). Measures, per
// layout: the card's padding on four sides against --sf-space-1, the gap
// between cards against half the padding, the control's box against the name
// line and its centre against the line's, the control's side, the chosen
// card's edge (1 px border + 1 px inner ring = 2 px, primary) and fill
// (primary-container, the fill family's lowest step) with the words on the
// on-surface roles, disabled distinct from a card not chosen, invalid's error
// edge (C13), the badge an sf-badge no taller than the line; then the
// keyboard -- Tab reaches the chosen radio, the arrows move and choose with
// the ring on the whole card, Space toggles a checkbox -- no sideways scroll
// and a clean console. With a screenshot folder each field is saved as a PNG
// (first load of each case) and the measurements as numbers.json.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
const LOADS = Number(process.argv[4]) || 3;
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// The prototype's data (input-choice-world.html), the same words and prices.
const art = (kind) => {
  const bg = '#e8ecf2'; const fg = '#ffffff'; const ac = '#0073ed'; const mu = '#c4cbd6';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="${bg}"/><rect width="160" height="12" fill="${fg}"/><rect x="8" y="4" width="22" height="4" rx="2" fill="${ac}"/>`;
  if (kind === 'landing') s += `<rect x="20" y="24" width="120" height="8" rx="3" fill="${mu}"/><rect x="62" y="44" width="36" height="10" rx="5" fill="${ac}"/><rect x="10" y="66" width="44" height="26" rx="3" fill="${fg}"/><rect x="58" y="66" width="44" height="26" rx="3" fill="${fg}"/><rect x="106" y="66" width="44" height="26" rx="3" fill="${fg}"/>`;
  if (kind === 'catalog') { s += `<rect x="8" y="20" width="30" height="72" rx="3" fill="${fg}"/>`; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) s += `<rect x="${44 + i * 37}" y="${20 + j * 37}" width="32" height="33" rx="3" fill="${fg}"/>`; }
  if (kind === 'blog') { for (let k = 0; k < 3; k++) s += `<rect x="8" y="${20 + k * 25}" width="100" height="21" rx="3" fill="${fg}"/>`; s += `<rect x="114" y="20" width="38" height="72" rx="3" fill="${fg}"/>`; }
  return `data:image/svg+xml,${encodeURIComponent(`${s}</svg>`)}`;
};
const DELIVERY = [
  {value: 'courier', label: 'Курьером', caption: 'Привезём в удобный интервал', price: '350 ₽', term: '2–3 дня'},
  {value: 'pickup', label: 'Пункт выдачи', caption: 'Больше 2 000 пунктов по стране', price: '150 ₽', term: '1–2 дня', badge: 'Выгодно'},
  {value: 'self', label: 'Самовывоз', caption: 'Москва, ул. Складочная, 1', price: 'Бесплатно', term: 'сегодня'},
  {value: 'post', label: 'Почта России', caption: 'Временно недоступна', disabled: true}];
const TARIFF = [
  {value: 'start', label: 'Старт', caption: '1 сайт, 1 ГБ, домен в подарок', price: '0 ₽', term: 'в месяц'},
  {value: 'business', label: 'Бизнес', caption: '5 сайтов, 20 ГБ, магазин и формы', price: '1 990 ₽', term: 'в месяц', badge: 'Популярный'},
  {value: 'team', label: 'Команда', caption: 'Все сайты, роли и журнал действий', price: '4 990 ₽', term: 'в месяц'}];
const TEMPLATES = [
  {value: 'landing', label: 'Лендинг', caption: 'Одна длинная страница', image: art('landing')},
  {value: 'catalog', label: 'Каталог', caption: 'Товары и фильтр', image: art('catalog'), badge: 'Новый'},
  {value: 'blog', label: 'Блог', caption: 'Лента статей', image: art('blog')}];
const MODULES = [
  {value: 'site', label: 'Сайт', caption: 'Страницы, разделы и меню'},
  {value: 'shop', label: 'Магазин', caption: 'Каталог, корзина и заказы', badge: 'Pro'},
  {value: 'blog', label: 'Блог', caption: 'Статьи и рубрики'},
  {value: 'stats', label: 'Аналитика', caption: 'Входит в тариф «Бизнес»', disabled: true}];
const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

// The fields stand at the prototype's widths: the list and the picture tiles
// 52rem, the modules 40rem, each capped by the page.
const shell = (theme, density) => `<!doctype html><html lang="ru" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-0);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;gap:32px;padding:16px;box-sizing:border-box;max-inline-size:100%}
.w52{inline-size:min(100%,52rem)}.w40{inline-size:min(100%,40rem)}</style></head>
<body><main>
  <div class="w52"><sf-input-choice id="list" layout="list" label="Способ доставки" name="delivery" value="pickup" hint="Срок считаем от оплаты." items='${j(DELIVERY)}'></sf-input-choice></div>
  <div class="w52"><sf-input-choice id="tile" layout="tile" columns="3" label="Тариф" name="plan" value="business" hint="Сменить тариф можно в любой момент." items='${j(TARIFF)}'></sf-input-choice></div>
  <div class="w52"><sf-input-choice id="picture" layout="picture" columns="3" label="Шаблон сайта" name="template" value="catalog" items='${j(TEMPLATES)}'></sf-input-choice></div>
  <div class="w40"><sf-input-choice id="modules" multiple columns="2" label="Модули" name="modules" value="site,shop" hint="Можно выбрать несколько." items='${j(MODULES)}'></sf-input-choice></div>
  <div class="w52"><sf-input-choice id="invalid" layout="list" label="Способ доставки" name="d2" required invalid error-message="Выберите способ доставки." items='${j(DELIVERY.slice(0, 3))}'></sf-input-choice></div>
</main></body></html>`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) < tolerance;
const browser = await chromium.launch();
const numbers = {};

async function open({width, theme, density}) {
  page = shell(theme, density);
  const context = await browser.newContext({viewport: {width, height: 900}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => customElements.get('sf-input-choice') && customElements.get('sf-badge')
    && document.querySelectorAll('sf-input-choice .sf-choice-card').length === 17
    && [...document.querySelectorAll('sf-input-choice sf-badge')].every((one) => one.querySelector('.sf-badge'))
    && [...document.querySelectorAll('#picture img')].every((one) => one.complete), null, {timeout: 20000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(400);
  return {tab, context, errors};
}

// Everything is read in the browser: the tokens through a probe element inside
// each field (so the density region applies), the geometry from the boxes.
function measure() {
  const r = (el) => el.getBoundingClientRect();
  const cs = (el) => getComputedStyle(el);
  const px = (v) => parseFloat(v);
  const token = (host, css, prop = 'inlineSize') => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${prop === 'inlineSize' ? css : '0'};color:${prop === 'color' ? css : 'inherit'};background-color:${prop === 'bg' ? css : 'transparent'}`;
    host.querySelector('.sf-choice').append(probe);
    const value = prop === 'inlineSize' ? px(cs(probe).inlineSize) : prop === 'color' ? cs(probe).color : cs(probe).backgroundColor;
    probe.remove();
    return value;
  };
  const field = (id) => {
    const host = document.getElementById(id);
    const choice = host.querySelector('.sf-choice');
    const cards = [...host.querySelectorAll('.sf-choice-card')];
    const t = {
      space1: token(host, 'var(--sf-space-1)'), line1: token(host, 'var(--sf-text-height-1)'),
      primary: token(host, 'var(--sf-primary)', 'color'), onSurface: token(host, 'var(--sf-on-surface)', 'color'),
      onSurfaceVariant: token(host, 'var(--sf-on-surface-variant)', 'color'), onDisable: token(host, 'var(--sf-on-disable)', 'color'),
      error: token(host, 'var(--sf-error)', 'color'), container: token(host, 'var(--sf-primary-container)', 'bg'),
      fill12: token(host, 'var(--sf-primary-50--alfa-12)', 'bg'), fill24: token(host, 'var(--sf-primary-50--alfa-24)', 'bg'),
      outlineVariant: token(host, 'var(--sf-outline-variant)', 'color'),
    };
    const one = (card) => {
      const c = r(card); const s = cs(card);
      const box = card.querySelector('.sf-radio-button-box, .sf-checkbox-box');
      const title = card.querySelector('.sf-choice-title');
      const name = card.querySelector('.sf-choice-title-text');
      const caption = card.querySelector('.sf-choice-caption');
      const price = card.querySelector('.sf-choice-price');
      const meta = card.querySelector('.sf-choice-meta');
      const media = card.querySelector('.sf-choice-media');
      const head = card.querySelector('.sf-choice-head');
      const badge = card.querySelector('sf-badge .sf-badge');
      const b = r(box); const tl = r(title);
      return {
        rect: [c.left, c.top, c.width, c.height].map((v) => Math.round(v * 10) / 10),
        padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px),
        border: px(s.borderTopWidth), borderColor: s.borderTopColor, ring: s.boxShadow, afterRing: getComputedStyle(card, '::after').boxShadow,
        background: s.backgroundColor, radius: s.borderTopLeftRadius,
        control: [b.width, b.height], controlCentre: b.top + b.height / 2 - (tl.top + Math.min(tl.height, t.line1) / 2),
        controlFromStart: b.left - c.left, controlFromEnd: c.right - b.right, controlFromTop: b.top - c.top,
        controlKind: box.classList.contains('sf-checkbox-box') ? 'checkbox' : 'radio',
        controlChecked: box.querySelector('input').checked, controlDisabled: box.querySelector('input').disabled,
        nameLeft: r(name).left - c.left, nameColor: cs(name).color, nameWeight: cs(title).fontWeight,
        captionLeft: caption ? r(caption).left - c.left : null, captionColor: caption ? cs(caption).color : null,
        priceLeft: price ? r(price).left - c.left : null, priceTop: price ? Math.round(r(price).top) : null,
        metaRight: meta ? c.right - r(meta).right : null, metaTop: meta ? r(meta).top - tl.top : null,
        mediaInset: media ? [r(media).left - c.left, r(media).top - c.top, c.right - r(media).right] : null,
        mediaSize: media ? [r(media).width, r(media).height] : null,
        headLeft: head ? r(head).left - c.left : null, headTop: head ? r(head).top - c.top : null,
        badge: badge ? {height: r(badge).height, tag: badge.parentElement?.tagName.toLowerCase() ?? '', bg: cs(badge).backgroundColor} : null,
        nameLine: tl.height,
        _after: '',
      };
    };
    const list = cards.map(one);
    const gaps = [];
    for (let i = 1; i < cards.length; i++) {
      const a = r(cards[i - 1]); const b = r(cards[i]);
      if (Math.abs(a.top - b.top) < 1) gaps.push(b.left - a.right);
      else if (b.top > a.bottom - 2) gaps.push(b.top - a.bottom);
    }
    return {t, cards: list, gaps: gaps.map((g) => Math.round(g * 10) / 10), layout: choice.dataset.layout,
      container: r(choice).width, ids: cards.map((one) => one.querySelector('input').value)};
  };
  return {list: field('list'), tile: field('tile'), picture: field('picture'), modules: field('modules'), invalid: field('invalid'),
    overflow: document.documentElement.scrollWidth > innerWidth};
}

const cases = [];
for (const theme of ['light', 'dark']) for (const width of [1280, 390]) for (const density of ['normal', 'compact']) cases.push({theme, width, density});

for (const one of cases) {
  const {theme, width, density} = one;
  const label = `${width} ${theme} ${density}`;
  const runs = [];
  for (let load = 1; load <= LOADS; load++) {
    const {tab, context, errors} = await open(one);
    const m = await tab.evaluate(measure);
    runs.push(m);
    const key = `${label} #${load}`;
    if (load === 1) numbers[label] = m;
    const phone = width < 600;
    const compactDesktop = density === 'compact' && !phone;
    for (const name of ['list', 'tile', 'picture', 'modules']) {
      const f = m[name];
      const {t} = f;
      const pad = t.space1;
      ok(`${key} ${name}: the control is the class ${name === 'modules' ? 'checkbox' : 'radio'}, its box the name line (${t.line1})`,
        f.cards.every((c) => c.controlKind === (name === 'modules' ? 'checkbox' : 'radio') && near(c.control[0], t.line1) && near(c.control[1], t.line1)), JSON.stringify(f.cards.map((c) => c.control)));
      ok(`${key} ${name}: the control is centred on the name line`, f.cards.every((c) => Math.abs(c.controlCentre) < 0.6), JSON.stringify(f.cards.map((c) => c.controlCentre)));
      ok(`${key} ${name}: the name line is text-height-1`, f.cards.every((c) => c.nameLine >= t.line1 - 0.5), JSON.stringify(f.cards.map((c) => c.nameLine)));
      if (name !== 'picture') {
        ok(`${key} ${name}: padding ${pad} on all four sides (space-1)`, f.cards.every((c) => c.padding.every((p) => near(p, pad))), JSON.stringify(f.cards[0].padding));
      } else {
        ok(`${key} picture: the image runs to the edges (inside the hairline)`, f.cards.every((c) => near(c.mediaInset[0], c.border) && near(c.mediaInset[1], c.border)
          && (phone ? near(c.mediaSize[1], c.rect[3] - 2 * c.border, 1) : near(c.mediaInset[2], c.border))), JSON.stringify(f.cards.map((c) => [c.mediaInset, c.mediaSize, c.rect])));
        ok(`${key} picture: the caption's sides are the padding`, f.cards.every((c) => near(c.controlFromEnd, pad + c.border) && near(c.nameLeft, (phone ? c.mediaSize[0] : 0) + pad + c.border)), JSON.stringify(f.cards.map((c) => [c.nameLeft, c.controlFromEnd])));
        if (phone) ok(`${key} picture: on a phone a tile is a row, the image at its start`, f.cards.every((c) => c.mediaSize[1] > 0 && c.headLeft > c.mediaSize[0]), JSON.stringify(f.cards.map((c) => [c.mediaSize, c.headLeft])));
        else ok(`${key} picture: three tiles in a row, the image over the caption`, new Set(f.cards.map((c) => c.rect[1])).size === 1 && f.cards.every((c) => c.headTop >= c.mediaSize[1]), JSON.stringify(f.cards.map((c) => c.rect)));
      }
      if (name === 'list') {
        ok(`${key} list: one frame, rows divided (the rows overlap by the hairline)`, f.gaps.every((g) => near(g, -1)), JSON.stringify(f.gaps));
        ok(`${key} list: the control at the start, at the padding`, f.cards.every((c) => near(c.controlFromStart, pad + c.border) && near(c.controlFromTop, pad + c.border)), JSON.stringify(f.cards.map((c) => [c.controlFromStart, c.controlFromTop])));
        ok(`${key} list: price and term at the end of the name line`, f.cards.filter((c) => c.metaRight !== null).every((c) => near(c.metaRight, pad + c.border) && near(c.metaTop, 0)), JSON.stringify(f.cards.map((c) => [c.metaRight, c.metaTop])));
      } else {
        ok(`${key} ${name}: the gap between cards is half the padding (${pad / 2})`, f.gaps.length > 0 && f.gaps.every((g) => near(g, pad / 2)), JSON.stringify(f.gaps));
        if (name !== 'picture') ok(`${key} ${name}: the control at the end of the name line, at the padding`, f.cards.every((c) => near(c.controlFromEnd, pad + c.border) && near(c.controlFromTop, pad + c.border)), JSON.stringify(f.cards.map((c) => [c.controlFromEnd, c.controlFromTop])));
      }
      if (name === 'tile') {
        ok(`${key} tile: name, description and price on one left edge`, f.cards.every((c) => near(c.nameLeft, c.captionLeft) && near(c.captionLeft, c.priceLeft) && near(c.nameLeft, pad + c.border)), JSON.stringify(f.cards.map((c) => [c.nameLeft, c.captionLeft, c.priceLeft])));
        if (!phone) ok(`${key} tile: the prices stand on one line`, new Set(f.cards.map((c) => c.priceTop)).size === 1, JSON.stringify(f.cards.map((c) => c.priceTop)));
      }
      // The chosen card: 2 px primary edge, the lowest fill step, the words on on-surface.
      const chosen = f.cards.filter((c) => c.controlChecked);
      const expectFill = theme === 'dark' ? t.fill24 : t.fill12;
      ok(`${key} ${name}: chosen = 1 px border + 1 px inner ring in primary`, chosen.length > 0 && chosen.every((c) => near(c.border, 1) && c.borderColor === t.primary && (name === 'picture' ? /inset/u.test(c.afterRing) && c.afterRing.includes(t.primary) : /inset/u.test(c.ring) && c.ring.includes(t.primary))), JSON.stringify(chosen.map((c) => [c.border, c.borderColor, c.ring, c.afterRing, t.primary])));
      ok(`${key} ${name}: chosen fill = primary-container = fill step ${theme === 'dark' ? 24 : 12}`, chosen.every((c) => c.background === t.container && t.container === expectFill), JSON.stringify(chosen.map((c) => [c.background, t.container, expectFill])));
      ok(`${key} ${name}: chosen words stay on on-surface roles`, chosen.every((c) => c.nameColor === t.onSurface && (c.captionColor === null || c.captionColor === t.onSurfaceVariant)), JSON.stringify(chosen.map((c) => [c.nameColor, c.captionColor])));
      const off = f.cards.filter((c) => !c.controlChecked);
      const disabled = f.cards.filter((c, i) => (name === 'list' && f.ids[i] === 'post') || (name === 'modules' && f.ids[i] === 'stats'));
      for (const d of disabled) {
        const plain = off.find((c) => !disabled.includes(c));
        // In a list's frame a disabled row keeps the frame's line; a tile takes the disable edge.
        ok(`${key} ${name}: disabled differs from not chosen (words on-disable, the control disabled${name === 'list' ? '' : ', the edge'})`, d.nameColor === t.onDisable && d.nameColor !== plain.nameColor && d.captionColor !== plain.captionColor && d.controlDisabled && !plain.controlDisabled
          && (name === 'list' || d.borderColor !== plain.borderColor), JSON.stringify({d: [d.nameColor, d.captionColor, d.borderColor], plain: [plain.nameColor, plain.captionColor, plain.borderColor]}));
      }
      const badges = f.cards.filter((c) => c.badge);
      ok(`${key} ${name}: the badge is an sf-badge no taller than the name line`, badges.length > 0 && badges.every((c) => c.badge.tag === 'sf-badge' && c.badge.height <= t.line1 + 0.5), JSON.stringify(badges.map((c) => c.badge)));
      void compactDesktop;
    }
    const inv = m.invalid;
    ok(`${key} invalid: cards not chosen take the error edge (C13)`, inv.cards.every((c) => c.borderColor === inv.t.error), JSON.stringify(inv.cards.map((c) => c.borderColor)));
    ok(`${key}: no sideways scroll`, !m.overflow, '');
    // Keyboard: Tab reaches the chosen radio of the list, the arrows move and
    // choose (skipping the disabled row), the ring is the whole card's; Space
    // toggles a checkbox.
    await tab.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await tab.focus('#list .sf-choice-grid');
    await tab.evaluate(() => { const b = document.createElement('button'); b.id = 'before'; b.textContent = 'x'; document.getElementById('list').before(b); });
    await tab.focus('#before');
    await tab.keyboard.press('Tab');
    const k1 = await tab.evaluate(() => ({value: document.activeElement?.value, ring: getComputedStyle(document.activeElement.closest('.sf-choice-card')).outlineStyle,
      ringWidth: getComputedStyle(document.activeElement.closest('.sf-choice-card')).outlineWidth,
      boxRing: getComputedStyle(document.activeElement.closest('.sf-radio-button-box')).outlineStyle}));
    ok(`${key} keyboard: Tab reaches the chosen radio, the ring around the whole card, none on the box`, k1.value === 'pickup' && k1.ring !== 'none' && parseFloat(k1.ringWidth) >= 2 && k1.boxRing === 'none', JSON.stringify(k1));
    await tab.keyboard.press('ArrowDown');
    await tab.keyboard.press('ArrowDown');
    const k2 = await tab.evaluate(() => ({value: document.getElementById('list').value, focus: document.activeElement?.value}));
    ok(`${key} keyboard: the arrows move and choose, skipping the disabled row`, k2.value === 'courier' && k2.focus === 'courier', JSON.stringify(k2));
    if (shots && load === 1) {
      await tab.locator('#list .sf-choice').screenshot({path: join(shots, `focus-list-${width}-${theme}-${density}.png`)});
    }
    await tab.focus('#modules .sf-choice-input[value="blog"]');
    await tab.keyboard.press('Space');
    const k3 = await tab.evaluate(() => ({value: document.getElementById('modules').value, ring: getComputedStyle(document.activeElement.closest('.sf-choice-card')).outlineStyle}));
    ok(`${key} keyboard: Space toggles a checkbox, the ring on its card`, k3.value === 'site,shop,blog' && k3.ring !== 'none', JSON.stringify(k3));
    await tab.keyboard.press('Space');
    if (shots && load === 1) {
      await tab.evaluate(() => { document.activeElement?.blur(); document.getElementById('before')?.remove(); document.getElementById('list').value = 'pickup'; });
      await tab.waitForTimeout(150);
      for (const id of ['list', 'tile', 'picture', 'modules', 'invalid']) {
        await tab.locator(`#${id} .sf-choice`).screenshot({path: join(shots, `${id}-${width}-${theme}-${density}.png`)});
      }
    }
    ok(`${key}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
  // Every load measures the same (geometry and colours).
  const strip = (m) => JSON.stringify(m, (k, v) => (k === '_after' ? undefined : v));
  ok(`${label}: ${LOADS} loads measure the same`, runs.every((one) => strip(one) === strip(runs[0])), '');
}

await browser.close();
server.close();
if (shots) writeFileSync(join(shots, 'numbers.json'), `${JSON.stringify(numbers, null, 2)}\n`);
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
