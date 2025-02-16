# **Alipay SDK**

>> WIP

A flexible and lightweight SDK for building Alipay integrations with dynamic endpoints, caching, and response transformations.

[![npm](https://img.shields.io/npm/v/@nuecms/alipay-sdk)](https://www.npmjs.com/package/@nuecms/alipay-sdk)
[![GitHub](https://img.shields.io/github/license/nuecms/alipay-sdk)](https://www.github.com/nuecms/alipay-sdk)
[![GitHub issues](https://img.shields.io/github/issues/nuecms/alipay-sdk)](https://www.github.com/nuecms/alipay-sdk/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/nuecms/alipay-sdk)](https://www.github.com/nuecms/alipay-sdk/pulls)

---

## **Features**

- Pre-configured API endpoints for Alipay's platform
- Support for Redis and in-memory caching
- Easy extensibility

---

## **Table of Contents**

- [**Alipay SDK**](#alipay-sdk)
  - [**Features**](#features)
  - [**Table of Contents**](#table-of-contents)
  - [**Installation**](#installation)
  - [**Quick Start**](#quick-start)
    - [1. Import and Initialize the SDK Builder](#1-import-and-initialize-the-sdk-builder)
    - [2. Register API Endpoints](#2-register-api-endpoints)
    - [3. Make API Calls](#3-make-api-calls)
    - [More](#more)
  - [**Usage Examples**](#usage-examples)
    - [Registering Endpoints](#registering-endpoints)
    - [Making API Calls](#making-api-calls)
  - [**Contributing**](#contributing)
  - [**License**](#license)

---

## **Installation**

Install the SDK using `pnpm` or `yarn`:

```bash
pnpm add @nuecms/alipay-sdk
# or
yarn add @nuecms/alipay-sdk
```

---

## **Quick Start**

### 1. Import and Initialize the SDK Builder

```typescript
import { alipaySdk } from '@nuecms/alipay-sdk';

const sdk = alipaySdk({
  appId: 'your-app-id',
  privateKey: 'your-private-key',
  cacheProvider: new RedisCacheProvider(),
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

## **Usage Examples**

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

---

## **Contributing**

We welcome contributions to improve this SDK! To get started:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m "Add feature X"`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

---

## **License**

This SDK is released under the **MIT License**. You’re free to use, modify, and distribute this project. See the `LICENSE` file for more details.

