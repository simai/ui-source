# Migration: Russian is a language file (C282)

Owner decision C282, 2026-11-17. From the pair that carries it, the SIMAI
Framework's component and core bundles say **English only**. Russian ships as a
language file, built from the same `lang/ru.json` files:

- `distr/core/lang/ru.js` is the whole Russian pack as one classic script, about
  26 KB gzip. A page includes it before core.
- `distr/core/lang/ru/<family>.json` are the parts core fetches by itself for
  a Russian page that did not include the script.

A Russian page with either form draws the same Russian words as before. The
format and the details are in [language-packs.md](language-packs.md#a-russian-site-one-line-before-core).
This note says what each consumer does. Nothing here is required for an
English page.

## The one change for a site

Add one line before core on every page whose language is Russian, or on every
page if the site switches languages:

```html
<script src="<framework base>/distr/core/lang/ru.js"></script>
<script src="<framework base>/distr/core/js/core.min.js"></script>
```

Without the line a Russian page still works. Core fetches the Russian parts the
page shows, a few requests of 0.3 to 8 KB gzip each, and the Loader holds each
component until its words are here, at most 800 ms (`SF_BOOT_CONFIG.languageWait`).
The line removes those requests and the wait. It is required for these cases:

- a page opened from `file://` or in a shell without HTTP (Electron, WebView, a
  help file): there `fetch` of the parts fails, and the page would say English;
- a one-file build: put the file's text in front of core in the same bundle;
- a strict Content-Security-Policy whose `connect-src` does not allow the
  Framework's origin.

## What changes in code that reads the Framework's words

Russian words are no longer reachable as module data; they live in the shared
word registry once the language file is on the page. Code that read them
directly gets `undefined` or English:

| Was | Now |
|:---|:---|
| `WORDS.ru` of `core/js/copy-feedback.js`, `code-copy.js`, `new-tab-link.js`, `display-settings.js`; `INHERITED_TEXT.ru`; `CODE_INPUT_TEXT.ru`; a Smart component's `lang.ru` | `pageText(WORDS, key, node, '<tag>')` or `SF.language` with the language file on the page |
| `EDITOR_FIELD_WORDS.ru` from `composition/editor-words.mjs` (the words module) | `editorFieldMessages(manifest, {locale: 'ru'})`; `SF.Composition.EDITOR_FIELD_WORDS.ru` reads the registered words |
| `countries.json` `nameRu`; `names.json` `ru` | the words `country-<ISO2>` and `name-<code>` of `sf-input-country` and `sf-language` |
| `SF.icons.choices.words[name].ru` | unchanged API: a getter that reads the registered `sf-icon-search` words, empty until the file is on the page |
| `formatFileSize(…, {locale: 'ru'})` in Node.js | the same, after `registerLanguageFile('ru')` |

A product word registered with `SF.language.register(tag, 'ru', {...})` still
wins over the file's word, whichever came first.

## Server-side rendering and generators (Node.js)

`SF.Composition.render`, the field renderers and `formatFileSize` print
English in Node.js unless the Russian file is registered first:

```js
import {registerLanguageFile} from '<ui-source>/scripts/language-file-node.mjs';
registerLanguageFile('ru');
```

Or run `distr/core/lang/ru.js` with `vm.runInThisContext` from a pinned `ui`
checkout.

## By consumer

These are proposals for each owner. ui-source does not edit consumer
repositories.

- **Larena** (`app/Larena/StoragePage/SitePageAssets.php`, the boot script it
  writes): add `core/lang/ru.js` from the pinned delivery to the page's
  `javascript` list before core when the site's language is Russian. Any
  server-side composition render in PHP-driven Node calls needs
  `registerLanguageFile('ru')`. The runtime lock gains the file through the
  pair (it is under `distr/core/lang/`).
- **Docara sites** (ui-doc, larena-doc, docara.simai.io): the page template adds
  the line before core for `ru` pages. The composition runtime that Docara runs
  in Node.js (`resources/framework/composition-runtime/<sha>/`) registers the
  file before it prerenders Russian pages. Without it, placeholders and labels
  of prerendered blocks come out in English. This is for the Docara thread.
- **ui-pro**: `src/smart/editor/index.js` reads `EDITOR_FIELD_WORDS[locale]`
  through the live object; its `ru` comes from the registered words. It works
  with the file on the page. Its own components still embed their own
  `lang/ru.json` (their delivery, `pro`). Moving them to a `pro` language file
  (`build-language-packs.mjs --delivery pro`, which now also writes `ru.js`) is
  a later step for the ui-pro thread, not part of this change.
- **ui-view, ui-chart**: their bundles inline copies of core modules
  (`format-relative.js`, `format-file-size.js`). When rebuilt over this pair,
  their Russian units and relative-time words come from the registry, so a
  Russian page needs the file (or the parts core fetches). Their own words are
  unchanged.
- **ui-admin**: its demo pages (`index.html`, `mock-api.html`,
  `navigation-menu-reference.html`, `modal-demo.html`) add the line before
  core.
- **ui-mail** (`src/ui/index.html`, `lang="ru"`, offline-first): the line is
  required. The app is meant to work without the network, so the parts would
  not arrive.

## Rollback

`src/core/lang/built-in.json` `"built_in": ["en", "ru"]`, then
`node scripts/build-language-packs.mjs` and a build put Russian back into
every bundle. A site that already includes `ru.js` keeps working unchanged.
