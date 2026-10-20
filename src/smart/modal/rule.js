SF.RuleLoader['cl-modal'] = {
  tags: ['sf-modal'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // spinner: the remote content's loading state shows it, fetched after the page is ready.
  relation: [{ name: 'modal' }, { name: 'icon-buttons' }, { name: 'spinner', lazy: true }],
};
