#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// A link drawn as a button takes the button's ink (DEV msg-0bea9d3c, group
// build 16 G11): a.sf-button.sf-button--default.sf-button--primary with bare
// text drew black on blue while a <button> with the same classes drew white
// -- a.sf-button { color: ButtonText } outranked the appearance's on-colour
// for a bare label. For every look (default, tonal, outline, ghost, link,
// surface) and tone (primary, secondary, on-surface, error, danger), with a
// bare label and with the text container, after a link-* sibling (the core's
// running-text link rule reaches a link after one), at rest, under the
// pointer, with the keyboard's focus and visited: the <a>'s text ink is the
// <button>'s. A filled look's label keeps 4.5:1 on its fill. 1440 and 390,
// light and dark, three loads.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const LOOKS = ['default', 'tonal', 'outline', 'ghost', 'link', 'surface'];
const TONES = ['primary', 'secondary', 'on-surface', 'error', 'danger'];
const cells = [];
for (const look of LOOKS) for (const tone of TONES) for (const label of ['bare', 'container']) cells.push({look, tone, label, key: `${look}-${tone}-${label}`});
const text = (label) => (label === 'bare' ? 'Кнопка' : '<span class="sf-button-text-container">Кнопка</span>');
const BODY = `<main style="display:flex;flex-wrap:wrap;gap:8px">${cells.map(({look, tone, label, key}) => `<div style="display:flex;gap:8px;align-items:center">
  <span class="link-dotted">·</span>
  <button type="button" id="b-${key}" class="sf-button sf-button--size-1 sf-button--${look} sf-button--${tone}">${text(label)}</button>
  <a href="#v-${key}" id="a-${key}" class="sf-button sf-button--size-1 sf-button--${look} sf-button--${tone}">${text(label)}</a></div>`).join('')}</main>`;

const READ = (key) => {
  const ink = (node) => getComputedStyle(node.querySelector('.sf-button-text-container') ?? node).color;
  const button = document.getElementById(`b-${key}`);
  const link = document.getElementById(`a-${key}`);
  return {button: ink(button), link: ink(link), fill: getComputedStyle(link).backgroundColor, underline: getComputedStyle(link).textDecorationLine};
};
const channel = (value) => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/gu).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction(() => getComputedStyle(document.querySelector('.sf-button')).backgroundColor !== 'rgba(0, 0, 0, 0)', null, {timeout: 20_000});
    await tab.waitForTimeout(300);
    const mismatches = [];
    const lowContrast = [];
    for (const {key, look} of cells) {
      // Rest, then visited (the link followed: its #hash is in the history).
      const rest = await tab.evaluate(READ, key);
      if (rest.link !== rest.button || rest.underline !== 'none') mismatches.push({key, state: 'rest', ...rest});
      if (look === 'default' && /^rgb\(/u.test(rest.fill) && contrast(rest.link, rest.fill) < 4.5) lowContrast.push({key, ...rest, ratio: contrast(rest.link, rest.fill).toFixed(2)});
      // Under the pointer: the same pointer over each, read in turn.
      await tab.hover(`#b-${key}`);
      const hoverButton = (await tab.evaluate(READ, key)).button;
      await tab.hover(`#a-${key}`);
      const hoverLink = await tab.evaluate(READ, key);
      if (hoverLink.link !== hoverButton) mismatches.push({key, state: 'hover', button: hoverButton, link: hoverLink.link});
      await tab.mouse.move(1, 1);
      // The keyboard's focus.
      await tab.focus(`#b-${key}`);
      await tab.keyboard.press('Shift+Tab');
      await tab.keyboard.press('Tab');
      const focusButton = (await tab.evaluate(READ, key)).button;
      await tab.keyboard.press('Tab');
      const focusLink = await tab.evaluate(READ, key);
      const linkFocused = await tab.evaluate((id) => document.activeElement?.id === id, `a-${key}`);
      if (!linkFocused || focusLink.link !== focusButton) mismatches.push({key, state: 'focus', linkFocused, button: focusButton, link: focusLink.link});
    }
    // Visited: follow every link once (same document), then read again.
    await tab.evaluate((keys) => { for (const key of keys) history.pushState(null, '', `#v-${key}`); history.pushState(null, '', '#'); }, cells.map((cell) => cell.key));
    await tab.waitForTimeout(200);
    for (const {key} of cells) {
      const visited = await tab.evaluate(READ, key);
      if (visited.link !== visited.button) mismatches.push({key, state: 'visited', ...visited});
    }
    evidence[at] = {mismatches: mismatches.length, lowContrast: lowContrast.length};
    ok(`${at}: every <a class="sf-button"> draws its label in the <button>'s ink (rest, hover, focus, visited; ${cells.length} pairs)`, mismatches.length === 0, mismatches.slice(0, 6));
    ok(`${at}: a filled link button's label keeps 4.5:1 on its fill`, lowContrast.length === 0, lowContrast.slice(0, 6));
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
