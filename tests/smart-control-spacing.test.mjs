import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const resolver = fs.readFileSync(new URL('../src/core/js/control-spacing.js', import.meta.url), 'utf8');
const {resolveControlSpacing} = await import(`data:text/javascript;base64,${Buffer.from(resolver).toString('base64')}`);
// A component built from its component.json (standard 1.3.8) takes tightness as
// a dated alias of spacing, its words as spacing's value aliases: the shim
// writes spacing, so the template context reads spacing alone.
for (const name of ['button', 'icon-button']) {
  test(`${name}: tightness is a dated alias of spacing, its words spacing's values`, () => {
    const source = fs.readFileSync(new URL(`../src/smart/${name}/index.js`, import.meta.url), 'utf8');
    const {aliases} = JSON.parse(fs.readFileSync(new URL(`../src/smart/${name}/aliases.json`, import.meta.url), 'utf8'));
    assert.ok(aliases.some((row) => row.kind === 'setting' && row.from === 'tightness' && row.to === 'spacing'));
    const words = Object.fromEntries(aliases.filter((row) => row.kind === 'value' && row.setting === 'spacing').map((row) => [row.from, row.to]));
    assert.deepEqual(words, {low: 'compact', high: 'comfortable', highest: 'spacious'});
    assert.match(source, /resolveControlSpacing\(\{spacing: this\.getAttribute\('spacing'\)\}\)/);
  });
}
for (const name of ['button-group']) {
  const source = fs.readFileSync(new URL(`../src/smart/${name}/index.js`, import.meta.url), 'utf8');
  const body = source.match(/  templateContext\(\) \{([\s\S]*?)\n  \}/)[1];
  const context = new Function('resolveControlSpacing', body);
  test(`${name}: actual template context follows canonical priority through updates and removal`, () => {
    const attributes = new Map([['tightness', 'low']]);
    const element = {
      getAttribute: key => attributes.get(key) ?? null,
      getPropsContext: () => ({tightness: attributes.get('tightness') || '', spacing: attributes.get('spacing') ?? null}),
      createTemplateContext: value => value, normalizedItems: [], value: '', disabled: false,
    };
    assert.match(source, /spacing:\s*\{type: String, default: null\}/, 'observed prop declared');
    assert.equal(context.call(element, resolveControlSpacing).spacing, 'compact');
    attributes.set('spacing', 'spacious');
    assert.equal(context.call(element, resolveControlSpacing).tightness, 'highest');
    attributes.set('tightness', 'high');
    assert.equal(context.call(element, resolveControlSpacing).tightness, 'highest');
    attributes.set('spacing', '');
    assert.equal(context.call(element, resolveControlSpacing).tightness, '');
    attributes.delete('spacing');
    assert.equal(context.call(element, resolveControlSpacing).spacing, 'comfortable');
    attributes.delete('tightness');
    assert.equal(context.call(element, resolveControlSpacing).spacing, 'normal');
  });
}
