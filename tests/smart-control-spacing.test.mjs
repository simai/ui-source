import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const resolver = fs.readFileSync(new URL('../src/core/js/control-spacing.js', import.meta.url), 'utf8');
const {resolveControlSpacing} = await import(`data:text/javascript;base64,${Buffer.from(resolver).toString('base64')}`);
for (const name of ['buttons', 'icon-buttons', 'button-group']) {
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
