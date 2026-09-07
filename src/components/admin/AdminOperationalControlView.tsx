import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Clock,
  KeyRound,
  RefreshCw,
  Unlock,
  Send,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  User,
  School,
  BookOpen,
  Calendar,
  Lock,
  Copy,
  Check,
  FileSpreadsheet,
  HelpCircle,
  Activity,
  History
} from 'lucide-react';
import type { Exam, ExamSession } from '../../types';
import {
  fetchOperationalSessions,
  unlockStudentSession,
  forceSubmitStudentSession,
  regenerateExamToken,
  addEmergencyTime,
  fetchOperationalAuditLogs,
  type EnrichedOperationalSession,
  type OperationalAuditLog
} from '../../services/adminOperationalService';
import { useToast } from '../../context/ToastContext';

interface AdminOperationalControlViewProps {
  exams: Exam[];
  adminId?: string;
  adminName?: string;
  onRefreshExams?: () => void;
}

export const AdminOperationalControlView: React.FC<AdminOperationalControlViewProps> = ({
  exams,
  adminId = 'admin_1',
  adminName = 'Administrator EXAMPUSA',
  onRefreshExams
}) => {
  const { success, error, info } = useToast();

  // Selected Exam
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [sessions, setSessions] = useState<EnrichedOperationalSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<OperationalAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString('id-ID'));

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'locked' | 'submitted'>('all');

  // Confirmation Modals State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'token' | 'time' | 'unlock' | 'force_submit' | null;
    targetId?: string;
    targetTitle?: string;
    extraData?: any;
  }>({
    isOpen: false,
    type: null
  });

  const [copiedToken, setCopiedToken] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Active / Selected exam details
  const activeExam = useMemo(() => {
    if (!selectedExamId || selectedExamId === 'all') return null;
    return exams.find(e => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Load Sessions Data
  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const [fetchedSessions, logs] = await Promise.all([
        fetchOperationalSessions(selectedExamId, adminId, adminName),
        fetchOperationalAuditLogs(adminId, adminName)
      ]);
      setSessions(fetchedSessions);
      setAuditLogs(logs);
      setLastRefreshedAt(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.error('[AdminOperationalControlView] Failed loading data:', err);
      if (!quiet) error('Gagal memuat data sesi murid.');
    } finally {
      if (!quiet) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedExamId, adminId, adminName, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Copy Token
  const handleCopyToken = (token: string) => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    success('Token berhasil disalin ke clipboard!', 'Tersalin');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Execution Handlers
  const handleExecuteRegenerateToken = async () => {
    if (!activeExam) return;
    setActionLoading(true);
    try {
      const res = await regenerateExamToken(activeExam.id, adminId, adminName);
      success(`Token baru: ${res.newToken}`, 'Token Diperbarui');
      onRefreshExams?.();
      await loadData(true);
      setConfirmModal({ isOpen: false, type: null });
    } catch (err: any) {
      error(err.message || 'Gagal meregenerasi token ujian.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteEmergencyTime = async (minutes: number) => {
    if (!activeExam) return;
    setActionLoading(true);
    try {
      const res = await addEmergencyTime(activeExam.id, minutes, adminId, adminName);
      success(res.message, 'Durasi Ditambahkan');
      onRefreshExams?.();
      await loadData(true);
      setConfirmModal({ isOpen: false, type: null });
    } catch (err: any) {
      error(err.message || 'Gagal menambahkan durasi darurat.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteUnlockSession = async (sessionId: string) => {
    setActionLoading(true);
    try {
      const res = await unlockStudentSession(sessionId, adminId, adminName);
      success(res.message, 'Kunci Sesi Dibuka');
      await loadData(true);
      setConfirmModal({ isOpen: false, type: null });
    } catch (err: any) {
      error(err.message || 'Gagal membuka kunci sesi murid.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteForceSubmit = async (sessionId: string) => {
    setActionLoading(true);
    try {
      const res = await forceSubmitStudentSession(sessionId, adminId, adminName);
      success(res.message, 'Sesi Dikumpulkan');
      await loadData(true);
      setConfirmModal({ isOpen: false, type: null });
    } catch (err: any) {
      error(err.message || 'Gagal memaksakan pengumpulan sesi.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(sess => {
      // Status Filter
      if (statusFilter === 'in_progress') {
        if (sess.status !== 'IN_PROGRESS' && sess.status !== 'in_progress') return false;
      } else if (statusFilter === 'locked') {
        if (!sess.isLocked) return false;
      } else if (statusFilter === 'submitted') {
        if (sess.status !== 'SUBMITTED' && sess.status !== 'submitted') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sName = (sess.studentName || sess.student_name || '').toLowerCase();
        const sNum = (sess.examNumber || sess.student_nis || '').toLowerCase();
        const sClass = (sess.studentClass || sess.student_class || '').toLowerCase();
        const eTitle = (sess.examTitle || '').toLowerCase();
        return sName.includes(q) || sNum.includes(q) || sClass.includes(q) || eTitle.includes(q);
      }

      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Bantuan Operasional & Pemulihan Sesi
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Admin Control • Stage 8.3
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola kendali darurat ujian aktif, regenerasi token PIN, dan pulihkan sesi siswa yang terputus tanpa membebani server.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center">
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Sinkron: {lastRefreshedAt}
          </span>
          <button
            onClick={() => {
              setIsRefreshing(true);
              loadData(false);
            }}
            disabled={isRefreshing || isLoading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Muat ulang data sesi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Filter Exam Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 shrink-0">Pilih Paket Ujian:</span>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-80 cursor-pointer"
          >
            <option value="all">-- Semua Paket Ujian ({exams.length}) --</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                [{ex.status || 'DRAFT'}] {ex.title} ({ex.className || 'Umum'})
              </option>
            ))}
          </select>
        </div>

        {activeExam && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Guru Pengampu:</span>
            <span className="font-bold text-slate-800">
              {activeExam.ownerName || activeExam.owner_name || 'Bpk/Ibu Guru'}
            </span>
          </div>
        )}
      </div>

      {/* Emergency Control Card (Only visible when a specific exam is selected) */}
      {activeExam && (
        <div className="bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
                Kendali Operasional Ujian
              </span>
              <h3 className="text-lg font-black tracking-tight">{activeExam.title}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Mata Pelajaran: <span className="font-semibold text-white">{activeExam.subjectName}</span> • Kelas: <span className="font-semibold text-white">{activeExam.className}</span> • Durasi: <span className="font-semibold text-amber-300">{activeExam.durationMinutes} Menit</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                activeExam.status === 'ACTIVE'
                  ? 'bg-emerald-500 text-white'
                  : activeExam.status === 'SCHEDULED'
                  ? 'bg-blue-500 text-white'
                  : activeExam.status === 'CANCELLED'
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-700 text-slate-200'
              }`}>
                {activeExam.status || 'DRAFT'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* PIN Token Management */}
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Token PIN Ujian Aktif
                  </span>
                  <button
                    onClick={() => handleCopyToken(activeExam.pin || activeExam.examToken || '')}
                    className="text-[11px] text-blue-200 hover:text-white flex items-center gap-1 font-semibold transition cursor-pointer"
                  >
                    {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedToken ? 'Tersalin' : 'Salin Token'}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-2xl font-black tracking-widest text-amber-300 bg-black/30 px-3 py-1 rounded-lg border border-amber-500/30">
                    {activeExam.pin || activeExam.examToken || 'BELUM DISET'}
                  </span>
                  <button
                    onClick={() => setConfirmModal({ isOpen: true, type: 'token', targetId: activeExam.id, targetTitle: activeExam.title })}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerasi Token</span>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 mt-2">
                Gunakan jika token lama bocor ke rombel lain. Token baru langsung aktif di server dan wajib diumumkan ke siswa.
              </p>
            </div>

            {/* Emergency Duration Extender */}
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Perpanjangan Waktu Darurat (Massal)
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setConfirmModal({
                      isOpen: true,
                      type: 'time',
                      targetId: activeExam.id,
                      targetTitle: activeExam.title,
                      extraData: { minutes: 15 }
                    })}
                    className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>+15 Menit Darurat</span>
                  </button>
                  <button
                    onClick={() => setConfirmModal({
                      isOpen: true,
                      type: 'time',
                      targetId: activeExam.id,
                      targetTitle: activeExam.title,
                      extraData: { minutes: 30 }
                    })}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>+30 Menit Darurat</span>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 mt-2">
                Memperpanjang durasi paket ujian dan secara otomatis menambah batas waktu (expiresAt) seluruh sesi murid yang sedang berjalan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Monitor Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Filter & Search Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Nama / No. Ujian..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status ({sessions.length})</option>
              <option value="in_progress">Mengerjakan</option>
              <option value="locked">Terkunci</option>
              <option value="submitted">Sudah Kumpul</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-semibold self-end sm:self-center">
            Menampilkan <strong className="text-slate-900">{filteredSessions.length}</strong> sesi murid
          </div>
        </div>

        {/* Live Sessions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">No. Ujian / NIS</th>
                <th className="py-3 px-4">Nama Peserta</th>
                <th className="py-3 px-4">Paket Ujian & Kelas</th>
                <th className="py-3 px-4">Status Sesi</th>
                <th className="py-3 px-4">Waktu Mulai / Batas</th>
                <th className="py-3 px-4 text-center">Jawaban</th>
                <th className="py-3 px-4 text-right">Aksi Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Memuat sesi murid aktif...</span>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Tidak ada sesi murid yang sesuai.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Belum ada siswa yang login atau filter tidak menghasilkan data.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((sess) => {
                  const isInProgress = sess.status === 'IN_PROGRESS' || sess.status === 'in_progress';
                  const isSubmitted = sess.status === 'SUBMITTED' || sess.status === 'submitted';
                  const isLocked = Boolean(sess.isLocked);
                  const isExpired = Boolean(sess.isExpired);

                  return (
                    <tr key={sess.id} className="hover:bg-slate-50/80 transition">
                      {/* No Ujian */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {sess.examNumber || sess.student_nis || sess.id.replace('sess_', '')}
                      </td>

                      {/* Nama Siswa */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {sess.studentName || sess.student_name || 'Peserta Ujian'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {sess.id}
                        </div>
                      </td>

                      {/* Paket Ujian & Kelas */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 truncate max-w-[200px]" title={sess.examTitle}>
                          {sess.examTitle || 'Ujian Sekolah'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {sess.className || sess.studentClass || 'Umum'} • {sess.subjectName || 'Mata Pelajaran'}
                        </div>
                      </td>

                      {/* Status Sesi Badge */}
                      <td className="py-3 px-4">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-600" />
                            Terkunci
                          </span>
                        ) : isSubmitted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            Sudah Submit
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Clock className="w-3 h-3" />
                            Waktu Habis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
                            Mengerjakan
                          </span>
                        )}
                      </td>

                      {/* Waktu Mulai & Batas */}
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        <div>
                          Mulai:{' '}
                          <span className="font-semibold text-slate-800">
                            {sess.startedAt ? new Date(sess.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Batas:{' '}
                          <span className="font-mono text-slate-600">
                            {sess.expiresAt ? new Date(sess.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                      </td>

                      {/* Jawaban Tersimpan */}
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-xs border border-slate-200">
                          {sess.answersCount ?? 0} butir
                        </span>
                      </td>

                      {/* Aksi Operasional */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Buka Kunci Sesi */}
                          <button
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              type: 'unlock',
                              targetId: sess.id,
                              targetTitle: `${sess.studentName || 'Siswa'} (${sess.examNumber || sess.id})`
                            })}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Buka Kunci Sesi / Izinkan Masuk Ulang"
                          >
                            <Unlock className="w-3 h-3 text-amber-600" />
                            <span>Buka Kunci</span>
                          </button>

                          {/* Tombol Paksa Kumpul */}
                          {isInProgress && (
                            <button
                              onClick={() => setConfirmModal({
                                isOpen: true,
                                type: 'force_submit',
                                targetId: sess.id,
                                targetTitle: `${sess.studentName || 'Siswa'} (${sess.examNumber || sess.id})`
                              })}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Paksa Kumpulkan Jawaban Siswa"
                            >
                              <Send className="w-3 h-3 text-rose-600" />
                              <span>Paksa Kumpul</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Operasional Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">
              Riwayat Audit Operasional Terkini
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Mencatat regenerasi token, durasi darurat, dan pemulihan sesi
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            Belum ada aktivitas operasional darurat yang dicatat dalam sesi ini.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {auditLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    log.action === 'admin_regenerate_token'
                      ? 'bg-amber-100 text-amber-800'
                      : log.action === 'admin_emergency_time_added'
                      ? 'bg-emerald-100 text-emerald-800'
                      : log.action === 'admin_session_unlocked'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {log.action.replace('admin_', '').replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-slate-700 font-medium">
                    {log.metadata?.reason || log.examTitle || 'Aksi Operasional Admin'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID')} • {log.adminName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Confirmation Modals */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmModal.type === 'token'
                  ? 'bg-amber-100 text-amber-600'
                  : confirmModal.type === 'time'
                  ? 'bg-emerald-100 text-emerald-600'
                  : confirmModal.type === 'unlock'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-rose-100 text-rose-600'
              }`}>
                {confirmModal.type === 'token' && <KeyRound className="w-5 h-5" />}
                {confirmModal.type === 'time' && <Clock className="w-5 h-5" />}
                {confirmModal.type === 'unlock' && <Unlock className="w-5 h-5" />}
                {confirmModal.type === 'force_submit' && <Send className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  {confirmModal.type === 'token' && 'Konfirmasi Regenerasi Token PIN'}
                  {confirmModal.type === 'time' && `Konfirmasi Tambah Waktu Darurat (+${confirmModal.extraData?.minutes || 15} Menit)`}
                  {confirmModal.type === 'unlock' && 'Konfirmasi Buka Kunci Sesi Siswa'}
                  {confirmModal.type === 'force_submit' && 'Konfirmasi Paksa Kumpul Sesi'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: <span className="font-semibold text-slate-800">{confirmModal.targetTitle}</span>
                </p>
              </div>
            </div>

            {/* Modal Body Info */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              {confirmModal.type === 'token' && (
                <p>
                  Sistem akan membuat token PIN alfanumerik 6-karakter acak baru untuk paket ini. Token lama akan langsung nonaktif dan peserta baru wajib menggunakan token baru ini.
                </p>
              )}
              {confirmModal.type === 'time' && (
                <p>
                  Durasi paket ujian dan batas waktu (<em>expiresAt</em>) seluruh murid yang sedang mengerjakan akan diperpanjang secara otomatis sebanyak <strong>+{confirmModal.extraData?.minutes || 15} Menit</strong>.
                </p>
              )}
              {confirmModal.type === 'unlock' && (
                <p>
                  Membuka status terkunci pada sesi siswa ini. Siswa dapat login kembali menggunakan nomor ujian yang sama dan langsung melanjutkan pengerjaan tanpa kehilangan jawaban di memori browser.
                </p>
              )}
              {confirmModal.type === 'force_submit' && (
                <p className="text-rose-700">
                  <strong>Peringatan:</strong> Sesi murid akan langsung diakhiri dan dinilai secara otomatis berdasarkan jawaban yang terakhir tersimpan. Lembar jawaban tidak dapat diubah lagi oleh murid.
                </p>
              )}
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, type: null })}
                disabled={actionLoading}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  if (confirmModal.type === 'token') {
                    handleExecuteRegenerateToken();
                  } else if (confirmModal.type === 'time') {
                    handleExecuteEmergencyTime(confirmModal.extraData?.minutes || 15);
                  } else if (confirmModal.type === 'unlock' && confirmModal.targetId) {
                    handleExecuteUnlockSession(confirmModal.targetId);
                  } else if (confirmModal.type === 'force_submit' && confirmModal.targetId) {
                    handleExecuteForceSubmit(confirmModal.targetId);
                  }
                }}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  confirmModal.type === 'force_submit'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmModal.type === 'token'
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {actionLoading
                    ? 'Memproses...'
                    : confirmModal.type === 'token'
                    ? 'Buat Token Baru'
                    : confirmModal.type === 'time'
                    ? 'Perpanjang Sekarang'
                    : confirmModal.type === 'unlock'
                    ? 'Buka Kunci'
                    : 'Ya, Paksa Kumpul'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
