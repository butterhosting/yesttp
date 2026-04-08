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

const response = await new Yesttp().post('https://api.backend.com/users', {
  body: {
    name: 'Bob',
    age: 42,
  },
});

// Assuming the backend JSON response contains an `id` field
const userId = response.body.id;
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

## Instance Request API

```ts
yesttp.get('/users');

yesttp.post('/users', {
  // Request options
});
```

Here's an overview of the available request options:

```ts
export type GetOptions = {
  searchParams?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
};

export type RequestOptions = {
  searchParams?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: any;
  bodyRaw?: any;
};
```

## Instance Response API

```ts
const response = await yesttp.get<User>('/users/123');
```

Here, the response is an object with the following properties:

```ts
type Response<T> = {
  status: number;
  headers: Record<string, string>;
  body: T;
  bodyRaw: string;
};
```
