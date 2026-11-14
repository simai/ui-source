// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-avatar'] = {
  tags: ['sf-avatar'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'avatars' },
    { name: 'badges' },
    // The placeholder's glyph is an sf-icon element, so its name reaches the icon font request (avatar study AV-8).
    { name: 'cl-icon' },
  ],
};

// The badge sheet places a count or a dot on the avatar
// (simai/ui-source#12).
