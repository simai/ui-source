// Backward compatibility of the editing operations (composition F3.1): every
// Composition Document this repository stores (contracts, fixtures,
// examples, docs) opens, takes a no-op edit pass, remove/edit/paste + undo
// and validates the same through an editing session
// (scripts/composition-roundtrip.mjs; the same script reads the product
// checkouts: ui-editor, docara, larena, bx-simai.layout, ui-pro, ui-doc).
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { scan } from '../scripts/composition-roundtrip.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('every stored Composition Document of ui-source round-trips through an editing session', () => {
  const report = scan(root);
  assert.ok(report.documents >= 300, `found ${report.documents} documents`);
  assert.deepEqual(report.failures, []);
});
