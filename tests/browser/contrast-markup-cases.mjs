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

// The sheets a case needs, from the build output root.
export function markupSheets(out) {
  return [
    'core/core/css/core.css',
    'core/core/css/utility.full.css',
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
    return await page.evaluate(() => {
      const parse = (text) => {
        const found = String(text).match(/rgba?\(([^)]+)\)/);
        if (!found) return null;
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
