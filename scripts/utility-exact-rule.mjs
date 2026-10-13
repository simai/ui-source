// Build-time only. Finite class names are supplied by the current CSS build,
// never by page content or a runtime safelist. Registration remains RegExp.
const escape = character => /[\\^$.*+?()[\]{}|/]/u.test(character) ? `\\${character}` : character;

export function exactClassPattern(classes) {
  if (!Array.isArray(classes) || !classes.length) throw new Error('Empty utility class contract');
  const root = {end:false, children:new Map()};
  for (const name of classes) {
    if (typeof name !== 'string' || !name || /\s/u.test(name)) throw new Error('Invalid utility class token');
    let node = root;
    for (const character of name) {
      if (!node.children.has(character)) node.children.set(character, {end:false, children:new Map()});
      node = node.children.get(character);
    }
    node.end = true;
  }
  function emit(node) {
    const choices = [...node.children.keys()].sort().map(character =>
      escape(character) + emit(node.children.get(character)));
    if (!choices.length) return '';
    const expression = choices.length === 1 ? choices[0] : `(?:${choices.join('|')})`;
    return node.end ? `(?:${expression})?` : expression;
  }
  // (?![\s\S]) is an absolute end anchor; unlike $, it rejects trailing LF.
  return `^(?:${emit(root)})(?![\\s\\S])`;
}
