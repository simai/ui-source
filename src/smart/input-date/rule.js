// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-input-date'] = {
  tags: ['sf-input-date', 'sf-datepicker'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'datepicker' },
    { name: 'cl-input' },
    { name: 'cl-button' },
    { name: 'cl-button-icon' },
    { name: 'cl-icon' },
    // On a phone (below 60rem) a range opens a ribbon of months in the
    // Framework's bottom sheet, sf-drawer placement=bottom (owner decision C62).
    { name: 'cl-drawer', lazy: true },
  ],
};
