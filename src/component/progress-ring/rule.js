// The ring is drawn by its sheet alone: the value is a custom property on the
// root, so the class needs no script (sf-progress-ring writes it for a page).
SF.RuleLoader['progress-ring'] = {
  regex: /class\s*=\s*["'][^"']*\bsf-progress-ring\b/i,
  type: 'component',
  css: true,
  js: false,
};
