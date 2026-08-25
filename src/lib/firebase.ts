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
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error('Firebase Login Error:', error);
    throw error;
  }
}

export async function registerWithEmailFirebase(email: string, pass: string, name: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      const cleanName = name ? name.trim() : 'Öğrenci';
      try {
        await updateProfile(result.user, { displayName: cleanName });
      } catch (e) {}

      try {
        const userDocRef = doc(db, 'users', result.user.uid);
        await setDoc(userDocRef, {
          id: result.user.uid,
          ad: cleanName,
          email: email,
          kredi: 10,
          maxKredi: 10,
          seri: 1,
          xp: 0,
          isPremium: false,
          sinif: 'YKS / LGS Hazırlık',
          avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        }, { merge: true });
      } catch (err) {
        console.warn('Firestore initial user setDoc warning:', err);
      }
    }
    return result.user;
  } catch (error) {
    console.error('Firebase Register Error:', error);
    throw error;
  }
}

export async function loginWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      let result;
      // Try with useCredentialManager: false first to avoid "No credentials available" error on Android
      try {
        result = await (FirebaseAuthentication as any).signInWithGoogle({
          scopes: ['email', 'profile'],
          useCredentialManager: false,
        });
      } catch (firstErr: any) {
        console.warn('Google Sign-In with useCredentialManager=false failed, retrying with default:', firstErr);
        result = await FirebaseAuthentication.signInWithGoogle({
          scopes: ['email', 'profile'],
        });
      }

      if (result?.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(
          result.credential.idToken,
          result.credential.accessToken ?? undefined
        );
        const userCred = await signInWithCredential(auth, credential);
        return userCred.user;
      }

      if (auth.currentUser) {
        return auth.currentUser;
      }

      throw new Error('Google giriş kimliği alınamadı. Lütfen tekrar deneyin.');
    } catch (err: any) {
      console.error('Native Google Sign-In Error:', err?.message || err);
      throw new Error(err?.message || 'Google ile giriş başarısız oldu.');
    }
  }

  // WEB BROWSER ONLY
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
  try {
    await sendPasswordResetEmail(auth, email);
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
