const INPUTS_APPEARANCE_VALUES = ["bordered", "filled", "hidden"];

const sfInputsMeta = {
  tag: 'sf-inputs',
  source: 'src/smart/inputs/meta.mjs',
  attributes: {
    appearance: {
      kind: 'enum',
      values: INPUTS_APPEARANCE_VALUES,
      default: 'bordered',
      description: 'How the field looks: a bordered box, a filled one, or hidden.',
    },
    type: {
      kind: 'enum',
      values: INPUTS_APPEARANCE_VALUES,
      default: 'bordered',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {INPUTS_APPEARANCE_VALUES, sfInputsMeta};

export default sfInputsMeta;
