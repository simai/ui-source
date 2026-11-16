# File Upload interaction

The existing .sf-file-upload root is the picker trigger. Its native hidden file
input supplies selected File objects; SF.FileUpload.getItems(root) returns item
descriptors. Input selection and drop emit sf-file-upload:select and one
sf-file-upload:file-add per file. The component does not perform network upload.

accept and multiple are synchronized to the native picker, including dynamic
changes; data-accept/data-multiple remain compatibility inputs. A pick and a
drop go through one intake (1.2.0): a multiple area adds the new files to its
list and lists a file (name, size, time) once (FU-1); a single area keeps one
file and replaces it, the replaced entry leaving with remove {reason:
'replaced'}. The intake leaves out, on a pick as on a drop, a type accept does
not name, a second file on a single area, a file already listed, an empty file,
and a file past max-size, under min-size, past max-files or past
max-total-size (data-<name> or <name>, in bytes or files; FU-6..FU-8). Each is
said in the polite status line under the area (.sf-file-upload-message, made
after the area on its first rejection; C81) and in sf-file-upload:reject
{files, rejected: [{file, name, reason, message}], accept, source}, reason
type, count, duplicate, empty, size, min-size or total. accept stays a picker
hint, not security: the server checks again. An empty/cancelled selection
preserves existing items. The picker is cleared after copying File objects so
the same files can be selected again. Text/link drags are not intercepted.
Disabled file drops are cancelled locally without changing items or emitting
selection events; they must not fall through to browser file navigation.

A chosen file enters as ready (chosen, not sent): its name, size and Remove,
no bar (FU-3). SF.FileUpload.setItems(root, items) accepts progress (0–100, or
null while the share is not known: the bar runs without a number) and state
(ready/process/done/error) on each descriptor. Every row has Remove; done says
«<size> · загружен» with the check and has no bar (FU-4); error says
«Не загрузился: <errorMessage>» on its own line and offers «Повторить»
(retryText overrides the word; FU-5). Generated ordinary ProgressBar markup
supplies data-value and data-text-position=inline-end as well as initial fill/text,
so early or late ProgressBar binding preserves the displayed value. Fractional
progress is retained; reaching 100 alone does not change item state or emit done.
Retry returns that item to process with progress null and sends retry; the
page sends the file again (sf-file-upload's uploader does it itself; FU-11). Completion
events follow explicit state transitions, not cosmetic rendering.

Defaults on ordinary markup differ from the Smart element's: a descriptor
without `progress` is drawn at 100, and one without `state` (or `status`) is
drawn as done, with the check. The events, though, read a missing or unknown
state as process, so such an item never emits `sf-file-upload:file-complete`.
Set both `state` and `progress` on every descriptor. (The Smart
`sf-file-upload` draws a missing state as process and a missing progress as 100
for a done item, 0 otherwise.) Removal and retry emit `sf-file-upload:remove`
and `sf-file-upload:retry` with `{item, index, items}`.

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

Generated remove and retry buttons have a localized Remove/Удалить and
Retry/Повторить label containing the file name (FU-10); decorative delete glyphs are hidden from assistive technology. Author
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

The row glyph is the file's kind (core file icons by type or extension, draft
otherwise, error on an error row) in the on-surface-variant role, and the list
keeps space-1 from the area (FU-12). An ordinary area submits nothing with a
form; sf-file-upload does (FU-9).

A chosen file's size is written by the core formatFileSize in the page's language («342 КБ», «342 KB»), not «342KB» (1.1.2, C25, FU-01). The glyphs of the zone and the rows are aria-hidden: their ligature names were read as text (FU-03).
