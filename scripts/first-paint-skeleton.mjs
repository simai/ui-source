// A hand-written skeleton.html filled from settings (standard
// simai.smart-component 1.3.8 §5.4 «The skeleton template»): it overrides the
// derived skeleton only where the snapshot is wrong, such as rows repeated
// from a setting, and it is the skeleton of a part whose data is not known
// when an assembly's first paint is composed (§7.3):
//
//   "presentation": {"skeleton": {"file": "skeleton.html", "late": [...], "repeat": {"rows": "<setting>"}}}
//
// The template's syntax, small on purpose and without a browser:
//   {{name}}                                  a setting (given, else its default), escaped
//   <template data-sf-repeat="rows">…</template>
//                                             its content once per row: the setting
//                                             `repeat.rows` names, a number or a
//                                             list's length
// Comments are dropped. The result is put in the host as a server prints it:
// its attributes, its JSON island without the late settings, and
// data-sf-first-paint="skeleton" aria-busy="true".
import {readFileSync} from 'node:fs';
import {esc, hostSpec, islandText} from './first-paint-lib.mjs';

const valueOf = (component, settings, name) => {
  if (settings[name] !== undefined) return settings[name];
  const member = component.manifest.settings?.[name] ?? component.manifest.values?.[name];
  return member?.default ?? '';
};

export function fillSkeleton(component, settings, template) {
  const repeat = component.skeletonRepeat ?? {};
  let body = template.replace(/<!--[\s\S]*?-->/gu, '');
  body = body.replace(/<template data-sf-repeat="([\w-]+)">([\s\S]*?)<\/template>/gu, (_, key, inner) => {
    const setting = repeat[key];
    if (!setting) throw new Error(`${component.folder}/skeleton.html repeats "${key}", which presentation.skeleton.repeat does not name`);
    const value = valueOf(component, settings, setting);
    const count = Array.isArray(value) ? value.length : Math.max(0, Math.floor(Number(value) || 0));
    return inner.repeat(count);
  });
  return body.replace(/\{\{\s*([\w-]+)\s*\}\}/gu, (_, name) => {
    const value = valueOf(component, settings, name);
    return esc(typeof value === 'object' ? JSON.stringify(value) : value);
  }).trim();
}

const printHost = (tag, attributes, island, inner) => {
  const attrs = attributes.filter(([name]) => name !== 'data-sf-first-paint' && name !== 'aria-busy')
    .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${esc(value)}"`)).join('');
  const json = Object.keys(island).length ? `<script type="application/json" data-sf-settings>${islandText(island)}</script>` : '';
  return `<${tag}${attrs} data-sf-first-paint="skeleton" aria-busy="true">${json}${inner}</${tag}>`;
};

/** The skeleton of a leaf's example: skeleton.html filled from the example's settings. */
export function renderSkeletonTemplate(component, example) {
  const template = readFileSync(component.skeletonFile, 'utf8');
  const spec = hostSpec(component, example, {drop: component.late});
  return printHost(spec.tag, spec.attributes, spec.island, fillSkeleton(component, example.settings ?? {}, template));
}

/**
 * The skeleton of a part placed in an assembly, from the attributes and the
 * island it had when the first paint was composed, its late settings left
 * out. A part without skeleton.html is refused: its rows would have to be
 * guessed (§5.4: each component with late data takes a skeleton.html).
 */
export function renderPartSkeleton(component, {attributes, island, late}) {
  if (!component.skeletonFile) {
    throw new Error(`${component.tag}: its data (${late.join(', ')}) is not known when the first paint is composed and it has no skeleton.html`);
  }
  const settings = Object.fromEntries(attributes);
  Object.assign(settings, island);
  const kept = Object.fromEntries(Object.entries(island).filter(([name]) => !late.includes(name)));
  return printHost(component.tag, attributes, kept, fillSkeleton(component, settings, readFileSync(component.skeletonFile, 'utf8')));
}
