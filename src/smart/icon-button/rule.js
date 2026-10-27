SF.RuleLoader['cl-icon-button'] = {
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

// The bundle's former name (the folder was `icon-buttons` until standard 1.3.8
// §3, §21 gave it the tag's name): a rule that still names it loads
// sf-icon-button. Dated like the element's aliases: until 2026-12-01.
SF.RuleLoader['cl-icon-buttons'] = {
  tags: [],
  type: 'smart',
  mode: 'smart',
  js: false,
  css: false,
  relation: [{ name: 'cl-icon-button' }],
};
