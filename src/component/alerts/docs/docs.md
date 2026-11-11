# Alerts

Alert is a persistent inline notice inside the page flow. Choose its semantic
type from the message meaning: `clear`, `info`, `warning`, `danger` or
`success`. Use Toast for transient overlay feedback.

## Anatomy

- `.sf-alert` owns the surface and semantic type.
- `.sf-alert-wrap` contains content and optional actions.
- `.sf-alert-text` is the short medium-weight heading.
- `.sf-alert-supporting-text` uses the normal body size and line height.
- `.sf-alert-buttons` contains native actions and may wrap.
- An optional leading `.sf-icon` is decorative when the same meaning appears in
  text.

The surface uses `--sf-radius--surface`, spacing tokens, semantic role colors and
the normal text tokens. Compact controls inside the surface keep their own
`--sf-radius--ui` geometry.

## Layout (1.1.0, owner decision C35)

The toast's numbers (DEV acceptance D3: C35 covers every notice). Inline
padding `--sf-space-1` on both sides, block padding and icon gap
`--sf-space-1/2`; the status icon is the line's size (`--sf-text-height-1`: 24,
compact and phone 20) and stands with the first line of text and the close in
the box of a low size-1 control (32, compact and phone 28). The title and its
text (`.sf-alert-content`) are one block (no gap); `.sf-alert-buttons` follow
at `--sf-space-1/2`, `--sf-space-1/3` apart. Actions: `sf-button
sf-button--tonal sf-button--primary sf-button--size-1 sf-button--height-low`,
a second one `sf-button sf-button--ghost sf-button--on-surface
sf-button--size-1 sf-button--height-low`. The close is `sf-icon-button
sf-icon-button--close sf-icon-button--size-1 sf-icon-button--height-low` with
`sf-close sf-close--size-1`, the last child of `.sf-alert`; its plate hangs out
over the inline padding. The public `--sf-alert-padding-block`,
`--sf-alert-padding-inline` and `--sf-alert-gap` still win.

## Ink (1.1.1, C35 acceptance F1)

One notice draws one ink, as sf-toast does: the close's cross is the notice's
text ink -- `--sf-on-<status>-container` on a default or flat alert,
`--sf-on-surface` when neutral and on an outlined alert, whose text stands on
the page -- and the status icon is the status's role `--sf-<status>`
(neutral: the quiet `--sf-on-surface-variant` of its place), which reads 5.2:1 or more on its container in
the light theme and 7.7:1 or more in the dark one. The cross is reached inside any close host,
so the Smart alert's close (an `sf-button-icon`) takes it too.

The status colour is the alert's own icon only (1.1.2, C35 acceptance A-F1):
`.sf-alert > .sf-icon` and `.sf-alert > sf-icon > .sf-icon`. An icon inside an
action button keeps the button's own icon role, so a filled button's icon stays
on its plate.

## Presentation

Combine one semantic type with `default`, `outlined` or `flat`. Default and flat
semantic surfaces use their matching `on-*-container` text role. Outlined keeps
the page text role and a semantic border/icon.

## Behavior

Static alerts need no JavaScript. A close action uses the short `data-close`
attribute; an action uses `data-action="value"`. Legacy `data-alert-close`,
`data-alert-action` and `.sf-alert--close` hooks remain supported. The component
emits `sf-alert-close` before token-driven removal and `sf-alert-action` without
removing the notice. Disabled actions do nothing.

Dynamic urgent errors may use `role="alert"`; non-urgent dynamic updates may use
`role="status"`. Omit a live-region role from a notice already present when the
page initially loads. After dismissal, the application restores focus only when
focus was inside the removed notice.

Exit motion uses Framework duration/easing tokens and is removed under
`prefers-reduced-motion`. Late ordinary alerts use the same delegated behavior;
Smart Alert keeps ownership of its own root without duplicate events.

The line-size rule for icons reaches only the alert's own status icon, as its
status colour does: an icon button inside the alert keeps its own glyph size
(review R-N1, 2026-11-11).
