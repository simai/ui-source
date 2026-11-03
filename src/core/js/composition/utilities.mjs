// Layout parameters as SIMAI Framework modifiers, and a block's own modifiers
// (one block editor, owner 2026-11-03; ui-control
// control/ui-editor/UNIFIED-BLOCK-EDITOR.md, section 6).
//
// A Document keeps values, never class strings: `cols: 3`, on the tablet 2,
// on the phone 1. A parameter of a type's props_schema declares the utility it
// becomes (`x-simai-utility`), and the renderer prints the classes mobile
// first: no prefix for the phone, `md:` for the tablet, `lg:` for the desktop,
// a prefix only where the value changes. Grid, gap, padding and visibility are
// utilities, never inline styles.
//
// A block's own modifiers are classes an author adds (the editor's "Extra"
// field). They live in the node's extension `simai.composition:modifiers`,
// are checked against the RuleLoader's utility rules, and a class no rule
// knows is left out of the HTML and reported: a notice, never a refusal.

import { isPlainObject } from './canonical.mjs';

/** The SIMAI Framework's breakpoints, narrowest first (core/js/breakpoints.js; xs has no prefix). */
export const UTILITY_BREAKPOINTS = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl', 'xxl']);
export const UTILITY_KEYWORD = 'x-simai-utility';
export const MODIFIERS_EXTENSION = 'simai.composition:modifiers';
const MAX_MODIFIERS = 50;
const CLASS_PATTERN = /^[a-z0-9][a-z0-9:/_.-]{0,99}$/u;
const TEMPLATE_PATTERN = /^[a-z][a-z0-9-]*\{value\}$/u;
const PART_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
const DECLARATION_FIELDS = new Set(['class', 'values', 'responsive', 'part']);
/** The attribute a renderer marks an inner element with, so a parameter's classes reach it (`part`). */
export const PART_ATTRIBUTE = 'data-sf-composition-part';

const diagnostic = (code, path, message, details = {}) => ({ code, path, message, ...details });
const prefix = (breakpoint) => (breakpoint === 'xs' ? '' : `${breakpoint}:`);

/**
 * The utility declarations of a props_schema property: one object, or a list
 * when the value also reaches inner elements of the block (each with its
 * `part`; parameter sets, 2026-11-03). Empty when there is none.
 */
export function declarationsOf(schema) {
  if (!isPlainObject(schema)) return [];
  const value = schema[UTILITY_KEYWORD];
  if (isPlainObject(value)) return [value];
  if (Array.isArray(value)) return value.filter(isPlainObject);
  return [];
}

/** The utility a props_schema property declares on the block's own element (its first declaration), or null. */
export function utilityOf(schema) {
  return declarationsOf(schema)[0] ?? null;
}

/** Whether a property takes a value per breakpoint. */
export function isResponsive(schema) {
  return declarationsOf(schema).some((declaration) => declaration.responsive === true);
}

/** A value held per breakpoint: an object whose keys are breakpoint names. */
export function isBreakpointValue(value) {
  return isPlainObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => UTILITY_BREAKPOINTS.includes(key));
}

/** The schema a single value of the property is checked by: the property without its utility annotation. */
export function valueSchema(schema) {
  if (!utilityOf(schema)) return schema;
  return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== UTILITY_KEYWORD));
}

/**
 * The value of a property at each breakpoint, carried forward from the
 * narrowest one; the property's `default` where nothing is set yet.
 * A scalar stands for every breakpoint.
 */
export function valuesByBreakpoint(value, schema = {}) {
  const fallback = isPlainObject(schema) && 'default' in schema ? schema.default : undefined;
  const out = {};
  let current = fallback;
  for (const breakpoint of UTILITY_BREAKPOINTS) {
    if (isBreakpointValue(value)) {
      if (breakpoint in value) current = value[breakpoint];
    } else if (value !== undefined) current = value;
    out[breakpoint] = current;
  }
  return out;
}

const tokens = (value) => String(value).split(' ').filter(Boolean);
const prefixed = (breakpoint, name) => tokens(name).map((token) => `${prefix(breakpoint)}${token}`);

/** The class (or space-separated classes) one value becomes, without a prefix; '' when it becomes none. */
export function utilityClass(declaration, value) {
  if (value === undefined || value === null || !isPlainObject(declaration)) return '';
  if (isPlainObject(declaration.values) && Object.hasOwn(declaration.values, String(value))) return declaration.values[String(value)];
  if (typeof declaration.class === 'string') return declaration.class.replaceAll('{value}', String(value));
  return '';
}

/**
 * The classes a node's layout parameters print, mobile first, by part: '' is
 * the block's own element, any other key an inner element the renderer marks
 * `data-sf-composition-part="<part>"`. At the phone a value equal to the
 * property's default prints nothing (the type draws its default without a
 * class); at a wider breakpoint a class is printed only where the value
 * differs from the narrower one. A value may become several classes.
 */
export function utilityPartClasses(node, manifest) {
  const parts = {};
  const properties = manifest?.props_schema?.properties;
  if (!isPlainObject(properties)) return parts;
  const props = isPlainObject(node?.props) ? node.props : {};
  for (const [key, schema] of Object.entries(properties)) {
    if (!(key in props)) continue;
    for (const declaration of declarationsOf(schema)) {
      const part = typeof declaration.part === 'string' ? declaration.part : '';
      const classes = parts[part] || (parts[part] = []);
      // A parameter that is not responsive holds one value for every screen.
      const values = valuesByBreakpoint(declaration.responsive === true ? props[key] : (isPlainObject(props[key]) ? undefined : props[key]), schema);
      // `effective` are the classes in force at the narrower screen: a class
      // a wider value shares with it (grid in grid grid-col-{value}) is not
      // printed again.
      let previous;
      let effective = [];
      UTILITY_BREAKPOINTS.forEach((breakpoint, index) => {
        const value = values[breakpoint];
        if (index === 0) {
          if (!('default' in schema && value === schema.default)) {
            effective = tokens(utilityClass(declaration, value));
            classes.push(...prefixed('xs', effective.join(' ')));
          }
        } else if (value !== previous) {
          const next = tokens(utilityClass(declaration, value));
          classes.push(...prefixed(breakpoint, next.filter((token) => !effective.includes(token)).join(' ')));
          effective = next;
        }
        previous = value;
      });
    }
  }
  for (const part of Object.keys(parts)) parts[part] = [...new Set(parts[part])];
  return parts;
}

/** The classes a node's layout parameters print on the block's own element. */
export function utilityClasses(node, manifest) {
  return utilityPartClasses(node, manifest)[''] || [];
}

/**
 * Every class a property can print, for a check against the utility rules: each
 * allowed value at each breakpoint. Null when the values are not a closed list
 * (an integer range of more than 100 steps).
 */
export function utilityClassSpace(schema) {
  const declarations = declarationsOf(schema);
  if (!declarations.length) return [];
  let values = null;
  if (Array.isArray(schema.enum)) values = schema.enum;
  else if (schema.type === 'boolean') values = [true, false];
  else if (schema.type === 'integer' && Number.isInteger(schema.minimum) && Number.isInteger(schema.maximum) && schema.maximum - schema.minimum <= 100) {
    values = Array.from({ length: schema.maximum - schema.minimum + 1 }, (_, index) => schema.minimum + index);
  }
  if (!values) return null;
  return [...new Set(declarations.flatMap((declaration) => {
    const breakpoints = declaration.responsive === true ? UTILITY_BREAKPOINTS : ['xs'];
    return values.flatMap((value) => breakpoints.flatMap((breakpoint) => prefixed(breakpoint, utilityClass(declaration, value))));
  }))];
}

/** The problems of a props_schema's utility declarations (a type manifest check). */
export function validateUtilityDeclarations(manifest, path = '$.props_schema') {
  const diagnostics = [];
  const properties = manifest?.props_schema?.properties;
  if (!isPlainObject(properties)) return diagnostics;
  for (const [key, schema] of Object.entries(properties)) {
    if (!isPlainObject(schema) || !(UTILITY_KEYWORD in schema)) continue;
    const declared = schema[UTILITY_KEYWORD];
    const list = Array.isArray(declared) ? declared : [declared];
    if (Array.isArray(declared) && (declared.length === 0 || declared.length > 8)) diagnostics.push(diagnostic('utility_declaration_invalid', `${path}.properties.${key}.${UTILITY_KEYWORD}`, 'A list holds one to eight declarations'));
    const partsSeen = new Set();
    list.forEach((declaration, index) => {
      const at = `${path}.properties.${key}.${UTILITY_KEYWORD}${Array.isArray(declared) ? `[${index}]` : ''}`;
      if (!isPlainObject(declaration)) {
        diagnostics.push(diagnostic('utility_declaration_invalid', at, 'A utility declaration is an object'));
        return;
      }
      for (const field of Object.keys(declaration)) if (!DECLARATION_FIELDS.has(field)) diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.${field}`, `Unknown utility field ${field}`));
      const part = declaration.part ?? '';
      if (declaration.part !== undefined && (typeof declaration.part !== 'string' || !PART_PATTERN.test(declaration.part))) diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.part`, 'A part is a lowercase name'));
      else if (partsSeen.has(part)) diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.part`, 'One declaration per part'));
      partsSeen.add(part);
      const hasClass = declaration.class !== undefined;
      const hasValues = declaration.values !== undefined;
      if (!hasClass && !hasValues) diagnostics.push(diagnostic('utility_declaration_invalid', at, 'A utility names a class template or a class per value'));
      // A template is one or more classes, at least one ending in {value}.
      const templateTokens = typeof declaration.class === 'string' ? declaration.class.split(' ') : [];
      if (hasClass && (typeof declaration.class !== 'string' || !templateTokens.some((token) => TEMPLATE_PATTERN.test(token)) || templateTokens.some((token) => !TEMPLATE_PATTERN.test(token) && (!CLASS_PATTERN.test(token) || token.includes(':'))))) diagnostics.push(diagnostic('utility_template_invalid', `${at}.class`, 'The class template is utility names with no prefix, one ending in {value}'));
      if (hasValues) {
        if (!isPlainObject(declaration.values)) diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.values`, 'values maps each value to a class'));
        else for (const [value, name] of Object.entries(declaration.values)) {
          if (typeof name !== 'string' || (name !== '' && name.split(' ').some((token) => !CLASS_PATTERN.test(token) || token.includes(':')))) diagnostics.push(diagnostic('utility_template_invalid', `${at}.values.${value}`, 'A value becomes classes with no prefix (space-separated), or none'));
        }
      }
      if (declaration.responsive !== undefined && typeof declaration.responsive !== 'boolean') diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.responsive`, 'responsive is true or false'));
    });
    const scalarSchema = Array.isArray(schema.enum) || ['integer', 'number', 'string', 'boolean'].includes(schema.type);
    if (!scalarSchema) diagnostics.push(diagnostic('utility_value_not_scalar', `${path}.properties.${key}`, 'A layout parameter holds one scalar value per breakpoint'));
  }
  return diagnostics;
}

/**
 * Splits a node's props for the schema check: a responsive property held per
 * breakpoint is checked value by value, and stands in the props by one of its
 * values so the closed schema still reads it.
 */
export function checkResponsiveProps(props, schema, path, check) {
  const diagnostics = [];
  if (!isPlainObject(props) || !isPlainObject(schema?.properties)) return { props, diagnostics };
  let flat = props;
  for (const [key, property] of Object.entries(schema.properties)) {
    if (!(key in props)) continue;
    const value = props[key];
    if (isResponsive(property) && isPlainObject(value)) {
      if (!isBreakpointValue(value)) {
        diagnostics.push(diagnostic('breakpoint_unknown', `${path}.${key}`, `A value per screen is keyed by ${UTILITY_BREAKPOINTS.join(', ')}`));
      } else {
        for (const [breakpoint, entry] of Object.entries(value)) check(entry, valueSchema(property), `${path}.${key}.${breakpoint}`, diagnostics);
      }
      if (flat === props) flat = { ...props };
      delete flat[key];
    }
  }
  if (flat !== props) {
    const properties = Object.fromEntries(Object.entries(schema.properties).filter(([key]) => key in flat));
    return { props: flat, schema: { ...schema, properties, required: (schema.required || []).filter((key) => key in flat || !(key in props)) }, diagnostics };
  }
  return { props, diagnostics };
}

// ------------------------------------------------------------- own modifiers

/** The classes an author added to a node (its own modifiers), as stored. */
export function ownModifiers(node) {
  const entry = isPlainObject(node?.extensions) ? node.extensions[MODIFIERS_EXTENSION] : undefined;
  if (!isPlainObject(entry) || !Array.isArray(entry.utilities)) return [];
  return entry.utilities.filter((value) => typeof value === 'string').slice(0, MAX_MODIFIERS);
}

/** The class rules of a RuleLoader map: its RegExp entries (component rules are objects). */
export function utilityRules(ruleLoader = globalThis.SF?.RuleLoader) {
  if (Array.isArray(ruleLoader)) return ruleLoader.filter((rule) => rule instanceof RegExp);
  if (!ruleLoader || typeof ruleLoader !== 'object') return null;
  const rules = Object.values(ruleLoader).filter((rule) => rule instanceof RegExp);
  return rules.length ? rules : null;
}

/**
 * Checks classes against the utility rules: `kept` are printed, `dropped` are
 * left out with the reason. Without any rule nothing unchecked is printed.
 */
export function checkModifiers(classes, options = {}) {
  const rules = utilityRules(options.rules ?? globalThis.SF?.RuleLoader);
  const kept = [];
  const dropped = [];
  const seen = new Set();
  for (const value of Array.isArray(classes) ? classes : []) {
    if (typeof value !== 'string' || !CLASS_PATTERN.test(value)) dropped.push({ class: String(value), reason: 'modifier_invalid' });
    else if (seen.has(value)) continue;
    else if (!rules) dropped.push({ class: value, reason: 'modifier_rules_unavailable' });
    else if (rules.some((rule) => { rule.lastIndex = 0; return rule.test(value); })) kept.push(value);
    else dropped.push({ class: value, reason: 'modifier_unknown' });
    seen.add(value);
  }
  if (Array.isArray(classes) && classes.length > MAX_MODIFIERS) dropped.push({ class: `(${classes.length - MAX_MODIFIERS} more)`, reason: 'modifier_limit' });
  return { kept, dropped };
}

/** The notices a node's own modifiers give: one per class left out. */
export function modifierNotices(node, options = {}) {
  const entry = isPlainObject(node?.extensions) ? node.extensions[MODIFIERS_EXTENSION] : undefined;
  if (entry === undefined) return { kept: [], notices: [] };
  if (!isPlainObject(entry) || !Array.isArray(entry.utilities)) {
    return { kept: [], notices: [diagnostic('modifiers_invalid', `node:${node.id}`, `${MODIFIERS_EXTENSION} holds {utilities: [classes]}`)] };
  }
  const { kept, dropped } = checkModifiers(entry.utilities, options);
  return {
    kept,
    notices: dropped.map((item) => diagnostic(item.reason, `node:${node.id}`, item.reason === 'modifier_unknown'
      ? `${item.class} is no SIMAI Framework utility; it is left out of the HTML`
      : item.reason === 'modifier_rules_unavailable'
        ? `${item.class} cannot be checked without the utility rules; it is left out of the HTML`
        : `${item.class} is left out of the HTML`, { class: item.class })),
  };
}

// --------------------------------------------------------------- the output

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/**
 * Adds classes to the inner element a renderer marks `data-sf-composition-part="<part>"`,
 * the first one after the node's own element (a renderer draws its parts
 * around its slots, so the node's parts come before its children's).
 * Returns {html, found}.
 */
export function withPartClasses(html, id, part, classes) {
  if (typeof html !== 'string') return { html, found: false };
  const at = html.indexOf(`data-sf-composition-id="${escapeAttribute(id)}"`);
  if (at === -1) return { html, found: false };
  const marker = html.indexOf(`${PART_ATTRIBUTE}="${escapeAttribute(part)}"`, at);
  // The part belongs to this node only if no other node's element comes first.
  const next = html.indexOf('data-sf-composition-id="', at + 1);
  if (marker === -1 || (next !== -1 && next < marker)) return { html, found: false };
  if (!classes.length) return { html, found: true };
  const start = html.lastIndexOf('<', marker);
  const end = html.indexOf('>', marker);
  const tag = html.slice(start, end);
  const existing = tag.match(/\sclass="([^"]*)"/u);
  let replaced;
  if (existing) {
    const own = existing[1].split(/\s+/u).filter(Boolean);
    replaced = tag.replace(existing[0], ` class="${escapeAttribute([...own, ...classes.filter((name) => !own.includes(name))].join(' '))}"`);
  } else {
    const name = tag.match(/^<[A-Za-z][A-Za-z0-9-]*/u);
    if (!name) return { html, found: false };
    replaced = `${name[0]} class="${escapeAttribute(classes.join(' '))}"${tag.slice(name[0].length)}`;
  }
  return { html: html.slice(0, start) + replaced + html.slice(end), found: true };
}

/**
 * Adds classes to the element that carries `data-sf-composition-id="<id>"`:
 * the one element each renderer draws for its node. The classes join the
 * element's own, once each; HTML without that element is returned as it came.
 */
export function withClasses(html, id, classes) {
  if (!classes.length || typeof html !== 'string') return html;
  const marker = `data-sf-composition-id="${escapeAttribute(id)}"`;
  const at = html.indexOf(marker);
  if (at === -1) return html;
  const start = html.lastIndexOf('<', at);
  const end = html.indexOf('>', at);
  if (start === -1 || end === -1) return html;
  const tag = html.slice(start, end);
  const existing = tag.match(/\sclass="([^"]*)"/u);
  if (existing) {
    const own = existing[1].split(/\s+/u).filter(Boolean);
    const merged = [...own, ...classes.filter((name) => !own.includes(name))].join(' ');
    const replaced = tag.replace(existing[0], ` class="${escapeAttribute(merged)}"`);
    return html.slice(0, start) + replaced + html.slice(end);
  }
  const name = tag.match(/^<[A-Za-z][A-Za-z0-9-]*/u);
  if (!name) return html;
  return `${html.slice(0, start)}${name[0]} class="${escapeAttribute(classes.join(' '))}"${tag.slice(name[0].length)}${html.slice(end)}`;
}
