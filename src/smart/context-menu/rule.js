// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-context-menu'] = {
  tags: ['sf-context-menu'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'context-menu' },
    { name: 'cl-button' },
    // The tabs and the close button draw only a panel's head: fetched after the
    // page is ready, not held up front for every menu.
    { name: 'cl-tabs', lazy: true },
    { name: 'cl-icon-button', lazy: true },
  ],
};
