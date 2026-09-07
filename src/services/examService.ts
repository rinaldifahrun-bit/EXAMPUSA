import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db as firestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { db as dexieDb } from '../lib/dexie';
import type {
  Exam,
  ExamStatus,
  ExamLifecycleStatus,
  ExamQuestionSnapshot,
  ExamOptionSnapshot,
  ExamSnapshotQuestion,
  ExamKeyDocument,
  StudentSafeExam,
  StudentExamQuestion,
  StudentExamOption,
  Question,
  SecurityEvent
} from '../types';
import { mockExams } from '../data/mockData';
import { getStoredQuestions } from './questionService';

const EXAMS_STORAGE_KEY = 'sp1_puspo_exams_store';

/**
 * Creates student-safe projection DTO from an exam.
 * CRIT-01: ZERO answer keys, ZERO option scores, ZERO expected answers, ZERO rubrics.
 */
export function createStudentSafeExam(rawExam: Exam): StudentSafeExam {
  const rawQuestions: any[] =
    rawExam.questions && rawExam.questions.length > 0
      ? rawExam.questions
      : rawExam.questions_snapshot && rawExam.questions_snapshot.length > 0
      ? rawExam.questions_snapshot
      : [];

  const studentSafeQuestions: StudentExamQuestion[] = rawQuestions.map((q, idx) => {
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
 * Generate clean, human-readable 6-character uppercase alphanumeric exam token.
 * Omits ambiguous characters like 0, O, 1, I to avoid student typing confusion.
 */
export function generateExamToken(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Backward compatible PIN generator
 */
export function generateExamPin(): string {
  return generateExamToken();
}

/**
 * Deep-convert a master Question from Question Bank into an isolated ExamQuestionSnapshot.
 * This guarantees that subsequent edits to the Question Bank will never alter the Exam,
 * and edits made in the Exam builder will never alter the Question Bank.
 */
export function convertQuestionToSnapshot(q: Question, orderNumber: number): ExamQuestionSnapshot {
  // Map question_type to Exam snapshot type
  let type: 'single_choice' | 'multiple_choice' | 'true_false' | 'essay' = 'single_choice';
  if (q.question_type === 'multiple_select') {
    type = 'multiple_choice'; // Represents PG Kompleks with option scoring
  } else if (q.question_type === 'true_false') {
    type = 'true_false';
  } else if (q.question_type === 'essay') {
    type = 'essay';
  } else {
    type = 'single_choice';
  }

  const options: ExamOptionSnapshot[] = (q.options || []).map((opt) => ({
    id: opt.id,
    text: opt.text,
    imageUrl: opt.imageRef,
    score: opt.score ?? 0
  }));

  return {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sourceQuestionId: q.id,
    order: orderNumber,
    type,
    questionText: q.question_text || '',
    imageUrl: q.imageRef,
    options,
    correctAnswers: Array.isArray(q.correct_answer) ? [...q.correct_answer] : [],
    expectedAnswer: q.expectedAnswer || q.answer_key || '',
    rubric: typeof q.rubric === 'string' ? q.rubric : (q.rubric ? JSON.stringify(q.rubric) : ''),
    maxScore: Number(q.points) || 1,
    required: q.required !== false
  };
}

/**
 * Validates an exam before it can be Scheduled or Activated.
 * Checks completeness according to curriculum & EXAMPUSA standards.
 */
export function validateExamForActivation(exam: Exam): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!exam.title || !exam.title.trim()) {
    errors.push('Judul paket ujian wajib diisi.');
  }

  const subject = exam.subjectId || exam.subject_id;
  if (!subject) {
    errors.push('Mata pelajaran belum dipilih.');
  }

  const classId = exam.classId || exam.class_id || (exam.classIds && exam.classIds[0]) || (exam.class_ids && exam.class_ids[0]);
  if (!classId) {
    errors.push('Kelas sasaran belum dipilih.');
  }

  const duration = exam.durationMinutes || exam.duration_minutes || 0;
  if (duration <= 0) {
    errors.push('Durasi ujian harus lebih besar dari 0 menit.');
  }

  const questions = exam.questions || [];
  if (questions.length === 0) {
    errors.push('Paket ujian minimal harus memiliki 1 butir soal.');
  }

  // Validate each question snapshot
  questions.forEach((q, idx) => {
    const qNum = q.order || idx + 1;
    if (!q.questionText || !q.questionText.trim()) {
      errors.push(`Soal #${qNum}: Teks pertanyaan belum diisi.`);
    }

    if (q.type === 'single_choice') {
      if (!q.options || q.options.length < 2) {
        errors.push(`Soal #${qNum} (Pilihan Ganda): Minimal harus memiliki 2 pilihan jawaban.`);
      }
      if (!q.correctAnswers || q.correctAnswers.length !== 1) {
        errors.push(`Soal #${qNum} (Pilihan Ganda): Harus memiliki tepat 1 kunci jawaban yang benar.`);
      }
    } else if (q.type === 'multiple_choice') {
      if (!q.options || q.options.length < 2) {
        errors.push(`Soal #${qNum} (PG Kompleks): Minimal harus memiliki 2 pilihan jawaban.`);
      }
      // Check that at least one option has a positive score or is marked in correctAnswers
      const hasScores = q.options && q.options.some((o) => (o.score ?? 0) > 0);
      const hasKeys = q.correctAnswers && q.correctAnswers.length > 0;
      if (!hasScores && !hasKeys) {
        errors.push(`Soal #${qNum} (PG Kompleks): Minimal salah satu opsi harus memiliki bobot skor > 0 atau ditandai sebagai kunci.`);
      }
    } else if (q.type === 'true_false') {
      if (!q.correctAnswers || q.correctAnswers.length === 0 || !['true', 'false'].includes(q.correctAnswers[0])) {
        errors.push(`Soal #${qNum} (Benar / Salah): Belum menentukan kunci jawaban (Benar atau Salah).`);
      }
    } else if (q.type === 'essay') {
      if ((q.maxScore || 0) <= 0) {
        errors.push(`Soal #${qNum} (Uraian / Esai): Skor maksimal harus lebih besar dari 0.`);
      }
    }
  });

  const token = exam.examToken || exam.pin;
  if (!token || !token.trim()) {
    errors.push('Token ujian wajib dibuat sebelum mengaktifkan ujian.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper to load local exams from localStorage
 */
export function getStoredExams(): Exam[] {
  try {
    const data = localStorage.getItem(EXAMS_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading exams', e);
  }
  return [...mockExams];
}

/**
 * Helper to save local exams to localStorage
 */
export function saveStoredExams(exams: Exam[]) {
  try {
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));
  } catch (e) {
    console.error('Error saving exams', e);
  }
}

/**
 * Normalizes an exam object so both modern and legacy properties are consistent
 */
function normalizeExam(exam: any): Exam {
  const questions: ExamQuestionSnapshot[] = exam.questions || [];
  
  // Calculate total points and composition
  let totalPoints = 0;
  const composition = {
    multiple_choice: 0,
    multiple_select: 0,
    true_false: 0,
    essay: 0
  };

  questions.forEach((q) => {
    totalPoints += Number(q.maxScore) || 0;
    if (q.type === 'single_choice') composition.multiple_choice++;
    else if (q.type === 'multiple_choice') composition.multiple_select++;
    else if (q.type === 'true_false') composition.true_false++;
    else if (q.type === 'essay') composition.essay++;
  });

  const ownerId = exam.ownerId || exam.owner_id || '';
  const subjectId = exam.subjectId || exam.subject_id || '';
  const classId = exam.classId || exam.class_id || (exam.classIds && exam.classIds[0]) || (exam.class_ids && exam.class_ids[0]) || '';
  const duration = exam.durationMinutes || exam.duration_minutes || 60;
  const token = exam.examToken || exam.pin || generateExamToken();

  // Normalize status to uppercase lifecycle status
  let status: ExamLifecycleStatus = 'DRAFT';
  const rawStatus = (exam.status || 'DRAFT').toUpperCase();
  if (['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'GRADED', 'RESULTS_RELEASED', 'CANCELLED', 'ARCHIVED'].includes(rawStatus)) {
    status = rawStatus as ExamLifecycleStatus;
  } else if (rawStatus === 'FINISHED') {
    status = 'COMPLETED';
  }

  return {
    ...exam,
    ownerId,
    owner_id: ownerId,
    ownerName: exam.ownerName || exam.owner_name || 'Guru Pengampu',
    owner_name: exam.ownerName || exam.owner_name || 'Guru Pengampu',
    subjectId,
    subject_id: subjectId,
    subjectName: exam.subjectName || exam.subject_name || 'Mata Pelajaran',
    subject_name: exam.subjectName || exam.subject_name || 'Mata Pelajaran',
    classId,
    class_id: classId,
    classIds: [classId],
    class_ids: [classId],
    className: exam.className || exam.class_name || (exam.class_names && exam.class_names[0]) || 'Semua Kelas',
    class_names: [exam.className || exam.class_name || (exam.class_names && exam.class_names[0]) || 'Semua Kelas'],
    status,
    questions,
    questionIds: questions.map((q) => q.id),
    durationMinutes: duration,
    duration_minutes: duration,
    startAt: exam.startAt || exam.start_at,
    start_at: exam.startAt || exam.start_at,
    endAt: exam.endAt || exam.end_at,
    end_at: exam.endAt || exam.end_at,
    examToken: token,
    pin: token,
    shuffleQuestions: exam.shuffleQuestions ?? exam.settings?.shuffle_questions ?? true,
    shuffleOptions: exam.shuffleOptions ?? exam.settings?.shuffle_options ?? true,
    totalQuestions: questions.length,
    total_questions: questions.length,
    totalPoints,
    total_points: totalPoints,
    composition,
    createdAt: exam.createdAt || exam.created_at || new Date().toISOString(),
    created_at: exam.createdAt || exam.created_at || new Date().toISOString(),
    updatedAt: exam.updatedAt || exam.updated_at || new Date().toISOString(),
    updated_at: exam.updatedAt || exam.updated_at || new Date().toISOString(),
    publishedAt: exam.publishedAt || exam.published_at,
    activatedAt: exam.activatedAt,
    completedAt: exam.completedAt
  };
}

/**
 * Fetch all exams for a teacher, or all exams if user is Admin.
 * Combines Firestore, Dexie local-first cache, and localStorage fallback.
 */
export async function getTeacherExams(ownerId: string, isAdmin: boolean = false): Promise<Exam[]> {
  const examsMap = new Map<string, Exam>();

  // 1. First load from Dexie for immediate zero-latency local render
  try {
    let dexieExams: Exam[] = [];
    if (isAdmin) {
      dexieExams = await dexieDb.examDrafts.toArray();
    } else {
      dexieExams = await dexieDb.examDrafts.where('ownerId').equals(ownerId).toArray();
    }
    dexieExams.forEach((e) => {
      const normalized = normalizeExam(e);
      examsMap.set(normalized.id, normalized);
    });
  } catch (e) {
    console.warn('[Dexie] Gagal memuat examDrafts:', e);
  }

  // 2. Fetch from Firestore if configured
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      let q;
      if (isAdmin) {
        q = query(collection(firestoreDb, 'exams'), orderBy('updatedAt', 'desc'));
      } else {
        q = query(collection(firestoreDb, 'exams'), where('ownerId', '==', ownerId));
      }
      const snap = await getDocs(q);
      snap.docs.forEach((doc) => {
        const normalized = normalizeExam(doc.data());
        examsMap.set(normalized.id, normalized);
        // Keep Dexie in sync
        dexieDb.examDrafts.put(normalized).catch(() => {});
      });
    } catch (err) {
      console.warn('[Firestore] Gagal memuat exams dari cloud (fallback ke lokal):', err);
    }
  }

  // 3. Fallback to LocalStorage / mockExams if map is empty
  if (examsMap.size === 0) {
    const local = getStoredExams();
    local.forEach((e) => {
      const normalized = normalizeExam(e);
      if (isAdmin || normalized.ownerId === ownerId || normalized.owner_id === ownerId || !normalized.ownerId) {
        examsMap.set(normalized.id, normalized);
      }
    });
  }

  const result = Array.from(examsMap.values());
  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Fetch a single exam by ID.
 * If questions are separated into private examKeys/{examId}, fetches and merges them for teacher.
 */
export async function getExam(examId: string): Promise<Exam | null> {
  // Check Dexie first (teacher's local draft has full questions)
  try {
    const dexieExam = await dexieDb.examDrafts.get(examId);
    if (dexieExam && dexieExam.questions && dexieExam.questions.length > 0) {
      return normalizeExam(dexieExam);
    }
  } catch (e) {
    console.warn('[Dexie] Gagal get exam:', e);
  }

  // Check Firestore
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, 'exams', examId));
      if (snap.exists()) {
        const examData = snap.data() as Exam;
        // If questions were stripped for CRIT-01 public separation, fetch from private examKeys
        if (!examData.questions || examData.questions.length === 0) {
          try {
            const keySnap = await getDoc(doc(firestoreDb, 'examKeys', examId));
            if (keySnap.exists()) {
              const keyData = keySnap.data() as ExamKeyDocument;
              examData.questions = keyData.questions;
            }
          } catch (keyErr) {
            console.warn('[Firestore] Gagal memuat private examKeys:', keyErr);
          }
        }
        return normalizeExam(examData);
      }
    } catch (e) {
      console.warn('[Firestore] Gagal get doc exam:', e);
    }
  }

  // Check LocalStorage
  const local = getStoredExams();
  const found = local.find((e) => e.id === examId);
  return found ? normalizeExam(found) : null;
}

/**
 * Clean undefined properties before writing to Firestore
 */
function sanitizeDocData(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined) {
      result[key] = data[key];
    }
  }
  return result;
}

/**
 * Save / Autosave an Exam draft.
 * CRIT-01 ARCHITECTURE:
 * 1. Dexie saves teacher's local copy with questions.
 * 2. Firestore saves private examKeys/{examId} (with answer keys & per-option scores).
 * 3. Firestore saves public exams/{examId} (metadata only, NO answer keys).
 * 4. Firestore saves studentExams/{examId} (clean StudentSafeExam projection).
 */
export async function saveExamDraft(
  examData: Exam
): Promise<{ success: boolean; cloudSynced: boolean; error?: string }> {
  const normalized = normalizeExam({
    ...examData,
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // 1. Save to Dexie immediately
  try {
    await dexieDb.examDrafts.put(normalized);
    // Also cache student safe projection locally
    const safeProjection = createStudentSafeExam(normalized);
    await dexieDb.studentSafeExams.put(safeProjection);
  } catch (dexieErr) {
    console.warn('[Dexie] Gagal menyimpan exam draft ke Dexie:', dexieErr);
  }

  // 2. Save to LocalStorage
  try {
    const current = getStoredExams();
    const updated = [normalized, ...current.filter((e) => e.id !== normalized.id)];
    saveStoredExams(updated);
  } catch (e) {
    console.warn('[LocalStorage] Gagal menyimpan exam:', e);
  }

  // 3. Sync to Firestore if online
  let cloudSynced = false;
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      // 3a. Save private examKeys/{examId} containing full question snapshots with answer keys & scores
      const examKeyDoc: ExamKeyDocument = {
        id: normalized.id,
        examId: normalized.id,
        ownerId: normalized.ownerId || normalized.owner_id || '',
        examToken: normalized.examToken || normalized.pin || '',
        title: normalized.title,
        durationMinutes: normalized.durationMinutes || normalized.duration_minutes || 60,
        startAt: normalized.startAt || normalized.start_at || null,
        endAt: normalized.endAt || normalized.end_at || null,
        totalPoints: normalized.totalPoints || normalized.total_points || 100,
        questions: normalized.questions || [],
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt
      };
      await setDoc(doc(firestoreDb, 'examKeys', normalized.id), sanitizeDocData(examKeyDoc), { merge: true });

      // 3b. Save public exams/{examId} with METADATA ONLY (ZERO answer keys, ZERO rubrics, ZERO option scores)
      const publicExamData = {
        id: normalized.id,
        examId: normalized.id,
        ownerId: normalized.ownerId || normalized.owner_id,
        ownerName: normalized.ownerName || normalized.owner_name,
        title: normalized.title,
        description: normalized.description || '',
        subjectId: normalized.subjectId || normalized.subject_id,
        subjectName: normalized.subjectName || normalized.subject_name,
        classId: normalized.classId || normalized.class_id,
        className: normalized.className || normalized.class_name,
        classIds: normalized.classIds || normalized.class_ids,
        classNames: normalized.class_names || (normalized.className ? [normalized.className] : []),
        status: normalized.status,
        durationMinutes: normalized.durationMinutes || normalized.duration_minutes,
        startAt: normalized.startAt || normalized.start_at || null,
        endAt: normalized.endAt || normalized.end_at || null,
        examToken: normalized.examToken,
        pin: normalized.pin,
        shuffleQuestions: normalized.shuffleQuestions,
        shuffleOptions: normalized.shuffleOptions,
        questionCount: (normalized.questions || []).length,
        totalQuestions: (normalized.questions || []).length,
        totalPoints: normalized.totalPoints,
        composition: normalized.composition,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
        publishedAt: normalized.publishedAt || null,
        activatedAt: normalized.activatedAt || null,
        completedAt: normalized.completedAt || null
      };
      await setDoc(doc(firestoreDb, 'exams', normalized.id), sanitizeDocData(publicExamData), { merge: true });

      // 3c. Save studentExams/{examId} (Sanitized StudentSafeExam projection)
      const safeExam = createStudentSafeExam(normalized);
      await setDoc(doc(firestoreDb, 'studentExams', normalized.id), sanitizeDocData(safeExam), { merge: true });

      cloudSynced = true;
    } catch (err: any) {
      console.warn('[Firestore] Gagal sinkronisasi cloud exam (tersimpan di lokal):', err);
      return { success: true, cloudSynced: false, error: err.message };
    }
  }

  return { success: true, cloudSynced };
}

/**
 * Update an existing Exam
 */
export async function updateExam(exam: Exam): Promise<Exam> {
  const result = await saveExamDraft(exam);
  if (!result.success) {
    throw new Error(result.error || 'Gagal menyimpan perubahan ujian.');
  }
  return normalizeExam(exam);
}

/**
 * Standard EXAMPUSA Lifecycle Transition Rules
 */
export const VALID_LIFECYCLE_TRANSITIONS: Record<ExamLifecycleStatus, ExamLifecycleStatus[]> = {
  DRAFT: ['SCHEDULED', 'ACTIVE', 'CANCELLED', 'ARCHIVED'],
  SCHEDULED: ['ACTIVE', 'DRAFT', 'CANCELLED', 'ARCHIVED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['GRADED', 'ARCHIVED'],
  GRADED: ['RESULTS_RELEASED', 'COMPLETED', 'ARCHIVED'],
  RESULTS_RELEASED: ['ARCHIVED'],
  CANCELLED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: [] // Terminal state
};

export function isValidLifecycleTransition(
  currentStatus: ExamLifecycleStatus,
  targetStatus: ExamLifecycleStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_LIFECYCLE_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
}

/**
 * Record an audit log event for Admin actions.
 * Never stores credentials or private tokens.
 */
export async function recordAdminAuditEvent(
  adminId: string,
  action:
    | 'admin_lifecycle_transition'
    | 'admin_exam_duplicated'
    | 'admin_exam_archived'
    | 'admin_override_action'
    | 'admin_view_result_detail'
    | 'admin_export_results',
  examId: string,
  details: {
    previousStatus?: string;
    newStatus?: string;
    sourceExamId?: string;
    targetTeacherId?: string;
    description?: string;
    resultId?: string;
    studentName?: string;
    recordCount?: number;
    filters?: any;
  }
): Promise<SecurityEvent> {
  const event: SecurityEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    session_id: 'admin_session',
    exam_id: examId,
    student_id: adminId,
    student_name: 'Administrator',
    event_type: action,
    severity: 'info',
    metadata: {
      details: details.description || `Admin action: ${action} on exam ${examId}`,
      previousStatus: details.previousStatus,
      newStatus: details.newStatus,
      sourceExamId: details.sourceExamId,
      targetTeacherId: details.targetTeacherId
    } as any,
    created_at: new Date().toISOString()
  };

  try {
    await dexieDb.securityEvents.add(event);
  } catch (e) {
    // Dexie may be unavailable in unit test runner
  }

  if (isFirebaseConfigured() && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, 'securityEvents', event.id), event);
    } catch (e) {
      // ignore
    }
  }

  return event;
}

/**
 * Update exam lifecycle status with strict validation.
 * Checks allowed transition rules and completeness.
 */
export async function updateExamLifecycleStatus(
  examId: string,
  newStatus: ExamLifecycleStatus,
  actorName?: string,
  actorId: string = 'admin_1'
): Promise<{ exam: Exam | null; error?: string; auditEvent?: SecurityEvent }> {
  const exam = await getExam(examId);
  if (!exam) {
    return { exam: null, error: 'Paket ujian tidak ditemukan.' };
  }

  const currentStatus = (exam.status || 'DRAFT') as ExamLifecycleStatus;

  // Validate lifecycle transition rules
  if (!isValidLifecycleTransition(currentStatus, newStatus)) {
    return {
      exam: null,
      error: `Transisi status tidak valid: Ujian dengan status "${currentStatus}" tidak dapat diubah langsung menjadi "${newStatus}".`
    };
  }

  // Validate if activating or scheduling
  if (newStatus === 'ACTIVE' || newStatus === 'SCHEDULED') {
    const validation = validateExamForActivation(exam);
    if (!validation.valid) {
      return {
        exam: null,
        error: `Ujian belum siap diaktifkan:\n- ${validation.errors.join('\n- ')}`
      };
    }
  }

  const now = new Date().toISOString();
  const updated: Exam = {
    ...exam,
    status: newStatus,
    updatedAt: now,
    updated_at: now
  };

  if (newStatus === 'ACTIVE') {
    updated.activatedAt = now;
    if (!updated.publishedAt) updated.publishedAt = now;
    if (!updated.published_at) updated.published_at = now;
  } else if (newStatus === 'COMPLETED') {
    updated.completedAt = now;
  }

  await saveExamDraft(updated);

  // Record Audit Event
  const auditEvent = await recordAdminAuditEvent(actorId, 'admin_lifecycle_transition', examId, {
    previousStatus: currentStatus,
    newStatus,
    description: `Status ujian "${exam.title}" diubah oleh ${actorName || 'Administrator'} dari ${currentStatus} ke ${newStatus}`
  });

  return { exam: updated, auditEvent };
}

/**
 * Backward compatible status updater
 */
export function updateExamStatus(examId: string, status: ExamStatus): Exam | null {
  const all = getStoredExams();
  const idx = all.findIndex((e) => e.id === examId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  all[idx].status = status;
  all[idx].updatedAt = now;
  all[idx].updated_at = now;
  if ((status === 'active' || status === 'ACTIVE') && !all[idx].publishedAt) {
    all[idx].publishedAt = now;
  }
  saveStoredExams(all);

  // Background sync
  saveExamDraft(all[idx]).catch(() => {});
  return all[idx];
}

/**
 * Duplicate an existing Exam into a fresh independent DRAFT package.
 * Creates a brand new Exam ID, fresh question snapshot IDs, resets status to DRAFT,
 * generates a fresh token, and does NOT modify the original exam.
 */
export async function duplicateExam(
  sourceExam: Exam,
  currentUserId: string,
  currentUserName: string
): Promise<Exam> {
  const now = new Date().toISOString();
  const newExamId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  // Clone all snapshots with new unique IDs
  const clonedQuestions: ExamQuestionSnapshot[] = (sourceExam.questions || []).map((q, idx) => ({
    ...q,
    id: `snap_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    order: idx + 1,
    options: (q.options || []).map((opt) => ({ ...opt })),
    correctAnswers: q.correctAnswers ? [...q.correctAnswers] : []
  }));

  const duplicated: Exam = normalizeExam({
    ...sourceExam,
    id: newExamId,
    ownerId: currentUserId,
    owner_id: currentUserId,
    ownerName: currentUserName,
    owner_name: currentUserName,
    title: sourceExam.title.startsWith('Salinan dari') ? sourceExam.title : `Salinan dari ${sourceExam.title}`,
    status: 'DRAFT',
    examToken: generateExamToken(),
    pin: generateExamToken(),
    startAt: undefined,
    start_at: undefined,
    endAt: undefined,
    end_at: undefined,
    publishedAt: undefined,
    published_at: undefined,
    activatedAt: undefined,
    completedAt: undefined,
    questions: clonedQuestions,
    questionIds: clonedQuestions.map((q) => q.id),
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now
  });

  await saveExamDraft(duplicated);

  // Record audit log if performed by admin
  await recordAdminAuditEvent(currentUserId || 'admin_1', 'admin_exam_duplicated', newExamId, {
    sourceExamId: sourceExam.id,
    targetTeacherId: currentUserId,
    description: `Paket ujian "${sourceExam.title}" diduplikasi menjadi "${duplicated.title}" (ID: ${newExamId})`
  });

  return duplicated;
}

/**
 * Archive an Exam (non-destructive status transition)
 * Preserves all questions snapshots and historical student results intact.
 */
export async function archiveExam(
  examId: string,
  actorName?: string,
  actorId: string = 'admin_1'
): Promise<Exam | null> {
  const res = await updateExamLifecycleStatus(examId, 'ARCHIVED', actorName, actorId);
  return res.exam;
}

/**
 * Delete an Exam safely.
 * Hard delete is STRICTLY ONLY allowed for DRAFT exams that were never active.
 * For any other status, returns an error directing user to archive.
 */
export async function deleteDraftExam(
  examId: string,
  forceAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const exam = await getExam(examId);
  if (!exam) {
    return { success: false, error: 'Ujian tidak ditemukan.' };
  }

  // Safety check: Only DRAFT or forceAdmin can delete
  if (exam.status !== 'DRAFT' && exam.status !== 'draft' && !forceAdmin) {
    return {
      success: false,
      error: 'Ujian yang pernah dijadwalkan, aktif, atau selesai tidak boleh dihapus demi menjaga integritas rekam jejak. Silakan pilih opsi "Arsipkan Ujian".'
    };
  }

  // 1. Delete from Dexie
  try {
    await dexieDb.examDrafts.delete(examId);
  } catch (e) {
    console.warn('[Dexie] Gagal menghapus draft exam:', e);
  }

  // 2. Delete from LocalStorage
  const local = getStoredExams();
  saveStoredExams(local.filter((e) => e.id !== examId));

  // 3. Delete from Firestore if online
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, 'exams', examId));
    } catch (err: any) {
      console.warn('[Firestore] Gagal delete doc exam:', err);
    }
  }

  return { success: true };
}

/**
 * Legacy support for createExamWithSnapshot
 */
export function createExamWithSnapshot(
  examData: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'total_questions' | 'total_points' | 'composition' | 'questions_snapshot'>,
  selectedQuestionIds: string[]
): Exam {
  const allQuestions = getStoredQuestions();
  const selectedQuestions = allQuestions.filter((q) => selectedQuestionIds.includes(q.id));

  const snapshots: ExamQuestionSnapshot[] = selectedQuestions.map((q, idx) =>
    convertQuestionToSnapshot(q, idx + 1)
  );

  const newExam: Exam = normalizeExam({
    ...examData,
    id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    status: 'DRAFT',
    questions: snapshots,
    questionIds: snapshots.map((s) => s.id),
    examToken: generateExamToken(),
    shuffleQuestions: true,
    shuffleOptions: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const all = getStoredExams();
  saveStoredExams([newExam, ...all]);
  saveExamDraft(newExam).catch(() => {});
  return newExam;
}

/**
 * Migration Utility (Requirement 15):
 * Ensures legacy exams from Stage 5-7 have their answer keys moved to examKeys
 * and sanitized StudentSafeExam projections generated.
 */
export async function migrateExistingExamsToSecureKeys(): Promise<{ migratedCount: number }> {
  let count = 0;
  try {
    const allExams = getStoredExams();
    for (const exam of allExams) {
      if (exam.questions && exam.questions.length > 0) {
        // Save using CRIT-01 hardened pipeline
        await saveExamDraft(exam);
        count++;
      }
    }
  } catch (err) {
    console.warn('[Migration] Error during exam migration:', err);
  }
  return { migratedCount: count };
}
