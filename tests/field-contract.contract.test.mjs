import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = (relative) => readFile(path.resolve(root, relative), 'utf8');
const json = async (relative) => JSON.parse(await text(relative));

test('field contract keeps stable identities and chooses an error over a hint', async () => {
  const source = await text('src/component/field-contract.js');
  assert.doesNotMatch(source, /\blet \w*[Ss]equence\b|\+\+\w*[Ss]equence/u, 'no module counter makes an id (#41)');
  const {createFieldContract} = await import(new URL('../src/component/field-contract.js', import.meta.url));
  const owner = {};
  const first = createFieldContract(owner, {
    prefix: 'sf-input',
    required: true,
    invalid: true,
    hint: 'Hint',
    errorMessage: 'Correct the value',
  });
  const second = createFieldContract(owner, {prefix: 'sf-input'});

  assert.equal(first.controlId, second.controlId);
  assert.equal(first.message, 'Correct the value');
  assert.equal(first.required, true);
  assert.equal(first.invalid, true);
  assert.equal(first.describedBy, first.messageId);
  assert.equal(first.errorMessageId, first.messageId);
});

test('input and textarea Smart templates expose the same native field semantics', async () => {
  const [inputTemplate, textareaTemplate] = await Promise.all([
    text('src/smart/inputs/js/templates/default.js'),
    text('src/smart/textarea/js/templates/default.js'),
  ]);

  for (const source of [inputTemplate, textareaTemplate]) {
    assert.match(source, /\?required=\$\{field\.required\}/);
    assert.match(source, /aria-invalid=\$\{field\.invalid/);
    assert.match(source, /aria-describedby=\$\{messageContent/);
    assert.match(source, /aria-errormessage=\$\{field\.invalid && errorContent/);
    assert.match(source, /createFieldContract\(context\.component/);
    assert.match(source, /data-field-message=\$\{field\.invalid && errorContent/);
  }
});

test('ordinary input and textarea bindings synchronize root, native control and message', async () => {
  const [inputSource, textareaSource] = await Promise.all([
    text('src/component/inputs/js/_inputs.js'),
    text('src/component/textarea/js/_textarea.js'),
  ]);

  for (const source of [inputSource, textareaSource]) {
    assert.match(source, /syncFieldContract\(root,/);
    assert.match(source, /root\.classList\.toggle\('error', invalid\)/);
    assert.match(source, /required: .*\.required \|\| Boolean\(root\.querySelector/);
    assert.match(source, /ensureMessageNode\(root\)/);
    assert.match(source, /\.\.\.messageState\(root\)/);
  }
});

test('Smart input forwards the declared native input security and validation contract', async () => {
  const source = await text('src/smart/inputs/js/templates/default.js');

  assert.doesNotMatch(source, /type="text"/);
  assert.equal((source.match(/type=\$\{inputType\}/g) || []).length, 2);
  for (const attribute of ['autocomplete', 'inputmode', 'minlength', 'maxlength', 'pattern']) {
    assert.equal(
      (source.match(new RegExp(`\\n\\s+${attribute}=\\$\\{`, 'g')) || []).length,
      2,
      `${attribute} must be forwarded in controlled and uncontrolled render paths`,
    );
  }
});

test('input and textarea manifests publish the shared field parameters', async () => {
  const manifests = await Promise.all([
    json('src/smart/inputs/smart.manifest.json'),
    json('src/smart/textarea/smart.manifest.json'),
  ]);

  for (const manifest of manifests) {
    const properties = manifest.inputs.properties;
    assert.equal(properties.required.type, 'boolean');
    assert.equal(properties.invalid.type, 'boolean');
    assert.equal(properties['error-message'].type, 'string');
  }
  assert.equal(manifests[1].inputs.properties.readonly.type, 'boolean');
});

test('field names exclude hints and sibling buttons, and preserve author naming', async () => {
  const {syncFieldContract} = await import(new URL('../src/component/field-contract.js', import.meta.url));
  const node = (tagName, textContent = '') => ({
    tagName, textContent, id: '', attributes: new Map(), classList: {toggle() {}},
    hasAttribute(k) { return this.attributes.has(k); },
    getAttribute(k) { return this.attributes.get(k) || null; },
    setAttribute(k,v) { this.attributes.set(k,v); },
    removeAttribute(k) { this.attributes.delete(k); },
  });
  const root = node('LABEL'), input = node('INPUT'), label = node('SPAN', 'Amount'), hint = node('SPAN', 'Hint');
  syncFieldContract(root, input, {labelNode: label, messageNode: hint});
  assert.equal(root.getAttribute('for'), input.id);
  assert.equal(input.getAttribute('aria-labelledby'), label.id);
  assert.equal(input.getAttribute('aria-describedby'), hint.id);
  assert.notEqual(label.id, hint.id);
  const identity = label.id;
  syncFieldContract(root, input, {labelNode: label, messageNode: hint});
  assert.equal(label.id, identity);
  const explicit = node('INPUT'); explicit.setAttribute('aria-label', 'Custom name');
  syncFieldContract(node('DIV'), explicit, {labelNode: label});
  assert.equal(explicit.getAttribute('aria-label'), 'Custom name');
  assert.equal(explicit.hasAttribute('aria-labelledby'), false);
});
