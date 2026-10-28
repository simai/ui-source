# Component files 1.4, phase A: what changed for consumers

Waves 1 and 2 first, then waves 3 to 6 (below), which finish the Framework's
Smart components: every folder of src/smart is in the 1.4 form.

## Waves 1 and 2

Thirty Smart components moved to the 1.4 form on 2026-10-28 (standard
simai.smart-component 1.4; docs/developer/component-files-1.4-report.md). The
runtime (index.js, js/, the sheets) is unchanged; each component is a patch
version up. What a reader of the registry (smart.manifest.json, in the
distribution distr/smart/<folder>/smart.manifest.json) sees now, against the
pair before (ui-36116c01a792):

- ui-doc's Smart reference, ui-studio's catalog and ui-vscode's IntelliSense
  gain the events, actions and settings component.json declares and the
  registry lacked, the base settings (root-class, root-style, the template's
  words), the minimum and maximum of number settings, and the ARIA role.
- A number setting is a number (heading-level, max-items, length): a page
  still writes the attribute as text; a tool validating a property sees
  `integer`/`number` where it saw `string`.
- composition.uses is generated from the Loader relations (rule.js): it now
  names every bundle fetched with the component, the icon font's sheet
  (component.icons) among them.
- Former values are aliases, not enum values (icon type=shape is listed in
  compatibility.aliases and deprecated, not in the enum).
- tree: the input `role` is gone (a host attribute, §3.1).
- A setting whose default is the page language's word (default-from) names no
  fixed default in the registry.
- Each component's component.json is bigger in the bundle (relations,
  aliases, x-registry; together +126 KB minified, +37 KB gzip over the thirty
  bundles), until the build strips the registry-only fields.
- color, datepicker, range-slider wrote examples.json as a bare list, and
  switch had none; they are {examples: [...]} now, so the first-paint
  snapshots draw their examples.
- The studio fixtures of page-header (star false, not "off"), steps and tabs
  (items as a list, not "a|b") give props the manifest allows.

### sf-accordion 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- events added: sf-accordion-toggle
- inputs added: root-style
- input type: heading-level "string" → "integer"
- input default: heading-level "3" → 3
- input enum: heading-level ["2","3","4","5","6"] → –
- input minimum: heading-level – → 2
- input maximum: heading-level – → 6
- uses ["component.accordion","smart.badge"] → ["component.accordion","component.icons","smart.badge"]
- 1 summaries/descriptions now component.json's words

### sf-avatar 1.1.1 → 1.1.2

- version 1.0.0 → 1.1.2
- inputs added: root-class, root-style
- input minimum: badge-cap – → 1
- uses ["component.badges"] → ["component.avatars","component.badges"]
- role null → "button"
- 2 summaries/descriptions now component.json's words

### sf-avatars 1.1.1 → 1.1.2

- version 1.0.0 → 1.1.2
- inputs added: root-style
- uses [] → ["component.avatars","component.icons"]
- role null → "none"
- 5 summaries/descriptions now component.json's words

### sf-breadcrumbs 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- events added: sf-breadcrumbs-press
- inputs added: root-style
- input default: expand-label "" → –
- input type: max-items "number" → "integer"; items "string" → "array"
- input minimum: max-items – → 0
- 1 summaries/descriptions now component.json's words

### sf-checkbox 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- inputs added: template, root-style
- uses [] → ["component.checkbox","smart.icon"]
- role null → "checkbox"

### sf-close 1.0.0 → 1.0.1

- version 1.0.0 → 1.0.1
- inputs added: template, root-style
- uses [] → ["component.close"]
- role "none; generated glyph is aria-hidden" → "none"

### sf-code-input 1.1.0 → 1.1.1

- version 1.0.0 → 1.1.1
- title «Code Input» → «Code input»
- inputs added: root-style
- input type: length "string" → "number"
- input default: length "6" → 6
- 1 summaries/descriptions now component.json's words

### sf-color 1.2.1 → 1.2.2

- version 1.2.1 → 1.2.2
- inputs added: root-class, root-style
- input default: choose-label "" → –; clear-label "" → –
- uses ["smart.icon-button"] → ["component.icons","smart.icon-button"]

### sf-copy-button 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- events added: sf-copy-button-copied, sf-copy-button-copy-failed
- inputs added: root-style
- input type: duration "string" → "integer"
- input default: duration "2000" → 2000
- input minimum: duration – → 0
- uses ["smart.button","smart.icon-button","smart.icon"] → ["smart.button","smart.icon","smart.icon-button"]
- 2 summaries/descriptions now component.json's words

### sf-datepicker 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- inputs added: root-style
- input type: month "number" → "integer"; year "number" → "integer"; week-start "number" → "integer"; presets ["string","array"] → "array"
- input default: month null → –; year null → –; week-start null → –; presets "" → []
- input minimum: month – → 0; week-start – → 0
- input maximum: month – → 11; week-start – → 6
- uses ["component.datepicker","smart.input","smart.button","smart.icon-button","smart.icon"] → ["component.datepicker","smart.button","smart.icon","smart.icon-button","smart.input"]
- role "dialog in popup mode; group in inline mode" → "dialog"
- 1 summaries/descriptions now component.json's words

### sf-download-file 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: sf-download-file-download
- inputs added: root-class, root-style
- uses ["component.download-file","smart.icon"] → ["component.download-file","component.icons","smart.icon"]
- role null → "link"
- 2 summaries/descriptions now component.json's words

### sf-empty-state 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- inputs added: root-style
- input type: heading-level "string" → "integer"
- input default: heading-level "3" → 3
- input enum: heading-level ["2","3","4","5","6"] → –
- input minimum: heading-level – → 2
- input maximum: heading-level – → 6
- 2 summaries/descriptions now component.json's words

### sf-gallery 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: change, sf-gallery-opened, sf-gallery-closed
- inputs added: root-style
- input type: current "number" → "integer"
- input minimum: current – → 1
- input default: title "Gallery" → –
- uses [] → ["smart.modal","smart.slider"]
- role null → "none"
- 3 summaries/descriptions now component.json's words

### sf-help-mark 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: sf-help-mark-opened, sf-help-mark-closed
- inputs added: root-style
- input default: label "" → –
- uses ["smart.icon-button","smart.icon"] → ["smart.icon","smart.icon-button"]
- 2 summaries/descriptions now component.json's words

### sf-icon 1.1.1 → 1.1.2

- version 1.0.0 → 1.1.2
- inputs added: template, root-class, root-style
- input type: weight "number" → "integer"; grade "number" → "integer"
- input minimum: weight – → 100; badge-cap – → 1
- input maximum: weight – → 700
- input enum: type ["","outlined","rounded","sharp","shape"] → ["","outlined","rounded","sharp"]
- uses ["component.icons","component.badges"] → ["component.badges","component.icons"]
- role "img when label is present; hidden when decorative" → "img"
- compatibility.aliases [] → ["type=shape"]
- 1 summaries/descriptions now component.json's words

### sf-inline-editor 1.1.0 → 1.1.1

- version 1.1.0 → 1.1.1
- inputs added: template, root-class, root-style
- role null → "none"
- 6 summaries/descriptions now component.json's words

### sf-menu 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- events added: sf-menu-navigate, sf-menu-toggle
- inputs added: root-style, aria-label
- input default: toggle-label "" → –
- uses ["component.menu","component.badges"] → ["component.badges","component.icon-buttons","component.icons","component.menu"]
- 2 summaries/descriptions now component.json's words

### sf-page-header 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- events added: sf-page-header-toggle
- inputs added: template, root-style
- input type: star "string" → "boolean"
- input default: star "" → false
- input enum: star ["","off","on"] → –
- uses ["smart.badge","smart.icon-button","smart.icon"] → ["smart.badge","smart.icon","smart.icon-button"]
- role "banner content; the heading is an h1" → "none"
- 4 summaries/descriptions now component.json's words

### sf-profile-picker 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- events added: sf-profile-picker-select, sf-profile-picker-create, sf-profile-picker-rename, sf-profile-picker-delete, sf-profile-picker-reset
- methods added: open, close, toggle
- inputs added: root-style
- input default: label "" → –
- 1 summaries/descriptions now component.json's words

### sf-radio 1.1.1 → 1.1.2

- version 1.0.0 → 1.1.2
- title «Radio» → «Radio buttons»
- inputs added: template, root-style
- uses ["component.radio"] → ["component.icons","component.radio"]
- 1 summaries/descriptions now component.json's words

### sf-range-slider 1.1.0 → 1.1.1

- version 1.0.0 → 1.1.1
- inputs added: root-style, aria-label
- input type: min "string" → "number"; max "string" → "number"; step "string" → "number"
- input default: min "0" → 0; max "100" → 100; step "" → –
- uses [] → ["component.range-slider"]
- 2 summaries/descriptions now component.json's words

### sf-reference-link 1.0.2 → 1.0.3

- version 1.0.2 → 1.0.3
- inputs added: root-class, root-style
- uses ["component.reference-link","smart.icon"] → ["component.icons","component.reference-link","smart.icon"]
- role null → "link"
- 2 summaries/descriptions now component.json's words

### sf-resizer 1.1.0 → 1.1.1

- version 1.1.0 → 1.1.1
- events added: sf-resizer-resize
- inputs added: template, root-class, root-style, aria-label
- input type: step "string" → "number"; value "string" → "number"
- input default: step "16" → 16; label "" → –; value "" → –
- input minimum: step – → 1

### sf-slider 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: change
- inputs added: template, root-style
- uses [] → ["component.slider","smart.icon-button"]
- role null → "none"

### sf-sortable 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- title «Sortable» → «Drag and drop»
- events added: sf-sortable-move
- inputs added: template, root-class, root-style, aria-label
- uses ["smart.context-menu","component.icon-buttons","component.icons"] → ["component.icon-buttons","component.icons","smart.context-menu"]
- role null → "none"
- 9 summaries/descriptions now component.json's words

### sf-steps 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- events added: sf-steps-change
- inputs added: template, root-style
- input type: error-step "string" → "integer"; current "number" → "integer"; items "string" → "array"
- input default: error-step "" → –; completed-label "" → –; error-label "" → –
- input minimum: error-step – → 0; current – → 0
- uses [] → ["component.icons","component.step"]

### sf-switch 1.1.0 → 1.1.1

- version 1.1.0 → 1.1.1
- inputs added: template, root-class, root-style
- uses ["component.switch"] → ["component.icon-buttons","component.icons","component.switch"]
- 1 summaries/descriptions now component.json's words

### sf-tabs 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- events added: sf-tabs-change
- inputs added: root-style, aria-label
- input default: type null → ""
- input enum: type – → ["underline","pills","full","vertical"]
- input type: active-index "number" → "integer"; items "string" → "array"
- input minimum: active-index – → 0
- uses ["component.tabs","smart.button","smart.icon-button"] → ["component.tabs","smart.button","smart.checkbox","smart.context-menu","smart.icon-button","smart.sortable"]
- 2 summaries/descriptions now component.json's words

### sf-theme-generator 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: change, sf-theme-generator-committed
- inputs added: root-style, aria-label
- input type: hue "string" → "integer"; chroma "string" → "integer"
- input default: hue "" → –; chroma "" → –
- input minimum: hue – → 0; chroma – → 0
- input maximum: hue – → 360; chroma – → 150
- uses ["smart.color","smart.input","smart.button","smart.icon-button","smart.icon"] → ["smart.button","smart.color","smart.icon","smart.icon-button","smart.input"]
- 10 summaries/descriptions now component.json's words

### sf-tree 2.0.3 → 2.0.4

- version 2.0.3 → 2.0.4
- events added: sf-tree-open, sf-tree-select, sf-tree-toggle, sf-tree-move, sf-tree-attach, sf-tree-window, sf-tree-item-click, sf-tree-item-toggle
- methods added: expand, collapse, focusEntry
- inputs added: root-style
- inputs removed: role
- 8 summaries/descriptions now component.json's words

## Waves 3 to 6

The other twenty-nine Smart components moved to the 1.4 form the same day:
skeleton, tooltip, alert, progress-bar, progress-scale, toggle, badge, button,
icon-button, button-group, input, textarea, dropdown, list-item (the meta.mjs
families), file-preview, country-code, tag, pagination, image-field, drawer,
context-menu, toast, tree-item, spinner, popover (the small conflicts), modal,
quantity, file-upload and composition-overlay (the large ones). The runtime
is unchanged (what the element reads of component.json is the same, words
aside); each component is a patch version up, and so are tabs and
profile-picker, whose registry gains their object setting. Against the pair
before (ui-519fa0814a02):

- meta.mjs is generated for the twenty families that had a hand-written one:
  it describes every attribute (the base settings, the dated aliases), not a
  few. Only this repository's tests and the studio generator read it; the
  distribution does not carry it.
- The registry gains the events, actions and settings component.json declares
  and it lacked: sf-button press, sf-modal's and sf-drawer's open/close family,
  sf-pagination's eight verbs, sf-context-menu, sf-popover and sf-toast
  opened/closed, sf-tag close, sf-list-item and sf-tree-item open, the
  progress chunk, sf-toast show, sf-modal minimize/expand/confirm.
- An event's detail is component.json's: the element, its tag name and
  template are no longer described (§8: data only; additionalProperties stays
  true); toast's toast/trigger and alert's alert left the detail with the code.
  composition-overlay's select, insert and move describe both the vocabulary's
  fields and the ones the composition host reads (node_id, parent_id, index).
- A native event name that carries a detail (sf-dropdown and sf-quantity
  change/input, x-detail) describes that detail; a native event from an inner
  control (sf-textarea, sf-toggle, sf-input, sf-country-code) has none.
- An object setting is a property input, as a list is: sf-context-menu search,
  sf-image-field value, sf-icon-button button-attributes, composition-overlay
  messages and insertion-target, sf-tabs settings, sf-profile-picker rights.
- A dated attribute alias of a setting is an input until it ends: sf-modal
  hide (minimizable) and unclose (dismissible, inverted).
- A legacy name offers what its axis offers: sf-button type and appearance no
  longer offer ghost, which reads as link (appearance=ghost in
  compatibility.aliases); sf-icon-button keeps ghost as an appearance.
- Kept although component.json does not declare them, because the code still
  reads them (x-registry): sf-tag type (the split legacy name), sf-quantity
  value (the attribute with a point), sf-context-menu and sf-toast role,
  sf-context-menu tabs as a string or a list, sf-dropdown sf-field:reset (sent
  by the trait).
- Gone from the registry: retired attributes (sf-file-preview avatar-size and
  open; sf-spinner width, height, stroke-width and dot-radius, which its
  component.json took out of the interface in 1.2.0 and the code still draws
  until 2026-12-01), host attributes (sf-country-code form, sf-popover role), the base
  lifecycle events sf-modal listed (sf-before-render, sf-after-render).
- sf-button's composition type (composition.declarative.props) is derived from
  its settings: it gains text-position, segment, icon-start, icon-end, radius
  and expanded; root-class and root-style stay out.
- button-group, country-code, file-upload and image-field wrote examples.json
  as a bare list; it is {examples: [...]} now, so the first-paint snapshots
  draw their examples.
- The words moved into component.json (summary of settings, events, actions)
  are embedded in each bundle: what the twenty-nine bundles embed of their
  component.json grows from 66.7 to 109.0 KB minified (19.7 to 35.1 KB gzip,
  per file), 38 KB of it summaries, which the runtime does not read.

### sf-alert 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- event detail described anew: sf-alert-action, sf-alert-close
- inputs added: root-style, aria-label
- input default: close-label "" → –
- role null → "status"

### sf-badge 1.1.2 → 1.1.3

- version 1.0.1 → 1.1.3
- inputs added: root-class, root-style
- input default: icon-start null → ""; icon-end null → ""
- role null → "none"
- compatibility.aliases [] → ["status=danger","icon-position=left","icon-position=right"]

### sf-button 1.1.4 → 1.1.5

- version 1.1.4 → 1.1.5
- events added: sf-button-press
- inputs added: root-style
- input default: expanded – → false
- input enum: appearance ["default","tonal","outline","link","surface","ghost"] → ["default","tonal","outline","link","surface"]; type ["default","tonal","outline","link","surface","ghost"] → ["default","tonal","outline","link","surface"]; tightness ["","low","high","highest"] → ["low","high","highest"]
- uses ["smart.icon","component.spinner"] → ["component.buttons","component.spinner","smart.icon"]
- composition.declarative.props derived from the settings (root-class and root-style stay out)
- role null → "button"
- compatibility.aliases [] → ["appearance=ghost","status=danger","status=critical","spacing=low","spacing=high","spacing=highest","icon-position=left","icon-position=right"]

### sf-button-group 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- event detail described anew: change
- method arguments from component.json: select
- inputs added: root-style
- input default: items "[]" → []
- uses ["component.button-group","smart.button","component.spinner"] → ["component.button-group","component.spinner","smart.button","smart.icon"]

### sf-composition-overlay 1.2.2 → 1.2.3

- version 1.2.2 → 1.2.3
- summary: component.json's words
- event detail described anew: sf-composition-overlay-select, sf-composition-overlay-apply, sf-composition-overlay-insert, sf-composition-overlay-move, sf-composition-overlay-change
- method arguments from component.json: attach, attachFrame, setDocument, setNodes, setDropFilter, setActions, setMessages, setInsertionTarget, select, edit
- inputs added: template, root-class, root-style, messages, insertion-target
- 19 summaries/descriptions now component.json's words

### sf-context-menu 1.4.3 → 1.4.4

- version 1.4.3 → 1.4.4
- events added: sf-context-menu-opened, sf-context-menu-closed
- event detail described anew: sf-context-menu-select, sf-context-menu-open, sf-context-menu-close, sf-context-menu-search, sf-context-menu-tab
- method arguments from component.json: openFor, toggleFor, close
- inputs added: root-style
- input default: search null → –
- uses ["component.context-menu","smart.button"] → ["component.context-menu","smart.button","smart.icon-button","smart.tabs"]

### sf-country-code 1.1.2 → 1.1.3

- version 1.0.0 → 1.1.3
- events added: input
- inputs added: template, root-class, root-style
- inputs removed: form
- input default: placeholder "+7(___)___-__-__" → –
- uses [] → ["component.country-code"]
- role null → "textbox"

### sf-drawer 1.8.1 → 1.8.2

- version 1.8.1 → 1.8.2
- events added: sf-drawer-open, sf-drawer-opened, sf-drawer-close, sf-drawer-closed, sf-drawer-snapped
- method arguments from component.json: open, close
- inputs added: root-class, root-style
- input default: close-label "" → –
- uses ["component.icon-buttons","component.close"] → ["component.close","component.icon-buttons"]

### sf-dropdown 1.4.3 → 1.4.4

- version 1.4.3 → 1.4.4
- event detail described anew: change
- inputs added: root-class, root-style
- input type: columns "string" → "number"
- input default: columns "6" → 6; search-placeholder "" → –
- uses ["component.dropdown","smart.list-item","smart.input","smart.icon-button"] → ["component.dropdown","component.icon-buttons","component.inputs","smart.icon-button","smart.input","smart.list-item"]
- role "button with listbox popup" → "combobox"

### sf-file-preview 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: sf-file-preview-download, sf-file-preview-detach
- inputs added: root-class, root-style
- inputs removed: avatar-size, open
- input default: download-label "" → –; remove-label "" → –
- uses ["component.file-preview","component.icons","component.icon-buttons"] → ["component.file-preview","component.icon-buttons","component.icons"]

### sf-file-upload 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- event detail described anew: change, sf-file-upload-attach, sf-file-upload-attached, sf-file-upload-detach, sf-file-upload-rejected, sf-file-upload-retry, sf-file-upload-begun, sf-file-upload-chunk, sf-file-upload-completed, sf-file-upload-failed, sf-file-upload-cancelled, sf-file-upload-finished
- method arguments from component.json: removeItem
- inputs added: root-class, root-style
- input default: link-text "" → –; text "or drag and drop" → –
- uses [] → ["component.featured-icon","component.file-upload","component.icon-buttons","smart.progress-bar"]

### sf-icon-button 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- inputs added: root-style, button-attributes
- input minimum: badge-cap – → 1
- input enum: tightness ["","low","high","highest"] → ["low","high","highest"]
- uses ["component.icon-buttons","smart.icon","smart.close","component.spinner","component.badges"] → ["component.badges","component.icon-buttons","component.spinner","smart.close","smart.icon"]
- compatibility.aliases [] → ["spacing=low","spacing=high","spacing=highest"]

### sf-image-field 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- event detail described anew: change, input, sf-image-field-attach, sf-image-field-detach, sf-image-field-rejected
- method arguments from component.json: takeFile, setError
- inputs added: root-style
- input type: value "string" → "object"
- input default: value "" → null
- 1 summaries/descriptions now component.json's words

### sf-input 1.3.3 → 1.3.4

- version 1.3.3 → 1.3.4
- title «Inputs» → «Text fields»
- inputs added: template, root-style
- input default: icon-start null → ""; text-end null → ""
- uses ["component.inputs","smart.icon"] → ["component.icon-buttons","component.inputs","smart.icon"]

### sf-list-item 1.2.2 → 1.2.3

- version 1.2.2 → 1.2.3
- title «List Item» → «List item»
- summary: component.json's words
- events added: sf-list-item-open
- inputs added: root-class, root-style
- uses [] → ["component.avatars","component.checkbox","component.dropdown","component.icons","component.tags"]
- role "option when rendered by Dropdown; none in standalone preview and list rows (the list owns the role; aria-current marks a selected row)" → "none"
- 4 summaries/descriptions now component.json's words

### sf-modal 1.4.1 → 1.4.2

- version 1.4.1 → 1.4.2
- summary: component.json's words
- events added: sf-modal-open, sf-modal-opened, sf-modal-close, sf-modal-closed, sf-modal-minimize, sf-modal-minimized, sf-modal-expand, sf-modal-expanded, sf-modal-content-upload, sf-modal-content-uploaded
- events removed: sf-after-render, sf-before-render
- methods added: minimize, expand, confirm
- method arguments from component.json: open, close
- inputs added: root-style
- input default: title "" → –
- uses ["component.spinner"] → ["component.icon-buttons","component.modal","component.spinner"]

### sf-pagination 1.3.1 → 1.3.2

- version 1.3.1 → 1.3.2
- events added: sf-pagination-change, sf-pagination-size-change, sf-pagination-count, sf-pagination-load-more, sf-pagination-selection-clear, sf-pagination-action-change, sf-pagination-action-for-all-change, sf-pagination-apply
- method arguments from component.json: goToPage, showMore
- inputs added: root-class, root-style
- input default: pages-label "" → –; page-label "" → –; previous-label "" → –; next-label "" → –; last-label "" → –; total-label "" → –; selected-label "" → –; show-more-text "" → –; page-size-label "" → –; action-apply-text "" → –; action-for-all-label "" → –; actions-label "" → –; action-choose-label "" → –; actions-region-label "" → –; clear-selection-label "" → –; show-count-label "" → –; counting-label "" → –; first-label "" → –; page-field-label "" → –
- uses ["smart.button","smart.checkbox","smart.dropdown","smart.icon-button","smart.input","smart.list-item","smart.spinner"] → ["component.pagination","smart.button","smart.checkbox","smart.dropdown","smart.icon-button","smart.input","smart.list-item","smart.spinner"]
- 2 summaries/descriptions now component.json's words

### sf-popover 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- events added: sf-popover-opened, sf-popover-closed
- event detail described anew: sf-popover-open, sf-popover-close
- method arguments from component.json: toggle, close
- inputs added: root-class, root-style
- inputs removed: role

### sf-profile-picker 1.1.5 → 1.1.6

- version 1.1.5 → 1.1.6
- inputs added: rights

### sf-progress-bar 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- methods added: chunk
- inputs added: root-class, root-style, aria-label
- input type: value "string" → "number"
- input default: value "0" → 0
- input minimum: value – → 0
- input maximum: value – → 100

### sf-progress-scale 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- methods added: chunk
- inputs added: root-class, root-style, aria-label
- input type: value "string" → "number"
- input default: value "0" → 0
- input minimum: value – → 0
- input maximum: value – → 100

### sf-quantity 1.1.2 → 1.1.3

- version 1.0.0 → 1.1.3
- event detail described anew: change, input
- method arguments from component.json: stepUp, stepDown, setError
- inputs added: root-style
- input type: min "string" → "number"; max "string" → "number"; step "string" → "number"; page-step "string" → "number"; precision "string" → "integer"
- input default: min "" → –; max "" → –; step "1" → 1; page-step "" → –; precision "" → –; decrement-label "" → –; increment-label "" → –
- input minimum: precision – → 0
- input maximum: precision – → 20
- uses ["component.quantity","component.icons","component.icon-buttons"] → ["component.icon-buttons","component.icons","component.quantity"]

### sf-skeleton 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- inputs added: template, root-style
- input type: count "number" → "integer"
- role "none; generated placeholder geometry is aria-hidden" → "none"

### sf-spinner 1.2.1 → 1.2.2

- version 1.2.1 → 1.2.2
- inputs added: template, root-style
- inputs removed: width, height, stroke-width, dot-radius
- input type: dots "string" → "integer"; filled "string" → "integer"
- input default: label "" → –; dots "8" → 8; filled "3" → 3
- input minimum: dots – → 1; filled – → 0
- role "status when announce is true and label is non-empty; otherwise no widget role" → "status"

### sf-tabs 1.1.5 → 1.1.6

- version 1.1.5 → 1.1.6
- inputs added: settings

### sf-tag 1.1.3 → 1.1.4

- version 1.1.3 → 1.1.4
- events added: sf-tag-close
- event detail described anew: change
- inputs added: root-style
- input default: close-label "" → –; type "checkbox" → ""
- uses ["component.avatars","component.dot","smart.icon-button","component.tags"] → ["component.avatars","component.dot","component.icon-buttons","component.tags","smart.icon-button"]
- role null → "button"
- compatibility.aliases [] → ["kind=quantity"]
- 3 summaries/descriptions now component.json's words

### sf-textarea 1.5.2 → 1.5.3

- version 1.4.0 → 1.5.3
- title «Textarea» → «Text area»
- event detail described anew: change, input
- inputs added: template, root-style
- input default: minlength null → –; maxlength null → –; max-rows null → –
- uses ["component.textarea"] → ["component.icon-buttons","component.icons","component.textarea"]

### sf-toast 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- events added: sf-toast-closed
- event detail described anew: sf-toast-action, sf-toast-close
- methods added: show
- inputs added: template, root-style
- input default: close-label "" → –
- uses ["component.toast","component.buttons","smart.icon-button","smart.icon"] → ["component.buttons","component.close","component.toast","smart.icon","smart.icon-button"]
- role null → "status"

### sf-toggle 1.1.2 → 1.1.3

- version 1.0.0 → 1.1.3
- event detail described anew: change
- inputs added: template, root-class, root-style
- uses ["component.toggle"] → ["component.icons","component.toggle"]

### sf-tooltip 1.1.1 → 1.1.2

- version 1.1.1 → 1.1.2
- inputs added: root-style
- uses [] → ["component.tooltip"]
- role "tooltip when linked by the ordinary data-tooltip controller" → "tooltip"

### sf-tree-item 1.1.2 → 1.1.3

- version 1.1.2 → 1.1.3
- title «Tree Item» → «Tree item»
- summary: component.json's words
- events added: sf-tree-item-open
- event detail described anew: sf-tree-item-toggle
- methods added: expand, collapse, toggleOpen
- inputs added: root-style
- input default: open-label "" → –; close-label "" → –
- uses ["component.icon-buttons","component.icons","component.tree","component.tree-item"] → ["component.icon-buttons","component.icons","component.tree-item"]
- 5 summaries/descriptions now component.json's words
