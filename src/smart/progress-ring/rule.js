// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-progress-ring'] = {
  tags: ['sf-progress-ring'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'progress-ring' },
    // An avatar in the ring's content (slot="content", C152 (8)): the ring sheet sizes .sf-avatar from the avatar's own variables, and the element warns about an sf-avatar put in without the slot (C250: declared, fetched after the page is ready).
    { name: 'avatars', lazy: true },
    // The sf-avatar element the ring holds or warns about (C250).
    { name: 'cl-avatar', lazy: true },
  ],
};
