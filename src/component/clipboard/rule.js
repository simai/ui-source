SF.RuleLoader.clipboard = {
  regex: /(?:sf-clipboard|btn-clipboard|data-copy|data-clipboard-target)/,
  type: 'component',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    { name: 'buttons' },
    { name: 'icons' },
  ],
};
