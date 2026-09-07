import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import type { UserProfile, UserRole } from '../types';
import { mockTeachers } from '../data/mockData';

const INTERNAL_DOMAIN = 'sp1puspo.local';
const ADMIN_DEFAULT_USERNAME = 'adminpuspo1';
const INITIAL_DEFAULT_PASSWORD = 'smpn1puspo';

/**
 * Format internal email for Firebase Email/Password Auth.
 * NIP / Username is never exposed as an email in the UI.
 */
export function formatTeacherEmail(nip: string): string {
  const cleanNip = nip.trim().replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanNip}@${INTERNAL_DOMAIN}`;
}

export function formatAdminEmail(username: string): string {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanUsername}@${INTERNAL_DOMAIN}`;
}

/**
 * Translate technical Firebase error codes into clear Indonesian messages.
 * Never leaks raw stack traces or internal errors to users.
 */
export function mapAuthErrorMessage(error: any): string {
  if (!error) return 'Terjadi kesalahan autentikasi.';
  const code = error.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'Username/NIP atau password salah.';
    case 'auth/user-disabled':
      return 'Akun telah dinonaktifkan oleh administrator sekolah.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login gagal. Demi keamanan, silakan tunggu beberapa menit.';
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
    case 'auth/requires-recent-login':
      return 'Sesi Anda telah kedaluwarsa. Silakan login ulang sebelum mengganti password.';
    case 'auth/weak-password':
      return 'Password baru terlalu pendek/lemah. Gunakan minimal 6 karakter.';
    default:
      return error.message || 'Gagal masuk ke sistem. Silakan periksa kembali data Anda.';
  }
}

/**
 * Fetch user profile from Firestore `users/{uid}`
 */
export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('[Firestore] Gagal memuat user profile:', err);
  }
  return null;
}

/**
 * Sync / upsert user profile in Firestore `users/{uid}`
 */
export async function syncUserProfileToFirestore(profile: UserProfile): Promise<void> {
  if (!db) return;
  try {
    const ref = doc(db, 'users', profile.uid);
    await setDoc(
      ref,
      {
        ...profile,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Gagal menyimpan user profile ke Firestore:', err);
  }
}

/**
 * Sign in as Teacher using NIP and Password
 */
export async function signInTeacherWithNIP(nip: string, password: string): Promise<UserProfile> {
  const cleanNip = nip.trim();
  if (!cleanNip) {
    throw new Error('NIP wajib diisi.');
  }
  if (!password) {
    throw new Error('Password wajib diisi.');
  }

  // If Firebase is configured with a live backend:
  if (isFirebaseConfigured() && auth) {
    try {
      const email = formatTeacherEmail(cleanNip);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Try fetching existing profile from Firestore
      let profile = await fetchUserProfileFromFirestore(uid);

      if (!profile) {
        // Fallback default teacher profile initialization
        const matchedMock = mockTeachers.find((t) => t.nip === cleanNip);
        profile = {
          uid,
          email: cred.user.email || email,
          displayName: matchedMock ? matchedMock.displayName : `Guru NIP ${cleanNip}`,
          role: 'teacher',
          nip: cleanNip,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await syncUserProfileToFirestore(profile);
      }

      return profile;
    } catch (err: any) {
      throw new Error(mapAuthErrorMessage(err));
    }
  }

  // Development / Offline fallback mode (before Firebase Console credentials are populated in .env)
  const matchedTeacher = mockTeachers.find((t) => t.nip === cleanNip);
  if (matchedTeacher) {
    if (password !== INITIAL_DEFAULT_PASSWORD) {
      throw new Error('Username/NIP atau password salah.');
    }
    return {
      ...matchedTeacher,
      status: 'active'
    };
  }

  // Allow custom NIP in offline development
  if (cleanNip.length >= 8 && password === INITIAL_DEFAULT_PASSWORD) {
    return {
      uid: `teacher_${cleanNip}`,
      email: formatTeacherEmail(cleanNip),
      displayName: `Guru NIP ${cleanNip}`,
      role: 'teacher',
      nip: cleanNip,
      status: 'active'
    };
  }

  throw new Error('Username/NIP atau password salah.');
}

/**
 * Sign in as Admin using Username and Password
 */
export async function signInAdminWithUsername(username: string, password: string): Promise<UserProfile> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    throw new Error('Username admin wajib diisi.');
  }
  if (!password) {
    throw new Error('Password wajib diisi.');
  }

  // If Firebase is configured with a live backend:
  if (isFirebaseConfigured() && auth) {
    try {
      const email = formatAdminEmail(cleanUsername);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      let profile = await fetchUserProfileFromFirestore(uid);

      if (!profile) {
        profile = {
          uid,
          email: cred.user.email || email,
          displayName: 'Administrator SP1 Puspo',
          role: 'admin',
          username: cleanUsername,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await syncUserProfileToFirestore(profile);
      }

      return profile;
    } catch (err: any) {
      throw new Error(mapAuthErrorMessage(err));
    }
  }

  // Development / Offline fallback mode
  if (cleanUsername === ADMIN_DEFAULT_USERNAME && password === INITIAL_DEFAULT_PASSWORD) {
    return {
      uid: 'admin_sp1_puspo',
      email: formatAdminEmail(cleanUsername),
      displayName: 'Administrator SP1 Puspo',
      role: 'admin',
      username: ADMIN_DEFAULT_USERNAME,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  throw new Error('Username admin atau password salah.');
}

/**
 * Change current logged in user's password via Firebase Auth.
 * Password is NEVER written to Firestore plaintext.
 */
export async function changeCurrentUserPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password baru minimal terdiri dari 6 karakter.');
  }

  if (isFirebaseConfigured() && auth && auth.currentUser) {
    try {
      await updatePassword(auth.currentUser, newPassword);
      return;
    } catch (err: any) {
      throw new Error(mapAuthErrorMessage(err));
    }
  }

  // Offline / mock mode confirmation
  console.info('[Auth] Password berhasil diperbarui secara lokal (Mode Offline/Dev)');
}

/**
 * Sign out from Firebase Auth
 */
export async function signOutFromFirebase(): Promise<void> {
  if (isFirebaseConfigured() && auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[Firebase Auth] Sign out error:', err);
    }
  }
}
