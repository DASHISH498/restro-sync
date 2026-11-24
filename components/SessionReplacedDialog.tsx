'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';

interface SessionReplacedDialogProps {
  open: boolean;
  role: 'owner' | 'staff';
  onComplete: () => void;
}

export default function SessionReplacedDialog({
  open,
  role,
  onComplete,
}: SessionReplacedDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(5);
      return;
    }

    setSecondsLeft(5);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 5 - elapsedSec);
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [open]);

  if (!open) return null;

  const roleLabel = role === 'owner' ? 'Owner' : 'Staff';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-replaced-title"
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[1000]"
    >
      <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h3
            id="session-replaced-title"
            className="text-lg font-extrabold text-slate-900"
          >
            {roleLabel} Session Logged Out
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            This {roleLabel.toLowerCase()} account was signed in on another device. Please login
            again or change your PIN.
          </p>
        </div>

        <div className="bg-slate-100 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl">
          Redirecting to login in{' '}
          <span className="text-orange-600 font-extrabold">{secondsLeft}s</span>...
        </div>

        <button
          type="button"
          onClick={() => onCompleteRef.current()}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-1.5"
        >
          <span>Login Again Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}