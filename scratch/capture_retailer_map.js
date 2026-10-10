import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TOKENS = {
  retailer: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYzkxZTUxMGY5MzcwMWVhNTY3YTVhOCIsImlhdCI6MTc5MTYwNDI3NSwiZXhwIjoxNzk0MTk2Mjc1fQ.et_EU6-nCrMUwDnFiYeHqX6vuAg8MzS-jpTDnMiayr4',
    user: {
      _id: '6ac91e510f93701ea567a5a8',
      email: 'pavithraofficial2204@gmail.com',
      role: 'retailer',
      name: 'Pavithra Daily Fresh Groceries'
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
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER LOG]:', msg.params.type, msg.params.args.map(a => a.value || a.description || ''));
        }
        if (msg.method === 'Network.loadingFailed') {
          console.log('[NETWORK FAIL]:', msg.params.errorText, msg.params.url);
        }
        if (msg.method === 'Network.responseReceived') {
          const url = msg.params.response.url;
          if (url.includes('tile') || url.includes('osm') || url.includes('carto') || url.includes('arcgis')) {
            console.log('[TILE RESPONSE]:', msg.params.response.status, url);
          }
        }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
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

async function run() {
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9444',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1400,900',
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1500);

  try {
    const list = await fetchJson('http://127.0.0.1:9444/json/list');
    const page = list.find((t) => t.type === 'page');
    const client = new CDPClient(page.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    await client.send('Page.navigate', { url: 'http://localhost:5173/retailer' });
    await sleep(1000);

    // Inject token & reload
    await client.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('token', ${JSON.stringify(TOKENS.retailer.token)});
        localStorage.setItem('user', ${JSON.stringify(JSON.stringify(TOKENS.retailer.user))});
        location.reload();
      `
    });
    await sleep(2500);

    console.log('Clicking Supplier Map tab...');
    const clickRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const mapBtn = btns.find(b => b.textContent && b.textContent.includes('Supplier Map'));
          if (mapBtn) {
            mapBtn.click();
            return 'clicked';
          }
          return 'not found';
        })()
      `,
      returnByValue: true
    });
    console.log('Supplier Map button:', clickRes.result.value);

    await sleep(4000);

    const mapInspect = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const canvas = document.querySelector('.maplibregl-canvas');
          const container = document.querySelector('.maplibregl-map');
          const markers = document.querySelectorAll('.mapboxgl-marker, .maplibregl-marker');
          return {
            canvasFound: !!canvas,
            canvasW: canvas?.width,
            canvasH: canvas?.height,
            canvasClientW: canvas?.clientWidth,
            canvasClientH: canvas?.clientHeight,
            containerFound: !!container,
            markerCount: markers.length,
            errorNotice: document.querySelector('.text-rose-500')?.innerText || null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Map inspection:', mapInspect.result.value);

    // Capture screenshot
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('c:\\Users\\pavit\\OneDrive\\Desktop\\grocerstock\\scratch\\retailer_map_test.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot to scratch/retailer_map_test.png');

    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProcess.kill();
  }
}

run();
