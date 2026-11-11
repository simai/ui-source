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
    // «Повторить» in a row that could not be made, «Отменить» beside one being made, «Скачать» beside one ready (decision C51).
    { name: 'cl-button' },
    // The spinner in the sign's place while the file is prepared: its box is the class sheet's, the motion the spinner sheet's.
    { name: 'spinner', lazy: true },
    // The progress ring in the sign's place while the file is prepared with value (decision C51): its box is the class sheet's, the ring the progress-ring sheet's.
    { name: 'progress-ring', lazy: true },
  ],
};
