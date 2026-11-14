// Generated from component.json by scripts/generate-component-files.mjs; do not edit.
SF.RuleLoader['cl-tag'] = {
  tags: ['sf-tag'],
  type: 'smart',
  mode: 'smart',
  js: true,
  css: true,
  relation: [
    { name: 'icon-buttons' },
    // A status tag that is neither interactive nor closable draws the tonal
    // badge of its status (owner decision C140 (6)): the badge's class sheet.
    { name: 'badges' },
    { name: 'tags' },
    { name: 'avatars' },
    { name: 'dot' },
    // The remove button: sf-button-close, plain (owner decision C14).
    { name: 'cl-button-close' },
    // The icon of an icon tag and an avatar's placeholder are sf-icon elements,
    // so their names reach the icon font request (buttons review 2026-11-09).
    { name: 'cl-icon' },
    // A name cut with an ellipsis has its whole text in the Framework's plain
    // tooltip (owner decision C58; tags study TG-1): the tooltip controller.
    { name: 'tooltip' },
  ],
};

// The bundle's former name cl-tags (the folder was `tags` until standard
// 1.3.8 §3, §21 gave it the tag's name) is not a rule here: a rule of type
// smart is a Smart component to the registry, and this one has no element. The
// Loader forwards it to cl-tag from src/core/contracts/
// smart-rule-forwards.v1.json until 2026-12-01.
