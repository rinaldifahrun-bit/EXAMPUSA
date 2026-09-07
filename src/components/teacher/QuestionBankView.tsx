import React, { useState, useEffect, useMemo } from 'react';
import type { Question, QuestionBank, QuestionType, QuestionDifficulty, CognitiveLevel } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchTeacherQuestionBanks,
  deleteQuestionBank
} from '../../services/questionBankService';
import {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  duplicateQuestion
} from '../../services/questionService';
import { QuestionBuilder } from './QuestionBuilder';
import {
  Plus,
  Search,
  Layers,
  Trash2,
  Copy,
  Edit2,
  BookOpen,
  Calendar,
  School,
  Sparkles,
  ArrowRight,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  X
} from 'lucide-react';

interface QuestionBankViewProps {
  questions: Question[];
  onUpdateQuestions: (questions: Question[]) => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  questions,
  onUpdateQuestions
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  // Mode: 'list' or 'builder'
  const [builderMode, setBuilderMode] = useState(false);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);

  // Tab: 'banks' (Paket Soal) or 'items' (Semua Butir Soal)
  const [activeTab, setActiveTab] = useState<'banks' | 'items'>('banks');

  // Banks State
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);

  // Items Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  // Modal for quick manual single item edit
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Quick form state for single question modal
  const [topic, setTopic] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<{ id: string; text: string; order: number }[]>([
    { id: 'A', text: '', order: 1 },
    { id: 'B', text: '', order: 2 },
    { id: 'C', text: '', order: 3 },
    { id: 'D', text: '', order: 4 }
  ]);
  const [correctAnswer, setCorrectAnswer] = useState<string[]>(['A']);
  const [answerKey, setAnswerKey] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>('C2');
  const [points, setPoints] = useState<number>(2);

  // Load Banks
  const loadBanks = async () => {
    try {
      setLoadingBanks(true);
      const ownerId = user?.uid || 'teacher_1';
      const loaded = await fetchTeacherQuestionBanks(ownerId, user?.role === 'admin');
      setBanks(loaded);
    } catch (err) {
      console.error('Gagal memuat bank soal:', err);
    } finally {
      setLoadingBanks(false);
    }
  };

  useEffect(() => {
    loadBanks();
  }, [user]);

  // Handle Delete Bank
  const handleDeleteBank = async (bankId: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus paket bank soal "${title}"?`)) {
      return;
    }
    try {
      await deleteQuestionBank(bankId);
      setBanks(banks.filter((b) => b.id !== bankId));
      success('Bank soal berhasil dihapus.', 'Terhapus');
    } catch (err) {
      error('Gagal menghapus bank soal.');
    }
  };

  // Filtered single questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.is_deleted) return false;
      const matchSearch =
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.topic.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === 'all' || q.question_type === typeFilter;
      const matchDiff = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
      return matchSearch && matchType && matchDiff;
    });
  }, [questions, searchQuery, typeFilter, difficultyFilter]);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setTopic('');
    setLearningObjective('');
    setQuestionType('multiple_choice');
    setQuestionText('');
    setOptions([
      { id: 'A', text: '', order: 1 },
      { id: 'B', text: '', order: 2 },
      { id: 'C', text: '', order: 3 },
      { id: 'D', text: '', order: 4 }
    ]);
    setCorrectAnswer(['A']);
    setAnswerKey('');
    setExplanation('');
    setDifficulty('medium');
    setCognitiveLevel('C2');
    setPoints(2);
    setActiveModal('create');
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setTopic(q.topic);
    setLearningObjective(q.learning_objective);
    setQuestionType(q.question_type);
    setQuestionText(q.question_text);
    setOptions(
      q.options.length > 0
        ? q.options
        : [
            { id: 'A', text: '', order: 1 },
            { id: 'B', text: '', order: 2 },
            { id: 'C', text: '', order: 3 },
            { id: 'D', text: '', order: 4 }
          ]
    );
    setCorrectAnswer(q.correct_answer || []);
    setAnswerKey(q.answer_key || '');
    setExplanation(q.explanation || '');
    setDifficulty(q.difficulty);
    setCognitiveLevel(q.cognitive_level || 'C2');
    setPoints(q.points);
    setActiveModal('edit');
  };

  const handleSaveQuestion = () => {
    if (!questionText.trim()) {
      error('Teks pertanyaan wajib diisi!');
      return;
    }

    if (questionType === 'multiple_choice' || questionType === 'multiple_select') {
      const filledOptions = options.filter((o) => o.text.trim().length > 0);
      if (filledOptions.length < 2) {
        error('Soal pilihan ganda minimal memerlukan 2 opsi!');
        return;
      }
      if (correctAnswer.length === 0) {
        error('Pilih setidaknya 1 kunci jawaban yang benar!');
        return;
      }
    }

    if (activeModal === 'create') {
      const newQ = addQuestion({
        owner_id: user?.uid || 'teacher_1',
        subject_id: 'subj_inf',
        subject_name: 'Informatika',
        class_id: 'cls_7a',
        class_name: 'VII-A',
        topic: topic || 'Materi Umum',
        learning_objective: learningObjective || 'Pemahaman Konsep',
        question_type: questionType,
        question_text: questionText,
        options: questionType === 'essay' ? [] : options,
        correct_answer: questionType === 'essay' ? [] : correctAnswer,
        answer_key: answerKey,
        explanation,
        difficulty,
        cognitive_level: cognitiveLevel,
        points: points || 2,
        grading_method: questionType === 'multiple_select' ? 'partial_credit' : 'all_or_nothing',
        status: 'ready',
        source: 'manual'
      });
      onUpdateQuestions([newQ, ...questions]);
      success('Butir soal baru berhasil ditambahkan ke Bank Soal!', 'Berhasil');
    } else if (activeModal === 'edit' && editingQuestion) {
      const updated = updateQuestion(editingQuestion.id, {
        topic,
        learning_objective: learningObjective,
        question_type: questionType,
        question_text: questionText,
        options: questionType === 'essay' ? [] : options,
        correct_answer: questionType === 'essay' ? [] : correctAnswer,
        answer_key: answerKey,
        explanation,
        difficulty,
        cognitive_level: cognitiveLevel,
        points: points || 2,
        status: 'ready'
      });
      if (updated) {
        onUpdateQuestions(questions.map((q) => (q.id === updated.id ? updated : q)));
        success('Butir soal berhasil diperbarui!', 'Berhasil');
      }
    }

    setActiveModal(null);
  };

  const handleDeleteItem = (id: string) => {
    deleteQuestion(id);
    onUpdateQuestions(questions.filter((q) => q.id !== id));
    success('Soal berhasil dihapus dari Bank Soal.', 'Terhapus');
  };

  const handleDuplicateItem = (id: string) => {
    const duplicated = duplicateQuestion(id);
    if (duplicated) {
      onUpdateQuestions([duplicated, ...questions]);
      success('Soal berhasil diduplikasi.', 'Duplikasi Sukses');
    }
  };

  // If in Question Builder Mode, render full QuestionBuilder component
  if (builderMode) {
    return (
      <QuestionBuilder
        existingBank={selectedBank}
        onBack={() => {
          setBuilderMode(false);
          setSelectedBank(null);
          loadBanks();
        }}
        onSaved={() => {
          setBuilderMode(false);
          setSelectedBank(null);
          loadBanks();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Modul Bank Soal Guru
            </span>
            <span className="text-xs text-slate-500 font-medium">EXAMPUSA — SMPN 1 Puspo</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Bank Soal & Asesmen
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Pusat perancangan butir soal format Google Forms. Mendukung Pilihan Ganda tunggal, Pilihan Ganda Kompleks (skor per opsi), Benar/Salah, dan Uraian.
          </p>
        </div>

        {/* Primary Action: Google Forms-like Question Builder */}
        <button
          type="button"
          onClick={() => {
            setSelectedBank(null);
            setBuilderMode(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Bank Soal Baru (Question Builder)</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('banks')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'banks'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Paket Bank Soal ({banks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'items'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>Semua Butir Soal Individu ({questions.length})</span>
        </button>
      </div>

      {/* ================================================================ */}
      {/* TAB 1: PAKET BANK SOAL                                           */}
      {/* ================================================================ */}
      {activeTab === 'banks' && (
        <div className="space-y-4">
          {loadingBanks ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-xs shadow-xs flex flex-col items-center gap-2">
              <Clock className="w-5 h-5 animate-spin text-blue-600" />
              <span>Memuat daftar paket bank soal...</span>
            </div>
          ) : banks.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <FileQuestion className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Belum Ada Paket Bank Soal</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Mulai rancang paket asesmen pertama Anda menggunakan antarmuka interaktif Question Builder Google Forms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBank(null);
                  setBuilderMode(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Bank Soal Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banks.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-blue-400 hover:shadow-sm transition flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'ready'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {b.status === 'ready' ? 'Siap Digunakan' : 'Draft'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(b.updatedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {b.title}
                      </h3>
                      {b.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {b.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {b.subjectName || 'Informatika'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center gap-1">
                        <School className="w-3 h-3" />
                        Kelas {b.className || 'VII-A'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-600 font-medium">
                      <span>{b.questionsCount || 0} Soal</span> • <strong className="text-slate-900">{b.totalPoints || 0} Poin</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteBank(b.id, b.title)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus Bank Soal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBank(b);
                          setBuilderMode(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>Buka Builder</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: SEMUA BUTIR SOAL INDIVIDU                                 */}
      {/* ================================================================ */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari teks soal atau topik..."
                className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Jenis:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent text-slate-800 font-semibold focus:outline-none text-xs cursor-pointer"
                >
                  <option value="all">Semua Jenis</option>
                  <option value="multiple_choice">Pilihan Ganda</option>
                  <option value="multiple_select">PG Kompleks</option>
                  <option value="true_false">Benar/Salah</option>
                  <option value="essay">Uraian/Essay</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Kesulitan:</span>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="bg-transparent text-slate-800 font-semibold focus:outline-none text-xs cursor-pointer"
                >
                  <option value="all">Semua Kesulitan</option>
                  <option value="easy">Mudah (C1-C2)</option>
                  <option value="medium">Sedang (C3)</option>
                  <option value="hard">Sukar (C4)</option>
                  <option value="hots">HOTS (C5-C6)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer ml-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Butir Cepat</span>
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-xs shadow-xs">
                Tidak ditemukan butir soal yang sesuai dengan filter pencarian.
              </div>
            ) : (
              filteredQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-400 font-mono">#{idx + 1}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {q.question_type === 'multiple_choice'
                          ? 'Pilihan Ganda'
                          : q.question_type === 'multiple_select'
                          ? 'PG Kompleks'
                          : q.question_type === 'true_false'
                          ? 'Benar/Salah'
                          : 'Uraian/Essay'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-xs">
                        Topik: {q.topic}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200 text-xs">
                        {q.points} Poin
                      </span>
                      {q.cognitive_level && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-mono font-medium">
                          {q.cognitive_level}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleDuplicateItem(q.id)}
                        title="Duplikasi Soal"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(q)}
                        title="Edit Soal"
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(q.id)}
                        title="Hapus Soal"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-semibold text-slate-900 mt-3 leading-relaxed">
                    {q.question_text}
                  </p>

                  {/* Question Image Preview */}
                  {q.imageRef && (
                    <div className="mt-3 max-w-xs rounded-lg overflow-hidden border border-slate-200">
                      <img src={q.imageRef} alt="Lampiran" className="max-h-40 w-auto object-contain" />
                    </div>
                  )}

                  {/* Options Preview */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                      {q.options.map((opt) => {
                        const isCorrect = q.correct_answer?.includes(opt.id) || (opt.score || 0) > 0;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0 ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <span className="truncate flex-1">{opt.text}</span>
                            {opt.score !== undefined && opt.score > 0 && (
                              <span className="text-[10px] text-emerald-700 font-mono">({opt.score} pt)</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Essay Answer Key / Rubric Preview */}
                  {q.question_type === 'essay' && (q.answer_key || q.expectedAnswer) && (
                    <div className="mt-3 p-3 rounded-lg bg-blue-50/50 border border-blue-200 text-xs">
                      <p className="text-[10px] font-bold uppercase text-blue-700 mb-1">
                        Pedoman Jawaban & Rubrik:
                      </p>
                      <p className="text-slate-800 whitespace-pre-line font-mono text-[11px]">
                        {q.expectedAnswer || q.answer_key}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* QUICK MODAL (FOR SINGLE ITEM EDIT)                              */}
      {/* ================================================================ */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {activeModal === 'create' ? 'Tambah Butir Soal Cepat' : 'Edit Butir Soal'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Tipe Pertanyaan:</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-bold"
                >
                  <option value="multiple_choice">Pilihan Ganda</option>
                  <option value="multiple_select">PG Kompleks</option>
                  <option value="true_false">Benar / Salah</option>
                  <option value="essay">Uraian / Essay</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Teks Soal:</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Tuliskan pertanyaan..."
                  rows={3}
                  className="w-full mt-1 p-3 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Topik / Materi:</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Contoh: Perangkat Keras"
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Poin Soal:</label>
                  <input
                    type="number"
                    min="1"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
