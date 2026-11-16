import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import table from '../src/core/js/retired-classes.table.js';
import {clearDeprecations, listDeprecations} from '../src/core/js/deprecations.js';
import {noteUtilityClassAlias} from '../src/core/js/utility-class-aliases.js';

// Register RG-A-19 (C187 (8)): the .sf-doc-* helpers move to Docara; RG-U-49:
// the never-built utility folder editor. Both retire through the one table,
// dated to 2027-01-01: nothing is deleted, the doc sheet keeps drawing, and
// the Loader notes each name once in SF.deprecations.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const journal = JSON.parse(readFileSync(resolve(root, 'contracts/changes/journal.json'), 'utf8'));
const DOC = ['sf-doc-checkerboard', 'sf-doc-code', 'sf-doc-example', 'sf-doc-lead', 'sf-doc-pair', 'sf-doc-source', 'sf-doc-stripes'];

test('RG-A-19: every .sf-doc-* class of the doc sheet is retired to Docara, and the sheet stays', () => {
  const record = table.records.find(({journal: id}) => id === 'class-c187-doc-to-docara');
  assert.ok(record, 'the table record');
  assert.equal(record.decision, 'C187 (8)');
  assert.equal(record.remove_after, '2027-01-01');
  const sheet = readFileSync(resolve(root, 'src/component/doc/scss/_sf_css_doc.scss'), 'utf8');
  const drawn = [...new Set([...sheet.matchAll(/\.(sf-doc-[a-z0-9-]+)/gu)].map(([, name]) => name))].sort();
  assert.deepEqual(drawn, DOC, 'the sheet still draws every name');
  assert.deepEqual(Object.keys(record.names).sort(), DOC);
  const entry = journal.records.find(({id}) => id === 'class-c187-doc-to-docara');
  assert.equal(entry.stage, 'compat');
  assert.deepEqual(entry.items.map(({from}) => from).sort(), DOC);
});

test('RG-U-49: the editor utility is retired to sf-editor-overlay, kept until its date', () => {
  const record = table.records.find(({journal: id}) => id === 'class-editor-utility-retired');
  assert.ok(record, 'the table record');
  assert.deepEqual(record.names, {'editor--default': 'sf-editor-overlay'});
  assert.ok(existsSync(resolve(root, 'src/utility/editor/default/scss/_editor_default.scss')), 'nothing deleted before the date');
  assert.ok(journal.records.some(({id, remove_after: date}) => id === 'class-editor-utility-retired' && date === '2027-01-01'));
});

test('the Loader notes a .sf-doc-* class and editor--default once each', () => {
  clearDeprecations();
  noteUtilityClassAlias('sf-doc-example');
  noteUtilityClassAlias('sf-doc-example');
  noteUtilityClassAlias('editor--default');
  const notes = listDeprecations();
  const doc = notes.find(({from}) => from === 'sf-doc-example');
  assert.equal(doc?.component, 'doc');
  assert.equal(doc.remove_after, '2027-01-01');
  assert.equal(notes.find(({from}) => from === 'editor--default')?.to, 'sf-editor-overlay');
  clearDeprecations();
});
