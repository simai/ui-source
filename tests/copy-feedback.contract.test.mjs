// SF.copyFeedback (core/js/copy-feedback.js, owner decision C48): one
// feedback for sf-button-copy and the clipboard component's attribute route.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const {WORDS, DURATION, SOURCE_ERRORS, createCopyFeedback} = await import('../src/core/js/copy-feedback.js');

// A document for copyText: secure, with a Clipboard API that copies or refuses,
// and no body, so the execCommand fallback has nowhere to work.
const page = (writeText) => ({defaultView: {isSecureContext: true, navigator: {clipboard: {writeText}}}});

function recorder(duration = 30) {
  const phases = [];
  const feedback = createCopyFeedback({duration, onPhase: (phase, message) => phases.push([phase, message])});
  return {phases, feedback};
}

test('the words are sf-button-copy\'s, in both languages', async () => {
  for (const locale of ['en', 'ru']) {
    const words = JSON.parse(await read(`src/smart/button-copy/lang/${locale}.json`)).runtime;
    for (const key of ['copy', 'copied', 'failed', 'selected']) assert.equal(WORDS[locale][key], words[key], `${locale}.${key}`);
  }
  assert.equal(DURATION, 2000);
  assert.deepEqual([...SOURCE_ERRORS].sort(), ['ambiguous_source', 'empty_source', 'missing_source', 'missing_target']);
});

test('a copy: pending, success with the copied words, idle after the duration', async () => {
  const {phases, feedback} = recorder();
  let copied = null;
  const result = await feedback.run({read: () => 'npm i', document: page(async (text) => { copied = text; }), words: (key) => key});
  assert.deepEqual(result, {outcome: 'applied', text: 'npm i', method: 'native'});
  assert.equal(copied, 'npm i');
  assert.deepEqual(phases, [['pending', ''], ['success', 'copied']]);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(phases.at(-1), ['idle', '']);
});

test('a refusal selects the source and says which keys copy it', async () => {
  const {phases, feedback} = recorder();
  const denied = Object.assign(new Error('denied'), {name: 'NotAllowedError'});
  let asked = 0;
  const result = await feedback.run({
    read: () => 'sk_test', element: () => { asked++; return null; },
    document: page(async () => { throw denied; }),
    words: (key, vars) => `${key}:${vars?.keys ?? ''}`,
  });
  assert.equal(result.outcome, 'refused');
  assert.equal(result.reason, 'denied');
  assert.equal(asked, 1, 'the source to select is asked for');
  assert.match(phases.at(-1)[1], /^selected:(Ctrl\+C|⌘C)$/u);
  feedback.cancel();
});

test('a refusal gives the focus back to the pressed control (acceptance M2)', async () => {
  const {feedback} = recorder();
  const denied = Object.assign(new Error('denied'), {name: 'NotAllowedError'});
  const focused = [];
  const body = {};
  const button = {isConnected: true, focus: (options) => { focused.push(options); doc.activeElement = button; }};
  const doc = {...page(async () => { throw denied; }), body, activeElement: button};
  await feedback.run({
    read: () => 'sk_test',
    // Selecting the source takes the focus to the page, as a selection outside the control does.
    element: () => { doc.activeElement = body; return null; },
    document: doc,
    words: (key) => key,
  });
  assert.deepEqual(focused, [{preventScroll: true}]);
  assert.equal(doc.activeElement, button);
  feedback.cancel();
});

test('the pressed control\'s tooltip is held shut while its result shows (review L1)', async () => {
  const {phases, feedback} = recorder(40);
  const denied = Object.assign(new Error('denied'), {name: 'NotAllowedError'});
  const holds = [];
  const body = {};
  const trigger = {isConnected: true, ownerDocument: {defaultView: globalThis}, dispatchEvent: (event) => { holds.push([event.type, event.detail.hold, phases.at(-1)?.[0] ?? null]); return true; }};
  const button = {isConnected: true, closest: (selector) => (selector === '[data-tooltip]' ? trigger : null), focus: () => { doc.activeElement = button; }};
  const doc = {...page(async () => { throw denied; }), body, activeElement: button};
  await feedback.run({read: () => 'sk_test', element: () => { doc.activeElement = body; return null; }, document: doc, words: (key) => key});
  // Held before the pending phase, so the focus given back does not open the name.
  assert.deepEqual(holds, [['sf:tooltip-hold', true, null]]);
  assert.equal(phases.at(-1)[0], 'error');
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(phases.at(-1), ['idle', '']);
  assert.deepEqual(holds.at(-1), ['sf:tooltip-hold', false, 'error'], 'released when the result goes, before idle is drawn');
  assert.equal(holds.length, 2);
  // A copy that succeeds draws no bubble: held for the press, released at success.
  holds.length = 0;
  doc.defaultView.navigator.clipboard.writeText = async () => {};
  await feedback.run({read: () => 'sk_test', document: doc, words: (key) => key});
  assert.deepEqual(holds.map(([, hold]) => hold), [true, false]);
  feedback.cancel();
});

test('one result at a time on the page (acceptance L4)', async () => {
  const first = recorder(5000);
  const second = recorder(5000);
  await first.feedback.run({read: () => 'a', document: page(async () => {}), words: (key) => key});
  await second.feedback.run({read: () => 'b', document: page(async () => {}), words: (key) => key});
  assert.deepEqual(first.phases.at(-1), ['idle', ''], 'the first result goes when the second shows');
  assert.deepEqual(second.phases.at(-1), ['success', 'copied']);
  assert.equal(globalThis.SF.__copyResult !== null, true);
  second.feedback.cancel();
  assert.equal(globalThis.SF.__copyResult, null);
});

test('the keys copy the button\'s text, not the drawn one (acceptance L3)', async () => {
  const source = await read('src/core/js/copy-feedback.js');
  assert.match(source, /keepCopyText\(doc, range, element \? readCopyText\(element\) : text\)/);
  assert.match(source, /event\.clipboardData\?\.setData\('text\/plain', held\.text\)/);
});

test('a source error is the failed words, and nothing is selected', async () => {
  const {phases, feedback} = recorder();
  let asked = 0;
  const result = await feedback.run({read: () => { throw new Error('missing_target'); }, element: () => { asked++; return null; }, words: (key) => key, messages: {failed: 'Нет поля'}});
  assert.equal(result.reason, 'missing_target');
  assert.equal(asked, 0);
  assert.deepEqual(phases.at(-1), ['error', 'Нет поля']);
  const empty = await feedback.run({read: () => '', words: (key) => key});
  assert.equal(empty.reason, 'empty_source');
  feedback.cancel();
});

test('a press while a copy is under way is busy and changes nothing', async () => {
  const {phases, feedback} = recorder();
  let release;
  const first = feedback.run({read: () => 'a', document: page(() => new Promise((resolve) => { release = resolve; })), words: (key) => key});
  const second = await feedback.run({read: () => 'b', words: (key) => key});
  assert.deepEqual(second, {outcome: 'refused', reason: 'busy'});
  assert.deepEqual(phases, [['pending', '']]);
  release();
  await first;
  feedback.cancel();
});

test('sf-button-copy, the attribute route and code copy say it through the helper', async () => {
  const [button, route, code, index] = await Promise.all([
    read('src/smart/button-copy/index.js'),
    read('src/component/clipboard/js/index.js'),
    read('src/core/js/code-copy.js'),
    read('src/core/js/index.js'),
  ]);
  assert.match(button, /createCopyFeedback\(\{/u);
  assert.match(route, /createCopyFeedback\(\{/u);
  assert.match(code, /import \{WORDS as COPY_WORDS, copyKeys\} from '\.\/copy-feedback\.js'/u);
  assert.match(index, /import '\.\/copy-feedback\.js';/u);
  const api = JSON.parse(await read('src/core/contracts/public-js-api.json'));
  const entry = api.globals.find((global) => global.name === 'SF.copyFeedback');
  assert.ok(entry, 'SF.copyFeedback is in the public JS API');
  assert.deepEqual(entry.members, ['create', 'readText', 'select', 'words']);
});
