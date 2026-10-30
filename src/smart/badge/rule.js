// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-badge'] = {
  tags: ['sf-badge'],
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [
    { name: 'badges' },
    // The badge names itself through a visually hidden label; the utility comes
    // with the component rather than from a scan, which a badge inside another
    // component's markup can miss -- and then the label reads beside the text
    // (Larena, «Элементы: 7 7», 2026-10-12).
    { name: 'sr-only/default' },
    // The spinner of activity running: its slot is drawn by the badge sheet, the
    // motion by the spinner's, fetched after the page is ready.
    { name: 'spinner', lazy: true },
  ],
};

// The bundle's former name cl-badges (the folder was `badges` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-badge from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
