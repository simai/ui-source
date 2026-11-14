// Owner decision C140 (ui-control control/docs-review/decisions.md; badges study
// control/research/2026-11-14-badges.md, prototype prototypes/badges-study.html):
// one job, one look. The drawn result is measured by the c140 probe on a stand
// (evidence control/evidence/2026-11-14-badges-c140); this file holds the source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const record = (id) => json('contracts/changes/journal.json').records.find((entry) => entry.id === id);

test('C140 (1): the default look is grey tonal, in the element and in the class', () => {
  const badge = json('src/smart/badge/component.json');
  assert.equal(badge.settings.appearance.default, 'tonal');
  assert.equal(json('src/smart/badge/smart.manifest.json').inputs.properties.appearance.default, 'tonal');
  assert.match(read('src/component/badges/js/contract.js'), /const DEFAULT_BADGE_TYPE = 'tonal';/u);
  const css = read('src/component/badges/scss/_css__badges.scss');
  const base = css.slice(css.indexOf('.sf-badge {'), css.indexOf('\n}\n', css.indexOf('.sf-badge {')));
  assert.match(base, /--sf-badge--background-color: var\(--sf-badge-background-color, var\(--sf-surface-container\)\);/u);
  assert.match(base, /--sf-badge--color: var\(--sf-badge-color, var\(--sf-on-surface\)\);/u);
  assert.doesNotMatch(css, /\.sf-badge\.sf-badge--main\.sf-badge--neutral \{/u);
});

test('C140 (4): main is the attention count alone; any other colour draws tonal and is noted until 2027-01-01', () => {
  const css = read('src/component/badges/scss/_css__badges.scss');
  for (const colour of ['primary', 'secondary', 'tertiary', 'on-surface', 'info', 'success', 'warning']) {
    assert.doesNotMatch(css, new RegExp(`\\.sf-badge\\.sf-badge--main\\.sf-badge--${colour} \\{`, 'u'), colour);
  }
  assert.match(css, /\.sf-badge\.sf-badge--main:is\(\.sf-badge--error, \.sf-badge--danger\) \{\s*--sf-badge--background-color: var\(--sf-badge-background-color, var\(--sf-error\)\);/u);
  const element = read('src/smart/badge/index.js');
  assert.match(element, /noteDeprecated\(\{component: 'sf-badge', tag: 'sf-badge', kind: 'value', attribute: 'appearance', from: 'main', to: 'tonal', \.\.\.BADGE_MAIN_TONAL\}\);/u);
  assert.match(read('src/component/badges/js/contract.js'), /BADGE_MAIN_TONAL = Object\.freeze\(\{since: '2026-11-14', remove_after: '2027-01-01'\}\)/u);
  // Not a shim alias: an alias would rewrite main error too.
  assert.equal(json('src/smart/badge/aliases.json').aliases.some((alias) => alias.from === 'main'), false);
  const entry = record('value-badge-appearance-main-to-tonal');
  assert.equal(entry.remove_after, '2027-01-01');
  assert.equal(entry.stage, 'compat');
});

test('C140 (5): 24 · 28 · 32 on the phone too, through the badge\'s own lines; a compact region keeps its own', () => {
  const css = read('src/component/badges/scss/_css__badges.scss');
  for (const [size, step] of [['1\\/3', 'b6'], ['1\\/2', 'c0'], ['1', 'c2']]) {
    assert.ok(css.includes(`--sf-badge--line-${size}: var(--sf-${step});`), size);
    assert.ok(css.includes(`--sf-badge--space-y-${size}: var(--sf-a4);`), size);
    assert.ok(css.includes(`--sf-badge--line-${size}: var(--sf-text-height-${size});`), `${size} from the desktop breakpoint`);
  }
  assert.match(css, /@media \(min-width: 60rem\) \{\s*\.sf-badge \{/u);
  // The phone text size is the text ladder's, unchanged.
  assert.match(css, /\.sf-badge--size-1\\\/2 \{[^}]*--sf-badge--font-size: var\(--sf-text-size-1\\\/2\);[^}]*--sf-badge--line-height: var\(--sf-badge--line-1\\\/2\);/u);
});

test('C140 (3): one count rule in the hosts -- quantity grey tonal, attention red filled; labels in tabs and contents tonal', () => {
  assert.match(read('src/smart/list/js/templates/default.js'), /class="sf-list__count" line=\$\{line\} appearance="main" status="error" tight/u);
  const menu = read('src/smart/menu/js/templates/default.js');
  assert.match(menu, /const ATTENTION = 'sf-badge--main sf-badge--error';/u);
  assert.match(menu, /const QUANTITY = 'sf-badge--tonal sf-badge--neutral';/u);
  assert.match(menu, /item\.status === 'error' \? ATTENTION : QUANTITY/u);
  assert.match(menu, /<span class="sf-badge sf-badge--tonal sf-badge--neutral sf-badge--tight">\$\{item\.badge\}<\/span>/u);
  assert.match(read('src/smart/accordion/js/templates/default.js'), /<sf-badge class="sf-accordion-badge" appearance="tonal"/u);
  const contents = read('src/smart/contents/js/templates/default.js');
  assert.match(contents, /status=\$\{status \|\| nothing\} appearance="tonal" text=/u);
  assert.doesNotMatch(contents, /appearance=\$\{status \? 'main'/u);
  assert.match(read('src/smart/tabs/js/templates/default.js'), /'sf-badge sf-badge--tonal sf-badge--error sf-badge--size-1\/3 sf-badge--line-text'/u);
});

test('C140 (6): a status tag that is neither interactive nor closable draws the tonal badge of its status', () => {
  const template = read('src/smart/tag/js/templates/default.js');
  assert.match(template, /if \(context\.status && !context\.interactive && !context\.closable\) \{\s*return renderStatusBadge\(context, textContent\);/u);
  assert.match(template, /'sf-badge--tonal',\s*`sf-badge--\$\{context\.status\}`/u);
  const tag = json('src/smart/tag/component.json');
  assert.ok(tag.relations.some((relation) => relation.name === 'badges'));
  assert.match(read('src/smart/tag/rule.js'), /\{ name: 'badges' \}/u);
  // One status, one hue: the tag's fill is the badge's container role.
  const tags = read('src/component/tags/scss/_css__tags.scss');
  for (const status of ['info', 'success', 'warning', 'error']) {
    assert.match(tags, new RegExp(`sf-tag--${status} \\{\\s*--sf-tag--background-color: var\\(--sf-tag-background-color, var\\(--sf-${status}-container\\)\\);`, 'u'), status);
  }
  assert.equal(record('behaviour-tag-status-without-interaction-is-a-badge').remove_after, '2027-01-01');
});

test('C140 (2), BG-7: a data colour reaches the badge through its public colour, as a palette step', () => {
  const helper = read('src/smart/helpers/option-badge.js');
  assert.match(helper, /`--sf-badge-background-color: var\(--sf-\$\{hue\}-50--alfa-24\); --sf-badge-color: var\(--sf-on-surface\)`/u);
  assert.doesNotMatch(helper, /--sf-badge--background-color/u);
});
