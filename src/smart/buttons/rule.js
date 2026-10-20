SF.RuleLoader['cl-buttons'] = {
  tags: ['sf-button'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'buttons' },
    { name: 'pointer-events/default' },
    { name: 'text-align/default' },
    { name: 'cl-icons' },
    // The spinner a loading button shows: its slot is drawn by the button sheet,
    // the motion by the spinner's, fetched after the page is ready.
    { name: 'spinner', lazy: true },
  ],
};
