// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// sf-accordion loads on demand like any other Smart element. It draws the
// class accordion's markup, so the class accordion is what it draws with: its
// sheet (and its runtime, which leaves the element's sections alone), the
// icon font for the marker and an icon before a title, and sf-badge, only
// when a section carries a badge.
SF.RuleLoader['cl-accordion'] = {
  tags: ['sf-accordion'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'accordion' },
    { name: 'icons' },
    { name: 'cl-badge', lazy: true },
  ],
};
