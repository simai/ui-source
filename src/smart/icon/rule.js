SF.RuleLoader['cl-icon'] = {
    tags: ['sf-icon'],
    type: 'smart',
    mode: 'smart',
    js: true,
    // The badge sheet places a count or a dot on an icon (simai/ui-source#12).
    // Icons are everywhere and badges on them are few: it is fetched when the
    // page is idle, or at once by an icon that has a badge to show.
    relation: [{ name: 'icons' }, { name: 'badges', lazy: true }],
};

// The bundle's former name (the folder was `icons` until standard 1.3.8 §3,
// §21 gave it the tag's name): a rule that still names it loads sf-icon.
// Dated like the element's aliases: until 2026-12-01.
SF.RuleLoader['cl-icons'] = {
    tags: [],
    type: 'smart',
    mode: 'smart',
    js: false,
    css: false,
    relation: [{ name: 'cl-icon' }],
};
