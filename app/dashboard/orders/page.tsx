'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  IndianRupee,
  Smartphone,
  Banknote,
  CreditCard,
  Receipt,
  Printer,
  Calendar,
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
}

interface CompletedOrder {
  id: string;
  table_number: number;
  total_amount: number;
  payment_method: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today');
  const [printOrder, setPrintOrder] = useState<CompletedOrder | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('restro_session');
    if (!saved) {
      router.push('/');
      return;
    }
    setSession(JSON.parse(saved));
  }, [router]);

  const fetchCompletedOrders = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    let query = supabase
      .from('orders')
      .select('id, table_number, total_amount, payment_method, created_at, order_items(*)')
      .eq('restaurant_id', session.restaurantId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (dateFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startOfDay.toISOString());
    } else if (dateFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    }

    const { data, error } = await query;
    if (!error && data) {
      setOrders(data as CompletedOrder[]);
    }
    setLoading(false);
  }, [session, dateFilter]);

  useEffect(() => {
    fetchCompletedOrders();
  }, [fetchCompletedOrders]);

  const handlePrintBill = (order: CompletedOrder) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Loading Sales History...</p>
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const upiTotal = orders
    .filter((o) => o.payment_method?.toLowerCase() === 'upi')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const cashTotal = orders
    .filter((o) => o.payment_method?.toLowerCase() === 'cash')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const cardTotal = orders
    .filter((o) => o.payment_method?.toLowerCase() === 'card')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Print-Only Thermal Receipt Layout */}
      {printOrder && (
        <div className="hidden print:block p-6 max-w-xs mx-auto text-black font-mono text-xs">
          <div className="text-center border-b border-dashed border-black pb-3 mb-3">
            <h2 className="text-base font-bold uppercase">{session.restaurantName}</h2>
            <p>{session.city}</p>
            <p className="mt-1">
              {new Date(printOrder.created_at).toLocaleDateString()} •{' '}
              {new Date(printOrder.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p className="font-bold mt-1">
              TABLE {printOrder.table_number} | #{printOrder.id.slice(0, 6).toUpperCase()}
            </p>
          </div>

          <div className="border-b border-dashed border-black pb-3 mb-3 space-y-1.5">
            {printOrder.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}x {item.item_name}
                </span>
                <span>₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-bold text-sm mb-2">
            <span>GRAND TOTAL</span>
            <span>₹{printOrder.total_amount}</span>
          </div>
          <p className="text-center uppercase text-[11px] mb-4">
            Paid via {printOrder.payment_method}
          </p>
          <p className="text-center border-t border-dashed border-black pt-2">
            Thank you! Visit Again.
          </p>
        </div>
      )}

      {/* Main Screen UI (Hidden during thermal print) */}
      <div className="print:hidden">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Sales & Order History</h1>
                <p className="text-xs text-slate-500">{session.restaurantName}</p>
              </div>
            </div>

            {/* Date Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(
                [
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: '7 Days' },
                  { key: 'all', label: 'All Time' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDateFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    dateFilter === tab.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
          {/* Payment Breakdown Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                <IndianRupee className="w-4 h-4 text-emerald-400" /> Total Revenue
              </div>
              <p className="text-2xl font-extrabold">₹{totalRevenue}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{orders.length} Settled Bills</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                <Smartphone className="w-4 h-4 text-purple-600" /> UPI Collection
              </div>
              <p className="text-xl font-extrabold text-slate-900">₹{upiTotal}</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                <Banknote className="w-4 h-4 text-emerald-600" /> Cash Collection
              </div>
              <p className="text-xl font-extrabold text-slate-900">₹{cashTotal}</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                <CreditCard className="w-4 h-4 text-blue-600" /> Card Collection
              </div>
              <p className="text-xl font-extrabold text-slate-900">₹{cardTotal}</p>
            </div>
          </section>

          {/* Completed Bills List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" /> Settled Bills
              </h2>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                <p className="text-sm text-slate-500">Fetching bills...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">
                  No settled bills found for this period.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Settled bills will appear here as soon as you settle an occupied table on the
                  dashboard.
                </p>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-slate-900 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                        Table {order.table_number}
                      </span>
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        {order.payment_method}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleDateString()} •{' '}
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 pt-1">
                      {order.order_items
                        ?.map((i) => `${i.quantity}x ${i.item_name} (₹${i.price * i.quantity})`)
                        .join(' • ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <span className="text-lg font-extrabold text-slate-900">
                      ₹{order.total_amount}
                    </span>

                    <button
                      onClick={() => handlePrintBill(order)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" /> Receipt
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}