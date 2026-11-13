import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';
import { apiRequest } from '@/src/lib/api';
import type { User } from '@/src/types';

interface SupportScreenProps {
  user: User | null;
  onBack: () => void;
}

const FAQS = [
  {
    q: 'How do I unlock KP HUBE Complete Course after payment?',
    a: 'Pay ₹499 using the verified UPI QR or UPI ID (kailash100k@axl) and submit your UTR / Transaction Reference ID. Your course unlocks automatically once payment verification completes.',
  },
  {
    q: 'Where can I watch my unlocked video lessons?',
    a: 'Open the My Course tab from the navigation bar. All numbered video lessons, durations, completion status, and study materials appear there.',
  },
  {
    q: 'How do I contact KP HUBE support?',
    a: 'Use the support form on this page or reference the official KP HUBE contact username Kphubeyoutube63.',
  },
  {
    q: 'What if my payment failed or is still pending?',
    a: 'Check your Payment History in Profile or submit your UTR reference ID via this support form for fast verification.',
  },
];

export function SupportScreen({ user, onBack }: SupportScreenProps) {
  const [name, setName] = useState(user?.name || '');
  const [contactInfo, setContactInfo] = useState(user?.phone || user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'form' | 'email' | 'whatsapp'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ request: { id: string } }>('/api/support', {
        method: 'POST',
        body: JSON.stringify({ name, contactInfo, subject, message, channel }),
      });
      setSubmittedId(res.request.id);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit support request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <div className="border-b border-purple-100 pb-5">
        <p className="font-mono text-xs font-semibold text-[#6D28D9]">KP HUBE HELP CENTER</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Help & Support
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Official contact identifier:{' '}
          <span className="font-mono font-semibold text-[#6D28D9]">Kphubeyoutube63</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2.5 text-[#6D28D9]">
            <Mail className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900">Contact ID</h2>
          </div>
          <p className="text-sm text-slate-700">
            Gmail Username: <span className="font-mono font-semibold">Kphubeyoutube63</span>
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-[#FFFDF7] p-5 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2.5 text-[#D97706]">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Direct Ticket Review
            </h2>
          </div>
          <p className="text-sm text-slate-700">
            Submit your payment UTR or question below for direct KP HUBE review.
          </p>
        </div>
      </div>

      <div className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Send Support Request
        </h2>

        {submittedId && (
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              Request submitted (ID: <span className="font-mono font-semibold">{submittedId}</span>
              ). We will review it shortly.
            </span>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sup-name" className="block text-xs font-semibold text-slate-700">
                Your Name
              </label>
              <input
                id="sup-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sup-contact" className="block text-xs font-semibold text-slate-700">
                Your Mobile Number or Email
              </label>
              <input
                id="sup-contact"
                type="text"
                required
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="How should we reply?"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sup-subject" className="block text-xs font-semibold text-slate-700">
                Subject
              </label>
              <input
                id="sup-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Payment verification or course help"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sup-channel" className="block text-xs font-semibold text-slate-700">
                Preferred Channel
              </label>
              <select
                id="sup-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'form' | 'email' | 'whatsapp')}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
              >
                <option value="form">In-App Support Ticket</option>
                <option value="email">Email Follow-up</option>
                <option value="whatsapp">WhatsApp Follow-up</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sup-message" className="block text-xs font-semibold text-slate-700">
              Message
            </label>
            <textarea
              id="sup-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your question or share your UTR transaction ID..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] p-4 text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Sending...' : 'Send Support Request'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-slate-100 rounded-[28px] border border-purple-100 bg-white shadow-sm">
          {FAQS.map((item, idx) => {
            const open = openFaq === idx;
            return (
              <div key={idx} className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="font-semibold text-slate-900">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {open && <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
