# Alipay SDK
A flexible and lightweight SDK for building Alipay integrations with dynamic endpoints, caching, and response transformations.

[![npm](https://img.shields.io/npm/v/@nuecms/alipay-sdk)](https://www.npmjs.com/package/@nuecms/alipay-sdk)
[![GitHub](https://img.shields.io/github/license/nuecms/alipay-sdk)](https://www.github.com/nuecms/alipay-sdk)
[![GitHub issues](https://img.shields.io/github/issues/nuecms/alipay-sdk)](https://www.github.com/nuecms/alipay-sdk/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/nuecms/alipay-sdk)](https://www.github.com/nuecms/alipay-sdk/pulls)

---

## Introduction

Alipay SDK for Node.js provides the ability to call Alipay Open Platform APIs from a Node.js server.
It includes making OpenAPI requests to Alipay servers, generating order information, and supporting certificate, signing, and verification capabilities.

Based on the [Alipay API v3 specification](https://opendocs.alipay.com/open-v3/054oog).

## Requirements

- Node.js >= 18.0.0

---

## Features

- Pre-configured API endpoints for Alipay's platform
- Support for Redis and in-memory caching
- Easy extensibility

---

## Table of Contents

- [Alipay SDK](#alipay-sdk)
  - [Introduction](#introduction)
  - [Requirements](#requirements)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [1. Import and Initialize the SDK](#1-import-and-initialize-the-sdk)
    - [2. Register API Endpoints](#2-register-api-endpoints)
    - [3. Make API Calls](#3-make-api-calls)
    - [More](#more)
  - [Usage Examples](#usage-examples)
    - [Registering Endpoints](#registering-endpoints)
    - [Making API Calls](#making-api-calls)
    - [Demo Examples](#demo-examples)
      - [Using `exec`](#using-exec)
      - [Using `curl`](#using-curl)
      - [Using `pageExecute` for GET](#using-pageexecute-for-get)
      - [Using `pageExecute` for POST](#using-pageexecute-for-post)
  - [Differences from Official SDK](#differences-from-official-sdk)
    - [Feature Comparison](#feature-comparison)
    - [API Comparison](#api-comparison)
    - [Configuration Comparison](#configuration-comparison)
  - [Contributing](#contributing)
  - [License](#license)

---

## Installation

Install the SDK using `pnpm` or `yarn`:

```bash
pnpm add @nuecms/alipay-sdk
# or
yarn add @nuecms/alipay-sdk
```

---

## Quick Start

### 1. Import and Initialize the SDK

```typescript
import { alipaySdk } from '@nuecms/alipay-sdk';

const sdk = alipaySdk({
  appId: 'your-app-id',
  privateKey: 'your-private-key',
  alipayPublicKey: 'your-alipay-public-key',
  encryptKey: 'your-encrypt-key'
});
```

### 2. Register API Endpoints

```typescript
sdk.r('getUser', '/users/{id}', 'GET');
sdk.r('createUser', '/users', 'POST');
```

### 3. Make API Calls

```typescript
const user = await sdk.getUser({ id: '12345' });
console.log(user);
```

### More

See the testing code in the `tests` folder.

Example:

- [tests/server/alipay.ts](tests/server/alipay.ts)

---

## Usage Examples

### Registering Endpoints

Register endpoints with their HTTP method, path, and dynamic placeholders (e.g., `{id}`):

```typescript
sdk.r('getUser', '/users/{id}', 'GET');
sdk.r('deleteUser', '/users/{id}', 'DELETE');
sdk.r('createUser', '/users', 'POST');
```

### Making API Calls

Call the registered endpoints dynamically with placeholders and additional options:

```typescript
const userDetails = await sdk.getUser({ id: '12345' });

console.log(userDetails);
```

### Demo Examples

#### Using `exec`

```typescript
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
console.log(response);
```

#### Using `curl`

```typescript
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
console.log(response);
```

#### Using `pageExecute` for GET

```typescript
const paymentUrl = await sdk.pageExecute('alipay.trade.page.pay', 'GET', {
  bizContent: {
    out_trade_no: "202503121220010101001",
    total_amount: "88.88",
    subject: "Iphone6+16G",
    product_code: "FAST_INSTANT_TRADE_PAY",
  }
});
console.log(paymentUrl);
```

#### Using `pageExecute` for POST

```typescript
const formHtml = await sdk.pageExecute('alipay.trade.page.pay', 'POST', {
  bizContent: {
    out_trade_no: "202503111120010101001",
    total_amount: "88.88",
    subject: "Iphone6+16G PostTest",
    product_code: "FAST_INSTANT_TRADE PAY",
  },
});
console.log(formHtml);
```

---

## Differences from Official SDK

### Feature Comparison

| Feature                      | Official SDK | This SDK |
|------------------------------|--------------|----------|
| Dynamic Endpoints            | No           | Yes      |
| Caching                      | No           | Yes      |
| Response Transformations     | No           | Yes      |
| Server-Sent Events (SSE)     | Yes          | No       |
| Form Data Submissions        | Yes          | No       |

### API Comparison

| API Method                   | Official SDK | This SDK |
|------------------------------|--------------|----------|
| `exec`                       | Yes          | Yes      |
| `curl`                       | Yes          | Yes      |
| `pageExecute`                | Yes          | Yes      |
| `checkNotifySign`            | Yes          | Yes      |
| `aesEncrypt`                 | No           | Yes      |
| `aesDecrypt`                 | No           | Yes      |
| `signature`                  | Yes          | Yes      |
| `signatureV3`                | No           | Yes      |
| `getSignStr`                 | No           | Yes      |

### Configuration Comparison

| Configuration Option         | Official SDK | This SDK |
|------------------------------|--------------|----------|
| `appId`                      | Yes          | Yes      |
| `privateKey`                 | Yes          | Yes      |
| `alipayPublicKey`            | Yes          | Yes      |
| `signType`                   | Yes          | Yes      |
| `endpoint`                   | Yes          | Yes      |
| `timeout`                    | Yes          | Yes      |
| `camelcase`                  | Yes          | No       |
| `keyType`                    | Yes          | Yes      |
| `appCertPath`                | Yes          | No       |
| `appCertContent`             | Yes          | No       |
| `appCertSn`                  | Yes          | No       |
| `alipayRootCertPath`         | Yes          | No       |
| `alipayRootCertContent`      | Yes          | No       |
| `alipayRootCertSn`           | Yes          | No       |
| `alipayPublicCertPath`       | Yes          | No       |
| `alipayPublicCertContent`    | Yes          | No       |
| `alipayCertSn`               | Yes          | No       |
| `encryptKey`                 | No           | Yes      |
| `maxRetries`                 | No           | Yes      |
| `cacheProvider`              | No           | Yes      |
| `customResponseTransformer`  | No           | Yes      |
| `authCheckStatus`            | No           | Yes      |
| `wsServiceUrl`               | Yes          | No       |

---

## Contributing

We welcome contributions to improve this SDK! To get started:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m "Add feature X"`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

---

## License

This SDK is released under the **MIT License**. You’re free to use, modify, and distribute this project. See the `LICENSE` file for more details.

