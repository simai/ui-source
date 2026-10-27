SF.RuleLoader['cl-button-group'] = {
  tags: ['sf-button-group'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // spinner: a loading item shows it, fetched after the page is ready.
  relation: [{ name: 'button-group' }, { name: 'cl-button' }, { name: 'cl-icon' }, { name: 'spinner', lazy: true }],
};
