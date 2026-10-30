import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Kullanici } from '../types';
import { auth, db, loginWithGoogle, loginWithApple, resetPasswordFirebase, loginWithEmailFirebase, registerWithEmailFirebase } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { getUser, saveUser } from '../lib/storage';
import { getTurkeyDateString } from '../lib/dateUtils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: Partial<Kullanici>) => void;
}

type AuthMode = 'login' | 'register' | 'role_selection' | 'forgot_email' | 'forgot_otp' | 'forgot_new_password' | 'forgot_success' | 'forgot_link_sent';

// Helper function to find student by 6-digit invite code across Firestore users
export const findStudentByInviteCode = async (
  rawCode: string
): Promise<{ uid: string; name: string; code: string; studentData: any } | null> => {
  const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  const core = clean.startsWith('EK') ? clean.slice(2) : clean;
  const formattedCode = `EK-${core}`;

  try {
    const q = query(collection(db, 'users'), where('parentInviteCode', '==', formattedCode));
    const snap = await Promise.race([
      getDocs(q),
      new Promise<null>((r) => setTimeout(() => r(null), 3000)),
    ]);
    if (snap && !snap.empty) {
      const docData = snap.docs[0].data();
      return {
        uid: snap.docs[0].id,
        name: docData.ad || docData.kullaniciAdi || 'Öğrenci',
        code: formattedCode,
        studentData: docData,
      };
    }
  } catch (e) {
    console.warn('Query by parentInviteCode failed:', e);
  }

  // Also try query with core digits
  try {
    const q2 = query(collection(db, 'users'), where('parentInviteCode', '==', core));
    const snap2 = await Promise.race([
      getDocs(q2),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (snap2 && !snap2.empty) {
      const docData = snap2.docs[0].data();
      return {
        uid: snap2.docs[0].id,
        name: docData.ad || docData.kullaniciAdi || 'Öğrenci',
        code: formattedCode,
        studentData: docData,
      };
    }
  } catch (e) {}

  // Fallback scan across all users collection
  try {
    const allSnap = await Promise.race([
      getDocs(collection(db, 'users')),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (allSnap && !allSnap.empty) {
      for (const d of allSnap.docs) {
        const data = d.data();
        const codeInDoc = (data.parentInviteCode || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (
          codeInDoc === clean ||
          codeInDoc === core ||
          (data.parentInviteCode && data.parentInviteCode.toUpperCase() === formattedCode) ||
          (d.id && d.id.toUpperCase() === clean)
        ) {
          return {
            uid: d.id,
            name: data.ad || data.kullaniciAdi || 'Öğrenci',
            code: formattedCode,
            studentData: data,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Fallback users query failed:', e);
  }

  return null;
};

// Unique automatic username generator based on email prefix or name (created once on first sign up)
export const autoGenerateUsername = (emailStr?: string | null, nameStr?: string | null): string => {
  const source = (emailStr?.split('@')[0] || nameStr || 'ogrenci')
    .toLowerCase()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 12);
  const cleanBase = source || 'ogrenci';
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${cleanBase}_${randomSuffix}`;
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);
  const [selectedExam, setSelectedExam] = useState<'YKS' | 'LGS' | 'KPSS' | 'YDS' | 'Hazırlanmıyorum'>('YKS');
  const [registerRole, setRegisterRole] = useState<'student' | 'parent'>('student');
  const [studentInviteCode, setStudentInviteCode] = useState<string>('');

  // Social first-time role selection states (Google / Apple)
  const [pendingSocialAuth, setPendingSocialAuth] = useState<{
    firebaseUser: any;
    provider: 'google' | 'apple';
  } | null>(null);
  const [socialSelectedRole, setSocialSelectedRole] = useState<'student' | 'parent'>('student');
  const [socialStudentCode, setSocialStudentCode] = useState<string>('');
  const [isSocialSubmitting, setIsSocialSubmitting] = useState<boolean>(false);

  // UI status states
  const [canInteract, setCanInteract] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [isAppleLoading, setIsAppleLoading] = useState<boolean>(false);
  const [isEulaModalOpen, setIsEulaModalOpen] = useState<boolean>(false);
  const [isEmailLoading, setIsEmailLoading] = useState<boolean>(false);
  const [isResetLoading, setIsResetLoading] = useState<boolean>(false);
  const [isVerifyOtpLoading, setIsVerifyOtpLoading] = useState<boolean>(false);
  const [isSetNewPassLoading, setIsSetNewPassLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  // Apple ile giriş yalnızca iOS ve Web platformlarında gösterilir (Play Store Android sürümünde gösterilmez)
  const showAppleSignIn = Capacitor.getPlatform() !== 'android';

  // Auto clean form inputs when switching mode
  useEffect(() => {
    setErrorMsg(null);
    setIsGoogleLoading(false);
    setIsAppleLoading(false);
    setIsEmailLoading(false);
  }, [mode]);

  const prevIsOpenRef = useRef<boolean>(false);

  // Reset mode to 'login' ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen) {
      if (!prevIsOpenRef.current) {
        prevIsOpenRef.current = true;
        setCanInteract(false);
        setMode('login');
        setErrorMsg(null);
        setIsGoogleLoading(false);
        setIsAppleLoading(false);
        setIsEmailLoading(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtpCode('');

        // Prevent accidental click-through from underlying screen (e.g. logout button)
        const timer = setTimeout(() => {
          setCanInteract(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } else {
      prevIsOpenRef.current = false;
      setCanInteract(false);
    }
  }, [isOpen]);

  // Countdown timer effect
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  // Handle standard login or register submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsEmailLoading(true);

    try {
      if (mode === 'register') {
        if (!agreeTerms) {
          setErrorMsg('Lütfen kullanıcı sözleşmesini ve şartları kabul edin.');
          setIsEmailLoading(false);
          return;
        }

        // Validate username format with Turkish character transliteration
        const cleanUsername = username
          .trim()
          .replace(/İ/g, 'i')
          .replace(/I/g, 'i')
          .replace(/ı/g, 'i')
          .replace(/ş/g, 's')
          .replace(/Ş/g, 's')
          .replace(/ğ/g, 'g')
          .replace(/Ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/Ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/Ö/g, 'o')
          .replace(/ç/g, 'c')
          .replace(/Ç/g, 'c')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 20) {
          setErrorMsg('Kullanıcı adı en az 3, en fazla 20 karakter olmalı ve yalnızca küçük harf, rakam ve alt tire (_) içermelidir.');
          setIsEmailLoading(false);
          return;
        }

        if (password.length < 8) {
          setErrorMsg('Şifreniz en az 8 karakter olmalıdır.');
          setIsEmailLoading(false);
          return;
        }
        const hasUpperLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
        if (!hasUpperLower) {
          setErrorMsg('Şifreniz en az bir büyük ve bir küçük harf içermelidir.');
          setIsEmailLoading(false);
          return;
        }

        if (registerRole === 'parent') {
          // Parent Registration Logic
          const cleanParentName = name.trim() || 'Veli';
          const cleanParentUsername = cleanUsername;
          const rawCode = studentInviteCode.trim().toUpperCase();
          const formattedCode = rawCode ? (rawCode.startsWith('EK-') ? rawCode : `EK-${rawCode}`) : '';

          // 1. Create parent user in Firebase Auth FIRST (so auth.currentUser exists and is authenticated)
          const fbUser = await registerWithEmailFirebase(email.trim(), password, cleanParentName, {
            username: cleanParentUsername,
            role: 'parent',
            sinif: '',
            targetExam: '',
            targetExamDate: '',
          });

          let linkedStudentId = '';
          let linkedStudentName = '';
          let linkedStudentCode = '';

          // 2. If student invite code was provided, look up and link student safely
          if (formattedCode) {
            try {
              const studentMatch = await findStudentByInviteCode(formattedCode);
              if (studentMatch) {
                linkedStudentId = studentMatch.uid;
                linkedStudentName = studentMatch.name;
                linkedStudentCode = studentMatch.code;

                // Notify student document
                try {
                  await Promise.race([
                    setDoc(doc(db, 'users', studentMatch.uid), {
                      parentConnected: true,
                      parentName: cleanParentName,
                    }, { merge: true }),
                    new Promise((r) => setTimeout(r, 2500)),
                  ]);
                } catch (e) {
                  console.warn('Student parent link warning:', e);
                }
              }
            } catch (lookupErr) {
              console.warn('Student lookup error during parent registration:', lookupErr);
            }
          }

          // 3. Write linked student info to parent document
          try {
            await Promise.race([
              setDoc(doc(db, 'users', fbUser.uid), {
                role: 'parent',
                linkedStudentId,
                linkedStudentName,
                linkedStudentCode,
              }, { merge: true }),
              new Promise((r) => setTimeout(r, 2500)),
            ]);
          } catch (e) {}

          const parentUserData: Partial<Kullanici> = {
            id: fbUser.uid,
            ad: cleanParentName,
            kullaniciAdi: cleanParentUsername,
            kullaniciAdi_lower: cleanParentUsername.toLowerCase(),
            email: fbUser.email || email.trim(),
            role: 'parent',
            linkedStudentId,
            linkedStudentName,
            linkedStudentCode,
            avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ParentChampion&backgroundColor=8b5cf6',
            kredi: 10,
            maxKredi: 10,
            seri: 1,
            xp: 0,
            isPremium: false,
            sinif: '',
            targetExam: '' as any,
            targetExamDate: '',
          };

          saveUser(parentUserData as Kullanici, fbUser.uid);
          setIsEmailLoading(false);
          onLoginSuccess(parentUserData);
          onClose();
          return;
        } else {
          // Student Registration Logic
          let examDate = '2027-06-19';
          if (selectedExam === 'LGS') examDate = '2027-06-06';
          else if (selectedExam === 'KPSS') examDate = '2027-07-18';
          else if (selectedExam === 'YDS') examDate = '2027-04-11';
          else if (selectedExam === 'Hazırlanmıyorum') examDate = '';

          const sinifVal =
            selectedExam === 'LGS'
              ? '8. Sınıf (LGS)'
              : selectedExam === 'YKS'
              ? '12. Sınıf / Mezun (YKS)'
              : 'YKS / LGS Hazırlık';

          const cleanName = name.trim() || 'Öğrenci';
          const studentCode = 'EK-' + Math.floor(100000 + Math.random() * 900000).toString();
          const fbUser = await registerWithEmailFirebase(email.trim(), password, cleanName, {
            username: cleanUsername,
            role: 'student',
            parentInviteCode: studentCode,
            targetExam: selectedExam,
            targetExamDate: examDate,
            sinif: sinifVal,
          });

          const studentUserData: Partial<Kullanici> = {
            id: fbUser.uid,
            ad: cleanName,
            kullaniciAdi: cleanUsername,
            kullaniciAdi_lower: cleanUsername,
            email: fbUser.email || email.trim(),
            role: 'student',
            parentInviteCode: studentCode,
            targetExam: selectedExam,
            targetExamDate: examDate,
            sinif: sinifVal,
          };

          saveUser(studentUserData as Kullanici, fbUser.uid);
          setIsEmailLoading(false);
          onLoginSuccess(studentUserData);
          onClose();
          return;
        }
      } else {
        const fbUser = await loginWithEmailFirebase(email.trim(), password);
        const uid = fbUser.uid;
        const cachedUser = getUser(uid);
        let userKullaniciAdi = cachedUser?.kullaniciAdi || 'ogrenci';
        let userTargetExam = cachedUser?.targetExam || 'YKS';
        let userTargetExamDate = cachedUser?.targetExamDate || '2027-06-19';
        let userDisplayName = fbUser.displayName || cachedUser?.ad || name.trim() || 'Öğrenci';
        let userAvatar = fbUser.photoURL || cachedUser?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
        let userKredi = cachedUser?.kredi ?? 10;
        let userXp = cachedUser?.xp ?? 0;
        let userSeri = cachedUser?.seri ?? 1;
        let userIsPremium = cachedUser?.isPremium ?? false;
        let userSinif = cachedUser?.sinif || '12. Sınıf / Mezun (YKS)';
        let userRole = cachedUser?.role || 'student';
        let userParentInviteCode = cachedUser?.parentInviteCode;
        let userLinkedStudentId = cachedUser?.linkedStudentId;
        let userLinkedStudentName = cachedUser?.linkedStudentName;
        let userLinkedStudentCode = cachedUser?.linkedStudentCode;
        let userParentConnected = cachedUser?.parentConnected ?? false;
        let userParentName = cachedUser?.parentName;

        try {
          const userDocSnap = await Promise.race([
            getDoc(doc(db, 'users', uid)),
            new Promise<null>((r) => setTimeout(() => r(null), 5000)),
          ]);
          if (userDocSnap && userDocSnap.exists()) {
            const d = userDocSnap.data();
            if (d?.ad) userDisplayName = d.ad;
            if (d?.kullaniciAdi) userKullaniciAdi = d.kullaniciAdi;
            if (d?.targetExam) userTargetExam = d.targetExam;
            if (d?.targetExamDate) userTargetExamDate = d.targetExamDate;
            if (d?.avatarUrl) userAvatar = d.avatarUrl;
            if (d?.kredi !== undefined) userKredi = d.kredi;
            if (d?.xp !== undefined) userXp = d.xp;
            if (d?.seri !== undefined) userSeri = d.seri;
            if (d?.isPremium !== undefined) userIsPremium = d.isPremium;
            if (d?.sinif) userSinif = d.sinif;
            if (d?.role) userRole = d.role;
            if (d?.parentInviteCode) userParentInviteCode = d.parentInviteCode;
            if (d?.linkedStudentId) userLinkedStudentId = d.linkedStudentId;
            if (d?.linkedStudentName) userLinkedStudentName = d.linkedStudentName;
            if (d?.linkedStudentCode) userLinkedStudentCode = d.linkedStudentCode;
            if (d?.parentConnected !== undefined) userParentConnected = d.parentConnected;
            if (d?.parentName) userParentName = d.parentName;
          }
        } catch (e) {}

        const fullUser: Kullanici = {
          id: uid,
          ad: userDisplayName,
          kullaniciAdi: userKullaniciAdi,
          kullaniciAdi_lower: userKullaniciAdi.toLowerCase(),
          email: fbUser.email || email.trim(),
          avatarUrl: userAvatar,
          role: userRole as any,
          parentInviteCode: userParentInviteCode,
          linkedStudentId: userLinkedStudentId,
          linkedStudentName: userLinkedStudentName,
          linkedStudentCode: userLinkedStudentCode,
          parentConnected: userParentConnected,
          parentName: userParentName,
          targetExam: userTargetExam as any,
          targetExamDate: userTargetExamDate,
          kredi: userKredi,
          maxKredi: 10,
          xp: userXp,
          seri: userSeri,
          isPremium: userIsPremium,
          sinif: userSinif,
          lastResetDate: getTurkeyDateString(),
        };

        saveUser(fullUser, uid);
        onLoginSuccess(fullUser);
        onClose();
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      const code = (err?.code || '').toString().toLowerCase();
      const msg = (err?.message || '').toString().toLowerCase();

      if (code.includes('operation-not-allowed') || msg.includes('operation-not-allowed')) {
        setErrorMsg('Firebase Console üzerinde E-posta/Şifre ile Giriş yöntemi henüz etkinleştirilmemiş.');
      } else if (code.includes('email-already-in-use') || msg.includes('email-already-in-use') || msg.includes('already in use') || msg.includes('already exists')) {
        setErrorMsg('Bu e-posta adresi zaten başka bir hesapta kayıtlı. Lütfen "Giriş Yap" sekmesine geçin.');
      } else if (
        code.includes('invalid-credential') ||
        code.includes('user-not-found') ||
        code.includes('wrong-password') ||
        code.includes('17011') ||
        code.includes('17009') ||
        msg.includes('user-not-found') ||
        msg.includes('invalid-credential') ||
        msg.includes('wrong-password') ||
        msg.includes('no user record') ||
        msg.includes('user not found') ||
        msg.includes('invalid password') ||
        msg.includes('credentials')
      ) {
        setErrorMsg('E-posta adresi veya şifre hatalı. Böyle bir kullanıcı kaydı bulunamadı.');
      } else if (code.includes('weak-password') || msg.includes('weak-password') || msg.includes('weak password')) {
        setErrorMsg('Şifreniz en az 8 karakter ve büyük/küçük harf içermelidir.');
      } else if (code.includes('invalid-email') || msg.includes('invalid-email') || msg.includes('badly formatted')) {
        setErrorMsg('Geçersiz bir e-posta adresi girdiniz.');
      } else if (code.includes('network-request-failed') || msg.includes('network')) {
        setErrorMsg('İnternet bağlantısı hatası. Lütfen ağınızı kontrol edip tekrar deneyin.');
      } else {
        setErrorMsg(err?.message || 'Giriş / Kayıt işlemi gerçekleştirilemedi. Lütfen bilgilerinizi kontrol edin.');
      }
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Step 1: Send Password Reset Link to Email (Firebase Auth)
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setIsResetLoading(true);
    setErrorMsg(null);

    try {
      await resetPasswordFirebase(cleanEmail);
      setMode('forgot_link_sent');
    } catch (err: any) {
      console.error('Password reset error:', err);
      const code = err?.code;
      if (code === 'auth/user-not-found') {
        setErrorMsg('Bu e-posta adresine kayıtlı bir hesap bulunamadı. Lütfen e-postanızı kontrol edin veya yeni hesap oluşturun.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Geçersiz bir e-posta adresi girdiniz.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Çok fazla sıfırlama isteği gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMsg('İnternet bağlantısı hatası. Lütfen ağınızı kontrol edip tekrar deneyin.');
      } else {
        setErrorMsg('Şifre sıfırlama e-postası gönderilemedi: ' + (err?.message || 'Lütfen bilgilerinizi kontrol edin.'));
      }
    } finally {
      setIsResetLoading(false);
    }
  };

  // Step 2: Verify 6-digit Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Lütfen 6 haneli doğrulama kodunu eksiksiz girin.');
      return;
    }

    setIsVerifyOtpLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setMode('forgot_new_password');
      } else {
        setErrorMsg(data.message || 'Kod doğrulanamadı.');
      }
    } catch (err) {
      setErrorMsg('Sunucuya bağlanılamadı.');
    } finally {
      setIsVerifyOtpLoading(false);
    }
  };

  // Step 3: Save New Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setIsSetNewPassLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode.trim(), newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setPassword(newPassword);
        setMode('forgot_success');
      } else {
        setErrorMsg(data.message || 'Şifre güncellenemedi.');
      }
    } catch (err) {
      setErrorMsg('Şifre sıfırlama işlemi sırasında hata oluştu.');
    } finally {
      setIsSetNewPassLoading(false);
    }
  };

  // Complete first-time social sign in after role selection (Google / Apple)
  const handleCompleteSocialRegistration = async (skipCode = false) => {
    if (!pendingSocialAuth) return;
    const { firebaseUser, provider } = pendingSocialAuth;
    const uid = firebaseUser.uid;
    const userDocRef = doc(db, 'users', uid);
    setIsSocialSubmitting(true);
    setErrorMsg(null);

    try {
      const autoName = firebaseUser.displayName || (socialSelectedRole === 'parent' ? 'Veli' : 'Öğrenci');
      const autoUsername = autoGenerateUsername(firebaseUser.email, autoName);

      if (socialSelectedRole === 'parent') {
        let matchedStudentId = '';
        let matchedStudentName = '';
        let matchedStudentCode = '';

        if (!skipCode && socialStudentCode.trim()) {
          const studentMatch = await Promise.race([
            findStudentByInviteCode(socialStudentCode),
            new Promise<null>((r) => setTimeout(() => r(null), 3000)),
          ]);
          if (!studentMatch) {
            setErrorMsg(`"${socialStudentCode.trim().toUpperCase()}" davet koduna sahip bir öğrenci bulunamadı. Lütfen öğrencinizin uygulamasındaki kodu kontrol edin veya aşağıdaki "Öğrenci kodunu daha sonra girmek istiyorum" seçeneğiyle devam edin.`);
            setIsSocialSubmitting(false);
            return;
          }
          matchedStudentId = studentMatch.uid;
          matchedStudentName = studentMatch.name;
          matchedStudentCode = studentMatch.code;

          // Notify & link on student document
          try {
            await Promise.race([
              setDoc(doc(db, 'users', studentMatch.uid), {
                parentConnected: true,
                parentName: autoName,
              }, { merge: true }),
              new Promise((r) => setTimeout(r, 2000)),
            ]);
          } catch (e) {}
        }

        const parentUserData: Kullanici = {
          id: uid,
          ad: autoName,
          kullaniciAdi: autoUsername,
          kullaniciAdi_lower: autoUsername.toLowerCase(),
          email: firebaseUser.email || (provider === 'apple' ? 'veli@privaterelay.appleid.com' : 'veli@egitimkocum.ai'),
          avatarUrl: firebaseUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=ParentChampion&backgroundColor=8b5cf6',
          role: 'parent',
          linkedStudentId: matchedStudentId,
          linkedStudentName: matchedStudentName,
          linkedStudentCode: matchedStudentCode,
          kredi: 10,
          maxKredi: 10,
          seri: 1,
          xp: 0,
          isPremium: false,
          sinif: '',
          targetExam: '' as any,
          targetExamDate: '',
          lastResetDate: getTurkeyDateString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 1. Save locally FIRST so the user is guaranteed to have their active session
        saveUser(parentUserData, uid);

        // 2. Safely sync to Firestore with timeout
        try {
          await Promise.race([
            setDoc(userDocRef, parentUserData, { merge: true }),
            new Promise((r) => setTimeout(r, 2500)),
          ]);
        } catch (e) {
          console.warn('Parent userDoc write warning (non-fatal):', e);
        }

        setIsSocialSubmitting(false);
        onLoginSuccess(parentUserData);
        onClose();
        return;
      } else {
        // Student role
        const studentCode = 'EK-' + Math.floor(100000 + Math.random() * 900000).toString();
        let examDate = '2027-06-19';
        if (selectedExam === 'LGS') examDate = '2027-06-06';
        else if (selectedExam === 'KPSS') examDate = '2027-07-18';
        else if (selectedExam === 'YDS') examDate = '2027-04-11';
        else if (selectedExam === 'Hazırlanmıyorum') examDate = '';

        const sinifVal =
          selectedExam === 'LGS'
            ? '8. Sınıf (LGS)'
            : selectedExam === 'YKS'
            ? '12. Sınıf / Mezun (YKS)'
            : 'YKS / LGS Hazırlık';

        const studentUserData: Kullanici = {
          id: uid,
          ad: autoName,
          kullaniciAdi: autoUsername,
          kullaniciAdi_lower: autoUsername.toLowerCase(),
          email: firebaseUser.email || (provider === 'apple' ? 'ogrenci@privaterelay.appleid.com' : 'ogrenci@egitimkocum.ai'),
          avatarUrl: firebaseUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
          role: 'student',
          parentInviteCode: studentCode,
          kredi: 10,
          maxKredi: 10,
          seri: 1,
          xp: 0,
          isPremium: false,
          sinif: sinifVal,
          targetExam: selectedExam,
          targetExamDate: examDate,
          lastResetDate: getTurkeyDateString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 1. Save locally FIRST
        saveUser(studentUserData, uid);

        // 2. Safely sync to Firestore with timeout
        try {
          await Promise.race([
            setDoc(userDocRef, studentUserData, { merge: true }),
            new Promise((r) => setTimeout(r, 2500)),
          ]);
        } catch (e) {
          console.warn('Student userDoc write warning (non-fatal):', e);
        }

        setIsSocialSubmitting(false);
        onLoginSuccess(studentUserData);
        onClose();
        return;
      }
    } catch (err: any) {
      console.error('Complete social registration error:', err);
      // Fallback: If pendingSocialAuth exists, save user locally and proceed smoothly
      if (pendingSocialAuth?.firebaseUser?.uid) {
        const fallbackUid = pendingSocialAuth.firebaseUser.uid;
        const autoName = pendingSocialAuth.firebaseUser.displayName || (socialSelectedRole === 'parent' ? 'Veli' : 'Öğrenci');
        const autoUsername = autoGenerateUsername(pendingSocialAuth.firebaseUser.email, autoName);
        const fallbackUser: Partial<Kullanici> = {
          id: fallbackUid,
          ad: autoName,
          kullaniciAdi: autoUsername,
          kullaniciAdi_lower: autoUsername.toLowerCase(),
          email: pendingSocialAuth.firebaseUser.email || '',
          role: socialSelectedRole,
          avatarUrl: pendingSocialAuth.firebaseUser.photoURL || (socialSelectedRole === 'parent'
            ? 'https://api.dicebear.com/7.x/adventurer/svg?seed=ParentChampion&backgroundColor=8b5cf6'
            : 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'),
          kredi: 10,
          maxKredi: 10,
          seri: 1,
          xp: 0,
          isPremium: false,
          lastResetDate: getTurkeyDateString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveUser(fallbackUser as Kullanici, fallbackUid);
        setIsSocialSubmitting(false);
        onLoginSuccess(fallbackUser);
        onClose();
        return;
      }
      setErrorMsg(err?.message || 'Kayıt işlemi tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsSocialSubmitting(false);
    }
  };

  // Password criteria checks (8 characters + Upper & Lowercase letter)
  const passCheck = mode === 'register' ? password : newPassword;
  const has8Chars = passCheck.length >= 8;
  const hasUpperLower = /[A-Z]/.test(passCheck) && /[a-z]/.test(passCheck);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 pb-16 sm:pb-4 animate-fadeIn ${
      !auth.currentUser ? 'bg-slate-950/95 backdrop-blur-xl' : 'bg-black/75 backdrop-blur-xs'
    }`}>
      <div className="bg-card-bg w-full max-w-md rounded-3xl p-6 sm:p-8 border border-card-border space-y-6 shadow-2xl relative max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Close Button - Rendered ONLY if user is already logged in */}
        {auth.currentUser && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}

        {/* Error Alert Message */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2 animate-shake">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* ----------------- MODE 1: LOGIN / REGISTER ----------------- */}
        {(mode === 'login' || mode === 'register') && (
          <>
            {/* Brand Logo & Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-3xl fill-1">auto_stories</span>
              </div>
              <h2 className="font-extrabold text-2xl text-text-main">
                {mode === 'register' ? 'Hesabını Oluştur' : 'Tekrar Hoş Geldin!'}
              </h2>
              <p className="text-xs text-text-muted">
                {mode === 'register'
                  ? 'Yapay zeka pedagoji asistanın ile eğitime başla.'
                  : 'Yapay zeka destekli çalışma asistanın seni bekliyor.'}
              </p>
            </div>

            {/* Segmented Mode Switcher Tabs */}
            <div className="flex bg-surface-container-low p-1 rounded-2xl border border-card-border select-none">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('login');
                }}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('register');
                }}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Kayıt Ol
              </button>
            </div>

            {/* Social SSO Logins (Google & Apple - Apple Guideline 4.8 Compliant) */}
            <div className="space-y-2 select-none">
              {/* Sign in with Apple (Only on iOS & Web) */}
              {showAppleSignIn && (
                <button
                  type="button"
                  disabled={!canInteract || isAppleLoading || isGoogleLoading || isEmailLoading}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canInteract || isAppleLoading || isGoogleLoading || isEmailLoading) return;
                    setErrorMsg(null);
                    setIsAppleLoading(true);
                    try {
                      const firebaseUser = await loginWithApple();
                      if (firebaseUser) {
                        const uid = firebaseUser.uid;
                        const userDocRef = doc(db, 'users', uid);
                        const cachedUser = getUser(uid);

                        let userSnap: any = null;
                        try {
                          userSnap = await Promise.race([
                            getDoc(userDocRef),
                            new Promise<null>((r) => setTimeout(() => r(null), 5000)),
                          ]);
                        } catch (e) {
                          console.warn('Apple user doc check warning:', e);
                        }

                        let finalUserData: Kullanici;

                        if (userSnap && userSnap.exists()) {
                          // 1. Existing registered user -> Restore everything faithfully
                          const data = userSnap.data() as Partial<Kullanici>;
                          const currentName = data.ad || firebaseUser.displayName || cachedUser?.ad || 'Apple Kullanıcısı';
                          const currentUsername = data.kullaniciAdi || cachedUser?.kullaniciAdi || autoGenerateUsername(firebaseUser.email, currentName);

                          finalUserData = {
                            ...data,
                            id: uid,
                            ad: currentName,
                            kullaniciAdi: currentUsername,
                            kullaniciAdi_lower: currentUsername.toLowerCase(),
                            email: data.email || firebaseUser.email || 'ogrenci@privaterelay.appleid.com',
                            avatarUrl: data.avatarUrl || firebaseUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                            role: (data.role as any) || cachedUser?.role || 'student',
                            parentInviteCode: data.parentInviteCode || cachedUser?.parentInviteCode,
                            linkedStudentId: data.linkedStudentId || cachedUser?.linkedStudentId,
                            linkedStudentName: data.linkedStudentName || cachedUser?.linkedStudentName,
                            linkedStudentCode: data.linkedStudentCode || cachedUser?.linkedStudentCode,
                            parentConnected: data.parentConnected ?? cachedUser?.parentConnected ?? false,
                            parentName: data.parentName || cachedUser?.parentName,
                            targetExam: data.targetExam || cachedUser?.targetExam || 'YKS',
                            targetExamDate: data.targetExamDate || cachedUser?.targetExamDate || '2027-06-19',
                            kredi: data.kredi ?? cachedUser?.kredi ?? 10,
                            maxKredi: data.maxKredi ?? 10,
                            seri: data.seri ?? cachedUser?.seri ?? 1,
                            xp: data.xp ?? cachedUser?.xp ?? 0,
                            isPremium: data.isPremium ?? false,
                            sinif: data.sinif || cachedUser?.sinif || '12. Sınıf / Mezun (YKS)',
                            lastResetDate: data.lastResetDate || getTurkeyDateString(),
                          };
                        } else if (cachedUser && cachedUser.id === uid && cachedUser.targetExam) {
                          // 2. Found in local cache
                          finalUserData = {
                            ...cachedUser,
                            id: uid,
                            email: firebaseUser.email || cachedUser.email || 'ogrenci@privaterelay.appleid.com',
                          };
                          setDoc(userDocRef, finalUserData, { merge: true }).catch(() => {});
                        } else {
                          // 3. Brand new first-time Apple user -> Prompt for role selection
                          setPendingSocialAuth({ firebaseUser, provider: 'apple' });
                          setSocialSelectedRole('student');
                          setSocialStudentCode('');
                          setErrorMsg(null);
                          setMode('role_selection');
                          setIsAppleLoading(false);
                          return;
                        }

                        saveUser(finalUserData, uid);
                        setIsAppleLoading(false);
                        onLoginSuccess(finalUserData);
                        onClose();
                        return;
                      }
                    } catch (err: any) {
                      console.warn('Apple Auth Status:', err);
                      setIsAppleLoading(false);
                      const msg = err?.message || '';
                      if (msg.includes('iptal') || msg.includes('cancel')) {
                        // User cancelled
                      } else if (err?.code === 'auth/operation-not-allowed') {
                        setErrorMsg('Firebase Console üzerinde Apple ile Giriş sağlayıcısı henüz etkinleştirilmemiş.');
                      } else {
                        setErrorMsg(`Apple ile giriş yapılamadı: ${msg || 'Lütfen tekrar deneyin.'}`);
                      }
                    } finally {
                      setIsAppleLoading(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 bg-black hover:bg-neutral-900 text-white border border-neutral-800 py-3 px-4 rounded-xl text-xs font-bold active:scale-98 transition-all cursor-pointer disabled:opacity-50 select-none shadow-sm"
                >
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.58-7.8-11.64-14.16-5.87-9.1-10.42-19.14-13.63-30.12-3.21-10.98-4.82-21.61-4.82-31.9 0-14.78 3.84-26.68 11.53-35.7 7.68-9.02 17.2-13.6 28.56-13.75 4.9.11 10.13 1.25 15.69 3.42 5.56 2.18 9.38 3.31 11.45 3.42 1.63-.11 5.62-1.33 11.96-3.66 6.35-2.33 11.77-3.39 16.27-3.18 10.02.66 18.28 4.25 24.78 10.78 6.5 6.53 10.63 14.54 12.38 24.03-9.03 5.44-13.5 13.11-13.41 23.01.09 7.84 2.87 14.48 8.35 19.92 5.48 5.44 11.96 8.71 19.45 9.8-2.61 7.62-5.77 14.69-9.49 21.2zm-28.79-114.72c.11 3.59-.97 7.03-3.24 10.33-2.28 3.3-5.28 5.86-9.01 7.68-1.74.87-3.81 1.41-6.21 1.63-.33-3.48.7-7.03 3.09-10.65 2.39-3.62 5.54-6.32 9.45-8.1 1.74-.76 3.7-1.28 5.92-1.57z"/>
                  </svg>
                  <span>{isAppleLoading ? 'Apple ile Bağlanılıyor...' : 'Apple ile Devam Et'}</span>
                </button>
              )}

              {/* Sign in with Google */}
              <button
                type="button"
                disabled={!canInteract || isGoogleLoading || isAppleLoading || isEmailLoading}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canInteract || isGoogleLoading || isAppleLoading || isEmailLoading) return;
                  setErrorMsg(null);
                  setIsGoogleLoading(true);
                  try {
                    const firebaseUser = await loginWithGoogle();
                    if (firebaseUser) {
                      const uid = firebaseUser.uid;
                      const userDocRef = doc(db, 'users', uid);
                      const cachedUser = getUser(uid);

                      let userSnap: any = null;
                      try {
                        userSnap = await Promise.race([
                          getDoc(userDocRef),
                          new Promise<null>((r) => setTimeout(() => r(null), 5000)),
                        ]);
                      } catch (e) {
                        console.warn('Google user doc check warning:', e);
                      }

                      let finalUserData: Kullanici;

                      if (userSnap && userSnap.exists()) {
                        // 1. Existing registered user -> Restore everything faithfully
                        const data = userSnap.data() as Partial<Kullanici>;
                        const currentName = data.ad || firebaseUser.displayName || cachedUser?.ad || 'Öğrenci';
                        const currentUsername = data.kullaniciAdi || cachedUser?.kullaniciAdi || autoGenerateUsername(firebaseUser.email, currentName);

                        finalUserData = {
                          ...data,
                          id: uid,
                          ad: currentName,
                          kullaniciAdi: currentUsername,
                          kullaniciAdi_lower: currentUsername.toLowerCase(),
                          email: data.email || firebaseUser.email || 'ogrenci@egitimkocum.ai',
                          avatarUrl: data.avatarUrl || firebaseUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                          role: (data.role as any) || cachedUser?.role || 'student',
                          parentInviteCode: data.parentInviteCode || cachedUser?.parentInviteCode,
                          linkedStudentId: data.linkedStudentId || cachedUser?.linkedStudentId,
                          linkedStudentName: data.linkedStudentName || cachedUser?.linkedStudentName,
                          linkedStudentCode: data.linkedStudentCode || cachedUser?.linkedStudentCode,
                          parentConnected: data.parentConnected ?? cachedUser?.parentConnected ?? false,
                          parentName: data.parentName || cachedUser?.parentName,
                          targetExam: data.targetExam || cachedUser?.targetExam || 'YKS',
                          targetExamDate: data.targetExamDate || cachedUser?.targetExamDate || '2027-06-19',
                          kredi: data.kredi ?? cachedUser?.kredi ?? 10,
                          maxKredi: data.maxKredi ?? 10,
                          seri: data.seri ?? cachedUser?.seri ?? 1,
                          xp: data.xp ?? cachedUser?.xp ?? 0,
                          isPremium: data.isPremium ?? false,
                          sinif: data.sinif || cachedUser?.sinif || '12. Sınıf / Mezun (YKS)',
                          lastResetDate: data.lastResetDate || getTurkeyDateString(),
                        };
                      } else if (cachedUser && cachedUser.id === uid && cachedUser.targetExam) {
                        // 2. Found in local cache
                        finalUserData = {
                          ...cachedUser,
                          id: uid,
                          email: firebaseUser.email || cachedUser.email || 'ogrenci@egitimkocum.ai',
                        };
                        setDoc(userDocRef, finalUserData, { merge: true }).catch(() => {});
                      } else {
                        // 3. Brand new first-time Google user -> Prompt for role selection (Öğrenciyim vs Veliyim)
                        setPendingSocialAuth({ firebaseUser, provider: 'google' });
                        setSocialSelectedRole('student');
                        setSocialStudentCode('');
                        setErrorMsg(null);
                        setMode('role_selection');
                        setIsGoogleLoading(false);
                        return;
                      }

                      saveUser(finalUserData, uid);
                      setIsGoogleLoading(false);
                      onLoginSuccess(finalUserData);
                      onClose();
                      return;
                    }
                  } catch (err: any) {
                    console.warn('Google Auth Status:', err);
                    setIsGoogleLoading(false);
                    const rawMsg = err?.message || '';
                    const msg = rawMsg.toLowerCase();
                    const code = (err?.code || '').toLowerCase();
                    if (
                      msg.includes('vazgeçtiniz') ||
                      msg.includes('vazge') ||
                      msg.includes('iptal') ||
                      msg.includes('cancel') ||
                      msg.includes('12501') ||
                      msg.includes('16') ||
                      msg.includes('dismissed') ||
                      msg.includes('closed') ||
                      msg.includes('blocked') ||
                      msg.includes('sha1') ||
                      msg.includes('sha-1') ||
                      code === 'auth/popup-closed-by-user' ||
                      code === 'auth/cancelled-popup-request'
                    ) {
                      setErrorMsg('Google ile girişten vazgeçtiniz.');
                    } else if (err?.code === 'auth/operation-not-allowed') {
                      setErrorMsg('Google ile Giriş şu anda kullanılamıyor.');
                    } else if (err?.code === 'auth/unauthorized-domain') {
                      setErrorMsg('Google ile giriş yetkisi doğrulanamadı.');
                    } else {
                      setErrorMsg('Google ile girişten vazgeçtiniz.');
                    }
                  } finally {
                    setIsGoogleLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-surface-container-low border border-card-border py-3 px-4 rounded-xl text-xs font-bold text-text-main hover:border-primary/50 active:scale-98 transition-all cursor-pointer disabled:opacity-50 select-none"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>{isGoogleLoading ? 'Google ile Bağlanılıyor...' : 'Google ile Devam Et'}</span>
              </button>
            </div>

            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-card-border" />
              <span className="px-3 text-[11px] font-bold text-text-muted uppercase">veya e-posta ile</span>
              <div className="flex-1 h-px bg-card-border" />
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <>
                  {/* Role Selector: Student vs Parent */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-text-muted mb-1 ml-1">Kayıt Türü</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-2xl border border-card-border">
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterRole('student');
                          setErrorMsg(null);
                        }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          registerRole === 'student'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <span className="text-sm">🎓</span>
                        <span>Öğrenciyim</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterRole('parent');
                          setErrorMsg(null);
                        }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          registerRole === 'parent'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <span className="text-sm">👨‍👩‍👧</span>
                        <span>Veliyim</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1 ml-1">
                      {registerRole === 'parent' ? 'Veli Adı Soyadı' : 'Ad Soyad'}
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                        {registerRole === 'parent' ? 'badge' : 'person'}
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={registerRole === 'parent' ? 'Adınız Soyadınız' : 'Adınız Soyadınız'}
                        autoCapitalize="words"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>
                  </div>

                  {/* Unique Username Field */}
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1 ml-1">Kullanıcı Adı (@)</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                        alternate_email
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="kullanici_adi (Örn: ahmet_yks)"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-text-muted ml-1 mt-0.5 block">Yalnızca küçük harf, rakam ve alt tire (_) kullanılabilir.</span>
                  </div>

                  {/* If Parent: Student Invite Code Field */}
                  {registerRole === 'parent' ? (
                    <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-600/40 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-purple-700 dark:text-purple-400 text-base">link</span>
                          <span>Öğrenci Takip Davet Kodu</span>
                        </label>
                        <span className="text-[10px] font-extrabold text-purple-800 dark:text-purple-200 bg-purple-200/80 dark:bg-purple-900/60 px-2.5 py-0.5 rounded-full border border-purple-300 dark:border-purple-700">
                          İsteğe Bağlı
                        </span>
                      </div>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-700 dark:text-purple-400 text-lg">
                          vpn_key
                        </span>
                        <input
                          type="text"
                          value={studentInviteCode}
                          onChange={(e) => setStudentInviteCode(e.target.value.toUpperCase())}
                          placeholder="Örn: EK-748291 (veya boş bırakın)"
                          maxLength={10}
                          autoCapitalize="characters"
                          className="w-full bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-600 rounded-xl py-3 pl-10 pr-4 text-xs font-mono font-black text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 tracking-wider shadow-inner"
                        />
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-tight">
                        💡 Öğrencinizin <strong className="text-purple-900 dark:text-purple-200 font-bold">Profil &gt; Veli Bağlantısı</strong> ekranındaki 6 haneli kodunu girebilir veya daha sonra panelden ekleyebilirsiniz.
                      </p>
                    </div>
                  ) : (
                    /* If Student: Exam Target Selection */
                    <div>
                      <label className="block text-xs font-bold text-text-muted mb-1 ml-1">
                        🎯 Hazırlandığınız Sınav
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                          school
                        </span>
                        <select
                          value={selectedExam}
                          onChange={(e) => setSelectedExam(e.target.value as any)}
                          className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-8 text-xs font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                        >
                          <option value="YKS">🎓 YKS 2027 (TYT - AYT)</option>
                          <option value="LGS">📚 LGS 2027 (Lise Geçiş)</option>
                          <option value="KPSS">💼 KPSS 2027 (Kamu Personeli)</option>
                          <option value="YDS">🌐 YÖKDİL / YDS 2027</option>
                          <option value="Hazırlanmıyorum">✨ Sınava Hazırlanmıyorum (Genel Çalışma)</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-lg">
                          expand_more
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1 ml-1">E-posta</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                    mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@edu.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1 ml-1">
                  <label className="text-xs font-bold text-text-muted">Şifre</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setMode('forgot_email');
                      }}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Şifremi Unuttum
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-10 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Registration Password Requirements Checklist */}
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-1.5 pt-1 px-1 text-[11px]">
                  <div className={`flex items-center gap-1 ${has8Chars ? 'text-emerald-600 font-bold' : 'text-text-muted'}`}>
                    <span className="material-symbols-outlined text-sm">{has8Chars ? 'check_circle' : 'cancel'}</span>
                    <span>En az 8 karakter</span>
                  </div>
                  <div className={`flex items-center gap-1 ${hasUpperLower ? 'text-emerald-600 font-bold' : 'text-text-muted'}`}>
                    <span className="material-symbols-outlined text-sm">{hasUpperLower ? 'check_circle' : 'cancel'}</span>
                    <span>Büyük / Küçük harf</span>
                  </div>
                </div>
              )}

              {/* Terms and EULA zero-tolerance checkbox for registration (Apple Guideline 1.2 Compliant) */}
              {mode === 'register' && (
                <div className="flex items-start gap-2 pt-1 text-[11px] text-text-muted">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded text-primary cursor-pointer shrink-0"
                    required
                  />
                  <span>
                    <button
                      type="button"
                      onClick={() => setIsEulaModalOpen(true)}
                      className="text-primary font-bold hover:underline cursor-pointer text-left"
                    >
                      Kullanıcı Sözleşmesi, Gizlilik Politikası ve Topluluk Kuralları (EULA - Sıfır Tolerans İlkesi)
                    </button>
                    'ni okudum ve kabul ediyorum.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isEmailLoading || isGoogleLoading || isAppleLoading}
                className={`w-full text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer mt-2 disabled:opacity-50 flex items-center justify-center gap-2 ${
                  mode === 'register' && registerRole === 'parent' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-primary'
                }`}
              >
                {isEmailLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{mode === 'register' ? 'Hesap Oluşturuluyor...' : 'Giriş Yapılıyor...'}</span>
                  </>
                ) : (
                  <span>
                    {mode === 'register'
                      ? registerRole === 'parent'
                        ? '👨‍👩‍👧 Veli Hesabı Oluştur ve Takibe Başla'
                        : 'Hesabımı Oluştur'
                      : 'Giriş Yap'}
                  </span>
                )}
              </button>
            </form>

            {/* Tab Switcher Link */}
            <div className="text-center pt-2">
              <p className="text-xs text-text-muted">
                {mode === 'register' ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?'}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode(mode === 'register' ? 'login' : 'register');
                  }}
                  className="text-primary font-extrabold ml-1 hover:underline cursor-pointer"
                >
                  {mode === 'register' ? 'Giriş Yap' : 'Kayıt Ol'}
                </button>
              </p>
            </div>
          </>
        )}

        {/* ----------------- MODE: ROLE SELECTION (FIRST-TIME GOOGLE / APPLE USERS) ----------------- */}
        {mode === 'role_selection' && pendingSocialAuth && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-gradient-to-tr from-primary to-purple-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-3xl">how_to_reg</span>
              </div>
              <h2 className="font-extrabold text-2xl text-text-main">
                Hesap Türünüzü Seçin
              </h2>
              <p className="text-xs text-text-muted">
                Hoş geldiniz, <strong className="text-text-main">{pendingSocialAuth.firebaseUser.displayName || 'Kullanıcı'}</strong>! Eğitim Koçum'u nasıl kullanmak istersiniz?
              </p>
            </div>

            {/* Role Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSocialSelectedRole('student');
                  setErrorMsg(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  socialSelectedRole === 'student'
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/20 text-text-main'
                    : 'bg-surface-container-low border-card-border text-text-muted hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-2xl">🎓</span>
                  <span className={`material-symbols-outlined text-lg ${socialSelectedRole === 'student' ? 'text-primary' : 'text-text-muted'}`}>
                    {socialSelectedRole === 'student' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>
                <h4 className="font-extrabold text-xs text-text-main mb-1">Öğrenciyim</h4>
                <p className="text-[11px] text-text-muted leading-tight">
                  Ders çalış, yapay zeka ile soru çöz, netlerini takip et.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSocialSelectedRole('parent');
                  setErrorMsg(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  socialSelectedRole === 'parent'
                    ? 'bg-purple-600/10 border-purple-500 ring-2 ring-purple-500/20 text-text-main'
                    : 'bg-surface-container-low border-card-border text-text-muted hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-2xl">👨‍👩‍👧</span>
                  <span className={`material-symbols-outlined text-lg ${socialSelectedRole === 'parent' ? 'text-purple-400' : 'text-text-muted'}`}>
                    {socialSelectedRole === 'parent' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>
                <h4 className="font-extrabold text-xs text-text-main mb-1">Veliyim</h4>
                <p className="text-[11px] text-text-muted leading-tight">
                  Öğrencimin ders programını, eksik görevlerini ve sınavlarını takip et.
                </p>
              </button>
            </div>

            {/* If Student: Exam picker */}
            {socialSelectedRole === 'student' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="block text-xs font-bold text-text-muted ml-1">
                  🎯 Hazırlandığınız Hedef Sınav
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                    school
                  </span>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value as any)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-8 text-xs font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  >
                    <option value="YKS">🎓 YKS 2027 (TYT - AYT)</option>
                    <option value="LGS">📚 LGS 2027 (Lise Geçiş)</option>
                    <option value="KPSS">💼 KPSS 2027 (Kamu Personeli)</option>
                    <option value="YDS">🌐 YÖKDİL / YDS 2027</option>
                    <option value="Hazırlanmıyorum">✨ Sınava Hazırlanmıyorum (Genel Çalışma)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-lg">
                    expand_more
                  </span>
                </div>
              </div>
            )}

            {/* If Parent: Student Invite Code */}
            {socialSelectedRole === 'parent' && (
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-600/40 rounded-2xl space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-purple-700 dark:text-purple-400 text-base">link</span>
                    <span>Öğrenci Takip Davet Kodu</span>
                  </label>
                  <span className="text-[10px] font-extrabold text-purple-800 dark:text-purple-200 bg-purple-200/80 dark:bg-purple-900/60 px-2.5 py-0.5 rounded-full border border-purple-300 dark:border-purple-700">
                    EK-XXXXXX
                  </span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-700 dark:text-purple-400 text-lg">
                    vpn_key
                  </span>
                  <input
                    type="text"
                    value={socialStudentCode}
                    onChange={(e) => setSocialStudentCode(e.target.value.toUpperCase())}
                    placeholder="Örn: EK-748291 (veya boş bırakın)"
                    maxLength={10}
                    autoCapitalize="characters"
                    className="w-full bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-600 rounded-xl py-3 pl-10 pr-4 text-xs font-mono font-black text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 tracking-wider shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-tight">
                  💡 Öğrencinizin uygulamasındaki <strong className="text-purple-900 dark:text-purple-200 font-bold">Profil &gt; Veli Bağlantısı</strong> ekranındaki 6 haneli kodu girerek hesabına bağlanabilirsiniz.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isSocialSubmitting}
                onClick={() => handleCompleteSocialRegistration(false)}
                className={`w-full text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                  socialSelectedRole === 'parent' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                {isSocialSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <span>
                    {socialSelectedRole === 'parent' ? '👨‍👩‍👧 Veli Paneline Başla' : '🎓 Öğrenci Olarak Devam Et'}
                  </span>
                )}
              </button>

              {socialSelectedRole === 'parent' && (
                <button
                  type="button"
                  disabled={isSocialSubmitting}
                  onClick={() => handleCompleteSocialRegistration(true)}
                  className="w-full text-xs font-extrabold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-100/70 dark:bg-purple-900/40 border border-purple-300/80 dark:border-purple-700/60 py-2.5 px-3 rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Öğrenci kodunu daha sonra girmek istiyorum</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ----------------- MODE 2: FORGOT PASSWORD - STEP 1 (ENTER EMAIL) ----------------- */}
        {mode === 'forgot_email' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl mx-auto flex items-center justify-center border border-amber-500/20 shadow-sm">
                <span className="material-symbols-outlined text-3xl">lock_reset</span>
              </div>
              <h2 className="font-extrabold text-2xl text-text-main">
                Şifremi Unuttum
              </h2>
              <p className="text-xs text-text-muted leading-relaxed px-2">
                Hesabınıza kayıtlı e-posta adresinizi girin. Size güvenli <strong className="text-text-main font-bold">şifre sıfırlama bağlantısı</strong> göndereceğiz.
              </p>
            </div>

            <form onSubmit={handleSendResetCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1 ml-1">E-posta Adresiniz</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                    mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@edu.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3.5 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetLoading}
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isResetLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Bağlantı Gönderiliyor...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">send</span>
                    <span>Şifre Sıfırlama Bağlantısı Gönder</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('login');
                }}
                className="text-xs font-bold text-text-muted hover:text-text-main flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Giriş Ekranına Dön</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- MODE 3: FORGOT PASSWORD - STEP 2 (ENTER 6-DIGIT OTP) ----------------- */}
        {mode === 'forgot_otp' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl mx-auto flex items-center justify-center border border-primary/20 shadow-sm">
                <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
              </div>
              <h2 className="font-extrabold text-xl text-text-main">
                Doğrulama Kodunu Girin
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                <strong className="text-text-main font-bold">{email}</strong> adresine gönderilen 6 haneli güvenlik kodunu girin.
              </p>
            </div>

            {/* Dev Code Banner for Easy Local Preview Testing */}
            {devCode && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-700 dark:text-amber-400 space-y-1.5 text-center">
                <div className="font-bold flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm">mark_as_unread</span>
                  <span>E-posta Kodunuz (Önizleme/Test):</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-lg font-black tracking-widest bg-amber-500/20 px-3 py-1 rounded-lg">
                    {devCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devCode)}
                    className="text-[11px] font-bold text-primary underline hover:opacity-80 cursor-pointer"
                  >
                    Kodu Kopyala / Yapıştır
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1 text-center">6 Haneli Kodu Yazın</label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-surface-container-low border border-card-border rounded-xl py-3.5 text-center text-xl font-mono tracking-[0.5em] font-black text-text-main focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyOtpLoading || otpCode.length !== 6}
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifyOtpLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Kod Kontrol Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">verified</span>
                    <span>Kodu Doğrula ve Devam Et</span>
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('forgot_email');
                }}
                className="font-bold text-text-muted hover:text-text-main flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>E-postayı Değiştir</span>
              </button>

              <button
                type="button"
                disabled={resendCountdown > 0 || isResetLoading}
                onClick={handleSendResetCode}
                className="font-bold text-primary hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
              >
                {resendCountdown > 0
                  ? `Tekrar Gönder (${resendCountdown}s)`
                  : 'Kodu Tekrar Gönder'}
              </button>
            </div>
          </div>
        )}

        {/* ----------------- MODE 4: FORGOT PASSWORD - STEP 3 (NEW PASSWORD) ----------------- */}
        {mode === 'forgot_new_password' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl mx-auto flex items-center justify-center border border-emerald-500/20 shadow-sm">
                <span className="material-symbols-outlined text-3xl">key</span>
              </div>
              <h2 className="font-extrabold text-2xl text-text-main">
                Yeni Şifre Belirleyin
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Hesabınız için güçlü ve yeni bir şifre girin.
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1 ml-1">Yeni Şifre</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-10 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1 ml-1">Yeni Şifre (Tekrar)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                    lock_reset
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* Password Checklist */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 px-1 text-[11px]">
                <div className={`flex items-center gap-1 ${has8Chars ? 'text-emerald-600 font-bold' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-sm">{has8Chars ? 'check_circle' : 'cancel'}</span>
                  <span>En az 8 karakter</span>
                </div>
                <div className={`flex items-center gap-1 ${hasUpperLower ? 'text-emerald-600 font-bold' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-sm">{hasUpperLower ? 'check_circle' : 'cancel'}</span>
                  <span>Büyük/Küçük harf</span>
                </div>
                <div className={`flex items-center gap-1 ${passwordsMatch ? 'text-emerald-600 font-bold' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-sm">{passwordsMatch ? 'check_circle' : 'cancel'}</span>
                  <span>Şifreler eşleşiyor</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSetNewPassLoading || !has8Chars || newPassword !== confirmPassword}
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSetNewPassLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Şifre Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">published_with_changes</span>
                    <span>Şifremi Güncelle ve Kaydet</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ----------------- MODE 5: FORGOT PASSWORD - SUCCESS (Password changed via OTP flow) ----------------- */}
        {mode === 'forgot_success' && (
          <div className="text-center space-y-5 animate-fadeIn py-2">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center border border-emerald-500/30 shadow-lg animate-bounce">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>

            <div className="space-y-2">
              <h2 className="font-extrabold text-2xl text-text-main">
                Şifre Güncellendi! 🎉
              </h2>
              <p className="text-xs text-text-muted leading-relaxed px-4">
                Yeni şifreniz başarıyla kaydedildi. Artık yeni şifrenizi kullanarak hesabınıza giriş yapabilirsiniz.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('login');
              }}
              className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>Giriş Ekranına Git</span>
            </button>
          </div>
        )}

        {/* ----------------- MODE 6: FORGOT PASSWORD - LINK SENT (Firebase reset email) ----------------- */}
        {mode === 'forgot_link_sent' && (
          <div className="text-center space-y-5 animate-fadeIn py-2">
            <div className="w-16 h-16 bg-primary/15 text-primary rounded-full mx-auto flex items-center justify-center border border-primary/30 shadow-lg animate-bounce">
              <span className="material-symbols-outlined text-4xl">mark_email_read</span>
            </div>

            <div className="space-y-2">
              <h2 className="font-extrabold text-2xl text-text-main">
                Sıfırlama Bağlantısı Gönderildi!
              </h2>
              <p className="text-xs text-text-muted leading-relaxed px-4">
                <strong className="text-text-main font-bold">{email}</strong> adresine şifre sıfırlama bağlantısı gönderildi. E-postanızdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz.
              </p>
              <p className="text-[11px] text-text-muted px-4">
                E-posta birkaç dakika içinde gelmezse spam/istenmeyen klasörünüzü kontrol edin.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('login');
              }}
              className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>Giriş Ekranına Dön</span>
            </button>
          </div>
        )}



        {/* EULA and Community Guidelines Modal (Apple Guideline 1.2 Compliant) */}
        {isEulaModalOpen && (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pb-16 sm:pb-4 animate-fadeIn">
            <div className="bg-card-bg w-full max-w-lg rounded-3xl p-6 border border-card-border shadow-2xl space-y-4 max-h-[85dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-card-border pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">gavel</span>
                  <div>
                    <h3 className="font-extrabold text-base text-text-main">Topluluk Kuralları & EULA</h3>
                    <p className="text-[11px] text-text-muted">Son Kullanıcı Lisans Sözleşmesi (Sıfır Tolerans)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEulaModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-text-muted leading-relaxed overflow-y-auto flex-1 overscroll-contain pr-1">
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary font-bold">
                  ⚠️ Sıfır Tolerans İlkesi: Eğitim Koçum platformunda uygunsuz içeriklere, hakaret, zorbalık, müstehcenlik veya nefret söylemine kesinlikle sıfır tolerans uygulanır.
                </div>

                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-text-main">1. Saygılı ve Eğitici İletişim</h4>
                  <p>
                    Topluluk alanı öğrencilerin ders sorularını paylaşması ve dayanışma kurması için tasarlanmıştır. Diğer öğrencileri rencide edici, küçük düşürücü veya saldırgan ifadeler kullanmak yasaktır.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-text-main">2. Otomatik Kelime Filtreleme</h4>
                  <p>
                    Sistemimiz küfür, hakaret ve uygunsuz ifadeleri anlık olarak filtreler ve bu tür gönderilerin yayınlanmasını engeller.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-text-main">3. Kullanıcı Şikayet ve Engelleme Mekanizması</h4>
                  <p>
                    Her gönderi ve yorumun yanında bulunan <strong>Şikayet Et</strong> ve <strong>Kullanıcıyı Engelle</strong> butonları ile rahatsız edici içerikleri anında akışınızdan gizleyebilir ve moderatörlerimize bildirebilirsiniz.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-text-main">4. 24 Saat İçinde Moderatör İncelemesi</h4>
                  <p>
                    Kullanıcılar tarafından bildirilen tüm şikayetler moderasyon ekibimizce <strong>en geç 24 saat içinde</strong> incelenir. Kuralları ihlal eden içerikler kalıcı olarak silinir ve ihlali gerçekleştiren kullanıcının hesabı derhal sonlandırılır.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-card-border flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEulaModalOpen(false)}
                  className="px-5 py-2.5 bg-primary text-white font-extrabold text-xs rounded-xl hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  Anladım ve Kabul Ediyorum
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
