import React, { useState, useEffect, useMemo } from 'react';
import type {
  Exam,
  Teacher,
  Subject,
  SchoolClass,
  ExamResult,
  ExamResultItem
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminResults,
  fetchAdminResultDetail,
  logAdminExportAudit,
  AdminResultFilters
} from '../../services/adminResultService';
import { exportAdminResultsToExcel } from '../../lib/excelExport';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  GraduationCap,
  BookOpen,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  X,
  Award,
  Hash,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface AdminResultsCenterSectionProps {
  exams: Exam[];
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
}

export const AdminResultsCenterSection: React.FC<AdminResultsCenterSectionProps> = ({
  exams,
  teachers,
  subjects,
  classes
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Result for Detail Modal
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadResults = async () => {
    try {
      setLoading(true);
      const filters: AdminResultFilters = {
        examId: selectedExamId,
        teacherId: selectedTeacherId,
        subjectId: selectedSubject,
        classId: selectedClass,
        status: selectedStatus,
        searchQuery
      };
      const data = await fetchAdminResults(
        filters,
        user?.id || 'admin_1',
        user?.name || 'Administrator'
      );
      setResults(data);
    } catch (err: any) {
      console.error('Gagal memuat rekap hasil ujian:', err);
      showToast('Gagal memuat rekap hasil ujian dari server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, [selectedExamId, selectedTeacherId, selectedSubject, selectedClass, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadResults();
  };

  const handleResetFilters = () => {
    setSelectedExamId('all');
    setSelectedTeacherId('all');
    setSelectedSubject('all');
    setSelectedClass('all');
    setSelectedStatus('all');
    setSearchQuery('');
  };

  // Open Result Detail Modal
  const handleOpenDetail = async (res: ExamResult) => {
    try {
      setLoadingDetail(true);
      setSelectedResult(res); // show immediately with available data
      const detail = await fetchAdminResultDetail(
        res.id || (res as any).sessionId || '',
        user?.id || 'admin_1',
        user?.name || 'Administrator'
      );
      if (detail) {
        setSelectedResult(detail);
      }
    } catch (err) {
      console.error('Gagal mengambil detail hasil:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle Export to Excel
  const handleExportExcel = async () => {
    if (results.length === 0) {
      showToast('Tidak ada data hasil ujian untuk diekspor.', 'info');
      return;
    }

    try {
      setExporting(true);

      const examObj = exams.find((e) => e.id === selectedExamId);
      const teacherObj = teachers.find((t) => t.id === selectedTeacherId);

      const filterMeta = {
        examTitle: examObj ? examObj.title : undefined,
        teacherName: teacherObj ? teacherObj.name : undefined,
        subjectName: selectedSubject !== 'all' ? selectedSubject : undefined,
        className: selectedClass !== 'all' ? selectedClass : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        searchQuery: searchQuery.trim() || undefined
      };

      exportAdminResultsToExcel(results, filterMeta);

      // Log server audit
      await logAdminExportAudit(
        results.length,
        {
          examId: selectedExamId,
          teacherId: selectedTeacherId,
          subject: selectedSubject,
          class: selectedClass,
          status: selectedStatus,
          query: searchQuery
        },
        user?.id || 'admin_1',
        user?.name || 'Administrator'
      );

      showToast(`Berhasil mengekspor ${results.length} baris hasil ke Excel.`, 'success');
    } catch (err) {
      console.error('Gagal mengekspor data Excel:', err);
      showToast('Gagal mengekspor data Excel.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = results.length;
    if (total === 0) {
      return { total: 0, avgScore: 0, passedCount: 0, needsGradingCount: 0, releasedCount: 0 };
    }

    let sumScore = 0;
    let validScoreCount = 0;
    let passedCount = 0;
    let needsGradingCount = 0;
    let releasedCount = 0;

    results.forEach((r) => {
      const score = typeof r.percentage === 'number' ? r.percentage : (r.earned_points ?? r.totalScore ?? 0);
      if (typeof score === 'number' && !isNaN(score)) {
        sumScore += score;
        validScoreCount++;
        if (score >= 75 || r.passed) {
          passedCount++;
        }
      }

      const status = String(r.gradingStatus || r.status || '').toUpperCase();
      if (status === 'NEEDS_GRADING' || status === 'AWAITING' || status === 'AWAITING_MANUAL_GRADING') {
        needsGradingCount++;
      }
      if (status === 'RESULTS_RELEASED') {
        releasedCount++;
      }
    });

    const avgScore = validScoreCount > 0 ? (sumScore / validScoreCount).toFixed(1) : '0';

    return {
      total,
      avgScore,
      passedCount,
      needsGradingCount,
      releasedCount
    };
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Rekap Hasil Ujian (Admin Results & Export Center)
                </h2>
                <p className="text-xs text-slate-500">
                  Kelola dan pantau seluruh hasil ujian siswa dari seluruh guru pengampu di SMPN 1 Puspo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadResults}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Perbarui data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exporting || loading || results.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Mengekspor...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Peserta</span>
            <p className="text-xl font-black text-slate-900">{metrics.total}</p>
            <p className="text-[10px] text-slate-400">Lembar jawaban</p>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Rata-Rata Nilai</span>
            <p className="text-xl font-black text-blue-900">{metrics.avgScore}</p>
            <p className="text-[10px] text-blue-600">Skala 0 - 100</p>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Lulus KKM</span>
            <p className="text-xl font-black text-emerald-900">{metrics.passedCount}</p>
            <p className="text-[10px] text-emerald-600">Nilai ≥ 75</p>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Perlu Penilaian</span>
            <p className="text-xl font-black text-amber-900">{metrics.needsGradingCount}</p>
            <p className="text-[10px] text-amber-600">Soal essay</p>
          </div>

          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3.5 space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Hasil Dirilis</span>
            <p className="text-xl font-black text-purple-900">{metrics.releasedCount}</p>
            <p className="text-[10px] text-purple-600">Terbuka untuk siswa</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama siswa, nomor ujian, atau judul ujian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
            >
              Terapkan Pencarian
            </button>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            {/* Filter Ujian */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Paket Ujian</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Semua Ujian ({exams.length})</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title.length > 25 ? `${ex.title.substring(0, 25)}...` : ex.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Guru */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Guru Pengampu</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Semua Guru ({teachers.length})</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Mapel */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mata Pelajaran</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Semua Mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kelas */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kelas Peserta</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-500">Status Hasil</label>
                {(selectedExamId !== 'all' || selectedTeacherId !== 'all' || selectedSubject !== 'all' || selectedClass !== 'all' || selectedStatus !== 'all' || searchQuery) && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="GRADED">Selesai Dinilai</option>
                <option value="NEEDS_GRADING">Perlu Penilaian (Essay)</option>
                <option value="RESULTS_RELEASED">Hasil Dirilis</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Container: Desktop Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Memuat data rekap hasil ujian...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tidak Ada Hasil Ujian</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tidak ditemukan data lembar jawaban yang cocok dengan filter atau kriteria pencarian yang aktif.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Lengkap & Nomor Ujian</th>
                    <th className="py-3 px-3">Kelas</th>
                    <th className="py-3 px-4">Paket Ujian & Mapel</th>
                    <th className="py-3 px-4">Guru Pengampu</th>
                    <th className="py-3 px-3 text-center">Nilai Akhir</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Waktu Submit</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((res, idx) => {
                    const studentName = res.studentName || res.student_name || 'Peserta Ujian';
                    const studentClass = res.studentClass || res.student_class || '-';
                    const examNumber = res.examNumber || res.student_nis || (res as any).studentNis || '-';
                    const examTitle = res.exam_title || (res as any).examTitle || 'Ujian Sekolah';
                    const subjectName = res.subject_name || (res as any).subjectName || 'Mata Pelajaran';
                    const teacherName = (res as any).teacherName || (res as any).owner_name || 'Bpk. Hendra Pratama, S.Kom.';

                    const score = typeof res.percentage === 'number' ? res.percentage : (res.earned_points ?? res.totalScore ?? 0);
                    const isPassed = score >= 75 || res.passed;

                    const statusStr = String(res.gradingStatus || res.status || '').toUpperCase();
                    let statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-2.5 h-2.5" /> Perlu Penilaian
                      </span>
                    );
                    if (statusStr === 'RESULTS_RELEASED') {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Hasil Dirilis
                        </span>
                      );
                    } else if (statusStr === 'GRADED' || statusStr === 'FINALIZED') {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Selesai Dinilai
                        </span>
                      );
                    }

                    let submitTimeStr = '-';
                    const rawTime = res.submittedAt || res.submitted_at || res.createdAt || res.created_at;
                    if (rawTime) {
                      try {
                        const d = new Date(rawTime);
                        submitTimeStr = `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
                      } catch {
                        submitTimeStr = String(rawTime);
                      }
                    }

                    return (
                      <tr key={res.id || idx} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{studentName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-slate-400" />
                            <span>No: {examNumber}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{studentClass}</td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900 truncate" title={examTitle}>
                            {examTitle}
                          </div>
                          <div className="text-[11px] text-blue-600 font-medium">{subjectName}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium truncate max-w-xs" title={teacherName}>
                          {teacherName}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-black text-xs ${
                              isPassed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {typeof score === 'number' ? score.toFixed(1) : score}
                          </span>
                        </td>
                        <td className="py-3 px-3">{statusBadge}</td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{submitTimeStr}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenDetail(res)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards List */}
            <div className="md:hidden divide-y divide-slate-100">
              {results.map((res, idx) => {
                const studentName = res.studentName || res.student_name || 'Peserta Ujian';
                const studentClass = res.studentClass || res.student_class || '-';
                const examNumber = res.examNumber || res.student_nis || (res as any).studentNis || '-';
                const examTitle = res.exam_title || (res as any).examTitle || 'Ujian Sekolah';
                const subjectName = res.subject_name || (res as any).subjectName || 'Mata Pelajaran';
                const teacherName = (res as any).teacherName || (res as any).owner_name || 'Bpk. Hendra Pratama, S.Kom.';
                const score = typeof res.percentage === 'number' ? res.percentage : (res.earned_points ?? res.totalScore ?? 0);
                const isPassed = score >= 75 || res.passed;

                const statusStr = String(res.gradingStatus || res.status || '').toUpperCase();
                let statusLabel = 'Perlu Penilaian';
                let statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
                if (statusStr === 'RESULTS_RELEASED') {
                  statusLabel = 'Hasil Dirilis';
                  statusColor = 'bg-purple-50 text-purple-700 border-purple-200';
                } else if (statusStr === 'GRADED' || statusStr === 'FINALIZED') {
                  statusLabel = 'Selesai Dinilai';
                  statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                }

                return (
                  <div key={res.id || idx} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{studentName}</div>
                        <div className="text-xs text-slate-500">
                          Kelas {studentClass} • No: {examNumber}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-black text-sm shrink-0 border ${
                          isPassed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {typeof score === 'number' ? score.toFixed(1) : score}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 text-xs">
                      <div className="font-semibold text-slate-800 line-clamp-1">{examTitle}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{subjectName}</span>
                        <span>{teacherName}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                        {statusLabel}
                      </span>

                      <button
                        onClick={() => handleOpenDetail(res)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Buka Detail</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Result Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                  <Award className="w-3 h-3 text-blue-400" />
                  Detail Hasil Peserta Ujian
                </div>
                <h3 className="text-base sm:text-lg font-bold">
                  {selectedResult.studentName || selectedResult.student_name || 'Peserta Ujian'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Peserta</span>
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedResult.studentName || selectedResult.student_name}
                  </p>
                  <p className="text-slate-500">
                    Kelas: <span className="font-semibold text-slate-700">{selectedResult.studentClass || selectedResult.student_class || '-'}</span>
                  </p>
                  <p className="text-slate-500">
                    Nomor Ujian: <span className="font-semibold text-slate-700">{selectedResult.examNumber || selectedResult.student_nis || '-'}</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ujian</span>
                  <p className="font-bold text-slate-900 text-sm line-clamp-1">
                    {selectedResult.exam_title || (selectedResult as any).examTitle || 'Ujian Sekolah'}
                  </p>
                  <p className="text-slate-500">
                    Mapel: <span className="font-semibold text-slate-700">{selectedResult.subject_name || (selectedResult as any).subjectName || '-'}</span>
                  </p>
                  <p className="text-slate-500">
                    Guru: <span className="font-semibold text-slate-700">{(selectedResult as any).teacherName || (selectedResult as any).owner_name || 'Bpk. Hendra Pratama, S.Kom.'}</span>
                  </p>
                </div>

                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Hasil Akhir</span>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black text-blue-900">
                      {typeof selectedResult.percentage === 'number'
                        ? selectedResult.percentage.toFixed(1)
                        : (selectedResult.earned_points ?? selectedResult.totalScore ?? 0)}
                    </p>
                    <span className="text-xs font-semibold text-blue-600">/ 100</span>
                  </div>
                  <p className="text-[11px] font-semibold text-blue-800">
                    Status: {(selectedResult.gradingStatus || selectedResult.status || '').toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Score Breakdown Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  Ringkasan Penilaian & Poin
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Poin Objektif</span>
                    <p className="text-base font-bold text-slate-900">
                      {selectedResult.objective_points ?? selectedResult.earned_points ?? 0}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Poin Essay</span>
                    <p className="text-base font-bold text-slate-900">
                      {selectedResult.essay_points ?? 0}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Soal Dijawab Benar</span>
                    <p className="text-base font-bold text-emerald-600">
                      {selectedResult.correct_count ?? '-'}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Waktu Submit</span>
                    <p className="text-xs font-bold text-slate-700 mt-1 truncate">
                      {selectedResult.submittedAt || selectedResult.submitted_at
                        ? new Date(selectedResult.submittedAt || selectedResult.submitted_at!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Breakdown (If available and safe for Admin) */}
              {selectedResult.items && selectedResult.items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Rincian Jawaban per Soal ({selectedResult.items.length} Soal)
                  </h4>

                  <div className="space-y-3">
                    {selectedResult.items.map((item: ExamResultItem, qIdx: number) => {
                      const isEssay = item.question_type === 'essay';
                      return (
                        <div
                          key={item.question_id || qIdx}
                          className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                                {item.question_number || qIdx + 1}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                {item.question_type}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.is_correct ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Benar ({item.earned_points ?? item.max_points}/{item.max_points} Poin)
                                </span>
                              ) : isEssay ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.grading_status === 'graded' ? 'Dinilai' : 'Menunggu Koreksi'} ({item.earned_points ?? 0}/{item.max_points} Poin)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <XCircle className="w-3 h-3" /> Salah (0/{item.max_points} Poin)
                                </span>
                              )}
                            </div>
                          </div>

                          {item.question_text && (
                            <p className="text-slate-800 text-xs font-medium leading-relaxed">
                              {item.question_text}
                            </p>
                          )}

                          {/* Student Answer */}
                          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Jawaban Siswa:
                            </span>
                            <div className="text-slate-900 font-medium whitespace-pre-wrap">
                              {typeof item.student_answer === 'boolean'
                                ? (item.student_answer ? 'Benar (True)' : 'Salah (False)')
                                : Array.isArray(item.student_answer)
                                ? item.student_answer.join(', ')
                                : item.student_answer !== undefined && item.student_answer !== null && String(item.student_answer).trim() !== ''
                                ? String(item.student_answer)
                                : '(Tidak dijawab)'}
                            </div>
                          </div>

                          {/* Essay Teacher Feedback (if available) */}
                          {isEssay && (item.teacher_feedback || item.teacherFeedback) && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs space-y-1">
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                                Catatan / Feedback Guru:
                              </span>
                              <p className="text-blue-900">
                                {item.teacher_feedback || item.teacherFeedback}
                              </p>
                              {item.graded_by && (
                                <p className="text-[10px] text-blue-600 italic">
                                  Dinilai oleh: {item.graded_by}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Log Audit: Tindakan inspeksi hasil ujian ini dicatat ke sistem audit administrator.
              </span>
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
