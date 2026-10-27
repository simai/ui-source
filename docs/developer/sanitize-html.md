# Untrusted HTML: `SF.sanitizeHtml`

HTML that comes from somewhere else -- a server's answer, an AI assistant's
reply, a message -- is put on the page through `SF.sanitizeHtml`, never through
`innerHTML` or Lit's `unsafeHTML` on the string itself. Core publishes it as
soon as `core.js` has run (`src/core/js/sanitize.js`; `loaded_by: core` in
`src/core/contracts/public-js-api.json`).

```js
const fragment = window.SF.sanitizeHtml(html);              // DocumentFragment
element.replaceChildren(fragment);

window.SF.sanitizeHtml(html, {codeLanguage: true});         // keep language-* on <code>
window.SF.sanitizeHtml(html, {elements: ['p', 'br', 'a']}); // a narrower list
window.SF.safeHref('https://example.com/a');                // the href kept, or null
```

`SF.sanitizeHtml(html, policy?)` returns a `DocumentFragment` of
`policy.document` (the page's document by default). Anything that is not a
string, and the empty string, gives an empty fragment. The function has no
state and loads nothing.

## The rules

- **Parsing is inert.** The input is parsed in a `<template>`: nothing runs,
  nothing loads and no handler fires while it is read. The result is built node
  by node from an allowlist; the input string is never assigned to a live
  element.
- **Elements kept:** `p br strong em code pre ul ol li blockquote a table thead
  tbody tr th td h2 h3 h4 del`. `policy.elements` may narrow the list; it never
  brings back an element of the next point.
- **Dropped with their content:** `script style iframe object embed svg math
  template frame frameset applet noscript noembed noframes textarea select
  option button input form head title meta link base img video audio source
  track canvas picture xmp plaintext portal slot`, and every element outside
  the HTML namespace. Their content is not text meant for a reader.
- **Unwrapped:** any other element off the list (`h1`, `s`, `span`, `div`, ...)
  is replaced by its children; its text stays.
- **Attributes:** all are dropped -- `style`, `class`, `id`, `on*`, `data-*`
  included -- except:
  - `href` on `<a>`, when `SF.safeHref` keeps it;
  - `colspan` and `rowspan` on `th`/`td`, as a number from 1 to 50;
  - `scope` on `th`/`td`, one of `row col rowgroup colgroup`;
  - one `language-*` class on `<code>` (letters, digits, `+ # -`, at most 24),
    only when the caller passes `codeLanguage: true`. Off by default.
- **Links.** `SF.safeHref` keeps `http:`, `https:` and `mailto:` URLs and
  root-relative paths (`/docs/a`), judged after trimming and removing control
  characters, so `java\tscript:` and entity-encoded schemes do not pass.
  `//host` and `/\host` leave the origin and are not kept. A link whose href is
  not kept becomes its text. Every kept link gets `rel="noopener noreferrer
  nofollow"` and `target="_blank"`.

## Where it is used

`sf-chat-window` (ui-pro) cleans an assistant's `html` with it again,
whatever the host did first: `simai.chat-port` 1.0.0 says the component
sanitizes the HTML a second time, because a server bug or a compromised answer
must still not execute in the reader's browser.

## Tests

`tests/browser/sanitize-html.browser.mjs` runs on the built `core.js` in a real
browser, where the parser that decides what HTML means is the browser's own.
Its vectors and expected outputs are the chat window's, unchanged (ui-chat
`tests/browser/sanitize.test.mjs` at 0304327): the schemes `javascript:`,
`data:` and `vbscript:` in mixed case, with entities and whitespace; nested
forbidden elements; and the families of the OWASP XSS filter evasion cheat
sheet. Nothing executes, no element or attribute off the list survives, and
the same input gives the same output as the chat's copy did.
