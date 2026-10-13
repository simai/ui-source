SF.RuleLoader['cl-gallery'] = {
  regex: /data-sf-gallery(?:\s|=|>|$)/,
  tags: ['sf-gallery'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-slider' },
    { name: 'cl-modal' },
  ],
};
