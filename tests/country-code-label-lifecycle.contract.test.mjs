import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/component/country-code/js/_country_code.js',import.meta.url),'utf8');
test('Country Code owns live handlers, not copied rendered markers',()=>{
  assert.match(source,/function bindCountryCode[\s\S]*?typeof root\.__sfCountryCodeInput === 'function'/);
  assert.match(source,/mutation\.removedNodes\.forEach/);
  assert.match(source,/!root\.isConnected && !root\.closest\('sf-country-code'\)\) unbindCountryCode\(root\)/);
  assert.match(source,/flagObserver\?\.unobserve\(img\)/);
});
test('Country Code maintains generated references independently of author references',()=>{
  assert.match(source,/const countryFieldReferences = new WeakMap/);
  assert.match(source,/tokens = tokens\.filter\(id => id !== previous\)/);
  assert.match(source,/attribute === 'aria-describedby' \|\| \(!authorName && tokens\.length === 0\)/);
  assert.match(source,/characterData: true/);
  assert.match(source,/root\.__sfCountryRequiredObserver\?\.disconnect\(\)/);
});
