import { Driver, Ride, RideStatus, Reward, ReviewSubmission, PresetRoute, PaymentMethod } from '../types';
import { authenticatedFetch } from './firebase';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000';

async function assertOk(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  throw new Error(body.detail || `La solicitud falló (${response.status}).`);
}

export const apiService = {
  async getPresetRoutes(): Promise<PresetRoute[]> {
    const response = await fetch(`${BACKEND_URL}/api/routes`);
    await assertOk(response);
    return response.json();
  },

  async getDrivers(): Promise<Driver[]> {
    const response = await fetch(`${BACKEND_URL}/api/drivers`);
    await assertOk(response);
    return response.json();
  },

  async toggleDriverAvailability(driverId: number, isAvailable: boolean): Promise<boolean> {
    const response = await authenticatedFetch(`${BACKEND_URL}/api/drivers/${driverId}/availability`, {
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
    }
  ): Promise<Ride> {
    const response = await authenticatedFetch(
      `${BACKEND_URL}/api/rides?passenger_id=${passengerId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData),
      }
    );
    await assertOk(response);
    return response.json();
  },

  async getActiveRide(userId: number): Promise<Ride | null> {
    const response = await authenticatedFetch(`${BACKEND_URL}/api/rides/active/${userId}`);
    if (response.status === 404) return null;
    await assertOk(response);
    return response.json();
  },

  async updateRideStatus(rideId: number, status: RideStatus): Promise<{ fe_awarded: number }> {
    const response = await authenticatedFetch(`${BACKEND_URL}/api/rides/${rideId}/status`, {
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
      `${BACKEND_URL}/api/reviews?passenger_id=${passengerId}`,
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

  async getRewards(): Promise<Reward[]> {
    const response = await fetch(`${BACKEND_URL}/api/gamification/rewards`);
    await assertOk(response);
    return response.json();
  },

  async redeemReward(
    userId: number,
    rewardId: number
  ): Promise<{ message: string; new_balance: number; discount_code: string }> {
    const response = await authenticatedFetch(
      `${BACKEND_URL}/api/gamification/redeem?user_id=${userId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: rewardId }),
      }
    );
    await assertOk(response);
    return response.json();
  },
};
