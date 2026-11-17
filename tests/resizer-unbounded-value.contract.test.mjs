// SF.Resizer's separator value (resizer 1.5.0, ui-view finding 2026-11-17):
// an edge with a finite max says its share of the way from min to max, 0-100,
// as before; an edge without an upper limit (max Infinity or not a number)
// had no such way and said 0 at every width. It now says its width in pixels
// from min, leaves aria-valuemax out (WAI-ARIA: the maximum is unknown) and
// asks widthText, never text, for its words.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setResizerValue} from '../src/smart/resizer/engine.mjs';

const handle = () => {
  const attributes = new Map();
  return {
    attributes,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
  };
};
const session = (min, max, folded = false) => ({limits: () => ({min, max}), measure: () => 0, folded: () => folded});
const text = (share, folded) => (folded ? 'folded' : `${share}%`);
const widthText = (width, folded) => (folded ? 'folded' : `${width} px`);

test('a finite max keeps the share 0-100 and its words', () => {
  const h = handle();
  setResizerValue(h, session(80, 280), 180, text, widthText);
  assert.deepEqual(Object.fromEntries(h.attributes), {'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '50', 'aria-valuetext': '50%'});
});

test('an edge without an upper limit says its width in pixels, no aria-valuemax', () => {
  for (const max of [Infinity, Number.NaN, undefined]) {
    const h = handle();
    h.setAttribute('aria-valuemax', '100');
    setResizerValue(h, session(80, max), 244.4, text, widthText);
    assert.equal(h.getAttribute('aria-valuenow'), '244', `max ${max}`);
    assert.equal(h.getAttribute('aria-valuemin'), '80');
    assert.equal(h.getAttribute('aria-valuemax'), null, 'the maximum is unknown');
    assert.equal(h.getAttribute('aria-valuetext'), '244 px', 'widthText, not the share\'s «%»');
  }
});

test('an unbounded edge never says less than min, and 0 when folded', () => {
  const h = handle();
  setResizerValue(h, session(80, Infinity), 40, text, widthText);
  assert.equal(h.getAttribute('aria-valuenow'), '80');
  const f = handle();
  setResizerValue(f, session(80, Infinity, true), 300, text, widthText);
  assert.deepEqual([f.getAttribute('aria-valuenow'), f.getAttribute('aria-valuemin'), f.getAttribute('aria-valuetext')], ['0', '0', 'folded']);
});

test('an unbounded edge without widthText says no words', () => {
  const h = handle();
  h.setAttribute('aria-valuetext', 'stale');
  setResizerValue(h, session(0, Infinity), 120, text);
  assert.equal(h.getAttribute('aria-valuenow'), '120');
  assert.equal(h.getAttribute('aria-valuetext'), null);
});
