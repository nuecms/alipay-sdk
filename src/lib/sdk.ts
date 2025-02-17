import { sdkBuilder, SdkBuilderConfig, RedisCacheProvider, CacheProvider } from '@nuecms/sdk-builder/src/index';
import { createSign, createVerify, randomUUID } from 'crypto';

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


export function signature(algorithm: string, signString: string, privateKey: string) {
  return createSign(algorithm)
    .update(signString, 'utf-8')
    .sign(privateKey, 'base64');
}

export function createAlipaySignature(
  params: SignParams,
  privateKey: string,
  signType: AlipaySdkSignType = 'RSA2'
): string {
  // 参数排序并格式化为 key=value 格式
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => {
      const value = Array.prototype.toString.call(params[key]) !== '[object String]'
        ? JSON.stringify(params[key])
        : params[key];
      return `${key}=${value}`;
    });

  const paramStr = sortedParams.join('&');
  try {
    return signature(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1', paramStr, privateKey);
  } catch (error) {
    console.error('Error creating signature:', error);
    throw new Error('Unsupported private key format or other signing error');
  }
}

export function signatureV3(signString: string, appPrivateKey: string) {
  return signature('RSA-SHA256', signString, appPrivateKey);
}

const formatDate = (date: Date) => {
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const createRequestId = () => {
  return randomUUID().replace(/-/g, '');
}

const encryptAndSignature = async (config: any, options: any) => {
  const requestId = options?.requestId ?? createRequestId();
  let headers = {
    'alipay-request-id': requestId,
    accept: 'application/json',
  } as any

  const httpMethod = options.method;
  const httpRequestUrl = options.path;

  const httpRequestBody = options?.body ? JSON.stringify(options.body) : '';
  const authString = `app_id=${config.appId},nonce=${randomUUID()},timestamp=${Date.now()}`;
  let signString = `${authString}\n${httpMethod}\n${httpRequestUrl}\n${httpRequestBody}\n`;
  const signature = signatureV3(signString, config.privateKey);
  const authorization = `ALIPAY-SHA256withRSA ${authString},sign=${signature}`;
  headers.authorization = authorization;

  options.headers = Object.assign(options.headers, headers)
  return options
}


const getSignatureFields = (config: any, method: string, bizParams: any) => {
  let fields =  {
    app_id: config.appId,
    method: method,
    charset: 'UTF-8',
    sign_type: config.signType || 'RSA2',
    timestamp: formatDate(new Date()),
    version: '1.0',
    ...bizParams
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

const customResponseTransformer = (response: any, context: any) => {
  let alipayResponse: Record<string, any>;
  const method = context.params.method;

  try {
    alipayResponse = JSON.parse(response);
  } catch (err) {
    throw new Error('Response data parsing error');
  }

  const responseKey = `${method.replaceAll('.', '_')}_response`;
  let data = alipayResponse[responseKey] ?? alipayResponse.error_response;
  return data
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
    customResponseTransformer: config.customResponseTransformer || customResponseTransformer,
    authCheckStatus: config.authCheckStatus || ((status, response, context) => {
      return false;
    })
  };

  const signer = (params: Record<string, any>) => createAlipaySignature(params, config.privateKey, config.signType)

  const sdk: AlipaySDK = sdkBuilder(sdkConfig);

  sdk.rx('reqInterceptor', async (config, params?: {}) => {
    const options = params as any;
    console.log('reqInterceptor options', options)
    // if is v3 url then encrypt and signature
    if (options.path.startsWith('/v3/')) {
      let x =  encryptAndSignature(config, options);
      console.log(x)
      return x;
    }
    return options;
  });

  sdk.rx('exec', async (config, method: string, params: Record<string, any>) => {
    let signedParams = {
      ...getSignatureFields(config, method, {
        format: 'JSON',
        biz_content: JSON.stringify(params?.bizContent)
      }),
    };
    signedParams.sign = signer(signedParams);
    signedParams.biz_content = JSON.stringify(params.bizContent)
    const { biz_content, ...execParams } = signedParams;
    const body = {
      biz_content
    }
    return sdk.post('/gateway.do', body, execParams);
  });

  sdk.rx('curl', async (config, httpMethod: string, path: string, options?: any) => {
    httpMethod = httpMethod.toUpperCase();
    return sdk.callApiWithoutEndpoint(path, httpMethod, options?.body, options.query);
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
      ...getSignatureFields(config, method, {
        biz_content: JSON.stringify(bizParams?.bizContent)
      }),
      alipaySdk: 'alipay-sdk',
    } as Record<string, string>;
    const signData = signer(signParams);
    const url = `${config.endpoint}/gateway.do`;
    const { method: x, bizContent, ...ebizParams } = bizParams || {};
    const execParams = {
      ...signParams,
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

