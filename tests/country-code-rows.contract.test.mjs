import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=path=>readFile(new URL(`../src/${path}`,import.meta.url),'utf8');
const js=await read('component/country-code/js/_country_code.js');
const css=await read('component/country-code/scss/_css_country_code.scss');
const template=await read('smart/country-code/js/templates/default.js');
const map=JSON.parse(await read('component/country-code/json/country-code.utility.json'));

test('Country constructor applies the authoritative row/flag layout without compressing list items',()=>{
  assert.match(js,/applyLayoutUtilities\(item, '\.sf-country-code \.sf-country-code-item'\)/);
  assert.match(js,/applyLayoutUtilities\(itemFlag, '\.sf-country-code \.sf-country-code-flag'\)/);
  const row=map['.sf-country-code .sf-country-code-item'];
  assert.ok(row.some(v=>v.includes('.flex)')));
  assert.ok(row.some(v=>v.includes('.items-center)')));
  assert.ok(!row.some(v=>v.includes('.flex-1)')));
});

test('Country option shared styling preserves flag size, wraps long labels and follows UI radius',()=>{
  assert.match(css,/\.sf-country-code \.sf-country-code-item \{\s*min-inline-size: 0;\s*overflow-wrap: anywhere;\s*border-radius: var\(--sf-radius--ui\)/);
  assert.match(css,/\.sf-country-code \.sf-country-code-flag \{\s*flex-shrink: 0;/);
  assert.doesNotMatch(template,/sf-country-code-item[^"\n]*radius-default/);
  assert.doesNotMatch(js,/classList.add\('sf-country-code-item'[^;]*radius-default/);
});
