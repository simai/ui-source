SF.RuleLoader['cl-textarea'] = {
  tags: ['sf-textarea'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // Its own sheet and the icon button carry the reset back to an inherited
  // value (simai/ui-source#28).
  css: true,
  relation: [{ name: 'textarea' }, { name: 'icons' }, { name: 'icon-buttons' }],
};
