# Country Code

The built-in template applies root-class, author style and root-style to the
visible .sf-country-code root, not its display:contents host. Use Framework
utilities and semantic tokens. Cosmetic renders preserve the live open/disabled
state; explicit open/active/disabled attribute changes remain authoritative.
The native input, its live value/caret and selected country survive cosmetic
updates. afterRender(callback) keeps the shared callback-registration API.

The shared Country Code binder still reinitializes the mask on rebind. Pending
mask requests carry unique ownership tokens, so an old asynchronous result
cannot reclaim a newly bound root or one with its mask removed. Stale instances
are destroyed. This is consumer ownership, not a guarantee about downloading
mask creation before its promise resolves.

The shared picker exposes a named button and single-select listbox. Enter/Space
and ArrowDown/ArrowUp open the list with the cursor in its search field and the
selected option scrolled into view; ArrowDown from the search moves to the first
visible option, ArrowUp on the first option returns to the search, Home/End move
to the boundaries, and typing on an option searches country names. Navigation alone does not
change the number. Enter/Space commit; Escape cancels. Commit and Escape return
focus to the button. Tab leaves without trapping focus. Disabled options are
skipped; disabled fields cannot open. Option focus is inset, focus-visible only,
and uses a system highlight in forced colors. The visible label/hint identify
the native input rather than the text of the entire enclosing country list.

The host submits the number in E.164 under its `name` (`+79031234567` for the
`+7 903 123-45-67` the field shows; standard §17.1 item 2, the form format): `+`,
the dial code and the national digits, no spaces, dashes or brackets. The code
alone submits an empty value. `value` stays the text the person sees.

The native tel input supports required, name and form. Default value comes from
the authored value attribute; imperative edits and cosmetic renders do not replace
it. Native reset restores value/country/mask silently and closes the list; cancelled
reset does nothing. Explicit iso2/dial-code attributes update the reset-country
default. The ordinary auto-initializer leaves this Smart root to its owner.
Only a country prefix does not satisfy required; author custom validity survives.
This is not international phone-number or complete mask-length validation.

Visible label/hint links follow dynamic content and removals. Author accessible
names and external descriptions are preserved; an empty visible label falls back
to a localized phone-field name. Keep a visible label for sighted users.

With no `label` the label row is not drawn at all -- it left an empty line above
every phone field in a panel that prints the labels itself -- and `aria-label`
on the host names the native input, so the label is not printed twice.

The JavaScript countries property supplies local descriptors (iso2, dialCode/code,
label, maskPattern). Explicit fields override the built-in record; missing fields
for a known ISO are filled from it. Empty countries restores the dataset. Initial
selection without iso2/dial-code uses the first supplied item. Known explicit
selections outside the list remain supported; max-items is a display limit, not
validation. A fixed country (fixed-country; multi-country="false" until 2027-01-01) still uses the supplied descriptors.
When assigning after connection, wait for customElements.whenDefined, specify the
initial ISO and enable use-mask together with the data to avoid formatting the
initial value against the built-in mask before custom data is available.

Country masks apply the selected local pattern. fixed-mask (use-country-masks="false" until
2027-01-01) with an authored mask-pattern preserves a common pattern across selection and rebind.
Imperative state changes and ordinary reattachment delegate to the original
runtime owner when both component and Smart bundles are loaded. The old mask is
detached before events for a newly selected code are dispatched.

This checkpoint does not certify the full country picker. Complete
clipping-ancestor and transformed-container behavior need separate acceptance.
The shared picker now fits to the visual viewport, flips above when useful and
refreshes while open; teardown releases observers/listeners. Eight Chromium
ordinary/Smart × LTR/RTL × masked/unmasked edit scenarios passed with native tel
direction; no additional direction override was needed. Twelve ordinary/Smart ×
LTR/RTL × top/middle/bottom viewport scenarios passed including resize, keyboard
last-option visibility and offscreen-owner close. This is not physical mobile
keyboard/pinch-zoom or cross-browser acceptance.
The shared CSS now uses readable label/hint/placeholder roles, matching input and
placeholder typography in all five sizes, a neutral resting outline and a focus
shadow that does not replace surface color. A focused 40-case matrix covers
ordinary/Smart × light/dark × LTR/RTL layout × five sizes, with global UI-radius,
disabled ink and forced-color focus checks. Constructor, Smart and authored
markup now share field-width defaults and row geometry: a nonshrinking flag,
wrapping country name and UI-radius corners. Forty additional desktop/mobile ×
LTR/RTL × built-in/custom-list × size cases verify those three projections.
This does not establish every custom token palette or authored layout override.
Actual assistive
technology testing is not replaced by browser role/keyboard checks.
The manifest lifecycle remains experimental.

## Field and list (C87)

The flag stays in the field as a rectangular image with a small caret beside it;
the dial code is part of the number text (`+7 903 123-45-67`). Flag, caret and
the start of the text follow the value inset of the field size (`--sf-space-1/2`,
`--sf-space-1`, `--sf-space-2`; `--sf-space-1` on a phone and in compact density).

Typing reads the country from the number and never cuts a digit: the first digit
group gives the code (`+3745` is not read as `+374`), `+7` decides Russia or
Kazakhstan by the next digit, `8 9…` becomes `+7 9…`, digits without `+` take the
current country's code, and one space follows a finished code. After the code the
digits follow the country's pattern as they are typed or pasted (`8 903 123 45 67`
reads `+7 903 123-45-67`, `+49 30 123456` stays as it is); digits beyond the
pattern stay at the end. A field without its own `placeholder` hints the chosen
country's code, `+994` for Azerbaijan, and `+` while the code is unknown. Erasing the code
leaves the field without a country: the flag turns into a dashed frame and the
button is named "Country code not recognised. Choose a country". Pasting a number
that starts with `+` or has ten or more digits replaces the whole value. With
`multi-country` and no mask the code is not locked; a fixed country or a mask
keeps it: no edit reaches the code. A digit typed before it goes after it,
select-all and a digit keep the code and replace the number, select-all and
Backspace or Delete clear the number and leave the code; choosing another
country changes it.

The list is as wide as the popup panel (`--sf-popup-panel-width`), or the field
when that is wider. It starts with a search field ("Country or code") that finds
by name, ISO code or dial code; Enter picks the first match and never submits the
form; a search that finds nothing shows the line "Nothing found" ("Ничего не
найдено") where the rows would be. Without a query the list shows "Frequently chosen" (the two most recent
choices kept in `localStorage` under `sf-input-country:recent`, then the
`preferred` countries) above "All countries". The chosen row is filled, not
ticked. Picking a country keeps the national digits already typed.

`preferred` is a comma-separated ISO list for the frequent group. Without the
attribute the Russian locale offers RU, KZ, BY, UZ, KG and AM; an empty value
adds none (recent choices still show). The group holds six rows at most.

Below the `md` breakpoint the list opens as a bottom sheet over the page instead
of a dropdown under the field.
