// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The card draws its two answers as sf-button, the outcome's glyph as sf-icon
// and its values as sf-change (1.7.0); a tag it renders is a tag it fetches.
// Nothing else: the values are text, and what a change means is the host's.
SF.RuleLoader['cl-confirm-change'] = {
  tags: ['sf-confirm-change', 'sf-change-confirm'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-icon' },
    { name: 'cl-change' },
  ],
};
