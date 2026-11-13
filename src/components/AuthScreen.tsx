import { useEffect, useRef, useState } from 'react';
import { Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { apiRequest, setAuthToken } from '@/src/lib/api';
import type { BrandMedia, User } from '@/src/types';
import { BrandLogo, DEFAULT_FOUNDER_PHOTO1_URL } from './BrandLogo';

type AuthMode = 'otp' | 'owner';
type OtpChannel = 'phone' | 'email';

interface AuthScreenProps {
  initialMode?: AuthMode;
  ownerConfigured: boolean;
  brandMedia?: BrandMedia;
  onAuthSuccess: (user: User) => void;
  onCancel?: () => void;
}

export function AuthScreen({
  initialMode = 'otp',
  ownerConfigured,
  brandMedia,
  onAuthSuccess,
  onCancel,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [expectedOwnerEmail, setExpectedOwnerEmail] = useState('kpattitudeshort@gmail.com');
  const [isOwnerConfigured, setIsOwnerConfigured] = useState(ownerConfigured);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    apiRequest<{ ownerConfigured: boolean; expectedOwnerEmail: string }>('/api/auth/owner-status')
      .then((res) => {
        setIsOwnerConfigured(res.ownerConfigured);
        setExpectedOwnerEmail(res.expectedOwnerEmail);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = window.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendSeconds]);

  const clearFeedback = () => {
    setError(null);
    setInfoMessage(null);
  };

  const normalizedPhone = () => {
    const trimmed = phone.trim();
    let digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    return trimmed.startsWith('+') ? `+${digits}` : `+91${digits}`;
  };

  const normalizedStudentEmail = () => studentEmail.trim().toLowerCase();

  const maskedTarget = () => {
    if (otpChannel === 'email') {
      const target = normalizedStudentEmail();
      const [local, domain] = target.split('@');
      if (!domain) return target;
      const visible = local.slice(0, Math.min(3, local.length));
      return `${visible}${'•'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
    }
    const p = normalizedPhone();
    if (p.length <= 4) return p;
    return `+91 ••••••${p.slice(-4)}`;
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearFeedback();

    if (otpChannel === 'phone') {
      const digits = normalizedPhone().replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
    } else {
      const targetEmail = normalizedStudentEmail();
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        setError('Please enter a valid Gmail or email address.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload =
        otpChannel === 'email'
          ? { channel: 'email' as const, email: normalizedStudentEmail() }
          : { channel: 'phone' as const, phone: normalizedPhone() };

      const res = await apiRequest<{
        sent: boolean;
        channel?: OtpChannel;
        delivered?: boolean;
        message: string;
        previewOtp?: string;
      }>('/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setResendSeconds(24);
      setPreviewOtp(res.previewOtp || null);
      setInfoMessage(res.message);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFillPreviewOtp = () => {
    if (!previewOtp || previewOtp.length !== 6) return;
    setOtpDigits(previewOtp.split(''));
    otpRefs.current[5]?.focus();
  };

  const handleOtpBoxChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    otpRefs.current[Math.min(5, pasted.length)]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Please enter all 6 digits of your OTP.');
      return;
    }
    setLoading(true);
    try {
      const payload =
        otpChannel === 'email'
          ? {
              channel: 'email' as const,
              email: normalizedStudentEmail(),
              code,
              name: name.trim() || undefined,
            }
          : {
              channel: 'phone' as const,
              phone: normalizedPhone(),
              code,
              name: name.trim() || undefined,
            };

      const res = await apiRequest<{ token: string; user: User }>('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSetupOrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setLoading(true);
    try {
      const endpoint = isOwnerConfigured ? '/api/auth/admin/login' : '/api/auth/owner-setup';
      const payload = isOwnerConfigured
        ? { email: email || expectedOwnerEmail, password }
        : { name: name || 'KP HUBE Admin', email: email || expectedOwnerEmail, password, phone };
      const res = await apiRequest<{ token: string; user: User }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const founderPhotoUrl = brandMedia?.photo1DataUrl || DEFAULT_FOUNDER_PHOTO1_URL;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9FE] px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-[0_18px_50px_rgba(109,40,217,0.08)]">
        <div className="flex items-center justify-between border-b border-purple-50 pb-4">
          <BrandLogo size="sm" showTagline />
          <img
            src={founderPhotoUrl}
            alt="KP HUBE Founder"
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full border-2 border-[#FDE68A] bg-white object-cover object-top shrink-0"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-[#FFFBEB] px-4 py-3 text-sm text-slate-800">
            <p>{infoMessage}</p>
            {previewOtp && (
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-purple-200 bg-white px-3 py-2">
                <p className="font-mono text-sm font-bold tracking-widest text-[#6D28D9]">
                  OTP: {previewOtp}
                </p>
                <button
                  type="button"
                  onClick={handleAutoFillPreviewOtp}
                  className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-[#6D28D9] hover:bg-purple-100 transition-colors"
                >
                  Auto-Fill
                </button>
              </div>
            )}
          </div>
        )}

        {/* MOBILE NUMBER OR GMAIL OTP REGISTRATION / LOGIN */}
        {mode === 'otp' && !otpSent && (
          <form onSubmit={handleRequestOtp} className="mt-6 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
                Register or Sign In
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Verify with Mobile Number OTP or Gmail OTP to continue to KP HUBE
              </p>
            </div>

            {/* Channel Selector: Mobile Number OR Gmail */}
            <div
              role="tablist"
              aria-label="OTP Verification Method"
              className="grid grid-cols-2 gap-2 rounded-2xl border border-purple-100 bg-[#FAF9FE] p-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={otpChannel === 'phone'}
                onClick={() => {
                  setOtpChannel('phone');
                  clearFeedback();
                }}
                className={`min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all ${
                  otpChannel === 'phone'
                    ? 'bg-white text-[#6D28D9] shadow-sm border border-purple-100'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                Mobile OTP
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={otpChannel === 'email'}
                onClick={() => {
                  setOtpChannel('email');
                  clearFeedback();
                }}
                className={`min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all ${
                  otpChannel === 'email'
                    ? 'bg-white text-[#6D28D9] shadow-sm border border-purple-100'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Gmail OTP
              </button>
            </div>

            <div>
              <label htmlFor="student-name" className="block text-xs font-semibold text-slate-700">
                Your Name (Optional for existing users)
              </label>
              <input
                id="student-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
              />
            </div>

            {otpChannel === 'phone' ? (
              <div>
                <label htmlFor="otp-phone" className="block text-xs font-semibold text-slate-700">
                  Indian Mobile Number
                </label>
                <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-xl border border-slate-200 bg-[#FAF9FE] focus-within:border-[#7C3AED] focus-within:bg-white transition-colors">
                  <span className="border-r border-slate-200 px-3.5 text-sm font-semibold text-[#6D28D9] select-none">
                    +91
                  </span>
                  <input
                    id="otp-phone"
                    type="tel"
                    required
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="h-full w-full bg-transparent px-3.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="otp-email" className="block text-xs font-semibold text-slate-700">
                  Gmail / Email Address
                </label>
                <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-xl border border-slate-200 bg-[#FAF9FE] focus-within:border-[#7C3AED] focus-within:bg-white transition-colors">
                  <span className="border-r border-slate-200 px-3.5 text-[#6D28D9] select-none">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input
                    id="otp-email"
                    type="email"
                    required
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="h-full w-full bg-transparent px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? 'Sending OTP...'
                : otpChannel === 'email'
                  ? 'Send Gmail OTP'
                  : 'Send Mobile OTP'}
            </button>

            <p className="text-center text-xs text-slate-400">
              You stay signed in securely on this device
            </p>
          </form>
        )}

        {/* OTP VERIFICATION */}
        {mode === 'otp' && otpSent && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-[#6D28D9]">
              {otpChannel === 'email' ? (
                <Mail className="h-7 w-7" aria-hidden="true" />
              ) : (
                <Smartphone className="h-7 w-7" aria-hidden="true" />
              )}
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">Verify OTP</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter the 6-digit OTP for your {otpChannel === 'email' ? 'Gmail' : 'mobile'}
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                {maskedTarget()}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={idx === 0 ? handleOtpPaste : undefined}
                  aria-label={`Digit ${idx + 1}`}
                  className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border border-slate-200 bg-[#FAF9FE] text-center font-mono text-lg font-bold text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
                />
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 text-xs text-slate-500 tabular-nums">
              {resendSeconds > 0 ? (
                <span>Resend OTP in 00:{String(resendSeconds).padStart(2, '0')}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  className="font-semibold text-[#6D28D9] hover:underline"
                >
                  Resend OTP
                </button>
              )}
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setPreviewOtp(null);
                  clearFeedback();
                }}
                className="font-medium text-slate-600 hover:text-slate-900"
              >
                {otpChannel === 'email' ? 'Change Gmail' : 'Change number'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Verifying OTP...' : 'Verify OTP & Continue'}
            </button>
          </form>
        )}

        {/* PRIVATE OWNER ADMIN AUTH (Only accessible via private /admin URL) */}
        {mode === 'owner' && (
          <form onSubmit={handleOwnerSetupOrLogin} className="mt-6 space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {isOwnerConfigured ? 'Admin Panel Sign In' : 'Create Admin Password'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isOwnerConfigured
                  ? 'Authorized owner access to manage KP HUBE videos & payments.'
                  : 'Set your owner admin password once to secure the Admin Panel.'}
              </p>
            </div>

            <div>
              <label htmlFor="owner-email" className="block text-xs font-semibold text-slate-700">
                Owner Email
              </label>
              <input
                id="owner-email"
                type="email"
                required
                value={email || expectedOwnerEmail}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="owner-password"
                className="block text-xs font-semibold text-slate-700"
              >
                {isOwnerConfigured ? 'Admin Password' : 'Create Password (min 6 chars)'}
              </label>
              <input
                id="owner-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {loading
                ? 'Signing in...'
                : isOwnerConfigured
                  ? 'Sign In to Admin Panel'
                  : 'Set Up Admin Panel'}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500">
          {mode === 'owner' ? (
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                if (onCancel) onCancel();
                else setMode('otp');
              }}
              className="font-medium text-[#6D28D9] hover:underline"
            >
              Back to Website
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
            >
              Back to Website
            </button>
          ) : (
            <span className="text-slate-400">KP HUBE Student Access</span>
          )}
          <span className="font-medium text-[#B45309]">₹499 Course Access</span>
        </div>
      </div>
    </div>
  );
}
