# Avatars Component

Avatar is a compact visual identity for a person, organization or system actor.
It may contain a photograph, initials or a neutral placeholder. The class does
not add interaction: use a native `a` or `button` root only when the avatar has
a real destination or action.

## Public variants

- content: image (`.sf-avatar-image`), initials (`.sf-avatar--text`) or
  placeholder (`.sf-avatar--placeholder`);
- picture: an `<img class="sf-avatar-image">` or a `background-image` with
  `bg-cover` fills the whole circle once, centred, ring included; a
  non-square picture (a flag) is cut to the circle, never tiled. A coloured
  ring (hover, `--sf-avatar-border-color`) is drawn over the picture's edge;
- size: `1/4`, `1/3`, `1/2`, `1`, `2` or `3`: 16 / 24 / 32 / 40 / 48 / 56 on
  a desktop; 1/4 is 16 px on every screen (owner decision C132). In a `data-sf-density="compact"` region every size moves one
  step down the avatar's own ladder, the bottom steps too: 16 / 20 / 24 / 32
  / 40 / 48, no step skipped. An explicit size or a `data-sf-density="normal"`
  region inside it takes the normal ladder back. The phone ladder (16 / 20 /
  28 / 36 / 44 / 52) does not change under compact;
- shape: circular by default (a person) or `.sf-avatar--square` (an
  organisation, a project, a group, a bot, an app) whose corner grows with
  the step: 4 px at 1/4 and 1/3, 8 at 1/2 and 1, 12 at 2 and 3 (owner
  decision C152 (4)); without a size step it keeps the UI radius;
- photo over initials: put the initials (`.sf-avatar-text`) or the glyph
  first and the `<img class="sf-avatar-image">` after them; the image stays
  transparent until it carries `data-sf-loaded="true"` and is not drawn with
  `data-sf-loaded="error"` (sf-avatar sets both, C152 (2)). Initials are in the
  medium weight;
- composition: `.sf-avatar-label-group`, `.sf-avatar-group` and
  `.sf-avatar-card`;
- state: online indicator (`.sf-online-indicator--online`), away
  (`.sf-online-indicator--away`, a hollow ring of the place's dim ink, owner
  decision C152 (5); sf-avatar draws no point for offline), and
  company/verification badge. The
  indicator's coloured disc is the small step of the avatar's size, 6 / 6 / 8 /
  12 / 12 / 16 px at 1/4 to 3, the same as the anchored badge's dot, and its
  ring of the place colour is drawn outside the disc (1 px at 1/4 and 1/3,
  2 px from 1/2 on; owner decision C132). The company and verification badge
  is a small step of the avatar's size too: 8 px at 1/4 and 1/3, 12 px at 1/2
  and 1, 16 px at 2 and 3, on every screen. The
  offline dot is the dim ink of the place the avatar stands on
  (`--sf-on-surface-variant`), at least 3:1 against the place and the avatar
  (since 2026-11-11; the disabled ink it had before was under 3:1). The dot
  lies over the nearest opaque place (`--sf-surface-place-ground`), so a
  photo or the initials do not show through it, and on a soft coloured place
  (`bg-<colour>-container`) the dot is that place's colour, opaque.
  On a row with a fill (selected, open or hovered: core mix `sf-place-fill`)
  the dot's ring lays the row's fill (`--sf-surface-place-fill`) over the place
  colour, so the ring is the row's colour, as the anchored badge's ring is.
  Its two layers are public variables: `--sf-avatar-offline-background-color`
  (default `var(--sf-on-surface-variant)`) and `--sf-avatar-offline-overlay`
  (default `none`, a layer over the colour). For a dot of your own colour set
  the first: `--sf-avatar-offline-background-color: #e53935`;
- hue, on initials only: `.sf-avatar--text.sf-hue-<name>`, where name is a
  hue of the static palette (`red`, `orange`, `amber`, `yellow`, `lime`,
  `green`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `pink`,
  `brown`, `gray`) or the theme's `primary`, `secondary` or `tertiary` (owner
  decision C17). `sf-hue-<name>` gives the element the hue's roles, and the
  initials stand on `--sf-hue-container` in `--sf-on-hue-container`, in both
  themes. An image or a placeholder stays as it is, and
  `--sf-avatar-background-color` and `--sf-avatar-color` still win. A server
  picks a hue from a name the way the Smart Avatar's documentation describes.
  The former classes `.sf-avatar--tone-<name>` (`rose` is `pink`, `violet`
  is `purple`) and the
  tokens `--sf-tone-<name>-container` and `--sf-on-tone-<name>-container`
  draw the same until 2027-01-01.
- cover, the decorative level (owner decision C91, level 2):
  `.sf-avatar--text.sf-hue-<name>` of 64 px or more under
  `.sf-avatar--expressive`, or under `data-sf-style="expressive"` on the root or
  a container, stands on a cover of its hue -- the `--sf-hue-container` plate
  with a second container step laid over it towards the far corner, mixed in
  OKLab, roles only -- in the same ink. C65 gives covers to placeholders from
  64 px (the d6 step); size 3 (56 px, 52 on a phone) is the largest step of the
  ladder, so the ladder's avatars stay flat and only an avatar sized to 64 px
  or more takes it. Strict, the default, keeps the plate flat; the nearest
  `data-sf-style` wins.

Use `.sf-avatar-card--square` and `.sf-avatar-card--portrait` for new card
markup. The older classes without the BEM modifier separator remain compatible.

A card without a photo (owner decision C124) puts
`.sf-avatar-card-placeholder` in `.sf-avatar-card-image`: with
`.sf-avatar-card-placeholder--text sf-hue-<name>` and an
`.sf-avatar-card-initials` span it draws the initials on the hue's container
in its ink, 36 % of the box width in the medium weight; with
`.sf-avatar-card-placeholder--icon` and an `.sf-icon` it draws the glyph at
45 % of the box on the neutral fill. Both are shares of the media box
(container query units), and the box keeps its ratio without a photo.

## Semantics and accessibility

- An image that is repeated by an adjacent visible name uses `alt=""`.
- A standalone informative image uses a useful `alt`.
- Initials, placeholder icons, badges and color indicators are hidden from
  assistive technology when the surrounding content already names them.
- Online, offline and verification state must also appear in visible text or in
  the accessible name of the native action; color alone is insufficient.
- Focus and hover affordance belongs only to native interactive avatar roots.
- A standalone avatar with no visible name is `role="img"` with the person's
  name (`aria-label`), as sf-avatar draws it by default (C152 (1)).

All dimensions, typography, borders, colors and layers are token driven. Brand
artwork inside a badge is content and may retain its exact brand colors.

Smart/custom-element projection is implemented separately in
`src/smart/avatar/index.js`.

## Count and dot

A count or a dot is put inside the avatar as `<span class="sf-badge
sf-badge--anchored" data-count="3"></span>` (or `data-dot`) and the Framework
places it at the top end, on the circle at 45 degrees or at the corner of the
square shape; its size follows the avatar's size, sizes 1/4 to 1/2 carry a dot
only. The online indicator keeps the bottom end, and both may show. The count
joins the avatar's accessible name. The rules, the markup and the size table
are in the Badges documentation, section «Бейдж на якоре»
(simai/ui-source#12).
