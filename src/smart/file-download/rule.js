// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-file-download'] = {
  tags: ['sf-file-download', 'sf-download-file'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'download-file' },
    { name: 'icons' },
    { name: 'cl-icon' },
    // The notice under a file that could not be prepared (state error, decision C25).
    { name: 'cl-alert' },
    // The spinner in the sign's place while the file is prepared: its box is the class sheet's, the motion the spinner sheet's.
    { name: 'spinner', lazy: true },
  ],
};
