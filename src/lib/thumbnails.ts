import businessGrowthCover from '@/src/assets/images/course_cover_business_growth_1794535224985.jpg';
import creatorStudioCover from '@/src/assets/images/course_cover_creator_studio_1794535224486.jpg';
import digitalSkillsCover from '@/src/assets/images/course_cover_digital_skills_1794535224262.jpg';
import productivityCover from '@/src/assets/images/course_cover_productivity_1794535224195.jpg';

export const DEFAULT_FOUNDER_THUMBNAIL =
  '/assets/aistudio/WhatsApp_Image_2026-11-11_at_12.28.57_AM_c5373de0.jpeg';

export const PRESET_THUMBNAILS: Record<string, { label: string; src: string }> = {
  'founder:photo1': { label: 'KP HUBE Founder Portrait', src: DEFAULT_FOUNDER_THUMBNAIL },
  'preset:digital_skills': { label: 'Digital Architecture', src: digitalSkillsCover },
  'preset:creator_studio': { label: 'Studio Acoustics', src: creatorStudioCover },
  'preset:productivity': { label: 'Isometric Systems', src: productivityCover },
  'preset:business_growth': { label: 'Growth Prism', src: businessGrowthCover },
};

export function resolveCourseThumbnail(
  thumbnailKey: string,
  founderPhotoUrl?: string | null
): string {
  if (thumbnailKey === 'founder:photo1') {
    return founderPhotoUrl || DEFAULT_FOUNDER_THUMBNAIL;
  }
  if (
    thumbnailKey.startsWith('data:image/') ||
    thumbnailKey.startsWith('/assets/') ||
    thumbnailKey.startsWith('http')
  ) {
    return thumbnailKey;
  }
  return PRESET_THUMBNAILS[thumbnailKey]?.src || founderPhotoUrl || DEFAULT_FOUNDER_THUMBNAIL;
}
