SF.RuleLoader['cl-context-menu'] = {
  tags: ['sf-context-menu'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // The tabs and the close button draw only a panel's head: fetched after the
  // page is ready, not held up front for every menu.
  relation: [{ name: 'context-menu' }, { name: 'cl-button' }, { name: 'cl-tabs', lazy: true }, { name: 'cl-icon-buttons', lazy: true }],
};
