import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import test from 'node:test';
import {code, readDoc, section, tableRows} from './support/foundation-tokens.mjs';

// Foundations standard index (owner decision C181 (4)): every theme listed
// has its page and its contract test, and every theme page points back at the
// index and at the test that holds it.

test('foundation-standard.md lists each theme with a page and a test that exist', () => {
  const rows = tableRows(section(readDoc('foundation-standard.md'), 'Themes'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const page = row.page.match(/\(([^)]+\.md)\)/u)?.[1];
    const testFile = code(row['check in the pair build']);
    assert.ok(page && existsSync(new URL(`../docs/${page}`, import.meta.url)), `${row.theme}: page ${page}`);
    assert.ok(testFile && existsSync(new URL(`../${testFile}`, import.meta.url)), `${row.theme}: test ${testFile}`);
    const text = readDoc(page);
    assert.ok(text.includes('(foundation-standard.md)'), `${page} links the index`);
    assert.ok(text.includes(testFile.replace('tests/', '')), `${page} names its test`);
    for (const heading of ['## Rules', '## Numbers', '## Check']) assert.ok(text.includes(`\n${heading}\n`), `${page} has ${heading}`);
  }
});
