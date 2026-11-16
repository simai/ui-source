# Language Smart Component

`sf-language` picks the site's language. It is one element whose look
follows the number of languages it is given:

| Languages | Look |
|---|---|
| 1 | nothing is drawn |
| 2–7 | a button with the `translate` glyph, the current code and an arrow («RU ▾») that opens a menu |
| 8 and more | the same button and menu with a search field |

```html
<sf-language languages="ru en"></sf-language>
<sf-language languages="ru en de fr es"></sf-language>
<sf-language languages="ru en de fr es it pt tr pl uk ja ar"></sf-language>
```

Two languages and forty are the same button, so a site that adds a language
does not change its header. The button keeps one width whatever language is
chosen: it is as wide as the widest code of its list. On a settings page,
where every language should be in sight, `mode="inline"` draws a segmented
switch instead.

The element draws nothing of its own: the trigger is `sf-button`, the menu
`sf-menu-context` with its search, the switch `sf-segmented` on its track.
No flags and no globe.

## Languages

`languages` takes BCP 47 codes separated by spaces or commas: `ru en de ar`,
`pt-BR`. The names of the languages it supports ship with the component
(66 languages, from CLDR, Беларуская, Հայերեն, ქართული, Татар, Кыргызча,
Тоҷикӣ, Башҡорт and Саха тыла among them), so every browser names them alike; the browser
(`Intl.DisplayNames`) names any other code:

- the menu and the switch name each language in itself: «Русский»,
  «English», «Deutsch», «العربية»;
- a menu row shows, beside the name, the language's name in the page's
  language, as it is written in running text: «Deutsch … немецкий» on a
  Russian page, «Deutsch … German» on an English one; nothing when the two
  are the same word («Русский» on a Russian page). The menu is the panel
  width of decision C32, 20rem (18rem compact), so that name is not cut;
- the search finds a language by the start of a word of its own name, its
  English name, its name in the page's language or its code, in any case and
  without accents: «нем», «German» and «de» all find Deutsch; «ру» finds
  Русский and Română (румынский), not Беларуская (белорусский);
- the menu keeps that width while you type in its search;
- from eight languages on a phone (below 44rem) the menu is a sheet at the
  bottom of the screen, the search on top: no field takes the focus, so no
  keyboard covers the list, and the chosen row is in view and focused. Up to
  seven languages it stays a menu by the button.

A variant of a language -- a region or a script -- is named in full in the
menu, «Português (Brasil)», «Português (Portugal)», «中文（简体）», with
«португальский, Бразилия» beside it. The button shows the region only when
the list holds two variants of one language: `PT-BR` and `PT-PT`; a list with
one Portuguese shows `PT`. Chinese is told apart by its script, as Chinese
sites write it: `简体` and `繁體`. A country is not a language: a choice of
country (prices, delivery) is a separate «Регион» control, not sf-language.
No flags.

The trigger always shows the code: `RU`, `EN` (`items[].short` replaces
it). `labels="code"` makes the switch show codes too (RU · EN); each segment keeps the
name as its accessible name. The boolean `compact` that did this before is a
dated alias of `labels="code"` until 2027-01-01, noted in `SF.deprecations`:
the word compact means density only (`data-sf-density`, owner decision C134).

To name a language yourself, give `items` instead, as a property or in the
JSON island; when it holds a language, `languages` is not read:

```html
<sf-language>
  <script type="application/json" data-sf-settings>
    {"items": [{"code": "kk", "label": "Қазақ тілі"}, {"code": "ru"}]}
  </script>
</sf-language>
```

| Field | | |
|---|---|---|
| `code` | required | The language's BCP 47 code. |
| `label` | | Replaces the name the browser gives. |
| `short` | | Replaces the code label (`labels="code"`; the code in capitals). |
| `href` | | The address of the site in this language. |
| `missing` | | `true`: this page has no translation in this language (below). |

## Thresholds

`mode="auto"` (the default) follows the count: from two languages the button
and menu, from `search-from` (8) the menu with a search field. `inline-max`
(1) is the most languages auto still draws as a switch: by default none (it
was 3 before 1.4.0; a page that writes it keeps its switch). `mode="inline"`, `"menu"`, `"search"` or `"field"`
fixes one look whatever the count; one language draws nothing in every mode.
The look in use is the property `look` and the host attribute `data-look`
(`none`, `inline`, `menu`, `search`, `field`).

## What a choice does

A choice sends `change` first. It is cancellable and carries `{value,
previous, href, dir, reason}`. Cancelled, nothing changes: the switch goes
back to the language it showed. Not cancelled:

1. `value` becomes the chosen code; with `remember="<name>"` the code is
   kept as the person's preference (below);
2. a language with an `href` is followed (`location.assign(href)`);
3. otherwise, with `apply="page"` (the default), the page takes the language:
   `SF.language.use(code)` (the components' words, and `lang` on `<html>`)
   and `dir` on `<html>`: `rtl` for languages written right to left (Arabic,
   Hebrew, Persian, Urdu, Pashto, Sindhi, Uyghur, Yiddish, Dhivehi, Sorani,
   Syriac and the Arabic and Hebrew scripts), `ltr` otherwise.

`apply="none"` only changes the value: a settings form whose server applies
the language.

Without `value` the element shows the language of `<html lang>` when the list
has it (the same code, else the same primary language), else the first.

## Sites with an address per language

A site that serves `/ru/` and `/en/` gives each language its address. `href`
is a pattern with `{code}`; an item's own `href` wins:

```html
<sf-language languages="ru en" href="/{code}/"></sf-language>
```

A site that keeps the rest of the path (a Docara site: `/ru/docs/install/`
to `/en/docs/install/`), or that routes itself, cancels `change` and goes:

```js
picker.addEventListener('change', (event) => {
  event.preventDefault();
  const rest = location.pathname.replace(/^\/[^/]+\//u, '/');
  location.assign(`/${event.detail.value}${rest}`);
});
```

## Before it draws

The element holds its own box from the first paint, before its code and its
parts' sheets arrive (core.css, 2026-11-09): one control of its `size` high
(the ladder's control height, 1 when no size is given), and for `mode="menu"`
and `mode="search"` as wide as high. So a header's tools do not move up or
down when the trigger appears, and a page needs no placeholder of its own.
The trigger it then draws is wider than that square: its code and arrow
stand beside the glyph, and their width is the code's, which the page knows
only once something has drawn it. To hold the trigger's width from the first
paint, print the element's static markup.
Static markup printed inside the element (`data-sf-static`) is its own box,
so nothing is reserved then. The box is released when the element marks its
look (`data-look`).

## Remembering the choice

`remember="site"` keeps the chosen code as a preference of the person,
`SF.Preferences` key `sf-language/site`: the browser holds it in
`localStorage` under `sf-pref:sf-language/site` (as JSON, `"en"`), and a
host that keeps preferences for its user (`SF.Preferences.useHost`) gets it
too. Reading it back is the site's, before the first paint, so the page
never shows one language and then another. Put this at the top of `<head>`,
before Core:

```html
<script>
  try {
    const code = JSON.parse(localStorage.getItem('sf-pref:sf-language/site'));
    if (code) {
      document.documentElement.lang = code;
      document.documentElement.dir = /^(ar|he|fa|ur|ps|sd|ug|yi|dv|ckb|syr)(-|$)/.test(code) ? 'rtl' : 'ltr';
    }
  } catch (error) {}
</script>
```

The element then shows that language, because it reads `<html lang>`. A site
with an address per language redirects on the server instead.

## A page without a translation

A language this page has no translation of stays in the list: its menu row
says «нет перевода — откроется главная» («no translation — the home page
opens») under its name, and a choice goes to the site's main page in that
language. The host declares it in one of two ways:

```html
<!-- codes: missing, and the main page of each language as a pattern -->
<sf-language languages="ru en de" href="/{code}/docs/install/" missing="de" home="/{code}/"></sf-language>
```

```json
{"items": [{"code": "ru", "href": "/ru/docs/install/"}, {"code": "en", "href": "/en/docs/install/"},
           {"code": "de", "href": "/de/", "missing": true}]}
```

Without `home`, a missing language goes to its own `href`: give it the main
page's address.

## In a form

With `name` the element is a form field: it submits the chosen code, a form
reset brings back the value it was written with, a disabled element is left
out. There is no separate language input.

```html
<form>
  <sf-language name="language" languages="ru en de fr" value="de" apply="none"></sf-language>
</form>
```

`mode="field"` draws it as the form's other fields: its `label` above, a
dropdown field (`sf-dropdown`, sizes 1/2, 1 and 2) with the languages' names
as its rows, a search from eight. The element stays the form field: it
submits the code by `name`.

```html
<sf-language mode="field" name="letter-language" label="Язык письма" languages="ru en de" apply="none"></sf-language>
```

## On a settings page

`mode="inline"` keeps every language in sight as a segmented switch, for a
settings page or form with few languages. The arrows, Home and End move the
focus between the languages and choose nothing; Enter or Space chooses the
focused one (a choice may reload the page):

```html
<sf-language name="language" languages="ru en" mode="inline" apply="none"></sf-language>
```

## In an app's menu

An app's menu (an account menu, the settings of a reader) has a «Язык» row
with the current language as its value and a submenu of the same rows as
sf-language's menu, the name and beside it its name in the page's language
(C49), with a search from eight. `SfLanguage.menuEntry()` makes that entry
for an `sf-menu-context`; its rows' ids are `language:<code>`:

```js
const SfLanguage = customElements.get('sf-language');
menu.entries = [
  {id: 'theme', text: 'Тема', icon: 'contrast', value: 'Как в системе'},
  SfLanguage.menuEntry({languages: 'ru en de', value: 'ru'}),
];
menu.addEventListener('sf-menu-context-select', (event) => {
  const code = SfLanguage.codeOf(event.detail.id);
  if (code) applyLanguage(code); // the app's own
});
```

`menuEntry({languages, items, value, page, label, missing, home, href,
searchFrom})` takes the element's settings; the submenu opens at the C32
panel width (`entry.width`, sf-menu-context 1.17.0).

## In the site header

At `size="1/2"` the element sits in the tools slot of `sf-header-site`, the
same height as the theme switch beside it:

```html
<sf-header-site>
  <sf-language slot="tools" languages="ru en" size="1/2"></sf-language>
  <sf-segmented slot="tools" theme-switch size="1/2"></sf-segmented>
</sf-header-site>
```

## Sizes

`size` is a rung of the shared ladder: `1/3`, `1/2`, `1` (the default), `2`,
`3`. The trigger is `sf-button` of that size; the switch is a segmented
control as tall as `sf-button` of the same size. The menu has two
rungs: its rows are 32 px up to `1/2`, 40 px from `1`.

## Accessibility

- The trigger is a button named «Язык: Русский» / «Language: English»: the
  label in the page's language and the current language in itself (the code
  it shows is not its name); it says it opens a menu and whether it is open.
- The switch (`mode="inline"`) is a radio group named by `label` («Язык» /
  «Language» by default); each language is a radio in its own language
  (`lang`). Tab reaches the chosen language; the arrows, Home and End move
  the focus; Enter or Space chooses.
- The menu is named by `label`; each row is a radio item in its own
  language. It opens with the chosen language in view, however far down the
  list it is; without a search the chosen row takes the focus. The arrows
  move, a letter jumps, Enter chooses, Escape closes and returns focus to the
  trigger. With a search the field takes focus when the menu opens, and Down
  moves to the rows; on a phone's sheet the chosen row takes it instead.

## Reference

| Attribute | Type | Default | |
|---|---|---|---|
| `languages` | string | `""` | Codes separated by spaces or commas. |
| `items` | list (property, island) | `[]` | `{code, label?, short?, href?}`; replaces `languages`. |
| `value` | string | the page's language | The chosen code. |
| `href` | string | `""` | The address pattern, `{code}` replaced. |
| `mode` | `auto` `inline` `menu` `search` `field` | `auto` | The look; `inline` is the switch of a settings page, `field` a form field. |
| `missing` | string | `""` | Codes this page has no translation of. |
| `home` | string | `""` | The main page's address pattern, for a missing language. |
| `inline-max` | integer | `1` | The most languages auto still draws as a switch (1: none). |
| `search-from` | integer | `8` | The count from which the menu searches (auto). |
| `labels` | `name` `code` | `name` | Names or codes in the switch (`mode="inline"`). `compact` (boolean) is its dated alias until 2027-01-01. |
| `size` | `1/3` `1/2` `1` `2` `3` | `1` | The ladder rung. |
| `apply` | `page` `none` | `page` | Apply a language without an href to the page. |
| `remember` | string | `""` | A name to keep the choice under (`SF.Preferences` `sf-language/<name>`). |
| `label` | string | «Язык» / «Language» | The control's name. |
| `name` | string | `""` | The form field's name. |
| `disabled` | boolean | `false` | Disables the trigger or the switch. |

| Event | | |
|---|---|---|
| `change` | cancellable | `{value, previous, href, dir, reason: press \| api}`; sent before anything changes. |

| Member | |
|---|---|
| `select({value})` | Chooses a language as a press would (reason `api`); answers `{outcome: 'applied', value}` or `{outcome: 'refused', reason: unknown \| unchanged \| disabled \| prevented}`. |
| `toggleMenu()` | Opens or closes the menu (looks `menu` and `search`). |
| `look` | The look in use: `none`, `inline`, `menu`, `search`, `field`. |
| `value` | The chosen code. |

The element has no CSS variables of its own: it draws with
`sf-button-group`, `sf-button-icon` and `sf-menu-context`, whose public
variables reach it.
