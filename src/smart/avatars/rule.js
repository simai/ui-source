SF.RuleLoader['cl-avatars'] = {
  tags: ['sf-avatars'],
  regex: /<sf-avatars\b/i,
  type: 'smart',
  mode: 'smart',
  js: true,
  relation: [{ name: 'avatars' }, { name: 'icons' }],
};
