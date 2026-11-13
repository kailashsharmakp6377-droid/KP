export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  categoryId: string;
  categoryName: string;
  thumbnailKey: string;
  price: number;
  discountPrice: number | null;
  durationLabel: string;
  lessonsCount: number;
  chapters: string[];
  learningObjectives: string[];
  isFeatured: boolean;
  isPopular: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  chapterTitle: string;
  title: string;
  description: string;
  order: number;
  durationSeconds: number;
  durationLabel: string;
  isFreePreview: boolean;
  hasVideo: boolean;
  pdfTitle: string | null;
  hasPdf: boolean;
}

export interface AdminLesson extends Lesson {
  videoUrl?: string | null;
}

export interface Purchase {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  paymentId: string;
  amountPaid: number;
  status: 'active' | 'revoked' | 'refunded';
  grantedBy: 'payment' | 'admin';
  unlockedAt: string;
}

export type PaymentMethod = 'UPI' | 'Debit Card' | 'Credit Card' | 'Net Banking';
export type PaymentStatus = 'created' | 'pending_verification' | 'paid' | 'failed' | 'refunded';

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: 'INR';
  method: PaymentMethod;
  gateway: 'razorpay' | 'upi_reference' | 'admin_manual';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  transactionRef: string;
  status: PaymentStatus;
  failureReason: string | null;
  refundReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseProgress {
  userId: string;
  courseId: string;
  completedLessonIds: string[];
  lastLessonId: string | null;
  lastTimestampSeconds: number;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string | 'all';
  title: string;
  message: string;
  type: 'course' | 'payment' | 'announcement' | 'support';
  isRead: boolean;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  userId: string | null;
  name: string;
  contactInfo: string;
  subject: string;
  message: string;
  channel: 'form' | 'email' | 'whatsapp';
  status: 'open' | 'in_review' | 'resolved';
  adminNote: string | null;
  createdAt: string;
}

export interface BrandMedia {
  photo1DataUrl: string | null;
  photo1UpdatedAt: string | null;
  photo2DataUrl: string | null;
  photo2UpdatedAt: string | null;
  upiQrDataUrl: string | null;
  upiQrUpdatedAt: string | null;
  upiId: string | null;
  upiPayeeName: string | null;
}

export interface CourseWithLessons {
  course: Course;
  lessons: Lesson[];
  isPurchased: boolean;
  progress: CourseProgress | null;
}
