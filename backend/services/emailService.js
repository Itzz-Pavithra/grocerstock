import nodemailer from 'nodemailer';

let transporter = null;

export const initTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT) || 465;

  if (!host || !user || !pass) {
    throw new Error('Email service is not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS/SMTP_PASSWORD).');
  }

  const isSecure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
};

export const sendOtpEmail = async (email, otp) => {
  const mailer = initTransporter();
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL;
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;
  const expiry = process.env.OTP_EXPIRY_MINUTES || 10;

  const htmlContent = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #FFFBF5; border-radius: 16px; border: 1px solid #E6E4D9;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #FD6F2F; margin: 0; font-size: 26px;">Local Stock Grocery</h1>
        <p style="color: #515739; margin-top: 4px; font-size: 14px; font-weight: 600;">B2B Supply Chain & Grocery Management</p>
      </div>

      <div style="background-color: #FFFFFF; padding: 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #E6E4D9;">
        <h2 style="color: #2A2E1D; margin-top: 0; font-size: 20px;">Email Verification Required</h2>
        <p style="color: #515739; font-size: 15px; line-height: 1.5;">
          Thank you for signing up with Local Stock Grocery! Please use the following 6-digit verification code to complete your registration.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <span style="display: inline-block; background-color: #FFEAD1; color: #FD6F2F; letter-spacing: 8px; font-size: 32px; font-weight: 800; padding: 14px 28px; border-radius: 10px; border: 2px dashed #FD6F2F;">
            ${otp}
          </span>
        </div>

        <p style="color: #515739; font-size: 13px; line-height: 1.4;">
          ⏱️ This OTP is valid for <strong>${expiry} minutes</strong>. For security, do not share this code with anyone.
        </p>
      </div>

      <div style="text-align: center; margin-top: 24px; color: #515739; font-size: 12px;">
        &copy; ${new Date().getFullYear()} Local Stock Grocery System. All rights reserved.
      </div>
    </div>
  `;

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: email,
      subject: `${otp} is your Local Stock Grocery verification code`,
      html: htmlContent,
    });
    return info;
  } catch (error) {
    console.error('❌ SMTP Email Delivery Failure:', error.message);
    throw new Error('Unable to send verification email. Please try again.');
  }
};
