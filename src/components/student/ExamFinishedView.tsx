import React from 'react';
import { CheckCircle2, ShieldCheck, School, LogOut, FileCheck } from 'lucide-react';
import type { StudentSafeExam, ExamSession } from '../../types';

interface ExamFinishedViewProps {
  exam: StudentSafeExam;
  session: ExamSession;
  onExit: () => void;
}

export const ExamFinishedView: React.FC<ExamFinishedViewProps> = ({
  exam,
  session,
  onExit
}) => {
  const submittedTime = session.submittedAt || session.submitted_at || new Date().toISOString();
  const formattedDate = new Date(submittedTime).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="max-w-2xl mx-auto w-full pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
            EX
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-900">
              EXAMPUSA
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">
              SMPN 1 Puspo • CBT Assessment System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Terverifikasi</span>
        </div>
      </header>

      {/* Main Submission Card */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center space-y-6">
          {/* Success Badge */}
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs animate-in zoom-in-90 duration-300">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-slate-900">
              Jawaban Berhasil Dikirim!
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ujian Anda telah selesai dikerjakan dan seluruh lembar jawaban telah tercatat dengan aman di server sistem EXAMPUSA.
            </p>
          </div>

          {/* Student Receipt Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-400 font-medium">Status Sesi:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider text-[11px]">
                Selesai (Submitted)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Mata Pelajaran:</span>
              <span className="font-bold text-slate-800">{exam.subjectName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Paket Ujian:</span>
              <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={exam.title}>
                {exam.title}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Nama Murid:</span>
              <span className="font-bold text-slate-800">{session.studentName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Kelas / Rombel:</span>
              <span className="font-semibold text-slate-800">{session.studentClass || session.classId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Nomor Ujian:</span>
              <span className="font-mono font-bold text-slate-800">{session.examNumber}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-400 font-medium text-[11px]">Waktu Pengiriman:</span>
              <span className="text-[11px] font-mono text-slate-600">{formattedDate} WIB</span>
            </div>
          </div>

          {/* Informational Box */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-left text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Pengumuman Hasil</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Kunci jawaban dan hasil penilaian akhir akan diproses dan diumumkan oleh guru mata pelajaran sesuai jadwal resmi sekolah.
            </p>
          </div>

          {/* Exit Button */}
          <div className="pt-2">
            <button
              onClick={onExit}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Ruang Ujian</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        <p className="text-[11px]">
          Dikembangkan oleh Rinaldi Fahrun — Guru SMPN 1 Puspo
        </p>
      </footer>
    </div>
  );
};
