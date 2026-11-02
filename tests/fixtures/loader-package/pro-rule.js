// The rule file of a package built under its current name, pro. Used by
// tests/browser/loader-package-alias.browser.mjs.
SF.RuleLoader.registerPackage('pro', {
  rules: {
    'cl-probe-badge': {
      tags: ['sf-probe-badge'],
      type: 'smart',
      mode: 'smart',
      js: true,
    },
  },
});
