const BOOLEAN_VALUES = ['true', 'false'];
const BUTTON_GROUP_SIZE_VALUES = ['1/3', '1/2', '1', '2', '3'];
const BUTTON_GROUP_SPACING_VALUES = ['compact', 'normal', 'comfortable', 'spacious'];
const BUTTON_GROUP_TIGHTNESS_VALUES = ['', 'low', 'high', 'highest'];
const BUTTON_GROUP_SCHEME_VALUES = ['primary', 'secondary', 'on-surface'];
const BUTTON_GROUP_ORIENTATION_VALUES = ['horizontal', 'vertical'];
const BUTTON_GROUP_APPEARANCE_VALUES = ['default', 'segmented'];
const BUTTON_GROUP_PLATE_VALUES = ['scheme', 'raised'];
const BUTTON_GROUP_RADIUS_VALUES = ['', 'default', 'square', 'rounded'];

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
      description: 'Selectable items with stable value, label, icon, count, icon-only and disabled fields.',
    },
    value: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Currently selected item value.',
    },
    name: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Native form field name: the group submits its value with its form, a form reset restores the initial value, and a disabled group is left out.',
    },
    'theme-switch': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: "A ready theme switch: the group draws its own three icon-only items (system, light, dark) named in the page language, selects SF.Loader's theme preference and follows sf-theme-change, and a choice calls SF.Loader.setTheme. items is ignored.",
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
      description: 'Color scheme for the selected button, and for the selected plate in the segmented appearance.',
    },
    appearance: {
      kind: 'enum',
      values: BUTTON_GROUP_APPEARANCE_VALUES,
      default: 'default',
      description: 'How the group looks. default joins outlined buttons into one perimeter; segmented draws a sunken track with borderless segments and a plate under the selected one. The selection model, keyboard and events are the same.',
    },
    plate: {
      kind: 'enum',
      values: BUTTON_GROUP_PLATE_VALUES,
      default: 'scheme',
      description: "The selected segment's plate in the segmented appearance: the scheme's fill, or a raised neutral surface with its shadow.",
    },
    'full-width': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'In the segmented appearance, the track fills its container and the segments share the width equally.',
    },
    radius: {
      kind: 'enum',
      values: BUTTON_GROUP_RADIUS_VALUES,
      default: '',
      description: "Corner radius, as on sf-button: empty is the UI radius, default the surface radius. In the segmented appearance it is the track's, and the plate's is the track's minus the padding (rounded: both pills).",
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
  BUTTON_GROUP_APPEARANCE_VALUES,
  BUTTON_GROUP_PLATE_VALUES,
  BUTTON_GROUP_RADIUS_VALUES,
  sfButtonGroupMeta,
};

export default sfButtonGroupMeta;
