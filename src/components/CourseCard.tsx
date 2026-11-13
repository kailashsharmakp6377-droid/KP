import { CheckCircle2, Play } from 'lucide-react';
import { formatINR } from '@/src/lib/api';
import { resolveCourseThumbnail } from '@/src/lib/thumbnails';
import type { Course } from '@/src/types';

interface CourseCardProps {
  course: Course;
  isPurchased: boolean;
  onViewDetails: (courseId: string) => void;
  onBuyNow: (courseId: string) => void;
  onOpenPlayer: (courseId: string) => void;
}

export function CourseCard({
  course,
  isPurchased,
  onViewDetails,
  onBuyNow,
  onOpenPlayer,
}: CourseCardProps) {
  const effectivePrice = course.discountPrice !== null ? course.discountPrice : course.price;
  const hasDiscount = course.discountPrice !== null && course.discountPrice < course.price;

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_14px_40px_rgba(79,70,229,0.1)]">
      <button
        type="button"
        onClick={() => onViewDetails(course.id)}
        className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
      >
        <img
          src={resolveCourseThumbnail(course.thumbnailKey)}
          alt={course.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
          <span className="font-medium">{course.categoryName}</span>
          {isPurchased && (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Enrolled
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="tabular-nums">{course.durationLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{course.lessonsCount} video lessons</span>
        </div>

        <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-slate-900 line-clamp-2">
          {course.title}
        </h3>

        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 line-clamp-2">
          {course.description}
        </p>

        <div className="mt-auto pt-5 flex items-end justify-between border-t border-slate-100">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              One-Time Enrollment
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                {formatINR(effectivePrice)}
              </span>
              {hasDiscount && (
                <span className="font-mono text-xs text-slate-400 line-through tabular-nums">
                  {formatINR(course.price)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewDetails(course.id)}
              className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Details
            </button>
            {isPurchased ? (
              <button
                type="button"
                onClick={() => onOpenPlayer(course.id)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] px-4 py-2 text-xs font-semibold text-white hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Learn
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onBuyNow(course.id)}
                className="min-h-[40px] rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA] transition-colors whitespace-nowrap shrink-0"
              >
                Buy course
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
