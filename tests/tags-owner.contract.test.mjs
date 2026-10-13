import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const source = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ordinary Tag uses compact semantic geometry and bounded motion', async () => {
  const css = await source('src/component/tags/scss/_css__tags.scss');
  assert.match(css, /var\(--sf-radius--ui\)/);
  assert.match(css, /transition: background-color var\(--sf-duration-fast\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /[0-9](?:px|rem|em)\b/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

test('static Tag has no false action contract and selectable Tag is native', async () => {
  const template = await source('src/smart/tags/js/templates/default.js');
  assert.match(template, /context\.type === 'checkbox'/);
  assert.match(template, /<button[\s\S]*?type="button"[\s\S]*?aria-pressed=/);
  assert.match(template, /<div[\s\S]*?class=\$\{classes\.join\(' '\)\}/);
  assert.doesNotMatch(template, /role="button"/);
  assert.doesNotMatch(template, /tabindex=/);
});

test('select and remove actions cannot be nested', async () => {
  const runtime = await source('src/smart/tags/index.js');
  const template = await source('src/smart/tags/js/templates/default.js');
  // A checkbox tag removes only when closable is set; asked, the toggle and the
  // remove action stand side by side in a div, never one inside the other.
  assert.match(runtime, /if \(this\.type === 'checkbox'\) return this\.hasAttribute\('closable'\)/);
  const removable = template.indexOf("if (context.type === 'checkbox' && context.closable)");
  const plain = template.indexOf("if (context.type === 'checkbox') {");
  assert.ok(removable > 0 && removable < plain, 'the removable branch is taken before the plain toggle');
  const branch = template.slice(removable, plain);
  assert.match(branch, /<div[\s\S]*?<button[\s\S]*?aria-pressed=[\s\S]*?<\/button>\s*\$\{renderClose\(context\)\}\s*<\/div>/);
  assert.match(template, /\?disabled=\$\{context\.disabled\}/);
});

test('decorative leading visuals stay out of the accessibility tree', async () => {
  const template = await source('src/smart/tags/js/templates/default.js');
  for (const className of ['sf-tag-check', 'sf-tag-icon', 'sf-tag-color-icon', 'sf-dot', 'sf-avatar']) {
    assert.match(template, new RegExp(`${className}[^>]*aria-hidden="true"`));
  }
});

test('Smart runtime emits exact change and close intents', async () => {
  const runtime = await source('src/smart/tags/index.js');
  assert.match(runtime, /new CustomEvent\('change',[\s\S]*detail: \{ active, component: this \}/);
  assert.match(runtime, /new CustomEvent\('close',[\s\S]*detail: \{ component: this \}/);
  assert.match(runtime, /this\.toggleAttribute\('active', active\)/);
  assert.match(runtime, /if \(this\.disabled \|\| !this\.closable\) return/);
});

test('source metadata, manifest and fixture describe the same owner', async () => {
  const meta = await source('src/smart/tags/meta.mjs');
  const manifest = JSON.parse(await source('src/smart/tags/smart.manifest.json'));
  const fixture = JSON.parse(await source('src/smart/tags/studio.fixture.json'));
  // The single list became two axes: what the tag carries and what it reports.
  assert.match(meta, /What the tag carries/);
  assert.match(meta, /What the tag reports/);
  assert.equal(manifest.lifecycle, 'experimental');
  assert.equal(manifest.readiness.level, 'accepted');
  assert.deepEqual(manifest.inputs.properties.kind.enum, ['checkbox', 'icon', 'default', 'color', 'avatar']);
  assert.deepEqual(manifest.inputs.properties.status.enum, ['', 'info', 'success', 'warning', 'error']);
  // The legacy name still offers what both axes offer together.
  assert.deepEqual(
    manifest.inputs.properties.type.enum,
    ['checkbox', 'icon', 'default', 'color', 'avatar', 'info', 'success', 'warning', 'error'],
  );
  assert.ok(manifest.events.change);
  assert.ok(manifest.events.close);
  assert.equal(fixture.props.type, 'default');
  assert.equal(fixture.props.closable, true);
});
