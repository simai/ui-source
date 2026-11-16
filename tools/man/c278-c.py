#!/usr/bin/env python3
"""C278 addendum (group build 9): the Kazakh word forms left after c278-a/b. The sf-language
`items` example names German; the remaining Kazakh examples in a schema description, a comment,
a version note and tests become German, Hungarian or Ukrainian ones. No behaviour changes."""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
def sub(path, old, new, count=1):
    p = root / path; s = p.read_text(encoding='utf-8')
    assert s.count(old) == count, (path, old, s.count(old)); p.write_text(s.replace(old, new), encoding='utf-8')
for f in ['src/smart/language/component.json', 'src/smart/language/smart.manifest.json']:
    sub(f, '(«Қазақша» written otherwise)', '(«Deutsch» written otherwise)')
sub('src/core/contracts/language-pack.v1.schema.json', 'The language\'s name in itself: Қазақша, Deutsch.', 'The language\'s name in itself: Deutsch, Français.')
sub('src/component/swiper/js/index.js', "// The number has its place in the word ({n}): «Go to slide 3», «3-слайдқа\n      // өту» (C177 (9)).",
    "// The number has its place in the word ({n}): «Go to slide 3», «Folie 3\n      // anzeigen» (C177 (9)).")
sub('src/smart/list-feed/component.json', '(word new-text: «Новые», «New», «Жаңа»)', '(word new-text: «Новые», «New»)')
sub('tests/browser/context-menu-search-scroll.browser.mjs', "'Українська', 'Қазақша', '日本語'", "'Українська', 'Hrvatski', '日本語'")
sub('tests/language.contract.test.mjs', "'繁體', 'Қаз', ''", "'繁體', 'Укр', ''")
sub('tests/languages-g1.contract.test.mjs', "assert.deepEqual(parts('12 беттің {page}-і'), {before: '12 беттің', after: '-і'}, 'a language may put the count first');",
    "assert.deepEqual(parts('12 oldalból {page}.'), {before: '12 oldalból', after: '.'}, 'a language may put the count first');")
sub('tests/languages-g1.contract.test.mjs', "assert.deepEqual(parts('Растау үшін {name} деп енгізіңіз'), {before: 'Растау үшін ', after: ' деп енгізіңіз'});",
    "assert.deepEqual(parts('Zum Bestätigen {name} eingeben'), {before: 'Zum Bestätigen ', after: ' eingeben'});")
print('ok')
