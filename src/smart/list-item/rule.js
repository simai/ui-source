// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-list-item'] = {
  tags: ['sf-list-item'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'dropdown' },
    { name: 'icons' },
    { name: 'checkbox' },
    { name: 'avatars' },
    { name: 'tags' },
    // An icon row's picture is an sf-icon element, so its name reaches the first icon font request (1.2.7, as sf-dropdown 1.8.0).
    { name: 'cl-icon' },
  ],
};
