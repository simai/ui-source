#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS. The keyboard ring has to be seen and the mouse must not
// raise one: a ring is drawn as an outline, in a colour that reads at least 3:1
// against the surface behind it, in both themes — and a pointer press leaves
// none at all.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  'core/core/css/core.css',
  'component/component/buttons/css/buttons.css',
  'component/component/tabs/css/tabs.css',
  'component/component/tree/css/tree.css',
].map((path) => join(out, path));

const html = (theme) => `<!doctype html><html class="theme-${theme}"><body style="background: var(--sf-surface-0); margin: 0; padding: 24px;">
  <button type="button" class="sf-button sf-button--size-1 sf-button--default sf-button--primary" id="plain">
    <span class="sf-button-text-container">plain</span>
  </button>

  <div class="sf-tabs">
    <div class="sf-tabs-top-container"><div class="sf-tabs-top" role="tablist">
      <button type="button" role="tab" class="sf-button sf-button--default sf-button--primary sf-button--size-1" id="tab">
        <span class="sf-button-text-container">tab</span>
      </button>
    </div></div>
  </div>

  <ul class="sf-tree" role="tree">
    <li class="sf-tree-item" role="treeitem" tabindex="0" id="row">
      <div class="sf-tree-item-container">row</div>
    </li>
  </ul>
</body></html>`;

const channel = (value) => {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};
const luminance = ([red, green, blue]) =>
  0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
const contrast = (one, other) => {
  const [high, low] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
};

// Chromium serialises a resolved colour as rgb()/rgba(); a translucent ring is
// judged as it is seen, composited over the surface behind it.
const parse = (colour) => {
  const parts = /^rgba?\(([^)]+)\)$/u.exec(String(colour).trim());
  if (!parts) return null;
  const numbers = parts[1].split(/[,\s/]+/u).filter(Boolean).map(Number);
  return [numbers[0], numbers[1], numbers[2], numbers.length > 3 ? numbers[3] : 1];
};
const over = (top, bottom) => top.slice(0, 3).map((value, index) => top[3] * value + (1 - top[3]) * bottom[index]);

const failures = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setContent(html(theme));
    for (const path of css) await page.addStyleTag({path});

    // The fill and the ring are transitioned, so a read taken the moment focus
    // lands catches a blend between the two states: three runs of this check
    // over the same bytes reported 2.16, 2.10 and 1.60 against the same control.
    // The reading is taken once the paint has stopped moving.
    const ringOf = (id) =>
      page.evaluate(async (target) => {
        const element = document.getElementById(target);
        const settled = () => {
          const style = element.classList.contains('sf-tree-item')
            ? getComputedStyle(element.querySelector('.sf-tree-item-container'))
            : getComputedStyle(element);
          return `${style.backgroundColor}|${style.outlineColor}|${style.outlineWidth}|${style.boxShadow}`;
        };
        let previous = settled();
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((done) => setTimeout(done, 80));
          const current = settled();
          if (current === previous) break;
          previous = current;
        }
        const style = getComputedStyle(element);
        const painted = element.classList.contains('sf-tree-item')
          ? getComputedStyle(element.querySelector('.sf-tree-item-container'))
          : style;
        return {
          colour: painted.outlineColor,
          width: painted.outlineWidth,
          style: painted.outlineStyle,
          offset: painted.outlineOffset,
          shadow: painted.boxShadow,
          fill: painted.backgroundColor,
          surface: getComputedStyle(document.body).backgroundColor,
        };
      }, id);

    const note = (detail) => failures.push({theme, ...detail});

    for (const id of ['plain', 'tab', 'row']) {
      // The keyboard is what raises a ring, so focus arrives the way a person
      // sends it: Tab from the top of the document until it lands.
      await page.evaluate(() => document.activeElement?.blur());
      let landed = false;
      for (let press = 0; press < 12 && !landed; press += 1) {
        await page.keyboard.press('Tab');
        landed = await page.evaluate((target) => document.activeElement?.id === target, id);
      }
      if (!landed) {
        failures.push({theme, control: id, expected: 'reachable by Tab'});
        continue;
      }
      const ring = await ringOf(id);

      if (ring.style === 'none' || Number.parseFloat(ring.width) === 0) {
        note({control: id, ring: `${ring.style} ${ring.width}`, expected: 'an outline the keyboard can see'});
        continue;
      }
      // A ring turned inwards lies on the control's own fill, not on the page,
      // so that is what it has to be read against. Outside, the neighbour is
      // the surface behind the control.
      const inward = Number.parseFloat(ring.offset) < 0;
      // A shadow may not stand in for the ring, and that is about an outer one:
      // it would cover whatever sits next to the control. An inset shadow is a
      // different thing — the second, inner line a filled control draws in its
      // own ink, which only exists because the outline above is already there.
      const outerShadow = ring.shadow !== 'none' && ring.shadow
        .split(/,(?![^(]*\))/u)
        .some((layer) => !layer.includes('inset') && !/rgba\([^)]*,\s*0\)/u.test(layer));
      if (outerShadow) {
        note({control: id, shadow: ring.shadow, expected: 'no shadow standing in for the ring'});
      }

      // On a filled control the ring colour can sit a step from the fill on the
      // same ramp and vanish into it. Then the inner ink has to carry: one of
      // the two must reach 3:1 against that fill.
      const fill = parse(ring.fill);
      if (!inward && fill && fill[3] !== 0) {
        const ink = (ring.shadow.match(/(rgba?\([^)]*\))[^,]*inset/u) || [])[1];
        const against = (value) => {
          const c = value && parse(value);
          return c && c[3] !== 0 ? contrast(over(c, fill.slice(0, 3)), fill.slice(0, 3)) : 0;
        };
        const best = Math.max(against(ring.colour), against(ink));
        if (best < 3) {
          note({control: id, fill: ring.fill, ring: ring.colour, ink: ink || 'нет',
            ratio: best.toFixed(2), expected: 'the ring or its ink reads against the fill'});
        }
      }

      const colour = parse(ring.colour);
      const surface = parse(inward ? ring.fill : ring.surface);
      if (!colour || !surface) {
        note({control: id, colour: ring.colour, surface: ring.surface, expected: 'a colour that can be read'});
        continue;
      }
      const ratio = contrast(over(colour, surface.slice(0, 3)), surface.slice(0, 3));
      if (ratio < 3) {
        note({control: id, ratio: Number(ratio.toFixed(2)), expected: 'at least 3:1 against the surface'});
      }
    }

    // A pointer press is not a request for a ring.
    await page.mouse.click(40, 40);
    const clicked = await ringOf('plain');
    if (clicked.style !== 'none' && Number.parseFloat(clicked.width) > 0) {
      note({control: 'plain', afterClick: `${clicked.style} ${clicked.width}`, expected: 'no ring from a mouse press'});
    }

    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('FOCUS_RING_CONTRAST_OK');
