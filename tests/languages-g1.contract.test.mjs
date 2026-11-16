import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// C177 follow-ups (queue #86, #113; dispatcher area G, 2026-11-16): a word
// that names a value has the value's place in it, so a language that ends or
// reorders the value can say it; plural words are plural objects; numbers
// take the page language's digits from Intl, not from a word; day words
// and zone names come from the language files where the platform has none.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runtime = (folder, code) => JSON.parse(read(`${folder}/lang/${code}.json`)).runtime;
const LANGS = ['ru', 'en'];

// A function of a component's index.js, taken out of the file (the bundle
// imports lit and styles Node cannot load).
function exported(path, name) {
  const source = read(path);
  const at = source.indexOf(`export function ${name}(`);
  assert.ok(at >= 0, `${path} exports ${name}`);
  let depth = 0;
  let end = source.indexOf('{', at);
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}' && --depth === 0) break;
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return (${source.slice(at + 'export '.length, end + 1)})`)();
}

test('#86 sf-change: one phrase with both values for a screen reader, not a word glued between them', () => {
  for (const code of LANGS) {
    const word = runtime('src/smart/change', code)['change-text'];
    assert.match(word, /\{before\}/u, code);
    assert.match(word, /\{after\}/u, code);
    assert.equal(runtime('src/smart/change', code)['to-text'], undefined, `${code}: the glue word is gone`);
  }
  const template = read('src/smart/change/js/templates/default.js');
  assert.doesNotMatch(template, /words\.to\b/u);
  assert.match(template, /<span class="sr-only">\$\{context\.words\.change\(said\(context, change\.before\), said\(context, change\.after\)\)\}<\/span>/u);
  assert.match(read('src/smart/change/index.js'), /return this\.sfWord\('change-text', \{vars: \{before, after\}\}\)/u);
});

test('#86 slider-range: no Russian words in code; each box is named by one phrase with the name in it', () => {
  const source = read('src/smart/slider-range/index.js');
  assert.doesNotMatch(source, /\|\| '(?:от|до)'/u, 'no Russian fallback beside sfWord');
  assert.doesNotMatch(source, /\[words\[index\], name\]\.filter\(Boolean\)\.join\(' '\)/u, 'no word glued before the name');
  for (const code of LANGS) {
    for (const key of ['from-label', 'to-label']) assert.match(runtime('src/smart/slider-range', code)[key], /\{name\}/u, `${code} ${key}`);
  }
});

test('#86 pagination: «[3] из 12» is one word with the field in it ({page})', () => {
  for (const code of LANGS) assert.match(runtime('src/smart/pagination', code)['of-pages'], /\{page\}.*\{count\}|\{count\}.*\{page\}/u, code);
  const parts = exported('src/smart/pagination/index.js', 'ofPagesParts');
  assert.deepEqual(parts('{page} из 12'), {before: '', after: 'из 12'});
  assert.deepEqual(parts('12 беттің {page}-і'), {before: '12 беттің', after: '-і'}, 'a language may put the count first');
  assert.deepEqual(parts('из 12'), {before: '', after: 'из 12'}, "a product's word from before keeps its place");
});

test('#86 confirm: «Чтобы подтвердить, введите DELETE» is one word with the name in it', () => {
  for (const code of LANGS) assert.match(runtime('src/smart/confirm', code)['require-text'], /\{name\}/u, code);
  const parts = exported('src/smart/confirm/index.js', 'requireParts');
  assert.deepEqual(parts('Чтобы подтвердить, введите {name}'), {before: 'Чтобы подтвердить, введите ', after: ''});
  assert.deepEqual(parts('Растау үшін {name} деп енгізіңіз'), {before: 'Растау үшін ', after: ' деп енгізіңіз'});
  assert.deepEqual(parts('To confirm, type'), {before: 'To confirm, type ', after: ''});
  const template = read('src/smart/confirm/js/templates/default.js');
  assert.doesNotMatch(template, /\$\{context\.requireText\} /u);
  assert.match(template, /aria-label=\$\{context\.requireText\}/u);
});

test('#86 input-image: a button that names its file says one word with the name in it', () => {
  const source = read('src/smart/input-image/index.js');
  assert.doesNotMatch(source, /this\.quote\(/u);
  for (const code of LANGS) {
    const words = runtime('src/smart/input-image', code);
    for (const key of ['chosen-file', 'replace-file', 'remove-file', 'edit-file', 'cancel-upload-file', 'retry-file']) assert.match(words[key], /\{name\}/u, `${code} ${key}`);
    assert.equal(words.quoted, undefined, `${code}: no quote pattern word`);
  }
});

test('#86 file-upload: Remove and Retry are one word with the file name in it', () => {
  assert.doesNotMatch(read('src/component/file-upload/js/_file_upload.js'), /`\$\{word\} \$\{name\}`/u);
  for (const code of LANGS) {
    for (const key of ['remove-name', 'retry-name']) assert.match(runtime('src/component/file-upload', code)[key], /\{name\}/u, `${code} ${key}`);
  }
});

test('#86 plurals: sf-icon and sf-badge count words are plural objects, no «|» lists', async () => {
  for (const folder of ['src/smart/icon', 'src/component/badges']) {
    for (const code of LANGS) {
      const count = runtime(folder, code).count;
      assert.equal(typeof count, 'object', `${folder} ${code}`);
      assert.deepEqual(Object.keys(count).sort(), new Intl.PluralRules(code).resolvedOptions().pluralCategories.slice().sort(), `${folder} ${code}`);
    }
  }
  const {pluralForm} = await import('../src/component/badges/js/_anchored-state.js');
  const ru = runtime('src/component/badges', 'ru').count;
  assert.equal(pluralForm(ru, 21, 'ru'), '{count} непрочитанное');
  assert.equal(pluralForm(ru, 5, 'ru'), '{count} непрочитанных');
  assert.equal(pluralForm({one: 'a', other: 'b'}, 3, 'de'), 'b');
  assert.equal(pluralForm('one|other', 1, 'en'), 'one', 'an author label in «|» still reads');
});

test('#86 decimal sign: a contrast ratio is written by Intl in the page language, not by a word', () => {
  for (const folder of ['src/smart/input-color', 'src/smart/theme-generator']) {
    for (const code of LANGS) assert.equal(runtime(folder, code).decimal, undefined, `${folder} ${code}`);
    const source = read(`${folder}/index.js`);
    assert.doesNotMatch(source, /sfWord\(["']decimal["']\)|word\(["']decimal["']\)/u);
    assert.match(source, /formatNumber\(ratio, ["']number["'], \{node: this\}\)/u);
  }
});

test('#113 relative days: where the platform has no words of the language, core takes them from its language files', async () => {
  for (const code of LANGS) {
    const words = JSON.parse(read(`src/core/js/lang/relative-day/${code}.json`)).runtime;
    assert.deepEqual(Object.keys(words).sort(), ['today', 'tomorrow', 'yesterday'], code);
  }
  const {formatRelativeDay, intlSpeaks} = await import('../src/core/js/format-relative.js');
  const {language} = await import('../src/core/js/page-language.js');
  const now = new Date(2026, 10, 16, 12, 0);
  const yesterday = new Date(2026, 10, 15, 9, 5);
  assert.equal(intlSpeaks('ru'), true);
  assert.equal(intlSpeaks('zz'), false, 'a language the platform does not know');
  language.forget();
  // Before the words arrive: the platform's (its fallback's) word.
  const before = formatRelativeDay(yesterday, {now, locale: 'zz'});
  language.register('sf-relative-day', 'zz', {today: 'zz-today', yesterday: 'zz-yesterday', tomorrow: 'zz-tomorrow'});
  assert.notEqual(before, 'zz-yesterday');
  assert.equal(formatRelativeDay(yesterday, {now, locale: 'zz'}), 'zz-yesterday');
  assert.equal(formatRelativeDay(yesterday, {now, locale: 'zz-QQ'}), 'zz-yesterday', 'the language without its region');
  // A platform that speaks the language keeps its own words.
  language.register('sf-relative-day', 'ru', {yesterday: 'не это'});
  assert.equal(formatRelativeDay(yesterday, {now, locale: 'ru'}), 'вчера');
  language.forget();
});

test('#113 sf-time: a zone is named in any language that has its word, not only ru and en', () => {
  const source = read('src/smart/time/index.js');
  assert.match(source, /globalThis\.__sfPageLanguage\?\.registered\?\.get\?\.\('sf-time'\)/u);
  assert.doesNotMatch(source, /const shipped = \{ru, en\}\[/u);
  for (const code of LANGS) assert.ok(Object.keys(runtime('src/smart/time', code)).filter((key) => key.startsWith('zone-')).length >= 20, `${code} zone words exist to be said`);
});
