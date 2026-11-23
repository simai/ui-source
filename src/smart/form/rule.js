// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-form'] = {
  tags: ['sf-form'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-help-mark' },
    { name: 'cl-icon' },
    // The leave question (FS-4): an sf-modal size question with its two answers, fetched when the question opens (GB18 L3: not on the form's first paint).
    { name: 'cl-modal', lazy: true },
    // holdFieldsReadOnly from component/modal/js/_focus.js (bundled into the form's script): the fields are held while a save runs (FS-2, C159 (9)); the window's sheets are not on the form's first paint (GB18 L3).
    { name: 'modal', lazy: true },
  ],
};
