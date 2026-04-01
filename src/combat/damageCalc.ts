import { DamageType, ArmorClass } from '../constants';

/**
 * Returns the damage multiplier for an attack based on damage type and target armor class.
 *
 * Multiplier table (matches StarCraft 2 BW hybrid model):
 * - Normal:     Light=1.0, Armored=1.0
 * - Concussive: Light=1.0, Armored=0.5
 * - Explosive:  Light=0.5, Armored=1.0
 */
export function getDamageMultiplier(dmgType: DamageType, armorCls: ArmorClass): number {
  switch (dmgType) {
    case DamageType.Concussive:
      return armorCls === ArmorClass.Armored ? 0.5 : 1.0;
    case DamageType.Explosive:
      return armorCls === ArmorClass.Light ? 0.5 : 1.0;
    case DamageType.Normal:
    default:
      return 1.0;
  }
}
