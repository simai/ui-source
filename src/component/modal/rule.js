SF.RuleLoader['modal'] = {
  regex: /(data-sf-modal-(open|close)|sf-modal)/,
  type: 'component',
  css: true,
  js: true,
  relation: [
    { name: 'backdrop-filter-blur/default' },
    { name: 'icon-buttons' },
    { name: 'close' },
    // The spinner a modal shows while its content loads, fetched after the
    // page is ready; the modal sheet draws its slot.
    { name: 'spinner', lazy: true },
  ],
};
