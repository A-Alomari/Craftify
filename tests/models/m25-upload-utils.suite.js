/**
 * m25-upload-utils.suite.js
 * Full branch coverage for utils/upload.js
 * Tests: imageFileFilter, hasValidImageSignature (via validateUploadedImageSignatures),
 *        createImageUpload (limits/options), validateUploadedImageSignatures (all file paths).
 *
 * Real temp files are created in os.tmpdir() to drive the signature-check branches.
 * jest.isolateModules() + jest.doMock() are used to capture the internal imageFileFilter
 * function without requiring it to be exported.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = () => {
  describe('Upload Utilities — full branch coverage', () => {

    // ── Helpers — magic-byte buffers ─────────────────────────────────────────

    /** 12-byte buffer with JPEG signature at offset 0–2 */
    function jpegBytes() {
      const b = Buffer.alloc(12);
      b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
      return b;
    }

    /** 12-byte buffer with PNG signature at offset 0–7 */
    function pngBytes() {
      const b = Buffer.alloc(12);
      b[0] = 0x89; b[1] = 0x50; b[2] = 0x4e; b[3] = 0x47;
      b[4] = 0x0d; b[5] = 0x0a; b[6] = 0x1a; b[7] = 0x0a;
      return b;
    }

    /** 12-byte buffer with WebP signature (RIFF....WEBP) */
    function webpBytes() {
      const b = Buffer.alloc(12);
      b.write('RIFF', 0, 'ascii');
      b.write('WEBP', 8, 'ascii');
      return b;
    }

    /** 12-byte buffer with all zeros (invalid signature) */
    function invalidBytes() {
      return Buffer.alloc(12);
    }

    function writeTempFile(buf, ext) {
      const filePath = path.join(os.tmpdir(), `craftify_upload_test_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
      fs.writeFileSync(filePath, buf);
      return filePath;
    }

    function cleanupFiles(...filePaths) {
      filePaths.forEach((p) => {
        try { fs.unlinkSync(p); } catch (_) {}
      });
    }

    // ── module exports ────────────────────────────────────────────────────────

    describe('module exports', () => {
      const upload = require('../../utils/upload');

      test('exports createImageUpload as a function', () => {
        expect(typeof upload.createImageUpload).toBe('function');
      });

      test('exports validateUploadedImageSignatures as a function', () => {
        expect(typeof upload.validateUploadedImageSignatures).toBe('function');
      });

      test('exports allowedImageTypes as an object', () => {
        expect(typeof upload.allowedImageTypes).toBe('object');
        expect(upload.allowedImageTypes).not.toBeNull();
      });

      test('allowedImageTypes covers jpeg, png, webp', () => {
        const { allowedImageTypes } = upload;
        expect(allowedImageTypes['image/jpeg']).toEqual(expect.arrayContaining(['.jpg', '.jpeg']));
        expect(allowedImageTypes['image/png']).toContain('.png');
        expect(allowedImageTypes['image/webp']).toContain('.webp');
      });
    });

    // ── imageFileFilter — captured via jest.isolateModules + jest.doMock ──────

    describe('imageFileFilter', () => {
      let fileFilter;

      beforeAll((done) => {
        jest.isolateModules(() => {
          // Mock multer to capture the fileFilter passed to it in createImageUpload
          jest.doMock('multer', () => {
            const mockMulter = jest.fn().mockReturnValue({ single: jest.fn(), array: jest.fn() });
            mockMulter.diskStorage = jest.fn().mockReturnValue({});
            return mockMulter;
          });

          const upload = require('../../utils/upload');
          upload.createImageUpload(); // triggers multer({..., fileFilter: imageFileFilter})

          const multerMock = require('multer');
          // Find the call to multer({...}) (not diskStorage) that has fileFilter
          const multerCall = multerMock.mock.calls.find(call => call[0] && call[0].fileFilter);
          if (multerCall) {
            fileFilter = multerCall[0].fileFilter;
          }
        });
        done();
      });

      function callFilter(mimetype, originalname) {
        return new Promise((resolve, reject) => {
          fileFilter({}, { mimetype, originalname }, (err, ok) => {
            if (err) resolve({ err });
            else resolve({ ok });
          });
        });
      }

      test('accepts image/jpeg with .jpg extension', async () => {
        const result = await callFilter('image/jpeg', 'photo.jpg');
        expect(result.ok).toBe(true);
        expect(result.err).toBeUndefined();
      });

      test('accepts image/jpeg with .jpeg extension', async () => {
        const result = await callFilter('image/jpeg', 'photo.jpeg');
        expect(result.ok).toBe(true);
      });

      test('accepts image/png with .png extension', async () => {
        const result = await callFilter('image/png', 'image.png');
        expect(result.ok).toBe(true);
      });

      test('accepts image/webp with .webp extension', async () => {
        const result = await callFilter('image/webp', 'image.webp');
        expect(result.ok).toBe(true);
      });

      test('rejects unknown mimetype (image/gif)', async () => {
        const result = await callFilter('image/gif', 'anim.gif');
        expect(result.err).toBeInstanceOf(Error);
        expect(result.err.message).toMatch(/JPEG|PNG|WebP/i);
      });

      test('rejects valid mimetype with mismatched extension (.gif on jpeg)', async () => {
        const result = await callFilter('image/jpeg', 'file.gif');
        expect(result.err).toBeInstanceOf(Error);
      });

      test('rejects valid mimetype with wrong extension (.png on jpeg)', async () => {
        const result = await callFilter('image/jpeg', 'file.png');
        expect(result.err).toBeInstanceOf(Error);
      });

      test('rejects image/png with .jpg extension', async () => {
        const result = await callFilter('image/png', 'image.jpg');
        expect(result.err).toBeInstanceOf(Error);
      });

      test('rejects empty originalname (no extension)', async () => {
        const result = await callFilter('image/jpeg', '');
        expect(result.err).toBeInstanceOf(Error);
      });

      test('rejects when mimetype is undefined', async () => {
        const result = await callFilter(undefined, 'file.jpg');
        expect(result.err).toBeInstanceOf(Error);
      });
    });

    // ── createImageUpload — options branches ──────────────────────────────────

    describe('createImageUpload', () => {
      const upload = require('../../utils/upload');

      test('returns a multer middleware object', () => {
        const mw = upload.createImageUpload();
        expect(mw).toBeDefined();
        // multer() returns an object with middleware methods (not a plain function)
        expect(mw).not.toBeNull();
        expect(typeof mw).not.toBe('undefined');
      });

      test('returns without error when called with no options', () => {
        expect(() => upload.createImageUpload()).not.toThrow();
      });

      test('returns without error with explicit maxFileSize', () => {
        expect(() => upload.createImageUpload({ maxFileSize: 2 * 1024 * 1024 })).not.toThrow();
      });

      test('returns without error with maxFiles as a number', () => {
        expect(() => upload.createImageUpload({ maxFiles: 5 })).not.toThrow();
      });

      test('returns without error with maxFiles as a non-number (string)', () => {
        // When maxFiles is not a number, limits.files should NOT be set (no throw expected)
        expect(() => upload.createImageUpload({ maxFiles: 'five' })).not.toThrow();
      });

      test('returns without error with maxFiles undefined (default)', () => {
        expect(() => upload.createImageUpload({ maxFiles: undefined })).not.toThrow();
      });

      test('returns different instances on each call', () => {
        const a = upload.createImageUpload();
        const b = upload.createImageUpload();
        expect(a).not.toBe(b);
      });
    });

    // ── validateUploadedImageSignatures — all req.file / req.files branches ───

    describe('validateUploadedImageSignatures', () => {
      const { validateUploadedImageSignatures } = require('../../utils/upload');

      function makeNext() { return jest.fn(); }

      test('calls next() when req has no file and no files', () => {
        const req = {};
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeUndefined();
      });

      test('calls next() when req.file and req.files are both undefined', () => {
        const req = { file: undefined, files: undefined };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
      });

      test('calls next() for valid JPEG req.file', () => {
        const filePath = writeTempFile(jpegBytes(), '.jpg');
        const req = { file: { path: filePath, mimetype: 'image/jpeg' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeUndefined();
        cleanupFiles(filePath);
      });

      test('calls next() for valid PNG req.file', () => {
        const filePath = writeTempFile(pngBytes(), '.png');
        const req = { file: { path: filePath, mimetype: 'image/png' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        cleanupFiles(filePath);
      });

      test('calls next() for valid WebP req.file', () => {
        const filePath = writeTempFile(webpBytes(), '.webp');
        const req = { file: { path: filePath, mimetype: 'image/webp' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        cleanupFiles(filePath);
      });

      test('calls next(err) for JPEG file with wrong magic bytes', () => {
        const filePath = writeTempFile(invalidBytes(), '.jpg');
        const req = { file: { path: filePath, mimetype: 'image/jpeg' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        const callArg = next.mock.calls[0][0];
        expect(callArg).toBeInstanceOf(Error);
        expect(callArg.status).toBe(400);
        expect(callArg.message).toMatch(/image format/i);
        // File should have been deleted (best-effort)
        cleanupFiles(filePath);
      });

      test('calls next(err) for PNG file with wrong magic bytes', () => {
        const filePath = writeTempFile(invalidBytes(), '.png');
        const req = { file: { path: filePath, mimetype: 'image/png' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(filePath);
      });

      test('calls next(err) for WebP file with wrong magic bytes', () => {
        const filePath = writeTempFile(invalidBytes(), '.webp');
        const req = { file: { path: filePath, mimetype: 'image/webp' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(filePath);
      });

      test('calls next(err) for file with unknown mimetype', () => {
        const filePath = writeTempFile(invalidBytes(), '.gif');
        const req = { file: { path: filePath, mimetype: 'image/gif' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(filePath);
      });

      test('skips file that has no path property', () => {
        const req = { file: { mimetype: 'image/jpeg' } }; // no path
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
      });

      test('skips null/undefined entries in file list', () => {
        const req = { file: null };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
      });

      test('processes multiple files in req.files array — all valid', () => {
        const p1 = writeTempFile(jpegBytes(), '.jpg');
        const p2 = writeTempFile(pngBytes(), '.png');
        const req = {
          files: [
            { path: p1, mimetype: 'image/jpeg' },
            { path: p2, mimetype: 'image/png' },
          ],
        };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        cleanupFiles(p1, p2);
      });

      test('fails fast on first invalid file in req.files array', () => {
        const goodPath = writeTempFile(jpegBytes(), '.jpg');
        const badPath = writeTempFile(invalidBytes(), '.png');
        const req = {
          files: [
            { path: goodPath, mimetype: 'image/jpeg' },
            { path: badPath, mimetype: 'image/png' },
          ],
        };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(goodPath, badPath);
      });

      test('processes req.files as object with array values', () => {
        const p1 = writeTempFile(pngBytes(), '.png');
        const req = {
          files: {
            avatar: [{ path: p1, mimetype: 'image/png' }],
          },
        };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        cleanupFiles(p1);
      });

      test('processes req.files as object with invalid file in array value', () => {
        const p1 = writeTempFile(invalidBytes(), '.png');
        const req = {
          files: {
            avatar: [{ path: p1, mimetype: 'image/png' }],
          },
        };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(p1);
      });

      test('processes req.files as object with single (non-array) file entry', () => {
        const p1 = writeTempFile(webpBytes(), '.webp');
        const req = {
          files: {
            cover: { path: p1, mimetype: 'image/webp' }, // single entry, not array
          },
        };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        cleanupFiles(p1);
      });

      test('skips null values inside req.files object', () => {
        const req = { files: { avatar: null } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
      });

      test('handles non-existent file path gracefully (returns false → error)', () => {
        const req = { file: { path: '/nonexistent/path/xyz.jpg', mimetype: 'image/jpeg' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
      });

      test('handles unlink error gracefully when invalid file cannot be deleted', () => {
        // Write a file, make it invalid, then delete it before the middleware runs
        // so that unlink fails — but the error middleware should still call next(err)
        const filePath = path.join(os.tmpdir(), `craftify_gone_${Date.now()}.jpg`);
        // Write and immediately delete so file doesn't exist at validation time
        fs.writeFileSync(filePath, invalidBytes());
        fs.unlinkSync(filePath); // pre-delete → hasValidImageSignature → false; then unlink fails
        const req = { file: { path: filePath, mimetype: 'image/jpeg' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        // Should still call next with error despite unlink failure
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
      });

      test('file too short (< 12 bytes) is treated as invalid', () => {
        const shortBuf = Buffer.from([0xff, 0xd8, 0xff]); // only 3 bytes, < 12
        const p = writeTempFile(shortBuf, '.jpg');
        const req = { file: { path: p, mimetype: 'image/jpeg' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(p);
      });

      test('handles req.file combined with req.files array', () => {
        const p1 = writeTempFile(jpegBytes(), '.jpg');
        const p2 = writeTempFile(pngBytes(), '.png');
        const req = {
          file: { path: p1, mimetype: 'image/jpeg' },
          files: [{ path: p2, mimetype: 'image/png' }],
        };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        cleanupFiles(p1, p2);
      });

      test('JPEG first 3 bytes must all match — partial match returns invalid', () => {
        // Only first 2 bytes match JPEG (FF D8) but not third (should be FF)
        const buf = Buffer.alloc(12);
        buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0x00; // third byte wrong
        const p = writeTempFile(buf, '.jpg');
        const req = { file: { path: p, mimetype: 'image/jpeg' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(p);
      });

      test('PNG: one byte wrong in signature fails validation', () => {
        const buf = pngBytes();
        buf[3] = 0x00; // corrupt the 4th byte
        const p = writeTempFile(buf, '.png');
        const req = { file: { path: p, mimetype: 'image/png' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(p);
      });

      test('WebP: RIFF present but WEBP marker wrong → invalid', () => {
        const buf = Buffer.alloc(12);
        buf.write('RIFF', 0, 'ascii');
        buf.write('WAVE', 8, 'ascii'); // wrong marker
        const p = writeTempFile(buf, '.webp');
        const req = { file: { path: p, mimetype: 'image/webp' } };
        const next = makeNext();
        validateUploadedImageSignatures(req, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
        cleanupFiles(p);
      });
    });
  });
};
