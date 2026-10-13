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
  phone: string;
  avatar_url?: string;
  moto_brand_model: string;
  moto_color: string;
  plate: string;
  helmet_provided: boolean;
  is_available: boolean;
  rating_avg: number;
  trips_count: number;
  xp_level: string;
  current_location_tag: string;
  mobile_payment_number?: string;
  mobile_payment_bank?: string;
  mobile_payment_id?: string;
  bank_account_number?: string;
}

export type RideStatus = 
  | 'solicitado' 
  | 'aceptado' 
  | 'rechazado' 
  | 'en_camino' 
  | 'en_curso' 
  | 'completado' 
  | 'cancelado';

export type PaymentMethod = 'efectivo' | 'pago_movil' | 'diamantes';

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
}

export interface PresetRoute {
  id: number;
  origin: string;
  destination: string;
  fare_usd: number;
  estimated_minutes: number;
  popular: boolean;
  tag: string;
}

export interface Reward {
  id: number;
  title: string;
  description: string;
  points_cost: number;
  discount_percent: number;
  icon: string;
  is_active: boolean;
}

export interface ReviewSubmission {
  ride_id: number;
  rating: number;
  badges: string[];
  comment: string;
}
