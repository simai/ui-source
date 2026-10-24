SF.RuleLoader['cl-dropdown'] = {
  tags: ['sf-dropdown'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // Its own sheet: the slot of an inherited value (simai/ui-source#28).
  css: true,
  relation: [
    { name: 'dropdown' },
    { name: 'inputs' },
    { name: 'icon-buttons' },
    { name: 'cl-list-item' },
    { name: 'cl-inputs' },
    { name: 'cl-icon-buttons' },
  ],
};
