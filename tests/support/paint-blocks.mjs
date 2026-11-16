// C273 (owner 2026-11-17): a component's paint -- fill, edge colour, text
// colour, the place roles it declares -- stands in `@layer sf.paint { }`
// blocks, each after the `@layer sf.components { }` block whose parts it
// paints, with the same selectors. A test that reads a part's colour from the
// source reads it here; its shape stays in the component block.

// The text of every `@layer sf.paint { ... }` block of a stylesheet, joined.
export function paintBlocks(source) {
  const out = [];
  const head = /@layer sf\.paint\s*\{/gu;
  let match;
  while ((match = head.exec(source))) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < source.length && depth; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    out.push(source.slice(match.index + match[0].length, i - 1));
    head.lastIndex = i;
  }
  return out.join('\n');
}

// The source with the paint blocks taken out: the shape a component block
// writes, for a test that checks a rule holds no paint or reads its layout.
export function withoutPaintBlocks(source) {
  let text = source;
  for (let at = text.search(/@layer sf\.paint\s*\{/u); at >= 0; at = text.search(/@layer sf\.paint\s*\{/u)) {
    let depth = 0;
    let i = text.indexOf('{', at);
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && !--depth) break;
    }
    text = text.slice(0, at) + text.slice(i + 1);
  }
  return text;
}

// The source with the paint/shape mode blocks of the mixins unfolded:
// `@if paint.writes-paint() { ... }` and `@if paint.writes-shape() { ... }`
// give their declarations back to the rule around them, one indent less, and
// the `@include paint.part(...)` switches go. A mixin then reads as it did
// before C273 split it, for a test that checks what it writes.
export function unfoldModes(source) {
  let text = source.replace(/^[ \t]*@include paint\.part\([a-z]+\);[ \t]*\n/gmu, '');
  const head = /([ \t]*)@if paint\.writes-(?:paint|shape)\(\) \{[ \t]*\n/u;
  for (let m = text.match(head); m; m = text.match(head)) {
    const start = m.index;
    let depth = 1;
    let i = start + m[0].length;
    for (; i < text.length && depth; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
    }
    const inner = text.slice(start + m[0].length, i - 1).replace(/\n[ \t]*$/u, '');
    const body = inner.split('\n').map((line) => line.replace(/^ {2}/u, '')).join('\n');
    let end = i;
    if (text[end] === '\n') end++;
    text = text.slice(0, start) + body + '\n' + text.slice(end);
  }
  return text;
}
