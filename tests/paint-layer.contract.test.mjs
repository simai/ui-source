// Utility or component (owner decision C273, 2026-11-17; guide study
// q-gd-util-comp, variant B): a component's paint -- its fill, edge colour,
// text colour and the place roles it declares -- stands in the cascade layer
// sf.paint, under the utilities, so `<sf-card class="bg-success-container">`
// is a green card; its shape (size, padding, radius, height, edge width)
// stays in sf.components, over the utilities, so `p-4` does not move a
// button off the height ladder (C01, C105).
//
// Source: the layer order and every component block of src/ (no paint is
// written into @layer sf.components). Built sheets (UI_CORE_ROOT=<ui root>,
// a distr/ beside; skipped without it, as the other built-sheet tests): no
// component sheet carries paint in sf.components, mixin output included, and
// the cascade gives the utility the paint and the component the shape on a
// card, a button, a badge and a field.

import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {cascade, element, parseSheet} from './support/foundation-tokens.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// What paint is: the fill, the edge colour and the colour of the place.
const PAINT = /^(color|background|background-color|border-color|border-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end)-color)$/iu;
const BORDER = /^border(-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?$/iu;
const STYLES = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);

const tokens = (value) => {
  const out = []; let depth = 0; let current = '';
  for (const c of value) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (/\s/u.test(c) && !depth) { if (current) out.push(current); current = ''; } else current += c;
  }
  if (current) out.push(current);
  return out;
};
// A border shorthand that names a colour: <width> <style> <colour>.
const borderWithColour = (prop, value) => {
  if (!BORDER.test(prop)) return false;
  const t = tokens(value);
  return t.length === 3 && STYLES.has(t[1].toLowerCase());
};

test('C273: sf.paint stands between sf.base and sf.utilities, sf.components over the utilities', () => {
  const statement = read('src/core/scss/_sf_layer_order.scss').match(/@layer\s+(sf\.reset[^;]+);/u)[1].split(',').map((s) => s.trim());
  const at = (name) => statement.indexOf(name);
  assert.ok(at('sf.base') >= 0 && at('sf.paint') === at('sf.base') + 1, `sf.paint right after sf.base: ${statement.join(', ')}`);
  assert.ok(at('sf.utilities') === at('sf.paint') + 1, 'the utilities right over the paint');
  assert.ok(at('sf.components') > at('sf.utilities'), 'the components (shape) over the utilities');
});

/* ---------- source: no paint written into a component block ---------- */

// Blocks and statements of a stylesheet (scss or css): enough to find
// declarations and the @layer blocks around them.
function parse(src) {
  const top = {prelude: '', children: []};
  const stack = [top];
  let i = 0; let stmt = null; let paren = 0;
  while (i < src.length) {
    const c = src[i]; const n = src[i + 1];
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '"' || c === '\'') { if (stmt === null) stmt = i; let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } i = j + 1; continue; }
    if (c === 'u' && src.startsWith('url(', i) && !/[\w-]/u.test(src[i - 1] || '')) { if (stmt === null) stmt = i; i = src.indexOf(')', i) + 1; continue; }
    if (c === '#' && n === '{') { if (stmt === null) stmt = i; let d = 1; let j = i + 2; while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } i = j; continue; }
    if (c === '(') { if (stmt === null) stmt = i; paren++; i++; continue; }
    if (c === ')') { paren--; i++; continue; }
    if (c === '{') { const node = {prelude: src.slice(stmt ?? i, i).trim(), children: [], line: src.slice(0, i).split('\n').length}; stack.at(-1).children.push(node); stack.push(node); stmt = null; paren = 0; i++; continue; }
    if (c === ';' && !paren) { if (stmt !== null) stack.at(-1).children.push(src.slice(stmt, i).trim()); stmt = null; i++; continue; }
    if (c === '}') { if (stmt !== null && src.slice(stmt, i).trim()) stack.at(-1).children.push(src.slice(stmt, i).trim()); stmt = null; stack.pop(); i++; continue; }
    if (stmt === null && !/\s/u.test(c)) stmt = i;
    i++;
  }
  return top;
}

function sheets(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sheets(path, out);
    else if (/\.s?css$/u.test(name)) out.push(path);
  }
  return out;
}

// Paint declarations written directly inside every @layer sf.components block.
function paintInComponentBlocks(src) {
  const found = [];
  const inBlock = (node, path) => {
    for (const child of node.children) {
      if (typeof child === 'string') {
        const m = child.match(/^([\w-]+)\s*:\s*([\s\S]*)$/u);
        if (!m || /!important/u.test(child)) continue;
        if (PAINT.test(m[1]) || borderWithColour(m[1], m[2])) found.push(`${path.join(' ')} { ${child} }`);
      } else if (!/^@(keyframes|-webkit-keyframes|font-face|property|function|mixin)\b/u.test(child.prelude)) {
        inBlock(child, [...path, child.prelude.replace(/\s+/gu, ' ').slice(0, 80)]);
      }
    }
  };
  const find = (node) => {
    for (const child of node.children) {
      if (typeof child === 'string') continue;
      if (child.prelude === '@layer sf.components') inBlock(child, [`line ${child.line}:`]);
      else find(child);
    }
  };
  find(parse(src));
  return found;
}

test('C273: no component block of src/ writes a fill, an edge colour or a text colour', () => {
  const files = sheets(join(root, 'src')).filter((path) => readFileSync(path, 'utf8').includes('@layer sf.components'));
  assert.ok(files.length > 100, `component sheets found: ${files.length}`);
  const found = files.flatMap((path) => paintInComponentBlocks(readFileSync(path, 'utf8')).map((x) => `${path.slice(root.length + 1)} ${x}`));
  assert.deepEqual(found, [], `paint belongs in @layer sf.paint (C273):\n${found.slice(0, 20).join('\n')}`);
});

test('C273: the scanner sees paint in a component block (self-check)', () => {
  const sample = `@layer sf.components { .x { padding: 0; color: red; border: 1px solid blue; } @media (min-width: 1px) { .y { background-color: #fff; } } }
@layer sf.paint { .x { color: red; } }`;
  assert.equal(paintInComponentBlocks(sample).length, 3);
});

/* ---------- built sheets ---------- */

const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
const skip = distribution ? false : 'UI_CORE_ROOT names no build';

function builtComponentSheets() {
  const out = [];
  for (const kind of ['component', 'smart']) {
    const base = join(distribution, kind);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const css = join(base, name, 'css');
      if (!existsSync(css)) continue;
      for (const file of readdirSync(css)) if (file.endsWith('.css') && !file.endsWith('.min.css')) out.push(join(css, file));
    }
  }
  return out;
}

test('C273: no built component sheet carries paint in sf.components (mixin output included)', {skip}, () => {
  const files = builtComponentSheets();
  assert.ok(files.length > 50, `built component sheets: ${files.length}`);
  const found = [];
  for (const path of files) {
    const sheet = parseSheet(readFileSync(path, 'utf8'), {all: true});
    for (const rule of sheet.rules) {
      if (rule.layer !== 'sf.components') continue;
      for (const [name, value] of rule.declarations) {
        if (/!important/u.test(value)) continue;
        if (PAINT.test(name) || borderWithColour(name, value)) found.push(`${path.slice(distribution.length + 1)}: ${rule.selectors.join(', ')} { ${name} }`);
      }
    }
  }
  assert.deepEqual(found, [], found.slice(0, 20).join('\n'));
});

// The cascade over core, the utilities and four component sheets.
function built() {
  const files = ['core/css/core.css', 'core/css/utility.full.css', 'component/card/css/card.css', 'component/buttons/css/buttons.css', 'component/badges/css/badges.css', 'component/inputs/css/inputs.css'];
  const css = files.map((file) => readFileSync(join(distribution, file), 'utf8')).join('\n');
  const sheet = parseSheet(css, {all: true});
  return {sheet, rank: (layer) => sheet.layerOrder.indexOf(layer), ...cascade(sheet, 1440)};
}
const html = () => element({tag: 'html', root: true, classes: ['theme-light']});
const body = (parent) => element({tag: 'body', parent});

test('C273: a background, edge or text colour utility on a component wins', {skip}, () => {
  const {sheet, specified, rank} = built();
  const page = body(html());
  const cases = [
    ['card', element({classes: ['sf-card', 'bg-success-container', 'border-success', 'color-on-success-container'], parent: page})],
    ['button', element({tag: 'button', classes: ['sf-button', 'sf-button--default', 'sf-button--primary', 'sf-button--size-1', 'bg-success-container', 'border-success', 'color-on-success-container'], parent: page})],
    ['badge', element({tag: 'span', classes: ['sf-badge', 'sf-badge--main', 'sf-badge--primary', 'sf-badge--size-1', 'bg-success-container', 'border-success', 'color-on-success-container'], parent: page})],
    ['field frame', element({classes: ['sf-input-field', 'bg-success-container', 'border-success', 'color-on-success-container'], parent: element({classes: ['sf-input', 'sf-input--size-1'], parent: page})})],
  ];
  // What each utility writes, read from its own rule in the built sheet.
  const utility = (cls, prop) => sheet.rules.find((r) => r.layer === 'sf.utilities' && r.selectors.includes(`.${cls}`) && r.declarations.some(([n]) => n === prop)).declarations.find(([n]) => n === prop)[1];
  const expected = {'background-color': utility('bg-success-container', 'background-color'), 'border-color': utility('border-success', 'border-color'), color: utility('color-on-success-container', 'color')};
  assert.equal(expected['background-color'], 'var(--sf-success-container)');
  for (const [label, el] of cases) {
    const winners = specified(el);
    for (const [prop, value] of Object.entries(expected)) {
      const won = winners.get(prop);
      assert.ok(won, `${label}: ${prop} is declared`);
      assert.equal(won.value.replace(/\s*!important$/u, ''), value, `${label}: ${prop} is the utility's (layer ${won.key[0]}, sf.utilities is ${rank('sf.utilities')})`);
    }
  }
});

test('C273: the component\'s own paint loses only to the utility, not to what stands under it', {skip}, () => {
  const {specified, rank} = built();
  const page = body(html());
  const card = specified(element({classes: ['sf-card'], parent: page}));
  assert.equal(card.get('background-color').key[0], rank('sf.paint'), 'a plain card is painted by its own sf.paint rule');
  assert.match(card.get('background-color').value, /--sf-card-background-color/u);
  const button = specified(element({tag: 'button', classes: ['sf-button', 'sf-button--default', 'sf-button--primary', 'sf-button--size-1'], parent: page}));
  assert.equal(button.get('background-color').key[0], rank('sf.paint'));
});

test('C273: a geometry utility on a component loses to the component', {skip}, () => {
  const {specified, rank} = built();
  const page = body(html());
  const shape = [
    ['card', element({classes: ['sf-card', 'p-4', 'radius-0'], parent: page}), ['padding-block', 'padding-inline', 'border-radius', 'border-width']],
    // the button writes its corners and padding as longhands; the browser
    // resolves them against the utility's shorthand by layer
    ['button', element({tag: 'button', classes: ['sf-button', 'sf-button--default', 'sf-button--primary', 'sf-button--size-1', 'p-4', 'radius-0'], parent: page}), ['padding-top', 'padding-bottom', 'padding-inline-start', 'padding-inline-end', 'border-start-start-radius', 'border-end-end-radius', 'border-width']],
  ];
  for (const [label, el, props] of shape) {
    const winners = specified(el);
    for (const prop of props) {
      const won = winners.get(prop);
      assert.ok(won, `${label}: ${prop} is declared by the component`);
      assert.ok(won.key[0] >= rank('sf.components'), `${label}: ${prop} stays the component's (layer ${won.key[0]}, sf.components is ${rank('sf.components')})`);
    }
    // the utility's own declaration stands lower than the component's
    const utility = winners.get('padding');
    if (utility) assert.ok(utility.key[0] < rank('sf.components'), `${label}: p-4 stands under the component layer`);
  }
});
