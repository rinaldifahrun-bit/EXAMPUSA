import type { Exam, StudentExamCredentials, UserProfile } from '../types';
import { getStoredExams } from './examService';
import { startOrCreateStudentSession } from './examSessionService';

/**
 * Student Authentication & Exam Session Service
 * 
 * In SP1 PUSPO EXAM, students authenticate on a per-exam basis using:
 * - Full Name (Nama Lengkap)
 * - Class (Kelas)
 * - Exam Number (Nomor Ujian yang ditentukan sekolah - strictly preserved)
 * - Exam Token / PIN (Token Ujian)
 * 
 * This separates student transient exam sessions from staff permanent credentials.
 */

export interface StudentAuthResult {
  student: UserProfile;
  exam: Exam;
}

export async function authenticateStudentForExam(
  creds: StudentExamCredentials,
  allExams?: Exam[]
): Promise<StudentAuthResult> {
  const cleanToken = creds.token?.trim().toUpperCase() || '';

  if (!cleanToken) {
    throw new Error('PIN / Token Ujian wajib diisi.');
  }

  const exams = allExams && allExams.length > 0 ? allExams : getStoredExams();

  // Find matching active exam by PIN / token
  const matchedExam = exams.find(
    (e) => (e.pin || e.examToken || '').trim().toUpperCase() === cleanToken
  );

  if (!matchedExam) {
    throw new Error('PIN / Token Ujian tidak ditemukan. Pastikan token sudah benar dari pengawas.');
  }

  // Validate lifecycle status rigorously
  const rawStatus = String(matchedExam.status || 'DRAFT').toUpperCase();
  if (rawStatus === 'CANCELLED') {
    throw new Error('Pelaksanaan ujian ini telah dibatalkan oleh pihak sekolah atau pengawas.');
  }

  if (['COMPLETED', 'FINISHED', 'ARCHIVED', 'GRADED', 'RESULTS_RELEASED'].includes(rawStatus)) {
    throw new Error('Waktu pelaksanaan paket ujian ini telah selesai / ditutup.');
  }

  if (rawStatus === 'DRAFT') {
    throw new Error('Ujian ini masih dalam status Draf dan belum dibuka oleh guru pengampu.');
  }

  if (rawStatus === 'SCHEDULED') {
    const startTimeStr = matchedExam.startAt || matchedExam.start_at;
    if (startTimeStr) {
      const startTime = new Date(startTimeStr);
      if (new Date() < startTime) {
        const timeFormatted = startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        throw new Error(`Ujian ini berstatus Terjadwal dan baru dibuka pada pukul ${timeFormatted} WIB.`);
      }
    } else {
      throw new Error('Ujian ini masih berstatus Terjadwal dan belum diaktifkan oleh pengawas.');
    }
  }

  // Check endAt schedule window
  const endAtStr = matchedExam.endAt || matchedExam.end_at;
  if (endAtStr) {
    const endTime = new Date(endAtStr);
    if (!isNaN(endTime.getTime()) && new Date() > endTime) {
      throw new Error('Batas akhir pelaksanaan ujian telah terlewat.');
    }
  }

  // Handle student identification: optional, defaulted to anonymous session
  const cleanName = creds.fullName?.trim() || 'Peserta Ujian';
  const cleanClass = creds.className?.trim() || matchedExam.className || (matchedExam.class_names?.[0] || 'Umum');
  const cleanExamNumber = creds.examNumber?.trim() || `anon_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Validate Class restriction only if student explicitly provided class
  if (
    creds.className &&
    matchedExam.class_names &&
    matchedExam.class_names.length > 0 &&
    !matchedExam.class_names.includes(creds.className)
  ) {
    throw new Error(
      `Ujian "${matchedExam.title}" tidak ditujukan untuk kelas ${creds.className}. Ujian ini hanya untuk kelas: ${matchedExam.class_names.join(', ')}.`
    );
  }

  // Create student UserProfile for local session management
  const studentUid = `student_${cleanExamNumber.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const studentProfile: UserProfile = {
    uid: studentUid,
    email: `${cleanExamNumber.toLowerCase()}@murid.sp1puspo.local`,
    displayName: cleanName,
    role: 'student',
    className: cleanClass,
    nis: cleanExamNumber,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  // Initialize or restore session in Dexie (local recovery guaranteed)
  try {
    await startOrCreateStudentSession(matchedExam, studentProfile);
  } catch (err) {
    console.warn('[StudentAuth] Peringatan saat inisialisasi sesi Dexie:', err);
  }

  return {
    student: studentProfile,
    exam: matchedExam
  };
}
