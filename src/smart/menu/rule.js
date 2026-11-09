// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// sf-menu loads on demand like any other Smart element. It draws the class
// menu's markup, so the class menu is what it draws with: its sheet (and its
// runtime, which leaves the element's markup alone), the icon font for the
// glyphs and the icon-button box of a branch, and the class counter, which
// the badges runtime caps and names.
SF.RuleLoader['cl-menu'] = {
  tags: ['sf-menu'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'menu' },
    { name: 'icons' },
    { name: 'icon-buttons' },
    { name: 'badges' },
    // An item's status is the class dot of its tone (.sf-dot), drawn by the dot
    // sheet without an element per row.
    { name: 'dot' },
    // The search field over a column (search, C30 amended R071 a) is sf-input; the page that loads the menu on demand fetches it.
    { name: 'cl-input' },
  ],
};
