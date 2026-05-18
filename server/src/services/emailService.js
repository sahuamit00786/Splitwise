// /server/src/services/emailService.js
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendGroupInvitationEmail 
} from '../config/email.js';

/**
 * Email service wrapper with error handling
 */
export class EmailService {
  /**
   * Send verification email
   * @param {string} to - Recipient email
   * @param {string} name - Recipient name
   * @param {string} token - Verification token
   * @returns {Promise<boolean>}
   */
  static async sendVerification(to, name, token) {
    try {
      await sendVerificationEmail(to, name, token);
      return true;
    } catch (error) {
      console.error('Failed to send verification email:', error.message);
      return false;
    }
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} name - Recipient name
   * @param {string} token - Reset token
   * @returns {Promise<boolean>}
   */
  static async sendPasswordReset(to, name, token) {
    try {
      await sendPasswordResetEmail(to, name, token);
      return true;
    } catch (error) {
      console.error('Failed to send password reset email:', error.message);
      return false;
    }
  }

  /**
   * Send group invitation email
   * @param {string} to - Recipient email
   * @param {string} inviterName - Name of person who sent invite
   * @param {string} groupName - Name of the group
   * @param {string} token - Invitation token
   * @returns {Promise<boolean>}
   */
  static async sendGroupInvitation(to, inviterName, groupName, token) {
    try {
      await sendGroupInvitationEmail(to, inviterName, groupName, token);
      return true;
    } catch (error) {
      console.error('Failed to send group invitation email:', error.message);
      return false;
    }
  }
}
