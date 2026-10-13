import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Prose in a table breaks mid-word on purpose, so a long cell value never
// pushes the column wider. A control inside that table used to inherit the
// rule: a row action labelled "edit" came out on three lines and set the row
// height for the whole list. A control label wraps between words, never inside
// one, and that has to hold in the bytes that ship.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = process.env.UI_CORE_ROOT ?? resolve(root, '../ui');

const PROSE_SELECTORS = ['p', 'table', 'ol', 'ul', 'q', 'blockquote'];

function sheets(directory) {
  if (!existsSync(directory)) return [];
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) out.push(...sheets(path));
    else if (entry.name.endsWith('.css') && !entry.name.endsWith('.min.css')) out.push(path);
  }
  return out;
}

const coreSheets = sheets(resolve(distribution, 'distr/core/css'))
  .concat(sheets(resolve(distribution, 'distr/component/buttons/css')));

test('the shipped core sheets exist to be read', () => {
  assert.ok(
    coreSheets.length > 0,
    `no built sheets under ${distribution} — point UI_CORE_ROOT at the build being graded`,
  );
});

test('mid-word breaking is declared for prose and for nothing else', () => {
  for (const path of coreSheets) {
    const css = readFileSync(path, 'utf8');
    for (const match of css.matchAll(/([^{}]*)\{[^{}]*word-break:\s*break-(?:word|all)/gu)) {
      const selector = match[1].split('}').pop().split('{').pop().trim();
      if (!selector || selector.startsWith('@')) continue;
      // The break-all utility is the author asking for it by name.
      if (/text-break-(?:all|word)/u.test(selector)) continue;
      const parts = selector.split(',').map((part) => part.trim());
      for (const part of parts) {
        assert.ok(
          PROSE_SELECTORS.includes(part),
          `${path}: "${part}" breaks text mid-word; only prose (${PROSE_SELECTORS.join(', ')}) may`,
        );
      }
    }
  }
});

test('a button label refuses the breaking it would otherwise inherit', () => {
  const declared = coreSheets.some((path) =>
    /\.sf-button\s+\.sf-button-text-container\s*\{[^{}]*word-break:\s*normal/u
      .test(readFileSync(path, 'utf8')),
  );
  assert.ok(declared, 'no shipped sheet declares word-break: normal on .sf-button .sf-button-text-container');
});
