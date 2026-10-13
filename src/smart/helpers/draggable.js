import {setLoaderDragState} from "./loaderDragState";

export function getVerticalDragItemsLayout(container, options = {}) {
    const accept =
        typeof options.accept === "function" ? options.accept : () => true;

    return Array.from(container?.children || [])
        .filter(
            (item) =>
                item instanceof HTMLElement &&
                !item.classList.contains("is-dragging") &&
                !item.classList.contains("drag-placeholder") &&
                accept(item),
        )
        .map((item) => {
            const box = item.getBoundingClientRect();

            return {
                item,
                top: box.top,
                height: box.height,
                middle: box.top + box.height / 2,
            };
        });
}

export function getVerticalDragAfterElement(container, y, options = {}) {
    const itemsLayout = Array.isArray(options.itemsLayout)
        ? options.itemsLayout
        : getVerticalDragItemsLayout(container, options);

    let closest = {
        offset: Number.NEGATIVE_INFINITY,
        element: null,
    };

    for (const layout of itemsLayout) {
        const offset = y - layout.middle;

        if (offset < 0 && offset > closest.offset) {
            closest = {
                offset,
                element: layout.item,
            };
        }
    }

    return closest.element;
}

export function bindSortableDrag(options = {}) {
    const {
        handle,
        item,
        container,
        holdDelay = 0,
        boundAttr = "data-sf-sortable-drag-bound",
        draggingClass = "is-dragging",
        placeholderClass = "drag-placeholder",
        placeholderExtraClasses = [],
        shouldIgnorePointerDown,
        getAfterElement,
        getSortableItems,
        insertPlaceholder,
        onDragStart,
        onDrop,
        onCancel,
        dragContainer,
        minSortableItems = 2,
    } = options;

    if (!handle || !item || !container) return null;
    if (handle.getAttribute(boundAttr) === "1") return null;
    handle.setAttribute(boundAttr, "1");

    let isDragging = false;
    let holdTimer = null;
    let suppressClick = false;

    let shiftX = 0;
    let shiftY = 0;
    let startRect = null;
    let containerRect = null;
    let itemsLayout = [];
    let lastAfterElement = undefined;
    let placeholder = null;
    let originalParent = null;
    let originalNextSibling = null;

    const clearHoldTimer = () => {
        if (!holdTimer) return;
        clearTimeout(holdTimer);
        holdTimer = null;
    };

    const getCurrentSortableItems = () => {
        if (typeof getSortableItems === "function") {
            const items = getSortableItems(container, item);
            return Array.isArray(items) ? items : Array.from(items || []);
        }

        return getVerticalDragItemsLayout(container, {
            accept:
                typeof getAfterElement === "function"
                    ? () => true
                    : undefined,
        }).map((layout) => layout.item);
    };

    const resetItemStyle = () => {
        Object.assign(item.style, {
            position: "",
            left: "",
            top: "",
            width: "",
            zIndex: "",
            pointerEvents: "",
            boxSizing: "",
            backgroundColor: "",
        });
    };

    const movePlaceholder = (event) => {
        const afterElement =
            typeof getAfterElement === "function"
                ? getAfterElement(container, event.clientY, event, itemsLayout)
                : getVerticalDragAfterElement(container, event.clientY, {
                      itemsLayout,
                  });

        if (afterElement === lastAfterElement) {
            return;
        }

        lastAfterElement = afterElement;

        if (typeof insertPlaceholder === "function") {
            insertPlaceholder(container, placeholder, afterElement, event);
            return;
        }

        if (!afterElement) {
            if (placeholder.parentNode === container && !placeholder.nextSibling) {
                return;
            }

            container.appendChild(placeholder);
        } else {
            if (placeholder.nextSibling === afterElement) {
                return;
            }

            container.insertBefore(placeholder, afterElement);
        }
    };

    const startDrag = (event) => {
        if (isDragging) return;
        event.preventDefault?.();

        if (Number(minSortableItems) > 1) {
            const sortableItems = getCurrentSortableItems().filter(
                (sortableItem) =>
                    sortableItem instanceof HTMLElement &&
                    !sortableItem.classList.contains(draggingClass) &&
                    !sortableItem.classList.contains(placeholderClass),
            );

            if (sortableItems.length < Number(minSortableItems)) {
                return;
            }
        }

        isDragging = true;
        suppressClick = true;
        setLoaderDragState(true);
        startRect = item.getBoundingClientRect();
        containerRect = container.getBoundingClientRect();
        shiftX = event.clientX - startRect.left;
        shiftY = event.clientY - startRect.top;

        placeholder = document.createElement(item.nodeName.toLowerCase());
        placeholder.className = placeholderClass;
        placeholder.style.width = `${startRect.width}px`;
        placeholder.style.minHeight = `${startRect.height}px`;
        placeholder.classList.add(...placeholderExtraClasses, ...item.classList);

        originalParent = item.parentNode;
        originalNextSibling = item.nextSibling;
        item.before(placeholder);
        (dragContainer || document.body).appendChild(item);

        item.classList.add(draggingClass);
        const styles = {
            position: "fixed",
            left: `${startRect.left}px`,
            top: `${startRect.top}px`,
            width: `${startRect.width}px`,
            zIndex: "9999",
            pointerEvents: "none",
            boxSizing: "border-box",
        }
        if(!item.style.backgroundColor) {
            styles.backgroundColor = 'var(--sf-primary-container)';
        }
        Object.assign(item.style, styles);



        itemsLayout = getVerticalDragItemsLayout(container, {
            accept:
                typeof getAfterElement === "function"
                    ? () => true
                    : undefined,
        });
        lastAfterElement = undefined;

        handle.setPointerCapture?.(event.pointerId);
        onDragStart?.({event, item, container, placeholder});

        document.addEventListener("pointermove", onPointerMove);
    };

    const onPointerMove = (event) => {
        if (!isDragging) {
            return;
        }

        let left = event.clientX - shiftX;
        let top = event.clientY - shiftY;

        left = Math.max(containerRect.left, left);
        top = Math.max(containerRect.top, top);

        left = Math.min(containerRect.right - startRect.width, left);
        top = Math.min(containerRect.bottom - startRect.height, top);

        item.style.left = `${left}px`;
        item.style.top = `${top}px`;

        movePlaceholder(event);
    };

    const onPointerUp = (event) => {
        clearHoldTimer();
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointercancel", onPointerCancel);

        if (!isDragging) {
            return;
        }

        isDragging = false;
        setLoaderDragState(false);
        handle.releasePointerCapture?.(event.pointerId);

        if (placeholder?.parentNode) {
            placeholder.replaceWith(item);
        }

        item.classList.remove(draggingClass);
        resetItemStyle();

        const dropPlaceholder = placeholder;
        placeholder = null;
        startRect = null;
        containerRect = null;
        itemsLayout = [];
        lastAfterElement = undefined;
        originalParent = null;
        originalNextSibling = null;

        onDrop?.({event, item, container, placeholder: dropPlaceholder});
    };

    const onPointerCancel = () => {
        clearHoldTimer();
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);

        if (!isDragging) {
            return;
        }

        isDragging = false;
        setLoaderDragState(false);
        if (originalParent) {
            originalParent.insertBefore(item, originalNextSibling);
        }
        placeholder?.remove();
        item.classList.remove(draggingClass);
        resetItemStyle();

        const cancelPlaceholder = placeholder;
        placeholder = null;
        startRect = null;
        containerRect = null;
        itemsLayout = [];
        lastAfterElement = undefined;
        originalParent = null;
        originalNextSibling = null;

        onCancel?.({item, container, placeholder: cancelPlaceholder});
    };

    const onPointerDown = (event) => {
        if (event.button !== 0) return;
        if (shouldIgnorePointerDown?.(event)) return;
        clearHoldTimer();

        if (holdDelay > 0) {
            holdTimer = setTimeout(() => {
                holdTimer = null;
                startDrag(event);
            }, holdDelay);
        } else {
            startDrag(event);
        }

        document.addEventListener("pointerup", onPointerUp, {once: true});
        document.addEventListener("pointercancel", onPointerCancel, {
            once: true,
        });
    };

    const onClick = (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("click", onClick, true);

    return () => {
        clearHoldTimer();
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerCancel);
        handle.removeEventListener("pointerdown", onPointerDown);
        handle.removeEventListener("click", onClick, true);
        handle.removeAttribute(boundAttr);
        setLoaderDragState(false);
    };
}
