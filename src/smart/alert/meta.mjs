const ALERT_STATUS_VALUES = ['neutral', 'info', 'success', 'warning', 'error'];
const ALERT_APPEARANCE_VALUES = ['default', 'outlined', 'flat'];

const sfAlertMeta = {
  tag: 'sf-alert',
  source: 'src/smart/alert/meta.mjs',
  attributes: {
    status: {
      kind: 'enum',
      values: ALERT_STATUS_VALUES,
      default: 'neutral',
      description: 'What the alert reports, in the shared status vocabulary. The words this component used before — clear and danger — are still accepted and mean neutral and error.',
    },
    type: {
      kind: 'enum',
      values: ALERT_STATUS_VALUES,
      default: 'neutral',
      description: 'Legacy name for status, still honoured. See contracts/public-api-axes.json.',
    },
    appearance: {
      kind: 'enum',
      values: ALERT_APPEARANCE_VALUES,
      default: 'default',
      description: 'How the alert looks: a filled surface, an outline, or flat.',
    },
    variant: {
      kind: 'enum',
      values: ALERT_APPEARANCE_VALUES,
      default: 'default',
      description: 'Legacy name for appearance, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {ALERT_STATUS_VALUES, ALERT_APPEARANCE_VALUES, sfAlertMeta};

export default sfAlertMeta;
