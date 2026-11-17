// A telephone number, stored and shown (FL-1, FL-7 of the property page study,
// 2026-11-17). Larena keeps a phone in E.164 -- `+79161234567`, a plus and the
// digits, nothing else (Larena decision 2026-10-24) -- and so does every form
// that submits sf-input-country (standard simai.smart-component §17.1 item 2).
// The edit control used to write the text as the box showed it,
// `+7 916 123-45-67`, so opening a record and saving it changed the stored
// value. Edit writes E.164 now; view and cell lay the number out by its
// country, as the box does, and read the formatted strings stored before.

// The national part of each dial code's number, laid out as sf-input-country
// lays it out (its `formatByPattern`): `0` is a digit, anything else is
// written as it stands. Derived from src/component/country-code/data/countries.json
// -- each dial code's pattern without its own code; where countries share a
// code, the country the code means (+7 Russia, +1 the United States, +44
// Britain) -- and held equal to it by tests/phone-e164-fl.contract.test.mjs,
// so the set carries 2 KB instead of the 54 KB table.
const PATTERNS = [
    ['0 00 00 00', '46'],
    ['0 00 00 00 00', '33 212 237'],
    ['0 000 00 00', '386'],
    ['0 000 000', '95 248 265 291 359 961 967 975'],
    ['0 000 0000', '36 64 66 389 599 850 962 964 970 971'],
    ['0 0000 000', '385'],
    ['0 0000 0000', '61 63 886'],
    ['0 000000', '252'],
    ['0 0000000', '51 53 591'],
    ['0 00000000', '20'],
    ['0 000000000', '43'],
    ['0-000-0000', '82 593 972'],
    ['0-0000 0000', '60'],
    ['0-0000-0000', '81'],
    ['0-0000000', '880 977'],
    ['0/000 000 00', '421'],
    ['00 00 0 00000', '225'],
    ['00 00 00', '299 508 681'],
    ['00 00 00 00', '32 45 47 213 222 223 224 226 227 228 235 236 241 253 257 352 377 689'],
    ['00 00 00 00 00', '229'],
    ['00 00 000 00', '261'],
    ['00 00 0000', '509'],
    ['00 00-00-00', '993'],
    ['00 000', '682 688'],
    ['00 000 00 00', '41 48 221 994 995 998'],
    ['00 000 000', '216 231 258 264 355 371 373 382 383 855 856'],
    ['00 000 0000', '27 31 40 93 233 242 249 251 255 351 595 963 966'],
    ['00 000-000', '387'],
    ['00 0000', '672'],
    ['00 0000 0000', '30 39 86 98'],
    ['00 0000-0000', '54 55'],
    ['00 00000', '243 263 353'],
    ['00 000000', '49 232 357 374 381 968'],
    ['00 0000000', '62 254 256 358'],
    ['00 00000000', '92'],
    ['00-000', '676'],
    ['00-0000000', '218'],
    ['00.00.00', '687'],
    ['000 00 00', '238 269 423'],
    ['000 00 00 00', '34 262 590 594 596'],
    ['000 00 0000', '992'],
    ['000 00-00-00', '375'],
    ['000 000', '376'],
    ['000 000 00 00', '90'],
    ['000 000 000', '56 94 211 240 244 245 250 260 420 996'],
    ['000 000 0000', '44 52'],
    ['000 000-00-00', '7'],
    ['000 0000', '220 239 246 267 297 354 372 592 670 673 674 675 679 680 691'],
    ['000 0000 000', '84'],
    ['000 00000', '350 370'],
    ['000 0000000', '57'],
    ['000-000', '597'],
    ['000-000-0000', '1'],
    ['000-0000', '501 507 692 960'],
    ['000-0000000', '58'],
    ['0000', '683 690'],
    ['0000 00 0000', '234'],
    ['0000 0000', '65 230 266 268 356 502 503 505 506 598 852 853 965 973 974 976'],
    ['0000 00000', '380'],
    ['0000 000000', '378'],
    ['0000-0000', '504'],
    ['00000', '290 500 677 678 685 686'],
    ['00000 00000', '91'],
    ['000000', '298'],
];

const NATIONAL = new Map();
for (const [pattern, codes] of PATTERNS) for (const code of codes.split(' ')) NATIONAL.set(code, pattern);

const digitsOf = (text) => String(text ?? '').replace(/\D/gu, '');

/**
 * The number in E.164: `+` and the digits. A text that starts with `+` (or the
 * international `00`) is a full number, laid out however it was:
 * `+7 916 123-45-67`, `+7 (916) 123 45 67` and `+79161234567` are one number.
 * A text without a country code is returned as it came, trimmed: which country
 * it belongs to is not the renderer's to guess. Empty for no digits.
 */
export function phoneE164(value) {
    const text = String(value ?? '').trim();
    const digits = digitsOf(text);
    if (!digits) return '';
    if (text.startsWith('+')) return `+${digits}`;
    if (/^00[1-9]/u.test(text.replace(/[\s\-().]/gu, ''))) return `+${digits.slice(2)}`;
    return text;
}

/** The dial code (digits) an E.164 number starts with: the longest one known. */
export function phoneDialCode(e164) {
    const digits = digitsOf(e164);
    for (let length = Math.min(4, digits.length); length > 0; length -= 1) {
        if (NATIONAL.has(digits.slice(0, length))) return digits.slice(0, length);
    }
    return '';
}

/**
 * The number as a person reads it: `+79161234567` reads `+7 916 123-45-67`,
 * by the country its code names. Digits beyond the pattern stay at the end, a
 * number is never cut; an unknown code reads `+<digits>`; a number without a
 * country code is shown as it came.
 */
export function formatPhone(value) {
    const e164 = phoneE164(value);
    if (!e164.startsWith('+')) return e164;
    const digits = e164.slice(1);
    const code = phoneDialCode(e164);
    if (!code) return e164;
    const rest = digits.slice(code.length);
    if (!rest) return `+${code}`;
    let out = '', index = 0;
    for (const char of NATIONAL.get(code)) {
        if (index >= rest.length) break;
        out += char === '0' ? rest[index++] : char;
    }
    return `+${code} ${out}${rest.slice(index)}`.trimEnd();
}
