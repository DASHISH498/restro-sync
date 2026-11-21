'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Search,
  UtensilsCrossed,
  QrCode,
  MonitorPlay,
  ShieldCheck,
  PlusCircle,
  X,
  Lock,
  ArrowRight,
  Store,
  CheckCircle2,
} from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  city: string;
  phone: string;
  total_tables: number;
}

export default function LandingPage() {
  const router = useRouter();

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected Restaurant & PIN Login Modal
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    city: '',
    phone: '',
    total_tables: 10,
    owner_pin: '',
    staff_pin: '',
  });
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // 1. Auto-Login Check (Remember Device)
  useEffect(() => {
    const savedSession = localStorage.getItem('restro_session');
    if (savedSession) {
      router.push('/dashboard');
    }
  }, [router]);

  // 2. Live Search Restaurants from Supabase
  useEffect(() => {
    const fetchRestaurants = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, city, phone, total_tables')
        .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(5);

      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };

    const delayDebounce = setTimeout(() => {
      fetchRestaurants();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // 3. Handle 4-Digit PIN Verification
  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant) return;

    if (pinInput.length !== 4) {
      setLoginError('Kripya 4-digit PIN daalein.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, city, phone, total_tables, owner_pin, staff_pin')
      .eq('id', selectedRestaurant.id)
      .single();

    if (error || !data) {
      setLoginError('System error. Dobara koshish karein.');
      setIsLoggingIn(false);
      return;
    }

    let role: 'owner' | 'staff' | null = null;
    if (pinInput === data.owner_pin) {
      role = 'owner';
    } else if (pinInput === data.staff_pin) {
      role = 'staff';
    }

    if (!role) {
      setLoginError('Galat PIN! Sahi 4-digit PIN daalein.');
      setIsLoggingIn(false);
      return;
    }

    // Save Session in LocalStorage for Auto-Login
    const sessionData = {
      restaurantId: data.id,
      restaurantName: data.name,
      city: data.city,
      totalTables: data.total_tables,
      role: role,
    };

    localStorage.setItem('restro_session', JSON.stringify(sessionData));
    router.push('/dashboard');
  };

  // 4. Handle New Restaurant Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (regForm.owner_pin.length !== 4 || regForm.staff_pin.length !== 4) {
      setRegError('Owner PIN aur Staff PIN dono 4-digit ke hone chahiye.');
      return;
    }

    if (regForm.owner_pin === regForm.staff_pin) {
      setRegError('Owner PIN aur Staff PIN alag-alag rakhein.');
      return;
    }

    setIsRegistering(true);

    const { data, error } = await supabase
      .from('restaurants')
      .insert([
        {
          name: regForm.name.trim(),
          city: regForm.city.trim(),
          phone: regForm.phone.trim(),
          total_tables: Number(regForm.total_tables),
          owner_pin: regForm.owner_pin,
          staff_pin: regForm.staff_pin,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        setRegError('Yeh Mobile Number pehle se registered hai.');
      } else {
        setRegError(error.message);
      }
      setIsRegistering(false);
      return;
    }

    // Auto login after successful registration
    const sessionData = {
      restaurantId: data.id,
      restaurantName: data.name,
      city: data.city,
      totalTables: data.total_tables,
      role: 'owner',
    };

    localStorage.setItem('restro_session', JSON.stringify(sessionData));
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-orange-600 text-white p-2 rounded-xl">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Restro<span className="text-orange-600">Sync</span>
            </span>
          </div>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" />
            Register Restaurant
          </button>
        </div>
      </header>

      {/* Hero Section with Direct Search-to-Login */}
      <section className="max-w-4xl mx-auto px-4 pt-14 pb-16 text-center">
        <span className="inline-block bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
          14-Day Free Trial • No Hardware Needed
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
          Table Se Seedha Kitchen Tak — <br className="hidden sm:block" />
          <span className="text-orange-600">Smart Restaurant POS & KDS</span>
        </h1>
        <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto mb-8">
          Apne restaurant ka naam search karein, 4-digit PIN daalein aur turant Table Orders,
          QR Menu aur Live Kitchen Display manage karein.
        </p>

        {/* Search Box Container */}
        <div className="max-w-xl mx-auto relative text-left">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Apne Restaurant ka naam ya Mobile No. search karein..."
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 focus:border-orange-500 rounded-2xl shadow-lg text-base outline-none transition"
            />
          </div>

          {/* Search Results Dropdown */}
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-20 relative">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-slate-500">Searching...</div>
              ) : searchResults.length > 0 ? (
                <ul>
                  {searchResults.map((rest) => (
                    <li key={rest.id}>
                      <button
                        onClick={() => {
                          setSelectedRestaurant(rest);
                          setPinInput('');
                          setLoginError('');
                        }}
                        className="w-full px-5 py-4 text-left hover:bg-orange-50 flex items-center justify-between border-b last:border-b-0 border-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{rest.name}</p>
                            <p className="text-xs text-slate-500">
                              {rest.city} • {rest.total_tables} Tables
                            </p>
                          </div>
                        </div>
                        <span className="text-orange-600 text-sm font-semibold flex items-center gap-1">
                          Login <ArrowRight className="w-4 h-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-5 text-center">
                  <p className="text-sm text-slate-600 mb-3">
                    &quot;{searchQuery}&quot; naam se koi restaurant nahi mila.
                  </p>
                  <button
                    onClick={() => {
                      setRegForm({ ...regForm, name: searchQuery });
                      setShowRegisterModal(true);
                    }}
                    className="bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-700"
                  >
                    + &quot;{searchQuery}&quot; ko Register Karein
                  </button>
                </div>
              )}
            </div>
          )}

          {/* New Restaurant Link */}
          <div className="mt-5 text-center">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-4"
            >
              Naya Restaurant hai? Yahan Free Register Karein &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* Single Page Business & Feature Details */}
      <section className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Ek Hi Portal Mein Sab Kuch
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="bg-orange-100 text-orange-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">1. Auto Table QR & Cart</h3>
              <p className="text-sm text-slate-600">
                Har table ke liye automatic QR code. Customer ya waiter e-commerce cart ki tarah
                items add/remove karke order place karein.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="bg-emerald-100 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <MonitorPlay className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">2. Live Kitchen Display (KDS)</h3>
              <p className="text-sm text-slate-600">
                Order place hote hi beep sound ke saath kitchen screen par Table No., Dish, aur
                Chef notes dikhenge.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">3. Easy Menu & Billing</h3>
              <p className="text-sm text-slate-600">
                Apna menu, price aur ingredients khud add karein. Cash/UPI billing aur daily sales
                track karein.
              </p>
            </div>
          </div>

          {/* Simple Pricing Strip */}
          <div className="mt-16 bg-slate-900 text-white rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Simple & Affordable Pricing</h3>
              <p className="text-slate-300 text-sm mb-3">
                Pehle 14 din bilkul FREE. Uske baad sirf ₹399/month (Starter) ya ₹799/month (Pro
                with KDS).
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Unlimited Orders
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Live Kitchen Screen
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Auto QR Generator
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3.5 rounded-xl whitespace-nowrap transition"
            >
              Start 14-Day Free Trial
            </button>
          </div>
        </div>
      </section>

      {/* MODAL 1: 4-Digit PIN Login Modal */}
      {selectedRestaurant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedRestaurant(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="bg-orange-100 text-orange-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{selectedRestaurant.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedRestaurant.city}</p>
            </div>

            <form onSubmit={handlePinLogin}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 text-center mb-2">
                Enter 4-Digit Owner or Staff PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center text-3xl tracking-[0.75em] font-bold py-3 border-2 border-slate-200 focus:border-orange-500 rounded-xl outline-none mb-3"
              />

              {loginError && (
                <p className="text-red-600 text-xs text-center font-medium mb-3">{loginError}</p>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
              >
                {isLoggingIn ? 'Checking PIN...' : 'Open Restaurant Portal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Register New Restaurant Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-900 mb-1">Register Your Restaurant</h3>
            <p className="text-xs text-slate-500 mb-5">
              30 second mein apna digital menu aur kitchen system chalu karein.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Restaurant / Cafe Name *
                </label>
                <input
                  type="text"
                  required
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="e.g., Royal Spice Cafe"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={regForm.city}
                    onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                    placeholder="e.g., Jaipur"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Tables *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={regForm.total_tables}
                    onChange={(e) =>
                      setRegForm({ ...regForm, total_tables: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Owner Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={regForm.phone}
                  onChange={(e) =>
                    setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, '') })
                  }
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Owner PIN (4-Digit) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={regForm.owner_pin}
                    onChange={(e) =>
                      setRegForm({ ...regForm, owner_pin: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="e.g., 1111"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tracking-widest text-center outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-500">Full access (Menu & Sales)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff PIN (4-Digit) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={regForm.staff_pin}
                    onChange={(e) =>
                      setRegForm({ ...regForm, staff_pin: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="e.g., 2222"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tracking-widest text-center outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-500">Waiter & Kitchen screen</span>
                </div>
              </div>

              {regError && <p className="text-red-600 text-xs font-medium">{regError}</p>}

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
              >
                {isRegistering ? 'Creating Portal...' : 'Create Restaurant Portal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}