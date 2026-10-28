/**
 * emailGate.ts — "Verifica tu correo" antes de entrar
 *
 * El servidor responde 428 con X-Email-Verification cuando la cuenta todavía
 * no confirmó su correo de Gmail. authenticatedFetch avisa aquí y App muestra
 * la pantalla de verificación, venga de donde venga la petición.
 *
 * Sin dependencias de otros servicios para que firebase.ts lo importe sin ciclos.
 */

const listeners = new Set<() => void>();

export function notifyEmailVerificationRequired() {
  listeners.forEach((listener) => listener());
}

export function onEmailVerificationRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Error para que las pantallas no muestren otro aviso: la de verificación ya está abierta. */
export class EmailVerificationPending extends Error {
  constructor() {
    super('Verifica tu correo para entrar.');
    this.name = 'EmailVerificationPending';
  }
}

export const isEmailVerificationPending = (error: unknown) => error instanceof EmailVerificationPending;
