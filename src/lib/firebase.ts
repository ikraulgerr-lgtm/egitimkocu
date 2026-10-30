import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
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
import { getFirestore, doc, getDocFromServer, setDoc, deleteDoc } from 'firebase/firestore';
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

  // 1. Authenticate with Firebase Web/JS SDK directly (10s timeout safety)
  const authPromise = signInWithEmailAndPassword(auth, cleanEmail, pass);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Giriş işlemi zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.')), 10000)
  );

  const result = await Promise.race([authPromise, timeoutPromise]);

  // 2. Non-blocking native session sync
  if (Capacitor.isNativePlatform()) {
    FirebaseAuthentication.signInWithEmailAndPassword({
      email: cleanEmail,
      password: pass,
    }).catch((nativeErr) => {
      console.warn('Native signInWithEmailAndPassword sync warning (non-fatal):', nativeErr);
    });
  }

  return result.user;
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
    role?: 'student' | 'parent';
    linkedStudentId?: string;
    linkedStudentName?: string;
    linkedStudentCode?: string;
    parentInviteCode?: string;
  }
) {
  const cleanEmail = email.trim();
  const isParent = extraData?.role === 'parent';
  const cleanName = name ? name.trim() : (isParent ? 'Veli' : 'Öğrenci');
  const cleanUsername = (extraData?.username || cleanEmail.split('@')[0] || (isParent ? 'veli' : 'ogrenci')).toLowerCase().replace(/[^a-z0-9_]/g, '');
  const targetExam = isParent ? '' : (extraData?.targetExam || 'YKS');
  const targetExamDate = isParent ? '' : (extraData?.targetExamDate || '2027-06-19');
  const sinifVal = isParent ? '' : (extraData?.sinif || (targetExam === 'LGS' ? '8. Sınıf (LGS)' : targetExam === 'YKS' ? '12. Sınıf / Mezun (YKS)' : 'YKS / LGS Hazırlık'));

  // 1. Create account via Firebase JS SDK directly (10s timeout safety)
  const authPromise = createUserWithEmailAndPassword(auth, cleanEmail, pass);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Kayıt işlemi zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.')), 10000)
  );

  const result = await Promise.race([authPromise, timeoutPromise]);
  const user = result.user;

  // 2. Update display name
  try {
    await updateProfile(user, { displayName: cleanName });
  } catch (e) {
    console.warn('updateProfile error (non-fatal):', e);
  }

  // 3. Sync native Capacitor auth non-blockingly
  if (Capacitor.isNativePlatform()) {
    FirebaseAuthentication.signInWithEmailAndPassword({
      email: cleanEmail,
      password: pass,
    }).catch((nativeErr) => {
      console.warn('Native register sync warning (non-fatal):', nativeErr);
    });
  }

  // 4. Write initial user profile to Firestore reliably (3.5s timeout)
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const initialDocData: Record<string, any> = {
      id: user.uid,
      ad: cleanName,
      kullaniciAdi: cleanUsername,
      kullaniciAdi_lower: cleanUsername,
      email: cleanEmail,
      role: isParent ? 'parent' : 'student',
      kredi: 10,
      maxKredi: 10,
      seri: 1,
      xp: 0,
      isPremium: false,
      sinif: sinifVal,
      avatarUrl: user.photoURL || (isParent
        ? 'https://api.dicebear.com/7.x/adventurer/svg?seed=ParentChampion&backgroundColor=8b5cf6'
        : 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'),
      targetExam: targetExam,
      targetExamDate: targetExamDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isParent) {
      if (extraData?.linkedStudentId) initialDocData.linkedStudentId = extraData.linkedStudentId;
      if (extraData?.linkedStudentName) initialDocData.linkedStudentName = extraData.linkedStudentName;
      if (extraData?.linkedStudentCode) initialDocData.linkedStudentCode = extraData.linkedStudentCode;
    } else {
      initialDocData.parentInviteCode = extraData?.parentInviteCode || ('EK-' + Math.floor(100000 + Math.random() * 900000).toString());
    }

    await Promise.race([
      setDoc(userDocRef, initialDocData, { merge: true }),
      new Promise((r) => setTimeout(r, 3500)),
    ]);
  } catch (err) {
    console.warn('Firestore initial user setup warning:', err);
  }

  return user;
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

      // Synchronize JS SDK auth and AWAIT it with max 4s timeout so auth.currentUser is authenticated
      if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
          await Promise.race([
            signInWithCredential(auth, credential),
            new Promise((r) => setTimeout(r, 4000)),
          ]);
        } catch (credErr) {
          console.warn('signInWithCredential with Google idToken error (non-fatal):', credErr);
        }
      }

      if (auth.currentUser) {
        return auth.currentUser;
      }

      if (result?.user) {
        return {
          uid: result.user.uid,
          displayName: result.user.displayName || 'Öğrenci',
          email: result.user.email || 'ogrenci@egitimkocum.ai',
          photoURL: result.user.photoUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        } as any;
      }

      throw new Error('Google ile girişten vazgeçtiniz.');
    } catch (err: any) {
      console.warn('Native Google Sign-In Status:', err);
      const rawMsg = (err?.message || '').toLowerCase();
      const rawCode = (err?.code || '').toString().toLowerCase();
      if (
        rawMsg.includes('cancel') ||
        rawMsg.includes('vazge') ||
        rawMsg.includes('iptal') ||
        rawMsg.includes('12501') ||
        rawMsg.includes('16') ||
        rawMsg.includes('dismissed') ||
        rawMsg.includes('closed') ||
        rawMsg.includes('blocked') ||
        rawMsg.includes('sha1') ||
        rawMsg.includes('sha-1') ||
        rawMsg.includes('internal error') ||
        rawCode.includes('12501') ||
        rawCode.includes('16')
      ) {
        throw new Error('Google ile girişten vazgeçtiniz.');
      }
      throw new Error('Google ile girişten vazgeçtiniz.');
    }
  }

  // WEB BROWSER ONLY (Not reached on Native)
  try {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('Google Popup Login Status:', error);
    const msg = (error?.message || '').toLowerCase();
    const code = (error?.code || '').toLowerCase();
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      msg.includes('closed') ||
      msg.includes('cancel') ||
      msg.includes('vazge') ||
      msg.includes('iptal')
    ) {
      throw new Error('Google ile girişten vazgeçtiniz.');
    }
    throw new Error('Google ile girişten vazgeçtiniz.');
  }
}

export async function loginWithApple() {
  if (Capacitor.isNativePlatform()) {
    try {
      let result: any;
      const nativeSignInPromise = async () => {
        return await FirebaseAuthentication.signInWithApple({
          scopes: ['email', 'name'],
        });
      };

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Apple ile giriş zaman aşımına uğradı. Lütfen tekrar deneyin.')), 30000)
      );

      result = await Promise.race([nativeSignInPromise(), timeoutPromise]);
      console.log('FirebaseAuthentication.signInWithApple result:', result);

      const idToken =
        result?.credential?.idToken ||
        result?.idToken ||
        result?.credential?.token ||
        (result?.user as any)?.idToken;
      const rawNonce = result?.credential?.rawNonce || result?.rawNonce;

      // Synchronize JS SDK auth and AWAIT it with max 4s timeout so auth.currentUser is authenticated
      if (idToken) {
        try {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken,
            rawNonce,
          });
          await Promise.race([
            signInWithCredential(auth, credential),
            new Promise((r) => setTimeout(r, 4000)),
          ]);
        } catch (credErr) {
          console.warn('signInWithCredential with Apple idToken error (non-fatal):', credErr);
        }
      }

      if (auth.currentUser) {
        return auth.currentUser;
      }

      if (result?.user) {
        const givenName = result.user.displayName || result.user.name?.givenName || 'Apple Kullanıcısı';
        return {
          uid: result.user.uid,
          displayName: givenName,
          email: result.user.email || 'ogrenci@privaterelay.appleid.com',
          photoURL: result.user.photoUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        } as any;
      }

      throw new Error('Apple giriş kimliği doğrulanamadı.');
    } catch (err: any) {
      console.error('Native Apple Sign-In Error:', err);
      const msg = err?.message || '';
      const code = (err?.code || '').toString();
      if (
        msg.includes('cancel') ||
        msg.includes('Canceled') ||
        msg.includes('1001') ||
        msg.includes('cancelled') ||
        msg.includes('user cancelled') ||
        code.includes('1001')
      ) {
        throw new Error('Giriş işlemi iptal edildi.');
      }
      throw new Error(msg || 'Apple ile giriş başarısız oldu.');
    }
  }

  // WEB BROWSER ONLY (Not reached on Native)
  try {
    const appleProvider = new OAuthProvider('apple.com');
    appleProvider.addScope('email');
    appleProvider.addScope('name');
    const result = await signInWithPopup(auth, appleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Apple Popup Login Error:', error);
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

export async function deleteAccountFirebase(uid?: string) {
  const currentUid = uid || auth.currentUser?.uid;

  // 1. Delete Firestore user document
  if (currentUid) {
    try {
      const userDocRef = doc(db, 'users', currentUid);
      await deleteDoc(userDocRef);
    } catch (e) {
      console.warn('Firestore user doc deletion warning:', e);
    }
  }

  // 2. Delete Native Auth User if on mobile
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.deleteUser();
    } catch (nativeErr) {
      console.warn('Native deleteUser error:', nativeErr);
    }
  }

  // 3. Delete Firebase Web JS Auth User
  if (auth.currentUser) {
    try {
      await auth.currentUser.delete();
    } catch (jsErr: any) {
      console.warn('Firebase JS auth delete error:', jsErr);
      if (jsErr?.code === 'auth/requires-recent-login') {
        await signOut(auth);
        throw new Error('Güvenlik nedeniyle hesabınızı silmek için lütfen çıkış yapıp tekrar giriş yaptıktan sonra deneyin.');
      }
    }
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
