import React, { useRef } from 'react';
import type { Question, QuestionType, QuestionOption } from '../../types';
import { processImageFile } from '../../utils/imageHelper';
import {
  CircleDot,
  CheckSquare,
  ToggleRight,
  AlignLeft,
  Image as ImageIcon,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  AlertCircle,
  HelpCircle,
  UploadCloud,
  Check
} from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  index: number;
  totalQuestions: number;
  isActive: boolean;
  onFocus: () => void;
  onChange: (updated: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  totalQuestions,
  isActive,
  onFocus,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown
}) => {
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  const optionImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Question Type Change Handler
  const handleTypeChange = (newType: QuestionType) => {
    let updatedOptions = [...question.options];
    let updatedCorrectAnswer = [...question.correct_answer];
    let updatedPoints = question.points;

    if (newType === 'multiple_choice') {
      if (updatedOptions.length === 0) {
        updatedOptions = [
          { id: `opt_${Date.now()}_1`, text: 'Pilihan 1', order: 1 },
          { id: `opt_${Date.now()}_2`, text: 'Pilihan 2', order: 2 },
          { id: `opt_${Date.now()}_3`, text: 'Pilihan 3', order: 3 },
          { id: `opt_${Date.now()}_4`, text: 'Pilihan 4', order: 4 }
        ];
      }
      updatedCorrectAnswer = [updatedOptions[0]?.id || 'opt_1'];
      updatedPoints = 2;
    } else if (newType === 'multiple_select') {
      if (updatedOptions.length === 0) {
        updatedOptions = [
          { id: `opt_${Date.now()}_1`, text: 'Pilihan 1', score: 2, order: 1 },
          { id: `opt_${Date.now()}_2`, text: 'Pilihan 2', score: 0, order: 2 },
          { id: `opt_${Date.now()}_3`, text: 'Pilihan 3', score: 2, order: 3 },
          { id: `opt_${Date.now()}_4`, text: 'Pilihan 4', score: 1, order: 4 }
        ];
      } else {
        // Ensure options have default scores
        updatedOptions = updatedOptions.map((o) => ({
          ...o,
          score: o.score !== undefined ? o.score : 1
        }));
      }
      updatedCorrectAnswer = updatedOptions
        .filter((o) => (o.score || 0) > 0)
        .map((o) => o.id);
      // Sum positive scores as max points
      const sumPoints = updatedOptions.reduce((acc, o) => acc + Math.max(0, o.score || 0), 0);
      updatedPoints = sumPoints > 0 ? sumPoints : 5;
    } else if (newType === 'true_false') {
      updatedOptions = [
        { id: 'opt_true', text: 'Benar', order: 1 },
        { id: 'opt_false', text: 'Salah', order: 2 }
      ];
      updatedCorrectAnswer = ['opt_true'];
      updatedPoints = 1;
    } else if (newType === 'essay') {
      updatedOptions = [];
      updatedCorrectAnswer = [];
      updatedPoints = 10;
    }

    onChange({
      ...question,
      question_type: newType,
      options: updatedOptions,
      correct_answer: updatedCorrectAnswer,
      points: updatedPoints
    });
  };

  // Image Upload on Question
  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageFile(file);
      onChange({ ...question, imageRef: dataUrl });
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah gambar');
    }
    if (questionImageInputRef.current) {
      questionImageInputRef.current.value = '';
    }
  };

  // Image Upload on Specific Option
  const handleOptionImageUpload = async (optionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageFile(file);
      const updatedOptions = question.options.map((opt) =>
        opt.id === optionId ? { ...opt, imageRef: dataUrl } : opt
      );
      onChange({ ...question, options: updatedOptions });
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah gambar opsi');
    }
  };

  // Option Operations
  const handleAddOption = () => {
    const newId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newOption: QuestionOption = {
      id: newId,
      text: `Pilihan ${question.options.length + 1}`,
      score: question.question_type === 'multiple_select' ? 1 : undefined,
      order: question.options.length + 1
    };
    const updatedOptions = [...question.options, newOption];
    let updatedPoints = question.points;
    if (question.question_type === 'multiple_select') {
      updatedPoints = updatedOptions.reduce((sum, o) => sum + Math.max(0, o.score || 0), 0);
    }
    onChange({
      ...question,
      options: updatedOptions,
      points: updatedPoints
    });
  };

  const handleUpdateOptionText = (optId: string, text: string) => {
    const updated = question.options.map((o) => (o.id === optId ? { ...o, text } : o));
    onChange({ ...question, options: updated });
  };

  const handleUpdateOptionScore = (optId: string, scoreStr: string) => {
    const scoreNum = scoreStr === '' ? 0 : Number(scoreStr);
    const updated = question.options.map((o) => (o.id === optId ? { ...o, score: scoreNum } : o));
    // Recompute total max points for multiple_select
    const sumPoints = updated.reduce((sum, o) => sum + Math.max(0, o.score || 0), 0);
    const updatedCorrectAnswer = updated.filter((o) => (o.score || 0) > 0).map((o) => o.id);
    onChange({
      ...question,
      options: updated,
      points: sumPoints > 0 ? sumPoints : 1,
      correct_answer: updatedCorrectAnswer
    });
  };

  const handleRemoveOption = (optId: string) => {
    if (question.options.length <= 2) {
      alert('Soal pilihan harus memiliki minimal 2 pilihan jawaban.');
      return;
    }
    const updated = question.options.filter((o) => o.id !== optId);
    let updatedCorrect = question.correct_answer.filter((id) => id !== optId);
    if (question.question_type === 'multiple_choice' && updatedCorrect.length === 0 && updated.length > 0) {
      updatedCorrect = [updated[0].id];
    }
    let updatedPoints = question.points;
    if (question.question_type === 'multiple_select') {
      updatedPoints = updated.reduce((sum, o) => sum + Math.max(0, o.score || 0), 0);
    }
    onChange({
      ...question,
      options: updated,
      correct_answer: updatedCorrect,
      points: updatedPoints
    });
  };

  const handleSelectCorrectSingle = (optId: string) => {
    onChange({
      ...question,
      correct_answer: [optId]
    });
  };

  return (
    <div
      onClick={onFocus}
      className={`bg-white rounded-2xl transition-all duration-200 p-5 sm:p-6 shadow-xs border ${
        isActive
          ? 'border-blue-500 ring-2 ring-blue-500/10 border-l-4 border-l-blue-600 shadow-sm'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Header: Question Number, Type Selector, Drag/Move Order */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center border border-blue-200">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-slate-700">
            Pertanyaan #{index + 1}
          </span>
          {question.required && (
            <span className="text-[11px] font-semibold text-rose-500">* Wajib</span>
          )}
        </div>

        {/* Question Type Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-500 sr-only">Tipe Soal:</label>
          <div className="relative">
            <select
              value={question.question_type}
              onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
              className="pl-3 pr-8 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-slate-800 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition cursor-pointer appearance-none shadow-2xs"
            >
              <option value="multiple_choice">○ Pilihan Ganda</option>
              <option value="multiple_select">☑ Pilihan Ganda Kompleks</option>
              <option value="true_false">◑ Benar / Salah</option>
              <option value="essay">≡ Uraian (Essay)</option>
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Main Question Text & Image Area */}
      <div className="pt-4 space-y-4">
        <div>
          <textarea
            value={question.question_text}
            onChange={(e) => onChange({ ...question, question_text: e.target.value })}
            placeholder="Tulis pertanyaan atau stimulus soal di sini..."
            rows={2}
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* Question Image Preview / Upload */}
        {question.imageRef ? (
          <div className="relative inline-block max-w-sm rounded-xl overflow-hidden border border-slate-200 shadow-2xs group">
            <img
              src={question.imageRef}
              alt="Lampiran Soal"
              className="max-h-56 w-auto object-contain bg-slate-50"
            />
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={() => questionImageInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 text-xs shadow-sm cursor-pointer"
                title="Ganti gambar"
              >
                Ganti
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...question, imageRef: undefined })}
                className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
                title="Hapus gambar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="file"
              ref={questionImageInputRef}
              onChange={handleQuestionImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => questionImageInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-semibold transition cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Tambahkan Gambar pada Soal</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TYPE 1: PILIHAN GANDA (SINGLE CHOICE)                          */}
        {/* ============================================================== */}
        {question.question_type === 'multiple_choice' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <CircleDot className="w-3.5 h-3.5 text-blue-600" />
                Pilihan Jawaban (Klik lingkaran untuk menandai 1 Kunci Jawaban Benar)
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Kunci: {question.options.find((o) => question.correct_answer.includes(o.id))?.text || 'Belum dipilih'}
              </span>
            </div>

            <div className="space-y-2.5">
              {question.options.map((opt, optIdx) => {
                const isCorrect = question.correct_answer.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`flex items-start gap-2.5 p-2 rounded-xl transition border ${
                      isCorrect
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Radio selector for correct answer */}
                    <button
                      type="button"
                      onClick={() => handleSelectCorrectSingle(opt.id)}
                      className={`mt-2 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
                        isCorrect
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                          : 'border-2 border-slate-300 hover:border-emerald-500'
                      }`}
                      title={isCorrect ? 'Kunci Jawaban Benar' : 'Jadikan Kunci Jawaban'}
                    >
                      {isCorrect && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-5">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => handleUpdateOptionText(opt.id, e.target.value)}
                          placeholder={`Pilihan ${optIdx + 1}`}
                          className="flex-1 px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                        {/* Option Image Trigger */}
                        <input
                          type="file"
                          ref={(el) => { optionImageInputRefs.current[opt.id] = el; }}
                          onChange={(e) => handleOptionImageUpload(opt.id, e)}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => optionImageInputRefs.current[opt.id]?.click()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Lampirkan gambar pada pilihan ini"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                        {/* Remove Option */}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus pilihan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Option Image Attachment Preview */}
                      {opt.imageRef && (
                        <div className="relative inline-block ml-7 max-w-xs rounded-lg overflow-hidden border border-slate-200">
                          <img src={opt.imageRef} alt="Opsi" className="max-h-24 w-auto object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = question.options.map((o) =>
                                o.id === opt.id ? { ...o, imageRef: undefined } : o
                              );
                              onChange({ ...question, options: updated });
                            }}
                            className="absolute top-1 right-1 p-1 rounded bg-rose-600 text-white shadow-xs cursor-pointer"
                            title="Hapus gambar opsi"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddOption}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambahkan Pilihan</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TYPE 2: PILIHAN GANDA KOMPLEKS (MULTIPLE SELECT + OPTION SCORE)*/}
        {/* ============================================================== */}
        {question.question_type === 'multiple_select' && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900">
              <div>
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                  Pilihan Ganda Kompleks (Skor Individual Per Opsi)
                </span>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Tentukan skor masing-masing opsi. Opsi berbobot &gt; 0 otomatis dianggap jawaban benar.
                </p>
              </div>
              <div className="text-xs font-black bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-800 shrink-0">
                Total Skor Maks: {question.points}
              </div>
            </div>

            <div className="space-y-2.5">
              {question.options.map((opt, optIdx) => {
                const optScore = opt.score !== undefined ? opt.score : 0;
                const isPositive = optScore > 0;
                return (
                  <div
                    key={opt.id}
                    className={`flex items-start gap-2.5 p-2 rounded-xl transition border ${
                      isPositive
                        ? 'bg-indigo-50/40 border-indigo-200'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="mt-2 text-xs font-bold text-slate-500 w-5">
                      {String.fromCharCode(65 + optIdx)}.
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => handleUpdateOptionText(opt.id, e.target.value)}
                          placeholder={`Pilihan ${optIdx + 1}`}
                          className="flex-1 px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                        />

                        {/* Individual Option Score input */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded-lg border border-slate-200">
                          <label className="text-[11px] font-semibold text-slate-500">Skor Opsi:</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={opt.score !== undefined ? opt.score : 0}
                            onChange={(e) => handleUpdateOptionScore(opt.id, e.target.value)}
                            className="w-14 px-1.5 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded text-center focus:outline-none"
                          />
                        </div>

                        {/* Option Image Upload */}
                        <input
                          type="file"
                          ref={(el) => { optionImageInputRefs.current[opt.id] = el; }}
                          onChange={(e) => handleOptionImageUpload(opt.id, e)}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => optionImageInputRefs.current[opt.id]?.click()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Lampirkan gambar pada pilihan ini"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove Option */}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus pilihan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Option Image Attachment Preview */}
                      {opt.imageRef && (
                        <div className="relative inline-block max-w-xs rounded-lg overflow-hidden border border-slate-200">
                          <img src={opt.imageRef} alt="Opsi" className="max-h-24 w-auto object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = question.options.map((o) =>
                                o.id === opt.id ? { ...o, imageRef: undefined } : o
                              );
                              onChange({ ...question, options: updated });
                            }}
                            className="absolute top-1 right-1 p-1 rounded bg-rose-600 text-white shadow-xs cursor-pointer"
                            title="Hapus gambar opsi"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddOption}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambahkan Pilihan</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TYPE 3: BENAR / SALAH (TRUE / FALSE)                           */}
        {/* ============================================================== */}
        {question.question_type === 'true_false' && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ToggleRight className="w-3.5 h-3.5 text-blue-600" />
              Pilih Kunci Jawaban Benar:
            </span>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => onChange({ ...question, correct_answer: ['opt_true'] })}
                className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  question.correct_answer.includes('opt_true')
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  question.correct_answer.includes('opt_true') ? 'border-white bg-white text-emerald-600' : 'border-slate-400'
                }`}>
                  {question.correct_answer.includes('opt_true') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span>Benar</span>
              </button>

              <button
                type="button"
                onClick={() => onChange({ ...question, correct_answer: ['opt_false'] })}
                className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  question.correct_answer.includes('opt_false')
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  question.correct_answer.includes('opt_false') ? 'border-white bg-white text-rose-600' : 'border-slate-400'
                }`}>
                  {question.correct_answer.includes('opt_false') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span>Salah</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs font-semibold text-slate-600">Bobot Skor:</label>
              <input
                type="number"
                min="1"
                max="20"
                value={question.points}
                onChange={(e) => onChange({ ...question, points: Math.max(1, Number(e.target.value) || 1) })}
                className="w-16 px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 text-center"
              />
              <span className="text-xs text-slate-500">poin</span>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TYPE 4: URAIAN / ESSAY                                         */}
        {/* ============================================================== */}
        {question.question_type === 'essay' && (
          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-amber-600" />
                Soal Uraian (Penilaian Manual Guru)
              </span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Kunci jawaban dan rubrik bersifat referensi panduan guru saat memeriksa hasil ujian murid.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Jawaban yang Diharapkan / Kunci Jawaban Referensi (Opsional):
              </label>
              <textarea
                value={question.expectedAnswer || question.answer_key || ''}
                onChange={(e) => onChange({
                  ...question,
                  expectedAnswer: e.target.value,
                  answer_key: e.target.value
                })}
                placeholder="Tuliskan poin-poin jawaban yang diharapkan dari murid..."
                rows={2}
                className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Pedoman Penskoran / Rubrik Penilaian (Opsional):
              </label>
              <textarea
                value={typeof question.rubric === 'string' ? question.rubric : ''}
                onChange={(e) => onChange({ ...question, rubric: e.target.value })}
                placeholder="Contoh: Jawaban lengkap poin 10, jawaban separuh poin 5..."
                rows={2}
                className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs font-bold text-slate-700">Skor Maksimum Soal Uraian:</label>
              <input
                type="number"
                min="1"
                max="100"
                value={question.points}
                onChange={(e) => onChange({ ...question, points: Math.max(1, Number(e.target.value) || 10) })}
                className="w-20 px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 text-center text-amber-800 bg-amber-50/40"
              />
              <span className="text-xs text-slate-500 font-medium">poin</span>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Duplicate, Delete, Move, and Required Toggle */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Reorder & Points */}
        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
            title="Pindah ke atas"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalQuestions - 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
            title="Pindah ke bawah"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-semibold text-slate-400 pl-1">
            Bobot: <strong className="text-slate-700">{question.points} pt</strong>
          </span>
        </div>

        {/* Right: Actions & Required */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition flex items-center gap-1 cursor-pointer"
            title="Gandakan pertanyaan ini"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs font-semibold">Salin</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer"
            title="Hapus pertanyaan ini"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs font-semibold">Hapus</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Required Switch */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-medium text-slate-600">Wajib diisi</span>
            <input
              type="checkbox"
              checked={question.required ?? true}
              onChange={(e) => onChange({ ...question, required: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
