import React, { useState } from 'react';
import {
  School,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Users
} from 'lucide-react';
import type { SchoolClass, Teacher } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AdminClassesSectionProps {
  classes: SchoolClass[];
  teachers: Teacher[];
  onCreateClass: (data: { name: string; grade?: string }) => Promise<void>;
  onUpdateClass: (id: string, data: { name?: string; grade?: string; status?: 'active' | 'inactive' }) => Promise<void>;
  onToggleStatus: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export const AdminClassesSection: React.FC<AdminClassesSectionProps> = ({
  classes,
  teachers,
  onCreateClass,
  onUpdateClass,
  onToggleStatus,
  onRefresh
}) => {
  const { success, error: toastError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  const [formName, setFormName] = useState('');
  const [formGrade, setFormGrade] = useState('VII');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.grade && c.grade.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getTeachersInClassCount = (classId: string) => {
    return teachers.filter((t) => t.classIds && t.classIds.includes(classId)).length;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Nama kelas wajib diisi.');
      return;
    }

    if (classes.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      setFormError(`Kelas "${cleanName}" sudah terdaftar.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateClass({ name: cleanName, grade: formGrade });
      success(`Kelas ${cleanName} berhasil ditambahkan.`);
      setIsCreateModalOpen(false);
      setFormName('');
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan kelas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setFormError('');

    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Nama kelas wajib diisi.');
      return;
    }

    if (
      cleanName.toLowerCase() !== editingClass.name.toLowerCase() &&
      classes.some((c) => c.id !== editingClass.id && c.name.toLowerCase() === cleanName.toLowerCase())
    ) {
      setFormError(`Kelas "${cleanName}" sudah terdaftar.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateClass(editingClass.id, { name: cleanName, grade: formGrade });
      success(`Kelas ${cleanName} berhasil diperbarui.`);
      setEditingClass(null);
      setFormName('');
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal memperbarui kelas.');
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
            placeholder="Cari kelas (contoh: VII-A, VIII-B, IX-A)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormGrade('VII');
            setFormError('');
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tambah Kelas
        </button>
      </div>

      {/* Classes Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Nama Kelas</th>
                <th className="py-3 px-4">Tingkat / Jenjang</th>
                <th className="py-3 px-4">Guru yang Mengajar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada kelas yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => {
                  const teacherCount = getTeachersInClassCount(cls.id);
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <School className="w-4 h-4 text-blue-600" />
                          <span>Kelas {cls.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                          Tingkat {cls.grade || 'VII'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-600">
                          {teacherCount > 0 ? (
                            <span className="font-semibold text-blue-600">{teacherCount} guru aktif</span>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada penugasan guru</span>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            cls.status !== 'inactive'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {cls.status !== 'inactive' ? (
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
                              setEditingClass(cls);
                              setFormName(cls.name);
                              setFormGrade(cls.grade || 'VII');
                              setFormError('');
                            }}
                            className="p-1.5 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Edit Kelas"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                await onToggleStatus(cls.id);
                                success(
                                  `Kelas ${cls.name} berhasil ${
                                    cls.status !== 'inactive' ? 'dinonaktifkan' : 'diaktifkan'
                                  }.`
                                );
                                onRefresh();
                              } catch (err: any) {
                                toastError(err.message || 'Gagal mengubah status kelas.');
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition border cursor-pointer ${
                              cls.status !== 'inactive'
                                ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {cls.status !== 'inactive' ? 'Nonaktifkan' : 'Aktifkan'}
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

      {/* Modal: Tambah Kelas */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambah Kelas Baru</h3>
                  <p className="text-[11px] text-slate-500">Master rombongan belajar sekolah</p>
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
                  Nama Kelas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: VII-A, VIII-B, atau IX-C"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Tingkat / Jenjang</label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="VII">Tingkat VII (Kelas 7)</option>
                  <option value="VIII">Tingkat VIII (Kelas 8)</option>
                  <option value="IX">Tingkat IX (Kelas 9)</option>
                </select>
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
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Kelas */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Kelas</h3>
                  <p className="text-[11px] text-slate-500">Perbarui informasi rombel</p>
                </div>
              </div>
              <button
                onClick={() => setEditingClass(null)}
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
                <label className="block font-semibold text-slate-700">Nama Kelas</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Tingkat / Jenjang</label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="VII">Tingkat VII (Kelas 7)</option>
                  <option value="VIII">Tingkat VIII (Kelas 8)</option>
                  <option value="IX">Tingkat IX (Kelas 9)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
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
