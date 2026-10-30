// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-rich-text'] = {
  tags: ['sf-rich-text'],
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
  ],
};
