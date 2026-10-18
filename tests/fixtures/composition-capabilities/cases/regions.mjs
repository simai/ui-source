// Conformance case sources for declared-region layouts. Each case derives a
// Document from the shared base and states only the expected outcome class;
// the generator records exact diagnostics, digest and HTML.
const text = (id, value) => ({ id, type: 'content.paragraph', data: { content: [{ type: 'text', value }] } });
const region = (id, props, children = []) => ({ id, type: 'layout.region', props, slots: { default: children } });
const regions = (id, list) => ({ id, type: 'layout.regions', slots: { regions: list } });
const documentOf = (root, id = 'regions-case') => ({ schema: 'simai.composition.document', schema_version: 1, id, profile: 'ui-layout', root });

const shell = () => regions('shell', [
  region('r-header', { name: 'header', landmark: 'banner', sticky: true }, [text('t-header', 'Шапка')]),
  region('r-main', { name: 'main', landmark: 'main', placement: 'center', min_items: 1 }, [text('t-main', 'Основное')]),
  region('r-aside', { name: 'aside', landmark: 'complementary', placement: 'end', label: 'Боковая' }, [text('t-aside', 'Сбоку')]),
  region('r-footer', { name: 'footer', landmark: 'contentinfo' }, [text('t-footer', 'Подвал')]),
]);

const mutate = (update) => {
  const root = shell();
  update(root);
  return documentOf(root);
};

export const REGION_CASES = [
  { id: 'positive.four-regions', expect: 'valid', document: documentOf(shell()) },
  {
    id: 'positive.author-chosen-names',
    expect: 'valid',
    document: documentOf(regions('tool', [
      region('r-toolbar', { name: 'toolbar', landmark: 'none' }, [text('t-1', 'Панель')]),
      region('r-list', { name: 'records', landmark: 'region', label: 'Записи', placement: 'center' }, [text('t-2', 'Список')]),
      region('r-detail', { name: 'detail', landmark: 'region', label: 'Подробности', placement: 'end' }, [text('t-3', 'Карточка')]),
    ])),
  },
  {
    id: 'positive.only-main-region',
    expect: 'valid',
    document: documentOf(regions('single', [region('r-only', { name: 'content', landmark: 'main' }, [])])),
  },
  {
    id: 'positive.nested-layout-inside-main',
    expect: 'valid',
    document: mutate((root) => {
      root.slots.regions[1].slots.default.push(regions('inner', [
        region('i-a', { name: 'primary', landmark: 'region', label: 'Первичное', placement: 'center' }, [text('i-t1', 'А')]),
        region('i-b', { name: 'secondary', landmark: 'complementary', label: 'Вторичное', placement: 'end' }, [text('i-t2', 'Б')]),
      ]));
    }),
  },
  {
    id: 'positive.start-center-end-band',
    expect: 'valid',
    document: documentOf(regions('band', [
      region('b-start', { name: 'start', landmark: 'navigation', placement: 'start', label: 'Навигация' }, [text('b-1', '1')]),
      region('b-center', { name: 'center', landmark: 'main', placement: 'center' }, [text('b-2', '2')]),
      region('b-end', { name: 'end', landmark: 'complementary', placement: 'end', label: 'Дополнительно' }, [text('b-3', '3')]),
    ])),
  },
  {
    id: 'negative.unknown-slot',
    expect: 'invalid',
    document: mutate((root) => { root.slots.header = [text('x', 'x')]; }),
  },
  {
    id: 'negative.non-region-child',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions.push(text('x', 'x')); }),
  },
  {
    id: 'negative.region-outside-layout',
    expect: 'invalid',
    document: documentOf({ id: 'page', type: 'layout.section', slots: { default: [region('r', { name: 'lost', landmark: 'none' })] } }),
  },
  {
    id: 'negative.duplicate-name',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[2].props.name = 'main'; }),
  },
  {
    id: 'negative.invalid-name',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.name = 'Header'; }),
  },
  {
    id: 'negative.unknown-landmark',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.landmark = 'hero'; }),
  },
  {
    id: 'negative.unknown-prop',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.color = 'red'; }),
  },
  {
    id: 'negative.executable-prop',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.class = 'hero'; }),
  },
  {
    id: 'negative.second-main',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[2].props.landmark = 'main'; delete root.slots.regions[2].props.label; }),
  },
  {
    id: 'negative.banner-inside-landmark',
    expect: 'invalid',
    document: mutate((root) => {
      root.slots.regions[1].slots.default.push(regions('inner', [region('i-banner', { name: 'inner-header', landmark: 'banner' })]));
    }),
  },
  {
    id: 'negative.main-inside-page',
    expect: 'invalid',
    document: documentOf({ id: 'page', type: 'layout.page', slots: { default: [regions('inner', [region('i-main', { name: 'main', landmark: 'main' })])] } }),
  },
  {
    id: 'negative.region-landmark-without-label',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[2].props.landmark = 'region'; delete root.slots.regions[2].props.label; }),
  },
  {
    id: 'negative.two-unlabeled-region-landmarks',
    expect: 'invalid',
    document: documentOf(regions('pair', [region('p-a', { name: 'a', landmark: 'region' }), region('p-b', { name: 'b', landmark: 'region' })])),
  },
  {
    id: 'negative.none-landmark-with-label',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[2].props.landmark = 'none'; }),
  },
  {
    id: 'negative.repeated-landmark-same-label',
    expect: 'invalid',
    document: mutate((root) => {
      root.slots.regions.splice(3, 0, region('r-aside-2', { name: 'aside-two', landmark: 'complementary', placement: 'block', label: 'Боковая' }));
    }),
  },
  {
    id: 'negative.visual-order',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[1].props.placement = 'end'; root.slots.regions[2].props.placement = 'start'; }),
  },
  {
    id: 'negative.cardinality-min',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[1].slots.default = []; }),
  },
  {
    id: 'negative.cardinality-max',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.max_items = 0; }),
  },
  {
    id: 'negative.bounds-inverted',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.min_items = 3; root.slots.regions[0].props.max_items = 1; }),
  },
  {
    id: 'negative.category-not-accepted',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[0].props.accepts = ['smart']; }),
  },
  {
    id: 'negative.too-many-regions',
    expect: 'invalid',
    document: documentOf(regions('many', Array.from({ length: 13 }, (_, index) => region(`m-${index}`, { name: `area-${index}`, landmark: 'none' })))),
  },
  {
    id: 'negative.empty-layout',
    expect: 'invalid',
    document: documentOf(regions('empty', [])),
  },
  {
    id: 'negative.nesting-limit',
    expect: 'invalid',
    document: (() => {
      let inner = regions('n-5', [region('n-5-r', { name: 'deep', landmark: 'none' })]);
      for (let level = 4; level >= 1; level -= 1) inner = regions(`n-${level}`, [region(`n-${level}-r`, { name: 'deep', landmark: 'none' }, [inner])]);
      return documentOf(inner);
    })(),
  },
  {
    id: 'negative.unknown-type-in-region',
    expect: 'invalid',
    document: mutate((root) => { root.slots.regions[1].slots.default.push({ id: 'x', type: 'product.widget' }); }),
  },
  {
    id: 'negative.structured-content-profile',
    expect: 'invalid',
    document: { ...documentOf(shell()), profile: 'structured-content' },
  },
];

export default REGION_CASES;
