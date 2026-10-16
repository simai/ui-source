const BOOLEAN_VALUES = ['true', 'false'];

const BUTTON_SIZE_VALUES = ['1/3', '1/2', '1', '2', '3'];
const BUTTON_APPEARANCE_VALUES = ['default', 'tonal', 'outline', 'link', 'surface', 'ghost'];
const BUTTON_SCHEME_VALUES = ['primary', 'secondary', 'on-surface'];
const BUTTON_ICON_POSITION_VALUES = ['start', 'end'];
const BUTTON_SPACING_VALUES = ['compact', 'normal', 'comfortable', 'spacious'];
const BUTTON_TIGHTNESS_VALUES = ['low', 'high', 'highest'];
const BUTTON_RADIUS_VALUES = ['default', 'square', 'rounded'];
const BUTTON_NATIVE_TYPE_VALUES = ['button', 'submit', 'reset'];
const BUTTON_ICON_EXAMPLES = ['home', 'settings', 'search', 'edit', 'check', 'close'];

const sfButtonMeta = {
  tag: 'sf-button',
  source: 'src/smart/buttons/meta.mjs',
  attributes: {
    template: {
      kind: 'custom',
      valueType: 'string',
      default: 'default',
      description: 'Template variant name for SfBaseElement external templates.',
    },
    size: {
      kind: 'enum',
      values: BUTTON_SIZE_VALUES,
      default: '1',
      description: 'Button size token.',
    },
    appearance: {
      kind: 'enum',
      values: BUTTON_APPEARANCE_VALUES,
      default: 'default',
      description: 'How the button looks. Surface reads the neutral alpha ramp: a faint fill and a border. ghost is the link appearance under its old name (compat until 2026-12-01).',
    },
    type: {
      kind: 'enum',
      values: BUTTON_APPEARANCE_VALUES,
      default: 'default',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
    scheme: {
      kind: 'enum',
      values: BUTTON_SCHEME_VALUES,
      default: 'primary',
      description: 'Which colour family the control takes. What the control is about is the status axis; a status set there wins over this.',
    },
    text: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible button text when no text slot is provided.',
    },
    icon: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Single icon name shortcut.',
      examples: BUTTON_ICON_EXAMPLES,
    },
    'icon-start': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Logical start icon name.',
      examples: BUTTON_ICON_EXAMPLES,
    },
    'icon-end': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Logical end icon name.',
      examples: BUTTON_ICON_EXAMPLES,
    },
    'icon-left': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Compatibility alias for icon-start.',
      examples: BUTTON_ICON_EXAMPLES,
    },
    'icon-right': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Compatibility alias for icon-end.',
      examples: BUTTON_ICON_EXAMPLES,
    },
    'icon-position': {
      kind: 'enum',
      values: BUTTON_ICON_POSITION_VALUES,
      default: 'start',
      description: 'Placement for the single icon shortcut.',
    },
    spacing: {
      kind: 'enum',
      values: BUTTON_SPACING_VALUES,
      default: 'normal',
      description: 'Semantic internal spacing profile.',
    },
    tightness: {
      kind: 'enum',
      values: BUTTON_TIGHTNESS_VALUES,
      default: '',
      description: 'Compatibility alias for spacing.',
    },
    radius: {
      kind: 'enum',
      values: BUTTON_RADIUS_VALUES,
      default: '',
      description: 'Border radius modifier.',
    },
    'root-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Extra classes applied to the inner button element.',
    },
    loading: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Loading state flag.',
    },
    disabled: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Disabled state flag.',
    },
    'native-type': {
      kind: 'enum',
      values: BUTTON_NATIVE_TYPE_VALUES,
      default: 'button',
      description: 'Native button type attribute.',
    },
    'aria-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible label for icon-only or custom buttons.',
    },
  },
};

export {
  BOOLEAN_VALUES,
  BUTTON_SIZE_VALUES,
  BUTTON_APPEARANCE_VALUES,
  BUTTON_SCHEME_VALUES,
  BUTTON_ICON_POSITION_VALUES,
  BUTTON_SPACING_VALUES,
  BUTTON_TIGHTNESS_VALUES,
  BUTTON_RADIUS_VALUES,
  BUTTON_NATIVE_TYPE_VALUES,
  BUTTON_ICON_EXAMPLES,
  sfButtonMeta,
};

export default sfButtonMeta;
