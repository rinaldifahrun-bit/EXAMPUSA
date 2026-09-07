import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Users,
  BookOpen,
  School,
  Link2,
  Database,
  Key,
  Lock,
  CheckCircle2,
  Layers,
  Sparkles,
  Server,
  ArrowRight,
  RefreshCw,
  Info,
  FileText,
  ShieldAlert
} from 'lucide-react';
import type { Question, Exam, ExamResult, Teacher, Subject, SchoolClass, TeacherAssignment } from '../../types';
import { TeacherDashboard } from '../teacher/TeacherDashboard';
import { AdminTeachersSection } from './AdminTeachersSection';
import { AdminSubjectsSection } from './AdminSubjectsSection';
import { AdminClassesSection } from './AdminClassesSection';
import { AdminAssignmentsSection } from './AdminAssignmentsSection';
import { AdminExamManagementSection } from './AdminExamManagementSection';
import { AdminResultsCenterSection } from './AdminResultsCenterSection';
import { AdminOperationalControlView } from './AdminOperationalControlView';
import { ExamBuilder } from '../teacher/ExamBuilder';
import {
  fetchTeachers,
  fetchSubjects,
  fetchClasses,
  fetchAssignments,
  toggleTeacherStatus,
  createTeacherAccount,
  createSubject,
  updateSubject,
  toggleSubjectStatus,
  createClass,
  updateClass,
  toggleClassStatus,
  saveAssignment,
  deleteAssignment
} from '../../services/masterDataService';

interface AdminFoundationViewProps {
  questions: Question[];
  exams: Exam[];
  results: ExamResult[];
  onUpdateQuestions: (q: Question[]) => void;
  onUpdateExams: (e: Exam[]) => void;
  onUpdateResults: (r: ExamResult[]) => void;
}

type AdminTab = 'overview' | 'teachers' | 'subjects' | 'classes' | 'assignments' | 'all_exams' | 'exam_results' | 'operational_recovery' | 'exam_management';

export const AdminFoundationView: React.FC<AdminFoundationViewProps> = ({
  questions,
  exams,
  results,
  onUpdateQuestions,
  onUpdateExams,
  onUpdateResults
}) => {
  const { user, isFirebaseOnline } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tData, sData, cData, aData] = await Promise.all([
        fetchTeachers(),
        fetchSubjects(),
        fetchClasses(),
        fetchAssignments()
      ]);
      setTeachers(tData);
      setSubjects(sData);
      setClasses(cData);
      setAssignments(aData);
    } catch (err) {
      console.error('Gagal memuat master data admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeTeachersCount = teachers.filter((t) => t.status !== 'inactive').length;
  const activeSubjectsCount = subjects.filter((s) => s.status !== 'inactive').length;
  const activeClassesCount = classes.filter((c) => c.status !== 'inactive').length;
  const activeAssignmentsCount = assignments.filter((a) => a.status !== 'inactive').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-7 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Portal Administrator EXAMPUSA
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Panel Pengelolaan Master Data Sekolah
            </h1>
            <p className="text-slate-300 text-xs leading-relaxed">
              Kelola master data guru, mata pelajaran, rombongan belajar (kelas), dan penugasan mengajar dengan standar role-based access control (RBAC) aman.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-2 border border-slate-700 cursor-pointer disabled:opacity-50"
              title="Muat ulang master data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sinkron Data</span>
            </button>
          </div>
        </div>

        {/* Subtle ambient blur */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Admin Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Ikhtisar & Profil Admin
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Guru ({teachers.length})
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'subjects'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Mata Pelajaran ({subjects.length})
        </button>

        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'classes'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <School className="w-4 h-4" />
          Kelas ({classes.length})
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'assignments'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Link2 className="w-4 h-4" />
          Penugasan Guru ({assignments.length})
        </button>

        <button
          onClick={() => {
            setEditingExam(null);
            setActiveTab('all_exams');
          }}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'all_exams'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400" />
          Manajemen Ujian ({exams.length})
        </button>

        <button
          onClick={() => {
            setEditingExam(null);
            setActiveTab('exam_results');
          }}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'exam_results'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-500" />
          Rekap Hasil Ujian ({results.length})
        </button>

        <button
          onClick={() => {
            setEditingExam(null);
            setActiveTab('operational_recovery');
          }}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'operational_recovery'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Bantuan Operasional & Recovery
        </button>

        <button
          onClick={() => setActiveTab('exam_management')}
          className={`px-4 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'exam_management'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-500" />
          Dashboard Guru & Soal
        </button>
      </div>

      {/* Tab: Ikhtisar & Profil Admin */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Master Data Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveTab('teachers')}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guru Terdaftar</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{teachers.length}</p>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {activeTeachersCount} guru aktif
              </p>
            </div>

            <div
              onClick={() => setActiveTab('subjects')}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mata Pelajaran</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{subjects.length}</p>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {activeSubjectsCount} mapel aktif
              </p>
            </div>

            <div
              onClick={() => setActiveTab('classes')}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rombel / Kelas</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{classes.length}</p>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {activeClassesCount} kelas aktif
              </p>
            </div>

            <div
              onClick={() => setActiveTab('assignments')}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penugasan Mengajar</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{assignments.length}</p>
              <p className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                Relasi Guru ↔ Mapel ↔ Kelas
              </p>
            </div>
          </div>

          {/* Profile Admin Section (Bagian 19) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-xs">
                  AD
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {user?.displayName || 'Administrator Utama'}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Role: ADMIN
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Username: <span className="font-bold text-slate-800">adminpuspo1</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Akun Terverifikasi
                </span>
              </div>
            </div>

            {/* Protection Notice */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-start gap-3">
              <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-900">Proteksi Akun Administrator</p>
                <p className="text-[11px] leading-relaxed">
                  Demi stabilitas operasional sistem sekolah, akun administrator berstatus permanen dan tidak dapat dihapus ataupun diturunkan rolenya dari antarmuka pengguna standar. Semua perubahan data sensitif diotorisasi melalui Firebase Authentication dan Firestore Security Rules.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveTab('all_exams')}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-400 transition cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-500" />
                    Manajemen Ujian
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pantau seluruh paket ujian, status lifecycle, dan duplikasi ujian.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('exam_results')}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Rekap Hasil Ujian
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rekap hasil siswa, rincian penilaian per soal, dan export Excel resmi.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('teachers')}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 transition cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                    Kelola Akun Guru & NIP
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tambah akun guru baru, atur NIP, dan kelola status aktif/nonaktif.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('assignments')}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 transition cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                    Penugasan Mengajar
                  </h3>
                  <p className="text-xs text-slate-500">
                    Petakan mata pelajaran dan kelas yang diampu guru.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Guru */}
      {activeTab === 'teachers' && (
        <AdminTeachersSection
          teachers={teachers}
          subjects={subjects}
          classes={classes}
          onToggleStatus={async (id) => {
            await toggleTeacherStatus(id);
            await loadData();
          }}
          onCreateTeacher={async (data) => {
            await createTeacherAccount(data);
            await loadData();
          }}
          onRefresh={loadData}
        />
      )}

      {/* Tab: Mata Pelajaran */}
      {activeTab === 'subjects' && (
        <AdminSubjectsSection
          subjects={subjects}
          teachers={teachers}
          onCreateSubject={async (data) => {
            await createSubject(data);
            await loadData();
          }}
          onUpdateSubject={async (id, data) => {
            await updateSubject(id, data);
            await loadData();
          }}
          onToggleStatus={async (id) => {
            await toggleSubjectStatus(id);
            await loadData();
          }}
          onRefresh={loadData}
        />
      )}

      {/* Tab: Kelas */}
      {activeTab === 'classes' && (
        <AdminClassesSection
          classes={classes}
          teachers={teachers}
          onCreateClass={async (data) => {
            await createClass(data);
            await loadData();
          }}
          onUpdateClass={async (id, data) => {
            await updateClass(id, data);
            await loadData();
          }}
          onToggleStatus={async (id) => {
            await toggleClassStatus(id);
            await loadData();
          }}
          onRefresh={loadData}
        />
      )}

      {/* Tab: Penugasan Guru */}
      {activeTab === 'assignments' && (
        <AdminAssignmentsSection
          assignments={assignments}
          teachers={teachers}
          subjects={subjects}
          classes={classes}
          onSaveAssignment={async (data) => {
            await saveAssignment(data);
            await loadData();
          }}
          onDeleteAssignment={async (id) => {
            await deleteAssignment(id);
            await loadData();
          }}
          onRefresh={loadData}
        />
      )}

      {/* Tab: Manajemen Ujian Semua Guru (Admin Central Control) */}
      {activeTab === 'all_exams' && (
        editingExam ? (
          <ExamBuilder
            initialExam={editingExam}
            onBack={() => setEditingExam(null)}
            onSaved={(savedExam) => {
              const exists = exams.some((e) => e.id === savedExam.id);
              if (exists) {
                onUpdateExams(exams.map((e) => (e.id === savedExam.id ? savedExam : e)));
              } else {
                onUpdateExams([savedExam, ...exams]);
              }
            }}
          />
        ) : (
          <AdminExamManagementSection
            exams={exams}
            teachers={teachers}
            subjects={subjects}
            classes={classes}
            results={results}
            onUpdateExams={onUpdateExams}
            onEditExam={(exam) => setEditingExam(exam)}
            onViewResults={(examId) => setActiveTab('exam_results')}
          />
        )
      )}

      {/* Tab: Rekap Hasil Ujian (Admin Results & Export Center) */}
      {activeTab === 'exam_results' && (
        <AdminResultsCenterSection
          exams={exams}
          teachers={teachers}
          subjects={subjects}
          classes={classes}
        />
      )}

      {/* Tab: Bantuan Operasional & Recovery (Stage 8.3) */}
      {activeTab === 'operational_recovery' && (
        <AdminOperationalControlView
          exams={exams}
          adminId={user?.uid || 'admin_1'}
          adminName={user?.displayName || 'Administrator EXAMPUSA'}
          onRefreshExams={() => onUpdateExams([...exams])}
        />
      )}

      {/* Tab: Bank Soal & Ujian */}
      {activeTab === 'exam_management' && (
        <TeacherDashboard
          questions={questions}
          exams={exams}
          results={results}
          onUpdateQuestions={onUpdateQuestions}
          onUpdateExams={onUpdateExams}
          onUpdateResults={onUpdateResults}
        />
      )}
    </div>
  );
};
