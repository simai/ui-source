// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-settings'] = {
  tags: ['sf-settings'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-menu-context' },
    // The panel look's footer and the close button: fetched after the page is ready, not held up front for every menu look.
    { name: 'cl-button', lazy: true },
    { name: 'cl-button-icon', lazy: true },
    // The panel look's groups as tabs.
    { name: 'cl-tabs', lazy: true },
    // The panel look's switch rows.
    { name: 'cl-switch', lazy: true },
  ],
};
