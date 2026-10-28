import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Breadcrumbs presentation uses role tokens and responsive logical geometry', async () => {
  const styles = [
    await read('src/component/breadcrumbs/scss/_css__breadcrumbs.scss'),
    await read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss'),
  ].join('\n');

  assert.match(styles, /flex-wrap: wrap/);
  assert.match(styles, /--sf-text-size-1\\\/2/);
  assert.match(styles, /--sf-primary/);
  assert.match(styles, /--sf-on-surface/);
  assert.match(styles, /--sf-font-weight-medium/);
  assert.match(styles, /sf-breadcrumbs-item--separator[\s\S]*scaleX\(-1\)/);
  assert.match(styles, /:focus-visible/);
  assert.doesNotMatch(styles, /:focus(?:\s|,|\{)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(styles, /\b(?:1|2|4|6|8|12|14|16|20|24|32)(?:px|rem)\b/);
});

test('Ordinary Breadcrumbs owns one localized ellipsis action and dynamic recalculation', async () => {
  const runtime = await read('src/component/breadcrumbs/js/breadcrumbs.js');

  assert.match(runtime, /getAttribute\('data-expand-label'\)/);
  assert.match(runtime, /aria-expanded', 'false'/);
  assert.match(runtime, /<span aria-hidden="true">…<\/span>/);
  assert.match(runtime, /sf-breadcrumbs-item--separator/);
  assert.match(runtime, /removedNodes/);
  assert.match(runtime, /attributeFilter: \['data-max-items', 'max-items', 'data-expand-label', 'expand-label'\]/);
  assert.match(runtime, /Math\.max\(0, Math\.floor\(maxItems\)\)/);
});

test('Smart Breadcrumbs projects the ordinary owner and native navigation semantics', async () => {
  const [source, template, manifest] = await Promise.all([
    read('src/smart/breadcrumbs/index.js'),
    read('src/smart/breadcrumbs/js/templates/default.js'),
    read('src/smart/breadcrumbs/smart.manifest.json').then(JSON.parse),
  ]);

  // smart.icon is listed because the template renders sf-icon, which the rule
  // has to fetch: see loader-relation-completeness.contract.test.mjs.
  assert.deepEqual(manifest.composition.uses, ['component.breadcrumbs', 'component.icons', 'smart.icon']);
  // Empty: the runtime reads the attribute, then the page language's dictionary;
  // the English default the manifest used to show was never used (2026-10-13).
  // The page language's word (default-from): the registry names no fixed default.
  assert.equal(manifest.inputs.properties['expand-label'].default, undefined);
  assert.equal(manifest.accessibility.role, 'navigation');
  assert.match(manifest.accessibility.focus, /focus-visible/);
  assert.match(source, /expandLabel: \{ default: '' \}/);
  assert.match(source, /props\.homeLabel/);
  assert.match(template, /<nav/);
  assert.match(template, /aria-current=/);
  assert.match(template, /sf-breadcrumbs-item--separator/);
  assert.match(template, /aria-hidden="true"/);
});

test('Breadcrumb documentation covers the public path variants with Framework-only examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, longPath, longLabels, icon] = await Promise.all([
    readUiDoc('content/ru/components/navigation/breadcrumbs.md'),
    readUiDoc('examples/components/breadcrumbs/overview/index.html'),
    readUiDoc('examples/components/breadcrumbs/long-path/index.html'),
    readUiDoc('examples/components/breadcrumbs/long-labels/index.html'),
    readUiDoc('examples/components/breadcrumbs/icon/index.html'),
  ]);
  const examples = [overview, longPath, longLabels, icon].join('\n');

  for (const id of ['overview', 'long-path', 'long-labels', 'icon']) {
    assert.ok(page.includes(`components/breadcrumbs/${id}`));
  }
  assert.match(overview, /<nav class="sf-breadcrumbs/);
  // An icon-only home link carries its name; the icon itself is hidden.
  assert.match(icon, /<a [^>]*aria-label="Главная"><span[^>]*><i class="sf-icon" aria-hidden="true">home<\/i><\/span><\/a>/);
  assert.match(overview, /aria-current="page"/);
  assert.match(longPath, /data-max-items="4"/);
  assert.match(longPath, /data-expand-label="Показать скрытые уровни"/);
  assert.match(longLabels, /data-max-items="0"/);
  assert.doesNotMatch(examples, /<style\b|style=/);
});
