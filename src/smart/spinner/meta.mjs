const SPINNER_KIND_VALUES = ["", "arc", "breathing", "comet", "dots"];

const sfSpinnerMeta = {
  tag: 'sf-spinner',
  source: 'src/smart/spinner/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: SPINNER_KIND_VALUES,
      default: '',
      description: "The spinner's look: arc, breathing (the arc grows and shrinks as it turns), comet (an arc with a fading tail) or dots. Empty: the page's look, data-sf-spinner on the nearest ancestor (html, body or a block), else arc.",
    },
    variant: {
      kind: 'enum',
      values: SPINNER_KIND_VALUES,
      default: '',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {SPINNER_KIND_VALUES, sfSpinnerMeta};

export default sfSpinnerMeta;
