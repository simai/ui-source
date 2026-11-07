#!/usr/bin/env node
// The nesting rule for radii, checked on a drawn page (simai/ui-source#31
// item 1; owner decision 2026-10-23, asked by ui-chat).
//
// A container declares its radius and the inset to its content; a nested
// element may be at most max(--sf-radius--ui, container radius - inset)
// round. The lint looks at every element with a rounded corner that stands
// in a corner of a rounded ancestor (the nearer of its two insets is smaller
// than its own radius, so the two curves meet) and reports:
//
//   rounder      the inner radius is larger than the outer one while the inset
//                is smaller than the inner radius -- the defect ui-chat
//                measured (a 24 px field in a 16 px panel, 13 px apart);
//   not-parallel the inner radius is larger than the derived one,
//                max(ui, outer - inset), by more than a pixel -- a corner that
//                does not run parallel to the one around it.
//
// A round control (radius at least half its height) is allowed in a capsule
// (radius at least half the container's height) of the same height:
// control + 2 x inset, within a pixel.
//
// Usage in a probe: `await page.evaluate(lintNestedRadius, {root: '#stage'})`;
// the function holds no closure, so Playwright can send it to the page. From
// the command line it lints a local HTML file in Chromium:
//   node scripts/nested-radius-lint.mjs page.html [selector]

/** Runs in the page: the corners that break the nesting rule under root. */
export function lintNestedRadius({root = 'body', ui = null, tolerance = 1} = {}) {
  const scope = typeof root === 'string' ? document.querySelector(root) : root;
  if (!scope) return {checked: 0, findings: [], error: `no ${root}`};
  const px = (value) => Number.parseFloat(value) || 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;border-radius:var(--sf-radius--ui)';
  scope.append(probe);
  const uiRadius = ui ?? px(getComputedStyle(probe).borderTopLeftRadius);
  probe.remove();
  const corners = [
    ['top-left', 'borderTopLeftRadius', 'left', 'top'],
    ['top-right', 'borderTopRightRadius', 'right', 'top'],
    ['bottom-right', 'borderBottomRightRadius', 'right', 'bottom'],
    ['bottom-left', 'borderBottomLeftRadius', 'left', 'bottom'],
  ];
  const name = (node) => {
    const id = node.id ? `#${node.id}` : '';
    const classes = [...node.classList].slice(0, 2).map((one) => `.${one}`).join('');
    return `${node.localName}${id}${classes}`;
  };
  const findings = [];
  let checked = 0;
  for (const inner of scope.querySelectorAll('*')) {
    const own = getComputedStyle(inner);
    const box = inner.getBoundingClientRect();
    if (!box.width || !box.height || own.display === 'contents' || own.visibility === 'hidden') continue;
    let outer = inner.parentElement;
    let outerStyle = null;
    while (outer && outer !== document.documentElement) {
      outerStyle = getComputedStyle(outer);
      if (corners.some(([, property]) => px(outerStyle[property]) > 0) && outerStyle.display !== 'contents') break;
      outer = outer.parentElement;
    }
    if (!outer || outer === document.documentElement) continue;
    const frame = outer.getBoundingClientRect();
    const border = {
      left: px(outerStyle.borderLeftWidth), right: px(outerStyle.borderRightWidth),
      top: px(outerStyle.borderTopWidth), bottom: px(outerStyle.borderBottomWidth),
    };
    for (const [corner, property, side, edge] of corners) {
      const inside = Math.min(px(own[property]), Math.min(box.width, box.height) / 2);
      const around = Math.min(px(outerStyle[property]), Math.min(frame.width, frame.height) / 2);
      if (inside <= 0 || around <= 0) continue;
      const insetX = side === 'left' ? box.left - frame.left - border.left : frame.right - border.right - box.right;
      const insetY = edge === 'top' ? box.top - frame.top - border.top : frame.bottom - border.bottom - box.bottom;
      if (insetX < -0.5 || insetY < -0.5) continue;
      const inset = Math.min(insetX, insetY);
      // The curves meet only when the element stands in the corner.
      if (inset >= inside || Math.max(insetX, insetY) >= around) continue;
      checked += 1;
      const round = inside >= box.height / 2 - 0.5;
      const capsule = around >= frame.height / 2 - 0.5;
      const sameHeight = Math.abs(frame.height - border.top - border.bottom - (box.height + 2 * inset)) <= tolerance;
      if (round && capsule && sameHeight) continue;
      const derived = Math.max(uiRadius, around - inset);
      const at = {element: name(inner), container: name(outer), corner, inner: inside, outer: around, inset: Math.round(inset * 10) / 10, derived};
      if (inside > around + tolerance) findings.push({kind: 'rounder', ...at});
      else if (inside > derived + tolerance) findings.push({kind: 'not-parallel', ...at});
    }
  }
  return {checked, ui: uiRadius, findings};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, selector = 'body'] = process.argv.slice(2);
  if (!file) throw new Error('Usage: node scripts/nested-radius-lint.mjs page.html [selector]');
  const {chromium} = await import('playwright');
  const {resolve} = await import('node:path');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file://${resolve(file)}`);
    await page.waitForTimeout(500);
    const result = await page.evaluate(lintNestedRadius, {root: selector});
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.findings.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}
