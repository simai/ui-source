#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// <sf-button-group appearance="segmented" theme-switch>, the ready theme
// switch, on a page that loads through the Loader with the theme enabled:
//   - it draws three icon-only radios named in the page language (ru: «Как в
//     системе», «Светлая», «Тёмная»; en: System, Light, Dark) in a radiogroup
//     named «Тема» / Theme, and items is ignored;
//   - it selects the Loader's theme PREFERENCE: system stays selected while
//     the system is dark and the page is drawn dark;
//   - a click on dark sets SF.Loader's preference and the theme-dark class on
//     <html>, and change arrives when the page is already dark;
//   - SF.Loader.setTheme called elsewhere moves the selection (sf-theme-change),
//     and two switches on one page agree;
//   - the keyboard is the group's own: arrows and Home choose and focus, one
//     tab stop;
//   - with the theme disabled (SF_BOOT_CONFIG.theme false) a click changes
//     nothing.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error(`no core.js under ${out}`);

const boot = ({lang = 'ru', theme = true, body}) => `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><title>theme switch</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'theme-switch-probe', pluginListVersion: 'theme-switch-probe',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}${theme ? '' : ', theme: false'},
  };
  window.__changes = [];
  document.addEventListener('change', (event) => {
    if (event.target.localName !== 'sf-button-group') return;
    window.__changes.push({id: event.target.id, value: event.detail.value, dark: document.documentElement.classList.contains('theme-dark')});
  });
</script></head><body>${body}
<script src="/distr/core/js/core.js"></script></body></html>`;

const SWITCH = `<button id="before" type="button">до</button>
<sf-button-group id="one" appearance="segmented" theme-switch items='[{"value":"x","label":"Лишний"}]'></sf-button-group>
<sf-button-group id="two" appearance="segmented" plate="raised" radius="rounded" theme-switch aria-label="Оформление"></sf-button-group>`;
const pages = {
  '/ru.html': boot({body: SWITCH}),
  '/en.html': boot({lang: 'en', body: '<sf-button-group id="one" appearance="segmented" theme-switch></sf-button-group>'}),
  '/off.html': boot({theme: false, body: '<sf-button-group id="one" appearance="segmented" theme-switch></sf-button-group>'}),
};

const types = new Map([['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.css', 'text/css'], ['.json', 'application/json'], ['.svg', 'image/svg+xml'], ['.woff2', 'font/woff2']]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
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
    response.writeHead(200, {'Content-Type': types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream', 'Content-Length': bytes.length});
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();

async function open(path, {colorScheme = 'light'} = {}) {
  const context = await browser.newContext({colorScheme});
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push({name: `page error on ${path}`, said: error.message}));
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(() => {
    const groups = [...document.querySelectorAll('sf-button-group')];
    return groups.length && groups.every((group) => group.querySelectorAll('button[role="radio"]').length === 3);
  }, null, {timeout: 15000});
  await page.waitForTimeout(200);
  return page;
}

const state = (page) => page.evaluate(() => ({
  html: ['theme-dark', 'theme-light'].filter((name) => document.documentElement.classList.contains(name)),
  preference: window.SF?.Loader?.themePreference ?? null,
  groups: Object.fromEntries([...document.querySelectorAll('sf-button-group')].map((group) => [group.id, {
    value: group.value,
    checked: [...group.querySelectorAll('button[role="radio"]')].filter((button) => button.getAttribute('aria-checked') === 'true').map((button) => button.dataset.sfButtonGroupValue),
    stops: [...group.querySelectorAll('button[role="radio"]')].filter((button) => button.tabIndex === 0).map((button) => button.dataset.sfButtonGroupValue),
  }])),
  focused: document.activeElement?.dataset?.sfButtonGroupValue ?? null,
}));
const settle = (page) => page.waitForTimeout(200);

try {
  // 1. Names and items, Russian page, system light.
  {
    const page = await open('/ru.html');
    const names = await page.evaluate(() => [...document.querySelectorAll('sf-button-group')].map((group) => ({
      id: group.id,
      group: group.querySelector('[role="radiogroup"]')?.getAttribute('aria-label'),
      items: [...group.querySelectorAll('button[role="radio"]')].map((button) => ({
        value: button.dataset.sfButtonGroupValue,
        name: button.getAttribute('aria-label') || button.querySelector('.sf-button-group-label--hidden')?.textContent.trim(),
        icon: button.querySelector('sf-icon')?.getAttribute('icon'),
        iconOnly: Boolean(button.querySelector('.sf-button-group-label--hidden')),
      })),
    })));
    evidence.names = names;
    const one = names.find((entry) => entry.id === 'one');
    const two = names.find((entry) => entry.id === 'two');
    check('ru: the group is named Тема', one.group === 'Тема', one);
    check('ru: an aria-label on the group wins', two.group === 'Оформление', two);
    check('ru: three items, items ignored, icon-only, named in Russian', JSON.stringify(one.items) === JSON.stringify([
      {value: 'system', name: 'Как в системе', icon: 'brightness_auto', iconOnly: true},
      {value: 'light', name: 'Светлая', icon: 'light_mode', iconOnly: true},
      {value: 'dark', name: 'Тёмная', icon: 'dark_mode', iconOnly: true},
    ]), one);
    for (const name of ['Как в системе', 'Светлая', 'Тёмная']) {
      check(`ru: the radio «${name}» is found by its name`, (await page.locator('#one').getByRole('radio', {name, exact: true}).count()) === 1);
    }
    const start = await state(page);
    evidence.start = start;
    check('no stored choice: system is selected, the page is light', start.preference === 'system' && start.html.join() === 'theme-light'
      && start.groups.one.value === 'system' && start.groups.one.checked.join() === 'system' && start.groups.two.value === 'system', start);

    // 2. A click on dark: the Loader's preference, the class on <html>, change after it.
    await page.locator('#one').getByRole('radio', {name: 'Тёмная', exact: true}).click();
    await settle(page);
    const dark = await state(page);
    const changes = await page.evaluate(() => window.__changes);
    evidence.dark = {dark, changes};
    check('dark: the preference is dark and <html> is theme-dark', dark.preference === 'dark' && dark.html.join() === 'theme-dark', dark);
    check('dark: both switches select dark', dark.groups.one.value === 'dark' && dark.groups.two.value === 'dark' && dark.groups.two.checked.join() === 'dark', dark);
    check('dark: one change, on the clicked switch, when the page is already dark', JSON.stringify(changes) === JSON.stringify([{id: 'one', value: 'dark', dark: true}]), {changes});
    const cookie = (await page.context().cookies()).find((entry) => entry.name === 'sf-theme');
    check('dark: the Loader keeps the choice', cookie?.value === 'dark', {cookie});

    // 3. setTheme elsewhere moves the selection, without a change from the switch.
    await page.evaluate(() => window.SF.Loader.setTheme('light'));
    await settle(page);
    const external = await state(page);
    const quiet = await page.evaluate(() => window.__changes.length);
    evidence.external = external;
    check('an external setTheme moves both switches', external.groups.one.value === 'light' && external.groups.two.value === 'light' && external.html.join() === 'theme-light', external);
    check('an external change is not reported as the switch\'s change', quiet === 1, {quiet});

    // 4. Keyboard: one tab stop on the selected item; arrows and Home choose and focus.
    await page.focus('#before');
    await page.keyboard.press('Tab');
    const tabbed = await state(page);
    await page.keyboard.press('ArrowRight');
    await settle(page);
    const right = await state(page);
    await page.keyboard.press('Home');
    await settle(page);
    const home = await state(page);
    evidence.keyboard = {tabbed, right, home};
    check('Tab lands on the selected item, one tab stop', tabbed.focused === 'light' && tabbed.groups.one.stops.join() === 'light', tabbed);
    check('ArrowRight chooses dark and keeps focus on it', right.focused === 'dark' && right.preference === 'dark' && right.html.join() === 'theme-dark', right);
    check('Home chooses system', home.focused === 'system' && home.preference === 'system' && home.groups.two.value === 'system', home);
    check('clear() does not empty a theme switch', await page.evaluate(() => document.getElementById('one').clear().value) === 'system');
    await page.context().close();
  }

  // 5. The system is dark: system stays selected while the page is dark.
  {
    const page = await open('/ru.html', {colorScheme: 'dark'});
    const systemDark = await state(page);
    evidence.systemDark = systemDark;
    check('system dark: system is selected, the page is drawn dark', systemDark.preference === 'system' && systemDark.html.join() === 'theme-dark'
      && systemDark.groups.one.value === 'system' && systemDark.groups.one.checked.join() === 'system', systemDark);
    await page.locator('#one').getByRole('radio', {name: 'Светлая', exact: true}).click();
    await settle(page);
    await page.locator('#one').getByRole('radio', {name: 'Как в системе', exact: true}).click();
    await settle(page);
    const back = await state(page);
    check('system dark: light, then system again, draws dark with system selected', back.preference === 'system' && back.html.join() === 'theme-dark' && back.groups.two.value === 'system', back);
    await page.context().close();
  }

  // 6. English page.
  {
    const page = await open('/en.html');
    const names = await page.evaluate(() => {
      const group = document.getElementById('one');
      return {group: group.querySelector('[role="radiogroup"]').getAttribute('aria-label'), items: [...group.querySelectorAll('.sf-button-group-label--hidden')].map((node) => node.textContent)};
    });
    evidence.english = names;
    check('en: Theme; System, Light, Dark', names.group === 'Theme' && names.items.join() === 'System,Light,Dark', names);
    await page.context().close();
  }

  // 7. Theme disabled: nothing changes.
  {
    const page = await open('/off.html');
    const before = await state(page);
    await page.locator('#one').getByRole('radio', {name: 'Тёмная', exact: true}).click();
    await settle(page);
    const after = await state(page);
    const changes = await page.evaluate(() => window.__changes.length);
    evidence.disabled = {before, after, changes};
    check('theme disabled: a click selects nothing and changes no theme', after.groups.one.value === before.groups.one.value && after.html.join() === before.html.join() && changes === 0, {before, after, changes});
    await page.context().close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('BUTTON_GROUP_THEME_SWITCH_OK');
