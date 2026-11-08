// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-menu-context'] = {
  tags: ['sf-menu-context', 'sf-context-menu'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'context-menu' },
    // An entry's shortcut is the kbd component's keys: plain glyphs in a menu.
    { name: 'kbd' },
    { name: 'cl-button' },
    // The tabs and the close button draw only a panel's head: fetched after the
    // page is ready, not held up front for every menu.
    { name: 'cl-tabs', lazy: true },
    { name: 'cl-button-icon', lazy: true },
  ],
};
