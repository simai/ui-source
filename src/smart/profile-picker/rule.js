// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-profile-picker'] = {
  tags: ['sf-profile-picker'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-icon' },
    // Rename and Delete on a row, Save and Cancel of the rename, the sheet's close:
    // sf-button-icon ghost on-surface (Delete with status danger), a step below the picker's size.
    { name: 'cl-button-icon' },
    // «Личный / Для всех» of the new-profile form: the standard sf-segmented.
    { name: 'cl-segmented' },
  ],
};
