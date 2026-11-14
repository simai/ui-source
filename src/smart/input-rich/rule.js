// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-input-rich'] = {
  tags: ['sf-input-rich', 'sf-rich-text'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    // The toolbar is the class markup of icon buttons, so the field owns
    // their roving tabindex and pressed state.
    { name: 'icon-buttons' },
    { name: 'icons' },
    // The link editor: an sf-popover anchored to the link button, holding an
    // sf-input and two sf-button.
    { name: 'cl-popover' },
    { name: 'cl-input' },
    { name: 'cl-button' },
    // The levels menu and ⋯ «Ещё» open the standard menu (core/js/overflow-row.js, owner decision C155).
    { name: 'cl-menu-context', lazy: true },
    // The text levels are the class markup of a ghost button with its word and ▾ (C155 (5)).
    { name: 'buttons' },
  ],
};
