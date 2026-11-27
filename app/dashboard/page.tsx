"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  isRoleSessionActive,
  releaseRoleSessionIfOwner,
  clearLocalSessionToken,
} from "@/lib/roleSessionGuard";
import {
  getMultiOutletCapabilities,
  getMaxOutletsForPlan,
  getCalendarExpiryDate,
  isTrialExpiredRecord,
  TRIAL_DURATION_DAYS,
} from "@/lib/planFeatures";
import SessionReplacedDialog from "@/components/SessionReplacedDialog";
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
  Building2,
  Plus,
  Lock,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  Store,
  Filter,
  RotateCcw,
} from "lucide-react";

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  brandName?: string;
  outletLabel?: string | null;
  outletMode?: "single" | "multiple";
  ownerPhone?: string | null;
  city: string;
  totalTables: number;
  role: "owner" | "staff";
}

interface OutletMeta {
  id: string;
  name: string;
  city: string;
  total_tables?: number;
  outlet_mode?: string | null;
  outlet_label?: string | null;
  owner_pin?: string | null;
  staff_pin?: string | null;
}

interface SubscriptionInfo {
  status: string;
  planType: string;
  selectedPlan: string;
  daysLeft: number;
  isExpired: boolean;
}

interface OrderRecord {
  id: string;
  restaurant_id?: string;
  table_number: number;
  status: "pending" | "preparing" | "ready" | "served" | "completed";
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

interface ArchivedOutletRecord {
  outlet: OutletMeta;
  deletedAt: string;
  orders: OrderRecord[];
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

interface UpgradePlanOption {
  id: string;
  name: string;
  price: string;
  amount: number;
  maxOutlets: number | null;
  tag: string;
}

const ADMIN_WHATSAPP = "919079083101";
const MALIK_VAULT_UNLOCKED_KEY = "restro_malik_vault_unlocked";

const SINGLE_UPGRADE_PLANS: UpgradePlanOption[] = [
  {
    id: "1_month",
    name: "1 Month Plan",
    price: "₹599",
    amount: 599,
    maxOutlets: 1,
    tag: "Calendar Month",
  },
  {
    id: "3_months",
    name: "3 Months Plan",
    price: "₹1,699",
    amount: 1699,
    maxOutlets: 1,
    tag: "3 Calendar Months",
  },
  {
    id: "6_months",
    name: "6 Months Plan",
    price: "₹3,299",
    amount: 3299,
    maxOutlets: 1,
    tag: "6 Calendar Months",
  },
  {
    id: "yearly",
    name: "Yearly Plan (12 Months)",
    price: "₹5,499",
    amount: 5499,
    maxOutlets: 1,
    tag: "1 Calendar Year",
  },
  {
    id: "lifetime",
    name: "Lifetime License",
    price: "₹19,999",
    amount: 19999,
    maxOutlets: 1,
    tag: "One-Time Pay",
  },
];

const MULTI_UPGRADE_PLANS: UpgradePlanOption[] = [
  {
    id: "multi_1_month",
    name: "1 Month Plan",
    price: "₹1,115",
    amount: 1115,
    maxOutlets: 2,
    tag: "Up to 2 Outlets • 1 Mo",
  },
  {
    id: "multi_3_months",
    name: "3 Months Plan",
    price: "₹11,159",
    amount: 11159,
    maxOutlets: 5,
    tag: "Up to 5 Outlets • 3 Mo",
  },
  {
    id: "multi_6_months",
    name: "6 Months Plan",
    price: "₹18,599",
    amount: 18599,
    maxOutlets: 8,
    tag: "Up to 8 Outlets • 6 Mo",
  },
  {
    id: "multi_yearly",
    name: "Yearly Plan (12 Months)",
    price: "₹27,899",
    amount: 27899,
    maxOutlets: 15,
    tag: "Up to 15 Outlets • 1 Yr",
  },
  {
    id: "multi_lifetime",
    name: "Lifetime License",
    price: "₹37,199",
    amount: 37199,
    maxOutlets: null,
    tag: "Unlimited Outlets",
  },
];

function isLifetimeSubscription(sub: SubscriptionInfo): boolean {
  const pt = (sub.planType || "").toLowerCase();
  const sp = (sub.selectedPlan || "").toLowerCase();
  const st = (sub.status || "").toLowerCase();
  return (
    pt.includes("lifetime") ||
    sp.includes("lifetime") ||
    st === "lifetime" ||
    sp.includes("19,999") ||
    sp.includes("37,199")
  );
}

function formatOutletTitle(outlet: {
  name: string;
  city?: string;
  outlet_mode?: string | null;
  outlet_label?: string | null;
}): string {
  const label = outlet.outlet_label?.trim();
  if (outlet.outlet_mode === "multiple" && label) {
    return `${outlet.name} — ${label}`;
  }
  return outlet.city ? `${outlet.name} (${outlet.city})` : outlet.name;
}

function getArchivedOutletsStorageKey(
  ownerPhone?: string | null,
  fallbackId?: string,
): string {
  const cleanPhone = (ownerPhone || "").replace(/\D/g, "");
  return `restro_deleted_outlets_${cleanPhone || fallbackId || "default"}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [actualTablesCount, setActualTablesCount] = useState<number>(5);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo>({
    status: "free_trial",
    planType: "1_month",
    selectedPlan: "7-Day Trial",
    daysLeft: TRIAL_DURATION_DAYS,
    isExpired: false,
  });

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ownerOutlets, setOwnerOutlets] = useState<OutletMeta[]>([]);
  const [allOutletOrders, setAllOutletOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Malik (Super Owner) Mode
  const [isMalikMode, setIsMalikMode] = useState(false);
  const [showOutletPins, setShowOutletPins] = useState(false);
  const [malikReportFilter, setMalikReportFilter] = useState<
    "today" | "7days" | "all" | "custom"
  >("today");
  const [malikFromDate, setMalikFromDate] = useState<string>("");
  const [malikToDate, setMalikToDate] = useState<string>("");
  const [selectedOutletDropdown, setSelectedOutletDropdown] =
    useState<string>("all");
  const [malikBillSearch, setMalikBillSearch] = useState<string>("");

  // Deleted Outlets Archive State
  const [archivedOutlets, setArchivedOutlets] = useState<
    ArchivedOutletRecord[]
  >([]);
  const [showDeletedOutletsModal, setShowDeletedOutletsModal] = useState(false);
  const [selectedArchivedOutletId, setSelectedArchivedOutletId] = useState<
    string | null
  >(null);
  const [restoringOutletId, setRestoringOutletId] = useState<string | null>(
    null,
  );

  // Add Linked Outlet Modal (Malik-only)
  const [showAddOutletModal, setShowAddOutletModal] = useState(false);
  const [newOutletLabel, setNewOutletLabel] = useState("");
  const [newOutletCity, setNewOutletCity] = useState("");
  const [newOutletTables, setNewOutletTables] = useState<number>(10);
  const [newOutletOwnerPin, setNewOutletOwnerPin] = useState("");
  const [newOutletStaffPin, setNewOutletStaffPin] = useState("");
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [addOutletError, setAddOutletError] = useState("");

  // Remove Linked Outlet Modal (Malik-only)
  const [outletToRemove, setOutletToRemove] = useState<OutletMeta | null>(null);
  const [removingOutletId, setRemovingOutletId] = useState<string | null>(null);
  const [removeOutletError, setRemoveOutletError] = useState("");

  // Table Action Modal
  const [selectedTableModal, setSelectedTableModal] = useState<number | null>(
    null,
  );
  const [settling, setSettling] = useState(false);

  // Quick Stock Toggle Modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItems, setStockItems] = useState<MenuStockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Branch Bills & Sales Modal
  const [todayIso, setTodayIso] = useState<string>("");
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salesFilter, setSalesFilter] = useState<
    "today" | "7days" | "all" | "custom"
  >("today");
  const [customFromDate, setCustomFromDate] = useState<string>("");
  const [customToDate, setCustomToDate] = useState<string>("");
  const [billSearchQuery, setBillSearchQuery] = useState<string>("");

  // Plan Upgrade Modal & Razorpay State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModeTab, setUpgradeModeTab] = useState<"single" | "multiple">(
    "single",
  );
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [upgradeSuccessBanner, setUpgradeSuccessBanner] = useState<
    string | null
  >(null);
  const [upgradeErrorMsg, setUpgradeErrorMsg] = useState<string | null>(null);

  // Payment Setup Modal
  const [showPaymentSettingsModal, setShowPaymentSettingsModal] =
    useState(false);
  const [ownerUpiId, setOwnerUpiId] = useState("");
  const [ownerBankName, setOwnerBankName] = useState("");
  const [ownerRzpKeyId, setOwnerRzpKeyId] = useState("");
  const [ownerRzpKeySecret, setOwnerRzpKeySecret] = useState("");
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [paymentSettingsMsg, setPaymentSettingsMsg] = useState<string | null>(
    null,
  );
  const [isPaymentConfigured, setIsPaymentConfigured] = useState<boolean>(true);
  const [savedPaymentInfo, setSavedPaymentInfo] = useState({
    upiId: "",
    bankName: "",
    rzpKeyId: "",
    rzpKeySecret: "",
  });

  // 1-Hour Inactivity Modal & Session Replaced Dialog
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [sessionReplaced, setSessionReplaced] = useState(false);

  const multiCaps = getMultiOutletCapabilities(
    subInfo.planType,
    subInfo.selectedPlan,
    session?.outletMode,
  );
  const isLifetimePlanActive = isLifetimeSubscription(subInfo);

  const openUpgradeForMultiFeature = (reason: string) => {
    if (isLifetimePlanActive) return;
    setUpgradeErrorMsg(reason);
    setUpgradeModeTab("multiple");
    setShowUpgradeModal(true);
  };

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setTodayIso(today);
    setCustomFromDate(today);
    setCustomToDate(today);
    setMalikFromDate(today);
    setMalikToDate(today);

    const raw = localStorage.getItem("restro_session");
    if (!raw) {
      router.push("/");
      return;
    }

    try {
      const parsed: SessionData = JSON.parse(raw);

      if (parsed.role === "staff") {
        router.replace(`/kitchen/${parsed.restaurantId}`);
        return;
      }

      const malikUnlocked =
        localStorage.getItem(MALIK_VAULT_UNLOCKED_KEY) === "1";

      setSession(parsed);
      setIsMalikMode(malikUnlocked);
      setNewOutletCity(parsed.city || "");
      setUpgradeModeTab(
        parsed.outletMode === "multiple" || malikUnlocked
          ? "multiple"
          : "single",
      );
      if (parsed.totalTables) {
        setActualTablesCount(parsed.totalTables);
      }

      const archiveKey = getArchivedOutletsStorageKey(
        parsed.ownerPhone,
        parsed.restaurantId,
      );
      const rawArchive = localStorage.getItem(archiveKey);
      if (rawArchive) {
        const parsedArchive = JSON.parse(rawArchive);
        if (Array.isArray(parsedArchive)) {
          setArchivedOutlets(parsedArchive);
        }
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const anyModalOpen =
      showSalesModal ||
      showUpgradeModal ||
      showAddOutletModal ||
      outletToRemove !== null ||
      showDeletedOutletsModal ||
      showPaymentSettingsModal ||
      showStockModal ||
      selectedTableModal !== null ||
      showInactivityModal ||
      sessionReplaced;

    if (anyModalOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [
    showSalesModal,
    showUpgradeModal,
    showAddOutletModal,
    outletToRemove,
    showDeletedOutletsModal,
    showPaymentSettingsModal,
    showStockModal,
    selectedTableModal,
    showInactivityModal,
    sessionReplaced,
  ]);

  // SINGLE OWNER SESSION GUARD
  useEffect(() => {
    if (!session?.restaurantId || session.role !== "owner") return;

    let cancelled = false;

    const enforceSingleOwner = async () => {
      const stillActive = await isRoleSessionActive(
        session.restaurantId,
        "owner",
      );
      if (!stillActive && !cancelled) {
        localStorage.removeItem("restro_session");
        localStorage.removeItem(MALIK_VAULT_UNLOCKED_KEY);
        clearLocalSessionToken();
        setSessionReplaced(true);
      }
    };

    enforceSingleOwner();

    const sessionChannel = supabase
      .channel(`owner-single-session-${session.restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_role_sessions",
          filter: `restaurant_id=eq.${session.restaurantId}`,
        },
        (payload) => {
          const row = payload.new as { role?: string } | null;
          if (!row || row.role === "owner") {
            enforceSingleOwner();
          }
        },
      )
      .subscribe();

    const pollTimer = setInterval(enforceSingleOwner, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(sessionChannel);
      clearInterval(pollTimer);
    };
  }, [session?.restaurantId, session?.role]);

  // 1-HOUR INACTIVITY AUTO LOGOUT
  useEffect(() => {
    if (!session?.restaurantId || session.role !== "owner") return;

    const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const triggerInactivityLogout = async () => {
      await releaseRoleSessionIfOwner(session.restaurantId, "owner");
      localStorage.removeItem("restro_session");
      localStorage.removeItem(MALIK_VAULT_UNLOCKED_KEY);
      setIsMalikMode(false);
      setShowInactivityModal(true);
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(
        triggerInactivityLogout,
        INACTIVITY_LIMIT_MS,
      );
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    activityEvents.forEach((event) =>
      window.addEventListener(event, resetInactivityTimer, { passive: true }),
    );

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetInactivityTimer),
      );
    };
  }, [session?.restaurantId, session?.role]);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.restaurantId) return;

    const [{ data: restData }, { data: ordersData }] = await Promise.all([
      supabase
        .from("restaurants")
        .select(
          "id, name, city, total_tables, owner_phone, outlet_mode, outlet_label, owner_pin, staff_pin, subscription_status, plan_type, selected_plan, trial_ends_at, razorpay_key_id, razorpay_key_secret, upi_id, bank_account_name",
        )
        .eq("id", session.restaurantId)
        .single(),
      supabase
        .from("orders")
        .select(
          "id, restaurant_id, table_number, status, total_amount, payment_method, payment_status, customer_name, customer_phone, invoice_number, razorpay_payment_id, created_at, order_items(id, item_name, quantity, price, notes)",
        )
        .eq("restaurant_id", session.restaurantId)
        .order("created_at", { ascending: false }),
    ]);

    let resolvedOwnerPhone = session.ownerPhone || "";

    if (restData) {
      if (restData.total_tables) {
        setActualTablesCount(Number(restData.total_tables));
      }
      if (restData.owner_phone) {
        resolvedOwnerPhone = String(restData.owner_phone);
      }
      if (restData.outlet_mode === "multiple") {
        setUpgradeModeTab("multiple");
      }

      const upi = restData.upi_id || "";
      const bank = restData.bank_account_name || "";
      const keyId = restData.razorpay_key_id || "";
      const keySecret = restData.razorpay_key_secret || "";

      setSavedPaymentInfo({
        upiId: upi,
        bankName: bank,
        rzpKeyId: keyId,
        rzpKeySecret: keySecret,
      });

      const hasUpi = Boolean(upi.trim());
      const hasRzp = Boolean(keyId && keySecret);
      setIsPaymentConfigured(hasUpi || hasRzp);

      const status = restData.subscription_status || "free_trial";
      const planType = restData.plan_type || "1_month";
      const selectedPlan = restData.selected_plan || "7-Day Trial";
      let daysLeft = TRIAL_DURATION_DAYS;
      let isExpired = false;

      if (restData.trial_ends_at) {
        const diffMs = new Date(restData.trial_ends_at).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if (isTrialExpiredRecord(restData)) {
          isExpired = true;
        }
      }

      const nextSubInfo: SubscriptionInfo = {
        status,
        planType,
        selectedPlan,
        daysLeft,
        isExpired,
      };
      setSubInfo(nextSubInfo);

      if (
        isExpired &&
        session.role === "owner" &&
        !isLifetimeSubscription(nextSubInfo)
      ) {
        setUpgradeErrorMsg(
          "Your 7-day free trial has ended (8th day). Please complete payment below to continue.",
        );
        setUpgradeModeTab(
          restData.outlet_mode === "multiple" ||
            localStorage.getItem(MALIK_VAULT_UNLOCKED_KEY) === "1"
            ? "multiple"
            : "single",
        );
        setShowUpgradeModal(true);
      }

      const caps = getMultiOutletCapabilities(
        planType,
        selectedPlan,
        restData.outlet_mode || session.outletMode,
      );
      if (!caps.canUseCustomDateRange) {
        setMalikReportFilter((prev) => (prev === "custom" ? "today" : prev));
      }
      if (!caps.canInspectOutletCustomers) {
        setSelectedOutletDropdown("all");
      }
    }

    const archiveKey = getArchivedOutletsStorageKey(
      resolvedOwnerPhone,
      session.restaurantId,
    );
    try {
      const rawArchive = localStorage.getItem(archiveKey);
      if (rawArchive) {
        const parsedArchive = JSON.parse(rawArchive);
        if (Array.isArray(parsedArchive)) {
          setArchivedOutlets(parsedArchive);
        }
      }
    } catch {
      // Ignore storage error
    }

    const currentOutletOrders = ((ordersData || []) as OrderRecord[]).map(
      (o) => ({
        ...o,
        restaurant_id: o.restaurant_id || session.restaurantId,
      }),
    );
    setOrders(currentOutletOrders);

    if (session.role === "owner" && resolvedOwnerPhone) {
      const { data: siblingOutlets } = await supabase
        .from("restaurants")
        .select(
          "id, name, city, total_tables, outlet_mode, outlet_label, owner_pin, staff_pin",
        )
        .eq("owner_phone", resolvedOwnerPhone);

      const outletsList: OutletMeta[] =
        siblingOutlets && siblingOutlets.length > 0
          ? (siblingOutlets as OutletMeta[])
          : [
              {
                id: session.restaurantId,
                name: session.brandName || session.restaurantName,
                city: session.city,
                total_tables: session.totalTables,
                outlet_mode: session.outletMode,
                outlet_label: session.outletLabel,
              },
            ];

      setOwnerOutlets(outletsList);

      const outletIds = outletsList.map((o) => o.id);
      if (outletIds.length > 0) {
        const { data: combinedOrders } = await supabase
          .from("orders")
          .select(
            "id, restaurant_id, table_number, status, total_amount, payment_method, payment_status, customer_name, customer_phone, invoice_number, razorpay_payment_id, created_at, order_items(id, item_name, quantity, price, notes)",
          )
          .in("restaurant_id", outletIds)
          .order("created_at", { ascending: false });

        if (combinedOrders) {
          setAllOutletOrders(combinedOrders as OrderRecord[]);
        }
      }
    } else {
      setOwnerOutlets([]);
      setAllOutletOrders(currentOutletOrders);
    }

    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (!session?.restaurantId) return;

    setLoading(true);
    fetchDashboardData();

    const channel = supabase
      .channel(`dashboard-orders-${session.restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${session.restaurantId}`,
        },
        () => {
          fetchDashboardData();
        },
      )
      .subscribe();

    const interval = setInterval(fetchDashboardData, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [session?.restaurantId, fetchDashboardData]);

  const isOwner = session?.role === "owner";
  const isMultiOutletMode =
    isOwner && (session?.outletMode === "multiple" || ownerOutlets.length > 1);
  // Plan name (Yearly / Lifetime / etc.) is shown only to Malik (Master Password mode)
  const canShowPlanDetails = isMalikMode;

  const maxAllowedOutlets = getMaxOutletsForPlan(
    subInfo.planType,
    subInfo.selectedPlan,
    session?.outletMode || "multiple",
  );
  const currentOutletCount = Math.max(1, ownerOutlets.length);
  const isAtOutletLimit =
    maxAllowedOutlets !== null && currentOutletCount >= maxAllowedOutlets;

  const handleOpenAddOutletModal = () => {
    if (!session) return;
    if (isAtOutletLimit) {
      if (isLifetimePlanActive) {
        setAddOutletError(
          `Outlet limit reached (${maxAllowedOutlets} outlets max).`,
        );
        return;
      }
      openUpgradeForMultiFeature(
        `Your ${multiCaps.tierName} plan (${subInfo.selectedPlan}) allows up to ${maxAllowedOutlets} outlet${
          maxAllowedOutlets === 1 ? "" : "s"
        }. Upgrade to add more outlets.`,
      );
      return;
    }

    setNewOutletLabel("");
    setNewOutletCity(session.city || "");
    setNewOutletTables(10);
    setNewOutletOwnerPin("");
    setNewOutletStaffPin("");
    setAddOutletError("");
    setShowAddOutletModal(true);
  };

  const handleCreateLinkedOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setAddOutletError("");

    if (isAtOutletLimit) {
      setAddOutletError(
        `Plan limit reached (${maxAllowedOutlets} outlets max). Upgrade your plan first.`,
      );
      return;
    }

    const cleanLabel = newOutletLabel.trim();
    const cleanCity = newOutletCity.trim();
    const cleanPhone = (session.ownerPhone || "").replace(/\D/g, "");

    if (!cleanLabel) {
      setAddOutletError("Please enter an Outlet / Branch Name.");
      return;
    }
    if (!cleanCity) {
      setAddOutletError("City is required.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setAddOutletError(
        "Registered owner phone missing. Please re-login from home.",
      );
      return;
    }
    if (newOutletOwnerPin.length !== 6) {
      setAddOutletError("Enter a 6-digit Branch PIN for this outlet.");
      return;
    }
    if (newOutletStaffPin && newOutletStaffPin.length !== 6) {
      setAddOutletError("Staff PIN must be 6 digits (or left blank).");
      return;
    }

    setAddingOutlet(true);

    const brandName =
      session.brandName || session.restaurantName.split(" — ")[0];
    const tablesVal = newOutletTables > 0 ? newOutletTables : 10;

    const { data, error } = await supabase
      .from("restaurants")
      .insert([
        {
          name: brandName,
          city: cleanCity,
          phone: cleanPhone,
          owner_phone: cleanPhone,
          total_tables: tablesVal,
          owner_pin: newOutletOwnerPin,
          staff_pin: newOutletStaffPin || null,
          outlet_mode: "multiple",
          outlet_label: cleanLabel,
          subscription_status: subInfo.status,
          plan_type: subInfo.planType,
          selected_plan: subInfo.selectedPlan,
        },
      ])
      .select()
      .single();

    setAddingOutlet(false);

    if (error || !data) {
      setAddOutletError(error?.message || "Failed to add linked outlet.");
      return;
    }

    setShowAddOutletModal(false);
    setUpgradeSuccessBanner(
      `New outlet "${brandName} — ${cleanLabel}" added under your owner account!`,
    );
    setTimeout(() => setUpgradeSuccessBanner(null), 6000);
    fetchDashboardData();
  };

  const handleConfirmRemoveOutlet = async () => {
    if (!session || !outletToRemove) return;
    setRemovingOutletId(outletToRemove.id);
    setRemoveOutletError("");

    const targetOutlet = outletToRemove;
    const targetId = targetOutlet.id;
    const targetTitle = formatOutletTitle(targetOutlet);
    const isCurrentOutlet = targetId === session.restaurantId;

    const { data: fullOutletOrders } = await supabase
      .from("orders")
      .select(
        "id, restaurant_id, table_number, status, total_amount, payment_method, payment_status, customer_name, customer_phone, invoice_number, razorpay_payment_id, created_at, order_items(id, item_name, quantity, price, notes)",
      )
      .eq("restaurant_id", targetId)
      .order("created_at", { ascending: false });

    const orderIds = (fullOutletOrders || []).map((o) => o.id);
    if (orderIds.length > 0) {
      await supabase.from("order_items").delete().in("order_id", orderIds);
      await supabase.from("orders").delete().eq("restaurant_id", targetId);
    }

    await supabase.from("menu_items").delete().eq("restaurant_id", targetId);
    await supabase
      .from("active_role_sessions")
      .delete()
      .eq("restaurant_id", targetId);

    const { error } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", targetId);

    setRemovingOutletId(null);

    if (error) {
      setRemoveOutletError(error.message || "Could not remove this outlet.");
      return;
    }

    if (multiCaps.canViewDeletedArchive) {
      const archiveKey = getArchivedOutletsStorageKey(
        session.ownerPhone,
        session.restaurantId,
      );
      const nextArchived: ArchivedOutletRecord[] = [
        {
          outlet: targetOutlet,
          deletedAt: new Date().toISOString(),
          orders: (fullOutletOrders || []) as OrderRecord[],
        },
        ...archivedOutlets.filter((item) => item.outlet.id !== targetId),
      ];

      setArchivedOutlets(nextArchived);
      try {
        localStorage.setItem(archiveKey, JSON.stringify(nextArchived));
      } catch {
        // Ignore storage error
      }
    }

    setOutletToRemove(null);
    if (selectedOutletDropdown === targetId) {
      setSelectedOutletDropdown("all");
    }

    if (isCurrentOutlet) {
      await releaseRoleSessionIfOwner(targetId, "owner");
      localStorage.removeItem("restro_session");
      localStorage.removeItem(MALIK_VAULT_UNLOCKED_KEY);
      router.replace("/");
      return;
    }

    setUpgradeSuccessBanner(
      multiCaps.canViewDeletedArchive
        ? `Outlet "${targetTitle}" removed. Its sales & order history is saved under "Deleted Outlets".`
        : `Outlet "${targetTitle}" removed. Upgrade to 6 Months+ plan to keep a Deleted Outlets archive.`,
    );
    setTimeout(() => setUpgradeSuccessBanner(null), 6000);
    fetchDashboardData();
  };

  const handleRestoreOutlet = async (record: ArchivedOutletRecord) => {
    if (!session) return;

    if (!multiCaps.canRestoreDeletedOutlet) {
      setShowDeletedOutletsModal(false);
      openUpgradeForMultiFeature(
        `Restoring deleted outlets is unlocked on the Yearly & Lifetime plans (current: ${multiCaps.tierName}).`,
      );
      return;
    }

    if (isAtOutletLimit) {
      setShowDeletedOutletsModal(false);
      openUpgradeForMultiFeature(
        `Cannot restore "${formatOutletTitle(record.outlet)}" because your ${multiCaps.tierName} plan limit (${maxAllowedOutlets} outlets) is full. Upgrade first.`,
      );
      return;
    }

    setRestoringOutletId(record.outlet.id);
    const cleanPhone = (session.ownerPhone || "").replace(/\D/g, "");
    const brandName =
      record.outlet.name ||
      session.brandName ||
      session.restaurantName.split(" — ")[0];

    const { data: restoredRest, error: restErr } = await supabase
      .from("restaurants")
      .insert([
        {
          name: brandName,
          city: record.outlet.city || session.city,
          phone: cleanPhone || null,
          owner_phone: cleanPhone || null,
          total_tables: record.outlet.total_tables || 10,
          owner_pin: record.outlet.owner_pin || "123456",
          staff_pin: record.outlet.staff_pin || null,
          outlet_mode: record.outlet.outlet_mode || "multiple",
          outlet_label: record.outlet.outlet_label || null,
          subscription_status: subInfo.status,
          plan_type: subInfo.planType,
          selected_plan: subInfo.selectedPlan,
        },
      ])
      .select()
      .single();

    if (restErr || !restoredRest) {
      setRestoringOutletId(null);
      setShowDeletedOutletsModal(false);
      openUpgradeForMultiFeature(
        restErr?.message || "Failed to restore outlet.",
      );
      return;
    }

    for (const ord of record.orders || []) {
      const { data: insertedOrd } = await supabase
        .from("orders")
        .insert([
          {
            restaurant_id: restoredRest.id,
            table_number: ord.table_number,
            status: ord.status || "completed",
            total_amount: Number(ord.total_amount),
            payment_method: ord.payment_method || "cash",
            payment_status: ord.payment_status || "paid",
            customer_name: ord.customer_name || null,
            customer_phone: ord.customer_phone || null,
            invoice_number: ord.invoice_number || null,
            razorpay_payment_id: ord.razorpay_payment_id || null,
            created_at: ord.created_at,
          },
        ])
        .select()
        .single();

      if (
        insertedOrd &&
        Array.isArray(ord.order_items) &&
        ord.order_items.length > 0
      ) {
        const itemsToInsert = ord.order_items.map((it) => ({
          order_id: insertedOrd.id,
          item_name: it.item_name,
          quantity: Number(it.quantity),
          price: Number(it.price),
          notes: it.notes || null,
        }));
        await supabase.from("order_items").insert(itemsToInsert);
      }
    }

    const nextArchived = archivedOutlets.filter(
      (item) => item.outlet.id !== record.outlet.id,
    );
    setArchivedOutlets(nextArchived);
    setSelectedArchivedOutletId(nextArchived[0]?.outlet.id || null);

    const archiveKey = getArchivedOutletsStorageKey(
      session.ownerPhone,
      session.restaurantId,
    );
    try {
      localStorage.setItem(archiveKey, JSON.stringify(nextArchived));
    } catch {
      // Ignore storage error
    }

    setRestoringOutletId(null);
    setShowDeletedOutletsModal(false);
    setUpgradeSuccessBanner(
      `Outlet "${formatOutletTitle(record.outlet)}" restored to active branches!`,
    );
    setTimeout(() => setUpgradeSuccessBanner(null), 6000);
    fetchDashboardData();
  };

  const handleOpenSalesModal = () => {
    setShowSalesModal(true);
    if (session?.restaurantId) {
      fetchDashboardData();
    }
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
      .from("menu_items")
      .select("id, name, category, is_veg, is_available")
      .eq("restaurant_id", session.restaurantId)
      .order("category", { ascending: true });

    if (data) {
      setStockItems(data);
    }
    setLoadingStock(false);
  };

  const handleToggleStock = async (item: MenuStockItem) => {
    const nextVal = !item.is_available;
    setStockItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, is_available: nextVal } : m)),
    );

    await supabase
      .from("menu_items")
      .update({ is_available: nextVal })
      .eq("id", item.id);
  };

  const handleLogout = async () => {
    localStorage.removeItem(MALIK_VAULT_UNLOCKED_KEY);
    if (session?.restaurantId) {
      await releaseRoleSessionIfOwner(session.restaurantId, "owner");
    }
    localStorage.removeItem("restro_session");
    router.push("/");
  };

  const printTableReceipt = (params: {
    tableNum: number;
    method: "cash" | "upi";
    totalAmount: number;
    items: MergedBillItem[];
    guestName?: string | null;
    guestPhone?: string | null;
    invoiceNumber?: string | null;
  }) => {
    if (typeof window === "undefined" || !session) return;

    const {
      tableNum,
      method,
      totalAmount,
      items,
      guestName,
      guestPhone,
      invoiceNumber,
    } = params;

    const printedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const itemRowsHtml = items
      .map(
        (it) => `
          <tr>
            <td class="item-name">${it.quantity}x ${it.item_name}</td>
            <td class="item-amt">&#8377;${(it.price * it.quantity).toLocaleString("en-IN")}</td>
          </tr>
        `,
      )
      .join("");

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bill - Table ${tableNum}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 58mm;
              max-width: 58mm;
              background: #fff;
              color: #000;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.3;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt {
              width: 48mm;
              margin: 0 auto;
              padding: 2mm 0 4mm 0;
            }
            .center { text-align: center; }
            .store-name {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              word-break: break-word;
            }
            .meta {
              font-size: 10px;
              font-weight: 700;
              margin-top: 2px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 5px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              font-size: 10px;
              font-weight: 900;
              border-bottom: 1px dashed #000;
              padding-bottom: 3px;
              text-align: left;
            }
            th.right { text-align: right; }
            td.item-name {
              padding: 3px 2px 3px 0;
              font-size: 10.5px;
              font-weight: 700;
              vertical-align: top;
              word-break: break-word;
            }
            td.item-amt {
              padding: 3px 0;
              font-size: 10.5px;
              font-weight: 900;
              text-align: right;
              vertical-align: top;
              white-space: nowrap;
            }
            .total-row td {
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 5px 0;
              font-size: 12.5px;
              font-weight: 900;
            }
            .pay-mode {
              margin-top: 5px;
              font-size: 10.5px;
              font-weight: 900;
            }
            .thanks {
              margin-top: 4px;
              font-size: 10px;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div class="store-name">${session.restaurantName}</div>
              ${session.city ? `<div class="meta">${session.city}</div>` : ""}
              <div class="meta">Table: ${tableNum} | ${printedAt}</div>
              ${invoiceNumber ? `<div class="meta">${invoiceNumber}</div>` : ""}
              ${
                guestName || guestPhone
                  ? `<div class="meta">${guestName || "Guest"}${
                      guestPhone ? ` (${guestPhone})` : ""
                    }</div>`
                  : ""
              }
            </div>

            <div class="divider"></div>

            <table>
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th class="right">AMT</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
                <tr class="total-row">
                  <td>TOTAL</td>
                  <td style="text-align:right;">&#8377;${totalAmount.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>

            <div class="center">
              <div class="pay-mode">PAID BY ${method.toUpperCase()}</div>
              <div class="thanks">Thank You! Visit Again</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWin = window.open("", "_blank", "width=260,height=520");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(receiptHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 250);
    } else {
      window.print();
    }
  };

  const handleSettleTable = async (
    tableNum: number,
    method: "cash" | "upi",
  ) => {
    if (!session?.restaurantId || session.role !== "owner") return;
    setSettling(true);

    const tableOrders = orders.filter(
      (o) => o.table_number === tableNum && o.status !== "completed",
    );
    const activeIds = tableOrders.map((o) => o.id);

    const mergedItems: MergedBillItem[] = Object.values(
      tableOrders.reduce<Record<string, MergedBillItem>>((acc, ord) => {
        (ord.order_items || []).forEach((item) => {
          const key = `${(item.item_name || "").trim().toLowerCase()}_${Number(item.price)}`;
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
      }, {}),
    );

    const settledTotal = tableOrders.reduce(
      (sum, o) => sum + Number(o.total_amount),
      0,
    );
    const firstOrder = tableOrders[0];

    if (activeIds.length > 0) {
      await supabase
        .from("orders")
        .update({
          status: "completed",
          payment_method: method,
          payment_status: "paid",
        })
        .in("id", activeIds);
    }

    printTableReceipt({
      tableNum,
      method,
      totalAmount: settledTotal,
      items: mergedItems,
      guestName: firstOrder?.customer_name,
      guestPhone: firstOrder?.customer_phone,
      invoiceNumber: firstOrder?.invoice_number,
    });

    setSettling(false);
    setSelectedTableModal(null);
    fetchDashboardData();
  };

  const handleMarkServed = async (orderId: string) => {
    await supabase
      .from("orders")
      .update({ status: "served" })
      .eq("id", orderId);
    fetchDashboardData();
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPlanUpgrade = async (
    plan: UpgradePlanOption,
    mode: "single" | "multiple",
  ) => {
    if (!session) return;
    setUpgradeErrorMsg(null);
    setUpgradingPlanId(plan.id);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setUpgradeErrorMsg(
          "Unable to load payment gateway. Please check your connection.",
        );
        setUpgradingPlanId(null);
        return;
      }

      const res = await fetch("/api/razorpay/create-subscription-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: plan.amount,
          planId: plan.id,
          planName: plan.name,
          outletMode: mode,
          restaurantId: session.restaurantId,
          restaurantName: session.restaurantName,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.orderId) {
        setUpgradeErrorMsg(orderData.error || "Unable to initiate payment.");
        setUpgradingPlanId(null);
        return;
      }

      setShowUpgradeModal(false);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "RestroSync POS",
        description: `${plan.name} (${plan.price}) • ${
          mode === "multiple" ? "Multiple Outlets" : "Single Outlet"
        }`,
        order_id: orderData.orderId,
        theme: {
          color: "#ea580c",
        },
        handler: async function () {
          const newExpiry = getCalendarExpiryDate(
            plan.id,
            plan.name,
            new Date(),
          ).toISOString();

          const subPayload = {
            subscription_status: "active",
            plan_type: plan.id,
            selected_plan: `${plan.name} (${plan.price})`,
            trial_ends_at: newExpiry,
            outlet_mode: mode,
          };

          const targetIds =
            mode === "multiple" && ownerOutlets.length > 0
              ? Array.from(
                  new Set([
                    session.restaurantId,
                    ...ownerOutlets.map((o) => o.id),
                  ]),
                )
              : [session.restaurantId];

          await supabase
            .from("restaurants")
            .update(subPayload)
            .in("id", targetIds);

          setUpgradingPlanId(null);
          setUpgradeSuccessBanner(
            `${plan.name} (${plan.price}) activated! Valid until ${new Date(
              newExpiry,
            ).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}.`,
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
        window as unknown as {
          Razorpay: new (opts: unknown) => { open: () => void };
        }
      ).Razorpay;
      const rzp = new RazorpayConstructor(options);
      rzp.open();
    } catch {
      setUpgradeErrorMsg(
        "Something went wrong during payment. Please try again.",
      );
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
      .from("restaurants")
      .update({
        upi_id: cleanUpi || null,
        bank_account_name: cleanBank || null,
        razorpay_key_id: cleanKeyId || null,
        razorpay_key_secret: cleanSecret || null,
      })
      .eq("id", session.restaurantId);

    setSavingPaymentSettings(false);

    if (error) {
      setPaymentSettingsMsg(
        "Failed to save payment details. Please try again.",
      );
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
      "Payment settings saved! Customers can now pay directly to your UPI or account.",
    );
    setTimeout(() => {
      setPaymentSettingsMsg(null);
      setShowPaymentSettingsModal(false);
    }, 1800);
  };

  const handleWhatsAppSupport = () => {
    if (!session) return;
    const msg = encodeURIComponent(
      `Hi RestroSync! I need help activating my plan:\n• Restaurant: ${session.restaurantName} (${session.city})\n• ID: ${session.restaurantId}`,
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`, "_blank");
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-semibold text-sm">
          Loading RestroSync Console...
        </p>
      </div>
    );
  }

  const activeUpgradePlans =
    upgradeModeTab === "multiple" ? MULTI_UPGRADE_PLANS : SINGLE_UPGRADE_PLANS;

  const outletsForDisplay: OutletMeta[] =
    ownerOutlets.length > 0
      ? ownerOutlets
      : [
          {
            id: session.restaurantId,
            name: session.brandName || session.restaurantName,
            city: session.city,
            total_tables: session.totalTables,
            outlet_mode: session.outletMode,
            outlet_label: session.outletLabel,
          },
        ];

  const todayStr = new Date().toDateString();

  // ==================== MALIK MULTI-OUTLET FILTERING ====================
  const filterMalikOrdersByDate = (list: OrderRecord[]) =>
    list.filter((ord) => {
      if (ord.status !== "completed") return false;
      const ordDate = new Date(ord.created_at);

      if (malikReportFilter === "today") {
        return ordDate.toDateString() === todayStr;
      }
      if (malikReportFilter === "7days") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return ordDate >= sevenDaysAgo;
      }
      if (malikReportFilter === "custom" && multiCaps.canUseCustomDateRange) {
        if (malikFromDate) {
          const start = new Date(`${malikFromDate}T00:00:00`);
          if (ordDate < start) return false;
        }
        if (malikToDate) {
          const end = new Date(`${malikToDate}T23:59:59.999`);
          if (ordDate > end) return false;
        }
        return true;
      }
      return true;
    });

  const malikDateFilteredOrders = filterMalikOrdersByDate(allOutletOrders);

  const malikOutletReportCards = outletsForDisplay
    .map((out) => {
      const outOrders = malikDateFilteredOrders.filter(
        (o) => (o.restaurant_id || session.restaurantId) === out.id,
      );
      const totalSale = outOrders.reduce(
        (sum, o) => sum + Number(o.total_amount),
        0,
      );
      const cashSale = outOrders
        .filter((o) => (o.payment_method || "").toLowerCase() === "cash")
        .reduce((sum, o) => sum + Number(o.total_amount), 0);
      const upiSale = outOrders
        .filter((o) => (o.payment_method || "").toLowerCase() === "upi")
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      return {
        ...out,
        title: formatOutletTitle(out),
        totalSale,
        cashSale,
        upiSale,
        billsCount: outOrders.length,
      };
    })
    .sort((a, b) => {
      if (multiCaps.tierRank >= 4 && b.totalSale !== a.totalSale) {
        return b.totalSale - a.totalSale;
      }
      return a.title.localeCompare(b.title);
    });

  const selectedOutletMeta =
    selectedOutletDropdown !== "all" && multiCaps.canInspectOutletCustomers
      ? malikOutletReportCards.find((o) => o.id === selectedOutletDropdown) ||
        null
      : null;

  const scopedMalikOrders = selectedOutletMeta
    ? malikDateFilteredOrders.filter(
        (o) =>
          (o.restaurant_id || session.restaurantId) === selectedOutletMeta.id,
      )
    : malikDateFilteredOrders;

  const malikCleanSearch = malikBillSearch.trim().toLowerCase();
  const visibleMalikOrders = scopedMalikOrders.filter((ord) => {
    if (!malikCleanSearch) return true;
    const custName = (ord.customer_name || "").toLowerCase();
    const custPhone = (ord.customer_phone || "").toLowerCase();
    const inv = (ord.invoice_number || "").toLowerCase();
    const billId = `bill-${ord.id.slice(0, 6).toLowerCase()}`;
    const utr = (ord.razorpay_payment_id || "").toLowerCase();
    const itemsText = (ord.order_items || [])
      .map((i) => i.item_name.toLowerCase())
      .join(" ");

    return (
      custName.includes(malikCleanSearch) ||
      custPhone.includes(malikCleanSearch) ||
      inv.includes(malikCleanSearch) ||
      billId.includes(malikCleanSearch) ||
      utr.includes(malikCleanSearch) ||
      itemsText.includes(malikCleanSearch)
    );
  });

  const malikDisplayTotal = scopedMalikOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0,
  );
  const malikDisplayCash = scopedMalikOrders
    .filter((o) => (o.payment_method || "").toLowerCase() === "cash")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const malikDisplayUpi = scopedMalikOrders
    .filter((o) => (o.payment_method || "").toLowerCase() === "upi")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  // ==================== BRANCH MANAGER / SINGLE OUTLET METRICS ====================
  const activeOrders = orders.filter((o) => o.status !== "completed");
  const completedOrders = orders.filter((o) => o.status === "completed");

  const todayCompleted = completedOrders.filter(
    (o) => new Date(o.created_at).toDateString() === todayStr,
  );
  const todayRevenue = todayCompleted.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0,
  );

  const cleanSearch = billSearchQuery.trim().toLowerCase();

  const applyDateAndSearchFilter = (list: OrderRecord[]) =>
    list.filter((ord) => {
      if (cleanSearch) {
        const inv = (ord.invoice_number || "").toLowerCase();
        const billNo = `bill-${ord.id.slice(0, 6).toLowerCase()}`;
        const payId = (ord.razorpay_payment_id || "").toLowerCase();
        const custName = (ord.customer_name || "").toLowerCase();
        const custPhone = (ord.customer_phone || "").toLowerCase();

        return (
          inv.includes(cleanSearch) ||
          billNo.includes(cleanSearch) ||
          payId.includes(cleanSearch) ||
          custName.includes(cleanSearch) ||
          custPhone.includes(cleanSearch)
        );
      }

      const ordDate = new Date(ord.created_at);

      if (salesFilter === "today") {
        return ordDate.toDateString() === todayStr;
      }

      if (salesFilter === "7days") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return ordDate >= sevenDaysAgo;
      }

      if (salesFilter === "custom") {
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
    cleanSearch ? orders : completedOrders,
  );

  const filteredTotalSales = filteredSalesOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0,
  );
  const filteredCashSales = filteredSalesOrders
    .filter((o) => (o.payment_method || "").toLowerCase() === "cash")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const filteredUpiSales = filteredSalesOrders
    .filter((o) => (o.payment_method || "").toLowerCase() === "upi")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const occupiedTablesCount = new Set(activeOrders.map((o) => o.table_number))
    .size;
  const cookingOrdersCount = activeOrders.filter(
    (o) => o.status === "pending" || o.status === "preparing",
  ).length;
  const readyToServeCount = activeOrders.filter(
    (o) => o.status === "ready",
  ).length;

  const tablesArray = Array.from(
    { length: actualTablesCount },
    (_, i) => i + 1,
  );

  const modalTableOrders = selectedTableModal
    ? activeOrders.filter((o) => o.table_number === selectedTableModal)
    : [];
  const modalTableTotal = modalTableOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0,
  );
  const isModalTableFullyPaid =
    modalTableOrders.length > 0 &&
    modalTableOrders.every((o) => o.payment_status === "paid");

  const consolidatedTableItems: MergedBillItem[] = Object.values(
    modalTableOrders.reduce<Record<string, MergedBillItem>>((acc, ord) => {
      (ord.order_items || []).forEach((item) => {
        const key = `${(item.item_name || "").trim().toLowerCase()}_${Number(item.price)}`;
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
    }, {}),
  );

  const primaryTableGuest =
    modalTableOrders.find(
      (o) => o.customer_name && o.customer_name !== "Walk-in Guest",
    )?.customer_name || modalTableOrders[0]?.customer_name;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-orange-600 text-white p-2 rounded-xl shadow-sm shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  {isMalikMode
                    ? session.brandName ||
                      session.restaurantName.split(" — ")[0]
                    : session.restaurantName}
                </h1>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 border shrink-0 ${
                    isMalikMode
                      ? "bg-slate-900 text-amber-300 border-slate-800"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />{" "}
                  {isMalikMode
                    ? `Super • ${multiCaps.tierName}`
                    : isMultiOutletMode
                      ? "Branch Manager"
                      : "Admin"}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {isMalikMode
                  ? `${outletsForDisplay.length} Linked Outlet(s)${
                      canShowPlanDetails && subInfo.selectedPlan
                        ? ` • ${subInfo.selectedPlan}`
                        : ""
                    }`
                  : `${session.city} • ${actualTablesCount} Tables${
                      canShowPlanDetails && subInfo.selectedPlan
                        ? ` • ${subInfo.selectedPlan}`
                        : ""
                    }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isMalikMode ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!multiCaps.canViewDeletedArchive) {
                      openUpgradeForMultiFeature(
                        `Deleted Outlets Archive is available from the 6 Months plan onwards (current: ${multiCaps.tierName}).`,
                      );
                      return;
                    }
                    setSelectedArchivedOutletId(
                      archivedOutlets[0]?.outlet.id || null,
                    );
                    setShowDeletedOutletsModal(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition ${
                    multiCaps.canViewDeletedArchive
                      ? "bg-white hover:bg-slate-100 text-slate-800 border-slate-300"
                      : "bg-slate-100 text-slate-400 border-dashed border-slate-300"
                  }`}
                >
                  <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Deleted Outlets ({archivedOutlets.length})</span>
                  {!multiCaps.canViewDeletedArchive && (
                    <Lock className="w-3 h-3 shrink-0" />
                  )}
                </button>

                {!isLifetimePlanActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeErrorMsg(null);
                      setUpgradeModeTab("multiple");
                      setShowUpgradeModal(true);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition"
                  >
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Upgrade Plan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenAddOutletModal}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Add Outlet</span>
                </button>
              </>
            ) : (
              <>
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
                      <span>Bills &amp; Sales</span>
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
                          ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                          : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      <KeyRound className="w-4 h-4 text-purple-600" />
                      <span>Payment Setup</span>
                    </button>
                  </>
                )}
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

        {isOwner &&
          !isLifetimePlanActive &&
          subInfo.status !== "active" &&
          canShowPlanDetails && (
            <section
              className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 shadow-sm ${
                subInfo.isExpired
                  ? "bg-red-50 border-red-300 text-red-900"
                  : "bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700 text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    subInfo.isExpired
                      ? "bg-red-100 text-red-600"
                      : "bg-amber-400/20 text-amber-300"
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
                      ? "Your 7-Day Free Trial Has Ended!"
                      : `7-Day Free Trial Active • ${subInfo.daysLeft} Day${
                          subInfo.daysLeft === 1 ? "" : "s"
                        } Left`}
                  </p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      subInfo.isExpired ? "text-red-700" : "text-slate-300"
                    }`}
                  >
                    {subInfo.isExpired
                      ? "8th day reached — complete payment to unlock your account."
                      : `Plan: ${subInfo.selectedPlan} • Pay anytime for full calendar duration.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUpgradeErrorMsg(null);
                  setUpgradeModeTab(isMalikMode ? "multiple" : "single");
                  setShowUpgradeModal(true);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Upgrade / Activate Plan</span>
              </button>
            </section>
          )}

        {/* ==================== MALIK COMMAND VIEW ==================== */}
        {isMalikMode ? (
          <>
            <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {(
                    [
                      { id: "today", label: "Today" },
                      { id: "7days", label: "Last 7 Days" },
                      { id: "all", label: "All Time" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMalikReportFilter(tab.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                        malikReportFilter === tab.id
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      if (!multiCaps.canUseCustomDateRange) {
                        openUpgradeForMultiFeature(
                          `Custom Date Range is unlocked on 6 Months, Yearly & Lifetime plans (current: ${multiCaps.tierName}).`,
                        );
                        return;
                      }
                      setMalikReportFilter("custom");
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                      malikReportFilter === "custom"
                        ? "bg-slate-900 text-white shadow-xs"
                        : multiCaps.canUseCustomDateRange
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-slate-100/80 text-slate-400 border border-dashed border-slate-300"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Custom Date</span>
                    {!multiCaps.canUseCustomDateRange && (
                      <Lock className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-80">
                    <Filter className="w-4 h-4 text-orange-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedOutletDropdown}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        if (
                          nextVal !== "all" &&
                          !multiCaps.canInspectOutletCustomers
                        ) {
                          openUpgradeForMultiFeature(
                            `Per-outlet customer & order drilldown is unlocked from the 3 Months plan onwards (current: ${multiCaps.tierName}).`,
                          );
                          return;
                        }
                        setSelectedOutletDropdown(nextVal);
                        setMalikBillSearch("");
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-orange-50/60 hover:bg-orange-50 border-2 border-orange-300 focus:border-orange-500 rounded-xl text-xs font-extrabold text-slate-900 outline-none cursor-pointer transition truncate"
                    >
                      <option value="all">
                        All Outlets Combined ({outletsForDisplay.length}{" "}
                        Branches)
                      </option>
                      {malikOutletReportCards.map((out) => (
                        <option key={out.id} value={out.id}>
                          {out.title} — ₹{out.totalSale.toLocaleString("en-IN")}{" "}
                          ({out.billsCount} bills)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedOutletDropdown !== "all" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutletDropdown("all");
                        setMalikBillSearch("");
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold shrink-0 transition"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {malikReportFilter === "custom" &&
                multiCaps.canUseCustomDateRange && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500">
                      Date Range:
                    </span>
                    <input
                      type="date"
                      max={malikToDate || todayIso}
                      value={malikFromDate}
                      onChange={(e) => setMalikFromDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400">to</span>
                    <input
                      type="date"
                      min={malikFromDate}
                      max={todayIso}
                      value={malikToDate}
                      onChange={(e) => setMalikToDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                )}
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>
                    {selectedOutletMeta ? "Selected Branch" : "Total Outlets"}
                  </span>
                  <Store className="w-4 h-4 text-orange-600" />
                </div>
                {selectedOutletMeta ? (
                  <>
                    <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
                      {selectedOutletMeta.outlet_label ||
                        selectedOutletMeta.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {selectedOutletMeta.city} •{" "}
                      {selectedOutletMeta.total_tables || 10} Tables
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-extrabold text-slate-900 mt-2">
                      {currentOutletCount} /{" "}
                      {maxAllowedOutlets === null ? "∞" : maxAllowedOutlets}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Active Branches Linked
                    </p>
                  </>
                )}
              </div>

              <div className="bg-emerald-50/70 p-5 rounded-2xl border-2 border-emerald-200 shadow-xs">
                <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                  <span>
                    {selectedOutletMeta
                      ? "Outlet Total Sales"
                      : "Combined Total Sales"}
                  </span>
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-950 mt-2">
                  ₹{malikDisplayTotal.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  {scopedMalikOrders.length} Settled Bill(s)
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>
                    {selectedOutletMeta ? "Outlet Cash" : "Combined Cash"}
                  </span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  ₹{malikDisplayCash.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cash Payments Collected
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>
                    {selectedOutletMeta
                      ? "Outlet UPI / Online"
                      : "Combined UPI / Online"}
                  </span>
                  <Smartphone className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  ₹{malikDisplayUpi.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-blue-600 font-semibold mt-1">
                  Direct UPI &amp; Online Payments
                </p>
              </div>
            </section>

            {selectedOutletMeta && multiCaps.canInspectOutletCustomers ? (
              <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 break-words">
                        {selectedOutletMeta.title} — Detailed Sales &amp;
                        Customer Orders
                      </h2>
                      <span className="text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-0.5 rounded-full shrink-0">
                        {selectedOutletMeta.city}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customer Name, Mobile Number, Ordered Items, Table No., and
                      Cash/UPI Payment Details
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowOutletPins((prev) => !prev)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition"
                    >
                      {showOutletPins ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide PINs</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Show PINs</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const target =
                          outletsForDisplay.find(
                            (o) => o.id === selectedOutletMeta.id,
                          ) || null;
                        setRemoveOutletError("");
                        setOutletToRemove(target);
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Outlet</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <span className="bg-white border border-slate-200 text-slate-800 px-3 py-1 rounded-lg font-bold">
                    Branch PIN:{" "}
                    {showOutletPins
                      ? selectedOutletMeta.owner_pin || "—"
                      : "••••••"}
                  </span>
                  <span className="bg-white border border-slate-200 text-slate-800 px-3 py-1 rounded-lg font-bold">
                    Staff PIN:{" "}
                    {showOutletPins
                      ? selectedOutletMeta.staff_pin || "None"
                      : "••••••"}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={malikBillSearch}
                    onChange={(e) => setMalikBillSearch(e.target.value)}
                    placeholder="Search customer name, mobile number, ordered dish, invoice or UTR..."
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-semibold outline-none transition"
                  />
                  {malikBillSearch && (
                    <button
                      type="button"
                      onClick={() => setMalikBillSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {visibleMalikOrders.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-500">
                      No orders found for {selectedOutletMeta.title} in this
                      filter.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {visibleMalikOrders.map((ord) => {
                      const isUpi =
                        (ord.payment_method || "").toLowerCase() === "upi";
                      return (
                        <div
                          key={ord.id}
                          className="p-4 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs transition"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                                Table {ord.table_number}
                              </span>

                              <span className="font-extrabold text-slate-900 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                {ord.customer_name || "Walk-in Guest"}
                              </span>

                              {ord.customer_phone && (
                                <span className="font-bold text-slate-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-amber-700 shrink-0" />
                                  {ord.customer_phone}
                                </span>
                              )}

                              <span className="text-[10px] font-mono font-bold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">
                                {ord.invoice_number ||
                                  `INV-${ord.id.slice(0, 6).toUpperCase()}`}
                              </span>

                              <span className="text-[11px] text-slate-400">
                                {new Date(ord.created_at).toLocaleString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 space-y-1">
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Ordered Items
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {ord.order_items?.map((item) => (
                                  <span
                                    key={item.id}
                                    className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800"
                                  >
                                    {item.quantity}× {item.item_name} (₹
                                    {item.price * item.quantity})
                                  </span>
                                ))}
                              </div>
                            </div>

                            {ord.razorpay_payment_id && (
                              <p className="text-[11px] font-mono text-emerald-700 font-bold break-all">
                                Payment / UTR Ref: {ord.razorpay_payment_id}
                              </p>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 pt-1 sm:pt-0">
                            <span className="text-base font-extrabold text-slate-900">
                              ₹{Number(ord.total_amount).toLocaleString("en-IN")}
                            </span>
                            <span
                              className={`uppercase text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                                isUpi
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {isUpi ? "UPI / Online" : "Cash"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Outlet-Wise Sales Report &amp; Branches
                    </h2>
                    <p className="text-xs text-slate-500">
                      {multiCaps.canInspectOutletCustomers
                        ? "Select any outlet from the dropdown or click a card for customer & order details"
                        : `Current Tier: ${multiCaps.tierName} • Upgrade to 3 Months+ for per-outlet customer & order drilldown`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowOutletPins((prev) => !prev)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition"
                    >
                      {showOutletPins ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide PINs</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Show PINs</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddOutletModal}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Outlet</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {malikOutletReportCards.map((out) => {
                    const hasSale = out.totalSale > 0;
                    return (
                      <div
                        key={out.id}
                        onClick={() => {
                          if (!multiCaps.canInspectOutletCustomers) {
                            openUpgradeForMultiFeature(
                              `Per-outlet customer & order drilldown is available from the 3 Months plan onwards (current: ${multiCaps.tierName}).`,
                            );
                            return;
                          }
                          setSelectedOutletDropdown(out.id);
                        }}
                        className={`border-2 rounded-2xl p-4 flex flex-col justify-between gap-3 transition cursor-pointer ${
                          hasSale && multiCaps.tierRank >= 4
                            ? "border-emerald-400 bg-emerald-50/40 hover:border-emerald-500 shadow-xs"
                            : "border-slate-200 hover:border-orange-300 bg-slate-50/60"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-extrabold text-sm text-slate-900 break-words">
                                  {out.title}
                                </h3>
                                {hasSale && multiCaps.tierRank >= 4 && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white shrink-0">
                                    Sale Active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                <span>
                                  {out.city} • {out.total_tables || 10} Tables
                                </span>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const target =
                                  outletsForDisplay.find(
                                    (o) => o.id === out.id,
                                  ) || null;
                                setRemoveOutletError("");
                                setOutletToRemove(target);
                              }}
                              title="Remove Outlet"
                              className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 bg-white shrink-0 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-500">
                                Total Sales ({out.billsCount} bills)
                              </span>
                              <span
                                className={`text-base font-extrabold ${
                                  hasSale
                                    ? "text-emerald-700"
                                    : "text-slate-700"
                                }`}
                              >
                                ₹{out.totalSale.toLocaleString("en-IN")}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                              <div className="bg-emerald-50/70 rounded-lg px-2.5 py-1.5">
                                <span className="text-[10px] font-bold text-emerald-700 block">
                                  Cash
                                </span>
                                <span className="font-extrabold text-slate-900">
                                  ₹{out.cashSale.toLocaleString("en-IN")}
                                </span>
                              </div>

                              <div className="bg-blue-50/70 rounded-lg px-2.5 py-1.5">
                                <span className="text-[10px] font-bold text-blue-700 block">
                                  UPI / Online
                                </span>
                                <span className="font-extrabold text-slate-900">
                                  ₹{out.upiSale.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono pt-1 flex-wrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold">
                              Branch PIN:{" "}
                              {showOutletPins ? out.owner_pin || "—" : "••••••"}
                            </span>
                            <span className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold">
                              Staff PIN:{" "}
                              {showOutletPins
                                ? out.staff_pin || "None"
                                : "••••••"}
                            </span>
                          </div>
                          <span className="font-sans text-[11px] font-extrabold text-orange-600 shrink-0">
                            {multiCaps.canInspectOutletCustomers
                              ? "Details →"
                              : "3M+ Lock"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : (
          /* ==================== BRANCH MANAGER / SINGLE OUTLET VIEW ==================== */
          <>
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
                      Save your UPI ID so customer payments go straight to your
                      GPay, PhonePe, or Paytm merchant account.
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
                    Track Bills{" "}
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  ₹{todayRevenue.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  {todayCompleted.length} Bills Settled Today • Search Invoice /
                  ID
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
                <p className="text-[11px] text-slate-500 mt-1">
                  Currently Occupied
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>In Kitchen (Cooking)</span>
                  <ChefHat className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  {cookingOrdersCount}
                </p>
                <p className="text-[11px] text-blue-600 font-semibold mt-1">
                  Live KOTs Active
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>Ready to Serve</span>
                  <BellRing className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  {readyToServeCount}
                </p>
                <p className="text-[11px] text-amber-600 font-semibold mt-1">
                  Pickup from Kitchen
                </p>
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
                      {readyToServeCount} Order{readyToServeCount > 1 ? "s" : ""}{" "}
                      Ready in Kitchen!
                    </p>
                    <p className="text-xs text-emerald-100">
                      Tables:{" "}
                      {Array.from(
                        new Set(
                          activeOrders
                            .filter((o) => o.status === "ready")
                            .map((o) => `Table ${o.table_number}`),
                        ),
                      ).join(", ")}
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
                    Live Floor &amp; Table Status
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click a Free table to take an order; once guests leave, click
                    an Occupied table to mark it Free.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>{" "}
                    Free
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>{" "}
                    Cooking
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{" "}
                    Ready
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>{" "}
                    Dining
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                {tablesArray.map((tableNum) => {
                  const tOrders = activeOrders.filter(
                    (o) => o.table_number === tableNum,
                  );
                  const isOccupied = tOrders.length > 0;
                  const hasReady = tOrders.some((o) => o.status === "ready");
                  const isAllServed =
                    isOccupied && tOrders.every((o) => o.status === "served");
                  const tableTotal = tOrders.reduce(
                    (s, o) => s + Number(o.total_amount),
                    0,
                  );
                  const totalDishes = tOrders.reduce(
                    (s, o) =>
                      s +
                      (o.order_items?.reduce(
                        (sum, i) => sum + i.quantity,
                        0,
                      ) || 0),
                    0,
                  );
                  const isTableFullyPaid =
                    isOccupied &&
                    tOrders.every((o) => o.payment_status === "paid");
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
                          <span className="text-[11px] font-bold text-orange-600">
                            + Order
                          </span>
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
                          ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
                          : isAllServed
                            ? "bg-blue-50/70 border-blue-400 shadow-sm"
                            : "bg-amber-50/70 border-amber-400 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-extrabold text-sm text-slate-900">
                          Table {tableNum}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            hasReady
                              ? "bg-emerald-600 text-white"
                              : isAllServed
                                ? "bg-blue-600 text-white"
                                : "bg-amber-500 text-white"
                          }`}
                        >
                          {hasReady
                            ? "Ready"
                            : isAllServed
                              ? "Dining"
                              : "Cooking"}
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
                            ? "Dining • Clear on Exit"
                            : `${totalDishes} Dish${totalDishes > 1 ? "es" : ""} Running`}
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
                  <span>Live Kitchen &amp; Service Queue</span>
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
                    const isPaid = ord.payment_status === "paid";

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
                                {ord.customer_phone
                                  ? ` (${ord.customer_phone})`
                                  : ""}
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
                              .join(", ")}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${
                              ord.status === "ready"
                                ? "bg-emerald-100 text-emerald-700"
                                : ord.status === "served"
                                  ? "bg-blue-100 text-blue-700"
                                  : ord.status === "preparing"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ord.status}
                          </span>

                          {ord.status === "ready" && (
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
                    <span>
                      Track by Invoice / UTR ID ({completedOrders.length})
                      &rarr;
                    </span>
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
                              .join(", ")}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2.5 shrink-0">
                          <span className="font-extrabold text-slate-900 text-sm">
                            ₹{ord.total_amount}
                          </span>
                          <span
                            className={`uppercase text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded ${
                              (ord.payment_method || "").toLowerCase() === "upi"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {ord.payment_method || "PAID"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Malik-Only Deleted Outlets Archive Modal (6 Months+ Archive, Yearly+ Restore) */}
      {isMalikMode &&
        showDeletedOutletsModal &&
        multiCaps.canViewDeletedArchive &&
        (() => {
          const activeArchived =
            archivedOutlets.find(
              (a) => a.outlet.id === selectedArchivedOutletId,
            ) ||
            archivedOutlets[0] ||
            null;

          const archivedCompletedOrders = (activeArchived?.orders || []).filter(
            (o) => o.status === "completed",
          );
          const archivedSourceOrders =
            archivedCompletedOrders.length > 0
              ? archivedCompletedOrders
              : activeArchived?.orders || [];

          const archivedTotalSale = archivedSourceOrders.reduce(
            (sum, o) => sum + Number(o.total_amount),
            0,
          );
          const archivedCashSale = archivedSourceOrders
            .filter((o) => (o.payment_method || "").toLowerCase() === "cash")
            .reduce((sum, o) => sum + Number(o.total_amount), 0);
          const archivedUpiSale = archivedSourceOrders
            .filter((o) => (o.payment_method || "").toLowerCase() === "upi")
            .reduce((sum, o) => sum + Number(o.total_amount), 0);

          return (
            <div
              onClick={() => setShowDeletedOutletsModal(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[1035] overscroll-none touch-none"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              >
                <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-slate-200">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Deleted Outlets Archive ({archivedOutlets.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select a deleted outlet to inspect its sales report,
                      customer details, and orders
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeletedOutletsModal(false)}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {archivedOutlets.length === 0 ? (
                  <div className="py-14 text-center text-xs font-semibold text-slate-400">
                    No deleted outlets recorded yet.
                  </div>
                ) : (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-4 space-y-2 max-h-56 md:max-h-[62vh] overflow-y-auto pr-1">
                      {archivedOutlets.map((rec) => {
                        const isSelected =
                          activeArchived?.outlet.id === rec.outlet.id;
                        const recCompleted = rec.orders.filter(
                          (o) => o.status === "completed",
                        );
                        const listOrders =
                          recCompleted.length > 0 ? recCompleted : rec.orders;
                        const recTotal = listOrders.reduce(
                          (s, o) => s + Number(o.total_amount),
                          0,
                        );

                        return (
                          <button
                            key={rec.outlet.id}
                            type="button"
                            onClick={() =>
                              setSelectedArchivedOutletId(rec.outlet.id)
                            }
                            className={`w-full text-left p-3.5 rounded-2xl border-2 transition ${
                              isSelected
                                ? "border-orange-500 bg-orange-50/60"
                                : "border-slate-200 bg-slate-50/70 hover:bg-slate-100"
                            }`}
                          >
                            <p className="text-xs font-extrabold text-slate-900 break-words">
                              {formatOutletTitle(rec.outlet)}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {rec.outlet.city} • Deleted{" "}
                              {new Date(rec.deletedAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                },
                              )}
                            </p>
                            <p className="text-xs font-extrabold text-emerald-700 mt-1.5">
                              Sales: ₹{recTotal.toLocaleString("en-IN")} (
                              {listOrders.length} orders)
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {activeArchived && (
                      <div className="md:col-span-8 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-4 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200">
                          <div className="min-w-0">
                            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 break-words">
                              {formatOutletTitle(activeArchived.outlet)}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {activeArchived.outlet.city} • Deleted on{" "}
                              {new Date(
                                activeArchived.deletedAt,
                              ).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                              Deleted Outlet
                            </span>
                            <button
                              type="button"
                              disabled={
                                restoringOutletId === activeArchived.outlet.id
                              }
                              onClick={() => handleRestoreOutlet(activeArchived)}
                              className={`text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
                                multiCaps.canRestoreDeletedOutlet
                                  ? "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
                                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              }`}
                            >
                              {multiCaps.canRestoreDeletedOutlet ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {restoringOutletId === activeArchived.outlet.id
                                  ? "Restoring..."
                                  : multiCaps.canRestoreDeletedOutlet
                                    ? "Restore Outlet"
                                    : "Restore (Yearly+)"}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-500">
                              Total Sales
                            </p>
                            <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                              ₹{archivedTotalSale.toLocaleString("en-IN")}
                            </p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-500">
                              Cash
                            </p>
                            <p className="text-base font-extrabold text-slate-900 mt-0.5">
                              ₹{archivedCashSale.toLocaleString("en-IN")}
                            </p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-500">
                              UPI / Online
                            </p>
                            <p className="text-base font-extrabold text-blue-700 mt-0.5">
                              ₹{archivedUpiSale.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {archivedSourceOrders.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
                              No order records found for this deleted outlet.
                            </p>
                          ) : (
                            archivedSourceOrders.map((ord) => (
                              <div
                                key={ord.id}
                                className="bg-white border border-slate-200 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-2.5"
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-extrabold text-slate-900">
                                      Table {ord.table_number}
                                    </span>
                                    <span className="font-bold text-slate-800">
                                      • {ord.customer_name || "Walk-in Guest"}
                                    </span>
                                    {ord.customer_phone && (
                                      <span className="text-slate-600 font-semibold">
                                        ({ord.customer_phone})
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">
                                      {ord.invoice_number ||
                                        `INV-${ord.id.slice(0, 6).toUpperCase()}`}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 break-words">
                                    {ord.order_items
                                      ?.map(
                                        (i) => `${i.quantity}× ${i.item_name}`,
                                      )
                                      .join(", ")}
                                  </p>
                                  {ord.razorpay_payment_id && (
                                    <p className="text-[10px] font-mono text-emerald-700 font-bold break-all">
                                      Ref: {ord.razorpay_payment_id}
                                    </p>
                                  )}
                                </div>

                                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                                  <p className="font-extrabold text-slate-900">
                                    ₹
                                    {Number(ord.total_amount).toLocaleString(
                                      "en-IN",
                                    )}
                                  </p>
                                  <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {ord.payment_method || "CASH"}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Malik-Only Add Outlet Modal */}
      {isMalikMode && showAddOutletModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[1020] overscroll-none touch-none">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-orange-600" /> Add Linked
                  Outlet
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plan Limit: {currentOutletCount}/
                  {maxAllowedOutlets === null ? "Unlimited" : maxAllowedOutlets}{" "}
                  outlets used
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddOutletModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateLinkedOutlet}
              className="pt-4 space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Outlet / Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={newOutletLabel}
                  onChange={(e) => setNewOutletLabel(e.target.value)}
                  placeholder="e.g. Branch 2 (Malviya Nagar)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={newOutletCity}
                  onChange={(e) => setNewOutletCity(e.target.value)}
                  placeholder="e.g. Jaipur"
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Number of Tables *
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={newOutletTables || ""}
                  onChange={(e) =>
                    setNewOutletTables(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch PIN (6-Digit) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={newOutletOwnerPin}
                      onChange={(e) =>
                        setNewOutletOwnerPin(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder="••••••"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm font-bold tracking-widest outline-none"
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
                      value={newOutletStaffPin}
                      onChange={(e) =>
                        setNewOutletStaffPin(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder="••••••"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 focus:border-orange-500 rounded-xl text-sm font-bold tracking-widest outline-none"
                    />
                  </div>
                </div>
              </div>

              {addOutletError && (
                <p className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl text-center">
                  {addOutletError}
                </p>
              )}

              <button
                type="submit"
                disabled={addingOutlet}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition"
              >
                {addingOutlet ? "Adding Outlet..." : "Create Linked Outlet ✓"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Malik-Only Remove Outlet Confirmation Modal */}
      {isMalikMode && outletToRemove && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[1025] overscroll-none touch-none">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-red-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Remove Outlet?
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Are you sure you want to remove{" "}
                <strong>{formatOutletTitle(outletToRemove)}</strong>?
                {multiCaps.canViewDeletedArchive
                  ? " Its sales and order history will be saved under Deleted Outlets."
                  : " Upgrade to 6 Months+ to archive deleted outlet sales."}
              </p>
            </div>

            {removeOutletError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl">
                {removeOutletError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={removingOutletId === outletToRemove.id}
                onClick={() => {
                  setOutletToRemove(null);
                  setRemoveOutletError("");
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingOutletId === outletToRemove.id}
                onClick={handleConfirmRemoveOutlet}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-extrabold transition"
              >
                {removingOutletId === outletToRemove.id
                  ? "Removing..."
                  : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && !isLifetimePlanActive && showUpgradeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[1030] overscroll-none touch-none">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-orange-600" /> Activate
                  RestroSync Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Starts today for its full calendar duration upon payment
                </p>
              </div>
              {!subInfo.isExpired && (
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {upgradeErrorMsg && (
              <div className="mt-3 bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs font-bold">
                {upgradeErrorMsg}
              </div>
            )}

            <div className="py-4 space-y-2.5">
              {activeUpgradePlans.map((plan) => {
                const isSelected = subInfo.selectedPlan.includes(plan.price);
                const isBelowCurrentOutlets =
                  upgradeModeTab === "multiple" &&
                  plan.maxOutlets !== null &&
                  currentOutletCount > plan.maxOutlets;

                return (
                  <div
                    key={plan.id}
                    className={`p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                      isSelected
                        ? "border-orange-500 bg-orange-50/50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-extrabold text-sm text-slate-900">
                          {plan.name}
                        </p>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {plan.tag}
                        </span>
                      </div>
                      <p className="text-base font-extrabold text-orange-600 mt-0.5">
                        {plan.price}
                      </p>
                      {isBelowCurrentOutlets && (
                        <p className="text-[10px] font-bold text-red-600 mt-0.5">
                          {currentOutletCount} outlets active (needs ≥{" "}
                          {currentOutletCount} limit)
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        upgradingPlanId === plan.id || isBelowCurrentOutlets
                      }
                      onClick={() =>
                        handleRazorpayPlanUpgrade(plan, upgradeModeTab)
                      }
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition shrink-0"
                    >
                      <Crown className="w-4 h-4" />
                      <span>
                        {upgradingPlanId === plan.id
                          ? "Opening..."
                          : "Pay & Activate"}
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

      {isOwner && !isMalikMode && showPaymentSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-purple-600" /> Restaurant
                  Payment Setup
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  0% Fee • Customer payments go straight to your UPI or bank
                  account
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

            <form
              onSubmit={handleSavePaymentSettings}
              className="pt-4 space-y-3.5"
            >
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
                  Enter the UPI ID from your Google Pay Business, PhonePe
                  Business, or Paytm QR stand.
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
                {savingPaymentSettings
                  ? "Saving Details..."
                  : "Save Payment Setup ✓"}
              </button>
            </form>
          </div>
        </div>
      )}

      {isOwner && !isMalikMode && showSalesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-[999]">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Bills, Invoice Tracker &amp; Sales History
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  {session.restaurantName} • Track by Invoice No., Bill No.,
                  UTR / Payment ID, Name, or Phone
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSalesModal(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

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
                    onClick={() => setBillSearchQuery("")}
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
                    { id: "today", label: "Today" },
                    { id: "7days", label: "Last 7 Days" },
                    { id: "all", label: "All Time" },
                    { id: "custom", label: "Custom Date" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSalesFilter(tab.id)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      salesFilter === tab.id
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.id === "custom" && (
                      <Calendar className="w-3.5 h-3.5" />
                    )}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}

            {!cleanSearch && salesFilter === "custom" && (
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
                    {cleanSearch ? "Matched Amount" : "Total Revenue"}
                  </p>
                  <p className="text-xl font-extrabold text-emerald-900 mt-0.5">
                    ₹{filteredTotalSales.toLocaleString("en-IN")}
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
                  ₹{filteredCashSales.toLocaleString("en-IN")}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" /> UPI /
                  Online
                </p>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 mt-0.5">
                  ₹{filteredUpiSales.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 border-t border-slate-100 pr-1 pb-2">
              {filteredSalesOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  No matching bills or invoices found.
                </p>
              ) : (
                filteredSalesOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">
                          Table {ord.table_number}
                        </span>
                        <span className="text-[10px] font-mono font-extrabold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">
                          {ord.invoice_number ||
                            `INV-${ord.id.slice(0, 6).toUpperCase()}`}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          BILL-{ord.id.slice(0, 6).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ord.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {(ord.customer_name || ord.customer_phone) && (
                        <p className="text-[11px] font-bold text-slate-700 flex flex-wrap items-center gap-2">
                          {ord.customer_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />{" "}
                              {ord.customer_name}
                            </span>
                          )}
                          {ord.customer_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />{" "}
                              {ord.customer_phone}
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
                          .join(", ")}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₹{ord.total_amount}
                      </span>
                      <span
                        className={`uppercase text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                          (ord.payment_method || "").toLowerCase() === "upi"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {ord.payment_method || "CASH"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
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
                  {primaryTableGuest ? `${primaryTableGuest} • ` : ""}
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
                      {consolidatedTableItems.reduce(
                        (s, i) => s + i.quantity,
                        0,
                      )}{" "}
                      Items
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {consolidatedTableItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-slate-800"
                      >
                        <span>
                          <strong className="text-slate-900">
                            {item.quantity}×
                          </strong>{" "}
                          {item.item_name}
                          {item.notes.length > 0 && (
                            <span className="text-[11px] text-orange-600 ml-1">
                              ({item.notes.join(", ")})
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
                    const isPaid = ord.payment_status === "paid";

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
                              .join(", ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              ord.status === "ready"
                                ? "bg-emerald-100 text-emerald-700"
                                : ord.status === "served"
                                  ? "bg-blue-100 text-blue-700"
                                  : ord.status === "preparing"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ord.status === "ready" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </>
                            ) : ord.status === "served" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Served
                              </>
                            ) : ord.status === "preparing" ? (
                              <>
                                <ChefHat className="w-3 h-3" /> Cooking
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" /> Pending
                              </>
                            )}
                          </span>

                          {ord.status === "ready" && (
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
                      ✓ UPI Payment Marked Paid • Clear table only after guest
                      leaves
                    </div>
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() =>
                        handleSettleTable(selectedTableModal, "upi")
                      }
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      {settling
                        ? "Clearing Table..."
                        : "Guest Left • Free Table ✓"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() =>
                        handleSettleTable(selectedTableModal, "cash")
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      Settle Cash ₹{modalTableTotal}
                    </button>
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() =>
                        handleSettleTable(selectedTableModal, "upi")
                      }
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
                <p className="text-xs text-slate-500 text-center py-8">
                  Loading menu items...
                </p>
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
                      <p className="text-sm font-bold text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.category}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStock(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                        item.is_available
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      }`}
                    >
                      {item.is_available ? "In Stock ✓" : "Sold Out ✕"}
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
                For your security, you were automatically logged out from the
                Owner Dashboard after 1 hour of inactivity.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/")}
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
          window.location.replace("/");
        }}
      />
    </div>
  );
}