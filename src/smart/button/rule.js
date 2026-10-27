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

// The bundle's former name cl-buttons (the folder was `buttons` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-button from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
