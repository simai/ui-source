// sf-image-field loads on demand like any other Smart element. Its relations
// are what it draws with: the buttons «Заменить…», «Убрать» and «Выбрать…»
// (sf-button, which brings its own icons) and the glyph of an empty or broken
// thumbnail (the icon font). The file dialog is the platform's and brings
// nothing.
SF.RuleLoader['cl-image-field'] = {
  tags: ['sf-image-field'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-icon' },
  ],
};
