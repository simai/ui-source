// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// The feed's frame draws two Smart controls -- «Show earlier» is an
// sf-button, «To the latest» an sf-button-icon -- and a tag the feed renders is a
// tag it fetches. The announcer is visually hidden with the Framework's sr-only
// utility, which a class scan can miss on a node that starts empty, so it comes
// with the component. What an entry looks like is the host's renderer; a host
// whose renderer draws other Smart elements fetches them itself.
SF.RuleLoader['cl-list-feed'] = {
  tags: ['sf-list-feed'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'cl-button' },
    { name: 'cl-button-icon' },
    { name: 'sr-only/default' },
  ],
};
