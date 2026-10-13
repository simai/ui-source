SF.RuleLoader['modal'] = {
  regex: /(data-sf-modal-(open|close)|sf-modal)/,
  type: 'component',
  css: true,
  js: true,
  relation: [
    { name: 'backdrop-filter-blur/default' },
    { name: 'icon-buttons' },
    { name: 'close' },
  ],
};
