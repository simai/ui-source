const TOGGLE_KIND_VALUES = ["simple", "icon", "short"];

const sfToggleMeta = {
  tag: 'sf-toggle',
  source: 'src/smart/toggle/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: TOGGLE_KIND_VALUES,
      default: 'simple',
      description: 'What the toggle carries: nothing, an icon, or a short label.',
    },
    type: {
      kind: 'enum',
      values: TOGGLE_KIND_VALUES,
      default: 'simple',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {TOGGLE_KIND_VALUES, sfToggleMeta};

export default sfToggleMeta;
