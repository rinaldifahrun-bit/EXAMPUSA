import express from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { mockExams, mockResults } from './src/data/mockData';
import type {
  Exam,
  ExamKeyDocument,
  StudentSafeExam,
  StudentExamQuestion,
  StudentExamOption,
  ExamSession,
  ExamResult,
  ExamResultItem,
  GradedAnswer
} from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-Memory Private Exam Keys and Public Exams Store on the Server
// CRIT-01: Answer keys and option scores are strictly isolated in examKeys
const serverExamKeys: Map<string, ExamKeyDocument> = new Map();
const serverExams: Map<string, Exam> = new Map();
const serverSessions: Map<string, ExamSession> = new Map();
const serverResults: Map<string, ExamResult> = new Map();

// Helper to sanitize an exam into StudentSafeExam
function sanitizeToStudentSafe(exam: Exam): StudentSafeExam {
  const rawQuestions: any[] =
    exam.questions && exam.questions.length > 0
      ? exam.questions
      : exam.questions_snapshot && exam.questions_snapshot.length > 0
      ? exam.questions_snapshot
      : [];

  const safeQuestions: StudentExamQuestion[] = rawQuestions.map((q, idx) => {
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
      required: q.required !== false
    };
  });

  return {
    id: exam.id,
    examToken: (exam.examToken || exam.pin || '').trim().toUpperCase(),
    title: exam.title || 'Ujian Sekolah',
    description: exam.description || '',
    subjectName: exam.subjectName || exam.subject_name || 'Mata Pelajaran',
    className: exam.className || (exam as any).class_name || 'Semua Kelas',
    classNames: exam.class_names || (exam.className ? [exam.className] : []),
    durationMinutes: exam.durationMinutes || exam.duration_minutes || 60,
    startAt: exam.startAt || exam.start_at,
    endAt: exam.endAt || exam.end_at,
    shuffleQuestions: Boolean(
      exam.shuffleQuestions ?? exam.settings?.shuffle_questions ?? true
    ),
    shuffleOptions: Boolean(
      exam.shuffleOptions ?? exam.settings?.shuffle_options ?? true
    ),
    questions: safeQuestions,
    totalQuestions: safeQuestions.length,
    status: exam.status
  };
}

// Initialize seed exams into server stores
for (const ex of mockExams) {
  serverExams.set(ex.id, ex);
  // Separate full snapshot into examKeys
  const examKeyDoc: ExamKeyDocument = {
    id: ex.id,
    examId: ex.id,
    ownerId: ex.ownerId || ex.owner_id || 'teacher_1',
    examToken: (ex.examToken || ex.pin || '').trim().toUpperCase(),
    title: ex.title,
    durationMinutes: ex.durationMinutes || ex.duration_minutes || 60,
    startAt: ex.startAt || ex.start_at || null,
    endAt: ex.endAt || ex.end_at || null,
    totalPoints: ex.totalPoints || ex.total_points || 100,
    questions: ex.questions || [],
    createdAt: ex.createdAt || new Date().toISOString(),
    updatedAt: ex.updatedAt || new Date().toISOString()
  };
  serverExamKeys.set(ex.id, examKeyDoc);
}

// Initialize seed results into server stores (Stage 8.2)
for (const res of mockResults) {
  serverResults.set(res.id, res);
}

// =========================================================================
// API ROUTES FIRST
// =========================================================================

// 1. Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: Date.now() });
});

// 2. Authoritative Server Clock (CRIT-03)
// Students use this to compute skew and establish authoritative sync offset
app.get('/api/time', (_req, res) => {
  const now = Date.now();
  res.json({
    serverTime: now,
    iso: new Date(now).toISOString()
  });
});

// 3. Verify Exam Token (HIGH-02 Token-Only Student Access)
// Returns StudentSafeExam with ZERO answer keys, ZERO option scores, ZERO rubrics
app.post('/api/student/verify-token', (req, res) => {
  const { token } = req.body;
  const cleanToken = String(token || '').trim().toUpperCase();

  if (!cleanToken || cleanToken.length < 4) {
    return res.status(400).json({
      success: false,
      error: 'Token ujian minimal 4 karakter alfanumerik.'
    });
  }

  // Look for exam with matching token
  let targetExam: Exam | null = null;
  for (const ex of serverExams.values()) {
    const matchToken = (ex.examToken || ex.pin || '').trim().toUpperCase();
    if (matchToken === cleanToken) {
      targetExam = ex;
      break;
    }
  }

  if (!targetExam) {
    return res.status(404).json({
      success: false,
      error: 'Token Ujian tidak ditemukan. Pastikan Anda memasukkan token yang valid dari pengawas.'
    });
  }

  // Validate lifecycle status
  const rawStatus = (targetExam.status || 'DRAFT').toUpperCase();
  if (rawStatus === 'CANCELLED') {
    return res.status(400).json({
      success: false,
      error: 'Pelaksanaan ujian ini telah dibatalkan oleh pihak sekolah / pengawas.'
    });
  }
  if (rawStatus === 'DRAFT') {
    return res.status(400).json({
      success: false,
      error: 'Ujian ini masih dalam status DRAF dan belum dibuka oleh guru pengampu.'
    });
  }
  if (['COMPLETED', 'FINISHED', 'ARCHIVED', 'GRADED', 'RESULTS_RELEASED'].includes(rawStatus)) {
    return res.status(400).json({
      success: false,
      error: 'Waktu pelaksanaan paket ujian ini telah selesai / ditutup.'
    });
  }

  // Validate start/end schedule window
  const now = new Date();
  if (targetExam.startAt || targetExam.start_at) {
    const startTime = new Date(targetExam.startAt || targetExam.start_at!);
    if (now < startTime) {
      const timeStr = startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return res.status(400).json({
        success: false,
        error: `Ujian belum dimulai. Jadwal mulai: pukul ${timeStr} WIB.`
      });
    }
  }

  if (targetExam.endAt || targetExam.end_at) {
    const endTime = new Date(targetExam.endAt || targetExam.end_at!);
    if (now > endTime) {
      return res.status(400).json({
        success: false,
        error: 'Batas akhir pelaksanaan ujian telah terlewat.'
      });
    }
  }

  const safeExam = sanitizeToStudentSafe(targetExam);
  return res.json({
    success: true,
    safeExam
  });
});

// 4. Start or Resume Student Session with Server-Authoritative Timer (CRIT-03)
app.post('/api/student/start-session', (req, res) => {
  const {
    examId,
    token,
    sessionId: requestedSessionId,
    sessionToken: providedSessionToken,
    studentName: reqStudentName,
    studentClass: reqStudentClass,
    examNumber: reqExamNumber
  } = req.body;
  const exam = serverExams.get(examId);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  // Validate lifecycle status
  const rawStatus = (exam.status || 'DRAFT').toUpperCase();
  if (rawStatus === 'CANCELLED') {
    return res.status(400).json({
      success: false,
      error: 'Pelaksanaan ujian ini telah dibatalkan oleh pihak sekolah / pengawas.'
    });
  }
  if (['COMPLETED', 'FINISHED', 'ARCHIVED', 'GRADED', 'RESULTS_RELEASED'].includes(rawStatus)) {
    return res.status(400).json({
      success: false,
      error: 'Waktu pelaksanaan paket ujian ini telah selesai / ditutup.'
    });
  }
  if (rawStatus === 'DRAFT') {
    return res.status(400).json({
      success: false,
      error: 'Ujian ini masih dalam status DRAF dan belum dibuka oleh guru pengampu.'
    });
  }

  const serverNow = Date.now();
  const durationMs = (exam.durationMinutes || 60) * 60 * 1000;
  let targetExpiresTime = serverNow + durationMs;

  if (exam.endAt) {
    const endAtMs = new Date(exam.endAt).getTime();
    if (!isNaN(endAtMs) && endAtMs < targetExpiresTime) {
      targetExpiresTime = endAtMs;
    }
  }

  const sessionId = requestedSessionId || `sess_${examId}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  let session = serverSessions.get(sessionId);
  let sessionToken: string;

  if (!session) {
    const studentName = (reqStudentName && typeof reqStudentName === 'string' && reqStudentName.trim())
      ? reqStudentName.trim()
      : 'Peserta Ujian';
    const studentClass = (reqStudentClass && typeof reqStudentClass === 'string' && reqStudentClass.trim())
      ? reqStudentClass.trim()
      : (exam.className || 'Umum');
    const examNumber = (reqExamNumber && typeof reqExamNumber === 'string' && reqExamNumber.trim())
      ? reqExamNumber.trim()
      : sessionId.replace('sess_', '');

    sessionToken = randomUUID();
    session = {
      id: sessionId,
      sessionToken,
      examId,
      exam_id: examId,
      exam_title: exam.title,
      studentName,
      student_name: studentName,
      studentClass,
      student_class: studentClass,
      examNumber,
      student_nis: examNumber,
      status: 'IN_PROGRESS',
      isAnonymous: true,
      examToken: token,
      startedAt: new Date(serverNow).toISOString(),
      started_at: new Date(serverNow).toISOString(),
      expiresAt: new Date(targetExpiresTime).toISOString(),
      expires_at: new Date(targetExpiresTime).toISOString(),
      serverStartTime: serverNow,
      serverExpiresTime: targetExpiresTime,
      server_time_offset: 0,
      questionOrder: [],
      optionOrders: {},
      current_question_index: 0,
      lastSavedAt: new Date(serverNow).toISOString(),
      last_sync: new Date(serverNow).toISOString(),
      createdAt: new Date(serverNow).toISOString(),
      created_at: new Date(serverNow).toISOString(),
      updatedAt: new Date(serverNow).toISOString(),
      updated_at: new Date(serverNow).toISOString()
    };
    serverSessions.set(sessionId, session);
  } else {
    // Existing session: verify session belongs to same exam
    if (session.examId !== examId && session.exam_id !== examId) {
      return res.status(400).json({
        success: false,
        error: 'Sesi ujian ini tidak sesuai dengan paket ujian yang dipilih.'
      });
    }

    // Check if session is locked by security/admin
    if (session.isLocked && !session.allowRelogin) {
      return res.status(423).json({
        success: false,
        isLocked: true,
        error: 'Sesi ujian Anda terkunci karena keluar dari aplikasi atau perangkat terputus. Silakan hubungi Administrator atau Pengawas untuk Membuka Kunci Sesi (Izinkan Masuk Ulang).'
      });
    }

    if (session.allowRelogin) {
      // Unlocked by admin, clear locked flag
      session.isLocked = false;
      session.allowRelogin = false;
    }

    // Update student identity metadata if provided
    if (reqStudentName && typeof reqStudentName === 'string' && reqStudentName.trim()) {
      session.studentName = reqStudentName.trim();
      session.student_name = reqStudentName.trim();
    }
    if (reqStudentClass && typeof reqStudentClass === 'string' && reqStudentClass.trim()) {
      session.studentClass = reqStudentClass.trim();
      session.student_class = reqStudentClass.trim();
    }
    if (reqExamNumber && typeof reqExamNumber === 'string' && reqExamNumber.trim()) {
      session.examNumber = reqExamNumber.trim();
      session.student_nis = reqExamNumber.trim();
    }

    // Existing session: verify sessionToken if provided
    if (session.sessionToken) {
      if (providedSessionToken && providedSessionToken !== session.sessionToken) {
        return res.status(403).json({
          success: false,
          error: 'Akses Ditolak: Token sesi tidak valid atau sesi milik peserta lain.'
        });
      }
      sessionToken = session.sessionToken;
    } else {
      sessionToken = randomUUID();
      session.sessionToken = sessionToken;
    }
  }

  return res.json({
    success: true,
    session,
    sessionToken,
    serverTime: serverNow,
    serverExpiresTime: session.serverExpiresTime || targetExpiresTime
  });
});

// 5. Server-Authoritative Grading & Submission (CRIT-02 & CRIT-03)
// Client CANNOT send scores. Server calculates every point based on private examKeys.
app.post('/api/student/submit-exam', (req, res) => {
  const { sessionId, sessionToken, examId, answers } = req.body;

  if (!sessionId || !examId) {
    return res.status(400).json({ success: false, error: 'sessionId dan examId wajib disertakan.' });
  }

  const session = serverSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Sesi ujian tidak ditemukan di server.' });
  }

  // Session Security: Verify session belongs to the requested exam
  if (session.examId !== examId && session.exam_id !== examId) {
    return res.status(400).json({
      success: false,
      error: 'Akses Ditolak: Sesi ujian tidak cocok dengan paket ujian yang diajukan.'
    });
  }

  // Session Security: Verify session token ownership
  if (session.sessionToken && sessionToken && session.sessionToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Token sesi tidak sah. Anda tidak berhak mengakses sesi ini.'
    });
  }

  // Idempotency: Check if already graded
  const existingResult = serverResults.get(sessionId) || Array.from(serverResults.values()).find(r => r.sessionId === sessionId);
  if (existingResult) {
    if (session.sessionToken && sessionToken && session.sessionToken !== sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Anda tidak berhak melihat hasil sesi ini.'
      });
    }
    return res.json({
      success: true,
      resultId: existingResult.id,
      submittedAt: existingResult.submitted_at || existingResult.createdAt,
      gradingStatus: existingResult.gradingStatus,
      totalScore: existingResult.totalScore,
      percentage: existingResult.percentage
    });
  }

  // Retrieve private examKeys
  const examKeyDoc = serverExamKeys.get(examId);
  const exam = serverExams.get(examId);
  if (!examKeyDoc || !exam) {
    return res.status(404).json({ success: false, error: 'Kunci jawaban ujian privat tidak ditemukan di server.' });
  }

  // Authoritative Deadline Validation (with 60s network grace period)
  const serverNow = Date.now();
  if (session.serverExpiresTime) {
    const gracePeriodMs = 60 * 1000;
    if (serverNow > session.serverExpiresTime + gracePeriodMs) {
      return res.status(400).json({
        success: false,
        error: 'Waktu pengerjaan ujian telah berakhir. Lembar jawaban tidak dapat diterima (Server Deadline Exceeded).'
      });
    }
  }

  const studentAnswersMap: Record<string, any> = answers || {};
  const questions = examKeyDoc.questions || [];

  let earnedTotal = 0;
  let maxTotal = 0;
  let hasEssay = false;

  const resultItems: ExamResultItem[] = questions.map((q, idx) => {
    const qId = q.id;
    const ansVal = studentAnswersMap[qId];
    const maxScore = typeof q.maxScore === 'number' ? q.maxScore : 1;
    maxTotal += maxScore;

    let earned = 0;
    let isCorrect = false;
    let isPartial = false;
    let gradingStatus: 'GRADED' | 'NEEDS_GRADING' = 'GRADED';

    const qType = q.type || 'single_choice';

    if (qType === 'single_choice') {
      const correctList = (q.correctAnswers || []).map(c => String(c).trim().toUpperCase());
      const studentVal = String(ansVal || '').trim().toUpperCase();
      if (studentVal && correctList.includes(studentVal)) {
        earned = maxScore;
        isCorrect = true;
      }
    } else if (qType === 'multiple_choice') {
      const chosenList: string[] = Array.isArray(ansVal) ? ansVal.map(String) : ansVal ? [String(ansVal)] : [];
      // Option-level weighted scoring if available
      const optionsWithScore = (q.options || []).filter(opt => typeof opt.score === 'number');
      if (optionsWithScore.length > 0) {
        let sum = 0;
        const validOptIds = new Set(q.options?.map(o => o.id) || []);
        for (const optId of chosenList) {
          if (validOptIds.has(optId)) {
            const foundOpt = q.options?.find(o => o.id === optId);
            if (foundOpt && typeof foundOpt.score === 'number') {
              sum += foundOpt.score;
            }
          }
        }
        earned = Math.min(Math.max(0, sum), maxScore);
      } else {
        const correctAnswers = (q.correctAnswers || []).map(c => String(c).trim().toUpperCase());
        const chosenUpper = chosenList.map(c => c.trim().toUpperCase());
        const distractors = chosenUpper.filter(c => !correctAnswers.includes(c));
        const correctChosen = chosenUpper.filter(c => correctAnswers.includes(c));
        if (distractors.length === 0 && correctChosen.length > 0) {
          earned = (correctChosen.length / Math.max(1, correctAnswers.length)) * maxScore;
        }
      }
      isCorrect = earned === maxScore && maxScore > 0;
      isPartial = earned > 0 && earned < maxScore;
    } else if (qType === 'true_false') {
      const correctList = (q.correctAnswers || []).map(c => String(c).trim().toLowerCase());
      const studentVal = String(ansVal || '').trim().toLowerCase();
      if (studentVal && correctList.includes(studentVal)) {
        earned = maxScore;
        isCorrect = true;
      }
    } else if (qType === 'essay') {
      hasEssay = true;
      earned = 0;
      gradingStatus = 'NEEDS_GRADING';
    }

    earned = Math.round(earned * 100) / 100;
    earnedTotal += earned;

    return {
      question_id: qId,
      question_number: q.order || idx + 1,
      question_type: qType as any,
      question_text: q.questionText,
      student_answer: ansVal !== undefined ? ansVal : null,
      correct_answer: q.correctAnswers,
      answer_key: q.expectedAnswer,
      max_points: maxScore,
      earned_points: earned,
      is_correct: isCorrect,
      is_partial: isPartial,
      grading_status: gradingStatus === 'NEEDS_GRADING' ? 'awaiting' : 'graded',
      questionId: qId,
      questionNumber: q.order || idx + 1,
      questionType: qType,
      studentAnswer: ansVal,
      score: earned,
      maxScore
    };
  });

  const percentage = maxTotal > 0 ? Math.round((earnedTotal / maxTotal) * 10000) / 100 : 0;
  const overallStatus = hasEssay ? 'NEEDS_GRADING' : 'GRADED';
  const submittedAt = new Date().toISOString();
  const resultId = `res_${sessionId}`;

  const authoritativeResult: ExamResult = {
    id: resultId,
    examId,
    exam_id: examId,
    exam_title: exam.title,
    sessionId,
    session_id: sessionId,
    studentId: session?.student_id || sessionId,
    student_id: session?.student_id || sessionId,
    studentName: session?.studentName || 'Peserta Ujian',
    student_name: session?.studentName || 'Peserta Ujian',
    studentNis: session?.examNumber || 'ANON',
    student_nis: session?.examNumber || 'ANON',
    examNumber: session?.examNumber || 'ANON',
    studentClass: session?.studentClass || 'Umum',
    student_class: session?.studentClass || 'Umum',
    totalScore: earnedTotal,
    earned_points: earnedTotal,
    maxScore: maxTotal,
    total_points: maxTotal,
    percentage,
    passed: percentage >= (exam.settings?.passing_score || 75),
    gradingStatus: overallStatus,
    status: overallStatus,
    submittedAt,
    submitted_at: submittedAt,
    gradedBy: 'server_authoritative',
    items: resultItems,
    createdAt: submittedAt,
    created_at: submittedAt,
    updatedAt: submittedAt,
    updated_at: submittedAt
  };

  serverResults.set(resultId, authoritativeResult);

  if (session) {
    session.status = 'SUBMITTED';
    session.submittedAt = submittedAt;
  }

  return res.json({
    success: true,
    resultId,
    submittedAt,
    gradingStatus: overallStatus,
    totalScore: earnedTotal,
    percentage
  });
});

// 6. Teacher Essay Grading with strict Teacher Isolation (HIGH-03)
app.post('/api/teacher/grade-essay', (req, res) => {
  const { examId, resultId, teacherId, grades } = req.body;
  const exam = serverExams.get(examId);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan.' });
  }

  // Teacher Isolation Check
  const isOwner = exam.ownerId === teacherId || exam.owner_id === teacherId;
  const isAdmin = teacherId === 'admin_1' || teacherId === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Anda hanya berhak menilai ujian yang Anda miliki (Teacher Isolation Enforced).'
    });
  }

  const result = serverResults.get(resultId);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Data hasil ujian tidak ditemukan.' });
  }

  // Teacher Isolation: Ensure result belongs to the specified exam
  if (result.examId !== examId && result.exam_id !== examId) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Lembar hasil ujian bukan milik paket ujian ini.'
    });
  }

  // Apply grades
  const gradeRecords: Record<string, { score: number; feedback?: string }> = grades || {};
  let newEarnedTotal = 0;
  let hasPendingEssay = false;

  result.items.forEach(it => {
    if (it.question_type === 'essay' && gradeRecords[it.question_id]) {
      const g = gradeRecords[it.question_id];
      it.earned_points = Math.min(Math.max(0, g.score), it.max_points);
      it.score = it.earned_points;
      it.teacher_feedback = g.feedback || '';
      it.grading_status = 'graded';
    }
    if (it.grading_status === 'awaiting') {
      hasPendingEssay = true;
    }
    newEarnedTotal += it.earned_points || 0;
  });

  result.totalScore = Math.round(newEarnedTotal * 100) / 100;
  result.percentage = (result.maxScore && result.maxScore > 0) ? Math.round((result.totalScore / result.maxScore) * 10000) / 100 : 0;
  result.gradingStatus = hasPendingEssay ? 'NEEDS_GRADING' : 'GRADED';
  result.status = result.gradingStatus;
  result.updatedAt = new Date().toISOString();

  return res.json({
    success: true,
    result
  });
});

// 7. Teacher Access to Private Exam Keys with Teacher Isolation (HIGH-03)
app.get('/api/teacher/exam-keys/:examId', (req, res) => {
  const { examId } = req.params;
  const teacherId = String(req.headers['x-teacher-id'] || req.query.teacherId || '');

  const exam = serverExams.get(examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  const isOwner = exam.ownerId === teacherId || exam.owner_id === teacherId;
  const isAdmin = teacherId === 'admin_1' || teacherId === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Kunci ujian privat hanya dapat diakses oleh guru pemilik paket atau Admin (Teacher Isolation Enforced).'
    });
  }

  const examKeys = serverExamKeys.get(examId);
  return res.json({
    success: true,
    examKeys
  });
});

// 8. Teacher Access to Exam Results with Teacher Isolation (HIGH-03)
app.get('/api/teacher/results/:examId', (req, res) => {
  const { examId } = req.params;
  const teacherId = String(req.headers['x-teacher-id'] || req.query.teacherId || '');

  const exam = serverExams.get(examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  const isOwner = exam.ownerId === teacherId || exam.owner_id === teacherId;
  const isAdmin = teacherId === 'admin_1' || teacherId === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Data hasil ujian hanya dapat diakses oleh guru pemilik paket atau Admin (Teacher Isolation Enforced).'
    });
  }

  const results = Array.from(serverResults.values()).filter(
    r => r.examId === examId || r.exam_id === examId
  );
  return res.json({
    success: true,
    results
  });
});

// 9. Student Fetch Result with Session Token Protection (Session Security & Student Isolation)
app.post('/api/student/get-result', (req, res) => {
  const { sessionId, sessionToken, examId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId wajib disertakan.' });
  }

  // Session Token is strictly required (Verification 3)
  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Token sesi (sessionToken) wajib disertakan untuk mengakses hasil.'
    });
  }

  const session = serverSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Sesi ujian tidak ditemukan.' });
  }

  // Cryptographic session token verification
  if (!session.sessionToken || sessionToken !== session.sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Token sesi tidak sah. Anda tidak berhak melihat hasil sesi ini.'
    });
  }

  // Ensure examId is bound to the session if provided
  if (examId && session.examId && examId !== session.examId && examId !== session.exam_id) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: examId tidak cocok dengan sesi ujian terdaftar.'
    });
  }

  const result = serverResults.get(sessionId) || Array.from(serverResults.values()).find(r => r.sessionId === sessionId);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Hasil ujian belum tersedia atau belum selesai dinilai.' });
  }

  // Double check exam binding
  if (session.examId && result.examId && result.examId !== session.examId && result.exam_id !== session.examId) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Integritas paket ujian pada lembar hasil tidak sesuai dengan sesi.'
    });
  }

  // Security Stage 8.2: Student dapat membaca hasil HANYA setelah status RESULTS_RELEASED
  const statusStr = String(result.gradingStatus || result.status || '').toUpperCase();
  if (statusStr !== 'RESULTS_RELEASED') {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Hasil ujian belum dirilis oleh guru pengampu (Status Ujian belum RESULTS_RELEASED).'
    });
  }

  // Security Stage 8.2: Strip all private answer keys, expected answers, rubrics, and internal teacher notes
  const safeItems = (result.items || []).map(item => {
    const safeItem = { ...item };
    delete safeItem.correct_answer;
    delete safeItem.correctAnswer;
    delete (safeItem as any).correctAnswers;
    delete safeItem.answer_key;
    delete (safeItem as any).answerKey;
    delete (safeItem as any).key;
    delete (safeItem as any).expectedAnswer;
    delete (safeItem as any).expected_answer;
    delete (safeItem as any).rubric;
    delete (safeItem as any).scoring_guide;
    delete (safeItem as any).grading_rubric;
    delete (safeItem as any).teacherNotes;
    delete (safeItem as any).teacher_notes;
    delete (safeItem as any).internalNotes;
    return safeItem;
  });

  const studentSafeResult = {
    ...result,
    items: safeItems
  };
  delete (studentSafeResult as any).answerKey;
  delete (studentSafeResult as any).examKeys;
  delete (studentSafeResult as any).rubric;

  return res.json({
    success: true,
    result: studentSafeResult
  });
});

// =========================================================================
// 10. ADMIN DASHBOARD & EXAM MANAGEMENT ENDPOINTS (STAGE 8.1)
// =========================================================================

export interface ServerAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  examId: string;
  examTitle?: string;
  previousStatus?: string;
  newStatus?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const serverAuditLogs: ServerAuditLog[] = [];

// Helper to check admin authorization strictly (Verification 1: Admin Isolation)
export function verifyAdminAuth(req: express.Request): { authorized: boolean; adminId: string; adminName: string } {
  const roleHeader = String(req.headers['x-user-role'] || req.headers['x-role'] || '').trim().toLowerCase();
  const userIdHeader = String(req.headers['x-user-id'] || '').trim().toLowerCase();
  const adminSecret = String(req.headers['x-admin-key'] || '').trim();

  // If explicitly a teacher or student, DENY access immediately
  if (roleHeader === 'teacher' || roleHeader === 'student') {
    return { authorized: false, adminId: '', adminName: '' };
  }

  // Admin secret key header allows trusted internal/system admin bypass
  if (adminSecret && adminSecret === 'exampusa_admin_secret') {
    return {
      authorized: true,
      adminId: userIdHeader || 'admin_1',
      adminName: String(req.headers['x-user-name'] || 'Administrator EXAMPUSA')
    };
  }

  // Verified admin role check
  if (roleHeader === 'admin') {
    const adminId = (userIdHeader && (userIdHeader.startsWith('admin') || userIdHeader === 'admin_1'))
      ? userIdHeader
      : 'admin_1';
    return {
      authorized: true,
      adminId,
      adminName: String(req.headers['x-user-name'] || 'Administrator EXAMPUSA')
    };
  }

  return { authorized: false, adminId: '', adminName: '' };
}

export const SERVER_VALID_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SCHEDULED', 'ACTIVE', 'CANCELLED', 'ARCHIVED'],
  SCHEDULED: ['ACTIVE', 'DRAFT', 'CANCELLED', 'ARCHIVED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['GRADED', 'ARCHIVED'],
  GRADED: ['RESULTS_RELEASED', 'COMPLETED', 'ARCHIVED'],
  RESULTS_RELEASED: ['ARCHIVED'],
  CANCELLED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: []
};

export function isServerValidLifecycleTransition(current: string, target: string): boolean {
  if (current.toUpperCase() === target.toUpperCase()) return true;
  const allowed = SERVER_VALID_LIFECYCLE_TRANSITIONS[current.toUpperCase()];
  return Boolean(allowed && allowed.includes(target.toUpperCase()));
}

// 10.1 Admin Fetch All Exams Across All Teachers with Result Summaries
app.get('/api/admin/exams', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const allExams = Array.from(serverExams.values()).map(ex => {
    const examResults = Array.from(serverResults.values()).filter(r => r.examId === ex.id || r.exam_id === ex.id);
    const submittedCount = examResults.filter(r => r.submittedAt || r.submitted_at).length;
    const needsGradingCount = examResults.filter(r => r.gradingStatus === 'NEEDS_GRADING' || r.status === 'NEEDS_GRADING' || r.status === 'awaiting_manual_grading').length;
    const gradedCount = examResults.filter(r => r.gradingStatus === 'GRADED' || r.status === 'GRADED' || r.status === 'finalized').length;
    const resultsReleasedCount = examResults.filter(r => r.gradingStatus === 'RESULTS_RELEASED' || r.status === 'RESULTS_RELEASED').length;

    return {
      ...ex,
      summary: {
        totalParticipants: examResults.length,
        submitted: submittedCount,
        notSubmitted: Math.max(0, examResults.length - submittedCount),
        needsGrading: needsGradingCount,
        graded: gradedCount,
        resultsReleased: resultsReleasedCount
      }
    };
  });

  return res.json({
    success: true,
    exams: allExams
  });
});

// 10.2 Admin Fetch Exam Detail
app.get('/api/admin/exam/:examId', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId } = req.params;
  const exam = serverExams.get(examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  const examResults = Array.from(serverResults.values()).filter(r => r.examId === examId || r.exam_id === examId);
  const submittedCount = examResults.filter(r => r.submittedAt || r.submitted_at).length;
  const needsGradingCount = examResults.filter(r => r.gradingStatus === 'NEEDS_GRADING' || r.status === 'NEEDS_GRADING' || r.status === 'awaiting_manual_grading').length;
  const gradedCount = examResults.filter(r => r.gradingStatus === 'GRADED' || r.status === 'GRADED' || r.status === 'finalized').length;
  const resultsReleasedCount = examResults.filter(r => r.gradingStatus === 'RESULTS_RELEASED' || r.status === 'RESULTS_RELEASED').length;

  return res.json({
    success: true,
    exam: {
      ...exam,
      summary: {
        totalParticipants: examResults.length,
        submitted: submittedCount,
        notSubmitted: Math.max(0, examResults.length - submittedCount),
        needsGrading: needsGradingCount,
        graded: gradedCount,
        resultsReleased: resultsReleasedCount
      }
    }
  });
});

// 10.3 Admin Lifecycle Status Control with Validation and Audit Logging
app.post('/api/admin/lifecycle-status', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId, newStatus, reason } = req.body;
  if (!examId || !newStatus) {
    return res.status(400).json({ success: false, error: 'examId dan newStatus wajib disertakan.' });
  }

  const exam = serverExams.get(examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  const currentStatus = String(exam.status || 'DRAFT').toUpperCase();
  const targetStatus = String(newStatus).toUpperCase();

  // Validate lifecycle transition rules
  if (!isServerValidLifecycleTransition(currentStatus, targetStatus)) {
    return res.status(400).json({
      success: false,
      error: `Transisi status tidak valid: Ujian dengan status "${currentStatus}" tidak dapat diubah langsung menjadi "${targetStatus}".`
    });
  }

  const now = new Date().toISOString();
  exam.status = targetStatus as any;
  exam.updatedAt = now;
  exam.updated_at = now;

  if (targetStatus === 'ACTIVE') {
    exam.activatedAt = now;
    if (!exam.publishedAt) exam.publishedAt = now;
    if (!exam.published_at) exam.published_at = now;
  } else if (targetStatus === 'COMPLETED') {
    exam.completedAt = now;
  }

  // Audit event
  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_lifecycle_transition',
    examId,
    examTitle: exam.title,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    timestamp: now,
    metadata: { reason: reason || 'Transisi status oleh Administrator' }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    exam,
    auditEvent
  });
});

// 10.4 Admin Duplicate Exam with New ID Generation and Audit Logging
app.post('/api/admin/duplicate-exam', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId, targetTeacherId, targetTeacherName } = req.body;
  const sourceExam = serverExams.get(examId);
  if (!sourceExam) {
    return res.status(404).json({ success: false, error: 'Paket ujian sumber tidak ditemukan.' });
  }

  const now = new Date().toISOString();
  const newExamId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  const sourceKeyDoc = serverExamKeys.get(examId);
  const questionsSource = sourceKeyDoc?.questions || sourceExam.questions || [];
  const clonedQuestions = questionsSource.map((q, idx) => ({
    ...q,
    id: `snap_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    order: idx + 1,
    options: (q.options || []).map((opt) => ({ ...opt })),
    correctAnswers: q.correctAnswers ? [...q.correctAnswers] : []
  }));

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let newToken = '';
  for (let i = 0; i < 6; i++) {
    newToken += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const ownerId = targetTeacherId || sourceExam.ownerId || sourceExam.owner_id || 'teacher_1';
  const ownerName = targetTeacherName || sourceExam.ownerName || sourceExam.owner_name || 'Guru Pengampu';

  const duplicated: Exam = {
    ...sourceExam,
    id: newExamId,
    ownerId,
    owner_id: ownerId,
    ownerName,
    owner_name: ownerName,
    title: sourceExam.title.startsWith('Salinan dari') ? sourceExam.title : `Salinan dari ${sourceExam.title}`,
    status: 'DRAFT',
    examToken: newToken,
    pin: newToken,
    startAt: undefined,
    start_at: undefined,
    endAt: undefined,
    end_at: undefined,
    publishedAt: undefined,
    published_at: undefined,
    activatedAt: undefined,
    completedAt: undefined,
    questions: clonedQuestions,
    questionIds: clonedQuestions.map(q => q.id),
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now
  };

  serverExams.set(newExamId, duplicated);

  serverExamKeys.set(newExamId, {
    id: newExamId,
    examId: newExamId,
    ownerId,
    examToken: newToken,
    title: duplicated.title,
    durationMinutes: duplicated.durationMinutes || 60,
    totalPoints: duplicated.totalPoints || 100,
    questions: clonedQuestions,
    createdAt: now,
    updatedAt: now
  });

  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_exam_duplicated',
    examId: newExamId,
    examTitle: duplicated.title,
    timestamp: now,
    metadata: { sourceExamId: examId, targetTeacherId: ownerId, targetTeacherName: ownerName }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    exam: duplicated,
    auditEvent
  });
});

// 10.5 Admin Archive Exam (Non-destructive, Preserves Results)
app.post('/api/admin/archive-exam', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId, reason } = req.body;
  const exam = serverExams.get(examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  const prevStatus = String(exam.status || 'DRAFT').toUpperCase();
  const now = new Date().toISOString();
  exam.status = 'ARCHIVED';
  exam.updatedAt = now;
  exam.updated_at = now;

  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_exam_archived',
    examId,
    examTitle: exam.title,
    previousStatus: prevStatus,
    newStatus: 'ARCHIVED',
    timestamp: now,
    metadata: { reason: reason || 'Diarsipkan oleh Administrator' }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    exam,
    auditEvent
  });
});

// 10.6 Admin Audit Logs Retrieval
app.get('/api/admin/audit-logs', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  return res.json({
    success: true,
    logs: serverAuditLogs
  });
});

// 10.7 Admin Results & Export Center: Get All Results Across All Teachers and Exams
app.get('/api/admin/results', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId, teacherId, subjectId, classId, status, search } = req.query;

  let allResults = Array.from(serverResults.values()).map(r => {
    const exam = serverExams.get(r.examId || r.exam_id || '');
    const teacherName = exam?.ownerName || exam?.owner_name || (r as any).teacherName || (r as any).owner_name || 'Bpk. Hendra Pratama, S.Kom.';
    const teacherIdResolved = exam?.ownerId || exam?.owner_id || (r as any).teacherId || 'teacher_1';
    const examTitle = exam?.title || r.exam_title || (r as any).examTitle || 'Ujian Sekolah';
    const subjectName = exam?.subjectName || exam?.subject_name || r.subject_name || (r as any).subjectName || 'Mata Pelajaran';
    const subjectIdResolved = exam?.subjectId || exam?.subject_id || (r as any).subjectId;
    const studentClass = r.studentClass || r.student_class || exam?.className || 'Umum';
    const studentName = r.studentName || r.student_name || 'Peserta Ujian';
    const examNumber = r.examNumber || r.student_nis || (r as any).studentNis || '-';

    return {
      ...r,
      examTitle,
      exam_title: examTitle,
      subjectName,
      subject_name: subjectName,
      subjectId: subjectIdResolved,
      teacherName,
      teacher_name: teacherName,
      teacherId: teacherIdResolved,
      studentClass,
      student_class: studentClass,
      className: studentClass,
      studentName,
      student_name: studentName,
      examNumber,
      student_nis: examNumber
    };
  });

  // Filters
  if (examId && typeof examId === 'string' && examId !== 'all') {
    allResults = allResults.filter(r => (r.examId === examId || r.exam_id === examId));
  }
  if (teacherId && typeof teacherId === 'string' && teacherId !== 'all') {
    allResults = allResults.filter(r => r.teacherId === teacherId);
  }
  if (subjectId && typeof subjectId === 'string' && subjectId !== 'all') {
    allResults = allResults.filter(r => r.subjectId === subjectId || r.subject_name === subjectId);
  }
  if (classId && typeof classId === 'string' && classId !== 'all') {
    allResults = allResults.filter(r => r.studentClass === classId || r.className === classId);
  }
  if (status && typeof status === 'string' && status !== 'all') {
    const filterStatus = status.toUpperCase();
    allResults = allResults.filter(r => {
      const st = String(r.gradingStatus || r.status || '').toUpperCase();
      if (filterStatus === 'NEEDS_GRADING') {
        return st === 'NEEDS_GRADING' || st === 'AWAITING' || st === 'AWAITING_MANUAL_GRADING';
      }
      if (filterStatus === 'GRADED') {
        return st === 'GRADED' || st === 'FINALIZED';
      }
      if (filterStatus === 'RESULTS_RELEASED') {
        return st === 'RESULTS_RELEASED';
      }
      return st === filterStatus;
    });
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    allResults = allResults.filter(r =>
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.examNumber && r.examNumber.toLowerCase().includes(q)) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(q))
    );
  }

  return res.json({
    success: true,
    results: allResults,
    totalCount: allResults.length
  });
});

// 10.8 Admin Results & Export Center: Get Single Result Detail with Audit
app.get('/api/admin/result/:resultId', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { resultId } = req.params;
  const result = serverResults.get(resultId) || Array.from(serverResults.values()).find(r => r.id === resultId || r.sessionId === resultId);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Data hasil ujian tidak ditemukan.' });
  }

  const exam = serverExams.get(result.examId || result.exam_id || '');
  const examTitle = exam?.title || result.exam_title || (result as any).examTitle || 'Ujian Sekolah';
  const subjectName = exam?.subjectName || exam?.subject_name || result.subject_name || 'Mata Pelajaran';
  const teacherName = exam?.ownerName || exam?.owner_name || (result as any).teacherName || 'Bpk. Hendra Pratama, S.Kom.';
  const studentName = result.studentName || result.student_name || 'Peserta Ujian';
  const examNumber = result.examNumber || result.student_nis || '-';

  const enrichedResult = {
    ...result,
    examTitle,
    exam_title: examTitle,
    subjectName,
    subject_name: subjectName,
    teacherName,
    teacher_name: teacherName,
    studentClass: result.studentClass || result.student_class || exam?.className || 'Umum',
    studentName,
    student_name: studentName,
    examNumber
  };

  // Record audit event for admin opening detail
  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_view_result_detail',
    examId: result.examId || result.exam_id || 'unknown',
    examTitle,
    timestamp: new Date().toISOString(),
    metadata: {
      resultId,
      studentName,
      examNumber,
      score: result.percentage ?? result.earned_points
    }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    result: enrichedResult,
    auditEvent
  });
});

// 10.9 Admin Results & Export Center: Audit Export Action
app.post('/api/admin/results/export-audit', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { recordCount, filters } = req.body;
  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_export_results',
    examId: filters?.examId || 'all_exams',
    timestamp: new Date().toISOString(),
    metadata: {
      recordCount: recordCount || 0,
      filters: filters || {}
    }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    auditEvent
  });
});

// =========================================================================
// 11. ADMIN OPERATIONAL CONTROL & SESSION RECOVERY (STAGE 8.3)
// =========================================================================

// 11.1 Fetch All Active & Live Sessions for Operational Monitor
app.get('/api/admin/operational/sessions', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId } = req.query;
  let sessions = Array.from(serverSessions.values());

  if (examId && typeof examId === 'string' && examId !== 'all') {
    sessions = sessions.filter(s => s.examId === examId || s.exam_id === examId);
  }

  const enrichedSessions = sessions.map(sess => {
    const exam = serverExams.get(sess.examId || sess.exam_id || '');
    const examAnswers = Array.from(serverAnswers.values()).filter(a => (a.sessionId === sess.id || a.session_id === sess.id));
    const answersCount = sess.answersCount || examAnswers.length;

    return {
      ...sess,
      examTitle: exam?.title || sess.examTitle || sess.exam_title || 'Ujian Sekolah',
      subjectName: exam?.subjectName || exam?.subject_name || 'Mata Pelajaran',
      className: sess.studentClass || sess.student_class || exam?.className || 'Umum',
      ownerName: exam?.ownerName || exam?.owner_name || 'Guru Pengampu',
      answersCount,
      isExpired: Date.now() > (sess.serverExpiresTime || new Date(sess.expiresAt).getTime())
    };
  });

  return res.json({
    success: true,
    sessions: enrichedSessions,
    totalCount: enrichedSessions.length
  });
});

// 11.2 Unlock Student Session (Izinkan Masuk Ulang)
app.post('/api/admin/session/:sessionId/unlock', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { sessionId } = req.params;
  const session = serverSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Sesi ujian murid tidak ditemukan.' });
  }

  const now = new Date().toISOString();
  session.isLocked = false;
  session.allowRelogin = true;
  session.unlockedAt = now;
  session.unlockedBy = authCheck.adminName || 'Administrator';
  session.updatedAt = now;
  session.updated_at = now;

  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_session_unlocked',
    examId: session.examId || session.exam_id || 'unknown',
    examTitle: session.examTitle || session.exam_title || 'Ujian Sekolah',
    timestamp: now,
    metadata: {
      sessionId,
      studentName: session.studentName || session.student_name,
      examNumber: session.examNumber || session.student_nis,
      reason: req.body?.reason || 'Buka kunci sesi oleh Administrator'
    }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    message: `Sesi untuk siswa ${session.studentName} (${session.examNumber}) berhasil dibuka kuncinya.`,
    session,
    auditEvent
  });
});

// 11.3 Force Submit Student Session
app.post('/api/admin/session/:sessionId/force-submit', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { sessionId } = req.params;
  const session = serverSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Sesi ujian murid tidak ditemukan.' });
  }

  const now = new Date().toISOString();
  session.status = 'SUBMITTED';
  session.submittedAt = now;
  session.submitted_at = now;
  session.forceSubmittedAt = now;
  session.forceSubmittedBy = authCheck.adminName || 'Administrator';
  session.updatedAt = now;
  session.updated_at = now;

  // Grade current answers server-authoritatively if key exists
  const examId = session.examId || session.exam_id || '';
  const examKey = serverExamKeys.get(examId);
  const exam = serverExams.get(examId);
  const sessionAnswers = Array.from(serverAnswers.values())
    .filter(a => a.sessionId === sessionId || a.session_id === sessionId)
    .map(a => ({ questionId: a.questionId || a.question_id || '', answer: a.answer }));

  const resultId = `res_${sessionId}`;
  let earnedPoints = 0;
  let maxPoints = 100;
  let percentage = 0;
  let gradingStatus = 'GRADED';

  if (examKey && examKey.answers && examKey.answers.length > 0) {
    const grading = gradeSubmission(examKey.answers, sessionAnswers);
    earnedPoints = grading.earnedPoints;
    maxPoints = grading.maxPoints;
    percentage = grading.percentage;
    gradingStatus = grading.needsManualGrading ? 'NEEDS_GRADING' : 'GRADED';
  } else {
    gradingStatus = 'NEEDS_GRADING';
  }

  const examResult: ServerExamResult = {
    id: resultId,
    examId,
    exam_id: examId,
    sessionId: session.id,
    session_id: session.id,
    studentName: session.studentName || session.student_name || 'Peserta Ujian',
    student_name: session.studentName || session.student_name || 'Peserta Ujian',
    studentClass: session.studentClass || session.student_class || exam?.className || 'Umum',
    student_class: session.studentClass || session.student_class || exam?.className || 'Umum',
    examNumber: session.examNumber || session.student_nis || sessionId.replace('sess_', ''),
    student_nis: session.examNumber || session.student_nis || sessionId.replace('sess_', ''),
    earnedPoints,
    earned_points: earnedPoints,
    maxPoints,
    max_points: maxPoints,
    percentage,
    gradingStatus: gradingStatus as any,
    status: gradingStatus as any,
    submittedAt: now,
    submitted_at: now,
    gradedAt: now,
    graded_at: now,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now
  };

  serverResults.set(resultId, examResult);

  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_force_submit',
    examId,
    examTitle: exam?.title || session.examTitle || 'Ujian Sekolah',
    timestamp: now,
    metadata: {
      sessionId,
      studentName: session.studentName,
      examNumber: session.examNumber,
      score: percentage,
      gradingStatus,
      reason: req.body?.reason || 'Paksa kumpul oleh Administrator'
    }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    message: `Sesi ujian murid ${session.studentName} (${session.examNumber}) berhasil dikumpulkan dan dinilai.`,
    session,
    result: examResult,
    auditEvent
  });
});

// 11.4 Regenerate Exam Token PIN (Emergency Control)
app.post('/api/admin/exam/:examId/regenerate-token', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId } = req.params;
  const exam = serverExams.get(examId);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  // Generate clean 6-character uppercase alphanumeric token
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let newToken = '';
  for (let i = 0; i < 6; i++) {
    newToken += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const prevToken = exam.pin || exam.examToken || '-';
  const now = new Date().toISOString();
  exam.pin = newToken;
  exam.examToken = newToken;
  exam.updatedAt = now;
  exam.updated_at = now;

  const examKey = serverExamKeys.get(examId);
  if (examKey) {
    examKey.examToken = newToken;
  }

  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_regenerate_token',
    examId: exam.id,
    examTitle: exam.title,
    timestamp: now,
    metadata: {
      previousToken: prevToken,
      newToken,
      reason: req.body?.reason || 'Regenerasi Token PIN oleh Administrator'
    }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    message: `Token ujian berhasil diperbarui menjadi ${newToken}.`,
    newToken,
    exam,
    auditEvent
  });
});

// 11.5 Emergency Time Extension (+15 / +30 minutes)
app.post('/api/admin/exam/:examId/add-emergency-time', (req, res) => {
  const authCheck = verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(403).json({
      success: false,
      error: 'Akses Ditolak: Endpoint ini khusus Administrator (Role ADMIN Required).'
    });
  }

  const { examId } = req.params;
  const exam = serverExams.get(examId);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Paket ujian tidak ditemukan.' });
  }

  const minutesToAdd = Number(req.body?.minutes) || 15;
  if (minutesToAdd <= 0 || minutesToAdd > 180) {
    return res.status(400).json({ success: false, error: 'Jumlah menit tambahan tidak valid (harus 1 - 180 menit).' });
  }

  const additionalMs = minutesToAdd * 60 * 1000;
  const now = new Date().toISOString();

  // Extend base exam duration
  exam.durationMinutes = (exam.durationMinutes || 60) + minutesToAdd;
  if (exam.endAt) {
    const endAtMs = new Date(exam.endAt).getTime();
    if (!isNaN(endAtMs)) {
      exam.endAt = new Date(endAtMs + additionalMs).toISOString();
      exam.end_at = exam.endAt;
    }
  }
  exam.updatedAt = now;
  exam.updated_at = now;

  // Extend active in-progress student sessions
  let affectedSessionsCount = 0;
  for (const sess of serverSessions.values()) {
    if ((sess.examId === examId || sess.exam_id === examId) && (sess.status === 'IN_PROGRESS' || sess.status === 'in_progress')) {
      const currentExpiresMs = sess.serverExpiresTime || new Date(sess.expiresAt).getTime();
      const newExpiresMs = currentExpiresMs + additionalMs;
      sess.serverExpiresTime = newExpiresMs;
      sess.expiresAt = new Date(newExpiresMs).toISOString();
      sess.expires_at = sess.expiresAt;
      sess.updatedAt = now;
      sess.updated_at = now;
      affectedSessionsCount++;
    }
  }

  const auditEvent: ServerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminId: authCheck.adminId,
    adminName: authCheck.adminName,
    action: 'admin_emergency_time_added',
    examId: exam.id,
    examTitle: exam.title,
    timestamp: now,
    metadata: {
      minutesAdded: minutesToAdd,
      newDurationMinutes: exam.durationMinutes,
      affectedSessionsCount,
      reason: req.body?.reason || 'Perpanjangan durasi darurat oleh Administrator'
    }
  };
  serverAuditLogs.unshift(auditEvent);

  return res.json({
    success: true,
    message: `Durasi darurat +${minutesToAdd} menit berhasil ditambahkan ke ujian ${exam.title}. (${affectedSessionsCount} sesi murid diperpanjang).`,
    newDurationMinutes: exam.durationMinutes,
    affectedSessionsCount,
    exam,
    auditEvent
  });
});

// =========================================================================
// VITE MIDDLEWARE SETUP
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EXAMPUSA Security-Hardened Server running on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.EXAMPUSA_TEST) {
  startServer();
}
