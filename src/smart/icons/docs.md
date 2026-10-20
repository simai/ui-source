# Smart Icons

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

## Families and axes

- `type="outlined|rounded|sharp"` selects a Material Symbols family. The old
  value `shape` is accepted as an alias for `sharp`.
- `filled` selects the filled state.
- `weight="100|200|300|400|500|600|700"` selects a Framework-supported weight.
- `grade="-50..200"` adjusts emphasis without changing the component scale.
- `optical-size="20..48"` selects the source font optical axis.
- `size="1/4|1/3|1/2|1|2|3|4|5|6|7"` uses the Framework icon-size tokens.
- `badge-count`, `badge-dot`, `badge-cap` (99) and `badge-label` put a count or
  a dot on the icon (simai/ui-source#12). The glyph then stands in a
  `.sf-badge-anchor` of its own box; the badge's step follows `size` (1/4 to 1:
  a dot; 2: a dot; 3 and none: a small count; 4 and 5: medium; 6 and 7: large).
  With `label` the anchor is the image and is named «Почта, есть новое»; without
  one the phrase is said in hidden words.

Do not set `loaded` manually. It is compatibility state synchronized from the
exact descriptor known to Loader. Changing `icon`, family or an axis requests a
new cumulative subset and hides the ligature until that descriptor is ready.

Color inherits the current semantic text/icon role. Use Framework role utilities
or the documented semantic custom property rather than a literal color.

## Ownership

Smart Icons owns accessible rendering, descriptor normalization and Loader
registration. The ordinary Icons component owns font presentation and tokens;
Core Loader owns subset, cache and package fallback. The host owns the icon's
meaning and the accessible name of any containing control.
