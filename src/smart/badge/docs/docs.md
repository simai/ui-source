# Smart Badge

The default template applies shared `root-class`, `style` and `root-style`
settings to its root. Use Framework utilities and semantic tokens; the outer
Smart host remains boxless. Styling does not replace component state or actions.

Smart/runtime wrapper for the base `badges` component. Badge is static metadata,
not a button or a filter chip, so it does not add keyboard or pointer behavior.

Tag:

- `sf-badge`

Loading model:

- detected by `tags: ['sf-badge']` in `src/smart/badge/rule.js`
- loaded as smart bundle `cl-badge` (`cl-badges` is its dated alias until
  2026-12-01, and `smart/badges/js/badges.js` a forwarding script that loads
  `smart/badge/js/badge.js`; change journal `path-smart-badges-to-badge`)
- base styles and base component JS are loaded through relation with `badges`
- updates are batched through the shared `SfBaseElement`; default strategy uses `lit` DOM patching

Main attributes:

- `template`
- `size`
- `appearance`
- `scheme`
- `status`
- `activity`
- `compact`
- `line`
- `text`
- `icon`
- `icon-start`
- `icon-end`
- `icon-position`
- `aria-label`

The old names are dated aliases until 2026-12-01 (`aliases.json`): `type` for
`appearance`, `icon-left` and `icon-right` for `icon-start` and `icon-end`, and
the values `danger` (status error), `left` and `right` (icon-position start
and end). The shim writes the new attribute and notes each use in
`SF.deprecations`. A status word written as `scheme` still reaches `status`.

Supported `appearance` values:

- `main`
- `tonal`
- `outline`

Supported `scheme` values:

- `neutral`
- `primary`
- `secondary`
- `tertiary`
- `info`
- `success`
- `warning`
- `danger`
- `on-surface`

Supported `size` values:

- `1/3` — compact metadata using the `1/3` typography and UI-spacing tokens
- `1/2` — medium metadata using the `1/2` token profile
- `1` — standard metadata using the `1` token profile

The profiles are adaptive rather than fixed pixel promises. The three computed
sizes must remain strictly increasing in every supported breakpoint.

## Variant contract

The Figma source defines 42 supported combinations:

- `neutral`, `primary`, `secondary` and `tertiary`: `main`, `tonal` and
  `outline`, each in all three sizes;
- `on-surface`: `main` and `outline`, each in all three sizes.

SIMAI Framework adds 36 semantic combinations for status-oriented interfaces:

- `info`, `success`, `warning` and `danger` support `main`, `tonal` and
  `outline`, each in all three sizes;
- all colors are resolved through theme-aware semantic tokens; `danger` maps
  to the Framework `error` token family.

`tonal + on-surface` is not a designed variant. If it is supplied, the
component resolves it to `main + on-surface`. Unknown type, scheme and size
values fall back to `main`, `neutral` and `1/3` respectively.

The dark semantic badge from the UI Kit is `main + on-surface`; it is not an
additional `inverse` scheme:

```html
<sf-badge appearance="main" scheme="on-surface" size="1/2" text="PHP 8.2"></sf-badge>
```

When no text or `text` slot is supplied, the text container is omitted. This
keeps icon-only badges at their designed width.

Icons created from `icon`, `icon-start` or `icon-end` are decorative and hidden
from assistive technology. Visible text is the default accessible content. For
an icon-only badge or a shortened count such as `99+`, provide a full
`aria-label`; the template projects it as `sr-only` text. With neither text nor
label the badge is decorative. The host owns any `aria-live` or `role="status"`
policy because only the application knows whether an update must be announced.

## Run state

`activity` says where a run stands. It is a second axis beside `status`, which
says how something went:

| `activity` | Mark                   | Colour role | Word (en)        |
| ---------- | ---------------------- | ----------- | ---------------- |
| `running`  | spinner                | neutral     | Running          |
| `waiting`  | icon `pending_actions` | warning     | Needs your input |
| `done`     | icon `check_circle`    | success     | Ready            |
| `stopped`  | icon `stop_circle`     | neutral     | Stopped          |
| `failed`   | icon `error`           | error       | Failed           |

```html
<sf-badge activity="waiting"></sf-badge>
<sf-badge activity="running" appearance="tonal"></sf-badge>
<sf-badge activity="done" text="Published"></sf-badge>
```

- The word is in the page's language (`lang/`, runtime `activity-*`). `text` and
  the `text` slot override it; `icon` overrides the icon or the spinner.
- A set `activity` wins over `status` and `scheme` for the icon, the text and the
  colour. Both stay readable on the element for a host that still sets them.
- A state always has a shape: an empty `icon-start` or `icon-end` at the icon's
  place does not take the mark away.
- The badge is no live region and says nothing when the state changes. A host
  that wants an announcement uses its own polite region.
- Under `prefers-reduced-motion: reduce` the spinner stands still (its still
  frame, from the spinner sheet).

`compact` shows the icon alone, for a tight list row. The text stays as the
accessible name, the box closes to a square, and `appearance` keeps its own
meaning. It needs something to show: with no icon, spinner or icon slot the text
stays visible.

```html
<sf-badge activity="failed" compact></sf-badge>
```

## Slot overrides

Supported light-DOM slot names:

- `icon-start`
- `icon-end`
- `text`

The legacy slot names `icon-left` and `icon-right` remain compatible.

Example:

```html
<sf-badge appearance="main" scheme="primary" text="99+">
  <span slot="icon-start"><i class="sf-icon">arrow_upward</i></span>
</sf-badge>
```

## External project templates

Supported through `SfBaseElement` with:

- `/local/smart/templates/badge/<template>/index.js`
- `/local/smart/templates/badge/<template>/index.css`
