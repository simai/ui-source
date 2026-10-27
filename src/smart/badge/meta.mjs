const BADGE_APPEARANCE_VALUES = ["main", "tonal", "outline"];
const BADGE_COLOUR_ROLE_VALUES = ["neutral", "primary", "secondary", "tertiary", "on-surface"];
const BADGE_STATUS_VALUES = ["", "info", "success", "warning", "error"];

const sfBadgesMeta = {
  tag: 'sf-badge',
  source: 'src/smart/badge/meta.mjs',
  attributes: {
    appearance: {
      kind: 'enum',
      values: BADGE_APPEARANCE_VALUES,
      default: 'main',
      description: 'How the badge looks: the most visible fill, a calmer tonal one, or an outline.',
    },
    type: {
      kind: 'enum',
      values: BADGE_APPEARANCE_VALUES,
      default: 'main',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
    scheme: {
      kind: 'enum',
      values: BADGE_COLOUR_ROLE_VALUES,
      default: 'neutral',
      description: 'Which semantic colour the badge takes. A status word given here still works and reaches the status axis.',
    },
    status: {
      kind: 'enum',
      values: BADGE_STATUS_VALUES,
      default: '',
      description: 'What the badge reports, in the shared status vocabulary. The word this component used before, danger, is still accepted and means error.',
    },
  },
};

export {BADGE_APPEARANCE_VALUES, BADGE_COLOUR_ROLE_VALUES, BADGE_STATUS_VALUES, sfBadgesMeta};

export default sfBadgesMeta;
