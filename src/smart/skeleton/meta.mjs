const SKELETON_KIND_VALUES = ["text", "circle", "square", "rounded"];

const sfSkeletonMeta = {
  tag: 'sf-skeleton',
  source: 'src/smart/skeleton/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: SKELETON_KIND_VALUES,
      default: 'text',
      description: 'What shape the placeholder takes: a line of text, a circle, a square or a rounded block.',
    },
    variant: {
      kind: 'enum',
      values: SKELETON_KIND_VALUES,
      default: 'text',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {SKELETON_KIND_VALUES, sfSkeletonMeta};

export default sfSkeletonMeta;
