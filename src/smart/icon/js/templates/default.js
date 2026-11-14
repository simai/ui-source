import { html, nothing } from "lit";
import { iconBadgeStep } from "../../../../component/badges/js/_anchored-state";
import { hasBadge, nameWithBadge, renderAnchoredBadge, renderAnchoredBadgeText } from "../../../helpers/anchored-badge";

function getIconData(context) {
  const {
    icon,
    size,
    filled,
    weightClass,
    loaded,
    rootClass,
    rootStyle,
    grade,
    opticalSize,
    label,
    foreignClass,
    custom,
    mirror,
  } = context;

  const ownClass = [
    "sf-icon",
    size ? `sf-icon--size-${size}` : "",
    loaded ? "sf-icon-loaded" : "",
    weightClass ? `sf-icon--weight-${weightClass}` : "",
    filled ? "sf-icon--filled" : "",
    rootClass,
  ]
    .filter(Boolean)
    .join(" ");
  // What the element did not write itself (sf-icon's foreignGlyphClasses).
  const className = [ownClass, foreignClass].filter(Boolean).join(" ");

  // Grade and optical size are written only when the author set them: unset,
  // the icons sheet gives them -- the optical size from the glyph's size, the
  // grade from the theme (owner decision C151 point 4).
  const style = [
    rootStyle,
    grade !== "" && grade != null ? `--sf-icon--grade:${grade}` : "",
    opticalSize !== "" && opticalSize != null ? `--sf-icon--optical-size:${opticalSize}` : "",
  ]
    .filter(Boolean)
    .join(";");

  return { icon, className, ownClass, style: style || nothing, label, custom: custom ? icon : nothing, mirror: mirror ? "" : nothing };
}

export function renderIconTemplate(context) {
  const { icon, className, ownClass, style, label, custom, mirror } = getIconData(context);
  const badge = context.badge;
  const mark = (result) => Object.assign(result, { __sfIconClass: ownClass });

  // With a count or a dot the glyph stands in an anchor of its own box
  // (simai/ui-source#12): the glyph's text is its ligature, so the badge
  // cannot go inside it. A labelled icon is then named by the anchor, with the
  // count after the label; an unlabelled one says the count in hidden words.
  if (hasBadge(badge)) {
    return mark(html`<span
      class="sf-badge-anchor sf-badge-anchor--size-${iconBadgeStep(context.size)} sf-badge-anchor--square"
      role=${label ? "img" : nothing}
      aria-label=${label ? nameWithBadge(label, badge.phrase) : nothing}
      ><i class="${className}" style=${style} data-sf-icon-custom=${custom} data-sf-icon-mirror=${mirror} aria-hidden="true">${icon}</i
      >${renderAnchoredBadge(badge)}${label ? nothing : renderAnchoredBadgeText(badge, false)}</span
    >`);
  }

  return mark(html`<i
    class="${className}"
    style=${style}
    data-sf-icon-custom=${custom}
    data-sf-icon-mirror=${mirror}
    role=${label ? "img" : nothing}
    aria-label=${label || nothing}
    aria-hidden=${label ? nothing : "true"}
    >${icon}</i
  >`);
}

renderIconTemplate.getIconData = getIconData;
