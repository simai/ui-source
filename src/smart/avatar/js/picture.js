import {html, nothing} from "lit";
import {keyed} from "lit/directives/keyed.js";
import {getInitials} from "../../helpers/text";
import {resolveAvatarHue} from "./tone.mjs";

// One avatar drawing (avatar study AV-8, 2026-11-14). sf-avatar and every
// component that shows a person beside its own content -- sf-avatar-group,
// sf-tag, sf-list-item, sf-dropdown, sf-input-lookup, sf-menu-context, the
// signs of sf-list -- draw the picture with these functions and the avatars
// sheet's classes: a photo is an <img> filling the circle, initials stand on
// the neutral plate (or the hue the host names, C17), and with neither the
// placeholder is a glyph on the neutral plate -- person by default, the
// host's icon for a bot, a system or a service. Before, five copies drew it
// five ways: the photo as a background image in the tag, the list row and the
// dropdown, an empty transparent circle in a row with no photo, and the
// context menu's own classes on the secondary container.

/** The sizes of the avatar ladder. */
export const AVATAR_SIZES = Object.freeze(["1/4", "1/3", "1/2", "1", "2", "3"]);

/** The glyph of a placeholder: a person, unless the host names another. */
export const AVATAR_PLACEHOLDER_ICON = "person";

// The letters a step holds (owner decision C152 (3), 2026-11-14): two from
// 1/3 up, one at 1/4 (16 px holds one letter of a readable size, two were
// 10 px each). Only letters are cut: «+5» or a number stays whole.
export function avatarStepText(text, size) {
    const value = String(text ?? "");
    if (String(size ?? "") !== "1/4") return value;
    const letters = value.match(/^(\p{L}\p{M}*)\p{L}/u);
    return letters ? letters[1] : value;
}

/**
 * The drawing context of one avatar picture, from what a host knows: the photo,
 * the initials or the name they are taken from, the hue, the placeholder's
 * glyph, the size (or the text line of a form size) and the shape.
 */
export function avatarPictureContext(options = {}) {
    const imageUrl = String(options.imageUrl ?? "").trim();
    const name = String(options.name ?? "").trim();
    const explicitText = String(options.text ?? "").trim();
    const namedIcon = String(options.icon ?? "").trim();
    const size = AVATAR_SIZES.includes(String(options.size ?? "")) ? String(options.size) : "";
    // The initials: the host's own, else those of the name -- unless the host
    // names a glyph (a bot, a system), which stands in for them. With a photo
    // they stand under it until it comes and when it fails (C152 (2)).
    const text = avatarStepText(namedIcon ? explicitText : explicitText || getInitials(name), size);
    const isImage = Boolean(imageUrl);
    // isText: the initials are drawn (alone, or under the photo).
    const isText = Boolean(text);
    const icon = namedIcon || AVATAR_PLACEHOLDER_ICON;
    return {
        size,
        line: String(options.line ?? ""),
        shape: options.shape === "square" ? "square" : "circle",
        imageUrl,
        isImage,
        isText,
        text,
        icon,
        status: options.status || "none",
        expressive: Boolean(options.expressive),
        resolvedHue: isText && options.hue ? resolveAvatarHue(options.hue, name || text, "") : "",
        rootClass: options.rootClass || "",
        rootStyle: options.rootStyle || "",
        disabled: Boolean(options.disabled),
        // A long list's rows load their photos as they scroll in.
        lazy: Boolean(options.lazy),
        component: options.component,
    };
}

/**
 * The classes of the avatar picture. The avatars sheet answers every class
 * this file writes. sf-avatar's own templates hand it their utility classes
 * for the box (options.layout, src/smart/avatar/js/templates/shared.js), as
 * they wrote them before; a host's picture writes none -- sf-avatar--picture
 * gives it the same box from the avatars sheet -- so a host asks the Loader
 * for no utility it did not ask for before (a menu, a tag, a list row).
 */
export function avatarClasses(context, options = {}) {
    const includeRootClass = options.includeRootClass !== false;
    const layout = options.layout ?? null;
    const classes = [
        "sf-avatar",
        layout ? layout.box : "sf-avatar--picture",
        context.size ? `sf-avatar--size-${context.size}` : "",
        context.line ? `sf-avatar--line-${context.line}` : "",
        layout ? layout.inline : "",
    ].filter(Boolean);

    if (context.isText) {
        classes.push("sf-avatar--text");
        if (layout) classes.push(layout.center);

        // The hue's role set (core .sf-hue-<name>, C17); the class sheet
        // draws the plate and the ink from it.
        if (context.resolvedHue) {
            classes.push(`sf-hue-${context.resolvedHue}`);
        }
    }

    if (!context.isText) {
        classes.push("sf-avatar--placeholder");
        if (layout) classes.push(layout.center);
    }

    // The decorative level (C91 level 2): the sheet turns the initials'
    // plate of the largest size into a cover of its hue.
    if (context.expressive) {
        classes.push("sf-avatar--expressive");
    }

    if (context.status && context.status !== "none" && layout) {
        classes.push(layout.anchor);
    }

    if (context.shape === "square") {
        classes.push("sf-avatar--square");
    }

    if (context.status === "online") {
        classes.push("sf-avatar--status-icon-online-indicator");
    }

    if (options.disabled) {
        classes.push("disabled");
    }

    if (includeRootClass && context.rootClass) {
        classes.push(context.rootClass);
    }

    if (options.extraClass) {
        classes.push(options.extraClass);
    }

    return classes.join(" ");
}

// The photo says when it has come or failed (C152 (2)): the sheet fades it
// in over the initials when loaded and drops it on an error, so the avatar is
// never an empty circle or the browser's broken-image glyph. The state is
// the runtime mark data-sf-loaded ("true" or "error"), which the template
// does not bind, so a redraw keeps it, and which a first-paint snapshot
// leaves out (it depends on the network); a new address is a new element
// (keyed), which starts transparent again.
function onImageLoad(event) {
    event.currentTarget.dataset.sfLoaded = "true";
}

function onImageError(event) {
    event.currentTarget.dataset.sfLoaded = "error";
}

/**
 * What the circle holds: the initials, or the placeholder glyph as an sf-icon
 * element, so its name reaches the icon font request (a bare <i class="sf-icon">
 * drawn after the page's scan stayed blank: buttons review 2026-11-09); with a
 * photo, the photo over them (owner decision C152 (2)).
 */
export function avatarContent(context) {
    const under = context.isText
        ? html`<span class="sf-avatar-text">${context.text}</span>`
        : html`<sf-icon icon=${context.icon || AVATAR_PLACEHOLDER_ICON} aria-hidden="true"></sf-icon>`;

    if (!context.isImage) return under;

    return html`${under}${keyed(context.imageUrl, html`<img class="sf-avatar-image" src=${context.imageUrl} alt="" loading=${context.lazy ? "lazy" : nothing} decoding=${context.lazy ? "async" : nothing} @load=${onImageLoad} @error=${onImageError} />`)}`;
}

/** The icon names a picture draws (for a host's icon preload). */
export function avatarPictureIcons(options = {}) {
    const context = avatarPictureContext(options);
    return context.isText ? [] : [context.icon];
}

/**
 * One avatar picture beside a host's own content: a span hidden from
 * assistive technology (the host's visible text names the person), drawn with
 * the avatars sheet. extraClass adds the host's own geometry class.
 */
export function avatarPicture(options = {}) {
    const context = avatarPictureContext(options);
    return html`<span
        class=${avatarClasses(context, {extraClass: options.extraClass, disabled: context.disabled})}
        style=${context.rootStyle || nothing}
        aria-hidden="true"
    >${avatarContent(context)}</span>`;
}
