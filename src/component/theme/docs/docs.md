# Theme

Theme resolves one effective light or dark Framework scheme. Core performs the
initial resolution before normal Loader paint; this component only connects a
native `.sf-theme-button` control to the Loader-owned preference API.

## Preference contract

- `SF.Loader.setTheme('system')` clears the explicit override and follows the
  live `prefers-color-scheme` value.
- `SF.Loader.setTheme('light')` and `SF.Loader.setTheme('dark')` persist an
  explicit preference.
- `SF.Loader.changeTheme()` retains the existing binary toggle behavior.
- `sf-theme-change` exposes the effective `theme` and selected `preference`.

A single theme button (no `data-theme`) is the two-theme cycle of
`<sf-button-icon theme-cycle="light dark">` (owner decision C244, 2026-11-16):
its glyph is the theme on screen -- `dark_mode` (a moon) on a dark page,
`light_mode` (a sun) on a light one --, written as the `icon` of an
`sf-icon-button` or `sf-button` host or the text of a native button's own
`.sf-icon`. An icon left empty, or already one of those two, is written; an
author's other glyph stays. Its name says the theme on screen ("Тема: тёмная")
and its tooltip (`title`) what a press gives ("Тема: тёмная. Нажмите —
светлая"), in the page's language. It has no pressed state: no `aria-pressed`
and no `.active`.

The short `data-theme="system|light|dark"` attribute turns a theme button into
an explicit preference choice. Without it, the button keeps binary toggle
behavior.

A choice (`data-theme`) is one option of a set, not a toggle: it carries
`role="radio"` and `aria-checked`, never `aria-pressed`, and the chosen one
keeps the chosen-segment look (`.active`). The component synchronizes these
values without changing focus. Event delegation keeps buttons inserted later
operable. `SF_BOOT_CONFIG.theme === false` disables all theme mutation.

## First paint

Until a theme class is on `html`, core.css follows the device
(`prefers-color-scheme`), so a reader with a dark device sees no white first
frame. An explicit choice saved in the `sf-theme` cookie is known before the
first frame only to the server or to a script in the page's head: see
`docs/developer/theme-first-paint.md`.

A ready three-way switch (system, light, dark) is
`<sf-segmented theme-switch>`: it selects the
preference, calls `SF.Loader.setTheme` and follows `sf-theme-change` itself,
with no `.sf-theme-button` inside it.

Theme Builder owns palette and token authoring. It is not another theme toggle.
