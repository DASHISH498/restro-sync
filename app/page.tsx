'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { claimSingleRoleSession } from '@/lib/roleSessionGuard';
import {
  getMaxOutletsForPlan,
  getCalendarExpiryDate,
  isTrialExpiredRecord,
  TRIAL_DURATION_DAYS,
} from '@/lib/planFeatures';
import {
  UtensilsCrossed,
  Lock,
  X,
  ArrowRight,
  QrCode,
  ChefHat,
  Receipt,
  Building2,
  Phone,
  KeyRound,
  CheckCircle2,
  MapPin,
  Hash,
  Check,
  Sparkles,
  Store,
  AlertTriangle,
  Crown,
  ShieldCheck,
  LogIn,
  UserPlus,
  Mail,
  Monitor,
  Laptop,
  Coffee,
  Flame,
  Wine,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  city: string;
  total_tables: number;
  owner_pin: string;
  staff_pin?: string | null;
  phone?: string | null;
  owner_phone?: string | null;
  email?: string | null;
  login_password?: string | null;
  outlet_mode?: 'single' | 'multiple' | null;
  outlet_label?: string | null;
  subscription_status?: string | null;
  plan_type?: string | null;
  selected_plan?: string | null;
  trial_ends_at?: string | null;
}

type ResetTargetRole = 'owner' | 'staff';
type OutletTabMode = 'single' | 'multiple';
type LoginStep = 'choose_role' | 'branch_pin' | 'malik_master';

interface PricingPlan {
  id: string;
  duration: string;
  subtitle: string;
  price: string;
  perMonth?: string;
  amount: number;
  maxOutlets: number | null;
  badge: string | null;
  popular: boolean;
  features: string[];
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const MASTER_PASS_STORAGE_KEY = 'restro_master_sales_password';
const MALIK_VAULT_UNLOCKED_KEY = 'restro_malik_vault_unlocked';
const ACCOUNT_PASSWORDS_STORAGE_KEY = 'restro_account_passwords_map';

const FAQ_ITEMS = [
  {
    q: 'How does the 7-day free trial work?',
    a: 'Each 10-digit mobile number gets one 7-day free trial so you can test QR ordering, live KDS, and billing before choosing a paid plan.',
  },
  {
    q: 'How do owners and kitchen staff sign in?',
    a: 'Owners can sign in using their registered Email or Mobile Number and Password/PIN, while kitchen/branch staff can use their assigned 6-digit PIN.',
  },
  {
    q: 'Can I manage multiple outlets under one account?',
    a: 'Yes, switch to the Multiple Outlets tab in Plans & Pricing to link outlets under your owner number and view combined or branch-wise sales.',
  },
  {
    q: 'What happens if I purchase a Lifetime plan?',
    a: 'Your restaurant gets one-time lifetime access without recurring renewal prompts or upgrade nudges for that tier.',
  },
];

function isLifetimePlanRecord(rest: Restaurant | null): boolean {
  if (!rest) return false;
  const planType = (rest.plan_type || '').toLowerCase();
  const selectedPlan = (rest.selected_plan || '').toLowerCase();
  const subStatus = (rest.subscription_status || '').toLowerCase();
  return (
    planType.includes('lifetime') ||
    selectedPlan.includes('lifetime') ||
    subStatus === 'lifetime'
  );
}

function isMultiOutletAccount(rest: Restaurant): boolean {
  if (rest.outlet_mode === 'multiple') return true;
  const planType = (rest.plan_type || '').toLowerCase();
  const selectedPlan = (rest.selected_plan || '').toLowerCase();
  return (
    planType.startsWith('multi_') ||
    selectedPlan.includes('multiple') ||
    selectedPlan.includes('up to 2 outlets') ||
    selectedPlan.includes('up to 5 outlets') ||
    selectedPlan.includes('up to 8 outlets') ||
    selectedPlan.includes('up to 15 outlets') ||
    selectedPlan.includes('unlimited outlets')
  );
}

function readLocalPasswordMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCOUNT_PASSWORDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveLocalPasswordForRestaurant(
  restaurantId: string,
  email: string,
  phone: string,
  password: string
) {
  if (typeof window === 'undefined' || !password) return;
  const current = readLocalPasswordMap();
  current[`id:${restaurantId}`] = password;
  if (email.trim()) {
    current[`email:${email.trim().toLowerCase()}`] = password;
  }
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    current[`phone:${cleanPhone}`] = password;
  }
  localStorage.setItem(ACCOUNT_PASSWORDS_STORAGE_KEY, JSON.stringify(current));
}

const SINGLE_OUTLET_PLANS: PricingPlan[] = [
  {
    id: '1_month',
    duration: '1 Month',
    subtitle: 'Starter Monthly',
    price: '₹599',
    perMonth: '₹599 / month',
    amount: 599,
    maxOutlets: 1,
    badge: null,
    popular: false,
    features: [
      'QR Table Menu & Instant Cart',
      'Live Kitchen Display (KDS)',
      'Owner & Staff 6-Digit PINs',
      'Daily Table Bill Settlement',
    ],
  },
  {
    id: '3_months',
    duration: '3 Months',
    subtitle: 'Quarterly Operations',
    price: '₹1,699',
    perMonth: '₹566 / month',
    amount: 1699,
    maxOutlets: 1,
    badge: 'Save ₹98',
    popular: false,
    features: [
      '1-Click Dish Stock Toggle',
      'Cash & UPI Payment Split View',
      'Invoice, Bill & UTR Search',
      'Mobile PIN Reset via Owner Phone',
    ],
  },
  {
    id: '6_months',
    duration: '6 Months',
    subtitle: 'Half-Yearly Analytics',
    price: '₹3,299',
    perMonth: '₹550 / month',
    amount: 3299,
    maxOutlets: 1,
    badge: 'Save ₹295',
    popular: false,
    features: [
      'Custom Date Range Sales Filter',
      'Last 7 Days & All-Time History',
      'Customer Name & Phone on Bills',
      'Printable Digital Bill Receipts',
    ],
  },
  {
    id: 'yearly',
    duration: 'Yearly',
    subtitle: '12 Months Pro',
    price: '₹5,499',
    perMonth: '₹458 / month',
    amount: 5499,
    maxOutlets: 1,
    badge: 'Save ₹1,689',
    popular: true,
    features: [
      'Full 12-Month Billing Archive',
      'Best Annual Savings (23% Off)',
      'Priority Menu & QR Onboarding',
      'All Standard Updates Included',
    ],
  },
  {
    id: 'lifetime',
    duration: 'Lifetime',
    subtitle: 'One-Time License',
    price: '₹19,999',
    perMonth: 'Pay once, use forever',
    amount: 19999,
    maxOutlets: 1,
    badge: 'Zero Renewal',
    popular: false,
    features: [
      'Lifetime Access • Zero Renewal',
      'All Future POS & KDS Releases',
      'Dedicated VIP Support Line',
      'Permanent Single-Outlet License',
    ],
  },
];

const MULTIPLE_OUTLET_PLANS: PricingPlan[] = [
  {
    id: 'multi_1_month',
    duration: '1 Month',
    subtitle: 'Up to 2 Outlets • Starter Chain',
    price: '₹1,115',
    perMonth: '₹1,115 / month',
    amount: 1115,
    maxOutlets: 2,
    badge: 'Up to 2 Outlets',
    popular: false,
    features: [
      'Link up to 2 Outlets by Phone',
      'Combined Sales & Cash/UPI Split',
      'Malik Master Password Vault',
      'Branch & Staff PINs per Outlet',
    ],
  },
  {
    id: 'multi_3_months',
    duration: '3 Months',
    subtitle: 'Up to 5 Outlets • Branch Drilldown',
    price: '₹11,159',
    perMonth: '₹3,720 / month',
    amount: 11159,
    maxOutlets: 5,
    badge: 'Up to 5 Outlets',
    popular: false,
    features: [
      'Link up to 5 Outlets Under 1 Owner',
      'Outlet Dropdown Drilldown View',
      'Customer Name, Phone & Dish List',
      'Invoice & UTR Search per Branch',
    ],
  },
  {
    id: 'multi_6_months',
    duration: '6 Months',
    subtitle: 'Up to 8 Outlets • Custom Reports',
    price: '₹18,599',
    perMonth: '₹3,100 / month',
    amount: 18599,
    maxOutlets: 8,
    badge: 'Up to 8 Outlets',
    popular: false,
    features: [
      'Link up to 8 Active Outlets',
      'Custom Date Range (From–To) Filter',
      'Deleted Outlets Sales Archive',
      'Historical Orders Saved on Delete',
    ],
  },
  {
    id: 'multi_yearly',
    duration: 'Yearly',
    subtitle: 'Up to 15 Outlets • Full Chain Pro',
    price: '₹27,899',
    perMonth: '₹2,325 / month',
    amount: 27899,
    maxOutlets: 15,
    badge: 'Up to 15 Outlets',
    popular: true,
    features: [
      'Link up to 15 Outlets Under 1 Owner',
      '1-Click Restore Deleted Outlets',
      'Active-Sale Priority Card Sorting',
      'Priority Multi-Branch Setup Help',
    ],
  },
  {
    id: 'multi_lifetime',
    duration: 'Lifetime',
    subtitle: 'Unlimited Outlets • One-Time',
    price: '₹37,199',
    perMonth: 'Pay once, use forever',
    amount: 37199,
    maxOutlets: null,
    badge: 'Unlimited Outlets',
    popular: false,
    features: [
      'Unlimited Outlets • Zero Renewal',
      'All Multi-Outlet Tools Unlocked',
      'Future Chain Features Included',
      'Dedicated VIP Brand Support',
    ],
  },
];

function getPlanMaxOutlets(
  planId: string,
  planLabel: string,
  mode: OutletTabMode
): number | null {
  return getMaxOutletsForPlan(planId, planLabel, mode);
}

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
  const [pricingTab, setPricingTab] = useState<OutletTabMode>('single');
  const [planErrorMsg, setPlanErrorMsg] = useState<string | null>(null);
  const [appDownloadNotice, setAppDownloadNotice] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [limitDialog, setLimitDialog] = useState<{
    open: boolean;
    phone: string;
    existingCount: number;
    maxOutlets: number;
    planLabel: string;
  }>({
    open: false,
    phone: '',
    existingCount: 0,
    maxOutlets: 2,
    planLabel: '1 Month (₹1,115)',
  });

  // Login Modal States (with top "Login as Super Admin" toggle)
  const [showLoginLookupModal, setShowLoginLookupModal] = useState(false);
  const [isSuperAdminLoginToggle, setIsSuperAdminLoginToggle] = useState(false);
  const [loginLookupId, setLoginLookupId] = useState('');
  const [loginAccountPassword, setLoginAccountPassword] = useState('');
  const [loginLookupError, setLoginLookupError] = useState('');
  const [loginMatchedLifetime, setLoginMatchedLifetime] = useState(false);
  const [loggingInDirect, setLoggingInDirect] = useState(false);

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loginStep, setLoginStep] = useState<LoginStep>('branch_pin');
  const [malikMasterPass, setMalikMasterPass] = useState('');
  const [isSettingMalikPass, setIsSettingMalikPass] = useState(false);
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

  // Register (Sign Up) Restaurant Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isTrialFlow, setIsTrialFlow] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('1_month');
  const [selectedPlanLabel, setSelectedPlanLabel] = useState<string>('7-Day Trial • 1 Month');
  const [selectedPlanAmount, setSelectedPlanAmount] = useState<number>(599);
  const [outletMode, setOutletMode] = useState<OutletTabMode>('single');
  const [outletLabel, setOutletLabel] = useState('');
  const [regName, setRegName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTables, setRegTables] = useState<number>(10);
  const [regOwnerPin, setRegOwnerPin] = useState('');
  const [regStaffPin, setRegStaffPin] = useState('');
  const [regMalikPassword, setRegMalikPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  // PWA install prompt listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setAppDownloadNotice('RestroSync installed on your system!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Auto-hide download status notice after 3 seconds
  useEffect(() => {
    if (!appDownloadNotice) return;
    const timer = setTimeout(() => {
      setAppDownloadNotice(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [appDownloadNotice]);

  useEffect(() => {
    const anyModalOpen =
      showRegisterModal ||
      showLoginLookupModal ||
      limitDialog.open ||
      selectedRestaurant !== null;

    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showRegisterModal, showLoginLookupModal, limitDialog.open, selectedRestaurant]);

  useEffect(() => {
    setSelectedRestaurant(null);
    setShowLoginLookupModal(false);
    setIsSuperAdminLoginToggle(false);
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
          'id, name, city, total_tables, owner_pin, staff_pin, phone, owner_phone, email, login_password, outlet_mode, outlet_label, subscription_status, plan_type, selected_plan, trial_ends_at'
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
    };

    fetchRestaurants();
  }, []);

  const handleDesktopAppDownload = async (platform: 'windows' | 'mac') => {
    const platformLabel = platform === 'windows' ? 'Windows' : 'Mac';

    if (deferredInstallPrompt) {
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        setDeferredInstallPrompt(null);

        if (choice.outcome === 'accepted') {
          setAppDownloadNotice(`Installing RestroSync for ${platformLabel}...`);
        } else {
          setAppDownloadNotice(`${platformLabel} app installation cancelled.`);
        }
        return;
      } catch {
        // Fallback notice below
      }
    }

    setAppDownloadNotice(
      platform === 'windows'
        ? 'Open in Chrome/Edge and click Install in the address bar (or menu → Install RestroSync).'
        : 'Open in Chrome/Safari and choose Install / Add to Dock from the browser menu.'
    );
  };

  const checkTrialEligibilityForPhone = async (
    phoneDigits: string
  ): Promise<{ allowed: boolean; message?: string }> => {
    const cleanPhone = phoneDigits.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return { allowed: true };

    const [{ data: byOwner }, { data: byPhone }] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id, subscription_status, selected_plan')
        .eq('owner_phone', cleanPhone),
      supabase
        .from('restaurants')
        .select('id, subscription_status, selected_plan')
        .eq('phone', cleanPhone),
    ]);

    const dbRecords = [
      ...(Array.isArray(byOwner) ? byOwner : []),
      ...(Array.isArray(byPhone) ? byPhone : []),
    ];

    const localRecords = restaurants.filter((r) => {
      const p1 = (r.owner_phone || '').replace(/\D/g, '');
      const p2 = (r.phone || '').replace(/\D/g, '');
      return p1 === cleanPhone || p2 === cleanPhone;
    });

    const combined = [...dbRecords, ...localRecords];
    const hasUsedTrial = combined.some((rec) => {
      const status = (rec.subscription_status || '').toLowerCase();
      const planText = (rec.selected_plan || '').toLowerCase();
      return status === 'free_trial' || planText.includes('trial');
    });

    if (hasUsedTrial || combined.length > 0) {
      return {
        allowed: false,
        message: `Mobile number ${cleanPhone} has already used its 7-day free trial. Please choose a paid plan to register.`,
      };
    }

    return { allowed: true };
  };

  const checkOutletLimitBeforeProceed = async (
    phoneDigits: string,
    mode: OutletTabMode,
    planId: string,
    planLabel: string
  ): Promise<boolean> => {
    if (mode !== 'multiple') return true;

    const maxOutlets = getPlanMaxOutlets(planId, planLabel, mode);
    if (maxOutlets === null) return true;

    const cleanPhone = phoneDigits.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return true;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_phone', cleanPhone);

    const dbCount = !error && Array.isArray(data) ? data.length : 0;
    const localCount = restaurants.filter(
      (r) => (r.owner_phone || '').replace(/\D/g, '') === cleanPhone
    ).length;
    const existingCount = Math.max(dbCount, localCount);

    if (existingCount + 1 > maxOutlets) {
      setLimitDialog({
        open: true,
        phone: cleanPhone,
        existingCount,
        maxOutlets,
        planLabel,
      });
      return false;
    }

    return true;
  };

  const checkLoginTrialNotExpired = async (
    rest: Restaurant,
    setErrFn: (msg: string) => void
  ): Promise<boolean> => {
    if (isLifetimePlanRecord(rest)) return true;

    const { data: freshRest } = await supabase
      .from('restaurants')
      .select('id, subscription_status, plan_type, selected_plan, trial_ends_at')
      .eq('id', rest.id)
      .single();

    const targetRecord = (freshRest as Restaurant) || rest;
    if (isLifetimePlanRecord(targetRecord)) return true;

    if (isTrialExpiredRecord(targetRecord)) {
      setErrFn(
        'Your 7-day free trial has ended (8th day). Please select a paid plan from Plans & Pricing to continue.'
      );
      return false;
    }
    return true;
  };

  const completeSessionAndNavigate = async (
    rest: Restaurant,
    role: 'owner' | 'staff',
    unlockMalikVault = false
  ) => {
    if (unlockMalikVault) {
      localStorage.setItem(MALIK_VAULT_UNLOCKED_KEY, '1');
    } else {
      localStorage.removeItem(MALIK_VAULT_UNLOCKED_KEY);
    }

    await claimSingleRoleSession(rest.id, role);

    const displayName = formatRestaurantDisplayName(rest);
    localStorage.setItem(
      'restro_session',
      JSON.stringify({
        restaurantId: rest.id,
        restaurantName: displayName,
        brandName: rest.name,
        outletLabel: rest.outlet_label || null,
        outletMode: rest.outlet_mode || 'single',
        ownerPhone: rest.owner_phone || null,
        city: rest.city,
        totalTables: rest.total_tables,
        role,
      })
    );

    if (role === 'owner') {
      router.replace('/dashboard');
    } else {
      router.push(`/kitchen/${rest.id}`);
    }
  };

  const handleOpenLoginModal = () => {
    setIsSuperAdminLoginToggle(false);
    setLoginLookupId('');
    setLoginAccountPassword('');
    setLoginLookupError('');
    setLoginMatchedLifetime(false);
    setLoggingInDirect(false);
    setShowLoginLookupModal(true);
  };

  const handleLoginLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingInDirect) return;

    const rawInput = loginLookupId.trim();
    const enteredSecret = loginAccountPassword.trim();

    if (!rawInput) {
      setLoginLookupError(
        isSuperAdminLoginToggle
          ? 'Enter your registered Owner Mobile Number or Email.'
          : 'Enter your registered Email or 10-digit Mobile Number.'
      );
      return;
    }
    if (!enteredSecret) {
      setLoginLookupError(
        isSuperAdminLoginToggle
          ? 'Enter your Super Admin Master Password (min 4 chars).'
          : 'Enter your Password or 6-digit PIN.'
      );
      return;
    }
    if (isSuperAdminLoginToggle && enteredSecret.length < 4) {
      setLoginLookupError('Super Admin Master Password must be at least 4 characters.');
      return;
    }

    setLoggingInDirect(true);
    setLoginLookupError('');
    setLoginMatchedLifetime(false);

    const digitsOnly = rawInput.replace(/\D/g, '');
    const lowerInput = rawInput.toLowerCase();

    const findMatchingRestaurant = (list: Restaurant[]) => {
      const exactContactMatch = list.find((r) => {
        const p1 = (r.owner_phone || '').replace(/\D/g, '');
        const p2 = (r.phone || '').replace(/\D/g, '');
        const emailVal = (r.email || '').trim().toLowerCase();
        if (digitsOnly.length === 10 && (p1 === digitsOnly || p2 === digitsOnly)) {
          return true;
        }
        if (emailVal && emailVal === lowerInput) {
          return true;
        }
        return false;
      });
      if (exactContactMatch) return exactContactMatch;

      return list.find((r) => {
        const restName = (r.name || '').trim().toLowerCase();
        const fullDisplay = formatRestaurantDisplayName(r).toLowerCase();
        return restName === lowerInput || fullDisplay === lowerInput;
      });
    };

    let listToSearch = restaurants;
    let matched = findMatchingRestaurant(listToSearch);

    if (!matched) {
      const { data: latestList } = await supabase
        .from('restaurants')
        .select(
          'id, name, city, total_tables, owner_pin, staff_pin, phone, owner_phone, email, login_password, outlet_mode, outlet_label, subscription_status, plan_type, selected_plan, trial_ends_at'
        )
        .order('created_at', { ascending: false });

      if (Array.isArray(latestList)) {
        listToSearch = latestList as Restaurant[];
        setRestaurants(listToSearch);
        matched = findMatchingRestaurant(listToSearch);
      } else {
        const { data: fallbackList } = await supabase
          .from('restaurants')
          .select(
            'id, name, city, total_tables, owner_pin, staff_pin, phone, owner_phone, outlet_mode, outlet_label, subscription_status, plan_type, selected_plan, trial_ends_at'
          )
          .order('created_at', { ascending: false });
        if (Array.isArray(fallbackList)) {
          listToSearch = fallbackList as Restaurant[];
          setRestaurants(listToSearch);
          matched = findMatchingRestaurant(listToSearch);
        }
      }
    }

    if (!matched) {
      setLoggingInDirect(false);
      setLoginLookupError(
        'No account found with this Email or Mobile Number. Please Sign Up first.'
      );
      return;
    }

    const isMultiAccount = isMultiOutletAccount(matched);
    setLoginMatchedLifetime(isLifetimePlanRecord(matched));

    // Strict separation:
    // 1) Single Outlet accounts cannot log in when Super Admin toggle is ON
    if (isSuperAdminLoginToggle && !isMultiAccount) {
      setLoggingInDirect(false);
      setLoginLookupError(
        'Super Admin login is only for Multiple Outlets plans. Turn off "Login as Super Admin" to sign in to your Single Outlet account.'
      );
      return;
    }

    // 2) Multiple Outlets accounts cannot log in when Super Admin toggle is OFF
    if (!isSuperAdminLoginToggle && isMultiAccount) {
      setLoggingInDirect(false);
      setLoginLookupError(
        'This account is registered under a Multiple Outlets plan. Please turn on "Login as Super Admin" at the top and enter your Super Admin Master Password.'
      );
      return;
    }

    const allowedByTrial = await checkLoginTrialNotExpired(matched, (msg) => {
      setLoginLookupError(msg);
      setLoggingInDirect(false);
    });
    if (!allowedByTrial) return;

    const passMap = readLocalPasswordMap();
    const cleanPhoneMatch = (matched.owner_phone || matched.phone || '').replace(
      /\D/g,
      ''
    );
    const cleanEmailMatch = (matched.email || '').trim().toLowerCase();

    const storedAccountPassword =
      matched.login_password ||
      passMap[`id:${matched.id}`] ||
      (cleanEmailMatch ? passMap[`email:${cleanEmailMatch}`] : undefined) ||
      (cleanPhoneMatch ? passMap[`phone:${cleanPhoneMatch}`] : undefined);

    const savedMaster =
      typeof window !== 'undefined'
        ? localStorage.getItem(MASTER_PASS_STORAGE_KEY)
        : null;

    if (isSuperAdminLoginToggle) {
      const isValidMaster =
        (savedMaster && enteredSecret === savedMaster) ||
        (!savedMaster &&
          ((storedAccountPassword && enteredSecret === storedAccountPassword) ||
            enteredSecret === matched.owner_pin));

      if (!isValidMaster) {
        setLoggingInDirect(false);
        setLoginLookupError('Incorrect Super Admin Master Password!');
        return;
      }

      if (!savedMaster) {
        localStorage.setItem(MASTER_PASS_STORAGE_KEY, enteredSecret);
      }

      await completeSessionAndNavigate(matched, 'owner', true);
      return;
    }

    // Normal Single Outlet login (Toggle OFF)
    if (storedAccountPassword && enteredSecret === storedAccountPassword) {
      if (cleanEmailMatch) {
        saveLocalPasswordForRestaurant(
          matched.id,
          cleanEmailMatch,
          cleanPhoneMatch,
          enteredSecret
        );
      }
      await completeSessionAndNavigate(matched, 'owner', false);
      return;
    }

    if (enteredSecret === matched.owner_pin) {
      await completeSessionAndNavigate(matched, 'owner', false);
      return;
    }

    if (matched.staff_pin && enteredSecret === matched.staff_pin) {
      await completeSessionAndNavigate(matched, 'staff', false);
      return;
    }

    setLoggingInDirect(false);
    setLoginLookupError(
      'Incorrect Email/Mobile or Password/PIN. Please check and try again.'
    );
  };

  const handleClosePinModal = () => {
    setSelectedRestaurant(null);
    setLoginStep('branch_pin');
    setMalikMasterPass('');
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

  const handleMalikMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant || verifying) return;

    const cleanPass = malikMasterPass.trim();
    if (cleanPass.length < 4) {
      setErrorMsg('Master Password must be at least 4 characters.');
      return;
    }

    const savedMaster = localStorage.getItem(MASTER_PASS_STORAGE_KEY);
    if (savedMaster && cleanPass !== savedMaster) {
      setErrorMsg('Incorrect Master Password!');
      return;
    }

    setVerifying(true);
    setErrorMsg('');

    const allowedByTrial = await checkLoginTrialNotExpired(selectedRestaurant, (msg) => {
      setErrorMsg(msg);
      setVerifying(false);
    });
    if (!allowedByTrial) return;

    if (!savedMaster) {
      localStorage.setItem(MASTER_PASS_STORAGE_KEY, cleanPass);
    }

    await completeSessionAndNavigate(selectedRestaurant, 'owner', true);
  };

  const handlePinLogin = async (e?: React.FormEvent, enteredPin?: string) => {
    if (e) e.preventDefault();
    const activePin = enteredPin ?? pin;
    if (!selectedRestaurant || activePin.length !== 6 || verifying) return;

    setVerifying(true);
    setErrorMsg('');

    const allowedByTrial = await checkLoginTrialNotExpired(selectedRestaurant, (msg) => {
      setErrorMsg(msg);
      setVerifying(false);
    });
    if (!allowedByTrial) return;

    const isOwner = activePin === selectedRestaurant.owner_pin;
    const isStaff =
      selectedRestaurant.staff_pin && activePin === selectedRestaurant.staff_pin;

    if (isOwner || isStaff) {
      const role: 'owner' | 'staff' = isOwner ? 'owner' : 'staff';
      await completeSessionAndNavigate(selectedRestaurant, role, false);
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

    const roleLabel = resetTargetRole === 'owner' ? 'Branch' : 'Staff';
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
      setErrorMsg(
        'No mobile number is linked with this restaurant. Please contact support.'
      );
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

    setResetSuccessMsg(
      `${roleLabel} PIN has been reset! Please sign in with your new PIN.`
    );
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

  const initiateRazorpayCheckout = async (params: {
    plan: PricingPlan;
    mode: OutletTabMode;
    phone?: string;
    restaurantName?: string;
    onSuccess: (paymentId?: string) => Promise<void> | void;
    onFinally: () => void;
    onErrorMessage: (msg: string) => void;
  }) => {
    const {
      plan,
      mode,
      phone,
      restaurantName,
      onSuccess,
      onFinally,
      onErrorMessage,
    } = params;
    const label = `${plan.duration} (${plan.price})`;

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        onErrorMessage('Unable to load Razorpay gateway. Please check your connection.');
        onFinally();
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
          restaurantName: restaurantName || undefined,
          ownerPhone: phone || undefined,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.orderId) {
        onErrorMessage(orderData.error || 'Failed to create subscription order');
        onFinally();
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
        handler: async function (response: { razorpay_payment_id?: string }) {
          try {
            await onSuccess(response?.razorpay_payment_id);
          } finally {
            onFinally();
          }
        },
        modal: {
          ondismiss: function () {
            onFinally();
          },
        },
      };

      const RazorpayConstructor = (
        window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }
      ).Razorpay;
      const rzp = new RazorpayConstructor(options);
      rzp.open();
    } catch {
      onErrorMessage('Something went wrong while opening Razorpay.');
      onFinally();
    }
  };

  const handleSelectPlanOpenRegistration = (plan: PricingPlan, mode: OutletTabMode) => {
    setPlanErrorMsg(null);
    const label = `${plan.duration} (${plan.price})`;
    handleOpenRegisterModal(label, mode, plan.id, plan.amount, false);
  };

  const handleOpenRegisterModal = (
    planName = '7-Day Trial • 1 Month',
    mode: OutletTabMode = 'single',
    planId = '1_month',
    amount = 599,
    isTrial = true
  ) => {
    setIsTrialFlow(isTrial);
    setSelectedPlanId(planId);
    setSelectedPlanLabel(planName);
    setSelectedPlanAmount(amount);
    setOutletMode(mode);
    setOutletLabel('');
    setRegName('');
    setRegCity('');
    setRegPhone('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegTables(10);
    setRegOwnerPin('');
    setRegStaffPin('');
    setRegMalikPassword(
      typeof window !== 'undefined'
        ? localStorage.getItem(MASTER_PASS_STORAGE_KEY) || ''
        : ''
    );
    setRegError('');
    setShowRegisterModal(true);
  };

  const completeRestaurantInsertion = async (
    cleanPhone: string,
    cleanEmail: string,
    cleanPassword: string,
    cleanOutletLabel: string,
    isPaidForThisPlan: boolean
  ): Promise<boolean> => {
    setRegistering(true);

    const finalTables = regTables > 0 ? regTables : 10;
    const now = new Date();
    const expiryDate = isPaidForThisPlan
      ? getCalendarExpiryDate(selectedPlanId, selectedPlanLabel, now)
      : new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const basePayload = {
      name: regName.trim(),
      city: regCity.trim(),
      phone: cleanPhone,
      owner_phone: cleanPhone,
      total_tables: finalTables,
      owner_pin: regOwnerPin,
      staff_pin: regStaffPin || null,
      subscription_status: isPaidForThisPlan ? 'active' : 'free_trial',
      plan_type: selectedPlanId,
      selected_plan: selectedPlanLabel,
      trial_ends_at: expiryDate.toISOString(),
    };

    let savedOutletMode: OutletTabMode = outletMode;
    let savedOutletLabel: string | null =
      outletMode === 'multiple' ? cleanOutletLabel : null;

    const fullPayload = {
      ...basePayload,
      email: cleanEmail || null,
      login_password: cleanPassword || null,
      outlet_mode: outletMode,
      outlet_label: savedOutletLabel,
    };

    let insertResult = await supabase
      .from('restaurants')
      .insert([fullPayload])
      .select()
      .single();

    if (insertResult.error) {
      const errText = insertResult.error.message.toLowerCase();
      const isMissingColumnError =
        errText.includes('outlet_mode') ||
        errText.includes('outlet_label') ||
        errText.includes('email') ||
        errText.includes('login_password') ||
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
      return false;
    }

    if (cleanPassword) {
      saveLocalPasswordForRestaurant(data.id, cleanEmail, cleanPhone, cleanPassword);
    }

    await claimSingleRoleSession(data.id, 'owner');

    if (savedOutletMode === 'multiple') {
      const cleanMaster = regMalikPassword.trim();
      if (cleanMaster.length >= 4) {
        localStorage.setItem(MASTER_PASS_STORAGE_KEY, cleanMaster);
      }
      localStorage.setItem(MALIK_VAULT_UNLOCKED_KEY, '1');
    } else {
      localStorage.removeItem(MALIK_VAULT_UNLOCKED_KEY);
    }

    const createdRest: Restaurant = {
      ...(data as Restaurant),
      email: cleanEmail || null,
      login_password: cleanPassword || null,
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

    router.replace('/dashboard');
    return true;
  };

  const handleRegisterRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registering) return;
    setRegError('');

    const cleanPhone = regPhone.replace(/\D/g, '');
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPassword = regPassword.trim();
    const cleanConfirmPassword = regConfirmPassword.trim();
    const cleanOutletLabel = outletLabel.trim();
    const cleanMasterPass = regMalikPassword.trim();

    if (!regName.trim() || !regCity.trim()) {
      setRegError('Restaurant name and city are required.');
      return;
    }
    if (outletMode === 'multiple' && !cleanOutletLabel) {
      setRegError('Please enter the Outlet / Location Name for multiple outlets.');
      return;
    }
    if (outletMode === 'multiple' && cleanMasterPass.length < 4) {
      setRegError('Please set a Malik Master Password (minimum 4 characters).');
      return;
    }
    if (cleanPhone.length !== 10 && !cleanEmail) {
      setRegError('Please enter a valid 10-digit Mobile Number or Email Address.');
      return;
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      setRegError('Please enter a valid 10-digit Owner Mobile Number.');
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setRegError('Please enter a valid email address.');
      return;
    }
    if (cleanPassword.length < 4) {
      setRegError('Please set an account password (minimum 4 characters) for login.');
      return;
    }
    if (cleanPassword !== cleanConfirmPassword) {
      setRegError('Password and Confirm Password do not match.');
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

    const isPaidPlan =
      !isTrialFlow && !selectedPlanLabel.toLowerCase().includes('trial');

    setRegistering(true);

    if (!isPaidPlan && cleanPhone.length === 10) {
      const trialCheck = await checkTrialEligibilityForPhone(cleanPhone);
      if (!trialCheck.allowed) {
        setRegistering(false);
        setRegError(
          trialCheck.message ||
            'This mobile number has already used its 7-day free trial.'
        );
        return;
      }
    }

    const allowed = await checkOutletLimitBeforeProceed(
      cleanPhone,
      outletMode,
      selectedPlanId,
      selectedPlanLabel
    );

    if (!allowed) {
      setRegistering(false);
      const maxOut = getPlanMaxOutlets(selectedPlanId, selectedPlanLabel, outletMode);
      setRegError(
        `Outlet limit reached for ${cleanPhone}! This plan allows up to ${maxOut} outlet${
          maxOut === 1 ? '' : 's'
        }.`
      );
      return;
    }

    if (isPaidPlan && selectedPlanAmount > 0) {
      const planObj: PricingPlan = {
        id: selectedPlanId,
        duration: selectedPlanLabel.split(' (')[0],
        subtitle: '',
        price: `₹${selectedPlanAmount.toLocaleString('en-IN')}`,
        amount: selectedPlanAmount,
        maxOutlets: getPlanMaxOutlets(selectedPlanId, selectedPlanLabel, outletMode),
        badge: null,
        popular: false,
        features: [],
      };

      await initiateRazorpayCheckout({
        plan: planObj,
        mode: outletMode,
        phone: cleanPhone || undefined,
        restaurantName: regName.trim(),
        onFinally: () => setRegistering(false),
        onErrorMessage: (msg) => setRegError(msg),
        onSuccess: async () => {
          await completeRestaurantInsertion(
            cleanPhone,
            cleanEmail,
            cleanPassword,
            cleanOutletLabel,
            true
          );
        },
      });
      return;
    }

    await completeRestaurantInsertion(
      cleanPhone,
      cleanEmail,
      cleanPassword,
      cleanOutletLabel,
      false
    );
  };

  const activeResetLabel = resetTargetRole === 'owner' ? 'Branch' : 'Staff';
  const displayedPlans =
    pricingTab === 'single' ? SINGLE_OUTLET_PLANS : MULTIPLE_OUTLET_PLANS;
  const isSelectedMultiOutlet = selectedRestaurant?.outlet_mode === 'multiple';
  const isSelectedLifetimePlan = isLifetimePlanRecord(selectedRestaurant);

  const isPaidPlanSelected =
    !isTrialFlow && !selectedPlanLabel.toLowerCase().includes('trial');
  const isSingleLocked = isPaidPlanSelected && outletMode === 'multiple';
  const isMultipleLocked = isPaidPlanSelected && outletMode === 'single';

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/45 via-slate-50 to-slate-100/80 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="bg-orange-600 text-white p-2 rounded-xl shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
              Restro<span className="text-orange-600">Sync</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="#pricing"
              className="hidden md:inline-block text-xs font-extrabold text-slate-600 hover:text-orange-600 transition whitespace-nowrap mr-1"
            >
              Plans &amp; Pricing
            </a>

            <button
              type="button"
              onClick={handleOpenLoginModal}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Login</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleOpenRegisterModal('7-Day Trial', 'single', '1_month', 599, true)
              }
              className="bg-orange-600 hover:bg-orange-700 text-white px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Sign Up</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
        {/* Hero Section with Windows & Mac App Install Buttons */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 bg-orange-100/90 text-orange-700 border border-orange-200/80 text-xs font-bold px-3.5 py-1 rounded-full mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            7-Day Free Trial (1 Per Mobile) • Private Account Login
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
            From Table Straight to Kitchen —{' '}
            <span className="text-orange-600">Smart Restaurant POS &amp; KDS</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 mt-4 max-w-2xl mx-auto leading-relaxed">
            Sign in with your Email or Mobile Number &amp; Password/PIN, or sign up in minutes to
            manage Table Orders, QR Menus, and Live Kitchen Display in real time.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => handleDesktopAppDownload('windows')}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-md transition"
            >
              <Monitor className="w-4 h-4 text-orange-400 shrink-0" />
              <span>Download App for Windows</span>
            </button>

            <button
              type="button"
              onClick={() => handleDesktopAppDownload('mac')}
              className="w-full sm:w-auto bg-white hover:bg-orange-50/50 text-slate-900 border-2 border-slate-200 hover:border-orange-500 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-sm transition"
            >
              <Laptop className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Download App for Mac</span>
            </button>
          </div>

          {appDownloadNotice && (
            <div className="mt-4 inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold px-4 py-2 rounded-xl">
              <span>{appDownloadNotice}</span>
              <button
                type="button"
                onClick={() => setAppDownloadNotice(null)}
                className="text-orange-600 hover:text-orange-900 font-extrabold ml-1"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Core Features */}
        <section className="mt-20 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Everything in One Portal
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Designed for speed across dine-in tables, kitchen counters, and owner billing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:border-orange-200 hover:shadow-md transition">
              <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                1. Auto Table QR &amp; Cart
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Dedicated QR code for every table. Customers scan and order directly without
                installing an app.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:border-emerald-200 hover:shadow-md transition">
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

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:border-blue-200 hover:shadow-md transition">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                3. Easy Menu &amp; Billing
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Real-time dish availability toggle, Cash/UPI settlement, and daily sales tracking.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mt-20 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Go Live in 3 Simple Steps
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              No complex hardware installation—start taking orders the same day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:border-orange-200 transition">
              <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
                Step 01
              </span>
              <h3 className="font-extrabold text-slate-900 text-base mt-3">
                Register &amp; Configure Tables
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Create your restaurant account, set your login credentials &amp; PINs, and enter
                your table count.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:border-orange-200 transition">
              <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
                Step 02
              </span>
              <h3 className="font-extrabold text-slate-900 text-base mt-3">
                Share QR &amp; Open Kitchen Screen
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Guests scan table QRs to browse and place orders while kitchen staff track KOTs
                live.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:border-orange-200 transition">
              <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
                Step 03
              </span>
              <h3 className="font-extrabold text-slate-900 text-base mt-3">
                Settle Bills &amp; Track Sales
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Manage Cash/UPI payments, search invoices or UTRs, and monitor daily or multi-outlet
                sales.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mt-24 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold px-3.5 py-1 rounded-full mb-2.5">
                <Sparkles className="w-3.5 h-3.5" /> Simple &amp; Transparent Plans
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Choose the Best Plan for Your Restaurant
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                Select a plan to open registration, fill details, complete payment, and launch your
                dashboard.
              </p>
            </div>

            <div className="inline-flex bg-slate-200/80 p-1 rounded-2xl border border-slate-300/70 self-start md:self-auto shrink-0 max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setPricingTab('single');
                  setPlanErrorMsg(null);
                }}
                className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  pricingTab === 'single'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4 shrink-0" />
                <span>Single Outlet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPricingTab('multiple');
                  setPlanErrorMsg(null);
                }}
                className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  pricingTab === 'multiple'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Multiple Outlets</span>
              </button>
            </div>
          </div>

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
                    <div className="flex items-center justify-between gap-1.5">
                      <h3 className="text-base font-extrabold">{plan.duration}</h3>
                      {plan.badge && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
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
                      onClick={() => handleSelectPlanOpenRegistration(plan, pricingTab)}
                      className={`w-full py-2.5 rounded-2xl text-xs font-extrabold transition ${
                        plan.popular
                          ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md'
                          : isLifetime
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      Select {plan.price} &amp; Sign Up →
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenRegisterModal(
                          `7-Day Trial • ${plan.duration} (${plan.price})`,
                          pricingTab,
                          plan.id,
                          plan.amount,
                          true
                        )
                      }
                      className={`w-full py-1.5 rounded-xl text-[11px] font-bold transition ${
                        plan.popular
                          ? 'text-slate-300 hover:text-white'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Start 7-Day Free Trial
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Built For Every Food Business */}
        <section className="mt-24 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Built for Every Food Business
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Adaptable workflows for solo outlets, busy kitchens, and multi-branch brands.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-200 transition">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Coffee className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Cafes &amp; Bakeries</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Fast table QR ordering, quick stock toggles, and smooth counter billing.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-orange-200 transition">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">QSR &amp; Fast Food</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Rapid kitchen ticket flow during peak rush hours without missed orders.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-purple-200 transition">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                <Wine className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Dine-In Restaurants</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Organized table-wise order tracking, digital receipts, and payment splits.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-emerald-200 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Multi-Outlet Brands</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Centralized owner oversight across branches with individual branch &amp; staff PINs.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-24 max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Quick answers about trials, account access, and outlet plans.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                  >
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-orange-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 text-white p-1.5 rounded-lg">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                Restro<span className="text-orange-600">Sync</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Smart Restaurant POS, QR Table Ordering &amp; Live Kitchen Display.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
            <a href="#pricing" className="hover:text-orange-600 transition">
              Plans &amp; Pricing
            </a>
            <button
              type="button"
              onClick={handleOpenLoginModal}
              className="hover:text-orange-600 transition"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() =>
                handleOpenRegisterModal('7-Day Trial', 'single', '1_month', 599, true)
              }
              className="hover:text-orange-600 transition"
            >
              Sign Up
            </button>
          </div>
        </div>
      </footer>

      {/* Account Login Modal (Direct Fields + Top-Left "Login as Super Admin" & Top-Right Toggle) */}
      {showLoginLookupModal && (
        <div
          onClick={() => !loggingInDirect && setShowLoginLookupModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-7 shadow-2xl relative text-center max-h-[92vh] overflow-y-auto overscroll-contain"
          >
            <button
              type="button"
              disabled={loggingInDirect}
              onClick={() => setShowLoginLookupModal(false)}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Top Row inside Login Form: Left "Login as Super Admin" + Right Toggle */}
            <div className="flex items-center justify-between gap-2 pr-8 mb-3 text-left">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    isSuperAdminLoginToggle ? 'text-orange-600' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs font-extrabold text-slate-800 truncate">
                  Login as Super Admin
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isSuperAdminLoginToggle}
                disabled={loggingInDirect}
                onClick={() => {
                  setIsSuperAdminLoginToggle((prev) => !prev);
                  setLoginLookupError('');
                  setLoginMatchedLifetime(false);
                  setLoginAccountPassword('');
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  isSuperAdminLoginToggle ? 'bg-orange-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    isSuperAdminLoginToggle ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                isSuperAdminLoginToggle
                  ? 'bg-slate-900 text-amber-400'
                  : 'bg-orange-100 text-orange-600'
              }`}
            >
              {isSuperAdminLoginToggle ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <LogIn className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-lg font-extrabold text-slate-900">
              {isSuperAdminLoginToggle ? 'Super Admin Login' : 'Account Login'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isSuperAdminLoginToggle
                ? 'Enter registered Owner Mobile/Email and Super Admin Master Password.'
                : 'Enter your registered Single Outlet Email or Mobile Number and Password/PIN.'}
            </p>

            <form
              onSubmit={handleLoginLookupSubmit}
              autoComplete="off"
              className="mt-5 space-y-3.5 text-left"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isSuperAdminLoginToggle
                    ? 'Registered Owner Mobile or Email *'
                    : 'Email or Mobile Number *'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    required
                    value={loginLookupId}
                    onChange={(e) => {
                      setLoginLookupId(e.target.value);
                      setLoginLookupError('');
                    }}
                    placeholder={
                      isSuperAdminLoginToggle
                        ? '10-digit mobile or owner@restro.com'
                        : 'e.g. owner@restro.com or 98XXXXXXXX'
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isSuperAdminLoginToggle
                    ? 'Super Admin Master Password (Min 4 Chars) *'
                    : 'Password / PIN *'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={isSuperAdminLoginToggle ? 4 : undefined}
                    autoComplete="current-password"
                    value={loginAccountPassword}
                    onChange={(e) => {
                      setLoginAccountPassword(e.target.value);
                      setLoginLookupError('');
                    }}
                    placeholder={
                      isSuperAdminLoginToggle
                        ? 'Enter super admin master password'
                        : 'Enter your password or PIN'
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                  />
                </div>
              </div>

              {loginLookupError && (
                <div className="text-xs font-bold text-red-600 bg-red-50 py-2.5 px-3 rounded-xl space-y-2 text-center">
                  <p>{loginLookupError}</p>
                  {isSuperAdminLoginToggle && !loginMatchedLifetime && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowLoginLookupModal(false);
                        setPricingTab('multiple');
                        document
                          .getElementById('pricing')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-2 rounded-xl text-xs transition"
                    >
                      Pay / Upgrade Plan Now →
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loggingInDirect}
                className={`w-full disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition ${
                  isSuperAdminLoginToggle
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {loggingInDirect
                  ? 'Signing In...'
                  : isSuperAdminLoginToggle
                  ? 'Open Super Admin Dashboard →'
                  : 'Login to Dashboard →'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginLookupModal(false);
                    handleOpenRegisterModal('7-Day Trial', 'single', '1_month', 599, true);
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-orange-600 transition"
                >
                  New here? Sign Up for Free Trial &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign Up / Register Modal with Complete Details, Sticky Footer & Hidden Scrollbar */}
      {showRegisterModal && (
        <div
          onClick={() => !registering && setShowRegisterModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-3.5 border-b border-slate-100 shrink-0 relative text-center">
              <button
                type="button"
                disabled={registering}
                onClick={() => setShowRegisterModal(false)}
                className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{' '}
                {isTrialFlow ? '7-Day Free Trial' : selectedPlanLabel}
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Create Restaurant Account
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isTrialFlow
                  ? '7-day free trial (1 per mobile). Login anytime with Email or Mobile.'
                  : 'Fill your details below, complete payment, and open your dashboard.'}
              </p>
            </div>

            <form
              onSubmit={handleRegisterRestaurant}
              autoComplete="off"
              className="flex-1 min-h-0 flex flex-col"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 py-4 space-y-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Restaurant Setup Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSingleLocked || registering}
                      onClick={() => {
                        if (isSingleLocked) return;
                        setOutletMode('single');
                        setOutletLabel('');
                        setRegError('');
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition ${
                        outletMode === 'single'
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${
                        isSingleLocked
                          ? 'opacity-45 cursor-not-allowed bg-slate-100 text-slate-400 hover:bg-slate-100'
                          : ''
                      }`}
                    >
                      Single Outlet
                    </button>
                    <button
                      type="button"
                      disabled={isMultipleLocked || registering}
                      onClick={() => {
                        if (isMultipleLocked) return;
                        setOutletMode('multiple');
                        setRegError('');
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition ${
                        outletMode === 'multiple'
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${
                        isMultipleLocked
                          ? 'opacity-45 cursor-not-allowed bg-slate-100 text-slate-400 hover:bg-slate-100'
                          : ''
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
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        1st Outlet / Location Name *
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

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Malik Master Password (Min 4 Chars) *
                      </label>
                      <div className="relative">
                        <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          minLength={4}
                          autoComplete="new-password"
                          value={regMalikPassword}
                          onChange={(e) => {
                            setRegMalikPassword(e.target.value);
                            setRegError('');
                          }}
                          placeholder="Master password for all outlets"
                          className="w-full pl-10 pr-3.5 py-2.5 border border-orange-300 focus:border-orange-500 rounded-xl text-sm font-semibold outline-none transition"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      City *
                    </label>
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
                </div>

                <div className="pt-1 border-t border-slate-100 space-y-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Login Credentials
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Owner Mobile Number (10-Digit) *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={regPhone}
                        onChange={(e) => {
                          setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                          setRegError('');
                        }}
                        placeholder="10-digit mobile number"
                        className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => {
                          setRegEmail(e.target.value);
                          setRegError('');
                        }}
                        placeholder="e.g. owner@restro.com"
                        className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Password (Min 4 Chars) *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          minLength={4}
                          autoComplete="new-password"
                          value={regPassword}
                          onChange={(e) => {
                            setRegPassword(e.target.value);
                            setRegError('');
                          }}
                          placeholder="Create password"
                          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          minLength={4}
                          autoComplete="new-password"
                          value={regConfirmPassword}
                          onChange={(e) => {
                            setRegConfirmPassword(e.target.value);
                            setRegError('');
                          }}
                          placeholder="Re-enter password"
                          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-100 space-y-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    POS &amp; Kitchen Access PINs
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Branch PIN (6-Digit) *
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                        Kitchen Staff PIN (Optional)
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                </div>

                {isPaidPlanSelected && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700">Selected Plan</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {outletMode === 'multiple' ? 'Multiple Outlets' : 'Single Outlet'} •{' '}
                        {selectedPlanLabel}
                      </p>
                    </div>
                    <span className="text-base font-extrabold text-orange-600 shrink-0">
                      ₹{selectedPlanAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-5 sm:px-7 pt-3 pb-5 sm:pb-6 border-t border-slate-100 bg-white shrink-0 space-y-2.5">
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
                  {registering
                    ? isPaidPlanSelected
                      ? 'Processing Payment & Setup...'
                      : 'Creating Restaurant...'
                    : isPaidPlanSelected
                    ? `Pay ₹${selectedPlanAmount.toLocaleString('en-IN')} & Open Dashboard →`
                    : 'Start Free Trial & Open Dashboard →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Outlet Limit Dialog */}
      {limitDialog.open && (
        <div
          onClick={() => setLimitDialog((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-red-200 text-center space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Outlet Limit Exceeded for This Number
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Mobile number <strong>{limitDialog.phone}</strong> already has{' '}
                <strong>{limitDialog.existingCount}</strong> outlet(s). Selected plan{' '}
                <strong>{limitDialog.planLabel}</strong> allows up to{' '}
                <strong>{limitDialog.maxOutlets}</strong> outlet(s).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setLimitDialog((prev) => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setLimitDialog((prev) => ({ ...prev, open: false }));
                  setShowRegisterModal(false);
                  setPricingTab('multiple');
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>Choose Higher Outlet Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN / Master Password / Forgot PIN Modal */}
      {selectedRestaurant && (
        <div
          onClick={handleClosePinModal}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-7 shadow-2xl relative text-center max-h-[92vh] overflow-y-auto overscroll-contain"
          >
            <button
              type="button"
              onClick={handleClosePinModal}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
              {isForgotMode ? (
                <KeyRound className="w-6 h-6" />
              ) : loginStep === 'malik_master' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 break-words px-4">
              {formatRestaurantDisplayName(selectedRestaurant)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{selectedRestaurant.city}</p>

            {isSelectedLifetimePlan && (
              <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-3 py-0.5 rounded-full">
                <Crown className="w-3 h-3 text-amber-700" /> Lifetime Plan Active
              </span>
            )}

            {isSelectedMultiOutlet && loginStep === 'choose_role' && !isForgotMode ? (
              <div className="mt-5 space-y-3 text-left">
                <p className="text-xs text-slate-500 text-center">
                  Select how you want to login:
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('branch_pin');
                    setErrorMsg('');
                  }}
                  className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50/50 transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-slate-900">
                      Branch Manager / Staff
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Login with 6-digit Branch or Staff PIN
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-orange-600 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('malik_master');
                    setErrorMsg('');
                  }}
                  className="w-full p-4 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white hover:bg-slate-800 transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm">Outlets Owner</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Master Password for all outlets &amp; sales report
                    </p>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                </button>
              </div>
            ) : isForgotMode ? (
              <form
                onSubmit={handleResetPin}
                autoComplete="off"
                className="mt-5 space-y-3.5 text-left"
              >
                <p className="text-xs text-slate-500 text-center">
                  Verify your registered <strong>Owner Mobile Number</strong> to set a new
                  6-digit <strong>{activeResetLabel} PIN</strong>.
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
            ) : isSelectedMultiOutlet && loginStep === 'malik_master' ? (
              <form
                onSubmit={handleMalikMasterLogin}
                autoComplete="off"
                className="mt-5 space-y-4"
              >
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {isSettingMalikPass
                    ? 'Set Malik Master Password (min 4 chars)'
                    : 'Enter Malik Master Password'}
                </label>

                <input
                  type="password"
                  autoFocus
                  value={malikMasterPass}
                  onChange={(e) => {
                    setMalikMasterPass(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Enter master password"
                  className="w-full text-center text-base font-extrabold py-3 px-4 border-2 border-slate-200 focus:border-slate-900 rounded-2xl outline-none transition"
                />

                {errorMsg && (
                  <div className="text-xs font-bold text-red-600 bg-red-50 py-2.5 px-3 rounded-xl space-y-2">
                    <p>{errorMsg}</p>
                    {!isSelectedLifetimePlan && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClosePinModal();
                          setPricingTab('multiple');
                          document
                            .getElementById('pricing')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-2 rounded-xl text-xs transition"
                      >
                        Pay / Upgrade Plan Now →
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition"
                >
                  {verifying
                    ? 'Opening Dashboard...'
                    : isSettingMalikPass
                    ? 'Save & Open Malik Dashboard'
                    : 'Open Outlets Owner Dashboard'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('choose_role');
                      setErrorMsg('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                  >
                    &larr; Switch Login Type
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePinLogin} autoComplete="off" className="mt-5 space-y-4">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Enter 6-Digit Branch or Staff PIN
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
                  className="w-full text-center text-2xl tracking-[0.45em] sm:tracking-[0.65em] font-extrabold py-3.5 px-3 border-2 border-slate-200 focus:border-orange-500 rounded-2xl outline-none transition"
                />

                {errorMsg && (
                  <div className="text-xs font-bold text-red-600 bg-red-50 py-2.5 px-3 rounded-xl space-y-2">
                    <p>{errorMsg}</p>
                    {!isSelectedLifetimePlan && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClosePinModal();
                          setPricingTab(isSelectedMultiOutlet ? 'multiple' : 'single');
                          document
                            .getElementById('pricing')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-2 rounded-xl text-xs transition"
                      >
                        Pay / Upgrade Plan Now →
                      </button>
                    )}
                  </div>
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
                    Forgot Branch PIN? Reset Here &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartForgotMode('staff')}
                    className="text-xs font-bold text-slate-500 hover:text-orange-600 transition"
                  >
                    Forgot Staff PIN? Reset Here &rarr;
                  </button>
                  {isSelectedMultiOutlet && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginStep('choose_role');
                        setErrorMsg('');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 transition mt-1"
                    >
                      &larr; Switch Login Type
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}