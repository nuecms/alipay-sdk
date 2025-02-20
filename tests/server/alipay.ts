import http, { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

import { alipaySdk } from '../../src/lib/sdk';

const sdk = alipaySdk({
  endpoint: 'https://openapi-sandbox.dl.alipaydev.com',
  appId: process.env.VITE_ALIPAY_APP_ID || '',
  privateKey: process.env.VITE_ALIPAY_PRIVATE_KEY || '',
  alipayPublicKey: process.env.VITE_ALIPAY_PUBLIC_KEY || '',
  encryptKey: process.env.VITE_ALIPAY_ENCRYPT_KEY,
});

const routes = {
  'POST /notify/alipay': async (req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      const params = new URLSearchParams(body);
      const isValid = await sdk.checkNotifySign(Object.fromEntries(params));
      if (isValid) {
        // Handle the notification
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('success');
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('invalid sign');
      }
    });
  },
  'GET /get/alipay': async (req, res) => {
    const paymentUrl = await sdk.pageExecute('alipay.trade.page.pay', 'GET', {
      bizContent: {
        out_trade_no: "202503121220010101001",
        total_amount: "88.88",
        subject: "Iphone6+16G",
        product_code: "FAST_INSTANT_TRADE_PAY",
      }
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<a href="${paymentUrl}" target="_blank">Pay Now</a>`);
  },
  'GET /post/alipay': async (req, res) => {
    const formHtml = await sdk.pageExecute('alipay.trade.page.pay', 'POST', {
      bizContent: {
        out_trade_no: "202503111120010101001",
        total_amount: "88.88",
        subject: "Iphone6+16G PostTest",
        product_code: "FAST_INSTANT_TRADE_PAY",
      },
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(formHtml);
  },
  'GET /curl/alipay': async (req, res) => {
    try {
      const response = await sdk.curl('POST', '/v3/alipay/trade/pay', {
        body: {
          "out_trade_no": "20250320221010101001",
          "total_amount": "88.88",
          "subject": "Iphone6 16G",
          // 二维码
          "auth_code": "287960314702463767",
          "scene": "bar_code"
        }
      });
      console.log(response)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.log(error)
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(error.message);
    }
  },
  'GET /exec/alipay': async (req, res) => {
    try {
      const response = await sdk.exec("alipay.trade.pay", {
        bizContent: {
          out_trade_no: "201501320010101001",
          total_amount: "88.88",
          subject: "Iphone6 16G",
          auth_code: "287500643347427217",
          scene: "bar_code",
        }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.log(error)
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(error.message);
    }
  },
  'GET /encrypt/alipay': async (req, res) => {
    try {

      const response = await sdk.exec("alipay.trade.pay", {
        bizContent: {
          out_trade_no: "20150320010101001",
          total_amount: "88.88",
          subject: "Iphone6 16G",
          auth_code: "287500643347427217",
          scene: "bar_code",
        },
        needEncrypt: true
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.log(error)
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(error.message);
    }
  },
  'GET /validate/alipay': async (req, res) => {
    try {
      const response = await sdk.exec("alipay.trade.pay", {
        bizContent: {
          out_trade_no: "20150320010101001",
          total_amount: "88.88",
          subject: "Iphone6 16G",
          auth_code: "287500643347427217",
          scene: "bar_code",
        },
        validateSign: true
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.log(error)
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(error.message);
    }
  }

};

// Handle incoming requests
function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  for (const [key, value] of Object.entries(routes)) {
    const [method, path] = key.split(' ');
    if (req.method === method && req.url?.startsWith(path)) {
      value(req, res);
      return;
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// Create and start the server
const PORT: number = Number(process.env.PORT) || 3000;
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
