// The theme palette is an API, not a look: SF.ThemePalette (a whole theme
// from one colour). It ships in core's theme-palette.js and came only with
// smart/theme-generator, so a page that wanted the calculation without the
// generator's panel loaded that script anyway (ui-effects site, 2026-10-28).
// A page asks for it with SF.Loader.ensurePlugin('theme-palette') or an
// element carrying data-sf-theme-palette; SF.Loader.ready('theme-palette', fn)
// or the window event theme-palette:ready says it is there.
SF.RuleLoader['theme-palette'] = {
  regex: /data-sf-theme-palette/,
  type: 'component',
  css: false,
  js: true,
};
