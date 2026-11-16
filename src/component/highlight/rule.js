SF.RuleLoader.highlight = {
  // A class that is language-<name> itself (<code class="language-js">), not
  // one that holds it: sf-language draws .sf-language-parts, and the old
  // [^"']*language- loaded highlight, clipboard, scrollbar and the icon
  // buttons on every page with a language switcher (2026-11-07).
  // data-lang is the docs' minimal markup, <pre><code data-lang="js">: the
  // Loader reads attributes of elements inside code and pre, but its markup
  // scan skips both, so the <pre><code> branch alone never matched and a page
  // with only data-lang got no highlight (content study X1, 2026-11-16).
  regex: /(?:class\s*=\s*["'](?:[^"']*\s)?language-[^"']*["']|\bdata-lang\s*=|<pre\b[^>]*>\s*<code\b[^>]*>)/i,
  type: 'component',
  js: true,
  css: true,
  relation: [
    { name: 'clipboard' },
    { name: 'icon-buttons' },
    { name: 'icons' },
    { name: 'scrollbar' },
    // The head buttons' names (C48, C217).
    { name: 'tooltip' },
  ],
};
