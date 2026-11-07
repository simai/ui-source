#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The spinner's ring is drawn inside the icon's live area (docs review R027,
// owner decision C11, 2026-11-07), measured on the built bytes through the
// Loader, as a page loads it, at every step 1/3 to 3, on both sides of the
// 60rem breakpoint (widths 1280 and 390), in light and dark:
//   - the box stays the icon box of the step (simai/ui-source#10): a loading
//     sf-button, a loading sf-button-icon, sf-spinner and the ordinary
//     .sf-loader-container are each as big as the sf-icon of an sf-button of
//     that size, and a loading button is as wide as the same button at rest;
//   - the drawn ring is as big as the glyph beside it: the outer diameter of
//     the ring, read from the pixels, is the ink box of the Material Symbol
//     radio_button_unchecked (a circle across the 20 units of the 24-unit live
//     area) in the resting sf-button of the same step, within 1px, in every one of those spinners; the
//     same diameter read from the drawing (radius + half the stroke, scaled by
//     the box over the viewBox) agrees, so the ring is 5/6 of the box at every
//     step;
//   - every look is on that ring: the track, the arc, each comet segment and
//     the outer edge of the dots end at 10 of the 24 units;
//   - the arc is still the fixed 30% of the ring (simai/ui-source#13);
//   - under reduced motion every spinner is a still frame: no animation, two
//     frames 350 ms apart are the same pixels.
// With SPINNER_RING_SHOTS=<folder> each page is also written as a screenshot,
// and the reduced-motion page as one more.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const shots = process.env.SPINNER_RING_SHOTS ? resolve(process.env.SPINNER_RING_SHOTS) : '';
if (shots) mkdirSync(shots, {recursive: true});

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const GLYPH = 'radio_button_unchecked';
const key = (size) => size.replace('/', '-');
// A frame drawn for the measure only: the track in full ink, so the whole ring
// reads in the pixels (the faint track alone is too pale to find its edge).
const INK = '.probe-ink .sf-loader-ring-filled{stroke:currentColor!important;opacity:1!important}';

const row = (size) => `<div class="row" data-row="${size}">
  <sf-button id="rest-${key(size)}" size="${size}" icon="${GLYPH}" text="Загрузить"></sf-button>
  <sf-button id="load-${key(size)}" size="${size}" icon="${GLYPH}" text="Загрузить" loading></sf-button>
  <sf-button-icon id="icon-${key(size)}" size="${size}" icon="${GLYPH}" aria-label="Обновить"></sf-button-icon>
  <sf-button-icon id="iload-${key(size)}" size="${size}" icon="${GLYPH}" aria-label="Обновить" loading></sf-button-icon>
  <span class="pair"><sf-icon id="glyph-${key(size)}" icon="${GLYPH}" size="${size}"></sf-icon><sf-spinner id="spin-${key(size)}" size="${size}" infinite label=""></sf-spinner></span>
  <div id="plain-${key(size)}" class="sf-loader-container sf-loader--size-${size}" data-infinite="true"></div>
</div>`;

const page = (theme) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{background:var(--sf-surface-0);color:var(--sf-on-surface);margin:0}main{display:flex;flex-direction:column;gap:12px;padding:16px}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.pair{display:inline-flex;align-items:center;gap:8px}${INK}</style></head><body><main>
${SIZES.map(row).join('\n')}
</main></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const url = (theme) => `http://127.0.0.1:${server.address().port}/page?theme=${theme}`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
const SCALE = 2;

const browser = await chromium.launch();
// A page that only decodes screenshots: the ink box of a clip, in CSS pixels.
const decoder = await browser.newPage();
await decoder.setContent('<!doctype html><canvas></canvas>');
const inkBox = (png) => decoder.evaluate(async ({data, scale}) => {
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.querySelector('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0);
  const {data: pixels, width, height} = context.getImageData(0, 0, image.width, image.height);
  const at = (x, y) => pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3);
  const ground = at(0, 0);
  const distance = (x, y) => { const [r, g, b] = at(x, y); return Math.hypot(r - ground[0], g - ground[1], b - ground[2]); };
  let most = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) most = Math.max(most, distance(x, y));
  // An edge pixel counts when it is at least half ink: the glyph and the ring
  // are antialiased alike, so the same threshold finds the same edge.
  const threshold = most / 2;
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (distance(x, y) < threshold) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : {width: (right - left + 1) / scale, height: (bottom - top + 1) / scale, contrast: Math.round(most)};
}, {data: png.toString('base64'), scale: SCALE});

const settled = async (tab, label) => {
  await tab.waitForFunction((sizes) => sizes.every((size) => {
    const k = size.replace('/', '-');
    return document.querySelector(`#load-${k} .sf-loader-svg`) && document.querySelector(`#iload-${k} .sf-loader-svg`)
      && document.querySelector(`#spin-${k} .sf-loader-svg`) && document.querySelector(`#plain-${k} .sf-loader-svg`)
      && document.querySelector(`#rest-${k} .sf-icon`) && document.querySelector(`#glyph-${k}`);
  }), SIZES, {timeout: 20000}).catch(() => failures.push({name: `${label}: the controls never drew`}));
  await tab.waitForFunction(() => !document.documentElement.hasAttribute('data-sf-icons'), null, {timeout: 15000})
    .catch(() => failures.push({name: `${label}: the icon font never settled`}));
  await tab.evaluate(() => document.fonts.ready);
  // The spinner sheet arrives with the Loader: wait until it styles the track.
  await tab.waitForFunction(() => {
    const track = document.querySelector('[id^="spin-"] .sf-loader-ring-filled');
    return track && getComputedStyle(track).strokeLinecap === 'round';
  }, null, {timeout: 15000}).catch(() => failures.push({name: `${label}: the spinner sheet never arrived`}));
  await tab.waitForTimeout(300);
};

// The spinners and glyph of one step: their boxes, and every look's outer edge
// in units of the drawing.
const READ = (sizes) => {
  const of = (node) => { const rect = node.getBoundingClientRect(); return {x: rect.x, y: rect.y, width: rect.width, height: rect.height}; };
  const drawing = (root) => {
    const svg = root.querySelector('.sf-loader-svg');
    const view = svg.viewBox.baseVal;
    const stroke = (node) => parseFloat(getComputedStyle(node).strokeWidth);
    const edge = (node) => Number(node.getAttribute('r')) + stroke(node) / 2;
    const track = svg.querySelector('.sf-loader-ring-filled');
    const accent = svg.querySelector('.sf-loader-ring-accent');
    const dots = [...svg.querySelectorAll('.sf-loader-dot')].map((dot) => Math.hypot(Number(dot.getAttribute('cx')) - view.width / 2, Number(dot.getAttribute('cy')) - view.height / 2) + Number(dot.getAttribute('r')));
    const scale = svg.clientWidth / view.width;
    return {
      view: view.width,
      svgWidth: svg.clientWidth,
      track: edge(track),
      accent: edge(accent),
      comet: [...new Set([...svg.querySelectorAll('.sf-loader-comet-segment')].map((node) => Math.round(edge(node) * 1000) / 1000))],
      dots: [...new Set(dots.map((value) => Math.round(value * 1000) / 1000))],
      diameter: edge(track) * 2 * scale,
      dash: getComputedStyle(accent).strokeDasharray,
      animation: [getComputedStyle(svg).animationName, getComputedStyle(accent).animationName],
    };
  };
  return Object.fromEntries(sizes.map((size) => {
    const k = size.replace('/', '-');
    const spinner = (id) => document.querySelector(`#${id}-${k} .sf-loader-container`) ?? document.querySelector(`#${id}-${k}`);
    return [size, {
      icon: of(document.querySelector(`#rest-${k} .sf-icon`)),
      rest: of(document.querySelector(`#rest-${k} > button`)),
      load: of(document.querySelector(`#load-${k} > button`)),
      glyph: of(document.querySelector(`#glyph-${k} .sf-icon`) ?? document.querySelector(`#glyph-${k}`)),
      spinners: Object.fromEntries(['load', 'iload', 'spin', 'plain'].map((id) => {
        const root = spinner(id);
        const indicator = root.querySelector('.sf-loader--loading-indicator');
        return [id, {box: of(indicator), ...drawing(root)}];
      })),
    }];
  }));
};

const CLIP = 3;
const clipOf = (box) => ({x: Math.floor(box.x) - CLIP, y: Math.floor(box.y) - CLIP, width: Math.ceil(box.width) + 2 * CLIP, height: Math.ceil(box.height) + 2 * CLIP});

try {
  for (const [viewport, width] of [['wide', 1280], ['narrow', 390]]) {
    for (const theme of ['theme-light', 'theme-dark']) {
      const label = `${viewport} ${theme}`;
      // Reduced motion for the measure: the arc stands still, so two reads see
      // the same frame; the ring's size does not depend on the motion.
      const tab = await browser.newPage({viewport: {width, height: 900}, deviceScaleFactor: SCALE, reducedMotion: 'reduce', colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
      tab.on('pageerror', (error) => failures.push({name: `${label}: page error`, said: error.message}));
      await tab.goto(url(theme));
      await settled(tab, label);
      const read = await tab.evaluate(READ, SIZES);
      // The pixels: every spinner's ring in full ink beside the glyphs.
      await tab.evaluate(() => document.body.classList.add('probe-ink'));
      await tab.waitForTimeout(50);
      const steps = {};
      for (const size of SIZES) {
        const at = `${label} size ${size}`;
        const step = read[size];
        const glyphInk = step.glyph.width > 0 ? await inkBox(await tab.screenshot({clip: clipOf(step.glyph)})) : null;
        const iconInk = step.icon.width > 0 ? await inkBox(await tab.screenshot({clip: clipOf(step.icon)})) : null;
        // The reference is the glyph in the resting sf-button of the step, the
        // icon a loading spinner stands in for; sf-icon of the same size beside
        // sf-spinner is read for the evidence.
        check(`${at}: the glyph draws`, Boolean(iconInk), {glyphInk, iconInk});
        const rings = {};
        for (const [id, spinner] of Object.entries(step.spinners)) {
          const ink = spinner.box.width > 0 ? await inkBox(await tab.screenshot({clip: clipOf(spinner.box)})) : null;
          rings[id] = {box: Math.round(spinner.box.width * 100) / 100, drawn: Math.round(spinner.diameter * 100) / 100, ink: ink && ink.width, inkHeight: ink && ink.height};
          check(`${at} ${id}: the box is the icon box of the step`, near(spinner.box.width, step.icon.width, 0.01) && near(spinner.box.height, step.icon.height, 0.01), {box: spinner.box, icon: step.icon});
          check(`${at} ${id}: the ring is drawn in the live area, 5/6 of the box (radius 9 + stroke 1 of 24 units)`, near(spinner.track, 10, 0.001) && near(spinner.diameter, spinner.box.width * 20 / 24, 0.02), spinner);
          check(`${at} ${id}: every look is on the ring (track, arc, comet, dots end at 10 of 24)`, near(spinner.accent, 10, 0.001)
            && spinner.comet.length === 1 && near(spinner.comet[0], 10, 0.001) && spinner.dots.length === 1 && near(spinner.dots[0], 10, 0.001), spinner);
          check(`${at} ${id}: the arc is the fixed 30% of the ring`, /^30(px)?, 70(px)?$/u.test(spinner.dash), spinner);
          check(`${at} ${id}: under reduced motion the spinner stands still`, spinner.animation.every((name) => name === 'none'), spinner);
          check(`${at} ${id}: the drawn ring is as big as the button's glyph of the step (within 1px)`, Boolean(ink && iconInk) && near(ink.width, iconInk.width, 1) && near(ink.height, iconInk.height, 1), {ink, iconInk});
          check(`${at} ${id}: the ring read from the pixels is the ring of the drawing (within 1px)`, Boolean(ink) && near(ink.width, spinner.diameter, 1), {ink, drawn: spinner.diameter});
        }
        check(`${at}: a loading button is as wide and as high as at rest`, near(step.load.width, step.rest.width, 0.01) && near(step.load.height, step.rest.height, 0.01), {rest: step.rest, load: step.load});
        steps[size] = {iconBox: step.icon.width, buttonGlyphInk: iconInk && iconInk.width, sfIconBox: Math.round(step.glyph.width * 100) / 100, sfIconInk: glyphInk && glyphInk.width, rings};
      }
      evidence[label] = steps;
      await tab.evaluate(() => document.body.classList.remove('probe-ink'));
      // Still: two frames 350 ms apart are the same pixels.
      const first = await tab.screenshot({fullPage: true});
      await tab.waitForTimeout(350);
      const second = await tab.screenshot({fullPage: true});
      check(`${label}: under reduced motion two frames are the same pixels`, first.equals(second));
      if (shots) {
        await tab.screenshot({path: join(shots, `spinner-ring-${viewport}-${theme}-reduced-motion.png`), fullPage: true});
        await tab.evaluate(() => document.body.classList.add('probe-ink'));
        await tab.screenshot({path: join(shots, `spinner-ring-${viewport}-${theme}-ink.png`), fullPage: true});
      }
      await tab.close();
      // The moving page, as a reader sees it.
      if (shots) {
        const moving = await browser.newPage({viewport: {width, height: 900}, deviceScaleFactor: SCALE, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
        await moving.goto(url(theme));
        await settled(moving, `${label} moving`);
        await moving.screenshot({path: join(shots, `spinner-ring-${viewport}-${theme}.png`), fullPage: true});
        await moving.close();
      }
    }
    // Dark draws the geometry of light.
    const light = JSON.stringify(evidence[`${viewport} theme-light`]);
    const dark = JSON.stringify(evidence[`${viewport} theme-dark`]);
    check(`${viewport}: dark draws the rings of light`, light === dark, {light: evidence[`${viewport} theme-light`], dark: evidence[`${viewport} theme-dark`]});
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SPINNER_RING_LIVE_AREA_OK');
