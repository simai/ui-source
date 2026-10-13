const LIST_ITEM_KIND_VALUES = ["text", "icon", "checkbox", "avatar", "color"];

const sfListItemMeta = {
  tag: 'sf-list-item',
  source: 'src/smart/list-item/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: LIST_ITEM_KIND_VALUES,
      default: 'text',
      description: 'What the list item carries: plain text, an icon, a checkbox, an avatar or a colour.',
    },
    type: {
      kind: 'enum',
      values: LIST_ITEM_KIND_VALUES,
      default: 'text',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {LIST_ITEM_KIND_VALUES, sfListItemMeta};

export default sfListItemMeta;
