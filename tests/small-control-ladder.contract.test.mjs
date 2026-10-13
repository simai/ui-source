import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The small controls — a checkbox box, a radio mark, a switch track — stand as
// tall as the line of their size and carry the three rungs form fields have:
// 1/2, 1 and 2. The rung's job is to match the fields standing beside the
// control, not to be a size of its own. They used to stop at 1 and 2 because
// 1/2 collapsed onto 1/3 in the mobile mode; with 1/3 retired from forms, 1/2
// stands apart (16px against 20 on mobile, 20 against 24 on desktop).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const sources = (component) => {
  const directory = `src/component/${component}/scss`;
  return readdirSync(resolve(root, directory))
    .filter((name) => name.endsWith('.scss'))
    .map((name) => read(`${directory}/${name}`))
    .join('\n');
};

const rungs = (source, prefix) => {
  const found = new Set();
  for (const match of source.matchAll(new RegExp(`${prefix}--size-([0-9]+(?:\\\\\\/[0-9]+)?)`, 'gu'))) {
    found.add(match[1].replace('\\/', '/'));
  }
  return [...found].sort();
};

const FAMILY = [
  ['checkbox', 'sf-checkbox'],
  ['radio', 'sf-radio-button'],
  ['switch', 'sf-switch'],
];

test('a small control carries the three rungs form fields have', () => {
  for (const [component, prefix] of FAMILY) {
    assert.deepEqual(rungs(sources(component), prefix), ['1', '1/2', '2'],
      `${component} should declare rungs 1/2, 1 and 2 and nothing else`);
  }
});

test('the switch track is as tall as its line and twice as long', () => {
  const source = sources('switch');
  assert.match(source, /--sf-switch--track-height: var\(--sf-text-height-1\)/u,
    'the first rung takes the line height of size 1');
  assert.match(source, /--sf-switch--track-height: var\(--sf-text-height-2\)/u,
    'the second rung takes the line height of size 2');
  assert.match(
    source,
    /--sf-switch-toggler--width: calc\(var\(--sf-switch--track-height\) \* var\(--sf-switch--ratio\)\)/u,
    'the length is tied to that height, not listed separately',
  );
});

test('the thumb moves by transform, which a browser can animate', () => {
  const source = sources('switch');
  assert.match(source, /\.sf-switch\.active \.sf-switch-inner \{[^}]*--sf-switch-inner--travel/u,
    'the active state sets the travel');
  assert.match(source, /transform: translateX\(/u, 'and the thumb is moved with it');

  const script = read('src/component/switch/js/_switch.js');
  assert.doesNotMatch(script, /content-main-(start|end)'/u,
    'the script must not move the thumb by swapping alignment: that is not animatable');
});

test('the motion of both halves runs off one clock', () => {
  const source = sources('switch');
  assert.match(source, /--sf-switch--duration:/u, 'the span is a token of its own');
  const spans = [...source.matchAll(/transition:[^;]*?var\(--sf-switch--duration\)/gu)];
  assert.ok(spans.length >= 2, 'the thumb and the fill both read it');
});
