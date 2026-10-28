// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-input'] = {
  tags: ['sf-input'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'inputs' },
    { name: 'cl-icon' },
    // The reset back to an inherited value is an icon button (simai/ui-source#28).
    { name: 'icon-buttons' },
  ],
};

// The bundle's former name cl-inputs (the folder was `inputs` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-input from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
