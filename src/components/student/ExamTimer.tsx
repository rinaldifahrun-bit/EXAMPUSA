import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ExamTimerProps {
  expiresAt: string;
  serverExpiresTime?: number;
  serverTimeOffset?: number;
  onExpire: () => void;
  onTamperDetected?: (tamperMessage: string) => void;
}

export const ExamTimer: React.FC<ExamTimerProps> = ({
  expiresAt,
  serverExpiresTime,
  serverTimeOffset = 0,
  onExpire,
  onTamperDetected
}) => {
  // Target expiration epoch ms
  const targetExpiresMs = serverExpiresTime || new Date(expiresAt).getTime();

  // Monotonic references
  const perfNowRef = useRef<number>(performance.now());
  const initialClientTimeRef = useRef<number>(Date.now());
  const serverOffsetRef = useRef<number>(serverTimeOffset);
  const [tamperWarning, setTamperWarning] = useState<string | null>(null);

  // Compute remaining seconds monotonically
  const calculateSecondsLeft = () => {
    const elapsedMs = performance.now() - perfNowRef.current;
    const currentEstimatedServerTime = initialClientTimeRef.current + serverOffsetRef.current + elapsedMs;
    const remainingMs = targetExpiresMs - currentEstimatedServerTime;
    return Math.max(0, Math.floor(remainingMs / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateSecondsLeft);

  // Periodic server clock synchronization
  useEffect(() => {
    let isMounted = true;
    const syncWithServer = async () => {
      try {
        const res = await fetch('/api/time');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (typeof data.serverTime === 'number') {
            const currentClientTime = Date.now();
            serverOffsetRef.current = data.serverTime - currentClientTime;
          }
        }
      } catch {
        // Network silent fallback
      }
    };

    const syncInterval = setInterval(syncWithServer, 60000);
    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, []);

  // Main tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Tamper detection: check if local system clock Date.now() was moved forward or back by > 30s
      const expectedClientNow = initialClientTimeRef.current + (performance.now() - perfNowRef.current);
      const actualClientNow = Date.now();
      const clockSkew = Math.abs(actualClientNow - expectedClientNow);

      if (clockSkew > 30000 && !tamperWarning) {
        const msg = 'Deteksi perubahan jam lokal. Sistem mengunci timer berdasarkan waktu server.';
        setTamperWarning(msg);
        onTamperDetected?.(msg);
      }

      const diff = calculateSecondsLeft();

      if (diff <= 0) {
        setSecondsLeft(0);
        clearInterval(interval);
        onExpire();
      } else {
        setSecondsLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, serverExpiresTime, onExpire]);

  // Format hours, minutes, seconds
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeFormatted =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  const isCritical = secondsLeft <= 300; // <= 5 minutes
  const isWarning = secondsLeft <= 600 && !isCritical; // <= 10 minutes

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold font-mono tracking-wider transition shadow-2xs ${
          isCritical
            ? 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
            : isWarning
            ? 'bg-amber-50 text-amber-800 border border-amber-300'
            : 'bg-slate-100 text-slate-800 border border-slate-200'
        }`}
        title="Waktu pengerjaan tersisa (Server Authoritative & Monotonic Protection)"
      >
        <Clock className={`w-3.5 h-3.5 ${isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}`} />
        <span>{timeFormatted}</span>
        {isCritical && <span className="text-[10px] uppercase font-sans font-extrabold text-rose-600">Sisa &lt; 5m</span>}
      </div>

      {tamperWarning && (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold"
          title={tamperWarning}
        >
          <AlertTriangle className="w-3 h-3 text-amber-700" />
          <span>Server Lock</span>
        </span>
      )}
    </div>
  );
};
