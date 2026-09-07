import React, { useState } from 'react';
import type { Exam, ExamResult, ExamResultItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { updateManualEssayGrade, updateEssayGrade } from '../../services/gradingService';
import { saveStoredResults, getStoredResults } from '../../services/examSessionService';
import {
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Award,
  AlertTriangle,
  FileText,
  User,
  Save,
  CheckCheck
} from 'lucide-react';

interface TeacherGradingRoomProps {
  exam: Exam;
  results: ExamResult[];
  onUpdateResults: (updatedResults: ExamResult[]) => void;
  onBack: () => void;
}

export const TeacherGradingRoom: React.FC<TeacherGradingRoomProps> = ({
  exam,
  results,
  onUpdateResults,
  onBack
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [selectedStudentIdx, setSelectedStudentIdx] = useState<number>(0);
  const currentResult: ExamResult | undefined = results[selectedStudentIdx];

  // Local draft scores and feedback state per question
  const [essayScores, setEssayScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (currentResult) {
      currentResult.items.forEach((it) => {
        if (it.question_type === 'essay') {
          initial[it.question_id] = it.earned_points || 0;
        }
      });
    }
    return initial;
  });

  const [essayFeedbacks, setEssayFeedbacks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (currentResult) {
      currentResult.items.forEach((it) => {
        if (it.question_type === 'essay') {
          initial[it.question_id] = it.teacher_feedback || '';
        }
      });
    }
    return initial;
  });

  // When switching student, synchronize inputs
  const handleSelectStudent = (index: number) => {
    setSelectedStudentIdx(index);
    const target = results[index];
    if (target) {
      const scores: Record<string, number> = {};
      const feedbacks: Record<string, string> = {};
      target.items.forEach((it) => {
        if (it.question_type === 'essay') {
          scores[it.question_id] = it.earned_points || 0;
          feedbacks[it.question_id] = it.teacher_feedback || '';
        }
      });
      setEssayScores(scores);
      setEssayFeedbacks(feedbacks);
    }
  };

  const handleScoreChange = (qId: string, maxPoints: number, value: string) => {
    let num = parseFloat(value);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > maxPoints) num = maxPoints;
    setEssayScores((prev) => ({ ...prev, [qId]: num }));
  };

  const handleFeedbackChange = (qId: string, text: string) => {
    setEssayFeedbacks((prev) => ({ ...prev, [qId]: text }));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndFinalize = async (isFinalize: boolean = false) => {
    if (!currentResult || isSaving) return;
    setIsSaving(true);

    try {
      let updated = { ...currentResult };

      // Apply all essay updates through snapshot-authoritative updateManualEssayGrade
      for (const item of currentResult.items) {
        if (item.question_type === 'essay') {
          const score = essayScores[item.question_id] ?? item.earned_points ?? 0;
          const feedback = essayFeedbacks[item.question_id] ?? item.teacher_feedback ?? '';
          
          updated = await updateManualEssayGrade(
            updated,
            item.question_id,
            score,
            feedback,
            user?.displayName || 'Guru Pengampu',
            user?.uid || 'teacher_uid',
            exam
          );
        }
      }

      if (isFinalize) {
        updated.status = 'finalized';
        updated.gradingStatus = 'GRADED';
        updated.finalized_at = new Date().toISOString();
        updated.finalizedAt = updated.finalized_at;
      }

      const allResults = getStoredResults();
      const idx = allResults.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        allResults[idx] = updated;
      } else {
        allResults.push(updated);
      }

      saveStoredResults(allResults);

      // Update parent state
      const parentUpdated = results.map((r) => (r.id === updated.id ? updated : r));
      onUpdateResults(parentUpdated);

      success(
        isFinalize
          ? `Nilai ${updated.studentName || updated.student_name} berhasil difinalisasi!`
          : `Nilai essay ${updated.studentName || updated.student_name} berhasil disimpan.`,
        'Penilaian Tersimpan'
      );
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan penilaian essay');
    } finally {
      setIsSaving(false);
    }
  };

  const awaitingCount = results.filter((r) => r.status === 'awaiting_manual_grading').length;
  const finalizedCount = results.filter((r) => r.status === 'finalized').length;

  if (results.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Lembar Jawaban</h3>
        <p className="text-sm text-slate-500 mb-6">
          Belum ada murid yang mengumpulkan jawaban untuk ujian ini.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition"
        >
          Kembali ke Rekap Nilai
        </button>
      </div>
    );
  }

  const essayItems = currentResult ? currentResult.items.filter((i) => i.question_type === 'essay') : [];

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Ringkasan Hasil
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Ruang Koreksi Essay & Penilaian Manual
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Evaluasi Guru
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ujian: <span className="text-slate-800 font-semibold">{exam.title}</span> ({exam.subject_name})
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Menunggu Koreksi: <b>{awaitingCount}</b>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-800 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            Sudah Final: <b>{finalizedCount}</b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student List Navigation */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Daftar Lembar Jawaban</span>
              <span className="text-[10px] text-slate-400 font-normal">{results.length} Murid</span>
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {results.map((res, idx) => {
                const isSelected = idx === selectedStudentIdx;
                const isDone = res.status === 'finalized';
                return (
                  <button
                    key={res.id}
                    onClick={() => handleSelectStudent(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 text-blue-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate text-slate-900">{res.student_name}</p>
                      <p className="text-[10px] text-slate-500">
                        NIS: {res.student_nis} • Kelas {res.student_class}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDone
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isDone ? `${res.percentage.toFixed(1)} (${res.grade})` : 'Perlu Koreksi'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Student Exam Sheet & Grading Form */}
        <div className="lg:col-span-8 space-y-6">
          {currentResult ? (
            <>
              {/* Student Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      {currentResult.student_name}
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      ({currentResult.student_nis})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Kelas: <b>{currentResult.student_class}</b> • Diserahkan:{' '}
                    {new Date(currentResult.submitted_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Skor Sementara</p>
                    <p className="text-xl font-bold text-blue-600">
                      {currentResult.earned_points}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ {currentResult.total_points}</span>
                    </p>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Nilai Akhir</p>
                    <p className="text-base font-bold text-slate-900">
                      {currentResult.percentage.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Essay Questions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Soal Uraian / Essay ({essayItems.length})
                  </h4>
                  <span className="text-xs text-slate-400">
                    Nilai diinput secara manual sesuai pedoman rubrik
                  </span>
                </div>

                {essayItems.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                    Ujian ini tidak memiliki butir soal uraian (hanya soal objektif).
                  </div>
                ) : (
                  essayItems.map((item) => {
                    const currentScore = essayScores[item.question_id] ?? item.earned_points ?? 0;
                    const currentFeedback =
                      essayFeedbacks[item.question_id] ?? item.teacher_feedback ?? '';

                    return (
                      <div
                        key={item.question_id}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
                      >
                        {/* Question Header */}
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                          <div>
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Soal #{item.question_number} • Uraian
                            </span>
                            <p className="text-sm font-semibold text-slate-900 mt-2 leading-relaxed">
                              {item.question_text}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-500">
                              Maksimal: <span className="text-slate-900 font-bold">{item.max_points} Poin</span>
                            </span>
                          </div>
                        </div>

                        {/* Teacher Key / Rubric Accordion / Box */}
                        {item.answer_key && (
                          <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/80 text-xs space-y-1">
                            <p className="font-bold text-blue-700 uppercase text-[10px] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              Pedoman / Kunci Jawaban Guru:
                            </p>
                            <p className="text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                              {item.answer_key}
                            </p>
                          </div>
                        )}

                        {/* Student Answer Box */}
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Jawaban Murid:
                          </p>
                          <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed font-mono bg-white p-3 rounded-md border border-slate-200">
                            {item.student_answer ? String(item.student_answer) : '(Tidak menjawab)'}
                          </p>
                        </div>

                        {/* Scoring Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
                          <div className="sm:col-span-4 space-y-2">
                            <label className="text-xs font-bold text-slate-700 block">
                              Skor Diberikan (0 - {item.max_points}):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={item.max_points}
                                step={0.5}
                                value={currentScore}
                                onChange={(e) =>
                                  handleScoreChange(item.question_id, item.max_points, e.target.value)
                                }
                                className="w-24 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-bold text-base text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <span className="text-xs text-slate-500 font-semibold">
                                / {item.max_points} Poin
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={item.max_points}
                              step={0.5}
                              value={currentScore}
                              onChange={(e) =>
                                handleScoreChange(item.question_id, item.max_points, e.target.value)
                              }
                              className="w-full accent-blue-600 cursor-pointer"
                            />
                          </div>

                          <div className="sm:col-span-8 space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">
                              Catatan / Umpan Balik Guru (Feedback):
                            </label>
                            <textarea
                              rows={2}
                              value={currentFeedback}
                              onChange={(e) =>
                                handleFeedbackChange(item.question_id, e.target.value)
                              }
                              placeholder="Tuliskan catatan evaluasi atau motivasi bagi murid..."
                              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    disabled={selectedStudentIdx === 0}
                    onClick={() => handleSelectStudent(selectedStudentIdx - 1)}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Siswa Sebelumnya
                  </button>
                  <button
                    disabled={selectedStudentIdx === results.length - 1}
                    onClick={() => handleSelectStudent(selectedStudentIdx + 1)}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    Siswa Berikutnya
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    disabled={isSaving}
                    onClick={() => handleSaveAndFinalize(false)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Menyimpan...' : 'Simpan Draf'}
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => handleSaveAndFinalize(true)}
                    className="flex-1 sm:flex-none px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    {isSaving ? 'Memproses...' : 'Finalisasi Nilai Murid Ini'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400">Pilih salah satu murid dari daftar sebelah kiri.</div>
          )}
        </div>
      </div>
    </div>
  );
};
