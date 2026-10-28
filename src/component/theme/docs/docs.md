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

A toggle (no `data-theme`) shows the theme it switches to: Framework writes
`dark_mode` (a moon) on a light page and `light_mode` (a sun) on a dark one --
the `icon` of an `sf-icon-button` or `sf-button` host, or the text of a native
button's own `.sf-icon`. An icon left empty, or already one of those two, is
written; an author's other glyph stays.

The short `data-theme="system|light|dark"` attribute turns a theme button into
an explicit preference choice. Without it, the button keeps binary toggle
behavior.

A theme button represents the dark-theme option with `aria-pressed`; the
component synchronizes its value without changing focus. Event delegation keeps
buttons inserted later operable. `SF_BOOT_CONFIG.theme === false` disables all
theme mutation.

A ready three-way switch (system, light, dark) is
`<sf-button-group appearance="segmented" theme-switch>`: it selects the
preference, calls `SF.Loader.setTheme` and follows `sf-theme-change` itself,
with no `.sf-theme-button` inside it.

Theme Builder owns palette and token authoring. It is not another theme toggle.
