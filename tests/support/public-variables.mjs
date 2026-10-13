// Contracts written before the public variables read a component's internal
// declarations as they were: `--sf-badge--color: var(--sf-info);`. The public
// variable now wraps the value it falls back to -- `var(--sf-badge-color,
// var(--sf-info))` -- so those contracts read the source with the wrappers
// taken off, and keep holding the internal values they were written for.
// The names come from the contract that declares them.
import {readFileSync} from 'node:fs';

const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-variables.v1.json', import.meta.url), 'utf8'));
const NAMES = contract.components.flatMap((entry) => entry.variables.map((variable) => variable.name));

export function withoutPublicVariables(source) {
  let text = String(source);
  for (const name of NAMES) {
    const opening = `var(${name}, `;
    for (let at = text.indexOf(opening); at !== -1; at = text.indexOf(opening, at)) {
      // The wrapper's closing parenthesis: the one that balances its opening.
      let depth = 0;
      let end = at + opening.length;
      for (; end < text.length; end += 1) {
        if (text[end] === '(') depth += 1;
        else if (text[end] === ')') {
          if (depth === 0) break;
          depth -= 1;
        }
      }
      text = text.slice(0, at) + text.slice(at + opening.length, end) + text.slice(end + 1);
    }
  }
  return text;
}
