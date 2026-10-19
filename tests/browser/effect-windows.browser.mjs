#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// simai.effect 1.1, windows-are-mask-safe, on the built core: SF.Effects.
// mountWindows draws one effect once behind a group and shows it only through
// the group's window cards. One canvas spans the group, so the scene is
// continuous across the windows; nothing is drawn outside them (sampled
// pixels against a magenta page); the mask follows the group when it narrows;
// the window cards take the effect's theme while a card that is not a window
// keeps the page's; auto follows the page; a hidden tab asks for no frames;
// an effect without the windows capability is not taken.
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {EFFECTS, moduleUrl, openPage} from '../fixtures/effect-catalogue/catalogue.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, wanted});
};
const MAGENTA = [255, 0, 255];

const card = (window) => `<div ${window ? 'data-sf-effect-window' : 'class="plain"'} style="flex:1;border-radius:12px;padding:16px">${window ? 'Window' : 'Plain card'}</div>`;
const body = `<div id="group" style="display:flex;gap:24px;padding:24px;box-sizing:border-box;inline-size:760px;block-size:260px;background:rgb(${MAGENTA.join(',')})">
  ${card(true)}${card(true)}${card(false)}${card(true)}
</div>`;

const browser = await chromium.launch();
try {
  const {page, errors} = await openPage(browser, out, {theme: 'theme-light', body, head: `<style>body{background:rgb(${MAGENTA.join(',')})} #group *{color:transparent}</style>`});
  await page.evaluate(() => {
    window.__frames = 0;
    const own = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => { window.__frames += 1; return own(fn); };
  });

  // Rectangles of the windows, of the plain card, relative to the group.
  const geometry = () => page.evaluate(() => {
    const group = document.getElementById('group');
    const box = group.getBoundingClientRect();
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return {x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height};
    };
    const canvases = group.querySelectorAll('canvas');
    return {
      windows: [...group.querySelectorAll('[data-sf-effect-window]')].map(rect),
      plain: rect(group.querySelector('.plain')),
      canvases: canvases.length,
      canvas: canvases[0] ? rect(canvases[0]) : null,
      group: {w: box.width, h: box.height},
    };
  });
  // Pixels of a screenshot of the group: outside every window (beyond its
  // antialiased edge) nothing but the page colour; inside each window drawn.
  const sample = async (rects) => {
    const png = await page.locator('#group').screenshot();
    return page.evaluate(async ({data, rects, magenta}) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const within = (x, y, rect, inset) => x >= rect.x + inset && x < rect.x + rect.w - inset && y >= rect.y + inset && y < rect.y + rect.h - inset;
      let leaked = 0;
      const drawn = rects.map(() => [0, 0]);
      for (let y = 0; y < image.height; y += 2) {
        for (let x = 0; x < image.width; x += 2) {
          const index = (y * image.width + x) * 4;
          const page = Math.abs(pixels[index] - magenta[0]) + Math.abs(pixels[index + 1] - magenta[1]) + Math.abs(pixels[index + 2] - magenta[2]) <= 6;
          const inner = rects.findIndex((rect) => within(x, y, rect, 14));
          if (inner >= 0) {
            drawn[inner][1] += 1;
            if (!page) drawn[inner][0] += 1;
          } else if (!rects.some((rect) => within(x, y, rect, -2)) && !page) leaked += 1;
        }
      }
      return {leaked, drawn: drawn.map(([hit, all]) => Number((hit / Math.max(all, 1)).toFixed(2)))};
    }, {data: png.toString('base64'), rects, magenta: MAGENTA});
  };
  const classes = () => page.evaluate(() => ({
    windows: [...document.querySelectorAll('[data-sf-effect-window]')].map((element) => [...element.classList].filter((name) => name.startsWith('theme-'))),
    plain: [...document.querySelector('.plain').classList].filter((name) => name.startsWith('theme-')),
    group: [...document.getElementById('group').classList].filter((name) => name.startsWith('theme-')),
  }));
  const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

  // An effect without the windows capability is not taken.
  const refused = await page.evaluate(async ({manifest, url}) => {
    try {
      window.SF.Effects.mountWindows(document.getElementById('group'), {manifest, module: await import(url)});
      return 'mounted';
    } catch (error) {
      return error instanceof TypeError && /windows capability/u.test(error.message) ? 'refused' : String(error);
    }
  }, {manifest: EFFECTS['lone-light'], url: moduleUrl('lone-light')});
  expect('an effect without the windows capability is refused', refused, 'refused');
  expect('and leaves no layer behind', await page.evaluate(() => document.querySelectorAll('#group [data-sf-effect-layer]').length), 0);

  // Fixed dark on a light page, behind three windows and one plain card.
  await page.evaluate(async ({manifest, url}) => {
    window.__handle = window.SF.Effects.mountWindows(document.getElementById('group'), {manifest, module: await import(url), themeMode: 'dark'});
  }, {manifest: EFFECTS['sample-bands'], url: moduleUrl('sample-bands')});
  await page.waitForTimeout(300);
  let shape = await geometry();
  expect('one canvas for the whole group', shape.canvases, 1);
  const spans = shape.canvas && Math.abs(shape.canvas.w - shape.group.w) <= 1 && Math.abs(shape.canvas.h - shape.group.h) <= 1 && Math.abs(shape.canvas.x) <= 1 && Math.abs(shape.canvas.y) <= 1;
  expect('the scene spans the group, so it is continuous across the windows', spans, true);
  let pixels = await sample(shape.windows);
  const evidence = {wide: pixels};
  expect('nothing is drawn outside the windows', pixels.leaked, 0);
  expect('every window shows the effect', pixels.drawn.every((share) => share > 0.95), true);
  expect('window cards take the effect\'s theme, the plain card keeps the page\'s', await classes(), {windows: [['theme-dark'], ['theme-dark'], ['theme-dark']], plain: [], group: []});
  const plainShown = await sample([shape.plain]);
  expect('the plain card shows no effect', plainShown.drawn[0], 0);

  // The group narrows: the mask is rebuilt with it.
  await page.evaluate(() => { document.getElementById('group').style.inlineSize = '520px'; });
  await page.waitForTimeout(250);
  shape = await geometry();
  pixels = await sample(shape.windows);
  evidence.narrow = pixels;
  expect('after the group narrows nothing leaks', pixels.leaked, 0);
  expect('after the group narrows every window still shows it', pixels.drawn.every((share) => share > 0.95), true);
  expect('the scene still spans the group', Math.abs(shape.canvas.w - shape.group.w) <= 1, true);

  // A card that becomes a window joins; one that stops being one leaves.
  await page.evaluate(() => {
    const plain = document.querySelector('.plain');
    plain.setAttribute('data-sf-effect-window', '');
  });
  await page.waitForTimeout(250);
  shape = await geometry();
  pixels = await sample(shape.windows);
  expect('a new window shows the effect too', pixels.drawn.length === 4 && pixels.drawn.every((share) => share > 0.95) && pixels.leaked === 0, true);
  expect('and takes the effect\'s theme', (await classes()).plain, ['theme-dark']);
  await page.evaluate(() => document.querySelector('.plain').removeAttribute('data-sf-effect-window'));
  await page.waitForTimeout(250);
  expect('a card that stops being a window gets its theme back', (await classes()).plain, []);

  // Auto follows the page: the windows go light, the plain card is untouched.
  await page.evaluate(() => window.__handle.update({}, {themeMode: 'auto'}));
  await settle();
  expect('auto on a light page: light windows', await classes(), {windows: [['theme-light'], ['theme-light'], ['theme-light']], plain: [], group: []});
  await page.evaluate(() => document.documentElement.classList.replace('theme-light', 'theme-dark'));
  await settle();
  expect('auto follows the page to dark', (await classes()).windows, [['theme-dark'], ['theme-dark'], ['theme-dark']]);
  expect('the drawn scheme followed', await page.evaluate(() => window.__handle.scheme), 'dark');

  // A hidden tab asks for no frames.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  const from = await page.evaluate(() => window.__frames);
  await page.waitForTimeout(400);
  const to = await page.evaluate(() => window.__frames);
  expect('a hidden tab asks for no frames', to - from <= 1, true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => false});
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Off screen it pauses as well.
  await page.evaluate(() => { document.getElementById('group').style.marginBlockStart = '3000px'; });
  await page.waitForTimeout(300);
  const offFrom = await page.evaluate(() => window.__frames);
  await page.waitForTimeout(400);
  const offTo = await page.evaluate(() => window.__frames);
  expect('off screen it asks for no frames', offTo - offFrom <= 1, true);
  await page.evaluate(() => { document.getElementById('group').style.marginBlockStart = ''; });

  // destroy leaves the group as it was.
  const left = await page.evaluate(() => {
    window.__handle.destroy();
    const group = document.getElementById('group');
    return {
      layers: group.querySelectorAll('[data-sf-effect-layer]').length,
      themed: group.querySelectorAll('.theme-dark, .theme-light').length,
      position: group.style.position,
      isolation: group.style.isolation,
      state: group.getAttribute('data-sf-effect-state'),
    };
  });
  expect('destroy leaves nothing behind', left, {layers: 0, themed: 0, position: '', isolation: '', state: null});

  console.log(JSON.stringify(evidence));
  if (errors.length) failures.push({case: 'no page errors', got: errors});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('EFFECT_WINDOWS_OK');
