SF.RuleLoader['cl-tag'] = {
    tags: ['sf-tag'],
    type: 'smart',
    mode: 'smart',
    js: true,
    css: true,
    relation: [
    { name: 'icon-buttons' },
    { name: 'tags' },
    { name: 'avatars' },
    { name: 'dot' },
    { name: 'cl-icon-button' },
  ],
};

// The bundle's former name (the folder was `tags` until standard 1.3.8 §3,
// §21 gave it the tag's name): a rule that still names it loads sf-tag.
// Dated like the element's aliases: until 2026-12-01.
SF.RuleLoader['cl-tags'] = {
    tags: [],
    type: 'smart',
    mode: 'smart',
    js: false,
    css: false,
    relation: [{ name: 'cl-tag' }],
};
