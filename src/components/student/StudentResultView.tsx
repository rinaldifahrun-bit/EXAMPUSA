import React from 'react';
import type { Exam, ExamResult } from '../../types';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Lock,
  MessageSquare
} from 'lucide-react';

interface StudentResultViewProps {
  exam: Exam;
  result: ExamResult;
  onBack: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  exam,
  result,
  onBack
}) => {
  const isReleased =
    result.gradingStatus === 'RESULTS_RELEASED' ||
    result.status === 'RESULTS_RELEASED';
  const isGraded =
    result.gradingStatus === 'GRADED' ||
    result.status === 'finalized';
  const visibilitySetting = exam.settings?.show_result_to_student;

  const canShowFullScore =
    isReleased ||
    visibilitySetting === 'immediately' ||
    (visibilitySetting === 'after_finalization' && isGraded);

  const canShowAnswerReview =
    canShowFullScore && Boolean(exam.settings?.show_answer_key_to_student);

  const studentName = result.studentName || result.student_name || 'Murid';
  const studentNis = result.studentNis || result.student_nis || '-';
  const studentClass = result.studentClass || result.student_class || '-';
  const score = result.earned_points ?? result.score ?? 0;
  const maxScore = result.total_points ?? result.maxScore ?? 100;
  const percentage = result.percentage ?? (maxScore > 0 ? (score / maxScore) * 100 : 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Beranda Ujian
      </button>

      {/* Main Score Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center space-y-4 relative overflow-hidden">
        <div className="w-16 h-16 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <span className="px-3 py-1 rounded text-xs font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            {exam.subjectName || exam.subject_name}
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">{exam.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Murid: <span className="font-semibold text-slate-700">{studentName}</span> ({studentNis}) • Kelas {studentClass}
          </p>
        </div>

        {canShowFullScore ? (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3 max-w-sm mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nilai Akhir
            </p>
            <p className="text-5xl font-black text-blue-600 tracking-tight">
              {percentage.toFixed(1)}
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <span
                className={`px-3 py-1 rounded text-xs font-bold ${
                  result.grade === 'A'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : result.grade === 'B'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : result.grade === 'C'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                Grade: {result.grade || '-'}
              </span>

              <span
                className={`px-3 py-1 rounded text-xs font-bold ${
                  result.passed
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {result.passed ? 'LULUS (Memenuhi KKM)' : 'REMIDIAL'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 max-w-md mx-auto">
            <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
            <p className="font-bold text-slate-900">Jawaban Ujian Berhasil Diterima</p>
            <p className="text-amber-800 leading-relaxed">
              Hasil nilai akhir akan dirilis oleh Bapak/Ibu Guru setelah seluruh evaluasi selesai dikoreksi dan diverifikasi sesuai jadwal resmi.
            </p>
          </div>
        )}

        {canShowFullScore && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-4 border-t border-slate-100 text-slate-600">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Poin Objektif</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {result.objective_points ?? 0} Poin
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Poin Uraian</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {result.essay_points ?? 0} Poin
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Status Publikasi</span>
              <span className="font-bold text-green-700 text-xs">
                {isReleased ? 'Hasil Dirilis Resmi' : 'Tuntas Dinilai'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Answer Key & Review Section (Only if enabled by teacher settings) */}
      {canShowAnswerReview && result.items && result.items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Pembahasan & Rincian Jawaban
            </h3>
            <span className="text-[11px] text-slate-500">
              {result.items.length} Butir Soal
            </span>
          </div>

          <div className="space-y-4">
            {result.items.map((item, idx) => (
              <div
                key={item.question_id || idx}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                    Soal #{item.question_number} • {item.question_type}
                  </span>
                  <span className="font-bold text-blue-700">
                    {item.earned_points} / {item.max_points} Poin
                  </span>
                </div>

                <p className="font-medium text-slate-800">{item.question_text}</p>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Jawaban Anda:</span>
                  <p className="text-slate-700 font-mono text-xs">
                    {item.student_answer ? String(item.student_answer) : '(Tidak Dijawab)'}
                  </p>
                </div>

                {item.teacher_feedback && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-blue-900 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-blue-700 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Catatan Guru:
                    </span>
                    <p className="text-xs">{item.teacher_feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* When review is forbidden */}
      {canShowFullScore && !canShowAnswerReview && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          <span>Pembahasan dan lembar kunci jawaban dinonaktifkan oleh guru pengampu ujian.</span>
        </div>
      )}
    </div>
  );
};
