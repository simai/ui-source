SF.RuleLoader['cl-input'] = {
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

// The bundle's former name (the folder was `inputs` until standard 1.3.8 §3,
// §21 gave it the tag's name): a rule that still names it loads sf-input.
// Dated like the element's aliases: until 2026-12-01.
SF.RuleLoader['cl-inputs'] = {
    tags: [],
    type: 'smart',
    mode: 'smart',
    js: false,
    css: false,
    relation: [{ name: 'cl-input' }],
};
