// A tab counter written straight in the button (Docara audit FW-2, 2026-11-17)
// took the browser's button font, Arial 13.33 on «normal»: it takes the text
// step of the button's size and the text family.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const tabs = readFileSync(new URL('../src/component/tabs/scss/_css__tabs.scss', import.meta.url), 'utf8');
const rule = (selector) => {
  const at = tabs.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} has a rule`);
  return tabs.slice(at, tabs.indexOf('}', at));
};

test('FW-2: a counter beside the text container has the text family and step 1 by default', () => {
  const base = rule('.sf-button > .sf-tabs-count');
  assert.match(base, /font-family: var\(--sf-text--family\);/u);
  assert.match(base, /font-size: var\(--sf-text-size-1\);/u);
  assert.match(base, /line-height: var\(--sf-text-height-1\);/u);
});

test('FW-2: the tabs size classes give the counter their text step', () => {
  for (const [klass, step] of [['1-2', '1\\\\/2'], ['2', '2']]) {
    const body = rule(`.sf-tabs--size-${klass} .sf-button > .sf-tabs-count`);
    assert.match(body, new RegExp(`font-size: var\\(--sf-text-size-${step}\\);`, 'u'));
    assert.match(body, new RegExp(`line-height: var\\(--sf-text-height-${step}\\);`, 'u'));
  }
});
