import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AppNotification,
  BrandMedia,
  Category,
  Course,
  CourseProgress,
  Lesson,
  PaymentRecord,
  Purchase,
  SupportRequest,
  User,
} from '../types.ts';
import { ensureMediaDirs, ensureSampleLessonPdf, ensureSampleLessonVideo } from './media.ts';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface StoredLesson extends Lesson {
  videoFileName: string | null;
  videoUrl?: string | null;
  pdfFileName: string | null;
}

export interface AdminRecord {
  userId: string;
  email: string;
  grantedAt: string;
}

export interface OtpChallenge {
  phone: string;
  code: string;
  expiresAt: number;
}

export interface ResetChallenge {
  email: string;
  code: string;
  expiresAt: number;
}

export interface DatabaseState {
  users: StoredUser[];
  admins: AdminRecord[];
  categories: Category[];
  courses: Course[];
  lessons: StoredLesson[];
  purchases: Purchase[];
  payments: PaymentRecord[];
  courseProgress: CourseProgress[];
  notifications: AppNotification[];
  supportRequests: SupportRequest[];
  brandMedia: BrandMedia;
  otpChallenges: OtpChallenge[];
  resetChallenges: ResetChallenge[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kphube-db.json');

export const DEFAULT_FOUNDER_PHOTO1 =
  '/assets/aistudio/WhatsApp_Image_2026-11-11_at_12.28.57_AM_c5373de0.jpeg';
export const DEFAULT_UPI_ID = 'kailash100k@axl';
export const DEFAULT_UPI_PAYEE = 'KP HUBE';

export const PRIMARY_COURSE_ID = 'course-kp-hube-complete';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const keyBuf = Buffer.from(key, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function buildSingleCourseSeed(now: string): {
  categories: Category[];
  courses: Course[];
  lessons: StoredLesson[];
} {
  const categories: Category[] = [
    {
      id: 'cat-complete',
      name: 'Complete Program',
      slug: 'complete-program',
      description: 'Official KP HUBE Complete Video Course',
      order: 1,
    },
  ];

  const courses: Course[] = [
    {
      id: PRIMARY_COURSE_ID,
      title: 'KP HUBE Complete Course',
      subtitle: 'Practical step-by-step video lessons to Learn, Grow & Succeed',
      description:
        'A focused, complete online video course by KP HUBE. Learn core digital skills, clear execution workflows, and practical growth systems through structured HD video lessons and downloadable study materials.',
      categoryId: 'cat-complete',
      categoryName: 'Complete Program',
      thumbnailKey: 'founder:photo1',
      price: 499,
      discountPrice: null,
      durationLabel: '5 Lessons · HD Video',
      lessonsCount: 5,
      chapters: [
        'Module 1: Foundations',
        'Module 2: Practical Execution',
        'Module 3: Growth & Mastery',
      ],
      learningObjectives: [
        'Build practical digital and creative skills step by step',
        'Follow structured checklists and real-world workflows',
        'Download study guides and reference PDFs for every module',
        'Learn anytime with resume-watching and progress tracking',
      ],
      isFeatured: true,
      isPopular: true,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const lessons: StoredLesson[] = [
    {
      id: 'les-kp-1',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 1: Foundations',
      title: '01. Welcome to KP HUBE & Course Roadmap',
      description:
        'How to get the maximum value from the KP HUBE Complete Course and set up your learning routine.',
      order: 1,
      durationSeconds: 12,
      durationLabel: '08:20',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-1.mp4',
      videoUrl: null,
      pdfTitle: 'KP HUBE Course Roadmap PDF',
      hasPdf: true,
      pdfFileName: 'les-kp-1.pdf',
    },
    {
      id: 'les-kp-2',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 1: Foundations',
      title: '02. Core Mindset & Skill Building Framework',
      description:
        'Master the daily framework that turns study time into real measurable skills.',
      order: 2,
      durationSeconds: 12,
      durationLabel: '12:40',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-2.mp4',
      videoUrl: null,
      pdfTitle: 'Skill Framework Worksheet',
      hasPdf: true,
      pdfFileName: 'les-kp-2.pdf',
    },
    {
      id: 'les-kp-3',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 2: Practical Execution',
      title: '03. Step-by-Step Practical Workflow',
      description:
        'Hands-on walkthrough of organizing your work, tools, and output quality cleanly.',
      order: 3,
      durationSeconds: 12,
      durationLabel: '16:15',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-3.mp4',
      videoUrl: null,
      pdfTitle: null,
      hasPdf: false,
      pdfFileName: null,
    },
    {
      id: 'les-kp-4',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 2: Practical Execution',
      title: '04. Real-World Practice & Quality Review',
      description:
        'Avoid common beginner mistakes using a repeatable review checklist.',
      order: 4,
      durationSeconds: 12,
      durationLabel: '14:30',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-4.mp4',
      videoUrl: null,
      pdfTitle: 'Quality Review Checklist PDF',
      hasPdf: true,
      pdfFileName: 'les-kp-4.pdf',
    },
    {
      id: 'les-kp-5',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 3: Growth & Mastery',
      title: '05. Consistent Growth & Next Steps',
      description:
        'How to keep learning, growing, and succeeding long after completing this program.',
      order: 5,
      durationSeconds: 12,
      durationLabel: '11:50',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-5.mp4',
      videoUrl: null,
      pdfTitle: 'Growth Action Plan PDF',
      hasPdf: true,
      pdfFileName: 'les-kp-5.pdf',
    },
  ];

  return { categories, courses, lessons };
}

function buildInitialState(): DatabaseState {
  const now = new Date().toISOString();
  const { categories, courses, lessons } = buildSingleCourseSeed(now);

  const notifications: AppNotification[] = [
    {
      id: 'notif-welcome',
      userId: 'all',
      title: 'Welcome to KP HUBE',
      message: 'Enroll in the KP HUBE Complete Course at ₹499. Learn • Grow • Succeed.',
      type: 'announcement',
      isRead: false,
      createdAt: now,
    },
  ];

  return {
    users: [],
    admins: [],
    categories,
    courses,
    lessons,
    purchases: [],
    payments: [],
    courseProgress: [],
    notifications,
    supportRequests: [],
    brandMedia: {
      photo1DataUrl: DEFAULT_FOUNDER_PHOTO1,
      photo1UpdatedAt: now,
      photo2DataUrl: null,
      photo2UpdatedAt: null,
      upiQrDataUrl: null,
      upiQrUpdatedAt: null,
      upiId: DEFAULT_UPI_ID,
      upiPayeeName: DEFAULT_UPI_PAYEE,
    },
    otpChallenges: [],
    resetChallenges: [],
  };
}

class Store {
  private state: DatabaseState;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    ensureMediaDirs();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.state = JSON.parse(raw) as DatabaseState;
        let changed = false;

        // Migrate brandMedia to verified founder photo + exact kailash100k@axl / KP HUBE UPI details
        if (!this.state.brandMedia) {
          this.state.brandMedia = {
            photo1DataUrl: DEFAULT_FOUNDER_PHOTO1,
            photo1UpdatedAt: new Date().toISOString(),
            photo2DataUrl: null,
            photo2UpdatedAt: null,
            upiQrDataUrl: null,
            upiQrUpdatedAt: null,
            upiId: DEFAULT_UPI_ID,
            upiPayeeName: DEFAULT_UPI_PAYEE,
          };
          changed = true;
        } else {
          if (!this.state.brandMedia.photo1DataUrl) {
            this.state.brandMedia.photo1DataUrl = DEFAULT_FOUNDER_PHOTO1;
            this.state.brandMedia.photo1UpdatedAt = new Date().toISOString();
            changed = true;
          }
          // Never retain the old mismatched 'Lila' QR image
          if (
            this.state.brandMedia.upiQrDataUrl &&
            this.state.brandMedia.upiQrDataUrl.includes('WhatsApp_Image_2026-11-11_at_1.18.25_AM')
          ) {
            this.state.brandMedia.upiQrDataUrl = null;
            this.state.brandMedia.upiQrUpdatedAt = null;
            changed = true;
          }
          if (this.state.brandMedia.upiId !== DEFAULT_UPI_ID && !this.state.brandMedia.upiId) {
            this.state.brandMedia.upiId = DEFAULT_UPI_ID;
            changed = true;
          } else if (!this.state.brandMedia.upiId) {
            this.state.brandMedia.upiId = DEFAULT_UPI_ID;
            changed = true;
          }
          if (
            !this.state.brandMedia.upiPayeeName ||
            this.state.brandMedia.upiPayeeName === 'Lila'
          ) {
            this.state.brandMedia.upiPayeeName = DEFAULT_UPI_PAYEE;
            changed = true;
          }
          if (this.state.brandMedia.upiId !== DEFAULT_UPI_ID) {
            this.state.brandMedia.upiId = DEFAULT_UPI_ID;
            changed = true;
          }
        }

        // Migrate old multi-course sample seed (when unpurchased) to the focused single KP HUBE Complete Course
        const hasPrimaryCourse = this.state.courses.some((c) => c.id === PRIMARY_COURSE_ID);
        if (!hasPrimaryCourse && this.state.purchases.length === 0) {
          const seeded = buildSingleCourseSeed(new Date().toISOString());
          this.state.categories = seeded.categories;
          this.state.courses = seeded.courses;
          this.state.lessons = seeded.lessons;
          changed = true;
        }

        if (changed) this.persistSync();
      } catch {
        this.state = buildInitialState();
        this.persistSync();
      }
    } else {
      this.state = buildInitialState();
      this.persistSync();
    }
  }

  private persistSync() {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  }

  async save(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const tmp = `${DB_FILE}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      await fs.promises.rename(tmp, DB_FILE);
    });
    return this.writeQueue;
  }

  get data(): DatabaseState {
    return this.state;
  }

  async warmupSampleMedia(): Promise<void> {
    const courseMap = new Map(this.state.courses.map((c) => [c.id, c]));
    for (const lesson of this.state.lessons) {
      const course = courseMap.get(lesson.courseId);
      const courseTitle = course ? course.title : 'KP HUBE Complete Course';
      if (lesson.hasVideo && lesson.videoFileName) {
        await ensureSampleLessonVideo(lesson.videoFileName, lesson.title, courseTitle);
      }
      if (lesson.hasPdf && lesson.pdfFileName) {
        ensureSampleLessonPdf(lesson.pdfFileName, lesson.title, courseTitle, [
          `Chapter: ${lesson.chapterTitle}`,
          `Summary: ${lesson.description}`,
          'Key Takeaways:',
          '1. Watch the complete video lesson and apply each step.',
          '2. Practice consistently and mark the lesson complete.',
          '',
          'Contact: Kphubeyoutube63',
        ]);
      }
    }
  }
}

export const store = new Store();
