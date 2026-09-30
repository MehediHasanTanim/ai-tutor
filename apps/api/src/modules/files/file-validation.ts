/**
 * Upload validation — architecture §13 ("File size/MIME validation").
 *
 * The client-declared MIME type is a hint, not evidence: it comes from the
 * browser and an attacker sets it freely. So this checks the file's actual
 * leading bytes and rejects a mismatch — a `.pdf` that begins with `MZ` is a
 * Windows executable someone is trying to park in the bucket.
 */

import { ErrorCode } from '@ai-tutor/shared-types';
import { AppException } from '../../common/exceptions/app.exception';

export interface UploadLimits {
  maxBytes: number;
  allowedMimeTypes: readonly string[];
}

/** NCTB textbooks run large; scanned chapters more so. */
export const DOCUMENT_LIMITS: UploadLimits = {
  maxBytes: 50 * 1024 * 1024,
  allowedMimeTypes: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

/** Student photos, compressed client-side before upload (doc 05 §7). */
export const IMAGE_LIMITS: UploadLimits = {
  maxBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

/** Leading bytes that identify a format, regardless of what the client claims. */
const MAGIC_NUMBERS: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" after RIFF
  // DOCX is a zip. So are several other things, which is why the declared
  // type still has to be on the allow-list — this only rules out the
  // executables and archives-pretending-to-be-documents.
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
];

export interface UploadCandidate {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export function validateUpload(file: UploadCandidate | undefined, limits: UploadLimits): void {
  if (!file || file.size === 0) {
    throw new AppException(ErrorCode.VALIDATION_ERROR, {
      message: 'No file was uploaded',
      details: { file: ['A file is required'] },
    });
  }

  if (file.size > limits.maxBytes) {
    throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, {
      message: `File is ${formatBytes(file.size)}; the limit is ${formatBytes(limits.maxBytes)}`,
    });
  }

  if (!limits.allowedMimeTypes.includes(file.mimetype)) {
    throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, {
      message: `"${file.mimetype}" is not accepted. Allowed: ${limits.allowedMimeTypes.join(', ')}`,
    });
  }

  assertContentMatchesDeclaredType(file);
}

/**
 * Rejects a file whose bytes contradict its declared type.
 *
 * Only enforced for formats with a known signature. Plain text has none, so
 * a `text/plain` upload passes on the declared type alone — acceptable,
 * because text is inert and the size limit still applies.
 */
function assertContentMatchesDeclaredType(file: UploadCandidate): void {
  const signature = MAGIC_NUMBERS.find((entry) => entry.mime === file.mimetype);
  if (!signature) return;

  const offset = signature.offset ?? 0;
  const expected = Buffer.from(signature.bytes);
  const actual = file.buffer.subarray(offset, offset + expected.length);

  if (!actual.equals(expected)) {
    throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, {
      message:
        `The file does not look like ${file.mimetype}. Its contents contradict ` +
        'the declared type.',
    });
  }
}

/** Detects the real type from content, for logging what someone actually sent. */
export function sniffMimeType(buffer: Buffer): string | null {
  for (const entry of MAGIC_NUMBERS) {
    const offset = entry.offset ?? 0;
    const expected = Buffer.from(entry.bytes);
    if (buffer.subarray(offset, offset + expected.length).equals(expected)) {
      return entry.mime;
    }
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
