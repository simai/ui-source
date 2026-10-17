#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-theme-generator (2026-10-18), measured on the built bytes. Unset, it draws
// the Framework's own theme (primary 40 is #005bbe) and touches nothing on the
// page. A colour chosen through its sf-color changes the preview and is
// committed as sf-theme-apply with the 128 variables and a CSS rule. With
// `apply` and a target, the target's --sf-primary-40 is the new tone and the
// semantic --sf-primary follows; removing the element takes every inline
// variable off again. A hue typed in the fine-tuning field and committed with
// Enter re-makes the theme from the generator's own inputs. Reset gives back
// #005bbe. The expected tones come from core's theme-palette, the calculation
// the component imports.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {colorToHct, themeFromColor, themeFromHct} from '../../src/core/js/theme-palette.js';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'smart/smart/inputs/css/inputs.css',
  'smart/smart/color/css/color.css', 'smart/smart/theme-generator/css/theme-generator.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/buttons/js/buttons.js', 'smart/smart/inputs/js/inputs.js',
  'smart/smart/color/js/color.js', 'smart/smart/theme-generator/js/theme-generator.js'];
const absent = modules.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build module(s) not found under ${out}: ${absent.join(', ')}`);

const GREEN = '#2e7d32';
const greenTone = themeFromColor(GREEN).palettes.primary.tones[40];
const rgb = (hex) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  // The scope carries the theme class: the semantic tokens are declared on it,
  // so they are computed from the scope's own primitives.
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:24px">
    <sf-theme-generator id="plain"></sf-theme-generator>
    <div id="scope" class="theme-light"><span id="ink" style="color: var(--sf-primary)">Текст</span></div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-theme-generator')
    && document.querySelector('#plain [data-palette="primary"] [data-tone="40"]')
    && document.querySelector('#plain sf-color .sf-color-input'), null, {timeout: 8000});
  await page.evaluate(() => {
    window.__seen = [];
    const keep = (event) => window.__seen.push({type: event.type, id: event.target.id, value: event.detail.value, hue: event.detail.hue,
      chroma: event.detail.chroma, variables: Object.keys(event.detail.variables ?? {}).length, primary40: event.detail.variables?.['--sf-primary-40'],
      css: typeof event.detail.css === 'string' ? event.detail.css.slice(0, 7) : null, schema: event.detail.theme?.schema});
    for (const type of ['sf-theme-change', 'sf-theme-apply']) document.addEventListener(type, keep);
  });
  const settle = () => page.waitForTimeout(250);
  const taken = () => page.evaluate(() => window.__seen.splice(0));
  const preview = (id) => page.evaluate((key) => document.querySelector(`#${key} [data-palette="primary"] [data-tone="40"]`)?.dataset.hex, id);
  const inline = (selector) => page.evaluate((key) => [...document.querySelector(key).style].filter((name) => name.startsWith('--sf-')).length, selector);
  await settle();

  // 1. Unset: the Framework's own theme, nothing applied.
  const unset = {primary40: await preview('plain'), rows: await page.evaluate(() => document.querySelectorAll('#plain .sf-theme-generator-row').length),
    title: await page.evaluate(() => document.querySelector('#plain [data-palette="primary"] [data-tone="40"]')?.getAttribute('title')),
    region: await page.evaluate(() => document.querySelector('#plain .sf-theme-generator-preview')?.getAttribute('aria-label')),
    inlineOnRoot: await inline('html'), events: await taken()};
  if (unset.primary40 !== '#005bbe' || unset.rows !== 8 || !unset.title?.includes('40') || !unset.title?.includes('#005bbe') || !unset.region || unset.inlineOnRoot !== 0 || unset.events.length) {
    note({case: 'unset: primary 40 is #005bbe, eight named rows, nothing applied, no events', got: unset});
  }

  // 2. A colour chosen through the sf-color: preview moves, one commit.
  await page.evaluate((color) => document.querySelector('#plain sf-color').setValue(color), GREEN);
  await settle();
  const chosen = {primary40: await preview('plain'), events: await taken(), inlineOnRoot: await inline('html'),
    css: await page.evaluate(() => document.getElementById('plain').toCSS('.x').slice(0, 4))};
  const apply = chosen.events.filter((event) => event.type === 'sf-theme-apply');
  if (chosen.primary40 !== greenTone || chosen.primary40 === '#005bbe') note({case: 'a chosen colour changes the preview', got: chosen.primary40, expected: greenTone});
  if (apply.length !== 1 || apply[0].value !== GREEN || apply[0].variables !== 128 || apply[0].css !== ':root {' || apply[0].primary40 !== greenTone
    || apply[0].schema !== 'simai.framework.theme' || !chosen.events.some((event) => event.type === 'sf-theme-change')) {
    note({case: 'the choice fires sf-theme-change and one sf-theme-apply with 128 variables and css', got: chosen.events});
  }
  if (chosen.inlineOnRoot !== 0) note({case: 'without apply the page is not changed', got: chosen.inlineOnRoot});
  if (chosen.css !== '.x {') note({case: 'toCSS takes a selector', got: chosen.css});

  // 3. apply + target: the target's primitives and the semantic token follow;
  // removal takes them off.
  const before = await page.evaluate(() => ({tone: getComputedStyle(document.getElementById('scope')).getPropertyValue('--sf-primary-40').trim(),
    ink: getComputedStyle(document.getElementById('ink')).color}));
  await page.evaluate((color) => {
    const element = document.createElement('sf-theme-generator');
    element.id = 'applied';
    element.setAttribute('apply', '');
    element.setAttribute('target', '#scope');
    element.setAttribute('value', color);
    document.body.append(element);
  }, GREEN);
  await settle();
  const applied = await page.evaluate(() => ({tone: getComputedStyle(document.getElementById('scope')).getPropertyValue('--sf-primary-40').trim().toLowerCase(),
    ink: getComputedStyle(document.getElementById('ink')).color,
    rootInline: [...document.documentElement.style].filter((name) => name.startsWith('--sf-')).length,
    scopeInline: [...document.getElementById('scope').style].filter((name) => name.startsWith('--sf-')).length}));
  await page.evaluate(() => document.getElementById('applied').remove());
  await settle();
  const removed = await page.evaluate(() => ({tone: getComputedStyle(document.getElementById('scope')).getPropertyValue('--sf-primary-40').trim().toLowerCase(),
    ink: getComputedStyle(document.getElementById('ink')).color,
    scopeInline: [...document.getElementById('scope').style].filter((name) => name.startsWith('--sf-')).length}));
  await taken();
  if (applied.tone !== greenTone || applied.ink !== rgb(greenTone) || applied.scopeInline !== 128 || applied.rootInline !== 0) {
    note({case: 'apply: the target takes --sf-primary-40 and --sf-primary follows', got: applied, expected: {tone: greenTone, ink: rgb(greenTone)}, before});
  }
  if (removed.scopeInline !== 0 || removed.tone !== before.tone.toLowerCase() || removed.ink !== before.ink) {
    note({case: 'removal takes every inline variable off', got: removed, before});
  }

  // 4. The fine-tuning field: hue 145, committed with Enter.
  await page.click('#plain .sf-theme-generator-summary');
  await settle();
  const chroma = Number(await page.locator('#plain [data-field="chroma"] input').inputValue());
  const hueTone = themeFromHct({hue: 145, chroma}).palettes.primary.tones[40];
  await page.locator('#plain [data-field="hue"] input').fill('145');
  await page.locator('#plain [data-field="hue"] input').press('Enter');
  await settle();
  const tuned = {primary40: await preview('plain'), events: await taken(), chroma, expectedChroma: colorToHct(GREEN).chroma};
  const tunedApply = tuned.events.filter((event) => event.type === 'sf-theme-apply');
  if (tuned.primary40 !== hueTone || chroma !== tuned.expectedChroma) note({case: 'hue 145 re-makes the theme from the generator inputs', got: tuned, expected: hueTone});
  if (tunedApply.length !== 1 || tunedApply[0].hue !== 145 || tunedApply[0].primary40 !== hueTone) note({case: 'Enter in the field commits once', got: tuned.events});

  // 5. Reset.
  await page.click('#plain .sf-theme-generator-reset button');
  await settle();
  const reset = {primary40: await preview('plain'), events: await taken(),
    hue: await page.locator('#plain [data-field="hue"] input').inputValue()};
  const resetApply = reset.events.filter((event) => event.type === 'sf-theme-apply');
  if (reset.primary40 !== '#005bbe' || resetApply.length !== 1 || resetApply[0].value !== '' || resetApply[0].primary40 !== '#005bbe' || reset.hue !== '265') {
    note({case: 'Reset gives back #005bbe', got: reset});
  }
  console.log(JSON.stringify({unset, chosen, applied, removed, tuned, reset}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('THEME_GENERATOR_OK');
