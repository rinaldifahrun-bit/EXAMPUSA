import React, { useState } from 'react';
import type { Question } from '../../types';
import { generateAIQuestions } from '../../services/aiQuestionService';
import { addBulkQuestions } from '../../services/questionService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  Brain,
  Sliders,
  Plus,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AIGeneratorViewProps {
  onQuestionsAdded: (newQuestions: Question[]) => void;
  onGoToBank: () => void;
}

export const AIGeneratorView: React.FC<AIGeneratorViewProps> = ({
  onQuestionsAdded,
  onGoToBank
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [topic, setTopic] = useState('Dampak Sosial Informatika & Etika Digital');
  const [subjectName, setSubjectName] = useState('Informatika');
  const [gradeLevel, setGradeLevel] = useState(9);
  const [learningObjective, setLearningObjective] = useState(
    'Murid memahami bahaya cyberbullying, perlindungan data pribadi, dan hak cipta karya digital.'
  );

  // Composition matrix
  const [countMC, setCountMC] = useState(3);
  const [countMS, setCountMS] = useState(1);
  const [countTF, setCountTF] = useState(1);
  const [countEssay, setCountEssay] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<Partial<Question>[]>([]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      error('Topik materi wajib diisi!');
      return;
    }

    setIsGenerating(true);
    try {
      const results = await generateAIQuestions({
        topic,
        subjectName,
        gradeLevel,
        learningObjective,
        composition: {
          multiple_choice: countMC,
          multiple_select: countMS,
          true_false: countTF,
          essay: countEssay
        },
        difficultyDistribution: {
          easy: 1,
          medium: 3,
          hard: 1,
          hots: 1
        }
      });
      setGeneratedDrafts(results);
      success(`AI Gemini berhasil menyusun ${results.length} draf butir soal berkualitas!`, 'AI Sukses');
    } catch (e) {
      error('Gagal menghasilkan soal AI. Coba beberapa saat lagi.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportAllToBank = () => {
    if (generatedDrafts.length === 0) return;

    const formatted: any[] = generatedDrafts.map((d) => ({
      owner_id: user.uid,
      subject_id: 'subj_info',
      subject_name: subjectName,
      class_id: 'class_9a',
      class_name: 'IX-A',
      topic: d.topic || topic,
      learning_objective: d.learning_objective || learningObjective,
      question_type: d.question_type || 'multiple_choice',
      question_text: d.question_text || '',
      options: d.options || [],
      correct_answer: d.correct_answer || ['A'],
      answer_key: d.answer_key,
      rubric: d.rubric,
      explanation: d.explanation,
      difficulty: d.difficulty || 'medium',
      cognitive_level: d.cognitive_level || 'C2',
      points: d.points || 2,
      grading_method: d.grading_method || 'all_or_nothing',
      status: 'ready',
      source: 'ai'
    }));

    const added = addBulkQuestions(formatted);
    onQuestionsAdded(added);
    success(`${added.length} soal AI berhasil ditambahkan ke Bank Soal!`, 'Tersimpan');
    setGeneratedDrafts([]);
    onGoToBank();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Gemini AI Engine
            </span>
            <span className="text-xs text-slate-500 font-medium">Kurikulum Merdeka SMP</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            AI Generator Soal Ujian Otomatis
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Buat paket soal terstruktur dengan rubrik penilaian, kunci jawaban, dan level kognitif taksonomi Bloom.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 cols: Prompt Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Parameter & Sasaran Materi
            </h3>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Topik / Materi Pokok:</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Algoritma Pemrograman, Siklus Air..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tujuan Pembelajaran (TP):</label>
              <textarea
                rows={2}
                value={learningObjective}
                onChange={(e) => setLearningObjective(e.target.value)}
                placeholder="Tujuan pembelajaran spesifik..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Matrix of Question Counts */}
            <div>
              <label className="font-bold text-slate-700 block mb-2">Komposisi Butir Soal:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-600 font-bold block">Pilihan Ganda (PG)</span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={countMC}
                    onChange={(e) => setCountMC(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-white border border-slate-300 text-slate-900 font-bold text-center"
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-600 font-bold block">PG Kompleks (MS)</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={countMS}
                    onChange={(e) => setCountMS(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-white border border-slate-300 text-slate-900 font-bold text-center"
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-600 font-bold block">Benar / Salah (TF)</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={countTF}
                    onChange={(e) => setCountTF(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-white border border-slate-300 text-slate-900 font-bold text-center"
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-amber-700 font-bold block">Uraian / Essay</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={countEssay}
                    onChange={(e) => setCountEssay(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-white border border-slate-300 text-slate-900 font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Gemini sedang menyusun soal...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Soal dengan Gemini AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right 7 cols: Generated Questions Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-600" />
                Hasil Draf Soal AI ({generatedDrafts.length})
              </h3>
              {generatedDrafts.length > 0 && (
                <button
                  onClick={handleImportAllToBank}
                  className="px-3.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simpan Semua ke Bank Soal
                </button>
              )}
            </div>

            {generatedDrafts.length === 0 ? (
              <div className="p-12 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                Tekan tombol &quot;Generate Soal dengan Gemini AI&quot; untuk membuat draf butir soal baru.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {generatedDrafts.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-600">#{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                          {d.question_type}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {d.difficulty} • {d.cognitive_level}
                        </span>
                      </div>
                      <span className="font-bold text-amber-700">{d.points} Poin</span>
                    </div>

                    <p className="text-slate-800 font-medium leading-relaxed">
                      {d.question_text}
                    </p>

                    {d.options && d.options.length > 0 && (
                      <div className="space-y-1">
                        {d.options.map((o) => {
                          const isCorrect = d.correct_answer?.includes(o.id);
                          return (
                            <div
                              key={o.id}
                              className={`p-1.5 rounded-lg flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-green-50 border border-green-200 text-green-800 font-semibold'
                                  : 'text-slate-600'
                              }`}
                            >
                              <span className="font-bold">{o.id}.</span>
                              <span>{o.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {d.answer_key && (
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px]">
                        <p className="font-bold text-green-700">Rubrik Guru:</p>
                        <p className="text-slate-700 whitespace-pre-line">{d.answer_key}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
