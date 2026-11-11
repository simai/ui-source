// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-segmented'] = {
  tags: ['sf-segmented', 'sf-button-group'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'button-group' },
    { name: 'cl-button' },
    { name: 'cl-icon' },
    // spinner: a loading item shows it, fetched after the page is ready.
    { name: 'spinner', lazy: true },
    // cl-dropdown: when the labels do not fit on one line the element draws an sf-dropdown in the track's place (owner decision C47 C), fetched after the page is ready.
    { name: 'cl-dropdown', lazy: true },
  ],
};
