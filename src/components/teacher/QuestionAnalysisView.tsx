import React from 'react';
import type { Exam, QuestionAnalysisData } from '../../types';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  BookOpen,
  ChevronLeft
} from 'lucide-react';

interface QuestionAnalysisViewProps {
  exam: Exam;
  analysisData: QuestionAnalysisData[];
  onBack: () => void;
}

export const QuestionAnalysisView: React.FC<QuestionAnalysisViewProps> = ({
  exam,
  analysisData,
  onBack
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Rekap Nilai
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Analisis Butir Soal (Item Analysis)
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              {analysisData.length} Butir Soal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ujian: <span className="text-slate-800 font-semibold">{exam.title}</span> • Evaluasi tingkat kesukaran dan efektivitas pengecoh (distractor).
          </p>
        </div>
      </div>

      {/* Questions Item Analysis Grid */}
      <div className="space-y-4">
        {analysisData.map((item) => {
          let diffColor = 'bg-green-50 text-green-700 border-green-200';
          if (item.difficulty_index === 'Sedang') {
            diffColor = 'bg-amber-50 text-amber-700 border-amber-200';
          } else if (item.difficulty_index === 'Sukar') {
            diffColor = 'bg-rose-50 text-rose-700 border-rose-200';
          }

          const hasOptions = item.options && item.options.length > 0;
          const distValues = Object.values(item.option_distribution || { '1': 1 }).map((v) => Number(v) || 0);
          const maxDistCount = Math.max(1, ...distValues);

          return (
            <div
              key={item.question_id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-sm text-blue-700">
                    #{item.question_number}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 capitalize">
                      {item.question_type === 'multiple_choice'
                        ? 'Pilihan Ganda'
                        : item.question_type === 'multiple_select'
                        ? 'PG Kompleks'
                        : item.question_type === 'true_false'
                        ? 'Benar/Salah'
                        : 'Uraian/Essay'}
                    </span>
                    <span className="text-slate-300 mx-2">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Maks: {item.max_points} Poin
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded text-xs font-bold border ${diffColor}`}
                  >
                    Tingkat: {item.difficulty_index} ({item.correct_percentage}%)
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {item.question_text}
              </p>

              {/* Statistical Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-green-100 flex items-center justify-center text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Benar</p>
                    <p className="font-bold text-slate-900">
                      {item.correct_count}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({item.correct_percentage}%)
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-rose-100 flex items-center justify-center text-rose-700">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Salah</p>
                    <p className="font-bold text-slate-900">{item.wrong_count}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center text-amber-700">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Kosong</p>
                    <p className="font-bold text-slate-900">{item.unanswered_count}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-blue-700">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Rata-rata Skor</p>
                    <p className="font-bold text-blue-700">
                      {item.average_score} / {item.max_points}
                    </p>
                  </div>
                </div>
              </div>

              {/* Distractor Distribution Breakdown (For PG & PGK) */}
              {hasOptions && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                    Distribusi Pilihan Jawaban Murid:
                  </p>
                  <div className="space-y-1.5">
                    {item.options?.map((opt) => {
                      const count = item.option_distribution[opt.id] || 0;
                      const isCorrect = item.correct_answer?.includes(opt.id);
                      const pct = item.total_attempts > 0 ? (count / item.total_attempts) * 100 : 0;

                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                            isCorrect
                              ? 'bg-green-50/70 border-green-200 text-green-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span
                              className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? 'bg-green-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <span className="leading-snug">{opt.text}</span>
                            {isCorrect && (
                              <span className="text-[10px] uppercase font-bold bg-green-100 text-green-800 px-1.5 py-0.2 rounded shrink-0">
                                Kunci
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-48 shrink-0">
                            <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isCorrect ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-bold text-[11px] text-right min-w-[50px] text-slate-700">
                              {count} murid ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
