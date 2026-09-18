var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = /* @__PURE__ */ __name(class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
}, "Context");

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "_Hono");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "_Node");

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
}, "RegExpRouter");

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = /* @__PURE__ */ __name(class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "_Node");

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");

// node_modules/hono/dist/hono.js
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono");

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = /* @__PURE__ */ __name((value) => {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const charCode = value.charCodeAt(start);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    start++;
  }
  while (end > start) {
    const charCode = value.charCodeAt(end - 1);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    end--;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
}, "trimCookieWhitespace");
var parse = /* @__PURE__ */ __name((cookie, name) => {
  if (name && cookie.indexOf(name) === -1) {
    return {};
  }
  const pairs = cookie.split(";");
  const parsedCookie = /* @__PURE__ */ Object.create(null);
  for (const pairStr of pairs) {
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
    if (name && name !== cookieName || !validCookieNameRegEx.test(cookieName) || cookieName in parsedCookie) {
      continue;
    }
    let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = cookieValue.indexOf("%") !== -1 ? tryDecode(cookieValue, decodeURIComponent_) : cookieValue;
      if (name) {
        break;
      }
    }
  }
  return parsedCookie;
}, "parse");
var _serialize = /* @__PURE__ */ __name((name, value, opt = {}) => {
  if (!validCookieNameRegEx.test(name)) {
    throw new Error("Invalid cookie name");
  }
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path", "sameSite", "priority"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
}, "_serialize");
var serialize = /* @__PURE__ */ __name((name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
}, "serialize");

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = /* @__PURE__ */ __name((c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
}, "getCookie");
var generateCookie = /* @__PURE__ */ __name((name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name, value, { path: "/", ...opt });
  }
  return cookie;
}, "generateCookie");
var setCookie = /* @__PURE__ */ __name((c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
}, "setCookie");

// src/queues/notificationConsumer.ts
async function getGoogleAccessToken(env) {
  const cached = await env.KV.get("google:access_token", "json");
  if (cached && cached.expires_at > Date.now() / 1e3 + 300) {
    return cached.access_token;
  }
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signingInput = `${encodedHeader}.${encodedClaim}`;
  const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const keyBuffer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  const jwt2 = `${signingInput}.${signature}`;
  const tokenResp = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt2}`
  });
  if (!tokenResp.ok) {
    throw new Error(`Failed to get access token: ${tokenResp.status} ${await tokenResp.text()}`);
  }
  const tokenData = await tokenResp.json();
  const tokenCache = {
    access_token: tokenData.access_token,
    expires_at: now + tokenData.expires_in
  };
  await env.KV.put("google:access_token", JSON.stringify(tokenCache), {
    expirationTtl: tokenData.expires_in - 300
  });
  return tokenData.access_token;
}
__name(getGoogleAccessToken, "getGoogleAccessToken");
async function sendFCMNotification(projectId, accessToken, token, title, body, data) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message = {
    message: {
      token,
      notification: { title, body },
      android: {
        priority: "high",
        notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" }
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } }
      },
      data: data || {}
    }
  };
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });
    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
__name(sendFCMNotification, "sendFCMNotification");
async function handleNotificationQueue(batch, env) {
  let projectId;
  try {
    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    projectId = sa.project_id;
  } catch {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
    batch.ackAll();
    return;
  }
  let accessToken;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (e) {
    console.error("Failed to get Google access token:", e);
    batch.retryAll();
    return;
  }
  for (const message of batch.messages) {
    const payload = message.body;
    try {
      const tokens = payload.tokens || [];
      if (tokens.length === 0 && payload.type !== "topic") {
        message.ack();
        continue;
      }
      const results = await Promise.allSettled(
        tokens.map(
          (token) => sendFCMNotification(projectId, accessToken, token, payload.title, payload.body, payload.data)
        )
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && !result.value.success) {
          const errorStr = result.value.error || "";
          if (errorStr.includes("NOT_FOUND") || errorStr.includes("UNREGISTERED")) {
            await env.DB.prepare("UPDATE devices SET push_token = NULL WHERE push_token = ?").bind(tokens[i]).run();
            await env.DB.prepare("DELETE FROM push_subscriptions WHERE push_token = ?").bind(tokens[i]).run();
          }
        }
      }
      message.ack();
    } catch (e) {
      console.error("Error processing notification message:", e);
      message.retry();
    }
  }
}
__name(handleNotificationQueue, "handleNotificationQueue");
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
async function sendNotificationDirectly(env, payload) {
  let projectId;
  try {
    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    projectId = sa.project_id;
  } catch {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
    return;
  }
  let accessToken;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (e) {
    console.error("Failed to get Google access token:", e);
    return;
  }
  const tokens = payload.tokens || [];
  if (tokens.length === 0)
    return;
  const results = await Promise.allSettled(
    tokens.map(
      (token) => sendFCMNotification(projectId, accessToken, token, payload.title, payload.body, payload.data)
    )
  );
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && !result.value.success) {
      const errorStr = result.value.error || "";
      if (errorStr.includes("NOT_FOUND") || errorStr.includes("UNREGISTERED")) {
        await env.DB.prepare("UPDATE devices SET push_token = NULL WHERE push_token = ?").bind(tokens[i]).run();
      }
    }
  }
}
__name(sendNotificationDirectly, "sendNotificationDirectly");

// node_modules/hono/dist/helper/factory/index.js
var createMiddleware = /* @__PURE__ */ __name((middleware) => middleware, "createMiddleware");

// node_modules/hono/dist/utils/encode.js
var decodeBase64Url = /* @__PURE__ */ __name((str) => {
  return decodeBase64(str.replace(/_|-/g, (m) => ({ _: "/", "-": "+" })[m] ?? m));
}, "decodeBase64Url");
var encodeBase64Url = /* @__PURE__ */ __name((buf) => encodeBase64(buf).replace(/\/|\+/g, (m) => ({ "/": "_", "+": "-" })[m] ?? m), "encodeBase64Url");
var encodeBase64 = /* @__PURE__ */ __name((buf) => {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0, len = bytes.length; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}, "encodeBase64");
var decodeBase64 = /* @__PURE__ */ __name((str) => {
  const binary = atob(str);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  const half = binary.length / 2;
  for (let i = 0, j = binary.length - 1; i <= half; i++, j--) {
    bytes[i] = binary.charCodeAt(i);
    bytes[j] = binary.charCodeAt(j);
  }
  return bytes;
}, "decodeBase64");

// node_modules/hono/dist/utils/jwt/jwa.js
var AlgorithmTypes = /* @__PURE__ */ ((AlgorithmTypes2) => {
  AlgorithmTypes2["HS256"] = "HS256";
  AlgorithmTypes2["HS384"] = "HS384";
  AlgorithmTypes2["HS512"] = "HS512";
  AlgorithmTypes2["RS256"] = "RS256";
  AlgorithmTypes2["RS384"] = "RS384";
  AlgorithmTypes2["RS512"] = "RS512";
  AlgorithmTypes2["PS256"] = "PS256";
  AlgorithmTypes2["PS384"] = "PS384";
  AlgorithmTypes2["PS512"] = "PS512";
  AlgorithmTypes2["ES256"] = "ES256";
  AlgorithmTypes2["ES384"] = "ES384";
  AlgorithmTypes2["ES512"] = "ES512";
  AlgorithmTypes2["EdDSA"] = "EdDSA";
  return AlgorithmTypes2;
})(AlgorithmTypes || {});

// node_modules/hono/dist/helper/adapter/index.js
var knownUserAgents = {
  deno: "Deno",
  bun: "Bun",
  workerd: "Cloudflare-Workers",
  node: "Node.js"
};
var getRuntimeKey = /* @__PURE__ */ __name(() => {
  const global = globalThis;
  const userAgentSupported = typeof navigator !== "undefined" && true;
  if (userAgentSupported) {
    for (const [runtimeKey, userAgent] of Object.entries(knownUserAgents)) {
      if (checkUserAgentEquals(userAgent)) {
        return runtimeKey;
      }
    }
  }
  if (typeof global?.EdgeRuntime === "string") {
    return "edge-light";
  }
  if (global?.fastly !== void 0) {
    return "fastly";
  }
  if (global?.process?.release?.name === "node") {
    return "node";
  }
  return "other";
}, "getRuntimeKey");
var checkUserAgentEquals = /* @__PURE__ */ __name((platform) => {
  const userAgent = "Cloudflare-Workers";
  return userAgent.startsWith(platform);
}, "checkUserAgentEquals");

// node_modules/hono/dist/utils/jwt/types.js
var JwtAlgorithmNotImplemented = /* @__PURE__ */ __name(class extends Error {
  constructor(alg) {
    super(`${alg} is not an implemented algorithm`);
    this.name = "JwtAlgorithmNotImplemented";
  }
}, "JwtAlgorithmNotImplemented");
var JwtAlgorithmRequired = /* @__PURE__ */ __name(class extends Error {
  constructor() {
    super('JWT verification requires "alg" option to be specified');
    this.name = "JwtAlgorithmRequired";
  }
}, "JwtAlgorithmRequired");
var JwtAlgorithmMismatch = /* @__PURE__ */ __name(class extends Error {
  constructor(expected, actual) {
    super(`JWT algorithm mismatch: expected "${expected}", got "${actual}"`);
    this.name = "JwtAlgorithmMismatch";
  }
}, "JwtAlgorithmMismatch");
var JwtTokenInvalid = /* @__PURE__ */ __name(class extends Error {
  constructor(token) {
    super(`invalid JWT token: ${token}`);
    this.name = "JwtTokenInvalid";
  }
}, "JwtTokenInvalid");
var JwtTokenNotBefore = /* @__PURE__ */ __name(class extends Error {
  constructor(token) {
    super(`token (${token}) is being used before it's valid`);
    this.name = "JwtTokenNotBefore";
  }
}, "JwtTokenNotBefore");
var JwtTokenExpired = /* @__PURE__ */ __name(class extends Error {
  constructor(token) {
    super(`token (${token}) expired`);
    this.name = "JwtTokenExpired";
  }
}, "JwtTokenExpired");
var JwtTokenIssuedAt = /* @__PURE__ */ __name(class extends Error {
  constructor(currentTimestamp, iat) {
    super(
      `Invalid "iat" claim, must be a valid number lower than "${currentTimestamp}" (iat: "${iat}")`
    );
    this.name = "JwtTokenIssuedAt";
  }
}, "JwtTokenIssuedAt");
var JwtTokenIssuer = /* @__PURE__ */ __name(class extends Error {
  constructor(expected, iss) {
    super(`expected issuer "${expected}", got ${iss ? `"${iss}"` : "none"} `);
    this.name = "JwtTokenIssuer";
  }
}, "JwtTokenIssuer");
var JwtHeaderInvalid = /* @__PURE__ */ __name(class extends Error {
  constructor(header) {
    super(`jwt header is invalid: ${JSON.stringify(header)}`);
    this.name = "JwtHeaderInvalid";
  }
}, "JwtHeaderInvalid");
var JwtHeaderRequiresKid = /* @__PURE__ */ __name(class extends Error {
  constructor(header) {
    super(`required "kid" in jwt header: ${JSON.stringify(header)}`);
    this.name = "JwtHeaderRequiresKid";
  }
}, "JwtHeaderRequiresKid");
var JwtSymmetricAlgorithmNotAllowed = /* @__PURE__ */ __name(class extends Error {
  constructor(alg) {
    super(`symmetric algorithm "${alg}" is not allowed for JWK verification`);
    this.name = "JwtSymmetricAlgorithmNotAllowed";
  }
}, "JwtSymmetricAlgorithmNotAllowed");
var JwtAlgorithmNotAllowed = /* @__PURE__ */ __name(class extends Error {
  constructor(alg, allowedAlgorithms) {
    super(`algorithm "${alg}" is not in the allowed list: [${allowedAlgorithms.join(", ")}]`);
    this.name = "JwtAlgorithmNotAllowed";
  }
}, "JwtAlgorithmNotAllowed");
var JwtTokenSignatureMismatched = /* @__PURE__ */ __name(class extends Error {
  constructor(token) {
    super(`token(${token}) signature mismatched`);
    this.name = "JwtTokenSignatureMismatched";
  }
}, "JwtTokenSignatureMismatched");
var JwtPayloadRequiresAud = /* @__PURE__ */ __name(class extends Error {
  constructor(payload) {
    super(`required "aud" in jwt payload: ${JSON.stringify(payload)}`);
    this.name = "JwtPayloadRequiresAud";
  }
}, "JwtPayloadRequiresAud");
var JwtTokenAudience = /* @__PURE__ */ __name(class extends Error {
  constructor(expected, aud) {
    super(
      `expected audience "${Array.isArray(expected) ? expected.join(", ") : expected}", got "${aud}"`
    );
    this.name = "JwtTokenAudience";
  }
}, "JwtTokenAudience");
var CryptoKeyUsage = /* @__PURE__ */ ((CryptoKeyUsage2) => {
  CryptoKeyUsage2["Encrypt"] = "encrypt";
  CryptoKeyUsage2["Decrypt"] = "decrypt";
  CryptoKeyUsage2["Sign"] = "sign";
  CryptoKeyUsage2["Verify"] = "verify";
  CryptoKeyUsage2["DeriveKey"] = "deriveKey";
  CryptoKeyUsage2["DeriveBits"] = "deriveBits";
  CryptoKeyUsage2["WrapKey"] = "wrapKey";
  CryptoKeyUsage2["UnwrapKey"] = "unwrapKey";
  return CryptoKeyUsage2;
})(CryptoKeyUsage || {});

// node_modules/hono/dist/utils/jwt/utf8.js
var utf8Encoder = new TextEncoder();
var utf8Decoder = new TextDecoder();

// node_modules/hono/dist/utils/jwt/jws.js
async function signing(privateKey, alg, data) {
  const algorithm = getKeyAlgorithm(alg);
  const cryptoKey = await importPrivateKey(privateKey, algorithm);
  return await crypto.subtle.sign(algorithm, cryptoKey, data);
}
__name(signing, "signing");
async function verifying(publicKey, alg, signature, data) {
  const algorithm = getKeyAlgorithm(alg);
  const cryptoKey = await importPublicKey(publicKey, algorithm);
  return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
}
__name(verifying, "verifying");
function pemToBinary(pem) {
  return decodeBase64(pem.replace(/-+(BEGIN|END).*?-+/g, "").replace(/\s/g, ""));
}
__name(pemToBinary, "pemToBinary");
async function importPrivateKey(key, alg) {
  if (!crypto.subtle || !crypto.subtle.importKey) {
    throw new Error("`crypto.subtle.importKey` is undefined. JWT auth middleware requires it.");
  }
  if (isCryptoKey(key)) {
    if (key.type !== "private" && key.type !== "secret") {
      throw new Error(
        `unexpected key type: CryptoKey.type is ${key.type}, expected private or secret`
      );
    }
    return key;
  }
  const usages = [CryptoKeyUsage.Sign];
  if (typeof key === "object") {
    return await crypto.subtle.importKey("jwk", key, alg, false, usages);
  }
  if (key.includes("PRIVATE")) {
    return await crypto.subtle.importKey("pkcs8", pemToBinary(key), alg, false, usages);
  }
  return await crypto.subtle.importKey("raw", utf8Encoder.encode(key), alg, false, usages);
}
__name(importPrivateKey, "importPrivateKey");
async function importPublicKey(key, alg) {
  if (!crypto.subtle || !crypto.subtle.importKey) {
    throw new Error("`crypto.subtle.importKey` is undefined. JWT auth middleware requires it.");
  }
  if (isCryptoKey(key)) {
    if (key.type === "public" || key.type === "secret") {
      return key;
    }
    key = await exportPublicJwkFrom(key);
  }
  if (typeof key === "string" && key.includes("PRIVATE")) {
    const privateKey = await crypto.subtle.importKey("pkcs8", pemToBinary(key), alg, true, [
      CryptoKeyUsage.Sign
    ]);
    key = await exportPublicJwkFrom(privateKey);
  }
  const usages = [CryptoKeyUsage.Verify];
  if (typeof key === "object") {
    return await crypto.subtle.importKey("jwk", key, alg, false, usages);
  }
  if (key.includes("PUBLIC")) {
    return await crypto.subtle.importKey("spki", pemToBinary(key), alg, false, usages);
  }
  return await crypto.subtle.importKey("raw", utf8Encoder.encode(key), alg, false, usages);
}
__name(importPublicKey, "importPublicKey");
async function exportPublicJwkFrom(privateKey) {
  if (privateKey.type !== "private") {
    throw new Error(`unexpected key type: ${privateKey.type}`);
  }
  if (!privateKey.extractable) {
    throw new Error("unexpected private key is unextractable");
  }
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const { kty } = jwk;
  const { alg, e, n } = jwk;
  const { crv, x, y } = jwk;
  return { kty, alg, e, n, crv, x, y, key_ops: [CryptoKeyUsage.Verify] };
}
__name(exportPublicJwkFrom, "exportPublicJwkFrom");
function getKeyAlgorithm(name) {
  switch (name) {
    case "HS256":
      return {
        name: "HMAC",
        hash: {
          name: "SHA-256"
        }
      };
    case "HS384":
      return {
        name: "HMAC",
        hash: {
          name: "SHA-384"
        }
      };
    case "HS512":
      return {
        name: "HMAC",
        hash: {
          name: "SHA-512"
        }
      };
    case "RS256":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: {
          name: "SHA-256"
        }
      };
    case "RS384":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: {
          name: "SHA-384"
        }
      };
    case "RS512":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: {
          name: "SHA-512"
        }
      };
    case "PS256":
      return {
        name: "RSA-PSS",
        hash: {
          name: "SHA-256"
        },
        saltLength: 32
        // 256 >> 3
      };
    case "PS384":
      return {
        name: "RSA-PSS",
        hash: {
          name: "SHA-384"
        },
        saltLength: 48
        // 384 >> 3
      };
    case "PS512":
      return {
        name: "RSA-PSS",
        hash: {
          name: "SHA-512"
        },
        saltLength: 64
        // 512 >> 3,
      };
    case "ES256":
      return {
        name: "ECDSA",
        hash: {
          name: "SHA-256"
        },
        namedCurve: "P-256"
      };
    case "ES384":
      return {
        name: "ECDSA",
        hash: {
          name: "SHA-384"
        },
        namedCurve: "P-384"
      };
    case "ES512":
      return {
        name: "ECDSA",
        hash: {
          name: "SHA-512"
        },
        namedCurve: "P-521"
      };
    case "EdDSA":
      return {
        name: "Ed25519",
        namedCurve: "Ed25519"
      };
    default:
      throw new JwtAlgorithmNotImplemented(name);
  }
}
__name(getKeyAlgorithm, "getKeyAlgorithm");
function isCryptoKey(key) {
  const runtime = getRuntimeKey();
  if (runtime === "node" && !!crypto.webcrypto) {
    return key instanceof crypto.webcrypto.CryptoKey;
  }
  return key instanceof CryptoKey;
}
__name(isCryptoKey, "isCryptoKey");

// node_modules/hono/dist/utils/jwt/jwt.js
var encodeJwtPart = /* @__PURE__ */ __name((part) => encodeBase64Url(utf8Encoder.encode(JSON.stringify(part)).buffer).replace(/=/g, ""), "encodeJwtPart");
var encodeSignaturePart = /* @__PURE__ */ __name((buf) => encodeBase64Url(buf).replace(/=/g, ""), "encodeSignaturePart");
var decodeJwtPart = /* @__PURE__ */ __name((part) => JSON.parse(utf8Decoder.decode(decodeBase64Url(part))), "decodeJwtPart");
function isTokenHeader(obj) {
  if (typeof obj === "object" && obj !== null) {
    const objWithAlg = obj;
    return "alg" in objWithAlg && Object.values(AlgorithmTypes).includes(objWithAlg.alg) && (!("typ" in objWithAlg) || objWithAlg.typ === "JWT");
  }
  return false;
}
__name(isTokenHeader, "isTokenHeader");
var sign = /* @__PURE__ */ __name(async (payload, privateKey, alg = "HS256") => {
  const encodedPayload = encodeJwtPart(payload);
  let encodedHeader;
  if (typeof privateKey === "object" && "alg" in privateKey) {
    alg = privateKey.alg;
    encodedHeader = encodeJwtPart({ alg, typ: "JWT", kid: privateKey.kid });
  } else {
    encodedHeader = encodeJwtPart({ alg, typ: "JWT" });
  }
  const partialToken = `${encodedHeader}.${encodedPayload}`;
  const signaturePart = await signing(privateKey, alg, utf8Encoder.encode(partialToken));
  const signature = encodeSignaturePart(signaturePart);
  return `${partialToken}.${signature}`;
}, "sign");
var verify = /* @__PURE__ */ __name(async (token, publicKey, algOrOptions) => {
  if (!algOrOptions) {
    throw new JwtAlgorithmRequired();
  }
  const {
    alg,
    iss,
    nbf = true,
    exp = true,
    iat = true,
    aud
  } = typeof algOrOptions === "string" ? { alg: algOrOptions } : algOrOptions;
  if (!alg) {
    throw new JwtAlgorithmRequired();
  }
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    throw new JwtTokenInvalid(token);
  }
  const { header, payload } = decode(token);
  if (!isTokenHeader(header)) {
    throw new JwtHeaderInvalid(header);
  }
  if (header.alg !== alg) {
    throw new JwtAlgorithmMismatch(alg, header.alg);
  }
  const now = Math.floor(Date.now() / 1e3);
  if (nbf && payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || payload.nbf > now) {
      throw new JwtTokenNotBefore(token);
    }
  }
  if (exp && payload.exp !== void 0) {
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= now) {
      throw new JwtTokenExpired(token);
    }
  }
  if (iat && payload.iat !== void 0) {
    if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat) || now < payload.iat) {
      throw new JwtTokenIssuedAt(now, payload.iat);
    }
  }
  if (iss) {
    if (!payload.iss) {
      throw new JwtTokenIssuer(iss, null);
    }
    if (typeof iss === "string" && payload.iss !== iss) {
      throw new JwtTokenIssuer(iss, payload.iss);
    }
    if (iss instanceof RegExp && !iss.test(payload.iss)) {
      throw new JwtTokenIssuer(iss, payload.iss);
    }
  }
  if (aud) {
    if (!payload.aud) {
      throw new JwtPayloadRequiresAud(payload);
    }
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const matched = audiences.some(
      (payloadAud) => aud instanceof RegExp ? aud.test(payloadAud) : typeof aud === "string" ? payloadAud === aud : Array.isArray(aud) && aud.includes(payloadAud)
    );
    if (!matched) {
      throw new JwtTokenAudience(aud, payload.aud);
    }
  }
  const headerPayload = token.substring(0, token.lastIndexOf("."));
  const verified = await verifying(
    publicKey,
    alg,
    decodeBase64Url(tokenParts[2]),
    utf8Encoder.encode(headerPayload)
  );
  if (!verified) {
    throw new JwtTokenSignatureMismatched(token);
  }
  return payload;
}, "verify");
var symmetricAlgorithms = [
  AlgorithmTypes.HS256,
  AlgorithmTypes.HS384,
  AlgorithmTypes.HS512
];
var verifyWithJwks = /* @__PURE__ */ __name(async (token, options, init) => {
  const verifyOpts = options.verification || {};
  const header = decodeHeader(token);
  if (!isTokenHeader(header)) {
    throw new JwtHeaderInvalid(header);
  }
  if (!header.kid) {
    throw new JwtHeaderRequiresKid(header);
  }
  if (symmetricAlgorithms.includes(header.alg)) {
    throw new JwtSymmetricAlgorithmNotAllowed(header.alg);
  }
  if (!options.allowedAlgorithms.includes(header.alg)) {
    throw new JwtAlgorithmNotAllowed(header.alg, options.allowedAlgorithms);
  }
  let verifyKeys = options.keys ? [...options.keys] : void 0;
  if (options.jwks_uri) {
    const response = await fetch(options.jwks_uri, init);
    if (!response.ok) {
      throw new Error(`failed to fetch JWKS from ${options.jwks_uri}`);
    }
    const data = await response.json();
    if (!data.keys) {
      throw new Error('invalid JWKS response. "keys" field is missing');
    }
    if (!Array.isArray(data.keys)) {
      throw new Error('invalid JWKS response. "keys" field is not an array');
    }
    verifyKeys ??= [];
    verifyKeys.push(...data.keys);
  } else if (!verifyKeys) {
    throw new Error('verifyWithJwks requires options for either "keys" or "jwks_uri" or both');
  }
  const matchingKey = verifyKeys.find((key) => key.kid === header.kid);
  if (!matchingKey) {
    throw new JwtTokenInvalid(token);
  }
  if (matchingKey.alg && matchingKey.alg !== header.alg) {
    throw new JwtAlgorithmMismatch(matchingKey.alg, header.alg);
  }
  return await verify(token, matchingKey, {
    alg: header.alg,
    ...verifyOpts
  });
}, "verifyWithJwks");
var decode = /* @__PURE__ */ __name((token) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtTokenInvalid(token);
  }
  try {
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    return {
      header,
      payload
    };
  } catch {
    throw new JwtTokenInvalid(token);
  }
}, "decode");
var decodeHeader = /* @__PURE__ */ __name((token) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtTokenInvalid(token);
  }
  try {
    return decodeJwtPart(parts[0]);
  } catch {
    throw new JwtTokenInvalid(token);
  }
}, "decodeHeader");

// node_modules/hono/dist/utils/jwt/index.js
var Jwt = { sign, verify, decode, verifyWithJwks };

// node_modules/hono/dist/middleware/jwt/jwt.js
var verifyWithJwks2 = Jwt.verifyWithJwks;
var verify2 = Jwt.verify;
var decode2 = Jwt.decode;
var sign2 = Jwt.sign;

// src/lib/jwt.ts
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
var PASSWORD_RESET_TTL_SECONDS = 60 * 60;
var JWT_ISSUER = "fusha-api";
var JWT_AUDIENCE = "fusha-client";
function getAuthSecret(env) {
  const secret = env.AUTH_SECRET?.trim();
  return secret ? secret : null;
}
__name(getAuthSecret, "getAuthSecret");
async function signAccessToken(env, user) {
  const secret = getAuthSecret(env);
  if (!secret)
    throw new Error("AUTH_SECRET is not configured");
  const now = Math.floor(Date.now() / 1e3);
  return sign2(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      token_use: "access",
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS
    },
    secret,
    "HS256"
  );
}
__name(signAccessToken, "signAccessToken");
async function verifyAccessToken(token, secret) {
  if (!secret?.trim())
    return null;
  try {
    const payload = await verify2(token, secret.trim(), "HS256");
    if (payload.token_use !== "access")
      return null;
    if (typeof payload.sub !== "string" || payload.sub.length === 0)
      return null;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE)
      return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyAccessToken, "verifyAccessToken");
function generateOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode2(bytes);
}
__name(generateOpaqueToken, "generateOpaqueToken");
async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
__name(hashToken, "hashToken");
function base64UrlEncode2(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode2, "base64UrlEncode");

// src/middleware/auth.ts
var requireAuth = createMiddleware(async (c, next) => {
  let token = "";
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u0648\u0643\u0646 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0645\u0641\u0642\u0648\u062F" } }, 401);
  }
  const env = c.env;
  let profile = null;
  let opaqueUserId = null;
  let tokenUserId = null;
  const isOpaqueToken = token.startsWith("pb_") || !token.includes(".");
  if (isOpaqueToken && env.KV) {
    const cached = await env.KV.get(`playback_token:${token}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.scope && data.scope !== "auth") {
          opaqueUserId = null;
        } else {
          opaqueUserId = data.userId;
        }
      } catch {
      }
    }
  }
  if (opaqueUserId) {
    profile = await env.DB.prepare(
      "SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE id = ?"
    ).bind(opaqueUserId).first();
  } else {
    const secret = getAuthSecret(env);
    if (!secret) {
      console.error("[SECURITY] AUTH_SECRET is not configured \u2014 rejecting authenticated request.");
      return c.json({ error: { code: "SERVER_ERROR", message: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645" } }, 500);
    }
    const claims = await verifyAccessToken(token, secret);
    if (!claims) {
      return c.json({ error: { code: "INVALID_TOKEN", message: "\u0627\u0644\u062A\u0648\u0643\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" } }, 401);
    }
    tokenUserId = claims.sub;
    profile = await env.DB.prepare(
      "SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE id = ?"
    ).bind(tokenUserId).first();
  }
  if (!profile) {
    console.error("[AUTH] Profile not found for user:", tokenUserId || opaqueUserId);
    return c.json({ error: { code: "PROFILE_NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A. \u064A\u0631\u062C\u0649 \u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B." } }, 404);
  }
  const expectedPlatform = env.PLATFORM_KEY || "fusha";
  if (profile.platform !== expectedPlatform) {
    return c.json({ error: { code: "UNAUTHORIZED_PLATFORM", message: "\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u062A\u0627\u0628\u0639 \u0644\u0645\u0646\u0635\u0629 \u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0623\u062E\u0631\u0649." } }, 403);
  }
  if (env.KV) {
    const isBlacklisted = await env.KV.get(`blacklist:user:${profile.id}`);
    if (isBlacklisted) {
      return c.json({ error: { code: "SESSION_INVALIDATED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u062A\u0645 \u0625\u0644\u063A\u0627\u0624\u0647\u0627. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." } }, 401);
    }
  }
  if (profile.status === "blocked") {
    return c.json({ error: { code: "ACCOUNT_BLOCKED", message: "\u062A\u0645 \u062D\u0638\u0631 \u062D\u0633\u0627\u0628\u0643. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633." } }, 403);
  }
  const authUser = {
    id: profile.id,
    supabaseUserId: profile.supabase_user_id,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    fullName: profile.full_name,
    maxDevices: profile.max_devices,
    grade: profile.grade,
    branch: profile.branch
  };
  c.set("user", authUser);
  c.set("deviceId", c.req.header("X-Device-Id") || void 0);
  c.set("appVersion", c.req.header("X-App-Version") || void 0);
  c.set("platform", c.req.header("X-Platform") || void 0);
  c.set("clientIp", c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "");
  const lastSeenStr = profile.last_seen_at;
  let shouldUpdate = true;
  if (lastSeenStr) {
    try {
      const lastSeenMs = Date.parse(lastSeenStr.replace(" ", "T") + "Z");
      if (!isNaN(lastSeenMs)) {
        const diffSeconds = (Date.now() - lastSeenMs) / 1e3;
        if (diffSeconds < 900) {
          shouldUpdate = false;
        }
      }
    } catch (e) {
    }
  }
  if (shouldUpdate) {
    c.executionCtx.waitUntil(
      env.DB.prepare("UPDATE profiles SET last_seen_at = datetime('now') WHERE id = ?").bind(profile.id).run()
    );
  }
  await next();
});
function requireRole(...roles) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: { code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621" } }, 403);
    }
    await next();
  });
}
__name(requireRole, "requireRole");
var requireTrustedDevice = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (user.role !== "student") {
    await next();
    return;
  }
  const deviceId = c.get("deviceId");
  if (!deviceId) {
    return c.json({ error: { code: "DEVICE_ID_MISSING", message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062C\u0647\u0627\u0632 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const device = await c.env.DB.prepare(
    "SELECT id, is_trusted FROM devices WHERE student_id = ? AND device_id = ?"
  ).bind(user.id, deviceId).first();
  if (!device) {
    const { count } = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM devices WHERE student_id = ?"
    ).bind(user.id).first() || { count: 0 };
    if (count >= user.maxDevices) {
      return c.json({ error: { code: "DEVICE_NOT_REGISTERED", message: `\u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0645\u0646 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 (${user.maxDevices}). \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633 \u0644\u062A\u0633\u062C\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632.` } }, 403);
    }
    const userAgent = c.req.header("User-Agent") || "";
    const isBrowser = /mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent);
    let platform = c.get("platform") || "web";
    if (isBrowser) {
      platform = "web";
    }
    const isNativePlatform = platform === "android" || platform === "ios";
    const isTrusted = isNativePlatform ? 1 : 0;
    const id = crypto.randomUUID();
    const result = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, datetime('now'), datetime('now'))`
    ).bind(id, user.id, deviceId, platform, `Auto-registered (${platform})`, isTrusted).run();
    if (result.meta.changes === 0) {
      const reselected = await c.env.DB.prepare(
        "SELECT id, is_trusted FROM devices WHERE student_id = ? AND device_id = ?"
      ).bind(user.id, deviceId).first();
      if (!reselected) {
        return c.json({ error: { code: "DEVICE_NOT_REGISTERED", message: "\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062C\u0647\u0627\u0632 \u0623\u0648\u0644\u0627\u064B." } }, 403);
      }
      if (reselected.is_trusted !== 1) {
        return c.json({ error: { code: "DEVICE_NOT_TRUSTED", message: "\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0644\u062A\u0641\u0639\u064A\u0644 \u062C\u0647\u0627\u0632\u0643." } }, 403);
      }
    } else {
      const { postCount } = await c.env.DB.prepare(
        "SELECT COUNT(*) as postCount FROM devices WHERE student_id = ?"
      ).bind(user.id).first() || { postCount: 0 };
      if (postCount > user.maxDevices) {
        await c.env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(id).run();
        return c.json({ error: { code: "DEVICE_LIMIT_EXCEEDED", message: `\u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0645\u0646 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 (${user.maxDevices}). \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633 \u0644\u062A\u0633\u062C\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632.` } }, 403);
      }
      if (!isTrusted) {
        return c.json({ error: { code: "DEVICE_NOT_TRUSTED", message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u0648\u0644\u0643\u0646\u0647 \u063A\u064A\u0631 \u0645\u0648\u062B\u0651\u0642 \u0628\u0639\u062F. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0644\u062A\u0641\u0639\u064A\u0644 \u062C\u0647\u0627\u0632\u0643." } }, 403);
      }
    }
  } else if (device.is_trusted !== 1) {
    return c.json({ error: { code: "DEVICE_NOT_TRUSTED", message: "\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0644\u062A\u0641\u0639\u064A\u0644 \u062C\u0647\u0627\u0632\u0643." } }, 403);
  }
  await next();
});
var memoryRateLimits = {};
var lastRateLimitCleanup = Date.now();
function cleanMemoryRateLimits() {
  const now = Date.now();
  if (now - lastRateLimitCleanup < 6e4)
    return;
  lastRateLimitCleanup = now;
  const nowSeconds = Math.floor(now / 1e3);
  for (const key in memoryRateLimits) {
    if (nowSeconds >= memoryRateLimits[key].reset) {
      delete memoryRateLimits[key];
    }
  }
}
__name(cleanMemoryRateLimits, "cleanMemoryRateLimits");
function rateLimit(bucket, maxRequests = 60, windowSeconds = 60) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    const key = `ratelimit:${bucket}:${user?.id || c.req.header("cf-connecting-ip") || "anon"}`;
    const now = Math.floor(Date.now() / 1e3);
    const kv = c.env.KV;
    if (kv) {
      const recordStr = await kv.get(key);
      let current = { count: 0, reset: 0 };
      if (recordStr) {
        try {
          current = JSON.parse(recordStr);
        } catch {
        }
      }
      if (current.count > 0 && now < current.reset) {
        if (current.count >= maxRequests) {
          return c.json({ error: { code: "RATE_LIMITED", message: "\u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0645\u0646 \u0627\u0644\u0637\u0644\u0628\u0627\u062A. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u0627\u064B." } }, 429);
        }
        await kv.put(key, JSON.stringify({ count: current.count + 1, reset: current.reset }), {
          expirationTtl: Math.max(60, current.reset - now)
        });
      } else {
        await kv.put(key, JSON.stringify({ count: 1, reset: now + windowSeconds }), {
          expirationTtl: Math.max(60, windowSeconds)
        });
      }
    } else {
      console.warn("[SECURITY] KV namespace not available \u2014 falling back to in-memory rate limiting (unreliable across Workers isolates)");
      cleanMemoryRateLimits();
      let current = memoryRateLimits[key];
      if (current && now < current.reset) {
        if (current.count >= maxRequests) {
          return c.json({ error: { code: "RATE_LIMITED", message: "\u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0645\u0646 \u0627\u0644\u0637\u0644\u0628\u0627\u062A. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u0627\u064B." } }, 429);
        }
        current.count++;
      } else {
        current = { count: 1, reset: now + windowSeconds };
        memoryRateLimits[key] = current;
      }
    }
    await next();
  });
}
__name(rateLimit, "rateLimit");
function audit(action) {
  return createMiddleware(async (c, next) => {
    await next();
    const user = c.get("user");
    const targetType = c.get("auditTargetType") || null;
    const targetId = c.get("auditTargetId") || null;
    const meta = c.get("auditMeta");
    const metaJson = meta ? JSON.stringify(meta) : null;
    const platform = c.env.PLATFORM_KEY || "fusha";
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, ip, user_agent, meta_json, platform, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        user?.id || null,
        action,
        targetType,
        targetId,
        c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "",
        c.req.header("user-agent") || "",
        metaJson,
        platform
      ).run()
    );
  });
}
__name(audit, "audit");
function requirePermission(permissionKey) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u0648\u0643\u0646 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0645\u0641\u0642\u0648\u062F" } }, 401);
    }
    const ALLOWED_PERMISSIONS = /* @__PURE__ */ new Set([
      "can_reset_devices",
      "can_grade_quizzes",
      "can_answer_questions",
      "can_manage_codes",
      "can_manage_courses"
    ]);
    if (!ALLOWED_PERMISSIONS.has(permissionKey)) {
      return c.json({ error: { code: "FORBIDDEN", message: "\u0635\u0644\u0627\u062D\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" } }, 403);
    }
    if (user.role === "admin") {
      await next();
      return;
    }
    if (user.role === "assistant") {
      const perm = await c.env.DB.prepare(
        "SELECT can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses FROM assistant_permissions WHERE assistant_id = ?"
      ).bind(user.id).first();
      if (perm && perm[permissionKey] === 1) {
        await next();
        return;
      }
    }
    return c.json({ error: { code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621" } }, 403);
  });
}
__name(requirePermission, "requirePermission");
var optionalAuth = createMiddleware(async (c, next) => {
  let token = "";
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) {
    await next();
    return;
  }
  const env = c.env;
  let profile = null;
  let opaqueUserId = null;
  let tokenUserId = null;
  const isOpaqueToken = token.startsWith("pb_") || !token.includes(".");
  if (isOpaqueToken && env.KV) {
    const cached = await env.KV.get(`playback_token:${token}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.scope && data.scope !== "auth") {
          opaqueUserId = null;
        } else {
          opaqueUserId = data.userId;
        }
      } catch {
      }
    }
  }
  if (opaqueUserId) {
    profile = await env.DB.prepare(
      "SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE id = ?"
    ).bind(opaqueUserId).first();
  } else {
    const claims = await verifyAccessToken(token, getAuthSecret(env));
    if (claims?.sub) {
      tokenUserId = claims.sub;
      profile = await env.DB.prepare(
        "SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE id = ?"
      ).bind(tokenUserId).first();
    }
  }
  if (profile && profile.platform === (env.PLATFORM_KEY || "fusha") && profile.status !== "blocked") {
    if (env.KV) {
      const isBlacklisted = await env.KV.get(`blacklist:user:${profile.id}`);
      if (!isBlacklisted) {
        const authUser = {
          id: profile.id,
          supabaseUserId: profile.supabase_user_id,
          email: profile.email,
          role: profile.role,
          status: profile.status,
          fullName: profile.full_name,
          maxDevices: profile.max_devices,
          grade: profile.grade,
          branch: profile.branch
        };
        c.set("user", authUser);
      }
    } else {
      const authUser = {
        id: profile.id,
        supabaseUserId: profile.supabase_user_id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        fullName: profile.full_name,
        maxDevices: profile.max_devices,
        grade: profile.grade,
        branch: profile.branch
      };
      c.set("user", authUser);
    }
  }
  await next();
});

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  __name(assertIs, "assertIs");
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  __name(assertNever, "assertNever");
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  __name(joinValues, "joinValues");
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = /* @__PURE__ */ __name((data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
}, "getParsedType");

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = /* @__PURE__ */ __name((obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
}, "quotelessJson");
var ZodError = class extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = /* @__PURE__ */ __name((error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }, "processError");
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
__name(ZodError, "ZodError");
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = /* @__PURE__ */ __name((issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
}, "errorMap");
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
__name(setErrorMap, "setErrorMap");
function getErrorMap() {
  return overrideErrorMap;
}
__name(getErrorMap, "getErrorMap");

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = /* @__PURE__ */ __name((params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
}, "makeIssue");
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
__name(addIssueToContext, "addIssueToContext");
var ParseStatus = class {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
__name(ParseStatus, "ParseStatus");
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = /* @__PURE__ */ __name((value) => ({ status: "dirty", value }), "DIRTY");
var OK = /* @__PURE__ */ __name((value) => ({ status: "valid", value }), "OK");
var isAborted = /* @__PURE__ */ __name((x) => x.status === "aborted", "isAborted");
var isDirty = /* @__PURE__ */ __name((x) => x.status === "dirty", "isDirty");
var isValid = /* @__PURE__ */ __name((x) => x.status === "valid", "isValid");
var isAsync = /* @__PURE__ */ __name((x) => typeof Promise !== "undefined" && x instanceof Promise, "isAsync");

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent2, value, path, key) {
    this._cachedPath = [];
    this.parent = parent2;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
__name(ParseInputLazyPath, "ParseInputLazyPath");
var handleResult = /* @__PURE__ */ __name((ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
}, "handleResult");
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = /* @__PURE__ */ __name((iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  }, "customMap");
  return { errorMap: customMap, description };
}
__name(processCreateParams, "processCreateParams");
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = /* @__PURE__ */ __name((val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    }, "getIssueProperties");
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = /* @__PURE__ */ __name(() => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      }), "setError");
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
__name(ZodType, "ZodType");
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
__name(timeRegexSource, "timeRegexSource");
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
__name(timeRegex, "timeRegex");
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
__name(datetimeRegex, "datetimeRegex");
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidIP, "isValidIP");
function isValidJWT(jwt2, alg) {
  if (!jwtRegex.test(jwt2))
    return false;
  try {
    const [header] = jwt2.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
__name(isValidJWT, "isValidJWT");
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidCidr, "isValidCidr");
var ZodString = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
__name(ZodString, "ZodString");
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
__name(floatSafeRemainder, "floatSafeRemainder");
var ZodNumber = class extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
__name(ZodNumber, "ZodNumber");
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
__name(ZodBigInt, "ZodBigInt");
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(ZodBoolean, "ZodBoolean");
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
__name(ZodDate, "ZodDate");
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(ZodSymbol, "ZodSymbol");
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(ZodUndefined, "ZodUndefined");
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(ZodNull, "ZodNull");
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
__name(ZodAny, "ZodAny");
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
__name(ZodUnknown, "ZodUnknown");
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
__name(ZodNever, "ZodNever");
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(ZodVoid, "ZodVoid");
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
__name(ZodArray, "ZodArray");
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
__name(deepPartialify, "deepPartialify");
var ZodObject = class extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape2 = this._def.shape();
    const keys = util.objectKeys(shape2);
    this._cached = { shape: shape2, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape: shape2, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape2[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape2 = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape2[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape2
    });
  }
  omit(mask) {
    const shape2 = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape2[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape2
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
__name(ZodObject, "ZodObject");
ZodObject.create = (shape2, params) => {
  return new ZodObject({
    shape: () => shape2,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape2, params) => {
  return new ZodObject({
    shape: () => shape2,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape2, params) => {
  return new ZodObject({
    shape: shape2,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    __name(handleResults, "handleResults");
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
__name(ZodUnion, "ZodUnion");
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = /* @__PURE__ */ __name((type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
}, "getDiscriminator");
var ZodDiscriminatedUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
__name(ZodDiscriminatedUnion, "ZodDiscriminatedUnion");
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
__name(mergeValues, "mergeValues");
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = /* @__PURE__ */ __name((parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    }, "handleParsed");
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
__name(ZodIntersection, "ZodIntersection");
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
};
__name(ZodTuple, "ZodTuple");
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
__name(ZodRecord, "ZodRecord");
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
__name(ZodMap, "ZodMap");
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    __name(finalizeSet, "finalizeSet");
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
__name(ZodSet, "ZodSet");
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    __name(makeArgsIssue, "makeArgsIssue");
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    __name(makeReturnsIssue, "makeReturnsIssue");
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
__name(ZodFunction, "ZodFunction");
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
__name(ZodLazy, "ZodLazy");
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
__name(ZodLiteral, "ZodLiteral");
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
__name(createZodEnum, "createZodEnum");
var ZodEnum = class extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
__name(ZodEnum, "ZodEnum");
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
__name(ZodNativeEnum, "ZodNativeEnum");
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
__name(ZodPromise, "ZodPromise");
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = /* @__PURE__ */ __name((acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      }, "executeRefinement");
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
__name(ZodEffects, "ZodEffects");
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
__name(ZodOptional, "ZodOptional");
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
__name(ZodNullable, "ZodNullable");
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
__name(ZodDefault, "ZodDefault");
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
__name(ZodCatch, "ZodCatch");
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
__name(ZodNaN, "ZodNaN");
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
__name(ZodBranded, "ZodBranded");
var ZodPipeline = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = /* @__PURE__ */ __name(async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }, "handleAsync");
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
__name(ZodPipeline, "ZodPipeline");
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = /* @__PURE__ */ __name((data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    }, "freeze");
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
__name(ZodReadonly, "ZodReadonly");
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
__name(cleanParams, "cleanParams");
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
__name(custom, "custom");
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = /* @__PURE__ */ __name((cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params), "instanceOfType");
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = /* @__PURE__ */ __name(() => stringType().optional(), "ostring");
var onumber = /* @__PURE__ */ __name(() => numberType().optional(), "onumber");
var oboolean = /* @__PURE__ */ __name(() => booleanType().optional(), "oboolean");
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// src/utils/id.ts
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
function nowISO() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
}
__name(nowISO, "nowISO");
function generateActivationCode() {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = /* @__PURE__ */ __name((len) => {
    const arr = new Uint8Array(len);
    let result = "";
    const limit = 256 - 256 % CHARS.length;
    while (result.length < len) {
      crypto.getRandomValues(arr);
      for (let i = 0; i < arr.length && result.length < len; i++) {
        if (arr[i] < limit) {
          result += CHARS[arr[i] % CHARS.length];
        }
      }
    }
    return result;
  }, "segment");
  return `PHY-${segment(4)}-${segment(4)}`;
}
__name(generateActivationCode, "generateActivationCode");
function generateStudentCode() {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = /* @__PURE__ */ __name((len) => {
    const arr = new Uint8Array(len);
    let result = "";
    const limit = 256 - 256 % CHARS.length;
    while (result.length < len) {
      crypto.getRandomValues(arr);
      for (let i = 0; i < arr.length && result.length < len; i++) {
        if (arr[i] < limit) {
          result += CHARS[arr[i] % CHARS.length];
        }
      }
    }
    return result;
  }, "segment");
  return `FSH-${segment(4)}-${segment(4)}`;
}
__name(generateStudentCode, "generateStudentCode");
function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
__name(normalizeCode, "normalizeCode");
function slugify(text) {
  return text.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
}
__name(slugify, "slugify");

// src/lib/password.ts
var PBKDF2_ITERATIONS = 15e4;
var PBKDF2_HASH = "SHA-256";
var KEY_LENGTH_BITS = 256;
var SALT_BYTES = 16;
function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
__name(toHex, "toHex");
function fromHex(hex) {
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex))
    return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
__name(fromHex, "fromHex");
async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return new Uint8Array(bits);
}
__name(deriveBits, "deriveBits");
function timingSafeEqual(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `${toHex(salt)}:${toHex(hash)}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  if (!stored)
    return false;
  const separator = stored.indexOf(":");
  if (separator <= 0)
    return false;
  const salt = fromHex(stored.slice(0, separator));
  const expected = fromHex(stored.slice(separator + 1));
  if (!salt || !expected)
    return false;
  const actual = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return timingSafeEqual(actual, expected);
}
__name(verifyPassword, "verifyPassword");

// src/lib/points.ts
var POINTS_PER_LEVEL = 100;
var REFERRAL_POINTS = 50;
function levelFor(totalPoints) {
  const points2 = Number.isFinite(totalPoints) && totalPoints > 0 ? Math.floor(totalPoints) : 0;
  return Math.floor(points2 / POINTS_PER_LEVEL) + 1;
}
__name(levelFor, "levelFor");
async function getPointsState(env, studentId) {
  const row = await env.DB.prepare(
    "SELECT points, level FROM profiles WHERE id = ?"
  ).bind(studentId).first();
  const total = row?.points ?? 0;
  return { total_points: total, level: row?.level ?? levelFor(total) };
}
__name(getPointsState, "getPointsState");
async function awardPoints(env, studentId, points2, reason, opts = {}) {
  const before = await getPointsState(env, studentId);
  const awarded = Number.isFinite(points2) ? Math.trunc(points2) : 0;
  if (awarded === 0) {
    return { ...before, awarded: 0, level_up: false };
  }
  const nextTotal = Math.max(0, before.total_points + awarded);
  const nextLevel = levelFor(nextTotal);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO points_ledger (id, platform, student_id, points, reason, reference_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      generateId(),
      env.PLATFORM_KEY || "fusha",
      studentId,
      awarded,
      reason,
      opts.referenceId ?? null,
      opts.note ?? null
    ),
    env.DB.prepare(
      "UPDATE profiles SET points = ?, level = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(nextTotal, nextLevel, studentId)
  ]);
  return {
    total_points: nextTotal,
    level: nextLevel,
    awarded,
    level_up: nextLevel > before.level
  };
}
__name(awardPoints, "awardPoints");

// src/routes/auth.ts
var auth = new Hono2();
var PUBLIC_PROFILE_COLUMNS = "id, email, student_code, role, full_name, phone, parent_phone, grade, branch, governorate, avatar_url, status, platform, max_devices, created_at, updated_at";
function platformOf(env) {
  return env.PLATFORM_KEY || "fusha";
}
__name(platformOf, "platformOf");
function clientIp(c) {
  return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "";
}
__name(clientIp, "clientIp");
async function loadPublicProfile(env, id) {
  return await env.DB.prepare(
    `SELECT ${PUBLIC_PROFILE_COLUMNS} FROM profiles WHERE id = ?`
  ).bind(id).first();
}
__name(loadPublicProfile, "loadPublicProfile");
async function issueTokens(env, profile, meta) {
  const access_token = await signAccessToken(env, {
    id: profile.id,
    email: profile.email,
    role: profile.role
  });
  const refresh_token = generateOpaqueToken();
  const tokenHash = await hashToken(refresh_token);
  await env.DB.prepare(
    `INSERT INTO refresh_tokens (id, profile_id, token_hash, platform, user_agent, ip, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+${REFRESH_TOKEN_TTL_SECONDS} seconds'), datetime('now'))`
  ).bind(
    generateId(),
    profile.id,
    tokenHash,
    platformOf(env),
    meta.userAgent || null,
    meta.ip || null
  ).run();
  return { access_token, refresh_token };
}
__name(issueTokens, "issueTokens");
auth.get("/check-email", rateLimit("check-email", 60, 60), async (c) => {
  const email = c.req.query("email");
  if (!email) {
    return c.json({ exists: false });
  }
  const existing = await c.env.DB.prepare(
    "SELECT id FROM profiles WHERE email = ?"
  ).bind(email.trim().toLowerCase()).first();
  return c.json({ exists: !!existing });
});
auth.get("/public-settings", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT key, value FROM app_settings WHERE key IN ('academic_years', 'branches')"
  ).all();
  const settings = {};
  for (const row of results) {
    settings[row.key] = row.value;
  }
  const parseSetting = /* @__PURE__ */ __name((val) => {
    if (!val)
      return [];
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed))
        return parsed;
    } catch {
    }
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }, "parseSetting");
  return c.json({
    academic_years: parseSetting(settings.academic_years),
    branches: parseSetting(settings.branches)
  });
});
var registerSchema = external_exports.object({
  email: external_exports.string().trim().toLowerCase().email().max(254),
  password: external_exports.string().min(8).max(200),
  full_name: external_exports.string().trim().min(2).max(100),
  phone: external_exports.string().trim().max(20).optional().nullable(),
  grade: external_exports.string().trim().max(50).optional().nullable(),
  branch: external_exports.string().trim().max(50).optional().nullable(),
  // كود الإحالة (اختياري) — كود شريك طالب آخر.
  referral_code: external_exports.string().trim().max(20).optional().nullable()
});
auth.post("/register", rateLimit("auth-register", 10, 900), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const { email, password, full_name, phone, grade, branch, referral_code } = parsed.data;
  const env = c.env;
  const platform = platformOf(env);
  const existing = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(email).first();
  if (existing) {
    return c.json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644" } }, 409);
  }
  const id = generateId();
  const now = nowISO();
  const password_hash = await hashPassword(password);
  const student_code = generateStudentCode();
  try {
    await env.DB.prepare(
      `INSERT INTO profiles (id, supabase_user_id, email, password_hash, student_code, role, full_name, phone, grade, branch, status, max_devices, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, ?, 'active', 2, ?, ?, ?)`
    ).bind(
      id,
      // العمود القديم supabase_user_id ما زال NOT NULL UNIQUE — نضع فيه معرّفاً فريداً غير مستخدم.
      `local-${id}`,
      email,
      password_hash,
      student_code,
      full_name,
      phone || "",
      grade || null,
      branch || null,
      platform,
      now,
      now
    ).run();
  } catch (err) {
    const message = String(err?.message || "");
    if (message.includes("UNIQUE") || message.includes("constraint")) {
      return c.json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644" } }, 409);
    }
    throw err;
  }
  const referralResult = await applyReferral(env, {
    newStudentId: id,
    referralCode: referral_code,
    platform
  });
  const profile = await loadPublicProfile(env, id);
  if (!profile) {
    return c.json({ error: { code: "INTERNAL_ERROR", message: "\u062A\u0639\u0630\u0651\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." } }, 500);
  }
  const tokens = await issueTokens(env, profile, {
    userAgent: c.req.header("user-agent"),
    ip: clientIp(c)
  });
  return c.json({ ...tokens, user: profile, referral: referralResult }, 201);
});
async function applyReferral(env, input) {
  const code = (input.referralCode || "").trim().toUpperCase();
  if (!code)
    return { applied: false };
  try {
    const referrer = await env.DB.prepare(
      "SELECT id FROM profiles WHERE student_code = ? AND platform = ? AND role = 'student' AND id <> ?"
    ).bind(code, input.platform, input.newStudentId).first();
    if (!referrer)
      return { applied: false };
    await env.DB.prepare(
      `INSERT OR IGNORE INTO referral_uses (id, platform, referrer_id, referred_id, code, points_awarded, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(generateId(), input.platform, referrer.id, input.newStudentId, code, REFERRAL_POINTS).run();
    const awarded = await awardPoints(env, referrer.id, REFERRAL_POINTS, "referral", {
      referenceId: input.newStudentId,
      note: `\u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0627\u0644\u0628 ${input.newStudentId}`
    });
    return { applied: true, referrer_id: referrer.id, points_awarded: awarded.awarded };
  } catch (err) {
    console.error("[AUTH] Referral application failed:", err);
    return { applied: false };
  }
}
__name(applyReferral, "applyReferral");
var loginSchema = external_exports.object({
  email: external_exports.string().trim().toLowerCase().max(254).optional(),
  phone: external_exports.string().trim().max(20).optional(),
  password: external_exports.string().min(1).max(200)
});
auth.post("/login", rateLimit("auth-login", 10, 300), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const { email, phone, password } = parsed.data;
  const identifier = email || phone;
  if (!identifier) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const env = c.env;
  const row = await env.DB.prepare(
    "SELECT id, status, platform, password_hash FROM profiles WHERE email = ? OR phone = ? LIMIT 1"
  ).bind(identifier, identifier).first();
  const invalidCredentials = /* @__PURE__ */ __name(() => c.json({ error: { code: "INVALID_CREDENTIALS", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 401), "invalidCredentials");
  if (!row)
    return invalidCredentials();
  const passwordOk = await verifyPassword(password, row.password_hash);
  if (!passwordOk)
    return invalidCredentials();
  if (row.platform !== platformOf(env)) {
    return c.json({ error: { code: "UNAUTHORIZED_PLATFORM", message: "\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u062A\u0627\u0628\u0639 \u0644\u0645\u0646\u0635\u0629 \u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0623\u062E\u0631\u0649." } }, 403);
  }
  if (row.status === "blocked") {
    return c.json({ error: { code: "ACCOUNT_BLOCKED", message: "\u062A\u0645 \u062D\u0638\u0631 \u062D\u0633\u0627\u0628\u0643. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633." } }, 403);
  }
  const profile = await loadPublicProfile(env, row.id);
  if (!profile)
    return invalidCredentials();
  const tokens = await issueTokens(env, profile, {
    userAgent: c.req.header("user-agent"),
    ip: clientIp(c)
  });
  return c.json({ ...tokens, user: profile });
});
var refreshSchema = external_exports.object({ refresh_token: external_exports.string().min(1).max(500) });
auth.post("/refresh", rateLimit("auth-refresh", 60, 300), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const env = c.env;
  const tokenHash = await hashToken(parsed.data.refresh_token);
  const stored = await env.DB.prepare(
    `SELECT id, profile_id FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
  ).bind(tokenHash).first();
  const invalid = /* @__PURE__ */ __name(() => c.json({ error: { code: "INVALID_REFRESH_TOKEN", message: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062C\u062F\u064A\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" } }, 401), "invalid");
  if (!stored)
    return invalid();
  const profile = await loadPublicProfile(env, stored.profile_id);
  if (!profile)
    return invalid();
  if (profile.platform !== platformOf(env)) {
    return c.json({ error: { code: "UNAUTHORIZED_PLATFORM", message: "\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u062A\u0627\u0628\u0639 \u0644\u0645\u0646\u0635\u0629 \u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0623\u062E\u0631\u0649." } }, 403);
  }
  if (profile.status === "blocked") {
    return c.json({ error: { code: "ACCOUNT_BLOCKED", message: "\u062A\u0645 \u062D\u0638\u0631 \u062D\u0633\u0627\u0628\u0643. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633." } }, 403);
  }
  await env.DB.prepare(
    "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?"
  ).bind(stored.id).run();
  const tokens = await issueTokens(env, profile, {
    userAgent: c.req.header("user-agent"),
    ip: clientIp(c)
  });
  return c.json(tokens);
});
var logoutSchema = external_exports.object({ refresh_token: external_exports.string().min(1).max(500).optional() });
auth.post("/logout", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = logoutSchema.safeParse(body ?? {});
  const provided = parsed.success ? parsed.data.refresh_token : void 0;
  if (provided) {
    const tokenHash = await hashToken(provided);
    await c.env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND profile_id = ? AND revoked_at IS NULL"
    ).bind(tokenHash, user.id).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE profile_id = ? AND revoked_at IS NULL"
    ).bind(user.id).run();
  }
  return c.json({ ok: true });
});
auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const profile = await loadPublicProfile(c.env, user.id);
  if (!profile) {
    return c.json({ error: { code: "PROFILE_NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A." } }, 404);
  }
  return c.json({ user: profile });
});
var updateProfileSchema = external_exports.object({
  full_name: external_exports.string().trim().min(2).max(100).optional(),
  phone: external_exports.string().trim().max(20).optional(),
  parent_phone: external_exports.string().trim().max(20).optional(),
  grade: external_exports.string().trim().max(50).optional(),
  governorate: external_exports.string().trim().max(50).optional(),
  branch: external_exports.string().trim().max(50).optional().nullable()
});
auth.patch("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const fields = parsed.data;
  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(fields)) {
    if (val !== void 0) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (updates.length === 0) {
    return c.json({ error: { code: "NO_CHANGES", message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0639\u062F\u064A\u0644\u0627\u062A" } }, 400);
  }
  updates.push("updated_at = datetime('now')");
  values.push(user.id);
  await c.env.DB.prepare(
    `UPDATE profiles SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();
  const profile = await loadPublicProfile(c.env, user.id);
  return c.json({ user: profile });
});
var forgotSchema = external_exports.object({ email: external_exports.string().trim().toLowerCase().email().max(254) });
auth.post("/forgot-password", rateLimit("auth-forgot-password", 5, 900), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" } }, 400);
  }
  const env = c.env;
  const email = parsed.data.email;
  const profile = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?").bind(email).first();
  if (profile) {
    await env.DB.prepare(
      "UPDATE password_resets SET used_at = datetime('now') WHERE profile_id = ? AND used_at IS NULL"
    ).bind(profile.id).run();
    const token = generateOpaqueToken();
    const tokenHash = await hashToken(token);
    await env.DB.prepare(
      `INSERT INTO password_resets (id, profile_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, datetime('now', '+1 hour'), datetime('now'))`
    ).bind(generateId(), profile.id, tokenHash).run();
    if (env.ENVIRONMENT !== "production") {
      console.log(`[AUTH] Password reset token for ${email}: ${token}`);
    }
  }
  return c.json({ ok: true });
});
var resetSchema = external_exports.object({
  token: external_exports.string().min(1).max(500),
  password: external_exports.string().min(8).max(200)
});
auth.post("/reset-password", rateLimit("auth-reset-password", 10, 900), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const env = c.env;
  const tokenHash = await hashToken(parsed.data.token);
  const reset = await env.DB.prepare(
    `SELECT id, profile_id FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
  ).bind(tokenHash).first();
  if (!reset) {
    return c.json({ error: { code: "INVALID_RESET_TOKEN", message: "\u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0639\u064A\u064A\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" } }, 400);
  }
  const password_hash = await hashPassword(parsed.data.password);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(password_hash, reset.profile_id),
    env.DB.prepare(
      "UPDATE password_resets SET used_at = datetime('now') WHERE id = ?"
    ).bind(reset.id),
    // إلغاء كل الجلسات القائمة بعد تغيير كلمة المرور.
    env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE profile_id = ? AND revoked_at IS NULL"
    ).bind(reset.profile_id)
  ]);
  return c.json({ ok: true });
});
auth.post("/sync", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json({ ok: true, student: user, profile: user });
});
auth.post("/me/avatar", requireAuth, async (c) => {
  const user = c.get("user");
  const contentType = c.req.header("Content-Type") || "image/jpeg";
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(contentType)) {
    return c.json({ error: { code: "INVALID_TYPE", message: "\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645. \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0641\u0642\u0637: JPEG, PNG, WEBP" } }, 400);
  }
  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) {
    return c.json({ error: { code: "EMPTY_FILE", message: "\u0627\u0644\u0635\u0648\u0631\u0629 \u0641\u0627\u0631\u063A\u0629" } }, 400);
  }
  if (body.byteLength > 5 * 1024 * 1024) {
    return c.json({ error: { code: "TOO_LARGE", message: "\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0642\u0644 \u0645\u0646 5 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A" } }, 413);
  }
  const uint8 = new Uint8Array(body);
  let detectedType = "";
  if (uint8[0] === 255 && uint8[1] === 216 && uint8[2] === 255) {
    detectedType = "image/jpeg";
  } else if (uint8[0] === 137 && uint8[1] === 80 && uint8[2] === 78 && uint8[3] === 71) {
    detectedType = "image/png";
  } else if (uint8[0] === 82 && uint8[1] === 73 && uint8[2] === 70 && uint8[3] === 70 && uint8[8] === 87 && uint8[9] === 69 && uint8[10] === 66 && uint8[11] === 80) {
    detectedType = "image/webp";
  }
  if (!detectedType) {
    return c.json({ error: { code: "INVALID_IMAGE", message: "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645 (JPEG/PNG/WEBP \u0641\u0642\u0637)" } }, 400);
  }
  const key = `avatars/${user.id}`;
  await c.env.R2.put(key, body, { httpMetadata: { contentType: detectedType } });
  const origin = new URL(c.req.url).origin;
  const avatarUrl = `${origin}/files/avatars/${user.id}?v=${Date.now()}`;
  await c.env.DB.prepare(
    "UPDATE profiles SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(avatarUrl, user.id).run();
  return c.json({ ok: true, avatar_url: avatarUrl });
});
var deviceSchema = external_exports.object({
  device_id: external_exports.string().min(1),
  platform: external_exports.enum(["android", "ios", "web"]),
  model: external_exports.string().optional(),
  push_token: external_exports.string().optional(),
  is_rooted: external_exports.boolean().optional()
});
auth.post("/me/devices", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = deviceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const existing = await c.env.DB.prepare(
    "SELECT id FROM devices WHERE student_id = ? AND device_id = ?"
  ).bind(user.id, d.device_id).first();
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE devices SET push_token = ?, model = ?, is_rooted = ?, last_login_at = datetime('now') WHERE id = ?`
    ).bind(d.push_token || null, d.model || null, d.is_rooted ? 1 : 0, existing.id).run();
    return c.json({ ok: true, device_id: existing.id, new: false });
  }
  const { count } = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM devices WHERE student_id = ?"
  ).bind(user.id).first() || { count: 0 };
  if (count >= user.maxDevices) {
    return c.json({ error: { code: "DEVICE_LIMIT_EXCEEDED", message: `\u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0645\u0646 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 (${user.maxDevices}). \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633.` } }, 423);
  }
  const id = generateId();
  const isTrusted = d.platform === "web" ? 0 : 1;
  await c.env.DB.prepare(
    `INSERT INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, user.id, d.device_id, d.platform, d.model || null, d.push_token || null, isTrusted, d.is_rooted ? 1 : 0).run();
  return c.json({ ok: true, device_id: id, new: true }, 201);
});
auth.get("/me/devices", requireAuth, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    "SELECT id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at FROM devices WHERE student_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();
  return c.json({ devices: results });
});
auth.delete("/me/devices/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const deviceDbId = c.req.param("id");
  const device = await c.env.DB.prepare(
    "SELECT id FROM devices WHERE id = ? AND student_id = ?"
  ).bind(deviceDbId, user.id).first();
  if (!device) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(deviceDbId).run();
  return c.json({ ok: true });
});
auth.get("/me/financials", requireAuth, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT ft.*, c.title as course_title, ac.code as code_string
     FROM financial_transactions ft
     LEFT JOIN courses c ON ft.course_id = c.id
     LEFT JOIN activation_codes ac ON ft.code_id = ac.id
     WHERE ft.student_id = ?
     ORDER BY ft.created_at DESC`
  ).bind(user.id).all();
  return c.json({ financials: results });
});
auth.get("/me/playback-logs", requireAuth, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT lpl.*, l.title as lesson_title, l.course_id as course_id
     FROM lecture_playback_logs lpl
     INNER JOIN lessons l ON lpl.lesson_id = l.id
     WHERE lpl.student_id = ?
     ORDER BY lpl.created_at DESC
     LIMIT 100`
  ).bind(user.id).all();
  return c.json({ playback_logs: results });
});
auth.get("/me/quizzes/attempts", requireAuth, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT qa.*, q.title as quiz_title, q.max_score
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON qa.quiz_id = q.id
     WHERE qa.student_id = ?
     ORDER BY qa.submitted_at DESC`
  ).bind(user.id).all();
  return c.json({ quiz_attempts: results });
});
auth.post("/me/devices/reset-request", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const schema = external_exports.object({
    device_id: external_exports.string().min(1),
    platform: external_exports.enum(["android", "ios", "web"]),
    model: external_exports.string().optional(),
    reason: external_exports.string().min(5),
    proof_image_url: external_exports.string().optional()
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const existing = await c.env.DB.prepare(
    "SELECT id FROM device_reset_requests WHERE student_id = ? AND status = 'pending'"
  ).bind(user.id).first();
  if (existing) {
    return c.json({ error: { code: "PENDING_REQUEST_EXISTS", message: "\u0644\u062F\u064A\u0643 \u0637\u0644\u0628 \u0641\u0643 \u0623\u062C\u0647\u0632\u0629 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0628\u0627\u0644\u0641\u0639\u0644" } }, 400);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO device_reset_requests (id, student_id, device_id, platform, model, reason, proof_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
  ).bind(id, user.id, d.device_id, d.platform, d.model || null, d.reason, d.proof_image_url || null).run();
  return c.json({ ok: true, request_id: id }, 201);
});
auth.get("/me/devices/reset-requests", requireAuth, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT id, device_id, platform, model, reason, proof_image_url, status, rejection_reason AS admin_notes, created_at, updated_at FROM device_reset_requests WHERE student_id = ? ORDER BY created_at DESC`
  ).bind(user.id).all();
  return c.json({ reset_requests: results });
});
var auth_default = auth;

// src/lib/access.ts
var ACCESS_LABELS = {
  free: "\u0645\u062C\u0627\u0646\u064A",
  locked: "\u0645\u0642\u0641\u0644",
  pending: "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
  ready: "\u062C\u0627\u0647\u0632",
  awaiting_approval: "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
  buy_exam: "\u0634\u0631\u0627\u0621 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646",
  solve_exam: "\u062D\u0644 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646",
  purchased_badge: "\u0645\u0646\u0634\u0623\u0629",
  plan_badge: "\u062E\u0637\u0629",
  paid_badge: "\u0645\u062F\u0641\u0648\u0639",
  free_badge: "\u0645\u062C\u0627\u0646\u064A"
};
var PURCHASE_LABELS = {
  page_title: "\u0645\u0634\u062A\u0631\u064A\u0627\u062A\u064A",
  page_subtitle: "\u062A\u0627\u0628\u0639 \u0637\u0644\u0628\u0627\u062A \u0634\u0631\u0627\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A",
  pending: "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
  approved: "\u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u064A\u0647",
  rejected: "\u0645\u0631\u0641\u0648\u0636",
  empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0637\u0644\u0628\u0627\u062A \u0634\u0631\u0627\u0621",
  price: "\u0627\u0644\u0633\u0639\u0631",
  requested_at: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0644\u0628",
  transfer_proof: "\u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644",
  modal_title: "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631",
  modal_hint: "\u0627\u0631\u0641\u0639 \u0644\u0642\u0637\u0629 \u0634\u0627\u0634\u0629 \u0644\u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0628\u0646\u0643\u064A.",
  pick_image: "\u0627\u062E\u062A\u0631 \u0635\u0648\u0631\u0629",
  submit: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628",
  cancel: "\u0625\u0644\u063A\u0627\u0621",
  error_image_required: "\u0635\u0648\u0631\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0645\u0637\u0644\u0648\u0628\u0629",
  success: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u0628\u0646\u062C\u0627\u062D",
  dashboard_card: "\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0645\u0639\u0644\u0642\u0629"
};
async function resolveExamAccess(env, userId, exam) {
  const platform = env.PLATFORM_KEY || "fusha";
  const examRow = await env.DB.prepare(
    "SELECT price, is_custom, is_free FROM quizzes WHERE id = ?"
  ).bind(exam.id).first();
  const price = examRow?.price ?? 0;
  const isCustom = examRow?.is_custom ?? 0;
  if (exam.is_free === 1 || examRow?.is_free === 1) {
    return { state: "free", price, is_custom: isCustom, via: "free_exam", bundle_id: null };
  }
  const course = await env.DB.prepare(
    "SELECT is_free FROM courses WHERE id = ? AND platform = ?"
  ).bind(exam.course_id, platform).first();
  if (course?.is_free === 1) {
    return { state: "free", price, is_custom: isCustom, via: "free_course", bundle_id: null };
  }
  if (!userId) {
    return { state: "locked", price, is_custom: isCustom, via: null, bundle_id: null };
  }
  const enrollment = await env.DB.prepare(
    "SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'"
  ).bind(userId, exam.course_id).first();
  if (enrollment) {
    return { state: "ready", price, is_custom: isCustom, via: "enrollment", bundle_id: null };
  }
  const approved = await env.DB.prepare(
    `SELECT target_type, bundle_id FROM purchase_requests
     WHERE student_id = ? AND platform = ? AND status = 'approved'
       AND (
         (target_type = 'exam' AND exam_id = ?)
         OR (target_type = 'course' AND course_id = ?)
         OR (target_type = 'bundle' AND bundle_id IN (
              SELECT bundle_id FROM bundle_courses WHERE course_id = ?
            ))
       )
     ORDER BY CASE target_type WHEN 'exam' THEN 0 WHEN 'course' THEN 1 ELSE 2 END
     LIMIT 1`
  ).bind(userId, platform, exam.id, exam.course_id, exam.course_id).first();
  if (approved) {
    const via = approved.target_type === "exam" ? "exam_purchase" : approved.target_type === "course" ? "course_purchase" : "bundle_purchase";
    return {
      state: "ready",
      price,
      is_custom: isCustom,
      via,
      bundle_id: approved.target_type === "bundle" ? approved.bundle_id : null
    };
  }
  const pending = await env.DB.prepare(
    `SELECT id FROM purchase_requests
     WHERE student_id = ? AND platform = ? AND status = 'pending'
       AND (
         (target_type = 'exam' AND exam_id = ?)
         OR (target_type = 'course' AND course_id = ?)
         OR (target_type = 'bundle' AND bundle_id IN (
              SELECT bundle_id FROM bundle_courses WHERE course_id = ?
            ))
       )
     LIMIT 1`
  ).bind(userId, platform, exam.id, exam.course_id, exam.course_id).first();
  if (pending) {
    return { state: "pending", price, is_custom: isCustom, via: null, bundle_id: null };
  }
  return { state: "locked", price, is_custom: isCustom, via: null, bundle_id: null };
}
__name(resolveExamAccess, "resolveExamAccess");
function canAccess(state) {
  return state === "free" || state === "ready";
}
__name(canAccess, "canAccess");
function examCategoryLabel(exam, access, planExamCount) {
  if (access.state === "free" || exam.is_free === 1)
    return ACCESS_LABELS.free_badge;
  if (access.via === "bundle_purchase" && planExamCount !== null) {
    return `${ACCESS_LABELS.plan_badge} (${planExamCount} \u0627\u0645\u062A\u062D\u0627\u0646)`;
  }
  if (exam.is_custom === 1)
    return ACCESS_LABELS.purchased_badge;
  return ACCESS_LABELS.paid_badge;
}
__name(examCategoryLabel, "examCategoryLabel");

// src/lib/mistakes.ts
var LATIN_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
var ARABIC_LETTERS = ["\u0623", "\u0628", "\u062C", "\u062F", "\u0647\u0640", "\u0648", "\u0632", "\u062D"];
function parseOptions(optionsJson) {
  if (!optionsJson)
    return null;
  try {
    const parsed = JSON.parse(optionsJson);
    if (!Array.isArray(parsed))
      return null;
    return parsed.map((entry) => {
      if (typeof entry === "string")
        return entry;
      if (entry && typeof entry === "object") {
        const obj = entry;
        const value = obj.text ?? obj.label ?? obj.value ?? obj.title;
        if (typeof value === "string")
          return value;
      }
      return "";
    });
  } catch {
    return null;
  }
}
__name(parseOptions, "parseOptions");
function resolveCorrectOptionText(optionsJson, correctOption) {
  const raw2 = (correctOption ?? "").trim();
  if (!raw2)
    return "";
  const options = parseOptions(optionsJson);
  if (!options)
    return raw2;
  const upper = raw2.toUpperCase();
  const latinIndex = LATIN_LETTERS.indexOf(upper);
  if (latinIndex >= 0 && options[latinIndex])
    return options[latinIndex];
  const arabicIndex = ARABIC_LETTERS.indexOf(raw2);
  if (arabicIndex >= 0 && options[arabicIndex])
    return options[arabicIndex];
  return raw2;
}
__name(resolveCorrectOptionText, "resolveCorrectOptionText");
function mistakeId(studentId, source, questionId, quizId) {
  return `mistake:${studentId}:${source}:${questionId}:${quizId || "practice"}`;
}
__name(mistakeId, "mistakeId");
async function recordMistake(env, input) {
  const quizId = input.quizId || null;
  const id = mistakeId(input.studentId, input.source, input.questionId, quizId);
  const pointsLost = Number.isFinite(input.pointsLost) ? Math.max(0, Math.trunc(input.pointsLost)) : 0;
  await env.DB.prepare(
    `INSERT INTO student_mistakes
       (id, platform, student_id, question_id, question_source, quiz_id, exam_id, question_text, given_answer, correct_answer, points_lost, is_resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       question_text  = excluded.question_text,
       given_answer   = excluded.given_answer,
       correct_answer = excluded.correct_answer,
       points_lost    = excluded.points_lost,
       exam_id        = excluded.exam_id,
       is_resolved    = 0,
       resolved_at    = NULL`
  ).bind(
    id,
    env.PLATFORM_KEY || "fusha",
    input.studentId,
    input.questionId,
    input.source,
    quizId || "",
    input.examId ?? null,
    input.questionText ?? null,
    input.givenAnswer ?? null,
    input.correctAnswer ?? null,
    pointsLost
  ).run();
}
__name(recordMistake, "recordMistake");

// src/routes/courses.ts
var courses = new Hono2();
var EXAM_COMPLETION_POINTS = 10;
async function countBundleExams(env, bundleId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM quizzes q
     INNER JOIN bundle_courses bc ON bc.course_id = q.course_id
     WHERE bc.bundle_id = ? AND q.lesson_id IS NULL AND q.is_published = 1`
  ).bind(bundleId).first();
  return row?.count ?? 0;
}
__name(countBundleExams, "countBundleExams");
function buildCorrectAnswerReason(correctOptionText, explanation) {
  if (!correctOptionText)
    return null;
  const reason = (explanation || "").trim();
  return `\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 \u0647\u064A \xAB${correctOptionText}\xBB${reason ? ` \u0644\u0623\u0646 ${reason}` : ""}`;
}
__name(buildCorrectAnswerReason, "buildCorrectAnswerReason");
courses.get("/public-exams", async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const query = `
    SELECT q.id, q.title, q.max_score, q.course_id, c.title as course_title,
           q.cover_image, q.start_time, q.end_time, q.time_limit_mins
    FROM quizzes q
    INNER JOIN courses c ON q.course_id = c.id
    WHERE q.lesson_id IS NULL AND q.is_published = 1 AND q.is_free = 1 AND c.platform = ? AND c.is_archived = 0
    ORDER BY q.created_at DESC
  `;
  const { results: exams } = await c.env.DB.prepare(query).bind(platform).all();
  return c.json({ exams });
});
courses.get("/public-exams/:id", async (c) => {
  const examId = c.req.param("id");
  const exam = await c.env.DB.prepare(
    "SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1 AND is_free = 1"
  ).bind(examId).first();
  if (!exam) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0643\u0645\u0639\u0627\u064A\u0646\u0629 \u0645\u062C\u0627\u0646\u064A\u0629" } }, 404);
  }
  const { results: questions2 } = await c.env.DB.prepare(
    "SELECT id, question_text, image_url, options_json, score, sort_order FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC"
  ).bind(exam.id).all();
  let mappedQuestions = questions2.map((q) => ({
    ...q,
    options: JSON.parse(q.options_json)
  }));
  if (exam.randomize_questions === 1) {
    const shuffled = [...mappedQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    mappedQuestions = shuffled;
  }
  return c.json({
    exam,
    questions: mappedQuestions
  });
});
courses.post("/public-exams/:id/submit", rateLimit("public_exam_submit", 10, 60), async (c) => {
  const examId = c.req.param("id");
  const body = await c.req.json();
  const submitSchema2 = external_exports.object({
    answers: external_exports.record(external_exports.string())
  });
  const parsed = submitSchema2.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const studentAnswers = parsed.data.answers;
  const exam = await c.env.DB.prepare(
    "SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1 AND is_free = 1"
  ).bind(examId).first();
  if (!exam) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results: questions2 } = await c.env.DB.prepare(
    "SELECT id, options_json, correct_option, explanation, score FROM quiz_questions WHERE quiz_id = ?"
  ).bind(exam.id).all();
  let totalScore = 0;
  let earnedScore = 0;
  const gradedQuestions = {};
  for (const q of questions2) {
    const chosen = studentAnswers[q.id] || null;
    const isCorrect = chosen === q.correct_option;
    totalScore += q.score;
    if (isCorrect) {
      earnedScore += q.score;
    }
    const entry = {
      correct: isCorrect,
      correctOption: q.correct_option,
      chosenOption: chosen
    };
    if (!isCorrect) {
      const correctOptionText = resolveCorrectOptionText(q.options_json, q.correct_option);
      entry.correct_option_text = correctOptionText;
      entry.explanation = q.explanation ?? null;
      entry.correct_answer_reason = buildCorrectAnswerReason(correctOptionText, q.explanation);
    }
    gradedQuestions[q.id] = entry;
  }
  const scoreRatio = totalScore > 0 ? earnedScore / totalScore : 0;
  const finalScore = Math.round(scoreRatio * exam.max_score * 100) / 100;
  return c.json({
    success: true,
    score: finalScore,
    max_score: exam.max_score,
    gradedQuestions
  });
});
courses.get("/", optionalAuth, async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const grade = c.req.query("grade");
  const branch = c.req.query("branch");
  const platform = c.env.PLATFORM_KEY || "fusha";
  let whereClause = "c.is_archived = 0 AND c.is_published = 1 AND c.platform = ?";
  const params = [platform];
  let filterGrade = grade;
  let filterBranch = branch;
  if (user && user.role === "student") {
    if (user.grade && user.grade.trim() !== "") {
      filterGrade = user.grade;
    }
    if (user.branch && user.branch.trim() !== "") {
      filterBranch = user.branch;
    }
  }
  if (filterGrade && filterGrade.trim() !== "") {
    whereClause += " AND (c.grade = ? OR ? LIKE c.grade || '%' OR c.grade = '\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0631\u0627\u062D\u0644')";
    params.push(filterGrade, filterGrade);
  }
  if (filterBranch && filterBranch.trim() !== "") {
    whereClause += " AND (c.branch = ? OR c.branch IS NULL OR c.branch = '' OR c.branch = '\u0639\u0627\u0645')";
    params.push(filterBranch);
  } else if (user && user.role === "student") {
    whereClause += " AND (c.branch IS NULL OR c.branch = '' OR c.branch = '\u0639\u0627\u0645')";
  }
  const isStudentOrGuestForCounts = !user || user.role === "student";
  const readyLessonsCountFilter = isStudentOrGuestForCounts ? ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id AND v.status = 'ready'))` : "";
  let query = "";
  let bindParams = [];
  if (user) {
    query = `SELECT c.*,
       CASE WHEN (e.id IS NOT NULL AND e.status = 'active') OR c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled,
       e.expires_at as enrollment_expires_at,
       (SELECT COUNT(*) FROM units WHERE course_id = c.id AND is_archived = 0 AND is_published = 1) as units_count,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsCountFilter}) as lessons_count
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? AND e.status = 'active'
     WHERE ${whereClause}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`;
    bindParams = [user.id, ...params, limit, offset];
  } else {
    query = `SELECT c.*,
       CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled,
       NULL as enrollment_expires_at,
       (SELECT COUNT(*) FROM units WHERE course_id = c.id AND is_archived = 0 AND is_published = 1) as units_count,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsCountFilter}) as lessons_count
     FROM courses c
     WHERE ${whereClause}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`;
    bindParams = [...params, limit, offset];
  }
  const { results } = await c.env.DB.prepare(query).bind(...bindParams).all();
  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM courses c WHERE ${whereClause}`
  ).bind(...params).first() || { count: 0 };
  const mapped = results.map((course) => ({
    ...course,
    cover_image: course.cover_url || ""
  }));
  return c.json({
    courses: mapped,
    meta: { page, limit, total, has_more: offset + limit < total }
  });
});
courses.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const readyLessonsFilter = ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id AND v.status = 'ready'))`;
  let freeCoursesWhere = "c.is_free = 1 AND c.is_published = 1 AND c.is_archived = 0 AND c.platform = ? AND c.id NOT IN (SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active')";
  const freeCoursesParams = [platform, user.id];
  if (user.role === "student") {
    if (user.grade && user.grade.trim() !== "") {
      freeCoursesWhere += " AND (c.grade = ? OR ? LIKE c.grade || '%' OR c.grade = '\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0631\u0627\u062D\u0644')";
      freeCoursesParams.push(user.grade, user.grade);
    }
    if (user.branch && user.branch.trim() !== "") {
      freeCoursesWhere += " AND (c.branch = ? OR c.branch IS NULL OR c.branch = '' OR c.branch = '\u0639\u0627\u0645')";
      freeCoursesParams.push(user.branch);
    } else {
      freeCoursesWhere += " AND (c.branch IS NULL OR c.branch = '' OR c.branch = '\u0639\u0627\u0645')";
    }
  }
  const query = `
    SELECT c.*, e.granted_at, e.expires_at as enrollment_expires_at, e.status as enrollment_status,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsFilter}) as total_lessons,
      (SELECT COUNT(*) FROM lesson_progress lp
       JOIN lessons ON lessons.id = lp.lesson_id AND lessons.course_id = lp.course_id
       WHERE lp.course_id = c.id AND lp.student_id = ? AND lp.is_completed = 1
         AND lessons.is_archived = 0 AND lessons.is_published = 1${readyLessonsFilter}) as completed_lessons
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.student_id = ? AND e.status = 'active' AND c.is_archived = 0 AND c.platform = ?

    UNION

    SELECT c.*, NULL as granted_at, NULL as enrollment_expires_at, 'free' as enrollment_status,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsFilter}) as total_lessons,
      (SELECT COUNT(*) FROM lesson_progress lp
       JOIN lessons ON lessons.id = lp.lesson_id AND lessons.course_id = lp.course_id
       WHERE lp.course_id = c.id AND lp.student_id = ? AND lp.is_completed = 1
         AND lessons.is_archived = 0 AND lessons.is_published = 1${readyLessonsFilter}) as completed_lessons
    FROM courses c
    WHERE ${freeCoursesWhere}

    ORDER BY granted_at DESC
  `;
  const bindParams = [
    user.id,
    // for completed_lessons in 1st SELECT
    user.id,
    // for e.student_id in 1st SELECT
    platform,
    // for c.platform in 1st SELECT
    user.id,
    // for completed_lessons in 2nd SELECT
    ...freeCoursesParams
  ];
  const { results } = await c.env.DB.prepare(query).bind(...bindParams).all();
  const mapped = results.map((course) => ({
    ...course,
    cover_image: course.cover_url || "",
    lessons_count: course.total_lessons || 0
  }));
  return c.json({ courses: mapped });
});
courses.get("/exams", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  let query = `
    SELECT q.id, q.title, q.max_score, q.course_id, c.title as course_title,
           q.cover_image, q.start_time, q.end_time, q.time_limit_mins, q.is_free,
           q.price, q.is_custom,
           qa.score as student_score, qa.submitted_at, qa.started_at, qa.is_submitted
    FROM quizzes q
    INNER JOIN courses c ON q.course_id = c.id
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = ?
    WHERE q.lesson_id IS NULL AND q.is_published = 1 AND c.platform = ? AND c.is_archived = 0
  `;
  const params = [user.id, platform];
  if (user.role === "student") {
    if (user.grade && user.grade.trim() !== "") {
      query += " AND (c.grade = ? OR ? LIKE c.grade || '%' OR c.grade = '\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0631\u0627\u062D\u0644')";
      params.push(user.grade, user.grade);
    }
    if (user.branch && user.branch.trim() !== "") {
      query += " AND (c.branch = ? OR c.branch IS NULL OR c.branch = '' OR c.branch = '\u0639\u0627\u0645')";
      params.push(user.branch);
    } else {
      query += " AND (c.branch IS NULL OR c.branch = '' OR c.branch = '\u0639\u0627\u0645')";
    }
  }
  query += " ORDER BY q.created_at DESC";
  const { results: exams } = await c.env.DB.prepare(query).bind(...params).all();
  const withAccess = await Promise.all(exams.map(async (exam) => {
    const access = await resolveExamAccess(c.env, user.id, exam);
    const canOpen = canAccess(access.state);
    const planExamCount = access.via === "bundle_purchase" && access.bundle_id ? await countBundleExams(c.env, access.bundle_id) : null;
    return {
      ...exam,
      access_state: access.state,
      access_label: ACCESS_LABELS[access.state],
      can_access: canOpen,
      action_label: canOpen ? ACCESS_LABELS.solve_exam : access.state === "pending" ? ACCESS_LABELS.awaiting_approval : `\u0634\u0631\u0627\u0621 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 (${exam.price ?? 0} \u062C\u0646\u064A\u0647)`,
      category_label: examCategoryLabel(exam, access, planExamCount)
    };
  }));
  return c.json({ exams: withAccess, labels: ACCESS_LABELS, currency: "\u062C\u0646\u064A\u0647" });
});
courses.get("/exams/:id", requireAuth, async (c) => {
  const examId = c.req.param("id");
  const user = c.get("user");
  const exam = await c.env.DB.prepare(
    "SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1"
  ).bind(examId).first();
  if (!exam) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u063A\u064A\u0631 \u0645\u0646\u0634\u0648\u0631" } }, 404);
  }
  const access = await resolveExamAccess(c.env, user.id, exam);
  if (!canAccess(access.state)) {
    return c.json({
      error: {
        code: access.state === "pending" ? "PURCHASE_PENDING" : "EXAM_LOCKED",
        message: access.state === "pending" ? "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u0633\u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644\u0647 \u0628\u0639\u062F \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629." : "\u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0645\u062F\u0641\u0648\u0639. \u064A\u0631\u062C\u0649 \u0634\u0631\u0627\u0621 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u064A\u0647.",
        access_state: access.state,
        price: access.price
      }
    }, 403);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (exam.start_time && now < exam.start_time) {
    return c.json({ error: { code: "NOT_STARTED", message: `\u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0628\u0639\u062F. \u0633\u064A\u0628\u062F\u0623 \u0641\u064A: ${new Date(exam.start_time).toLocaleString("ar-EG")}` } }, 403);
  }
  let attempt = await c.env.DB.prepare(
    "SELECT id, score, submitted_at, answers_json, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?"
  ).bind(user.id, exam.id).first();
  if (exam.end_time && now > exam.end_time && (!attempt || attempt.is_submitted === 0)) {
    return c.json({ error: { code: "EXPIRED", message: "\u0627\u0646\u062A\u0647\u0649 \u0648\u0642\u062A \u062F\u062E\u0648\u0644 \u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0628\u062F\u0621 \u0645\u062D\u0627\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629." } }, 403);
  }
  if (!attempt && exam.time_limit_mins) {
    const attemptId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
       VALUES (?, ?, ?, 0, '{}', ?, 0, ?, ?)`
    ).bind(attemptId, user.id, exam.id, now, now, now).run();
    attempt = {
      id: attemptId,
      score: 0,
      started_at: now,
      is_submitted: 0,
      answers_json: "{}"
    };
  }
  const selectFields = attempt && attempt.is_submitted === 1 ? "id, question_text, image_url, options_json, correct_option, score, sort_order" : "id, question_text, image_url, options_json, score, sort_order";
  const { results: questions2 } = await c.env.DB.prepare(
    `SELECT ${selectFields} FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(exam.id).all();
  let mappedQuestions = questions2.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    image_url: q.image_url,
    options: JSON.parse(q.options_json),
    score: q.score,
    sort_order: q.sort_order,
    ...q.correct_option !== void 0 ? { correct_option: q.correct_option } : {}
  }));
  if (exam.randomize_questions === 1 && (!attempt || attempt.is_submitted === 0)) {
    const shuffled = [...mappedQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    mappedQuestions = shuffled;
  }
  return c.json({
    exam,
    questions: mappedQuestions,
    attempt: attempt ? {
      ...attempt,
      answers: JSON.parse(attempt.answers_json || "{}")
    } : null
  });
});
courses.post("/exams/:id/submit", requireAuth, rateLimit("exam_submit", 10, 60), async (c) => {
  const examId = c.req.param("id");
  const user = c.get("user");
  const body = await c.req.json();
  const submitSchema2 = external_exports.object({
    answers: external_exports.record(external_exports.string())
  });
  const parsed = submitSchema2.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const studentAnswers = parsed.data.answers;
  const exam = await c.env.DB.prepare(
    "SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1"
  ).bind(examId).first();
  if (!exam) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const access = await resolveExamAccess(c.env, user.id, exam);
  if (!canAccess(access.state)) {
    return c.json({
      error: {
        code: access.state === "pending" ? "PURCHASE_PENDING" : "EXAM_LOCKED",
        message: access.state === "pending" ? "\u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u0633\u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644\u0647 \u0628\u0639\u062F \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629." : "\u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0645\u062F\u0641\u0648\u0639. \u064A\u0631\u062C\u0649 \u0634\u0631\u0627\u0621 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u064A\u0647.",
        access_state: access.state,
        price: access.price
      }
    }, 403);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (exam.start_time && now < exam.start_time) {
    return c.json({ error: { code: "FORBIDDEN", message: "\u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0628\u0639\u062F" } }, 403);
  }
  const existingAttempt = await c.env.DB.prepare(
    "SELECT id, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?"
  ).bind(user.id, exam.id).first();
  if (existingAttempt && existingAttempt.is_submitted === 1) {
    return c.json({ error: { code: "ALREADY_SUBMITTED", message: "\u0644\u0642\u062F \u0642\u0645\u062A \u0628\u062A\u0633\u0644\u064A\u0645 \u0647\u0630\u0627 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0645\u0633\u0628\u0642\u0627\u064B" } }, 400);
  }
  if (exam.time_limit_mins && existingAttempt && existingAttempt.started_at) {
    const startTime = new Date(existingAttempt.started_at).getTime();
    const nowTime = Date.now();
    const limitMs = (exam.time_limit_mins + 2) * 60 * 1e3;
    if (nowTime - startTime > limitMs) {
    }
  }
  const { results: questions2 } = await c.env.DB.prepare(
    "SELECT id, question_text, options_json, correct_option, explanation, score FROM quiz_questions WHERE quiz_id = ?"
  ).bind(exam.id).all();
  let totalScore = 0;
  let earnedScore = 0;
  const mistakesToRecord = [];
  const gradedQuestions = questions2.map((q) => {
    const selected = studentAnswers[q.id] || "";
    const isCorrect = selected.trim() === q.correct_option.trim();
    totalScore += q.score;
    if (isCorrect) {
      earnedScore += q.score;
    }
    const correctOptionText = resolveCorrectOptionText(q.options_json, q.correct_option);
    const wrongAnswerReason = isCorrect ? null : buildCorrectAnswerReason(correctOptionText, q.explanation);
    if (!isCorrect) {
      mistakesToRecord.push({
        questionId: q.id,
        questionText: q.question_text ?? null,
        givenAnswer: selected,
        correctAnswer: correctOptionText,
        correctOptionText,
        pointsLost: q.score,
        explanation: q.explanation ?? null
      });
    }
    return {
      question_id: q.id,
      selected,
      correct: q.correct_option,
      is_correct: isCorrect,
      ...isCorrect ? {} : {
        correct_option_text: correctOptionText,
        explanation: q.explanation ?? null,
        correct_answer_reason: wrongAnswerReason
      }
    };
  });
  const scoreRatio = totalScore > 0 ? earnedScore / totalScore : 0;
  const finalScore = scoreRatio * exam.max_score;
  if (existingAttempt) {
    await c.env.DB.prepare(
      `UPDATE quiz_attempts 
       SET score = ?, answers_json = ?, is_submitted = 1, submitted_at = ?
       WHERE id = ?`
    ).bind(finalScore, JSON.stringify(studentAnswers), now, existingAttempt.id).run();
  } else {
    const attemptId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(attemptId, user.id, exam.id, finalScore, JSON.stringify(studentAnswers), now, now, now).run();
  }
  for (const mistake of mistakesToRecord) {
    await recordMistake(c.env, {
      studentId: user.id,
      questionId: mistake.questionId,
      source: "quiz",
      quizId: exam.id,
      examId: exam.id,
      questionText: mistake.questionText,
      givenAnswer: mistake.givenAnswer,
      correctAnswer: mistake.correctAnswer,
      pointsLost: mistake.pointsLost
    });
  }
  const points2 = await awardPoints(c.env, user.id, EXAM_COMPLETION_POINTS, "exam_completed", {
    referenceId: exam.id,
    note: `\u0625\u062A\u0645\u0627\u0645 \u0627\u0645\u062A\u062D\u0627\u0646: ${exam.title}`
  });
  return c.json({
    ok: true,
    score: finalScore,
    max_score: exam.max_score,
    graded: gradedQuestions,
    points: { awarded: points2.awarded, total_points: points2.total_points, level: points2.level, level_up: points2.level_up }
  });
});
courses.get("/:id", optionalAuth, async (c) => {
  const courseId = c.req.param("id");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  let courseQuery = "";
  let courseParams = [];
  if (user) {
    courseQuery = `SELECT c.*,
       CASE WHEN (e.id IS NOT NULL AND e.status = 'active') OR c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? AND e.status = 'active'
     WHERE c.id = ? AND c.is_archived = 0 AND c.platform = ?`;
    courseParams = [user.id, courseId, platform];
  } else {
    courseQuery = `SELECT c.*,
       CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled
     FROM courses c
     WHERE c.id = ? AND c.is_archived = 0 AND c.platform = ?`;
    courseParams = [courseId, platform];
  }
  const course = await c.env.DB.prepare(courseQuery).bind(...courseParams).first();
  if (!course) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0648\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const isStudentOrGuest = !user || user.role === "student";
  const { results: units } = await c.env.DB.prepare(
    `SELECT * FROM units WHERE course_id = ? AND is_archived = 0${isStudentOrGuest ? " AND is_published = 1" : ""} ORDER BY sort_order ASC`
  ).bind(courseId).all();
  const publishedLessonFilter = isStudentOrGuest ? " AND l.is_published = 1" : "";
  const readyVideoFilter = isStudentOrGuest ? ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = l.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = l.id AND v.status = 'ready'))` : "";
  let lessonsQuery = "";
  let lessonsParams = [];
  if (user) {
    lessonsQuery = `SELECT l.id, l.unit_id, l.title, l.description, l.sort_order, l.is_free_preview,
            l.is_published,
            COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds,
            CASE WHEN lp.is_completed = 1 THEN 1 ELSE 0 END as is_completed,
            COALESCE(lp.last_position, 0) as last_position
     FROM lessons l
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = ?
     WHERE l.course_id = ? AND l.is_archived = 0${publishedLessonFilter}${readyVideoFilter}
     ORDER BY l.sort_order ASC`;
    lessonsParams = [user.id, courseId];
  } else {
    lessonsQuery = `SELECT l.id, l.unit_id, l.title, l.description, l.sort_order, l.is_free_preview,
            l.is_published,
            COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds,
            0 as is_completed,
            0 as last_position
     FROM lessons l
     WHERE l.course_id = ? AND l.is_archived = 0${publishedLessonFilter}${readyVideoFilter}
     ORDER BY l.sort_order ASC`;
    lessonsParams = [courseId];
  }
  const { results: lessons } = await c.env.DB.prepare(lessonsQuery).bind(...lessonsParams).all();
  const unitsWithLessons = units.map((unit) => ({
    ...unit,
    name: unit.title,
    lessons: lessons.filter((l) => l.unit_id === unit.id)
  }));
  const mappedCourse = {
    ...course,
    cover_image: course.cover_url || ""
  };
  return c.json({
    ...mappedCourse,
    course: mappedCourse,
    units: unitsWithLessons
  });
});
courses.get("/lessons/:id", optionalAuth, async (c) => {
  const lessonId = c.req.param("id");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const lesson = await c.env.DB.prepare(
    `SELECT l.*, c.is_free as course_is_free FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND c.platform = ?`
  ).bind(lessonId, platform).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const isFree = lesson.is_free_preview === 1 || lesson.is_free_preview === true || lesson.course_is_free === 1 || lesson.course_is_free === true;
  if (!isFree) {
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 401);
    }
    if (user.role === "student") {
      const enrollment = await c.env.DB.prepare(
        `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first();
      if (!enrollment) {
        return c.json({ error: { code: "NOT_ENROLLED", message: "\u064A\u062C\u0628 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633 \u0623\u0648\u0644\u0627\u064B \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 403);
      }
    }
  }
  const isStudentOrGuestForVideos = !user || user.role === "student";
  const videosQuery = isStudentOrGuestForVideos ? `SELECT id, provider, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order FROM lesson_videos WHERE lesson_id = ? AND status = 'ready' ORDER BY sort_order ASC` : `SELECT id, provider, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order FROM lesson_videos WHERE lesson_id = ? ORDER BY sort_order ASC`;
  const { results: videos } = await c.env.DB.prepare(videosQuery).bind(lessonId).all();
  const { results: files } = await c.env.DB.prepare(
    "SELECT id, title, mime_type, size_bytes, is_downloadable, watermark, sort_order FROM lesson_files WHERE lesson_id = ? ORDER BY sort_order ASC"
  ).bind(lessonId).all();
  let progress = null;
  if (user) {
    progress = await c.env.DB.prepare(
      "SELECT * FROM lesson_progress WHERE student_id = ? AND lesson_id = ?"
    ).bind(user.id, lessonId).first();
  }
  const urlObj = new URL(c.req.url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const attachments = (files || []).map((file) => ({
    id: file.id,
    title: file.title,
    type: file.mime_type === "application/pdf" ? "pdf" : "file",
    url: `${baseUrl}/lessons/${lessonId}/files/${file.id}/url`
  }));
  const lessonData = {
    ...lesson,
    videos,
    files,
    progress,
    attachments
  };
  return c.json({
    ...lessonData,
    lesson: lessonData
  });
});
courses.get("/:id/progress", requireAuth, async (c) => {
  const courseId = c.req.param("id");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const courseCheck = await c.env.DB.prepare(
    "SELECT id FROM courses WHERE id = ? AND platform = ?"
  ).bind(courseId, platform).first();
  if (!courseCheck) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0648\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const readyLessonsFilter = ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id AND v.status = 'ready'))`;
  const { count: totalLessons } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM lessons WHERE course_id = ? AND is_archived = 0 AND is_published = 1${readyLessonsFilter}`
  ).bind(courseId).first() || { count: 0 };
  const { count: completed } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM lesson_progress lp
     JOIN lessons ON lessons.id = lp.lesson_id AND lessons.course_id = lp.course_id
     WHERE lp.course_id = ? AND lp.student_id = ? AND lp.is_completed = 1
       AND lessons.is_archived = 0 AND lessons.is_published = 1${readyLessonsFilter}`
  ).bind(courseId, user.id).first() || { count: 0 };
  const percentage = totalLessons > 0 ? Math.round(completed / totalLessons * 100) : 0;
  const course = await c.env.DB.prepare(
    "SELECT is_free FROM courses WHERE id = ?"
  ).bind(courseId).first();
  const enrollment = await c.env.DB.prepare(
    `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
  ).bind(user.id, courseId).first();
  const isSubscribed = !!enrollment || course && course.is_free === 1;
  const progressData = {
    course_id: courseId,
    total_lessons: totalLessons,
    completed,
    percentage,
    is_subscribed: isSubscribed
  };
  return c.json({
    ...progressData,
    progress: progressData
  });
});
courses.get("/lessons/:id/quiz", optionalAuth, async (c) => {
  const lessonId = c.req.param("id");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const lesson = await c.env.DB.prepare(
    `SELECT l.*, c.is_free as course_is_free FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND c.platform = ?`
  ).bind(lessonId, platform).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const isFree = lesson.is_free_preview === 1 || lesson.is_free_preview === true || lesson.course_is_free === 1 || lesson.course_is_free === true;
  if (!isFree) {
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0645\u062D\u062A\u0648\u0649 \u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 401);
    }
    if (user.role === "student") {
      const enrollment = await c.env.DB.prepare(
        `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first();
      if (!enrollment) {
        return c.json({ error: { code: "NOT_ENROLLED", message: "\u064A\u062C\u0628 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633 \u0623\u0648\u0644\u0627\u064B \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 403);
      }
    }
  }
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE lesson_id = ? AND is_published = 1").bind(lessonId).first();
  if (!quiz) {
    return c.json({ quiz: null, questions: [] });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (quiz.start_time && now < quiz.start_time) {
    return c.json({ error: { code: "NOT_STARTED", message: `\u0647\u0630\u0627 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0628\u0639\u062F. \u0633\u064A\u0628\u062F\u0623 \u0641\u064A: ${new Date(quiz.start_time).toLocaleString("ar-EG")}` } }, 403);
  }
  let attempt = null;
  if (user) {
    attempt = await c.env.DB.prepare(
      "SELECT id, score, submitted_at, answers_json, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?"
    ).bind(user.id, quiz.id).first();
    if (quiz.end_time && now > quiz.end_time && (!attempt || attempt.is_submitted === 0)) {
      return c.json({ error: { code: "EXPIRED", message: "\u0627\u0646\u062A\u0647\u0649 \u0648\u0642\u062A \u062F\u062E\u0648\u0644 \u0647\u0630\u0627 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0628\u062F\u0621 \u0645\u062D\u0627\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629." } }, 403);
    }
    if (!attempt && quiz.time_limit_mins) {
      const attemptId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
         VALUES (?, ?, ?, 0, '{}', ?, 0, ?, ?)`
      ).bind(attemptId, user.id, quiz.id, now, now, now).run();
      attempt = {
        id: attemptId,
        score: 0,
        started_at: now,
        is_submitted: 0,
        answers: {}
      };
    }
  }
  const selectFields = attempt && attempt.is_submitted === 1 ? "id, question_text, image_url, options_json, correct_option, score, sort_order" : "id, question_text, image_url, options_json, score, sort_order";
  const { results: questions2 } = await c.env.DB.prepare(
    `SELECT ${selectFields} FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(quiz.id).all();
  let mappedQuestions = questions2.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    image_url: q.image_url,
    options: JSON.parse(q.options_json),
    score: q.score,
    sort_order: q.sort_order,
    ...q.correct_option !== void 0 ? { correct_option: q.correct_option } : {}
  }));
  if (quiz.randomize_questions === 1 && (!attempt || attempt.is_submitted === 0)) {
    const shuffled = [...mappedQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    mappedQuestions = shuffled;
  }
  if (attempt && attempt.answers_json) {
    attempt.answers = JSON.parse(attempt.answers_json);
    delete attempt.answers_json;
  }
  return c.json({ quiz, questions: mappedQuestions, attempt });
});
courses.post("/lessons/:id/quiz/submit", requireAuth, rateLimit("quiz_submit", 10, 60), async (c) => {
  const lessonId = c.req.param("id");
  const user = c.get("user");
  const body = await c.req.json();
  const platform = c.env.PLATFORM_KEY || "fusha";
  const submitSchema2 = external_exports.object({
    answers: external_exports.record(external_exports.string())
    // maps question_id -> selected_option_text
  });
  const parsed = submitSchema2.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const submittedAnswers = parsed.data.answers;
  const lesson = await c.env.DB.prepare(
    `SELECT l.* FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND c.platform = ?`
  ).bind(lessonId, platform).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE lesson_id = ? AND is_published = 1").bind(lessonId).first();
  if (!quiz) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0627\u062E\u062A\u0628\u0627\u0631 \u0645\u062A\u0627\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 404);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (quiz.start_time && now < quiz.start_time) {
    return c.json({ error: { code: "FORBIDDEN", message: "\u0647\u0630\u0627 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0628\u0639\u062F" } }, 403);
  }
  const existingAttempt = await c.env.DB.prepare(
    "SELECT id, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?"
  ).bind(user.id, quiz.id).first();
  if (existingAttempt && existingAttempt.is_submitted === 1) {
    return c.json({ error: { code: "ALREADY_SUBMITTED", message: "\u0644\u0642\u062F \u0642\u0645\u062A \u0628\u062D\u0644 \u0647\u0630\u0627 \u0627\u0644\u0648\u0627\u062C\u0628/\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0645\u0633\u0628\u0642\u0627\u064B" } }, 400);
  }
  if (quiz.time_limit_mins && existingAttempt && existingAttempt.started_at) {
    const startTime = new Date(existingAttempt.started_at).getTime();
    const nowTime = Date.now();
    const limitMs = (quiz.time_limit_mins + 2) * 60 * 1e3;
    if (nowTime - startTime > limitMs) {
    }
  }
  const { results: questions2 } = await c.env.DB.prepare(
    "SELECT * FROM quiz_questions WHERE quiz_id = ?"
  ).bind(quiz.id).all();
  let totalScore = 0;
  let earnedScore = 0;
  const mistakesToRecord = [];
  const gradedQuestions = questions2.map((q) => {
    const given = submittedAnswers[q.id] ?? "";
    const isCorrect = submittedAnswers[q.id] === q.correct_option;
    totalScore += q.score;
    if (isCorrect) {
      earnedScore += q.score;
    }
    const correctOptionText = resolveCorrectOptionText(q.options_json, q.correct_option);
    if (!isCorrect) {
      mistakesToRecord.push({
        questionId: q.id,
        questionText: q.question_text ?? null,
        givenAnswer: given,
        correctAnswer: correctOptionText,
        pointsLost: q.score
      });
    }
    return {
      id: q.id,
      correct_option: q.correct_option,
      is_correct: isCorrect,
      // سبب الإجابة الصحيحة — للسؤال المُجاب عليه خطأً فقط.
      ...isCorrect ? {} : {
        correct_option_text: correctOptionText,
        explanation: q.explanation ?? null,
        correct_answer_reason: buildCorrectAnswerReason(correctOptionText, q.explanation)
      }
    };
  });
  const scoreRatio = totalScore > 0 ? earnedScore / totalScore : 0;
  const finalScore = scoreRatio * quiz.max_score;
  if (existingAttempt) {
    await c.env.DB.prepare(
      `UPDATE quiz_attempts 
       SET score = ?, answers_json = ?, is_submitted = 1, submitted_at = ?
       WHERE id = ?`
    ).bind(finalScore, JSON.stringify(submittedAnswers), now, existingAttempt.id).run();
  } else {
    const attemptId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(attemptId, user.id, quiz.id, finalScore, JSON.stringify(submittedAnswers), now, now, now).run();
  }
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (id, student_id, course_id, lesson_id, is_completed, last_position, updated_at)
     VALUES (?, ?, ?, ?, 1, 0, datetime('now'))
     ON CONFLICT(student_id, lesson_id) DO UPDATE SET is_completed = 1, updated_at = datetime('now')`
  ).bind(`lp_${user.id}_${lessonId}`, user.id, lesson.course_id, lessonId).run();
  for (const mistake of mistakesToRecord) {
    await recordMistake(c.env, {
      studentId: user.id,
      questionId: mistake.questionId,
      source: "quiz",
      quizId: quiz.id,
      examId: null,
      questionText: mistake.questionText,
      givenAnswer: mistake.givenAnswer,
      correctAnswer: mistake.correctAnswer,
      pointsLost: mistake.pointsLost
    });
  }
  const points2 = await awardPoints(c.env, user.id, EXAM_COMPLETION_POINTS, "exam_completed", {
    referenceId: quiz.id,
    note: `\u0625\u062A\u0645\u0627\u0645 \u0627\u062E\u062A\u0628\u0627\u0631: ${quiz.title || lessonId}`
  });
  return c.json({
    ok: true,
    score: finalScore,
    max_score: quiz.max_score,
    graded: gradedQuestions,
    points: { awarded: points2.awarded, total_points: points2.total_points, level: points2.level, level_up: points2.level_up }
  });
});
courses.get("/notifications/list", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const query = `
    SELECT *
    FROM notifications
    WHERE platform = ? AND (
      audience = 'all'
      OR recipient_id = ?
      OR (audience = 'course' AND course_id IN (
        SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'
      ))
    )
    ORDER BY sent_at DESC
    LIMIT 50
  `;
  const { results } = await c.env.DB.prepare(query).bind(platform, user.id, user.id).all();
  return c.json({ notifications: results });
});
courses.post("/notifications/:id/read", requireAuth, async (c) => {
  const notifId = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE id = ?"
  ).bind(notifId).run();
  return c.json({ ok: true });
});
var courses_default = courses;

// src/utils/s3.ts
async function getPresignedUrl(env, bucketName, objectKey, contentType, isDownloadable, fileName, expiresSeconds = 3600) {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const accountId = env.CF_ACCOUNT_ID;
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error("R2 S3 credentials or Account ID are not configured");
  }
  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const method = "GET";
  const region = "auto";
  const service = "s3";
  const datetime = (/* @__PURE__ */ new Date()).toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const date = datetime.slice(0, 8);
  const scope = `${date}/${region}/${service}/aws4_request`;
  const queryParams = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": datetime,
    "X-Amz-Expires": expiresSeconds.toString(),
    "X-Amz-SignedHeaders": "host"
  };
  const contentDisposition = isDownloadable ? `attachment; filename="${fileName}"` : "inline";
  queryParams["response-content-type"] = contentType;
  queryParams["response-content-disposition"] = contentDisposition;
  queryParams["response-cache-control"] = "private, no-store, max-age=0";
  const sortedQueryKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedQueryKeys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`).join("&");
  const encodedKey = objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const cleanKey = encodedKey.startsWith("/") ? encodedKey : `/${encodedKey}`;
  const canonicalRequest = `${method}
${cleanKey}
${canonicalQueryString}
host:${host}

host
UNSIGNED-PAYLOAD`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256
${datetime}
${scope}
${canonicalRequestHash}`;
  const dateKey = await hmacSign(utf8Encode(`AWS4${secretAccessKey}`), date);
  const dateRegionKey = await hmacSign(dateKey, region);
  const dateRegionServiceKey = await hmacSign(dateRegionKey, service);
  const signingKey = await hmacSign(dateRegionServiceKey, "aws4_request");
  const signature = await hmacSignHex(signingKey, stringToSign);
  return `${endpoint}${cleanKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
__name(getPresignedUrl, "getPresignedUrl");
async function sha256Hex(message) {
  const msgBuffer = utf8Encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return hexEncode(new Uint8Array(hashBuffer));
}
__name(sha256Hex, "sha256Hex");
async function hmacSign(key, message) {
  const msgBuffer = utf8Encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgBuffer);
  return new Uint8Array(sigBuffer);
}
__name(hmacSign, "hmacSign");
async function hmacSignHex(key, message) {
  const signature = await hmacSign(key, message);
  return hexEncode(signature);
}
__name(hmacSignHex, "hmacSignHex");
function utf8Encode(str) {
  return new TextEncoder().encode(str);
}
__name(utf8Encode, "utf8Encode");
function hexEncode(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hexEncode, "hexEncode");
async function getPresignedPutUrl(env, bucketName, objectKey, contentType, expiresSeconds = 3600) {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const accountId = env.CF_ACCOUNT_ID;
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error("R2 S3 credentials or Account ID are not configured");
  }
  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const method = "PUT";
  const region = "auto";
  const service = "s3";
  const datetime = (/* @__PURE__ */ new Date()).toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const date = datetime.slice(0, 8);
  const scope = `${date}/${region}/${service}/aws4_request`;
  const queryParams = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": datetime,
    "X-Amz-Expires": expiresSeconds.toString(),
    "X-Amz-SignedHeaders": "host"
  };
  const sortedQueryKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedQueryKeys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`).join("&");
  const encodedKey = objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const cleanKey = encodedKey.startsWith("/") ? encodedKey : `/${encodedKey}`;
  const canonicalRequest = `${method}
${cleanKey}
${canonicalQueryString}
host:${host}

host
UNSIGNED-PAYLOAD`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256
${datetime}
${scope}
${canonicalRequestHash}`;
  const dateKey = await hmacSign(utf8Encode(`AWS4${secretAccessKey}`), date);
  const dateRegionKey = await hmacSign(dateKey, region);
  const dateRegionServiceKey = await hmacSign(dateRegionKey, service);
  const signingKey = await hmacSign(dateRegionServiceKey, "aws4_request");
  const signature = await hmacSignHex(signingKey, stringToSign);
  return `${endpoint}${cleanKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
__name(getPresignedPutUrl, "getPresignedPutUrl");

// src/routes/playback.ts
var playback = new Hono2();
var lastHeartbeatWrites = {};
var lastHeartbeatCleanup = Date.now();
function cleanHeartbeatCache() {
  const now = Date.now();
  if (now - lastHeartbeatCleanup < 6e4)
    return;
  lastHeartbeatCleanup = now;
  for (const key in lastHeartbeatWrites) {
    if (now - lastHeartbeatWrites[key] > 12e4) {
      delete lastHeartbeatWrites[key];
    }
  }
}
__name(cleanHeartbeatCache, "cleanHeartbeatCache");
playback.post(
  "/lessons/:id/playback",
  optionalAuth,
  rateLimit("playback", 30, 60),
  async (c) => {
    const lessonId = c.req.param("id");
    const user = c.get("user");
    const clientIp2 = c.get("clientIp") || "";
    const platform = c.env.PLATFORM_KEY || "fusha";
    const lesson = await c.env.DB.prepare(
      `SELECT l.id, l.course_id, l.is_free_preview, 
         COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds, 
         c.is_free as course_is_free
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
    ).bind(lessonId, platform).first();
    if (!lesson) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    const isFree = lesson.is_free_preview === 1 || lesson.course_is_free === 1;
    if (!isFree) {
      if (!user) {
        return c.json({ error: { code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 401);
      }
      if (user.role === "student") {
        const enrollment = await c.env.DB.prepare(
          `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
        ).bind(user.id, lesson.course_id).first();
        if (!enrollment) {
          return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633" } }, 403);
        }
        if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
          return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
        }
        const deviceId = c.req.header("X-Device-Id");
        if (!deviceId) {
          return c.json({ error: { code: "DEVICE_ID_MISSING", message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062C\u0647\u0627\u0632 \u0645\u0637\u0644\u0648\u0628" } }, 400);
        }
        const device = await c.env.DB.prepare(
          "SELECT id, is_trusted FROM devices WHERE student_id = ? AND device_id = ?"
        ).bind(user.id, deviceId).first();
        if (!device) {
          const { count } = await c.env.DB.prepare(
            "SELECT COUNT(*) as count FROM devices WHERE student_id = ?"
          ).bind(user.id).first() || { count: 0 };
          if (count >= user.maxDevices) {
            return c.json({ error: { code: "DEVICE_NOT_REGISTERED", message: `\u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0645\u0646 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 (${user.maxDevices}). \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062F\u0631\u0633 \u0644\u062A\u0633\u062C\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632.` } }, 403);
          }
          const devId = crypto.randomUUID();
          const userAgent = c.req.header("User-Agent") || "";
          const isBrowser = /mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent);
          let devPlatform = c.req.header("X-Platform") || "web";
          if (isBrowser) {
            devPlatform = "web";
          }
          const devIsNative = devPlatform === "android" || devPlatform === "ios";
          const devIsTrusted = devIsNative ? 1 : 0;
          await c.env.DB.prepare(
            `INSERT OR IGNORE INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, 0, datetime('now'), datetime('now'))`
          ).bind(devId, user.id, deviceId, devPlatform, `Auto-registered (${devPlatform})`, devIsTrusted).run();
          if (!devIsTrusted) {
            return c.json({ error: { code: "DEVICE_NOT_TRUSTED", message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u0648\u0644\u0643\u0646\u0647 \u063A\u064A\u0631 \u0645\u0648\u062B\u0651\u0642 \u0628\u0639\u062F. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0644\u062A\u0641\u0639\u064A\u0644 \u062C\u0647\u0627\u0632\u0643." } }, 403);
          }
        } else if (device.is_trusted !== 1) {
          return c.json({ error: { code: "DEVICE_NOT_TRUSTED", message: "\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0644\u062A\u0641\u0639\u064A\u0644 \u062C\u0647\u0627\u0632\u0643." } }, 403);
        }
      }
    }
    const video = await c.env.DB.prepare(
      `SELECT id, provider, stream_uid, youtube_id, require_drm FROM lesson_videos WHERE lesson_id = ? AND status = 'ready' ORDER BY sort_order ASC LIMIT 1`
    ).bind(lessonId).first();
    if (!video) {
      return c.json({ error: { code: "VIDEO_NOT_READY", message: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u062C\u0627\u0647\u0632 \u0628\u0639\u062F" } }, 404);
    }
    const ttlSetting = await c.env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'signed_url_ttl_seconds'"
    ).first();
    let ttlSeconds = parseInt(ttlSetting?.value || "180");
    if (ttlSeconds > 7200) {
      ttlSeconds = 7200;
    }
    let response;
    let watermarkText = "\u0645\u0639\u0627\u064A\u0646\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u2022 Free Preview";
    if (user) {
      const userPhone = (await c.env.DB.prepare("SELECT phone FROM profiles WHERE id = ?").bind(user.id).first())?.phone || "";
      watermarkText = `${user.fullName} \u2022 ${userPhone}`;
    }
    if (video.provider === "youtube" && video.youtube_id) {
      response = {
        provider: "youtube",
        playback_url: `https://www.youtube.com/watch?v=${video.youtube_id}`,
        youtube_id: video.youtube_id,
        watermark_text: watermarkText,
        watermark: {
          text: watermarkText,
          mode: "moving",
          opacity: 0.25
        },
        policy: { allow_cast: true, allow_pip: true }
      };
    } else if (video.provider === "r2_hls" && video.stream_uid) {
      const reqUrl = new URL(c.req.url);
      const clientIp3 = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
      const userAgent = c.req.header("User-Agent") || "";
      const deviceId = c.req.header("X-Device-Id") || "unknown";
      const tokenTtl = Math.max(7200, (lesson.duration_seconds || 0) + 3600);
      const secret = c.env.AUTH_SECRET;
      if (!secret?.trim()) {
        return c.json({ error: { code: "CONFIG_ERROR", message: "AUTH_SECRET must be configured for playback tokens." } }, 503);
      }
      const payload = {
        scope: "playback",
        userId: user?.id || "guest",
        deviceId,
        streamUid: video.stream_uid,
        clientIp: clientIp3,
        userAgent,
        exp: Math.floor(Date.now() / 1e3) + tokenTtl
      };
      const playbackToken = await sign2(payload, secret);
      if (user?.id && c.env.KV) {
        await c.env.KV.put(`active_session:${user.id}`, deviceId, { expirationTtl: tokenTtl });
      }
      const playbackUrl = `${reqUrl.protocol}//${reqUrl.host}/lessons/${lessonId}/video/hls/playlist.m3u8?token=${playbackToken}`;
      response = {
        provider: "r2_hls",
        playback_url: playbackUrl,
        watermark_text: watermarkText,
        watermark: {
          text: watermarkText,
          mode: "moving",
          opacity: 0.25
        },
        policy: { allow_cast: false, allow_pip: false }
      };
    } else if ((video.provider === "r2" || video.provider === "server") && video.stream_uid) {
      const signedUrl = await getPresignedUrl(
        c.env,
        c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
        video.stream_uid,
        "video/mp4",
        false,
        "video.mp4",
        ttlSeconds
      );
      response = {
        provider: video.provider,
        playback_url: signedUrl,
        watermark_text: watermarkText,
        watermark: {
          text: watermarkText,
          mode: "moving",
          opacity: 0.25
        },
        policy: { allow_cast: false, allow_pip: false }
      };
    } else {
      return c.json({ error: { code: "VIDEO_NOT_READY", message: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D" } }, 404);
    }
    if (user) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, ip, meta_json, created_at)
           VALUES (?, ?, 'playback.start', 'lesson', ?, ?, ?, datetime('now'))`
        ).bind(
          generateId(),
          user.id,
          lessonId,
          clientIp2,
          JSON.stringify({ device_id: c.req.header("X-Device-Id"), video_provider: video.provider })
        ).run()
      );
    }
    let lastPosition = 0;
    if (user) {
      const progress = await c.env.DB.prepare(
        "SELECT last_position FROM lesson_progress WHERE student_id = ? AND lesson_id = ?"
      ).bind(user.id, lessonId).first();
      lastPosition = progress?.last_position || 0;
    }
    response.last_position = lastPosition;
    return c.json(response);
  }
);
playback.post("/playback/heartbeat", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const heartbeatSchema = external_exports.object({
    lesson_id: external_exports.string().min(1),
    position: external_exports.number().nonnegative(),
    watched_seconds: external_exports.number().nonnegative().optional()
  });
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const { lesson_id: lessonId, position: rawPosition } = parsed.data;
  const position = Math.max(0, Math.floor(rawPosition));
  cleanHeartbeatCache();
  const debounceKey = `heartbeat:${user.id}:${lessonId}`;
  const lastWrite = lastHeartbeatWrites[debounceKey];
  const now = Date.now();
  if (lastWrite && now - lastWrite < 6e4) {
    return c.json({ ok: true, debounced: true });
  }
  const platform = c.env.PLATFORM_KEY || "fusha";
  const lesson = await c.env.DB.prepare(
    `SELECT l.course_id, 
       COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds, 
       l.is_free_preview, c.is_free as course_is_free
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
  ).bind(lessonId, platform).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (user.role === "student" && !lesson.is_free_preview && lesson.course_is_free !== 1) {
    const enrollment = await c.env.DB.prepare(
      `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
    ).bind(user.id, lesson.course_id).first();
    if (!enrollment) {
      return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633" } }, 403);
    }
    if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
      return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
    }
  }
  const prevProgress = await c.env.DB.prepare(
    "SELECT watched_seconds FROM lesson_progress WHERE student_id = ? AND lesson_id = ?"
  ).bind(user.id, lessonId).first();
  const prevWatched = prevProgress?.watched_seconds || 0;
  let delta = 0;
  if (body.watched_seconds !== void 0) {
    delta = Math.max(0, Math.floor(body.watched_seconds));
  } else {
    const clientWatched = Math.max(0, Math.floor(position));
    delta = clientWatched - prevWatched;
  }
  let maxDelta = 60;
  if (lastWrite) {
    const elapsedSeconds = Math.ceil((now - lastWrite) / 1e3);
    maxDelta = Math.max(60, elapsedSeconds + 15);
  } else {
    maxDelta = Math.max(60, position + 15);
  }
  if (delta < 0) {
    delta = 0;
  }
  if (delta > maxDelta) {
    delta = maxDelta;
  }
  let finalWatched = prevWatched + delta;
  const duration = lesson.duration_seconds || 0;
  if (duration > 0 && finalWatched > duration) {
    finalWatched = duration;
  }
  const isCompleted = duration > 0 && position >= duration * 0.9 ? 1 : 0;
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (id, student_id, lesson_id, course_id, watched_seconds, last_position, highest_position_watched, is_completed, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(student_id, lesson_id) DO UPDATE SET
       watched_seconds = MAX(lesson_progress.watched_seconds, excluded.watched_seconds),
       last_position = excluded.last_position,
       highest_position_watched = MAX(lesson_progress.highest_position_watched, excluded.highest_position_watched),
       is_completed = MAX(lesson_progress.is_completed, excluded.is_completed),
       completed_at = CASE WHEN excluded.is_completed = 1 AND lesson_progress.completed_at IS NULL THEN datetime('now') ELSE lesson_progress.completed_at END,
       updated_at = datetime('now')`
  ).bind(
    generateId(),
    user.id,
    lessonId,
    lesson.course_id,
    finalWatched,
    position,
    position,
    isCompleted,
    isCompleted ? nowISO() : null
  ).run();
  lastHeartbeatWrites[debounceKey] = now;
  return c.json({ ok: true, is_completed: isCompleted === 1 });
});
playback.get("/lessons/:id/files/:fileId/url", optionalAuth, async (c) => {
  const lessonId = c.req.param("id");
  const fileId = c.req.param("fileId");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const lesson = await c.env.DB.prepare(
    `SELECT l.id, l.course_id, l.is_free_preview, c.is_free as course_is_free
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
  ).bind(lessonId, platform).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const isFree = lesson.is_free_preview === 1 || lesson.course_is_free === 1;
  if (!isFree) {
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u062A\u062D\u0645\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641" } }, 401);
    }
    if (user.role === "student") {
      const enrollment = await c.env.DB.prepare(
        `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first();
      if (!enrollment) {
        return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633" } }, 403);
      }
      if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
        return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
      }
    }
  }
  const file = await c.env.DB.prepare(
    "SELECT id, r2_key, mime_type, title, is_downloadable FROM lesson_files WHERE id = ? AND lesson_id = ?"
  ).bind(fileId, lessonId).first();
  if (!file) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  try {
    const presignedUrl = await getPresignedUrl(
      c.env,
      c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
      // R2 bucket name
      file.r2_key,
      file.mime_type,
      file.is_downloadable === 1,
      file.title,
      3600
      // 1 hour expiry
    );
    return c.redirect(presignedUrl, 302);
  } catch (err) {
    console.warn("[R2_PRESIGN_FALLBACK] Failed to generate presigned URL, falling back to direct stream:", err);
    const object = await c.env.R2.get(file.r2_key);
    if (!object) {
      return c.json({ error: { code: "FILE_MISSING", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 \u0641\u064A \u0627\u0644\u062A\u062E\u0632\u064A\u0646" } }, 404);
    }
    const safeFilename = file.title.replace(/[\r\n"]/g, "_");
    return new Response(object.body, {
      headers: {
        "Content-Type": file.mime_type,
        "Content-Disposition": file.is_downloadable === 1 ? `attachment; filename="${safeFilename}"` : "inline",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Watermark": file.watermark ? user ? `${user.fullName}` : "\u0645\u0639\u0627\u064A\u0646\u0629 \u0645\u062C\u0627\u0646\u064A\u0629" : "",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
});
playback.post(
  "/lessons/:id/playback/logs",
  requireAuth,
  rateLimit("playback_logs", 30, 60),
  async (c) => {
    const lessonId = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json();
    if (!body.action || body.position_seconds === void 0) {
      return c.json({ error: { code: "BAD_REQUEST", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629" } }, 400);
    }
    if (body.action !== "open" && body.action !== "close") {
      return c.json({ error: { code: "BAD_REQUEST", message: "\u0625\u062C\u0631\u0627\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" } }, 400);
    }
    const platform = c.env.PLATFORM_KEY || "fusha";
    const lesson = await c.env.DB.prepare(
      `SELECT l.course_id, l.is_free_preview, c.is_free as course_is_free
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
    ).bind(lessonId, platform).first();
    if (!lesson) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    if (user.role === "student" && !lesson.is_free_preview && lesson.course_is_free !== 1) {
      const enrollment = await c.env.DB.prepare(
        `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first();
      if (!enrollment) {
        return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633" } }, 403);
      }
      if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
        return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
      }
    }
    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO lecture_playback_logs (id, student_id, lesson_id, action, position_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(id, user.id, lessonId, body.action, Math.floor(body.position_seconds)).run();
    if (body.action === "close") {
      await c.env.DB.prepare(
        `INSERT INTO lesson_progress (id, student_id, lesson_id, course_id, last_position, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(student_id, lesson_id) DO UPDATE SET 
           last_position = excluded.last_position,
           updated_at = datetime('now')`
      ).bind(`lp_${user.id}_${lessonId}`, user.id, lessonId, lesson.course_id, Math.floor(body.position_seconds)).run();
    }
    return c.json({ ok: true });
  }
);
playback.get("/lessons/:id/video/hls/:file{.*}", async (c) => {
  const lessonId = c.req.param("id");
  const filePath = c.req.param("file");
  let token = c.req.query("token");
  if (!token) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }
  const platform = c.env.PLATFORM_KEY || "fusha";
  const lesson = await c.env.DB.prepare(
    `SELECT l.course_id, l.is_free_preview, c.is_free as course_is_free
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
  ).bind(lessonId, platform).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const isFree = lesson.is_free_preview === 1 || lesson.course_is_free === 1;
  let streamUid = "";
  if (isFree) {
    const video = await c.env.DB.prepare(
      `SELECT id, stream_uid FROM lesson_videos WHERE lesson_id = ? AND provider = 'r2_hls' AND status = 'ready' LIMIT 1`
    ).bind(lessonId).first();
    if (!video || !video.stream_uid) {
      return c.json({ error: { code: "VIDEO_NOT_READY", message: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D" } }, 404);
    }
    streamUid = video.stream_uid;
  } else {
    if (!token) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u0648\u0643\u0646 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0645\u0641\u0642\u0648\u062F" } }, 401);
    }
    const isOpaqueToken = token.startsWith("pb_") || !token.includes(".");
    if (isOpaqueToken && c.env.KV) {
      const cached = await c.env.KV.get(`playback_token:${token}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          const clientIp2 = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
          const userAgent = c.req.header("User-Agent") || "";
          if (data.clientIp && data.clientIp !== clientIp2) {
            return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u063A\u064A\u064A\u0631 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 \u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 (IP)" } }, 403);
          }
          if (data.userAgent && data.userAgent !== userAgent) {
            return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u063A\u064A\u064A\u0631 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062A\u0635\u0641\u062D" } }, 403);
          }
          const isSegment = filePath.endsWith(".ts") || filePath.endsWith(".m4s") || filePath.endsWith(".mp4");
          if (!isSegment && data.userId && data.userId !== "guest") {
            const activeToken = await c.env.KV.get(`active_session:${data.userId}`);
            if (activeToken && activeToken !== token) {
              return c.json({ error: { code: "SESSION_KICKED", message: "\u062A\u0645 \u0628\u062F\u0621 \u0627\u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0645\u0646 \u062C\u0647\u0627\u0632 \u0622\u062E\u0631\u060C \u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C\u0643." } }, 403);
            }
          }
          streamUid = data.streamUid || "";
        } catch (e) {
        }
      }
    } else if (!isOpaqueToken) {
      const secret = c.env.AUTH_SECRET;
      if (!secret?.trim()) {
        return c.json({ error: { code: "CONFIG_ERROR", message: "AUTH_SECRET must be configured for playback tokens." } }, 503);
      }
      try {
        const data = await verify2(token, secret, "HS256");
        const clientIp2 = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
        const userAgent = c.req.header("User-Agent") || "";
        if (data.clientIp && data.clientIp !== clientIp2) {
          console.warn("[Playback DBG] IP Mismatch! Token:", data.clientIp, "Request:", clientIp2);
          return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u063A\u064A\u064A\u0631 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 \u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 (IP)" } }, 403);
        }
        if (data.userAgent && data.userAgent !== userAgent) {
          console.warn("[Playback DBG] UA Mismatch! Token:", data.userAgent, "Request:", userAgent);
          return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u063A\u064A\u064A\u0631 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062A\u0635\u0641\u062D" } }, 403);
        }
        const isSegment = filePath.endsWith(".ts") || filePath.endsWith(".m4s") || filePath.endsWith(".mp4");
        if (!isSegment && data.userId && data.userId !== "guest" && c.env.KV) {
          const activeDevice = await c.env.KV.get(`active_session:${data.userId}`);
          if (activeDevice && data.deviceId && activeDevice !== data.deviceId) {
            console.warn("[Playback DBG] Session kicked! KV active:", activeDevice, "Token device:", data.deviceId);
            return c.json({ error: { code: "SESSION_KICKED", message: "\u062A\u0645 \u0628\u062F\u0621 \u0627\u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0645\u0646 \u062C\u0647\u0627\u0632 \u0622\u062E\u0631\u060C \u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C\u0643." } }, 403);
          }
        }
        streamUid = data.streamUid || "";
      } catch (e) {
        console.error("[Playback DBG] JWT Verify Error:", e.message || e);
      }
    }
    if (!streamUid) {
      let authenticated = false;
      const authResponse = await requireAuth(c, async () => {
        authenticated = true;
      });
      if (!authenticated)
        return authResponse;
      const user = c.get("user");
      if (user.role === "student" && lesson.course_is_free !== 1) {
        const enrollment = await c.env.DB.prepare(
          `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
        ).bind(user.id, lesson.course_id).first();
        if (!enrollment) {
          return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633" } }, 403);
        }
        if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
          return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
        }
      }
      const video = await c.env.DB.prepare(
        `SELECT id, stream_uid FROM lesson_videos WHERE lesson_id = ? AND provider = 'r2_hls' AND status = 'ready' LIMIT 1`
      ).bind(lessonId).first();
      if (!video || !video.stream_uid) {
        return c.json({ error: { code: "VIDEO_NOT_READY", message: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D" } }, 404);
      }
      streamUid = video.stream_uid;
    }
  }
  if (!streamUid) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u0641\u064A\u062F\u064A\u0648" } }, 401);
  }
  const isKeyRequest = filePath.endsWith("/key") || filePath === "key";
  if (isKeyRequest) {
    if (!token) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u064A\u062A\u0637\u0644\u0628 \u062C\u0644\u0633\u0629 \u062A\u0634\u063A\u064A\u0644 \u0635\u0627\u0644\u062D\u0629" } }, 401);
    }
    let session = {};
    const isOpaqueToken = token.startsWith("pb_") || !token.includes(".");
    if (isOpaqueToken) {
      const sessionRaw = c.env.KV ? await c.env.KV.get(`playback_token:${token}`) : null;
      if (!sessionRaw) {
        return c.json({ error: { code: "UNAUTHORIZED", message: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0623\u0648 \u0645\u0646\u062A\u0647\u064A\u0629" } }, 403);
      }
      try {
        session = JSON.parse(sessionRaw);
      } catch {
        return c.json({ error: { code: "UNAUTHORIZED", message: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" } }, 403);
      }
    } else {
      const secret = c.env.AUTH_SECRET;
      if (!secret?.trim()) {
        return c.json({ error: { code: "CONFIG_ERROR", message: "AUTH_SECRET must be configured for playback tokens." } }, 503);
      }
      try {
        session = await verify2(token, secret, "HS256");
      } catch (e) {
        console.error("[Playback DBG] Key verify JWT error:", e.message || e);
        return c.json({ error: { code: "UNAUTHORIZED", message: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0623\u0648 \u0645\u0646\u062A\u0647\u064A\u0629" } }, 403);
      }
    }
    if (!session.streamUid || session.streamUid !== streamUid) {
      console.warn("[Playback DBG] Key Request - Forbidden! Stream Uid mismatch.");
      return c.json({ error: { code: "FORBIDDEN", message: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0644\u0627 \u062A\u062E\u0635 \u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 403);
    }
    const parts = streamUid.split("/");
    const videoId = parts[3];
    if (!videoId) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    const keyHex = await c.env.KV.get(`video_aes_key:${videoId}`);
    if (!keyHex) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631" } }, 404);
    }
    const tokenSignature = token.split(".").pop() || token;
    const keyRateKey = `rate_limit:key:${tokenSignature}`;
    const countStr = await c.env.KV.get(keyRateKey);
    const count = countStr ? parseInt(countStr) : 0;
    if (count > 3) {
      console.warn("[Playback DBG] Key Rate Limit Exceeded!");
      if (token.startsWith("pb_")) {
        await c.env.KV.delete(`playback_token:${token}`);
      }
      return c.json({ error: { code: "UNAUTHORIZED", message: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u062C\u0644\u0628 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062A\u0634\u0641\u064A\u0631" } }, 403);
    }
    await c.env.KV.put(keyRateKey, (count + 1).toString(), { expirationTtl: 3600 });
    const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    return new Response(keyBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }
  const r2Key = `${streamUid}/${filePath}`;
  let isFromVideoBucket = false;
  let r2Object = null;
  if (c.env.R2_VIDEO) {
    r2Object = await c.env.R2_VIDEO.get(r2Key);
    if (r2Object) {
      isFromVideoBucket = true;
    }
  }
  if (!r2Object) {
    r2Object = await c.env.R2.get(r2Key);
  }
  if (!r2Object) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  let contentType = "application/octet-stream";
  if (filePath.endsWith(".m3u8")) {
    contentType = "application/x-mpegURL";
  } else if (filePath.endsWith(".ts")) {
    contentType = "video/MP2T";
  } else if (filePath.endsWith(".m4s")) {
    contentType = "video/iso.segment";
  } else if (filePath.endsWith(".mp4")) {
    contentType = "video/mp4";
  }
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  if (filePath.endsWith(".m3u8")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    if (token) {
      const videoCdnHost = c.env.VIDEO_CDN_HOST;
      const text = await r2Object.text();
      const playlistDir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/") + 1) : "";
      const lines = text.split("\n").map((line) => {
        const trimmed = line.trim();
        if (!trimmed)
          return line;
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match2, p1) => {
            const isKey = p1 === "key" || p1.startsWith("key?") || p1.endsWith("/key");
            if (isKey) {
              const separator2 = p1.includes("?") ? "&" : "?";
              return `URI="${p1}${separator2}token=${token}"`;
            }
            if (videoCdnHost && isFromVideoBucket) {
              return `URI="https://${videoCdnHost}/${streamUid}/${playlistDir}${p1}"`;
            }
            const separator = p1.includes("?") ? "&" : "?";
            return `URI="${p1}${separator}token=${token}"`;
          });
        }
        if (!trimmed.startsWith("#")) {
          const isPlaylist = trimmed.endsWith(".m3u8") || trimmed.includes(".m3u8?");
          if (isPlaylist) {
            const separator2 = trimmed.includes("?") ? "&" : "?";
            return `${trimmed}${separator2}token=${token}`;
          }
          if (videoCdnHost && isFromVideoBucket) {
            return `https://${videoCdnHost}/${streamUid}/${playlistDir}${trimmed}`;
          }
          const separator = trimmed.includes("?") ? "&" : "?";
          return `${trimmed}${separator}token=${token}`;
        }
        return line;
      });
      return c.text(lines.join("\n"), 200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate"
      });
    }
  } else {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  return new Response(r2Object.body, {
    status: 200,
    headers
  });
});
var playback_default = playback;

// src/utils/logger.ts
function logStructured(payload) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const logObj = { timestamp, ...payload };
  if (payload.level === "error") {
    console.error(JSON.stringify(logObj));
  } else if (payload.level === "warn") {
    console.warn(JSON.stringify(logObj));
  } else {
    console.log(JSON.stringify(logObj));
  }
}
__name(logStructured, "logStructured");
function logError(event, err, meta = {}) {
  logStructured({
    level: "error",
    event,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : void 0,
    ...meta
  });
}
__name(logError, "logError");

// src/routes/codes.ts
var codes = new Hono2();
var redeemSchema = external_exports.object({
  code: external_exports.string().trim().min(1),
  course_id: external_exports.string().nullish()
});
codes.post(
  "/redeem",
  requireAuth,
  requireTrustedDevice,
  rateLimit("redeem", 10, 60),
  audit("code.redeem"),
  async (c) => {
    const user = c.get("user");
    if (user.role !== "student") {
      return c.json({ error: { code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0637\u0644\u0627\u0628 \u064A\u0645\u0643\u0646\u0647\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0623\u0643\u0648\u0627\u062F" } }, 403);
    }
    const parsed = redeemSchema.safeParse(await c.req.json().catch(() => void 0));
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644" } }, 400);
    }
    const body = parsed.data;
    const normalizedCode = normalizeCode(body.code);
    const db = c.env.DB;
    const currentPlatform = c.env.PLATFORM_KEY || "fusha";
    const codeRow = await db.prepare(
      `SELECT ac.id FROM activation_codes ac
       JOIN code_batches cb ON cb.id = ac.batch_id AND cb.platform = ac.platform
       WHERE ac.code = ? AND ac.platform = ?`
    ).bind(normalizedCode, currentPlatform).first();
    if (!codeRow) {
      return c.json({ error: { code: "CODE_NOT_FOUND", message: "\u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" } }, 404);
    }
    const targetSql = `
      WITH redemption AS (
        SELECT ? AS code_id, ? AS platform, ? AS student_id, ? AS requested_course
      ), live_code AS (
        SELECT ac.*, COALESCE(NULLIF(ac.access_days, 0), cb.access_days) AS effective_access_days
        FROM activation_codes ac
        JOIN code_batches cb ON cb.id = ac.batch_id AND cb.platform = ac.platform
        JOIN redemption r ON ac.id = r.code_id AND ac.platform = r.platform
      ), target_courses AS (
        SELECT crs.id FROM courses crs
        JOIN live_code ac ON crs.platform = ac.platform
        WHERE (ac.scope_type = 'course' AND crs.id = ac.course_id)
           OR (ac.scope_type = 'bundle' AND EXISTS (
             SELECT 1 FROM bundle_courses bc
             JOIN bundles b ON b.id = bc.bundle_id AND b.platform = ac.platform
             WHERE bc.bundle_id = ac.bundle_id AND bc.course_id = crs.id
               AND bc.platform = ac.platform
           ))
           OR (ac.scope_type = 'all' AND crs.is_archived = 0 AND crs.is_published = 1)
      )`;
    const targetBindings = [codeRow.id, currentPlatform, user.id, body.course_id || null];
    let results;
    try {
      results = await db.batch([
        db.prepare(`${targetSql}
          INSERT INTO enrollments
            (id, student_id, course_id, source, code_id, status, platform, granted_at, expires_at, created_at)
          SELECT lower(hex(randomblob(16))), r.student_id, tc.id, 'code', ac.id, 'active', r.platform,
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                 CASE WHEN ac.effective_access_days IS NULL OR ac.effective_access_days = 0 THEN NULL
                      ELSE strftime('%Y-%m-%dT%H:%M:%SZ', 'now', printf('%+d days', ac.effective_access_days)) END,
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          FROM target_courses tc CROSS JOIN live_code ac CROSS JOIN redemption r
          JOIN profiles p ON p.id = r.student_id AND p.platform = r.platform
                         AND p.role = 'student' AND p.status = 'active'
          LEFT JOIN enrollments e ON e.student_id = r.student_id AND e.course_id = tc.id
          WHERE ac.status = 'active' AND ac.used_count < ac.max_uses
            AND (ac.expires_at IS NULL OR julianday(ac.expires_at) > julianday('now'))
            AND (ac.valid_from IS NULL OR julianday(ac.valid_from) <= julianday('now'))
            AND (r.requested_course IS NULL OR EXISTS (SELECT 1 FROM target_courses WHERE id = r.requested_course))
            AND (e.id IS NULL OR (e.platform = r.platform
                 AND (e.status <> 'active' OR julianday(e.expires_at) <= julianday('now'))))
          ON CONFLICT(student_id, course_id) DO UPDATE SET
            source = 'code', code_id = excluded.code_id, status = 'active',
            granted_at = excluded.granted_at, expires_at = excluded.expires_at
          WHERE enrollments.platform = excluded.platform
            AND (enrollments.status <> 'active' OR julianday(enrollments.expires_at) <= julianday('now'))
          RETURNING course_id, expires_at
        `).bind(...targetBindings),
        // Keep this immediately after INSERT: changes() is its affected row count,
        // not the number of courses to charge. D1 executes the batch in one transaction.
        db.prepare(`
          UPDATE activation_codes
          SET used_count = used_count + 1,
              status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE 'active' END,
              used_by = ?, used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ? AND platform = ? AND changes() > 0
        `).bind(user.id, codeRow.id, currentPlatform),
        // Diagnose a no-op in the same transaction, not from the stale lookup above.
        db.prepare(`${targetSql}
          SELECT ac.status, ac.scope_type, ac.used_count, ac.max_uses,
                 ac.expires_at IS NOT NULL AND COALESCE(julianday(ac.expires_at) <= julianday('now'), 1) AS expired,
                 ac.valid_from IS NOT NULL AND COALESCE(julianday(ac.valid_from) > julianday('now'), 1) AS not_started,
                 EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.student_id AND p.platform = r.platform
                         AND p.role = 'student' AND p.status = 'active') AS has_profile,
                 r.requested_course IS NULL OR EXISTS (SELECT 1 FROM target_courses WHERE id = r.requested_course) AS scope_matches,
                 (SELECT COUNT(*) FROM target_courses) AS target_count,
                 (SELECT COUNT(*) FROM target_courses tc JOIN enrollments e ON e.course_id = tc.id
                  WHERE e.student_id = r.student_id AND e.platform = r.platform AND e.status = 'active'
                    AND (e.expires_at IS NULL OR julianday(e.expires_at) > julianday('now'))) AS active_count
          FROM live_code ac CROSS JOIN redemption r
        `).bind(...targetBindings)
      ]);
    } catch (err) {
      logError("code.enrollment_failed", err, { student_id: user.id, code_id: codeRow.id });
      return c.json({ error: { code: "ENROLLMENT_FAILED", message: "\u0641\u0634\u0644 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." } }, 500);
    }
    const enrolled = results[0].results;
    if (enrolled.length === 0) {
      const diagnostic = results[2].results[0];
      if (!diagnostic) {
        return c.json({ error: { code: "CODE_NOT_FOUND", message: "\u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" } }, 404);
      }
      if (diagnostic.status !== "active") {
        const msgs = {
          used: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0645\u064F\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644",
          expired: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629",
          revoked: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0645\u0644\u063A\u064A"
        };
        return c.json({ error: { code: "CODE_INVALID", message: msgs[diagnostic.status] || "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
      }
      if (diagnostic.expired) {
        return c.json({ error: { code: "CODE_EXPIRED", message: "\u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" } }, 400);
      }
      if (diagnostic.not_started) {
        return c.json({ error: { code: "CODE_INVALID", message: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
      }
      if (diagnostic.used_count >= diagnostic.max_uses) {
        return c.json({ error: { code: "CODE_USED", message: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0647 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" } }, 400);
      }
      if (!diagnostic.has_profile) {
        return c.json({ error: { code: "FORBIDDEN", message: "\u0641\u0642\u0637 \u0627\u0644\u0637\u0644\u0627\u0628 \u064A\u0645\u0643\u0646\u0647\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0623\u0643\u0648\u0627\u062F" } }, 403);
      }
      if (!diagnostic.scope_matches) {
        const msgs = {
          course: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0645\u062E\u0635\u0635 \u0644\u062A\u0641\u0639\u064A\u0644 \u0643\u0648\u0631\u0633 \u0622\u062E\u0631 \u0648\u0644\u064A\u0633 \u0627\u0644\u0643\u0648\u0631\u0633 \u0627\u0644\u062D\u0627\u0644\u064A",
          bundle: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0645\u062E\u0635\u0635 \u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0643\u0648\u0631\u0633\u0627\u062A \u0644\u0627 \u062A\u0634\u0645\u0644 \u0627\u0644\u0643\u0648\u0631\u0633 \u0627\u0644\u062D\u0627\u0644\u064A",
          all: "\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633 \u0627\u0644\u062D\u0627\u0644\u064A"
        };
        return c.json({ error: { code: "CODE_SCOPE_MISMATCH", message: msgs[diagnostic.scope_type] || "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
      }
      if (diagnostic.target_count === 0) {
        return c.json({ error: { code: "NO_COURSES", message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0643\u0648\u0631\u0633\u0627\u062A \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F" } }, 400);
      }
      if (diagnostic.active_count === diagnostic.target_count) {
        return c.json({ error: { code: "ALREADY_ENROLLED", message: "\u0623\u0646\u062A \u0645\u0634\u062A\u0631\u0643 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0643\u0648\u0631\u0633 \u0623\u0648 \u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062A \u0627\u0644\u062A\u064A \u064A\u0641\u0639\u0644\u0647\u0627 \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F" } }, 400);
      }
      return c.json({ error: { code: "CODE_INVALID", message: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
    }
    const enrollments = enrolled.map((row) => row.course_id);
    return c.json({
      ok: true,
      enrolled_courses: enrollments.length,
      course_ids: enrollments,
      expires_at: enrolled[0].expires_at,
      message: `\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 ${enrollments.length} \u0643\u0648\u0631\u0633 \u0628\u0646\u062C\u0627\u062D!`
    });
  }
);
codes.get("/verify/:code", requireAuth, rateLimit("verify_code", 30, 60), async (c) => {
  const code = normalizeCode(c.req.param("code"));
  const currentPlatform = c.env.PLATFORM_KEY || "fusha";
  const codeRow = await c.env.DB.prepare(
    `SELECT ac.status, ac.scope_type, ac.course_id, ac.used_count, ac.max_uses, ac.expires_at,
            c.title as course_title, cb.access_days
     FROM activation_codes ac
     JOIN code_batches cb ON cb.id = ac.batch_id
     LEFT JOIN courses c ON c.id = ac.course_id
     WHERE ac.code = ? AND ac.platform = ?`
  ).bind(code, currentPlatform).first();
  if (!codeRow) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" } }, 404);
  }
  return c.json({
    valid: codeRow.status === "active",
    status: codeRow.status,
    scope_type: codeRow.scope_type,
    course_title: codeRow.course_title || (codeRow.scope_type === "all" ? "\u062C\u0645\u064A\u0639 \u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062A" : null),
    access_days: codeRow.access_days,
    remaining_uses: codeRow.max_uses - codeRow.used_count,
    expires_at: codeRow.expires_at
  });
});
var codes_default = codes;

// src/routes/questions.ts
var questions = new Hono2();
questions.post("/", requireAuth, rateLimit("post_question", 5, 60), async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const schema = external_exports.object({
    lesson_id: external_exports.string().optional(),
    course_id: external_exports.string().optional(),
    body: external_exports.string().min(5).max(2e3)
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0633\u0624\u0627\u0644 \u0635\u062D\u064A\u062D", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  let courseId = d.course_id || null;
  const platform = c.env.PLATFORM_KEY || "fusha";
  if (d.lesson_id) {
    const lesson = await c.env.DB.prepare(
      `SELECT l.course_id FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND c.platform = ?`
    ).bind(d.lesson_id, platform).first();
    if (!lesson) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    courseId = lesson.course_id;
  } else if (courseId) {
    const course = await c.env.DB.prepare(
      "SELECT id FROM courses WHERE id = ? AND platform = ?"
    ).bind(courseId, platform).first();
    if (!course) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0648\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
  }
  await c.env.DB.prepare(
    `INSERT INTO questions (id, student_id, lesson_id, course_id, body, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', datetime('now'), datetime('now'))`
  ).bind(id, user.id, d.lesson_id || null, courseId, d.body).run();
  return c.json(await c.env.DB.prepare("SELECT * FROM questions WHERE id = ?").bind(id).first(), 201);
});
questions.get("/", requireAuth, async (c) => {
  const lessonId = c.req.query("lesson_id");
  const courseId = c.req.query("course_id");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const user = c.get("user");
  const isStaff = user.role === "admin" || user.role === "assistant";
  const platform = c.env.PLATFORM_KEY || "fusha";
  let targetCourseId = null;
  let isFreePreview = false;
  if (lessonId) {
    const lesson = await c.env.DB.prepare(
      `SELECT l.course_id, l.is_free_preview, c.is_free as course_is_free
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
    ).bind(lessonId, platform).first();
    if (!lesson) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    targetCourseId = lesson.course_id;
    isFreePreview = lesson.is_free_preview === 1 || lesson.course_is_free === 1;
  } else if (courseId) {
    const course = await c.env.DB.prepare(
      "SELECT id FROM courses WHERE id = ? AND platform = ?"
    ).bind(courseId, platform).first();
    if (!course) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0648\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    targetCourseId = courseId;
  }
  if (!isStaff && targetCourseId && !isFreePreview) {
    const enrollment = await c.env.DB.prepare(
      `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
    ).bind(user.id, targetCourseId).first();
    if (!enrollment) {
      return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0627\u0644\u0623\u0633\u0626\u0644\u0629" } }, 403);
    }
    if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
      return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
    }
  }
  let where = "q.status != 'hidden'";
  const params = [];
  if (lessonId) {
    where += " AND q.lesson_id = ?";
    params.push(lessonId);
  } else if (courseId) {
    where += " AND q.course_id = ?";
    params.push(courseId);
  } else {
    where += " AND q.student_id = ?";
    params.push(user.id);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT q.*, p.full_name as student_name,
       (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count
     FROM questions q
     JOIN profiles p ON p.id = q.student_id
     WHERE ${where}
     ORDER BY q.is_pinned DESC, q.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();
  return c.json({ questions: results });
});
questions.get("/:id", requireAuth, async (c) => {
  const questionId = c.req.param("id");
  const user = c.get("user");
  const isStaff = user.role === "admin" || user.role === "assistant";
  const platform = c.env.PLATFORM_KEY || "fusha";
  const question = await c.env.DB.prepare(
    `SELECT q.*, p.full_name as student_name
     FROM questions q JOIN profiles p ON p.id = q.student_id
     WHERE q.id = ? AND p.platform = ?`
  ).bind(questionId, platform).first();
  if (!question) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (!isStaff && question.student_id !== user.id) {
    let isFreePreview = false;
    if (question.lesson_id) {
      const lesson = await c.env.DB.prepare(
        "SELECT is_free_preview FROM lessons WHERE id = ?"
      ).bind(question.lesson_id).first();
      isFreePreview = lesson?.is_free_preview === 1;
    }
    if (question.course_id && !isFreePreview) {
      const enrollment = await c.env.DB.prepare(
        `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, question.course_id).first();
      if (!enrollment) {
        return c.json({ error: { code: "NOT_ENROLLED", message: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0643\u0648\u0631\u0633 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644" } }, 403);
      }
      if (enrollment.expires_at && new Date(enrollment.expires_at) < /* @__PURE__ */ new Date()) {
        return c.json({ error: { code: "ENROLLMENT_EXPIRED", message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643" } }, 403);
      }
    }
  }
  const { results: answers } = await c.env.DB.prepare(
    `SELECT a.*, p.full_name as author_name, p.role as author_role
     FROM answers a JOIN profiles p ON p.id = a.author_id
     WHERE a.question_id = ?
     ORDER BY a.is_accepted DESC, a.created_at ASC`
  ).bind(questionId).all();
  return c.json({ ...question, answers });
});
var questions_default = questions;

// src/routes/admin.ts
function sanitizeFilename(filename) {
  return filename.replace(/[#?%&+=/\\:*\x22<>| ]/g, "_").replace(/__+/g, "_");
}
__name(sanitizeFilename, "sanitizeFilename");
async function verifyStudentPlatform(db, studentId, platform) {
  const row = await db.prepare(
    "SELECT id FROM profiles WHERE id = ? AND platform = ?"
  ).bind(studentId, platform).first();
  return !!row;
}
__name(verifyStudentPlatform, "verifyStudentPlatform");
var admin = new Hono2();
admin.use("/*", async (c, next) => {
  if (c.req.method === "POST") {
    return rateLimit("admin_post", 30, 60)(c, next);
  }
  await next();
});
var boolLike = external_exports.preprocess(
  (v) => v === 1 ? true : v === 0 ? false : v,
  external_exports.boolean()
);
var updateCourseSchema = external_exports.object({
  title: external_exports.string().min(1).max(200).optional(),
  description: external_exports.string().max(1e3).optional().nullable(),
  grade: external_exports.string().max(50).optional().nullable(),
  branch: external_exports.string().max(50).optional().nullable(),
  reference_price: external_exports.number().int().nonnegative().optional().nullable(),
  is_free: boolLike.optional(),
  is_published: boolLike.optional(),
  is_archived: boolLike.optional(),
  sort_order: external_exports.number().int().optional(),
  cover_url: external_exports.string().max(1e3).optional().nullable()
});
var updateUnitSchema = external_exports.object({
  title: external_exports.string().min(1).max(200).optional(),
  description: external_exports.string().max(1e3).optional().nullable(),
  sort_order: external_exports.number().int().optional(),
  is_published: boolLike.optional(),
  is_archived: boolLike.optional()
});
var updateLessonSchema = external_exports.object({
  title: external_exports.string().min(1).max(200).optional(),
  description: external_exports.string().max(1e3).optional().nullable(),
  sort_order: external_exports.number().int().optional(),
  is_free_preview: boolLike.optional(),
  is_published: boolLike.optional(),
  is_archived: boolLike.optional(),
  duration_seconds: external_exports.number().int().nonnegative().optional().nullable()
});
var updateStudentSchema = external_exports.object({
  status: external_exports.enum(["active", "blocked"]).optional(),
  max_devices: external_exports.number().int().positive().optional(),
  role: external_exports.enum(["student", "assistant", "admin"]).optional()
});
var updateQuestionSchema = external_exports.object({
  status: external_exports.string().max(50).optional(),
  is_pinned: boolLike.optional()
});
var updateSettingsSchema = external_exports.record(
  external_exports.string().regex(/^[a-zA-Z0-9_\-]+$/).max(100),
  external_exports.string().max(1e3)
);
admin.use("*", requireAuth, requireRole("admin", "assistant"));
admin.get("/courses", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const search = c.req.query("search");
  const archived = c.req.query("archived") === "1";
  const platform = c.env.PLATFORM_KEY || "fusha";
  let where = archived ? "c.is_archived = 1 AND c.platform = ?" : "c.is_archived = 0 AND c.platform = ?";
  const params = [platform];
  if (search) {
    where += " AND (c.title LIKE ? OR c.slug LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
       (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'active') as students_count,
       (SELECT COUNT(*) FROM units WHERE course_id = c.id AND is_archived = 0) as units_count,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0) as lessons_count
     FROM courses c WHERE ${where}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();
  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM courses c WHERE ${where}`
  ).bind(...params).first() || { count: 0 };
  return c.json({ courses: results, meta: { page, limit, total, has_more: offset + limit < total } });
});
admin.post("/courses", requirePermission("can_manage_courses"), audit("admin.course.create"), async (c) => {
  const body = await c.req.json();
  const schema = external_exports.object({
    title: external_exports.string().min(2).max(200),
    description: external_exports.string().optional(),
    grade: external_exports.string().optional(),
    branch: external_exports.string().optional().nullable(),
    reference_price: external_exports.number().int().optional(),
    is_free: external_exports.boolean().optional(),
    is_published: external_exports.boolean().optional(),
    cover_url: external_exports.string().optional()
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const user = c.get("user");
  const d = parsed.data;
  const id = generateId();
  const baseSlug = slugify(d.title) || id.slice(0, 8);
  let slug = baseSlug;
  const conflict = await c.env.DB.prepare(
    "SELECT id, is_archived, slug FROM courses WHERE slug = ? LIMIT 1"
  ).bind(slug).first();
  if (conflict) {
    if (conflict.is_archived === 1) {
      const renamedSlug = `${conflict.slug}-archived-${Date.now()}`;
      await c.env.DB.prepare(
        "UPDATE courses SET slug = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(renamedSlug, conflict.id).run();
      console.log(`[Admin Course] Renamed archived course ${conflict.id} slug from ${conflict.slug} to ${renamedSlug} to free up unique name`);
    } else {
      slug = `${baseSlug}-${generateId().slice(0, 4)}`;
    }
  }
  const platform = c.env.PLATFORM_KEY || "fusha";
  await c.env.DB.prepare(
    `INSERT INTO courses (id, title, slug, description, cover_url, grade, branch, reference_price, is_free, is_published, created_by, platform, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, d.title, slug, d.description || "", d.cover_url || null, d.grade || "", d.branch || null, d.reference_price || 0, d.is_free ? 1 : 0, d.is_published ? 1 : 0, user.id, platform).run();
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE id = ?").bind(id).first();
  return c.json(course, 201);
});
admin.post("/courses/cover-upload-url", requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json();
  if (!body.filename) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `covers/${id}_${cleanFilename}`;
  const contentType = body.mime_type || "image/jpeg";
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    contentType,
    3600
    // 1 hour expiration
  );
  const origin = new URL(c.req.url).origin;
  const publicUrl = `${origin}/files/covers/${id}_${cleanFilename}`;
  return c.json({
    upload_url: uploadUrl,
    public_url: publicUrl,
    r2_key: r2Key
  });
});
admin.patch("/courses/:id", requirePermission("can_manage_courses"), audit("admin.course.update"), async (c) => {
  const courseId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const fields = {};
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val !== void 0) {
      if (typeof val === "boolean")
        fields[key] = val ? 1 : 0;
      else
        fields[key] = val;
    }
  }
  if (Object.keys(fields).length === 0) {
    return c.json({ error: { code: "NO_CHANGES", message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0639\u062F\u064A\u0644\u0627\u062A" } }, 400);
  }
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  const vals = Object.values(fields);
  await c.env.DB.prepare(
    `UPDATE courses SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...vals, courseId).run();
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE id = ?").bind(courseId).first();
  return c.json(course);
});
admin.delete("/courses/:id", requirePermission("can_manage_courses"), audit("admin.course.archive"), async (c) => {
  const courseId = c.req.param("id");
  const course = await c.env.DB.prepare(
    "SELECT slug FROM courses WHERE id = ?"
  ).bind(courseId).first();
  if (course) {
    const archivedSlug = `${course.slug}-archived-${Date.now()}`;
    await c.env.DB.prepare(
      "UPDATE courses SET is_archived = 1, slug = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(archivedSlug, courseId).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE courses SET is_archived = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(courseId).run();
  }
  return c.json({ ok: true });
});
admin.post("/courses/:courseId/units", requirePermission("can_manage_courses"), async (c) => {
  const courseId = c.req.param("courseId");
  const body = await c.req.json();
  const createUnitSchema = external_exports.object({
    title: external_exports.string().min(1).max(200),
    description: external_exports.string().max(1e3).optional().nullable()
  });
  const parsed = createUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const { title, description } = parsed.data;
  const id = generateId();
  const { count } = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM units WHERE course_id = ?"
  ).bind(courseId).first() || { count: 0 };
  await c.env.DB.prepare(
    `INSERT INTO units (id, course_id, title, description, sort_order, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
  ).bind(id, courseId, title, description || "", count).run();
  const unit = await c.env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(id).first();
  return c.json(unit, 201);
});
admin.patch("/units/:id", requirePermission("can_manage_courses"), async (c) => {
  const unitId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const sets = [];
  const vals = [];
  for (const [k, val] of Object.entries(parsed.data)) {
    if (val !== void 0) {
      sets.push(`${k} = ?`);
      vals.push(typeof val === "boolean" ? val ? 1 : 0 : val);
    }
  }
  if (sets.length === 0)
    return c.json({ error: { code: "NO_CHANGES", message: "\u0644\u0627 \u062A\u0639\u062F\u064A\u0644\u0627\u062A" } }, 400);
  await c.env.DB.prepare(`UPDATE units SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, unitId).run();
  return c.json(await c.env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(unitId).first());
});
admin.post("/units/:unitId/lessons", requirePermission("can_manage_courses"), async (c) => {
  const unitId = c.req.param("unitId");
  const body = await c.req.json();
  const createLessonSchema = external_exports.object({
    title: external_exports.string().min(1).max(200),
    description: external_exports.string().max(1e3).optional().nullable(),
    is_free_preview: external_exports.boolean().optional(),
    is_published: external_exports.boolean().optional(),
    duration_seconds: external_exports.number().int().nonnegative().optional().nullable()
  });
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const unit = await c.env.DB.prepare("SELECT course_id FROM units WHERE id = ?").bind(unitId).first();
  if (!unit)
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  const id = generateId();
  const { count } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM lessons WHERE unit_id = ?").bind(unitId).first() || { count: 0 };
  await c.env.DB.prepare(
    `INSERT INTO lessons (id, unit_id, course_id, title, description, sort_order, is_free_preview, is_published, duration_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, unitId, unit.course_id, d.title, d.description || "", count, d.is_free_preview ? 1 : 0, d.is_published ? 1 : 0, d.duration_seconds || null).run();
  return c.json(await c.env.DB.prepare("SELECT * FROM lessons WHERE id = ?").bind(id).first(), 201);
});
admin.patch("/lessons/:id", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const sets = [];
  const vals = [];
  for (const [k, val] of Object.entries(parsed.data)) {
    if (val !== void 0) {
      sets.push(`${k} = ?`);
      vals.push(typeof val === "boolean" ? val ? 1 : 0 : val);
    }
  }
  if (sets.length === 0)
    return c.json({ error: { code: "NO_CHANGES", message: "\u0644\u0627 \u062A\u0639\u062F\u064A\u0644\u0627\u062A" } }, 400);
  await c.env.DB.prepare(`UPDATE lessons SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, lessonId).run();
  return c.json(await c.env.DB.prepare("SELECT * FROM lessons WHERE id = ?").bind(lessonId).first());
});
admin.delete("/lessons/:id", requirePermission("can_manage_courses"), audit("admin.lesson.archive"), async (c) => {
  const lessonId = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE lessons SET is_archived = 1, updated_at = datetime('now') WHERE id = ?"
  ).bind(lessonId).run();
  return c.json({ ok: true });
});
admin.post("/lessons/:id/videos", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  const createVideoSchema = external_exports.object({
    provider: external_exports.enum(["r2_hls", "r2", "server", "youtube"]).default("r2_hls"),
    stream_uid: external_exports.string().max(500).optional().nullable(),
    youtube_id: external_exports.string().max(50).optional().nullable(),
    thumbnail_url: external_exports.string().max(1e3).optional().nullable(),
    duration_seconds: external_exports.number().int().nonnegative().optional().nullable(),
    status: external_exports.enum(["uploading", "processing", "ready", "error"]).default("ready"),
    require_drm: external_exports.boolean().default(true)
  });
  const parsed = createVideoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM lesson_videos WHERE lesson_id = ?").bind(lessonId),
    c.env.DB.prepare(
      `INSERT INTO lesson_videos (id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).bind(id, lessonId, d.provider, d.stream_uid || null, d.youtube_id || null, d.thumbnail_url || null, d.duration_seconds || null, d.status, d.require_drm ? 1 : 0)
  ]);
  return c.json(await c.env.DB.prepare("SELECT * FROM lesson_videos WHERE id = ?").bind(id).first(), 201);
});
admin.post("/lessons/:id/videos/upload-url", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  if (!body.filename) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `lessons/${lessonId}/videos/${id}/${cleanFilename}`;
  const contentType = body.mime_type || "video/mp4";
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    contentType,
    7200
  );
  return c.json({
    upload_url: uploadUrl,
    r2_key: r2Key,
    video_id: id
  });
});
admin.post("/lessons/:id/videos/hls-upload-url", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  if (!body.filename) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const videoId = body.videoId || generateId();
  const cleanFilename = body.filename.split("/").map((segment) => sanitizeFilename(segment)).join("/");
  const r2Key = `lessons/${lessonId}/videos/${videoId}/hls/${cleanFilename}`;
  let contentType = "application/octet-stream";
  if (cleanFilename.endsWith(".m3u8")) {
    contentType = "application/x-mpegURL";
  } else if (cleanFilename.endsWith(".ts")) {
    contentType = "video/MP2T";
  } else if (cleanFilename.endsWith(".m4s")) {
    contentType = "video/iso.segment";
  } else if (cleanFilename.endsWith(".mp4")) {
    contentType = "video/mp4";
  } else if (cleanFilename.endsWith(".json")) {
    contentType = "application/json";
  }
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    contentType,
    7200
  );
  return c.json({
    upload_url: uploadUrl,
    r2_key: r2Key,
    video_id: videoId
  });
});
admin.post("/lessons/:id/files", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  const createFileSchema = external_exports.object({
    title: external_exports.string().min(1).max(500),
    mime_type: external_exports.string().max(100).default("application/pdf"),
    size_bytes: external_exports.number().int().nonnegative().default(0),
    is_downloadable: external_exports.boolean().default(false),
    watermark: external_exports.boolean().default(true)
  });
  const parsed = createFileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  const cleanTitle = sanitizeFilename(d.title);
  const r2Key = `lessons/${lessonId}/files/${id}/${cleanTitle}`;
  await c.env.DB.prepare(
    `INSERT INTO lesson_files (id, lesson_id, title, r2_key, mime_type, size_bytes, is_downloadable, watermark, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  ).bind(id, lessonId, d.title, r2Key, d.mime_type, d.size_bytes, d.is_downloadable ? 1 : 0, d.watermark ? 1 : 0).run();
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    d.mime_type,
    3600
    // 1 hour expiration
  );
  return c.json({
    file: await c.env.DB.prepare("SELECT * FROM lesson_files WHERE id = ?").bind(id).first(),
    upload: { r2_key: r2Key, method: "PUT", upload_url: uploadUrl }
  }, 201);
});
admin.delete("/lessons/:id/files/:fileId", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const fileId = c.req.param("fileId");
  const file = await c.env.DB.prepare(
    "SELECT r2_key FROM lesson_files WHERE id = ? AND lesson_id = ?"
  ).bind(fileId, lessonId).first();
  if (!file) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  try {
    await c.env.R2.delete(file.r2_key);
  } catch (err) {
    console.error("Failed to delete file from R2:", err);
  }
  await c.env.DB.prepare(
    "DELETE FROM lesson_files WHERE id = ? AND lesson_id = ?"
  ).bind(fileId, lessonId).run();
  return c.json({ ok: true });
});
admin.post("/codes/batches", requirePermission("can_manage_codes"), audit("admin.codes.generate"), async (c) => {
  const body = await c.req.json();
  const schema = external_exports.object({
    name: external_exports.string().min(1),
    scope_type: external_exports.enum(["course", "bundle", "all"]),
    course_id: external_exports.string().optional(),
    bundle_id: external_exports.string().optional(),
    quantity: external_exports.number().int().min(1).max(1e3),
    access_days: external_exports.number().int().min(1).optional(),
    expires_at: external_exports.string().optional(),
    note: external_exports.string().optional()
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const user = c.get("user");
  const batchId = generateId();
  const platform = c.env.PLATFORM_KEY || "fusha";
  await c.env.DB.prepare(
    `INSERT INTO code_batches (id, name, scope_type, course_id, bundle_id, quantity, access_days, expires_at, note, created_by, platform, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(batchId, d.name, d.scope_type, d.course_id || null, d.bundle_id || null, d.quantity, d.access_days || null, d.expires_at || null, d.note || null, user.id, platform).run();
  const statements = [];
  const generatedCodes = [];
  for (let i = 0; i < d.quantity; i++) {
    const id = generateId();
    const code = generateActivationCode();
    generatedCodes.push(code);
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO activation_codes (id, code, batch_id, scope_type, course_id, bundle_id, status, max_uses, used_count, access_days, expires_at, created_by, platform, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, code, batchId, d.scope_type, d.course_id || null, d.bundle_id || null, d.access_days || null, d.expires_at || null, user.id, platform)
    );
  }
  await c.env.DB.batch(statements);
  return c.json({
    batch_id: batchId,
    quantity: d.quantity,
    codes: generatedCodes
  }, 201);
});
admin.get("/codes/batches", requirePermission("can_manage_codes"), async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results } = await c.env.DB.prepare(
    `SELECT cb.*,
       (SELECT COUNT(*) FROM activation_codes WHERE batch_id = cb.id AND status = 'active') as active_count,
       (SELECT COUNT(*) FROM activation_codes WHERE batch_id = cb.id AND status = 'used') as used_count,
       c.title as course_title,
       p.full_name as created_by_name
     FROM code_batches cb
     LEFT JOIN courses c ON c.id = cb.course_id
     LEFT JOIN profiles p ON p.id = cb.created_by
     WHERE cb.platform = ?
     ORDER BY cb.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(platform, limit, offset).all();
  return c.json({ batches: results });
});
admin.get("/codes/batches/:id/codes", requirePermission("can_manage_codes"), async (c) => {
  const batchId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const batch = await c.env.DB.prepare(
    "SELECT id FROM code_batches WHERE id = ? AND platform = ?"
  ).bind(batchId, platform).first();
  if (!batch) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0641\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ac.*, p.full_name as used_by_name, p.phone as used_by_phone
     FROM activation_codes ac
     LEFT JOIN profiles p ON p.id = ac.used_by
     WHERE ac.batch_id = ?
     ORDER BY ac.created_at ASC`
  ).bind(batchId).all();
  return c.json({ codes: results });
});
admin.get("/codes/batches/:id/csv", requirePermission("can_manage_codes"), async (c) => {
  const batchId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const batch = await c.env.DB.prepare(
    "SELECT id FROM code_batches WHERE id = ? AND platform = ?"
  ).bind(batchId, platform).first();
  if (!batch) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0641\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ac.code, ac.status, ac.used_count, ac.max_uses,
            p.full_name as used_by_name, p.phone as used_by_phone, ac.used_at
     FROM activation_codes ac
     LEFT JOIN profiles p ON p.id = ac.used_by
     WHERE ac.batch_id = ?
     ORDER BY ac.created_at ASC`
  ).bind(batchId).all();
  function escapeCsvValue(val) {
    if (val === null || val === void 0)
      return "";
    let str = String(val);
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  __name(escapeCsvValue, "escapeCsvValue");
  const csv = [
    "\u0627\u0644\u0643\u0648\u062F,\u0627\u0644\u062D\u0627\u0644\u0629,\u0639\u062F\u062F \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0627\u062A,\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649,\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645,\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641,\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645",
    ...results.map(
      (r) => `${escapeCsvValue(r.code)},${escapeCsvValue(r.status)},${escapeCsvValue(r.used_count)},${escapeCsvValue(r.max_uses)},${escapeCsvValue(r.used_by_name)},${escapeCsvValue(r.used_by_phone)},${escapeCsvValue(r.used_at)}`
    )
  ].join("\n");
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="batch-${batchId}.csv"`
    }
  });
});
admin.delete("/codes/batches/:id", requirePermission("can_manage_codes"), audit("admin.codes.delete_batch"), async (c) => {
  const batchId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const batch = await c.env.DB.prepare(
    "SELECT id FROM code_batches WHERE id = ? AND platform = ?"
  ).bind(batchId, platform).first();
  if (!batch) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062F\u0641\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE enrollments SET code_id = NULL WHERE code_id IN (SELECT id FROM activation_codes WHERE batch_id = ?)").bind(batchId),
    c.env.DB.prepare("UPDATE financial_transactions SET code_id = NULL WHERE code_id IN (SELECT id FROM activation_codes WHERE batch_id = ?)").bind(batchId),
    c.env.DB.prepare("DELETE FROM activation_codes WHERE batch_id = ?").bind(batchId),
    c.env.DB.prepare("DELETE FROM code_batches WHERE id = ?").bind(batchId)
  ]);
  return c.json({ ok: true });
});
admin.delete("/codes/:id", requirePermission("can_manage_codes"), audit("admin.codes.delete_single"), async (c) => {
  const codeId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const code = await c.env.DB.prepare(
    "SELECT id FROM activation_codes WHERE id = ? AND platform = ?"
  ).bind(codeId, platform).first();
  if (!code) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE enrollments SET code_id = NULL WHERE code_id = ?").bind(codeId),
    c.env.DB.prepare("UPDATE financial_transactions SET code_id = NULL WHERE code_id = ?").bind(codeId),
    c.env.DB.prepare("DELETE FROM activation_codes WHERE id = ?").bind(codeId)
  ]);
  return c.json({ ok: true });
});
admin.get("/students", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const search = c.req.query("search");
  const status = c.req.query("status");
  const platform = c.env.PLATFORM_KEY || "fusha";
  let where = "p.role = 'student' AND p.platform = ?";
  const params = [platform];
  if (search) {
    where += " AND (p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.student_code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    where += " AND p.status = ?";
    params.push(status);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT p.*,
       (SELECT COUNT(*) FROM enrollments WHERE student_id = p.id AND status = 'active') as enrollments_count,
       (SELECT COUNT(*) FROM devices WHERE student_id = p.id) as devices_count
     FROM profiles p WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();
  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM profiles p WHERE ${where}`
  ).bind(...params).first() || { count: 0 };
  return c.json({ students: results, meta: { page, limit, total, has_more: offset + limit < total } });
});
admin.patch("/students/:id", requireRole("admin"), audit("admin.student.update"), async (c) => {
  const studentId = c.req.param("id");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const body = await c.req.json();
  const parsed = updateStudentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const fields = parsed.data;
  if (studentId === user.id && (fields.role !== void 0 || fields.status !== void 0)) {
    return c.json({ error: { code: "SELF_MODIFICATION_FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 \u062F\u0648\u0631\u0643 \u0623\u0648 \u062D\u0627\u0644\u062A\u0643 \u0627\u0644\u062E\u0627\u0635\u0629" } }, 403);
  }
  const sets = [];
  const vals = [];
  if (fields.status !== void 0) {
    sets.push("status = ?");
    vals.push(fields.status);
  }
  if (fields.max_devices !== void 0) {
    sets.push("max_devices = ?");
    vals.push(fields.max_devices);
  }
  if (fields.role !== void 0) {
    sets.push("role = ?");
    vals.push(fields.role);
  }
  if (sets.length === 0)
    return c.json({ error: { code: "NO_CHANGES", message: "\u0644\u0627 \u062A\u0639\u062F\u064A\u0644\u0627\u062A" } }, 400);
  c.set("auditTargetType", "student");
  c.set("auditTargetId", studentId);
  c.set("auditMeta", { status: fields.status, role: fields.role, max_devices: fields.max_devices });
  if (fields.status === "blocked" && c.env.KV) {
    await c.env.KV.put(`blacklist:user:${studentId}`, "1", { expirationTtl: 86400 });
  } else if (fields.status === "active" && c.env.KV) {
    await c.env.KV.delete(`blacklist:user:${studentId}`);
  }
  await c.env.DB.prepare(`UPDATE profiles SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, studentId).run();
  return c.json(await c.env.DB.prepare("SELECT id, supabase_user_id, email, student_code, role, full_name, phone, parent_phone, grade, governorate, avatar_url, status, max_devices, created_at, updated_at, last_seen_at, last_self_reset_at FROM profiles WHERE id = ?").bind(studentId).first());
});
admin.delete("/students/:id", requireRole("admin"), audit("admin.student.delete"), async (c) => {
  const studentId = c.req.param("id");
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (studentId === user.id) {
    return c.json({ error: { code: "SELF_DELETION_FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u062E\u0627\u0635" } }, 403);
  }
  c.set("auditTargetType", "student");
  c.set("auditTargetId", studentId);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM devices WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM device_reset_requests WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM enrollments WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM lesson_progress WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM quiz_attempts WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM lecture_playback_logs WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM financial_transactions WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM reviews WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM answers WHERE author_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM questions WHERE student_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM notifications WHERE recipient_id = ?").bind(studentId),
    c.env.DB.prepare("DELETE FROM profiles WHERE id = ?").bind(studentId)
  ]);
  if (c.env.KV) {
    await c.env.KV.delete(`blacklist:user:${studentId}`);
  }
  return c.json({ success: true, message: "\u062A\u0645 \u0645\u0633\u062D \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0627\u0644\u0628 \u0648\u0643\u0644 \u0645\u0627 \u064A\u062A\u0639\u0644\u0642 \u0628\u0647 \u0628\u0646\u062C\u0627\u062D" });
});
admin.get("/students/:id/devices", requirePermission("can_reset_devices"), async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, device_id, platform, model, is_trusted, is_rooted, last_login_at, created_at
     FROM devices WHERE student_id = ? ORDER BY last_login_at DESC`
  ).bind(studentId).all();
  return c.json({ devices: results });
});
admin.delete("/students/:id/devices", requirePermission("can_reset_devices"), audit("admin.student.unbind_devices"), async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM devices WHERE student_id = ?").bind(studentId).run();
  return c.json({ ok: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u062C\u0647\u0632\u0629" });
});
admin.delete("/students/:id/devices/:deviceId", requirePermission("can_reset_devices"), async (c) => {
  const studentId = c.req.param("id");
  const deviceId = c.req.param("deviceId");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM devices WHERE student_id = ? AND id = ?").bind(studentId, deviceId).run();
  return c.json({ ok: true });
});
admin.post("/students/:id/enroll", requirePermission("can_manage_courses"), audit("admin.student.enroll"), async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { course_id, access_days } = await c.req.json();
  if (!course_id)
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0643\u0648\u0631\u0633 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  let expiresAt = null;
  if (access_days) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + access_days);
    expiresAt = d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO enrollments (id, student_id, course_id, source, status, platform, granted_at, expires_at, created_at)
     VALUES (?, ?, ?, 'manual', 'active', ?, datetime('now'), ?, datetime('now'))
     ON CONFLICT(student_id, course_id) DO UPDATE SET status = 'active', expires_at = excluded.expires_at, granted_at = datetime('now'), platform = excluded.platform`
  ).bind(id, studentId, course_id, platform, expiresAt).run();
  return c.json({ ok: true, enrollment_id: id });
});
admin.get("/students/:id/financials", requireRole("admin"), async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ft.*, c.title as course_title, ac.code as code_string
     FROM financial_transactions ft
     LEFT JOIN courses c ON ft.course_id = c.id
     LEFT JOIN activation_codes ac ON ft.code_id = ac.id
     WHERE ft.student_id = ?
     ORDER BY ft.created_at DESC`
  ).bind(studentId).all();
  return c.json({ financials: results });
});
admin.post("/students/:id/financials", requireRole("admin"), audit("admin.student.add_financial"), async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { course_id, amount, note } = await c.req.json();
  if (!amount)
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" } }, 400);
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO financial_transactions (id, student_id, course_id, amount, transaction_type, code_id, note, created_at)
     VALUES (?, ?, ?, ?, 'manual_admin', NULL, ?, datetime('now'))`
  ).bind(id, studentId, course_id || null, amount, note || "").run();
  return c.json({ ok: true, transaction_id: id }, 201);
});
admin.get("/students/:id/playback-logs", async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT lpl.*, l.title as lesson_title
     FROM lecture_playback_logs lpl
     INNER JOIN lessons l ON lpl.lesson_id = l.id
     WHERE lpl.student_id = ?
     ORDER BY lpl.created_at DESC
     LIMIT 100`
  ).bind(studentId).all();
  return c.json({ playback_logs: results });
});
admin.get("/students/:id/quiz-attempts", async (c) => {
  const studentId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT qa.*, q.title as quiz_title, q.max_score
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON qa.quiz_id = q.id
     WHERE qa.student_id = ?
     ORDER BY qa.submitted_at DESC`
  ).bind(studentId).all();
  return c.json({ quiz_attempts: results });
});
admin.get("/questions", async (c) => {
  const status = c.req.query("status") || "open";
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results } = await c.env.DB.prepare(
    `SELECT q.*, p.full_name as student_name, p.phone as student_phone,
            l.title as lesson_title, c.title as course_title,
            (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count
     FROM questions q
     JOIN profiles p ON p.id = q.student_id
     LEFT JOIN lessons l ON l.id = q.lesson_id
     LEFT JOIN courses c ON c.id = q.course_id
     WHERE q.status = ? AND p.platform = ?
     ORDER BY q.is_pinned DESC, q.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(status, platform, limit, offset).all();
  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM questions q JOIN profiles p ON p.id = q.student_id WHERE q.status = ? AND p.platform = ?`
  ).bind(status, platform).first() || { count: 0 };
  return c.json({ questions: results, meta: { page, limit, total, has_more: offset + limit < total } });
});
admin.post("/questions/:id/answer", requirePermission("can_answer_questions"), audit("admin.question.answer"), async (c) => {
  const questionId = c.req.param("id");
  const { body: answerBody, image_url } = await c.req.json();
  if (!answerBody)
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0646\u0635 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  const user = c.get("user");
  const id = generateId();
  const platform = c.env.PLATFORM_KEY || "fusha";
  const question = await c.env.DB.prepare(
    `SELECT q.student_id FROM questions q
     JOIN profiles p ON p.id = q.student_id
     WHERE q.id = ? AND p.platform = ?`
  ).bind(questionId, platform).first();
  if (!question) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0646\u0635\u0629" } }, 404);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO answers (id, question_id, author_id, body, image_url, is_accepted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).bind(id, questionId, user.id, answerBody, image_url || null),
    c.env.DB.prepare(
      "UPDATE questions SET status = 'answered', updated_at = datetime('now') WHERE id = ?"
    ).bind(questionId)
  ]);
  if (question) {
    const device = await c.env.DB.prepare("SELECT push_token FROM devices WHERE student_id = ? AND push_token IS NOT NULL LIMIT 1").bind(question.student_id).first();
    if (device?.push_token) {
      c.executionCtx.waitUntil(
        sendNotificationDirectly(c.env, {
          type: "single",
          tokens: [device.push_token],
          title: "\u062A\u0645 \u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0633\u0624\u0627\u0644\u0643",
          body: answerBody.substring(0, 100),
          data: { screen: "question", question_id: questionId }
        })
      );
    }
  }
  return c.json({ ok: true, answer_id: id });
});
admin.post("/questions/answer-image-url", requirePermission("can_answer_questions"), async (c) => {
  const body = await c.req.json();
  if (!body.filename) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `questions/answers_${id}_${cleanFilename}`;
  const contentType = body.mime_type || "image/jpeg";
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    contentType,
    3600
    // 1 hour expiration
  );
  const origin = new URL(c.req.url).origin;
  const publicUrl = `${origin}/files/questions/answers_${id}_${cleanFilename}`;
  return c.json({
    upload_url: uploadUrl,
    public_url: publicUrl,
    r2_key: r2Key
  });
});
admin.patch("/questions/:id", requirePermission("can_answer_questions"), async (c) => {
  const questionId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const platform = c.env.PLATFORM_KEY || "fusha";
  const question = await c.env.DB.prepare(
    `SELECT q.id FROM questions q
     JOIN profiles p ON p.id = q.student_id
     WHERE q.id = ? AND p.platform = ?`
  ).bind(questionId, platform).first();
  if (!question) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0646\u0635\u0629" } }, 404);
  }
  const fields = parsed.data;
  const sets = [];
  const vals = [];
  if (fields.status !== void 0) {
    sets.push("status = ?");
    vals.push(fields.status);
  }
  if (fields.is_pinned !== void 0) {
    sets.push("is_pinned = ?");
    vals.push(fields.is_pinned ? 1 : 0);
  }
  if (sets.length === 0)
    return c.json({ error: { code: "NO_CHANGES", message: "\u0644\u0627 \u062A\u0639\u062F\u064A\u0644\u0627\u062A" } }, 400);
  await c.env.DB.prepare(`UPDATE questions SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, questionId).run();
  return c.json({ ok: true });
});
admin.get("/me/permissions", async (c) => {
  const user = c.get("user");
  if (user.role === "admin") {
    return c.json({
      role: "admin",
      can_reset_devices: true,
      can_grade_quizzes: true,
      can_answer_questions: true,
      can_manage_codes: true,
      can_manage_courses: true
    });
  }
  const perm = await c.env.DB.prepare(
    "SELECT can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses FROM assistant_permissions WHERE assistant_id = ?"
  ).bind(user.id).first();
  return c.json({
    role: "assistant",
    can_reset_devices: !!perm?.can_reset_devices,
    can_grade_quizzes: !!perm?.can_grade_quizzes,
    can_answer_questions: !!perm?.can_answer_questions,
    can_manage_codes: !!perm?.can_manage_codes,
    can_manage_courses: !!perm?.can_manage_courses
  });
});
admin.get("/assistants", requireRole("admin"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results: assistants } = await c.env.DB.prepare(
    `SELECT p.id, p.full_name, p.email, p.phone, p.status, p.created_at,
       ap.can_reset_devices, ap.can_grade_quizzes, ap.can_answer_questions, ap.can_manage_codes, ap.can_manage_courses
     FROM profiles p
     LEFT JOIN assistant_permissions ap ON p.id = ap.assistant_id
     WHERE p.role = 'assistant' AND p.platform = ?
     ORDER BY p.created_at DESC`
  ).bind(platform).all();
  return c.json({ assistants });
});
admin.post("/assistants", requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const schema = external_exports.object({
    email: external_exports.string().email(),
    full_name: external_exports.string().min(2),
    phone: external_exports.string().optional(),
    // كلمة مرور اختيارية: بدونها لا يستطيع المساعد تسجيل الدخول
    // (لا يوجد مزوّد هوية خارجي بعد إزالة Supabase).
    password: external_exports.string().min(8).max(200).optional(),
    permissions: external_exports.object({
      can_reset_devices: external_exports.boolean(),
      can_grade_quizzes: external_exports.boolean(),
      can_answer_questions: external_exports.boolean(),
      can_manage_codes: external_exports.boolean(),
      can_manage_courses: external_exports.boolean()
    })
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const platform = c.env.PLATFORM_KEY || "fusha";
  const existing = await c.env.DB.prepare("SELECT id FROM profiles WHERE email = ? AND platform = ?").bind(d.email, platform).first();
  if (existing) {
    return c.json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631" } }, 400);
  }
  const assistantId = generateId();
  const now = nowISO();
  const passwordHash = d.password ? await hashPassword(d.password) : null;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO profiles (id, supabase_user_id, email, password_hash, role, full_name, phone, status, max_devices, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'assistant', ?, ?, 'active', 5, ?, ?, ?)`
    ).bind(assistantId, `local-${assistantId}`, d.email, passwordHash, d.full_name, d.phone || "", platform, now, now),
    c.env.DB.prepare(
      `INSERT INTO assistant_permissions (id, assistant_id, can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      generateId(),
      assistantId,
      d.permissions.can_reset_devices ? 1 : 0,
      d.permissions.can_grade_quizzes ? 1 : 0,
      d.permissions.can_answer_questions ? 1 : 0,
      d.permissions.can_manage_codes ? 1 : 0,
      d.permissions.can_manage_courses ? 1 : 0,
      now,
      now
    )
  ]);
  return c.json({ ok: true, assistant_id: assistantId }, 201);
});
admin.patch("/assistants/:id", requireRole("admin"), async (c) => {
  const assistantId = c.req.param("id");
  const body = await c.req.json();
  const schema = external_exports.object({
    permissions: external_exports.object({
      can_reset_devices: external_exports.boolean(),
      can_grade_quizzes: external_exports.boolean(),
      can_answer_questions: external_exports.boolean(),
      can_manage_codes: external_exports.boolean(),
      can_manage_courses: external_exports.boolean()
    })
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const now = nowISO();
  const platform = c.env.PLATFORM_KEY || "fusha";
  const result = await c.env.DB.prepare(
    `INSERT INTO assistant_permissions (id, assistant_id, can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses, created_at, updated_at)
     SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM profiles
     WHERE id = ? AND role = 'assistant' AND platform = ?
     ON CONFLICT(assistant_id) DO UPDATE SET
       can_reset_devices = excluded.can_reset_devices,
       can_grade_quizzes = excluded.can_grade_quizzes,
       can_answer_questions = excluded.can_answer_questions,
       can_manage_codes = excluded.can_manage_codes,
       can_manage_courses = excluded.can_manage_courses,
       updated_at = excluded.updated_at`
  ).bind(
    generateId(),
    d.permissions.can_reset_devices ? 1 : 0,
    d.permissions.can_grade_quizzes ? 1 : 0,
    d.permissions.can_answer_questions ? 1 : 0,
    d.permissions.can_manage_codes ? 1 : 0,
    d.permissions.can_manage_courses ? 1 : 0,
    now,
    now,
    assistantId,
    platform
  ).run();
  if (result.meta.changes === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Assistant not found" } }, 404);
  }
  return c.json({ ok: true });
});
admin.delete("/assistants/:id", requireRole("admin"), async (c) => {
  const assistantId = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM assistant_permissions WHERE assistant_id = ?
       AND EXISTS (SELECT 1 FROM profiles WHERE id = assistant_permissions.assistant_id AND role = 'assistant' AND platform = ?)`
    ).bind(assistantId, platform),
    c.env.DB.prepare("DELETE FROM profiles WHERE id = ? AND role = 'assistant' AND platform = ?").bind(assistantId, platform)
  ]);
  if (results[1].meta.changes === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Assistant not found" } }, 404);
  }
  return c.json({ ok: true });
});
admin.get("/device-resets", requirePermission("can_reset_devices"), async (c) => {
  const status = c.req.query("status") || "pending";
  const platform = c.env.PLATFORM_KEY || "fusha";
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 50);
  const offset = (page - 1) * limit;
  const { results } = await c.env.DB.prepare(
    `SELECT drr.*, p.full_name as student_name, p.email as student_email, p.phone as student_phone
     FROM device_reset_requests drr
     INNER JOIN profiles p ON drr.student_id = p.id
     WHERE drr.status = ? AND p.platform = ?
     ORDER BY drr.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(status, platform, limit, offset).all();
  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM device_reset_requests drr
     INNER JOIN profiles p ON drr.student_id = p.id
     WHERE drr.status = ? AND p.platform = ?`
  ).bind(status, platform).first() || { count: 0 };
  return c.json({ reset_requests: results, meta: { page, limit, total, has_more: offset + limit < total } });
});
admin.post("/device-resets/:id/action", requirePermission("can_reset_devices"), async (c) => {
  const requestId = c.req.param("id");
  const { action, rejection_reason } = await c.req.json();
  if (!["approved", "rejected"].includes(action)) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0625\u062C\u0631\u0627\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" } }, 400);
  }
  const user = c.get("user");
  const now = nowISO();
  const req = await c.env.DB.prepare(
    "SELECT student_id, device_id, platform, model FROM device_reset_requests WHERE id = ? AND status = 'pending'"
  ).bind(requestId).first();
  if (!req) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0637\u0644\u0628 \u0641\u0643 \u0627\u0644\u0627\u0631\u062A\u0628\u0627\u0637 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u062A\u0645 \u0645\u0639\u0627\u0644\u062C\u062A\u0647 \u0628\u0627\u0644\u0641\u0639\u0644" } }, 404);
  }
  if (action === "approved") {
    const devId = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM devices WHERE student_id = ?").bind(req.student_id),
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, 1, 0, ?, ?)`
      ).bind(devId, req.student_id, req.device_id, req.platform, req.model || `Approved (${req.platform})`, now, now),
      c.env.DB.prepare(
        `UPDATE device_reset_requests SET status = 'approved', handled_by = ?, handled_at = ?, updated_at = ? WHERE id = ?`
      ).bind(user.id, now, now, requestId)
    ]);
  } else {
    await c.env.DB.prepare(
      `UPDATE device_reset_requests SET status = 'rejected', handled_by = ?, rejection_reason = ?, handled_at = ?, updated_at = ? WHERE id = ?`
    ).bind(user.id, rejection_reason || "", now, now, requestId).run();
  }
  return c.json({ ok: true });
});
admin.get("/analytics/advanced", requireRole("admin"), async (c) => {
  const db = c.env.DB;
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results: laggingStudents } = await db.prepare(
    `SELECT p.id, p.full_name, p.email, p.phone, p.grade, p.governorate,
       (SELECT MAX(created_at) FROM lecture_playback_logs WHERE student_id = p.id) as last_view_at,
       (SELECT AVG(qa.score / NULLIF(q.max_score, 0)) * 100 FROM quiz_attempts qa INNER JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id = p.id AND qa.is_submitted = 1) as avg_quiz_grade
     FROM profiles p
     WHERE p.role = 'student' AND p.status = 'active' AND p.platform = ?
     AND (
       (SELECT COUNT(*) FROM enrollments WHERE student_id = p.id AND status = 'active') > 0
       AND (
         (
           (SELECT COUNT(*) FROM lecture_playback_logs WHERE student_id = p.id AND created_at >= datetime('now', '-7 days')) = 0
           AND (SELECT MIN(datetime(granted_at)) FROM enrollments WHERE student_id = p.id AND status = 'active') <= datetime('now', '-7 days')
         )
         OR
         ((SELECT AVG(qa.score / NULLIF(q.max_score, 0)) FROM quiz_attempts qa INNER JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id = p.id AND qa.is_submitted = 1) < 0.5)
       )
     )
     ORDER BY avg_quiz_grade ASC, last_view_at ASC
     LIMIT 50`
  ).bind(platform).all();
  const { results: videoEngagement } = await db.prepare(
    `SELECT l.id, l.title, c.title as course_title,
       COUNT(CASE WHEN COALESCE(lp.watched_seconds, 0) > 0 OR COALESCE(lp.last_position, 0) > 0 THEN 1 END) as total_viewers,
       AVG(CASE WHEN COALESCE(lp.watched_seconds, 0) > 0 OR COALESCE(lp.last_position, 0) > 0 THEN lp.watched_seconds END) as avg_watched_seconds,
       AVG(CASE WHEN COALESCE(lp.watched_seconds, 0) > 0 OR COALESCE(lp.last_position, 0) > 0
             THEN MIN(1.0, CAST(lp.watched_seconds AS REAL) / NULLIF(COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0), 0))
           END) * 100 as avg_completion_percentage
     FROM lessons l
     INNER JOIN courses c ON l.course_id = c.id
     LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id
     WHERE l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?
     GROUP BY l.id
     ORDER BY avg_completion_percentage DESC
     LIMIT 20`
  ).bind(platform).all();
  const { results: assistantKpis } = await db.prepare(
    `SELECT p.id, p.full_name, p.email,
       (SELECT COUNT(*) FROM answers WHERE author_id = p.id) as questions_answered,
       (SELECT COUNT(*) FROM device_reset_requests WHERE handled_by = p.id) as resets_handled
     FROM profiles p
     WHERE p.role = 'assistant' AND p.platform = ?
     ORDER BY questions_answered DESC`
  ).bind(platform).all();
  return c.json({
    lagging_students: laggingStudents,
    video_engagement: videoEngagement,
    assistant_kpis: assistantKpis
  });
});
admin.get("/analytics/overview", requireRole("admin"), async (c) => {
  const db = c.env.DB;
  const platform = c.env.PLATFORM_KEY || "fusha";
  const [students, courses2, enrollments, questions2, devices, revenue] = await db.batch([
    db.prepare("SELECT COUNT(*) as count FROM profiles WHERE role = 'student' AND platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM courses WHERE is_archived = 0 AND platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM enrollments WHERE status = 'active' AND platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM questions q INNER JOIN profiles p ON q.student_id = p.id WHERE q.status = 'open' AND p.platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM devices d INNER JOIN profiles p ON d.student_id = p.id WHERE p.platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM activation_codes WHERE status = 'used' AND platform = ?").bind(platform)
  ]);
  const { results: recentEnrollments } = await db.prepare(
    `SELECT DATE(e.granted_at) as date, COUNT(*) as count
     FROM enrollments e
     WHERE e.granted_at >= datetime('now', '-7 days') AND e.platform = ?
     GROUP BY DATE(e.granted_at)
     ORDER BY date DESC`
  ).bind(platform).all();
  const { results: topCourses } = await db.prepare(
    `SELECT c.title, COUNT(e.id) as count
     FROM courses c
     JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
     WHERE c.is_archived = 0 AND c.platform = ?
     GROUP BY c.id
     ORDER BY count DESC
     LIMIT 5`
  ).bind(platform).all();
  return c.json({
    total_students: students.results?.[0]?.count || 0,
    total_courses: courses2.results?.[0]?.count || 0,
    active_enrollments: enrollments.results?.[0]?.count || 0,
    open_questions: questions2.results?.[0]?.count || 0,
    total_devices: devices.results?.[0]?.count || 0,
    codes_used: revenue.results?.[0]?.count || 0,
    recent_enrollments: recentEnrollments,
    top_courses: topCourses
  });
});
admin.get("/settings", requireRole("admin"), async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM app_settings").all();
  const settings = {};
  for (const row of results) {
    settings[row.key] = row.value;
  }
  return c.json({ settings });
});
admin.patch("/settings", requireRole("admin"), audit("admin.settings.update"), async (c) => {
  const body = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const data = parsed.data;
  const statements = Object.entries(data).map(
    ([key, value]) => c.env.DB.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").bind(key, value)
  );
  if (statements.length > 0)
    await c.env.DB.batch(statements);
  return c.json({ ok: true });
});
admin.post("/notifications/send", requireRole("admin"), audit("admin.notification.send"), async (c) => {
  const body = await c.req.json();
  const sendNotificationSchema = external_exports.object({
    audience: external_exports.enum(["all", "course", "user"]),
    course_id: external_exports.string().trim().optional().nullable(),
    recipient_id: external_exports.string().trim().optional().nullable(),
    title: external_exports.string().min(1).max(200),
    body: external_exports.string().min(1).max(2e3)
  }).refine((d2) => d2.audience !== "course" || !!d2.course_id, {
    path: ["course_id"],
    message: "course_id is required for the course audience"
  }).refine((d2) => d2.audience !== "user" || !!d2.recipient_id, {
    path: ["recipient_id"],
    message: "recipient_id is required for the user audience"
  });
  const parsed = sendNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const platform = c.env.PLATFORM_KEY || "fusha";
  const courseId = d.audience === "course" ? d.course_id : null;
  const recipientId = d.audience === "user" ? d.recipient_id : null;
  if (d.audience === "course") {
    const course = await c.env.DB.prepare(
      "SELECT id FROM courses WHERE id = ? AND platform = ?"
    ).bind(courseId, platform).first();
    if (!course) {
      return c.json({ error: { code: "NOT_FOUND", message: "Course not found" } }, 404);
    }
  } else if (d.audience === "user") {
    const recipient = await c.env.DB.prepare(
      "SELECT id FROM profiles WHERE id = ? AND platform = ?"
    ).bind(recipientId, platform).first();
    if (!recipient) {
      return c.json({ error: { code: "NOT_FOUND", message: "Recipient not found" } }, 404);
    }
  }
  const notifId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO notifications (id, recipient_id, audience, course_id, type, title, body, platform, created_at, sent_at)
     VALUES (?, ?, ?, ?, 'announcement', ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(notifId, recipientId, d.audience, courseId, d.title, d.body, platform).run();
  let tokens = [];
  if (d.audience === "all") {
    const { results } = await c.env.DB.prepare(
      `SELECT s.push_token FROM push_subscriptions s
       LEFT JOIN profiles p ON s.student_id = p.id
       WHERE s.push_token IS NOT NULL AND s.platform_key = ?
         AND (s.student_id IS NULL OR p.platform = ?)
       UNION
       SELECT d.push_token FROM devices d
       INNER JOIN profiles p ON d.student_id = p.id
       WHERE d.push_token IS NOT NULL AND p.platform = ?`
    ).bind(platform, platform, platform).all();
    tokens = results.map((r) => r.push_token);
  } else if (d.audience === "course") {
    const { results } = await c.env.DB.prepare(
      `WITH eligible_students AS (
         SELECT p.id FROM profiles p
         INNER JOIN enrollments e ON e.student_id = p.id
         INNER JOIN courses c ON e.course_id = c.id
         WHERE p.platform = ? AND e.platform = ? AND c.platform = ? AND c.id = ?
           AND e.status = 'active'
           AND (e.expires_at IS NULL OR datetime(e.expires_at) > datetime('now'))
       )
       SELECT s.push_token FROM push_subscriptions s
       INNER JOIN eligible_students p ON s.student_id = p.id
       WHERE s.push_token IS NOT NULL AND s.platform_key = ?
       UNION
       SELECT d.push_token FROM devices d
       INNER JOIN eligible_students p ON d.student_id = p.id
       WHERE d.push_token IS NOT NULL`
    ).bind(platform, platform, platform, courseId, platform).all();
    tokens = results.map((r) => r.push_token);
  } else if (d.audience === "user") {
    const { results } = await c.env.DB.prepare(
      `SELECT s.push_token FROM push_subscriptions s
       INNER JOIN profiles p ON s.student_id = p.id
       WHERE s.student_id = ? AND s.push_token IS NOT NULL AND s.platform_key = ? AND p.platform = ?
       UNION
       SELECT d.push_token FROM devices d
       INNER JOIN profiles p ON d.student_id = p.id
       WHERE d.student_id = ? AND d.push_token IS NOT NULL AND p.platform = ?`
    ).bind(recipientId, platform, platform, recipientId, platform).all();
    tokens = results.map((r) => r.push_token);
  }
  tokens = tokens.filter((token) => token.trim().length > 0);
  if (tokens.length > 0) {
    c.executionCtx.waitUntil(
      sendNotificationDirectly(c.env, {
        type: "multicast",
        tokens,
        title: d.title,
        body: d.body,
        notificationId: notifId
      })
    );
  }
  return c.json({ ok: true, notification_id: notifId, tokens_count: tokens.length });
});
admin.get("/lessons/:lessonId/quizzes", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("lessonId");
  const { results } = await c.env.DB.prepare("SELECT * FROM quizzes WHERE lesson_id = ?").bind(lessonId).all();
  return c.json({ quizzes: results });
});
admin.post("/lessons/:lessonId/quizzes", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("lessonId");
  const body = await c.req.json();
  const quizSchema = external_exports.object({
    title: external_exports.string().min(1),
    max_score: external_exports.coerce.number().int().positive().default(100),
    is_published: external_exports.preprocess((val) => val === true || val === "true" || val === 1 || val === "1", external_exports.boolean()).default(false),
    randomize_questions: external_exports.preprocess((val) => val === true || val === "true" || val === 1 || val === "1", external_exports.boolean()).default(false),
    start_time: external_exports.string().nullable().optional(),
    end_time: external_exports.string().nullable().optional(),
    time_limit_mins: external_exports.preprocess((val) => val === "" || val === null || val === void 0 ? null : Number(val), external_exports.number().int().positive().nullable()).optional()
  });
  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const lesson = await c.env.DB.prepare("SELECT course_id FROM lessons WHERE id = ?").bind(lessonId).first();
  if (!lesson) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const courseId = lesson.course_id;
  const existing = await c.env.DB.prepare("SELECT id FROM quizzes WHERE lesson_id = ?").bind(lessonId).first();
  let quizId = existing ? existing.id : null;
  if (quizId) {
    await c.env.DB.prepare(
      `UPDATE quizzes 
       SET title = ?, max_score = ?, is_published = ?, randomize_questions = ?, start_time = ?, end_time = ?, time_limit_mins = ?, updated_at = datetime('now') 
       WHERE id = ?`
    ).bind(
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null,
      quizId
    ).run();
  } else {
    quizId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published, randomize_questions, start_time, end_time, time_limit_mins, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).bind(
      quizId,
      courseId,
      lessonId,
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null
    ).run();
  }
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(quizId).first();
  return c.json({ quiz });
});
admin.get("/quizzes/:id", requirePermission("can_manage_courses"), async (c) => {
  const quizId = c.req.param("id");
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(quizId).first();
  if (!quiz) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results: questions2 } = await c.env.DB.prepare(
    "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC"
  ).bind(quizId).all();
  const parsedQuestions = questions2.map((q) => ({
    ...q,
    options: JSON.parse(q.options_json)
  }));
  return c.json({ quiz, questions: parsedQuestions });
});
admin.delete("/quizzes/:id", requirePermission("can_manage_courses"), async (c) => {
  const quizId = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM quizzes WHERE id = ?").bind(quizId).run();
  return c.json({ ok: true });
});
admin.post("/quizzes/:id/questions", requirePermission("can_manage_courses"), async (c) => {
  const quizId = c.req.param("id");
  const body = await c.req.json();
  const questionSchema = external_exports.object({
    question_text: external_exports.string().optional().nullable(),
    image_url: external_exports.string().max(1e3).optional().nullable(),
    options: external_exports.array(external_exports.string().min(1)).min(2),
    correct_option: external_exports.string().min(1),
    explanation: external_exports.string().max(4e3).optional().nullable(),
    score: external_exports.number().int().positive().default(1),
    sort_order: external_exports.number().int().default(0)
  });
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO quiz_questions (id, quiz_id, question_text, image_url, options_json, correct_option, explanation, score, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    quizId,
    d.question_text || null,
    d.image_url || null,
    JSON.stringify(d.options),
    d.correct_option,
    d.explanation || null,
    d.score,
    d.sort_order
  ).run();
  const question = await c.env.DB.prepare("SELECT * FROM quiz_questions WHERE id = ?").bind(id).first();
  return c.json({
    question: {
      ...question,
      options: JSON.parse(question.options_json)
    }
  }, 201);
});
admin.patch("/quizzes/questions/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const questionSchema = external_exports.object({
    question_text: external_exports.string().optional().nullable(),
    image_url: external_exports.string().max(1e3).optional().nullable(),
    options: external_exports.array(external_exports.string().min(1)).min(2).optional(),
    correct_option: external_exports.string().min(1).optional(),
    explanation: external_exports.string().max(4e3).optional().nullable(),
    score: external_exports.number().int().positive().optional(),
    sort_order: external_exports.number().int().optional()
  });
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const question = await c.env.DB.prepare("SELECT * FROM quiz_questions WHERE id = ?").bind(id).first();
  if (!question) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const qText = d.question_text !== void 0 ? d.question_text : question.question_text;
  const imgUrl = d.image_url !== void 0 ? d.image_url : question.image_url;
  const optJson = d.options !== void 0 ? JSON.stringify(d.options) : question.options_json;
  const corrOpt = d.correct_option !== void 0 ? d.correct_option : question.correct_option;
  const explVal = d.explanation !== void 0 ? d.explanation : question.explanation;
  const scoreVal = d.score !== void 0 ? d.score : question.score;
  const sortVal = d.sort_order !== void 0 ? d.sort_order : question.sort_order;
  await c.env.DB.prepare(
    `UPDATE quiz_questions 
     SET question_text = ?, image_url = ?, options_json = ?, correct_option = ?, explanation = ?, score = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(qText, imgUrl, optJson, corrOpt, explVal, scoreVal, sortVal, id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM quiz_questions WHERE id = ?").bind(id).first();
  return c.json({
    question: {
      ...updated,
      options: JSON.parse(updated.options_json)
    }
  });
});
admin.delete("/quizzes/questions/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM quiz_questions WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
admin.post("/quizzes/question-image-url", requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json();
  if (!body.filename) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" } }, 400);
  }
  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `questions/${id}_${cleanFilename}`;
  const contentType = body.mime_type || "image/jpeg";
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    contentType,
    3600
    // 1 hour expiration
  );
  const origin = new URL(c.req.url).origin;
  const publicUrl = `${origin}/files/questions/${id}_${cleanFilename}`;
  return c.json({
    upload_url: uploadUrl,
    public_url: publicUrl,
    r2_key: r2Key
  });
});
admin.get("/exams", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const courseId = c.req.query("course_id");
  let query = `
    SELECT q.*, c.title as course_title 
    FROM quizzes q 
    INNER JOIN courses c ON q.course_id = c.id 
    WHERE q.lesson_id IS NULL AND c.platform = ?
  `;
  const params = [platform];
  if (courseId) {
    query += " AND q.course_id = ?";
    params.push(courseId);
  }
  query += " ORDER BY q.created_at DESC";
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ exams: results });
});
admin.post("/exams", requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json();
  const examSchema = external_exports.object({
    id: external_exports.string().optional(),
    course_id: external_exports.string().min(1),
    title: external_exports.string().min(1),
    max_score: external_exports.coerce.number().int().positive().default(100),
    is_published: external_exports.preprocess((val) => val === true || val === "true" || val === 1 || val === "1", external_exports.boolean()).default(false),
    randomize_questions: external_exports.preprocess((val) => val === true || val === "true" || val === 1 || val === "1", external_exports.boolean()).default(false),
    is_free: external_exports.preprocess((val) => val === true || val === "true" || val === 1 || val === "1", external_exports.boolean()).default(false),
    cover_image: external_exports.string().nullable().optional(),
    start_time: external_exports.string().nullable().optional(),
    end_time: external_exports.string().nullable().optional(),
    time_limit_mins: external_exports.preprocess((val) => val === "" || val === null || val === void 0 ? null : Number(val), external_exports.number().int().positive().nullable()).optional()
  });
  const parsed = examSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  let examId = d.id;
  if (examId) {
    await c.env.DB.prepare(
      `UPDATE quizzes 
       SET course_id = ?, title = ?, max_score = ?, is_published = ?, randomize_questions = ?, is_free = ?, cover_image = ?, start_time = ?, end_time = ?, time_limit_mins = ?, updated_at = datetime('now') 
       WHERE id = ? AND lesson_id IS NULL`
    ).bind(
      d.course_id,
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.is_free ? 1 : 0,
      d.cover_image || null,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null,
      examId
    ).run();
  } else {
    examId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published, randomize_questions, is_free, cover_image, start_time, end_time, time_limit_mins, sort_order, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).bind(
      examId,
      d.course_id,
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.is_free ? 1 : 0,
      d.cover_image || null,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null
    ).run();
  }
  const exam = await c.env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(examId).first();
  return c.json({ exam });
});
admin.get("/exams/grades", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results: exams } = await c.env.DB.prepare(
    `SELECT q.id, q.title, q.max_score, c.title as course_title 
     FROM quizzes q 
     INNER JOIN courses c ON q.course_id = c.id
     WHERE q.lesson_id IS NULL AND c.platform = ?
     ORDER BY q.created_at ASC`
  ).bind(platform).all();
  const { results: students } = await c.env.DB.prepare(
    `SELECT id, full_name, phone 
     FROM profiles 
     WHERE role = 'student' AND platform = ?
     ORDER BY full_name ASC`
  ).bind(platform).all();
  const { results: attempts } = await c.env.DB.prepare(
    `SELECT qa.student_id, qa.quiz_id, qa.score 
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON qa.quiz_id = q.id
     WHERE q.lesson_id IS NULL AND qa.is_submitted = 1`
  ).all();
  const attemptMap = /* @__PURE__ */ new Map();
  attempts.forEach((att) => {
    attemptMap.set(`${att.student_id}_${att.quiz_id}`, att.score);
  });
  const studentGrades = students.map((s) => {
    const grades = {};
    let totalScore = 0;
    exams.forEach((exam) => {
      const score = attemptMap.get(`${s.id}_${exam.id}`);
      grades[exam.id] = score !== void 0 ? score : null;
      if (score !== void 0) {
        totalScore += score;
      }
    });
    return {
      student_id: s.id,
      student_name: s.full_name,
      student_phone: s.phone,
      grades,
      total_score: totalScore
    };
  });
  return c.json({ exams, students: studentGrades });
});
var admin_default = admin;

// src/routes/bunny.ts
var bunny = new Hono2();
bunny.use("/*", requireAuth);
async function calculateSignature(libraryId, apiKey, expirationTime, videoId) {
  const data = new TextEncoder().encode(libraryId + apiKey + expirationTime + videoId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(calculateSignature, "calculateSignature");
async function ensureLibraryResolutionsConfigured(env, libraryId, apiKey) {
  const kvFlag = "bunny_library_resolutions_configured";
  try {
    if (env.KV) {
      const alreadyConfigured = await env.KV.get(kvFlag);
      if (alreadyConfigured)
        return;
    }
    const resp = await fetch(`https://video.bunnycdn.com/library/${libraryId}`, {
      method: "POST",
      headers: {
        "AccessKey": apiKey,
        "Content-Type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({ EnabledResolutions: "480p,720p,1080p" })
    });
    if (resp.ok) {
      if (env.KV) {
        await env.KV.put(kvFlag, "1");
      }
    } else {
      const errorText = await resp.text().catch(() => "");
      console.warn(`[Bunny Route] Failed to configure library resolutions (HTTP ${resp.status}): ${errorText}`);
    }
  } catch (err) {
    console.warn("[Bunny Route] Error configuring library resolutions:", err);
  }
}
__name(ensureLibraryResolutionsConfigured, "ensureLibraryResolutionsConfigured");
async function clearVideoTransferKV(env, videoId) {
  if (!env.KV)
    return;
  await env.KV.delete(`video_transfer:${videoId}:qualities`);
  await env.KV.delete(`video_transfer:${videoId}:total`);
  await env.KV.delete(`video_transfer:${videoId}:progress`);
  await env.KV.delete(`video_transfer:${videoId}:expected_qualities`);
  const standardQualities = ["240p", "360p", "480p", "720p", "1080p", "audio"];
  for (const q of standardQualities) {
    await env.KV.delete(`video_transfer:${videoId}:${q}:segments_total`);
    await env.KV.delete(`video_transfer:${videoId}:${q}:segments_transferred`);
  }
}
__name(clearVideoTransferKV, "clearVideoTransferKV");
bunny.post("/lessons/:id/videos/bunny-upload", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  const schema = external_exports.object({
    title: external_exports.string().min(1).max(500)
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const libraryId = c.env.BUNNY_LIBRARY_ID;
  const apiKey = c.env.BUNNY_API_KEY;
  if (!libraryId) {
    return c.json({ error: { code: "CONFIG_ERROR", message: "Bunny Library ID is not configured on server" } }, 500);
  }
  if (!apiKey) {
    return c.json({ error: { code: "CONFIG_ERROR", message: "Bunny API Key is not configured on server" } }, 500);
  }
  await ensureLibraryResolutionsConfigured(c.env, libraryId, apiKey);
  const createUrl = `https://video.bunnycdn.com/library/${libraryId}/videos`;
  const bunnyResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      "AccessKey": apiKey,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({ title: parsed.data.title })
  });
  if (!bunnyResponse.ok) {
    const errorText = await bunnyResponse.text();
    console.error("Failed to create video in Bunny Stream:", errorText);
    return c.json({ error: { code: "BUNNY_ERROR", message: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0641\u064A \u062E\u0627\u062F\u0645 \u0627\u0644\u062A\u0631\u0645\u064A\u0632" } }, 500);
  }
  const bunnyData = await bunnyResponse.json();
  const bunnyGuid = bunnyData.guid;
  const videoId = generateId();
  const streamUid = `lessons/${lessonId}/videos/${videoId}/hls`;
  const keyBytes = crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyHex = Array.from(keyBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const ivHex = Array.from(ivBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (c.env.KV) {
    await c.env.KV.put(`video_aes_key:${videoId}`, keyHex);
    await c.env.KV.put(`video_aes_iv:${videoId}`, ivHex);
  }
  const expirationTime = Math.floor(Date.now() / 1e3) + 86400;
  const signature = await calculateSignature(libraryId, apiKey, expirationTime, bunnyGuid);
  const oldVideo = await c.env.DB.prepare(
    "SELECT id FROM lesson_videos WHERE lesson_id = ? LIMIT 1"
  ).bind(lessonId).first();
  if (oldVideo) {
    await clearVideoTransferKV(c.env, oldVideo.id);
    await c.env.DB.prepare("DELETE FROM lesson_videos WHERE id = ?").bind(oldVideo.id).run();
  }
  await c.env.DB.prepare(
    `INSERT INTO lesson_videos (id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order, created_at, updated_at)
     VALUES (?, ?, 'r2_hls', ?, null, null, null, 'uploading', 0, 0, datetime('now'), datetime('now'))`
  ).bind(videoId, lessonId, streamUid).run();
  const uploadUrl = `https://video.bunnycdn.com/tusupload?VideoId=${bunnyGuid}&LibraryId=${libraryId}&Signature=${signature}&ExpirationTime=${expirationTime}`;
  return c.json({
    video_id: videoId,
    bunny_guid: bunnyGuid,
    library_id: libraryId,
    upload_url: uploadUrl,
    expiration_time: expirationTime,
    signature
  }, 201);
});
bunny.post("/lessons/:id/videos/bunny-upload-complete", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  const schema = external_exports.object({
    video_id: external_exports.string().min(1),
    bunny_guid: external_exports.string().min(1)
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  c.executionCtx.waitUntil((async () => {
    try {
      await c.env.DB.prepare(
        "UPDATE lesson_videos SET status = 'processing', updated_at = datetime('now') WHERE id = ?"
      ).bind(d.video_id).run();
      await c.env.VIDEO_QUEUE.send({
        type: "check_encoding",
        lessonId,
        videoId: d.video_id,
        bunnyGuid: d.bunny_guid,
        attempt: 1
      });
      console.log(`[Bunny Route] Queued check_encoding for video ${d.video_id}`);
    } catch (err) {
      console.error("[Bunny Route] Error in bunny-upload-complete waitUntil task:", err);
    }
  })());
  return c.json({ ok: true });
});
bunny.get("/lessons/:id/videos/transfer-status", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const video = await c.env.DB.prepare(
    `SELECT id, provider, status, stream_uid, duration_seconds 
     FROM lesson_videos 
     WHERE lesson_id = ? 
     LIMIT 1`
  ).bind(lessonId).first();
  if (!video) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0641\u064A\u062F\u064A\u0648 \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 404);
  }
  const kvKey = `video_transfer:${video.id}:qualities`;
  const qualitiesStr = await c.env.KV.get(kvKey);
  const qualities = qualitiesStr ? JSON.parse(qualitiesStr) : [];
  const totalStr = await c.env.KV.get(`video_transfer:${video.id}:total`);
  const totalQualities = totalStr ? parseInt(totalStr, 10) : null;
  const progressKey = `video_transfer:${video.id}:progress`;
  const progressStr = await c.env.KV.get(progressKey);
  const transcodingProgress = progressStr ? parseInt(progressStr, 10) : null;
  const expectedQualitiesStr = await c.env.KV.get(`video_transfer:${video.id}:expected_qualities`);
  let totalSegments = 0;
  let transferredSegments = 0;
  let transferProgress = null;
  if (expectedQualitiesStr) {
    try {
      const expectedQualities = JSON.parse(expectedQualitiesStr);
      for (const q of expectedQualities) {
        const qTotal = await c.env.KV.get(`video_transfer:${video.id}:${q}:segments_total`);
        const qTransferred = await c.env.KV.get(`video_transfer:${video.id}:${q}:segments_transferred`);
        if (qTotal) {
          totalSegments += parseInt(qTotal, 10);
          transferredSegments += qTransferred ? parseInt(qTransferred, 10) : 0;
        }
      }
      if (totalSegments > 0) {
        transferProgress = Math.round(transferredSegments / totalSegments * 100);
      }
    } catch (e) {
      console.error("Error computing segment progress:", e);
    }
  }
  return c.json({
    video_id: video.id,
    provider: video.provider,
    status: video.status,
    // uploading, processing, ready, error
    stream_uid: video.stream_uid,
    duration_seconds: video.duration_seconds,
    completed_qualities: qualities,
    total_qualities: totalQualities,
    transcoding_progress: transcodingProgress,
    transfer_progress: transferProgress
  });
});
bunny.post("/lessons/:id/videos/transfer-retry", requirePermission("can_manage_courses"), async (c) => {
  const lessonId = c.req.param("id");
  const body = await c.req.json();
  const schema = external_exports.object({
    bunny_guid: external_exports.string().min(1)
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u0639\u0631\u0641 \u0641\u064A\u062F\u064A\u0648 Bunny Stream \u0645\u0637\u0644\u0648\u0628", details: parsed.error.flatten() } }, 400);
  }
  const bunnyGuid = parsed.data.bunny_guid;
  const video = await c.env.DB.prepare(
    "SELECT id, provider, status FROM lesson_videos WHERE lesson_id = ? LIMIT 1"
  ).bind(lessonId).first();
  if (!video) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0641\u064A\u062F\u064A\u0648 \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633" } }, 404);
  }
  if (video.provider !== "r2_hls") {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0647\u0630\u0627 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0644\u0627 \u064A\u062F\u0639\u0645 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u0634\u0641\u0631 \u0644\u0640 R2 HLS" } }, 400);
  }
  await clearVideoTransferKV(c.env, video.id);
  await c.env.VIDEO_QUEUE.send({
    type: "check_encoding",
    lessonId,
    videoId: video.id,
    bunnyGuid,
    attempt: 1
  });
  await c.env.DB.prepare(
    "UPDATE lesson_videos SET status = 'processing', updated_at = datetime('now') WHERE id = ?"
  ).bind(video.id).run();
  console.log(`[Bunny Route] Queued check_encoding for video retry: ${video.id}`);
  return c.json({ ok: true, message: "\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062C\u062F\u0648\u0644\u0629 \u0639\u0645\u0644\u064A\u0629 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0628\u0646\u062C\u0627\u062D." });
});
var bunny_default = bunny;

// src/routes/push.ts
var push = new Hono2();
var subscribeSchema = external_exports.object({
  device_id: external_exports.string().min(1).max(200),
  platform: external_exports.enum(["android", "ios", "web"]),
  push_token: external_exports.string().min(10).max(500)
});
push.post("/subscribe", optionalAuth, rateLimit("push_subscribe", 30, 60), async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const d = parsed.data;
  const user = c.get("user");
  const platformKey = c.env.PLATFORM_KEY || "fusha";
  const now = nowISO();
  const result = await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, device_id, platform, push_token, student_id, platform_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id, platform_key) DO UPDATE SET
       push_token = excluded.push_token,
       platform   = CASE
         WHEN excluded.student_id IS NOT NULL OR push_subscriptions.student_id IS NULL
         THEN excluded.platform ELSE push_subscriptions.platform END,
       student_id = COALESCE(excluded.student_id, push_subscriptions.student_id),
       updated_at = excluded.updated_at
     WHERE excluded.student_id IS NOT NULL
        OR push_subscriptions.student_id IS NULL
        OR push_subscriptions.push_token = excluded.push_token`
  ).bind(generateId(), d.device_id, d.platform, d.push_token, user?.id ?? null, platformKey, now, now).run();
  if (result.meta.changes === 0) {
    return c.json({ error: { code: "PUSH_OWNERSHIP_REQUIRED", message: "Sign in to update this subscription." } }, 403);
  }
  return c.json({ ok: true });
});
push.post("/unsubscribe", optionalAuth, rateLimit("push_unsubscribe", 30, 60), async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const schema = external_exports.object({ device_id: external_exports.string().min(1).max(200) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const platformKey = c.env.PLATFORM_KEY || "fusha";
  const user = c.get("user");
  const result = await c.env.DB.prepare(
    `DELETE FROM push_subscriptions WHERE device_id = ? AND platform_key = ?
       AND (student_id IS NULL OR student_id = ?)`
  ).bind(parsed.data.device_id, platformKey, user?.id ?? null).run();
  if (result.meta.changes === 0) {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM push_subscriptions WHERE device_id = ? AND platform_key = ?"
    ).bind(parsed.data.device_id, platformKey).first();
    if (existing) {
      return c.json({ error: { code: "PUSH_OWNERSHIP_REQUIRED", message: "Only the signed-in owner can remove this subscription." } }, 403);
    }
  }
  return c.json({ ok: true });
});
var push_default = push;

// src/routes/dictionary.ts
var dictionary = new Hono2();
var TASHKEEL = /[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g;
var INVISIBLE = /[\u200E\u200F\u061C\uFEFF]/g;
function normalizeArabic(input, stripArticle = true) {
  if (!input)
    return "";
  let s = String(input).normalize("NFKC");
  s = s.replace(TASHKEEL, "");
  s = s.replace(INVISIBLE, "");
  s = s.replace(/[\u0622\u0623\u0625\u0671\u0670]/g, "\u0627");
  s = s.replace(/ى/g, "\u064A");
  s = s.replace(/ة/g, "\u0647");
  s = s.replace(/ؤ/g, "\u0648");
  s = s.replace(/ئ/g, "\u064A");
  s = s.replace(/\s+/g, " ").trim();
  if (stripArticle && s.startsWith("\u0627\u0644") && s.length > 3) {
    s = s.slice(2);
  }
  return s;
}
__name(normalizeArabic, "normalizeArabic");
function likeEscape(value) {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}
__name(likeEscape, "likeEscape");
function levenshtein(a, b) {
  if (a === b)
    return 0;
  if (!a.length)
    return b.length;
  if (!b.length)
    return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++)
    prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}
__name(levenshtein, "levenshtein");
function shape(row) {
  if (!row)
    return row;
  const parse2 = /* @__PURE__ */ __name((v) => {
    if (!v)
      return [];
    if (Array.isArray(v))
      return v;
    try {
      const parsed = JSON.parse(String(v));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, "parse");
  return {
    ...row,
    synonyms: parse2(row.synonyms_json),
    antonyms: parse2(row.antonyms_json),
    tags: parse2(row.tags_json)
  };
}
__name(shape, "shape");
var entrySchema = external_exports.object({
  word: external_exports.string().min(1).max(120),
  root: external_exports.string().max(20).optional(),
  type: external_exports.enum(["\u0627\u0633\u0645", "\u0641\u0639\u0644", "\u062D\u0631\u0641", "\u0635\u0641\u0629", "\u0645\u0635\u062F\u0631"]).optional(),
  meaning: external_exports.string().min(1).max(2e3),
  plural: external_exports.string().max(200).optional(),
  singular: external_exports.string().max(200).optional(),
  synonyms: external_exports.array(external_exports.string().max(120)).max(20).optional(),
  antonyms: external_exports.array(external_exports.string().max(120)).max(20).optional(),
  context: external_exports.string().max(1e3).optional(),
  exam_context: external_exports.string().max(200).optional(),
  lesson_id: external_exports.string().max(120).optional(),
  unit: external_exports.string().max(200).optional(),
  audio_url: external_exports.string().max(500).optional(),
  difficulty: external_exports.number().int().min(1).max(3).optional(),
  tags: external_exports.array(external_exports.string().max(60)).max(20).optional()
});
dictionary.get("/suggest", rateLimit("dictionary_suggest", 120, 60), async (c) => {
  const raw2 = (c.req.query("q") || "").trim();
  const limit = Math.min(parseInt(c.req.query("limit") || "8"), 20);
  const platform = c.env.PLATFORM_KEY || "fusha";
  if (raw2.length < 1)
    return c.json({ suggestions: [] });
  const q = normalizeArabic(raw2);
  if (!q)
    return c.json({ suggestions: [] });
  const { results } = await c.env.DB.prepare(
    `SELECT id, word, word_normalized, type, meaning
     FROM dictionary_entries
     WHERE platform = ? AND word_normalized LIKE ?
     ORDER BY search_count DESC, word ASC
     LIMIT ?`
  ).bind(platform, `${likeEscape(q)}%`, limit).all();
  return c.json({ suggestions: (results || []).map(shape) });
});
dictionary.get("/popular", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "12"), 50);
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM dictionary_entries
     WHERE platform = ? AND search_count > 0
     ORDER BY search_count DESC, word ASC
     LIMIT ?`
  ).bind(platform, limit).all();
  return c.json({ entries: (results || []).map(shape) });
});
dictionary.post("/import", requireAuth, requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = external_exports.object({ entries: external_exports.array(entrySchema).min(1).max(500) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const platform = c.env.PLATFORM_KEY || "fusha";
  const now = nowISO();
  const statements = parsed.data.entries.map((e) => {
    const normalized = normalizeArabic(e.word);
    const id = generateId();
    return c.env.DB.prepare(
      `INSERT INTO dictionary_entries
         (id, platform, word, word_normalized, root, type, meaning, plural, singular,
          synonyms_json, antonyms_json, context, exam_context, lesson_id, unit, audio_url,
          difficulty, tags_json, search_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(platform, word_normalized) DO UPDATE SET
         word = excluded.word,
         word_normalized = excluded.word_normalized,
         root = excluded.root,
         type = excluded.type,
         meaning = excluded.meaning,
         plural = excluded.plural,
         singular = excluded.singular,
         synonyms_json = excluded.synonyms_json,
         antonyms_json = excluded.antonyms_json,
         context = excluded.context,
         exam_context = excluded.exam_context,
         lesson_id = excluded.lesson_id,
         unit = excluded.unit,
         audio_url = excluded.audio_url,
         difficulty = excluded.difficulty,
         tags_json = excluded.tags_json,
         updated_at = excluded.updated_at`
    ).bind(
      id,
      platform,
      e.word,
      normalized,
      e.root || null,
      e.type || null,
      e.meaning,
      e.plural || null,
      e.singular || null,
      e.synonyms ? JSON.stringify(e.synonyms) : null,
      e.antonyms ? JSON.stringify(e.antonyms) : null,
      e.context || null,
      e.exam_context || null,
      e.lesson_id || null,
      e.unit || null,
      e.audio_url || null,
      e.difficulty || 2,
      e.tags ? JSON.stringify(e.tags) : null,
      now,
      now
    );
  });
  await c.env.DB.batch(statements);
  return c.json({ imported: statements.length });
});
dictionary.get("/word/:word", async (c) => {
  const raw2 = c.req.param("word") || "";
  const q = normalizeArabic(decodeURIComponent(raw2));
  const platform = c.env.PLATFORM_KEY || "fusha";
  if (!q) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT * FROM dictionary_entries WHERE platform = ? AND word_normalized = ? LIMIT 1"
  ).bind(platform, q).first();
  if (!row) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0644\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0639\u062C\u0645" } }, 404);
  }
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE dictionary_entries SET search_count = search_count + 1 WHERE id = ?").bind(row.id).run()
  );
  return c.json({ entry: shape(row) });
});
dictionary.get("/", rateLimit("dictionary_search", 90, 60), async (c) => {
  const raw2 = (c.req.query("q") || "").trim();
  const page = Math.max(parseInt(c.req.query("page") || "1"), 1);
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const type = c.req.query("type");
  const tag = c.req.query("tag");
  const platform = c.env.PLATFORM_KEY || "fusha";
  if (!raw2) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0644\u0644\u0628\u062D\u062B" } }, 400);
  }
  const q = normalizeArabic(raw2);
  if (!q) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0644\u0644\u0628\u062D\u062B" } }, 400);
  }
  const escaped = likeEscape(q);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;
  const bareRoot = q.replace(/\s+/g, "");
  const conditions = [
    `word_normalized LIKE ? ESCAPE '\\'`,
    `REPLACE(IFNULL(root, ''), ' ', '') LIKE ? ESCAPE '\\'`,
    `IFNULL(meaning, '') LIKE ? ESCAPE '\\'`
  ];
  const params = [contains, `%${likeEscape(bareRoot)}%`, contains];
  let extra = "";
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (tag) {
    conditions.push(`IFNULL(tags_json, '') LIKE ? ESCAPE '\\'`);
    params.push(`%${likeEscape(tag)}%`);
  }
  const where = `platform = ? AND (${conditions.join(" OR ")})`;
  const { results } = await c.env.DB.prepare(
    `SELECT *,
       CASE
         WHEN word_normalized = ? THEN 0
         WHEN word_normalized LIKE ? ESCAPE '\\' THEN 1
         ELSE 2
       END AS rank
     FROM dictionary_entries
     WHERE ${where}
     ORDER BY rank ASC, search_count DESC, word ASC
     LIMIT ? OFFSET ?`
  ).bind(q, prefix, platform, ...params, limit, offset).all();
  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM dictionary_entries WHERE ${where}`
  ).bind(platform, ...params).first();
  let suggestions = [];
  if (!results || results.length === 0) {
    const { results: pool } = await c.env.DB.prepare(
      "SELECT id, word, word_normalized FROM dictionary_entries WHERE platform = ? LIMIT 300"
    ).bind(platform).all();
    const maxDistance = q.length >= 4 ? 2 : 1;
    suggestions = (pool || []).map((r) => ({ row: r, distance: levenshtein(q, r.word_normalized || "") })).filter((x) => x.distance > 0 && x.distance <= maxDistance).sort((a, b) => a.distance - b.distance).slice(0, 5).map((x) => ({ word: x.row.word, word_normalized: x.row.word_normalized }));
  }
  return c.json({
    entries: (results || []).map(shape),
    suggestions,
    query: raw2,
    normalized: q,
    total: totalRow?.total || 0,
    page,
    limit
  });
});
dictionary.post("/", requireAuth, requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0643\u0644\u0645\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  const now = nowISO();
  const platform = c.env.PLATFORM_KEY || "fusha";
  const normalized = normalizeArabic(d.word);
  const duplicate = await c.env.DB.prepare(
    "SELECT id FROM dictionary_entries WHERE platform = ? AND word_normalized = ?"
  ).bind(platform, normalized).first();
  if (duplicate) {
    return c.json({ error: { code: "DUPLICATE_ENTRY", message: "\u0647\u0630\u0647 \u0627\u0644\u0643\u0644\u0645\u0629 \u0645\u0648\u062C\u0648\u062F\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0645\u0639\u062C\u0645" } }, 409);
  }
  await c.env.DB.prepare(
    `INSERT INTO dictionary_entries
       (id, platform, word, word_normalized, root, type, meaning, plural, singular,
        synonyms_json, antonyms_json, context, exam_context, lesson_id, unit, audio_url,
        difficulty, tags_json, search_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    id,
    platform,
    d.word,
    normalized,
    d.root || null,
    d.type || null,
    d.meaning,
    d.plural || null,
    d.singular || null,
    d.synonyms ? JSON.stringify(d.synonyms) : null,
    d.antonyms ? JSON.stringify(d.antonyms) : null,
    d.context || null,
    d.exam_context || null,
    d.lesson_id || null,
    d.unit || null,
    d.audio_url || null,
    d.difficulty || 2,
    d.tags ? JSON.stringify(d.tags) : null,
    now,
    now
  ).run();
  return c.json(await c.env.DB.prepare("SELECT * FROM dictionary_entries WHERE id = ?").bind(id).first().then(shape), 201);
});
dictionary.get("/:id", async (c) => {
  const id = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const row = await c.env.DB.prepare(
    "SELECT * FROM dictionary_entries WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!row) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0644\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0639\u062C\u0645" } }, 404);
  }
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE dictionary_entries SET search_count = search_count + 1, updated_at = ? WHERE id = ?").bind(nowISO(), id).run()
  );
  return c.json({ entry: shape(row) });
});
dictionary.patch("/:id", requireAuth, requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const body = await c.req.json().catch(() => null);
  const parsed = entrySchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const existing = await c.env.DB.prepare(
    "SELECT id FROM dictionary_entries WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0644\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0639\u062C\u0645" } }, 404);
  }
  const d = parsed.data;
  const sets = [];
  const params = [];
  if (d.word !== void 0) {
    sets.push("word = ?", "word_normalized = ?");
    params.push(d.word, normalizeArabic(d.word));
  }
  const direct = [
    ["root", "root"],
    ["type", "type"],
    ["meaning", "meaning"],
    ["plural", "plural"],
    ["singular", "singular"],
    ["context", "context"],
    ["exam_context", "exam_context"],
    ["lesson_id", "lesson_id"],
    ["unit", "unit"],
    ["audio_url", "audio_url"],
    ["difficulty", "difficulty"]
  ];
  for (const [key, column] of direct) {
    if (d[key] !== void 0) {
      sets.push(`${column} = ?`);
      params.push(d[key]);
    }
  }
  if (d.synonyms !== void 0) {
    sets.push("synonyms_json = ?");
    params.push(JSON.stringify(d.synonyms));
  }
  if (d.antonyms !== void 0) {
    sets.push("antonyms_json = ?");
    params.push(JSON.stringify(d.antonyms));
  }
  if (d.tags !== void 0) {
    sets.push("tags_json = ?");
    params.push(JSON.stringify(d.tags));
  }
  if (sets.length === 0) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0644\u062A\u0639\u062F\u064A\u0644" } }, 400);
  }
  sets.push("updated_at = ?");
  params.push(nowISO(), id, platform);
  await c.env.DB.prepare(
    `UPDATE dictionary_entries SET ${sets.join(", ")} WHERE id = ? AND platform = ?`
  ).bind(...params).run();
  return c.json(await c.env.DB.prepare("SELECT * FROM dictionary_entries WHERE id = ?").bind(id).first().then(shape));
});
dictionary.delete("/:id", requireAuth, requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const res = await c.env.DB.prepare(
    "DELETE FROM dictionary_entries WHERE id = ? AND platform = ?"
  ).bind(id, platform).run();
  const changes = res?.meta?.changes ?? 1;
  if (changes === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0643\u0644\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0639\u062C\u0645" } }, 404);
  }
  return c.json({ success: true });
});
var dictionary_default = dictionary;

// src/routes/questionBank.ts
var questionBank = new Hono2();
var PUBLIC_PREFIX = "/question-bank/public";
var PUBLIC_COLUMNS = `q.id, q.course_id, q.unit_id, q.lesson_id, q.type, q.difficulty,
  q.bloom_level, q.question_text, q.image_url, q.options_json, q.points,
  q.tags_json, q.source, q.created_at`;
var QUESTION_TYPES = [
  "mcq",
  "true_false",
  "short_answer",
  "essay",
  "matching",
  "fill_blank",
  "ordering",
  "poetry_analysis"
];
var DIFFICULTIES = ["easy", "medium", "hard"];
var BLOOM_LEVELS = [
  "\u062A\u0630\u0643\u0631",
  "\u0641\u0647\u0645",
  "\u062A\u0637\u0628\u064A\u0642",
  "\u062A\u062D\u0644\u064A\u0644",
  "\u062A\u0642\u0648\u064A\u0645",
  "\u0625\u0628\u062F\u0627\u0639"
];
var SORTABLE_COLUMNS = {
  created_at: "q.created_at",
  updated_at: "q.updated_at",
  usage_count: "q.usage_count",
  points: "q.points",
  difficulty: "q.difficulty",
  type: "q.type"
};
var SORT_ORDERS = { asc: "ASC", desc: "DESC" };
var MAX_LIMIT = 50;
var optionSchema = external_exports.string().min(1).max(1e3);
var questionInputSchema = external_exports.object({
  type: external_exports.enum(QUESTION_TYPES).default("mcq"),
  difficulty: external_exports.enum(DIFFICULTIES).default("medium"),
  bloom_level: external_exports.enum(BLOOM_LEVELS).nullable().optional(),
  course_id: external_exports.string().max(200).nullable().optional(),
  unit_id: external_exports.string().max(200).nullable().optional(),
  lesson_id: external_exports.string().max(200).nullable().optional(),
  question_text: external_exports.string().min(1, "\u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 \u0645\u0637\u0644\u0648\u0628").max(8e3),
  image_url: external_exports.string().max(1e3).nullable().optional(),
  options: external_exports.array(optionSchema).max(20).nullable().optional(),
  correct_answer: external_exports.unknown().optional(),
  explanation: external_exports.string().max(8e3).nullable().optional(),
  points: external_exports.coerce.number().int().min(1).max(100).default(1),
  tags: external_exports.array(external_exports.string().min(1).max(100)).max(20).default([]),
  source: external_exports.string().max(300).nullable().optional()
});
var questionUpdateSchema = questionInputSchema.partial().extend({
  is_archived: external_exports.boolean().optional()
});
var bulkSchema = external_exports.object({
  questions: external_exports.array(questionInputSchema).min(1).max(200)
});
var randomSchema = external_exports.object({
  count: external_exports.coerce.number().int().min(1).max(100).default(10),
  type: external_exports.enum(QUESTION_TYPES).optional(),
  difficulty: external_exports.enum(DIFFICULTIES).optional(),
  tags: external_exports.array(external_exports.string().min(1).max(100)).max(20).optional(),
  course_id: external_exports.string().max(200).optional(),
  lesson_id: external_exports.string().max(200).optional(),
  exclude_ids: external_exports.array(external_exports.string().max(200)).max(500).optional()
});
var attachSchema = external_exports.object({
  quiz_id: external_exports.string().min(1),
  question_ids: external_exports.array(external_exports.string().min(1)).min(1).max(300),
  points_override: external_exports.coerce.number().int().min(1).max(100).nullable().optional()
});
function parseJsonSafe(raw2, fallback) {
  if (!raw2)
    return fallback;
  try {
    return JSON.parse(raw2);
  } catch {
    return fallback;
  }
}
__name(parseJsonSafe, "parseJsonSafe");
function toApi(row) {
  return {
    id: row.id,
    platform: row.platform,
    course_id: row.course_id,
    unit_id: row.unit_id,
    lesson_id: row.lesson_id,
    type: row.type,
    difficulty: row.difficulty,
    bloom_level: row.bloom_level,
    question_text: row.question_text,
    image_url: row.image_url,
    options: parseJsonSafe(row.options_json, null),
    correct_answer: parseJsonSafe(row.correct_answer_json, null),
    explanation: row.explanation,
    points: row.points,
    tags: parseJsonSafe(row.tags_json, []),
    source: row.source,
    usage_count: row.usage_count,
    is_archived: row.is_archived === 1,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
__name(toApi, "toApi");
function validationError(c, details) {
  return c.json(
    { error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details } },
    400
  );
}
__name(validationError, "validationError");
function buildFilters(q) {
  const where = ["q.platform = ?"];
  const binds = [q.__platform];
  let join = "";
  if (q.q) {
    where.push("(q.question_text LIKE ? OR q.explanation LIKE ?)");
    const like = `%${q.q}%`;
    binds.push(like, like);
  }
  if (q.type) {
    where.push("q.type = ?");
    binds.push(q.type);
  }
  if (q.difficulty) {
    where.push("q.difficulty = ?");
    binds.push(q.difficulty);
  }
  if (q.tag) {
    where.push(`q.tags_json LIKE '%"' || ? || '"%'`);
    binds.push(q.tag);
  }
  if (q.course_id) {
    where.push("q.course_id = ?");
    binds.push(q.course_id);
  }
  if (q.lesson_id) {
    where.push("q.lesson_id = ?");
    binds.push(q.lesson_id);
  }
  if (q.unit_id) {
    where.push("q.unit_id = ?");
    binds.push(q.unit_id);
  }
  if (q.bloom_level) {
    where.push("q.bloom_level = ?");
    binds.push(q.bloom_level);
  }
  if (q.include_archived !== "true") {
    where.push("q.is_archived = 0");
  }
  if (q.quiz_id) {
    join = " INNER JOIN exam_questions eq ON eq.question_id = q.id AND eq.quiz_id = ?";
  }
  return { where, binds, join };
}
__name(buildFilters, "buildFilters");
function csvCell(value) {
  if (value === null || value === void 0)
    return "";
  const str = Array.isArray(value) ? value.join(" | ") : String(value);
  const guarded = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${guarded.replace(/"/g, '""')}"`;
}
__name(csvCell, "csvCell");
function toCsv(rows) {
  const header = [
    "id",
    "type",
    "difficulty",
    "bloom_level",
    "question_text",
    "options",
    "correct_answer",
    "explanation",
    "points",
    "tags",
    "source"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.id),
      csvCell(r.type),
      csvCell(r.difficulty),
      csvCell(r.bloom_level),
      csvCell(r.question_text),
      csvCell(r.options),
      csvCell(typeof r.correct_answer === "object" ? JSON.stringify(r.correct_answer) : r.correct_answer),
      csvCell(r.explanation),
      csvCell(r.points),
      csvCell(r.tags),
      csvCell(r.source)
    ].join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}
__name(toCsv, "toCsv");
questionBank.use("/question-bank/*", async (c, next) => {
  if (c.req.path.startsWith(PUBLIC_PREFIX)) {
    await next();
    return;
  }
  return requireAuth(c, next);
});
questionBank.use("/question-bank/*", async (c, next) => {
  if (c.req.path.startsWith(PUBLIC_PREFIX)) {
    await next();
    return;
  }
  return requireRole("admin", "assistant")(c, next);
});
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const j = Math.floor(rand * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
__name(shuffle, "shuffle");
function toPublicApi(row) {
  let options = parseJsonSafe(row.options_json, null);
  let choices = null;
  if (row.type === "matching") {
    const pairs = parseJsonSafe(row.options_json, []);
    options = pairs.map((p) => p?.left ?? "");
    choices = shuffle(pairs.map((p) => p?.right ?? ""));
  }
  return {
    id: row.id,
    course_id: row.course_id,
    unit_id: row.unit_id,
    lesson_id: row.lesson_id,
    type: row.type,
    difficulty: row.difficulty,
    bloom_level: row.bloom_level,
    question_text: row.question_text,
    image_url: row.image_url,
    options,
    choices,
    points: row.points,
    tags: parseJsonSafe(row.tags_json, []),
    source: row.source,
    created_at: row.created_at
  };
}
__name(toPublicApi, "toPublicApi");
var TRUE_WORDS = /* @__PURE__ */ new Set(["\u0635\u062D", "\u0635", "true", "1", "\u0646\u0639\u0645", "\u0635\u062D\u062D"]);
var FALSE_WORDS = /* @__PURE__ */ new Set(["\u062E\u0637\u0623", "\u062E", "false", "0", "\u0644\u0627", "\u062E\u0637\u0627"]);
function toBooleanAnswer(value) {
  if (typeof value === "boolean")
    return value;
  if (typeof value === "number")
    return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (TRUE_WORDS.has(s))
      return true;
    if (FALSE_WORDS.has(s))
      return false;
  }
  return null;
}
__name(toBooleanAnswer, "toBooleanAnswer");
function gradeAnswer(type, key, given) {
  const k = key ?? {};
  let g = given;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const o = g;
    if (typeof o.option_index !== "undefined")
      g = o.option_index;
    else if (typeof o.value !== "undefined")
      g = o.value;
    else if (typeof o.text !== "undefined")
      g = o.text;
    else if (typeof o.option_text !== "undefined")
      g = o.option_text;
  }
  if (type === "mcq") {
    const expectedIndex = typeof k.option_index === "number" ? k.option_index : null;
    if (typeof g === "number" && expectedIndex !== null) {
      return { correct: g === expectedIndex };
    }
    if (typeof g === "string") {
      const trimmed = g.trim();
      if (expectedIndex !== null && trimmed === String(expectedIndex)) {
        return { correct: true };
      }
      if (typeof k.option_text === "string") {
        return { correct: normalizeArabic(trimmed) === normalizeArabic(k.option_text) };
      }
    }
    return { correct: false };
  }
  if (type === "true_false") {
    const expected = toBooleanAnswer(k.value);
    const actual = toBooleanAnswer(g);
    if (expected === null || actual === null)
      return { correct: false };
    return { correct: expected === actual };
  }
  if (type === "matching" || type === "ordering") {
    const expected = JSON.stringify(k.pairs ?? k.order ?? null);
    const givenStruct = given && typeof given === "object" && !Array.isArray(given) ? given.pairs ?? given.order : given;
    const actual = JSON.stringify(givenStruct ?? null);
    return { correct: expected === actual };
  }
  if (type === "essay") {
    return { correct: null, reason: "\u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0642\u0627\u0644\u064A \u064A\u062D\u062A\u0627\u062C \u062A\u0635\u062D\u064A\u062D\u064B\u0627 \u064A\u062F\u0648\u064A\u064B\u0627 \u0645\u0646 \u0627\u0644\u0645\u062F\u0631\u0633" };
  }
  const expectedText = typeof k.text === "string" ? k.text : "";
  const givenText = typeof g === "string" ? g : "";
  if (!expectedText || !givenText.trim())
    return { correct: false };
  const normExpected = normalizeArabic(expectedText);
  const normGiven = normalizeArabic(givenText);
  if (normExpected === normGiven)
    return { correct: true };
  if (normExpected.length >= 12 && normGiven.includes(normExpected))
    return { correct: true };
  return { correct: false };
}
__name(gradeAnswer, "gradeAnswer");
var checkSchema = external_exports.object({
  question_id: external_exports.string().min(1).max(200),
  answer: external_exports.unknown()
});
questionBank.get(
  "/question-bank/public",
  rateLimit("qb_public_list", 120, 60),
  async (c) => {
    const platform = c.env.PLATFORM_KEY || "fusha";
    const query = c.req.query();
    const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit || "20", 10) || 20));
    const offset = (page - 1) * limit;
    if (query.type && !QUESTION_TYPES.includes(query.type)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0646\u0648\u0639 \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
    }
    if (query.difficulty && !DIFFICULTIES.includes(query.difficulty)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0635\u0639\u0648\u0628\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
    }
    const filters = buildFilters({ ...query, __platform: platform });
    const whereSql = filters.where.join(" AND ");
    const sortColumn = SORTABLE_COLUMNS[query.sort || "created_at"] || SORTABLE_COLUMNS.created_at;
    const sortOrder = SORT_ORDERS[(query.order || "desc").toLowerCase()] || "DESC";
    const countBinds = filters.join ? [query.quiz_id, ...filters.binds] : filters.binds;
    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM question_bank q${filters.join} WHERE ${whereSql}`
    ).bind(...countBinds).first();
    const total = totalRow?.total || 0;
    const listBinds = filters.join ? [query.quiz_id, ...filters.binds, limit, offset] : [...filters.binds, limit, offset];
    const { results } = await c.env.DB.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM question_bank q${filters.join}
       WHERE ${whereSql}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT ? OFFSET ?`
    ).bind(...listBinds).all();
    return c.json({
      questions: results.map((r) => toPublicApi(r)),
      meta: { page, limit, total, has_more: offset + results.length < total }
    });
  }
);
questionBank.get("/question-bank/public/tags", rateLimit("qb_public_tags", 120, 60), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results } = await c.env.DB.prepare(
    "SELECT tags_json FROM question_bank WHERE platform = ? AND is_archived = 0 AND tags_json IS NOT NULL"
  ).bind(platform).all();
  const counts = /* @__PURE__ */ new Map();
  for (const row of results) {
    for (const tag of parseJsonSafe(row.tags_json, [])) {
      if (!tag)
        continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const tags = [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ar"));
  return c.json({ tags });
});
questionBank.post(
  "/question-bank/public/random",
  rateLimit("qb_public_random", 60, 60),
  async (c) => {
    const platform = c.env.PLATFORM_KEY || "fusha";
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
    }
    const parsed = randomSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.flatten());
    }
    const d = parsed.data;
    const where = ["platform = ?", "is_archived = 0"];
    const binds = [platform];
    if (d.type) {
      where.push("type = ?");
      binds.push(d.type);
    }
    if (d.difficulty) {
      where.push("difficulty = ?");
      binds.push(d.difficulty);
    }
    if (d.course_id) {
      where.push("course_id = ?");
      binds.push(d.course_id);
    }
    if (d.lesson_id) {
      where.push("lesson_id = ?");
      binds.push(d.lesson_id);
    }
    const exclude = (d.exclude_ids || []).filter(Boolean).slice(0, 500);
    if (exclude.length > 0) {
      where.push(`id NOT IN (${exclude.map(() => "?").join(",")})`);
      binds.push(...exclude);
    }
    for (const tag of d.tags || []) {
      where.push(`tags_json LIKE '%"' || ? || '"%'`);
      binds.push(tag);
    }
    const { results } = await c.env.DB.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM question_bank q
       WHERE ${where.join(" AND ")}
       ORDER BY RANDOM()
       LIMIT ?`
    ).bind(...binds, d.count).all();
    const questions2 = results.map((r) => toPublicApi(r));
    return c.json({
      questions: questions2,
      count: questions2.length,
      requested: d.count,
      ...questions2.length < d.count ? {
        message: questions2.length === 0 ? "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0633\u0626\u0644\u0629 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u0639\u0627\u064A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u062F\u0629" : `\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 ${questions2.length} \u0633\u0624\u0627\u0644\u064B\u0627 \u0641\u0642\u0637 \u0645\u0646 ${d.count} \u0645\u0637\u0644\u0648\u0628\u064B\u0627`
      } : {}
    });
  }
);
questionBank.post(
  "/question-bank/public/check",
  optionalAuth,
  rateLimit("qb_public_check", 60, 60),
  async (c) => {
    const platform = c.env.PLATFORM_KEY || "fusha";
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
    }
    const parsed = checkSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.flatten());
    }
    const row = await c.env.DB.prepare(
      "SELECT * FROM question_bank WHERE id = ? AND platform = ? AND is_archived = 0"
    ).bind(parsed.data.question_id, platform).first();
    if (!row) {
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    }
    const key = parseJsonSafe(row.correct_answer_json, null);
    const { correct, reason } = gradeAnswer(row.type, key, parsed.data.answer);
    const user = c.get("user");
    if (user && correct === false) {
      const correctAnswerText = bankAnswerText(row.type, row.options_json, key);
      await recordMistake(c.env, {
        studentId: user.id,
        questionId: row.id,
        source: "bank",
        quizId: null,
        examId: null,
        questionText: row.question_text,
        givenAnswer: describeGivenAnswer(parsed.data.answer),
        correctAnswer: correctAnswerText,
        pointsLost: row.points
      });
    }
    return c.json({
      question_id: row.id,
      type: row.type,
      correct,
      ...reason ? { message: reason } : {},
      correct_answer: key,
      explanation: row.explanation,
      points: row.points,
      ...correct === false ? { correct_answer_reason: buildBankReason(row.type, row.options_json, key, row.explanation) } : {}
    });
  }
);
function bankAnswerText(type, optionsJson, key) {
  const k = key ?? {};
  if (type === "mcq") {
    if (typeof k.option_text === "string" && k.option_text)
      return k.option_text;
    const options = parseJsonSafe(optionsJson, null);
    if (Array.isArray(options) && typeof k.option_index === "number" && typeof options[k.option_index] === "string") {
      return options[k.option_index];
    }
    return "";
  }
  if (type === "true_false") {
    if (k.value === true)
      return "\u0635\u062D";
    if (k.value === false)
      return "\u062E\u0637\u0623";
    return "";
  }
  if (typeof k.text === "string")
    return k.text;
  if (k.pairs !== void 0 || k.order !== void 0)
    return JSON.stringify(k.pairs ?? k.order);
  return "";
}
__name(bankAnswerText, "bankAnswerText");
function buildBankReason(type, optionsJson, key, explanation) {
  const correctOptionText = bankAnswerText(type, optionsJson, key);
  if (!correctOptionText)
    return null;
  const reason = (explanation || "").trim();
  return `\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 \u0647\u064A \xAB${correctOptionText}\xBB${reason ? ` \u0644\u0623\u0646 ${reason}` : ""}`;
}
__name(buildBankReason, "buildBankReason");
function describeGivenAnswer(given) {
  if (given === null || given === void 0)
    return "";
  if (typeof given === "string")
    return given;
  if (typeof given === "number" || typeof given === "boolean")
    return String(given);
  if (typeof given === "object") {
    const o = given;
    for (const field of ["option_text", "text", "value", "option_index"]) {
      if (o[field] !== void 0 && o[field] !== null)
        return String(o[field]);
    }
    return JSON.stringify(given);
  }
  return String(given);
}
__name(describeGivenAnswer, "describeGivenAnswer");
questionBank.get("/question-bank/tags", async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results } = await c.env.DB.prepare(
    "SELECT tags_json FROM question_bank WHERE platform = ? AND is_archived = 0 AND tags_json IS NOT NULL"
  ).bind(platform).all();
  const counts = /* @__PURE__ */ new Map();
  for (const row of results) {
    const tags2 = parseJsonSafe(row.tags_json, []);
    for (const tag of tags2) {
      if (!tag)
        continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const tags = [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ar"));
  return c.json({ tags });
});
questionBank.get("/question-bank/export", async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const query = c.req.query();
  const filters = buildFilters({ ...query, __platform: platform });
  const stmt = c.env.DB.prepare(
    `SELECT q.* FROM question_bank q${filters.join}
     WHERE ${filters.where.join(" AND ")}
     ORDER BY q.created_at DESC
     LIMIT 1000`
  );
  const bindValues = filters.join ? [query.quiz_id, ...filters.binds] : filters.binds;
  const { results } = await stmt.bind(...bindValues).all();
  const questions2 = results.map(toApi);
  if (query.format === "csv") {
    return new Response(toCsv(questions2), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fusha-question-bank.csv"'
      }
    });
  }
  return c.json({
    questions: questions2,
    exported_at: (/* @__PURE__ */ new Date()).toISOString(),
    count: questions2.length
  });
});
questionBank.get("/question-bank", async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const query = c.req.query();
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const rawLimit = Number.parseInt(query.limit || "20", 10) || 20;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;
  if (query.type && !QUESTION_TYPES.includes(query.type)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0646\u0648\u0639 \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
  }
  if (query.difficulty && !DIFFICULTIES.includes(query.difficulty)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0635\u0639\u0648\u0628\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" } }, 400);
  }
  const filters = buildFilters({ ...query, __platform: platform });
  const whereSql = filters.where.join(" AND ");
  const sortColumn = SORTABLE_COLUMNS[query.sort || "created_at"] || SORTABLE_COLUMNS.created_at;
  const sortOrder = SORT_ORDERS[(query.order || "desc").toLowerCase()] || "DESC";
  const countBinds = filters.join ? [query.quiz_id, ...filters.binds] : filters.binds;
  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM question_bank q${filters.join} WHERE ${whereSql}`
  ).bind(...countBinds).first();
  const total = totalRow?.total || 0;
  const stmt = c.env.DB.prepare(
    `SELECT q.* FROM question_bank q${filters.join}
     WHERE ${whereSql}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT ? OFFSET ?`
  );
  const listBinds = filters.join ? [query.quiz_id, ...filters.binds, limit, offset] : [...filters.binds, limit, offset];
  const { results } = await stmt.bind(...listBinds).all();
  return c.json({
    questions: results.map(toApi),
    meta: {
      page,
      limit,
      total,
      has_more: offset + results.length < total
    }
  });
});
questionBank.post("/question-bank/random", async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
  }
  const parsed = randomSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;
  const where = ["platform = ?", "is_archived = 0"];
  const binds = [platform];
  if (d.type) {
    where.push("type = ?");
    binds.push(d.type);
  }
  if (d.difficulty) {
    where.push("difficulty = ?");
    binds.push(d.difficulty);
  }
  if (d.course_id) {
    where.push("course_id = ?");
    binds.push(d.course_id);
  }
  if (d.lesson_id) {
    where.push("lesson_id = ?");
    binds.push(d.lesson_id);
  }
  const exclude = (d.exclude_ids || []).filter(Boolean).slice(0, 500);
  if (exclude.length > 0) {
    where.push(`id NOT IN (${exclude.map(() => "?").join(",")})`);
    binds.push(...exclude);
  }
  for (const tag of d.tags || []) {
    where.push(`tags_json LIKE '%"' || ? || '"%'`);
    binds.push(tag);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM question_bank
     WHERE ${where.join(" AND ")}
     ORDER BY RANDOM()
     LIMIT ?`
  ).bind(...binds, d.count).all();
  const questions2 = results.map(toApi);
  if (questions2.length < d.count) {
    return c.json({
      questions: questions2,
      count: questions2.length,
      requested: d.count,
      message: questions2.length === 0 ? "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0633\u0626\u0644\u0629 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u0639\u0627\u064A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u062F\u0629" : `\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 ${questions2.length} \u0633\u0624\u0627\u0644\u064B\u0627 \u0641\u0642\u0637 \u0645\u0646 ${d.count} \u0645\u0637\u0644\u0648\u0628\u064B\u0627`
    });
  }
  return c.json({ questions: questions2, count: questions2.length, requested: d.count });
});
questionBank.post("/question-bank/bulk", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const user = c.get("user");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const statements = parsed.data.questions.map((q) => {
    const id = generateId();
    return c.env.DB.prepare(
      `INSERT INTO question_bank
        (id, platform, course_id, unit_id, lesson_id, type, difficulty, bloom_level,
         question_text, image_url, options_json, correct_answer_json, explanation,
         points, tags_json, source, usage_count, is_archived, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      platform,
      q.course_id || null,
      q.unit_id || null,
      q.lesson_id || null,
      q.type,
      q.difficulty,
      q.bloom_level || null,
      q.question_text,
      q.image_url || null,
      q.options ? JSON.stringify(q.options) : null,
      q.correct_answer !== void 0 ? JSON.stringify(q.correct_answer) : null,
      q.explanation || null,
      q.points,
      JSON.stringify(q.tags || []),
      q.source || null,
      user.id
    );
  });
  await c.env.DB.batch(statements);
  return c.json({ ok: true, created: statements.length }, 201);
});
questionBank.post("/question-bank/attach", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
  }
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;
  const quiz = await c.env.DB.prepare("SELECT id FROM quizzes WHERE id = ?").bind(d.quiz_id).first();
  if (!quiz) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const ids = d.question_ids;
  const placeholders = ids.map(() => "?").join(",");
  const { results: found } = await c.env.DB.prepare(
    `SELECT id FROM question_bank WHERE platform = ? AND id IN (${placeholders})`
  ).bind(platform, ...ids).all();
  const foundIds = new Set(found.map((r) => r.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "\u0628\u0639\u0636 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629", details: { missing } } },
      404
    );
  }
  const currentOrder = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM exam_questions WHERE quiz_id = ?"
  ).bind(d.quiz_id).first();
  let nextOrder = (currentOrder?.max_order ?? -1) + 1;
  const statements = ids.map(
    (questionId) => c.env.DB.prepare(
      `INSERT OR IGNORE INTO exam_questions (id, quiz_id, question_id, sort_order, points_override, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(generateId(), d.quiz_id, questionId, nextOrder++, d.points_override ?? null)
  );
  await c.env.DB.batch(statements);
  await c.env.DB.prepare(
    `UPDATE question_bank SET usage_count = usage_count + 1, updated_at = datetime('now')
     WHERE id IN (${placeholders})`
  ).bind(...ids).run();
  return c.json({ ok: true, quiz_id: d.quiz_id, attached: ids.length });
});
questionBank.post("/question-bank", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const user = c.get("user");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
  }
  const parsed = questionInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO question_bank
      (id, platform, course_id, unit_id, lesson_id, type, difficulty, bloom_level,
       question_text, image_url, options_json, correct_answer_json, explanation,
       points, tags_json, source, usage_count, is_archived, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platform,
    d.course_id || null,
    d.unit_id || null,
    d.lesson_id || null,
    d.type,
    d.difficulty,
    d.bloom_level || null,
    d.question_text,
    d.image_url || null,
    d.options ? JSON.stringify(d.options) : null,
    d.correct_answer !== void 0 ? JSON.stringify(d.correct_answer) : null,
    d.explanation || null,
    d.points,
    JSON.stringify(d.tags || []),
    d.source || null,
    user.id
  ).run();
  const row = await c.env.DB.prepare("SELECT * FROM question_bank WHERE id = ?").bind(id).first();
  return c.json({ question: toApi(row) }, 201);
});
questionBank.get("/question-bank/:id", async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT * FROM question_bank WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!row) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results: exams } = await c.env.DB.prepare(
    `SELECT eq.quiz_id, eq.sort_order, eq.points_override, q.title as quiz_title
     FROM exam_questions eq
     INNER JOIN quizzes q ON q.id = eq.quiz_id
     WHERE eq.question_id = ?
     ORDER BY eq.sort_order ASC`
  ).bind(id).all();
  return c.json({ question: toApi(row), exams });
});
questionBank.patch("/question-bank/:id", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const id = c.req.param("id");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u064A\u062C\u0628 \u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON" } }, 400);
  }
  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;
  const existing = await c.env.DB.prepare(
    "SELECT * FROM question_bank WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const setClauses = [];
  const binds = [];
  const assign = /* @__PURE__ */ __name((column, value) => {
    setClauses.push(`${column} = ?`);
    binds.push(value);
  }, "assign");
  if (d.type !== void 0)
    assign("type", d.type);
  if (d.difficulty !== void 0)
    assign("difficulty", d.difficulty);
  if (d.bloom_level !== void 0)
    assign("bloom_level", d.bloom_level);
  if (d.course_id !== void 0)
    assign("course_id", d.course_id);
  if (d.unit_id !== void 0)
    assign("unit_id", d.unit_id);
  if (d.lesson_id !== void 0)
    assign("lesson_id", d.lesson_id);
  if (d.question_text !== void 0)
    assign("question_text", d.question_text);
  if (d.image_url !== void 0)
    assign("image_url", d.image_url);
  if (d.options !== void 0)
    assign("options_json", d.options ? JSON.stringify(d.options) : null);
  if (d.correct_answer !== void 0)
    assign("correct_answer_json", JSON.stringify(d.correct_answer));
  if (d.explanation !== void 0)
    assign("explanation", d.explanation);
  if (d.points !== void 0)
    assign("points", d.points);
  if (d.tags !== void 0)
    assign("tags_json", JSON.stringify(d.tags));
  if (d.source !== void 0)
    assign("source", d.source);
  if (d.is_archived !== void 0)
    assign("is_archived", d.is_archived ? 1 : 0);
  if (setClauses.length === 0) {
    return c.json({ error: { code: "BAD_REQUEST", message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0644\u062A\u062D\u062F\u064A\u062B" } }, 400);
  }
  setClauses.push("updated_at = datetime('now')");
  binds.push(id, platform);
  await c.env.DB.prepare(
    `UPDATE question_bank SET ${setClauses.join(", ")} WHERE id = ? AND platform = ?`
  ).bind(...binds).run();
  const row = await c.env.DB.prepare("SELECT * FROM question_bank WHERE id = ?").bind(id).first();
  return c.json({ question: toApi(row) });
});
questionBank.delete("/question-bank/:id", requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT id FROM question_bank WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare(
    `UPDATE question_bank SET is_archived = 1, updated_at = datetime('now') WHERE id = ? AND platform = ?`
  ).bind(id, platform).run();
  return c.json({ ok: true });
});
var questionBank_default = questionBank;

// src/routes/parent.ts
var parent = new Hono2();
async function assertLinked(db, platform, parentId, studentId) {
  const row = await db.prepare(
    `SELECT id FROM parent_links
        WHERE platform = ? AND parent_id = ? AND student_id = ?`
  ).bind(platform, parentId, studentId).first();
  return !!row && !!row.id;
}
__name(assertLinked, "assertLinked");
parent.get("/parent/children", requireAuth, rateLimit("parent_children", 60, 60), async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.full_name, p.avatar_url, p.grade_year, p.governorate, pl.relation
       FROM parent_links pl
       JOIN profiles p ON p.id = pl.student_id
      WHERE pl.platform = ? AND pl.parent_id = ? AND p.platform = ?
      ORDER BY p.full_name ASC`
  ).bind(platform, user.id, platform).all();
  return c.json({ children: results });
});
parent.get("/parent/children/:id/summary", requireAuth, rateLimit("parent_summary", 60, 60), async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const studentId = c.req.param("id");
  if (!await assertLinked(c.env.DB, platform, user.id, studentId)) {
    return c.json({ error: { code: "FORBIDDEN", message: "\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628\u0643" } }, 403);
  }
  const student = await c.env.DB.prepare(
    `SELECT id, full_name, avatar_url, grade_year, governorate FROM profiles
      WHERE id = ? AND platform = ?`
  ).bind(studentId, platform).first();
  if (!student) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const totals = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(watched_seconds), 0) AS total_seconds,
            COUNT(*)                          AS lessons_started,
            COALESCE(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END), 0) AS lessons_completed
       FROM lesson_progress
      WHERE student_id = ? AND platform = ?`
  ).bind(studentId, platform).first();
  const { results: perCourse } = await c.env.DB.prepare(
    `SELECT c.id AS course_id,
            c.title AS course_title,
            COUNT(lp.id) AS lessons_started,
            COALESCE(SUM(CASE WHEN lp.is_completed = 1 THEN 1 ELSE 0 END), 0) AS lessons_completed,
            COALESCE(SUM(lp.watched_seconds), 0) AS watched_seconds
       FROM lesson_progress lp
       JOIN courses c ON c.id = lp.course_id
      WHERE lp.student_id = ? AND lp.platform = ? AND c.platform = ?
      GROUP BY c.id
      ORDER BY c.title ASC`
  ).bind(studentId, platform, platform).all();
  const { results: exams } = await c.env.DB.prepare(
    `SELECT qa.id AS attempt_id,
            q.id  AS quiz_id,
            q.title AS quiz_title,
            q.max_score,
            qa.score,
            qa.submitted_at,
            (SELECT AVG(qa2.score) FROM quiz_attempts qa2 WHERE qa2.quiz_id = qa.quiz_id) AS cohort_avg,
            (SELECT COUNT(*)      FROM quiz_attempts qa3 WHERE qa3.quiz_id = qa.quiz_id) AS cohort_count
       FROM quiz_attempts qa
       JOIN quizzes q  ON q.id = qa.quiz_id
       JOIN courses c  ON c.id = q.course_id
      WHERE qa.student_id = ? AND c.platform = ?
      ORDER BY qa.submitted_at DESC`
  ).bind(studentId, platform).all();
  const totalSeconds = Number(totals?.total_seconds || 0);
  return c.json({
    student,
    study: {
      total_seconds: totalSeconds,
      total_hours: Math.round(totalSeconds / 3600 * 10) / 10,
      lessons_started: Number(totals?.lessons_started || 0),
      lessons_completed: Number(totals?.lessons_completed || 0)
    },
    per_course: perCourse,
    exams
  });
});
parent.get("/parent/children/:id/notes", requireAuth, rateLimit("parent_notes", 60, 60), async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const studentId = c.req.param("id");
  if (!await assertLinked(c.env.DB, platform, user.id, studentId)) {
    return c.json({ error: { code: "FORBIDDEN", message: "\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628\u0643" } }, 403);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT n.id, n.body, n.created_at, n.read_at, p.full_name AS author_name
       FROM parent_notes n
       JOIN profiles p ON p.id = n.author_id
      WHERE n.platform = ? AND n.student_id = ?
      ORDER BY n.created_at DESC`
  ).bind(platform, studentId).all();
  return c.json({ notes: results });
});
parent.post("/parent/children/:id/notes/read", requireAuth, rateLimit("parent_notes_read", 30, 60), async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const studentId = c.req.param("id");
  if (!await assertLinked(c.env.DB, platform, user.id, studentId)) {
    return c.json({ error: { code: "FORBIDDEN", message: "\u0647\u0630\u0627 \u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628\u0643" } }, 403);
  }
  await c.env.DB.prepare(
    `UPDATE parent_notes SET read_at = datetime('now')
      WHERE platform = ? AND student_id = ? AND read_at IS NULL`
  ).bind(platform, studentId).run();
  return c.json({ ok: true });
});
parent.post("/admin/students/:id/parent-notes", requireAuth, requirePermission("can_manage_courses"), async (c) => {
  const user = c.get("user");
  const platform = c.env.PLATFORM_KEY || "fusha";
  const studentId = c.req.param("id");
  const schema = external_exports.object({ body: external_exports.string().min(3).max(2e3) });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0646\u0635 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629" } }, 400);
  }
  const student = await c.env.DB.prepare("SELECT id FROM profiles WHERE id = ? AND platform = ?").bind(studentId, platform).first();
  if (!student) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO parent_notes (id, platform, student_id, author_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(id, platform, studentId, user.id, parsed.data.body).run();
  return c.json({ id }, 201);
});
parent.post("/admin/students/:id/link-parent", requireAuth, requirePermission("can_manage_courses"), async (c) => {
  const platform = c.env.PLATFORM_KEY || "fusha";
  const studentId = c.req.param("id");
  const schema = external_exports.object({
    parent_id: external_exports.string().min(1),
    relation: external_exports.string().max(40).optional()
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0631\u0628\u0637 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" } }, 400);
  }
  const both = await c.env.DB.prepare(
    `SELECT (SELECT id FROM profiles WHERE id = ?  AND platform = ?) AS student_id,
            (SELECT id FROM profiles WHERE id = ?  AND platform = ?) AS parent_id`
  ).bind(studentId, platform, parsed.data.parent_id, platform).first();
  if (!both?.student_id || !both?.parent_id) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u0623\u0648 \u0648\u0644\u064A\u0651 \u0627\u0644\u0623\u0645\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO parent_links (id, platform, parent_id, student_id, relation, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(platform, parent_id, student_id) DO UPDATE SET relation = excluded.relation`
  ).bind(id, platform, parsed.data.parent_id, studentId, parsed.data.relation || null).run();
  return c.json({ id }, 201);
});
var parent_default = parent;

// src/routes/bundles.ts
var bundles = new Hono2();
bundles.use("/admin/*", requireAuth);
var platformOf2 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var BUNDLE_LABELS = {
  title: "\u0627\u0644\u0628\u0627\u0642\u0627\u062A \u0648\u0627\u0644\u062E\u0637\u0637",
  subtitle: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0628\u0627\u0642\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0648\u0627\u0634\u062A\u0631\u0643 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A",
  current_badge: "\u0627\u0644\u062D\u0627\u0644\u064A\u0629",
  no_features: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u064A\u0632\u0627\u062A \u0645\u062D\u062F\u062F\u0629",
  upgrade: "\u062A\u0631\u0642\u064A\u0629",
  change: "\u062A\u063A\u064A\u064A\u0631",
  loading: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0628\u0627\u0642\u0627\u062A...",
  load_error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0628\u0627\u0642\u0627\u062A",
  empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u0627\u0642\u0627\u062A \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B",
  purchase_title: "\u0634\u0631\u0627\u0621 \u0627\u0644\u0628\u0627\u0642\u0629",
  price_label: "\u0627\u0644\u0633\u0639\u0631",
  transfer_image_label: "\u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u0641\u0639\u064A\u0644 *",
  pick_image: "\u0627\u0636\u063A\u0637 \u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629",
  submit: "\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643",
  error_image_required: "\u064A\u0631\u062C\u0649 \u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644",
  success: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0646\u062C\u0627\u062D",
  error_failed: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628"
};
function parseFeatures(raw2) {
  if (!raw2)
    return [];
  try {
    const parsed = JSON.parse(raw2);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
__name(parseFeatures, "parseFeatures");
async function loadBundleCourses(env, bundleIds) {
  if (bundleIds.length === 0)
    return /* @__PURE__ */ new Map();
  const placeholders = bundleIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT bc.bundle_id, c.id, c.title
     FROM bundle_courses bc
     INNER JOIN courses c ON c.id = bc.course_id
     WHERE bc.bundle_id IN (${placeholders})
     ORDER BY c.title ASC`
  ).bind(...bundleIds).all();
  const map = /* @__PURE__ */ new Map();
  for (const row of results) {
    const list = map.get(row.bundle_id) || [];
    list.push({ id: row.id, title: row.title });
    map.set(row.bundle_id, list);
  }
  return map;
}
__name(loadBundleCourses, "loadBundleCourses");
bundles.get("/bundles", optionalAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf2(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, price, reference_price, is_price_hidden, features_json, sort_order
     FROM bundles
     WHERE platform = ? AND is_published = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();
  const courseMap = await loadBundleCourses(c.env, results.map((r) => r.id));
  let enrolledCourseIds = /* @__PURE__ */ new Set();
  if (user) {
    const { results: enrollments } = await c.env.DB.prepare(
      "SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'"
    ).bind(user.id).all();
    enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));
  }
  const list = results.map((b) => {
    const courses2 = courseMap.get(b.id) || [];
    const isCurrent = !!user && courses2.length > 0 && courses2.every((course) => enrolledCourseIds.has(course.id));
    const priceHidden = b.is_price_hidden === 1;
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      cover_url: b.cover_url,
      price: b.price,
      reference_price: b.reference_price,
      is_price_hidden: priceHidden,
      features: parseFeatures(b.features_json),
      sort_order: b.sort_order,
      courses: courses2,
      course_count: courses2.length,
      is_current: isCurrent,
      status_label: isCurrent ? BUNDLE_LABELS.current_badge : null,
      action_label: priceHidden ? BUNDLE_LABELS.change : BUNDLE_LABELS.upgrade
    };
  });
  return c.json({ bundles: list, labels: BUNDLE_LABELS });
});
bundles.get("/admin/bundles", requirePermission("can_manage_courses"), async (c) => {
  const platform = platformOf2(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM bundles WHERE platform = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();
  const courseMap = await loadBundleCourses(c.env, results.map((r) => r.id));
  return c.json({
    bundles: results.map((b) => ({
      ...b,
      features: parseFeatures(b.features_json),
      courses: courseMap.get(b.id) || [],
      course_count: (courseMap.get(b.id) || []).length
    }))
  });
});
var bundleSchema = external_exports.object({
  title: external_exports.string().trim().min(2).max(200),
  description: external_exports.string().max(2e3).optional().nullable(),
  cover_url: external_exports.string().max(500).optional().nullable(),
  price: external_exports.number().int().min(0).max(1e6).optional(),
  reference_price: external_exports.number().int().min(0).max(1e6).optional().nullable(),
  is_price_hidden: external_exports.boolean().optional(),
  features: external_exports.array(external_exports.string().max(200)).max(50).optional(),
  is_published: external_exports.boolean().optional(),
  sort_order: external_exports.number().int().min(0).max(1e5).optional(),
  course_ids: external_exports.array(external_exports.string().min(1)).max(200).optional()
});
bundles.post("/admin/bundles", requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bundleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const platform = platformOf2(c.env);
  const id = generateId();
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO bundles (id, title, description, cover_url, price, reference_price, is_price_hidden, features_json, is_published, sort_order, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      d.title,
      d.description ?? null,
      d.cover_url ?? null,
      d.price ?? 0,
      d.reference_price ?? null,
      d.is_price_hidden ? 1 : 0,
      d.features ? JSON.stringify(d.features) : null,
      d.is_published ? 1 : 0,
      d.sort_order ?? 0,
      platform
    )
  ];
  for (const courseId of d.course_ids || []) {
    statements.push(
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO bundle_courses (bundle_id, course_id)
         SELECT ?, id FROM courses WHERE id = ? AND platform = ?`
      ).bind(id, courseId, platform)
    );
  }
  await c.env.DB.batch(statements);
  const created = await c.env.DB.prepare("SELECT * FROM bundles WHERE id = ?").bind(id).first();
  return c.json({ ok: true, bundle: created }, 201);
});
var bundlePatchSchema = bundleSchema.partial();
bundles.patch("/admin/bundles/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf2(c.env);
  const existing = await c.env.DB.prepare("SELECT id FROM bundles WHERE id = ? AND platform = ?").bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = bundlePatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const sets = [];
  const values = [];
  const assign = /* @__PURE__ */ __name((column, value) => {
    sets.push(`${column} = ?`);
    values.push(value);
  }, "assign");
  if (d.title !== void 0)
    assign("title", d.title);
  if (d.description !== void 0)
    assign("description", d.description);
  if (d.cover_url !== void 0)
    assign("cover_url", d.cover_url);
  if (d.price !== void 0)
    assign("price", d.price);
  if (d.reference_price !== void 0)
    assign("reference_price", d.reference_price);
  if (d.is_price_hidden !== void 0)
    assign("is_price_hidden", d.is_price_hidden ? 1 : 0);
  if (d.features !== void 0)
    assign("features_json", JSON.stringify(d.features));
  if (d.is_published !== void 0)
    assign("is_published", d.is_published ? 1 : 0);
  if (d.sort_order !== void 0)
    assign("sort_order", d.sort_order);
  const statements = [];
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    statements.push(c.env.DB.prepare(`UPDATE bundles SET ${sets.join(", ")} WHERE id = ?`).bind(...values));
  }
  if (d.course_ids !== void 0) {
    statements.push(c.env.DB.prepare("DELETE FROM bundle_courses WHERE bundle_id = ?").bind(id));
    for (const courseId of d.course_ids) {
      statements.push(
        c.env.DB.prepare(
          `INSERT OR IGNORE INTO bundle_courses (bundle_id, course_id)
           SELECT ?, id FROM courses WHERE id = ? AND platform = ?`
        ).bind(id, courseId, platform)
      );
    }
  }
  if (statements.length > 0)
    await c.env.DB.batch(statements);
  const updated = await c.env.DB.prepare("SELECT * FROM bundles WHERE id = ?").bind(id).first();
  return c.json({ ok: true, bundle: updated });
});
bundles.delete("/admin/bundles/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf2(c.env);
  const existing = await c.env.DB.prepare("SELECT id FROM bundles WHERE id = ? AND platform = ?").bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM bundle_courses WHERE bundle_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM bundles WHERE id = ?").bind(id)
  ]);
  return c.json({ ok: true });
});
bundles.post("/admin/bundles/:id/courses", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf2(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = external_exports.object({ course_ids: external_exports.array(external_exports.string().min(1)).min(1).max(200) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM bundles WHERE id = ? AND platform = ?").bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const statements = parsed.data.course_ids.map(
    (courseId) => c.env.DB.prepare(
      `INSERT OR IGNORE INTO bundle_courses (bundle_id, course_id)
       SELECT ?, id FROM courses WHERE id = ? AND platform = ?`
    ).bind(id, courseId, platform)
  );
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});
bundles.delete("/admin/bundles/:id/courses/:courseId", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const courseId = c.req.param("courseId");
  const platform = platformOf2(c.env);
  const existing = await c.env.DB.prepare("SELECT id FROM bundles WHERE id = ? AND platform = ?").bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM bundle_courses WHERE bundle_id = ? AND course_id = ?").bind(id, courseId).run();
  return c.json({ ok: true });
});
var bundles_default = bundles;

// src/routes/news.ts
var news = new Hono2();
news.use("/admin/*", requireAuth);
var platformOf3 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
news.get("/news", async (c) => {
  const platform = platformOf3(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, body, image_url, sort_order, published_at, created_at
     FROM news
     WHERE platform = ? AND is_published = 1
     ORDER BY sort_order ASC, COALESCE(published_at, created_at) DESC`
  ).bind(platform).all();
  return c.json({ news: results });
});
news.get("/admin/news", requirePermission("can_manage_courses"), async (c) => {
  const platform = platformOf3(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM news WHERE platform = ? ORDER BY sort_order ASC, created_at DESC`
  ).bind(platform).all();
  return c.json({ news: results });
});
var newsSchema = external_exports.object({
  title: external_exports.string().trim().min(2).max(300),
  body: external_exports.string().max(5e3).optional().nullable(),
  image_url: external_exports.string().max(500).optional().nullable(),
  is_published: external_exports.boolean().optional(),
  sort_order: external_exports.number().int().min(0).max(1e5).optional(),
  published_at: external_exports.string().max(40).optional().nullable()
});
news.post("/admin/news", requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  const isPublished = d.is_published ? 1 : 0;
  await c.env.DB.prepare(
    `INSERT INTO news (id, platform, title, body, image_url, is_published, sort_order, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platformOf3(c.env),
    d.title,
    d.body ?? null,
    d.image_url ?? null,
    isPublished,
    d.sort_order ?? 0,
    d.published_at ?? (isPublished ? (/* @__PURE__ */ new Date()).toISOString() : null)
  ).run();
  const created = await c.env.DB.prepare("SELECT * FROM news WHERE id = ?").bind(id).first();
  return c.json({ ok: true, news: created }, 201);
});
news.patch("/admin/news/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf3(c.env);
  const existing = await c.env.DB.prepare("SELECT id FROM news WHERE id = ? AND platform = ?").bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062E\u0628\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = newsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const sets = [];
  const values = [];
  const assign = /* @__PURE__ */ __name((column, value) => {
    sets.push(`${column} = ?`);
    values.push(value);
  }, "assign");
  if (d.title !== void 0)
    assign("title", d.title);
  if (d.body !== void 0)
    assign("body", d.body);
  if (d.image_url !== void 0)
    assign("image_url", d.image_url);
  if (d.sort_order !== void 0)
    assign("sort_order", d.sort_order);
  if (d.published_at !== void 0)
    assign("published_at", d.published_at);
  if (d.is_published !== void 0) {
    assign("is_published", d.is_published ? 1 : 0);
    if (d.is_published && d.published_at === void 0) {
      assign("published_at", (/* @__PURE__ */ new Date()).toISOString());
    }
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    await c.env.DB.prepare(`UPDATE news SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  const updated = await c.env.DB.prepare("SELECT * FROM news WHERE id = ?").bind(id).first();
  return c.json({ ok: true, news: updated });
});
news.delete("/admin/news/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf3(c.env);
  const existing = await c.env.DB.prepare("SELECT id FROM news WHERE id = ? AND platform = ?").bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062E\u0628\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM news WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
var news_default = news;

// src/routes/purchases.ts
var purchases = new Hono2();
purchases.use("/admin/*", requireAuth);
var platformOf4 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
function describeTarget(targetType, title) {
  const label = targetType === "exam" ? "\u0627\u0645\u062A\u062D\u0627\u0646" : targetType === "bundle" ? "\u0628\u0627\u0642\u0629" : "\u0645\u0642\u0631\u0631";
  return `\u0634\u0631\u0627\u0621 ${label}: ${title || "\u2014"}`;
}
__name(describeTarget, "describeTarget");
async function resolveTargetTitle(env, request) {
  if (request.target_type === "exam" && request.exam_id) {
    const row = await env.DB.prepare("SELECT title FROM quizzes WHERE id = ?").bind(request.exam_id).first();
    return row?.title ?? null;
  }
  if (request.target_type === "course" && request.course_id) {
    const row = await env.DB.prepare("SELECT title FROM courses WHERE id = ?").bind(request.course_id).first();
    return row?.title ?? null;
  }
  if (request.target_type === "bundle" && request.bundle_id) {
    const row = await env.DB.prepare("SELECT title FROM bundles WHERE id = ?").bind(request.bundle_id).first();
    return row?.title ?? null;
  }
  return null;
}
__name(resolveTargetTitle, "resolveTargetTitle");
purchases.get("/purchases/catalog", requireAuth, async (c) => {
  const platform = platformOf4(c.env);
  const { results: bundleRows } = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, price, is_price_hidden, reference_price
     FROM bundles WHERE platform = ? AND is_published = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();
  const { results: courseRows } = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, price, is_free
     FROM courses WHERE platform = ? AND is_published = 1 AND is_archived = 0
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();
  return c.json({
    bundles: bundleRows,
    courses: courseRows,
    currency: "\u062C\u0646\u064A\u0647",
    labels: { ...PURCHASE_LABELS, ...ACCESS_LABELS }
  });
});
var createSchema = external_exports.object({
  target_type: external_exports.enum(["exam", "course", "bundle"]),
  exam_id: external_exports.string().min(1).optional(),
  course_id: external_exports.string().min(1).optional(),
  bundle_id: external_exports.string().min(1).optional(),
  transfer_image_url: external_exports.string().min(1).max(1e3)
});
purchases.post("/purchases", requireAuth, rateLimit("purchase_create", 10, 300), async (c) => {
  const user = c.get("user");
  const platform = platformOf4(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  let amount = 0;
  let examId = null;
  let courseId = null;
  let bundleId = null;
  let targetTitle = null;
  if (d.target_type === "exam") {
    if (!d.exam_id)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0645\u0637\u0644\u0648\u0628" } }, 400);
    const exam = await c.env.DB.prepare(
      `SELECT q.id, q.title, q.price, q.course_id FROM quizzes q
       INNER JOIN courses c ON c.id = q.course_id
       WHERE q.id = ? AND c.platform = ?`
    ).bind(d.exam_id, platform).first();
    if (!exam)
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    examId = exam.id;
    amount = exam.price || 0;
    targetTitle = exam.title;
  } else if (d.target_type === "course") {
    if (!d.course_id)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0642\u0631\u0631 \u0645\u0637\u0644\u0648\u0628" } }, 400);
    const course = await c.env.DB.prepare(
      "SELECT id, title, price FROM courses WHERE id = ? AND platform = ? AND is_archived = 0"
    ).bind(d.course_id, platform).first();
    if (!course)
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0642\u0631\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
    courseId = course.id;
    amount = course.price || 0;
    targetTitle = course.title;
  } else {
    if (!d.bundle_id)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0628\u0627\u0642\u0629 \u0645\u0637\u0644\u0648\u0628" } }, 400);
    const bundle = await c.env.DB.prepare(
      "SELECT id, title, price FROM bundles WHERE id = ? AND platform = ?"
    ).bind(d.bundle_id, platform).first();
    if (!bundle)
      return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
    bundleId = bundle.id;
    amount = bundle.price || 0;
    targetTitle = bundle.title;
  }
  const duplicate = await c.env.DB.prepare(
    `SELECT id, status FROM purchase_requests
     WHERE student_id = ? AND platform = ?
       AND target_type = ?
       AND COALESCE(exam_id, '') = COALESCE(?, '')
       AND COALESCE(course_id, '') = COALESCE(?, '')
       AND COALESCE(bundle_id, '') = COALESCE(?, '')
       AND status IN ('pending', 'approved')
     LIMIT 1`
  ).bind(user.id, platform, d.target_type, examId, courseId, bundleId).first();
  if (duplicate) {
    return c.json({
      error: {
        code: duplicate.status === "approved" ? "ALREADY_PURCHASED" : "ALREADY_PENDING",
        message: duplicate.status === "approved" ? "\u0644\u0642\u062F \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0628\u0627\u0644\u0641\u0639\u0644" : "\u0644\u062F\u064A\u0643 \u0637\u0644\u0628 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062D\u062A\u0648\u0649"
      }
    }, 409);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO purchase_requests
       (id, platform, student_id, target_type, exam_id, course_id, bundle_id, amount, transfer_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
  ).bind(id, platform, user.id, d.target_type, examId, courseId, bundleId, amount, d.transfer_image_url).run();
  const created = await c.env.DB.prepare("SELECT * FROM purchase_requests WHERE id = ?").bind(id).first();
  return c.json({ ok: true, purchase_request: created, labels: PURCHASE_LABELS }, 201);
});
purchases.get("/purchases", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf4(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT pr.*,
            q.title  AS exam_title,
            co.title AS course_title,
            b.title  AS bundle_title
     FROM purchase_requests pr
     LEFT JOIN quizzes q  ON q.id = pr.exam_id
     LEFT JOIN courses co ON co.id = pr.course_id
     LEFT JOIN bundles b  ON b.id = pr.bundle_id
     WHERE pr.student_id = ? AND pr.platform = ?
     ORDER BY pr.created_at DESC`
  ).bind(user.id, platform).all();
  return c.json({
    purchases: results.map((row) => ({
      ...row,
      target_title: row.exam_title || row.course_title || row.bundle_title || null,
      status_label: row.status === "approved" ? PURCHASE_LABELS.approved : row.status === "rejected" ? PURCHASE_LABELS.rejected : PURCHASE_LABELS.pending
    })),
    currency: "\u062C\u0646\u064A\u0647",
    labels: PURCHASE_LABELS
  });
});
purchases.get("/admin/purchase-requests", requireRole("admin"), async (c) => {
  const platform = platformOf4(c.env);
  const status = c.req.query("status");
  const where = ["pr.platform = ?"];
  const binds = [platform];
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.push("pr.status = ?");
    binds.push(status);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT pr.*,
            p.full_name AS student_name, p.email AS student_email, p.phone AS student_phone, p.student_code,
            q.title  AS exam_title,
            co.title AS course_title,
            b.title  AS bundle_title
     FROM purchase_requests pr
     INNER JOIN profiles p ON p.id = pr.student_id
     LEFT JOIN quizzes q  ON q.id = pr.exam_id
     LEFT JOIN courses co ON co.id = pr.course_id
     LEFT JOIN bundles b  ON b.id = pr.bundle_id
     WHERE ${where.join(" AND ")}
     ORDER BY CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END, pr.created_at DESC`
  ).bind(...binds).all();
  const pendingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM purchase_requests WHERE platform = ? AND status = 'pending'"
  ).bind(platform).first();
  return c.json({
    purchase_requests: results.map((row) => ({
      ...row,
      target_title: row.exam_title || row.course_title || row.bundle_title || null
    })),
    pending_count: pendingCount?.count ?? 0,
    dashboard_card: PURCHASE_LABELS.dashboard_card
  });
});
purchases.post("/admin/purchase-requests/:id/approve", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const admin2 = c.get("user");
  const platform = platformOf4(c.env);
  const request = await c.env.DB.prepare(
    "SELECT * FROM purchase_requests WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (request.status === "approved") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u0633\u0628\u0642\u0627\u064B" } }, 400);
  }
  const statements = [];
  const now = "datetime('now')";
  const courseIdsToEnroll = [];
  if (request.target_type === "course" && request.course_id) {
    courseIdsToEnroll.push(request.course_id);
  } else if (request.target_type === "bundle" && request.bundle_id) {
    const { results } = await c.env.DB.prepare(
      "SELECT course_id FROM bundle_courses WHERE bundle_id = ?"
    ).bind(request.bundle_id).all();
    courseIdsToEnroll.push(...results.map((r) => r.course_id));
  }
  for (const courseId of courseIdsToEnroll) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO enrollments (id, student_id, course_id, source, status, granted_at, created_at, platform)
         VALUES (?, ?, ?, 'manual', 'active', ${now}, ${now}, ?)
         ON CONFLICT(student_id, course_id) DO UPDATE SET status = 'active', granted_at = ${now}`
      ).bind(generateId(), request.student_id, courseId, platform)
    );
  }
  const targetTitle = await resolveTargetTitle(c.env, request);
  const transactionId = generateId();
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO financial_transactions (id, student_id, course_id, amount, transaction_type, code_id, note, created_at)
       VALUES (?, ?, ?, ?, 'online_payment', NULL, ?, ${now})`
    ).bind(
      transactionId,
      request.student_id,
      request.course_id || null,
      request.amount || 0,
      describeTarget(request.target_type, targetTitle)
    )
  );
  statements.push(
    c.env.DB.prepare(
      `UPDATE purchase_requests
       SET status = 'approved', reviewed_by = ?, reviewed_at = ${now}, rejection_reason = NULL, updated_at = ${now}
       WHERE id = ?`
    ).bind(admin2.id, id)
  );
  await c.env.DB.batch(statements);
  const updated = await c.env.DB.prepare("SELECT * FROM purchase_requests WHERE id = ?").bind(id).first();
  return c.json({ ok: true, purchase_request: updated, transaction_id: transactionId, enrolled_courses: courseIdsToEnroll.length });
});
purchases.post("/admin/purchase-requests/:id/reject", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const admin2 = c.get("user");
  const platform = platformOf4(c.env);
  const body = await c.req.json().catch(() => ({}));
  const parsed = external_exports.object({ rejection_reason: external_exports.string().trim().min(2).max(1e3) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636 \u0645\u0637\u0644\u0648\u0628", details: parsed.error.flatten() } }, 400);
  }
  const request = await c.env.DB.prepare(
    "SELECT id, status FROM purchase_requests WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (request.status === "approved") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0631\u0641\u0636 \u0637\u0644\u0628 \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u064A\u0647" } }, 400);
  }
  await c.env.DB.prepare(
    `UPDATE purchase_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), rejection_reason = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(admin2.id, parsed.data.rejection_reason, id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM purchase_requests WHERE id = ?").bind(id).first();
  return c.json({ ok: true, purchase_request: updated });
});
var purchases_default = purchases;

// src/routes/examBuilds.ts
var examBuilds = new Hono2();
examBuilds.use("/admin/*", requireAuth);
var platformOf5 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var EXAM_BUILD_PRICE_MAP = {
  5: 10,
  10: 15,
  15: 20,
  20: 25
};
var EXAM_BUILD_QUESTION_COUNTS = [5, 10, 15, 20];
var EXAM_BUILD_DURATIONS = [15, 30, 45, 60, 90, 120];
function priceForQuestionCount(count) {
  return Object.prototype.hasOwnProperty.call(EXAM_BUILD_PRICE_MAP, count) ? EXAM_BUILD_PRICE_MAP[count] : null;
}
__name(priceForQuestionCount, "priceForQuestionCount");
var EXAM_BUILD_LABELS = {
  entry_button: "\u0623\u0646\u0634\u0626 \u0627\u0645\u062A\u062D\u0627\u0646\u0643",
  title: "\u0623\u0646\u0634\u0626 \u0627\u0645\u062A\u062D\u0627\u0646\u0643",
  q_duration: "\u0623\u0647\u0644\u0627\u064B! \u0643\u0645 \u0645\u062F\u0629 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u0627\u0644\u0644\u064A \u0639\u0627\u064A\u0632\u0647\u061F \u{1F44B}",
  q_question_count: "\u0643\u0645 \u0633\u0624\u0627\u0644 \u062A\u062D\u0628 \u062A\u0643\u0648\u0646 \u0641\u064A \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646\u061F",
  q_sections: "\u0623\u064A \u0623\u0642\u0633\u0627\u0645 \u062A\u062D\u0628 \u062A\u0634\u0645\u0644\u0647\u0645\u061F",
  q_chapters: "\u0623\u064A \u0641\u0635\u0648\u0644 \u062A\u062D\u0628 \u062A\u0634\u0645\u0644\u0647\u0645\u061F",
  q_title: "\u0639\u0646\u0648\u0627\u0646 \u0648\u0648\u0635\u0641 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646\u060C \u0648\u0647\u064A\u0643\u0648\u0646 \u0645\u062F\u0641\u0648\u0639\u061F",
  option_duration: "{n} \u062F\u0642\u064A\u0642\u0629",
  option_question_count: "{n} \u0633\u0624\u0627\u0644",
  loading_sections: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0623\u0642\u0633\u0627\u0645...",
  loading_chapters: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0641\u0635\u0648\u0644...",
  empty_sections: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0642\u0633\u0627\u0645 \u0645\u062A\u0627\u062D\u0629",
  empty_chapters: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0635\u0648\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u0623\u0642\u0633\u0627\u0645",
  form_title: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646",
  form_description: "\u0648\u0635\u0641 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)",
  form_price: "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: {n} \u062C\u0646\u064A\u0647",
  form_transfer_image: "\u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644",
  image_selected: "\u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629",
  image_remove: "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0635\u0648\u0631\u0629",
  back: "\u0631\u062C\u0648\u0639",
  next: "\u0627\u0644\u062A\u0627\u0644\u064A",
  create: "\u0623\u0646\u0634\u0626 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646",
  error_title_required: "\u0623\u062F\u062E\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646",
  error_image_required: "\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644",
  error_sections_failed: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0648\u0627\u062F. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.",
  error_pick_failed: "\u0641\u0634\u0644 \u0641\u064A \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629",
  success_title: "\u062A\u0645\u0627\u0645! \u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632 \u0648\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u2705",
  success_subtitle: "\u0633\u0646\u064F\u0639\u062F\u0651 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646 \u062D\u0633\u0628 \u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A\u0643 \u0642\u0631\u064A\u0628\u0627\u064B",
  currency: "\u062C\u0646\u064A\u0647"
};
function parseIdArray(raw2) {
  if (!raw2)
    return [];
  try {
    const parsed = JSON.parse(raw2);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
__name(parseIdArray, "parseIdArray");
examBuilds.get("/exam-builds/options", requireAuth, async (c) => {
  return c.json({
    duration_options: EXAM_BUILD_DURATIONS.map((n) => ({ minutes: n, label: `${n} \u062F\u0642\u064A\u0642\u0629` })),
    question_count_options: EXAM_BUILD_QUESTION_COUNTS.map((n) => ({
      question_count: n,
      price: EXAM_BUILD_PRICE_MAP[n],
      label: `${n} \u0633\u0624\u0627\u0644`,
      price_label: `\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${EXAM_BUILD_PRICE_MAP[n]} \u062C\u0646\u064A\u0647`
    })),
    currency: "\u062C\u0646\u064A\u0647",
    labels: EXAM_BUILD_LABELS
  });
});
examBuilds.get("/exam-builds/sections", requireAuth, async (c) => {
  const platform = platformOf5(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.title, COUNT(q.id) AS question_count
     FROM courses c
     INNER JOIN question_bank q ON q.course_id = c.id AND q.is_archived = 0
     WHERE c.platform = ? AND c.is_archived = 0
     GROUP BY c.id, c.title
     HAVING COUNT(q.id) > 0
     ORDER BY c.title ASC`
  ).bind(platform).all();
  return c.json({
    sections: results,
    empty_text: EXAM_BUILD_LABELS.empty_sections,
    loading_text: EXAM_BUILD_LABELS.loading_sections
  });
});
examBuilds.get("/exam-builds/chapters", requireAuth, async (c) => {
  const platform = platformOf5(c.env);
  const sectionIds = (c.req.query("section_ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (sectionIds.length === 0) {
    return c.json({
      chapters: [],
      empty_text: EXAM_BUILD_LABELS.empty_chapters,
      loading_text: EXAM_BUILD_LABELS.loading_chapters
    });
  }
  const placeholders = sectionIds.map(() => "?").join(",");
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.title, l.course_id, COUNT(q.id) AS question_count
     FROM lessons l
     INNER JOIN question_bank q ON q.lesson_id = l.id AND q.is_archived = 0
     WHERE l.course_id IN (${placeholders}) AND q.platform = ?
     GROUP BY l.id, l.title, l.course_id
     HAVING COUNT(q.id) > 0
     ORDER BY l.title ASC`
  ).bind(...sectionIds, platform).all();
  return c.json({
    chapters: results,
    empty_text: EXAM_BUILD_LABELS.empty_chapters,
    loading_text: EXAM_BUILD_LABELS.loading_chapters
  });
});
var createSchema2 = external_exports.object({
  title: external_exports.string().trim().min(2).max(200),
  description: external_exports.string().max(2e3).optional().nullable(),
  duration_minutes: external_exports.number().int().min(5).max(240),
  question_count: external_exports.union([external_exports.literal(5), external_exports.literal(10), external_exports.literal(15), external_exports.literal(20)]),
  section_ids: external_exports.array(external_exports.string().min(1)).max(50).optional(),
  chapter_ids: external_exports.array(external_exports.string().min(1)).max(200).optional(),
  transfer_image_url: external_exports.string().min(1).max(1e3)
});
examBuilds.post("/exam-builds", requireAuth, rateLimit("exam_build_create", 10, 300), async (c) => {
  const user = c.get("user");
  const platform = platformOf5(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema2.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const price = priceForQuestionCount(d.question_count);
  if (price === null) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0639\u062F\u062F \u0623\u0633\u0626\u0644\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" } }, 400);
  }
  const sectionIds = (d.section_ids || []).slice(0, 50);
  const chapterIds = (d.chapter_ids || []).slice(0, 200);
  const available = await countAvailableQuestions(c.env, platform, sectionIds, chapterIds);
  if (available < d.question_count) {
    return c.json({
      error: {
        code: "NOT_ENOUGH_QUESTIONS",
        message: `\u0639\u062F\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 (${available}) \u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 (${d.question_count})`
      }
    }, 400);
  }
  const pending = await c.env.DB.prepare(
    "SELECT id FROM exam_build_requests WHERE student_id = ? AND platform = ? AND status = 'pending' LIMIT 1"
  ).bind(user.id, platform).first();
  if (pending) {
    return c.json({ error: { code: "ALREADY_PENDING", message: "\u0644\u062F\u064A\u0643 \u0637\u0644\u0628 \u0627\u0645\u062A\u062D\u0627\u0646 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0628\u0627\u0644\u0641\u0639\u0644" } }, 409);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO exam_build_requests
       (id, platform, student_id, title, description, duration_minutes, question_count,
        section_ids_json, chapter_ids_json, price, transfer_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
  ).bind(
    id,
    platform,
    user.id,
    d.title,
    d.description ?? null,
    d.duration_minutes,
    d.question_count,
    JSON.stringify(sectionIds),
    JSON.stringify(chapterIds),
    price,
    d.transfer_image_url
  ).run();
  const created = await c.env.DB.prepare("SELECT * FROM exam_build_requests WHERE id = ?").bind(id).first();
  return c.json({
    ok: true,
    exam_build_request: created,
    success_title: EXAM_BUILD_LABELS.success_title,
    success_subtitle: EXAM_BUILD_LABELS.success_subtitle
  }, 201);
});
examBuilds.get("/exam-builds", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf5(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM exam_build_requests
     WHERE student_id = ? AND platform = ?
     ORDER BY created_at DESC`
  ).bind(user.id, platform).all();
  return c.json({ exam_build_requests: results, currency: "\u062C\u0646\u064A\u0647" });
});
examBuilds.get("/admin/exam-build-requests", requireRole("admin"), async (c) => {
  const platform = platformOf5(c.env);
  const status = c.req.query("status");
  const where = ["ebr.platform = ?"];
  const binds = [platform];
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.push("ebr.status = ?");
    binds.push(status);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ebr.*, p.full_name AS student_name, p.email AS student_email, p.phone AS student_phone, p.student_code
     FROM exam_build_requests ebr
     INNER JOIN profiles p ON p.id = ebr.student_id
     WHERE ${where.join(" AND ")}
     ORDER BY CASE ebr.status WHEN 'pending' THEN 0 ELSE 1 END, ebr.created_at DESC`
  ).bind(...binds).all();
  const pendingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM exam_build_requests WHERE platform = ? AND status = 'pending'"
  ).bind(platform).first();
  return c.json({
    exam_build_requests: results.map((row) => ({
      ...row,
      section_ids: parseIdArray(row.section_ids_json),
      chapter_ids: parseIdArray(row.chapter_ids_json)
    })),
    pending_count: pendingCount?.count ?? 0
  });
});
examBuilds.post("/admin/exam-build-requests/:id/approve", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const admin2 = c.get("user");
  const platform = platformOf5(c.env);
  const request = await c.env.DB.prepare(
    "SELECT * FROM exam_build_requests WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (request.status === "approved") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u0633\u0628\u0642\u0627\u064B" } }, 400);
  }
  const sectionIds = parseIdArray(request.section_ids_json);
  const chapterIds = parseIdArray(request.chapter_ids_json);
  const questionCount = request.question_count;
  const bankQuestions = await sampleBankQuestions(c.env, platform, sectionIds, chapterIds, questionCount);
  if (bankQuestions.length === 0) {
    return c.json({ error: { code: "NO_QUESTIONS", message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0633\u0626\u0644\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0637\u0627\u0644\u0628 \u0641\u064A \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629" } }, 400);
  }
  const quizId = generateId();
  const now = "datetime('now')";
  const firstCourseId = bankQuestions[0]?.course_id || sectionIds[0] || null;
  const maxScore = bankQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
  const statements = [];
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO quizzes
         (id, course_id, lesson_id, title, max_score, is_published, sort_order,
          randomize_questions, is_free, price, is_custom, time_limit_mins, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, 1, 0, 0, 0, ?, 1, ?, ${now}, ${now})`
    ).bind(
      quizId,
      firstCourseId,
      request.title,
      maxScore,
      request.price || 0,
      request.duration_minutes || 30
    )
  );
  bankQuestions.forEach((q, index) => {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO quiz_questions
           (id, quiz_id, question_text, image_url, options_json, correct_option, score, sort_order, explanation, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${now}, ${now})`
      ).bind(
        generateId(),
        quizId,
        q.question_text,
        q.image_url,
        q.options_json,
        q.correct_option,
        q.score,
        index,
        q.explanation
      )
    );
  });
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO purchase_requests
         (id, platform, student_id, target_type, exam_id, course_id, bundle_id, amount, transfer_image_url, status, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'exam', ?, NULL, NULL, ?, ?, 'approved', ?, ${now}, ${now}, ${now})`
    ).bind(
      generateId(),
      platform,
      request.student_id,
      quizId,
      request.price || 0,
      request.transfer_image_url,
      admin2.id
    )
  );
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO financial_transactions (id, student_id, course_id, amount, transaction_type, code_id, note, created_at)
       VALUES (?, ?, ?, ?, 'online_payment', NULL, ?, ${now})`
    ).bind(
      generateId(),
      request.student_id,
      firstCourseId,
      request.price || 0,
      `\u0637\u0644\u0628 \u0627\u0645\u062A\u062D\u0627\u0646 \u0645\u062E\u0635\u0635: ${request.title}`
    )
  );
  statements.push(
    c.env.DB.prepare(
      `UPDATE exam_build_requests
       SET status = 'approved', generated_quiz_id = ?, reviewed_by = ?, reviewed_at = ${now}, updated_at = ${now}
       WHERE id = ?`
    ).bind(quizId, admin2.id, id)
  );
  await c.env.DB.batch(statements);
  const updated = await c.env.DB.prepare("SELECT * FROM exam_build_requests WHERE id = ?").bind(id).first();
  return c.json({
    ok: true,
    exam_build_request: updated,
    generated_quiz_id: quizId,
    generated_questions: bankQuestions.length,
    max_score: maxScore
  });
});
examBuilds.post("/admin/exam-build-requests/:id/reject", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const admin2 = c.get("user");
  const platform = platformOf5(c.env);
  const body = await c.req.json().catch(() => ({}));
  const parsed = external_exports.object({
    admin_notes: external_exports.string().trim().min(2).max(1e3)
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636 \u0645\u0637\u0644\u0648\u0628", details: parsed.error.flatten() } }, 400);
  }
  const request = await c.env.DB.prepare(
    "SELECT id, status FROM exam_build_requests WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  if (request.status === "approved") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0631\u0641\u0636 \u0637\u0644\u0628 \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u064A\u0647" } }, 400);
  }
  await c.env.DB.prepare(
    `UPDATE exam_build_requests
     SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).bind(parsed.data.admin_notes, admin2.id, id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM exam_build_requests WHERE id = ?").bind(id).first();
  return c.json({ ok: true, exam_build_request: updated });
});
function buildBankWhere(platform, sectionIds, chapterIds) {
  const where = ["q.platform = ?", "q.is_archived = 0", "q.type IN ('mcq', 'true_false', 'short_answer', 'fill_blank')"];
  const binds = [platform];
  if (sectionIds.length > 0) {
    where.push(`q.course_id IN (${sectionIds.map(() => "?").join(",")})`);
    binds.push(...sectionIds);
  }
  if (chapterIds.length > 0) {
    where.push(`q.lesson_id IN (${chapterIds.map(() => "?").join(",")})`);
    binds.push(...chapterIds);
  }
  return { where, binds };
}
__name(buildBankWhere, "buildBankWhere");
async function countAvailableQuestions(env, platform, sectionIds, chapterIds) {
  const { where, binds } = buildBankWhere(platform, sectionIds, chapterIds);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM question_bank q WHERE ${where.join(" AND ")}`
  ).bind(...binds).first();
  return row?.count ?? 0;
}
__name(countAvailableQuestions, "countAvailableQuestions");
async function sampleBankQuestions(env, platform, sectionIds, chapterIds, limit) {
  const { where, binds } = buildBankWhere(platform, sectionIds, chapterIds);
  const { results } = await env.DB.prepare(
    `SELECT q.id, q.course_id, q.type, q.question_text, q.image_url, q.options_json,
            q.correct_answer_json, q.explanation, q.points
     FROM question_bank q
     WHERE ${where.join(" AND ")}
     ORDER BY RANDOM()
     LIMIT ?`
  ).bind(...binds, limit).all();
  const generated = [];
  for (const row of results) {
    const mapped = mapBankQuestionToQuizQuestion(row);
    if (mapped)
      generated.push(mapped);
  }
  return generated;
}
__name(sampleBankQuestions, "sampleBankQuestions");
function safeParse(raw2) {
  if (!raw2)
    return null;
  try {
    return JSON.parse(raw2);
  } catch {
    return null;
  }
}
__name(safeParse, "safeParse");
function mapBankQuestionToQuizQuestion(row) {
  const key = safeParse(row.correct_answer_json) || {};
  const options = safeParse(row.options_json);
  const score = Number.isFinite(row.points) ? Math.max(1, Math.trunc(row.points)) : 1;
  const base = {
    image_url: row.image_url ?? null,
    score,
    explanation: row.explanation ?? null,
    course_id: row.course_id ?? null,
    question_text: row.question_text ?? ""
  };
  if (row.type === "mcq") {
    if (!Array.isArray(options) || options.length === 0)
      return null;
    const index = typeof key.option_index === "number" ? key.option_index : null;
    const text2 = index !== null && typeof options[index] === "string" ? options[index] : typeof key.option_text === "string" ? key.option_text : null;
    if (!text2)
      return null;
    return { ...base, options_json: JSON.stringify(options), correct_option: text2 };
  }
  if (row.type === "true_false") {
    const value = typeof key.value === "boolean" ? key.value : null;
    if (value === null)
      return null;
    return {
      ...base,
      options_json: JSON.stringify(["\u0635\u062D", "\u062E\u0637\u0623"]),
      correct_option: value ? "\u0635\u062D" : "\u062E\u0637\u0623"
    };
  }
  const text = typeof key.text === "string" ? key.text : null;
  if (!text)
    return null;
  return {
    ...base,
    options_json: JSON.stringify(options && Array.isArray(options) ? options : []),
    correct_option: text
  };
}
__name(mapBankQuestionToQuizQuestion, "mapBankQuestionToQuizQuestion");
var examBuilds_default = examBuilds;

// src/routes/mistakes.ts
var mistakes = new Hono2();
mistakes.use("/admin/*", requireAuth);
var platformOf6 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var MISTAKE_LABELS = {
  title: "\u0627\u0644\u0623\u062E\u0637\u0627\u0621",
  subtitle: "{n} \u062E\u0637\u0623 \u062A\u0645 \u062A\u0633\u062C\u064A\u0644\u0647",
  export_pdf: "\u062A\u0635\u062F\u064A\u0631 PDF",
  empty_title: "\u0645\u0645\u062A\u0627\u0632! \u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u062E\u0637\u0627\u0621",
  empty_subtitle: "\u0627\u0633\u062A\u0645\u0631 \u0641\u064A \u0627\u0644\u0645\u0630\u0627\u0643\u0631\u0629 \u0648\u0627\u0644\u062A\u062F\u0631\u064A\u0628",
  your_answer: "\u0625\u062C\u0627\u0628\u062A\u0643",
  correct_answer: "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629",
  loading: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0623\u062E\u0637\u0627\u0621...",
  load_error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0623\u062E\u0637\u0627\u0621",
  mark_resolved: "\u062A\u0639\u0644\u064A\u0645 \u0643\u0645\u062D\u0644\u0648\u0644",
  delete: "\u062D\u0630\u0641",
  report: {
    title: "\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621",
    subtitle: "\u0645\u0644\u062E\u0635 \u0634\u0627\u0645\u0644 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0641\u064A \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A",
    generated_at: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u0631\u064A\u0631:",
    total_mistakes: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u062E\u0637\u0627\u0621:",
    total_points_lost: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0641\u0642\u0648\u062F\u0629:",
    mistake_index: "\u062E\u0637\u0623 #{i}",
    points_lost: "-{n} \u0646\u0642\u0637\u0629",
    footer: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u062B\u0627\u0646\u0648\u064A\u0629 \u0639\u0627\u0645\u0629",
    export_action: "\u062A\u0635\u062F\u064A\u0631 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621",
    error_empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u062E\u0637\u0627\u0621 \u0644\u062A\u0635\u062F\u064A\u0631\u0647\u0627",
    generating: "\u062C\u0627\u0631\u064A \u0627\u0644\u0625\u0646\u0634\u0627\u0621...",
    please_wait: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
    success: "\u062A\u0645 \u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0628\u0646\u062C\u0627\u062D",
    error_failed: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0625\u0646\u0634\u0627\u0621 PDF"
  }
};
var COMMON_MISTAKE_LABELS = {
  title: "\u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0634\u0627\u0626\u0639\u0629",
  subtitle: "\u062A\u0639\u0631\u0651\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0645\u062A\u0643\u0631\u0631\u0629 \u0641\u064A \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u0648\u0643\u064A\u0641\u064A\u0629 \u062A\u062C\u0646\u0628\u0647\u0627",
  loading: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0634\u0627\u0626\u0639\u0629...",
  load_error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u062D\u062A\u0648\u0649",
  empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u062E\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B"
};
mistakes.get("/me/mistakes", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf6(c.env);
  const onlyUnresolved = c.req.query("unresolved") === "1";
  const where = ["student_id = ?", "platform = ?"];
  const binds = [user.id, platform];
  if (onlyUnresolved)
    where.push("is_resolved = 0");
  const { results } = await c.env.DB.prepare(
    `SELECT id, question_id, question_source, quiz_id, exam_id, question_text,
            given_answer, correct_answer, points_lost, is_resolved, resolved_at, created_at
     FROM student_mistakes
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC`
  ).bind(...binds).all();
  const list = results;
  const stats = {
    total_mistakes: list.length,
    unresolved_count: list.filter((m) => m.is_resolved === 0).length,
    total_points_lost: list.reduce((sum, m) => sum + (m.points_lost || 0), 0)
  };
  return c.json({
    mistakes: list,
    stats: {
      ...stats,
      header: `${stats.total_mistakes} \u062E\u0637\u0623 \u062A\u0645 \u062A\u0633\u062C\u064A\u0644\u0647`,
      points_lost_label: `${stats.total_points_lost} \u0646\u0642\u0637\u0629`
    },
    labels: MISTAKE_LABELS
  });
});
mistakes.patch("/me/mistakes/:id/resolve", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const platform = platformOf6(c.env);
  const body = await c.req.json().catch(() => ({}));
  const parsed = external_exports.object({ is_resolved: external_exports.boolean().optional() }).safeParse(body);
  const isResolved = parsed.success && parsed.data.is_resolved === false ? 0 : 1;
  const existing = await c.env.DB.prepare(
    "SELECT id FROM student_mistakes WHERE id = ? AND student_id = ? AND platform = ?"
  ).bind(id, user.id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare(
    `UPDATE student_mistakes
     SET is_resolved = ?, resolved_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
     WHERE id = ?`
  ).bind(isResolved, isResolved, id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM student_mistakes WHERE id = ?").bind(id).first();
  return c.json({ ok: true, mistake: updated });
});
mistakes.delete("/me/mistakes/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const platform = platformOf6(c.env);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM student_mistakes WHERE id = ? AND student_id = ? AND platform = ?"
  ).bind(id, user.id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM student_mistakes WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
mistakes.delete("/me/mistakes", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf6(c.env);
  await c.env.DB.prepare("DELETE FROM student_mistakes WHERE student_id = ? AND platform = ?").bind(user.id, platform).run();
  return c.json({ ok: true });
});
mistakes.get("/common-mistakes", async (c) => {
  const platform = platformOf6(c.env);
  const subject = c.req.query("subject");
  const where = ["platform = ?", "is_published = 1"];
  const binds = [platform];
  if (subject) {
    where.push("subject = ?");
    binds.push(subject);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, subject, title, content, sort_order
     FROM common_mistakes
     WHERE ${where.join(" AND ")}
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(...binds).all();
  const subjects = [...new Set(results.map((r) => r.subject))];
  return c.json({ common_mistakes: results, subjects, labels: COMMON_MISTAKE_LABELS });
});
mistakes.get("/admin/common-mistakes", requirePermission("can_manage_courses"), async (c) => {
  const platform = platformOf6(c.env);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM common_mistakes WHERE platform = ? ORDER BY subject ASC, sort_order ASC"
  ).bind(platform).all();
  return c.json({ common_mistakes: results });
});
var commonMistakeSchema = external_exports.object({
  subject: external_exports.string().trim().min(1).max(100),
  title: external_exports.string().trim().min(2).max(300),
  content: external_exports.string().max(2e4).optional().nullable(),
  sort_order: external_exports.number().int().min(0).max(1e5).optional(),
  is_published: external_exports.boolean().optional()
});
mistakes.post("/admin/common-mistakes", requirePermission("can_manage_courses"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = commonMistakeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO common_mistakes (id, platform, subject, title, content, sort_order, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platformOf6(c.env),
    d.subject,
    d.title,
    d.content ?? null,
    d.sort_order ?? 0,
    d.is_published ? 1 : 0
  ).run();
  const created = await c.env.DB.prepare("SELECT * FROM common_mistakes WHERE id = ?").bind(id).first();
  return c.json({ ok: true, common_mistake: created }, 201);
});
mistakes.patch("/admin/common-mistakes/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf6(c.env);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM common_mistakes WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0639\u0646\u0635\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = commonMistakeSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const sets = [];
  const values = [];
  const assign = /* @__PURE__ */ __name((column, value) => {
    sets.push(`${column} = ?`);
    values.push(value);
  }, "assign");
  if (d.subject !== void 0)
    assign("subject", d.subject);
  if (d.title !== void 0)
    assign("title", d.title);
  if (d.content !== void 0)
    assign("content", d.content);
  if (d.sort_order !== void 0)
    assign("sort_order", d.sort_order);
  if (d.is_published !== void 0)
    assign("is_published", d.is_published ? 1 : 0);
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    await c.env.DB.prepare(`UPDATE common_mistakes SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  const updated = await c.env.DB.prepare("SELECT * FROM common_mistakes WHERE id = ?").bind(id).first();
  return c.json({ ok: true, common_mistake: updated });
});
mistakes.delete("/admin/common-mistakes/:id", requirePermission("can_manage_courses"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf6(c.env);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM common_mistakes WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0639\u0646\u0635\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM common_mistakes WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
var mistakes_default = mistakes;

// src/routes/points.ts
var points = new Hono2();
points.use("/admin/*", requireAuth);
var platformOf7 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var POINTS_LABELS = {
  level: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 {n}",
  total_points: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0646\u0642\u0627\u0637",
  points: "\u0627\u0644\u0646\u0642\u0627\u0637",
  percentage: "\u0627\u0644\u0646\u0633\u0628\u0629",
  completed_exams: "\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0645\u0643\u062A\u0645\u0644\u0629",
  purchases: "\u0645\u0634\u062A\u0631\u064A\u0627\u062A",
  success_rate: "\u0646\u0633\u0628\u0629 \u0627\u0644\u0646\u062C\u0627\u062D",
  level_up: "\u0627\u0631\u062A\u0642\u064A\u062A \u0645\u0633\u062A\u0648\u0649!",
  empty_history: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0633\u062C\u0644 \u0646\u0642\u0627\u0637",
  tabs: {
    exam_history: "\u0633\u062C\u0644 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A",
    mistakes: "\u0627\u0644\u0623\u062E\u0637\u0627\u0621",
    points: "\u0627\u0644\u0646\u0642\u0627\u0637"
  }
};
var REASON_LABELS = {
  exam_completed: "\u0625\u062A\u0645\u0627\u0645 \u0627\u062E\u062A\u0628\u0627\u0631",
  challenge: "\u062A\u062D\u062F\u064A",
  referral: "\u0625\u062D\u0627\u0644\u0629",
  admin: "\u0645\u0646 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
};
points.get("/me/points", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf7(c.env);
  const state = await getPointsState(c.env, user.id);
  const attempts = await c.env.DB.prepare(
    `SELECT COUNT(*) AS completed,
            COALESCE(AVG(CASE WHEN q.max_score > 0 THEN qa.score * 100.0 / q.max_score ELSE 0 END), 0) AS success_rate
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.student_id = ? AND qa.is_submitted = 1`
  ).bind(user.id).first();
  const purchasesRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM purchase_requests WHERE student_id = ? AND platform = ? AND status = 'approved'"
  ).bind(user.id, platform).first();
  const { results: history } = await c.env.DB.prepare(
    `SELECT id, points, reason, reference_id, note, created_at
     FROM points_ledger
     WHERE student_id = ? AND platform = ?
     ORDER BY created_at DESC
     LIMIT 100`
  ).bind(user.id, platform).all();
  const completed = attempts?.completed ?? 0;
  const successRate = Math.round(attempts?.success_rate ?? 0);
  return c.json({
    level: state.level,
    total_points: state.total_points,
    points_to_next_level: Math.max(0, state.level * POINTS_PER_LEVEL - state.total_points),
    stats: {
      completed_exams: completed,
      purchases: purchasesRow?.count ?? 0,
      success_rate: successRate
    },
    history: history.map((row) => ({
      ...row,
      reason_label: REASON_LABELS[row.reason] || row.reason
    })),
    labels: POINTS_LABELS
  });
});
points.post("/admin/students/:id/points", requireRole("admin"), async (c) => {
  const studentId = c.req.param("id");
  const platform = platformOf7(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = external_exports.object({
    points: external_exports.number().int().min(-1e5).max(1e5),
    note: external_exports.string().trim().max(500).optional()
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const student = await c.env.DB.prepare(
    "SELECT id FROM profiles WHERE id = ? AND platform = ? AND role = 'student'"
  ).bind(studentId, platform).first();
  if (!student) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const result = await awardPoints(c.env, studentId, parsed.data.points, "admin", {
    note: parsed.data.note ?? null
  });
  return c.json({ ok: true, ...result });
});
points.get("/admin/students/:id/points", requireRole("admin"), async (c) => {
  const studentId = c.req.param("id");
  const platform = platformOf7(c.env);
  const student = await c.env.DB.prepare(
    "SELECT id, points, level FROM profiles WHERE id = ? AND platform = ?"
  ).bind(studentId, platform).first();
  if (!student) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, points, reason, reference_id, note, created_at
     FROM points_ledger WHERE student_id = ? AND platform = ?
     ORDER BY created_at DESC LIMIT 200`
  ).bind(studentId, platform).all();
  return c.json({
    total_points: student.points,
    level: student.level,
    history: results,
    labels: POINTS_LABELS
  });
});
var points_default = points;

// src/routes/wallets.ts
var wallets = new Hono2();
wallets.use("/admin/*", requireAuth);
var platformOf8 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var WALLET_LABELS = {
  section_title: "\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u062F\u0641\u0639",
  active_badge: "\u0646\u0634\u0637",
  transfer_number: "\u0631\u0642\u0645 \u0627\u0644\u062A\u062D\u0648\u064A\u0644",
  empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u062D\u0627\u0641\u0638 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B"
};
var REFERRAL_LABELS = {
  button: "\u062E\u0644\u064A\u0643 \u0634\u0631\u064A\u0643 \u0645\u0639\u0627\u0646\u0627",
  title: "\u062E\u0644\u064A\u0643 \u0634\u0631\u064A\u0643 \u0645\u0639\u0627\u0646\u0627",
  code_label: "\u0643\u0648\u062F \u0627\u0644\u0634\u0631\u064A\u0643",
  description: "\u062A\u0642\u062F\u0631 \u062A\u0628\u0642\u064A \u0634\u0631\u064A\u0643 \u0648\u062A\u0643\u0633\u0628 \u0641\u0644\u0648\u0633 \u0627\u0648 \u0646\u0642\u0627\u0637 \u062A\u0627\u062E\u062F \u0628\u064A\u0647\u0627 \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u0644\u0648 \u0634\u0627\u0631\u0643\u062A \u0627\u0644\u0643\u0648\u062F \u0628\u062A\u0627\u0639\u0643 \u0648 \u062C\u0647 \u0645\u0646 \u062E\u0644\u0627\u0644 \u0637\u0644\u0627\u0628",
  whatsapp: "\u0648\u0627\u062A\u0633\u0627\u0628",
  facebook: "\u0641\u064A\u0633\u0628\u0648\u0643",
  register_field: "\u0643\u0648\u062F \u0627\u0644\u0625\u062D\u0627\u0644\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)",
  uses: "\u0639\u062F\u062F \u0627\u0644\u062A\u0633\u062C\u064A\u0644\u0627\u062A \u0628\u0643\u0648\u062F\u0643",
  points_earned: "\u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0643\u062A\u0633\u0628\u0629"
};
function toArabicDigits(value) {
  if (!value)
    return "";
  const map = {
    "0": "\u0660",
    "1": "\u0661",
    "2": "\u0662",
    "3": "\u0663",
    "4": "\u0664",
    "5": "\u0665",
    "6": "\u0666",
    "7": "\u0667",
    "8": "\u0668",
    "9": "\u0669"
  };
  return value.replace(/[0-9]/g, (d) => map[d]);
}
__name(toArabicDigits, "toArabicDigits");
wallets.get("/payment-wallets", async (c) => {
  const platform = platformOf8(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, phone, sort_order
     FROM payment_wallets
     WHERE platform = ? AND is_active = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();
  return c.json({
    payment_wallets: results.map((w) => ({
      ...w,
      phone_ar: toArabicDigits(w.phone),
      is_active_label: WALLET_LABELS.active_badge
    })),
    labels: WALLET_LABELS
  });
});
wallets.get("/admin/payment-wallets", requireRole("admin"), async (c) => {
  const platform = platformOf8(c.env);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM payment_wallets WHERE platform = ? ORDER BY sort_order ASC, created_at ASC"
  ).bind(platform).all();
  return c.json({ payment_wallets: results, labels: WALLET_LABELS });
});
var walletSchema = external_exports.object({
  name: external_exports.string().trim().min(2).max(100),
  phone: external_exports.string().trim().min(3).max(30),
  is_active: external_exports.boolean().optional(),
  sort_order: external_exports.number().int().min(0).max(1e5).optional()
});
wallets.post("/admin/payment-wallets", requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = walletSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO payment_wallets (id, platform, name, phone, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platformOf8(c.env),
    d.name,
    d.phone,
    d.is_active === false ? 0 : 1,
    d.sort_order ?? 0
  ).run();
  const created = await c.env.DB.prepare("SELECT * FROM payment_wallets WHERE id = ?").bind(id).first();
  return c.json({ ok: true, payment_wallet: created }, 201);
});
wallets.patch("/admin/payment-wallets/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf8(c.env);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM payment_wallets WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = walletSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const sets = [];
  const values = [];
  const assign = /* @__PURE__ */ __name((column, value) => {
    sets.push(`${column} = ?`);
    values.push(value);
  }, "assign");
  if (d.name !== void 0)
    assign("name", d.name);
  if (d.phone !== void 0)
    assign("phone", d.phone);
  if (d.is_active !== void 0)
    assign("is_active", d.is_active ? 1 : 0);
  if (d.sort_order !== void 0)
    assign("sort_order", d.sort_order);
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    await c.env.DB.prepare(`UPDATE payment_wallets SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  const updated = await c.env.DB.prepare("SELECT * FROM payment_wallets WHERE id = ?").bind(id).first();
  return c.json({ ok: true, payment_wallet: updated });
});
wallets.delete("/admin/payment-wallets/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const platform = platformOf8(c.env);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM payment_wallets WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  await c.env.DB.prepare("DELETE FROM payment_wallets WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
wallets.get("/me/referral", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf8(c.env);
  const profile = await c.env.DB.prepare(
    "SELECT student_code FROM profiles WHERE id = ?"
  ).bind(user.id).first();
  let code = profile?.student_code || null;
  if (!code) {
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = generateStudentCode();
      try {
        await c.env.DB.prepare(
          "UPDATE profiles SET student_code = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(candidate, user.id).run();
        code = candidate;
      } catch {
      }
    }
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ru.id, ru.code, ru.points_awarded, ru.created_at, p.full_name AS referred_name
     FROM referral_uses ru
     INNER JOIN profiles p ON p.id = ru.referred_id
     WHERE ru.referrer_id = ? AND ru.platform = ?
     ORDER BY ru.created_at DESC`
  ).bind(user.id, platform).all();
  const uses = results;
  const pointsEarned = uses.reduce((sum, u) => sum + (u.points_awarded || 0), 0);
  return c.json({
    partner_code: code,
    uses_count: uses.length,
    points_earned: pointsEarned,
    uses,
    labels: REFERRAL_LABELS
  });
});
wallets.get("/admin/referrals", requireRole("admin"), async (c) => {
  const platform = platformOf8(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT ru.*, ref.full_name AS referrer_name, ref.student_code,
            newp.full_name AS referred_name, newp.email AS referred_email
     FROM referral_uses ru
     INNER JOIN profiles ref  ON ref.id = ru.referrer_id
     INNER JOIN profiles newp ON newp.id = ru.referred_id
     WHERE ru.platform = ?
     ORDER BY ru.created_at DESC`
  ).bind(platform).all();
  return c.json({ referrals: results, labels: REFERRAL_LABELS });
});
var wallets_default = wallets;

// src/routes/challenges.ts
var challenges = new Hono2();
var platformOf9 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var CHALLENGE_DURATION_MINUTES = 5;
var CHALLENGE_DURATION_SECONDS = CHALLENGE_DURATION_MINUTES * 60;
var CHALLENGE_WIN_POINTS = 20;
var CHALLENGE_LABELS = {
  leaderboard_title: "\u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u062A\u0635\u062F\u0631\u064A\u0646",
  leaderboard_subtitle: "\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0637\u0644\u0627\u0628 \u062D\u0633\u0628 \u0627\u0644\u0645\u0633\u062A\u0648\u0649",
  incoming_title: "\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u062F\u064A \u0627\u0644\u0648\u0627\u0631\u062F\u0629",
  outgoing_title: "\u0637\u0644\u0628\u0627\u062A\u0643 \u0627\u0644\u0645\u0631\u0633\u0644\u0629",
  accept: "\u0642\u0628\u0648\u0644",
  reject: "\u0631\u0641\u0636",
  status_accepted: "\u0645\u0642\u0628\u0648\u0644",
  status_pending: "\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
  status_rejected: "\u0645\u0631\u0641\u0648\u0636",
  enter: "\u062F\u062E\u0648\u0644 \u0627\u0644\u062A\u062D\u062F\u064A",
  title: "\u062A\u062D\u062F\u064A",
  level_label: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 {n}",
  points_label: "{n} \u0646\u0642\u0637\u0629",
  empty_students: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0627\u0628 \u0645\u062A\u0627\u062D\u064A\u0646",
  question_progress: "\u0633\u0624\u0627\u0644 {i} \u0645\u0646 {n}",
  previous: "\u0627\u0644\u0633\u0627\u0628\u0642",
  next: "\u0627\u0644\u062A\u0627\u0644\u064A",
  submit: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u062C\u0627\u0628\u0627\u062A",
  result_title: "\u0627\u0644\u0646\u062A\u064A\u062C\u0629",
  your_points: "\u0646\u0642\u0627\u0637\u0643:",
  opponent_points: "\u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0646\u0627\u0641\u0633:",
  win: "\u{1F389} \u0645\u0628\u0631\u0648\u0643! \u0641\u0632\u062A! \u{1F389}",
  lose: "\u062D\u0638 \u0623\u0648\u0641\u0631 \u0641\u064A \u0627\u0644\u0645\u0631\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629",
  draw: "\u062A\u0639\u0627\u062F\u0644!",
  waiting: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0646\u0627\u0641\u0633\u0643",
  back: "\u0627\u0644\u0639\u0648\u062F\u0629",
  share_facebook: "\u0634\u0627\u0631\u0643 \u0639\u0644\u0649 \u0641\u064A\u0633\u0628\u0648\u0643",
  share_twitter: "\u0634\u0627\u0631\u0643 \u0639\u0644\u0649 \u062A\u0648\u064A\u062A\u0631",
  beat: "\u062A\u063A\u0644\u0628\u062A \u0639\u0644\u0649 {name}",
  error_create: "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u062F\u064A",
  error_accept: "\u0641\u0634\u0644 \u0642\u0628\u0648\u0644 \u0627\u0644\u0637\u0644\u0628",
  error_reject: "\u0641\u0634\u0644 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628",
  error_no_questions: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0633\u0626\u0644\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u062A\u062D\u062F\u064A",
  loading: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u062D\u062F\u064A..."
};
function studentBadge(level, points2) {
  return {
    level_label: `\u0627\u0644\u0645\u0633\u062A\u0648\u0649 ${level}`,
    points_label: `${points2} \u0646\u0642\u0637\u0629`
  };
}
__name(studentBadge, "studentBadge");
var GRADABLE_TYPES = ["mcq", "true_false", "short_answer", "fill_blank"];
async function pickChallengeQuestions(env, platform, count) {
  const placeholders = GRADABLE_TYPES.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT id, type, question_text, image_url, options_json, points
     FROM question_bank
     WHERE platform = ? AND is_archived = 0 AND type IN (${placeholders})
     ORDER BY RANDOM()
     LIMIT ?`
  ).bind(platform, ...GRADABLE_TYPES, count).all();
  return results;
}
__name(pickChallengeQuestions, "pickChallengeQuestions");
challenges.get("/challenges/leaderboard", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT id, full_name, avatar_url, points, level
     FROM profiles
     WHERE platform = ? AND role = 'student' AND status = 'active'
     ORDER BY points DESC, full_name ASC
     LIMIT 50`
  ).bind(platform).all();
  return c.json({
    leaderboard: results.map((row, index) => ({
      rank: index + 1,
      student_id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      points: row.points,
      level: row.level,
      is_me: row.id === user.id,
      ...studentBadge(row.level, row.points)
    })),
    labels: CHALLENGE_LABELS
  });
});
challenges.get("/challenges/incoming", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT ch.id, ch.status, ch.duration_minutes, ch.question_count, ch.created_at,
            p.id AS challenger_id, p.full_name AS challenger_name, p.avatar_url AS challenger_avatar,
            p.points AS challenger_points, p.level AS challenger_level
     FROM challenges ch
     INNER JOIN profiles p ON p.id = ch.challenger_id
     WHERE ch.platform = ? AND ch.opponent_id = ? AND ch.status = 'pending'
     ORDER BY ch.created_at DESC`
  ).bind(platform, user.id).all();
  return c.json({
    incoming: results.map((row) => ({
      ...row,
      ...studentBadge(row.challenger_level, row.challenger_points),
      accept_label: CHALLENGE_LABELS.accept,
      reject_label: CHALLENGE_LABELS.reject
    })),
    labels: CHALLENGE_LABELS
  });
});
challenges.get("/challenges/outgoing", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT ch.id, ch.status, ch.duration_minutes, ch.question_count, ch.created_at,
            ch.challenger_score, ch.opponent_score,
            p.id AS opponent_id, p.full_name AS opponent_name, p.avatar_url AS opponent_avatar,
            p.points AS opponent_points, p.level AS opponent_level
     FROM challenges ch
     INNER JOIN profiles p ON p.id = ch.opponent_id
     WHERE ch.platform = ? AND ch.challenger_id = ?
     ORDER BY ch.created_at DESC`
  ).bind(platform, user.id).all();
  return c.json({
    outgoing: results.map((row) => ({
      ...row,
      ...studentBadge(row.opponent_level, row.opponent_points),
      status_label: row.status === "accepted" || row.status === "completed" ? CHALLENGE_LABELS.status_accepted : row.status === "rejected" ? CHALLENGE_LABELS.status_rejected : CHALLENGE_LABELS.status_pending,
      action_label: row.status === "accepted" ? CHALLENGE_LABELS.enter : null
    })),
    labels: CHALLENGE_LABELS
  });
});
var createSchema3 = external_exports.object({
  opponent_id: external_exports.string().min(1),
  question_count: external_exports.number().int().min(3).max(20).optional()
});
challenges.post("/challenges", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema3.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: CHALLENGE_LABELS.error_create, details: parsed.error.flatten() } }, 400);
  }
  const opponentId = parsed.data.opponent_id;
  const questionCount = parsed.data.question_count ?? 5;
  if (opponentId === user.id) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: CHALLENGE_LABELS.error_create } }, 400);
  }
  const opponent = await c.env.DB.prepare(
    "SELECT id, full_name, points, level FROM profiles WHERE id = ? AND platform = ? AND role = 'student' AND status = 'active'"
  ).bind(opponentId, platform).first();
  if (!opponent) {
    return c.json({ error: { code: "NOT_FOUND", message: CHALLENGE_LABELS.empty_students } }, 404);
  }
  const duplicate = await c.env.DB.prepare(
    `SELECT id FROM challenges
     WHERE platform = ? AND challenger_id = ? AND opponent_id = ? AND status IN ('pending', 'accepted')
     LIMIT 1`
  ).bind(platform, user.id, opponentId).first();
  if (duplicate) {
    return c.json({ error: { code: "ALREADY_PENDING", message: CHALLENGE_LABELS.error_create } }, 409);
  }
  const questions2 = await pickChallengeQuestions(c.env, platform, questionCount);
  if (questions2.length === 0) {
    return c.json({ error: { code: "NO_QUESTIONS", message: CHALLENGE_LABELS.error_no_questions } }, 400);
  }
  const challengeId = generateId();
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO challenges
         (id, platform, challenger_id, opponent_id, status, duration_minutes, question_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
    ).bind(challengeId, platform, user.id, opponentId, CHALLENGE_DURATION_MINUTES, questions2.length)
  ];
  questions2.forEach((question, index) => {
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO challenge_questions (id, challenge_id, question_id, sort_order) VALUES (?, ?, ?, ?)"
      ).bind(generateId(), challengeId, question.id, index)
    );
  });
  await c.env.DB.batch(statements);
  const created = await c.env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(challengeId).first();
  return c.json({
    ok: true,
    challenge: created,
    opponent: { ...opponent, ...studentBadge(opponent.level, opponent.points) },
    labels: CHALLENGE_LABELS
  }, 201);
});
challenges.post("/challenges/:id/accept", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const id = c.req.param("id");
  const challenge = await c.env.DB.prepare(
    "SELECT * FROM challenges WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!challenge || challenge.opponent_id !== user.id) {
    return c.json({ error: { code: "NOT_FOUND", message: CHALLENGE_LABELS.error_accept } }, 404);
  }
  if (challenge.status !== "pending") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: CHALLENGE_LABELS.error_accept } }, 400);
  }
  await c.env.DB.prepare(
    "UPDATE challenges SET status = 'accepted', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();
  const updated = await c.env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(id).first();
  return c.json({ ok: true, challenge: updated, duration_seconds: CHALLENGE_DURATION_SECONDS, labels: CHALLENGE_LABELS });
});
challenges.post("/challenges/:id/reject", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const id = c.req.param("id");
  const challenge = await c.env.DB.prepare(
    "SELECT id, opponent_id, status FROM challenges WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!challenge || challenge.opponent_id !== user.id) {
    return c.json({ error: { code: "NOT_FOUND", message: CHALLENGE_LABELS.error_reject } }, 404);
  }
  if (challenge.status !== "pending") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: CHALLENGE_LABELS.error_reject } }, 400);
  }
  await c.env.DB.prepare(
    "UPDATE challenges SET status = 'rejected', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();
  return c.json({ ok: true, labels: CHALLENGE_LABELS });
});
async function loadParticipantChallenge(env, platform, id, userId) {
  const challenge = await env.DB.prepare(
    "SELECT * FROM challenges WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!challenge)
    return null;
  if (challenge.challenger_id !== userId && challenge.opponent_id !== userId)
    return null;
  return challenge;
}
__name(loadParticipantChallenge, "loadParticipantChallenge");
challenges.get("/challenges/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const id = c.req.param("id");
  const challenge = await loadParticipantChallenge(c.env, platform, id, user.id);
  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: CHALLENGE_LABELS.error_no_questions } }, 404);
  }
  if (challenge.status === "pending" || challenge.status === "rejected") {
    return c.json({ error: { code: "CHALLENGE_NOT_ACTIVE", message: CHALLENGE_LABELS.status_pending } }, 403);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT cq.sort_order, q.id, q.type, q.question_text, q.image_url, q.options_json, q.points
     FROM challenge_questions cq
     INNER JOIN question_bank q ON q.id = cq.question_id
     WHERE cq.challenge_id = ?
     ORDER BY cq.sort_order ASC`
  ).bind(id).all();
  const questions2 = results.map((row) => ({
    id: row.id,
    type: row.type,
    question_text: row.question_text,
    image_url: row.image_url,
    options: row.options_json ? JSON.parse(row.options_json) : null,
    points: row.points,
    sort_order: row.sort_order
  }));
  const startedAt = challenge.started_at ? Date.parse(challenge.started_at.replace(" ", "T") + "Z") : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1e3));
  const isChallenger = challenge.challenger_id === user.id;
  const alreadyDone = isChallenger ? challenge.challenger_done === 1 : challenge.opponent_done === 1;
  return c.json({
    challenge: {
      id: challenge.id,
      status: challenge.status,
      duration_seconds: CHALLENGE_DURATION_SECONDS,
      remaining_seconds: Math.max(0, CHALLENGE_DURATION_SECONDS - elapsed),
      already_submitted: alreadyDone,
      is_challenger: isChallenger
    },
    questions: questions2,
    labels: CHALLENGE_LABELS
  });
});
var submitSchema = external_exports.object({ answers: external_exports.record(external_exports.unknown()) });
challenges.post("/challenges/:id/submit", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  const challenge = await loadParticipantChallenge(c.env, platform, id, user.id);
  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: CHALLENGE_LABELS.error_no_questions } }, 404);
  }
  if (challenge.status !== "accepted" && challenge.status !== "completed") {
    return c.json({ error: { code: "CHALLENGE_NOT_ACTIVE", message: CHALLENGE_LABELS.status_pending } }, 403);
  }
  const isChallenger = challenge.challenger_id === user.id;
  if ((isChallenger ? challenge.challenger_done : challenge.opponent_done) === 1) {
    return c.json({ error: { code: "ALREADY_SUBMITTED", message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u062C\u0627\u0628\u0627\u062A\u0643 \u0628\u0627\u0644\u0641\u0639\u0644" } }, 400);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT cq.question_id, q.type, q.correct_answer_json, q.points
     FROM challenge_questions cq
     INNER JOIN question_bank q ON q.id = cq.question_id
     WHERE cq.challenge_id = ?`
  ).bind(id).all();
  if (results.length === 0) {
    return c.json({ error: { code: "NO_QUESTIONS", message: CHALLENGE_LABELS.error_no_questions } }, 400);
  }
  let score = 0;
  const graded = [];
  for (const row of results) {
    const key = row.correct_answer_json ? JSON.parse(row.correct_answer_json) : null;
    const given = parsed.data.answers[row.question_id];
    const { correct } = gradeAnswer(row.type, key, given);
    const points2 = correct === true ? row.points || 1 : 0;
    score += points2;
    graded.push({ question_id: row.question_id, correct, points: points2 });
  }
  const statements = graded.map(
    (entry) => c.env.DB.prepare(
      `INSERT INTO challenge_answers (id, platform, challenge_id, student_id, question_id, answer_json, is_correct, points, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(challenge_id, student_id, question_id) DO UPDATE SET
         answer_json = excluded.answer_json,
         is_correct  = excluded.is_correct,
         points      = excluded.points`
    ).bind(
      generateId(),
      platform,
      id,
      user.id,
      entry.question_id,
      JSON.stringify(parsed.data.answers[entry.question_id] ?? null),
      entry.correct === true ? 1 : 0,
      entry.points
    )
  );
  statements.push(
    c.env.DB.prepare(
      isChallenger ? "UPDATE challenges SET challenger_score = ?, challenger_done = 1, updated_at = datetime('now') WHERE id = ?" : "UPDATE challenges SET opponent_score = ?, opponent_done = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(score, id)
  );
  await c.env.DB.batch(statements);
  const after = await c.env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(id).first();
  let result = {
    status: after.status,
    winner_id: after.winner_id,
    points_awarded: 0
  };
  if (after.challenger_done === 1 && after.opponent_done === 1 && after.status !== "completed") {
    const winnerId = after.challenger_score === after.opponent_score ? null : after.challenger_score > after.opponent_score ? after.challenger_id : after.opponent_id;
    await c.env.DB.prepare(
      "UPDATE challenges SET status = 'completed', winner_id = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(winnerId, id).run();
    if (winnerId) {
      await awardPoints(c.env, winnerId, CHALLENGE_WIN_POINTS, "challenge", {
        referenceId: id,
        note: "\u0627\u0644\u0641\u0648\u0632 \u0628\u062A\u062D\u062F\u064D\u0651 1v1"
      });
    }
    result = { status: "completed", winner_id: winnerId, points_awarded: winnerId ? CHALLENGE_WIN_POINTS : 0 };
  }
  return c.json({ ok: true, score, graded, ...result, labels: CHALLENGE_LABELS });
});
challenges.get("/challenges/:id/result", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf9(c.env);
  const id = c.req.param("id");
  const challenge = await loadParticipantChallenge(c.env, platform, id, user.id);
  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: CHALLENGE_LABELS.error_no_questions } }, 404);
  }
  const isChallenger = challenge.challenger_id === user.id;
  const myScore = isChallenger ? challenge.challenger_score : challenge.opponent_score;
  const opponentScore = isChallenger ? challenge.opponent_score : challenge.challenger_score;
  const iAmDone = (isChallenger ? challenge.challenger_done : challenge.opponent_done) === 1;
  const bothDone = challenge.challenger_done === 1 && challenge.opponent_done === 1;
  let result_label = null;
  if (!bothDone) {
    result_label = iAmDone ? CHALLENGE_LABELS.waiting : null;
  } else if (myScore === opponentScore) {
    result_label = CHALLENGE_LABELS.draw;
  } else if (myScore > opponentScore) {
    result_label = CHALLENGE_LABELS.win;
  } else {
    result_label = CHALLENGE_LABELS.lose;
  }
  const opponentId = isChallenger ? challenge.opponent_id : challenge.challenger_id;
  const opponent = await c.env.DB.prepare(
    "SELECT id, full_name, avatar_url, points, level FROM profiles WHERE id = ?"
  ).bind(opponentId).first();
  return c.json({
    challenge_id: id,
    status: challenge.status,
    your_points: myScore,
    opponent_points: opponentScore,
    both_submitted: bothDone,
    winner_id: challenge.winner_id,
    result_label,
    opponent: opponent ? { ...opponent, ...studentBadge(opponent.level, opponent.points) } : null,
    labels: CHALLENGE_LABELS
  });
});
var challenges_default = challenges;

// src/routes/conversations.ts
var conversations = new Hono2();
var platformOf10 = /* @__PURE__ */ __name((env) => env.PLATFORM_KEY || "fusha", "platformOf");
var VOICE_MAX_SECONDS = 300;
var MESSAGE_MAX_LENGTH = 4e3;
var CONVERSATION_LABELS = {
  title: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0637\u0644\u0627\u0628 \u0648\u0627\u0644\u0645\u0639\u0644\u0645",
  placeholder: "\u0627\u0643\u062A\u0628 \u0631\u0633\u0627\u0644\u062A\u0643...",
  voice_message: "\u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629 ({m:ss})",
  error_mic_permission: "\u064A\u062C\u0628 \u0627\u0644\u0633\u0645\u0627\u062D \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u064A\u0643\u0631\u0648\u0641\u0648\u0646",
  error_record_start: "\u0641\u0634\u0644 \u0641\u064A \u0628\u062F\u0621 \u0627\u0644\u062A\u0633\u062C\u064A\u0644: {msg}",
  error_record_stop: "\u0641\u0634\u0644 \u0641\u064A \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0633\u062C\u064A\u0644",
  error_play: "\u0641\u0634\u0644 \u0641\u064A \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0635\u0648\u062A",
  loading: "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0631\u0633\u0627\u0626\u0644...",
  empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0631\u0633\u0627\u0626\u0644 \u0628\u0639\u062F",
  send: "\u0625\u0631\u0633\u0627\u0644"
};
function formatVoiceDuration(seconds) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.trunc(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
__name(formatVoiceDuration, "formatVoiceDuration");
function sanitizeFilename2(filename) {
  return filename.replace(/[#?%&+=/\\:*\x22<>| ]/g, "_").replace(/__+/g, "_");
}
__name(sanitizeFilename2, "sanitizeFilename");
conversations.get("/conversations/messages", requireAuth, async (c) => {
  const platform = platformOf10(c.env);
  const after = c.req.query("after");
  const limitRaw = Number(c.req.query("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 50;
  const where = ["m.platform = ?", "m.is_deleted = 0"];
  const binds = [platform];
  if (after) {
    where.push("m.created_at > ?");
    binds.push(after);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.sender_id, m.body, m.audio_url, m.audio_duration_seconds, m.created_at,
            p.full_name AS sender_name, p.avatar_url AS sender_avatar, p.role AS sender_role
     FROM messages m
     INNER JOIN profiles p ON p.id = m.sender_id
     WHERE ${where.join(" AND ")}
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).bind(...binds, limit).all();
  const messages = results.reverse().map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    sender_avatar: row.sender_avatar,
    sender_role: row.sender_role,
    is_teacher: row.sender_role === "admin" || row.sender_role === "assistant",
    body: row.body,
    audio_url: row.audio_url,
    audio_duration_seconds: row.audio_duration_seconds,
    audio_duration_label: row.audio_url ? `\u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629 (${formatVoiceDuration(row.audio_duration_seconds)})` : null,
    created_at: row.created_at
  }));
  return c.json({ messages, labels: CONVERSATION_LABELS });
});
var messageSchema = external_exports.object({
  body: external_exports.string().trim().max(MESSAGE_MAX_LENGTH).optional(),
  audio_url: external_exports.string().max(1e3).optional(),
  audio_duration_seconds: external_exports.number().int().min(1).max(VOICE_MAX_SECONDS).optional()
}).refine(
  (value) => !!value.body && value.body.length > 0 || !!value.audio_url,
  { message: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0641\u0627\u0631\u063A\u0629" }
);
conversations.post("/conversations/messages", requireAuth, rateLimit("conversation_send", 60, 60), async (c) => {
  const user = c.get("user");
  const platform = platformOf10(c.env);
  const payload = await c.req.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", details: parsed.error.flatten() } }, 400);
  }
  if (parsed.data.audio_url && !parsed.data.audio_duration_seconds) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0645\u062F\u0629 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0635\u0648\u062A\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" } }, 400);
  }
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO messages (id, platform, sender_id, body, audio_url, audio_duration_seconds, is_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  ).bind(
    id,
    platform,
    user.id,
    parsed.data.body ?? null,
    parsed.data.audio_url ?? null,
    parsed.data.audio_duration_seconds ?? null
  ).run();
  const created = await c.env.DB.prepare(
    `SELECT m.id, m.sender_id, m.body, m.audio_url, m.audio_duration_seconds, m.created_at,
            p.full_name AS sender_name, p.avatar_url AS sender_avatar, p.role AS sender_role
     FROM messages m INNER JOIN profiles p ON p.id = m.sender_id
     WHERE m.id = ?`
  ).bind(id).first();
  return c.json({
    ok: true,
    message: {
      ...created,
      is_teacher: created.sender_role === "admin" || created.sender_role === "assistant",
      audio_duration_label: created.audio_url ? `\u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062A\u064A\u0629 (${formatVoiceDuration(created.audio_duration_seconds)})` : null
    },
    labels: CONVERSATION_LABELS
  }, 201);
});
conversations.post("/conversations/voice-url", requireAuth, rateLimit("conversation_voice_url", 30, 60), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = external_exports.object({
    filename: external_exports.string().min(1).max(200),
    mime_type: external_exports.string().max(100).optional()
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628", details: parsed.error.flatten() } }, 400);
  }
  const id = generateId();
  const cleanFilename = sanitizeFilename2(parsed.data.filename);
  const r2Key = `voice/${id}_${cleanFilename}`;
  const contentType = parsed.data.mime_type || "audio/mpeg";
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || "fusha-ashraf-files",
    r2Key,
    contentType,
    3600
  );
  const origin = new URL(c.req.url).origin;
  return c.json({
    upload_url: uploadUrl,
    public_url: `${origin}/files/voice/${id}_${cleanFilename}`,
    max_duration_seconds: VOICE_MAX_SECONDS
  });
});
conversations.delete("/conversations/messages/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const platform = platformOf10(c.env);
  const id = c.req.param("id");
  const message = await c.env.DB.prepare(
    "SELECT id, sender_id FROM messages WHERE id = ? AND platform = ?"
  ).bind(id, platform).first();
  if (!message) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const isStaff = user.role === "admin" || user.role === "assistant";
  if (message.sender_id !== user.id && !isStaff) {
    return c.json({ error: { code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621" } }, 403);
  }
  await c.env.DB.prepare(
    "UPDATE messages SET is_deleted = 1 WHERE id = ?"
  ).bind(id).run();
  return c.json({ ok: true });
});
var conversations_default = conversations;

// src/routes/config.ts
var config = new Hono2();
var TABS_CONFIG = {
  tabs: [
    { key: "home", label: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", order: 0 },
    { key: "profile", label: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A", order: 1 },
    { key: "exams", label: "\u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A", order: 2 },
    { key: "conversations", label: "\u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A", order: 3 },
    { key: "challenge", label: "\u0627\u0644\u062A\u062D\u062F\u064A", order: 4 },
    { key: "mistakes", label: "\u0627\u0644\u0623\u062E\u0637\u0627\u0621", order: 5 },
    { key: "common_mistakes", label: "\u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0634\u0627\u0626\u0639\u0629", order: 6 }
  ],
  /** شريط الأخبار يظهر أعلى كل تبويب، ٧ ثوانٍ للشريحة، مع نقاط. */
  news_slider: {
    position: "top",
    interval_seconds: 7,
    show_dots: true
  },
  /** العملة موحّدة على المنصة (الوثيقة 23 §4.1). */
  currency: "\u062C\u0646\u064A\u0647",
  /** أرقام عربية-هندية في العرض حيث وردت. */
  use_arabic_digits: true
};
config.get("/tabs-config", async (c) => {
  return c.json({
    ...TABS_CONFIG,
    tabs: [...TABS_CONFIG.tabs].sort((a, b) => a.order - b.order)
  });
});
var config_default = config;

// src/queues/videoTransferConsumer.ts
var getR2Video = /* @__PURE__ */ __name((env) => {
  return env.R2_VIDEO || env.R2;
}, "getR2Video");
var bunnyHeaders = /* @__PURE__ */ __name((env) => {
  const headers = { accept: "*/*" };
  if (env.PUBLIC_API_ORIGIN) {
    headers["Referer"] = env.PUBLIC_API_ORIGIN;
  }
  return headers;
}, "bunnyHeaders");
var ALLOWED_VIDEO_QUALITIES = ["480p", "720p", "1080p"];
async function handleVideoTransferQueue(batch, env) {
  for (const message of batch.messages) {
    const msg = message.body;
    console.log(`[Queue] Processing message type: ${msg.type} for lesson: ${msg.lessonId}`);
    try {
      if (msg.type === "check_encoding") {
        await handleCheckEncoding(msg, env, message);
      } else if (msg.type === "transfer_quality") {
        await handleTransferQuality(msg, env, message);
      } else if (msg.type === "finalize") {
        await handleFinalize(msg, env, message);
      }
    } catch (error) {
      console.error(`[Queue Error] Failed to process message ${msg.type}:`, error);
      message.retry();
    }
  }
}
__name(handleVideoTransferQueue, "handleVideoTransferQueue");
async function handleCheckEncoding(msg, env, message) {
  const libraryId = env.BUNNY_LIBRARY_ID;
  const apiKey = env.BUNNY_API_KEY;
  if (!libraryId) {
    console.error("BUNNY_LIBRARY_ID is not configured");
    await updateVideoStatus(env, msg.videoId, "error");
    message.ack();
    return;
  }
  if (!apiKey) {
    console.error("BUNNY_API_KEY is not configured");
    await updateVideoStatus(env, msg.videoId, "error");
    message.ack();
    return;
  }
  const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${msg.bunnyGuid}`;
  const response = await fetch(url, {
    headers: {
      "AccessKey": apiKey,
      "accept": "application/json"
    }
  });
  if (!response.ok) {
    console.error(`Bunny API error: ${response.status} ${response.statusText}`);
    if (response.status === 404) {
      await updateVideoStatus(env, msg.videoId, "error");
      message.ack();
      return;
    }
    if (response.status === 429 || response.status >= 500) {
      console.warn(`[Queue] Bunny API returned temporary status ${response.status}. Rescheduling with 60s delay...`);
      await env.VIDEO_QUEUE.send(
        {
          type: "check_encoding",
          lessonId: msg.lessonId,
          videoId: msg.videoId,
          bunnyGuid: msg.bunnyGuid,
          attempt: msg.attempt
        },
        { delaySeconds: 60 }
      );
      message.ack();
      return;
    }
    throw new Error(`Bunny API error: ${response.status}`);
  }
  const videoData = await response.json();
  console.log(`[Queue] Bunny video status: ${videoData.status} (attempt ${msg.attempt}, height: ${videoData.height}, progress: ${videoData.encodeProgress}, resolutions: ${videoData.availableResolutions}, length: ${videoData.length})`);
  if (videoData.encodeProgress !== void 0 && videoData.encodeProgress !== null) {
    const progressPercent = Math.round(videoData.encodeProgress);
    await env.KV.put(`video_transfer:${msg.videoId}:progress`, progressPercent.toString(), { expirationTtl: 172800 });
  }
  const maxAttempts = videoData.length && videoData.length > 0 ? Math.max(400, Math.ceil(videoData.length / 60) * 20) : 400;
  const isFinished = videoData.status === 4;
  if (isFinished) {
    const cdnHost = env.BUNNY_CDN_HOST;
    if (!cdnHost) {
      throw new Error("BUNNY_CDN_HOST is not configured");
    }
    const masterPlaylistUrl = `https://${cdnHost}/${msg.bunnyGuid}/playlist.m3u8?t=${Date.now()}`;
    console.log(`[Queue] Fetching master playlist from: ${masterPlaylistUrl}`);
    const playlistResp = await fetch(masterPlaylistUrl, {
      headers: bunnyHeaders(env)
    });
    if (!playlistResp.ok) {
      const errText = await playlistResp.text().catch(() => "");
      console.warn(`[Queue] Master playlist not available yet: HTTP ${playlistResp.status}. CDN propagation in progress. Rescheduling check...`);
      await env.VIDEO_QUEUE.send(
        {
          type: "check_encoding",
          lessonId: msg.lessonId,
          videoId: msg.videoId,
          bunnyGuid: msg.bunnyGuid,
          attempt: msg.attempt + 1
        },
        { delaySeconds: 60 }
      );
      message.ack();
      return;
    }
    const playlistText = await playlistResp.text();
    const lines = playlistText.split("\n");
    const subPlaylists = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        subPlaylists.push(trimmed);
      }
    }
    const presentQualityNames = subPlaylists.map((subPath) => subPath.split("/")[0]);
    console.log(`[Queue] Found qualities in CDN playlist: ${presentQualityNames.join(", ")}`);
    let expectedQualities;
    const sourceHeight = videoData.height;
    if (sourceHeight !== void 0 && sourceHeight !== null) {
      if (sourceHeight >= 1080)
        expectedQualities = ["480p", "720p", "1080p"];
      else if (sourceHeight >= 720)
        expectedQualities = ["480p", "720p"];
      else if (sourceHeight >= 480)
        expectedQualities = ["480p"];
      else
        expectedQualities = [];
    } else {
      expectedQualities = [...ALLOWED_VIDEO_QUALITIES];
    }
    if (videoData.availableResolutions) {
      const apiResolutions = videoData.availableResolutions.split(",").map((r) => r.trim()).filter(Boolean);
      const missingFromApi = expectedQualities.filter((q) => !apiResolutions.includes(q));
      if (missingFromApi.length > 0) {
        const apiWhitelisted = apiResolutions.filter((q) => ALLOWED_VIDEO_QUALITIES.includes(q));
        console.warn(`[Queue] Bunny API's availableResolutions (${videoData.availableResolutions}) is missing expected quality(ies) [${missingFromApi.join(", ")}] for video ${msg.videoId} \u2014 Bunny genuinely did not produce them. Trusting availableResolutions \u2229 whitelist as the expected set: [${apiWhitelisted.join(", ")}]`);
        expectedQualities = apiWhitelisted;
      }
    }
    const missingQualities = expectedQualities.filter((q) => !presentQualityNames.includes(q));
    const isReadyToTransfer = expectedQualities.length === 0 ? presentQualityNames.length > 0 : missingQualities.length === 0;
    console.log(`[Queue] Transfer readiness for video ${msg.videoId}: expected=[${expectedQualities.join(", ")}], present=[${presentQualityNames.join(", ")}], missing=[${missingQualities.join(", ")}], ready=${isReadyToTransfer}, attempt=${msg.attempt}`);
    if (!isReadyToTransfer) {
      if (msg.attempt >= maxAttempts) {
        console.error(`[Queue] Gave up waiting for CDN propagation of qualities [${missingQualities.join(", ")}] for video ${msg.videoId} after ${msg.attempt} attempts (maxAttempts=${maxAttempts})`);
        await updateVideoStatus(env, msg.videoId, "error");
        await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
        message.ack();
        return;
      }
      console.log(`[Queue] Not ready: waiting for CDN propagation of [${missingQualities.join(", ")}]. Attempt: ${msg.attempt}. Rescheduling check...`);
      await env.VIDEO_QUEUE.send(
        {
          ...msg,
          attempt: msg.attempt + 1
        },
        { delaySeconds: 15 }
      );
      message.ack();
      return;
    }
    console.log("[Queue] Video is ready for transfer! Initializing...");
    await updateVideoStatus(env, msg.videoId, "processing");
    if (subPlaylists.length === 0) {
      console.error("[Queue] No qualities found in master playlist");
      await updateVideoStatus(env, msg.videoId, "error");
      message.ack();
      return;
    }
    const filteredSubPlaylists = subPlaylists.filter((subPath) => {
      const quality = subPath.split("/")[0];
      return quality === "audio" || ALLOWED_VIDEO_QUALITIES.includes(quality);
    });
    const qualitiesToTransfer = filteredSubPlaylists.length > 0 ? filteredSubPlaylists : subPlaylists;
    const qualityNames = qualitiesToTransfer.map((subPath) => subPath.split("/")[0]);
    console.log(`[Queue] Transferring ${qualitiesToTransfer.length}/${subPlaylists.length} qualities (whitelist: ${ALLOWED_VIDEO_QUALITIES.join(",")}): ${qualityNames.join(", ")}`);
    await env.KV.put(`video_transfer:${msg.videoId}:total`, qualitiesToTransfer.length.toString(), { expirationTtl: 172800 });
    await env.KV.put(`video_transfer:${msg.videoId}:expected_qualities`, JSON.stringify(qualityNames), { expirationTtl: 172800 });
    for (const subPath of qualitiesToTransfer) {
      const quality = subPath.split("/")[0];
      const playlistUrl = `https://${cdnHost}/${msg.bunnyGuid}/${subPath}`;
      await env.VIDEO_QUEUE.send({
        type: "transfer_quality",
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        quality,
        playlistUrl
      });
    }
    message.ack();
  } else if (videoData.status === 5 || videoData.status === 6) {
    console.error(`[Queue] Bunny Stream encoding/upload failed (status ${videoData.status})`);
    await updateVideoStatus(env, msg.videoId, "error");
    await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
    message.ack();
  } else {
    if (msg.attempt >= maxAttempts) {
      console.error(`[Queue] Polling timeout (exceeded ${maxAttempts} attempts)`);
      await updateVideoStatus(env, msg.videoId, "error");
      await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
      message.ack();
      return;
    }
    let delaySeconds = 15;
    if (msg.attempt > 120) {
      delaySeconds = 120;
    } else if (msg.attempt > 40) {
      delaySeconds = 60;
    } else if (msg.attempt > 15) {
      delaySeconds = 30;
    }
    console.log(`[Queue] Video is still encoding. Rescheduling check in ${delaySeconds} seconds (attempt ${msg.attempt + 1})...`);
    await env.VIDEO_QUEUE.send(
      {
        type: "check_encoding",
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        attempt: msg.attempt + 1
      },
      { delaySeconds }
    );
    message.ack();
  }
}
__name(handleCheckEncoding, "handleCheckEncoding");
async function handleTransferQuality(msg, env, message) {
  const attempt = msg.attempt || 1;
  const startIndex = msg.segmentStartIndex || 0;
  console.log(`[Queue] Transferring quality ${msg.quality} for video ${msg.videoId} (Index: ${startIndex}, Attempt: ${attempt})`);
  try {
    const keyHex = await env.KV.get(`video_aes_key:${msg.videoId}`);
    const ivHex = await env.KV.get(`video_aes_iv:${msg.videoId}`);
    const busterUrl = `${msg.playlistUrl}?t=${Date.now()}`;
    const playlistResp = await fetch(busterUrl, {
      headers: bunnyHeaders(env)
    });
    if (!playlistResp.ok) {
      throw new Error(`Failed to fetch quality playlist: ${msg.playlistUrl} (HTTP ${playlistResp.status})`);
    }
    const playlistText = await playlistResp.text();
    const lines = playlistText.split("\n");
    const segments = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        segments.push(trimmed);
      }
    }
    const cdnHost = env.BUNNY_CDN_HOST;
    if (!cdnHost) {
      throw new Error("BUNNY_CDN_HOST is not configured");
    }
    const baseSegmentUrl = `https://${cdnHost}/${msg.bunnyGuid}/${msg.quality}`;
    const r2BaseKey = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${msg.quality}`;
    const maxSubrequests = env.MAX_SUBREQUESTS ? parseInt(env.MAX_SUBREQUESTS, 10) : 50;
    let batchSize = Math.max(5, Math.floor((maxSubrequests - 6) / 2));
    if (batchSize > 200) {
      batchSize = 200;
    }
    const batch = segments.slice(startIndex, startIndex + batchSize);
    console.log(`[Queue] Processing batch of ${batch.length} segments (${startIndex} to ${startIndex + batch.length - 1}) out of ${segments.length}`);
    const subChunkSize = 10;
    for (let i = 0; i < batch.length; i += subChunkSize) {
      const subChunk = batch.slice(i, i + subChunkSize);
      await Promise.all(
        subChunk.map(async (filename) => {
          const segmentUrl = `${baseSegmentUrl}/${filename}?t=${Date.now()}`;
          const r2Key = `${r2BaseKey}/${filename}`;
          const segmentResp = await fetch(segmentUrl, {
            headers: bunnyHeaders(env)
          });
          if (!segmentResp.ok) {
            throw new Error(`Failed to download segment ${segmentUrl} (HTTP ${segmentResp.status})`);
          }
          const arrayBuffer = await segmentResp.arrayBuffer();
          let dataToUpload = arrayBuffer;
          if (keyHex && ivHex) {
            try {
              const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
              const ivBytes = new Uint8Array(ivHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
              const cryptoKey = await crypto.subtle.importKey(
                "raw",
                keyBytes,
                { name: "AES-CBC" },
                false,
                ["encrypt"]
              );
              const encrypted = await crypto.subtle.encrypt(
                { name: "AES-CBC", iv: ivBytes },
                cryptoKey,
                arrayBuffer
              );
              dataToUpload = encrypted;
            } catch (encryptError) {
              console.error(`[Queue] Encryption failed for segment ${filename}:`, encryptError);
              throw encryptError;
            }
          }
          await getR2Video(env).put(r2Key, dataToUpload, {
            httpMetadata: {
              contentType: "video/MP2T",
              cacheControl: "public, max-age=31536000, immutable"
            }
          });
        })
      );
    }
    const nextIndex = startIndex + batchSize;
    const transferredSegments = Math.min(nextIndex, segments.length);
    await env.KV.put(`video_transfer:${msg.videoId}:${msg.quality}:segments_transferred`, transferredSegments.toString(), { expirationTtl: 172800 });
    await env.KV.put(`video_transfer:${msg.videoId}:${msg.quality}:segments_total`, segments.length.toString(), { expirationTtl: 172800 });
    if (nextIndex < segments.length) {
      console.log(`[Queue] Rescheduling next batch for ${msg.quality} starting at index ${nextIndex}`);
      await env.VIDEO_QUEUE.send({
        ...msg,
        segmentStartIndex: nextIndex
      });
      message.ack();
      return;
    }
    await env.KV.put(`video_transfer:${msg.videoId}:${msg.quality}:segments_transferred`, segments.length.toString(), { expirationTtl: 172800 });
    console.log(`[Queue] All segments for quality ${msg.quality} transferred successfully.`);
    let finalPlaylistText = playlistText;
    if (keyHex && ivHex) {
      const keyTag = `#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x${ivHex}
`;
      if (finalPlaylistText.includes("#EXT-X-MEDIA-SEQUENCE:")) {
        finalPlaylistText = finalPlaylistText.replace(
          /(#EXT-X-MEDIA-SEQUENCE:\d+)/,
          `$1
${keyTag}`
        );
      } else if (finalPlaylistText.includes("#EXT-X-TARGETDURATION:")) {
        finalPlaylistText = finalPlaylistText.replace(
          /(#EXT-X-TARGETDURATION:\d+)/,
          `$1
${keyTag}`
        );
      } else {
        finalPlaylistText = finalPlaylistText.replace(
          /#EXTM3U/,
          `#EXTM3U
${keyTag}`
        );
      }
    }
    const playlistFilename = msg.playlistUrl.substring(msg.playlistUrl.lastIndexOf("/") + 1) || "video.m3u8";
    const originalPlaylistR2Key = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${msg.quality}/${playlistFilename}`;
    await getR2Video(env).put(originalPlaylistR2Key, finalPlaylistText, {
      httpMetadata: { contentType: "application/x-mpegURL", cacheControl: "no-cache" }
    });
    if (playlistFilename !== "stream.m3u8") {
      const playlistR2Key = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${msg.quality}/stream.m3u8`;
      await getR2Video(env).put(playlistR2Key, finalPlaylistText, {
        httpMetadata: { contentType: "application/x-mpegURL", cacheControl: "no-cache" }
      });
    }
    const kvKey = `video_transfer:${msg.videoId}:qualities`;
    const existingStr = await env.KV.get(kvKey);
    const completedQualities = existingStr ? JSON.parse(existingStr) : [];
    if (!completedQualities.includes(msg.quality)) {
      completedQualities.push(msg.quality);
      await env.KV.put(kvKey, JSON.stringify(completedQualities), { expirationTtl: 172800 });
    }
    const expectedQualitiesStr = await env.KV.get(`video_transfer:${msg.videoId}:expected_qualities`);
    const totalStr = await env.KV.get(`video_transfer:${msg.videoId}:total`);
    const expectedCount = totalStr ? parseInt(totalStr, 10) : expectedQualitiesStr ? JSON.parse(expectedQualitiesStr).length : 0;
    console.log(`[Queue] Completed qualities: ${completedQualities.length}/${expectedCount} (${completedQualities.join(", ")})`);
    if (expectedCount > 0 && completedQualities.length >= expectedCount) {
      console.log("[Queue] All qualities transferred! Triggering finalization...");
      await env.VIDEO_QUEUE.send({
        type: "finalize",
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        qualities: completedQualities
      });
    }
    message.ack();
  } catch (err) {
    console.error(`[Queue] Error in handleTransferQuality for quality ${msg.quality} (attempt ${attempt}):`, err);
    if (attempt < 5) {
      console.log(`[Queue] Rescheduling quality ${msg.quality} transfer (attempt ${attempt + 1}) in 30 seconds`);
      await env.VIDEO_QUEUE.send({
        ...msg,
        attempt: attempt + 1
      }, { delaySeconds: 30 });
      message.ack();
    } else {
      console.error(`[Queue] Max attempts (5) reached for quality ${msg.quality}. Marking as finished with error to prevent getting stuck.`);
      const kvKey = `video_transfer:${msg.videoId}:qualities`;
      const existingStr = await env.KV.get(kvKey);
      const completedQualities = existingStr ? JSON.parse(existingStr) : [];
      if (!completedQualities.includes(msg.quality)) {
        completedQualities.push(msg.quality);
        await env.KV.put(kvKey, JSON.stringify(completedQualities), { expirationTtl: 172800 });
      }
      try {
        const totalStr = await env.KV.get(`video_transfer:${msg.videoId}:total`);
        const expectedQualitiesStr = await env.KV.get(`video_transfer:${msg.videoId}:expected_qualities`);
        const expectedCount = totalStr ? parseInt(totalStr, 10) : expectedQualitiesStr ? JSON.parse(expectedQualitiesStr).length : 0;
        console.log(`[Queue] (Fallback) Completed qualities: ${completedQualities.length}/${expectedCount}`);
        if (expectedCount > 0 && completedQualities.length >= expectedCount) {
          console.log("[Queue] (Fallback) All qualities finished (with errors). Triggering finalization...");
          await env.VIDEO_QUEUE.send({
            type: "finalize",
            lessonId: msg.lessonId,
            videoId: msg.videoId,
            bunnyGuid: msg.bunnyGuid,
            qualities: completedQualities
          });
        }
      } catch (fallbackErr) {
        console.error("[Queue] Fallback coordination check failed:", fallbackErr);
      }
      message.ack();
    }
  }
}
__name(handleTransferQuality, "handleTransferQuality");
async function handleFinalize(msg, env, message) {
  const verifyAttempt = msg.verifyAttempt || 0;
  console.log(`[Queue] Finalizing video transfer for ${msg.videoId} (verifyAttempt=${verifyAttempt})`);
  const cdnHost = env.BUNNY_CDN_HOST;
  if (!cdnHost) {
    throw new Error("BUNNY_CDN_HOST is not configured");
  }
  const apiKey = env.BUNNY_API_KEY || "";
  const masterUrl = `https://${cdnHost}/${msg.bunnyGuid}/playlist.m3u8?t=${Date.now()}`;
  const masterResp = await fetch(masterUrl, {
    headers: bunnyHeaders(env)
  });
  if (!masterResp.ok) {
    throw new Error(`Failed to fetch master playlist for finalization (HTTP ${masterResp.status})`);
  }
  const masterText = await masterResp.text();
  const masterSubPaths = [];
  for (const line of masterText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      masterSubPaths.push(trimmed);
    }
  }
  const subPathByQuality = /* @__PURE__ */ new Map();
  for (const subPath of masterSubPaths) {
    subPathByQuality.set(subPath.split("/")[0], subPath);
  }
  const expectedQualitiesStr = await env.KV.get(`video_transfer:${msg.videoId}:expected_qualities`);
  const expectedQualities = expectedQualitiesStr ? JSON.parse(expectedQualitiesStr) : msg.qualities;
  const missingQualities = [];
  for (const quality of expectedQualities) {
    const playlistKey = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${quality}/stream.m3u8`;
    const head = await getR2Video(env).head(playlistKey);
    if (!head) {
      missingQualities.push(quality);
      continue;
    }
    const totalStr = await env.KV.get(`video_transfer:${msg.videoId}:${quality}:segments_total`);
    const transferredStr = await env.KV.get(`video_transfer:${msg.videoId}:${quality}:segments_transferred`);
    const total = totalStr ? parseInt(totalStr, 10) : null;
    const transferred = transferredStr ? parseInt(transferredStr, 10) : null;
    if (total !== null && (transferred === null || transferred < total)) {
      missingQualities.push(quality);
    }
  }
  if (missingQualities.length > 0) {
    console.warn(`[Queue] Finalize verification failed for video ${msg.videoId}: qualities not fully present in R2: [${missingQualities.join(", ")}] (verifyAttempt=${verifyAttempt})`);
    if (verifyAttempt >= 5) {
      console.error(`[Queue] Giving up finalizing video ${msg.videoId} after ${verifyAttempt} verification attempts. Still missing: [${missingQualities.join(", ")}]`);
      await updateVideoStatus(env, msg.videoId, "error");
      message.ack();
      return;
    }
    for (const quality of missingQualities) {
      const subPath = subPathByQuality.get(quality) || `${quality}/video.m3u8`;
      const playlistUrl = `https://${cdnHost}/${msg.bunnyGuid}/${subPath}`;
      await env.VIDEO_QUEUE.send({
        type: "transfer_quality",
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        quality,
        playlistUrl
      });
    }
    await env.VIDEO_QUEUE.send(
      {
        type: "finalize",
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        qualities: expectedQualities,
        verifyAttempt: verifyAttempt + 1
      },
      { delaySeconds: 120 }
    );
    message.ack();
    return;
  }
  const finalMasterText = filterMasterPlaylistToQualities(masterText, expectedQualities);
  const masterR2Key = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/playlist.m3u8`;
  await getR2Video(env).put(masterR2Key, finalMasterText, {
    httpMetadata: { contentType: "application/x-mpegURL", cacheControl: "no-cache" }
  });
  const libraryId = env.BUNNY_LIBRARY_ID;
  if (!libraryId) {
    throw new Error("BUNNY_LIBRARY_ID is not configured");
  }
  let duration = 0;
  if (apiKey) {
    try {
      const metadataResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${msg.bunnyGuid}`, {
        headers: { "AccessKey": apiKey, "accept": "application/json" }
      });
      if (metadataResp.ok) {
        const metadata = await metadataResp.json();
        duration = metadata.length || 0;
      }
    } catch (e) {
      console.warn("Failed to retrieve video duration for metadata:", e);
    }
  }
  const streamUid = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls`;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE lesson_videos 
       SET stream_uid = ?, status = 'ready', duration_seconds = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(streamUid, duration, msg.videoId),
    env.DB.prepare(
      `UPDATE lessons 
       SET duration_seconds = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(duration, msg.lessonId)
  ]);
  console.log(`[Queue] Database updated successfully for video: ${msg.videoId}`);
  if (apiKey) {
    try {
      const deleteResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${msg.bunnyGuid}`, {
        method: "DELETE",
        headers: { "AccessKey": apiKey, "accept": "application/json" }
      });
      if (deleteResp.ok) {
        console.log(`[Queue] Successfully deleted source video ${msg.bunnyGuid} from Bunny Stream`);
      } else {
        console.warn(`[Queue] Delete request failed: ${deleteResp.status} ${deleteResp.statusText}`);
      }
    } catch (e) {
      console.error("[Queue] Failed to delete video from Bunny Stream:", e);
    }
  }
  const kvKey = `video_transfer:${msg.videoId}:qualities`;
  await env.KV.delete(kvKey);
  await env.KV.delete(`video_transfer:${msg.videoId}:total`);
  await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
  await env.KV.delete(`video_transfer:${msg.videoId}:expected_qualities`);
  for (const q of expectedQualities) {
    await env.KV.delete(`video_transfer:${msg.videoId}:${q}:segments_transferred`);
    await env.KV.delete(`video_transfer:${msg.videoId}:${q}:segments_total`);
  }
  console.log("[Queue] Video transfer process completed successfully!");
  message.ack();
}
__name(handleFinalize, "handleFinalize");
function filterMasterPlaylistToQualities(masterText, keepQualities) {
  const keepSet = new Set(keepQualities);
  const lines = masterText.split("\n");
  const outLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      const uriLine = lines[i + 1] || "";
      const quality = uriLine.trim().split("/")[0];
      if (!keepSet.has(quality)) {
        i++;
        continue;
      }
      outLines.push(line);
      continue;
    }
    if (trimmed.startsWith("#EXT-X-MEDIA") && /TYPE=AUDIO/i.test(trimmed)) {
      const uriMatch = trimmed.match(/URI="([^"]+)"/);
      const quality = uriMatch ? uriMatch[1].split("/")[0] : "audio";
      if (!keepSet.has(quality)) {
        continue;
      }
      outLines.push(line);
      continue;
    }
    outLines.push(line);
  }
  return outLines.join("\n");
}
__name(filterMasterPlaylistToQualities, "filterMasterPlaylistToQualities");
async function updateVideoStatus(env, videoId, status) {
  await env.DB.prepare(
    "UPDATE lesson_videos SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, videoId).run();
}
__name(updateVideoStatus, "updateVideoStatus");

// src/index.ts
var app = new Hono2({ strict: false });
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin") || "";
  const allowed = c.env.CORS_ORIGIN;
  if (!allowed) {
    console.error("[SECURITY] CORS_ORIGIN is not configured. Request blocked.");
    return c.json({ error: { code: "SERVER_ERROR", message: "CORS configuration missing" } }, 500);
  }
  let allowOrigin = null;
  let credentials = false;
  const origins = allowed.split(",").map((o) => o.trim());
  const isAllowedSubdomain = origin === "https://fusha-student-web.pages.dev" || origin === "https://fusha-dashboard.pages.dev" || origin.endsWith(".fusha-student-web.pages.dev") || origin.endsWith(".fusha-dashboard.pages.dev") || origin === "https://mansah-tollabiah.pages.dev" || origin === "https://mowqe-al-modares.pages.dev" || origin.endsWith(".mansah-tollabiah.pages.dev") || origin.endsWith(".mowqe-al-modares.pages.dev") || c.env.ENVIRONMENT !== "production" && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"));
  if (origins.includes(origin) || isAllowedSubdomain) {
    allowOrigin = origin;
    credentials = true;
  }
  if (!allowOrigin) {
    await next();
    return;
  }
  const corsMiddleware = cors({
    origin: allowOrigin,
    // X-Signature / X-Timestamp / X-Nonce retained for backwards compatibility with
    // older mobile clients still sending them; the middleware that consumed them has
    // been removed (request signing was broken: the secret shipped in the web client
    // bundle and the server failed open when it was unset). Our own HS256 access
    // tokens (AUTH_SECRET) are the sole request-authenticity mechanism now.
    allowHeaders: ["Content-Type", "Authorization", "X-Device-Id", "X-App-Version", "X-Platform", "X-Requested-With", "X-Signature", "X-Timestamp", "X-Nonce"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials
  });
  return corsMiddleware(c, next);
});
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.header("X-Request-Id", requestId);
  await next();
});
app.use("*", async (c, next) => {
  const existingToken = getCookie(c, "csrf_token");
  if (!existingToken) {
    const token = crypto.randomUUID();
    setCookie(c, "csrf_token", token, {
      path: "/",
      secure: true,
      sameSite: "Lax",
      httpOnly: false,
      // Must be readable by client JS
      maxAge: 365 * 24 * 60 * 60
    });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
    const path = c.req.path;
    if (!path.startsWith("/webhooks")) {
      const requestedWith = c.req.header("X-Requested-With")?.toLowerCase();
      const platform = c.req.header("X-Platform")?.toLowerCase();
      const isXmlHttpRequest = requestedWith === "xmlhttprequest";
      const isMobileOrValidPlatform = ["web", "android", "ios"].includes(platform || "");
      const isPublicAuthPath = path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/refresh") || path.startsWith("/auth/forgot-password") || path.startsWith("/auth/reset-password");
      const hasAuthHeader = !!c.req.header("Authorization");
      if (!isXmlHttpRequest && !(isMobileOrValidPlatform && (isPublicAuthPath || hasAuthHeader))) {
        return c.json({ error: { code: "FORBIDDEN", message: "\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 (CSRF Guard)" } }, 403);
      }
      const origin = c.req.header("Origin");
      const isWeb = platform === "web" || !!origin;
      if (isWeb && !hasAuthHeader && !isXmlHttpRequest) {
        const csrfCookie = getCookie(c, "csrf_token") || existingToken;
        const csrfHeader = c.req.header("X-CSRF-Token");
        if (!csrfCookie || csrfCookie !== csrfHeader) {
          return c.json({ error: { code: "CSRF_ERROR", message: "\u0631\u0645\u0632 \u0627\u0644\u062D\u0645\u0627\u064A\u0629 \u0636\u062F \u0627\u0644\u062B\u063A\u0631\u0627\u062A (CSRF) \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" } }, 403);
        }
      }
    }
  }
  await next();
});
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "cross-origin");
});
app.get("/", (c) => c.json({
  name: "Fusha API",
  version: "1.0.0",
  status: "healthy",
  timestamp: (/* @__PURE__ */ new Date()).toISOString()
}));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/health/providers", requireAuth, requireRole("admin"), (c) => {
  return c.json({
    bunny_stream: {
      configured: !!(c.env.BUNNY_LIBRARY_ID && c.env.BUNNY_API_KEY)
    }
  });
});
app.get("/files/avatars/:id", async (c) => {
  const obj = await c.env.R2.get(`avatars/${c.req.param("id")}`);
  if (!obj) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=300");
  headers.set("X-Content-Type-Options", "nosniff");
  const storedType = obj.httpMetadata?.contentType || "image/jpeg";
  const safeType = ["image/jpeg", "image/png", "image/webp"].includes(storedType) ? storedType : "image/jpeg";
  headers.set("Content-Type", safeType);
  headers.set("Content-Disposition", "inline");
  return new Response(obj.body, { headers });
});
app.get("/files/covers/:id", async (c) => {
  const obj = await c.env.R2.get(`covers/${c.req.param("id")}`);
  if (!obj) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  const storedType = obj.httpMetadata?.contentType || "image/jpeg";
  const safeType = ["image/jpeg", "image/png", "image/webp"].includes(storedType) ? storedType : "image/jpeg";
  headers.set("Content-Type", safeType);
  headers.set("Content-Disposition", "inline");
  return new Response(obj.body, { headers });
});
app.get("/files/questions/:id", async (c) => {
  const obj = await c.env.R2.get(`questions/${c.req.param("id")}`);
  if (!obj) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  const storedType = obj.httpMetadata?.contentType || "image/jpeg";
  const safeType = ["image/jpeg", "image/png", "image/webp"].includes(storedType) ? storedType : "image/jpeg";
  headers.set("Content-Type", safeType);
  headers.set("Content-Disposition", "inline");
  return new Response(obj.body, { headers });
});
app.get("/files/apk", async (c) => {
  const obj = await c.env.R2.get("apk/fusha.apk");
  if (!obj) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Content-Type", "application/vnd.android.package-archive");
  headers.set("Content-Disposition", 'attachment; filename="fusha.apk"');
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(obj.body, { headers });
});
app.get("/files/voice/:id", async (c) => {
  const obj = await c.env.R2.get(`voice/${c.req.param("id")}`);
  if (!obj) {
    return c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  const storedType = obj.httpMetadata?.contentType || "audio/mpeg";
  const safeType = storedType.startsWith("audio/") ? storedType : "audio/mpeg";
  headers.set("Content-Type", safeType);
  headers.set("Content-Disposition", "inline");
  return new Response(obj.body, { headers });
});
app.route("/auth", auth_default);
app.route("/courses", courses_default);
app.route("/", playback_default);
app.route("/codes", codes_default);
app.route("/questions", questions_default);
app.route("/push", push_default);
app.route("/admin", admin_default);
app.route("/admin", bunny_default);
app.route("/", questionBank_default);
app.route("/dictionary", dictionary_default);
app.route("/", parent_default);
app.route("/", bundles_default);
app.route("/", news_default);
app.route("/", purchases_default);
app.route("/", examBuilds_default);
app.route("/", mistakes_default);
app.route("/", points_default);
app.route("/", wallets_default);
app.route("/", challenges_default);
app.route("/", conversations_default);
app.route("/", config_default);
app.notFound(
  (c) => c.json({ error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } }, 404)
);
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.url}:`, err);
  const isProduction = c.env.ENVIRONMENT === "production";
  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction ? "\u062D\u062F\u062B \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." : err.message,
      ...isProduction ? {} : { stack: err.stack?.slice(0, 500) }
    }
  }, 500);
});
var src_default = {
  fetch: app.fetch,
  // Queue consumer for background jobs
  async queue(batch, env, ctx) {
    const isVideoTransfer = batch.queue === "fusha-ashraf-video-transfer" || batch.messages && batch.messages.length > 0 && (batch.messages[0].body.type === "check_encoding" || batch.messages[0].body.type === "transfer_quality" || batch.messages[0].body.type === "finalize");
    if (isVideoTransfer) {
      ctx.waitUntil(handleVideoTransferQueue(batch, env));
    } else {
      ctx.waitUntil(handleNotificationQueue(batch, env));
    }
  },
  // Cron trigger (weekly maintenance)
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await env.DB.prepare(
        `UPDATE enrollments SET status = 'expired'
         WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < datetime('now')`
      ).run();
      await env.DB.prepare(
        `UPDATE activation_codes SET status = 'expired'
         WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < datetime('now')`
      ).run();
      await env.DB.prepare(
        `DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days')`
      ).run();
      console.log("Weekly maintenance completed");
    })());
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
