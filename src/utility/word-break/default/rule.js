// The text-* breaking family (C186 (8)): text-break, text-break-normal,
// text-hyphens, and the former text-break-word and text-break-all.
SF.RuleLoader['word-break/default'] = new RegExp("^(?:text-(?:break(?:-(?:all|normal|word))?|hyphens))(?![\\s\\S])");
