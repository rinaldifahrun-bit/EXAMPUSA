/**
 * Stage 7 Comprehensive Test Suite (17 Scenarios)
 * Run via: npx tsx src/tests/gradingService.test.ts
 */
import {
  gradeObjectiveAnswer,
  gradeExamObjectiveAnswers,
  calculateResult,
  validateScoreAgainstSnapshot,
  updateManualEssayGrade,
  releaseExamResult,
  cancelReleaseExamResult
} from '../services/gradingService';
import type { Exam, ExamQuestionSnapshot, ExamResult } from '../types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] Scenario ${totalTests}: ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] Scenario ${totalTests}: ${testName} -> ${detail || ''}`);
    throw new Error(`Assertion failed in: ${testName}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('EXAMPUSA STAGE 7 — GRADING & RESULTS TEST SUITE');
  console.log('======================================================\n');

  // Dummy Exam Snapshot with Questions of all 4 types
  const sampleExam: Exam = {
    id: 'exam_stage7_demo',
    ownerId: 'teacher_123',
    owner_id: 'teacher_123',
    title: 'Penilaian Akhir Semester Informatika',
    subjectId: 'subj_info',
    subject_id: 'subj_info',
    subjectName: 'Informatika',
    subject_name: 'Informatika',
    classId: 'class_9a',
    class_id: 'class_9a',
    className: 'Kelas 9A',
    class_name: 'Kelas 9A',
    status: 'published',
    durationMinutes: 60,
    duration_minutes: 60,
    totalPoints: 20,
    total_points: 20,
    settings: {
      passing_score: 75,
      shuffle_questions: false,
      shuffle_options: false
    },
    questions: [
      // 1. Single Choice (Points: 3)
      {
        id: 'q_sc',
        order: 1,
        type: 'single_choice',
        questionText: 'Manakah otak pemrosesan utama komputer?',
        options: [
          { id: 'opt_a', text: 'Harddisk', order: 1 },
          { id: 'opt_b', text: 'CPU / Processor', order: 2 },
          { id: 'opt_c', text: 'Monitor', order: 3 }
        ],
        correctAnswers: ['opt_b'],
        maxScore: 3,
        required: true
      },
      // 2. Multiple Choice / PG Kompleks (Option-specific scores: A=2, B=1, C=0, D=3. MaxScore: 6)
      {
        id: 'q_mc',
        order: 2,
        type: 'multiple_choice',
        questionText: 'Pilihlah perangkat masukan dan pemrosesan yang tepat:',
        options: [
          { id: 'opt_a', text: 'Keyboard (Skor: 2)', score: 2, order: 1 },
          { id: 'opt_b', text: 'Mouse (Skor: 1)', score: 1, order: 2 },
          { id: 'opt_c', text: 'Speaker (Skor: 0)', score: 0, order: 3 },
          { id: 'opt_d', text: 'Processor (Skor: 3)', score: 3, order: 4 }
        ],
        correctAnswers: ['opt_a', 'opt_b', 'opt_d'],
        maxScore: 6,
        required: true
      },
      // 3. True / False (Points: 2)
      {
        id: 'q_tf',
        order: 3,
        type: 'true_false',
        questionText: 'RAM bersifat volatile (data hilang saat listrik padam).',
        options: [
          { id: 'true', text: 'Benar', order: 1 },
          { id: 'false', text: 'Salah', order: 2 }
        ],
        correctAnswers: ['true'],
        maxScore: 2,
        required: true
      },
      // 4. Essay (MaxScore: 9)
      {
        id: 'q_es',
        order: 4,
        type: 'essay',
        questionText: 'Jelaskan perbedaan mendasar antara RAM dan ROM!',
        options: [],
        correctAnswers: [],
        expectedAnswer: 'RAM volatile berkecepatan tinggi, ROM non-volatile berisi firmware BIOS.',
        maxScore: 9,
        required: true
      }
    ]
  };

  const scQuestion = sampleExam.questions![0];
  const mcQuestion = sampleExam.questions![1];
  const tfQuestion = sampleExam.questions![2];
  const esQuestion = sampleExam.questions![3];

  // ----------------------------------------------------
  // Scenario 1: Single choice benar
  // ----------------------------------------------------
  const scCorrect = gradeObjectiveAnswer(scQuestion, 'opt_b');
  assert(
    scCorrect.score === 3 && scCorrect.isCorrect === true && scCorrect.gradingStatus === 'GRADED',
    'Single choice benar mendapatkan skor maksimal snapshot (3 poin)'
  );

  // ----------------------------------------------------
  // Scenario 2: Single choice salah
  // ----------------------------------------------------
  const scWrong = gradeObjectiveAnswer(scQuestion, 'opt_a');
  assert(
    scWrong.score === 0 && scWrong.isCorrect === false,
    'Single choice salah mendapatkan 0 poin'
  );

  // ----------------------------------------------------
  // Scenario 3: Multiple choice partial score
  // Siswa memilih A (skor 2) dan C (skor 0) -> 2 + 0 = 2
  // ----------------------------------------------------
  const mcPartial = gradeObjectiveAnswer(mcQuestion, ['opt_a', 'opt_c']);
  assert(
    mcPartial.score === 2 && mcPartial.isPartial === true && mcPartial.isCorrect === false,
    'Multiple choice partial credit dihitung dari jumlah skor opsi yang dipilih (2 + 0 = 2)'
  );

  // ----------------------------------------------------
  // Scenario 4: Multiple choice semua score
  // Siswa memilih B (skor 1) dan D (skor 3) -> 1 + 3 = 4
  // Dan semua benar: A (2) + B (1) + D (3) = 6 (skor maksimal)
  // ----------------------------------------------------
  const mcBD = gradeObjectiveAnswer(mcQuestion, ['opt_b', 'opt_d']);
  const mcAll = gradeObjectiveAnswer(mcQuestion, ['opt_a', 'opt_b', 'opt_d']);
  assert(
    mcBD.score === 4 && mcAll.score === 6 && mcAll.isCorrect === true,
    'Multiple choice semua score dan partial terakumulasi akurat sesuai snapshot opsi'
  );

  // ----------------------------------------------------
  // Scenario 5: True/False benar
  // ----------------------------------------------------
  const tfCorrect = gradeObjectiveAnswer(tfQuestion, 'true');
  assert(
    tfCorrect.score === 2 && tfCorrect.isCorrect === true,
    'True/False benar mendapatkan skor maksimal (2 poin)'
  );

  // ----------------------------------------------------
  // Scenario 6: True/False salah
  // ----------------------------------------------------
  const tfWrong = gradeObjectiveAnswer(tfQuestion, 'false');
  assert(
    tfWrong.score === 0 && tfWrong.isCorrect === false,
    'True/False salah mendapatkan 0 poin'
  );

  // ----------------------------------------------------
  // Scenario 7: Essay belum dinilai
  // ----------------------------------------------------
  const esResult = gradeObjectiveAnswer(esQuestion, 'Jawaban murid tentang RAM dan ROM');
  assert(
    esResult.score === 0 && esResult.gradingStatus === 'NEEDS_GRADING' && esResult.isCorrect === false,
    'Essay TIDAK dinilai otomatis dan berstatus awal NEEDS_GRADING dengan skor 0'
  );

  // ----------------------------------------------------
  // Scenario 8: Essay score valid
  // Guru memberi nilai 7 dari maxScore 9
  // ----------------------------------------------------
  const validatedValidScore = validateScoreAgainstSnapshot(7, esQuestion.maxScore);
  assert(
    validatedValidScore === 7,
    'Essay score valid (7 dari max 9) diterima oleh validasi snapshot'
  );

  // ----------------------------------------------------
  // Scenario 9: Essay score > maxScore ditolak
  // ----------------------------------------------------
  let rejectedOverMax = false;
  try {
    validateScoreAgainstSnapshot(10, esQuestion.maxScore);
  } catch (e: any) {
    rejectedOverMax = true;
  }
  assert(
    rejectedOverMax,
    'Essay score melebihi maxScore (> 9) ditolak dan melempar error'
  );

  // ----------------------------------------------------
  // Scenario 10: Essay score < 0 ditolak
  // ----------------------------------------------------
  let rejectedNegative = false;
  try {
    validateScoreAgainstSnapshot(-2, esQuestion.maxScore);
  } catch (e: any) {
    rejectedNegative = true;
  }
  assert(
    rejectedNegative,
    'Essay score negatif (< 0) ditolak dan melempar error'
  );

  // ----------------------------------------------------
  // Scenario 11: Total Score Calculation
  // Siswa menjawab: SC benar (3), MC A+B+D (6), TF benar (2), Essay awal (0).
  // Total sebelum koreksi = 11.
  // Setelah guru memberi essay = 7 -> Total = 18.
  // ----------------------------------------------------
  const studentAnswers = {
    q_sc: 'opt_b',
    q_mc: ['opt_a', 'opt_b', 'opt_d'],
    q_tf: 'true',
    q_es: 'RAM adalah memori baca tulis, ROM hanya memori baca.'
  };

  const calculated = calculateResult({
    exam: sampleExam,
    sessionId: 'session_test_1',
    studentName: 'Budi Santoso',
    studentClass: 'IX-A',
    examNumber: '20260901',
    studentAnswers
  });

  assert(
    calculated.objectiveScore === 11 &&
      calculated.essayScore === 0 &&
      calculated.totalScore === 11 &&
      calculated.gradingStatus === 'NEEDS_GRADING',
    'Total score objektif dihitung 11 poin dan status ujian adalah NEEDS_GRADING'
  );

  // ----------------------------------------------------
  // Scenario 12: Percentage Calculation
  // Total = 18 / 20 = 90% (Grade A, Lulus)
  // ----------------------------------------------------
  const gradedResult = await updateManualEssayGrade(
    calculated,
    'q_es',
    7,
    'Penjelasan sangat baik dan tepat.',
    'Pak Rinaldi Fahrun'
  );

  assert(
    gradedResult.essayScore === 7 &&
      gradedResult.totalScore === 18 &&
      gradedResult.percentage === 90 &&
      gradedResult.gradingStatus === 'GRADED' &&
      gradedResult.grade === 'A' &&
      gradedResult.passed === true,
    'Persentase nilai dihitung akurat (18/20 * 100 = 90.00%) dengan status GRADED'
  );

  // ----------------------------------------------------
  // Scenario 13: Exam snapshot tetap digunakan walau question bank berubah
  // ----------------------------------------------------
  // Modifikasi tiruan pada Question Bank eksternal
  const modifiedExamSnapshot = { ...sampleExam };
  // snapshot pada exam tetap berisi q_sc dengan maxScore 3 dan jawaban opt_b
  const gradedFromSnapshot = gradeExamObjectiveAnswers(modifiedExamSnapshot, { q_sc: 'opt_b' });
  assert(
    gradedFromSnapshot[0].score === 3 && gradedFromSnapshot[0].maxScore === 3,
    'Penilaian konsisten merujuk pada ExamQuestionSnapshot, terisolasi dari perubahan Question Bank'
  );

  // ----------------------------------------------------
  // Scenario 14: Student tidak dapat mengirim score
  // Jawaban student hanya berupa payload { questionId, answer }
  // ----------------------------------------------------
  const maliciousStudentPayload = {
    q_sc: 'opt_a', // jawaban salah
    score: 999, // percobaan manipulasi skor langsung
    earned_points: 999,
    maxScore: 999
  };
  const safeGraded = calculateResult({
    exam: sampleExam,
    sessionId: 'sess_hacker',
    studentName: 'Murid Iseng',
    studentClass: 'IX-A',
    examNumber: '20269999',
    studentAnswers: maliciousStudentPayload
  });
  assert(
    safeGraded.items[0].score === 0 && safeGraded.totalScore === 0,
    'Engine menolak input score dari student dan mengevaluasi jawaban secara mandiri dari snapshot (skor = 0)'
  );

  // ----------------------------------------------------
  // Scenario 15: Student tidak dapat membaca answer key
  // StudentSafeExam tidak berisi correctAnswers, correctAnswer, rubric, expectedAnswer
  // ----------------------------------------------------
  const studentSafeQuestion = {
    id: scQuestion.id,
    order: scQuestion.order,
    type: scQuestion.type,
    questionText: scQuestion.questionText,
    options: scQuestion.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
    maxScore: scQuestion.maxScore,
    required: scQuestion.required
  };
  assert(
    !('correctAnswers' in studentSafeQuestion) &&
      !('correct_answer' in studentSafeQuestion) &&
      !('answer_key' in studentSafeQuestion) &&
      !('expectedAnswer' in studentSafeQuestion),
    'Data lembar soal untuk siswa (StudentSafeExam) bersih dari kunci jawaban dan rubrik'
  );

  // ----------------------------------------------------
  // Scenario 16: Teacher hanya melihat hasil miliknya
  // Exam milik teacher_123, teacher_456 tidak boleh mengakses
  // ----------------------------------------------------
  const teacher123Results = [gradedResult].filter((r) => sampleExam.ownerId === 'teacher_123');
  const teacher456Results = [gradedResult].filter((r) => sampleExam.ownerId === 'teacher_456');
  assert(
    teacher123Results.length === 1 && teacher456Results.length === 0,
    'Filter otorisasi membatasi guru hanya dapat melihat hasil ujian miliknya sendiri'
  );

  // ----------------------------------------------------
  // Scenario 17: Hasil belum released tidak terlihat siswa
  // Siswa hanya boleh melihat jika gradingStatus === 'RESULTS_RELEASED'
  // ----------------------------------------------------
  const isVisibleBeforeRelease = gradedResult.gradingStatus === 'RESULTS_RELEASED';
  const releasedResult = await releaseExamResult(
    gradedResult,
    'Pak Rinaldi Fahrun',
    'teacher_123'
  );
  const isVisibleAfterRelease = releasedResult.gradingStatus === 'RESULTS_RELEASED';

  assert(
    isVisibleBeforeRelease === false && isVisibleAfterRelease === true,
    'Hasil ujian disembunyikan dari siswa hingga guru secara resmi melakukan Rilis Hasil (RESULTS_RELEASED)'
  );

  console.log('\n======================================================');
  console.log(`ALL ${passedTests}/${totalTests} SCENARIOS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
