// The colour control loads on demand like any other Smart element. Its relation is
// the icon button it uses to return to an inherited colour; the native picker it
// opens is the platform's and brings nothing.
SF.RuleLoader['cl-color'] = {
  tags: ['sf-color'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [{ name: 'icons' }, { name: 'cl-icon-buttons' }],
};
