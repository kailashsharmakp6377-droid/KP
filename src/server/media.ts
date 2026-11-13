import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const PRIVATE_MEDIA_ROOT = path.resolve(process.cwd(), 'data', 'private-media');
export const PRIVATE_VIDEO_DIR = path.join(PRIVATE_MEDIA_ROOT, 'videos');
export const PRIVATE_PDF_DIR = path.join(PRIVATE_MEDIA_ROOT, 'pdfs');

export function ensureMediaDirs() {
  fs.mkdirSync(PRIVATE_VIDEO_DIR, { recursive: true });
  fs.mkdirSync(PRIVATE_PDF_DIR, { recursive: true });
}

export function getPrivateVideoPath(filename: string): string {
  const safeName = path.basename(filename);
  return path.join(PRIVATE_VIDEO_DIR, safeName);
}

export function getPrivatePdfPath(filename: string): string {
  const safeName = path.basename(filename);
  return path.join(PRIVATE_PDF_DIR, safeName);
}

/**
 * Generates a real, minimal, valid PDF document locally for a course lesson
 * so downloadable study resources work end-to-end without external links.
 */
export function buildSimplePdfBuffer(title: string, courseTitle: string, lines: string[]): Buffer {
  const sanitizePdfText = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '-');

  const contentLines: string[] = [
    'BT',
    '/F1 18 Tf',
    '54 740 Td',
    `(${sanitizePdfText('KP HUBE - LEARN . GROW . SUCCEED')}) Tj`,
    '0 -28 Td',
    '/F1 14 Tf',
    `(${sanitizePdfText(courseTitle)}) Tj`,
    '0 -22 Td',
    '/F1 12 Tf',
    `(${sanitizePdfText('Lesson Guide: ' + title)}) Tj`,
    '0 -28 Td',
    '/F1 10 Tf',
  ];

  for (const line of lines) {
    contentLines.push(`(${sanitizePdfText(line)}) Tj`);
    contentLines.push('0 -16 Td');
  }
  contentLines.push('ET');

  const streamBody = contentLines.join('\n');
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf8')} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

/**
 * Uses local ffmpeg (verified installed) to generate a real, lightweight playable MP4
 * lesson video stored strictly inside the private media folder (never publicly served).
 */
const inflightVideos = new Map<string, Promise<string>>();

export async function ensureSampleLessonVideo(
  filename: string,
  lessonTitle: string,
  courseTitle: string,
  accentHex = '8000FF'
): Promise<string> {
  ensureMediaDirs();
  const target = getPrivateVideoPath(filename);
  if (fs.existsSync(target) && fs.statSync(target).size > 4096) {
    return target;
  }

  const existingJob = inflightVideos.get(target);
  if (existingJob) {
    return existingJob;
  }

  const job = (async () => {
    const tmpTarget = `${target}.tmp.mp4`;
    const safeTitle = lessonTitle.replace(/[':]/g, ' ');
    const safeCourse = courseTitle.replace(/[':]/g, ' ');
    const filter = [
      `drawbox=x=40:y=40:w=1200:h=640:color=#151020@0.95:t=fill`,
      `drawbox=x=40:y=40:w=1200:h=6:color=#${accentHex}:t=fill`,
      `drawbox=x=40:y=674:w=1200:h=6:color=#FFC928:t=fill`,
      `drawtext=text='KP HUBE':x=80:y=95:fontsize=34:fontcolor=#FFC928`,
      `drawtext=text='LEARN  GROW  SUCCEED':x=80:y=142:fontsize=18:fontcolor=#A78BFA`,
      `drawtext=text='${safeCourse}':x=80:y=260:fontsize=26:fontcolor=#C4B5FD`,
      `drawtext=text='${safeTitle}':x=80:y=320:fontsize=42:fontcolor=#FFFFFF`,
      `drawtext=text='Protected HD Lesson Stream':x=80:y=590:fontsize=20:fontcolor=#9CA3AF`,
    ].join(',');

    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', 'color=c=#080610:s=1280x720:d=12:r=24',
        '-f', 'lavfi',
        '-i', 'sine=frequency=220:sample_rate=44100:duration=12',
        '-vf', filter,
        '-af', 'volume=0.04',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        tmpTarget,
      ]);
    } catch {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', 'color=c=#080610:s=1280x720:d=12:r=24',
        '-f', 'lavfi',
        '-i', 'sine=frequency=220:sample_rate=44100:duration=12',
        '-vf', `drawbox=x=80:y=80:w=1120:h=560:color=#151020:t=fill,drawbox=x=80:y=80:w=1120:h=8:color=#${accentHex}:t=fill,drawbox=x=80:y=632:w=1120:h=8:color=#FFC928:t=fill`,
        '-af', 'volume=0.03',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        tmpTarget,
      ]);
    }
    fs.renameSync(tmpTarget, target);
    return target;
  })().finally(() => {
    inflightVideos.delete(target);
  });

  inflightVideos.set(target, job);
  return job;
}

export function ensureSampleLessonPdf(
  filename: string,
  lessonTitle: string,
  courseTitle: string,
  notes: string[]
): string {
  ensureMediaDirs();
  const target = getPrivatePdfPath(filename);
  if (!fs.existsSync(target) || fs.statSync(target).size < 200) {
    const buf = buildSimplePdfBuffer(lessonTitle, courseTitle, notes);
    fs.writeFileSync(target, buf);
  }
  return target;
}
