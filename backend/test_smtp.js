import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function runSmtpTest() {
  console.log('--- BACKEND ENVIRONMENT DETECTED ---');
  console.log('PORT:', process.env.PORT || 5000);
  console.log('SMTP_HOST:', process.env.SMTP_HOST ? `DETECTED (${process.env.SMTP_HOST})` : 'MISSING');
  console.log('SMTP_PORT:', process.env.SMTP_PORT || '587');
  console.log('SMTP_USER:', process.env.SMTP_USER ? 'DETECTED' : 'MISSING');
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'DETECTED (HIDDEN)' : 'MISSING');
  console.log('------------------------------------\n');

  const isSecure = Number(process.env.SMTP_PORT) === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('Running transporter.verify()...');
  try {
    const verifyResult = await transporter.verify();
    console.log('✅ SMTP Connection/Authentication Successful:', verifyResult);
  } catch (verifyError) {
    console.error('❌ SMTP Connection/Authentication Failed:', verifyError.message);
    process.exit(1);
  }

  console.log('\nSending test email using sendMail()...');
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'Local Stock Grocery - SMTP Verification Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #FD6F2F;">Local Stock Grocery System</h2>
          <p>This is a verification test email confirming that your backend SMTP configuration is working correctly.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ sendMail() Succeeded!');
    console.log('Message ID returned:', info.messageId);
    console.log('Accepted Recipients:', info.accepted);
  } catch (sendError) {
    console.error('❌ sendMail() Failed:', sendError.message);
    process.exit(1);
  }
}

runSmtpTest().catch(console.error);
