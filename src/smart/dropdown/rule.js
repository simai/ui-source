// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// css: its own sheet, the slot of an inherited value (simai/ui-source#28).
SF.RuleLoader['cl-dropdown'] = {
  tags: ['sf-dropdown'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'dropdown' },
    { name: 'inputs' },
    { name: 'icon-buttons' },
    { name: 'cl-list-item' },
    { name: 'cl-input' },
    { name: 'cl-button-icon' },
    // The picture of a single choice in the field and an icon tag's icon are sf-icon elements,
    // so their names reach the first icon font request (2026-11-09, as sf-tag 1.3.2).
    { name: 'cl-icon' },
    // The «?» after the label (help, owner decision C153 (8)) is sf-help-mark: fetched with the field.
    { name: 'cl-help-mark' },
    // An option's colour (owner decision C308 FO-4) draws its name as sf-badge (tonal, tight, line 1) in its row, only when an option carries color.
    { name: 'cl-badge', lazy: true },
  ],
};
