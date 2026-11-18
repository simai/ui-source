// The Larena settings standard's shared condition cases (FO3-2 of the
// component study, ui-control control/research/2026-11-18-framework-parts-fo):
// larena-specs docs/architecture/settings-standard-fixtures/when-cases.json,
// copied at larena-specs 9966c4c58 into tests/fixtures/larena-settings. Larena
// runs the same file against its server (SettingConditions); the Framework's
// evaluator answers every case the browser decides: the expectation, or the
// client's expectation of a server-only case (gt, gte, lt, lte, which the
// browser does not read, FO3-3, and the server keeps). A copy that changes in
// Larena is copied again here; the count below says which edition this is.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fieldConditions} from '../src/smart/field-renderers/conditions.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/larena-settings/when-cases.json', import.meta.url), 'utf8'));

test('FO3-2: the Larena fixture is the edition the Framework reads (simai.settings.when-cases 1, 149 cases)', () => {
  assert.equal(fixture.format, 'simai.settings.when-cases');
  assert.equal(fixture.format_version, 1);
  assert.equal(fixture.cases.length, 149);
});

test('FO3-2: every shared condition case decides shown, required and enabled as Larena does', () => {
  const failed = [];
  let checked = 0;
  for (const one of fixture.cases) {
    if (!one.when || !('expect' in one)) continue;
    // gt, gte, lt, lte are read in the browser too since the Framework's
    // conditions take them (Larena msg-75b451e2eec6413aa2eb): those server
    // cases are decided as the server decides them.
    const ordered = JSON.stringify(one.when).match(/"op":"(gt|gte|lt|lte)"/u);
    const want = ordered ? one.expect : (one.expect_client ?? one.expect);
    const field = {required: (one.field ?? {}).required === true, when: one.when};
    const got = fieldConditions(field, one.values ?? {});
    checked += 1;
    for (const part of ['visible', 'required', 'enabled']) {
      if (part in want && want[part] !== got[part]) failed.push(`${one.id}: ${part} ${got[part]}, Larena ${want[part]}`);
    }
  }
  assert.equal(checked, 149);
  assert.deepEqual(failed, []);
});
