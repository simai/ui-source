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
    // An icon tab of a strip of links is an <a> in the icon button's class form, its glyph an sf-icon (renderIconLink, T4).
    { name: 'cl-icon' },
    // «Ещё» and the settings open the standard menu; the settings reorder with
    // sf-sortable and show and hide with sf-checkbox (owner, 2026-10-14).
    { name: 'cl-menu-context', lazy: true },
    { name: 'cl-sortable', lazy: true },
    { name: 'cl-checkbox', lazy: true },
    // A tab's errors and the sum on «Ещё» are sf-badge line="text" in its class form (component.badges; C95 point 6, C96 item 6).
    { name: 'badges' },
    // A tab's hint is the Framework tooltip (component.tooltip), drawn only for an item with a hint.
    { name: 'tooltip', lazy: true },
  ],
};
