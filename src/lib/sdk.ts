import { sdkBuilder, SdkBuilderConfig, FetchContext, RedisCacheProvider, CacheProvider } from '@nuecms/sdk-builder/src/index';
import { createSign, createVerify, randomUUID, createCipheriv, createDecipheriv } from 'crypto'; // Updated import
import { debuglog } from 'util';
const debug = debuglog('alipay-sdk');

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
  /** AES 密钥，调用 AES 加解密相关接口时需要 */
  encryptKey?: string;
  cacheProvider?: CacheProvider;
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


export function signature(algorithm: string, signString: string, privateKey: string): string {
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
    const signString = Object.keys(params).sort()
    .map(key => {
      let data = params[key];
      if (Array.prototype.toString.call(data) !== '[object String]') {
        data = JSON.stringify(data);
      }
      return `${key}=${data}`;
    })
    .join('&');
  try {
    return signature(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1', signString, privateKey);
  } catch (error) {
    debug('Error creating signature:', error);
    throw new Error('Unsupported private key format or other signing error');
  }
}

export function signatureV3(signString: string, appPrivateKey: string) {
  return signature('RSA-SHA256', signString, appPrivateKey);
}

/**
 * 解析 AES 密钥和全零 IV
 * @param aesKey Base64 编码的 AES 密钥
 */
function parseKey(aesKey: string) {
  const keyBuffer = Buffer.from(aesKey, 'base64');
  const keyLength = keyBuffer.length;
  // 根据密钥长度确定算法名称 (AES-128/192/256)
  if (keyLength !== 16 && keyLength !== 24 && keyLength !== 32) {
    throw new Error('Invalid AES key length (must be 16/24/32 bytes)');
  }
  const algorithm = `aes-${keyLength * 8}-cbc`;
  // 16 字节全零 IV
  const iv = Buffer.alloc(16, 0);
  return { algorithm, key: keyBuffer, iv };
}

/**
 * AES 加密文本
 * @param plainText 明文
 * @param aesKey Base64 编码的 AES 密钥
 */
export function aesEncryptText(plainText: string, aesKey: string): string {
  const { algorithm, key, iv } = parseKey(aesKey);

  const cipher = createCipheriv(algorithm, key, iv);
  cipher.setAutoPadding(true); // 启用 PKCS7 填充 (对应 Java 的 PKCS5)

  let encrypted = cipher.update(plainText, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('base64');
}

/**
 * AES 解密文本
 * @param encryptedText Base64 编码的密文
 * @param aesKey Base64 编码的 AES 密钥
 */
export function aesDecryptText(encryptedText: string, aesKey: string): string {
  const { algorithm, key, iv } = parseKey(aesKey);

  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAutoPadding(true);
  const encryptedBuffer = Buffer.from(encryptedText, 'base64');
  let decrypted = decipher.update(encryptedBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * 加密对象数据
 * @param data 待加密对象
 * @param aesKey Base64 编码的 AES 密钥
 */
export function aesEncrypt(data: object, aesKey: string): string {
  const plainText = JSON.stringify(data);
  return aesEncryptText(plainText, aesKey);
}

/**
 * 解密数据到对象
 * @param encryptedText Base64 编码的密文
 * @param aesKey Base64 编码的 AES 密钥
 */
export function aesDecrypt(encryptedText: string, aesKey: string): object {
  const plainText = aesDecryptText(encryptedText, aesKey);
  return JSON.parse(plainText);
}

const formatDate = (date: Date) => {
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const createRequestId = () => {
  return randomUUID().replace(/-/g, '');
}

const sdkName = '@nuecms/alipay-sdk'

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

const isGateway = (path: string): boolean => path.startsWith('/gateway.do');
const isV3 = (path: string): boolean => path.startsWith('/v3/');

const encryptAndSignature = async (config: any, options: any) => {
  const requestId = options?.requestId ?? createRequestId();
  let headers = {
    'user-agent': sdkName,
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
    method: method,
    app_id: config.appId,
    charset: 'utf-8',
    version: '1.0',
    sign_type: config.signType || 'RSA2',
    timestamp: formatDate(new Date()),
    ...bizParams
  } as Record<string, any>;
  return fields
}


const customResponseTransformer = (responseData: any, context: FetchContext, response: Response) => {
  debug('customResponseTransformer', responseData, context, response)
  let alipayResponse: Record<string, any>;
  if (isGateway(context.path)) { // exec
    const method = context.params.method;
    try {
      alipayResponse = JSON.parse(responseData);
    } catch (err) {
      throw new Error('Response data parsing error');
    }
    const responseKey = `${method.replaceAll('.', '_')}_response`;
    let data = alipayResponse[responseKey] ?? alipayResponse.error_response;
    if (context.extParams?.needEncrypt) {
      if (typeof data === 'string') {
        data = aesDecrypt(data, context.config.encryptKey);
      } else {
        // 服务端解密错误，"sub_msg":"解密出错, 未知错误"
        // ignore
      }
    }
    return data
  }
  // v3
  if (isV3(context.path)) {
    const traceId = response.headers.get('alipay-trace-id') ?? context.headers['alipay-request-id'];
    try {
      if (context.extParams?.needEncrypt) {
        responseData = aesDecryptText(responseData, context.config.encryptKey);
        if (!responseData) {
          throw new Error('解密失败，请确认 config.encryptKey 设置正确');
        }
      }
      return {
        data: responseData,
        responseHttpStatus: response.status,
        traceId: traceId,
      }
    } catch (err) {
      throw new Error('Response data parsing error');
    }

  }
  return responseData;
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
    // maxRetries: 0,
    config: {
      appId: config.appId,
      privateKey: config.privateKey,
      signType: config.signType || 'RSA2',
      alipayPublicKey: config.alipayPublicKey,
      encryptKey: config.encryptKey,
      timeout: config.timeout || 10000,
      endpoint: config.endpoint || defualtEndpoint,
    },
    customResponseTransformer: config.customResponseTransformer || customResponseTransformer,
    authCheckStatus: config.authCheckStatus || ((status, response, context) => {
      return false;
    }),
    validateStatus: (status: number) => {
      return status >= 200 && status < 500;
    }
  };
  const sdk: AlipaySDK = sdkBuilder(sdkConfig);

  sdk.rx('reqInterceptor', async (config, options: any = {}) => {
    debug('reqInterceptor options', options)
    // if is v3 url then encrypt and signature
    if (isV3(options.path)) {
      let x =  encryptAndSignature(config, options);
      debug('reqInterceptor v3 after encryptAndSignature: ', x)
      return x;
    }
    return options;
  });

  sdk.rx('exec', async (config, method: string, params: Record<string, any>, options: any) => {
    let bizParams = {} as Record<string, any>;
    if (params.needEncrypt) {
      if (!config.encryptKey) {
        throw new TypeError('请设置 encryptKey 参数');
      }
      bizParams.encrypt_type = 'AES';
      bizParams.biz_content = aesEncrypt(
        params?.bizContent,
        config.encryptKey,
      );
    } else {
      bizParams.biz_content = JSON.stringify(params?.bizContent);
    }

    let signedParams = {
      ...getSignatureFields(config, method, {
        ...bizParams
      }),
    };
    // 全部字段加密
    signedParams.sign = createAlipaySignature(signedParams, config.privateKey, config.signType);
    const { biz_content, ...execParams } = signedParams;
    const body = {
      biz_content
    }
    return sdk.post('/gateway.do', { body, params: execParams, dataType: 'text', extParams: { needEncrypt: params.needEncrypt } });
  });

  sdk.rx('curl', async (config, method: string, path: string, options?: any) => {
    let contentType = 'application/json';
    let httpRequestBody = options?.body ? JSON.stringify(options.body) : '';
    let headers = {} as any
    if (options?.needEncrypt) {
      if (!config.encryptKey) {
        throw new TypeError('请配置 config.encryptKey 才能通过 needEncrypt = true 进行请求内容加密调用');
      }
      contentType = 'text/plain';
      httpRequestBody = aesEncryptText(httpRequestBody, config.encryptKey);
      headers['alipay-encryption-algm'] = 'AES';
      headers['alipay-encrypt-type'] = 'AES';
    }
    return sdk.callApiWithoutEndpoint(path, {
      method,
      body: options?.body,
      headers,
      params: options.query,
      contentType,
      stringifyBody: (body) => {
        return httpRequestBody;
      },
      extParams: { needEncrypt: options?.needEncrypt }
    });
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
      alipaySdk: sdkName,
    } as Record<string, string>;
    const signData = createAlipaySignature(signParams, config.privateKey, config.signType);
    const url = `${config.endpoint}/gateway.do`;
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

