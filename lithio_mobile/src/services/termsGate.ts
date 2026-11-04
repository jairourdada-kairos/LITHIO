/**
 * termsGate.ts — Términos nuevos a mitad de sesión
 *
 * Si los Términos y la Política de privacidad cambian mientras la app está
 * abierta, el servidor responde 403 con X-Terms-Required. authenticatedFetch
 * avisa aquí y App muestra la pantalla de aceptación, venga de donde venga la petición.
 *
 * Sin dependencias de otros servicios para que firebase.ts lo importe sin ciclos.
 */

const listeners = new Set<() => void>();

export function notifyTermsRequired() {
  listeners.forEach((listener) => listener());
}

export function onTermsRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
