// VS-SITE-4 (ui-control control/evidence/2026-11-20-ru-words): words a part
// writes once kept the language they were written in. On a Russian page whose
// language file arrived after the part was drawn (a Smart bundle before
// core.js, a slow network) a board said «Enter or Space to pick up, arrows to
// move…» and «draggable», sf-list-feed said «You», and the class breadcrumbs'
// «…» was «Show hidden breadcrumbs», although the ru pack holds every word.
// Each now writes them again when the language changes; the browser half is
// the probe in the evidence folder (slow-pack order).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { language, pageText } from '../src/core/js/page-language.js';

const read = (path) => readFileSync(new globalThis.URL(`../${path}`, import.meta.url), 'utf8');

test('a word registered after it was first asked reaches onChange listeners, which ask it again', () => {
  const dictionary = { en: { instructions: 'Enter or Space to pick up' } };
  language.forget();
  language.use?.('ru');
  const first = pageText(dictionary, 'instructions', undefined, 'sf-words-probe');
  assert.equal(first, 'Enter or Space to pick up');
  let said = first;
  const off = language.onChange(() => { said = pageText(dictionary, 'instructions', undefined, 'sf-words-probe'); });
  language.register('sf-words-probe', 'ru', { instructions: 'Enter или пробел — взять' });
  off();
  assert.equal(said, 'Enter или пробел — взять');
  language.forget();
});

test('sf-sortable 1.7.4: a list and the row mode write their words again on a language change', () => {
  const source = read('src/core/js/composition/sortable.mjs');
  assert.match(source, /import \{ followLanguage, language, pageText \} from '\.\.\/page-language\.js';/u);
  // The list: instructions and roledescription, through refreshWords, with the
  // subscriptions ended when the list disconnects.
  assert.match(source, /const offLanguage = language\.onChange\(\(\) => this\.refreshWords\(\)\);/u);
  assert.match(source, /followLanguage\(this\.instructions, \(\) => this\.refreshWords\(\)\)/u);
  assert.match(source, /this\.connection\.signal\.addEventListener\('abort', \(\) => \{ offLanguage\(\); unwatch\(\); \}/u);
  assert.match(source, /refreshWords\(\) \{\n\s+if \(!this\.connection\) return;\n\s+this\.writeInstructions\(\);\n\s+for \(const item of items\(this\)\) if \(item\.closest\('sf-sortable'\) === this\) describeItem\(item\);/u);
  // The row mode's help node.
  assert.match(source, /const offLanguage = language\.onChange\(rewrite\);\n\s+const unwatch = followLanguage\(help, rewrite\);/u);
  // A host's own roledescription stays: only the word this module wrote is replaced.
  assert.match(source, /if \(current !== null && current !== item\[SAID_ROLE\]\) return;/u);
});

test('sf-list-feed 1.5.5: the entries are drawn again when the language changes', () => {
  const source = read('src/smart/list-feed/index.js');
  assert.match(source, /if \(\[\.\.\.\(changed \?\? \[\]\)\]\.includes\("language"\)\) \{\n\s+for \(const item of this\._items\.values\(\)\) \{\n\s+if \(!item\.flags\) continue;\n\s+const \[previous, next\] = this\.neighbours\(item\);\n\s+this\.draw\(item, previous, next\);/u);
});

test('class breadcrumbs 1.3.7: «…» and its menu are named again when the language changes', () => {
  const source = read('src/component/breadcrumbs/js/breadcrumbs.js');
  assert.match(source, /language\.onChange\(relabelAll\);/u);
  assert.match(source, /followLanguage\(document\.documentElement, relabelAll\)/u);
  assert.match(source, /if \(menu\?\.isConnected && menu\.getAttribute\('aria-label'\) !== label\) menu\.setAttribute\('aria-label', label\);/u);
});

test('the five words the ui-view audit reported are in every registry language', () => {
  const index = JSON.parse(read('src/core/lang/index.json'));
  const words = { 'sf-contents': 'more', 'sf-breadcrumbs': 'expandLabel', 'sf-pagination': 'of-pages', 'sf-header-site': 'settings', 'sf-list-feed': 'log-label', 'sf-sortable': 'instructions' };
  for (const code of index.languages) {
    const file = read(`src/core/lang/${code}.js`);
    const start = file.indexOf('var pack = ') + 'var pack = '.length;
    const pack = JSON.parse(file.slice(start, file.indexOf(';\n', start)));
    for (const [component, key] of Object.entries(words)) {
      const word = pack.words[component]?.[key];
      assert.equal(typeof word, 'string', `${code}: ${component} "${key}"`);
      assert.ok(word.length > 0, `${code}: ${component} "${key}" is empty`);
    }
  }
});
