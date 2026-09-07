import React from 'react';
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

interface ExamSubmitDialogProps {
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  missingRequiredCount: number;
  isSubmitting: boolean;
  onConfirmSubmit: () => void;
  onCancel: () => void;
  onReviewMissing: () => void;
}

export const ExamSubmitDialog: React.FC<ExamSubmitDialogProps> = ({
  totalQuestions,
  answeredCount,
  unansweredCount,
  missingRequiredCount,
  isSubmitting,
  onConfirmSubmit,
  onCancel,
  onReviewMissing
}) => {
  const hasMissingRequired = missingRequiredCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Konfirmasi Pengiriman Ujian
              </h3>
              <p className="text-[11px] text-slate-500">
                Pastikan seluruh jawaban Anda telah terisi dengan benar.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Metrics Box */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Total Soal
            </span>
            <span className="text-base font-extrabold text-slate-800">
              {totalQuestions}
            </span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 block uppercase">
              Terjawab
            </span>
            <span className="text-base font-extrabold text-emerald-700">
              {answeredCount}
            </span>
          </div>
          <div className={`p-2 rounded-lg border shadow-2xs ${unansweredCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-white border-slate-100 text-slate-400'}`}>
            <span className="text-[10px] font-bold block uppercase">
              Belum Diisi
            </span>
            <span className="text-base font-extrabold">
              {unansweredCount}
            </span>
          </div>
        </div>

        {/* Warning if missing required questions */}
        {hasMissingRequired ? (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                Masih ada {missingRequiredCount} soal bertanda wajib (*) yang belum dijawab!
              </p>
              <p className="text-[11px] text-rose-700">
                Sesuai peraturan ujian, soal bertanda wajib harus diisi sebelum ujian dapat dikirimkan.
              </p>
              <button
                onClick={onReviewMissing}
                className="mt-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Periksa Soal Wajib</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : unansweredCount > 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Anda masih memiliki {unansweredCount} butir soal yang belum dijawab.
              </p>
              <p className="text-[11px] text-amber-700">
                Apakah Anda yakin ingin menyelesaikan ujian sekarang?
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="font-semibold">
              Hebat! Seluruh {totalQuestions} butir soal telah berhasil Anda jawab.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            Kembali ke Ujian
          </button>

          <button
            type="button"
            onClick={onConfirmSubmit}
            disabled={hasMissingRequired || isSubmitting}
            className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer ${
              hasMissingRequired || isSubmitting
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Mengirim Jawaban...' : 'Ya, Kirim Jawaban'}
          </button>
        </div>
      </div>
    </div>
  );
};
