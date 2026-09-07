import React, { useState } from 'react';
import {
  Link2,
  Plus,
  Trash2,
  Filter,
  Users,
  BookOpen,
  School,
  AlertCircle,
  X,
  CheckCircle2,
  Layers
} from 'lucide-react';
import type { TeacherAssignment, Teacher, Subject, SchoolClass } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AdminAssignmentsSectionProps {
  assignments: TeacherAssignment[];
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  onSaveAssignment: (data: {
    teacherId: string;
    subjectId: string;
    classIds: string[];
  }) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export const AdminAssignmentsSection: React.FC<AdminAssignmentsSectionProps> = ({
  assignments,
  teachers,
  subjects,
  classes,
  onSaveAssignment,
  onDeleteAssignment,
  onRefresh
}) => {
  const { success, error: toastError } = useToast();
  const [filterTeacherId, setFilterTeacherId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  const getTeacher = (id: string) => teachers.find((t) => t.id === id);
  const getSubject = (id: string) => subjects.find((s) => s.id === id);
  const getClassName = (id: string) => {
    const c = classes.find((cls) => cls.id === id);
    return c ? c.name : id;
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filterTeacherId === 'all') return true;
    return a.teacherId === filterTeacherId;
  });

  const handleClassToggle = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  const handleSelectAllClasses = () => {
    const activeClassIds = classes.filter((c) => c.status !== 'inactive').map((c) => c.id);
    setSelectedClassIds(activeClassIds);
  };

  const handleClearClasses = () => {
    setSelectedClassIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!teacherId) {
      setFormError('Silakan pilih guru.');
      return;
    }
    if (!subjectId) {
      setFormError('Silakan pilih mata pelajaran.');
      return;
    }
    if (selectedClassIds.length === 0) {
      setFormError('Pilih minimal satu kelas yang diajar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveAssignment({
        teacherId,
        subjectId,
        classIds: selectedClassIds
      });

      const tObj = getTeacher(teacherId);
      const sObj = getSubject(subjectId);
      success(
        `Penugasan berhasil: ${tObj?.name || 'Guru'} mengampu ${sObj?.name || 'Mapel'} pada ${
          selectedClassIds.length
        } kelas.`
      );

      setIsModalOpen(false);
      setTeacherId('');
      setSubjectId('');
      setSelectedClassIds([]);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan penugasan guru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterTeacherId}
            onChange={(e) => setFilterTeacherId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="all">Semua Guru ({assignments.length} penugasan)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (NIP: {t.nip})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setTeacherId('');
            setSubjectId('');
            setSelectedClassIds([]);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Buat Penugasan Mengajar
        </button>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Guru</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4">Rombongan Belajar / Kelas yang Diajar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada data penugasan yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((asg) => {
                  const teacher = getTeacher(asg.teacherId);
                  const subject = getSubject(asg.subjectId);

                  return (
                    <tr key={asg.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center font-bold text-[11px]">
                            {teacher?.name ? teacher.name.substring(0, 2).toUpperCase() : 'GU'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{teacher?.name || asg.teacherId}</p>
                            <p className="text-[11px] text-slate-500 font-mono">NIP: {teacher?.nip || '-'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold">
                          <BookOpen className="w-3.5 h-3.5" />
                          {subject?.name || asg.subjectId} ({subject?.code || '-'})
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {asg.classIds && asg.classIds.length > 0 ? (
                            asg.classIds.map((cId) => (
                              <span
                                key={cId}
                                className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[11px] font-semibold"
                              >
                                {getClassName(cId)}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">Belum ada kelas</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={async () => {
                            if (confirm('Apakah Anda yakin ingin menghapus penugasan ini?')) {
                              try {
                                await onDeleteAssignment(asg.id);
                                success('Penugasan berhasil dihapus.');
                                onRefresh();
                              } catch (err: any) {
                                toastError(err.message || 'Gagal menghapus penugasan.');
                              }
                            }
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Hapus Penugasan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Buat Penugasan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Buat Penugasan Mengajar</h3>
                  <p className="text-[11px] text-slate-500">
                    Relasi Guru ↔ Mata Pelajaran ↔ Rombongan Belajar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Pilih Guru <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers
                    .filter((t) => t.status !== 'inactive')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (NIP: {t.nip})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Pilih Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects
                    .filter((s) => s.status !== 'inactive')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">
                    Pilih Kelas yang Diajar <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllClasses}
                      className="text-[11px] text-blue-600 hover:underline cursor-pointer font-medium"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleClearClasses}
                      className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 max-h-40 overflow-y-auto">
                  {classes
                    .filter((c) => c.status !== 'inactive')
                    .map((c) => {
                      const isChecked = selectedClassIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition text-xs font-semibold ${
                            isChecked ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200/70 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleClassToggle(c.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                </div>
                <p className="text-[10px] text-slate-400">
                  {selectedClassIds.length} kelas dipilih. Satu guru dapat mengampu mapel yang sama di banyak kelas (misal: Informatika di VII-A, VIII-A, IX-A).
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Penugasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
