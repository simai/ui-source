// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-file-preview'] = {
  tags: ['sf-file-preview'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'file-preview' },
    { name: 'icons' },
    { name: 'icon-buttons' },
    // The upload row's bar under the name while the file uploads (state uploading, decision C81).
    { name: 'cl-progress-bar', lazy: true },
    // «Повторить» in a row that did not upload (state error), the C88 retry button.
    { name: 'cl-button', lazy: true },
  ],
};
