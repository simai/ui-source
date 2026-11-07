// A Document drawn inside a host page (simai/ui-source#60) and the columns'
// own styles in the core sheet (simai/ui-source#61). The browser probe
// tests/browser/composition-host-canvas.browser.mjs draws both on a page
// holding core.css alone and measures them.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalize, render } from '../src/core/js/composition/index.mjs';

const text = (value) => ({ type: 'text', value });
const p = (id, value) => ({ id, type: 'content.paragraph', data: { content: [text(value)] } });
const pageDocument = (children = [p('a', 'A')]) => ({
  schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout',
  root: { id: 'p', type: 'layout.page', slots: { default: children } },
});
const regionsDocument = () => ({
  schema: 'simai.composition.document', schema_version: 1, id: 'layout', profile: 'ui-layout',
  root: { id: 'regions', type: 'layout.regions', slots: { regions: [
    { id: 'top', type: 'layout.region', props: { name: 'top', landmark: 'banner' }, slots: { default: [p('brand', 'Brand')] } },
    { id: 'main', type: 'layout.region', props: { name: 'main', landmark: 'main', label: 'Page' }, slots: { default: [{ id: 'outlet', type: 'content.outlet' }] } },
  ] } },
});

test('by default layout.page is the main landmark, as a publishing host keeps it', async () => {
  const drawn = await render(pageDocument());
  assert.equal(drawn.html, '<main data-sf-composition-id="p"><p data-sf-composition-id="a">A</p></main>');
  assert.equal((await render(pageDocument(), { options: { embedded: false } })).html, drawn.html);
});

test('embedded, layout.page is a plain element naming the landmark; the rest is unchanged (#60)', async () => {
  const document = pageDocument([{ id: 's', type: 'layout.section', props: { width: 'full' }, slots: { default: [p('a', 'A')] } }]);
  const page = await render(document);
  const embedded = await render(document, { options: { embedded: true } });
  assert.deepEqual(embedded.diagnostics, []);
  assert.doesNotMatch(embedded.html, /<main\b/u, 'no main landmark inside the host page');
  assert.match(embedded.html, /^<div data-sf-composition-landmark="main" data-sf-composition-id="p">/u);
  assert.equal(embedded.html.replace(/^<div data-sf-composition-landmark="main" /u, '<main ').replace(/<\/div>$/u, '</main>'), page.html, 'the same children');
  assert.equal(embedded.digest, page.digest, 'the Document and its digest stay as they are');
  assert.deepEqual(embedded.assets, page.assets);
});

test('embedded, a main region is a plain element too; banner and the outlet content keep theirs (#60)', async () => {
  const content = {
    schema: 'simai.composition.document', schema_version: 1, id: 'c', profile: 'structured-content',
    root: { id: 'root', type: 'content.paragraph', data: { content: [text('Body')] } },
  };
  const page = await render(regionsDocument(), { content });
  assert.match(page.html, /<main class="sf-composition-region" data-sf-composition-id="main"/u);
  const embedded = await render(regionsDocument(), { content, options: { embedded: true } });
  assert.deepEqual(embedded.diagnostics, []);
  assert.doesNotMatch(embedded.html, /<main\b/u);
  assert.match(embedded.html, /<div class="sf-composition-region" data-sf-composition-id="main" data-sf-region="main" data-sf-region-placement="block" data-sf-composition-landmark="main" aria-label="Page"><div data-sf-outlet="" data-sf-composition-id="outlet"><p data-sf-composition-id="root">Body<\/p><\/div><\/div>/u);
  assert.match(embedded.html, /<header class="sf-composition-region" data-sf-composition-id="top"/u, 'a banner inside the host main is no landmark anyway');
});

test('embedded is a boolean; anything else is a programming error (#60)', async () => {
  for (const value of ['yes', 1, null, {}]) {
    await assert.rejects(render(pageDocument(), { options: { embedded: value } }), new RegExp(`composition_embedded_invalid:${String(value).replace(/[[\]]/gu, '\\$&')}`, 'u'));
  }
  // normalize does not read the option: the Document is the same either way.
  assert.equal((await normalize(pageDocument(), undefined, { embedded: true })).digest, (await normalize(pageDocument())).digest);
});

test('layout.columns lists composition/layout and the core sheet carries it (#61)', async () => {
  const document = {
    schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout',
    root: { id: 'c', type: 'layout.columns', props: { columns: 2 }, slots: { columns: [p('a', 'A'), p('b', 'B')] } },
  };
  const drawn = await render(document);
  assert.deepEqual(drawn.assets, ['composition/layout']);
  assert.match(drawn.html, /^<div class="sf-composition-columns grid gap-4 grid-col-2" data-sf-composition-id="c" data-composition-columns="2"><div class="sf-composition-column">/u);
  const sheet = await readFile(new URL('../src/core/scss/_sf_css__composition.scss', import.meta.url), 'utf8');
  const index = await readFile(new URL('../src/core/scss/index.scss', import.meta.url), 'utf8');
  assert.match(index, /@use 'sf_css__composition';/u, 'the composition sheet is part of core.css');
  // Below the utilities, so a gap or a column count per screen still wins.
  const base = sheet.match(/@layer sf\.base \{\n {4}:where\(\.sf-composition-columns\) \{[\s\S]*?\n\}\n/u)?.[0] || '';
  assert.ok(base, 'the columns stand in sf.base');
  assert.match(base, /display: grid;/u);
  assert.match(base, /gap: var\(--sf-space-4, 1rem\);/u, 'the type\'s own gap, gap-4');
  assert.match(base, /@for \$columns from 2 through 12 \{\n {8}:where\(\.sf-composition-columns\[data-composition-columns="#\{\$columns\}"\]\) \{\n {12}grid-template-columns: repeat\(#\{\$columns\}, minmax\(0, 1fr\)\);/u);
  assert.match(base, /:where\(\.sf-composition-column\) \{\n {8}min-inline-size: 0;/u);
});
