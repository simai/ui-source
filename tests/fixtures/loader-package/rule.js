// A component package's rule file, as the Loader fetches it from
// `<base>/rule.js` for a package the page declared. Used by
// tests/browser/loader-packages.browser.mjs; the contract is
// docs/developer/component-packages.md.
SF.RuleLoader.registerPackage('probe', {
  rules: {
    'cl-probe-badge': {
      tags: ['sf-probe-badge'],
      type: 'smart',
      mode: 'smart',
      js: true,
    },
    // An element with the package's own prefix: only a package rule may claim
    // a tag outside sf-.
    'cl-probe-own': {
      tags: ['pr-own'],
      type: 'smart',
      mode: 'smart',
      js: true,
    },
  },
});
