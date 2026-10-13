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

The short `data-theme="system|light|dark"` attribute turns a theme button into
an explicit preference choice. Without it, the button keeps binary toggle
behavior.

A theme button represents the dark-theme option with `aria-pressed`; the
component synchronizes its value without changing focus. Event delegation keeps
buttons inserted later operable. `SF_BOOT_CONFIG.theme === false` disables all
theme mutation.

Theme Builder owns palette and token authoring. It is not another theme toggle.
