import React, { useState, useMemo } from 'react';
import type { Exam, ExamResult, QuestionAnalysisData } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { exportExamResultsToExcel } from '../../lib/excelExport';
import {
  calculateExamStatistics,
  analyzeExamQuestions,
  releaseExamResult,
  cancelReleaseExamResult
} from '../../services/gradingService';
import { TeacherGradingRoom } from './TeacherGradingRoom';
import { QuestionAnalysisView } from './QuestionAnalysisView';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Users,
  Award,
  TrendingUp,
  ArrowUpDown,
  BookOpen,
  BarChart3,
  Edit3,
  Eye,
  X,
  AlertTriangle,
  Send,
  Undo2,
  ShieldCheck
} from 'lucide-react';

interface TeacherResultDashboardProps {
  exams: Exam[];
  results: ExamResult[];
  onUpdateResults: (updatedResults: ExamResult[]) => void;
}

export const TeacherResultDashboard: React.FC<TeacherResultDashboardProps> = ({
  exams,
  results,
  onUpdateResults
}) => {
  const { user } = useAuth();
  const { success, info, error: toastError } = useToast();

  const [selectedExamId, setSelectedExamId] = useState<string>(
    exams.length > 0 ? exams[0].id : ''
  );
  const [activeSubView, setActiveSubView] = useState<'table' | 'grading_room' | 'item_analysis'>('table');
  const [inspectingResult, setInspectingResult] = useState<ExamResult | null>(null);
  const [isProcessingRelease, setIsProcessingRelease] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const currentExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || exams[0],
    [exams, selectedExamId]
  );

  const isExamOwner = useMemo(() => {
    if (!currentExam) return true;
    if (user?.role === 'admin') return true;
    return currentExam.ownerId === user?.uid || currentExam.owner_id === user?.uid;
  }, [currentExam, user?.uid, user?.role]);

  // Filtered results for the selected exam (support dual field)
  const examResults = useMemo(() => {
    if (!isExamOwner) return [];
    return results.filter((r) => r.exam_id === selectedExamId || r.examId === selectedExamId);
  }, [results, selectedExamId, isExamOwner]);

  const getResultStatus = (res: ExamResult): 'RESULTS_RELEASED' | 'GRADED' | 'NEEDS_GRADING' => {
    if (res.gradingStatus === 'RESULTS_RELEASED' || res.status === 'RESULTS_RELEASED') {
      return 'RESULTS_RELEASED';
    }
    if (res.gradingStatus === 'GRADED' || res.status === 'finalized') {
      return 'GRADED';
    }
    return 'NEEDS_GRADING';
  };

  const readyToReleaseCount = useMemo(
    () => examResults.filter((r) => getResultStatus(r) === 'GRADED').length,
    [examResults]
  );

  const releasedCount = useMemo(
    () => examResults.filter((r) => getResultStatus(r) === 'RESULTS_RELEASED').length,
    [examResults]
  );

  const stats = useMemo(
    () => calculateExamStatistics(examResults, 32, currentExam?.settings?.passing_score || 75),
    [examResults, currentExam]
  );

  const analysisData: QuestionAnalysisData[] = useMemo(() => {
    if (!currentExam) return [];
    return analyzeExamQuestions(currentExam, examResults);
  }, [currentExam, examResults]);

  // Release Handlers
  const handleReleaseSingle = async (result: ExamResult) => {
    if (isProcessingRelease) return;
    setIsProcessingRelease(true);
    try {
      const updated = await releaseExamResult(
        result,
        user?.displayName || 'Guru Pengampu',
        user?.uid || 'teacher_uid'
      );
      const newResults = results.map((r) => (r.id === updated.id ? updated : r));
      onUpdateResults(newResults);
      success(
        `Hasil ujian untuk murid ${result.studentName || result.student_name} berhasil dirilis resmi!`,
        'Hasil Dirilis'
      );
    } catch (err: any) {
      toastError(err.message || 'Gagal merilis hasil ujian');
    } finally {
      setIsProcessingRelease(false);
    }
  };

  const handleCancelReleaseSingle = async (result: ExamResult) => {
    if (isProcessingRelease) return;
    setIsProcessingRelease(true);
    try {
      const updated = await cancelReleaseExamResult(
        result,
        user?.displayName || 'Guru Pengampu',
        user?.uid || 'teacher_uid'
      );
      const newResults = results.map((r) => (r.id === updated.id ? updated : r));
      onUpdateResults(newResults);
      info(
        `Rilis hasil untuk ${result.studentName || result.student_name} berhasil dibatalkan.`,
        'Rilis Dibatalkan'
      );
    } catch (err: any) {
      toastError(err.message || 'Gagal membatalkan rilis hasil ujian');
    } finally {
      setIsProcessingRelease(false);
    }
  };

  const handleBatchRelease = async () => {
    const readyItems = examResults.filter((r) => getResultStatus(r) === 'GRADED');
    if (readyItems.length === 0) {
      info('Tidak ada hasil berstatus "Selesai Dinilai" yang dapat dirilis.', 'Perhatian');
      return;
    }

    setIsProcessingRelease(true);
    try {
      let currentList = [...results];
      for (const item of readyItems) {
        const updated = await releaseExamResult(
          item,
          user?.displayName || 'Guru Pengampu',
          user?.uid || 'teacher_uid'
        );
        currentList = currentList.map((r) => (r.id === updated.id ? updated : r));
      }
      onUpdateResults(currentList);
      success(
        `Berhasil merilis ${readyItems.length} hasil ujian ke peserta didik!`,
        'Rilis Massal Selesai'
      );
    } catch (err: any) {
      toastError(err.message || 'Gagal merilis hasil massal');
    } finally {
      setIsProcessingRelease(false);
    }
  };

  // Filtered list by user search and dropdowns
  const displayedResults = useMemo(() => {
    return examResults.filter((res) => {
      const sName = (res.student_name || res.studentName || '').toLowerCase();
      const sNis = (res.student_nis || res.studentNis || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchSearch = sName.includes(query) || sNis.includes(query);

      const sClass = res.student_class || res.studentClass;
      const matchClass = classFilter === 'all' || sClass === classFilter;

      const currentStatus = getResultStatus(res);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'released' && currentStatus === 'RESULTS_RELEASED') ||
        (statusFilter === 'graded' && currentStatus === 'GRADED') ||
        (statusFilter === 'needs_grading' && currentStatus === 'NEEDS_GRADING');

      return matchSearch && matchClass && matchStatus;
    });
  }, [examResults, searchQuery, classFilter, statusFilter]);

  const handleExportExcel = () => {
    if (!currentExam) return;
    if (!isExamOwner) {
      toastError('Akses Ditolak: Anda hanya dapat mengekspor rekap nilai ujian milik Anda sendiri.');
      return;
    }
    exportExamResultsToExcel(currentExam, examResults, analysisData);
    success(
      `File Excel Rekap Nilai "${currentExam.title}" berhasil diunduh.`,
      'Export Excel Berhasil'
    );
  };

  if (!isExamOwner) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-12 text-center text-rose-800 space-y-3">
        <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
        <h3 className="text-lg font-bold">Akses Ditolak (Teacher Isolation Enforced)</h3>
        <p className="text-sm text-rose-700 max-w-md mx-auto">
          Anda tidak memiliki hak akses untuk melihat atau mengekspor hasil paket ujian ini.
          Hanya guru pemilik paket ujian atau Administrator yang diizinkan mengakses data ini.
        </p>
      </div>
    );
  }

  if (!currentExam) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
        Belum ada data ujian yang tersedia.
      </div>
    );
  }

  // Render Sub-Views
  if (activeSubView === 'grading_room') {
    return (
      <TeacherGradingRoom
        exam={currentExam}
        results={examResults}
        onUpdateResults={onUpdateResults}
        onBack={() => setActiveSubView('table')}
      />
    );
  }

  if (activeSubView === 'item_analysis') {
    return (
      <QuestionAnalysisView
        exam={currentExam}
        analysisData={analysisData}
        onBack={() => setActiveSubView('table')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Exam Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Evaluasi & Rekap
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Server-Authoritative Grading Engine
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Rekap Nilai, Penilaian & Evaluasi Ujian
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Lihat hasil pengerjaan murid secara real-time, koreksi soal essay, analisis butir soal, dan unduh laporan Excel resmi.
          </p>
        </div>

        {/* Exam Selector Dropdown */}
        <div className="w-full md:w-80">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Pilih Ujian:
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.subject_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Peserta</p>
          <p className="text-3xl font-bold text-blue-600">{stats.total_participants}</p>
          <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-1 bg-blue-500 rounded-full"
              style={{
                width: `${stats.total_participants > 0 ? (stats.submitted_count / stats.total_participants) * 100 : 0}%`
              }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{stats.submitted_count} Mengumpulkan</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Rata-rata Nilai</p>
          <p className="text-3xl font-bold text-slate-800">{stats.average_score.toFixed(1)}</p>
          <p className="text-[10px] text-blue-600 mt-2 font-medium">KKM Sekolah: {currentExam.settings.passing_score}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Tertinggi / Rendah</p>
          <p className="text-2xl font-bold text-amber-600">
            {stats.highest_score} <span className="text-xs text-slate-400 font-normal">/ {stats.lowest_score}</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-2 font-medium">Median: {stats.median_score}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Kelulusan</p>
          <p className="text-3xl font-bold text-green-600">{stats.passing_rate}%</p>
          <p className="text-[10px] text-slate-500 mt-2 font-medium">
            {stats.passed_count} Lulus • {stats.failed_count} Remidi
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Perlu Koreksi</p>
          <p className="text-3xl font-bold text-amber-500">{stats.awaiting_grading_count}</p>
          <p className="text-[10px] text-amber-600 mt-2 font-medium">Soal Uraian / Essay</p>
        </div>

        {/* Grade distribution card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            Distribusi Grade
          </p>
          <div className="grid grid-cols-4 gap-1 text-center text-xs font-bold my-1">
            <div className="bg-green-50 text-green-700 py-1 rounded border border-green-200">
              A:{stats.grade_distribution.A}
            </div>
            <div className="bg-blue-50 text-blue-700 py-1 rounded border border-blue-200">
              B:{stats.grade_distribution.B}
            </div>
            <div className="bg-amber-50 text-amber-700 py-1 rounded border border-amber-200">
              C:{stats.grade_distribution.C}
            </div>
            <div className="bg-rose-50 text-rose-700 py-1 rounded border border-rose-200">
              D:{stats.grade_distribution.D}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Standar Evaluasi SP1</p>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBatchRelease}
            disabled={isProcessingRelease || readyToReleaseCount === 0}
            title={
              readyToReleaseCount > 0
                ? `Rilis ${readyToReleaseCount} hasil yang telah selesai dinilai ke siswa`
                : 'Semua hasil yang selesai dinilai telah dirilis atau masih ada essay yang perlu dikoreksi'
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Rilis Semua Hasil ({readyToReleaseCount})
          </button>

          <button
            onClick={() => setActiveSubView('grading_room')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            Koreksi Jawaban Essay ({stats.awaiting_grading_count})
          </button>

          <button
            onClick={() => setActiveSubView('item_analysis')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Analisis Butir Soal
          </button>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Excel (.xlsx)
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama murid atau NIS..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Kelas:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none text-xs"
            >
              <option value="all">Semua Kelas</option>
              {(currentExam.class_names || currentExam.classNames || []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none text-xs"
            >
              <option value="all">Semua Status</option>
              <option value="released">Sudah Dirilis ({releasedCount})</option>
              <option value="graded">Siap Dirilis ({readyToReleaseCount})</option>
              <option value="needs_grading">Perlu Koreksi ({stats.awaiting_grading_count})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-800">Daftar Nilai & Hasil Siswa</h3>
          <span className="text-xs text-slate-500 font-medium">Menampilkan {displayedResults.length} peserta</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Nama Murid</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Objektif</th>
                <th className="py-3 px-4 text-center">Uraian</th>
                <th className="py-3 px-4 text-center">Total Poin</th>
                <th className="py-3 px-4 text-center">Nilai Akhir</th>
                <th className="py-3 px-4 text-center">Grade</th>
                <th className="py-3 px-4 text-center">Keterangan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {displayedResults.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400">
                    Tidak ditemukan data hasil ujian yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                displayedResults.map((res, index) => {
                  const rowStatus = getResultStatus(res);
                  const isReleased = rowStatus === 'RESULTS_RELEASED';
                  const isGraded = rowStatus === 'GRADED';
                  const sName = res.studentName || res.student_name;
                  const sNis = res.studentNis || res.student_nis;
                  const sClass = res.studentClass || res.student_class;
                  const earned = res.earned_points ?? res.score ?? 0;
                  const total = res.total_points ?? res.maxScore ?? 100;

                  return (
                    <tr
                      key={res.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition duration-150"
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{sNis}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{sName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{sClass}</td>
                      <td className="py-3.5 px-4 text-center">
                        {isReleased ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Dirilis
                          </span>
                        ) : isGraded ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                            Selesai Dinilai
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                            Perlu Koreksi
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        {res.objective_points ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        {res.essay_points ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                        {earned} <span className="text-slate-400 font-normal">/ {total}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-sm font-bold text-blue-600">
                          {(res.percentage ?? 0).toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`w-6 h-6 rounded-md font-bold text-xs inline-flex items-center justify-center ${
                            res.grade === 'A'
                              ? 'bg-green-100 text-green-700'
                              : res.grade === 'B'
                              ? 'bg-blue-100 text-blue-700'
                              : res.grade === 'C'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {res.grade || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            res.passed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {res.passed ? 'Lulus' : 'Remidial'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectingResult(res)}
                            title="Lihat Lembar Jawaban Lengkap"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isReleased ? (
                            <button
                              onClick={() => handleCancelReleaseSingle(res)}
                              disabled={isProcessingRelease}
                              title="Batalkan Rilis Hasil ke Siswa"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          ) : isGraded ? (
                            <button
                              onClick={() => handleReleaseSingle(res)}
                              disabled={isProcessingRelease}
                              title="Rilis Hasil ke Siswa Sekarang"
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveSubView('grading_room')}
                              title="Koreksi Jawaban Essay"
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
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

      {/* Student Answer Sheet Modal */}
      {inspectingResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Lembar Jawaban: {inspectingResult.studentName || inspectingResult.student_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  NIS: {inspectingResult.studentNis || inspectingResult.student_nis} • Kelas {inspectingResult.studentClass || inspectingResult.student_class} • Nilai Akhir: <b className="text-blue-600">{(inspectingResult.percentage ?? 0).toFixed(1)}</b> ({inspectingResult.grade || '-'})
                </p>
              </div>
              <button
                onClick={() => setInspectingResult(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {inspectingResult.items.map((item) => (
                <div
                  key={item.question_id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800">
                      Soal #{item.question_number} ({item.question_type})
                    </span>
                    <span className="font-mono font-bold text-blue-600">
                      Skor: {item.earned_points} / {item.max_points}
                    </span>
                  </div>

                  <p className="text-slate-800">{item.question_text}</p>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Jawaban Murid:</p>
                    <p className="text-slate-900 font-mono">
                      {item.student_answer ? String(item.student_answer) : '(Kosong)'}
                    </p>
                  </div>

                  {item.answer_key && (
                    <div className="p-3 bg-green-50/60 rounded-lg border border-green-200 text-[11px] space-y-0.5">
                      <p className="text-[10px] uppercase font-bold text-green-700">Kunci / Rubrik:</p>
                      <p className="text-slate-700">{item.answer_key}</p>
                    </div>
                  )}

                  {item.teacher_feedback && (
                    <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-[11px] space-y-0.5">
                      <p className="text-[10px] uppercase font-bold text-blue-700">Catatan Guru:</p>
                      <p className="text-slate-700">{item.teacher_feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50/50 rounded-b-2xl">
              <button
                onClick={() => setInspectingResult(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
