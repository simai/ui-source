// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The header draws a badge for its count and its install mark, and an icon
// button for its star; a tag it renders is a tag it fetches.
SF.RuleLoader['cl-header-page'] = {
  tags: ['sf-header-page', 'sf-page-header'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-badge' },
    { name: 'cl-button-icon' },
    { name: 'cl-icon' },
    // ⋯ «Ещё» opens the standard menu with the actions that left the row (core/js/overflow-row.js, owner decision C155).
    { name: 'cl-menu-context', lazy: true },
  ],
};
