SF.RuleLoader['cl-badges'] = {
  tags: ['sf-badge'],
  type: 'smart',
  mode: 'smart',
  js: true,
  // The badge names itself through a visually hidden label; the utility comes
  // with the component rather than from a scan, which a badge inside another
  // component's markup can miss -- and then the label reads beside the text
  // (Larena, «Элементы: 7 7», 2026-10-12).
  relation: [{ name: 'badges' }, { name: 'sr-only/default' }],
};
