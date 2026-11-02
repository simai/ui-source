#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Code in running text (owner, 2026-11-02), on the built bytes in a browser:
// in both themes a <code> in a paragraph, a list item, a table cell, a heading,
// a link and chat-like markup gets the quiet neutral plate -- the background of
// --sf-surface-container, padding-inline --sf-space-1/4, the radius
// --sf-radius--ui, .875em and the mono family. A <code> the Framework draws or
// that sits in a block or a control is left as it was: inside an sf-button's
// text, a highlighted block (sf-highlight), pre > code, kbd, samp, a code
// carrying an sf- class, and a Smart component's own markup (sf-color's value).
// The rule weighs what a bare `code` does: a utility and an unlayered site rule
// both win over it.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const THEMES = ['light', 'dark'];
const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/highlight/css/highlight.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'component/component/highlight/js/highlight.js', 'smart/smart/color/js/color.js'];

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
  <sf-color id="color" value="#1a7f37"></sf-color>

  <p>Utility <code class="bg-transparent" id="with-utility">x</code></p>
  <p class="site">Site <code id="site-rule">x</code></p>`;

const browser = await chromium.launch();

async function open(theme) {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', theme, said: error.message}); });
  const html = `<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8">
    <style>.site code { background-color: rgb(1, 2, 3); }</style></head>
    <body style="margin:16px;background:var(--sf-surface-0)">${BODY}</body></html>`;
  await page.route('http://inline-code.test/**', (route) => route.fulfill({contentType: 'text/html; charset=utf-8', body: html}));
  await page.goto('http://inline-code.test/');
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-button') && customElements.get('sf-color'));
  await page.waitForFunction(() => document.querySelector('#btn-host > button') && document.querySelector('#color .sf-color-text code'));
  await page.waitForTimeout(500);
  return page;
}

const read = () => {
  const style = (element) => {
    const s = getComputedStyle(element);
    return {
      background: s.backgroundColor,
      paddingLeft: s.paddingLeft,
      paddingRight: s.paddingRight,
      radius: s.borderTopLeftRadius,
      fontSize: parseFloat(s.fontSize),
      parentFontSize: parseFloat(getComputedStyle(element.parentElement).fontSize),
      fontFamily: s.fontFamily,
    };
  };
  // What the tokens resolve to, read off an element that asks for them.
  const probe = document.createElement('div');
  probe.style.cssText = 'background-color:var(--sf-surface-container);padding-left:var(--sf-space-1\\/4);border-radius:var(--sf-radius--ui)';
  document.body.append(probe);
  const p = getComputedStyle(probe);
  const expected = {background: p.backgroundColor, padding: p.paddingLeft, radius: p.borderTopLeftRadius};
  probe.remove();
  const codes = {};
  for (const code of document.querySelectorAll('code')) {
    const id = code.id || (code.closest('#color') ? 'in-sf-color' : code.closest('#btn-host') ? 'in-sf-button' : null)
      || `unnamed-${Object.keys(codes).length}`;
    codes[id] = {...style(code), parent: code.parentElement.localName + (code.parentElement.className ? `.${String(code.parentElement.className).split(/\s+/u)[0]}` : ''), classes: code.className};
  }
  return {expected, codes, buttonHasCode: Boolean(document.querySelector('#btn-host button code'))};
};

const PROSE = ['in-p', 'in-li', 'in-td', 'in-h3', 'in-a', 'in-chat', 'in-strong'];
const UNTOUCHED = ['in-sf-button', 'in-button', 'in-pre', 'in-highlight', 'in-highlighted', 'in-kbd', 'in-samp', 'classed', 'in-sf-color'];
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

for (const theme of THEMES) {
  const page = await open(theme);
  const {expected, codes, buttonHasCode} = await page.evaluate(read);
  evidence[theme] = {expected, prose: codes['in-p'], untouched: Object.fromEntries(UNTOUCHED.map((id) => [id, codes[id] && {background: codes[id].background, padding: codes[id].paddingLeft, parent: codes[id].parent}]))};

  check(`${theme}: the plate is a real colour`, expected.background !== TRANSPARENT && /rgba\(.+, 0\.1[56]\d*\)/u.test(expected.background), expected);
  check(`${theme}: the padding resolves`, parseFloat(expected.padding) > 0, expected);
  check(`${theme}: the radius resolves`, parseFloat(expected.radius) > 0, expected);
  check(`${theme}: the code in sf-button stays in its button`, buttonHasCode);

  for (const id of PROSE) {
    const code = codes[id];
    check(`${theme}: prose code was found`, Boolean(code), {id});
    if (!code) continue;
    check(`${theme}: prose code takes the plate`, code.background === expected.background, {id, got: code.background, expected: expected.background});
    check(`${theme}: prose code takes the padding`, code.paddingLeft === expected.padding && code.paddingRight === expected.padding, {id, got: [code.paddingLeft, code.paddingRight], expected: expected.padding});
    check(`${theme}: prose code takes the radius`, code.radius === expected.radius, {id, got: code.radius, expected: expected.radius});
    check(`${theme}: prose code is .875em`, Math.abs(code.fontSize - code.parentFontSize * 0.875) < 0.05, {id, got: code.fontSize, parent: code.parentFontSize});
    check(`${theme}: prose code is mono`, /ui-monospace/u.test(code.fontFamily), {id, got: code.fontFamily});
  }

  for (const id of UNTOUCHED) {
    const code = codes[id];
    check(`${theme}: component code was found`, Boolean(code), {id, ids: Object.keys(codes)});
    if (!code) continue;
    check(`${theme}: component code takes no plate`, code.background !== expected.background, {id, got: code.background, parent: code.parent});
    check(`${theme}: component code takes no padding`, code.paddingLeft === '0px' && code.paddingRight === '0px', {id, got: code.paddingLeft, parent: code.parent});
    check(`${theme}: component code keeps its size`, Math.abs(code.fontSize - code.parentFontSize * 0.875) > 0.05 || id === 'in-pre' || id === 'in-highlight' || id === 'in-highlighted',
      {id, got: code.fontSize, parent: code.parentFontSize});
  }
  // pre > code: what the browser gives a block of code, untouched by the rule.
  for (const id of ['in-pre', 'in-highlight']) {
    check(`${theme}: a block of code keeps a transparent background`, codes[id]?.background === TRANSPARENT, {id, got: codes[id]?.background});
  }

  // Low weight: a utility and an unlayered site rule both win.
  check(`${theme}: a utility wins`, /, 0\)$/u.test(codes['with-utility'].background), {got: codes['with-utility'].background});
  check(`${theme}: an unlayered site rule wins`, codes['site-rule'].background === 'rgb(1, 2, 3)', {got: codes['site-rule'].background});
  await page.close();
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
