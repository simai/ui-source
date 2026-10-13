SF.RuleLoader.highlight = {
  regex: /(?:class\s*=\s*["'][^"']*language-[^"']*["']|<pre\b[^>]*>\s*<code\b[^>]*>)/i,
  type: 'component',
  js: true,
  css: true,
  relation: [
    { name: 'clipboard' },
    { name: 'icon-buttons' },
    { name: 'icons' },
    { name: 'scrollbar' },
  ],
};
