import React, { useState } from 'react';
import type { Question } from '../../types';
import { parseImportedDocument } from '../../services/documentImportService';
import { addBulkQuestions } from '../../services/questionService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface DocumentImportViewProps {
  onQuestionsAdded: (newQuestions: Question[]) => void;
  onGoToBank: () => void;
}

export const DocumentImportView: React.FC<DocumentImportViewProps> = ({
  onQuestionsAdded,
  onGoToBank
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    try {
      const res = await parseImportedDocument(file, 'Informatika', 9);
      setParsedQuestions(res.questions);
      success(`Berhasil mengekstrak ${res.questions.length} butir soal dari "${file.name}"!`, 'Import Berhasil');
    } catch (e) {
      error('Gagal mengekstrak soal dari dokumen.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleImportToBank = () => {
    if (parsedQuestions.length === 0) return;

    const formatted: any[] = parsedQuestions.map((d) => ({
      owner_id: user.uid,
      subject_id: 'subj_info',
      subject_name: 'Informatika',
      class_id: 'class_9a',
      class_name: 'IX-A',
      topic: d.topic || 'Hasil Import Dokumen',
      learning_objective: d.learning_objective || 'Evaluasi Mandiri',
      question_type: d.question_type || 'multiple_choice',
      question_text: d.question_text || '',
      options: d.options || [],
      correct_answer: d.correct_answer || ['A'],
      answer_key: d.answer_key,
      difficulty: d.difficulty || 'medium',
      points: d.points || 2,
      grading_method: 'all_or_nothing',
      status: 'ready',
      source: 'import',
      source_file_name: selectedFile?.name
    }));

    const added = addBulkQuestions(formatted);
    onQuestionsAdded(added);
    success(`${added.length} soal impor berhasil disimpan ke Bank Soal!`, 'Bank Soal Diperbarui');
    setParsedQuestions([]);
    setSelectedFile(null);
    onGoToBank();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Document Parser
            </span>
            <span className="text-xs text-slate-500 font-medium">PDF / DOCX / TXT</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Import Soal dari Dokumen Word / PDF
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Unggah berkas naskah soal sekolah untuk diekstrak secara otomatis ke dalam format Bank Soal digital.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Zone */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition flex flex-col items-center justify-center min-h-[260px] ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <Upload className="w-12 h-12 text-blue-600 mb-3" />
            <p className="text-sm font-bold text-slate-900 mb-1">
              Tarik & Lepaskan Berkas Soal ke Sini
            </p>
            <p className="text-xs text-slate-500 mb-4 max-w-xs">
              Mendukung format .docx, .pdf, atau naskah teks .txt
            </p>

            <label className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-sm">
              Pilih Dokumen
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          {selectedFile && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="truncate">
                  <p className="font-bold text-slate-900 truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              {isParsing && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
            </div>
          )}
        </div>

        {/* Right Column: Parsed Items Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Hasil Ekstraksi Dokumen ({parsedQuestions.length})
              </h3>
              {parsedQuestions.length > 0 && (
                <button
                  onClick={handleImportToBank}
                  className="px-3.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Simpan Semua ke Bank Soal
                </button>
              )}
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="p-12 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                Unggah dokumen untuk melihat pratinjau butir soal yang berhasil diekstrak.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600">Soal #{idx + 1} ({q.question_type})</span>
                      <span className="font-bold text-amber-700">{q.points} Poin</span>
                    </div>

                    <p className="text-slate-800 font-medium leading-relaxed">{q.question_text}</p>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1">
                        {q.options.map((o) => {
                          const isCorrect = q.correct_answer?.includes(o.id);
                          return (
                            <div
                              key={o.id}
                              className={`p-1.5 rounded-lg flex items-center gap-2 ${
                                isCorrect ? 'bg-green-50 border border-green-200 text-green-800 font-semibold' : 'text-slate-600'
                              }`}
                            >
                              <span className="font-bold">{o.id}.</span>
                              <span>{o.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
