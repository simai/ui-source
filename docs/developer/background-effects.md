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
| `SANDBOX_RUNNER_SHA256` | the base64 SHA-256 of the sandbox frame's runner script |
| `EFFECT_FORMAT` | `{schema: 'simai.effect', schema_version: 1}`: the fields a writer of an `effect.json` spreads into it |
| `EFFECT_SCHEMA` | `'simai.effect.v1'`, the older label of the format; legacy until 2026-12-01 (journal `global-effect-schema-constant`), use `EFFECT_FORMAT` |
| `foreignMode(value?)` | `'sandbox'` or `'refuse'`: how foreign effects are treated (`SF_BOOT_CONFIG.effects.foreign` without an argument) |

## Drawing deterministically

The kit's contrast and polarity checks sample frames of the effect at its
default settings. An effect therefore draws deterministically at its
defaults: no unseeded `Math.random`. Seed any randomness (a fixed seed, or one
derived from the settings) so every run draws the same scene; the catalogue
found a randomly placed template that failed contrast about one run in two.
This is guidance for `area-takes-the-drawn-theme`, not a new requirement:
simai.effect 1.1.0's published bytes stay as they are, and the note lives here
and in the kit's header.

## Theme policy

A placement has a theme mode: `auto` (as the page, the default), `dark` or
`light`.

- `pageScheme(document?)` -> `'dark' | 'light'`: the theme class the Loader
  sets on `<html>`, or the system preference without one.
- `allowedModes(manifest, {pair?, foreign?})` -> the modes an editor may
  offer: `'auto'` always, a fixed mode only when the effect or its pair
  draws that scheme. `pair` is the pair's manifest when known; without it a
  pair counts as drawing the other scheme. A foreign pair counts while
  foreign effects run in the sandbox, and adds nothing when they are refused
  (`foreign`, default `SF_BOOT_CONFIG.effects.foreign`).
- `resolveTheme(manifest, {pageScheme?, themeMode = 'auto', pair?, foreign?})`
  -> `{effect: 'self' | 'pair', scheme[, pair][, sandboxed: true]}` or
  `{hidden: true, reason}`.
  The order: the effect in the target scheme; its pair in the target scheme;
  in `auto`, a single-scheme effect in its own scheme (a dark-only effect
  stays dark on a light page, a light-only one light on a dark page);
  otherwise hidden.
  A pair given as an address resolves with `sandboxed: true`.
  Reasons: `mode-not-drawable`,
  `foreign-pair-needs-sandbox` (only when foreign effects are refused),
  `unknown-theme-mode`.

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
handle.sandboxed;   // true while what is drawn runs in the sandbox
handle.pause(); handle.resume(); handle.destroy();
```

- The area takes the class of the scheme actually drawn (`theme-dark` or
  `theme-light`); when hidden, the target scheme's class. It also takes
  `sf-effect-area`, which core's sheet gives that theme's text colour
  (`color: var(--sf-on-surface)`, in `sf.base`), so text over the effect is
  drawn in the effect's theme rather than the ink inherited from the page; a
  colour utility on the area still wins. Destroy gives the area its classes
  back.
- In `auto` the placement follows the page: the `<html>` class, the
  `sf-theme-change` event and `prefers-color-scheme`. The same effect switches
  through `update(settings, {scheme})` without a remount; the pair, or
  nothing, takes its place when the policy says so.
- The pair receives the stored values valid for its own settings.
- A pair given as an address runs only in the sandbox: as the record
  `loadEffect(address)` answers (`sandboxed: true`). A module handed in for
  it any other way is never run, and the placement is hidden with
  `foreign-pair-needs-sandbox`; so it is when foreign effects are refused.
- `mountEffect` runs the module it is handed in the page. Foreign code
  reaches the sandbox only through `loadEffect` or `placeEffect`.
- Every mount keeps the 1.0 rules: one still frame for reduced motion,
  paused in a hidden tab, and paused off screen.

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

- `loadEffect(reference, {catalogue?, foreign?})` -> `{id, url, manifest,
  module, styles, sandboxed}`. `reference` is a catalogue id or the address
  of an `effect.json` under the catalogue base. Each file (`effect.json`,
  the entry module, the declared `styles`) is fetched once and its SHA-256
  compared with the catalogue index (`effects[].files[].sha256`) before
  anything runs. The module is imported from the verified bytes (a Blob
  URL), never fetched again; `sandboxed` is `false`. Any other address of an
  `effect.json` is a foreign effect: see below. It rejects with an error
  whose `reason` is one of `integrity` (`detail.file`),
  `foreign-effect-needs-sandbox` (foreign effects refused),
  `invalid-reference` (a foreign address that is not https, or the page's
  own origin, ending in `/effect.json`), `no-catalogue`, `not-in-catalogue`,
  `file-not-in-index`, `invalid-index`, `invalid-manifest`,
  `manifest-mismatch`, `fetch-failed`, `module-failed`, `no-integrity-check`
  (no `crypto.subtle`, which needs a secure context).
  An empty reference rejects with `no-effect`.
- `placeEffect(element, {effect, settings, themeMode, windows, catalogue,
  locale, foreign})` -> a handle or `null`: loads the effect and its pair (a
  catalogue id with integrity; an address for the sandbox) and draws it in a
  layer under the element's content, or with `windows` (`true` or a
  selector) behind its window cards. The handle has `sandboxed`. A refusal
  answers `null`, sets `data-sf-effect-state="refused"` and
  `data-sf-effect-reason` to one of `loadEffect`'s reasons, or to
  `windows-not-declared` when `windows` is asked of an effect without
  `capabilities: ["windows"]`.
- The pair. When the pair cannot be loaded, `sf-effect-refused` is sent for
  it with the reason of its load (any of `loadEffect`'s), `pair-of-foreign-effect`
  (a foreign effect naming a catalogue id) or `pair-failed` (a load that
  failed without a reason), and the effect itself is still placed. When the
  theme policy then needs the pair, the placement is hidden
  (`data-sf-effect-state="hidden"`) with one of: `pair-refused` (its load was
  refused, as above), `pair-not-loaded` (no usable pair was handed in: none,
  an invalid manifest, or one whose id is not the pair the effect names),
  `pair-without-windows` (a windows placement whose pair does not declare
  `capabilities: ["windows"]`) or `foreign-pair-needs-sandbox`. A hidden
  placement also carries the theme policy's own reasons:
  `mode-not-drawable`, `unknown-theme-mode`.

The pin is the commit in the base address: pin it, never a branch.

## Foreign effects run in a sandbox

An effect that is not in the pinned catalogue -- the address of any other
`effect.json`, or a pair a catalogue effect names by address -- never runs in
the page (`foreign-effects-sandboxed`, `pair-under-the-same-trust`). It runs
in a frame of its own:

```js
window.SF_BOOT_CONFIG = {
  effects: {
    foreign: 'sandbox',   // the default; 'refuse' refuses foreign effects
  },
};
const effect = await SF.Effects.loadEffect('https://example.com/fx/aurora/effect.json');
effect.sandboxed;         // true
const handle = await SF.Effects.placeEffect(section, {effect: 'https://example.com/fx/aurora/effect.json'});
handle.sandboxed;         // true
```

- **No index, so the sandbox is the trust boundary.** The page fetches the
  manifest and the files it names once (`credentials: 'omit'`, no referrer),
  with no digest to compare them with. The manifest must still pass
  `checkEffectManifest`. The module text is never imported in the page.
  The foreign host must answer with CORS, and the page's own
  `connect-src` must allow it.
- **A page with its own policy.** A `srcdoc` frame inherits the page's
  content security policy on top of its own. A page that sets `script-src`
  admits `'sha256-<SF.Effects.SANDBOX_RUNNER_SHA256>'` and `blob:` there,
  or the frame's runner and the effect do not run.
- **The frame.** An `<iframe sandbox="allow-scripts">` filling the effect's
  host, with no `allow-same-origin`: its origin is opaque, so it has no
  cookies, storage or IndexedDB, and cannot reach the page's document. No
  `allow-top-navigation`, `allow-popups`, `allow-forms` or `allow-modals`:
  top navigation throws, `window.open` answers `null`, dialogs and forms are
  ignored. `referrerpolicy="no-referrer"`, `aria-hidden`, no pointer events.
- **The policy** of the frame's document (`srcdoc`, a meta tag):
  `default-src 'none'; script-src 'sha256-<runner>' blob:;
  style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:;
  font-src data:; connect-src 'none'; worker-src 'none'; frame-src 'none';
  child-src 'none'; object-src 'none'; manifest-src 'none';
  form-action 'none'; base-uri 'none'`. The one inline script is the core's
  runner, admitted by its hash. A nonce would not do: a module imported by
  a nonced script inherits the nonce for its own `import()`. The effect's
  module is imported from a Blob URL made inside the frame. No fetch, XHR,
  WebSocket, EventSource, beacon, outside image, script, sheet or frame.
- **Messages.** The page hands the frame one `MessagePort`. Over it go
  `mount` (the module text, the effect's styles, the settings already checked
  with `effectSettings`, the context, the size and the palette tones),
  `update` (settings, context, tones), `size`, `pause`, `resume` and
  `destroy`. The frame answers only `mounted` and `error`; the page treats
  both as data.
- **The rules hold as inline.** It is mounted like any module: still frame
  for reduced motion, paused while the tab is hidden or the host is off
  screen, gone after `destroy`.
- **Theme.** The frame's `<html>` takes `theme-dark` or `theme-light` and
  `color-scheme` for the drawn scheme. The area outside takes the drawn
  theme as for any placement. The frame has no Framework sheet: the page
  sends the palette tones (`--sf-<palette>-<tone>`) resolved at the host,
  set on the frame's root, so an effect drawn with tones looks as it does
  inline.
- **Windows.** A foreign effect is drawn behind window cards only when it
  declares `capabilities: ["windows"]` (else `windows-not-declared`). The
  frame covers the group's box, and the layer is clipped to the windows as
  for an inline effect.
- **Pairs.** A catalogue effect's pair given as an address is loaded for the
  sandbox and never runs inline. A foreign effect's pair given as a
  catalogue id names nothing in this catalogue: it is not loaded
  (`sf-effect-refused` with `pair-of-foreign-effect`; the placement hides
  with `pair-refused` when it needs the pair).
- **What the sandbox cannot close.**
  - A frame can always navigate itself, and no policy stops that. The core
    removes a frame whose document changes and reports `sf-effect-error`
    with `phase: 'sandbox'`. The one request that leaves can carry only
    what the frame was given: settings, size, scheme and tones.
  - A frame can post messages to the page (`parent.postMessage`). A page
    that listens for `message` checks `event.source` and `event.origin`, as
    it should anyway.
  - A frame shares the page's process unless the browser isolates sandboxed
    frames, so it can spend the page's CPU.
- **`foreign: 'refuse'`** gives back the refusal: a foreign effect is
  refused with `foreign-effect-needs-sandbox`, a foreign pair hides its
  placement with `foreign-pair-needs-sandbox`, and no foreign address is
  asked for. Any value other than `'sandbox'` (or none) refuses, so a
  mistyped switch fails closed.

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

Core finds these once the page has loaded, places them with `placeEffect`,
and destroys a placement taken off the page. Whether content added later is
watched is decided once, at that scan: the page is watched when
`SF_BOOT_CONFIG.effects.catalogue` is set by then, or when it declared an
effect at load. A catalogue set after the page has loaded does not start the
watch, so a page that adds its declared effects later sets the catalogue in
its boot config (before `core.js` scans) or places them with `placeEffect`.
A catalogue id declared without a catalogue is refused with `no-catalogue`.
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
  From a sandboxed effect, `detail.sandboxed` is `true`. The phase is
  `module` when its module failed to load or has no `mount`, `mount` or a
  method name when it threw, and `sandbox` when its frame navigated away and
  was removed.
