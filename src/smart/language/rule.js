// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-language'] = {
  tags: ['sf-language'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'cl-segmented' },
    { name: 'cl-button' },
    // trigger icon (C369): the glyph alone is sf-button-icon, which shows its own name tooltip (C160 (1)).
    { name: 'cl-button-icon' },
    // trigger link (C381): the trigger is a native button in the link role, drawn by the link sheet.
    { name: 'link' },
    { name: 'cl-icon' },
    { name: 'cl-menu-context', lazy: true },
    { name: 'cl-dropdown', lazy: true },
    // The trigger's name as the Framework's tooltip (C160 (1), TT-11): the controller and its sheet, fetched when a menu trigger draws.
    { name: 'tooltip', lazy: true },
  ],
};
