# Avatars Component

Avatar is a compact visual identity for a person, organization or system actor.
It may contain a photograph, initials or a neutral placeholder. The class does
not add interaction: use a native `a` or `button` root only when the avatar has
a real destination or action.

## Public variants

- content: image (`.sf-avatar-image`), initials (`.sf-avatar--text`) or
  placeholder (`.sf-avatar--placeholder`);
- size: `1/4`, `1/3`, `1/2`, `1`, `2` or `3`;
- shape: circular by default or `.sf-avatar--square` with the UI radius;
- composition: `.sf-avatar-label-group`, `.sf-avatar-group` and
  `.sf-avatar-card`;
- state: online/offline indicator and company/verification badge;
- tone, on initials only: `.sf-avatar--text.sf-avatar--tone-<name>`, where name
  is `rose`, `amber`, `lime`, `green`, `teal`, `sky`, `indigo` or `violet`. A muted
  fill and an ink that reads on it in both themes, from the tokens
  `--sf-tone-<name>-container` and `--sf-on-tone-<name>-container`. An image or a
  placeholder stays as it is, and `--sf-avatar-background-color` and
  `--sf-avatar-color` still win. A server picks a tone from a name the way the
  Smart Avatar's documentation describes.

Use `.sf-avatar-card--square` and `.sf-avatar-card--portrait` for new card
markup. The older classes without the BEM modifier separator remain compatible.

## Semantics and accessibility

- An image that is repeated by an adjacent visible name uses `alt=""`.
- A standalone informative image uses a useful `alt`.
- Initials, placeholder icons, badges and color indicators are hidden from
  assistive technology when the surrounding content already names them.
- Online, offline and verification state must also appear in visible text or in
  the accessible name of the native action; color alone is insufficient.
- Focus and hover affordance belongs only to native interactive avatar roots.

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
