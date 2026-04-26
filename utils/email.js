/**
 * Email service using Nodemailer
 * 
 * Configuration via environment variables:
 * - EMAIL_HOST: SMTP server hostname (default: smtp.gmail.com)
 * - EMAIL_PORT: SMTP port (default: 587)
 * - EMAIL_USER: SMTP username/email
 * - EMAIL_PASS: SMTP password or app-specific password
 * - EMAIL_FROM: Sender address (default: "Craftify <noreply@craftify.com>")
 * - EMAIL_SECURE: Use TLS (default: false for port 587)
 * 
 * For development/testing, you can use:
 * - Ethereal: https://ethereal.email (fake SMTP service)
 * - Mailtrap: https://mailtrap.io
 * - Gmail with App Password: https://support.google.com/accounts/answer/185833
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const isTest = process.env.NODE_ENV === 'test';
  
  if (isTest) {
    // Use a test account in test mode
    transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter;
}

/**
 * Send a password reset email
 */
async function sendPasswordResetEmail(toEmail, resetToken, userName) {
  const transporter = getTransporter();
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`;
  const fromAddress = process.env.EMAIL_FROM || 'Craftify <noreply@craftify.com>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Reset Your Craftify Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Craftify</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Handcrafted with Soul</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 16px 0; font-size: 22px;">Reset Your Password</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                      Hello ${userName || 'there'},
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                      We received a request to reset your password. Click the button below to create a new password:
                    </p>
                    <!-- CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
                          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="color: #667eea; font-size: 13px; word-break: break-all; margin: 0 0 24px 0;">
                      ${resetUrl}
                    </p>
                    <div style="border-top: 1px solid #eeeeee; padding-top: 24px; margin-top: 24px;">
                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
                        <strong>Important:</strong> This link will expire in <strong>1 hour</strong>.
                      </p>
                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0;">
                        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
                      </p>
                    </div>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 24px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      This email was sent to ${toEmail}
                    </p>
                    <p style="color: #999999; font-size: 12px; margin: 8px 0 0 0;">
                      &copy; ${new Date().getFullYear()} Craftify. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
Hello ${userName || 'there'},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

--
Craftify - Handcrafted with Soul
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Failed to send password reset email:', err);
    throw err;
  }
}

/**
 * Send a welcome email to new users
 */
async function sendWelcomeEmail(toEmail, userName) {
  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || 'Craftify <noreply@craftify.com>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Welcome to Craftify!',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Craftify!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #666666; font-size: 16px; line-height: 1.6;">Hello ${userName || 'there'},</p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6;">Thank you for joining Craftify! Start exploring unique handmade treasures from independent artisans around the world.</p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6;">Happy shopping!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return { success: true };
  } catch (err) {
    console.error('Failed to send welcome email:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  getTransporter
};
