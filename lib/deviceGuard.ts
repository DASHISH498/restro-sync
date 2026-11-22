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

  // Purane 24 ghante se inactive sessions saaf karein
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  sessions = sessions.filter((s) => new Date(s.lastActive).getTime() > oneDayAgo);

  const existingIndex = sessions.findIndex((s) => s.deviceId === deviceId);
  if (existingIndex !== -1) {
    sessions[existingIndex].lastActive = new Date().toISOString();
  } else {
    // Agar 3 devices pehle se active hain, toh sabse purana device hata dein
    if (sessions.length >= MAX_DEVICES) {
      sessions.sort((a, b) => new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime());
      sessions.shift();
    }
    sessions.push({ deviceId, lastActive: new Date().toISOString() });
  }

  await supabase
    .from('restaurants')
    .update({ active_sessions: sessions })
    .eq('id', restaurantId);

  return true;
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