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
  channel?: 'phone' | 'email';
  target?: string;
  phone: string;
  email?: string;
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
      name: 'YouTube Mastery',
      slug: 'youtube-mastery',
      description: 'Complete YouTube Growth, Monetization, Title, Thumbnail & Tips Course by KP HUBE',
      order: 1,
    },
  ];

  const courses: Course[] = [
    {
      id: PRIMARY_COURSE_ID,
      title: 'KP HUBE Complete YouTube Course',
      subtitle: 'Channel Growth, Monetization, Viral Titles, Thumbnails & Pro YouTube Tricks',
      description:
        'KP HUBE ka Complete YouTube Mastery Course — isme aap seekhenge apna YouTube channel kaise grow karein, channel monetize kaise karein, high-CTR viral titles aur clickable thumbnails kaise banayein, aur fastest growth ke liye secret YouTube tricks & tips.',
      categoryId: 'cat-complete',
      categoryName: 'YouTube Mastery',
      thumbnailKey: 'founder:photo1',
      price: 499,
      discountPrice: null,
      durationLabel: '5 Modules · HD Video',
      lessonsCount: 5,
      chapters: [
        'Module 1: Channel Growth & Strategy',
        'Module 2: Viral Titles & Thumbnails',
        'Module 3: Monetization & Pro YouTube Tricks',
      ],
      learningObjectives: [
        'Apna YouTube Channel 0 se tezi se kaise Grow karein',
        'Channel Monetize karne ke sabhi steps (1000 Subs, 4000 Hrs & AdSense)',
        'High-CTR Viral Titles likhne aur SEO rank karne ka tarika',
        'Clickable Thumbnails design karna jo views double karein',
        'Secret YouTube Tricks & Tips jo bade creators use karte hain',
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
      chapterTitle: 'Module 1: Channel Growth & Strategy',
      title: '01. Apna YouTube Channel Kaise Grow Karein',
      description:
        'YouTube Algorithm kaise kaam karta hai, sahi niche select karna, aur 0 se tezi se subscribers aur views badhane ki complete strategy.',
      order: 1,
      durationSeconds: 12,
      durationLabel: '14:20',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-1.mp4',
      videoUrl: null,
      pdfTitle: 'YouTube Channel Growth Guide PDF',
      hasPdf: true,
      pdfFileName: 'les-kp-1.pdf',
    },
    {
      id: 'les-kp-2',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 2: Viral Titles & Thumbnails',
      title: '02. Viral Title Kaise Likhein (High-CTR & SEO)',
      description:
        'Aise clickable aur searchable YouTube titles banana jo search me rank karein aur browse feature me logon ko click karne par majboor karein.',
      order: 2,
      durationSeconds: 12,
      durationLabel: '11:45',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-2.mp4',
      videoUrl: null,
      pdfTitle: 'Viral Title Formula & Keywords Sheet',
      hasPdf: true,
      pdfFileName: 'les-kp-2.pdf',
    },
    {
      id: 'les-kp-3',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 2: Viral Titles & Thumbnails',
      title: '03. Clickable YouTube Thumbnail Design Masterclass',
      description:
        'High-CTR thumbnail psychology, color contrast, clean text aur mobile screen par stand-out karne wale thumbnails banana seekhein.',
      order: 3,
      durationSeconds: 12,
      durationLabel: '15:30',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-3.mp4',
      videoUrl: null,
      pdfTitle: 'Clickable Thumbnail Checklist PDF',
      hasPdf: true,
      pdfFileName: 'les-kp-3.pdf',
    },
    {
      id: 'les-kp-4',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 3: Monetization & Pro YouTube Tricks',
      title: '04. Apna YouTube Channel Kaise Monetize Karein',
      description:
        '1000 Subscribers, 4000 Watch Hours / 10M Shorts views criteria, AdSense approval, copyright rules aur YouTube se earning ke sabhi tarike.',
      order: 4,
      durationSeconds: 12,
      durationLabel: '16:10',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-4.mp4',
      videoUrl: null,
      pdfTitle: 'YouTube Monetization Roadmap PDF',
      hasPdf: true,
      pdfFileName: 'les-kp-4.pdf',
    },
    {
      id: 'les-kp-5',
      courseId: PRIMARY_COURSE_ID,
      chapterTitle: 'Module 3: Monetization & Pro YouTube Tricks',
      title: '05. Pro YouTube Tricks & Tips (Fast Growth Secrets)',
      description:
        'Upload timing, YouTube Studio analytics, Shorts-to-Long audience funnel aur video viral karne ki practical YouTube tricks & tips.',
      order: 5,
      durationSeconds: 12,
      durationLabel: '13:50',
      isFreePreview: false,
      hasVideo: true,
      videoFileName: 'les-kp-5.mp4',
      videoUrl: null,
      pdfTitle: 'YouTube Tricks & Tips Action Plan PDF',
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

        // Migrate old generic course seed to the focused KP HUBE Complete YouTube Course
        const existingPrimary = this.state.courses.find((c) => c.id === PRIMARY_COURSE_ID);
        const firstLesson = this.state.lessons.find((l) => l.id === 'les-kp-1');
        if (
          (!existingPrimary && this.state.purchases.length === 0) ||
          (existingPrimary &&
            existingPrimary.subtitle ===
              'Practical step-by-step video lessons to Learn, Grow & Succeed') ||
          (firstLesson && firstLesson.title === '01. Welcome to KP HUBE & Course Roadmap')
        ) {
          const seeded = buildSingleCourseSeed(new Date().toISOString());
          this.state.categories = seeded.categories;
          this.state.courses = seeded.courses;
          this.state.lessons = seeded.lessons;
          for (const id of ['les-kp-1', 'les-kp-2', 'les-kp-3', 'les-kp-4', 'les-kp-5']) {
            try {
              fs.rmSync(path.join(DATA_DIR, 'private-media', 'pdfs', `${id}.pdf`), { force: true });
              fs.rmSync(path.join(DATA_DIR, 'private-media', 'videos', `${id}.mp4`), {
                force: true,
              });
            } catch {
              // ignore cleanup errors
            }
          }
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
