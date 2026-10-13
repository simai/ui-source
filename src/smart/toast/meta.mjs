const TOAST_STATUS_VALUES = ['neutral', 'info', 'success', 'warning', 'error'];

const sfToastMeta = {
  tag: 'sf-toast',
  source: 'src/smart/toast/meta.mjs',
  attributes: {
    status: {
      kind: 'enum',
      values: TOAST_STATUS_VALUES,
      default: 'neutral',
      description: 'What the message reports, in the shared status vocabulary. The words this component used before — default and primary — are still accepted and mean neutral and info.',
    },
    type: {
      kind: 'enum',
      values: TOAST_STATUS_VALUES,
      default: 'neutral',
      description: 'Legacy name for status, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {TOAST_STATUS_VALUES, sfToastMeta};

export default sfToastMeta;
