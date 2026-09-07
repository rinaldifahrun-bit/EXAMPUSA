import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db as firestoreDb, isFirebaseConfigured } from '../lib/firebase';
import { db as dexieDb } from '../lib/dexie';
import type {
  QuestionBank,
  Question,
  Subject,
  SchoolClass,
  TeacherAssignment
} from '../types';
import {
  fetchSubjects,
  fetchClasses,
  fetchAssignments,
  fetchTeachers
} from './masterDataService';

const STORAGE_KEY_QUESTION_BANKS = 'exampusa_question_banks_v1';
const STORAGE_KEY_QUESTIONS = 'exampusa_questions_v1';

// Seed demo question banks
export const SEED_QUESTION_BANKS: QuestionBank[] = [
  {
    id: 'bank_inf_7a_mid',
    title: 'Bank Soal Asesmen Sumatif Informatika VII-A',
    description: 'Kumpulan soal perangkat keras, perangkat lunak, dan computational thinking.',
    subjectId: 'subj_inf',
    subjectName: 'Informatika',
    classId: 'cls_7a',
    className: 'VII-A',
    ownerId: 'teacher_1',
    ownerName: 'Bpk. Hendra Pratama, S.Kom.',
    status: 'ready',
    questionsCount: 4,
    totalPoints: 10,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z'
  }
];

export const SEED_QUESTIONS: Question[] = [
  {
    id: 'q_demo_1',
    bankId: 'bank_inf_7a_mid',
    bank_id: 'bank_inf_7a_mid',
    owner_id: 'teacher_1',
    subject_id: 'subj_inf',
    subject_name: 'Informatika',
    class_id: 'cls_7a',
    class_name: 'VII-A',
    topic: 'Perangkat Keras',
    learning_objective: 'Mengidentifikasi fungsi peranti masukan',
    question_type: 'multiple_choice',
    question_text: 'Perangkat komputer yang berfungsi untuk memasukkan data karakter atau teks ke dalam sistem komputer adalah...',
    options: [
      { id: 'opt_1', text: 'Keyboard', order: 1 },
      { id: 'opt_2', text: 'Monitor', order: 2 },
      { id: 'opt_3', text: 'Speaker', order: 3 },
      { id: 'opt_4', text: 'Printer', order: 4 }
    ],
    correct_answer: ['opt_1'],
    points: 2,
    required: true,
    order: 1,
    difficulty: 'easy',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-02-15T08:00:00.000Z',
    updated_at: '2026-02-15T08:00:00.000Z'
  },
  {
    id: 'q_demo_2',
    bankId: 'bank_inf_7a_mid',
    bank_id: 'bank_inf_7a_mid',
    owner_id: 'teacher_1',
    subject_id: 'subj_inf',
    subject_name: 'Informatika',
    class_id: 'cls_7a',
    class_name: 'VII-A',
    topic: 'Perangkat Input Komputer',
    learning_objective: 'Membedakan berbagai jenis peranti masukan data',
    question_type: 'multiple_select',
    question_text: 'Manakah di bawah ini yang termasuk ke dalam kategori perangkat masukan (input device)? (Pilih semua jawaban yang benar)',
    options: [
      { id: 'opt_2a', text: 'Keyboard', score: 2, order: 1 },
      { id: 'opt_2b', text: 'Monitor LCD', score: 0, order: 2 },
      { id: 'opt_2c', text: 'Optical Mouse', score: 2, order: 3 },
      { id: 'opt_2d', text: 'Document Scanner', score: 1, order: 4 }
    ],
    correct_answer: ['opt_2a', 'opt_2c', 'opt_2d'],
    points: 5,
    required: true,
    order: 2,
    difficulty: 'medium',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-02-15T08:00:00.000Z',
    updated_at: '2026-02-15T08:00:00.000Z'
  },
  {
    id: 'q_demo_3',
    bankId: 'bank_inf_7a_mid',
    bank_id: 'bank_inf_7a_mid',
    owner_id: 'teacher_1',
    subject_id: 'subj_inf',
    subject_name: 'Informatika',
    class_id: 'cls_7a',
    class_name: 'VII-A',
    topic: 'Komponen Komputer',
    learning_objective: 'Memahami fungsi RAM',
    question_type: 'true_false',
    question_text: 'RAM (Random Access Memory) merupakan memori penyimpanan utama yang bersifat non-volatile (data tetap tersimpan saat listrik padam).',
    options: [
      { id: 'opt_true', text: 'Benar', order: 1 },
      { id: 'opt_false', text: 'Salah', order: 2 }
    ],
    correct_answer: ['opt_false'],
    points: 1,
    required: true,
    order: 3,
    difficulty: 'medium',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-02-15T08:00:00.000Z',
    updated_at: '2026-02-15T08:00:00.000Z'
  },
  {
    id: 'q_demo_4',
    bankId: 'bank_inf_7a_mid',
    bank_id: 'bank_inf_7a_mid',
    owner_id: 'teacher_1',
    subject_id: 'subj_inf',
    subject_name: 'Informatika',
    class_id: 'cls_7a',
    class_name: 'VII-A',
    topic: 'Sistem Komputer',
    learning_objective: 'Menjelaskan interaksi hardware, software, dan brainware',
    question_type: 'essay',
    question_text: 'Jelaskan mengapa ketiga komponen sistem komputer (hardware, software, dan brainware) harus bekerja secara bersamaan dan tidak dapat dipisahkan!',
    options: [],
    correct_answer: [],
    expectedAnswer: 'Hardware tidak dapat beroperasi tanpa instruksi dari software, dan software tidak dapat dieksekusi tanpa adanya perangkat keras fisik. Sedangkan brainware (manusia/pengguna) adalah pengendali utama yang memberikan masukan logika dan tujuan pengolahan data.',
    rubric: '1. Menyebutkan fungsi keterkaitan hardware dan software (bobot 30%).\n2. Menyebutkan peran brainware sebagai pengendali (bobot 30%).\n3. Kesimpulan hubungan terpadu ketiganya (bobot 40%).',
    points: 10,
    required: true,
    order: 4,
    difficulty: 'hots',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-02-15T08:00:00.000Z',
    updated_at: '2026-02-15T08:00:00.000Z'
  }
];

function loadLocal<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Gagal menyimpan lokal [${key}]:`, err);
  }
}

/**
 * Fetch teacher allowed subjects & classes based strictly on TeacherAssignment
 */
export async function fetchTeacherAllowedScope(teacherUidOrNip: string): Promise<{
  assignments: TeacherAssignment[];
  allowedSubjects: Subject[];
  allowedClassesBySubject: Record<string, SchoolClass[]>;
}> {
  const [allSubjects, allClasses, allAssignments, allTeachers] = await Promise.all([
    fetchSubjects(),
    fetchClasses(),
    fetchAssignments(),
    fetchTeachers()
  ]);

  // Find teacher record
  const teacher = allTeachers.find(
    (t) => t.uid === teacherUidOrNip || t.id === teacherUidOrNip || t.nip === teacherUidOrNip
  );

  const teacherId = teacher ? teacher.id : teacherUidOrNip;

  // Filter assignments matching this teacher
  let myAssignments = allAssignments.filter(
    (a) => a.teacherId === teacherId || (teacher && a.teacherId === teacher.uid)
  );

  // If no assignments found (e.g. newly created user in sandbox), fallback to first assignment or all
  if (myAssignments.length === 0) {
    myAssignments = allAssignments;
  }

  const subjectMap = new Map<string, Subject>();
  allSubjects.forEach((s) => subjectMap.set(s.id, s));

  const classMap = new Map<string, SchoolClass>();
  allClasses.forEach((c) => classMap.set(c.id, c));

  const allowedSubjectsList: Subject[] = [];
  const allowedClassesBySubject: Record<string, SchoolClass[]> = {};

  myAssignments.forEach((asg) => {
    const subj = subjectMap.get(asg.subjectId);
    if (subj && !allowedSubjectsList.some((s) => s.id === subj.id)) {
      allowedSubjectsList.push(subj);
    }

    if (!allowedClassesBySubject[asg.subjectId]) {
      allowedClassesBySubject[asg.subjectId] = [];
    }

    asg.classIds.forEach((cId) => {
      const cls = classMap.get(cId);
      if (cls && !allowedClassesBySubject[asg.subjectId].some((c) => c.id === cls.id)) {
        allowedClassesBySubject[asg.subjectId].push(cls);
      }
    });
  });

  return {
    assignments: myAssignments,
    allowedSubjects: allowedSubjectsList.length > 0 ? allowedSubjectsList : allSubjects,
    allowedClassesBySubject
  };
}

/**
 * Fetch all question banks owned by a teacher (or all for admin)
 */
export async function fetchTeacherQuestionBanks(teacherOwnerId: string, isAdminUser = false): Promise<QuestionBank[]> {
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      const banksRef = collection(firestoreDb, 'questionBanks');
      const q = isAdminUser
        ? query(banksRef, orderBy('updatedAt', 'desc'))
        : query(banksRef, where('ownerId', '==', teacherOwnerId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((doc) => doc.data() as QuestionBank);
      }
    } catch (err) {
      console.warn('[Firestore] Gagal fetch questionBanks, beralih ke Dexie/Lokal:', err);
    }
  }

  // Check Dexie
  try {
    const dexieBanks = await dexieDb.questionBanks.toArray();
    if (dexieBanks.length > 0) {
      if (isAdminUser) return dexieBanks;
      return dexieBanks.filter((b) => b.ownerId === teacherOwnerId);
    }
  } catch (e) {
    console.warn('[Dexie] Gagal fetch questionBanks:', e);
  }

  // Fallback to localStorage
  const localBanks = loadLocal<QuestionBank>(STORAGE_KEY_QUESTION_BANKS, SEED_QUESTION_BANKS);
  if (isAdminUser) return localBanks;
  return localBanks.filter((b) => b.ownerId === teacherOwnerId || b.ownerId === 'teacher_1');
}

/**
 * Fetch questions belonging to a question bank
 */
export async function fetchQuestionsByBankId(bankId: string): Promise<Question[]> {
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      const qRef = collection(firestoreDb, 'questions');
      const q = query(qRef, where('bankId', '==', bankId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list = snap.docs.map((d) => d.data() as Question);
        return list.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    } catch (err) {
      console.warn('[Firestore] Gagal fetch questions by bankId:', err);
    }
  }

  // Check Dexie
  try {
    const dexieQuestions = await dexieDb.questionDrafts.where('bankId').equals(bankId).toArray();
    if (dexieQuestions.length > 0) {
      return dexieQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  } catch (e) {
    console.warn('[Dexie] Gagal fetch questions:', e);
  }

  // Local storage fallback
  const localQuestions = loadLocal<Question>(STORAGE_KEY_QUESTIONS, SEED_QUESTIONS);
  return localQuestions
    .filter((q) => (q.bankId === bankId || q.bank_id === bankId) && !q.is_deleted)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Save Question Bank and its questions to Dexie (immediate local draft)
 * and then synchronize to Firestore.
 */
export async function saveQuestionBankAndQuestions(
  bank: QuestionBank,
  questions: Question[],
  isDraft: boolean = false
): Promise<{ success: boolean; cloudSynced: boolean; error?: string }> {
  const now = new Date().toISOString();
  
  // Calculate aggregate metrics
  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const updatedBank: QuestionBank = {
    ...bank,
    status: isDraft ? 'draft' : 'ready',
    questionsCount: questions.length,
    totalPoints,
    updatedAt: now
  };

  const updatedQuestions: Question[] = questions.map((q, idx) => ({
    ...q,
    bankId: bank.id,
    bank_id: bank.id,
    owner_id: bank.ownerId,
    subject_id: bank.subjectId,
    subject_name: bank.subjectName,
    class_id: bank.classId,
    class_name: bank.className,
    order: idx + 1,
    status: isDraft ? 'draft' : 'ready',
    updated_at: now
  }));

  // 1. Save to Dexie immediately (offline-first resilience)
  try {
    await dexieDb.questionBanks.put(updatedBank);
    await dexieDb.questionDrafts.where('bankId').equals(bank.id).delete();
    await dexieDb.questionDrafts.bulkPut(updatedQuestions);
  } catch (dexieErr) {
    console.warn('[Dexie] Gagal simpan ke IndexedDB:', dexieErr);
  }

  // 2. Save to LocalStorage fallback
  const allBanks = loadLocal<QuestionBank>(STORAGE_KEY_QUESTION_BANKS, SEED_QUESTION_BANKS);
  const filteredBanks = allBanks.filter((b) => b.id !== bank.id);
  saveLocal(STORAGE_KEY_QUESTION_BANKS, [updatedBank, ...filteredBanks]);

  const allQuestions = loadLocal<Question>(STORAGE_KEY_QUESTIONS, SEED_QUESTIONS);
  const filteredQuestions = allQuestions.filter((q) => q.bankId !== bank.id && q.bank_id !== bank.id);
  saveLocal(STORAGE_KEY_QUESTIONS, [...updatedQuestions, ...filteredQuestions]);

  // 3. Sync to Firestore if online & configured
  let cloudSynced = false;
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      const bankRef = doc(firestoreDb, 'questionBanks', bank.id);
      await setDoc(bankRef, updatedBank);

      for (const q of updatedQuestions) {
        const qRef = doc(firestoreDb, 'questions', q.id);
        await setDoc(qRef, q);
      }
      cloudSynced = true;
    } catch (err: any) {
      console.warn('[Firestore] Sinkronisasi Cloud tertunda (tersimpan di Dexie/Lokal):', err);
      return { success: true, cloudSynced: false, error: err.message };
    }
  }

  return { success: true, cloudSynced };
}

/**
 * Delete / archive a question bank
 */
export async function deleteQuestionBank(bankId: string): Promise<void> {
  // Firestore
  if (isFirebaseConfigured() && firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, 'questionBanks', bankId));
    } catch (err) {
      console.warn('[Firestore] Gagal hapus questionBank:', err);
    }
  }

  // Dexie
  try {
    await dexieDb.questionBanks.delete(bankId);
    await dexieDb.questionDrafts.where('bankId').equals(bankId).delete();
  } catch (e) {
    console.warn('[Dexie] Gagal hapus questionBank:', e);
  }

  // LocalStorage
  const allBanks = loadLocal<QuestionBank>(STORAGE_KEY_QUESTION_BANKS, SEED_QUESTION_BANKS);
  saveLocal(STORAGE_KEY_QUESTION_BANKS, allBanks.filter((b) => b.id !== bankId));

  const allQuestions = loadLocal<Question>(STORAGE_KEY_QUESTIONS, SEED_QUESTIONS);
  saveLocal(STORAGE_KEY_QUESTIONS, allQuestions.filter((q) => q.bankId !== bankId && q.bank_id !== bankId));
}
