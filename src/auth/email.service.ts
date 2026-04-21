import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * EmailService — thin NestJS wrapper around nodemailer.
 *
 * Mirrors the logic in utils/email.js (Express version) but as an injectable
 * service so AuthService can declare it as a constructor dependency.
 *
 * Configuration via environment variables (same keys as the Express version):
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    if (process.env.NODE_ENV === 'test') {
      // Use a fake SMTP server in test mode (e.g. Ethereal / Mailhog on localhost:1025)
      this.transporter = nodemailer.createTransport({
        host: 'localhost',
        port: 1025,
        secure: false,
      });
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    return this.transporter;
  }

  /**
   * Send a password-reset email with a time-limited token link.
   * Throws on transport failure so the caller can decide how to surface the error.
   */
  async sendPasswordResetEmail(
    toEmail: string,
    resetToken: string,
    userName: string,
  ): Promise<void> {
    const transport = this.getTransporter();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/auth/reset-password/${resetToken}`;
    const fromAddress = process.env.EMAIL_FROM || 'Craftify <noreply@craftify.com>';
    const year = new Date().getFullYear();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <tr><td style="background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);padding:40px 30px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">Craftify</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;font-size:14px;">Handcrafted with Soul</p>
      </td></tr>
      <tr><td style="padding:40px 30px;">
        <h2 style="color:#333;margin:0 0 16px 0;font-size:22px;">Reset Your Password</h2>
        <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hello ${userName || 'there'},</p>
        <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px 0;">
          We received a request to reset your password. Click the button below to create a new one:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
          <tr><td style="background:#F59E0B;border-radius:8px;">
            <a href="${resetUrl}"
               style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">
              Reset Password
            </a>
          </td></tr>
        </table>
        <p style="color:#666;font-size:14px;margin:0 0 8px 0;">Or copy this link into your browser:</p>
        <p style="color:#F59E0B;font-size:13px;word-break:break-all;margin:0 0 24px 0;">${resetUrl}</p>
        <div style="border-top:1px solid #eee;padding-top:24px;">
          <p style="color:#999;font-size:14px;margin:0 0 8px 0;">
            <strong>Important:</strong> This link expires in <strong>1 hour</strong>.
          </p>
          <p style="color:#999;font-size:14px;margin:0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </td></tr>
      <tr><td style="background:#f8f9fa;padding:24px 30px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#999;font-size:12px;margin:0;">This email was sent to ${toEmail}</p>
        <p style="color:#999;font-size:12px;margin:8px 0 0 0;">&copy; ${year} Craftify. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

    const text = [
      `Hello ${userName || 'there'},`,
      '',
      'We received a request to reset your Craftify password.',
      '',
      `Reset link: ${resetUrl}`,
      '',
      'This link expires in 1 hour.',
      "If you didn't request this, you can safely ignore this email.",
      '',
      '-- Craftify',
    ].join('\n');

    const info = await transport.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Reset Your Craftify Password',
      html,
      text,
    });

    this.logger.log(
      `Password reset email sent to ${toEmail}. Message ID: ${info.messageId}`,
    );
  }

  /**
   * Send a welcome email to a newly registered user.
   * Errors are swallowed — the welcome email is non-critical.
   */
  async sendWelcomeEmail(toEmail: string, userName: string): Promise<void> {
    try {
      const transport = this.getTransporter();
      const fromAddress = process.env.EMAIL_FROM || 'Craftify <noreply@craftify.com>';

      await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: 'Welcome to Craftify!',
        text: [
          `Hello ${userName || 'there'},`,
          '',
          'Welcome to Craftify! Start exploring unique handmade treasures from independent artisans.',
          '',
          'Happy shopping!',
          '',
          '-- Craftify',
        ].join('\n'),
      });

      this.logger.log(`Welcome email sent to ${toEmail}`);
    } catch (err) {
      this.logger.warn(
        `Failed to send welcome email to ${toEmail}: ${(err as Error).message}`,
      );
      // Swallowed intentionally — registration should succeed even if email fails.
    }
  }
}
