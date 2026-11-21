'use client';

import React, { useState, useEffect } from 'react';
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
  Phone,
  KeyRound,
  CheckCircle2,
  MapPin,
  Hash,
  Check,
  Sparkles,
} from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  city: string;
  total_tables: number;
  owner_pin: string;
  staff_pin?: string | null;
  owner_phone?: string | null;
}

const PRICING_PLANS = [
  {
    id: '1_month',
    duration: '1 Month',
    subtitle: 'Starter Monthly',
    price: '₹599',
    perMonth: '₹599 / month',
    badge: null,
    popular: false,
    features: [
      'Unlimited Table QR Menus',
      'Live Kitchen Display (KDS)',
      'Owner & Staff PIN Roles',
      'Daily Sales & Billing History',
    ],
  },
  {
    id: '3_months',
    duration: '3 Months',
    subtitle: 'Quarterly Plan',
    price: '₹1,699',
    perMonth: '₹566 / month',
    badge: 'Save ₹98',
    popular: false,
    features: [
      'Everything in 1 Month Plan',
      'Quick Dish Stock Toggle',
      'Cash & UPI Payment Split',
      'Priority WhatsApp Support',
    ],
  },
  {
    id: '6_months',
    duration: '6 Months',
    subtitle: 'Half-Yearly Plan',
    price: '₹3,299',
    perMonth: '₹550 / month',
    badge: 'Save ₹295',
    popular: false,
    features: [
      'Everything in 3 Months Plan',
      'Custom Date Range Reports',
      'Unlimited Tables & Dishes',
      'Free Menu Setup Support',
    ],
  },
  {
    id: 'yearly',
    duration: 'Yearly',
    subtitle: '12 Months Pro',
    price: '₹5,499',
    perMonth: '₹458 / month',
    badge: 'Save ₹1,689',
    popular: true,
    features: [
      'Everything in 6 Months Plan',
      'Best Annual Value (23% Off)',
      'Dedicated Onboarding Call',
      'All Future Updates Included',
    ],
  },
  {
    id: 'lifetime',
    duration: 'Lifetime',
    subtitle: 'One-Time Payment',
    price: '₹19,999',
    perMonth: 'Pay once, use forever',
    badge: 'Zero Renewal',
    popular: false,
    features: [
      'Lifetime POS & KDS Access',
      'No Monthly or Yearly Fees',
      'VIP Priority Support',
      'All Future Pro Features Free',
    ],
  },
];

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

  // Forgot PIN States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [newOwnerPin, setNewOwnerPin] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Register Restaurant Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedPlanLabel, setSelectedPlanLabel] = useState<string>('Yearly (₹5,499)');
  const [regName, setRegName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTables, setRegTables] = useState<number>(10);
  const [regOwnerPin, setRegOwnerPin] = useState('');
  const [regStaffPin, setRegStaffPin] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  useEffect(() => {
    setSelectedRestaurant(null);
    setPin('');
    setVerifying(false);
    setErrorMsg('');
    setIsForgotMode(false);
    setShowRegisterModal(false);

    const fetchRestaurants = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, city, total_tables, owner_pin, staff_pin, owner_phone')
        .order('created_at', { ascending: false });

      if (data) {
        setRestaurants(data);
      }
      setLoading(false);
    };

    fetchRestaurants();
  }, []);

  // --- LOGIN & FORGOT PIN HANDLERS ---
  const handleOpenPinModal = (rest: Restaurant) => {
    setSelectedRestaurant(rest);
    setPin('');
    setErrorMsg('');
    setVerifying(false);
    setIsForgotMode(false);
    setRecoveryPhone('');
    setNewOwnerPin('');
    setResetSuccessMsg('');
  };

  const handleClosePinModal = () => {
    setSelectedRestaurant(null);
    setPin('');
    setErrorMsg('');
    setVerifying(false);
    setIsForgotMode(false);
    setRecoveryPhone('');
    setNewOwnerPin('');
    setResetSuccessMsg('');
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

  const handleResetOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant) return;
    setErrorMsg('');
    setResetSuccessMsg('');

    const cleanPhone = recoveryPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('Kripya 10-digit registered mobile number dalein.');
      return;
    }
    if (newOwnerPin.length !== 4) {
      setErrorMsg('Naya 4-digit Owner PIN dalein.');
      return;
    }

    if (!selectedRestaurant.owner_phone) {
      setErrorMsg(
        'Is restaurant ke saath koi mobile number linked nahi hai. Admin se sampark karein.'
      );
      return;
    }

    if (cleanPhone !== selectedRestaurant.owner_phone) {
      setErrorMsg('Mobile number match nahi hua! Registered owner number dalein.');
      return;
    }

    setResettingPin(true);

    const { error } = await supabase
      .from('restaurants')
      .update({ owner_pin: newOwnerPin })
      .eq('id', selectedRestaurant.id);

    setResettingPin(false);

    if (error) {
      setErrorMsg('PIN update karne mein error aaya. Dubara try karein.');
      return;
    }

    const updatedRest: Restaurant = {
      ...selectedRestaurant,
      owner_pin: newOwnerPin,
    };
    setSelectedRestaurant(updatedRest);
    setRestaurants((prev) =>
      prev.map((r) => (r.id === updatedRest.id ? updatedRest : r))
    );

    setResetSuccessMsg('Owner PIN reset ho gaya! Ab naye PIN se login karein.');
    setTimeout(() => {
      setIsForgotMode(false);
      setPin('');
      setRecoveryPhone('');
      setNewOwnerPin('');
      setResetSuccessMsg('');
    }, 1500);
  };

  // --- REGISTER RESTAURANT HANDLER (WITH 14-DAY TRIAL & SELECTED PLAN) ---
  const handleOpenRegisterModal = (planName = 'Yearly (₹5,499)') => {
    setSelectedPlanLabel(planName);
    setRegName('');
    setRegCity('');
    setRegPhone('');
    setRegTables(10);
    setRegOwnerPin('');
    setRegStaffPin('');
    setRegError('');
    setShowRegisterModal(true);
  };

  const handleRegisterRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (!regName.trim() || !regCity.trim()) {
      setRegError('Restaurant ka naam aur city zaroori hai.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setRegError('Kripya sahi 10-digit Owner Mobile Number dalein.');
      return;
    }
    if (regOwnerPin.length !== 4) {
      setRegError('4-digit Owner PIN set karna zaroori hai.');
      return;
    }
    if (regStaffPin && regStaffPin.length !== 4) {
      setRegError('Staff PIN bhi 4-digit ka hona chahiye (ya khali chhodein).');
      return;
    }

    setRegistering(true);

    const finalTables = regTables > 0 ? regTables : 10;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const { data, error } = await supabase
      .from('restaurants')
      .insert([
        {
          name: regName.trim(),
          city: regCity.trim(),
          phone: cleanPhone,
          owner_phone: cleanPhone,
          total_tables: finalTables,
          owner_pin: regOwnerPin,
          staff_pin: regStaffPin || null,
          subscription_status: 'free_trial',
          selected_plan: selectedPlanLabel,
          trial_ends_at: trialEnd.toISOString(),
        },
      ])
      .select()
      .single();

    setRegistering(false);

    if (error || !data) {
      setRegError('Registration fail hua. Kripya dubara try karein.');
      return;
    }

    localStorage.setItem(
      'restro_session',
      JSON.stringify({
        restaurantId: data.id,
        restaurantName: data.name,
        city: data.city,
        totalTables: data.total_tables,
        role: 'owner',
      })
    );

    router.push('/dashboard');
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-600 text-white p-2 rounded-xl shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Restro<span className="text-orange-600">Sync</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#pricing"
              className="hidden sm:inline-block text-xs font-extrabold text-slate-600 hover:text-orange-600 transition"
            >
              Plans & Pricing
            </a>

            <button
              type="button"
              onClick={() => handleOpenRegisterModal('Yearly (₹5,499)')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register Restaurant</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section & Restaurant Search */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20">
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
              <button
                type="button"
                onClick={() => handleOpenRegisterModal('Yearly (₹5,499)')}
                className="text-xs font-bold text-orange-600 hover:underline"
              >
                Naya Restaurant hai? Yahan Free Register Karein &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <section className="mt-20 max-w-6xl mx-auto">
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

        {/* PRICING PLANS SECTION */}
        <section id="pricing" className="mt-24 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold px-3.5 py-1 rounded-full mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Simple & Transparent Plans
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Apne Restaurant Ke Liye Best Plan Chunein
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Har plan ke saath pehle <strong>14 Din Bilkul Free Trial</strong> milega. Koi setup fee
              ya hidden charge nahi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-3xl p-5 flex flex-col justify-between transition relative ${
                  plan.popular
                    ? 'bg-slate-900 text-white border-2 border-orange-500 shadow-xl'
                    : plan.id === 'lifetime'
                    ? 'bg-gradient-to-b from-amber-50/80 to-white text-slate-900 border-2 border-amber-300 shadow-sm'
                    : 'bg-white text-slate-900 border border-slate-200 shadow-sm hover:border-orange-300'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow whitespace-nowrap">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-base font-extrabold">{plan.duration}</h3>
                    {plan.badge && (
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          plan.popular
                            ? 'bg-orange-500/20 text-orange-300'
                            : plan.id === 'lifetime'
                            ? 'bg-amber-200/70 text-amber-900'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      plan.popular ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {plan.subtitle}
                  </p>

                  <div className="mt-4 pb-4 border-b border-slate-200/30">
                    <span className="text-2xl sm:text-3xl font-extrabold">{plan.price}</span>
                    <span
                      className={`block text-[11px] mt-1 ${
                        plan.popular ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {plan.perMonth}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2 text-xs">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            plan.popular ? 'text-orange-400' : 'text-emerald-600'
                          }`}
                        />
                        <span className={plan.popular ? 'text-slate-200' : 'text-slate-600'}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenRegisterModal(`${plan.duration} (${plan.price})`)}
                  className={`mt-6 w-full py-2.5 rounded-2xl text-xs font-extrabold transition ${
                    plan.popular
                      ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md'
                      : plan.id === 'lifetime'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  Start Free Trial &rarr;
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* REGISTER RESTAURANT MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowRegisterModal(false)}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> 14-Day Trial • {selectedPlanLabel}
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">Register Restaurant</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Details bharein aur turant apna POS & QR Menu shuru karein.
              </p>
            </div>

            <form onSubmit={handleRegisterRestaurant} autoComplete="off" className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Restaurant / Cafe Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Spice Garden Cafe"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="e.g. Jaipur"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Owner Mobile Number (For Forgot PIN Recovery) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={regPhone}
                    onChange={(e) =>
                      setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Number of Tables *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={regTables || ''}
                    onChange={(e) => setRegTables(parseInt(e.target.value, 10) || 0)}
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Owner PIN (4-Digit) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      autoComplete="new-password"
                      value={regOwnerPin}
                      onChange={(e) =>
                        setRegOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="••••"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm font-bold tracking-widest outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Staff PIN (Optional)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="new-password"
                      value={regStaffPin}
                      onChange={(e) =>
                        setRegStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="••••"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm font-bold tracking-widest outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {regError && (
                <p className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl text-center">
                  {regError}
                </p>
              )}

              <button
                type="submit"
                disabled={registering}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition"
              >
                {registering ? 'Creating Restaurant...' : 'Create Restaurant & Launch POS →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PIN LOGIN & FORGOT PIN RESET MODAL */}
      {selectedRestaurant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 shadow-2xl relative text-center">
            <button
              type="button"
              onClick={handleClosePinModal}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
              {isForgotMode ? <KeyRound className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>

            <h3 className="text-lg font-extrabold text-slate-900">
              {selectedRestaurant.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{selectedRestaurant.city}</p>

            {!isForgotMode ? (
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

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setErrorMsg('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-orange-600 transition"
                  >
                    Forgot Owner PIN? Reset Here &rarr;
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleResetOwnerPin}
                autoComplete="off"
                className="mt-5 space-y-3.5 text-left"
              >
                <p className="text-xs text-slate-500 text-center">
                  Registered <strong>Owner Mobile Number</strong> verify karke naya 4-digit PIN set karein.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Registered Owner Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={recoveryPhone}
                      onChange={(e) =>
                        setRecoveryPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="10-digit mobile number"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Set New 4-Digit Owner PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      autoComplete="new-password"
                      value={newOwnerPin}
                      onChange={(e) =>
                        setNewOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="••••"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm font-bold tracking-widest outline-none transition"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl text-center">
                    {errorMsg}
                  </p>
                )}

                {resetSuccessMsg && (
                  <p className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {resetSuccessMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={resettingPin}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-extrabold py-3 rounded-2xl text-sm shadow-md transition"
                >
                  {resettingPin ? 'Updating PIN...' : 'Verify & Set New PIN'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setErrorMsg('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                  >
                    &larr; Back to PIN Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}