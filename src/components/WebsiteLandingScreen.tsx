import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Play,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { apiRequest, formatINR } from '@/src/lib/api';
import { resolveCourseThumbnail } from '@/src/lib/thumbnails';
import type { BrandMedia, Course, Lesson } from '@/src/types';

interface WebsiteLandingScreenProps {
  course: Course | null;
  brandMedia: BrandMedia;
  onViewCourse: (courseId: string) => void;
  onBuyNow: (courseId: string) => void;
  onSignIn: () => void;
  onSupport: () => void;
}

export function WebsiteLandingScreen({
  course,
  brandMedia,
  onViewCourse,
  onBuyNow,
  onSignIn,
  onSupport,
}: WebsiteLandingScreenProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    if (!course) return;
    apiRequest<{ lessons: Lesson[] }>(`/api/courses/${encodeURIComponent(course.id)}`)
      .then((res) => setLessons(res.lessons))
      .catch(() => setLessons([]));
  }, [course?.id]);

  if (!course) {
    return (
      <div className="mx-auto max-w-4xl py-16 text-center text-sm text-slate-500">
        Loading KP HUBE Complete Course...
      </div>
    );
  }

  const effectivePrice = course.discountPrice !== null ? course.discountPrice : course.price;
  const thumbnailUrl = resolveCourseThumbnail(course.thumbnailKey, brandMedia.photo1DataUrl);
  const studyMaterialsCount = lessons.filter((l) => l.hasPdf).length;

  return (
    <div className="mx-auto max-w-5xl space-y-14 pb-16">
      {/* Website Hero Section */}
      <section className="overflow-hidden rounded-[32px] border border-purple-100 bg-white shadow-[0_20px_60px_rgba(109,40,217,0.08)]">
        <div className="grid grid-cols-1 md:grid-cols-12 md:items-stretch">
          <div className="flex flex-col justify-between p-6 sm:p-10 md:col-span-7">
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#B45309]">
                LEARN • GROW • SUCCEED
              </p>
              <h1 className="font-display text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                {course.title}
              </h1>
              <p className="text-base leading-relaxed text-slate-600">{course.description}</p>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-slate-500 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-[#6D28D9]" aria-hidden="true" />
                  {course.lessonsCount} HD Video Lessons
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#6D28D9]" aria-hidden="true" />
                  {course.durationLabel}
                </span>
                {studyMaterialsCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
                    {studyMaterialsCount} Study Guides
                  </span>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-purple-50 pt-6 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">One-Time Enrollment</p>
                  <p className="mt-0.5 font-mono text-4xl font-bold text-[#6D28D9] tabular-nums">
                    {formatINR(effectivePrice)}
                  </p>
                </div>
                <p className="text-xs font-semibold text-[#B45309]">
                  Web + Android App Access Included
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onBuyNow(course.id)}
                  className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-95 transition-opacity whitespace-nowrap"
                >
                  BUY NOW · {formatINR(effectivePrice)}
                </button>
                <button
                  type="button"
                  onClick={() => onViewCourse(course.id)}
                  className="min-h-[48px] inline-flex items-center justify-center rounded-xl border border-purple-200 bg-[#FAF9FE] px-6 py-3 text-sm font-semibold text-[#6D28D9] hover:bg-purple-50 transition-colors whitespace-nowrap"
                >
                  VIEW COURSE
                </button>
              </div>
            </div>
          </div>

          {/* Founder Portrait */}
          <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFFBEB] md:col-span-5">
            <img
              src={thumbnailUrl}
              alt="KP HUBE Founder"
              referrerPolicy="no-referrer"
              className="h-80 w-full object-cover object-top md:h-full md:min-h-[420px]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1E1035]/80 via-[#1E1035]/20 to-transparent p-5">
              <p className="font-display text-sm font-bold text-white">KP HUBE Official Course</p>
              <p className="text-xs text-[#FEF3C7]">Learn directly with KP HUBE Founder</p>
            </div>
          </div>
        </div>
      </section>

      {/* YouTube Course Topics Covered */}
      {course.learningObjectives.length > 0 && (
        <section className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-purple-50 pb-3">
            <p className="font-mono text-xs font-semibold text-[#B45309]">COURSE TOPICS</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              What&apos;s Inside This YouTube Course
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {course.learningObjectives.map((topic) => (
              <li key={topic} className="flex items-start gap-2.5 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#6D28D9] shrink-0" aria-hidden="true" />
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Curriculum Section */}
      <section id="curriculum" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold text-[#6D28D9]">COURSE CURRICULUM</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              Video Lessons Included
            </h2>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
            {lessons.length} Lessons · Unlocked after {formatINR(effectivePrice)} verification
          </span>
        </div>

        <div className="divide-y divide-slate-100 rounded-[28px] border border-purple-100 bg-white shadow-sm">
          {lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 font-mono text-xs font-bold text-[#6D28D9] tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-semibold text-sm text-slate-900">{lesson.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{lesson.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-12 sm:pl-0 shrink-0">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 tabular-nums">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {lesson.durationLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Locked
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Simple 3-Step Enrollment */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-[24px] border border-purple-100 bg-white p-6 shadow-sm space-y-2">
          <Smartphone className="h-6 w-6 text-[#6D28D9]" aria-hidden="true" />
          <h3 className="font-display text-base font-bold text-slate-900">
            1. Mobile OTP Sign In
          </h3>
          <p className="text-sm text-slate-600">
            Register quickly using your Indian mobile number and 6-digit OTP verification.
          </p>
        </div>

        <div className="rounded-[24px] border border-amber-200/80 bg-[#FFFDF7] p-6 shadow-sm space-y-2">
          <ShieldCheck className="h-6 w-6 text-[#D97706]" aria-hidden="true" />
          <h3 className="font-display text-base font-bold text-slate-900">
            2. Verified UPI Payment
          </h3>
          <p className="text-sm text-slate-600">
            Pay {formatINR(effectivePrice)} via PhonePe, Google Pay, or UPI ({brandMedia.upiId || 'kailash100k@axl'}) with verified confirmation.
          </p>
        </div>

        <div className="rounded-[24px] border border-purple-100 bg-white p-6 shadow-sm space-y-2">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <h3 className="font-display text-base font-bold text-slate-900">
            3. Watch Anytime
          </h3>
          <p className="text-sm text-slate-600">
            Unlock all HD video lessons and downloadable PDFs on both this website and the KP HUBE Android app.
          </p>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="rounded-[28px] bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] p-7 sm:p-10 text-white shadow-[0_18px_45px_rgba(109,40,217,0.2)] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#FEF3C7]">KP HUBE</p>
          <h2 className="font-display text-2xl font-bold">
            Ready to start learning?
          </h2>
          <p className="text-sm text-purple-100">
            Already enrolled? Sign in with your registered mobile number to resume watching.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onBuyNow(course.id)}
            className="min-h-[46px] rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-[#6D28D9] hover:bg-purple-50 transition-colors"
          >
            Enroll for {formatINR(effectivePrice)}
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-[46px] rounded-xl border border-white/40 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Student Login
          </button>
          <button
            type="button"
            onClick={onSupport}
            className="min-h-[46px] rounded-xl border border-white/30 px-5 py-2.5 text-sm font-medium text-white/95 hover:bg-white/10 transition-colors"
          >
            Help & Support
          </button>
        </div>
      </section>
    </div>
  );
}
