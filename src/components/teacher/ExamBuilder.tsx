import React, { useState, useEffect, useRef, useMemo } from 'react';
import type {
  Exam,
  ExamQuestionSnapshot,
  ExamOptionSnapshot,
  ExamLifecycleStatus,
  Subject,
  SchoolClass,
  TeacherAssignment,
  Question
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  saveExamDraft,
  updateExamLifecycleStatus,
  duplicateExam,
  archiveExam,
  generateExamToken,
  validateExamForActivation,
  convertQuestionToSnapshot
} from '../../services/examService';
import { fetchSubjects, fetchClasses, fetchAssignments } from '../../services/masterDataService';
import { ExamQuestionCard } from './ExamQuestionCard';
import { QuestionBankSelectorModal } from './QuestionBankSelectorModal';
import {
  ArrowLeft,
  Save,
  Play,
  Calendar,
  Clock,
  Key,
  Shuffle,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  Archive,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  X,
  FileCheck
} from 'lucide-react';

interface ExamBuilderProps {
  initialExam: Exam;
  onBack: () => void;
  onSaved: (exam: Exam) => void;
}

export const ExamBuilder: React.FC<ExamBuilderProps> = ({
  initialExam,
  onBack,
  onSaved
}) => {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const { success, error, info } = useToast();

  const [exam, setExam] = useState<Exam>(initialExam);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    initialExam.questions?.[0]?.id || null
  );

  // Master Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  // Modals
  const [showBankModal, setShowBankModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Autosave State
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved_cloud' | 'saved_local' | 'error'
  >('idle');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstMount = useRef(true);

  // Load teacher assignments and master data
  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [subjData, clsData, asgData] = await Promise.all([
          fetchSubjects(),
          fetchClasses(),
          fetchAssignments()
        ]);
        setSubjects(subjData.filter((s) => s.status !== 'inactive'));
        setClasses(clsData.filter((c) => c.status !== 'inactive'));
        setAssignments(asgData);
      } catch (err) {
        console.error('Gagal memuat master data:', err);
      }
    };
    loadMaster();
  }, []);

  // Filter subjects based on teacher's assignments
  const availableSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    const teacherAssignments = assignments.filter(
      (a) => (a.teacherId === user.uid || a.teacherId === user.displayName) && a.status !== 'inactive'
    );
    if (teacherAssignments.length === 0) return subjects;
    const assignedSubjIds = teacherAssignments.map((a) => a.subjectId);
    return subjects.filter((s) => assignedSubjIds.includes(s.id));
  }, [subjects, assignments, isAdmin, user]);

  // Filter classes based on selected subject and teacher's assignments
  const availableClasses = useMemo(() => {
    if (isAdmin) return classes;
    const currentSubjectId = exam.subjectId || exam.subject_id;
    const teacherAssignments = assignments.filter(
      (a) =>
        (a.teacherId === user.uid || a.teacherId === user.displayName) &&
        a.status !== 'inactive' &&
        (!currentSubjectId || a.subjectId === currentSubjectId)
    );
    if (teacherAssignments.length === 0) return classes;
    const assignedClassIds = teacherAssignments.flatMap((a) => a.classIds || []);
    return classes.filter((c) => assignedClassIds.includes(c.id));
  }, [classes, assignments, isAdmin, user, exam.subjectId, exam.subject_id]);

  // Autosave effect with debounce
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await saveExamDraft(exam);
        if (res.cloudSynced) {
          setSaveStatus('saved_cloud');
        } else {
          setSaveStatus('saved_local');
        }
        onSaved(exam);
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('error');
      }
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [exam]);

  // Handle Manual Save
  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await saveExamDraft(exam);
      if (res.cloudSynced) {
        setSaveStatus('saved_cloud');
        success('Paket ujian berhasil disimpan ke Cloud & Lokal.', 'Tersimpan');
      } else {
        setSaveStatus('saved_local');
        info('Tersimpan di perangkat lokal (menunggu sinkronisasi cloud).', 'Tersimpan Lokal');
      }
      onSaved(exam);
    } catch (err: any) {
      setSaveStatus('error');
      error(err.message || 'Gagal menyimpan paket ujian.');
    }
  };

  // Header card changes
  const handleTitleChange = (title: string) => {
    setExam((prev) => ({ ...prev, title }));
  };

  const handleDescriptionChange = (description: string) => {
    setExam((prev) => ({ ...prev, description }));
  };

  const handleSubjectChange = (subjectId: string) => {
    const subj = subjects.find((s) => s.id === subjectId);
    setExam((prev) => ({
      ...prev,
      subjectId,
      subject_id: subjectId,
      subjectName: subj?.name || '',
      subject_name: subj?.name || ''
    }));
  };

  const handleClassChange = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    setExam((prev) => ({
      ...prev,
      classId,
      class_id: classId,
      classIds: [classId],
      class_ids: [classId],
      className: cls?.name || '',
      class_names: [cls?.name || '']
    }));
  };

  // Settings changes
  const handleDurationChange = (minutes: number) => {
    setExam((prev) => ({
      ...prev,
      durationMinutes: minutes,
      duration_minutes: minutes
    }));
  };

  const handleStartAtChange = (startAt: string) => {
    setExam((prev) => ({ ...prev, startAt, start_at: startAt }));
  };

  const handleEndAtChange = (endAt: string) => {
    setExam((prev) => ({ ...prev, endAt, end_at: endAt }));
  };

  const handleRegenerateToken = () => {
    const newToken = generateExamToken();
    setExam((prev) => ({ ...prev, examToken: newToken, pin: newToken }));
    info(`Token baru dibuat: ${newToken}`, 'Token Diperbarui');
  };

  const handleCopyToken = () => {
    const token = exam.examToken || exam.pin || '';
    if (token) {
      navigator.clipboard.writeText(token);
      success(`Token ${token} disalin ke clipboard!`, 'Token Disalin');
    }
  };

  // Question manipulation
  const handleAddQuestionManual = () => {
    const questions = exam.questions || [];
    const newSnapshot: ExamQuestionSnapshot = {
      id: `snap_${Date.now()}_${questions.length + 1}`,
      order: questions.length + 1,
      type: 'single_choice',
      questionText: '',
      options: [
        { id: `opt_1`, text: 'Pilihan A' },
        { id: `opt_2`, text: 'Pilihan B' },
        { id: `opt_3`, text: 'Pilihan C' },
        { id: `opt_4`, text: 'Pilihan D' }
      ],
      correctAnswers: ['opt_1'],
      maxScore: 2,
      required: true
    };

    const updated = [...questions, newSnapshot];
    setExam((prev) => ({
      ...prev,
      questions: updated,
      questionIds: updated.map((q) => q.id),
      totalQuestions: updated.length
    }));
    setActiveQuestionId(newSnapshot.id);
  };

  // Insert from Question Bank
  const handleAddFromBank = (selectedFromBank: Question[]) => {
    const currentQuestions = exam.questions || [];
    const newSnapshots: ExamQuestionSnapshot[] = selectedFromBank.map((q, idx) =>
      convertQuestionToSnapshot(q, currentQuestions.length + idx + 1)
    );

    const merged = [...currentQuestions, ...newSnapshots];
    setExam((prev) => ({
      ...prev,
      questions: merged,
      questionIds: merged.map((q) => q.id),
      totalQuestions: merged.length
    }));

    success(`${newSnapshots.length} soal dari Bank Soal disalin ke Ujian.`, 'Soal Ditambahkan');
    if (newSnapshots.length > 0) {
      setActiveQuestionId(newSnapshots[0].id);
    }
  };

  // Update a single snapshot
  const handleUpdateQuestion = (updatedQuestion: ExamQuestionSnapshot) => {
    const questions = exam.questions || [];
    const updatedList = questions.map((q) =>
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    setExam((prev) => ({ ...prev, questions: updatedList }));
  };

  // Move up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const list = [...(exam.questions || [])];
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;

    // Recalculate explicit order
    const ordered = list.map((q, idx) => ({ ...q, order: idx + 1 }));
    setExam((prev) => ({ ...prev, questions: ordered }));
  };

  // Move down
  const handleMoveDown = (index: number) => {
    const list = [...(exam.questions || [])];
    if (index >= list.length - 1) return;
    const temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;

    // Recalculate explicit order
    const ordered = list.map((q, idx) => ({ ...q, order: idx + 1 }));
    setExam((prev) => ({ ...prev, questions: ordered }));
  };

  // Duplicate snapshot
  const handleDuplicateQuestion = (index: number) => {
    const list = [...(exam.questions || [])];
    const source = list[index];
    const duplicated: ExamQuestionSnapshot = {
      ...source,
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      options: (source.options || []).map((o) => ({ ...o })),
      correctAnswers: source.correctAnswers ? [...source.correctAnswers] : []
    };

    list.splice(index + 1, 0, duplicated);
    const ordered = list.map((q, idx) => ({ ...q, order: idx + 1 }));
    setExam((prev) => ({ ...prev, questions: ordered, totalQuestions: ordered.length }));
    setActiveQuestionId(duplicated.id);
    info('Butir soal berhasil diduplikasi di dalam ujian.', 'Soal Diduplikasi');
  };

  // Delete snapshot
  const handleDeleteQuestion = (index: number) => {
    const list = [...(exam.questions || [])];
    list.splice(index, 1);
    const ordered = list.map((q, idx) => ({ ...q, order: idx + 1 }));
    setExam((prev) => ({ ...prev, questions: ordered, totalQuestions: ordered.length }));
    info('Butir soal dihapus dari paket ujian ini.', 'Soal Dihapus');
  };

  // Lifecycle status activation
  const handleActivateExam = async () => {
    const validation = validateExamForActivation(exam);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setShowValidationModal(true);
      return;
    }

    try {
      const res = await updateExamLifecycleStatus(exam.id, 'ACTIVE', user.displayName);
      if (res.exam) {
        setExam(res.exam);
        success('Paket ujian berhasil diaktifkan dan siap diakses murid!', 'Ujian Aktif');
        onSaved(res.exam);
      } else {
        error(res.error || 'Gagal mengaktifkan ujian.');
      }
    } catch (err: any) {
      error(err.message || 'Terjadi kesalahan saat mengaktifkan ujian.');
    }
  };

  // Deactivate / Complete
  const handleDeactivateExam = async () => {
    try {
      const res = await updateExamLifecycleStatus(exam.id, 'COMPLETED', user.displayName);
      if (res.exam) {
        setExam(res.exam);
        success('Ujian berhasil dinonaktifkan (selesai).', 'Ujian Selesai');
        onSaved(res.exam);
      }
    } catch (err: any) {
      error(err.message || 'Gagal menonaktifkan ujian.');
    }
  };

  // Duplicate entire exam
  const handleDuplicateEntireExam = async () => {
    try {
      const dup = await duplicateExam(exam, user.uid, user.displayName);
      success(`Ujian berhasil diduplikasi menjadi: "${dup.title}"`, 'Ujian Diduplikasi');
      setExam(dup);
      onSaved(dup);
    } catch (err: any) {
      error(err.message || 'Gagal menduplikasi ujian.');
    }
  };

  // Compute total points
  const totalExamPoints = useMemo(() => {
    return (exam.questions || []).reduce(
      (sum, q) => sum + (Number(q.maxScore) || 0),
      0
    );
  }, [exam.questions]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Floating Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs sticky top-2 z-30 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Kembali ke Daftar Ujian"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Paket Ujian
              </span>
              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  exam.status === 'ACTIVE' || exam.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : exam.status === 'SCHEDULED' || exam.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : exam.status === 'COMPLETED' || exam.status === 'finished'
                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {exam.status}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-1">
              {exam.title || 'Judul Paket Ujian Baru'}
            </h2>
          </div>
        </div>

        {/* Autosave Status & Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium">
            {saveStatus === 'saving' && (
              <span className="text-blue-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Menyimpan...
              </span>
            )}
            {saveStatus === 'saved_cloud' && (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tersimpan di Cloud & Lokal
              </span>
            )}
            {saveStatus === 'saved_local' && (
              <span className="text-amber-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tersimpan di Perangkat (Offline)
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Gagal menyimpan
              </span>
            )}
          </div>

          {/* Student Preview Button */}
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Pratinjau Sudut Pandang Murid"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span className="hidden md:inline">Pratinjau</span>
          </button>

          {/* Duplicate Entire Exam */}
          <button
            onClick={handleDuplicateEntireExam}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Duplikasi Ujian Ini Menjadi Draf Baru"
          >
            <Copy className="w-4 h-4 text-slate-500" />
            <span className="hidden md:inline">Duplikasi</span>
          </button>

          {/* Manual Save Button */}
          <button
            onClick={handleManualSave}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4 text-slate-600" />
            <span>Simpan Draf</span>
          </button>

          {/* Activate / Deactivate Toggle */}
          {exam.status === 'ACTIVE' || exam.status === 'active' ? (
            <button
              onClick={handleDeactivateExam}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              Nonaktifkan Ujian
            </button>
          ) : (
            <button
              onClick={handleActivateExam}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Aktifkan Ujian
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Card 1: Judul & Identitas Ujian (Google Forms Header Style) */}
        <div className="bg-white rounded-2xl border-t-8 border-t-blue-600 border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="space-y-2">
            <input
              type="text"
              value={exam.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Judul Paket Ujian (contoh: Penilaian Tengah Semester Informatika VIII-A)"
              className="w-full text-xl sm:text-2xl font-bold text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none pb-1 transition"
            />
            <textarea
              rows={2}
              value={exam.description || ''}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Petunjuk pengerjaan ujian atau deskripsi tambahan bagi peserta didik..."
              className="w-full text-xs sm:text-sm text-slate-600 border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none pb-1 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            {/* Subject Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Mata Pelajaran</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={exam.subjectId || exam.subject_id || ''}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Mata Pelajaran --</option>
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Class Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Rombongan Belajar (Kelas)</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={exam.classId || exam.class_id || (exam.classIds && exam.classIds[0]) || ''}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Kelas Sasaran --</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.grade ? `(Tingkat ${c.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Pengaturan Ujian (Durasi, Jadwal, Token, Shuffle) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Konfigurasi Waktu, Token, & Pengacakan Ujian
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Durasi Pengerjaan (Menit):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={exam.durationMinutes || exam.duration_minutes || 60}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 font-medium">Menit</span>
              </div>
            </div>

            {/* Token */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">
                Token / PIN Akses Ujian:
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="font-mono text-sm sm:text-base font-bold text-blue-700 tracking-wider">
                    {exam.examToken || exam.pin || 'Belum Ada Token'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    Salin
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Acak Ulang Token Baru"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Acak Ulang
                </button>
              </div>
            </div>

            {/* Start At */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Waktu Mulai (Jadwal):
              </label>
              <input
                type="datetime-local"
                value={exam.startAt?.substring(0, 16) || ''}
                onChange={(e) => handleStartAtChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* End At */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Waktu Selesai (Batas Akhir):
              </label>
              <input
                type="datetime-local"
                value={exam.endAt?.substring(0, 16) || ''}
                onChange={(e) => handleEndAtChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Shuffle checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={exam.shuffleQuestions ?? true}
                  onChange={(e) =>
                    setExam((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Acak Urutan Soal
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={exam.shuffleOptions ?? true}
                  onChange={(e) =>
                    setExam((prev) => ({ ...prev, shuffleOptions: e.target.checked }))
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Acak Urutan Pilihan Jawaban
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Daftar Soal Ujian */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Butir Soal Snapshot ({exam.questions?.length || 0} Soal)
              </h3>
              <p className="text-xs text-slate-500">
                Total Bobot Skor: <strong className="text-slate-800">{totalExamPoints} poin</strong> • Snapshot terisolasi dari perubahan master Question Bank.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBankModal(true)}
                className="px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <BookOpen className="w-4 h-4" />
                Pilih dari Bank Soal
              </button>

              <button
                type="button"
                onClick={handleAddQuestionManual}
                className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Buat Soal Manual
              </button>
            </div>
          </div>

          {/* Render List of Questions */}
          {(exam.questions || []).length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Belum Ada Soal di Paket Ujian Ini
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Silakan pilih soal yang sudah ada dari <strong>Bank Soal</strong> milik Anda atau buat butir soal baru secara langsung di sini.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(true)}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-4 h-4" />
                  Buka Bank Soal
                </button>
                <button
                  type="button"
                  onClick={handleAddQuestionManual}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Buat Soal Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(exam.questions || []).map((q, idx) => (
                <ExamQuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  totalQuestions={(exam.questions || []).length}
                  isActive={activeQuestionId === q.id}
                  onSelect={() => setActiveQuestionId(q.id)}
                  onChange={handleUpdateQuestion}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)}
                  onDuplicate={() => handleDuplicateQuestion(idx)}
                  onDelete={() => handleDeleteQuestion(idx)}
                />
              ))}
            </div>
          )}

          {/* Bottom Add Soal Bar */}
          {(exam.questions || []).length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowBankModal(true)}
                className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Tambah Soal dari Bank Soal
              </button>

              <button
                type="button"
                onClick={handleAddQuestionManual}
                className="px-4 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Tambah Butir Soal Manual
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Question Bank Selector */}
      <QuestionBankSelectorModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSelectQuestions={handleAddFromBank}
        defaultSubjectId={exam.subjectId || exam.subject_id}
        defaultClassId={exam.classId || exam.class_id}
        subjects={subjects}
        classes={classes}
        existingSourceQuestionIds={(exam.questions || [])
          .map((q) => q.sourceQuestionId)
          .filter(Boolean) as string[]}
      />

      {/* Modal: Validation Issues (Before Activation) */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Ujian Belum Siap Diaktifkan
                </h4>
                <p className="text-xs text-slate-500">
                  Perbaiki kendala kelengkapan berikut sebelum mengaktifkan ujian:
                </p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 max-h-56 overflow-y-auto space-y-1.5 text-xs text-amber-900 border border-amber-200">
              {validationErrors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * Anda tetap dapat menyimpan paket ini sebagai <strong>DRAF</strong> kapan saja sampai seluruh butir soal dan konfigurasi siap.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                Perbaiki Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Student View Preview */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Pratinjau Sudut Pandang Peserta Didik
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header preview */}
              <div className="border-b border-slate-200 pb-4 space-y-1">
                <h2 className="text-lg font-bold text-slate-900">{exam.title}</h2>
                <p className="text-xs text-slate-600">{exam.description || 'Tidak ada petunjuk khusus.'}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
                  <span>Mata Pelajaran: <strong>{exam.subjectName || exam.subject_name}</strong></span>
                  <span>Durasi: <strong>{exam.durationMinutes || exam.duration_minutes} Menit</strong></span>
                  <span>Total Soal: <strong>{exam.questions?.length || 0} Butir</strong></span>
                </div>
              </div>

              {/* Questions preview */}
              <div className="space-y-6">
                {(exam.questions || []).map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Soal Nomor {idx + 1}</span>
                      <span className="text-slate-500 font-normal">Bobot: {q.maxScore} poin</span>
                    </div>

                    <p className="text-sm text-slate-800 leading-relaxed font-medium">
                      {q.questionText || '(Teks soal belum diisi)'}
                    </p>

                    {q.imageUrl && (
                      <img
                        src={q.imageUrl}
                        alt="Stimulus Soal"
                        className="max-h-48 rounded object-contain border border-slate-100"
                      />
                    )}

                    {/* Options (without revealing answers) */}
                    {q.type === 'single_choice' && (
                      <div className="space-y-2 pt-1">
                        {(q.options || []).map((opt, optIdx) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs text-slate-800"
                          >
                            <span className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center font-bold text-[10px]">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'multiple_choice' && (
                      <div className="space-y-2 pt-1">
                        {(q.options || []).map((opt, optIdx) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs text-slate-800"
                          >
                            <span className="w-4 h-4 rounded border border-slate-300" />
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'true_false' && (
                      <div className="flex items-center gap-3 pt-1">
                        <button className="flex-1 py-2 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                          Benar
                        </button>
                        <button className="flex-1 py-2 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                          Salah
                        </button>
                      </div>
                    )}

                    {q.type === 'essay' && (
                      <div className="pt-1">
                        <textarea
                          disabled
                          placeholder="Tempat murid mengetikkan jawaban uraian..."
                          className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
