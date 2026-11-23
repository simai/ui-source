import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// Admin settings study defects (ui-control control/research/2026-11-22-admin-settings-study, FS-6, FS-9,
// FS-10, FS-11; DEV msg-3f4a9bb9543f4bb9a8be). The behaviour is measured in the browser (ui-control evidence
// 2026-11-22-form-fs); these hold the source to it.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));

test('FS-9: a whole number is one type, a number or null, typed or set from code', () => {
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /export function numberValue\(field, value\) \{\n    const resolved = resolveField\(field, \{quiet: true\}\);\n    if \(resolved\.type !== 'number' \|\| resolved\.decimals !== 0 \|\| typeof value !== 'string'\) return value;/u);
  assert.match(renderers, /return Number\.isSafeInteger\(number\) \? number : read\.value;/u, 'past the safe range the decimal string stays');
  assert.match(renderers, /function isDecimalStringField\(field, value\) \{\n    if \(resolveField\(field, \{quiet: true\}\)\.decimals === 0\) return false;/u, 'decimals 0 is never a decimal-string field');
  assert.match(renderers, /host\.setFieldValue\(field, asString \? read\.value : decimals === 0 \? numberValue\(field, read\.value\) : Number\(read\.value\)\);/u);
  const form = read('src/smart/form/index.js');
  assert.match(form, /sendable\(values\) \{\n    const out = this\.typed\(values\);/u, 'value and the events carry the typed values');
  assert.match(form, /out\[field\.key\] = numberValue\(field, out\[field\.key\]\);/u);
  assert.match(form, /this\.setDirty\(!same\(this\.typed\(this\._values\), this\.typed\(this\._saved\)\)\);/u, '"8" from code and 8 typed are one value');
  const journal = json('contracts/changes/journal.json').records.find((record) => record.id === 'value-form-whole-number-type');
  assert.ok(journal, 'the value type change is in the journal');
  assert.match(read('src/smart/form/docs.md'), /Целое число \(`number` с `decimals: 0`, прежний `integer`\) — всегда число\n  или `null`/u);
});

test('FS-6: a yes/no drawn as a checkbox keeps its help at the form\'s «?» size', () => {
  const form = read('src/smart/form/index.js');
  assert.match(form, /if \(speaks && control\.localName === 'sf-checkbox'\) this\.syncCheckboxHelp\(control, field\);/u);
  assert.match(form, /const mark = this\.ownerDocument\.createElement\('sf-help-mark'\);\n    mark\.className = 'sf-form-help';\n    mark\.setAttribute\('size', '1\/2'\);/u, 'the size of the label row\'s mark');
  assert.match(form, /control\.setSlot\('help', mark\);/u, 'through the checkbox\'s help slot (C59)');
  assert.match(read('src/smart/form/js/templates/default.js'), /<sf-help-mark class="sf-form-help" size="1\/2"/u, 'the label row draws the same size');
});

test('FS-10 withdrawn in group build 17: no warm-up fetch; group build 18 keeps the link preload', () => {
  // The warm-up fetch brought 6 of 30 «sf-modal not defined in 10 s» when the server forbids caching and the page's
  // CSP needs connect-src for it (dispatcher, GB17). Group build 18 keeps a link preload, once per page, before and after
  // the load event (tests/loader-preload-once.contract.test.mjs).
  const loader = read('src/core/js/loader.js');
  const body = loader.slice(loader.indexOf('function appendScriptPreload(href)'), loader.indexOf('// The page\'s language file while it is on its way'));
  assert.match(body, /link\.rel = 'preload';\n  link\.as = 'script';/u, 'a link preload');
  assert.doesNotMatch(body, /globalThis\.fetch\(/u, 'no warm-up fetch: it needs connect-src and is asked twice under no-store');
});

test('FS-11: the country button shows its name as a tooltip', () => {
  const country = read('src/component/country-code/js/_country_code.js');
  assert.match(country, /toggle\.setAttribute\('aria-expanded', String\(open\)\);\n[^]*?toggle\.setAttribute\('data-sf-name-tip', ''\);\n    \} else \{\n      toggle\.removeAttribute\('data-sf-name-tip'\);\n      unlinkNameTip\(toggle\);/u);
  const tip = read('src/component/icon-buttons/js/_name-tooltip.js');
  assert.match(tip, /const MARKED = '\[data-sf-name-tip\]';/u);
  assert.match(tip, /const marked = node instanceof Element \? node\.closest\(MARKED\) : null;/u);
  assert.equal(json('src/smart/input-country/component.json').version, '1.11.1');
  assert.equal(json('src/component/country-code/passport.json').version, '1.13.1');
});
