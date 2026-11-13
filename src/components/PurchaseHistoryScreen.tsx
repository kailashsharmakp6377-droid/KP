import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { apiRequest, formatINR } from '@/src/lib/api';
import type { PaymentRecord, Purchase } from '@/src/types';

interface PurchaseHistoryScreenProps {
  onBack: () => void;
  onOpenPlayer: (courseId: string) => void;
}

export function PurchaseHistoryScreen({ onBack, onOpenPlayer }: PurchaseHistoryScreenProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ purchases: Purchase[]; payments: PaymentRecord[] }>('/api/purchases')
      .then((res) => {
        setPurchases(res.purchases);
        setPayments(res.payments);
      })
      .finally(() => setLoading(false));
  }, []);

  const renderStatus = (status: PaymentRecord['status']) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Success · Unlocked
        </span>
      );
    }
    if (status === 'pending_verification') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D97706]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Pending Verification
        </span>
      );
    }
    if (status === 'refunded') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Refunded
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Failed
        </span>
      );
    }
    return <span className="text-xs text-slate-500">Initiated</span>;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Profile
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Payment History
        </h1>
        <p className="mt-1 text-sm text-slate-500">Your KP HUBE course enrollments & transactions</p>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-[28px] bg-white" />
      ) : (
        <div className="space-y-8">
          {purchases.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-slate-900">Unlocked Course</h2>
              <div className="divide-y divide-slate-100 rounded-[28px] border border-purple-100 bg-white shadow-sm">
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{p.courseTitle}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Unlocked {new Date(p.unlockedAt).toLocaleDateString('en-IN')} · {p.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm font-bold text-[#6D28D9] tabular-nums">
                        {formatINR(p.amountPaid)}
                      </span>
                      {p.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => onOpenPlayer(p.courseId)}
                          className="min-h-[40px] rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white"
                        >
                          Watch Course
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-900">Transactions</h2>
            {payments.length === 0 ? (
              <p className="rounded-[28px] border border-purple-100 bg-white p-6 text-sm text-slate-500">
                No payment transactions yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-[28px] border border-purple-100 bg-white shadow-sm">
                {payments.map((pay) => (
                  <div key={pay.id} className="p-5 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{pay.courseTitle}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          Ref: {pay.transactionRef} · {pay.method}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {renderStatus(pay.status)}
                        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {formatINR(pay.amount)}
                        </span>
                      </div>
                    </div>
                    {pay.failureReason && (
                      <p className="text-xs text-red-600">Note: {pay.failureReason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
