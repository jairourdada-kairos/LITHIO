/**
 * useAdminAlerts.ts — Avisos flotantes para el administrador
 *
 * El servidor avisa por WebSocket (ADMIN_ALERT) de cada solicitud nueva:
 * recargas y donaciones por Pago Móvil, comprobantes, retiros, pedidos del
 * taller, vales de nota y conductores por verificar. Con la app cerrada llega
 * la notificación push del sistema con el mismo texto.
 */

import { useCallback, useEffect, useState } from 'react';
import { wsService } from '../services/websocket';
import type { RideNotice } from './useRideCenter';

export function useAdminAlerts(isAdmin: boolean) {
  const [notice, setNotice] = useState<RideNotice | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    return wsService.subscribe((msg) => {
      if (msg.type === 'ADMIN_ALERT' && typeof msg.title === 'string') {
        setNotice({ title: msg.title, message: String(msg.body ?? ''), tone: 'info' });
      }
    });
  }, [isAdmin]);

  const clear = useCallback(() => setNotice(null), []);
  return { notice, clear };
}
