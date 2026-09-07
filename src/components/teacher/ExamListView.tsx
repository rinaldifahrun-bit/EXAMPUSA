import React, { useState, useMemo } from 'react';
import type { Exam, ExamLifecycleStatus, Subject, SchoolClass } from '../../types';
import {
  updateExamLifecycleStatus,
  duplicateExam,
  archiveExam,
  deleteDraftExam,
  generateExamToken
} from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Calendar,
  Clock,
  Key,
  Users,
  Shield,
  BarChart3,
  Play,
  Pause,
  Archive,
  CheckCircle2,
  Plus,
  Edit3,
  Copy,
  Trash2,
  Search,
  Filter,
  Layers,
  AlertTriangle
} from 'lucide-react';

interface ExamListViewProps {
  exams: Exam[];
  onUpdateExams: (exams: Exam[]) => void;
  onCreateNew: () => void;
  onEditExam: (exam: Exam) => void;
  onViewResults: (examId: string) => void;
  onViewMonitoring: (examId: string) => void;
}

export const ExamListView: React.FC<ExamListViewProps> = ({
  exams,
  onUpdateExams,
  onCreateNew,
  onEditExam,
  onViewResults,
  onViewMonitoring
}) => {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const { success, error, info } = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  // Filtered exams
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = (exam.title || '').toLowerCase().includes(query);
        const matchToken = (exam.examToken || exam.pin || '').toLowerCase().includes(query);
        if (!matchTitle && !matchToken) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        const currentStatus = (exam.status || 'DRAFT').toUpperCase();
        if (selectedStatusFilter === 'ACTIVE' && currentStatus !== 'ACTIVE') return false;
        if (selectedStatusFilter === 'SCHEDULED' && currentStatus !== 'SCHEDULED') return false;
        if (selectedStatusFilter === 'DRAFT' && currentStatus !== 'DRAFT') return false;
        if (selectedStatusFilter === 'COMPLETED' && currentStatus !== 'COMPLETED' && currentStatus !== 'FINISHED') return false;
        if (selectedStatusFilter === 'ARCHIVED' && currentStatus !== 'ARCHIVED') return false;
      }

      // Subject filter
      if (subjectFilter !== 'ALL') {
        const sId = exam.subjectId || exam.subject_id;
        if (sId !== subjectFilter) return false;
      }

      return true;
    });
  }, [exams, searchQuery, selectedStatusFilter, subjectFilter]);

  // Extract unique subjects for filter dropdown
  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, string>();
    exams.forEach((e) => {
      const id = e.subjectId || e.subject_id;
      const name = e.subjectName || e.subject_name;
      if (id && name) map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [exams]);

  // Status transitions
  const handleToggleStatus = async (exam: Exam) => {
    const isCurrentlyActive = exam.status === 'ACTIVE' || exam.status === 'active';
    const nextStatus: ExamLifecycleStatus = isCurrentlyActive ? 'COMPLETED' : 'ACTIVE';

    const res = await updateExamLifecycleStatus(exam.id, nextStatus, user.displayName);
    if (res.exam) {
      onUpdateExams(exams.map((e) => (e.id === res.exam!.id ? res.exam! : e)));
      if (nextStatus === 'ACTIVE') {
        success('Ujian telah diaktifkan! Murid dapat mengakses dengan token.', 'Ujian Aktif');
      } else {
        info('Ujian dinonaktifkan (selesai).', 'Ujian Selesai');
      }
    } else {
      error(res.error || 'Gagal mengubah status ujian.');
    }
  };

  // Duplicate Exam
  const handleDuplicate = async (exam: Exam) => {
    try {
      const dup = await duplicateExam(exam, user.uid, user.displayName);
      onUpdateExams([dup, ...exams]);
      success(`Ujian diduplikasi menjadi: "${dup.title}"`, 'Ujian Diduplikasi');
    } catch (err: any) {
      error(err.message || 'Gagal menduplikasi ujian.');
    }
  };

  // Archive Exam
  const handleArchive = async (examId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin mengarsipkan paket ujian ini?')) return;
    try {
      const archived = await archiveExam(examId);
      if (archived) {
        onUpdateExams(exams.map((e) => (e.id === archived.id ? archived : e)));
        success('Ujian berhasil diarsipkan.', 'Diarsipkan');
      }
    } catch (err: any) {
      error(err.message || 'Gagal mengarsipkan ujian.');
    }
  };

  // Delete Draft Exam
  const handleDeleteDraft = async (examId: string) => {
    if (!window.confirm('Hapus draf paket ujian ini secara permanen?')) return;
    try {
      const res = await deleteDraftExam(examId, isAdmin);
      if (res.success) {
        onUpdateExams(exams.filter((e) => e.id !== examId));
        success('Draf ujian berhasil dihapus.', 'Dihapus');
      } else {
        error(res.error || 'Gagal menghapus draf ujian.');
      }
    } catch (err: any) {
      error(err.message || 'Gagal menghapus draf ujian.');
    }
  };

  const copyTokenToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    success(`Token ${token} disalin ke papan klip!`, 'Token Disalin');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Paket Ujian
            </span>
            <span className="text-xs text-slate-500 font-medium">SMPN 1 Puspo</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Daftar Paket Ujian Saya</h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola draf soal snapshot, konfigurasi token, jadwal aktifasi, serta rekapitulasi nilai.
          </p>
        </div>

        <button
          onClick={onCreateNew}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Buat Paket Ujian Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama paket ujian atau token PIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-800"
            />
          </div>

          {/* Subject Filter */}
          {uniqueSubjects.length > 0 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="ALL">Semua Mata Pelajaran</option>
              {uniqueSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Status:</span>
          {[
            { key: 'ALL', label: 'Semua Status' },
            { key: 'DRAFT', label: 'Draf' },
            { key: 'SCHEDULED', label: 'Terjadwal' },
            { key: 'ACTIVE', label: 'Aktif' },
            { key: 'COMPLETED', label: 'Selesai' },
            { key: 'ARCHIVED', label: 'Arsip' }
          ].map((pill) => (
            <button
              key={pill.key}
              onClick={() => setSelectedStatusFilter(pill.key)}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition shrink-0 cursor-pointer ${
                selectedStatusFilter === pill.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exams Grid */}
      {filteredExams.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            Tidak Ditemukan Paket Ujian
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedStatusFilter !== 'ALL'
              ? 'Tidak ada ujian yang cocok dengan kriteria filter Anda.'
              : 'Anda belum memiliki paket ujian. Klik tombol di bawah untuk membuat paket ujian baru.'}
          </p>
          <div className="pt-2">
            <button
              onClick={onCreateNew}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 mx-auto cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Buat Paket Ujian Baru
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const rawStatus = (exam.status || 'DRAFT').toUpperCase();
            const isActive = rawStatus === 'ACTIVE';
            const isDraft = rawStatus === 'DRAFT';
            const isScheduled = rawStatus === 'SCHEDULED';
            const isArchived = rawStatus === 'ARCHIVED';

            const token = exam.examToken || exam.pin || '-';
            const totalQuestions = exam.questions?.length || exam.totalQuestions || exam.total_questions || 0;
            const duration = exam.durationMinutes || exam.duration_minutes || 60;
            const subjectName = exam.subjectName || exam.subject_name || 'Mata Pelajaran';
            const className = exam.className || exam.class_name || (exam.class_names && exam.class_names.join(', ')) || 'Kelas';

            return (
              <div
                key={exam.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition ${
                  isActive
                    ? 'border-emerald-300 ring-1 ring-emerald-500/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {subjectName}
                      </span>
                      {/* Status Tag */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isScheduled
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : isDraft
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : isArchived
                            ? 'bg-slate-100 text-slate-500 border border-slate-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {rawStatus}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                      {exam.title}
                    </h3>
                  </div>

                  {/* Edit Builder Shortcut */}
                  <button
                    onClick={() => onEditExam(exam)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition cursor-pointer shrink-0"
                    title="Buka di Exam Builder"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Durasi: {duration} Menit</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="flex items-center gap-1.5">
                      Token:{' '}
                      <button
                        onClick={() => copyTokenToClipboard(token)}
                        className="font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                        title="Klik untuk menyalin token"
                      >
                        {token}
                      </button>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">Kelas: {className}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{totalQuestions} Butir Soal</span>
                  </div>
                </div>

                {/* Action buttons bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  {/* Left Side: Status Toggle */}
                  <div className="flex items-center gap-1.5">
                    {isActive ? (
                      <button
                        onClick={() => handleToggleStatus(exam)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition flex items-center gap-1 border border-amber-200 cursor-pointer"
                        title="Selesaikan / Tutup Ujian"
                      >
                        <Pause className="w-3 h-3" />
                        Tutup Ujian
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(exam)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Aktifkan Ujian Sekarang"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Aktifkan
                      </button>
                    )}

                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicate(exam)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                      title="Duplikasi Ujian Ini"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Archive / Delete */}
                    {isDraft ? (
                      <button
                        onClick={() => handleDeleteDraft(exam.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus Draf Ujian"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : !isArchived ? (
                      <button
                        onClick={() => handleArchive(exam.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                        title="Arsipkan Ujian"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Right Side: Builder, Monitoring & Rekap */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditExam(exam)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-blue-600" />
                      Edit Soal
                    </button>

                    <button
                      onClick={() => onViewResults(exam.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <BarChart3 className="w-3 h-3" />
                      Rekap
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
