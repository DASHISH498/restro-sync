'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  isRoleSessionActive,
  releaseRoleSessionIfOwner,
  clearLocalSessionToken,
} from '@/lib/roleSessionGuard';
import SessionReplacedDialog from '@/components/SessionReplacedDialog';
import {
  UtensilsCrossed,
  LogOut,
  IndianRupee,
  ChefHat,
  QrCode,
  BookOpen,
  CheckCircle2,
  Clock,
  Users,
  BellRing,
  Receipt,
  Sparkles,
  ShieldCheck,
  PlusCircle,
  PackageCheck,
  X,
  Utensils,
  ArrowUpRight,
  Banknote,
  Smartphone,
  Calendar,
  Crown,
  MessageCircle,
  AlertTriangle,
  Search,
  User,
  Phone,
  KeyRound,
  Store,
} from 'lucide-react';

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  brandName?: string;
  outletLabel?: string | null;
  outletMode?: 'single' | 'multiple';
  ownerPhone?: string | null;
  city: string;
  totalTables: number;
  role: 'owner' | 'staff';
}

interface OutletMeta {
  id: string;
  name: string;
  city: string;
  outlet_mode?: string | null;
  outlet_label?: string | null;
}

interface SubscriptionInfo {
  status: string;
  selectedPlan: string;
  daysLeft: number;
  isExpired: boolean;
}

interface OrderRecord {
  id: string;
  restaurant_id?: string;
  table_number: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'completed';
  total_amount: number;
  payment_method: string;
  payment_status?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_number?: string | null;
  razorpay_payment_id?: string | null;
  created_at: string;
  order_items: {
    id: string;
    item_name: string;
    quantity: number;
    price: number;
    notes?: string | null;
  }[];
}

interface MenuStockItem {
  id: string;
  name: string;
  category: string;
  is_veg: boolean;
  is_available: boolean;
}

interface MergedBillItem {
  item_name: string;
  price: number;
  quantity: number;
  notes: string[];
}

const ADMIN_WHATSAPP = '919079083101';
const MASTER_PASS_STORAGE_KEY = 'restro_master_sales_password';

const UPGRADE_PLANS = [
  {
    id: '1_month',
    name: '1 Month Plan',
    price: '₹599',
    amount: 599,
    durationDays: 30,
    tag: 'Monthly (Test)',
  },
  {
    id: '3_months',
    name: '3 Months Plan',
    price: '₹1,699',
    amount: 1699,
    durationDays: 90,
    tag: 'Quarterly (Test)',
  },
  {
    id: '6_months',
    name: '6 Months Plan',
    price: '₹3,299',
    amount: 3299,
    durationDays: 180,
    tag: 'Half-Yearly (Test)',
  },
  {
    id: 'yearly',
    name: 'Yearly Plan (12 Months)',
    price: '₹5,499',
    amount: 5499,
    durationDays: 365,
    tag: 'Most Popular (Test)',
  },
  {
    id: 'lifetime',
    name: 'Lifetime License',
    price: '₹19,999',
    amount: 19999,
    durationDays: 36500,
    tag: 'One-Time Pay (Test)',
  },
];

function formatOutletTitle(outlet: {
  name: string;
  city?: string;
  outlet_mode?: string | null;
  outlet_label?: string | null;
}): string {
  const label = outlet.outlet_label?.trim();
  if (outlet.outlet_mode === 'multiple' && label) {
    return `${outlet.name} — ${label}`;
  }
  return outlet.city ? `${outlet.name} (${outlet.city})` : outlet.name;
}

export default function DashboardPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [actualTablesCount, setActualTablesCount] = useState<number>(5);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo>({
    status: 'free_trial',
    selectedPlan: 'Yearly (₹5,499)',
    daysLeft: 14,
    isExpired: false,
  });

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ownerOutlets, setOwnerOutlets] = useState<OutletMeta[]>([]);
  const [allOutletOrders, setAllOutletOrders] = useState<OrderRecord[]>([]);
  const [salesScope, setSalesScope] = useState<'current' | 'all_outlets'>('current');
  const [loading, setLoading] = useState(true);

  // Master Password Lock for Combined Sales (resets when Bills & Sales modal closes)
  const [combinedSalesUnlocked, setCombinedSalesUnlocked] = useState(false);
  const [showMasterPassModal, setShowMasterPassModal] = useState(false);
  const [masterPassInput, setMasterPassInput] = useState('');
  const [masterPassError, setMasterPassError] = useState('');
  const [isSettingFirstMasterPass, setIsSettingFirstMasterPass] = useState(false);
  const [isForgotMasterPass, setIsForgotMasterPass] = useState(false);
  const [masterRecoveryPhone, setMasterRecoveryPhone] = useState('');
  const [newMasterPassInput, setNewMasterPassInput] = useState('');

  // Table Action Modal
  const [selectedTableModal, setSelectedTableModal] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);

  // Quick Stock Toggle Modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItems, setStockItems] = useState<MenuStockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Owner Sales History Modal, Date Filters & Bill Search
  const [todayIso, setTodayIso] = useState<string>('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salesFilter, setSalesFilter] = useState<'today' | '7days' | 'all' | 'custom'>('today');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [billSearchQuery, setBillSearchQuery] = useState<string>('');

  // Owner Plan Upgrade Modal & Razorpay State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [upgradeSuccessBanner, setUpgradeSuccessBanner] = useState<string | null>(null);
  const [upgradeErrorMsg, setUpgradeErrorMsg] = useState<string | null>(null);

  // Owner Payment Setup Modal (Merchant UPI ID + Optional Razorpay)
  const [showPaymentSettingsModal, setShowPaymentSettingsModal] = useState(false);
  const [ownerUpiId, setOwnerUpiId] = useState('');
  const [ownerBankName, setOwnerBankName] = useState('');
  const [ownerRzpKeyId, setOwnerRzpKeyId] = useState('');
  const [ownerRzpKeySecret, setOwnerRzpKeySecret] = useState('');
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [paymentSettingsMsg, setPaymentSettingsMsg] = useState<string | null>(null);
  const [isPaymentConfigured, setIsPaymentConfigured] = useState<boolean>(true);
  const [savedPaymentInfo, setSavedPaymentInfo] = useState({
    upiId: '',
    bankName: '',
    rzpKeyId: '',
    rzpKeySecret: '',
  });

  // 1-Hour Inactivity Modal & Session Replaced Dialog
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [sessionReplaced, setSessionReplaced] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTodayIso(today);
    setCustomFromDate(today);
    setCustomToDate(today);

    const raw = localStorage.getItem('restro_session');
    if (!raw) {
      router.push('/');
      return;
    }

    try {
      const parsed: SessionData = JSON.parse(raw);

      if (parsed.role === 'staff') {
        router.replace(`/kitchen/${parsed.restaurantId}`);
        return;
      }

      setSession(parsed);
      if (parsed.totalTables) {
        setActualTablesCount(parsed.totalTables);
      }
    } catch {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const anyModalOpen =
      showSalesModal ||
      showUpgradeModal ||
      showPaymentSettingsModal ||
      showStockModal ||
      showMasterPassModal ||
      selectedTableModal !== null ||
      showInactivityModal ||
      sessionReplaced;

    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [
    showSalesModal,
    showUpgradeModal,
    showPaymentSettingsModal,
    showStockModal,
    showMasterPassModal,
    selectedTableModal,
    showInactivityModal,
    sessionReplaced,
  ]);

  // SINGLE OWNER SESSION GUARD: Auto-logout with 5s dialog if another Owner signs in elsewhere
  useEffect(() => {
    if (!session?.restaurantId || session.role !== 'owner') return;

    let cancelled = false;

    const enforceSingleOwner = async () => {
      const stillActive = await isRoleSessionActive(session.restaurantId, 'owner');
      if (!stillActive && !cancelled) {
        localStorage.removeItem('restro_session');
        clearLocalSessionToken();
        setSessionReplaced(true);
      }
    };

    enforceSingleOwner();

    const sessionChannel = supabase
      .channel(`owner-single-session-${session.restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_role_sessions',
          filter: `restaurant_id=eq.${session.restaurantId}`,
        },
        (payload) => {
          const row = payload.new as { role?: string } | null;
          if (!row || row.role === 'owner') {
            enforceSingleOwner();
          }
        }
      )
      .subscribe();

    const pollTimer = setInterval(enforceSingleOwner, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(sessionChannel);
      clearInterval(pollTimer);
    };
  }, [session?.restaurantId, session?.role]);

  // 1-HOUR INACTIVITY AUTO LOGOUT (60 Minutes)
  useEffect(() => {
    if (!session?.restaurantId || session.role !== 'owner') return;

    const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const triggerInactivityLogout = async () => {
      await releaseRoleSessionIfOwner(session.restaurantId, 'owner');
      localStorage.removeItem('restro_session');
      setShowInactivityModal(true);
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(triggerInactivityLogout, INACTIVITY_LIMIT_MS);
    };

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    activityEvents.forEach((event) =>
      window.addEventListener(event, resetInactivityTimer, { passive: true })
    );

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetInactivityTimer)
      );
    };
  }, [session?.restaurantId, session?.role]);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.restaurantId) return;

    const [{ data: restData }, { data: ordersData }] = await Promise.all([
      supabase
        .from('restaurants')
        .select(
          'id, name, city, total_tables, owner_phone, outlet_mode, outlet_label, subscription_status, selected_plan, trial_ends_at, razorpay_key_id, razorpay_key_secret, upi_id, bank_account_name'
        )
        .eq('id', session.restaurantId)
        .single(),
      supabase
        .from('orders')
        .select(
          'id, restaurant_id, table_number, status, total_amount, payment_method, payment_status, customer_name, customer_phone, invoice_number, razorpay_payment_id, created_at, order_items(id, item_name, quantity, price, notes)'
        )
        .eq('restaurant_id', session.restaurantId)
        .order('created_at', { ascending: false }),
    ]);

    let resolvedOwnerPhone = session.ownerPhone || '';

    if (restData) {
      if (restData.total_tables) {
        setActualTablesCount(Number(restData.total_tables));
      }
      if (restData.owner_phone) {
        resolvedOwnerPhone = String(restData.owner_phone);
      }

      const upi = restData.upi_id || '';
      const bank = restData.bank_account_name || '';
      const keyId = restData.razorpay_key_id || '';
      const keySecret = restData.razorpay_key_secret || '';

      setSavedPaymentInfo({
        upiId: upi,
        bankName: bank,
        rzpKeyId: keyId,
        rzpKeySecret: keySecret,
      });

      const hasUpi = Boolean(upi.trim());
      const hasRzp = Boolean(keyId && keySecret);
      setIsPaymentConfigured(hasUpi || hasRzp);

      const status = restData.subscription_status || 'free_trial';
      const selectedPlan = restData.selected_plan || 'Yearly (₹5,499)';
      let daysLeft = 14;
      let isExpired = false;

      if (restData.trial_ends_at) {
        const diffMs = new Date(restData.trial_ends_at).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if (status === 'free_trial' && diffMs <= 0) {
          isExpired = true;
        }
      }

      setSubInfo({ status, selectedPlan, daysLeft, isExpired });
    }

    const currentOutletOrders = ((ordersData || []) as OrderRecord[]).map((o) => ({
      ...o,
      restaurant_id: o.restaurant_id || session.restaurantId,
    }));
    setOrders(currentOutletOrders);

    if (session.role === 'owner' && resolvedOwnerPhone) {
      const { data: siblingOutlets } = await supabase
        .from('restaurants')
        .select('id, name, city, outlet_mode, outlet_label')
        .eq('owner_phone', resolvedOwnerPhone);

      const outletsList: OutletMeta[] =
        siblingOutlets && siblingOutlets.length > 0
          ? (siblingOutlets as OutletMeta[])
          : [
              {
                id: session.restaurantId,
                name: session.brandName || session.restaurantName,
                city: session.city,
                outlet_mode: session.outletMode,
                outlet_label: session.outletLabel,
              },
            ];

      setOwnerOutlets(outletsList);

      const outletIds = outletsList.map((o) => o.id);
      if (outletIds.length > 1) {
        const { data: combinedOrders } = await supabase
          .from('orders')
          .select(
            'id, restaurant_id, table_number, status, total_amount, payment_method, payment_status, customer_name, customer_phone, invoice_number, razorpay_payment_id, created_at, order_items(id, item_name, quantity, price, notes)'
          )
          .in('restaurant_id', outletIds)
          .order('created_at', { ascending: false });

        if (combinedOrders) {
          setAllOutletOrders(combinedOrders as OrderRecord[]);
        }
      } else {
        setAllOutletOrders(currentOutletOrders);
      }
    } else {
      setOwnerOutlets([]);
      setAllOutletOrders(currentOutletOrders);
      setSalesScope('current');
    }

    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (!session?.restaurantId) return;

    setLoading(true);
    setOrders([]);
    setAllOutletOrders([]);
    setOwnerOutlets([]);
    setSalesScope('current');
    setCombinedSalesUnlocked(false);

    fetchDashboardData();

    const channel = supabase
      .channel(`dashboard-orders-${session.restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${session.restaurantId}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    const interval = setInterval(fetchDashboardData, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [session?.restaurantId, fetchDashboardData]);

  const handleOpenSalesModal = () => {
    setSalesScope('current');
    setCombinedSalesUnlocked(false);
    setShowSalesModal(true);
    if (session?.restaurantId) {
      fetchDashboardData();
    }
  };

  const handleCloseSalesModal = () => {
    setSalesScope('current');
    setCombinedSalesUnlocked(false);
    setShowSalesModal(false);
  };

  const handleRequestCombinedSales = () => {
    if (combinedSalesUnlocked) {
      setSalesScope('all_outlets');
      return;
    }

    const savedMasterPass =
      typeof window !== 'undefined'
        ? localStorage.getItem(MASTER_PASS_STORAGE_KEY)
        : null;

    setIsForgotMasterPass(false);
    setMasterRecoveryPhone('');
    setNewMasterPassInput('');
    setIsSettingFirstMasterPass(!savedMasterPass);
    setMasterPassInput('');
    setMasterPassError('');
    setShowMasterPassModal(true);
  };

  const handleVerifyOrSetMasterPass = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = masterPassInput.trim();

    if (cleanInput.length < 4) {
      setMasterPassError('Please enter at least 4 characters.');
      return;
    }

    const savedMasterPass = localStorage.getItem(MASTER_PASS_STORAGE_KEY);

    if (!savedMasterPass) {
      localStorage.setItem(MASTER_PASS_STORAGE_KEY, cleanInput);
      setCombinedSalesUnlocked(true);
      setShowMasterPassModal(false);
      setMasterPassInput('');
      setMasterPassError('');
      setSalesScope('all_outlets');
      return;
    }

    if (cleanInput === savedMasterPass) {
      setCombinedSalesUnlocked(true);
      setShowMasterPassModal(false);
      setMasterPassInput('');
      setMasterPassError('');
      setSalesScope('all_outlets');
    } else {
      setMasterPassError('Incorrect Master Password! Only the owner can view combined sales.');
    }
  };

  const handleResetMasterPass = (e: React.FormEvent) => {
    e.preventDefault();
    setMasterPassError('');

    const cleanPhone = masterRecoveryPhone.replace(/\D/g, '');
    const cleanNewPass = newMasterPassInput.trim();
    const registeredOwnerPhone = (session?.ownerPhone || '').replace(/\D/g, '');

    if (cleanPhone.length !== 10) {
      setMasterPassError('Please enter a valid 10-digit registered owner mobile number.');
      return;
    }

    if (registeredOwnerPhone && cleanPhone !== registeredOwnerPhone) {
      setMasterPassError('Mobile number does not match the registered owner number.');
      return;
    }

    if (cleanNewPass.length < 4) {
      setMasterPassError('New Master Password must be at least 4 characters.');
      return;
    }

    localStorage.setItem(MASTER_PASS_STORAGE_KEY, cleanNewPass);
    setCombinedSalesUnlocked(true);
    setShowMasterPassModal(false);
    setIsForgotMasterPass(false);
    setMasterRecoveryPhone('');
    setNewMasterPassInput('');
    setMasterPassInput('');
    setMasterPassError('');
    setSalesScope('all_outlets');
  };

  const handleOpenPaymentSettings = () => {
    setOwnerUpiId(savedPaymentInfo.upiId);
    setOwnerBankName(savedPaymentInfo.bankName);
    setOwnerRzpKeyId(savedPaymentInfo.rzpKeyId);
    setOwnerRzpKeySecret(savedPaymentInfo.rzpKeySecret);
    setPaymentSettingsMsg(null);
    setShowPaymentSettingsModal(true);
  };

  const handleOpenStockModal = async () => {
    if (!session?.restaurantId) return;
    setShowStockModal(true);
    setLoadingStock(true);

    const { data } = await supabase
      .from('menu_items')
      .select('id, name, category, is_veg, is_available')
      .eq('restaurant_id', session.restaurantId)
      .order('category', { ascending: true });

    if (data) {
      setStockItems(data);
    }
    setLoadingStock(false);
  };

  const handleToggleStock = async (item: MenuStockItem) => {
    const nextVal = !item.is_available;
    setStockItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, is_available: nextVal } : m))
    );

    await supabase
      .from('menu_items')
      .update({ is_available: nextVal })
      .eq('id', item.id);
  };

  const handleLogout = async () => {
    if (session?.restaurantId) {
      await releaseRoleSessionIfOwner(session.restaurantId, 'owner');
    }
    localStorage.removeItem('restro_session');
    router.push('/');
  };

  const handleSettleTable = async (tableNum: number, method: 'cash' | 'upi') => {
    if (!session?.restaurantId || session.role !== 'owner') return;
    setSettling(true);

    const activeIds = orders
      .filter((o) => o.table_number === tableNum && o.status !== 'completed')
      .map((o) => o.id);

    if (activeIds.length > 0) {
      await supabase
        .from('orders')
        .update({ status: 'completed', payment_method: method, payment_status: 'paid' })
        .in('id', activeIds);
    }

    setSettling(false);
    setSelectedTableModal(null);
    fetchDashboardData();
  };

  const handleMarkServed = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'served' }).eq('id', orderId);
    fetchDashboardData();
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

  const handleRazorpayPlanUpgrade = async (plan: (typeof UPGRADE_PLANS)[number]) => {
    if (!session) return;
    setUpgradeErrorMsg(null);
    setUpgradingPlanId(plan.id);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setUpgradeErrorMsg('Unable to load payment gateway. Please check your connection.');
        setUpgradingPlanId(null);
        return;
      }

      const res = await fetch('/api/razorpay/create-subscription-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.amount,
          planId: plan.id,
          planName: plan.name,
          restaurantId: session.restaurantId,
          restaurantName: session.restaurantName,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.orderId) {
        setUpgradeErrorMsg(orderData.error || 'Unable to initiate payment.');
        setUpgradingPlanId(null);
        return;
      }

      setShowUpgradeModal(false);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'RestroSync POS',
        description: `${plan.name} (${plan.price}) • ${session.restaurantName}`,
        order_id: orderData.orderId,
        theme: {
          color: '#ea580c',
        },
        handler: async function () {
          const newExpiry = new Date(
            Date.now() + plan.durationDays * 24 * 60 * 60 * 1000
          ).toISOString();

          await supabase
            .from('restaurants')
            .update({
              subscription_status: 'active',
              plan_type: plan.id,
              selected_plan: `${plan.name} (${plan.price})`,
              trial_ends_at: newExpiry,
            })
            .eq('id', session.restaurantId);

          setUpgradingPlanId(null);
          setUpgradeSuccessBanner(
            `${plan.name} (${plan.price}) has been activated successfully!`
          );
          fetchDashboardData();
          setTimeout(() => setUpgradeSuccessBanner(null), 7000);
        },
        modal: {
          ondismiss: function () {
            setUpgradingPlanId(null);
          },
        },
      };

      const RazorpayConstructor = (
        window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }
      ).Razorpay;
      const rzp = new RazorpayConstructor(options);
      rzp.open();
    } catch {
      setUpgradeErrorMsg('Something went wrong during payment. Please try again.');
      setUpgradingPlanId(null);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.restaurantId) return;

    setSavingPaymentSettings(true);
    setPaymentSettingsMsg(null);

    const cleanUpi = ownerUpiId.trim();
    const cleanBank = ownerBankName.trim();
    const cleanKeyId = ownerRzpKeyId.trim();
    const cleanSecret = ownerRzpKeySecret.trim();

    const { error } = await supabase
      .from('restaurants')
      .update({
        upi_id: cleanUpi || null,
        bank_account_name: cleanBank || null,
        razorpay_key_id: cleanKeyId || null,
        razorpay_key_secret: cleanSecret || null,
      })
      .eq('id', session.restaurantId);

    setSavingPaymentSettings(false);

    if (error) {
      setPaymentSettingsMsg('Failed to save payment details. Please try again.');
      return;
    }

    setSavedPaymentInfo({
      upiId: cleanUpi,
      bankName: cleanBank,
      rzpKeyId: cleanKeyId,
      rzpKeySecret: cleanSecret,
    });
    setIsPaymentConfigured(Boolean(cleanUpi || (cleanKeyId && cleanSecret)));
    setPaymentSettingsMsg(
      'Payment settings saved! Customers can now pay directly to your UPI or account.'
    );
    setTimeout(() => {
      setPaymentSettingsMsg(null);
      setShowPaymentSettingsModal(false);
    }, 1800);
  };

  const handleWhatsAppSupport = () => {
    if (!session) return;
    const msg = encodeURIComponent(
      `Hi RestroSync! I need help activating my plan:\n• Restaurant: ${session.restaurantName} (${session.city})\n• ID: ${session.restaurantId}`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`, '_blank');
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-semibold text-sm">Loading RestroSync Console...</p>
      </div>
    );
  }

  const isOwner = session.role === 'owner';
  const hasMultipleOwnerOutlets = isOwner && ownerOutlets.length > 1;
  const activeSalesScope: 'current' | 'all_outlets' =
    hasMultipleOwnerOutlets && salesScope === 'all_outlets' && combinedSalesUnlocked
      ? 'all_outlets'
      : 'current';

  const outletNameById: Record<string, string> = {};
  ownerOutlets.forEach((o) => {
    outletNameById[o.id] = formatOutletTitle(o);
  });
  outletNameById[session.restaurantId] = session.restaurantName;

  const activeOrders = orders.filter((o) => o.status !== 'completed');
  const completedOrders = orders.filter((o) => o.status === 'completed');

  const todayStr = new Date().toDateString();
  const todayCompleted = completedOrders.filter(
    (o) => new Date(o.created_at).toDateString() === todayStr
  );
  const todayRevenue = todayCompleted.reduce((sum, o) => sum + Number(o.total_amount), 0);

  const sourceSalesPool =
    activeSalesScope === 'all_outlets'
      ? allOutletOrders.filter((o) => o.status === 'completed')
      : completedOrders;

  const cleanSearch = billSearchQuery.trim().toLowerCase();

  const applyDateAndSearchFilter = (list: OrderRecord[]) =>
    list.filter((ord) => {
      if (cleanSearch) {
        const inv = (ord.invoice_number || '').toLowerCase();
        const billNo = `bill-${ord.id.slice(0, 6).toLowerCase()}`;
        const payId = (ord.razorpay_payment_id || '').toLowerCase();
        const custName = (ord.customer_name || '').toLowerCase();
        const custPhone = (ord.customer_phone || '').toLowerCase();

        return (
          inv.includes(cleanSearch) ||
          billNo.includes(cleanSearch) ||
          payId.includes(cleanSearch) ||
          custName.includes(cleanSearch) ||
          custPhone.includes(cleanSearch)
        );
      }

      const ordDate = new Date(ord.created_at);

      if (salesFilter === 'today') {
        return ordDate.toDateString() === todayStr;
      }

      if (salesFilter === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return ordDate >= sevenDaysAgo;
      }

      if (salesFilter === 'custom') {
        if (customFromDate) {
          const start = new Date(`${customFromDate}T00:00:00`);
          if (ordDate < start) return false;
        }
        if (customToDate) {
          const end = new Date(`${customToDate}T23:59:59.999`);
          if (ordDate > end) return false;
        }
        return true;
      }

      return true;
    });

  const filteredSalesOrders = applyDateAndSearchFilter(
    cleanSearch
      ? activeSalesScope === 'all_outlets'
        ? allOutletOrders
        : orders
      : sourceSalesPool
  );

  const filteredTotalSales = filteredSalesOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const filteredCashSales = filteredSalesOrders
    .filter((o) => (o.payment_method || '').toLowerCase() === 'cash')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const filteredUpiSales = filteredSalesOrders
    .filter((o) => (o.payment_method || '').toLowerCase() === 'upi')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const outletBreakdownRows =
    activeSalesScope === 'all_outlets' && hasMultipleOwnerOutlets
      ? ownerOutlets.map((out) => {
          const outOrders = applyDateAndSearchFilter(
            allOutletOrders.filter(
              (o) =>
                (o.restaurant_id || session.restaurantId) === out.id &&
                (cleanSearch ? true : o.status === 'completed')
            )
          );
          const total = outOrders.reduce((s, o) => s + Number(o.total_amount), 0);
          return {
            id: out.id,
            title: formatOutletTitle(out),
            total,
            count: outOrders.length,
            isCurrent: out.id === session.restaurantId,
          };
        })
      : [];

  const occupiedTablesCount = new Set(activeOrders.map((o) => o.table_number)).size;
  const cookingOrdersCount = activeOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing'
  ).length;
  const readyToServeCount = activeOrders.filter((o) => o.status === 'ready').length;

  const tablesArray = Array.from({ length: actualTablesCount }, (_, i) => i + 1);

  const modalTableOrders = selectedTableModal
    ? activeOrders.filter((o) => o.table_number === selectedTableModal)
    : [];
  const modalTableTotal = modalTableOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const isModalTableFullyPaid =
    modalTableOrders.length > 0 &&
    modalTableOrders.every((o) => o.payment_status === 'paid');

  const consolidatedTableItems: MergedBillItem[] = Object.values(
    modalTableOrders.reduce<Record<string, MergedBillItem>>((acc, ord) => {
      (ord.order_items || []).forEach((item) => {
        const key = `${(item.item_name || '').trim().toLowerCase()}_${Number(item.price)}`;
        if (!acc[key]) {
          acc[key] = {
            item_name: item.item_name,
            price: Number(item.price),
            quantity: 0,
            notes: [],
          };
        }
        acc[key].quantity += Number(item.quantity);
        if (item.notes && !acc[key].notes.includes(item.notes)) {
          acc[key].notes.push(item.notes);
        }
      });
      return acc;
    }, {})
  );

  const primaryTableGuest =
    modalTableOrders.find(
      (o) => o.customer_name && o.customer_name !== 'Walk-in Guest'
    )?.customer_name || modalTableOrders[0]?.customer_name;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 text-white p-2 rounded-xl shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {session.restaurantName}
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200">
                  <ShieldCheck className="w-3 h-3" /> Owner
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {session.city} • {actualTablesCount} Tables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/kitchen/${session.restaurantId}`}
              className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ChefHat className="w-4 h-4 text-orange-400" />
              <span>Kitchen Display (KDS)</span>
            </Link>

            <button
              type="button"
              onClick={handleOpenStockModal}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>Stock Status</span>
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={handleOpenSalesModal}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <IndianRupee className="w-4 h-4" />
                  <span>Bills & Sales</span>
                </button>

                <Link
                  href="/dashboard/qr"
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <QrCode className="w-4 h-4 text-orange-600" />
                  <span>Table QRs</span>
                </Link>

                <Link
                  href="/dashboard/menu"
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Manage Menu</span>
                </Link>

                <button
                  type="button"
                  onClick={handleOpenPaymentSettings}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                    isPaymentConfigured
                      ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <span>Payment Setup</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {upgradeSuccessBanner && (
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md flex items-center gap-2.5 text-xs sm:text-sm font-extrabold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{upgradeSuccessBanner}</span>
          </div>
        )}

        {isOwner && subInfo.status !== 'active' && (
          <section
            className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 shadow-sm ${
              subInfo.isExpired
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  subInfo.isExpired
                    ? 'bg-red-100 text-red-600'
                    : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                {subInfo.isExpired ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Crown className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold">
                  {subInfo.isExpired
                    ? 'Your 14-Day Free Trial Has Ended!'
                    : `Free Trial Active • ${subInfo.daysLeft} Day${
                        subInfo.daysLeft === 1 ? '' : 's'
                      } Left`}
                </p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    subInfo.isExpired ? 'text-red-700' : 'text-slate-300'
                  }`}
                >
                  Selected Plan: <strong>{subInfo.selectedPlan}</strong> • Complete online payment
                  to activate your plan immediately.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setUpgradeErrorMsg(null);
                setShowUpgradeModal(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Upgrade / Activate Plan</span>
            </button>
          </section>
        )}

        {isOwner && !isPaymentConfigured && (
          <section className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-200/70 text-amber-800">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold">
                  Connect Your Merchant UPI ID (0% Fee Direct Payments)
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Save your UPI ID so customer payments go straight to your GPay, PhonePe, or
                  Paytm merchant account.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenPaymentSettings}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition"
            >
              Add Merchant UPI ID &rarr;
            </button>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={handleOpenSalesModal}
            className="bg-white hover:bg-emerald-50/40 p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 shadow-sm text-left transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-600 text-xs font-bold">
              <span>Today&apos;s Total Sale</span>
              <span className="flex items-center gap-1 text-emerald-600 font-extrabold">
                Track Bills <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">
              ₹{todayRevenue.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              {todayCompleted.length} Bills Settled Today • Search Invoice / ID
            </p>
          </button>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Active Tables</span>
              <Users className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">
              {occupiedTablesCount} / {actualTablesCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Currently Occupied</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>In Kitchen (Cooking)</span>
              <ChefHat className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{cookingOrdersCount}</p>
            <p className="text-[11px] text-blue-600 font-semibold mt-1">Live KOTs Active</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Ready to Serve</span>
              <BellRing className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{readyToServeCount}</p>
            <p className="text-[11px] text-amber-600 font-semibold mt-1">Pickup from Kitchen</p>
          </div>
        </section>

        {readyToServeCount > 0 && (
          <section className="bg-emerald-600 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-sm">
                  {readyToServeCount} Order{readyToServeCount > 1 ? 's' : ''} Ready in Kitchen!
                </p>
                <p className="text-xs text-emerald-100">
                  Tables:{' '}
                  {Array.from(
                    new Set(
                      activeOrders
                        .filter((o) => o.status === 'ready')
                        .map((o) => `Table ${o.table_number}`)
                    )
                  ).join(', ')}
                </p>
              </div>
            </div>
            <Link
              href={`/kitchen/${session.restaurantId}`}
              className="bg-white text-emerald-700 font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-50 transition"
            >
              Open KDS &rarr;
            </Link>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Live Floor & Table Status
              </h2>
              <p className="text-xs text-slate-500">
                Click a Free table to take an order; once guests leave, click an Occupied table to
                mark it Free.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span> Free
              </span>
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Cooking
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Ready
              </span>
              <span className="flex items-center gap-1.5 text-blue-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Dining
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
            {tablesArray.map((tableNum) => {
              const tOrders = activeOrders.filter((o) => o.table_number === tableNum);
              const isOccupied = tOrders.length > 0;
              const hasReady = tOrders.some((o) => o.status === 'ready');
              const isAllServed =
                isOccupied && tOrders.every((o) => o.status === 'served');
              const tableTotal = tOrders.reduce((s, o) => s + Number(o.total_amount), 0);
              const totalDishes = tOrders.reduce(
                (s, o) =>
                  s + (o.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0),
                0
              );
              const isTableFullyPaid =
                isOccupied && tOrders.every((o) => o.payment_status === 'paid');
              const guestName = tOrders[0]?.customer_name;

              if (!isOccupied) {
                return (
                  <Link
                    key={tableNum}
                    href={`/order/${session.restaurantId}/${tableNum}`}
                    className="p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between min-h-[125px] cursor-pointer hover:shadow-md bg-slate-50 border-slate-200/80 hover:border-orange-300"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-extrabold text-sm text-slate-900">
                        Table {tableNum}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        Free
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-slate-400">
                      <span className="text-xs">Available</span>
                      <span className="text-[11px] font-bold text-orange-600">+ Order</span>
                    </div>
                  </Link>
                );
              }

              return (
                <button
                  key={tableNum}
                  type="button"
                  onClick={() => setSelectedTableModal(tableNum)}
                  className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between min-h-[125px] cursor-pointer hover:shadow-md ${
                    hasReady
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-sm'
                      : isAllServed
                      ? 'bg-blue-50/70 border-blue-400 shadow-sm'
                      : 'bg-amber-50/70 border-amber-400 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-sm text-slate-900">
                      Table {tableNum}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        hasReady
                          ? 'bg-emerald-600 text-white'
                          : isAllServed
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {hasReady ? 'Ready' : isAllServed ? 'Dining' : 'Cooking'}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    {guestName && (
                      <p className="text-[11px] font-extrabold text-slate-900 truncate">
                        {guestName}
                      </p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-600">
                      {isAllServed
                        ? 'Dining • Clear on Exit'
                        : `${totalDishes} Dish${totalDishes > 1 ? 'es' : ''} Running`}
                    </p>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <p className="text-base font-extrabold text-slate-900">
                        ₹{tableTotal}
                      </p>
                      {isTableFullyPaid ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                          PAID ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600">
                          UNPAID
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Live Kitchen & Service Queue</span>
            </h2>
            <span className="text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
              {activeOrders.length} Active
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No active orders right now. New orders will appear here live.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeOrders.map((ord) => {
                const isPaid = ord.payment_status === 'paid';

                return (
                  <div
                    key={ord.id}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="inline-block font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          Table {ord.table_number}
                        </span>
                        {ord.customer_name && (
                          <span className="font-bold text-slate-800">
                            {ord.customer_name}
                            {ord.customer_phone ? ` (${ord.customer_phone})` : ''}
                          </span>
                        )}
                        {ord.invoice_number && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {ord.invoice_number}
                          </span>
                        )}
                        {isPaid ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                            PAID UPI ✓ (₹{ord.total_amount})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            UNPAID • ₹{ord.total_amount}
                          </span>
                        )}
                        {ord.razorpay_payment_id && (
                          <span className="text-[10px] font-mono text-emerald-700 font-bold">
                            Ref: {ord.razorpay_payment_id}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed break-words">
                        {ord.order_items
                          ?.map((i) => `${i.quantity}× ${i.item_name}`)
                          .join(', ')}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${
                          ord.status === 'ready'
                            ? 'bg-emerald-100 text-emerald-700'
                            : ord.status === 'served'
                            ? 'bg-blue-100 text-blue-700'
                            : ord.status === 'preparing'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.status}
                      </span>

                      {ord.status === 'ready' && (
                        <button
                          type="button"
                          onClick={() => handleMarkServed(ord.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1 rounded-lg transition whitespace-nowrap"
                        >
                          Mark Served ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {isOwner && (
          <section className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600 shrink-0" />
                <span>Recent Settled Bills</span>
              </h2>
              <button
                type="button"
                onClick={handleOpenSalesModal}
                className="text-xs font-extrabold text-orange-600 hover:underline flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>Track by Invoice / UTR ID ({completedOrders.length}) &rarr;</span>
              </button>
            </div>

            {completedOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No settled bills yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedOrders.slice(0, 5).map((ord) => (
                  <div
                    key={ord.id}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          Table {ord.table_number}
                        </span>
                        {ord.customer_name && (
                          <span className="font-bold text-slate-700">
                            • {ord.customer_name}
                          </span>
                        )}
                        {ord.invoice_number && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {ord.invoice_number}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 mt-0.5 leading-relaxed break-words">
                        {ord.order_items
                          ?.map((i) => `${i.quantity}× ${i.item_name}`)
                          .join(', ')}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2.5 shrink-0">
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₹{ord.total_amount}
                      </span>
                      <span
                        className={`uppercase text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded ${
                          (ord.payment_method || '').toLowerCase() === 'upi'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {ord.payment_method || 'PAID'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {isOwner && showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-orange-600" /> Activate RestroSync Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your plan activates immediately upon completing payment
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {upgradeErrorMsg && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-bold">
                {upgradeErrorMsg}
              </div>
            )}

            <div className="py-4 space-y-2.5">
              {UPGRADE_PLANS.map((plan) => {
                const isSelected = subInfo.selectedPlan.includes(plan.price);
                return (
                  <div
                    key={plan.id}
                    className={`p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-extrabold text-sm text-slate-900">{plan.name}</p>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {plan.tag}
                        </span>
                      </div>
                      <p className="text-base font-extrabold text-orange-600 mt-0.5">
                        {plan.price}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={upgradingPlanId === plan.id}
                      onClick={() => handleRazorpayPlanUpgrade(plan)}
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition shrink-0"
                    >
                      <Crown className="w-4 h-4" />
                      <span>
                        {upgradingPlanId === plan.id ? 'Opening...' : 'Pay & Activate'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Secured by Razorpay • Instant Activation</span>
              <button
                type="button"
                onClick={handleWhatsAppSupport}
                className="text-emerald-700 font-extrabold hover:underline flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Need Help?
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && showPaymentSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-purple-600" /> Restaurant Payment Setup
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  0% Fee • Customer payments go straight to your UPI or bank account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentSettingsModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentSettings} className="pt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Shop / Merchant Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerBankName}
                  onChange={(e) => setOwnerBankName(e.target.value)}
                  placeholder="e.g. Sharma Family Restaurant"
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Merchant UPI ID (GPay / PhonePe / Paytm Box) *
                </label>
                <input
                  type="text"
                  required={!ownerRzpKeyId}
                  value={ownerUpiId}
                  onChange={(e) => setOwnerUpiId(e.target.value)}
                  placeholder="e.g. gpay-112233@okbizaxis or paytmqr...@ptys"
                  className="w-full px-3.5 py-2.5 bg-emerald-50/40 focus:bg-white border border-emerald-400 focus:border-orange-500 rounded-xl text-xs font-mono font-bold outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Enter the UPI ID from your Google Pay Business, PhonePe Business, or Paytm QR
                  stand.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Optional: Razorpay Keys (For Card / Auto-Webhook)
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Razorpay Key ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={ownerRzpKeyId}
                    onChange={(e) => setOwnerRzpKeyId(e.target.value)}
                    placeholder="rzp_live_xxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Razorpay Key Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={ownerRzpKeySecret}
                    onChange={(e) => setOwnerRzpKeySecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••"
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
              </div>

              {paymentSettingsMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-bold">
                  {paymentSettingsMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={savingPaymentSettings}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition"
              >
                {savingPaymentSettings ? 'Saving Details...' : 'Save Payment Setup ✓'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isOwner && showSalesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-[999]">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Bills, Invoice Tracker & Sales History
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  {activeSalesScope === 'all_outlets'
                    ? `Combined view across ${ownerOutlets.length} outlets • Track by Invoice, UTR, Name, or Phone`
                    : `${session.restaurantName} • Track by Invoice No., Bill No., UTR / Payment ID, Name, or Phone`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSalesModal}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {hasMultipleOwnerOutlets && (
              <div className="flex items-center gap-2 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSalesScope('current')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    activeSalesScope === 'current'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  This Outlet Only
                </button>
                <button
                  type="button"
                  onClick={handleRequestCombinedSales}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                    activeSalesScope === 'all_outlets'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>All Outlets Combined ({ownerOutlets.length})</span>
                </button>
              </div>
            )}

            <div className="pt-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder="Search Invoice (INV-...), Bill No, UTR / Ref ID, Name or Phone..."
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-semibold outline-none transition"
                />
                {billSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBillSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {!cleanSearch && (
              <div className="flex items-center gap-2 pt-3 overflow-x-auto pb-1 shrink-0 no-scrollbar">
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: 'all', label: 'All Time' },
                    { id: 'custom', label: 'Custom Date' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSalesFilter(tab.id)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      salesFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.id === 'custom' && <Calendar className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}

            {!cleanSearch && salesFilter === 'custom' && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 gap-2.5 shrink-0">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    max={customToDate || todayIso}
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    min={customFromDate}
                    max={todayIso}
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 my-3 shrink-0">
              <div className="col-span-2 sm:col-span-1 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex sm:block items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-emerald-700">
                    {cleanSearch
                      ? 'Matched Amount'
                      : activeSalesScope === 'all_outlets'
                      ? 'Combined Revenue'
                      : 'Total Revenue'}
                  </p>
                  <p className="text-xl font-extrabold text-emerald-900 mt-0.5">
                    ₹{filteredTotalSales.toLocaleString('en-IN')}
                  </p>
                </div>
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full sm:bg-transparent sm:p-0 sm:mt-0.5 inline-block">
                  {filteredSalesOrders.length} Bills
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Cash
                </p>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 mt-0.5">
                  ₹{filteredCashSales.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" /> UPI / Online
                </p>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 mt-0.5">
                  ₹{filteredUpiSales.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {activeSalesScope === 'all_outlets' && outletBreakdownRows.length > 0 && (
              <div className="mb-3 bg-orange-50/50 border border-orange-200/80 rounded-2xl p-3 shrink-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-800 mb-2">
                  Outlet-Wise Breakdown
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {outletBreakdownRows.map((row) => (
                    <div
                      key={row.id}
                      className="bg-white border border-slate-200/90 rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 truncate">{row.title}</p>
                        <p className="text-[10px] text-slate-400">{row.count} Bills</p>
                      </div>
                      <span className="font-extrabold text-slate-900 shrink-0">
                        ₹{row.total.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 border-t border-slate-100 pr-1 pb-2">
              {filteredSalesOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  No matching bills or invoices found.
                </p>
              ) : (
                filteredSalesOrders.map((ord) => {
                  const ordOutletId = ord.restaurant_id || session.restaurantId;
                  return (
                    <div
                      key={ord.id}
                      className="py-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeSalesScope === 'all_outlets' && (
                            <span className="text-[10px] font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded">
                              {outletNameById[ordOutletId] || session.restaurantName}
                            </span>
                          )}
                          <span className="font-extrabold text-slate-900">
                            Table {ord.table_number}
                          </span>
                          <span className="text-[10px] font-mono font-extrabold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">
                            {ord.invoice_number || `INV-${ord.id.slice(0, 6).toUpperCase()}`}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            BILL-{ord.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {(ord.customer_name || ord.customer_phone) && (
                          <p className="text-[11px] font-bold text-slate-700 flex flex-wrap items-center gap-2">
                            {ord.customer_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" /> {ord.customer_name}
                              </span>
                            )}
                            {ord.customer_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {ord.customer_phone}
                              </span>
                            )}
                          </p>
                        )}

                        {ord.razorpay_payment_id && (
                          <p className="text-[10px] font-mono text-emerald-700 font-bold">
                            Payment / UTR Ref: {ord.razorpay_payment_id}
                          </p>
                        )}

                        <p className="text-slate-600 leading-relaxed break-words">
                          {ord.order_items
                            ?.map((i) => `${i.quantity}× ${i.item_name}`)
                            .join(', ')}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-extrabold text-slate-900 text-sm">
                          ₹{ord.total_amount}
                        </span>
                        <span
                          className={`uppercase text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                            (ord.payment_method || '').toLowerCase() === 'upi'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {ord.payment_method || 'CASH'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {isOwner && showMasterPassModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[1000]">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isForgotMasterPass
                      ? 'Reset Master Password'
                      : isSettingFirstMasterPass
                      ? 'Set Owner Master Password'
                      : 'Owner Master Password'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isForgotMasterPass
                      ? 'Verify registered owner mobile to set a new password'
                      : isSettingFirstMasterPass
                      ? 'Create a master password for combined outlet sales'
                      : 'Enter master password to view all outlets sales'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMasterPassModal(false);
                  setIsForgotMasterPass(false);
                  setMasterPassError('');
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isForgotMasterPass ? (
              <form onSubmit={handleVerifyOrSetMasterPass} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isSettingFirstMasterPass
                      ? 'Create Master Password (min 4 chars)'
                      : 'Master Password'}
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={masterPassInput}
                    onChange={(e) => {
                      setMasterPassInput(e.target.value);
                      setMasterPassError('');
                    }}
                    placeholder="Enter owner master password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-sm font-bold outline-none"
                  />
                </div>

                {masterPassError && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                    {masterPassError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition"
                >
                  {isSettingFirstMasterPass
                    ? 'Save & View Combined Sales'
                    : 'Unlock Combined Sales'}
                </button>

                {!isSettingFirstMasterPass && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMasterPass(true);
                        setMasterRecoveryPhone('');
                        setNewMasterPassInput('');
                        setMasterPassError('');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-orange-600 transition"
                    >
                      Forgot Master Password? Reset Here &rarr;
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleResetMasterPass} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Owner Mobile Number
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    autoFocus
                    value={masterRecoveryPhone}
                    onChange={(e) => {
                      setMasterRecoveryPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setMasterPassError('');
                    }}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-sm font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Master Password (min 4 chars)
                  </label>
                  <input
                    type="password"
                    value={newMasterPassInput}
                    onChange={(e) => {
                      setNewMasterPassInput(e.target.value);
                      setMasterPassError('');
                    }}
                    placeholder="Set new master password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-sm font-bold outline-none"
                  />
                </div>

                {masterPassError && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                    {masterPassError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition"
                >
                  Verify & Set New Master Password
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMasterPass(false);
                      setMasterPassError('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                  >
                    &larr; Back to Master Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {selectedTableModal !== null && (
        <div
          onClick={() => setSelectedTableModal(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Table {selectedTableModal}
                </h3>
                <p className="text-xs text-slate-500">
                  {primaryTableGuest ? `${primaryTableGuest} • ` : ''}
                  {modalTableOrders.length} KOT(s) running
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTableModal(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="pt-4 shrink-0">
              <Link
                href={`/order/${session.restaurantId}/${selectedTableModal}`}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add More Items to Table {selectedTableModal}</span>
              </Link>
            </div>

            {modalTableOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active orders on this table right now.
              </div>
            ) : (
              <div className="py-4 space-y-4 overflow-y-auto overscroll-contain flex-1">
                <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-orange-200/70 pb-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-800">
                      Consolidated Table Bill
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      {consolidatedTableItems.reduce((s, i) => s + i.quantity, 0)} Items
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {consolidatedTableItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-slate-800"
                      >
                        <span>
                          <strong className="text-slate-900">{item.quantity}×</strong>{' '}
                          {item.item_name}
                          {item.notes.length > 0 && (
                            <span className="text-[11px] text-orange-600 ml-1">
                              ({item.notes.join(', ')})
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                    Kitchen KOT Status ({modalTableOrders.length})
                  </p>

                  {modalTableOrders.map((ord, index) => {
                    const isPaid = ord.payment_status === 'paid';

                    return (
                      <div
                        key={ord.id}
                        className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-700">
                              KOT #{modalTableOrders.length - index}
                            </span>
                            {ord.invoice_number && (
                              <span className="text-[10px] font-mono text-slate-500">
                                ({ord.invoice_number})
                              </span>
                            )}
                            {isPaid && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Paid ✓
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 truncate mt-0.5">
                            {ord.order_items
                              ?.map((i) => `${i.quantity}× ${i.item_name}`)
                              .join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              ord.status === 'ready'
                                ? 'bg-emerald-100 text-emerald-700'
                                : ord.status === 'served'
                                ? 'bg-blue-100 text-blue-700'
                                : ord.status === 'preparing'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.status === 'ready' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </>
                            ) : ord.status === 'served' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Served
                              </>
                            ) : ord.status === 'preparing' ? (
                              <>
                                <ChefHat className="w-3 h-3" /> Cooking
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" /> Pending
                              </>
                            )}
                          </span>

                          {ord.status === 'ready' && (
                            <button
                              type="button"
                              onClick={() => handleMarkServed(ord.id)}
                              className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-1 rounded-lg hover:bg-emerald-700 transition"
                            >
                              Serve ✓
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {modalTableOrders.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-3 shrink-0">
                <div className="flex items-center justify-between font-extrabold text-base text-slate-900">
                  <span>Total Table Bill</span>
                  <span>₹{modalTableTotal}</span>
                </div>

                {isModalTableFullyPaid ? (
                  <div className="space-y-2.5">
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-2.5 text-center text-xs font-extrabold">
                      ✓ UPI Payment Marked Paid • Clear table only after guest leaves
                    </div>
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() => handleSettleTable(selectedTableModal, 'upi')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      {settling
                        ? 'Clearing Table...'
                        : 'Guest Left • Free Table ✓'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() => handleSettleTable(selectedTableModal, 'cash')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      Settle Cash ₹{modalTableTotal}
                    </button>
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() => handleSettleTable(selectedTableModal, 'upi')}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      Settle UPI ₹{modalTableTotal}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showStockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Quick Dish Stock Toggle
                </h3>
                <p className="text-xs text-slate-500">
                  Mark dishes as Sold Out when they run out
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStockModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain py-3 divide-y divide-slate-100">
              {loadingStock ? (
                <p className="text-xs text-slate-500 text-center py-8">Loading menu items...</p>
              ) : stockItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No menu items added yet.
                </p>
              ) : (
                stockItems.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.category}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStock(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                        item.is_available
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {item.is_available ? 'In Stock ✓' : 'Sold Out ✕'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showInactivityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Session Expired (1 Hour Inactive)
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                For your security, you were automatically logged out from the Owner Dashboard after
                1 hour of inactivity.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition"
            >
              Login Again &rarr;
            </button>
          </div>
        </div>
      )}

      <SessionReplacedDialog
        open={sessionReplaced}
        role="owner"
        onComplete={() => {
          window.location.replace('/');
        }}
      />
    </div>
  );
}