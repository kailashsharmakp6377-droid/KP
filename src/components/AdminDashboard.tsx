import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  IndianRupee,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { apiRequest, formatINR, getAuthToken, resolveApiUrl } from '@/src/lib/api';
import { resolveCourseThumbnail } from '@/src/lib/thumbnails';
import type {
  AdminLesson,
  BrandMedia,
  Category,
  Course,
  PaymentRecord,
  Purchase,
  SupportRequest,
  User,
} from '@/src/types';
import {
  BrandLogo,
  DEFAULT_UPI_ID,
  DEFAULT_UPI_PAYEE,
  FounderPhotoFrame,
} from './BrandLogo';

type AdminTab = 'overview' | 'courses' | 'students' | 'payments' | 'photos' | 'support';
type PaymentFilter = 'all' | 'paid' | 'pending_verification' | 'failed';
type StudentFilter = 'all' | 'purchased' | 'unpaid';

interface OverviewData {
  totalSales: number;
  monthlySales: number;
  monthlySeries: { month: string; revenue: number }[];
  studentsCount: number;
  coursesCount: number;
  publishedCoursesCount: number;
  pendingVerifications: number;
  openSupportCount: number;
  courses: Course[];
  lessons: AdminLesson[];
  categories: Category[];
}

interface StudentWithPurchases extends User {
  purchases: Purchase[];
}

interface AdminDashboardProps {
  brandMedia: BrandMedia;
  onBrandMediaUpdated: (bm: BrandMedia) => void;
  onCatalogChanged: () => void;
  onExitAdmin: () => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read file.'));
    };
    reader.onerror = () => reject(new Error('File read error.'));
    reader.readAsDataURL(file);
  });
}

export function AdminDashboard({
  brandMedia,
  onBrandMediaUpdated,
  onCatalogChanged,
  onExitAdmin,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [students, setStudents] = useState<StudentWithPurchases[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Course editing state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [cTitle, setCTitle] = useState('KP HUBE Complete Course');
  const [cSubtitle, setCSubtitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cCatId, setCCatId] = useState('cat-kp-hube');
  const [cThumb, setCThumb] = useState('founder:photo1');
  const [cPrice, setCPrice] = useState('499');
  const [cDiscount, setCDiscount] = useState('');
  const [cDuration, setCDuration] = useState('2h 30m');
  const [cChapters, setCChapters] = useState('');
  const [cPublished, setCPublished] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);

  // Add lesson state
  const [lessonCourseId, setLessonCourseId] = useState<string>('');
  const [lTitle, setLTitle] = useState('');
  const [lChapter, setLChapter] = useState('Module 1: Foundations');
  const [lDesc, setLDesc] = useState('');
  const [lDuration, setLDuration] = useState('10:00');
  const [lVideoUrl, setLVideoUrl] = useState('');
  const [lFreePreview, setLFreePreview] = useState(false);
  const [lPdfTitle, setLPdfTitle] = useState('');
  const [lVideoFile, setLVideoFile] = useState<File | null>(null);
  const [lPdfFile, setLPdfFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);

  // Inline edit lesson state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [eLTitle, setELTitle] = useState('');
  const [eLChapter, setELChapter] = useState('');
  const [eLDesc, setELDesc] = useState('');
  const [eLDuration, setELDuration] = useState('');
  const [eLVideoUrl, setELVideoUrl] = useState('');
  const [eLVideoFile, setELVideoFile] = useState<File | null>(null);
  const [eLPdfTitle, setELPdfTitle] = useState('');
  const [eLPdfFile, setELPdfFile] = useState<File | null>(null);
  const [updatingLesson, setUpdatingLesson] = useState(false);

  // Student & Payment Filters
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [grantCourseByUser, setGrantCourseByUser] = useState<Record<string, string>>({});

  // Support & Notification state
  const [nTargetUser, setNTargetUser] = useState('all');
  const [nTitle, setNTitle] = useState('');
  const [nMessage, setNMessage] = useState('');

  // UPI Settings + Verified QR Preview
  const [upiIdInput, setUpiIdInput] = useState(brandMedia.upiId || DEFAULT_UPI_ID);
  const [upiPayeeInput, setUpiPayeeInput] = useState(
    brandMedia.upiPayeeName || DEFAULT_UPI_PAYEE
  );
  const [savingUpi, setSavingUpi] = useState(false);
  const [generatedQrPreview, setGeneratedQrPreview] = useState<string | null>(null);

  useEffect(() => {
    const activeUpi = upiIdInput.trim() || DEFAULT_UPI_ID;
    const activePayee = upiPayeeInput.trim() || DEFAULT_UPI_PAYEE;
    const uri = `upi://pay?pa=${encodeURIComponent(activeUpi)}&pn=${encodeURIComponent(
      activePayee
    )}&am=499.00&cu=INR&tn=${encodeURIComponent('KP HUBE Complete Course')}`;
    QRCode.toDataURL(uri, {
      width: 280,
      margin: 2,
      color: { dark: '#1E1035', light: '#FFFFFF' },
    })
      .then(setGeneratedQrPreview)
      .catch(() => setGeneratedQrPreview(null));
  }, [upiIdInput, upiPayeeInput]);

  const populateCourseForm = (c: Course) => {
    setEditingCourseId(c.id);
    setCTitle(c.title);
    setCSubtitle(c.subtitle);
    setCDesc(c.description);
    setCCatId(c.categoryId);
    setCThumb(c.thumbnailKey);
    setCPrice(String(c.price));
    setCDiscount(c.discountPrice !== null ? String(c.discountPrice) : '');
    setCDuration(c.durationLabel);
    setCChapters(c.chapters.join(', '));
    setCPublished(c.isPublished);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, st, py, sup] = await Promise.all([
        apiRequest<OverviewData>('/api/admin/overview'),
        apiRequest<{ students: StudentWithPurchases[] }>('/api/admin/students'),
        apiRequest<{ payments: PaymentRecord[] }>('/api/admin/payments'),
        apiRequest<{ supportRequests: SupportRequest[] }>('/api/admin/support'),
      ]);
      setOverview(ov);
      setStudents(st.students);
      setPayments(py.payments);
      setSupportRequests(sup.supportRequests);
      if (ov.courses[0]) {
        if (!lessonCourseId) setLessonCourseId(ov.courses[0].id);
        if (!editingCourseId) populateCourseForm(ov.courses[0]);
      }
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Admin data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const notify = (type: 'ok' | 'err', text: string) => setBanner({ type, text });

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCourse(true);
    try {
      const payload = {
        title: cTitle,
        subtitle: cSubtitle,
        description: cDesc,
        categoryId: cCatId,
        thumbnailKey: cThumb,
        price: Number(cPrice || 499),
        discountPrice: cDiscount.trim() === '' ? null : Number(cDiscount),
        durationLabel: cDuration,
        chapters: cChapters
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isFeatured: true,
        isPopular: true,
        isPublished: cPublished,
      };
      if (editingCourseId) {
        await apiRequest(`/api/admin/courses/${encodeURIComponent(editingCourseId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        notify('ok', 'KP HUBE Complete Course updated successfully.');
      } else {
        await apiRequest('/api/admin/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('ok', 'Course saved.');
      }
      await loadAll();
      onCatalogChanged();
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save course.');
    } finally {
      setSavingCourse(false);
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = lessonCourseId || overview?.courses[0]?.id;
    if (!targetId) return;
    setSavingLesson(true);
    try {
      const videoBase64 = lVideoFile ? await readFileAsDataUrl(lVideoFile) : null;
      const pdfBase64 = lPdfFile ? await readFileAsDataUrl(lPdfFile) : null;
      const videoExt = lVideoFile?.name.toLowerCase().endsWith('.webm') ? '.webm' : '.mp4';

      await apiRequest('/api/admin/lessons', {
        method: 'POST',
        body: JSON.stringify({
          courseId: targetId,
          title: lTitle,
          chapterTitle: lChapter,
          description: lDesc,
          durationLabel: lDuration,
          isFreePreview: lFreePreview,
          videoUrl: lVideoUrl.trim() || null,
          pdfTitle: lPdfTitle.trim() || null,
          videoBase64,
          videoExt,
          pdfBase64,
        }),
      });

      setLTitle('');
      setLDesc('');
      setLVideoUrl('');
      setLPdfTitle('');
      setLVideoFile(null);
      setLPdfFile(null);
      await loadAll();
      onCatalogChanged();
      notify('ok', 'Video lesson added successfully.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not add lesson.');
    } finally {
      setSavingLesson(false);
    }
  };

  const startEditLesson = (l: AdminLesson) => {
    setEditingLessonId(l.id);
    setELTitle(l.title);
    setELChapter(l.chapterTitle);
    setELDesc(l.description);
    setELDuration(l.durationLabel);
    setELVideoUrl(l.videoUrl || '');
    setELPdfTitle(l.pdfTitle || '');
    setELVideoFile(null);
    setELPdfFile(null);
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLessonId) return;
    setUpdatingLesson(true);
    try {
      const videoBase64 = eLVideoFile ? await readFileAsDataUrl(eLVideoFile) : undefined;
      const pdfBase64 = eLPdfFile ? await readFileAsDataUrl(eLPdfFile) : undefined;
      const videoExt = eLVideoFile?.name.toLowerCase().endsWith('.webm') ? '.webm' : '.mp4';

      await apiRequest(`/api/admin/lessons/${encodeURIComponent(editingLessonId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: eLTitle,
          chapterTitle: eLChapter,
          description: eLDesc,
          durationLabel: eLDuration,
          videoUrl: eLVideoUrl.trim(),
          pdfTitle: eLPdfTitle,
          ...(videoBase64 ? { videoBase64, videoExt } : {}),
          ...(pdfBase64 ? { pdfBase64 } : {}),
        }),
      });

      setEditingLessonId(null);
      await loadAll();
      onCatalogChanged();
      notify('ok', 'Video lesson updated.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not update lesson.');
    } finally {
      setUpdatingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await apiRequest(`/api/admin/lessons/${encodeURIComponent(lessonId)}`, { method: 'DELETE' });
      await loadAll();
      onCatalogChanged();
      notify('ok', 'Lesson removed.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not delete lesson.');
    }
  };

  const handleUploadFounderPhoto = async (slot: 'photo1' | 'photo2', file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await apiRequest<{ brandMedia: BrandMedia }>('/api/admin/brand-photos', {
        method: 'POST',
        body: JSON.stringify({ slot, dataUrl }),
      });
      onBrandMediaUpdated(res.brandMedia);
      notify('ok', 'Founder photograph updated across KP HUBE.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not upload founder photo.');
    }
  };

  const handleClearFounderPhoto = async (slot: 'photo1' | 'photo2') => {
    try {
      const res = await apiRequest<{ brandMedia: BrandMedia }>('/api/admin/brand-photos', {
        method: 'POST',
        body: JSON.stringify({ slot, dataUrl: null }),
      });
      onBrandMediaUpdated(res.brandMedia);
      notify('ok', 'Photo cleared.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not clear photo.');
    }
  };

  const handleSaveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUpi(true);
    try {
      const res = await apiRequest<{ brandMedia: BrandMedia }>('/api/admin/upi-settings', {
        method: 'POST',
        body: JSON.stringify({
          upiId: upiIdInput,
          upiPayeeName: upiPayeeInput,
        }),
      });
      onBrandMediaUpdated(res.brandMedia);
      notify('ok', 'UPI payment details updated.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not save UPI settings.');
    } finally {
      setSavingUpi(false);
    }
  };

  const handleUploadUpiQr = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await apiRequest<{ brandMedia: BrandMedia }>('/api/admin/upi-settings', {
        method: 'POST',
        body: JSON.stringify({ upiQrDataUrl: dataUrl }),
      });
      onBrandMediaUpdated(res.brandMedia);
      notify('ok', 'Verified UPI QR image uploaded.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not upload UPI QR image.');
    }
  };

  const handleUseAutoVerifiedQr = async () => {
    try {
      const res = await apiRequest<{ brandMedia: BrandMedia }>('/api/admin/upi-settings', {
        method: 'POST',
        body: JSON.stringify({ upiQrDataUrl: null }),
      });
      onBrandMediaUpdated(res.brandMedia);
      notify('ok', 'Using live verified UPI QR matching your UPI ID.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not reset QR.');
    }
  };

  const handlePaymentAction = async (
    paymentId: string,
    action: 'verify' | 'reject' | 'refund'
  ) => {
    try {
      await apiRequest(`/api/admin/payments/${encodeURIComponent(paymentId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadAll();
      onCatalogChanged();
      notify('ok', `Payment ${action} completed.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : `Payment ${action} failed.`);
    }
  };

  const handleGrantOrRevoke = async (
    userId: string,
    courseId: string,
    action: 'grant' | 'revoke'
  ) => {
    try {
      await apiRequest('/api/admin/access', {
        method: 'POST',
        body: JSON.stringify({ userId, courseId, action }),
      });
      await loadAll();
      onCatalogChanged();
      notify('ok', `Course access ${action === 'grant' ? 'granted' : 'revoked'}.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not update course access.');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ userId: nTargetUser, title: nTitle, message: nMessage }),
      });
      setNTitle('');
      setNMessage('');
      notify('ok', 'Notification sent.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not send notification.');
    }
  };

  const handleResolveSupport = async (
    id: string,
    status: SupportRequest['status'],
    adminNote: string
  ) => {
    try {
      await apiRequest(`/api/admin/support/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote }),
      });
      await loadAll();
      notify('ok', 'Support request updated.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not update support ticket.');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(resolveApiUrl('/api/admin/backup'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Backup download failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kphube-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Backup download failed.');
    }
  };

  const purchasedStudents = students.filter((s) => s.purchases.some((p) => p.status === 'active'));
  const filteredStudents = students.filter((s) => {
    const hasActive = s.purchases.some((p) => p.status === 'active');
    if (studentFilter === 'purchased') return hasActive;
    if (studentFilter === 'unpaid') return !hasActive;
    return true;
  });

  const paidPayments = payments.filter((p) => p.status === 'paid');
  const pendingPayments = payments.filter((p) => p.status === 'pending_verification');
  const failedPayments = payments.filter(
    (p) => p.status === 'failed' || p.status === 'refunded'
  );
  const filteredPayments = payments.filter((p) => {
    if (paymentFilter === 'paid') return p.status === 'paid';
    if (paymentFilter === 'pending_verification') return p.status === 'pending_verification';
    if (paymentFilter === 'failed') return p.status === 'failed' || p.status === 'refunded';
    return true;
  });

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview & Sales', icon: LayoutDashboard },
    { id: 'courses', label: 'Course & Lessons', icon: BookOpen },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'payments', label: 'Payments & UPI QR', icon: CreditCard },
    { id: 'photos', label: 'Founder Photo', icon: Camera },
    { id: 'support', label: 'Notifications & Help', icon: MessageSquare },
  ];

  const maxMonthlyRev = Math.max(
    1,
    ...(overview?.monthlySeries.map((m) => m.revenue) || [1])
  );

  return (
    <div className="min-h-screen bg-[#FAF9FE] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-purple-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandLogo size="sm" />
            <span className="hidden sm:inline font-mono text-xs font-semibold text-[#6D28D9] whitespace-nowrap">
              ADMIN PANEL
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Backup JSON
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Student App
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`min-h-[44px] flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#6D28D9] text-white shadow-sm'
                      : 'border border-purple-100 bg-white text-slate-600 hover:text-[#6D28D9]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="lg:col-span-9 space-y-6">
          {banner && (
            <div
              role="status"
              className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
                banner.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-xs underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading && !overview ? (
            <div className="h-64 animate-pulse rounded-3xl bg-white" />
          ) : (
            <>
              {/* OVERVIEW */}
              {tab === 'overview' && overview && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-medium text-slate-500">Total Revenue</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-[#6D28D9] tabular-nums">
                        {formatINR(overview.totalSales)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-medium text-slate-500">Registered Students</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {overview.studentsCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-medium text-slate-500">Purchased Students</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                        {purchasedStudents.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-[#FFFDF7] p-5 shadow-sm">
                      <p className="text-xs font-medium text-slate-500">Pending Payment Reviews</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-[#D97706] tabular-nums">
                        {overview.pendingVerifications}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-semibold text-slate-900">
                        Monthly Revenue
                      </h2>
                      <span className="font-mono text-xs text-slate-400">INR</span>
                    </div>
                    {overview.monthlySeries.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500">
                        Verified sales will appear here automatically as students purchase the course.
                      </p>
                    ) : (
                      <div className="mt-6 space-y-3">
                        {overview.monthlySeries.map((row) => (
                          <div key={row.month} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-mono text-slate-600">{row.month}</span>
                              <span className="font-mono font-semibold text-[#6D28D9] tabular-nums">
                                {formatINR(row.revenue)}
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-purple-50">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#F59E0B]"
                                style={{
                                  width: `${Math.max(
                                    6,
                                    Math.round((row.revenue / maxMonthlyRev) * 100)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COURSE & VIDEO LESSONS */}
              {tab === 'courses' && overview && (
                <div className="space-y-8">
                  {/* Edit Course Details */}
                  <form
                    onSubmit={handleSaveCourse}
                    className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#6D28D9]">
                          MANAGE COURSE CONTENT
                        </p>
                        <h2 className="font-display text-xl font-semibold text-slate-900">
                          {cTitle || 'KP HUBE Complete Course'}
                        </h2>
                      </div>
                      {overview.courses[0] && (
                        <img
                          src={resolveCourseThumbnail(
                            overview.courses[0].thumbnailKey,
                            brandMedia.photo1DataUrl
                          )}
                          alt={cTitle}
                          className="h-12 w-12 rounded-xl object-cover object-top border border-purple-100"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Course Name
                        </label>
                        <input
                          type="text"
                          required
                          value={cTitle}
                          onChange={(e) => setCTitle(e.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Course Price (INR ₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={cPrice}
                          onChange={(e) => setCPrice(e.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 font-mono text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Short Subtitle
                      </label>
                      <input
                        type="text"
                        value={cSubtitle}
                        onChange={(e) => setCSubtitle(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Course Description
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={cDesc}
                        onChange={(e) => setCDesc(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] p-4 text-sm text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Duration Label
                        </label>
                        <input
                          type="text"
                          value={cDuration}
                          onChange={(e) => setCDuration(e.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Discount Price (Optional ₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={cDiscount}
                          onChange={(e) => setCDiscount(e.target.value)}
                          placeholder="Leave blank for ₹499"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 font-mono text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingCourse}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-6 py-2.5 text-sm font-semibold text-white"
                    >
                      {savingCourse ? 'Saving...' : 'Save Course Changes'}
                    </button>
                  </form>

                  {/* Add New Video Lesson (Upload OR Video Link) */}
                  <form
                    onSubmit={handleAddLesson}
                    className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-4"
                  >
                    <h3 className="font-display text-lg font-semibold text-slate-900">
                      Add New Video Lesson
                    </h3>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Lesson Title
                        </label>
                        <input
                          type="text"
                          required
                          value={lTitle}
                          onChange={(e) => setLTitle(e.target.value)}
                          placeholder="e.g. Lesson 6: Advanced Strategy"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Duration Label
                        </label>
                        <input
                          type="text"
                          value={lDuration}
                          onChange={(e) => setLDuration(e.target.value)}
                          placeholder="12:30"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 font-mono text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Module / Chapter
                        </label>
                        <input
                          type="text"
                          value={lChapter}
                          onChange={(e) => setLChapter(e.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Video Link (YouTube, Vimeo, or MP4 URL — Optional)
                        </label>
                        <div className="relative mt-1.5">
                          <Link2
                            className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"
                            aria-hidden="true"
                          />
                          <input
                            type="url"
                            value={lVideoUrl}
                            onChange={(e) => setLVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/... or https://..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] pl-10 pr-4 text-sm text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Lesson Description
                      </label>
                      <input
                        type="text"
                        value={lDesc}
                        onChange={(e) => setLDesc(e.target.value)}
                        placeholder="What students learn in this video lesson"
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Or Upload Private Video File (.mp4 / .webm)
                        </label>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          onChange={(e) => setLVideoFile(e.target.files?.[0] || null)}
                          className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#6D28D9] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Study Material PDF (Optional)
                        </label>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setLPdfFile(e.target.files?.[0] || null)}
                          className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#D97706] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-center">
                      <input
                        type="text"
                        value={lPdfTitle}
                        onChange={(e) => setLPdfTitle(e.target.value)}
                        placeholder="Study material PDF title (optional)"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                      />
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={lFreePreview}
                          onChange={(e) => setLFreePreview(e.target.checked)}
                        />
                        Allow Free Preview before purchase
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingLesson}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {savingLesson ? 'Saving Lesson...' : 'Add Video Lesson'}
                    </button>
                  </form>

                  {/* Existing Video Lessons List + Edit */}
                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-4">
                    <h3 className="font-display text-lg font-semibold text-slate-900">
                      Course Video Lessons ({overview.lessons.length})
                    </h3>

                    <div className="space-y-3">
                      {overview.lessons.map((l, idx) => {
                        const isEditingThis = editingLessonId === l.id;
                        return (
                          <div
                            key={l.id}
                            className="rounded-2xl border border-purple-100 bg-[#FAF9FE] p-4 space-y-3"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {String(idx + 1).padStart(2, '0')}. {l.title}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {l.chapterTitle} · {l.durationLabel}
                                  {l.videoUrl ? ' · External Video Link' : ' · Private MP4 Stream'}
                                  {l.hasPdf ? ' · PDF Included' : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditingThis ? setEditingLessonId(null) : startEditLesson(l)
                                  }
                                  className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#6D28D9] hover:bg-purple-50"
                                >
                                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                  {isEditingThis ? 'Close' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(l.id)}
                                  className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Remove
                                </button>
                              </div>
                            </div>

                            {isEditingThis && (
                              <form
                                onSubmit={handleUpdateLesson}
                                className="border-t border-purple-100 pt-4 space-y-3"
                              >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <input
                                    type="text"
                                    required
                                    value={eLTitle}
                                    onChange={(e) => setELTitle(e.target.value)}
                                    placeholder="Lesson title"
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900"
                                  />
                                  <input
                                    type="text"
                                    value={eLDuration}
                                    onChange={(e) => setELDuration(e.target.value)}
                                    placeholder="Duration (e.g. 14:20)"
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm text-slate-900"
                                  />
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <input
                                    type="text"
                                    value={eLChapter}
                                    onChange={(e) => setELChapter(e.target.value)}
                                    placeholder="Module / Chapter"
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900"
                                  />
                                  <input
                                    type="url"
                                    value={eLVideoUrl}
                                    onChange={(e) => setELVideoUrl(e.target.value)}
                                    placeholder="Video link (leave empty to keep uploaded MP4)"
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={eLDesc}
                                  onChange={(e) => setELDesc(e.target.value)}
                                  placeholder="Lesson description"
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900"
                                />
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-600">
                                      Replace Video (.mp4/.webm)
                                    </label>
                                    <input
                                      type="file"
                                      accept="video/mp4,video/webm"
                                      onChange={(e) => setELVideoFile(e.target.files?.[0] || null)}
                                      className="mt-1 block w-full text-xs text-slate-600"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-600">
                                      Replace Study PDF
                                    </label>
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      onChange={(e) => setELPdfFile(e.target.files?.[0] || null)}
                                      className="mt-1 block w-full text-xs text-slate-600"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  disabled={updatingLesson}
                                  className="min-h-[40px] rounded-xl bg-[#6D28D9] px-5 py-2 text-xs font-semibold text-white"
                                >
                                  {updatingLesson ? 'Saving...' : 'Save Lesson Changes'}
                                </button>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STUDENTS */}
              {tab === 'students' && overview && (
                <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-slate-900">
                        Students ({filteredStudents.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        {students.length} registered · {purchasedStudents.length} purchased
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'all', label: `All (${students.length})` },
                          { id: 'purchased', label: `Purchased (${purchasedStudents.length})` },
                          {
                            id: 'unpaid',
                            label: `Not Purchased (${students.length - purchasedStudents.length})`,
                          },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setStudentFilter(f.id)}
                          className={`min-h-[36px] rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                            studentFilter === f.id
                              ? 'bg-[#6D28D9] text-white'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-slate-500">No students match this filter.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredStudents.map((st) => {
                        const selectedCourseId =
                          grantCourseByUser[st.id] || overview.courses[0]?.id || '';
                        const activePurchases = st.purchases.filter((p) => p.status === 'active');

                        return (
                          <div key={st.id} className="py-5 space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">{st.name}</p>
                                <p className="text-xs text-slate-500 font-mono">
                                  {st.phone || st.email}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={selectedCourseId}
                                  onChange={(e) =>
                                    setGrantCourseByUser((prev) => ({
                                      ...prev,
                                      [st.id]: e.target.value,
                                    }))
                                  }
                                  className="h-9 rounded-lg border border-slate-200 bg-[#FAF9FE] px-3 text-xs text-slate-900"
                                >
                                  {overview.courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedCourseId &&
                                    handleGrantOrRevoke(st.id, selectedCourseId, 'grant')
                                  }
                                  className="min-h-[36px] rounded-lg bg-[#6D28D9] px-3 text-xs font-semibold text-white"
                                >
                                  Grant Access
                                </button>
                              </div>
                            </div>

                            {activePurchases.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {activePurchases.map((p) => (
                                  <div
                                    key={p.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800"
                                  >
                                    <span>Purchased: {p.courseTitle}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleGrantOrRevoke(st.id, p.courseId, 'revoke')
                                      }
                                      className="font-semibold text-red-600 hover:underline"
                                    >
                                      Revoke
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PAYMENTS & VERIFIED UPI QR */}
              {tab === 'payments' && (
                <div className="space-y-8">
                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-5">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-slate-900">
                        Verified UPI Payment & QR Configuration
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Checkout automatically displays a live scannable UPI QR verified to match
                        your exact UPI ID and Payee Name.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-start">
                      <div className="md:col-span-4 space-y-3">
                        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-[#FAF9FE] p-3 text-center">
                          {(brandMedia.upiQrDataUrl || generatedQrPreview) && (
                            <img
                              src={brandMedia.upiQrDataUrl || generatedQrPreview || ''}
                              alt="Verified KP HUBE UPI QR"
                              referrerPolicy="no-referrer"
                              className="mx-auto w-48 h-48 rounded-xl object-contain bg-white p-2"
                            />
                          )}
                          <p className="mt-2 font-mono text-[11px] font-semibold text-[#6D28D9]">
                            {brandMedia.upiQrDataUrl
                              ? 'Custom Uploaded QR'
                              : `Auto-Verified QR (${upiIdInput || DEFAULT_UPI_ID})`}
                          </p>
                        </div>

                        <label className="min-h-[40px] w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                          Upload Custom Verified QR
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadUpiQr(f);
                            }}
                          />
                        </label>

                        {brandMedia.upiQrDataUrl && (
                          <button
                            type="button"
                            onClick={handleUseAutoVerifiedQr}
                            className="min-h-[36px] w-full rounded-xl border border-purple-200 text-xs font-semibold text-[#6D28D9] hover:bg-purple-50"
                          >
                            Switch to Auto-Verified UPI QR
                          </button>
                        )}
                      </div>

                      <form onSubmit={handleSaveUpiSettings} className="md:col-span-8 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Payee Name
                          </label>
                          <input
                            type="text"
                            value={upiPayeeInput}
                            onChange={(e) => setUpiPayeeInput(e.target.value)}
                            placeholder="KP HUBE"
                            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            UPI ID
                          </label>
                          <input
                            type="text"
                            value={upiIdInput}
                            onChange={(e) => setUpiIdInput(e.target.value)}
                            placeholder="kailash100k@axl"
                            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 font-mono text-sm text-slate-900"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={savingUpi}
                          className="min-h-[44px] rounded-xl bg-[#6D28D9] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-50"
                        >
                          {savingUpi ? 'Saving...' : 'Save UPI Details'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Successful vs Pending vs Failed Payments */}
                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <IndianRupee className="h-5 w-5 text-[#6D28D9]" aria-hidden="true" />
                        <h2 className="font-display text-xl font-semibold text-slate-900">
                          Payments ({filteredPayments.length})
                        </h2>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { id: 'all', label: `All (${payments.length})` },
                            { id: 'paid', label: `Successful (${paidPayments.length})` },
                            {
                              id: 'pending_verification',
                              label: `Pending (${pendingPayments.length})`,
                            },
                            { id: 'failed', label: `Failed / Refunded (${failedPayments.length})` },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setPaymentFilter(f.id)}
                            className={`min-h-[36px] rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                              paymentFilter === f.id
                                ? 'bg-[#6D28D9] text-white'
                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredPayments.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No payment records match this filter.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredPayments.map((pay) => (
                          <div
                            key={pay.id}
                            className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-900">
                                {pay.courseTitle} ·{' '}
                                <span className="font-mono text-[#6D28D9] tabular-nums">
                                  {formatINR(pay.amount)}
                                </span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {pay.userName} ({pay.userEmail}) · {pay.method}
                              </p>
                              <p className="font-mono text-xs text-slate-600">
                                UTR / Ref: {pay.transactionRef} ·{' '}
                                <span
                                  className={
                                    pay.status === 'paid'
                                      ? 'font-semibold text-emerald-600'
                                      : pay.status === 'pending_verification'
                                        ? 'font-semibold text-[#D97706]'
                                        : 'font-semibold text-red-600'
                                  }
                                >
                                  {pay.status}
                                </span>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {pay.status === 'pending_verification' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handlePaymentAction(pay.id, 'verify')}
                                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Verify & Unlock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePaymentAction(pay.id, 'reject')}
                                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    Reject
                                  </button>
                                </>
                              )}
                              {pay.status === 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => handlePaymentAction(pay.id, 'refund')}
                                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  Issue Refund
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FOUNDER PHOTOS */}
              {tab === 'photos' && (
                <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-slate-900">
                      Founder Photograph
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Used on the Home Screen course thumbnail and Course Details screen.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <FounderPhotoFrame
                        slot="photo1"
                        dataUrl={brandMedia.photo1DataUrl}
                        aspectClass="aspect-[4/5]"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="min-h-[44px] inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white">
                          <Upload className="h-4 w-4" aria-hidden="true" />
                          Update Founder Photo
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadFounderPhoto('photo1', f);
                            }}
                          />
                        </label>
                        {brandMedia.photo1DataUrl && (
                          <button
                            type="button"
                            onClick={() => handleClearFounderPhoto('photo1')}
                            className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600"
                          >
                            Reset Default
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS & SUPPORT */}
              {tab === 'support' && (
                <div className="space-y-8">
                  <form
                    onSubmit={handleSendNotification}
                    className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-[#6D28D9]" aria-hidden="true" />
                      <h2 className="font-display text-lg font-semibold text-slate-900">
                        Send Notification to Students
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          Recipient
                        </label>
                        <select
                          value={nTargetUser}
                          onChange={(e) => setNTargetUser(e.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                        >
                          <option value="all">All Students</option>
                          {students.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.phone || s.email})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Title</label>
                        <input
                          type="text"
                          required
                          value={nTitle}
                          onChange={(e) => setNTitle(e.target.value)}
                          placeholder="New video lesson uploaded"
                          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] px-4 text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Message</label>
                      <textarea
                        rows={2}
                        required
                        value={nMessage}
                        onChange={(e) => setNMessage(e.target.value)}
                        placeholder="Announcement message..."
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#FAF9FE] p-3 text-sm text-slate-900"
                      />
                    </div>

                    <button
                      type="submit"
                      className="min-h-[44px] rounded-xl bg-[#6D28D9] px-5 py-2 text-sm font-semibold text-white"
                    >
                      Send Notification
                    </button>
                  </form>

                  <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Student Support Requests ({supportRequests.length})
                    </h2>
                    {supportRequests.length === 0 ? (
                      <p className="text-sm text-slate-500">No support requests submitted yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {supportRequests.map((req) => (
                          <div key={req.id} className="py-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">{req.subject}</p>
                              <span className="font-mono text-xs font-semibold text-[#6D28D9]">
                                {req.status} · {req.channel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              From: {req.name} ({req.contactInfo})
                            </p>
                            <p className="text-sm text-slate-600">{req.message}</p>
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleResolveSupport(req.id, 'in_review', 'Reviewing')
                                }
                                className="min-h-[36px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"
                              >
                                Mark In Review
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleResolveSupport(req.id, 'resolved', 'Resolved by Admin')
                                }
                                className="min-h-[36px] rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white"
                              >
                                Mark Resolved
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
