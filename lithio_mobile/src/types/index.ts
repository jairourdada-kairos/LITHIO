export type UserRole = 'pasajero' | 'conductor' | 'ambos';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar_url?: string;
  points: number;
  xp_level: string;
}

export interface Driver {
  user_id: number;
  name: string;
  avatar_url?: string;
  moto_brand_model: string;
  moto_color: string;
  vehicle_plate?: string | null;
  plate?: string | null;
  is_verified?: boolean;
  helmet_provided: boolean;
  is_available: boolean;
  rating_avg: number;
  trips_count: number;
  xp_level: string;
}

export type RideStatus = 
  | 'solicitado' 
  | 'aceptado' 
  | 'rechazado' 
  | 'en_camino' 
  | 'en_curso' 
  | 'completado' 
  | 'cancelado';

/** 'pase' = pase de un COMBO de la Tienda Fe (solo rutas internas). */
export type PaymentMethod = 'diamantes' | 'efectivo' | 'pago_movil' | 'pase';

export interface Ride {
  id: number;
  passenger_id: number;
  driver_id: number;
  origin: string;
  destination: string;
  is_scheduled: boolean;
  scheduled_time?: string;
  status: RideStatus;
  payment_method: PaymentMethod;
  payment_reference?: string;
  fare_amount: number;
  points_rewarded: number;
  created_at: string;
  passenger_name?: string;
  driver_name?: string;
  driver_plate?: string | null;
  driver_moto_brand_model?: string | null;
  driver_moto_color?: string | null;
  driver_is_verified?: boolean;
  has_review?: boolean;
  driver_mobile_payment_number?: string;
  driver_mobile_payment_bank?: string;
  driver_mobile_payment_id?: string;
  driver_bank_account_number?: string;
  driver_binance_address?: string;
  has_receipt?: boolean;
  /** Teléfono del otro participante (solo con el viaje aceptado). */
  counterpart_phone?: string | null;
}

export interface PresetRoute {
  id: number;
  origin: string;
  destination: string;
  fare_usd: number;
  estimated_minutes: number;
  popular: boolean;
  tag: string;
  /** 'interna' = dentro del IVIC; 'externa' = del IVIC hacia afuera. */
  scope?: 'interna' | 'externa';
}

export interface ReviewSubmission {
  ride_id: number;
  rating: number;
  badges: string[];
  comment: string;
}
