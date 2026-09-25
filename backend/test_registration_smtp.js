import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function testRegistrationEndpoint() {
  console.log('--- TESTING REGISTRATION ENDPOINT REACHABILITY & SMTP EMAIL SENDING ---');
  
  const testEmail = `smtp_test_${Date.now()}@example.com`;
  const payload = {
    email: testEmail,
    password: 'Password123!',
    role: 'retailer',
    storeName: 'Test SMTP Grocery Store',
    phone: '+91 9876543210',
    address: '123 Test Street'
  };

  console.log(`Sending POST request to ${API_BASE}/auth/register for email: ${testEmail}...`);

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Response Status Code:', response.status);
    console.log('Response Body:', data);

    if (response.status === 201 && data.success && data.requireOtp) {
      console.log('✅ POST http://localhost:5000/api/auth/register successfully reached Express and triggered OTP email!');
    } else {
      console.error('❌ Registration endpoint response unexpected:', response.status, data);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to reach registration endpoint:', err.message);
    process.exit(1);
  }
}

testRegistrationEndpoint().catch(console.error);
