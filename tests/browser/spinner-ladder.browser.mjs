#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The spinner on the size ladder (simai/ui-source#10), measured on the built
// bytes, like the segmented group of simai/ui-source#9:
//   - at every step, 1/3 to 3, and on both sides of the 60rem breakpoint
//     (widths 1000 and 390), the spinner's box -- sf-spinner and the ordinary
//     .sf-loader-container alike -- is the box of the sf-icon inside an
//     sf-button of the same size, and its drawn stroke is that icon's stroke
//     (a regular-weight Material Symbol strokes 2 of its 24 units); a spinner
//     with no step is step 1;
//   - the colour is the current ink, and --sf-loader--color on an ancestor
//     replaces it;
//   - the pixel attributes are still read until the sweep and are noted in
//     SF.deprecations, under the name the page wrote; a spinner on the ladder
//     notes nothing;
//   - the arc turns without end when infinite (a fixed 30% of the ring,
//     simai/ui-source#13), and under reduced motion it is the same arc, still.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/spinner/css/spinner.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'component/component/spinner/js/spinner.js', 'smart/smart/spinner/js/spinner.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();

async function open({width = 1000, body = '', reducedMotion = 'no-preference'} = {}) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">${body}</body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-spinner') && customElements.get('sf-button'));
  await page.waitForFunction(() => [...document.querySelectorAll('.sf-loader-container')].every((node) => node.querySelector('.sf-loader-svg')));
  await page.waitForTimeout(400);
  return page;
}

// The box of a spinner and the stroke it draws, in CSS pixels: the computed
// stroke is in the units of the drawing, scaled by the box over the viewBox.
const MEASURE = `(root) => {
  const indicator = root.querySelector('.sf-loader--loading-indicator');
  const svg = root.querySelector('.sf-loader-svg');
  const accent = root.querySelector('.sf-loader-ring-accent');
  const box = indicator.getBoundingClientRect();
  // The drawing's own width, not its bounding box: the arc turns the drawing
  // (simai/ui-source#13), and a turned box is wider than the drawing.
  const drawn = {width: svg.clientWidth};
  const view = svg.viewBox.baseVal;
  return {
    width: box.width, height: box.height,
    stroke: parseFloat(getComputedStyle(accent).strokeWidth) * drawn.width / view.width,
    colour: getComputedStyle(accent).stroke,
    animation: getComputedStyle(accent).animationName,
    iterations: getComputedStyle(accent).animationIterationCount,
    dash: getComputedStyle(accent).strokeDasharray,
    spin: getComputedStyle(svg).animationName,
    spinIterations: getComputedStyle(svg).animationIterationCount,
  };
}`;

try {
  // 1. The ladder, both sides of 60rem.
  for (const width of [1000, 390]) {
    const body = SIZES.map((size) => `<div data-row="${size}" style="display:flex;gap:16px;align-items:center;margin-block-end:8px">
      <sf-button size="${size}" icon="search" text="Кнопка"></sf-button>
      <sf-spinner size="${size}" infinite label=""></sf-spinner>
      <div class="sf-loader-container sf-loader--size-${size}" data-infinite="true"></div>
    </div>`).join('') + '<div data-row="none"><div class="sf-loader-container" data-infinite="true"></div></div>';
    const page = await open({width, body});
    const rows = await page.evaluate(({sizes, source}) => {
      const measure = eval(source);
      const of = (node) => node.getBoundingClientRect();
      return sizes.map((size) => {
        const row = document.querySelector(`[data-row="${size}"]`);
        const icon = of(row.querySelector('sf-button .sf-icon'));
        return {
          size,
          button: of(row.querySelector('sf-button > button')).height,
          icon: {width: icon.width, height: icon.height},
          smart: measure(row.querySelector('sf-spinner .sf-loader-container')),
          ordinary: measure(row.querySelector(':scope > .sf-loader-container')),
        };
      }).concat([{size: 'none', ordinary: measure(document.querySelector('[data-row="none"] .sf-loader-container'))}]);
    }, {sizes: SIZES, source: MEASURE});
    const ladder = rows.filter((row) => row.size !== 'none');
    evidence[`ladder@${width}`] = ladder.map(({size, button, icon, smart, ordinary}) => ({
      size, button, icon: icon.width, spinner: smart.width, ordinary: ordinary.width,
      stroke: Number(smart.stroke.toFixed(3)), iconStroke: Number((icon.width / 12).toFixed(3)),
    }));
    for (const row of ladder) {
      const at = `size ${row.size} at ${width}px`;
      for (const kind of ['smart', 'ordinary']) {
        const spinner = row[kind];
        check(`${at} ${kind}: the spinner is the button's icon box`, near(spinner.width, row.icon.width) && near(spinner.height, row.icon.height) && row.icon.width > 0, {icon: row.icon, spinner});
        check(`${at} ${kind}: the stroke is the icon's stroke (2 of 24 units)`, near(spinner.stroke, row.icon.width / 12), {icon: row.icon, spinner});
        check(`${at} ${kind}: an infinite arc turns without end, its length fixed at 30%`, spinner.spin === 'sf-loader-svg-rotate' && spinner.spinIterations === 'infinite' && spinner.animation === 'none' && /^30(px)?, 70(px)?$/u.test(spinner.dash), spinner);
      }
    }
    const none = rows.find((row) => row.size === 'none').ordinary;
    const one = ladder.find((row) => row.size === '1');
    check(`no step is step 1 at ${width}px`, near(none.width, one.icon.width), {none, one: one.icon});
    // The ladder rises: no step is smaller than the one below it.
    check(`the ladder never falls at ${width}px`, ladder.every((row, index) => index === 0 || row.smart.width >= ladder[index - 1].smart.width), evidence[`ladder@${width}`]);
    check(`no horizontal scroll at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.close();
  }

  // 2. The colour is the current ink; --sf-loader--color on an ancestor replaces it.
  {
    const page = await open({body: `<div id="ink" style="color: rgb(10, 120, 30)"><sf-spinner infinite label=""></sf-spinner>
      <div class="sf-loader-container" data-infinite="true"></div></div>
      <div id="set" style="--sf-loader--color: rgb(200, 0, 0); color: rgb(10, 120, 30)"><section><sf-spinner infinite label=""></sf-spinner></section></div>`});
    const colours = await page.evaluate(() => ({
      ink: [...document.querySelectorAll('#ink .sf-loader-ring-accent')].map((node) => getComputedStyle(node).stroke),
      set: getComputedStyle(document.querySelector('#set .sf-loader-ring-accent')).stroke,
    }));
    evidence.colour = colours;
    check('the spinner takes the current ink', colours.ink.length === 2 && colours.ink.every((value) => value === 'rgb(10, 120, 30)'), colours);
    check('--sf-loader--color on an ancestor colours it', colours.set === 'rgb(200, 0, 0)', colours);
    await page.close();
  }

  // 3. The pixel attributes: read and noted until the sweep; the ladder notes nothing.
  {
    const page = await open({body: `<sf-spinner size="2" infinite label="" id="ladder"></sf-spinner>
      <div class="sf-loader-container" id="pixel" data-width="40" data-stroke-width="3" data-infinite="true"></div>
      <sf-spinner width="44" dot-radius="2" label="" id="smart-pixel"></sf-spinner>`});
    const read = await page.evaluate(() => ({
      notes: (window.SF?.deprecations?.list?.() || []).filter((note) => note.component === 'spinner' || note.component === 'sf-spinner')
        .map(({component, kind, from, to}) => ({component, kind, from, to})),
      pixel: document.querySelector('#pixel .sf-loader--loading-indicator').getBoundingClientRect().width,
      smartPixel: document.querySelector('#smart-pixel .sf-loader--loading-indicator').getBoundingClientRect().width,
      pixelClass: document.querySelector('#pixel').classList.contains('sf-loader--pixel-geometry'),
      ladderClass: document.querySelector('#ladder .sf-loader-container').classList.contains('sf-loader--pixel-geometry'),
    }));
    evidence.deprecations = read;
    const noted = (component, from) => read.notes.some((note) => note.component === component && note.from === from && note.kind === 'attribute');
    check('data-width is still read', near(read.pixel, 40) && read.pixelClass, read);
    check('width on sf-spinner is still read', near(read.smartPixel, 44), read);
    check('data-width and data-stroke-width are noted', noted('spinner', 'data-width') && noted('spinner', 'data-stroke-width'), read);
    check('sf-spinner width and dot-radius are noted under their own names', noted('sf-spinner', 'width') && noted('sf-spinner', 'dot-radius'), read);
    check('a spinner on the ladder notes nothing and draws on the grid', read.notes.length === 4 && !read.ladderClass, read);
    await page.close();
  }

  // 4. Reduced motion: a still arc, at every step.
  {
    const page = await open({reducedMotion: 'reduce', body: SIZES.map((size) => `<sf-spinner size="${size}" infinite label=""></sf-spinner>`).join('')});
    const still = await page.evaluate((source) => {
      const measure = eval(source);
      return [...document.querySelectorAll('sf-spinner .sf-loader-container')].map((node) => {
        const result = measure(node);
        const accent = node.querySelector('.sf-loader-ring-accent');
        return {...result, opacity: getComputedStyle(accent).opacity};
      });
    }, MEASURE);
    evidence.reducedMotion = still.map(({animation, spin, dash, opacity}) => ({animation, spin, dash, opacity}));
    check('reduced motion: no animation, the arc still at 30%', still.length === 5 && still.every((row) => row.animation === 'none' && row.spin === 'none' && /^30(px)?, 70(px)?$/u.test(row.dash) && row.opacity === '1'), {still});
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SPINNER_LADDER_OK');
