import {ComponentObserver} from "../../../core/js/ComponentObserver";
import registerComponent from "../../register-helper";

class Emoji extends ComponentObserver {
  static componentName = 'Emoji';
  html = null;

    constructor(props) {
        super(props);
        const {
            emoji = '🙂',
            name,
            label,
            title,
            size = '1',
            decorative = false,
            skin,
            fallback,
            utilities = {},
        } = this.params || {};

        const className = this.attrs.class || this.attrs.className;
        this.element = document.createElement('span');
        if (this.id) {
            this.element.id = this.id;
        }
        this.element.classList.add('sf-emoji', `sf-emoji--size-${size}`);
        if (skin) {
            this.element.classList.add(`sf-emoji--skin-${skin}`);
        }
        if (className) {
            this.element.classList.add(...`${className}`.split(' ').filter(Boolean));
        }
        Object.entries(this.attrs)
            .filter(([attr]) => !['class', 'className'].includes(attr))
            .forEach(([attr, value]) => {
                if (value === undefined || value === null) {
                    return;
                }
                this.element.setAttribute(attr, value);
            });

        const content = this.withSkin(this.resolveEmoji(name, emoji, fallback), skin);
        this.element.textContent = content;
        const hidden = decorative || this.element.getAttribute('aria-hidden') === 'true';
        const labelledBy = this.element.getAttribute('aria-labelledby');
        const accessibleLabel = this.element.getAttribute('aria-label') || label || title || content;

        if (hidden) {
            this.element.setAttribute('aria-hidden', 'true');
            this.element.removeAttribute('role');
            this.element.removeAttribute('aria-label');
            this.element.removeAttribute('aria-labelledby');
        } else {
            this.element.setAttribute('role', 'img');
            this.element.removeAttribute('aria-hidden');
            if (!labelledBy && accessibleLabel) {
                this.element.setAttribute('aria-label', `${accessibleLabel}`);
            }
        }
        if (title) {
            this.element.title = title;
        }

        this.applyUtilities(this.element, utilities.emoji ?? utilities);

        this.template = this.element;
    }

    applyUtilities(target, utilities) {
        if (!target || !utilities) {
            return;
        }
        const normalize = (value) => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') return value.split(' ');
            if (Array.isArray(value?.classes)) return value.classes;
            if (typeof value?.classes === 'string') return value.classes.split(' ');
            if (Array.isArray(value?.emoji)) return value.emoji;
            if (typeof value?.emoji === 'string') return value.emoji.split(' ');
            return [];
        };
        normalize(utilities).filter(Boolean).forEach(cls => target.classList.add(cls));
    }

    init() {
    }

    // A skin tone is a character, not a style: the Fitzpatrick modifier after an
    // emoji that takes one. The class sf-emoji--skin-* had no rule behind it, so
    // skin changed nothing. Written only after a base that takes a modifier --
    // after any other emoji the modifier shows as a separate colour swatch.
    withSkin(content, skin) {
        const modifier = SKIN_TONES[String(skin ?? '').toLowerCase()];
        if (!modifier || !content) return content;
        const [first, ...rest] = Array.from(content.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ''));
        if (!/\p{Emoji_Modifier_Base}/u.test(first)) return content;
        return [first, modifier, ...rest.filter((char) => char !== '\uFE0F')].join('');
    }

    normalizeShortcode(value) {
        if (!value) return '';
        return `${value}`.toLowerCase().replace(/:/g, '').trim();
    }

    resolveEmoji(name, emoji, fallback) {
        const normalized = this.normalizeShortcode(name);
        if (normalized && SHORTCODES[normalized]) {
            return SHORTCODES[normalized];
        }
        return emoji || fallback || '';
    }
}

const SKIN_TONES = {
    1: '\u{1F3FB}', light: '\u{1F3FB}',
    2: '\u{1F3FC}', 'medium-light': '\u{1F3FC}',
    3: '\u{1F3FD}', medium: '\u{1F3FD}',
    4: '\u{1F3FE}', 'medium-dark': '\u{1F3FE}',
    5: '\u{1F3FF}', dark: '\u{1F3FF}',
};

const SHORTCODES = {
    smile: '😊',
    grin: '😁',
    laugh: '😂',
    wink: '😉',
    blush: '☺️',
    heart: '❤️',
    heart_eyes: '😍',
    kiss: '😘',
    thumbs_up: '👍',
    thumbs_down: '👎',
    ok: '👌',
    clap: '👏',
    pray: '🙏',
    muscle: '💪',
    eyes: '👀',
    rocket: '🚀',
    fire: '🔥',
    star: '⭐',
    sparkles: '✨',
    party: '🎉',
    tada: '🎉',
    check: '✅',
    cross: '❌',
    info: 'ℹ️',
    warning: '⚠️',
    question: '❓',
    lightbulb: '💡',
    sun: '☀️',
    moon: '🌙',
    cloud: '☁️',
    rain: '🌧️',
    snow: '❄️',
    lightning: '⚡',
    coffee: '☕',
    beer: '🍺',
    wine: '🍷',
    pizza: '🍕',
    burger: '🍔',
    cake: '🍰',
    gift: '🎁',
    phone: '📱',
    laptop: '💻',
    camera: '📷',
    music: '🎵',
    play: '▶️',
    pause: '⏸️',
    stop: '⏹️',
    record: '⏺️',
    forward: '⏭️',
    back: '⏮️',
    up: '⬆️',
    down: '⬇️',
    left: '⬅️',
    right: '➡️',
    plus: '➕',
    minus: '➖',
};

registerComponent('Emoji', Emoji);
