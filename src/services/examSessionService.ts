import type {
  Exam,
  ExamSession,
  ExamResult,
  StudentAnswer,
  UserProfile
} from '../types';
import { db } from '../lib/dexie';
import { gradeSubmission } from './gradingService';
import { mockResults } from '../data/mockData';

const RESULTS_STORAGE_KEY = 'sp1_puspo_results_store';

export function getStoredResults(): ExamResult[] {
  try {
    const data = localStorage.getItem(RESULTS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading results', e);
  }
  return [...mockResults];
}

export function saveStoredResults(results: ExamResult[]) {
  try {
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
  } catch (e) {
    console.error('Error saving results', e);
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function startOrCreateStudentSession(
  exam: Exam,
  student: UserProfile
): Promise<{ session: ExamSession; answers: Record<string, any> }> {
  // Check if session exists in Dexie
  const existing = await db.examSessions
    .where('exam_id')
    .equals(exam.id)
    .and((s) => s.student_id === student.uid)
    .first();

  if (existing) {
    // Load local answers
    const localAnswers = await db.answers
      .where('session_id')
      .equals(existing.id)
      .toArray();

    const ansMap: Record<string, any> = {};
    localAnswers.forEach((a) => {
      ansMap[a.question_id] = a.answer;
    });

    return { session: existing, answers: ansMap };
  }

  // Create question order
  const rawQuestions = exam.questions_snapshot || [];
  let questionIds = rawQuestions.map((q) => q.question_id);
  if (exam.settings.shuffle_questions) {
    questionIds = shuffleArray(questionIds);
  }

  // Create option orders
  const optionOrders: Record<string, string[]> = {};
  rawQuestions.forEach((q) => {
    if (q.options && q.options.length > 0) {
      let optIds = q.options.map((o) => o.id);
      if (exam.settings.shuffle_options && q.question_type === 'multiple_choice') {
        optIds = shuffleArray(optIds);
      }
      optionOrders[q.question_id] = optIds;
    }
  });

  const now = new Date();
  const startedAt = now.toISOString();
  const durationMin = exam.durationMinutes || exam.duration_minutes || 60;
  const durationMs = durationMin * 60 * 1000;
  const targetExpiresMs = now.getTime() + durationMs;
  let finalExpiresMs = targetExpiresMs;
  if (exam.endAt || exam.end_at) {
    const endAtMs = new Date(exam.endAt || exam.end_at!).getTime();
    if (!isNaN(endAtMs) && endAtMs < finalExpiresMs) {
      finalExpiresMs = endAtMs;
    }
  }
  const expiresAt = new Date(finalExpiresMs).toISOString();

  const session: ExamSession = {
    id: `sess_${Date.now()}_${student.uid.substring(0, 6)}`,
    examId: exam.id,
    exam_id: exam.id,
    examTitle: exam.title,
    exam_title: exam.title,
    studentName: student.displayName,
    student_name: student.displayName,
    studentClass: student.className || 'IX-A',
    student_class: student.className || 'IX-A',
    classId: student.className || 'IX-A',
    examNumber: student.nis || '212207001',
    student_nis: student.nis || '212207001',
    student_id: student.uid,
    startedAt,
    started_at: startedAt,
    expiresAt,
    expires_at: expiresAt,
    status: 'IN_PROGRESS',
    questionOrder: questionIds,
    question_order: questionIds,
    optionOrders,
    option_orders: optionOrders,
    current_question_index: 0,
    lastSavedAt: startedAt,
    last_sync: startedAt,
    server_time_offset: 0,
    createdAt: startedAt,
    created_at: startedAt,
    updatedAt: startedAt,
    updated_at: startedAt
  };

  await db.examSessions.put(session);
  return { session, answers: {} };
}

export async function saveStudentAnswerLocally(
  sessionId: string,
  examId: string,
  studentId: string,
  questionId: string,
  answer: any
): Promise<void> {
  const answerId = `${sessionId}_${questionId}`;
  const record: StudentAnswer = {
    id: answerId,
    session_id: sessionId,
    exam_id: examId,
    student_id: studentId,
    question_id: questionId,
    answer,
    sync_status: 'synced',
    updated_at: new Date().toISOString()
  };

  await db.answers.put(record);

  // Update session last sync
  await db.examSessions.update(sessionId, {
    last_sync: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

export async function submitStudentExam(
  exam: Exam,
  session: ExamSession,
  student: UserProfile
): Promise<ExamResult> {
  // 1. Gather all answers from Dexie
  const localAnswers = await db.answers
    .where('session_id')
    .equals(session.id)
    .toArray();

  const answersMap: Record<string, any> = {};
  localAnswers.forEach((a) => {
    answersMap[a.question_id] = a.answer;
  });

  const submittedAt = new Date().toISOString();

  // 2. Update session state
  await db.examSessions.update(session.id, {
    status: 'submitted',
    submitted_at: submittedAt,
    updated_at: submittedAt
  });

  // 3. Server-authoritative grading
  const result = gradeSubmission(
    exam,
    student.uid,
    student.displayName,
    student.nis || '212207001',
    student.className || 'IX-A',
    session.id,
    session.started_at,
    submittedAt,
    answersMap
  );

  // 4. Save result in persistent store
  const allResults = getStoredResults();
  const existingIdx = allResults.findIndex((r) => r.id === result.id);
  if (existingIdx >= 0) {
    allResults[existingIdx] = result;
  } else {
    allResults.unshift(result);
  }
  saveStoredResults(allResults);

  return result;
}
