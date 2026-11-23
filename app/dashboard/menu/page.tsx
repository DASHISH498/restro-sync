'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Search,
  UtensilsCrossed,
  AlertTriangle,
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

const CATEGORIES = [
  'Starters',
  'Fast Food',
  'Main Course',
  'Breads & Rice',
  'Beverages',
  'Desserts',
];

export default function MenuManagerPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add New Dish Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Fast Food');
  const [description, setDescription] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [adding, setAdding] = useState(false);

  // Edit Dish Modal States
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsVeg, setEditIsVeg] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Custom Delete Confirmation Modal States
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchMenu = useCallback(async (restaurantId: string) => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) {
      fetchMenu(session.restaurantId);
    }
  }, [session, fetchMenu]);

  // Add New Dish
  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || session.role !== 'owner' || !name.trim() || !price) return;

    setAdding(true);
    const { error } = await supabase.from('menu_items').insert([
      {
        restaurant_id: session.restaurantId,
        name: name.trim(),
        price: Number(price),
        category,
        description: description.trim() || null,
        is_veg: isVeg,
        is_available: true,
      },
    ]);

    setAdding(false);
    if (!error) {
      setName('');
      setPrice('');
      setDescription('');
      fetchMenu(session.restaurantId);
    }
  };

  // Open Edit Modal
  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditCategory(item.category);
    setEditDescription(item.description || '');
    setEditIsVeg(item.is_veg);
  };

  // Save Edited Dish
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || session.role !== 'owner' || !editingItem || !editName.trim() || !editPrice)
      return;

    setSavingEdit(true);
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: editName.trim(),
        price: Number(editPrice),
        category: editCategory,
        description: editDescription.trim() || null,
        is_veg: editIsVeg,
      })
      .eq('id', editingItem.id);

    setSavingEdit(false);
    if (!error) {
      setEditingItem(null);
      fetchMenu(session.restaurantId);
    }
  };

  // Toggle Availability (In Stock / Sold Out)
  const handleToggleStock = async (item: MenuItem) => {
    if (!session || session.role !== 'owner') return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);

    if (!error) {
      fetchMenu(session.restaurantId);
    }
  };

  // Confirm & Execute Delete (Safely detaches past order history reference first)
  const confirmDeleteDish = async () => {
    if (!session || session.role !== 'owner' || !deletingItem) return;
    setIsDeleting(true);

    // 1. Detach foreign key from past order_items so historical bills stay intact
    await supabase
      .from('order_items')
      .update({ menu_item_id: null })
      .eq('menu_item_id', deletingItem.id);

    // 2. Delete the dish from menu_items
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', deletingItem.id);

    setIsDeleting(false);

    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      setDeletingItem(null);
    }
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Loading Menu Manager...</p>
      </div>
    );
  }

  const isOwnerWeb = session.role === 'owner';

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Menu & Prices Manager</h1>
              <p className="text-xs text-slate-500">
                {session.restaurantName} • {items.length} Total Dishes
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Add New Dish Form (Owner + Desktop Web Only Sticky) */}
        <section
          className={`bg-white border border-slate-200 rounded-2xl p-5 h-fit shadow-sm ${
            isOwnerWeb ? 'lg:sticky lg:top-24' : ''
          }`}
        >
          <h2 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-600" /> Add New Dish
          </h2>

          <form onSubmit={handleAddDish} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dish Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Paneer Tikka Masala"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="180"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Short Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Served with green chutney & onions"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-orange-500"
              />
            </div>

            {/* Veg / Non-Veg Selector */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsVeg(true)}
                className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  isVeg
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <span className="w-3 h-3 border border-emerald-600 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                </span>
                Pure Veg
              </button>

              <button
                type="button"
                onClick={() => setIsVeg(false)}
                className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  !isVeg
                    ? 'bg-red-50 border-red-600 text-red-700'
                    : 'bg-white border-slate-200 text-slate-600'
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
              disabled={adding}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-sm transition disabled:opacity-50"
            >
              {adding ? 'Adding Dish...' : '+ Add to Menu'}
            </button>
          </form>
        </section>

        {/* Right Column: Search Bar (Owner + Desktop Web Only Sticky) + Existing Menu Items List */}
        <section className="lg:col-span-2 space-y-2">
          <div
            className={
              isOwnerWeb
                ? 'lg:sticky lg:top-20 lg:z-20 pt-3 pb-3 bg-slate-50'
                : 'pt-1 pb-2'
            }
          >
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes by name or category..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm shadow-xs outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Koi dish nahi mili.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div>
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
                      <span className="text-[11px] font-bold uppercase text-slate-400">
                        {item.category}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                    <p className="font-extrabold text-orange-600 text-sm">₹{item.price}</p>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    )}
                  </div>

                  {/* Actions: Stock Toggle + Edit + Delete */}
                  <div className="flex items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <button
                      onClick={() => handleToggleStock(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        item.is_available
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {item.is_available ? 'In Stock' : 'Sold Out'}
                    </button>

                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                      title="Edit Dish"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeletingItem(item)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
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

      {/* EDIT DISH MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingItem(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> Edit Dish
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditIsVeg(true)}
                  className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    editIsVeg
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Pure Veg
                </button>

                <button
                  type="button"
                  onClick={() => setEditIsVeg(false)}
                  className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    !editIsVeg
                      ? 'bg-red-50 border-red-600 text-red-700'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Non-Veg
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Delete Dish?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Kya aap sach mein <strong className="text-slate-800">{deletingItem.name}</strong> ko
              menu se hatana chahte hain?
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDish}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}