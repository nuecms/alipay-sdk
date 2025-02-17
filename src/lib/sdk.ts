import { sdkBuilder, SdkBuilderConfig, RedisCacheProvider, CacheProvider } from '@nuecms/sdk-builder';
import { createSign, createVerify } from 'crypto';

export type AlipaySdkSignType = 'RSA2' | 'RSA';

interface AlipaySDKConfig {
  /** 应用ID */
  appId: string;
  /** 应用私钥字符串。RSA签名验签工具：https://docs.open.alipay.com/291/106097）*/
  privateKey: string;
  /** 签名种类，默认是 RSA2 */
  signType?: AlipaySdkSignType;
  /** 支付宝公钥（需要对返回值做验签时候必填） */
  alipayPublicKey?: string;
  /** V3 endpoint, default is https://openapi.alipay.com */
  endpoint?: string;
  /** 网关超时时间（单位毫秒，默认 5000） */
  timeout?: number;
  /**
   * 指定 private key 类型, 默认：PKCS1
   * - PKCS8: PRIVATE KEY
   * - PKCS1: RSA PRIVATE KEY
   */
  keyType?: 'PKCS1' | 'PKCS8';
  cacheProvider: CacheProvider;
  customResponseTransformer?: (response: any) => any;
  authCheckStatus?: (status: number, response: any) => boolean;
}

export {
  RedisCacheProvider,
  type CacheProvider,
  type AlipaySDKConfig,
}

export type AlipaySDK = ReturnType<typeof sdkBuilder>

export interface SignParams {
  [key: string]: string | Record<string, unknown>;
}

export interface IRequestParams {
  [key: string]: any;
  /** 业务请求参数 */
  bizContent?: Record<string, any>;
}

export type IPageExecuteMethod = 'GET' | 'POST';

export interface IPageExecuteParams extends IRequestParams {
  method?: IPageExecuteMethod;
}

export function createAlipaySignature(
  params: SignParams,
  privateKey: string,
  signType: AlipaySdkSignType = 'RSA2'
): string {
  console.log('createAlipaySignature', params, privateKey, signType)
  // 参数排序并格式化为 key=value 格式
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => {
      const value = typeof params[key] === 'object'
        ? JSON.stringify(params[key])
        : params[key];
      return `${key}=${value}`;
    });

  const paramStr = sortedParams.join('&');

  // 创建签名对象
  const signer = createSign(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
  try {
    signer.update(paramStr, 'utf8');
    // 生成Base64签名
    return signer.sign(privateKey, 'base64');
  } catch (error) {
    console.error('Error creating signature:', error);
    throw new Error('Unsupported private key format or other signing error');
  }
}

const encryptAndSignature = async (config: any, options: any) => {
  const requestId = options?.requestId ?? Math.random().toString(36).substring(7);
  let headers = {
    'user-agent': 'alipay-sdk',
    'alipay-request-id': requestId,
    accept: 'application/json',
  } as any

  const httpMethod = options.method;
  const httpRequestUrl = options.path;

  const httpRequestBody = options?.body ? JSON.stringify(options.body) : '';

  const authString = `app_id=${config.appId},nonce=${Math.random().toString(36).substring(7)},timestamp=${Date.now()}`;
  let signString = `${authString}\n${httpMethod}\n${httpRequestUrl}\n${httpRequestBody}\n`;
  const signature = createAlipaySignature({ signString }, config.privateKey, config.signType);
  const authorization = `ALIPAY-SHA256withRSA ${authString},sign=${signature}`;
  headers.authorization = authorization;

  options.headers = Object.assign(options.headers, headers)

  return options
}

const formatDate = (date: Date) => {
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const getSignatureFields = (config: any, method: string, bizParams: any) => {
  let fields =  {
    app_id: config.appId,
    method: method,
    charset: 'UTF-8',
    sign_type: config.signType || 'RSA2',
    timestamp: formatDate(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizParams.bizContent),
    // notify_url: config.notifyUrl,
    // return_url: config.returnUrl,
  } as Record<string, any>;
  // filter underfiend

  return fields
}

const defualtEndpoint = 'https://openapi.alipay.com';

const formatKey = (key: string, type: string): string => {
  const item = key.split('\n').map(val => val.trim());

  // 删除包含 `RSA PRIVATE KEY / PUBLIC KEY` 等字样的第一行
  if (item[0].includes(type)) { item.shift(); }

  // 删除包含 `RSA PRIVATE KEY / PUBLIC KEY` 等字样的最后一行
  if (item[item.length - 1].includes(type)) {
    item.pop();
  }

  return `-----BEGIN ${type}-----\n${item.join('')}\n-----END ${type}-----`;
}

export function alipaySdk(config: AlipaySDKConfig): AlipaySDK {
  const privateKeyType = config.keyType === 'PKCS8' ? 'PRIVATE KEY' : 'RSA PRIVATE KEY';
  config.privateKey = formatKey(config.privateKey, privateKeyType);

  if (config.alipayPublicKey) {
    config.alipayPublicKey = formatKey(config.alipayPublicKey, 'PUBLIC KEY');
  }

  const sdkConfig: SdkBuilderConfig = {
    baseUrl: config.endpoint || defualtEndpoint,
    cacheProvider: config.cacheProvider,
    placeholders: {
      access_token: '{access_token}',
    },
    config: {
      appId: config.appId,
      privateKey: config.privateKey,
      signType: config.signType || 'RSA2',
      alipayPublicKey: config.alipayPublicKey,
      timeout: config.timeout || 5000,
      endpoint: config.endpoint || defualtEndpoint,
    },
    customResponseTransformer: config.customResponseTransformer || ((response: any) => {
      return response;
    }),
    authCheckStatus: config.authCheckStatus || ((status, response) => {
      return status === 401 || ((response as any)?.code === '40001');
    })
  };

  const signer = (params: Record<string, any>) => createAlipaySignature(params, config.privateKey, config.signType)

  const sdk: AlipaySDK = sdkBuilder(sdkConfig);

  sdk.rx('reqInterceptor', async (config, params?: {}) => {
    const options = params as any;
    // if is v3 url then encrypt and signature
    if (options.path.startsWith('/v3/')) {
      return encryptAndSignature(config, options);
    }
    return options;
  });

  sdk.rx('execute', async (config, method: string, params: Record<string, any>) => {
    const signedParams = {
      ...params,
      ...getSignatureFields(config, method, params),
    };
    signedParams.sign = signer(signedParams);
    const response = await sdk.post('/gateway.do', params, signedParams);
    return response;
  });

  sdk.rx('curl', async (config, httpMethod: string, path: string, options?: any) => {
    httpMethod = httpMethod.toUpperCase();
    const response = await sdk.callApiWithoutEndpoint(path, httpMethod, options.body, options.query);
    return response;
  });

  sdk.rx('pageExecute', async (config, method: string, httpMethodOrParams: IPageExecuteMethod | IPageExecuteParams, bizParams?: IPageExecuteParams) => {
    let httpMethod = '';
    if (typeof httpMethodOrParams === 'string') {
      httpMethod = httpMethodOrParams;
    } else if (typeof httpMethodOrParams === 'object') {
      bizParams = httpMethodOrParams;
    }
    if (!httpMethod && bizParams?.method) {
      httpMethod = bizParams.method;
      delete bizParams.method;
    }

    const signParams = {
      ...getSignatureFields(config, method, bizParams),
      alipaySdk: 'alipay-sdk',
    } as Record<string, string>;
    const signData = signer(signParams);
    const url = `${config.endpoint}/gateway.do`;
    const { method: x, bizContent, ...ebizParams } = bizParams || {};
    const execParams = {
      ...signParams,
      biz_content: JSON.stringify(bizContent),
      sign: signData,
    } as Record<string, string>;
    if (httpMethod === 'GET') {
      const query = Object.keys(execParams).map(key => {
        return `${key}=${encodeURIComponent(execParams[key])}`;
      });
      return `${url}?${query.join('&')}`;
    }

    const formName = `alipaySDKSubmit${Date.now()}`;
    return (`
      <form action="${url}" method="post" name="${formName}" id="${formName}">
        ${Object.keys(execParams).map(key => {
        const value = String(execParams[key]).replace(/\"/g, '&quot;');
        return `<input type="hidden" name="${key}" value="${value}" />`;
      }).join('')}
      </form>
      <script>document.forms["${formName}"].submit();</script>
    `);
  });

  sdk.rx('checkNotifySign', async (config, params: Record<string, any>) => {
    const sign = params.sign;
    delete params.sign;
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => {
        const value = typeof params[key] === 'object'
          ? JSON.stringify(params[key])
          : params[key];
        return `${key}=${value}`;
      });

    const paramStr = sortedParams.join('&');
    const verifier = createVerify(config.signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
    verifier.update(paramStr, 'utf8');
    return verifier.verify(config.alipayPublicKey, sign, 'base64');
  });

  return sdk;
}

