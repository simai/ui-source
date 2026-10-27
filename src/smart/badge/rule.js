SF.RuleLoader['cl-badge'] = {
  tags: ['sf-badge'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // The badge names itself through a visually hidden label; the utility comes
  // with the component rather than from a scan, which a badge inside another
  // component's markup can miss -- and then the label reads beside the text
  // (Larena, «Элементы: 7 7», 2026-10-12).
  relation: [{ name: 'badges' }, { name: 'sr-only/default' }],
};

// The bundle's former name (the folder was `badges` until standard 1.3.8 §3,
// §21 gave it the tag's name): a rule that still names it loads sf-badge.
// Dated like the element's aliases: until 2026-12-01.
SF.RuleLoader['cl-badges'] = {
  tags: [],
  type: 'smart',
  mode: 'smart',
  js: false,
  css: false,
  relation: [{ name: 'cl-badge' }],
};
