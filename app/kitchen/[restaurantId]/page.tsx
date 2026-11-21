'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ChefHat,
  ArrowLeft,
  Clock,
  Flame,
  CheckCircle2,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-react';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
}

interface KitchenOrder {
  id: string;
  table_number: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  created_at: string;
  order_items: OrderItem[];
}

function KitchenDisplayContent() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.restaurantId as string;

  const [restaurantName, setRestaurantName] = useState('Kitchen Display');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();

      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(880, now, 0.3);
      playTone(659.25, now + 0.28, 0.45);
    } catch {
      // Ignore if browser blocks audio before first click
    }
  }, [soundEnabled]);

  const fetchKitchenOrders = useCallback(async () => {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from('orders')
      .select('id, table_number, status, created_at, order_items(id, item_name, quantity, notes)')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!error && data) {
      const typedData = data as KitchenOrder[];

      if (!isInitialLoadRef.current) {
        const hasNewPending = typedData.some(
          (o) => o.status === 'pending' && !knownOrderIdsRef.current.has(o.id)
        );
        if (hasNewPending) {
          playNotificationSound();
        }
      }

      knownOrderIdsRef.current = new Set(typedData.map((o) => o.id));
      isInitialLoadRef.current = false;
      setOrders(typedData);
    }

    setLoading(false);
  }, [restaurantId, playNotificationSound]);

  useEffect(() => {
    if (!restaurantId) return;

    supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        if (data?.name) setRestaurantName(data.name);
      });

    fetchKitchenOrders();

    const channel = supabase
      .channel(`kitchen-live-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          setTimeout(() => fetchKitchenOrders(), 300);
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
          fetchKitchenOrders();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchKitchenOrders();
    }, 3500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [restaurantId, fetchKitchenOrders]);

  const handleStatusChange = async (orderId: string, nextStatus: 'preparing' | 'ready') => {
    setUpdatingId(orderId);
    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    setUpdatingId(null);
    if (!error) {
      fetchKitchenOrders();
    }
  };

  const getMinutesAgo = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    return mins === 0 ? 'Just now' : `${mins}m ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400 font-semibold">Loading Kitchen Display (KDS)...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">
                {restaurantName} — Kitchen (KDS)
              </h1>
              <p className="text-xs text-slate-400">
                Live Active Orders: <strong className="text-white">{orders.length}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playNotificationSound();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                soundEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4" /> Sound ON
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" /> Muted
                </>
              )}
            </button>

            <button
              onClick={fetchKitchenOrders}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Orders"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              href="/dashboard"
              className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6">
        {orders.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center max-w-md mx-auto mt-10">
            <ChefHat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-200">Abhi Koi Pending Order Nahi Hai</h2>
            <p className="text-xs text-slate-400 mt-1">
              Jaise hi koi table order place karega, yahan bell bajegi aur KOT card aa jayega.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const isPending = order.status === 'pending';
              const isPreparing = order.status === 'preparing';
              const isReady = order.status === 'ready';

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition ${
                    isPending
                      ? 'bg-slate-900 border-amber-500 shadow-lg shadow-amber-500/10'
                      : isPreparing
                      ? 'bg-slate-900 border-blue-500'
                      : 'bg-slate-900/70 border-emerald-500/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                      <span className="bg-white text-slate-900 font-extrabold text-sm px-3 py-1 rounded-full">
                        TABLE {order.table_number}
                      </span>

                      <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {getMinutesAgo(order.created_at)}
                      </span>
                    </div>

                    <div className="mb-3">
                      <span
                        className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          isPending
                            ? 'bg-amber-500/20 text-amber-400'
                            : isPreparing
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <ul className="space-y-2.5 mb-5">
                      {order.order_items?.map((item) => (
                        <li
                          key={item.id}
                          className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-orange-400 font-extrabold text-base">
                              {item.quantity}×
                            </span>
                            <span className="font-bold text-white text-base leading-snug">
                              {item.item_name}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="mt-1.5 text-xs bg-amber-500/15 text-amber-300 px-2.5 py-1 rounded-lg font-medium">
                              Note: {item.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2">
                    {isPending && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'preparing')}
                        disabled={updatingId === order.id}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <Flame className="w-4 h-4" /> Start Cooking
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'ready')}
                        disabled={updatingId === order.id}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Order Ready
                      </button>
                    )}

                    {isReady && (
                      <div className="w-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold py-2.5 rounded-xl text-xs text-center">
                        Ready to Serve (Waiting for Bill)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function KitchenDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <p className="text-slate-400 font-semibold">Loading Kitchen Display...</p>
        </div>
      }
    >
      <KitchenDisplayContent />
    </Suspense>
  );
}