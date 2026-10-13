import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Two scales carry icon sizes, and which one applies depends on where the icon is.
// An icon standing on its own takes the fixed ladder. An icon inside a control
// takes the line of that control, box and glyph alike, so it shrinks with the text
// when the adaptive scale shrinks. On a wide screen the two agree at every step,
// which is exactly why the difference is easy to miss and worth pinning here.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const ICON_LADDER = 'src/core/figma_variables/figma_icon_sizes.scss';
const TEXT_SCALE = 'src/core/figma_variables/figma_text_text_size.scss';

test('the icon ladder is fixed and the text scale is adaptive', () => {
  const ladder = read(ICON_LADDER);
  const text = read(TEXT_SCALE);

  assert.doesNotMatch(
    ladder,
    /@media/u,
    'the ladder a standalone icon uses does not change with the viewport',
  );
  assert.match(
    text,
    /@media \(min-width: [\d.]+(?:px|rem)\)/u,
    'the text scale does change with the viewport, which is the whole point',
  );

  // Every step is a step of the fixed size ladder, never of the text scale: if
  // one ever became the other, the two would stop being independent and this
  // rule, and the guide that explains it, would be wrong. Since 2026-10-09 the
  // steps name the ladder instead of repeating its numbers -- the same fixed
  // value, said once (owner, 2026-10-09).
  const steps = [...ladder.matchAll(/--sf-icon-size-[0-9\\/]+:\s*([^;]+);/gu)].map(([, value]) => value.trim());
  assert.ok(steps.length >= 10, `expected the whole ladder, found ${steps.length} steps`);
  for (const value of steps) {
    assert.match(value, /^var\(--sf-[a-i]\d\)$/u, `a ladder step names the size ladder, not ${value}`);
    assert.doesNotMatch(value, /text/u, `a ladder step never follows the text scale: ${value}`);
  }
});

test('an icon inside a control is sized from the line of that control', () => {
  // The button is the reference implementation; the guide shows this exact rule.
  const buttons = read('src/component/buttons/scss/_css__buttons.scss');
  for (const step of ['1', '2', '3']) {
    const rule = new RegExp(
      String.raw`\.sf-button\.sf-button--size-${step} \.sf-icon \{[^}]*`
      + String.raw`--sf-icon--font-size: var\(--sf-text-height-${step}\);[^}]*`
      + String.raw`--sf-icon--height: var\(--sf-text-height-${step}\);[^}]*`
      + String.raw`--sf-icon--width: var\(--sf-text-height-${step}\);`,
      'u',
    );
    assert.match(buttons, rule, `size ${step}: box and glyph both follow the line`);
  }
});

test('the guide explains which scale applies where', () => {
  // A rule nobody wrote down is a rule nobody can follow: this is the page that
  // carries it, and it must keep naming both cases.
  const uiDocRoot = process.env.UI_DOC_ROOT;
  if (!uiDocRoot) return; // The documentation is a separate repository.
  // The page moved into the single guide tree (2026-10-13); a pinned ui-doc
  // from either side of the move is read.
  const page = ['content/ru/guide/colour/design-tokens.md', 'content/ru/guide/fundamentals/design-tokens/index.md']
    .map((candidate) => resolve(uiDocRoot, candidate))
    .find((candidate) => existsSync(candidate));
  assert.ok(page, 'the design tokens page is in the guide');
  const guide = readFileSync(page, 'utf8');
  assert.match(guide, /Иконка внутри контрола/u, 'the control case is explained');
  assert.match(guide, /сама по себе/u, 'the standalone case is explained');
  assert.match(guide, /--sf-text-height-1/u, 'the guide shows the rule, not only prose');
});
