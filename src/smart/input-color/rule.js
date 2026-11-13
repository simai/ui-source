// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The colour control loads on demand like any other Smart element. Its relations are
// the icons, the icon button of the reset and the eyedropper, and the segmented
// switch of its own window (lazy: drawn only once the window opens).
SF.RuleLoader['cl-input-color'] = {
  tags: ['sf-input-color', 'sf-color'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icons' },
    { name: 'cl-icon' },
    { name: 'cl-button-icon' },
    // cl-segmented: the window's «Палитра / Своё» switch, drawn only once the window opens, fetched after the page is ready.
    { name: 'cl-segmented', lazy: true },
  ],
};
