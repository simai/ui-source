import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {isSchema} from '../src/core/js/composition/schema-name.mjs';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const journal = JSON.parse(read('contracts/changes/journal.json'));
const policy = JSON.parse(read('contracts/lifecycle-policy.json'));
const schema = JSON.parse(read('contracts/schema/change-journal.v1.schema.json'));
const recordSchema = schema.$defs.record;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

// The first sweep day on or after deprecated_on + compat_days.
const removeAfter = (deprecatedOn) => {
  const date = new Date(`${deprecatedOn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + policy.compat_days);
  if (date.getUTCDate() !== policy.sweep_day_of_month) {
    date.setUTCMonth(date.getUTCMonth() + 1, policy.sweep_day_of_month);
  }
  return date.toISOString().slice(0, 10);
};
const today = process.env.SF_TODAY || new Date().toISOString().slice(0, 10);

/* Legacy leaves the Framework on a calendar: a public name kept for
   compatibility is recorded in the journal with the date it was deprecated and
   the sweep day it goes, and the gate holds both stages. A record is never
   deleted: once removed it is a tombstone an older consumer upgrades by. */
test('change journal: every record is well formed and dated by the policy', () => {
  assert.ok(isSchema(journal, 'simai.change-journal', 1), 'either form of the format name');
  assert.equal(journal.policy, 'contracts/lifecycle-policy.json');
  const ids = new Set();
  let previous = '';
  for (const record of journal.records) {
    const where = record.id;
    assert.deepEqual(Object.keys(record).filter((key) => !(key in recordSchema.properties)), [], `${where}: unknown keys`);
    for (const key of recordSchema.required) assert.ok(key in record, `${where}: ${key} is required`);
    assert.match(record.id, new RegExp(recordSchema.properties.id.pattern, 'u'), `${where}: id`);
    assert.ok(!ids.has(record.id), `${where}: id listed twice`);
    ids.add(record.id);
    assert.ok(recordSchema.properties.stage.enum.includes(record.stage), `${where}: stage`);
    assert.ok(recordSchema.properties.kind.enum.includes(record.kind), `${where}: kind`);
    assert.ok(recordSchema.properties.rewrite.enum.includes(record.rewrite), `${where}: rewrite`);
    for (const key of ['recorded_on', 'deprecated_on', 'remove_after', 'extended_to', 'removed_on']) {
      if (key in record) assert.match(record[key], DATE, `${where}: ${key}`);
    }
    assert.ok(record.recorded_on >= previous, `${where}: the journal is chronological by recorded_on`);
    previous = record.recorded_on;
    assert.equal(record.remove_after, removeAfter(record.deprecated_on), `${where}: remove_after follows the policy`);
    assert.ok(record.items.length > 0 && record.items.every((item) => item.from), `${where}: items name what changed`);
    if (record.rewrite === 'manual' || record.rewrite === 'none') assert.ok(record.manual, `${where}: a manual record says what to do`);
    if (record.extended_to) {
      assert.ok(record.extension_reason && record.extension_reason.length > 20, `${where}: an extension names its reason`);
      const limit = new Date(`${record.remove_after}T00:00:00Z`);
      limit.setUTCDate(limit.getUTCDate() + policy.extension.max_days);
      assert.ok(record.extended_to <= limit.toISOString().slice(0, 10), `${where}: an extension is at most ${policy.extension.max_days} days`);
    }
    if (record.stage === 'removed') assert.ok(record.removed_on, `${where}: a removed record says when`);
  }
});

/* sf-upgrade compiles every `match` with the u flag, under which an escaped
   hyphen outside a class is an error: one such record stopped the tool on
   every project from the day it was written. */
test('change journal: every match compiles as sf-upgrade compiles it', () => {
  for (const record of journal.records) {
    for (const item of record.items.filter(({match}) => match)) {
      assert.doesNotThrow(() => new RegExp(item.match, 'gu'), `${record.id} ${item.from}: match`);
    }
  }
});

/* A component that moved to a component package keeps its tag; what a product
   adds is the package declaration, so sf-upgrade reports the tag only where
   no project file declares the package. The four Larena components moved
   twice -- to package pro, then to larena when SIMAI Framework Pro was dropped
   -- and only the last move is owed: the pro record stays as history and is
   never reported, so a project on larena is not told to declare pro, and a
   project still on pro is told to declare larena. */
test('sf-upgrade: a moved component is reported only without its package declaration', () => {
  const project = mkdtempSync(join(tmpdir(), 'sf-upgrade-'));
  const run = () => {
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/sf-upgrade.mjs'), project, '--json'], {encoding: 'utf8'});
    assert.equal(result.stderr, '', 'sf-upgrade runs through the whole journal');
    const findings = JSON.parse(result.stdout).findings;
    assert.deepEqual(findings.filter(({record}) => record === 'component-pro-package-move'), [], 'the earlier move is history, never owed');
    return findings.filter(({record}) => record === 'component-larena-package-move');
  };
  try {
    writeFileSync(join(project, 'page.html'), '<sf-table table-settings-key="orders"></sf-table>\n<div class="sf-admin-menu"></div>\n');
    assert.deepEqual(run().map(({from, line}) => `${from}:${line}`), ['sf-table:1'], 'the tag, not the free CSS class');
    writeFileSync(join(project, 'package.json'), '{"packages": ["a"], "dependencies": {"larena": "1"}}\n');
    assert.equal(run().length, 1, 'a key named larena is not a package declaration');
    writeFileSync(join(project, 'boot.js'), "window.SF_BOOT_CONFIG = {packages: {pro: {base: '/assets/ui-pro/smart'}}};\n");
    assert.equal(run().length, 1, 'a project still on pro owes the larena declaration');
    for (const declaration of [
      "window.SF_BOOT_CONFIG = {icons: {type: 'outlined'}, packages: {larena: {base: '/assets/larena/smart'}}};",
      "SF_BOOT_CONFIG.packages.larena = {base: '/assets/larena/smart'};",
      "<?php return ['packages' => ['larena' => ['base' => '/assets/larena/smart']]];",
    ]) {
      writeFileSync(join(project, 'boot.js'), `${declaration}\n`);
      assert.deepEqual(run(), [], declaration);
    }
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
});

/* A class is matched by its name whatever component an item names, so two
   items with the same `from` reported every use twice (tightness-low on
   sf-button and sf-icon-button). */
test('sf-upgrade: a class shared by two components is reported once per use', () => {
  const project = mkdtempSync(join(tmpdir(), 'sf-upgrade-'));
  try {
    writeFileSync(join(project, 'page.html'), '<button class="sf-button tightness-low"></button>\n');
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/sf-upgrade.mjs'), project, '--json'], {encoding: 'utf8'});
    const findings = JSON.parse(result.stdout).findings.filter((row) => row.from === 'tightness-low');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].to, 'spacing-compact');
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
});

test('change journal: what comes due within the notice period is announced', (context) => {
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + (policy.notice_days || 7));
  const soon = journal.records
    .filter((record) => record.stage === 'compat' && (record.extended_to || record.remove_after) <= horizon.toISOString().slice(0, 10))
    .map((record) => `${record.id} (due ${record.extended_to || record.remove_after})`);
  // Not a failure: the reminder that a sweep, or an extension made before the
  // day, is due.
  if (soon.length) context.diagnostic(`sweep due soon: ${soon.join(', ')}`);
});

test('change journal: nothing stays in compat past its sweep day', () => {
  const overdue = journal.records
    .filter((record) => record.stage === 'compat' && today > (record.extended_to || record.remove_after))
    .map((record) => `${record.id} (due ${record.extended_to || record.remove_after})`);
  assert.deepEqual(overdue, [], 'sweep: remove the code, mark the record removed, or extend it once with a reason');
});

test('change journal: records are appended, never deleted', (context) => {
  let previous;
  try {
    previous = JSON.parse(execFileSync('git', ['show', 'HEAD:contracts/changes/journal.json'], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}));
  } catch {
    context.skip('no committed journal to compare with');
    return;
  }
  const now = new Map(journal.records.map((record) => [record.id, record]));
  for (const record of previous.records) {
    assert.ok(now.has(record.id), `${record.id}: a record is never deleted; a removed name stays as a tombstone`);
    if (record.stage === 'removed') assert.equal(now.get(record.id).stage, 'removed', `${record.id}: a removed record stays removed`);
  }
});

/* Every alias table the code keeps is in the journal, so nothing is kept for
   compatibility without a date to leave by. Component prop aliases are checked
   on the built classes by tests/browser/change-lifecycle.browser.mjs. */
test('change journal: every declared alias table is recorded', () => {
  const recorded = new Set(journal.records.flatMap((record) => record.items.map((item) => `${item.component || ''}|${item.from}`)));
  const known = (component, from) => recorded.has(`${component}|${from}`) || recorded.has(`|${from}`);
  const missing = [];
  const axes = JSON.parse(read('contracts/public-api-axes.json'));
  for (const [from] of Object.entries(axes.status_aliases || {})) if (!known('', from) && ![...recorded].some((key) => key.endsWith(`|${from}`))) missing.push(`status_aliases ${from}`);
  for (const entry of axes.change_event?.aliases || []) {
    for (const from of entry.legacy) if (!known(`sf-${entry.component}`, from)) missing.push(`change_event sf-${entry.component} ${from}`);
  }
  for (const entry of axes.size_ladder?.value_aliases || []) {
    const legacy = Array.isArray(entry.legacy) ? entry.legacy : Object.values(entry.legacy || {}).flat();
    for (const from of legacy) if (!known(`sf-${entry.component}`, from)) missing.push(`value_aliases sf-${entry.component} ${from}`);
  }
  for (const entry of axes.size_ladder?.name_aliases || []) {
    for (const from of entry.legacy) if (!known(`sf-${entry.component}`, from)) missing.push(`name_aliases sf-${entry.component} ${from}`);
  }
  for (const name of readdirSync(resolve(root, 'src/smart'))) {
    const path = `src/smart/${name}/smart.manifest.json`;
    if (!existsSync(resolve(root, path))) continue;
    const manifest = JSON.parse(read(path));
    const tag = manifest.custom_element?.tag || manifest.custom_element;
    for (const [event, spec] of Object.entries(manifest.events || {})) {
      if (spec.alias_of && !known(tag, event)) missing.push(`${tag} event ${event}`);
    }
  }
  const sizes = read('src/component/field-size.js').match(/RETIRED_FIELD_SIZES = Object\.freeze\((\{[^}]*\})\)/u)[1];
  for (const [, from] of sizes.matchAll(/'([^']+)':/gu)) {
    if (![...recorded].some((key) => key.endsWith(`|${from}`))) missing.push(`field size ${from}`);
  }
  const modules = JSON.parse(read('src/core/contracts/utility-module-aliases.v1.json'));
  for (const from of Object.keys(modules.aliases)) if (!known('loader', from)) missing.push(`utility module ${from}`);
  assert.deepEqual(missing, [], 'record the alias in contracts/changes/journal.json');
});

test('change journal: the policy, the schema, the runtime note and the docs agree', () => {
  assert.ok(isSchema(policy, 'simai.lifecycle-policy', 1), 'either form of the format name');
  assert.ok(policy.compat_days > 0 && policy.sweep_day_of_month >= 1 && policy.sweep_day_of_month <= 28);
  const base = read('src/core/js/smart-base.js');
  assert.match(base, /import \{ noteDeprecated \} from '\.\/deprecations\.js';/u);
  assert.match(base, /if \(legacy\) \{\n {6}noteDeprecated\(\{component: this\.localName, kind: 'attribute', from: legacy/u);
  const runtime = read('src/core/js/deprecations.js');
  assert.match(runtime, /dataset\?\.sfDeprecations === 'warn'/u, 'console warnings are opt-in');
  assert.ok(read('docs/developer/change-lifecycle.md').includes('contracts/changes/journal.json'));
  assert.ok(existsSync(resolve(root, 'scripts/sf-upgrade.mjs')));
});
