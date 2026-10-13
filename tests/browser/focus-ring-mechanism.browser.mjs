#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS: the ring must be a real outline in the focus tokens
// (width, colour, offset) on the element that takes focus, it must turn inwards
// inside a seamless group, a list and a menu, it must not be a shadow, and a
// mouse click must leave no ring at all. The expectations are read from the
// tokens, not written as numbers: the ring became 2px solid standing 1px off
// the element on 2026-09-29 (6f0f8af8), and a probe holding the old 4px
// translucent ring reported that decision as a failure for three revisions.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  'core/core/css/core.css',
  'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/tags/css/tags.css',
  'component/component/inputs/css/inputs.css',
  'component/component/button-group/css/button-group.css',
  'component/component/checkbox/css/checkbox.css',
  'component/component/radio/css/radio.css',
  'component/component/switch/css/switch.css',
  'component/component/dropdown/css/dropdown.css',
  'component/component/menu/css/menu.css',
].map((path) => join(out, path));

const page_html = `<!doctype html><html class="theme-light"><body>
  <button type="button" class="sf-button sf-button--default sf-button--primary" id="button">button</button>
  <button type="button" class="sf-icon-button sf-icon-button--default sf-icon-button--primary" id="icon">i</button>
  <span class="sf-tag sf-tag--interactive" id="tag" tabindex="0">tag</span>
  <label class="sf-input" id="field"><span class="sf-input-field"><input id="control"></span></label>
  <label class="sf-checkbox" id="checkbox"><span class="sf-checkbox-box"><input type="checkbox" id="checkbox-control"></span></label>
  <label class="sf-radio-button" id="radio"><span class="sf-radio-button-box"><input type="radio" id="radio-control"></span></label>
  <label class="sf-switch" id="switch"><span class="sf-switch-toggler"><input type="checkbox" id="switch-control"></span></label>
  <div class="sf-list" role="listbox">
    <div class="sf-list-item" role="option" id="option" tabindex="0">option</div>
  </div>
  <div class="sf-menu"><div class="sf-menu-element" id="menu-element" tabindex="0">item</div></div>
  <div class="sf-button-group">
    <button type="button" class="sf-button sf-button--default sf-button--primary segment-start" id="group-first">one</button>
    <button type="button" class="sf-button sf-button--default sf-button--primary segment-end" id="group-last">two</button>
  </div>
</body></html>`;

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(page_html);
  for (const path of css) await page.addStyleTag({path});

  const token = await page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.cssText = 'outline: var(--sf-focus--width) var(--sf-focus--style) var(--sf-focus--color); outline-offset: var(--sf-focus--offset);';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const ring = {style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset, colour: style.outlineColor};
    probe.remove();
    return ring;
  });
  const inwards = `-${token.width}`;

  const ringOf = async (id) => page.evaluate((target) => {
    const element = document.getElementById(target);
    element.focus();
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: style.outlineWidth,
      offset: style.outlineOffset,
      colour: style.outlineColor,
      shadow: style.boxShadow,
      focusVisible: element.matches(':focus-visible'),
    };
  }, id);

  // Keyboard focus draws the ring. Programmatic focus counts as keyboard focus
  // in Chromium for these elements, which is what a real Tab does too.
  for (const id of ['button', 'icon', 'tag', 'group-first']) {
    const ring = await ringOf(id);
    if (ring.style !== token.style || ring.width !== token.width) {
      failures.push({element: id, ring, expected: `${token.width} ${token.style}, the focus tokens`});
    }
    if (ring.colour !== token.colour) {
      failures.push({element: id, colour: ring.colour, expected: `the focus colour ${token.colour}`});
    }
    if (/rgb/.test(ring.shadow) && ring.shadow !== 'none' && ring.shadow.includes(token.width)) {
      failures.push({element: id, shadow: ring.shadow, expected: 'no shadow ring beside the outline'});
    }
  }

  // Inside a seamless group the ring turns inwards, so it cannot cover the
  // neighbour's edge.
  const grouped = await ringOf('group-first');
  if (grouped.offset !== inwards) {
    failures.push({element: 'group-first', offset: grouped.offset, expected: `${inwards}, the ring turned inwards`});
  }
  const standalone = await ringOf('button');
  if (standalone.offset !== token.offset) {
    failures.push({element: 'button', offset: standalone.offset, expected: `${token.offset}, the ring standing off the edge`});
  }

  // The field draws the ring around what the person sees, not around the bare
  // control inside it.
  const field = await page.evaluate(() => {
    document.getElementById('control').focus();
    const wrapper = document.querySelector('#field .sf-input-field');
    const style = getComputedStyle(wrapper);
    return {style: style.outlineStyle, width: style.outlineWidth};
  });
  if (field.style !== token.style || field.width !== token.width) {
    failures.push({element: 'input field', ring: field, expected: `${token.width} ${token.style} on the field`});
  }

  // A selection control draws the ring around the part the person sees, while
  // the native control inside it stays invisible.
  for (const [control, part, name] of [
    ['checkbox-control', '#checkbox .sf-checkbox-box', 'checkbox'],
    ['radio-control', '#radio .sf-radio-button-box', 'radio'],
    ['switch-control', '#switch .sf-switch-toggler', 'switch'],
  ]) {
    const ring = await page.evaluate(([id, selector]) => {
      document.getElementById(id).focus();
      const style = getComputedStyle(document.querySelector(selector));
      return {style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor};
    }, [control, part]);
    if (ring.style !== token.style || ring.width !== token.width || ring.colour !== token.colour) {
      failures.push({element: name, ring, expected: `${token.width} ${token.style} in the focus colour on the visible part`});
    }
  }

  // An element inside a list or a menu keeps its ring inside itself, so it
  // cannot cover the edge of the item above or below.
  for (const id of ['option', 'menu-element']) {
    const ring = await ringOf(id);
    if (ring.style !== token.style || ring.width !== token.width) {
      failures.push({element: id, ring, expected: `${token.width} ${token.style}`});
    }
    if (ring.offset !== inwards) {
      failures.push({element: id, offset: ring.offset, expected: `${inwards}, the ring turned inwards`});
    }
  }

  // A mouse click leaves no ring.
  await page.mouse.move(0, 0);
  await page.click('#button');
  const clicked = await page.evaluate(() => {
    const element = document.getElementById('button');
    return {focusVisible: element.matches(':focus-visible'), style: getComputedStyle(element).outlineStyle};
  });
  if (clicked.focusVisible || clicked.style !== 'none') {
    failures.push({mouse: clicked, expected: 'no ring after a click'});
  }
  await page.close();
} finally {
  await browser.close();
}
if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
process.stdout.write('Focus ring: PASS — one outline ring, inwards in a group, none for the mouse\n');
