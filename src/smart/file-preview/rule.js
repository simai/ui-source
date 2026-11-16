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
    // The page's full-screen viewer, SF.Gallery.view, asked for when a picture, a PDF or a video is opened (decision C149 (6)).
    { name: 'cl-gallery', lazy: true },
    // «Удалить «<имя>»?» before a stored file is erased (decision C149 (8)).
    { name: 'cl-confirm', lazy: true },
  ],
};
