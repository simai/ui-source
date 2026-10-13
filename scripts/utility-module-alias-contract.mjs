// Build-time contract. A compatibility URL is retained, not deleted or renamed.
const moduleName = /^[a-z][a-z0-9-]*\/(?:default|sm|md|lg|xl|xxl)$/;

export function validateAliasGraph(contract) {
  if (!contract || contract.version !== 1 || !contract.aliases
      || typeof contract.aliases !== 'object' || Array.isArray(contract.aliases)
      || Object.keys(contract).some(key => !['version', 'aliases'].includes(key))) {
    throw new Error('Invalid utility module alias contract');
  }
  const aliases = contract.aliases;
  for (const [from, to] of Object.entries(aliases)) {
    if (!moduleName.test(from) || typeof to !== 'string' || !moduleName.test(to)) {
      throw new Error(`Invalid utility module alias: ${from}`);
    }
    if (from.split('/')[1] !== to.split('/')[1]) throw new Error(`Alias changes condition: ${from}`);
    const visited = new Set([from]);
    let next = to;
    while (next !== undefined) {
      if (visited.has(next)) throw new Error(`Utility module alias cycle: ${from}`);
      visited.add(next);
      next = Object.hasOwn(aliases, next) ? aliases[next] : undefined;
    }
  }
  return aliases;
}

// Each module contains ordered selector records from a CSS parser. A record
// retains all enclosing at-rules (including layers), declarations and !important.
// Grouped selectors are split before comparison; rule/declaration order remains.
export function verifyAliasModules(contract, modules) {
  const aliases = validateAliasGraph(contract);
  const result = [];
  for (const [from, to] of Object.entries(aliases)) {
    const source = modules.get(from), target = modules.get(to);
    if (!source || !target) throw new Error(`Missing alias module: ${from} -> ${to}`);
    if (source.sideEffects || target.sideEffects) throw new Error(`Alias has side effects: ${from}`);
    if (JSON.stringify(source.dependencies) !== JSON.stringify(target.dependencies)) {
      throw new Error(`Alias dependency mismatch: ${from}`);
    }
    if (!source.records.length) throw new Error(`Empty alias CSS: ${from}`);
    const selectors = new Set(source.records.map(record => record.selector));
    const classes = new Set(source.records.flatMap(record => record.classes || []));
    if (target.records.some(record => !selectors.has(record.selector)
        && (record.classes || []).some(name => classes.has(name)))) {
      throw new Error(`Alias has additional selector effects: ${from}`);
    }
    const projection = target.records.filter(record => selectors.has(record.selector));
    if (JSON.stringify(source.records) !== JSON.stringify(projection)) {
      throw new Error(`Alias CSS mismatch: ${from}`);
    }
    result.push({from, to, selectors: selectors.size, records: source.records.length});
  }
  return result;
}
