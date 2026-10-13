# CountryCode Component

`CountryCode` is a `ComponentObserver`-based component for `.sf-country-code`.

JS class: `CountryCode` (`src/component/country-code/js/_country_code.js`)  
Registration: `registerComponent('CountryCode', CountryCode)`

## Runtime behavior

- Existing `.sf-country-code` nodes are auto-bound on init.
- Dynamically added `.sf-country-code` nodes are auto-bound via `MutationObserver`.
- Click on `.sf-country-code-left` toggles dropdown state (`.open`) in multi-country mode.
- Click outside closes opened dropdown.
- Click on `.sf-country-code-item` selects country by `data-iso2`/`data-code`, updates:
  - selected country in root dataset (`data-iso2`, `data-dial-code`, `data-mask-pattern`)
  - left flag placeholder
  - input value prefix (`+code `)
  - mask (if enabled)

## Global helper

Available as:

- `window.SF.CountryCode.setState(target, state)`

`state` fields:

- `disabled: boolean`
- `open: boolean`
- `value: string|number`
- `iso2: string`
- `dialCode: string`

`target` can be root `.sf-country-code` or an inner element.

## Constructor params (render mode)

- `size`: `1/2 | 1 | 2` (default: `1`). Form fields have three sizes; a retired `1/3` or `3` renders as `1/2` or `2` with a console warning.
- `label`: label text
- `required`: native required phone input and `*` marker; country prefix alone is insufficient
- `name`: native input name for FormData/submission
- `form`: optional owning form id for an externally placed field
- `hint`: hint text
- `value`: input value
- `placeholder`: input placeholder
- `disabled`: disabled state
- `open`: open list on init
- `countries`: list of items:
  - `{ label: 'Russia (+7)', code: '+7', iso2: 'RU', maskPattern: '+0 000 000-00-00' }`
- `locale`: `ru | en` (default: `ru`)
- `useMask`: enable mask adapter (default: `false`)
- `useCountryMasks`: use selected country pattern from dataset (default: `true`)
- `showCode`: show/hide left code block (default: `true`)
- `maskStyle`: `native | brackets` (default: `native`)
- `multiCountry`: enable dropdown list mode (default: `true`)
- `iso2`: default selected country ISO2 (for example `RU`)
- `dialCode`: fixed/default dial code
- `maskPattern`: fixed/default pattern
- `flagBase`: optional base URL for your own SVG flags; without it the component uses emoji flags
- `lazyFlags`: lazy load list flags via `IntersectionObserver` (default: `true`)
- `showMaskPlaceholder`: show the mask template immediately (default: `false`)
- `maskPlaceholderChar`: mask placeholder symbol (default: `_`)
- `maxItems`: optional cap for auto-rendered list from dataset

## Markup note

All five size variants use matching input/placeholder text-size and line-height
tokens; helper labels/hints keep their own smaller typographic role. Their readable
ink is on-surface-variant, not muted. The resting field uses the neutral outline
role; focus-visible adds the shared focus shadow without changing the surface.
Forced colors uses a real outline. The existing UI-radius alias follows the global
--sf-radius--ui token; no independent hardcoded radius is introduced.

Flags are rendered as SVG `<img>` inside `.sf-country-code-flag` when available.
Fallback: emoji (`flagEmoji`) from dataset when image is missing/unavailable.

The constructor applies the same row layout utilities as the built-in Smart
template and dataset-rendered markup. Rows keep a nonshrinking flag beside a
wrapping name and use the shared UI radius. The default field stretches to the
root width; label and field do not share vertical space through flex:1.
Authored markup supplies its own layout utilities, as in the examples.

The list measures up to eight real rows and fits its height to the visual viewport.
It can open above the owner when that side has more room. Window/visual viewport
resize, scrolling and owner/list resizing refresh placement while open. Closing or
unbinding releases listeners/observers and restores authored inline block offset.
An owner outside the visible viewport closes the list. This remains an in-tree
absolute list, not a portal; clipping ancestors require separate integration review.
Native type=tel already preserves LTR number editing in an RTL page; no forced
component direction is added.

## Data attributes (for existing DOM markup)

Can be set on `.sf-country-code` (or partly on input):

- `data-locale="ru|en"`
- `data-use-mask="true|false"`
- `data-use-country-masks="true|false"`
- `data-show-code="true|false"`
- `data-mask-style="native|brackets"`
- `data-multi-country="true|false"`
- `data-iso2="RU"`
- `data-dial-code="+7"`
- `data-mask-pattern="+0 000 000-00-00"`
- `data-flag-base="https://cdn.example.com/component/country-code/flags/svg"`
- `data-lazy-flags="true|false"`
- `data-show-mask-placeholder="true|false"`
- `data-mask-placeholder-char="_"`
- `data-max-items="50"`

Country resolution:

1. explicit `iso2` / `dialCode`, first in the supplied list, then in the built-in dataset;
2. first supplied item when neither selection is specified;
3. the built-in list when `countries` is omitted or empty.

Custom `countries` descriptors override matching dataset fields. `code` aliases
`dialCode`; a known `iso2` fills omitted names, flag, dial code and mask. An explicit
empty `maskPattern` disables that item's mask. Labels are also used in the accessible
selector name. DOM items use `data-iso2`, `data-code`, `data-mask-pattern` and their
visible text. A code-only custom item does not require a built-in ISO record.
`maxItems` limits the rendered list, including supplied lists; it is not validation
of allowed countries. Explicit known selections outside the list remain supported.

With `useMask=true`, `useCountryMasks=true` uses the selected descriptor's pattern;
`useCountryMasks=false` uses the authored `maskPattern`, falling back to the selected
pattern when no fixed pattern was supplied. Reattachment and cosmetic Smart renders
preserve the fixed pattern. Changing country detaches the previous mask before
dispatching phone events, so it cannot rewrite the new dial prefix.

## Countries dataset generator

Countries list with phone codes is generated by script:

- `npm run country-code:generate`
- `npm run country-code:flags`
- `npm run country-code:prepare` (generate countries + fetch SVG flags)

Output file:

- `src/component/country-code/data/countries.json`
- country emoji stored in the project-owned country data

Generated item fields:

- `iso2`
- `dialCode`
- `nameRu`
- `nameEn`
- `flagEmoji`
- `maskPattern` (derived from libphonenumber international example)

Current generator sources:

- `google-libphonenumber`
- `i18n-iso-countries`
- `flag-icons` (local package source for SVG flags)

## Build workflow

Use this practical flow:

1. Regenerate countries (when dialing data was changed):
   - `npm run country-code:generate`
2. Refresh SVG flags (only when needed):
   - `npm run country-code:flags`
3. Build framework as usual (`comp`/`full` in `sf5.webpack`):
   - webpack will copy `component/country-code/flags/**/*.svg` into `distr` automatically.

## Keyboard interaction

The shared binder is used by ordinary markup, the CountryCode constructor and
the built-in Smart template. Public classes, data attributes and setState stay
compatible. A disabled or fixed-code field cannot open the picker.

The country selector is a named button controlling a single-select listbox.
Keyboard focus is distinct from selection: ArrowDown/ArrowUp, Home/End and
typeahead move between enabled options without changing the phone. Enter/Space
commit once, Escape closes without committing, and both return focus to the
selector. Tab leaves the list without a focus trap. Opening from the keyboard
focuses the selected option (or an available boundary when none is selected).
The input name comes from its visible text label, not the full outer label
including country options. Author-provided ARIA names are preserved.

Keyboard focus uses an inset focus-visible outline with semantic tokens and a
forced-colors system highlight. The list viewport reveals the focused option
without scrolling the whole page. This is not complete viewport positioning,
screen-reader or custom-country-data acceptance.

Interaction reference: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

## Dynamic labels and lifecycle

Visible label/hint references are synchronized when their nodes or text change.
Removed hints leave no generated dangling reference; author descriptions are
retained and combined with the current hint. Explicit aria-label/aria-labelledby
remain authoritative. Without a visible or author-provided name, a localized
phone-field name is used; a visible label is still recommended.

Copied initial ordinary markup is rebound rather than trusting its copied
data-sf-country-code-bound marker. Generated label/hint/list IDs are linked to the
new instance. Removing ordinary roots releases document/input/reset/observer
bindings; moving a still-connected root does not reinitialize it. Smart owns its
own disconnect/reconnect. This does not define serialization of edited Smart
state or repair arbitrary duplicate author IDs.

## Native form reset

Constructed controls use type=tel and preserve the initial value as defaultValue.
Existing markup keeps its authored native input attributes. The shared reset
subscription restores the native default value and initial selected country,
refreshes its mask and closes the list without input/change events. Cancelled
reset does nothing; reassociation through native form attributes is respected.
Smart owns its inner root; ordinary auto-init does not race that ownership.
Explicit Smart iso2/dial-code attribute changes update the reset-country default;
cosmetic renders and imperative setState do not. Existing custom validity from
the host is preserved. This is required-presence validation, not verification
of a real international telephone number or complete mask-length validation.
