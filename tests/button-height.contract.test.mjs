// sf-button height (owner decision C27, 2026-11-09): height="low|default|high|highest"
// picks the control height from the size's tightness steps of the
// adaptive-sizing contract; the side padding grows with it; spacing is
// deprecated. The table below is the decision's, so a contract change that
// moves a height fails here before it reaches a page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {ladder} from '../scripts/generate-density.mjs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contract = JSON.parse(read('src/core/contracts/adaptive-sizing.v1.json'));
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const HEIGHTS = ['low', 'default', 'high', 'highest'];

// Decision C27, item 1 (px): desktop and phone.
const DECIDED = {
  desktop: {'1/3': [24, 28, 32, 40], '1/2': [28, 32, 40, 48], 1: [32, 40, 48, 56], 2: [40, 48, 56, 68], 3: [48, 56, 68, 80]},
  mobile: {'1/3': [20, 24, 28, 36], '1/2': [24, 28, 36, 44], 1: [28, 36, 44, 52], 2: [36, 44, 52, 64], 3: [44, 52, 64, 76]},
};
const LADDER = {desktop: [20, 24, 28, 32, 40, 48, 56, 68, 80], mobile: [20, 24, 28, 36, 44, 52, 64, 76]};

const px = (alias) => {
  if (alias === 'zero') return 0;
  const [, family, step] = /^([a-i])(\d)$/u.exec(alias);
  const {startPx, stepPx} = contract.primitives[family];
  return startPx + stepPx * Number(step);
};
const variablePx = (value) => {
  const match = /var\(--sf-([a-i]\d)\)/u.exec(value);
  assert.ok(match, `a ladder step: ${value}`);
  return px(match[1]);
};

test('the contract gives every size x height the decided control height, on the UI height ladder', () => {
  for (const mode of ['desktop', 'mobile']) {
    for (const size of SIZES) {
      const line = px(contract.typography.lineHeights[contract.controls.sizeRoles[size].lineHeightRole][mode]);
      const got = HEIGHTS.map((height) => line + 2 * px(contract.controls.tightness[height][size][mode]));
      assert.deepEqual(got, DECIDED[mode][size], `${mode} ${size}`);
      for (const value of got) assert.ok(LADDER[mode].includes(value), `${mode} ${size} ${value} on the ladder`);
    }
  }
  // Item 3: desktop 1/3 default is a6 (28), low stays a4 (24); the phone is unchanged.
  assert.equal(contract.controls.tightness.default['1/3'].desktop, 'a6');
  assert.equal(contract.controls.tightness.low['1/3'].desktop, 'a4');
  assert.equal(contract.controls.tightness.default['1/3'].mobile, 'a4');
});

test('a compact region shifts the steps one down and height picks the neighbour there', () => {
  const rows = new Map(ladder().map((row) => [row.variable, row]));
  const value = (name, pick) => variablePx(rows.get(name)[pick]);
  const height = (size, step, pick) => value(`--sf-text--height-${size}`, pick) + 2 * value(`--sf-ui-${size}--space-y-tightness-${step}`, pick);
  for (const [index, size] of SIZES.entries()) {
    const normal = HEIGHTS.map((step) => height(size, step, 'normal'));
    assert.deepEqual(normal, DECIDED.desktop[size], `normal ${size}`);
    const compact = HEIGHTS.map((step) => height(size, step, 'compact'));
    if (index === 0) {
      // No size below 1/3: the tightness below in the same size, never under low.
      assert.deepEqual(compact, [24, 24, 28, 32], 'compact 1/3');
    } else {
      assert.deepEqual(compact, DECIDED.desktop[SIZES[index - 1]], `compact ${size} = normal ${SIZES[index - 1]}`);
    }
  }
});

test('the class sheet draws each size x low, high, highest from its tightness step, sides growing by the step less the default', () => {
  const sheet = read('src/component/buttons/scss/_css__buttons.scss');
  for (const size of SIZES) {
    const s = size.replace('/', '\\/');
    for (const step of ['low', 'high', 'highest']) {
      const rule = new RegExp(`\\.sf-button--size-${s.replace(/[\\/]/gu, (c) => `\\${c}`)}\\.sf-button--height-${step} \\{([^}]*)\\}`, 'u').exec(sheet);
      assert.ok(rule, `rule for ${size} ${step}`);
      const body = rule[1];
      const block = `var(--sf-button-padding-block, var(--sf-ui-${s}--space-y-tightness-${step}))`;
      const side = `var(--sf-button-padding-inline, calc(var(--sf-ui-${s}--space-x) + var(--sf-ui-${s}--space-y-tightness-${step}) - var(--sf-ui-${s}--space-y-tightness-default)))`;
      for (const property of ['padding-top', 'padding-bottom']) assert.ok(body.includes(`--sf-button--${property}: ${block};`), `${size} ${step} ${property}`);
      for (const property of ['padding-inline-start', 'padding-inline-end']) assert.ok(body.includes(`--sf-button--${property}: ${side};`), `${size} ${step} ${property}`);
    }
  }
  // After the spacing rules: a button that says both takes its sides from the height.
  assert.ok(sheet.indexOf('.sf-button--height-') > sheet.lastIndexOf('.spacing-spacious)'));
});

test('sf-button declares height, draws its class, keeps it off the native button and deprecates spacing', () => {
  const component = JSON.parse(read('src/smart/button/component.json'));
  assert.deepEqual(component.settings.height.values, HEIGHTS);
  assert.equal(component.settings.height.default, 'default');
  assert.match(component.settings.spacing.summary, /^Deprecated/u);
  const template = read('src/smart/button/js/templates/default.js');
  assert.match(template, /context\.height && context\.height !== 'default' \? `sf-button--height-\$\{context\.height\}` : ''/u);
  const element = read('src/smart/button/index.js');
  assert.match(element, /"size",\n {2}"height",/u, 'height is a component attribute, not forwarded');
  assert.match(element, /noteDeprecated\(\{component: "sf-button", kind: "attribute", from: "spacing", to: "height", since: "2026-11-09", remove_after: "2027-01-01"\}\)/u);
  assert.match(element, /console\?\.warn\?\.\("\[SIMAI Framework\] sf-button: spacing is deprecated until 2027-01-01/u);
  const classButton = read('src/component/buttons/js/_buttons.js');
  assert.match(classButton, /\['low', 'high', 'highest'\]\.includes\(height\)/u);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((row) => row.id === 'attribute-button-spacing-to-height');
  assert.ok(record, 'journal record');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items, [{component: 'sf-button', from: 'spacing', to: 'height'}]);
});
