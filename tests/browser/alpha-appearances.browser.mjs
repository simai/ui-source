#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS. Surface and ghost must take their colour from the neutral
// alpha ramp, which means: translucent, not a flat colour; ghost invisible until
// hovered; both steps rising; and the same declarations right in a light and in a
// dark theme without being redeclared.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  'core/core/css/core.css',
  'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/tags/css/tags.css',
].map((p) => join(out, p));

const html = (theme) => `<!doctype html><html class="theme-${theme}"><body>
  <button type="button" class="sf-button sf-button--size-1 sf-button--default sf-button--primary" id="button-reference">
    <span class="sf-button-text-container">reference</span>
  </button>
  <button type="button" class="sf-button sf-button--size-1 sf-button--surface sf-button--on-surface" id="button-surface">
    <span class="sf-button-text-container">surface</span>
  </button>
  <button type="button" class="sf-button sf-button--size-1 sf-button--ghost sf-button--on-surface" id="button-ghost">
    <span class="sf-button-text-container">ghost</span>
  </button>
  <button type="button" class="sf-button sf-button--size-1 sf-button--ghost sf-button--on-surface" id="button-disabled" disabled>
    <span class="sf-button-text-container">ghost</span>
  </button>

  <button type="button" class="sf-icon-button sf-icon-button--size-1 sf-icon-button--surface sf-icon-button--on-surface sf-icon-button--icon" id="icon-surface">
    <span class="sf-icon">x</span>
  </button>
  <button type="button" class="sf-icon-button sf-icon-button--size-1 sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--icon" id="icon-ghost">
    <span class="sf-icon">x</span>
  </button>
  <button type="button" class="sf-icon-button sf-icon-button--size-1 sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--icon" id="icon-disabled" disabled>
    <span class="sf-icon">x</span>
  </button>

  <button type="button" class="sf-tag sf-tag--default sf-tag--size-1 sf-tag--interactive" id="tag-reference"><span class="sf-tag-container">plain</span></button>
  <button type="button" class="sf-tag sf-tag--default sf-tag--appearance-surface sf-tag--size-1 sf-tag--interactive" id="tag-surface"><span class="sf-tag-container">surface</span></button>
  <button type="button" class="sf-tag sf-tag--default sf-tag--appearance-ghost sf-tag--size-1 sf-tag--interactive" id="tag-ghost"><span class="sf-tag-container">ghost</span></button>
  <span class="sf-tag sf-tag--success sf-tag--size-1" id="status-plain"><span class="sf-tag-container">done</span></span>
  <span class="sf-tag sf-tag--success sf-tag--appearance-ghost sf-tag--size-1" id="status-ghost"><span class="sf-tag-container">done</span></span>
</body></html>`;

// Chromium serialises a colour that came out of color-mix() as color(srgb …), and
// a colour caught mid-transition as oklab(…), so the alpha has to be read from
// any of those forms rather than from rgba() alone.
const alpha = (colour) => {
  const match = /^(?:rgba?|color|oklab|oklch|lab|lch|hsla?)\(([^)]+)\)$/u.exec(String(colour).trim());
  if (!match) return null;
  const slash = match[1].split('/');
  if (slash.length > 1) return Number(slash[1].trim());
  const parts = match[1].split(/[,\s]+/u).filter(Boolean);
  return parts.length > 3 ? Number(parts[3]) : 1;
};

// The tag draws its boundary as an inset shadow, so its strength is the shadow's
// own alpha rather than a border colour.
const shadowAlpha = (shadow) => {
  const colour = /^(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\))/u.exec(String(shadow).trim())?.[1];
  return colour ? alpha(colour) : null;
};

const failures = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setContent(html(theme));
    for (const path of css) await page.addStyleTag({path});

    // The controls transition their colours, so a value read the instant the
    // styles land is an interpolated midpoint. Every read waits for the colour to
    // stop moving, which is what a person actually sees.
    const read = async (id) => {
      let previous = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const state = await page.evaluate((target) => {
          const element = document.getElementById(target);
          const style = getComputedStyle(element);
          const label = element.querySelector('.sf-button-text-container, .sf-tag-container, .sf-icon');
          return {
            background: style.backgroundColor,
            border: style.borderTopColor,
            borderWidth: style.borderTopWidth,
            shadow: style.boxShadow,
            height: element.getBoundingClientRect().height,
            text: label ? getComputedStyle(label).color : null,
            fontSize: label ? getComputedStyle(label).fontSize : null,
            fontSizeToken: label ? getComputedStyle(label).getPropertyValue('--sf-button-text-container--font-size').trim() : '',
          };
        }, id);
        const shot = JSON.stringify(state);
        if (shot === previous) return state;
        previous = shot;
        await page.waitForTimeout(50);
      }
      throw new Error(`The colours of #${id} never settled`);
    };

    const note = (detail) => failures.push({theme, ...detail});

    // Every family: ghost empty at rest, surface faint with a stronger boundary.
    const families = [
      {name: 'button', surface: 'button-surface', ghost: 'button-ghost', disabled: 'button-disabled', boundary: (s) => alpha(s.border)},
      {name: 'icon button', surface: 'icon-surface', ghost: 'icon-ghost', disabled: 'icon-disabled', boundary: (s) => alpha(s.border)},
      {name: 'tag', surface: 'tag-surface', ghost: 'tag-ghost', disabled: null, boundary: (s) => shadowAlpha(s.shadow)},
    ];

    for (const family of families) {
      const surface = await read(family.surface);
      const ghost = await read(family.ghost);

      if (alpha(ghost.background) !== 0) {
        note({family: family.name, ghostRest: ghost.background, expected: 'nothing at rest'});
      }
      const fill = alpha(surface.background);
      const edge = family.boundary(surface);
      if (!(fill > 0 && fill < 0.1)) {
        note({family: family.name, surfaceFill: surface.background, expected: 'a faint translucent fill'});
      }
      if (!(edge > fill)) {
        note({family: family.name, surfaceFill: surface.background, surfaceEdge: edge, expected: 'a boundary one step stronger than the fill'});
      }

      // Hover and press rise through the ramp.
      await page.hover(`#${family.surface}`);
      const hovered = alpha((await read(family.surface)).background);
      if (!(hovered > fill)) note({family: family.name, hovered, rest: fill, expected: 'a stronger tint on hover'});
      await page.hover('#tag-reference');

      if (family.disabled) {
        const disabled = await read(family.disabled);
        if (alpha(disabled.background) !== 0) {
          note({family: family.name, disabledBackground: disabled.background, expected: 'no fill when disabled'});
        }
        if (disabled.text === ghost.text) {
          note({family: family.name, disabledText: disabled.text, expected: 'a muted label when disabled'});
        }
      }
    }

    // The button keeps the typography of its size: the appearances are inside the
    // size matrix, not beside it.
    const reference = await read('button-reference');
    for (const id of ['button-surface', 'button-ghost']) {
      const state = await read(id);
      if (state.fontSizeToken === '' || state.fontSize !== reference.fontSize) {
        note({id, fontSize: state.fontSize, token: state.fontSizeToken, reference: reference.fontSize, expected: 'the size token the reference button of the same size gets'});
      }
    }

    // A tag never grows because of its appearance: the boundary is an inset shadow.
    // The reference is the same element with the same classes minus the appearance.
    const plain = await read('tag-reference');
    const tagSurface = await read('tag-surface');
    if (Math.abs(plain.height - tagSurface.height) > 0.5) {
      note({family: 'tag', plainHeight: plain.height, surfaceHeight: tagSurface.height, expected: 'the same height as a tag without an appearance'});
    }

    // A status tag keeps its colour: an appearance must not drain the meaning. The
    // success container is itself translucent, so the claim is equality with a
    // status tag that was given no appearance, not opacity.
    const statusPlain = await read('status-plain');
    const statusGhost = await read('status-ghost');
    if (statusPlain.background !== statusGhost.background) {
      note({family: 'tag', plain: statusPlain.background, withAppearance: statusGhost.background, expected: 'the success colour, untouched by an appearance'});
    }

    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
process.stdout.write('Alpha appearances: PASS — button, icon button and tag: ghost empty until touched, surface faint with a stronger boundary, status colour untouched, both themes from one declaration\n');
