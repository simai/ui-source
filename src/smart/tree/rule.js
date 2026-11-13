// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The tree draws its entries as rows of class markup (simai/ui-source#43): the
// tree and tree-item sheets, the icon font's icons and the icon button's sheet
// for the chevron. sf-tree-item children are read as data, not drawn; the
// item's bundle still comes with the tree, so the markup's sf-tree-item is a
// defined element (a page may wait for it) before the tree reads it.
// The tooltip component shows a cut name whole (TR-14).
// A check box (selection check) is the checkbox's class markup; a lazy branch's «Загрузка…» row draws the spinner, loaded when it is needed.
SF.RuleLoader['cl-tree'] = {
  tags: ['sf-tree'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'tree' },
    { name: 'tree-item' },
    { name: 'icon-buttons' },
    { name: 'icons' },
    { name: 'cl-tree-item' },
    { name: 'tooltip' },
    { name: 'checkbox' },
    { name: 'spinner', lazy: true },
  ],
};
