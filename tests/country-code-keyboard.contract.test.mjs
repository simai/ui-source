import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../src/component/country-code/js/_country_code.js', import.meta.url),'utf8');
const css = fs.readFileSync(new URL('../src/component/country-code/scss/_css_country_code_custom.scss', import.meta.url),'utf8');
test('Country Code publishes and removes the shared option keyboard and focus handlers',()=>{
  assert.match(code,/addEventListener\('keydown', onItemKeydown\)/);
  assert.match(code,/removeEventListener\('keydown', root\.__sfCountryCodeItemKeydown\)/);
  assert.match(code,/removeEventListener\('focusout', root\.__sfCountryCodeFocusOut\)/);
  assert.match(code,/list\.inert = !open/);
  assert.match(code,/item\.setAttribute\('aria-selected', String\(matches\)\)/);
});
test('Country Code focus uses semantic width and role color only for focus-visible',()=>{
  assert.match(css,/\.sf-country-code-item:focus-visible/);
  // The list ring used a text colour of its own; it reads the shared focus
  // triple now, like every other ring in the system.
  assert.match(css,/outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
  assert.match(css,/outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
  assert.match(css,/forced-colors: active/);
});
test('Country Code machine keyboard contract describes explicit selection and cancellation',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../src/smart/country-code/smart.manifest.json',import.meta.url),'utf8'));
  for(const key of ['Enter','Space','Escape','ArrowDown','ArrowUp','Home','End','Typeahead']) assert.ok(manifest.accessibility.keyboard.includes(key));
  assert.equal(manifest.lifecycle,'experimental');
});
