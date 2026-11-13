import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Lock, Play } from 'lucide-react';
import { apiRequest, formatINR } from '@/src/lib/api';
import type { Course, CourseProgress, Lesson, User } from '@/src/types';

interface MyCourseItem {
  course: Course;
  lessons: Lesson[];
  progress: CourseProgress | null;
}

interface MyCoursesScreenProps {
  user: User;
  primaryCourse: Course | null;
  onOpenPlayer: (courseId: string, lessonId?: string) => void;
  onViewCourse: (courseId: string) => void;
  onBuyNow: (courseId: string) => void;
}

export function MyCoursesScreen({
  user,
  primaryCourse,
  onOpenPlayer,
  onViewCourse,
  onBuyNow,
}: MyCoursesScreenProps) {
  const [items, setItems] = useState<MyCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ items: MyCourseItem[] }>('/api/my-courses')
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your course.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-3xl h-64 animate-pulse rounded-[28px] bg-white" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8 text-center text-sm text-red-700">
        {error}
      </div>
    );
  }

  const activeItem = items[0] || null;
  const price = primaryCourse
    ? primaryCourse.discountPrice !== null
      ? primaryCourse.discountPrice
      : primaryCourse.price
    : 499;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">My Course</h1>
        <p className="mt-1 text-sm text-slate-500">Student: {user.name}</p>
      </div>

      {!activeItem ? (
        <div className="rounded-[28px] border border-purple-100 bg-white p-8 sm:p-10 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-[#6D28D9]">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            {primaryCourse?.title || 'KP HUBE Complete Course'} is Locked
          </h2>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            Complete the one-time {formatINR(price)} payment and verification to unlock all video
            lessons and study materials.
          </p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            {primaryCourse && (
              <>
                <button
                  type="button"
                  onClick={() => onBuyNow(primaryCourse.id)}
                  className="min-h-[46px] rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
                >
                  BUY NOW · {formatINR(price)}
                </button>
                <button
                  type="button"
                  onClick={() => onViewCourse(primaryCourse.id)}
                  className="min-h-[46px] rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  View Course Details
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        (() => {
          const { course, lessons, progress } = activeItem;
          const total = lessons.length;
          const completedIds = new Set(progress?.completedLessonIds || []);
          const completed = completedIds.size;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const resumeLessonId =
            progress?.lastLessonId ||
            lessons.find((l) => !completedIds.has(l.id))?.id ||
            lessons[0]?.id;

          return (
            <article className="rounded-[28px] border border-purple-100 bg-white p-6 sm:p-8 shadow-[0_14px_40px_rgba(109,40,217,0.06)] space-y-6">
              {/* Continue Watching Banner */}
              <button
                type="button"
                onClick={() => onOpenPlayer(course.id, resumeLessonId)}
                className="w-full rounded-2xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] p-5 text-left text-white shadow-[0_12px_28px_rgba(109,40,217,0.22)] hover:opacity-95 transition-opacity"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FEF3C7]">
                      Continue Watching
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold text-white">
                      {course.title}
                    </h2>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25">
                    <Play className="h-5 w-5 fill-white text-white ml-0.5" aria-hidden="true" />
                  </div>
                </div>
              </button>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-purple-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#F59E0B] transition-all"
                    style={{ width: `${Math.max(pct, completed > 0 ? 6 : 0)}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-slate-600 tabular-nums">
                  {completed} of {total} lessons completed
                </p>
              </div>

              {/* All Video Lessons List */}
              <div className="space-y-3">
                <h3 className="font-display text-lg font-bold text-slate-900">Video Lessons</h3>
                <div className="divide-y divide-slate-100">
                  {lessons.map((lesson, idx) => {
                    const isDone = completedIds.has(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between gap-4 py-3.5"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold tabular-nums ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-purple-50 text-[#6D28D9]'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              String(idx + 1).padStart(2, '0')
                            )}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {lesson.title}
                            </p>
                            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{lesson.durationLabel}</span>
                              {isDone && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold text-emerald-600">Completed</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenPlayer(course.id, lesson.id)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] shrink-0"
                        >
                          <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                          Play
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })()
      )}
    </div>
  );
}
