import { supabase } from './supabase';

const MAX_DEVICES = 3;
// 45 seconds tak heartbeat na aaye toh browser close/offline maankar slot free kar dein
const HEARTBEAT_TIMEOUT_MS = 45 * 1000;

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('restrosync_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    sessionStorage.setItem('restrosync_device_id', id);
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

  // Jin devices ka browser close ho chuka hai (45 sec se inactive), unhe auto-remove karein
  const cutoff = Date.now() - HEARTBEAT_TIMEOUT_MS;
  sessions = sessions.filter((s) => new Date(s.lastActive).getTime() > cutoff);

  const existingIndex = sessions.findIndex((s) => s.deviceId === deviceId);
  if (existingIndex !== -1) {
    sessions[existingIndex].lastActive = new Date().toISOString();
    await supabase
      .from('restaurants')
      .update({ active_sessions: sessions })
      .eq('id', restaurantId);
    return true;
  }

  // Agar pehle se 3 active browsers khule hain, toh 4th ko BLOCK karein
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

export async function sendDeviceHeartbeat(restaurantId: string): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) return true;

  const { data } = await supabase
    .from('restaurants')
    .select('active_sessions')
    .eq('id', restaurantId)
    .single();

  if (!data || !Array.isArray(data.active_sessions)) return true;

  const cutoff = Date.now() - HEARTBEAT_TIMEOUT_MS;
  const activeOnly = data.active_sessions.filter(
    (s: { deviceId: string; lastActive: string }) => new Date(s.lastActive).getTime() > cutoff
  );

  const idx = activeOnly.findIndex((s: { deviceId: string }) => s.deviceId === deviceId);
  if (idx === -1) {
    return false;
  }

  activeOnly[idx].lastActive = new Date().toISOString();
  await supabase
    .from('restaurants')
    .update({ active_sessions: activeOnly })
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