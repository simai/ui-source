#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The first paint on the built bytes (standard simai.smart-component 1.3.8
// §5.4, §7.2.1; simai/ui-source#39, #40, #47). Every script is held back
// SCRIPT_DELAY ms, so the page is seen before its code, and every frame is
// recorded:
//   a. static markup printed inside <sf-switch> and <sf-quantity> (taken from
//      the live elements of this build and marked data-sf-static) is visible
//      in the first frame after the sheets; the elements then take over with
//      one instance each, the text below never moves, and no frame shows two
//      or none; an undefined element with nothing to show is hidden in its box
//      while its code is coming, one with a core skeleton shape is shown;
//   b. the body is never at opacity 0;
//   c. sf-modal inside a closed <dialog>, a [hidden] tab panel or a closed
//      <details> fetches no modal code until the container opens, then once;
//   d. no lazy relation is fetched in idle time (sf-button's spinner), unless
//      the page asks with SF_BOOT_CONFIG.prefetchLazyRelations;
//   e. a page with .sf-skeleton bars alone fetches no script but Core's; the
//      [!skeleton] shortcode fetches the constructor, once.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const SCRIPT_DELAY = Number(process.env.SCRIPT_DELAY || 300);

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [
  join(out, 'core', 'core', 'js', 'core.js'),
  join(out, 'smart', 'smart', 'modal', 'js', 'modal.js'),
  join(out, 'component', 'component', 'skeleton', 'js', 'skeleton.js'),
].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} asset(s) not found`);
}

const boot = (config = {}) => `<!doctype html><html lang="ru" class="theme-light"><head>
<meta charset="utf-8"><title>first paint</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = ${JSON.stringify({
    cacheVersion: 'core-first-paint-probe',
    pluginListVersion: 'core-first-paint-probe',
    preloader: {enabled: false},
    icons: {enabled: false},
    theme: false,
    ...config,
  })};
</script>`;
const core = '<script src="/distr/core/js/core.js"></script>';
const pages = {};

const types = new Map([
  ['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.css', 'text/css'],
  ['.json', 'application/json'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml'],
]);
let requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  requests.push(url.pathname);
  try {
    if (pages[url.pathname]) {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(pages[url.pathname]);
      return;
    }
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    if (file.endsWith('.js') && SCRIPT_DELAY) await new Promise((settle) => setTimeout(settle, SCRIPT_DELAY));
    response.writeHead(200, {
      'Content-Type': `${types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream'}; charset=utf-8`,
      'Content-Length': bytes.length,
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

// Installed before the document parses: one record per frame, and the moment
// the Loader said ready.
const WATCH = `(() => {
  window.__frames = [];
  window.addEventListener('sf-loader-ready', () => { window.__ready = performance.now(); }, {once: true});
  const shown = (node) => {
    if (!node) return false;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && node.checkVisibility({visibilityProperty: true, opacityProperty: true});
  };
  const round = (n) => Math.round(n * 10) / 10;
  const tick = () => {
    const stage = document.getElementById('stage');
    if (stage && document.body) {
      const record = {t: Math.round(performance.now()), body: getComputedStyle(document.body).opacity};
      for (const [key, root] of [['switch', '.sf-switch-toggler'], ['quantity', '.sf-quantity-wrap']]) {
        const all = [...stage.querySelectorAll(root)];
        const host = stage.querySelector(key === 'switch' ? 'sf-switch' : 'sf-quantity');
        record[key] = {
          count: all.length,
          visible: all.filter(shown).length,
          defined: Boolean(host?.matches(':defined')),
          box: all[0] ? [all[0].getBoundingClientRect().x, all[0].getBoundingClientRect().y].map(round) : null,
        };
      }
      const after = document.getElementById('after');
      record.afterTop = after ? round(after.getBoundingClientRect().top) : null;
      const bare = document.getElementById('bare');
      record.bare = bare ? {defined: bare.matches(':defined'), visibility: getComputedStyle(bare).visibility, core: Boolean(window.SF?.__internal)} : null;
      const shape = document.getElementById('shape');
      record.shape = shape ? {defined: shape.matches(':defined'), visibility: getComputedStyle(shape).visibility} : null;
      window.__frames.push(record);
    }
    if (performance.now() < 6000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const failures = [];
const report = {scriptDelayMs: SCRIPT_DELAY};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const count = (pattern) => requests.filter((path) => pattern.test(path)).length;

const browser = await chromium.launch();
async function fresh() {
  const context = await browser.newContext({viewport: {width: 480, height: 640}, deviceScaleFactor: 1, reducedMotion: 'reduce'});
  await context.addInitScript(WATCH);
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  requests = [];
  return {context, page};
}
const loaderReady = (page) => page.waitForFunction(() => typeof window.__ready === 'number', null, {timeout: 20000});

try {
  // ---------- a, b: static markup, taken from this build's live elements ----------
  const SWITCH = 'label="Уведомления" checked name="notify" value="on"';
  const QUANTITY = 'label="Количество" value="3" min="0" max="10" name="count"';
  pages['/live.html'] = `${boot()}</head><body style="margin:0">
<main id="stage" style="padding:16px;inline-size:360px"><sf-switch ${SWITCH}></sf-switch><sf-quantity ${QUANTITY}></sf-quantity></main>
${core}</body></html>`;
  let {context, page} = await fresh();
  await page.goto(`${origin}/live.html`);
  await loaderReady(page);
  await page.waitForFunction(() => ['sf-switch', 'sf-quantity'].every((tag) => {
    const host = document.querySelector(tag);
    return host?.matches(':defined') && host.firstElementChild && !host.querySelector('[data-sf-style-pending]') && !host.hasAttribute('data-sf-style-pending');
  }), null, {timeout: 15000});
  await page.waitForTimeout(500);
  const live = await page.evaluate(() => {
    const markup = (host) => [...host.childNodes]
      .filter((node) => node.nodeType === 1)
      .map((node) => {
        const copy = node.cloneNode(true);
        const walker = document.createTreeWalker(copy, NodeFilter.SHOW_COMMENT);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach((comment) => comment.remove());
        copy.setAttribute('data-sf-static', '');
        return copy.outerHTML;
      }).join('');
    return {
      switch: markup(document.querySelector('sf-switch')),
      quantity: markup(document.querySelector('sf-quantity')),
      sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => new URL(link.href).pathname),
    };
  });
  await context.close();
  report.staticSheets = live.sheets.length;

  pages['/static.html'] = `${boot()}
${live.sheets.filter((href) => !href.endsWith('/core.css')).map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')}
</head><body style="margin:0">
<main id="stage" style="padding:16px;inline-size:360px"><sf-switch ${SWITCH}>${live.switch}</sf-switch><sf-quantity ${QUANTITY}>${live.quantity}</sf-quantity></main>
<p id="after" style="margin:0 16px">Текст под полями</p>
<div style="padding:16px"><sf-switch id="bare" label="Без разметки"></sf-switch><sf-quantity id="shape" data-sf-skeleton="line"></sf-quantity></div>
${core}</body></html>`;
  ({context, page} = await fresh());
  await page.goto(`${origin}/static.html`);
  await loaderReady(page);
  await page.waitForFunction(() => ['#stage sf-switch', '#stage sf-quantity', '#bare', '#shape'].every((selector) => document.querySelector(selector)?.matches(':defined')), null, {timeout: 15000});
  await page.waitForTimeout(800);
  const frames = await page.evaluate(() => window.__frames);
  const settled = await page.evaluate(() => ({
    switches: document.querySelectorAll('#stage .sf-switch-toggler').length,
    quantities: document.querySelectorAll('#stage .sf-quantity-wrap').length,
    staticLeft: document.querySelectorAll('#stage [data-sf-static]').length,
    switchInputs: document.querySelectorAll('#stage sf-switch input[type="checkbox"]').length,
    form: (() => {
      const form = document.createElement('form');
      const stage = document.getElementById('stage');
      stage.parentNode.insertBefore(form, stage);
      form.append(stage);
      const data = [...new FormData(form)].filter(([name]) => name === 'notify' || name === 'count');
      return data;
    })(),
  }));
  await context.close();
  const first = frames[0];
  const tops = frames.map((frame) => frame.afterTop).filter((top) => top !== null);
  const coreFrames = frames.filter((frame) => frame.bare?.core && !frame.bare.defined);
  report.static = {
    frames: frames.length,
    firstFrameMs: first?.t,
    firstFrame: first,
    switchDefinedMs: frames.find((frame) => frame.switch.defined)?.t ?? null,
    quantityDefinedMs: frames.find((frame) => frame.quantity.defined)?.t ?? null,
    maxSwitches: Math.max(...frames.map((frame) => frame.switch.count)),
    maxQuantities: Math.max(...frames.map((frame) => frame.quantity.count)),
    blankFrames: frames.filter((frame) => frame.switch.visible === 0 || frame.quantity.visible === 0).length,
    textBelowMovedPx: tops.length ? Math.round((Math.max(...tops) - Math.min(...tops)) * 10) / 10 : null,
    switchMovedPx: Math.max(0, ...frames.filter((frame) => frame.switch.box).map((frame) => Math.abs(frame.switch.box[1] - first.switch.box[1]))),
    quantityMovedPx: Math.max(0, ...frames.filter((frame) => frame.quantity.box).map((frame) => Math.abs(frame.quantity.box[1] - first.quantity.box[1]))),
    bodyOpacityZeroFrames: frames.filter((frame) => frame.body === '0').length,
    bareUndefinedFramesAfterCore: coreFrames.length,
    bareShownWhileUndefined: coreFrames.filter((frame) => frame.bare.visibility !== 'hidden').length,
    shapeHiddenWhileUndefined: frames.filter((frame) => frame.shape && !frame.shape.defined && frame.shape.visibility === 'hidden').length,
    settled,
  };
  const s = report.static;
  check('static markup is visible in the first frame', first?.switch.visible === 1 && first?.quantity.visible === 1 && !first.switch.defined && !first.quantity.defined, {first});
  check('one switch and one quantity in every frame', s.maxSwitches === 1 && s.maxQuantities === 1 && s.blankFrames === 0, s);
  check('nothing moves: the text below and the controls keep their place', s.textBelowMovedPx === 0 && s.switchMovedPx <= 0.5 && s.quantityMovedPx <= 0.5, s);
  check('the elements took over', s.switchDefinedMs !== null && s.quantityDefinedMs !== null && settled.staticLeft === 0 && settled.switches === 1 && settled.quantities === 1 && settled.switchInputs === 1, s);
  check('the body is never at opacity 0', s.bodyOpacityZeroFrames === 0, s);
  check('an undefined element with nothing to show is hidden while its code is coming', s.bareUndefinedFramesAfterCore > 0 && s.bareShownWhileUndefined === 0, s);
  check('an undefined element with a core skeleton shape is shown', s.shapeHiddenWhileUndefined === 0, s);

  // ---------- c: closed containers ----------
  const modal = '<sf-modal id="modal" title="Окно"><div slot="content">Текст окна</div></sf-modal>';
  const closed = {
    dialog: {markup: `<dialog id="box">${modal}</dialog>`, open: () => document.getElementById('box').show()},
    hidden: {markup: `<div id="tabs"><div role="tabpanel">Первая</div><div role="tabpanel" id="box" hidden>${modal}</div></div>`, open: () => document.getElementById('box').removeAttribute('hidden')},
    details: {markup: `<details id="box"><summary>Подробнее</summary>${modal}</details>`, open: () => { document.getElementById('box').open = true; }},
  };
  report.closed = {};
  for (const [name, {markup, open}] of Object.entries(closed)) {
    pages[`/closed-${name}.html`] = `${boot()}</head><body>
<main id="stage"><sf-switch label="Видимый"></sf-switch>${markup}</main>
${core}</body></html>`;
    ({context, page} = await fresh());
    await page.goto(`${origin}/closed-${name}.html`);
    await loaderReady(page);
    await page.waitForFunction(() => customElements.get('sf-switch'), null, {timeout: 15000});
    await page.waitForTimeout(1500);
    const before = {smart: count(/\/smart\/modal\//u), component: count(/\/component\/modal\//u), defined: await page.evaluate(() => Boolean(customElements.get('sf-modal')))};
    await page.evaluate(open);
    let definedAfterOpen = true;
    try {
      await page.waitForFunction(() => customElements.get('sf-modal'), null, {timeout: 15000});
    } catch {
      definedAfterOpen = false;
    }
    await page.waitForTimeout(800);
    const after = {
      smartJs: count(/\/smart\/modal\/js\//u),
      componentJs: count(/\/component\/modal\/js\//u),
      smartAll: count(/\/smart\/modal\//u),
      componentAll: count(/\/component\/modal\//u),
    };
    await context.close();
    report.closed[name] = {before, after, definedAfterOpen};
    check(`${name}: no modal code while closed`, before.smart === 0 && before.component === 0 && !before.defined, report.closed[name]);
    check(`${name}: opened, the modal is fetched once`, definedAfterOpen && after.smartJs === 1 && after.componentJs <= 1, report.closed[name]);
  }

  // ---------- d: lazy relations ----------
  report.lazy = {};
  for (const [name, config] of [['default', {}], ['prefetch', {prefetchLazyRelations: true}]]) {
    pages[`/lazy-${name}.html`] = `${boot(config)}</head><body>
<main id="stage"><sf-button>Сохранить</sf-button></main>
${core}</body></html>`;
    ({context, page} = await fresh());
    await page.goto(`${origin}/lazy-${name}.html`);
    await loaderReady(page);
    await page.waitForFunction(() => customElements.get('sf-button'), null, {timeout: 15000});
    await page.waitForTimeout(3500);
    report.lazy[name] = {spinner: count(/\/spinner\//u)};
    await context.close();
  }
  check('no lazy relation is fetched in idle time', report.lazy.default.spinner === 0, report.lazy);
  check('the page that asks for the warm-up still gets it', report.lazy.prefetch.spinner > 0, report.lazy);

  // ---------- e: skeleton bars ----------
  pages['/skeleton.html'] = `${boot()}</head><body>
<main id="stage"><div class="sf-skeleton flex" aria-hidden="true"><div class="sf-skeleton-text sf-skeleton-text--size-1"></div><div class="sf-skeleton-text sf-skeleton-text--size-1"></div></div></main>
${core}</body></html>`;
  ({context, page} = await fresh());
  await page.goto(`${origin}/skeleton.html`);
  await loaderReady(page);
  await page.waitForTimeout(1500);
  report.skeleton = {
    scripts: requests.filter((path) => path.endsWith('.js') && !path.startsWith('/distr/core/')),
    sheet: count(/\/component\/skeleton\/css\//u),
    barHeight: await page.evaluate(() => document.querySelector('.sf-skeleton-text').getBoundingClientRect().height),
  };
  await context.close();
  check('skeleton bars fetch their sheet and no script', report.skeleton.scripts.length === 0 && report.skeleton.sheet === 1 && report.skeleton.barHeight > 0, report.skeleton);

  pages['/skeleton-shortcode.html'] = `${boot()}</head><body>
<main id="stage">[!skeleton]</main>
${core}</body></html>`;
  ({context, page} = await fresh());
  await page.goto(`${origin}/skeleton-shortcode.html`);
  await loaderReady(page);
  let built = true;
  try {
    await page.waitForFunction(() => document.querySelector('#stage .sf-skeleton .sf-skeleton-text'), null, {timeout: 10000});
  } catch {
    built = false;
  }
  await page.waitForTimeout(500);
  report.shortcode = {built, scripts: count(/\/component\/skeleton\/js\//u)};
  await context.close();
  check('the [!skeleton] shortcode fetches the constructor once and builds the bars', built && report.shortcode.scripts === 1, report.shortcode);
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({
  probe: 'core-first-paint',
  ...report,
  result: failures.length ? 'CORE_FIRST_PAINT_FAIL' : 'CORE_FIRST_PAINT_OK',
  failures,
}, null, 2));
if (failures.length) process.exit(1);
