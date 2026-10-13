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
