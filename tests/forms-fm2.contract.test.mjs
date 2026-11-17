import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// Forms block of group build 10 (fix/forms-fm2): DEV letter msg-f424660f (Smart
// study pass, forms) and owner decisions C153 (1), C251, C283, C284. Each test
// names the item it holds; each was red on the branch's base.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').replace(/\s+/gu, ' ');

// The declarations of every rule whose selector is exactly `selector`, joined.
function rule(source, selector) {
  const css = flat(source);
  const parts = [];
  for (let at = css.indexOf(`${selector} {`); at >= 0; at = css.indexOf(`${selector} {`, at + 1)) {
    if (at > 0 && !/[\s{};]/u.test(css[at - 1])) continue;
    const open = css.indexOf('{', at);
    parts.push(css.slice(open + 1, css.indexOf('}', open)));
  }
  assert.ok(parts.length, `a rule names ${selector}`);
  return parts.join(' ');
}

test('C283: sf-input-quantity has appearance bordered | filled, bordered by default, filled draws sf-quantity--filled', () => {
  const setting = json('src/smart/input-quantity/component.json').settings.appearance;
  assert.deepEqual(setting.values, ['bordered', 'filled']);
  assert.equal(setting.default, 'bordered');
  const template = read('src/smart/input-quantity/js/templates/default.js');
  assert.match(template, /context\.appearance === 'filled' \? 'sf-quantity--filled' : ''/u);
  assert.match(read('src/smart/input-quantity/index.js'), /get appearance\(\) \{\s*return this\.getAttribute\('appearance'\) === 'filled' \? 'filled' : 'bordered';/u);
  assert.match(read('src/smart/input-quantity/index.js'), /appearance: this\.appearance,/u);
});

test('SM-QT-1: the number place counts its padding in its width and is border-box, whatever the page resets', () => {
  const q = read('src/component/quantity/scss/_css__quantity.scss');
  const box = rule(q, '.sf-quantity .sf-quantity-row > .sf-quantity-wrap > input');
  assert.ok(box.includes('box-sizing: border-box;'), box);
  assert.ok(box.includes('inline-size: calc((var(--sf-quantity--digits, 6) + 0.5) * 1ch + var(--sf-quantity-input--padding-inline-start, calc(var(--sf-px) * 0)) + var(--sf-quantity-input--padding-inline-end, calc(var(--sf-px) * 0)));'), box);
  assert.doesNotMatch(flat(q), /box-sizing: content-box/u);
});
