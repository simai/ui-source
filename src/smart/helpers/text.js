const INITIALS_SKIP_WORDS = new Set([
    "а",
    "без",
    "в",
    "во",
    "для",
    "до",
    "за",
    "из",
    "из-за",
    "из-под",
    "и",
    "к",
    "ко",
    "между",
    "на",
    "над",
    "о",
    "об",
    "от",
    "по",
    "под",
    "при",
    "про",
    "с",
    "со",
    "у",
    "через",
    "the",
    "a",
    "an",
    "and",
    "for",
    "from",
    "in",
    "of",
    "on",
    "to",
]);

export function normalizeInitialsWords(value = "") {
    return String(value || "")
        .trim()
        .split(/[\s/|]+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter(Boolean);
}

export function getInitials(value = "", options = {}) {
    const {
        maxLetters = 2,
        skipWords = INITIALS_SKIP_WORDS,
    } = options;
    const words = normalizeInitialsWords(value);
    const significantWords = words.filter(
        (word, index) =>
            index === 0 || !skipWords.has(String(word).toLowerCase()),
    );

    if (!significantWords.length) {
        return "";
    }

    if (significantWords.length > 1) {
        return significantWords
            .slice(0, maxLetters)
            .map((word) => Array.from(word)[0] || "")
            .join("")
            .toUpperCase();
    }

    return Array.from(significantWords[0]).slice(0, 1).join("").toUpperCase();
}
