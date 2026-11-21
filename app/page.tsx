'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  UtensilsCrossed,
  Search,
  Lock,
  X,
  ArrowRight,
  QrCode,
  ChefHat,
  Receipt,
  Plus,
  Building2,
} from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  city: string;
  total_tables: number;
  owner_pin: string;
  staff_pin?: string | null;
}

export default function HomePage() {
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // PIN Login Modal States
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Logout ke baad home page aane par saare modal aur PIN states reset rakhein
    setSelectedRestaurant(null);
    setPin('');
    setVerifying(false);
    setErrorMsg('');

    const fetchRestaurants = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, city, total_tables, owner_pin, staff_pin')
        .order('created_at', { ascending: false });

      if (data) {
        setRestaurants(data);
      }
      setLoading(false);
    };

    fetchRestaurants();
  }, []);

  const handleOpenPinModal = (rest: Restaurant) => {
    setSelectedRestaurant(rest);
    setPin('');
    setErrorMsg('');
    setVerifying(false);
  };

  const handleCloseModal = () => {
    setSelectedRestaurant(null);
    setPin('');
    setErrorMsg('');
    setVerifying(false);
  };

  const handlePinLogin = async (e?: React.FormEvent, enteredPin?: string) => {
    if (e) e.preventDefault();
    const activePin = enteredPin ?? pin;
    if (!selectedRestaurant || activePin.length !== 4 || verifying) return;

    setVerifying(true);
    setErrorMsg('');

    const isOwner = activePin === selectedRestaurant.owner_pin;
    const isStaff =
      selectedRestaurant.staff_pin && activePin === selectedRestaurant.staff_pin;

    if (isOwner || isStaff) {
      localStorage.setItem(
        'restro_session',
        JSON.stringify({
          restaurantId: selectedRestaurant.id,
          restaurantName: selectedRestaurant.name,
          city: selectedRestaurant.city,
          totalTables: selectedRestaurant.total_tables,
          role: isOwner ? 'owner' : 'staff',
        })
      );
      router.push('/dashboard');
    } else {
      setErrorMsg('Galat PIN! Kripya sahi 4-digit PIN dalein.');
      setPin('');
      setVerifying(false);
    }
  };

  const handlePinChange = (rawVal: string) => {
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
    setErrorMsg('');

    if (digitsOnly.length === 4) {
      handlePinLogin(undefined, digitsOnly);
    }
  };

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-600 text-white p-2 rounded-xl shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Restro<span className="text-orange-600">Sync</span>
            </span>
          </div>

          <Link
            href="/register"
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register Restaurant</span>
          </Link>
        </div>
      </header>

      {/* Hero Section & Restaurant Search */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-3.5 py-1 rounded-full mb-4">
            14–Day Free Trial • No Hardware Needed
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Table Se Seedha Kitchen Tak —{' '}
            <span className="text-orange-600">Smart Restaurant POS & KDS</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-500 mt-4 leading-relaxed">
            Apne restaurant ka naam search karein, 4-digit PIN dalein aur turant Table Orders,
            QR Menu aur Live Kitchen Display manage karein.
          </p>

          {/* Search Input Box */}
          <div className="mt-8 max-w-lg mx-auto">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurant name or city..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 focus:border-orange-500 rounded-2xl text-sm sm:text-base font-medium shadow-sm outline-none transition"
              />
            </div>

            {/* Search Results List */}
            {searchQuery.trim().length > 0 && (
              <div className="mt-3 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden text-left">
                {loading ? (
                  <p className="p-4 text-xs text-slate-500 text-center">Searching...</p>
                ) : filteredRestaurants.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 text-center">
                    Koi restaurant nahi mila. Naya register karein!
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {filteredRestaurants.map((rest) => (
                      <button
                        key={rest.id}
                        type="button"
                        onClick={() => handleOpenPinModal(rest)}
                        className="w-full p-4 hover:bg-orange-50/70 flex items-center justify-between transition text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{rest.name}</p>
                            <p className="text-xs text-slate-500">
                              {rest.city} • {rest.total_tables} Tables
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-extrabold text-orange-600 flex items-center gap-1">
                          Login <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <Link
                href="/register"
                className="text-xs font-bold text-orange-600 hover:underline"
              >
                Naya Restaurant hai? Yahan Free Register Karein &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <section className="mt-20">
          <h2 className="text-center text-xl sm:text-2xl font-extrabold text-slate-900 mb-8">
            Ek Hi Portal Mein Sab Kuch
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                1. Auto Table QR & Cart
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Har table ke liye alag QR code. Customer scan karke bina app download kiye seedha
                order bhej sakta hai.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <ChefHat className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                2. Live Kitchen Display (KDS)
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Naya order aate hi kitchen screen par sound alert aur live KOT ticket dikhega.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                3. Easy Menu & Billing
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Real-time dish availability toggle, Cash/UPI settlement aur daily sales tracking.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* PIN Login Modal (Browser Autofill Disabled) */}
      {selectedRestaurant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 shadow-2xl relative text-center">
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900">
              {selectedRestaurant.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{selectedRestaurant.city}</p>

            <form onSubmit={handlePinLogin} autoComplete="off" className="mt-6 space-y-4">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Enter 4-Digit Owner or Staff PIN
              </label>

              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                autoComplete="new-password"
                name="restro_pin_code"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.75em] font-extrabold py-3.5 border-2 border-slate-200 focus:border-orange-500 rounded-2xl outline-none transition"
              />

              {errorMsg && (
                <p className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={pin.length !== 4 || verifying}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition"
              >
                {verifying ? 'Checking PIN...' : 'Unlock Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}