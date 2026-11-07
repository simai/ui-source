SF.RuleLoader.highlight = {
  // A class that is language-<name> itself (<code class="language-js">), not
  // one that holds it: sf-language draws .sf-language-parts, and the old
  // [^"']*language- loaded highlight, clipboard, scrollbar and the icon
  // buttons on every page with a language switcher (2026-11-07).
  regex: /(?:class\s*=\s*["'](?:[^"']*\s)?language-[^"']*["']|<pre\b[^>]*>\s*<code\b[^>]*>)/i,
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
