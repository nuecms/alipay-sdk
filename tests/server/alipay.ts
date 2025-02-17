import http, { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { alipaySdk, RedisCacheProvider } from '../../src/lib/sdk';
import { Redis } from 'ioredis';


const routes = {
  'POST /alipay': async (req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      const params = new URLSearchParams(body);
      const sdk = alipaySdk({
        endpoint: 'https://openapi-sandbox.dl.alipaydev.com',
        appId: process.env.VITE_ALIPAY_APP_ID || '',
        privateKey: process.env.VITE_ALIPAY_PRIVATE_KEY || '',
        alipayPublicKey: process.env.VITE_ALIPAY_PUBLIC_KEY || '',
        cacheProvider: new RedisCacheProvider(new Redis()),
      });

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
  'GET /alipay': async (req, res) => {
    const sdk = alipaySdk({
      endpoint: 'https://openapi-sandbox.dl.alipaydev.com',
      appId: process.env.VITE_ALIPAY_APP_ID || '',
      privateKey: process.env.VITE_ALIPAY_PRIVATE_KEY || '',
      alipayPublicKey: process.env.VITE_ALIPAY_PUBLIC_KEY || '',
      cacheProvider: new RedisCacheProvider(new Redis()),
    });

    const paymentUrl = await sdk.pageExecute('alipay.trade.page.pay', 'GET', {
      bizContent: {
        out_trade_no: "20250320010101001",
        total_amount: "88.88",
        subject: "Iphone6+16G",
        product_code: "FAST_INSTANT_TRADE_PAY",
      },
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<a href="${paymentUrl}" target="_blank">Pay Now</a>`);
  },
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
