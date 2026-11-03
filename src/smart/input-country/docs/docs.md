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
opens at the selected option, ArrowDown/ArrowUp open or navigate, Home/End move
to the boundaries, and typing searches country names. Navigation alone does not
change the number. Enter/Space commit; Escape cancels. Commit and Escape return
focus to the button. Tab leaves without trapping focus. Disabled options are
skipped; disabled fields cannot open. Option focus is inset, focus-visible only,
and uses a system highlight in forced colors. The visible label/hint identify
the native input rather than the text of the entire enclosing country list.

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
validation. Fixed multi-country=false still uses the supplied descriptors.
When assigning after connection, wait for customElements.whenDefined, specify the
initial ISO and enable use-mask together with the data to avoid formatting the
initial value against the built-in mask before custom data is available.

Country masks apply the selected local pattern. use-country-masks=false with an
authored mask-pattern preserves a common pattern across selection and rebind.
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
