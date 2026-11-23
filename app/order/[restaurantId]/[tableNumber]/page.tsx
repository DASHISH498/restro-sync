'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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
  BookOpen,
  Flame,
  MapPin,
  ShieldCheck,
  User,
  Phone,
  Printer,
  Receipt,
  AlertCircle,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

interface RestaurantInfo {
  id: string;
  name: string;
  city: string;
  upi_id?: string | null;
  bank_account_name?: string | null;
  razorpay_key_id?: string | null;
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
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'completed';
  total_amount: number;
  payment_status?: string;
  payment_method?: string;
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
  }[];
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${rand}`;
}

function getShortBillNumber(orderId: string): string {
  return `BILL-${orderId.slice(0, 6).toUpperCase()}`;
}

function CustomerOrderContent() {
  const params = useParams();
  const restaurantId = params?.restaurantId as string;
  const tableNumber = Number(params?.tableNumber);

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasStaffSession, setHasStaffSession] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Customer Details (Mandatory for QR Order)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Cart & Checkout States
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [showCartModal, setShowCartModal] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccessToast, setOrderSuccessToast] = useState(false);

  // Direct Merchant UPI Payment Modal States
  const [showUpiPayModal, setShowUpiPayModal] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [upiUtrInput, setUpiUtrInput] = useState('');

  // Printable Digital Receipt Modal
  const [receiptOrder, setReceiptOrder] = useState<ActiveOrder | null>(null);

  // Live Active Orders on this Table
  const [tableOrders, setTableOrders] = useState<ActiveOrder[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('restro_session');
    if (saved) {
      setHasStaffSession(true);
    }

    const savedCust = sessionStorage.getItem('restro_customer_info');
    if (savedCust) {
      try {
        const parsed = JSON.parse(savedCust);
        if (parsed.name) setCustomerName(parsed.name);
        if (parsed.phone) setCustomerPhone(parsed.phone);
      } catch {
        // Ignore parse error
      }
    }
  }, []);

  const fetchPageData = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let restData: RestaurantInfo | null = null;
    const { data: fullRest, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name, city, upi_id, bank_account_name, razorpay_key_id')
      .eq('id', restaurantId)
      .single();

    if (!restErr && fullRest) {
      restData = fullRest as RestaurantInfo;
    } else {
      const { data: basicRest } = await supabase
        .from('restaurants')
        .select('id, name, city')
        .eq('id', restaurantId)
        .single();
      if (basicRest) {
        restData = basicRest as RestaurantInfo;
      }
    }

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

    const { data: fullOrders, error: ordErr } = await supabase
      .from('orders')
      .select(
        'id, status, total_amount, payment_status, payment_method, customer_name, customer_phone, invoice_number, razorpay_payment_id, created_at, order_items(id, item_name, quantity, price)'
      )
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumber)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!ordErr && fullOrders) {
      setTableOrders(fullOrders as ActiveOrder[]);
      return;
    }

    const { data: basicOrders } = await supabase
      .from('orders')
      .select(
        'id, status, total_amount, created_at, order_items(id, item_name, quantity, price)'
      )
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumber)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (basicOrders) {
      setTableOrders(basicOrders as ActiveOrder[]);
    }
  }, [restaurantId, tableNumber]);

  useEffect(() => {
    setLoading(true);
    fetchPageData();
    fetchTableOrders();

    if (!restaurantId) return;

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

  const validateCustomerDetails = (): boolean => {
    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.replace(/\D/g, '');

    if (cleanName.length < 2) {
      setFormError('Kripya apna poora naam (Customer Name) likhein.');
      return false;
    }

    if (cleanPhone.length !== 10) {
      setFormError('Kripya 10-digit ka valid mobile number likhein.');
      return false;
    }

    setFormError(null);
    sessionStorage.setItem(
      'restro_customer_info',
      JSON.stringify({ name: cleanName, phone: cleanPhone })
    );
    return true;
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

  const saveOrderToDatabase = async (
    paymentStatus: 'paid' | 'unpaid',
    paymentMethod: string,
    paymentReferenceId?: string
  ) => {
    const cartValues = Object.values(cart);
    if (cartValues.length === 0 || !restaurantId) return;

    const totalAmount = cartValues.reduce(
      (sum, entry) => sum + Number(entry.menuItem.price) * entry.quantity,
      0
    );

    const invoiceNo = generateInvoiceNumber();
    const cleanName = customerName.trim() || 'Walk-in Guest';
    const cleanPhone = customerPhone.replace(/\D/g, '') || null;

    let createdOrder = null;

    const { data: fullInserted, error: fullErr } = await supabase
      .from('orders')
      .insert([
        {
          restaurant_id: restaurantId,
          table_number: tableNumber,
          status: 'pending',
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          customer_name: cleanName,
          customer_phone: cleanPhone,
          invoice_number: invoiceNo,
          razorpay_payment_id: paymentReferenceId || null,
        },
      ])
      .select()
      .single();

    if (!fullErr && fullInserted) {
      createdOrder = fullInserted;
    } else {
      const { data: basicInserted, error: basicErr } = await supabase
        .from('orders')
        .insert([
          {
            restaurant_id: restaurantId,
            table_number: tableNumber,
            status: 'pending',
            total_amount: totalAmount,
            payment_method: paymentMethod,
          },
        ])
        .select()
        .single();

      if (!basicErr && basicInserted) {
        createdOrder = basicInserted;
      }
    }

    if (!createdOrder) {
      setFormError('Order save karne mein error aaya. Dobara try karein.');
      setPlacingOrder(false);
      return;
    }

    const orderItemsPayload = cartValues.map((entry) => ({
      order_id: createdOrder.id,
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
        id: createdOrder.id,
        status: 'pending',
        total_amount: totalAmount,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        invoice_number: invoiceNo,
        razorpay_payment_id: paymentReferenceId || null,
        created_at: createdOrder.created_at,
        order_items: (insertedItems || []).map((i) => ({
          id: i.id,
          item_name: i.item_name,
          quantity: i.quantity,
          price: i.price,
        })),
      };

      setTableOrders((prev) => [instantOrder, ...prev.filter((o) => o.id !== createdOrder.id)]);
      setCart({});
      setUpiUtrInput('');
      setShowCartModal(false);
      setShowUpiPayModal(false);
      setOrderSuccessToast(true);
      setTimeout(() => setOrderSuccessToast(false), 5000);

      if (paymentStatus === 'paid') {
        setReceiptOrder(instantOrder);
      }
    }
  };

  const handleStartCustomerCheckout = async () => {
    const cartValues = Object.values(cart);
    if (cartValues.length === 0 || !restaurantId || !restaurant) return;

    if (!validateCustomerDetails()) return;

    if (restaurant.razorpay_key_id && restaurant.razorpay_key_id.trim()) {
      const totalAmount = cartValues.reduce(
        (sum, entry) => sum + Number(entry.menuItem.price) * entry.quantity,
        0
      );

      setPlacingOrder(true);

      try {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          setFormError('Payment gateway load nahi ho paya. Internet check karein.');
          setPlacingOrder(false);
          return;
        }

        const res = await fetch('/api/razorpay/create-table-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            restaurantId,
            tableNumber,
          }),
        });

        const orderData = await res.json();
        if (!res.ok || !orderData.orderId || !orderData.keyId) {
          setFormError(orderData.error || 'Payment start karne mein error aaya.');
          setPlacingOrder(false);
          return;
        }

        setShowCartModal(false);

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: restaurant.name,
          description: `Table ${tableNumber} • ${customerName.trim()}`,
          order_id: orderData.orderId,
          prefill: {
            name: customerName.trim(),
            contact: customerPhone.replace(/\D/g, ''),
          },
          theme: {
            color: '#ea580c',
          },
          handler: async function (response: { razorpay_payment_id: string }) {
            await saveOrderToDatabase('paid', 'upi', response.razorpay_payment_id);
          },
          modal: {
            ondismiss: function () {
              setPlacingOrder(false);
            },
          },
        };

        const RazorpayConstructor = (
          window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }
        ).Razorpay;
        const rzp = new RazorpayConstructor(options);
        rzp.open();
      } catch {
        setFormError('Payment process mein dikkat aayi. Dobara try karein.');
        setPlacingOrder(false);
      }
      return;
    }

    if (restaurant.upi_id && restaurant.upi_id.trim()) {
      setShowCartModal(false);
      setShowUpiPayModal(true);
      return;
    }

    setPlacingOrder(true);
    await saveOrderToDatabase('unpaid', 'cash');
  };

  const handleConfirmMerchantUpiPaid = async () => {
    setPlacingOrder(true);
    const refText =
      upiUtrInput.trim() || `UPI-TBL${tableNumber}-${Date.now().toString().slice(-5)}`;
    await saveOrderToDatabase('paid', 'upi', refText);
  };

  const handlePayAtCounterCustomer = async () => {
    if (!validateCustomerDetails()) return;
    setPlacingOrder(true);
    await saveOrderToDatabase('unpaid', 'cash');
  };

  const handleDirectStaffOrder = async () => {
    setFormError(null);
    setPlacingOrder(true);
    await saveOrderToDatabase('unpaid', 'unpaid');
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

  const merchantUpiId = (restaurant.upi_id || '').trim();
  const merchantDisplayName = (restaurant.bank_account_name || restaurant.name).trim();
  const txnRefId = `TBL${tableNumber}-${Date.now()}`;
  const upiDeepLink = merchantUpiId
    ? `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(
        merchantDisplayName
      )}&tr=${encodeURIComponent(txnRefId)}&am=${totalCartPrice.toFixed(
        2
      )}&cu=INR&tn=${encodeURIComponent(`Table ${tableNumber} Bill`)}`
    : '';
  const dynamicQrImageUrl = upiDeepLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
        upiDeepLink
      )}`
    : '';

  const hasAnyOnlinePayment = Boolean(
    (restaurant.razorpay_key_id && restaurant.razorpay_key_id.trim()) || merchantUpiId
  );

  const handleCopyUpi = () => {
    if (!merchantUpiId) return;
    navigator.clipboard.writeText(merchantUpiId);
    setUpiCopied(true);
    setTimeout(() => setUpiCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 lg:pb-16">
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          header,
          main,
          .no-print {
            display: none !important;
          }
          #receipt-modal-backdrop {
            position: static !important;
            background: #ffffff !important;
            padding: 0 !important;
            display: block !important;
          }
          #printable-customer-receipt {
            position: static !important;
            width: 100% !important;
            max-width: 420px !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 16px !important;
            padding: 20px !important;
            margin: 0 auto !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            onClick={(e) => {
              if (hasStaffSession) {
                e.preventDefault();
                window.location.assign('/dashboard');
              }
            }}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-2.5 rounded-xl shadow-sm group-hover:scale-105 transition">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight group-hover:text-orange-600 transition">
                {restaurant.name}
              </h1>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> {restaurant.city}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 order-3 lg:order-2 w-full lg:w-auto lg:flex-1 lg:max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes, starters, drinks..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 transition"
              />
            </div>

            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                vegOnly
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="w-3 h-3 border border-emerald-600 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              </span>
              Veg Only
            </button>
          </div>

          <div className="flex items-center gap-2 order-2 lg:order-3">
            {hasStaffSession && (
              <Link
                href="/dashboard"
                className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            )}

            <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-full text-xs font-extrabold tracking-wide shadow-sm">
              TABLE {tableNumber}
            </div>
          </div>
        </div>

        {menuItems.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full mb-2">
                <Flame className="w-3 h-3" /> Freshly Prepared • Table {tableNumber}
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold leading-snug">
                Welcome to {restaurant.name}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Apni pasandida dishes select karein, UPI se instant payment karein aur digital invoice download karein.
              </p>
            </div>
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 items-center justify-center shrink-0">
              <UtensilsCrossed className="w-7 h-7" />
            </div>
          </section>

          {orderSuccessToast && (
            <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Order Sent to Kitchen!</p>
                  <p className="text-xs text-emerald-100">
                    Chef ne aapka order receive kar liya hai. Digital bill neeche tracker se kabhi bhi download karein.
                  </p>
                </div>
              </div>
            </div>
          )}

          {menuItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                {restaurant.name} ka Menu Abhi Khali Hai
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                {hasStaffSession
                  ? 'Abhi tak is restaurant mein koi dish add nahi hui hai. Neeche button par click karke apni dishes aur prices add karein.'
                  : 'Digital menu abhi update ho raha hai. Kripya order ke liye staff se sampark karein.'}
              </p>

              {hasStaffSession && (
                <Link
                  href="/dashboard/menu"
                  className="mt-5 inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm transition"
                >
                  <Plus className="w-4 h-4" /> Add Dishes to Menu
                </Link>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <p className="text-sm font-semibold text-slate-600">
                Is filter ya search se koi dish nahi mili.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setVegOnly(false);
                  setSelectedCategory('All');
                }}
                className="mt-3 text-xs font-bold text-orange-600 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredItems.map((item) => {
                const inCart = cart[item.id];

                return (
                  <div
                    key={item.id}
                    className={`bg-white p-4 rounded-2xl border border-slate-200 hover:border-orange-200 shadow-sm flex items-center justify-between gap-3 transition ${
                      !item.is_available ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
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
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded truncate">
                          {item.category}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base truncate">{item.name}</h3>
                      <p className="font-extrabold text-orange-600 text-sm mt-0.5">₹{item.price}</p>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
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
              })}
            </section>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-32">
          {tableOrders.length > 0 && (
            <section className="bg-white border-2 border-orange-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Live Order Tracker
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {tableOrders.length} Active
                </span>
              </div>

              <div className="space-y-3">
                {tableOrders.map((ord) => {
                  const step =
                    ord.status === 'ready' || ord.status === 'served'
                      ? 3
                      : ord.status === 'preparing'
                      ? 2
                      : 1;
                  const isPaid = ord.payment_status === 'paid';

                  return (
                    <div
                      key={ord.id}
                      className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-slate-700 font-medium">
                          {ord.customer_name && (
                            <p className="text-[11px] font-extrabold text-slate-800 mb-0.5">
                              {ord.customer_name} •{' '}
                              {ord.invoice_number || getShortBillNumber(ord.id)}
                            </p>
                          )}
                          <p>
                            {ord.order_items?.map((i) => `${i.quantity}× ${i.item_name}`).join(', ')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="font-extrabold text-slate-900 text-sm">
                              ₹{ord.total_amount}
                            </p>
                            {isPaid && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Paid Online ✓
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1 shrink-0 ${
                            ord.status === 'ready' || ord.status === 'served'
                              ? 'bg-emerald-100 text-emerald-700'
                              : ord.status === 'preparing'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.status === 'ready' || ord.status === 'served' ? (
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

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-emerald-500"></div>
                          <p className="text-[10px] font-bold text-slate-600">1. Sent</p>
                        </div>
                        <div className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              step >= 2 ? 'bg-blue-500' : 'bg-slate-200'
                            }`}
                          ></div>
                          <p
                            className={`text-[10px] font-bold ${
                              step >= 2 ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          >
                            2. Cooking
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              step >= 3 ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                          ></div>
                          <p
                            className={`text-[10px] font-bold ${
                              step >= 3 ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            3. Ready
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setReceiptOrder(ord)}
                        className="w-full mt-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-extrabold text-[11px] py-2 rounded-lg flex items-center justify-center gap-1.5 transition"
                      >
                        <Receipt className="w-3.5 h-3.5 text-orange-600" />
                        <span>View / Download Bill Receipt</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="hidden lg:block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-600" /> Table {tableNumber} Cart
              </h3>
              <span className="text-xs font-bold text-slate-500">{totalCartItems} item(s)</span>
            </div>

            {cartEntries.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingBag className="w-9 h-9 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">Cart abhi khali hai</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Menu se + ADD dabakar items select karein
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-3">
                <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
                  {cartEntries.map(({ menuItem, quantity, notes }) => (
                    <div key={menuItem.id} className="bg-slate-50 p-3 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{menuItem.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            ₹{menuItem.price} × {quantity} = ₹{menuItem.price * quantity}
                          </p>
                        </div>

                        <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => removeFromCart(menuItem.id)}
                            className="p-1 text-slate-700 hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-bold text-xs">{quantity}</span>
                          <button
                            onClick={() => addToCart(menuItem)}
                            className="p-1 text-slate-700 hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => updateItemNote(menuItem.id, e.target.value)}
                        placeholder="Chef note (e.g. Less spicy)..."
                        className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] outline-none focus:border-orange-500 bg-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="bg-orange-50/70 border border-orange-200 p-3 rounded-xl space-y-2">
                  <p className="text-[11px] font-extrabold text-slate-800">
                    Your Details (For Bill & Invoice) *
                  </p>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="Your Full Name *"
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 focus:border-orange-500 rounded-lg text-xs font-semibold outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value.replace(/\D/g, ''));
                        if (formError) setFormError(null);
                      }}
                      placeholder="10-Digit Mobile Number *"
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 focus:border-orange-500 rounded-lg text-xs font-semibold outline-none"
                    />
                  </div>
                  {formError && (
                    <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formError}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between font-extrabold text-slate-900 text-sm">
                    <span>Total Payable</span>
                    <span>₹{totalCartPrice}</span>
                  </div>

                  <button
                    onClick={handleStartCustomerCheckout}
                    disabled={placingOrder}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {placingOrder
                        ? 'Processing...'
                        : hasAnyOnlinePayment
                        ? `Pay via UPI & Order (₹${totalCartPrice})`
                        : `Place Order (₹${totalCartPrice})`}
                    </span>
                  </button>

                  {hasAnyOnlinePayment && (
                    <button
                      onClick={handlePayAtCounterCustomer}
                      disabled={placingOrder}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition disabled:opacity-50"
                    >
                      Place Order & Pay at Counter
                    </button>
                  )}

                  {hasStaffSession && (
                    <button
                      onClick={handleDirectStaffOrder}
                      disabled={placingOrder}
                      className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold py-2 rounded-xl text-xs transition disabled:opacity-50"
                    >
                      Staff KOT Only (Skip Details)
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </aside>
      </main>

      {totalCartItems > 0 && (
        <div className="lg:hidden fixed bottom-4 left-0 right-0 px-4 z-40">
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
              Proceed to Pay &rarr;
            </span>
          </button>
        </div>
      )}

      {showCartModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Your Order • Table {tableNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Bill aur invoice ke liye apna naam aur mobile number bharein
                </p>
              </div>
              <button
                onClick={() => setShowCartModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3.5 space-y-3.5">
              <div className="bg-orange-50/80 border border-orange-200 p-3.5 rounded-2xl space-y-2.5">
                <p className="text-xs font-extrabold text-slate-900">
                  Customer Details (Mandatory) *
                </p>

                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter Your Full Name *"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>

                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    maxLength={10}
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value.replace(/\D/g, ''));
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter 10-Digit Mobile Number *"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-orange-500 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>

                {formError && (
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                  </p>
                )}
              </div>

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
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500 bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-base font-extrabold text-slate-900">
                <span>Total Payable</span>
                <span>₹{totalCartPrice}</span>
              </div>

              <button
                onClick={handleStartCustomerCheckout}
                disabled={placingOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {placingOrder
                    ? 'Processing...'
                    : hasAnyOnlinePayment
                    ? `Pay via UPI & Order (₹${totalCartPrice})`
                    : `Place Order (₹${totalCartPrice})`}
                </span>
              </button>

              {hasAnyOnlinePayment && (
                <button
                  onClick={handlePayAtCounterCustomer}
                  disabled={placingOrder}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
                >
                  Place Order & Pay at Counter
                </button>
              )}

              {hasStaffSession && (
                <button
                  onClick={handleDirectStaffOrder}
                  disabled={placingOrder}
                  className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold py-2 rounded-xl text-xs transition disabled:opacity-50"
                >
                  Staff KOT Only (Skip Details)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpiPayModal && merchantUpiId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Pay ₹{totalCartPrice} via UPI
                </h3>
                <p className="text-xs text-slate-500">
                  Direct to <strong>{merchantDisplayName}</strong> (0% Extra Fee)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpiPayModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <a
              href={upiDeepLink}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition"
            >
              <Smartphone className="w-4 h-4" />
              <span>Open GPay / PhonePe / Paytm (₹{totalCartPrice})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2.5">
              <p className="text-[11px] font-bold text-slate-600">
                Ya kisi bhi UPI App se yeh QR Code scan karein:
              </p>
              {dynamicQrImageUrl && (
                <img
                  src={dynamicQrImageUrl}
                  alt="Merchant UPI QR Code"
                  className="w-44 h-44 mx-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
                />
              )}

              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                  {merchantUpiId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                >
                  {upiCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  UPI Transaction / UTR Ref No. (Optional — Fast Verification Ke Liye)
                </label>
                <input
                  type="text"
                  value={upiUtrInput}
                  onChange={(e) => setUpiUtrInput(e.target.value)}
                  placeholder="e.g. 632819402184 (Last 4-12 digits)"
                  className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-emerald-500 rounded-xl text-xs font-mono font-semibold outline-none"
                />
              </div>

              <button
                type="button"
                disabled={placingOrder}
                onClick={handleConfirmMerchantUpiPaid}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {placingOrder
                    ? 'Sending Order...'
                    : 'I Have Completed Payment • Place Order ✓'}
                </span>
              </button>

              <button
                type="button"
                disabled={placingOrder}
                onClick={handlePayAtCounterCustomer}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Payment Failed? Pay at Counter Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptOrder && (
        <div
          id="receipt-modal-backdrop"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div
            id="printable-customer-receipt"
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-4"
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-4 relative">
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="no-print absolute right-0 top-0 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">{restaurant.name}</h3>
              <p className="text-xs text-slate-500">{restaurant.city}</p>
              <span className="inline-block mt-2 text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {receiptOrder.payment_status === 'paid' ? 'PAID TAX INVOICE ✓' : 'ORDER RECEIPT'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 text-xs space-y-1.5 border border-slate-200/80">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice No:</span>
                <span className="font-extrabold text-slate-900">
                  {receiptOrder.invoice_number ||
                    `INV-${receiptOrder.id.slice(0, 8).toUpperCase()}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bill No:</span>
                <span className="font-extrabold text-slate-900">
                  {getShortBillNumber(receiptOrder.id)}
                </span>
              </div>
              {receiptOrder.razorpay_payment_id && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 shrink-0">Payment / UTR Ref:</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] break-all text-right">
                    {receiptOrder.razorpay_payment_id}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Table:</span>
                <span className="font-bold text-slate-900">Table {tableNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">
                  {receiptOrder.customer_name || customerName || 'Walk-in Guest'}
                </span>
              </div>
              {(receiptOrder.customer_phone || customerPhone) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Mobile:</span>
                  <span className="font-bold text-slate-900">
                    +91 {receiptOrder.customer_phone || customerPhone}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span className="font-semibold text-slate-700">
                  {new Date(receiptOrder.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2">
              <div className="flex justify-between text-[11px] font-extrabold uppercase text-slate-400">
                <span>Item</span>
                <span>Amount</span>
              </div>
              {receiptOrder.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-slate-800">
                  <span>
                    <strong>{item.quantity}×</strong> {item.item_name}
                  </span>
                  <span className="font-bold">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-base font-extrabold text-slate-900">
              <span>Grand Total Paid</span>
              <span className="text-emerald-700">₹{receiptOrder.total_amount}</span>
            </div>

            <p className="text-[11px] text-center text-slate-400">
              Thank you for dining at {restaurant.name}! Save or screenshot this receipt for your reference.
            </p>

            <div className="no-print grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold py-3 rounded-xl text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-slate-500 font-medium">Loading Digital Menu...</p>
        </div>
      }
    >
      <CustomerOrderContent />
    </Suspense>
  );
}