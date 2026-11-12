/**
 * text.ts — Formato de textos para mostrar (no cambia los datos guardados).
 */

// Siglas que siempre van en mayúsculas. CAMBIA AQUÍ si aparece una nueva.
const ACRONYMS = new Set(['UNC', 'IVIC', 'BCV', 'UCV', 'USB', 'UPEL', 'CNE', 'IUT', 'USD']);
// Palabras cortas que van en minúscula si no son la primera.
const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'a', 'al', 'en', 'e', 'o', 'por', 'con']);

/** "REDOMA DE SAN ANTONIO" → "Redoma de San Antonio"; "Campus UNC" se queda igual. */
export const placeName = (value?: string | null): string => {
  if (!value) return '';
  let first = true;
  return value.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (word) => {
    const upper = word.toUpperCase();
    const lower = word.toLowerCase();
    const isFirst = first;
    first = false;
    if (ACRONYMS.has(upper)) return upper;
    if (!isFirst && SMALL.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
};

/** Nombre de persona con mayúscula inicial: "maria perez" → "Maria Perez". */
export const personName = (value?: string | null): string =>
  (value ?? '').replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** plural(1, 'donante') → "1 donante"; plural(3, 'donante') → "3 donantes". */
export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;
