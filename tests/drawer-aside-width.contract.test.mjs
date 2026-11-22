// GB15 A9 (DEV decision msg-6aead3f3): sf-drawer's aside-width. The width
// ladder step measures the content; an announced aside column is added on top
// of the step, never taken from it. The drawer stays on its ladder and its
// off-ladder warning reads width alone. Measured in a browser at each step by
// the GB15 evidence (probe/a9-drawer-aside.mjs).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const sheet = read('src/smart/drawer/scss/_smart__drawer.scss');
const source = read('src/smart/drawer/index.js');
const ASIDE = 'var(--sf-drawer-aside-width, calc(var(--sf-px) * 0))';

test('A9: aside-width is a setting of sf-drawer 1.20.0, in its manifest and docs', () => {
  for (const file of ['src/smart/drawer/component.json', 'src/smart/drawer/smart.manifest.json']) {
    const manifest = json(file);
    assert.equal(manifest.version, '1.22.0', file); // GB17: 1.22.0 kept, Y3 withdrawn (C396) // GB16 returns: data-sf-drawer-fill // group build 15: moved on by the merged branches or a GB15 assembly item
  }
  const setting = json('src/smart/drawer/component.json').settings['aside-width'];
  assert.equal(setting.type, 'string');
  assert.equal(setting.default, '');
  assert.match(setting.summary, /added on top of the size step/u);
  assert.match(source, /asideWidth: \{attribute: 'aside-width', default: ''\}/u);
  assert.match(read('src/smart/drawer/docs.md'), /`aside-width`/u);
  assert.ok(json('contracts/changes/journal.json').records.some(({id}) => id === 'setting-drawer-aside-width'));
});

test('A9: the panel is the step plus the aside, at every step, never wider than the window', () => {
  assert.ok(sheet.includes(`width: min(calc(var(--sf-drawer-width, var(--sf-measure-52)) + ${ASIDE}), 100vi);`));
  // The edge strip stands beside the same width.
  assert.ok(sheet.includes(`+ min(calc(var(--sf-drawer-width, var(--sf-measure-52)) + ${ASIDE}), 100vi)`));
  // Each step only sets the content's width; none of them reads the aside.
  // C396: the measure ladder, which compact density scales (GB17 Y3 withdrawn).
  for (const [step, token] of [['1-2', '--sf-measure-44'], ['2', '--sf-measure-64']]) {
    assert.ok(sheet.includes(`--sf-drawer-width: var(${token});`), step);
  }
  // A phone's whole-screen panel adds nothing.
  assert.match(sheet, /--sf-drawer-width: 100%;\s*--sf-drawer-aside-width: calc\(var\(--sf-px\) \* 0\);/u);
});

test('A9: the element writes the aside on the root and the panel; the off-ladder warning reads width alone', () => {
  assert.equal(source.split('`--sf-drawer-aside-width:${context.asideWidth};`').length - 1, 2);
  const warn = source.slice(source.indexOf('noteOffLadderWidth(root) {'), source.indexOf('  orderEdge(edge, inHead) {'));
  assert.match(warn, /getAttribute\('width'\)/u);
  assert.doesNotMatch(warn, /aside/u);
});
