'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  UtensilsCrossed,
  MonitorPlay,
  BookOpen,
  QrCode,
  LogOut,
  IndianRupee,
  Users,
  Clock,
  CheckCircle2,
  Plus,
  X,
  Receipt,
  ExternalLink,
  Settings,
  Save,
} from 'lucide-react';

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  city: string;
  totalTables: number;
  role: 'owner' | 'staff';
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  notes: string | null;
}

interface Order {
  id: string;
  table_number: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  total_amount: number;
  payment_method: string;
  created_at: string;
  order_items?: OrderItem[];
}

interface ConsolidatedItem {
  key: string;
  item_name: string;
  price: number;
  quantity: number;
  notes: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Selected Table Modal for Bill Settlement
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedTableOrders, setSelectedTableOrders] = useState<Order[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [settling, setSettling] = useState(false);

  // Settings Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsCity, setSettingsCity] = useState('');
  const [settingsTables, setSettingsTables] = useState(10);
  const [settingsOwnerPin, setSettingsOwnerPin] = useState('');
  const [settingsStaffPin, setSettingsStaffPin] = useState('');

  // 1. Check Session on Load
  useEffect(() => {
    const saved = localStorage.getItem('restro_session');
    if (!saved) {
      router.push('/');
      return;
    }
    setSession(JSON.parse(saved));
  }, [router]);

  // 2. Fetch Active Orders & Today's Completed Sales
  const fetchDashboardData = useCallback(async (restaurantId: string) => {
    const { data: openOrders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'completed')
      .order('created_at', { ascending: true });

    if (openOrders) {
      setActiveOrders(openOrders as Order[]);
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: completedOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString());

    if (completedOrders) {
      const sum = completedOrders.reduce((acc, o) => acc + Number(o.total_amount), 0);
      setTodaySales(sum);
    }

    setLoading(false);
  }, []);

  // 3. Initial Load + Realtime Subscription + Tab Focus Auto-Sync
  useEffect(() => {
    if (!session) return;

    fetchDashboardData(session.restaurantId);

    const channel = supabase
      .channel(`dashboard-live-${session.restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${session.restaurantId}`,
        },
        () => {
          setTimeout(() => fetchDashboardData(session.restaurantId), 350);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => {
          fetchDashboardData(session.restaurantId);
        }
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(session.restaurantId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      fetchDashboardData(session.restaurantId);
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [session, fetchDashboardData]);

  // Keep modal orders synced if realtime update arrives
  useEffect(() => {
    if (selectedTable !== null) {
      const tableOrds = activeOrders.filter((o) => o.table_number === selectedTable);
      setSelectedTableOrders(tableOrds);
    }
  }, [activeOrders, selectedTable]);

  // Open Settings Dialog & Fetch Current Details
  const handleOpenSettings = async () => {
    if (!session) return;
    setShowSettingsModal(true);
    setLoadingSettings(true);

    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', session.restaurantId)
      .single();

    if (data) {
      setSettingsName(data.name || session.restaurantName);
      setSettingsCity(data.city || session.city);
      setSettingsTables(Number(data.total_tables) || session.totalTables);
      setSettingsOwnerPin(data.owner_pin || '');
      setSettingsStaffPin(data.staff_pin || '');
    }
    setLoadingSettings(false);
  };

  // Save Settings from Dialog
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !settingsName.trim() || !settingsOwnerPin.trim() || !settingsStaffPin.trim()) {
      return;
    }

    setSavingSettings(true);
    const updatedTables = Math.max(1, Math.min(100, Number(settingsTables)));

    const { error } = await supabase
      .from('restaurants')
      .update({
        name: settingsName.trim(),
        city: settingsCity.trim(),
        total_tables: updatedTables,
        owner_pin: settingsOwnerPin.trim(),
        staff_pin: settingsStaffPin.trim(),
      })
      .eq('id', session.restaurantId);

    setSavingSettings(false);

    if (!error) {
      const updatedSession: SessionData = {
        ...session,
        restaurantName: settingsName.trim(),
        city: settingsCity.trim(),
        totalTables: updatedTables,
      };
      localStorage.setItem('restro_session', JSON.stringify(updatedSession));
      setSession(updatedSession);
      setShowSettingsModal(false);
    }
  };

  // Handle Table Click
  const handleTableClick = (tableNum: number) => {
    const tableOrds = activeOrders.filter((o) => o.table_number === tableNum);
    if (tableOrds.length === 0) {
      router.push(`/order/${session?.restaurantId}/${tableNum}`);
    } else {
      setSelectedTable(tableNum);
      setSelectedTableOrders(tableOrds);
    }
  };

  // Settle Bill
  const handleSettleBill = async () => {
    if (!session || selectedTableOrders.length === 0) return;
    setSettling(true);

    const orderIds = selectedTableOrders.map((o) => o.id);

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_method: paymentMethod,
      })
      .in('id', orderIds);

    setSettling(false);

    if (!error) {
      setSelectedTable(null);
      fetchDashboardData(session.restaurantId);
    }
  };

  // Logout / Switch Restaurant
  const handleLogout = () => {
    localStorage.removeItem('restro_session');
    router.push('/');
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Loading Restaurant Portal...</p>
      </div>
    );
  }

  const tablesArray = Array.from({ length: session.totalTables }, (_, i) => i + 1);
  const occupiedTableCount = new Set(activeOrders.map((o) => o.table_number)).size;

  const selectedTableTotal = selectedTableOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );

  // Merge duplicate dishes across multiple orders on the same table
  const consolidatedItemsMap = new Map<string, ConsolidatedItem>();
  selectedTableOrders.forEach((ord) => {
    ord.order_items?.forEach((item) => {
      const key = `${item.item_name.trim().toLowerCase()}_${Number(item.price)}`;
      const existing = consolidatedItemsMap.get(key);
      if (existing) {
        existing.quantity += Number(item.quantity);
        if (item.notes && !existing.notes.includes(item.notes)) {
          existing.notes.push(item.notes);
        }
      } else {
        consolidatedItemsMap.set(key, {
          key,
          item_name: item.item_name,
          price: Number(item.price),
          quantity: Number(item.quantity),
          notes: item.notes ? [item.notes] : [],
        });
      }
    });
  });
  const consolidatedItems = Array.from(consolidatedItemsMap.values());

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 text-white p-2 rounded-xl">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{session.restaurantName}</h1>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    session.role === 'owner'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {session.role}
                </span>
              </div>
              <p className="text-xs text-slate-500">{session.city}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session.role === 'owner' && (
              <button
                onClick={handleOpenSettings}
                className="text-slate-600 hover:text-orange-600 text-sm font-semibold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
                title="Restaurant Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="text-slate-600 hover:text-red-600 text-sm font-semibold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Switch / Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-8">
        {/* 3 Big Action Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Kitchen Display */}
          <button
            onClick={() => router.push(`/kitchen/${session.restaurantId}`)}
            className="bg-slate-900 hover:bg-slate-800 text-white p-5 rounded-2xl text-left flex items-center justify-between shadow-sm transition group"
          >
            <div>
              <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                Live Chef Screen
              </span>
              <h2 className="text-lg font-bold mt-0.5">Kitchen Display (KDS)</h2>
              <p className="text-xs text-slate-400 mt-1">Aane wale orders dekhein</p>
            </div>
            <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-xl group-hover:scale-105 transition">
              <MonitorPlay className="w-6 h-6" />
            </div>
          </button>

          {/* Card 2: Menu Manager (Owner Only) */}
          {session.role === 'owner' && (
            <button
              onClick={() => router.push('/dashboard/menu')}
              className="bg-white hover:border-orange-400 border border-slate-200 p-5 rounded-2xl text-left flex items-center justify-between shadow-sm transition group"
            >
              <div>
                <span className="text-xs text-orange-600 font-semibold uppercase tracking-wider">
                  Owner Setup
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">Menu & Prices</h2>
                <p className="text-xs text-slate-500 mt-1">Dishes add ya edit karein</p>
              </div>
              <div className="bg-orange-100 text-orange-600 p-3 rounded-xl group-hover:scale-105 transition">
                <BookOpen className="w-6 h-6" />
              </div>
            </button>
          )}

          {/* Card 3: QR Codes (Owner Only) */}
          {session.role === 'owner' && (
            <button
              onClick={() => router.push('/dashboard/qr')}
              className="bg-white hover:border-orange-400 border border-slate-200 p-5 rounded-2xl text-left flex items-center justify-between shadow-sm transition group"
            >
              <div>
                <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">
                  Print & Stick
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">Table QR Codes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {session.totalTables} tables ke QR download karein
                </p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-3 rounded-xl group-hover:scale-105 transition">
                <QrCode className="w-6 h-6" />
              </div>
            </button>
          )}
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Clickable Today's Sales Card -> Opens Sales & Order History */}
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="bg-white hover:border-emerald-400 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-left transition group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl group-hover:scale-105 transition">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Aaj Ki Sales (View Bills &rarr;)</p>
                <p className="text-xl font-extrabold text-slate-900">₹{todaySales}</p>
              </div>
            </div>
          </button>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
            <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Running Tables</p>
              <p className="text-xl font-extrabold text-slate-900">
                {occupiedTableCount} / {session.totalTables}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Orders</p>
              <p className="text-xl font-extrabold text-slate-900">{activeOrders.length}</p>
            </div>
          </div>
        </section>

        {/* Live Tables Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Live Tables Status</h2>
              <p className="text-xs text-slate-500">
                Khali table par click karke order lein, ya running table par click karke bill banayein.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Free
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span> Occupied
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {tablesArray.map((tableNum) => {
              const tableOrds = activeOrders.filter((o) => o.table_number === tableNum);
              const isOccupied = tableOrds.length > 0;
              const tableBill = tableOrds.reduce((sum, o) => sum + Number(o.total_amount), 0);
              const latestStatus = isOccupied ? tableOrds[tableOrds.length - 1].status : null;

              return (
                <button
                  key={tableNum}
                  onClick={() => handleTableClick(tableNum)}
                  className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between min-h-[120px] ${
                    isOccupied
                      ? 'bg-orange-50 border-orange-500 shadow-sm hover:bg-orange-100/70'
                      : 'bg-white border-slate-200 hover:border-emerald-500'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-base text-slate-900">
                      Table {tableNum}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isOccupied ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    ></span>
                  </div>

                  {isOccupied ? (
                    <div className="mt-3">
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-orange-200 text-orange-800 mb-1">
                        {latestStatus}
                      </span>
                      <p className="text-lg font-extrabold text-slate-900">₹{tableBill}</p>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Plus className="w-3.5 h-3.5" /> Take Order
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* MODAL 1: Consolidated Table Bill & Order Settlement */}
      {selectedTable !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedTable(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-5 h-5 text-orange-600" />
              <h3 className="text-xl font-bold text-slate-900">Table {selectedTable} — Bill</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {selectedTableOrders.length} active order(s) • Consolidated summary
            </p>

            {/* Consolidated Items Receipt */}
            <div className="flex-1 overflow-y-auto border-y border-slate-200 py-3 mb-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="flex justify-between items-center pb-2 mb-2.5 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                  <span>Item & Qty</span>
                  <span>Amount</span>
                </div>
                <ul className="space-y-2.5">
                  {consolidatedItems.map((item) => (
                    <li key={item.key} className="flex justify-between items-start text-sm">
                      <div>
                        <span className="font-extrabold text-orange-600">{item.quantity}x</span>{' '}
                        <span className="font-bold text-slate-900">{item.item_name}</span>
                        <span className="text-xs text-slate-400 ml-1.5">(@ ₹{item.price})</span>
                        {item.notes.length > 0 && (
                          <span className="block text-xs text-slate-500 italic mt-0.5">
                            Note: {item.notes.join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-900">
                        ₹{item.price * item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Add More Items Button */}
            <button
              onClick={() => router.push(`/order/${session.restaurantId}/${selectedTable}`)}
              className="w-full mb-4 py-2 px-3 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-orange-100 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> + Add More Items to Table {selectedTable}
            </button>

            {/* Total & Payment Mode */}
            <div className="flex items-center justify-between text-lg font-extrabold text-slate-900 mb-3">
              <span>Grand Total</span>
              <span>₹{selectedTableTotal}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['upi', 'cash', 'card'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 rounded-xl text-xs font-bold uppercase border transition ${
                    paymentMethod === method
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <button
              onClick={handleSettleBill}
              disabled={settling}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {settling ? 'Completing...' : `Mark Paid (₹${selectedTableTotal}) & Free Table`}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Restaurant Settings Dialog */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-extrabold text-slate-900">Restaurant Settings</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Cafe details, seating tables aur login PINs update karein
            </p>

            {loadingSettings ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading details...</div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Restaurant Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={settingsCity}
                      onChange={(e) => setSettingsCity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
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
                    value={settingsTables}
                    onChange={(e) => setSettingsTables(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Owner PIN *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={settingsOwnerPin}
                      onChange={(e) => setSettingsOwnerPin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Staff / Waiter PIN *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={settingsStaffPin}
                      onChange={(e) => setSettingsStaffPin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingSettings ? 'Saving...' : 'Save Settings'}
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