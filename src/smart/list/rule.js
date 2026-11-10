// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The list draws its rows as sf-list-item on the plain list surface (the dropdown
// sheet holds .sf-list), the «⋯» as an icon-button class unit with an sf-icon, «Show
// more» as an sf-button and the empty state as sf-empty-state; a row's avatar as
// sf-avatar (its sign in the avatar's class markup, whose sheet sf-avatar brings) and
// its count and badge as sf-badge; a tag it renders is a tag it fetches. The shared
// row menu is fetched after the page is ready. The loading status is visually hidden
// with sr-only, which a class scan can miss.
// A group's heading is block list's shared heading (group-heading) and the date beside
// today and yesterday an sf-time (1.4.0, C40).
SF.RuleLoader['cl-list'] = {
  tags: ['sf-list'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'group-heading' },
    { name: 'cl-time' },
    { name: 'dropdown' },
    { name: 'cl-list-item' },
    { name: 'icon-buttons' },
    { name: 'cl-icon' },
    { name: 'cl-avatar' },
    { name: 'cl-badge' },
    { name: 'cl-button' },
    { name: 'cl-empty-state' },
    { name: 'cl-menu-context', lazy: true },
    { name: 'sr-only/default' },
  ],
};
