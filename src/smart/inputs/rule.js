SF.RuleLoader['cl-inputs'] = {
    tags: ['sf-input'],
    type: 'smart',
    mode: 'smart',
    js: true,
    css: true,
    relation: [
    { name: 'inputs' },
    { name: 'cl-icons' },
    // The reset back to an inherited value is an icon button (simai/ui-source#28).
    { name: 'icon-buttons' },
  ]
};
