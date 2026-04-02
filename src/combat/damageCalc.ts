import { ArmorClass } from '../constants';

/**
 * SC2 damage model: base damage + bonus if target has matching armor tag.
 * No multiplier types — just additive bonus.
 */
export function getBonusDamage(bonusDamage: number, bonusTag: number, targetArmorClass: number): number {
  if (bonusDamage <= 0 || bonusTag < 0) return 0;
  return targetArmorClass === bonusTag ? bonusDamage : 0;
}
