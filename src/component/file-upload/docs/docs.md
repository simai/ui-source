# File Upload interaction

The existing .sf-file-upload root is the picker trigger. Its native hidden file
input supplies selected File objects; SF.FileUpload.getItems(root) returns item
descriptors. Input selection and drop emit sf-file-upload:select and one
sf-file-upload:file-add per file. The component does not perform network upload.

accept and multiple are synchronized to the native picker, including dynamic
changes; data-accept/data-multiple remain compatibility inputs. accept is a
picker hint, not file validation: drops are not filtered, and the application
must validate size/type before sending and again on the server. No size limit
is imposed by the component. Each new non-empty selection replaces the list;
without multiple a drop retains the first file. An empty/cancelled selection
preserves existing items. The picker is cleared after copying File objects so
the same files can be selected again. Text/link drags are not intercepted.
Disabled file drops are cancelled locally without changing items or emitting
selection events; they must not fall through to browser file navigation.

SF.FileUpload.setItems(root, items) accepts progress (0–100) and state
(process/done/error) on each descriptor. Generated ordinary ProgressBar markup
supplies data-value and data-text-position=inline-end as well as initial fill/text,
so early or late ProgressBar binding preserves the displayed value. Fractional
progress is retained; reaching 100 alone does not change item state or emit done.
An error exposes retry; retry returns that item to process at zero. Completion
events follow explicit state transitions, not cosmetic rendering.

Use a visible label and an explicit aria-label when file rows are nested inside
the trigger. Tab reaches the enabled trigger; Enter/Space activate it once.
Repeated keydown and keys from nested actions do not activate the picker. Native
button/input/link roots keep their own keyboard activation instead of receiving
a second synthetic activation. The focus ring uses :focus-visible and preserves
surface color and geometry. Forced colors retains a real system outline.

Either the disabled attribute or disabled class disables user interaction. The
shared binder updates aria-disabled, input.disabled and the tab stop, and disables
remove/retry buttons. Removing the disabled state restores the prior authored
tabindex and per-button disabled state. Imperative item updates remain available:
disabling the UI does not cancel an application-owned transfer or discard files.

Generated remove buttons have a localized Remove/Удалить label containing the
file name; decorative delete glyphs are hidden from assistive technology. Author
aria-label/aria-labelledby names are preserved. Updated rendered names refresh
generated labels. The shared observer disconnects on unbind; it does not poll.

Remove controls compose the icon-button icon/link/on-surface variant at the file
row size. Existing flex/self alignment keeps them square and aligned to the top
of the filename area instead of stretching to a multiline name. Icon geometry,
hover/disabled paint, UI radius and keyboard focus remain owned by Icon Button;
ordinary and Smart projections use the same classes, without local pixel sizing.

Retry is a text control with UI-radius and insets from its existing size's
--sf-ui-* spacing roles. Insets reserve at least the focus-outline width.
Keyboard focus uses the shared --sf-ui-focus-inset; forced colors uses an
equivalent inward outline. Neither ring extends over file-size text or outside
the control. Padding is present before focus, so focus does not change layout.

The drop zone is a surface: its four existing corner overrides fall back to
--sf-radius--surface. Generated remove controls keep the icon-button UI radius
instead of imposing a surface utility. Authored per-corner overrides are retained.
Long filenames, file-size text and retry messages wrap within the row; content may
shrink while action buttons and icons retain their width. Numeric progress labels
do not inherit arbitrary-word breaking from filenames.

Disconnecting a drop zone removes its listeners and interaction observer without
discarding its selected File objects. Reinserting or moving the same node keeps
those objects without replaying selection events. A DOM clone is a new picker:
runtime-generated local rows are cleared because cloneNode does not copy the
component's item state. A shared external data-target is not cleared by cloning.

This checkpoint does not certify full upload accessibility, transport/security,
native form submission or every custom composition.
