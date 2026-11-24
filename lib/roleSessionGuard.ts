'use client';

import { supabase } from '@/lib/supabase';

export type SessionRole = 'owner' | 'staff';

const TOKEN_STORAGE_KEY = 'restro_role_session_token';

function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getLocalSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearLocalSessionToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Called right after PIN login succeeds.
 * Claims the single active slot for (restaurantId, role) and invalidates any previous login for that same role.
 */
export async function claimSingleRoleSession(
  restaurantId: string,
  role: SessionRole
): Promise<string> {
  const token = generateSessionToken();
  localStorage.setItem(TOKEN_STORAGE_KEY, token);

  await supabase.from('active_role_sessions').upsert(
    {
      restaurant_id: restaurantId,
      role,
      session_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'restaurant_id,role' }
  );

  return token;
}

/**
 * Checks if this browser/device still holds the active session_token for (restaurantId, role).
 * Returns false if another device logged in with the same role.
 */
export async function isRoleSessionActive(
  restaurantId: string,
  role: SessionRole
): Promise<boolean> {
  const localToken = getLocalSessionToken();
  if (!localToken) return false;

  const { data, error } = await supabase
    .from('active_role_sessions')
    .select('session_token')
    .eq('restaurant_id', restaurantId)
    .eq('role', role)
    .maybeSingle();

  if (error || !data) {
    return true;
  }

  return data.session_token === localToken;
}

/**
 * Releases the current role slot only if this browser still owns the active session_token.
 */
export async function releaseRoleSessionIfOwner(
  restaurantId: string,
  role: SessionRole
): Promise<void> {
  const localToken = getLocalSessionToken();
  clearLocalSessionToken();

  if (!localToken) return;

  await supabase
    .from('active_role_sessions')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('role', role)
    .eq('session_token', localToken);
}