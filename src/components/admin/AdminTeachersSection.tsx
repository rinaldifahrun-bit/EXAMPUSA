import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  BookOpen,
  School,
  AlertCircle,
  X,
  Lock,
  Info
} from 'lucide-react';
import type { Teacher, Subject, SchoolClass } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AdminTeachersSectionProps {
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  onToggleStatus: (id: string) => Promise<void>;
  onCreateTeacher: (data: {
    nip: string;
    name: string;
    initialSubjectId?: string;
    initialClassIds?: string[];
    status?: 'active' | 'inactive';
  }) => Promise<void>;
  onRefresh: () => void;
}

export const AdminTeachersSection: React.FC<AdminTeachersSectionProps> = ({
  teachers,
  subjects,
  classes,
  onToggleStatus,
  onCreateTeacher,
  onRefresh
}) => {
  const { success, error: toastError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [nip, setNip] = useState('');
  const [name, setName] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nip.includes(searchTerm)
  );

  const getSubjectName = (id: string) => {
    const s = subjects.find((sub) => sub.id === id);
    return s ? s.name : id;
  };

  const getClassName = (id: string) => {
    const c = classes.find((cls) => cls.id === id);
    return c ? c.name : id;
  };

  const handleClassToggle = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanNip = nip.trim();
    const cleanName = name.trim();

    if (!cleanNip) {
      setFormError('NIP guru wajib diisi.');
      return;
    }
    if (!cleanName) {
      setFormError('Nama lengkap guru wajib diisi.');
      return;
    }

    // Check duplicate
    if (teachers.some((t) => t.nip === cleanNip)) {
      setFormError(`NIP ${cleanNip} sudah digunakan oleh guru lain.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTeacher({
        nip: cleanNip,
        name: cleanName,
        initialSubjectId: selectedSubjectId || undefined,
        initialClassIds: selectedClassIds.length > 0 ? selectedClassIds : undefined,
        status: 'active'
      });
      success(`Akun guru ${cleanName} berhasil ditambahkan.`);
      setIsModalOpen(false);
      setNip('');
      setName('');
      setSelectedSubjectId('');
      setSelectedClassIds([]);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan guru.');
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
            placeholder="Cari guru berdasarkan Nama atau NIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => {
            setFormError('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tambah Akun Guru
        </button>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Nama & NIP</th>
                <th className="py-3 px-4">Mata Pelajaran yang Diampu</th>
                <th className="py-3 px-4">Kelas yang Diajar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada data guru yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {teacher.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{teacher.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">NIP: {teacher.nip}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {teacher.subjectIds && teacher.subjectIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {teacher.subjectIds.map((subId) => (
                            <span
                              key={subId}
                              className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[11px] font-semibold"
                            >
                              {getSubjectName(subId)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Belum ada penugasan mapel</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {teacher.classIds && teacher.classIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {teacher.classIds.map((clsId) => (
                            <span
                              key={clsId}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-semibold"
                            >
                              {getClassName(clsId)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Belum ada kelas</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          teacher.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {teacher.status === 'active' ? (
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
                      <button
                        onClick={async () => {
                          try {
                            await onToggleStatus(teacher.id);
                            success(
                              `Status ${teacher.name} diubah menjadi ${
                                teacher.status === 'active' ? 'Nonaktif' : 'Aktif'
                              }`
                            );
                            onRefresh();
                          } catch (err: any) {
                            toastError(err.message || 'Gagal mengubah status guru.');
                          }
                        }}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold transition border cursor-pointer ${
                          teacher.status === 'active'
                            ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {teacher.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah Akun Guru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambah Akun Guru Baru</h3>
                  <p className="text-[11px] text-slate-500">
                    Kredensial login resmi guru EXAMPUSA
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
                  Nomor Induk Pegawai (NIP) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 198705142011011005"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  NIP digunakan sebagai username login utama guru dan tidak dapat diubah sembarangan.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Nama Lengkap Guru (beserta Gelar) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bpk. Ahmad Dahlan, M.Pd."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Mata Pelajaran Awal (Opsional)
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Pilih Mata Pelajaran Awal --</option>
                  {subjects
                    .filter((s) => s.status !== 'inactive')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Guru dapat mengampu banyak mata pelajaran lainnya di menu Penugasan.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Kelas Awal yang Diajar (Opsional)
                </label>
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 max-h-36 overflow-y-auto">
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
              </div>

              {/* Password Notice */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Password Bawaan Akun Baru</span>
                </div>
                <p className="text-slate-600">
                  Password bawaan adalah: <span className="font-mono font-bold text-blue-800">smpn1puspo</span>.
                  Guru dapat mengubah password mereka sendiri secara aman melalui Firebase Authentication setelah berhasil login.
                </p>
              </div>

              {/* Architecture Info */}
              <div className="flex items-start gap-2 text-[10px] text-slate-400">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Sesuai prinsip keamanan EXAMPUSA, password tidak disimpan di Firestore. Kredensial diproses aman oleh Firebase Auth.
                </span>
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
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Akun Guru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
