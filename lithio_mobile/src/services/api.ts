import { Driver, Ride, RideStatus, ReviewSubmission, PresetRoute, PaymentMethod } from '../types';
import { Platform } from 'react-native';
import { authenticatedFetch, getFirebaseIdToken } from './firebase';
import { getDeviceSession } from './deviceSession';
import type { SessionRole } from './session';
import type { Level, LevelElement } from '../utils/elements';
import { API_BASE } from '../config/api';

export interface AccountSummary {
  trips_completed: number;
  scheduled_count: number;
  points: number;
  diamonds: number;
  friend_code: string | null;
  level: Level;
  rating_avg: number | null;
  is_available: boolean | null;
  has_driver_profile: boolean;
  verification_status: VerificationStatus | null;
  is_admin: boolean;
}

export type VerificationStatus = 'pendiente' | 'en_revision' | 'inspeccion' | 'aprobado' | 'rechazado';

export interface DriverApplication {
  status: VerificationStatus;
  message: string;
  notes: string | null;
  inspection_date: string | null;
  submitted_at: string | null;
  steps: { key: VerificationStatus; done: boolean }[];
  moto: { brand_model: string; color: string; plate: string; year: number | null; helmet_provided: boolean };
}

export interface AdminApplication extends DriverApplication {
  user_id: number;
  name: string;
  last_name: string | null;
  email: string;
  phone: string;
  cedula: string | null;
  career: string | null;
  semester: string | null;
  license_number: string | null;
}

export interface RideTimelineEntry {
  status: RideStatus;
  at: string | null;
}

export interface RidePerson {
  id: number;
  name: string;
  last_name: string | null;
  avatar_url: string | null;
}

export interface RideDetail {
  id: number;
  origin: string;
  destination: string;
  status: RideStatus;
  created_at: string | null;
  is_scheduled: boolean;
  scheduled_time: string | null;
  fare_amount: number;
  coupon_percent: number | null;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  has_receipt: boolean;
  receipt_uploaded_at: string | null;
  can_upload_receipt: boolean;
  fe_rewarded: number;
  timeline: RideTimelineEntry[];
  passenger: RidePerson;
  driver: RidePerson & { moto: string | null; moto_color: string | null; plate: string | null };
  review: { rating: number; comment: string | null; badges: string | null } | null;
  viewer_role: 'pasajero' | 'conductor' | 'admin';
}

export interface MyProfile {
  name: string;
  last_name: string | null;
  email: string;
  phone: string;
  /** Completa (solo la recibe el dueño). */
  cedula: string | null;
  career: string | null;
  semester: string | null;
  profile_updated_at: string | null;
  /** Si está, aún no se puede editar: fecha (UTC) desde la que se podrá. */
  next_edit_at: string | null;
}

export interface FeCoupon {
  id: number;
  percent: number;
  status: 'activo' | 'usado';
  ride_id: number | null;
  created_at: string | null;
}

export interface GradeVoucher {
  id: number;
  subject: string;
  note: string | null;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  review_note: string | null;
  code: string | null;
  created_at: string | null;
}

export interface FeStore {
  points: number;
  coupon_prices: { percent: number; cost: number }[];
  voucher_cost: number;
  /** 10 % de descuento por nivel (Hierro, Z=26, o superior). */
  store_discount: boolean;
  coupons: FeCoupon[];
  vouchers: GradeVoucher[];
}

export interface AdminVoucher extends GradeVoucher {
  user_name: string;
}

export interface AdminWalletItem {
  id: number;
  kind: 'recarga' | 'donacion_pm' | 'retiro' | 'taller';
  label: string;
  amount: number;
  status: string;
  note: string | null;
  has_receipt: boolean;
  created_at: string;
  user_id: number;
  user_name: string;
  user_email: string;
  friend_code: string | null;
  reference: string | null;
}

export interface WalletTransaction {
  id: number;
  kind: string;
  label: string;
  amount: number;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  counterpart_name: string | null;
  note: string | null;
  has_receipt: boolean;
  created_at: string;
}

/** Pago Móvil del administrador, donde se pagan recargas y donaciones. */
export interface PagoMovilDestination {
  holder: string;
  phone: string;
  bank: string | null;
  id_number: string | null;
}

export interface WalletInfo {
  balance: number;
  points: number;
  friend_code: string | null;
  transactions: WalletTransaction[];
  fund: { donated: number; donors: number };
  pago_movil: PagoMovilDestination | null;
}

export type BondType = 'nuevo' | 'iónico' | 'covalente';

export interface LinkPerson {
  link_id: number;
  user_id: number;
  name: string;
  last_name: string | null;
  avatar_url: string | null;
  friend_code: string | null;
  element: { z: number; symbol: string; name: string };
  fe_lifetime: number;
  rides_together: number;
  bond: BondType;
}

export interface LinksInfo {
  my_code: string | null;
  links: LinkPerson[];
  incoming: LinkPerson[];
  outgoing: LinkPerson[];
}

export interface WorkshopItem {
  id: number;
  title: string;
  description: string | null;
  cost: number;
  icon: string;
}

export interface QuizResult {
  correct: boolean;
  correct_index: number;
  fact: string;
  fe_awarded: number;
  points: number;
}

export interface QuizToday {
  date: string;
  question: string;
  options: string[];
  reward: number;
  answered: boolean;
  chosen?: number;
  correct?: boolean;
  correct_index?: number;
  fact?: string;
}


async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await assertOk(response);
  return response.json();
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  const detail = Array.isArray(body.detail)
    ? body.detail.map((item: { msg?: string }) => (item.msg || '').replace(/^Value error, /, '')).join('\n')
    : body.detail;
  throw new Error(detail || `La solicitud falló (${response.status}).`);
}

/**
 * Imágenes privadas (comprobantes, notas). En iOS/Android, Image acepta
 * cabeceras; en el navegador se descarga con el token y se muestra como blob.
 */
async function privateImageSource(path: string): Promise<{ uri: string; headers?: Record<string, string> }> {
  const uri = `${API_BASE}${path}`;
  if (Platform.OS === 'web') {
    const response = await authenticatedFetch(uri);
    await assertOk(response);
    return { uri: URL.createObjectURL(await response.blob()) };
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${await getFirebaseIdToken()}` };
  const session = getDeviceSession();
  if (session) headers['X-Session-Id'] = session;
  return { uri, headers };
}

export const apiService = {
  async createRoute(route: Omit<PresetRoute, 'id' | 'popular' | 'tag'> & { tag: string | null }): Promise<PresetRoute> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    await assertOk(response);
    return response.json();
  },

  async updateRoute(id: number, route: Partial<Omit<PresetRoute, 'id' | 'tag'>> & { tag?: string | null }): Promise<PresetRoute> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    await assertOk(response);
    return response.json();
  },

  async deleteRoute(id: number): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/routes/${id}`, { method: 'DELETE' });
    await assertOk(response);
  },

  async getPresetRoutes(): Promise<PresetRoute[]> {
    const response = await fetch(`${API_BASE}/api/routes`);
    await assertOk(response);
    return response.json();
  },

  async getDrivers(): Promise<Driver[]> {
    // Con sesión: el servidor podrá exigirla cuando todas las apps estén actualizadas.
    const response = await authenticatedFetch(`${API_BASE}/api/drivers`);
    await assertOk(response);
    return response.json();
  },

  async toggleDriverAvailability(driverId: number, isAvailable: boolean): Promise<boolean> {
    const response = await authenticatedFetch(`${API_BASE}/api/drivers/${driverId}/availability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: isAvailable }),
    });
    await assertOk(response);
    return isAvailable;
  },

  async requestRide(
    passengerId: number,
    rideData: {
      driver_id: number;
      origin: string;
      destination: string;
      is_scheduled?: boolean;
      scheduled_time?: string;
      payment_method: PaymentMethod;
      payment_reference?: string;
      fare_amount: number;
      coupon_id?: number;
    }
  ): Promise<Ride> {
    const response = await authenticatedFetch(
      `${API_BASE}/api/rides?passenger_id=${passengerId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData),
      }
    );
    await assertOk(response);
    return response.json();
  },

  async getActiveRide(userId: number, role?: SessionRole): Promise<Ride | null> {
    const query = role ? `?role=${role}` : '';
    const response = await authenticatedFetch(`${API_BASE}/api/rides/active/${userId}${query}`);
    if (response.status === 404) return null;
    await assertOk(response);
    return response.json();
  },

  async getPendingRequests(driverId: number): Promise<Ride[]> {
    const response = await authenticatedFetch(`${API_BASE}/api/rides/driver/${driverId}/pending`);
    await assertOk(response);
    return response.json();
  },

  async getMyRides(scope: 'history' | 'scheduled', role: SessionRole): Promise<Ride[]> {
    const response = await authenticatedFetch(`${API_BASE}/api/rides/mine?scope=${scope}&role=${role}`);
    await assertOk(response);
    return response.json();
  },

  async getSummary(role: SessionRole): Promise<AccountSummary> {
    const response = await authenticatedFetch(`${API_BASE}/api/users/me/summary?role=${role}`);
    await assertOk(response);
    return response.json();
  },

  async getDriverApplication(): Promise<DriverApplication> {
    const response = await authenticatedFetch(`${API_BASE}/api/drivers/me/application`);
    await assertOk(response);
    return response.json();
  },

  async getLevels(): Promise<{ current: Level; elements: LevelElement[] }> {
    const response = await authenticatedFetch(`${API_BASE}/api/levels`);
    await assertOk(response);
    return response.json();
  },

  async getDriverApplications(): Promise<AdminApplication[]> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/driver-applications`);
    await assertOk(response);
    return response.json();
  },

  async reviewDriverApplication(
    userId: number,
    data: { status: VerificationStatus; notes?: string; inspection_date?: string }
  ): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/driver-applications/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await assertOk(response);
  },

  async getPendingWallet(): Promise<AdminWalletItem[]> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/wallet/pending`);
    await assertOk(response);
    return response.json();
  },

  /** Borra los datos personales y el acceso de la cuenta (no se puede deshacer). */
  async deleteMyAccount(): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/api/users/me`, { method: 'DELETE' });
    await assertOk(response);
  },

  async getMyProfile(): Promise<MyProfile> {
    const response = await authenticatedFetch(`${API_BASE}/api/users/me/profile`);
    await assertOk(response);
    return response.json();
  },

  async updateMyProfile(changes: Partial<Pick<MyProfile, 'name' | 'last_name' | 'email' | 'phone'>>): Promise<MyProfile> {
    const response = await authenticatedFetch(`${API_BASE}/api/users/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    await assertOk(response);
    return response.json();
  },

  async getRideDetail(rideId: number): Promise<RideDetail> {
    const response = await authenticatedFetch(`${API_BASE}/api/rides/${rideId}/detail`);
    await assertOk(response);
    return response.json();
  },

  async uploadRideReceipt(rideId: number, photo: Blob): Promise<void> {
    const form = new FormData();
    form.append('photo', photo);
    const response = await authenticatedFetch(`${API_BASE}/api/rides/${rideId}/receipt`, { method: 'POST', body: form });
    await assertOk(response);
  },

  async rideReceiptSource(rideId: number): Promise<{ uri: string; headers?: Record<string, string> }> {
    return privateImageSource(`/api/rides/${rideId}/receipt`);
  },

  async walletReceiptSource(txId: number): Promise<{ uri: string; headers?: Record<string, string> }> {
    return privateImageSource(`/api/wallet/transactions/${txId}/receipt`);
  },

  /** Captura del Pago Móvil de una recarga o donación en revisión. */
  async uploadWalletReceipt(txId: number, photo: Blob): Promise<void> {
    const form = new FormData();
    form.append('photo', photo);
    const response = await authenticatedFetch(`${API_BASE}/api/wallet/transactions/${txId}/receipt`, { method: 'POST', body: form });
    await assertOk(response);
  },

  async getFeStore(): Promise<FeStore> {
    const response = await authenticatedFetch(`${API_BASE}/api/fe-store`);
    await assertOk(response);
    return response.json();
  },

  async buyCoupon(percent: number): Promise<{ coupon: FeCoupon; points: number }> {
    const response = await authenticatedFetch(`${API_BASE}/api/fe-store/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent }),
    });
    await assertOk(response);
    return response.json();
  },

  async requestGradeVoucher(subject: string, note: string, photo: Blob): Promise<{ voucher: GradeVoucher; points: number }> {
    const form = new FormData();
    form.append('subject', subject);
    if (note) form.append('note', note);
    form.append('photo', photo);
    const response = await authenticatedFetch(`${API_BASE}/api/fe-store/vouchers`, { method: 'POST', body: form });
    await assertOk(response);
    return response.json();
  },

  async getPendingVouchers(): Promise<AdminVoucher[]> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/vouchers`);
    await assertOk(response);
    return response.json();
  },

  async reviewVoucher(id: number, action: 'aprobar' | 'rechazar', note?: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/vouchers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    await assertOk(response);
  },

  /** La evidencia es privada: se pide con el token del administrador. */
  async voucherEvidenceSource(id: number): Promise<{ uri: string; headers?: Record<string, string> }> {
    return privateImageSource(`/api/admin/vouchers/${id}/evidence`);
  },

  async reviewWalletTransaction(id: number, action: 'aprobar' | 'rechazar', note?: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/api/admin/wallet/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    await assertOk(response);
  },

  async getWallet(): Promise<WalletInfo> {
    const response = await authenticatedFetch(`${API_BASE}/api/wallet`);
    await assertOk(response);
    return response.json();
  },

  async getQuizToday(): Promise<QuizToday> {
    const response = await authenticatedFetch(`${API_BASE}/api/quiz/today`);
    await assertOk(response);
    return response.json();
  },

  async getLinks(): Promise<LinksInfo> {
    const response = await authenticatedFetch(`${API_BASE}/api/links`);
    await assertOk(response);
    return response.json();
  },

  async requestLink(code: string): Promise<void> {
    await postJson('/api/links', { code });
  },

  async acceptLink(linkId: number): Promise<void> {
    await postJson(`/api/links/${linkId}/accept`, {});
  },

  async removeLink(linkId: number): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/api/links/${linkId}`, { method: 'DELETE' });
    await assertOk(response);
  },

  async answerQuiz(option: number): Promise<QuizResult> {
    return postJson('/api/quiz/today', { option });
  },

  async requestTopup(amount: number, reference: string): Promise<WalletTransaction> {
    return postJson('/api/wallet/topups', { amount, reference });
  },

  async sendDiamonds(toCode: string, amount: number, note?: string): Promise<void> {
    await postJson('/api/wallet/transfers', { to_code: toCode, amount, note: note || undefined });
  },

  /** Con diamantes se descuenta al instante; por Pago Móvil queda en revisión. */
  async donate(amount: number, method: 'diamantes' | 'pago_movil' = 'diamantes', reference?: string): Promise<WalletTransaction> {
    return postJson('/api/wallet/donations', { amount, method, reference });
  },

  async creditDiamonds(friendCode: string, amount: number, note?: string): Promise<void> {
    await postJson('/api/admin/wallet/credit', { friend_code: friendCode, amount, note: note || undefined });
  },

  async requestWithdrawal(amount: number, destination: string): Promise<void> {
    await postJson('/api/wallet/withdrawals', { amount, destination });
  },

  async getWorkshop(): Promise<WorkshopItem[]> {
    const response = await authenticatedFetch(`${API_BASE}/api/wallet/workshop`);
    await assertOk(response);
    return response.json();
  },

  async redeemWorkshop(rewardId: number): Promise<void> {
    await postJson(`/api/wallet/workshop/${rewardId}/redeem`, {});
  },

  async getLinksCount(): Promise<number> {
    const response = await authenticatedFetch(`${API_BASE}/api/links`);
    await assertOk(response);
    const body = await response.json();
    return body.links.length;
  },

  async updateRideStatus(rideId: number, status: RideStatus): Promise<{ fe_awarded: number }> {
    const response = await authenticatedFetch(`${API_BASE}/api/rides/${rideId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await assertOk(response);
    return response.json();
  },

  async submitReview(
    passengerId: number,
    review: ReviewSubmission
  ): Promise<{ points_earned: number }> {
    const response = await authenticatedFetch(
      `${API_BASE}/api/reviews?passenger_id=${passengerId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ride_id: review.ride_id,
          rating: review.rating,
          badges: review.badges.join(','),
          comment: review.comment,
        }),
      }
    );
    await assertOk(response);
    return response.json();
  },
};
