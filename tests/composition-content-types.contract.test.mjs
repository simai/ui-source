import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { resolveFieldKind, validateFieldKinds } from '../src/core/js/composition/fields.mjs';
import { createRegistry, extendRegistry, render, validate, validateEditorManifest } from '../src/core/js/composition/index.mjs';

// The first edition of the structured-content types (the content standard's
// step 3, owner's decision 2026-10-31): each validates against its schema, each
// is refused where it breaks it, and each renderer's HTML is pinned here.

const text = (value, marks) => ({ type: 'text', value, ...(marks ? { marks } : {}) });
const p = (id, value) => ({ id, type: 'content.paragraph', data: { content: [text(value)] } });
const documentOf = (...blocks) => ({
  schema: 'simai.composition.document',
  schema_version: 1,
  id: 'doc',
  profile: 'structured-content',
  root: { id: 'root', type: 'content.document', slots: { default: blocks } },
});
const codes = (result) => [...new Set(result.diagnostics.map(({ code }) => code))].sort();
const inner = (html) => html.replace(/^<article data-sf-composition-id="root">/u, '').replace(/<\/article>$/u, '');

const FIRST_EDITION = [
  'content.document', 'content.list', 'content.list-item', 'content.quote', 'content.code', 'content.divider',
  'content.table', 'content.figure', 'content.alert', 'content.details', 'content.tabs', 'content.tab',
  'content.steps', 'content.step', 'content.grid', 'content.card', 'content.media', 'content.html',
  'content.diagram', 'content.math', 'content.outlet', 'content.file',
];

// One valid block per type and the HTML its renderer draws.
const CASES = {
  'content.list': {
    node: { id: 'l', type: 'content.list', props: { ordered: true, start: 3 }, slots: { items: [
      { id: 'a', type: 'content.list-item', data: { content: [text('One')] }, slots: { default: [
        { id: 'n', type: 'content.list', slots: { items: [{ id: 'b', type: 'content.list-item', data: { content: [text('Nested', ['em'])] } }] } },
      ] } },
      { id: 'c', type: 'content.list-item', data: { content: [text('Two '), { type: 'component', name: 'kbd', props: { text: 'Enter' } }] } },
    ] } },
    html: '<ol start="3" data-sf-composition-id="l"><li data-sf-composition-id="a">One<ul data-sf-composition-id="n"><li data-sf-composition-id="b"><em>Nested</em></li></ul></li><li data-sf-composition-id="c">Two <kbd>Enter</kbd></li></ol>',
  },
  'content.quote': {
    node: { id: 'q', type: 'content.quote', slots: { default: [p('qp', 'Quoted.')] } },
    html: '<blockquote data-sf-composition-id="q"><p data-sf-composition-id="qp">Quoted.</p></blockquote>',
  },
  'content.code': {
    node: { id: 'k', type: 'content.code', data: { code: 'if (a < b) {}' }, props: { lang: 'js', numbers: true } },
    html: '<div class="sf-highlight" data-sf-composition-id="k"><pre><code class="language-js" data-lang="js" data-lines>if (a &lt; b) {}</code></pre></div>',
  },
  'content.divider': {
    node: { id: 'd', type: 'content.divider' },
    html: '<hr class="sf-divider sf-divider-horizontal" data-sf-composition-id="d">',
  },
  'content.table': {
    node: { id: 't', type: 'content.table', data: { caption: [text('Sizes')], rows: [[[text('Name')], [text('Size')]], [[text('A')], [text('1')]]] }, props: { header: 'both', align: ['start', 'end'] } },
    html: '<div class="table-frame" data-sf-composition-id="t"><table class="table"><caption>Sizes</caption><thead><tr><th scope="col">Name</th><th scope="col" style="text-align: end">Size</th></tr></thead><tbody><tr><th scope="row">A</th><td style="text-align: end">1</td></tr></tbody></table></div>',
  },
  'content.figure': {
    node: { id: 'f', type: 'content.figure', data: { src: '/a.webp', alt: 'A "scene"', width: 1280, height: 720, caption: [text('Caption')] }, props: { ratio: '21/9', fit: 'contain' } },
    html: '<figure class="sf-figure sf-figure--ratio-21x9 sf-figure--contain" data-sf-composition-id="f"><div class="sf-figure-media"><img src="/a.webp" alt="A &quot;scene&quot;" width="1280" height="720" loading="lazy" decoding="async"></div><figcaption class="sf-figure-caption">Caption</figcaption></figure>',
  },
  'content.alert': {
    node: { id: 'w', type: 'content.alert', data: { title: [text('Careful')] }, props: { status: 'error', appearance: 'flat' }, slots: { default: [p('wp', 'Body.')] } },
    html: '<div class="sf-alert sf-alert--error sf-alert--flat flex items-start" data-sf-composition-id="w"><i class="sf-icon" aria-hidden="true">error</i><div class="sf-alert-wrap flex flex-col flex-1"><div class="sf-alert-content flex flex-col flex-1"><div class="sf-alert-text">Careful</div><div class="sf-alert-supporting-text"><p data-sf-composition-id="wp">Body.</p></div></div></div></div>',
  },
  'content.details': {
    node: { id: 'x', type: 'content.details', data: { summary: [text('More')] }, props: { open: true, layout: 'lines' }, slots: { default: [p('xp', 'Hidden.')] } },
    html: '<details class="border-bottom-1 border-bottom-solid border-outline-variant p-y-1" data-sf-composition-id="x" open><summary class="weight-5 cursor-pointer">More</summary><div class="p-top-1"><p data-sf-composition-id="xp">Hidden.</p></div></details>',
  },
  'content.tabs': {
    node: { id: 'tb', type: 'content.tabs', data: { label: 'Install' }, slots: { tabs: [
      { id: 't1', type: 'content.tab', data: { label: 'npm' }, slots: { default: [p('t1p', 'One.')] } },
      { id: 't2', type: 'content.tab', data: { label: '<yarn>' }, slots: { default: [p('t2p', 'Two.')] } },
    ] } },
    html: '<div class="sf-tabs sf-tabs--underline flex flex-col" data-sf-composition-id="tb"><div class="sf-tabs-top-container"><div class="sf-tabs-top flex" aria-label="Install"><button type="button" class="sf-button sf-button--default sf-button--primary sf-button--size-1 selected"><span class="sf-button-text-container">npm</span></button><button type="button" class="sf-button sf-button--default sf-button--primary sf-button--size-1"><span class="sf-button-text-container">&lt;yarn&gt;</span></button></div></div><div class="sf-tabs-main-container"><div class="sf-tabs-main-tab selected" data-sf-composition-id="t1"><p data-sf-composition-id="t1p">One.</p></div><div class="sf-tabs-main-tab" data-sf-composition-id="t2" hidden><p data-sf-composition-id="t2p">Two.</p></div></div></div>',
  },
  'content.steps': {
    node: { id: 's', type: 'content.steps', props: { current: 2 }, slots: { steps: [
      { id: 's1', type: 'content.step', data: { title: [text('First')] }, slots: { default: [p('s1p', 'Do this.')] } },
      { id: 's2', type: 'content.step', data: { title: [text('Second')] } },
      { id: 's3', type: 'content.step', slots: { default: [p('s3p', 'No title.')] } },
    ] } },
    html: '<ol class="sf-procedure" data-sf-composition-id="s"><li class="sf-procedure-step sf-procedure-step--complete" data-sf-composition-id="s1"><div class="sf-procedure-title">First</div><div class="sf-procedure-content"><p data-sf-composition-id="s1p">Do this.</p></div></li><li class="sf-procedure-step sf-procedure-step--current" data-sf-composition-id="s2" aria-current="step"><div class="sf-procedure-title">Second</div><div class="sf-procedure-content"></div></li><li class="sf-procedure-step" data-sf-composition-id="s3"><div class="sf-procedure-content"><p data-sf-composition-id="s3p">No title.</p></div></li></ol>',
  },
  'content.grid': {
    node: { id: 'g', type: 'content.grid', props: { columns: 2, gap: 3 }, slots: { default: [
      { id: 'c1', type: 'content.card', slots: { default: [p('c1p', 'One.')] } },
      { id: 'c2', type: 'content.card', props: { variant: 'plain' }, slots: { default: [p('c2p', 'Two.')] } },
    ] } },
    html: '<div class="grid grid-col-1 md:grid-col-2 gap-3" data-sf-composition-id="g"><div class="min-w-0"><div class="sf-card" data-sf-composition-id="c1"><p data-sf-composition-id="c1p">One.</p></div></div><div class="min-w-0"><div class="sf-card sf-card--plain" data-sf-composition-id="c2"><p data-sf-composition-id="c2p">Two.</p></div></div></div>',
  },
  'content.card': {
    node: { id: 'cd', type: 'content.card', slots: { default: [{ id: 'ch', type: 'content.heading', data: { level: 4, content: [text('Title')] } }, p('cp', 'Text.')] } },
    html: '<div class="sf-card" data-sf-composition-id="cd"><h4 data-sf-composition-id="ch">Title</h4><p data-sf-composition-id="cp">Text.</p></div>',
  },
  'content.media': {
    node: { id: 'm', type: 'content.media', data: { src: 'https://cdn.test/m.webp', alt: '' }, props: { side: 'left', ratio: '4/3' }, slots: { default: [p('mp', 'Beside.')] } },
    html: '<div class="grid grid-col-1 md:grid-col-2 gap-3 items-cross-center" data-sf-composition-id="m"><figure class="sf-figure sf-figure--ratio-4x3"><div class="sf-figure-media"><img src="https://cdn.test/m.webp" alt="" loading="lazy" decoding="async"></div></figure><div class="min-w-0"><p data-sf-composition-id="mp">Beside.</p></div></div>',
  },
  'content.file': {
    node: { id: 'fl', type: 'content.file', data: { value: 'file-42', href: '/files/report.pdf?v=2', label: 'Report "Q3" <2026>', mime: 'application/pdf', size: 1468006 } },
    html: '<a class="sf-download-file" href="/files/report.pdf?v=2" download type="application/pdf" data-sf-composition-id="fl"><span class="sf-download-file__body sf-download-file-wrap"><span class="sf-download-file__main sf-download-file-container"><i class="sf-download-file__icon sf-icon" aria-hidden="true">picture_as_pdf</i><span class="sf-download-file__name sf-download-file-file-name">Report &quot;Q3&quot; &lt;2026&gt;</span></span><span class="sf-download-file__size sf-download-file-file-size">1.4 MB</span></span></a>',
  },
  'content.html': {
    node: { id: 'h', type: 'content.html', data: { markup: '<h2 class="x" style="color:red">Raw</h2><p onclick="steal()">Text <a href="javascript:alert(1)">bad</a> <a href="https://simai.io/a">good</a></p><script>window.pwned = 1</script><img src="x" onerror="window.pwned = 1"><style>p{}</style>' } },
    html: '<div data-sf-composition-id="h"><h2>Raw</h2><p>Text bad <a href="https://simai.io/a">good</a></p></div>',
  },
};

test('the registry carries the first edition, each type at 1.0.0 with a builtin or a registered renderer', () => {
  const types = new Map(BUILTIN_TYPE_MANIFESTS.map((manifest) => [manifest.type, manifest]));
  for (const type of FIRST_EDITION) {
    const manifest = types.get(type);
    assert.ok(manifest, type);
    assert.equal(manifest.version, '1.0.0', type);
    assert.equal(manifest.category, 'content', type);
    assert.equal(manifest.renderer.kind, ['content.diagram', 'content.math'].includes(type) ? 'registered' : 'builtin', type);
    assert.ok(manifest.profiles.includes(type === 'content.outlet' ? 'ui-layout' : 'structured-content'), type);
  }
  assert.deepEqual(types.get('content.outlet').profiles, ['ui-layout'], 'the outlet stands in a layout only');
  assert.deepEqual(types.get('content.document').profiles, ['structured-content'], 'the content root is no layout node');
  assert.equal(types.get('content.heading').version, '1.1.0', 'content.heading is unchanged');
  assert.equal(types.get('content.paragraph').version, '1.2.0', 'content.paragraph 1.2.0 prints its modifiers (G-39)');
});

test('the generated registry file is the builtins', async () => {
  const file = JSON.parse(await readFile(new URL('../src/core/contracts/composition-types.v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(file.entries.map(({ type, version }) => `${type}@${version}`), BUILTIN_TYPE_MANIFESTS.map(({ type, version }) => `${type}@${version}`));
});

test('every type validates and renders the pinned HTML', async () => {
  for (const [type, { node, html }] of Object.entries(CASES)) {
    const document = documentOf(node);
    assert.deepEqual(validate(document), { valid: true, diagnostics: [] }, type);
    const result = await render(document);
    assert.deepEqual(result.diagnostics, [], type);
    assert.equal(inner(result.html), html, type);
  }
});

test('content.html is cleaned at render: no script, no handler, no unsafe link survives', async () => {
  const { html } = await render(documentOf(CASES['content.html'].node));
  assert.doesNotMatch(html, /<script|onerror|onclick|javascript:|style=|<img|<style/iu);
  assert.match(html, /<a href="https:\/\/simai\.io\/a">good<\/a>/u);
});

test('content.details is the native element: open without a script, closed unless it says so', async () => {
  const open = await render(documentOf(CASES['content.details'].node));
  assert.match(open.html, /^<article[^>]*><details [^>]*\bopen><summary /u);
  const closed = await render(documentOf({ id: 'x', type: 'content.details', data: { summary: [text('More')] } }));
  assert.equal(inner(closed.html), '<details class="bg-surface-0 border-1 border-solid border-outline-variant radius-2 p-2" data-sf-composition-id="x"><summary class="weight-5 cursor-pointer">More</summary><div class="p-top-1"></div></details>');
});

test('defaults render without their props: an unordered list, a neutral alert, three columns, a code block without a title', async () => {
  const cases = [
    [{ id: 'l', type: 'content.list', slots: { items: [{ id: 'i', type: 'content.list-item', data: { content: [text('x')] } }] } }, '<ul data-sf-composition-id="l"><li data-sf-composition-id="i">x</li></ul>'],
    [{ id: 'a', type: 'content.alert' }, '<div class="sf-alert sf-alert--neutral sf-alert--default flex items-start" data-sf-composition-id="a"><i class="sf-icon" aria-hidden="true">info</i><div class="sf-alert-wrap flex flex-col flex-1"><div class="sf-alert-content flex flex-col flex-1"></div></div></div>'],
    [{ id: 'g', type: 'content.grid', slots: { default: [p('gp', 'x')] } }, '<div class="grid grid-col-1 md:grid-col-2 lg:grid-col-3 gap-2" data-sf-composition-id="g"><div class="min-w-0"><p data-sf-composition-id="gp">x</p></div></div>'],
    [{ id: 'k', type: 'content.code', data: { code: 'plain' }, props: { title: 'a <b>' } }, '<figure class="flex flex-col gap-1/2 m-0" data-sf-composition-id="k"><figcaption class="text-1/2 weight-5 color-on-surface-variant">a &lt;b&gt;</figcaption><div class="sf-highlight"><pre><code>plain</code></pre></div></figure>'],
    [{ id: 'f', type: 'content.figure', data: { src: './a.png', alt: 'A' } }, '<figure class="sf-figure" data-sf-composition-id="f"><div class="sf-figure-media"><img src="./a.png" alt="A" loading="lazy" decoding="async"></div></figure>'],
    [{ id: 'm', type: 'content.media', data: { src: './a.png', alt: 'A' } }, '<div class="grid grid-col-1 md:grid-col-2 gap-3 items-cross-center" data-sf-composition-id="m"><div class="min-w-0"></div><figure class="sf-figure sf-figure--ratio-16x9"><div class="sf-figure-media"><img src="./a.png" alt="A" loading="lazy" decoding="async"></div></figure></div>'],
    [{ id: 's', type: 'content.steps', props: { layout: 'list' }, slots: { steps: [{ id: 's1', type: 'content.step' }] } }, '<ol class="sf-procedure sf-procedure--list" data-sf-composition-id="s"><li class="sf-procedure-step" data-sf-composition-id="s1"><div class="sf-procedure-content"></div></li></ol>'],
    [{ id: 't', type: 'content.table', data: { rows: [[[text('a')], [text('b')]]] }, props: { header: 'none' } }, '<div class="table-frame" data-sf-composition-id="t"><table class="table"><tbody><tr><td>a</td><td>b</td></tr></tbody></table></div>'],
    [{ id: 'fl', type: 'content.file', data: { href: 'https://cdn.test/files/Price%20list.xlsx#sheet' } }, '<a class="sf-download-file" href="https://cdn.test/files/Price%20list.xlsx#sheet" download data-sf-composition-id="fl"><span class="sf-download-file__body sf-download-file-wrap"><span class="sf-download-file__main sf-download-file-container"><i class="sf-download-file__icon sf-icon" aria-hidden="true">download</i><span class="sf-download-file__name sf-download-file-file-name">Price list.xlsx</span></span></span></a>'],
  ];
  for (const [node, html] of cases) {
    const result = await render(documentOf(node));
    assert.deepEqual(result.diagnostics, [], node.type);
    assert.equal(inner(result.html), html, node.type);
  }
  const titled = await render({ ...documentOf(p('x', 'y')), root: { id: 'root', type: 'content.document', data: { title: 'Guide & <notes>' }, slots: { default: [p('x', 'y')] } } });
  assert.equal(titled.html, '<article data-sf-composition-id="root"><h1>Guide &amp; &lt;notes&gt;</h1><p data-sf-composition-id="x">y</p></article>');
});

test('each type refuses what its schema does not allow', () => {
  const NEGATIVE = [
    [{ id: 'l', type: 'content.list', slots: { items: [] } }, ['slot_cardinality']],
    [{ id: 'l', type: 'content.list', props: { ordered: 'yes' }, slots: { items: [{ id: 'i', type: 'content.list-item', data: { content: [] } }] } }, ['schema_type']],
    [{ id: 'l', type: 'content.list', slots: { items: [p('i', 'not an item')] } }, ['slot_child_type_forbidden']],
    [{ id: 'i', type: 'content.list-item', data: {} }, ['content_parent_invalid', 'schema_required']],
    [{ id: 'q', type: 'content.quote' }, ['slot_required']],
    [{ id: 'k', type: 'content.code', data: { code: 'x' }, props: { lang: 'Java Script' } }, ['schema_pattern']],
    [{ id: 'k', type: 'content.code', data: {} }, ['schema_required']],
    [{ id: 'd', type: 'content.divider', data: { label: 'x' } }, ['schema_additional_property']],
    [{ id: 't', type: 'content.table', data: { rows: [] } }, ['schema_min_items']],
    [{ id: 't', type: 'content.table', data: { rows: [[[text('a')]]] }, props: { header: 'top' } }, ['schema_enum']],
    [{ id: 't', type: 'content.table', data: { rows: [[[{ type: 'link', href: 'javascript:x', children: [text('a')] }]]] } }, ['unsafe_url']],
    [{ id: 'f', type: 'content.figure', data: { src: 'javascript:alert(1)', alt: '' } }, ['unsafe_url']],
    [{ id: 'f', type: 'content.figure', data: { src: '/a.png' } }, ['schema_required']],
    [{ id: 'f', type: 'content.figure', data: { src: '/a.png', alt: '' }, props: { ratio: '16x9' } }, ['schema_enum']],
    [{ id: 'w', type: 'content.alert', props: { status: 'danger' } }, ['schema_enum']],
    [{ id: 'w', type: 'content.alert', props: { appearance: 'outline' } }, ['schema_enum']],
    [{ id: 'w', type: 'content.alert', data: { title: [{ type: 'link', href: 'data:text/html,x', children: [text('a')] }] } }, ['unsafe_url']],
    [{ id: 'x', type: 'content.details', data: {} }, ['schema_required']],
    [{ id: 'x', type: 'content.details', data: { summary: [text('s')] }, props: { open: 'true' } }, ['schema_type']],
    [{ id: 'tb', type: 'content.tabs', slots: { tabs: [p('t', 'not a tab')] } }, ['slot_child_type_forbidden']],
    [{ id: 'tb', type: 'content.tabs', slots: { tabs: [] } }, ['slot_cardinality']],
    [{ id: 't', type: 'content.tab', data: { label: 'x' } }, ['content_parent_invalid']],
    [{ id: 'tb', type: 'content.tabs', slots: { tabs: [{ id: 't', type: 'content.tab', data: { label: '' } }] } }, ['schema_min_length']],
    [{ id: 's', type: 'content.steps', props: { current: 0 }, slots: { steps: [{ id: 's1', type: 'content.step' }] } }, ['schema_minimum']],
    [{ id: 's1', type: 'content.step' }, ['content_parent_invalid']],
    [{ id: 'c', type: 'content.card', slots: { default: [{ id: 'cc', type: 'content.card', slots: { default: [{ id: 'i', type: 'content.list-item', data: { content: [] } }] } }] } }, ['content_parent_invalid']],
    [{ id: 'g', type: 'content.grid', props: { columns: 5 }, slots: { default: [p('x', 'y')] } }, ['schema_maximum']],
    [{ id: 'g', type: 'content.grid', slots: { default: [{ id: 'r', type: 'layout.section' }] } }, ['slot_child_category_forbidden', 'type_profile_unsupported']],
    [{ id: 'c', type: 'content.card', props: { variant: 'outlined' } }, ['schema_enum']],
    [{ id: 'm', type: 'content.media', data: { src: '//evil.test/a.png', alt: '' } }, ['unsafe_url']],
    [{ id: 'm', type: 'content.media', data: { src: '/a.png', alt: '' }, props: { side: 'top' } }, ['schema_enum']],
    [{ id: 'h', type: 'content.html', data: { html: '<p>x</p>' } }, ['executable_or_secret_field_forbidden', 'schema_additional_property', 'schema_required']],
    [{ id: 'dg', type: 'content.diagram', data: { source: 'graph LR' }, props: { engine: 'plantuml' } }, ['schema_enum']],
    [{ id: 'mt', type: 'content.math', data: {} }, ['schema_required']],
    [{ id: 'o', type: 'content.outlet' }, ['type_profile_unsupported']],
    [{ id: 'fl', type: 'content.file', data: { label: 'No address' } }, ['schema_required']],
    [{ id: 'fl', type: 'content.file', data: { href: 'javascript:alert(1)' } }, ['unsafe_url']],
    [{ id: 'fl', type: 'content.file', data: { href: '//evil.test/a.pdf' } }, ['unsafe_url']],
    [{ id: 'fl', type: 'content.file', data: { href: 'data:application/pdf;base64,AA' } }, ['unsafe_url']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', mime: 'Application/PDF' } }, ['schema_pattern']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', mime: 'application/pdf; charset=binary' } }, ['schema_pattern']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', size: -1 } }, ['schema_minimum']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', size: 1.5 } }, ['schema_type']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', size: '12 KB' } }, ['schema_type']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', label: '' } }, ['schema_min_length']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf', name: 'a.pdf' } }, ['schema_additional_property']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf' }, props: { download: true } }, ['schema_additional_property']],
    [{ id: 'fl', type: 'content.file', data: { href: '/a.pdf' }, slots: { default: [] } }, ['leaf_slots_forbidden', 'slot_unknown']],
  ];
  for (const [node, expected] of NEGATIVE) {
    const result = validate(documentOf(node));
    assert.equal(result.valid, false, `${node.type} ${JSON.stringify(node)}`);
    assert.deepEqual(codes(result), expected, `${node.type} ${JSON.stringify(node)}`);
  }
});

test('a content Document is valid from its root and a layout may hold content blocks', () => {
  const layout = {
    schema: 'simai.composition.document', schema_version: 1, id: 'layout', profile: 'ui-layout',
    root: { id: 'page', type: 'layout.page', slots: { default: [CASES['content.card'].node, { id: 'o', type: 'content.outlet' }] } },
  };
  assert.deepEqual(validate(layout), { valid: true, diagnostics: [] });
  const twice = structuredClone(layout);
  twice.root.slots.default.push({ id: 'o2', type: 'content.outlet' });
  assert.deepEqual(codes(validate(twice)), ['outlet_duplicate']);
  const asContent = { ...layout, profile: 'structured-content' };
  assert.ok(codes(validate(asContent)).includes('type_profile_unsupported'), 'layout.page is no content root');
});

test('content.outlet draws the page content in a layout, with its assets', async () => {
  const layout = {
    schema: 'simai.composition.document', schema_version: 1, id: 'layout', profile: 'ui-layout',
    root: { id: 'regions', type: 'layout.regions', slots: { regions: [
      { id: 'top', type: 'layout.region', props: { name: 'top', landmark: 'banner' }, slots: { default: [p('brand', 'Brand')] } },
      { id: 'main', type: 'layout.region', props: { name: 'main', landmark: 'main' }, slots: { default: [{ id: 'outlet', type: 'content.outlet' }] } },
    ] } },
  };
  const content = documentOf(CASES['content.figure'].node);
  const result = await render(layout, { content });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.html, /<main class="sf-composition-region"[^>]*><div data-sf-outlet="" data-sf-composition-id="outlet"><article data-sf-composition-id="root"><figure class="sf-figure /u);
  assert.ok(result.assets.includes('component/figure'), 'the page content brings its assets');
  const empty = await render(layout);
  assert.match(empty.html, /<div data-sf-outlet="" data-sf-composition-id="outlet"><\/div>/u);
  const wrong = await render(layout, { content: layout });
  assert.deepEqual(wrong.diagnostics.map(({ code }) => code), ['outlet_content_invalid']);
  const bad = await render(layout, { content: documentOf({ id: 'f', type: 'content.figure', data: { src: 'javascript:x', alt: '' } }) });
  assert.deepEqual(bad.diagnostics.map(({ code, path }) => `${code} ${path}`), ['unsafe_url $.content.root.slots.default[0].data.src']);
  assert.match(bad.html, /<div data-sf-outlet="" data-sf-composition-id="outlet"><\/div>/u, 'invalid content draws nothing');
});

test('diagram and math draw through a renderer the host registers, and report its absence', async () => {
  const document = documentOf(
    { id: 'dg', type: 'content.diagram', data: { source: 'graph LR\n A --> B' }, props: { title: 'Flow' } },
    { id: 'mt', type: 'content.math', data: { source: 'e^{i\\pi} + 1 = 0' }, props: { label: 'Euler' } },
  );
  assert.deepEqual(validate(document), { valid: true, diagnostics: [] });
  const bare = await render(document);
  assert.deepEqual(bare.diagnostics.map(({ code, path }) => `${code} ${path}`), ['renderer_unavailable node:dg', 'renderer_unavailable node:mt']);
  assert.deepEqual(bare.assets, ['composition/diagram', 'composition/math'], 'the host learns which assets to load');
  const registry = extendRegistry([], {
    'content.diagram': ({ node }) => `<figure data-engine="${node.props.engine ?? 'mermaid'}">${node.data.source.length}</figure>`,
    'content.math': ({ node }) => `<div role="math" aria-label="${node.props.label}"></div>`,
  });
  const hosted = await render(document, { registry });
  assert.deepEqual(hosted.diagnostics, []);
  assert.equal(inner(hosted.html), '<figure data-engine="mermaid">17</figure><div role="math" aria-label="Euler"></div>');
});

test('content.file reads its size in the Document\'s language and its icon from the media type', async () => {
  const file = (data) => ({ id: 'fl', type: 'content.file', data: { href: '/a', ...data } });
  const drawn = async (data, locale) => {
    const { html, diagnostics } = await render({ ...documentOf(file(data)), ...(locale ? { locale } : {}) });
    assert.deepEqual(diagnostics, []);
    return { icon: html.match(/aria-hidden="true">([^<]*)</u)[1], size: html.match(/file-size">([^<]*)</u)?.[1] ?? null, name: html.match(/file-name">([^<]*)</u)[1] };
  };
  assert.deepEqual(await drawn({ size: 0 }), { icon: 'download', size: '0 B', name: 'a' });
  assert.deepEqual(await drawn({ size: 2048, mime: 'image/png' }), { icon: 'image', size: '2 KB', name: 'a' });
  assert.deepEqual(await drawn({ size: 1468006, mime: 'text/csv' }, 'ru'), { icon: 'table_chart', size: '1,4 МБ', name: 'a' });
  assert.deepEqual(await drawn({ size: 5 * 1024 ** 3, mime: 'video/mp4' }, 'ru-RU'), { icon: 'movie', size: '5 ГБ', name: 'a' });
  assert.deepEqual(await drawn({ size: 1536, mime: 'audio/mpeg' }, 'de'), { icon: 'audio_file', size: '1,5 KB', name: 'a' });
  assert.deepEqual(await drawn({ mime: 'application/x-unknown' }), { icon: 'download', size: null, name: 'a' });
  const assets = (await render(documentOf(file({})))).assets;
  assert.deepEqual(assets, ['component/download-file']);
});

test('the fixture Document holding every type validates', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/composition/structured-content.json', import.meta.url), 'utf8'));
  assert.deepEqual(validate(fixture), { valid: true, diagnostics: [] });
  const used = new Set();
  const visit = (node) => { used.add(node.type); Object.values(node.slots || {}).flat().forEach(visit); };
  visit(fixture.root);
  for (const type of FIRST_EDITION.filter((entry) => entry !== 'content.outlet')) assert.ok(used.has(type), type);
});

test('editor manifests bind each parameterised type and map every field to one kind', () => {
  const registry = createRegistry();
  const withEditor = ['content.list', 'content.code', 'content.table', 'content.figure', 'content.alert', 'content.details', 'content.tabs', 'content.tab', 'content.steps', 'content.grid', 'content.card', 'content.media', 'content.file', 'content.diagram', 'content.math'];
  for (const type of withEditor) {
    const manifest = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === type);
    assert.ok(manifest, type);
    assert.deepEqual(validateEditorManifest(manifest, registry.types.get(type)), { valid: true, diagnostics: [] }, type);
    assert.deepEqual(validateFieldKinds(manifest), [], type);
    for (const field of manifest.fields) assert.ok(resolveFieldKind(field), `${type}.${field.key}`);
  }
  const alert = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'content.alert');
  assert.deepEqual(alert.fields.map(({ key, choices, default: value }) => [key, choices, value]), [
    ['status', ['neutral', 'info', 'success', 'warning', 'error'], 'neutral'],
    ['appearance', ['default', 'outlined', 'flat'], 'default'],
  ], 'the alert speaks sf-alert\'s words');
  const file = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'content.file');
  assert.deepEqual(file.fields.map(({ key, plane, constraints }) => [key, plane, constraints.max_length]), [['label', 'data', 300], ['href', 'data', 2048]], 'the file names its label and its address');
  // A form drawn from the manifest alone sets every field the type requires
  // (simai/ui-source#64): figure and media name their src.
  for (const type of ['content.figure', 'content.media']) {
    const manifest = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === type);
    const src = manifest.fields.find((entry) => entry.key === 'src');
    assert.deepEqual([src.plane, src.target, resolveFieldKind(src).kind, src.constraints.max_length], ['data', 'src', 'text', 2048], type);
    const required = registry.types.get(type).data_schema.required || [];
    const offered = new Set(manifest.fields.filter((entry) => entry.plane === 'data').map((entry) => entry.target));
    for (const key of required) assert.ok(offered.has(key), `${type} offers data.${key}`);
  }
  for (const type of ['content.document', 'content.quote', 'content.divider', 'content.list-item', 'content.step', 'content.html', 'content.outlet']) {
    assert.equal(BUILTIN_EDITOR_MANIFESTS.some((entry) => entry.type === type), false, `${type} has no parameters`);
  }
});

test('every class a renderer writes is a SIMAI Framework class: a utility rule or a component sheet', async () => {
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');
  const vm = await import('node:vm');
  const root = new URL('../', import.meta.url);
  const SF = { RuleLoader: {} };
  for (const name of readdirSync(new URL('src/utility/', root))) {
    for (const variant of ['default', 'md', 'lg']) {
      const file = new URL(`src/utility/${name}/${variant}/rule.js`, root);
      if (existsSync(file)) vm.runInNewContext(readFileSync(file, 'utf8'), { SF, RegExp });
    }
  }
  const utilities = Object.values(SF.RuleLoader).filter((rule) => rule instanceof RegExp);
  const sheets = (folder) => readdirSync(new URL(`src/component/${folder}/scss/`, root)).map((file) => readFileSync(new URL(`src/component/${folder}/scss/${file}`, root), 'utf8')).join('\n');
  const componentSheets = ['alerts', 'card', 'contentDivider', 'download-file', 'figure', 'procedure', 'tabs', 'buttons', 'icons'].map(sheets).join('\n') + ['highlight/js/index.js', 'tabs/js/_tabs.js'].map((file) => readFileSync(new URL(`src/component/${file}`, root), 'utf8')).join('\n');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/composition/structured-content.json', import.meta.url), 'utf8'));
  const documents = [fixture, ...Object.values(CASES).map(({ node }) => documentOf(node))];
  const classes = new Set();
  for (const document of documents) {
    const { html } = await render(document, { registry: extendRegistry([], { 'content.diagram': () => '', 'content.math': () => '' }) });
    for (const [, list] of html.matchAll(/class="([^"]*)"/gu)) for (const name of list.split(/\s+/u)) if (name) classes.add(name);
  }
  for (const name of classes) {
    if (/^language-/u.test(name)) continue;
    if (name.startsWith('sf-') || name === 'selected') {
      if (name !== 'selected') assert.ok(componentSheets.includes(name.replace('/', '\\/')) || componentSheets.includes(name), `${name} is drawn by a component sheet`);
      continue;
    }
    assert.ok(utilities.some((rule) => rule.test(name)), `${name} names a utility rule`);
  }
});
