/**
 * validation.ts — Reglas del formulario de registro
 *
 * Copia en el cliente de moto_unc_backend/app/validation.py: avisa al
 * usuario antes de enviar, pero el backend vuelve a validar todo.
 * Si cambias una regla aquí, cámbiala también allá.
 */

export const SEMESTER_OPTIONS = [
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
  'Egresado',
  'Personal / Docente',
];

export type CedulaNationality = 'V' | 'E';

// Movilnet (0416, 0426), Movistar (0414, 0424), Digitel (0412, 0422).
const MOBILE_PREFIXES = ['412', '414', '416', '422', '424', '426'];
const NAME_PATTERN = /^[\p{L}'´’\- ]+$/u;

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

export function validatePersonName(value: string, label: string): string | undefined {
  const cleaned = collapseSpaces(value);
  if (!cleaned) return `${label} es obligatorio`;
  if (cleaned.length < 2 || cleaned.length > 60) return `${label} debe tener entre 2 y 60 caracteres`;
  if (!NAME_PATTERN.test(cleaned)) return `${label} solo puede contener letras`;
  return undefined;
}

export function validateCedulaDigits(digits: string): string | undefined {
  const cleaned = digits.replace(/\D/g, '');
  if (!cleaned) return 'La cédula es obligatoria';
  if (cleaned.length < 6 || cleaned.length > 9) return 'La cédula debe tener entre 6 y 9 dígitos';
  if (Number(cleaned) === 0) return 'La cédula no es válida';
  return undefined;
}

export function formatCedula(nationality: CedulaNationality, digits: string): string {
  return `${nationality}-${digits.replace(/\D/g, '')}`;
}

export function validateEmail(value: string): string | undefined {
  const cleaned = value.trim();
  if (!cleaned) return 'El correo es obligatorio';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) return 'Correo electrónico inválido';
  return undefined;
}

/** Registro: solo cuentas reales de Gmail (igual que ALLOWED_EMAIL_DOMAINS del servidor). */
const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

export function validateGmail(value: string): string | undefined {
  const invalid = validateEmail(value);
  if (invalid) return invalid;
  const domain = value.trim().toLowerCase().split('@').pop() ?? '';
  if (!GMAIL_DOMAINS.includes(domain)) return 'Usa tu correo de Gmail (termina en @gmail.com)';
  return undefined;
}

export function validateCareer(value: string): string | undefined {
  const cleaned = collapseSpaces(value);
  if (!cleaned) return 'La carrera es obligatoria';
  if (cleaned.length < 3 || cleaned.length > 80) return 'Escribe el nombre de tu carrera (3 a 80 caracteres)';
  if (!/\p{L}/u.test(cleaned)) return 'La carrera no es válida';
  return undefined;
}

export function validateSemester(value: string): string | undefined {
  return SEMESTER_OPTIONS.includes(value) ? undefined : 'Selecciona tu semestre';
}

/** '0412-1234567' -> '4121234567' (10 dígitos) o null si no es un celular venezolano. */
function mobileDigits(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('58') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10 || !MOBILE_PREFIXES.includes(digits.slice(0, 3))) return null;
  return digits;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return 'El teléfono es obligatorio';
  if (!mobileDigits(value)) return 'Usa un celular venezolano: 0412, 0414, 0416, 0422, 0424 o 0426 + 7 dígitos';
  return undefined;
}

export function normalizePhone(value: string): string {
  const digits = mobileDigits(value);
  return digits ? `+58 ${digits.slice(0, 3)} ${digits.slice(3)}` : value.trim();
}

export function validatePassword(value: string): string | undefined {
  if (value.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  return undefined;
}

export { collapseSpaces };
