// Conformance case sources for editor field kinds. Each submission case gives
// the exact raw form value (null means the control sent nothing) and states
// only whether it must be accepted; the generator records exact results.
import { BUILTIN_EDITOR_MANIFESTS } from '../../../../src/core/js/composition/builtins.mjs';

const field = (type, key) => BUILTIN_EDITOR_MANIFESTS.find((manifest) => manifest.type === type).fields.find((entry) => entry.key === key);
const region = { id: 'side', type: 'layout.region', props: { name: 'aside', landmark: 'complementary', label: 'Боковая', placement: 'end' }, slots: { default: [] } };

const nul = String.fromCharCode(0);
const loneSurrogate = String.fromCharCode(0xd800);

export const FIELD_MESSAGES = {
  'sf.composition.layout_region.placement': 'Расположение области',
  'sf.composition.layout_region.placement_help': 'Боковые области стоят рядом с основной на широком экране.',
  'sf.composition.layout_region.placement.block': 'Во всю ширину',
  'sf.composition.layout_region.placement.start': 'В начале строки',
  'sf.composition.layout_region.placement.center': 'В центре',
  'sf.composition.layout_region.placement.end': 'В конце строки',
  'sf.composition.layout_region.label': 'Доступное название',
  'sf.composition.layout_region.label_help': 'Название объявляется программами экранного доступа.',
  'sf.composition.layout_region.landmark': 'Смысловая роль',
  'sf.composition.layout_region.landmark_help': 'Определяет ориентир страницы для навигации.',
  'sf.composition.layout_region.landmark.banner': 'Шапка сайта',
  'sf.composition.layout_region.landmark.navigation': 'Навигация',
  'sf.composition.layout_region.landmark.main': 'Основное содержимое',
  'sf.composition.layout_region.landmark.complementary': 'Дополнительное содержимое',
  'sf.composition.layout_region.landmark.contentinfo': 'Подвал сайта',
  'sf.composition.layout_region.landmark.region': 'Именованная область',
  'sf.composition.layout_region.landmark.none': 'Без ориентира',
  'sf.composition.layout_region.sticky': 'Закрепить при прокрутке',
  'sf.composition.layout_region.sticky_help': 'Область остаётся видимой при прокрутке содержимого.',
};

export const FIELD_SUBMISSION_CASES = [
  { id: 'toggle.checked', field: field('layout.region', 'sticky'), raw: 'true', expect: 'accepted' },
  { id: 'toggle.absent-removes-key', field: field('layout.region', 'sticky'), raw: null, expect: 'accepted', node: { ...region, props: { ...region.props, sticky: true } } },
  { id: 'toggle.rejects-on', field: field('layout.region', 'sticky'), raw: 'on', expect: 'rejected' },
  { id: 'toggle.rejects-false-text', field: field('layout.region', 'sticky'), raw: 'false', expect: 'rejected' },
  { id: 'text.exact-unicode', field: field('layout.region', 'label'), raw: 'Связанные материалы — ☕', expect: 'accepted' },
  { id: 'text.keeps-spaces', field: field('layout.region', 'label'), raw: '  Отступы  ', expect: 'accepted' },
  { id: 'text.empty-unsets', field: field('layout.region', 'label'), raw: '', expect: 'accepted' },
  { id: 'text.max-code-points', field: field('layout.region', 'label'), raw: '😀'.repeat(120), expect: 'accepted' },
  { id: 'text.too-long', field: field('layout.region', 'label'), raw: 'a'.repeat(121), expect: 'rejected' },
  { id: 'text.control-character', field: field('layout.region', 'label'), raw: `a${nul}b`, expect: 'rejected' },
  { id: 'text.line-break', field: field('layout.region', 'label'), raw: 'a\nb', expect: 'rejected' },
  { id: 'text.lone-surrogate', field: field('layout.region', 'label'), raw: `a${loneSurrogate}`, expect: 'rejected' },
  { id: 'choice.member', field: field('layout.region', 'placement'), raw: 'start', expect: 'accepted' },
  { id: 'choice.case-sensitive', field: field('layout.region', 'placement'), raw: 'Start', expect: 'rejected' },
  { id: 'choice.unknown', field: field('layout.region', 'landmark'), raw: 'hero', expect: 'rejected' },
  { id: 'choice.empty-unsets', field: field('layout.region', 'placement'), raw: '', expect: 'accepted' },
  { id: 'integer.in-range', field: field('layout.columns', 'columns'), raw: '12', expect: 'accepted' },
  { id: 'integer.out-of-range', field: field('layout.columns', 'columns'), raw: '13', expect: 'rejected' },
  { id: 'integer.decimal-text', field: field('layout.columns', 'columns'), raw: '2.0', expect: 'rejected' },
  { id: 'integer.leading-zero', field: field('layout.columns', 'columns'), raw: '02', expect: 'rejected' },
  { id: 'integer.signed-space', field: field('content.heading', 'level'), raw: ' 3', expect: 'rejected' },
  { id: 'integer.empty-unsets', field: field('content.heading', 'level'), raw: '', expect: 'accepted' },
];

export const FIELD_MANIFEST_CASES = [
  { id: 'manifest.region-fields', expect: 'valid', manifest: BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === 'layout.region') },
  ...['layout.section', 'layout.columns', 'content.heading'].map((type) => ({ id: `manifest.existing.${type}`, expect: 'valid', manifest: BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === type) })),
  { id: 'manifest.toggle-default-true', expect: 'invalid', mutate: (manifest) => { manifest.fields[3].default = true; } },
  { id: 'manifest.toggle-with-choices', expect: 'invalid', mutate: (manifest) => { manifest.fields[3].choices = [true, false]; } },
  { id: 'manifest.text-without-max-length', expect: 'invalid', mutate: (manifest) => { delete manifest.fields[1].constraints.max_length; } },
  { id: 'manifest.text-unknown-constraint', expect: 'invalid', mutate: (manifest) => { manifest.fields[1].constraints.pattern = '^.+$'; } },
  { id: 'manifest.choice-default-outside', expect: 'invalid', mutate: (manifest) => { manifest.fields[0].default = 'middle'; } },
  { id: 'manifest.unknown-property-identity', expect: 'invalid', mutate: (manifest) => { manifest.fields[3].property = { type: 'boolean', version: 2 }; } },
  { id: 'manifest.text-with-old-string-version', expect: 'invalid', mutate: (manifest) => { manifest.fields[1].property = { type: 'string', version: 1 }; } },
  { id: 'manifest.choice-longer-than-max-length', expect: 'invalid', mutate: (manifest) => { manifest.fields[0].constraints.max_length = 4; } },
  { id: 'manifest.text-inverted-length', expect: 'invalid', mutate: (manifest) => { manifest.fields[1].constraints.min_length = 50; manifest.fields[1].constraints.max_length = 10; } },
];

export const FIELD_FALLBACK_CASES = [
  { id: 'fallback.region', instance: 'side', node: region, type: 'layout.region' },
  { id: 'fallback.region-sticky-rtl-label', instance: 'nav-main', node: { ...region, id: 'nav-main', props: { name: 'nav', landmark: 'navigation', label: 'قائمة "رئيسية"', placement: 'start', sticky: true } }, type: 'layout.region' },
  { id: 'fallback.missing-translations', instance: 'bare', node: region, type: 'layout.region', messages: {} },
  { id: 'fallback.hidden-field-omitted', instance: 'quiet', node: region, type: 'layout.region', hide: 'sticky' },
  { id: 'fallback.existing-heading', instance: 'title', node: { id: 'title', type: 'content.heading', data: { level: 3, content: [] } }, type: 'content.heading' },
];

export default FIELD_SUBMISSION_CASES;
