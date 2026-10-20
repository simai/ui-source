SF.RuleLoader['cl-icons'] = {
    tags: ['sf-icon'],
    type: 'smart',
    mode: 'smart',
    js: true,
    // The badge sheet places a count or a dot on an icon (simai/ui-source#12).
    // Icons are everywhere and badges on them are few: it is fetched when the
    // page is idle, or at once by an icon that has a badge to show.
    relation: [{ name: 'icons' }, { name: 'badges', lazy: true }],
};
