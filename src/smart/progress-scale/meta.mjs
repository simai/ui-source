const PROGRESS_STATUS_VALUES = ["neutral", "info", "success", "warning", "error"];

const sfProgressScaleMeta = {
  tag: 'sf-progress-scale',
  source: 'src/smart/progress-scale/meta.mjs',
  attributes: {
    status: {
      kind: 'enum',
      values: PROGRESS_STATUS_VALUES,
      default: 'neutral',
      description: 'What the progress reports, in the shared status vocabulary. The word this component used before, primary, is still accepted and means neutral.',
    },
    tone: {
      kind: 'enum',
      values: PROGRESS_STATUS_VALUES,
      default: 'neutral',
      description: 'Legacy name for status, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {PROGRESS_STATUS_VALUES, sfProgressScaleMeta};

export default sfProgressScaleMeta;
