import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// --sf-on-surface-muted measures 3.18:1 against the light page and 2.92:1
// against the dark one. Informational text needs 4.5:1 (WCAG 1.4.3) and a
// meaningful graphic needs 3:1 (1.4.11), so the role passes neither. It stays,
// because a disabled control and a decorative glyph are explicitly outside both
// requirements — and that is the whole of what it may paint.
//
// It had drifted well past that: the dropdown painted its label and its
// placeholder with it while the input next door used --sf-on-surface-variant,
// the progress scale painted its readout, and the error icon of a field came
// out muted grey while the rest of the error was red.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const styleFiles = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { walk(path); continue; }
      if (entry.name.endsWith('.scss') || entry.name.endsWith('.css')) found.push(path);
    }
  };
  walk('src/component');
  walk('src/smart');
  return found;
};

// A `color:` declaration paints text. An icon colour, a background or a border
// paints something that is not text. The role may sit inside a fallback —
// `color: var(--sf-thing--color, var(--sf-on-surface-muted))` — and that is the
// value wherever the host did not override it, so the whole declaration is read
// rather than its first token.
const PAINTS_TEXT = /(?:^|[;{\s])color:[^;]*--sf-on-surface-muted|--sf-[a-z-]*(?:text|label|placeholder|hint)[a-z-]*--color:[^;]*--sf-on-surface-muted/u;

// The one place a muted colour is the correct answer for text.
const DISABLED = /disabled|aria-disabled/u;

test('the muted role never paints text that has to be read', () => {
  const offenders = [];
  for (const path of styleFiles()) {
    const lines = read(path).split('\n');
    lines.forEach((line, index) => {
      if (!PAINTS_TEXT.test(line)) return;
      const context = lines.slice(Math.max(0, index - 6), index + 1).join('\n');
      if (DISABLED.test(context)) return;
      offenders.push(`${path}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [],
    'muted measures 3.18:1 light and 2.92:1 dark; informational text needs 4.5:1');
});

test('an error carries the error role all the way, icon included', () => {
  const offenders = [];
  for (const path of styleFiles()) {
    const lines = read(path).split('\n');
    lines.forEach((line, index) => {
      if (!/--sf-icon--color:[^;]*--sf-on-surface-muted/u.test(line)) return;
      const context = lines.slice(Math.max(0, index - 4), index + 1).join('\n');
      if (/\.error|\.warning|\.success/u.test(context)) offenders.push(`${path}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, [],
    'a state that colours its border and its text cannot leave its icon grey');
});
