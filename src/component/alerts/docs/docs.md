# Alerts

Alert is a persistent inline notice inside the page flow: the state of this
page or section (owner decision C114 (1)). Choose its status from the message
meaning: `neutral`, `info`, `success`, `warning` or `error` (`clear` and
`danger` are still read). The state of the whole product is `sf-alert-bar`, a
short reply to an action is a toast (`SF.notify`), a decision is
`sf-confirm`.

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
sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low`
(tonal surface, the same neutral plate on every status: a status alert is a
soft coloured place, and the action takes the theme's neutral container back),
a second one `sf-button sf-button--ghost sf-button--on-surface
sf-button--size-1 sf-button--height-low`. The close is `sf-icon-button
sf-icon-button--close sf-icon-button--size-1 sf-icon-button--height-low` with
`sf-close sf-close--size-1`, the last child of `.sf-alert`; its plate hangs out
over the inline padding. The public `--sf-alert-padding-block`,
`--sf-alert-padding-inline` and `--sf-alert-gap` still win.

## Where the actions stand (1.2.0, owner decision C115)

The actions stand in the row with the text while the notice is wide enough,
else under the text from its start (layout L3a):

| Actions | In the row from the notice's own width |
|---|---|
| one | 36rem (576 px) |
| two | 48rem (768 px) |

The notice with actions is a size query container (`container: sf-alert`).
The step is the notice's whole width, its padding and border included. In the
row the actions are centred on the text block and their plate overhangs the
line by the low button's block padding, as the close does: with a one-line
text the button's label stands on the title line, with the icon and the close.
Under the text they follow at `--sf-space-1/2` (12, phone 8). No attribute pins
the position yet.

With the actions under the text, the space under the last button equals what
the eye sees above the first line, the top of its capitals (C114 (5), NS-9):
`.sf-alert-wrap` ends with `--sf-alert--lead + (--sf-text-height-1 - 1cap) / 2`
under the buttons. Measured at 1440: 21.7 above the capitals, 22.8 under the
button; on a phone 17.2 and 17.6.

## Callout: a recipe, not a component

Guidance before an action («changing the address affects every letter») is an
ordinary info alert (owner decision C114 (7)): `sf-alert--info
sf-alert--outlined`, the border only, without the close and without actions.

```html
<div class="sf-alert sf-alert--info sf-alert--outlined flex items-start">
  <i class="sf-icon" aria-hidden="true">info</i>
  <div class="sf-alert-wrap flex flex-col flex-1">
    <div class="sf-alert-content flex flex-col flex-1">
      <div class="sf-alert-supporting-text">Новый адрес получат все письма сайта.</div>
    </div>
  </div>
</div>
```

## Ink (1.1.1, C35 acceptance F1)

One notice draws one ink, as sf-toast does: the status icon is the status's
role `--sf-<status>` (neutral: the quiet `--sf-on-surface-variant` of its
place), which reads 5.2:1 or more on its container in the light theme and
7.7:1 or more in the dark one.

The close's cross is a service glyph (1.1.4, owner decision C112, AA-12; it
refines C107 for service glyphs on coloured places): the on-surface ink at 64
of the alpha scale's ink family (48/64/80) --
`light-dark(var(--sf-black--alfa-64), var(--sf-white--alfa-64))` -- the same
translucent tone on every status and look, so it reads evenly on the neutral
container, a status container and the page under an outlined alert. Its size
is the size-1 close, 16 in the 24 box of the status icon (C103, C112). Under a
pointer it catches the text ink. Earlier it painted the text ink (two to three
times darker than the status icon), then `--sf-on-surface-variant`. The cross
is reached inside any close host, so the Smart alert's close (an
`sf-button-icon`) takes it too.

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
