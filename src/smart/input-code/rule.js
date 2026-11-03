// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
// sf-input-code loads on demand like any other Smart element. It draws the
// class verification's markup, so the class verification is what it draws
// with: its sheet (and its runtime, which leaves the element's field alone),
// and the sr-only utility for the line that says which cell the caret is in.
SF.RuleLoader['cl-input-code'] = {
  tags: ['sf-input-code', 'sf-code-input'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'verification' },
    { name: 'sr-only/default' },
  ],
};
