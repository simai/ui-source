SF.RuleLoader.tree = {
  regex:
    /(?:<sf-tree(?=[\s>/])|class\s*=\s*["'](?:[^"']*\s)?sf-tree(?=\s|["']))/i,
  type: 'component',
  css: true,
  js: true,
  relation: [
    { name: 'tree-item' },
    { name: 'icon-buttons' },
    { name: 'icons' },
  ],
};
