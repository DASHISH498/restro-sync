'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowLeft,
  Printer,
  ExternalLink,
  Copy,
  Check,
  UtensilsCrossed,
} from 'lucide-react';

interface SessionData {
  restaurantId: string;
  restaurantName: string;
  city: string;
  totalTables: number;
  role: 'owner' | 'staff';
}

export default function TableQRCodesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [origin, setOrigin] = useState('');
  const [copiedTable, setCopiedTable] = useState<number | null>(null);

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
    setOrigin(window.location.origin);
  }, [router]);

  const handleCopyUrl = (tableNum: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedTable(tableNum);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  if (!session || !origin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Generating Table QR Codes...</p>
      </div>
    );
  }

  const tablesArray = Array.from({ length: session.totalTables }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 print:bg-white print:pb-0">
      {/* Header (Hidden when printing) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Table QR Codes</h1>
              <p className="text-xs text-slate-500">
                {session.restaurantName} • {session.totalTables} Tables
              </p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            Print All QRs
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 print:pt-2">
        {/* Instruction Banner (Hidden when printing) */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-sm font-bold text-orange-900">
              Scan to Order — Ready for Every Table
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              &ldquo;Print All QRs&rdquo; dabakar PDF save/print karein, ya kisi bhi table ka{' '}
              <strong>Test Menu</strong> kholkar customer ordering check karein.
            </p>
          </div>
        </div>

        {/* QR Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
          {tablesArray.map((tableNum) => {
            const tableOrderUrl = `${origin}/order/${session.restaurantId}/${tableNum}`;

            return (
              <div
                key={tableNum}
                className="bg-white border-2 border-slate-200 rounded-3xl p-6 flex flex-col items-center text-center shadow-sm break-inside-avoid print:border-slate-400 print:shadow-none print:rounded-2xl print:p-4"
              >
                {/* Restaurant Branding */}
                <div className="flex items-center gap-1.5 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>{session.restaurantName}</span>
                </div>

                {/* Table Badge */}
                <div className="bg-slate-900 text-white font-extrabold text-lg px-5 py-1 rounded-full mb-4">
                  TABLE {tableNum}
                </div>

                {/* QR Code */}
                <div className="p-3 bg-white border border-slate-200 rounded-2xl mb-4">
                  <QRCodeCanvas
                    value={tableOrderUrl}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    level="H"
                  />
                </div>

                <p className="text-xs font-bold text-slate-800">Scan to View Menu & Order</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-4 print:mb-0">
                  No app download needed
                </p>

                {/* Action Buttons (Hidden when printing) */}
                <div className="w-full grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 print:hidden">
                  <button
                    onClick={() => handleCopyUrl(tableNum, tableOrderUrl)}
                    className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition"
                  >
                    {copiedTable === tableNum ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </button>

                  <a
                    href={tableOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Test Menu
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}