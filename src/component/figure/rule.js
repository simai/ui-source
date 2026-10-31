// The figure is drawn by its sheet alone: no script.
SF.RuleLoader.figure = {
  regex: /class\s*=\s*["'][^"']*\bsf-figure\b/i,
  type: 'component',
  css: true,
  js: false,
};
