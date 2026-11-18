// Markup cases of the contrast matrix (owner decisions C178 and C192): text and
// glyphs as a page writes them with the utilities and the components, measured
// in a browser over the built sheets, light and dark. The role pairs of the
// matrix read the tokens alone; these read what a place, a theme class or a
// component makes of them, where a defect hides between two correct roles
// (docs batch B, 2026-11-15, FW-B-1..6).
//
// A case is an element with data-case="<name>" and data-need="<ratio>" in the
// fixture. Its ink is its computed colour; its ground the background layers
// from the element up to the first opaque one (a plate drawn as
// linear-gradient(c, c) over its background counts), over the page. With
// data-ground="#id" the ink stands on a sibling (a slider arrow over its
// slide): the element's own layers up to that sibling's parent are laid over
// the sibling's chain.
import {existsSync} from 'node:fs';
import {join} from 'node:path';

// Each fixture block names the defect it guards.
export const FIXTURES = [];

const ROLES = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'error', 'info'];

// FW-B-1: on a strong plate a child that names the on-colour gets it
// (C192 (1)); the plate's accent (C42 (4)) re-declared it as the plate's colour.
FIXTURES.push(...ROLES.map((role) => `
<div class="bg-${role}">
  <p><span class="color-on-${role}" data-case="FW-B-1 child color-on-${role} on bg-${role}" data-need="4.5">On-colour</span></p>
  <div><span class="color-on-${role}" data-case="FW-B-1 grandchild color-on-${role} on bg-${role}" data-need="4.5">On-colour</span></div>
  ${role === 'primary' ? '' : `<span class="color-on-primary" data-case="FW-B-1 color-on-primary named on bg-${role}" data-need="4.5">On-primary</span>`}
</div>
<div class="bg-${role} color-on-${role}"><span data-case="FW-B-1 bg-${role} color-on-${role} on one element" data-need="4.5">Pair</span></div>`));

// FW-B-2: a nested theme class takes its theme's ink; the roles changed with
// the class, the inherited colour did not. A section in the other theme lays
// its own surface (the ground stays the author's).
FIXTURES.push(...['light', 'dark'].map((inner) => `
<div class="theme-${inner} bg-surface-card">
  <span data-case="FW-B-2 text in a nested theme-${inner} card" data-need="4.5">Nested theme</span>
  <p><span data-case="FW-B-2 text deeper in a nested theme-${inner} card" data-need="4.5">Nested theme</span></p>
  <span class="color-on-surface-variant" data-case="FW-B-2 dim text in a nested theme-${inner} card" data-need="4.5">Nested theme</span>
</div>
<div class="theme-${inner === 'light' ? 'dark' : 'light'} bg-surface-page"><div class="theme-${inner} bg-surface-card">
  <span data-case="FW-B-2 text in theme-${inner} inside the other theme" data-need="4.5">Nested twice</span>
</div></div>`));

// FW-B-3: a slider arrow over its slide holds 3:1. The arrows of --light are
// light circles with dark arrows in either theme; the ghost arrow (the former
// link) drew no circle, its dark glyph on a dark slide. The glyph stands on
// the slide (data-ground), not on an ancestor.
FIXTURES.push(...['primary', 'secondary', 'tertiary'].flatMap((role) => [
  ['light', 'ghost'], ['light', 'link'], ['dark', 'default'], ['', 'ghost'],
].map(([look, button]) => `
<div style="position: relative; block-size: 6rem">
  <div id="slide-${role}-${look || 'bare'}-${button}" class="bg-${role}-container color-on-${role}-container" style="position: absolute; inset: 0">Slide</div>
  <div class="sf-slider-arrows${look ? ` sf-slider-arrows--${look}` : ''}" style="position: absolute; inset-block-start: 1rem; inset-inline-start: 1rem">
    <button type="button" class="sf-icon-button sf-icon-button--${button} sf-icon-button--on-surface sf-icon-button--icon sf-icon-button--size-1" aria-label="Next"><i class="sf-icon" aria-hidden="true" data-case="FW-B-3 arrow ${look || 'bare'} ${button} over bg-${role}-container" data-need="3" data-ground="#slide-${role}-${look || 'bare'}-${button}">keyboard_arrow_right</i></button>
  </div>
</div>`)));

// FW-B-5: inline code on a plate takes the plate's ink and a fill of the
// plate (C192 (2)); its tokens resolved on the root, the page's ink on grey.
FIXTURES.push(...ROLES.map((role) => `
<div class="bg-${role} color-on-${role}"><p>Text and <code data-case="FW-B-5 code on bg-${role}" data-need="4.5">code</code></p></div>
<div class="bg-${role}-container color-on-${role}-container"><p>Text and <code data-case="FW-B-5 code on bg-${role}-container" data-need="4.5">code</code></p></div>`), `
<div class="bg-primary color-on-primary"><div class="bg-surface-card color-on-surface"><p>Card: <code data-case="FW-B-5 code on a card on bg-primary" data-need="4.5">code</code></p></div></div>
<div class="bg-surface-inverse color-on-surface-inverse"><p>Inverse: <code data-case="FW-B-5 code on bg-surface-inverse" data-need="4.5">code</code></p></div>
<div class="bg-surface-inverse-fixed color-on-surface-inverse-fixed"><p>Inverse: <code data-case="FW-B-5 code on bg-surface-inverse-fixed" data-need="4.5">code</code></p></div>
<p>Page: <code data-case="FW-B-5 code on the page" data-need="4.5">code</code></p>`);

// FW-B-6: the dim ink on the popup steps, as the utilities write it and as a
// page writes the raw roles (the docs gate's static pairs): 4.07:1 on the
// nested popup of the pair before C178 (step 5); the popup's step since.
FIXTURES.push(...['popup', 'popup-nested'].map((place) => `
<div class="bg-surface-${place}"><span class="color-on-surface-variant" data-case="FW-B-6 color-on-surface-variant on bg-surface-${place}" data-need="4.5">Dim text</span></div>
<div style="background: var(--sf-surface-${place})"><span style="color: var(--sf-on-surface-variant)" data-case="FW-B-6 --sf-on-surface-variant on --sf-surface-${place}" data-need="4.5">Dim text</span></div>`));

// H1 (DEV held answers, msg-bc1702eb): every pressed step holds the floor on
// every place -- a button pressed (the .active class draws :active) in each
// look, primary and the neutral scheme, its label 4.5 and its glyph 3, on the
// strong places, the inverse ones and glass over a white and a black picture.
// Before: 3.81-3.92 for an outline, ghost or link primary pressed on a strong
// place in the dark theme (tones 25/30 rising towards the plate), 4.17 and
// 3.24 on glass over a white picture (the fill rising to white at 20).
const PRESS_PLACES = [
  ...ROLES.map((role) => [`bg-${role}`, `<div class="bg-${role}">`, '</div>']),
  ['bg-surface-inverse', '<div class="bg-surface-inverse">', '</div>'],
  ['bg-surface-inverse-fixed', '<div class="bg-surface-inverse-fixed">', '</div>'],
  ...['#ffffff', '#000000'].map((picture) => [`glass over ${picture}`, `<div style="background: ${picture}"><div class="sf-surface-media">`, '</div></div>']),
];
const PRESS_LOOKS = ['default', 'tonal', 'outline', 'ghost', 'link'];
FIXTURES.push(...PRESS_PLACES.map(([name, open, close]) => `${open}
${PRESS_LOOKS.flatMap((look) => ['primary', 'on-surface'].map((scheme) => `<button type="button" class="sf-button sf-button--size-1 sf-button--${look} sf-button--${scheme} active"><i class="sf-icon" aria-hidden="true" data-case="H1 ${look} ${scheme} pressed glyph on ${name}" data-need="3">check</i><span class="sf-button-text-container" data-case="H1 ${look} ${scheme} pressed label on ${name}" data-need="4.5">Pressed</span></button>`)).join('\n')}
${close}`));

// The sheets a case needs, from the build output root.
export function markupSheets(out) {
  return [
    'core/core/css/core.css',
    'core/core/css/utility.full.css',
    'component/component/buttons/css/buttons.css',
    'component/component/icon-buttons/css/icon-buttons.css',
    'component/component/slider/css/slider.css',
  ].map((path) => join(out, path)).filter((path) => existsSync(path));
}

// Measures every case in one theme; returns [{case, need, ratio, ink, ground}].
export async function measureMarkup(browser, out, theme) {
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html class="theme-${theme}"><head><meta charset="utf-8"></head><body>${FIXTURES.join('\n')}</body></html>`);
    for (const path of markupSheets(out)) await page.addStyleTag({path});
    // The colours as they rest: a control's fill eases in (the buttons' sheet),
    // and a reading taken mid-way is neither state.
    await page.addStyleTag({content: '*, *::before, *::after { transition: none !important; animation: none !important; }'});
    return await page.evaluate(() => {
      // A colour the sheets write in another space (oklch, color()) is read
      // through a 1x1 canvas, which gives it back as sRGB.
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      const parse = (text) => {
        const found = String(text).match(/^rgba?\(([^)]+)\)/);
        if (!found) {
          if (!text || text === 'none' || text === 'transparent') return null;
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = 'rgba(0, 0, 0, 0)';
          context.fillStyle = String(text);
          context.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
          return a ? {r, g, b, a: a / 255} : null;
        }
        const parts = found[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return {r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1};
      };
      const over = (top, bottom) => {
        const a = top.a + bottom.a * (1 - top.a);
        if (!a) return {r: 0, g: 0, b: 0, a: 0};
        const mix = (x, y) => (x * top.a + y * bottom.a * (1 - top.a)) / a;
        return {r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a};
      };
      const luminance = ({r, g, b}) => [r, g, b].map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const hex = ({r, g, b}) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
      const chain = (element, stop = null) => {
        const layers = [];
        for (let node = element; node && node !== stop; node = node.parentElement) {
          const style = getComputedStyle(node);
          const plate = style.backgroundImage.match(/^linear-gradient\((rgba?\([^)]+\))/);
          if (plate) { const colour = parse(plate[1]); if (colour && colour.a > 0) layers.push(colour); }
          const colour = parse(style.backgroundColor);
          if (colour && colour.a > 0) { layers.push(colour); if (colour.a >= 1) return {layers, opaque: true}; }
        }
        return {layers, opaque: false};
      };
      const white = {r: 255, g: 255, b: 255, a: 1};
      return [...document.querySelectorAll('[data-case]')].map((element) => {
        const groundAt = element.getAttribute('data-ground');
        const under = groundAt ? document.querySelector(groundAt) : null;
        const {layers, opaque} = chain(element, under ? under.parentElement : null);
        let ground = white;
        if (!opaque && under) for (const layer of chain(under).layers.reverse()) ground = over(layer, ground);
        for (const layer of layers.reverse()) ground = over(layer, ground);
        let ink = parse(getComputedStyle(element).color);
        if (ink.a < 1) ink = over(ink, ground);
        const [high, low] = [luminance(ink), luminance(ground)].sort((x, y) => y - x);
        return {
          case: element.dataset.case,
          need: Number(element.dataset.need),
          ratio: Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100,
          ink: hex(ink),
          ground: hex(ground),
        };
      });
    });
  } finally {
    await page.close();
  }
}
