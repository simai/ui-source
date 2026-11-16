# Smart Icon

`sf-icon` renders one Material Symbol through the Framework icon primitive and
Core Loader. The host reserves its final token size before upgrade; the glyph is
shown only after the exact local subset or package-owned fallback is ready.

## Basic use

```html
<span class="flex items-center gap-1">
  <sf-icon icon="home"></sf-icon>
  <span>Главная</span>
</span>
```

The icon is decorative by default and is hidden from assistive technology. If a
standalone symbol carries information that is not present in adjacent text, give
it a concise `label`; the rendered glyph receives `role="img"` and that name.

```html
<sf-icon icon="verified" label="Проверено"></sf-icon>
```

An icon inside a button remains decorative. Put the accessible name on the
button because the control owns the action.

## Sizes (owner decision C151)

A size is the UI ladder step of the icon's host, the same name as the button,
field or row beside it. A region opts in with `data-sf-icon-scale="ladder"` (on
`<html>`, a container or the icon itself):

| size | desktop | phone, compact |
|---|---|---|
| `1/3` | 16 | 16 |
| `1/2` | 20 | 16 |
| `1` | 24 | 20 |
| `2` | 28 | 24 |
| `3` | 36 | 24 (compact 28) |
| `4` … `7` | 28, 32, 36, 40 | one step down (empty states) |

```html
<html data-sf-icon-scale="ladder">
  <!-- a text-1 row: size 1 -->
  <sf-icon icon="folder" size="1"></sf-icon>
```

Outside such a region the old icon scale answers until 2027-01-01 (journal
`value-icon-size-ladder`): `1/4`, `1/3`, `1/2`, `1`, `2`, `3` draw 12, 12, 14,
16, 20, 24 (phone one step down), and each use is noted in `SF.deprecations`
with the ladder name that draws the same (`1` → `1/3`, `2` → `1/2`, `3` →
`1`). After the date the ladder is the default. Without a size the glyph takes
the size the component around it gives, otherwise 24 (phone 20).

In running text the icon sits on the middle of the line; take the step one above
the text: a 16 px paragraph (text 1) takes a 20 px icon, `size="1/2"` on the
ladder.

## Unknown names

A name the font does not draw keeps an empty box of its size: the glyph is
clipped to its box, and once loaded a glyph that draws as letters is marked
`data-sf-icon-missing` and named once per page in the console with the nearest
real name («sf-icon: no icon "setings"; nearest: "settings"»). The list of names
is fetched from the Framework's distribution (`core/contracts/icon-names.v1.json`)
only then.

## Right to left

In a `dir="rtl"` part the glyphs that point along the line turn over: arrows,
chevrons, send, reply, undo and redo, lists and indents, open in new, log in and
out. Clocks, checks, media and logos do not. `mirror="auto|on|off"` (auto by
default) turns any glyph (`on`) or none (`off`).

## Weight, grade, optical size, fill

- Unset, the glyph takes the weight of the text around it: regular beside
  running text, medium beside a medium label. The regular and medium faces come
  in one request. `weight="100|…|700"` sets it.
- Unset, `grade` is 0 on a light theme and -25 on a dark one; `optical-size`
  follows the glyph's size (20 up to 20 px, then the size, 48 at most). The icon
  service draws grade 0 and optical size 24, so both show where the full
  variable font draws.
- `filled` is the author's: the pressed or chosen state draws filled (C12).
- `type="outlined"` is the one family (1.2.0); `rounded`, `sharp` and `shape`
  draw outlined until 2027-01-01.

## Own and brand icons

```js
SF.icons.register('larena', '<svg viewBox="0 0 24 24"><path d="…"/></svg>');
```

The name then works wherever an icon name is accepted: `sf-icon`, a button's
`icon-start`, a menu row, a tab, the class markup `<i class="sf-icon">larena</i>`.
The SVG is drawn in the current colour at the glyph's size; its name never goes
to the icon font request.

## One meaning, one glyph

`core/contracts/icon-meanings.v1.json` holds the glyph the Framework writes for
each meaning (more → `more_horiz`, open a list → `expand_more`, next →
`chevron_right` …) and the alternates found in products. A product build runs
`scripts/check-icon-alternates.mjs <dir>` to be warned about the alternates;
there are no alias names.

## Choosing an icon

`SF.icons.choices` is the list of 120 glyphs a person chooses from (a menu row,
a record section); `SF.icons.choices.words[name]` gives each glyph's Russian and
English words. `sf-dropdown` finds icon options by those words in either
language («папка», «folder»).

## Badges

- `badge-count`, `badge-dot`, `badge-cap` (99) and `badge-label` put a count or
  a dot on the icon (simai/ui-source#12). The glyph then stands in a
  `.sf-badge-anchor` of its own box; the badge's step follows `size` (1/4 to 1:
  a dot; 2: a dot; 3 and none: a small count; 4 and 5: medium; 6 and 7: large).
  With `label` the anchor is the image and is named «Почта, есть новое»; without
  one the phrase is said in hidden words.

Do not set `loaded` manually. It is a value, not a setting (`component.json`
`values`): the state synchronized from the exact descriptor known to Loader. Changing `icon`, family or an axis requests a
new cumulative subset and hides the ligature until that descriptor is ready.

On the next page of the same origin an `sf-icon` (and the one inside an
`sf-icon-button`) draws its glyph from its first render: the core runtime puts
in the subset the last page used before any component renders, and the Loader
counts its icons as loaded. A site does nothing for it; on an older pair a
`cacheVersion` in `SF_BOOT_CONFIG` and a preconnect to the subset host do most
of it:

```html
<link rel="preconnect" href="https://icons.simai.io" crossorigin>
<script>
  window.SF_BOOT_CONFIG = {cacheVersion: 'ui-2d39b617a719'};
</script>
```

See `docs/developer/icon-subset-runtime.md` («The next page on the same
origin», `icons.remember`).

Color inherits the current semantic text/icon role. Use Framework role utilities
or the documented semantic custom property rather than a literal color.

## Ownership

Smart Icons owns accessible rendering, descriptor normalization and Loader
registration. The ordinary Icons component owns font presentation and tokens;
Core Loader owns subset, cache and package fallback. The host owns the icon's
meaning and the accessible name of any containing control.

## Public variables

Each falls back to the internal token, so a page sets only what it changes
(standard simai.smart-component 1.3.8 §6):

- `--sf-icon-color` — the glyph's ink where no component around it sets its
  own; a button, a field or a menu still gives its icons their ink;
- `--sf-icon-glyph-size` — font size, width and height together;
- `--sf-icon-weight`, `--sf-icon-fill` — the glyph's weight and the font's `FILL` axis;
- `--sf-icon-line-height` — the glyph's line box.

## Distribution path

`sf-icon` is served from `smart/icon/` (`js/icon.js`), loader bundle `cl-icon`.
Until 2026-12-01 `smart/icons/js/icons.js` is a forwarding script that loads
it and notes the old path in `SF.deprecations`, and a rule naming `cl-icons`
loads `cl-icon` (change journal `path-smart-icons-to-icon`).

The interface is `component.json`; examples are `examples.json`.
