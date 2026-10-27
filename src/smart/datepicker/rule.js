SF.RuleLoader['cl-datepicker'] = {
  tags: ['sf-datepicker'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'datepicker' },
    // The registry id of sf-input stays smart.inputs until it is renamed with
    // the package contracts that name it (MIGRATION-DEBT); cl-inputs forwards
    // to cl-input until 2026-12-01.
    { name: 'cl-inputs' },
    { name: 'cl-buttons' },
    { name: 'cl-icon-buttons' },
    { name: 'cl-icons' },
  ],
};
