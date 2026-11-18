# Hosts without a box

A Smart part's host lays out as `display: contents` (smart-base
`applyHostDisplayStyle`): the tag the page wrote, `<sf-button>`,
`<sf-wizard>`, `<sf-form>`, generates no box of its own. What it draws
stands in the page as if the host were not there, so the page's flex and grid
place the drawn element directly. The host still holds the attributes, the
properties, the methods and the events.

What this means for a page, a test or a probe (Larena LF-7, 2026-11-18):

- **Measure the drawn element, not the host.** `host.getBoundingClientRect()`
  is all zeros and `host.getClientRects()` is empty. Measure the element in
  the table below (`host.querySelector(...)`), or the first element inside the
  host that has a box.
- **`host.scrollIntoView()` works** (core runtime, 2026-11-18): the host
  scrolls the first element inside it that has a box. Before, it did nothing.
- **`host.focus()` works**: a part that names its control (`focusDelegate`)
  focuses it; any other part with no box and no `tabindex` focuses the first
  control inside it a person could reach with Tab (a form: its first field; a
  wizard: its first button). Before, only the parts with a delegate took the
  focus. `host.contains(document.activeElement)` is true afterwards.
- **Style the drawn element.** A width, a margin or a position on the host
  does nothing; the part's root takes `root-class` and `root-style`, and a
  `data-*` written on a host whose control is inside is moved to that control
  (`forwardHostAttributes`).

## The parts and the element to measure

Read from the built parts, each placed from its studio fixture
(ui-control control/evidence/2026-11-18-lf-data, probe `lf7.probe.mjs`): the
first element inside the host with a box, and where `host.focus()` lands.

| Part | Measure / scroll to | `focus()` lands on |
| --- | --- | --- |
| `sf-accordion` | `div.sf-accordion-group` | `button` |
| `sf-alert` | `div.sf-alert` | `button` |
| `sf-alert-bar` | `div.sf-alert-bar` | `time` |
| `sf-avatar` | `div.sf-avatar-label-group` | — |
| `sf-avatar-group` | `div.sf-avatar-label-group` | — |
| `sf-badge` | `span.sf-badge` | — |
| `sf-breadcrumbs` | `a` | `a` |
| `sf-button` | `button.sf-button` | `button` |
| `sf-button-close` | `button.sf-icon-button` | `button` |
| `sf-button-copy` | `span.sf-copy-button` | `button` |
| `sf-button-icon` | `button.sf-icon-button` | `button` |
| `sf-change` | `span.sf-change` | — |
| `sf-checkbox` | `label.sf-checkbox` | `input` |
| `sf-confirm` | `section.sf-confirm` | `button` |
| `sf-confirm-change` | `section.sf-confirm-change` | `button` |
| `sf-contents` | `nav.sf-contents` | `a` |
| `sf-display-settings` | `div.sf-display-settings` | `button` |
| `sf-dropdown` | `div.sf-dropdown` | `button` |
| `sf-empty-state` | `div.sf-placeholder` | — |
| `sf-file-download` | `a.sf-download-file` | `a` |
| `sf-file-preview` | `div.sf-file-preview` | `a` |
| `sf-file-upload` | `div.sf-file-upload` | `div[button]` |
| `sf-form` | `form.sf-form` | `input` |
| `sf-gallery` | `div.sf-gallery` | `button` |
| `sf-header-page` | `header.sf-page-header` | — |
| `sf-header-site` | `header.sf-site-header` | — |
| `sf-help-mark` | `span.sf-help-mark` | `button` |
| `sf-icon` | `i.sf-icon` | — |
| `sf-include` | `div.sf-include` | `a` |
| `sf-input` | `label.sf-input` | `input` |
| `sf-input-choice` | `div.sf-choice` | `input` |
| `sf-input-code` | `div.sf-verification-form` | `input` |
| `sf-input-country` | `label.sf-country-code` | `span[button]` |
| `sf-input-date` | `div.sf-datepicker-wrap` | `input` |
| `sf-input-image` | `div.sf-image-field` | `button` |
| `sf-input-lookup` | `div.sf-lookup` | `input[combobox]` |
| `sf-input-quantity` | `div.sf-quantity` | `input[spinbutton]` |
| `sf-input-rich` | `div.sf-rich-text` | `div[textbox]` |
| `sf-input-textarea` | `label.sf-textarea` | `textarea` |
| `sf-language` | `button.sf-button` | `button` |
| `sf-list` | `div.sf-list` | — |
| `sf-list-attention` | `section.sf-list-attention` | `a` |
| `sf-list-description` | `div.sf-list-description` | `a` |
| `sf-list-feed` | `div.sf-list-feed` | `div[region]` |
| `sf-list-item` | `div.sf-list-item` | — |
| `sf-list-timeline` | `div.sf-list-timeline` | `button` |
| `sf-menu` | `nav.sf-smart-menu` | `a` |
| `sf-menu-context` | `div.sf-context-menu` | `button[menuitem]` |
| `sf-pager` | `nav.sf-pager` | `a` |
| `sf-pagination` | `nav.sf-pagination` | `button` |
| `sf-profile-picker` | `div.sf-profile-picker` | `button` |
| `sf-progress-bar` | `div.sf-progress-bar` | — |
| `sf-progress-ring` | `div.sf-progress-ring` | — |
| `sf-progress-run` | `section.sf-progress-run` | `button` |
| `sf-progress-scale` | `div.sf-progress-scale` | — |
| `sf-radio` | `label.sf-radio-button` | `input` |
| `sf-segmented` | `div.sf-button-group` | `button[radio]` |
| `sf-settings` | `div.sf-context-menu` | `button[menuitem]` |
| `sf-skeleton` | `div.sf-skeleton` | — |
| `sf-slider` | `div` | `button` |
| `sf-slider-range` | `div.sf-range-slider-group` | `div[slider]` |
| `sf-spinner` | `div.sf-loader-container` | — |
| `sf-steps` | `div.sf-steps` | `button` |
| `sf-switch` | `label.sf-switch` | `input[switch]` |
| `sf-tabs` | `button` | `button` |
| `sf-tag` | `div.sf-tag` | `button` |
| `sf-theme-generator` | `div.sf-theme-generator` | `button` |
| `sf-tile-metric` | `div.sf-tile-metric` | — |
| `sf-time` | `span.sf-time-anchor` | `time` |
| `sf-toast` | `div.sf-toast` | `button` |
| `sf-tooltip` | `div.sf-tooltip` | — |
| `sf-tree` | `div.sf-tree` | `div[treeitem]` |
| `sf-tree-item` | `div.sf-tree-item` | `button` |

Parts with a box of their own (measure the host): `sf-popover`,
`sf-tag-group`, `sf-reference-link`, `sf-resizer`, `sf-sortable`,
`sf-editor-overlay`; `sf-editor-inline` is `display: none` until it
edits.

Parts that draw in a portal at the end of the body (or of a
`[data-sf-overlay-container]`), so nothing of theirs is inside the host:
`sf-modal` (`host.modalRoot`, the `.sf-modal` element), `sf-drawer` (its
panel `[data-sf-drawer-portal="<id>"] [data-sf-drawer-panel]`), `sf-search`
(its window, `.sf-search-portal`). `sf-wizard-step` is drawn by its `sf-wizard`: measure the
wizard's step area.
