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

  // 1. Full stockout predictions response
  const sp = await httpGet('/api/analytics/stockout-predictions', token);
  console.log('=== STOCKOUT PREDICTIONS ===');
  console.log(JSON.stringify(sp.body, null, 2).substring(0, 2000));

  // 2. Full requests response
  const reqs = await httpGet('/api/requests?status=responded', token);
  console.log('\n=== STOCK REQUESTS ===');
  if (reqs.body.requests) {
    for (const r of reqs.body.requests) {
      console.log(`Request ${r._id}: ${r.productName} - status: ${r.status} - responses: ${r.responsesCount}`);
    }
  }
  
  // 3. Get responses for a specific request
  if (reqs.body.requests?.length > 0) {
    const reqId = reqs.body.requests[0]._id;
    const responses = await httpGet('/api/responses/request/' + reqId, token);
    console.log(`\n=== RESPONSES for ${reqs.body.requests[0].productName} ===`);
    console.log(JSON.stringify(responses.body, null, 2).substring(0, 1500));
  }

  // 4. W1 inventory check
  const w1Login = await httpPost('/api/auth/login', { email: 'pavithra.workss@gmail.com', password: 'Pavithra@22' });
  const w1Token = w1Login.body.token;
  const w1Inv = await httpGet('/api/inventory', w1Token);
  console.log('\n=== W1 INVENTORY ===');
  console.log('Status:', w1Inv.status);
  console.log(JSON.stringify(w1Inv.body, null, 2).substring(0, 1000));

  // 5. Group buys
  const gb = await httpGet('/api/group-buys', token);
  console.log('\n=== GROUP BUYS ===');
  console.log('Status:', gb.status);
  if (gb.body?.groupBuys) {
    gb.body.groupBuys.forEach(g => console.log(` - ${g.title}: ${g.status}, committed: ${g.currentCommittedQuantity}/${g.targetMinQuantity}`));
  } else {
    console.log(JSON.stringify(gb.body).substring(0, 500));
  }
  
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
