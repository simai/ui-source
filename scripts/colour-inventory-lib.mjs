import fs from 'node:fs';
import path from 'node:path';

// Lexical inventory of raw colour syntax (C18: every colour from the dynamic or
// static palette). A raw colour is a hex literal, a colour function with literal
// channels, or a CSS named colour. transparent, currentColor and the CSS-wide
// keywords are not colours of their own and are not counted. Strings and
// comments stay visible: templates and inline styles carry executable CSS.

// CSS Color 4 named colours, without transparent and currentcolor.
export const NAMED_COLOURS = Object.freeze(['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen']);

const HEX = '(?<![&\\w#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w-])';
// A colour function with literal channels, or with Sass channel expressions
// (a palette emitted from a Sass map is a raw colour all the same).
const FUNCTION = '\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(\\s*(?:[-+.\\d]|map-get\\(|map\\.get\\(|\\$)';
// A named colour counts only as a CSS value: after a property colon, inside a
// CSS value list or function, or as an SVG paint attribute. Words in prose,
// identifiers, class names and object keys stay out.
const NAMED = `(?<!\\|)(?:(?<=[:(,]\\s*)|(?<=\\s(?:solid|dashed|dotted|double|inset)\\s+)|(?<=\\b\\d+(?:px|rem|em|%)?\\s+)|(?<=(?:fill|stroke|color|stop-color|flood-color|lighting-color)=["']))(?:${NAMED_COLOURS.join('|')})(?![\\w|-])(?!\\s*[:(])`;
const PATTERN = new RegExp(`${HEX}|${FUNCTION}|${NAMED}`, 'giu');
// JSON and Smart meta modules hold prose (summaries, descriptions): only hex
// and colour functions count there.
const PATTERN_DATA = new RegExp(`${HEX}|${FUNCTION}`, 'giu');

function lexicalRanges(source) {
  const ranges = [], strings = [];
  let quote = null, quoteStart = 0;
  for (let index = 0; index < source.length; index++) {
    const character = source[index], next = source[index+1];
    if (quote) {
      if (character === '\\') { index++; continue; }
      if (character === quote) { quote = null; strings.push([quoteStart, index]); }
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; quoteStart = index; continue; }
    if (character === '/' && (next === '/' || next === '*')) {
      // `//` right after a colon is a URL scheme, not a comment.
      if (next === '/' && source[index-1] === ':') { index++; continue; }
      const block = next === '*';
      let end = block ? source.indexOf('*/', index+2) : source.indexOf('\n', index+2);
      end = end < 0 ? source.length : end + (block ? 2 : 0);
      ranges.push([index, end]);
      index = end-1;
    } else if (character === '<' && source.startsWith('<!--', index)) {
      let end = source.indexOf('-->', index+4);
      end = end < 0 ? source.length : end+3;
      ranges.push([index, end]);
      index = end-1;
    }
  }
  return {comments: ranges, strings};
}

export function categoryOf(file) {
  if (/^(?:plugin\/|component\/(?:fancybox|swiper|jquery)\/|core\/js\/vendor\/)/.test(file)) return 'vendor-review';
  if (/(?:^|\/)(?:examples|probe|studio\.fixture|studio\.scenario)\.json$|\/static\/.+\.html$/.test(file)) return 'fixture-review';
  if (/(?:\/scss\/_?sf_var__|^core\/(?:scss\/vars\/|figma_variables\/|contracts\/|scss\/_sf_(?:figma_colors_variables|static_palette)\.scss$))/.test(file)) return 'definition-review';
  if (/\.(?:js|mjs|cjs|json|html)$/.test(file)) return 'script-data-template-review';
  return 'style-review';
}

export function scanColours(source, file) {
  const {comments, strings} = lexicalRanges(source);
  const category = categoryOf(file);
  // In a script a named colour counts only inside a string: CSS reaches the
  // page from strings and templates, while bare words are identifiers.
  const script = /\.(?:js|mjs|cjs)$/.test(file);
  const inside = (ranges, index) => ranges.some(([begin, close]) => index >= begin && index < close);
  return [...source.matchAll(/(?:\.json|(?:^|\/)meta\.mjs)$/.test(file) ? PATTERN_DATA : PATTERN)]
    .filter(match => !script || /^[#]|\(/.test(match[0]) || inside(strings, match.index))
    .map(match => {
    const start = source.lastIndexOf('\n', match.index)+1;
    const end = source.indexOf('\n', match.index);
    const context = source.slice(start, end < 0 ? source.length : end).trim();
    const inComment = inside(comments, match.index);
    const text = match[0];
    const kind = text.startsWith('#') ? 'hex' : text.includes('(') ? 'function' : 'named';
    return {file, line: source.slice(0, match.index).split('\n').length, column: match.index-start+1,
      text, kind, category: inComment ? 'comment-review' : category, status: 'unreviewed', context};
  });
}

export function reviewColourFindings(findings, policy) {
  if (!policy?.rules?.length) return findings;
  const rules = policy.rules.map(rule => ({
    ...rule,
    fileRegex: new RegExp(rule.filePattern, 'u'),
    contextRegex: new RegExp(rule.contextPattern, 'u'),
  }));
  return findings.map(finding => {
    const matches = rules.filter(rule =>
      rule.category === finding.category
      && rule.fileRegex.test(finding.file)
      && rule.contextRegex.test(finding.context));
    if (matches.length !== 1) return {
      ...finding,
      status: matches.length ? 'policy-conflict' : 'unreviewed',
      policyMatches: matches.map(rule => rule.id),
    };
    const [rule] = matches;
    return {...finding, status: rule.status, policyRule: rule.id, reason: rule.reason};
  });
}

export function colourInventory(root, {policy = null} = {}) {
  const files = [], findings = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['node_modules', '.git'].includes(entry.name)) walk(full); }
      else if (/\.(?:scss|css|js|mjs|cjs|html|json)$/.test(entry.name)) {
        const file = path.relative(root, full).split(path.sep).join('/');
        files.push(file);
        findings.push(...scanColours(fs.readFileSync(full, 'utf8'), file));
      }
    }
  }
  walk(root);
  const reviewed = reviewColourFindings(findings, policy);
  const byCategory = {}, byStatus = {}, byRule = {}, byLayer = {};
  for (const finding of reviewed) {
    byCategory[finding.category] = (byCategory[finding.category] || 0)+1;
    byStatus[finding.status] = (byStatus[finding.status] || 0)+1;
    if (finding.policyRule) byRule[finding.policyRule] = (byRule[finding.policyRule] || 0)+1;
    const layer = finding.file.split('/')[0];
    byLayer[layer] = (byLayer[layer] || 0)+1;
  }
  const unused = (policy?.rules || []).map(rule => rule.id).filter(id => !byRule[id]);
  return {schemaVersion: 1, status: 'inventory', scannedFiles: files.length,
    limitations: ['Lexical candidates, not parsed CSS', 'Named colours count only in value positions (after a colon, inside a value list or function, after a border style or a length, or as an SVG paint attribute)', 'Colours built at runtime from numbers are not seen'],
    files, findingCount: reviewed.length, byCategory, byLayer, byStatus, byRule, unusedRules: unused,
    unresolvedCount: reviewed.filter(finding => ['unreviewed', 'policy-conflict'].includes(finding.status)).length,
    findings: reviewed};
}
