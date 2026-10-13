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
