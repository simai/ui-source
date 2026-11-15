// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// css: its own sheet and the icon button carry the reset back to an inherited
// value (simai/ui-source#28).
SF.RuleLoader['cl-input-textarea'] = {
  tags: ['sf-input-textarea', 'sf-textarea'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'textarea' },
    { name: 'icons' },
    { name: 'icon-buttons' },
    // inputs: the field layer's .sf-field-action rules (owner decision C123), which the shared reset to the inherited value takes, as sf-input's clear and reveal do.
    { name: 'inputs' },
  ],
};
