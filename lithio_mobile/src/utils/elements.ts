/**
 * elements.ts — Nivel por elemento químico
 *
 * El backend calcula el elemento según el Fe histórico; aquí se arma la
 * configuración electrónica (p. ej. Litio = 1s² 2s¹) para mostrarla.
 */

export interface Level {
  z: number;
  symbol: string;
  name: string;
  fe_lifetime: number;
  current_threshold: number;
  next_threshold: number | null;
  next_symbol: string | null;
  next_name: string | null;
  perk?: string | null;
  next_perk?: { z: number; symbol: string; name: string; perk: string; threshold: number } | null;
}

export interface LevelElement {
  z: number;
  symbol: string;
  name: string;
  threshold: number;
  perk: string | null;
  unlocked: boolean;
  current: boolean;
}

/** Electrones por capa (modelo de Bohr simplificado: 2, 8, 8, 18). */
export function shells(z: number): number[] {
  const capacities = [2, 8, 8, 18];
  const result: number[] = [];
  let remaining = z;
  for (const capacity of capacities) {
    if (remaining <= 0) break;
    result.push(Math.min(capacity, remaining));
    remaining -= capacity;
  }
  return result;
}

// Orden de llenado de orbitales (regla de Madelung) y su capacidad.
const ORBITALS: [string, number][] = [
  ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6],
];
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const toSuperscript = (n: number) => String(n).split('').map((d) => SUPERSCRIPT[Number(d)]).join('');

export function electronConfiguration(z: number): string {
  let remaining = z;
  const parts: string[] = [];
  for (const [orbital, capacity] of ORBITALS) {
    if (remaining <= 0) break;
    const electrons = Math.min(capacity, remaining);
    parts.push(`${orbital}${toSuperscript(electrons)}`);
    remaining -= electrons;
  }
  return parts.join(' ');
}

/** Progreso de 0 a 1 hacia el siguiente elemento. */
export function levelProgress(level: Level): number {
  if (!level.next_threshold) return 1;
  const span = level.next_threshold - level.current_threshold;
  return Math.min(1, Math.max(0, (level.fe_lifetime - level.current_threshold) / span));
}

export const FALLBACK_LEVEL: Level = {
  z: 1,
  symbol: 'H',
  name: 'Hidrógeno',
  fe_lifetime: 0,
  current_threshold: 0,
  next_threshold: 50,
  next_symbol: 'He',
  next_name: 'Helio',
};
