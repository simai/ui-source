SF.RuleLoader.kbd = {
  regex: /(?:<kbd\b|\bsf-kbd\b)/i,
  type: 'component',
  css: true,
  // The script fills <kbd data-sf-shortcut> (owner decision C191, 2026-11-15).
  js: true,
};
