# Language packs

Standard of the SIMAI Framework language file, format `simai.language-pack`,
`schema_version` 1. Owner decision C177 (2026-11-14); study
`control/research/2026-11-14-localization.md` in ui-control. Schema:
`src/core/contracts/language-pack.v1.schema.json`, shipped as
`distr/core/contracts/language-pack.v1.schema.json`
(`$id` `https://simai.io/contracts/language-pack.v1.schema.json`).

This page is the source for the ui-doc page on languages; examples are meant to
be copied.

## In short

- Every component keeps its own words in its own folder, one file per language:
  `lang/en.json`, `lang/ru.json`, `lang/de.json`. There is no shared
  dictionary: two components that both say «Close» each say it.
- **English is built in.** It is inside every component's bundle and never
  costs a request. English is the fallback.
- **Russian is a language file** (owner decision C282, 2026-11-17). It is
  written from the same `lang/ru.json` files and ships as
  `distr/core/lang/ru.js`. A Russian site includes it with one line before
  core (see [A Russian site](#a-russian-site-one-line-before-core)). Without
  that line, core fetches the Russian parts the page shows. Either way the
  page draws the same Russian words as before.
- **Every other language is one pack per language and delivery** — one for the
  whole Framework, one for ui-pro, one for ui-chart, one for a product. A page
  fetches it only when it speaks that language. An English page never fetches
  anything.
- **The Framework's own pack comes in parts, one per component family**
  (the Framework ships Russian; the Kazakh pilot was withdrawn by owner
  decision C278, so a page in a language without a pack says English)
  (`core/lang/<lang>/input.json`, `core/lang/<lang>/pagination.json`, …, and
  `core/lang/<lang>/core.json` for core's own words). A page fetches the parts of
  the families it shows. Each part is a whole pack of the format below; a
  product's pack stays one file.
- A language may ship in parts. A word a pack lacks is said in English, the
  console says so once, `SF.language.missing()` lists it and
  `scripts/language-coverage.mjs` counts it.
- A product adds a language with the same file, or changes one word with one
  call, whichever came first.

## Where a word comes from

For a component on a page whose language is `de`, in this order:

1. the component's own attribute (`next-label="…"`) — the author named it;
2. a word a product gave: registered one by one
   (`SF.language.register('sf-pagination', 'de', {…})`) or in a product's pack
   (`delivery` other than `framework`); between the product's own, the later wins;
3. a word of the Framework's pack (`core/lang/de/<family>.json`) — it never replaces a
   product's word, whichever arrived first;
4. the component's built-in word of that language (en only; ru too in a
   rollback build, below);
5. the same for the language without its region (`de-CH` → `de`);
6. English — and the word is reported as missing;
7. the key itself, with a warning (a defect, never expected).

Packs and single words share one registry, so a component bundle built before
packs existed (an older ui-pro, a product's own element) reads pack words too.

The language is the nearest `[lang]` above the component, else
`SF.language.use()`, else `<html lang>`, else English (standard
simai.smart-component §11.1). A part of a page in another language gets that
language's pack the first time one of its components looks up a word.

## The file

```json
{
  "$schema": "../contracts/language-pack.v1.schema.json",
  "schema": "simai.language-pack",
  "schema_version": 1,
  "delivery": "framework",
  "lang": "de",
  "name": "Deutsch",
  "dir": "ltr",
  "status": "draft",
  "review": "Machine draft with cultural adaptation; needs native review.",
  "coverage": {"words": 964, "translated": 963, "share": 99.9},
  "words": {
    "sf-pagination": {
      "next-label": "Nächste Seite",
      "page-label": "Seite",
      "title-page": "Seite {page}",
      "shown": "{shown} von {total} angezeigt"
    },
    "sf-search": {
      "count-text": {"one": "{n} Ergebnis", "other": "{n} Ergebnisse"}
    },
    "sf-file-size": {"b": "B", "kb": "KB", "mb": "MB", "gb": "GB"}
  }
}
```

| Field | Required | What it is |
|---|---|---|
| `schema` | yes | Always `simai.language-pack`. The format is named without a version. |
| `schema_version` | yes | `1`. A reader refuses a version it does not know. |
| `lang` | yes | Lower-case BCP 47 tag: `de`, `pt-br`, `zh-hans`. A region pack is tried before its language. |
| `words` | yes | Words by component, then by key (below). |
| `delivery` | no | Whose words: `framework` (default), `pro`, `chart`, or a product's own name. A Framework pack gives way to any other. |
| `name` | no | The language's name in itself: `Deutsch`, `简体中文`. |
| `dir` | no | `ltr` (default) or `rtl`. |
| `status` | no | `draft` (default) until a native speaker has read the whole pack, then `reviewed`. |
| `review` | no | Who reviewed it, or what is left to check. |
| `coverage` | no | `{words, translated, share}`: how much of the delivery the pack says. Written by the build script. |

Nothing else is allowed at the top level: a pack carries no dates, months,
number formats or plural rules of its own (see «Numbers and dates»).

### Components and keys

`words` is keyed by the name a component registers its words under:

- a Smart component: its tag, `sf-pagination`, `sf-input-date` (a renamed
  tag's former name works too, until its alias's date);
- a class component: the name its documentation gives, the same as
  `SF.language.register` takes: `sf-modal`, `sf-toast`, `sf-badge`,
  `sf-input-country` (country-code), `download-file`;
- shared core words: `sf-file-size` (the four size units `b`, `kb`, `mb`, `gb`)
  and `sf-relative-day` (`today`, `yesterday`, `tomorrow`, see «Numbers and dates»).

The keys are the keys of the component's `lang/en.json` → `runtime`, and the
words of a trait the component opts into (`x-trait-words` → `words`, for
example `inherited`, `reset`, `described` of `field-inherit@1`): they are looked
up under the component's own name. A key English does not have is an error; a
key the pack lacks is only less coverage. A word English leaves empty on
purpose (`"placeholder": ""`) has nothing to translate and is never missing.
Studio and documentation words (`title`, `events`, `settings`) are not runtime
words and are never in a pack.

### Words, placeholders, punctuation

A word is a string. Braces are filled by the component:

- `{n}` — a number, written in the page language's digits and separators by
  `Intl.NumberFormat`;
- `{name}`, `{count}`, `{label}`, `{time}`, … — text the component gives. A
  word says the placeholders of its Russian word, no fewer and no more, in
  English and in every pack (the build and `language-coverage.mjs` fail
  otherwise), and may put them anywhere: `"Uploading {name}"` is
  `"{name} wird hochgeladen"` in German. When a component's
  Russian word gains a placeholder (`"Скачать файл"` becomes `"Скачать {name}"`),
  every language of that word follows in the same change.

Write the punctuation of the language: quotes `«…»` or `„…“` around a
`{name}`, a space before `%` where the language wants it. The decimal sign of a
number is never a word: `{n}` and every number a component writes take it from
`Intl.NumberFormat` (input-color and theme-generator had a `decimal` word until
the C177 follow-up).

### Plural words

A word that takes a number is an object with one string per plural category of
the language, as `Intl.PluralRules(lang)` names them; `other` is always there:

| Language | Categories | Example |
|---|---|---|
| Turkish `tr` | `one`, `other` | `{"one": "{n} sonuç", "other": "{n} sonuç"}` (a noun after a number stays singular) |
| English `en`, German `de` | `one`, `other` | `{"one": "{n} result", "other": "{n} results"}` |
| Russian `ru`, Polish `pl` | `one`, `few`, `many`, `other` | `{"one": "{n} результат", "few": "{n} результата", "many": "{n} результатов", "other": "{n} результата"}` |
| Arabic `ar` | `zero`, `one`, `two`, `few`, `many`, `other` | |
| Chinese `zh`, Japanese `ja` | `other` | `{"other": "{n} 个结果"}` |

`node -e "console.log(new Intl.PluralRules('de').resolvedOptions().pluralCategories)"`
answers the categories of any language. The build fails on a missing category.

### Numbers and dates

Never in a pack. Numbers, dates, month and weekday names, relative time
(«vor 5 Minuten»), list joining and language and country names are formatted by
`Intl` in the page's locale (`Intl.NumberFormat`, `Intl.DateTimeFormat`,
`Intl.RelativeTimeFormat`, `Intl.DisplayNames`). A word that holds a date or a
time takes it as a placeholder already formatted: `"saved": "Projekt um {time} gespeichert"`.

Known gap (study LC-12): some browsers carry little data for some languages —
headless Chromium answers `M01` for the months and «yesterday» for the day
word of some languages. Desktop Chrome, Edge, Firefox and Safari carry it;
phones are to be checked on devices.

The one exception to «never in a pack»: the three day words «today»,
«yesterday», «tomorrow» are core's words `sf-relative-day`
(`src/core/js/lang/relative-day/`), said only where the browser has no
relative-time words of the language (it answers for another language, or in
English): a page in such a language says its own day word, not
«yesterday, 09:05». Where the browser has the words, they are the browser's.

## A Russian site: one line before core

```html
<html lang="ru">
<head>
  <script src="/assets/simai/distr/core/lang/ru.js"></script>
  <script src="/assets/simai/distr/core/js/core.min.js"></script>
  <link rel="stylesheet" href="/assets/simai/distr/core/css/core.css">
</head>
```

`core/lang/ru.js` is a classic script of the whole Russian pack, about 26 KB
gzip. It registers its words before any component draws. Core then fetches
nothing for Russian, and the first frame of every component is already in
Russian. The file needs no server and no `fetch`, so it works:

- **offline and from `file://`**: a page opened from the disk, a help file, or
  an Electron or WebView shell;
- **in a one-file build**: put the file's text in the same `<script>` before
  core, or concatenate it in front of the bundle you ship. It has no imports
  and needs nothing on the page.

Included after core, it still works: it hands its pack to
`SF.language.registerPack`, and the page draws again once.

Without the line, a Russian page works as any other language with a pack.
Core fetches `core/lang/ru/core.json` and the parts of the families the page
shows. While these are on their way, the Loader holds each component's
definition (below), so the page does not flash English.

### The wait for the page language

When core has asked for the parts of the page's language, `SF.Loader` holds
every component script it adds until those words are here. It preloads the
script meanwhile, so nothing arrives later than it would without the wait. The
wait is at most 800 ms. After that the component draws in English and draws
again when its words arrive. This applies to every language with a pack, and to
a pack of a product named in `SF_BOOT_CONFIG.languages` before core.

```html
<script>window.SF_BOOT_CONFIG = {languageWait: 400};</script>  <!-- ms; 0: never wait -->
```

When `ru.js` came before core, nothing is pending and nothing waits.

### Outside a browser (server-side rendering, generators)

A Node.js script that renders Russian runs the same file before it renders. It
takes the same path as a page:

```js
import {registerLanguageFile} from '@simai-studio/ui-source/scripts/language-file-node.mjs'; // or your path to ui-source
registerLanguageFile('ru');
```

Or read `distr/core/lang/ru.js` and run it with `vm.runInThisContext`.
Without it, `SF.Composition` and the field renderers print English
placeholders and labels in Node.js.

### Rollback: Russian inside the bundles again

`src/core/lang/built-in.json` lists the languages the bundles carry:

```json
{"built_in": ["en"], "complete": ["en", "ru"]}
```

To put Russian back into every bundle, set `"built_in": ["en", "ru"]`, then run
`node scripts/build-language-packs.mjs` and build. The script rewrites every
folder's `lang/index.mjs` (the module a bundle takes its words through) and
core's list of built-in languages. `ru.js` and the Russian parts still ship. A
site that includes `ru.js` keeps working, and core fetches no Russian part.
`complete` names the languages the check requires to have every word; today
these are en and ru.

## How a page gets a pack

Core reads `<html lang>` when it starts. When the language is not built in
(English) and the Framework has a pack of it (`core/lang/index.json` lists
the languages and, for each, the parts and the components each part holds;
the index is inside core), core fetches beside itself the part `core` and the
part of every family whose elements are already in the document, and once more
for the families the parsed document adds. A component drawn later fetches its
family's part with the first word it looks up. Each part is fetched once per
page. The same happens for `SF.language.use('de')` and for a part of the page
with its own `[lang]`. While a part is on its way components say English
without a warning, and draw again when it arrives (once per frame, however
many parts came).

`SF.language.load('de')` fetches every part at once.

A page in a language with no pack makes no request: its words are English, and
the console says once which language had no words. A language whose script
form (`core/lang/<lang>.js`) came before core is already whole: core fetches
none of its parts.

## Add your own language

Write a pack in the format above (all of a component's keys, or only some),
then name it — one line, `SF_BOOT_CONFIG.languages` before core:

```html
<script>
  window.SF_BOOT_CONFIG = {languages: {de: '/assets/my-product/lang/de.json'}};
</script>
<script src="…/distr/core/js/core.min.js"></script>
```

or, after core:

```js
SF.language.addPack('de', '/assets/my-product/lang/de.json');
```

The file is fetched only by pages in `de`, together with the Framework's own
`de` pack if there is one. Set `"delivery"` to your product's name so your
words win over the Framework's.

A pack already in memory (bundled with your code, built on the server) is
registered directly:

```js
import de from './lang/de.json';
SF.language.registerPack(de);
```

`SF.language.load('de')` fetches the packs of a language now and resolves when
they are registered; `SF.language.packs()` lists the packs on the page with
their `delivery`, `status`, `coverage` and URL.

## Change one word

```js
SF.language.register('sf-pagination', 'de', {'next-label': 'Weiter'});
```

A word registered this way wins over the Framework's pack whichever arrived
first (and over your own pack if registered after it), and the page draws again. `null` removes what you registered:
`SF.language.register('sf-pagination', 'de', null)`. Russian and English words
are changed the same way; a word registered before `ru.js` arrived stays over
the file's. One word for one element only: its own attribute
(`next-label="…"`).

## Missing words and coverage

```sh
node scripts/language-coverage.mjs           # ru and en: every word, every plural form (exit 1 on a gap)
node scripts/language-coverage.mjs de        # de: share and the words missing, by component
node scripts/language-coverage.mjs de --json
```

Every run also compares each word's placeholders with its Russian word, in
every folder and every language (`placeholderGaps()` in the same script), and
exits 1 when one differs:
`smart/time: yesterday-at: {time} where ru says {day}, {time}`.

On a page, `SF.language.missing('de')` lists the words said in English so far
(`["sf-pagination|next-label"]`), and the console warns once per language:
`[SIMAI Framework] "de": words missing, said in English (first: sf-pagination "next-label")`.

## Making the packs of a delivery

Sources are the components' own files: `src/smart/<name>/lang/<lang>.json`,
`src/component/<name>/lang/<lang>.json`, `src/core/js/lang/<part>/<lang>.json`,
each `{"runtime": {key: word}}` — the same shape as `en.json`. Whatever the pack
says about the language itself (`name`, `dir`, `status`, `review`) is
`src/core/lang/headers/<lang>.json`. The build collects them:

```sh
node scripts/build-language-packs.mjs           # writes src/core/lang/<lang>/<family>.json, <lang>.js, index.json
                                                # and every folder's lang/index.mjs (from built-in.json)
node scripts/build-language-packs.mjs --check   # fails when a part is stale or a word is wrong
```

It fails on a word whose placeholders differ from English, a missing plural
category, a key English does not have, and one component saying one key two
ways in two folders. A part's family is its component's `family`
(`component.json`); core's words are `core`; a class component without a
Smart one of its name is its own family. A part no source says any more is
removed by the build and reported by `--check`. Each part stays under 8 KB
gzip (the test of C177 (7)): a whole pack of one language had reached 15.2 KB
of a 16 KB cap. The core build ships `src/core/lang/` as `distr/core/lang/`,
the script form `<lang>.js` included (ui-builder: `LANGUAGE_SCRIPT` in
`libs/generatedPackaging.js`).

The bundles say no Russian word (C282). `node scripts/check-bundle-words.mjs
<distr>` reads every literal of every built script and fails on a Cyrillic one.
It allows two kinds: an input-parsing rule marked `c282-allow` in the source
(what a person types, such as `ё` searched as `е`, «мб» read as megabytes, or
«ООО» skipped in initials), and the languages' own names in sf-language's data.

ui-pro, ui-chart and any package of components run the same script over their
own sources and ship the result beside their bundles, then name it with
`SF.language.addPack` in their entry (one file per language per delivery;
`--parts` writes parts instead, which only core knows how to fetch today):

```sh
node ../ui-source/scripts/build-language-packs.mjs --root ../ui-pro/components \
  --delivery pro --out ../ui-pro/components/src/lang
```

In ui-source a language is one unit of the linkage standard,
`module.language-<lang>` (`src/core/passports/`), with its own version: adding
or correcting a translation moves the language's version, not the components'.

## Translating: adapt, do not transcribe

A pack is written for people who read the language every day (owner, C177 (9)):

- **Address.** Use the form the language's software uses with a stranger:
  German `Sie` (`Wählen Sie`), French `vous`, Japanese polite forms.
- **Directness.** Buttons are short verbs in the language's habit (German
  infinitives: `Schließen`, `Speichern`, `Abbrechen`); errors say what to do, not what
  went wrong.
- **Familiar words.** Use the words of the operating systems and big services
  in that language, not a literal rendering of the Russian or English.
- **Numbers and order.** Let the placeholder stand where the language wants it;
  write ordinals as the language writes them (German `Schritt 3`, `Seite {page}`).
- **Do not glue.** A sentence built from pieces cannot be translated. If a
  component puts a word before a name or number in code (`"Go to slide " + 3`),
  that is a defect of the component: ask for one word with a placeholder
  (`"Go to slide {n}"`). A control inside a sentence is a placeholder too: the
  page field of sf-pagination is `{page}` in `"{page} из {count}"`, the name to
  type in sf-confirm is `{name}` in `"Чтобы подтвердить, введите {name}"`;
  the component draws the field or the name where the word puts it.
- **Plurals are objects.** A word that takes a number is a plural word
  (`{"one": …, "other": …}`), never forms joined by «|».
- **Status.** A machine or unreviewed translation is `"status": "draft"`; only a
  native speaker who has read every word sets `"reviewed"` and names themselves
  in `review`.
