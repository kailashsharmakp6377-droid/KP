import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { apiRequest, formatINR } from '@/src/lib/api';
import type { BrandMedia, Course, PaymentRecord, User } from '@/src/types';
import { DEFAULT_UPI_ID, DEFAULT_UPI_PAYEE } from './BrandLogo';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
    };
  }
}

interface PaymentScreenProps {
  course: Course;
  user: User;
  brandMedia: BrandMedia;
  razorpayConfigured: boolean;
  onBack: () => void;
  onCourseUnlocked: () => void;
  onOpenMyCourse: () => void;
  onOpenPaymentHistory: () => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PaymentScreen({
  course,
  user,
  brandMedia,
  razorpayConfigured,
  onBack,
  onCourseUnlocked,
  onOpenMyCourse,
  onOpenPaymentHistory,
}: PaymentScreenProps) {
  const effectivePrice = course.discountPrice !== null ? course.discountPrice : course.price;
  const upiId = brandMedia.upiId || DEFAULT_UPI_ID;
  const payeeName = brandMedia.upiPayeeName || DEFAULT_UPI_PAYEE;

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${effectivePrice.toFixed(2)}&cu=INR&tn=${encodeURIComponent(course.title)}`;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showUtrStep, setShowUtrStep] = useState(false);
  const [utrRef, setUtrRef] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (brandMedia.upiQrDataUrl) {
      setQrDataUrl(brandMedia.upiQrDataUrl);
      return;
    }
    QRCode.toDataURL(upiUri, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1E1035',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [upiUri, brandMedia.upiQrDataUrl]);

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      window.setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleRazorpayCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        mode: 'razorpay' | 'upi_reference';
        razorpayKeyId: string | null;
        orderId: string;
        amountPaise: number;
        payment: PaymentRecord;
      }>('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ courseId: course.id, method: 'UPI' }),
      });

      if (res.mode !== 'razorpay' || !res.razorpayKeyId) {
        setShowUtrStep(true);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error('Could not load payment gateway script.');
      }

      const rzp = new window.Razorpay({
        key: res.razorpayKeyId,
        amount: res.amountPaise,
        currency: 'INR',
        name: 'KP HUBE',
        description: course.title,
        order_id: res.orderId,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || undefined,
        },
        theme: { color: '#6D28D9' },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await apiRequest<{ ok: boolean; payment: PaymentRecord }>(
              '/api/payments/verify-razorpay',
              {
                method: 'POST',
                body: JSON.stringify({
                  paymentId: res.payment.id,
                  ...response,
                }),
              }
            );
            setPaymentRecord(verifyRes.payment);
            onCourseUnlocked();
          } catch (verifyErr) {
            setError(
              verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed.'
            );
          }
        },
      });

      rzp.on('payment.failed', async (resp) => {
        const reason = resp.error?.description || 'Payment failed.';
        const failedRes = await apiRequest<{ payment: PaymentRecord }>(
          '/api/payments/mark-failed',
          {
            method: 'POST',
            body: JSON.stringify({ paymentId: res.payment.id, reason }),
          }
        ).catch(() => null);
        if (failedRes?.payment) {
          setPaymentRecord(failedRes.payment);
        } else {
          setError(reason);
        }
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start gateway payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = utrRef.trim();
    if (cleaned.length < 6) {
      setError('Please enter your valid UPI UTR / Transaction Reference ID (at least 6 characters).');
      return;
    }

    setLoading(true);
    try {
      const orderRes = await apiRequest<{
        payment: PaymentRecord;
      }>('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ courseId: course.id, method: 'UPI' }),
      });

      const submitRes = await apiRequest<{ ok: boolean; payment: PaymentRecord }>(
        '/api/payments/submit-upi-reference',
        {
          method: 'POST',
          body: JSON.stringify({
            paymentId: orderRes.payment.id,
            transactionRef: cleaned,
            method: 'UPI',
          }),
        }
      );

      // Course NEVER unlocks automatically when user clicks "I HAVE PAID" — stays pending until verified!
      setPaymentRecord(submitRes.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit payment reference.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!paymentRecord) return;
    setCheckingStatus(true);
    setError(null);
    try {
      const res = await apiRequest<{ payment: PaymentRecord; unlocked: boolean }>(
        `/api/payments/${encodeURIComponent(paymentRecord.id)}/status`
      );
      setPaymentRecord(res.payment);
      if (res.payment.status === 'paid' && res.unlocked) {
        onCourseUnlocked();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh status.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // STEP 10: COURSE UNLOCKED SCREEN (Only when backend verified paid)
  if (paymentRecord?.status === 'paid') {
    return (
      <div className="mx-auto max-w-lg py-8">
        <div className="rounded-[28px] border border-amber-200 bg-white p-8 text-center shadow-[0_18px_50px_rgba(109,40,217,0.1)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-[#F59E0B] text-white shadow-md">
            <Sparkles className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="mt-5 font-mono text-xs font-semibold tracking-wider text-[#B45309]">
            PAYMENT VERIFIED
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">
            COURSE UNLOCKED
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your enrollment in <strong>{paymentRecord.courseTitle}</strong> is now saved in your
            account. All video lessons are ready to watch.
          </p>

          <div className="mt-6 rounded-2xl border border-purple-100 bg-[#FAF9FE] p-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction ID</span>
              <span className="font-mono font-semibold text-slate-900">
                {paymentRecord.transactionRef}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Paid</span>
              <span className="font-mono font-semibold text-[#6D28D9] tabular-nums">
                {formatINR(paymentRecord.amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Verified & Unlocked
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenMyCourse}
            className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity"
          >
            Open My Course
          </button>
        </div>
      </div>
    );
  }

  // PAYMENT FAILED SCREEN (Do NOT unlock course)
  if (paymentRecord?.status === 'failed') {
    return (
      <div className="mx-auto max-w-lg py-8">
        <div className="rounded-[28px] border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <XCircle className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-slate-900">
            Payment Failed / Rejected
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {paymentRecord.failureReason ||
              'Your payment could not be verified. The course remains locked.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setPaymentRecord(null);
                setShowUtrStep(false);
                setUtrRef('');
              }}
              className="h-11 flex-1 rounded-xl bg-[#6D28D9] text-sm font-semibold text-white"
            >
              Try Payment Again
            </button>
            <button
              type="button"
              onClick={onOpenPaymentHistory}
              className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
            >
              Payment History
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PENDING VERIFICATION SCREEN (Never unlocks on click alone)
  if (paymentRecord?.status === 'pending_verification') {
    return (
      <div className="mx-auto max-w-lg py-8">
        <div className="rounded-[28px] border border-purple-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-[#D97706]">
            <Clock className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-slate-900">
            Verifying Your Payment
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your UTR reference has been submitted. The course remains locked until your payment is
            verified by KP HUBE Admin or gateway confirmation.
          </p>

          <div className="mt-6 rounded-2xl border border-purple-100 bg-[#FAF9FE] p-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">UTR / Reference</span>
              <span className="font-mono font-semibold text-slate-900">
                {paymentRecord.transactionRef}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payee & UPI</span>
              <span className="font-mono text-slate-900">
                {payeeName} ({upiId})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount</span>
              <span className="font-mono font-semibold text-[#6D28D9] tabular-nums">
                {formatINR(paymentRecord.amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-semibold text-[#D97706]">Pending Verification</span>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={checkingStatus}
              onClick={handleCheckStatus}
              className="h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {checkingStatus ? 'Checking...' : 'Check Payment Status'}
            </button>
            <button
              type="button"
              onClick={onOpenPaymentHistory}
              className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
            >
              Payment History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Course Details
      </button>

      <div className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-[0_16px_45px_rgba(109,40,217,0.08)] space-y-6">
        {/* Course Price Header */}
        <div className="flex flex-col gap-2 border-b border-purple-50 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold text-[#6D28D9]">UPI & QR CHECKOUT</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">{course.title}</h1>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-slate-500">Course Price</p>
            <p className="font-mono text-3xl font-bold text-[#6D28D9] tabular-nums">
              {formatINR(effectivePrice)}
            </p>
          </div>
        </div>

        {/* Verified PhonePe / UPI QR matching exact kailash100k@axl & KP HUBE */}
        <div className="rounded-3xl border border-purple-100 bg-gradient-to-b from-[#FAF9FE] to-white p-6 text-center space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#6D28D9]">
              Scan & Pay Using PhonePe, Google Pay, Paytm or Any UPI App
            </p>
            <p className="text-xs text-slate-500">
              Verified Payee: <strong className="text-slate-900">{payeeName}</strong>
            </p>
          </div>

          <div className="mx-auto w-56 sm:w-64 overflow-hidden rounded-2xl border border-purple-100 bg-white p-3 shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Verified UPI QR Code for ${payeeName} (${upiId})`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-52 items-center justify-center text-xs text-slate-400">
                Generating verified QR...
              </div>
            )}
          </div>

          {/* Exact UPI ID & Copy */}
          <div className="flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-3 rounded-xl border border-amber-200 bg-[#FFFBEB] px-4 py-2.5 text-sm">
              <div className="text-left">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">
                  UPI ID
                </span>
                <span className="font-mono font-bold text-slate-900">{upiId}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-white border border-amber-200 px-3 py-1 text-xs font-semibold text-[#6D28D9] hover:bg-purple-50"
              >
                {copiedUpi ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={upiUri}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#5B21B6] transition-colors"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Pay via PhonePe / GPay / UPI App
              </a>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download="KP-HUBE-UPI-QR.png"
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Save QR
                </a>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* I HAVE PAID + Verification Step */}
        {!showUtrStep ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowUtrStep(true)}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-95 transition-opacity"
            >
              I HAVE PAID
            </button>

            {razorpayConfigured && (
              <button
                type="button"
                disabled={loading}
                onClick={handleRazorpayCheckout}
                className="h-11 w-full rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-semibold text-[#6D28D9] hover:bg-purple-50 transition-colors"
              >
                {loading ? 'Opening Gateway...' : `Instant Gateway Verification (${formatINR(effectivePrice)})`}
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitUtr} className="space-y-4 border-t border-purple-50 pt-5">
            <div>
              <label htmlFor="utr-ref" className="block text-xs font-semibold text-slate-700">
                Enter your 12-digit UPI UTR / Transaction Reference ID to verify payment
              </label>
              <input
                id="utr-ref"
                type="text"
                required
                minLength={6}
                value={utrRef}
                onChange={(e) => setUtrRef(e.target.value)}
                placeholder="e.g. 431298765432"
                className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 font-mono text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit for Payment Verification'}
              </button>
              <button
                type="button"
                onClick={() => setShowUtrStep(false)}
                className="h-12 rounded-xl border border-slate-200 px-5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-purple-50 bg-[#FAF9FE] p-4 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6D28D9]" aria-hidden="true" />
          <span>
            Course unlocks only after payment confirmation. Clicking &ldquo;I HAVE PAID&rdquo;
            without verified payment never unlocks course videos.
          </span>
        </div>
      </div>
    </div>
  );
}
