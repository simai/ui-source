// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-search'] = {
  tags: ['sf-search'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button-icon' },
    { name: 'icons' },
    { name: 'kbd' },
    // The window's glyphs (the head's search glyph, a row's glyph, a step's chevron):
    // an sf-icon name joins the icon request when the window draws.
    { name: 'cl-icon' },
    // The spinner of the «Поиск…» line while a search takes longer than 1 s
    // (owner decisions C139 (4), C130 (8)).
    { name: 'cl-spinner' },
    // Nothing found and a failure, inline (owner decision C120 (3), (5)):
    // search_off with the popular queries under it, the error glyph with «Повторить».
    { name: 'cl-empty-state' },
    // The filters (owner decision C175 (4)): one sf-tag-group of one choice, one Tab stop.
    { name: 'cl-tag-group' },
    // The filter tags, and the step's and operators' tags in the field (C175 (4), (7), (8)).
    { name: 'cl-tag' },
    // A person's or a chat's row (C175 (2), port 1.1 avatar).
    { name: 'cl-avatar' },
    // A result's type mark (C175 (2), port 1.1 badge).
    { name: 'cl-badge' },
    // A result's time at the row's end (C175 (2), port 1.1 time).
    { name: 'cl-time' },
  ],
};
