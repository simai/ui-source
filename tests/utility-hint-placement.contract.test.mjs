// A `utility-hint:` comment says which utility classes the rule below it needs
// -- a column direction, wrapping, a non-start alignment. Those are layout
// decisions, and the documentation reads them out of the published CSS by
// taking the selector that follows the comment: ui-doc
// scripts/build-layout-expectations.mjs stops at the first `{` after the hint.
//
// So a block inserted between a hint and its rule takes the hint away from the
// element it describes. sf-pagination shipped that way once: a `:root` block
// publishing the page row's box landed under the hint, the reader stopped at
// `:root`, and the one requirement of the pagination root -- a centred column
// -- quietly left the documentation while the comment was still in the file.
//
// A hint therefore has to name its own rule. Prose above the hint is fine, and
// so is prose between the hint and the rule: a comment holds no `{`, so the
// reader walks through it. What may not stand there is another rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const styleSheets = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.scss')) found.push(full);
    }
  };
  walk(path.join(root, 'src'));
  return found.sort();
};

// The selector the hint's reader lands on: everything up to the next `{`, with
// comments taken out.
const selectorAfter = (source, end) => source
  .slice(end)
  .split('{')[0]
  .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
  .replaceAll(/\s+/gu, ' ')
  .trim();

test('every utility-hint names the rule under it', () => {
  const detached = [];
  let hints = 0;
  for (const file of styleSheets()) {
    const source = fs.readFileSync(file, 'utf8');
    for (const hint of source.matchAll(/utility-hint:[^*]*\*\//gu)) {
      hints += 1;
      const selector = selectorAfter(source, hint.index + hint[0].length);
      // The hinted rule either carries an `sf-` class or is a bare element
      // inside one -- the input of a field, which the author never composes.
      if (/\.sf-/u.test(selector) || /^&?[a-z]+$/u.test(selector)) continue;
      detached.push(`${path.relative(root, file)}: the hint above ${JSON.stringify(selector)}`);
    }
  }

  assert.ok(hints > 100, `expected the hints of the kit, read ${hints}`);
  assert.deepEqual(detached, []);
});
