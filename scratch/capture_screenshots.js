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
const userDataDir = 'C:\\Users\\pavit\\OneDrive\\Desktop\\grocerstock\\scratch\\chrome_capture_profile';

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
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function captureAllScreenshots() {
  fs.mkdirSync(userDataDir, { recursive: true });
  const outDir = path.resolve('artifacts/grocerstock-feature-screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const port = 9333;
  console.log(`Starting headless Chrome on remote debugging port ${port}...`);
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1440,1000',
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  await sleep(2000);

  try {
    const versionInfo = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    console.log('Chrome Browser WebSocket:', versionInfo.webSocketDebuggerUrl);

    const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = list.find((t) => t.type === 'page') || list[0];
    console.log('Connecting to page target:', pageTarget.title, pageTarget.webSocketDebuggerUrl);

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

    // Helper to inject session into page
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
      await client.send('Page.navigate', { url });
      await sleep(1500);
      await setSession(accountKey);
      await client.send('Page.navigate', { url });
      await sleep(2000);
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
    // Retailer page -> Stockout tab
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 1: Smart Stockout Prediction ---');
    await navigateAndInject('http://localhost:5173/retailer', 'retailer');
    await client.send('Runtime.evaluate', {
      expression: `
        // Click stockout tab in sidebar or switch state
        const btns = Array.from(document.querySelectorAll('button'));
        const stockoutBtn = btns.find(b => b.textContent && b.textContent.includes('Stockout Predictions'));
        if (stockoutBtn) stockoutBtn.click();
      `
    });
    await sleep(2000);
    await takeScreenshot('01-smart-stockout-prediction.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 2: Feature 2: Price Intelligence and Supplier Comparison
    // Retailer page -> Quotations & Bids tab -> Compare Quotations
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 2: Price Intelligence & Quotation Comparison ---');
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const quotesTab = btns.find(b => b.textContent && (b.textContent.includes('Quotations & Bids') || b.textContent.includes('Supplier Bids')));
        if (quotesTab) quotesTab.click();
      `
    });
    await sleep(1500);
    // Open Compare & Accept modal for the Rice request
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const compBtn = btns.find(b => b.textContent && (b.textContent.includes('Compare & Accept') || b.textContent.includes('Compare Quotations')));
        if (compBtn) compBtn.click();
      `
    });
    await sleep(1500);
    await takeScreenshot('02-price-intelligence-comparison.png');

    // Close any modal
    await client.send('Runtime.evaluate', {
      expression: `
        const closeBtn = document.querySelector('button[aria-label="Close modal"]') || document.querySelector('button:has(svg.lucide-x)');
        if (closeBtn) closeBtn.click();
      `
    });
    await sleep(500);

    // -------------------------------------------------------------------------
    // SCREENSHOT 3: Feature 3: Supplier Performance Scorecard
    // Open Supplier Scorecard Modal for Pavithra Wholesale Traders
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 3: Supplier Performance Scorecard ---');
    // We can open the compare modal again and click "Scorecard"
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const compBtn = btns.find(b => b.textContent && (b.textContent.includes('Compare & Accept') || b.textContent.includes('Compare Quotations')));
        if (compBtn) compBtn.click();
      `
    });
    await sleep(1000);
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const scoreBtn = btns.find(b => b.textContent && b.textContent.includes('Scorecard'));
        if (scoreBtn) scoreBtn.click();
      `
    });
    await sleep(1500);
    await takeScreenshot('03-supplier-performance.png');

    // Close modals
    await client.send('Runtime.evaluate', {
      expression: `
        const closeBtns = document.querySelectorAll('button:has(svg.lucide-x)');
        closeBtns.forEach(b => b.click());
      `
    });
    await sleep(800);

    // -------------------------------------------------------------------------
    // SCREENSHOT 4: Feature 4: Store Profitability Analysis
    // Retailer page -> Store Profitability tab
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 4: Store Profitability Analysis ---');
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const profTab = btns.find(b => b.textContent && (b.textContent.includes('Store Profitability') || b.textContent.includes('Profitability')));
        if (profTab) profTab.click();
      `
    });
    await sleep(2000);
    await takeScreenshot('04-store-profitability.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 5: Feature 5: Group Buying and Bulk Discounts
    // Retailer page -> Group Buying tab
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 5: Group Buying and Bulk Discounts ---');
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const gbTab = btns.find(b => b.textContent && b.textContent.includes('Group Buying'));
        if (gbTab) gbTab.click();
      `
    });
    await sleep(2000);
    await takeScreenshot('05-group-buying.png');

    // -------------------------------------------------------------------------
    // SCREENSHOT 6: Feature 6: Admin Business Verification and Trust
    // Admin page -> Business Verification tab
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Screen 6: Admin Business Verification ---');
    await navigateAndInject('http://localhost:5173/admin', 'admin');
    await client.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const verTab = btns.find(b => b.textContent && b.textContent.includes('Business Verification'));
        if (verTab) verTab.click();
      `
    });
    await sleep(2500);
    await takeScreenshot('06-admin-business-verification.png');

    client.close();
    console.log('\n🎉 ALL 6 SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error during capture:', err);
  } finally {
    chromeProcess.kill();
  }
}

captureAllScreenshots();
