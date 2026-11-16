#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An avatar's picture fills its circle once, edge to edge (R155, "ears"). The
// avatar carries a transparent 1px ring; a picture set as background-image
// (the dropdown field and options, list rows and tags draw it so) was tiled
// from the ring's inner edge, and slivers of the next copies showed above and
// below the circle at 8x zoom (ui-control prototypes/phone-country-study.html
// #r3-flags). An <img> picture (sf-avatar, sf-avatar-group, the lookup rows)
// sat inside the ring, one ring smaller than its size.
//
// On the built bytes, at 8 device pixels per CSS pixel, light and dark, at
// every size, with a 7:5 flag (red over blue) and a square photo (a yellow
// band over green), for each renderer's markup:
//   - the topmost painted pixel of the centre column is the picture's top
//     colour and the bottommost its bottom colour (no ears), and both lie on
//     the box edge (the picture fills the ring too);
//   - the background picture is not repeated and starts at the border box;
//   - under the pointer an <img> avatar shows the same ring colour a
//     background avatar does, drawn over the picture's edge.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/avatars/css/avatars.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/avatar/js/avatar.js'];
const SIZES = ['1/4', '1/3', '1/2', '1', '2', '3'];
const THEMES = ['light', 'dark'];
const SCALE = 8;

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();

// The pictures are drawn in the page, so the test needs no fixture files.
const PICTURES = `
  const draw = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c.toDataURL('image/png'); };
  window.FLAG = draw(70, 50, (x, w, h) => { x.fillStyle = 'rgb(220,0,0)'; x.fillRect(0, 0, w, h / 2); x.fillStyle = 'rgb(0,0,220)'; x.fillRect(0, h / 2, w, h / 2); });
  window.PHOTO = draw(60, 60, (x, w, h) => { x.fillStyle = 'rgb(0,160,0)'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgb(255,220,0)'; x.fillRect(0, 0, w, h / 5); });
`;
const COLOURS = {flag: {top: [220, 0, 0], bottom: [0, 0, 220]}, photo: {top: [255, 220, 0], bottom: [0, 160, 0]}};

// Each renderer's avatar markup, as its template writes it.
const RENDERERS = {
  'dropdown field': (size) => `<span class="sf-avatar sf-avatar--size-${size} bg-cover sf-dropdown-field-visual" data-picture="background"></span>`,
  'dropdown option / tag': (size) => `<span class="sf-avatar sf-avatar--size-${size} bg-cover" data-picture="background"></span>`,
  'list row': (size) => `<div class="sf-avatar-label-group flex items-cross-center"><span class="sf-avatar sf-avatar--size-${size} bg-cover" data-picture="background"></span></div>`,
  'lookup row': (size) => `<span class="sf-avatar sf-avatar--size-${size} inline-flex flex-none items-cross-center content-main-center overflow-hidden"><img class="sf-avatar-image" data-picture="img" alt=""></span>`,
  'sf-avatar': (size) => `<sf-avatar size="${size}" image-url="about:blank" data-picture="smart"></sf-avatar>`,
};

async function open(theme, body) {
  const page = await browser.newPage({viewport: {width: 1400, height: 1000}, deviceScaleFactor: SCALE});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  const html = `<!doctype html><html lang="en" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px;background:var(--sf-surface-0)">${body}</body></html>`;
  await page.route('http://avatar.test/**', (route) => route.fulfill({contentType: 'text/html; charset=utf-8', body: html}));
  await page.goto('http://avatar.test/');
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.addScriptTag({content: PICTURES});
  await page.waitForFunction(() => customElements.get('sf-avatar'));
  return page;
}

// Paints the picture into each cell and returns the cells' boxes.
async function dressPictures(page, picture) {
  await page.evaluate(async (name) => {
    const url = window[name.toUpperCase()];
    for (const host of document.querySelectorAll('sf-avatar[data-picture]')) host.setAttribute('image-url', url);
    await new Promise((done) => setTimeout(done, 50));
    for (const el of document.querySelectorAll('[data-picture="background"]')) el.style.backgroundImage = `url("${url}")`;
    for (const el of document.querySelectorAll('img[data-picture="img"]')) el.src = url;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, picture);
}

const cells = Object.entries(RENDERERS).flatMap(([renderer, markup]) => SIZES.map((size) =>
  `<div data-cell data-renderer="${renderer}" data-size="${size}" style="display:inline-block;padding:4px">${markup(size)}</div>`));

const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 2);

for (const theme of THEMES) {
  const page = await open(theme, cells.join(''));
  for (const picture of ['flag', 'photo']) {
    await dressPictures(page, picture);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-cell]')].map((cell) => {
      const avatar = cell.querySelector('.sf-avatar');
      const r = avatar.getBoundingClientRect();
      const style = getComputedStyle(avatar);
      return {renderer: cell.dataset.renderer, size: cell.dataset.size, x: r.x, y: r.y, width: r.width, height: r.height,
        repeat: style.backgroundRepeat, origin: style.backgroundOrigin, image: style.backgroundImage !== 'none'};
    }));
    for (const box of boxes) {
      const where = {theme, picture, renderer: box.renderer, size: box.size};
      check('an avatar was drawn', box.width > 0 && box.height > 0, where);
      if (box.image) {
        check('a background picture is drawn once', box.repeat === 'no-repeat', {...where, repeat: box.repeat});
        check('a background picture starts at the border box', box.origin === 'border-box', {...where, origin: box.origin});
      }
      const shot = await page.screenshot({clip: {x: box.x, y: box.y, width: box.width, height: box.height}});
      const column = await page.evaluate(async (b64) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const mid = img.width >> 1;
        return {height: img.height, pixels: [...Array(img.height).keys()].map((j) => [...x.getImageData(mid, j, 1, 1).data.slice(0, 3)])};
      }, shot.toString('base64'));
      const {top, bottom} = COLOURS[picture];
      const first = column.pixels.findIndex((p) => same(p, top) || same(p, bottom));
      const last = column.pixels.length - 1 - [...column.pixels].reverse().findIndex((p) => same(p, top) || same(p, bottom));
      check('no ear above: the top edge is the picture\'s top', first >= 0 && same(column.pixels[first], top), {...where, first, pixel: column.pixels[first]});
      check('no ear below: the bottom edge is the picture\'s bottom', last >= 0 && same(column.pixels[last], bottom), {...where, last, pixel: column.pixels[last]});
      // One device pixel of antialiasing at the edge; the ring is SCALE pixels.
      check('the picture fills the ring at the top', first <= 1, {...where, first});
      check('the picture fills the ring at the bottom', last >= column.height - 2, {...where, last, height: column.height});
    }
  }

  // Under the pointer an <img> avatar draws the ring over its picture.
  const button = await page.evaluate(() => Boolean(document.querySelector('[data-renderer="sf-avatar"][data-size="2"] button.sf-avatar')));
  check('sf-avatar renders a button', button, {theme});
  const target = page.locator('[data-renderer="sf-avatar"][data-size="2"] button.sf-avatar');
  await target.hover();
  const ring = await page.evaluate(() => {
    const button = document.querySelector('[data-renderer="sf-avatar"][data-size="2"] button.sf-avatar');
    const img = button.querySelector('.sf-avatar-image');
    const probe = document.createElement('div');
    probe.style.color = 'var(--sf-primary-hover)';
    document.body.append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    const s = getComputedStyle(img);
    return {expected, outlineColor: s.outlineColor, outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle};
  });
  check('a hovered <img> avatar shows the ring', ring.outlineColor === ring.expected && ring.outlineStyle === 'solid' && parseFloat(ring.outlineWidth) > 0, {theme, ...ring});
  await page.close();
}

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 40), null, 2));
  console.error(`avatar picture fill: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`avatar picture fill: ${THEMES.length} themes x 2 pictures x ${Object.keys(RENDERERS).length} renderers x ${SIZES.length} sizes, no ears, edge to edge`);
