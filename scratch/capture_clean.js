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
const userDataDir = 'C:\\Users\\pavit\\OneDrive\\Desktop\\grocerstock\\scratch\\cprof_clean';

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

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
        } catch (err) {}
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, 15000);

      this.pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
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

async function captureAllScreenshots() {
  fs.mkdirSync(userDataDir, { recursive: true });
  const outDir = path.resolve('artifacts/grocerstock-feature-screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const port = 9334;
  console.log(`Starting headless Chrome on port ${port}...`);
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1440,1000',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  await sleep(2500);

  try {
    const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = list.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found!');

    console.log('Connecting to page target:', pageTarget.url, pageTarget.webSocketDebuggerUrl);

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

    async function setSession(accountKey) {
      const { token, user } = TOKENS[accountKey];
      await client.send('Runtime.evaluate', {
        expression: `
          localStorage.setItem('token', ${JSON.stringify(token)});
          localStorage.setItem('user', ${JSON.stringify(JSON.stringify(user))});
          document.cookie = 'token=' + encodeURIComponent(${JSON.stringify(token)}) + '; path=/; max-age=2592000; SameSite=Lax';
        `
      });
    }

    async function navigateAndInject(url, accountKey) {
      await client.send('Page.navigate', { url: 'http://localhost:5173/auth' });
      await sleep(1500);
      await setSession(accountKey);
      await client.send('Page.navigate', { url });
      await sleep(2500);
    }

    async function takeScreenshot(fileName) {
      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });
      const filePath = path.join(outDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`📸 Saved screenshot: ${filePath}`);
    }

    // -------------------------------------------------------------------------
    // SCREENSHOT 1: Feature 1: Smart Stockout Prediction
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 1: Smart Stockout Prediction ---');
    await navigateAndInject('http://localhost:5173/retailer', 'retailer');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && b.textContent.includes('Stockout Predictions'));
          if (target) target.click();
        })()
      `
    });
    await sleep(2500);
    await takeScreenshot('01-smart-stockout-prediction.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 2: Feature 2: Price Intelligence & Quotation Comparison
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 2: Price Intelligence & Quotation Comparison ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && (b.textContent.includes('Quotations & Bids') || b.textContent.includes('Supplier Bids')));
          if (target) target.click();
        })()
      `
    });
    await sleep(2000);
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && (b.textContent.includes('Compare & Accept') || b.textContent.includes('Compare Quotations')));
          if (target) target.click();
        })()
      `
    });
    await sleep(2000);
    await takeScreenshot('02-price-intelligence-comparison.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 3: Feature 3: Supplier Performance Scorecard
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 3: Supplier Performance Scorecard ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && b.textContent.includes('Scorecard'));
          if (target) target.click();
        })()
      `
    });
    await sleep(2500);
    await takeScreenshot('03-supplier-performance.png');

    // Close open modals
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          btns.forEach(b => {
            if (b.getAttribute('aria-label') === 'Close modal' || b.innerHTML.includes('lucide-x')) {
              b.click();
            }
          });
        })()
      `
    });
    await sleep(1000);

    // -------------------------------------------------------------------------
    // SCREENSHOT 4: Feature 4: Store Profitability Analysis
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 4: Store Profitability Analysis ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && (b.textContent.includes('Store Profitability') || b.textContent.includes('Profitability')));
          if (target) target.click();
        })()
      `
    });
    await sleep(2500);
    await takeScreenshot('04-store-profitability.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 5: Feature 5: Group Buying and Bulk Discounts
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 5: Group Buying and Bulk Discounts ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && b.textContent.includes('Group Buying'));
          if (target) target.click();
        })()
      `
    });
    await sleep(2500);
    await takeScreenshot('05-group-buying.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 6: Feature 6: Admin Business Verification and Trust
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 6: Admin Business Verification ---');
    await navigateAndInject('http://localhost:5173/admin', 'admin');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent && b.textContent.includes('Business Verification'));
          if (target) target.click();
        })()
      `
    });
    await sleep(3000);
    await takeScreenshot('06-admin-business-verification.png');

    client.close();
    console.log('\n🎉 ALL 6 SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error during capture:', err);
  } finally {
    try { chromeProcess.kill(); } catch (_) {}
  }
}

captureAllScreenshots();
