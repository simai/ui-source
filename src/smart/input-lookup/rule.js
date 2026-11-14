// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-input-lookup'] = {
  tags: ['sf-input-lookup', 'sf-lookup'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    // The chosen items are sf-tag chips, the field less --sf-space-1/4 above
    // and below (C58), each with a remove button named Remove <label>; with
    // chips="row" a «+N» sf-tag stands for the chips past the row.
    { name: 'cl-tag' },
    // A row's picture is the class markup of an avatar (.sf-avatar): a
    // photo or initials, drawn by the avatars sheet without an element per row.
    { name: 'avatars' },
    { name: 'icons' },
    // The spinner beside Searching... while the provider is asked.
    { name: 'cl-spinner' },
    // Retry after an error and Show more when the answer has a next cursor.
    { name: 'cl-button' },
    // The clear of a single field holding a value: the field layer's action
    // (owner decision C123), an sf-icon glyph without a plate.
    { name: 'cl-icon' },
    // The sheet under lg: its back arrow, named «Готово» (C139 (7)),
    // as sf-search's sheet on a phone.
    { name: 'cl-button-icon' },
  ],
};
