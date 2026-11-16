SF.RuleLoader.kbd = {
  regex: /(?:<kbd\b|\bsf-kbd\b)/i,
  type: 'component',
  css: true,
  // The sheet draws every key; the script only fills <kbd data-sf-shortcut>
  // (owner decision C191, 2026-11-15), so it comes where one is on the page.
  js: false,
  jsWhen: 'kbd[data-sf-shortcut]',
};
