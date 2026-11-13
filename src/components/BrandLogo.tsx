import { Camera } from 'lucide-react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function BrandLogo({ size = 'md', showTagline = false }: BrandLogoProps) {
  const iconDim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const textSize =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl tracking-tight' : 'text-lg';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${iconDim} relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#F59E0B] shadow-[0_6px_18px_rgba(109,40,217,0.22)] shrink-0`}
      >
        <svg viewBox="0 0 64 64" className="w-[70%] h-[70%]" aria-hidden="true">
          <path d="M12 14h8v14l12-14h10L28 31l15 19H33L20 33v17h-8V14z" fill="#FFFFFF" />
          <path
            d="M40 14h10c7 0 11 4.5 11 11s-4 11-11 11h-3v14h-7V14zm7 15h3c3 0 4.5-1.5 4.5-4s-1.5-4-4.5-4h-3v8z"
            fill="#FEF3C7"
          />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={`font-display font-bold ${textSize} tracking-tight text-[#5B21B6] whitespace-nowrap`}
        >
          KP HUBE
        </span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-[#B45309] whitespace-nowrap">
            LEARN • GROW • SUCCEED
          </span>
        )}
      </div>
    </div>
  );
}

export const DEFAULT_FOUNDER_PHOTO1_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-11_at_12.28.57_AM_c5373de0.jpeg';
export const DEFAULT_UPI_ID = 'kailash100k@axl';
export const DEFAULT_UPI_PAYEE = 'KP HUBE';

interface FounderPhotoFrameProps {
  slot?: 'photo1' | 'photo2';
  dataUrl: string | null;
  aspectClass?: string;
}

export function FounderPhotoFrame({
  slot = 'photo1',
  dataUrl,
  aspectClass = 'aspect-[4/4]',
}: FounderPhotoFrameProps) {
  const src = dataUrl || (slot === 'photo1' ? DEFAULT_FOUNDER_PHOTO1_URL : null);

  if (src) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-purple-100 bg-white ${aspectClass}`}
      >
        <img
          src={src}
          alt="Founder · KP HUBE"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-top"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1E1035]/80 via-[#1E1035]/25 to-transparent p-4">
          <p className="text-xs font-semibold text-[#FEF3C7]">KP HUBE · Official Course</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFFBEB] p-6 ${aspectClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-[#6D28D9]">KP HUBE</span>
        <Camera className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>
      <div className="my-auto flex flex-col items-center text-center py-6">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#F59E0B] text-white font-display font-bold text-lg">
          KP
        </div>
        <p className="text-xs text-slate-500">Upload Founder Studio Photo in Admin Panel</p>
      </div>
    </div>
  );
}
