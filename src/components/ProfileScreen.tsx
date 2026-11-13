import { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  LogOut,
  Receipt,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { apiRequest } from '@/src/lib/api';
import type { User } from '@/src/types';

interface ProfileScreenProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onOpenMyCourse: () => void;
  onOpenPaymentHistory: () => void;
  onOpenSupport: () => void;
  onOpenAdminDashboard: () => void;
}

export function ProfileScreen({
  user,
  onUserUpdated,
  onLogout,
  onOpenMyCourse,
  onOpenPaymentHistory,
  onOpenSupport,
  onOpenAdminDashboard,
}: ProfileScreenProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      onUserUpdated(res.user);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Basic Profile Info: Student Name & Mobile Number */}
      <div className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-[#6D28D9] shrink-0">
              <UserIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">{user.name}</h1>
              <p className="mt-0.5 font-mono text-sm text-slate-500">
                {user.phone || user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="min-h-[40px] rounded-xl border border-purple-200 px-4 py-2 text-xs font-semibold text-[#6D28D9] hover:bg-purple-50 transition-colors self-start sm:self-center"
          >
            {editing ? 'Cancel' : 'Edit Name'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {editing && (
          <form onSubmit={handleSaveName} className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-[#6D28D9] px-5 py-2 text-sm font-semibold text-white"
            >
              {saving ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        )}
      </div>

      {user.role === 'admin' && (
        <div className="rounded-[24px] bg-gradient-to-r from-[#6D28D9] to-[#D97706] p-5 text-white shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-display text-base font-bold">Owner Admin Panel</p>
              <p className="text-xs text-purple-100">
                Manage students, verified payments & video lessons
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAdminDashboard}
            className="min-h-[40px] rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#6D28D9] hover:bg-purple-50 shrink-0"
          >
            Open Admin Panel
          </button>
        </div>
      )}

      {/* Basic Profile Options Only: My Course, Payment History, Help & Support, Logout */}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-[28px] border border-purple-100 bg-white shadow-sm">
        <button
          type="button"
          onClick={onOpenMyCourse}
          className="flex w-full items-center gap-4 p-5 text-left hover:bg-[#FAF9FE] transition-colors"
        >
          <BookOpen className="h-5 w-5 text-[#6D28D9] shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900">My Course</p>
            <p className="text-xs text-slate-500">KP HUBE Complete Course video lessons</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenPaymentHistory}
          className="flex w-full items-center gap-4 p-5 text-left hover:bg-[#FAF9FE] transition-colors"
        >
          <Receipt className="h-5 w-5 text-[#6D28D9] shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900">Payment History</p>
            <p className="text-xs text-slate-500">View payment status and transaction IDs</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenSupport}
          className="flex w-full items-center gap-4 p-5 text-left hover:bg-[#FAF9FE] transition-colors"
        >
          <HelpCircle className="h-5 w-5 text-[#D97706] shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900">Help and Support</p>
            <p className="text-xs text-slate-500">Contact Kphubeyoutube63 or submit a question</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-4 p-5 text-left text-red-600 hover:bg-red-50/50 transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="font-semibold">Logout</span>
        </button>
      </div>
    </div>
  );
}
