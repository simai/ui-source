export class ComponentObserver {
    // Components name themselves with a static field (static componentName =
    // 'Modal'), and the Loader writes the name on the prototype only when it
    // registers the class; the lifecycle events read the instance, so an
    // instance made before that announced itself as `undefined:render`. Not a
    // getter: the Loader assigns the prototype property, and an accessor
    // without a setter made that assignment throw.
    lifecycleName() {
        return this.componentName ?? this.constructor.componentName;
    }

    constructor(props) {

        this.props = props;
        this.id = props?.id
        this.params = props?.param;
        this.attrs = props?.attrs || {};
        this.template = null;
        window.dispatchEvent(new CustomEvent(`${this.lifecycleName()}:beforeRender`, { detail: this }));
    }

    getUtilityMap() {
        return this.constructor.utilityMap || null;
    }

    extractUtilityClasses(values) {
        if (!Array.isArray(values)) {
            return [];
        }
        const classes = new Set();
        values.forEach((value) => {
            if (typeof value !== 'string') {
                return;
            }
            const matches = value.match(/\(([^)]+)\)/g);
            if (!matches) {
                return;
            }
            matches.forEach((match) => {
                const raw = match.slice(1, -1);
                raw.split(/\s+/).filter(Boolean).forEach((cls) => {
                    // Only explicit (.class) annotations are classes; the
                    // parentheses in var(--token) are CSS values, not markup.
                    if (cls.startsWith('.') && cls.length > 1) classes.add(cls.slice(1));
                });
            });
        });
        return Array.from(classes);
    }

    applyLayoutUtilities(target, selector) {
        if (!target || !selector) {
            return;
        }
        const map = this.getUtilityMap();
        if (!map || !map[selector]) {
            return;
        }
        const classes = this.extractUtilityClasses(map[selector]);
        classes.forEach((cls) => target.classList.add(cls));
    }

    render() {
        this.html = this.template;
        if (typeof this.init === 'function') {
            this.init();
        }
        if (this.html) {
            window.dispatchEvent(new CustomEvent(`${this.lifecycleName()}:render`, { detail: this }));
        }
        return this.html

    }


    destroy() {
        this.destroyInternal?.();
        this.props = null;
        this.id = null
        this.params = null;
        this.template = null;
        if (this.html) {
            this.html.remove();
            this.html = null;
        }
        window.dispatchEvent(new CustomEvent(`${this.lifecycleName()}:destroy`, { detail: this }));
    }

    destroyInternal() {

    }

}
