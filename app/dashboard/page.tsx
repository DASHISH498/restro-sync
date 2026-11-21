"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
  UserCheck,
  PlusCircle,
  PackageCheck,
  X,
  Utensils,
  ArrowUpRight,
  Banknote,
  Smartphone,
  Calendar,
} from "lucide-react";

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  city: string;
  totalTables: number;
  role: "owner" | "staff";
}

interface OrderRecord {
  id: string;
  table_number: number;
  status: "pending" | "preparing" | "ready" | "served" | "completed";
  total_amount: number;
  payment_method: string;
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

export default function DashboardPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [actualTablesCount, setActualTablesCount] = useState<number>(5);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Table Action Modal
  const [selectedTableModal, setSelectedTableModal] = useState<number | null>(
    null,
  );
  const [settling, setSettling] = useState(false);

  // Quick Stock Toggle Modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItems, setStockItems] = useState<MenuStockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Owner Sales History Modal & Date Filters
  const todayIso = new Date().toISOString().split("T")[0];
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salesFilter, setSalesFilter] = useState<
    "today" | "7days" | "all" | "custom"
  >("today");
  const [customFromDate, setCustomFromDate] = useState<string>(todayIso);
  const [customToDate, setCustomToDate] = useState<string>(todayIso);

  useEffect(() => {
    const raw = localStorage.getItem("restro_session");
    if (!raw) {
      router.push("/");
      return;
    }
    try {
      const parsed: SessionData = JSON.parse(raw);
      setSession(parsed);
      if (parsed.totalTables) {
        setActualTablesCount(parsed.totalTables);
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.restaurantId) return;

    const [{ data: restData }, { data: ordersData }] = await Promise.all([
      supabase
        .from("restaurants")
        .select("name, city, total_tables")
        .eq("id", session.restaurantId)
        .single(),
      supabase
        .from("orders")
        .select(
          "id, table_number, status, total_amount, payment_method, created_at, order_items(id, item_name, quantity, price, notes)",
        )
        .eq("restaurant_id", session.restaurantId)
        .order("created_at", { ascending: false }),
    ]);

    if (restData?.total_tables) {
      setActualTablesCount(Number(restData.total_tables));
    }

    if (ordersData) {
      setOrders(ordersData as OrderRecord[]);
    }

    setLoading(false);
  }, [session?.restaurantId]);

  useEffect(() => {
    if (!session?.restaurantId) return;
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

  const handleLogout = () => {
    localStorage.removeItem("restro_session");
    router.push("/");
  };

  const handleSettleTable = async (
    tableNum: number,
    method: "cash" | "upi",
  ) => {
    if (!session?.restaurantId || session.role !== "owner") return;
    setSettling(true);

    const activeIds = orders
      .filter((o) => o.table_number === tableNum && o.status !== "completed")
      .map((o) => o.id);

    if (activeIds.length > 0) {
      await supabase
        .from("orders")
        .update({ status: "completed", payment_method: method })
        .in("id", activeIds);
    }

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

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-semibold text-sm">
          Loading RestroSync Console...
        </p>
      </div>
    );
  }

  const isOwner = session.role === "owner";

  const activeOrders = orders.filter((o) => o.status !== "completed");
  const completedOrders = orders.filter((o) => o.status === "completed");

  const todayStr = new Date().toDateString();
  const todayCompleted = completedOrders.filter(
    (o) => new Date(o.created_at).toDateString() === todayStr,
  );
  const todayRevenue = todayCompleted.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0,
  );

  // Filtered Sales Data (Today, Last 7 Days, All Time, or Custom Date Range)
  const filteredSalesOrders = completedOrders.filter((ord) => {
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navbar */}
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
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    isOwner
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {isOwner ? (
                    <>
                      <ShieldCheck className="w-3 h-3" /> Owner
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3 h-3" /> Staff Mode
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {session.city} • {actualTablesCount} Tables
              </p>
            </div>
          </div>

          {/* Role-Specific Action Buttons */}
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
                  onClick={() => setShowSalesModal(true)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <IndianRupee className="w-4 h-4" />
                  <span>Sales History</span>
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
              </>
            )}

            <button
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
        {/* TOP KPI CARDS */}
        {isOwner ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CLICKABLE TODAY'S TOTAL SALE CARD */}
            <button
              type="button"
              onClick={() => setShowSalesModal(true)}
              className="bg-white hover:bg-emerald-50/40 p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 shadow-sm text-left transition cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-600 text-xs font-bold">
                <span>Today&apos;s Total Sale</span>
                <span className="flex items-center gap-1 text-emerald-600 font-extrabold">
                  View History{" "}
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                ₹{todayRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                {todayCompleted.length} Bills Settled Today • Tap for Calendar
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
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Occupied Tables</span>
                <Users className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {occupiedTablesCount} / {actualTablesCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {Math.max(0, actualTablesCount - occupiedTablesCount)} Tables
                Free for Guests
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Cooking in Kitchen</span>
                <ChefHat className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {cookingOrdersCount}
              </p>
              <p className="text-[11px] text-blue-600 font-semibold mt-1">
                Orders Being Prepared
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Ready to Serve</span>
                <BellRing className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 mt-2">
                {readyToServeCount}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                Deliver to Customer Tables
              </p>
            </div>
          </section>
        )}

        {/* READY TO SERVE PRIORITY ALERT BANNER */}
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

        {/* LIVE FLOOR TABLE STATUS GRID */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Live Floor & Table Status
              </h2>
              <p className="text-xs text-slate-500">
                {isOwner
                  ? "Kisi bhi table par click karke order punch karein ya bill settle karein."
                  : "Kisi bhi table par click karke order punch karein ya running dishes dekhein."}
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>{" "}
                Free
              </span>
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>{" "}
                Active / Served
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{" "}
                Ready
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
              const tableTotal = tOrders.reduce(
                (s, o) => s + Number(o.total_amount),
                0,
              );
              const totalDishes = tOrders.reduce(
                (s, o) =>
                  s +
                  (o.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0),
                0,
              );

              return (
                <button
                  key={tableNum}
                  type="button"
                  onClick={() => {
                    if (isOccupied) {
                      setSelectedTableModal(tableNum);
                    } else {
                      router.push(`/order/${session.restaurantId}/${tableNum}`);
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between min-h-[120px] cursor-pointer hover:shadow-md ${
                    hasReady
                      ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
                      : isOccupied
                        ? "bg-amber-50/70 border-amber-400 shadow-sm"
                        : "bg-slate-50 border-slate-200/80 hover:border-orange-300"
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
                          : isOccupied
                            ? "bg-amber-500 text-white"
                            : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {hasReady ? "Ready" : isOccupied ? "Active" : "Free"}
                    </span>
                  </div>

                  {isOccupied ? (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-slate-700">
                        {totalDishes} Dish{totalDishes > 1 ? "es" : ""} Running
                      </p>
                      {isOwner ? (
                        <p className="text-base font-extrabold text-slate-900 mt-0.5">
                          ₹{tableTotal}
                        </p>
                      ) : (
                        <p className="text-[11px] font-semibold text-orange-600 mt-0.5">
                          View / Add Items &rarr;
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between text-slate-400">
                      <span className="text-xs">Available</span>
                      <span className="text-[11px] font-bold text-orange-600">
                        + Order
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* LIVE KITCHEN QUEUE FEED */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-600" /> Live Kitchen &
              Service Queue
            </h2>
            <span className="text-xs font-bold text-slate-400">
              {activeOrders.length} Active Ticket(s)
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Abhi koi active order nahi hai. Naya order aate hi yahan live
              dikhega.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      Table {ord.table_number}
                    </span>
                    <span className="text-slate-700 font-medium">
                      {ord.order_items
                        ?.map((i) => `${i.quantity}× ${i.item_name}`)
                        .join(", ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                        ord.status === "ready"
                          ? "bg-emerald-100 text-emerald-700"
                          : ord.status === "served"
                            ? "bg-purple-100 text-purple-700"
                            : ord.status === "preparing"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ord.status}
                    </span>

                    {ord.status === "ready" && (
                      <button
                        type="button"
                        onClick={() => handleMarkServed(ord.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1 rounded-lg transition"
                      >
                        Mark Served ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RECENT SETTLED BILLS HISTORY — SIRF OWNER KE LIYE */}
        {isOwner && (
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" /> Recent Settled
                Bills
              </h2>
              <button
                type="button"
                onClick={() => setShowSalesModal(true)}
                className="text-xs font-extrabold text-orange-600 hover:underline flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Filter by Date / Custom Calendar ({completedOrders.length})
                  &rarr;
                </span>
              </button>
            </div>

            {completedOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Abhi tak koi bill settle nahi hua hai.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedOrders.slice(0, 5).map((ord) => (
                  <div
                    key={ord.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-extrabold text-slate-900">
                        Table {ord.table_number}
                      </span>{" "}
                      <span className="text-slate-500">
                        •{" "}
                        {ord.order_items
                          ?.map((i) => `${i.quantity}× ${i.item_name}`)
                          .join(", ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {ord.payment_method || "PAID"}
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₹{ord.total_amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* OWNER FULL SALES HISTORY MODAL WITH CALENDAR & CUSTOM DATE RANGE */}
      {isOwner && showSalesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Sales & Billing History
                </h3>
                <p className="text-xs text-slate-500">
                  {session.restaurantName} • Date-wise Revenue & Payment
                  Breakdown
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSalesModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs (Today, Last 7 Days, All Time, Custom Calendar) */}
            <div className="flex flex-wrap items-center gap-2 pt-4">
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                    salesFilter === tab.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.id === "custom" && <Calendar className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* CUSTOM DATE RANGE CALENDAR PICKERS */}
            {salesFilter === "custom" && (
              <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    From Date (Start)
                  </label>
                  <input
                    type="date"
                    max={customToDate || todayIso}
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    To Date (End)
                  </label>
                  <input
                    type="date"
                    min={customFromDate}
                    max={todayIso}
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Revenue Summary Cards (Total, Cash, UPI) */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                <p className="text-[11px] font-bold text-emerald-700">
                  Total Revenue
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-900 mt-0.5">
                  ₹{filteredTotalSales.toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  {filteredSalesOrders.length} Bills
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Cash
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                  ₹{filteredCashSales.toLocaleString("en-IN")}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" /> UPI /
                  Online
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                  ₹{filteredUpiSales.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Detailed Bill List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
              {filteredSalesOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  Is selected date range mein koi settled bill nahi hai.
                </p>
              ) : (
                filteredSalesOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          Table {ord.table_number}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ord.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        {ord.order_items
                          ?.map((i) => `${i.quantity}× ${i.item_name}`)
                          .join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`uppercase text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${
                          (ord.payment_method || "").toLowerCase() === "upi"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {ord.payment_method || "CASH"}
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₹{ord.total_amount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TABLE ACTION MODAL */}
      {selectedTableModal !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Table {selectedTableModal}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalTableOrders.length > 0
                    ? `${modalTableOrders.length} active order(s) running`
                    : "Table abhi free hai"}
                </p>
              </div>
              <button
                onClick={() => setSelectedTableModal(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="pt-4">
              <Link
                href={`/order/${session.restaurantId}/${selectedTableModal}`}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {modalTableOrders.length > 0
                    ? `Add More Items to Table ${selectedTableModal}`
                    : `Take New Order for Table ${selectedTableModal}`}
                </span>
              </Link>
            </div>

            {modalTableOrders.length > 0 && (
              <div className="py-4 space-y-3 max-h-64 overflow-y-auto">
                {modalTableOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          ord.status === "ready"
                            ? "bg-emerald-100 text-emerald-700"
                            : ord.status === "served"
                              ? "bg-purple-100 text-purple-700"
                              : ord.status === "preparing"
                                ? "bg-blue-100 text-blue-700"
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
                          onClick={() => handleMarkServed(ord.id)}
                          className="text-[11px] font-extrabold bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition"
                        >
                          Mark Served ✓
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {ord.order_items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs text-slate-700"
                        >
                          <span>
                            <strong>{item.quantity}×</strong> {item.item_name}
                            {item.notes && (
                              <span className="text-[11px] text-orange-600 ml-1">
                                ({item.notes})
                              </span>
                            )}
                          </span>
                          {isOwner && (
                            <span className="font-bold">
                              ₹{item.price * item.quantity}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {modalTableOrders.length > 0 &&
              (isOwner ? (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between font-extrabold text-base text-slate-900">
                    <span>Total Table Bill</span>
                    <span>₹{modalTableTotal}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      disabled={settling}
                      onClick={() =>
                        handleSettleTable(selectedTableModal, "cash")
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      Settle Cash ₹{modalTableTotal}
                    </button>
                    <button
                      disabled={settling}
                      onClick={() =>
                        handleSettleTable(selectedTableModal, "upi")
                      }
                      className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl text-xs transition"
                    >
                      Settle UPI ₹{modalTableTotal}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-500">
                    Khana serve karne ke baad <strong>Mark Served ✓</strong>{" "}
                    dabayein. Final billing Owner handle karega.
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* QUICK STOCK AVAILABILITY MODAL */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Quick Dish Stock Toggle
                </h3>
                <p className="text-xs text-slate-500">
                  Koi dish khatam ho gayi ho toh Sold Out mark karein
                </p>
              </div>
              <button
                onClick={() => setShowStockModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 divide-y divide-slate-100">
              {loadingStock ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Loading menu items...
                </p>
              ) : stockItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Abhi menu mein koi item add nahi hai.
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
    </div>
  );
}
