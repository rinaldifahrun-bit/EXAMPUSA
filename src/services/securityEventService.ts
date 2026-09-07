import type { SecurityEvent, SecurityEventType } from '../types';
import { db } from '../lib/dexie';

const SECURITY_EVENTS_KEY = 'sp1_puspo_security_events';

export function getStoredSecurityEvents(): SecurityEvent[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(SECURITY_EVENTS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error('Error loading security events', e);
  }
  return [];
}

export function saveStoredSecurityEvents(events: SecurityEvent[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SECURITY_EVENTS_KEY, JSON.stringify(events));
    }
  } catch (e) {
    console.error('Error saving security events', e);
  }
}

export async function logSecurityEvent(
  sessionId: string,
  examId: string,
  studentId: string,
  studentName: string,
  eventType: SecurityEventType,
  severity: 'info' | 'warning' = 'info',
  details?: string
): Promise<SecurityEvent> {
  const event: SecurityEvent = {
    id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    session_id: sessionId,
    exam_id: examId,
    student_id: studentId,
    student_name: studentName,
    event_type: eventType,
    severity,
    metadata: {
      details,
      device: typeof navigator !== 'undefined' ? navigator.userAgent : 'EXAMPUSA System'
    },
    created_at: new Date().toISOString(),
    synced: true
  };

  try {
    await db.securityEvents.put(event);
  } catch (e) {
    console.error('Failed to log security event in Dexie', e);
  }

  const all = getStoredSecurityEvents();
  all.unshift(event);
  saveStoredSecurityEvents(all.slice(0, 100)); // keep last 100

  return event;
}
