import { Driver, Ride, RideStatus, Reward, ReviewSubmission, PresetRoute } from '../types';
import { PRESET_ROUTES } from '../constants/routes';

// IP LAN real del equipo para Expo Go sobre Wi‑Fi
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000';

// Datos de respaldo en memoria si el backend no está conectado
let mockDrivers: Driver[] = [
  {
    user_id: 1,
    name: "Jairo (Tú)",
    phone: "+58 412 1234567",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    moto_brand_model: "Bera SBR 150 2024",
    moto_color: "Azul Eléctrico",
    plate: "AA9X12Y",
    helmet_provided: true,
    is_available: true,
    rating_avg: 4.95,
    trips_count: 142,
    xp_level: "Leyenda LITHIO 🏍️",
    current_location_tag: "Campus UNC - Edificio Central"
  },
  {
    user_id: 2,
    name: "Carlos Silva",
    phone: "+58 414 9876543",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    moto_brand_model: "Empire Keeway Horse 150",
    moto_color: "Rojo Brillante",
    plate: "AC4D88K",
    helmet_provided: true,
    is_available: true,
    rating_avg: 4.82,
    trips_count: 89,
    xp_level: "Máster Panamericana ⚡",
    current_location_tag: "Redoma de San Antonio de los Altos"
  },
  {
    user_id: 3,
    name: "Alejandro Díaz",
    phone: "+58 424 5551234",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    moto_brand_model: "Haojue Cool 150",
    moto_color: "Gris Plomo",
    plate: "AE7M91T",
    helmet_provided: true,
    is_available: false,
    rating_avg: 4.75,
    trips_count: 54,
    xp_level: "Piloto IVIC 🛡️",
    current_location_tag: "Entrada IVIC - En ruta a Los Teques"
  }
];

let mockActiveRide: Ride | null = null;
let mockRewards: Reward[] = [
  {
    id: 1,
    title: "20% de descuento en tu viaje",
    description: "Canjea Fe por un descuento en tu próximo trayecto.",
    points_cost: 100,
    discount_percent: 20,
    icon: "ticket",
    is_active: true
  },
  {
    id: 2,
    title: "Viaje gratis en rutas universitarias",
    description: "Canjea Fe por un viaje en una ruta disponible.",
    points_cost: 250,
    discount_percent: 100,
    icon: "gift",
    is_active: true
  },
  {
    id: 3,
    title: "50% Descuento a Caracas",
    description: "Ahorra la mitad en una ruta seleccionada.",
    points_cost: 400,
    discount_percent: 50,
    icon: "star",
    is_active: true
  }
];

export const apiService = {
  // Obtener rutas fijas
  async getPresetRoutes(): Promise<PresetRoute[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/routes`);
      if (res.ok) return await res.json();
    } catch {
      // Si el backend no responde, usar las rutas locales
    }
    return PRESET_ROUTES;
  },

  // Obtener lista de conductores
  async getDrivers(): Promise<Driver[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/drivers`);
      if (res.ok) {
        const data = await res.json();
        mockDrivers = data;
        return data;
      }
    } catch {
      // Fallback local
    }
    return mockDrivers;
  },

  // Cambiar disponibilidad del conductor
  async toggleDriverAvailability(driverId: number, isAvailable: boolean): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/drivers/${driverId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: isAvailable })
      });
      if (res.ok) return isAvailable;
    } catch {
      // Fallback
    }
    const d = mockDrivers.find(x => x.user_id === driverId);
    if (d) d.is_available = isAvailable;
    return isAvailable;
  },

  // Solicitar viaje a un conductor específico
  async requestRide(passengerId: number, rideData: any): Promise<Ride> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rides?passenger_id=${passengerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData)
      });
      if (res.ok) {
        const created = await res.json();
        mockActiveRide = created;
        return created;
      }
    } catch {
      // Fallback local
    }

    const driver = mockDrivers.find(d => d.user_id === rideData.driver_id);
    const newRide: Ride = {
      id: Date.now(),
      passenger_id: passengerId,
      driver_id: rideData.driver_id,
      origin: rideData.origin,
      destination: rideData.destination,
      is_scheduled: !!rideData.is_scheduled,
      scheduled_time: rideData.scheduled_time,
      status: 'solicitado',
      payment_method: rideData.payment_method,
      payment_reference: rideData.payment_reference,
      fare_amount: rideData.fare_amount || 2.50,
      points_rewarded: 35,
      created_at: new Date().toISOString(),
      passenger_name: "Estudiante UNC",
      driver_name: driver ? driver.name : "Conductor Asignado"
    };
    mockActiveRide = newRide;
    return newRide;
  },

  // Obtener viaje activo
  async getActiveRide(userId: number): Promise<Ride | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rides/active/${userId}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return mockActiveRide;
  },

  // Actualizar estado del viaje
  async updateRideStatus(rideId: number, status: RideStatus): Promise<{ fe_awarded: number }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rides/${rideId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    if (mockActiveRide && mockActiveRide.id === rideId) {
      mockActiveRide.status = status;
      if (status === 'completado' || status === 'cancelado') {
        // Se mantiene activo hasta que se califique o limpie
      }
    }
    return { fe_awarded: status === 'completado' ? mockActiveRide?.points_rewarded ?? 35 : 0 };
  },

  // Enviar reseña
  async submitReview(passengerId: number, review: ReviewSubmission): Promise<{ points_earned: number }> {
    const res = await fetch(`${BACKEND_URL}/api/reviews?passenger_id=${passengerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ride_id: review.ride_id,
        rating: review.rating,
        badges: review.badges.join(','),
        comment: review.comment
      })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'No se pudo validar la reseña con el servidor.');
    }
    return res.json();
  },

  // Recompensas
  async getRewards(): Promise<Reward[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/gamification/rewards`);
      if (res.ok) return await res.json();
    } catch {}
    return mockRewards;
  },

  async redeemReward(userId: number, rewardId: number): Promise<{ message: string; new_balance: number; discount_code: string }> {
    const res = await fetch(`${BACKEND_URL}/api/gamification/redeem?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reward_id: rewardId })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'No se pudo completar el canje.');
    }
    return res.json();
  }
};
