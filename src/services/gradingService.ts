import type {
  Exam,
  ExamSnapshotQuestion,
  ExamQuestionSnapshot,
  ExamOptionSnapshot,
  ExamResult,
  ExamResultItem,
  GradedAnswer,
  StudentAnswer,
  QuestionAnalysisData,
  ExamStatistics,
  MultipleSelectScoring,
  ExamResultGradingStatus
} from '../types';
import { db } from '../lib/dexie';
import { db as firestore, isFirebaseConfigured } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { logSecurityEvent } from './securityEventService';

/**
 * Sanitizes an object by removing undefined properties to comply with Firestore setDoc
 */
export function cleanUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        cleaned[key] = cleanUndefinedFields(val);
      } else if (Array.isArray(val)) {
        cleaned[key] = val.map((item) =>
          item !== null && typeof item === 'object' ? cleanUndefinedFields(item) : item
        );
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned as T;
}

/**
 * Resilient Firestore sync with 1s timeout to ensure offline operations never hang
 */
async function syncResultToFirestoreWithTimeout(result: ExamResult): Promise<void> {
  if (!firestore || !isFirebaseConfigured()) return;
  try {
    const promise = setDoc(
      doc(firestore, 'results', result.id),
      cleanUndefinedFields(result),
      { merge: true }
    );
    await Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout (offline)')), 1000))
    ]);
  } catch (e: any) {
    console.warn('[gradingService] Cloud sync skipped (offline mode):', e?.message || e);
  }
}

/**
 * Standardizes score rounding to given decimal places (default 2)
 */
export function roundScore(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Validates manual or automated score against snapshot bounds:
 * Score must be between 0 and maxScore.
 * Throws an Error if invalid.
 */
export function validateScoreAgainstSnapshot(score: number, maxScore: number): number {
  if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) {
    throw new Error(`Skor harus berupa angka valid.`);
  }
  if (score < 0) {
    throw new Error(`Skor tidak boleh kurang dari 0 (skor: ${score}).`);
  }
  if (score > maxScore) {
    throw new Error(`Skor (${score}) melebihi skor maksimal soal (${maxScore}).`);
  }
  return roundScore(score, 2);
}

/**
 * Extracts normalized ExamQuestionSnapshot[] from an Exam.
 * Ensures that snapshots inside Exam are the sole source of truth,
 * completely decoupled from any changes or deletions in Question Bank.
 */
export function extractQuestionSnapshots(exam: Exam): ExamQuestionSnapshot[] {
  if (exam.questions && exam.questions.length > 0) {
    return exam.questions;
  }
  if (exam.questions_snapshot && exam.questions_snapshot.length > 0) {
    return exam.questions_snapshot.map((qs, idx) => ({
      id: qs.question_id || qs.id,
      order: qs.order_number || idx + 1,
      type: (qs.question_type === 'multiple_choice'
        ? (qs.grading_method === 'partial_credit' || (qs.correct_answer && qs.correct_answer.length > 1)
            ? 'multiple_choice'
            : 'single_choice')
        : qs.question_type) as any,
      questionText: qs.question_text,
      options: qs.options?.map((opt, oIdx) => ({
        id: opt.id,
        text: opt.text,
        imageUrl: opt.imageRef,
        score: opt.score !== undefined ? opt.score : undefined,
        order: opt.order || oIdx + 1
      })),
      correctAnswers: qs.correct_answer,
      expectedAnswer: qs.answer_key,
      rubric: typeof qs.rubric === 'string' ? qs.rubric : undefined,
      maxScore: qs.points || 0,
      required: true
    }));
  }
  return [];
}

/**
 * Grades a Single Objective Question Answer based purely on ExamQuestionSnapshot.
 * 
 * 1. SINGLE CHOICE:
 *    - Correct answer = maxScore
 *    - Wrong or empty = 0
 *    - Invalid option (not in snapshot) = 0
 * 
 * 2. MULTIPLE CHOICE / PG KOMPLEKS:
 *    - Each option has its own score (ExamOptionSnapshot.score)
 *    - Student score is the sum of scores for options chosen by student
 *    - Partial credit supported
 *    - Options not in snapshot produce 0 score
 *    - Clamped between 0 and maxScore
 * 
 * 3. TRUE / FALSE:
 *    - Correct = maxScore
 *    - Wrong or empty = 0
 * 
 * 4. ESSAY:
 *    - Returns 0 with status 'NEEDS_GRADING'
 */
export function gradeObjectiveAnswer(
  questionSnapshot: ExamQuestionSnapshot,
  studentAnswer: any
): {
  score: number;
  maxScore: number;
  isCorrect: boolean;
  isPartial: boolean;
  gradingStatus: 'NOT_GRADED' | 'NEEDS_GRADING' | 'GRADED';
} {
  const maxScore = questionSnapshot.maxScore || 0;
  const qType = questionSnapshot.type;

  // ESSAY questions are NEVER automatically awarded scores
  if (qType === 'essay') {
    return {
      score: 0,
      maxScore,
      isCorrect: false,
      isPartial: false,
      gradingStatus: 'NEEDS_GRADING'
    };
  }

  // If answer is empty or null or undefined
  if (
    studentAnswer === null ||
    studentAnswer === undefined ||
    studentAnswer === '' ||
    (Array.isArray(studentAnswer) && studentAnswer.length === 0)
  ) {
    return {
      score: 0,
      maxScore,
      isCorrect: false,
      isPartial: false,
      gradingStatus: 'GRADED'
    };
  }

  // 1. SINGLE CHOICE
  if (qType === 'single_choice' || (qType === 'multiple_choice' && (!questionSnapshot.options || !questionSnapshot.options.some((o) => o.score !== undefined) && (!questionSnapshot.correctAnswers || questionSnapshot.correctAnswers.length <= 1)))) {
    const rawStudent = String(studentAnswer).trim();
    const validOptionIds = (questionSnapshot.options || []).map((o) => o.id);
    
    // Check if chosen option exists in snapshot
    const isValidOption = validOptionIds.length === 0 || validOptionIds.includes(rawStudent) || validOptionIds.some(id => id.toUpperCase() === rawStudent.toUpperCase());
    if (!isValidOption) {
      return { score: 0, maxScore, isCorrect: false, isPartial: false, gradingStatus: 'GRADED' };
    }

    const correctList = (questionSnapshot.correctAnswers || []).map((c) => String(c).trim().toUpperCase());
    const isCorrect = correctList.includes(rawStudent.toUpperCase());

    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      isCorrect,
      isPartial: false,
      gradingStatus: 'GRADED'
    };
  }

  // 2. MULTIPLE CHOICE / PG KOMPLEKS (with option-specific scoring and partial credit)
  if (qType === 'multiple_choice' || (qType as string) === 'multiple_select') {
    const chosenList: string[] = Array.isArray(studentAnswer)
      ? studentAnswer.map((s) => String(s).trim())
      : [String(studentAnswer).trim()];

    const optionsMap = new Map<string, ExamOptionSnapshot>();
    (questionSnapshot.options || []).forEach((opt) => {
      optionsMap.set(opt.id, opt);
      optionsMap.set(opt.id.toUpperCase(), opt);
    });

    // Check if options have explicit score attributes defined
    const hasExplicitOptionScores = (questionSnapshot.options || []).some(
      (opt) => typeof opt.score === 'number'
    );

    let earned = 0;

    if (hasExplicitOptionScores) {
      // Sum the scores of options chosen by student
      chosenList.forEach((optId) => {
        const optionSnapshot = optionsMap.get(optId) || optionsMap.get(optId.toUpperCase());
        if (optionSnapshot && typeof optionSnapshot.score === 'number') {
          earned += optionSnapshot.score;
        }
      });
    } else {
      // Fallback for legacy snapshot without opt.score:
      // Compare against correctAnswers array
      const correctAnswers = (questionSnapshot.correctAnswers || []).map((c) =>
        String(c).trim().toUpperCase()
      );
      const chosenUpper = chosenList.map((c) => c.toUpperCase());

      // If student chose any distractor that is NOT in correct answers
      const chosenDistractors = chosenUpper.filter((c) => !correctAnswers.includes(c));
      const chosenCorrect = chosenUpper.filter((c) => correctAnswers.includes(c));

      if (chosenDistractors.length === 0 && chosenCorrect.length > 0) {
        const fraction = chosenCorrect.length / Math.max(1, correctAnswers.length);
        earned = roundScore(fraction * maxScore, 2);
      } else {
        earned = 0;
      }
    }

    // Clamp score: 0 <= score <= maxScore
    earned = Math.min(Math.max(0, earned), maxScore);
    const roundedEarned = roundScore(earned, 2);

    const isCorrect = roundedEarned === maxScore && maxScore > 0;
    const isPartial = roundedEarned > 0 && roundedEarned < maxScore;

    return {
      score: roundedEarned,
      maxScore,
      isCorrect,
      isPartial,
      gradingStatus: 'GRADED'
    };
  }

  // 3. TRUE / FALSE
  if (qType === 'true_false') {
    const rawStudent = String(studentAnswer).trim().toLowerCase();
    const correctList = (questionSnapshot.correctAnswers || []).map((c) =>
      String(c).trim().toLowerCase()
    );

    const isCorrect = correctList.includes(rawStudent);
    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      isCorrect,
      isPartial: false,
      gradingStatus: 'GRADED'
    };
  }

  return {
    score: 0,
    maxScore,
    isCorrect: false,
    isPartial: false,
    gradingStatus: 'GRADED'
  };
}

/**
 * Grades all objective questions of an Exam based on snapshots and student answers.
 * Returns array of GradedAnswer items.
 */
export function gradeExamObjectiveAnswers(
  exam: Exam,
  studentAnswers: Record<string, any> | StudentAnswer[]
): GradedAnswer[] {
  const snapshots = extractQuestionSnapshots(exam);

  // Normalize student answers to a record lookup
  const answersMap: Record<string, any> = {};
  if (Array.isArray(studentAnswers)) {
    studentAnswers.forEach((ans) => {
      const qId = ans.questionId || ans.question_id;
      if (qId) {
        answersMap[qId] = ans.answer;
      }
    });
  } else if (studentAnswers && typeof studentAnswers === 'object') {
    Object.assign(answersMap, studentAnswers);
  }

  return snapshots.map((qSnapshot, index) => {
    const ansVal = answersMap[qSnapshot.id];
    const grading = gradeObjectiveAnswer(qSnapshot, ansVal);

    const gradedItem: GradedAnswer = {
      questionId: qSnapshot.id,
      questionNumber: qSnapshot.order || index + 1,
      questionType: qSnapshot.type,
      questionText: qSnapshot.questionText,
      answer: ansVal !== undefined ? ansVal : null,
      correctAnswer: qSnapshot.correctAnswers,
      score: grading.score,
      maxScore: grading.maxScore,
      gradingStatus: grading.gradingStatus,
      options: qSnapshot.options,
      // Compatibility fields
      question_id: qSnapshot.id,
      question_number: qSnapshot.order || index + 1,
      question_type: qSnapshot.type as any,
      question_text: qSnapshot.questionText,
      student_answer: ansVal !== undefined ? ansVal : null,
      correct_answer: qSnapshot.correctAnswers,
      answer_key: qSnapshot.expectedAnswer,
      max_points: grading.maxScore,
      earned_points: grading.score,
      is_correct: grading.isCorrect,
      is_partial: grading.isPartial,
      grading_status: grading.gradingStatus === 'NEEDS_GRADING' ? 'awaiting' : 'graded'
    };

    return gradedItem;
  });
}

/**
 * Calculates complete ExamResult from Exam and GradedAnswer[] items.
 */
export function calculateResult(params: {
  exam: Exam;
  sessionId: string;
  studentName: string;
  studentClass: string;
  examNumber: string;
  studentId?: string;
  gradedAnswers?: GradedAnswer[];
  studentAnswers?: Record<string, any> | StudentAnswer[];
  submittedAt?: string;
}): ExamResult {
  const {
    exam,
    sessionId,
    studentName,
    studentClass,
    examNumber,
    studentId = `student_${examNumber}`,
    submittedAt = new Date().toISOString()
  } = params;

  const items: GradedAnswer[] =
    params.gradedAnswers || gradeExamObjectiveAnswers(exam, params.studentAnswers || {});

  let objectiveScore = 0;
  let essayScore = 0;
  let totalMaxScore = 0;
  let gradedQuestionCount = 0;
  let hasPendingEssay = false;

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let essayCount = 0;

  items.forEach((item) => {
    totalMaxScore += item.maxScore || 0;

    const isUnanswered =
      item.answer === null ||
      item.answer === undefined ||
      item.answer === '' ||
      (Array.isArray(item.answer) && item.answer.length === 0);

    if (isUnanswered) {
      unansweredCount++;
    }

    if (item.questionType === 'essay') {
      essayCount++;
      essayScore += item.score || 0;
      if (item.gradingStatus === 'NEEDS_GRADING') {
        hasPendingEssay = true;
      } else {
        gradedQuestionCount++;
      }
    } else {
      objectiveScore += item.score || 0;
      gradedQuestionCount++;
      if (item.score === item.maxScore && item.maxScore > 0) {
        correctCount++;
      } else if (!isUnanswered) {
        wrongCount++;
      }
    }
  });

  const finalMaxScore = exam.totalPoints || exam.total_points || totalMaxScore;
  const finalTotalScore = roundScore(objectiveScore + essayScore, 2);
  const percentage =
    finalMaxScore > 0 ? roundScore((finalTotalScore / finalMaxScore) * 100, 2) : 0;

  let grade: 'A' | 'B' | 'C' | 'D' = 'D';
  if (percentage >= 90) grade = 'A';
  else if (percentage >= 80) grade = 'B';
  else if (percentage >= 70) grade = 'C';

  const passingScore = exam.settings?.passing_score ?? 75;
  const passed = percentage >= passingScore;

  const gradingStatus: ExamResultGradingStatus = hasPendingEssay
    ? 'NEEDS_GRADING'
    : 'GRADED';

  const now = new Date().toISOString();
  const resultId = `${exam.id}_${examNumber}`;

  return {
    id: resultId,
    examId: exam.id,
    exam_id: exam.id,
    sessionId,
    session_id: sessionId,
    studentId,
    student_id: studentId,
    studentName,
    student_name: studentName,
    classId: studentClass,
    studentClass,
    student_class: studentClass,
    examNumber,
    student_nis: examNumber,
    objectiveScore: roundScore(objectiveScore, 2),
    objective_points: roundScore(objectiveScore, 2),
    essayScore: roundScore(essayScore, 2),
    essay_points: roundScore(essayScore, 2),
    totalScore: finalTotalScore,
    earned_points: finalTotalScore,
    maxScore: finalMaxScore,
    total_points: finalMaxScore,
    percentage,
    gradedQuestionCount,
    totalQuestionCount: items.length,
    total_questions: items.length,
    gradingStatus,
    status: gradingStatus,
    submittedAt,
    submitted_at: submittedAt,
    gradedAt: hasPendingEssay ? undefined : now,
    finalized_at: hasPendingEssay ? undefined : now,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
    items,
    correct_count: correctCount,
    wrong_count: wrongCount,
    unanswered_count: unansweredCount,
    essay_count: essayCount,
    grade,
    passed,
    exam_title: exam.title,
    subject_name: exam.subjectName || exam.subject_name || ''
  };
}

/**
 * Updates a manual essay score for a student's answer.
 * Validates score: 0 <= score <= maxScore.
 * Recomputes totals and updates gradingStatus to 'GRADED' if all essays are scored.
 * Emits audit events: essay_score_updated, result_finalized.
 */
export async function updateManualEssayGrade(
  result: ExamResult,
  questionId: string,
  score: number,
  feedback: string,
  teacherName: string,
  teacherUid?: string,
  _exam?: Exam
): Promise<ExamResult> {
  // Find item to validate score bounds
  const targetItem = result.items.find(
    (i) => i.questionId === questionId || i.question_id === questionId
  );

  if (!targetItem) {
    throw new Error(`Soal uraian dengan ID ${questionId} tidak ditemukan.`);
  }

  // Validate score against snapshot max score
  try {
    validateScoreAgainstSnapshot(score, targetItem.maxScore || targetItem.max_points || 0);
  } catch (err: any) {
    // Log invalid score attempt audit
    await logSecurityEvent(
      result.sessionId || result.session_id || '',
      result.examId || result.exam_id || '',
      teacherUid || teacherName,
      teacherName,
      'invalid_score_attempt',
      'warning',
      `Percobaan nilai essay di luar batas: ${score} (Maks: ${targetItem.maxScore}). ${err.message}`
    );
    throw err;
  }

  const now = new Date().toISOString();
  const validScore = roundScore(score, 2);

  const updatedItems = result.items.map((item) => {
    if (item.questionId === questionId || item.question_id === questionId) {
      return {
        ...item,
        score: validScore,
        earned_points: validScore,
        gradingStatus: 'GRADED' as const,
        grading_status: 'graded' as const,
        teacherFeedback: feedback,
        teacher_feedback: feedback,
        gradedBy: teacherName,
        gradedAt: now,
        graded_at: now
      };
    }
    return item;
  });

  // Re-calculate result totals
  let newObjective = 0;
  let newEssay = 0;
  let hasPendingEssay = false;
  let gradedCount = 0;

  updatedItems.forEach((item) => {
    if (item.questionType === 'essay') {
      newEssay += item.score;
      if (item.gradingStatus === 'NEEDS_GRADING' || item.grading_status === 'awaiting') {
        hasPendingEssay = true;
      } else {
        gradedCount++;
      }
    } else {
      newObjective += item.score;
      gradedCount++;
    }
  });

  const totalMax = result.maxScore || result.total_points || 100;
  const newTotal = roundScore(newObjective + newEssay, 2);
  const newPercentage = totalMax > 0 ? roundScore((newTotal / totalMax) * 100, 2) : 0;

  let grade: 'A' | 'B' | 'C' | 'D' = 'D';
  if (newPercentage >= 90) grade = 'A';
  else if (newPercentage >= 80) grade = 'B';
  else if (newPercentage >= 70) grade = 'C';

  const newStatus: ExamResultGradingStatus = hasPendingEssay ? 'NEEDS_GRADING' : 'GRADED';

  const updatedResult: ExamResult = {
    ...result,
    items: updatedItems,
    objectiveScore: roundScore(newObjective, 2),
    objective_points: roundScore(newObjective, 2),
    essayScore: roundScore(newEssay, 2),
    essay_points: roundScore(newEssay, 2),
    totalScore: newTotal,
    earned_points: newTotal,
    percentage: newPercentage,
    grade,
    passed: newPercentage >= 75,
    gradingStatus: newStatus,
    status: newStatus,
    gradedQuestionCount: gradedCount,
    gradedBy: teacherName,
    gradedAt: hasPendingEssay ? result.gradedAt : now,
    finalized_at: hasPendingEssay ? result.finalized_at : now,
    updatedAt: now,
    updated_at: now
  };

  // 1. Save to local Dexie
  try {
    await db.examResults.put(updatedResult);
  } catch (err) {
    console.warn('[gradingService] Gagal menyimpan ke Dexie:', err);
  }

  // 2. Sync to Firestore (offline-resilient)
  await syncResultToFirestoreWithTimeout(updatedResult);

  // 3. Log Audit Event
  await logSecurityEvent(
    result.sessionId || result.session_id || '',
    result.examId || result.exam_id || '',
    teacherUid || teacherName,
    teacherName,
    'essay_score_updated',
    'info',
    `Guru ${teacherName} memberikan skor ${validScore} pada soal ${questionId} untuk siswa ${result.studentName} (${result.examNumber}).`
  );

  if (!hasPendingEssay && result.gradingStatus === 'NEEDS_GRADING') {
    await logSecurityEvent(
      result.sessionId || result.session_id || '',
      result.examId || result.exam_id || '',
      teacherUid || teacherName,
      teacherName,
      'result_finalized',
      'info',
      `Penilaian seluruh soal untuk siswa ${result.studentName} telah selesai (Status: GRADED).`
    );
  }

  return updatedResult;
}

/**
 * Backwards compatibility alias for updateManualEssayGrade (synchronous version)
 */
export function updateEssayGrade(
  result: ExamResult,
  questionId: string,
  score: number,
  feedback: string,
  teacherName: string
): ExamResult {
  const targetItem = result.items.find(
    (i) => i.questionId === questionId || i.question_id === questionId
  );
  const maxPoints = targetItem ? (targetItem.maxScore || targetItem.max_points || 0) : 100;
  const validScore = Math.min(Math.max(0, score), maxPoints);

  const updatedItems = result.items.map((item) => {
    if (item.questionId === questionId || item.question_id === questionId) {
      return {
        ...item,
        score: validScore,
        earned_points: validScore,
        gradingStatus: 'GRADED' as const,
        grading_status: 'graded' as const,
        teacherFeedback: feedback,
        teacher_feedback: feedback,
        gradedBy: teacherName,
        gradedAt: new Date().toISOString(),
        graded_at: new Date().toISOString()
      };
    }
    return item;
  });

  let newObjective = 0;
  let newEssay = 0;
  let hasPendingEssay = false;

  updatedItems.forEach((item) => {
    if (item.questionType === 'essay') {
      newEssay += item.score;
      if (item.gradingStatus === 'NEEDS_GRADING' || item.grading_status === 'awaiting') {
        hasPendingEssay = true;
      }
    } else {
      newObjective += item.score;
    }
  });

  const totalMax = result.maxScore || result.total_points || 100;
  const newTotal = roundScore(newObjective + newEssay, 2);
  const newPercentage = totalMax > 0 ? roundScore((newTotal / totalMax) * 100, 2) : 0;

  let grade: 'A' | 'B' | 'C' | 'D' = 'D';
  if (newPercentage >= 90) grade = 'A';
  else if (newPercentage >= 80) grade = 'B';
  else if (newPercentage >= 70) grade = 'C';

  const newStatus: ExamResultGradingStatus = hasPendingEssay ? 'NEEDS_GRADING' : 'GRADED';

  return {
    ...result,
    items: updatedItems,
    objectiveScore: roundScore(newObjective, 2),
    objective_points: roundScore(newObjective, 2),
    essayScore: roundScore(newEssay, 2),
    essay_points: roundScore(newEssay, 2),
    totalScore: newTotal,
    earned_points: newTotal,
    percentage: newPercentage,
    grade,
    passed: newPercentage >= 75,
    gradingStatus: newStatus,
    status: newStatus,
    gradedBy: teacherName,
    gradedAt: hasPendingEssay ? undefined : new Date().toISOString(),
    finalized_at: hasPendingEssay ? undefined : new Date().toISOString()
  };
}

/**
 * Releases Exam Result for a student.
 * Only permitted if gradingStatus === 'GRADED' (all questions graded).
 */
export async function releaseExamResult(
  result: ExamResult,
  teacherName: string,
  teacherUid: string
): Promise<ExamResult> {
  if (result.gradingStatus === 'NEEDS_GRADING' || result.status === 'awaiting_manual_grading') {
    throw new Error(
      `Hasil ujian ${result.studentName} belum dapat dirilis karena masih ada soal uraian yang belum dinilai.`
    );
  }

  const now = new Date().toISOString();
  const updated: ExamResult = {
    ...result,
    gradingStatus: 'RESULTS_RELEASED',
    status: 'RESULTS_RELEASED',
    releasedAt: now,
    releasedBy: teacherName,
    updatedAt: now,
    updated_at: now
  };

  try {
    await db.examResults.put(updated);
  } catch (e) {
    console.warn('[gradingService] Local save failed:', e);
  }

  // Cloud sync
  await syncResultToFirestoreWithTimeout(updated);

  await logSecurityEvent(
    result.sessionId || result.session_id || '',
    result.examId || result.exam_id || '',
    teacherUid,
    teacherName,
    'result_released',
    'info',
    `Guru ${teacherName} merilis hasil ujian resmi untuk siswa ${result.studentName} (${result.examNumber}).`
  );

  return updated;
}

/**
 * Cancels release of an Exam Result (reverts status to 'GRADED').
 * Does not delete any scoring data.
 */
export async function cancelReleaseExamResult(
  result: ExamResult,
  teacherName: string,
  teacherUid: string
): Promise<ExamResult> {
  const now = new Date().toISOString();
  const updated: ExamResult = {
    ...result,
    gradingStatus: 'GRADED',
    status: 'GRADED',
    updatedAt: now,
    updated_at: now
  };

  try {
    await db.examResults.put(updated);
  } catch (e) {
    console.warn('[gradingService] Local save failed:', e);
  }

  // Cloud sync
  await syncResultToFirestoreWithTimeout(updated);

  await logSecurityEvent(
    result.sessionId || result.session_id || '',
    result.examId || result.exam_id || '',
    teacherUid,
    teacherName,
    'result_release_cancelled',
    'info',
    `Guru ${teacherName} membatalkan rilis hasil ujian untuk siswa ${result.studentName} (${result.examNumber}).`
  );

  return updated;
}

/**
 * Question Item Performance Analysis for Teacher Analytics
 */
export function analyzeExamQuestions(
  exam: Exam,
  results: ExamResult[]
): QuestionAnalysisData[] {
  const snapshots = extractQuestionSnapshots(exam);
  const totalSubmissions = results.length;

  return snapshots.map((q, idx) => {
    let attempts = 0;
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let totalScore = 0;
    const optionDist: Record<string, number> = {};

    if (q.options) {
      q.options.forEach((opt) => {
        optionDist[opt.id] = 0;
      });
    }

    results.forEach((res) => {
      const item = res.items.find(
        (it) => it.questionId === q.id || it.question_id === q.id
      );
      if (item) {
        attempts++;
        totalScore += item.score || item.earned_points || 0;

        const isBlank =
          item.answer === null ||
          item.answer === undefined ||
          item.answer === '' ||
          (Array.isArray(item.answer) && item.answer.length === 0);

        if (isBlank) {
          unanswered++;
        } else {
          if (Array.isArray(item.answer)) {
            item.answer.forEach((choice) => {
              const key = String(choice);
              optionDist[key] = (optionDist[key] || 0) + 1;
            });
          } else if (typeof item.answer === 'boolean') {
            const key = item.answer ? 'true' : 'false';
            optionDist[key] = (optionDist[key] || 0) + 1;
          } else {
            const key = String(item.answer);
            optionDist[key] = (optionDist[key] || 0) + 1;
          }

          if (item.score === item.maxScore && item.maxScore > 0) {
            correct++;
          } else {
            wrong++;
          }
        }
      }
    });

    const correctPct = attempts > 0 ? roundScore((correct / attempts) * 100, 1) : 0;
    const avgScore = attempts > 0 ? roundScore(totalScore / attempts, 2) : 0;

    let difficulty: 'Mudah' | 'Sedang' | 'Sukar' = 'Sedang';
    if (correctPct >= 70) difficulty = 'Mudah';
    else if (correctPct < 35) difficulty = 'Sukar';

    return {
      question_id: q.id,
      question_number: q.order || idx + 1,
      question_type: q.type as any,
      question_text: q.questionText,
      options: q.options as any,
      correct_answer: q.correctAnswers,
      max_points: q.maxScore,
      total_attempts: attempts,
      correct_count: correct,
      wrong_count: wrong,
      unanswered_count: unanswered,
      correct_percentage: correctPct,
      average_score: avgScore,
      option_distribution: optionDist,
      difficulty_index: difficulty
    };
  });
}

/**
 * Calculate Summary Statistics for an Exam
 */
export function calculateExamStatistics(
  results: ExamResult[],
  totalParticipants: number = 0,
  passingScore: number = 75
): ExamStatistics {
  const count = results.length;
  if (count === 0) {
    return {
      total_participants: totalParticipants,
      submitted_count: 0,
      in_progress_count: 0,
      not_started_count: totalParticipants,
      average_score: 0,
      highest_score: 0,
      lowest_score: 0,
      median_score: 0,
      passed_count: 0,
      failed_count: 0,
      passing_rate: 0,
      awaiting_grading_count: 0,
      grade_distribution: { A: 0, B: 0, C: 0, D: 0 }
    };
  }

  const scores = results.map((r) => r.percentage).sort((a, b) => a - b);
  const sum = scores.reduce((acc, curr) => acc + curr, 0);
  const avg = roundScore(sum / count, 2);
  const highest = scores[scores.length - 1];
  const lowest = scores[0];

  const mid = Math.floor(scores.length / 2);
  const median =
    scores.length % 2 !== 0
      ? scores[mid]
      : roundScore((scores[mid - 1] + scores[mid]) / 2, 2);

  let passedCount = 0;
  let awaitingCount = 0;
  const gradeDist = { A: 0, B: 0, C: 0, D: 0 };

  results.forEach((r) => {
    if (r.passed) passedCount++;
    if (r.gradingStatus === 'NEEDS_GRADING' || r.status === 'awaiting_manual_grading') {
      awaitingCount++;
    }
    const g = r.grade || 'D';
    gradeDist[g] = (gradeDist[g] || 0) + 1;
  });

  const failedCount = count - passedCount;
  const passRate = roundScore((passedCount / count) * 100, 1);

  return {
    total_participants: Math.max(totalParticipants, count),
    submitted_count: count,
    in_progress_count: 0,
    not_started_count: Math.max(0, totalParticipants - count),
    average_score: avg,
    highest_score: highest,
    lowest_score: lowest,
    median_score: median,
    passed_count: passedCount,
    failed_count: failedCount,
    passing_rate: passRate,
    awaiting_grading_count: awaitingCount,
    grade_distribution: gradeDist
  };
}

/**
 * Legacy grade submission function, wraps calculateResult and emits automatic_grading_completed
 */
export function gradeSubmission(
  exam: Exam,
  studentId: string,
  studentName: string,
  studentNis: string,
  studentClass: string,
  sessionId: string,
  startedAt: string,
  submittedAt: string,
  answers: Record<string, any>
): ExamResult {
  const result = calculateResult({
    exam,
    sessionId,
    studentName,
    studentClass,
    examNumber: studentNis,
    studentId,
    studentAnswers: answers,
    submittedAt
  });

  // Asynchronously log audit event
  logSecurityEvent(
    sessionId,
    exam.id,
    studentId,
    studentName,
    'automatic_grading_completed',
    'info',
    `Grading otomatis selesai untuk siswa ${studentName}. Skor objektif: ${result.objectiveScore}/${result.maxScore}. Status: ${result.gradingStatus}.`
  );

  return result;
}

export function calculateGrade(percentage: number): 'A' | 'B' | 'C' | 'D' {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  return 'D';
}
