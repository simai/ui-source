// A whole class token h1..h6, nothing else. The rule was /(h1|h2|h3|h4|h5|h6)/,
// tested on every element's attribute string, so an id (sf-sortable-help-azkguh4a),
// a modifier (sf-workspace--split-h2) or SVG path data (h16) pulled this sheet
// in, and an <h2> without attributes never did. The sheet styles the h1..h6
// tags with the heading tokens core.css already gives them; no Framework sheet
// defines a heading class of its own beyond core's .sf-h-1..6.
SF.RuleLoader['headers/default'] = new RegExp("^(?:h[1-6])(?![\\s\\S])");
