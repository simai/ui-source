const BOOLEAN_VALUES = ['true', 'false'];
const BUTTON_GROUP_SIZE_VALUES = ['1/3', '1/2', '1', '2', '3'];
const BUTTON_GROUP_SPACING_VALUES = ['compact', 'normal', 'comfortable', 'spacious'];
const BUTTON_GROUP_TIGHTNESS_VALUES = ['', 'low', 'high', 'highest'];
const BUTTON_GROUP_SCHEME_VALUES = ['primary', 'secondary', 'on-surface'];
const BUTTON_GROUP_ORIENTATION_VALUES = ['horizontal', 'vertical'];

const sfButtonGroupMeta = {
  tag: 'sf-button-group',
  source: 'src/smart/button-group/meta.mjs',
  attributes: {
    template: {
      kind: 'custom',
      valueType: 'string',
      default: 'default',
      description: 'Template variant name.',
    },
    items: {
      kind: 'json',
      valueType: 'array',
      default: '[]',
      description: 'Selectable items with stable value, label, icon and disabled fields.',
    },
    value: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Currently selected item value.',
    },
    size: {
      kind: 'enum',
      values: BUTTON_GROUP_SIZE_VALUES,
      default: '1',
      description: 'Shared button size token.',
    },
    spacing: {
      kind: 'enum',
      values: BUTTON_GROUP_SPACING_VALUES,
      default: 'normal',
      description: 'Shared semantic internal spacing profile.',
    },
    tightness: {
      kind: 'enum',
      values: BUTTON_GROUP_TIGHTNESS_VALUES,
      default: '',
      description: 'Compatibility alias for spacing.',
    },
    scheme: {
      kind: 'enum',
      values: BUTTON_GROUP_SCHEME_VALUES,
      default: 'primary',
      description: 'Color scheme for the selected button.',
    },
    orientation: {
      kind: 'enum',
      values: BUTTON_GROUP_ORIENTATION_VALUES,
      default: 'horizontal',
      description: 'Layout and keyboard navigation orientation.',
    },
    disabled: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Disables the whole group.',
    },
    'aria-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible name for the group.',
    },
    'root-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Extra classes applied to the group root.',
    },
  },
};

export {
  BOOLEAN_VALUES,
  BUTTON_GROUP_SIZE_VALUES,
  BUTTON_GROUP_SPACING_VALUES,
  BUTTON_GROUP_TIGHTNESS_VALUES,
  BUTTON_GROUP_SCHEME_VALUES,
  BUTTON_GROUP_ORIENTATION_VALUES,
  sfButtonGroupMeta,
};

export default sfButtonGroupMeta;
