import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Feedback section, joint pass over plain components (DEV 2026-11-16, studies
// feedback-progress-bar / spinner / skeleton / placeholder on pair
// 5.20261115.1622):
//   RG-PB-1 a paused indeterminate bar drew a segment standing at the start
//           (72 of 240 px, read as 30 %); paused is the whole track tinted at
//           32 % with no segment, in every motion mode (C131 (8));
//   RG-SP-1 the spinner's words read the spinner's ink (on-surface-variant on
//           its own); the source and the variable said «the ink of the place»;
//   RG-SK-1 sf-skeleton-icon took the text size (16 at size 1); an icon is
//           the icon ladder of its step, 16/20/24/28/36 (C151 (1));
//   RG-PH-1 sf-placeholder's title was body text at every level; it holds
//           the heading ladder by level (C21, C44);
//   RG-PH-2 sf-empty-state is drawn from sf-placeholder's parts (C19), with
//           its gaps; its own 28rem column and room went.
// With UI_CORE_ROOT the same is read from the built sheets.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '');
function checkPaused(css, where) {
  const flat = strip(css).replace(/\s+/gu, ' ');
  const rule = flat.match(/\.sf-progress-bar\.sf-progress-bar--indeterminate\.sf-progress-bar--paused \.sf-progress-bar-progress ?\{([^}]*)\}/u);
  assert.ok(rule, `${where}: the paused rule`);
  // Not inside the reduced-motion block: the paused rule stands before it.
  const reduced = flat.indexOf('prefers-reduced-motion');
  assert.ok(reduced < 0 || flat.indexOf(rule[0]) < reduced, `${where}: paused is drawn in every motion mode`);
  assert.match(rule[1], /inset-inline: ?0/u, `${where}: across the whole track`);
  assert.match(rule[1], /width: ?auto/u, `${where}: no 30 % segment`);
  assert.match(rule[1], /animation: ?none/u, `${where}: still`);
  assert.match(rule[1], /color-mix\(in srgb, ?var\(--sf-progress-bar-progress--background-color\) 32%, ?transparent\)/u, `${where}: the fill at 32 %`);
}

function checkSkeleton(css, where) {
  const flat = strip(css).replace(/\s+/gu, ' ');
  for (const step of ['1\\/3', '1\\/2', '1', '2', '3']) {
    const rule = flat.match(new RegExp(`\\.sf-skeleton-text--size-${step.replace(/[\\/]/gu, (c) => `\\${c}`)} ?\\{([^}]*)\\}`, 'u'));
    assert.ok(rule, `${where}: size ${step}`);
    assert.ok(rule[1].includes(`--sf-skeleton-text--icon: var(--sf-text-height-${step})`), `${where}: the icon of ${step} is the step's ladder icon`);
  }
  assert.match(flat, /\.sf-skeleton-text\.sf-skeleton-icon:not\(\[style\*=["']?inline-size["']?\]\) ?\{ ?inline-size: ?var\(--sf-skeleton-text--icon, ?var\(--sf-skeleton-text--height\)\)/u, `${where}: icon width`);
  // A circle or square icon keeps equal sides (the shape rule leaves icons to the icon rule).
  assert.match(flat, /\.sf-skeleton-text:is\(\.sf-skeleton-circle, ?\.sf-skeleton-square\):not\(\.sf-skeleton-icon, ?\[style\*=["']?inline-size["']?\]\)/u, `${where}: icon shapes square`);
  assert.match(flat, /\.sf-skeleton-text\.sf-skeleton-icon:not\(\[style\*=["']?block-size["']?\]\) ?\{ ?block-size: ?var\(--sf-skeleton-text--icon/u, `${where}: icon height`);
}

function checkPlaceholder(css, where) {
  const flat = strip(css).replace(/\s+/gu, ' ');
  const title = flat.match(/\.sf-placeholder :is\(\.sf-placeholder__title, ?\.sf-placeholder-top-text:first-child\) ?\{([^}]*)\}/u);
  assert.ok(title, `${where}: the title rule`);
  assert.doesNotMatch(title[1], /font-size:[^;]*var\(--sf-text--size\)\)\)/u, `${where}: the title is not body text`);
  assert.match(title[1], /var\(--sf-placeholder--title-size\)/u, `${where}: the title's rung`);
  assert.match(title[1], /var\(--sf-font-weight-medium\)/u, `${where}: the state title's weight`);
  for (const level of [1, 2, 3, 4, 5, 6]) {
    assert.match(flat, new RegExp(`:where\\(h${level}\\.sf-placeholder__title, ?h${level}\\.sf-placeholder-top-text\\) ?\\{ ?--sf-placeholder--title-size: ?var\\(--sf-heading-${level}--size\\); ?--sf-placeholder--title-height: ?var\\(--sf-heading-${level}--height\\)`, 'u'), `${where}: h${level}`);
  }
}

function checkEmptyState(css, where) {
  const flat = strip(css).replace(/\s+/gu, ' ');
  assert.doesNotMatch(flat, /--sf-empty-state-max-inline-size, ?var\(--sf-g4\)/u, `${where}: no own 28rem column`);
  assert.doesNotMatch(flat, /\.sf-empty-state-actions ?\{[^}]*margin-block-start/u, `${where}: no own actions room`);
  assert.doesNotMatch(flat, /--sf-empty-state--gap:/u, `${where}: no own gaps by size`);
  const rootRule = flat.match(/\.sf-placeholder\.sf-empty-state ?\{([^}]*)\}/u);
  assert.ok(rootRule, `${where}: the root is the placeholder's`);
  assert.match(rootRule[1], /--sf-placeholder--gap: ?var\(--sf-empty-state-gap, ?var\(--sf-space-1\)\)/u, `${where}: the placeholder's gap`);
  assert.match(rootRule[1], /padding-block: ?var\(--sf-empty-state-padding-block, ?0\)/u, `${where}: no own room`);
}

test('RG-PB-1: a paused bar of unknown size tints the whole track, in every motion mode', () => {
  checkPaused(read('src/component/progress-bar/scss/_css__progressbar_custom.scss'), 'source');
});

test('RG-SP-1: the spinner words are said to take the spinner ink, not the place ink', () => {
  const css = read('src/component/spinner/scss/_css__spinner.scss');
  assert.doesNotMatch(css, /on-surface on a page/u);
  assert.match(css, /color: var\(--sf-spinner-text-color, currentColor\)/u);
  const contract = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const variable = contract.components.find((entry) => entry.component === 'spinner').variables
    .find((entry) => entry.name === '--sf-spinner-text-color');
  assert.match(variable.summary, /on-surface-variant/u);
  assert.doesNotMatch(variable.summary, /the ink of the place/u);
});

test('RG-SK-1: an icon placeholder is the icon of its step on the C151 ladder', () => {
  checkSkeleton(read('src/component/skeleton/scss/_skeleton.scss'), 'source');
});

test('RG-PH-1: the placeholder title holds the heading ladder by level', () => {
  checkPlaceholder(read('src/component/placeholder/scss/_css__placeholder.scss'), 'source');
});

test('RG-PH-2: sf-empty-state draws its block form from sf-placeholder parts and gaps', () => {
  checkEmptyState(read('src/smart/empty-state/scss/_smart__empty_state.scss'), 'source');
  const template = read('src/smart/empty-state/js/templates/default.js');
  const blockForm = template.slice(template.indexOf('export function renderEmptyStateTemplate'));
  for (const part of ["'sf-placeholder'", 'sf-placeholder__visual', 'sf-placeholder__content', 'sf-placeholder__header',
    'sf-placeholder__title sf-empty-state-title', 'sf-placeholder__description sf-empty-state-text', 'sf-placeholder__actions sf-empty-state-actions']) {
    assert.ok(blockForm.includes(part), part);
  }
  const manifest = JSON.parse(read('src/smart/empty-state/smart.manifest.json'));
  assert.ok(manifest.composition.uses.includes('component.placeholder'));
  assert.match(read('src/smart/empty-state/rule.js'), /\{ name: 'placeholder' \}/u);
});

const distribution = process.env.UI_CORE_ROOT;
const files = (directory) => (existsSync(directory) ? readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? files(path) : (entry.name.endsWith('.css') ? [path] : []);
}) : []);
const built = (pattern) => {
  const hits = files(distribution).filter((path) => pattern.test(path));
  assert.ok(hits.length, `a built sheet ${pattern} under ${distribution}`);
  return hits.map((path) => readFileSync(path, 'utf8')).join('\n');
};

test('the built sheets carry RG-PB-1, RG-SK-1, RG-PH-1 and RG-PH-2', {skip: !distribution && 'UI_CORE_ROOT not set'}, () => {
  checkPaused(built(/progress-bar[^/]*\.css$/u), 'built');
  checkSkeleton(built(/\/skeleton[^/]*\.css$/u), 'built');
  checkPlaceholder(built(/\/placeholder[^/]*\.css$/u), 'built');
  checkEmptyState(built(/empty-state[^/]*\.css$/u), 'built');
});

