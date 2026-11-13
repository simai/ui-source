# Language Smart Component

`sf-language` picks the site's language. It is one element whose look
follows the number of languages it is given:

| Languages | Look |
|---|---|
| 1 | nothing is drawn |
| 2–3 | a segmented switch, every language in sight, one press |
| 4–7 | an icon button (Material Symbols `translate`) that opens a menu |
| 8 and more | the same menu with a search field |

```html
<sf-language languages="ru en" size="1/2"></sf-language>
<sf-language languages="ru en de fr es" size="1/2"></sf-language>
<sf-language languages="ru en de fr es it pt tr pl uk ja ar" size="1/2"></sf-language>
```

The element draws nothing of its own: the switch is `sf-segmented` on
its track, the trigger `sf-button-icon`, the menu
`sf-menu-context` with its search. No flags and no globe.

## Languages

`languages` takes BCP 47 codes separated by spaces or commas: `ru en de ar`,
`pt-BR`. The names of the languages it supports ship with the component
(66 languages, from CLDR, Беларуская, Հայերեն, ქართული, Татар, Кыргызча,
Тоҷикӣ, Башҡорт and Саха тыла among them), so every browser names them alike; the browser
(`Intl.DisplayNames`) names any other code:

- the switch and the menu name each language in itself: «Русский»,
  «English», «Deutsch», «العربية»;
- a menu row shows the English name beside it: «Deutsch … German»;
- the search finds a language by the start of a word of its own name, its
  English name, its name in the page's language or its code, in any case and
  without accents: «нем», «German» and «de» all find Deutsch; «ру» finds
  Русский and Română (румынский), not Беларуская (белорусский);
- the search panel keeps one width while you type (20rem, 18rem in compact
  density; decision C32).

`labels="code"` makes the switch show codes (RU · EN); each segment keeps the
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

## Thresholds

`mode="auto"` (the default) follows the count. `inline-max` (3) is the most
languages shown as a switch, `search-from` (8) the count from which the menu
has a search field. `mode="inline"`, `"menu"` or `"search"` fixes one look
whatever the count; one language draws nothing in every mode. The look in use
is the property `look` and the host attribute `data-look` (`none`, `inline`,
`menu`, `search`).

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
and `mode="search"` as wide as high -- exactly the icon button it then draws.
So a header's tools do not move when the trigger appears, and a page needs no
placeholder of its own. The switch (`mode="inline"`, or `auto`, whose look
depends on how many languages it is given) holds its height only; give a
header picker `mode="menu"` when its width must be known before the code,
or print the switch's static markup: its width is its names', which the page
knows only once something has drawn them.
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

## In a form

With `name` the element is a form field: it submits the chosen code, a form
reset brings back the value it was written with, a disabled element is left
out. There is no separate language input.

```html
<form>
  <sf-language name="language" languages="ru en de fr" value="de" apply="none"></sf-language>
</form>
```

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
`3`. The switch is a button group of that size, as tall as `sf-button` of the
same size; the trigger is an icon button of that size. The menu has two
rungs: its rows are 32 px up to `1/2`, 40 px from `1`.

## Accessibility

- The switch is a radio group named by `label` («Язык» / «Language» by
  default); each language is a radio in its own language (`lang`). Tab
  reaches the chosen language; the arrows, Home and End move and choose.
- The trigger is a button named «Язык: Русский» / «Language: English»: the
  label and the current language in itself; it says it opens a menu and
  whether it is open.
- The menu is named by `label`; each row is a radio item in its own
  language. It opens with the chosen language in view, however far down the
  list it is; without a search the chosen row takes the focus. The arrows
  move, a letter jumps, Enter chooses, Escape closes and returns focus to the
  trigger. With a search the field takes focus when the menu opens, and Down
  moves to the rows.

## Reference

| Attribute | Type | Default | |
|---|---|---|---|
| `languages` | string | `""` | Codes separated by spaces or commas. |
| `items` | list (property, island) | `[]` | `{code, label?, short?, href?}`; replaces `languages`. |
| `value` | string | the page's language | The chosen code. |
| `href` | string | `""` | The address pattern, `{code}` replaced. |
| `mode` | `auto` `inline` `menu` `search` | `auto` | The look. |
| `inline-max` | integer | `3` | The most languages in a switch (auto). |
| `search-from` | integer | `8` | The count from which the menu searches (auto). |
| `labels` | `name` `code` | `name` | Names or codes in the switch. `compact` (boolean) is its dated alias until 2027-01-01. |
| `size` | `1/3` `1/2` `1` `2` `3` | `1` | The ladder rung. |
| `apply` | `page` `none` | `page` | Apply a language without an href to the page. |
| `remember` | string | `""` | A name to keep the choice under (`SF.Preferences` `sf-language/<name>`). |
| `label` | string | «Язык» / «Language» | The control's name. |
| `name` | string | `""` | The form field's name. |
| `disabled` | boolean | `false` | Disables the switch or the trigger. |

| Event | | |
|---|---|---|
| `change` | cancellable | `{value, previous, href, dir, reason: press \| api}`; sent before anything changes. |

| Member | |
|---|---|
| `select({value})` | Chooses a language as a press would (reason `api`); answers `{outcome: 'applied', value}` or `{outcome: 'refused', reason: unknown \| unchanged \| disabled \| prevented}`. |
| `toggleMenu()` | Opens or closes the menu (looks `menu` and `search`). |
| `look` | The look in use: `none`, `inline`, `menu`, `search`. |
| `value` | The chosen code. |

The element has no CSS variables of its own: it draws with
`sf-button-group`, `sf-button-icon` and `sf-menu-context`, whose public
variables reach it.
