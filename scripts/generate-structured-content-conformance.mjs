#!/usr/bin/env node
// Writes, or with --check verifies, the conformance kit of structured content
// (contracts/conformance/structured-content): the Documents any renderer of
// structured content must draw, and what it must draw, as the SIMAI Framework's
// JS renderer draws them. The inputs are written here; the expectations are
// the renderer's, so a change of behaviour shows as a drift of the kit.
//
//   node scripts/generate-structured-content-conformance.mjs          write
//   node scripts/generate-structured-content-conformance.mjs --check  verify

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { render, validate } from '../src/core/js/composition/index.mjs';
import { fromMarkdown, toMarkdown } from '../src/core/js/composition/markdown.mjs';
import { fromEditorJs, toEditorJs } from '../src/core/js/composition/editorjs.mjs';
import { stable, withoutIds } from '../src/core/js/composition/foreign.mjs';
import { canonicalHtml } from '../contracts/conformance/structured-content/normalize-html.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kit = resolve(root, 'contracts/conformance/structured-content');
const KIT_VERSION = '2.2.0';

// ---------------------------------------------------------------------------
// Building blocks

const text = (value, marks) => ({ type: 'text', value, ...(marks ? { marks } : {}) });
const link = (href, ...children) => ({ type: 'link', href, children });
const br = (marks) => ({ type: 'break', ...(marks ? { marks } : {}) });
const atom = (name, props) => ({ type: 'component', name, ...(props ? { props } : {}) });
const p = (id, ...content) => ({ id, type: 'content.paragraph', data: { content: content.length ? content.map((entry) => (typeof entry === 'string' ? text(entry) : entry)) : [text('Text.')] } });
const item = (id, value, children) => ({ id, type: 'content.list-item', data: { content: [text(value)] }, ...(children ? { slots: { default: children } } : {}) });
const content = (blocks, extra = {}) => ({
  schema: 'simai.composition.document',
  schema_version: 1,
  id: 'page',
  profile: 'structured-content',
  ...extra,
  root: { id: 'root', type: 'content.document', ...(blocks === null ? {} : { slots: { default: blocks } }) },
});
const layout = (children) => ({
  schema: 'simai.composition.document',
  schema_version: 1,
  id: 'layout',
  profile: 'ui-layout',
  root: { id: 'frame', type: 'layout.page', slots: { default: children } },
});

const cases = [];
const add = (id, summary, covers, document, extra = {}) => {
  if (cases.some((entry) => entry.id === id)) throw new Error(`conformance_case_duplicate:${id}`);
  cases.push({ id, summary, covers, document, ...extra });
};
const block = (id, summary, type, node, extra = {}) => add(id, summary, [type], content([node]), extra);

// ---------------------------------------------------------------------------
// Every type, with its defaults and with each parameter value

add('document-empty', 'A Document with no blocks draws an empty article.', ['content.document'], content(null));
add('document-title', 'The title is the article\'s h1, escaped as text.', ['content.document'], { ...content([p('a', 'Body.')]), root: { id: 'root', type: 'content.document', data: { title: 'Guide & <notes> "one"' }, slots: { default: [p('a', 'Body.')] } } });
add('document-locale', 'A Document\'s locale changes nothing a block without words of its own draws.', ['content.document'], content([p('a', 'Body.')], { locale: 'ru' }));

block('heading-default', 'A heading without a level is an h2.', 'content.heading', { id: 'h', type: 'content.heading', data: { content: [text('Title')] } });
for (const level of [1, 2, 3, 4, 5, 6]) block(`heading-level-${level}`, `A heading of level ${level} is an h${level}.`, 'content.heading', { id: 'h', type: 'content.heading', data: { level, content: [text(`Level ${level}`)] } });
block('paragraph', 'A paragraph is a p.', 'content.paragraph', p('p', 'One paragraph.'));
block('paragraph-empty', 'A paragraph with no runs is an empty p.', 'content.paragraph', { id: 'p', type: 'content.paragraph', data: { content: [] } });

block('list-default', 'A list without parameters is unordered.', 'content.list', { id: 'l', type: 'content.list', slots: { items: [item('a', 'One'), item('b', 'Two')] } });
block('list-ordered', 'An ordered list is an ol.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: true }, slots: { items: [item('a', 'One'), item('b', 'Two')] } });
block('list-ordered-false', 'ordered false is the default: a ul.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: false }, slots: { items: [item('a', 'One')] } });
block('list-start-1', 'start 1 is the default and is not written.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: true, start: 1 }, slots: { items: [item('a', 'One')] } });
block('list-start', 'An ordered list starting elsewhere says so.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: true, start: 3 }, slots: { items: [item('a', 'Three')] } });
block('list-start-max', 'The largest start is written as it is.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: true, start: 1000000 }, slots: { items: [item('a', 'Last')] } });
block('list-start-unordered', 'start means nothing to an unordered list.', 'content.list', { id: 'l', type: 'content.list', props: { start: 5 }, slots: { items: [item('a', 'One')] } });
block('list-nested', 'An item holds a nested list after its own line.', 'content.list-item', { id: 'l', type: 'content.list', slots: { items: [item('a', 'One', [{ id: 'n', type: 'content.list', props: { ordered: true }, slots: { items: [item('b', 'Nested')] } }]), item('c', 'Two')] } });
block('list-item-blocks', 'An item holds paragraphs and code under its line.', 'content.list-item', { id: 'l', type: 'content.list', slots: { items: [item('a', 'Step', [p('ap', 'More about it.'), { id: 'ak', type: 'content.code', data: { code: 'run' } }])] } });
block('list-item-inline', 'An item\'s line is inline content.', 'content.list-item', { id: 'l', type: 'content.list', slots: { items: [{ id: 'a', type: 'content.list-item', data: { content: [text('Press '), atom('kbd', { text: 'Enter' }), text(' then ', ['em']), link('#next', text('go on'))] } }] } });

block('quote', 'A quote is a blockquote of blocks.', 'content.quote', { id: 'q', type: 'content.quote', slots: { default: [p('a', 'Quoted.'), p('b', 'Twice.')] } });

block('code-default', 'Code without parameters: pre and code, no language.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'plain text' } });
block('code-lang', 'The language is a class and a data attribute.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'const a = 1;' }, props: { lang: 'js' } });
block('code-lang-symbols', 'A language name may hold + # . _ -.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'int main() {}' }, props: { lang: 'c++' } });
block('code-numbers', 'numbers true asks for line numbers.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'a\nb' }, props: { numbers: true } });
block('code-numbers-false', 'numbers false is the default and writes nothing.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'a' }, props: { numbers: false } });
block('code-title', 'A title makes a figure with a caption, escaped.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'x' }, props: { title: 'a <b> & "c"' } });
block('code-all', 'Language, title and numbers together.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'echo 1' }, props: { lang: 'bash', title: 'install.sh', numbers: true } });
block('code-escaped', 'Code is text: markup in it is escaped, white space kept.', 'content.code', { id: 'k', type: 'content.code', data: { code: '<script>alert("x")</script>\n  if (a < b && c > d) {}\n' } });
block('code-empty', 'Empty code is an empty pre.', 'content.code', { id: 'k', type: 'content.code', data: { code: '' } });

block('divider', 'A divider is the divider component\'s hr.', 'content.divider', { id: 'd', type: 'content.divider' });

const rows = [[[text('Name')], [text('Size')], [text('Note')]], [[text('A')], [text('1')], [text('first', ['em'])]], [[text('B')], [text('2')], [link('/b', text('second'))]]];
block('table-default', 'The first row is the header by default.', 'content.table', { id: 't', type: 'content.table', data: { rows } });
for (const header of ['row', 'column', 'both', 'none']) block(`table-header-${header}`, `header ${header}.`, 'content.table', { id: 't', type: 'content.table', data: { rows }, props: { header } });
block('table-caption', 'A caption is inline content.', 'content.table', { id: 't', type: 'content.table', data: { caption: [text('Sizes', ['strong'])], rows } });
block('table-align', 'Alignment start writes nothing; center and end are styles on their cells.', 'content.table', { id: 't', type: 'content.table', data: { rows }, props: { align: ['start', 'center', 'end'] } });
block('table-align-short', 'Columns past the alignment list take the start.', 'content.table', { id: 't', type: 'content.table', data: { rows }, props: { align: ['end'] } });
block('table-header-only', 'A table of one header row has no body.', 'content.table', { id: 't', type: 'content.table', data: { rows: [[[text('Only')]]] } });
block('table-empty-cell', 'A cell may be empty.', 'content.table', { id: 't', type: 'content.table', data: { rows: [[[text('a')], []]] }, props: { header: 'none' } });

const image = { src: '/images/a.webp', alt: 'A scene' };
block('figure-default', 'A figure without parameters: no ratio, cover.', 'content.figure', { id: 'f', type: 'content.figure', data: image });
block('figure-size', 'Width and height go on the image.', 'content.figure', { id: 'f', type: 'content.figure', data: { ...image, width: 1280, height: 720 } });
block('figure-caption', 'A caption is inline content in figcaption.', 'content.figure', { id: 'f', type: 'content.figure', data: { ...image, caption: [text('Photo by '), link('https://simai.io', text('SIMAI'))] } });
block('figure-alt-empty', 'An empty alt marks a decorative image.', 'content.figure', { id: 'f', type: 'content.figure', data: { src: './a.png', alt: '' } });
block('figure-alt-escaped', 'The alt is escaped as an attribute.', 'content.figure', { id: 'f', type: 'content.figure', data: { src: './a.png', alt: 'A "quoted" <scene> & more' } });
for (const ratio of ['auto', '1/1', '4/3', '3/2', '16/9', '21/9']) block(`figure-ratio-${ratio.replace('/', 'x')}`, `ratio ${ratio}.`, 'content.figure', { id: 'f', type: 'content.figure', data: image, props: { ratio } });
for (const fit of ['cover', 'contain']) block(`figure-fit-${fit}`, `fit ${fit}.`, 'content.figure', { id: 'f', type: 'content.figure', data: image, props: { fit } });

block('alert-default', 'An alert without parameters: neutral, default, its icon, no title, no body.', 'content.alert', { id: 'w', type: 'content.alert' });
for (const status of ['neutral', 'info', 'success', 'warning', 'error']) block(`alert-status-${status}`, `status ${status} and its icon.`, 'content.alert', { id: 'w', type: 'content.alert', data: { title: [text('Title')] }, props: { status }, slots: { default: [p('wp', 'Body.')] } });
for (const appearance of ['default', 'outlined', 'flat']) block(`alert-appearance-${appearance}`, `appearance ${appearance}.`, 'content.alert', { id: 'w', type: 'content.alert', data: { title: [text('Title')] }, props: { appearance } });
block('alert-body-only', 'An alert may hold a body without a title.', 'content.alert', { id: 'w', type: 'content.alert', props: { status: 'info' }, slots: { default: [p('wp', 'Body only.')] } });

block('details-default', 'Details without parameters: closed, on a surface.', 'content.details', { id: 'x', type: 'content.details', data: { summary: [text('More')] }, slots: { default: [p('xp', 'Hidden.')] } });
block('details-open', 'open true writes the open attribute.', 'content.details', { id: 'x', type: 'content.details', data: { summary: [text('More')] }, props: { open: true }, slots: { default: [p('xp', 'Shown.')] } });
block('details-open-false', 'open false is the default.', 'content.details', { id: 'x', type: 'content.details', data: { summary: [text('More')] }, props: { open: false } });
for (const value of ['surface', 'lines']) block(`details-layout-${value}`, `layout ${value}.`, 'content.details', { id: 'x', type: 'content.details', data: { summary: [text('More', ['strong'])] }, props: { layout: value }, slots: { default: [p('xp', 'Body.')] } });

const tab = (id, label, ...blocks) => ({ id, type: 'content.tab', data: { label }, slots: { default: blocks } });
block('tabs-one', 'One tab: selected, its panel shown.', 'content.tab', { id: 'tb', type: 'content.tabs', slots: { tabs: [tab('t1', 'Only', p('t1p', 'One.'))] } });
block('tabs-label', 'The row\'s label is its accessible name; tab labels are escaped; later panels hidden.', 'content.tabs', { id: 'tb', type: 'content.tabs', data: { label: 'Install "it"' }, slots: { tabs: [tab('t1', 'npm', p('t1p', 'One.')), tab('t2', '<yarn>', p('t2p', 'Two.')), tab('t3', 'pnpm')] } });

const step = (id, title, ...blocks) => ({ id, type: 'content.step', ...(title ? { data: { title: [text(title)] } } : {}), ...(blocks.length ? { slots: { default: blocks } } : {}) });
const steps3 = [step('s1', 'First', p('s1p', 'Do this.')), step('s2', 'Second'), step('s3', null, p('s3p', 'No title.'))];
block('steps-default', 'Steps without parameters: a timeline, none current.', 'content.steps', { id: 's', type: 'content.steps', slots: { steps: steps3 } });
for (const current of [1, 2, 3]) block(`steps-current-${current}`, `current ${current}: the steps before it complete.`, 'content.steps', { id: 's', type: 'content.steps', props: { current }, slots: { steps: steps3 } });
block('steps-current-past-end', 'A current step past the last marks every step complete.', 'content.steps', { id: 's', type: 'content.steps', props: { current: 100 }, slots: { steps: steps3 } });
for (const value of ['timeline', 'list']) block(`steps-layout-${value}`, `layout ${value}.`, 'content.step', { id: 's', type: 'content.steps', props: { layout: value }, slots: { steps: [step('s1', 'One')] } });

const cells = [p('g1', 'One.'), p('g2', 'Two.')];
block('grid-default', 'A grid without parameters: three columns, gap 2.', 'content.grid', { id: 'g', type: 'content.grid', slots: { default: cells } });
for (const columns of [1, 2, 3, 4]) block(`grid-columns-${columns}`, `columns ${columns}, one column on a phone.`, 'content.grid', { id: 'g', type: 'content.grid', props: { columns }, slots: { default: cells } });
for (const gap of [0, 1, 2, 3, 4]) block(`grid-gap-${gap}`, `gap ${gap}.`, 'content.grid', { id: 'g', type: 'content.grid', props: { gap }, slots: { default: cells } });

block('card-default', 'A card without parameters.', 'content.card', { id: 'c', type: 'content.card', slots: { default: [{ id: 'ch', type: 'content.heading', data: { level: 4, content: [text('Title')] } }, p('cp', 'Text.')] } });
for (const variant of ['default', 'plain']) block(`card-variant-${variant}`, `variant ${variant}.`, 'content.card', { id: 'c', type: 'content.card', props: { variant }, slots: { default: [p('cp', 'Text.')] } });
block('card-empty', 'A card may be empty.', 'content.card', { id: 'c', type: 'content.card' });

block('media-default', 'Media without parameters: the picture on the right, 16/9.', 'content.media', { id: 'm', type: 'content.media', data: image, slots: { default: [p('mp', 'Beside.')] } });
for (const side of ['left', 'right']) block(`media-side-${side}`, `side ${side}.`, 'content.media', { id: 'm', type: 'content.media', data: image, props: { side }, slots: { default: [p('mp', 'Beside.')] } });
for (const ratio of ['1/1', '4/3', '3/2', '16/9', '21/9']) block(`media-ratio-${ratio.replace('/', 'x')}`, `ratio ${ratio}.`, 'content.media', { id: 'm', type: 'content.media', data: { ...image, width: 800, height: 600 }, props: { ratio } });

block('file-default', 'A file with only its address: the download icon, the name from the address, no size.', 'content.file', { id: 'fl', type: 'content.file', data: { href: 'https://cdn.example/files/Price%20list.xlsx?v=2#sheet' } });
block('file-all', 'value, href, label, mime and size: value is not drawn, the label and size are.', 'content.file', { id: 'fl', type: 'content.file', data: { value: 'file-42', href: '/files/report.pdf', label: 'Report "Q3" <2026>', mime: 'application/pdf', size: 1468006 } });
for (const [mime, name] of [['application/pdf', 'pdf'], ['image/png', 'image'], ['video/mp4', 'video'], ['audio/mpeg', 'audio'], ['application/zip', 'archive'], ['text/csv', 'spreadsheet'], ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'presentation'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'], ['text/plain', 'text'], ['application/octet-stream', 'unknown']]) {
  block(`file-icon-${name}`, `The icon of ${mime}.`, 'content.file', { id: 'fl', type: 'content.file', data: { href: '/f', label: 'File', mime } });
}
for (const [size, locale] of [[0, 'en'], [1023, 'en'], [1000, 'en'], [1536, 'en'], [10 * 1024, 'en'], [1468006, 'en'], [5 * 1024 ** 3, 'en'], [3 * 1024 ** 4, 'en'], [1000, 'ru'], [1468006, 'ru'], [5 * 1024 ** 3, 'ru-RU'], [1536, 'de']]) {
  add(`file-size-${size}-${locale.toLowerCase()}`, `${size} bytes read in ${locale}.`, ['content.file'], content([{ id: 'fl', type: 'content.file', data: { href: '/f', label: 'File', size } }], { locale }));
}
add('file-size-default-locale', 'Without a locale the size reads in English.', ['content.file'], content([{ id: 'fl', type: 'content.file', data: { href: '/f', size: 2048 } }]));

// The html@1 subset: every vector sf-rich-text pins, as a content.html block.
const vectors = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/rich-text-vectors.json'), 'utf8'));
vectors.forEach(({ input }, index) => block(`html-${String(index + 1).padStart(2, '0')}`, `content.html cleans ${JSON.stringify(input).slice(0, 72)} to the html@1 subset.`, 'content.html', { id: 'h', type: 'content.html', data: { markup: input } }));
block('html-hostile', 'Script, style, handlers, javascript: and data: links, images and frames are removed; text stays.', 'content.html', { id: 'h', type: 'content.html', data: { markup: '<h2 class="x" style="color:red">Raw</h2><p onclick="steal()" onmouseover="x()">Text <a href="javascript:alert(1)">bad</a> <a href="https://simai.io/a" target="_blank" onclick="x()">good</a> <a href="data:text/html,x">data</a></p><script>window.pwned = 1</script><img src="x" onerror="window.pwned = 1"><style>p{}</style><iframe src="https://evil.example"></iframe><svg onload="x()"><circle/></svg>' } });
block('html-empty', 'Markup that cleans to nothing draws an empty block.', 'content.html', { id: 'h', type: 'content.html', data: { markup: '<script>x()</script>' } });

// Registered types: their renderer is the host's; a renderer of structured
// content reports it missing and draws nothing in its place.
block('diagram-without-renderer', 'A diagram with no renderer registered: renderer_unavailable, nothing drawn, its assets named.', 'content.diagram', { id: 'dg', type: 'content.diagram', data: { source: 'graph LR\n  A --> B' }, props: { engine: 'mermaid', title: 'Flow' } });
block('math-without-renderer', 'Math with no renderer registered: renderer_unavailable, nothing drawn, its assets named.', 'content.math', { id: 'mt', type: 'content.math', data: { source: 'e^{i\\pi} + 1 = 0' }, props: { label: 'Euler' } });

// ---------------------------------------------------------------------------
// The inline model

const inline = (id, summary, ...runs) => block(`inline-${id}`, summary, 'inline', { id: 'p', type: 'content.paragraph', data: { content: runs } });
inline('text', 'A text run is escaped text.', text('a < b & c > d "e" \'f\''));
inline('text-empty', 'An empty run draws nothing.', text('before'), text(''), text('after'));
inline('mark-strong', 'strong.', text('bold', ['strong']));
inline('mark-em', 'em.', text('italic', ['em']));
inline('mark-code', 'code.', text('x = 1', ['code']));
inline('marks-nested', 'Marks nest in the order they are listed, the first innermost.', text('all', ['strong', 'em', 'code']));
inline('marks-reversed', 'The listed order decides the nesting.', text('all', ['code', 'em', 'strong']));
inline('link-relative', 'A relative link.', link('/docs/a?b=1&c=2', text('docs')));
inline('link-dot-relative', 'A ./ and ../ link.', link('./a', text('here')), text(' '), link('../b', text('up')));
inline('link-fragment', 'A fragment link.', link('#section', text('below')));
inline('link-schemes', 'http, https, mailto and tel links.', link('http://example.com', text('http')), text(' '), link('https://example.com/a"b', text('https')), text(' '), link('mailto:a@example.com', text('mail')), text(' '), link('tel:+70000000000', text('call')));
inline('link-marked-children', 'A link holds marked text runs.', link('/a', text('plain '), text('bold', ['strong']), text(' code', ['code'])));
inline('atom-badge', 'The badge atom draws sf-badge with its props; true is a bare attribute, false is left out.', text('New '), atom('badge', { text: 'beta', icon: 'star', appearance: 'outlined', scheme: 'primary', status: 'info', size: '1/2', compact: true }), text(' '), atom('badge', { text: 'off', compact: false }));
inline('atom-badge-bare', 'A badge without props.', atom('badge'));
inline('atom-kbd', 'The kbd atom draws its text as content, escaped.', atom('kbd', { text: 'Ctrl + <' }));
inline('atom-icon', 'The icon atom.', atom('icon', { icon: 'home', label: 'Home "page"', size: '2', filled: true }));
inline('atom-button', 'The button atom.', atom('button', { text: 'Open', icon: 'open_in_new', appearance: 'outlined', scheme: 'primary', size: '1' }));
inline('atom-escaped', 'An atom\'s text props are escaped as attributes.', atom('badge', { text: '"><script>alert(1)</script>' }));
block('inline-everywhere', 'Inline content reads the same in every place that holds it: item, alert title, details summary, step title, table cell and caption, figure caption.', 'inline', { id: 'g', type: 'content.grid', props: { columns: 1 }, slots: { default: [
  { id: 'l', type: 'content.list', slots: { items: [{ id: 'li', type: 'content.list-item', data: { content: [text('i', ['em']), atom('kbd', { text: 'K' })] } }] } },
  { id: 'w', type: 'content.alert', data: { title: [link('#a', text('alert', ['strong']))] } },
  { id: 'x', type: 'content.details', data: { summary: [text('sum', ['code'])] } },
  { id: 's', type: 'content.steps', slots: { steps: [{ id: 's1', type: 'content.step', data: { title: [atom('icon', { icon: 'check' }), text(' done')] } }] } },
  { id: 't', type: 'content.table', data: { caption: [text('cap', ['em'])], rows: [[[link('/c', text('cell'))]]] }, props: { header: 'none' } },
  { id: 'f', type: 'content.figure', data: { src: '/a.png', alt: '', caption: [text('fig', ['strong'])] } },
] } });

// Inline model 1.2.0 (2026-11-10): the soft line break and the mark strike.
inline('mark-strike', 'strike draws s.', text('gone', ['strike']));
inline('marks-strike-nested', 'strike nests with the other marks in their canonical order.', text('all', ['strike', 'strong', 'code']));
inline('break', 'A break draws br; breaks in a row are kept, at the edges too: the model never removes one.', br(), text('a'), br(), text('b'), br(), br(), text('c'), br());
inline('break-marked', 'A break inside marks draws br inside them.', text('a', ['strong']), br(['strong', 'em']), text('b', ['strong']));
inline('break-in-link', 'A link holds breaks.', link('/a', text('one'), br(), text('two')));
inline('extension-keys', 'Extension keys on a text run, a link, its child, a break and an atom are valid and draw nothing.', { type: 'text', value: 'Bonjour', lang: 'fr' }, { type: 'link', href: '/doc', title: 'Docs', children: [{ type: 'text', value: 'docs', data_ref: 'r1' }] }, { type: 'break', kind: 'soft' }, { ...atom('kbd', { text: 'K' }), lang: 'en' });
block('break-everywhere', 'A break reads the same in every inline field: heading, item, alert title, table cell.', 'inline', { id: 'g', type: 'content.grid', props: { columns: 1 }, slots: { default: [
  { id: 'h', type: 'content.heading', data: { level: 2, content: [text('a'), br(), text('b')] } },
  { id: 'l', type: 'content.list', slots: { items: [{ id: 'li', type: 'content.list-item', data: { content: [text('x'), br(), text('y')] } }] } },
  { id: 'w', type: 'content.alert', data: { title: [text('t'), br(), text('u')] } },
  { id: 't', type: 'content.table', data: { rows: [[[text('c'), br(), text('d')]]] } },
] } });

// content.foreign 1.0.0 (2026-11-10): a block of another source, kept as it
// came. A public page draws nothing of it; raw is never parsed into markup.
const foreign = (id, summary, source, raw, extra = {}) => block(`foreign-${id}`, summary, 'content.foreign', { id: 'fx', type: 'content.foreign', data: { source, raw, ...extra } });
foreign('markdown', 'A Markdown block with CRLF, tabs, trailing spaces and text beyond ASCII: nothing drawn.', 'markdown', ':::example {label="Пример"}\r\n\tкод  \r\n:::\r\n');
foreign('editorjs', 'An Editor.js block, its JSON as raw: nothing drawn.', 'editorjs', '{"id":"x1","type":"checklist","data":{"items":[{"text":"a","checked":true}]}}');
foreign('html-script', 'raw holding a script: nothing of it reaches the page.', 'html', '<script>window.pwned = 1</script><img src=x onerror="window.pwned = 1">');
foreign('hash', 'A matching hash: nothing drawn.', 'markdown', 'a', { hash: 'sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb' });
foreign('hash-mismatch', 'A hash that does not match raw: foreign_hash_mismatch, the block kept and not drawn.', 'markdown', 'a', { hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' });

// ---------------------------------------------------------------------------
// Escaping and ids

block('escape-ids', 'Ids of every allowed character are written as they are.', 'escaping', p('a.b:c-d_e9', 'Id.'));
block('escape-href-attribute', 'An address is escaped as an attribute: & and quotes.', 'escaping', p('p', link('/a?x=1&y="2"', text('q'))));
block('escape-unicode', 'Text beyond ASCII is written as it is.', 'escaping', p('p', text('Привет, мир — «кавычки» 😀')));

// ---------------------------------------------------------------------------
// The outlet: where a layout draws the page's content

const page = content([p('a', 'Page text.'), { id: 'f', type: 'content.figure', data: image }]);
add('outlet-with-content', 'A layout\'s outlet draws the page Document, and the page\'s assets join the layout\'s.', ['content.outlet'], layout([p('brand', 'Brand'), { id: 'o', type: 'content.outlet' }]), { content: page });
add('outlet-without-content', 'An outlet with no page draws an empty outlet.', ['content.outlet'], layout([{ id: 'o', type: 'content.outlet' }]));
add('outlet-content-not-structured', 'The page must be a structured-content Document: outlet_content_invalid, the outlet empty.', ['content.outlet'], layout([{ id: 'o', type: 'content.outlet' }]), { content: layout([]) });
add('outlet-content-invalid', 'An invalid page draws nothing; its diagnostics are reported under $.content.', ['content.outlet'], layout([{ id: 'o', type: 'content.outlet' }]), { content: content([{ id: 'f', type: 'content.figure', data: { src: 'javascript:alert(1)', alt: '' } }]) });
add('outlet-duplicate', 'A layout holds the page in one place.', ['content.outlet'], layout([{ id: 'o1', type: 'content.outlet' }, { id: 'o2', type: 'content.outlet' }]));
add('outlet-in-content', 'The outlet is a layout type: a page cannot hold one.', ['content.outlet'], content([{ id: 'o', type: 'content.outlet' }]));

// ---------------------------------------------------------------------------
// Invalid Documents: nothing is drawn, the diagnostics say why

const invalid = (id, summary, covers, document) => add(`invalid-${id}`, summary, covers, document);
const bad = (id, summary, type, node) => invalid(id, summary, [type], content([node]));
invalid('schema', 'An unknown schema.', ['document'], { ...content([]), schema: 'simai.composition.recipe' });
invalid('schema-version', 'Another schema version.', ['document'], { ...content([]), schema_version: 2 });
invalid('document-id', 'A Document id with a space.', ['document'], { ...content([]), id: 'two words' });
invalid('profile', 'An unknown profile.', ['document'], { ...content([]), profile: 'markdown' });
invalid('locale', 'A locale that is not a language tag.', ['document'], content([], { locale: 'english please' }));
invalid('document-field', 'A field a Document does not have.', ['document'], { ...content([]), title: 'Not here' });
invalid('extension-name', 'An extension key without a namespace.', ['document'], content([], { extensions: { plain: {} } }));
invalid('extension-required', 'A required extension this renderer does not know.', ['document'], content([], { extensions: { 'vendor.example:feature': { required: true } } }));
invalid('root-type', 'A layout root in a structured-content Document.', ['document'], { ...content([]), root: { id: 'root', type: 'layout.page' } });
invalid('type-unknown', 'A type no registry holds.', ['document'], content([{ id: 'x', type: 'content.unknown', data: {} }]));
invalid('node-id', 'A node id that is not an id.', ['document'], content([{ id: '-x', type: 'content.divider' }]));
invalid('node-id-duplicate', 'Two nodes of one id.', ['document'], content([p('same', 'One.'), p('same', 'Two.')]));
invalid('node-field', 'A field a node does not have.', ['document'], content([{ id: 'd', type: 'content.divider', style: 'x' }]));
invalid('forbidden-key-html', 'html is refused anywhere in a Document.', ['content.html'], content([{ id: 'h', type: 'content.html', data: { html: '<p>x</p>' } }]));
invalid('forbidden-key-class', 'A class is never content.', ['document'], content([{ id: 'c', type: 'content.card', props: { class: 'red' } }]));
invalid('slot-unknown', 'A slot the type does not have.', ['document'], content([{ id: 'q', type: 'content.quote', slots: { default: [p('a', 'x')], aside: [] } }]));
invalid('leaf-slots', 'A leaf type holds no slots.', ['document'], content([{ id: 'd', type: 'content.divider', slots: { default: [] } }]));
invalid('depth', 'Nesting deeper than 32 levels: the one node past the limit is reported.', ['document'], content([Array.from({ length: 31 }).reduce((inner, _, index) => ({ id: `q${index}`, type: 'content.quote', slots: { default: [inner] } }), p('deep', 'Deep.'))]));
bad('list-empty', 'A list holds at least one item.', 'content.list', { id: 'l', type: 'content.list', slots: { items: [] } });
bad('list-child', 'A list holds only items.', 'content.list', { id: 'l', type: 'content.list', slots: { items: [p('i', 'x')] } });
bad('list-ordered-type', 'ordered is a boolean.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: 'yes' }, slots: { items: [item('i', 'x')] } });
bad('list-start-range', 'start is at least 1.', 'content.list', { id: 'l', type: 'content.list', props: { ordered: true, start: 0 }, slots: { items: [item('i', 'x')] } });
bad('item-parent', 'An item stands only in a list.', 'content.list-item', item('i', 'x'));
bad('quote-empty', 'A quote holds at least one block.', 'content.quote', { id: 'q', type: 'content.quote' });
bad('code-lang', 'A language name has no spaces.', 'content.code', { id: 'k', type: 'content.code', data: { code: 'x' }, props: { lang: 'Java Script' } });
bad('code-missing', 'Code needs its code.', 'content.code', { id: 'k', type: 'content.code', data: {} });
bad('divider-data', 'A divider has no data.', 'content.divider', { id: 'd', type: 'content.divider', data: { label: 'x' } });
bad('table-rows', 'A table has at least one row.', 'content.table', { id: 't', type: 'content.table', data: { rows: [] } });
bad('table-header', 'header is one of row, column, both, none.', 'content.table', { id: 't', type: 'content.table', data: { rows }, props: { header: 'top' } });
bad('table-align', 'align holds start, center or end.', 'content.table', { id: 't', type: 'content.table', data: { rows }, props: { align: ['left'] } });
bad('figure-alt', 'A figure needs its alt.', 'content.figure', { id: 'f', type: 'content.figure', data: { src: '/a.png' } });
bad('figure-src', 'An image source follows the URL rule.', 'content.figure', { id: 'f', type: 'content.figure', data: { src: 'javascript:alert(1)', alt: '' } });
bad('figure-ratio', 'A ratio is written with a slash.', 'content.figure', { id: 'f', type: 'content.figure', data: image, props: { ratio: '16x9' } });
bad('alert-status', 'status speaks sf-alert\'s words: danger is error.', 'content.alert', { id: 'w', type: 'content.alert', props: { status: 'danger' } });
bad('alert-appearance', 'appearance is default, outlined or flat.', 'content.alert', { id: 'w', type: 'content.alert', props: { appearance: 'outline' } });
bad('details-summary', 'Details need their summary.', 'content.details', { id: 'x', type: 'content.details', data: {} });
bad('tabs-child', 'Tabs hold only tabs.', 'content.tabs', { id: 'tb', type: 'content.tabs', slots: { tabs: [p('t', 'x')] } });
bad('tab-parent', 'A tab stands only in tabs.', 'content.tab', tab('t', 'x'));
bad('tab-label', 'A tab label is not empty.', 'content.tab', { id: 'tb', type: 'content.tabs', slots: { tabs: [tab('t', '')] } });
bad('steps-current', 'current is at least 1.', 'content.steps', { id: 's', type: 'content.steps', props: { current: 0 }, slots: { steps: [step('s1', 'x')] } });
bad('step-parent', 'A step stands only in steps.', 'content.step', step('s1', 'x'));
bad('grid-columns', 'A grid has at most 4 columns.', 'content.grid', { id: 'g', type: 'content.grid', props: { columns: 5 }, slots: { default: cells } });
bad('grid-child-layout', 'A grid holds content, not a layout section.', 'content.grid', { id: 'g', type: 'content.grid', slots: { default: [{ id: 'r', type: 'layout.section' }] } });
bad('card-variant', 'variant is default or plain.', 'content.card', { id: 'c', type: 'content.card', props: { variant: 'outlined' } });
bad('media-src', 'A protocol-relative source leaves the site.', 'content.media', { id: 'm', type: 'content.media', data: { src: '//evil.example/a.png', alt: '' } });
bad('media-side', 'side is left or right.', 'content.media', { id: 'm', type: 'content.media', data: image, props: { side: 'top' } });
bad('file-href-missing', 'A file needs its address.', 'content.file', { id: 'fl', type: 'content.file', data: { label: 'No address' } });
bad('file-href-unsafe', 'A file address follows the URL rule.', 'content.file', { id: 'fl', type: 'content.file', data: { href: 'javascript:alert(1)' } });
bad('file-mime', 'A media type is lowercase type/subtype with no parameters.', 'content.file', { id: 'fl', type: 'content.file', data: { href: '/a.pdf', mime: 'application/pdf; charset=binary' } });
bad('file-size', 'A size is whole bytes.', 'content.file', { id: 'fl', type: 'content.file', data: { href: '/a.pdf', size: 1.5 } });
bad('html-markup-missing', 'content.html needs its markup.', 'content.html', { id: 'h', type: 'content.html', data: {} });
bad('diagram-engine', 'engine is mermaid.', 'content.diagram', { id: 'dg', type: 'content.diagram', data: { source: 'graph' }, props: { engine: 'plantuml' } });
bad('math-source', 'Math needs its source.', 'content.math', { id: 'mt', type: 'content.math', data: {} });
const badInline = (id, summary, ...runs) => bad(`inline-${id}`, summary, 'inline', { id: 'p', type: 'content.paragraph', data: { content: runs } });
badInline('unknown-node', 'An inline node of an unknown type is refused, not drawn and not dropped.', text('a'), { type: 'footnote', ref: '1' });
badInline('unknown-atom', 'An atom whose name is not on the closed list.', atom('chart', { text: 'x' }));
badInline('atom-prop', 'An atom prop it does not declare.', atom('badge', { text: 'x', onclick: 'steal()' }));
badInline('atom-token', 'A token prop takes only token characters.', atom('icon', { icon: 'home" onload="x' }));
badInline('atom-required', 'kbd needs its text.', atom('kbd', {}));
badInline('atom-in-link', 'A link holds text runs only.', link('/a', atom('kbd', { text: 'K' })));
badInline('mark-unknown', 'A mark not on the list.', text('x', ['underline']));
badInline('break-shape', 'A break of another shape (marks not a list) is a newer producer\'s entry: refused.', text('x'), { type: 'break', marks: 'strong' });
// Kit 2.2.0 (2026-11-11): extension keys on known inline entries (owner rule:
// no silent data loss). Lowercase names outside the model's own and the
// forbidden ones are extension data: valid, kept, never drawn.
badInline('extension-style', 'style is no extension key: forbidden, as anywhere in a Document.', { type: 'text', value: 'x', style: 'color:red' });
badInline('extension-event', 'An event handler name (on*) is no extension key.', { type: 'text', value: 'x', onclick: 'steal()' });
badInline('extension-own-name', 'A name of the model (href on a text run) is no extension key.', { type: 'text', value: 'x', href: '/a' });
badInline('extension-name', 'An extension key is lowercase letters, digits, _ . : (no capitals, no dash).', { type: 'text', value: 'x', 'data-ref': 'r' });
bad('foreign-source', 'source is markdown, editorjs or html.', 'content.foreign', { id: 'fx', type: 'content.foreign', data: { source: 'notion', raw: 'x' } });
bad('foreign-hash', 'A hash is sha256: and 64 lowercase hex digits.', 'content.foreign', { id: 'fx', type: 'content.foreign', data: { source: 'markdown', raw: 'x', hash: 'md5:x' } });
bad('foreign-raw-length', 'raw holds at most 200000 characters.', 'content.foreign', { id: 'fx', type: 'content.foreign', data: { source: 'markdown', raw: 'x'.repeat(200001) } });
bad('foreign-props', 'content.foreign has no props.', 'content.foreign', { id: 'fx', type: 'content.foreign', props: { look: 'x' }, data: { source: 'markdown', raw: 'x' } });
badInline('link-javascript', 'A javascript: link.', link('javascript:alert(1)', text('x')));
badInline('link-data', 'A data: link.', link('data:text/html,<script>x()</script>', text('x')));
badInline('link-protocol-relative', 'A protocol-relative link.', link('//evil.example', text('x')));
badInline('link-backslash', 'A backslash path reads as protocol-relative.', link('/\\evil.example', text('x')));
badInline('link-empty', 'A link holds at least one run.', link('/a'));

// ---------------------------------------------------------------------------
// The comparison rule's own vectors (README.md, "Comparing HTML")

const NORMALIZATION = [
  ['attribute order', '<a href="/x" class="b" data-sf-composition-id="i">t</a>', '<a data-sf-composition-id="i" class="b" href="/x">t</a>', true],
  ['class order and repeats', '<div class="flex sf-card flex">x</div>', '<div class="sf-card  flex">x</div>', true],
  ['a class added', '<div class="sf-card">x</div>', '<div class="sf-card flex">x</div>', false],
  ['quotes and references', '<p title="a &amp; b">&#39;x&#39; &lt;y&gt;</p>', '<p title=\'a &#38; b\'>\'x\' &#x3C;y></p>', true],
  ['an empty attribute, bare or empty', '<details open><summary>s</summary></details>', '<details open=""><summary>s</summary></details>', true],
  ['a boolean attribute with a value is that value', '<details open><summary>s</summary></details>', '<details open="open"><summary>s</summary></details>', false],
  ['void elements', '<hr class="sf-divider"><img src="a" alt="">', '<hr class="sf-divider" /><img alt="" src="a"/>', true],
  ['white space between blocks', '<ol><li>One</li><li>Two</li></ol>', '<ol>\n  <li>One</li>\n  <li>Two</li>\n</ol>\n', true],
  ['white space at a block edge', '<p>Text</p>', '<p>\n  Text\n</p>', true],
  ['white space between inline elements is text', '<p><strong>a</strong> <em>b</em></p>', '<p><strong>a</strong><em>b</em></p>', false],
  ['runs of white space fold', '<p>a b</p>', '<p>a \n\t b</p>', true],
  ['white space inside pre is kept', '<pre><code>a  b</code></pre>', '<pre><code>a b</code></pre>', false],
  ['the line feed after pre', '<pre>x</pre>', '<pre>\nx</pre>', true],
  ['comments', '<p>a</p>', '<p>a<!-- note --></p><!-- end -->', true],
  ['style declarations', '<td style="text-align: end">1</td>', '<td style="TEXT-ALIGN:end;">1</td>', true],
  ['text differs', '<p>a</p>', '<p>A</p>', false],
  ['element differs', '<p>a</p>', '<div>a</div>', false],
  ['order of children', '<p><em>a</em><strong>b</strong></p>', '<p><strong>b</strong><em>a</em></p>', false],
  ['an attribute value differs', '<a href="/a">x</a>', '<a href="/a/">x</a>', false],
  ['an attribute missing', '<i class="sf-icon" aria-hidden="true">info</i>', '<i class="sf-icon">info</i>', false],
  ['tag case', '<P CLASS="x">a</P>', '<p class="x">a</p>', true],
];

// ---------------------------------------------------------------------------
// Expectations, from the renderer

const keys = (diagnostics) => diagnostics.map(({ code, path }) => ({ code, path }));
async function expectation(entry) {
  const validation = validate(entry.document);
  const rendered = await render(entry.document, entry.content === undefined ? {} : { content: entry.content });
  return {
    valid: validation.valid,
    html: rendered.html,
    diagnostics: keys(rendered.diagnostics),
    assets: rendered.assets,
  };
}

const stringify = (value) => `${JSON.stringify(value, null, 2)}\n`;
const contentTypes = BUILTIN_TYPE_MANIFESTS.filter((manifest) => manifest.type.startsWith('content.'));
const outputs = new Map();
for (const entry of cases) {
  const expect = await expectation(entry);
  if (!expect.valid && !entry.id.startsWith('invalid-') && entry.id !== 'outlet-duplicate' && entry.id !== 'outlet-in-content') throw new Error(`conformance_case_unexpectedly_invalid:${entry.id}:${JSON.stringify(expect.diagnostics)}`);
  if (expect.valid && entry.id.startsWith('invalid-')) throw new Error(`conformance_case_unexpectedly_valid:${entry.id}`);
  outputs.set(`cases/${entry.id}.json`, stringify({
    schema: 'simai.composition.structured-content-conformance-case',
    schema_version: 1,
    id: entry.id,
    summary: entry.summary,
    covers: entry.covers,
    input: { document: entry.document, ...(entry.content === undefined ? {} : { content: entry.content }) },
    expect,
  }));
}
for (const [label, left, right, equal] of NORMALIZATION) {
  if ((canonicalHtml(left) === canonicalHtml(right)) !== equal) throw new Error(`conformance_normalization_vector_fails:${label}`);
}
outputs.set('normalization.json', stringify({
  schema: 'simai.composition.structured-content-conformance-normalization',
  schema_version: 1,
  summary: 'Pairs of HTML fragments and whether the comparison rule (README.md, "Comparing HTML") holds them equal, with the canonical form of each.',
  vectors: NORMALIZATION.map(([label, left, right, equal]) => ({ label, left, right, equal, canonical: [canonicalHtml(left), canonicalHtml(right)] })),
}));
// ---------------------------------------------------------------------------
// Converters (2026-11-10, F2.4): Markdown in Docara's authoring form, and
// Editor.js. markdown/*.md are inputs: pages of the Docara site and the
// Markdown of their examples, copied as they are (docara b47ed8a6), and
// written forms of the alert vocabulary. Each gets markdown/<name>.json: the
// Document, the losses, and whether it prints back to the same bytes, which
// it must when no loss says form_normalized.

const markdownDir = join(kit, 'markdown');
const markdownInputs = readdirSync(markdownDir).filter((name) => name.endsWith('.md')).sort();
for (const name of markdownInputs) {
  const source = readFileSync(join(markdownDir, name), 'utf8');
  const read = await fromMarkdown(source, { id: 'page' });
  const validation = validate(read.value);
  if (!validation.valid) throw new Error(`conformance_markdown_invalid:${name}:${JSON.stringify(validation.diagnostics.slice(0, 3))}`);
  const printed = await toMarkdown(read.value);
  const normalized = read.losses.some(({ code }) => code === 'form_normalized');
  if (!normalized && printed.value !== source) throw new Error(`conformance_markdown_not_byte_exact:${name}`);
  const again = await fromMarkdown(printed.value, { id: 'page' });
  if (stable(withoutIds(again.value)) !== stable(withoutIds(read.value))) throw new Error(`conformance_markdown_reads_back_otherwise:${name}`);
  outputs.set(`markdown/${name.replace(/\.md$/u, '.json')}`, stringify({
    schema: 'simai.composition.structured-content-conformance-markdown',
    schema_version: 1,
    id: name.replace(/\.md$/u, ''),
    input: name,
    expect: { document: read.value, losses: read.losses, bytes_equal: printed.value === source, ...(printed.value === source ? {} : { printed: printed.value }), print_losses: printed.losses },
  }));
}
// Documents to Markdown: what Docara's form cannot hold is reported.
const MARKDOWN_EXPORTS = [
  ['export-alert-without-title', 'A content.alert without a title: written without one, docara_alert_title_required.', content([{ id: 'w', type: 'content.alert', props: { status: 'error', appearance: 'flat' }, slots: { default: [p('b', 'Body.')] } }])],
  ['export-alert-vocabulary', 'Every status and appearance in Docara\'s words: neutral is clear, error is danger.', content(['neutral', 'info', 'success', 'warning', 'error'].map((status, index) => ({ id: `w${index}`, type: 'content.alert', props: { ...(status === 'neutral' ? {} : { status }), appearance: ['default', 'outlined', 'flat'][index % 3] }, data: { title: [text(status)] }, slots: { default: [p(`b${index}`, 'Body.')] } })))],
  ['export-not-expressible', 'What Markdown has no place for: presentation, a figure size, a table header column, a caption, a media block, an unknown inline entry.', content([
    { id: 'a', type: 'content.paragraph', data: { content: [text('x'), { type: 'footnote', ref: '1' }] }, presentation: { preset: 'lead' } },
    { id: 'f', type: 'content.figure', data: { ...image, width: 640, height: 480 } },
    { id: 't', type: 'content.table', props: { header: 'column' }, data: { caption: [text('cap')], rows } },
    { id: 'm', type: 'content.media', data: image, slots: { default: [p('mp', 'Side.')] } },
  ])],
  ['export-foreign', 'A foreign Markdown block is written back as it came; an Editor.js one in a carrier; one whose hash does not match is not written.', content([
    { id: 'm', type: 'content.foreign', data: { source: 'markdown', raw: ':::example\nx\n:::' } },
    { id: 'e', type: 'content.foreign', data: { source: 'editorjs', raw: '{"id":"e","type":"checklist","data":{"items":[]}}' } },
    { id: 'z', type: 'content.foreign', data: { source: 'markdown', raw: 'changed', hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' } },
  ])],
];
MARKDOWN_EXPORTS.push(
  ['export-foreign-neighbours', 'Foreign Markdown blocks beside what would join them once a paragraph between was deleted (2026-11-11 acceptance, H2): a list with an inline image before a list, an indented code block after a list. Written as they came they would merge; each goes in the :::foreign carrier and reads back as itself.', content([
    { id: 'f1', type: 'content.foreign', data: { source: 'markdown', raw: '- one ![img](/i.png)\n- two' } },
    { id: 'l1', type: 'content.list', slots: { items: [{ id: 'l1a', type: 'content.list-item', data: { content: [text('three')] } }] } },
    { id: 'l2', type: 'content.list', props: { ordered: true }, slots: { items: [{ id: 'l2a', type: 'content.list-item', data: { content: [text('a')] } }, { id: 'l2b', type: 'content.list-item', data: { content: [text('b')] } }] } },
    { id: 'f2', type: 'content.foreign', data: { source: 'markdown', raw: '    indented code' } },
  ])],
  ['export-foreign-not-itself', 'A foreign Markdown raw that would read back as model blocks (two paragraphs, plain text) goes in the carrier; a carriage return inside raw is reported, since Markdown line ends are LF.', content([
    { id: 'f1', type: 'content.foreign', data: { source: 'markdown', raw: 'a\n\nb' } },
    { id: 'f2', type: 'content.foreign', data: { source: 'markdown', raw: 'plain' } },
    { id: 'f3', type: 'content.foreign', data: { source: 'html', raw: '<p>a</p>\r\n<p>b</p>' } },
  ])],
);
for (const [id, summary, document] of MARKDOWN_EXPORTS) {
  if (id.startsWith('export-foreign-')) {
    const printed = await toMarkdown(document);
    const back = await fromMarkdown(printed.value);
    const lostCr = (document.root.slots.default).some((node) => String(node.data?.raw).includes('\r'));
    if (!lostCr && stable(withoutIds(back.value.root.slots.default)) !== stable(withoutIds(document.root.slots.default))) throw new Error(`conformance_markdown_foreign_reads_back_otherwise:${id}`);
  }
  const printed = await toMarkdown(document);
  outputs.set(`markdown/${id}.json`, stringify({ schema: 'simai.composition.structured-content-conformance-markdown-export', schema_version: 1, id, summary, input: { document }, expect: { markdown: printed.value, losses: printed.losses } }));
}

// Editor.js: output of editor.save() in, a Document out, and back.
const EDITORJS = [
  ['standard-tools', 'Every standard tool the adapter maps, in the form it writes: they come back as the same value.', { blocks: [
    { id: 'oUq2g_tl8y', type: 'header', data: { text: 'Key features', level: 2 } },
    { id: 'zbGZFPM-iI', type: 'paragraph', data: { text: 'Meet the <b>new</b> <i>editor</i>, <a href="https://simai.io/a">a link</a> &amp; <code class="inline-code">code</code><br>next <s>old</s>&nbsp;end' } },
    { id: 'XV87kJS_H1', type: 'list', data: { style: 'unordered', meta: {}, items: [{ content: 'one', meta: {}, items: [{ content: 'nested', meta: {}, items: [] }] }, { content: 'two', meta: {}, items: [] }] } },
    { id: 'ol1', type: 'list', data: { style: 'ordered', meta: { start: 3, counterType: 'numeric' }, items: [{ content: 'third', meta: {}, items: [] }] } },
    { id: 'q1', type: 'quote', data: { text: 'Quoted', caption: '', alignment: 'left' } },
    { id: 'c1', type: 'code', data: { code: 'a < b\n' } },
    { id: 'd1', type: 'delimiter', data: {} },
    { id: 't1', type: 'table', data: { withHeadings: true, stretched: false, content: [['A', 'B'], ['1', '<b>2</b>']] } },
    { id: 'i1', type: 'image', data: { file: { url: 'https://simai.io/a.png' }, caption: 'Caption', withBorder: false, stretched: false, withBackground: false } },
    { id: 'w1', type: 'warning', data: { title: 'Note', message: 'Careful.' } },
    { id: 'r1', type: 'raw', data: { html: '<p>raw</p>' } },
  ] }],
  ['foreign-tools', 'A tool the adapter does not map, a block with tunes, an image with a border: each kept as content.foreign and given back as the same value.', { blocks: [
    { id: 'x1', type: 'checklist', data: { items: [{ text: 'a', checked: true }] } },
    { id: 'x2', type: 'paragraph', data: { text: 'with a tune' }, tunes: { anchor: 'x' } },
    { id: 'x3', type: 'image', data: { file: { url: '/a.png' }, caption: '', withBorder: true, stretched: false, withBackground: false } },
    { id: 'x4', type: 'embed', data: { service: 'youtube', source: 'https://youtu.be/x', embed: 'https://www.youtube.com/embed/x', width: 580, height: 320, caption: '' } },
  ] }],
  ['normalized', 'Another spelling of the same content: strong for b, List 1.x items, a list without meta; reported as form_normalized and written in the adapter\'s form.', { blocks: [
    { id: 'n1', type: 'paragraph', data: { text: '<strong>a</strong> <em>b</em>' } },
    { id: 'n2', type: 'list', data: { style: 'unordered', items: ['one', 'two'] } },
  ] }],
  ['inline-not-expressible', 'An inline tag the model has no mark for keeps its text and is reported.', { blocks: [
    { id: 'm1', type: 'paragraph', data: { text: 'marker <mark class="cdx-marker">hi</mark> and <u>under</u>' } },
  ] }],
];
for (const [id, summary, output] of EDITORJS) {
  const read = await fromEditorJs(output, { id: 'page' });
  const validation = validate(read.value);
  if (!validation.valid) throw new Error(`conformance_editorjs_invalid:${id}:${JSON.stringify(validation.diagnostics.slice(0, 3))}`);
  const back = await toEditorJs(read.value);
  const lossless = !read.losses.length;
  if (lossless && stable(back.value.blocks) !== stable(output.blocks)) throw new Error(`conformance_editorjs_not_value_equal:${id}`);
  const again = await fromEditorJs(back.value, { id: 'page' });
  if (stable(again.value) !== stable(read.value)) throw new Error(`conformance_editorjs_reads_back_otherwise:${id}`);
  outputs.set(`editorjs/${id}.json`, stringify({ schema: 'simai.composition.structured-content-conformance-editorjs', schema_version: 1, id, summary, input: output, expect: { document: read.value, losses: read.losses, back: back.value, back_losses: back.losses, value_equal: stable(back.value.blocks) === stable(output.blocks) } }));
}

const groups = {};
for (const entry of cases) {
  const group = entry.id.startsWith('invalid-') ? 'invalid' : entry.id.split('-')[0];
  groups[group] = (groups[group] || 0) + 1;
}
outputs.set('manifest.json', stringify({
  schema: 'simai.composition.structured-content-conformance',
  schema_version: 1,
  version: KIT_VERSION,
  summary: 'Documents any renderer of structured content must draw, and what it must draw: every content type with its defaults and each parameter value, the inline model, escaping, the html@1 cleaning, the outlet, and invalid Documents with their diagnostics.',
  document: { schema: 'simai.composition.document', schema_version: 1, profile: 'structured-content' },
  types: Object.fromEntries([...contentTypes].map(({ type, version }) => [type, version]).sort(([left], [right]) => left.localeCompare(right))),
  comparison: 'README.md#comparing-html',
  normalization: 'normalization.json',
  counts: { cases: cases.length, ...Object.fromEntries(Object.entries(groups).sort(([left], [right]) => left.localeCompare(right))), markdown: markdownInputs.length + MARKDOWN_EXPORTS.length, editorjs: EDITORJS.length },
  cases: cases.map(({ id }) => id),
  converters: {
    markdown: [...markdownInputs.map((name) => name.replace(/\.md$/u, '')), ...MARKDOWN_EXPORTS.map(([id]) => id)].sort(),
    editorjs: EDITORJS.map(([id]) => id),
  },
}));

// ---------------------------------------------------------------------------
// Write or check

const current = (relative) => { try { return readFileSync(join(kit, relative), 'utf8'); } catch { return null; } };
const listed = (folder) => { try { return readdirSync(join(kit, folder)).filter((name) => name.endsWith('.json')).map((name) => `${folder}/${name}`); } catch { return []; } };
const present = [...listed('cases'), ...listed('markdown'), ...listed('editorjs')];
const stale = present.filter((relative) => !outputs.has(relative));
if (process.argv.includes('--check')) {
  const drift = [...outputs].filter(([relative, output]) => current(relative) !== output).map(([relative]) => relative);
  if (drift.length || stale.length) {
    process.stderr.write(`structured_content_conformance_drift: ${[...drift, ...stale.map((relative) => `${relative} (stale)`)].join(', ')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`structured-content conformance kit is current: ${cases.length} cases, ${NORMALIZATION.length} comparison vectors\n`);
  }
} else {
  for (const folder of ['cases', 'markdown', 'editorjs']) mkdirSync(join(kit, folder), { recursive: true });
  for (const relative of stale) rmSync(join(kit, relative));
  for (const [relative, output] of outputs) writeFileSync(join(kit, relative), output);
  process.stdout.write(`structured-content conformance kit: ${cases.length} cases, ${NORMALIZATION.length} comparison vectors written to ${kit}\n`);
}
