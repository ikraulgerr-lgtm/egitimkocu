import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithCredential,
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId to getFirestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Set auth persistence to browser local storage so user sessions remain logged in
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase setPersistence error:', err);
});

export async function loginWithEmailFirebase(email: string, pass: string) {
  const cleanEmail = email.trim();
  let resolvedUser: any = null;

  if (Capacitor.isNativePlatform()) {
    try {
      const nativeRes = await FirebaseAuthentication.signInWithEmailAndPassword({
        email: cleanEmail,
        password: pass,
      });
      if (nativeRes?.user) {
        resolvedUser = {
          uid: nativeRes.user.uid,
          email: nativeRes.user.email || cleanEmail,
          displayName: nativeRes.user.displayName || 'Öğrenci',
          photoURL: nativeRes.user.photoUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        };
      }
    } catch (nativeErr: any) {
      console.warn('Native signInWithEmailAndPassword error, trying JS SDK...', nativeErr);
      const msg = (nativeErr?.message || '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('wrong') || msg.includes('not-found') || msg.includes('user_not_found')) {
        throw nativeErr;
      }
    }
  }

  if (resolvedUser) {
    // Non-blocking JS SDK synchronization (max 2s)
    Promise.race([
      signInWithEmailAndPassword(auth, cleanEmail, pass),
      new Promise((r) => setTimeout(r, 2000)),
    ]).catch((e) => {
      console.warn('JS SDK sync after native login warning (non-fatal):', e);
    });
    return resolvedUser;
  }

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    return result.user;
  } catch (error) {
    console.error('Firebase Login Error:', error);
    throw error;
  }
}

export async function registerWithEmailFirebase(
  email: string,
  pass: string,
  name: string,
  extraData?: {
    username?: string;
    targetExam?: string;
    targetExamDate?: string;
    sinif?: string;
  }
) {
  const cleanEmail = email.trim();
  const cleanName = name ? name.trim() : 'Öğrenci';
  const cleanUsername = (extraData?.username || cleanEmail.split('@')[0] || 'ogrenci').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const targetExam = extraData?.targetExam || 'YKS';
  const targetExamDate = extraData?.targetExamDate || '2027-06-19';
  const sinifVal = extraData?.sinif || (targetExam === 'LGS' ? '8. Sınıf (LGS)' : targetExam === 'YKS' ? '12. Sınıf / Mezun (YKS)' : 'YKS / LGS Hazırlık');

  let resolvedUser: any = null;

  if (Capacitor.isNativePlatform()) {
    try {
      const nativeRes = await FirebaseAuthentication.createUserWithEmailAndPassword({
        email: cleanEmail,
        password: pass,
      });
      try {
        await FirebaseAuthentication.updateProfile({ displayName: cleanName });
      } catch (e) {}
      if (nativeRes?.user) {
        resolvedUser = {
          uid: nativeRes.user.uid,
          email: nativeRes.user.email || cleanEmail,
          displayName: cleanName,
          photoURL: nativeRes.user.photoUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        };
      }
    } catch (nativeErr: any) {
      console.warn('Native createUserWithEmailAndPassword error, trying JS SDK fallback...', nativeErr);
      const msg = (nativeErr?.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('weak') || msg.includes('invalid')) {
        throw nativeErr;
      }
    }
  }

  // Also authenticate on the JS SDK side non-blockingly (max 2s) so auth.currentUser is synchronized
  if (resolvedUser) {
    Promise.race([
      signInWithEmailAndPassword(auth, cleanEmail, pass),
      new Promise((r) => setTimeout(r, 2000)),
    ]).catch((jsErr) => {
      console.warn('Syncing JS SDK auth after native registration (non-fatal):', jsErr);
    });
  } else {
    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      try {
        await updateProfile(result.user, { displayName: cleanName });
      } catch (e) {}
      resolvedUser = result.user;
    } catch (error) {
      console.error('Firebase Register Error:', error);
      throw error;
    }
  }

  // Write initial user profile to Firestore non-blockingly (fire and forget with error logging)
  try {
    const userDocRef = doc(db, 'users', resolvedUser.uid);
    const initialDocData = {
      id: resolvedUser.uid,
      ad: cleanName,
      kullaniciAdi: cleanUsername,
      kullaniciAdi_lower: cleanUsername,
      email: cleanEmail,
      kredi: 10,
      maxKredi: 10,
      seri: 1,
      xp: 0,
      isPremium: false,
      sinif: sinifVal,
      avatarUrl: resolvedUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
      targetExam: targetExam,
      targetExamDate: targetExamDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    Promise.race([
      setDoc(userDocRef, initialDocData, { merge: true }),
      new Promise((r) => setTimeout(r, 2000)),
    ]).catch((err) => {
      console.warn('Firestore initial user setDoc warning (non-fatal):', err);
    });
  } catch (err) {
    console.warn('Firestore initial user setup warning:', err);
  }

  return resolvedUser;
}

export async function loginWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      let result: any;
      const nativeSignInPromise = async () => {
        return await FirebaseAuthentication.signInWithGoogle();
      };

      // 30-second timeout safety to guarantee UI never hangs indefinitely
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google ile giriş zaman aşımına uğradı. Lütfen tekrar deneyin.')), 30000)
      );

      result = await Promise.race([nativeSignInPromise(), timeoutPromise]);

      console.log('FirebaseAuthentication.signInWithGoogle result:', result);

      const idToken =
        result?.credential?.idToken ||
        result?.idToken ||
        result?.credential?.token ||
        (result?.user as any)?.idToken;
      const accessToken =
        result?.credential?.accessToken ||
        result?.accessToken;

      // Synchronize JS SDK auth in background non-blockingly (max 2.5s)
      if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
          Promise.race([
            signInWithCredential(auth, credential),
            new Promise((r) => setTimeout(r, 2500)),
          ]).catch((credErr) => {
            console.warn('signInWithCredential with idToken error (non-fatal):', credErr);
          });
        } catch (e) {}
      }

      if (result?.user) {
        return {
          uid: result.user.uid,
          displayName: result.user.displayName || 'Öğrenci',
          email: result.user.email || 'ogrenci@egitimkocum.ai',
          photoURL: result.user.photoUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        } as any;
      }

      if (auth.currentUser) {
        return auth.currentUser;
      }

      throw new Error('Google giriş kimliği doğrulanamadı.');
    } catch (err: any) {
      console.error('Native Google Sign-In Error:', err);
      const msg = err?.message || '';
      if (msg.includes('cancel') || msg.includes('Canceled') || msg.includes('16') || msg.includes('cancelled') || msg.includes('user cancelled')) {
        throw new Error('Giriş işlemi iptal edildi.');
      }
      throw new Error(msg || 'Google ile giriş başarısız oldu.');
    }
  }

  // WEB BROWSER ONLY (Not reached on Native)
  try {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Popup Login Error:', error);
    throw error;
  }
}

export async function logoutFirebase() {
  try {
    if (Capacitor.isNativePlatform()) {
      try { await FirebaseAuthentication.signOut(); } catch (e) {}
    }
    await signOut(auth);
  } catch (error) {
    console.error('Logout Error:', error);
  }
}

export async function resetPasswordFirebase(email: string) {
  const cleanEmail = email.trim();
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.sendPasswordResetEmail({ email: cleanEmail });
      return true;
    } catch (nativeErr) {
      console.warn('Native sendPasswordResetEmail error, trying JS SDK...', nativeErr);
    }
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return true;
  } catch (error) {
    console.error('Firebase Password Reset Error:', error);
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Warning:', errInfo);
}
