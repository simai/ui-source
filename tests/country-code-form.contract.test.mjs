import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../src/component/country-code/js/_country_code.js',import.meta.url),'utf8');
const template=fs.readFileSync(new URL('../src/smart/country-code/js/templates/default.js',import.meta.url),'utf8');
test('Country Code native submission contract is present in both renderers',()=>{
  assert.match(code,/input\.type = 'tel'/);assert.match(code,/input\.name = String\(name\)/);assert.match(code,/input\.defaultValue = String\(value/);
  assert.match(template,/name=\$\{context\.name \|\| nothing\}/);assert.match(template,/form=\$\{context\.form \|\| nothing\}/);assert.match(template,/\?required=\$\{required\}/);assert.match(template,/\.defaultValue=\$\{value\}/);
});
test('Country Code uses the shared reset subscription with matched release',()=>{
  assert.match(code,/from '\.\.\/\.\.\/form-reset-helper'/);
  assert.match(code,/bindFormReset\(input,/);assert.match(code,/root\.__sfCountryReleaseReset\?\.\(\)/);
  assert.match(code,/applyCountrySelection\(root, country, 'reset'\)/);
  assert.match(code,/if \(!root\.closest\('sf-country-code'\)\) bindCountryCode\(root\)/);
});
function validation(){
  // The words come from the shared language rule now, so the sandbox has to
  // carry it: the slice below is real source, and leaving it without `pageText`
  // would be testing a function the component does not have. A root with no
  // `closest` resolves to English, which is what this contract expects.
  const context=vm.createContext({
    countryRequiredMessages:new WeakMap(),
    pageText:(dictionary,key)=>dictionary?.en?.[key],
    COUNTRY_CODE_TEXT:{en:{phoneLabel:'Phone number',phoneRequired:'Enter a phone number.',countryLabel:'Country code'}},
  });
  vm.runInContext(code.slice(code.indexOf('function escapeRegExp'),code.indexOf('function closeAllCountryCodes')),context);
  vm.runInContext(code.slice(code.indexOf('function syncCountryRequired'),code.indexOf('function ensureCountryId')),context);
  const input={value:'+7 ',required:true,validationMessage:'',validity:{customError:false},setCustomValidity(message){this.validationMessage=message;this.validity.customError=!!message;}};
  const root={dataset:{dialCode:'+7'},__sfCountryConfig:{showCode:true,locale:'en'}};
  return {input,check:()=>context.syncCountryRequired(root,input)};
}
test('Required Country Code rejects prefix alone and clears only its own error',()=>{
  const {input,check}=validation();check();assert.equal(input.validationMessage,'Enter a phone number.');
  input.value='+7 1234567890';check();assert.equal(input.validationMessage,'');
  input.value='+7 ';check();input.required=false;check();assert.equal(input.validationMessage,'');
});
test('Country Code leaves host custom validity untouched',()=>{
  const {input,check}=validation();input.setCustomValidity('Server validation');check();assert.equal(input.validationMessage,'Server validation');
});
