import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  ensureMediaDirs,
  ensureSampleLessonPdf,
  ensureSampleLessonVideo,
  getPrivatePdfPath,
  getPrivateVideoPath,
} from './src/server/media.ts';
import { hashPassword, store, verifyPassword } from './src/server/store.ts';
import type { StoredLesson, StoredUser } from './src/server/store.ts';
import type { Lesson, PaymentMethod, User } from './src/types.ts';

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getAuthSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  const secretPath = path.resolve(process.cwd(), 'data', '.auth-secret');
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, generated, 'utf8');
  return generated;
}

const AUTH_SECRET = getAuthSecret();
const EXPECTED_OWNER_EMAIL = (process.env.OWNER_ADMIN_EMAIL || 'kpattitudeshort@gmail.com').toLowerCase();

function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: number };
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function sanitizeUser(u: StoredUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
  };
}

function sanitizeLesson(l: StoredLesson): Lesson {
  return {
    id: l.id,
    courseId: l.courseId,
    chapterTitle: l.chapterTitle,
    title: l.title,
    description: l.description,
    order: l.order,
    durationSeconds: l.durationSeconds,
    durationLabel: l.durationLabel,
    isFreePreview: l.isFreePreview,
    hasVideo: l.hasVideo,
    pdfTitle: l.pdfTitle,
    hasPdf: l.hasPdf,
  };
}

interface AuthedRequest extends Request {
  currentUser?: StoredUser;
}

function extractUserFromRequest(req: Request): StoredUser | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  const token = authHeader.slice(7).trim();
  const payload = verifyToken<{ uid: string; kind: string }>(token);
  if (!payload || payload.kind !== 'session') return undefined;
  return store.data.users.find((u) => u.id === payload.uid);
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.currentUser = extractUserFromRequest(req);
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const isAdminEntry = store.data.admins.some((a) => a.userId === user.id);
  if (user.role !== 'admin' || !isAdminEntry) {
    res.status(403).json({ error: 'Owner Admin access required.' });
    return;
  }
  next();
}

function userHasCourseAccess(user: StoredUser | undefined, courseId: string): boolean {
  if (!user) return false;
  if (user.role === 'admin' && store.data.admins.some((a) => a.userId === user.id)) {
    return true;
  }
  return store.data.purchases.some(
    (p) => p.userId === user.id && p.courseId === courseId && p.status === 'active'
  );
}

function hasRazorpayKeys(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function startServer() {
  ensureMediaDirs();
  // Warm up sample private lesson MP4s & PDFs in background so server boots fast
  store.warmupSampleMedia().catch((err) => {
    console.error('Sample media warmup warning:', err);
  });

  const app = express();
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Range, Accept'
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '60mb' }));
  app.use(attachUser);

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'KP HUBE', razorpayConfigured: hasRazorpayKeys() });
  });

  // ==========================================
  // AUTHENTICATION & ACCOUNT ENDPOINTS
  // ==========================================

  app.get('/api/auth/owner-status', (_req, res) => {
    res.json({
      ownerConfigured: store.data.admins.length > 0,
      expectedOwnerEmail: EXPECTED_OWNER_EMAIL,
    });
  });

  app.post('/api/auth/owner-setup', async (req, res) => {
    if (store.data.admins.length > 0) {
      res.status(403).json({ error: 'Owner Admin account has already been initialized.' });
      return;
    }
    const name = String(req.body?.name || 'KP HUBE Founder').trim();
    const email = String(req.body?.email || EXPECTED_OWNER_EMAIL).trim().toLowerCase();
    const password = String(req.body?.password || '');
    const phone = String(req.body?.phone || '').trim();

    if (!email || !email.includes('@') || password.length < 6) {
      res.status(400).json({ error: 'Valid email and password (min 6 characters) are required.' });
      return;
    }

    const existing = store.data.users.find((u) => u.email.toLowerCase() === email);
    let adminUser: StoredUser;
    const now = new Date().toISOString();

    if (existing) {
      existing.role = 'admin';
      existing.passwordHash = hashPassword(password);
      if (name) existing.name = name;
      adminUser = existing;
    } else {
      adminUser = {
        id: `usr_${crypto.randomUUID().slice(0, 10)}`,
        name: name || 'KP HUBE Founder',
        email,
        phone,
        role: 'admin',
        avatarUrl: null,
        passwordHash: hashPassword(password),
        createdAt: now,
      };
      store.data.users.push(adminUser);
    }

    store.data.admins.push({ userId: adminUser.id, email: adminUser.email, grantedAt: now });
    await store.save();

    const token = signToken({ uid: adminUser.id, kind: 'session', role: 'admin' }, 60 * 60 * 24 * 7);
    res.json({ token, user: sanitizeUser(adminUser) });
  });

  app.post('/api/auth/register', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');

    if (name.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (min 2 characters).' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }
    if (store.data.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const user: StoredUser = {
      id: `usr_${crypto.randomUUID().slice(0, 10)}`,
      name,
      email,
      phone,
      role: 'student',
      avatarUrl: null,
      passwordHash: hashPassword(password),
      createdAt: now,
    };
    store.data.users.push(user);
    store.data.notifications.unshift({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      title: 'Welcome to KP HUBE',
      message: 'Your student account is ready. Browse courses and begin learning today.',
      type: 'announcement',
      isRead: false,
      createdAt: now,
    });
    await store.save();

    const token = signToken({ uid: user.id, kind: 'session', role: 'student' }, 60 * 60 * 24 * 7);
    res.status(201).json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = store.data.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = signToken({ uid: user.id, kind: 'session', role: user.role }, 60 * 60 * 24 * 7);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/otp/request', async (req, res) => {
    const rawPhone = String(req.body?.phone || '').replace(/\s+/g, '');
    if (rawPhone.length < 10) {
      res.status(400).json({ error: 'Please enter a valid 10+ digit mobile number.' });
      return;
    }
    const code = String(crypto.randomInt(100000, 999999));
    store.data.otpChallenges = store.data.otpChallenges.filter((o) => o.phone !== rawPhone);
    store.data.otpChallenges.push({
      phone: rawPhone,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    await store.save();

    res.json({
      sent: true,
      message: 'OTP generated. Configure an SMS provider in production for live SMS delivery.',
      previewOtp: IS_PROD ? undefined : code,
    });
  });

  app.post('/api/auth/otp/verify', async (req, res) => {
    const rawPhone = String(req.body?.phone || '').replace(/\s+/g, '');
    const code = String(req.body?.code || '').trim();
    const name = String(req.body?.name || '').trim();

    const challenge = store.data.otpChallenges.find(
      (o) => o.phone === rawPhone && o.code === code && o.expiresAt > Date.now()
    );
    if (!challenge) {
      res.status(400).json({ error: 'Invalid or expired OTP code.' });
      return;
    }
    store.data.otpChallenges = store.data.otpChallenges.filter((o) => o.phone !== rawPhone);

    let user = store.data.users.find((u) => u.phone === rawPhone);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: `usr_${crypto.randomUUID().slice(0, 10)}`,
        name: name || `Student ${rawPhone.slice(-4)}`,
        email: `phone.${rawPhone.replace(/[^0-9]/g, '')}@student.kphube.local`,
        phone: rawPhone,
        role: 'student',
        avatarUrl: null,
        passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        createdAt: now,
      };
      store.data.users.push(user);
    }
    await store.save();

    const token = signToken({ uid: user.id, kind: 'session', role: user.role }, 60 * 60 * 24 * 7);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = store.data.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      res.json({
        sent: true,
        message: 'If an account matches this email, a reset verification code has been generated.',
      });
      return;
    }
    const code = String(crypto.randomInt(100000, 999999));
    store.data.resetChallenges = store.data.resetChallenges.filter((r) => r.email !== email);
    store.data.resetChallenges.push({
      email,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    await store.save();
    res.json({
      sent: true,
      message: 'Verification code generated for password reset.',
      previewResetCode: IS_PROD ? undefined : code,
    });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const challenge = store.data.resetChallenges.find(
      (r) => r.email === email && r.code === code && r.expiresAt > Date.now()
    );
    if (!challenge) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }
    const user = store.data.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    user.passwordHash = hashPassword(newPassword);
    store.data.resetChallenges = store.data.resetChallenges.filter((r) => r.email !== email);
    await store.save();
    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.currentUser!) });
  });

  app.patch('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : user.name;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : user.phone;
    const avatarUrl =
      typeof req.body?.avatarUrl === 'string' || req.body?.avatarUrl === null
        ? req.body.avatarUrl
        : user.avatarUrl;
    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    user.name = name;
    user.phone = phone;
    user.avatarUrl = avatarUrl;
    await store.save();
    res.json({ user: sanitizeUser(user) });
  });

  app.delete('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role === 'admin') {
      res.status(400).json({ error: 'Owner Admin account cannot be self-deleted.' });
      return;
    }
    store.data.users = store.data.users.filter((u) => u.id !== user.id);
    store.data.courseProgress = store.data.courseProgress.filter((p) => p.userId !== user.id);
    store.data.notifications = store.data.notifications.filter((n) => n.userId !== user.id);
    await store.save();
    res.json({ ok: true });
  });

  // ==========================================
  // PUBLIC COURSE CATALOG & BRAND MEDIA
  // ==========================================

  app.get('/api/bootstrap', (req: AuthedRequest, res) => {
    const user = req.currentUser;
    const publishedCourses = store.data.courses.filter((c) => c.isPublished);
    const purchasedCourseIds = user
      ? store.data.purchases
          .filter((p) => p.userId === user.id && p.status === 'active')
          .map((p) => p.courseId)
      : [];

    res.json({
      categories: [...store.data.categories].sort((a, b) => a.order - b.order),
      courses: publishedCourses,
      purchasedCourseIds,
      brandMedia: store.data.brandMedia,
      razorpayConfigured: hasRazorpayKeys(),
      ownerConfigured: store.data.admins.length > 0,
    });
  });

  app.get('/api/courses/:courseId', (req: AuthedRequest, res) => {
    const course = store.data.courses.find((c) => c.id === req.params.courseId);
    if (!course || (!course.isPublished && req.currentUser?.role !== 'admin')) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    const lessons = store.data.lessons
      .filter((l) => l.courseId === course.id)
      .sort((a, b) => a.order - b.order)
      .map(sanitizeLesson);
    const isPurchased = userHasCourseAccess(req.currentUser, course.id);
    const progress = req.currentUser
      ? store.data.courseProgress.find(
          (p) => p.userId === req.currentUser!.id && p.courseId === course.id
        ) || null
      : null;

    res.json({ course, lessons, isPurchased, progress });
  });

  // ==========================================
  // STUDENT DASHBOARD, PROGRESS & SUPPORT
  // ==========================================

  app.get('/api/my-courses', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const activeCourseIds = new Set(
      store.data.purchases
        .filter((p) => p.userId === user.id && p.status === 'active')
        .map((p) => p.courseId)
    );
    const courses = store.data.courses.filter((c) => activeCourseIds.has(c.id));
    const items = courses.map((course) => {
      const lessons = store.data.lessons
        .filter((l) => l.courseId === course.id)
        .sort((a, b) => a.order - b.order)
        .map(sanitizeLesson);
      const progress =
        store.data.courseProgress.find(
          (p) => p.userId === user.id && p.courseId === course.id
        ) || null;
      return { course, lessons, progress };
    });
    res.json({ items });
  });

  app.post('/api/progress', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const courseId = String(req.body?.courseId || '');
    const lessonId = String(req.body?.lessonId || '');
    const lastTimestampSeconds = Number(req.body?.lastTimestampSeconds || 0);
    const toggleCompleted = req.body?.completed as boolean | undefined;

    const lesson = store.data.lessons.find((l) => l.id === lessonId && l.courseId === courseId);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    if (!lesson.isFreePreview && !userHasCourseAccess(user, courseId)) {
      res.status(403).json({ error: 'Purchase required to track course progress.' });
      return;
    }

    let progress = store.data.courseProgress.find(
      (p) => p.userId === user.id && p.courseId === courseId
    );
    const now = new Date().toISOString();
    if (!progress) {
      progress = {
        userId: user.id,
        courseId,
        completedLessonIds: [],
        lastLessonId: lessonId,
        lastTimestampSeconds: Math.max(0, lastTimestampSeconds),
        updatedAt: now,
      };
      store.data.courseProgress.push(progress);
    } else {
      progress.lastLessonId = lessonId;
      if (!Number.isNaN(lastTimestampSeconds)) {
        progress.lastTimestampSeconds = Math.max(0, lastTimestampSeconds);
      }
      progress.updatedAt = now;
    }

    if (typeof toggleCompleted === 'boolean') {
      if (toggleCompleted && !progress.completedLessonIds.includes(lessonId)) {
        progress.completedLessonIds.push(lessonId);
      } else if (!toggleCompleted) {
        progress.completedLessonIds = progress.completedLessonIds.filter((id) => id !== lessonId);
      }
    }

    await store.save();
    res.json({ progress });
  });

  app.get('/api/purchases', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const purchases = store.data.purchases
      .filter((p) => p.userId === user.id)
      .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
    const payments = store.data.payments
      .filter((p) => p.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ purchases, payments });
  });

  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const items = store.data.notifications
      .filter((n) => n.userId === 'all' || n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ notifications: items });
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const notif = store.data.notifications.find(
      (n) => n.id === req.params.id && (n.userId === user.id || n.userId === 'all')
    );
    if (notif) {
      notif.isRead = true;
      await store.save();
    }
    res.json({ ok: true });
  });

  app.post('/api/support', async (req: AuthedRequest, res) => {
    const name = String(req.body?.name || req.currentUser?.name || '').trim();
    const contactInfo = String(req.body?.contactInfo || req.currentUser?.email || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    const channel = (req.body?.channel === 'email' || req.body?.channel === 'whatsapp'
      ? req.body.channel
      : 'form') as 'form' | 'email' | 'whatsapp';

    if (name.length < 2 || contactInfo.length < 3 || subject.length < 3 || message.length < 8) {
      res.status(400).json({ error: 'Please complete all support form fields.' });
      return;
    }

    const requestRecord = {
      id: `sup_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.currentUser?.id || null,
      name,
      contactInfo,
      subject,
      message,
      channel,
      status: 'open' as const,
      adminNote: null,
      createdAt: new Date().toISOString(),
    };
    store.data.supportRequests.unshift(requestRecord);
    await store.save();
    res.status(201).json({ request: requestRecord });
  });

  // ==========================================
  // SECURE PAYMENT GATEWAY (RAZORPAY + UTR VERIFICATION)
  // ==========================================

  app.post('/api/payments/create-order', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const courseId = String(req.body?.courseId || '');
    const method = (req.body?.method || 'UPI') as PaymentMethod;

    const course = store.data.courses.find((c) => c.id === courseId && c.isPublished);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (userHasCourseAccess(user, course.id)) {
      res.status(400).json({ error: 'You already have access to this course.' });
      return;
    }

    const amount = course.discountPrice !== null ? course.discountPrice : course.price;
    const now = new Date().toISOString();
    const paymentId = `pay_${crypto.randomUUID().slice(0, 10)}`;

    if (hasRazorpayKeys()) {
      try {
        const auth = Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: paymentId,
            notes: { courseId: course.id, userId: user.id },
          }),
        });
        if (!rzpRes.ok) {
          const errText = await rzpRes.text();
          res.status(502).json({ error: `Razorpay order creation failed: ${errText}` });
          return;
        }
        const rzpOrder = (await rzpRes.json()) as { id: string };
        const record = {
          id: paymentId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          courseId: course.id,
          courseTitle: course.title,
          amount,
          currency: 'INR' as const,
          method,
          gateway: 'razorpay' as const,
          razorpayOrderId: rzpOrder.id,
          razorpayPaymentId: null,
          transactionRef: rzpOrder.id,
          status: 'created' as const,
          failureReason: null,
          refundReason: null,
          createdAt: now,
          updatedAt: now,
        };
        store.data.payments.unshift(record);
        await store.save();

        res.json({
          mode: 'razorpay',
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
          orderId: rzpOrder.id,
          amountPaise: Math.round(amount * 100),
          payment: record,
        });
        return;
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : 'Unable to reach Razorpay API.',
        });
        return;
      }
    }

    // Razorpay credentials not yet configured: create real order for verified UTR submission
    const orderRef = `KPH-${Date.now().toString().slice(-6)}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    const record = {
      id: paymentId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      courseId: course.id,
      courseTitle: course.title,
      amount,
      currency: 'INR' as const,
      method,
      gateway: 'upi_reference' as const,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      transactionRef: orderRef,
      status: 'created' as const,
      failureReason: null,
      refundReason: null,
      createdAt: now,
      updatedAt: now,
    };
    store.data.payments.unshift(record);
    await store.save();

    res.json({
      mode: 'upi_reference',
      razorpayKeyId: null,
      orderId: orderRef,
      amountPaise: Math.round(amount * 100),
      payment: record,
    });
  });

  app.post('/api/payments/verify-razorpay', requireAuth, async (req: AuthedRequest, res) => {
    if (!hasRazorpayKeys()) {
      res.status(400).json({ error: 'Razorpay is not configured on the server.' });
      return;
    }
    const user = req.currentUser!;
    const paymentId = String(req.body?.paymentId || '');
    const razorpayOrderId = String(req.body?.razorpay_order_id || '');
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '');
    const razorpaySignature = String(req.body?.razorpay_signature || '');

    const payment = store.data.payments.find(
      (p) => p.id === paymentId && p.userId === user.id && p.razorpayOrderId === razorpayOrderId
    );
    if (!payment) {
      res.status(404).json({ error: 'Payment order not found.' });
      return;
    }

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const sigBuf = Buffer.from(razorpaySignature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      payment.status = 'failed';
      payment.failureReason = 'Server signature verification failed.';
      payment.updatedAt = new Date().toISOString();
      await store.save();
      res.status(400).json({ error: 'Payment signature verification failed.' });
      return;
    }

    const now = new Date().toISOString();
    payment.status = 'paid';
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.transactionRef = razorpayPaymentId;
    payment.updatedAt = now;

    const alreadyUnlocked = store.data.purchases.some(
      (p) => p.userId === user.id && p.courseId === payment.courseId && p.status === 'active'
    );
    if (!alreadyUnlocked) {
      store.data.purchases.unshift({
        id: `pur_${crypto.randomUUID().slice(0, 10)}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        courseId: payment.courseId,
        courseTitle: payment.courseTitle,
        paymentId: payment.id,
        amountPaid: payment.amount,
        status: 'active',
        grantedBy: 'payment',
        unlockedAt: now,
      });
    }

    store.data.notifications.unshift({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      title: 'Course Unlocked',
      message: `${payment.courseTitle} is now unlocked in My Courses. Transaction: ${razorpayPaymentId}.`,
      type: 'payment',
      isRead: false,
      createdAt: now,
    });
    await store.save();

    res.json({ ok: true, payment });
  });

  app.post('/api/payments/submit-upi-reference', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const paymentId = String(req.body?.paymentId || '');
    const transactionRef = String(req.body?.transactionRef || '').trim();
    const method = (req.body?.method || 'UPI') as PaymentMethod;

    if (transactionRef.length < 6) {
      res.status(400).json({ error: 'Please enter a valid Transaction / UTR reference (min 6 chars).' });
      return;
    }
    const payment = store.data.payments.find((p) => p.id === paymentId && p.userId === user.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment order not found.' });
      return;
    }

    const now = new Date().toISOString();
    payment.method = method;
    payment.transactionRef = transactionRef;
    payment.status = 'pending_verification';
    payment.updatedAt = now;

    store.data.notifications.unshift({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      title: 'Payment Submitted for Verification',
      message: `Reference ${transactionRef} for ${payment.courseTitle} is awaiting Owner verification.`,
      type: 'payment',
      isRead: false,
      createdAt: now,
    });
    await store.save();

    res.json({ ok: true, payment });
  });

  app.get('/api/payments/:paymentId/status', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const payment = store.data.payments.find(
      (p) => p.id === req.params.paymentId && p.userId === user.id
    );
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    const unlocked = userHasCourseAccess(user, payment.courseId);
    res.json({ payment, unlocked });
  });

  app.post('/api/payments/mark-failed', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const paymentId = String(req.body?.paymentId || '');
    const reason = String(req.body?.reason || 'Payment cancelled or declined.');
    const payment = store.data.payments.find((p) => p.id === paymentId && p.userId === user.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    payment.status = 'failed';
    payment.failureReason = reason;
    payment.updatedAt = new Date().toISOString();
    await store.save();
    res.json({ ok: true, payment });
  });

  // ==========================================
  // PROTECTED PRIVATE VIDEO & PDF STREAMING
  // ==========================================

  app.post('/api/videos/:lessonId/authorize', (req: AuthedRequest, res) => {
    const lesson = store.data.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    if (!lesson.isFreePreview && !userHasCourseAccess(req.currentUser, lesson.courseId)) {
      res.status(403).json({
        error: 'Course purchase required. Private lesson video cannot be accessed without verification.',
      });
      return;
    }
    const streamToken = signToken(
      {
        kind: 'stream',
        lessonId: lesson.id,
        uid: req.currentUser?.id || 'preview',
      },
      60 * 60 * 2
    );

    const pdfUrl = lesson.hasPdf
      ? `/api/lessons/${encodeURIComponent(lesson.id)}/pdf?token=${encodeURIComponent(streamToken)}`
      : null;

    if (lesson.videoUrl && lesson.videoUrl.trim().length > 0) {
      const rawUrl = lesson.videoUrl.trim();
      const ytMatch = rawUrl.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/
      );
      const vimeoMatch = rawUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (ytMatch) {
        res.json({
          streamType: 'embed',
          streamUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0`,
          pdfUrl,
        });
        return;
      }
      if (vimeoMatch) {
        res.json({
          streamType: 'embed',
          streamUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
          pdfUrl,
        });
        return;
      }
      res.json({
        streamType: 'video',
        streamUrl: rawUrl,
        pdfUrl,
      });
      return;
    }

    res.json({
      streamType: 'video',
      streamUrl: `/api/videos/${encodeURIComponent(lesson.id)}/stream?token=${encodeURIComponent(streamToken)}`,
      pdfUrl,
    });
  });

  app.get('/api/videos/:lessonId/stream', async (req: AuthedRequest, res) => {
    const lesson = store.data.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson || !lesson.hasVideo || !lesson.videoFileName) {
      res.status(404).json({ error: 'Lesson video not available.' });
      return;
    }

    const tokenParam = typeof req.query.token === 'string' ? req.query.token : '';
    const decoded = tokenParam ? verifyToken<{ kind: string; lessonId: string; uid: string }>(tokenParam) : null;
    const tokenValid = decoded && decoded.kind === 'stream' && decoded.lessonId === lesson.id;

    let authorized = false;
    if (lesson.isFreePreview) {
      authorized = true;
    } else if (tokenValid && decoded?.uid) {
      const tokenUser = store.data.users.find((u) => u.id === decoded.uid);
      authorized = userHasCourseAccess(tokenUser, lesson.courseId);
    } else if (req.currentUser) {
      authorized = userHasCourseAccess(req.currentUser, lesson.courseId);
    }

    if (!authorized) {
      res.status(403).json({ error: 'Unauthorized video access.' });
      return;
    }

    let videoPath = getPrivateVideoPath(lesson.videoFileName);
    if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 4096) {
      const course = store.data.courses.find((c) => c.id === lesson.courseId);
      videoPath = await ensureSampleLessonVideo(
        lesson.videoFileName,
        lesson.title,
        course?.title || 'KP HUBE'
      );
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const ext = path.extname(videoPath).toLowerCase();
    const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';
    const range = req.headers.range;

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const chunksize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  });

  app.get('/api/lessons/:lessonId/pdf', (req: AuthedRequest, res) => {
    const lesson = store.data.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson || !lesson.hasPdf || !lesson.pdfFileName) {
      res.status(404).json({ error: 'PDF resource not available.' });
      return;
    }

    const tokenParam = typeof req.query.token === 'string' ? req.query.token : '';
    const decoded = tokenParam ? verifyToken<{ kind: string; lessonId: string; uid: string }>(tokenParam) : null;
    const tokenValid = decoded && decoded.kind === 'stream' && decoded.lessonId === lesson.id;

    let authorized = false;
    if (lesson.isFreePreview) {
      authorized = true;
    } else if (tokenValid && decoded?.uid) {
      const tokenUser = store.data.users.find((u) => u.id === decoded.uid);
      authorized = userHasCourseAccess(tokenUser, lesson.courseId);
    } else if (req.currentUser) {
      authorized = userHasCourseAccess(req.currentUser, lesson.courseId);
    }

    if (!authorized) {
      res.status(403).json({ error: 'Purchase required to download PDF resources.' });
      return;
    }

    let pdfPath = getPrivatePdfPath(lesson.pdfFileName);
    if (!fs.existsSync(pdfPath)) {
      const course = store.data.courses.find((c) => c.id === lesson.courseId);
      pdfPath = ensureSampleLessonPdf(
        lesson.pdfFileName,
        lesson.title,
        course?.title || 'KP HUBE',
        [lesson.description]
      );
    }

    const safeTitle = (lesson.pdfTitle || lesson.title).replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  });

  // ==========================================
  // OWNER-ONLY ADMIN DASHBOARD API (/api/admin/*)
  // ==========================================

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const paidPayments = store.data.payments.filter((p) => p.status === 'paid');
    const totalSales = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    const now = new Date();
    const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthlySales = paidPayments
      .filter((p) => p.createdAt.startsWith(monthPrefix))
      .reduce((sum, p) => sum + p.amount, 0);

    const monthlyMap = new Map<string, number>();
    for (const p of paidPayments) {
      const key = p.createdAt.slice(0, 7);
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + p.amount);
    }
    const monthlySeries = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    res.json({
      totalSales,
      monthlySales,
      monthlySeries,
      studentsCount: store.data.users.filter((u) => u.role === 'student').length,
      coursesCount: store.data.courses.length,
      publishedCoursesCount: store.data.courses.filter((c) => c.isPublished).length,
      pendingVerifications: store.data.payments.filter((p) => p.status === 'pending_verification').length,
      openSupportCount: store.data.supportRequests.filter((s) => s.status !== 'resolved').length,
      courses: store.data.courses,
      lessons: store.data.lessons.map((l) => ({
        ...sanitizeLesson(l),
        videoUrl: l.videoUrl || null,
      })),
      categories: store.data.categories,
    });
  });

  app.post('/api/admin/brand-photos', requireAdmin, async (req, res) => {
    const slot = req.body?.slot === 'photo2' ? 'photo2' : 'photo1';
    const dataUrl = req.body?.dataUrl as string | null;

    if (dataUrl !== null && (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/'))) {
      res.status(400).json({ error: 'Invalid image data URL.' });
      return;
    }
    const now = new Date().toISOString();
    if (slot === 'photo1') {
      store.data.brandMedia.photo1DataUrl = dataUrl;
      store.data.brandMedia.photo1UpdatedAt = dataUrl ? now : null;
    } else {
      store.data.brandMedia.photo2DataUrl = dataUrl;
      store.data.brandMedia.photo2UpdatedAt = dataUrl ? now : null;
    }
    await store.save();
    res.json({ brandMedia: store.data.brandMedia });
  });

  app.post('/api/admin/upi-settings', requireAdmin, async (req, res) => {
    const upiQrDataUrl = req.body?.upiQrDataUrl as string | null | undefined;
    const upiId = req.body?.upiId as string | null | undefined;
    const upiPayeeName = req.body?.upiPayeeName as string | null | undefined;
    const now = new Date().toISOString();

    if (upiQrDataUrl !== undefined) {
      if (
        upiQrDataUrl !== null &&
        (typeof upiQrDataUrl !== 'string' ||
          (!upiQrDataUrl.startsWith('data:image/') && !upiQrDataUrl.startsWith('/assets/')))
      ) {
        res.status(400).json({ error: 'Invalid UPI QR image format.' });
        return;
      }
      store.data.brandMedia.upiQrDataUrl = upiQrDataUrl || null;
      store.data.brandMedia.upiQrUpdatedAt = upiQrDataUrl ? now : null;
    }

    if (upiId !== undefined) {
      const trimmedId = upiId ? String(upiId).trim() : '';
      store.data.brandMedia.upiId = trimmedId.length > 0 ? trimmedId : 'kailash100k@axl';
    }

    if (upiPayeeName !== undefined) {
      const trimmedPayee = upiPayeeName ? String(upiPayeeName).trim() : '';
      store.data.brandMedia.upiPayeeName = trimmedPayee.length > 0 ? trimmedPayee : 'KP HUBE';
    }

    await store.save();
    res.json({ brandMedia: store.data.brandMedia });
  });

  app.post('/api/admin/courses', requireAdmin, async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const subtitle = String(req.body?.subtitle || '').trim();
    const description = String(req.body?.description || '').trim();
    const categoryId = String(req.body?.categoryId || 'cat-digital');
    const thumbnailKey = String(req.body?.thumbnailKey || 'preset:digital_skills');
    const price = Number(req.body?.price ?? 499);
    const discountPrice =
      req.body?.discountPrice !== null && req.body?.discountPrice !== '' && req.body?.discountPrice !== undefined
        ? Number(req.body.discountPrice)
        : null;
    const durationLabel = String(req.body?.durationLabel || '2h 00m').trim();
    const chapters = Array.isArray(req.body?.chapters)
      ? req.body.chapters.map((c: unknown) => String(c).trim()).filter(Boolean)
      : ['Chapter 1: Foundations'];
    const learningObjectives = Array.isArray(req.body?.learningObjectives)
      ? req.body.learningObjectives.map((o: unknown) => String(o).trim()).filter(Boolean)
      : ['Apply practical course skills step by step'];
    const isFeatured = Boolean(req.body?.isFeatured);
    const isPopular = Boolean(req.body?.isPopular);
    const isPublished = req.body?.isPublished !== false;

    if (title.length < 3 || description.length < 10 || Number.isNaN(price) || price < 0) {
      res.status(400).json({ error: 'Please provide a valid course title, description, and price.' });
      return;
    }
    const cat = store.data.categories.find((c) => c.id === categoryId) || store.data.categories[0];
    const now = new Date().toISOString();
    const course = {
      id: `course_${crypto.randomUUID().slice(0, 8)}`,
      title,
      subtitle: subtitle || description.slice(0, 80),
      description,
      categoryId: cat.id,
      categoryName: cat.name,
      thumbnailKey,
      price,
      discountPrice: discountPrice !== null && !Number.isNaN(discountPrice) ? discountPrice : null,
      durationLabel,
      lessonsCount: 0,
      chapters,
      learningObjectives,
      isFeatured,
      isPopular,
      isPublished,
      createdAt: now,
      updatedAt: now,
    };
    store.data.courses.unshift(course);
    await store.save();
    res.status(201).json({ course });
  });

  app.patch('/api/admin/courses/:id', requireAdmin, async (req, res) => {
    const course = store.data.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (typeof req.body?.title === 'string') course.title = req.body.title.trim();
    if (typeof req.body?.subtitle === 'string') course.subtitle = req.body.subtitle.trim();
    if (typeof req.body?.description === 'string') course.description = req.body.description.trim();
    if (typeof req.body?.thumbnailKey === 'string') course.thumbnailKey = req.body.thumbnailKey;
    if (typeof req.body?.durationLabel === 'string') course.durationLabel = req.body.durationLabel.trim();
    if (typeof req.body?.categoryId === 'string') {
      const cat = store.data.categories.find((c) => c.id === req.body.categoryId);
      if (cat) {
        course.categoryId = cat.id;
        course.categoryName = cat.name;
      }
    }
    if (req.body?.price !== undefined) {
      const p = Number(req.body.price);
      if (!Number.isNaN(p) && p >= 0) course.price = p;
    }
    if (req.body?.discountPrice !== undefined) {
      if (req.body.discountPrice === null || req.body.discountPrice === '') {
        course.discountPrice = null;
      } else {
        const dp = Number(req.body.discountPrice);
        if (!Number.isNaN(dp) && dp >= 0) course.discountPrice = dp;
      }
    }
    if (Array.isArray(req.body?.chapters)) {
      course.chapters = req.body.chapters.map((c: unknown) => String(c).trim()).filter(Boolean);
    }
    if (Array.isArray(req.body?.learningObjectives)) {
      course.learningObjectives = req.body.learningObjectives
        .map((o: unknown) => String(o).trim())
        .filter(Boolean);
    }
    if (typeof req.body?.isFeatured === 'boolean') course.isFeatured = req.body.isFeatured;
    if (typeof req.body?.isPopular === 'boolean') course.isPopular = req.body.isPopular;
    if (typeof req.body?.isPublished === 'boolean') course.isPublished = req.body.isPublished;
    course.updatedAt = new Date().toISOString();
    await store.save();
    res.json({ course });
  });

  app.delete('/api/admin/courses/:id', requireAdmin, async (req, res) => {
    const courseId = req.params.id;
    store.data.courses = store.data.courses.filter((c) => c.id !== courseId);
    store.data.lessons = store.data.lessons.filter((l) => l.courseId !== courseId);
    await store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/lessons', requireAdmin, async (req, res) => {
    const courseId = String(req.body?.courseId || '');
    const course = store.data.courses.find((c) => c.id === courseId);
    if (!course) {
      res.status(404).json({ error: 'Target course not found.' });
      return;
    }
    const title = String(req.body?.title || '').trim();
    const chapterTitle = String(req.body?.chapterTitle || course.chapters[0] || 'Module 1').trim();
    const description = String(req.body?.description || '').trim();
    const durationLabel = String(req.body?.durationLabel || '10:00').trim();
    const isFreePreview = Boolean(req.body?.isFreePreview);
    const pdfTitle = req.body?.pdfTitle ? String(req.body.pdfTitle).trim() : null;
    const videoUrl =
      typeof req.body?.videoUrl === 'string' && req.body.videoUrl.trim().length > 0
        ? req.body.videoUrl.trim()
        : null;
    const videoBase64 = typeof req.body?.videoBase64 === 'string' ? req.body.videoBase64 : null;
    const videoExt = req.body?.videoExt === '.webm' ? '.webm' : '.mp4';
    const pdfBase64 = typeof req.body?.pdfBase64 === 'string' ? req.body.pdfBase64 : null;

    if (title.length < 2) {
      res.status(400).json({ error: 'Lesson title is required.' });
      return;
    }

    const lessonId = `les_${crypto.randomUUID().slice(0, 8)}`;
    const existingCount = store.data.lessons.filter((l) => l.courseId === courseId).length;

    let videoFileName: string | null = null;
    if (!videoUrl) {
      videoFileName = `${lessonId}${videoExt}`;
      if (videoBase64) {
        const cleaned = videoBase64.includes(',') ? videoBase64.split(',')[1] : videoBase64;
        const buf = Buffer.from(cleaned, 'base64');
        fs.writeFileSync(getPrivateVideoPath(videoFileName), buf);
      } else {
        await ensureSampleLessonVideo(videoFileName, title, course.title);
      }
    }

    let pdfFileName: string | null = null;
    if (pdfBase64) {
      pdfFileName = `${lessonId}.pdf`;
      const cleaned = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
      fs.writeFileSync(getPrivatePdfPath(pdfFileName), Buffer.from(cleaned, 'base64'));
    } else if (pdfTitle) {
      pdfFileName = `${lessonId}.pdf`;
      ensureSampleLessonPdf(pdfFileName, title, course.title, [description || title]);
    }

    const lesson: StoredLesson = {
      id: lessonId,
      courseId,
      chapterTitle,
      title,
      description: description || 'Practical video lesson.',
      order: existingCount + 1,
      durationSeconds: 12,
      durationLabel,
      isFreePreview,
      hasVideo: true,
      videoFileName,
      videoUrl,
      pdfTitle: pdfTitle || (pdfBase64 ? `${title} Notes` : null),
      hasPdf: Boolean(pdfFileName),
      pdfFileName,
    };

    store.data.lessons.push(lesson);
    course.lessonsCount = store.data.lessons.filter((l) => l.courseId === courseId).length;
    course.updatedAt = new Date().toISOString();
    await store.save();

    res.status(201).json({ lesson: { ...sanitizeLesson(lesson), videoUrl: lesson.videoUrl || null } });
  });

  app.patch('/api/admin/lessons/:id', requireAdmin, async (req, res) => {
    const lesson = store.data.lessons.find((l) => l.id === req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    if (typeof req.body?.title === 'string' && req.body.title.trim().length >= 2) {
      lesson.title = req.body.title.trim();
    }
    if (typeof req.body?.chapterTitle === 'string' && req.body.chapterTitle.trim()) {
      lesson.chapterTitle = req.body.chapterTitle.trim();
    }
    if (typeof req.body?.description === 'string') {
      lesson.description = req.body.description.trim();
    }
    if (typeof req.body?.durationLabel === 'string' && req.body.durationLabel.trim()) {
      lesson.durationLabel = req.body.durationLabel.trim();
    }
    if (typeof req.body?.isFreePreview === 'boolean') {
      lesson.isFreePreview = req.body.isFreePreview;
    }
    if (req.body?.videoUrl !== undefined) {
      const link = typeof req.body.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
      lesson.videoUrl = link.length > 0 ? link : null;
    }
    if (typeof req.body?.videoBase64 === 'string' && req.body.videoBase64.length > 0) {
      const videoExt = req.body?.videoExt === '.webm' ? '.webm' : '.mp4';
      const videoFileName = `${lesson.id}${videoExt}`;
      const cleaned = req.body.videoBase64.includes(',')
        ? req.body.videoBase64.split(',')[1]
        : req.body.videoBase64;
      fs.writeFileSync(getPrivateVideoPath(videoFileName), Buffer.from(cleaned, 'base64'));
      lesson.videoFileName = videoFileName;
      lesson.videoUrl = null;
    }
    if (typeof req.body?.pdfTitle === 'string') {
      lesson.pdfTitle = req.body.pdfTitle.trim() || null;
    }
    if (typeof req.body?.pdfBase64 === 'string' && req.body.pdfBase64.length > 0) {
      const pdfFileName = `${lesson.id}.pdf`;
      const cleaned = req.body.pdfBase64.includes(',')
        ? req.body.pdfBase64.split(',')[1]
        : req.body.pdfBase64;
      fs.writeFileSync(getPrivatePdfPath(pdfFileName), Buffer.from(cleaned, 'base64'));
      lesson.pdfFileName = pdfFileName;
      lesson.hasPdf = true;
      if (!lesson.pdfTitle) lesson.pdfTitle = `${lesson.title} Study Guide`;
    }

    await store.save();
    res.json({ lesson: { ...sanitizeLesson(lesson), videoUrl: lesson.videoUrl || null } });
  });

  app.delete('/api/admin/lessons/:id', requireAdmin, async (req, res) => {
    const lesson = store.data.lessons.find((l) => l.id === req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    store.data.lessons = store.data.lessons.filter((l) => l.id !== req.params.id);
    const course = store.data.courses.find((c) => c.id === lesson.courseId);
    if (course) {
      course.lessonsCount = store.data.lessons.filter((l) => l.courseId === course.id).length;
    }
    await store.save();
    res.json({ ok: true });
  });

  app.get('/api/admin/students', requireAdmin, (_req, res) => {
    const students = store.data.users
      .filter((u) => u.role === 'student')
      .map((u) => {
        const purchases = store.data.purchases.filter((p) => p.userId === u.id);
        return { ...sanitizeUser(u), purchases };
      });
    res.json({ students });
  });

  app.post('/api/admin/access', requireAdmin, async (req, res) => {
    const userId = String(req.body?.userId || '');
    const courseId = String(req.body?.courseId || '');
    const action = req.body?.action === 'revoke' ? 'revoke' : 'grant';

    const user = store.data.users.find((u) => u.id === userId);
    const course = store.data.courses.find((c) => c.id === courseId);
    if (!user || !course) {
      res.status(404).json({ error: 'Student or course not found.' });
      return;
    }

    const now = new Date().toISOString();
    if (action === 'revoke') {
      for (const p of store.data.purchases) {
        if (p.userId === userId && p.courseId === courseId && p.status === 'active') {
          p.status = 'revoked';
        }
      }
      store.data.notifications.unshift({
        id: `notif_${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        title: 'Course Access Updated',
        message: `Access to ${course.title} has been updated by KP HUBE Admin.`,
        type: 'course',
        isRead: false,
        createdAt: now,
      });
    } else {
      const existing = store.data.purchases.find(
        (p) => p.userId === userId && p.courseId === courseId && p.status === 'active'
      );
      if (!existing) {
        store.data.purchases.unshift({
          id: `pur_${crypto.randomUUID().slice(0, 10)}`,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          courseId: course.id,
          courseTitle: course.title,
          paymentId: 'admin_grant',
          amountPaid: 0,
          status: 'active',
          grantedBy: 'admin',
          unlockedAt: now,
        });
      }
      store.data.notifications.unshift({
        id: `notif_${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        title: 'Course Unlocked by Admin',
        message: `${course.title} has been granted to your account. Start learning in My Courses.`,
        type: 'course',
        isRead: false,
        createdAt: now,
      });
    }
    await store.save();
    res.json({ ok: true });
  });

  app.get('/api/admin/payments', requireAdmin, (_req, res) => {
    const payments = [...store.data.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const purchases = [...store.data.purchases].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
    res.json({ payments, purchases });
  });

  app.post('/api/admin/payments/:id/verify', requireAdmin, async (req, res) => {
    const payment = store.data.payments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }
    const now = new Date().toISOString();
    payment.status = 'paid';
    payment.updatedAt = now;

    const alreadyUnlocked = store.data.purchases.some(
      (p) => p.userId === payment.userId && p.courseId === payment.courseId && p.status === 'active'
    );
    if (!alreadyUnlocked) {
      store.data.purchases.unshift({
        id: `pur_${crypto.randomUUID().slice(0, 10)}`,
        userId: payment.userId,
        userName: payment.userName,
        userEmail: payment.userEmail,
        courseId: payment.courseId,
        courseTitle: payment.courseTitle,
        paymentId: payment.id,
        amountPaid: payment.amount,
        status: 'active',
        grantedBy: 'payment',
        unlockedAt: now,
      });
    }
    store.data.notifications.unshift({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId: payment.userId,
      title: 'Payment Verified & Course Unlocked',
      message: `Your payment (${payment.transactionRef}) for ${payment.courseTitle} is verified.`,
      type: 'payment',
      isRead: false,
      createdAt: now,
    });
    await store.save();
    res.json({ payment });
  });

  app.post('/api/admin/payments/:id/reject', requireAdmin, async (req, res) => {
    const payment = store.data.payments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }
    const reason = String(req.body?.reason || 'Reference could not be verified.');
    const now = new Date().toISOString();
    payment.status = 'failed';
    payment.failureReason = reason;
    payment.updatedAt = now;

    store.data.notifications.unshift({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId: payment.userId,
      title: 'Payment Verification Failed',
      message: `Payment ${payment.transactionRef} could not be verified: ${reason}`,
      type: 'payment',
      isRead: false,
      createdAt: now,
    });
    await store.save();
    res.json({ payment });
  });

  app.post('/api/admin/payments/:id/refund', requireAdmin, async (req, res) => {
    const payment = store.data.payments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }
    const reason = String(req.body?.reason || 'Refund processed by KP HUBE Owner.');
    const now = new Date().toISOString();
    payment.status = 'refunded';
    payment.refundReason = reason;
    payment.updatedAt = now;

    for (const p of store.data.purchases) {
      if (p.paymentId === payment.id || (p.userId === payment.userId && p.courseId === payment.courseId)) {
        p.status = 'refunded';
      }
    }
    store.data.notifications.unshift({
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId: payment.userId,
      title: 'Refund Issued',
      message: `Refund processed for ${payment.courseTitle} (₹${payment.amount}). Access has been closed.`,
      type: 'payment',
      isRead: false,
      createdAt: now,
    });
    await store.save();
    res.json({ payment });
  });

  app.post('/api/admin/notifications', requireAdmin, async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const userId = String(req.body?.userId || 'all');
    if (title.length < 2 || message.length < 4) {
      res.status(400).json({ error: 'Notification title and message are required.' });
      return;
    }
    const notif = {
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      title,
      message,
      type: 'announcement' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    store.data.notifications.unshift(notif);
    await store.save();
    res.status(201).json({ notification: notif });
  });

  app.get('/api/admin/support', requireAdmin, (_req, res) => {
    res.json({ supportRequests: store.data.supportRequests });
  });

  app.patch('/api/admin/support/:id', requireAdmin, async (req, res) => {
    const item = store.data.supportRequests.find((s) => s.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Support request not found.' });
      return;
    }
    if (req.body?.status === 'open' || req.body?.status === 'in_review' || req.body?.status === 'resolved') {
      item.status = req.body.status;
    }
    if (typeof req.body?.adminNote === 'string') {
      item.adminNote = req.body.adminNote.trim();
    }
    await store.save();
    res.json({ supportRequest: item });
  });

  app.get('/api/admin/backup', requireAdmin, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="kphube-backup.json"');
    res.send(JSON.stringify(store.data, null, 2));
  });

  // ==========================================
  // VITE / STATIC CLIENT ENTRYPOINT
  // ==========================================

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KP HUBE server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KP HUBE server:', err);
  process.exit(1);
});
