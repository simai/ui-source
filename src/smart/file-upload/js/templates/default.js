import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {ladderSize} from '../../../../component/field-size';
import {renderFieldHelp} from '../../../helpers/field-help';
import {describeUploadItem} from '../../../../component/file-upload/js/_file_upload';

function normalizeSize(value) {
    return ladderSize(value);
}

// A row is the family's file row, sf-file-preview (owner decisions C81 and
// C149): one row height with sf-file-preview, sf-file-download and the image
// field; the picture of a photo (the chosen file itself, or the host's
// imageUrl) and the type's glyph and word for anything else. The upload
// states map onto the row's: a chosen file and a sent one are there (ready;
// a sent one with its address is a link), a file on its way is uploading with
// the bar, a failed one is error with its reason and «Повторить». Remove is
// «×» «Убрать <имя>» at once, given back by «Вернуть» (C25, C149 (8)); a
// stored file the host marks stored is the trash «Удалить <имя>», asked first.
const PREVIEW_STATES = Object.freeze({ready: 'ready', done: 'ready', process: 'uploading', error: 'error'});

function renderUploadItem(item, index, context) {
    const owner = context.component;
    const row = describeUploadItem(item, owner, 'process');
    const {state} = row;
    const bytes = Number(item?.file?.size ?? item?.size);
    const fileSize = Number.isFinite(bytes) && (item?.file || (item?.size !== undefined && item?.size !== null && item?.size !== ''))
        ? String(bytes)
        : row.size;
    const mime = String(item?.file?.type || item?.mime || '');
    const href = state === 'done' && item?.href ? String(item.href) : '';
    const picture = owner?.pictureOf?.(item) || '';

    return html`
        <div class="sf-file-upload-item" role="listitem" data-index=${String(index)}>
            <sf-file-preview
                    file-name=${row.name}
                    file-size=${fileSize || nothing}
                    mime-type=${mime || nothing}
                    image-url=${picture || nothing}
                    href=${href || nothing}
                    state=${PREVIEW_STATES[state] || 'ready'}
                    value=${state === 'process' && row.progress !== null ? String(row.progress) : nothing}
                    error-text=${state === 'error' && row.message ? row.message : nothing}
                    download-action=${href ? 'true' : 'false'}
                    data-said-by="host"
                    ?stored=${item?.stored === true}
                    ?disabled=${context.disabled}
                    @sf-file-preview-detach=${(event) => owner?.handleRowDetach?.(event, index)}
                    @sf-file-preview-retry=${(event) => owner?.handleRowRetry?.(event, index)}
            ></sf-file-preview>
        </div>
    `;
}

export function renderFileUploadTemplate(context) {
    const size = normalizeSize(context.size);
    const rootClasses = [
        'sf-file-upload',
        `sf-file-upload--size-${size}`,
        context.disabled ? 'disabled' : '',
        'flex',
        'flex-col',
        'items-cross-center',
        'cursor-pointer',
        context.rootClass,
    ].filter(Boolean);

    const featuredIconClasses = [
        'sf-featured-icon',
        `sf-featured-icon--size-${size}`,
        'sf-featured-icon--soft',
        'sf-featured-icon--circle',
        'sf-featured-icon--neutral',
    ].join(' ');

    // The label above the area, as every field of the family has it (C153 (1),
    // (2), (8)): the text ink a step below the area's text, the required «*»
    // in its ink, the «?» of help after them (helpers/field-help.js). It
    // names the area unless the page gave the area an aria-label.
    const label = context.label
        ? html`<span class=${`sf-file-upload-label sf-file-upload-label--size-${size}`} id=${context.labelId}>
              <span class="sf-file-upload-label-text">${context.label}</span>
              ${context.required ? html`<span class="sf-file-upload-required" aria-hidden="true">*</span>` : nothing}
              ${renderFieldHelp({help: context.help, label: context.label, size, className: 'sf-file-upload-help', component: context.component})}
          </span>`
        : nothing;
    const labelledBy = context.label && !context.ariaLabel ? context.labelId : '';

    return html`
        ${label}
        <div
                class=${rootClasses.join(' ')}
                style=${context.rootStyle || nothing}
                data-render-managed="1"
                data-accept=${context.accept || nothing}
                data-multiple=${context.multiple ? 'true' : 'false'}
                data-max-size=${context.maxSize > 0 ? String(context.maxSize) : nothing}
                data-min-size=${context.minSize > 0 ? String(context.minSize) : nothing}
                data-max-files=${context.maxFiles > 0 ? String(context.maxFiles) : nothing}
                data-max-total-size=${context.maxTotalSize > 0 ? String(context.maxTotalSize) : nothing}
                ?multiple=${context.multiple}
                ?disabled=${context.disabled}
                aria-label=${context.ariaLabel || nothing}
                aria-labelledby=${labelledBy || nothing}
        >
            <div class=${featuredIconClasses}>
                <i class="sf-icon" aria-hidden="true">${context.icon}</i>
            </div>

            <div class="sf-file-upload-bottom flex flex-col items-cross-center">
                <div class="sf-file-upload-block flex">
                    <div class="sf-file-upload-block-text">
                        <span class="sf-file-upload-link">${context.linkText}</span>
                        ${context.text ? html` <span class="sf-file-upload-drag">${context.text}</span>` : nothing}
                    </div>
                </div>

                ${context.supportingText
                        ? html`<span class="sf-file-upload-text">${context.supportingText}</span>`
                        : nothing}
            </div>
        </div>

        <div class="sf-file-upload-message" role="status" hidden></div>

        <div class="sf-file-upload-status" role="status" aria-atomic="true"></div>

        <div class="sf-file-upload-files grid grid-col-1 gap-1/2 w-full" role="list">
            ${Array.isArray(context.items)
                    ? repeat(context.items, (item, index) => context.keyOf(item, index), (item, index) => renderUploadItem(item, index, context))
                    : nothing}
        </div>
    `;
}
