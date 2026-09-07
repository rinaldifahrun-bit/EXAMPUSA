import { db as dexieDb } from '../lib/dexie';
import { db as firestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ExamResult, Exam } from '../types';
import { mockResults, mockExams } from '../data/mockData';
import { recordAdminAuditEvent, getStoredExams } from './examService';

export interface AdminResultFilters {
  examId?: string;
  teacherId?: string;
  subjectId?: string;
  classId?: string;
  status?: string;
  searchQuery?: string;
}

/**
 * Fetch all exam results across all teachers and exams for Administrator.
 * Uses authoritative server endpoint with role-based validation.
 */
export async function fetchAdminResults(
  filters?: AdminResultFilters,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA'
): Promise<ExamResult[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.examId && filters.examId !== 'all') params.append('examId', filters.examId);
    if (filters?.teacherId && filters.teacherId !== 'all') params.append('teacherId', filters.teacherId);
    if (filters?.subjectId && filters.subjectId !== 'all') params.append('subjectId', filters.subjectId);
    if (filters?.classId && filters.classId !== 'all') params.append('classId', filters.classId);
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.searchQuery && filters.searchQuery.trim()) params.append('search', filters.searchQuery.trim());

    const url = `/api/admin/results${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('[AdminResultService] Server fetch failed, falling back to local stores:', err);
  }

  // Fallback to local Dexie / Firestore / mockResults
  let localResults: ExamResult[] = [];
  try {
    const dexieResults = await dexieDb.examResults.toArray();
    if (dexieResults && dexieResults.length > 0) {
      localResults = dexieResults;
    }
  } catch {
    // Dexie may fail in non-browser environments
  }

  if (localResults.length === 0 && isFirebaseConfigured() && firestoreDb) {
    try {
      const snap = await getDocs(collection(firestoreDb, 'results'));
      if (!snap.empty) {
        localResults = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
      }
    } catch {
      // Offline fallback
    }
  }

  // If still empty, use mockResults
  if (localResults.length === 0) {
    localResults = [...mockResults];
  }

  // Enrich with local exam metadata
  const exams = getStoredExams();
  const examMap = new Map<string, Exam>();
  for (const ex of [...exams, ...mockExams]) {
    if (!examMap.has(ex.id)) {
      examMap.set(ex.id, ex);
    }
  }

  let enriched = localResults.map(r => {
    const exam = examMap.get(r.examId || r.exam_id || '');
    const teacherName = exam?.ownerName || exam?.owner_name || (r as any).teacherName || (r as any).owner_name || 'Bpk. Hendra Pratama, S.Kom.';
    const teacherId = exam?.ownerId || exam?.owner_id || (r as any).teacherId || 'teacher_1';
    const examTitle = exam?.title || r.exam_title || (r as any).examTitle || 'Ujian Sekolah';
    const subjectName = exam?.subjectName || exam?.subject_name || r.subject_name || (r as any).subjectName || 'Mata Pelajaran';
    const studentClass = r.studentClass || r.student_class || exam?.className || 'Umum';
    const studentName = r.studentName || r.student_name || 'Peserta Ujian';
    const examNumber = r.examNumber || r.student_nis || (r as any).studentNis || '-';

    return {
      ...r,
      examTitle,
      exam_title: examTitle,
      subjectName,
      subject_name: subjectName,
      teacherName,
      teacher_name: teacherName,
      teacherId,
      studentClass,
      student_class: studentClass,
      className: studentClass,
      studentName,
      student_name: studentName,
      examNumber,
      student_nis: examNumber
    };
  });

  // Client-side filtering for fallback
  if (filters?.examId && filters.examId !== 'all') {
    enriched = enriched.filter(r => (r.examId === filters.examId || r.exam_id === filters.examId));
  }
  if (filters?.teacherId && filters.teacherId !== 'all') {
    enriched = enriched.filter(r => (r as any).teacherId === filters.teacherId);
  }
  if (filters?.subjectId && filters.subjectId !== 'all') {
    enriched = enriched.filter(r => (r as any).subjectName === filters.subjectId || (r as any).subjectId === filters.subjectId);
  }
  if (filters?.classId && filters.classId !== 'all') {
    enriched = enriched.filter(r => (r as any).studentClass === filters.classId);
  }
  if (filters?.status && filters.status !== 'all') {
    const filterStatus = filters.status.toUpperCase();
    enriched = enriched.filter(r => {
      const st = String(r.gradingStatus || r.status || '').toUpperCase();
      if (filterStatus === 'NEEDS_GRADING') return st === 'NEEDS_GRADING' || st === 'AWAITING' || st === 'AWAITING_MANUAL_GRADING';
      if (filterStatus === 'GRADED') return st === 'GRADED' || st === 'FINALIZED';
      if (filterStatus === 'RESULTS_RELEASED') return st === 'RESULTS_RELEASED';
      return st === filterStatus;
    });
  }
  if (filters?.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    enriched = enriched.filter(r =>
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.student_name && r.student_name.toLowerCase().includes(q)) ||
      ((r as any).examNumber && (r as any).examNumber.toLowerCase().includes(q)) ||
      (r.student_nis && r.student_nis.toLowerCase().includes(q)) ||
      ((r as any).examTitle && (r as any).examTitle.toLowerCase().includes(q)) ||
      (r.exam_title && r.exam_title.toLowerCase().includes(q))
    );
  }

  return enriched;
}

/**
 * Fetch detailed view for a single ExamResult with audit trail recording.
 */
export async function fetchAdminResultDetail(
  resultId: string,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA'
): Promise<ExamResult | null> {
  try {
    const response = await fetch(`/api/admin/result/${resultId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.result) {
        return data.result;
      }
    }
  } catch (err) {
    console.warn('[AdminResultService] Server fetch single result failed:', err);
  }

  // Fallback
  const all = await fetchAdminResults(undefined, adminId, adminName);
  const found = all.find(r => r.id === resultId || r.sessionId === resultId || (r as any).session_id === resultId);
  if (found) {
    recordAdminAuditEvent(adminId, 'admin_view_result_detail', found.examId || found.exam_id || 'unknown', {
      resultId,
      studentName: found.studentName || found.student_name,
      description: `Admin ${adminName} membuka detail hasil ujian peserta ${found.studentName || found.student_name}`
    }).catch(() => {});
    return found;
  }
  return null;
}

/**
 * Log export event to server and local security audit logs.
 */
export async function logAdminExportAudit(
  recordCount: number,
  filters: any,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA'
): Promise<void> {
  try {
    await fetch('/api/admin/results/export-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      },
      body: JSON.stringify({ recordCount, filters })
    });
  } catch (err) {
    console.warn('[AdminResultService] Server export audit logging failed:', err);
  }

  // Also log to local/Dexie/Firestore
  recordAdminAuditEvent(adminId, 'admin_export_results', filters?.examId || 'all_exams', {
    recordCount,
    filters,
    description: `Admin ${adminName} mengekspor ${recordCount} data hasil ujian ke Excel`
  }).catch(() => {});
}
