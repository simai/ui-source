const TOOLTIP_APPEARANCE_VALUES = ["light", "dark"];

const tooltipMeta = {
  tag: 'sf-tooltip',
  source: 'src/smart/tooltip/meta.mjs',
  attributes: {
    template: {
      kind: 'custom',
      valueType: 'string',
      default: 'default',
      description: 'Template name.',
    },
    appearance: {
      kind: 'enum',
      values: TOOLTIP_APPEARANCE_VALUES,
      default: 'light',
      description: 'How the tooltip looks: light on a dark surface or the reverse.',
    },
    type: {
      kind: 'enum',
      values: TOOLTIP_APPEARANCE_VALUES,
      default: 'light',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
    size: {
      kind: 'enum',
      values: ['1/3', '1/2', '1', '2', '3'],
      default: '1',
      description: 'Framework typography and spacing scale.',
    },
    arrow: {
      kind: 'enum',
      values: [
        'none',
        'top-center',
        'bottom-center',
        'inline-start',
        'inline-end',
        'bottom-inline-start',
        'bottom-inline-end',
      ],
      default: 'none',
      description: 'Logical tail placement.',
    },
    text: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Short primary description.',
    },
    'supporting-text': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Optional secondary description.',
    },
    'root-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Framework utility classes for the visible surface root.',
    },
  },
};

export { tooltipMeta };
export default tooltipMeta;
