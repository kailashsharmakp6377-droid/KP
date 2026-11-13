import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BookOpen, Home, ShieldCheck, User as UserIcon } from 'lucide-react';
import { AdminDashboard } from '@/src/components/AdminDashboard';
import { AuthScreen } from '@/src/components/AuthScreen';
import {
  BrandLogo,
  DEFAULT_FOUNDER_PHOTO1_URL,
  DEFAULT_UPI_ID,
  DEFAULT_UPI_PAYEE,
} from '@/src/components/BrandLogo';
import { CourseDetailsScreen } from '@/src/components/CourseDetailsScreen';
import { HomeScreen } from '@/src/components/HomeScreen';
import { SupportScreen } from '@/src/components/InfoScreens';
import { MyCoursesScreen } from '@/src/components/MyCoursesScreen';
import { PaymentScreen } from '@/src/components/PaymentScreen';
import { ProfileScreen } from '@/src/components/ProfileScreen';
import { PurchaseHistoryScreen } from '@/src/components/PurchaseHistoryScreen';
import { SplashScreen } from '@/src/components/SplashScreen';
import { VideoPlayerScreen } from '@/src/components/VideoPlayerScreen';
import { WebsiteLandingScreen } from '@/src/components/WebsiteLandingScreen';
import { apiRequest, getAuthToken, setAuthToken } from '@/src/lib/api';
import { initCapacitorAndroid, registerAndroidBackHandler } from '@/src/lib/capacitor';
import type { BrandMedia, Course, User } from '@/src/types';

type RouteView =
  | { name: 'home' }
  | { name: 'my-course' }
  | { name: 'profile' }
  | { name: 'auth'; mode?: 'otp' | 'owner' }
  | { name: 'course-details'; courseId: string }
  | { name: 'payment'; courseId: string }
  | { name: 'player'; courseId: string; lessonId?: string }
  | { name: 'purchase-history' }
  | { name: 'support' }
  | { name: 'admin' };

function isPrivateAdminUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    pathname === '/admin' ||
    pathname === '/owner-admin' ||
    hash === '#/admin' ||
    hash === '#/owner-admin' ||
    params.get('admin') === '1'
  );
}

function clearPrivateAdminUrl() {
  if (typeof window === 'undefined') return;
  if (isPrivateAdminUrl()) {
    window.history.replaceState({}, '', '/');
  }
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [view, setView] = useState<RouteView>(() =>
    isPrivateAdminUrl() ? { name: 'admin' } : { name: 'home' }
  );
  const [pendingRoute, setPendingRoute] = useState<RouteView | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<string[]>([]);
  const [brandMedia, setBrandMedia] = useState<BrandMedia>({
    photo1DataUrl: DEFAULT_FOUNDER_PHOTO1_URL,
    photo1UpdatedAt: null,
    photo2DataUrl: null,
    photo2UpdatedAt: null,
    upiQrDataUrl: null,
    upiQrUpdatedAt: null,
    upiId: DEFAULT_UPI_ID,
    upiPayeeName: DEFAULT_UPI_PAYEE,
  });
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [ownerConfigured, setOwnerConfigured] = useState(false);

  const isNativeAndroid = Capacitor.isNativePlatform();

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest<{
        courses: Course[];
        purchasedCourseIds: string[];
        brandMedia: BrandMedia;
        razorpayConfigured: boolean;
        ownerConfigured: boolean;
      }>('/api/bootstrap');
      setCourses(data.courses);
      setPurchasedCourseIds(data.purchasedCourseIds);
      setBrandMedia(data.brandMedia);
      setRazorpayConfigured(data.razorpayConfigured);
      setOwnerConfigured(data.ownerConfigured);
    } catch (err) {
      console.error('Bootstrap error:', err);
    }
  }, []);

  const loadUserSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await apiRequest<{ user: User }>('/api/auth/me');
      setUser(me.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    initCapacitorAndroid();
    Promise.all([loadUserSession(), loadBootstrap()]).finally(() => {
      setSessionReady(true);
    });
  }, [loadUserSession, loadBootstrap]);

  useEffect(() => {
    const syncPrivateAdminRoute = () => {
      if (isPrivateAdminUrl()) {
        setView({ name: 'admin' });
      }
    };
    window.addEventListener('hashchange', syncPrivateAdminRoute);
    window.addEventListener('popstate', syncPrivateAdminRoute);
    return () => {
      window.removeEventListener('hashchange', syncPrivateAdminRoute);
      window.removeEventListener('popstate', syncPrivateAdminRoute);
    };
  }, []);

  useEffect(() => {
    return registerAndroidBackHandler(() => {
      if (view.name === 'player') {
        setView({ name: 'my-course' });
        return true;
      }
      if (view.name === 'payment') {
        setView({ name: 'course-details', courseId: view.courseId });
        return true;
      }
      if (view.name === 'course-details') {
        setView({ name: 'home' });
        return true;
      }
      if (view.name === 'purchase-history' || view.name === 'support') {
        setView(user ? { name: 'profile' } : { name: 'home' });
        return true;
      }
      if (view.name === 'my-course' || view.name === 'profile' || view.name === 'admin') {
        setView({ name: 'home' });
        return true;
      }
      return false;
    });
  }, [view, user]);

  const navigateTo = (target: RouteView) => {
    if (target.name !== 'admin') {
      clearPrivateAdminUrl();
    }
    setView(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateProtected = (target: RouteView) => {
    if (!user) {
      setPendingRoute(target);
      navigateTo({ name: 'auth', mode: 'otp' });
      return;
    }
    navigateTo(target);
  };

  const handleAuthSuccess = async (authedUser: User) => {
    setUser(authedUser);
    await loadBootstrap();
    if (authedUser.role === 'admin') {
      setPendingRoute(null);
      setView({ name: 'admin' });
      return;
    }
    if (pendingRoute) {
      const next = pendingRoute;
      setPendingRoute(null);
      setView(next);
    } else {
      setView({ name: 'home' });
    }
  };

  const handleLogout = () => {
    clearPrivateAdminUrl();
    setAuthToken(null);
    setUser(null);
    setPurchasedCourseIds([]);
    setPendingRoute(null);
    setView(isNativeAndroid ? { name: 'auth', mode: 'otp' } : { name: 'home' });
  };

  if (showSplash || !sessionReady) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Admin Panel Route
  if (view.name === 'admin') {
    if (!user || user.role !== 'admin') {
      return (
        <AuthScreen
          initialMode="owner"
          ownerConfigured={ownerConfigured}
          brandMedia={brandMedia}
          onAuthSuccess={handleAuthSuccess}
          onCancel={() => navigateTo({ name: 'home' })}
        />
      );
    }

    return (
      <AdminDashboard
        brandMedia={brandMedia}
        onBrandMediaUpdated={setBrandMedia}
        onCatalogChanged={loadBootstrap}
        onExitAdmin={() => navigateTo({ name: 'home' })}
      />
    );
  }

  // Dedicated Auth Screen (Direct inside native Android APK when logged out, or on web when Auth is chosen)
  if (view.name === 'auth' || (isNativeAndroid && !user && view.name !== 'support')) {
    return (
      <AuthScreen
        initialMode={view.name === 'auth' && view.mode === 'owner' ? 'owner' : 'otp'}
        ownerConfigured={ownerConfigured}
        brandMedia={brandMedia}
        onAuthSuccess={handleAuthSuccess}
        onCancel={
          !isNativeAndroid ? () => navigateTo({ name: 'home' }) : undefined
        }
      />
    );
  }

  const primaryCourse = courses[0] || null;
  const isPrimaryPurchased = primaryCourse
    ? purchasedCourseIds.includes(primaryCourse.id)
    : false;
  const paymentCourse =
    view.name === 'payment'
      ? courses.find((c) => c.id === view.courseId) || primaryCourse
      : null;

  const activeTab =
    view.name === 'home'
      ? 'home'
      : view.name === 'my-course'
        ? 'my-course'
        : view.name === 'profile'
          ? 'profile'
          : null;

  return (
    <div className="min-h-screen bg-[#FAF9FE] text-slate-900 flex flex-col">
      {/* Clean White + Purple + Light Gold Website & App Header */}
      <header className="sticky top-0 z-30 border-b border-purple-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigateTo({ name: 'home' })}
            className="text-left shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] rounded-lg"
          >
            <BrandLogo size="sm" />
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => navigateTo({ name: 'home' })}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                view.name === 'home'
                  ? 'text-[#6D28D9] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() =>
                primaryCourse
                  ? navigateTo({ name: 'course-details', courseId: primaryCourse.id })
                  : navigateTo({ name: 'home' })
              }
              className={`whitespace-nowrap shrink-0 transition-colors ${
                view.name === 'course-details'
                  ? 'text-[#6D28D9] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Course
            </button>
            <button
              type="button"
              onClick={() => navigateProtected({ name: 'my-course' })}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                view.name === 'my-course'
                  ? 'text-[#6D28D9] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Course
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ name: 'support' })}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                view.name === 'support'
                  ? 'text-[#6D28D9] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Support
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              user.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => navigateTo({ name: 'admin' })}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Admin Panel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo({ name: 'profile' })}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-purple-100 bg-[#FAF9FE] px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-[#7C3AED] transition-colors whitespace-nowrap shrink-0"
                >
                  <UserIcon className="h-3.5 w-3.5 text-[#6D28D9]" aria-hidden="true" />
                  {user.name.split(' ')[0]}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => navigateTo({ name: 'auth', mode: 'otp' })}
                className="min-h-[40px] rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#D97706] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              >
                Student Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-12">
        {view.name === 'home' &&
          (user ? (
            <HomeScreen
              user={user}
              course={primaryCourse}
              isPurchased={isPrimaryPurchased}
              brandMedia={brandMedia}
              onViewCourse={(courseId) => navigateTo({ name: 'course-details', courseId })}
              onOpenMyCourse={() => navigateTo({ name: 'my-course' })}
            />
          ) : (
            <WebsiteLandingScreen
              course={primaryCourse}
              brandMedia={brandMedia}
              onViewCourse={(courseId) => navigateTo({ name: 'course-details', courseId })}
              onBuyNow={(courseId) => navigateProtected({ name: 'payment', courseId })}
              onSignIn={() => navigateTo({ name: 'auth', mode: 'otp' })}
              onSupport={() => navigateTo({ name: 'support' })}
            />
          ))}

        {view.name === 'course-details' && (
          <CourseDetailsScreen
            courseId={view.courseId}
            brandMedia={brandMedia}
            onBack={() => navigateTo({ name: 'home' })}
            onBuyNow={(courseId) => navigateProtected({ name: 'payment', courseId })}
            onOpenPlayer={(courseId, lessonId) =>
              navigateProtected({ name: 'player', courseId, lessonId })
            }
          />
        )}

        {view.name === 'payment' && user && paymentCourse && (
          <PaymentScreen
            course={paymentCourse}
            user={user}
            brandMedia={brandMedia}
            razorpayConfigured={razorpayConfigured}
            onBack={() => navigateTo({ name: 'course-details', courseId: paymentCourse.id })}
            onCourseUnlocked={async () => {
              await loadBootstrap();
            }}
            onOpenMyCourse={() => navigateTo({ name: 'my-course' })}
            onOpenPaymentHistory={() => navigateTo({ name: 'purchase-history' })}
          />
        )}

        {view.name === 'my-course' && user && (
          <MyCoursesScreen
            user={user}
            primaryCourse={primaryCourse}
            onOpenPlayer={(courseId, lessonId) =>
              navigateTo({ name: 'player', courseId, lessonId })
            }
            onViewCourse={(courseId) => navigateTo({ name: 'course-details', courseId })}
            onBuyNow={(courseId) => navigateProtected({ name: 'payment', courseId })}
          />
        )}

        {view.name === 'player' && user && (
          <VideoPlayerScreen
            courseId={view.courseId}
            initialLessonId={view.lessonId}
            onBack={() => navigateTo({ name: 'my-course' })}
            onBuyNow={(courseId) => navigateProtected({ name: 'payment', courseId })}
          />
        )}

        {view.name === 'profile' && user && (
          <ProfileScreen
            user={user}
            onUserUpdated={setUser}
            onLogout={handleLogout}
            onOpenMyCourse={() => navigateTo({ name: 'my-course' })}
            onOpenPaymentHistory={() => navigateTo({ name: 'purchase-history' })}
            onOpenSupport={() => navigateTo({ name: 'support' })}
            onOpenAdminDashboard={() => navigateTo({ name: 'admin' })}
          />
        )}

        {view.name === 'purchase-history' && user && (
          <PurchaseHistoryScreen
            onBack={() => navigateTo({ name: 'profile' })}
            onOpenPlayer={(courseId) => navigateTo({ name: 'player', courseId })}
          />
        )}

        {view.name === 'support' && (
          <SupportScreen
            user={user}
            onBack={() => navigateTo(user ? { name: 'profile' } : { name: 'home' })}
          />
        )}
      </main>

      {/* Website Footer (Desktop / Web) */}
      <footer className="hidden md:block border-t border-purple-100 bg-white py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-slate-500">
          <span>KP HUBE · LEARN • GROW • SUCCEED · Contact: Kphubeyoutube63</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() =>
                primaryCourse
                  ? navigateTo({ name: 'course-details', courseId: primaryCourse.id })
                  : navigateTo({ name: 'home' })
              }
              className="hover:text-[#6D28D9] transition-colors"
            >
              Course
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ name: 'support' })}
              className="hover:text-[#6D28D9] transition-colors"
            >
              Help & Support
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => navigateTo({ name: 'auth', mode: 'otp' })}
                className="hover:text-[#6D28D9] transition-colors"
              >
                Student Login
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Home, My Course, Profile / Sign In) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid min-h-[64px] pb-[env(safe-area-inset-bottom)] grid-cols-3 border-t border-purple-100 bg-white/95 backdrop-blur-md md:hidden"
      >
        <button
          type="button"
          onClick={() => navigateTo({ name: 'home' })}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
            activeTab === 'home' ? 'text-[#6D28D9]' : 'text-slate-500'
          }`}
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => navigateProtected({ name: 'my-course' })}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
            activeTab === 'my-course' ? 'text-[#6D28D9]' : 'text-slate-500'
          }`}
        >
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <span>My Course</span>
        </button>

        <button
          type="button"
          onClick={() =>
            user ? navigateTo({ name: 'profile' }) : navigateTo({ name: 'auth', mode: 'otp' })
          }
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
            activeTab === 'profile' ? 'text-[#6D28D9]' : 'text-slate-500'
          }`}
        >
          <UserIcon className="h-5 w-5" aria-hidden="true" />
          <span>{user ? 'Profile' : 'Login'}</span>
        </button>
      </nav>
    </div>
  );
}
