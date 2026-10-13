import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
const body = source.split('  async resolveTemplateResult(changedAttributes = []) {')[1]
  .split('\n  hasBuiltInTemplate(')[0].trim().replace(/\}\s*$/, '');
const resolve = new Function('html', 'nothing', `return async function(changedAttributes = []) {${body}}`)(null, null);

function fixture() {
  const pending = new Map(), destroyed = [], rendered = [];
  const component = {
    componentTemplateName: 'slow', _renderToken: 1, _isMounted: true,
    _externalTemplateModule: null,
    hasBuiltInTemplate: name => name === 'default',
    template: () => 'default', templateContext: () => ({}),
    createTemplateContext: value => value, mapExternalTemplateContext: value => value,
    resolveExternalTemplateModule: name => new Promise(done => pending.set(name, done)),
    _releaseExternalTemplate() {
      if (this._externalTemplateModule) destroyed.push(this._externalTemplateModule.id);
      this._externalTemplateModule = null;
    },
  };
  const module = id => ({id, default() { rendered.push(id); return id; }});
  return {component, pending, destroyed, rendered, module};
}

test('late external view cannot replace or destroy the newer active view', async () => {
  const f = fixture();
  const old = resolve.call(f.component);
  f.component.componentTemplateName = 'fast'; f.component._renderToken++;
  const current = resolve.call(f.component);
  const fast = f.module('fast');
  f.pending.get('fast')(fast); await current;
  f.pending.get('slow')(f.module('slow')); await old;
  assert.equal(f.component._externalTemplateModule, fast);
  assert.deepEqual(f.destroyed, []);
  assert.deepEqual(f.rendered, ['fast']);
});

test('late external view cannot acquire ownership after disconnect', async () => {
  const f = fixture(), pending = resolve.call(f.component);
  f.component._isMounted = false;
  f.pending.get('slow')(f.module('slow')); await pending;
  assert.equal(f.component._externalTemplateModule, null);
  assert.deepEqual(f.rendered, []);
});

test('late external view cannot reactivate after switching to default', async () => {
  const f = fixture(), pending = resolve.call(f.component);
  f.component.componentTemplateName = 'default'; f.component._renderToken++;
  assert.equal(await resolve.call(f.component), 'default');
  f.pending.get('slow')(f.module('slow')); await pending;
  assert.equal(f.component._externalTemplateModule, null);
  assert.deepEqual(f.rendered, []);
});
