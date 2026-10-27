// The tree draws its entries as rows of class markup (simai/ui-source#43): the
// tree and tree-item sheets, the icon font's icons and the icon button's sheet
// for the chevron. sf-tree-item children are read as data, not drawn; the
// item's bundle still comes with the tree, so the markup's sf-tree-item is a
// defined element (a page may wait for it) before the tree reads it.
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
  ],
};
