// The script only notes the C188 aliases in SF.deprecations.
SF.RuleLoader['contentDivider'] = {
    regex: /(?:^|["'\s])sf-divider(?:[\s"']|--|-)/,
    type: 'component',
    css: true,
    js: true,
};
