import React, { useState, useMemo } from 'react';
import type { Question, Exam, ExamResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { QuestionBankView } from './QuestionBankView';
import { CreateExamWizard } from './CreateExamWizard';
import { ExamListView } from './ExamListView';
import { ExamBuilder } from './ExamBuilder';
import { ExamMonitoringView } from './ExamMonitoringView';
import { TeacherResultDashboard } from './TeacherResultDashboard';
import { AIGeneratorView } from './AIGeneratorView';
import { DocumentImportView } from './DocumentImportView';
import { TeacherProfileSection } from './TeacherProfileSection';
import { generateExamToken } from '../../services/examService';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Calendar,
  ShieldCheck,
  Award,
  Sparkles,
  FileText,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Edit3
} from 'lucide-react';

interface TeacherDashboardProps {
  questions: Question[];
  exams: Exam[];
  results: ExamResult[];
  onUpdateQuestions: (questions: Question[]) => void;
  onUpdateExams: (exams: Exam[]) => void;
  onUpdateResults: (results: ExamResult[]) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  questions,
  exams,
  results,
  onUpdateQuestions,
  onUpdateExams,
  onUpdateResults
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Teacher Isolation (Stage 8.2.1): isolate exams and results to current teacher
  const myExams = useMemo(() => {
    if (isAdmin) return exams;
    return exams.filter((e) => e.ownerId === user.uid || e.owner_id === user.uid);
  }, [exams, user.uid, isAdmin]);

  const myExamIds = useMemo(() => new Set(myExams.map((e) => e.id)), [myExams]);

  const myResults = useMemo(() => {
    if (isAdmin) return results;
    return results.filter((r) => myExamIds.has(r.examId || r.exam_id || ''));
  }, [results, myExamIds, isAdmin]);

  const [activeTab, setActiveTab] = useState<string>('bank'); // Default to Bank Soal
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [monitoredExamId, setMonitoredExamId] = useState<string>(
    myExams.length > 0 ? myExams[0].id : ''
  );

  const activeExamsCount = myExams.filter(
    (e) => e.status === 'active' || e.status === 'ACTIVE'
  ).length;
  const awaitingGradingCount = myResults.filter(
    (r) => r.status === 'awaiting_manual_grading'
  ).length;

  const currentMonitoredExam = myExams.find((e) => e.id === monitoredExamId) || myExams[0];

  const createBlankExam = (): Exam => {
    const now = new Date().toISOString();
    const token = generateExamToken();
    return {
      id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ownerId: user.uid,
      owner_id: user.uid,
      ownerName: user.displayName,
      owner_name: user.displayName,
      title: '',
      description: '',
      subjectId: '',
      subject_id: '',
      subjectName: '',
      subject_name: '',
      classId: '',
      class_id: '',
      classIds: [],
      class_ids: [],
      className: '',
      class_names: [],
      durationMinutes: 60,
      duration_minutes: 60,
      examToken: token,
      pin: token,
      status: 'DRAFT',
      questions: [],
      questionIds: [],
      shuffleQuestions: true,
      shuffleOptions: true,
      totalQuestions: 0,
      total_questions: 0,
      totalPoints: 0,
      total_points: 0,
      composition: {
        multiple_choice: 0,
        multiple_select: 0,
        true_false: 0,
        essay: 0
      },
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now
    };
  };

  const handleCreateNewExam = () => {
    const fresh = createBlankExam();
    setEditingExam(fresh);
    setActiveTab('exam_builder');
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setActiveTab('exam_builder');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Navigation Sub-Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab('results')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'results'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          Rekap Nilai & Penilaian
          {awaitingGradingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
              {awaitingGradingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('bank')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'bank'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Bank Soal
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'exams'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Paket Ujian ({exams.length})
        </button>

        <button
          onClick={handleCreateNewExam}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'exam_builder'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          {activeTab === 'exam_builder' ? 'Editor Paket Ujian' : 'Buat Paket Ujian'}
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'monitoring'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Monitoring Real-Time
          {activeExamsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ai_generator')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'ai_generator'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
          AI Generator
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'import'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Import Dokumen
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-500" />
          Profil & Pengajaran
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'results' && (
        <TeacherResultDashboard
          exams={myExams}
          results={myResults}
          onUpdateResults={onUpdateResults}
        />
      )}

      {activeTab === 'bank' && (
        <QuestionBankView
          questions={questions}
          onUpdateQuestions={onUpdateQuestions}
        />
      )}

      {activeTab === 'exams' && (
        <ExamListView
          exams={myExams}
          onUpdateExams={onUpdateExams}
          onCreateNew={handleCreateNewExam}
          onEditExam={handleEditExam}
          onViewResults={(examId) => {
            setActiveTab('results');
          }}
          onViewMonitoring={(examId) => {
            setMonitoredExamId(examId);
            setActiveTab('monitoring');
          }}
        />
      )}

      {activeTab === 'exam_builder' && (
        <ExamBuilder
          initialExam={editingExam || createBlankExam()}
          onBack={() => {
            setEditingExam(null);
            setActiveTab('exams');
          }}
          onSaved={(savedExam) => {
            const exists = exams.some((e) => e.id === savedExam.id);
            if (exists) {
              onUpdateExams(exams.map((e) => (e.id === savedExam.id ? savedExam : e)));
            } else {
              onUpdateExams([savedExam, ...exams]);
            }
          }}
        />
      )}

      {activeTab === 'create_wizard' && (
        <CreateExamWizard
          questions={questions.filter((q) => !q.is_deleted)}
          onExamCreated={(newExam) => {
            onUpdateExams([newExam, ...exams]);
            setActiveTab('exams');
          }}
          onCancel={() => setActiveTab('exams')}
        />
      )}

      {activeTab === 'monitoring' && currentMonitoredExam && (
        <ExamMonitoringView
          exam={currentMonitoredExam}
          onBack={() => setActiveTab('exams')}
        />
      )}

      {activeTab === 'ai_generator' && (
        <AIGeneratorView
          onQuestionsAdded={(newQ) => onUpdateQuestions([...newQ, ...questions])}
          onGoToBank={() => setActiveTab('bank')}
        />
      )}

      {activeTab === 'import' && (
        <DocumentImportView
          onQuestionsAdded={(newQ) => onUpdateQuestions([...newQ, ...questions])}
          onGoToBank={() => setActiveTab('bank')}
        />
      )}

      {activeTab === 'profile' && <TeacherProfileSection />}
    </div>
  );
};
