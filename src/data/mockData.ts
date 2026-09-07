import type {
  UserProfile,
  Subject,
  SchoolClass,
  Question,
  Exam,
  ExamResult
} from '../types';

export const mockAdmins: UserProfile[] = [
  {
    uid: 'admin_1',
    email: 'adminpuspo1@sp1puspo.local',
    displayName: 'Administrator SP1 Puspo',
    role: 'admin',
    username: 'adminpuspo1',
    status: 'active'
  }
];

export const mockTeachers: UserProfile[] = [
  {
    uid: 'teacher_1',
    email: 'hendra.pratama@smpn1puspo.sch.id',
    displayName: 'Bpk. Hendra Pratama, S.Kom.',
    role: 'teacher',
    nip: '198504122010011008',
    phone: '081234567890'
  },
  {
    uid: 'teacher_2',
    email: 'rina.wulandari@smpn1puspo.sch.id',
    displayName: 'Ibu Rina Wulandari, S.Pd.',
    role: 'teacher',
    nip: '198908232014022005',
    phone: '081987654321'
  }
];

export const mockStudents: UserProfile[] = [
  {
    uid: 'student_1',
    email: 'ahmad.fauzi@murid.smpn1puspo.sch.id',
    displayName: 'Ahmad Fauzi',
    role: 'student',
    nis: '212207001',
    classId: 'class_9a',
    className: 'IX-A'
  },
  {
    uid: 'student_2',
    email: 'budi.santoso@murid.smpn1puspo.sch.id',
    displayName: 'Budi Santoso',
    role: 'student',
    nis: '212207002',
    classId: 'class_9a',
    className: 'IX-A'
  },
  {
    uid: 'student_3',
    email: 'citra.lestari@murid.smpn1puspo.sch.id',
    displayName: 'Citra Lestari',
    role: 'student',
    nis: '212207003',
    classId: 'class_9b',
    className: 'IX-B'
  },
  {
    uid: 'student_4',
    email: 'dewi.ayu@murid.smpn1puspo.sch.id',
    displayName: 'Dewi Ayu Ningrum',
    role: 'student',
    nis: '212207004',
    classId: 'class_9a',
    className: 'IX-A'
  },
  {
    uid: 'student_5',
    email: 'eko.prasetyo@murid.smpn1puspo.sch.id',
    displayName: 'Eko Prasetyo',
    role: 'student',
    nis: '212207005',
    classId: 'class_9a',
    className: 'IX-A'
  },
  {
    uid: 'student_6',
    email: 'fani.rahma@murid.smpn1puspo.sch.id',
    displayName: 'Fani Rahmawati',
    role: 'student',
    nis: '212207006',
    classId: 'class_9b',
    className: 'IX-B'
  },
  {
    uid: 'student_7',
    email: 'gilang.ramadhan@murid.smpn1puspo.sch.id',
    displayName: 'Gilang Ramadhan',
    role: 'student',
    nis: '212207007',
    classId: 'class_9a',
    className: 'IX-A'
  },
  {
    uid: 'student_8',
    email: 'hani.fitria@murid.smpn1puspo.sch.id',
    displayName: 'Hani Fitriani',
    role: 'student',
    nis: '212207008',
    classId: 'class_9b',
    className: 'IX-B'
  }
];

export const mockSubjects: Subject[] = [
  { id: 'subj_info', name: 'Informatika', code: 'INF', gradeLevel: 9 },
  { id: 'subj_ipa', name: 'Ilmu Pengetahuan Alam (IPA)', code: 'IPA', gradeLevel: 9 },
  { id: 'subj_mat', name: 'Matematika', code: 'MAT', gradeLevel: 9 },
  { id: 'subj_bind', name: 'Bahasa Indonesia', code: 'BIN', gradeLevel: 9 }
];

export const mockClasses: SchoolClass[] = [
  { id: 'class_9a', name: 'IX-A', gradeLevel: 9, totalStudents: 32 },
  { id: 'class_9b', name: 'IX-B', gradeLevel: 9, totalStudents: 30 },
  { id: 'class_8a', name: 'VIII-A', gradeLevel: 8, totalStudents: 32 },
  { id: 'class_7a', name: 'VII-A', gradeLevel: 7, totalStudents: 34 }
];

export const mockQuestions: Question[] = [
  {
    id: 'q_1',
    owner_id: 'teacher_1',
    subject_id: 'subj_info',
    subject_name: 'Informatika',
    class_id: 'class_9a',
    class_name: 'IX-A',
    topic: 'Sistem Komputer & Hardware',
    learning_objective: 'Murid mampu mengidentifikasi komponen pemrosesan utama pada komputer.',
    question_type: 'multiple_choice',
    question_text: 'Komponen perangkat keras komputer yang bertindak sebagai otak utama untuk memproses semua instruksi aritmatika dan logika adalah...',
    options: [
      { id: 'A', text: 'Random Access Memory (RAM)', order: 1 },
      { id: 'B', text: 'Central Processing Unit (CPU)', order: 2 },
      { id: 'C', text: 'Hard Disk Drive (HDD)', order: 3 },
      { id: 'D', text: 'Power Supply Unit (PSU)', order: 4 }
    ],
    correct_answer: ['B'],
    explanation: 'CPU (Central Processing Unit) adalah unit pemroses pusat yang menjalankan instruksi program komputer.',
    difficulty: 'easy',
    cognitive_level: 'C2',
    points: 2,
    grading_method: 'all_or_nothing',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-08-20T08:00:00Z',
    updated_at: '2026-08-20T08:00:00Z'
  },
  {
    id: 'q_2',
    owner_id: 'teacher_1',
    subject_id: 'subj_info',
    subject_name: 'Informatika',
    class_id: 'class_9a',
    class_name: 'IX-A',
    topic: 'Perangkat Masukan dan Keluaran',
    learning_objective: 'Murid mampu mengelompokkan perangkat masukan (input devices) komputer.',
    question_type: 'multiple_select',
    question_text: 'Manakah dari perangkat berikut yang termasuk ke dalam kategori perangkat masukan (Input Device)? (Pilih lebih dari satu)',
    options: [
      { id: 'A', text: 'Keyboard Mekanikal', order: 1 },
      { id: 'B', text: 'Monitor LCD', order: 2 },
      { id: 'C', text: 'Mouse Optik', order: 3 },
      { id: 'D', text: 'Scanner Dokumen', order: 4 }
    ],
    correct_answer: ['A', 'C', 'D'],
    explanation: 'Keyboard, Mouse, dan Scanner memasukkan data ke komputer, sedangkan monitor mengeluarkan data visual.',
    difficulty: 'medium',
    cognitive_level: 'C3',
    points: 3,
    grading_method: 'partial_credit',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-08-20T08:30:00Z',
    updated_at: '2026-08-20T08:30:00Z'
  },
  {
    id: 'q_3',
    owner_id: 'teacher_1',
    subject_id: 'subj_info',
    subject_name: 'Informatika',
    class_id: 'class_9a',
    class_name: 'IX-A',
    topic: 'Memori & Storage',
    learning_objective: 'Murid memahami sifat penyimpanan RAM.',
    question_type: 'true_false',
    question_text: 'RAM (Random Access Memory) merupakan media penyimpanan yang bersifat Non-Volatile, artinya data di dalamnya tetap tersimpan meskipun aliran listrik komputer diputus.',
    options: [
      { id: 'true', text: 'Benar', order: 1 },
      { id: 'false', text: 'Salah', order: 2 }
    ],
    correct_answer: ['false'],
    explanation: 'RAM bersifat Volatile (data hilang saat listrik mati), sedangkan ROM dan Harddisk bersifat Non-Volatile.',
    difficulty: 'easy',
    cognitive_level: 'C2',
    points: 2,
    grading_method: 'all_or_nothing',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-08-21T09:00:00Z',
    updated_at: '2026-08-21T09:00:00Z'
  },
  {
    id: 'q_4',
    owner_id: 'teacher_1',
    subject_id: 'subj_info',
    subject_name: 'Informatika',
    class_id: 'class_9a',
    class_name: 'IX-A',
    topic: 'Jaringan Komputer & Internet',
    learning_objective: 'Murid mampu menjelaskan fungsi dan peranan IP Address dalam jaringan.',
    question_type: 'essay',
    question_text: 'Jelaskan apa yang dimaksud dengan IP Address dalam jaringan komputer, dan mengapa setiap perangkat yang terhubung ke internet harus memiliki alamat IP yang unik!',
    options: [],
    correct_answer: [],
    answer_key: 'Pedoman Jawaban:\n1. Definisi IP Address sebagai identitas numerik perangkat dalam jaringan (skor maks 3)\n2. Peran untuk routing dan pengiriman paket data tanpa salah alamat (skor maks 4)\n3. Analogi atau penjelasan keunikan alamat (skor maks 3)',
    rubric: 'Rubrik Penilaian:\n- Definisi lengkap dan tepat: 3 poin\n- Alasan keunikan untuk routing data: 4 poin\n- Kerapihan penjelasan & contoh konkret: 3 poin',
    explanation: 'IP Address berfungsi sebagai alamat tujuan dan asal pengiriman paket data digital dalam protokol TCP/IP.',
    difficulty: 'hots',
    cognitive_level: 'C4',
    points: 10,
    grading_method: 'all_or_nothing',
    status: 'ready',
    source: 'manual',
    is_deleted: false,
    created_at: '2026-08-21T10:00:00Z',
    updated_at: '2026-08-21T10:00:00Z'
  },
  {
    id: 'q_5',
    owner_id: 'teacher_1',
    subject_id: 'subj_info',
    subject_name: 'Informatika',
    class_id: 'class_9a',
    class_name: 'IX-A',
    topic: 'Keamanan Digital',
    learning_objective: 'Murid memahami etika dan pencegahan kejahatan siber (Cybersecurity).',
    question_type: 'multiple_choice',
    question_text: 'Tindakan memanipulasi korban melalui email atau situs web palsu agar membocorkan kata sandi atau data perbankan dikenal dengan istilah...',
    options: [
      { id: 'A', text: 'Phishing', order: 1 },
      { id: 'B', text: 'Defragmenting', order: 2 },
      { id: 'C', text: 'Overclocking', order: 3 },
      { id: 'D', text: 'Compiling', order: 4 }
    ],
    correct_answer: ['A'],
    explanation: 'Phishing adalah metode penipuan rekayasa sosial untuk mencuri informasi kredensial sensitif.',
    difficulty: 'medium',
    cognitive_level: 'C2',
    points: 3,
    grading_method: 'all_or_nothing',
    status: 'ready',
    source: 'ai',
    is_deleted: false,
    created_at: '2026-08-22T11:00:00Z',
    updated_at: '2026-08-22T11:00:00Z'
  }
];

export const mockExams: Exam[] = [
  {
    id: 'exam_info_9',
    owner_id: 'teacher_1',
    owner_name: 'Bpk. Hendra Pratama, S.Kom.',
    title: 'Penilaian Sumatif Tengah Semester (PTS) Informatika Kelas 9',
    description: 'Ujian Pemahaman Materi Komponen Komputer, Jaringan, dan Keamanan Digital SMPN 1 Puspo.',
    subject_id: 'subj_info',
    subject_name: 'Informatika',
    class_ids: ['class_9a', 'class_9b'],
    class_names: ['IX-A', 'IX-B'],
    duration_minutes: 60,
    start_at: '2026-09-01T07:00:00Z',
    end_at: '2026-09-01T12:00:00Z',
    pin: '782941',
    status: 'active',
    settings: {
      shuffle_questions: true,
      shuffle_options: true,
      allow_back_navigation: true,
      secure_exam_mode: true,
      max_attempts: 1,
      multiple_select_scoring: 'partial_credit',
      show_result_to_student: 'after_finalization',
      passing_score: 75
    },
    total_questions: 5,
    total_points: 20,
    composition: {
      multiple_choice: 2,
      multiple_select: 1,
      true_false: 1,
      essay: 1
    },
    questions_snapshot: [
      {
        id: 'snap_1',
        question_id: 'q_1',
        order_number: 1,
        points: 2,
        question_type: 'multiple_choice',
        question_text: 'Komponen perangkat keras komputer yang bertindak sebagai otak utama untuk memproses semua instruksi aritmatika dan logika adalah...',
        options: [
          { id: 'A', text: 'Random Access Memory (RAM)', order: 1 },
          { id: 'B', text: 'Central Processing Unit (CPU)', order: 2 },
          { id: 'C', text: 'Hard Disk Drive (HDD)', order: 3 },
          { id: 'D', text: 'Power Supply Unit (PSU)', order: 4 }
        ],
        correct_answer: ['B'],
        grading_method: 'all_or_nothing'
      },
      {
        id: 'snap_2',
        question_id: 'q_2',
        order_number: 2,
        points: 3,
        question_type: 'multiple_select',
        question_text: 'Manakah dari perangkat berikut yang termasuk ke dalam kategori perangkat masukan (Input Device)? (Pilih lebih dari satu)',
        options: [
          { id: 'A', text: 'Keyboard Mekanikal', order: 1 },
          { id: 'B', text: 'Monitor LCD', order: 2 },
          { id: 'C', text: 'Mouse Optik', order: 3 },
          { id: 'D', text: 'Scanner Dokumen', order: 4 }
        ],
        correct_answer: ['A', 'C', 'D'],
        grading_method: 'partial_credit'
      },
      {
        id: 'snap_3',
        question_id: 'q_3',
        order_number: 3,
        points: 2,
        question_type: 'true_false',
        question_text: 'RAM (Random Access Memory) merupakan media penyimpanan yang bersifat Non-Volatile, artinya data di dalamnya tetap tersimpan meskipun aliran listrik komputer diputus.',
        options: [
          { id: 'true', text: 'Benar', order: 1 },
          { id: 'false', text: 'Salah', order: 2 }
        ],
        correct_answer: ['false'],
        grading_method: 'all_or_nothing'
      },
      {
        id: 'snap_4',
        question_id: 'q_5',
        order_number: 4,
        points: 3,
        question_type: 'multiple_choice',
        question_text: 'Tindakan memanipulasi korban melalui email atau situs web palsu agar membocorkan kata sandi atau data perbankan dikenal dengan istilah...',
        options: [
          { id: 'A', text: 'Phishing', order: 1 },
          { id: 'B', text: 'Defragmenting', order: 2 },
          { id: 'C', text: 'Overclocking', order: 3 },
          { id: 'D', text: 'Compiling', order: 4 }
        ],
        correct_answer: ['A'],
        grading_method: 'all_or_nothing'
      },
      {
        id: 'snap_5',
        question_id: 'q_4',
        order_number: 5,
        points: 10,
        question_type: 'essay',
        question_text: 'Jelaskan apa yang dimaksud dengan IP Address dalam jaringan komputer, dan mengapa setiap perangkat yang terhubung ke internet harus memiliki alamat IP yang unik!',
        options: [],
        correct_answer: [],
        answer_key: 'Pedoman: Definisi identitas numerik jaringan (3 poin), kebutuhan unik agar data tidak salah kirim/routing (4 poin), analogi alamat pos (3 poin).',
        rubric: 'Maksimal 10 poin.',
        grading_method: 'all_or_nothing'
      }
    ],
    created_at: '2026-08-25T07:00:00Z',
    updated_at: '2026-08-25T07:00:00Z',
    published_at: '2026-08-25T07:00:00Z'
  }
];

export const mockResults: ExamResult[] = [
  {
    id: 'exam_info_9_student_1',
    session_id: 'sess_1',
    exam_id: 'exam_info_9',
    exam_title: 'Penilaian Sumatif Tengah Semester (PTS) Informatika Kelas 9',
    subject_name: 'Informatika',
    student_id: 'student_1',
    student_name: 'Ahmad Fauzi',
    student_nis: '212207001',
    student_class: 'IX-A',
    total_questions: 5,
    total_points: 20,
    earned_points: 18,
    objective_points: 10,
    essay_points: 8,
    correct_count: 4,
    wrong_count: 0,
    unanswered_count: 0,
    essay_count: 1,
    percentage: 90.0,
    grade: 'A',
    passed: true,
    status: 'finalized',
    started_at: '2026-09-01T07:15:00Z',
    submitted_at: '2026-09-01T07:55:00Z',
    duration_seconds: 2400,
    created_at: '2026-09-01T07:55:00Z',
    finalized_at: '2026-09-01T08:15:00Z',
    items: [
      {
        question_id: 'q_1',
        question_number: 1,
        question_type: 'multiple_choice',
        question_text: 'Komponen perangkat keras komputer yang bertindak sebagai otak utama...',
        student_answer: 'B',
        correct_answer: ['B'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_2',
        question_number: 2,
        question_type: 'multiple_select',
        question_text: 'Manakah dari perangkat berikut yang termasuk ke dalam kategori perangkat masukan (Input Device)?',
        student_answer: ['A', 'C', 'D'],
        correct_answer: ['A', 'C', 'D'],
        max_points: 3,
        earned_points: 3,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_3',
        question_number: 3,
        question_type: 'true_false',
        question_text: 'RAM merupakan media penyimpanan yang bersifat Non-Volatile...',
        student_answer: false,
        correct_answer: ['false'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_5',
        question_number: 4,
        question_type: 'multiple_choice',
        question_text: 'Tindakan memanipulasi korban melalui email atau situs web palsu...',
        student_answer: 'A',
        correct_answer: ['A'],
        max_points: 3,
        earned_points: 3,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_4',
        question_number: 5,
        question_type: 'essay',
        question_text: 'Jelaskan apa yang dimaksud dengan IP Address...',
        student_answer: 'IP Address adalah deretan angka unik yang menjadi identitas setiap komputer di internet seperti alamat rumah, sehingga data dan pesan yang dikirim tidak salah tujuan ke perangkat lain.',
        answer_key: 'Pedoman: Identitas numerik, perutean data tanpa salah kirim.',
        max_points: 10,
        earned_points: 8,
        is_correct: true,
        grading_status: 'graded',
        teacher_feedback: 'Penjelasan sangat baik dan analogi alamat rumah tepat.',
        graded_by: 'Bpk. Hendra Pratama, S.Kom.',
        graded_at: '2026-09-01T08:15:00Z'
      }
    ]
  },
  {
    id: 'exam_info_9_student_2',
    session_id: 'sess_2',
    exam_id: 'exam_info_9',
    exam_title: 'Penilaian Sumatif Tengah Semester (PTS) Informatika Kelas 9',
    subject_name: 'Informatika',
    student_id: 'student_2',
    student_name: 'Budi Santoso',
    student_nis: '212207002',
    student_class: 'IX-A',
    total_questions: 5,
    total_points: 20,
    earned_points: 13,
    objective_points: 7,
    essay_points: 6,
    correct_count: 2,
    wrong_count: 1,
    unanswered_count: 0,
    essay_count: 1,
    percentage: 65.0,
    grade: 'D',
    passed: false,
    status: 'finalized',
    started_at: '2026-09-01T07:10:00Z',
    submitted_at: '2026-09-01T07:45:00Z',
    duration_seconds: 2100,
    created_at: '2026-09-01T07:45:00Z',
    finalized_at: '2026-09-01T08:20:00Z',
    items: [
      {
        question_id: 'q_1',
        question_number: 1,
        question_type: 'multiple_choice',
        question_text: 'Komponen perangkat keras komputer yang bertindak sebagai otak utama...',
        student_answer: 'B',
        correct_answer: ['B'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_2',
        question_number: 2,
        question_type: 'multiple_select',
        question_text: 'Manakah dari perangkat berikut yang termasuk ke dalam kategori perangkat masukan (Input Device)?',
        student_answer: ['A', 'C'], // Partial (2 out of 3)
        correct_answer: ['A', 'C', 'D'],
        max_points: 3,
        earned_points: 2,
        is_correct: false,
        is_partial: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_3',
        question_number: 3,
        question_type: 'true_false',
        question_text: 'RAM merupakan media penyimpanan yang bersifat Non-Volatile...',
        student_answer: true, // Salah
        correct_answer: ['false'],
        max_points: 2,
        earned_points: 0,
        is_correct: false,
        grading_status: 'graded'
      },
      {
        question_id: 'q_5',
        question_number: 4,
        question_type: 'multiple_choice',
        question_text: 'Tindakan memanipulasi korban melalui email atau situs web palsu...',
        student_answer: 'A',
        correct_answer: ['A'],
        max_points: 3,
        earned_points: 3,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_4',
        question_number: 5,
        question_type: 'essay',
        question_text: 'Jelaskan apa yang dimaksud dengan IP Address...',
        student_answer: 'Alamat IP adalah nomor pengenal internet pada komputer kita supaya bisa browsing ke google.',
        answer_key: 'Pedoman: Identitas numerik, perutean data tanpa salah kirim.',
        max_points: 10,
        earned_points: 6,
        is_correct: true,
        grading_status: 'graded',
        teacher_feedback: 'Pengertian dasar cukup, namun fungsi keunikan dan paket routing belum dijelaskan.',
        graded_by: 'Bpk. Hendra Pratama, S.Kom.',
        graded_at: '2026-09-01T08:20:00Z'
      }
    ]
  },
  {
    id: 'exam_info_9_student_3',
    session_id: 'sess_3',
    exam_id: 'exam_info_9',
    exam_title: 'Penilaian Sumatif Tengah Semester (PTS) Informatika Kelas 9',
    subject_name: 'Informatika',
    student_id: 'student_3',
    student_name: 'Citra Lestari',
    student_nis: '212207003',
    student_class: 'IX-B',
    total_questions: 5,
    total_points: 20,
    earned_points: 10,
    objective_points: 10,
    essay_points: 0,
    correct_count: 4,
    wrong_count: 0,
    unanswered_count: 0,
    essay_count: 1,
    percentage: 50.0,
    grade: 'D',
    passed: false,
    status: 'awaiting_manual_grading', // Waiting for essay correction!
    started_at: '2026-09-01T07:20:00Z',
    submitted_at: '2026-09-01T07:58:00Z',
    duration_seconds: 2280,
    created_at: '2026-09-01T07:58:00Z',
    items: [
      {
        question_id: 'q_1',
        question_number: 1,
        question_type: 'multiple_choice',
        question_text: 'Komponen perangkat keras komputer yang bertindak sebagai otak utama...',
        student_answer: 'B',
        correct_answer: ['B'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_2',
        question_number: 2,
        question_type: 'multiple_select',
        question_text: 'Manakah dari perangkat berikut yang termasuk ke dalam kategori perangkat masukan (Input Device)?',
        student_answer: ['A', 'C', 'D'],
        correct_answer: ['A', 'C', 'D'],
        max_points: 3,
        earned_points: 3,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_3',
        question_number: 3,
        question_type: 'true_false',
        question_text: 'RAM merupakan media penyimpanan yang bersifat Non-Volatile...',
        student_answer: false,
        correct_answer: ['false'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_5',
        question_number: 4,
        question_type: 'multiple_choice',
        question_text: 'Tindakan memanipulasi korban melalui email atau situs web palsu...',
        student_answer: 'A',
        correct_answer: ['A'],
        max_points: 3,
        earned_points: 3,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_4',
        question_number: 5,
        question_type: 'essay',
        question_text: 'Jelaskan apa yang dimaksud dengan IP Address...',
        student_answer: 'IP Address (Internet Protocol Address) adalah label numerik yang ditetapkan untuk setiap perangkat yang terhubung ke jaringan komputer. Alamat ini wajib unik agar protokol pengiriman data TCP/IP dapat mengirimkan paket data tepat sasaran tanpa terjadinya tabrakan atau salah kirim ke perangkat lain.',
        answer_key: 'Pedoman: Identitas numerik, perutean data tanpa salah kirim.',
        max_points: 10,
        earned_points: 0,
        is_correct: false,
        grading_status: 'awaiting'
      }
    ]
  },
  {
    id: 'exam_info_9_student_4',
    session_id: 'sess_4',
    exam_id: 'exam_info_9',
    exam_title: 'Penilaian Sumatif Tengah Semester (PTS) Informatika Kelas 9',
    subject_name: 'Informatika',
    student_id: 'student_4',
    student_name: 'Dewi Ayu Ningrum',
    student_nis: '212207004',
    student_class: 'IX-A',
    total_questions: 5,
    total_points: 20,
    earned_points: 16,
    objective_points: 7,
    essay_points: 9,
    correct_count: 3,
    wrong_count: 1,
    unanswered_count: 0,
    essay_count: 1,
    percentage: 80.0,
    grade: 'B',
    passed: true,
    status: 'finalized',
    started_at: '2026-09-01T07:05:00Z',
    submitted_at: '2026-09-01T07:40:00Z',
    duration_seconds: 2100,
    created_at: '2026-09-01T07:40:00Z',
    finalized_at: '2026-09-01T08:25:00Z',
    items: [
      {
        question_id: 'q_1',
        question_number: 1,
        question_type: 'multiple_choice',
        question_text: 'Komponen perangkat keras komputer yang bertindak sebagai otak utama...',
        student_answer: 'B',
        correct_answer: ['B'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_2',
        question_number: 2,
        question_type: 'multiple_select',
        question_text: 'Manakah dari perangkat berikut yang termasuk ke dalam kategori perangkat masukan (Input Device)?',
        student_answer: ['A', 'B', 'C', 'D'], // Salah pilih monitor
        correct_answer: ['A', 'C', 'D'],
        max_points: 3,
        earned_points: 0,
        is_correct: false,
        grading_status: 'graded'
      },
      {
        question_id: 'q_3',
        question_number: 3,
        question_type: 'true_false',
        question_text: 'RAM merupakan media penyimpanan yang bersifat Non-Volatile...',
        student_answer: false,
        correct_answer: ['false'],
        max_points: 2,
        earned_points: 2,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_5',
        question_number: 4,
        question_type: 'multiple_choice',
        question_text: 'Tindakan memanipulasi korban melalui email atau situs web palsu...',
        student_answer: 'A',
        correct_answer: ['A'],
        max_points: 3,
        earned_points: 3,
        is_correct: true,
        grading_status: 'graded'
      },
      {
        question_id: 'q_4',
        question_number: 5,
        question_type: 'essay',
        question_text: 'Jelaskan apa yang dimaksud dengan IP Address...',
        student_answer: 'IP Address adalah alamat identitas perangkat dalam jaringan komputer. Seperti halnya alamat rumah fisik, jika tidak ada alamat IP atau alamatnya sama dengan perangkat lain, maka transmisi paket informasi dari server tidak akan sampai ke tujuan yang benar.',
        answer_key: 'Pedoman: Identitas numerik, perutean data tanpa salah kirim.',
        max_points: 10,
        earned_points: 9,
        is_correct: true,
        grading_status: 'graded',
        teacher_feedback: 'Jawaban runtut dan komprehensif.',
        graded_by: 'Bpk. Hendra Pratama, S.Kom.',
        graded_at: '2026-09-01T08:25:00Z'
      }
    ]
  }
];
