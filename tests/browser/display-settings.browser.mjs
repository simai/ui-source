#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--json <file>]
//   (the build output root holding core/, smart/, component/, utility/;
//   PLAYWRIGHT_MODULE=/abs/playwright/index.mjs picks another Playwright)
//
// The display settings (owner decision C196, 2026-11-15) on the built core and
// the built sf-display-settings, from a site origin of their own so the
// browser keeps what a site keeps:
//
//   panel        the trigger opens and closes the panel (aria-expanded,
//                aria-controls), Escape closes it and gives the focus back;
//                the keyboard reaches every choice; the a11y tree names the
//                panel, each group and each pressed choice;
//   storage      a choice is kept in localStorage under sf-display-settings
//                and nowhere else: no cookie, no request to any other origin,
//                no request but the Framework's own files; it is shown again
//                after a reload; «Обычная версия» forgets it;
//   device       forced-colors: active disables the colour group and says so;
//                a device that reduces motion is named in the motion group;
//                prefers-contrast: more makes the quiet text full;
//                prefers-reduced-transparency: reduce makes glass solid;
//   text         200 % multiplies the browser's own size; on a documentation
//                page, an admin table page and a form, at 1440 and 390, the
//                page does not scroll sideways and no column is squeezed
//                below a readable width (a data table may scroll in its own
//                box, WCAG 1.4.10);
//   spacing      «Шире» gives line 1.5, letters 0.12, words 0.16 (1.4.12);
//   images       grey is grey; hidden pictures leave their alt as text;
//   motion       «Остановить» stops CSS motion and core's own scripts;
//   schemes      the page stands on the scheme; links are underlined; a
//                keyboard focus ring is drawn in the scheme's link tone;
//   skip link    the first Tab reaches «Перейти к содержимому» («Skip to
//                content» on an English page), visible when focused, and it
//                moves the focus to the main content; an author's own link
//                and data-sf-skip-link="off" keep core's out;
//   legacy       the SF4 panel's classes (html.special, body.sf-special-*)
//                and an old scheme name are read as the new schemes and noted
//                in SF.deprecations;
//   console      no error on any page.
//
// Prints {checks, failures, evidence} and exits 1 on a failure.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) throw new Error('Build output root is required');
const out = resolve(args[0]);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt > 0 ? args[jsonAt + 1] : null;
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ORIGIN = 'http://display-settings.test';
const DISTR = `${ORIGIN}/distr/`;
const TYPES = {css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', woff2: 'font/woff2', json: 'application/json; charset=utf-8', svg: 'image/svg+xml'};
const PICTURE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#e01b24"/></svg>');

const head = ({lang = 'ru', theme = 'light', html = '', title = 'Страница'} = {}) => `<!doctype html>
<html lang="${lang}" class="theme-${theme}"${html}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script>window.sfPath=${JSON.stringify(DISTR)};window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="${DISTR}core/css/core.css">
<script src="${DISTR}core/js/core.js"></script>
<style>
  body { margin: 0; }
  .page { display: flex; flex-wrap: wrap; gap: var(--sf-space-1); padding: var(--sf-space-1); }
  .page > nav { flex: 1 1 14rem; min-inline-size: 0; }
  .page > main { flex: 999 1 20rem; min-inline-size: 0; }
  .table-box { overflow-x: auto; }
  table { border-collapse: collapse; }
  td, th { padding: var(--sf-space-1\\/4) var(--sf-space-1\\/2); text-align: start; }
  form { display: flex; flex-direction: column; gap: var(--sf-space-1); max-inline-size: 40rem; }
</style></head>`;

const header = (panel = '<sf-display-settings></sf-display-settings>') => `<header class="page">${panel}<a href="/docs.html">Главная</a></header>`;

const PAGES = {
  '/docs.html': () => `${head({title: 'Документация'})}<body>${header()}
<div class="page">
  <nav aria-label="Разделы"><ul><li><a href="/docs.html">Начало работы</a></li><li><a href="/docs.html#install">Установка</a></li><li><a href="/docs.html#theme">Темы и цвета</a></li></ul></nav>
  <main>
    <h1>Начало работы с SIMAI Framework</h1>
    <p>Подключите ядро, и компоненты загрузятся сами, когда появятся на странице. Это описание нужно, чтобы проверить, как читается обычный абзац документации при крупном тексте и широких интервалах.</p>
    <p>Подробности — в разделе <a href="/docs.html#install">«Установка»</a>. Каждая ссылка в тексте подчёркнута в цветовой схеме.</p>
    <figure><img id="picture" src="${PICTURE}" alt="Схема подключения ядра" width="320" height="240"></figure>
    <ul><li>Ядро: стили и загрузчик.</li><li>Smart-компоненты: по требованию.</li></ul>
    <pre><code>&lt;script src="core.js"&gt;&lt;/script&gt;</code></pre>
    <sf-button id="action" text="Подключить" scheme="primary"></sf-button>
  </main>
</div></body></html>`,
  '/table.html': () => `${head({title: 'Заказы'})}<body>${header()}
<div class="page"><main>
  <h1>Заказы</h1>
  <div class="table-box"><table>
    <thead><tr><th>Номер</th><th>Клиент</th><th>Город</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead>
    <tbody>
      <tr><td>10421</td><td>ООО «Ромашка»</td><td>Екатеринбург</td><td>12 400 ₽</td><td>Оплачен</td><td>14.11.2026</td></tr>
      <tr><td>10422</td><td>ИП Сидоров</td><td>Казань</td><td>8 150 ₽</td><td>Ожидает оплаты</td><td>15.11.2026</td></tr>
    </tbody>
  </table></div>
</main></div></body></html>`,
  '/form.html': () => `${head({title: 'Заявка'})}<body>${header()}
<div class="page"><main>
  <h1>Заявка на подключение</h1>
  <form onsubmit="return false">
    <sf-input label="Ваше имя" placeholder="Иван Петров"></sf-input>
    <sf-input label="Электронная почта" type="email" placeholder="ivan@example.ru"></sf-input>
    <sf-input-textarea label="Что нужно сделать"></sf-input-textarea>
    <sf-checkbox label="Согласен на обработку данных"></sf-checkbox>
    <sf-button text="Отправить" scheme="primary"></sf-button>
  </form>
</main></div></body></html>`,
  '/panel.html': () => `${head({title: 'Панель'})}<body><main><sf-display-settings layout="panel" show-font show-links></sf-display-settings>
  <p>Текст под панелью со <a href="/docs.html">ссылкой</a>.</p><img id="picture" src="${PICTURE}" alt="Красный прямоугольник" width="40" height="30">
  <div id="glass" style="background: var(--sf-surface-media)">стекло</div></main></body></html>`,
  '/en.html': () => `${head({lang: 'en', title: 'Page'})}<body><main><h1>English page</h1><p>Text.</p></main></body></html>`,
  '/off.html': () => `${head({html: ' data-sf-skip-link="off"'})}<body><main><h1>Без ссылки</h1></main></body></html>`,
  '/own.html': () => `${head()}<body><a class="sf-skip-link" href="#content">К тексту</a><main id="content"><h1>Своя ссылка</h1></main></body></html>`,
  '/legacy.html': () => `${head({html: ''}).replace('class="theme-light"', 'class="theme-light special special-interval-15"')}<body class="sf-special sf-special-black"><main><h1>Старая версия для слабовидящих</h1><p>Текст.</p></main></body></html>`,
};

const failures = [];
const evidence = {};
let checks = 0;
const check = (name, pass, detail = {}) => {
  checks += 1;
  evidence[name] = pass ? true : detail;
  if (!pass) failures.push({name, ...detail});
};
const foreign = [];
const consoleErrors = [];

async function open(browser, path, {viewport = {width: 1440, height: 900}, context: options = {}, storage = null, fontSize = null} = {}) {
  const context = await browser.newContext({viewport, ...options});
  if (storage) await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch {} }, ['sf-display-settings', JSON.stringify(storage)]);
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({path, text: message.text()}); });
  page.on('pageerror', (error) => consoleErrors.push({path, text: error.message}));
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:')) return;
    if (!url.startsWith(`${ORIGIN}/`) || request.method() !== 'GET') foreign.push({path, url, method: request.method()});
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.fulfill({status: 404, body: ''});
    if (PAGES[url.pathname]) return route.fulfill({contentType: 'text/html; charset=utf-8', body: PAGES[url.pathname]()});
    const match = url.pathname.match(/^\/distr\/([^/]+)\/(.+)$/u);
    const file = match && join(out, match[1], match[1], match[2]);
    if (!file || !existsSync(file)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({contentType: TYPES[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
  });
  if (fontSize) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', {fontSizes: {standard: fontSize}});
  }
  await page.goto(`${ORIGIN}${path}`);
  await page.waitForFunction(() => window.SF?.displaySettings && [...document.querySelectorAll('sf-display-settings')].every((one) => one.isRendered === true), null, {timeout: 20000});
  await page.evaluate(() => document.fonts?.ready);
  return {context, page};
}

const ATTRIBUTES = ['data-sf-scheme', 'data-sf-text-scale', 'data-sf-text-spacing', 'data-sf-images', 'data-sf-motion', 'data-sf-font', 'data-sf-links'];
const root = (page) => page.evaluate((names) => Object.fromEntries(names.filter((name) => document.documentElement.hasAttribute(name)).map((name) => [name, document.documentElement.getAttribute(name)])), ATTRIBUTES);
const stored = (page) => page.evaluate(() => localStorage.getItem('sf-display-settings'));
// sf-button hands its data-* and aria-* to the button it draws.
const choice = (setting, value) => `sf-display-settings button[data-setting="${setting}"][data-value="${value}"]`;

const browser = await chromium.launch();
try {
  // ---------------------------------------------------------------- panel
  {
    const {context, page} = await open(browser, '/docs.html');
    const trigger = page.locator('.sf-display-settings__trigger button');
    const panel = page.locator('.sf-display-settings__panel');
    check('panel: closed at first, the trigger says so', await panel.isHidden() && await trigger.getAttribute('aria-expanded') === 'false');
    check('panel: the trigger names the panel it controls', await trigger.getAttribute('aria-controls') === await panel.getAttribute('id'));
    // The keyboard: the skip link first, then the trigger.
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({text: document.activeElement?.textContent, cls: document.activeElement?.className}));
    check('skip link: the first Tab reaches «Перейти к содержимому»', first.cls === 'sf-skip-link' && first.text === 'Перейти к содержимому', first);
    const shown = await page.evaluate(() => {
      const box = document.activeElement.getBoundingClientRect();
      return {width: box.width, height: box.height, top: box.top, left: box.left};
    });
    check('skip link: visible when focused', shown.width > 40 && shown.height >= 24 && shown.top >= 0 && shown.left >= 0, shown);
    await page.keyboard.press('Tab');
    check('panel: the next Tab reaches the trigger', await page.evaluate(() => document.activeElement?.closest?.('.sf-display-settings__trigger') !== null));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.sf-display-settings__panel').hidden);
    check('panel: Enter opens it', await trigger.getAttribute('aria-expanded') === 'true');
    // Tab to «А+» and press it with Space.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    check('panel: the keyboard reaches «Текст больше»', focused === 'Текст больше', {focused});
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sf-text-scale') === '125');
    check('text: «А+» gives 125 %', (await root(page))['data-sf-text-scale'] === '125');
    check('text: the size is said in a live region', await page.locator('.sf-display-settings__value').getAttribute('aria-live') === 'polite' && /125/u.test(await page.locator('.sf-display-settings__value').textContent()));
    const tree = await page.locator('.sf-display-settings__panel').ariaSnapshot();
    check('a11y: the panel is a group named by the label', /group "Настройки отображения"/u.test(tree), {tree});
    for (const name of ['Текст', 'Цвет', 'Интервалы', 'Картинки', 'Движение']) check(`a11y: the group «${name}»`, tree.includes(`group "${name}"`), {name});
    check('a11y: the chosen scheme is a pressed button', /button "Как на сайте" \[pressed\]/u.test(tree), {tree});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.sf-display-settings__panel').hidden);
    check('panel: Escape closes it and gives the focus back to the trigger', await page.evaluate(() => document.activeElement?.closest?.('.sf-display-settings__trigger') !== null));
    // A scheme by mouse.
    await trigger.click();
    await page.locator(choice('scheme', 'white-on-black')).click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sf-scheme') === 'white-on-black');
    const kept = JSON.parse(await stored(page));
    check('storage: the choice is in localStorage', kept?.scheme === 'white-on-black' && kept?.textScale === 125, {kept});
    check('storage: no cookie', await page.evaluate(() => document.cookie) === '');
    check('a11y: the new scheme is pressed', await page.locator(choice('scheme', 'white-on-black')).getAttribute('aria-pressed') === 'true'
      && await page.locator(choice('scheme', '')).getAttribute('aria-pressed') === 'false');
    const ground = await page.evaluate(() => ({body: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color, link: getComputedStyle(document.querySelector('main p a')).textDecorationLine}));
    check('scheme: the page stands on black and reads in white', ground.body === 'rgb(0, 0, 0)' && ground.color === 'rgb(255, 255, 255)', ground);
    check('scheme: a link in the text is underlined', ground.link === 'underline', ground);
    // Shown again after a reload, before the panel draws.
    await page.reload();
    await page.waitForFunction(() => window.SF?.displaySettings);
    check('storage: the choice is shown again after a reload', (await root(page))['data-sf-scheme'] === 'white-on-black');
    // Focus ring in the scheme: the link tone (sky 85 in white-on-black).
    await page.waitForFunction(() => document.querySelector('#action')?.querySelector('button'));
    await page.locator('#action button').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const button = document.activeElement;
      const style = getComputedStyle(button);
      const probe = document.createElement('i');
      probe.style.color = 'var(--sf-scheme-link)';
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return {style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor, want, box: style.boxShadow};
    });
    check('scheme: the keyboard focus ring is drawn in the link tone', ring.style !== 'none' && ring.color === ring.want, ring);
    // «Обычная версия».
    await page.locator('.sf-display-settings__trigger button').click();
    await page.locator('.sf-display-settings__reset button').click();
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-sf-scheme'));
    check('reset: «Обычная версия» clears the root and forgets the choice', Object.keys(await root(page)).length === 0 && await stored(page) === null, {root: await root(page)});
    await context.close();
  }

  // ----------------------------------------------------------- the device
  {
    const {context, page} = await open(browser, '/panel.html', {context: {forcedColors: 'active', reducedMotion: 'reduce'}});
    const disabled = await page.locator('sf-display-settings button[data-setting="scheme"]').evaluateAll((all) => all.map((one) => one.disabled));
    check('device: forced colours disable the colour group', disabled.length === 6 && disabled.every(Boolean), {disabled});
    check('device: the colour group says the system sets the colours', await page.locator('[data-group="scheme"] .sf-display-settings__note').textContent() === 'Цвета задаёт система');
    check('device: the host marks forced colours', await page.locator('sf-display-settings').getAttribute('data-forced-colors') !== null);
    check('device: the motion group names the device', await page.locator('[data-group="motion"] .sf-display-settings__note').textContent() === 'Устройство уже уменьшает движение');
    await context.close();
  }
  {
    const {context, page} = await open(browser, '/panel.html');
    const cdp = await context.newCDPSession(page);
    const read = () => page.evaluate(() => {
      const probe = document.createElement('i');
      document.body.append(probe);
      const value = (name) => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      const glass = getComputedStyle(document.querySelector('#glass')).backgroundColor;
      const result = {ink: value('--sf-on-surface'), quiet: value('--sf-on-surface-variant'), edge: value('--sf-outline'), glass};
      probe.remove();
      return result;
    });
    const plain = await read();
    await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-contrast', value: 'more'}]});
    const more = await read();
    check('device: prefers-contrast more makes the quiet text full', plain.quiet !== plain.ink && more.quiet === more.ink, {plain, more});
    check('device: prefers-contrast more strengthens the edges', more.edge !== plain.edge, {plain, more});
    await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-transparency', value: 'reduce'}]});
    const solid = await read();
    const alpha = (colour) => Number(colour.match(/rgba?\([^)]*?,\s*([0-9.]+)\)$/u)?.[1] ?? (colour.startsWith('rgba') ? NaN : 1));
    check('device: reduced transparency makes glass more solid', alpha(solid.glass) > alpha(plain.glass), {plain: plain.glass, solid: solid.glass});
    await cdp.send('Emulation.setEmulatedMedia', {features: []});
    await context.close();
  }

  // ------------------------------------------- spacing, images, motion, font
  {
    const {context, page} = await open(browser, '/panel.html');
    await page.locator(choice('textSpacing', 'wide')).click();
    await page.locator(choice('images', 'hide')).click();
    await page.locator(choice('motion', 'reduce')).click();
    await page.locator(choice('font', 'serif')).click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sf-font') === 'serif');
    const read = await page.evaluate(() => {
      const p = getComputedStyle(document.querySelector('main p'));
      const size = parseFloat(p.fontSize);
      const picture = document.querySelector('#picture');
      const caption = picture.nextElementSibling;
      const button = document.querySelector('sf-display-settings .sf-button');
      return {
        line: parseFloat(p.lineHeight) / size, letters: parseFloat(p.letterSpacing) / size, words: parseFloat(p.wordSpacing) / size,
        picture: getComputedStyle(picture).display, caption: caption?.classList.contains('sf-image-caption') ? caption.textContent : null,
        captionShown: caption ? getComputedStyle(caption).display !== 'none' && caption.getBoundingClientRect().width > 0 : false,
        transition: getComputedStyle(button).transitionDuration, still: window.SF.displaySettings.reducedMotion(),
        family: p.fontFamily,
      };
    });
    const near = (a, b) => Math.abs(a - b) < 0.011;
    check('spacing: «Шире» gives line 1.5, letters 0.12, words 0.16', near(read.line, 1.5) && near(read.letters, 0.12) && near(read.words, 0.16), read);
    check('images: a hidden picture leaves its text', read.picture === 'none' && read.caption === 'Красный прямоугольник' && read.captionShown, read);
    check('motion: «Остановить» stops CSS transitions', read.transition.split(',').every((one) => parseFloat(one) <= 0.0001), read);
    check('motion: core scripts read it', read.still === true, read);
    check('font: «С засечками» sets the serif family', /serif/iu.test(read.family) && !/^"?Inter/iu.test(read.family), read);
    await page.locator(choice('images', 'grey')).click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sf-images') === 'grey');
    const grey = await page.evaluate(() => ({filter: getComputedStyle(document.querySelector('#picture')).filter, caption: getComputedStyle(document.querySelector('.sf-image-caption')).display}));
    check('images: grey is grey, the text stays hidden', /grayscale\(1\)/u.test(grey.filter) && grey.caption === 'none', grey);
    await page.locator(choice('links', 'underline')).click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sf-links') === 'underline');
    check('links: «Подчёркивать» underlines the links', await page.evaluate(() => getComputedStyle(document.querySelector('main p a')).textDecorationLine) === 'underline');
    check('links: a button-like link keeps its look', await page.evaluate(() => getComputedStyle(document.querySelector('sf-display-settings button')).textDecorationLine) === 'none');
    await context.close();
  }

  // ------------------------------------------------------------ 200 % text
  const measure = () => {
    const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    // Widths in the page's text size (200 %: 32 px), and "as wide as the
    // main column allows" (a list's indent of up to 3 of them aside).
    const text = parseFloat(getComputedStyle(document.body).fontSize);
    const main = document.querySelector('main');
    const em = (element) => element.getBoundingClientRect().width / text;
    const full = (element) => element.getBoundingClientRect().width >= main.clientWidth - 3 * text;
    const squeezed = [];
    for (const p of main.querySelectorAll('p, li, h1')) {
      if (em(p) < 15 && !full(p)) squeezed.push({what: p.localName, em: Math.round(em(p) * 10) / 10});
    }
    for (const cell of main.querySelectorAll('td, th')) {
      if (cell.scrollWidth > cell.clientWidth + 1 || em(cell) < 3) squeezed.push({what: cell.localName, text: cell.textContent, em: Math.round(em(cell) * 10) / 10});
    }
    for (const field of main.querySelectorAll('sf-input, sf-input-textarea, sf-checkbox')) {
      const box = field.firstElementChild ?? field;
      if (em(box) < 12 && !full(box)) squeezed.push({what: field.localName, em: Math.round(em(box) * 10) / 10});
    }
    for (const panel of document.querySelectorAll('.sf-display-settings__panel:not([hidden])')) {
      if (panel.scrollWidth > panel.clientWidth + 1) squeezed.push({what: 'display settings panel', over: panel.scrollWidth - panel.clientWidth});
    }
    const wide = [...document.body.querySelectorAll('*')].filter((one) => one.getBoundingClientRect().right > window.innerWidth + 1 && !one.closest('.table-box'))
      .slice(0, 6).map((one) => `${one.localName}.${[...one.classList].join('.')} ${Math.round(one.getBoundingClientRect().right)}`);
    return {overflow, squeezed, wide, root: getComputedStyle(document.documentElement).fontSize};
  };
  for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
    for (const path of ['/docs.html', '/table.html', '/form.html']) {
      const {context, page} = await open(browser, path, {viewport, storage: {textScale: 200}});
      if (path === '/docs.html') {
        await page.locator('.sf-display-settings__trigger button').click();
        await page.waitForFunction(() => !document.querySelector('.sf-display-settings__panel').hidden);
      }
      await page.waitForTimeout(300);
      const result = await page.evaluate(measure);
      check(`200 %: ${path} at ${viewport.width} does not scroll sideways`, result.overflow <= 0, result);
      check(`200 %: ${path} at ${viewport.width} squeezes no column`, result.squeezed.length === 0, result);
      check(`200 %: ${path} at ${viewport.width} doubles the root size`, result.root === '32px', result);
      await context.close();
    }
  }
  {
    const {context, page} = await open(browser, '/docs.html', {storage: {textScale: 150}, fontSize: 20});
    check('text: a step multiplies the browser\'s own size (20 px × 150 %)', await page.evaluate(() => getComputedStyle(document.documentElement).fontSize) === '30px');
    await context.close();
  }

  // ------------------------------------------------------------ skip link
  {
    const {context, page} = await open(browser, '/en.html');
    await page.keyboard.press('Tab');
    const link = await page.evaluate(() => ({text: document.activeElement?.textContent, href: document.activeElement?.getAttribute('href')}));
    check('skip link: «Skip to content» on an English page', link.text === 'Skip to content', link);
    await page.keyboard.press('Enter');
    check('skip link: Enter moves the focus to the main content', await page.evaluate(() => document.activeElement?.localName) === 'main');
    await context.close();
  }
  for (const [path, name] of [['/off.html', 'data-sf-skip-link="off" leaves it out'], ['/own.html', 'an author\'s own link keeps core\'s out']]) {
    const {context, page} = await open(browser, path);
    const count = await page.evaluate(() => document.querySelectorAll('a[data-sf-skip-link="core"]').length);
    check(`skip link: ${name}`, count === 0, {count});
    await context.close();
  }

  // --------------------------------------------------------------- legacy
  {
    const {context, page} = await open(browser, '/legacy.html');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sf-scheme') === 'white-on-black', null, {timeout: 15000}).catch(() => {});
    const read = await page.evaluate(() => ({root: document.documentElement.getAttribute('data-sf-scheme'), spacing: document.documentElement.getAttribute('data-sf-text-spacing'), notes: window.SF.deprecations?.list?.() ?? []}));
    check('legacy: sf-special-black reads as white-on-black', read.root === 'white-on-black' && read.spacing === 'wide', read);
    check('legacy: the old class is noted in SF.deprecations', read.notes.some((one) => one.from === 'sf-special-black' && one.remove_after === '2027-01-01'), read);
    await context.close();
  }
  {
    const {context, page} = await open(browser, '/docs.html', {storage: {scheme: 'yellow'}});
    const read = await page.evaluate(() => ({root: document.documentElement.getAttribute('data-sf-scheme'), notes: window.SF.deprecations?.list?.() ?? []}));
    check('legacy: the old scheme name yellow reads as yellow-on-black', read.root === 'yellow-on-black', read);
    check('legacy: the old scheme name is noted in SF.deprecations', read.notes.some((one) => one.from === 'yellow' && one.to === 'yellow-on-black'), read);
    await context.close();
  }
} finally {
  await browser.close();
}

check('storage: no request leaves the site, nothing is sent', foreign.length === 0, {foreign});
check('console: no error on any page', consoleErrors.length === 0, {consoleErrors});

const summary = {check: 'C196 display settings in the browser', checks, failures, evidence};
if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({checks, failures}, null, 2));
if (failures.length) process.exit(1);
