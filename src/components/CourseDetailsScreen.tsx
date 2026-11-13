import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, FileText, Lock, Play, ShieldCheck } from 'lucide-react';
import { apiRequest, formatINR } from '@/src/lib/api';
import { resolveCourseThumbnail } from '@/src/lib/thumbnails';
import type { BrandMedia, CourseWithLessons } from '@/src/types';

interface CourseDetailsScreenProps {
  courseId: string;
  brandMedia: BrandMedia;
  onBack: () => void;
  onBuyNow: (courseId: string) => void;
  onOpenPlayer: (courseId: string, lessonId?: string) => void;
}

export function CourseDetailsScreen({
  courseId,
  brandMedia,
  onBack,
  onBuyNow,
  onOpenPlayer,
}: CourseDetailsScreenProps) {
  const [data, setData] = useState<CourseWithLessons | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiRequest<CourseWithLessons>(`/api/courses/${encodeURIComponent(courseId)}`)
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load course.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return <div className="mx-auto max-w-4xl h-80 animate-pulse rounded-[28px] bg-white" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="text-sm text-red-700">{error || 'Course not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 min-h-[44px] rounded-xl bg-[#6D28D9] px-5 py-2 text-sm font-medium text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { course, lessons, isPurchased } = data;
  const effectivePrice = course.discountPrice !== null ? course.discountPrice : course.price;
  const studyMaterials = lessons.filter((l) => l.hasPdf);
  const thumbnailUrl = resolveCourseThumbnail(course.thumbnailKey, brandMedia.photo1DataUrl);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Home
      </button>

      {/* Course Overview Card */}
      <div className="overflow-hidden rounded-[28px] border border-purple-100 bg-white shadow-[0_14px_40px_rgba(109,40,217,0.06)]">
        <div className="grid grid-cols-1 md:grid-cols-12 md:items-stretch">
          <div className="bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFFBEB] md:col-span-5">
            <img
              src={thumbnailUrl}
              alt={course.title}
              referrerPolicy="no-referrer"
              className="h-64 w-full object-cover object-top md:h-full md:min-h-[300px]"
            />
          </div>

          <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-7">
            <div>
              <p className="font-mono text-xs font-semibold text-[#6D28D9]">
                KP HUBE • {(course.categoryName || 'YOUTUBE MASTERY').toUpperCase()}
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                {course.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{course.description}</p>
            </div>

            <div className="mt-6 border-t border-purple-50 pt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">One-Time Price</p>
                <p className="mt-0.5 font-mono text-3xl font-bold text-[#6D28D9] tabular-nums">
                  {formatINR(effectivePrice)}
                </p>
              </div>

              {isPurchased ? (
                <button
                  type="button"
                  onClick={() => onOpenPlayer(course.id)}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap"
                >
                  <Play className="h-4 w-4 fill-white" aria-hidden="true" />
                  Watch Course Videos
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onBuyNow(course.id)}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-95 transition-opacity whitespace-nowrap"
                >
                  BUY NOW · {formatINR(effectivePrice)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Topics Covered in This YouTube Course */}
      {course.learningObjectives.length > 0 && (
        <section className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-purple-50 pb-3">
            <p className="font-mono text-xs font-semibold text-[#B45309]">TOPICS COVERED</p>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
              What You Will Learn in This YouTube Course
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

      {/* Video Lessons Included */}
      <section className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-purple-50 pb-4">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Video Lessons Included
          </h2>
          <span className="font-mono text-xs font-semibold text-[#6D28D9] tabular-nums">
            {lessons.length} Lessons
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {lessons.map((lesson, idx) => {
            const unlocked = isPurchased || lesson.isFreePreview;
            return (
              <div
                key={lesson.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 font-mono text-xs font-bold text-[#6D28D9] tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{lesson.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{lesson.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-11 sm:pl-0 shrink-0">
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {lesson.durationLabel}
                  </span>
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => onOpenPlayer(course.id, lesson.id)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#5B21B6]"
                    >
                      <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                      Play
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Locked
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Study Materials (If Available) */}
      {studyMaterials.length > 0 && (
        <section className="rounded-[28px] border border-amber-200/70 bg-[#FFFDF7] p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-[#D97706]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Study Materials Included
            </h2>
          </div>
          <ul className="space-y-2.5">
            {studyMaterials.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 text-sm text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-[#D97706] shrink-0" aria-hidden="true" />
                <span>{item.pdfTitle || `${item.title} Guide`}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 pt-1 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#6D28D9] shrink-0" aria-hidden="true" />
            Downloadable inside the video player immediately after purchase unlock.
          </p>
        </section>
      )}
    </div>
  );
}
