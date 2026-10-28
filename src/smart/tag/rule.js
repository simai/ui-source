// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-tag'] = {
  tags: ['sf-tag'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    { name: 'tags' },
    { name: 'avatars' },
    { name: 'dot' },
    { name: 'cl-icon-button' },
  ],
};

// The bundle's former name cl-tags (the folder was `tags` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-tag from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
