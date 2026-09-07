import React, { useState } from 'react';
import type { Question, Exam, ExamResult } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SyncProvider } from './context/SyncContext';
import { Header } from './components/common/Header';
import { LoginView } from './components/auth/LoginView';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { AdminFoundationView } from './components/admin/AdminFoundationView';
import { mockQuestions, mockExams, mockResults } from './data/mockData';
import { Loader2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, role, isAuthenticated, isTeacher, isAdmin, isStudent, isLoading } = useAuth();

  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [exams, setExams] = useState<Exam[]>(mockExams);
  const [results, setResults] = useState<ExamResult[]>(mockResults);

  const [currentTab, setCurrentTab] = useState('main');

  // Loading spinner during initial auth check
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">Memeriksa Sesi Autentikasi...</p>
      </div>
    );
  }

  // If unauthenticated, display Login screen
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
        <LoginView />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Header currentTab={currentTab} onSelectTab={setCurrentTab} />

      <main className="flex-1 pb-16">
        {isAdmin && (
          <AdminFoundationView
            questions={questions}
            exams={exams}
            results={results}
            onUpdateQuestions={setQuestions}
            onUpdateExams={setExams}
            onUpdateResults={setResults}
          />
        )}

        {isTeacher && (
          <TeacherDashboard
            questions={questions}
            exams={exams}
            results={results}
            onUpdateQuestions={setQuestions}
            onUpdateExams={setExams}
            onUpdateResults={setResults}
          />
        )}

        {isStudent && (
          <StudentDashboard
            exams={exams}
            results={results}
            onExamFinished={() => {
              // Exam finished handler
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 shadow-sm">
        <p className="text-[11px] text-slate-500">
          Dikembangkan oleh Rinaldi Fahrun — Guru SMPN 1 Puspo
        </p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SyncProvider>
          <MainAppContent />
        </SyncProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
