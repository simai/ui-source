// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-bulk-actions'] = {
  tags: ['sf-bulk-actions'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-button-icon' },
    { name: 'cl-progress-bar' },
    { name: 'cl-icon' },
    // The question window before a dangerous action and the «Подробнее» list of failures (decision C39).
    { name: 'cl-modal', lazy: true },
    // The question inside that window, appearance window (decision C39).
    { name: 'cl-confirm', lazy: true },
    // The failed items and their reasons under «Подробнее» (decision C295 (6)).
    { name: 'cl-list-description', lazy: true },
    { name: 'sr-only/default' },
  ],
};
