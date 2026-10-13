const FILE_PREVIEW_KIND_VALUES = ["auto", "icon", "image"];

const sfFilePreviewMeta = {
  tag: 'sf-file-preview',
  source: 'src/smart/file-preview/meta.mjs',
  attributes: {
    kind: {
      kind: 'enum',
      values: FILE_PREVIEW_KIND_VALUES,
      default: 'auto',
      description: 'What the preview shows: an icon, the image itself, or whichever suits the file.',
    },
    type: {
      kind: 'enum',
      values: FILE_PREVIEW_KIND_VALUES,
      default: 'auto',
      description: 'Legacy name for kind, still honoured. See contracts/public-api-axes.json.',
    },
  },
};

export {FILE_PREVIEW_KIND_VALUES, sfFilePreviewMeta};

export default sfFilePreviewMeta;
