import * as XLSX from 'xlsx';
import type { Exam, ExamResult, QuestionAnalysisData } from '../types';

export function exportExamResultsToExcel(
  exam: Exam,
  results: ExamResult[],
  analysisData?: QuestionAnalysisData[]
) {
  const dateStr = new Date().toISOString().split('T')[0];
  const sanitizedTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Hasil_Ujian_${sanitizedTitle}_${dateStr}.xlsx`;

  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Rekap Nilai
  const rekapData: any[] = [];
  rekapData.push([`LAPORAN HASIL UJIAN - SMP NEGERI 1 PUSPO`]);
  rekapData.push([`Judul Ujian: ${exam.title}`]);
  rekapData.push([`Mata Pelajaran: ${exam.subject_name}`]);
  rekapData.push([`Kelas: ${exam.class_names.join(', ')}`]);
  rekapData.push([`Passing Grade (KKM): ${exam.settings.passing_score}`]);
  rekapData.push([`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`]);
  rekapData.push([]); // blank row

  rekapData.push([
    'No',
    'NIS',
    'Nama Lengkap',
    'Kelas',
    'Status Ujian',
    'Waktu Mulai',
    'Waktu Selesai',
    'Benar',
    'Salah',
    'Kosong',
    'Skor Objektif',
    'Skor Uraian',
    'Total Poin',
    'Nilai Akhir (0-100)',
    'Grade',
    'Keterangan'
  ]);

  results.forEach((res, index) => {
    const started = res.started_at ? new Date(res.started_at).toLocaleTimeString('id-ID') : '-';
    const submitted = res.submitted_at ? new Date(res.submitted_at).toLocaleTimeString('id-ID') : '-';
    rekapData.push([
      index + 1,
      res.student_nis || '-',
      res.student_name,
      res.student_class,
      res.status === 'finalized' ? 'Final' : 'Menunggu Koreksi',
      started,
      submitted,
      res.correct_count,
      res.wrong_count,
      res.unanswered_count,
      res.objective_points,
      res.essay_points,
      res.earned_points,
      res.percentage.toFixed(2),
      res.grade,
      res.passed ? 'Lulus' : 'Belum Lulus'
    ]);
  });

  const wsRekap = XLSX.utils.aoa_to_sheet(rekapData);
  wsRekap['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // NIS
    { wch: 28 }, // Nama
    { wch: 10 }, // Kelas
    { wch: 16 }, // Status
    { wch: 14 }, // Waktu Mulai
    { wch: 14 }, // Waktu Selesai
    { wch: 8 },  // Benar
    { wch: 8 },  // Salah
    { wch: 8 },  // Kosong
    { wch: 14 }, // Skor Objektif
    { wch: 12 }, // Skor Uraian
    { wch: 12 }, // Total Poin
    { wch: 18 }, // Nilai Akhir
    { wch: 8 },  // Grade
    { wch: 14 }  // Keterangan
  ];
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Nilai');

  // 2. Sheet 2: Detail Jawaban
  const detailData: any[] = [];
  detailData.push([
    'No',
    'Nama Murid',
    'Kelas',
    'No. Soal',
    'Jenis Soal',
    'Jawaban Murid',
    'Kunci / Rubrik',
    'Skor Maksimal',
    'Skor Diperoleh',
    'Status Jawaban',
    'Catatan / Feedback Guru'
  ]);

  let rowCounter = 1;
  results.forEach((res) => {
    res.items.forEach((item) => {
      let studentAnsStr = '';
      if (Array.isArray(item.student_answer)) {
        studentAnsStr = item.student_answer.join(', ');
      } else if (typeof item.student_answer === 'boolean') {
        studentAnsStr = item.student_answer ? 'Benar' : 'Salah';
      } else if (item.student_answer !== null && item.student_answer !== undefined) {
        studentAnsStr = String(item.student_answer);
      } else {
        studentAnsStr = '(Tidak Dijawab)';
      }

      let correctAnsStr = '';
      if (item.question_type === 'essay') {
        correctAnsStr = item.answer_key || 'Pedoman Rubrik';
      } else if (Array.isArray(item.correct_answer)) {
        correctAnsStr = item.correct_answer.join(', ');
      }

      let statusText = 'Salah';
      if (item.question_type === 'essay') {
        statusText = item.grading_status === 'graded' ? 'Dinilai' : 'Menunggu Nilai';
      } else if (item.is_correct) {
        statusText = 'Benar';
      } else if (item.is_partial) {
        statusText = 'Sebagian Benar';
      } else if (!item.student_answer) {
        statusText = 'Kosong';
      }

      detailData.push([
        rowCounter++,
        res.student_name,
        res.student_class,
        item.question_number,
        item.question_type === 'multiple_choice'
          ? 'Pilihan Ganda'
          : item.question_type === 'multiple_select'
          ? 'PG Kompleks'
          : item.question_type === 'true_false'
          ? 'Benar/Salah'
          : 'Uraian/Essay',
        studentAnsStr,
        correctAnsStr,
        item.max_points,
        item.earned_points,
        statusText,
        item.teacher_feedback || '-'
      ]);
    });
  });

  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
  wsDetail['!cols'] = [
    { wch: 6 },  // No
    { wch: 26 }, // Nama Murid
    { wch: 10 }, // Kelas
    { wch: 10 }, // No Soal
    { wch: 16 }, // Jenis
    { wch: 32 }, // Jawaban Murid
    { wch: 32 }, // Kunci
    { wch: 12 }, // Max Point
    { wch: 14 }, // Earned Point
    { wch: 16 }, // Status
    { wch: 30 }  // Feedback
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Jawaban');

  // 3. Sheet 3: Analisis Butir Soal (if provided)
  if (analysisData && analysisData.length > 0) {
    const analysisRows: any[] = [];
    analysisRows.push([
      'No. Soal',
      'Jenis Soal',
      'Teks Pertanyaan',
      'Poin Maksimal',
      'Total Peserta',
      'Jumlah Benar',
      'Jumlah Salah',
      'Jumlah Kosong',
      'Persentase Benar (%)',
      'Tingkat Kesulitan',
      'Distribusi Pilihan (A / B / C / D)'
    ]);

    analysisData.forEach((q) => {
      let distStr = '-';
      if (q.option_distribution && Object.keys(q.option_distribution).length > 0) {
        distStr = Object.entries(q.option_distribution)
          .map(([opt, count]) => `${opt}: ${count}`)
          .join(' | ');
      }

      analysisRows.push([
        q.question_number,
        q.question_type,
        q.question_text.length > 60 ? q.question_text.substring(0, 60) + '...' : q.question_text,
        q.max_points,
        q.total_attempts,
        q.correct_count,
        q.wrong_count,
        q.unanswered_count,
        q.correct_percentage.toFixed(1) + '%',
        q.difficulty_index,
        distStr
      ]);
    });

    const wsAnalysis = XLSX.utils.aoa_to_sheet(analysisRows);
    wsAnalysis['!cols'] = [
      { wch: 10 }, // No Soal
      { wch: 16 }, // Jenis
      { wch: 45 }, // Pertanyaan
      { wch: 12 }, // Poin
      { wch: 12 }, // Total Peserta
      { wch: 12 }, // Benar
      { wch: 12 }, // Salah
      { wch: 12 }, // Kosong
      { wch: 20 }, // % Benar
      { wch: 18 }, // Kesulitan
      { wch: 30 }  // Distribusi
    ];
    XLSX.utils.book_append_sheet(wb, wsAnalysis, 'Analisis Butir Soal');
  }

  // Trigger browser download
  XLSX.writeFile(wb, filename);
}

/**
 * EXAMPUSA — Stage 8.2 Admin Results & Export Center
 * Exports all filtered ExamResult records across all teachers and exams
 * formatted for school administration standards.
 */
export function exportAdminResultsToExcel(
  results: ExamResult[],
  filtersApplied?: {
    examTitle?: string;
    teacherName?: string;
    subjectName?: string;
    className?: string;
    status?: string;
    searchQuery?: string;
  }
) {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Rekap_Hasil_Ujian_SMPN1Puspo_${dateStr}.xlsx`;

  const wb = XLSX.utils.book_new();

  const rows: any[] = [];
  rows.push(['REKAPITULASI HASIL UJIAN SEKOLAH — SMP NEGERI 1 PUSPO']);
  rows.push(['Portal: EXAMPUSA — Admin Results & Export Center']);
  rows.push([`Tanggal Export: ${new Date().toLocaleString('id-ID')}`]);
  rows.push([`Jumlah Peserta Terekap: ${results.length} Siswa`]);

  if (filtersApplied) {
    const filterDesc = [
      filtersApplied.examTitle ? `Ujian: ${filtersApplied.examTitle}` : null,
      filtersApplied.teacherName ? `Guru: ${filtersApplied.teacherName}` : null,
      filtersApplied.subjectName ? `Mapel: ${filtersApplied.subjectName}` : null,
      filtersApplied.className ? `Kelas: ${filtersApplied.className}` : null,
      filtersApplied.status ? `Status: ${filtersApplied.status}` : null,
      filtersApplied.searchQuery ? `Cari: "${filtersApplied.searchQuery}"` : null
    ].filter(Boolean).join(' | ');

    if (filterDesc) {
      rows.push([`Filter Aktif: ${filterDesc}`]);
    }
  }

  rows.push([]); // blank row

  // Minimum required columns:
  // No, Nama Lengkap, Kelas, Nomor Ujian, Ujian, Mata Pelajaran, Guru, Nilai Akhir, Status, Waktu Submit
  rows.push([
    'No',
    'Nama Lengkap',
    'Kelas',
    'Nomor Ujian',
    'Ujian',
    'Mata Pelajaran',
    'Guru',
    'Nilai Akhir',
    'Status',
    'Waktu Submit'
  ]);

  results.forEach((res, index) => {
    const studentName = res.studentName || res.student_name || 'Peserta Ujian';
    const studentClass = res.studentClass || res.student_class || '-';
    const examNumber = res.examNumber || res.student_nis || res.studentNis || '-';
    const examTitle = res.exam_title || (res as any).examTitle || '-';
    const subjectName = res.subject_name || (res as any).subjectName || '-';
    const teacherName = (res as any).teacherName || (res as any).owner_name || (res as any).ownerName || '-';

    let finalScore = '-';
    if (typeof res.percentage === 'number') {
      finalScore = res.percentage.toFixed(2);
    } else if (typeof res.totalScore === 'number') {
      finalScore = String(res.totalScore);
    } else if (typeof res.earned_points === 'number') {
      finalScore = String(res.earned_points);
    }

    const rawStatus = (res.gradingStatus || res.status || '').toUpperCase();
    let statusLabel = 'Menunggu Koreksi';
    if (rawStatus === 'RESULTS_RELEASED') {
      statusLabel = 'Hasil Dirilis';
    } else if (rawStatus === 'GRADED' || rawStatus === 'FINALIZED') {
      statusLabel = 'Selesai Dinilai';
    } else if (rawStatus === 'NEEDS_GRADING' || rawStatus === 'AWAITING' || rawStatus === 'AWAITING_MANUAL_GRADING') {
      statusLabel = 'Perlu Penilaian Essay';
    } else if (rawStatus === 'SUBMITTED') {
      statusLabel = 'Terkumpul';
    }

    let submitTimeStr = '-';
    const rawSubmitTime = res.submittedAt || res.submitted_at || res.createdAt || res.created_at;
    if (rawSubmitTime) {
      try {
        const d = new Date(rawSubmitTime);
        submitTimeStr = `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      } catch {
        submitTimeStr = String(rawSubmitTime);
      }
    }

    rows.push([
      index + 1,
      studentName,
      studentClass,
      examNumber,
      examTitle,
      subjectName,
      teacherName,
      finalScore,
      statusLabel,
      submitTimeStr
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 28 }, // Nama Lengkap
    { wch: 12 }, // Kelas
    { wch: 16 }, // Nomor Ujian
    { wch: 34 }, // Ujian
    { wch: 20 }, // Mata Pelajaran
    { wch: 26 }, // Guru
    { wch: 14 }, // Nilai Akhir
    { wch: 22 }, // Status
    { wch: 20 }  // Waktu Submit
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Hasil Ujian');

  // Trigger download
  XLSX.writeFile(wb, filename);
}

