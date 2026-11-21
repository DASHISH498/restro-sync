'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  UtensilsCrossed,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Sparkles,
  MessageSquarePlus,
  LayoutDashboard,
} from 'lucide-react';

interface RestaurantInfo {
  id: string;
  name: string;
  city: string;
}

interface MenuItem {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  is_veg: boolean;
  is_available: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

interface ActiveOrder {
  id: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  total_amount: number;
  created_at: string;
  order_items: {
    id: string;
    item_name: string;
    quantity: number;
    price: number;
  }[];
}

export default function CustomerOrderPage() {
  const params = useParams();
  const restaurantId = params.restaurantId as string;
  const tableNumber = Number(params.tableNumber);

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasStaffSession, setHasStaffSession] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Cart & Checkout States
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [showCartModal, setShowCartModal] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccessToast, setOrderSuccessToast] = useState(false);

  // Live Active Orders on this Table
  const [tableOrders, setTableOrders] = useState<ActiveOrder[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('restro_session');
    if (saved) {
      setHasStaffSession(true);
    }
  }, []);

  const fetchPageData = useCallback(async () => {
    if (!restaurantId) return;

    const { data: restData } = await supabase
      .from('restaurants')
      .select('id, name, city')
      .eq('id', restaurantId)
      .single();

    if (restData) {
      setRestaurant(restData);
    }

    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true });

    if (itemsData) {
      setMenuItems(itemsData);
    }

    setLoading(false);
  }, [restaurantId]);

  const fetchTableOrders = useCallback(async () => {
    if (!restaurantId || !tableNumber) return;

    const { data } = await supabase
      .from('orders')
      .select('id, status, total_amount, created_at, order_items(id, item_name, quantity, price)')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumber)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (data) {
      setTableOrders(data as ActiveOrder[]);
    }
  }, [restaurantId, tableNumber]);

  useEffect(() => {
    fetchPageData();
    fetchTableOrders();

    const channel = supabase
      .channel(`table-orders-${restaurantId}-${tableNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchTableOrders();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchTableOrders();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchPageData, fetchTableOrders, restaurantId, tableNumber]);

  const addToCart = (item: MenuItem) => {
    if (!item.is_available) return;
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          menuItem: item,
          quantity: existing ? existing.quantity + 1 : 1,
          notes: existing ? existing.notes : '',
        },
      };
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  const updateItemNote = (itemId: string, note: string) => {
    setCart((prev) => {
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: { ...prev[itemId], notes: note },
      };
    });
  };

  const handlePlaceOrder = async () => {
    const cartValues = Object.values(cart);
    if (cartValues.length === 0 || !restaurantId) return;

    setPlacingOrder(true);

    const totalAmount = cartValues.reduce(
      (sum, entry) => sum + Number(entry.menuItem.price) * entry.quantity,
      0
    );

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          restaurant_id: restaurantId,
          table_number: tableNumber,
          status: 'pending',
          total_amount: totalAmount,
          payment_method: 'unpaid',
        },
      ])
      .select()
      .single();

    if (orderError || !newOrder) {
      alert('Order place karne mein error aaya. Dobara try karein.');
      setPlacingOrder(false);
      return;
    }

    const orderItemsPayload = cartValues.map((entry) => ({
      order_id: newOrder.id,
      menu_item_id: entry.menuItem.id,
      item_name: entry.menuItem.name,
      quantity: entry.quantity,
      price: Number(entry.menuItem.price),
      notes: entry.notes.trim() || null,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload)
      .select();

    setPlacingOrder(false);

    if (!itemsError) {
      const instantOrder: ActiveOrder = {
        id: newOrder.id,
        status: 'pending',
        total_amount: totalAmount,
        created_at: newOrder.created_at,
        order_items: (insertedItems || []).map((i) => ({
          id: i.id,
          item_name: i.item_name,
          quantity: i.quantity,
          price: i.price,
        })),
      };

      setTableOrders((prev) => [instantOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
      setCart({});
      setShowCartModal(false);
      setOrderSuccessToast(true);
      setTimeout(() => setOrderSuccessToast(false), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Loading Digital Menu...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
        <p className="text-slate-600 font-semibold">Invalid QR Code. Restaurant nahi mila.</p>
      </div>
    );
  }

  const categories = ['All', ...Array.from(new Set(menuItems.map((i) => i.category)))];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesVeg = vegOnly ? item.is_veg : true;
    const matchesCat = selectedCategory === 'All' ? true : item.category === selectedCategory;
    return matchesSearch && matchesVeg && matchesCat;
  });

  const cartEntries = Object.values(cart);
  const totalCartItems = cartEntries.reduce((sum, c) => sum + c.quantity, 0);
  const totalCartPrice = cartEntries.reduce(
    (sum, c) => sum + Number(c.menuItem.price) * c.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Top Sticky Restaurant & Table Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between gap-2">
          {/* Logo & Restaurant Name Link -> Opens Dashboard */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-left group cursor-pointer"
            title="Go to Dashboard"
          >
            <div className="bg-orange-600 group-hover:bg-orange-700 text-white p-2 rounded-xl transition">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight group-hover:text-orange-600 transition">
                {restaurant.name}
              </h1>
              <p className="text-[11px] text-slate-500">{restaurant.city}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {hasStaffSession && (
              <Link
                href="/dashboard"
                className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            )}

            <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-full text-xs font-extrabold tracking-wide">
              TABLE {tableNumber}
            </div>
          </div>
        </div>

        {/* Search & Veg Filter Bar */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
            />
          </div>

          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
              vegOnly
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <span className="w-3 h-3 border border-emerald-600 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            </span>
            Veg Only
          </button>
        </div>

        {/* Horizontal Category Pills */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {/* Order Sent Toast */}
        {orderSuccessToast && (
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold text-sm">Order Sent to Kitchen!</p>
              <p className="text-xs text-emerald-100">
                Chef ne aapka order receive kar liya hai. Niche live status dekhein.
              </p>
            </div>
          </div>
        )}

        {/* Live Running Orders Status Card */}
        {tableOrders.length > 0 && (
          <section className="bg-white border-2 border-orange-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Your Active Orders (Table {tableNumber})
              </span>
              <span className="text-xs font-bold text-slate-500">
                {tableOrders.length} Order(s)
              </span>
            </div>

            <div className="space-y-2.5">
              {tableOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="text-xs text-slate-700">
                    {ord.order_items?.map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                    <p className="font-extrabold text-slate-900 mt-1">₹{ord.total_amount}</p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1 shrink-0 ${
                      ord.status === 'ready'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ord.status === 'preparing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ord.status === 'ready' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </>
                    ) : ord.status === 'preparing' ? (
                      <>
                        <ChefHat className="w-3 h-3" /> Cooking
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" /> Sent
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Menu Items List */}
        <section className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <p className="text-sm text-slate-500">Koi dish nahi mili.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const inCart = cart[item.id];

              return (
                <div
                  key={item.id}
                  className={`bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 ${
                    !item.is_available ? 'opacity-55' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                          item.is_veg ? 'border-emerald-600' : 'border-red-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        ></span>
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {item.category}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">₹{item.price}</p>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {!item.is_available ? (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                        Sold Out
                      </span>
                    ) : inCart ? (
                      <div className="flex items-center bg-orange-600 text-white rounded-xl overflow-hidden shadow-sm">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 hover:bg-orange-700 transition"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-2.5 font-extrabold text-sm">{inCart.quantity}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="p-2 hover:bg-orange-700 transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="px-4 py-2 rounded-xl border-2 border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white font-extrabold text-xs transition"
                      >
                        + ADD
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* Sticky Bottom Cart Bar */}
      {totalCartItems > 0 && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setShowCartModal(true)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-orange-100">
                    {totalCartItems} Item{totalCartItems > 1 ? 's' : ''} Added
                  </p>
                  <p className="text-base font-extrabold">₹{totalCartPrice}</p>
                </div>
              </div>

              <span className="font-extrabold text-sm flex items-center gap-1">
                View Cart & Order &rarr;
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Cart & Cooking Notes Drawer Modal */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Your Order • Table {tableNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Chef ke liye cooking instructions bhi likh sakte hain
                </p>
              </div>
              <button
                onClick={() => setShowCartModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cartEntries.map(({ menuItem, quantity, notes }) => (
                <div key={menuItem.id} className="bg-slate-50 p-3.5 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{menuItem.name}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        ₹{menuItem.price} × {quantity} = ₹{menuItem.price * quantity}
                      </p>
                    </div>

                    <div className="flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden">
                      <button
                        onClick={() => removeFromCart(menuItem.id)}
                        className="p-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 font-bold text-xs">{quantity}</span>
                      <button
                        onClick={() => addToCart(menuItem)}
                        className="p-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <MessageSquarePlus className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => updateItemNote(menuItem.id, e.target.value)}
                      placeholder="Add note for chef (e.g., Less spicy, No onion)..."
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-base font-extrabold text-slate-900 mb-3">
                <span>Total Payable</span>
                <span>₹{totalCartPrice}</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placingOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl shadow-lg transition disabled:opacity-50"
              >
                {placingOrder
                  ? 'Sending to Kitchen...'
                  : `Confirm & Send Order (₹${totalCartPrice})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}