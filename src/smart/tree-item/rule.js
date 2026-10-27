// The row is class markup: the tree-item sheet, the icon font's icons and the
// icon button's sheet for the chevron (simai/ui-source#43: no sf-icon elements).
SF.RuleLoader['cl-tree-item'] = {
  tags: ['sf-tree-item'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'tree-item' },
    { name: 'icon-buttons' },
    { name: 'icons' },
  ],
};
