'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ChefHat,
  ArrowLeft,
  Volume2,
  VolumeX,
  Clock,
  Flame,
  CheckCircle2,
  BellRing,
} from 'lucide-react';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  notes: string | null;
}

interface KitchenOrder {
  id: string;
  table_number: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

export default function KitchenDisplayPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.restaurantId as string;

  const [restaurantName, setRestaurantName] = useState('Kitchen Display');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Unlock persistent AudioContext on any user interaction
  const unlockAudio = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setAudioUnlocked(true);
    } catch {
      // Ignore if unsupported
    }
  }, []);

  useEffect(() => {
    const handleFirstInteraction = () => unlockAudio();
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [unlockAudio]);

  // Loud 2-Tone Kitchen Bell Alert
  const playNewOrderBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);

        gain.gain.setValueAtTime(0.01, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + startOffset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration);
      };

      // Double-ring kitchen chime (Ding-Dong!)
      playTone(987.77, 0, 0.35); // B5
      playTone(1318.51, 0.22, 0.55); // E6
    } catch {
      // Fallback ignored
    }
  }, [soundEnabled]);

  // Fetch Restaurant Name & Active Kitchen Orders
  const fetchKitchenOrders = useCallback(async () => {
    if (!restaurantId) return;

    const { data } = await supabase
      .from('orders')
      .select('id, table_number, status, total_amount, created_at, order_items(*)')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (data) {
      const fetchedOrders = data as KitchenOrder[];

      if (!isInitialLoadRef.current) {
        const hasNewOrder = fetchedOrders.some((o) => !knownOrderIdsRef.current.has(o.id));
        if (hasNewOrder) {
          playNewOrderBeep();
        }
      }

      knownOrderIdsRef.current = new Set(fetchedOrders.map((o) => o.id));
      isInitialLoadRef.current = false;
      setOrders(fetchedOrders);
    }
    setLoading(false);
  }, [restaurantId, playNewOrderBeep]);

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
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [restaurantId, fetchKitchenOrders]);

  // Update Order Status
  const handleStatusChange = async (orderId: string, newStatus: 'preparing' | 'ready') => {
    unlockAudio();
    setUpdatingId(orderId);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    setUpdatingId(null);
    if (!error) {
      fetchKitchenOrders();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <p className="font-semibold">Loading Kitchen Display System...</p>
      </div>
    );
  }

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-12">
      {/* Dark High-Contrast KDS Top Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
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
              <h1 className="text-lg font-extrabold tracking-tight">{restaurantName} — KDS</h1>
              <p className="text-xs text-slate-400">Live Kitchen Order Tickets</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 text-xs font-bold mr-1">
              <span className="bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full">
                New: {pendingCount}
              </span>
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-full">
                Cooking: {preparingCount}
              </span>
            </div>

            <button
              onClick={() => {
                unlockAudio();
                playNewOrderBeep();
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold transition"
            >
              Test Bell
            </button>

            <button
              onClick={() => {
                unlockAudio();
                const nextState = !soundEnabled;
                setSoundEnabled(nextState);
                if (nextState) playNewOrderBeep();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                soundEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
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
          </div>
        </div>

        {/* Audio Unlock Prompt Banner (Shows until first click on KDS screen) */}
        {soundEnabled && !audioUnlocked && (
          <div
            onClick={() => {
              unlockAudio();
              playNewOrderBeep();
            }}
            className="bg-amber-500 text-slate-950 text-xs font-extrabold text-center py-2 px-4 cursor-pointer hover:bg-amber-400 transition"
          >
            🔔 Browser ne sound mute rakha hai — Kitchen Bell Alert chalu karne ke liye yahan 1 baar click karein!
          </div>
        )}
      </header>

      {/* Kitchen Tickets Grid */}
      <main className="max-w-7xl mx-auto px-4 pt-6">
        {orders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center max-w-md mx-auto mt-12">
            <BellRing className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-200">No Active Orders in Kitchen</h2>
            <p className="text-xs text-slate-400 mt-1">
              Jaise hi customer ya waiter order place karega, bell sound ke saath ticket yahan
              dikh jayegi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {orders.map((order) => {
              const isPending = order.status === 'pending';
              const isPreparing = order.status === 'preparing';
              const isReady = order.status === 'ready';

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-2 flex flex-col justify-between overflow-hidden shadow-lg ${
                    isPending
                      ? 'bg-slate-900 border-amber-500'
                      : isPreparing
                      ? 'bg-slate-900 border-blue-500'
                      : 'bg-slate-900/70 border-emerald-500'
                  }`}
                >
                  <div>
                    <div
                      className={`px-4 py-3 flex items-center justify-between ${
                        isPending
                          ? 'bg-amber-500 text-slate-950'
                          : isPreparing
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <span className="font-black text-lg tracking-wide">
                        TABLE {order.table_number}
                      </span>
                      <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-black/20">
                        {order.status}
                      </span>
                    </div>

                    <div className="px-4 py-2 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>#{order.id.slice(0, 5).toUpperCase()}</span>
                    </div>

                    <ul className="p-4 space-y-3">
                      {order.order_items?.map((item) => (
                        <li
                          key={item.id}
                          className="border-b last:border-b-0 border-slate-800 pb-2.5 last:pb-0"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="bg-slate-800 text-orange-400 font-black text-sm px-2 py-0.5 rounded-lg shrink-0">
                              {item.quantity}×
                            </span>
                            <div>
                              <p className="font-bold text-base text-white leading-snug">
                                {item.item_name}
                              </p>
                              {item.notes && (
                                <p className="mt-1 text-xs font-semibold bg-amber-500/20 text-amber-300 px-2 py-1 rounded-md inline-block">
                                  Note: {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 pt-0">
                    {isPending && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'preparing')}
                        disabled={updatingId === order.id}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <Flame className="w-4 h-4" /> Start Cooking
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'ready')}
                        disabled={updatingId === order.id}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Ready to Serve
                      </button>
                    )}

                    {isReady && (
                      <div className="w-full bg-emerald-500/20 text-emerald-400 font-bold text-xs py-2.5 rounded-xl text-center">
                        ✓ Ready • Waiting for Waiter / Billing
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