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
const DECLARATION_FIELDS = new Set(['class', 'values', 'responsive']);

const diagnostic = (code, path, message, details = {}) => ({ code, path, message, ...details });
const prefix = (breakpoint) => (breakpoint === 'xs' ? '' : `${breakpoint}:`);

/** The utility a props_schema property declares, or null. */
export function utilityOf(schema) {
  return isPlainObject(schema) && isPlainObject(schema[UTILITY_KEYWORD]) ? schema[UTILITY_KEYWORD] : null;
}

/** Whether a property takes a value per breakpoint. */
export function isResponsive(schema) {
  return utilityOf(schema)?.responsive === true;
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

/** The class one value becomes, without a prefix; '' when it becomes none. */
export function utilityClass(declaration, value) {
  if (value === undefined || value === null || !isPlainObject(declaration)) return '';
  if (isPlainObject(declaration.values) && Object.hasOwn(declaration.values, String(value))) return declaration.values[String(value)];
  if (typeof declaration.class === 'string') return declaration.class.replace('{value}', String(value));
  return '';
}

/**
 * The classes a node's layout parameters print, mobile first. At the phone a
 * value equal to the property's default prints nothing (the type draws its
 * default without a class); at a wider breakpoint a class is printed only
 * where the value differs from the narrower one.
 */
export function utilityClasses(node, manifest) {
  const properties = manifest?.props_schema?.properties;
  if (!isPlainObject(properties)) return [];
  const props = isPlainObject(node?.props) ? node.props : {};
  const classes = [];
  for (const [key, schema] of Object.entries(properties)) {
    const declaration = utilityOf(schema);
    if (!declaration || !(key in props)) continue;
    // A parameter that is not responsive holds one value for every screen.
    const values = valuesByBreakpoint(declaration.responsive === true ? props[key] : (isPlainObject(props[key]) ? undefined : props[key]), schema);
    let previous;
    UTILITY_BREAKPOINTS.forEach((breakpoint, index) => {
      const value = values[breakpoint];
      if (index === 0) {
        if (!('default' in schema && value === schema.default)) {
          const name = utilityClass(declaration, value);
          if (name) classes.push(name);
        }
      } else if (value !== previous) {
        const name = utilityClass(declaration, value);
        if (name) classes.push(`${prefix(breakpoint)}${name}`);
      }
      previous = value;
    });
  }
  return [...new Set(classes)];
}

/**
 * Every class a property can print, for a check against the utility rules: each
 * allowed value at each breakpoint. Null when the values are not a closed list
 * (an integer range of more than 100 steps).
 */
export function utilityClassSpace(schema) {
  const declaration = utilityOf(schema);
  if (!declaration) return [];
  let values = null;
  if (Array.isArray(schema.enum)) values = schema.enum;
  else if (schema.type === 'boolean') values = [true, false];
  else if (schema.type === 'integer' && Number.isInteger(schema.minimum) && Number.isInteger(schema.maximum) && schema.maximum - schema.minimum <= 100) {
    values = Array.from({ length: schema.maximum - schema.minimum + 1 }, (_, index) => schema.minimum + index);
  }
  if (!values) return null;
  const breakpoints = declaration.responsive === true ? UTILITY_BREAKPOINTS : ['xs'];
  return [...new Set(values.flatMap((value) => breakpoints.map((breakpoint) => {
    const name = utilityClass(declaration, value);
    return name ? `${prefix(breakpoint)}${name}` : '';
  }).filter(Boolean)))];
}

/** The problems of a props_schema's utility declarations (a type manifest check). */
export function validateUtilityDeclarations(manifest, path = '$.props_schema') {
  const diagnostics = [];
  const properties = manifest?.props_schema?.properties;
  if (!isPlainObject(properties)) return diagnostics;
  for (const [key, schema] of Object.entries(properties)) {
    if (!isPlainObject(schema) || !(UTILITY_KEYWORD in schema)) continue;
    const at = `${path}.properties.${key}.${UTILITY_KEYWORD}`;
    const declaration = schema[UTILITY_KEYWORD];
    if (!isPlainObject(declaration)) {
      diagnostics.push(diagnostic('utility_declaration_invalid', at, 'A utility declaration is an object'));
      continue;
    }
    for (const field of Object.keys(declaration)) if (!DECLARATION_FIELDS.has(field)) diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.${field}`, `Unknown utility field ${field}`));
    const hasClass = declaration.class !== undefined;
    const hasValues = declaration.values !== undefined;
    if (!hasClass && !hasValues) diagnostics.push(diagnostic('utility_declaration_invalid', at, 'A utility names a class template or a class per value'));
    if (hasClass && (typeof declaration.class !== 'string' || !TEMPLATE_PATTERN.test(declaration.class))) diagnostics.push(diagnostic('utility_template_invalid', `${at}.class`, 'The class template is a utility name ending in {value}, with no prefix'));
    if (hasValues) {
      if (!isPlainObject(declaration.values)) diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.values`, 'values maps each value to a class'));
      else for (const [value, name] of Object.entries(declaration.values)) {
        if (typeof name !== 'string' || (name !== '' && (!CLASS_PATTERN.test(name) || name.includes(':')))) diagnostics.push(diagnostic('utility_template_invalid', `${at}.values.${value}`, 'A value becomes one class with no prefix, or none'));
      }
    }
    if (declaration.responsive !== undefined && typeof declaration.responsive !== 'boolean') diagnostics.push(diagnostic('utility_declaration_invalid', `${at}.responsive`, 'responsive is true or false'));
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
