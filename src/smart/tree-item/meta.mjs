const TREE_ITEM_KIND_VALUES = ["folder", "file"];

const sfTreeItemMeta = {
  tag: 'sf-tree-item',
  source: 'src/smart/tree-item/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: TREE_ITEM_KIND_VALUES,
      default: 'folder',
      description: 'What the tree item is: a folder or a file.',
    },
    type: {
      kind: 'enum',
      values: TREE_ITEM_KIND_VALUES,
      default: 'folder',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {TREE_ITEM_KIND_VALUES, sfTreeItemMeta};

export default sfTreeItemMeta;
