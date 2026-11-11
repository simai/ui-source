import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {copyText} from '../src/core/js/clipboard.js';

// The copy and its fallback (core/js/clipboard.js, SF.copyText; reuse audit
// 2026-11-02, finding 11), shared by sf-copy-button and the clipboard class.

function fakeDocument({secure = true, clipboard = null, execCommand = () => true} = {}) {
  const appended = [];
  const document = {
    defaultView: {isSecureContext: secure, navigator: clipboard ? {clipboard} : {}},
    body: {append: (node) => appended.push(node)},
    execCommand: (command) => { document.commands.push([command, appended.at(-1)?.value]); return execCommand(command); },
    commands: [],
    appended,
    createElement: () => {
      const node = {style: {}, attributes: {}, removed: false, selected: false};
      node.setAttribute = (name, value) => { node.attributes[name] = value; };
      node.select = () => { node.selected = true; };
      node.setSelectionRange = () => {};
      node.remove = () => { node.removed = true; };
      return node;
    },
  };
  return document;
}

test('the Clipboard API on a secure page', async () => {
  const written = [];
  const document = fakeDocument({clipboard: {writeText: async (text) => { written.push(text); }}});
  assert.equal(await copyText('hello', {document}), 'native');
  assert.deepEqual(written, ['hello']);
  assert.deepEqual(document.commands, [], 'no fallback when the API copied');
});

test('the API refused: the hidden field and execCommand, then the field is gone', async () => {
  const document = fakeDocument({clipboard: {writeText: async () => { throw Object.assign(new Error('no'), {name: 'NotAllowedError'}); }}});
  assert.equal(await copyText('hello', {document}), 'legacy');
  assert.deepEqual(document.commands, [['copy', 'hello']]);
  assert.equal(document.appended[0].removed, true);
  assert.equal(document.appended[0].attributes.readonly, '');
});

test('no API on an insecure page goes straight to the fallback', async () => {
  const document = fakeDocument({secure: false, clipboard: {writeText: async () => assert.fail('not on an insecure page')}});
  assert.equal(await copyText(42, {document}), 'legacy');
  assert.deepEqual(document.commands, [['copy', '42']]);
});

test('a fallback that copied nothing rejects, and a throwing one rethrows', async () => {
  await assert.rejects(copyText('x', {document: fakeDocument({secure: false, execCommand: () => false})}), {message: 'copy_unsupported'});
  const denied = fakeDocument({secure: false, execCommand: () => { throw Object.assign(new Error('denied'), {name: 'SecurityError'}); }});
  await assert.rejects(copyText('x', {document: denied}), {name: 'SecurityError'});
  assert.equal(denied.appended[0].removed, true, 'the field is removed either way');
  await assert.rejects(copyText('x', {document: {defaultView: {}}}), {message: 'copy_unsupported'});
});

test('sf-button-copy and the clipboard class copy through the core helper', () => {
  const button = readFileSync(new URL('../src/smart/button-copy/index.js', import.meta.url), 'utf8');
  // Through the copy feedback (decision C48), which copies with copyText.
  const feedback = readFileSync(new URL('../src/core/js/copy-feedback.js', import.meta.url), 'utf8');
  assert.match(button, /import \{createCopyFeedback, readCopyText\} from '\.\.\/\.\.\/core\/js\/copy-feedback\.js'/u);
  assert.match(feedback, /import \{copyText\} from '\.\/clipboard\.js'/u);
  assert.doesNotMatch(button, /execCommand/u);
  assert.doesNotMatch(feedback, /execCommand/u);
  assert.equal(globalThis.SF?.copyText, copyText);
});
