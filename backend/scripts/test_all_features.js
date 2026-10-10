import dns from 'dns';
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
import http from 'http';

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = { hostname: 'localhost', port: 5000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = http.request(opts, (res) => {
      let d = ''; res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
function httpGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method: 'GET', headers: token ? { Authorization: 'Bearer ' + token } : {} };
    const req = http.request(opts, (res) => {
      let d = ''; res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject); req.end();
  });
}

async function run() {
  const loginRes = await httpPost('/api/auth/login', { email: 'pavithraofficial2204@gmail.com', password: 'Pavithra@22' });
  const token = loginRes.body.token;

  // W1 user ID is 6ac91f9a412fc505ad2479d7
  // Test Feature 3 - Scorecard
  const score = await httpGet('/api/wholesalers/6ac91f9a412fc505ad2479d7/performance', token);
  console.log('=== FEATURE 3: SUPPLIER SCORECARD (W1) ===');
  console.log('Status:', score.status);
  console.log(JSON.stringify(score.body, null, 2).substring(0, 1500));

  // Test Feature 5 - Group Buys
  const gb = await httpGet('/api/group-buys', token);
  console.log('\n=== FEATURE 5: GROUP BUYING ===');
  console.log('Status:', gb.status);
  if (gb.body?.groupBuys) {
    gb.body.groupBuys.forEach(g => {
      console.log(`Title: ${g.title}`);
      console.log(`Status: ${g.status}, Committed: ${g.currentCommittedQuantity}/${g.targetMinQuantity}`);
      console.log(`Participants: ${g.participants?.length || 0}, Deadline: ${g.joiningDeadline}`);
      if (g.discountTiers) console.log('Tiers:', JSON.stringify(g.discountTiers));
    });
  } else {
    console.log(JSON.stringify(gb.body).substring(0, 600));
  }

  // Test admin panel endpoints
  const adminLogin = await httpPost('/api/auth/login', { email: 'admin@grocery.com', password: 'Pavithra@22' });
  console.log('\n=== ADMIN LOGIN ===');
  console.log('Status:', adminLogin.status, '| Success:', adminLogin.body.success, '| Role:', adminLogin.body.user?.role);
  
  if (adminLogin.body.success) {
    const adminToken = adminLogin.body.token;
    
    // Test verification list
    const verif = await httpGet('/api/admin/verification-requests', adminToken);
    console.log('\n=== FEATURE 6: BUSINESS VERIFICATION (Admin) ===');
    console.log('Status:', verif.status);
    console.log(JSON.stringify(verif.body, null, 2).substring(0, 1000));
    
    // Admin dashboard overview
    const adminStats = await httpGet('/api/admin/overview', adminToken);
    console.log('\n=== ADMIN OVERVIEW ===');
    console.log('Status:', adminStats.status);
    console.log(JSON.stringify(adminStats.body, null, 2).substring(0, 800));
  }

  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
