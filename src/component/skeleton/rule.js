// The skeleton is what shows before any code, so its class needs none: a page
// with .sf-skeleton bars fetches the sheet alone. The script is the
// constructor behind the [!skeleton ...] shortcode and
// SF.Loader.ensurePlugin('skeleton'), fetched when one of them is called
// (simai/ui-source#47).
SF.RuleLoader['skeleton'] = {
    regex: /sf-skeleton/,
    type: 'component',
    css: true,
    js: false,
    jsOnCall: true,
};
