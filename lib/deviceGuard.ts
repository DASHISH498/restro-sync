import { supabase } from './supabase';

const MAX_DEVICES = 3;

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('restrosync_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    localStorage.setItem('restrosync_device_id', id);
  }
  return id;
}

export async function registerAndVerifyDevice(restaurantId: string): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) return true;

  const { data, error } = await supabase
    .from('restaurants')
    .select('active_sessions')
    .eq('id', restaurantId)
    .single();

  if (error || !data) return true;

  let sessions: { deviceId: string; lastActive: string }[] = Array.isArray(data.active_sessions)
    ? data.active_sessions
    : [];

  // 12 ghante se purane inactive sessions auto-clean karein (agar koi browser band karna bhool jaye)
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  sessions = sessions.filter((s) => new Date(s.lastActive).getTime() > twelveHoursAgo);

  const existingIndex = sessions.findIndex((s) => s.deviceId === deviceId);
  if (existingIndex !== -1) {
    sessions[existingIndex].lastActive = new Date().toISOString();
    await supabase
      .from('restaurants')
      .update({ active_sessions: sessions })
      .eq('id', restaurantId);
    return true;
  }

  // Agar pehle se 3 alag devices active hain, toh 4th device ko BLOCK karein
  if (sessions.length >= MAX_DEVICES) {
    return false;
  }

  sessions.push({ deviceId, lastActive: new Date().toISOString() });
  await supabase
    .from('restaurants')
    .update({ active_sessions: sessions })
    .eq('id', restaurantId);

  return true;
}

export async function removeCurrentDevice(restaurantId: string): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) return;

  const { data } = await supabase
    .from('restaurants')
    .select('active_sessions')
    .eq('id', restaurantId)
    .single();

  if (!data || !Array.isArray(data.active_sessions)) return;

  const updated = data.active_sessions.filter(
    (s: { deviceId: string }) => s.deviceId !== deviceId
  );

  await supabase
    .from('restaurants')
    .update({ active_sessions: updated })
    .eq('id', restaurantId);
}

export async function isCurrentDeviceValid(restaurantId: string): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  const { data } = await supabase
    .from('restaurants')
    .select('active_sessions')
    .eq('id', restaurantId)
    .single();

  if (!data || !Array.isArray(data.active_sessions)) return true;
  if (data.active_sessions.length === 0) return true;

  return data.active_sessions.some((s: { deviceId: string }) => s.deviceId === deviceId);
}