# Smart Avatar

`sf-avatar` is a light-DOM smart custom element powered by `lit`.

Loading model:

- detected by `tags: ['sf-avatar']` in `src/smart/avatar/rule.js`
- loaded as smart bundle `cl-avatar`
- base styles and base bundle are loaded through relation with `avatars`
- updates are batched through the shared `SfBaseElement`; by default `lit` patches the DOM, with optional direct node patching for simple attribute changes

## Attributes

- `template`: `default | label | card`
- `size`: `1/4 | 1/3 | 1/2 | 1 | 2 | 3`
- `shape`: `circle | square`
- `image-url`
- `image-alt`
- `text`
- `hue`: empty `| auto` or a hue of the static palette: `red | orange | amber |
  yellow | lime | green | teal | cyan | sky | blue | indigo | violet | purple |
  pink | brown | gray` -- see "Hues"
- `tone`: the former name of `hue` until 2027-01-01, read when `hue` is empty;
  its `rose` is `pink`
- `status`: `none | online | offline | company | verified`
- `aria-label` — a host attribute: the button's name, «Аватар» / "Avatar" when unset
- `heading` — the name the label and card templates print; `title` is its
  dated alias until 2026-12-01 (`title` is a property of every element,
  standard 1.3.8 §3.1)
- `description`
- `meta`
- `meta-icon`
- `card-variant`: `square | portrait`
- `disabled`
- `badge-count`, `badge-dot`, `badge-cap` (99), `badge-label` -- a count or a
  dot at the avatar's top end, sized by `size` (1/4 to 1/2: a dot only), the
  phrase joined to the button's `aria-label`: «Анна Белова, 3 непрочитанных».
  `0` hides it. See the Badges documentation, «Бейдж на якоре»
  (simai/ui-source#12).

The default and label templates intentionally render a native button. Its
`aria-label` must describe the action (for example, “Open Anna's profile”), not
the visual photograph. The card template is non-interactive. Images inside a
label or card use `alt=""` when the adjacent heading already provides the same
identity; set `image-alt` only when the image contributes additional meaning.

Availability and verification badges are decorative projections. Include the
status in visible text or the native control's accessible name; color alone is
not a status contract.

## Hues

People recognise a conversation by its avatar. `hue` draws the initials on the
container of one hue of the static palette, in its ink, in both themes, at every
size (owner decision C17: an avatar has no colours of its own):

```html
<sf-avatar heading="Boris Ilyin" hue="teal"></sf-avatar>
<sf-avatar heading="Boris Ilyin" hue="auto"></sf-avatar>
```

- Empty (the default) is the neutral look.
- Only initials take a hue: an avatar with `image-url` shows the image with no
  fill, and the placeholder icon stays neutral. The `card` template draws no
  initials, so it takes none.
- `--sf-avatar-background-color` and `--sf-avatar-color` still win.
- The plain classes are `sf-avatar--text sf-hue-<name>`: `sf-hue-<name>` gives
  the element the hue's roles (`--sf-hue-container`, `--sf-on-hue-container`
  and the rest), and the class sheet draws the initials from them.
- Until 2027-01-01 the former `tone` setting is read when `hue` is empty (`rose`
  is `pink`), and the former classes `sf-avatar--tone-<name>` still draw.

`auto` picks the hue from the name: `heading`, else the host's `aria-label`,
else `text`. It hashes the whole name, not the two letters, so two people with
the same initials differ. No name means the neutral look.

The same name gives the same hue in every browser and on a server, so a server
can print the class in the first paint. The algorithm (`js/tone.mjs`):

1. Take the UTF-8 bytes of the name exactly as given: no trimming, no change of
   case, no Unicode normalisation.
2. FNV-1a, 32 bits: start from `2166136261`; for each byte, XOR the byte in,
   then multiply by `16777619`, modulo 2^32.
3. Fold: `hash = hash XOR (hash >> 16)`, an unsigned shift.
4. The hue is `hues[hash mod 8]`, in this order: `pink`, `amber`, `lime`,
   `green`, `teal`, `sky`, `indigo`, `violet` -- the slots of the former tones,
   so a name keeps its place (`rose` was the first).

```php
function sf_avatar_hue(string $name): string {
    if ($name === '') return '';
    $hash = 2166136261;
    foreach (str_split($name) as $byte) {
        $hash = (($hash ^ ord($byte)) * 16777619) & 0xFFFFFFFF;
    }
    $hash ^= $hash >> 16;
    return ['pink', 'amber', 'lime', 'green', 'teal', 'sky', 'indigo', 'violet'][$hash % 8];
}
```

```python
def sf_avatar_hue(name: str) -> str:
    if not name:
        return ""
    hash = 2166136261
    for byte in name.encode("utf-8"):
        hash = ((hash ^ byte) * 16777619) & 0xFFFFFFFF
    hash ^= hash >> 16
    return ("pink", "amber", "lime", "green", "teal", "sky", "indigo", "violet")[hash % 8]
```

For example `Boris Ilyin` is `violet` and an empty name is the neutral look. The
list and its order are part of the algorithm: a later named hue will not join
`auto`, so a name keeps its hue across releases.

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

`event.detail` includes:

- `component`
- `tagName`
- `template`
- `changedAttributes` (for render/update events)
- `updateMode` (for `sf-updated`)

## External project templates

`SfBaseElement` supports optional external project templates without framework rebuild.

Path format:

- `/local/smart/templates/avatar/<template>/index.js`
- `/local/smart/templates/avatar/<template>/index.css`

Example:

- `<sf-avatar template="custom"></sf-avatar>`

`index.js` should export `default` as a render function:

```js
export default function template({ html, nothing, context, component }) {
  return html`<div>${context.heading || nothing}</div>`;
}
```

## Slot overrides

`sf-avatar` supports optional light-DOM slot overrides for badge parts.

Supported slot names:

- `company-badge`
- `verified-badge`
- `online-indicator`

Example:

```html
<sf-avatar status="company" text="AB">
  <span slot="company-badge">
    <img src="/local/badges/company.svg" alt="" />
  </span>
</sf-avatar>
```

Priority:

1. slot override
2. built-in badge/indicator

The interface is `component.json` (standard 1.3.8); examples are
`examples.json`.
