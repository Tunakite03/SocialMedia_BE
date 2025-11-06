const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const Logger = require('../utils/logger');

class EmailService {
   constructor() {
      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
         process.env.CLIENT_ID,
         process.env.CLIENT_SECRET,
         'https://developers.google.com/oauthplayground' // Redirect URL for OAuth2 playground
      );

      // Set refresh token
      this.oauth2Client.setCredentials({
         refresh_token: process.env.REFRESH_TOKEN,
      });

      // Create transporter with OAuth2
      this.transporter = nodemailer.createTransport({
         service: 'gmail',
         auth: {
            type: 'OAuth2',
            user: process.env.GMAIL_USER || 'tunakite03@gmail.com',
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN,
            accessToken: async () => {
               try {
                  const accessToken = await this.oauth2Client.getAccessToken();
                  return accessToken.token;
               } catch (error) {
                  Logger.error('Failed to get access token', { error: error.message });
                  throw error;
               }
            },
         },
      });
   }

   async sendEmail(to, subject, html, text = null) {
      try {
         const mailOptions = {
            from: `"${process.env.APP_NAME || 'Otakomi'}" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
         };

         const info = await this.transporter.sendMail(mailOptions);
         Logger.info('Email sent successfully', { to, subject, messageId: info.messageId });
         return { success: true, messageId: info.messageId };
      } catch (error) {
         Logger.error('Failed to send email', { to, subject, error: error.message });
         throw new Error('Failed to send email');
      }
   }

   async sendWelcomeEmail(email, username) {
      try {
         const subject = `Welcome to ${process.env.APP_NAME || 'Otakomi'}!`;
         const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
               <h2 style="color: #333;">Welcome to ${process.env.APP_NAME || 'Otakomi'}!</h2>
               <p>Hi ${username},</p>
               <p>Thank you for joining ${
                  process.env.APP_NAME || 'Otakomi'
               }! We're excited to have you as part of our community.</p>
               <p>You can now:</p>
               <ul>
                  <li>Connect with friends</li>
                  <li>Share your thoughts and experiences</li>
                  <li>Discover new content</li>
               </ul>
               <p>If you have any questions, feel free to reach out to our support team.</p>
               <p>Happy exploring!</p>
               <p>The ${process.env.APP_NAME || 'Otakomi'} Team</p>
               <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
               <p style="color: #666; font-size: 12px;">This is an automated message from ${
                  process.env.APP_NAME || 'Otakomi'
               }. Please do not reply to this email.</p>
            </div>
         `;

         return await this.sendEmail(email, subject, html);
      } catch (error) {
         Logger.error('Failed to send welcome email', { email, username, error: error.message });
         throw error;
      }
   }

   async sendPasswordResetEmail(email, resetToken) {
      try {
         const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

         const mailOptions = {
            from: `"${process.env.APP_NAME || 'Otakomi'}" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Password Reset Request',
            html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You requested a password reset for your Otakomi account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from Otakomi. Please do not reply to this email.</p>
          </div>
        `,
            text: `
          Password Reset Request

          You requested a password reset for your Otakomi account.

          Reset your password here: ${resetUrl}

          This link will expire in 1 hour.

          If you didn't request this password reset, please ignore this email.

          This is an automated message from Otakomi. Please do not reply to this email.
        `,
         };

         const info = await this.transporter.sendMail(mailOptions);
         Logger.info('Password reset email sent', { email, messageId: info.messageId });
         return { success: true, messageId: info.messageId };
      } catch (error) {
         Logger.error('Failed to send password reset email', { email, error: error.message });
         throw new Error('Failed to send password reset email');
      }
   }

   async verifyConnection() {
      try {
         await this.transporter.verify();
         Logger.info('Email service connection verified');
         return true;
      } catch (error) {
         Logger.error('Email service connection failed', { error: error.message });
         return false;
      }
   }
}

module.exports = new EmailService();
