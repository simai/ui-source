# Component files 1.4, phase A waves 1 and 2: what changed for consumers

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

