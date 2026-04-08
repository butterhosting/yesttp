export class Yesttp {
  private static get globalWindowFetch(): typeof fetch | undefined {
    if (typeof window !== "undefined" && window.fetch) return window.fetch.bind(window);
    if (typeof global !== "undefined" && global.fetch) return global.fetch.bind(global);
    return undefined;
  }

  private readonly baseUrl: string | undefined;
  private readonly credentials: RequestCredentials | undefined;
  private readonly fetchInstance: typeof fetch | undefined;
  private readonly requestInterceptor: Yesttp.RequestInterceptor;
  private readonly responseErrorInterceptor: Yesttp.ResponseErrorInterceptor;
  private readonly responseSuccessInterceptor: Yesttp.ResponseSuccessInterceptor;

  public constructor(
    {
      baseUrl = undefined,
      credentials = undefined,
      requestInterceptor = Yesttp.defaultRequestInterceptor,
      responseErrorIntercepter = Yesttp.defaultResponseErrorInterceptor,
      responseSuccessInterceptor = Yesttp.defaultResponseSuccessInterceptor,
    } = {} as Yesttp.ConstructorArgs,
  ) {
    this.baseUrl = baseUrl;
    this.credentials = credentials;
    this.fetchInstance = Yesttp.globalWindowFetch;
    this.requestInterceptor = requestInterceptor;
    this.responseErrorInterceptor = responseErrorIntercepter;
    this.responseSuccessInterceptor = responseSuccessInterceptor;
  }

  public get<T = any>(url: string, options = {} as Yesttp.GetOptions): Promise<Yesttp.Response<T>> {
    return this.makeRequest({ ...options, url, method: "GET" });
  }

  public post<T = any>(url: string, options = {} as Yesttp.RequestOptions): Promise<Yesttp.Response<T>> {
    return this.makeRequest({ ...options, url, method: "POST" });
  }

  public put<T = any>(url: string, options = {} as Yesttp.RequestOptions): Promise<Yesttp.Response<T>> {
    return this.makeRequest({ ...options, url, method: "PUT" });
  }

  public patch<T = any>(url: string, options = {} as Yesttp.RequestOptions): Promise<Yesttp.Response<T>> {
    return this.makeRequest({ ...options, url, method: "PATCH" });
  }

  public delete<T = any>(url: string, options = {} as Yesttp.RequestOptions): Promise<Yesttp.Response<T>> {
    return this.makeRequest({ ...options, url, method: "DELETE" });
  }

  private async makeRequest<T>(requestOptions: Yesttp.RequestSummary): Promise<Yesttp.Response<T>> {
    if (!this.fetchInstance) {
      throw new Error("[Yesttp] Could not find fetch function on `global` or `window`, please make it available there");
    }
    const options = await this.requestInterceptor({
      ...requestOptions,
      url: this.constructCompleteUrl(requestOptions),
      credentials: requestOptions.credentials || this.credentials,
      headers: this.removeUndefinedMappings({
        ...requestOptions.headers,
        "Content-Type": requestOptions.headers?.["Content-Type"] || (requestOptions.body ? "application/json" : undefined),
      }),
    });

    let response: Response;
    try {
      response = await this.fetchInstance(options.url, {
        method: options.method,
        headers: options.headers as Record<string, string>,
        body: options.body ? JSON.stringify(options.body) : options.bodyRaw,
        credentials: options.credentials,
      });
    } catch (e) {
      return this.responseErrorInterceptor(options, { status: 0, body: undefined, bodyRaw: undefined, headers: {} }, e);
    }
    return this.handleResponse(options, response);
  }

  private async handleResponse<T>(request: Yesttp.RequestSummary, fetchResponse: Response): Promise<Yesttp.Response<T>> {
    let text: string | undefined;
    let json: T | undefined;
    let invalidJsonResponse = false;
    try {
      text = await fetchResponse.text();
      if (typeof text !== "undefined") {
        json = JSON.parse(text);
      }
    } catch (ignored) {
      invalidJsonResponse = true;
    }
    const response: Yesttp.Response<T> = {
      headers: this.parseFetchHeaders(fetchResponse.headers || new Headers()),
      status: fetchResponse?.status,
      bodyRaw: text as string,
      get body(): T {
        if (invalidJsonResponse) {
          console.warn("[Yesttp] You're trying to access the response body as JSON, but it could not be parsed as such");
        }
        return json as T;
      },
    };

    // Success
    if (response.status >= 200 && response.status < 400) {
      return this.responseSuccessInterceptor(request, response);
    }

    // Error
    return this.responseErrorInterceptor(request, response);
  }

  private constructCompleteUrl({ url, searchParams }: Yesttp.RequestSummary): string {
    let completeUrl = "";
    if (url.match(/^https?:\/\//)) {
      completeUrl += url;
    } else {
      const baseUrl = this.baseUrl || "";
      const insertSlash = !baseUrl.endsWith("/") && !url.startsWith("/");
      const removeSlash = baseUrl.endsWith("/") && url.startsWith("/");
      if (removeSlash) {
        completeUrl = `${baseUrl.slice(0, -1)}${url}`;
      } else {
        completeUrl += `${baseUrl}${insertSlash ? "/" : ""}${url}`;
      }
    }
    const searchParamsStrippedOfUndefined = { ...searchParams } as Record<string, any>;
    Object.entries(searchParamsStrippedOfUndefined).forEach(([key, value]) => {
      if (typeof value === "undefined") {
        delete searchParamsStrippedOfUndefined[key];
      }
      searchParamsStrippedOfUndefined[key] = String(value);
    });
    const params = new URLSearchParams(searchParamsStrippedOfUndefined).toString();
    if (params) {
      completeUrl += `?${params}`;
    }
    return completeUrl;
  }

  private removeUndefinedMappings(obj: Record<string, string | undefined>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in obj) {
      const value = obj[key];
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }
    return result;
  }

  private parseFetchHeaders(fetchHeaders: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    fetchHeaders.forEach((value, key) => (result[key] = value));
    return result;
  }
}

export namespace Yesttp {
  export type RequestInterceptor = (request: RequestSummary) => Promise<RequestSummary>;
  export const defaultRequestInterceptor: RequestInterceptor = (request) => Promise.resolve(request);

  export type ResponseErrorInterceptor = (request: RequestSummary, response: ResponseWithOptionalBody, cause?: any) => Promise<any>;
  export const defaultResponseErrorInterceptor: ResponseErrorInterceptor = (request, response, cause) => {
    const error: Yesttp.ResponseError = { request, response };
    const errorArgs = ["[Yesttp] An HTTP error occurred", error];
    if (cause) errorArgs.push(cause);
    console.error(...errorArgs);
    throw error;
  };

  export type ResponseSuccessInterceptor = (request: RequestSummary, response: ResponseWithOptionalBody) => Promise<any>;
  export const defaultResponseSuccessInterceptor: Yesttp.ResponseErrorInterceptor = (request, response) => Promise.resolve(response);

  export type ConstructorArgs = {
    baseUrl?: string;
    credentials?: RequestCredentials;
    requestInterceptor?: RequestInterceptor;
    responseErrorIntercepter?: ResponseErrorInterceptor;
    responseSuccessInterceptor?: ResponseSuccessInterceptor;
  };

  export type GetOptions = {
    searchParams?: Record<string, any>;
    headers?: Record<string, string | undefined>;
    credentials?: RequestCredentials;
  };

  export type RequestOptions = GetOptions & {
    body?: any;
    bodyRaw?: any;
  };

  export type RequestSummary = RequestOptions & {
    url: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  };

  export type Response<T> = {
    status: number;
    headers: Record<string, string>;
    body: T;
    bodyRaw: string;
  };

  export type ResponseError = {
    request: RequestSummary;
    response: ResponseWithOptionalBody;
  };

  type ResponseWithOptionalBody = AllowUndefined<Response<any>, "body" | "bodyRaw">;

  type AllowUndefined<T, K extends keyof T> = Omit<T, K> & {
    [P in K]: T[K] | undefined;
  };
}
