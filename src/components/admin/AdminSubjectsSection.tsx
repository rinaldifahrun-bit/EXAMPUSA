import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X
} from 'lucide-react';
import type { Subject, Teacher } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AdminSubjectsSectionProps {
  subjects: Subject[];
  teachers: Teacher[];
  onCreateSubject: (data: { name: string; code: string }) => Promise<void>;
  onUpdateSubject: (id: string, data: { name?: string; code?: string; status?: 'active' | 'inactive' }) => Promise<void>;
  onToggleStatus: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export const AdminSubjectsSection: React.FC<AdminSubjectsSectionProps> = ({
  subjects,
  teachers,
  onCreateSubject,
  onUpdateSubject,
  onToggleStatus,
  onRefresh
}) => {
  const { success, error: toastError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssignedTeacherCount = (subjectId: string) => {
    return teachers.filter((t) => t.subjectIds && t.subjectIds.includes(subjectId)).length;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    const cleanCode = formCode.trim().toUpperCase();

    if (!cleanName) {
      setFormError('Nama mata pelajaran wajib diisi.');
      return;
    }
    if (!cleanCode) {
      setFormError('Kode mata pelajaran wajib diisi.');
      return;
    }

    if (subjects.some((s) => s.code.toUpperCase() === cleanCode)) {
      setFormError(`Kode mata pelajaran "${cleanCode}" sudah digunakan.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateSubject({ name: cleanName, code: cleanCode });
      success(`Mata pelajaran ${cleanName} berhasil ditambahkan.`);
      setIsCreateModalOpen(false);
      setFormName('');
      setFormCode('');
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan mata pelajaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setFormError('');

    const cleanName = formName.trim();
    const cleanCode = formCode.trim().toUpperCase();

    if (!cleanName) {
      setFormError('Nama mata pelajaran wajib diisi.');
      return;
    }
    if (!cleanCode) {
      setFormError('Kode mata pelajaran wajib diisi.');
      return;
    }

    if (
      cleanCode !== editingSubject.code &&
      subjects.some((s) => s.id !== editingSubject.id && s.code.toUpperCase() === cleanCode)
    ) {
      setFormError(`Kode mata pelajaran "${cleanCode}" sudah digunakan.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateSubject(editingSubject.id, { name: cleanName, code: cleanCode });
      success(`Mata pelajaran ${cleanName} berhasil diperbarui.`);
      setEditingSubject(null);
      setFormName('');
      setFormCode('');
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal memperbarui mata pelajaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari mata pelajaran berdasarkan nama atau kode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormCode('');
            setFormError('');
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tambah Mata Pelajaran
        </button>
      </div>

      {/* Subjects Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Nama Mata Pelajaran</th>
                <th className="py-3 px-4">Kode Mapel</th>
                <th className="py-3 px-4">Guru Pengampu</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada mata pelajaran yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub) => {
                  const teacherCount = getAssignedTeacherCount(sub.id);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <span>{sub.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-[11px] border border-slate-200">
                          {sub.code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-600">
                          {teacherCount > 0 ? (
                            <span className="font-semibold text-blue-600">{teacherCount} guru aktif</span>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada guru</span>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            sub.status !== 'inactive'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {sub.status !== 'inactive' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Aktif
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Nonaktif
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingSubject(sub);
                              setFormName(sub.name);
                              setFormCode(sub.code);
                              setFormError('');
                            }}
                            className="p-1.5 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Edit Mata Pelajaran"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                await onToggleStatus(sub.id);
                                success(
                                  `Mata pelajaran ${sub.name} berhasil ${
                                    sub.status !== 'inactive' ? 'dinonaktifkan' : 'diaktifkan'
                                  }.`
                                );
                                onRefresh();
                              } catch (err: any) {
                                toastError(err.message || 'Gagal mengubah status mata pelajaran.');
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition border cursor-pointer ${
                              sub.status !== 'inactive'
                                ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {sub.status !== 'inactive' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah Mata Pelajaran */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambah Mata Pelajaran</h3>
                  <p className="text-[11px] text-slate-500">Master kurikulum resmi sekolah</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Nama Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Informatika"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Kode Singkat Mapel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: INF"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
                <p className="text-[10px] text-slate-400">
                  Kode digunakan untuk pengelompokan bank soal dan kode token ujian.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Mata Pelajaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Mata Pelajaran */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Mata Pelajaran</h3>
                  <p className="text-[11px] text-slate-500">Perbarui data kurikulum</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSubject(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Kode Singkat Mapel</label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
