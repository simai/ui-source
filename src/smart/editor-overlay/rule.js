// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-editor-overlay'] = {
  tags: ['sf-editor-overlay', 'sf-composition-overlay'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-sortable' },
    { name: 'cl-button-icon' },
    { name: 'cl-tooltip' },
    // ⋯ «Ещё» of the toolbar opens the standard menu (core/js/overflow-row.js, owner decisions C155 and C170 (1)).
    { name: 'cl-menu-context', lazy: true },
  ],
};
