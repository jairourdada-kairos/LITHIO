/**
 * registrationOptions.ts — Listas del registro: universidades, carreras, instituciones y áreas
 *
 * La fuente de verdad es el backend (validation.py → GET /api/registration/options):
 * así se suma otra universidad sin publicar otra versión. La copia de abajo solo se
 * usa mientras llega la respuesta o si no hay conexión.
 */
import { API_BASE } from '../config/api';

export type Occupation = 'estudiante' | 'trabajador';

export interface RegistrationOptions {
  student: { institutions: string[]; careers: Record<string, string[]>; semesters: string[] };
  worker: { institutions: string[]; areas: Record<string, string[]> };
}

export const FALLBACK_OPTIONS: RegistrationOptions = {
  student: {
    institutions: ['UNC'],
    careers: {
      UNC: [
        'Ingeniería en Inteligencia Artificial',
        'Ingeniería en Ciberseguridad',
        'Ingeniería en Robótica y Automatización',
        'Ingeniería en Electromedicina',
        'Ingeniería en Biomateriales',
        'Ingeniería en Petroquímica',
        'Ingeniería Química',
        'Licenciatura en Ciencia de los Datos',
        'Licenciatura en Ciencias de la Computación',
        'Licenciatura en Nanotecnología',
        'Licenciatura en Biotecnología',
        'Licenciatura en Ciencia Molecular',
        'Licenciatura en Física Nuclear',
        'Licenciatura en Biología y Química Computacional',
        'Licenciatura en Oceanología',
        'Licenciatura en Física',
        'Licenciatura en Matemáticas',
        'Licenciatura en Filosofía',
      ],
    },
    semesters: [...Array.from({ length: 12 }, (_, index) => String(index + 1)), 'Egresado'],
  },
  worker: {
    institutions: ['UNC', 'IVIC'],
    areas: {
      UNC: ['Administración', 'Dirección', 'Docencia', 'Seguridad', 'Limpieza', 'Mantenimiento'],
      IVIC: ['Administración', 'Dirección', 'Investigación', 'Seguridad', 'Limpieza', 'Mantenimiento', 'Comedor'],
    },
  },
};

const isList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');

/** Listas vigentes del servidor, o null si no respondió con algo utilizable. */
export async function fetchRegistrationOptions(): Promise<RegistrationOptions | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_BASE}/api/registration/options`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as RegistrationOptions;
    const usable =
      isList(data?.student?.institutions) &&
      isList(data?.student?.semesters) &&
      isList(data?.worker?.institutions) &&
      data.student.institutions.every((name) => isList(data.student.careers?.[name])) &&
      data.worker.institutions.every((name) => isList(data.worker.areas?.[name]));
    return usable ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
