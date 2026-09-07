import { db as dexieDb } from '../lib/dexie';
import type { ExamSession, Exam, SecurityEvent } from '../types';
import { getStoredExams, updateExam } from './examService';

export interface EnrichedOperationalSession extends ExamSession {
  examTitle?: string;
  subjectName?: string;
  className?: string;
  ownerName?: string;
  answersCount?: number;
  isExpired?: boolean;
}

export interface OperationalAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  examId?: string;
  examTitle?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Fetch all active student sessions for operational control and monitoring.
 */
export async function fetchOperationalSessions(
  examId?: string,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA'
): Promise<EnrichedOperationalSession[]> {
  try {
    const url = `/api/admin/operational/sessions${examId && examId !== 'all' ? `?examId=${encodeURIComponent(examId)}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        return data.sessions;
      }
    }
  } catch (err) {
    console.warn('[AdminOperational] Server session fetch failed, falling back to local Dexie/cache:', err);
  }

  // Local fallback: read from Dexie db.examSessions
  try {
    const localSessions = await dexieDb.examSessions.toArray();
    const storedExams = getStoredExams();
    const examMap = new Map<string, Exam>(storedExams.map(e => [e.id, e]));

    let filtered = localSessions;
    if (examId && examId !== 'all') {
      filtered = filtered.filter(s => s.examId === examId || s.exam_id === examId);
    }

    // Count answers per session from Dexie
    const allAnswers = await dexieDb.answers.toArray();

    return filtered.map(sess => {
      const targetExam = examMap.get(sess.examId || sess.exam_id || '');
      const answersForSession = allAnswers.filter(a => a.sessionId === sess.id || a.session_id === sess.id);
      const expiresMs = sess.serverExpiresTime || (sess.expiresAt ? new Date(sess.expiresAt).getTime() : 0);

      return {
        ...sess,
        examTitle: targetExam?.title || sess.examTitle || sess.exam_title || 'Ujian Sekolah',
        subjectName: targetExam?.subjectName || targetExam?.subject_name || 'Mata Pelajaran',
        className: sess.studentClass || sess.student_class || targetExam?.className || 'Umum',
        ownerName: targetExam?.ownerName || targetExam?.owner_name || 'Guru Pengampu',
        answersCount: answersForSession.length,
        isExpired: expiresMs > 0 ? Date.now() > expiresMs : false
      };
    });
  } catch (dexieErr) {
    console.error('[AdminOperational] Local Dexie fallback error:', dexieErr);
    return [];
  }
}

/**
 * Unlock a locked or disconnected student session to allow re-login.
 */
export async function unlockStudentSession(
  sessionId: string,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA',
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/admin/session/${encodeURIComponent(sessionId)}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      },
      body: JSON.stringify({ reason })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // Also update local Dexie record if available
        await updateLocalSessionLock(sessionId, false, adminName);
        return { success: true, message: data.message };
      }
    }
  } catch (err) {
    console.warn('[AdminOperational] Server unlock failed, attempting local fallback:', err);
  }

  // Local fallback
  await updateLocalSessionLock(sessionId, false, adminName);
  return { success: true, message: 'Kunci sesi berhasil dibuka (Mode Lokal). Siswa dapat masuk kembali.' };
}

/**
 * Force submit an in-progress session.
 */
export async function forceSubmitStudentSession(
  sessionId: string,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA',
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/admin/session/${encodeURIComponent(sessionId)}/force-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      },
      body: JSON.stringify({ reason })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // Update local Dexie session status
        await updateLocalSessionSubmit(sessionId, adminName);
        return { success: true, message: data.message };
      }
    }
  } catch (err) {
    console.warn('[AdminOperational] Server force-submit failed, attempting local fallback:', err);
  }

  // Local fallback
  await updateLocalSessionSubmit(sessionId, adminName);
  return { success: true, message: 'Sesi berhasil dikumpulkan paksa oleh Administrator (Mode Lokal).' };
}

/**
 * Regenerate Exam Token PIN for an active exam.
 */
export async function regenerateExamToken(
  examId: string,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA',
  reason?: string
): Promise<{ success: boolean; newToken: string; message: string }> {
  try {
    const res = await fetch(`/api/admin/exam/${encodeURIComponent(examId)}/regenerate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      },
      body: JSON.stringify({ reason })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.newToken) {
        // Synchronize with local stored exams
        updateExam(examId, { pin: data.newToken, examToken: data.newToken });
        return {
          success: true,
          newToken: data.newToken,
          message: data.message || `Token berhasil diperbarui: ${data.newToken}`
        };
      }
    }
  } catch (err) {
    console.warn('[AdminOperational] Server regenerate token failed, attempting local fallback:', err);
  }

  // Local fallback token generator
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let newToken = '';
  for (let i = 0; i < 6; i++) {
    newToken += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  updateExam(examId, { pin: newToken, examToken: newToken });
  await recordLocalSecurityEvent('admin_regenerate_token', examId, `Token baru lokal: ${newToken}`);

  return {
    success: true,
    newToken,
    message: `Token PIN darurat berhasil dibuat: ${newToken}`
  };
}

/**
 * Add emergency time (+15, +30 mins) to an active exam and all ongoing student sessions.
 */
export async function addEmergencyTime(
  examId: string,
  minutes: number,
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA',
  reason?: string
): Promise<{ success: boolean; newDuration: number; message: string }> {
  try {
    const res = await fetch(`/api/admin/exam/${encodeURIComponent(examId)}/add-emergency-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      },
      body: JSON.stringify({ minutes, reason })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // Also update local stores
        await extendLocalExamAndSessions(examId, minutes);
        return {
          success: true,
          newDuration: data.newDurationMinutes,
          message: data.message
        };
      }
    }
  } catch (err) {
    console.warn('[AdminOperational] Server emergency time failed, attempting local fallback:', err);
  }

  // Local fallback
  const newDuration = await extendLocalExamAndSessions(examId, minutes);
  return {
    success: true,
    newDuration,
    message: `Durasi darurat +${minutes} menit berhasil ditambahkan (Mode Lokal).`
  };
}

/**
 * Fetch operational audit logs.
 */
export async function fetchOperationalAuditLogs(
  adminId: string = 'admin_1',
  adminName: string = 'Administrator EXAMPUSA'
): Promise<OperationalAuditLog[]> {
  try {
    const res = await fetch('/api/admin/audit-logs', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
        'x-user-id': adminId,
        'x-user-name': adminName
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        return data.logs.filter((log: any) =>
          [
            'admin_session_unlocked',
            'admin_force_submit',
            'admin_regenerate_token',
            'admin_emergency_time_added'
          ].includes(log.action)
        );
      }
    }
  } catch (err) {
    console.warn('[AdminOperational] Server audit logs fetch failed:', err);
  }

  return [];
}

// -------------------------------------------------------------
// INTERNAL LOCAL HELPERS
// -------------------------------------------------------------

async function updateLocalSessionLock(sessionId: string, isLocked: boolean, adminName: string) {
  try {
    const session = await dexieDb.examSessions.get(sessionId);
    if (session) {
      const now = new Date().toISOString();
      await dexieDb.examSessions.update(sessionId, {
        isLocked,
        allowRelogin: !isLocked,
        unlockedAt: !isLocked ? now : undefined,
        unlockedBy: !isLocked ? adminName : undefined,
        updatedAt: now,
        updated_at: now
      });
    }
  } catch (e) {
    console.warn('[AdminOperational] Could not update local session lock in Dexie:', e);
  }
}

async function updateLocalSessionSubmit(sessionId: string, adminName: string) {
  try {
    const session = await dexieDb.examSessions.get(sessionId);
    if (session) {
      const now = new Date().toISOString();
      await dexieDb.examSessions.update(sessionId, {
        status: 'SUBMITTED',
        submittedAt: now,
        submitted_at: now,
        forceSubmittedAt: now,
        forceSubmittedBy: adminName,
        updatedAt: now,
        updated_at: now
      });
    }
  } catch (e) {
    console.warn('[AdminOperational] Could not update local session submit in Dexie:', e);
  }
}

async function extendLocalExamAndSessions(examId: string, minutes: number): Promise<number> {
  let newDuration = 60;
  const storedExams = getStoredExams();
  const exam = storedExams.find(e => e.id === examId);
  if (exam) {
    newDuration = (exam.durationMinutes || 60) + minutes;
    updateExam(examId, { durationMinutes: newDuration });
  }

  try {
    const additionalMs = minutes * 60 * 1000;
    const now = new Date().toISOString();
    const sessions = await dexieDb.examSessions
      .where('status')
      .equals('IN_PROGRESS')
      .toArray();

    for (const sess of sessions) {
      if (sess.examId === examId || sess.exam_id === examId) {
        const currentExpiresMs = sess.serverExpiresTime || (sess.expiresAt ? new Date(sess.expiresAt).getTime() : Date.now());
        const newExpiresMs = currentExpiresMs + additionalMs;
        await dexieDb.examSessions.update(sess.id, {
          serverExpiresTime: newExpiresMs,
          expiresAt: new Date(newExpiresMs).toISOString(),
          expires_at: new Date(newExpiresMs).toISOString(),
          updatedAt: now,
          updated_at: now
        });
      }
    }
  } catch (e) {
    console.warn('[AdminOperational] Error updating local session times in Dexie:', e);
  }

  return newDuration;
}

async function recordLocalSecurityEvent(action: any, examId: string, details: string) {
  try {
    const event: SecurityEvent = {
      id: `local_audit_${Date.now()}`,
      session_id: 'admin_action',
      exam_id: examId,
      event_type: action,
      timestamp: new Date().toISOString(),
      details,
      synced: false
    };
    await dexieDb.securityEvents.add(event);
  } catch {
    // Silent
  }
}
