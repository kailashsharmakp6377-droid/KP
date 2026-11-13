import { CheckCircle2, Play } from 'lucide-react';
import { formatINR } from '@/src/lib/api';
import { resolveCourseThumbnail } from '@/src/lib/thumbnails';
import type { BrandMedia, Course, User } from '@/src/types';

interface HomeScreenProps {
  user: User;
  course: Course | null;
  isPurchased: boolean;
  brandMedia: BrandMedia;
  onViewCourse: (courseId: string) => void;
  onOpenMyCourse: () => void;
}

export function HomeScreen({
  user,
  course,
  isPurchased,
  brandMedia,
  onViewCourse,
  onOpenMyCourse,
}: HomeScreenProps) {
  if (!course) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] border border-purple-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">Loading KP HUBE Complete Course...</p>
      </div>
    );
  }

  const effectivePrice = course.discountPrice !== null ? course.discountPrice : course.price;
  const thumbnailUrl = resolveCourseThumbnail(course.thumbnailKey, brandMedia.photo1DataUrl);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      {/* Clean Welcome Header */}
      <section className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#B45309]">
          LEARN • GROW • SUCCEED
        </p>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Welcome, {user.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500">
          Start learning with KP HUBE&apos;s official video course.
        </p>
      </section>

      {/* ONLY ONE COURSE CARD (As Requested) */}
      <article className="overflow-hidden rounded-[28px] border border-purple-100 bg-white shadow-[0_16px_45px_rgba(109,40,217,0.08)]">
        <div className="grid grid-cols-1 md:grid-cols-12 md:items-stretch">
          {/* Course Thumbnail with Provided Founder Photo */}
          <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFFBEB] md:col-span-5">
            <img
              src={thumbnailUrl}
              alt={`${course.title} — KP HUBE Founder`}
              referrerPolicy="no-referrer"
              className="h-72 w-full object-cover object-top md:h-full md:min-h-[340px]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1E1035]/75 via-[#1E1035]/20 to-transparent p-4">
              <p className="text-xs font-semibold text-[#FEF3C7]">KP HUBE Founder</p>
            </div>
          </div>

          {/* Course Summary & Single Action */}
          <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-7">
            <div className="space-y-3">
              <p className="font-mono text-xs font-semibold text-[#6D28D9]">
                KP HUBE OFFICIAL COURSE
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                {course.title}
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">{course.subtitle}</p>
              <p className="text-xs text-slate-500 tabular-nums">
                {course.lessonsCount} Video Lessons · Study Guides Included
              </p>
            </div>

            <div className="mt-8 border-t border-purple-50 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Course Price</p>
                <p className="mt-0.5 font-mono text-3xl font-bold text-[#6D28D9] tabular-nums">
                  {formatINR(effectivePrice)}
                </p>
              </div>

              {isPurchased ? (
                <button
                  type="button"
                  onClick={onOpenMyCourse}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.22)] hover:opacity-95 transition-opacity whitespace-nowrap"
                >
                  <CheckCircle2 className="h-4 w-4 text-[#FDE68A]" aria-hidden="true" />
                  OPEN MY COURSE
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onViewCourse(course.id)}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-95 transition-opacity whitespace-nowrap"
                >
                  <Play className="h-4 w-4 fill-white" aria-hidden="true" />
                  VIEW COURSE
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
