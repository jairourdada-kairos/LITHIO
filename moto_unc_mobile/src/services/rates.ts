/**
 * rates.ts — Tasa BCV del día para mostrar precios en bolívares
 *
 * Se pide una vez por sesión (el backend la actualiza a diario) y todas las
 * pantallas comparten el mismo resultado.
 */

import { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';


export interface BcvRate {
  rate: number;
  date: string;
  source: 'dolarapi' | 'manual';
  is_current: boolean;
}

let cached: Promise<BcvRate | null> | null = null;

function loadRate(): Promise<BcvRate | null> {
  if (!cached) {
    cached = fetch(`${API_BASE}/api/rates/bcv`)
      .then((response) => (response.ok ? (response.json() as Promise<BcvRate>) : null))
      .catch(() => null)
      .then((rate) => {
        if (!rate) cached = null; // Reintenta la próxima vez
        return rate;
      });
  }
  return cached;
}

export function useBcvRate(): BcvRate | null {
  const [rate, setRate] = useState<BcvRate | null>(null);
  useEffect(() => {
    let alive = true;
    void loadRate().then((value) => alive && setRate(value));
    return () => {
      alive = false;
    };
  }, []);
  return rate;
}

const bsFormat = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Bs 2.654,25" o cadena vacía si aún no hay tasa. */
export function formatBs(usd: number, rate: BcvRate | null): string {
  return rate ? `Bs ${bsFormat.format(usd * rate.rate)}` : '';
}
