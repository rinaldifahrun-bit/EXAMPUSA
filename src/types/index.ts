export type UserRole = 'teacher' | 'student' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  nis?: string;
  nip?: string;
  username?: string;
  classId?: string;
  className?: string;
  subjectIds?: string[];
  classIds?: string[];
  avatarUrl?: string;
  phone?: string;
  status?: 'active' | 'suspended';
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentExamCredentials {
  token: string;
  fullName?: string;
  className?: string;
  examNumber?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  gradeLevel?: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade?: string;
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  gradeLevel?: number;
  totalStudents?: number;
}

export interface Teacher {
  id: string;
  uid?: string;
  nip: string;
  name: string;
  role: 'teacher';
  status: 'active' | 'inactive';
  subjectIds: string[];
  classIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignment {
  id: string;
  teacherId: string;
  subjectId: string;
  classIds: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false' | 'essay';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'hots';

export type QuestionStatus = 'draft' | 'reviewed' | 'ready';

export type QuestionSource = 'manual' | 'ai' | 'import';

export type CognitiveLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'unknown';

export interface QuestionOption {
  id: string; // "opt_xxx" or "A", "B", "C", "D", etc.
  text: string;
  imageRef?: string; // Optional image URL or base64 data
  score?: number; // Score for this option (critical for multiple_select / PG Kompleks)
  order: number;
}

export interface EssayRubricItem {
  id: string;
  criterion: string;
  maxScore: number;
  description?: string;
}

export interface QuestionBank {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName?: string;
  classId: string;
  className?: string;
  ownerId: string;
  ownerName?: string;
  status: 'draft' | 'ready' | 'archived';
  questionsCount: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  bankId?: string;
  bank_id?: string;
  owner_id: string;
  subject_id: string;
  subject_name?: string;
  class_id: string;
  class_name?: string;
  topic: string;
  learning_objective: string;
  question_type: QuestionType;
  question_text: string;
  imageRef?: string; // Optional question image URL or base64
  options: QuestionOption[];
  correct_answer: string[]; // ["opt_1"] for MC, ["opt_1", "opt_3"] for MS, ["true"] for TF
  answer_key?: string; // For essay guideline
  expectedAnswer?: string; // Expected answer for essay
  rubric?: string | EssayRubricItem[]; // For essay grading
  explanation?: string;
  difficulty: QuestionDifficulty;
  cognitive_level?: CognitiveLevel;
  points: number; // Max score / point value of this question
  required?: boolean; // Wajib diisi (default true)
  order?: number; // Sort order in Question Bank
  grading_method?: 'all_or_nothing' | 'partial_credit';
  status: QuestionStatus;
  source: QuestionSource;
  source_file_name?: string;
  source_page?: number;
  needs_review?: boolean;
  validation_notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type ExamLifecycleStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'GRADED'
  | 'RESULTS_RELEASED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type ExamStatus = ExamLifecycleStatus | 'draft' | 'scheduled' | 'active' | 'published' | 'finished' | 'archived';

export type ResultVisibility = 'immediately' | 'after_finalization' | 'hidden';

export type MultipleSelectScoring = 'exact_match' | 'partial_credit';

export interface ExamSettings {
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  allow_back_navigation?: boolean;
  secure_exam_mode?: boolean;
  max_attempts?: number;
  multiple_select_scoring?: MultipleSelectScoring;
  show_result_to_student?: ResultVisibility;
  passing_score: number; // e.g. 75
}

export interface ExamOptionSnapshot {
  id: string;
  text: string;
  imageUrl?: string;
  score?: number; // Score for this option (critical for multiple_select / PG Kompleks partial credit)
  order?: number;
}

export interface ExamQuestionSnapshot {
  id: string;
  sourceQuestionId?: string;
  order: number;
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'essay';
  questionText: string;
  imageUrl?: string;
  options?: ExamOptionSnapshot[];
  correctAnswers?: string[];
  expectedAnswer?: string;
  rubric?: string;
  maxScore: number;
  required: boolean;
}

export interface ExamSnapshotQuestion {
  id: string;
  question_id: string;
  order_number: number;
  points: number;
  question_type: QuestionType;
  question_text: string;
  options: QuestionOption[];
  correct_answer: string[]; // Kept server-side/teacher-side
  answer_key?: string;
  rubric?: string | EssayRubricItem[];
  grading_method?: 'all_or_nothing' | 'partial_credit';
}

/**
 * CRIT-01: Private document stored in examKeys/{examId}
 * NEVER accessible to students. Contains complete authoritative question snapshots with answer keys.
 */
export interface ExamKeyDocument {
  id: string; // examId
  examId: string;
  ownerId: string;
  examToken: string;
  title: string;
  durationMinutes: number;
  startAt?: string | null;
  endAt?: string | null;
  totalPoints: number;
  questions: ExamQuestionSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  ownerId?: string;
  owner_id?: string;
  ownerName?: string;
  owner_name?: string;

  title: string;
  description?: string;

  subjectId?: string;
  subject_id?: string;
  subjectName?: string;
  subject_name?: string;

  classId?: string;
  class_id?: string;
  classIds?: string[];
  class_ids?: string[];
  className?: string;
  class_name?: string;
  class_names?: string[];

  status: ExamLifecycleStatus | ExamStatus;

  questionIds?: string[];
  questions?: ExamQuestionSnapshot[];
  questions_snapshot?: ExamSnapshotQuestion[];

  durationMinutes?: number;
  duration_minutes?: number;

  startAt?: string;
  start_at?: string;
  endAt?: string;
  end_at?: string;

  examToken?: string;
  pin?: string;

  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  settings?: ExamSettings;

  totalQuestions?: number;
  total_questions?: number;
  totalPoints?: number;
  total_points?: number;
  composition?: {
    multiple_choice: number;
    multiple_select: number;
    true_false: number;
    essay: number;
  };

  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;

  publishedAt?: string;
  published_at?: string;
  activatedAt?: string;
  completedAt?: string;
}

// Student-Safe Projection Types (Requirement 15: ZERO answer keys, ZERO option scores, ZERO grading rubrics)
export interface StudentExamOption {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface StudentExamQuestion {
  id: string;
  order: number;
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'essay';
  questionText: string;
  imageUrl?: string;
  options: StudentExamOption[];
  required: boolean;
}

export interface StudentSafeExam {
  id: string;
  examToken: string;
  title: string;
  description?: string;
  subjectName: string;
  className: string;
  classNames?: string[];
  durationMinutes: number;
  startAt?: string;
  endAt?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questions: StudentExamQuestion[];
  totalQuestions: number;
  status: ExamLifecycleStatus | ExamStatus;
}

export type ExamSessionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EXPIRED'
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'expired';

export interface ExamSession {
  id: string;
  examId: string;
  exam_id?: string;
  examTitle?: string;
  exam_title?: string;
  examToken?: string;
  isAnonymous?: boolean;
  studentName?: string;
  student_name?: string;
  classId?: string;
  studentClass?: string;
  student_class?: string;
  examNumber?: string;
  student_nis?: string;
  student_id?: string;
  sessionToken?: string;
  status: ExamSessionStatus;
  startedAt: string;
  started_at?: string;
  expiresAt: string;
  expires_at?: string;
  serverStartTime?: number;
  serverExpiresTime?: number;
  submittedAt?: string;
  submitted_at?: string;
  lastSavedAt?: string;
  last_saved_at?: string;
  questionOrder: string[];
  question_order?: string[];
  optionOrders: Record<string, string[]>;
  option_orders?: Record<string, string[]>;
  current_question_index?: number;
  last_sync?: string;
  server_time_offset?: number;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  // Stage 8.3 Operational & Session Recovery Fields
  isLocked?: boolean;
  lockReason?: string;
  allowRelogin?: boolean;
  unlockedAt?: string;
  unlockedBy?: string;
  forceSubmittedAt?: string;
  forceSubmittedBy?: string;
  answersCount?: number;
}

export type SyncStatus =
  | 'LOCAL_ONLY'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_FAILED'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error';

export interface StudentAnswer {
  id: string; // `${sessionId}_${questionId}`
  sessionId?: string;
  session_id?: string;
  examId?: string;
  exam_id?: string;
  studentId?: string;
  student_id?: string;
  questionId?: string;
  question_id?: string;
  answer: string | string[] | boolean | null;
  syncStatus?: SyncStatus;
  sync_status?: SyncStatus;
  updatedAt?: string;
  updated_at?: string;
}

export type SecurityEventType =
  | 'fullscreen_enter'
  | 'fullscreen_exit'
  | 'fullscreen_unsupported'
  | 'visibility_hidden'
  | 'visibility_visible'
  | 'window_blur'
  | 'window_focus'
  | 'connection_lost'
  | 'connection_restored'
  | 'page_reload'
  | 'navigation_attempt'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'context_menu_attempt'
  | 'clock_tamper'
  // Stage 7 Grading & Security Audit Events
  | 'automatic_grading_completed'
  | 'essay_score_created'
  | 'essay_score_updated'
  | 'result_finalized'
  | 'result_released'
  | 'result_release_cancelled'
  | 'unauthorized_grading_attempt'
  | 'invalid_score_attempt'
  // Stage 8 Admin Audit Events
  | 'admin_lifecycle_transition'
  | 'admin_exam_duplicated'
  | 'admin_exam_archived'
  | 'admin_override_action'
  | 'admin_view_result_detail'
  | 'admin_export_results'
  // Stage 8.3 Operational Events
  | 'admin_regenerate_token'
  | 'admin_emergency_time_added'
  | 'admin_session_unlocked'
  | 'admin_force_submit';

export interface SecurityEvent {
  id: string;
  session_id: string;
  exam_id: string;
  student_id: string;
  student_name?: string;
  event_type: SecurityEventType;
  severity: 'info' | 'warning';
  metadata?: {
    device?: string;
    details?: string;
  };
  created_at: string;
  synced?: boolean;
}

// Stage 7: Results & Grading Types
export type ExamResultGradingStatus =
  | 'NOT_GRADED'
  | 'NEEDS_GRADING'
  | 'GRADED'
  | 'RESULTS_RELEASED'
  | 'pending'
  | 'awaiting_manual_grading'
  | 'finalized';

export type ResultGradingStatus = ExamResultGradingStatus;

export interface GradedAnswer {
  questionId?: string;
  questionNumber?: number;
  questionType?: 'single_choice' | 'multiple_choice' | 'multiple_select' | 'true_false' | 'essay' | QuestionType;
  questionText?: string;
  answer?: string | string[] | boolean | null;
  correctAnswer?: string[] | string; // scoring reference / answer key (TEACHER/ADMIN ONLY, NEVER SENT TO STUDENT)
  score?: number;
  maxScore?: number;
  gradingStatus?: 'NOT_GRADED' | 'NEEDS_GRADING' | 'GRADED' | 'graded' | 'awaiting';
  teacherFeedback?: string;
  gradedAt?: string;
  gradedBy?: string;
  graded_by?: string;
  options?: ExamOptionSnapshot[];
  // Backwards compatibility with ExamResultItem
  question_id?: string;
  question_number?: number;
  question_type?: QuestionType;
  question_text?: string;
  student_answer?: string | string[] | boolean | null;
  correct_answer?: string[];
  answer_key?: string;
  max_points?: number;
  earned_points?: number;
  is_correct?: boolean;
  is_partial?: boolean;
  grading_status?: 'graded' | 'awaiting';
  teacher_feedback?: string;
  graded_at?: string;
}

export type ExamResultItem = GradedAnswer;

export interface ExamResult {
  id: string; // `${examId}_${studentId}`
  examId?: string;
  exam_id?: string;
  sessionId?: string;
  session_id?: string;
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  classId?: string;
  studentClass?: string;
  student_class?: string;
  studentNis?: string;
  student_nis?: string;
  examNumber?: string;
  objectiveScore?: number;
  objective_points?: number;
  essayScore?: number;
  essay_points?: number;
  totalScore?: number;
  earned_points?: number;
  maxScore?: number;
  total_points?: number;
  percentage: number; // 0 - 100 with 2 decimals
  gradedQuestionCount?: number;
  totalQuestionCount?: number;
  total_questions?: number;
  gradingStatus?: ExamResultGradingStatus;
  status?: ExamResultGradingStatus;
  startedAt?: string;
  started_at?: string;
  submittedAt?: string;
  submitted_at?: string;
  gradedAt?: string;
  finalizedAt?: string;
  finalized_at?: string;
  gradedBy?: string;
  releasedAt?: string;
  releasedBy?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  items: GradedAnswer[];
  // Backwards compatibility helpers
  correct_count?: number;
  wrong_count?: number;
  unanswered_count?: number;
  essay_count?: number;
  grade?: 'A' | 'B' | 'C' | 'D';
  passed?: boolean;
  duration_seconds?: number;
  exam_title?: string;
  subject_name?: string;
}

export interface QuestionAnalysisData {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options?: QuestionOption[];
  correct_answer?: string[];
  max_points: number;
  total_attempts: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  correct_percentage: number;
  average_score: number;
  option_distribution: Record<string, number>; // e.g. "A": 12, "B": 24, "C": 3, "D": 1
  difficulty_index: 'Mudah' | 'Sedang' | 'Sukar';
}

export interface ExamStatistics {
  total_participants: number;
  submitted_count: number;
  in_progress_count: number;
  not_started_count: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  median_score: number;
  passed_count: number;
  failed_count: number;
  passing_rate: number;
  awaiting_grading_count: number;
  grade_distribution: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
}
