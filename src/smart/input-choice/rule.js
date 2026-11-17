// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-input-choice'] = {
  tags: ['sf-input-choice'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    // The single control on a card's name line is the class radio sf-radio draws
    // (.sf-radio-button, size 1): its box is the name line.
    { name: 'radio' },
    // The multiple control is the class checkbox sf-checkbox draws (.sf-checkbox,
    // size 1), its check the icon font's.
    { name: 'checkbox' },
    // An option's icon on the name line and the check of a chosen checkbox.
    { name: 'icons' },
    // An option's badge is sf-badge (tonal, primary, on the half line) beside its
    // name, only when an option carries one.
    { name: 'cl-badge', lazy: true },
    // The «?» after the label or the heading (help, C153 (8), C165 (1)) is
    // sf-help-mark, only when help is set.
    { name: 'cl-help-mark', lazy: true },
    // An option's picture in a row of appearance list (avatar, FO-4) is sf-avatar on the row's line, only when an option carries one.
    { name: 'cl-avatar', lazy: true },
    // The search field over the rows of appearance list (searchable, FO-4) is sf-input, filled, only when the field is searchable.
    { name: 'cl-input', lazy: true },
    // «Show more» and «Retry» under the rows of a provider's pages (FO-4) are sf-button, ghost, only with a provider.
    { name: 'cl-button', lazy: true },
  ],
};
