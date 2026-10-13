const SPINNER_KIND_VALUES = ["arc", "dots"];

const sfSpinnerMeta = {
  tag: 'sf-spinner',
  source: 'src/smart/spinner/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: SPINNER_KIND_VALUES,
      default: 'arc',
      description: 'What the spinner is: an arc or a row of dots.',
    },
    variant: {
      kind: 'enum',
      values: SPINNER_KIND_VALUES,
      default: 'arc',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {SPINNER_KIND_VALUES, sfSpinnerMeta};

export default sfSpinnerMeta;
