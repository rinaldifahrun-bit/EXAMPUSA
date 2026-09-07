import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserRole, StudentExamCredentials } from '../types';
import {
  signInTeacherWithNIP,
  signInAdminWithUsername,
  signOutFromFirebase,
  changeCurrentUserPassword,
  fetchUserProfileFromFirestore
} from '../services/firebaseAuthService';
import { authenticateStudentForExam } from '../services/studentAuthService';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { mockTeachers, mockStudents, mockAdmins } from '../data/mockData';

const CURRENT_USER_CACHE_KEY = 'sp1_puspo_user_session';
const CURRENT_STUDENT_SESSION_KEY = 'sp1_puspo_student_session';

export interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  isLoading: boolean;
  error: string | null;
  isFirebaseOnline: boolean;
  availableUsers: UserProfile[];
  loginTeacher: (nip: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  loginStudent: (creds: StudentExamCredentials) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  switchUser: (user: UserProfile) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isFirebaseOnline = isFirebaseConfigured();

  const clearError = useCallback(() => setError(null), []);

  // Listen to Firebase Authentication state changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      setIsLoading(true);

      // 1. If live Firebase Auth is available
      if (isFirebaseConfigured() && auth) {
        unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            try {
              // Retrieve user profile from Firestore
              const profile = await fetchUserProfileFromFirestore(fbUser.uid);
              if (profile) {
                setUser(profile);
                localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify(profile));
              } else {
                // Determine role from email if Firestore doc is missing
                const email = fbUser.email || '';
                const isAdminEmail = email.startsWith('adminpuspo1');
                const fallbackProfile: UserProfile = {
                  uid: fbUser.uid,
                  email,
                  displayName: isAdminEmail ? 'Administrator SP1 Puspo' : fbUser.displayName || 'Guru SP1 Puspo',
                  role: isAdminEmail ? 'admin' : 'teacher',
                  status: 'active'
                };
                setUser(fallbackProfile);
                localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify(fallbackProfile));
              }
            } catch (err) {
              console.warn('[AuthContext] Gagal memuat profil Firestore:', err);
            }
          } else {
            // Check if there is an active student session stored locally
            const savedStudent = localStorage.getItem(CURRENT_STUDENT_SESSION_KEY);
            if (savedStudent) {
              try {
                const parsed = JSON.parse(savedStudent);
                if (parsed && parsed.role === 'student') {
                  setUser(parsed);
                } else {
                  setUser(null);
                }
              } catch (e) {
                setUser(null);
              }
            } else {
              // No user logged in
              setUser(null);
              localStorage.removeItem(CURRENT_USER_CACHE_KEY);
            }
          }
          setIsLoading(false);
        });
      } else {
        // 2. Offline / Local fallback: restore from local session cache
        try {
          const cachedSession =
            localStorage.getItem(CURRENT_STUDENT_SESSION_KEY) ||
            localStorage.getItem(CURRENT_USER_CACHE_KEY);

          if (cachedSession) {
            const parsed = JSON.parse(cachedSession);
            if (parsed && parsed.role) {
              setUser(parsed);
            }
          }
        } catch (e) {
          console.warn('[AuthContext] Gagal memuat cache lokal:', e);
        }
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Login as Teacher using NIP
  const loginTeacher = async (nip: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await signInTeacherWithNIP(nip, password);
      setUser(profile);
      localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify(profile));
      localStorage.removeItem(CURRENT_STUDENT_SESSION_KEY);
    } catch (err: any) {
      setError(err.message || 'Login Guru gagal.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Login as Admin using Username
  const loginAdmin = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await signInAdminWithUsername(username, password);
      setUser(profile);
      localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify(profile));
      localStorage.removeItem(CURRENT_STUDENT_SESSION_KEY);
    } catch (err: any) {
      setError(err.message || 'Login Admin gagal.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Login as Student for an Exam
  const loginStudent = async (creds: StudentExamCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const { student } = await authenticateStudentForExam(creds);
      setUser(student);
      localStorage.setItem(CURRENT_STUDENT_SESSION_KEY, JSON.stringify(student));
      localStorage.removeItem(CURRENT_USER_CACHE_KEY);
    } catch (err: any) {
      setError(err.message || 'Verifikasi siswa gagal.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setIsLoading(true);
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.warn('[AuthContext] Error saat sign out:', err);
    } finally {
      setUser(null);
      localStorage.removeItem(CURRENT_USER_CACHE_KEY);
      localStorage.removeItem(CURRENT_STUDENT_SESSION_KEY);
      setIsLoading(false);
    }
  };

  // Change Password for current user
  const changePassword = async (newPassword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await changeCurrentUserPassword(newPassword);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Switch User (kept for quick developer switching / testing)
  const switchUser = (newUser: UserProfile) => {
    setUser(newUser);
    if (newUser.role === 'student') {
      localStorage.setItem(CURRENT_STUDENT_SESSION_KEY, JSON.stringify(newUser));
      localStorage.removeItem(CURRENT_USER_CACHE_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify(newUser));
      localStorage.removeItem(CURRENT_STUDENT_SESSION_KEY);
    }
  };

  const role = user?.role || null;
  const isAuthenticated = !!user;
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const isStudent = role === 'student';

  const availableUsers = [...mockAdmins, ...mockTeachers, ...mockStudents];

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isTeacher,
        isAdmin,
        isStudent,
        isLoading,
        error,
        isFirebaseOnline,
        availableUsers,
        loginTeacher,
        loginAdmin,
        loginStudent,
        logout,
        changePassword,
        switchUser,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
