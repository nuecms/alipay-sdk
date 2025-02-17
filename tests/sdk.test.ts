import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { alipaySdk } from '../src/lib/sdk';
import { RedisCacheProvider } from '@nuecms/sdk-builder';
import Redis from 'ioredis';

describe('Alipay SDK Tests', () => {
  const mockConfig = {
    appId: process.env.VITE_ALIPAY_APP_ID || 'mockAppId',
    privateKey: process.env.VITE_ALIPAY_PRIVATE_KEY || 'mockPrivateKey',
    alipayPublicKey: process.env.VITE_ALIPAY_PUBLIC_KEY || 'mockPublicKey',
    cacheProvider: new RedisCacheProvider(new Redis()),
  };

  let sdk: ReturnType<typeof alipaySdk>;

  beforeEach(() => {
    sdk = alipaySdk(mockConfig);
    // Mock API Response for getAccessToken
    const mockAccessTokenResponse = {
      access_token: 'mockAccessToken123',
      expires_in: 7200,
    };

    // Mock HTTP request
    vi.spyOn(sdk, 'getAccessToken').mockResolvedValue(mockAccessTokenResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize SDK correctly', () => {
    expect(sdk).toBeDefined();
    expect(typeof sdk.r).toBe('function');
  });

  it('should get an access token', async () => {
    const response = await sdk.getAccessToken({
      appid: mockConfig.appId,
      secret: mockConfig.privateKey,
      grant_type: 'client_credential',
    });
    expect(response.access_token).toBe('mockAccessToken123');
    expect(response.expires_in).toBe(7200);
  });

  it('should cache the access token', async () => {
    vi.spyOn(mockConfig.cacheProvider, 'get').mockResolvedValue({
      value: {
        access_token: 'mockAccessToken123',
      }
    });
    const cachedToken = await mockConfig.cacheProvider.get(`alipay_access_token_${mockConfig.appId}`);
    expect(cachedToken.value).toBeDefined();
    expect(cachedToken.value.access_token).toBe('mockAccessToken123');
  });


  it('should generate a payment URL', async () => {
    const paymentUrl = await sdk.pageExecute('alipay.trade.page.pay', 'GET', {
      bizContent: {
        out_trade_no: 'your-order-id',
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: '10.00',
        subject: 'Test Order',
      },
    });

    expect(paymentUrl).toContain('https://openapi.alipay.com/gateway.do');
    expect(paymentUrl).toContain('out_trade_no=your-order-id');
    expect(paymentUrl).toContain('total_amount=10.00');
  });

  it('should validate notification signatures', async () => {
    const mockParams = {
      sign: 'mockSignature',
      out_trade_no: 'your-order-id',
      trade_status: 'TRADE_SUCCESS',
    };

    vi.spyOn(sdk, 'checkNotifySign').mockResolvedValue(true);

    const isValid = await sdk.checkNotifySign(mockParams);
    expect(isValid).toBe(true);
  });

  it('should execute a curl request', async () => {
    const mockCurlResponse = {
      status: 'success',
      data: 'mockData',
    };

    vi.spyOn(sdk, 'curl').mockResolvedValue(mockCurlResponse);

    const response = await sdk.curl('GET', '/mock-endpoint', {
      query: { param1: 'value1' },
    });

    expect(response.status).toBe('success');
    expect(response.data).toBe('mockData');
  });

  it('should execute a custom API call', async () => {
    const mockApiResponse = {
      code: '10000',
      msg: 'Success',
      data: 'mockData',
    };

    vi.spyOn(sdk, 'execute').mockResolvedValue(mockApiResponse);

    const response = await sdk.execute('alipay.custom.api.call', {
      bizContent: {
        custom_param: 'value',
      },
    });

    expect(response.code).toBe('10000');
    expect(response.msg).toBe('Success');
    expect(response.data).toBe('mockData');
  });
});
