// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// sf-input-image loads on demand like any other Smart element. Its relations
// are what it draws with: the buttons «Выбрать…», «Заменить…» and «Изменить»
// (sf-button, which brings its own icons), the remove and cancel icons (sf-
// button-icon) and the glyph of an empty or broken thumbnail (the icon font);
// on demand, when the page turns them on, the upload ring (sf-progress-ring),
// the description and the address fields (sf-input), «Декоративная» (sf-
// switch) and the menu of sources (sf-menu-context). The file dialog is the
// platform's and brings nothing.
SF.RuleLoader['cl-input-image'] = {
  tags: ['sf-input-image', 'sf-image-field'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-button-icon' },
    { name: 'cl-icon' },
    { name: 'cl-progress-ring', lazy: true },
    { name: 'cl-input', lazy: true },
    { name: 'cl-switch', lazy: true },
    { name: 'cl-menu-context', lazy: true },
  ],
};
