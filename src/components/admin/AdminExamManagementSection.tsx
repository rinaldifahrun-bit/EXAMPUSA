import React, { useState, useMemo } from 'react';
import type {
  Exam,
  Teacher,
  Subject,
  SchoolClass,
  ExamResult,
  ExamLifecycleStatus,
  SecurityEvent
} from '../../types';
import {
  updateExamLifecycleStatus,
  duplicateExam,
  VALID_LIFECYCLE_TRANSITIONS,
  isValidLifecycleTransition
} from '../../services/examService';
import { db } from '../../lib/dexie';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Key,
  Users,
  Shield,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Archive,
  Eye,
  FileText,
  Layers,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  History,
  Info,
  Check,
  Ban
} from 'lucide-react';

interface AdminExamManagementSectionProps {
  exams: Exam[];
  teachers: Teacher[];
  subjects?: Subject[];
  classes?: SchoolClass[];
  results?: ExamResult[];
  onUpdateExams: (exams: Exam[]) => void;
  onEditExam: (exam: Exam) => void;
  onViewResults: (examId: string) => void;
}

export const AdminExamManagementSection: React.FC<AdminExamManagementSectionProps> = ({
  exams,
  teachers,
  subjects = [],
  classes = [],
  results = [],
  onUpdateExams,
  onEditExam,
  onViewResults
}) => {
  const { success, error, info } = useToast();
  const auth = useAuth();
  const currentAdmin = auth?.user;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('ALL');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Detail Modal
  const [detailExam, setDetailExam] = useState<Exam | null>(null);

  // Duplication Modal
  const [duplicateTargetExam, setDuplicateTargetExam] = useState<Exam | null>(null);
  const [targetTeacherId, setTargetTeacherId] = useState<string>('');

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    exam: Exam | null;
    targetStatus: ExamLifecycleStatus | null;
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    exam: null,
    targetStatus: null,
    title: '',
    message: '',
    confirmText: 'Konfirmasi',
    isDestructive: false
  });

  // Audit Logs Modal
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SecurityEvent[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Subjects and Classes options derived from props or existing exams
  const subjectOptions = useMemo(() => {
    if (subjects.length > 0) return subjects;
    const map = new Map<string, string>();
    exams.forEach((e) => {
      const name = e.subjectName || e.subject_name;
      const id = e.subjectId || e.subject_id || name;
      if (name && id) map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name, code: id }));
  }, [subjects, exams]);

  const classOptions = useMemo(() => {
    if (classes.length > 0) return classes;
    const map = new Map<string, string>();
    exams.forEach((e) => {
      const name = e.className || e.class_name;
      const id = e.classId || e.class_id || name;
      if (name && id) map.set(id, name);
      if (e.class_names) {
        e.class_names.forEach((cn) => map.set(cn, cn));
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes, exams]);

  // Calculate Result Summary Helper
  const getExamResultSummary = (examId: string) => {
    const examResults = results.filter((r) => r.examId === examId || r.exam_id === examId);
    const totalParticipants = examResults.length;
    const submitted = examResults.filter((r) => r.submittedAt || r.submitted_at).length;
    const notSubmitted = Math.max(0, totalParticipants - submitted);
    const needsGrading = examResults.filter(
      (r) =>
        r.gradingStatus === 'NEEDS_GRADING' ||
        r.status === 'NEEDS_GRADING' ||
        r.status === 'awaiting_manual_grading'
    ).length;
    const graded = examResults.filter(
      (r) =>
        r.gradingStatus === 'GRADED' ||
        r.status === 'GRADED' ||
        r.status === 'finalized'
    ).length;
    const resultsReleased = examResults.filter(
      (r) => r.gradingStatus === 'RESULTS_RELEASED' || r.status === 'RESULTS_RELEASED'
    ).length;

    return {
      totalParticipants,
      submitted,
      notSubmitted,
      needsGrading,
      graded,
      resultsReleased
    };
  };

  // Filtered Exam List
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (exam.title || '').toLowerCase().includes(q);
        const matchToken = (exam.examToken || exam.pin || '').toLowerCase().includes(q);
        const matchOwner = (exam.ownerName || exam.owner_name || '').toLowerCase().includes(q);
        const matchSubject = (exam.subjectName || exam.subject_name || '').toLowerCase().includes(q);
        const matchClass = (exam.className || exam.class_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchToken && !matchOwner && !matchSubject && !matchClass) return false;
      }

      // Teacher filter
      if (selectedTeacherFilter !== 'ALL') {
        const owner = exam.ownerId || exam.owner_id;
        if (owner !== selectedTeacherFilter) return false;
      }

      // Subject filter
      if (selectedSubjectFilter !== 'ALL') {
        const subjId = exam.subjectId || exam.subject_id;
        const subjName = exam.subjectName || exam.subject_name;
        if (subjId !== selectedSubjectFilter && subjName !== selectedSubjectFilter) return false;
      }

      // Class filter
      if (selectedClassFilter !== 'ALL') {
        const clsId = exam.classId || exam.class_id;
        const clsName = exam.className || exam.class_name;
        const hasInNames = exam.class_names && exam.class_names.includes(selectedClassFilter);
        if (clsId !== selectedClassFilter && clsName !== selectedClassFilter && !hasInNames) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        const s = (exam.status || 'DRAFT').toUpperCase();
        if (selectedStatusFilter === 'COMPLETED' && (s === 'COMPLETED' || s === 'FINISHED')) return true;
        if (s !== selectedStatusFilter) return false;
      }

      return true;
    });
  }, [exams, searchQuery, selectedTeacherFilter, selectedSubjectFilter, selectedClassFilter, selectedStatusFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    let completed = 0;
    let draft = 0;
    let archived = 0;

    exams.forEach((e) => {
      const s = (e.status || 'DRAFT').toUpperCase();
      if (s === 'ACTIVE') active++;
      else if (s === 'SCHEDULED') scheduled++;
      else if (s === 'COMPLETED' || s === 'GRADED' || s === 'RESULTS_RELEASED') completed++;
      else if (s === 'ARCHIVED') archived++;
      else draft++;
    });

    return { total: exams.length, active, scheduled, completed, draft, archived };
  }, [exams]);

  // Open confirmation for status transition
  const requestStatusTransition = (exam: Exam, targetStatus: ExamLifecycleStatus) => {
    const currentStatus = (exam.status || 'DRAFT').toUpperCase() as ExamLifecycleStatus;

    if (!isValidLifecycleTransition(currentStatus, targetStatus)) {
      error(`Transisi status tidak diizinkan dari ${currentStatus} ke ${targetStatus}.`);
      return;
    }

    if (targetStatus === 'CANCELLED') {
      setConfirmDialog({
        isOpen: true,
        exam,
        targetStatus,
        title: 'Batalkan Pelaksanaan Ujian',
        message: `Apakah Anda yakin ingin membatalkan ujian "${exam.title}"? Siswa tidak akan dapat mengakses sesi ujian ini lagi.`,
        confirmText: 'Ya, Batalkan Ujian',
        isDestructive: true
      });
      return;
    }

    if (targetStatus === 'ARCHIVED') {
      setConfirmDialog({
        isOpen: true,
        exam,
        targetStatus,
        title: 'Arsipkan Paket Ujian',
        message: `Arsipkan paket ujian "${exam.title}"? Ujian yang diarsipkan tidak lagi dapat diakses siswa, namun seluruh rekam jejak nilai dan riwayat peserta tetap tersimpan secara permanen.`,
        confirmText: 'Ya, Arsipkan',
        isDestructive: false
      });
      return;
    }

    if (targetStatus === 'RESULTS_RELEASED') {
      setConfirmDialog({
        isOpen: true,
        exam,
        targetStatus,
        title: 'Rilis Hasil Ujian ke Siswa',
        message: `Rilis nilai dan umpan balik ujian "${exam.title}" ke siswa? Setelah dirilis, siswa dapat melihat rekapitulasi nilai mereka.`,
        confirmText: 'Ya, Rilis Hasil',
        isDestructive: false
      });
      return;
    }

    // Direct transition for non-destructive actions
    executeStatusTransition(exam, targetStatus);
  };

  // Execute transition
  const executeStatusTransition = async (exam: Exam, targetStatus: ExamLifecycleStatus) => {
    const adminId = currentAdmin?.uid || 'admin_1';
    const adminName = currentAdmin?.displayName || 'Administrator';

    try {
      // 1. Call server API if possible
      try {
        const response = await fetch('/api/admin/lifecycle-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'admin',
            'x-user-id': adminId,
            'x-user-name': adminName
          },
          body: JSON.stringify({
            examId: exam.id,
            newStatus: targetStatus,
            reason: `Admin changed status to ${targetStatus}`
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.exam) {
            onUpdateExams(exams.map((e) => (e.id === exam.id ? { ...e, ...data.exam } : e)));
            if (detailExam?.id === exam.id) {
              setDetailExam({ ...detailExam, ...data.exam });
            }
            success(`Status ujian berhasil diperbarui menjadi ${targetStatus}.`, 'Transisi Berhasil');
            return;
          }
        }
      } catch (networkErr) {
        // Fallback to local service
      }

      // 2. Local-first fallback via examService
      const res = await updateExamLifecycleStatus(exam.id, targetStatus, adminName, adminId);
      if (res.exam) {
        onUpdateExams(exams.map((e) => (e.id === exam.id ? res.exam! : e)));
        if (detailExam?.id === exam.id) {
          setDetailExam(res.exam);
        }
        success(`Status ujian berhasil diperbarui menjadi ${targetStatus}.`, 'Transisi Berhasil');
      } else {
        error(res.error || 'Gagal mengubah status ujian.');
      }
    } catch (err: any) {
      error(err.message || 'Terjadi kesalahan saat memproses status ujian.');
    } finally {
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Handle Duplication
  const handleOpenDuplicate = (exam: Exam) => {
    setDuplicateTargetExam(exam);
    setTargetTeacherId(exam.ownerId || exam.owner_id || (teachers[0]?.id || ''));
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateTargetExam || !targetTeacherId) return;

    const teacherObj = teachers.find((t) => t.id === targetTeacherId);
    const teacherName = teacherObj ? teacherObj.name : 'Guru Pengampu';
    const adminId = currentAdmin?.uid || 'admin_1';

    try {
      // 1. Try server API
      try {
        const response = await fetch('/api/admin/duplicate-exam', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'admin',
            'x-user-id': adminId,
            'x-user-name': currentAdmin?.displayName || 'Administrator'
          },
          body: JSON.stringify({
            examId: duplicateTargetExam.id,
            targetTeacherId,
            targetTeacherName: teacherName
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.exam) {
            onUpdateExams([data.exam, ...exams]);
            success(`Paket ujian berhasil diduplikasi untuk ${teacherName}.`, 'Duplikasi Berhasil');
            setDuplicateTargetExam(null);
            return;
          }
        }
      } catch (netErr) {
        // Fallback
      }

      // 2. Local fallback
      const dup = await duplicateExam(duplicateTargetExam, targetTeacherId, teacherName);
      onUpdateExams([dup, ...exams]);
      success(`Paket ujian berhasil diduplikasi untuk ${teacherName}.`, 'Duplikasi Berhasil');
      setDuplicateTargetExam(null);
    } catch (err: any) {
      error(err.message || 'Gagal menduplikasi paket ujian.');
    }
  };

  // Fetch Audit Logs
  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    setShowAuditLogs(true);
    try {
      // Check server logs first
      const resp = await fetch('/api/admin/audit-logs', {
        headers: {
          'x-user-role': 'admin',
          'x-user-id': currentAdmin?.uid || 'admin_1'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.logs) {
          setAuditLogs(
            data.logs.map((l: any) => ({
              id: l.id,
              session_id: 'admin_session',
              exam_id: l.examId,
              student_id: l.adminId,
              student_name: l.adminName,
              event_type: l.action,
              severity: 'info',
              metadata: {
                details: `${l.action}: ${l.previousStatus || ''} -> ${l.newStatus || ''}`,
                ...l.metadata
              },
              created_at: l.timestamp
            }))
          );
          return;
        }
      }

      // Dexie local fallback
      const localEvents = await db.securityEvents
        .filter((ev) => String(ev.event_type).startsWith('admin_'))
        .reverse()
        .sortBy('created_at');
      setAuditLogs(localEvents);
    } catch (e) {
      console.warn('Gagal memuat audit logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Status Badge Component Helper
  const renderStatusBadge = (status: string) => {
    const s = (status || 'DRAFT').toUpperCase();
    switch (s) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Aktif
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
            <Calendar className="w-2.5 h-2.5 text-blue-600" />
            Terjadwal
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Check className="w-2.5 h-2.5 text-indigo-600" />
            Selesai
          </span>
        );
      case 'GRADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
            <CheckCircle2 className="w-2.5 h-2.5 text-purple-600" />
            Dinilai
          </span>
        );
      case 'RESULTS_RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-100 text-teal-800 border border-teal-200">
            <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" />
            Hasil Dirilis
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
            <Ban className="w-2.5 h-2.5 text-rose-600" />
            Dibatalkan
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-300">
            <Archive className="w-2.5 h-2.5 text-slate-400" />
            Arsip
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
            <FileText className="w-2.5 h-2.5 text-amber-600" />
            Draf
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              Otoritas Administrator EXAMPUSA
            </span>
            <span className="text-xs text-slate-500 font-medium">SMPN 1 Puspo</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Manajemen Ujian Sekolah
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Pusat pemantauan seluruh paket ujian dari semua guru pengampu. Administrator berhak mengendalikan lifecycle, menduplikasi ujian, serta mengarsipkan paket ujian dengan rekam jejak yang aman.
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
          <button
            onClick={loadAuditLogs}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Lihat Rekam Jejak Tindakan Administrator"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            Log Audit Admin
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Ujian</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase">Sedang Aktif</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats.active}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-blue-600 uppercase">Terjadwal</div>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{stats.scheduled}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-600 uppercase">Draf</div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{stats.draft}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-600 uppercase">Selesai</div>
          <div className="text-xl font-bold text-indigo-700 mt-0.5">{stats.completed}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Diarsipkan</div>
          <div className="text-xl font-bold text-slate-600 mt-0.5">{stats.archived}</div>
        </div>
      </div>

      {/* Search & Comprehensive Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari judul ujian, token, guru, mapel, kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Teacher Filter */}
          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">Semua Guru Pengampu</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">Semua Mata Pelajaran</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Class Filter */}
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">Semua Kelas</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-slate-100 pt-2 text-xs">
          <span className="text-slate-400 text-[11px] font-bold uppercase shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Status:
          </span>
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'DRAFT', label: 'Draf' },
            { id: 'SCHEDULED', label: 'Terjadwal' },
            { id: 'ACTIVE', label: 'Aktif' },
            { id: 'COMPLETED', label: 'Selesai' },
            { id: 'GRADED', label: 'Dinilai' },
            { id: 'RESULTS_RELEASED', label: 'Hasil Dirilis' },
            { id: 'CANCELLED', label: 'Dibatalkan' },
            { id: 'ARCHIVED', label: 'Arsip' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md font-semibold shrink-0 transition cursor-pointer text-xs ${
                selectedStatusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop View: Clean Responsive Table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="px-4 py-3">Paket Ujian</th>
                <th className="px-4 py-3">Guru Pengampu</th>
                <th className="px-4 py-3">Mapel & Kelas</th>
                <th className="px-4 py-3">Jadwal & Durasi</th>
                <th className="px-4 py-3">Soal & Peserta</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada paket ujian yang sesuai dengan kriteria pencarian dan filter.
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => {
                  const rawStatus = (exam.status || 'DRAFT').toUpperCase() as ExamLifecycleStatus;
                  const ownerName = exam.ownerName || exam.owner_name || 'Guru Pengampu';
                  const token = exam.examToken || exam.pin || '-';
                  const totalQ = exam.questions?.length || exam.totalQuestions || exam.total_questions || 0;
                  const summary = getExamResultSummary(exam.id);

                  const startText = exam.startAt || exam.start_at ? new Date(exam.startAt || exam.start_at!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
                  const endText = exam.endAt || exam.end_at ? new Date(exam.endAt || exam.end_at!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
                  const createdDate = exam.createdAt ? new Date(exam.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

                  return (
                    <tr key={exam.id} className="hover:bg-slate-50/70 transition">
                      {/* Judul Ujian */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 leading-snug">
                          {exam.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>Token: <strong className="font-mono text-blue-600">{token}</strong></span>
                          <span>•</span>
                          <span>Dibuat: {createdDate}</span>
                        </div>
                      </td>

                      {/* Guru Pemilik */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{ownerName}</div>
                        <div className="text-[10px] text-slate-400">ID: {exam.ownerId || exam.owner_id || '-'}</div>
                      </td>

                      {/* Mapel & Kelas */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">
                          {exam.subjectName || exam.subject_name || 'Mata Pelajaran'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Kelas: {exam.className || exam.class_name || (exam.class_names && exam.class_names.join(', ')) || 'Semua'}
                        </div>
                      </td>

                      {/* Jadwal & Durasi */}
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] text-slate-700 font-medium">
                          {startText} s.d. {endText}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Durasi: {exam.durationMinutes || exam.duration_minutes || 60} menit
                        </div>
                      </td>

                      {/* Soal & Ringkasan Peserta */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">
                          {totalQ} Soal
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {summary.totalParticipants} Peserta ({summary.submitted} submit)
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {renderStatusBadge(rawStatus)}
                      </td>

                      {/* Aksi Administrator */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Detail Button */}
                          <button
                            onClick={() => setDetailExam(exam)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                            title="Buka Detail & Kontrol Lifecycle"
                          >
                            <Eye className="w-3 h-3 text-blue-600" />
                            Detail
                          </button>

                          {/* Quick Lifecycle Controls */}
                          {rawStatus === 'ACTIVE' && (
                            <button
                              onClick={() => requestStatusTransition(exam, 'COMPLETED')}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] border border-amber-200 transition cursor-pointer"
                              title="Tutup / Selesaikan Ujian"
                            >
                              Tutup
                            </button>
                          )}

                          {(rawStatus === 'DRAFT' || rawStatus === 'SCHEDULED') && (
                            <button
                              onClick={() => requestStatusTransition(exam, 'ACTIVE')}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition cursor-pointer"
                              title="Aktifkan Ujian Sekarang"
                            >
                              Aktifkan
                            </button>
                          )}

                          {/* Duplicate */}
                          <button
                            onClick={() => handleOpenDuplicate(exam)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                            title="Duplikasi Ujian ke Guru Lain"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive */}
                          {rawStatus !== 'ARCHIVED' && (
                            <button
                              onClick={() => requestStatusTransition(exam, 'ARCHIVED')}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition cursor-pointer"
                              title="Arsipkan Ujian Ini"
                            >
                              <Archive className="w-3.5 h-3.5" />
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

      {/* Mobile View: Clean Responsive Cards */}
      <div className="md:hidden space-y-3">
        {filteredExams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
            Tidak ada paket ujian yang cocok dengan filter.
          </div>
        ) : (
          filteredExams.map((exam) => {
            const rawStatus = (exam.status || 'DRAFT').toUpperCase() as ExamLifecycleStatus;
            const ownerName = exam.ownerName || exam.owner_name || 'Guru Pengampu';
            const token = exam.examToken || exam.pin || '-';
            const totalQ = exam.questions?.length || exam.totalQuestions || exam.total_questions || 0;
            const summary = getExamResultSummary(exam.id);

            return (
              <div
                key={exam.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{exam.title}</h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {exam.subjectName || exam.subject_name} • Kelas {exam.className || exam.class_name || 'Semua'}
                    </div>
                  </div>
                  {renderStatusBadge(rawStatus)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Guru Pengampu</span>
                    <p className="font-bold text-slate-800">{ownerName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Token & Soal</span>
                    <p className="font-mono font-bold text-blue-700">{token} ({totalQ} Soal)</p>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Ringkasan Peserta:</span>
                    <span className="font-semibold text-slate-800">
                      {summary.totalParticipants} Peserta • {summary.submitted} Submit
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setDetailExam(exam)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Detail Ujian
                  </button>

                  <div className="flex items-center gap-2">
                    {rawStatus === 'ACTIVE' ? (
                      <button
                        onClick={() => requestStatusTransition(exam, 'COMPLETED')}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200 cursor-pointer"
                      >
                        Tutup
                      </button>
                    ) : (rawStatus === 'DRAFT' || rawStatus === 'SCHEDULED') ? (
                      <button
                        onClick={() => requestStatusTransition(exam, 'ACTIVE')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 cursor-pointer"
                      >
                        Aktifkan
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleOpenDuplicate(exam)}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50"
                      title="Duplikasi"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* EXAM DETAIL & LIFECYCLE CONTROLLER MODAL */}
      {detailExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Detail Paket Ujian
                  </span>
                  {renderStatusBadge(detailExam.status)}
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {detailExam.title}
                </h3>
              </div>
              <button
                onClick={() => setDetailExam(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold text-[10px] uppercase">Guru Pemilik</span>
                <p className="font-bold text-slate-800 mt-0.5">{detailExam.ownerName || detailExam.owner_name || 'Guru Pengampu'}</p>
                <p className="text-[10px] text-slate-400">ID: {detailExam.ownerId || detailExam.owner_id || '-'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold text-[10px] uppercase">Mata Pelajaran & Kelas</span>
                <p className="font-bold text-slate-800 mt-0.5">{detailExam.subjectName || detailExam.subject_name || '-'}</p>
                <p className="text-[10px] text-slate-500">Kelas: {detailExam.className || detailExam.class_name || 'Semua'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold text-[10px] uppercase">Token Akses Murid</span>
                <p className="font-mono font-bold text-blue-700 text-sm mt-0.5">{detailExam.examToken || detailExam.pin || '-'}</p>
                <p className="text-[10px] text-slate-400">Durasi: {detailExam.durationMinutes || 60} menit</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold text-[10px] uppercase">Jadwal Mulai</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {detailExam.startAt || detailExam.start_at ? new Date(detailExam.startAt || detailExam.start_at!).toLocaleString('id-ID') : 'Belum diatur'}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold text-[10px] uppercase">Jadwal Selesai</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {detailExam.endAt || detailExam.end_at ? new Date(detailExam.endAt || detailExam.end_at!).toLocaleString('id-ID') : 'Belum diatur'}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold text-[10px] uppercase">Jumlah Soal Snapshot</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {detailExam.questions?.length || detailExam.totalQuestions || 0} Soal
                </p>
                <p className="text-[10px] text-slate-400">Total Poin: {detailExam.totalPoints || 100}</p>
              </div>
            </div>

            {/* Simple Result Summary (Requirement 8) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Ringkasan Peserta & Hasil Ujian
                </h4>
                <span className="text-[11px] text-slate-500">Status Penilaian Sederhana</span>
              </div>

              {(() => {
                const s = getExamResultSummary(detailExam.id);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Peserta/Sesi</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">{s.totalParticipants}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-emerald-600 uppercase font-semibold">Sudah Submit</span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">{s.submitted}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-amber-600 uppercase font-semibold">Belum Submit</span>
                      <p className="text-base font-bold text-amber-700 mt-0.5">{s.notSubmitted}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-orange-600 uppercase font-semibold">Menunggu Dinilai</span>
                      <p className="text-base font-bold text-orange-700 mt-0.5">{s.needsGrading}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-purple-600 uppercase font-semibold">Selesai Dinilai</span>
                      <p className="text-base font-bold text-purple-700 mt-0.5">{s.graded}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-teal-600 uppercase font-semibold">Hasil Dirilis</span>
                      <p className="text-base font-bold text-teal-700 mt-0.5">{s.resultsReleased}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Lifecycle Control Panel (Requirement 5) */}
            <div className="border border-blue-200/80 bg-blue-50/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-700" />
                  Kontrol Lifecycle Ujian (Administrator)
                </h4>
                <span className="text-[10px] text-blue-800 font-semibold">
                  Status Terkini: {(detailExam.status || 'DRAFT').toUpperCase()}
                </span>
              </div>

              <p className="text-[11px] text-slate-600">
                Pilih status berikutnya yang sah sesuai alur lifecycle EXAMPUSA:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {(() => {
                  const curr = (detailExam.status || 'DRAFT').toUpperCase() as ExamLifecycleStatus;
                  const allowed = VALID_LIFECYCLE_TRANSITIONS[curr] || [];

                  if (allowed.length === 0) {
                    return (
                      <span className="text-xs text-slate-500 italic">
                        Ujian berada pada status terminal ({curr}). Tidak ada transisi langsung berikutnya.
                      </span>
                    );
                  }

                  return allowed.map((target) => {
                    let btnColor = 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200';
                    if (target === 'ACTIVE') btnColor = 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-700';
                    else if (target === 'SCHEDULED') btnColor = 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700';
                    else if (target === 'COMPLETED') btnColor = 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-700';
                    else if (target === 'GRADED') btnColor = 'bg-purple-600 text-white hover:bg-purple-700 border-purple-700';
                    else if (target === 'RESULTS_RELEASED') btnColor = 'bg-teal-600 text-white hover:bg-teal-700 border-teal-700';
                    else if (target === 'CANCELLED') btnColor = 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300';
                    else if (target === 'ARCHIVED') btnColor = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300';

                    return (
                      <button
                        key={target}
                        onClick={() => requestStatusTransition(detailExam, target)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${btnColor}`}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Ubah ke: {target}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDetailExam(null);
                    handleOpenDuplicate(detailExam);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  Duplikasi Ujian
                </button>

                <button
                  onClick={() => {
                    setDetailExam(null);
                    onEditExam(detailExam);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  Buka di Builder
                </button>
              </div>

              <button
                onClick={() => setDetailExam(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG FOR RISKY ACTIONS (Requirement 5) */}
      {confirmDialog.isOpen && confirmDialog.exam && confirmDialog.targetStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${confirmDialog.isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-[11px] text-slate-500">Konfirmasi Tindakan Administrator</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => executeStatusTransition(confirmDialog.exam!, confirmDialog.targetStatus!)}
                className={`px-4 py-2 rounded-lg text-white text-xs font-bold transition cursor-pointer shadow-xs ${
                  confirmDialog.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE EXAM MODAL (Requirement 7) */}
      {duplicateTargetExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Duplikasi Paket Ujian ke Guru Lain
                </h3>
              </div>
              <button
                onClick={() => setDuplicateTargetExam(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500">Paket Ujian Sumber:</span>
                <p className="font-bold text-slate-800 text-sm">{duplicateTargetExam.title}</p>
                <p className="text-slate-500 text-[11px]">
                  Pemilik Sekarang: {duplicateTargetExam.ownerName || duplicateTargetExam.owner_name}
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="font-bold text-slate-700">
                  Pilih Guru Penerima Duplikasi:
                </label>
                <select
                  value={targetTeacherId}
                  onChange={(e) => setTargetTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.nip || 'Guru Pengampu'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-slate-600 bg-blue-50/60 p-3 rounded-xl border border-blue-200/60 space-y-1">
                <p className="font-semibold text-blue-900 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  Prinsip Snapshot & Keamanan Mandiri:
                </p>
                <p>• Ujian hasil duplikasi akan mendapatkan ID unik baru dan token baru.</p>
                <p>• Seluruh soal disalin menjadi snapshot mandiri baru dan tidak mengubah ujian sumber.</p>
                <p>• Status awal ditetapkan sebagai <strong>DRAF</strong>.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDuplicateTargetExam(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDuplicate}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplikasi Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL (Requirement 10) */}
      {showAuditLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Log Rekam Jejak Audit Administrator
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Transparansi setiap tindakan lifecycle, duplikasi, dan arsip paket ujian
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditLogs(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1 text-xs">
              {isLoadingLogs ? (
                <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  Memuat riwayat audit...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  Belum ada log audit tindakan administrator yang tercatat.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {log.event_type}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      {log.metadata?.details || log.metadata?.description || `Aksi pada ujian ID: ${log.exam_id}`}
                    </p>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>Admin: <strong>{log.student_name || log.student_id}</strong></span>
                      <span>•</span>
                      <span>Exam ID: <strong className="font-mono">{log.exam_id}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAuditLogs(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
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
