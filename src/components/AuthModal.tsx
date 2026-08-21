import React, { useState, useEffect } from 'react';
import { Kullanici } from '../types';
import { auth, db, loginWithGoogle, resetPasswordFirebase, loginWithEmailFirebase, registerWithEmailFirebase } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: Partial<Kullanici>) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_email' | 'forgot_otp' | 'forgot_new_password' | 'forgot_success' | 'forgot_link_sent';

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

  // UI status states
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  // Auto clean form inputs when modal opens or switches mode
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
    }
  }, [isOpen, mode]);

  // Reset loading state if tab changes or user returns to window
  useEffect(() => {
    const handleTabFocus = () => {
      if (loading) {
        setTimeout(() => setLoading(false), 1500);
      }
    };

    window.addEventListener('focus', handleTabFocus);
    document.addEventListener('visibilitychange', handleTabFocus);

    return () => {
      window.removeEventListener('focus', handleTabFocus);
      document.removeEventListener('visibilitychange', handleTabFocus);
    };
  }, [loading]);

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
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!agreeTerms) {
          setErrorMsg('Lütfen kullanıcı sözleşmesini ve şartları kabul edin.');
          setLoading(false);
          return;
        }

        // Validate username format
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 20) {
          setErrorMsg('Kullanıcı adı en az 3, en fazla 20 karakter olmalı ve yalnızca küçük harf, rakam ve alt tire (_) içermelidir.');
          setLoading(false);
          return;
        }

        // Check if username is already taken in Firestore
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('kullaniciAdi_lower', '==', cleanUsername));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setErrorMsg(`"@${cleanUsername}" kullanıcı adı zaten başkası tarafından alınmış. Lütfen başka bir kullanıcı adı seçin.`);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Username uniqueness check warning:', e);
        }

        if (password.length < 8) {
          setErrorMsg('Şifreniz en az 8 karakter olmalıdır.');
          setLoading(false);
          return;
        }
        const hasUpperLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
        if (!hasUpperLower) {
          setErrorMsg('Şifreniz en az bir büyük ve bir küçük harf içermelidir.');
          setLoading(false);
          return;
        }

        let examDate = '2027-06-19';
        if (selectedExam === 'LGS') examDate = '2027-06-06';
        else if (selectedExam === 'KPSS') examDate = '2027-07-18';
        else if (selectedExam === 'YDS') examDate = '2027-04-11';
        else if (selectedExam === 'Hazırlanmıyorum') examDate = '';

        const cleanName = name.trim() || 'Öğrenci';
        const fbUser = await registerWithEmailFirebase(email.trim(), password, cleanName);
        try {
          await setDoc(doc(db, 'users', fbUser.uid), {
            id: fbUser.uid,
            ad: cleanName,
            kullaniciAdi: cleanUsername,
            kullaniciAdi_lower: cleanUsername,
            email: fbUser.email || email.trim(),
            kredi: 10,
            maxKredi: 10,
            seri: 1,
            xp: 0,
            isPremium: false,
            sinif: 'YKS / LGS Hazırlık',
            avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
            targetExam: selectedExam,
            targetExamDate: examDate,
            createdAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {}

        onLoginSuccess({
          id: fbUser.uid,
          ad: cleanName,
          kullaniciAdi: cleanUsername,
          kullaniciAdi_lower: cleanUsername,
          email: fbUser.email || email,
          targetExam: selectedExam,
          targetExamDate: examDate,
        });
        onClose();
      } else {
        const fbUser = await loginWithEmailFirebase(email.trim(), password);
        let userKullaniciAdi = 'ogrenci';
        try {
          const userDocSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDocSnap.exists() && userDocSnap.data()?.kullaniciAdi) {
            userKullaniciAdi = userDocSnap.data().kullaniciAdi;
          }
        } catch (e) {}

        onLoginSuccess({
          id: fbUser.uid,
          ad: fbUser.displayName || name.trim() || 'Öğrenci',
          kullaniciAdi: userKullaniciAdi,
          email: fbUser.email || email,
        });
        onClose();
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg('Firebase Console üzerinde E-posta/Şifre ile Giriş yöntemi henüz etkinleştirilmemiş.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('Bu e-posta adresi zaten başka bir hesapta kayıtlı. Lütfen giriş yapın.');
      } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setErrorMsg('E-posta adresi veya şifre hatalı.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Şifreniz en az 8 karakter ve büyük/küçük harf içermelidir.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Geçersiz bir e-posta adresi girdiniz.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMsg('İnternet bağlantısı hatası. Lütfen ağınızı kontrol edip tekrar deneyin.');
      } else {
        setErrorMsg(err?.message || 'Giriş / Kayıt işlemi gerçekleştirilemedi. Lütfen bilgilerinizi kontrol edin.');
      }
    } finally {
      setLoading(false);
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

    setLoading(true);
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
      setLoading(false);
    }
  };

  // Step 2: Verify 6-digit Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Lütfen 6 haneli doğrulama kodunu eksiksiz girin.');
      return;
    }

    setLoading(true);
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
      setLoading(false);
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

    setLoading(true);
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
      setLoading(false);
    }
  };

  // Password criteria checks (8 characters + Upper & Lowercase letter)
  const passCheck = mode === 'register' ? password : newPassword;
  const has8Chars = passCheck.length >= 8;
  const hasUpperLower = /[A-Z]/.test(passCheck) && /[a-z]/.test(passCheck);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn ${
      !auth.currentUser ? 'bg-slate-950/95 backdrop-blur-xl' : 'bg-black/75 backdrop-blur-xs'
    }`}>
      <div className="bg-card-bg w-full max-w-md rounded-3xl p-6 sm:p-8 border border-card-border space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
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

            {/* Social SSO Logins */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setErrorMsg(null);
                  setLoading(true);
                  try {
                    const firebaseUser = await loginWithGoogle();
                    if (firebaseUser) {
                      let finalUsername = 'ogrenci';
                      try {
                        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
                        if (userSnap.exists() && userSnap.data()?.kullaniciAdi) {
                          finalUsername = userSnap.data().kullaniciAdi;
                        } else {
                          const base = (firebaseUser.email?.split('@')[0] || firebaseUser.displayName || 'ogrenci')
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '')
                            .slice(0, 12);
                          finalUsername = `${base || 'ogrenci'}_${Math.floor(100 + Math.random() * 900)}`;
                          await setDoc(doc(db, 'users', firebaseUser.uid), {
                            id: firebaseUser.uid,
                            ad: firebaseUser.displayName || 'Öğrenci',
                            kullaniciAdi: finalUsername,
                            kullaniciAdi_lower: finalUsername.toLowerCase(),
                            email: firebaseUser.email || 'ogrenci@egitimkocum.ai',
                            avatarUrl: firebaseUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                            updatedAt: new Date().toISOString(),
                          }, { merge: true });
                        }
                      } catch (e) {}

                      onLoginSuccess({
                        id: firebaseUser.uid,
                        ad: firebaseUser.displayName || 'Öğrenci',
                        kullaniciAdi: finalUsername,
                        kullaniciAdi_lower: finalUsername.toLowerCase(),
                        email: firebaseUser.email || 'ogrenci@egitimkocum.ai',
                        avatarUrl: firebaseUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                      });
                      onClose();
                    }
                  } catch (err: any) {
                    console.warn('Google Auth Status:', err);
                    if (auth.currentUser) {
                      onLoginSuccess({
                        id: auth.currentUser.uid,
                        ad: auth.currentUser.displayName || 'Öğrenci',
                        email: auth.currentUser.email || 'ogrenci@egitimkocum.ai',
                        avatarUrl: auth.currentUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                      });
                      onClose();
                      return;
                    }

                    if (err?.code === 'auth/cancelled-popup-request') {
                      return;
                    } else if (err?.code === 'auth/popup-closed-by-user') {
                      setErrorMsg('Giriş penceresi kapatıldı.');
                    } else if (err?.code === 'auth/operation-not-allowed') {
                      setErrorMsg('Firebase Console üzerinde Google ile Giriş sağlayıcısı henüz etkinleştirilmemiş.');
                    } else if (err?.code === 'auth/unauthorized-domain') {
                      setErrorMsg('🔒 Google Giriş Yetkisi: Bağlantı adresiniz yetkili alan adlarında bulunamadı. Lütfen Firebase yetkilerini kontrol edin.');
                    } else if (err?.code === 'auth/popup-blocked') {
                      setErrorMsg('🔒 Giriş penceresi açılamadı. Lütfen tarayıcınızın açılır pencere (popup) engelleyicisini kapatıp tekrar deneyin.');
                    } else {
                      setErrorMsg('Google ile giriş yapılamadı: ' + (err?.message || 'Lütfen tekrar deneyin.'));
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-surface-container-low border border-card-border py-3 px-4 rounded-xl text-xs font-bold text-text-main hover:border-primary/50 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>{loading ? 'Google ile Bağlanılıyor...' : 'Google ile Devam Et'}</span>
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
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1 ml-1">Ad Soyad</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg">
                        person
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Adınız Soyadınız"
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
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                          setUsername(val);
                        }}
                        placeholder="kullanici_adi (Örn: ahmet_yks)"
                        className="w-full bg-surface-container-low border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-text-muted ml-1 mt-0.5 block">Yalnızca küçük harf, rakam ve alt tire (_) kullanılabilir.</span>
                  </div>

                  {/* Exam Target Selection */}
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

              {/* Terms checkbox for registration */}
              {mode === 'register' && (
                <div className="flex items-start gap-2 pt-1 text-[11px] text-text-muted">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded text-primary cursor-pointer"
                    required
                  />
                  <span>
                    <span className="text-primary font-bold">Kullanım Şartları</span>'nı ve <span className="text-primary font-bold">Gizlilik Politikası</span>'nı okudum, onaylıyorum.
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer mt-2"
              >
                {mode === 'register' ? 'Hesabımı Oluştur' : 'Giriş Yap'}
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
                    className="w-full bg-surface-container-low border border-card-border rounded-xl py-3.5 pl-10 pr-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
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
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-surface-container-low border border-card-border rounded-xl py-3.5 text-center text-xl font-mono tracking-[0.5em] font-black text-text-main focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
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
                disabled={resendCountdown > 0 || loading}
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
                disabled={loading || !has8Chars || newPassword !== confirmPassword}
                className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
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
      </div>
    </div>
  );
};
