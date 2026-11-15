// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// sf-input-quantity draws the class component's markup, so the class rule comes with
// it: the quantity sheet, and through it the icon buttons its steppers are
// drawn as. The glyphs are the icon font; the reset back to an inherited value
// is an icon button too (simai/ui-source#28). Its own sheet is the inherited
// value's marker and reset.
SF.RuleLoader['cl-input-quantity'] = {
  tags: ['sf-input-quantity', 'sf-quantity'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'quantity' },
    { name: 'icons' },
    { name: 'icon-buttons' },
    // The «?» after the label (help, owner decision C153 (8)) is sf-help-mark: fetched with the field.
    { name: 'cl-help-mark' },
    // inputs: the field layer's .sf-field-action rules (owner decision C123), which the shared reset to the inherited value takes, as sf-input's clear and reveal do.
    { name: 'inputs' },
  ],
};
