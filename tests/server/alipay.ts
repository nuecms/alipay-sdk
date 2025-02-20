import http, { IncomingMessage as HttpIncomingMessage, ServerResponse } from 'http';

interface IncomingMessage extends HttpIncomingMessage {
  body?: any;
}
import { URL } from 'url';
import querystring from 'querystring';

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
    // log 通知参数
    const params = req.body;
    console.log(params);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('success');
  },
  'GET /return/alipay': async (req, res) => {
    // 可实现支付成功后跳转到商家页面的功能，而且跳转后的 return_url 页面的地址栏中会返回同步通知参数。
    // log  通知参数
    const url = new URL(req.url, 'http://localhost:3000');
    const params = Object.fromEntries(url.searchParams);
    console.log(params);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(JSON.stringify(params));
  },
  'GET /get/alipay': async (req, res) => {
    const paymentUrl = await sdk.pageExecute('alipay.trade.page.pay',{
      method: 'GET',
      bizContent: {
        out_trade_no: "202503121220010101901",
        total_amount: "88.88",
        subject: "Iphone6+16G Notify",
        product_code: "FAST_INSTANT_TRADE_PAY",
      },
      returnUrl: 'https://alipay-sdk-test.nuecms.com/return/alipay',
      notifyUrl: 'https://alipay-sdk-test.nuecms.com/notify/alipay',
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<a href="${paymentUrl}" target="_blank">Pay Now</a>`);
  },
  'GET /post/alipay': async (req, res) => {
    const formHtml = await sdk.pageExecute('alipay.trade.page.pay', 'POST', {
      bizContent: {
        out_trade_no: "202503111120010101003",
        total_amount: "88.88",
        subject: "Iphone6+16G P XXX",
        product_code: "FAST_INSTANT_TRADE_PAY",
      },
      returnUrl: 'https://alipay-sdk-test.nuecms.com/return/alipay',
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(formHtml);
  },
  'GET /curl/alipay': async (req, res) => {
    try {
      const response = await sdk.curl('POST', '/v3/alipay/trade/pay', {
        body: {
          "out_trade_no": "20250320221010105001",
          "total_amount": "88.88",
          "subject": "Iphone16 32G",
          // 二维码
          "auth_code": "285270892018294327",
          "scene": "bar_code",
          notify_url: 'https://alipay-sdk-test.nuecms.com/notify/alipay',

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
  if (req.method === 'POST') {
    let body = '';

    // Listen for data
    req.on('data', (chunk) => {
      body += chunk.toString(); // Convert Buffer to string
    });

    // Listen for end of data
    req.on('end', async () => {
      try {
        // Parse data based on Content-Type
        const contentType = req.headers['content-type'];

        let parsedData;
        if (contentType === 'application/json') {
          parsedData = JSON.parse(body);
        } else if (contentType === 'application/x-www-form-urlencoded') {
          parsedData = querystring.parse(body);
        } else {
          parsedData = body; // Return raw string for other types
        }

        // Attach parsed data to req.body
        req.body = parsedData;

        // Route the request
        for (const [key, value] of Object.entries(routes)) {
          const [method, path] = key.split(' ');
          if (req.method === method && req.url?.startsWith(path)) {
            return value(req, res);
          }
        }

        // Handle not found
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } catch (error) {
        // Handle parsing error
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid data format' }));
      }
    });
  } else {
    // Route the request
    for (const [key, value] of Object.entries(routes)) {
      const [method, path] = key.split(' ');
      if (req.method === method && req.url?.startsWith(path)) {
        value(req, res);
        return;
      }
    }

    // Handle not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// Create and start the server
const PORT: number = Number(process.env.PORT) || 3000;
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
