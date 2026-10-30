// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-lookup'] = {
  tags: ['sf-lookup'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    // The chosen items are sf-tag chips on the field's text line, each with
    // a remove button named Remove <label>.
    { name: 'cl-tag' },
    // A row's picture is the class markup of an avatar (.sf-avatar): a
    // photo or initials, drawn by the avatars sheet without an element per row.
    { name: 'avatars' },
    { name: 'icons' },
    // The spinner beside Searching... while the provider is asked.
    { name: 'cl-spinner' },
    // Retry after an error and Show more when the answer has a next cursor.
    { name: 'cl-button' },
    // The clear button of a single field holding a value: the class markup
    // of an icon button, as sf-rich-text's toolbar draws it.
    { name: 'icon-buttons' },
  ],
};
