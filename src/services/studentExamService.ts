import { db } from '../lib/dexie';
import { db as firestore } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import type {
  Exam,
  StudentSafeExam,
  StudentExamQuestion,
  StudentExamOption,
  ExamSession,
  StudentAnswer,
  SyncStatus
} from '../types';
import { getStoredExams } from './examService';

/**
 * Sanitizes any Exam object into a StudentSafeExam projection DTO.
 * CRITICAL SECURITY (Req 15 & 16):
 * Absolutely NO answer keys, NO option scores, NO expected answers, NO rubrics, NO points!
 */
export function sanitizeToStudentSafeExam(rawExam: Exam): StudentSafeExam {
  // Extract snapshot questions
  const rawQuestions: any[] =
    rawExam.questions && rawExam.questions.length > 0
      ? rawExam.questions
      : rawExam.questions_snapshot && rawExam.questions_snapshot.length > 0
      ? rawExam.questions_snapshot
      : [];

  const studentSafeQuestions: StudentExamQuestion[] = rawQuestions.map((q, idx) => {
    // Sanitize options
    const safeOptions: StudentExamOption[] = (q.options || []).map((opt: any) => ({
      id: String(opt.id),
      text: String(opt.text || ''),
      imageUrl: opt.imageUrl || opt.image_url || undefined
    }));

    return {
      id: String(q.id || q.question_id || `q_${idx + 1}`),
      order: typeof q.order === 'number' ? q.order : idx + 1,
      type: q.type || q.question_type || 'single_choice',
      questionText: q.questionText || q.question_text || '',
      imageUrl: q.imageUrl || q.imageRef || q.image_url || undefined,
      options: safeOptions,
      required: q.required !== false // default true
    };
  });

  return {
    id: rawExam.id,
    examToken: (rawExam.examToken || rawExam.pin || '').trim().toUpperCase(),
    title: rawExam.title || 'Ujian Sekolah',
    description: rawExam.description || '',
    subjectName: rawExam.subjectName || rawExam.subject_name || 'Mata Pelajaran',
    className: rawExam.className || (rawExam as any).class_name || (rawExam.class_names && rawExam.class_names.join(', ')) || 'Semua Kelas',
    classNames: rawExam.class_names || (rawExam.className ? [rawExam.className] : []),
    durationMinutes: rawExam.durationMinutes || rawExam.duration_minutes || 60,
    startAt: rawExam.startAt || rawExam.start_at,
    endAt: rawExam.endAt || rawExam.end_at,
    shuffleQuestions: Boolean(
      rawExam.shuffleQuestions ?? rawExam.settings?.shuffle_questions ?? true
    ),
    shuffleOptions: Boolean(
      rawExam.shuffleOptions ?? rawExam.settings?.shuffle_options ?? true
    ),
    questions: studentSafeQuestions,
    totalQuestions: studentSafeQuestions.length,
    status: rawExam.status
  };
}

/**
 * Fisher-Yates array shuffler for deterministic session orders
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Validates student credentials and retrieves the student-safe exam projection.
 * Supports token-only access (anonymous murid session) or card credentials.
 */
export async function validateStudentExamAccess(creds: {
  token: string;
  fullName?: string;
  className?: string;
  examNumber?: string;
}): Promise<{
  safeExam: StudentSafeExam;
  existingSession: ExamSession | null;
  answers: Record<string, any>;
}> {
  const cleanToken = creds.token.trim().toUpperCase();

  if (!cleanToken || cleanToken.length < 4) {
    throw new Error('Token Ujian minimal 4 karakter alfanumerik.');
  }

  let safeExam: StudentSafeExam | null = null;

  // 1. Try Backend Server verification endpoint first (authoritative and safe)
  try {
    const res = await fetch('/api/student/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.safeExam) {
        safeExam = data.safeExam;
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    console.warn('[studentExamService] Server token check unavailable, attempting local/cloud lookup:', err);
  }

  // 2. If server not reached, try Firestore sanitized studentExams or local store
  if (!safeExam) {
    let targetExam: Exam | null = null;
    if (firestore) {
      try {
        const studentExamsRef = collection(firestore, 'studentExams');
        const qToken = query(studentExamsRef, where('examToken', '==', cleanToken));
        const snap = await getDocs(qToken);
        if (!snap.empty) {
          safeExam = snap.docs[0].data() as StudentSafeExam;
        }
      } catch (err) {
        console.warn('[studentExamService] Cloud studentExams check failed, checking local store:', err);
      }
    }

    // Fallback to local stored exams
    if (!safeExam) {
      const localExams = getStoredExams();
      const found = localExams.find(
        (e) => (e.examToken || e.pin || '').trim().toUpperCase() === cleanToken
      );
      if (found) {
        targetExam = found;
        safeExam = sanitizeToStudentSafeExam(targetExam);
      }
    }
  }

  if (!safeExam) {
    throw new Error(
      'Token Ujian tidak ditemukan. Pastikan Anda memasukkan token yang tepat dari pengawas ujian.'
    );
  }

  // 3. Cache safe exam in Dexie so offline recovery is 100% resilient
  try {
    await db.studentSafeExams.put(safeExam);
  } catch (err) {
    console.warn('[studentExamService] Gagal cache studentSafeExam ke Dexie:', err);
  }

  // 4. Check for existing session in Dexie
  const lookupNumber = creds.examNumber ? creds.examNumber.trim() : '';
  const { session: existingSession, answers } = await checkExistingStudentSession(
    safeExam.id,
    lookupNumber
  );

  return {
    safeExam,
    existingSession,
    answers
  };
}

/**
 * Checks Dexie and Firestore for an existing session matching examId and examNumber
 */
export async function checkExistingStudentSession(
  examId: string,
  examNumber: string
): Promise<{
  session: ExamSession | null;
  answers: Record<string, any>;
}> {
  // Deterministic session ID format
  const cleanNum = examNumber.replace(/[^a-zA-Z0-9]/g, '_');
  const sessionId = `sess_${examId}_${cleanNum}`;

  // 1. Check Dexie
  let session = await db.examSessions.get(sessionId);
  if (!session) {
    // Query by properties
    session = await db.examSessions
      .where('examId')
      .equals(examId)
      .and((s) => s.examNumber === examNumber)
      .first();
  }

  // 2. Check Firestore if not found locally
  if (!session && firestore) {
    try {
      const sessDoc = await getDoc(doc(firestore, 'examSessions', sessionId));
      if (sessDoc.exists()) {
        session = sessDoc.data() as ExamSession;
        // Save to local Dexie
        await db.examSessions.put(session);
      }
    } catch (err) {
      console.warn('[studentExamService] Gagal cek cloud session:', err);
    }
  }

  if (!session) {
    return { session: null, answers: {} };
  }

  // Load answers from Dexie
  const localAnswers = await db.answers
    .where('sessionId')
    .equals(session.id)
    .toArray();

  const answersMap: Record<string, any> = {};
  localAnswers.forEach((a) => {
    const qId = a.questionId || a.question_id;
    if (qId) {
      answersMap[qId] = a.answer;
    }
  });

  return { session, answers: answersMap };
}

/**
 * Starts or resumes a student exam session with server-authoritative timer
 */
export async function startOrResumeStudentSession(
  exam: StudentSafeExam,
  student?: {
    fullName?: string;
    className?: string;
    examNumber?: string;
  }
): Promise<{
  session: ExamSession;
  answers: Record<string, any>;
}> {
  const isAnonymous = !student?.examNumber;
  const sessionIdentifier = student?.examNumber
    ? student.examNumber.replace(/[^a-zA-Z0-9]/g, '_')
    : `anon_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const sessionId = `sess_${exam.id}_${sessionIdentifier}`;

  // Check if session already exists
  if (student?.examNumber) {
    const existing = await checkExistingStudentSession(exam.id, student.examNumber);
    if (existing.session) {
      if (existing.session.isLocked && !existing.session.allowRelogin) {
        throw new Error(
          'Sesi Ujian Anda terkunci (perangkat terputus / keluar dari aplikasi). Silakan hubungi Administrator atau Pengawas untuk Membuka Kunci Sesi (Izinkan Masuk Ulang).'
        );
      }

      if (existing.session.allowRelogin) {
        existing.session.isLocked = false;
        existing.session.allowRelogin = false;
        try {
          await db.examSessions.update(existing.session.id, { isLocked: false, allowRelogin: false });
        } catch {
          // Local update silent catch
        }
      }

      if (
        existing.session.status === 'IN_PROGRESS' ||
        existing.session.status === 'in_progress'
      ) {
        return existing;
      }

      if (
        existing.session.status === 'SUBMITTED' ||
        existing.session.status === 'submitted'
      ) {
        throw new Error(
          'Ujian ini sudah pernah Anda kirimkan (SUBMITTED). Tidak dapat mengerjakan ulang.'
        );
      }

      if (
        existing.session.status === 'EXPIRED' ||
        existing.session.status === 'expired'
      ) {
        throw new Error('Sesi ujian ini telah berakhir (EXPIRED).');
      }
    }
  }

  // Generate stable question order
  let questionIds = exam.questions.map((q) => q.id);
  if (exam.shuffleQuestions) {
    questionIds = shuffleArray(questionIds);
  }

  // Generate stable option orders per question
  const optionOrders: Record<string, string[]> = {};
  exam.questions.forEach((q) => {
    if (q.options && q.options.length > 0) {
      let optIds = q.options.map((o) => o.id);
      if (exam.shuffleOptions && (q.type === 'single_choice' || q.type === 'multiple_choice')) {
        optIds = shuffleArray(optIds);
      }
      optionOrders[q.id] = optIds;
    }
  });

  // Calculate Server-Authoritative Timer bounds
  let serverStartTime = Date.now();
  const durationMs = (exam.durationMinutes || 60) * 60 * 1000;
  let targetExpiresMs = serverStartTime + durationMs;

  if (exam.endAt) {
    const endAtMs = new Date(exam.endAt).getTime();
    if (!isNaN(endAtMs) && endAtMs < targetExpiresMs) {
      targetExpiresMs = endAtMs;
    }
  }

  const studentName = student?.fullName || 'Peserta Ujian';
  const studentClass = student?.className || exam.className || 'Umum';
  const studentNis = student?.examNumber || sessionIdentifier;

  // Authoritative server check via API
  let serverSessionToken: string | undefined;
  try {
    const res = await fetch('/api/student/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: exam.id,
        token: exam.examToken,
        sessionId,
        studentName,
        studentClass,
        examNumber: studentNis
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.serverTime && data.serverExpiresTime) {
        serverStartTime = data.serverTime;
        targetExpiresMs = data.serverExpiresTime;
      }
      if (data.sessionToken) {
        serverSessionToken = data.sessionToken;
      }
    }
  } catch (e) {
    console.warn('[studentExamService] Server session call offline, using monotonic calculation:', e);
  }

  const startedAt = new Date(serverStartTime).toISOString();
  const expiresAt = new Date(targetExpiresMs).toISOString();

  const newSession: ExamSession = {
    id: sessionId,
    sessionToken: serverSessionToken,
    examId: exam.id,
    exam_id: exam.id,
    examTitle: exam.title,
    exam_title: exam.title,
    studentName,
    student_name: studentName,
    classId: studentClass,
    studentClass,
    student_class: studentClass,
    examNumber: studentNis,
    student_nis: studentNis,
    student_id: isAnonymous ? sessionId : `student_${studentNis}`,
    status: 'IN_PROGRESS',
    isAnonymous,
    examToken: exam.examToken,
    startedAt,
    started_at: startedAt,
    expiresAt,
    expires_at: expiresAt,
    serverStartTime,
    serverExpiresTime: targetExpiresMs,
    questionOrder: questionIds,
    question_order: questionIds,
    optionOrders,
    option_orders: optionOrders,
    current_question_index: 0,
    lastSavedAt: startedAt,
    last_sync: startedAt,
    server_time_offset: serverStartTime - Date.now(),
    createdAt: startedAt,
    created_at: startedAt,
    updatedAt: startedAt,
    updated_at: startedAt
  };

  // Save to Dexie immediately
  await db.examSessions.put(newSession);

  // Sync to Firestore if available
  if (firestore) {
    try {
      await setDoc(doc(firestore, 'examSessions', sessionId), newSession, { merge: true });
    } catch (err) {
      console.warn('[studentExamService] Cloud session creation failed (offline mode active):', err);
    }
  }

  return { session: newSession, answers: {} };
}

// Debounce map for cloud synchronization
const debouncedCloudSyncTimeouts: Record<string, NodeJS.Timeout> = {};

/**
 * Saves student answer locally to Dexie first (Req 7 & 8), then triggers debounced cloud sync
 */
export async function saveStudentAnswerLocally(
  sessionId: string,
  examId: string,
  studentExamNumber: string,
  questionId: string,
  answer: any
): Promise<StudentAnswer> {
  const answerId = `${sessionId}_${questionId}`;
  const now = new Date().toISOString();

  // Check if an existing local answer has a newer updatedAt (Conflict resolution)
  const existing = await db.answers.get(answerId);
  if (existing && existing.updatedAt && new Date(existing.updatedAt).getTime() > new Date(now).getTime()) {
    return existing;
  }

  const record: StudentAnswer = {
    id: answerId,
    sessionId,
    session_id: sessionId,
    examId,
    exam_id: examId,
    studentId: `student_${studentExamNumber}`,
    student_id: `student_${studentExamNumber}`,
    questionId,
    question_id: questionId,
    answer,
    syncStatus: 'LOCAL_ONLY',
    sync_status: 'LOCAL_ONLY',
    updatedAt: now,
    updated_at: now
  };

  // 1. Immediate save to Dexie
  await db.answers.put(record);

  // 2. Update session's lastSavedAt in Dexie
  await db.examSessions.update(sessionId, {
    lastSavedAt: now,
    last_saved_at: now,
    updatedAt: now,
    updated_at: now
  });

  // 3. Debounced cloud sync (1000ms)
  if (debouncedCloudSyncTimeouts[answerId]) {
    clearTimeout(debouncedCloudSyncTimeouts[answerId]);
  }

  debouncedCloudSyncTimeouts[answerId] = setTimeout(async () => {
    delete debouncedCloudSyncTimeouts[answerId];
    if (!firestore) return;

    try {
      await updateDoc(doc(firestore, 'answers', answerId), {
        ...record,
        syncStatus: 'SYNCED',
        sync_status: 'SYNCED'
      }).catch(async () => {
        // If doc does not exist, use setDoc
        await setDoc(doc(firestore, 'answers', answerId), {
          ...record,
          syncStatus: 'SYNCED',
          sync_status: 'SYNCED'
        });
      });

      // Mark locally as SYNCED
      await db.answers.update(answerId, {
        syncStatus: 'SYNCED',
        sync_status: 'SYNCED'
      });
    } catch (err) {
      console.warn('[studentExamService] Background answer sync failed (retained locally):', err);
      await db.answers.update(answerId, {
        syncStatus: 'SYNC_FAILED',
        sync_status: 'SYNC_FAILED'
      });
    }
  }, 1000);

  return record;
}

/**
 * Submits the exam session with strict idempotency (Req 22).
 */
export async function submitStudentExamSession(
  session: ExamSession,
  exam: StudentSafeExam
): Promise<{ success: boolean; submittedAt: string; resultId?: string }> {
  // Idempotency check: if already submitted, do not re-submit!
  const currentSession = await db.examSessions.get(session.id);
  if (
    currentSession &&
    (currentSession.status === 'SUBMITTED' || currentSession.status === 'submitted')
  ) {
    return {
      success: true,
      submittedAt: currentSession.submittedAt || currentSession.submitted_at || new Date().toISOString()
    };
  }

  const submittedAt = new Date().toISOString();

  // 1. Gather all local answers
  const allLocalAnswers = await db.answers
    .where('sessionId')
    .equals(session.id)
    .toArray();

  const answersMap: Record<string, any> = {};
  allLocalAnswers.forEach((ans) => {
    const qId = ans.questionId || ans.question_id;
    if (qId) {
      answersMap[qId] = ans.answer;
    }
  });

  // 2. Submit to Authoritative Backend Grading (CRIT-02 & CRIT-03)
  let backendResultId: string | undefined;
  try {
    const res = await fetch('/api/student/submit-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        sessionToken: session.sessionToken,
        examId: exam.id,
        answers: answersMap,
        clientSubmittedAt: submittedAt
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.resultId) {
        backendResultId = data.resultId;
      }
    }
  } catch (err) {
    console.warn('[studentExamService] Backend submission call failed, falling back to local sync:', err);
  }

  // 3. Flush all local answers to Firestore if configured
  if (firestore) {
    const syncPromises = allLocalAnswers.map(async (ans) => {
      try {
        await setDoc(
          doc(firestore, 'answers', ans.id),
          { ...ans, syncStatus: 'SYNCED', sync_status: 'SYNCED' },
          { merge: true }
        );
      } catch (e) {
        console.warn('Failed flushing answer', ans.id, e);
      }
    });
    await Promise.allSettled(syncPromises);
  }

  // 4. Mark session as SUBMITTED locally in Dexie
  await db.examSessions.update(session.id, {
    status: 'SUBMITTED',
    submittedAt,
    submitted_at: submittedAt,
    updatedAt: submittedAt,
    updated_at: submittedAt
  });

  // 5. Mark session as SUBMITTED in Firestore
  if (firestore) {
    try {
      await updateDoc(doc(firestore, 'examSessions', session.id), {
        status: 'SUBMITTED',
        submittedAt,
        submitted_at: submittedAt,
        updatedAt: submittedAt,
        updated_at: submittedAt
      });
    } catch (err) {
      console.warn('[studentExamService] Cloud session submission update failed:', err);
    }
  }

  return { success: true, submittedAt, resultId: backendResultId };
}
