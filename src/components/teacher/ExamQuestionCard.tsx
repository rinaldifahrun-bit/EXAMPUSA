import React, { useRef } from 'react';
import type { ExamQuestionSnapshot, ExamOptionSnapshot } from '../../types';
import { processImageFile } from '../../utils/imageHelper';
import { useToast } from '../../context/ToastContext';
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Image as ImageIcon,
  Plus,
  CheckCircle2,
  HelpCircle,
  X,
  FileText,
  ListChecks,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface ExamQuestionCardProps {
  question: ExamQuestionSnapshot;
  index: number;
  totalQuestions: number;
  isActive: boolean;
  onSelect: () => void;
  onChange: (updated: ExamQuestionSnapshot) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const ExamQuestionCard: React.FC<ExamQuestionCardProps> = ({
  question,
  index,
  totalQuestions,
  isActive,
  onSelect,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete
}) => {
  const { error, info } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle stimulus image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processImageFile(file, 800, 0.8);
      onChange({ ...question, imageUrl: dataUrl });
      info('Gambar stimulus berhasil diunggah.');
    } catch (err: any) {
      error(err.message || 'Gagal memproses gambar.');
    }
  };

  // Handle option image upload
  const handleOptionImageUpload = async (optIndex: number, file: File) => {
    try {
      const dataUrl = await processImageFile(file, 500, 0.75);
      const updatedOptions = [...(question.options || [])];
      updatedOptions[optIndex] = { ...updatedOptions[optIndex], imageUrl: dataUrl };
      onChange({ ...question, options: updatedOptions });
    } catch (err: any) {
      error(err.message || 'Gagal memproses gambar pilihan.');
    }
  };

  // Option text change
  const handleOptionTextChange = (optIndex: number, text: string) => {
    const updatedOptions = [...(question.options || [])];
    updatedOptions[optIndex] = { ...updatedOptions[optIndex], text };
    onChange({ ...question, options: updatedOptions });
  };

  // Option score change (for multiple_choice / PG Kompleks)
  const handleOptionScoreChange = (optIndex: number, score: number) => {
    const updatedOptions = [...(question.options || [])];
    updatedOptions[optIndex] = { ...updatedOptions[optIndex], score };
    
    // Auto-recalculate question maxScore if PG Kompleks
    const totalScore = updatedOptions.reduce((sum, opt) => sum + (Number(opt.score) || 0), 0);
    onChange({
      ...question,
      options: updatedOptions,
      maxScore: totalScore > 0 ? totalScore : question.maxScore
    });
  };

  // Add Option
  const handleAddOption = () => {
    const currentOptions = question.options || [];
    const newId = `opt_${Date.now()}_${currentOptions.length + 1}`;
    const nextChar = String.fromCharCode(65 + currentOptions.length); // A, B, C, D, ...
    const newOption: ExamOptionSnapshot = {
      id: newId,
      text: `Pilihan ${nextChar}`,
      score: 0
    };
    onChange({ ...question, options: [...currentOptions, newOption] });
  };

  // Remove Option
  const handleRemoveOption = (optId: string) => {
    const currentOptions = question.options || [];
    if (currentOptions.length <= 2) {
      error('Minimal butir soal harus memiliki 2 pilihan jawaban.');
      return;
    }
    const updatedOptions = currentOptions.filter((opt) => opt.id !== optId);
    const updatedCorrectAnswers = (question.correctAnswers || []).filter((id) => id !== optId);
    onChange({
      ...question,
      options: updatedOptions,
      correctAnswers: updatedCorrectAnswers
    });
  };

  // Toggle Correct Answer for Single Choice
  const handleSingleChoiceSelect = (optId: string) => {
    onChange({ ...question, correctAnswers: [optId] });
  };

  // Toggle Correct Answer for Multiple Choice (PG Kompleks)
  const handleMultipleChoiceToggle = (optId: string) => {
    const current = question.correctAnswers || [];
    let next: string[];
    if (current.includes(optId)) {
      next = current.filter((id) => id !== optId);
    } else {
      next = [...current, optId];
    }
    onChange({ ...question, correctAnswers: next });
  };

  // Change Question Type
  const handleTypeChange = (newType: 'single_choice' | 'multiple_choice' | 'true_false' | 'essay') => {
    let options = question.options || [];
    let correctAnswers = question.correctAnswers || [];
    let maxScore = question.maxScore;

    if (newType === 'true_false') {
      options = [
        { id: 'true', text: 'Benar' },
        { id: 'false', text: 'Salah' }
      ];
      correctAnswers = ['true'];
      maxScore = maxScore || 1;
    } else if (newType === 'single_choice') {
      if (options.length === 0 || options[0].id === 'true') {
        options = [
          { id: 'opt_1', text: 'Pilihan A' },
          { id: 'opt_2', text: 'Pilihan B' },
          { id: 'opt_3', text: 'Pilihan C' },
          { id: 'opt_4', text: 'Pilihan D' }
        ];
      }
      correctAnswers = [options[0].id];
      maxScore = maxScore || 2;
    } else if (newType === 'multiple_choice') {
      if (options.length === 0 || options[0].id === 'true') {
        options = [
          { id: 'opt_1', text: 'Pernyataan 1', score: 1 },
          { id: 'opt_2', text: 'Pernyataan 2', score: 1 },
          { id: 'opt_3', text: 'Pernyataan 3', score: 0 },
          { id: 'opt_4', text: 'Pernyataan 4', score: 0 }
        ];
      }
      correctAnswers = [options[0].id, options[1].id];
      maxScore = 2;
    } else if (newType === 'essay') {
      options = [];
      correctAnswers = [];
      maxScore = maxScore || 5;
    }

    onChange({
      ...question,
      type: newType,
      options,
      correctAnswers,
      maxScore
    });
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-xs ${
        isActive
          ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-sm'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Header Card Bar */}
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-slate-800">
            Butir Soal #{index + 1}
          </span>

          {/* Type Selector Dropdown */}
          <select
            value={question.type}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="single_choice">Pilihan Ganda (Tunggal)</option>
            <option value="multiple_choice">Pilihan Ganda Kompleks (Skor Parsial)</option>
            <option value="true_false">Benar / Salah</option>
            <option value="essay">Uraian / Esai</option>
          </select>
        </div>

        {/* Action controls (Move, Duplicate, Delete) */}
        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            title="Pindah ke Atas"
            className="p-1.5 rounded-lg hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={index === totalQuestions - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            title="Pindah ke Bawah"
            className="p-1.5 rounded-lg hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-300 mx-0.5" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplikasi Butir Soal"
            className="p-1.5 rounded-lg hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Hapus dari Paket Ujian"
            className="p-1.5 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Stimulus / Question Text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Pertanyaan / Stimulus Soal</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {question.imageUrl ? 'Ganti Gambar' : 'Sisipkan Gambar'}
              </button>
            </div>
          </div>

          <textarea
            rows={3}
            value={question.questionText}
            onChange={(e) => onChange({ ...question, questionText: e.target.value })}
            placeholder="Ketikkan teks stimulus atau pertanyaan soal di sini..."
            className="w-full text-sm rounded-lg border border-slate-200 p-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          {/* Image Preview */}
          {question.imageUrl && (
            <div className="relative inline-block border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-1">
              <img
                src={question.imageUrl}
                alt="Stimulus Soal"
                className="max-h-48 rounded object-contain"
              />
              <button
                type="button"
                onClick={() => onChange({ ...question, imageUrl: undefined })}
                className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/70 text-white hover:bg-rose-600 transition"
                title="Hapus Gambar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Options Section based on Question Type */}
        {question.type === 'single_choice' && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Pilihan Jawaban (Pilih 1 Kunci Benar):
              </span>
              <span className="text-[11px] text-slate-500">
                Kunci: {question.correctAnswers?.[0] ? 'Terpilih' : 'Belum Dipilih'}
              </span>
            </div>

            <div className="space-y-2">
              {(question.options || []).map((opt, optIdx) => {
                const isCorrect = question.correctAnswers?.includes(opt.id);
                const charLabel = String.fromCharCode(65 + optIdx);

                return (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border transition ${
                      isCorrect
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Radio Button for Correct Answer */}
                    <button
                      type="button"
                      onClick={() => handleSingleChoiceSelect(opt.id)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition cursor-pointer ${
                        isCorrect
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-slate-300 hover:border-blue-400 bg-white'
                      }`}
                      title={isCorrect ? 'Kunci Jawaban Benar' : 'Jadikan Kunci Jawaban'}
                    >
                      {isCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    <span className="text-xs font-bold text-slate-600 w-4">
                      {charLabel}.
                    </span>

                    {/* Option Text Input */}
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(optIdx, e.target.value)}
                      placeholder={`Teks pilihan ${charLabel}...`}
                      className="flex-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none text-slate-800"
                    />

                    {/* Option Image Action */}
                    <label className="cursor-pointer p-1 text-slate-400 hover:text-slate-600" title="Unggah Gambar Opsi">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleOptionImageUpload(optIdx, file);
                        }}
                      />
                    </label>

                    {/* Delete Option */}
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(opt.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      title="Hapus Pilihan"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddOption}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 py-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Pilihan Jawaban
            </button>
          </div>
        )}

        {question.type === 'multiple_choice' && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Pilihan Ganda Kompleks (Skor Individual per Opsi):
              </span>
              <span className="text-[11px] text-slate-500">
                Total Poin: {question.maxScore}
              </span>
            </div>

            <div className="space-y-2">
              {(question.options || []).map((opt, optIdx) => {
                const isSelected = question.correctAnswers?.includes(opt.id);
                const charLabel = String.fromCharCode(65 + optIdx);

                return (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border transition ${
                      isSelected || (opt.score ?? 0) > 0
                        ? 'border-blue-300 bg-blue-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Checkbox for correctness */}
                    <button
                      type="button"
                      onClick={() => handleMultipleChoiceToggle(opt.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 hover:border-blue-400 bg-white'
                      }`}
                      title={isSelected ? 'Pernyataan Benar' : 'Tandai sebagai Pernyataan Benar'}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    </button>

                    <span className="text-xs font-bold text-slate-600 w-4">
                      {charLabel}.
                    </span>

                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(optIdx, e.target.value)}
                      placeholder={`Pernyataan ${charLabel}...`}
                      className="flex-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none text-slate-800"
                    />

                    {/* Partial Score Input */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium">Skor:</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={opt.score ?? 0}
                        onChange={(e) => handleOptionScoreChange(optIdx, parseFloat(e.target.value) || 0)}
                        className="w-12 text-xs font-bold text-slate-800 text-center focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveOption(opt.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddOption}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 py-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Pernyataan
            </button>
          </div>
        )}

        {question.type === 'true_false' && (
          <div className="space-y-2.5 pt-2">
            <span className="text-xs font-bold text-slate-700">
              Kunci Jawaban Benar / Salah:
            </span>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onChange({ ...question, correctAnswers: ['true'] })}
                className={`flex-1 py-2.5 px-4 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  question.correctAnswers?.[0] === 'true'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                BENAR
              </button>

              <button
                type="button"
                onClick={() => onChange({ ...question, correctAnswers: ['false'] })}
                className={`flex-1 py-2.5 px-4 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  question.correctAnswers?.[0] === 'false'
                    ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <X className="w-4 h-4" />
                SALAH
              </button>
            </div>
          </div>
        )}

        {question.type === 'essay' && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Pedoman Jawaban yang Diharapkan (Expected Answer):
              </label>
              <textarea
                rows={2}
                value={question.expectedAnswer || ''}
                onChange={(e) => onChange({ ...question, expectedAnswer: e.target.value })}
                placeholder="Ketikkan poin kunci jawaban yang menjadi acuan penilaian..."
                className="w-full text-xs sm:text-sm rounded-lg border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <ListChecks className="w-3.5 h-3.5 text-blue-600" />
                Rubrik Penskoran:
              </label>
              <textarea
                rows={2}
                value={question.rubric || ''}
                onChange={(e) => onChange({ ...question, rubric: e.target.value })}
                placeholder="Contoh: Menjawab lengkap = 5 poin, menyebutkan 2 hal = 3 poin..."
                className="w-full text-xs sm:text-sm rounded-lg border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Footer info: MaxScore and Required Switch */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Bobot Nilai:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={question.maxScore || 1}
                onChange={(e) =>
                  onChange({ ...question, maxScore: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="w-14 px-2 py-1 rounded border border-slate-200 text-center font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-500 text-[11px]">poin</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Wajib Diisi:</span>
            <button
              type="button"
              onClick={() => onChange({ ...question, required: !question.required })}
              className="cursor-pointer text-slate-700 hover:text-blue-600 transition"
              title="Tandai butir soal ini wajib diisi murid"
            >
              {question.required ? (
                <ToggleRight className="w-6 h-6 text-blue-600" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
