# Yesttp: Lightweight HTTP Client

This is a lightweight HTTP client, with basic support for request and response interceptors.

By default, it uses JSON serialization and deserialization for both request and response bodies.

## Installation

```
npm install yesttp

bun add yesttp
```

## Quick Example

```ts
import { Yesttp } from 'yesttp';

const response = await new Yesttp().post<{ id: string }>('https://api.backend.com/users', {
  body: {
    name: 'Bob',
    age: 42,
  },
});

const userId = response.json.id;
```

## Creating an instance

```ts
import { Yesttp } from 'yesttp';

const yesttp = new Yesttp();
```

The class can also be instantiated with a configuration object:

```ts
const yesttp = new Yesttp({
  baseUrl: 'https://api.backend.com',
  requestInterceptor: (request) => Promise.resolve(request),
  responseErrorIntercepter: (request, response) => Promise.reject({ request, response }),
  responseSuccessInterceptor: (request, response) => Promise.resolve(response),
});
```

## Request Options

```ts
yesttp.get('/users');

yesttp.post('/users', {
  // Request options
});
```

Here's an overview of the available request options:

```ts
// GET
type GetOptions = {
  responseType?: 'json' | 'text' | 'blob';
  responseErrorType?: 'json' | 'text' | 'blob';
  searchParams?: Record<string, any>;
  headers?: Record<string, string | undefined>;
  credentials?: "include" | "omit" | "same-origin";
};

// POST, PUT, PATCH, DELETE
export type RequestOptions = GetOptions & {
  body?: any;
  bodyRaw?: any;
};
```

## Response Types

The response shape depends on the `responseType` option. The default is `json`.

### JSON (default)

```ts
const response = await yesttp.get<User>('/users/123');

response.json; // User
response.status; // number
response.headers; // Record<string, string>
```

### Text

```ts
const response = await yesttp.get('/page', { responseType: 'text' });

response.text; // string
response.status; // number
response.headers; // Record<string, string>
```

### Blob

```ts
const response = await yesttp.get('/file', { responseType: 'blob' });

response.blob; // Blob
response.status; // number
response.headers; // Record<string, string>
```

TypeScript automatically infers the correct response type based on the `responseType` option.
