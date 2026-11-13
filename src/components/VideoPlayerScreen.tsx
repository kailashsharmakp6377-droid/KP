import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Maximize2,
  Pause,
  Play,
} from 'lucide-react';
import { apiRequest, resolveApiUrl } from '@/src/lib/api';
import type { CourseProgress, CourseWithLessons, Lesson } from '@/src/types';

interface VideoPlayerScreenProps {
  courseId: string;
  initialLessonId?: string;
  onBack: () => void;
  onBuyNow: (courseId: string) => void;
}

export function VideoPlayerScreen({
  courseId,
  initialLessonId,
  onBack,
  onBuyNow,
}: VideoPlayerScreenProps) {
  const [courseData, setCourseData] = useState<CourseWithLessons | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [streamType, setStreamType] = useState<'video' | 'embed'>('video');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSavedSecRef = useRef<number>(0);

  useEffect(() => {
    setLoading(true);
    apiRequest<CourseWithLessons>(`/api/courses/${encodeURIComponent(courseId)}`)
      .then((res) => {
        setCourseData(res);
        setProgress(res.progress);
        const target =
          (initialLessonId && res.lessons.find((l) => l.id === initialLessonId)) ||
          (res.progress?.lastLessonId &&
            res.lessons.find((l) => l.id === res.progress?.lastLessonId)) ||
          res.lessons[0] ||
          null;
        setActiveLesson(target);
      })
      .catch((err) => setAuthError(err instanceof Error ? err.message : 'Unable to load course.'))
      .finally(() => setLoading(false));
  }, [courseId, initialLessonId]);

  useEffect(() => {
    if (!activeLesson) return;
    setStreamUrl(null);
    setPdfUrl(null);
    setAuthError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    apiRequest<{ streamType?: 'video' | 'embed'; streamUrl: string; pdfUrl: string | null }>(
      `/api/videos/${encodeURIComponent(activeLesson.id)}/authorize`,
      { method: 'POST' }
    )
      .then((res) => {
        setStreamType(res.streamType === 'embed' ? 'embed' : 'video');
        setStreamUrl(resolveApiUrl(res.streamUrl));
        setPdfUrl(res.pdfUrl ? resolveApiUrl(res.pdfUrl) : null);
      })
      .catch((err) => {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Purchase required to watch this lesson.'
        );
      });
  }, [activeLesson?.id]);

  const saveProgress = async (
    lessonId: string,
    timestampSeconds: number,
    completed?: boolean
  ) => {
    try {
      const res = await apiRequest<{ progress: CourseProgress }>('/api/progress', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          lessonId,
          lastTimestampSeconds: Math.floor(timestampSeconds),
          completed,
        }),
      });
      setProgress(res.progress);
    } catch {
      // ignore if locked
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !activeLesson) return;
    setDuration(videoRef.current.duration || 0);
    if (
      progress?.lastLessonId === activeLesson.id &&
      progress.lastTimestampSeconds > 1 &&
      progress.lastTimestampSeconds < (videoRef.current.duration || 999)
    ) {
      videoRef.current.currentTime = progress.lastTimestampSeconds;
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !activeLesson) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    if (Math.abs(t - lastSavedSecRef.current) >= 4) {
      lastSavedSecRef.current = t;
      saveProgress(activeLesson.id, t);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSec = Number(e.target.value);
    if (!videoRef.current || !activeLesson) return;
    videoRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
    saveProgress(activeLesson.id, targetSec);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading || !courseData) {
    return <div className="mx-auto max-w-5xl h-96 animate-pulse rounded-[28px] bg-white" />;
  }

  const { course, lessons, isPurchased } = courseData;
  const activeIdx = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const prevLesson = activeIdx > 0 ? lessons[activeIdx - 1] : null;
  const nextLesson = activeIdx >= 0 && activeIdx < lessons.length - 1 ? lessons[activeIdx + 1] : null;
  const completedIds = new Set(progress?.completedLessonIds || []);
  const isCurrentCompleted = activeLesson ? completedIds.has(activeLesson.id) : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to My Course
        </button>

        <span className="font-mono text-xs font-semibold text-[#6D28D9] tabular-nums">
          {completedIds.size} of {lessons.length} lessons completed
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-5">
          <div
            ref={containerRef}
            className="overflow-hidden rounded-[28px] border border-purple-100 bg-slate-950 shadow-sm"
          >
            {streamUrl ? (
              streamType === 'embed' ? (
                <div className="relative">
                  <iframe
                    src={streamUrl}
                    title={activeLesson?.title || course.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="aspect-video w-full border-0 bg-black"
                  />
                  <div className="flex items-center justify-between border-t border-purple-100 bg-white px-4 py-3">
                    <span className="text-xs font-medium text-slate-600">
                      Protected Video Lesson
                    </span>
                    <button
                      type="button"
                      onClick={handleFullscreen}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Fullscreen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    src={streamUrl}
                    controls
                    playsInline
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                      setIsPlaying(false);
                      if (activeLesson) saveProgress(activeLesson.id, duration, true);
                    }}
                    className="aspect-video w-full bg-black"
                  />
                  <div className="border-t border-purple-100 bg-white px-4 py-3 space-y-2.5">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(duration, 1)}
                      step={0.5}
                      value={currentTime}
                      onChange={handleSeek}
                      aria-label="Video progress"
                      className="h-1.5 w-full cursor-pointer accent-[#6D28D9]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleTogglePlay}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] transition-colors"
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
                              Play
                            </>
                          )}
                        </button>
                        <span className="font-mono text-xs text-slate-600 tabular-nums">
                          {formatSeconds(currentTime)} / {formatSeconds(duration)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleFullscreen}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Fullscreen
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center bg-[#1E1035] p-8 text-center">
                <Lock className="h-10 w-10 text-[#FDE68A]" aria-hidden="true" />
                <p className="mt-4 font-display text-lg font-semibold text-white">
                  {authError ? 'Course Locked' : 'Loading Protected Video...'}
                </p>
                {authError && (
                  <>
                    <p className="mt-2 max-w-md text-sm text-purple-100">{authError}</p>
                    <button
                      type="button"
                      onClick={() => onBuyNow(course.id)}
                      className="mt-5 min-h-[44px] rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#D97706] px-6 py-2.5 text-sm font-semibold text-white"
                    >
                      BUY NOW · ₹499
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {activeLesson && (
            <div className="rounded-[28px] border border-purple-100 bg-white p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#6D28D9]">
                    {activeLesson.chapterTitle}
                  </p>
                  <h1 className="mt-1 font-display text-xl font-bold text-slate-900">
                    {activeLesson.title}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">{activeLesson.description}</p>
                </div>

                {(isPurchased || activeLesson.isFreePreview) && (
                  <button
                    type="button"
                    onClick={() =>
                      saveProgress(activeLesson.id, currentTime, !isCurrentCompleted)
                    }
                    className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isCurrentCompleted
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                        : 'border border-purple-200 bg-[#FAF9FE] text-[#6D28D9] hover:bg-purple-50'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isCurrentCompleted ? 'Completed' : 'Mark Completed'}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!prevLesson}
                    onClick={() => prevLesson && setActiveLesson(prevLesson)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous Lesson
                  </button>
                  <button
                    type="button"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && setActiveLesson(nextLesson)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Next Lesson
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-semibold text-[#B45309] hover:bg-amber-100 transition-colors"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Study Material: {activeLesson.pdfTitle || 'Download PDF'}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-[28px] border border-purple-100 bg-white p-5 shadow-sm lg:col-span-4">
          <h2 className="font-display text-base font-bold text-slate-900">Video Lessons</h2>
          <p className="mt-1 text-xs text-slate-500">
            Progress is saved automatically so you can resume anytime.
          </p>

          <div className="mt-4 space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {lessons.map((lesson) => {
              const isSelected = activeLesson?.id === lesson.id;
              const unlocked = isPurchased || lesson.isFreePreview;
              const done = completedIds.has(lesson.id);

              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setActiveLesson(lesson)}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#7C3AED] bg-purple-50/70'
                      : 'border-slate-100 bg-[#FAF9FE] hover:border-purple-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">{lesson.chapterTitle}</span>
                    <span className="font-mono tabular-nums shrink-0 ml-2">
                      {lesson.durationLabel}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {lesson.title}
                    </span>
                    {done ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : unlocked ? (
                      <Play className="h-4 w-4 shrink-0 text-[#6D28D9]" aria-hidden="true" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
