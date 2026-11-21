'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Plus,
  Trash2,
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  city: string;
  totalTables: number;
  role: 'owner' | 'staff';
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

const DEFAULT_CATEGORIES = [
  'Starters',
  'Main Course',
  'Fast Food',
  'Breads & Rice',
  'Beverages',
  'Desserts',
];

export default function MenuManagerPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Add Item Form States
  const [form, setForm] = useState({
    category: 'Main Course',
    name: '',
    description: '',
    price: '',
    is_veg: true,
  });
  const [saving, setSaving] = useState(false);

  // 1. Verify Owner Session
  useEffect(() => {
    const saved = localStorage.getItem('restro_session');
    if (!saved) {
      router.push('/');
      return;
    }
    const parsed: SessionData = JSON.parse(saved);
    if (parsed.role !== 'owner') {
      router.push('/dashboard');
      return;
    }
    setSession(parsed);
  }, [router]);

  // 2. Fetch Menu Items
  const fetchMenu = useCallback(async (restaurantId: string) => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMenuItems(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) {
      fetchMenu(session.restaurantId);
    }
  }, [session, fetchMenu]);

  // 3. Add New Dish
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !form.name.trim() || !form.price) return;

    setSaving(true);
    const { error } = await supabase.from('menu_items').insert([
      {
        restaurant_id: session.restaurantId,
        category: form.category.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        is_veg: form.is_veg,
        is_available: true,
      },
    ]);

    setSaving(false);

    if (!error) {
      setForm({
        ...form,
        name: '',
        description: '',
        price: '',
      });
      fetchMenu(session.restaurantId);
    }
  };

  // 4. Toggle In-Stock / Out-of-Stock
  const toggleAvailability = async (item: MenuItem) => {
    if (!session) return;
    await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);

    fetchMenu(session.restaurantId);
  };

  // 5. Delete Dish
  const handleDelete = async (id: string) => {
    if (!session) return;
    await supabase.from('menu_items').delete().eq('id', id);
    fetchMenu(session.restaurantId);
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Loading Menu Manager...</p>
      </div>
    );
  }

  const filteredItems = menuItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Menu & Prices</h1>
              <p className="text-xs text-slate-500">{session.restaurantName}</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
            {menuItems.length} Items
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add Dish Form */}
        <section className="lg:col-span-1">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-orange-600" />
              <h2 className="font-bold text-slate-900">Add New Dish</h2>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <input
                  list="categories-list"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Select or type category"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                />
                <datalist id="categories-list">
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Paneer Tikka Masala"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="e.g., 240"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ingredients / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g., Rich tomato gravy, soft cottage cheese, served with mint chutney"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-orange-500 outline-none resize-none"
                />
              </div>

              {/* Veg / Non-Veg Selector */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_veg: true })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    form.is_veg
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="w-3 h-3 border border-emerald-600 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  </span>
                  Pure Veg
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_veg: false })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    !form.is_veg
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="w-3 h-3 border border-red-600 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                  </span>
                  Non-Veg
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Adding...' : 'Add to Menu'}
              </button>
            </form>
          </div>
        </section>

        {/* Right Column: Existing Menu List */}
        <section className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search added dishes or categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <p className="text-slate-500 text-sm">
                Abhi tak koi dish add nahi hui hai. Left form se apni pehli dish add karein!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white p-4 rounded-2xl border flex items-center justify-between gap-4 transition ${
                    item.is_available ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Veg / Non-Veg Symbol */}
                    <span
                      className={`mt-1 w-4 h-4 border flex items-center justify-center shrink-0 ${
                        item.is_veg ? 'border-emerald-600' : 'border-red-600'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                      ></span>
                    </span>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900">{item.name}</h3>
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-sm font-extrabold text-slate-900 mt-1">₹{item.price}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAvailability(item)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                        item.is_available
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {item.is_available ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Sold Out
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete Dish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}