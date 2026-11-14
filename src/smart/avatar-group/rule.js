// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-avatar-group'] = {
  tags: ['sf-avatar-group', 'sf-avatars'],
  regex: /<sf-avatar-group\b/i,
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'avatars' },
    { name: 'icons' },
    // The placeholder's glyph is an sf-icon element (avatar study AV-8).
    { name: 'cl-icon' },
    // «+N» opens the list of everyone in an sf-popover (C152 (6)), fetched when a group has one.
    { name: 'cl-popover', lazy: true },
    // A member's name in a tooltip (C152 (7)), fetched when a group draws names.
    { name: 'tooltip', lazy: true },
  ],
};
