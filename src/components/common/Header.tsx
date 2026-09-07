import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import {
  GraduationCap,
  ShieldCheck,
  Wifi,
  WifiOff,
  UserCheck,
  ChevronDown,
  Sparkles,
  BookOpen,
  Award,
  LogOut,
  Key,
  ShieldAlert
} from 'lucide-react';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const { user, isTeacher, isAdmin, isStudent, switchUser, availableUsers, logout } = useAuth();
  const { isOnline, pendingSyncCount } = useSync();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (!user) return null;

  const getRoleLabel = () => {
    if (user.role === 'admin') return 'Administrator SP1';
    if (user.role === 'teacher') return `Guru (NIP: ${user.nip || '-'})`;
    return `Murid (${user.className || 'IX-A'})`;
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand / Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-base shadow-sm">
              EX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  EXAMPUSA
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  Platform Ujian
                </span>
              </div>
            </div>
          </div>

          {/* Center: Online/Sync State */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <Wifi className="w-3.5 h-3.5 text-green-400" />
                <span className="text-slate-300 font-medium">Server Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 font-medium">Mode Offline (Dexie DB)</span>
              </>
            )}
            {pendingSyncCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                {pendingSyncCount} antrean
              </span>
            )}
          </div>

          {/* Right: Role Switcher, Password Change & Logout */}
          <div className="flex items-center gap-3 relative">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/90 border border-slate-700 transition text-left cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-xs shadow-sm ${
                  user.role === 'admin' ? 'bg-amber-600' : user.role === 'teacher' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}>
                  {user.displayName.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-white leading-tight">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {getRoleLabel()}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Dropdown Menu for user actions & quick testing */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Akun Aktif
                    </p>
                    <p className="text-xs font-semibold text-white truncate mt-0.5">
                      {user.displayName}
                    </p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-blue-400 border border-slate-700">
                      Role: {user.role.toUpperCase()}
                    </span>
                  </div>

                  {/* Actions for Teacher & Admin */}
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <div className="py-1 border-b border-slate-800">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowPasswordModal(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <Key className="w-3.5 h-3.5 text-blue-400" />
                        <span>Ubah Password Akun</span>
                      </button>
                    </div>
                  )}

                  {/* Quick role switch for dev / testers */}
                  <div className="py-1 border-b border-slate-800">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Ganti Akun Cepat (Testing)
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {availableUsers.map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => {
                            switchUser(u);
                            setShowUserMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs transition ${
                            u.uid === user.uid
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              u.role === 'admin'
                                ? 'bg-amber-400'
                                : u.role === 'teacher'
                                ? 'bg-blue-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-xs">{u.displayName}</p>
                            <p className="text-[9px] text-slate-400">
                              {u.role.toUpperCase()}
                            </p>
                          </div>
                          {u.uid === user.uid && (
                            <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-1">
                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        await logout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};
