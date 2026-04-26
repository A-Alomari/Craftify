/**
 * m26-email-service.suite.js
 * Full branch coverage for utils/email.js
 * Tests: getTransporter (test mode, production mode, caching),
 *        sendPasswordResetEmail (success, error/throw),
 *        sendWelcomeEmail (success, error/returns-false).
 *
 * nodemailer is mocked so no real SMTP connection is required.
 */

module.exports = () => {
  describe('Email Service — full branch coverage', () => {

    const ORIGINAL = {
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_HOST: process.env.EMAIL_HOST,
      EMAIL_PORT: process.env.EMAIL_PORT,
      EMAIL_USER: process.env.EMAIL_USER,
      EMAIL_PASS: process.env.EMAIL_PASS,
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_SECURE: process.env.EMAIL_SECURE,
      APP_URL: process.env.APP_URL,
    };

    function restoreEnv() {
      Object.entries(ORIGINAL).forEach(([key, val]) => {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      });
    }

    afterEach(() => {
      restoreEnv();
      jest.dontMock('nodemailer');
    });

    function buildEmailModule(sendMailImpl) {
      let emailModule, mockTransporter;
      jest.isolateModules(() => {
        mockTransporter = {
          sendMail: jest.fn().mockImplementation(sendMailImpl)
        };
        jest.doMock('nodemailer', () => ({
          createTransport: jest.fn().mockReturnValue(mockTransporter)
        }));
        emailModule = require('../../utils/email');
      });
      return { emailModule, mockTransporter };
    }

    // ── getTransporter ────────────────────────────────────────────────────────

    describe('getTransporter', () => {
      test('uses localhost:1025 in test mode (NODE_ENV=test)', () => {
        process.env.NODE_ENV = 'test';
        let createTransportArgs = null;
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({
            createTransport: jest.fn((opts) => { createTransportArgs = opts; return { sendMail: jest.fn() }; })
          }));
          ({ getTransporter } = require('../../utils/email'));
        });
        getTransporter();
        expect(createTransportArgs.host).toBe('localhost');
        expect(createTransportArgs.port).toBe(1025);
        expect(createTransportArgs.secure).toBe(false);
      });

      test('uses EMAIL_HOST env var in non-test mode', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.JEST_WORKER_ID;
        process.env.EMAIL_HOST = 'smtp.myhost.com';
        process.env.EMAIL_PORT = '25';
        let capturedArgs = null;
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({
            createTransport: jest.fn((opts) => { capturedArgs = opts; return { sendMail: jest.fn() }; })
          }));
          ({ getTransporter } = require('../../utils/email'));
        });
        getTransporter();
        expect(capturedArgs.host).toBe('smtp.myhost.com');
        expect(capturedArgs.port).toBe(25);
      });

      test('defaults EMAIL_HOST to smtp.gmail.com when not set', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.EMAIL_HOST;
        let capturedArgs = null;
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({
            createTransport: jest.fn((opts) => { capturedArgs = opts; return { sendMail: jest.fn() }; })
          }));
          ({ getTransporter } = require('../../utils/email'));
        });
        getTransporter();
        expect(capturedArgs.host).toBe('smtp.gmail.com');
      });

      test('defaults EMAIL_PORT to 587 when not set', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.EMAIL_PORT;
        let capturedArgs = null;
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({
            createTransport: jest.fn((opts) => { capturedArgs = opts; return { sendMail: jest.fn() }; })
          }));
          ({ getTransporter } = require('../../utils/email'));
        });
        getTransporter();
        expect(capturedArgs.port).toBe(587);
      });

      test('sets secure=true when EMAIL_SECURE=true', () => {
        process.env.NODE_ENV = 'development';
        process.env.EMAIL_SECURE = 'true';
        let capturedArgs = null;
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({
            createTransport: jest.fn((opts) => { capturedArgs = opts; return { sendMail: jest.fn() }; })
          }));
          ({ getTransporter } = require('../../utils/email'));
        });
        getTransporter();
        expect(capturedArgs.secure).toBe(true);
      });

      test('sets secure=false when EMAIL_SECURE is not "true"', () => {
        process.env.NODE_ENV = 'development';
        process.env.EMAIL_SECURE = 'false';
        let capturedArgs = null;
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({
            createTransport: jest.fn((opts) => { capturedArgs = opts; return { sendMail: jest.fn() }; })
          }));
          ({ getTransporter } = require('../../utils/email'));
        });
        getTransporter();
        expect(capturedArgs.secure).toBe(false);
      });

      test('returns the same transporter instance on second call (caching)', () => {
        process.env.NODE_ENV = 'test';
        const fakeTransporter = { sendMail: jest.fn() };
        const createTransportMock = jest.fn().mockReturnValue(fakeTransporter);
        let getTransporter;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({ createTransport: createTransportMock }));
          ({ getTransporter } = require('../../utils/email'));
        });
        const t1 = getTransporter();
        const t2 = getTransporter();
        expect(t1).toBe(t2);
        expect(createTransportMock).toHaveBeenCalledTimes(1);
      });
    });

    // ── sendPasswordResetEmail ─────────────────────────────────────────────────

    describe('sendPasswordResetEmail', () => {
      test('returns { success: true, messageId } on successful send', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'msg-001' })
        );
        const result = await emailModule.sendPasswordResetEmail('user@test.com', 'token123', 'Alice');
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('msg-001');
      });

      test('sends to the correct recipient', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('recipient@mail.com', 'tok', 'Bob');
        const sentOptions = mockTransporter.sendMail.mock.calls[0][0];
        expect(sentOptions.to).toBe('recipient@mail.com');
      });

      test('email subject mentions password reset', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'tok', 'C');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.subject.toLowerCase()).toContain('password');
      });

      test('includes reset token in email body', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'SECRET_TOKEN_XYZ', 'Dave');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('SECRET_TOKEN_XYZ');
        expect(opts.text).toContain('SECRET_TOKEN_XYZ');
      });

      test('includes userName in the email when provided', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'tok', 'Charlie');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('Charlie');
        expect(opts.text).toContain('Charlie');
      });

      test('falls back to "there" when userName is not provided', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'tok');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('there');
        expect(opts.text).toContain('there');
      });

      test('uses APP_URL env var for reset link', async () => {
        process.env.NODE_ENV = 'test';
        process.env.APP_URL = 'https://craftify.example.com';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'mytoken', 'Eve');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('https://craftify.example.com');
      });

      test('defaults APP_URL to http://localhost:3000 when not set', async () => {
        process.env.NODE_ENV = 'test';
        delete process.env.APP_URL;
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'tok', 'Eve');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('http://localhost:3000');
      });

      test('uses EMAIL_FROM env var as sender address', async () => {
        process.env.NODE_ENV = 'test';
        process.env.EMAIL_FROM = 'Shop <shop@craftify.com>';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'tok', 'F');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.from).toBe('Shop <shop@craftify.com>');
      });

      test('defaults EMAIL_FROM to Craftify noreply when not set', async () => {
        process.env.NODE_ENV = 'test';
        delete process.env.EMAIL_FROM;
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendPasswordResetEmail('u@t.com', 'tok', 'G');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.from).toContain('Craftify');
      });

      test('throws when sendMail rejects', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule } = buildEmailModule(() =>
          Promise.reject(new Error('SMTP error'))
        );
        await expect(emailModule.sendPasswordResetEmail('u@t.com', 'tok', 'H'))
          .rejects.toThrow('SMTP error');
      });
    });

    // ── sendWelcomeEmail ──────────────────────────────────────────────────────

    describe('sendWelcomeEmail', () => {
      test('returns { success: true } on successful send', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'msg-welcome' })
        );
        const result = await emailModule.sendWelcomeEmail('new@user.com', 'Iris');
        expect(result.success).toBe(true);
      });

      test('sends to the correct recipient', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendWelcomeEmail('iris@test.com', 'Iris');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.to).toBe('iris@test.com');
      });

      test('email subject mentions Craftify welcome', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendWelcomeEmail('u@t.com', 'J');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.subject.toLowerCase()).toContain('welcome');
      });

      test('includes userName in welcome email when provided', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendWelcomeEmail('u@t.com', 'Jasmine');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('Jasmine');
      });

      test('falls back to "there" when userName is not provided', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendWelcomeEmail('u@t.com');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.html).toContain('there');
      });

      test('uses EMAIL_FROM env var as sender', async () => {
        process.env.NODE_ENV = 'test';
        process.env.EMAIL_FROM = 'MyShop <shop@test.com>';
        const { emailModule, mockTransporter } = buildEmailModule(() =>
          Promise.resolve({ messageId: 'x' })
        );
        await emailModule.sendWelcomeEmail('u@t.com', 'K');
        const opts = mockTransporter.sendMail.mock.calls[0][0];
        expect(opts.from).toBe('MyShop <shop@test.com>');
      });

      test('returns { success: false, error } when sendMail rejects', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule } = buildEmailModule(() =>
          Promise.reject(new Error('Connection refused'))
        );
        const result = await emailModule.sendWelcomeEmail('bad@mail.com', 'L');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Connection refused');
      });

      test('does NOT throw on failure (swallows error, returns object)', async () => {
        process.env.NODE_ENV = 'test';
        const { emailModule } = buildEmailModule(() =>
          Promise.reject(new Error('network error'))
        );
        await expect(emailModule.sendWelcomeEmail('u@t.com', 'M')).resolves.not.toThrow();
      });
    });

    // ── module exports ────────────────────────────────────────────────────────

    describe('module exports', () => {
      test('exports sendPasswordResetEmail as a function', () => {
        let mod;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({ createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }) }));
          mod = require('../../utils/email');
        });
        expect(typeof mod.sendPasswordResetEmail).toBe('function');
      });

      test('exports sendWelcomeEmail as a function', () => {
        let mod;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({ createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }) }));
          mod = require('../../utils/email');
        });
        expect(typeof mod.sendWelcomeEmail).toBe('function');
      });

      test('exports getTransporter as a function', () => {
        let mod;
        jest.isolateModules(() => {
          jest.doMock('nodemailer', () => ({ createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }) }));
          mod = require('../../utils/email');
        });
        expect(typeof mod.getTransporter).toBe('function');
      });
    });
  });
};
