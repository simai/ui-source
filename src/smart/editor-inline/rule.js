// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-editor-inline'] = {
  tags: ['sf-editor-inline', 'sf-inline-editor'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    // The toolbar is the class markup of ghost icon buttons (C141 (4), C144).
    { name: 'icon-buttons' },
    { name: 'icons' },
    // The link window's address field (C141 (6), C172 (4)).
    { name: 'cl-input' },
    // The link window's «Применить» and «Убрать ссылку».
    { name: 'cl-button' },
    // ⋯ «Ещё» opens the standard menu (core/js/overflow-row.js, C155).
    { name: 'cl-menu-context', lazy: true },
  ],
};
