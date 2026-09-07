import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase Configuration Loader
 * Reads from environment variables (Vite import.meta.env)
 * Never hardcodes production secrets into source code.
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : ((typeof process !== 'undefined' && process.env) ? process.env : {} as any);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/**
 * Check if the Firebase environment variables are populated with actual values
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('MY_') &&
    firebaseConfig.apiKey !== 'undefined'
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (err) {
    console.error('[Firebase] Inisialisasi Firebase gagal:', err);
  }
} else {
  console.info(
    '[Firebase] Mode Lokal/Dev Fallback aktif. Variabel VITE_FIREBASE_* belum dikonfigurasi di .env. Aplikasi menggunakan local storage & Dexie.'
  );
}

export { app, auth, db, db as firestore, storage };
