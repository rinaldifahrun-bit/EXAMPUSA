import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { StudentSafeExam, ExamSession, StudentExamQuestion } from '../../types';
import {
  saveStudentAnswerLocally,
  submitStudentExamSession
} from '../../services/studentExamService';
import { logSecurityEvent } from '../../services/securityEventService';
import { ExamTimer } from './ExamTimer';
import { ExamSubmitDialog } from './ExamSubmitDialog';
import { ExamFinishedView } from './ExamFinishedView';
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  Shield,
  HelpCircle,
  Maximize,
  Minimize,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Sparkles,
  School,
  ArrowUp
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface StudentExamPlayerProps {
  exam: StudentSafeExam;
  session: ExamSession;
  initialAnswers: Record<string, any>;
  onFinishExam: () => void;
}

export const StudentExamPlayer: React.FC<StudentExamPlayerProps> = ({
  exam,
  session,
  initialAnswers,
  onFinishExam
}) => {
  const { success, error, info } = useToast();

  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Online / Network indicator
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // Multi-tab detection
  const [isMultiTabDetected, setIsMultiTabDetected] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // References to question card elements for smooth scrolling to unanswered questions
  const questionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Question sorting: respect session's stable questionOrder
  const orderedQuestions: StudentExamQuestion[] = useMemo(() => {
    const orderList = session.questionOrder || session.question_order || [];
    if (orderList.length === 0) return exam.questions;

    const map = new Map<string, StudentExamQuestion>(exam.questions.map((q) => [q.id, q]));
    const result: StudentExamQuestion[] = [];

    // Add ordered questions first
    orderList.forEach((qId) => {
      const q = map.get(qId);
      if (q) {
        result.push(q);
        map.delete(qId);
      }
    });

    // Add any remaining questions
    map.forEach((q: StudentExamQuestion) => result.push(q));
    return result;
  }, [exam.questions, session.questionOrder, session.question_order]);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Multi-tab detection via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channelName = `exampusa_tab_lock_${session.id}`;
    const channel = new BroadcastChannel(channelName);

    // Announce current tab presence
    channel.postMessage({ type: 'HEARTBEAT', timestamp: Date.now() });

    channel.onmessage = (event) => {
      if (event.data?.type === 'HEARTBEAT') {
        setIsMultiTabDetected(true);
      }
    };

    return () => {
      channel.close();
    };
  }, [session.id]);

  // Visibility change tracking (silent anti-cheat audit)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logSecurityEvent(
          session.id,
          exam.id,
          session.examNumber,
          session.studentName,
          'visibility_hidden',
          'info',
          'Murid berpindah aplikasi atau tab peramban'
        );
      } else {
        logSecurityEvent(
          session.id,
          exam.id,
          session.examNumber,
          session.studentName,
          'visibility_visible',
          'info',
          'Murid kembali membuka lembar ujian'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session.id, session.examNumber, session.studentName, exam.id]);

  // Answer handler
  const handleAnswerChange = useCallback(
    async (questionId: string, value: any) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setSaveStatus('saving');

      try {
        await saveStudentAnswerLocally(
          session.id,
          exam.id,
          session.examNumber,
          questionId,
          value
        );
        setSaveStatus('saved');
      } catch (err) {
        console.error('[StudentExamPlayer] Error autosaving answer:', err);
        setSaveStatus('saved');
      }
    },
    [session.id, session.examNumber, exam.id]
  );

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
      }).catch((e) => {
        console.warn('Fullscreen request rejected', e);
      });
    } else {
      document.exitFullscreen?.().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Submit Handler
  const handlePerformSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await submitStudentExamSession(session, exam);
      success('Jawaban ujian Anda berhasil dikirim!', 'Ujian Selesai');
      setIsFinished(true);
      setShowSubmitModal(false);
    } catch (err: any) {
      error(err.message || 'Gagal mengirimkan ujian. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-submit when timer expires
  const handleTimeExpire = useCallback(() => {
    info('Waktu ujian telah berakhir. Mengirimkan lembar jawaban otomatis...', 'Waktu Habis');
    handlePerformSubmit();
  }, []);

  // Answered questions metrics
  const { answeredCount, unansweredCount, missingRequiredList } = useMemo(() => {
    let answered = 0;
    const missingRequired: StudentExamQuestion[] = [];

    orderedQuestions.forEach((q) => {
      const val = answers[q.id];
      const isFilled =
        val !== undefined &&
        val !== null &&
        val !== '' &&
        !(Array.isArray(val) && val.length === 0);

      if (isFilled) {
        answered++;
      } else if (q.required) {
        missingRequired.push(q);
      }
    });

    return {
      answeredCount: answered,
      unansweredCount: orderedQuestions.length - answered,
      missingRequiredList: missingRequired
    };
  }, [orderedQuestions, answers]);

  // Focus and scroll to first missing question
  const handleScrollToFirstMissing = () => {
    setShowSubmitModal(false);
    if (missingRequiredList.length > 0) {
      const targetQ = missingRequiredList[0];
      const el = questionCardRefs.current[targetQ.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus?.();
      }
    }
  };

  // Scroll to top
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If already submitted and finished
  if (isFinished || session.status === 'SUBMITTED' || session.status === 'submitted') {
    return (
      <ExamFinishedView
        exam={exam}
        session={session}
        onExit={onFinishExam}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-28 selection:bg-blue-600 selection:text-white">
      {/* Sticky Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Left branding and student info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-2xs">
              EX
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900 truncate">
                  {exam.title}
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {exam.subjectName} • {session.studentClass || session.classId}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                <span className="font-semibold text-slate-700">{session.studentName}</span>{' '}
                <span className="font-mono text-slate-400">({session.examNumber})</span>
              </p>
            </div>
          </div>

          {/* Right Timer, Connection, Progress */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Status Sync Badge */}
            <div
              className={`hidden sm:flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border ${
                !isOnline
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : saveStatus === 'saving'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              title={!isOnline ? 'Pengerjaan offline (disimpan lokal)' : 'Tersinkronisasi otomatis'}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Offline (Lokal)</span>
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <Cloud className="w-3 h-3 text-blue-600 animate-pulse" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Tersimpan</span>
                </>
              )}
            </div>

            {/* Server-Authoritative Timer */}
            <ExamTimer
              expiresAt={session.expiresAt || session.expires_at || new Date().toISOString()}
              serverExpiresTime={session.serverExpiresTime}
              serverTimeOffset={session.server_time_offset}
              onExpire={handleTimeExpire}
              onTamperDetected={(tamperMsg) => {
                logSecurityEvent(
                  session.id,
                  exam.id,
                  session.examNumber,
                  session.studentName,
                  'clock_tamper',
                  'warning',
                  tamperMsg
                );
              }}
            />

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Progress Strip */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-1.5 text-xs text-slate-500">
          <div className="max-w-3xl mx-auto flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">
              Progres Pengerjaan: {answeredCount} dari {orderedQuestions.length} Soal
            </span>
            <span className="font-mono text-slate-400">
              {Math.round((answeredCount / (orderedQuestions.length || 1)) * 100)}%
            </span>
          </div>
          <div className="max-w-3xl mx-auto h-1.5 w-full bg-slate-200 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{
                width: `${(answeredCount / (orderedQuestions.length || 1)) * 100}%`
              }}
            />
          </div>
        </div>
      </header>

      {/* Multi-Tab Warning Banner */}
      {isMultiTabDetected && (
        <div className="max-w-3xl mx-auto mt-3 px-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Peringatan: Lembar ujian ini terdeteksi aktif di jendela / tab lain!
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Untuk mencegah konflik penyimpanan lembar jawaban dan menjaga integritas ujian, mohon tutup tab lain dan gunakan hanya satu jendela ini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Google Forms Single Page Scrollable Container */}
      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* Top Header Card (Google Forms Style) */}
        <div className="bg-white rounded-2xl border-t-8 border-t-blue-600 border-x border-b border-slate-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {exam.subjectName}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Kelas: {session.studentClass || session.classId}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {exam.title}
          </h1>

          {exam.description && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {exam.description}
            </p>
          )}

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Nama Peserta:</span>
              <span>{session.studentName}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-slate-600">
              <span>No. Ujian:</span>
              <span className="font-bold text-slate-800">{session.examNumber}</span>
            </div>
            <div className="text-[11px] text-rose-600 font-bold">
              * Menunjukkan pertanyaan yang wajib diisi
            </div>
          </div>
        </div>

        {/* Question Cards (Google Forms Format) */}
        {orderedQuestions.map((question, qIndex) => {
          const qNumber = qIndex + 1;
          const currentAnswer = answers[question.id];

          // Option ordering: respect session's stable optionOrders
          const optionOrderList =
            session.optionOrders?.[question.id] ||
            session.option_orders?.[question.id] ||
            [];

          const displayOptions = question.options
            ? question.options.slice().sort((a, b) => {
                if (optionOrderList.length > 0) {
                  const idxA = optionOrderList.indexOf(a.id);
                  const idxB = optionOrderList.indexOf(b.id);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                }
                return 0;
              })
            : [];

          const isUnanswered =
            currentAnswer === undefined ||
            currentAnswer === null ||
            currentAnswer === '' ||
            (Array.isArray(currentAnswer) && currentAnswer.length === 0);

          return (
            <div
              key={question.id}
              ref={(el) => (questionCardRefs.current[question.id] = el)}
              id={`question-card-${question.id}`}
              tabIndex={-1}
              className={`bg-white rounded-2xl border transition-all duration-200 p-5 sm:p-6 shadow-xs space-y-4 ${
                !isUnanswered
                  ? 'border-slate-200 focus-within:border-blue-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 font-mono">
                    Soal {qNumber}
                  </span>
                  {question.required && (
                    <span className="text-rose-600 font-extrabold text-sm" title="Pertanyaan wajib diisi">
                      *
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {question.type === 'single_choice'
                      ? 'Pilihan Ganda'
                      : question.type === 'multiple_choice'
                      ? 'Pilihan Ganda Kompleks'
                      : question.type === 'true_false'
                      ? 'Benar / Salah'
                      : 'Esai'}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-xs sm:text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                {question.questionText}
              </div>

              {/* Question Image (if any) */}
              {question.imageUrl && (
                <div className="my-2 p-1 bg-slate-50 rounded-xl border border-slate-200 inline-block max-w-full">
                  <img
                    src={question.imageUrl}
                    alt={`Ilustrasi Soal ${qNumber}`}
                    className="max-h-72 max-w-full rounded-lg object-contain"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Question Input Type Renderer */}
              <div className="pt-2">
                {/* 1. SINGLE CHOICE (Radio) */}
                {question.type === 'single_choice' && (
                  <div className="space-y-2">
                    {displayOptions.map((opt, optIdx) => {
                      const optLabel = String.fromCharCode(65 + optIdx); // A, B, C, D...
                      const isSelected = currentAnswer === opt.id;

                      return (
                        <label
                          key={opt.id}
                          onClick={() => handleAnswerChange(question.id, opt.id)}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 border-blue-500 shadow-2xs text-blue-900'
                              : 'bg-white border-slate-200 hover:bg-slate-50/70 text-slate-700'
                          }`}
                        >
                          <div className="pt-0.5">
                            <input
                              type="radio"
                              name={`radio_${question.id}`}
                              checked={isSelected}
                              onChange={() => {}} // Handled by container label
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                          </div>
                          <div className="flex-1 text-xs sm:text-sm">
                            <span className="font-bold mr-1 text-slate-800">
                              {optLabel}.
                            </span>
                            <span>{opt.text}</span>

                            {opt.imageUrl && (
                              <div className="mt-2">
                                <img
                                  src={opt.imageUrl}
                                  alt={`Opsi ${optLabel}`}
                                  className="max-h-36 rounded-lg border border-slate-200 object-contain bg-white"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* 2. MULTIPLE CHOICE / PG KOMPLEKS (Checkboxes) */}
                {question.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 italic mb-2">
                      * Pilih satu atau beberapa pilihan yang menurut Anda benar.
                    </p>
                    {displayOptions.map((opt, optIdx) => {
                      const optLabel = String.fromCharCode(65 + optIdx);
                      const selectedArray: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
                      const isChecked = selectedArray.includes(opt.id);

                      const handleToggleOption = () => {
                        let updated: string[];
                        if (isChecked) {
                          updated = selectedArray.filter((id) => id !== opt.id);
                        } else {
                          updated = [...selectedArray, opt.id];
                        }
                        handleAnswerChange(question.id, updated);
                      };

                      return (
                        <label
                          key={opt.id}
                          onClick={handleToggleOption}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-500 shadow-2xs text-blue-900'
                              : 'bg-white border-slate-200 hover:bg-slate-50/70 text-slate-700'
                          }`}
                        >
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by container
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                            />
                          </div>
                          <div className="flex-1 text-xs sm:text-sm">
                            <span className="font-bold mr-1 text-slate-800">
                              {optLabel}.
                            </span>
                            <span>{opt.text}</span>

                            {opt.imageUrl && (
                              <div className="mt-2">
                                <img
                                  src={opt.imageUrl}
                                  alt={`Opsi ${optLabel}`}
                                  className="max-h-36 rounded-lg border border-slate-200 object-contain bg-white"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* 3. TRUE / FALSE (Radio Benar / Salah) */}
                {question.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleAnswerChange(question.id, true)}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        currentAnswer === true
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>BENAR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAnswerChange(question.id, false)}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        currentAnswer === false
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-600/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-rose-50 hover:border-rose-300'
                      }`}
                    >
                      <span>SALAH</span>
                    </button>
                  </div>
                )}

                {/* 4. ESSAY (Spacious Textarea) */}
                {question.type === 'essay' && (
                  <div className="space-y-1.5">
                    <textarea
                      rows={5}
                      value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="Tuliskan uraian jawaban Anda secara jelas dan lengkap..."
                      className="w-full p-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white placeholder:text-slate-400 transition"
                    />
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Jawaban tersimpan otomatis saat mengetik.</span>
                      <span>
                        {(typeof currentAnswer === 'string' ? currentAnswer.length : 0)} Karakter
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom Submission Review Card (Google Forms Style) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Selesai Mengerjakan Ujian?
              </h3>
              <p className="text-xs text-slate-500">
                Periksa kembali ringkasan lembar jawaban Anda sebelum mengirim.
              </p>
            </div>
            <button
              onClick={handleScrollToTop}
              className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Kembali ke Atas</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-slate-600 font-medium">
                Total Dijawab:{' '}
                <strong className="text-emerald-700 font-bold">
                  {answeredCount}
                </strong>{' '}
                / {orderedQuestions.length}
              </span>
              {unansweredCount > 0 && (
                <span className="text-amber-700 font-medium">
                  ({unansweredCount} belum terisi)
                </span>
              )}
            </div>

            {missingRequiredList.length > 0 && (
              <span className="text-rose-600 font-bold">
                ⚠️ {missingRequiredList.length} soal wajib belum terisi
              </span>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Kirim Lembar Jawaban Ujian</span>
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <ExamSubmitDialog
          totalQuestions={orderedQuestions.length}
          answeredCount={answeredCount}
          unansweredCount={unansweredCount}
          missingRequiredCount={missingRequiredList.length}
          isSubmitting={isSubmitting}
          onConfirmSubmit={handlePerformSubmit}
          onCancel={() => setShowSubmitModal(false)}
          onReviewMissing={handleScrollToFirstMissing}
        />
      )}
    </div>
  );
};
