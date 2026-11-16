#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-rich-text on the built bytes, loaded by the real Loader from its rule:
// - the subset in the browser: every vector of tests/fixtures/rich-text-
//   vectors.json set as the value gives the value the string reader gives,
//   and nothing in any of them runs;
// - typing, Mod+B, undo and redo, the bulleted list on and off, a heading;
// - an HTML paste and a plain-text paste cleaned to the subset;
// - the link editor: Mod+K opens it, a javascript: address is refused with
//   the language file's words, a /path is applied;
// - the form value, input once per change, change once on leaving, a form
//   reset back to the value attribute with no event, required's
//   value-missing;
// - the keyboard: one Tab stop for the toolbar, the arrows, Home and End
//   inside it, Tab into the text and out of the field with no tab typed;
// - the frame against sf-input-textarea's at sizes 1/2, 1 and 2: the border, the
//   radius, the padding, the text size and line height;
// - text, placeholder, hint and a pressed tool against their backgrounds,
//   at least 4.5:1, in the light and the dark theme.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);
const vectors = JSON.parse(readFileSync(new URL('../fixtures/rich-text-vectors.json', import.meta.url), 'utf8'));
const ru = JSON.parse(readFileSync(new URL('../../src/smart/input-rich/lang/ru.json', import.meta.url), 'utf8')).runtime;

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const shell = (theme, body) => `<!doctype html><html lang="en" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};
window.__ran = 0; window.alert = () => { window.__ran += 1; };</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;display:grid;gap:16px;background:var(--sf-surface-0)">
${body}
</body></html>`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => {
  if (!pass) failures.push({name, ...detail});
};
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

async function open(page, theme, body) {
  current = shell(theme, body);
  await page.goto(`${base}/probe`, {waitUntil: 'load'});
  await page.waitForFunction(() => customElements.get('sf-input-rich')
    && [...document.querySelectorAll('sf-input-rich')].every((el) => el.querySelector('.sf-rich-text-editor') && el.querySelectorAll('button.sf-rich-text-tool').length === 12), null, {timeout: 20000});
  await page.waitForTimeout(300);
  if (process.env.RICH_TEXT_SHOT) await page.screenshot({path: `${process.env.RICH_TEXT_SHOT}-${theme}-${Date.now()}.png`, fullPage: true});
}

const value = (page, id = 'r') => page.evaluate((one) => document.getElementById(one).value, id);
const focusEnd = async (page, id = 'r') => {
  await page.evaluate((one) => {
    const editor = document.querySelector(`#${one} .sf-rich-text-editor`);
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor.lastElementChild || editor);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }, id);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });

  // ---- the subset in the browser ---------------------------------------
  await open(page, 'theme-light', `
    <form id="f">
      <button id="before" type="button">Before</button>
      <sf-input-rich id="r" label="Page text" name="body" hint="Formatted text" value="<p>Start</p>"></sf-input-rich>
      <button id="after" type="button">After</button>
      <sf-input-rich id="req" label="Required" name="req" required></sf-input-rich>
    </form>
    <div lang="ru"><sf-input-rich id="ru" aria-label="Text"></sf-input-rich></div>`);
  const subset = await page.evaluate((list) => {
    const el = document.getElementById('scratch') || document.body.appendChild(Object.assign(document.createElement('sf-input-rich'), {id: 'scratch'}));
    return list.map(({input, value}) => {
      el.value = input;
      return {input, expected: value, got: el.value};
    });
  }, vectors);
  await page.waitForTimeout(300);
  for (const one of subset) check(`subset: ${one.input.slice(0, 60)}`, one.got === one.expected, {expected: one.expected, got: one.got});
  check('subset: nothing ran', await page.evaluate(() => window.__ran === 0));
  evidence.vectors = subset.length;

  // ---- keyboard toolbar --------------------------------------------------------
  await page.focus('#before');
  await page.keyboard.press('Tab');
  const tool = () => page.evaluate(() => document.activeElement?.dataset?.sfTool || document.activeElement?.className || document.activeElement?.tagName);
  check('Tab reaches the toolbar once', await tool() === 'paragraph', {got: await tool()});
  await page.keyboard.press('ArrowRight');
  check('ArrowRight', await tool() === 'heading-2', {got: await tool()});
  await page.keyboard.press('End');
  check('End', await tool() === 'redo', {got: await tool()});
  await page.keyboard.press('ArrowRight');
  check('ArrowRight wraps', await tool() === 'paragraph', {got: await tool()});
  await page.keyboard.press('ArrowLeft');
  check('ArrowLeft wraps', await tool() === 'redo', {got: await tool()});
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  check('Tab from the toolbar goes to the text', await page.evaluate(() => document.activeElement === document.querySelector('#r .sf-rich-text-editor')));
  await page.keyboard.press('Shift+Tab');
  check('Shift+Tab comes back to the last tool', await tool() === 'heading-2', {got: await tool()});
  check('one tool is a Tab stop', await page.evaluate(() => [...document.querySelectorAll('#r button.sf-rich-text-tool')].filter((button) => button.tabIndex === 0).length === 1));

  // ---- events, typing, bold, undo, redo ---------------------------------
  await page.evaluate(() => {
    window.__events = [];
    const el = document.getElementById('r');
    for (const type of ['input', 'change']) el.addEventListener(type, (event) => window.__events.push(`${type}:${event.inputType || ''}`));
  });
  await focusEnd(page);
  await page.keyboard.press('End');
  await page.keyboard.type(' text');
  check('typing: value', await value(page) === '<p>Start text</p>', {got: await value(page)});
  check('typing: input per key', (await page.evaluate(() => window.__events.filter((one) => one.startsWith('input')).length)) === 5);
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press(`${mod}+b`);
  check('Mod+B: bold', await value(page) === '<p>Start <strong>text</strong></p>', {got: await value(page)});
  check('Mod+B: pressed', await page.evaluate(() => document.querySelector('#r [data-sf-tool=bold]').getAttribute('aria-pressed') === 'true'));
  await page.keyboard.press(`${mod}+z`);
  check('Mod+Z: undo', await value(page) === '<p>Start text</p>', {got: await value(page)});
  await page.keyboard.press(`${mod}+Shift+z`);
  check('Mod+Shift+Z: redo', await value(page) === '<p>Start <strong>text</strong></p>', {got: await value(page)});
  await page.keyboard.press(`${mod}+y`);
  check('Mod+Y with nothing to redo keeps the value', await value(page) === '<p>Start <strong>text</strong></p>');

  // ---- lists, headings, quote from the toolbar ---------------------------
  await page.click('#r [data-sf-tool="bulleted-list"]');
  check('list on', await value(page) === '<ul><li>Start <strong>text</strong></li></ul>', {got: await value(page)});
  check('list pressed', await page.evaluate(() => document.querySelector('#r [data-sf-tool="bulleted-list"]').getAttribute('aria-pressed') === 'true'));
  check('heading unavailable in a list', await page.evaluate(() => document.querySelector('#r [data-sf-tool="heading-2"]').getAttribute('aria-disabled') === 'true'));
  await page.click('#r [data-sf-tool="numbered-list"]');
  check('list kind changes', await value(page) === '<ol><li>Start <strong>text</strong></li></ol>', {got: await value(page)});
  await page.click('#r [data-sf-tool="numbered-list"]');
  check('list off', await value(page) === '<p>Start <strong>text</strong></p>', {got: await value(page)});
  await page.click('#r [data-sf-tool="heading-2"]');
  check('heading 2', await value(page) === '<h2>Start <strong>text</strong></h2>', {got: await value(page)});
  await page.click('#r [data-sf-tool="heading-2"]');
  check('heading 2 off is a paragraph', await value(page) === '<p>Start <strong>text</strong></p>', {got: await value(page)});
  await page.click('#r [data-sf-tool="quote"]');
  check('quote', await value(page) === '<blockquote><p>Start <strong>text</strong></p></blockquote>', {got: await value(page)});
  await page.click('#r [data-sf-tool="quote"]');
  check('quote off', await value(page) === '<p>Start <strong>text</strong></p>', {got: await value(page)});
  const inputs = await page.evaluate(() => window.__events.filter((one) => one.startsWith('input')).length);
  check('one input per command', inputs === 5 + 3 + 7, {inputs, events: await page.evaluate(() => window.__events)});

  // ---- paste --------------------------------------------------------------
  const paste = (data) => page.evaluate((entries) => {
    const transfer = new DataTransfer();
    for (const [type, text] of Object.entries(entries)) transfer.setData(type, text);
    document.querySelector('#r .sf-rich-text-editor').dispatchEvent(new ClipboardEvent('paste', {clipboardData: transfer, bubbles: true, cancelable: true}));
  }, data);
  await page.evaluate(() => { document.getElementById('r').value = ''; });
  await focusEnd(page);
  await paste({'text/html': '<meta charset="utf-8"><p onclick="alert(1)" style="color:red">Pasted <script>alert(1)</script><b>bold</b> <a href="javascript:alert(1)">bad</a> <a href="https://simai.io/x" target="_blank">good</a></p><div>Two</div><img src=x onerror="alert(1)">', 'text/plain': 'ignored'});
  check('HTML paste cleaned', await value(page) === '<p>Pasted <strong>bold</strong> bad <a href="https://simai.io/x">good</a></p><p>Two</p>', {got: await value(page)});
  await page.evaluate(() => { document.getElementById('r').value = ''; });
  await focusEnd(page);
  await paste({'text/plain': 'one\ntwo\n\nthree <b>&'});
  check('plain paste: paragraphs and breaks', await value(page) === '<p>one<br>two</p><p>three &lt;b&gt;&amp;</p>', {got: await value(page)});
  check('paste: nothing ran', await page.evaluate(() => window.__ran === 0));

  // ---- link editor ---------------------------------------------------------
  await page.evaluate(() => { document.getElementById('r').value = '<p>Read the docs</p>'; });
  await page.evaluate(() => {
    const text = document.querySelector('#r .sf-rich-text-editor p').firstChild;
    document.querySelector('#r .sf-rich-text-editor').focus();
    const range = document.createRange();
    range.setStart(text, 9);
    range.setEnd(text, 13);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.keyboard.press(`${mod}+k`);
  await page.waitForTimeout(300);
  check('Mod+K opens the link editor', await page.evaluate(() => document.querySelector('#r sf-popover').getAttribute('data-open') === 'true'));
  check('the address field has focus', await page.evaluate(() => Boolean(document.activeElement?.closest('.sf-rich-text-link-input'))));
  await page.keyboard.type('javascript:alert(1)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check('javascript: is refused with the words', await page.evaluate(() => document.querySelector('#r sf-popover').getAttribute('data-open') === 'true'
    && document.querySelector('#r .sf-rich-text-link-input').textContent.includes('Use an https:')));
  check('refused: the value is unchanged', await value(page) === '<p>Read the docs</p>');
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.type('/docs');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check('a /path is applied', await value(page) === '<p>Read the <a href="/docs">docs</a></p>', {got: await value(page)});
  check('the caret is back in the text', await page.evaluate(() => document.activeElement === document.querySelector('#r .sf-rich-text-editor')));
  check('the link editor closed', await page.evaluate(() => document.querySelector('#r sf-popover').getAttribute('data-open') !== 'true'));

  // ---- form ------------------------------------------------------------------
  check('form value', await page.evaluate(() => new FormData(document.getElementById('f')).get('body') === document.getElementById('r').value));
  check('required: value-missing', await page.evaluate(() => document.getElementById('req').validity.valueMissing && !document.getElementById('f').checkValidity()));
  await page.evaluate(() => { window.__events = []; });
  await page.evaluate(() => document.getElementById('f').reset());
  await page.waitForTimeout(200);
  // A value set from code is the default, as on sf-input-textarea: the property
  // writes the attribute.
  check('reset: back to the value attribute', await value(page) === '<p>Read the docs</p>', {got: await value(page)});
  check('reset: no event', await page.evaluate(() => window.__events.length === 0), {events: await page.evaluate(() => window.__events)});

  // change: once, on leaving the field with a changed value.
  await focusEnd(page);
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Tab');
  check('Tab leaves the text, no tab typed', await page.evaluate(() => document.activeElement?.id === 'after') && await value(page) === '<p>Read the docs!</p>', {got: await value(page)});
  check('change once on leaving', await page.evaluate(() => window.__events.filter((one) => one.startsWith('change')).length === 1), {events: await page.evaluate(() => window.__events)});

  // ---- accessibility and language ------------------------------------------------
  check('textbox semantics', await page.evaluate(() => {
    const editor = document.querySelector('#r .sf-rich-text-editor');
    const bar = document.querySelector('#r [role=toolbar]');
    return editor.getAttribute('role') === 'textbox' && editor.getAttribute('aria-multiline') === 'true'
      && document.getElementById(editor.getAttribute('aria-labelledby')).textContent.trim() === 'Page text'
      && bar.getAttribute('aria-label') === 'Formatting' && bar.getAttribute('aria-controls') === editor.id
      && document.querySelector('#req .sf-rich-text-editor').getAttribute('aria-required') === 'true';
  }));
  check('Russian words on a Russian region', await page.evaluate((words) => document.querySelector('#ru [role=toolbar]').getAttribute('aria-label') === words.toolbar
    && document.querySelector('#ru [data-sf-tool=bold]').getAttribute('aria-label') === words.bold
    && document.querySelector('#ru .sf-rich-text-editor').getAttribute('aria-label') === 'Text', ru));

  // ---- geometry against sf-input-textarea ------------------------------------------------
  await open(page, 'theme-light', ['1/2', '1', '2'].map((size) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <sf-input-textarea data-size="${size}" size="${size}" label="Text" rows="2"></sf-input-textarea>
      <sf-input-rich data-size="${size}" size="${size}" label="Text" rows="2"></sf-input-rich></div>`).join(''));
  await page.waitForFunction(() => document.querySelectorAll('sf-input-textarea textarea').length === 3, null, {timeout: 10000});
  // At rest: nothing hovered.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  const geometry = await page.evaluate(() => ['1/2', '1', '2'].map((size) => {
    const textarea = getComputedStyle(document.querySelector(`sf-input-textarea[data-size="${size}"] textarea`));
    const frame = getComputedStyle(document.querySelector(`sf-input-rich[data-size="${size}"] .sf-rich-text-frame`));
    const editor = getComputedStyle(document.querySelector(`sf-input-rich[data-size="${size}"] .sf-rich-text-editor`));
    const label = (selector) => getComputedStyle(document.querySelector(selector)).fontSize;
    return {
      size,
      textarea: [textarea.borderTopWidth, textarea.borderTopLeftRadius, textarea.borderTopColor, textarea.backgroundColor, textarea.paddingTop, textarea.paddingLeft, textarea.fontSize, textarea.lineHeight, label(`sf-input-textarea[data-size="${size}"] .sf-textarea-text`)],
      richText: [frame.borderTopWidth, frame.borderTopLeftRadius, frame.borderTopColor, frame.backgroundColor, editor.paddingTop, editor.paddingLeft, editor.fontSize, editor.lineHeight, label(`sf-input-rich[data-size="${size}"] .sf-rich-text-text`)],
    };
  }));
  for (const one of geometry) check(`frame matches sf-input-textarea at size ${one.size}`, JSON.stringify(one.textarea) === JSON.stringify(one.richText), one);
  evidence.geometry = geometry;

  // ---- contrast, light and dark ------------------------------------------------------
  for (const theme of ['theme-light', 'theme-dark']) {
    // Core takes the theme from the person's preference, the system's by
    // default: the dark pass asks for a dark system.
    await page.emulateMedia({colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
    await open(page, theme, `<sf-input-rich id="c" label="Text" hint="A hint" placeholder="Write here" rows="2"></sf-input-rich>
      <sf-input-rich id="t" label="Text" value="<p><strong>Bold</strong> and <a href='/x'>link</a></p><blockquote><p>Quote</p></blockquote>" rows="2"></sf-input-rich>`);
    await page.evaluate(() => {
      const editor = document.querySelector('#t .sf-rich-text-editor');
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor.querySelector('strong'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    await page.waitForTimeout(300);
    const ratios = await page.evaluate(() => {
      const canvas = document.createElement('canvas').getContext('2d');
      const rgba = (color) => {
        canvas.fillStyle = '#000';
        canvas.fillStyle = color;
        const value = canvas.fillStyle;
        if (value.startsWith('#')) return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)).concat(1);
        const parts = value.match(/[\d.]+/gu).map(Number);
        return [parts[0], parts[1], parts[2], parts[3] ?? 1];
      };
      // The background an element shows: its own, laid over its ancestors'.
      const background = (element) => {
        const layers = [];
        for (let node = element; node; node = node.parentElement) layers.push(rgba(getComputedStyle(node).backgroundColor));
        let result = [255, 255, 255];
        for (const layer of layers.reverse()) result = result.map((channel, index) => channel * (1 - layer[3]) + layer[index] * layer[3]);
        return result;
      };
      const luminance = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
      const ratio = (element, pseudo = null) => {
        const fore = rgba(getComputedStyle(element, pseudo).color);
        const back = background(element);
        const ink = fore.slice(0, 3).map((channel, index) => channel * fore[3] + back[index] * (1 - fore[3]));
        const [a, b] = [luminance(ink), luminance(back)].sort((x, y) => y - x);
        return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
      };
      return {
        text: ratio(document.querySelector('#t .sf-rich-text-editor p')),
        link: ratio(document.querySelector('#t .sf-rich-text-editor a')),
        quote: ratio(document.querySelector('#t .sf-rich-text-editor blockquote p')),
        placeholder: ratio(document.querySelector('#c .sf-rich-text-editor'), '::before'),
        hint: ratio(document.querySelector('#c .sf-rich-text-hint-text-wrap')),
        label: ratio(document.querySelector('#c .sf-rich-text-text')),
        tool: ratio(document.querySelector('#t [data-sf-tool=italic] .sf-icon')),
        pressed: ratio(document.querySelector('#t [data-sf-tool=bold] .sf-icon')),
        disabledTool: getComputedStyle(document.querySelector('#c [data-sf-tool=undo] .sf-icon')).color === getComputedStyle(document.querySelector('#c [data-sf-tool=bold] .sf-icon')).color ? 'same' : 'differs',
        pressedOn: document.querySelector('#t [data-sf-tool=bold]').getAttribute('aria-pressed'),
      };
    });
    evidence[theme] = ratios;
    check(`${theme}: the page is in that theme`, await page.evaluate((name) => document.documentElement.classList.contains(name), theme));
    check(`${theme}: the bold tool is pressed`, ratios.pressedOn === 'true');
    check(`${theme}: undo with nothing to undo is drawn unavailable`, ratios.disabledTool === 'differs');
    for (const [part, value] of Object.entries(ratios)) {
      if (typeof value === 'number') check(`${theme}: ${part} contrast ${value} >= 4.5`, value >= 4.5, {value});
    }
  }

  // ---- IME composition takes the caret's pending marks ------------------
  // Synthetic composition events as a browser sends them: compositionstart,
  // then per step the text written at the caret with compositionupdate and
  // an input that is composing, then compositionend with the composed text.
  // And the same through the browser's own IME (CDP), where it has one.
  const compose = (page, steps) => page.evaluate((list) => {
    const editor = document.querySelector('#r .sf-rich-text-editor');
    const selection = getSelection();
    const range = selection.getRangeAt(0);
    let text = range.startContainer.nodeType === 3 ? range.startContainer : null;
    let start = text ? range.startOffset : 0;
    if (!text) {
      text = document.createTextNode('');
      range.insertNode(text);
    }
    let written = 0;
    editor.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, data: ''}));
    for (const step of list) {
      editor.dispatchEvent(new InputEvent('beforeinput', {bubbles: true, inputType: 'insertCompositionText', data: step, isComposing: true}));
      text.replaceData(start, written, step);
      written = step.length;
      const caret = document.createRange();
      caret.setStart(text, start + written);
      selection.removeAllRanges();
      selection.addRange(caret);
      editor.dispatchEvent(new CompositionEvent('compositionupdate', {bubbles: true, data: step}));
      editor.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertCompositionText', data: step, isComposing: true}));
    }
    editor.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: list.at(-1)}));
  }, steps);
  // The caret at the end of the last text, where a click puts it.
  const caretInText = (page) => page.evaluate(() => {
    const editor = document.querySelector('#r .sf-rich-text-editor');
    editor.focus();
    const walker = document.createTreeWalker(editor, 4);
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) last = node;
    const range = document.createRange();
    range.setStart(last, last.data.length);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  const imeCases = [
    {name: 'Bold then composed', value: '<p>alpha</p>', keys: [`${mod}+b`], steps: ['n', 'に'], expected: '<p>alpha<strong>に</strong></p>'},
    {name: 'Italic then composed', value: '<p>alpha</p>', keys: [`${mod}+i`], steps: ['k', 'か', 'かな'], expected: '<p>alpha<em>かな</em></p>'},
    {name: 'Bold and Italic then composed', value: '<p>alpha</p>', keys: [`${mod}+b`, `${mod}+i`], steps: ['に'], expected: '<p>alpha<strong><em>に</em></strong></p>'},
    {name: 'Bold off in bold text then composed', value: '<p><strong>alpha</strong></p>', keys: [`${mod}+b`], steps: ['に'], expected: '<p><strong>alpha</strong>に</p>'},
    {name: 'caret moved: composed text plain', value: '<p>alpha</p>', keys: [`${mod}+b`, 'ArrowLeft', 'ArrowRight'], steps: ['に'], expected: '<p>alphaに</p>'},
    {name: 'no pending mark: composed text plain', value: '<p>alpha</p>', keys: [], steps: ['に'], expected: '<p>alphaに</p>'},
  ];
  for (const one of imeCases) {
    await open(page, 'theme-light', `<sf-input-rich id="r" label="Page text" value="${one.value}"></sf-input-rich>`);
    await caretInText(page);
    for (const key of one.keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(50);
    }
    await page.evaluate(() => { window.__said = []; document.getElementById('r').addEventListener('input', (event) => window.__said.push(event.inputType)); });
    await compose(page, one.steps);
    await page.waitForTimeout(50);
    const got = await value(page);
    check(`IME synthetic: ${one.name}`, got === one.expected, {expected: one.expected, got});
    if (one.keys[0] === `${mod}+b` && one.keys.length === 1 && !one.value.includes('strong')) {
      check(`IME synthetic: ${one.name}: one input after the marks`, await page.evaluate(() => window.__said.at(-1) === 'insertCompositionText'), {said: await page.evaluate(() => window.__said)});
      await page.keyboard.type('x');
      const after = await value(page);
      check(`IME synthetic: ${one.name}: typing goes on in the mark`, after === '<p>alpha<strong>にx</strong></p>', {got: after});
    }
  }
  // ---- IME follow-ups (acceptance M1-M4, E1) ----------------------------
  const bold = (page) => page.evaluate(() => document.querySelector('#r [data-sf-tool="bold"]').getAttribute('aria-pressed'));
  const listen = (page) => page.evaluate(() => {
    window.__inputs = [];
    document.getElementById('r').addEventListener('input', (event) => window.__inputs.push({type: event.inputType, composing: Boolean(event.isComposing)}));
  });
  const settled = (page) => page.evaluate(() => window.__inputs.filter((one) => !one.composing).length);
  // M2: Bold stays pressed while the composition runs; M1: a cancel keeps the mark pending.
  await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
  await caretInText(page);
  await page.keyboard.press(`${mod}+b`);
  await page.waitForTimeout(50);
  await listen(page);
  const during = await page.evaluate(async () => {
    const editor = document.querySelector('#r .sf-rich-text-editor');
    const selection = getSelection();
    const range = selection.getRangeAt(0);
    const text = range.startContainer;
    const start = range.startOffset;
    editor.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, data: ''}));
    text.replaceData(start, 0, 'n');
    const caret = document.createRange();
    caret.setStart(text, start + 1);
    selection.removeAllRanges();
    selection.addRange(caret);
    editor.dispatchEvent(new CompositionEvent('compositionupdate', {bubbles: true, data: 'n'}));
    editor.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertCompositionText', data: 'n', isComposing: true}));
    await new Promise((settle) => setTimeout(settle, 50));
    const pressed = document.querySelector('#r [data-sf-tool="bold"]').getAttribute('aria-pressed');
    // The person cancels: the candidate goes, the caret is back.
    text.replaceData(start, 1, '');
    const back = document.createRange();
    back.setStart(text, start);
    selection.removeAllRanges();
    selection.addRange(back);
    editor.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: ''}));
    await new Promise((settle) => setTimeout(settle, 50));
    return pressed;
  });
  check('IME synthetic M2: Bold pressed while composing', during === 'true', {during});
  check('IME synthetic M1: a cancel keeps the text', await value(page) === '<p>alpha</p>', {got: await value(page)});
  check('IME synthetic M1: a cancel keeps Bold pressed', await bold(page) === 'true', {got: await bold(page)});
  check('IME synthetic M3: a cancel that changed nothing says no input', await settled(page) === 0, {inputs: await page.evaluate(() => window.__inputs)});
  await page.keyboard.type('z');
  check('IME synthetic M1: typing after a cancel takes the mark', await value(page) === '<p>alpha<strong>z</strong></p>', {got: await value(page)});
  // M3: one input that is not composing after a composition, with and without pending marks.
  for (const [name, keys, expected] of [['no pending mark', [], '<p>alphaに</p>'], ['Bold pending', [`${mod}+b`], '<p>alpha<strong>に</strong></p>']]) {
    await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
    await caretInText(page);
    for (const key of keys) await page.keyboard.press(key);
    await page.waitForTimeout(50);
    await listen(page);
    await compose(page, ['n', 'に']);
    await page.waitForTimeout(80);
    check(`IME synthetic M3: ${name}: value`, await value(page) === expected, {got: await value(page)});
    check(`IME synthetic M3: ${name}: exactly one input not composing`, await settled(page) === 1, {inputs: await page.evaluate(() => window.__inputs)});
  }
  // M4: plain-text paste takes the pending marks, rich paste keeps its own.
  const pasteData = (page, data) => page.evaluate((items) => {
    const transfer = new DataTransfer();
    for (const [type, text] of Object.entries(items)) transfer.setData(type, text);
    document.querySelector('#r .sf-rich-text-editor').dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData: transfer}));
  }, data);
  for (const [name, data, expected] of [
    ['plain text takes the pending Bold', {'text/plain': 'pasted'}, '<p>alpha<strong>pasted</strong></p>'],
    ['rich text keeps its own marks', {'text/html': '<em>x</em>', 'text/plain': 'x'}, '<p>alpha<em>x</em></p>'],
  ]) {
    await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
    await caretInText(page);
    await page.keyboard.press(`${mod}+b`);
    await page.waitForTimeout(50);
    await pasteData(page, data);
    await page.waitForTimeout(50);
    check(`paste M4: ${name}`, await value(page) === expected, {got: await value(page)});
  }
  // E1: a caret at a bold run's end edge reads bold, as the text it types is.
  for (const [name, place] of [['at the paragraph level', 'block'], ['at the start of the next text', 'text']]) {
    await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p><strong>ab</strong>cd</p>"></sf-input-rich>');
    await page.evaluate((where) => {
      const editor = document.querySelector('#r .sf-rich-text-editor');
      editor.focus();
      const p = editor.querySelector('p');
      const range = document.createRange();
      if (where === 'block') range.setStart(p, 1);
      else range.setStart(p.lastChild, 0);
      range.collapse(true);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }, place);
    await page.waitForTimeout(80);
    check(`E1: ${name}: Bold pressed`, await bold(page) === 'true', {got: await bold(page)});
    await page.keyboard.type('x');
    check(`E1: ${name}: the text goes into the bold run`, await value(page) === '<p><strong>abx</strong>cd</p>', {got: await value(page)});
  }

  // The typed reference: the same caret mark on typed text.
  await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
  await focusEnd(page);
  await page.keyboard.press(`${mod}+b`);
  await page.keyboard.type('X');
  check('typed: Bold then typed', await value(page) === '<p>alpha<strong>X</strong></p>', {got: await value(page)});
  // The browser's own IME path.
  await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
  await focusEnd(page);
  await page.keyboard.press(`${mod}+b`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {text: 'n', selectionStart: 1, selectionEnd: 1});
  await cdp.send('Input.imeSetComposition', {text: 'に', selectionStart: 1, selectionEnd: 1});
  await cdp.send('Input.insertText', {text: 'に'});
  await page.waitForTimeout(50);
  check('IME (CDP): Bold then composed', await value(page) === '<p>alpha<strong>に</strong></p>', {got: await value(page)});
  await cdp.detach();
  // The browser's IME: a cancel keeps the pending Bold (M1), Bold pressed while composing (M2).
  await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
  await focusEnd(page);
  await page.keyboard.press(`${mod}+b`);
  const cdp2 = await page.context().newCDPSession(page);
  await cdp2.send('Input.imeSetComposition', {text: 'n', selectionStart: 1, selectionEnd: 1});
  await page.waitForTimeout(50);
  check('IME (CDP) M2: Bold pressed while composing', await bold(page) === 'true', {got: await bold(page)});
  await cdp2.send('Input.imeSetComposition', {text: '', selectionStart: 0, selectionEnd: 0});
  await page.waitForTimeout(50);
  check('IME (CDP) M1: a cancel keeps Bold pressed', await bold(page) === 'true', {got: await bold(page)});
  await page.keyboard.type('z');
  check('IME (CDP) M1: typing after a cancel takes the mark', await value(page) === '<p>alpha<strong>z</strong></p>', {got: await value(page)});
  // M3 through the browser's IME, no pending mark: one input that is not composing.
  await open(page, 'theme-light', '<sf-input-rich id="r" label="Page text" value="<p>alpha</p>"></sf-input-rich>');
  await focusEnd(page);
  await listen(page);
  await cdp2.send('Input.imeSetComposition', {text: 'n', selectionStart: 1, selectionEnd: 1});
  await cdp2.send('Input.imeSetComposition', {text: 'に', selectionStart: 1, selectionEnd: 1});
  await cdp2.send('Input.insertText', {text: 'に'});
  await page.waitForTimeout(80);
  check('IME (CDP) M3: no pending mark: exactly one input not composing', await settled(page) === 1, {inputs: await page.evaluate(() => window.__inputs)});
  await cdp2.detach();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('RICH_TEXT_OK');
