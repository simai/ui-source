// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-file-upload'] = {
  tags: ['sf-file-upload'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'file-upload' },
    { name: 'featured-icon' },
    // Each file's row is sf-file-preview (owner decisions C81, C149): asked for when the first file is listed.
    { name: 'cl-file-preview', lazy: true },
    { name: 'icon-buttons' },
  ],
};
