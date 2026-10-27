// Whether a masked string is complete (simai.property-view-port 1.16.0,
// field.mask). sf-input formats what a person types through the Framework's
// mask (core/js/mask.js) and reports the text as shown; what the set still has
// to know is whether that text fills every place of the pattern, because an
// incomplete value is not a value -- «+7 (912) 3» is neither a phone nor
// nothing -- and a panel must not send it.
//
// The grammar is core/js/mask.js's, read the same way: `0` a digit, `a` a
// letter, `*` any character, `\` escapes the next character, `{` `}` mark a
// fixed part that belongs to the value and `[` `]` an optional tail, both
// dropped from what is shown, and every other character is a fixed part shown
// in the field. The pattern is compiled into one expression over the shown
// text rather than re-running the formatter: the formatter's job is to make a
// valid prefix out of anything typed, which is exactly the question it cannot
// answer -- every prefix is valid while it is typed. A pattern's optional tail
// is not optional here: the contract names no optional places, and a tail
// that may be left empty would make «complete» mean two lengths.
//
// The text is compared as shown, fixed parts included, because that is the
// value the host receives. A text with the template's placeholders (a
// mask-lazy="false" field shows «+7 (___) ___-__-__») is incomplete, and a
// template with nothing typed into it is empty.
const SLOT = {0: '\\d', a: '\\p{L}', '*': '[\\s\\S]'};
const TEST = {0: (character) => /\d/u.test(character), a: (character) => /\p{L}/u.test(character), '*': () => true};
// Unicode mode refuses an escaped character that is not syntax, so only these.
const escape = (character) => character.replace(/[\\^$.*+?()[\]{}|/]/gu, '\\$&');

function compile(pattern) {
    let source = '';
    const tokens = [];
    for (let index = 0; index < pattern.length; index += 1) {
        const character = pattern[index];
        if (character === '\\') {
            index += 1;
            if (index < pattern.length) {
                source += escape(pattern[index]);
                tokens.push({fixed: pattern[index]});
            }
        } else if (character === '{' || character === '}' || character === '[' || character === ']') {
            // Markers of the grammar, never shown.
        } else if (SLOT[character]) {
            source += SLOT[character];
            tokens.push({test: TEST[character]});
        } else {
            source += escape(character);
            tokens.push({fixed: character});
        }
    }
    return {complete: new RegExp(`^${source}$`, 'u'), tokens};
}

// How many places the text fills, read as core/js/mask.js reads it: a
// character that is the fixed part expected there is that fixed part, a
// placeholder in a place is an empty place, anything else fills the next place
// that takes it. A «7» typed into «+7 (000)» is a digit, not the fixed 7.
function filled(value, tokens, placeholder) {
    let count = 0;
    let pointer = 0;
    for (const character of value) {
        while (pointer < tokens.length && tokens[pointer].fixed !== undefined && tokens[pointer].fixed !== character) pointer += 1;
        if (pointer >= tokens.length) break;
        const token = tokens[pointer];
        if (token.fixed !== undefined) pointer += 1;
        else if (character === placeholder) pointer += 1;
        else if (token.test(character)) {
            count += 1;
            pointer += 1;
        }
    }
    return count;
}

const COMPILED = new Map();

export function maskPattern(field) {
    const mask = field?.mask;
    return typeof mask === 'string' && mask !== '' ? mask : null;
}

// 'empty', 'complete' or 'incomplete'. Empty is a text with nothing typed into
// it: no text, or only the pattern's fixed parts and placeholders.
export function maskState(text, pattern, placeholder = '_') {
    const value = String(text ?? '');
    if (!COMPILED.has(pattern)) COMPILED.set(pattern, compile(pattern));
    const {complete, tokens} = COMPILED.get(pattern);
    if (complete.test(value)) return 'complete';
    return filled(value, tokens, placeholder) === 0 ? 'empty' : 'incomplete';
}
