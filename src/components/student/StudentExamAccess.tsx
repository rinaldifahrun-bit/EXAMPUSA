import React, { useState } from 'react';
import {
  GraduationCap,
  KeyRound,
  User,
  Hash,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  School,
  Play,
  FileText
} from 'lucide-react';
import type { StudentSafeExam, ExamSession } from '../../types';
import { validateStudentExamAccess, startOrResumeStudentSession } from '../../services/studentExamService';
import { useToast } from '../../context/ToastContext';

interface StudentExamAccessProps {
  onStartExam: (exam: StudentSafeExam, session: ExamSession, answers: Record<string, any>) => void;
  onViewResult?: (examId: string, examNumber: string) => void;
}

export const StudentExamAccess: React.FC<StudentExamAccessProps> = ({ onStartExam, onViewResult }) => {
  const { error: toastError, success: toastSuccess } = useToast();

  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [examNumber, setExamNumber] = useState('');
  const [token, setToken] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-start exam details review state
  const [verifiedExam, setVerifiedExam] = useState<StudentSafeExam | null>(null);
  const [existingSession, setExistingSession] = useState<ExamSession | null>(null);
  const [existingAnswers, setExistingAnswers] = useState<Record<string, any>>({});

  const handleValidateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = studentName.trim();
    const cleanClass = studentClass.trim();
    const cleanNumber = examNumber.trim();
    const cleanToken = token.trim().toUpperCase();

    if (!cleanName) {
      setErrorMessage('Nama Lengkap wajib diisi.');
      return;
    }
    if (!cleanClass) {
      setErrorMessage('Kelas wajib diisi.');
      return;
    }
    if (!cleanNumber) {
      setErrorMessage('Nomor Ujian wajib diisi.');
      return;
    }
    if (!cleanToken) {
      setErrorMessage('Exam Token wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      // ONLY token is used for access authorization; name, class, examNumber are untrusted metadata
      const result = await validateStudentExamAccess({
        token: cleanToken,
        fullName: cleanName,
        className: cleanClass,
        examNumber: cleanNumber
      });

      setVerifiedExam(result.safeExam);
      setExistingSession(result.existingSession);
      setExistingAnswers(result.answers);
      toastSuccess('Paket ujian berhasil diverifikasi!', 'Validasi Berhasil');
    } catch (err: any) {
      const msg = err.message || 'Gagal memverifikasi akses ujian.';
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmStart = async () => {
    if (!verifiedExam) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { session, answers } = await startOrResumeStudentSession(verifiedExam, {
        fullName: studentName.trim(),
        className: studentClass.trim(),
        examNumber: examNumber.trim()
      });
      onStartExam(verifiedExam, session, answers);
    } catch (err: any) {
      const msg = err.message || 'Gagal memulai sesi ujian.';
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const isExistingInProgress =
    existingSession &&
    (existingSession.status === 'IN_PROGRESS' || existingSession.status === 'in_progress');

  const isExistingSubmitted =
    existingSession &&
    (existingSession.status === 'SUBMITTED' || existingSession.status === 'submitted');

  const isSessionLocked = Boolean(
    existingSession && existingSession.isLocked && !existingSession.allowRelogin
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="max-w-xl mx-auto w-full pt-4 pb-2 flex items-center justify-between">
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

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs">
          <School className="w-3.5 h-3.5 text-blue-600" />
          <span>Ruang Ujian Siswa</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto w-full my-auto py-6">
        {!verifiedExam ? (
          /* Step 1: Student Exam Access Form */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900">
                Masuk ke Ruang Ujian
              </h2>
              <p className="text-xs text-slate-500">
                Lengkapi identitas Anda dan masukkan Exam Token untuk memulai asesmen.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleValidateAccess} className="space-y-4">
              {/* Field 1: Nama Lengkap */}
              <div>
                <label htmlFor="student-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="student-name"
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Contoh: Budi Pratama"
                    className="w-full pl-11 pr-3 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white text-slate-900 placeholder:text-slate-400"
                    autoFocus
                  />
                </div>
              </div>

              {/* Field 2: Kelas */}
              <div>
                <label htmlFor="student-class" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kelas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <GraduationCap className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="student-class"
                    type="text"
                    required
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    placeholder="Contoh: IX-A atau VII-1"
                    className="w-full pl-11 pr-3 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Field 3: Nomor Ujian */}
              <div>
                <label htmlFor="student-exam-number" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Ujian <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="student-exam-number"
                    type="text"
                    required
                    value={examNumber}
                    onChange={(e) => setExamNumber(e.target.value)}
                    placeholder="Contoh: 015 atau UJ-09-015"
                    className="w-full pl-11 pr-3 py-3 text-sm font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Field 4: Exam Token */}
              <div>
                <label htmlFor="student-token" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Exam Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="student-token"
                    type="text"
                    required
                    maxLength={12}
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    placeholder="Contoh: ABC123"
                    className="w-full pl-11 pr-3 py-3 text-base font-mono font-bold tracking-widest uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white text-blue-700 placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Akses ujian terotorisasi berdasarkan Exam Token tanpa registrasi akun.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !token.trim() || !studentName.trim() || !studentClass.trim() || !examNumber.trim()}
                className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>Memeriksa Token...</span>
                ) : (
                  <>
                    <span>Verifikasi Token & Buka Ujian</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Step 2: Exam Confirmation Screen */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Konfirmasi Peserta & Ujian
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Periksa data identitas dan rincian paket asesmen sebelum memulai.
                  </p>
                </div>
              </div>
            </div>

            {/* Student Metadata Card */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nama Peserta:</span>
                <span className="font-bold text-slate-900">{studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Kelas:</span>
                <span className="font-semibold text-slate-800">{studentClass}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nomor Ujian:</span>
                <span className="font-mono font-bold text-blue-800">{examNumber}</span>
              </div>
            </div>

            {/* Exam Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Judul Ujian:</span>
                <span className="font-bold text-slate-900 text-right max-w-[220px] truncate" title={verifiedExam.title}>
                  {verifiedExam.title}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Mata Pelajaran:</span>
                <span className="font-semibold text-slate-800">{verifiedExam.subjectName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Durasi Pengerjaan:</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  {verifiedExam.durationMinutes} Menit
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Jumlah Soal:</span>
                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {verifiedExam.totalQuestions} Butir Soal
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Exam Token:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {verifiedExam.examToken}
                </span>
              </div>
            </div>

            {/* Notice / Existing Session Banner */}
            {isExistingSubmitted ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Ujian Ini Telah Selesai
                </p>
                <p className="text-[11px] text-amber-700">
                  Anda sudah pernah menyelesaikan dan mengirimkan ujian ini. Lembar jawaban tidak dapat diubah kembali.
                </p>
              </div>
            ) : isSessionLocked ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Sesi Ujian Terkunci
                </p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Sesi ujian Anda terkunci karena aplikasi tertutup atau perangkat terputus. Silakan hubungi Administrator atau Pengawas untuk <strong>Buka Kunci Sesi (Izinkan Masuk Ulang)</strong>.
                </p>
              </div>
            ) : isExistingInProgress ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sesi Ujian Sebelumnya Ditemukan
                </p>
                <p className="text-[11px] text-emerald-700">
                  Sistem memulihkan sesi ujian Anda yang sedang berlangsung. Anda dapat langsung melanjutkan pengerjaan tanpa kehilangan jawaban.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Petunjuk Pengerjaan:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                  <li>Seluruh butir soal ditampilkan dalam satu halaman berurutan.</li>
                  <li>Jawaban akan disimpan otomatis secara berkala ke memori peramban.</li>
                  <li>Waktu pengerjaan akan berjalan mundur otomatis setelah tombol ditekan.</li>
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVerifiedExam(null)}
                disabled={isLoading}
                className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Kembali
              </button>

              {!isExistingSubmitted ? (
                <button
                  type="button"
                  onClick={handleConfirmStart}
                  disabled={isLoading || isSessionLocked}
                  className={`w-2/3 py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    isSessionLocked
                      ? 'bg-rose-600 hover:bg-rose-700 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {isLoading
                      ? 'Menyiapkan Lembar...'
                      : isSessionLocked
                      ? 'Sesi Terkunci (Hubungi Admin)'
                      : isExistingInProgress
                      ? 'Lanjutkan Ujian'
                      : 'Mulai Kerjakan Ujian'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onViewResult && verifiedExam) {
                      onViewResult(verifiedExam.id, existingSession?.examNumber || verifiedExam.examToken);
                    }
                  }}
                  className="w-2/3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Lihat Hasil / Nilai Ujian
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-slate-400">
        <p className="text-[11px]">
          Dikembangkan oleh Rinaldi Fahrun — Guru SMPN 1 Puspo
        </p>
      </footer>
    </div>
  );
};
