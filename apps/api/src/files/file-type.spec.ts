import { detectFileType, sanitizeFileName } from './file-type.js';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32)]);
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n');

describe('detectFileType', () => {
  it.each([
    ['png', png, 'image/png', 'png'],
    ['jpeg', jpeg, 'image/jpeg', 'jpg'],
    ['webp', webp, 'image/webp', 'webp'],
    ['pdf', pdf, 'application/pdf', 'pdf'],
  ])('recognizes %s by its signature', (_name, buffer, mime, ext) => {
    expect(detectFileType(buffer)).toEqual({ mime, ext });
  });

  it.each([
    ['html', Buffer.from('<html><script>alert(1)</script></html>')],
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['gif', Buffer.from('GIF89a\x01\x00\x01\x00')],
    ['windows executable', Buffer.from('MZ\x90\x00\x03\x00\x00\x00')],
    ['plain text', Buffer.from('just some text')],
    ['RIFF that is not webp (wav)', Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WAVEfmt ')])],
    ['empty buffer', Buffer.alloc(0)],
    ['buffer shorter than any signature', Buffer.from([0x89, 0x50])],
    ['signature not at the start', Buffer.concat([Buffer.from('xx'), png])],
  ])('rejects %s', (_name, buffer) => {
    expect(detectFileType(buffer)).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('keeps a normal name', () => {
    expect(sanitizeFileName('receipt 12.png')).toBe('receipt 12.png');
  });

  it('strips directories (unix and windows separators)', () => {
    expect(sanitizeFileName('../../etc/passwd.png')).toBe('passwd.png');
    expect(sanitizeFileName('C:\\Users\\a\\proof.pdf')).toBe('proof.pdf');
  });

  it('removes control characters', () => {
    expect(sanitizeFileName('pro\r\nof\u0000.png')).toBe('proof.png');
  });

  it('truncates to 255 characters', () => {
    expect(sanitizeFileName(`${'a'.repeat(400)}.png`).length).toBeLessThanOrEqual(255);
  });

  it('falls back to a placeholder when nothing is left', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('../')).toBe('file');
    expect(sanitizeFileName('\u0000\r\n')).toBe('file');
  });
});
