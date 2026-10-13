#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [/absolute/path/to/previous/output]
// Renders the real sf-toggle from the built bundle, because a hand-written
// fixture does not reproduce the component's own sizing. The container keeps its
// boundary in the outline — moving it to a border made the control two pixels
// taller, measured here — so the ring is drawn on the control wrapper instead. This check
// holds that apart: the boundary stays on the container, the ring appears on the
// root, both survive forced colours, and the geometry does not move.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const roots = [process.argv[2], process.argv[3]].filter(Boolean).map((path) => resolve(path));

const measure = async (root, forcedColors) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    if (forcedColors) await page.emulateMedia({forcedColors: 'active'});
    await page.setContent('<!doctype html><html class="theme-light"><body></body></html>');
    for (const path of ['core/core/css/core.css', 'component/component/toggle/css/toggle.css', 'smart/smart/toggle/css/toggle.css']) {
      await page.addStyleTag({path: join(root, path)}).catch(() => {});
    }
    for (const path of ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/toggle/js/toggle.js']) {
      await page.addScriptTag({path: join(root, path)});
    }
    await page.evaluate(() => {
      const host = document.createElement('sf-toggle');
      host.id = 'toggle';
      host.setAttribute('label', 'Автоматически');
      host.setAttribute('size', '1');
      document.body.append(host);
    });
    await page.waitForFunction(() => document.querySelector('#toggle .sf-toggle-container, #toggle .sf-toggle-inner-wrap') !== null, {timeout: 10000});
    await page.waitForTimeout(300);
    const measured = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          width: Math.round(box.width * 100) / 100,
          height: Math.round(box.height * 100) / 100,
          left: Math.round(box.left * 100) / 100,
          border: style.borderTopWidth,
          outline: `${style.outlineStyle} ${style.outlineWidth}`,
        };
      };
      const control = document.querySelector('#toggle input');
      control.focus();
      // The ring belongs to the control wrapper since 6f0f8af8: the root spans
      // the label, and a ring around a whole line reported a small switch.
      const focusedRoot = read('#toggle .sf-toggle-control');
      const focusedContainer = read('#toggle .sf-toggle-container');
      control.blur();
      return {
        root: read('#toggle .sf-toggle'),
        container: read('#toggle .sf-toggle-container'),
        knob: read('#toggle .sf-toggle-inner'),
        focusedRoot,
        focusedContainer,
        markup: document.querySelector('#toggle').innerHTML.slice(0, 200),
      };
    });
    return measured;
  } finally {
    await browser.close();
  }
};

const failures = [];
const now = await measure(roots[0], false);
const contrast = await measure(roots[0], true);

if (!now.container || now.container.width < 8) {
  failures.push({container: now.container, markup: now.markup, expected: 'the real component rendered with its own size'});
}
// The ring is on the root; the container's boundary is untouched by it.
if (!now.focusedRoot.outline.startsWith('solid')) {
  failures.push({ring: now.focusedRoot.outline, expected: 'a solid outline on the control wrapper while focused'});
}
if (!now.focusedContainer.outline.startsWith('solid 1px')) {
  failures.push({boundary: now.focusedContainer.outline, expected: 'the container keeps its 1px boundary while focused'});
}
if (now.root.outline.startsWith('solid')) {
  failures.push({idleRing: now.root.outline, expected: 'no ring on the root when nothing is focused'});
}
// This is what one shared outline could not do: keep both in high contrast.
if (!contrast.focusedRoot.outline.startsWith('solid')) {
  failures.push({contrastRing: contrast.focusedRoot.outline, expected: 'the ring survives forced colours'});
}
if (!contrast.focusedContainer.outline.startsWith('solid')) {
  failures.push({contrastBoundary: contrast.focusedContainer.outline, expected: 'the boundary survives forced colours beside the ring'});
}

if (roots[1]) {
  const before = await measure(roots[1], false);
  const moved = (a, b) => Math.abs((a ?? 0) - (b ?? 0));
  const grew = moved(before.container?.width, now.container?.width);
  const taller = moved(before.container?.height, now.container?.height);
  const knob = moved(before.knob?.left, now.knob?.left);
  process.stdout.write(`outer box: ${before.container?.width}x${before.container?.height} -> ${now.container?.width}x${now.container?.height}; knob moved ${knob}px\n`);
  if (grew > 0.01 || taller > 0.01) {
    failures.push({before: before.container, after: now.container, expected: 'the outer box does not move at all'});
  }
  if (knob > 0.01) failures.push({knob, expected: 'the knob does not move at all'});
}

if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
process.stdout.write('Toggle boundary and ring: PASS — ring on the control wrapper, boundary untouched, high contrast keeps both, geometry unchanged\n');
