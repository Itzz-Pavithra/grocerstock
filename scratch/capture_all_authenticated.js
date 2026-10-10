import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Accounts & Tokens
const TOKENS = {
  retailer: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYzkxZTUxMGY5MzcwMWVhNTY3YTVhOCIsImlhdCI6MTc5MTYwNDI3NSwiZXhwIjoxNzk0MTk2Mjc1fQ.et_EU6-nCrMUwDnFiYeHqX6vuAg8MzS-jpTDnMiayr4',
    user: {
      _id: '6ac91e510f93701ea567a5a8',
      email: 'pavithraofficial2204@gmail.com',
      role: 'retailer',
      name: 'Pavithra Daily Fresh Groceries'
    }
  },
  admin: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYzk5YTU5ODZmYzNmZTkyOWVjMzMxYSIsImlhdCI6MTc5MTYwNDI3NSwiZXhwIjoxNzk0MTk2Mjc1fQ._R84Fy7U-CCHFqolXCc-3-JpqxAZbi7hYbYt8b1gUtw',
    user: {
      _id: '6ac99a5986fc3fe929ec331a',
      email: 'admin@grocery.com',
      role: 'admin',
      name: 'System Admin'
    }
  }
};

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\pavit\\OneDrive\\Desktop\\grocerstock\\scratch\\cprof_prod_shots';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        } catch (_) {}
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 15000);

      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function captureAll() {
  fs.mkdirSync(userDataDir, { recursive: true });
  const outDir = path.resolve('artifacts/grocerstock-feature-screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const port = 9339;
  console.log(`Launching Chrome on port ${port}...`);
  const cp = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1440,1000',
      '--disable-extensions',
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  await sleep(2500);

  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const pageTarget = list.find((t) => t.type === 'page');
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    async function setSessionAndNav(destUrl, accountKey) {
      await client.send('Page.navigate', { url: 'http://localhost:5173/auth' });
      await sleep(2000);
      const { token, user } = TOKENS[accountKey];
      await client.send('Runtime.evaluate', {
        expression: `
          localStorage.setItem('token', ${JSON.stringify(token)});
          localStorage.setItem('user', ${JSON.stringify(JSON.stringify(user))});
          document.cookie = 'token=' + encodeURIComponent(${JSON.stringify(token)}) + '; path=/; max-age=2592000; SameSite=Lax';
          window.location.href = '${destUrl}';
        `
      });
      await sleep(3500);
    }

    async function saveShot(fileName) {
      const res = await client.send('Page.captureScreenshot', { format: 'png' });
      const dest = path.join(outDir, fileName);
      fs.writeFileSync(dest, Buffer.from(res.data, 'base64'));
      console.log(`📸 SAVED: ${dest}`);
    }

    // -------------------------------------------------------------
    // 1. SMART STOCKOUT PREDICTION
    // -------------------------------------------------------------
    console.log('\n--- 1. Capturing Smart Stockout Prediction ---');
    await setSessionAndNav('/retailer', 'retailer');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent && b.textContent.includes('Stockout Predictions'));
          if (btn) btn.click();
        })()
      `
    });
    await sleep(2500);
    await saveShot('01-smart-stockout-prediction.png');

    // -------------------------------------------------------------
    // 2. PRICE INTELLIGENCE & QUOTATION COMPARISON
    // -------------------------------------------------------------
    console.log('\n--- 2. Capturing Price Intelligence & Quotation Comparison ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const quotesTab = btns.find(b => b.textContent && (b.textContent.includes('Quotations & Bids') || b.textContent.includes('Supplier Bids')));
          if (quotesTab) quotesTab.click();
        })()
      `
    });
    await sleep(2000);
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const compBtn = btns.find(b => b.textContent && (b.textContent.includes('Compare & Accept') || b.textContent.includes('Compare Quotations')));
          if (compBtn) compBtn.click();
        })()
      `
    });
    await sleep(2500);
    await saveShot('02-price-intelligence-comparison.png');

    // -------------------------------------------------------------
    // 3. SUPPLIER PERFORMANCE SCORECARD
    // -------------------------------------------------------------
    console.log('\n--- 3. Capturing Supplier Performance Scorecard ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const scoreBtn = btns.find(b => b.textContent && b.textContent.includes('Scorecard'));
          if (scoreBtn) scoreBtn.click();
        })()
      `
    });
    await sleep(2500);
    await saveShot('03-supplier-performance.png');

    // Close modals
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtns = Array.from(document.querySelectorAll('button'));
          closeBtns.forEach(b => {
            if (b.getAttribute('aria-label') === 'Close modal' || b.innerHTML.includes('lucide-x')) {
              b.click();
            }
          });
        })()
      `
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // 4. STORE PROFITABILITY ANALYSIS
    // -------------------------------------------------------------
    console.log('\n--- 4. Capturing Store Profitability Analysis ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const profTab = btns.find(b => b.textContent && (b.textContent.includes('Store Profitability') || b.textContent.includes('Profitability')));
          if (profTab) profTab.click();
        })()
      `
    });
    await sleep(2500);
    await saveShot('04-store-profitability.png');

    // -------------------------------------------------------------
    // 5. GROUP BUYING AND BULK DISCOUNTS
    // -------------------------------------------------------------
    console.log('\n--- 5. Capturing Group Buying and Bulk Discounts ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const gbTab = btns.find(b => b.textContent && b.textContent.includes('Group Buying'));
          if (gbTab) gbTab.click();
        })()
      `
    });
    await sleep(2500);
    await saveShot('05-group-buying.png');

    // -------------------------------------------------------------
    // 6. ADMIN BUSINESS VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 6. Capturing Admin Business Verification ---');
    await setSessionAndNav('/admin', 'admin');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const verTab = btns.find(b => b.textContent && b.textContent.includes('Business Verification'));
          if (verTab) verTab.click();
        })()
      `
    });
    await sleep(3000);
    await saveShot('06-admin-business-verification.png');

    client.close();
    console.log('\n🎉 ALL 6 FEATURE SCREENSHOTS CAPTURED WITH AUTHENTIC DATA!');
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    try { cp.kill(); } catch (_) {}
    process.exit(0);
  }
}

captureAll();
