import React, { useState, useEffect } from 'react';
import type { Exam, ExamSession, ExamResult, StudentSafeExam } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../lib/dexie';
import { isFirebaseConfigured, firestore } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  sanitizeToStudentSafeExam,
  checkExistingStudentSession,
  startOrResumeStudentSession
} from '../../services/studentExamService';
import { StudentExamAccess } from './StudentExamAccess';
import { StudentExamPlayer } from './StudentExamPlayer';
import { StudentResultView } from './StudentResultView';
import { Loader2 } from 'lucide-react';

interface StudentDashboardProps {
  exams: Exam[];
  results: ExamResult[];
  onExamFinished: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  exams,
  results,
  onExamFinished
}) => {
  const { user, logout } = useAuth();
  const { success, error } = useToast();

  const [activeSafeExam, setActiveSafeExam] = useState<StudentSafeExam | null>(null);
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, any>>({});
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [viewingResult, setViewingResult] = useState<{ exam: Exam; result: ExamResult } | null>(null);

  // Check if there is an active session in Dexie for this student on mount
  useEffect(() => {
    let isMounted = true;

    const resumeActiveSession = async () => {
      setIsLoadingSession(true);
      try {
        const studentExamNumber = user?.nis || '';
        if (!studentExamNumber) {
          setIsLoadingSession(false);
          return;
        }

        // Find in-progress session for this student in Dexie
        const existingSession = await db.examSessions
          .filter((s) => {
            const numMatch = s.examNumber === studentExamNumber || s.student_nis === studentExamNumber;
            const statusMatch = s.status === 'IN_PROGRESS' || s.status === 'in_progress';
            return Boolean(numMatch && statusMatch);
          })
          .first();

        if (existingSession && isMounted) {
          const targetExamId = existingSession.examId || existingSession.exam_id;

          // Look up exam from cached safe exams or prop exams
          let safeExam: StudentSafeExam | undefined = await db.studentSafeExams.get(targetExamId);
          if (!safeExam) {
            const rawExam = exams.find((e) => e.id === targetExamId);
            if (rawExam) {
              safeExam = sanitizeToStudentSafeExam(rawExam);
            }
          }

          if (safeExam) {
            // Load local answers
            const localAnswers = await db.answers
              .where('sessionId')
              .equals(existingSession.id)
              .toArray();

            const answersMap: Record<string, any> = {};
            localAnswers.forEach((a) => {
              const qId = a.questionId || a.question_id;
              if (qId) {
                answersMap[qId] = a.answer;
              }
            });

            setActiveSafeExam(safeExam);
            setActiveSession(existingSession);
            setInitialAnswers(answersMap);
          }
        }
      } catch (err) {
        console.warn('[StudentDashboard] Gagal memulihkan sesi aktif:', err);
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    };

    resumeActiveSession();

    return () => {
      isMounted = false;
    };
  }, [user?.nis, exams]);

  // Handler when starting exam from StudentExamAccess
  const handleStartExamFromAccess = (
    safeExam: StudentSafeExam,
    session: ExamSession,
    answers: Record<string, any>
  ) => {
    setActiveSafeExam(safeExam);
    setActiveSession(session);
    setInitialAnswers(answers);
  };

  const handleViewResult = async (examId: string, examNumber: string) => {
    try {
      const exam = exams.find((e) => e.id === examId);
      if (!exam) {
        error('Data paket ujian tidak ditemukan.', 'Gagal');
        return;
      }

      // First check prop results or Dexie
      let resultItem = results.find(
        (r) =>
          (r.exam_id === examId || r.examId === examId) &&
          (r.student_nis === examNumber || r.studentNis === examNumber)
      );

      if (!resultItem) {
        resultItem = await db.examResults
          .where('examId')
          .equals(examId)
          .and((r) => r.studentNis === examNumber || r.student_nis === examNumber)
          .first();
      }

      // Also check Firestore if available
      if (!resultItem && isFirebaseConfigured()) {
        try {
          const docRef = doc(firestore, 'results', `${examId}_${examNumber}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            resultItem = snap.data() as ExamResult;
          }
        } catch (err) {
          console.warn('[StudentDashboard] Firestore read failed or protected by security rules:', err);
        }
      }

      if (resultItem) {
        setViewingResult({ exam, result: resultItem });
      } else {
        error(
          'Hasil nilai ujian Anda belum dirilis oleh guru pengampu.',
          'Belum Dirilis'
        );
      }
    } catch (err: any) {
      error(err.message || 'Gagal memuat hasil ujian.', 'Error');
    }
  };

  // Loading state
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">
          Memeriksa Lembar Ujian Siswa...
        </p>
      </div>
    );
  }

  // Viewing exam result view
  if (viewingResult) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <StudentResultView
          exam={viewingResult.exam}
          result={viewingResult.result}
          onBack={() => setViewingResult(null)}
        />
      </div>
    );
  }

  // Active Exam Player (Google Forms single scrollable page)
  if (activeSafeExam && activeSession) {
    return (
      <StudentExamPlayer
        exam={activeSafeExam}
        session={activeSession}
        initialAnswers={initialAnswers}
        onFinishExam={() => {
          setActiveSafeExam(null);
          setActiveSession(null);
          onExamFinished();
          logout();
        }}
      />
    );
  }

  // If no active exam session: Google Forms access portal (NO list of all exams shown!)
  return (
    <StudentExamAccess
      onStartExam={handleStartExamFromAccess}
      onViewResult={handleViewResult}
    />
  );
};
