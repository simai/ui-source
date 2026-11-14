// One of two packages that define the same rule, as pro and a set it bundles
// do. Used by tests/browser/loader-package-order.browser.mjs.
SF.RuleLoader.registerPackage('order-bundle', {
  rules: {
    'cl-probe-shared': {tags: ['sf-probe-shared'], type: 'smart', mode: 'smart', js: true},
  },
});
