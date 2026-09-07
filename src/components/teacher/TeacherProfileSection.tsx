import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  BookOpen,
  School,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Layers,
  Info,
  Calendar,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchSubjects,
  fetchClasses,
  fetchTeacherAssignments,
  fetchTeachers
} from '../../services/masterDataService';
import type { Subject, SchoolClass, TeacherAssignment, Teacher } from '../../types';

export const TeacherProfileSection: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfileData() {
      try {
        setLoading(true);
        const [allSubjects, allClasses, allTeachers] = await Promise.all([
          fetchSubjects(),
          fetchClasses(),
          fetchTeachers()
        ]);

        setSubjects(allSubjects);
        setClasses(allClasses);

        // Find teacher record by uid or nip
        const currentTeacher = allTeachers.find(
          (t) =>
            t.id === user?.uid ||
            (user?.nip && t.nip === user.nip) ||
            t.uid === user?.uid ||
            t.name.toLowerCase() === user?.displayName.toLowerCase()
        );

        if (currentTeacher) {
          setTeacherData(currentTeacher);
          const teacherAsgs = await fetchTeacherAssignments(currentTeacher.id);
          setAssignments(teacherAsgs);
        }
      } catch (err) {
        console.error('Gagal memuat profil guru:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfileData();
  }, [user]);

  const getSubject = (id: string) => subjects.find((s) => s.id === id);
  const getClassName = (id: string) => {
    const c = classes.find((cls) => cls.id === id);
    return c ? c.name : id;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
        Memuat data profil & penugasan mengajar...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
              {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'GU'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{user?.displayName || 'Nama Guru'}</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Akun Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                NIP: {user?.nip || teacherData?.nip || '198504122010011008'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Guru Mata Pelajaran — SMPN 1 Puspo
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-right sm:min-w-[180px]">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Peran Pengguna</p>
            <p className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Pendidik / Guru
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Platform EXAMPUSA</p>
          </div>
        </div>

        {/* Security & Ownership Policy Notice */}
        <div className="mt-6 p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-950">Kebijakan Pengelolaan Data Guru</p>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              Sesuai standar operasional dan keamanan EXAMPUSA, NIP, status akun, serta penetapan mata pelajaran dan kelas yang Anda ampu dikelola secara terpusat oleh <strong>Administrator Sekolah</strong>. Guru tidak dapat mengubah NIP, peran, status, maupun penugasan dirinya sendiri.
            </p>
          </div>
        </div>
      </div>

      {/* Teaching Assignments Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Penugasan Mengajar Aktif
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mata pelajaran dan kelas yang ditugaskan kepada Anda pada tahun ajaran ini
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60">
            {assignments.length} Penugasan
          </span>
        </div>

        {assignments.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
            Belum ada penugasan mengajar yang tercatat. Silakan hubungi Administrator Sekolah untuk pendaftaran mata pelajaran dan rombongan belajar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map((asg) => {
              const subject = getSubject(asg.subjectId);
              return (
                <div
                  key={asg.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">
                          {subject?.name || asg.subjectId}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold">
                          {subject?.code || 'MAPEL'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                      Aktif
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <School className="w-3.5 h-3.5 text-slate-400" />
                      <span>Rombongan Belajar / Kelas:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {asg.classIds && asg.classIds.length > 0 ? (
                        asg.classIds.map((cId) => (
                          <span
                            key={cId}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                          >
                            Kelas {getClassName(cId)}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs italic">Semua Kelas</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scope of Ownership Directive (Bagian 18) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-3 text-xs text-slate-600">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-600" />
          Hak Akses & Kepemilikan Data (Ownership)
        </h4>
        <p className="leading-relaxed text-[11px]">
          Setiap butir soal di Bank Soal dan paket ujian yang Anda buat secara otomatis terhubung dengan identitas Anda (<code>owner_id</code>). Guru hanya memiliki hak kelola penuh atas bank soal dan paket ujian miliknya sendiri, demi menjaga kerahasiaan materi evaluasi dan integritas penilaian sekolah.
        </p>
      </div>
    </div>
  );
};
