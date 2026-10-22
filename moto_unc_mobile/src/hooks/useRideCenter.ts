/**
 * useRideCenter.ts — Estado de viajes en tiempo real de la sesión
 *
 * - Restaura el viaje activo al abrir la app (GET /api/rides/active).
 * - Conductor: mantiene la bandeja de solicitudes nuevas (NEW_RIDE_REQUEST)
 *   y la recarga al reconectar.
 * - Aplica RIDE_STATUS_UPDATED y ACTIVE_RIDE_SYNC para que la pantalla
 *   siempre refleje el estado real del backend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { wsService, WSMessage } from '../services/websocket';
import type { SessionRole } from '../services/session';
import type { Ride, RideStatus } from '../types';

const TERMINAL: RideStatus[] = ['cancelado', 'rechazado'];

export interface RideNotice {
  title: string;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

const PASSENGER_NOTICES: Partial<Record<RideStatus, RideNotice>> = {
  aceptado: { title: 'Viaje aceptado', message: 'Tu conductor aceptó el viaje y va por ti.', tone: 'success' },
  en_camino: { title: 'Conductor en camino', message: 'Tu conductor está llegando al punto de encuentro.', tone: 'info' },
  en_curso: { title: 'Viaje en curso', message: 'Buen viaje. Llegarás a tu destino en breve.', tone: 'info' },
  completado: { title: 'Llegaste a tu destino', message: 'Califica el viaje y gana Fe por tu reseña.', tone: 'success' },
  rechazado: { title: 'Solicitud rechazada', message: 'El conductor no pudo tomar tu viaje. Elige otro conductor.', tone: 'warning' },
  cancelado: { title: 'Viaje cancelado', message: 'El viaje fue cancelado.', tone: 'warning' },
};

export function useRideCenter(userId: number, role: SessionRole) {
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [requests, setRequests] = useState<Ride[]>([]);
  const [notice, setNotice] = useState<RideNotice | null>(null);
  const [connected, setConnected] = useState(wsService.isConnected());
  const activeRef = useRef<Ride | null>(null);
  activeRef.current = activeRide;

  const refresh = useCallback(async () => {
    try {
      const [ride, pending] = await Promise.all([
        apiService.getActiveRide(userId, role),
        role === 'conductor' ? apiService.getPendingRequests(userId) : Promise.resolve([]),
      ]);
      setActiveRide(ride);
      setRequests(pending);
    } catch {
      // Sin conexión: se vuelve a intentar al reconectar el WebSocket.
    }
  }, [userId, role]);

  const belongsToSession = useCallback(
    (ride: { passenger_id: number; driver_id: number }) =>
      role === 'pasajero' ? ride.passenger_id === userId : ride.driver_id === userId,
    [userId, role]
  );

  useEffect(() => {
    void refresh();
    wsService.connect();

    const offStatus = wsService.onStatusChange((isConnected) => {
      setConnected(isConnected);
      if (isConnected) void refresh();
    });

    const offMessages = wsService.subscribe((msg: WSMessage) => {
      if (msg.type === 'NEW_RIDE_REQUEST' && role === 'conductor' && msg.ride) {
        setRequests((prev) => (prev.some((r) => r.id === msg.ride.id) ? prev : [msg.ride, ...prev]));
        setNotice({
          title: 'Nueva solicitud',
          message: `${msg.ride.passenger_name || 'Un pasajero'} quiere ir de ${msg.ride.origin} a ${msg.ride.destination}.`,
          tone: 'info',
        });
        return;
      }

      if (msg.type === 'RIDE_STATUS_UPDATED' && msg.ride && belongsToSession(msg.ride)) {
        const ride: Ride = msg.ride;
        setRequests((prev) => prev.filter((r) => r.id !== ride.id || ride.status === 'solicitado'));
        const current = activeRef.current;
        if (TERMINAL.includes(ride.status)) {
          if (current?.id === ride.id) setActiveRide(null);
        } else if (role === 'pasajero' || ride.status !== 'solicitado') {
          // Conserva los datos de pago que solo llegan por HTTP.
          setActiveRide(current?.id === ride.id ? { ...current, ...ride } : ride);
        }
        if (role === 'pasajero' && PASSENGER_NOTICES[ride.status]) {
          setNotice(PASSENGER_NOTICES[ride.status]!);
        }
        return;
      }

      if (msg.type === 'ACTIVE_RIDE_SYNC') {
        void refresh();
      }
    });

    return () => {
      offStatus();
      offMessages();
    };
  }, [refresh, belongsToSession, role]);

  const updateStatus = useCallback(
    async (ride: Ride, status: RideStatus) => {
      const result = await apiService.updateRideStatus(ride.id, status);
      setRequests((prev) => prev.filter((r) => r.id !== ride.id));
      if (TERMINAL.includes(status)) {
        if (activeRef.current?.id === ride.id) setActiveRide(null);
      } else {
        setActiveRide({ ...(activeRef.current?.id === ride.id ? activeRef.current : ride), status });
      }
      return result;
    },
    []
  );

  return {
    activeRide,
    setActiveRide,
    requests,
    notice,
    clearNotice: () => setNotice(null),
    connected,
    refresh,
    updateStatus,
  };
}
