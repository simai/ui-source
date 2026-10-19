# Background effects: SF.Effects

`SF.Effects` (core, `src/core/js/effects.js`) runs background effects under
the standard `simai.effect` 1.1.0 (`contracts/standards/simai.effect/1.1.0`).
An effect is an `effect.json` manifest and one module exporting
`mount(host, settings, context)`. The effects themselves live in the
catalogue `simai/ui-effects`; the Framework holds the runtime, the standard
and the kit (`scripts/effect-kit.mjs`).

## Manifest and settings

| Member | Answers |
| --- | --- |
| `checkEffectManifest(manifest)` | the problems of a manifest, `[]` when it holds |
| `checkSetting(setting, value)` | `{ok, value}` for one stored value |
| `effectSettings(manifest, stored)` | `{settings, invalid}`: every key, defaults where a value is missing or invalid |
| `effectSchemes(manifest)` | the schemes it draws (`['dark', 'light']` when it declares none) |
| `pairIsForeign(manifest)` | `true` when the pair is an address, not a catalogue id |

## Theme policy

A placement has a theme mode: `auto` (as the page, the default), `dark` or
`light`.

- `pageScheme(document?)` -> `'dark' | 'light'`: the theme class the Loader
  sets on `<html>`, or the system preference without one.
- `allowedModes(manifest, {pair?})` -> the modes an editor may offer:
  `'auto'` always, a fixed mode only when the effect or its catalogue pair
  draws that scheme. `pair` is the pair's manifest when known; without it a
  catalogue pair counts as drawing the other scheme. A foreign pair adds
  nothing.
- `resolveTheme(manifest, {pageScheme?, themeMode = 'auto', pair?})` ->
  `{effect: 'self' | 'pair', scheme[, pair]}` or `{hidden: true, reason}`.
  The order: the effect in the target scheme; its pair in the target scheme;
  in `auto`, a dark-only effect kept dark on a light page; otherwise hidden.
  Reasons: `light-only-on-dark`, `mode-not-drawable`,
  `foreign-pair-needs-sandbox`, `unknown-theme-mode`.

## Mounting

`mountEffect(host, {manifest, module, stored, locale, scheme})` mounts as in
1.0: the effect draws in `scheme` (its home scheme when it cannot).

With `themeMode` it is a placement:

```js
const handle = SF.Effects.mountEffect(host, {
  manifest, module, stored,
  themeMode: 'auto',                 // auto | dark | light
  pair: {manifest: pairManifest, module: pairModule}, // a catalogue pair, loaded
  area: section,                     // takes theme-dark/theme-light; the host by default
});
handle.update(stored, {themeMode: 'dark'});
handle.effect;      // 'self' | 'pair' | null (hidden)
handle.resolution;  // what resolveTheme answered
handle.scheme;      // the drawn scheme, null when hidden
handle.themeMode;
handle.pause(); handle.resume(); handle.destroy();
```

- The area takes the class of the scheme actually drawn (`theme-dark` or
  `theme-light`); when hidden, the target scheme's class. Destroy gives the
  area its classes back.
- In `auto` the placement follows the page: the `<html>` class, the
  `sf-theme-change` event and `prefers-color-scheme`. The same effect switches
  through `update(settings, {scheme})` without a remount; the pair, or
  nothing, takes its place when the policy says so.
- The pair receives the stored values valid for its own settings.
- A pair given as an address is never run, even when a module is handed in:
  the placement is hidden with `foreign-pair-needs-sandbox`.
- Every mount keeps the 1.0 rules: one still frame for reduced motion,
  paused in a hidden tab, and (since this release) paused off screen.

## Windows mode

```js
const handle = SF.Effects.mountWindows(group, {
  manifest, module, stored, pair, locale,
  themeMode: 'auto',
  windows: '[data-sf-effect-window]',  // the cards that are windows (default)
});
handle.refresh();  // after windows changed by a class the observer does not watch
```

One effect drawn once, in a layer the size of the group, shown only through
the window cards (a `clip-path` of their rounded rectangles), so the scene is
continuous across them. The mask is rebuilt on resize (ResizeObserver), on
scroll and when cards are added, removed or marked. Only window cards take
the effect's theme class; other cards keep the page's. Window cards draw no
background of their own. Only effects declaring `capabilities: ["windows"]`
are taken; others throw a `TypeError`.

## The catalogue and integrity

```js
window.SF_BOOT_CONFIG = {
  effects: {
    catalogue: 'https://cdn.jsdelivr.net/gh/simai/ui-effects@<commit>/',
    // index: 'catalogue/index.json',   // the default
    // indexSha256: '<hex>',            // optional: the index checked too
  },
};
```

- `loadEffect(reference, {catalogue?})` -> `{id, url, manifest, module,
  styles}`. `reference` is a catalogue id or the address of an `effect.json`
  under the catalogue base. Each file (`effect.json`, the entry module, the
  declared `styles`) is fetched once and its SHA-256 compared with the
  catalogue index (`effects[].files[].sha256`) before anything runs. The
  module is imported from the verified bytes (a Blob URL), never fetched
  again. It rejects with an error whose `reason` is one of `integrity`
  (`detail.file`), `foreign-effect-needs-sandbox`, `no-catalogue`,
  `not-in-catalogue`, `file-not-in-index`, `invalid-index`,
  `invalid-manifest`, `manifest-mismatch`, `fetch-failed`, `module-failed`,
  `no-integrity-check` (no `crypto.subtle`, which needs a secure context).
- `placeEffect(element, {effect, settings, themeMode, windows, catalogue,
  locale})` -> a handle or `null`: loads the effect (and its pair, when the
  pair is a catalogue id) and draws it in a layer under the element's
  content, or with `windows` (`true` or a selector) behind its window cards.

The pin is the commit in the base address: pin it, never a branch. An effect
outside the catalogue runs only in a sandbox runner, which is not shipped
yet; until then it is refused.

## Declarative mount

```html
<section data-sf-effect="aurora-curtain"
         data-sf-effect-settings='{"speed": 80}'
         data-sf-effect-theme="auto">…</section>

<div data-sf-effect-windows="aurora-curtain" data-sf-effect-theme="dark">
  <article data-sf-effect-window>…</article>
  <article data-sf-effect-window>…</article>
</div>
```

Core finds these once the page has loaded (and in content added later),
places them with `placeEffect`, and destroys a placement taken off the page.
The element carries `data-sf-effect-state` (`loading`, `running`, `hidden`,
`refused`, `failed`) and, when hidden or refused, `data-sf-effect-reason`.
The effect draws in a layer (`[data-sf-effect-layer]`) prepended to the
element; the element becomes `position: relative` (when static) and
`isolation: isolate` so the layer stays under its content.

## Events

- `sf-effect-refused` (bubbles, on the element): `detail: {effect, reason,
  ...}`, with a console warning. Sent for every refused load and for a
  placement hidden because its pair is foreign or was refused.
- `sf-effect-error` (bubbles): an effect threw (`detail: {effect, phase,
  message}`), or a declared placement failed to mount (`phase: 'mount'`).
