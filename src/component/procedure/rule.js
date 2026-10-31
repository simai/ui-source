// The procedure is drawn by its sheet alone: the numbers are a CSS counter and
// the line a pseudo-element, so it needs no script.
SF.RuleLoader.procedure = {
  regex: /class\s*=\s*["'][^"']*\bsf-procedure\b/i,
  type: 'component',
  css: true,
  js: false,
};
