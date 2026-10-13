# Smart Tag

Declarative runtime projection of the ordinary Tags component. The visible
root preserves the ordinary BEM classes and applies `root-class`, author
`style` and `root-style`; the custom-element host remains boxless.

## Public element

- custom element: `sf-tag`;
- template: `default`;
- ordinary owner: `tags`;
- Loader bundle: `cl-tags`.

## Inputs

- content: `text`, `count`, `icon`, `color-class`, `avatar-image-url`,
  `avatar-text`, `avatar-status`;
- presentation: `type`, `size`, `root-class`;
- state: `active`, `disabled`, `closable`, `interactive`;
- accessible names: `aria-label`, `close-label`.

Supported types are `checkbox`, `icon`, `default`, `color`, `avatar`,
`success`, `error` and `warning`. Supported sizes are `1/2` and `1`.

`appearance="default|surface|ghost"` is a separate axis from `type`, because a
tag's type says what it carries or what it reports, not how it looks. Surface and
ghost read the neutral alpha ramp rather than a colour of their own: surface
keeps a faint fill and a boundary one step stronger, ghost keeps nothing until it
is hovered. Both are right in a light and in a dark theme without being
redeclared.

Only the neutral types (`default`, `icon`, `color`, `avatar`, `checkbox`) take an
appearance: a `success`, `error` or `warning` tag carries its meaning in its
colour, and draining that colour would drain the meaning. Selection and press
keep the primary container the tag already uses for both, because on a tag
pressing shows what being chosen looks like.

## Behavior

- `type="checkbox"` renders one native toggle button, reflects `active` through
  `aria-pressed` and emits `change` with `detail.active`;
- all other types render a static label; if `closable` is enabled, the only
  interactive descendant is the separately named remove action;
- `interactive` (not for checkbox tags) renders the label, leading content and
  count as one native button beside the separate remove action. Use it when the
  tag opens something, such as a filter chip menu: the tag is then reachable by
  Tab and activates with Enter or Space, and a host `click` listener receives
  clicks on the label but not on the remove action;
- `close` is emitted once with the owning component in `detail.component`;
- disabled controls emit neither `change` nor `close`;
- the compatibility input `type="quantity"` is normalized to `default` and
  must not be used in new markup.

## Slots

The source-owned template accepts `leading`, `text`, `count`, `close` and
`avatar`. A slot replacement preserves the same semantic ownership: decorative
leading content must not add a Tab stop, and a close slot must expose one native
named action.

External project templates remain available at
`/local/smart/templates/tag/<template>/index.js` and `index.css`.
