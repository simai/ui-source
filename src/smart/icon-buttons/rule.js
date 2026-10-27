SF.RuleLoader['cl-icon-buttons'] = {
  tags: ['sf-icon-button'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    { name: 'cl-icon' },
    { name: 'cl-close' },
    { name: 'pointer-events/default' },
    // The badge sheet places a count or a dot on the button (simai/ui-source#12).
    { name: 'badges' },
    // The spinner a loading icon button shows, fetched after the page is ready.
    { name: 'spinner', lazy: true },
  ],
};
