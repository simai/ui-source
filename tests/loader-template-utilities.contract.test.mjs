import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

/* A Smart component's templates draw with utility classes. The loader used to
   find them only once the component had rendered, so they arrived a wave or
   more after it (six waves on the admin page, utilities last). The utilities a
   component's templates name are its relations too, asked for in the wave
   that asks for the component: scripts/generate-template-utilities.mjs writes
   the table, and the loader reads it. */
const ROOT = new URL('../', import.meta.url);

test('template utilities: the generated table matches the templates', () => {
  const out = execFileSync('node', ['scripts/generate-template-utilities.mjs', '--check'], {cwd: ROOT, encoding: 'utf8'});
  assert.match(out, /TEMPLATE_UTILITIES_CURRENT/);
});

test('template utilities: the loader asks for them with the component', async () => {
  const table = JSON.parse(await readFile(new URL('src/core/js/template-utilities.generated.json', ROOT), 'utf8'));
  assert.ok(Object.keys(table).length > 20, 'the table names too few components');
  assert.ok(table['cl-tabs']?.includes('display/default'), 'cl-tabs draws with display utilities');
  const loader = await readFile(new URL('src/core/js/loader.js', ROOT), 'utf8');
  assert.match(loader, /import templateUtilities from '\.\/template-utilities\.generated\.json';/);
  assert.match(loader, /templateUtilities\[name\]/);
});

/* An attribute's name is not a class. sf-button's shrink (C370) and sf-input's
   text-start / text-end, read through getAttribute and matched by
   [shrink="icon"], bound the flex-shrink and text-align sheets to sf-button,
   sf-header-site and sf-input, which write neither class: one sheet more in
   the wave of every page with a button, the one the first-paint gate saw
   arrive after the components' code (pair GB14, 2026-11-20). */
test('template utilities: attribute names do not ask for utilities', async () => {
  const table = JSON.parse(await readFile(new URL('src/core/js/template-utilities.generated.json', ROOT), 'utf8'));
  for (const name of ['cl-button', 'cl-header-site']) {
    assert.ok(!table[name]?.includes('flex-shrink/default'), `${name} asks for flex-shrink for the shrink attribute`);
  }
  assert.ok(!table['cl-input']?.includes('text-align/default'), 'cl-input asks for text-align for its text-start / text-end attributes');
  assert.ok(table['cl-button']?.includes('display/default'), 'cl-button still asks for the utilities its template writes');
});
