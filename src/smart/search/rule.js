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
    // The check before the name of the scope in force (owner decision C145 (2)):
    // an sf-icon element, so its name joins the icon request when the window draws.
    { name: 'cl-icon' },
    // The spinner of the «Поиск…» line while a search takes longer than 1 s
    // (owner decisions C139 (4), C130 (8)).
    { name: 'cl-spinner' },
    // Nothing found and a failure, inline (owner decision C120 (3), (5)):
    // search_off with the popular queries under it, the error glyph with «Повторить».
    { name: 'cl-empty-state' },
  ],
};
