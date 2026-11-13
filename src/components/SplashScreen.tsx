import { useEffect } from 'react';
import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 950);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF9FE] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center rounded-[28px] border border-purple-100 bg-white px-10 py-12 shadow-[0_18px_50px_rgba(109,40,217,0.08)]"
      >
        <BrandLogo size="lg" />
        <p className="mt-5 font-display text-xs font-semibold tracking-[0.26em] text-[#B45309]">
          LEARN • GROW • SUCCEED
        </p>
        <div className="mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-purple-100">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#F59E0B]"
          />
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onComplete}
        className="mt-7 min-h-[44px] px-4 py-2 text-xs font-medium text-slate-500 hover:text-[#6D28D9] transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
