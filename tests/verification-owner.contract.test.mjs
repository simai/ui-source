import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = path => readFile(new URL(path, uiDocRoot), 'utf8');

test('Verification Loader rule detects only public component roots', async () => {
  const sandbox = { SF: { RuleLoader: {} } };
  vm.createContext(sandbox);
  vm.runInContext(await read('src/component/verification/rule.js'), sandbox);
  const rule = sandbox.SF.RuleLoader.verification;

  assert.equal(rule.regex.test('class="sf-verification"'), true);
  assert.equal(rule.regex.test('class="sf-verification-form gap-1"'), true);
  assert.equal(rule.regex.test('class="sf-verification-copy"'), false);
  assert.equal(rule.regex.test('data-name="sf-verification"'), false);
});

test('Verification canonical contract owns one native input', async () => {
  const source = await read('src/component/verification/js/_verification.js');

  assert.match(source, /const INPUT_SELECTOR = '\.sf-verification-input'/);
  assert.match(source, /dataset\?\.length/);
  assert.match(source, /dataset\?\.mode/);
  assert.match(source, /autocomplete = 'one-time-code'/);
  assert.match(source, /clipboardData\?\.getData\('text'\)/);
  assert.match(source, /new CustomEvent\('verification:complete'/);
  assert.match(source, /const states = new WeakMap\(\)/);
  assert.match(source, /contract: 'single-input'/);
  assert.doesNotMatch(source, /\.submit\(|requestSubmit/);
  assert.doesNotMatch(source, /\bv2\b/i);
});

test('Verification presentation uses semantic Framework contracts', async () => {
  const styles = `${await read('src/component/verification/scss/_css__verification.scss')}\n${await read('src/component/verification/scss/_css__verification-form.scss')}`;

  assert.match(styles, /var\(--sf-radius--ui\)/);
  assert.match(styles, /var\(--sf-px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /forced-colors: active/);
  assert.match(styles, /direction: ltr/);
  assert.doesNotMatch(styles, /--sf-ui-radius-default/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(styles, /\b(?:1|2|4|6|8|12|16|20|24|32|40|48|56|64)px\b/);
});

test('Verification documentation uses the canonical single-input examples', async () => {
  const [sourceDocs, page, overview, styles, sizes, error, disabled] = await Promise.all([
    read('src/component/verification/docs/docs.md'),
    readUiDoc('content/ru/components/forms/verification.md'),
    readUiDoc('examples/components/verification/overview/index.html'),
    readUiDoc('examples/components/verification/styles/index.html'),
    readUiDoc('examples/components/verification/sizes/index.html'),
    readUiDoc('examples/components/verification/state-error/index.html'),
    readUiDoc('examples/components/verification/state-disabled/index.html'),
  ]);
  const examples = [overview, styles, sizes, error, disabled];

  assert.match(sourceDocs, /one\s+native input/i);
  assert.match(page, /components\/verification\/overview/);
  examples.forEach((example) => {
    assert.match(example, /class="sf-verification-input"/);
    assert.doesNotMatch(example, /<style|style=/);
  });
  assert.equal((overview.match(/<input\b/g) || []).length, 1);
  assert.match(overview, /autocomplete="one-time-code"/);
  assert.match(error, /aria-invalid="true"/);
  assert.match(disabled, /<input\b[^>]*\bdisabled\b/);
});
