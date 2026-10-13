const DROPDOWN_APPEARANCE_VALUES = ["filled", "outlined"];

const sfDropdownMeta = {
  tag: 'sf-dropdown',
  source: 'src/smart/dropdown/meta.mjs',
  attributes: {
    appearance: {
      kind: 'enum',
      values: DROPDOWN_APPEARANCE_VALUES,
      default: 'outlined',
      description: 'How the dropdown looks: a filled field or an outlined one.',
    },
    type: {
      kind: 'enum',
      values: DROPDOWN_APPEARANCE_VALUES,
      default: 'outlined',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {DROPDOWN_APPEARANCE_VALUES, sfDropdownMeta};

export default sfDropdownMeta;
