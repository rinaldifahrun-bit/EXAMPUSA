import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  Briefcase,
  ShieldCheck,
  KeyRound,
  User,
  Hash,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  School
} from 'lucide-react';
import { mockExams, mockTeachers } from '../../data/mockData';

export const LoginView: React.FC = () => {
  const {
    loginTeacher,
    loginAdmin,
    loginStudent,
    isLoading,
    error,
    clearError,
    isFirebaseOnline
  } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin'>('student');

  // Student Form State
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('IX-A');
  const [studentExamNumber, setStudentExamNumber] = useState('');
  const [studentToken, setStudentToken] = useState('');

  // Teacher Form State
  const [teacherNip, setTeacherNip] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);

  // Admin Form State
  const [adminUsername, setAdminUsername] = useState('adminpuspo1');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Form Submission Handlers
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await loginStudent({
        token: studentToken
      });
      success('Token valid! Sesi ujian berhasil dibuka.', 'Akses Berhasil');
    } catch (err: any) {
      toastError(err.message || 'Gagal masuk ruang ujian.');
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await loginTeacher(teacherNip, teacherPassword);
      success('Selamat datang di Portal Guru SMPN 1 Puspo!', 'Autentikasi Berhasil');
    } catch (err: any) {
      toastError(err.message || 'Login Guru gagal.');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await loginAdmin(adminUsername, adminPassword);
      success('Akses Administrator SP1 PUSPO EXAM Diberikan.', 'Autentikasi Berhasil');
    } catch (err: any) {
      toastError(err.message || 'Login Admin gagal.');
    }
  };

  // Quick Demo fill for testers
  const handleQuickFill = (role: 'student' | 'teacher' | 'admin') => {
    clearError();
    if (role === 'student') {
      setActiveTab('student');
      setStudentToken(mockExams[0]?.pin || '782941');
    } else if (role === 'teacher') {
      setActiveTab('teacher');
      setTeacherNip(mockTeachers[0].nip || '198504122010011008');
      setTeacherPassword('smpn1puspo');
    } else if (role === 'admin') {
      setActiveTab('admin');
      setAdminUsername('adminpuspo1');
      setAdminPassword('smpn1puspo');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-2">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            EXAMPUSA
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Platform Evaluasi & Ujian Sekolah Terpadu
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          {/* Tab Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              id="tab-student-login"
              onClick={() => {
                setActiveTab('student');
                clearError();
              }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === 'student'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Murid</span>
            </button>

            <button
              type="button"
              id="tab-teacher-login"
              onClick={() => {
                setActiveTab('teacher');
                clearError();
              }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === 'teacher'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Guru</span>
            </button>

            <button
              type="button"
              id="tab-admin-login"
              onClick={() => {
                setActiveTab('admin');
                clearError();
              }}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === 'admin'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          {/* Global Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* 1. STUDENT LOGIN FORM */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Token / PIN Ujian <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    id="student-token-input"
                    required
                    maxLength={12}
                    value={studentToken}
                    onChange={(e) => setStudentToken(e.target.value.toUpperCase())}
                    placeholder="Contoh: 782941"
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono uppercase font-bold tracking-widest text-blue-700 bg-white"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Akses mandiri berbasis Token Ujian dari pengawas tanpa registrasi akun.</span>
                </p>
              </div>

              <button
                type="submit"
                id="btn-student-submit"
                disabled={isLoading || !studentToken.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isLoading ? 'Memverifikasi Token...' : 'Masuk Ruang Ujian'}
              </button>
            </form>
          )}

          {/* 2. TEACHER LOGIN FORM */}
          {activeTab === 'teacher' && (
            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Nomor Induk Pegawai (NIP)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    id="teacher-nip-input"
                    required
                    value={teacherNip}
                    onChange={(e) => setTeacherNip(e.target.value)}
                    placeholder="Contoh: 198504122010011008"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password Guru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showTeacherPassword ? 'text' : 'password'}
                    id="teacher-password-input"
                    required
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showTeacherPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Password bawaan guru: <span className="font-mono font-semibold">smpn1puspo</span>
                </p>
              </div>

              <button
                type="submit"
                id="btn-teacher-submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isLoading ? 'Mengautentikasi...' : 'Masuk Portal Guru'}
              </button>
            </form>
          )}

          {/* 3. ADMIN LOGIN FORM */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Username Administrator
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    id="admin-username-input"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="adminpuspo1"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password Administrator
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    id="admin-password-input"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan password admin"
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showAdminPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Password bawaan admin: <span className="font-mono font-semibold">smpn1puspo</span>
                </p>
              </div>

              <button
                type="submit"
                id="btn-admin-submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isLoading ? 'Memverifikasi...' : 'Masuk Portal Administrator'}
              </button>
            </form>
          )}

          {/* Quick Demo Assist */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span className="font-medium">Uji Cepat (Demo Shortcut):</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                {isFirebaseOnline ? 'Firebase Cloud' : 'Offline Mode'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('student')}
                className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition text-center"
              >
                Isi Murid
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('teacher')}
                className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition text-center"
              >
                Isi Guru
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition text-center"
              >
                Isi Admin
              </button>
            </div>
          </div>
        </div>

        {/* Security & System Info Footer */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p>
            SMPN 1 Puspo • Dikembangkan dengan Role-Based Security & Dexie Offline Engine
          </p>
          <p className="text-[10px] text-slate-400">
            Hubungi proktor/administrator sekolah jika mengalami kendala login atau token.
          </p>
        </div>
      </div>
    </div>
  );
};
