import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\pavit\\OneDrive\\Desktop\\grocerstock\\scratch\\cprof_debug';

const cp = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9339',
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], { stdio: 'ignore' });

setTimeout(async () => {
  try {
    const list = await (await fetch('http://127.0.0.1:9339/json/list')).json();
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.onopen = async () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Network.enable' }));
      ws.send(JSON.stringify({ 
        id: 4, 
        method: 'Page.navigate', 
        params: { url: 'https://grocerstock.vercel.app/retailer' } 
      }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE:', data.params.type, data.params.args.map(a => a.value || a.description || ''));
      }
      if (data.method === 'Network.responseReceived') {
        const url = data.params.response.url;
        const status = data.params.response.status;
        if (url.includes('tile') || url.includes('osm') || url.includes('carto') || url.includes('maptiler') || url.includes('arcgis')) {
          console.log('TILE/MAP RESPONSE:', status, url);
        }
      }
      if (data.method === 'Network.loadingFailed') {
        const url = data.params.url || '';
        if (url.includes('tile') || url.includes('osm') || url.includes('carto') || url.includes('maptiler') || url.includes('arcgis')) {
          console.log('TILE/MAP FAILED:', data.params.errorText, url);
        }
      }

      if (data.id === 4) {
        // Log in as retailer via localStorage and reload
        setTimeout(() => {
          const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYzkxZTUxMGY5MzcwMWVhNTY3YTVhOCIsImlhdCI6MTc5MTYwNDI3NSwiZXhwIjoxNzk0MTk2Mjc1fQ.et_EU6-nCrMUwDnFiYeHqX6vuAg8MzS-jpTDnMiayr4';
          const userObj = { _id: '6ac91e510f93701ea567a5a8', email: 'pavithraofficial2204@gmail.com', role: 'retailer', name: 'Pavithra Daily Fresh Groceries' };
          const expr = `
            localStorage.setItem('token', ${JSON.stringify(token)});
            localStorage.setItem('user', ${JSON.stringify(JSON.stringify(userObj))});
            window.location.href = 'https://grocerstock.vercel.app/retailer';
          `;
          ws.send(JSON.stringify({
            id: 5,
            method: 'Runtime.evaluate',
            params: { expression: expr }
          }));
        }, 1500);
      }

      if (data.id === 5) {
        // Wait for retailer page to load, then click "Supplier Map" tab
        setTimeout(() => {
          console.log('Switching to Supplier Map tab...');
          const clickTabExpr = `
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Supplier Map'));
            if (btn) { btn.click(); 'clicked'; } else { 'not found'; }
          `;
          ws.send(JSON.stringify({
            id: 6,
            method: 'Runtime.evaluate',
            params: { expression: clickTabExpr }
          }));
        }, 3000);
      }

      if (data.id === 6) {
        console.log('Clicked Supplier Map tab:', data.result.result.value);
        // Wait 4 seconds for map tiles to load
        setTimeout(() => {
          // Check map container and canvas state
          const checkMapExpr = `
            (() => {
              const canvas = document.querySelector('.maplibregl-canvas');
              const container = document.querySelector('.maplibregl-map');
              return {
                canvasExists: !!canvas,
                canvasWidth: canvas?.width,
                canvasHeight: canvas?.height,
                canvasStyle: canvas?.getAttribute('style'),
                containerHtml: container?.className,
                markers: document.querySelectorAll('.mapboxgl-marker, .maplibregl-marker').length
              };
            })()
          `;
          ws.send(JSON.stringify({
            id: 7,
            method: 'Runtime.evaluate',
            params: { expression: checkMapExpr, returnByValue: true }
          }));
        }, 4000);
      }

      if (data.id === 7) {
        console.log('MAP STATE:', data.result.result.value);
        setTimeout(() => {
          ws.close();
          cp.kill();
          process.exit(0);
        }, 1000);
      }
    };
  } catch (err) {
    console.error(err);
    cp.kill();
    process.exit(1);
  }
}, 2000);
