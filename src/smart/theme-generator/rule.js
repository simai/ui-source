// The generator draws a colour control, two number fields and a reset button;
// a tag it renders is a tag it fetches, with the icons they show.
SF.RuleLoader['cl-theme-generator'] = {
  tags: ['sf-theme-generator'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-color' },
    { name: 'cl-input' },
    { name: 'cl-button' },
    { name: 'cl-icon-button' },
    { name: 'cl-icon' },
  ],
};
