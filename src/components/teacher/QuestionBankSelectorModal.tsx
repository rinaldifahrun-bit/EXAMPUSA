import React, { useState, useEffect, useMemo } from 'react';
import type { Question, QuestionType, Subject, SchoolClass } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getStoredQuestions } from '../../services/questionService';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Plus,
  X,
  BookOpen,
  FileQuestion,
  Layers,
  HelpCircle
} from 'lucide-react';

interface QuestionBankSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestions: (selectedQuestions: Question[]) => void;
  defaultSubjectId?: string;
  defaultClassId?: string;
  subjects: Subject[];
  classes: SchoolClass[];
  existingSourceQuestionIds?: string[];
}

export const QuestionBankSelectorModal: React.FC<QuestionBankSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectQuestions,
  defaultSubjectId,
  defaultClassId,
  subjects,
  classes,
  existingSourceQuestionIds = []
}) => {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState(defaultSubjectId || 'ALL');
  const [filterClass, setFilterClass] = useState(defaultClassId || 'ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Selected question IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    try {
      const all = getStoredQuestions();
      // Filter by teacher ownership if not admin
      const accessible = all.filter((q) => {
        if (q.is_deleted) return false;
        if (isAdmin) return true;
        return q.owner_id === user.uid || q.owner_id === user.displayName;
      });
      setQuestions(accessible);
    } catch (e) {
      console.error('Error fetching questions for modal', e);
    } finally {
      setLoading(false);
    }
  }, [isOpen, user, isAdmin]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const textMatch = (q.question_text || '').toLowerCase().includes(query);
        const topicMatch = (q.topic || '').toLowerCase().includes(query);
        if (!textMatch && !topicMatch) return false;
      }

      // Subject
      if (filterSubject !== 'ALL' && q.subject_id !== filterSubject) {
        return false;
      }

      // Class
      if (filterClass !== 'ALL' && q.class_id !== filterClass) {
        return false;
      }

      // Type
      if (filterType !== 'ALL' && q.question_type !== filterType) {
        return false;
      }

      return true;
    });
  }, [questions, searchQuery, filterSubject, filterClass, filterType]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    const available = filteredQuestions
      .filter((q) => !existingSourceQuestionIds.includes(q.id))
      .map((q) => q.id);

    const allSelected = available.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !available.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...available]));
      setSelectedIds(merged);
    }
  };

  const handleConfirm = () => {
    const selectedObjects = questions.filter((q) => selectedIds.includes(q.id));
    onSelectQuestions(selectedObjects);
    setSelectedIds([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pilih Soal dari Bank Soal
              </h3>
              <p className="text-xs text-slate-500">
                Pilih butir soal untuk disalin sebagai snapshot ke dalam paket ujian ini.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari teks atau topik soal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Subject Filter */}
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Mata Pelajaran</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Class Filter */}
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Rombel / Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Question Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Tipe Soal</option>
            <option value="multiple_choice">Pilihan Ganda</option>
            <option value="multiple_select">PG Kompleks</option>
            <option value="true_false">Benar / Salah</option>
            <option value="essay">Uraian / Esai</option>
          </select>
        </div>

        {/* Selection summary bar */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Pilih Semua Yang Tampil
            </button>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600">
              Ditemukan: <strong className="text-slate-900">{filteredQuestions.length}</strong> soal
            </span>
          </div>

          <span className="font-semibold text-slate-700">
            Terpilih: <span className="text-blue-600 font-bold">{selectedIds.length}</span> butir
          </span>
        </div>

        {/* Questions List Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Memuat bank soal...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <FileQuestion className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              Tidak ditemukan butir soal yang sesuai filter.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isAlreadyInExam = existingSourceQuestionIds.includes(q.id);
              const isSelected = selectedIds.includes(q.id);

              let typeBadge = 'Pilihan Ganda';
              if (q.question_type === 'multiple_select') typeBadge = 'PG Kompleks';
              if (q.question_type === 'true_false') typeBadge = 'Benar / Salah';
              if (q.question_type === 'essay') typeBadge = 'Uraian';

              return (
                <div
                  key={q.id}
                  onClick={() => !isAlreadyInExam && toggleSelect(q.id)}
                  className={`p-4 rounded-xl border transition flex items-start gap-3.5 cursor-pointer ${
                    isAlreadyInExam
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    {isAlreadyInExam ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Ada
                      </span>
                    ) : isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {typeBadge}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        {q.subject_name || 'Mapel'} • {q.class_name || 'Kelas'}
                      </span>
                      {q.topic && (
                        <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded">
                          {q.topic}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-600 ml-auto">
                        Bobot: {q.points} poin
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-800 line-clamp-2 leading-relaxed">
                      {q.question_text}
                    </p>

                    {isAlreadyInExam && (
                      <p className="text-[11px] text-amber-600 italic">
                        * Butir soal ini sudah pernah dimasukkan ke dalam paket ujian ini.
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-white transition cursor-pointer"
          >
            Batal
          </button>

          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Masukkan {selectedIds.length} Soal Terpilih ke Ujian
          </button>
        </div>
      </div>
    </div>
  );
};
