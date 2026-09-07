import React, { useState } from 'react';
import type { Exam, Question, MultipleSelectScoring, ResultVisibility } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { createExamWithSnapshot, generateExamPin } from '../../services/examService';
import { mockSubjects, mockClasses } from '../../data/mockData';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Settings,
  BookOpen,
  Calendar,
  Key,
  Shield,
  HelpCircle,
  FileCheck,
  Check
} from 'lucide-react';

interface CreateExamWizardProps {
  questions: Question[];
  onExamCreated: (newExam: Exam) => void;
  onCancel: () => void;
}

export const CreateExamWizard: React.FC<CreateExamWizardProps> = ({
  questions,
  onExamCreated,
  onCancel
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [step, setStep] = useState<number>(1);

  // Step 1: Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState(mockSubjects[0].id);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(['class_9a', 'class_9b']);
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Step 2: Settings
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [allowBackNavigation, setAllowBackNavigation] = useState(true);
  const [secureExamMode, setSecureExamMode] = useState(true);
  const [multipleSelectScoring, setMultipleSelectScoring] = useState<MultipleSelectScoring>('partial_credit');
  const [showResultToStudent, setShowResultToStudent] = useState<ResultVisibility>('after_finalization');
  const [passingScore, setPassingScore] = useState(75);

  // Step 3: Question Selector
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    questions.map((q) => q.id)
  );

  // Step 4: Schedule & PIN
  const [startAt, setStartAt] = useState(() => {
    const now = new Date();
    return now.toISOString().substring(0, 16);
  });
  const [endAt, setEndAt] = useState(() => {
    const next = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return next.toISOString().substring(0, 16);
  });
  const [pin, setPin] = useState(generateExamPin());

  const selectedSubject = mockSubjects.find((s) => s.id === subjectId) || mockSubjects[0];
  const selectedClasses = mockClasses.filter((c) => selectedClassIds.includes(c.id));

  const toggleQuestionSelect = (id: string) => {
    if (selectedQuestionIds.includes(id)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((qId) => qId !== id));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, id]);
    }
  };

  const handleFinish = () => {
    if (!title.trim()) {
      error('Judul ujian wajib diisi!');
      setStep(1);
      return;
    }
    if (selectedClassIds.length === 0) {
      error('Pilih setidaknya satu kelas sasaran!');
      setStep(1);
      return;
    }
    if (selectedQuestionIds.length === 0) {
      error('Pilih setidaknya satu butir soal untuk ujian!');
      setStep(3);
      return;
    }

    const newExam = createExamWithSnapshot(
      {
        owner_id: user.uid,
        owner_name: user.displayName,
        title,
        description,
        subject_id: selectedSubject.id,
        subject_name: selectedSubject.name,
        class_ids: selectedClassIds,
        class_names: selectedClasses.map((c) => c.name),
        duration_minutes: durationMinutes,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        pin,
        status: 'active',
        settings: {
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
          allow_back_navigation: allowBackNavigation,
          secure_exam_mode: secureExamMode,
          max_attempts: 1,
          multiple_select_scoring: multipleSelectScoring,
          show_result_to_student: showResultToStudent,
          passing_score: passingScore
        }
      },
      selectedQuestionIds
    );

    success(`Ujian "${newExam.title}" berhasil dibuat dan diaktifkan! PIN: ${newExam.pin}`, 'Ujian Diterbitkan');
    onExamCreated(newExam);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
      {/* Steps Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-6">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition ${
                  step === s
                    ? 'bg-blue-600 text-white shadow-xs'
                    : step > s
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-slate-700">
                {s === 1 ? 'Info' : s === 2 ? 'Pengaturan' : s === 3 ? 'Pilih Soal' : 'Jadwal & PIN'}
              </span>
              {s < 4 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </div>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          Batal
        </button>
      </div>

      {/* Step 1: Info */}
      {step === 1 && (
        <div className="space-y-4 text-xs">
          <h3 className="text-base font-bold text-slate-900">Langkah 1: Informasi Dasar Ujian</h3>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Judul Ujian:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Penilaian Sumatif Akhir Jenjang (PSAJ) Informatika 2026"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Deskripsi / Petunjuk Pengerjaan:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Petunjuk umum untuk siswa sebelum memulai pengerjaan..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Mata Pelajaran:</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              >
                {mockSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Durasi Pengerjaan (Menit):</label>
              <input
                type="number"
                min={10}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Pilih Kelas Sasaran:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mockClasses.map((c) => {
                const isChecked = selectedClassIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedClassIds(selectedClassIds.filter((id) => id !== c.id));
                      } else {
                        setSelectedClassIds([...selectedClassIds, c.id]);
                      }
                    }}
                    className={`p-3 rounded-lg border text-left flex items-center justify-between transition ${
                      isChecked
                        ? 'bg-blue-50 border-blue-500 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{c.name}</p>
                      <p className="text-[10px] text-slate-500">{c.totalStudents} Siswa</p>
                    </div>
                    {isChecked && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Settings */}
      {step === 2 && (
        <div className="space-y-4 text-xs">
          <h3 className="text-base font-bold text-slate-900">Langkah 2: Pengaturan & Aturan Ujian</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="font-bold text-slate-900">Acak Urutan Soal (Question Randomization)</p>
                <p className="text-[11px] text-slate-500">
                  Setiap murid akan mendapatkan urutan nomor soal yang berbeda secara deterministik.
                </p>
              </div>
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="font-bold text-slate-900">Acak Opsi Pilihan Ganda (Option Shuffling)</p>
                <p className="text-[11px] text-slate-500">
                  Pilihan jawaban A, B, C, D diacak posisinya untuk mencegah sontekan.
                </p>
              </div>
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="font-bold text-slate-900">Mode Ujian Aman (Secure Exam Mode)</p>
                <p className="text-[11px] text-slate-500">
                  Mendeteksi keluar fullscreen, perpindahan tab (window blur), dan menyalin teks.
                </p>
              </div>
              <input
                type="checkbox"
                checked={secureExamMode}
                onChange={(e) => setSecureExamMode(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <label className="font-bold text-slate-900 block">Metode Penilaian PG Kompleks:</label>
                <select
                  value={multipleSelectScoring}
                  onChange={(e) => setMultipleSelectScoring(e.target.value as MultipleSelectScoring)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="partial_credit">Sebagian Benar Dapat Poin Proporsional (Disarankan)</option>
                  <option value="exact_match">Harus Benar Semua (All or Nothing)</option>
                </select>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <label className="font-bold text-slate-900 block">Tampilkan Nilai ke Murid:</label>
                <select
                  value={showResultToStudent}
                  onChange={(e) => setShowResultToStudent(e.target.value as ResultVisibility)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="after_finalization">Setelah Guru Melakukan Finalisasi Nilai</option>
                  <option value="immediately">Langsung Setelah Submit (Hanya Nilai Objektif)</option>
                  <option value="hidden">Sembunyikan Nilai dari Murid</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Batas Kelulusan (Passing Grade / KKM)</p>
                <p className="text-[11px] text-slate-500">Skor minimal untuk dinyatakan Lulus.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseInt(e.target.value) || 75)}
                  className="w-20 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-center font-bold"
                />
                <span className="text-slate-500">/ 100</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Question Selector */}
      {step === 3 && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Langkah 3: Pilih Butir Soal Snapshot</h3>
              <p className="text-[11px] text-slate-500">
                Soal yang dipilih akan dikunci (snapshot) sehingga aman dari perubahan Bank Soal di masa depan.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200 font-bold">
              {selectedQuestionIds.length} Soal Dipilih
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {questions.map((q) => {
              const isSelected = selectedQuestionIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => toggleQuestionSelect(q.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-500 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                          {q.question_type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Topik: {q.topic}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                        {q.question_text}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px] shrink-0">
                    {q.points} Poin
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Schedule & PIN */}
      {step === 4 && (
        <div className="space-y-4 text-xs">
          <h3 className="text-base font-bold text-slate-900">Langkah 4: Jadwal & Token PIN Ujian</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Waktu Mulai:</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Waktu Berakhir:</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                <Key className="w-4 h-4 text-blue-600" />
                Token PIN Masuk Ujian
              </p>
              <p className="text-[11px] text-blue-700/80">
                Murid wajib memasukkan PIN 6 digit ini saat memulai pengerjaan.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-black text-2xl tracking-widest text-slate-900 bg-white px-4 py-2 rounded-lg border border-blue-300 shadow-xs">
                {pin}
              </span>
              <button
                type="button"
                onClick={() => setPin(generateExamPin())}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
              >
                Acak PIN Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-6">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5 border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Sebelumnya
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
          >
            Selanjutnya
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-sm"
          >
            <FileCheck className="w-4 h-4" />
            Terbitkan Ujian Sekarang
          </button>
        )}
      </div>
    </div>
  );
};
