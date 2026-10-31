// The card is drawn by its sheet alone: no script.
SF.RuleLoader.card = {
  regex: /class\s*=\s*["'][^"']*\bsf-card\b/i,
  type: 'component',
  css: true,
  js: false,
};
