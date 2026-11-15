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
    // A row's «⋯», Save and Cancel of the rename, the own sheet's close:
    // sf-button-icon ghost on-surface, a step below the picker's size.
    { name: 'cl-button-icon' },
    // The menu of a row's «⋯» (owner decision C163 (3)): sf-menu-context popup with
    // «Переименовать» (F2) and, after a line, «Удалить…» in the danger colour.
    { name: 'cl-menu-context', lazy: true },
    // On a phone (below md) the panel is the Framework's bottom sheet,
    // sf-drawer placement=bottom (owner decisions C163 (4), C157 (5)); a page without it gets the picker's own sheet.
    { name: 'cl-drawer', lazy: true },
    // «Личный / Для всех» of the new-profile form: the standard sf-segmented.
    { name: 'cl-segmented' },
  ],
};
