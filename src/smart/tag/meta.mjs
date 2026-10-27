const BOOLEAN_VALUES = ['true', 'false'];

const tagsMeta = {
  tag: 'sf-tag',
  source: 'src/smart/tag/meta.mjs',
  attributes: {
    template: {
      kind: 'custom',
      valueType: 'string',
      default: 'default',
      description: 'Template name.',
    },
    kind: {
      kind: 'enum',
      values: ['checkbox', 'icon', 'default', 'color', 'avatar'],
      default: 'checkbox',
      description: 'What the tag carries: a checkbox, an icon, a colour, an avatar, or nothing but its label. The compatibility input quantity is still accepted and means default.',
    },
    status: {
      kind: 'enum',
      values: ['', 'info', 'success', 'warning', 'error'],
      default: '',
      description: 'What the tag reports, in the shared status vocabulary. Leave it empty for a tag that reports nothing.',
    },
    type: {
      kind: 'enum',
      values: ['checkbox', 'icon', 'default', 'color', 'avatar', 'info', 'success', 'warning', 'error'],
      default: 'checkbox',
      description: 'Legacy name that answered both questions from one list: a content word reaches kind, a status word reaches status. See contracts/public-api-axes.json.',
    },
    appearance: {
      kind: 'enum',
      values: ['default', 'surface', 'ghost'],
      default: 'default',
      description: 'Visual appearance, read from the neutral alpha ramp and separate from type: surface keeps a faint fill and a boundary, ghost keeps nothing until it is hovered. Only the neutral types take it, because a status tag carries its meaning in its colour.',
    },
    size: {
      kind: 'enum',
      values: ['1/3', '1/2', '1', '2', '3'],
      default: '1/2',
      description: 'Framework size token: sets the label text and the default spacing.',
    },
    spacing: {
      kind: 'enum',
      values: ['compact', 'normal', 'comfortable', 'spacious'],
      default: 'normal',
      description: 'Block padding of a free-standing tag, with the names the buttons use.',
    },
    inline: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Sit on the text line of another control: no block padding, a flush label, and a remove button the height of the line. The host may publish --sf-tag--line.',
    },
    text: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible tag label.',
    },
    count: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Optional count shown with the default tag.',
    },
    icon: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Decorative Framework icon name.',
    },
    'color-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Framework semantic background utility for the color marker.',
    },
    'avatar-image-url': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Avatar image URL; the visible text remains the accessible label.',
    },
    'avatar-text': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Avatar initials fallback.',
    },
    'avatar-status': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Reserved avatar status value for compatible templates.',
    },
    'root-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Framework utility classes for the visible root.',
    },
    active: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Selected state of a checkbox tag.',
    },
    disabled: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Disable interactive toggle and close actions.',
    },
    closable: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Show a separate remove action; icon, color and avatar tags enable it by default, a checkbox tag only when it is set.',
    },
    'aria-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Optional accessible name override for a selectable tag.',
    },
    'close-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible name of the remove action. Defaults to Remove, or Удалить on a Russian page.',
    },
  },
};

export { BOOLEAN_VALUES, tagsMeta };
export default tagsMeta;
