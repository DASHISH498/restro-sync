"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Camera,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  Upload,
} from "lucide-react";

interface DraftMenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  selected: boolean;
}

interface MenuPhotoImporterProps {
  restaurantId: string;
  onImported: () => void;
}

export default function MenuPhotoImporter({
  restaurantId,
  onImported,
}: MenuPhotoImporterProps) {
  const [fileName, setFileName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("image/jpeg");

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftMenuItem[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setStatusMsg(null);
    setDraftItems([]);

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid menu image (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg("Image size should be under 6 MB.");
      return;
    }

    setFileName(file.name);
    setMimeType(file.type || "image/jpeg");

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64Part = result.includes(",") ? result.split(",")[1] : result;
      setImageBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleScanPhoto = async () => {
    if (!imageBase64) {
      setErrorMsg("Pehle menu ki photo upload karein.");
      return;
    }

    setScanning(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/menu/extract-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Photo scan nahi ho payi.");
        setScanning(false);
        return;
      }

      const extracted: DraftMenuItem[] = (data.items || []).map(
        (
          item: {
            name: string;
            category: string;
            price: number;
            is_veg: boolean;
          },
          index: number,
        ) => ({
          id: `${Date.now()}-${index}`,
          name: item.name,
          category: item.category || "General",
          price: Number(item.price) || 0,
          is_veg: Boolean(item.is_veg),
          selected: true,
        }),
      );

      if (extracted.length === 0) {
        setErrorMsg(
          "Photo se clear dishes detect nahi huin. Thodi clear/bright photo try karein.",
        );
      } else {
        setDraftItems(extracted);
        setStatusMsg(
          `${extracted.length} items detected! Add karne se pehle price/category check kar lein.`,
        );
      }
    } catch {
      setErrorMsg("Network error while analyzing photo.");
    } finally {
      setScanning(false);
    }
  };

  const handleSaveSelectedToMenu = async () => {
    const chosen = draftItems.filter(
      (d) => d.selected && d.name.trim().length > 0 && d.price > 0,
    );

    if (chosen.length === 0) {
      setErrorMsg(
        "Kam se kam 1 item select karein jiska dish name aur valid price (> ₹0) ho.",
      );
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const rowsToInsert = chosen.map((item) => ({
      restaurant_id: restaurantId,
      name: item.name.trim(),
      category: item.category.trim() || "General",
      price: Number(item.price),
      is_veg: item.is_veg,
      is_available: true,
    }));

    const { error } = await supabase.from("menu_items").insert(rowsToInsert);
    setSaving(false);

    if (error) {
      setErrorMsg(error.message || "Menu items save karne mein dikkat aayi.");
      return;
    }

    setDraftItems([]);
    setStatusMsg(
      `${rowsToInsert.length} items successfully menu mein add ho gaye!`,
    );
    onImported();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4 w-full min-w-0 overflow-hidden">
      <div className="min-w-0">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Camera className="w-4 h-4 text-orange-600 shrink-0" />
          <span className="truncate">Auto-Add Menu from Photo (AI Scan)</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          Menu card ya printed list ki photo upload karein — dish name, price
          aur category apne aap nikal aayenge.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        <label className="w-full min-w-0 cursor-pointer border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl px-3.5 py-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-slate-50/70 transition">
          <Upload className="w-4 h-4 text-orange-600 shrink-0" />
          <span className="truncate">
            {fileName ? `Selected: ${fileName}` : "Upload Menu Photo (JPG / PNG)"}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <button
          type="button"
          disabled={!imageBase64 || scanning}
          onClick={handleScanPhoto}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-3 rounded-2xl flex items-center justify-center gap-1.5 whitespace-nowrap transition"
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Scanning...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Extract Menu Items</span>
            </>
          )}
        </button>
      </div>

      {previewUrl && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 min-w-0">
          <img
            src={previewUrl}
            alt="Menu preview"
            className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
          />
          <p className="text-[11px] text-slate-600 leading-snug">
            Clear lighting aur seedhi photo se dish name aur price zyada
            accurate aate hain.
          </p>
        </div>
      )}

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {draftItems.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-slate-100 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-slate-800">
              Review ({draftItems.filter((i) => i.selected).length} selected)
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveSelectedToMenu}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition"
            >
              {saving ? "Saving..." : "+ Add Selected"}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {draftItems.map((item) => (
              <div
                key={item.id}
                className="border border-slate-200 rounded-2xl p-2.5 flex flex-wrap items-center gap-2 bg-slate-50/50 text-xs min-w-0"
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={(e) =>
                    setDraftItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? { ...row, selected: e.target.checked }
                          : row,
                      ),
                    )
                  }
                  className="w-4 h-4 accent-orange-600 shrink-0"
                />

                <input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    setDraftItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? { ...row, name: e.target.value }
                          : row,
                      ),
                    )
                  }
                  placeholder="Dish Name"
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold outline-none"
                />

                <input
                  type="text"
                  value={item.category}
                  onChange={(e) =>
                    setDraftItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? { ...row, category: e.target.value }
                          : row,
                      ),
                    )
                  }
                  placeholder="Category"
                  className="w-28 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold outline-none"
                />

                <input
                  type="number"
                  min={1}
                  value={item.price || ""}
                  onChange={(e) =>
                    setDraftItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? { ...row, price: Number(e.target.value) || 0 }
                          : row,
                      ),
                    )
                  }
                  placeholder="₹ Price"
                  className="w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-extrabold outline-none"
                />

                <button
                  type="button"
                  onClick={() =>
                    setDraftItems((prev) =>
                      prev.filter((row) => row.id !== item.id),
                    )
                  }
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}