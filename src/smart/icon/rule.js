// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-icon'] = {
  tags: ['sf-icon'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'icons' },
    { name: 'badges', lazy: true },
  ],
};

// The bundle's former name cl-icons (the folder was `icons` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-icon from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
