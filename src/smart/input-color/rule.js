// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The colour control loads on demand like any other Smart element. Its relations are
// the icons, the icon button of the reset and the eyedropper, and the segmented
// switch, the button «Применить» and the copy action of its own window (lazy: drawn
// only once the window opens).
SF.RuleLoader['cl-input-color'] = {
  tags: ['sf-input-color', 'sf-color'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    // The «?» after the label (help, owner decision C153 (8)) is sf-help-mark: fetched with the field.
    { name: 'cl-help-mark' },
    { name: 'icons' },
    // inputs: the field layer's .sf-field-action rules (owner decision C123), which the reset inside the frame takes, as sf-input's clear and reveal do.
    { name: 'inputs' },
    { name: 'cl-icon' },
    { name: 'cl-button-icon' },
    // cl-segmented: the window's «Палитра / Своё» switch, drawn only once the window opens, fetched after the page is ready.
    { name: 'cl-segmented', lazy: true },
    // cl-button: «Применить» at the bottom of «Своё» (owner decision C209), drawn only once the window opens.
    { name: 'cl-button', lazy: true },
    // cl-button-copy: the copy action at the end of the code field in «Своё» (C209 (4), a field action, C123), drawn only once the window opens.
    { name: 'cl-button-copy', lazy: true },
  ],
};
