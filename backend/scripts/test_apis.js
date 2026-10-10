import dns from 'dns';
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

import http from 'http';

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: 'localhost', port: 5000,
      path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path, method: 'GET',
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== Testing GrocerStock APIs ===\n');

  // 1. Login as retailer
  const loginRes = await httpPost('/api/auth/login', {
    email: 'pavithraofficial2204@gmail.com',
    password: 'Pavithra@22'
  });
  if (!loginRes.body.success) {
    console.error('❌ Retailer login FAILED:', loginRes.body);
    process.exit(1);
  }
  const token = loginRes.body.token;
  console.log('✅ Retailer login SUCCESS. Role:', loginRes.body.user?.role);

  // 2. Stockout Predictions
  const sp = await httpGet('/api/analytics/stockout-predictions', token);
  console.log('\n--- Feature 1: Stockout Predictions ---');
  console.log('Status:', sp.status);
  if (sp.body?.predictions) {
    console.log('Predictions count:', sp.body.predictions.length);
    sp.body.predictions.slice(0, 3).forEach(p => {
      console.log(` - ${p.productName}: ${p.currentStock} ${p.unit} | Status: ${p.riskLevel} | Days to stockout: ${p.daysToStockout}`);
    });
  } else {
    console.log('Body:', JSON.stringify(sp.body).substring(0, 300));
  }

  // 3. Stock Requests (quotations comparison)
  const reqs = await httpGet('/api/requests?status=responded&page=1&limit=5', token);
  console.log('\n--- Feature 2: Quotations Comparison ---');
  console.log('Status:', reqs.status);
  if (reqs.body?.requests) {
    console.log('Active requests count:', reqs.body.requests.length);
    reqs.body.requests.forEach(r => {
      console.log(` - ${r.productName} (${r.status}): responsesCount=${r.responsesCount}`);
    });
  } else {
    console.log('Body:', JSON.stringify(reqs.body).substring(0, 300));
  }

  // 4. Profitability
  const prof = await httpGet('/api/analytics/retailer-profitability', token);
  console.log('\n--- Feature 4: Profitability P&L ---');
  console.log('Status:', prof.status);
  if (prof.body?.metrics) {
    const m = prof.body.metrics;
    console.log(' - Total Procurement Spend:', m.totalProcurementSpend);
    console.log(' - Delivered Orders Count:', m.deliveredOrdersCount);
    console.log(' - Sales Revenue:', m.salesRevenue);
    console.log(' - Gross Profit:', m.grossProfit);
  } else {
    console.log('Body:', JSON.stringify(prof.body).substring(0, 400));
  }

  // 5. Wholesaler 1 login & check inventory
  const w1Login = await httpPost('/api/auth/login', {
    email: 'pavithra.workss@gmail.com',
    password: 'Pavithra@22'
  });
  if (w1Login.body.success) {
    const w1Token = w1Login.body.token;
    console.log('\n✅ W1 login SUCCESS');
    const w1Inv = await httpGet('/api/wholesaler/inventory', w1Token);
    console.log('W1 Inventory count:', w1Inv.body?.inventory?.length ?? w1Inv.body?.length ?? 'unknown');
  }

  // 6. Admin login
  const adminLogin = await httpPost('/api/auth/login', {
    email: 'admin@grocerstock.com',
    password: 'Admin@123'
  });
  console.log('\nAdmin login:', adminLogin.body.success ? '✅ SUCCESS' : '❌ FAILED ('+adminLogin.body.message+')');

  console.log('\n✅ API tests complete.');
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
