// The closed list of key effects, standard simai.smart-component 1.3.15 §4.8:
// `accessibility.keys` maps each key to one of these. 1.3.15 took `activate`
// (a button-like row, card or step pressed) and `remove` (the last chosen
// entry taken out) into the list; every other word a manifest used was mapped
// to an effect the list already had. The one list every contract reads.
export const KEY_EFFECT = /^(reach|toggle:[a-z-]+|step:[+-](\d+|page)|to:(min|max|first|last)|focus:(next|prev|first|last)|open|close|commit|revert|select|activate|remove)$/u;

export function keyEffect(value) {
  return typeof value === 'string' ? value : value?.effect;
}

export function isKeyEffect(value) {
  const effect = keyEffect(value);
  return typeof effect === 'string' && KEY_EFFECT.test(effect);
}
