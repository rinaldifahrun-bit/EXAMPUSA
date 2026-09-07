import React, { useState, useEffect } from 'react';
import type { Exam, SecurityEvent } from '../../types';
import { getStoredSecurityEvents } from '../../services/securityEventService';
import { mockStudents } from '../../data/mockData';
import {
  ShieldAlert,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  RefreshCw,
  Maximize,
  Minimize,
  WifiOff
} from 'lucide-react';

interface ExamMonitoringViewProps {
  exam: Exam;
  onBack: () => void;
}

export const ExamMonitoringView: React.FC<ExamMonitoringViewProps> = ({
  exam,
  onBack
}) => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(true);

  const loadEvents = () => {
    const events = getStoredSecurityEvents();
    setSecurityEvents(events.filter((e) => e.exam_id === exam.id || true));
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 3000);
    return () => clearInterval(interval);
  }, [exam.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Daftar Ujian
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Pemantauan Ruang Ujian Real-Time
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              Live Monitoring
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ujian: <span className="text-slate-900 font-medium">{exam.title}</span> • PIN Token: <span className="font-mono text-amber-700 font-bold">{exam.pin}</span>
          </p>
        </div>

        <button
          onClick={loadEvents}
          className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Segarkan Data
        </button>
      </div>

      {/* Grid: Live Student Status & Security Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Student Status Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Status Pengerjaan Peserta</span>
              <span className="text-[10px] text-slate-400">8 Peserta Terdaftar</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mockStudents.map((s, idx) => {
                const isDone = idx < 4;
                const isWorking = idx >= 4 && idx < 7;
                return (
                  <div
                    key={s.uid}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{s.displayName}</p>
                      <p className="text-[10px] text-slate-500">
                        NIS: {s.nis} • Kelas {s.className}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {isDone ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                          Sudah Submit
                        </span>
                      ) : isWorking ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                          Mengerjakan
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          Belum Masuk
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 cols: Security Violation Logs Stream */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Log Keamanan & Pelanggaran (Security Events)
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {securityEvents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Belum ada log pelanggaran yang terdeteksi.
                </div>
              ) : (
                securityEvents.map((evt) => {
                  const time = new Date(evt.created_at).toLocaleTimeString('id-ID');
                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        evt.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{evt.student_name || 'Murid'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{time}</span>
                      </div>
                      <p className="text-[11px] font-mono opacity-90">
                        Event: <span className="font-bold">{evt.event_type}</span>
                      </p>
                      {evt.metadata?.details && (
                        <p className="text-[10px] text-slate-500">{evt.metadata.details}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
