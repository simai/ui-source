#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const write = process.argv.includes('--write');
const refreshMetadata = process.argv.includes('--refresh-metadata');
const verify = process.argv.includes('--verify');
const componentFilter = process.argv.find((argument) => argument.startsWith('--component='))?.slice('--component='.length) ?? '';
if (componentFilter !== '' && !/^[a-z][a-z0-9-]*$/.test(componentFilter)) {
  throw new Error(`Invalid component filter: ${componentFilter}`);
}
// `templates` lists the templates a component ships; the `template` input is
// not limited to them. Any other name loads from the external template base
// (<base>/<component>/<name>/index.js), so an enum of the shipped names told
// tools and the generated catalogue that a working page was invalid.
function openTemplateInput(manifest) {
  if (manifest.inputs.properties.template) delete manifest.inputs.properties.template.enum;
}

// Directories under src/smart that are modules rather than elements. A
// manifest requires a custom element name, so a module cannot have one; the
// field renderer set is a module by design -- it is called, not placed in
// markup -- which is why the registry cannot describe it yet. Recorded in
// ui-control's ledger as a question for the registry's owner.
// inputs, icons, buttons, icon-buttons, badges and tags are former distribution paths of Smart elements, forwarding
// bundles until 2026-12-01 (change journal path-smart-<old>-to-<new>), not elements.
const serviceDirectories = new Set(['helpers', 'field-renderers', 'inputs', 'icons', 'buttons', 'icon-buttons', 'badges', 'tags']);
const generatedRuntimeRoot = path.resolve(root, '../ui-smart');
const uiRoot = path.resolve(root, '../ui');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
// The revisions of the generated checkouts beside this one. ui-smart is
// archived and private, and a public CI has neither it nor necessarily ui: a
// missing checkout has no revision, and the manifests keep the ones they name.
const revisionOf = (cwd) => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch {
    return null;
  }
};
const uiRevision = revisionOf(uiRoot);
const smartRevision = revisionOf(generatedRuntimeRoot);

const samples = {
  alert: {title: 'Изменения сохранены', 'supporting-text': 'Новая версия уже доступна участникам команды.', 'action-text': 'Открыть', 'close-label': 'Закрыть уведомление', type: 'success', closable: true},
  avatar: {template: 'label', text: 'AZ', title: 'Анна Захарова', description: 'Дизайнер продукта', status: 'online', size: '2'},
  avatars: {template: 'label', 'image-url': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect width="96" height="96" rx="48" fill="%233b82f6"/%3E%3Ctext x="48" y="58" text-anchor="middle" font-size="30" fill="white"%3EAZ%3C/text%3E%3C/svg%3E', 'avatar-size': '2', 'label-text': 'Команда проекта', 'label-second-text': '5 участников'},
  badges: {text: 'Новый', type: 'fill', scheme: 'primary'},
  breadcrumbs: {'aria-label': 'Навигация'},
  buttons: {text: 'Продолжить', type: 'default', scheme: 'primary'},
  checkbox: {label: 'Получать уведомления', checked: true},
  close: {size: '1'},
  'context-menu': {position: 'bottom-start', 'aria-label': 'Действия'},
  'country-code': {value: '+7 999 123-45-67', label: 'Телефон'},
  datepicker: {value: '2026-09-03', locale: 'ru', label: 'Дата публикации', open: true},
  'download-file': {'file-name': 'Отчёт за август.pdf', 'file-size': '2,4 МБ', href: '#', download: true},
  drawer: {open: true, title: 'Параметры проекта', label: 'Параметры проекта', placement: 'inline-end', size: 'medium'},
  dropdown: {label: 'Статус', placeholder: 'Выберите статус'},
  'file-upload': {'link-text': 'Выберите файлы', text: 'или перетащите их сюда', formats: 'PDF, PNG или JPG', 'supporting-text': 'Можно загрузить несколько документов', multiple: true},
  gallery: {open: true, current: 0},
  'icon-buttons': {icon: 'settings', 'aria-label': 'Настройки'},
  icons: {icon: 'home', size: '1'},
  inputs: {label: 'Электронная почта', value: 'team@simai.ru', required: true, hint: 'На этот адрес придёт подтверждение.', 'input-type': 'email', autocomplete: 'email'},
  'list-item': {value: 'open', text: 'Пункт списка', icon: 'star'},
  modal: {open: true, title: 'Подтверждение'},
  pagination: {current: 2, total: 80, 'page-size': 10, 'selected-count': 3, 'show-more-text': 'Показать ещё', 'show-page-size': true, 'page-sizes': '10,20,40', 'aria-label': 'Страницы результатов', top: false, bottom: false},
  'progress-bar': {value: '65', 'text-position': 'inline-end'},
  'progress-scale': {value: '65', 'show-text': true},
  radio: {label: 'Основной вариант', checked: true, value: 'primary'},
  'range-slider': {min: '0', max: '100', value: '20,80', multiple: true, prefix: 'от ', suffix: ' %', label: 'both'},
  'reference-link': {text: 'Документация', href: '#'},
  skeleton: {count: 3, height: 'b4', variant: 'text'},
  slider: {dots: true, arrows: true},
  spinner: {label: 'Загрузка данных', size: '2', infinite: true},
  steps: {
    'aria-label': 'Этапы публикации',
    'completed-label': 'Завершено',
    current: 1,
    'error-label': 'Ошибка',
    items: 'Черновик|Проверка|Готово',
  },
  switch: {label: 'Включено', checked: true},
  tabs: {'active-index': 0, items: 'Обзор|История'},
  tags: {type: 'default', text: 'Дизайн', closable: true, 'close-label': 'Удалить тег Дизайн'},
  textarea: {label: 'Комментарий', value: 'Текст примера', required: true, hint: 'Добавьте пояснение для пользователя.', maxlength: 500, spellcheck: true},
  toast: {title: 'Операция выполнена', 'supporting-text': 'Изменения сохранены без ошибок.', 'action-text': 'Посмотреть', type: 'success', closable: true},
  toggle: {label: 'Автоматически', checked: true},
  tooltip: {text: 'Полезная подсказка', 'supporting-text': 'Дополнительная информация', type: 'dark', size: '1', arrow: 'bottom-center'},
  tree: {'aria-label': 'Структура'},
  'tree-item': {text: 'Раздел', value: 'section', open: true}
};

const childSamples = {
  breadcrumbs: [{element: 'a', props: {href: '#'}, text: 'Главная', children: []}, {element: 'a', props: {href: '#'}, text: 'Компоненты', children: []}],
  'context-menu': [
    {element: 'sf-button', props: {slot: 'content', type: 'link', scheme: 'on-surface', text: 'Открыть'}, text: '', children: []},
    {element: 'sf-button', props: {slot: 'content', type: 'link', scheme: 'on-surface', text: 'Удалить'}, text: '', children: []},
  ],
  drawer: [{element: 'p', props: {}, text: 'Содержимое боковой панели', children: []}],
  dropdown: [{element: 'sf-list-item', props: {value: 'open', text: 'Открыт'}, text: '', children: []}, {element: 'sf-list-item', props: {value: 'done', text: 'Готов'}, text: '', children: []}],
  gallery: [{element: 'img', props: {src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="100%25" height="100%25" fill="%233b82f6"/%3E%3C/svg%3E', alt: 'Синий пример'}, text: '', children: []}],
  modal: [{element: 'p', props: {}, text: 'Сохранить внесённые изменения?', children: []}],
  slider: [{element: 'div', props: {}, text: 'Первый слайд', children: []}, {element: 'div', props: {}, text: 'Второй слайд', children: []}],
  tabs: [{element: 'button', props: {type: 'button'}, text: 'Обзор', children: []}, {element: 'button', props: {type: 'button'}, text: 'История', children: []}],
  tree: [{element: 'sf-tree-item', props: {text: 'Корневой раздел', value: 'root', open: true}, text: '', children: [{element: 'sf-tree-item', props: {text: 'Дочерний пункт', value: 'child'}, text: '', children: []}]}],
  'tree-item': [{element: 'sf-tree-item', props: {text: 'Дочерний пункт', value: 'child'}, text: '', children: []}]
};

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
async function fileExists(file) { try { return (await stat(file)).isFile(); } catch { return false; } }
function kebab(value) { return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase(); }
function title(value) { return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }

function balancedBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return '';
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start < 0) return '';
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  return '';
}

function balancedBlockFrom(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  return '';
}

function literal(value) {
  const normalized = value?.trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (normalized === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(normalized ?? '')) return Number(normalized);
  const quoted = normalized?.match(/^(['"])(.*)\1$/s);
  if (quoted) return quoted[2];
  if (/^\[.*\]$/s.test(normalized ?? '')) {
    return normalized.slice(1, -1).split(',').map((part) => literal(part)).filter((part) => part !== undefined);
  }
  return undefined;
}

function topLevelEntries(block) {
  const entries = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < block.length; index += 1) {
    const character = block[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if (character === '{') braces += 1;
    else if (character === '}') braces -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    else if (character === ',' && braces === 0 && brackets === 0) {
      entries.push(block.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = block.slice(start).trim();
  if (tail) entries.push(tail);
  return entries;
}

// A component whose plumbing comes from its component.json (standard 1.3.8,
// core/js/element-manifest.js) spreads the generated props into its own:
// `...super.props`. The settings and writable values are read from the
// component.json instead.
function componentJsonProperties(componentJson) {
  const result = {};
  if (!componentJson) return result;
  const take = (name, spec = {}) => {
    const type = spec.type === 'boolean' ? 'boolean' : spec.type === 'number' ? 'number' : spec.type === 'list' ? 'array' : 'string';
    if (['object', 'state'].includes(spec.type)) return;
    const property = {type};
    if (spec.default !== undefined) property.default = spec.default;
    if (Array.isArray(spec.values)) property.enum = [...spec.values];
    result[name] = property;
  };
  for (const [name, spec] of Object.entries(componentJson.settings ?? {})) take(name, spec);
  for (const [name, spec] of Object.entries(componentJson.values ?? {})) {
    if (!name.startsWith('effective-') && (spec?.default !== undefined || spec?.['default-from'])) take(name, spec);
  }
  return result;
}

function inputProperties(source, {spreadsManifest = false} = {}) {
  const body = balancedBlock(source, 'static get props()');
  const returnIndex = body.indexOf('return');
  const objectStart = returnIndex < 0 ? -1 : body.indexOf('{', returnIndex);
  const rawBlock = objectStart < 0 ? '' : balancedBlockFrom(body, objectStart);
  // Comments are removed before the block is split into entries, not after. A
  // comma inside a comment used to split one prop in two, and the prop then
  // matched nothing and vanished from the manifest without a word.
  const block = rawBlock
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const result = {};
  const unparsed = [];
  for (const entry of topLevelEntries(block)) {
    if (spreadsManifest && entry.trim() === '...super.props') continue;
    const match = entry.trim().match(/^([A-Za-z][A-Za-z0-9_]*):\s*([\s\S]+)$/);
    if (!match) {
      if (entry.trim()) unparsed.push(entry.trim().slice(0, 60));
      continue;
    }
    const propertyName = match[1];
    const config = match[2].trim();
    const attribute = config.match(/\battribute:\s*['"]([^'"]+)['"]/)?.[1];
    const key = attribute || kebab(propertyName);
    if (key === 'template-name') continue;
    const directValue = config.startsWith('{') ? undefined : literal(config);
    const type = /\btype:\s*Boolean/.test(config) || typeof directValue === 'boolean'
      ? 'boolean'
      : /\btype:\s*Number/.test(config) || typeof directValue === 'number'
        ? 'number'
        : /\btype:\s*Array/.test(config) || Array.isArray(directValue) ? 'array' : 'string';
    const property = {type};
    const defaultValue = directValue ?? literal(config.match(/\bdefault:\s*([^,}\n]+)/)?.[1]);
    if (defaultValue !== undefined) property.default = defaultValue;
    const values = config.match(/values:\s*\[([^\]]*)\]/)?.[1]
      ?.split(',')
      .map((value) => literal(value))
      .filter((value) => value !== undefined);
    if (values?.length) property.enum = values;
    result[key] = property;
  }
  if (unparsed.length) {
    throw new Error(`props entries the parser could not read: ${unparsed.join(' | ')}`);
  }
  return result;
}

function templateNames(source) {
  const names = new Set(['default']);
  const rendererBlock = source.match(/const\s+TEMPLATE_RENDERERS\s*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  for (const match of rendererBlock.matchAll(/^\s*([A-Za-z][A-Za-z0-9_-]*):/gm)) names.add(match[1]);
  const includesList = source.match(/hasBuiltInTemplate[\s\S]{0,300}?\[([^\]]+)\]\.includes/)?.[1] ?? '';
  for (const match of includesList.matchAll(/['"]([^'"]+)['"]/g)) names.add(match[1]);
  return [...names];
}

async function componentMetadata(componentRoot) {
  const file = path.join(componentRoot, 'meta.mjs');
  if (!(await fileExists(file))) return null;
  const module = await import(`${pathToFileURL(file).href}?studio=${revision}`);
  return module.default ?? null;
}

function metadataInputProperties(metadata) {
  const result = {};
  for (const [name, attribute] of Object.entries(metadata?.attributes ?? {})) {
    const type = attribute.kind === 'boolean' ? 'boolean' : attribute.valueType ?? 'string';
    const property = {type};
    let defaultValue = attribute.default;
    if (type === 'boolean' && typeof defaultValue === 'string') defaultValue = defaultValue === 'true';
    if (defaultValue !== undefined) property.default = defaultValue;
    if (attribute.description) property.description = attribute.description;
    if (attribute.kind === 'enum') {
      property.enum = [...new Set([
        ...(defaultValue === '' ? [''] : []),
        ...(attribute.values ?? []),
      ])];
    }
    if (Array.isArray(attribute.examples) && attribute.examples.length) property.examples = [...new Set(attribute.examples)];
    result[name] = property;
  }
  return result;
}

// A manifest holds generated and authored parts. What the source's props say
// fills what the manifest does not say yet; it does not overwrite what the
// manifest says -- a default the browser probe holds against the running
// component (tests/browser/manifest-defaults.browser.mjs), a description
// written for people, an input the component reads without declaring it as a
// prop (sf-sortable's attributes, sf-context-menu's search property). meta.mjs
// is written for the purpose and wins over both. Inputs only the manifest
// names are kept, in the manifest's order.
function mergedInputProperties(source, existing = {}, metadata = null, componentJson = null) {
  const inferred = {...componentJsonProperties(componentJson), ...inputProperties(source, {spreadsManifest: Boolean(componentJson)})};
  const described = metadataInputProperties(metadata);
  const names = [...new Set([...Object.keys(existing), ...Object.keys(inferred), ...Object.keys(described)])];
  const result = {};
  for (const name of names) {
    const merged = {...(existing[name] ?? {})};
    for (const [field, value] of Object.entries(inferred[name] ?? {})) {
      if (!(field in merged)) merged[field] = value;
    }
    result[name] = Object.assign(merged, described[name] ?? {});
  }
  return result;
}

function events(source) {
  const names = new Set();
  for (const match of source.matchAll(/new CustomEvent\(\s*['"]([^'"]+)['"]/g)) names.add(match[1]);
  for (const match of source.matchAll(/emitComponentEvent\(\s*['"]([^'"]+)['"]/g)) names.add(`sf-${match[1]}`);
  return Object.fromEntries([...names].sort().map((name) => [name, {summary: `Runtime event ${name}.`, payload: {type: 'object'}}]));
}

function methods(source) {
  const result = {};
  const reserved = new Set(['constructor', 'template', 'templateContext', 'beforeRender', 'afterRender', 'afterUpdate', 'onConnected', 'onDisconnected', 'updateDom', 'resolveUpdateMode']);
  for (const match of source.matchAll(/^\s{2,4}(async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*\{/gm)) {
    const name = match[2];
    if (reserved.has(name) || name.startsWith('_') || (!/^(set|get|open|close|toggle|show|hide|next|prev|goTo|refresh|reset|clear|on[A-Z])/.test(name))) continue;
    result[name] ??= {summary: `Public runtime method ${name}.`, arguments: [], returns: {type: ['object', 'boolean', 'null']}};
  }
  return result;
}

async function runtimeArtifact(name) {
  const file = path.join(generatedRuntimeRoot, 'smart', name, 'js', `${name}.js`);
  if (!(await fileExists(file))) return [];
  return [{repository: 'simai/ui-smart', revision: smartRevision, path: `smart/${name}/js/${name}.js`, sha256: hash(await readFile(file))}];
}

const directories = (await readdir(path.join(root, 'src/smart'), {withFileTypes: true}))
  .filter((entry) => entry.isDirectory() && !serviceDirectories.has(entry.name) && (componentFilter === '' || entry.name === componentFilter))
  .sort((left, right) => left.name.localeCompare(right.name));
if (componentFilter !== '' && directories.length === 0) {
  throw new Error(`Unknown component filter: ${componentFilter}`);
}
const changes = [];

for (const {name} of directories) {
  const componentRoot = path.join(root, 'src/smart', name);
  const manifestFile = path.join(componentRoot, 'smart.manifest.json');
  const sourceFile = path.join(componentRoot, 'index.js');
  const source = await readFile(sourceFile, 'utf8');
  const metadata = await componentMetadata(componentRoot);
  if (await fileExists(manifestFile)) {
    if (!refreshMetadata && !verify) continue;
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    if (manifest.schema_version !== 2) continue;
    const componentJsonFile = path.join(componentRoot, 'component.json');
    const componentJson = await fileExists(componentJsonFile) ? JSON.parse(await readFile(componentJsonFile, 'utf8')) : null;
    manifest.inputs.properties = mergedInputProperties(source, manifest.inputs?.properties, metadata, componentJson);
    manifest.templates = templateNames(source);
    openTemplateInput(manifest);
    const content = `${JSON.stringify(manifest, null, 2)}\n`;
    if (content !== await readFile(manifestFile, 'utf8')) {
      changes.push(path.relative(root, manifestFile));
      if (write) await writeFile(manifestFile, content);
    }
    const fixtureFile = path.join(componentRoot, 'studio.fixture.json');
    if (await fileExists(fixtureFile)) {
      const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
      fixture.props = samples[name] ?? fixture.props;
      fixture.children = childSamples[name] ?? fixture.children;
      const fixtureContent = `${JSON.stringify(fixture, null, 2)}\n`;
      if (fixtureContent !== await readFile(fixtureFile, 'utf8')) {
        changes.push(path.relative(root, fixtureFile));
        if (write) await writeFile(fixtureFile, fixtureContent);
      }
    }
    continue;
  }
  let customElement = source.match(/\.define\(\s*['"]([^'"]+)['"]\s*\)/)?.[1];
  if (!customElement) {
    const constantName = source.match(/\.define\(\s*([A-Z][A-Z0-9_]*)\s*\)/)?.[1];
    if (constantName) customElement = source.match(new RegExp(`(?:const|let|var)\\s+${constantName}\\s*=\\s*['"]([^'"]+)['"]`))?.[1];
  }
  if (!customElement) throw new Error(`Cannot discover custom element for ${name}`);
  const id = `smart.${name}`;
  const componentTitle = title(name);
  const fixtureFile = path.join(componentRoot, 'studio.fixture.json');
  const scenarioFile = path.join(componentRoot, 'studio.scenario.json');
  const props = samples[name] ?? {};
  const manifest = {
    schema_version: 2, id, version: '1.0.0', title: componentTitle,
    summary: `${componentTitle} Smart Component from SIMAI Framework.`,
    kind: 'smart', reuse_mode: 'whole', lifecycle: 'experimental', tags: [name], capabilities: ['render', 'theme', 'responsive'], custom_element: customElement,
    templates: templateNames(source), exported_parts: [], composition: {uses: [], public_parts: []},
    inputs: {type: 'object', properties: mergedInputProperties(source, {}, metadata), additionalProperties: false},
    item_contract: {}, contracts: {}, methods: methods(source), events: events(source),
    state: {machines: {}, visual_states: ['default', ...('disabled' in props ? ['disabled'] : []), ...('open' in props ? ['open', 'closed'] : [])]},
    persistence: {mode: 'none', source_of_truth: 'component', network_owner: 'none', revision_field: null},
    ownership: {source: 'simai/ui-source', data: 'fixture', effects: 'component', forbidden_client_responsibilities: ['backend access decisions', 'host route invention']},
    security: {permissions_owner: 'none', untrusted_inputs: ['props', 'children'], network_policy: 'deny'},
    accessibility: {role: null, accessible_name: 'recommended', keyboard: ['Tab'], focus: 'Keep visible focus on the active control.'},
    presentation: {themes: ['light', 'dark'], locales: ['ru', 'en'], responsive: ['desktop', 'mobile']},
    adapter: {kind: 'generic', protocol: 'simai.smart-studio-adapter.v1', module: null},
    artifacts: {fixtures: ['studio.fixture.json'], scenarios: ['studio.scenario.json']},
    readiness: {level: 'described', required_checks: ['manifest', 'fixture', 'runtime-upgrade', 'scenario-smoke']},
    compatibility: {contract_schema: {id: 'https://simai.io/contracts/smart-component-manifest.v2.schema.json', version: 2}, runtime_pair: {ui_revision: uiRevision, ui_smart_revision: smartRevision}, aliases: [], deprecations: [], replacement: null, migrations: []},
    provenance: {source_repository: 'simai/ui-source', source_revision: revision, source_artifacts: [{path: `src/smart/${name}/index.js`, sha256: hash(source)}], generated_runtime: await runtimeArtifact(name)},
    ai_guidance: {use_when: `Use ${customElement} when the interface needs the ${componentTitle.toLowerCase()} behavior.`, do_not: ['Do not copy generated ui-smart code', 'Do not move host data or access decisions into the component'], required_reads: ['inputs', 'methods', 'events', 'ownership', 'provenance'], minimal_example: `<${customElement}></${customElement}>`, owner_commands: ['npm run contract:verify', 'npm test']}
  };
  openTemplateInput(manifest);
  const fixture = {schema: 'simai.smart-component-fixture.v2', id: 'reference', component: id, title: `${componentTitle} reference`, summary: `Deterministic reference fixture for ${customElement}.`, locale: 'ru', props, children: childSamples[name] ?? [], state: 'default'};
  const scenario = {schema: 'simai.smart-component-scenario.v1', id: 'smoke', component: id, fixture: 'reference', viewport: 'desktop', actions: [], assertions: [{type: 'upgraded'}, {type: 'visible'}, {type: 'no-console-error'}, {type: 'no-network'}]};
  for (const [file, value] of [[manifestFile, manifest], [fixtureFile, fixture], [scenarioFile, scenario]]) {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    changes.push(path.relative(root, file));
    if (write) { await mkdir(path.dirname(file), {recursive: true}); await writeFile(file, content); }
  }
}

process.stdout.write(`${write ? 'WROTE' : 'WOULD_WRITE'} ${changes.length} Studio artifacts\n`);
for (const file of changes) process.stdout.write(`${file}\n`);
if (verify && changes.length) process.exitCode = 1;
