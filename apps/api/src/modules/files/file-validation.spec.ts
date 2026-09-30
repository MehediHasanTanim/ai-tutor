import {
  DOCUMENT_LIMITS,
  IMAGE_LIMITS,
  sniffMimeType,
  validateUpload,
  type UploadCandidate,
} from './file-validation';
import { AppException } from '../../common/exceptions/app.exception';

function candidate(overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  const buffer = overrides.buffer ?? Buffer.from('%PDF-1.7\nreal pdf content');
  return {
    buffer,
    mimetype: 'application/pdf',
    originalname: 'chapter.pdf',
    size: buffer.byteLength,
    ...overrides,
  };
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const EXECUTABLE = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ — Windows PE

describe('validateUpload', () => {
  it('accepts a real PDF', () => {
    expect(() => validateUpload(candidate(), DOCUMENT_LIMITS)).not.toThrow();
  });

  it('rejects a missing file', () => {
    expect(() => validateUpload(undefined, DOCUMENT_LIMITS)).toThrow(AppException);
  });

  it('rejects an empty file', () => {
    expect(() => validateUpload(candidate({ size: 0 }), DOCUMENT_LIMITS)).toThrow(AppException);
  });

  it('rejects a file over the size limit', () => {
    const oversized = candidate({ size: DOCUMENT_LIMITS.maxBytes + 1 });
    expect(() => validateUpload(oversized, DOCUMENT_LIMITS)).toThrow(/limit is/);
  });

  it('rejects a disallowed MIME type', () => {
    const zip = candidate({ mimetype: 'application/zip', originalname: 'corpus.zip' });
    expect(() => validateUpload(zip, DOCUMENT_LIMITS)).toThrow(/not accepted/);
  });

  describe('content sniffing', () => {
    it('rejects an executable renamed to .pdf', () => {
      // The attack the sniff exists for: the client sets the MIME type, so
      // a declared type alone proves nothing.
      const disguised = candidate({ buffer: EXECUTABLE, originalname: 'chapter.pdf' });
      expect(() => validateUpload(disguised, DOCUMENT_LIMITS)).toThrow(/contradict/);
    });

    it('rejects a PNG declared as a JPEG', () => {
      const mismatched = candidate({
        buffer: PNG_HEADER,
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      });
      expect(() => validateUpload(mismatched, IMAGE_LIMITS)).toThrow(/contradict/);
    });

    it('accepts a genuine JPEG and PNG', () => {
      for (const [buffer, mimetype] of [
        [JPEG_HEADER, 'image/jpeg'],
        [PNG_HEADER, 'image/png'],
      ] as const) {
        expect(() =>
          validateUpload(candidate({ buffer, mimetype, originalname: 'photo' }), IMAGE_LIMITS),
        ).not.toThrow();
      }
    });

    it('allows plain text, which has no signature to check', () => {
      // Inert, and the size limit still applies — checking a signature that
      // does not exist would reject every valid .txt.
      const text = candidate({
        buffer: Buffer.from('ত্বরণ কাকে বলে?'),
        mimetype: 'text/plain',
        originalname: 'notes.txt',
      });
      expect(() => validateUpload(text, DOCUMENT_LIMITS)).not.toThrow();
    });
  });

  it('applies the stricter image ceiling to images', () => {
    expect(IMAGE_LIMITS.maxBytes).toBeLessThan(DOCUMENT_LIMITS.maxBytes);

    const bigImage = candidate({
      buffer: JPEG_HEADER,
      mimetype: 'image/jpeg',
      size: IMAGE_LIMITS.maxBytes + 1,
    });
    expect(() => validateUpload(bigImage, IMAGE_LIMITS)).toThrow(AppException);
  });
});

describe('sniffMimeType', () => {
  it('identifies formats from their leading bytes', () => {
    expect(sniffMimeType(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMimeType(PNG_HEADER)).toBe('image/png');
    expect(sniffMimeType(JPEG_HEADER)).toBe('image/jpeg');
  });

  it('returns null for something it does not recognise', () => {
    expect(sniffMimeType(Buffer.from('just some text'))).toBeNull();
  });
});
