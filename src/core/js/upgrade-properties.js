// A property set on an element before its class was defined lands on the
// element itself, as a plain value. Once the class arrives, that own value
// hides the class's setter: every later assignment changes the plain value and
// the component never hears of it. A template that binds `.profiles` to a child
// registered lazily therefore drew an empty sf-profile-picker inside
// sf-property-view (simai.main, 2026-10-28). Each such value is taken off the
// element and assigned again, so it reaches the setter.
export function upgradeOwnProperties(element) {
  for (const name of Object.keys(element)) {
    let proto = Object.getPrototypeOf(element);
    let setter = null;
    while (proto && proto !== Object.prototype && !setter) {
      setter = Object.getOwnPropertyDescriptor(proto, name)?.set ?? null;
      proto = Object.getPrototypeOf(proto);
    }
    if (!setter) continue;
    const value = element[name];
    delete element[name];
    element[name] = value;
  }
}
