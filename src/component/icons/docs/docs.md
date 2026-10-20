# Icons

`sf-icon` renders one non-interactive Material Symbol. Use it for a glyph beside
equivalent text or inside a named control; add `aria-hidden="true"` in that
decorative case. A standalone informative glyph uses `role="img"` with a short
`aria-label`. The icon itself never receives focus or click behavior.

The ordinary primitive uses BEM modifiers:

- `sf-icon--rounded` and `sf-icon--sharp` select a source family;
- `sf-icon--filled` enables fill;
- `sf-icon--weight-thin|extra-light|light|regular|medium|semi-bold|bold` selects
  a supported weight;
- `sf-icon--size-1/4|1/3|1/2|1|2|3|4|5|6|7` uses the Framework icon scale;
- `sf-icon--rotate-45` through `sf-icon--rotate-315` rotates in 45-degree steps.

Old unseparated family, fill and weight classes remain compatibility aliases.
The glyph inherits `currentColor`; use semantic color utilities on the icon or
its parent. Do not set a literal color or absolute size.

Core Loader owns initial and dynamic discovery, package subsets, readiness and
exact local fallback. The `sf-icon-loaded` class is Loader state and must not be
authored. Use Smart `sf-icon` when declarative family/axis inputs or automatic
decorative/informative semantics are needed.

Each subset request returns one whole font for every icon asked for so far, so
an icon that appears only with data -- a tree node's icon, a menu that arrives
from the server -- costs a second font when it is found after the first
request. A page that knows such icons declares them, and they go in the first
request:

```html
<script>
  window.SF_BOOT_CONFIG = {
    icons: { preload: ['article', 'library_books', { icon: 'star', filled: true }] },
  };
</script>
```

A component that learns them at run time calls `SF.Loader.preloadIcons([...])`
with the same entries. While the subset is on its way the root carries
`data-sf-icons="subset-pending"` and icons draw nothing; that attribute is
Loader state too.

## Count and dot

The glyph's text is its ligature, so a count or a dot does not go inside
`.sf-icon`: wrap the icon in `<span class="sf-badge-anchor
sf-badge-anchor--size-1">` and put `<span class="sf-badge sf-badge--anchored"
data-count="3"></span>` beside it. The wrapper is the icon's box; its step
(`--size-1/3|1/2|1|2|3`) and shape (`--square`, the default, `--round`,
`--rounded`) decide the badge. Smart `sf-icon` does this itself with
`badge-count`, `badge-dot`, `badge-cap` and `badge-label`. See the Badges
documentation, section «Бейдж на якоре» (simai/ui-source#12).
