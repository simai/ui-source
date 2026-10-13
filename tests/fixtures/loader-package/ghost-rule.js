// A package that claims a name Core also ships (`cl-spinner`) and is served
// from a base that holds nothing. Its 404 must be cached for this package
// only: the next page, without the package, still loads sf-spinner from the
// Smart base. Declared with `rule` pointing here, so the base stays empty.
SF.RuleLoader.registerPackage('ghost', {
  rules: {
    'cl-spinner': {
      tags: ['sf-spinner'],
      type: 'smart',
      mode: 'smart',
      js: true,
    },
  },
});
