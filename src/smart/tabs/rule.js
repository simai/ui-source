// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-tabs'] = {
  tags: ['sf-tabs'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'tabs' },
    { name: 'cl-button' },
    { name: 'cl-button-icon' },
    // «Ещё» and the settings open the standard menu; the settings reorder with
    // sf-sortable and show and hide with sf-checkbox (owner, 2026-10-14).
    { name: 'cl-menu-context', lazy: true },
    { name: 'cl-sortable', lazy: true },
    { name: 'cl-checkbox', lazy: true },
    // A tab's hint is the Framework tooltip (component.tooltip), drawn only for an item with a hint.
    { name: 'tooltip', lazy: true },
  ],
};
