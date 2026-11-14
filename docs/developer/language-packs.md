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
  `lang/en.json`, `lang/ru.json`, `lang/kk.json`. There is no shared
  dictionary: two components that both say «Close» each say it.
- **Russian and English are built in.** They are inside every component's
  bundle and never cost a request. English is the fallback.
- **Every other language is one file per language and delivery** — one for the
  whole Framework, one for ui-pro, one for ui-chart, one for a product. A page
  fetches the file only when it speaks that language. A Russian or English page
  never fetches anything.
- A language may ship in parts. A word a pack lacks is said in English, the
  console says so once, `SF.language.missing()` lists it and
  `scripts/language-coverage.mjs` counts it.
- A product adds a language with the same file, or changes one word with one
  call, whichever came first.

## Where a word comes from

For a component on a page whose language is `kk`, in this order:

1. the component's own attribute (`next-label="…"`) — the author named it;
2. a word a product gave: registered one by one
   (`SF.language.register('sf-pagination', 'kk', {…})`) or in a product's pack
   (`delivery` other than `framework`); between the product's own, the later wins;
3. a word of the Framework's pack (`core/lang/kk.json`) — it never replaces a
   product's word, whichever arrived first;
4. the component's built-in word of that language (ru, en only);
5. the same for the language without its region (`kk-KZ` → `kk`);
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
  "lang": "kk",
  "name": "Қазақша",
  "dir": "ltr",
  "status": "draft",
  "review": "Machine draft with cultural adaptation; needs native review.",
  "coverage": {"words": 964, "translated": 963, "share": 99.9},
  "words": {
    "sf-pagination": {
      "next-label": "Келесі бет",
      "page-label": "Бет",
      "title-page": "{page}-бет",
      "shown": "{total} ішінен {shown} көрсетілді"
    },
    "sf-search": {
      "count-text": {"one": "{n} нәтиже", "other": "{n} нәтиже"}
    },
    "sf-file-size": {"b": "Б", "kb": "КБ", "mb": "МБ", "gb": "ГБ"}
  }
}
```

| Field | Required | What it is |
|---|---|---|
| `schema` | yes | Always `simai.language-pack`. The format is named without a version. |
| `schema_version` | yes | `1`. A reader refuses a version it does not know. |
| `lang` | yes | Lower-case BCP 47 tag: `kk`, `de`, `pt-br`. A region pack is tried before its language. |
| `words` | yes | Words by component, then by key (below). |
| `delivery` | no | Whose words: `framework` (default), `pro`, `chart`, or a product's own name. A Framework pack gives way to any other. |
| `name` | no | The language's name in itself: `Қазақша`, `Deutsch`. |
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
- shared core words: `sf-file-size` (the four size units `b`, `kb`, `mb`, `gb`).

The keys are the keys of the component's `lang/en.json` → `runtime`. A key
English does not have is an error; a key the pack lacks is only less coverage.
Studio and documentation words (`title`, `events`, `settings`) are not runtime
words and are never in a pack.

### Words, placeholders, punctuation

A word is a string. Braces are filled by the component:

- `{n}` — a number, written in the page language's digits and separators by
  `Intl.NumberFormat`;
- `{name}`, `{count}`, `{label}`, `{time}`, … — text the component gives. The
  pack must keep every placeholder English has (the build fails otherwise), and
  may put it anywhere: `"Uploading {name}"` is `"{name} жүктелуде"` in Kazakh.

Write the punctuation of the language: quotes `«…»` or `„…“`, the decimal sign
of `input-color`'s `decimal` key, a space before `%` where the language wants it.

### Plural words

A word that takes a number is an object with one string per plural category of
the language, as `Intl.PluralRules(lang)` names them; `other` is always there:

| Language | Categories | Example |
|---|---|---|
| Kazakh `kk`, Turkish `tr`, Uzbek `uz` | `one`, `other` | `{"one": "{n} нәтиже", "other": "{n} нәтиже"}` (a noun after a number stays singular) |
| English `en`, German `de` | `one`, `other` | `{"one": "{n} result", "other": "{n} results"}` |
| Russian `ru`, Belarusian `be`, Ukrainian `uk` | `one`, `few`, `many`, `other` | `{"one": "{n} результат", "few": "{n} результата", "many": "{n} результатов", "other": "{n} результата"}` |
| Arabic `ar` | `zero`, `one`, `two`, `few`, `many`, `other` | |
| Chinese `zh`, Japanese `ja` | `other` | `{"other": "{n} 个结果"}` |

`node -e "console.log(new Intl.PluralRules('kk').resolvedOptions().pluralCategories)"`
answers the categories of any language. The build fails on a missing category.

### Numbers and dates

Never in a pack. Numbers, dates, month and weekday names, relative time
(«5 минут бұрын»), list joining and language and country names are formatted by
`Intl` in the page's locale (`Intl.NumberFormat`, `Intl.DateTimeFormat`,
`Intl.RelativeTimeFormat`, `Intl.DisplayNames`). A word that holds a date or a
time takes it as a placeholder already formatted: `"saved": "Жоба {time} сақталды"`.

Known gap (study LC-12): some browsers carry little data for some languages —
headless Chromium answers `M01` for Kazakh and Uzbek months. Desktop Chrome,
Edge, Firefox and Safari carry it; phones are to be checked on devices.

## How a page gets a pack

Core reads `<html lang>` when it starts. When the language is neither Russian
nor English and the Framework has a pack of it (`core/lang/index.json` lists
them, inside core), core fetches `core/lang/<lang>.json` beside itself — one
request, once per page. The same happens for `SF.language.use('kk')` and for
the first word a component looks up in a part of the page with its own
`[lang]`. While the pack is on its way components say English without a
warning, and draw again when it arrives.

A page in a language with no pack makes no request: its words are English, and
the console says once which language had no words.

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
SF.language.register('sf-pagination', 'kk', {'next-label': 'Әрі қарай'});
```

A word registered this way wins over the Framework's pack whichever arrived
first (and over your own pack if registered after it), and the page draws again. `null` removes what you registered:
`SF.language.register('sf-pagination', 'kk', null)`. Russian and English words
are changed the same way. One word for one element only: its own attribute
(`next-label="…"`).

## Missing words and coverage

```sh
node scripts/language-coverage.mjs           # ru and en: every word, every plural form (exit 1 on a gap)
node scripts/language-coverage.mjs kk        # kk: share and the words missing, by component
node scripts/language-coverage.mjs kk --json
```

On a page, `SF.language.missing('kk')` lists the words said in English so far
(`["sf-change|to-text"]`), and the console warns once per language:
`[SIMAI Framework] "kk": words missing, said in English (first: sf-change "to-text")`.

## Making the packs of a delivery

Sources are the components' own files: `src/smart/<name>/lang/<lang>.json`,
`src/component/<name>/lang/<lang>.json`, `src/core/js/lang/<part>/<lang>.json`,
each `{"runtime": {key: word}}` — the same shape as `en.json`. Whatever the pack
says about the language itself (`name`, `dir`, `status`, `review`) is
`src/core/lang/headers/<lang>.json`. The build collects them:

```sh
node scripts/build-language-packs.mjs           # writes src/core/lang/<lang>.json and index.json
node scripts/build-language-packs.mjs --check   # fails when a pack is stale or a word is wrong
```

It fails on a word whose placeholders differ from English, a missing plural
category, a key English does not have, and one component saying one key two
ways in two folders. The core build ships `src/core/lang/` as `distr/core/lang/`.

ui-pro, ui-chart and any package of components run the same script over their
own sources and ship the result beside their bundles, then name it with
`SF.language.addPack` in their entry (one pack per language per delivery):

```sh
node ../ui-source/scripts/build-language-packs.mjs --root ../ui-pro/components \
  --delivery pro --out ../ui-pro/components/src/lang
```

In ui-source a language is one unit of the linkage standard,
`module.language-<lang>` (`src/core/passports/`), with its own version: adding
or correcting a translation moves the language's version, not the components'.

## Translating: adapt, do not transcribe

A pack is written for people who read the language every day (owner, C177 (9)):

- **Address.** Use the form the language's software uses with a stranger: Kazakh
  polite `Сіз` (`Таңдаңыз`, `Енгізіңіз`), German `Sie`, French `vous`.
- **Directness.** Buttons are short verbs in the language's habit (Kazakh
  verbal nouns: `Жабу`, `Сақтау`, `Болдырмау`); errors say what to do, not what
  went wrong.
- **Familiar words.** Use the words of the operating systems and big services
  in that language, not a literal rendering of the Russian or English.
- **Numbers and order.** Let the placeholder stand where the language wants it;
  write ordinals as the language writes them (Kazakh `3-қадам`, `{page}-бет`).
- **Do not glue.** A sentence built from pieces cannot be translated. If a
  component puts a word before a name or number in code (`"Go to slide " + 3`),
  that is a defect of the component: ask for one word with a placeholder
  (`"Go to slide {n}"`).
- **Status.** A machine or unreviewed translation is `"status": "draft"`; only a
  native speaker who has read every word sets `"reviewed"` and names themselves
  in `review`.
