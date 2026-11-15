#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-input's password reveal, owner decision C191 (1)-(3), on the built bytes:
//
// (1) #q-pw-hide -- a revealed password hides again when its form is sent: the
//     submit button, Enter in the field, requestSubmit(), and a field joined to
//     its form by the form attribute. The native input is type password when
//     the page's own submit handler runs. Another form's submit leaves it shown.
// (2) #q-pw-hit -- on a touch screen (pointer: coarse; a touch context) the
//     eye's hit area is a square of the field's inner height; with a fine
//     pointer it keeps the C123 width. The glyph is the same size in both and
//     ends at the same place.
// (3) #q-pw-caps -- while the focused password field gets keys with Caps Lock
//     on, «Включён Caps Lock» / «Caps Lock is on» stands under the field in the
//     hint's type and ink, a polite live region says it, and it goes on blur or
//     when Caps Lock is turned off.
//
// Caps Lock: Chromium under automation never sets the lock that
// getModifierState('CapsLock') reads, and the DevTools protocol has no Caps
// Lock modifier. The page keeps the lock as a keyboard does -- every trusted
// CapsLock key press from the real (Playwright) keyboard flips it -- and
// trusted keyboard and mouse events answer getModifierState('CapsLock') from
// it; every other modifier is the browser's own. A second check sends the
// browser's own KeyboardEvent with modifierCapsLock, which its
// getModifierState reads without the shim.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
let html = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(html);
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

const CAPS_SHIM = () => {
  let lock = false;
  addEventListener('keydown', (event) => { if (event.key === 'CapsLock' && event.isTrusted) lock = !lock; }, true);
  for (const Type of [KeyboardEvent, MouseEvent]) {
    const own = Type.prototype.getModifierState;
    Type.prototype.getModifierState = function getModifierState(key) {
      return key === 'CapsLock' && this.isTrusted ? lock : own.call(this, key);
    };
  }
};

const page = (lang) => `<!doctype html><html class="theme-light" lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head>
<body style="margin:0;padding:16px">
<form id="sign-in" style="display:flex;flex-direction:column;gap:12px;width:420px">
  <sf-input id="pw" label="Пароль" input-type="password" default-value="secret123" hint="Не короче 8 знаков"></sf-input>
  <sf-input id="pw2" size="2" label="Пароль 2" input-type="password" default-value="secret123"></sf-input>
  <button id="go" type="submit">Войти</button>
</form>
<form id="other"></form>
<sf-input id="joined" label="Пароль" input-type="password" default-value="abc12345" form="other"></sf-input>
<form id="third"><sf-input id="stays" label="Пароль" input-type="password" default-value="abc12345"></sf-input></form>
<script>
  window.sent = [];
  for (const form of document.forms) form.addEventListener('submit', (event) => {
    event.preventDefault();
    sent.push({form: form.id, types: [...document.querySelectorAll('sf-input')].map((h) => [h.id, h.querySelector('input')?.type])});
  });
</script></body></html>`;

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

async function open(context, lang = 'ru') {
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  await tab.addInitScript(CAPS_SHIM);
  html = page(lang);
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => document.querySelectorAll('sf-input .sf-input-reveal').length === 4, null, {timeout: 10000})
    .catch(() => note({case: 'four password fields draw their eye', got: false}));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(400);
  return {tab, errors};
}

const reveal = (tab) => tab.evaluate(() => {
  const h = (id) => document.getElementById(id);
  // The reveal is named by its next action and carries no aria-pressed (C12 (3), RG-S2-15):
  // «shown» reads from the name «Скрыть пароль» / «Hide password»; an aria-pressed fails it.
  const shownBy = (button) => (button.hasAttribute('aria-pressed') ? 'aria-pressed present' : String(/Скрыть|Hide/u.test(button.getAttribute('aria-label') ?? '')));
  const state = (id) => ({type: h(id).querySelector('input').type, pressed: shownBy(h(id).querySelector('.sf-input-reveal'))});
  return Object.fromEntries(['pw', 'pw2', 'joined', 'stays'].map((id) => [id, state(id)]));
});

try {
  // (1) Hides on submit.
  {
    const context = await browser.newContext({viewport: {width: 900, height: 700}});
    const {tab, errors} = await open(context);
    const press = async (id) => { await tab.locator(`#${id} .sf-input-reveal`).click(); await tab.waitForTimeout(100); };
    await press('pw');
    const shown = await reveal(tab);
    if (shown.pw.type !== 'text' || shown.pw.pressed !== 'true') note({case: 'the eye shows the password', got: shown.pw});
    await tab.locator('#go').click();
    await tab.waitForTimeout(150);
    let after = await reveal(tab);
    let atSubmit = await tab.evaluate(() => sent.at(-1));
    if (after.pw.type !== 'password' || after.pw.pressed !== 'false') note({case: '(1) the submit button hides it', got: after.pw});
    if (!atSubmit || Object.fromEntries(atSubmit.types).pw !== 'password') note({case: '(1) hidden before the page handler runs', got: atSubmit});

    await press('pw2');
    await tab.locator('#pw2 input').focus();
    await tab.keyboard.press('Enter');
    await tab.waitForTimeout(150);
    after = await reveal(tab);
    if (after.pw2.type !== 'password' || after.pw2.pressed !== 'false') note({case: '(1) Enter in the field hides it', got: after.pw2});

    await press('joined');
    await press('stays');
    await tab.evaluate(() => document.getElementById('other').requestSubmit());
    await tab.waitForTimeout(150);
    after = await reveal(tab);
    if (after.joined.type !== 'password') note({case: '(1) requestSubmit() hides a field joined by the form attribute', got: after.joined});
    if (after.stays.type !== 'text' || after.stays.pressed !== 'true') note({case: '(1) another form leaves it shown', got: after.stays});
    if (errors.length) note({case: 'no page errors (1)', got: errors});
    await context.close();
  }

  // (2) The eye's hit area: fine pointer vs touch.
  const eye = async (touch) => {
    const context = await browser.newContext({viewport: {width: 900, height: 700}, hasTouch: touch, isMobile: touch});
    const {tab, errors} = await open(context);
    const result = await tab.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      rows: ['pw', 'pw2'].map((id) => {
        const h = document.getElementById(id);
        const field = h.querySelector('.sf-input-field').getBoundingClientRect();
        const hit = h.querySelector('.sf-input-reveal').getBoundingClientRect();
        const glyph = h.querySelector('.sf-input-reveal .sf-icon').getBoundingClientRect();
        return {id, inner: Math.round(field.height - 2), w: Math.round(hit.width), h: Math.round(hit.height), glyph: Math.round(glyph.width), toEnd: Math.round(field.right - glyph.right)};
      }),
    }));
    if (errors.length) note({case: `no page errors (2, touch ${touch})`, got: errors});
    await context.close();
    return result;
  };
  const fine = await eye(false);
  const coarse = await eye(true);
  if (fine.coarse || !coarse.coarse) note({case: '(2) the contexts are a fine and a coarse pointer', got: {fine: fine.coarse, coarse: coarse.coarse}});
  for (const [at, row] of coarse.rows.entries()) {
    const was = fine.rows[at];
    if (row.w !== row.inner || row.h !== row.inner) note({case: `(2) touch: ${row.id} hit is a square of the inner height`, got: row});
    if (!(was.w < was.h)) note({case: `(2) fine pointer: ${was.id} keeps the C123 width`, got: was});
    if (row.glyph !== was.glyph || row.toEnd !== was.toEnd) note({case: `(2) ${row.id} glyph size and end unchanged`, got: {fine: was, coarse: row}});
  }

  // (3) Caps Lock.
  for (const [lang, words] of [['ru', 'Включён Caps Lock'], ['en', 'Caps Lock is on']]) {
    const context = await browser.newContext({viewport: {width: 900, height: 700}});
    const {tab, errors} = await open(context, lang);
    const read = () => tab.evaluate(() => {
      const h = document.getElementById('pw');
      const line = h.querySelector('.sf-input-caps');
      const hint = h.querySelector('.sf-input-hint-text-wrap:not(.sf-input-caps)');
      const live = h.querySelector('.sf-input-caps-said');
      const look = (el) => el && (({fontSize, lineHeight, color}) => ({fontSize, lineHeight, color}))(getComputedStyle(el));
      return {line: line?.textContent.trim() ?? null, lineLook: look(line), hintLook: look(hint), hidden: line?.getAttribute('aria-hidden'),
        live: live && {text: live.textContent, polite: live.getAttribute('aria-live'), width: live.getBoundingClientRect().width},
        below: line && hint ? line.getBoundingClientRect().top >= hint.getBoundingClientRect().bottom : null};
    });
    await tab.locator('#pw input').focus();
    await tab.keyboard.press('a');
    const off = await read();
    if (off.line !== null || !off.live || off.live.text !== '' || off.live.polite !== 'polite') note({case: `(3 ${lang}) nothing while Caps Lock is off; the polite region waits empty`, got: off});
    await tab.keyboard.press('CapsLock');
    await tab.keyboard.press('b');
    await tab.waitForTimeout(100);
    const on = await read();
    if (on.line !== words || on.live?.text !== words || on.hidden !== 'true') note({case: `(3 ${lang}) the line and the polite region say ${words}`, got: on});
    if (JSON.stringify(on.lineLook) !== JSON.stringify(on.hintLook) || on.below !== true) note({case: `(3 ${lang}) the line has the hint's type and ink, under it`, got: on});
    if (!(on.live?.width <= 1)) note({case: `(3 ${lang}) the polite region is not shown`, got: on.live});
    await tab.keyboard.press('Tab');
    await tab.waitForTimeout(100);
    const blurred = await read();
    if (blurred.line !== null || blurred.live?.text !== '') note({case: `(3 ${lang}) leaving the field takes it away`, got: blurred});
    await tab.keyboard.press('Shift+Tab');
    await tab.waitForTimeout(100);
    const back = await read();
    if (back.line !== words) note({case: `(3 ${lang}) a key back into the field with Caps Lock on shows it again`, got: back});
    await tab.keyboard.press('CapsLock');
    await tab.waitForTimeout(100);
    const capsOff = await read();
    if (capsOff.line !== null || capsOff.live?.text !== '') note({case: `(3 ${lang}) turning Caps Lock off takes it away`, got: capsOff});
    // The browser's own event: KeyboardEvent with modifierCapsLock, read by its own getModifierState.
    const own = await tab.evaluate(async () => {
      const input = document.querySelector('#pw input');
      input.dispatchEvent(new KeyboardEvent('keyup', {key: 'A', bubbles: true, modifierCapsLock: true}));
      await new Promise((done) => setTimeout(done, 100));
      const shown = document.querySelector('#pw .sf-input-caps')?.textContent.trim() ?? null;
      input.dispatchEvent(new KeyboardEvent('keyup', {key: 'a', bubbles: true, modifierCapsLock: false}));
      await new Promise((done) => setTimeout(done, 100));
      return {shown, gone: document.querySelector('#pw .sf-input-caps') === null};
    });
    if (own.shown !== words || !own.gone) note({case: `(3 ${lang}) the browser's modifierCapsLock event is read`, got: own});
    if (errors.length) note({case: `no page errors (3 ${lang})`, got: errors});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('INPUT_PASSWORD_C191_OK');
