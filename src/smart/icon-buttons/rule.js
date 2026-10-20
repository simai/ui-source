SF.RuleLoader['cl-icon-buttons'] = {
  tags: ['sf-icon-button'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    { name: 'cl-icons' },
    { name: 'cl-close' },
    { name: 'pointer-events/default' },
    // The spinner a loading icon button shows, fetched after the page is ready.
    { name: 'spinner', lazy: true },
  ],
};
