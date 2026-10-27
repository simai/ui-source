// The tree draws its entries as rows of class markup (simai/ui-source#43): the
// tree and tree-item sheets, the icon font's icons and the icon button's sheet
// for the chevron. sf-tree-item children are read as data, not drawn.
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
  ],
};
