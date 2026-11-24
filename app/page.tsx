'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { claimSingleRoleSession } from '@/lib/roleSessionGuard';
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
  Store,
} from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  city: string;
  total_tables: number;
  owner_pin: string;
  staff_pin?: string | null;
  owner_phone?: string | null;
  outlet_mode?: 'single' | 'multiple' | null;
  outlet_label?: string | null;
}

type ResetTargetRole = 'owner' | 'staff';
type OutletTabMode = 'single' | 'multiple';

interface PricingPlan {
  id: string;
  duration: string;
  subtitle: string;
  price: string;
  perMonth?: string;
  amount: number;
  durationDays: number;
  badge: string | null;
  popular: boolean;
  features: string[];
}

const SINGLE_OUTLET_PLANS: PricingPlan[] = [
  {
    id: '1_month',
    duration: '1 Month',
    subtitle: 'Starter Monthly',
    price: '₹599',
    perMonth: '₹599 / month',
    amount: 599,
    durationDays: 30,
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
    amount: 1699,
    durationDays: 90,
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
    amount: 3299,
    durationDays: 180,
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
    amount: 5499,
    durationDays: 365,
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
    amount: 19999,
    durationDays: 36500,
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

// Same 5 durations as Single Outlet, priced ~7% below reference tiers with distinct multi-outlet features
const MULTIPLE_OUTLET_PLANS: PricingPlan[] = [
  {
    id: 'multi_1_month',
    duration: '1 Month',
    subtitle: 'Up to 2 Outlets • Monthly',
    price: '₹1,115',
    perMonth: '₹1,115 / month',
    amount: 1,
    durationDays: 30,
    badge: '7% Below Market',
    popular: false,
    features: [
      'Up to 2 Outlets Linked by Phone',
      'Combined Sales View Across Outlets',
      'Master Password Protected Summary',
      'Separate Table QRs & KDS per Branch',
    ],
  },
  {
    id: 'multi_3_months',
    duration: '3 Months',
    subtitle: 'Up to 5 Outlets • Quarterly',
    price: '₹11,159',
    perMonth: '₹3,720 / month',
    amount: 2,
    durationDays: 90,
    badge: '7% Below ₹12k Tier',
    popular: false,
    features: [
      'Everything in 1 Month Multi Plan',
      'Up to 5 Outlets Under One Owner',
      'Outlet-Wise Revenue Breakdown',
      'Invoice & UTR Search Across Branches',
    ],
  },
  {
    id: 'multi_6_months',
    duration: '6 Months',
    subtitle: 'Up to 8 Outlets • Half-Yearly',
    price: '₹18,599',
    perMonth: '₹3,100 / month',
    amount: 3,
    durationDays: 180,
    badge: '7% Below ₹20k Tier',
    popular: false,
    features: [
      'Everything in 3 Months Multi Plan',
      'Up to 8 Active Outlets Supported',
      'Custom Date-Range Multi-Branch Reports',
      'Per-Outlet Quick Stock Control',
    ],
  },
  {
    id: 'multi_yearly',
    duration: 'Yearly',
    subtitle: 'Up to 15 Outlets • 12 Months',
    price: '₹27,899',
    perMonth: '₹2,325 / month',
    amount: 4,
    durationDays: 365,
    badge: '7% Below ₹30k Tier',
    popular: true,
    features: [
      'Everything in 6 Months Multi Plan',
      'Up to 15 Outlets Under One Owner',
      'Full-Year Chain Sales & Cash/UPI Split',
      'Priority Multi-Outlet Setup Help',
    ],
  },
  {
    id: 'multi_lifetime',
    duration: 'Lifetime',
    subtitle: 'Unlimited Outlets • One-Time',
    price: '₹37,199',
    perMonth: 'Pay once, use forever',
    amount: 5,
    durationDays: 36500,
    badge: '7% Below ₹40k Tier',
    popular: false,
    features: [
      'Unlimited Outlets Under Owner Phone',
      'One-Time Fee • Zero Renewal Charges',
      'All Chain Analytics & Master Lock',
      'Dedicated VIP Support Included',
    ],
  },
];

function formatRestaurantDisplayName(rest: Restaurant): string {
  const label = rest.outlet_label?.trim();
  if (rest.outlet_mode === 'multiple' && label) {
    return `${rest.name} — ${label}`;
  }
  return rest.name;
}

export default function HomePage() {
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Pricing Tab & Plan Payment States
  const [pricingTab, setPricingTab] = useState<OutletTabMode>('single');
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [planBannerMsg, setPlanBannerMsg] = useState<string | null>(null);
  const [planErrorMsg, setPlanErrorMsg] = useState<string | null>(null);
  const [verifiedPlanCheckout, setVerifiedPlanCheckout] = useState<{
    planId: string;
    planLabel: string;
    outletMode: OutletTabMode;
    durationDays: number;
    paymentId?: string;
  } | null>(null);

  // PIN Login Modal States
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot PIN States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetTargetRole, setResetTargetRole] = useState<ResetTargetRole>('owner');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [newPin, setNewPin] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Register Restaurant Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedPlanLabel, setSelectedPlanLabel] = useState<string>('Yearly (₹5,499)');
  const [outletMode, setOutletMode] = useState<OutletTabMode>('single');
  const [outletLabel, setOutletLabel] = useState('');
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
    setResetTargetRole('owner');
    setShowRegisterModal(false);

    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select(
          'id, name, city, total_tables, owner_pin, staff_pin, owner_phone, outlet_mode, outlet_label'
        )
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRestaurants(data as Restaurant[]);
      } else {
        const { data: fallbackData } = await supabase
          .from('restaurants')
          .select('id, name, city, total_tables, owner_pin, staff_pin, owner_phone')
          .order('created_at', { ascending: false });
        if (fallbackData) {
          setRestaurants(fallbackData as Restaurant[]);
        }
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
    setIsForgotMode(false);
    setResetTargetRole('owner');
    setRecoveryPhone('');
    setNewPin('');
    setResetSuccessMsg('');
  };

  const handleClosePinModal = () => {
    setSelectedRestaurant(null);
    setPin('');
    setErrorMsg('');
    setVerifying(false);
    setIsForgotMode(false);
    setResetTargetRole('owner');
    setRecoveryPhone('');
    setNewPin('');
    setResetSuccessMsg('');
  };

  const handleStartForgotMode = (targetRole: ResetTargetRole) => {
    setResetTargetRole(targetRole);
    setIsForgotMode(true);
    setRecoveryPhone('');
    setNewPin('');
    setErrorMsg('');
    setResetSuccessMsg('');
  };

  const handlePinLogin = async (e?: React.FormEvent, enteredPin?: string) => {
    if (e) e.preventDefault();
    const activePin = enteredPin ?? pin;
    if (!selectedRestaurant || activePin.length !== 6 || verifying) return;

    setVerifying(true);
    setErrorMsg('');

    const isOwner = activePin === selectedRestaurant.owner_pin;
    const isStaff =
      selectedRestaurant.staff_pin && activePin === selectedRestaurant.staff_pin;

    if (isOwner || isStaff) {
      const role: 'owner' | 'staff' = isOwner ? 'owner' : 'staff';
      await claimSingleRoleSession(selectedRestaurant.id, role);

      const displayName = formatRestaurantDisplayName(selectedRestaurant);

      localStorage.setItem(
        'restro_session',
        JSON.stringify({
          restaurantId: selectedRestaurant.id,
          restaurantName: displayName,
          brandName: selectedRestaurant.name,
          outletLabel: selectedRestaurant.outlet_label || null,
          outletMode: selectedRestaurant.outlet_mode || 'single',
          ownerPhone: selectedRestaurant.owner_phone || null,
          city: selectedRestaurant.city,
          totalTables: selectedRestaurant.total_tables,
          role,
        })
      );
      router.push(role === 'owner' ? '/dashboard' : `/kitchen/${selectedRestaurant.id}`);
    } else {
      setErrorMsg('Incorrect PIN! Please enter a valid 6-digit PIN.');
      setPin('');
      setVerifying(false);
    }
  };

  const handlePinChange = (rawVal: string) => {
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    setErrorMsg('');

    if (digitsOnly.length === 6) {
      handlePinLogin(undefined, digitsOnly);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant) return;
    setErrorMsg('');
    setResetSuccessMsg('');

    const roleLabel = resetTargetRole === 'owner' ? 'Owner' : 'Staff';
    const cleanPhone = recoveryPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit registered owner mobile number.');
      return;
    }
    if (newPin.length !== 6) {
      setErrorMsg(`Please enter a new 6-digit ${roleLabel} PIN.`);
      return;
    }

    if (!selectedRestaurant.owner_phone) {
      setErrorMsg('No mobile number is linked with this restaurant. Please contact support.');
      return;
    }

    if (cleanPhone !== selectedRestaurant.owner_phone) {
      setErrorMsg('Mobile number does not match! Enter the registered owner number.');
      return;
    }

    setResettingPin(true);

    const updatePayload =
      resetTargetRole === 'owner' ? { owner_pin: newPin } : { staff_pin: newPin };

    const { error } = await supabase
      .from('restaurants')
      .update(updatePayload)
      .eq('id', selectedRestaurant.id);

    setResettingPin(false);

    if (error) {
      setErrorMsg(`Failed to update ${roleLabel} PIN. Please try again.`);
      return;
    }

    const updatedRest: Restaurant = {
      ...selectedRestaurant,
      ...updatePayload,
    };
    setSelectedRestaurant(updatedRest);
    setRestaurants((prev) =>
      prev.map((r) => (r.id === updatedRest.id ? updatedRest : r))
    );

    setResetSuccessMsg(`${roleLabel} PIN has been reset! Please sign in with your new PIN.`);
    setTimeout(() => {
      setIsForgotMode(false);
      setPin('');
      setRecoveryPhone('');
      setNewPin('');
      setResetSuccessMsg('');
    }, 1500);
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayAndSelectPlan = async (plan: PricingPlan, mode: OutletTabMode) => {
    setPlanErrorMsg(null);
    setPlanBannerMsg(null);
    setPayingPlanId(plan.id);

    const label = `${plan.duration} (${plan.price})`;

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPlanErrorMsg('Unable to load Razorpay gateway. Please check your connection.');
        setPayingPlanId(null);
        return;
      }

      const res = await fetch('/api/razorpay/create-subscription-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.amount,
          planId: plan.id,
          planName: plan.duration,
          outletMode: mode,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.orderId) {
        setPlanErrorMsg(orderData.error || 'Unable to initiate subscription payment.');
        setPayingPlanId(null);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'RestroSync POS',
        description: `${label} • ${
          mode === 'multiple' ? 'Multiple Outlets' : 'Single Outlet'
        }`,
        order_id: orderData.orderId,
        theme: {
          color: '#ea580c',
        },
        handler: function (response: { razorpay_payment_id?: string }) {
          const verified = {
            planId: plan.id,
            planLabel: label,
            outletMode: mode,
            durationDays: plan.durationDays,
            paymentId: response?.razorpay_payment_id,
          };

          setVerifiedPlanCheckout(verified);
          localStorage.setItem('restro_selected_plan', JSON.stringify(verified));
          setPayingPlanId(null);
          setPlanBannerMsg(
            `${label} (${
              mode === 'multiple' ? 'Multiple Outlets' : 'Single Outlet'
            }) payment verified! Complete registration to launch your outlet.`
          );

          setSelectedPlanLabel(label);
          setOutletMode(mode);
          setOutletLabel('');
          setRegName('');
          setRegCity('');
          setRegPhone('');
          setRegTables(10);
          setRegOwnerPin('');
          setRegStaffPin('');
          setRegError('');
          setShowRegisterModal(true);
        },
        modal: {
          ondismiss: function () {
            setPayingPlanId(null);
          },
        },
      };

      const RazorpayConstructor = (
        window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }
      ).Razorpay;
      const rzp = new RazorpayConstructor(options);
      rzp.open();
    } catch {
      setPlanErrorMsg('Something went wrong while opening Razorpay.');
      setPayingPlanId(null);
    }
  };

  const handleOpenRegisterModal = (
    planName = 'Yearly (₹5,499)',
    mode: OutletTabMode = 'single'
  ) => {
    setSelectedPlanLabel(planName);
    setOutletMode(mode);
    setOutletLabel('');
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
    const cleanOutletLabel = outletLabel.trim();

    if (!regName.trim() || !regCity.trim()) {
      setRegError('Restaurant name and city are required.');
      return;
    }
    if (outletMode === 'multiple' && !cleanOutletLabel) {
      setRegError('Please enter the Outlet / Location Name for multiple outlets.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setRegError('Please enter a valid 10-digit Owner Mobile Number.');
      return;
    }
    if (regOwnerPin.length !== 6) {
      setRegError('Setting a 6-digit Owner PIN is required.');
      return;
    }
    if (regStaffPin && regStaffPin.length !== 6) {
      setRegError('Staff PIN must also be 6 digits (or left blank).');
      return;
    }

    setRegistering(true);

    const finalTables = regTables > 0 ? regTables : 10;
    const isPaidForThisPlan =
      verifiedPlanCheckout &&
      verifiedPlanCheckout.planLabel === selectedPlanLabel &&
      verifiedPlanCheckout.outletMode === outletMode;

    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() + (isPaidForThisPlan ? verifiedPlanCheckout.durationDays : 14)
    );

    const basePayload = {
      name: regName.trim(),
      city: regCity.trim(),
      phone: cleanPhone,
      owner_phone: cleanPhone,
      total_tables: finalTables,
      owner_pin: regOwnerPin,
      staff_pin: regStaffPin || null,
      subscription_status: isPaidForThisPlan ? 'active' : 'free_trial',
      selected_plan: selectedPlanLabel,
      trial_ends_at: expiryDate.toISOString(),
    };

    let savedOutletMode: OutletTabMode = outletMode;
    let savedOutletLabel: string | null =
      outletMode === 'multiple' ? cleanOutletLabel : null;

    let insertResult = await supabase
      .from('restaurants')
      .insert([
        {
          ...basePayload,
          outlet_mode: outletMode,
          outlet_label: savedOutletLabel,
        },
      ])
      .select()
      .single();

    if (insertResult.error) {
      const errText = insertResult.error.message.toLowerCase();
      const isMissingColumnError =
        errText.includes('outlet_mode') ||
        errText.includes('outlet_label') ||
        errText.includes('column') ||
        errText.includes('schema cache');

      if (isMissingColumnError) {
        insertResult = await supabase
          .from('restaurants')
          .insert([basePayload])
          .select()
          .single();
        savedOutletMode = 'single';
        savedOutletLabel = null;
      }
    }

    const { data, error } = insertResult;
    setRegistering(false);

    if (error || !data) {
      setRegError(error?.message || 'Registration failed. Please try again.');
      return;
    }

    await claimSingleRoleSession(data.id, 'owner');

    const createdRest: Restaurant = {
      ...(data as Restaurant),
      outlet_mode: savedOutletMode,
      outlet_label: savedOutletLabel,
    };

    localStorage.setItem(
      'restro_session',
      JSON.stringify({
        restaurantId: data.id,
        restaurantName: formatRestaurantDisplayName(createdRest),
        brandName: data.name,
        outletLabel: createdRest.outlet_label,
        outletMode: savedOutletMode,
        ownerPhone: cleanPhone,
        city: data.city,
        totalTables: data.total_tables,
        role: 'owner',
      })
    );

    router.push('/dashboard');
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      (r.outlet_label && r.outlet_label.toLowerCase().includes(q))
    );
  });

  const activeResetLabel = resetTargetRole === 'owner' ? 'Owner' : 'Staff';
  const displayedPlans =
    pricingTab === 'single' ? SINGLE_OUTLET_PLANS : MULTIPLE_OUTLET_PLANS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
              onClick={() => handleOpenRegisterModal('Yearly (₹5,499)', 'single')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register Restaurant</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-3.5 py-1 rounded-full mb-4">
            14-Day Free Trial • No Hardware Needed
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            From Table Straight to Kitchen —{' '}
            <span className="text-orange-600">Smart Restaurant POS & KDS</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-500 mt-4 leading-relaxed">
            Search your restaurant name or location, enter your 6-digit PIN, and manage Table
            Orders, QR Menus, and Live Kitchen Display in real time.
          </p>

          <div className="mt-8 max-w-lg mx-auto">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurant name, location, or city..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 focus:border-orange-500 rounded-2xl text-sm sm:text-base font-medium shadow-sm outline-none transition"
              />
            </div>

            {searchQuery.trim().length > 0 && (
              <div className="mt-3 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden text-left">
                {loading ? (
                  <p className="p-4 text-xs text-slate-500 text-center">Searching...</p>
                ) : filteredRestaurants.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 text-center">
                    No restaurant found. Register a new one!
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
                            <p className="font-bold text-slate-900 text-sm">
                              {formatRestaurantDisplayName(rest)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {rest.city} • {rest.total_tables} Tables
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-extrabold text-orange-600 flex items-center gap-1">
                          Select & Login <ArrowRight className="w-3.5 h-3.5" />
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
                onClick={() => handleOpenRegisterModal('Yearly (₹5,499)', 'single')}
                className="text-xs font-bold text-orange-600 hover:underline"
              >
                New restaurant? Register for free here &rarr;
              </button>
            </div>
          </div>
        </div>

        <section className="mt-20 max-w-6xl mx-auto">
          <h2 className="text-center text-xl sm:text-2xl font-extrabold text-slate-900 mb-8">
            Everything in One Portal
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
                Dedicated QR code for every table. Customers scan and order directly without
                installing an app.
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
                Get instant alerts and live KOT tickets on the kitchen screen as soon as an order
                arrives.
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
                Real-time dish availability toggle, Cash/UPI settlement, and daily sales tracking.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-24 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold px-3.5 py-1 rounded-full mb-2.5">
                <Sparkles className="w-3.5 h-3.5" /> Simple & Transparent Plans
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Choose the Best Plan for Your Restaurant
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                Every plan includes a <strong>14-Day Free Trial</strong> or instant activation via
                Razorpay.
              </p>
            </div>

            <div className="inline-flex bg-slate-200/80 p-1 rounded-2xl border border-slate-300/70 self-start md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPricingTab('single');
                  setPlanErrorMsg(null);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer ${
                  pricingTab === 'single'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Single Outlet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPricingTab('multiple');
                  setPlanErrorMsg(null);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer ${
                  pricingTab === 'multiple'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Multiple Outlets</span>
              </button>
            </div>
          </div>

          {planBannerMsg && (
            <div className="mb-6 bg-emerald-600 text-white px-4 py-3 rounded-2xl text-xs sm:text-sm font-extrabold shadow-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{planBannerMsg}</span>
            </div>
          )}

          {planErrorMsg && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold">
              {planErrorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {displayedPlans.map((plan) => {
              const isLifetime = plan.id.includes('lifetime');
              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-5 flex flex-col justify-between transition relative ${
                    plan.popular
                      ? 'bg-slate-900 text-white border-2 border-orange-500 shadow-xl'
                      : isLifetime
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
                              : isLifetime
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
                        {plan.perMonth || `${plan.duration} Plan`}
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

                  <div className="mt-6 space-y-2">
                    <button
                      type="button"
                      disabled={payingPlanId === plan.id}
                      onClick={() => handlePayAndSelectPlan(plan, pricingTab)}
                      className={`w-full py-2.5 rounded-2xl text-xs font-extrabold transition disabled:opacity-50 ${
                        plan.popular
                          ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md'
                          : isLifetime
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {payingPlanId === plan.id
                        ? 'Opening Payment...'
                        : `Pay ${plan.price} & Register →`}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenRegisterModal(`${plan.duration} (${plan.price})`, pricingTab)
                      }
                      className={`w-full py-1.5 rounded-xl text-[11px] font-bold transition ${
                        plan.popular
                          ? 'text-slate-300 hover:text-white'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Start 14-Day Free Trial
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

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
                <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                {verifiedPlanCheckout?.planLabel === selectedPlanLabel &&
                verifiedPlanCheckout?.outletMode === outletMode
                  ? `Paid & Active • ${selectedPlanLabel}`
                  : `14-Day Trial • ${selectedPlanLabel}`}
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">Register Restaurant</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Fill in your details to launch your POS & QR Menu right away.
              </p>
            </div>

            <form onSubmit={handleRegisterRestaurant} autoComplete="off" className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Restaurant Setup Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOutletMode('single');
                      setOutletLabel('');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition ${
                      outletMode === 'single'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Single Outlet
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutletMode('multiple')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition ${
                      outletMode === 'multiple'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Multiple Outlets
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Restaurant / Brand Name *
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

              {outletMode === 'multiple' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Outlet / Location Name *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={outletLabel}
                      onChange={(e) => setOutletLabel(e.target.value)}
                      placeholder="e.g. Location A (Vaishali Nagar)"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-orange-300 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                    />
                  </div>
                </div>
              )}

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
                  Owner Mobile Number (For Forgot PIN & Combined Sales) *
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
                    Owner PIN (6-Digit) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoComplete="new-password"
                      value={regOwnerPin}
                      onChange={(e) =>
                        setRegOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
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
                      maxLength={6}
                      autoComplete="new-password"
                      value={regStaffPin}
                      onChange={(e) =>
                        setRegStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
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
              {formatRestaurantDisplayName(selectedRestaurant)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{selectedRestaurant.city}</p>

            {!isForgotMode ? (
              <form onSubmit={handlePinLogin} autoComplete="off" className="mt-6 space-y-4">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Enter 6-Digit Owner or Staff PIN
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  autoComplete="new-password"
                  name="restro_pin_code"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  placeholder="••••••"
                  className="w-full text-center text-2xl tracking-[0.65em] font-extrabold py-3.5 border-2 border-slate-200 focus:border-orange-500 rounded-2xl outline-none transition"
                />

                {errorMsg && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pin.length !== 6 || verifying}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition"
                >
                  {verifying ? 'Checking PIN...' : 'Unlock Dashboard'}
                </button>

                <div className="pt-1 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartForgotMode('owner')}
                    className="text-xs font-bold text-slate-500 hover:text-orange-600 transition"
                  >
                    Forgot Owner PIN? Reset Here &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartForgotMode('staff')}
                    className="text-xs font-bold text-slate-500 hover:text-orange-600 transition"
                  >
                    Forgot Staff PIN? Reset Here &rarr;
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleResetPin}
                autoComplete="off"
                className="mt-5 space-y-3.5 text-left"
              >
                <p className="text-xs text-slate-500 text-center">
                  Verify your registered <strong>Owner Mobile Number</strong> to set a new 6-digit{' '}
                  <strong>{activeResetLabel} PIN</strong>.
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
                    Set New 6-Digit {activeResetLabel} PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoComplete="new-password"
                      value={newPin}
                      onChange={(e) =>
                        setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
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
                  {resettingPin
                    ? `Updating ${activeResetLabel} PIN...`
                    : `Verify & Set New ${activeResetLabel} PIN`}
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