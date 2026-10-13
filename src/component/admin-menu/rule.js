// The styling of the admin menu. The sf-admin-menu element lives with Larena
// (package larena); it requires this free component (component.admin-menu),
// which also works on its own on markup with the class.
SF.RuleLoader["admin-menu"] = {
  regex: /class\s*=\s*["'][^"']*\bsf-admin-menu\b/i,
  type: "component",
  css: true,
  js: true,
};
