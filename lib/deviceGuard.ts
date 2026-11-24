'use client';

import {
  isRoleSessionActive,
  releaseRoleSessionIfOwner,
  SessionRole,
} from './roleSessionGuard';

function getCurrentRole(): SessionRole {
  if (typeof window === 'undefined') return 'staff';
  try {
    const raw = localStorage.getItem('restro_session');
    if (!raw) return 'staff';
    const parsed = JSON.parse(raw) as { role?: SessionRole };
    return parsed.role === 'owner' ? 'owner' : 'staff';
  } catch {
    return 'staff';
  }
}

export async function registerAndVerifyDevice(
  restaurantId: string,
  _maxDevices = 3
): Promise<boolean> {
  return isRoleSessionActive(restaurantId, getCurrentRole());
}

export async function sendDeviceHeartbeat(
  restaurantId: string,
  _maxDevices = 3
): Promise<boolean> {
  return isRoleSessionActive(restaurantId, getCurrentRole());
}

export async function removeCurrentDevice(restaurantId: string): Promise<void> {
  await releaseRoleSessionIfOwner(restaurantId, getCurrentRole());
}