import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cp = spawn(chromePath, ['--headless=new', '--remote-debugging-port=9338', '--user-data-dir=C:\\Users\\pavit\\OneDrive\\Desktop\\grocerstock\\scratch\\cprof_debug', 'about:blank'], { stdio: 'ignore' });

setTimeout(async () => {
  try {
    const list = await (await fetch('http://127.0.0.1:9338/json/list')).json();
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.onopen = async () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Page.navigate', params: { url: 'http://localhost:5173/auth' } }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('BROWSER LOG:', data.params.type, data.params.args.map(a => a.value || a.description));
      }
      if (data.id === 4) {
        setTimeout(() => {
          const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYzkxZTUxMGY5MzcwMWVhNTY3YTVhOCIsImlhdCI6MTc5MTYwNDI3NSwiZXhwIjoxNzk0MTk2Mjc1fQ.et_EU6-nCrMUwDnFiYeHqX6vuAg8MzS-jpTDnMiayr4';
          const userObj = { _id: '6ac91e510f93701ea567a5a8', email: 'pavithraofficial2204@gmail.com', role: 'retailer', name: 'Pavithra' };
          const expr = `
            localStorage.setItem('token', ${JSON.stringify(token)});
            localStorage.setItem('user', ${JSON.stringify(JSON.stringify(userObj))});
            window.location.href = '/retailer';
          `;
          ws.send(JSON.stringify({
            id: 5,
            method: 'Runtime.evaluate',
            params: { expression: expr }
          }));
        }, 1500);
      }
      if (data.id === 5) {
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 6,
            method: 'Runtime.evaluate',
            params: { expression: 'document.body.innerText' }
          }));
        }, 4000);
      }
      if (data.id === 6) {
        console.log('PAGE BODY TEXT:\n', data.result.result.value);
        ws.close();
        cp.kill();
        process.exit(0);
      }
    };
  } catch (err) {
    console.error(err);
    cp.kill();
    process.exit(1);
  }
}, 2500);
