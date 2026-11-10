#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Code in running text (owner, 2026-11-02; geometry and copy, 2026-11-07,
// docs review R024, rule C10), on the built bytes in a browser: in both themes
// a <code> in a paragraph, a list item, a table cell, a heading, a link and
// chat-like markup gets the quiet neutral plate -- the background of
// --sf-surface-container, .2em by .4em of room, 85 % of the text, a 6px
// corner (--sf-a6), the mono family. It stays inline and wraps as text does,
// at its spaces and hyphens; a run that cannot fit a line of its own (a URL,
// a token) breaks where it must and never runs out of its column; no word
// parts between two letters (C10, 2026-11-10, round 2: break-word). A line
// with code is as tall as one without. The plate
// shows on a surface-2 stripe too. A <code> the Framework draws or that sits
// in a block or a control is left as it was: inside an sf-button's text, a
// highlighted block (sf-highlight), pre > code, kbd, samp, a code carrying an
// sf- class, and a Smart component's own markup (sf-input-color's value).
// The rule weighs what a bare `code` does: a utility and an unlayered site rule
// both win over it. The public variables (--sf-code-*) retone it.
//
// Copy on click is opt-in: code outside a [data-sf-code-copy] container is
// not a control; inside one it is a button, copies on a click, on Enter and on
// Space, says «Скопировано» near the code, and a block of code is not taken.
//
// INLINE_CODE_SHOTS=<folder> saves a screenshot of each theme there.
import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHOTS = process.env.INLINE_CODE_SHOTS ? resolve(process.env.INLINE_CODE_SHOTS) : null;
const THEMES = ['light', 'dark'];
const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/highlight/css/highlight.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'component/component/highlight/js/highlight.js', 'smart/smart/input-color/js/input-color.js'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const BODY = `
  <p id="p">Run <code id="in-p">npm test</code> before a commit.</p>
  <ul><li>Set <code id="in-li">size</code>.</li></ul>
  <table><tbody><tr><td>Name <code id="in-td">sf-tag</code></td></tr></tbody></table>
  <h3>Heading <code id="in-h3">h3</code></h3>
  <p><a href="#x">a link to <code id="in-a">SF.ready</code></a></p>
  <div class="sf-chat-markup"><p>Chat <code id="in-chat">a[1]</code> text</p></div>
  <p><strong>Bold <code id="in-strong">x</code></strong></p>

  <p><sf-button id="btn-host"><span slot="text">Run <code id="in-sf-button">x</code></span></sf-button></p>
  <p><button type="button" id="plain-button">Run <code id="in-button">x</code></button></p>
  <pre id="pre"><code id="in-pre">const a = 1;</code></pre>
  <div class="sf-highlight" id="static-highlight"><pre><code id="in-highlight">let b = 2;</code></pre></div>
  <pre><code class="language-js" id="in-highlighted">const c = 3;</code></pre>
  <p>Press <kbd id="kbd"><code id="in-kbd">Ctrl</code></kbd> and <samp><code id="in-samp">ok</code></samp>.</p>
  <p>Classed <code class="sf-doc-code" id="classed">x</code></p>
  <sf-input-color id="color" value="#1a7f37"></sf-input-color>

  <p>Utility <code class="bg-transparent" id="with-utility">x</code></p>
  <p class="site">Site <code id="site-rule">x</code></p>
  <div id="stripe" style="background:var(--sf-surface-2);padding:8px"><p>On a stripe <code id="on-stripe">surface-2</code></p></div>
  <p id="narrow" style="inline-size:20ch">An event <code id="hyphen">sf-button-press</code> comes</p>
  <p id="url-box" style="inline-size:358px">Документация: <code id="url">https://ui.simai.io/ru/smart/actions/copy-button/?from=docs&amp;token=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789</code> — ссылка.</p>
  <p id="words-box" style="inline-size:14ch">Run <code id="words">npm run build --watch --verbose</code> now</p>
  <div id="tbl-box" style="inline-size:358px"><table id="tbl" style="border-collapse:collapse;inline-size:100%"><tbody>
    <tr><td>Тег</td><td><code>&lt;sf-radio&gt;</code>, контракт <code>smart.radio</code> версии <code>1.1.4</code></td></tr>
    <tr><td>Значение по умолчанию</td><td><code id="tbl-json">{"items":[{"value":"day","label":"День"},{"value":"week","label":"Неделя"}],"name":"period"}</code></td></tr>
    <tr><td>Правило классов</td><td><code id="tbl-rule">simai/ui@2bd5a3ab478a46fcee24d2460e7792135b0bb864:distr/rule/rule.json#name=cl-radio</code></td></tr>
  </tbody></table></div>
  <p id="line-box">One line <code id="line-code">sf-tag</code> of text</p>
  <p id="plain-line">One line of text</p>
  <p class="tone-secondary">Secondary <code id="tone-secondary">x</code></p>
  <p class="tone-tertiary">Tertiary <code id="tone-tertiary">x</code></p>
  <article id="copy-box" data-sf-code-copy>
    <p>Copy <code id="copy-me">sf-button-press</code> and <code id="copy-key">npm test</code>.</p>
    <pre><code id="copy-pre">not a control</code></pre>
    <div class="sf-highlight"><pre><code id="copy-highlight">nor this</code></pre></div>
    <p data-sf-code-copy="false">Off <code id="copy-off">x</code></p>
  </article>`;

const browser = await chromium.launch();

async function open(theme) {
  const context = await browser.newContext({viewport: {width: 1200, height: 1100}});
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: 'http://localhost:4917'});
  const page = await context.newPage();
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', theme, said: error.message}); });
  const html = `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
    <script>window.SF_BOOT_CONFIG = {theme: false};</script>
    <style>.site code { background-color: rgb(1, 2, 3); }
    .tone-secondary { --sf-code-color: var(--sf-secondary); }
    .tone-tertiary { --sf-code-background: var(--sf-tertiary-container); --sf-code-color: var(--sf-on-tertiary-container); }</style></head>
    <body style="margin:16px;background:var(--sf-surface-0)">${BODY}</body></html>`;
  // The page and the build under /dist/ on one secure origin (localhost):
  // core.js is loaded by its address, so it knows where it stands and runs
  // whole (copy on click is core's), and the Clipboard API is there.
  await page.route('http://localhost:4917/**', async (route) => {
    const {pathname} = new URL(route.request().url());
    if (!pathname.startsWith('/dist/')) return route.fulfill({contentType: 'text/html; charset=utf-8', body: html});
    try {
      const body = await readFile(join(out, decodeURIComponent(pathname.slice('/dist/'.length))));
      const type = pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.json') ? 'application/json' : 'text/javascript';
      return route.fulfill({contentType: `${type}; charset=utf-8`, body});
    } catch {
      return route.fulfill({status: 404, body: ''});
    }
  });
  await page.goto('http://localhost:4917/');
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) {
    if (path === 'core/core/js/core.js') await page.addScriptTag({url: `/dist/${path}`, type: 'module'});
    else await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  }
  await page.waitForFunction(() => globalThis.SF?.codeCopy);
  await page.waitForFunction(() => customElements.get('sf-button') && customElements.get('sf-input-color'));
  await page.waitForFunction(() => document.querySelector('#btn-host > button') && document.querySelector('#color .sf-color-text code'));
  await page.waitForTimeout(500);
  return page;
}

const read = () => {
  const style = (element) => {
    const s = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      background: s.backgroundColor,
      color: s.color,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      paddingLeft: s.paddingLeft,
      paddingRight: s.paddingRight,
      radius: s.borderTopLeftRadius,
      whiteSpace: s.whiteSpace,
      display: s.display,
      fontSize: parseFloat(s.fontSize),
      parentFontSize: parseFloat(getComputedStyle(element.parentElement).fontSize),
      fontFamily: s.fontFamily,
      height: Math.round(box.height * 100) / 100,
      width: Math.round(box.width * 100) / 100,
      lines: element.getClientRects().length,
    };
  };
  // What the tokens resolve to, read off an element that asks for them.
  const probe = document.createElement('div');
  probe.style.cssText = 'background-color:var(--sf-surface-container);border-radius:var(--sf-a6);color:var(--sf-on-surface)';
  document.body.append(probe);
  const p = getComputedStyle(probe);
  const expected = {background: p.backgroundColor, radius: p.borderTopLeftRadius, color: p.color};
  const tone = (css) => { probe.style.cssText = css; return getComputedStyle(probe).color; };
  expected.secondary = tone('color:var(--sf-secondary)');
  expected.onTertiaryContainer = tone('color:var(--sf-on-tertiary-container)');
  probe.style.cssText = 'background-color:var(--sf-tertiary-container)';
  expected.tertiaryContainer = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const stripe = getComputedStyle(document.getElementById('stripe')).backgroundColor;
  const codes = {};
  for (const code of document.querySelectorAll('code')) {
    const id = code.id || (code.closest('#color') ? 'in-sf-color' : code.closest('#btn-host') ? 'in-sf-button' : null)
      || `unnamed-${Object.keys(codes).length}`;
    codes[id] = {...style(code), parent: code.parentElement.localName + (code.parentElement.className ? `.${String(code.parentElement.className).split(/\s+/u)[0]}` : ''), classes: code.className,
      role: code.getAttribute('role'), tabindex: code.getAttribute('tabindex'), label: code.getAttribute('aria-label')};
  }
  // Where each word of a code stands: a word is whole when its first and last
  // letters sit on one line. A hyphen is a break like a space, so a word here
  // is a run of letters between spaces and hyphens: no word parts between two
  // letters.
  const wordsWhole = (code) => {
    const text = code.firstChild;
    const top = (at) => { const range = document.createRange(); range.setStart(text, at); range.setEnd(text, at + 1); return Math.round(range.getClientRects()[0].top); };
    const broken = [];
    for (const match of text.data.matchAll(/[^\s-]+/gu)) if (top(match.index) !== top(match.index + match[0].length - 1)) broken.push(match[0]);
    return broken;
  };
  const fits = (id) => {
    const box = document.getElementById(id);
    const code = box.querySelector('code').getBoundingClientRect();
    const column = box.getBoundingClientRect();
    return {code: {left: Math.round(code.left * 100) / 100, right: Math.round(code.right * 100) / 100, height: Math.round(code.height * 100) / 100},
      column: {left: column.left, right: column.right}, scroll: box.scrollWidth - box.clientWidth};
  };
  const layout = {
    narrow: fits('narrow'),
    url: fits('url-box'),
    words: {...fits('words-box'), broken: wordsWhole(document.getElementById('words'))},
    hyphenBroken: wordsWhole(document.getElementById('hyphen')),
    table: (() => {
      const box = document.getElementById('tbl-box');
      const table = document.getElementById('tbl');
      const labels = [...table.querySelectorAll('td:first-child')];
      return {box: box.getBoundingClientRect().width, table: table.getBoundingClientRect().width, scroll: box.scrollWidth - box.clientWidth,
        labelBroken: labels.flatMap((td) => wordsWhole(td)), labelWidths: labels.map((td) => Math.round(td.getBoundingClientRect().width)),
        rule: {...fits('tbl-box'), wrap: getComputedStyle(document.getElementById('tbl-rule')).overflowWrap},
        prose: getComputedStyle(document.getElementById('url')).overflowWrap};
    })(),
    line: {withCode: document.getElementById('line-box').getBoundingClientRect().height, plain: document.getElementById('plain-line').getBoundingClientRect().height},
  };
  return {expected, stripe, codes, layout, buttonHasCode: Boolean(document.querySelector('#btn-host button code'))};
};

const rgba = (value) => {
  const [r, g, b, a = 1] = String(value).match(/[\d.]+/gu).map(Number);
  return {r, g, b, a};
};
// The plate as it is seen: its colour laid over what is under it.
const over = (top, under) => {
  const t = rgba(top);
  const u = rgba(under);
  return ['r', 'g', 'b'].map((c) => t[c] * t.a + u[c] * (1 - t.a));
};
const distance = (a, b) => Math.max(...a.map((value, at) => Math.abs(value - b[at])));

const PROSE = ['in-p', 'in-li', 'in-td', 'in-h3', 'in-a', 'in-chat', 'in-strong', 'on-stripe', 'hyphen'];
const UNTOUCHED = ['in-sf-button', 'in-button', 'in-pre', 'in-highlight', 'in-highlighted', 'in-kbd', 'in-samp', 'classed', 'in-sf-color'];
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const near = (a, b) => Math.abs(a - b) < 0.06;

for (const theme of THEMES) {
  const page = await open(theme);
  const {expected, stripe, codes, layout, buttonHasCode} = await page.evaluate(read);
  const plateOnStripe = over(codes['on-stripe'].background, stripe);
  const stripeColour = over(stripe, 'rgb(0, 0, 0)');
  evidence[theme] = {
    expected,
    prose: codes['in-p'],
    heading: codes['in-h3'],
    stripe: {stripe, plate: codes['on-stripe'].background, seen: plateOnStripe.map(Math.round), difference: Math.round(distance(plateOnStripe, stripeColour))},
    hyphen: {display: codes.hyphen.display, width: codes.hyphen.width, height: codes.hyphen.height, broken: layout.hyphenBroken, ...layout.narrow},
    layout,
    untouched: Object.fromEntries(UNTOUCHED.map((id) => [id, codes[id] && {background: codes[id].background, padding: codes[id].paddingLeft, parent: codes[id].parent}])),
  };

  check(`${theme}: the plate is a real colour`, expected.background !== TRANSPARENT && /rgba\(.+, 0\.1[56]\d*\)/u.test(expected.background), expected);
  check(`${theme}: the radius resolves to 6px`, expected.radius === '6px', expected);
  check(`${theme}: the code in sf-button stays in its button`, buttonHasCode);

  for (const id of PROSE) {
    const code = codes[id];
    check(`${theme}: prose code was found`, Boolean(code), {id});
    if (!code) continue;
    check(`${theme}: prose code takes the plate`, code.background === expected.background, {id, got: code.background, expected: expected.background});
    check(`${theme}: prose code takes the text colour`, code.color === expected.color, {id, got: code.color, expected: expected.color});
    check(`${theme}: prose code is 85 % of its text`, near(code.fontSize, code.parentFontSize * 0.85), {id, got: code.fontSize, parent: code.parentFontSize});
    check(`${theme}: prose code has .2em above and below`, near(parseFloat(code.paddingTop), code.fontSize * 0.2) && near(parseFloat(code.paddingBottom), code.fontSize * 0.2),
      {id, got: [code.paddingTop, code.paddingBottom], fontSize: code.fontSize});
    check(`${theme}: prose code has .4em beside`, near(parseFloat(code.paddingLeft), code.fontSize * 0.4) && near(parseFloat(code.paddingRight), code.fontSize * 0.4),
      {id, got: [code.paddingLeft, code.paddingRight], fontSize: code.fontSize});
    check(`${theme}: prose code takes the radius`, code.radius === expected.radius, {id, got: code.radius, expected: expected.radius});
    check(`${theme}: prose code is mono`, /ui-monospace/u.test(code.fontFamily), {id, got: code.fontFamily});
    check(`${theme}: prose code is inline and wraps`, code.display === 'inline' && code.whiteSpace !== 'nowrap', {id, got: [code.display, code.whiteSpace]});
    check(`${theme}: prose code outside an opted-in container is not a control`, code.role === null && code.tabindex === null, {id, role: code.role});
  }
  // The plate is visible on a surface-2 stripe: laid over the stripe it is
  // another colour, not the stripe again.
  check(`${theme}: the plate shows on a surface-2 stripe`, distance(plateOnStripe, stripeColour) >= 6, evidence[theme].stripe);
  // A name with hyphens that does not fit the rest of the line may part at a
  // hyphen, never between two letters, and stays in its column.
  check(`${theme}: sf-button-press parts at a hyphen only`, layout.hyphenBroken.length === 0 && layout.narrow.scroll <= 0, evidence[theme].hyphen);
  // A URL longer than the line breaks and stays in its column.
  check(`${theme}: a long URL stays in its column`, layout.url.code.right <= layout.url.column.right + 0.5 && layout.url.scroll <= 0
    && layout.url.code.height > codes.url.fontSize * 2, layout.url);
  // Code with spaces longer than the line breaks at its spaces (and hyphens),
  // never between two letters.
  check(`${theme}: code with spaces keeps its words whole`, layout.words.broken.length === 0 && layout.words.code.right <= layout.words.column.right + 0.5, layout.words);
  // A long value in a table cell breaks anywhere: the table stays in its
  // box and the label column keeps its words (C10 variant A, 2026-11-11).
  check(`${theme}: a long value in a table cell never widens the table`, layout.table.table <= layout.table.box + 0.5 && layout.table.scroll <= 0
    && layout.table.rule.wrap === 'anywhere' && layout.table.prose === 'break-word', layout.table);
  check(`${theme}: the label column keeps its words`, layout.table.labelBroken.length === 0, layout.table);
  // Code does not make the text line taller.
  check(`${theme}: a line with code keeps the text line height`, Math.abs(layout.line.withCode - layout.line.plain) < 0.5, layout.line);

  // The tones are recipes: two public variables on any ancestor.
  check(`${theme}: secondary tone`, codes['tone-secondary'].color === expected.secondary && codes['tone-secondary'].background === expected.background,
    {got: codes['tone-secondary'], expected: expected.secondary});
  check(`${theme}: tertiary tone on its container`, codes['tone-tertiary'].color === expected.onTertiaryContainer && codes['tone-tertiary'].background === expected.tertiaryContainer,
    {got: [codes['tone-tertiary'].color, codes['tone-tertiary'].background], expected: [expected.onTertiaryContainer, expected.tertiaryContainer]});

  for (const id of UNTOUCHED) {
    const code = codes[id];
    check(`${theme}: component code was found`, Boolean(code), {id, ids: Object.keys(codes)});
    if (!code) continue;
    check(`${theme}: component code takes no plate`, code.background !== expected.background, {id, got: code.background, parent: code.parent});
    check(`${theme}: component code takes no padding`, code.paddingLeft === '0px' && code.paddingRight === '0px' && code.paddingTop === '0px', {id, got: code.paddingLeft, parent: code.parent});
    check(`${theme}: component code keeps its size`, !near(code.fontSize, code.parentFontSize * 0.85) || id === 'in-pre' || id === 'in-highlight' || id === 'in-highlighted',
      {id, got: code.fontSize, parent: code.parentFontSize});
  }
  // pre > code: what the browser gives a block of code, untouched by the rule.
  for (const id of ['in-pre', 'in-highlight']) {
    check(`${theme}: a block of code keeps a transparent background`, codes[id]?.background === TRANSPARENT, {id, got: codes[id]?.background});
  }

  // Low weight: a utility and an unlayered site rule both win.
  check(`${theme}: a utility wins`, /, 0\)$/u.test(codes['with-utility'].background), {got: codes['with-utility'].background});
  check(`${theme}: an unlayered site rule wins`, codes['site-rule'].background === 'rgb(1, 2, 3)', {got: codes['site-rule'].background});

  // Copy on click, inside the opted-in container only.
  check(`${theme}: an opted-in code is a button`, codes['copy-me'].role === 'button' && codes['copy-me'].tabindex === '0' && /sf-button-press/u.test(codes['copy-me'].label ?? ''),
    {got: [codes['copy-me'].role, codes['copy-me'].tabindex, codes['copy-me'].label]});
  for (const id of ['copy-pre', 'copy-highlight', 'copy-off']) {
    check(`${theme}: ${id} is not a copy control`, codes[id].role === null && codes[id].tabindex === null, {id, got: codes[id].role});
  }
  const status = () => page.evaluate(() => {
    const element = document.querySelector('.sf-code-copy-status');
    if (!element) return null;
    const box = element.getBoundingClientRect();
    const code = document.activeElement?.localName === 'code' ? document.activeElement : document.getElementById('copy-me');
    const anchor = code.getBoundingClientRect();
    return {text: element.textContent, role: element.getAttribute('role'), shown: element.hasAttribute('data-shown'), opacity: getComputedStyle(element).opacity,
      above: box.bottom <= anchor.top + 0.5, centred: Math.abs(box.left + box.width / 2 - (anchor.left + anchor.width / 2)) < 1};
  });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  const hover = await (async () => {
    await page.hover('#copy-me');
    await page.waitForTimeout(300);
    return page.evaluate(() => getComputedStyle(document.getElementById('copy-me')).boxShadow);
  })();
  check(`${theme}: a hairline on hover`, /inset/u.test(hover) && /1px/u.test(hover), {got: hover});
  await page.click('#copy-me');
  await page.waitForTimeout(250);
  const byClick = {clipboard: await clipboard(), status: await status()};
  check(`${theme}: a click copies`, byClick.clipboard === 'sf-button-press', byClick);
  check(`${theme}: a click says Скопировано above the code`, byClick.status?.text === 'Скопировано' && byClick.status.role === 'status' && byClick.status.shown && byClick.status.above && byClick.status.centred, byClick);

  // From the keyboard: Tab from the code before it, so the ring is the
  // keyboard's (:focus-visible).
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.focus('#copy-me');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.id);
  const ring = await page.evaluate(() => getComputedStyle(document.getElementById('copy-key')).outlineStyle);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const byEnter = {focused, clipboard: await clipboard(), status: await status()};
  await page.evaluate(() => navigator.clipboard.writeText(''));
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press(' ');
  await page.waitForTimeout(250);
  const bySpace = {clipboard: await clipboard(), scrolled: (await page.evaluate(() => scrollY)) - before};
  check(`${theme}: Tab reaches the next code`, focused === 'copy-key', {focused});
  check(`${theme}: Enter copies`, byEnter.clipboard === 'npm test' && byEnter.status?.text === 'Скопировано', byEnter);
  check(`${theme}: Space copies and does not scroll`, bySpace.clipboard === 'npm test' && bySpace.scrolled === 0, bySpace);
  check(`${theme}: the focus ring is drawn`, ring === 'solid', {got: ring});

  await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
  await page.click('#copy-pre');
  await page.click('#copy-off');
  await page.waitForTimeout(200);
  check(`${theme}: a block of code and an opted-out part do not copy`, (await clipboard()) === 'unchanged');
  evidence[theme].copy = {hover, byClick, byEnter, bySpace, ring};

  if (SHOTS) {
    await page.focus('#copy-me');
    await page.click('#copy-me');
    await page.waitForTimeout(250);
    await page.screenshot({path: join(SHOTS, `inline-code-${theme}.png`), fullPage: true});
  }
  await page.context().close();
}

const light = evidence.light.expected.background;
const dark = evidence.dark.expected.background;
check('the two themes draw different plates', light !== dark, {light, dark});

await browser.close();

console.log(JSON.stringify(evidence, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures: failures.slice(0, 60), total: failures.length}, null, 1));
  process.exit(1);
}
console.log('INLINE_CODE_OK');
