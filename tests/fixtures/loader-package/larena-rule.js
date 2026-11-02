// The rule file of the same package built under its former name, larena
// (2026-10-11 to 2026-11-02; a dated alias of pro until 2027-01-01). Used by
// tests/browser/loader-package-alias.browser.mjs.
SF.RuleLoader.registerPackage('larena', {
  rules: {
    'cl-probe-badge': {
      tags: ['sf-probe-badge'],
      type: 'smart',
      mode: 'smart',
      js: true,
    },
  },
});
