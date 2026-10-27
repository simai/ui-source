# Smart Tag

Declarative runtime projection of the ordinary Tags component. The visible
root preserves the ordinary BEM classes and applies `root-class`, author
`style` and `root-style`; the custom-element host remains boxless.

## Public element

- custom element: `sf-tag`;
- template: `default`;
- ordinary owner: `tags`;
- Loader bundle: `cl-tag` (`cl-tags` is its dated alias until 2026-12-01, and
  `smart/tags/js/tags.js` a forwarding script that loads `smart/tag/js/tag.js`;
  change journal `path-smart-tags-to-tag`);
- interface: `component.json` (standard 1.3.8).

## Inputs

- content: `text`, `count`, `icon`, `color-class`, `avatar-image-url`,
  `avatar-text`, `avatar-status`;
- presentation: `kind`, `status`, `appearance`, `size`, `line`, `spacing`,
  `inline`, `root-class`;
- state: `active` (a value: the tag holds it and reports it), `disabled`,
  `closable` (absent: the kind decides), `interactive`;
- accessible names: `aria-label` (a host attribute), `close-label` («Удалить»,
  "Remove" in the page's language when unset).

`type` is the old name of both `kind` and `status`: a content word written as
`type` still reaches `kind`, a status word `status`, and each use is noted in
`SF.deprecations` until 2026-12-01 (journal `attribute-tag-type-split`).

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

- `kind="checkbox"` renders one native toggle button, reflects `active` through
  `aria-pressed` and emits `change` with `detail.active` (Space or Enter toggle
  it);
- all other types render a static label; if `closable` is enabled, the only
  interactive descendant is the separately named remove action;
- `interactive` (not for checkbox tags) renders the label, leading content and
  count as one native button beside the separate remove action. Use it when the
  tag opens something, such as a filter chip menu: the tag is then reachable by
  Tab and activates with Enter or Space, and a host `click` listener receives
  clicks on the label but not on the remove action;
- `sf-tag-close` is emitted once when the remove action is pressed, with an
  empty `detail`; the old name `close` follows it as a dated alias until
  2026-12-01. Neither event carries the element any more (standard 1.3.8 §8):
  the listener has it as `event.target`;
- disabled controls emit neither `change` nor `close`;
- the old kind `quantity` is a dated alias of `default` until 2026-12-01 and
  must not be used in new markup.

## Slots

The source-owned template accepts `leading`, `text`, `count`, `close` and
`avatar`. A slot replacement preserves the same semantic ownership: decorative
leading content must not add a Tab stop, and a close slot must expose one native
named action.

External project templates remain available at
`/local/smart/templates/tag/<template>/index.js` and `index.css`.
