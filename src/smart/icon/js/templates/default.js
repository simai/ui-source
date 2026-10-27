import { html, nothing } from "lit";
import { iconBadgeStep } from "../../../../component/badges/js/_anchored-state";
import { hasBadge, nameWithBadge, renderAnchoredBadge, renderAnchoredBadgeText } from "../../../helpers/anchored-badge";

function getIconData(context) {
  const {
    icon,
    size,
    filled,
    rounded,
    sharp,
    weightClass,
    loaded,
    rootClass,
    rootStyle,
    grade,
    opticalSize,
    label,
  } = context;

  const className = [
    "sf-icon",
    size ? `sf-icon--size-${size}` : "",
    loaded ? "sf-icon-loaded" : "",
    weightClass ? `sf-icon--weight-${weightClass}` : "",
    rounded ? "sf-icon--rounded" : "",
    sharp ? "sf-icon--sharp" : "",
    filled ? "sf-icon--filled" : "",
    rootClass,
  ]
    .filter(Boolean)
    .join(" ");

  const style = [
    rootStyle,
    `--sf-icon--grade:${grade}`,
    `--sf-icon--optical-size:${opticalSize}`,
  ]
    .filter(Boolean)
    .join(";");

  return { icon, className, style, label };
}

export function renderIconTemplate(context) {
  const { icon, className, style, label } = getIconData(context);
  const badge = context.badge;

  // With a count or a dot the glyph stands in an anchor of its own box
  // (simai/ui-source#12): the glyph's text is its ligature, so the badge
  // cannot go inside it. A labelled icon is then named by the anchor, with the
  // count after the label; an unlabelled one says the count in hidden words.
  if (hasBadge(badge)) {
    return html`<span
      class="sf-badge-anchor sf-badge-anchor--size-${iconBadgeStep(context.size)} sf-badge-anchor--square"
      role=${label ? "img" : nothing}
      aria-label=${label ? nameWithBadge(label, badge.phrase) : nothing}
      ><i class="${className}" style=${style} aria-hidden="true">${icon}</i
      >${renderAnchoredBadge(badge)}${label ? nothing : renderAnchoredBadgeText(badge, false)}</span
    >`;
  }

  return html`<i
    class="${className}"
    style=${style}
    role=${label ? "img" : nothing}
    aria-label=${label || nothing}
    aria-hidden=${label ? nothing : "true"}
    >${icon}</i
  >`;
}

renderIconTemplate.getIconData = getIconData;
