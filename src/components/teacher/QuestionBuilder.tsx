import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type {
  QuestionBank,
  Question,
  Subject,
  SchoolClass,
  QuestionType
} from '../../types';
import {
  fetchTeacherAllowedScope,
  fetchQuestionsByBankId,
  saveQuestionBankAndQuestions
} from '../../services/questionBankService';
import { QuestionCard } from './QuestionCard';
import {
  Plus,
  ArrowLeft,
  Save,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle,
  FileCheck,
  Check,
  X,
  Layers,
  BookOpen,
  School
} from 'lucide-react';

interface QuestionBuilderProps {
  existingBank?: QuestionBank | null;
  onBack: () => void;
  onSaved?: (bank: QuestionBank) => void;
}

type SaveStatus = 'saved' | 'saving' | 'offline_saved' | 'error';

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({
  existingBank,
  onBack,
  onSaved
}) => {
  const { user, isFirebaseOnline } = useAuth();
  const { success, error: toastError } = useToast();

  // Allowed Scope from Teacher Assignment
  const [allowedSubjects, setAllowedSubjects] = useState<Subject[]>([]);
  const [classesBySubject, setClassesBySubject] = useState<Record<string, SchoolClass[]>>({});
  const [loadingScope, setLoadingScope] = useState(true);

  // Bank Info State
  const [bankId] = useState<string>(
    existingBank?.id || `bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  );
  const [title, setTitle] = useState(existingBank?.title || '');
  const [description, setDescription] = useState(existingBank?.description || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(existingBank?.subjectId || '');
  const [selectedClassId, setSelectedClassId] = useState(existingBank?.classId || '');

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Status & UI State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveMessage, setSaveMessage] = useState('Semua perubahan tersimpan');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  // Debounce Timer Ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load Allowed Scope (Subjects & Classes assigned to this teacher)
  useEffect(() => {
    async function initScope() {
      try {
        setLoadingScope(true);
        const teacherUidOrNip = user?.nip || user?.uid || 'teacher_1';
        const scope = await fetchTeacherAllowedScope(teacherUidOrNip);

        setAllowedSubjects(scope.allowedSubjects);
        setClassesBySubject(scope.allowedClassesBySubject);

        // Set default subject if not yet set
        if (!selectedSubjectId && scope.allowedSubjects.length > 0) {
          const defaultSubj = scope.allowedSubjects[0].id;
          setSelectedSubjectId(defaultSubj);
          const relatedClasses = scope.allowedClassesBySubject[defaultSubj] || [];
          if (relatedClasses.length > 0) {
            setSelectedClassId(relatedClasses[0].id);
          }
        }
      } catch (err) {
        console.error('Gagal memuat penugasan guru:', err);
      } finally {
        setLoadingScope(false);
      }
    }
    initScope();
  }, [user]);

  // 2. Load Existing Questions if Editing
  useEffect(() => {
    async function loadQuestions() {
      if (existingBank) {
        const loaded = await fetchQuestionsByBankId(existingBank.id);
        if (loaded.length > 0) {
          setQuestions(loaded);
          setActiveQuestionId(loaded[0].id);
        } else {
          initDefaultFirstQuestion();
        }
      } else {
        initDefaultFirstQuestion();
      }
      setIsInitialLoaded(true);
    }

    function initDefaultFirstQuestion() {
      const firstQ: Question = {
        id: `q_${Date.now()}_1`,
        bankId,
        bank_id: bankId,
        owner_id: user?.uid || 'teacher_1',
        subject_id: selectedSubjectId,
        class_id: selectedClassId,
        topic: 'Umum',
        learning_objective: '',
        question_type: 'multiple_choice',
        question_text: '',
        options: [
          { id: `opt_${Date.now()}_1`, text: 'Pilihan 1', order: 1 },
          { id: `opt_${Date.now()}_2`, text: 'Pilihan 2', order: 2 },
          { id: `opt_${Date.now()}_3`, text: 'Pilihan 3', order: 3 },
          { id: `opt_${Date.now()}_4`, text: 'Pilihan 4', order: 4 }
        ],
        correct_answer: [`opt_${Date.now()}_1`],
        points: 2,
        required: true,
        order: 1,
        difficulty: 'medium',
        status: 'draft',
        source: 'manual',
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setQuestions([firstQ]);
      setActiveQuestionId(firstQ.id);
    }

    loadQuestions();
  }, [existingBank]);

  // Update classes when subject selection changes
  const handleSubjectChange = (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
    const available = classesBySubject[newSubjectId] || [];
    if (available.length > 0) {
      setSelectedClassId(available[0].id);
    } else {
      setSelectedClassId('');
    }
  };

  // Validation Logic
  const currentSubjectObj = allowedSubjects.find((s) => s.id === selectedSubjectId);
  const currentClassList = classesBySubject[selectedSubjectId] || [];
  const currentClassObj = currentClassList.find((c) => c.id === selectedClassId);

  const validationIssues: string[] = [];
  if (!title.trim()) validationIssues.push('Judul bank soal tidak boleh kosong.');
  if (!selectedSubjectId) validationIssues.push('Pilih mata pelajaran yang diampu.');
  if (!selectedClassId) validationIssues.push('Pilih kelas sasaran.');
  if (questions.length === 0) validationIssues.push('Minimal harus ada 1 soal.');

  questions.forEach((q, idx) => {
    if (!q.question_text.trim()) {
      validationIssues.push(`Soal #${idx + 1}: Pertanyaan belum diisi.`);
    }
    if (q.question_type === 'multiple_choice') {
      if (q.options.length < 2) {
        validationIssues.push(`Soal #${idx + 1}: Pilihan Ganda minimal 2 pilihan.`);
      }
      if (q.correct_answer.length !== 1) {
        validationIssues.push(`Soal #${idx + 1}: Pilihan Ganda harus memilih tepat 1 jawaban benar.`);
      }
    } else if (q.question_type === 'multiple_select') {
      if (q.options.length < 2) {
        validationIssues.push(`Soal #${idx + 1}: Pilihan Ganda Kompleks minimal 2 pilihan.`);
      }
      const hasPositiveScore = q.options.some((o) => (o.score || 0) > 0);
      if (!hasPositiveScore) {
        validationIssues.push(`Soal #${idx + 1}: Minimal 1 opsi PG Kompleks harus memiliki skor > 0.`);
      }
    } else if (q.question_type === 'true_false') {
      if (q.correct_answer.length === 0) {
        validationIssues.push(`Soal #${idx + 1}: Benar/Salah harus memilih kunci jawaban.`);
      }
    } else if (q.question_type === 'essay') {
      if (!q.points || q.points <= 0) {
        validationIssues.push(`Soal #${idx + 1}: Skor maksimum uraian harus lebih besar dari 0.`);
      }
    }
  });

  const isReady = validationIssues.length === 0;

  // 3. Core Save Function (Autosave & Manual)
  const executeSave = useCallback(
    async (isManual = false) => {
      if (!isInitialLoaded) return;

      const bankPayload: QuestionBank = {
        id: bankId,
        title: title.trim() || 'Bank Soal Tanpa Judul (Draft)',
        description: description.trim(),
        subjectId: selectedSubjectId,
        subjectName: currentSubjectObj?.name || 'Informatika',
        classId: selectedClassId,
        className: currentClassObj?.name || 'VII-A',
        ownerId: user?.uid || 'teacher_1',
        ownerName: user?.displayName || 'Guru Pengampu',
        status: isReady ? 'ready' : 'draft',
        questionsCount: questions.length,
        totalPoints: questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
        createdAt: existingBank?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setSaveStatus('saving');
      setSaveMessage('Menyimpan perubahan...');

      try {
        const result = await saveQuestionBankAndQuestions(
          bankPayload,
          questions,
          !isReady // isDraft
        );

        if (result.cloudSynced) {
          setSaveStatus('saved');
          setSaveMessage('Tersimpan di Cloud & Lokal');
        } else {
          setSaveStatus('offline_saved');
          setSaveMessage('Tersimpan di Perangkat (Offline)');
        }

        if (isManual) {
          if (isReady) {
            success('Bank soal berhasil disimpan dan siap digunakan.', 'Tersimpan');
          } else {
            success('Draft bank soal berhasil disimpan di perangkat.', 'Draft Tersimpan');
          }
          if (onSaved) onSaved(bankPayload);
        }
      } catch (err: any) {
        console.error('Gagal menyimpan bank soal:', err);
        setSaveStatus('error');
        setSaveMessage('Gagal menyimpan perubahan');
        if (isManual) toastError('Gagal menyimpan bank soal.');
      }
    },
    [
      isInitialLoaded,
      bankId,
      title,
      description,
      selectedSubjectId,
      selectedClassId,
      currentSubjectObj,
      currentClassObj,
      user,
      isReady,
      questions,
      existingBank,
      onSaved,
      success,
      toastError
    ]
  );

  // Trigger Debounced Autosave on changes
  useEffect(() => {
    if (!isInitialLoaded) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('saving');
    setSaveMessage('Menyimpan otomatis...');

    debounceTimerRef.current = setTimeout(() => {
      executeSave(false);
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, description, selectedSubjectId, selectedClassId, questions, executeSave, isInitialLoaded]);

  // Question Manipulations
  const handleAddQuestion = (type: QuestionType = 'multiple_choice') => {
    const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newQ: Question = {
      id: newId,
      bankId,
      bank_id: bankId,
      owner_id: user?.uid || 'teacher_1',
      subject_id: selectedSubjectId,
      class_id: selectedClassId,
      topic: 'Topik Baru',
      learning_objective: '',
      question_type: type,
      question_text: '',
      options:
        type === 'multiple_choice'
          ? [
              { id: `opt_${Date.now()}_1`, text: 'Pilihan 1', order: 1 },
              { id: `opt_${Date.now()}_2`, text: 'Pilihan 2', order: 2 },
              { id: `opt_${Date.now()}_3`, text: 'Pilihan 3', order: 3 },
              { id: `opt_${Date.now()}_4`, text: 'Pilihan 4', order: 4 }
            ]
          : type === 'multiple_select'
          ? [
              { id: `opt_${Date.now()}_1`, text: 'Pilihan 1', score: 2, order: 1 },
              { id: `opt_${Date.now()}_2`, text: 'Pilihan 2', score: 0, order: 2 },
              { id: `opt_${Date.now()}_3`, text: 'Pilihan 3', score: 2, order: 3 },
              { id: `opt_${Date.now()}_4`, text: 'Pilihan 4', score: 1, order: 4 }
            ]
          : type === 'true_false'
          ? [
              { id: 'opt_true', text: 'Benar', order: 1 },
              { id: 'opt_false', text: 'Salah', order: 2 }
            ]
          : [],
      correct_answer:
        type === 'multiple_choice'
          ? [`opt_${Date.now()}_1`]
          : type === 'multiple_select'
          ? [`opt_${Date.now()}_1`, `opt_${Date.now()}_3`]
          : type === 'true_false'
          ? ['opt_true']
          : [],
      points: type === 'essay' ? 10 : type === 'multiple_select' ? 5 : type === 'true_false' ? 1 : 2,
      required: true,
      order: questions.length + 1,
      difficulty: 'medium',
      status: 'draft',
      source: 'manual',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setQuestions([...questions, newQ]);
    setActiveQuestionId(newId);
  };

  const handleUpdateQuestion = (updatedQ: Question) => {
    setQuestions(questions.map((q) => (q.id === updatedQ.id ? updatedQ : q)));
  };

  const handleDuplicateQuestion = (idx: number) => {
    const target = questions[idx];
    const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicatedOptions = target.options.map((opt) => ({
      ...opt,
      id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    }));

    // Map old correct answer to new IDs
    const idMap = new Map<string, string>();
    target.options.forEach((oldOpt, i) => {
      idMap.set(oldOpt.id, duplicatedOptions[i].id);
    });

    const duplicatedCorrectAnswer = target.correct_answer.map(
      (oldId) => idMap.get(oldId) || oldId
    );

    const duplicated: Question = {
      ...target,
      id: newId,
      options: duplicatedOptions,
      correct_answer: duplicatedCorrectAnswer,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const nextList = [...questions];
    nextList.splice(idx + 1, 0, duplicated);
    setQuestions(nextList);
    setActiveQuestionId(newId);
  };

  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      // Clear instead of removing last question
      handleUpdateQuestion({
        ...questions[0],
        question_text: '',
        imageRef: undefined
      });
      return;
    }
    const nextList = questions.filter((_, i) => i !== idx);
    setQuestions(nextList);
    if (activeQuestionId === questions[idx].id) {
      setActiveQuestionId(nextList[Math.max(0, idx - 1)]?.id || null);
    }
  };

  const handleMoveQuestion = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= questions.length) return;
    const nextList = [...questions];
    const [moved] = nextList.splice(fromIdx, 1);
    nextList.splice(toIdx, 0, moved);
    setQuestions(nextList);
  };

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100/60 pb-20">
      {/* Sticky Top Header Bar (Google Forms Inspired) */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
              title="Kembali ke Bank Soal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-slate-900 truncate">
                  {title.trim() || 'Bank Soal Baru'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    isReady
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {isReady ? 'Siap' : 'Draft'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="w-3 h-3 animate-spin" /> {saveMessage}
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> {saveMessage}
                  </span>
                )}
                {saveStatus === 'offline_saved' && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <WifiOff className="w-3 h-3" /> {saveMessage}
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-rose-600">
                    <AlertTriangle className="w-3 h-3" /> {saveMessage}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
              title="Pratinjau Tampilan Ujian"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Pratinjau</span>
            </button>

            <button
              type="button"
              onClick={() => executeSave(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {/* ============================================================== */}
        {/* HEADER CARD: TITLE, DESCRIPTION, SUBJECT, CLASS               */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl border-t-8 border-t-blue-600 border-x border-b border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Bank Soal (contoh: Asesmen Sumatif Informatika Bab 1)"
              className="w-full text-xl sm:text-2xl font-black text-slate-900 placeholder:text-slate-300 border-0 border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:ring-0 focus:outline-none transition pb-1"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi bank soal, instruksi pengerjaan, atau catatan kompetensi dasar (opsional)..."
              rows={2}
              className="w-full text-xs sm:text-sm text-slate-600 placeholder:text-slate-400 border-0 border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:ring-0 focus:outline-none transition resize-none pt-1"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subject Selector strictly from Teacher Assignment */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                Mata Pelajaran:
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                disabled={loadingScope}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {allowedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Hanya menampilkan mata pelajaran dari penetapan penugasan guru.
              </p>
            </div>

            {/* Class Selector strictly from Teacher Assignment for selected subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-blue-600" />
                Rombongan Belajar (Kelas):
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={loadingScope || currentClassList.length === 0}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {currentClassList.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                {currentClassList.length > 0
                  ? `Tersedia ${currentClassList.length} kelas diampu untuk mapel ini.`
                  : 'Belum ada kelas yang ditugaskan untuk mapel ini.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Validation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-4 text-slate-600 font-semibold">
              <span>
                Total Soal: <strong className="text-slate-900">{questions.length}</strong>
              </span>
              <span>•</span>
              <span>
                Total Skor: <strong className="text-blue-600">{totalPoints} poin</strong>
              </span>
            </div>

            {!isReady && (
              <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[11px] font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Ada {validationIssues.length} catatan validasi (tersimpan sebagai draft)</span>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* LIST OF QUESTION CARDS                                         */}
        {/* ============================================================== */}
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              totalQuestions={questions.length}
              isActive={activeQuestionId === q.id}
              onFocus={() => setActiveQuestionId(q.id)}
              onChange={handleUpdateQuestion}
              onDuplicate={() => handleDuplicateQuestion(idx)}
              onDelete={() => handleDeleteQuestion(idx)}
              onMoveUp={() => handleMoveQuestion(idx, idx - 1)}
              onMoveDown={() => handleMoveQuestion(idx, idx + 1)}
            />
          ))}
        </div>

        {/* ============================================================== */}
        {/* BOTTOM ACTION: ADD QUESTION BUTTON (LARGE GOOGLE FORMS STYLE)  */}
        {/* ============================================================== */}
        <div className="pt-2">
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-4 hover:border-blue-500 transition text-center shadow-xs">
            <p className="text-xs font-semibold text-slate-500 mb-3">
              Tambahkan pertanyaan baru ke dalam bank soal ini:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleAddQuestion('multiple_choice')}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Pilihan Ganda</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddQuestion('multiple_select')}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ PG Kompleks</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddQuestion('true_false')}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Benar / Salah</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddQuestion('essay')}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Uraian (Essay)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE PREVIEW MODAL (STUDENT PERSPECTIVE)                */}
      {/* ============================================================== */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  <Eye className="w-3.5 h-3.5" /> Pratinjau Tampilan Ujian Murid
                </div>
                <h3 className="text-lg font-bold text-slate-900">{title || 'Bank Soal Tanpa Judul'}</h3>
                <p className="text-xs text-slate-500">
                  {currentSubjectObj?.name} • Kelas {currentClassObj?.name} • Total {questions.length} Soal ({totalPoints} Poin)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div key={q.id} className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      Soal #{qIdx + 1}
                      {q.required && <span className="text-rose-500 ml-1">*</span>}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {q.points} poin
                    </span>
                  </div>

                  <p className="text-sm text-slate-900 whitespace-pre-wrap font-medium">
                    {q.question_text || '(Pertanyaan belum ditulis)'}
                  </p>

                  {q.imageRef && (
                    <div className="max-w-md rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img src={q.imageRef} alt="Lampiran Soal" className="max-h-52 w-auto object-contain" />
                    </div>
                  )}

                  {/* Options Preview */}
                  {q.question_type === 'multiple_choice' && (
                    <div className="space-y-2 pt-1">
                      {q.options.map((opt, oIdx) => (
                        <div key={opt.id} className="flex items-center gap-2 text-xs text-slate-700">
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center shrink-0" />
                          <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                          <span>{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === 'multiple_select' && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-semibold text-indigo-700">
                        (Dapat memilih lebih dari 1 jawaban)
                      </p>
                      {q.options.map((opt, oIdx) => (
                        <div key={opt.id} className="flex items-center gap-2 text-xs text-slate-700">
                          <div className="w-4 h-4 rounded-md border-2 border-slate-300 flex items-center justify-center shrink-0" />
                          <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                          <span>{opt.text}</span>
                          <span className="text-[10px] text-slate-400">({opt.score || 0} pt)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === 'true_false' && (
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                        <span>Benar</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                        <span>Salah</span>
                      </label>
                    </div>
                  )}

                  {q.question_type === 'essay' && (
                    <div className="pt-1">
                      <textarea
                        disabled
                        placeholder="Kolom jawaban uraian murid..."
                        rows={3}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-slate-400 resize-none cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
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
