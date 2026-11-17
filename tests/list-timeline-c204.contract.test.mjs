// sf-list-timeline 1.4.0, owner decision C204 (route study R226, ui-control
// control/research/2026-11-15-timeline-route.md, prototypes/timeline-route-study.html):
// (1) a step list's line is sf-steps' (C101): passed 2 px primary, ahead the quiet hairline, no dash;
// (2) items + summary: sub-events folded under a disclosure row (aria-expanded), drawn in place a rung smaller;
// (3) slot: host content under the event's meta line.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (path) => JSON.parse(read(path));
const scss = read('src/smart/list-timeline/scss/_smart__list-timeline.scss');
const source = read('src/smart/list-timeline/index.js');
const template = read('src/smart/list-timeline/js/templates/default.js');

test('C204 (1): the passed segment is 2 px primary, the dashed step line is gone', () => {
  assert.match(scss, /\.sf-list-timeline-list--steps > \.sf-list-timeline-item\[data-state="done"\]:not\(:last-child\)::before \{\n  inset-inline-start: calc\(\(var\(--sf-list-timeline--rail\) - var\(--sf-px\) \* 2\) \/ 2\);\n  inline-size: calc\(var\(--sf-px\) \* 2\);\n  background: var\(--sf-primary\);\n\}/u);
  assert.doesNotMatch(scss, /dashed/u);
});

test('C204 (2): items and summary, folded under an sf-button disclosure, a rung smaller, state rules reach the event only', () => {
  const manifest = json('src/smart/list-timeline/component.json');
  const fields = manifest.settings.items.schema.items.properties;
  assert.equal(fields.summary.type, 'string');
  assert.equal(fields.slot.type, 'string');
  assert.equal(fields.items.type, 'array');
  assert.match(source, /items: depth \+ 1 < MAX_DEPTH \? normalizeItems\(item\.items, seen, depth \+ 1\) : \[\],/u);
  assert.match(source, /item\.summary \|\| this\.sfWord\('run-events'/u);
  assert.match(template, /appearance="ghost" scheme="on-surface-variant"/u);
  assert.match(template, /expanded=\$\{item\.open \? '' : 'false'\}/u);
  assert.match(template, /const SUB = \{'1\/2': '1\/2', 1: '1\/2', 2: '1'\};/u);
  assert.match(template, /aria-label=\$\{item\.title\}>\$\{item\.items\.map\(\(one\) => event\(inner, one\)\)\}<\/ol>/u);
  assert.match(scss, /\.sf-list-timeline-fold \{\n  display: flex;\n  min-inline-size: 0;\n  margin-block-start: var\(--sf-space-1\\\/4\);/u);
  assert.match(scss, /\.sf-list-timeline-sub \{\n  --sf-list-timeline--column-gap: var\(--sf-space-1\\\/2\);\n  min-inline-size: 0;\n  margin-block-start: var\(--sf-space-1\\\/3\);/u);
  // A sub-event under the current step is not drawn as the current step.
  assert.doesNotMatch(scss, /\[data-state="(current|upcoming|done)"\]\)? \.sf-list-timeline-(title|marker--dot)/u);
});

test('C204 (3): the slot an event names stands under its meta line', () => {
  assert.match(source, /slotted: Boolean\(item\.slot\) && Boolean\(this\.hasSlotContent\?\.\(item\.slot\)\),/u);
  assert.match(template, /<div class="sf-list-timeline-slot">\$\{context\.component\.getSlotContent\(item\.slot\)\}<\/div>/u);
  assert.match(scss, /\.sf-list-timeline-slot \{\n  min-inline-size: 0;\n  margin-block-start: var\(--sf-space-1\\\/2\);\n\}/u);
});

test('C204: version 1.4.0 with its note', () => {
  const manifest = json('src/smart/list-timeline/component.json');
  assert.equal(manifest.version, '1.5.1'); // group build 9: 1.4.0 moved on by the merged branches or a GB9 patch // C282: 1.4.1 moved on by the language-file patch (Russian is a language file)
  assert.ok(manifest['x-decisions'].some((note) => note.startsWith('version 1.4.0 (2026-11-15, owner decision C204')));
});
