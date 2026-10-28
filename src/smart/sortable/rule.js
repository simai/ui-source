// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The insertion point (inserter-items) is a native icon button of the
// Framework's own look with an icon glyph, and the inserter it opens is the
// standard menu: all three are
// fetched after the page is ready, and at once by a list that turns its inserter
// on, so a list without one costs nothing more than before.
SF.RuleLoader['cl-sortable'] = {
  tags: ['sf-sortable'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons', lazy: true },
    { name: 'icons', lazy: true },
    { name: 'cl-context-menu', lazy: true },
  ],
};
