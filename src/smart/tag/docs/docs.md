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

- content: `text`, `count`, `icon`, `color` (a hue of the static palette by
  name, or a hex drawn in the nearest hue), `color-class`, `avatar-image-url`,
  `avatar-text`, `avatar-status`;
- link: `href` (C145 (6));
- in a group: `key` (the tag's id in `sf-tag-group`'s `selected` and
  `selected-ids`; empty: its text);
- presentation: `kind`, `status`, `appearance`, `size`, `height`, `line`,
  `inline`, `root-class`;
- state: `active` (a value: the tag holds it and reports it), `disabled`,
  `closable` (absent: the kind decides), `interactive`;
- accessible names: `aria-label` (a host attribute), `close-label` («Удалить»,
  "Remove" in the page's language when unset).

`height` (`low`, `default`, `high`, `highest`) picks the tag's height from the
size's steps, as on `sf-button` (C27). `spacing` is its former name until
2027-01-01 (journal `attribute-tag-spacing-to-height`): `compact`,
`comfortable` and `spacious` draw as `low`, `high` and `highest`.

`type` is the old name of both `kind` and `status`: a content word written as
`type` still reaches `kind`, a status word `status`, and each use is noted in
`SF.deprecations` until 2026-12-01 (journal `attribute-tag-type-split`).

Supported types are `checkbox`, `icon`, `default`, `color`, `avatar`,
`info`, `success`, `error` and `warning`. Supported sizes are `1/2` and `1`.

`appearance="default|outline|ghost"` is a separate axis from `type`, because a
tag's type says what it carries or what it reports, not how it looks. Outline and
ghost read the neutral alpha ramp rather than a colour of their own: outline
keeps a faint fill and a hairline edge one step stronger, ghost keeps nothing until it
is hovered. `surface` is the former name of `outline` until 2027-01-01 (journal
`value-tag-appearance-surface-to-outline`) and draws the same. Both are right in a light and in a dark theme without being
redeclared.

Only the neutral types (`default`, `icon`, `color`, `avatar`, `checkbox`) take an
appearance: an `info`, `success`, `error` or `warning` tag carries its meaning in its
colour, and draining that colour would drain the meaning. Selection and press
keep the primary container the tag already uses for both, because on a tag
pressing shows what being chosen looks like.

## Behavior

- `kind="checkbox"` renders one native toggle button, reflects `active` through
  `aria-pressed` and emits `change` with `detail.active` (Space or Enter toggle
  it). It shows no mark until it is chosen; chosen, a check mark (the icon
  `check`, the picture of the tag's size) stands before the label on the
  primary container fill (owner decision C145 (2));
- `href` makes the tag one native link (`a.sf-tag.sf-tag--link`): no check
  mark and no cross whatever `kind` and `closable` say, the label underlines on
  hover. A relative address is kept; an address with a scheme only when it is
  `http`, `https`, `mailto` or `tel`. A disabled link has no `href` (C145 (6));
- `kind="color"` draws a dot of the palette hue `color` names (or the
  `color-class` paints) before the label, at the point step of the tag's size —
  8 px on the default tag; the tag stays neutral (C145 (7));
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
  must not be used in new markup;
- a long name ends in an ellipsis (the tag is at most 20rem and its container)
  and its whole text is the tag's tooltip; the label stays whole in the markup
  for a screen reader (C58);
- in a one-row container (a flex row that does not wrap: filters, a table
  cell, a card) the tags keep their width; those that do not fit leave the row
  and a plain count «+N» stands after the last one shown, its title naming
  them. The first tag always stands and ends in an ellipsis. A row that wraps
  (a form) wraps (C58);
- closable tags in one row inside a field (`.sf-input-field`) are one Tab
  stop: ArrowLeft and ArrowRight walk them, Home and End go to the ends, Delete
  or Backspace removes the one stood on (`sf-tag-close`; the host removes the
  element) and the focus goes to its neighbour; each step is said, «Москва, 1
  из 3, Delete — убрать», as the chips of `sf-input-lookup` (C139 (6)). The
  cross under the mouse is unchanged. Outside a field each cross is its own
  stop; a row of tags written in `sf-tag-group` is one stop with the same keys
  and opens its «+N» in a panel (C145 (3)–(5)).

Tags in a row stand `gap-1/4` (4 px) apart (C105 H5): write the row as
`sf-tag-group`. A colour from data is the dot of `kind="color"` with `color`
(C145 (7)); the fill stays neutral, so `--sf-tag-background-color` is for a
page's own look, never for data (C140 BG-7).

## Slots

The source-owned template accepts `leading`, `text`, `count`, `close` and
`avatar`. A slot replacement preserves the same semantic ownership: decorative
leading content must not add a Tab stop, and a close slot must expose one native
named action.

External project templates remain available at
`/local/smart/templates/tag/<template>/index.js` and `index.css`.
