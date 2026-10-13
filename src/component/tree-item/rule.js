SF.RuleLoader['tree-item'] = {
  regex:
    /(?:<sf-tree-item(?=[\s>/])|class\s*=\s*["'](?:[^"']*\s)?sf-tree-item(?=\s|["']))/i,
  type: 'component',
  css: true,
  js: true,
  relation: [{ name: 'icons' }],
};
