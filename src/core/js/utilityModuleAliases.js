// Only compiled, verified compatibility records participate in auto discovery.
// A pinned production asset plan owns its own URLs and is never rewritten here.
export function resolveUtilityModule(name, aliases, rules, productionPlanActive = false) {
  if (productionPlanActive || !Object.hasOwn(aliases, name)) return name;
  const visited = new Set();
  let current = name;
  while (Object.hasOwn(aliases, current)) {
    if (visited.has(current)) return name;
    visited.add(current);
    const next = aliases[current];
    if (typeof next !== 'string' || !/^[a-z][a-z0-9-]*\/(default|sm|md|lg|xl|xxl)$/.test(next)
        || next.split('/')[1] !== current.split('/')[1]) return name;
    const source = rules[current], target = rules[next];
    if (!source || !target || (source.type && source.type !== 'utility')
        || (target.type && target.type !== 'utility')) return name;
    current = next;
  }
  return current;
}
