// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-icon-button'] = {
  tags: ['sf-icon-button'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    { name: 'cl-icon' },
    { name: 'cl-close' },
    { name: 'pointer-events/default' },
    // The badge sheet places a count or a dot on the button (simai/ui-source#12).
    { name: 'badges' },
    // The spinner a loading icon button shows, fetched after the page is ready.
    { name: 'spinner', lazy: true },
  ],
};

// The bundle's former name cl-icon-buttons (the folder was `icon-buttons` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-icon-button from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
