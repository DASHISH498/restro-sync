import { supabase } from './supabase';

const DEVICE_ID_KEY = 'restrosync_device_uid';
const STALE_TIMEOUT_MS = 45 * 1000; // 45 seconds se inactive sessions auto-clear hongi

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';

  let uid = localStorage.getItem(DEVICE_ID_KEY);
  if (!uid) {
    uid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, uid);
  }
  return uid;
}

export async function registerAndVerifyDevice(
  restaurantId: string,
  maxDevices = 3
): Promise<boolean> {
  try {
    const deviceId = getOrCreateDeviceId();
    const nowIso = new Date().toISOString();
    const staleThresholdIso = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();

    // 1. Pehle 45 sec se purane closed/dead sessions ko saaf karein
    await supabase
      .from('active_sessions')
      .delete()
      .eq('restaurant_id', restaurantId)
      .lt('last_seen', staleThresholdIso);

    // 2. Abhi currently active sessions fetch karein
    const { data: activeList, error } = await supabase
      .from('active_sessions')
      .select('device_id')
      .eq('restaurant_id', restaurantId);

    if (error) {
      // Temporary network glitch par galat block na karein
      return true;
    }

    const devices = activeList || [];
    const alreadyRegistered = devices.some((d) => d.device_id === deviceId);

    if (alreadyRegistered) {
      await supabase
        .from('active_sessions')
        .update({ last_seen: nowIso })
        .eq('restaurant_id', restaurantId)
        .eq('device_id', deviceId);
      return true;
    }

    // 3. Agar sach mein 3 alag devices is waqt active hain, tabhi block karein
    if (devices.length >= maxDevices) {
      return false;
    }

    // 4. Naya device session register karein
    await supabase.from('active_sessions').upsert(
      {
        restaurant_id: restaurantId,
        device_id: deviceId,
        last_seen: nowIso,
      },
      { onConflict: 'restaurant_id,device_id' }
    );

    return true;
  } catch {
    return true;
  }
}

export async function sendDeviceHeartbeat(
  restaurantId: string,
  maxDevices = 3
): Promise<boolean> {
  return registerAndVerifyDevice(restaurantId, maxDevices);
}

export async function removeCurrentDevice(restaurantId: string): Promise<void> {
  try {
    const deviceId = getOrCreateDeviceId();
    await supabase
      .from('active_sessions')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('device_id', deviceId);
  } catch {
    // Ignore unload errors
  }
}