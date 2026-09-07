import Dexie, { type Table } from 'dexie';
import type { StudentAnswer, ExamSession, SecurityEvent, QuestionBank, Question, Exam, StudentSafeExam, ExamResult } from '../types';

export interface LocalSyncQueueItem {
  id: string;
  entityType: 'answer' | 'session' | 'security_event' | 'question_bank' | 'exam';
  entityId: string;
  payload: any;
  retryCount: number;
  lastAttempt: string;
  createdAt: string;
}

export interface LocalMetadataItem {
  key: string;
  value: any;
  updatedAt: string;
}

export interface LocalCachedExam {
  id: string;
  data: any;
  cachedAt: string;
}

export class ExamDexieDatabase extends Dexie {
  examSessions!: Table<ExamSession, string>;
  answers!: Table<StudentAnswer, string>;
  syncQueue!: Table<LocalSyncQueueItem, string>;
  securityEvents!: Table<SecurityEvent, string>;
  metadata!: Table<LocalMetadataItem, string>;
  cachedExams!: Table<LocalCachedExam, string>;
  questionBanks!: Table<QuestionBank, string>;
  questionDrafts!: Table<Question, string>;
  examDrafts!: Table<Exam, string>;
  studentSafeExams!: Table<StudentSafeExam, string>;
  examResults!: Table<ExamResult, string>;

  constructor() {
    super('SP1PuspoExamDB');
    this.version(1).stores({
      examSessions: 'id, exam_id, student_id, status',
      answers: 'id, session_id, exam_id, question_id, sync_status',
      syncQueue: 'id, entityType, entityId, createdAt',
      securityEvents: 'id, session_id, exam_id, synced',
      metadata: 'key',
      cachedExams: 'id'
    });

    this.version(2).stores({
      questionBanks: 'id, ownerId, subjectId, classId, status, updatedAt',
      questionDrafts: 'id, bankId, owner_id, order, updated_at'
    });

    this.version(3).stores({
      examDrafts: 'id, ownerId, subjectId, classId, status, updatedAt'
    });

    this.version(4).stores({
      studentSafeExams: 'id, examToken',
      examSessions: 'id, examId, exam_id, student_id, examNumber, status',
      answers: 'id, sessionId, session_id, examId, exam_id, questionId, question_id, syncStatus, sync_status'
    });

    this.version(5).stores({
      examResults: 'id, examId, exam_id, sessionId, session_id, studentName, examNumber, gradingStatus, status'
    });
  }
}

export const db = new ExamDexieDatabase();
