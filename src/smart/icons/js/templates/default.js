import { html, nothing } from "lit";

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
