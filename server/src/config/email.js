// /server/src/config/email.js
import nodemailer from 'nodemailer';
import { env } from './env.js';

let transporter = null;

/**
 * Get or create Nodemailer transporter
 * @returns {nodemailer.Transport}
 */
export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass
      }
    });
  }
  return transporter;
}

/**
 * Send verification email
 * @param {string} to - Recipient email
 * @param {string} name - Recipient name
 * @param {string} token - Verification token
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(to, name, token) {
  const verifyUrl = `${env.clientUrl}/verify-email?token=${token}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #5B4CF5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to Splitwise Clone! 👋</h2>
    <p>Hi ${name},</p>
    <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
    <a href="${verifyUrl}" class="button">Verify Email</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #5B4CF5;">${verifyUrl}</p>
    <p>This link will expire in 24 hours.</p>
    <div class="footer">
      <p>If you didn't create an account, please ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} Splitwise Clone. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  await getTransporter().sendMail({
    from: `"Splitwise Clone" <${env.smtp.fromEmail}>`,
    to,
    subject: 'Verify your email address',
    html
  });
}

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} name - Recipient name
 * @param {string} token - Reset token
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail(to, name, token) {
  const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request 🔒</h2>
    <p>Hi ${name},</p>
    <p>You requested to reset your password. Click the button below to proceed:</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #EF4444;">${resetUrl}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Splitwise Clone. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  await getTransporter().sendMail({
    from: `"Splitwise Clone" <${env.smtp.fromEmail}>`,
    to,
    subject: 'Reset your password',
    html
  });
}

/**
 * Send group invitation email
 * @param {string} to - Recipient email
 * @param {string} inviterName - Name of person who sent invite
 * @param {string} groupName - Name of the group
 * @param {string} token - Invitation token
 * @returns {Promise<void>}
 */
export async function sendGroupInvitationEmail(to, inviterName, groupName, token) {
  const joinUrl = `${env.clientUrl}/join-group?token=${token}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #22C55E; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>You've been invited to a group! 🎉</h2>
    <p>Hi there,</p>
    <p><strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on Splitwise Clone.</p>
    <p>Click the button below to accept the invitation and start splitting expenses:</p>
    <a href="${joinUrl}" class="button">Join Group</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #22C55E;">${joinUrl}</p>
    <p>This invitation will expire in 7 days.</p>
    <div class="footer">
      <p>If you didn't expect this invitation, please ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} Splitwise Clone. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  await getTransporter().sendMail({
    from: `"Splitwise Clone" <${env.smtp.fromEmail}>`,
    to,
    subject: `You're invited to join "${groupName}"`,
    html
  });
}
