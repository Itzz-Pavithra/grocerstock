import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function triggerGmailRegistration() {
  const email = 'pavithra.workss@gmail.com';
  console.log(`--- TRIGGERING REAL GMAIL REGISTRATION FOR ${email} ---`);

  const payload = {
    email: email,
    password: 'Password123!',
    role: 'retailer',
    storeName: 'Pavithra Grocery Store',
    phone: '+91 9876543210',
    address: '123 Main Street, City Center'
  };

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Status Code:', res.status);
    console.log('Response Data:', data);

    if (data.success && data.requireOtp) {
      console.log(`\n📬 Real OTP email successfully sent to ${email} via Gmail SMTP!`);
      console.log('Please check your Gmail inbox / spam folder for the 6-digit code.');
    } else {
      console.error('❌ Failed to trigger registration:', data);
    }
  } catch (err) {
    console.error('❌ Request error:', err.message);
  }
}

triggerGmailRegistration().catch(console.error);
