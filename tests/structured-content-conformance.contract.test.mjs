import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { render, validate } from '../src/core/js/composition/index.mjs';
import { canonicalHtml, diagnosticKeys, sameHtml } from '../contracts/conformance/structured-content/normalize-html.mjs';
import { fromEditorJs, toEditorJs } from '../src/core/js/composition/editorjs.mjs';
import { normalizedTree, stable, withoutIds } from '../src/core/js/composition/foreign.mjs';
import { fromMarkdown, toMarkdown } from '../src/core/js/composition/markdown.mjs';

// The conformance kit of structured content (the content standard's step 4):
// the SIMAI Framework's JS renderer passes every case under the kit's own
// comparison rule, the kit is what its generator writes from that renderer,
// and the cases reach every content type and every parameter value.

const kit = new URL('../contracts/conformance/structured-content/', import.meta.url);
const read = (relative) => JSON.parse(readFileSync(new URL(relative, kit), 'utf8'));
const manifest = read('manifest.json');
const cases = manifest.cases.map((id) => read(`cases/${id}.json`));

test('the kit is current: its generator writes the files committed', () => {
  const output = execFileSync(process.execPath, [new URL('../scripts/generate-structured-content-conformance.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
  assert.match(output, /conformance kit is current/u);
});

test('the manifest lists every case file once, and the type versions of the registry', () => {
  const files = readdirSync(new URL('cases/', kit)).filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/u, '')).sort();
  assert.deepEqual([...manifest.cases].sort(), files);
  assert.equal(new Set(manifest.cases).size, manifest.cases.length);
  assert.equal(manifest.counts.cases, manifest.cases.length);
  const registry = Object.fromEntries(BUILTIN_TYPE_MANIFESTS.filter(({ type }) => type.startsWith('content.')).map(({ type, version }) => [type, version]));
  assert.deepEqual(manifest.types, registry);
  for (const entry of cases) {
    assert.equal(entry.schema, 'simai.composition.structured-content-conformance-case', entry.id);
    assert.deepEqual(Object.keys(entry.expect).sort(), ['assets', 'diagnostics', 'html', 'valid'], entry.id);
  }
});

test('the JS renderer passes every case under the comparison rule', async () => {
  for (const entry of cases) {
    const { document, content } = entry.input;
    assert.equal(validate(document).valid, entry.expect.valid, `${entry.id}: valid`);
    const result = await render(document, content === undefined ? {} : { content });
    assert.ok(sameHtml(result.html, entry.expect.html), `${entry.id}: html\n${canonicalHtml(result.html)}\n${canonicalHtml(entry.expect.html)}`);
    // The kit is this renderer's output: byte for byte, not only under the rule.
    assert.equal(result.html, entry.expect.html, `${entry.id}: bytes`);
    assert.deepEqual(diagnosticKeys(result.diagnostics), diagnosticKeys(entry.expect.diagnostics), `${entry.id}: diagnostics`);
    assert.deepEqual([...result.assets].sort(), [...entry.expect.assets].sort(), `${entry.id}: assets`);
    if (!entry.expect.valid) assert.equal(entry.expect.html, '', `${entry.id}: an invalid Document draws nothing`);
  }
});

test('no case draws a style attribute, and a style key is a forbidden field (kit 2.0.0)', () => {
  for (const entry of cases) assert.equal(/\sstyle=/u.test(entry.expect.html), false, entry.id);
  const aligned = cases.find(({ id }) => id === 'table-align');
  assert.match(aligned.expect.html, /<td class="text-center">1<\/td><td class="text-end">/u);
  assert.equal(manifest.version.split('.')[0], '2');
  for (const place of ['node', 'data', 'props']) {
    const node = { id: 'p', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'x' }] } };
    if (place === 'node') node.style = 'color: red';
    else node[place] = { ...(node[place] || {}), style: 'color: red' };
    const document = { schema: 'simai.composition.document', schema_version: 1, id: 's', profile: 'structured-content', root: { id: 'root', type: 'content.document', slots: { default: [node] } } };
    assert.ok(validate(document).diagnostics.some(({ code }) => code === 'executable_or_secret_field_forbidden'), place);
  }
  for (const manifestEntry of BUILTIN_TYPE_MANIFESTS) {
    const keys = [];
    const walk = (value) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) { keys.push(key.toLowerCase()); walk(inner); }
    };
    walk([manifestEntry.data_schema?.properties, manifestEntry.props_schema?.properties]);
    assert.equal(keys.includes('style'), false, `${manifestEntry.type} declares no style`);
  }
});

test('the comparison rule decides each of its vectors as the kit says', () => {
  const { vectors } = read('normalization.json');
  assert.ok(vectors.length >= 20);
  for (const vector of vectors) {
    assert.equal(sameHtml(vector.left, vector.right), vector.equal, vector.label);
    assert.deepEqual([canonicalHtml(vector.left), canonicalHtml(vector.right)], vector.canonical, vector.label);
  }
  assert.ok(vectors.some(({ equal }) => equal) && vectors.some(({ equal }) => !equal), 'both answers are pinned');
});

test('a renderer that strays is caught: a class, an attribute, a text or an order', async () => {
  const entry = cases.find(({ id }) => id === 'alert-status-warning');
  const { html } = entry.expect;
  for (const strayed of [
    html.replace('sf-alert--warning', 'sf-alert--error'),
    html.replace(' aria-hidden="true"', ''),
    html.replace('Body.', 'Body'),
    html.replace('<div class="sf-alert-text">Title</div>', '').replace('</div></div></div>', '<div class="sf-alert-text">Title</div></div></div></div>'),
  ]) {
    assert.notEqual(strayed, html);
    assert.equal(sameHtml(strayed, html), false, strayed);
  }
  const pretty = html.replaceAll('><', '>\n  <').replace('class="sf-alert sf-alert--warning', 'class="sf-alert--warning  sf-alert');
  assert.equal(sameHtml(pretty, html), true, 'white space between blocks and the order of classes do not count');
});

test('the cases reach every content type and every parameter value', () => {
  const seen = new Map();
  const note = (type, plane, key, value) => {
    const entry = seen.get(type) || { props: new Map(), data: new Set() };
    seen.set(type, entry);
    if (plane === 'data') { entry.data.add(key); return; }
    const values = entry.props.get(key) || new Set();
    for (const one of Array.isArray(value) ? value : [value]) values.add(JSON.stringify(one));
    entry.props.set(key, values);
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node.props || {})) note(node.type, 'props', key, value);
    for (const key of Object.keys(node.data || {})) note(node.type, 'data', key);
    if (!seen.has(node.type)) seen.set(node.type, { props: new Map(), data: new Set() });
    Object.values(node.slots || {}).flat().forEach(visit);
  };
  for (const entry of cases.filter(({ expect }) => expect.valid)) {
    visit(entry.input.document.root);
    if (entry.input.content?.profile === 'structured-content') visit(entry.input.content.root);
  }
  const missing = [];
  for (const manifest of BUILTIN_TYPE_MANIFESTS.filter(({ type }) => type.startsWith('content.'))) {
    const entry = seen.get(manifest.type);
    if (!entry) { missing.push(manifest.type); continue; }
    for (const [key, schema] of Object.entries(manifest.props_schema.properties || {})) {
      const values = entry.props.get(key) || new Set();
      const wanted = schema.enum ?? schema.items?.enum ?? (schema.type === 'boolean' ? [true, false]
        : schema.type === 'integer' ? [schema.minimum, schema.maximum] : null);
      if (!wanted) { if (!values.size) missing.push(`${manifest.type} props.${key}`); continue; }
      for (const value of wanted) if (!values.has(JSON.stringify(value))) missing.push(`${manifest.type} props.${key}=${JSON.stringify(value)}`);
    }
    for (const key of Object.keys(manifest.data_schema.properties || {})) if (!entry.data.has(key)) missing.push(`${manifest.type} data.${key}`);
  }
  assert.deepEqual(missing, []);
  const levels = new Set(cases.flatMap(({ input }) => input.document.root.slots?.default ?? []).filter(({ type }) => type === 'content.heading').map(({ data }) => data.level ?? 2));
  assert.deepEqual([...levels].sort(), [1, 2, 3, 4, 5, 6], 'every heading level');
});

test('the kit holds the inline model, escaping, the html@1 cleaning, the outlet and invalid Documents', () => {
  const ids = new Set(manifest.cases);
  const atoms = new Set();
  const marks = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    if (value.type === 'component' && typeof value.name === 'string') atoms.add(value.name);
    if (value.type === 'text') for (const mark of value.marks || []) marks.add(mark);
    Object.values(value).forEach(walk);
  };
  for (const entry of cases.filter(({ expect }) => expect.valid)) walk(entry.input);
  assert.deepEqual([...atoms].sort(), ['badge', 'button', 'icon', 'kbd']);
  assert.deepEqual([...marks].sort(), ['code', 'em', 'strike', 'strong']);
  assert.ok(cases.some(({ expect, input }) => expect.valid && JSON.stringify(input).includes('"type":"break"')), 'a break');
  for (const id of ['inline-link-schemes', 'inline-link-fragment', 'inline-link-relative', 'inline-unknown-node', 'escape-href-attribute', 'html-hostile', 'outlet-with-content', 'outlet-content-invalid', 'invalid-schema']) {
    assert.ok(ids.has(id) || ids.has(`invalid-${id}`), id);
  }
  const hostile = cases.find(({ id }) => id === 'html-hostile').expect.html;
  assert.doesNotMatch(hostile, /<script|<style|<img|<iframe|<svg|\son[a-z]+=|javascript:|data:|style=/iu);
  const vectors = JSON.parse(readFileSync(new URL('./fixtures/rich-text-vectors.json', import.meta.url), 'utf8'));
  assert.equal(cases.filter(({ id }) => /^html-\d+$/u.test(id)).length, vectors.length, 'every html@1 vector of sf-rich-text');
  const codes = new Set(cases.filter(({ expect }) => !expect.valid).flatMap(({ expect }) => expect.diagnostics.map(({ code }) => code)));
  for (const code of ['schema_unknown', 'profile_unknown', 'type_unknown', 'node_id_duplicate', 'executable_or_secret_field_forbidden', 'content_parent_invalid', 'leaf_slots_forbidden', 'slot_cardinality', 'schema_one_of', 'unsafe_url', 'outlet_duplicate', 'depth_limit']) {
    assert.ok(codes.has(code), code);
  }
});

// Kit 2.1.0 (2026-11-10, F2): content.foreign and the converters.
test('content.foreign draws nothing of raw on a public page, and a hash mismatch is reported', async () => {
  assert.equal(manifest.version, '2.2.0');
  const foreign = cases.filter(({ id }) => id.startsWith('foreign-'));
  assert.deepEqual(foreign.map(({ id }) => id).sort(), ['foreign-editorjs', 'foreign-hash', 'foreign-hash-mismatch', 'foreign-html-script', 'foreign-markdown']);
  for (const entry of foreign) {
    assert.equal(entry.expect.valid, true, entry.id);
    assert.equal(entry.expect.html, '<article data-sf-composition-id="root"></article>', entry.id);
  }
  assert.deepEqual(cases.find(({ id }) => id === 'foreign-hash-mismatch').expect.diagnostics.map(({ code }) => code), ['foreign_hash_mismatch']);
  const markdown = cases.find(({ id }) => id === 'foreign-markdown').input.document;
  assert.match(markdown.root.slots.default[0].data.raw, /\r\n\t.*[^\x00-\x7f]/su, 'CRLF, a tab and text beyond ASCII');
  // A JSON round trip keeps the value exactly.
  for (const entry of foreign) assert.deepEqual(JSON.parse(JSON.stringify(entry.input.document)), entry.input.document);
  // The editor's view: the inert placeholder, the source as text.
  const { html } = await render(cases.find(({ id }) => id === 'foreign-html-script').input.document, { options: { unknown: 'placeholder' } });
  assert.match(html, /<div class="sf-composition-unknown" role="note" data-sf-composition-type="content.foreign" data-sf-composition-id="fx">HTML<\/div>/u);
  assert.doesNotMatch(html, /script|onerror/u);
});

test('Markdown: every fixture from the Docara site reads, prints back to its bytes unless a loss says otherwise, and reads back equal', async () => {
  const names = readdirSync(new URL('markdown/', kit)).filter((name) => name.endsWith('.md'));
  assert.ok(names.filter((name) => name.startsWith('docara-')).length >= 20, 'pages and examples of the Docara site');
  assert.deepEqual([...manifest.converters.markdown].sort(), [...names.map((name) => name.replace(/\.md$/u, '')), ...manifest.converters.markdown.filter((id) => id.startsWith('export-'))].sort());
  for (const name of names) {
    const source = readFileSync(new URL(`markdown/${name}`, kit), 'utf8');
    const expected = read(`markdown/${name.replace(/\.md$/u, '.json')}`).expect;
    const read1 = await fromMarkdown(source, { id: 'page' });
    assert.deepEqual(read1.value, expected.document, name);
    assert.deepEqual(read1.losses, expected.losses, name);
    assert.deepEqual(validate(read1.value).diagnostics, [], name);
    const printed = await toMarkdown(read1.value);
    if (!read1.losses.some(({ code }) => code === 'form_normalized')) assert.equal(printed.value, source, `${name}: bytes`);
    assert.equal(printed.value === source, expected.bytes_equal, name);
    const again = await fromMarkdown(printed.value, { id: 'page' });
    assert.equal(stable(withoutIds(again.value)), stable(withoutIds(read1.value)), `${name}: reads back equal`);
    // Every loss names a code of the guarantee table.
    for (const loss of [...read1.losses, ...printed.losses]) assert.ok(['not_expressible', 'form_normalized', 'docara_alert_title_required', 'foreign_hash_mismatch'].includes(loss.code), `${name}: ${loss.code}`);
  }
  for (const id of manifest.converters.markdown.filter((entry) => entry.startsWith('export-'))) {
    const entry = read(`markdown/${id}.json`);
    assert.deepEqual(await toMarkdown(entry.input.document), { value: entry.expect.markdown, losses: entry.expect.losses }, id);
  }
});

test('Markdown: Docara\'s alert vocabulary maps to the Framework\'s and back to the same bytes', async () => {
  const forms = [];
  for (const type of ['clear', 'info', 'success', 'warning', 'danger']) {
    for (const variant of [null, 'default', 'flat', 'outlined']) forms.push(`:::alert {type=${type}${variant ? ` variant=${variant}` : ''}}\n#### Заголовок\n\nТекст.\n:::\n`);
  }
  const status = { clear: undefined, info: 'info', success: 'success', warning: 'warning', danger: 'error' };
  for (const source of forms) {
    const { value, losses } = await fromMarkdown(source);
    assert.deepEqual(losses, [], source);
    const [alert] = value.root.slots.default;
    const [, type, variant] = /type=(\w+)(?: variant=(\w+))?/u.exec(source);
    assert.equal(alert.type, 'content.alert');
    assert.equal(alert.props?.status, status[type], source);
    assert.equal(alert.props?.appearance, variant ?? undefined, source);
    assert.deepEqual(alert.data.title, [{ type: 'text', value: 'Заголовок' }]);
    assert.equal((await toMarkdown(value)).value, source);
  }
  const titleless = await toMarkdown({ root: { id: 'w', type: 'content.alert', props: { status: 'warning' }, slots: { default: [{ id: 'b', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'Body.' }] } }] } } });
  assert.equal(titleless.value, ':::alert {type=warning}\nBody.\n:::\n', 'no title is invented');
  assert.deepEqual(titleless.losses.map(({ code }) => code), ['not_expressible', 'docara_alert_title_required']);
});

test('Markdown and Editor.js: every valid structured-content case goes out and comes back', async () => {
  let editorjs = 0;
  for (const entry of cases.filter(({ expect, input }) => expect.valid && input.document.profile === 'structured-content')) {
    const { document } = entry.input;
    // SIMAI -> Editor.js -> SIMAI: equal, ids included.
    const out = await toEditorJs(document);
    const back = await fromEditorJs(out.value, { id: document.id });
    const mismatch = out.losses.some(({ code }) => code === 'foreign_hash_mismatch');
    if (!mismatch && !out.losses.length) {
      assert.deepEqual(back.value.root.slots?.default ?? [], document.root.slots?.default ?? [], `${entry.id}: Editor.js`);
      editorjs += 1;
    }
    // SIMAI -> Markdown -> SIMAI: equal but for ids, when nothing is reported
    // beyond the ids themselves.
    const markdown = await toMarkdown(document);
    // A foreign Markdown block is read again by this module, so it is left out.
    if (markdown.losses.every(({ path }) => path === '$') && document.root.data?.title === undefined && !JSON.stringify(document).includes('content.foreign')) {
      const read1 = await fromMarkdown(markdown.value, { id: document.id });
      if (read1.losses.length) continue;
      assert.equal(stable(withoutIds(read1.value.root.slots?.default ?? [])), stable(withoutIds(normalizedTree(document.root.slots?.default ?? []))), `${entry.id}: Markdown\n${markdown.value}`);
    }
  }
  assert.ok(editorjs > 150, `${editorjs} cases through Editor.js`);
});

test('Editor.js: standard tools and foreign blocks come back as the same value', () => {
  for (const id of manifest.converters.editorjs) {
    const entry = read(`editorjs/${id}.json`);
    if (!entry.expect.losses.length) assert.equal(entry.expect.value_equal, true, id);
  }
  const foreign = read('editorjs/foreign-tools.json');
  assert.ok(foreign.expect.document.root.slots.default.every(({ type }) => type === 'content.foreign'));
  assert.deepEqual(foreign.expect.back.blocks, foreign.input.blocks);
});
