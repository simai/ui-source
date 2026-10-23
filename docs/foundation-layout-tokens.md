# Layout tokens

Three sizes for laying out a page around its panels, requested by the ui-chat
kit (simai/ui-source#25). Declared in `src/core/scss/_sf_css__size.scss` with
the size scale.

| Token | Value | Use |
| --- | --- | --- |
| `--sf-layout-reading-width` | `var(--sf-h2)`, 48rem | the width of a reading column: a conversation, an article between panels |
| `--sf-layout-floating-panel-width` | `g2 + b6`, 25rem (400px at 16px) | a panel that floats over the page at a corner: a chat window, a help panel |
| `--sf-layout-floating-panel-height` | `h0 + d0`, 42.5rem (680px at 16px) | its height |

The reading column is a step of the size scale. The floating panel is the size
the chat kit measured; it is not a step, so it is written as a sum of two
steps (no length is invented outside the scale), and a second kit that needs a
floating panel takes this one rather than a step near it.

The tokens are sizes, not layouts: a page caps them by the room it has.

```css
.conversation {
  inline-size: 100%;
  max-inline-size: var(--sf-layout-reading-width);
  margin-inline: auto;
}

.chat-window {
  position: fixed;
  inset-block-end: var(--sf-space-2);
  inset-inline-end: var(--sf-space-2);
  inline-size: min(var(--sf-layout-floating-panel-width), 100vi - 2 * var(--sf-space-2));
  block-size: min(var(--sf-layout-floating-panel-height), 100vb - 2 * var(--sf-space-2));
}
```

A docked `sf-drawer` beside a reading column usually wants the column and the
panels side by side before it gives up its place: `dock-breakpoint` sets that
width (see the drawer's docs). Probe: `tests/browser/layout-tokens.browser.mjs`.
