export interface DetectedFileType {
  mime: string;
  ext: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export const ALLOWED_FILE_TYPES: readonly DetectedFileType[] = [
  { mime: 'image/png', ext: 'png' },
  { mime: 'image/jpeg', ext: 'jpg' },
  { mime: 'image/webp', ext: 'webp' },
  { mime: 'application/pdf', ext: 'pdf' },
];

function startsWith(buffer: Buffer, signature: Buffer) {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

// The client-declared type and extension are never trusted: the content decides.
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  let mime: string | null = null;
  if (startsWith(buffer, PNG_SIGNATURE)) mime = 'image/png';
  else if (startsWith(buffer, JPEG_SIGNATURE)) mime = 'image/jpeg';
  else if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') mime = 'image/webp';
  else if (buffer.toString('latin1', 0, 5) === '%PDF-') mime = 'application/pdf';
  return ALLOWED_FILE_TYPES.find((t) => t.mime === mime) ?? null;
}

export function extForMime(mime: string) {
  return ALLOWED_FILE_TYPES.find((t) => t.mime === mime)?.ext ?? null;
}

const MAX_FILE_NAME_LENGTH = 255;

// For display only: the result is never used to build a path.
export function sanitizeFileName(name: string) {
  const withoutControl = name.replace(/[\u0000-\u001f\u007f]/g, '');
  const base = withoutControl.split(/[\\/]/).pop()!.trim().slice(0, MAX_FILE_NAME_LENGTH);
  return base === '' || base === '.' || base === '..' ? 'file' : base;
}
