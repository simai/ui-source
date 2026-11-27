import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import * as Composition from '../src/core/js/composition/index.mjs';
import {caseDocuments, checkDocuments, loadCases} from '../src/core/contracts/ports/simai.document-port/1.0.3/kit/run.mjs';

// simai.document-port kit cases are Composition documents (sf-editor msg-3fc545c5, 2026-11-27): the
// 1.0.0-1.0.2 kits wrote inline nodes as {text} and put main, banner and contentinfo regions inside a
// layout.page, so Composition validate and render refused every case document whole and a page a host
// built from them drew an empty canvas. From 1.0.3 every edition's case documents pass the validator
// render uses and draw html; released editions are never changed, so 1.0.0-1.0.2 stay refused.
const root = resolve(import.meta.dirname, '..');
const PORT = join(root, 'src/core/contracts/ports/simai.document-port');
const RELEASED_INVALID = new Set(['1.0.0', '1.0.1', '1.0.2']);
const newer = (left, right) => {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};
const editions = readdirSync(PORT, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(newer);

test('every case document of every edition from 1.0.3 is a valid Composition document that draws html', async () => {
  const checked = editions.filter((edition) => !RELEASED_INVALID.has(edition));
  assert.ok(checked.includes('1.0.3'), 'the check reads 1.0.3 at least');
  for (const edition of checked) {
    const report = await checkDocuments(Composition, {kit: join(PORT, edition, 'kit')});
    assert.deepEqual(report.results.filter((one) => !one.ok).map(({id, failures}) => `${edition} ${id}: ${failures.join(' | ')}`), []);
    assert.equal(report.passed, loadCases(join(PORT, edition, 'kit')).length);
  }
});

test('the check is not empty: 1.0.3 holds over two hundred documents and one meant to be refused', () => {
  const documents = loadCases(join(PORT, '1.0.3', 'kit')).flatMap(caseDocuments);
  assert.ok(documents.length >= 200, `${documents.length} documents`);
  assert.deepEqual(documents.filter(({refused}) => refused).map(({path}) => path), ['when.payload.values.ru']);
});

test('the check refuses the shapes 1.0.0-1.0.2 shipped', async () => {
  const one = loadCases(join(PORT, '1.0.3', 'kit')).find(({id}) => id === 'load-answers-every-language-under-one-revision');
  const document = structuredClone(caseDocuments(one)[0].document);
  assert.equal(Composition.validate(document).valid, true);
  const run = document.root.slots.regions[0].slots.default[0].data.content;
  run[0] = {text: run[0].value};
  assert.equal(Composition.validate(document).valid, false, 'an inline {text} node');
  const page = structuredClone(caseDocuments(one)[0].document);
  page.root = {id: 'root', type: 'layout.page', slots: {default: [page.root]}};
  assert.ok(Composition.validate(page).diagnostics.some(({code}) => code === 'region_landmark_context'), 'a main region inside layout.page');
});

test('1.0.0-1.0.2 stay as released: their case documents are refused, which 1.0.3 corrects', async () => {
  for (const edition of RELEASED_INVALID) {
    const report = await checkDocuments(Composition, {kit: join(PORT, edition, 'kit')});
    assert.equal(report.failed, report.results.length, `${edition}: ${report.failed} of ${report.results.length}`);
  }
});
