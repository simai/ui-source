export function mapTailwindBaseClass(className) {
  if (!className) return null;
  const TAILWIND_COLOR_MAP = {
    gray: {
      50: '0',
      100: '1',
      200: '2',
      300: '3',
      400: '4',
      500: '5',
      600: '7',
      700: '7',
      800: '9',
      900: '9',
      950: '9',
    },
    red: {
      50: '0',
      100: '1',
      200: '1',
      300: '2',
      400: '3',
      500: '4',
      600: '6',
      700: '7',
      800: '8',
      900: '9',
      950: '9',
    },
    blue: {
      50: '0',
      100: '1',
      200: '2',
      300: '3',
      400: '3',
      500: '4',
      600: '5',
      700: '5',
      800: '7',
      900: '7',
      950: '9',
    },
    green: {
      50: '0',
      100: '1',
      200: '2',
      300: '3',
      400: '4',
      500: '4',
      600: '5',
      700: '6',
      800: '7',
      900: '8',
      950: '9',
    },
    yellow: {
      50: '0',
      100: '2',
      200: '3',
      300: '5',
      400: '6',
      500: '7',
      600: '8',
      700: '8',
      800: '9',
      900: '9',
      950: '9',
    },
    orange: {
      50: '0',
      100: '1',
      200: '2',
      300: '3',
      400: '4',
      500: '5',
      600: '6',
      700: '8',
      800: '9',
      900: '9',
      950: '9',
    },
    purple: {
      50: '0',
      100: '0',
      200: '1',
      300: '2',
      400: '3',
      500: '4',
      600: '4',
      700: '5',
      800: '6',
      900: '7',
      950: '8',
    },
    pink: {
      50: '0',
      100: '0',
      200: '1',
      300: '2',
      400: '4',
      500: '5',
      600: '6',
      700: '8',
      800: '8',
      900: '9',
      950: '9',
    },
  };
  const directMap = {
    'text-left': 'text-start',
    'text-right': 'text-end',
    'float-left': 'float-inline-start',
    'float-right': 'float-inline-end',
    'clear-left': 'clear-inline-start',
    'clear-right': 'clear-inline-end',
    'font-thin': 'weight-1',
    'font-extralight': 'weight-2',
    'font-light': 'weight-3',
    'font-normal': 'regular',
    'font-medium': 'weight-5',
    'font-semibold': 'weight-6',
    'font-bold': 'bold',
    'font-extrabold': 'weight-8',
    'font-black': 'weight-9',
    'font-sans': 'sans',
    'font-serif': 'serif',
    'font-mono': 'mono',
    'flex-column': 'flex-col',
    'flex-center': 'center-center',
    't-left': 'text-start',
    't-right': 'text-end',
    'pointer-events-none': 'pointer-event-none',
    'pointer-events-auto': 'pointer-event-auto',
    'not-italic': 'italic-none',
    'normal-case': 'normalcase',
    'no-underline': 'decoration-none',
    'text-ellipsis': 't-ellipsis',
    'text-clip': 't-clip',
    'bg-no-repeat': 'bg-repeat-none',
    'whitespace-nowrap': 'wrap-none',
    'whitespace-pre': 'pre',
    'whitespace-pre-line': 'pre-line',
    'whitespace-pre-wrap': 'pre-wrap',
    contents: 'content',
  };
  if (directMap[className]) return directMap[className];

  const negative = className.startsWith('-') ? '-' : '';
  const base = negative ? className.slice(1) : className;

  const tailwindColorMatch = base.match(
    /^(bg|text|border)-(gray|red|blue|green|yellow|orange|purple|pink)-(50|100|200|300|400|500|600|700|800|900|950)$/,
  );
  if (tailwindColorMatch) {
    const [, prefix, color, shade] = tailwindColorMatch;
    const mappedShade = TAILWIND_COLOR_MAP[color]?.[shade];
    if (!mappedShade) return null;
    const mappedPrefix = prefix === 'text' ? 'color' : prefix;
    return `${mappedPrefix}-${color}-${mappedShade}`;
  }

  const tailwindMonoMatch = base.match(/^(bg|text|border)-(white|black)$/);
  if (tailwindMonoMatch) {
    const [, prefix, color] = tailwindMonoMatch;
    const mappedPrefix = prefix === 'text' ? 'color' : prefix;
    return `${mappedPrefix}-${color}`;
  }

  const sideMap = {
    mt: 'm-top',
    mr: 'm-inline-end',
    mb: 'm-bottom',
    ml: 'm-inline-start',
    pt: 'p-top',
    pr: 'p-inline-end',
    pb: 'p-bottom',
    pl: 'p-inline-start',
  };
  const sideMatch = base.match(/^(m[trbl]|p[trbl])-(.+)$/);
  if (sideMatch) {
    const [, sideKey, value] = sideMatch;
    if (negative && sideKey[0] === 'p') return null;
    return `${negative}${sideMap[sideKey]}-${value}`;
  }

  const legacySideMatch = base.match(/^(m|p)-(left|right)-(.+)$/);
  if (legacySideMatch) {
    const [, mp, side, value] = legacySideMatch;
    if (negative && mp === 'p') return null;
    const mappedSide = side === 'left' ? 'inline-start' : 'inline-end';
    return `${negative}${mp}-${mappedSide}-${value}`;
  }

  const borderSideMatch = base.match(/^border-(l|r)-(.+)$/);
  if (borderSideMatch) {
    const side = borderSideMatch[1] === 'l' ? 'inline-start' : 'inline-end';
    return `border-${side}-${borderSideMatch[2]}`;
  }

  const borderSideLegacyMatch = base.match(/^border-(left|right)-(.+)$/);
  if (borderSideLegacyMatch) {
    const side =
      borderSideLegacyMatch[1] === 'left' ? 'inline-start' : 'inline-end';
    return `border-${side}-${borderSideLegacyMatch[2]}`;
  }

  const gridColsMatch = base.match(/^grid-cols-(.+)$/);
  if (gridColsMatch) {
    return `grid-col-${gridColsMatch[1]}`;
  }

  if (base === 'w-100') return 'w-full';
  if (base === 'h-100') return 'h-full';

  const opacityMatch = base.match(/^opacity-(\d{2,3})$/);
  if (opacityMatch) {
    const value = parseInt(opacityMatch[1], 10);
    if (value === 100) return 'opacity-full';
    if (value === 0) return 'opacity-0';
    if (value % 10 === 0 && value >= 10 && value <= 90) {
      return `opacity-${Math.round(value / 10)}`;
    }
  }

  const zMatch = base.match(/^z-(\d{2,3})$/);
  if (zMatch) {
    const value = parseInt(zMatch[1], 10);
    if (value === 0) return `${negative}z-0`;
    if (value % 10 === 0 && value >= 10 && value <= 90) {
      return `${negative}z-${Math.round(value / 10)}`;
    }
  }

  const bgOriginMatch = base.match(/^bg-origin-(border|padding|content)$/);
  if (bgOriginMatch) {
    return `bg-origin-${bgOriginMatch[1]}`;
  }

  const bgClipMatch = base.match(/^bg-clip-(border|padding|content|text)$/);
  if (bgClipMatch) {
    return `bg-clip-${bgClipMatch[1]}`;
  }

  const leadingMatch = base.match(
    /^leading-(tight|snug|relaxed|loose|none|normal)$/,
  );
  if (leadingMatch) {
    return `line-${leadingMatch[1]}`;
  }

  // items-start|end|center|stretch are the Framework's own place-items classes
  // (utility/place-items), not Tailwind's align-items: rewriting them to
  // items-cross-* dropped justify-items in a grid (docs trial 5). Only
  // items-baseline, which the Framework does not name, is Tailwind's.
  if (base === 'items-baseline') {
    return 'items-cross-baseline';
  }

  const verticalAlignMatch = base.match(
    /^align-(baseline|top|middle|bottom|sub|super|text-top|text-bottom)$/,
  );
  if (verticalAlignMatch) {
    const align = verticalAlignMatch[1];
    if (align === 'super') return 'text-sup';
    if (align === 'text-top') return 'text-top';
    if (align === 'text-bottom') return 'text-bottom';
    return `text-${align}`;
  }

  const justifyContentMatch = base.match(
    /^justify-(start|end|center|between|around|evenly)$/,
  );
  if (justifyContentMatch) {
    return `content-main-${justifyContentMatch[1]}`;
  }

  const justifyItemsMatch = base.match(
    /^justify-items-(start|end|center|stretch)$/,
  );
  if (justifyItemsMatch) {
    return `items-main-${justifyItemsMatch[1]}`;
  }

  const justifySelfMatch = base.match(
    /^justify-self-(auto|start|end|center|stretch)$/,
  );
  if (justifySelfMatch) {
    return `self-main-${justifySelfMatch[1]}`;
  }

  const alignSelfMatch = base.match(
    /^self-(auto|start|end|center|stretch|baseline)$/,
  );
  if (alignSelfMatch) {
    return `self-cross-${alignSelfMatch[1]}`;
  }

  const placeItemsMatch = base.match(
    /^place-items-(start|end|center|stretch)$/,
  );
  if (placeItemsMatch) {
    return `items-${placeItemsMatch[1]}`;
  }

  const placeSelfMatch = base.match(
    /^place-self-(auto|start|end|center|stretch)$/,
  );
  if (placeSelfMatch) {
    return `self-${placeSelfMatch[1]}`;
  }

  const placeContentMatch = base.match(
    /^place-content-(start|end|center|between|around|evenly|stretch)$/,
  );
  if (placeContentMatch) {
    return `content-${placeContentMatch[1]}`;
  }

  if (base.startsWith('content-') && !base.includes('[')) {
    const contentMatch = base.match(
      /^content-(start|end|center|between|around|evenly|stretch)$/,
    );
    if (contentMatch) {
      return `content-cross-${contentMatch[1]}`;
    }
  }

  const bgPositionMatch = base.match(
    /^bg-(left|right)(?:-(top|bottom|center))?$/,
  );
  if (bgPositionMatch) {
    const side = bgPositionMatch[1] === 'left' ? 'inline-start' : 'inline-end';
    const pos = bgPositionMatch[2] ? `-${bgPositionMatch[2]}` : '';
    return `bg-${side}${pos}`;
  }

  const objectPositionMatch = base.match(
    /^object-(left|right)(?:-(top|bottom|center))?$/,
  );
  if (objectPositionMatch) {
    const side =
      objectPositionMatch[1] === 'left' ? 'inline-start' : 'inline-end';
    const pos = objectPositionMatch[2] ? `-${objectPositionMatch[2]}` : '';
    return `object-${side}${pos}`;
  }

  const maskPositionMatch = base.match(/^mask-(left|right)(?:-(top|bottom))?$/);
  if (maskPositionMatch) {
    const side =
      maskPositionMatch[1] === 'left' ? 'inline-start' : 'inline-end';
    const pos = maskPositionMatch[2] ? `-${maskPositionMatch[2]}` : '';
    return `mask-${side}${pos}`;
  }

  const originMatch = base.match(
    /^origin-(left|right|top|bottom|center)(?:-(left|right))?$/,
  );
  if (originMatch) {
    const [first, second] = originMatch.slice(1);
    if (first === 'left') return 'origin-inline-start';
    if (first === 'right') return 'origin-inline-end';
    if (second === 'left') return `origin-${first}-inline-start`;
    if (second === 'right') return `origin-${first}-inline-end`;
  }

  const positionMatch = base.match(/^(left|right)-(.+)$/);
  if (positionMatch) {
    const side = positionMatch[1] === 'left' ? 'inline-start' : 'inline-end';
    return `${side}-${positionMatch[2]}`;
  }

  return null;
}

export function convertTailwindClassToken(token) {
  if (!token) return token;
  const parts = token.split(':');
  const base = parts.pop();
  const variants = parts;
  if (
    variants.length === 1 &&
    (variants[0] === 'before' || variants[0] === 'after')
  ) {
    const contentMatch = base.match(/^content-(none|empty)$/);
    if (contentMatch) {
      return `${variants[0]}-${contentMatch[1]}`;
    }
  }
  const mapped = mapTailwindBaseClass(base);
  if (!mapped) return token;
  parts.push(mapped);
  return parts.join(':');
}

export function convertTailwindClasses(value) {
  if (!value || typeof value !== 'string') return value;
  const tokens = value.split(/\s+/).filter(Boolean);
  let changed = false;
  const nextTokens = tokens.map((token) => {
    const next = convertTailwindClassToken(token);
    if (next !== token) changed = true;
    return next;
  });
  return changed ? nextTokens.join(' ') : value;
}
