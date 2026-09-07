import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import type { Subject, SchoolClass, Teacher, TeacherAssignment } from '../types';

// Storage keys for local-first fallback & sandbox mode
const STORAGE_KEY_SUBJECTS = 'exampusa_subjects_v1';
const STORAGE_KEY_CLASSES = 'exampusa_classes_v1';
const STORAGE_KEY_TEACHERS = 'exampusa_teachers_v1';
const STORAGE_KEY_ASSIGNMENTS = 'exampusa_assignments_v1';

// Seed demo data (clearly marked as initial seed)
export const SEED_SUBJECTS: Subject[] = [
  { id: 'subj_inf', name: 'Informatika', code: 'INF', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_bin', name: 'Bahasa Indonesia', code: 'BIN', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_mat', name: 'Matematika', code: 'MAT', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_ipa', name: 'Ilmu Pengetahuan Alam (IPA)', code: 'IPA', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_ips', name: 'Ilmu Pengetahuan Sosial (IPS)', code: 'IPS', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_big', name: 'Bahasa Inggris', code: 'BIG', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_ppn', name: 'Pendidikan Pancasila', code: 'PPN', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'subj_pky', name: 'Prakarya', code: 'PKY', status: 'active', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' }
];

export const SEED_CLASSES: SchoolClass[] = [
  { id: 'cls_7a', name: 'VII-A', grade: 'VII', status: 'active', totalStudents: 32, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'cls_7b', name: 'VII-B', grade: 'VII', status: 'active', totalStudents: 32, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'cls_8a', name: 'VIII-A', grade: 'VIII', status: 'active', totalStudents: 34, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'cls_8b', name: 'VIII-B', grade: 'VIII', status: 'active', totalStudents: 33, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'cls_9a', name: 'IX-A', grade: 'IX', status: 'active', totalStudents: 32, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' },
  { id: 'cls_9b', name: 'IX-B', grade: 'IX', status: 'active', totalStudents: 30, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z' }
];

export const SEED_TEACHERS: Teacher[] = [
  {
    id: 'teacher_1',
    uid: 'teacher_1',
    nip: '198504122010011008',
    name: 'Bpk. Hendra Pratama, S.Kom.',
    role: 'teacher',
    status: 'active',
    subjectIds: ['subj_inf', 'subj_pky'],
    classIds: ['cls_7a', 'cls_8a', 'cls_9a'],
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'teacher_2',
    uid: 'teacher_2',
    nip: '198908232014022005',
    name: 'Ibu Rina Wulandari, S.Pd.',
    role: 'teacher',
    status: 'active',
    subjectIds: ['subj_mat'],
    classIds: ['cls_9a', 'cls_9b'],
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

export const SEED_ASSIGNMENTS: TeacherAssignment[] = [
  {
    id: 'asg_1',
    teacherId: 'teacher_1',
    subjectId: 'subj_inf',
    classIds: ['cls_7a', 'cls_8a', 'cls_9a'],
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'asg_2',
    teacherId: 'teacher_1',
    subjectId: 'subj_pky',
    classIds: ['cls_8a'],
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'asg_3',
    teacherId: 'teacher_2',
    subjectId: 'subj_mat',
    classIds: ['cls_9a', 'cls_9b'],
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z'
  }
];

// Helper: load local items
function loadLocal<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[Storage] Gagal membaca key ${key}:`, err);
  }
  return fallback;
}

function saveLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Storage] Gagal menyimpan key ${key}:`, err);
  }
}

// ===============================================================
// 1. MASTER MATA PELAJARAN (SUBJECTS)
// ===============================================================

export async function fetchSubjects(): Promise<Subject[]> {
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, 'subjects');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
        saveLocal(STORAGE_KEY_SUBJECTS, items);
        return items;
      }
    } catch (err) {
      console.warn('[Firestore] Gagal memuat subjects, beralih ke cache lokal:', err);
    }
  }
  return loadLocal<Subject>(STORAGE_KEY_SUBJECTS, SEED_SUBJECTS);
}

export async function createSubject(input: { name: string; code: string }): Promise<Subject> {
  const cleanName = input.name.trim();
  const cleanCode = input.code.trim().toUpperCase();

  if (!cleanName) throw new Error('Nama mata pelajaran tidak boleh kosong.');
  if (!cleanCode) throw new Error('Kode mata pelajaran tidak boleh kosong.');

  const existing = await fetchSubjects();
  if (existing.some((s) => s.code.toUpperCase() === cleanCode)) {
    throw new Error(`Kode mata pelajaran "${cleanCode}" sudah digunakan.`);
  }

  const now = new Date().toISOString();
  const id = `subj_${Date.now()}`;
  const newSubject: Subject = {
    id,
    name: cleanName,
    code: cleanCode,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'subjects', id);
      await setDoc(docRef, newSubject);
    } catch (err) {
      console.warn('[Firestore] Gagal menyimpan subject baru:', err);
    }
  }

  const list = loadLocal<Subject>(STORAGE_KEY_SUBJECTS, SEED_SUBJECTS);
  const updated = [newSubject, ...list];
  saveLocal(STORAGE_KEY_SUBJECTS, updated);

  return newSubject;
}

export async function updateSubject(
  id: string,
  input: { name?: string; code?: string; status?: 'active' | 'inactive' }
): Promise<Subject> {
  const subjects = await fetchSubjects();
  const idx = subjects.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Mata pelajaran tidak ditemukan.');

  const current = subjects[idx];
  const cleanName = input.name !== undefined ? input.name.trim() : current.name;
  const cleanCode = input.code !== undefined ? input.code.trim().toUpperCase() : current.code;

  if (!cleanName) throw new Error('Nama mata pelajaran tidak boleh kosong.');
  if (!cleanCode) throw new Error('Kode mata pelajaran tidak boleh kosong.');

  // Validate code uniqueness if changed
  if (cleanCode !== current.code) {
    if (subjects.some((s) => s.id !== id && s.code.toUpperCase() === cleanCode)) {
      throw new Error(`Kode mata pelajaran "${cleanCode}" sudah digunakan.`);
    }
  }

  const now = new Date().toISOString();
  const updatedSubject: Subject = {
    ...current,
    name: cleanName,
    code: cleanCode,
    status: input.status !== undefined ? input.status : current.status || 'active',
    updatedAt: now
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'subjects', id);
      await updateDoc(docRef, { ...updatedSubject });
    } catch (err) {
      console.warn('[Firestore] Gagal update subject:', err);
    }
  }

  const localList = loadLocal<Subject>(STORAGE_KEY_SUBJECTS, SEED_SUBJECTS);
  const updatedLocal = localList.map((s) => (s.id === id ? updatedSubject : s));
  saveLocal(STORAGE_KEY_SUBJECTS, updatedLocal);

  return updatedSubject;
}

export async function toggleSubjectStatus(id: string): Promise<Subject> {
  const subjects = await fetchSubjects();
  const target = subjects.find((s) => s.id === id);
  if (!target) throw new Error('Mata pelajaran tidak ditemukan.');

  const nextStatus: 'active' | 'inactive' = target.status === 'inactive' ? 'active' : 'inactive';
  return updateSubject(id, { status: nextStatus });
}

// ===============================================================
// 2. MASTER KELAS (CLASSES)
// ===============================================================

export async function fetchClasses(): Promise<SchoolClass[]> {
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, 'classes');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SchoolClass));
        saveLocal(STORAGE_KEY_CLASSES, items);
        return items;
      }
    } catch (err) {
      console.warn('[Firestore] Gagal memuat classes, beralih ke cache lokal:', err);
    }
  }
  return loadLocal<SchoolClass>(STORAGE_KEY_CLASSES, SEED_CLASSES);
}

export async function createClass(input: { name: string; grade?: string }): Promise<SchoolClass> {
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error('Nama kelas tidak boleh kosong.');

  const existing = await fetchClasses();
  if (existing.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error(`Kelas "${cleanName}" sudah terdaftar.`);
  }

  // Derive grade if not explicitly given
  let grade = input.grade?.trim() || '';
  if (!grade) {
    if (cleanName.startsWith('VII') || cleanName.startsWith('7')) grade = 'VII';
    else if (cleanName.startsWith('VIII') || cleanName.startsWith('8')) grade = 'VIII';
    else if (cleanName.startsWith('IX') || cleanName.startsWith('9')) grade = 'IX';
    else grade = 'VII';
  }

  const now = new Date().toISOString();
  const id = `cls_${Date.now()}`;
  const newClass: SchoolClass = {
    id,
    name: cleanName,
    grade,
    status: 'active',
    totalStudents: 32,
    createdAt: now,
    updatedAt: now
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'classes', id);
      await setDoc(docRef, newClass);
    } catch (err) {
      console.warn('[Firestore] Gagal menyimpan class baru:', err);
    }
  }

  const list = loadLocal<SchoolClass>(STORAGE_KEY_CLASSES, SEED_CLASSES);
  const updated = [newClass, ...list];
  saveLocal(STORAGE_KEY_CLASSES, updated);

  return newClass;
}

export async function updateClass(
  id: string,
  input: { name?: string; grade?: string; status?: 'active' | 'inactive' }
): Promise<SchoolClass> {
  const classes = await fetchClasses();
  const idx = classes.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Kelas tidak ditemukan.');

  const current = classes[idx];
  const cleanName = input.name !== undefined ? input.name.trim() : current.name;
  if (!cleanName) throw new Error('Nama kelas tidak boleh kosong.');

  if (cleanName.toLowerCase() !== current.name.toLowerCase()) {
    if (classes.some((c) => c.id !== id && c.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`Kelas "${cleanName}" sudah terdaftar.`);
    }
  }

  const now = new Date().toISOString();
  const updatedClass: SchoolClass = {
    ...current,
    name: cleanName,
    grade: input.grade !== undefined ? input.grade.trim() : current.grade,
    status: input.status !== undefined ? input.status : current.status || 'active',
    updatedAt: now
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'classes', id);
      await updateDoc(docRef, { ...updatedClass });
    } catch (err) {
      console.warn('[Firestore] Gagal update class:', err);
    }
  }

  const localList = loadLocal<SchoolClass>(STORAGE_KEY_CLASSES, SEED_CLASSES);
  const updatedLocal = localList.map((c) => (c.id === id ? updatedClass : c));
  saveLocal(STORAGE_KEY_CLASSES, updatedLocal);

  return updatedClass;
}

export async function toggleClassStatus(id: string): Promise<SchoolClass> {
  const classes = await fetchClasses();
  const target = classes.find((c) => c.id === id);
  if (!target) throw new Error('Kelas tidak ditemukan.');

  const nextStatus: 'active' | 'inactive' = target.status === 'inactive' ? 'active' : 'inactive';
  return updateClass(id, { status: nextStatus });
}

// ===============================================================
// 3. MASTER DATA GURU (TEACHERS)
// ===============================================================

export async function fetchTeachers(): Promise<Teacher[]> {
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, 'teachers');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
        saveLocal(STORAGE_KEY_TEACHERS, items);
        return items;
      }
    } catch (err) {
      console.warn('[Firestore] Gagal memuat teachers, beralih ke cache lokal:', err);
    }
  }
  return loadLocal<Teacher>(STORAGE_KEY_TEACHERS, SEED_TEACHERS);
}

export async function toggleTeacherStatus(id: string): Promise<Teacher> {
  const teachers = await fetchTeachers();
  const target = teachers.find((t) => t.id === id);
  if (!target) throw new Error('Data guru tidak ditemukan.');

  const nextStatus: 'active' | 'inactive' = target.status === 'inactive' ? 'active' : 'inactive';
  const now = new Date().toISOString();
  const updated: Teacher = {
    ...target,
    status: nextStatus,
    updatedAt: now
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'teachers', id);
      await updateDoc(docRef, { status: nextStatus, updatedAt: now });

      // Also sync to users/{uid} if exists
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { status: nextStatus, updatedAt: now });
    } catch (err) {
      console.warn('[Firestore] Gagal update teacher status:', err);
    }
  }

  const localList = loadLocal<Teacher>(STORAGE_KEY_TEACHERS, SEED_TEACHERS);
  const updatedLocal = localList.map((t) => (t.id === id ? updated : t));
  saveLocal(STORAGE_KEY_TEACHERS, updatedLocal);

  return updated;
}

// ===============================================================
// 4. RELASI GURU-MAPEL-KELAS (TEACHER ASSIGNMENTS)
// ===============================================================

export async function fetchAssignments(): Promise<TeacherAssignment[]> {
  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, 'teacherAssignments');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeacherAssignment));
        saveLocal(STORAGE_KEY_ASSIGNMENTS, items);
        return items;
      }
    } catch (err) {
      console.warn('[Firestore] Gagal memuat assignments, beralih ke cache lokal:', err);
    }
  }
  return loadLocal<TeacherAssignment>(STORAGE_KEY_ASSIGNMENTS, SEED_ASSIGNMENTS);
}

export async function fetchTeacherAssignments(teacherId: string): Promise<TeacherAssignment[]> {
  const all = await fetchAssignments();
  return all.filter((a) => a.teacherId === teacherId && a.status === 'active');
}

/**
 * Re-computes and syncs teacher.subjectIds and teacher.classIds based on their active assignments.
 */
async function syncTeacherAggregatedFields(teacherId: string): Promise<void> {
  const assignments = await fetchAssignments();
  const activeForTeacher = assignments.filter((a) => a.teacherId === teacherId && a.status === 'active');

  const subjectSet = new Set<string>();
  const classSet = new Set<string>();

  activeForTeacher.forEach((a) => {
    if (a.subjectId) subjectSet.add(a.subjectId);
    a.classIds.forEach((c) => classSet.add(c));
  });

  const subjectIds = Array.from(subjectSet);
  const classIds = Array.from(classSet);
  const now = new Date().toISOString();

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'teachers', teacherId);
      await updateDoc(docRef, { subjectIds, classIds, updatedAt: now });

      const userRef = doc(db, 'users', teacherId);
      await updateDoc(userRef, { subjectIds, classIds, updatedAt: now });
    } catch (err) {
      console.warn('[Firestore] Gagal update agregasi guru:', err);
    }
  }

  const localList = loadLocal<Teacher>(STORAGE_KEY_TEACHERS, SEED_TEACHERS);
  const updatedLocal = localList.map((t) =>
    t.id === teacherId ? { ...t, subjectIds, classIds, updatedAt: now } : t
  );
  saveLocal(STORAGE_KEY_TEACHERS, updatedLocal);
}

export async function saveAssignment(input: {
  id?: string;
  teacherId: string;
  subjectId: string;
  classIds: string[];
  status?: 'active' | 'inactive';
}): Promise<TeacherAssignment> {
  if (!input.teacherId) throw new Error('Guru wajib dipilih.');
  if (!input.subjectId) throw new Error('Mata pelajaran wajib dipilih.');
  if (!input.classIds || input.classIds.length === 0) {
    throw new Error('Minimal satu kelas harus dipilih.');
  }

  // Validate teacher and subject exist
  const teachers = await fetchTeachers();
  if (!teachers.some((t) => t.id === input.teacherId)) {
    throw new Error('Guru yang dipilih tidak valid.');
  }

  const subjects = await fetchSubjects();
  if (!subjects.some((s) => s.id === input.subjectId)) {
    throw new Error('Mata pelajaran yang dipilih tidak valid.');
  }

  const classes = await fetchClasses();
  for (const cId of input.classIds) {
    if (!classes.some((c) => c.id === cId)) {
      throw new Error(`Kelas dengan ID ${cId} tidak valid.`);
    }
  }

  const now = new Date().toISOString();
  const id = input.id || `asg_${Date.now()}`;
  const assignment: TeacherAssignment = {
    id,
    teacherId: input.teacherId,
    subjectId: input.subjectId,
    classIds: input.classIds,
    status: input.status || 'active',
    createdAt: now,
    updatedAt: now
  };

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'teacherAssignments', id);
      await setDoc(docRef, assignment);
    } catch (err) {
      console.warn('[Firestore] Gagal simpan assignment:', err);
    }
  }

  const localList = loadLocal<TeacherAssignment>(STORAGE_KEY_ASSIGNMENTS, SEED_ASSIGNMENTS);
  const filtered = localList.filter((a) => a.id !== id);
  const updatedLocal = [assignment, ...filtered];
  saveLocal(STORAGE_KEY_ASSIGNMENTS, updatedLocal);

  // Sync teacher aggregated subjectIds and classIds
  await syncTeacherAggregatedFields(input.teacherId);

  return assignment;
}

export async function deleteAssignment(id: string): Promise<void> {
  const list = await fetchAssignments();
  const target = list.find((a) => a.id === id);
  if (!target) return;

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'teacherAssignments', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Gagal delete assignment:', err);
    }
  }

  const localList = loadLocal<TeacherAssignment>(STORAGE_KEY_ASSIGNMENTS, SEED_ASSIGNMENTS);
  const updatedLocal = localList.filter((a) => a.id !== id);
  saveLocal(STORAGE_KEY_ASSIGNMENTS, updatedLocal);

  // Sync teacher aggregated fields
  await syncTeacherAggregatedFields(target.teacherId);
}

// ===============================================================
// 5. ARCHITECTURE: CREATE TEACHER ACCOUNT SAFELY
// ===============================================================

export interface CreateTeacherAccountInput {
  nip: string;
  name: string;
  initialSubjectId?: string;
  initialClassIds?: string[];
  status?: 'active' | 'inactive';
}

/**
 * Creates a new teacher master record and registers their credentials safely.
 *
 * SECURITY DIRECTIVE (Bagian 10):
 * - Passwords are NEVER saved in plaintext in Firestore.
 * - In Firebase Cloud Production, creating secondary users without changing the current
 *   active Admin session is executed via a secure backend Cloud Function (e.g. Firebase Admin SDK
 *   `auth.createUser({ email, password })` on the server).
 * - Client-side code NEVER bundles or exposes Admin SDK service account keys.
 * - This function validates inputs, registers the Teacher document in `teachers/{teacherId}`,
 *   prepares the `users/{teacherId}` profile, and provisions initial assignments safely.
 */
export async function createTeacherAccount(input: CreateTeacherAccountInput): Promise<Teacher> {
  const cleanNip = input.nip.trim();
  const cleanName = input.name.trim();

  if (!cleanNip) throw new Error('NIP guru tidak boleh kosong.');
  if (!cleanName) throw new Error('Nama guru tidak boleh kosong.');

  const existing = await fetchTeachers();
  if (existing.some((t) => t.nip === cleanNip)) {
    throw new Error(`Guru dengan NIP ${cleanNip} sudah terdaftar.`);
  }

  const teacherId = `teacher_${cleanNip}`;
  const now = new Date().toISOString();

  const newTeacher: Teacher = {
    id: teacherId,
    uid: teacherId,
    nip: cleanNip,
    name: cleanName,
    role: 'teacher',
    status: input.status || 'active',
    subjectIds: input.initialSubjectId ? [input.initialSubjectId] : [],
    classIds: input.initialClassIds || [],
    createdAt: now,
    updatedAt: now
  };

  // Firestore sync
  if (isFirebaseConfigured() && db) {
    try {
      // 1. Write to teachers collection
      const teacherRef = doc(db, 'teachers', teacherId);
      await setDoc(teacherRef, newTeacher);

      // 2. Write to users collection for RBAC
      const userRef = doc(db, 'users', teacherId);
      await setDoc(userRef, {
        uid: teacherId,
        email: `${cleanNip}@sp1puspo.local`,
        displayName: cleanName,
        role: 'teacher',
        nip: cleanNip,
        status: input.status || 'active',
        subjectIds: newTeacher.subjectIds,
        classIds: newTeacher.classIds,
        createdAt: now,
        updatedAt: now
      });
    } catch (err) {
      console.warn('[Firestore] Gagal menyimpan guru baru:', err);
    }
  }

  // Local storage update
  const list = loadLocal<Teacher>(STORAGE_KEY_TEACHERS, SEED_TEACHERS);
  const updated = [newTeacher, ...list];
  saveLocal(STORAGE_KEY_TEACHERS, updated);

  // If initial assignment specified, register it
  if (input.initialSubjectId && input.initialClassIds && input.initialClassIds.length > 0) {
    await saveAssignment({
      teacherId,
      subjectId: input.initialSubjectId,
      classIds: input.initialClassIds,
      status: 'active'
    });
  }

  return newTeacher;
}
