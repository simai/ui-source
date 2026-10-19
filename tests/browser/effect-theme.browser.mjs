#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.1, theme-follows-the-placement and area-takes-the-drawn-theme,
// on the built core: SF.Effects.allowedModes offers an editor only the fixed
// modes the effect or its trusted pair draws; resolveTheme takes every branch
// of the order (the effect, its pair, a dark-only effect kept dark, nothing;
// a foreign pair drawn in the sandbox, or refused with foreign effects
// refused); mountEffect with a themeMode draws what it
// resolved, gives the area the drawn theme's class, and in auto follows a
// switch of the page's theme -- the same effect without a remount, the pair
// in its place, or nothing. Text over an area or a window card takes the
// drawn theme's ink rather than the page's (simai/ui-source#7), a colour the
// author set on the area still wins, and destroy gives both back.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {EFFECTS, FOREIGN_PAIR, moduleUrl, openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};

const browser = await chromium.launch();
try {
  const {page, errors} = await openPage(browser, out, {
    theme: 'theme-light',
    body: '<div id="area" style="position:relative;inline-size:320px;block-size:200px"></div>',
  });

  // The policy alone, without drawing.
  const policy = await page.evaluate(({EFFECTS, FOREIGN_PAIR}) => {
    const {allowedModes, resolveTheme, pageScheme} = window.SF.Effects;
    const dual = EFFECTS['sample-bands'];
    const night = EFFECTS['night-bands'];
    const day = EFFECTS['day-bands'];
    const dusk = EFFECTS['dusk-bands'];
    const lone = EFFECTS['lone-light'];
    const darkAlone = {...night, pair: undefined};
    delete darkAlone.pair;
    const r = (manifest, page, themeMode, pair) => resolveTheme(manifest, {pageScheme: page, themeMode, pair});
    return {
      page: pageScheme(),
      modes: {
        dual: allowedModes(dual),
        darkAlone: allowedModes(darkAlone),
        lone: allowedModes(lone),
        pairedById: allowedModes(night),
        pairedByIdKnown: allowedModes(night, {pair: day}),
        pairedForeign: allowedModes(dusk),
        pairedForeignRefused: allowedModes(dusk, {foreign: 'refuse'}),
      },
      dual: [r(dual, 'light', 'auto'), r(dual, 'dark', 'auto'), r(dual, 'light', 'dark')],
      pairedLightPage: r(night, 'light', 'auto'),
      pairedLightPageKnown: r(night, 'light', 'auto', day),
      pairedDarkPage: r(night, 'dark', 'auto', day),
      pairedFixedLight: r(night, 'dark', 'light', day),
      pairCannotDraw: r(night, 'light', 'auto', {...day, schemes: ['dark']}),
      darkKeptDark: r(darkAlone, 'light', 'auto'),
      darkFixedLight: r(darkAlone, 'dark', 'light'),
      lightOnDark: r(lone, 'dark', 'auto'),
      lightOnLight: r(lone, 'light', 'auto'),
      lightFixedDark: r(lone, 'light', 'dark'),
      foreignPair: r(dusk, 'light', 'auto'),
      foreignPairRefused: resolveTheme(dusk, {pageScheme: 'light', themeMode: 'auto', foreign: 'refuse'}),
      foreignPairOwnScheme: r(dusk, 'dark', 'auto'),
      unknownMode: r(dual, 'light', 'sepia'),
      foreignIsUrl: FOREIGN_PAIR === dusk.pair,
    };
  }, {EFFECTS, FOREIGN_PAIR});
  expect('the page scheme is read from <html>', policy.page, 'light');
  expect('allowedModes: a two-scheme effect offers every mode', policy.modes.dual, ['auto', 'dark', 'light']);
  expect('allowedModes: a dark-only effect without a pair offers no light mode', policy.modes.darkAlone, ['auto', 'dark']);
  expect('allowedModes: a light-only effect offers no dark mode', policy.modes.lone, ['auto', 'light']);
  expect('allowedModes: a catalogue pair adds the other scheme', policy.modes.pairedById, ['auto', 'dark', 'light']);
  expect('allowedModes: with the pair known, its schemes', policy.modes.pairedByIdKnown, ['auto', 'dark', 'light']);
  expect('allowedModes: a foreign pair, run in the sandbox, adds its scheme', policy.modes.pairedForeign, ['auto', 'dark', 'light']);
  expect('allowedModes: a foreign pair adds nothing when foreign effects are refused', policy.modes.pairedForeignRefused, ['auto', 'dark']);
  expect('a two-scheme effect draws the page scheme, or the fixed one', policy.dual, [{effect: 'self', scheme: 'light'}, {effect: 'self', scheme: 'dark'}, {effect: 'self', scheme: 'dark'}]);
  expect('a dark effect on a light page: its pair', policy.pairedLightPage, {effect: 'pair', scheme: 'light', pair: 'day-bands'});
  expect('a dark effect on a light page, pair known: its pair', policy.pairedLightPageKnown, {effect: 'pair', scheme: 'light', pair: 'day-bands'});
  expect('a dark effect on a dark page: itself', policy.pairedDarkPage, {effect: 'self', scheme: 'dark'});
  expect('fixed light on a dark effect with a pair: the pair', policy.pairedFixedLight, {effect: 'pair', scheme: 'light', pair: 'day-bands'});
  expect('a pair that cannot draw the target: the dark effect kept dark', policy.pairCannotDraw, {effect: 'self', scheme: 'dark'});
  expect('a dark-only effect without a pair stays dark on a light page', policy.darkKeptDark, {effect: 'self', scheme: 'dark'});
  expect('a fixed mode the effect cannot draw: hidden', policy.darkFixedLight, {hidden: true, reason: 'mode-not-drawable'});
  expect('a light-only effect on a dark page: hidden', policy.lightOnDark, {hidden: true, reason: 'light-only-on-dark'});
  expect('a light-only effect on a light page: itself', policy.lightOnLight, {effect: 'self', scheme: 'light'});
  expect('fixed dark on a light-only effect: hidden', policy.lightFixedDark, {hidden: true, reason: 'mode-not-drawable'});
  expect('a foreign pair is drawn in the sandbox', policy.foreignPair, {effect: 'pair', scheme: 'light', pair: FOREIGN_PAIR, sandboxed: true});
  expect('a foreign pair is refused when foreign effects are', policy.foreignPairRefused, {hidden: true, reason: 'foreign-pair-needs-sandbox'});
  expect('a foreign pair is not needed in the effect\'s own scheme', policy.foreignPairOwnScheme, {effect: 'self', scheme: 'dark'});
  expect('an unknown mode: hidden', policy.unknownMode, {hidden: true, reason: 'unknown-theme-mode'});
  expect('the fixture pair is an address', policy.foreignIsUrl, true);

  // Mounted: the area takes the drawn theme, and auto follows the page.
  const luminance = `(() => {
    const canvas = document.querySelector('#area canvas');
    if (!canvas) return null;
    const [r, g, b] = canvas.getContext('2d').getImageData(4, 4, 1, 1).data;
    const c = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return Number((0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)).toFixed(3));
  })()`;
  const state = () => page.evaluate((luminance) => {
    const area = document.getElementById('area');
    const handle = window.__handle;
    return {
      classes: [...area.classList].filter((name) => name.startsWith('theme-')),
      drawn: area.getAttribute('data-sf-effect'),
      nodes: area.querySelectorAll('canvas').length,
      state: area.getAttribute('data-sf-effect-state'),
      reason: area.getAttribute('data-sf-effect-reason'),
      effect: handle.effect,
      scheme: handle.scheme,
      dark: (() => { const value = eval(luminance); return value === null ? null : value < 0.18; })(),
    };
  }, luminance);
  const setPage = (scheme) => page.evaluate(async (scheme) => {
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${scheme}`);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, scheme);
  const mount = (id, options) => page.evaluate(async ({id, options, EFFECTS, urls}) => {
    window.__handle?.destroy();
    const module = await import(urls[id]);
    const pairId = EFFECTS[id].pair;
    const pair = typeof pairId === 'string' && urls[pairId] ? {manifest: EFFECTS[pairId], module: await import(urls[pairId])} : undefined;
    window.__handle = window.SF.Effects.mountEffect(document.getElementById('area'), {manifest: EFFECTS[id], module, pair, ...options});
    window.__first = document.querySelector('#area canvas');
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, {id, options, EFFECTS, urls: Object.fromEntries(Object.keys(EFFECTS).map((key) => [key, moduleUrl(key)]))});

  // A dark effect with a catalogue pair, auto: the pair on a light page, itself on a dark one.
  await setPage('light');
  await mount('night-bands', {themeMode: 'auto'});
  expect('auto, light page: the pair is drawn in light, the area is light',
    await state(), {classes: ['theme-light'], drawn: 'day-bands', nodes: 1, state: 'running', reason: null, effect: 'pair', scheme: 'light', dark: false});
  await setPage('dark');
  expect('auto follows the page to dark: the effect itself, the area dark',
    await state(), {classes: ['theme-dark'], drawn: 'night-bands', nodes: 1, state: 'running', reason: null, effect: 'self', scheme: 'dark', dark: true});

  // A two-scheme effect follows the page without a remount.
  await setPage('light');
  await mount('sample-bands', {themeMode: 'auto'});
  expect('auto, two schemes, light page', await state(), {classes: ['theme-light'], drawn: 'sample-bands', nodes: 1, state: 'running', reason: null, effect: 'self', scheme: 'light', dark: false});
  await setPage('dark');
  const kept = await page.evaluate(() => document.querySelector('#area canvas') === window.__first);
  expect('auto, two schemes, switched to dark', await state(), {classes: ['theme-dark'], drawn: 'sample-bands', nodes: 1, state: 'running', reason: null, effect: 'self', scheme: 'dark', dark: true});
  expect('the switch reached the effect through update, not a remount', kept, true);
  // The Loader's own event is followed too.
  await page.evaluate(() => {
    document.documentElement.classList.replace('theme-dark', 'theme-light');
    window.dispatchEvent(new CustomEvent('sf-theme-change', {detail: {theme: 'light', preference: 'light'}}));
  });
  await page.waitForTimeout(50);
  expect('sf-theme-change back to light', (await state()).classes, ['theme-light']);

  // A fixed mode holds whatever the page does.
  await mount('sample-bands', {themeMode: 'dark'});
  expect('fixed dark on a light page: the area is dark', await state(), {classes: ['theme-dark'], drawn: 'sample-bands', nodes: 1, state: 'running', reason: null, effect: 'self', scheme: 'dark', dark: true});
  await setPage('dark');
  await setPage('light');
  expect('fixed dark is not moved by the page', (await state()).classes, ['theme-dark']);

  // A light-only effect on a dark page: nothing drawn, the area in the page's dark.
  await setPage('dark');
  await mount('lone-light', {themeMode: 'auto'});
  expect('auto, light-only effect, dark page: hidden', await state(), {classes: ['theme-dark'], drawn: null, nodes: 0, state: 'hidden', reason: 'light-only-on-dark', effect: null, scheme: null, dark: null});
  await setPage('light');
  expect('and drawn once the page turns light', await state(), {classes: ['theme-light'], drawn: 'lone-light', nodes: 1, state: 'running', reason: null, effect: 'self', scheme: 'light', dark: false});

  // update({themeMode}) changes the mode in place; destroy gives the area back.
  await page.evaluate(() => window.__handle.update({}, {themeMode: 'dark'}));
  expect('update to a mode the effect cannot draw: hidden', (await state()).reason, 'mode-not-drawable');
  const after = await page.evaluate(() => {
    window.__handle.destroy();
    const area = document.getElementById('area');
    return {classes: [...area.classList], nodes: area.childNodes.length, state: area.getAttribute('data-sf-effect-state')};
  });
  expect('destroy leaves the area as it was', after, {classes: [], nodes: 0, state: null});

  // A 1.0 call (no themeMode) is untouched: no class on the host.
  await mount('sample-bands', {scheme: 'dark'});
  expect('without a themeMode nothing changes the host\'s theme', (await state()).classes, []);
  await page.evaluate(() => window.__handle.destroy());

  // The ink: a dark-only effect on a light page, an area and a window card.
  await setPage('light');
  const ink = await page.evaluate(async ({EFFECTS, urls}) => {
    window.__handle?.destroy();
    document.body.insertAdjacentHTML('beforeend', `
      <span id="ink-dark" class="theme-dark" style="color:var(--sf-on-surface)"></span>
      <span id="ink-light" class="theme-light" style="color:var(--sf-on-surface)"></span>
      <section id="zone" style="position:relative;inline-size:320px;block-size:120px"><div id="fx" style="position:absolute;inset:0"></div><span id="zone-text">Текст</span><p id="zone-p">Абзац</p></section>
      <section id="own" style="position:relative;color:rgb(1, 2, 3)"><div id="fx-own" style="position:absolute;inset:0"></div><span id="own-text">Текст</span></section>
      <div id="windows" style="display:flex;gap:16px;inline-size:600px;block-size:120px"><div data-sf-effect-window style="flex:1"><span id="window-text">Окно</span></div><div style="flex:1"><span id="card-text">Карточка</span></div></div>`);
    const color = (id) => getComputedStyle(document.getElementById(id)).color;
    const read = () => ({
      zone: color('zone-text'), paragraph: color('zone-p'), own: color('own-text'), window: color('window-text'), card: color('card-text'),
      zoneClasses: [...document.getElementById('zone').classList], ownStyle: document.getElementById('own').getAttribute('style'),
      windowClasses: [...document.querySelector('[data-sf-effect-window]').classList],
    });
    const darkOnly = {...EFFECTS['night-bands']};
    delete darkOnly.pair;
    const module = await import(urls['night-bands']);
    const sample = await import(urls['sample-bands']);
    const {mountEffect, mountWindows} = window.SF.Effects;
    const handles = [
      mountEffect(document.getElementById('fx'), {manifest: darkOnly, module, themeMode: 'auto', area: document.getElementById('zone')}),
      mountEffect(document.getElementById('fx-own'), {manifest: darkOnly, module, themeMode: 'auto', area: document.getElementById('own')}),
      mountWindows(document.getElementById('windows'), {manifest: EFFECTS['sample-bands'], module: sample, themeMode: 'dark'}),
    ];
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const during = read();
    for (const handle of handles) handle.destroy();
    const after = read();
    return {dark: color('ink-dark'), light: color('ink-light'), page: getComputedStyle(document.body).color, schemes: handles.map((handle) => handle.scheme), during, after};
  }, {EFFECTS, urls: Object.fromEntries(Object.keys(EFFECTS).map((key) => [key, moduleUrl(key)]))});
  expect('the two inks differ, and the page is light', ink.dark !== ink.light && ink.page === ink.light, true);
  expect('a dark-only effect on a light page: the area is dark and so is its text',
    {zone: ink.during.zone, paragraph: ink.during.paragraph, classes: ink.during.zoneClasses}, {zone: ink.dark, paragraph: ink.dark, classes: ['sf-effect-area', 'theme-dark']});
  expect('a window card\'s text takes the drawn theme, a plain card keeps the page\'s', {window: ink.during.window, card: ink.during.card}, {window: ink.dark, card: ink.light});
  expect('a colour the author set on the area still wins', {own: ink.during.own, style: ink.during.ownStyle}, {own: 'rgb(1, 2, 3)', style: 'position:relative;color:rgb(1, 2, 3)'});
  expect('destroy gives the text its page ink and the area its classes back',
    {zone: ink.after.zone, paragraph: ink.after.paragraph, window: ink.after.window, classes: ink.after.zoneClasses, windowClasses: ink.after.windowClasses, own: ink.after.own, style: ink.after.ownStyle},
    {zone: ink.light, paragraph: ink.light, window: ink.light, classes: [], windowClasses: [], own: 'rgb(1, 2, 3)', style: 'position:relative;color:rgb(1, 2, 3)'});

  if (errors.length) failures.push({case: 'no page errors', got: errors});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_THEME_OK');
