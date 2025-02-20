import { createSign, createCipheriv, createDecipheriv } from 'crypto';

export function signature(algorithm: string, signString: string, privateKey: string): string {
    return createSign(algorithm)
        .update(signString, 'utf-8')
        .sign(privateKey, 'base64');
}


export function signatureV3(signString: string, appPrivateKey: string) {
    return signature('RSA-SHA256', signString, appPrivateKey);
}

/**
 * 获取待签名字符串
 * @param originStr 原始字符串
 * @param responseKey 响应键
 */
export function getSignStr(originStr: string, responseKey: string): string {
    // 找到 xxx_response 开始的位置
    const startIndex = originStr.indexOf(`${responseKey}"`) + responseKey.length + 1;
    // 找到最后一个 “"sign"” 字符串的位置
    const lastIndex = originStr.lastIndexOf('"sign"');
    // 提取并清理待签名字符串
    let validateStr = originStr.substring(startIndex, lastIndex).trim();
    validateStr = validateStr.replace(/^[^{]*{/g, '{').replace(/\}([^}]*)$/g, '}');
    return validateStr;
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