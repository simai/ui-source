// The motion roles (C187 (6)): ease-enter, ease-exit, ease-move, ease-linear,
// and the former ease-in, ease-out, ease-in-out.
SF.RuleLoader['transition-timing-function/default'] = new RegExp("^(?:ease-(?:e(?:nter|xit)|in(?:-out)?|linear|move|out))(?![\\s\\S])");
