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

  public get(url: string, options: Yesttp.GetOptions & { responseType: "blob" }): Promise<Yesttp.BlobResponse>;
  public get(url: string, options: Yesttp.GetOptions & { responseType: "text" }): Promise<Yesttp.TextResponse>;
  public get<T = any>(url: string, options?: Yesttp.GetOptions): Promise<Yesttp.JsonResponse<T>>;
  public get(url: string, options: Yesttp.GetOptions = {}): Promise<any> {
    return this.makeRequest({ ...options, url, method: "GET" });
  }

  public post(url: string, options: Yesttp.RequestOptions & { responseType: "blob" }): Promise<Yesttp.BlobResponse>;
  public post(url: string, options: Yesttp.RequestOptions & { responseType: "text" }): Promise<Yesttp.TextResponse>;
  public post<T = any>(url: string, options?: Yesttp.RequestOptions): Promise<Yesttp.JsonResponse<T>>;
  public post(url: string, options: Yesttp.RequestOptions = {}): Promise<any> {
    return this.makeRequest({ ...options, url, method: "POST" });
  }

  public put(url: string, options: Yesttp.RequestOptions & { responseType: "blob" }): Promise<Yesttp.BlobResponse>;
  public put(url: string, options: Yesttp.RequestOptions & { responseType: "text" }): Promise<Yesttp.TextResponse>;
  public put<T = any>(url: string, options?: Yesttp.RequestOptions): Promise<Yesttp.JsonResponse<T>>;
  public put(url: string, options: Yesttp.RequestOptions = {}): Promise<any> {
    return this.makeRequest({ ...options, url, method: "PUT" });
  }

  public patch(url: string, options: Yesttp.RequestOptions & { responseType: "blob" }): Promise<Yesttp.BlobResponse>;
  public patch(url: string, options: Yesttp.RequestOptions & { responseType: "text" }): Promise<Yesttp.TextResponse>;
  public patch<T = any>(url: string, options?: Yesttp.RequestOptions): Promise<Yesttp.JsonResponse<T>>;
  public patch(url: string, options: Yesttp.RequestOptions = {}): Promise<any> {
    return this.makeRequest({ ...options, url, method: "PATCH" });
  }

  public delete(url: string, options: Yesttp.RequestOptions & { responseType: "blob" }): Promise<Yesttp.BlobResponse>;
  public delete(url: string, options: Yesttp.RequestOptions & { responseType: "text" }): Promise<Yesttp.TextResponse>;
  public delete<T = any>(url: string, options?: Yesttp.RequestOptions): Promise<Yesttp.JsonResponse<T>>;
  public delete(url: string, options: Yesttp.RequestOptions = {}): Promise<any> {
    return this.makeRequest({ ...options, url, method: "DELETE" });
  }

  private async makeRequest(requestOptions: Yesttp.RequestSummary): Promise<any> {
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
      return this.responseErrorInterceptor(options, { status: 0, headers: {} }, e);
    }
    return this.handleResponse(options, response);
  }

  private async handleResponse(request: Yesttp.RequestSummary, fetchResponse: Response): Promise<any> {
    const status = fetchResponse.status;
    const headers = this.parseFetchHeaders(fetchResponse.headers || new Headers());
    const success = status >= 200 && status < 400;
    const interceptorFn = success ? this.responseSuccessInterceptor.bind(this) : this.responseErrorInterceptor.bind(this);
    const targetResponseType: Yesttp.ResponseType = success ? (request.responseType ?? "json") : (request.responseErrorType ?? "json");
    switch (targetResponseType) {
      case "json": {
        let json: any;
        let invalidJson = false;
        try {
          json = await fetchResponse.json();
        } catch {
          invalidJson = true;
        }
        const response: Yesttp.JsonResponse<any> = {
          headers,
          status,
          get json() {
            if (invalidJson) {
              console.warn("[Yesttp] You're trying to access the response body as JSON, but it could not be parsed as such");
            }
            return json;
          },
        };
        return interceptorFn(request, response);
      }
      case "text":
        return interceptorFn(request, { headers, status, text: await fetchResponse.text() } satisfies Yesttp.TextResponse);
      case "blob":
        return interceptorFn(request, { headers, status, blob: await fetchResponse.blob() } satisfies Yesttp.BlobResponse);
    }
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

  export type ResponseErrorInterceptor = (request: RequestSummary, response: AnyResponse, cause?: any) => Promise<any>;
  export const defaultResponseErrorInterceptor: ResponseErrorInterceptor = (request, response, cause) => {
    const error: Yesttp.ResponseError = { request, response };
    const errorArgs = ["[Yesttp] An HTTP error occurred", error];
    if (cause) errorArgs.push(cause);
    console.error(...errorArgs);
    throw error;
  };

  export type ResponseSuccessInterceptor = (request: RequestSummary, response: AnyResponse) => Promise<any>;
  export const defaultResponseSuccessInterceptor: Yesttp.ResponseSuccessInterceptor = (request, response) => Promise.resolve(response);

  export type ConstructorArgs = {
    baseUrl?: string;
    credentials?: RequestCredentials;
    requestInterceptor?: RequestInterceptor;
    responseErrorIntercepter?: ResponseErrorInterceptor;
    responseSuccessInterceptor?: ResponseSuccessInterceptor;
  };

  export type ResponseType = "json" | "text" | "blob";

  export type GetOptions = {
    responseType?: ResponseType;
    responseErrorType?: ResponseType;
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

  type CommonResponse = {
    status: number;
    headers: Record<string, string>;
  };

  export type AnyResponse = CommonResponse &
    Partial<Pick<JsonResponse<any>, "json"> & Pick<TextResponse, "text"> & Pick<BlobResponse, "blob">>;

  export type JsonResponse<T> = CommonResponse & {
    json: T;
  };
  export type TextResponse = CommonResponse & {
    text: string;
  };
  export type BlobResponse = CommonResponse & {
    blob: Blob;
  };

  export type ResponseError = {
    request: RequestSummary;
    response: AnyResponse;
  };
}
