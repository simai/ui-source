import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Group build 16 G11 (DEV msg-0bea9d3c): a link drawn as a button starts from
// ButtonText at no weight of its own, so the appearance's on-colour for a bare
// label (.sf-button:not(:has(> *))) reaches an <a> as it reaches a <button>.
test('G11: a.sf-button takes the bare label ink of its appearance', () => {
  const sheet = read('src/component/buttons/scss/_css__buttons.scss');
  const paint = sheet.slice(sheet.indexOf('@layer sf.paint {'));
  assert.match(paint, /:where\(a\)\.sf-button \{\s*color: ButtonText;\s*\}/u);
  assert.doesNotMatch(paint, /(^|\n)\s*a\.sf-button \{\s*color/u);
  assert.ok(paint.indexOf(':where(a).sf-button') < paint.indexOf('.sf-button:not(:has(> *)) {'), 'the bare label rule comes after');
  assert.equal(JSON.parse(read('src/component/buttons/passport.json')).version, '1.22.4') // G14 moved it on;
});
