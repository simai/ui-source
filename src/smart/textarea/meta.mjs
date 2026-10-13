const TEXTAREA_APPEARANCE_VALUES = ["bordered", "filled"];

const sfTextareaMeta = {
  tag: 'sf-textarea',
  source: 'src/smart/textarea/meta.mjs',
  attributes: {
    appearance: {
      kind: 'enum',
      values: TEXTAREA_APPEARANCE_VALUES,
      default: 'bordered',
      description: 'How the field looks: a bordered box or a filled one.',
    },
    type: {
      kind: 'enum',
      values: TEXTAREA_APPEARANCE_VALUES,
      default: 'bordered',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {TEXTAREA_APPEARANCE_VALUES, sfTextareaMeta};

export default sfTextareaMeta;
