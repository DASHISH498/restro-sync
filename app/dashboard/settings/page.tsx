'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Settings,
  Store,
  KeyRound,
  CheckCircle2,
  Save,
} from 'lucide-react';

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  city: string;
  totalTables: number;
  role: 'owner' | 'staff';
}

export default function RestaurantSettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable Fields
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [totalTables, setTotalTables] = useState(10);
  const [ownerPin, setOwnerPin] = useState('');
  const [staffPin, setStaffPin] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('restro_session');
    if (!saved) {
      router.push('/');
      return;
    }
    const parsed: SessionData = JSON.parse(saved);
    if (parsed.role !== 'owner') {
      router.push('/dashboard');
      return;
    }
    setSession(parsed);

    // Fetch latest restaurant details from Supabase
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', parsed.restaurantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name || '');
          setCity(data.city || '');
          setTotalTables(Number(data.total_tables) || 10);
          setOwnerPin(data.owner_pin || '');
          setStaffPin(data.staff_pin || '');
        }
        setLoading(false);
      });
  }, [router]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !name.trim() || !ownerPin.trim() || !staffPin.trim()) return;

    setSaving(true);

    const updatedTables = Math.max(1, Math.min(100, Number(totalTables)));

    const { error } = await supabase
      .from('restaurants')
      .update({
        name: name.trim(),
        city: city.trim(),
        total_tables: updatedTables,
        owner_pin: ownerPin.trim(),
        staff_pin: staffPin.trim(),
      })
      .eq('id', session.restaurantId);

    setSaving(false);

    if (!error) {
      // Update local session so Dashboard & QR Codes immediately reflect new table count/name
      const newSession: SessionData = {
        ...session,
        restaurantName: name.trim(),
        city: city.trim(),
        totalTables: updatedTables,
      };
      localStorage.setItem('restro_session', JSON.stringify(newSession));
      setSession(newSession);

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3500);
    } else {
      alert('Failed to save settings.');
    }
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Loading Restaurant Settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-600" /> Restaurant Settings
            </h1>
            <p className="text-xs text-slate-500">
              Manage seating tables, cafe details, and login PINs
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        {savedToast && (
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">
              Settings updated! Your new table count and details are now active.
            </p>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Card 1: Restaurant & Tables Info */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-600" /> Cafe / Restaurant Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Seating Tables (1 – 100) *
              </label>
              <input
                type="number"
                required
                min="1"
                max="100"
                value={totalTables}
                onChange={(e) => setTotalTables(Number(e.target.value))}
                className="w-full sm:w-48 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:border-orange-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Updating the table count automatically refreshes tables on the Dashboard and Table QR
                Codes page.
              </p>
            </div>
          </section>

          {/* Card 2: Security PINs */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" /> Access Security PINs
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Owner PIN (Full Access) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Staff / Waiter PIN (POS & Kitchen Only) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-6 py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </form>
      </main>
    </div>
  );
}