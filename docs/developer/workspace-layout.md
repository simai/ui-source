# Workspace layout

An application screen of up to four regions -- a rail, a list, main and a
panel -- that follows the width of its container, never the viewport. It was
asked for by UI Chat (a list of conversations, the open conversation, a source
preview) for a chat embedded in foreign pages and Bitrix side panels. It is a
core layout: the sheet is in `core.css` (`src/core/scss/_sf_css__composition.scss`,
beside the declared-region layout it extends), the script in `core.js`
(`src/core/js/workspace.js`, `SF.workspace`). Nothing loads on demand.

```html
<div class="sf-workspace" data-sf-workspace-view="main">
  <nav class="sf-workspace-rail" aria-label="Spaces">…</nav>
  <section class="sf-workspace-list" aria-label="Conversations">
    <button aria-current="true">Release notes</button>
    …
  </section>
  <section class="sf-workspace-main" aria-label="Conversation">
    <button class="sf-workspace-back" type="button">Back</button>
    …
  </section>
  <aside class="sf-workspace-panel" aria-label="Sources">…</aside>
</div>
```

Every region is optional; the ones present are the workspace's direct
children, in this order (DOM order is reading and Tab order). The workspace
takes the block size of its parent (`block-size: 100%`); each region scrolls on
its own.

## Widths

| Container width | Regions |
| --- | --- |
| from the wide width (64rem) | rail, list, main, panel (when open) side by side |
| from the split width (40rem) | rail, list, main; the open panel is a drawer over main |
| narrower | the list with its rail, or main; the open panel is a drawer |

The two widths are classes, because a container query cannot read a variable:
`sf-workspace--split-g6 | -h0 | -h2 | -h4` (32, 40, 48, 56rem; `h0` is the
default) and `sf-workspace--wide-h4 | -h6 | -h8 | -i0 | -i2` (56, 64, 72, 80,
96rem; `h6` is the default), steps of the size ladder. Keep split below wide.

The region widths are public variables (set them on the workspace or an
ancestor; the Framework never sets them):

| Variable | Default | |
| --- | --- | --- |
| `--sf-workspace-rail` | `auto` | the rail's width; its content's when unset |
| `--sf-workspace-list` | `var(--sf-g0)`, 20rem | the list beside main |
| `--sf-workspace-panel` | `var(--sf-g1)`, 22rem | the panel, as a column and as a drawer (capped at the workspace's width) |
| `--sf-workspace-gap` | `var(--sf-0)` | space between the regions side by side |
| `--sf-workspace-divider-color` | `var(--sf-outline-variant)` | the line between the regions |
| `--sf-workspace-drawer-background` | `var(--sf-elevation-4--surface)` | the panel's fill as a drawer |

Main takes the rest. The row follows the writing direction: in a right-to-left
document the rail is at the right and the drawer comes from the left.

## State: attributes

- `data-sf-workspace-view="list" | "main"` -- which region the narrow
  container shows. Anything else, or none, shows the list. From the split width
  up it is ignored and both show.
- `data-sf-workspace-panel="open"` -- the panel is open; without it the panel is
  not shown at any width. The open state outlives a change of width: a column
  when wide, a drawer below, a column again.
- `data-sf-workspace-list="hidden"` -- no list at any width (a side panel or a
  link that opens one conversation alone): main shows, with the panel, and the
  back control is hidden. The rail stays from the split width up; the narrow
  container shows main alone.

## The narrow view and the back control

`.sf-workspace-back`, inside main, shows only in the narrow container with main
shown and a list to go back to. A press on it sets the view to `list`; no call
is needed. Make it a `<button>`; a host that handles the press itself calls
`preventDefault()` and the workspace leaves it alone.

The host marks the open row in the list with `aria-current` (any value but
`false`): that is where focus goes when the view returns to the list. Moving to
main, focus goes to the back control (or main itself). Focus moves only when the
region holding it was hidden by the change; from the split width up nothing
moves.

## The panel as a drawer

Below the wide width the open panel is drawn over main at the end edge, on the
drawer surface (`--sf-elevation-4--surface`, elevation-4 shadow) with the
drawer's scrim (black at `--sf-opacity-60`) over the rest of the workspace. It
slides in from its edge unless `prefers-reduced-motion: reduce`.

While it is a drawer it keeps sf-drawer's modal contract, through the same
document layer stack (`core/js/layer-stack.js`):

- focus moves into it (its first control, or the panel itself);
- the other regions are `inert`, so Tab stays in the panel and a press on the
  scrim lands on nothing behind it;
- Escape closes it when it is the top layer (a menu open inside it closes
  first), and so does a press on the scrim;
- on close focus goes back to what opened it -- the control that had focus when
  the panel opened, also when the panel became a drawer later because the
  container narrowed.

`sf-drawer` itself is not used: it is a Smart element that draws its own panel
in a fixed layer of the page and reserves room on the page, while this panel is
the host's own region that has to stay in place to be a column when the
container is wide. The contract is the same; the scrim is the drawer's shadow,
clipped to the workspace.

## Script

```js
const workspace = SF.workspace(element); // the controller, made once per element
workspace.show('main');                  // or 'list'
workspace.panel(true);                   // open; panel(false) closes, panel() toggles
workspace.view;                          // 'list' | 'main'
workspace.panelOpen;                     // boolean
workspace.layout;                        // 'narrow' | 'split' | 'wide', as the sheet placed it
```

Setting the attributes does the same: core watches them on every `.sf-workspace`.
A workspace on the page when core runs is taken at once; one added later is
taken at its first attribute change, its first press, or `SF.workspace(element)`
-- call that for a workspace inserted with its panel already open.

Events, on the workspace element (they bubble), whichever way the state
changed:

- `sf-workspace-view` -- `detail: {view}` when the view attribute changes;
- `sf-workspace-panel` -- `detail: {open}` when the panel opens or closes (not
  when it only turns from a column into a drawer).

## Tests

- `tests/workspace-layout.contract.test.mjs` -- the sheet (container queries
  only, ladder widths, logical properties, reduced motion) and the contracts
  (public variables, `SF.workspace` in the JS API).
- `tests/browser/workspace-layout.browser.mjs` -- on the built core, resizing the
  container (the viewport stays 1280 wide): wide, middle and narrow placement,
  the drawer (inert, Tab, Escape, scrim, focus return), the open state across
  widths, the back control and focus on the `aria-current` row, the hidden list,
  the rail, the width classes, RTL and reduced motion.
