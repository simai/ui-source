const BOOLEAN_VALUES = ['true', 'false'];

const paginationMeta = {
  tag: 'sf-pagination',
  source: 'src/smart/pagination/meta.mjs',
  attributes: {
    template: {
      kind: 'custom',
      valueType: 'string',
      default: 'default',
      description: 'Template name.',
    },
    top: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'true',
      description: 'Show the compatible show-more section.',
    },
    middle: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'true',
      description: 'Show page navigation and collection summary.',
    },
    bottom: {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'true',
      description: 'Allow the compatible batch-action section.',
    },
    'top-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Framework utility classes for the show-more section.',
    },
    'main-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Framework utility classes for the navigation section.',
    },
    'bottom-class': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Framework utility classes for the batch-action section.',
    },
    'aria-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible name of the navigation landmark. Empty: the text of the page\'s language ("Result pages" in English).',
    },
    'pages-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible label before page controls. Empty: the text of the page\'s language ("Pages:" in English).',
    },
    'page-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible prefix for a numbered page action. Empty: the text of the page\'s language ("Page" in English).',
    },
    'previous-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible name of the previous-page action. Empty: the text of the page\'s language ("Previous page" in English).',
    },
    'next-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible name of the next-page action. Empty: the text of the page\'s language ("Next page" in English).',
    },
    'last-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible label of the compatible last-page action. Empty: the text of the page\'s language ("Last" in English).',
    },
    'total-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible label for the total item count. Empty: the text of the page\'s language ("Total:" in English).',
    },
    'selected-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible label for the selected item count. Empty: the text of the page\'s language ("Selected:" in English).',
    },
    'selected-count': {
      kind: 'custom',
      valueType: 'integer',
      default: 0,
      description: 'Selected item count, clamped between zero and total.',
    },
    'show-more-text': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Label of the compatible show-more action. Empty: the text of the page\'s language ("Show more" in English).',
    },
    current: {
      kind: 'custom',
      valueType: 'integer',
      default: 1,
      description: 'Current one-based page number.',
    },
    total: {
      kind: 'custom',
      valueType: 'integer',
      default: 10,
      description: 'Non-negative total item count.',
    },
    'page-size': {
      kind: 'custom',
      valueType: 'integer',
      default: 10,
      description: 'Positive number of items per page.',
    },
    'page-sizes': {
      kind: 'custom',
      valueType: 'string',
      default: '10,20,30,40',
      description: 'Comma-separated positive page-size choices.',
    },
    'show-page-size': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'true',
      description: 'Show the page-size selector for a non-empty collection.',
    },
    'page-size-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Visible and accessible label of the page-size selector. Empty: the text of the page\'s language ("Per page:" in English).',
    },
    'show-actions': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'true',
      description: 'Show batch actions when actions are supplied.',
    },
    actions: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Pipe-separated compatible batch-action definitions.',
    },
    action: {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Selected batch-action value.',
    },
    'action-apply-text': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Label of the batch-action apply button. Empty: the text of the page\'s language ("Apply" in English).',
    },
    'show-action-for-all': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Show the compatible all-items toggle.',
    },
    'action-for-all': {
      kind: 'boolean',
      values: BOOLEAN_VALUES,
      default: 'false',
      description: 'Current all-items toggle value.',
    },
    'action-for-all-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Label of the all-items toggle. Empty: the text of the page\'s language ("For all" in English).',
    },
    'actions-label': {
      kind: 'custom',
      valueType: 'string',
      default: '',
      description: 'Accessible name of the batch-action selector. Empty: the text of the page\'s language ("Action for the selected records" in English).',
    },
  },
};

export { BOOLEAN_VALUES, paginationMeta };
export default paginationMeta;
