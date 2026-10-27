SF.RuleLoader['cl-button'] = {
  tags: ['sf-button'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'buttons' },
    { name: 'pointer-events/default' },
    { name: 'text-align/default' },
    { name: 'cl-icon' },
    // The spinner a loading button shows: its slot is drawn by the button sheet,
    // the motion by the spinner's, fetched after the page is ready.
    { name: 'spinner', lazy: true },
  ],
};

// The bundle's former name (the folder was `buttons` until standard 1.3.8 §3,
// §21 gave it the tag's name): a rule that still names it loads sf-button.
// Dated like the element's aliases: until 2026-12-01.
SF.RuleLoader['cl-buttons'] = {
  tags: [],
  type: 'smart',
  mode: 'smart',
  js: false,
  css: false,
  relation: [{ name: 'cl-button' }],
};
