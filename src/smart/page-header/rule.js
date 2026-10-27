// The header draws a badge for its count and its install mark, and an icon
// button for its star; a tag it renders is a tag it fetches.
SF.RuleLoader['cl-page-header'] = {
  tags: ['sf-page-header'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    {name: 'cl-badge'},
    {name: 'cl-icon-button'},
    {name: 'cl-icon'},
  ],
};
