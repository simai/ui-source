#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The tones of initials (UI Chat, owner decision q-4f91278cc7), on the built
// bytes in a browser: every tone at every size, in both themes, over the
// surfaces 0 to 3, holds 4.5:1 for the initials against the translucent fill
// composited over its surface; the geometry is the neutral avatar's; auto gives
// the same tone across a reload; an image and the placeholder take no tone; the
// default look is the neutral one; the public variables win. The measured table
// is printed for the release evidence.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const TONES = ['rose', 'amber', 'lime', 'green', 'teal', 'sky', 'indigo', 'violet'];
const SIZES = ['1/4', '1/3', '1/2', '1', '2', '3'];
const SURFACES = [0, 1, 2, 3];
const THEMES = ['light', 'dark'];
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/avatars/css/avatars.css', 'component/component/badges/css/badges.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'component/component/badges/js/badges.js',
  'smart/smart/icon/js/icon.js', 'smart/smart/avatar/js/avatar.js'];

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();

async function dress(page) {
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-avatar'));
  await page.waitForFunction(() => [...document.querySelectorAll('sf-avatar')].every((host) => host.querySelector('.sf-avatar')));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function open({body = '', theme = 'light'} = {}) {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  const html = `<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px;background:var(--sf-surface-0)">${body}</body></html>`;
  await page.route('http://avatar.test/**', (route) => route.fulfill({contentType: 'text/html; charset=utf-8', body: html}));
  await page.goto('http://avatar.test/');
  await dress(page);
  return page;
}

// What the initials lie on: the fill composited over the surface beneath.
const measure = () => {
  const parse = (value) => {
    const match = value.match(/rgba?\(([^)]+)\)/u);
    if (!match) throw new Error(`not an rgb colour: ${value}`);
    const parts = match[1].split(/[ ,/]+/u).filter(Boolean).map(Number);
    return {r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1};
  };
  const channel = (value) => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  return [...document.querySelectorAll('[data-surface]')].flatMap((plate) => {
    const surface = parse(getComputedStyle(plate).backgroundColor);
    if (surface.a < 1) throw new Error('a surface is not opaque');
    return [...plate.querySelectorAll('sf-avatar')].map((host) => {
      const button = host.querySelector('.sf-avatar');
      const label = button.querySelector('.sf-avatar-text');
      const style = getComputedStyle(button);
      const ground = over(parse(style.backgroundColor), surface);
      const ink = over(parse(getComputedStyle(label).color), ground);
      const [a, b] = [luminance(ink), luminance(ground)];
      const rect = button.getBoundingClientRect();
      return {
        tone: host.getAttribute('tone'),
        size: host.getAttribute('size'),
        surface: Number(plate.dataset.surface),
        classes: button.className,
        fill: style.backgroundColor,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        width: rect.width,
        height: rect.height,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        padding: style.padding,
      };
    });
  });
};

const table = {};
const round = (value) => Math.round(value * 100) / 100;
const plates = SURFACES.map((surface) => `<div data-surface="${surface}" style="background:var(--sf-surface-${surface});padding:8px">${
  ['', ...TONES].flatMap((tone) => SIZES.map((size) => `<sf-avatar text="AB" size="${size}" ${tone ? `tone="${tone}"` : ''}></sf-avatar>`)).join('')
}</div>`).join('');

for (const theme of THEMES) {
  const page = await open({theme, body: plates});
  const rows = await page.evaluate(measure);
  check(`${theme}: every avatar was measured`, rows.length === SURFACES.length * SIZES.length * (TONES.length + 1), {rows: rows.length});

  for (const row of rows.filter((one) => one.tone)) {
    const key = `${row.tone}|${theme}`;
    table[key] ??= {tone: row.tone, theme, min: Infinity, max: 0, measured: 0, sizes: {}};
    table[key].min = Math.min(table[key].min, row.ratio);
    table[key].max = Math.max(table[key].max, row.ratio);
    table[key].measured += 1;
    table[key].sizes[row.size] = round(Math.min(table[key].sizes[row.size] ?? Infinity, row.ratio));
    check('initials hold 4.5:1', row.ratio >= 4.5, {theme, tone: row.tone, size: row.size, surface: row.surface, ratio: round(row.ratio)});
    check('the tone class is drawn', row.classes.split(/\s+/u).includes(`sf-avatar--tone-${row.tone}`), {tone: row.tone, classes: row.classes});

    const neutral = rows.find((one) => !one.tone && one.size === row.size && one.surface === row.surface);
    for (const property of ['width', 'height', 'fontSize', 'lineHeight', 'padding']) {
      check('a tone leaves the geometry alone', row[property] === neutral[property],
        {theme, tone: row.tone, size: row.size, property, toned: row[property], neutral: neutral[property]});
    }
    check('a tone is not the neutral fill', row.fill !== neutral.fill, {theme, tone: row.tone, fill: row.fill});
  }

  // Eight tones are eight fills, in each theme.
  const fills = new Set(rows.filter((one) => one.tone && one.surface === 0 && one.size === '1').map((one) => one.fill));
  check('every tone has its own fill', fills.size === TONES.length, {theme, fills: [...fills]});

  // Today's look: no class, the neutral fill, and the container's dimmed ink.
  const neutral = await page.evaluate(() => {
    const host = document.querySelector('sf-avatar:not([tone])');
    const button = host.querySelector('.sf-avatar');
    const probe = document.createElement('div');
    probe.style.cssText = 'background:var(--sf-surface-container);color:var(--sf-on-surface-container--variant)';
    document.body.append(probe);
    const look = getComputedStyle(probe);
    const result = {
      tones: [...button.classList].filter((name) => name.startsWith('sf-avatar--tone-')),
      fill: getComputedStyle(button).backgroundColor,
      expectedFill: look.backgroundColor,
      ink: getComputedStyle(button).color,
      expectedInk: look.color,
    };
    probe.remove();
    return result;
  });
  check('the default has no tone class', neutral.tones.length === 0, neutral);
  check('the default fill is the neutral one', neutral.fill === neutral.expectedFill, neutral);
  check('the default ink is the neutral one', neutral.ink === neutral.expectedInk, neutral);
  await page.close();
}

// Auto: the same name, the same tone, through a reload and on another page; the
// name is the heading, else the aria-label, else the text; no name, neutral.
const NAMES = [
  ['Boris Ilyin', 'violet'],
  ['Анна Захарова', 'amber'],
  ['Rosa Moreno', 'green'],
];
const autoBody = `${NAMES.map(([name]) => `<sf-avatar data-name heading="${name}" tone="auto"></sf-avatar>`).join('')}
  <sf-avatar id="from-label" aria-label="Boris Ilyin" text="XY" tone="auto"></sf-avatar>
  <sf-avatar id="from-text" text="Boris Ilyin" tone="auto"></sf-avatar>
  <sf-avatar id="heading-first" heading="Boris Ilyin" aria-label="Rosa Moreno" text="ZZ" tone="auto"></sf-avatar>
  <sf-avatar id="no-name" tone="auto"></sf-avatar>
  <sf-avatar id="word-only" tone="auto" heading=""></sf-avatar>`;
const tones = () => [...document.querySelectorAll('sf-avatar')].map((host) =>
  [...host.querySelector('.sf-avatar').classList].filter((name) => name.startsWith('sf-avatar--tone-')).join(' '));
const page = await open({body: autoBody});
const first = await page.evaluate(tones);
await page.reload();
await dress(page);
const second = await page.evaluate(tones);
check('auto is stable across a reload', JSON.stringify(first) === JSON.stringify(second), {first, second});
const elsewhere = await open({body: autoBody, theme: 'dark'});
const third = await elsewhere.evaluate(tones);
check('auto is the same on another page and in the other theme', JSON.stringify(first) === JSON.stringify(third), {first, third});
await elsewhere.close();
NAMES.forEach(([name, tone], index) => check('auto answers the documented vector', first[index] === `sf-avatar--tone-${tone}`, {name, got: first[index]}));
check('auto reads the aria-label without a heading', first[NAMES.length] === 'sf-avatar--tone-violet', {got: first[NAMES.length]});
check('auto reads the text without either', first[NAMES.length + 1] === 'sf-avatar--tone-violet', {got: first[NAMES.length + 1]});
check('auto takes the heading first', first[NAMES.length + 2] === 'sf-avatar--tone-violet', {got: first[NAMES.length + 2]});
check('auto with no name is neutral', first[NAMES.length + 3] === '' && first[NAMES.length + 4] === '', {got: first.slice(-2)});
// A heading set later moves the tone with it.
const moved = await page.evaluate(async () => {
  const host = document.querySelector('#no-name');
  host.setAttribute('heading', 'Rosa Moreno');
  await new Promise((done) => setTimeout(done, 50));
  return host.querySelector('.sf-avatar').className;
});
check('a name set later brings its tone', moved.includes('sf-avatar--tone-green'), {moved});
await page.close();

// Tones are for initials: an image and the placeholder are untouched, in the
// element and in the plain classes.
for (const theme of THEMES) {
  const tonePage = await open({theme, body: `
    <sf-avatar id="image" image-url="${PIXEL}" heading="Boris Ilyin" text="BI" tone="rose"></sf-avatar>
    <sf-avatar id="image-auto" image-url="${PIXEL}" heading="Boris Ilyin" tone="auto"></sf-avatar>
    <sf-avatar id="image-plain" image-url="${PIXEL}" heading="Boris Ilyin"></sf-avatar>
    <sf-avatar id="placeholder" tone="rose"></sf-avatar>
    <sf-avatar id="placeholder-plain"></sf-avatar>
    <span id="class-image" class="sf-avatar sf-avatar--size-1 sf-avatar--tone-rose"><img class="sf-avatar-image" alt="" src="${PIXEL}"></span>
    <span id="class-placeholder" class="sf-avatar sf-avatar--size-1 sf-avatar--placeholder sf-avatar--tone-rose"></span>
    <span id="class-placeholder-plain" class="sf-avatar sf-avatar--size-1 sf-avatar--placeholder"></span>
    <span id="class-text" class="sf-avatar sf-avatar--size-1 sf-avatar--text sf-avatar--tone-teal">AB</span>
    <div class="sf-avatar-group sf-avatar-group--size-sm flex"><div class="sf-avatar-group-avatars flex">
      <span id="group-1" class="sf-avatar sf-avatar--size-1 sf-avatar--text sf-avatar--tone-rose inline-flex">AB</span>
      <span id="group-2" class="sf-avatar sf-avatar--size-1 sf-avatar--text sf-avatar--tone-sky inline-flex">CD</span>
      <span id="group-3" class="sf-avatar sf-avatar--size-1 sf-avatar--text inline-flex">EF</span>
      <span id="group-4" class="sf-avatar sf-avatar--size-1 sf-avatar--text inline-flex">GH</span>
    </div></div>`});
  const look = await tonePage.evaluate(() => {
    const read = (element) => {
      const style = getComputedStyle(element);
      return {classes: element.className, fill: style.backgroundColor, ink: style.color, left: element.getBoundingClientRect().left, width: element.getBoundingClientRect().width};
    };
    const out = {};
    for (const id of ['image', 'image-auto', 'image-plain', 'placeholder', 'placeholder-plain']) out[id] = read(document.querySelector(`#${id} .sf-avatar`));
    for (const id of ['class-image', 'class-placeholder', 'class-placeholder-plain', 'class-text', 'group-1', 'group-2', 'group-3', 'group-4']) out[id] = read(document.getElementById(id));
    return out;
  });
  for (const id of ['image', 'image-auto']) {
    check('an image takes no tone class', !look[id].classes.includes('sf-avatar--tone-'), {theme, id, classes: look[id].classes});
    check('an image has no tone fill', look[id].fill === look['image-plain'].fill, {theme, id, fill: look[id].fill, plain: look['image-plain'].fill});
  }
  check('a placeholder takes no tone class', !look.placeholder.classes.includes('sf-avatar--tone-'), {theme, classes: look.placeholder.classes});
  check('a placeholder stays neutral', look.placeholder.fill === look['placeholder-plain'].fill && look.placeholder.ink === look['placeholder-plain'].ink, {theme, ...look.placeholder});
  check('the plain image class ignores a tone', /, 0\)$|transparent/u.test(look['class-image'].fill), {theme, fill: look['class-image'].fill});
  check('the plain placeholder class ignores a tone', look['class-placeholder'].fill === look['class-placeholder-plain'].fill, {theme, fill: look['class-placeholder'].fill});
  check('the plain class draws a tone on initials', look['class-text'].fill !== look['class-placeholder-plain'].fill, {theme, fill: look['class-text'].fill});
  // A group overlaps by its own step whichever fill each avatar has.
  const step = (a, b) => look[b].left - look[a].left;
  check('a group keeps its overlap', step('group-1', 'group-2') === step('group-3', 'group-4'),
    {theme, toned: step('group-1', 'group-2'), neutral: step('group-3', 'group-4')});
  check('an avatar in a group overlaps', step('group-1', 'group-2') < look['group-1'].width, {theme, step: step('group-1', 'group-2')});
  await tonePage.close();
}

// The public variables win over a named tone and over auto.
const hostPage = await open({body: `
  <div style="--sf-avatar-background-color: rgb(1, 2, 3); --sf-avatar-color: rgb(250, 251, 252)">
    <sf-avatar id="set-named" text="AB" tone="rose"></sf-avatar>
    <sf-avatar id="set-auto" heading="Boris Ilyin" tone="auto"></sf-avatar>
  </div>
  <sf-avatar id="on-host" text="AB" tone="teal" style="--sf-avatar-background-color: rgb(4, 5, 6)"></sf-avatar>
  <span id="set-class" class="sf-avatar sf-avatar--size-1 sf-avatar--text sf-avatar--tone-amber" style="--sf-avatar-background-color: rgb(7, 8, 9)">AB</span>`});
const set = await hostPage.evaluate(() => {
  const read = (element) => ({fill: getComputedStyle(element).backgroundColor, ink: getComputedStyle(element).color});
  return {
    named: read(document.querySelector('#set-named .sf-avatar')),
    auto: read(document.querySelector('#set-auto .sf-avatar')),
    host: read(document.querySelector('#on-host .sf-avatar')),
    plain: read(document.getElementById('set-class')),
  };
});
check('--sf-avatar-background-color wins over a named tone', set.named.fill === 'rgb(1, 2, 3)', set.named);
check('--sf-avatar-background-color wins over auto', set.auto.fill === 'rgb(1, 2, 3)', set.auto);
check('--sf-avatar-color wins over a tone', set.named.ink === 'rgb(250, 251, 252)' && set.auto.ink === 'rgb(250, 251, 252)', set);
check('--sf-avatar-background-color wins on the host', set.host.fill === 'rgb(4, 5, 6)', set.host);
check('--sf-avatar-background-color wins on the plain class', set.plain.fill === 'rgb(7, 8, 9)', set.plain);
await hostPage.close();

await browser.close();

console.log(JSON.stringify({contrast: Object.values(table).map((row) => ({...row, min: round(row.min), max: round(row.max)}))}));
if (failures.length) {
  console.error(JSON.stringify({failures: failures.slice(0, 60), total: failures.length}, null, 1));
  process.exit(1);
}
console.log('AVATAR_TONES_OK');
