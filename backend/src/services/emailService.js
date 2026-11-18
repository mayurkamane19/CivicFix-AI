import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let activeTransporter = null;
let isMocked = false;

/**
 * Validates basic email address format
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmailAddress = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

/**
 * Initializes or retrieves the Nodemailer transporter
 * @returns {nodemailer.Transporter | null}
 */
export const getTransporter = () => {
  if (activeTransporter) {
    return activeTransporter;
  }

  const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = config.email;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  activeTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    // Safe timeouts to prevent hung connections
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  });

  return activeTransporter;
};

/**
 * Injects a mock transporter for automated unit testing (zero external network/SMTP calls)
 * @param {object} mock
 */
export const setMockTransporter = (mock) => {
  activeTransporter = mock;
  isMocked = true;
};

/**
 * Resets transporter instance (used in test tear-down)
 */
export const resetTransporter = () => {
  activeTransporter = null;
  isMocked = false;
};

/**
 * Returns safe diagnostic information about the email service
 * @returns {object} Safe status representation (never contains passwords)
 */
export const getEmailServiceStatus = () => {
  return {
    isEnabled: config.email.isEnabled,
    isConfigured: config.email.isConfigured,
    isMocked,
    host: config.email.smtpHost || null,
    port: config.email.smtpPort,
    secure: config.email.smtpSecure,
    fromAddress: config.email.fromAddress,
    fromName: config.email.fromName
  };
};

/**
 * Sends an email message safely with error boundary and simulated offline fallback
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain-text fallback
 * @returns {Promise<{ success: boolean, messageId?: string, simulated?: boolean, error?: string }>}
 */
export const sendMailAsync = async ({ to, subject, html, text }) => {
  // 1. Validate Recipient
  if (!isValidEmailAddress(to)) {
    const error = new Error(`Invalid recipient email address: "${to}"`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate Subject
  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    const error = new Error('Email subject is required');
    error.statusCode = 400;
    throw error;
  }

  // 3. Check if email notifications are enabled or running in mocked test mode
  if (!config.email.isEnabled && !isMocked) {
    // Graceful simulation: log diagnostic notice without throwing error
    const simulatedId = `simulated-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      success: true,
      simulated: true,
      messageId: simulatedId,
      notice: 'Email delivery simulated (EMAIL_ENABLED=false)'
    };
  }

  // 4. Retrieve transporter
  const transporter = getTransporter();
  if (!transporter) {
    const error = new Error('SMTP transport is not configured. Please set SMTP credentials in backend/.env');
    error.statusCode = 503;
    throw error;
  }

  // 5. Send message via Nodemailer
  const from = `"${config.email.fromName}" <${config.email.fromAddress}>`;

  try {
    const info = await transporter.sendMail({
      from,
      to: to.trim().toLowerCase(),
      subject: subject.trim(),
      html,
      text
    });

    return {
      success: true,
      simulated: false,
      messageId: info.messageId || `msg-${Date.now()}`
    };
  } catch (err) {
    // Sanitize any potential credential leaks from error message
    const sanitizedError = (err.message || 'SMTP delivery failed')
      .replace(new RegExp(config.email.smtpPass || '____', 'gi'), '******')
      .replace(new RegExp(config.jwtSecret || '____', 'gi'), '******');

    const error = new Error(`Email delivery failed: ${sanitizedError}`);
    error.statusCode = 502;
    error.originalCode = err.code;
    throw error;
  }
};

export default {
  isValidEmailAddress,
  getTransporter,
  setMockTransporter,
  resetTransporter,
  getEmailServiceStatus,
  sendMailAsync
};
