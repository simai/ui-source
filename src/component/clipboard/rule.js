SF.RuleLoader.clipboard = {
  regex: /(?:data-sf-copy|data-sf-copy-target|sf-clipboard|btn-clipboard|data-copy|data-clipboard-target)/,
  type: 'component',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    { name: 'buttons' },
    { name: 'icons' },
    { name: 'tooltip' },
  ],
};
