const ICON_BUTTONS_KIND_VALUES = ["icon", "close"];
const BOOLEAN_VALUES = ['true', 'false'];

const ICON_BUTTON_VARIANT_VALUES = ['icon', 'close'];
const ICON_BUTTON_SIZE_VALUES = ['1/3', '1/2', '1', '2', '3'];
const ICON_BUTTON_APPEARANCE_VALUES = ['default', 'tonal', 'outline', 'link', 'surface', 'ghost'];
const ICON_BUTTON_SCHEME_VALUES = ['primary', 'secondary', 'on-surface'];
const ICON_BUTTON_SEGMENT_VALUES = ['start', 'middle', 'end'];
const ICON_BUTTON_SPACING_VALUES = ['compact', 'normal', 'comfortable', 'spacious'];
const ICON_BUTTON_TIGHTNESS_VALUES = ['low', 'high', 'highest'];
const ICON_BUTTON_RADIUS_VALUES = ['default', 'square', 'rounded'];
const ICON_BUTTON_NATIVE_TYPE_VALUES = ['button', 'submit', 'reset'];

const sfIconButtonMeta = {
  tag: 'sf-icon-button',
  source: 'src/smart/icon-buttons/meta.mjs',
  attributes: {
    template: {
      kind: 'custom',
      valueType: 'string',
      default: 'default',
      description: 'Template variant name for SfBaseElement external templates.',
    },
    kind: {
      kind: 'enum',
      values: ICON_BUTTONS_KIND_VALUES,
      default: 'icon',
      description: 'What the icon button is: an ordinary icon action or a close control.',
    },
    variant: {
      kind: 'enum',
      values: ICON_BUTTONS_KIND_VALUES,
      default: 'icon',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
    size: {
      kind: 'enum',
      values: ICON_BUTTON_SIZE_VALUES,
      default: '1',
      description: 'Icon button size token.',
    },
    appearance: {
      kind: 'enum',
      values: ICON_BUTTON_APPEARANCE_VALUES,
      default: 'default',
      description: 'How the icon button looks. Surface and ghost read the neutral alpha ramp: surface keeps a faint fill and a border, ghost keeps nothing until it is hovered or focused.',
    },
    type: {
      kind: 'enum',
      values: ICON_BUTTON_APPEARANCE_VALUES,
      default: 'default',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
    scheme: {
      kind: 'enum',
      values: ICON_BUTTON_SCHEME_VALUES,
      default: 'primary',
      description: 'Which colour family the control takes. What the control is about is the status axis; a status set there wins over this.',
    },
    icon: {
      kind: 'custom',
      valueType: 'string',
      default: 'add',
      description: 'Material icon name.',
    },
    segment: {
      kind: 'enum',
      values: ICON_BUTTON_SEGMENT_VALUES,
      default: '',
      description: 'Joined-control position owned by Button Group composition.',
    },
    filled: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Use the filled glyph axis for the standard icon variant.',
    },
    spacing: {
      kind: 'enum',
      values: ICON_BUTTON_SPACING_VALUES,
      default: 'normal',
      description: 'Semantic internal spacing profile.',
    },
    tightness: {
      kind: 'enum',
      values: ICON_BUTTON_TIGHTNESS_VALUES,
      default: '',
      description: 'Compatibility alias for spacing.',
    },
    radius: {
      kind: 'enum',
      values: ICON_BUTTON_RADIUS_VALUES,
      default: '',
      description: 'Border radius modifier.',
    },
    'root-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Extra classes applied to the inner icon button element.',
    },
    loading: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: "Loading state: the spinner in place of the icon, at the icon's size, in the page's look (data-sf-spinner). Sets aria-busy and disables the native button.",
    },
    disabled: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Disabled state flag.',
    },
    'native-type': {
      kind: 'enum',
      values: ICON_BUTTON_NATIVE_TYPE_VALUES,
      default: 'button',
      description: 'Native button type attribute.',
    },
    'aria-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible label.',
    },
    'badge-count': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: "A count on the icon button (simai/ui-source#12): a whole number above 0 shows, 0 or empty hides the badge. Above badge-cap it reads «<cap>+»; the exact number joins the icon button's accessible name («Анна Белова, 3 непрочитанных») and the badge's tooltip. On an anchor of size 1/3 or 1/2 a count is drawn as a dot.",
    },
    'badge-dot': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: "A dot on the icon button, a count with no number: something new. Shown when badge-count is not set; with a count, the count is drawn as a dot. Its text equivalent («есть новое» / «new» by default, badge-label to change it) joins the accessible name.",
    },
    'badge-cap': {
      kind: 'custom',
      valueType: 'integer',
      default: 99,
      description: "The largest count drawn as a number; a larger one reads «<cap>+».",
    },
    'badge-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: "The words the badge adds to the accessible name and its tooltip, in place of the page language's default: for a dot the whole text equivalent; for a count the phrase in plural forms separated by «|» (one|few|many in Russian, one|other in English) with {count} where the number goes.",
    },
  },
};

export {
  BOOLEAN_VALUES,
  ICON_BUTTON_VARIANT_VALUES,
  ICON_BUTTON_SIZE_VALUES,
  ICON_BUTTON_APPEARANCE_VALUES,
  ICON_BUTTON_SCHEME_VALUES,
  ICON_BUTTON_SEGMENT_VALUES,
  ICON_BUTTON_SPACING_VALUES,
  ICON_BUTTON_TIGHTNESS_VALUES,
  ICON_BUTTON_RADIUS_VALUES,
  ICON_BUTTON_NATIVE_TYPE_VALUES,
  sfIconButtonMeta,
};

export default sfIconButtonMeta;
